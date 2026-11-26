---
"victory-native": minor
---

Add `buildLinePath` and `buildAreaPath`, the functions that `useLinePath` and `useAreaPath` build their paths with. They are worklets, so a path can now also be built on the UI thread, for instance in `useDerivedValue`, without going through the JS thread.

The line and area generators and the curves that came from `d3-shape` are now part of the library, written as worklets that draw straight into a Skia `PathBuilder`. Every `curveType` draws exactly what it drew before, and `d3-shape` is no longer a dependency.
