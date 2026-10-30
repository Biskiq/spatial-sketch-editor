# R217.S13 browser evidence — Drafting simplification

Nine Chromium captures at **1440 × 900 CSS px**, DPR 1, against the Vite dev server on
2026-10-30. The project is the canonical starter **Enclosed room**; no cloud Save was made.

| Capture | State shown | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| [browser-01-plan-fit.png](browser-01-plan-fit.png) | Plan after Fit; quiet Grid/Snap words, local sheet, ruler, lower-right zoom cluster | 94,408 | `ed21faa257efb1569d6503181c3cf4ba300bab3fd7b48ccfc39bf2fd418f6f22` |
| [browser-02-plan-zoom-out.png](browser-02-plan-zoom-out.png) | four zoom-out presses from Fit; drawing thins, values unchanged | 99,442 | `96b19014e4127d1c95d62746293383f985649b70ca63f40e04177fb501ff6c57` |
| [browser-03-plan-zoom-in.png](browser-03-plan-zoom-in.png) | six zoom-in presses from Fit; sheet crops to the visible coverage | 93,066 | `a5c338a829109272828e04f7841f1b313680b6b63bf8eeb08909eb5837173797` |
| [browser-04-plan-zoom-out-coarse.png](browser-04-plan-zoom-out-coarse.png) | ten more zoom-out presses; bounded 20–25 m sheet frames the work | 96,890 | `0e4cdb37d389ef46e56c9b7771e4350ea753d802dcd09666f7b6a443b1a049d2` |
| [browser-05-plan-ruler-only.png](browser-05-plan-ruler-only.png) | eighteen zoom-out presses; 25 m fallback drawn, then the ruler is the only reference | 91,436 | `795ca6806f527b02c0504bcab16d382ba5737ca35c1e6eecb7841ac99e44d2f5` |
| [browser-06-3d-ruler-hidden.png](browser-06-3d-ruler-hidden.png) | settled 3D; ruler absent, zoom cluster and mat grid present | 139,074 | `811be8ae5906ed7e0a40fae2485eceb88018acc7a32ef16f1920a1926a818830` |
| [browser-07-find-scale-detents.png](browser-07-find-scale-detents.png) | Head Find filtered to `Scale`; the five detents are `Zoom` entries | 113,627 | `2e22ae44e0b271c93aa146abfede899e05ee38d545f167bd9ab2d580e1458437` |
| [browser-08-plan-words-off.png](browser-08-plan-words-off.png) | Plan with Grid off and Snap off; words, not colour alone, on quiet Paper | 91,430 | `6da2f3c670ee3a1d09caf067547abdff81f44ce57cccceb1cd8b1d663c965002` |
| [browser-09-two-zoom-drawing.png](browser-09-two-zoom-drawing.png) | two free Walls drawn at Fit and after two zoom-in presses, with Snap on | 110,333 | `b24d7fbfd433398ac4ec82d54b04334bffdfe804cf786d73aa1426d7adcd220a` |

Total renderable evidence: **9 PNG files / 929,706 bytes**. The downloaded source from capture 09 is
preserved beside them as [two-zoom-source.json](two-zoom-source.json) (6,909 bytes, SHA-256
`f7c271e7fa4834bc6ef7d75634532f3e06b6ecce6244201ec596802159ab9b09`).

## What the journey established

- **Bounded local sheet (D39).** Capture 04 shows the grid as a crisp-edged sheet around the
  room instead of a full-viewport lattice; capture 05 shows the same sheet at a far zoom. The
  sheet does not move the Camera: the target and framing stay put across every press.
- **Fixed values and thinning (D30, O7).** Captures 01–05 change only the projected spacing.
  No interval value or control changed; Grid still reads `Grid`, Snap `Snap`. The 25 m level
  appears in capture 05 only after the 5 m level has hidden.
- **Ruler (D41).** Captures 01–05 and 08 show a 1 px rule with two 5 px end ticks and the
  distance below, with no fill, border or badge. Capture 06 shows it absent in 3D.
- **Zoom and Fit cluster (D40).** The `+`, `−` and `Fit` cluster is present in Plan and 3D and
  did not overlap the Height Sheet or the lower column at 1440 × 900. Every press requested a
  Camera intent; no new intent kind exists.
- **Scale detents (O8).** Capture 07 shows all five detents in Find. The Scale word, interval
  menu and ⚙ are absent from the drafting cluster; the Head's Viewing group has no Grid
  interval or Snap checkbox.
- **Two-zoom lattice.** A Wall drawn after Fit and a second drawn after two 1.25× zoom-in
  presses were downloaded from **Download source JSON** into
  [two-zoom-source.json](two-zoom-source.json). The new Junction points in
  `units.layout.data.junctions` are `-1.5,1.5`, `-1,1.5`, `-3,-2.5` and `-2,-2.5`; every
  coordinate is an exact multiple of 0.5 m, so the two free drawings share one lattice.
- **D43 did not reproduce.** The 2D/3D control responded on the first press in this fresh
  session, and on every later press; no dead first click was observed.

## Limits

These are settled endpoints. A mid-fade still cannot prove the 16 → 8 px opacity rule, the
`25 m` hand-off, or the absence of interval flicker; those are proven numerically in
`apps/editor/tests/lib/authoring/stage-grid.test.ts`. Exact ruler/zoom/Sheet collision behaviour
at narrower widths and with the palette open is browser calibration, not claimed here. The
starter's Room-floor fill covers the Paper grid inside the room; the bounded sheet and its
crisp edges remain visible around the work and were not treated as a new defect in this slice.
