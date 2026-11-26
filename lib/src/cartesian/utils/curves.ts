/**
 * The curves a line or an area can be drawn with.
 *
 * They are ports of the curves of d3-shape (https://github.com/d3/d3-shape),
 * written as worklets that draw into a Skia `PathBuilder`, so that paths can
 * be built on the UI thread as well as on the JS thread. Each of them issues
 * exactly the commands, with exactly the coordinates, that d3-shape issues
 * for the same points: the arithmetic is deliberately left as it is there.
 *
 * d3-shape is distributed under the ISC license:
 *
 * Copyright 2010-2022 Mike Bostock
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

/**
 * - `linear`: straight segments
 * - `natural`: a natural cubic spline
 * - `bumpX`, `bumpY`: a horizontal or vertical S-curve between points
 * - `cardinal`, `cardinal50`: a cardinal spline with a tension of 0 or 0.5
 * - `catmullRom`, `catmullRom0`, `catmullRom100`: a Catmull-Rom spline with
 *   an alpha of 0.5 (centripetal), 0 (uniform) or 1 (chordal)
 * - `monotoneX`: a cubic spline that preserves monotonicity in y
 * - `step`, `stepAfter`, `stepBefore`: a step function that changes midway
 *   between points, at the next point or at the current point
 * - `basis`: a cubic basis spline
 */
export type CurveType =
  | "linear"
  | "natural"
  | "bumpX"
  | "bumpY"
  | "cardinal"
  | "cardinal50"
  | "catmullRom"
  | "catmullRom0"
  | "catmullRom100"
  | "monotoneX"
  | "step"
  | "stepAfter"
  | "stepBefore"
  | "basis";

/**
 * What a curve draws into: the path commands it needs, as named by Skia's
 * `PathBuilder`.
 */
export type PathSink = {
  moveTo: (x: number, y: number) => unknown;
  lineTo: (x: number, y: number) => unknown;
  cubicTo: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ) => unknown;
  close: () => unknown;
};

/**
 * Which part of a shape a run of points is:
 * - `LINE`: a line on its own. It starts a new contour, which is left open
 *   unless it is a single point.
 * - `AREA_TOP`: the top edge of an area. It starts a new contour, which the
 *   baseline will complete.
 * - `AREA_BOTTOM`: the baseline of an area, from its last point to its first.
 *   It continues the contour of the top edge and closes it.
 */
export type CurveSection = 0 | 1 | 2;
export const LINE: CurveSection = 0;
export const AREA_TOP: CurveSection = 1;
export const AREA_BOTTOM: CurveSection = 2;

const EPSILON = 1e-12;

const begin = (sink: PathSink, section: CurveSection, x: number, y: number) => {
  "worklet";
  if (section === AREA_BOTTOM) {
    sink.lineTo(x, y);
  } else {
    sink.moveTo(x, y);
  }
};

/**
 * `count` is the number of points the curve took into account.
 */
const end = (sink: PathSink, section: CurveSection, count: number) => {
  "worklet";
  if (section === AREA_BOTTOM || (section === LINE && count === 1)) {
    sink.close();
  }
};

const drawLinear = (
  sink: PathSink,
  x: number[],
  y: number[],
  section: CurveSection,
) => {
  "worklet";
  const n = x.length;
  begin(sink, section, x[0]!, y[0]!);
  for (let i = 1; i < n; i++) {
    sink.lineTo(x[i]!, y[i]!);
  }
  end(sink, section, n);
};

/**
 * `position` is where the step happens between two points: 0 at the first
 * one, 1 at the second one.
 */
const drawStep = (
  sink: PathSink,
  x: number[],
  y: number[],
  section: CurveSection,
  position: number,
) => {
  "worklet";
  // The baseline of an area is walked backwards: its steps are mirrored.
  const t = section === AREA_BOTTOM ? 1 - position : position;
  const n = x.length;
  let px = x[0]!;
  let py = y[0]!;
  begin(sink, section, px, py);
  for (let i = 1; i < n; i++) {
    const cx = x[i]!;
    const cy = y[i]!;
    if (t <= 0) {
      sink.lineTo(px, cy);
      sink.lineTo(cx, cy);
    } else {
      const x1 = px * (1 - t) + cx * t;
      sink.lineTo(x1, py);
      sink.lineTo(x1, cy);
    }
    px = cx;
    py = cy;
  }
  if (0 < t && t < 1 && n >= 2) {
    sink.lineTo(px, py);
  }
  end(sink, section, n);
};

