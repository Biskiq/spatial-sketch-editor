# PR #113 Experience V2 — checkpoint

TYPE: implementation / verification (C9 continuation)
STATUS: C9.1–C9.3 implemented and verified; stopped for MP2 human review (2026-10-04)
GOAL: complete the C9 authoring-completeness slice through MP2, then stop for human
review; no merge or phase closure.

CONSTRAINTS:
- Prototype-local implementation; no Paper adoption, production formats or phase closure.
- The owner authorized implementation through MP2; MP1 was explicitly accepted by the
  owner on 2026-10-04. C9.4/C9.5 wait for MP2.
- No commit/push/merge was authorized for this increment. The C9.1 slice was committed by
  the owner's review pass as `abaa7592`; C9.2/C9.3 remains the uncommitted working-tree diff.
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
- C9.2/C9.3 implemented and verified;  the full record, changed paths, repairs and
  limitations are in [the C9 evidence record][c9].
- Prototype verification: pure Node suite 60/60; `qa/run-all.sh all` 18 axes /
  752 assertions / 0 failures, rc=0; `qa/mutation-check.sh` 16/16 same-defect rejections,
  rc=0 (World 3, V2 7, new C9 obligations 6: organization-as-start, hold cue leakage,
  entry-plus-station double invoke, empty Reset hidden placeholder, silent first-offer
  choice, Peek forcing L2).
- Product defects found and fixed during verification: Guide band reachability (band
  measured 285.84px vs Card reserve 216px), visitor transcript crash on View uses without
  `.start`, and the parked-detour parent-visit regression. Details in the evidence record.
- Root repository gates at base `abaa7592` + this diff: `test:arch` **276/276** rc=0;
  `npm test` 33 files failed / 339 passed / 1 skipped, 4951 passed / 1 failed / 1 skipped
  rc=1; `check` 1 missing-module error / 0 warnings; `build` unresolved import;
  `git diff --check` rc=0. Logs `/tmp/c9-root-{arch2,test2,check2,build2,whitespace}.log`.
  Every red gate is the same
  missing P23B fixture, reported separately, not hidden.
- Donor `prototypes/experience-authoring` (separately reported): typecheck, 62/62 domain
  tests, production build and Playwright regressions; tree unchanged.

CURRENT:
- MP2 pending human review; C9.4/C9.5 not started. The uncommitted C9.2/C9.3 diff contains
  the prototype app/QA/tests, styles and the reconciled status docs.
- A preview of the prototype is left registered for the MP2 manual pass; QA axis servers
  are all closed.

NEXT:
1. Owner performs MP2 (repeat J1; add A/B; Preview Guide and Next; select/edit a Stop at
   Peek; deliberately open/leave Overview; predict View/Stop counts and scope).
2. Record the MP2 outcome. Only then start C9.4/C9.5; if MP2 fails, fix the workflow before
   Travel/agency work.
3. Keep root gates current; carry the missing-fixture blocker explicitly and do not
   fabricate or restore it without separate authorization.

OPEN:
- MP2 outcome (human evidence; automated assertions cannot substitute).
- Commit/push authorization for C9.2/C9.3 (not requested).

[s0s9]: ../../../prototypes/spatial-authoring/qa/EXPERIENCE-ACCEPTANCE.md
[c8]: ../../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md
[c9]: ../../../prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md
