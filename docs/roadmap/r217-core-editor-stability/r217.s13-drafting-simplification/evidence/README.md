# R217.S13 browser evidence — Drafting simplification

Fourteen Chromium captures against the Vite dev server on 2026-10-30, at the four
required widths: **1440 × 900** (captures 01–09, 13 and 14), **1280 × 800** (10),
**1180 × 820** (11) and **820 × 1180** (12). DPR 1. The project is the canonical
starter **Enclosed room**; no cloud Save was made.

| Capture | State shown | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| [browser-01-plan-fit.png](2026-10-30-browser/browser-01-plan-fit.png) | 1440 × 900, Plan after Fit; Grid/Snap cluster, local sheet, ruler, lower-right zoom cluster | 96,057 | `ed2e032871023f9d6e5841b07f12628cc1ecf6542da95b7699bcf1e42e8d3276` |
| [browser-02-plan-zoom-out.png](2026-10-30-browser/browser-02-plan-zoom-out.png) | four zoom-out presses from Fit; drawing thins, values unchanged | 54,739 | `8fb193da00423de5af7a2c941112aab12c1bd0c61492ec125bf761d504dccec3` |
| [browser-03-plan-zoom-in.png](2026-10-30-browser/browser-03-plan-zoom-in.png) | zoom-in limit; ruler 0.005 m, bounded sheet crops to visible coverage | 49,498 | `6e4fbd5bba20097603510d7b65c9baabb14a8bbbec31469b0e9d75602f5bcbd3` |
| [browser-04-plan-zoom-out-coarse.png](2026-10-30-browser/browser-04-plan-zoom-out-coarse.png) | ten more zoom-out presses; bounded sheet frames the work | 49,540 | `6f43ef0e32b531099d390fc3e4a8e9f5dd1c79e0ac153bfdf7b1fc735e5a1c92` |
| [browser-05-plan-far-zoom.png](2026-10-30-browser/browser-05-plan-far-zoom.png) | zoom-out limit; ruler 100 m, the sheet is smaller than one 25 m interval, ruler is the only visible reference | 49,118 | `c635ffdc1899a142f19f1d8ac4ecfb05c69929afccbc82c2154a59f6efbb0611` |
| [browser-06-3d-ruler-hidden.png](2026-10-30-browser/browser-06-3d-ruler-hidden.png) | settled 3D; ruler absent, zoom cluster and mat grid present, Grid/Snap on | 59,474 | `50a0a91fb66a5653307452a1df5c9b2152addb920fef56687b3ba08098b36b6b` |
| [browser-07-find-scale-detents.png](2026-10-30-browser/browser-07-find-scale-detents.png) | Head Find filtered to `Scale`; the five detents are `Zoom` entries | 70,664 | `4c2c2214ef4fcc90b58256cca34cde43d38dd0d68a2e92623f659a6e3edf756e` |
| [browser-08-plan-words-off.png](2026-10-30-browser/browser-08-plan-words-off.png) | Plan with Grid off and Snap off; both words struck through and dimmed | 48,886 | `55be40c95e744214e4e332544a8a7de2f404cdfb981944cf394a48a30e7846a3` |
| [browser-09-two-zoom-drawing.png](2026-10-30-browser/browser-09-two-zoom-drawing.png) | two free Walls drawn at Fit and after two zoom-in presses, with Snap on; this still predates the final shell visual, and the lattice claim is carried by the source JSON | 110,333 | `b24d7fbfd433398ac4ec82d54b04334bffdfe804cf786d73aa1426d7adcd220a` |
| [browser-10-width-1280x800.png](2026-10-30-browser/browser-10-width-1280x800.png) | 1280 × 800 Plan at Fit; no control collision | 91,843 | `e8d279e2492000556acb2832cb65f9da5dec53c2ab2e40a16a08d8dea57b5507` |
| [browser-11-width-1180x820.png](2026-10-30-browser/browser-11-width-1180x820.png) | 1180 × 820 Plan at Fit; Index collapsed, no control collision | 39,749 | `740068ef4ca94263f275448276b982e851be01d7cc8f70c6a4c0ea4c1ebc0910` |
| [browser-12-width-820x1180.png](2026-10-30-browser/browser-12-width-820x1180.png) | 820 × 1180 Plan at Fit; ruler, dock and zoom cluster share the bottom edge without overlap | 41,115 | `d4bb5224fbaec1f0beaa6a71593b155a5e570721b33838bca37bafe6cd660ba5` |
| [browser-13-3d-words-off.png](2026-10-30-browser/browser-13-3d-words-off.png) | settled 3D with Grid off and Snap off; both words struck through and dimmed | 59,923 | `740f46defbd4c7d359e359d5236f92d8a947e9d3500ba683232118e4ab0d487a` |
| [browser-14-palette-1440x900.png](2026-10-30-browser/browser-14-palette-1440x900.png) | 1440 × 900 with the Ink palette open; lifted zoom cluster clears the Height Sheet by 3.6 px | 69,311 | `87d14763f57711942d7cd4da916112af947ff21d561ceb57978ab799d6061c32` |

