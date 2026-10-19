# T2.P01.S03 pointer acceptance evidence

Captured 2026-10-18 in real Chrome at `http://127.0.0.1:4173/editor`, 1280×900, with the canonical
Enclosed room starter. The Stage rectangle was `(352, 118.9375, 928, 458.0625)`. Images were copied
unmodified from the local browser QA capture. Shift-drag used Chrome input events with Shift held
during pointer movement. Browser video capture was unavailable because FFmpeg was not installed.

The full gesture trace, exact planner refusal, tested diff identity and verification results are in
the live [S03 acceptance record](../../../../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md).
The record is compacted to its closeout stub; the refreshed-Chrome detail lives in the preserved
acceptance body:

EVIDENCE-PATHS: start — the preserved acceptance body at the accepted closeout anchor
git show 2747f1691551296e21b17aa04dfd9de76cb08f59:docs/roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md
git show closed/T2.P01.S03:docs/roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md
EVIDENCE-PATHS: end

| File | State shown | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `plan-move-ghost-fixed.png` | Plan Move ghost candidate | 89,231 | `7cbc542108890df5fd33051d4537c0643c4fa4c133c54fa4318ea1e336303174` |
| `plan-move-committed.png` | Plan Move accepted pose | 77,310 | `4fb3a700bd8dbd9b2b6d90082a397a07250f6ee209ba7fecf9f01264a3e79217` |
| `plan-move-undone.png` | Plan Move Undo | 71,215 | `2c6ca8b52419c6ee7981c1a8524dcd36f69acb1f983555c076c305ab8636b209` |
| `plan-move-redone.png` | Plan Move Redo | 77,310 | `4fb3a700bd8dbd9b2b6d90082a397a07250f6ee209ba7fecf9f01264a3e79217` |
| `3d-move-ghost.png` | 3D pointer Move ghost candidate | 101,611 | `3cccc41cb9294d5c5ae03beefdba61e2e907a5c6aae335bf106abf127192cc04` |
| `3d-move-committed.png` | 3D pointer Move accepted pose | 82,914 | `9f857c0c6cdbc582b8129f1b6a31b9257fa1665e79e2a75e57addf3e5faeed3b` |
| `3d-shift-yaw-ghost.png` | 3D Shift-drag Yaw ghost candidate | 101,542 | `0c8bc3b479892839a5a5d0beac856a47fd34fe71c2988fbabe33afc2be0776e4` |
| `3d-yaw-committed.png` | Shift-drag Yaw accepted pose | 84,858 | `812494736aa21ff3c4745ea81cfaa6db5b618f98c40487543b97252ac6951562` |
| `3d-yaw-undone.png` | Shift-drag Yaw Undo | 82,527 | `7ee70bc92e5624d66c6e83de9dda9b23369c0ebdd26f2fe70dd2f9e4993d9fb5` |
| `3d-yaw-redone.png` | Shift-drag Yaw Redo | 84,858 | `812494736aa21ff3c4745ea81cfaa6db5b618f98c40487543b97252ac6951562` |
| `pointer-no-support-refused-after-up.png` | Exact no-support refusal after pointer release | 97,725 | `1a95519ece8c08032ab76b3dac5c2f4248489cbc1bae0444f35635708061deda` |

Total renderable evidence: **11 PNG files / 951,101 bytes**.
