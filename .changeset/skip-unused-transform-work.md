---
"victory-native": patch
---

Charts that do not use pan and zoom no longer pay for it. `CartesianChart` only sets up the animated reaction that tracks the transform when a `transformState` is passed, which removes a second render of the whole chart on every mount, and charts without any gesture (`chartPressState`, `transformState` or `customGestures`) no longer mount a gesture detector over the canvas. `useChartTransformState` now returns the same `state`, with the same `panActive` and `zoomActive` shared values, on every render instead of creating new ones each time.
