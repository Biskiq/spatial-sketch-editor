# T1.P01.S07 — implementation plan — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register,
           the gate register and the slice's accepted capability record.
STATUS:    ACCEPTED 2026-10-17 (PR #137). Owner-authorized 2026-10-17 (D1–D4,
           [record](../../../../reference/decisions/next-batch-authorization-2026-10-17.md)).
           The host wiring and the owner-approved AM-5 completion passed four review rounds and the
           complete gate; routine `slice-closeout` replaced the approved plan body with this stub.
ROLE:      recovery and orientation stub for T1.P01.S07.
NOT:       product contract · status store · active plan.
```

## Delivered

The Stage↔F4 integration bridge — the smallest route out of the viewport-readiness cycle (owner
ruling D1):

- the live host↔F4 wiring (one accepted install per project epoch, host Undo/Redo commands with
  visible reasons, replacement baseline, accepted-correspondence selection requalification,
  Camera-output rebase), moved here from S04 by ruling D2;
- adapter-owned planner registration, intent submission and per-install re-binding with exact one-time
  disposal of the previous binding;
- the AM-5 contribution points the landed seam lacked, completed by the owner-approved bounded
  amendment (encoding-neutral accepted read, F.1 ordered selection, lens/task parking with writer
  cancellation and explicit revalidated Resume) — see the reconciliation stub;
- the acceptance evidence for `T1.viewport-projection@1:viewport-projection-v1`
  ([capability record](./capability-viewport-projection-v1.md)), provider `T1.P01.S02` unchanged.

It declared no new gate, gate version, capability scope, F amendment or authored format, and installed
no production Layout or Scene writer. The slice does **not** consume `T1.viewport-projection@1`.

## Contract

- Accepted outcome and gate numbers: [`acceptance.md`](./acceptance.md)
- Accepted capability: [`capability-viewport-projection-v1.md`](./capability-viewport-projection-v1.md)
- AM-5 bounded completion: [`am5-reconciliation.md`](./am5-reconciliation.md)
- F.1/AM-5 shapes: [`../../../../reference/composition-execution.md`](../../../../reference/composition-execution.md)

## Residuals

```text
integration   the declared integration route stays ../t1.p01.s06-integrated-final-gate/;
              S04–S06 remain proposed and unauthorized
later scope   Head Save stays with S04 (ruling D3); narrower instrument-services typing and the two
              recorded task-lifecycle asymmetries are named limits, not follow-on defects owed here
```

## Recovery

```text
git show 24671264110ba1a55864e0e63b6e91669bd2458c:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/implementation-plan.md
anchor 24671264110ba1a55864e0e63b6e91669bd2458c · tag `closed/T1.P01.S07` (target d1c93d47d6da57bb1e370aecf1d5c7fff901877a; local only — not pushed)
REQUIRED MERGE METHOD — P1: PR #137 must land as a merge commit (no squash, no rebase) so this
anchor stays reachable on `main`. Verify after merge:
  git merge-base --is-ancestor 24671264110ba1a55864e0e63b6e91669bd2458c main
```
