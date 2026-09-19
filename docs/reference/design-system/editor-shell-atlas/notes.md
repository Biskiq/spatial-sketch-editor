# PLATE shell Atlas — owner review notes

Durable QA companion to
[`../editor-shell-and-visual-system.md`](../editor-shell-and-visual-system.md).
Written during the **P23.14** implementation review (2026-09-19); provenance of the
instrument, not authority over the contract.

## Contradictions / unresolved direction

- **Closed by owner ruling:** canonical B is **Scene / 3D**. Layout/Arrange remain Scene Plan local modes. The authoritative §25.1 title and Atlas both incorporate this ruling.
- **Drawer left edge:** §17 says central-work-column span; PNGs start after the Tool Tray. Atlas follows the written column boundary, including the tray width.
- No ratified compact-reference scheme is supplied for Buildings, Floors, Scene objects, cameras or sequences. Atlas preserves R/W/O/J identity and uses names plus camera sequence ordinals elsewhere; it does not adopt generated M-/F-/OBJ-/CAM-/SEQ- tokens as contracts.

## Owner-ratified decisions the Atlas now reflects (2026-09-19)

Record and rationale: [`../editor-shell-ratifications.md`](../editor-shell-ratifications.md). Three changes to
this instrument after owner review of the landed shell:

- **R1 — Tool Tray type.** The rail paints 7 px group / 8 px tool labels (the reference tier,
  unchanged here) and a group word wider than the rail steps down to a 6 px compact floor
  rather than breaking mid-word. `TRANSFORM` is the only qualifying word and carries
  `class="compact"`. The Atlas previously overflowed that one label; it no longer does.
- **R2 — the armed tool is a darkened surface and nothing else.** The tool rail's
  `[aria-pressed=true]` treatment lost its amber border and its 2 px inboard edge; it now paints
  the recess trough tone with full ink, matching the landed
  `.tool-tray button.active { background: var(--editor-bg-recess) }`. This instrument is where
  the old amber treatment was first drawn, so it is corrected here too.
- **R3 — this Atlas is now the METRIC reference for the shell's type and chrome.** The owner
  compared the whole shell against this instrument and found the fonts, font sizes and button
  sizing/styling had drifted (F8). The shell no longer holds pinned sizes: seven ladder steps
  (9/10/11/12/13/15/20 px) and a role for every recurring group are multiples of two knobs
  (`--editor-type-scale`, `--editor-control-scale`), and the metrics this instrument draws are
  the resolved values — View Bar plain 24 px buttons with 10 px utility / 11 px MODE labels and
  a pressed edge border + inset bottom rule; Head 26 px controls with a 14 px identity; 74 px
  Spine stations with 24 px icons; 29 px Navigator rows (12 px label, 10 px mono meta, 18 px
  disclosure target); 10 px engraved Inspector section headers; 9 px mono timeline ticks; 10 px
  Status Rail text. Nothing in this file changed for R3 — the correction is on the product
  side, and the mapping plus the unswept Inspector family are recorded in the ratification.

## Authority promotion

Every ratification below is **folded into the durable authority itself** —
[`../editor-shell-and-visual-system.md`](../editor-shell-and-visual-system.md) §0.2 (record), §7.3–§7.4 (tray and
control roles), §10 (View Bar `MODE` grammar), §11 (R1/R2 treatment) and §18 (four
distinct surface states) — so this Atlas and the direction do not have to be read
against a PR body or a QA note. [`../editor-shell-ratifications.md`](../editor-shell-ratifications.md)
keeps only the measurements and history.

The owner has promoted the P23.14 design to the durable, stable baseline: `editor-shell-and-visual-system.md`
wins over this Atlas, and this Atlas wins over the reference docs' older shell placement,
dimension and type numbers (which describe the pre-P23.14 ribbon/floating-toolbar shell).
Where R3 says the shell's sizes are roles, this Atlas is the reference those roles were
resolved against — but the roles (in `styles/tokens.css`) are what the product implements,
so a later metric change is an owner decision on the role, not an edit to a component. Later
phases — P23.15→P23.16, P24, P26 — fit into this grammar and may depend on it. This Atlas stays
QA evidence: never topology, validation or numeric-acceptance authority.

## Deliberate PNG corrections

- Domain stations use restrained 3 px inboard edge-lights, not full brass/cyan fills. PLATE Light is the only baseline.
- Reference geometry is 1440 × 900; spine 56, head 36, Navigator 268, Inspector 300, View Bar 34, Tool Tray 44, Status 24, Drawer 48/288 px. Spatial and Publish remain separate actions.
- Protected Wall / Rect Room / Poly Room / Door / Window icons use the installed Lucide nodes from the existing toolbar. Select / Column / Platform / Plinth / Snap / Grid paths are copied verbatim from PlanDraftIcon. Embedded licenses retained.
- The named shared wall bounds Gallery North and Main Hall, so its selected Plan occurrence lies on their common boundary, not the PNG’s exterior north wall.
- Camera Graph is explicitly contextual; ordinal numbers mean sequence position, not canonical IDs. Plan has no finite frustum. Expanded Timeline has only the five ratified lanes, one playhead, and a quiet 0° Roll readout.
- Names may ellipsize; compact references remain complete. Rename occurs only in Inspector; raw fixture IDs remain under Technical details. Secondary ink is darkened for contrast.

## Remaining QA risks

- Spatial illustrations are editable SVG fixtures, not product-renderer captures. The 3D illustration is intentionally less photoreal than the PNGs; renderer lighting, material fidelity, camera projection and exact P23.13 geometry require implementation comparison. Inventory stress entries beyond the drawn ground-floor sample have identity/readout coverage, not individual spatial geometry.
- P24 property values, multi-selection outlines and P26 elevation are pressure fixtures, not new behavior contracts. Numeric properties are readouts; global project actions are composition specimens. Destructive controls preserve the QA fixture.
- Only PLATE Light is represented. Alternate-theme contrast remains unvalidated if variants are retained. Platform font fallback may change text metrics; the contract does not name font families.
- Browser checks cover canonical switching, 48/288 px Drawer geometry, five lanes, 72 canonical walls / 73 occurrences, search/reveal, shared selection, rename propagation and P26 return. Automated accessibility checks require manual SVG/contrast review; screen-reader reading order and real coarse-pointer usability still need device acceptance. Compact desktop frames retain scrollable panels and a 1:1 inspection canvas; this is not a mobile product layout.

- Companion [P23.13 Plan-detail Atlas](../../../archive/roadmap/p23/P23.13-ink-and-instrument-atlas-Designer-D.html) retains landed Plan Paper `#F5F7F8` and graphite/paper-moat Plan-local focus. The authoritative PLATE token table and Atlas now use `#F5F7F8` for Scene Plan and Camera Plan, keeping `#F5F2E9` as a separate non-Plan baseline. The Atlas-only purple focus ring is not authority to override Plan-local focus. Paper unification needs explicit owner re-ratification and QA; product shell-focus handoff remains unvalidated.
