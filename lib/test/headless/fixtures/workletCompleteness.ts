// Worklets for the tests of `reviveOnSeparateRuntime` itself.

const double = (value: number) => {
  "worklet";
  return value * 2;
};

// Not a worklet: the directive is missing.
const triple = (value: number) => value * 3;

export const complete = (value: number) => {
  "worklet";
  return double(value) + 1;
};

export const incomplete = (value: number) => {
  "worklet";
  return triple(value) + 1;
};

export const notAWorklet = triple;