const drawBump = (
  sink: PathSink,
  x: number[],
  y: number[],
  section: CurveSection,
  alongX: boolean,
) => {
  "worklet";
  const n = x.length;
  let px = x[0]!;
  let py = y[0]!;
  begin(sink, section, px, py);
  for (let i = 1; i < n; i++) {
    const cx = x[i]!;
    const cy = y[i]!;
    if (alongX) {
      const mx = (px + cx) / 2;
      sink.cubicTo(mx, py, mx, cy, cx, cy);
    } else {
      const my = (py + cy) / 2;
      sink.cubicTo(px, my, cx, my, cx, cy);
    }
    px = cx;
    py = cy;
  }
  end(sink, section, n);
};

const basisSegment = (
  sink: PathSink,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number,
  y: number,
) => {
  "worklet";
  sink.cubicTo(
    (2 * x0 + x1) / 3,
    (2 * y0 + y1) / 3,
    (x0 + 2 * x1) / 3,
    (y0 + 2 * y1) / 3,
    (x0 + 4 * x1 + x) / 6,
    (y0 + 4 * y1 + y) / 6,
  );
};

const drawBasis = (
  sink: PathSink,
  x: number[],
  y: number[],
  section: CurveSection,
) => {
  "worklet";
  const n = x.length;
  let x0 = NaN;
  let x1 = NaN;
  let y0 = NaN;
  let y1 = NaN;
  for (let i = 0; i < n; i++) {
    const cx = x[i]!;
    const cy = y[i]!;
    if (i === 0) {
      begin(sink, section, cx, cy);
    } else if (i >= 2) {
      if (i === 2) {
        sink.lineTo((5 * x0 + x1) / 6, (5 * y0 + y1) / 6);
      }
      basisSegment(sink, x0, y0, x1, y1, cx, cy);
    }
    x0 = x1;
    x1 = cx;
    y0 = y1;
    y1 = cy;
  }
  if (n >= 3) {
    basisSegment(sink, x0, y0, x1, y1, x1, y1);
  }
  if (n >= 2) {
    sink.lineTo(x1, y1);
  }
  end(sink, section, n);
};

const cardinalSegment = (
  sink: PathSink,
  k: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
  y: number,
) => {
  "worklet";
  sink.cubicTo(
    x1 + k * (x2 - x0),
    y1 + k * (y2 - y0),
    x2 + k * (x1 - x),
    y2 + k * (y1 - y),
    x2,
    y2,
  );
};

const drawCardinal = (
  sink: PathSink,
  x: number[],
  y: number[],
  section: CurveSection,
  tension: number,
) => {
  "worklet";
  const k = (1 - tension) / 6;
  const n = x.length;
  let x0 = NaN;
  let x1 = NaN;
  let x2 = NaN;
  let y0 = NaN;
  let y1 = NaN;
  let y2 = NaN;
  for (let i = 0; i < n; i++) {
    const cx = x[i]!;
    const cy = y[i]!;
    if (i === 0) {
      begin(sink, section, cx, cy);
    } else if (i === 1) {
      x1 = cx;
      y1 = cy;
    } else {
      cardinalSegment(sink, k, x0, y0, x1, y1, x2, y2, cx, cy);
    }
    x0 = x1;
    x1 = x2;
    x2 = cx;
    y0 = y1;
    y1 = y2;
    y2 = cy;
  }
  if (n === 2) {
    sink.lineTo(x2, y2);
  } else if (n >= 3) {
    cardinalSegment(sink, k, x0, y0, x1, y1, x2, y2, x1, y1);
  }
  end(sink, section, n);
};

