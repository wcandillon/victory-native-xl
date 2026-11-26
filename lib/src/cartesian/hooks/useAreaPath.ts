import * as React from "react";
import type { PointsArray } from "../../types";
import { buildAreaPath, type AreaPathOptions } from "../utils/chartPaths";

export type { AreaPathOptions };

export const useAreaPath = (
  points: PointsArray,
  y0: number,
  { curveType = "linear", connectMissingData = false }: AreaPathOptions = {},
) => {
  const path = React.useMemo(
    () => buildAreaPath(points, y0, { curveType, connectMissingData }),
    [connectMissingData, points, y0, curveType],
  );

  return { path };
};
