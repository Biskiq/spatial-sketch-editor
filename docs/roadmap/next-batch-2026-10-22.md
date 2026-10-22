# Next batch — H0 and first-wave launch plans (coordination proposal, 2026-10-22)

**Status: decided 2026-10-22.** The owner approved E1–E7 as recommended below, deciding E7 now with
each start gated on `T3.P03.S01` merging; the [batch E record](../reference/decisions/batch-e-authorization-2026-10-22.md) is the decision provenance.
This page itself registers, authorizes, ratifies and releases nothing; it keeps the gap findings and
the decision framing. Base: `origin/main` `f516e1ff`, the merge of PR #173. The
[canonical DAG and batch](./cross-track-execution.md#authorized-batch-e-2026-10-22) own lanes,
dependencies, shared files, merge order and per-slice gates.

| Lane | Phase | Launch plan |
| --- | --- | --- |
| H0 shared correction | [T3.P03](./t3-experience/t3.p03-shared-acceptance-and-measurement/README.md) | [S01 planner scope and build isolation](./t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s01-planner-scope-and-build-isolation/implementation-plan.md) · [S02 measurement and final gate](./t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s02-measurement-workflow-and-final-gate/implementation-plan.md) |
| C1 native Walls | [T1.P02](./t1-spatial-world/t1.p02-native-wall-creation/README.md) · [shell draft](./t1-spatial-world/t1.p02-native-wall-creation/shell-draft.md) | [S01 identity and format cutover](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/implementation-plan.md) |
| C2 own GLB import | [T2.P02](./t2-composition/t2.p02-own-model-import/README.md) · [shell draft](./t2-composition/t2.p02-own-model-import/shell-draft.md) | [S01 storage and admission](./t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/implementation-plan.md) |
| Capture and Preview | [T3.P02](./t3-experience/t3.p02-capture-and-cut-preview/README.md) | [S01 finalized scope](./t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/implementation-plan.md) · [format draft](./t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/experience-format-draft.md) · [shell draft](./t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/shell-draft.md) |

## Verified state at `f516e1ff`

Gate register unchanged: F1–F4, `T1.viewport-projection@1` and `T3.camera-experience-cutover@1`
accepted with their scopes active; F5 and `T4.prepared-reader` undrafted. T1.P01, T2.P01 and T3.P01 are
closed. T3.P02 is registered with S01 `approved` but held and unimplemented, and S02 `proposed`. The
architecture cycle is in `PHASE_3_EVALUATE` with the T1.P01 verdict owed; that blocks only its own
handoff. Playwright is not installed. The F2 epoch activation remains an owner-run operation. T4 stays
deferred (R1-D) and P4 deferred.

## Blocking gaps found and how the drafts resolve them

| # | Gap (code evidence) | Resolution |
| --- | --- | --- |
| G1 | H0 declared `architecture-integration` with no integration route | T3.P03 has two slices: S01 merges first; S02 is the exhaustive final gate and installs the harness alongside the product lanes |
| G2 | The live host builds the unit adapter with `compound: true`, and the coordinator passes only a planner's domain, so no per-planner check ever runs; `compound` declares no write set | S01 passes the planner's admission into validation; compound planners declare `writes`, which implements the ratified F.4 destination; the RR-4 counterexample becomes a regression test |
| G3 | The Preview/public predicate still forbids the deleted `src/lib/editor/`; nothing rejects `src/lib/authoring/` in either build or checks the Preview surface closure | S01 retargets the predicate and fixtures and adds the Preview closure test |
| G4 | Hard GPU, frame-time and GPU-memory rows can only be accepted from Reference A hardware, and none is named | H0 installs the workflow; decision E6 names the hardware |
| G5 | Every Layout allocator is occupancy-based; the only cursor rewinds with Undo; the envelope has no counter | T1.P02.S01 captures one nonce per accepted operation as intent input |
| G6 | Authored Wall `role` lives in fourteen modules and seventy-eight test files; the first schema cutover also triggers legacy-type retirement | T1.P02.S01: format 6 without `role`, derived roles, legacy retirement; no migration (pre-baseline) |
| G7 | Native drawing reaches nested, overlapping, collinear and non-enclosing cases the destination leaves to C1 | Decision E3 (policy in T1.P02) |
| G8 | Per-move full finalization, a second compile at install, re-admission on Undo/Redo | T1.P02.S02 deduplicates first, then a bounded experiment only if F3 misses |
| G9 | The asset registry is image-only and mutable; Save never checks stored bytes | T2.P02.S01: immutable model revisions, staging/approval, Save verification of model pins |
| G10 | Admission accepts only catalogue `assetId`s, the fallback is a furniture enum, and model contact is unknown | T2.P02 formats: a `model` resource kind with a placement definition and a generic fallback; contact from the definition |
| G11 | The live host never grants resource staging | One resource-granted placement planner in T2.P02.S02, safe once H0 enforces scope |
| G12 | The closed T2.P01 deferred table says K1 needs T4 and publish | Superseded by K1; recorded in T2.P02; the closed record is not rewritten |
| G13 | A Presentation is `{id, label, viewId}`: no subject, text, Default/Stop-local entry or Cut/Travel | The S01 Experience format draft (format 2) |
| G14 | The interpreter cannot enter a Presentation without a Stop | A Presentation-entry event in the program; lowering and interpreter change together |
| G15 | Same-run Reset keeps its run epoch while Travel is asynchronous | S01 gives every Preview entry a fresh runtime and epoch, offers no same-run Reset, and stops and reports if one is needed |
| G16 | No editor Preview exists, nothing is lazily imported, and nothing asserts Preview stays out of the Stage first load | S01 lazy chunk plus a bundle-report assertion from H0 |
| G17 | The Card overlaps Compose; three lanes will add lower-surface work | T1.P02.S02 owns Card/instrument arbitration; until it lands, S01 and C2 verify no new overlap |
| G18 | All three lanes edit the shared unit type and validation modules | Serialized merges with T3 F2 review ([batch E rules](./cross-track-execution.md#batch-e-shared-files-and-merge-order)) |
| G19 | The T3 baton still told the next agent to start S01 | Corrected to the held state |

**Versioning.** Every new format here follows the North Star's
[pre-baseline rule](../reference/north-star.md#release-and-source-baselines): bump the number, refuse
anything else, regenerate fixtures, migrate nothing. That fully answers the ratified record's
"version and older-reader decision" for each consumer, so it is not a decision below.

## Owner decisions

**Decided at this PR's review** (all approved as recommended; [record](../reference/decisions/batch-e-authorization-2026-10-22.md)):

| # | Decision | Recommendation |
| --- | --- | --- |
| E1 | Register T3.P03, T1.P02 and T2.P02 as drafted, with every row `proposed` | Register all three. Registration authorizes nothing |
| E2 | Authorize T3.P03.S01 and S02 and release T3.P03 alone from the hold | Yes. It changes no product behavior, format or gate |
| E3 | C1 drawing and enclosure policy: every closed ring encloses; roles follow geometry; deliberate connection only; crossings, collinear overlaps and unconnected nested rings refuse with a repair; Wall deletion takes its Openings and leaves references retained | Accept the [T1.P02 policy](./t1-spatial-world/t1.p02-native-wall-creation/README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22) as written |
| E4 | C2 bounds: source file set ≤ 50 MiB per import, derivative ≤ 25 MiB, unapproved staging deleted after 24 h, approved revisions kept while any stored project version references them (C3 deletes them with the project); derivative made in the creator's browser worker with server-side structure checks | Accept. The alternative, server-side derivative processing, adds API CPU and infrastructure for no first-wave benefit |
| E5 | Accept T3.P02.S01's finalized scope: Guide-free Preview entry included, the Experience format draft, and the shell draft's Preview entry rule | Accept, with the two open points in the format draft settled at implementation review |
| E6 | Reference hardware for the hard GPU, frame-time and GPU-memory rows | Designate a Reference A machine and who runs it. Without one, C1 and C2 cannot be accepted on those rows. Using Reference B in the meantime would amend the ratified performance contract |
| E7 | Authorize T1.P02.S01 and T2.P02.S01, and release them and T3.P02.S01 from the hold | Decide now with each start gated on `T3.P03.S01` merged, which the runbook start step checks; or defer the decision to the review after H0 merges |

**Later, triggered by their own events:** each lane's next slice after its predecessor's acceptance,
with plans written then; T3.P02.S02 after S01 acceptance; drag-preview semantics only if C1's
experiment misses at L; the Core Editor Stability criteria and acceptance plan after the lanes ship;
the architecture-cycle verdict whenever convenient.

**Not needed:** no licence decision, because every new dependency (Playwright, glTF-Transform, the
Khronos validator, the Draco and meshopt decoders) is permissively licensed; no data-stance or
migration decision; no new gate.

## Non-implications

The decisions take effect through the [batch E record](../reference/decisions/batch-e-authorization-2026-10-22.md) and the registers it updates, not
through this page. They ratify no format, accept no milestone and change no gate row, capability
record, closed phase or architecture-cycle state. E6's machine was named the same day: the
owner's MacBook Air M2 with 16 GB ([amendment](../reference/decisions/batch-e-authorization-2026-10-22.md#amendment-e6-reference-machine-named)). Every slice re-verifies its prerequisites
at its own trusted base when it starts.
