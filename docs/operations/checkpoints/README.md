# Checkpoints

Transient recovery state for unfinished work.

CREATE: only when substantial work is interrupted and expensive to reconstruct.
UPDATE: same task → same checkpoint.
RESUME: current.md points to the active checkpoint.
COMPLETE: promote durable findings, delete checkpoint, remove RESUME pointer.

NO:
- completed work
- duplicate checkpoint versions
- permanent project truth
- archived history
