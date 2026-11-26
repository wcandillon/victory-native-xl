import { describe, expect, it } from "vitest";
import { isDeepEqual } from "./isDeepEqual";

describe("isDeepEqual", () => {
  it("compares primitives by value", () => {
    expect(isDeepEqual(1, 1)).toBe(true);
    expect(isDeepEqual("a", "a")).toBe(true);
    expect(isDeepEqual(NaN, NaN)).toBe(true);
    expect(isDeepEqual(0, -0)).toBe(true);
    expect(isDeepEqual(1, 2)).toBe(false);
    expect(isDeepEqual(1, "1")).toBe(false);
    expect(isDeepEqual(null, undefined)).toBe(false);
    expect(isDeepEqual(undefined, undefined)).toBe(true);
  });

  it("compares arrays by content", () => {
    expect(isDeepEqual([0, 10], [0, 10])).toBe(true);
    expect(isDeepEqual([0, NaN], [0, NaN])).toBe(true);
    expect(isDeepEqual([0, 10], [0, 11])).toBe(false);
    expect(isDeepEqual([0, 10], [0, 10, 20])).toBe(false);
    expect(isDeepEqual([0, 10], undefined)).toBe(false);
    expect(isDeepEqual([{ rotate: 1 }], [{ rotate: 1 }])).toBe(true);
    expect(isDeepEqual([{ rotate: 1 }], [{ rotate: 2 }])).toBe(false);
  });

  it("compares typed arrays by content", () => {
    expect(
      isDeepEqual(
        new Float32Array([1, 0, 0, 1]),
        new Float32Array([1, 0, 0, 1]),
      ),
    ).toBe(true);
    expect(
      isDeepEqual(
        new Float32Array([1, 0, 0, 1]),
        new Float32Array([0, 0, 0, 1]),
      ),
    ).toBe(false);
    expect(isDeepEqual(new Float32Array([1, 2]), [1, 2])).toBe(false);
  });

  it("compares plain objects by content", () => {
    const bounds = { left: 0, right: 100, top: 0, bottom: 50 };

    expect(isDeepEqual(bounds, { ...bounds })).toBe(true);
    expect(isDeepEqual(bounds, { ...bounds, bottom: 51 })).toBe(false);
    expect(isDeepEqual(bounds, { ...bounds, extra: 1 })).toBe(false);
    expect(isDeepEqual({ a: undefined }, { b: undefined })).toBe(false);
    expect(isDeepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true);
    expect(isDeepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 3] } })).toBe(false);
    expect(isDeepEqual({}, [])).toBe(false);
  });

  it("compares everything else by identity", () => {
    class SharedValue {
      constructor(public value: number) {}
    }
    const sharedValue = new SharedValue(1);
    const callback = () => {};

    expect(isDeepEqual(sharedValue, sharedValue)).toBe(true);
    expect(isDeepEqual(sharedValue, new SharedValue(1))).toBe(false);
    expect(isDeepEqual(callback, callback)).toBe(true);
    expect(isDeepEqual(callback, () => {})).toBe(false);
    expect(isDeepEqual({ color: sharedValue }, { color: sharedValue })).toBe(
      true,
    );
    expect(
      isDeepEqual({ color: sharedValue }, { color: new SharedValue(1) }),
    ).toBe(false);
  });
});
