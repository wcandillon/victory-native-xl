import React from "react";
import {
  CartesianChart,
  Pie,
  PolarChart,
  useChartPressState,
  useChartTransformState,
} from "victory-native";

const CARTESIAN_DATA = [
  { x: 1, y: 40 },
  { x: 2, y: 80 },
];

const POLAR_DATA = [
  { label: "a", value: 30, color: "#E45756" },
  { label: "b", value: 70, color: "#4C78A8" },
];

const SIZE = { width: 200, height: 120 };

export type ChartFeatures = {
  transform?: boolean;
  press?: boolean;
  customGestures?: React.ComponentProps<
    typeof CartesianChart<(typeof CARTESIAN_DATA)[number], "x", "y">
  >["customGestures"];
};

type CartesianFixtureProps = ChartFeatures & {
  /** Called every time the chart renders its content. */
  onRenderContent?: () => void;
};

type CartesianProps = React.ComponentProps<
  typeof CartesianChart<(typeof CARTESIAN_DATA)[number], "x", "y">
>;

const Cartesian = ({
  onRenderContent,
  ...props
}: Pick<
  CartesianProps,
  "transformState" | "chartPressState" | "customGestures"
> &
  Pick<CartesianFixtureProps, "onRenderContent">) => (
  <CartesianChart
    data={CARTESIAN_DATA}
    xKey="x"
    yKeys={["y"]}
    explicitSize={SIZE}
    {...props}
  >
    {() => {
      onRenderContent?.();
      return null;
    }}
  </CartesianChart>
);

const CartesianWithTransform = (props: CartesianFixtureProps) => {
  const { state } = useChartTransformState();
  return <Cartesian {...props} transformState={state} />;
};

const CartesianWithPress = (props: CartesianFixtureProps) => {
  const { state } = useChartPressState({ x: 0, y: { y: 0 } });
  return <Cartesian {...props} chartPressState={state} />;
};

/**
 * A chart with its own canvas, as in an app, and only the features asked
 * for: the hooks of a feature are not even called when it is not used.
 */
export const CartesianFixture = ({
  transform,
  press,
  ...props
}: CartesianFixtureProps) => {
  if (transform) return <CartesianWithTransform {...props} />;
  if (press) return <CartesianWithPress {...props} />;
  return <Cartesian {...props} />;
};

const Polar = ({
  transformState,
}: Pick<React.ComponentProps<typeof PolarChart>, "transformState">) => (
  <PolarChart
    data={POLAR_DATA}
    labelKey="label"
    valueKey="value"
    colorKey="color"
    explicitSize={SIZE}
    transformState={transformState}
  >
    <Pie.Chart />
  </PolarChart>
);

const PolarWithTransform = () => {
  const { state } = useChartTransformState();
  return <Polar transformState={state} />;
};

export const PolarFixture = ({ transform }: ChartFeatures) =>
  transform ? <PolarWithTransform /> : <Polar />;

type TransformState = ReturnType<typeof useChartTransformState>["state"];

/**
 * Reports the transform state it gets on every render.
 */
export const TransformStateProbe = ({
  onState,
}: {
  onState: (state: TransformState) => void;
  // Only there to render the component again.
  tick: number;
}) => {
  onState(useChartTransformState().state);
  return null;
};
