# Audit evidence manifest

Captured 2026-10-30 against current editor base `9139f3c2` and checked-in Round2 production-shell wireframe. Browser: task-owned Chromium via agent-browser, ordinary fine-pointer automation. Production fixture: fresh Enclosed room guest, later primitive placement. Wireframe fixture: its own Boathouse/example state. Shell comparisons are role/density/color comparisons, not same-scene geometric pixel diffs. User-owned Vite5173, prototype8850 and API8787 servers were reused.

| Group | Files | What was observed |
| --- | --- | --- |
| Desktop World 1440×900 | [current3D](./current-3d-1440.png), [prototype3D](./prototype-3d-1440.png), [current2D](./current-2d-1440.png), [prototype2D](./prototype-2d-1440.png) | Head/Index/working edge, colors/density, Paper/mat |
| Wall selection | [current2D](./current-wall-2d.png), [prototype3D](./prototype-wall-3d.png), [current overhead3D](./current-selected-wall-overhead-3d.png) | Actual selection, Card, Sheet, marks; overhead capture1280×577 |
| Drafting 1440×900 | [hover](./current-ink-hover-2d.png), [pressed drag](./current-ink-drag-2d.png) | Missing live geometry, misplaced marker, palette composition |
| Objects 1440×900 | [place](./current-place-2d.png), [selected2D](./current-object-2d.png), [drag2D](./current-object-drag-2d.png), [3D capture](./current-object-3d.png) | Missing Paper ghost/fill, marks/Card;3D capture is not a temporal settle proof |
| Responsive World | [1280×800](./current-small-laptop-1280.png), [1180×820](./current-landscape-1180.png), [820×1180](./current-portrait-820.png), [prototype820×1180](./prototype-portrait-820.png) | Index/Sheet/Card/dock composition and stage availability |
| Experience | [current1180×820](./current-experience-1180.png), [current820×1180](./current-experience-820.png), [prototype1280×800](./prototype-experience-1280.png) | Separate dashboard versus shared shell; not an equal-viewport pixel comparison |
| Rendering diagnostics 1280×577 | [medium](./grid-medium-3d.png), [shallow](./grid-shallow-3d.png), [overhead](./grid-overhead-3d.png), [Plan endpoint](./camera-plan-flip.png) | Grid clipping and Camera endpoint; see [analysis](./rendering-investigation.md) |
| Candidate fix probe | [diff](./candidate-camera-grid-probe.diff), [sweep source](./candidate-grid-sweep-probe.ts.txt), [low orbit capture](./candidate-grid-low-orbit.jpg) | Disposable-checkout test of the Camera and grid fixes; see [results](./rendering-investigation.md#candidate-fix-probe) |

Not covered by this audit: native iPad/Safari/touch capture, full authenticated save/reload journey, exhaustive Opening/form browser selection, multi-azimuth live-browser transition matrix, dense imported-model scenario and final visual acceptance. Do not treat screenshots or numerical probes as completed integrated acceptance. No formal performance benchmark was run.
