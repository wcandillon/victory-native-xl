import path from "node:path";
import { fileURLToPath } from "node:url";
import { Skia, type SkPath } from "react-native-skia";
import { describe, expect, it } from "vitest";
import * as chartPaths from "../../src/cartesian/utils/chartPaths";
import { CURVE_TYPES } from "../utils/d3Curves";
import {
  loadWithWorkletsPlugin,
  reviveOnSeparateRuntime,
} from "./utils/worklets";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The path builders, compiled with the worklets plugin as they are in an app.
const compiled = loadWithWorkletsPlugin<typeof chartPaths>(
  path.join(__dirname, "../../src/cartesian/utils/chartPaths.ts"),
  {
    "react-native-skia": { Skia },
    "react-native": { Platform: { OS: "ios" } },
  },
);

const POINTS = [42, 68, 35, 80, null, 55, null, 20, 62, 48, 90, 30].map(
  (y, i) => ({ x: 12 + i * 34, y }),
);

const commands = (builtPath: SkPath) => builtPath.toCmds();

describe("path builders as worklets", () => {
  it("captures nothing but worklets and values", () => {
    expect(() => reviveOnSeparateRuntime(compiled.buildLinePath)).not.toThrow();
    expect(() => reviveOnSeparateRuntime(compiled.buildAreaPath)).not.toThrow();
  });

  describe.each(CURVE_TYPES)("%s", (curveType) => {
    it.each([false, true])(
      "builds the same line on a separate runtime (connectMissingData: %s)",
      (connectMissingData) => {
        const options = { curveType, connectMissingData };
        const onRuntime = reviveOnSeparateRuntime(compiled.buildLinePath);

        expect(commands(onRuntime(POINTS, options))).toEqual(
          commands(chartPaths.buildLinePath(POINTS, options)),
        );
      },
    );

    it.each([false, true])(
      "builds the same area on a separate runtime (connectMissingData: %s)",
      (connectMissingData) => {
        const options = { curveType, connectMissingData };
        const onRuntime = reviveOnSeparateRuntime(compiled.buildAreaPath);

        expect(commands(onRuntime(POINTS, 220, options))).toEqual(
          commands(chartPaths.buildAreaPath(POINTS, 220, options)),
        );
      },
    );
  });

  it("builds a path with the default options", () => {
    const onRuntime = reviveOnSeparateRuntime(compiled.buildLinePath);

    expect(commands(onRuntime(POINTS)).length).toBeGreaterThan(0);
  });
});

describe("reviveOnSeparateRuntime", () => {
  const { complete, incomplete, notAWorklet } = loadWithWorkletsPlugin<
    typeof import("./fixtures/workletCompleteness")
  >(path.join(__dirname, "fixtures/workletCompleteness.ts"));

  it("runs a worklet whose helpers are all worklets", () => {
    expect(reviveOnSeparateRuntime(complete)(4)).toBe(9);
  });

  it("rejects a worklet that calls a function without the directive", () => {
    expect(() => reviveOnSeparateRuntime(incomplete)).toThrow(
      'captures the function "triple", which is not a worklet',
    );
  });

  it("rejects a function without the directive", () => {
    expect(() => reviveOnSeparateRuntime(notAWorklet)).toThrow("Not a worklet");
  });
});
