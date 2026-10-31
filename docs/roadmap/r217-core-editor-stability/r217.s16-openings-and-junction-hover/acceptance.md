# R217.S16 — acceptance record (closed)

**AUTHORITY: NONE.** R217.S16 shipped 2026-10-31 via [PR #237](https://github.com/Biskiq/spatial-sketch-editor/pull/237). The phase [slice register](../README.md#slice-register) owns status; [R217.S11](../r217.s11-integrated-final-gate/acceptance.md) owns integrated campaign acceptance.

## Delivered

Plan-only Opening-over-host selection, Opening slide/resize and Plan-only Junction hover/drag shipped. Door swing and 3D Junction hover remain outside scope. The landed interaction contract is recorded in [architecture](../../../reference/architecture.md#editor-interaction-authorities). The full criteria, browser journeys and verification record are recoverable at the acceptance anchor below. Archived screenshots: [evidence manifest](./evidence/CLOSED.md).

## Acceptance and verification

Owner combined acceptance-and-closeout instruction: 2026-10-31. The owner directed one review only and waived a second independent review after the bounded repair. This is an explicit per-revision **owner-override** for `0a32f53e086d13477e85e581bdfdcd727753c751`; no criterion or verification row was waived. The independent review's four P2 findings were fixed, and the fresh diagnostic review's two merge-gate blockers were repaired at the accepted revision.

Recorded at `0a32f53e086d13477e85e581bdfdcd727753c751`: full `npm test` 255 files / 3,274 tests; architecture 23 / 194; check and build passed; package/editor/API checks passed; DB-backed API 128 tests / 15 contracts passed with zero skips. The heavy 400-Room case passed in 62.9 s with the unchanged 24 edits and assertions. An earlier concurrent-run internal RPC failure is documented in the full record and excluded from the green result. The documentation closeout gate passed 56/56 tests.

S11 still owes integration, coarse pointer, native touch, Safari and integrated journeys. No S17 work started during this closeout. Browser evidence predates the final bounded repair; no new browser journey is claimed.

P1 merge commit: `4d13b89381c34c74165b50319b42ad94f5ec9e10` (PR #237; merge commit method).

## Recovery and preservation report — 2026-10-31

```text
prose compacted:                 2   approved plan and acceptance record -> stubs at their own paths
reference promotions:            0   landed architecture is already in docs/reference/architecture.md
renderable evidence archived:    30 files / 1,972,640 bytes
evidence manifest:               docs/archive/roadmap/r217-core-editor-stability/r217.s16-openings-and-junction-hover/evidence/CLOSED.md
transient artifacts removed:     0
historical anchors:              plan 050a30d9418a9a910a320388ae2ea4d879f1b34c; acceptance 0a32f53e086d13477e85e581bdfdcd727753c751; tag closed/r217.s16 (pushed to origin)
new live -> archive prose links: 0
manual-owed verification rows:   4 categories carried by S11: coarse pointer, native touch, Safari, integrated journeys
remaining deferred items:        S11 integration/manual journeys; door swing and 3D Junction hover remain outside S16
permanent stubs added:           2   approved plan and acceptance record
```
