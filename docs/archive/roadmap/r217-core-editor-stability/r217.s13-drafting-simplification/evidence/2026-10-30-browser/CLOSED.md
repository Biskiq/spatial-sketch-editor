# R217.S13 — archived Drafting-simplification browser evidence

Byte-identical copies of the fourteen Chromium captures and the downloaded source JSON recorded in
the S13 acceptance record on 2026-10-30. Images and JSON were copied unmodified during closeout; the
live slice path holds the [acceptance record](../../../../../../roadmap/r217-core-editor-stability/r217.s13-drafting-simplification/acceptance.md)
and the [evidence pointer stub](../../../../../../roadmap/r217-core-editor-stability/r217.s13-drafting-simplification/evidence/README.md).

The project is the canonical starter **Enclosed room**, DPR 1, at 1440 × 900, 1280 × 800,
1180 × 820 and 820 × 1180 CSS px. The captures are settled endpoints. Mid-fade continuity and the
exact 25 m hand-off are proved numerically in
`apps/editor/tests/lib/authoring/stage-grid.test.ts`, not by a still frame.

| Capture | State shown | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| [browser-01-plan-fit.png](browser-01-plan-fit.png) | 1440 × 900, Plan after Fit; Grid/Snap cluster, local sheet, ruler, lower-right zoom cluster | 96,057 | `ed2e032871023f9d6e5841b07f12628cc1ecf6542da95b7699bcf1e42e8d3276` |
| [browser-02-plan-zoom-out.png](browser-02-plan-zoom-out.png) | four zoom-out presses from Fit; drawing thins, values unchanged | 54,739 | `8fb193da00423de5af7a2c941112aab12c1bd0c61492ec125bf761d504dccec3` |
| [browser-03-plan-zoom-in.png](browser-03-plan-zoom-in.png) | zoom-in limit; ruler 0.005 m, bounded sheet crops to visible coverage | 49,498 | `6e4fbd5bba20097603510d7b65c9baabb14a8bbbec31469b0e9d75602f5bcbd3` |
| [browser-04-plan-zoom-out-coarse.png](browser-04-plan-zoom-out-coarse.png) | ten more zoom-out presses; bounded sheet frames the work | 49,540 | `6f43ef0e32b531099d390fc3e4a8e9f5dd1c79e0ac153bfdf7b1fc735e5a1c92` |
| [browser-05-plan-far-zoom.png](browser-05-plan-far-zoom.png) | zoom-out limit; ruler 100 m, sheet smaller than one 25 m interval, ruler the only visible reference | 49,118 | `c635ffdc1899a142f19f1d8ac4ecfb05c69929afccbc82c2154a59f6efbb0611` |
| [browser-06-3d-ruler-hidden.png](browser-06-3d-ruler-hidden.png) | settled 3D; ruler absent, zoom cluster and mat grid present, Grid/Snap on | 59,474 | `50a0a91fb66a5653307452a1df5c9b2152addb920fef56687b3ba08098b36b6b` |
| [browser-07-find-scale-detents.png](browser-07-find-scale-detents.png) | Head Find filtered to `Scale`; five `Zoom` detents | 70,664 | `4c2c2214ef4fcc90b58256cca34cde43d38dd0d68a2e92623f659a6e3edf756e` |
| [browser-08-plan-words-off.png](browser-08-plan-words-off.png) | Plan with Grid off and Snap off; both words struck through and dimmed | 48,886 | `55be40c95e744214e4e332544a8a7de2f404cdfb981944cf394a48a30e7846a3` |
| [browser-09-two-zoom-drawing.png](browser-09-two-zoom-drawing.png) | two free Walls drawn at Fit and after two zoom-in presses; this still predates the final shell visual, and the lattice claim is carried by the source JSON | 110,333 | `b24d7fbfd433398ac4ec82d54b04334bffdfe804cf786d73aa1426d7adcd220a` |
| [browser-10-width-1280x800.png](browser-10-width-1280x800.png) | 1280 × 800 Plan at Fit; no control collision | 91,843 | `e8d279e2492000556acb2832cb65f9da5dec53c2ab2e40a16a08d8dea57b5507` |
| [browser-11-width-1180x820.png](browser-11-width-1180x820.png) | 1180 × 820 Plan at Fit; Index collapsed, no control collision | 39,749 | `740068ef4ca94263f275448276b982e851be01d7cc8f70c6a4c0ea4c1ebc0910` |
| [browser-12-width-820x1180.png](browser-12-width-820x1180.png) | 820 × 1180 Plan at Fit; ruler, dock and zoom cluster share the bottom edge without overlap | 41,115 | `d4bb5224fbaec1f0beaa6a71593b155a5e570721b33838bca37bafe6cd660ba5` |
| [browser-13-3d-words-off.png](browser-13-3d-words-off.png) | settled 3D with Grid off and Snap off; both words struck through and dimmed | 59,923 | `740f46defbd4c7d359e359d5236f92d8a947e9d3500ba683232118e4ab0d487a` |
| [browser-14-palette-1440x900.png](browser-14-palette-1440x900.png) | 1440 × 900 with the Ink palette open; lifted zoom cluster clears the Height Sheet by 3.6 px | 69,311 | `87d14763f57711942d7cd4da916112af947ff21d561ceb57978ab799d6061c32` |

Total renderable evidence: **14 PNG files / 890,250 bytes**. The downloaded source from capture 09
is preserved beside them as [two-zoom-source.json](two-zoom-source.json) (6,909 bytes, SHA-256
`f7c271e7fa4834bc6ef7d75634532f3e06b6ecce6244201ec596802159ab9b09`).

Measured boxes at all four widths, including the palette-open case, showed no overlap between the
ruler, zoom cluster, Height Sheet, dock, Ink palette or Index. In 3D the off words computed
`text-decoration-line: line-through` and `opacity: 0.5`; the 2D/3D control kept its own selected
treatment. Experience removed the ruler, zoom cluster and Height Sheet.

Recovery for the closed plan body:
`git show 050a30d9418a9a910a320388ae2ea4d879f1b34c:docs/roadmap/r217-core-editor-stability/r217.s13-drafting-simplification/implementation-plan.md`
· tag `closed/r217.s13`.
