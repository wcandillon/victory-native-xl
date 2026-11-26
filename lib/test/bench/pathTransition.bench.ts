/**
 * Microbenchmark for one frame of a path animation between two paths that
 * cannot be interpolated directly (here: a line that gained a point).
 *
 * The baseline is what every frame used to cost: both paths printed as SVG,
 * rounded, parsed back and compared again, before jumping to one of them
 * anyway. That decision is now made once per transition.
 *
 * Run with `yarn workspace victory-native bench`.
 */
import { Skia, type SkPath } from "react-native-skia";
import { bench, describe } from "vitest";
import {
  getPathAtProgress,
  makePathTransition,
} from "../../src/hooks/pathTransition";

const SIZES = [12, 100, 1000, 5000];

const makeLine = (count: number) => {
  let seed = 42;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const builder = Skia.PathBuilder.Make();
  for (let i = 0; i < count; i++) {
    const x = 16 + (i * 360) / Math.max(1, count - 1);
    const y = 20 + random() * 180;
    if (i === 0) builder.moveTo(x, y);
    else builder.lineTo(x, y);
  }
  return builder.detach();
};

const normalizePrecision = (svg: string) =>
  svg.replace(/(\d+\.\d+)/g, (match) => parseFloat(match).toFixed(3));

const previousFrame = (from: SkPath, to: SkPath, progress: number) => {
  if (to.isInterpolatable(from)) {
    return Skia.Path.Interpolate(to, from, progress);
  }
  const toNormalized = Skia.Path.MakeFromSVGString(
    normalizePrecision(to.toSVGString()),
  )!;
  const fromNormalized = Skia.Path.MakeFromSVGString(
    normalizePrecision(from.toSVGString()),
  )!;
  const interpolatable = toNormalized.isInterpolatable(fromNormalized);
  toNormalized.dispose();
  fromNormalized.dispose();
  return interpolatable ? null : progress > 0.5 ? to : from;
};

describe.each(SIZES)("frame of a transition, %i to one more point", (count) => {
  const from = makeLine(count);
  const to = makeLine(count + 1);
  const transition = makePathTransition(from, to);

  bench("serialize and parse on every frame (baseline)", () => {
    previousFrame(from, to, 0.4);
  });

  bench("decided once per transition", () => {
    getPathAtProgress(transition, 0.4);
  });
});
