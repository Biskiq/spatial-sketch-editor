# R217.S03 — Stage interaction coordination: implementation plan

**Slice:** R217.S03 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T1 · **Reviewers:** T2 (Scene
providers), T5 (form providers), T3 (Undo reason, Experience lens) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Introduces one Stage coordinator for picking, hover and gesture lifecycle, with every domain's hit,
occlusion and refusal policy beneath it, as
[the phase's interaction split](../README.md#shared-stage-interaction-coordination-over-domain-policy)
defines. Selection and picking behaviour is preserved, apart from the added hover state and the
interruption fixes. The visible changes come in S07.

## Prerequisite

R217.S01 is accepted, and its gesture inventory and raycast allow-list are the input.

## Scope

1. **Pick providers.** Each domain contributes a provider through the adapter contract. A provider
   takes a pointer, the current evaluation and the state (reading, armed tool, selection). It
   returns its eligible candidates, ranked by its own policy and with its own occlusion applied.
   - The Layout provider wraps the existing Plan pick index and pick surfaces.
   - The Scene provider wraps the raycast, Plan footprint hits and support occlusion.
   - The form provider wraps form rays.
   - Experience-lens providers wrap T3's existing framing hits unchanged.
2. **Coordinator.**
   - **Routing:** a live gesture's owner captures input; otherwise the armed tool's domain; otherwise Select.
   - **Cross-domain resolution:** only by spatial truth. In 3D, the nearest visible surface along the ray. In Plan, the draw order of the reading; until S04 that is the current pick index's fragment order, and after S04 it is the Paper reading's layer order.
   - **Mark tier:** reserved above world geometry, and empty until S07.
   - **Hover:** hover, click and drag entry resolve the same winner.
3. **Hover state.** Hover lives in the session, beside selection, as view state: never history,
   Save or dirty. Adapters' `hoverIntent` reads it. Nothing new is drawn yet.
4. **Gesture lifecycle.** One owner at a time: begin → preview → commit or cancel.
   - Adapter drags move onto it without changing their planners, candidates or refusals.
   - The host owns the "Undo unavailable while …" reason, so the reason names the live owner from the lifecycle and not from a hand-maintained list.
5. **Interruption triggers.** Each one cancels a live **press gesture**:
   - `pointercancel` and lost pointer capture;
   - window `blur`, and `visibilitychange` to hidden;
   - a second touch point (the start of a pinch);
   - Esc, a lens switch and project replacement;
   - a reading flip during a drag (the measured projection no longer exists).

   **Recovery:**
   - the transient candidate is discarded, and no history or dirty change is made;
   - selection is preserved and pointer capture is released;
   - marks and cursor reset, and the Undo reason clears, so the creator can restart at once.

   **Open multi-step work** (an Ink chain in progress, an open numeric entry) is not a press
   gesture: interruptions leave it open, and only Finish, Backtrack or Esc end it. Save during a
   live gesture saves the last accepted source; the candidate is never saved.
6. Empty S01's raycast allow-list, and remove the duplicated pick and press plumbing from
   `stage-facade.ts` and the spatial route rather than wrapping it.

## Not in scope

Selection, hover and mark visuals (S07), Paper drawing (S04), new tools (S10), and any change to a
domain's planner, refusal text or ranking.

## Shared-file claims

`stage-facade.ts`, `stage-input.ts` and `stage-session.ts`; the spatial route's pointer handlers;
the Layout, Scene and form adapters' pick and drag entry points, as bounded patches reviewed by
T2 and T5.

## Acceptance criteria

1. **Pick differential:** on the starter, an L fixture and a forms fixture, a fixed set of pointer samples in both readings resolves to the same subject before and after. Any difference is listed and justified by an interruption fix.
2. **Domain policy preserved:** the existing Layout hit-priority, Scene support-occlusion and form-ray tests pass unmodified. A seeded host-side reorder of a domain's candidates fails a new test.
3. **Hover:**
   - hover and press resolve the same winner for every sample;
   - hover never creates history or dirty state, and is absent from Save.
4. **Interruptions:** each trigger in scope 5 has a test proving its recovery outcome. An open Ink chain survives blur and a hidden page.
5. **Undo reason:** the reason comes from the lifecycle, and a test fails if two gesture owners are live at once.
6. **Raycast allow-list:** the S01 allow-list is empty.

## Verification

Affected adapter and Stage contracts; the relevant heavy contracts for Layout hits; the S01 arch
tests; then the complete merge gate in the
[test contract](../../../../apps/editor/tests/README.md#what-a-change-requires).
