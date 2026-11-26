---
"victory-native": patch
---

Animated paths no longer serialize and parse SVG on every frame. When the path being animated to cannot be interpolated directly with the previous one, `useAnimatedPath` (and the `animate` prop built on it) printed both paths as SVG, rounded them and parsed them back on every frame of the animation; this is now done once, when the path changes. An animation also only (re)starts when the path changes: rendering again with the same path, for instance with an inline `animate` config, used to restart it and jump to its end. Paths are no longer copied on every render.
