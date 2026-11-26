import {
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { StyleSheet } from "react-native";
import * as React from "react";
import type { GestureHandlerConfig } from "../types";
import type { ComposedGesture } from "./gestureTypes";

type GestureHandlerProps = {
  gesture: ComposedGesture | GestureType;
  debug?: boolean;
  config?: GestureHandlerConfig;
};
export const GestureHandler = ({
  gesture,
  debug = false,
  config,
}: GestureHandlerProps) => {
  return (
    <GestureDetector {...config} gesture={gesture}>
      <Animated.View style={debug ? styles.debugOverlay : styles.overlay} />
    </GestureDetector>
  );
};

const overlay = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;

const styles = StyleSheet.create({
  overlay: {
    ...overlay,
    backgroundColor: "transparent",
  },
  debugOverlay: {
    ...overlay,
    backgroundColor: "rgba(100, 200, 255, 0.4)",
  },
});
