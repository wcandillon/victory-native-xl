import { area, line } from "d3-shape";
import { describe, expect, it } from "vitest";
import { CURVE_TYPES, D3_CURVES } from "../../../test/utils/d3Curves";
import {
  AREA_BOTTOM,
  AREA_TOP,
  LINE,
  drawCurve,
  type CurveType,
  type PathSink,
} from "./curves";

type Command = [string, ...number[]];
type Point = [number, number];

/**
 * Records the commands a port issues.
 */
const makeSink = (commands: Command[]): PathSink => ({
  moveTo: (...args) => commands.push(["M", ...args]),
  lineTo: (...args) => commands.push(["L", ...args]),
  cubicTo: (...args) => commands.push(["C", ...args]),
  close: () => commands.push(["Z"]),
});

/**
 * Records the commands d3-shape issues when it draws into a canvas context.
 */
const makeContext = (commands: Command[]) =>
  ({
    moveTo: (...args: number[]) => commands.push(["M", ...args]),
    lineTo: (...args: number[]) => commands.push(["L", ...args]),
    bezierCurveTo: (...args: number[]) => commands.push(["C", ...args]),
    closePath: () => commands.push(["Z"]),
  }) as unknown as CanvasRenderingContext2D;

const portedLine = (curveType: CurveType, points: Point[]) => {
  const commands: Command[] = [];
  drawCurve(
    makeSink(commands),
    curveType,
    points.map(([x]) => x),
    points.map(([, y]) => y),
    LINE,
  );
  return commands;
};

const d3Line = (curveType: CurveType, points: Point[]) => {
  const commands: Command[] = [];
  line().curve(D3_CURVES[curveType]).context(makeContext(commands))(points);
  return commands;
};

const portedArea = (
  curveType: CurveType,
  points: Point[],
  baseline: (index: number) => number,
) => {
  const commands: Command[] = [];
  const sink = makeSink(commands);
  const reversed = points.map((point, i) => [point[0], baseline(i)]).reverse();
  drawCurve(
    sink,
    curveType,
    points.map(([x]) => x),
    points.map(([, y]) => y),
    AREA_TOP,
  );
  drawCurve(
    sink,
    curveType,
    reversed.map(([x]) => x!),
    reversed.map(([, y]) => y!),
    AREA_BOTTOM,
  );
  return commands;
};

const d3Area = (
  curveType: CurveType,
  points: Point[],
  baseline: (index: number) => number,
) => {
  const commands: Command[] = [];
  area()
    .y0((_, i) => baseline(i))
    .curve(D3_CURVES[curveType])
    .context(makeContext(commands))(points);
  return commands;
};

// Deterministic pseudo random numbers, so failures are reproducible.
const makeRandom = (seed: number) => () =>
  (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

const randomPoints = (count: number, seed: number): Point[] => {
  const random = makeRandom(seed);
  return Array.from({ length: count }, (_, i) => [
    16 + (i * 360) / Math.max(1, count - 1) + random(),
    20 + random() * 180,
  ]);
};

const DATASETS: Record<string, Point[]> = {
  "1 point": randomPoints(1, 1),
  "2 points": randomPoints(2, 2),
  "3 points": randomPoints(3, 3),
  "4 points": randomPoints(4, 4),
  "5 points": randomPoints(5, 5),
  "12 points": randomPoints(12, 12),
  "250 points": randomPoints(250, 250),
  "a flat line": randomPoints(6, 6).map(([x]) => [x, 80]),
  "integer coordinates": [
    [0, 10],
    [10, 40],
    [20, 5],
    [30, 30],
    [40, 30],
  ],
  "every point repeated": randomPoints(5, 7).flatMap((point) => [point, point]),
  "the same point three times": [
    [50, 50],
    [50, 50],
    [50, 50],
  ],
  "a repeated first point": [
    [10, 30],
    [10, 30],
    [40, 90],
    [90, 10],
  ],
  "a repeated last point": [
    [10, 30],
    [40, 90],
    [90, 10],
    [90, 10],
  ],
  "vertical segments": [
    [10, 30],
    [50, 60],
    [50, 120],
    [50, 20],
    [90, 10],
  ],
  "x going backwards": randomPoints(8, 8).reverse(),
  "x going back and forth": [
    [10, 10],
    [60, 80],
    [30, 40],
    [90, 20],
    [20, 70],
  ],
  "negative and large coordinates": [
    [-1e6, 3.5],
    [-12.25, -8e5],
    [0, 0],
    [1e-9, 1e9],
    [7e5, -0.125],
  ],
};

const flatBaseline = () => 220;
// Stands in for the per point baseline of a stacked area.
const slantedBaseline = (index: number) => 220 - index * 1.5;

describe("the curves ported from d3-shape", () => {
  describe.each(CURVE_TYPES)("%s", (curveType) => {
    it("draws nothing without points", () => {
      expect(portedLine(curveType, [])).toEqual([]);
      expect(portedArea(curveType, [], flatBaseline)).toEqual([]);
    });

    // `toEqual` compares numbers with `Object.is`: the coordinates have to
    // be exactly those d3-shape computes, down to the sign of zero.
    it.each(Object.keys(DATASETS))("draws the same line for %s", (name) => {
      const points = DATASETS[name]!;
      const commands = portedLine(curveType, points);

      expect(commands.length).toBeGreaterThan(0);
      expect(commands).toEqual(d3Line(curveType, points));
    });

    it.each(Object.keys(DATASETS))(
      "draws the same area over a flat baseline for %s",
      (name) => {
        const points = DATASETS[name]!;

        expect(portedArea(curveType, points, flatBaseline)).toEqual(
          d3Area(curveType, points, flatBaseline),
        );
      },
    );

    it.each(Object.keys(DATASETS))(
      "draws the same area over a per point baseline for %s",
      (name) => {
        const points = DATASETS[name]!;

        expect(portedArea(curveType, points, slantedBaseline)).toEqual(
          d3Area(curveType, points, slantedBaseline),
        );
      },
    );
  });

  it("draws an unknown curve type as a linear one", () => {
    const points = DATASETS["5 points"]!;

    expect(portedLine("unknown" as CurveType, points)).toEqual(
      d3Line("linear", points),
    );
  });
});