const drawCatmullRom = (
  sink: PathSink,
  x: number[],
  y: number[],
  section: CurveSection,
  alpha: number,
) => {
  "worklet";
  const n = x.length;
  let x0 = NaN;
  let x1 = NaN;
  let x2 = NaN;
  let y0 = NaN;
  let y1 = NaN;
  let y2 = NaN;
  // Distances between consecutive points, raised to alpha and to 2 * alpha.
  let l01a = 0;
  let l12a = 0;
  let l23a = 0;
  let l012a = 0;
  let l122a = 0;
  let l232a = 0;
  // The number of points seen so far, up to 3.
  let count = 0;

  const point = (cx: number, cy: number) => {
    if (count) {
      const x23 = x2 - cx;
      const y23 = y2 - cy;
      l23a = Math.sqrt((l232a = Math.pow(x23 * x23 + y23 * y23, alpha)));
    }

    if (count === 0) {
      count = 1;
      begin(sink, section, cx, cy);
    } else if (count === 1) {
      count = 2;
    } else {
      count = 3;
      let cx1 = x1;
      let cy1 = y1;
      let cx2 = x2;
      let cy2 = y2;

      if (l01a > EPSILON) {
        const a = 2 * l012a + 3 * l01a * l12a + l122a;
        const m = 3 * l01a * (l01a + l12a);
        cx1 = (cx1 * a - x0 * l122a + x2 * l012a) / m;
        cy1 = (cy1 * a - y0 * l122a + y2 * l012a) / m;
      }

      if (l23a > EPSILON) {
        const b = 2 * l232a + 3 * l23a * l12a + l122a;
        const m = 3 * l23a * (l23a + l12a);
        cx2 = (cx2 * b + x1 * l232a - cx * l122a) / m;
        cy2 = (cy2 * b + y1 * l232a - cy * l122a) / m;
      }

      sink.cubicTo(cx1, cy1, cx2, cy2, x2, y2);
    }

    l01a = l12a;
    l12a = l23a;
    l012a = l122a;
    l122a = l232a;
    x0 = x1;
    x1 = x2;
    x2 = cx;
    y0 = y1;
    y1 = y2;
    y2 = cy;
  };

  for (let i = 0; i < n; i++) {
    point(x[i]!, y[i]!);
  }
  if (count === 2) {
    sink.lineTo(x2, y2);
  } else if (count === 3) {
    point(x2, y2);
  }
  end(sink, section, n);
};

const sign = (value: number) => {
  "worklet";
  return value < 0 ? -1 : 1;
};

/**
 * The slope of the tangent at the middle one of three points, based on:
 * Steffen, M. 1990. A Simple Method for Monotonic Interpolation in One
 * Dimension. Astronomy and Astrophysics, Vol. 239, NO. NOV(II), P. 443, 1990.
 */
const monotoneSlope3 = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  "worklet";
  const h0 = x1 - x0;
  const h1 = x2 - x1;
  const s0 = (y1 - y0) / (h0 || (h1 < 0 ? -0 : 0));
  const s1 = (y2 - y1) / (h1 || (h0 < 0 ? -0 : 0));
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (
    (sign(s0) + sign(s1)) *
      Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  );
};

/**
 * The slope of the tangent at an end point, given the one at its neighbor.
 */
const monotoneSlope2 = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
) => {
  "worklet";
  const h = x1 - x0;
  return h ? ((3 * (y1 - y0)) / h - t) / 2 : t;
};

const monotoneSegment = (
  sink: PathSink,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t0: number,
  t1: number,
) => {
  "worklet";
  const dx = (x1 - x0) / 3;
  sink.cubicTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
};

const drawMonotoneX = (
  sink: PathSink,
  x: number[],
  y: number[],
  section: CurveSection,
) => {
  "worklet";
  const n = x.length;
  let x0 = NaN;
  let x1 = NaN;
  let y0 = NaN;
  let y1 = NaN;
  let t0 = NaN;
  // The number of distinct points seen so far, up to 3.
  let count = 0;
  for (let i = 0; i < n; i++) {
    const cx = x[i]!;
    const cy = y[i]!;
    let t1 = NaN;

    // Ignore coincident points.
    if (cx === x1 && cy === y1) continue;

    if (count === 0) {
      count = 1;
      begin(sink, section, cx, cy);
    } else if (count === 1) {
      count = 2;
    } else if (count === 2) {
      count = 3;
      t1 = monotoneSlope3(x0, y0, x1, y1, cx, cy);
      monotoneSegment(
        sink,
        x0,
        y0,
        x1,
        y1,
        monotoneSlope2(x0, y0, x1, y1, t1),
        t1,
      );
    } else {
      t1 = monotoneSlope3(x0, y0, x1, y1, cx, cy);
      monotoneSegment(sink, x0, y0, x1, y1, t0, t1);
    }

    x0 = x1;
    x1 = cx;
    y0 = y1;
    y1 = cy;
    t0 = t1;
  }
  if (count === 2) {
    sink.lineTo(x1, y1);
  } else if (count === 3) {
    monotoneSegment(
      sink,
      x0,
      y0,
      x1,
      y1,
      t0,
      monotoneSlope2(x0, y0, x1, y1, t0),
    );
  }
  end(sink, section, count);
};

