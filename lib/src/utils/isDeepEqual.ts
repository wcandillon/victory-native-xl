const isList = (value: object): value is ArrayLike<unknown> =>
  Array.isArray(value) || (ArrayBuffer.isView(value) && "length" in value);

const isPlainObject = (value: object) => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Whether two values hold the same data.
 *
 * Arrays, typed arrays and plain objects are compared by content. Anything
 * else that is not a primitive (shared values, Skia objects, functions, class
 * instances) is only equal to itself.
 */
export const isDeepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  // NaN is the only value that is not equal to itself.
  if (a !== a && b !== b) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)
  ) {
    return false;
  }

  if (isList(a) && isList(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (!isPlainObject(a)) return false;

  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !isDeepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }
  return true;
};
