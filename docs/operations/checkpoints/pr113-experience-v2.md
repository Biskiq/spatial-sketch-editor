# PR #113 Experience V2 — checkpoint

TYPE: implementation / final verification
STATUS: paused for scope approval (2026-10-03)
GOAL: finish PR #113 through S9, self-review/fixes, required evidence and closeout;
ready for external review, without merge.

CONSTRAINTS:
- Prototype-local implementation; no Paper adoption, production formats or phase closure.
- Owner authorizes coherent slice commits. Approved plan explicitly leaves pushes unauthorized.
- AGENTS.md rule 11 requires expanded scope before changing the unrelated missing fixture.
- No subagents or browser sessions remain active. Donor stays unchanged.

READ:
- `docs/README.md` router; applicable editor test doctrine.
- `docs/roadmap/p25-experience/design/experience-v2-prototype/implementation-plan.md`.
- PLATE §§0.8–0.8.2; final V2 synthesis §22.
- Browser-hygiene, agent-browser, slice-closeout and work-checkpoint skills.

ESTABLISHED:
- Branch `prototype-v2`; actual PR https://github.com/Biskiq/spatial-sketch-editor/pull/113.
- Remote PR head was S7 `a433850b`; local S8 `06aeea16` was already present.
- S0–S9 implementation and in-scope review repairs are complete. Required prototype
  acceptance passes; evidence/specimens are in `qa/EXPERIENCE-ACCEPTANCE.md`.
- Full repository gates fail on a fixture deleted by merged PR #98, also absent at
  #113's base. Production importer remains `apps/editor/src/lib/bench/p23b-fixtures.ts:9`.
- Exact original: `docs/roadmap/p23b-geometry-performance/40-walls.json`, 61,140 bytes,
  SHA-256 `63f15ed8745d08bf5f65ab2c85829d1b9f1df6f36b3a9137147b70d5d09f5e05`.
  Recover from `49e1b231e4a79aba4a25bb3a7f0bdc151abfa430^` at that path;
  prepared copy `/tmp/pr113-original-40-walls.json` is byte-identical.

EVIDENCE:
- Prototype pure 34/34; final all-axis browser run 15 axes / 612 assertions.
- Final specimens/reconciliation 17/17, including accepted numeric value and 3D posture.
- Three mutation defects rejected with unaffected controls green; donor 62/62 + typecheck.
- Root architecture 24 files / 276 tests passes. Whitespace check passes.
- Root `npm test`: 33 failed files / 339 passed / 1 skipped; 4951 passed tests,
  1 failed / 1 skipped, dependent suites fail missing-fixture collection.
- Root check: 1 missing-module error / 0 warnings. Build: same unresolved import.
- Session logs: `/tmp/pr113-{all-axes-final,specimens-final,pure-final,arch-final,mutations,root-test,check,build}.log`.

RULED OUT:
- Missing fixture is caused by #113: deletion predates its base.
- Need for a generated replacement or production refactor: exact original exists in Git.

DO NOT REPEAT:
- S1–S8 review, donor harvest investigation, all-axis prototype run and mutation proof.
- Browser captures: eleven canonical/extra specimens are finalized and inspected.

CURRENT:
- S9 implementation/evidence is finalized for its coherent slice commit; inspect live Git.
  No fixture restoration,
  push or merge has been performed. Async owner scope question is pending.
- Slice-closeout has been read but cannot run: it requires passing recorded root
  test/check/build gate numbers before reporting merge readiness.

NEXT:
1. Check live Git state and owner answer. If approved, restore only the exact fixture
   and commit it separately; if not approved, carry the pre-existing gate failure explicitly.
2. After restoration, run root `npm test`, `npm run check`, `npm run build`; inspect any
   remaining failures within applicable scope. Update acceptance and retire this checkpoint.
3. Use slice-closeout after required gates pass; preserve full plan/acceptance in an
   anchor commit before stubbing/tagging. Do not close a major phase or merge. Obtain
   push authorization before publishing local commits/tag; update PR review description.

OPEN:
- Owner approval for exact fixture restoration outside #113 prototype scope.
- Push authorization (approved plan says unauthorized).
