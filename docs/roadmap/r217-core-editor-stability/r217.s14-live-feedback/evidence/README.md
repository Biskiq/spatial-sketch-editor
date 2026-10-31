# R217.S14 browser evidence

Thirteen Chromium captures of the local editor on the final S14 revision, starter **Enclosed
room**, DPR 1. The settled journeys are summarised in the
[acceptance record](../acceptance.md); this pointer carries each capture's state, byte size and
SHA-256 until closeout archives the files.

| Capture | State shown | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| [browser-01-plan-fit.png](2026-10-30-browser/browser-01-plan-fit.png) | 1440 × 900 Plan after the starter loads; bounded sheet, palette, ruler and zoom cluster | 110,973 | `96f4467fa5f704d89025a2f105d964a4b60680af108b3588472dd7c5a7ff2073` |
| [browser-02-ink-hover-index-open.png](2026-10-30-browser/browser-02-ink-hover-index-open.png) | 1440 × 900 Ink Wall, one typed point + real pointer hover; live leg, `Length 2.236 m · angle 26.6°`, `Grid`, Index open | 118,483 | `81650117994af211d95720c870e3de91ebc227704ac53fda7632a33890f882c0` |
| [browser-03-ink-hover-index-closed.png](2026-10-30-browser/browser-03-ink-hover-index-closed.png) | same live leg with the Index collapsed; the mark stays under the pointer | 82,330 | `73e53463dce630da02876e0988eaf134d337936ca0392f312176142231e76eb0` |
| [browser-04-box-refused.png](2026-10-30-browser/browser-04-box-refused.png) | Box ring inside a Room without a shared Junction; refusal words wrap inside the Stage, no geometry | 91,647 | `a5ee0967564a7a012657fb959bbbbd9e4d23f046f2d81da0a673af4f0c0b30a1` |
| [browser-05-box-live.png](2026-10-30-browser/browser-05-box-live.png) | 1440 × 900 live Box outside the Room: four ghost Walls, grid snap and the consequence label | 79,003 | `86cd7b6f65e86a7d8f3453e766c9704366303c507d4a9661a6d844a2ed02597b` |
| [browser-06-3d-box-footprint.png](2026-10-30-browser/browser-06-3d-box-footprint.png) | 3D live Box: the candidate is a flat footprint on the datum mat, not a slice at the Paper cut | 149,020 | `af7990b935bc3b81cf7423f8acfbbaa1e078fff7dedd6ade014f60509594371f` |
| [browser-07-opening-placement.png](2026-10-30-browser/browser-07-opening-placement.png) | Opening reading on a selected Wall: edge-positioned ghost and `Width 0.900 m`; placement is not centre-snapped | 103,049 | `c65c2560d6e61bd0c8be8ee8f7b02654eab3111e9d36e18bcf231a3b99031767` |
| [browser-08-opening-slide-snap.png](2026-10-30-browser/browser-08-opening-slide-snap.png) | selected Opening slide held mid-drag on the 3.0 m centre; `Grid` tag and live `Offset 2.550 m` | 110,868 | `21ec751d013a6d310a2f827233b0664605cf57caa63069c60a898fe792017096` |
| [browser-09-opening-slide-committed.png](2026-10-30-browser/browser-09-opening-slide-committed.png) | release committed the slide once; Card reads `2.55` | 99,520 | `205a50a4c74cd1e5427bcbc8c1421ffa649b392bba14e02f50953c883414988b` |
| [browser-10-opening-slide-undone.png](2026-10-30-browser/browser-10-opening-slide-undone.png) | one Undo restored the authored offset `2.357493857`, one history step | 104,145 | `528c441f62ef88a3fe3cd58c8ea73d0cc075e909427d1048ffaec0003e92384c` |
| [browser-11-width-1280x800.png](2026-10-30-browser/browser-11-width-1280x800.png) | 1280 × 800 with a live Wall leg; length/angle/`Grid`, palette and Stage do not collide | 89,421 | `96cccc9d2f152b80a069486e46b7d34a0f7ee48ed3d16be2b85b542ca7ceb9c8` |
| [browser-12-width-1180x820.png](2026-10-30-browser/browser-12-width-1180x820.png) | 1180 × 820 with a live Wall leg; length/angle/`Grid`, no control collision | 77,172 | `bf3291a47e0440789616989a6b8aa867377b00789c1de6cf3cfb464cb1344dd1` |
| [browser-13-width-820x1180.png](2026-10-30-browser/browser-13-width-820x1180.png) | 820 × 1180 with a live Wall leg; length/angle/`Grid`, portrait shell holds | 74,690 | `b4e7576f216e0ebc8798456a2879440b401a87db434137cbbb354f10c79c68bb` |

The refusal sentence in capture 04 names a Room whose id is longer than a readable line; the final
revision hard-wraps that token, which is why the tag stays inside the Stage.
