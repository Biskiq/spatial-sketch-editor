# R217.S02 — Shell composition: implementation plan

**Slice:** R217.S02 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T1 · **Reviewers:** T3 (Head, Find,
Experience lens), T2 and T5 (Card contributions) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Composes the Head, collapsible Index, contextual Card and lower working edge as one shell at every
supported width, per [PLATE §Shared shell](../../../reference/design-system/editor-shell-and-visual-system.md#shared-shell-08)
and [§Responsive and narrow behavior](../../../reference/design-system/editor-shell-and-visual-system.md#responsive-and-narrow-behavior-22).

## Prerequisite

R217.S01 accepted. Can run in parallel with S03; the spatial route is a claimed shared file.

## Scope

1. **Conformance audit first.** Compare the landed Head, Index, Card and dock column
   against PLATE, in a table in this slice's acceptance record (conforms / gap / out of R217). Every
   gap that is in R217 is fixed below; an unexpected gap that needs foreign semantic redesign stops
   for a scope decision.
2. **Head:**
   - **App menu:** viewing preferences (Paper or shaded Plan, read by S04), Settings (Reduce motion, Motion speed) and Keys.
   - **Location chip** while the Index is collapsed.
   - **Find:** opens with ⌘K and arms dock tools with its Arm verb. Subject results stay the Index's.
   - The Head stays one compact row; app actions only, no task toolbar.
3. **Index:**
   - Collapsed takes no width, and collapsing preserves location and selection.
   - Tool and task entries leave the Index once the dock or Find reaches each one. The audit maps every entry before any is removed; none is stranded or duplicated.
   - It stays a locator: Select, Open location, Bring into view, Reveal.
4. **Card:**
   - It appears only with a selection, never reflows or reframes the Stage, and keeps its identity header when compressed.
   - **Arbitration with the lower column:** the Card never covers an invoked Instrument or the drafting words. At constrained width it collapses to identity with explicit expansion, and opening a procedure closes the Card sheet.
5. **Lower working edge:** one column, dock → palette → Instrument, on the forest Instrument
   material, as PLATE describes. S10 completes the dock contents.
6. **Narrow and iPad:**
   - The Index becomes an invoked overlay that starts collapsed, ends above the dock row, and whose scrim leaves the dock usable.
   - The Card becomes an invoked sheet behind a selected-identity control.
   - Reading control, drafting words and Height Sheet slots stay available.
   - Landscape and portrait iPad both work. Phones are out of scope.
7. **Coarse pointer:** every shell control gets a 44 × 44 px target under `pointer: coarse`, and
   every hover reveal in the shell has a touch and keyboard path.
8. **Layout never moves the Camera:** opening, closing or resizing any shell surface changes only
   the viewport rectangle. The Camera target, scale and pose are unchanged.
9. **App preference store:** a per-browser preference store for viewing preferences and Settings,
   which never enters project source, Save or dirty state. Every read and write is guarded so
   the shell renders with defaults when storage is unavailable.
10. **Experience lens** keeps sharing Head, Index and Card. Its Guide instrument and expression are
    unchanged (T3 review).

## Not in scope

Paper Plan rendering (S04), drafting words (S05), the Height Sheet itself (S06), dock contents
(S10), the full scope-model Index, global subject Find, and phone layouts.

## Shared-file claims

The spatial route's layout markup; `EditorHead.svelte`, `EditorIndex.svelte`, `EditorCard.svelte`
and `StageInstrumentHost.svelte`.

## Acceptance criteria

1. The audit table is complete, and every in-scope gap is closed.
2. **Viewport invariance:** a test proves the `ViewportEvaluation` target, scale and pose are unchanged across Index collapse, Card open and close, and window resize (only the aspect changes).
3. **Index access:** a collapsed Index takes zero width, the location chip shows the location, and every former Index task entry is reachable from the dock or Find.
4. **Stores:** app preferences survive a reload and appear in no Save payload; project source is byte-identical with and without preferences set.
5. **Coarse pointer:** under emulation, every shell control is at least 44 × 44 px and no hover-only control remains.
6. **Experience lens:** existing Experience journeys pass unchanged.

## Verification

Affected shell and route contracts; the agent E2E shell journey at 1440, 1024 and 768 px with fine and
coarse emulation; then the complete merge gate in the
[test contract](../../../../apps/editor/tests/README.md#what-a-change-requires).
