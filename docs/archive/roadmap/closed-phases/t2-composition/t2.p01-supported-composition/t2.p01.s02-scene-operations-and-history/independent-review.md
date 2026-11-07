# T2.P01.S02 — independent review stub

AUTHORITY: NONE — reviewer-authored evidence is preserved in Git. The T2 phase contracts own the
current behavior; this artifact records scoped review provenance only.

**Historical review:** three adversarial rounds plus verification rounds, 2026-10-16, on branch
`T2-P01-S02` from base `74367936`. Rounds 1–2 found four substantive defects and one evidence defect,
all repaired at `9818c329`, `bd7178eb`, `f12c7c5d` and `af39acd1`; the verdict there covered
`af39acd1`. A round-3 adjudication against `7bca2fc8` reproduced two further substantive findings — an
owner-qualified frame trusted without resolution, and a record-scope grant that admitted a whole
`rotation` field to a yaw edit — both repaired at `62d4d5b0`. No independent verdict covered
`62d4d5b0` at that time. The owner's 2026-10-17 closeout invocation was the acceptance event, not a
review waiver; a fresh independent review was obtained to resolve the outstanding prerequisite.

**Fresh independent review:** the reviewer assessed the PR tree after reconciling `origin/main` at
`1f411cbc6384c29cab246fef7345bdeedb9bd060`. It confirmed the earlier round-3 fixes and found one
additional in-scope P2: `move-horizontal` granted the whole `position` field rather than X/Z, and
`resize-on-floor` granted the whole field rather than Y, so a planner could change a component it did
not own. The repair at `620e411ebf7a334d4cc04910ef34d35905b9f27c` scopes those grants to X/Z and Y plus
scale, and makes the record-scope mask preserve array positions while comparing ungranted components.
The reviewer re-reviewed that production correction and the final regression-test tree at
`189757375ccb6b20e9661686170f19f147aa4cb6` (tree
`67bdd21bab76ea1760939f3faa301adc02ed051b`), including the test-fixture typing correction, and
approved it with no remaining finding.

**Provenance:** PR #134; the repair revisions and their mutation evidence are preserved in Git. The
acceptance record summarizes the reused results.

EVIDENCE-PATHS: start — the following is a historical Git recovery path at the accepted closeout base.
`git show 4945e926e30db105dde429478d84453147dc463c:docs/roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s02-scene-operations-and-history/independent-review.md`
EVIDENCE-PATHS: end
