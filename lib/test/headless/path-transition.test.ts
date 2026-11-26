import { Skia, type SkPath } from "react-native-skia";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPathAtProgress,
  makePathTransition,
} from "../../src/hooks/pathTransition";

const makeLine = (count: number, offset = 0) => {
  const builder = Skia.PathBuilder.Make();
  for (let i = 0; i < count; i++) {
    const x = i * 10;
    const y = offset + (i % 2) * 20;
    if (i === 0) builder.moveTo(x, y);
    else builder.lineTo(x, y);
  }
  return builder.detach();
};

// A pie slice: the arc is made of conics, whose weights depend on the angle.
const makeSlice = (sweepAngle: number) =>
  Skia.PathBuilder.Make()
    .moveTo(100, 100)
    .arcToOval(Skia.XYWHRect(0, 0, 200, 200), 0, sweepAngle, false)
    .close()
    .detach();

const commands = (path: SkPath) => JSON.stringify(path.toCmds());

afterEach(() => {
  vi.restoreAllMocks();
});

describe("makePathTransition", () => {
  it("interpolates compatible paths as they are", () => {
    const from = makeLine(5);
    const to = makeLine(5, 40);
    const transition = makePathTransition(from, to);

    expect(transition.tween?.from).toBe(from);
    expect(transition.tween?.to).toBe(to);
  });

  it("does not interpolate paths with different commands", () => {
    const transition = makePathTransition(makeLine(5), makeLine(6));

    expect(transition.tween).toBeNull();
  });

  it("interpolates arcs that only differ by the weight of their conics", () => {
    const from = makeSlice(95);
    const to = makeSlice(100);
    expect(to.isInterpolatable(from)).toBe(false);

    const transition = makePathTransition(from, to);

    expect(transition.from).toBe(from);
    expect(transition.to).toBe(to);
    expect(transition.tween).not.toBeNull();
    expect(transition.tween!.to.isInterpolatable(transition.tween!.from)).toBe(
      true,
    );
  });

  it("does not interpolate arcs that need a different number of curves", () => {
    const transition = makePathTransition(makeSlice(40), makeSlice(200));

    expect(transition.tween).toBeNull();
  });
});

describe("getPathAtProgress", () => {
  it("returns the paths themselves at both ends", () => {
    const from = makeSlice(95);
    const to = makeSlice(100);
    const transition = makePathTransition(from, to);

    expect(getPathAtProgress(transition, 0)).toBe(from);
    expect(getPathAtProgress(transition, 1)).toBe(to);
  });

  it("interpolates in between", () => {
    const transition = makePathTransition(makeLine(2), makeLine(2, 100));

    expect(getPathAtProgress(transition, 0.25).toSVGString()).toBe(
      "M0 25L10 45",
    );
    expect(getPathAtProgress(transition, 0.75).toSVGString()).toBe(
      "M0 75L10 95",
    );
  });

  it("interpolates arcs through their quads", () => {
    const from = makeSlice(95);
    const to = makeSlice(100);
    const transition = makePathTransition(from, to);
    const halfway = getPathAtProgress(transition, 0.5);

    expect(halfway).not.toBe(from);
    expect(halfway).not.toBe(to);
    expect(commands(halfway)).not.toBe(commands(transition.tween!.from));
    expect(commands(halfway)).not.toBe(commands(transition.tween!.to));
  });

  it("jumps to the closest path when it cannot interpolate", () => {
    const from = makeLine(5);
    const to = makeLine(6);
    const transition = makePathTransition(from, to);

    expect(getPathAtProgress(transition, 0.25)).toBe(from);
    expect(getPathAtProgress(transition, 0.5)).toBe(from);
    expect(getPathAtProgress(transition, 0.75)).toBe(to);
  });

  it("does not serialize or parse paths on each frame", () => {
    const cases = [
      makePathTransition(makeLine(5), makeLine(5, 40)),
      makePathTransition(makeLine(5), makeLine(6)),
      makePathTransition(makeSlice(95), makeSlice(100)),
      makePathTransition(makeSlice(40), makeSlice(200)),
    ];
    const parse = vi.spyOn(Skia.Path, "MakeFromSVGString");
    const print = vi.spyOn(
      Object.getPrototypeOf(makeLine(2)) as SkPath,
      "toSVGString",
    );

    for (const transition of cases) {
      for (let frame = 0; frame <= 30; frame++) {
        getPathAtProgress(transition, frame / 30);
      }
    }

    expect(parse).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });
});
