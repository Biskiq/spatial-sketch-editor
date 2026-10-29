# R217.S10 — Dock completion: implementation plan

**Slice:** R217.S10 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T1 · **Reviewers:** T2 (Scene delete,
Shape Box), T5 (form delete), T3 (Find arming) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Completes the owner-ruled dock: Select · Ink (Line, Box) · Measure · Eraser · Library.

## Prerequisite

R217.S02 (the lower edge), S05 (snap) and S07 (hover and marks) are accepted.

## Scope

1. **Dock keys.**
   - Keys are icon-first, with tooltips that give the name and key hint.
   - The armed key is ivory on the forest dock; tool colour appears only as a 2 px mark.
   - Palette collapse is explicit, and Esc collapses the palette before it disarms.
   - Arming never changes selection.
2. **Ink palette: Line and Box.**
   - Box makes the same closed-chain intent as four Lines, through the existing Layout drawing planner, in one Undo step. Rooms are derived.
   - On the Shape reading, Box is a rectangle outline through T5's existing planner.
   - Both honour the S05 snap fact.
3. **Measure.**
   - A session-only distance between snapped points, with a live tag.
   - Esc clears it.
   - It makes no history entry and no dirty state, and is never saved.
4. **Eraser.**
   - While armed, the eligible subject under the pointer shows red dashes, driven by S03's hover.
   - On a coarse pointer the dashes appear on press, a release erases, and sliding off cancels.
   - A click erases one admitted subject through its owning domain's existing delete planner, in one Undo step. Ineligible targets refuse in words.
5. **Library** keeps its key, and Find arms every dock tool by its Arm verb.
6. **Keyboard:** every tool can be armed and used without a pointer, where its domain offers a
   non-pointer path. The production key map is this slice's choice, reviewed against the existing
   viewing keys.

## Not in scope

Slice, Brush, Sketch, Round, the Eraser's sweep and kind filter, and cross-domain composed erase.

## Acceptance criteria

1. **Arming:** a test proves arming never changes selection.
2. **Box:**
   - one F4 entry;
   - derived Rooms;
   - identical source to four Lines with the same points.
3. **Measure and the Eraser:**
   - Measure leaves source, history and dirty state unchanged;
   - the Eraser's single erase is one entry, and Undo restores the same identities;
   - red dashes appear only while the Eraser is armed.
4. **Coarse pointer:** the Eraser's press, slide-off and release behave as specified, and dock keys are 44 px.
5. **Find** arms every dock tool, and every tool refuses ineligible targets in words.

## Verification

Affected dock, Layout drawing, Scene and form delete contracts; then the complete merge gate in the
[test contract](../../../../apps/editor/tests/README.md#what-a-change-requires).
