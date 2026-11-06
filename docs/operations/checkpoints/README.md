# Checkpoints

Transient recovery state for unfinished work. The `work-checkpoint` skill owns the
procedure; this file records the convention and the boundary.

```text
CREATE: only when substantial work is interrupted and expensive to reconstruct.
UPDATE: same task → same checkpoint.
RESUME: the active draft pull request/task/handoff points to the checkpoint.
COMPLETE: promote durable findings, delete the checkpoint, clear the explicit pointer.
```

**Not authority.** A checkpoint is neither status nor durable knowledge: product
status lives in [`docs/roadmap/README.md`](../../roadmap/README.md) and computed
`npm run status`, claims in the active draft pull request or issue, and landed
truth in [`docs/reference/`](../../reference/). Nothing is promoted out of a
checkpoint by being written there — promotion is a separate, reviewed edit to the
owning document.

**Record what cannot be re-derived.** A checkpoint carries the task identity and
resume route, plus:

- what verification actually ran, with its tested revision (commit or tree) and
  the working-diff identity at that time;
- the acceptance it still owes, if any.

A focused green run is never inherited as full acceptance: a checkpoint that
recorded only a focused run says so, and the required acceptance run is still
owed (see [`apps/editor/tests/README.md`](../../../apps/editor/tests/README.md) →
"What a change requires").

```text
NO:
- completed work
- duplicate checkpoint versions
- permanent project truth
- archived history
- pasted command output as a substitute for the tested revision
```
