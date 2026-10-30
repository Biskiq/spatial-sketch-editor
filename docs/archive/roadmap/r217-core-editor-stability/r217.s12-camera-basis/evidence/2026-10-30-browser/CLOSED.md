# R217.S12 — archived Camera-basis browser evidence

Byte-identical copies of the eight Chromium captures recorded in the S12 acceptance record on
2026-10-30. Images were copied unmodified during closeout; the live slice path holds the compact
[acceptance stub](../../../../../../roadmap/r217-core-editor-stability/r217.s12-camera-basis/acceptance.md)
and the [evidence pointer stub](../../../../../../roadmap/r217-core-editor-stability/r217.s12-camera-basis/evidence/README.md).

The project is the canonical starter **Enclosed room**, 1440×900 CSS px. The captures are settled
endpoints: a Wall on screen-left before the flip remains left in Plan, the selection/Card and armed
Select tool survive the flip, and Plan hover and pan track the pointer. Continuity **through** the
transition is proved numerically by the 601-frame sweep in
`apps/editor/tests/lib/museum/navigation/camera-viewport-evaluation.test.ts`, not by a still frame.

| Capture | State shown | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| [browser-01-3d-az0.png](browser-01-3d-az0.png) | 3D, azimuth 0 | 273,494 | `d4660c7ec94060179a52ad0fa12005df94b366ba26d06d26db3a5a0ae84d7fb1` |
| [browser-02-plan-az0-selected-wall4.png](browser-02-plan-az0-selected-wall4.png) | Plan, azimuth-0 detent; `wall-chain-4` selected on screen-left | 201,390 | `2f6f2e2ccedd4ed67db16d101a211a92fcf529742c17e60592b395ece48ae1c5` |
| [browser-03-3d-az0-selected-wall4.png](browser-03-3d-az0-selected-wall4.png) | back in 3D, same selection and Card | 273,458 | `c10315e656d92629151361bb2e9c7b5d44f29e121d63278dd11dfe669c99d283` |
| [browser-04-3d-az-orbit.png](browser-04-3d-az-orbit.png) | 3D after a real right-button orbit to about 114° | 387,673 | `3ed037091108c28decd0cd48364213c741ca3f0c5c4cfabb9f6b45211015de59` |
| [browser-05-3d-az90-left-wall3.png](browser-05-3d-az90-left-wall3.png) | `wall-chain-3` selected, left of frame | 390,059 | `3b5eace455b87f0360f90482eb949a60fa2509a583cdcb638a6d21669596f2cc` |
| [browser-06-plan-az90-left-wall3.png](browser-06-plan-az90-left-wall3.png) | Plan at the 90° detent; the same wall still left | 200,669 | `f66a6e7a6e47a87db08c30171a13db9cd9836091d43079b38390a06cf194895a` |
| [browser-07-plan-hover-wall3.png](browser-07-plan-hover-wall3.png) | Plan hover mark and `Length 7.000 m` at the pointer | 202,259 | `e63cc0964df01321a55e1d99d35902feba8d0f5443f9a3f76d43134bafb2031d` |
| [browser-08-plan-pan.png](browser-08-plan-pan.png) | after a +100/+50 CSS-px Plan pan; drawing moved with the pointer | 200,126 | `d93d5e3387c5b6b87d20c54eba3afc0c9ace1903654ac9ac00ce21bd1b7e4b4a` |

Total renderable evidence: **8 PNG files / 2,129,128 bytes**.

The flips used the in-canvas 2D/3D control; a physical mouse click on that control was exercised
separately and flipped as expected. The orbit and pan used real pointer input. Plan's quarter-turn
snapping explains the 114° orbit reporting a 90° Plan reading. Undo stayed disabled and Save stayed
on "Nothing to undo yet" throughout, so no source, history or Save change was made.

Recovery for the closed plan body:
`git show 050a30d9418a9a910a320388ae2ea4d879f1b34c:docs/roadmap/r217-core-editor-stability/r217.s12-camera-basis/implementation-plan.md`
· tag `closed/r217.s12`.
