import * as React from "react";
import type { PointsArray } from "../../types";
import { buildLinePath, type LinePathOptions } from "../utils/chartPaths";

export type { LinePathOptions };

export const useLinePath = (
  points: PointsArray,
  { curveType = "linear", connectMissingData = false }: LinePathOptions = {},
) => {
  const path = React.useMemo(
    () => buildLinePath(points, { curveType, connectMissingData }),
    [connectMissingData, points, curveType],
  );

  return { path };
};
