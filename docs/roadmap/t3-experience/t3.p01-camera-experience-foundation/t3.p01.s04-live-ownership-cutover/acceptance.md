# T3.P01.S04 — acceptance record: Live ownership cutover (closed stub)

**AUTHORITY: NONE.** This is the compacted record of a closed slice. `T3.P01.S04` was accepted
2026-10-20 at `06a8aac8fa601de6c808c4d7014b6f360516e648`, shipped in PR #158 (merge commit
`9a457f6b`), and `T3.P01` closed the same day. This stub is the phase's declared final-gate artifact
at its routed path and the durability anchor for the owner-run activation. The accepted Phase A and
Phase B evidence, the review history, the admission/refusal matrix and the full residual list are
recoverable at the Git anchor below. Nothing here is planning authority or readiness.

```text
delivered      AM-9's clean source epoch in one implementation PR, in two phases.
               Phase A (T3-owned files): migration 005 that removes every authored row in one
               transaction under an advisory lock and fences `project_versions` structurally to
               `source_format = 'unit-envelope-v1'`; TD-6 single-runner migrations; TD-7
               ownership-before-lock on the unit Save; R2 purge fenced to a configured object
               namespace with a legacy-key refusal; API admission limited to declared F2 versions;
               publication gap R4 (`prepared-reader-required`, honest not-found); project-model
               migration/converter retirement and legacy flow-order removal; Guide-free
               Presentation lowering plus the visitor runtime rewritten as an Experience-program
               store over one interpreter; TD-9 working F2 sign-in Save recovery (pending-capture
               draft, route offers `resume-save`, never auto-runs).
               Phase B (caller migration): every landed T1/T2 current-source caller and unfinished
               requirement moved onto the unit adapters, the starter/empty boot emitting only F2,
               and the retired adapters removed with no reverse serializer or old-format reader.
contract       [AM-9 Shared Camera and Experience cutover](../../../../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover)
               supersedes AM-7. One Camera authority, Experience-owned editorial order, F.4 shared
               acceptance and Save, visitor isolation unchanged.
provenance     owner-ratified and authorized 2026-10-19 (T3 cutover record, R1–R5); Phase B started
               only after the batch C current-source freeze (PRs #156/#157/#159 merged).
               Independent implementation review ACCEPT on the integrated Phase A + Phase B
               implementation at `06a8aac8`; routine `slice-closeout` 2026-10-20; PR #158 merged as
               a P1 merge commit on 2026-10-20.
evidence       On the tree tested from implementation `75c59264` merged with `origin/main` `42d77b28`
               at `420dc2f3` (documentation-link repairs only afterwards): `npm run check` 0/0;
               `check:project-model`, `check:layout-core`, `check:camera-core`, `check:api` pass;
               `npm run build` and `npm run build:api` pass; `npm test` 169 files / 2,211 tests;
               `test:arch` 20 files / 166 tests; `test:heavy` 8 files / 118 tests; DB-backed
               `npm run test:api` 80 tests, 0 failures, **0 skips** on an isolated Compose project;
               migration-005 rehearsal seeded all six authored tables, cleared them, kept `users`,
               recorded versions 1–5 once, re-ran as a no-op and refused a pre-epoch insert (`23502`);
               `migration-fence.test.mjs` covers two concurrent runners.
               Journeys: A/B (guest 401 → captured F2 → signed-in 404 → explicit Resume → identical
               operation/precondition → saved; cancellation preserves source, selection, history and
               cloud base; delayed old admission loses to a newer Open), C (known model without a
               resource stays readable with `missing-resource`; F4 and Save refuse), integrated
               Place/Resize/Duplicate/Delete/Undo/Redo/Reload, Head Save/conflict/Reload, and the
               visitor Camera/reduced-motion suites.
post-merge     P1 merge verified after the fact: `9a457f6b` is a merge commit (parents `42d77b28`
               and `fd619ef1`); `git merge-base --is-ancestor f5147acad03ef5f856e12187666276ccd2de61ed main`
               and the plan body at that anchor both resolve; the accepted revision `06a8aac8` is an
               ancestor of `main`. The slice tag `closed/T3.P01.S04` is pushed.
entry points   implementation  packages/project-model/src/units/ (envelope, experience, runtime, save)
                               packages/project-model/src/save/
                               apps/api/src/ (app.ts, save-persistence.ts, migrate.ts, r2-purge.ts)
                               apps/editor/src/lib/visitor/
                               apps/api/migrations/005-clean-source-epoch.sql
               validation      apps/editor/src/lib/authoring/stage/source-admission.ts (host admission seam)
               regressions     apps/editor/tests/lib/project-model/units-conformance.test.ts
                               apps/editor/tests/lib/experience/experience-runtime.test.ts
                               apps/editor/tests/lib/visitor/visitor-cold-runtime.test.ts
                               apps/editor/tests/lib/authoring/spatial-route-resume-save.test.ts
                               apps/api/tests/migration-fence.test.mjs
                               apps/api/tests/save-units.test.mjs
activation     OWNER-RUN AND NOT EXECUTED. Merging S04 ran no migration against any deployed
               database. Sequence: migration 005, then the API and editor deploys, then
               `npm run purge:objects -w @biskiq/api`, then smoke checks. Activation uses a dedicated
               R2 bucket per environment; a reused bucket must first have its pre-namespace legacy
               keys removed from an independently verified inventory, because the purge refuses the
               whole bucket while any remain and never deletes a legacy key. The purge also refuses
               without the active epoch, while any `releases` row remains, on any key outside the
               configured namespace, and without list+delete. Recovery after activation rolls
               forward; a failed migration transaction leaves the prior state untouched. The
               step-by-step runbook is recoverable at the anchor below.
residuals      T4 owns the prepared public reader, so every public read answers not-found and
               Publish/Update return `prepared-reader-required`; catalogue model placement awaits
               r186 contact verification (K1); resource bytes stay host-asserted until storage
               verification; the envelope's `acceptedRevision` is baseline provenance, not revision
               authority; real Google OAuth was not exercised (external OIDC mocked only at its
               adapter boundary); the Card/Compose overlap seen in the browser run is carried to
               T1/S06 review; the authored Cut/Travel selector, presentation text, state and lifecycle
               homes move to T3.P02's F2 amendments. The full list is at the anchor.
recovery       git show fd619ef1d3a1bdff84b47199f4538c3b5a833fef:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/acceptance.md
               runbook/plan  git show f5147acad03ef5f856e12187666276ccd2de61ed:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md
               tag closed/T3.P01.S04 (pushed)
```

