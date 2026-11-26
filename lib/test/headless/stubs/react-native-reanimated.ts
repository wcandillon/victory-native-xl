import { useEffect, useState, type ReactNode } from "react";

// Like Reanimated, the same shared value for the lifetime of the component.
export function useSharedValue<T>(init: T): { value: T } {
  const [sharedValue] = useState(() => ({ value: init }));
  return sharedValue;
}

export function useDerivedValue<T>(fn: () => T): { value: T } {
  return { value: fn() };
}

export function makeMutable<T>(init: T): { value: T } {
  return { value: init };
}

export function isSharedValue(value: unknown): value is { value: unknown } {
  return typeof value === "object" && value !== null && "value" in value;
}

export function withTiming<T>(value: T): T {
  return value;
}

export function withSpring<T>(value: T): T {
  return value;
}

export function withDecay(): number {
  return 0;
}

// Like Reanimated, the reaction runs once when it is set up, without a
// previous value. Changes to shared values are not tracked here.
export function useAnimatedReaction<T>(
  prepare: () => T,
  react: (current: T, previous: T | null) => void,
): void {
  useEffect(() => {
    react(prepare(), null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function runOnJS<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}

export function useAnimatedStyle<T>(fn: () => T): T {
  return fn();
}

export const Animated = {
  View: ({ children }: { children?: ReactNode }) => children,
};

export default Animated;

export type SharedValue<T> = { value: T };
