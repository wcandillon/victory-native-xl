import React, {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { runOnJS, useAnimatedReaction } from "react-native-reanimated";
import { getTransformComponents } from "../../utils/transform";
import type { ChartTransformState } from "../hooks/useChartTransformState";

export type CartesianTransformContextValue = {
  k: number;
  kx: number;
  ky: number;
  tx: number;
  ty: number;
};

const CartesianTransformContext = createContext<
  CartesianTransformContextValue | undefined
>(undefined);

type CartesianTransformValueProviderProps = PropsWithChildren<{
  value: CartesianTransformContextValue;
}>;

export const CartesianTransformValueProvider = ({
  value,
  children,
}: CartesianTransformValueProviderProps) => {
  return (
    <CartesianTransformContext.Provider value={value}>
      {children}
    </CartesianTransformContext.Provider>
  );
};

type TransformComponents = ReturnType<typeof getTransformComponents>;

const toContextValue = ({
  scaleX,
  scaleY,
  translateX,
  translateY,
}: TransformComponents): CartesianTransformContextValue => ({
  k: scaleX,
  kx: scaleX,
  ky: scaleY,
  tx: translateX,
  ty: translateY,
});

// What a chart without a transform state, or one that was not panned or
// zoomed yet, is transformed by.
const IDENTITY = toContextValue(getTransformComponents(undefined));

const isSameTransform = (
  a: CartesianTransformContextValue,
  b: CartesianTransformContextValue,
) =>
  a.k === b.k &&
  a.kx === b.kx &&
  a.ky === b.ky &&
  a.tx === b.tx &&
  a.ty === b.ty;

type CartesianTransformSyncProps = {
  transformState: ChartTransformState;
  onChange: (transform: CartesianTransformContextValue) => void;
};

/**
 * Reports the scale and translation of `transformState` to the JS thread as
 * they change. It renders nothing: it is a component so that a chart without
 * a transform state does not set up an animated reaction at all.
 */
const CartesianTransformSync = ({
  transformState,
  onChange,
}: CartesianTransformSyncProps) => {
  // This is done in a useEffect to prevent Reanimated warning
  // about setting shared value in the render phase
  useEffect(() => {
    onChange(
      toContextValue(getTransformComponents(transformState.matrix.value)),
    );
    // Without a transform state, the chart is not transformed anymore.
    return () => onChange(IDENTITY);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useAnimatedReaction(
    () => {
      return getTransformComponents(transformState.matrix.value);
    },
    (cv, pv) => {
      if (
        cv.scaleX !== pv?.scaleX ||
        cv.scaleY !== pv.scaleY ||
        cv.translateX !== pv.translateX ||
        cv.translateY !== pv.translateY
      ) {
        runOnJS(onChange)({
          k: cv.scaleX,
          kx: cv.scaleX,
          ky: cv.scaleY,
          tx: cv.translateX,
          ty: cv.translateY,
        });
      }
    },
  );

  return null;
};

/**
 * Tracks the scale and translation of the chart's transform state on the JS
 * thread. `transform` is what `CartesianTransformValueProvider` provides to
 * the content of the chart, and `transformSync` is the element that keeps it
 * up to date, to render next to the chart. It is `null` for a chart without a
 * transform state, which then does no work for pan and zoom.
 */
export const useCartesianTransform = (transformState?: ChartTransformState) => {
  const [transform, setTransform] = useState(IDENTITY);

  // An animated reaction always runs once when it is set up. Keeping the
  // current value when nothing changed avoids rendering the chart a second
  // time on mount for that.
  const onChange = useCallback((next: CartesianTransformContextValue) => {
    setTransform((current) =>
      isSameTransform(current, next) ? current : next,
    );
  }, []);

  const transformSync = transformState ? (
    <CartesianTransformSync
      transformState={transformState}
      onChange={onChange}
    />
  ) : null;

  return { transform, transformSync };
};

export const useCartesianTransformContext = () => {
  const context = useContext(CartesianTransformContext);

  if (context === undefined) {
    throw new Error(
      "useCartesianTransformContext must be used within a CartesianTransformProvider",
    );
  }

  return context;
};
