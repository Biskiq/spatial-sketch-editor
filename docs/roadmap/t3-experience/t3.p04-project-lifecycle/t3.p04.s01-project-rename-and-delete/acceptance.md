# T3.P04.S01 — Project rename and delete: accepted

**Status:** shipped; accepted 2026-10-25. This is T3.P04's declared **FINAL PHASE GATE**. The
slice is accepted and the phase is **CLOSABLE, still active**; the owner phase-close decision is
pending. No phase closure, track completion, cycle transition, deployment or F2 production epoch
activation is recorded here.

**Plan:** [implementation-plan.md](./implementation-plan.md) · **Phase:** [T3.P04](../README.md) ·
**PR:** [#191](https://github.com/Biskiq/spatial-sketch-editor/pull/191) · **Accepted
implementation review:** [final independent review](https://github.com/Biskiq/spatial-sketch-editor/pull/191#pullrequestreview-5644765570),
covering head `550f8a9ba15779e8181c437db2b9bd8fdeee793b`; it records no open correctness findings.
The T1 shell prerequisite ([review 5643884439](https://github.com/Biskiq/spatial-sketch-editor/pull/191#pullrequestreview-5643884439))
and T2 shared API prerequisite ([review 5643653030](https://github.com/Biskiq/spatial-sketch-editor/pull/191#pullrequestreview-5643653030))
are satisfied. The closeout invocation is the owner's combined acceptance-and-closeout act.

## Accepted outcome

| Approved criterion | Outcome and evidence |
| --- | --- |
| Rename uses the owner-scoped saved-base precondition, appends exactly one immutable version, preserves older revisions, and leaves no-op renames unchanged | Accepted. Full API suite and integrated Hub/Stage journey pass; lifecycle API coverage includes immutable history and no-op behavior. |
| Invalid, anonymous, cross-owner and stale rename requests refuse without minting a version; ambiguous/stale recovery preserves the draft and allows the next Save | Accepted. Full API/editor suites and integrated journey cover privacy, validation, stale/ambiguous recovery, dirty rename through Undo/Redo/Save/reopen and stale route responses. |
| Rename/Save/delete races serialize; conflict recovery retains dirty work; project replacement rejects stale responses | Accepted. API lifecycle/lease contracts and editor route/session regression tests pass; integrated journey exercises dirty-draft preservation and stale response after project switch. |
| Confirmed delete retires project versions, staging and approved resources; object-store/transaction failures compensate or remain durably pending and retryable | Accepted. Fresh DB API suite passes cleanup, failure-injection and retry coverage; integrated browser/API journey demonstrates pending cleanup, retry, idempotence and owned-key removal. |
| All three object writers are fenced; lease revocation aborts in-flight writes; delete-first blocks new writes; failed upload/finalize/approval leaves no orphan | Accepted. API tests exercise asset upload, model staging and model approval through the lease, deadline, revocation and compensation paths. |
| Late-write and hostile post-completion variants never make an unverifiable completion claim; a late visible key is repaired and spaced re-proof is required | Accepted. API lifecycle tests cover the enforced deadline, cleanup restart, late hostile commit detection and completed-record verification/repair. |
| Multi-source inventory and retained-source backfill enumerate exact keys; `sweep-dependent` remains explicit; absent-key deletion is idempotent | Accepted. Fresh DB API suite covers multi-source approval, persisted inventory/backfill, scoped sibling survival and idempotent cleanup. |
| Cleanup proof ignores sibling keys and keeps later-visible owned keys pending until the bound and two scoped empty listings have elapsed | Accepted. API cleanup tests cover project-prefix scoping, delayed visibility and spaced proof; integrated cleanup evidence confirms sibling survival. |
| Active publication refuses deletion; after unpublication, the project and retained inactive publication/release are removed and the public link stops resolving | Accepted. API publication tests and integrated browser/API journey cover active refusal, unpublish-then-delete and inactive-link removal. No publication UI or activation was added. |
| Other projects/owners survive, including identical-content model resources and historical-version resources | Accepted. API isolation/inventory tests and integrated process-local store manifest prove owned-key removal while same-content sibling bytes survive. |
| Project list and current-Head actions, dirty cancellation, conflict recovery, source download, refresh, keyboard and narrow/coarse-pointer journeys | Accepted within the approved T1 patch. Integrated headed Chrome journey covers Hub/Stage actions, cancellation, source download/list refresh, keyboard focus and 320×800 coarse-touch behavior. No separate screen-reader audit was required or run. |
| Conditional Save, import approval, visitor/public/Preview isolation and epoch fence remain green | Accepted. The refreshed complete editor, architecture and heavy suites pass; existing integration evidence covers Save, import, Preview and public/visitor boundaries. No publication or epoch activation was attempted. |
| F9 rename/next-Save responsiveness with a retained model | Accepted under the recorded owner ruling. The fresh branded Chrome run uses grid-7 M (112 walls, 112 openings, 49 rooms) and one retained minimal GLB source/derivative. All 60 Save-owned work samples are below 50 ms; all six presented-feedback p95 values are below 100 ms; all receipt samples meet their payload-derived N1 targets. AC/battery and automated-operator differences are explicitly waived for this slice. The fixture is lifecycle retention proof, not a typical M catalog workload; browser compositor feedback is not physical panel scanout. |

## Final integrated gate — 2026-10-25

All rows below were run after the last production-code change, at `550f8a9ba15779e8181c437db2b9bd8fdeee793b`
(tree `119d21264f215a20d9b10faa85307084780f0540`), with a clean worktree. The final gate refreshed
the exhaustive plan tier after the optional save-attribution instrumentation change.

| Gate | Result |
| --- | --- |
| Complete editor suite (`npm run test -w @portfolio/editor -- --maxWorkers=4`) | 191 files; 2,464 passed, 0 failed, 0 skipped |
| Architecture (`npm run test:arch`) | 22 files; 178 passed, 0 failed, 0 skipped |
| Heavy (`npm run test:heavy`) | 9 files; 125 passed, 0 failed, 0 skipped |
| Root editor check (`npm run check`) | Passed; 0 errors, 0 warnings |
| Root editor build (`npm run build`) | Passed; existing nonfatal Vite externalization/unused-import warnings only |
| Affected package checks (`check:camera-core`, `check:layout-core`, `check:project-model`) | All passed |
| API check (`npm run check:api`) | Passed |
| DB-backed API suite (`npm run test:api`) | Passed; 114 passed, 0 failed, 0 skipped |

The API run created `biskiq_t3p04s01_gate_20261025_1505` against the already-running local
PostgreSQL service, using no new service, production database, R2 connection or shared S06 database.
The shell exit trap dropped the fresh database; a post-run `dropdb --if-exists` confirmed it was
absent. Exact gate metadata is in [final-integrated-gate.json](./evidence/2026-10-25/final-integrated-gate.json).

The earlier integrated browser/API lifecycle journey and the corrected F9 evidence remain linked in
the [verification record](./evidence/2026-10-25/verification.md) stub and its evidence directory.
That journey used a private disposable database and a process-local object store. The fresh exhaustive
gate above separately covers current code; no unchanged browser or benchmark run was repeated.

## Residuals and scope

No acceptance blocker remains. The accepted implementation retains an owner-run cleanup/recovery
entry point for completed deletion tombstones; cleanup does not claim that an uncooperative remote
store can never complete a delayed write, and verification repairs a late visible key. There is no
background cleanup service. Real R2, production data, deployment, publication activation, public
delivery, S06 completion and F2 epoch activation were outside this slice and were not exercised.
The one-model M fixture and browser presentation proxy limitations above remain explicit evidence
boundaries, not waived numeric F9 misses.

## Closeout preservation

```text
CLOSEOUT PRESERVATION — T3.P04.S01 (2026-10-25)
prose compacted:                 6   stubs at their own paths
reference promotions:            1   current project lifecycle behavior → reference/components/persistence.md
renderable evidence archived:    21 files / 1.9 MB
evidence stubs / manifests:       1   CLOSED.md in the evidence archive bundle
transient artifacts removed:     0
historical anchor:                550f8a9ba15779e8181c437db2b9bd8fdeee793b · tag closed/T3.P04.S01 (pushed)
new live → archive prose links:   0
manual-owed verification rows:    0
remaining deferred items:         0 slice blockers; phase-close decision remains owner-owned
permanent stubs added:            6   the owner-ratified cost: one per closed prose artifact
```

Preserved entry points: project lifecycle API/client and session integration under `apps/api/src/`,
`apps/editor/src/lib/platform/`, `apps/editor/src/routes/projects/` and
`apps/editor/src/routes/project/[projectId]/spatial/`; validation and regressions under
`apps/api/tests/` and `apps/editor/tests/`. The closeout preservation report and live gate evidence
remain here because this artifact is the phase's final-gate record.
