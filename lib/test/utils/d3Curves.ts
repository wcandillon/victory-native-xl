import {
  curveBasis,
  curveBumpX,
  curveBumpY,
  curveCardinal,
  curveCatmullRom,
  curveLinear,
  curveMonotoneX,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
  type CurveFactory,
} from "d3-shape";
import type { CurveType } from "../../src/cartesian/utils/curves";

/**
 * The d3-shape curve each curve type is a port of. d3-shape is only a
 * development dependency: it is the reference the ports are tested against.
 */
export const D3_CURVES: Record<CurveType, CurveFactory> = {
  linear: curveLinear,
  natural: curveNatural,
  bumpX: curveBumpX,
  bumpY: curveBumpY,
  cardinal: curveCardinal,
  cardinal50: curveCardinal.tension(0.5),
  catmullRom: curveCatmullRom,
  catmullRom0: curveCatmullRom.alpha(0),
  catmullRom100: curveCatmullRom.alpha(1),
  monotoneX: curveMonotoneX,
  step: curveStep,
  stepAfter: curveStepAfter,
  stepBefore: curveStepBefore,
  basis: curveBasis,
};

export const CURVE_TYPES = Object.keys(D3_CURVES) as CurveType[];
