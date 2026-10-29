# R217.S02 — Shell composition: implementation plan

**Slice:** R217.S02 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T3 (Head, Find, Experience lens), T2 and T5 (moved entries, Card contributions) ·
**Runbook:** [T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

## 1. Outcome

The Head, collapsible Index, contextual Card and lower working edge read as one shell:

- at desktop, small-laptop and iPad widths;
- with a mouse or a finger;
- without the Stage ever moving because a panel opened.

Viewing preferences and Settings get a home in the Head's app menu. The Index becomes a locator
only.

## 2. Why this is the smallest sensible slice

The shell components exist and already respect several rules: the Card is an absolute overlay
and there is no empty Card (`EditorCard.svelte`); the Index collapses (`EditorIndex.svelte`); and the
Head shows Find, Undo/Redo, Save and Preview (`EditorHead.svelte`). This slice closes only the
composition gaps against [PLATE §Shared shell](../../../reference/design-system/editor-shell-and-visual-system.md#shared-shell-08)
and [§Responsive](../../../reference/design-system/editor-shell-and-visual-system.md#responsive-and-narrow-behavior-22).

**Deferred:**
- the full scope-model Index, global subject Find and the Head's source-history list;
- dock contents (S10);
- drafting furniture (S05, S06), whose slots this slice reserves;
- phone layouts.

## 3. Dependencies

- R217.S01 accepted.
- Runs in parallel with S03. **Claims:** the spatial route's layout markup only (S03 claims its
  pointer handlers), plus `EditorHead.svelte`, `EditorIndex.svelte`, `EditorCard.svelte`,
  `StageInstrumentHost.svelte` and `stage-contributions.ts`.
- T3 reviews every Head and Find change before merge.

## 4. Design

### 4.1 Conformance audit (first commit)

A table in this slice's acceptance record lists each PLATE shared-shell and responsive rule, with
one disposition per rule: *conforms*, *gap → §4.x* or *outside R217 (owner)*. A gap that needs a
foreign domain's semantic redesign stops the slice for a scope decision.

### 4.2 Head

- **App menu (☰).** It is a disclosure menu, not a second toolbar, with three groups:
  - **Viewing:** 2D appearance Paper | Shaded (read by S04).
  - **Settings:** Reduce motion and Motion speed. The `reducedMotion` toggle leaves the Head row; its system-preference initialization in the route stays.
  - **Keys:** the key map, read-only.
- **Location chip.** While the Index is collapsed, the Head shows the selected identity, or the
  project name when nothing is selected. Activating it opens the Index. The collapsed Index's own
  "Selected: …" line is removed with it.
- **Find.** ⌘K / Ctrl+K opens the existing Find disclosure and focuses its field. Dock entries keep
  their Arm verb. Entries that leave the Index (§4.3) are listed under their verb.
- The Head stays one row at every supported width. At narrow widths, labels compress before
  identity is lost.

### 4.3 Index

- **Collapsed takes no width.** The Stage rectangle grows; the Camera does not move (§4.6).
- **Tool and task entries leave the Index.** `stageContributionGroups` stops listing any entry.
  `StageEntryHome` gains `'find'` and becomes the default home, and the existing contributions
  move as follows:

  | Entry | Owner | New home |
  | --- | --- | --- |
  | Place plinth | Layout | Find |
  | Place object | Scene | Find now; the Library key in S10 |
  | Arrange | Scene | Find |
  | Compose | Scene | Find |
  | Shape | Scene | Ink reading; already not an Index row |

  The audit maps every entry before removal, so no entry is stranded or duplicated. Owners review
  their rows.
- The Index keeps its locator operations (Select, Open location, Bring into view, Reveal), its
  subject search and its membership reasons.

### 4.4 Card and the lower column

- **Arbitration.** The Card is anchored to the Stage's right edge and the lower column to its
  centre, as one composition:
  - when an Instrument is open and the remaining width cannot hold both, the Card collapses to its identity header with explicit Expand;
  - it never covers the Instrument, the dock, the reading control or the drafting words;
  - opening an Instrument procedure closes an open Card sheet.
- **Lower column.** Dock, then palette, then Instrument stack bottom-up in one centred column on the
  forest Instrument material, per [PLATE §The lower working edge](../../../reference/design-system/editor-shell-and-visual-system.md#the-lower-working-edge).
  S10 fills the dock.
- **Reserved slots.** The reading control and drafting words go top-left over the Stage (S05), and
  the Height Sheet on the right edge (S06). This slice positions empty slots so later slices do not
  re-layout the shell.

### 4.5 Narrow and iPad

| Width | Index | Card |
| --- | --- | --- |
| ≥ 1280 px | Docked; collapsible to zero | Overlay |
| 768–1279 px | Invoked overlay, starting collapsed, ending above the dock row; its scrim leaves the dock usable | Invoked sheet behind a selected-identity control |
| Portrait iPad (768 × 1024) | As above | As above |

Exact breakpoints are this slice's choice and are recorded in the acceptance record. Phones are
out of scope.

### 4.6 Layout never moves the Camera

Shell changes update only the viewport rectangle passed to `ViewportEvaluation`: Index collapse,
Card open or close, Instrument open, sheet presentation and window resize never issue an implicit
Fit, Zoom, Pan or framing request. Camera target, azimuth, elevation and
`targetPlaneHeightMeters` remain unchanged; changes to the rectangle and projection aspect are
permitted. `targetPlaneMetersPerCssPixel` follows Camera's existing vertical-extent formula and may
change when viewport height changes. Panels must not unexpectedly move or reframe the Stage.

### 4.7 Coarse pointer and touch

- Under `@media (pointer: coarse)`, every shell control has at least a 44 × 44 px target.
- Under `hover: none`, every hover-only reveal (tooltips, row actions) gets a tap or long-press
  path.
- The existing coarse rule in `EditorHead.svelte` becomes a shared token, so the rule is written
  once.

### 4.8 App preference store

A new `app-preferences.ts` module in `apps/editor/src/lib/platform/` holds viewing preferences
and Settings per browser:

- every read and write is in `try/catch`;
- defaults apply when storage is unavailable;
- it is never imported by `visitor/*` or the public surface;
- it is never part of project source, Save, dirty state or history.

## 5. Tests and acceptance criteria

1. **Audit.** The table is complete, and every *gap* row names the test that closes it.
2. **Viewport invariance** (extends `apps/editor/tests/lib/authoring/stage-shell-composition.test.ts`).
   Across Index collapse and expand, Card open and close, Instrument open and window resize, the
   evaluation's target, `targetPlaneHeightMeters`, azimuth and elevation are equal; no implicit
   Fit, Zoom, Pan or framing request occurs. Rectangle and projection aspect may change. A
   768 → 1024 px height case asserts meters per pixel equals the preserved vertical extent divided
   by the corresponding viewport height.
3. **Index.** It renders no tool or task entry. Every former entry is reachable from Find or the
   dock, by an equality check between the before and after entry sets. A collapsed Index has zero
   rendered width.
4. **Head.**
   - ⌘K focuses Find and the location chip opens the Index.
   - The Reduce motion setting persists across a reload through the store.
   - A project Save payload is byte-identical with preferences set and unset.
5. **Arbitration.** With an Instrument open at 1024 px, the Card is collapsed to identity and
   overlaps neither the Instrument nor the reserved furniture slots (bounding-box test).
6. **Coarse pointer.** Under emulated `pointer: coarse` and `hover: none`, every shell control is at
   least 44 × 44 px, and every hover reveal has a tap path (agent browser check at 1024 × 768 and
   768 × 1024).
7. **Experience lens.** Existing Experience journeys pass unchanged, and T3 confirms.
8. **Boundary.** `app-preferences.ts` is absent from visitor and public chunks (arch lane).

## 6. Reviews and stop conditions

- **Reviews:** T3 for Head, Find and the Experience lens; T2 and T5 for moved entries.
- **Stop and report if:**
  - an Index entry has no Find or dock home that its owner accepts;
  - Card arbitration needs a change to a domain's Card writer;
  - the viewport-invariance test reveals a Camera reframe owned by Camera code. That reframe goes to its owner, not into a shell patch.

## 7. Handoff

S04 reads the Paper | Shaded preference. S05 and S06 fill the reserved slots. S10 fills the dock
and binds the Library key to Place object.
