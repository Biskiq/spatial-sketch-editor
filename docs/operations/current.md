# Current

PHASE: P23
SLICE: P23.14
STAGE: implemented on `p23.14`, owner review OPEN (not closed out) — PR #61

NEXT:
- owner review closeout for P23.14. Open findings in
  `../roadmap/p23-layout-depth/p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md`:
  F1 (Scene can mount the Camera node editor), F2 (Inspector header vs body selection),
  F4 (numeric fields report `:invalid` on legal values), F5 (`POV / Observer` duplicated in
  Camera 3D). F3 (locality badges) and F6 (Navigator density threshold) were fixed in the
  same pass; F7 (Tool Tray engraved tier) was fixed and ratified as R1, which also resolves
  its residual `TRANSFORM` call. Device/screen-reader/reduced-motion/coarse-pointer rows stay
  manual-owed.
- Ratified and landed 2026-09-19: R1 (tray engraved tier — 7 px group / 8 px tool, 6 px
  compact floor) and R2 (armed tool = darkened surface only, no amber border or inboard
  edge). Record + drift root cause:
  `../roadmap/p23-layout-depth/p23.14-shell-visual-system/design/owner-ratifications.md`.
- Durable design authority promoted to the P23.14 `final-direction.md` + Atlas; P23.15,
  P23.16, P24 and P26 fit into that shell grammar rather than re-deciding it.
- then P23.15
- → ../roadmap/p23-layout-depth/p23.14-shell-visual-system/README.md

BLOCKER:
- none
