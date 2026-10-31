# R217.S15 browser evidence

Real-pointer Chromium captures of Wall direct manipulation on the local editor, recorded 2026-10-30
at revision `462b80cc`, DPR 1. The project is the canonical starter **Enclosed room**; one named
session at 1440 × 900, 1280 × 800, 1180 × 820 and 820 × 1180 CSS px. Pointer input used CDP mouse
press/move/release, not synthetic events; the keyboard path used real key events.

| Capture | State shown | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| [browser-01-plan-selected-wall.png](2026-10-30-browser/browser-01-plan-selected-wall.png) | 1440 × 900 Plan, `wall-chain-1` selected; gold body, start/end points, two-way grip, Card Start/End X/Z disclosure | 143,523 | `d94dfc5e1fc36ec1e34ea3e11b15bdecb61594f854ada6f7421f492744f4fffa` |
| [browser-02-plan-body-drag-live.png](2026-10-30-browser/browser-02-plan-body-drag-live.png) | body drag live: the moved Wall and both reshaped neighbours drawn over the accepted plan, `Move 0.50 m` and `Grid` | 150,203 | `5093aecdee5ec8ca5d84de081de9677ecc9c57e15c180e0db82f7c15ac2ab35e` |
| [browser-03-plan-body-committed.png](2026-10-30-browser/browser-03-plan-body-committed.png) | release committed once: both Junctions moved, four Wall ids kept, one Undo, `Unsaved changes` | 142,010 | `2eed1deb078e0a752703cdbe9dc97464b78ef0869004a67e0f04618957e74997` |
| [browser-04-plan-body-undone.png](2026-10-30-browser/browser-04-plan-body-undone.png) | one Undo restored the authored plan; Undo disabled, Redo enabled | 140,601 | `a175aa5df52ecf1e3dcae4a60d09bf5b2512ff990c9474515576e55c4920608e` |
| [browser-05-plan-junction-drag-live.png](2026-10-30-browser/browser-05-plan-junction-drag-live.png) | shared start Junction dragged: `Length 6.50 m · 0° · 2 Walls`, both incident Walls follow | 155,459 | `14ca0b8a32880d0f408204e61d1accb7e656527c856d673e6c05e7ccd50171d2` |
| [browser-06-plan-junction-committed.png](2026-10-30-browser/browser-06-plan-junction-committed.png) | Junction release committed once and Undo restored it | 144,087 | `fc9fb695eb55a6f8a062e5968ea157d357a0a62b483d058a4194afa904b67da2` |
| [browser-07-plan-click-tolerance.png](2026-10-30-browser/browser-07-plan-click-tolerance.png) | press and release on the selected body within click tolerance: no history entry, Undo stays disabled | 140,547 | `0026a6329919101a8bd5ba9bf89de37461da7453b5f59a83c698fe1f51d422ed` |
| [browser-08-plan-length-ray-live.png](2026-10-30-browser/browser-08-plan-length-ray-live.png) | free-end length ray dragged: `Length 8.00 m`, the other end fixed, reshaped neighbour previewed | 125,473 | `fce7a914c6e7b623518d25f9111fccc7ce6747230f6f53537b9bcb71423b7792` |
| [browser-09-plan-length-ray-committed.png](2026-10-30-browser/browser-09-plan-length-ray-committed.png) | length release committed once, Undo enabled | 114,821 | `5630c8a0ed7d38847135dc1257e70ba38a3e1bf05d71c55749c186cb57630805` |
| [browser-10-plan-numeric-entry.png](2026-10-30-browser/browser-10-plan-numeric-entry.png) | digits during the body drag replace the pointer value: `Distance 1.25` | 122,477 | `95453d3418f13832c8dd860a7d31e00ccc1e79840d46ab989e286bd15071b513` |
| [browser-11-plan-numeric-committed.png](2026-10-30-browser/browser-11-plan-numeric-committed.png) | Enter committed the typed distance once, without moving the pointer further | 111,961 | `20450e850125372cbc4f30d392f7fb77f2e5187d6a6c07b1fc6b8f39dab1fb9c` |
| [browser-12-plan-card-junction-fields.png](2026-10-30-browser/browser-12-plan-card-junction-fields.png) | Card Start/End X/Z disclosure edited: End X `7.5` produced Length `7.5` and one Undo | 134,363 | `c733653f0b5501c5afa7366e1309863179cb3700a7a90da6c27048c71869f4d9` |
| [browser-13-3d-body-drag-live.png](2026-10-30-browser/browser-13-3d-body-drag-live.png) | 3D body drag: the candidate is a flat footprint at the datum, `Move 2.50 m` and `Grid`; no extruded ghost | 179,833 | `8a8bd5e44cb7b654252e50fffe0a96eb4fd4c73989c6a7c6a76647a895c38601` |
| [browser-14-3d-body-committed.png](2026-10-30-browser/browser-14-3d-body-committed.png) | 3D release committed once and refreshed the Wall meshes | 166,897 | `b2ad02fc02107bcae1ae1b4de31f7087b9e65ab42bf53ed766f71de3d6ba5529` |
| [browser-15-width-1280x800.png](2026-10-30-browser/browser-15-width-1280x800.png) | 1280 × 800 with a live body drag, `Move 1.00 m`; palette, Card and Stage do not collide | 137,825 | `c13584077740d815517cb69426db27437c72a90beab830bf6f2b2243a065b9b7` |
| [browser-16-width-1180x820.png](2026-10-30-browser/browser-16-width-1180x820.png) | 1180 × 820, Index collapsed, live body drag `Move 0.50 m` | 91,848 | `0e319ad0f5109118f760b8e3a9c739fab629dae7d612825865cac4424cf74fd0` |
| [browser-17-width-820x1180.png](2026-10-30-browser/browser-17-width-820x1180.png) | 820 × 1180 portrait, live body drag `Move 0.50 m`; the floating Card covers the tag's right edge | 102,653 | `9b9210e73c162de4ebe33e692304c54ca5001e64b61221b37622e8e144656482` |
| [browser-18-3d-junction-drag-live.png](2026-10-30-browser/browser-18-3d-junction-drag-live.png) | 3D shared Junction drag: `Length 6.00 m · 0° · 2 Walls`, datum footprint and both incident Walls | 169,084 | `e62eed71a2ca97c7468d655b30c8e4fbec341a3d125cd106a1a30cde896552c6` |
| [browser-19-3d-junction-committed.png](2026-10-30-browser/browser-19-3d-junction-committed.png) | 3D Junction release committed once; Undo enabled | 153,497 | `f89f8f5b553d07786a5d893e39f9be10fa5684f3e7bc94bf0ffc80115e47d4a7` |
| [browser-20-3d-empty-pan.png](2026-10-30-browser/browser-20-3d-empty-pan.png) | empty-Stage drag panned the Camera and wrote no history; Undo stays disabled | 150,008 | `750144fbe83932815ed393cf7eb997e47c54444d92632b657f6abd4d6ff64e59` |
| [browser-21-plan-refused.png](2026-10-30-browser/browser-21-plan-refused.png) | body dragged across the Room: candidate withdrawn, thin dashed pointer line, `This would break a Room.`; release wrote nothing | 108,657 | `2e5a6f85b88cee188dcceb20f5aa09dc69db16648f33992a1cf645a80b381828` |

Total renderable evidence: **21 PNG files / 2,885,827 bytes**.

Cursor states were read from computed style in the same session: `move` over the selected Wall body,
`grab` over empty Stage. Coarse-pointer marks, native touch and Safari are not covered here and stay
with the integrated R217 journeys in S11.
