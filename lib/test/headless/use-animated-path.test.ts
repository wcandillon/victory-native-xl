import { createElement } from "react";
import * as Reanimated from "react-native-reanimated";
import { Skia } from "react-native-skia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedPathProbe } from "./fixtures/animatedPathProbe";
import { createHostRoot } from "./utils/renderInHost";

vi.mock("react-native-reanimated", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("react-native-reanimated")>();
  return {
    ...original,
    default: original.default,
    withTiming: vi.fn(original.withTiming),
  };
});

const withTiming = vi.mocked(Reanimated.withTiming);

const makeLine = (y: number) =>
  Skia.PathBuilder.Make().moveTo(0, y).lineTo(10, y).detach();

afterEach(() => {
  withTiming.mockClear();
});

describe("useAnimatedPath", () => {
  it("only starts an animation when the path changes", async () => {
    const first = makeLine(0);
    const second = makeLine(50);
    const onPath = vi.fn();
    const root = createHostRoot();
    const render = (path: typeof first, tick: number) =>
      root.render(createElement(AnimatedPathProbe, { path, onPath, tick }));

    // Mounting shows the path: there is nothing to animate from.
    await render(first, 0);
    expect(withTiming).not.toHaveBeenCalled();
    expect(onPath).toHaveBeenLastCalledWith(first);

    // Rendering again with the same path leaves a running animation alone,
    // even though the animation config is a new object.
    await render(first, 1);
    expect(withTiming).not.toHaveBeenCalled();

    await render(second, 2);
    expect(withTiming).toHaveBeenCalledTimes(1);

    await render(second, 3);
    expect(withTiming).toHaveBeenCalledTimes(1);

    await root.unmount();
  });
});
