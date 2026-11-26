import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);

type Exports = Record<string, unknown>;

/**
 * What the worklets Babel plugin attaches to a function that it turned into
 * a worklet.
 */
type Worklet = ((...args: never[]) => unknown) & {
  __workletHash: number;
  __closure: Record<string, unknown>;
  __initData: { code: string };
};

const isWorklet = (value: unknown): value is Worklet =>
  typeof value === "function" && "__workletHash" in value;

const resolveSource = (file: string) => {
  const found = [file, `${file}.ts`, `${file}.tsx`].find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
  if (!found) throw new Error(`Cannot resolve ${file}`);
  return found;
};

/**
 * Loads a module of the library, and the modules it imports, compiled the
 * way an app compiles them: by Babel, with the plugin of
 * `react-native-worklets` that turns the functions marked with a `"worklet"`
 * directive into worklets. `externals` are the packages to provide instead
 * of loading them.
 */
export const loadWithWorkletsPlugin = <T extends Exports>(
  entry: string,
  externals: Record<string, unknown> = {},
): T => {
  const babel = require("@babel/core") as typeof import("@babel/core");
  const modules = new Map<string, { exports: Exports }>();

  const load = (file: string): Exports => {
    const loaded = modules.get(file);
    if (loaded) return loaded.exports;

    const result = babel.transformSync(fs.readFileSync(file, "utf8"), {
      filename: file,
      babelrc: false,
      configFile: false,
      presets: [require.resolve("@babel/preset-typescript")],
      plugins: [
        require.resolve("react-native-worklets/plugin"),
        require.resolve("@babel/plugin-transform-modules-commonjs"),
      ],
    });
    const module = { exports: {} as Exports };
    modules.set(file, module);
    const localRequire = (request: string) => {
      if (request in externals) return externals[request];
      if (request.startsWith(".")) {
        return load(resolveSource(path.resolve(path.dirname(file), request)));
      }
      throw new Error(`${file} imports ${request}, which is not provided`);
    };
    new Function("module", "exports", "require", result!.code!)(
      module,
      module.exports,
      localRequire,
    );
    return module.exports;
  };

  return load(entry) as T;
};

/**
 * Rebuilds a worklet the way the UI runtime gets it: from the code that the
 * plugin serialized, evaluated in a separate JavaScript context where the
 * only variables in scope are those the plugin captured in its closure. The
 * worklets in that closure are rebuilt in the same way, recursively.
 *
 * A function that was captured without being a worklet itself could not be
 * called on the UI thread: this throws when it finds one.
 */
export const reviveOnSeparateRuntime = <T>(worklet: T): T => {
  const runtime = vm.createContext({});
  const revived = new Map<Worklet, unknown>();

  const revive = (value: unknown, owner: string): unknown => {
    if (typeof value !== "function") return value;
    if (!isWorklet(value)) {
      throw new Error(
        `${owner} captures the function "${value.name}", which is not a worklet`,
      );
    }
    if (revived.has(value)) return revived.get(value);

    const closure: Record<string, unknown> = {};
    const implementation = vm.runInContext(
      `(${value.__initData.code})`,
      runtime,
    ) as (...args: unknown[]) => unknown;
    const onRuntime = (...args: unknown[]) =>
      implementation.apply({ __closure: closure }, args);
    revived.set(value, onRuntime);
    for (const [name, captured] of Object.entries(value.__closure)) {
      closure[name] = revive(captured, name);
    }
    return onRuntime;
  };

  if (!isWorklet(worklet)) {
    throw new Error("Not a worklet: is the worklet directive missing?");
  }
  return revive(worklet, "the worklet") as T;
};
