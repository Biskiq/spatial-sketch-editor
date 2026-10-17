# AM-5 conformance reconciliation and bounded completion — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. The acceptance contract is the approved plan (recovered via
           the anchor below and summarized in [acceptance.md](./acceptance.md)); current truth lives
           in the phase README's slice register, the gate register and
           [capability-viewport-projection-v1.md](./capability-viewport-projection-v1.md).
STATUS:    2026-10-17 · PR #137 · owner-approved bounded completion — implemented, reviewed, verified
           and accepted; compacted to this stub at slice closeout.
ROLE:      review-chronology and disposition record for the AM-5 completion.
NOT:       product contract · status store · authority for declined or residual capabilities.
```

## What it recorded (summary)

The owner-approved, backward-compatible bounded amendment completed the three AM-5 requirements the
landed seam lacked, and each was implemented, exercised and accepted:

1. **Source-independent accepted read boundary** — `stage/accepted-read.ts` is the common snapshot;
   `current-stage-source.ts` is the explicit current adapter, refusing a wrong kind/version rather
   than decoding. Every in-repo caller migrated; the domain read still publishes exactly the
   interface rows' Layout/Scene projections.
2. **F.1 ordered selection and primary identity** — `stage/semantic-selection.ts` holds ordered F.1
   entries with one explicit primary and canonical dedup; the retained Layout helpers are projections,
   not a second store.
3. **Lens/task exit lifetime** — the session parks the task, then cancels task/gesture/command/Camera
   writers exactly once; `resumeTask` requalifies the target and never restores selection, view or
   proposals; the host registers pending accepts/restores as command writers.

Review findings from four independent rounds were fixed in `4127b63f`, `4c831fc5`, `933bf285` and
`ab8504aa`, never argued away, and the durable conclusions (recorded limits, refusal semantics,
browser-found UI defects and their fixes) are preserved in
[acceptance.md](./acceptance.md#known-limits) and the router's acceptance record.

## Recovery

```text
git show bfd6cc183b781e0fcc51b07032e5cd29f5e13365:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/am5-reconciliation.md
anchor bfd6cc183b781e0fcc51b07032e5cd29f5e13365 · tag `closed/T1.P01.S07` (target d1c93d47d6da57bb1e370aecf1d5c7fff901877a; local only — not pushed)
REQUIRED MERGE METHOD — P1: PR #137 must land as a merge commit (no squash, no rebase) so this
anchor stays reachable on `main`.
```
