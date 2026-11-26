import { scaleLinear, scaleLog } from "d3-scale";
import { describe, expect, it } from "vitest";
import { createSafeZoomTransform } from "./createSafeZoomTransform";

describe("createSafeZoomTransform", () => {
  it("keeps zero scales from producing invalid rescaled domains", () => {
    const scale = scaleLinear([0, 10], [0, 100]);
    const transform = createSafeZoomTransform(0, 0, 0);
    const domain = transform.rescaleX(scale).domain();

    expect(domain).toEqual([0, 10]);
    expect(domain.every(Number.isFinite)).toBe(true);
  });

  it("preserves non-zero scales for zoom rescaling", () => {
    const scale = scaleLinear([0, 10], [0, 100]);
    const transform = createSafeZoomTransform(2, 0, 0);

    expect(transform.rescaleX(scale).domain()).toEqual([0, 5]);
  });

  it("exposes the scale and the translation", () => {
    const transform = createSafeZoomTransform(2.5, -40, 12);

    expect(transform.k).toBe(2.5);
    expect(transform.x).toBe(-40);
    expect(transform.y).toBe(12);
    expect(createSafeZoomTransform(Infinity, 0, 0).k).toBe(1);
    expect(createSafeZoomTransform(NaN, 0, 0).k).toBe(1);
  });

  // The expected domains are those `ZoomTransform` from d3-zoom, which this
  // replaces, returns for the same scales and the same transform.
  it("rescales a linear scale like d3-zoom", () => {
    const scale = scaleLinear().domain([0, 100]).range([20, 380]);
    const transform = createSafeZoomTransform(2.5, -40, 12);

    expect(transform.rescaleX(scale).domain()).toEqual([
      1.1111111111111112, 41.11111111111111,
    ]);
    expect(transform.rescaleY(scale).domain()).toEqual([
      -4.666666666666667, 35.33333333333333,
    ]);
  });

  it("rescales a logarithmic scale like d3-zoom", () => {
    const scale = scaleLog().domain([1, 1000]).range([300, 0]);
    const transform = createSafeZoomTransform(2.5, -40, 12);

    expect(transform.rescaleX(scale).domain()).toEqual([
      43.651583224016576, 691.8309709189361,
    ]);
    expect(transform.rescaleY(scale).domain()).toEqual([
      70.46930689671466, 1116.8632477805606,
    ]);
  });

  it("returns a copy and leaves the scale untouched", () => {
    const scale = scaleLinear().domain([0, 100]).range([20, 380]);
    const identity = createSafeZoomTransform(1, 0, 0);
    const rescaled = identity.rescaleX(scale);

    expect(rescaled).not.toBe(scale);
    expect(rescaled.domain()).toEqual([0, 100]);
    expect(rescaled.range()).toEqual([20, 380]);

    createSafeZoomTransform(4, 30, 0).rescaleX(scale);
    expect(scale.domain()).toEqual([0, 100]);
  });
});
