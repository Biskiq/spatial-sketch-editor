# Checkpoints

Transient recovery state for unfinished work. The `work-checkpoint` skill owns the
procedure; this file records the convention and the boundary.

```text
CREATE: only when substantial work is interrupted and expensive to reconstruct.
UPDATE: same task → same checkpoint.
RESUME: the owning track's baton points to the active checkpoint.
COMPLETE: promote durable findings, delete the checkpoint, remove the RESUME pointer.
```

**Not authority.** A checkpoint is neither status nor durable knowledge: product
status lives in [`docs/roadmap/README.md`](../../roadmap/README.md), the baton in the
owning track's `operations/<track>/current.md` (routed from
[`docs/operations/current.md`](../current.md)), and landed truth in
[`docs/reference/`](../../reference/). Nothing is promoted out of a checkpoint by
being written there — promotion is a separate, reviewed edit to the owning document.

**Record what cannot be re-derived.** A checkpoint carries the track/phase/slice
identity and the resume route, plus:

- which **verification tier** actually ran, with its tested revision (commit or tree)
  and the working-diff identity at that time;
- the integration gate it still owes, if any.

A focused green run is never inherited as full acceptance: a checkpoint that recorded
only a focused run says so, and the required acceptance run is still owed (see
[`apps/editor/tests/README.md`](../../../apps/editor/tests/README.md) → "What a change
requires").

```text
NO:
- completed work
- duplicate checkpoint versions
- permanent project truth
- archived history
- pasted command output as a substitute for the tested revision
```
