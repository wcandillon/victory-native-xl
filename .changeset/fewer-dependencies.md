---
"victory-native": patch
---

Remove the `d3-zoom` and `react-fast-compare` dependencies. Only one class of `d3-zoom` was used, to rescale the axes of a panned or zoomed chart, yet it brought in `d3-selection`, `d3-transition`, `d3-drag` and the rest of d3's DOM stack, none of which can run in React Native: a few lines now do the same rescaling. The three comparisons done with `react-fast-compare` use a small helper. `d3-scale` is now the only runtime dependency of the library.
