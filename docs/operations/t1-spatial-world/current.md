# T1 — Spatial world: current baton

```text
PHASE: R217 Core Editor Stability (shared repository phase). S01–S10 shipped; S11 remains the FINAL PHASE GATE.
ACTIVE: R217.S12 Camera basis (D23) under the convergence campaign. Branch r217/s12-camera-basis, patch base 730bc710. Writer: convergence integrator (T1 viewport authority). Shared files: packages/camera-core/src/viewport.ts and the camera viewport test; no other slice is active.
NEXT: independent T3 Camera/Experience review of the implementation PR; then fix and re-review until clean, S12 closeout, self-check and the P1 merge. S13 starts only after that merge and anchor verification.
BLOCKER: None.
BOUNDARIES: One active implementation slice. Architecture ownership unchanged: Camera pose/clip/basis stays T1's in packages/camera-core/src/viewport.ts. S12 changes only the Plan up vector; no Plan-specific basis, planner, persisted-format or owner-ruling change.
CARRY: T1 maintenance retains the one-frame lowerColumnHeight observation; S06 TD-15 owns the module-scoped Height hint repetition residual; S06 FO-1 … FO-5 and T1 deferred-retirement rows remain in their records; S03 real-browser multi-touch capture ordering remains manual-owed. S04 carries the Opening swing representation gap and settled Shaded Plan restyle. S07 defers Wall height and thickness grips.
ROUTES: ../../roadmap/r217-core-editor-stability/README.md · ../../roadmap/r217-core-editor-stability/post-s10-convergence/execution-plan.md · ../../roadmap/r217-core-editor-stability/r217.s12-camera-basis/implementation-plan.md · ../../operations/tech-debt/README.md#td-14 · ../../reference/architecture.md#editor-interaction-authorities
```
