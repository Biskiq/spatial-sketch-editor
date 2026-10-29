# R217.S05 — Drafting state: implementation plan

**Slice:** R217.S05 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T1 · **Reviewers:** T2 (Scene snap
consumer), T3 (Camera framing requests) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Adds the grid, one snap fact, the Scale · Grid · Snap words and the 2D | 3D reading control, per
[PLATE §World authoring](../../../reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination).

## Prerequisite

R217.S04 is accepted, because the grid lies on Paper and the mat.

## Scope

1. **Grid.**
   - 1 m minor and 5 m major lines on the `1, 2, 5 × 10^n` ladder, with major five times minor.
   - Decimated by projected spacing: a target of at least 16 px, fading from 16 to 8 px, suppressed below 8 px.
   - Anchored to the floor datum with a stable origin across interval changes.
   - Drawn on Paper in 2D and as the mat grid in 3D.
   - Grid coordinates are display-only, and the grid never delays navigation.
2. **Snap fact.**
   - The host offers one snap fact: on or off, the increment in force, and a held modifier that suspends it.
   - Layout Ink and Scene placement read it through their adapters. Each domain keeps its own snap targets; the grid increment is one more target, and domains decide precedence.
3. **Drafting words** beside the reading control:
   - **Scale** opens detents and Fit all as Camera framing requests.
   - **Grid** and **Snap** each toggle their one fact and name the interval in force. A held suspending modifier is reflected in the word.
   - Off states are words, not colour alone.
   - Grid and snap configuration is reachable from the words and from the app menu's viewing preferences. Keep it to a small popover; the container is this slice's choice.
4. **Reading control.** A 2D | 3D segmented control. The ▾ is omitted until it holds a supported
   item, so there are no disabled entries.
5. **Scale bar.** It shows the scale at the target plane.
6. **Keyboard and coarse pointer.** Every control is reachable and announced, and gets a 44 × 44 px
   target on a coarse pointer.

## Not in scope

The Height Sheet (S06), eye level, elevations and the other readings behind ▾, rulers, and a
fourth drafting word.

## Acceptance criteria

1. **Grid:** decimation tests over a zoom sweep never draw spacing below 8 px, and the origin stays fixed across interval changes.
2. **Snap:**
   - with Snap on, a Line endpoint and an object placement land on the increment;
   - with Snap suspended or off, they do not;
   - domain snap targets still win where the domain says so.
3. **Session state:** grid and snap toggles are view state, in no Save payload and with no history entry.
4. **Scale:** detents and Fit all go through Camera framing; no shell code computes a pose.
5. **Accessibility:** the words name their state to assistive technology, and work by keyboard and touch.

## Verification

Affected Stage, Layout drawing and Scene placement contracts; then the complete merge gate in the
[test contract](../../../../apps/editor/tests/README.md#what-a-change-requires).
