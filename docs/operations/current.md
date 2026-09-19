# Current

PHASE: P23
SLICE: P23.14
STAGE: implemented on `p23.14` — Tasks 1–9 landed; self-review QA recorded

NEXT:
- owner review of `../roadmap/p23-layout-depth/p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md`:
  F1 (Scene can mount the Camera node editor), F2 (Inspector header vs body selection),
  F4 (numeric fields report `:invalid` on legal values), F5 (`POV / Observer` duplicated in
  Camera 3D). F3 (locality badges), F6 (Navigator density threshold) and F7 (Tool Tray
  engraved tier) were fixed in the same pass; device/screen-reader/reduced-motion/
  coarse-pointer rows stay manual-owed.
- F7's residual call: the tray's `TRANSFORM` group label is 44.7 px at the reference 7 px —
  wider than the 44 px rail — so it still breaks to two lines. Shorten that one group label,
  or accept the break.
- then P23.15
- → ../roadmap/p23-layout-depth/p23.14-shell-visual-system/README.md

BLOCKER:
- none
