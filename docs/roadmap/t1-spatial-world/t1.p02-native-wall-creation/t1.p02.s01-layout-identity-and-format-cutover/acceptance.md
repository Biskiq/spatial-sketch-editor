# T1.P02.S01 — acceptance record: Layout identity and format cutover — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records acceptance and recovery.
STATUS:    ACCEPTED (`owner-override`) and CLOSED 2026-10-23.
SOURCE:    PR #179 accepted implementation tip 7e159370a94a1a5e3cbb6d48abe42a66f7c3bd48.
INTEGRATED: rebased S01 implementation 401b612f562e3a57d305ae3f831b24beba2dc6ae on PR #180
           merge c1e4e0307a6e5d293f25d35e233451730a34b8db; owner ruling recorded at a9530e82.
RULING:    full owner-override recorded in commit 302f966d48faf1f63d2b089cec31bca43582f178.
TIER:      architecture-integration; integrated exhaustive proof remains T1.P02.S04.
PHASE:     T1.P02 remains active; S04 is its declared final gate.
```

## Delivered and evidence

Layout identity capture and the format-6 derived Wall-role cutover are accepted for the registered scope. The complete criterion matrix, owner ruling, test identities, deviations and stop-and-report are recoverable from the historical anchor below.

Reused verification at the original implementation revision `7e159370a94a1a5e3cbb6d48abe42a66f7c3bd48`: `npm run check` (0 errors, 0 warnings); layout-core, project-model and API checks clean; fast 143 files / 1,996 tests; heavy 9 files / 125 tests; arch 22 files / 173 tests; full editor suite 174 files / 2,294 tests; DB-backed API 11 files / 82 tests, 0 skipped. No product checks were rerun for this documentation-only closeout.

## Owner ruling — per-slice owner-override (2026-10-23)

```text
RULING:     The owner stated, “owner overide, everything is accepted.” This is an explicit
            per-Batch-E, per-current-revision owner-override for T1.P02.S01.
SOURCE:     PR #179 reviewed implementation tip 7e159370a94a1a5e3cbb6d48abe42a66f7c3bd48;
            the documentation-only T1 baton commit is aa3bc771e801791654bfea16008b5e8a3ebfcc0e.
INTEGRATED: The rebased S01 implementation is 401b612f562e3a57d305ae3f831b24beba2dc6ae on PR #180
            merge c1e4e0307a6e5d293f25d35e233451730a34b8db. The ruling was recorded from integration
            candidate a9530e82c9f3c08b9953eef6017b1afea540578a; original 7e159370 remains the source
            provenance.
WAIVED:     The independent-review verdict prerequisite for this S01 source revision.
            The S01 F2 open-timing acceptance prerequisites at S and M on the designated M2.
NOT WAIVED: The plan's recorded architecture-integration evidence and all other acceptance
            criteria, or T1.P02.S04's integrated final gate. No S/M measurements were run. Under the
            2026-10-28 policy amendment below they remain unmeasured historical rows and are not
            owed to S04 or any other acceptance gate.
STATE:      The phase slice register reads `shipped` with this authorization as `owner-override`;
            the T1 baton routes the separately authorized successor work.
```

**Policy amendment — 2026-10-28.** The owner suspended the mandatory performance-benchmarking
strategy indefinitely ([decision](../../../../reference/decisions/performance-mandate-suspension-2026-10-28.md)).
The S01 F2 S/M open timings remain **unmeasured** historical rows, not passes, and are no longer
assigned to S04 or any other acceptance gate. No benchmark is authorized. Correctness evidence and
the recorded Stage bundle miss are unchanged.

The §3 legacy Layout type/codec/room-frame/compiler-adapter retirement remains a real residual, not a waiver: the T1.P02 phase owner must separately scope, register and authorize its successor slice, which must land before S02. The five-blocker rationale and successor scope are in the recovered acceptance body and the T1 planning-evidence retirement row. S02 then requires its own owner authorization and a complete plan drafted from its current outline before implementation. S01 creates no capability outcome and does not close its phase.

## Entry points and residuals

```text
implementation  packages/layout-core/src/layout-id-capture.ts
                packages/layout-core/src/layout-wall-first-types.ts
                packages/layout-core/src/layout-wall-first-codec.ts
                packages/layout-core/src/layout-wall-role.ts
validation      packages/layout-core/src/layout-wall-first-validation.ts
regressions     apps/editor/tests/lib/layout/layout-identity-capture.test.ts
                apps/editor/tests/lib/layout/t1s01-format6-differential.test.ts
                apps/api/tests/save.test.mjs
residuals       T1.P02 phase owner: separately scope/register/authorize the §3 retirement before S02
                F2 S/M open timings: unmeasured historical rows; no benchmark is authorized or owed
```

## Recovery

```text
git show 302f966d48faf1f63d2b089cec31bca43582f178:docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/acceptance.md
anchor  302f966d48faf1f63d2b089cec31bca43582f178
 tag    closed/T1.P02.S01 (pushed)
```

## Closeout preservation — T1.P02.S01 (2026-10-23)

```text
prose compacted:                 2   implementation plan and acceptance record; both stubs remain
reference promotions:            0   no durable reference contract changed
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:      0
transient artifacts removed:     0
historical anchors:              401b612f562e3a57d305ae3f831b24beba2dc6ae (plan),
                                 302f966d48faf1f63d2b089cec31bca43582f178 (acceptance);
                                 closed/T1.P02.S01 → acceptance anchor (pushed)
new live → archive prose links:  0
manual-owed verification rows:   0   F2 S/M measurements remain unmeasured historical evidence;
                                     the 2026-10-28 suspension removed the S04 assignment
remaining deferred items:        1   §3 retirement before S02; F2 S/M measurements are historical,
                                     unmeasured and no longer an acceptance prerequisite
permanent stubs added:           2   plan and acceptance, per the owner-ratified preservation policy
required merge method:           P1 merge commit; merge owner verifies both anchor paths after merge
```

## Closeout self-check

```text
acceptance    PASS — dated owner-override is scoped; explicit waivers and unrun measurements are recorded
tier          PASS — architecture-integration evidence is reused; S04 remains the integration route
shims         PASS — residual legacy surface has an identified owner and retirement condition
promotion     PASS — no new durable reference contract was introduced
preservation  PASS — two prose stubs, exact recovery commands and the local closed-slice tag
routing       PASS — phase row is shipped under owner-override; S01 is not the final gate
baton         PASS — T1 baton names the immediate §3 successor authorization and S02's later prerequisites
stable        PASS — no branch-head or pending-merge claim in live status; recovery is anchor-based
report        PASS — counts, residual owners, deferred measurements, tag and P1 method recorded
scope         PASS — documentation-only closeout; no implementation or test source changed
P1            PASS — merge 8501e7bf preserves both anchors; post-merge ancestry/recovery verified 2026-10-23
```

## Recorded merge gate

On `aebbe2708aaae49a82cb45dadfc6b436b98658d9`, based on PR #180 merge `c1e4e030`, the complete
editor suite passes **179 files / 2,321 tests**, architecture **22/173**, heavy **9/125**, all
package/editor/API checks and the production build. Fresh DB-backed API verification passes
**82 tests / eleven reports / zero failures or skips**. The documentation gate passes **56/56**.
The initial baton-routing failure was corrected and the full suite rerun; no product code changed
for that correction. Exact commands/results: `/tmp/batch-e-closeout/pr179-gate-2/results.json`.
