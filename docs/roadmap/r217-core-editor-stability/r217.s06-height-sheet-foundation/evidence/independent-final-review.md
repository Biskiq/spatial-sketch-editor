# S06 — independent final implementation review

**Verdict:** ACCEPT FOR ROUTINE CLOSEOUT (2026-10-30). No remaining P0–P2 blocker.

**Reviewed branch base:** `e0ee1a58303b80d1f940541e0662feeb3c4b02aa`; current `main` `9e0827aa859bfba6a30413d4a1b1af5834695354`. Repairs are an additive working diff; all checkpoint commits remain intact. Exact production/test bytes are in [independent-branch-code-manifest.json](./independent-branch-code-manifest.json), SHA256 `2df14b406bc37a09b3e56eb2e0d3530063f21b979a437c8f0ff0ea19c564cf94`. The independently tested combined repair tree is identified by [independent-combined-code-manifest.json](./independent-combined-code-manifest.json), SHA256 `4af3911f81e8b98eb54c021b8f2d2212fd4b64be7d49443f9f77205ab9569604`. Documentation changes do not alter these code/test identities.

## Findings and approved criteria

- **P2, repaired:** the Sheet accepted another pointer and retained a press across reset. The control now matches pointer identity and observes same-height reset notifications. Mounted tests exercise secondary down/move/up, matching release and session.replace interruption.
- **P2, repaired:** Scene tick bounds ignored pitch/roll. The owner adapter now prefers mounted evaluated world bounds; tilted entities without authoritative bounds contribute no guessed tick. Upright evaluated/analytic fallback remains available.
- **Criterion 1, Plan/Paper:** real 0.9 m and 3 m Walls, Sheet 1.2 -> 0.6 -> 1.2 m, actual Paper streams. The low Wall is hidden -> cut -> hidden, matching unchanged Layout representation semantics; the plan's word projected was a terminology error. No evaluator/policy change.
- **Criterion 2, isolation/reset:** mounted drags, keys and pins preserve canonical Save bytes and F4 history; session replacement clears height/pins and retires a live press.
- **Criterion 3, real owners:** the production Layout and Scene adapters share one host containing a planner-created 1 m plinth and a 0.75 m table; disposing Scene removes only its table tick. This corrects missing evidence without an owner waiver.
- **Criterion 4, seam:** an independent probe role receives the same height; the module imports no consumer. The facade owns Plan-cut subscription and disposal.
- **Criteria 5–6, lens/access:** mounted tests retain height on World/Experience return, remove plane/tail on lens exit, cover keyboard increments, Page Up/Down, Home, snap naming and the coarse 44 px rule. Hover/focus/drag form one active union; reduced motion hides without a tail. Existing browser coarse-pointer/plane evidence was retained; this review additionally inspected production plane material, bounds and lifecycle wiring.
- **P3 residual:** the one-time hint flag is module-scoped and can span separate Stage sessions. It affects only hint repetition; it does not block these capabilities. It stays disclosed for the owning R217 follow-up.

Parent reruns: mounted Sheet/fact/owner files 79 tests; final owner-bound/facade/Layout/Shape contracts 68 tests. The final combined suite below includes every cumulative change.

## Final combined gates and integration

The combined tree was reconstructed from both owning branches' exact reviewed working diffs over checkpoint c0ad8e15. The checked code/test manifest still matched after verification. Both original merge orders produced the same checkpoint tree af3c3ba2; repaired shared-adapter patches apply cleanly and retain both tick and form-mark contributions. S08 object marks, S05 snap arithmetic and support admission were independently inspected and their contracts pass.

| Gate | Result |
| --- | --- |
| npm run test:full | 247 files / 3154 tests passed, including arch and heavy |
| Explicit npm run test:heavy | 11 files / 138 passed; heavy kernel code/tests unchanged by repairs |
| Explicit npm run test:arch after review docs | 23 files / 193 tests passed |
| npm run check | 0 errors, 0 warnings |
| npm run build | passed |
| check:layout-core, check:project-model, check:camera-core, check:geometry-core | all passed |
| check:api | passed |
| DB-backed test:api | 122 passed / 15 contracts / 0 skipped |

The API target was a task-owned postgres:16-alpine container (id f56df5848f19f4ca773509742777cabb2f3e385cbfe7dc811c844dcd010f5745), database biskiq on an ephemeral loopback port; it was stopped/removed. No external object store was touched. Package/API sources and tests are unchanged across these editor repairs, so their gate evidence remains applicable. The standalone architecture lane passed after final review documentation (23 files / 193 tests); the focused documentation gate was rerun after trimming two trailing Markdown spaces. Whitespace is checked against main 9e0827aa plus the complete working diff.

Recommended and owner-authorized merge order: S06 / #227, then S09 / #228. There is no outstanding substantive owner decision for these slices: the two mandatory fixture gaps are corrected, the claimed policy departures did not reproduce, and existing coordinator clarifications require no new planner, authority or deferred feature. Do not close the R217 phase or claim S11 acceptance.