```text
CLOSEOUT PRESERVATION — T3.P01.S04, phase-close compaction (2026-10-20)
prose compacted:                 1   this gate artifact, stubbed at its own path (the plan and the
                                     superseded ratification draft were stubbed at slice closeout)
reference promotions:            0   AM-9 and R1–R5 already live in reference/composition-execution.md
                                     and the T3 cutover decision record
renderable evidence archived:    2 files / 183 KiB (archived at slice closeout; live evidence paths
                                     `evidence/browser-resume.png` and `evidence/browser-saved-reduced-motion.png`
                                     retained)
evidence stubs / manifests:      0
transient artifacts removed:     0
new live → archive prose links:  0
historical anchor:               fd619ef1d3a1bdff84b47199f4538c3b5a833fef · tag closed/T3.P01 (phase)
                                 · slice tag closed/T3.P01.S04 (pushed) → 1a286a10dfbdb81681215fa6ad06002abbabc9ab
manual-owed verification rows:   0 (bounded browser omissions recorded as limitations)
remaining deferred items:        7   activation (owner-run, unexecuted) plus the six product limits above
permanent stubs added:           1   (this phase-close compaction)
```

Recompacted 2026-10-20 by the `phase-closeout` documented in the phase README. The live evidence
shortcut listed above is preserved because the phase-close decision and the still-owed owner-run
activation both read this record.
