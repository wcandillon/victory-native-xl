import { type SkPath } from "react-native-skia";
import * as React from "react";
import {
  useDerivedValue,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
  type WithDecayConfig,
  type WithSpringConfig,
  type WithTimingConfig,
} from "react-native-reanimated";
import {
  getPathAtProgress,
  makePathTransition,
  type PathTransition,
} from "./pathTransition";

export type PathAnimationConfig =
  | ({ type: "timing" } & WithTimingConfig)
  | ({ type: "spring" } & WithSpringConfig)
  | ({ type: "decay" } & WithDecayConfig);

function isWithDecayConfig(
  config: PathAnimationConfig,
): config is WithDecayConfig & { type: "decay" } {
  return config.type === "decay";
}

function isWithTimingConfig(
  config: PathAnimationConfig,
): config is WithTimingConfig & { type: "timing" } {
  return config.type === "timing";
}

function isWithSpringConfig(
  config: PathAnimationConfig,
): config is WithSpringConfig & { type: "spring" } {
  return config.type === "spring";
}

export const useAnimatedPath = (
  currentPathProp: SkPath,
  animConfig: PathAnimationConfig = { type: "timing", duration: 300 },
) => {
  const progressSV = useSharedValue(0);

  // The transition being played. Paths are immutable, so they are shared with
  // the caller instead of being copied.
  const transitionSV = useSharedValue<PathTransition>({
    from: currentPathProp,
    to: currentPathProp,
    tween: null,
  });

  // The path we are animating to, or showing once the animation is over.
  const targetPathRef = React.useRef(currentPathProp);

  // This effect starts a new transition when the path changes.
  React.useEffect(() => {
    // The target of the previous animation (or the initial path) is the
    // starting point of the new one.
    const fromPath = targetPathRef.current;
    if (fromPath === currentPathProp) {
      // Nothing to animate to: the component only rendered again.
      return;
    }
    targetPathRef.current = currentPathProp;

    // Whether, and how, the two paths can be interpolated is decided here,
    // once, instead of on every frame of the animation.
    transitionSV.value = makePathTransition(fromPath, currentPathProp);

    // Reset progress and start animation
    progressSV.value = 0;
    if (isWithTimingConfig(animConfig)) {
      progressSV.value = withTiming(1, animConfig);
    } else if (isWithSpringConfig(animConfig)) {
      progressSV.value = withSpring(1, animConfig);
    } else if (isWithDecayConfig(animConfig)) {
      progressSV.value = withDecay(animConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPathProp, animConfig]);

  const animatedPath = useDerivedValue<SkPath>(
    () => getPathAtProgress(transitionSV.value, progressSV.value),
    [],
  );

  return animatedPath;
};
