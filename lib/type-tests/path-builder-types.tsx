import type { SkPath } from "react-native-skia";
import {
  buildAreaPath,
  buildLinePath,
  type CurveType,
  type PathPoint,
  type PointsArray,
} from "victory-native";

declare const chartPoints: PointsArray;

// The points of a chart can be passed as they are.
export const lineFromChartPoints: SkPath = buildLinePath(chartPoints);
export const areaFromChartPoints: SkPath = buildAreaPath(chartPoints, 100);

// So can plain points, with a gap where `y` is missing.
const points: PathPoint[] = [
  { x: 0, y: 10 },
  { x: 10, y: null },
  { x: 20, y: undefined },
  { x: 30, y: 5 },
];
const curveType: CurveType = "monotoneX";

export const line: SkPath = buildLinePath(points, {
  curveType,
  connectMissingData: true,
});
export const area: SkPath = buildAreaPath(points, 100, { curveType });

// @ts-expect-error not a curve type
buildLinePath(points, { curveType: "wavy" });

// @ts-expect-error the baseline of an area is required
buildAreaPath(points);
