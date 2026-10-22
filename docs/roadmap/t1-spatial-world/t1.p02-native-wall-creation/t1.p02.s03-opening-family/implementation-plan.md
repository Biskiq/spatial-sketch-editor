# T1.P02.S03 — Opening family: outline plan

**Slice:** T1.P02.S03 · **Status:** proposed — **not authorized**; it starts only from its own owner
authorization after `T1.P02.S02` is accepted · **Phase:** [T1.P02](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T1](../../README.md) · **Runbook:**
[T1 operations](../../../../operations/t1-spatial-world/README.md) · **Design:**
[shell draft](../shell-draft.md#opening-s03)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
```

This is an **outline** registered with the phase (batch E, E1). The complete plan is written after
S02's acceptance and is reviewed with this slice's own authorization. Nothing here is implemented,
authorized or evidenced.

## Outline scope

- Wire layout-core's existing Opening create and delete planners as F4 Layout planners.
- The Opening family on the S02 rail: place an Opening on a Wall with host preference, and remove it.
  An Opening that cannot fit its host refuses in words with a repair.
- Deleting a Wall still takes its Openings in the same undo step, as the drawing policy requires.

## Outline acceptance

1. Add and remove an Opening on drawn and starter Walls, with Undo/Redo, Save and reload keeping
   identities, and Plan and 3D agreeing on the void and caps.
2. Host refusal and Wall-deletion consequences match the drawing policy.
3. F4 commit and F8 Undo/Redo for Opening edits at S and M, on the designated reference machine (MacBook Air M2, 16 GB; batch E, E6 amendment).

Excluded: Opening kinds beyond the landed ones, curved hosts and attachments.
