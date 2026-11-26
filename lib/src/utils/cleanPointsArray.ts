import { type MaybeNumber } from "../types";

/**
 * Filters out points with missing y value, used for interpolating missing data.
 */
export const cleanPointsArray = <Point extends { y: MaybeNumber }>(
  points: Point[],
): Point[] => {
  "worklet";
  return points.filter((point) => typeof point.y === "number");
};
