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
  its residual `TRANSFORM` call; F8 (the whole shell's type/button chrome vs the Atlas) was
  fixed by R3. Device/screen-reader/reduced-motion/coarse-pointer rows stay manual-owed.
- Ratified and landed 2026-09-19: R1 (tray engraved tier — 7 px group / 8 px tool, 6 px
  compact floor), R2 (armed tool = darkened surface only, no amber border or inboard edge)
  and R3 (one closed type ladder + a role per recurring group, all multiples of
  `--editor-type-scale` / `--editor-control-scale` set on `:root`, so the shell holds no
  pinned sizes; the Inspector family is the remaining batch). Record + drift root cause:
  `../reference/design-system/editor-shell-ratifications.md`.
- Durable design authority promoted to
  `../reference/design-system/editor-shell-and-visual-system.md` + its Atlas companion; P23.15,
  P23.16, P24 and P26 fit into that shell grammar rather than re-deciding it.
- Ratifications folded back into the durable authority (docs-only reconciliation, no
  implementation change): that contract now carries R1–R3, the View Bar `MODE` caption
  grammar, the closed type ladder + two scales with the `:root` cascade rule, the four distinct
  surface states, and two new durable rules — shell-inheritance (§2.8) and roles-not-numbers
  (§2.9) — with §0.1 the authority graph, §0.2 the ratification record, §0.3 the open owner
  calls (kept unresolved) and §0.4 the implementation debt kept out of design. Pre-PLATE
  numeric shell material (`design-specs.md` §17, `design-shell-specs.md`, `design-plan-p21.md`,
  the scene/camera workspace specs) is now explicitly classified superseded / descriptive /
  subsystem authority, and the measurements moved to the `editor-shell-ratifications.md`
  evidence annex beside it. P23.14 stays
  **owner-review-open**.
- **Authority migration (docs-only, no implementation change):** the durable shell contract
  was promoted out of the P23.14 slice to
  `../reference/design-system/editor-shell-and-visual-system.md` (retitled, slice-independent),
  with `editor-shell-ratifications.md` and `editor-shell-atlas/` beside it. The P23.14 slice is
  now history and leaves supersession pointers at the old paths —
  `../roadmap/p23-layout-depth/p23.14-shell-visual-system/design/` — so no second live authority
  exists. P23.14 is still **not** closed out.
- then P23.15
- → ../roadmap/p23-layout-depth/p23.14-shell-visual-system/README.md

BLOCKER:
- none