Total renderable evidence: **14 PNG files / 890,250 bytes**. The downloaded source from capture 09 is
preserved beside them as [two-zoom-source.json](2026-10-30-browser/two-zoom-source.json) (6,909 bytes, SHA-256
`f7c271e7fa4834bc6ef7d75634532f3e06b6ecce6244201ec596802159ab9b09`).

## What the journey established

- **Bounded local sheet (D39).** Captures 01, 02, 04 and 05 show the grid as a crisp-edged sheet
  around the room rather than a full-viewport lattice. The sheet does not move the Camera: the
  target and framing stay put across every press.
- **Fixed values and thinning (D30, O7).** Captures 01–05 change only the projected spacing.
  No interval value or control changed; Grid still reads `Grid`, Snap `Snap`. At the zoom-out
  limit the sheet is smaller than one 25 m interval, so the ruler is the only visible reference;
  the exact 25 m hand-off at its fade threshold is proven numerically in `stage-grid.test.ts`.
- **Full zoom range.** Capture 03 is the zoom-in limit (ruler 0.005 m, 81 px); capture 05 is the
  zoom-out limit (ruler 100 m, 81 px). No interval flicker or value change appeared between them.
- **Ruler (D41).** Captures 01–05 and 08 show a 1 px rule with two 5 px end ticks, the distance
  centred below it, and no fill, border or badge. Capture 06 shows it absent in settled 3D, and
  the Experience check showed it absent there too.
- **Zoom and Fit cluster (D40).** The `+`, `−` and `Fit` cluster is present in Plan and 3D in the
  World lens, and absent in Experience. Measured boxes at 1440 × 900, 1280 × 800, 1180 × 820 and
  820 × 1180 show no overlap with the ruler, Height Sheet, dock, Ink palette or Index. The palette
  lifts the cluster; at 1440 × 900 its right edge is 3.6 px left of the Sheet (capture 14). Every
  press requested a Camera intent; no new intent kind exists.
- **Off words (D42).** In 3D, Grid and Snap were each turned off and reported `Grid off` /
  `Snap off`; `getComputedStyle` returned `text-decoration-line: line-through` and `opacity: 0.5`
  for both, while the 2D/3D segmented control kept its own selected treatment. Capture 13 is that
  state; capture 08 is the same check in Plan. Both returned to `Grid` / `Snap` on the next press.
- **Quiet Paper is not claimed.** At this Plan appearance the cluster is the dark chassis ink;
  the captures and this record make no quiet-Paper visual claim.
- **Scale detents (O8).** Capture 07 shows all five detents in Find. The Scale word, interval
  menu and ⚙ are absent from the drafting cluster; the Head's Viewing group has no Grid interval
  or Snap checkbox.
- **Experience lens.** Switching to Experience removed the ruler, zoom cluster and Height Sheet;
  returning to World restored them. The drafting cluster itself is unchanged in this slice.
- **Wireframe comparison.** Compared with
  [prototype-2d-1440.png](../../post-s10-convergence/evidence/prototype-2d-1440.png): the
  cluster (2D | 3D · Grid · Snap), lower-left ruler and lower-right zoom/Fit furniture match the
  wireframe's structure. The remaining differences are PLATE calibration (this Plan appearance
  uses the dark chassis ink; zoom is a horizontal cluster rather than a vertical strip), not a
  drafting-value or layering difference.
- **Two-zoom lattice.** A Wall drawn after Fit and a second drawn after two 1.25× zoom-in
  presses were downloaded from **Download source JSON** into
  [two-zoom-source.json](2026-10-30-browser/two-zoom-source.json). The new Junction points in
  `units.layout.data.junctions` are `-1.5,1.5`, `-1,1.5`, `-3,-2.5` and `-2,-2.5`; every
  coordinate is an exact multiple of 0.5 m, so the two free drawings share one lattice.
- **D43 did not reproduce.** The 2D/3D control responded on the first press in this session, and
  on every later press; no dead first click was observed.

## Limits

These are settled endpoints. A mid-fade still cannot prove the 16 → 8 px opacity rule or the
absence of interval flicker; those are proven numerically in
`apps/editor/tests/lib/authoring/stage-grid.test.ts`. Native touch and Safari remain S11's. The
starter's Room-floor fill covers the Paper grid inside the room; the bounded sheet and its crisp
edges remain visible around the work and were not treated as a new defect in this slice.
