import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";

type RescalableScale =
  | ScaleLinear<number, number>
  | ScaleLogarithmic<number, number>;

/**
 * The scale and translation that pan and zoom apply to the chart, and how
 * they change what a scale shows.
 */
export type ZoomTransform = {
  /** The scale factor. */
  readonly k: number;
  /** The translation along the x axis. */
  readonly x: number;
  /** The translation along the y axis. */
  readonly y: number;
  /**
   * Returns a copy of `scale`, a scale for the x axis, whose domain is the
   * part of the domain of `scale` that is visible once the chart is
   * transformed.
   */
  rescaleX: <Scale extends RescalableScale>(scale: Scale) => Scale;
  /** The same as `rescaleX`, for a scale for the y axis. */
  rescaleY: <Scale extends RescalableScale>(scale: Scale) => Scale;
};

/**
 * The domain values that end up at both ends of the range of `scale` once
 * the chart is scaled by `k` and translated by `translate` along its axis.
 */
const rescale = <Scale extends RescalableScale>(
  scale: Scale,
  k: number,
  translate: number,
) =>
  // A copy of a scale is a scale of the same kind.
  scale
    .copy()
    .domain(
      scale.range().map((position) => scale.invert((position - translate) / k)),
    ) as Scale;

const getSafeZoomScale = (scale: number) =>
  scale === 0 || !Number.isFinite(scale) ? 1 : scale;

export const createSafeZoomTransform = (
  scale: number,
  translateX: number,
  translateY: number,
): ZoomTransform => {
  const k = getSafeZoomScale(scale);

  return {
    k,
    x: translateX,
    y: translateY,
    rescaleX: (xScale) => rescale(xScale, k, translateX),
    rescaleY: (yScale) => rescale(yScale, k, translateY),
  };
};
