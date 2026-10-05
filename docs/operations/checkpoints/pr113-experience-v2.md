# PR #113 Experience V2 — checkpoint

TYPE: implementation / verification (C9 continuation)
STATUS: C9.1–C9.3 implemented; five external MP2 review blockers repaired and verified, and
the review's folded second-pass findings (station activation contract, cue-scope consistency,
remaining-work edge cases, stale provenance) repaired and verified (2026-10-05); stopped for
MP2 human review.
GOAL: complete the C9 authoring-completeness slice through MP2, then stop for human
review; no merge or phase closure.

CONSTRAINTS:
- Prototype-local implementation; no Paper adoption, production formats or phase closure.
- The owner authorized implementation through MP2; MP1 was explicitly accepted by the
  owner on 2026-10-04. C9.4/C9.5 wait for MP2.
- Commit provenance, correct against live Git: the C9.1 slice is committed by the owner's
  review pass as `abaa7592`; C9.2/C9.3 as `12652d9b`, the first external-review repair as
  `db83a9d7`, and the second review repair as `9a44678a`; all pushed to `origin/prototype-v2`
  (the evidence/status update is that commit's docs-only child). No merge or closure was
  performed.
- AGENTS.md rule 11 requires expanded scope before changing the unrelated missing fixture.
- Donor stays unchanged; every QA axis closes its own browser and server.

READ:
- `docs/README.md` router; `apps/editor/tests/README.md` verification doctrine.
- `docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md` (C9).
- `prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md` (C9.1–C9.3 record).
- Browser-hygiene, agent-browser and slice-closeout skills.

## Established — S0–S9 (prior evidence, retained)

- Branch `prototype-v2`; actual PR https://github.com/Biskiq/spatial-sketch-editor/pull/113.
- S0–S9 implementation and review repairs are complete; [S0–S9 acceptance][s0s9] and
  [C1–C8 conformance acceptance][c8] remain prior evidence, not C9 acceptance authority.
- The missing P23B fixture is a pre-existing repository-gate blocker, also absent at #113's
  base; exact original identity and recovery guidance are recorded in the C1–C8 acceptance.
  Restoration needs separately authorized work and was not performed.

## Established — C9 (this increment)

- C9.1 committed (`abaa7592`); **MP1 accepted explicitly by the owner 2026-10-04**.
  Standalone J1 loop inspected with the Presenter closed; no comprehension result invented.
- C9.2/C9.3 implemented and verified, committed as `12652d9b` (the full record, changed
  paths, repairs and limitations are in [the C9 evidence record][c9]).
- External MP2 review (2026-10-05) named five blockers; all five are repaired at their
  owning authority with pure and browser regression coverage: the route writer ends on Stop
  selection (stale Stage clicks refuse), the primary explanation keeps its binding through
  regrouping, Experience-scoped narration keeps captions and View cues without satisfying a
  later Stop's Gate, Auto derives from remaining Experience work and never interrupts a live
  Camera move, and impossible dependency/cue/Stop-condition scopes are repairable,
  unavailable work. A second review pass then folded C9.1 as accepted and blocked the
  combined C9.2/C9.3 verdict on station activation, cue-scope consistency and remaining-work
  edge cases; all three are repaired at their owning authority (the station is now the
  Activity's single trigger and only automatic work is invokable, cue scope and Gate/pacing
  scope are separate predicates that agree with `emit`, and remaining work is modelled once as
  runtime completion instead of elapsed subtraction at every node), with regression and
  same-defect mutation coverage. Details and coverage in the evidence record.
- Prototype verification at the repaired revision `9a44678a`: pure Node suite **75/75**
  (10 then 14 external-review cases); `qa/run-all.sh all` **18 axes / 762 assertions / 0
  failures, rc=0** — every axis rerun at that one revision (`/tmp/c9-all-final.log`);
  `qa/mutation-check.sh` 23/23 same-defect rejections for the first pass and 28/28 for the
  second, rc=0 (World 3, V2 7, C9 18: the original six, the seven external-review
  obligations — route writer, explanation binding, Experience output, completed work, live
  move, Auto clock, dependency scope — and five second-pass obligations: invocation
  repeating on every tick, a visitor offer becoming traversal work, a stopped remainder
  waited for, a carried dependency paying its elapsed time twice, and the cue predicate
  collapsed back onto the strict scope predicate. The 13th, entry-plus-station double
  activation, was re-targeted from the tick-repeat defect to the activation contract itself).
- Product defects found and fixed during verification: Guide band reachability (band
  measured 285.84px vs Card reserve 216px), visitor transcript crash on View uses without
  `.start`, and the parked-detour parent-visit regression. Details in the evidence record.
- Root repository gates at `9a44678a`: `test:arch` **276/276** rc=0; `npm test` 33 files
  failed / 339 passed / 1 skipped, 4951 passed / 1 failed / 1 skipped rc=1; `check` 1
  missing-module error / 0 warnings; `build` unresolved import; `git diff --check` rc=0.
  Logs `/tmp/c9-{arch,root-test,check,build}-final.log`. Every red gate is the same
  missing P23B fixture, reported separately, not hidden.
- Donor `prototypes/experience-authoring` (separately reported): typecheck, 62/62 domain
  tests, production build and Playwright regressions; tree unchanged.

CURRENT:
- MP2 pending human review; C9.4/C9.5 not started. C9.2/C9.3 and the first external-review
  repair pass are committed and pushed (`12652d9b`, `db83a9d7`) and hold the prototype
  app/QA/tests, styles and the reconciled status docs; the second repair pass is committed and
  pushed as `9a44678a` (evidence/status docs as its docs-only child) and holds the
  station-activation, cue-scope, remaining-work and provenance corrections.
- A preview of the prototype is left registered for the MP2 manual pass; QA axis servers
  are all closed.

NEXT:
1. Owner performs MP2 (repeat J1; add A/B; Preview Guide and Next; select/edit a Stop at
   Peek; deliberately open/leave Overview; predict View/Stop counts and scope), including a
   check that selecting another Stop cannot write to an old route.
2. Record the MP2 outcome. Only then start C9.4/C9.5; if MP2 fails, fix the workflow before
   Travel/agency work.
3. Keep root gates current; carry the missing-fixture blocker explicitly and do not
   fabricate or restore it without separate authorization.

OPEN:
- MP2 outcome (human evidence; automated assertions cannot substitute).
- Push completed for the second repair pass (`9a44678a` plus its docs-only evidence child) on
  owner instruction; the branch is at the pushed head.
- All 18 axes (`qa/run-all.sh all` 18/762, 0 failures) are verified at the repaired revision
  `9a44678a`; no axis is carried from an earlier pass.

[s0s9]: ../../../prototypes/spatial-authoring/qa/EXPERIENCE-ACCEPTANCE.md
[c8]: ../../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md
[c9]: ../../../prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md
