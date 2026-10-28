# T5.P01.S01 — closed acceptance record and preservation stub

**AUTHORITY: NONE.** This stub routes to the closed record preserved in Git. Current contract lives
in [Scene content](../../../../reference/components/scene-content.md#validation-and-transform-contract-current),
[persistence](../../../../reference/components/persistence.md) and the
[T5.P01 phase register](../README.md#slice-register); the phase README owns slice status, and the
[closed plan stub](./implementation-plan.md) keeps its approved scope at its own path.

## Acceptance and source identity

**Owner-override accepted 2026-10-28** for the implementation carried by PR #208 at product head
`7c3445e1` (the last commit touching `apps/`, `packages/` or `.github/`), documentation head before
compaction `a57588db` (the recovery anchor below), on trusted base `db7e5cd9` (main, the PR #209
merge; integrated at `c3743d44`). The status is `owner-override`, never `reviewed`.

The owner ruling, recorded verbatim on 2026-10-28:

> I approve an owner-override disposition for T5.P01.S01 / PR #208.
>
> The existing implementation, independently verified correctness checks, native Linux x64 CI results
> and reported browser acceptance are sufficient for this slice's acceptance.
>
> I accept the absence of some raw browser artifacts caused by the interrupted agent session. This
> does not constitute a claim that those artifacts were preserved or independently audited.
>
> Battery-mode performance verification is explicitly deferred to the next appropriate T5 integration
> slice. AC measurements remain diagnostic.
>
> Existing bundle-size exceptions remain in effect. No correctness requirement, including criterion 6,
> is waived.
>
> Update the acceptance record and PR description accordingly. No additional benchmarking is required
> for S01 closeout.

```text
STATUS      accepted by owner-override 2026-10-28; shipped through PR #208 under the P1 merge rule
TIER        architecture-integration (plan §CONSUMES / VERIFICATION)
ROUTE       ../t5.p01.s03-integrated-final-gate/acceptance.md
            the plan's declared integration route; it owes the integrated result and the battery rows
WAIVED      raw browser-artifact preservation and independent audit; review receipts at the final
            product head; a full-contract rerun at 7c3445e1
CARRIED     battery-mode performance → T5.P01.S03; AC diagnostics are not acceptance;
            Stage 439.0 KiB br exception (size only)
NOT WAIVED  every correctness criterion, including 6; no other gate
```

No review receipt and no test run at `7c3445e1` is claimed. The recorded lanes below belong to the
revisions named with them. The owner-override accepts that gap and the missing artifacts; it does not
turn an unrecorded row into a measured one.

## Delivered

Native forms as Scene truth. `@portfolio/geometry-core` evaluates an authored `extrude` source
exactly and deterministically into a closed, regioned mesh with bounds, XZ footprint and contact.
Scene unit format 4 carries the `form` entity through a strict reader, canonical writer and
validation; format 3 and malformed forms refuse. `create-form` and `set-form-size` plan through F4,
and Move, Turn, Place on floor, Duplicate and Delete work on forms while `resize-on-floor` refuses
them. Stage and Preview draw one cached result; production Plan footprints and 3D mounted-mesh hits
feed the existing Stage selection authority; Index and Head Find reach the same subjects; the Card
exposes the supported operations. Visitor isolation and the cold-release refusal are unchanged.
Full behaviour is owned by the references linked above, not by this record.

## Recorded evidence and its revisions

- **Native Linux x64.** GitHub Actions [run 40646896735](https://github.com/Biskiq/spatial-sketch-editor/actions/runs/40646896735)
  passed at `5e54ffb1` on Ubuntu 24.04, Node 22.23.4: 4 files / **142 tests** (7 smoke, 6 boundary,
  4 extrusion limits, 125 corpus incl. the 48 pinned goldens). Earlier run
  [40644483606](https://github.com/Biskiq/spatial-sketch-editor/actions/runs/40644483606) passed at
  `2caca9a6`. `packages/geometry-core`, `apps/editor/tests/lib/geometry-core` and the workflow are
  unchanged from `5e54ffb1` to `7c3445e1` (empty `git diff`); no later golden was regenerated.
- **API contract.** [api-tests.log](./evidence/option-b/api-tests.log): 14 suites / 115 tests,
  0 failed, **0 skipped**, against real Postgres.
- **Full merge-gate contract at `a1ded6a3`** (the revision the recorded table belongs to): `npm test`
  223 files / 2,850 tests; arch 23 files / 188 tests; heavy 11 files / 138 tests; `npm run check`
  0 errors / 0 warnings; production build clean; `check:geometry-core`, `check:project-model`,
  `check:layout-core`, `check:camera-core` and `check:api` clean. No rerun of that contract at
  `7c3445e1` is recorded or claimed.
- **Branded Chrome preservation.** [preservation.log](./evidence/option-b/preservation.log): 7/7
  T1 S02/S03 scenarios passed in 56.8 s. The earlier concurrent-load attempt
  ([attempts/preservation-concurrent-load.log](./evidence/option-b/attempts/preservation-concurrent-load.log))
  failed one collinear-pointer assertion and skipped the next row; the isolated rerun passed with
  camera settling and a projection trace, and no refusal or no-write assertion was weakened. Both
  attempts are retained.
- **Option B browser journey.** A full journey — Stage pointer selection in both readings, both
  generator planes, Index and Find, every supported Card operation, Undo/Redo, API-backed Save and a
  fresh-context reopen — was reported as exercised during the implementation session. Its raw
  screenshots, video and ledgers are **not preserved**; the interrupted session lost them. The owner
  accepts their absence and does not claim they were independently audited.
- **Diagnostic CPU timings.** [native-form-evaluation.json](./evidence/option-b/native-form-evaluation.json)
  (darwin arm64, Node 26.7.0; 30 warm-up + 200 samples): 32-anchor cold-source p95 **0.171 ms**,
  256-anchor p95 **0.626 ms**; at 32 anchors host `create-form` p95 **3.23 ms** and `set-form-size`
  p95 **2.82 ms**. These are CPU measurements inside the ≤ 4 ms S row; they do not claim renderer
  presentation, and the file records no power state. The long-task windows are in
  [attempts/](./evidence/option-b/attempts/).
- **Stage bundle.** 439.0 KiB JS Brotli was reported in-session against the 425 KiB hard row. No
  bundle report is preserved. The owner's explicit Stage-only exception to **439.0 KiB** remains in
  effect; CSS-inclusive delivery and the visitor `/p` target are different rows.

## Criteria

| # | Criterion | Disposition |
| --- | --- | --- |
| 1 | Corpus closure and typed refusals | verified at the recorded revisions |
| 2 | Pinned goldens, deterministic arithmetic, import boundary | verified on native Linux x64 and macOS arm64; 48 goldens unchanged, none regenerated |
| 3 | Scene 4 canonical read/write and strict refusal | verified |
| 4 | Planners, supported operations and record scope | verified through host and running Card |
| 5 | Undo/Redo, Save and reopen exact | verified including a fresh browser context (reported journey) |
| 6 | Stage, Plan and Preview draw and select the same result | **not waived**; verified per each surface contract from the reported browser acceptance; Preview keeps visitor isolation and return preserves Stage selection |
| 7 | Visitor isolation, package direction, cold refusal | verified |
| 8 | Performance evidence | AC diagnostics only; battery verification deferred to `T5.P01.S03`; Stage exception in effect |
| 9 | Complete repository verification | full contract recorded at `a1ded6a3`; native x64 and API rows above at theirs; no rerun at `7c3445e1` is claimed; owner-override accepts |
| 10 | Reference updates | Scene content, persistence, architecture and assets describe the landed behaviour in this PR |

## Deferred, residuals and ownership

- **Battery-mode performance** → `T5.P01.S03`, the plan's declared integration route. AC values stay
  diagnostic and are not a pass. Reference Laptop A was unavailable; the measurements are from the
  designated MacBook Air M2 (Mac14,2), 16 GB, macOS 15.8.2, Chrome 156.0.8078.48, Low Power Mode off.
- **Stage 439.0 KiB br exception** remains an explicit, Stage-only size exception. It waives no
  correctness row and amends no other budget.
- **Visitor `/p` first-load** remains under its T4 hard row; its current miss is recorded, not
  accepted here.
- **Closing side-quad texture seam** remains the documented low-priority renderer limitation.
- **No drawing entry point in S01**; the Ink Shape reading and per-axis size handles are S02's.
- **S01 supplies no phase gate**; S03 owns the integrated proof for S01, S02 and S04.

## Entry points

```text
kernel          packages/geometry-core/src/{profile,extrude,predicates,digest}.ts
Scene truth     packages/project-model/src/scene.ts
                packages/project-model/src/scene-codec/{parse-entities,canonical}.ts
                packages/project-model/src/units/{types,validate,envelope}.ts
planners        packages/project-model/src/scene-planning/{form,planners,operations,record-scope}.ts
evaluation      apps/editor/src/lib/content/form-evaluation.ts
renderer        apps/editor/src/lib/museum/entities/{EntityForm.svelte,form-geometry.ts}
Plan / 3D hit   apps/editor/src/lib/authoring/scene/{plan-scene-footprint,plan-scene-hit,scene-pick-source}.ts
Stage seam      apps/editor/src/lib/authoring/adapters/scene.adapter.ts
                apps/editor/src/lib/authoring/stage/{stage-facade.ts,source-admission.ts}
Card            apps/editor/src/lib/authoring/adapters/scene/{form-card.ts,form-card-command.ts,FormCardFields.svelte}
visitor         apps/editor/src/lib/visitor/{VisitorEntityGroups.svelte,visitor-cold-runtime.ts}
validation      .github/workflows/native-form-goldens.yml
                apps/editor/perf/flows/native-form-acceptance.spec.ts
regressions     apps/editor/tests/lib/geometry-core/{profile-corpus,geometry-core-boundary,extrude-limits,geometry-core-smoke}.test.ts
                apps/editor/tests/lib/content/{form-evaluation,scene-form-codec}.test.ts
                apps/editor/tests/lib/authoring/{scene-editing-surface,stage-facade,scene-operation-acceptance}.test.ts
                apps/editor/tests/lib/authoring/scene/plan-scene-form-footprint.test.ts
                apps/editor/tests/lib/visitor/visitor-cold-runtime.test.ts
                apps/api/tests/save-units.test.mjs
```

## Recovery

```text
git show a57588db80def9671ea92e80beac0b7ebc68df1e:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/acceptance.md
git show a57588db80def9671ea92e80beac0b7ebc68df1e:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/acceptance-a1ded6a3.md
git show a57588db80def9671ea92e80beac0b7ebc68df1e:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/implementation-plan.md
anchor  a57588db · tag closed/T5.P01.S01 (local only — not pushed)
archive docs/archive/roadmap/t5-expressive-geometry/t5.p01.s01-native-form-source-and-evaluation/evidence/shadow-form/CLOSED.md
MERGE   PR #208 must land as a merge commit (no squash, no rebase) so the anchor stays reachable.
        After merge: git merge-base --is-ancestor a57588db main
                     git show a57588db:<the acceptance path above> | head -3
        Not run before the owner's merge.
```

## Preservation report

```text
CLOSEOUT PRESERVATION — T5.P01.S01 (2026-10-28)
prose compacted:                 3   acceptance, dated baseline and implementation plan → stubs at their own paths
reference promotions:            0   the slice's four reference updates landed with implementation
renderable evidence archived:    3 files / 147,792 bytes (144.3 KiB)   the shadow-form PNGs, byte-identical copies
evidence stubs / manifests:      1   CLOSED.md at the archived bundle
transient artifacts removed:     0   the failed preservation attempt and long-task windows are retained evidence
historical anchor:               a57588db · tag closed/T5.P01.S01 (local only — not pushed)
new live → archive prose links:  0
manual-owed verification rows:   1   battery-mode performance — deferred to T5.P01.S03, distinct from every automated row
remaining deferred items:        4   battery rows (S03); Stage 439.0 KiB br exception; visitor /p T4 target;
                                     closing side-quad texture seam
permanent stubs added:           3   one per closed prose artifact
```

P1 preservation also requires the post-merge ancestry and full-body recovery checks above. They were
not run before the merge and are owed to the owner's merge.
