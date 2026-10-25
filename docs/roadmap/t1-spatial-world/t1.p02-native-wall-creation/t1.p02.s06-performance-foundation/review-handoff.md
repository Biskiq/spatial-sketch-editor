# T1.P02.S06 — optimize step: review hand-off

**Status:** implementation review / Bench 2 readiness (2026-10-25). Bench 2 has **not** run and
nothing is merged or pushed. The scope, criteria and evidence rules stay in
[implementation-plan.md](./implementation-plan.md); the accepted state, numbers and predictions are in
[acceptance.md](./acceptance.md#optimize-step-d1d6--implementation-state-2026-10-25);
the Bench 1 reading is [characterization.md](./characterization.md).

This page is the reviewer's map: what each commit is, what to look at, what the independent reviews
found, and what still needs an owner decision.

## 1. Commit map (branch `t1/p02-s06-bench-setup`, PR #190)

Review bottom-up; each commit builds on the one below and stays inside one owned surface.

| Commit | Title | Surfaces | Read it for |
| --- | --- | --- | --- |
| `9d2a594d` | perf(t1): index the S06 geometry joins and topology pair loops | `packages/layout-core/src/**` (T2), two re-pinned layout tests, `perf/census/probe-d1-differential.ts` | the exact-output differential, the indexed joins, the once-built cache keys |
| `91df34e0` | perf(t1): prepare the validated envelope instead of validating it twice | `units/runtime.ts`, `units/validate.ts` (T3), `stage/source-admission.ts`, `probe-d2-accept.ts` | the two validating entry points keeping their meaning while gaining a validation-free half |
| `8fc7bb31` | perf(t1): reuse the admitted value and share unchanged units at capture | `units/acceptance.ts`, `f4/types.ts` (T3), `f4/acceptance-coordinator.ts`, new `f4-structural-sharing.test.ts`, `probe-h5-capture.ts` | the sharing proof, its falsifiers, and the one place caller data is now frozen in place |
| `438f3022` | docs(t1): record the S06 optimize step and its Bench 2 hand-off | `acceptance.md` | claims versus measurements versus predictions, and the open obligations |

## 2. What a reviewer must be able to falsify

| Claim | How to falsify it | Where |
| --- | --- | --- |
| The compiled facts did not move | Run `probe-d1-differential.ts` on `c4ce6c83` and on this tree; the key-free `facts` digest must match for all seven workloads (values in the acceptance record) | `perf/census/probe-d1-differential.ts` |
| Cache-key values changed in encoding only, and nothing consumes them for identity | `apps/editor/src/**` has no `.cacheKey` reader; the two observation digests that hash query keys are re-pinned on the facts digest above | `layout-geometry-keys.ts`, the two `p23b4-*` suites |
| The indexes visit every pair the old loops could accept | Reason per gate: chord boxes use segment endpoints only (the classifier reads only those), curve boxes are padded by `CURVE_SELF_INTERSECTION_TOLERANCE` exactly as the shipped prune, and a pair the index omits is one the predicate rejects anyway | `layout-plan-box-index.ts` + its three call sites |
| Admission lost only redundant passes | Count oracle per accepted result: validations 5 → 3, digest passes 13 → 7, serializations 1 → 1 | `perf/census/probe-d2-accept.ts` |
| Sharing cannot install a value that differs from the recorded one | The falsifiers: a changed unit `unitId`, a changed lock capability, a changed pin, a changed project, and a changed unit body with a stale header. Plus `serializeProjectEnvelope(state.source) === state.canonicalJson` on install **and** after Undo | `f4-structural-sharing.test.ts` |

## 3. Independent review rounds and their disposition

Two rounds of independent, read-only review (four lenses, then two re-reviewers), run as separate
agents with no knowledge of each other's output.

**Round 1 — four lenses** (admission semantics, layout-core indexing, evidence integrity, code
quality). Findings and disposition:

| Finding | Severity | Disposition |
| --- | --- | --- |
| `shareUnchanged` compared only `contentRevision` + `domain`, so a changed `unitId` (authored content the envelope digest covers, and outside the unit revision) could install the baseline unit under the captured revision | MAJOR | **Fixed.** The predicate now compares the whole header (revision, domain, `unitId`, `formatVersion`), and a falsifier covers it |
| The lock comparison ignored `requiredCapabilities` and `pin` | MAJOR | **Fixed.** Entries are compared on the identity key, revision, capabilities and byte pin; the lock comparison now uses the existing `dependencyLockKey` instead of a second reader for the same grammar; three falsifiers added |
| The H5 probe measured `structuredClone` directly, so its `f4:clone` count was 0 in both arms and the record quoted it as probe evidence | MAJOR | **Fixed.** The probe now measures the coordinator's real capture (`immutableF4Data`), prints 1 → 0, and no longer prints GC noise as retained heap |
| `lookup:junctions` was reported as "indexed (0 linear)" while the label still counts 2 per Wall | MAJOR | **Fixed.** The record states the unit change and 567,000 → 2,520 |
| A hard budget row (per-edit Layout evaluation, ≤ 8 ms at M / ≤ 16 ms at L) was missing from the record | BLOCKER (evidence) | **Fixed.** Added to the scope and prediction tables with a hard-miss verdict owned by H1 |
| grid-XL's hard clause (no crash, no > 1 s main-thread block) and F13's hard "geometries back to baseline" clause were folded into "omitted"/"unchanged" | MAJOR (evidence) | **Fixed.** Both are named as open hard obligations with where they are rechecked |
| F8-at-L prediction did not follow the record's own disjoint-row convention | MAJOR (evidence) | **Fixed.** Corrected to ≈ 300–360 ms |
| Pair counts moved from "visited pairs" to "query results" (double-counted, plus self hits) | MINOR | **Fixed.** Counted per unique pair again, so they stay comparable with Bench 1 |
| The Junction sweep's "NaN is handled without a special case" claim did not hold: a NaN makes the sort comparator inconsistent and can hide a coincident pair | MAJOR | **Fixed.** Any non-finite coordinate falls back to the exhaustive pair enumeration |
| The Room × Opening join produced boundary order and could duplicate an Opening for a repeated boundary Wall | MAJOR | **Fixed.** The join keeps the indexed read and restores document order (and multiplicity) for the compiled Room's Opening list |
| The plan-box index silently dropped an inverted box; its `Int32` stamp could wrap | MINOR | **Fixed.** `span < 1` (and non-finite) goes to `wide`; the stamp restarts before `Int32` wrap |
| Commit carried an agent `Generated with`/`Co-Authored-By` footer, which `AGENTS.md` rule 12 forbids | BLOCKER | **Fixed.** History re-cut in four reviewed commits with no footer |
| Test suite duplicated the coordinator boot helper instead of reusing it | MINOR | **Deferred.** Recorded here; the duplication is a fixture refactor with no behavioural content |
| `void canonicalJson` dead parameter in `source-admission.ts` | NIT | **Deferred** (pre-existing, untouched by this step) |
| A physical Opening's key embeds the host Wall's *identity*, not its geometry, so it does not detect a Wall move | MAJOR if introduced here | **Not introduced here** — the same literal is in the removed line of the D.1 diff (`git diff c4ce6c83..435 -- layout-geometry.ts`). Preserved byte-for-byte, nothing reads `.cacheKey` for retention today, and it is recorded as an H4 prerequisite rather than changed, because changing it would re-pin the observation digests again |

**Round 2 — two re-reviewers** verified the fixes. Verdicts: the sharing hook is "safe to expose as
an optional adapter capability" with its falsifiers failing on a reverted predicate; the layout-core
fixes restore exact pre-change output for out-of-order authorship, repeated boundary Walls, reverse
refs and unhosted openings. Four documentation-level observations from round 2 were applied
(preconditions stated on both docs, a guard for a partial envelope, the post-Undo serialization
assertion, and a merged comment); the two remaining notes (a mixed-direction repeated Wall, and the
sort sentinel) are documented rather than enforced, and neither changes behaviour.

## 4. Verification actually run (final tree)

| Gate | Result |
| --- | --- |
| `check:layout-core`, `check:project-model`, `check:camera-core` | pass |
| `check` (svelte-check) | 0 errors, 0 warnings |
| `test:fast` | 159 files, 2,147 tests pass |
| `test:arch` | 22 files, 178 tests pass |
| `test:heavy` | 9 files, 125 tests pass |
| Probes (`probe-d1-differential`, `probe-d2-accept`, `probe-h5-capture`) | run on this tree and on `c4ce6c83`; digests and counts in the acceptance record |

Gates ran on the final tree. The four commits are content-identical to it, but each intermediate
commit was not separately gate-run; a reviewer who wants per-commit proof should typecheck at the
commit boundary.

**No browser benchmark was run.** Every performance figure in this step is either a deterministic
Node count, an exact-output digest, or a hand calculation labelled as a prediction.

## 5. Known risks after this step

1. **F4 at L ≈ 400–430 ms and F8 at L ≈ 300–360 ms (hard, ≤ 200 ms)** — the representation build
   (167/164 ms) and the second compile per accepted result (≈ 95 ms) are untouched.
2. **Per-edit Layout evaluation misses its hard row at M and L** — D.1 halves the compile; only H1's
   k-bounded evaluation reaches ≤ 8/≤ 16 ms.
3. **F13's hard clause still fails** — +2,968 live geometries per accepted commit at L.
4. **F2 at L stays ≈ 5.1 s (Target row)** — the Stage mount is H4.
5. **Cache-key retention gap** — an Opening's key does not detect its host Wall's geometry; harmless
   today, load-bearing for H4.

## 6. Owner decisions required before Bench 2

1. **Amended measurement scope** — S/M/L hard tiers plus E5, with grid-XL timing and the sweep
   latency rows deferred to `T1.P02.S04` rather than waived, and grid-XL's hard clause rechecked by
   the smoke. The exact request is in the acceptance record.
2. **F4 hand-over contract** — whether an adapter may attest the acceptance proof on its candidate so
   the host reuses the planner's compile (one compile per accepted result). Needs T3 review; the
   alternative is H1.
3. **H4 in this PR or a follow-up slice** — it is the only lever for F2 at L, the representation half
   of F4/F8, the F13 geometry clause and the Opening-key gap.
4. The already-open Bench 1 question about the sweep-H10 drag row method does not block.

**Proposed Bench 2 command** (lean scope, ≈ 3 h):

```
npm run perf:bench --workspace @portfolio/editor -- --label bench-2 --tiers grid-S,grid-M,grid-L --no-sweep-latency
```