/**
 * The control points of a natural cubic spline through the given values, for
 * one dimension. See https://www.particleincell.com/2012/bezier-splines/ for
 * the derivation.
 */
const naturalControlPoints = (x: number[]): [number[], number[]] => {
  "worklet";
  const n = x.length - 1;
  const a: number[] = new Array(n);
  const b: number[] = new Array(n);
  const r: number[] = new Array(n);
  let i: number;
  let m: number;
  a[0] = 0;
  b[0] = 2;
  r[0] = x[0]! + 2 * x[1]!;
  for (i = 1; i < n - 1; ++i) {
    a[i] = 1;
    b[i] = 4;
    r[i] = 4 * x[i]! + 2 * x[i + 1]!;
  }
  a[n - 1] = 2;
  b[n - 1] = 7;
  r[n - 1] = 8 * x[n - 1]! + x[n]!;
  for (i = 1; i < n; ++i) {
    m = a[i]! / b[i - 1]!;
    b[i]! -= m;
    r[i]! -= m * r[i - 1]!;
  }
  a[n - 1] = r[n - 1]! / b[n - 1]!;
  for (i = n - 2; i >= 0; --i) {
    a[i] = (r[i]! - a[i + 1]!) / b[i]!;
  }
  b[n - 1] = (x[n]! + a[n - 1]!) / 2;
  for (i = 0; i < n - 1; ++i) {
    b[i] = 2 * x[i + 1]! - a[i + 1]!;
  }
  return [a, b];
};

const drawNatural = (
  sink: PathSink,
  x: number[],
  y: number[],
  section: CurveSection,
) => {
  "worklet";
  const n = x.length;
  begin(sink, section, x[0]!, y[0]!);
  if (n === 2) {
    sink.lineTo(x[1]!, y[1]!);
  } else if (n > 2) {
    const [px1, px2] = naturalControlPoints(x);
    const [py1, py2] = naturalControlPoints(y);
    for (let i0 = 0, i1 = 1; i1 < n; ++i0, ++i1) {
      sink.cubicTo(px1[i0]!, py1[i0]!, px2[i0]!, py2[i0]!, x[i1]!, y[i1]!);
    }
  }
  end(sink, section, n);
};

/**
 * Draws a run of points, given as their x and y coordinates, into `sink`
 * with the given curve.
 */
export const drawCurve = (
  sink: PathSink,
  curveType: CurveType,
  x: number[],
  y: number[],
  section: CurveSection,
) => {
  "worklet";
  if (x.length === 0) return;

  switch (curveType) {
    case "natural":
      drawNatural(sink, x, y, section);
      break;
    case "bumpX":
      drawBump(sink, x, y, section, true);
      break;
    case "bumpY":
      drawBump(sink, x, y, section, false);
      break;
    // A Catmull-Rom spline with an alpha of 0 is a cardinal spline with a
    // tension of 0.
    case "cardinal":
    case "catmullRom0":
      drawCardinal(sink, x, y, section, 0);
      break;
    case "cardinal50":
      drawCardinal(sink, x, y, section, 0.5);
      break;
    case "catmullRom":
      drawCatmullRom(sink, x, y, section, 0.5);
      break;
    case "catmullRom100":
      drawCatmullRom(sink, x, y, section, 1);
      break;
    case "monotoneX":
      drawMonotoneX(sink, x, y, section);
      break;
    case "step":
      drawStep(sink, x, y, section, 0.5);
      break;
    case "stepBefore":
      drawStep(sink, x, y, section, 0);
      break;
    case "stepAfter":
      drawStep(sink, x, y, section, 1);
      break;
    case "basis":
      drawBasis(sink, x, y, section);
      break;
    case "linear":
    default:
      drawLinear(sink, x, y, section);
      break;
  }
};
