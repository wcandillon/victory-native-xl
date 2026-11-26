import { createElement } from "react";
import { Gesture } from "react-native-gesture-handler";
import * as Reanimated from "react-native-reanimated";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CartesianFixture,
  PolarFixture,
  TransformStateProbe,
  type ChartFeatures,
} from "./fixtures/transformCharts";
import { createHostRoot } from "./utils/renderInHost";

const { gestureDetector } = vi.hoisted(() => ({ gestureDetector: vi.fn() }));

vi.mock("react-native-gesture-handler", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("react-native-gesture-handler")>();
  return {
    ...original,
    GestureDetector: (props: { children?: unknown }) => {
      gestureDetector();
      return props.children;
    },
  };
});

vi.mock("react-native-reanimated", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("react-native-reanimated")>();
  return {
    ...original,
    default: original.default,
    useAnimatedReaction: vi.fn(original.useAnimatedReaction),
  };
});

const animatedReaction = vi.mocked(Reanimated.useAnimatedReaction);

afterEach(() => {
  gestureDetector.mockClear();
  animatedReaction.mockClear();
});

const mount = async (element: ReturnType<typeof createElement>) => {
  const root = createHostRoot();
  await root.render(element);
  return root;
};

describe("CartesianChart without pan and zoom", () => {
  it("renders its content once when it mounts", async () => {
    const onRenderContent = vi.fn();
    const root = await mount(
      createElement(CartesianFixture, { onRenderContent }),
    );

    expect(onRenderContent).toHaveBeenCalledTimes(1);
    await root.unmount();
  });

  it("does not set up an animated reaction", async () => {
    const root = await mount(createElement(CartesianFixture, {}));

    expect(animatedReaction).not.toHaveBeenCalled();
    await root.unmount();
  });
});

describe("CartesianChart with pan and zoom", () => {
  it("tracks the transform with an animated reaction", async () => {
    const root = await mount(
      createElement(CartesianFixture, { transform: true }),
    );

    expect(animatedReaction).toHaveBeenCalled();
    await root.unmount();
  });

  it("renders its content once when it mounts untransformed", async () => {
    const onRenderContent = vi.fn();
    const root = await mount(
      createElement(CartesianFixture, { transform: true, onRenderContent }),
    );

    expect(onRenderContent).toHaveBeenCalledTimes(1);
    await root.unmount();
  });
});

describe("gesture overlay", () => {
  const cartesianCases: [string, ChartFeatures, boolean][] = [
    ["no gestures", {}, false],
    ["a transform state", { transform: true }, true],
    ["a press state", { press: true }, true],
    ["custom gestures", { customGestures: Gesture.Race() }, true],
  ];

  it.each(cartesianCases)(
    "CartesianChart with %s",
    async (_name, features, expected) => {
      const root = await mount(createElement(CartesianFixture, features));

      expect(gestureDetector.mock.calls.length > 0).toBe(expected);
      await root.unmount();
    },
  );

  const polarCases: [string, ChartFeatures, boolean][] = [
    ["no gestures", {}, false],
    ["a transform state", { transform: true }, true],
  ];

  it.each(polarCases)(
    "PolarChart with %s",
    async (_name, features, expected) => {
      const root = await mount(createElement(PolarFixture, features));

      expect(gestureDetector.mock.calls.length > 0).toBe(expected);
      await root.unmount();
    },
  );
});

describe("useChartTransformState", () => {
  it("returns the same state and shared values on every render", async () => {
    const onState = vi.fn();
    const root = createHostRoot();
    await root.render(createElement(TransformStateProbe, { onState, tick: 0 }));
    await root.render(createElement(TransformStateProbe, { onState, tick: 1 }));

    expect(onState).toHaveBeenCalledTimes(2);
    const first = onState.mock.calls[0]![0];
    const second = onState.mock.calls[1]![0];
    expect(second).toBe(first);
    expect(second.panActive).toBe(first.panActive);
    expect(second.zoomActive).toBe(first.zoomActive);
    await root.unmount();
  });
});
