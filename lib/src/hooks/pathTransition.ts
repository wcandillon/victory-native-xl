import { Skia, type SkPath } from "react-native-skia";
import { interpolatePath } from "./interpolatePath";

/**
 * How to get from one path to another, worked out once when the target of an
 * animation changes rather than on every frame.
 */
export type PathTransition = {
  /** The path at the start of the transition. */
  from: SkPath;
  /** The path at the end of the transition. */
  to: SkPath;
  /**
   * The two paths to interpolate between, or `null` when the transition
   * cannot be interpolated and has to jump from one path to the other.
   */
  tween: { from: SkPath; to: SkPath } | null;
};

/**
 * Printing a path as SVG and parsing it back turns its conics into quads.
 */
const withQuadsForConics = (path: SkPath) =>
  Skia.Path.MakeFromSVGString(path.toSVGString());

export const makePathTransition = (
  from: SkPath,
  to: SkPath,
): PathTransition => {
  if (to.isInterpolatable(from)) {
    return { from, to, tween: { from, to } };
  }

  // Two paths with the same commands still cannot be interpolated when their
  // conics have different weights, which is the case for arcs of different
  // angles such as the slices of a pie. Once the conics are quads, such paths
  // can often be interpolated.
  const fromQuads = withQuadsForConics(from);
  const toQuads = withQuadsForConics(to);
  if (fromQuads && toQuads && toQuads.isInterpolatable(fromQuads)) {
    return { from, to, tween: { from: fromQuads, to: toQuads } };
  }

  return { from, to, tween: null };
};

/**
 * The path to show when the transition is at `progress`, from 0 to 1.
 */
export const getPathAtProgress = (
  { from, to, tween }: PathTransition,
  progress: number,
): SkPath => {
  "worklet";

  if (progress === 0) {
    return from;
  }
  if (progress === 1) {
    return to;
  }

  if (tween) {
    const interpolated = interpolatePath(tween.from, tween.to, progress);
    if (interpolated) {
      return interpolated;
    }
  }

  // The paths cannot be interpolated: jump to the closest one.
  return progress > 0.5 ? to : from;
};
