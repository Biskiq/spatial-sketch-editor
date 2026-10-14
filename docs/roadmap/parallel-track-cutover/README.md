# R115 — PR #115 architecture reset (repository phase)

**Phase:** R115 · **Status:** in-progress · **Registered in** the
[track register](../README.md#track-register) as a repository phase, not a track.
**Sole child:** `R115.S01`. **Baton:** [`../../operations/current.md`](../../operations/current.md)

```text
SCOPE: the frozen-lane isolation, aggressive pruning and parallel-track cutover of PR #115
PACKAGES: R115.S01's ordered packages are WP0 → WP1 → WP2 → WP3 → WP3R → WP3T → WP4 → WP5 →
          WP6 → WP7 (implementation-plan.md §12)
NOT: capability implementation · an F interface encoding · a Baseline declaration
```

The phase owns its child's status, order and dependencies. Its plan is
[`implementation-plan.md`](./implementation-plan.md); its recorded manifests, evidence and
closeout are [`acceptance.md`](./acceptance.md).

## Slice register

| Slice | Status | Consumes | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- |
| R115.S01 | in-progress | — | — | [implementation-plan.md](./implementation-plan.md) | [acceptance.md](./acceptance.md) | owner-authorized 2026-10-13; implementation execution authorized through WP7, WP6 re-review owed |

- **Consumes** is empty: the reset consumes no gate version. Every gate in the
  [gate register](../README.md#gate-register) is still `undrafted`, correctly.
- **Effects** is empty: this phase performs no Camera authoring migration.

```text
FINAL PHASE GATE: R115.S01 → ./acceptance.md

PHASE CLOSE
Stage:        active
Closed:       — (owner invocation pending)
Final gate:   R115.S01 → ./acceptance.md
Preservation: written on closure by the phase-close procedure; the final-gate artifact is the
              accepted record above
```

`slice-closeout` closes `R115.S01`; closing the final child makes this phase `closable` and
stops. Closing R115 itself is a separate, owner-invoked `phase-closeout` step, and it writes
this file plus the track-register row — R115 has no track whose phase row it would write
instead.
