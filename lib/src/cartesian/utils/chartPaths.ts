import { Platform } from "react-native";
import { Skia, type SkPath, type SkPathBuilder } from "react-native-skia";
import type { MaybeNumber } from "../../types";
import { cleanPointsArray } from "../../utils/cleanPointsArray";
import { groupPointsArray } from "../../utils/groupPointsArray";
import {
  AREA_BOTTOM,
  AREA_TOP,
  LINE,
  drawCurve,
  type CurveType,
  type PathSink,
} from "./curves";

/**
 * A point of a line or of an area, in canvas coordinates. `y` is missing
 * where there is a gap in the data. The entries of a `PointsArray` are such
 * points.
 */
export type PathPoint = { x: number; y: MaybeNumber };

/**
 * A point whose coordinates are both known.
 */
export type DefinedPoint = { x: number; y: number };

export type LinePathOptions = {
  curveType?: CurveType;
  connectMissingData?: boolean;
};

export type AreaPathOptions = {
  curveType?: CurveType;
  connectMissingData?: boolean;
};

/**
 * On native, `addPoly` hands a whole polyline to Skia in a single JSI call.
 * On web, react-native-skia converts every point through temporary arrays
 * first, which is about twice as slow as issuing the commands one by one (see
 * `test/bench`), so that is what is done there.
 */
const USE_ADD_POLY = Platform.OS !== "web";

const PRECISION = 1000;

/**
 * Rounds a coordinate to 3 decimals.
 *
 * Paths used to be parsed from the SVG string d3-shape prints, in which every
 * coordinate is rounded this way. Rounding the same way here keeps the paths,
 * and so the pixels, exactly as they were. A thousandth of a pixel is far
 * below anything visible.
 */
const roundCoordinate = (value: number) => {
  "worklet";
  // Adding 0 turns -0 into 0, as printing it did.
  return Math.round(value * PRECISION) / PRECISION + 0;
};

const roundPoint = (x: number, y: number): DefinedPoint => {
  "worklet";
  return { x: roundCoordinate(x), y: roundCoordinate(y) };
};

/**
 * What the curves draw into: `builder`, with rounded coordinates. The curves
 * themselves compute with the coordinates as they are.
 */
const makeRoundingSink = (builder: SkPathBuilder): PathSink => {
  "worklet";
  const round = roundCoordinate;
  return {
    moveTo: (x, y) => builder.moveTo(round(x), round(y)),
    lineTo: (x, y) => builder.lineTo(round(x), round(y)),
    cubicTo: (x1, y1, x2, y2, x, y) =>
      builder.cubicTo(
        round(x1),
        round(y1),
        round(x2),
        round(y2),
        round(x),
        round(y),
      ),
    close: () => builder.close(),
  };
};

/**
 * Non-finite coordinates poison the whole Skia path, so a run that contains
 * any is skipped. This matches the SVG parser the paths used to go through,
 * which rejected such a run.
 */
const hasOnlyFinitePoints = (points: DefinedPoint[]) => {
  "worklet";
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  }
  return true;
};

/**
 * The runs of consecutive points to draw: one run with every point that has a
 * y value when gaps are bridged, one run per stretch between gaps otherwise.
 */
const getRuns = (points: PathPoint[], connectMissingData: boolean) => {
  "worklet";
  return (
    connectMissingData ? [cleanPointsArray(points)] : groupPointsArray(points)
  ) as DefinedPoint[][];
};

/**
 * Appends a line through `points` to `builder` as a new contour.
 */
export const addLineToPathBuilder = (
  builder: SkPathBuilder,
  points: DefinedPoint[],
  curveType: CurveType,
  // Not a default value: in a worklet, the variables captured from the module
  // are not in scope yet when default values are evaluated.
  useAddPoly?: boolean,
) => {
  "worklet";
  const count = points.length;
  if (count === 0 || !hasOnlyFinitePoints(points)) return;

  if (curveType === "linear" && count > 1 && (useAddPoly ?? USE_ADD_POLY)) {
    const polyline: DefinedPoint[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const point = points[i]!;
      polyline[i] = roundPoint(point.x, point.y);
    }
    builder.addPoly(polyline, false);
    return;
  }

  const x: number[] = new Array(count);
  const y: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const point = points[i]!;
    x[i] = point.x;
    y[i] = point.y;
  }
  drawCurve(makeRoundingSink(builder), curveType, x, y, LINE);
};

/**
 * Appends the area between `points` and their baseline to `builder` as a new
 * closed contour. `baseline[i]` is the y coordinate below `points[i]`.
 */
export const addAreaToPathBuilder = (
  builder: SkPathBuilder,
  points: DefinedPoint[],
  baseline: number[],
  curveType: CurveType,
  useAddPoly?: boolean,
) => {
  "worklet";
  const count = points.length;
  if (count === 0 || !hasOnlyFinitePoints(points)) return;
  for (let i = 0; i < count; i++) {
    if (!Number.isFinite(baseline[i])) return;
  }

  if (curveType === "linear" && (useAddPoly ?? USE_ADD_POLY)) {
    // The points, then the baseline walked back from the last point to the
    // first.
    const outline: DefinedPoint[] = new Array(2 * count);
    for (let i = 0; i < count; i++) {
      const point = points[i]!;
      outline[i] = roundPoint(point.x, point.y);
      outline[2 * count - 1 - i] = roundPoint(point.x, baseline[i]!);
    }
    builder.addPoly(outline, true);
    return;
  }

  const x: number[] = new Array(count);
  const y: number[] = new Array(count);
  const baselineX: number[] = new Array(count);
  const baselineY: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const point = points[i]!;
    x[i] = point.x;
    y[i] = point.y;
    // The baseline is walked back from the last point to the first.
    baselineX[count - 1 - i] = point.x;
    baselineY[count - 1 - i] = baseline[i]!;
  }
  const sink = makeRoundingSink(builder);
  drawCurve(sink, curveType, x, y, AREA_TOP);
  drawCurve(sink, curveType, baselineX, baselineY, AREA_BOTTOM);
};

/**
 * Builds the path of a line through `points`.
 *
 * This is what `useLinePath` and `Line` use. It is a worklet, so that it can
 * also be called on the UI thread, for instance from `useDerivedValue`, to
 * build a path from shared values without going through the JS thread.
 */
export const buildLinePath = (
  points: PathPoint[],
  options: LinePathOptions = {},
): SkPath => {
  "worklet";
  const { curveType = "linear", connectMissingData = false } = options;
  const builder = Skia.PathBuilder.Make();
  const runs = getRuns(points, connectMissingData);
  for (let i = 0; i < runs.length; i++) {
    addLineToPathBuilder(builder, runs[i]!, curveType);
  }
  return builder.detach();
};

/**
 * Builds the path of the area between `points` and the horizontal line at
 * `y0`.
 *
 * This is what `useAreaPath` and `Area` use. It is a worklet, so that it can
 * also be called on the UI thread, for instance from `useDerivedValue`, to
 * build a path from shared values without going through the JS thread.
 */
export const buildAreaPath = (
  points: PathPoint[],
  y0: number,
  options: AreaPathOptions = {},
): SkPath => {
  "worklet";
  const { curveType = "linear", connectMissingData = false } = options;
  const builder = Skia.PathBuilder.Make();
  const runs = getRuns(points, connectMissingData);
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    const baseline: number[] = new Array(run.length);
    for (let j = 0; j < run.length; j++) {
      baseline[j] = y0;
    }
    addAreaToPathBuilder(builder, run, baseline, curveType);
  }
  return builder.detach();
};
