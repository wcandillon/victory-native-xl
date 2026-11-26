import type { SkPath } from "react-native-skia";
import { useAnimatedPath } from "victory-native";

/**
 * Animates `path` the way a chart component with an inline `animate` prop
 * does: with an animation config that is a new object on every render.
 */
export const AnimatedPathProbe = ({
  path,
  onPath,
}: {
  path: SkPath;
  onPath: (path: SkPath) => void;
  // Only there to render the component again.
  tick?: number;
}) => {
  const animated = useAnimatedPath(path, { type: "timing", duration: 300 });
  onPath(animated.value);
  return null;
};
