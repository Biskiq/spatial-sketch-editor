# T1 — Spatial world: current baton

PHASE: T1.P01 — in progress; S06 remains unaccepted, phase not closable.
ACTIVE: PR #168, branch T1-P01-S06; implementation/test revision `d63bdb6c`; inspect Git for final head.
RESUME: ../checkpoints/t1-p01-s06-takeover.md
NEXT: Owner reviews the pushed implementation and evidence; only after acceptance run slice-closeout.

The owner ratified TD-11/12 and separately approved the Index-selection correction. Reading changes
now preserve the exact paused request with Resume/Discard. Browser fixtures and supported empty
numeric-plinth placement/reopen have evidence in the S06 acceptance record.

Final gate on `d63bdb6c`, October 21, 2026: check 0/0, build and all affected package/API checks pass;
full 170 files / 2,227; arch 20/166; heavy 8/118; local DB-backed API 80 passed / zero skips. The final
documentation update reruns arch. The owner requested no further independent review and will review
the pushed result themselves. No slice-closeout, phase closure, architecture verdict or merge occurred.

BOUNDARIES: T1 owns only host/route/regressions; T3.P02 remains independent. Card-over-Compose is the
existing T1 shell residual; plinth resizing is not claimed. Full matrix, warnings and noisy workload
observations live in the acceptance record. Preserve completed Save/conflict/Reload/TD-9 evidence.
