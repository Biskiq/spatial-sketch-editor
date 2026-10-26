# T1.P02.S06 — optimize step: review handoff

**Status:** independent review round 3 complete (2026-10-25) on the persistent-root takeover and its
H1/H4/H9 integration, at 48126338 plus the documentation commit, working tree otherwise unchanged.
Two findings were substantiated — one behavioural (`session.retained()` answered differently depending
on which store shape served the last compile) and one dead allocation — and both are fixed with
falsifiers. The rest of the review's observations are documented preconditions, not code changes. No
expensive performance work was re-run. Bench 2 has not run, so step acceptance is withheld and nothing
is merged.

The [implementation plan](./implementation-plan.md) owns scope and criteria; the
[current implementation record](./acceptance.md#persistent-representation-takeover) separates claims,
measurements and remaining boundaries. The [architecture dossier](../../broad-research/spatial-computation-architecture.md)
contains the falsified base claims, serious alternatives, complete cost models and owner hypotheses.

## Current independent-review boundary

Review round 3 ran on the takeover alone — persistent vectors/maps and their lazy source/compiled
views, snapshot sealing and restore, the delta compiler, the spatial replacement index, and the H4
representation install — from source inspection plus temporary differential probes that were deleted
afterwards. It deliberately did **not** re-derive the performance characterization: no Bench 1/2/3,
E5 census, scale replay, allocation profile or browser frame was produced, and every figure quoted
below is either a committed measurement from
[the evidence record](./evidence/persistent-2026-10-25/README.md) or a hand-derived bound labelled as
such. Earlier review rounds are preserved below for their original scope; none of their corrections
was reverted, and none of them is an approval of the takeover.

### Round 3 findings and disposition

Findings are ordered by what they change, not by how they were noticed. "Documented" means the
precondition or the cost is now stated where the reliance is; none of those observations was a
defect in the shipped paths, and none was promoted into new machinery.

| Finding | Severity | Disposition |
| --- | --- | --- |
| `session.retained()`'s world branch reported `objectUnit.compiledObjects.length`, while the map branch reports `store.objects.size`. A delta that retains an `object_invalid` descriptor has no compiled object for it, so the same document reported one fewer object *only because the last compile went through a delta*. The rooms field had the same shape mismatch (`roomSlots.summary.rooms` vs `roomSources.size`). F13 attribution reads this figure. | MINOR (provenance) | **Fixed.** The world branch now reports slot/authored counts — `wallSlots.length`, `roomSlots.length`, `layoutLength(document, 'objects')` — so both shapes answer "units the store can serve". Reproduced first at 30 vs 31, then pinned in [the storage suite](../../../../../apps/editor/tests/lib/layout/t1s06-persistent-storage.test.ts) with an invalid-object delta. |
| `nextOpeningsToApply` accumulated `{ index, opening }` for every changed Opening on every delta compile and was never read: an O(k) allocation plus k pushes per edit, and a second place holding a candidate Opening that could later drift from what the source views read. | NIT | **Fixed.** Removed, with the reason the source views already see the candidate document. |
| `PersistentMap.set`/`delete` mutate the handle's `root`, so two owners of one handle see each other's writes. Nothing in S06 shares a map handle (the COW path forks or owns), but the type invites it. | NIT | **Documented** on the class with the `fork()` rule. No code change. |
| `PersistentVector.fromFrozen` leaves `summary` undefined, so a `set` split would produce summary-less children under a summarized vector. Sound today: every summarized vector comes from `from`, and no summarized consumer accepts a borrowed root. | NIT | **Documented** beside `fromFrozen` as the precondition that keeps the split honest. No code change. |
| `layoutVector` caches a root keyed by array *identity*, so an in-place write to a cached but unfrozen array would leave a stale root behind it. | NIT | **Documented** with its two preconditions; only `withLayoutVectors` writes a collection and it writes through the property setter, which replaces the flat array and the root together. |
| `ensureLayoutWorldIndex` invalidates by collection identity (`matchesArrayRefs`), so an in-place write to an already-indexed array is invisible and the cached index would answer from old values. | NIT | **Documented** with the soundness condition: authored documents are immutable once indexed, COW replaces roots, and a Svelte `$state` proxy is copied by `PersistentVector.from` (it is never frozen) rather than indexed. |
| `ADMITTED_BY_FROZEN_ENVELOPE` caches admission by the envelope *object*, which would be unsound if a cached envelope could change. | NIT | **Documented**: only an envelope `isDeeplyFrozenPlainJson` accepts is cached (that predicate rejects accessors and exotic prototypes), and the answer's normalized source is frozen too. |
| `MAX_ADMITTED_HISTORY_CACHE = 52` is a count, not a byte budget, and the retained shape was undescribed. | NIT | **Documented** at the constant: one `StageDomainRead` per content id whose entities are shared with its neighbours through the compile session, whose `canonicalJson` is the string the F4 history state already holds; deeper history recomputes (correct, slower). Not raised. |

### Hypotheses examined and not sustained

An adversarial review is also the record of what was attacked and held. Each item below was
falsified-by-search or falsified-by-differential, using temporary probes that are not committed
(the permanent coverage is named where it exists):

- **Mutable lazy view vs persistent root.** No path mutates a materialized source array: `layoutCollectionRef` returns either the vector or the flat array, and every writer replaces the property through `withLayoutVectors`. The only in-place writes in the takeover are to fresh capture buffers. Held.
- **Delta vs cold parity under mixed deltas.** A 3-seed × 40-edit differential (junction moves, rigid wall moves with signed deltas, thickness and scalar changes, opening offsets, object create/update/delete, plus restores of arbitrary history roots) compared full ordered geometry, keys and diagnostics against an independent cold compile after every step: byte-identical in all runs. The permanent test keeps one 24-step sweep over the same edit classes, including an Object membership change and a restore every seventh step.
- **Diagnostics that depend on authored values.** Wall heights of 0.2 / 0.5 / 1.0 / 2.95 producing `opening_over_height` matched cold on both the full and the delta path. Held.
- **Historical snapshot integrity.** Restoring a root captured before a membership change returned exact geometry and issues, left the newer roots intact, and left the restored root byte-identical to its own cold compile; branching from an old root after restoring a newer one also matched. Held (the pipeline suite keeps this contract).
- **Frozen-capture path.** COW candidate → `immutableF4Data` → `linkClonedCowCandidate` → compile matched the from-scratch build, mesh fingerprint included, at every fifth step of a 30-edit run. Held.
- **Index invalidation.** COW moves, deletions and creations that reuse anchors produced no stale indexed answer in the sweep above, including the swept-bounds contraction cases. Held.
- **Restore cost.** Restore performs no entity evaluation, no source materialization and no digest: 1 root restored, 0 evaluations, 0 materialized slots, 0 digests in the committed history rows. Held.

### Current commit map

| Commit | Read for |
| --- | --- |
| d47c25e1 — perf(layout): retain persistent edit roots | Persistent vectors/maps; lazy source/compiled adapters; spatial replacement; immutable proof/capture/codec sharing; generated seal; indexed render installation; focused falsifiers |
| bd443412 — test(perf): count complete S06 edit work | Same-operation baseline replay, isolated cold oracle, exact output/source comparisons, full named counters, sampled allocation, reachability and corrected E5 definitions |
| 5cdccb79 — perf(layout): restore historical topology roots | Session-owned snapshots across membership changes; constant root retirement of transient caches; cold reset; deferred clone vector seeding |
| 0156eac1 — test(perf): count full spatial query work | Complete radix bucket writes and baseline output exits; varied query positions; explicit history probe reachability |
| 48126338 — fix(layout): skip unchanged borrowed ranges | Backing-range equality and full-array visitation proofs keep lazy splits from hiding linear diff/seal walks; 100,000-slot count falsifier |

The documentation/evidence commit records the exact measured code revision, not a fictitious
post-review verdict. The unrelated production-shell-wireframe README edit is excluded.

### Falsification map

Paths below are relative to the repository root; the linked tests retain their whole contracts.

| Claim / failure to seek | Source to inspect | Decisive falsifier / evidence |
| --- | --- | --- |
| A one-Wall edit does not shallow-copy N unrelated source slots | layout-source-collections.ts, cowMoveJunctions / cowMoveRigidWall in layout-world-index.ts | [storage roots / clone handoff](../../../../../apps/editor/tests/lib/layout/t1s06-persistent-storage.test.ts); [complete pipeline](../../../../../apps/editor/tests/lib/layout/t1s06-persistent-pipeline.test.ts); source-slot counters in the replay |
| Path copying preserves old branches through rotations/deletion | persistent-store.ts | Storage test's oracle branches, AVL height and non-power-of-two vector diffs |
| No old document/world closure keeps an unbounded ancestor chain | sourceRecordViews, compileSourceViews, weak COW metadata, prepared cache | 110-edit real coordinator reachability probe, bounded 16-entry cache test, raw heap/external/array-buffer fields |
| Fixed refit degrades; adaptive partitions maintain measured locality | layout-bvh.ts | [spatial falsifiers](../../../../../apps/editor/tests/lib/layout/t1s06-persistent-spatial.test.ts); 100,000-entry / 2,048-edit varied-query replay |
| No universal logarithmic range claim survives accidentally | Morton key, union augmentation, irregular and sorting paths | Equal-centroid empty-result adversary; all-overlap and irregular populations; inspect ALL node/entry tests and maintenance, not node-visit alone |
| A formerly absent dependency is discovered | swept query, changed Junction incidence, reverse Room/Opening maps | [swept differential](../../../../../apps/editor/tests/lib/layout/t1s06-swept-bounds-differential.test.ts); [existing incremental contract](../../../../../apps/editor/tests/lib/layout/t1s06-incremental-compile.test.ts); cold full outputs |
| Area sign certification cannot silently diverge through cancellation/drift | WalkSummary / areaRoundingBound / incremental contributions | [area certificate](../../../../../apps/editor/tests/lib/layout/t1s06-area-certificate.test.ts): repeated edits at 0, 100,000 and 100,000,000 offsets against forced cold success/refusal/output; review the error-envelope derivation independently |
| Known immutable history restores without reconstructing entities | reuse.snapshots, restoreImmutableCompileSnapshot, transient root replacement | Pipeline tests cover membership changes, separate sessions, branching and reset; actual undo/redo raw counters |
| Deep immutability is a fact, never a substitute for admission | immutable-json.ts, f4/immutable.ts, units validation/canonicalization | Shallow freeze, exotic, accessor, alias and mutable parser-output controls; [codec sharing](../../../../../apps/editor/tests/lib/layout/t1s06-codec-sharing.test.ts); [canonical form](../../../../../apps/editor/tests/lib/project-model/units-canonical-form.test.ts) |
| A custom/modified sampler cannot poison canonical caches | isCanonicalWallSampling and compile entry guard | [snapshot seal / sampler](../../../../../apps/editor/tests/lib/layout/t1s06-compiled-snapshot-seal.test.ts); existing sampling observation contracts |
| F4 still captures before async, refuses stale/ABA/locks and preserves source bytes | immutable capture, qualified prepared artifact, Stage host finally cleanup | [F4 acceptance](../../../../../apps/editor/tests/lib/authoring/f4-acceptance.test.ts), [structural sharing](../../../../../apps/editor/tests/lib/authoring/f4-structural-sharing.test.ts), [unit acceptance](../../../../../apps/editor/tests/lib/authoring/f4-unit-acceptance.test.ts), [Stage host](../../../../../apps/editor/tests/lib/authoring/stage-host-acceptance.test.ts); accepted source/JSON digest equality |
| Deep Stage freezing does not eagerly flatten queries or Floor IDs | sealCompiledLayoutSnapshot, deferred primitive fields | Snapshot seal tests; complete materialize counters must stay zero on the indexed local path |
| Changed Junction joins reach neighbouring Wall meshes and old buffers release | diffCompiledWalls, layout-wall-representation.ts, geometry adapter | Pipeline cold/retained install plus [Wall representation](../../../../../apps/editor/tests/lib/render/layout-wall-representation.test.ts) and [object representation](../../../../../apps/editor/tests/lib/render/layout-object-representation.test.ts) |
| No canonical source or visitor ownership moved | Source adapters, common immutable fact, Stage admission | [Stage admission](../../../../../apps/editor/tests/lib/authoring/stage-source-admission.test.ts), full F2/resource suites and the complete architecture lane |
| Performance evidence did not time only evaluation or favour a query split | replay operation boundaries, forced index installation, separate observer/time windows, rotating gaps | [raw evidence and commands](./evidence/persistent-2026-10-25/README.md); exact revision/source manifest, all samples, cold and cross-revision digests |

### Conclusions the review must not inherit

- Eight entity evaluations in the Room fixture are a subset of total cost. A cloned container is
  still work; native source arrays, parser visits, bytes and output remain separate columns.
- Current snapshots are runtime persistence, not a new serialized persistence or content identity.
  Existing SHA-256 and canonical bytes remain unchanged.
- An immutable compiled root restores in constant root work. A full Stage reconciliation,
  membership-changing renderer fallback, source import or frame is not thereby constant time.
- A first-write copy of an unowned mutable standalone input is distinct from borrowing the
  already immutable accepted source. A weak lineage miss must fall back safely.
- A flat count between two sizes is not an asymptotic proof. Spatial tested nodes can still be N;
  stronger 4D reporting structures exist and their space/persistence costs are evaluated in the dossier.
- OP-1/2/3 are unratified hypotheses. No inverse journal, Merkle root, new unit-envelope version,
  partial Save protocol or GPU batching contract has been installed.

### Round 3 verification actually run (final tree)

Targeted by design: the takeover's own files and the lanes' members, not the whole suite.

| Gate | Result |
| --- | --- |
| `check:layout-core`, `check:project-model` | pass (`tsc --noEmit`) |
| `check` (svelte-check) | 0 errors, 0 warnings |
| `test:arch` | 22 files / 180 tests pass |
| S06 fast files (storage, incremental compile, codec sharing, area certificate, snapshot seal, plan-box index, swept differential) | 7 files / 40 tests pass |
| `t1s06-persistent-pipeline` (heavy, run explicitly) | 6 tests pass in 61.9 s |
| `t1s06-persistent-spatial` (heavy, run explicitly) | 7 tests pass in 339 ms |
| Wall / object / shadow representation suites | 5 / 5 / 10 tests pass |
| Temporary differential probes | 5 written, run, deleted; no probe file remains |

**Recorded omissions.** The full `test:fast` (≈ 2.5 k tests) and the full `test:heavy` lane were not
rerun; only their S06 members and the two heavy S06 files above. Bench 1/2/3, the E5 census, the
2,048-operation spatial replay with its adversaries, allocation profiling, the browser/H9 framebuffer
differential and every new large-fixture sweep were **not** run. The takeover's prior full-suite
result (202 files / 2 524 tests, build, both package checks) at 48126338 stands as recorded in the
evidence README and was not re-established here.

### Analytical complexity assessment of this round's corrections

No correction adds O(N) work; the table is the whole cost argument, and the bounds below are
source-derived, checked against the committed counts rather than re-measured.

| Correction | Before | After | Retained space |
| --- | --- | --- | --- |
| `retained()` world branch | O(1): `summary.rooms`, `compiledObjects.length` | O(1): two vector lengths and `layoutLength` (O(1) on a flat authored array, O(log N) on a borrowed vector root) | none |
| Dead `nextOpeningsToApply` | O(k) allocation + k pushes per delta with k changed Openings, live until compile end | only the `changedOpeningHostWallIds` set remains | −O(k) |
| Precondition comments | — | — | none |

For orientation, the takeover's bounds as inspected this round (the committed counts that fix the
constants are in the evidence record):

- **Per-edit compile:** O(k log N) storage path work + O(k) entity evaluation + O(m) output, k = changed + affected entities, m = rebuilt compiled records. Committed counts: 512 copied vector slots / 161 allocated nodes at 7 143 Rooms; 224 / 77 at 31 250 freestanding Walls; 8 evaluated entities per Room edit.
- **Snapshot seal:** O(changed entities) through `visitUnseen`, not O(N). The 48126338 backing-range equality proof is what stops a split from hiding a linear walk; the 100 000-slot count falsifier is its evidence.
- **Restore:** O(1) root swap plus up to five map allocations; 0 evaluations, 0 materialized slots, 0 digests.
- **`diff`:** O(changed path + changed slots), skipping identical subtrees; it refuses a membership change instead of guessing.
- **Spatial insert/update/remove:** O(log N) nodes plus one Morton key (128 bits at 2D, 256 at 4D); query O(tested nodes + entries + r) with a four-pass radix write for large r (4 × (512 + 2r) bucket writes). The all-overlap adversary remains O(N) and stays documented as such.
- **Unchanged O(N) terms, named so they are not mistaken for the persistent path:** the authored comparison on the non-COW fallback, `compileObjects` over all objects when any object changed, prune's id set on a full compile, source materialization at the capture boundary, and chunk collection when a lazy output array is read.

### Verdict, ownership and next step

**Implementation acceptance verdict — PASS for implementation correctness (reviewed scope);
WITHHOLD for step acceptance.** The reviewed surfaces carry no remaining known correctness defect.
The behavioural defect is pinned by a falsifier that fails on the pre-fix code, and the dead-allocation
removal cannot change output. Step acceptance stays withheld because Bench 2 has not run and the
obligations below remain open.

Unresolved conditions, precisely:

1. **Bench 2 has not run.** F4/F8 at L, the F2 mount cost, F7's idle-frame row and H9's framebuffer differential remain predictions or unrun obligations.
2. **The object representation has fixture-level evidence only** — no L-scale workload carries Layout objects.
3. **`MAX_ADMITTED_HISTORY_CACHE` is an unmeasured count bound**; the retained memory of 52 admitted domains is not attributed.
4. **Membership-changing renderer reconciliation still falls back to a full rebuild.**
5. **T3 review** is still needed for immutable capture reuse, normalized source sharing, the qualified handoff and Stage admission; T2/T3 should review shared renderer compatibility. No new authoritative source contract was introduced. A persistent admitted-source/read contract and any new identity/Save semantics stop at their owner decision; the current native-array/flat-SHA costs are explicit.
6. **Owner decisions** remain: the amended Bench 2 measurement scope and whether the next mount batch is S06's or a follow-on slice.

The requested boundary is **ready for Bench 2**. Do not merge, close S06, close the phase, or treat
this review — or any earlier one — as a performance acceptance of this implementation.

## Historical review records

The numbered sections below preserve earlier review rounds and their dispositions. Their timing
predictions and complexity statements are historical and are superseded by the current map,
implementation record and evidence above.

## 1. Commit map (branch `t1/p02-s06-bench-setup`, PR #190)

Review bottom-up; each commit builds on the one below and stays inside one owned surface.

| Commit | Title | Surfaces | Read it for |
| --- | --- | --- | --- |
| `9d2a594d` | perf(t1): index the S06 geometry joins and topology pair loops | `packages/layout-core/src/**` (T2), two re-pinned layout tests, `perf/census/probe-d1-differential.ts` | the exact-output differential, the indexed joins, the once-built cache keys |
| `91df34e0` | perf(t1): prepare the validated envelope instead of validating it twice | `units/runtime.ts`, `units/validate.ts` (T3), `stage/source-admission.ts`, `probe-d2-accept.ts` | the two validating entry points keeping their meaning while gaining a validation-free half |
| `8fc7bb31` | perf(t1): reuse the admitted value and share unchanged units at capture | `units/acceptance.ts`, `f4/types.ts` (T3), `f4/acceptance-coordinator.ts`, new `f4-structural-sharing.test.ts`, `probe-h5-capture.ts` | the sharing proof, its falsifiers, and the one place caller data is now frozen in place |
| `438f3022` | docs(t1): record the S06 optimize step and its Bench 2 hand-off | `acceptance.md` | claims versus measurements versus predictions, and the open obligations |
| `764175e0` (superseded) | perf(t1): dynamic BVH8, swept-bounds delta certification & frozen plain-JSON memoization | `packages/layout-core/src/**`, `packages/project-model/src/units/**`, `apps/editor/tests/lib/layout/t1s06-swept-bounds-differential.test.ts` | Dynamic BVH8, swept-bounds local delta certification, chunked compile world (B=64), plain JSON frozen subgraph memoization, 0.00 E5 slopes, OP-1/OP-2/OP-3 owner decision package |

## 2. What a reviewer must be able to falsify

| Claim | How to falsify it | Where |
| --- | --- | --- |
| The compiled facts did not move | Run `probe-d1-differential.ts` on `c4ce6c83` and on this tree; the key-free `facts` digest must match for all seven workloads (values in the acceptance record) | `perf/census/probe-d1-differential.ts` |
| Cache-key values changed in encoding only, and nothing consumes them for identity | `apps/editor/src/**` has no `.cacheKey` reader; the two observation digests that hash query keys are re-pinned on the facts digest above | `layout-geometry-keys.ts`, the two `p23b4-*` suites |
| Dynamic BVH8 matches PlanBoxIndex 100% on regular, inverted, and non-finite boxes | Run `t1s06-swept-bounds-differential.test.ts`; all 11 tests must pass | `apps/editor/tests/lib/layout/t1s06-swept-bounds-differential.test.ts` |
| Swept-bounds delta certification proves topological invariance locally | Local moves visit $\le 8$ directory nodes and evaluate $k \le 8$ entities on both small and medium fixtures | `t1s06-swept-bounds-differential.test.ts` §Scale-Invariance |
| Admission lost only redundant passes | Count oracle per accepted result: validations 5 → 2, digest passes 13 → 7, serializations 1 → 1 | `perf/census/probe-d2-accept.ts` |
| Undo/Redo rebinds in O(1) time without recompiling or re-hashing | E5 census proves 0 compiles, 0 entity evaluations, 0 validations, and 0 SHA-256 digests on Undo/Redo | `PERF_WORKLOAD_DIR=perf/.workloads npm run perf:census -- --only e5` |
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

---

# Review hand-off — second batch (H1, H4, H9)

**Status:** implementation review / Bench 2 readiness (2026-10-25). Bench 2 has **not** run and
nothing is merged or pushed. This batch continues the branch at `245dd9a4`; everything the section
above records stays binding evidence, and none of its corrections were reverted.

## 7. Commit map for this batch

| Commit | Title | Surfaces | Read it for |
| --- | --- | --- | --- |
| `1c003057` | perf(t1): compile only the Layout entities an edit moved (H1) | `packages/layout-core/src/**` (T1), `stage/host-acceptance.ts`, `stage/source-admission.ts`, `units/runtime.ts` (T3), `adapters/layout/precision.ts`, two re-pinned `p23b4` suites | the single compiler with a retained store, the differential that includes every `cacheKey`, and the Opening key that now names its host Wall's geometry |
| `9221aa77` | perf(t1): build a Wall's query records straight into the shared builder | `layout-geometry.ts` | the cold path that no longer copies per-Wall record slices — and the AABB reconciliation that a cold compile needs |
| `6e4df860` | perf(t1): retain the Stage's Layout representation and its shadow maps | `lib/render/**` (new), `visitor/VisitorLayoutShell.svelte`, `stage/shell/**`, `probe-h4-representation.ts` | one mesh per compiled entity keyed by its own `cacheKey`, the ordered swap, and what the shell still owns |
| `9bc4774f` | fix(t1): close the review's retention and Stage-wiring findings | the same files + falsifiers | every BLOCKER and MAJOR below, each with the test that would have caught it |
| `fef72f4e` | perf(t1): stop the Stage rendering when nothing changed | `stage/shell/StageCamera.svelte` | the per-frame invalidation that made an idle Stage render |

## 8. What a reviewer must be able to falsify

| Claim | How to falsify it | Where |
| --- | --- | --- |
| A session result equals a cold compile, keys included, for every edit class | `t1s06-incremental-compile.test.ts`; then delete a line from a retention key and watch it fail. Two were verified this way: the Room's first-Wall thickness fallback and the Junction's Floor datum | `packages/layout-core/src/layout-geometry.ts`, the H1 suite |
| The per-edit evaluated set is a property of the edit, not the document | `probe-h1-incremental.ts`: 15.5 / 12.8 / 13.3 entities per edit at S / M / L, with 49 / 225 / 841 in the document | same |
| Cache-key work falls with document size | the probe's second line: 3.3× / 16.5× / 38.9× fewer characters per edit than a cold compile at S / M / L | same |
| The remaining O(N) term is the authored comparison, not evaluation | an unchanged recompile at L costs 3.6 ms with 0 entities evaluated; the per-edit figure is ≈ 4.3 µs per entity | `probe-h1-incremental.ts` + the session's stats |
| A compile rebuilds only the meshes whose compiled value changed | `probe-h4-representation.ts` (throws on a whole-document rebuild): 10.2 / 11.7 / 12.7 of 24 / 112 / 420 at S / M / L | `lib/render/layout-wall-representation.ts` |
| Superseded representation is released, not accumulated | the same probe's ledger: built = disposed at every tier, one live geometry per Wall, zero children after teardown | same |
| A retained mesh equals a from-scratch one | both representation suites compare positions, scales and every position buffer against a fresh build | `tests/lib/render/*` |
| An idle Stage renders nothing, and an orbit re-renders no shadow map | `shadow-invalidation.test.ts` (fake shadow map following three's own early-out): zero passes over 60 orbit frames; the camera task no longer invalidates itself | `lib/render/shadow-invalidation.ts`, `stage/shell/StageCamera.svelte` |
| The plan-box index cannot drop an inverted box | `t1s06-plan-box-index.test.ts`, including a box inverted on both axes | `layout-plan-box-index.ts` |

**Not falsifiable from this tree.** The H9 framebuffer differential needs a browser and was not run;
the mount cost, the F4/F8/F13 timings and the idle-frame count are Bench 2 rows. Predictions in the
acceptance record are labelled as predictions.

## 9. Independent review rounds (this batch) and their disposition

Three independent, read-only reviewers ran in parallel with different lenses (retention proofs;
rendering ownership and lifecycle; scope, evidence and accidental semantic change). Their findings:

| Finding | Severity | Disposition |
| --- | --- | --- |
| A Room's compiled `wallThickness` falls back to `document.walls[0]`, which no Room key named — editing that Wall left every other Room stale | BLOCKER | **Fixed** + falsifier (verified by removing the key line) |
| A Junction's key omitted the Floor id and elevation; a Room's key omitted the Floor id and the sampling flag | BLOCKER | **Fixed** + falsifiers |
| The shell's representation effect returned `dispose()`, which Svelte runs before every re-run — the first edit would have thrown | BLOCKER | **Fixed** (separate update and teardown effects) + boundary assertion |
| Shadow triggers ignored the Room registry and had no safe mode for a model whose meshes arrive after its URL | MAJOR | **Fixed**: `rooms` trigger + per-frame arm for a Scene with a model entity |
| The shadow mode could not change after mount; two mounts could fight over one shadow map | MAJOR | **Fixed**: `setAlwaysUpdate`, ref-counted shared controller |
| The `passes`/`maps` counters were wrong for a pass with no casting light and for point lights | MINOR | **Fixed** |
| The room-derived path created and disposed a material factory per compile | MINOR | **Fixed**: skipped when no Room carries wall detail |
| The Wall representation resolved tints through a Room map it never used | MINOR | **Fixed**: neutral constant; the factory receives the Wall's own id, so behaviour is identical |
| The H1 probe printed the cold key count as "incremental"; the H4 probe only printed | MINOR | **Fixed**: real incremental counts; the H4 probe throws |
| The inverted-box defect had no direct test | MINOR | **Fixed**: `t1s06-plan-box-index.test.ts` |
| Retention keys' preconditions were undocumented (process-constant sampling derivation; a Junction resolver pure in the key's facts; `sameAuthored` total on plain records) | MINOR | **Documented** where the reliance is |
| The object representation has no L-scale workload (the cached workloads carry no Layout objects) | MAJOR (evidence) | **Recorded as a gap**, not claimed closed |
| A pre-existing heavy test exceeds vitest's 5 s default under full-worker load on this machine | MINOR (evidence) | **Recorded**; the test is untouched, passes alone, and the lane passes at `--maxWorkers=3` |

## 9b. Re-review round on the fixed tree

A fourth independent reviewer re-examined the fixed tree against seven claims (key completeness,
`sameAuthored` totality, post-failure store state, cross-document reuse, the index's superset
property, mesh-key completeness, disposal balance, shadow state). It found **no BLOCKER and no
MAJOR** and confirmed each claim; its five MINOR/NIT observations were disposed as follows.

| Finding | Severity | Disposition |
| --- | --- | --- |
| The H4 probe still passed a second argument to `update()`, advertising a Room-presentation input the representation no longer has | MINOR | **Fixed**: argument and unused import removed |
| `stats().cold` tested only Walls and Room sources, so an object-only document's second compile reported cold while its objects were reused | MINOR | **Fixed**: every unit class is tested, and a new case compiles a document with objects and no Walls/Junctions/Rooms twice |
| The planners' shared store lives for the module's lifetime and has no release path | MINOR | **Documented** in the module: bounded by one document (pruned every compile), not observable, and the Stage host owns a separate store released with its closure. No teardown hook was invented for it |
| A `cacheKey` is a JSON string, where `NaN` and `null` collapse; mesh retention compares strings | NIT | **Documented** as a precondition, discharged by canonicalisation rejecting non-finite numbers |
| `ShadowMapLike` had no `enabled`, so a disabled shadow map would still be counted | NIT | **Fixed**: counting requires `enabled !== false`, with a test |
| A second mount of a shared shadow map has its own `requestFrame`/`canvas` ignored; duplicate authored ids would orphan one mesh | NIT | **Recorded as accepted limits**: the shadow map has one owner by design, and the codec's id-uniqueness invariant is what prevents duplicates |

## 10. Verification actually run (this tree)

| Gate | Result |
| --- | --- |
| `check:layout-core`, `check:project-model`, `check:camera-core` | pass |
| `check` (svelte-check) | 0 errors, 0 warnings |
| `test:fast` | 164 files, 2,180 tests (at `--maxWorkers=3`; one pre-existing heavy test times out at full worker count under external load) |
| `test:arch` | 22 files, 180 tests |
| `test:heavy` | 9 files, 125 tests |
| `probe-h1-incremental`, `probe-h4-representation` | re-run here; counts in the acceptance record |

**No browser benchmark was run.**

## 11. Known risks after this batch

1. **F2 open at L stays ≈ 1.8–2.6 s (predicted)** — the mount population is still one component per
   Room surface and portal; Walls and objects are imperative now.
2. **The per-entity authored comparison is ELIMINATED** — swept-bounds delta certification locally certifies topological invariance in $O(k)$ time ($k \le 8$), bypassing the historical 3.6 ms whole-document walk.
3. **F4/F8 at L are predictions (≈ 80–120 ms)** — plausible against 200 ms, unproven until Bench 2.
4. **H9's framebuffer differential is unrun** — the count oracle is landed; the image equality is an
   E5 obligation.
5. **The object representation has fixture-level evidence only.**
6. **An idle-stage regression would be silent in the lanes** (no headless renderer): the wiring is
   pinned by source assertions, the behaviour by Bench 2's F7 rest-frame row.

## 12. Owner decisions required before Bench 2

1. **Amended measurement scope** — ratify omitting grid-XL *timing* and the sweep latency rows, while
   keeping grid-XL's functional clause (no crash, no > 1 s block, honest progress/refusal) and H9's
   framebuffer differential.
2. **T3 review** of the optional compile-session parameter on `prepareValidatedUnitRuntime` /
   `admitSource`.
3. **The next mount batch** — imperative Room-surface/portal representation as S06's next work, or a
   follow-on slice.
4. **Earlier owner hypotheses (OP-1, OP-2, OP-3)** — superseded by the corrected analysis in [`../../broad-research/spatial-computation-architecture.md`](../../broad-research/spatial-computation-architecture.md):
   - **OP-1:** History/source representation hypothesis; no zero-byte history guarantee or inverse-journal decision.
   - **OP-2:** Separate identity/Save migration hypothesis; a hierarchical hash changes identity and gives logarithmic path work, not constant full Save.
   - **OP-3:** Cross-Domain Batched & Instanced GPU Rendering (replaces per-surface Svelte mounting with uniform buffer updates).
5. The already-open Bench 1 sweep-H10 drag-row question still does not block.

**Proposed Bench 2 command** (lean scope, ≈ 2.5–3.5 h):

```
npm run perf:bench --workspace @portfolio/editor -- --label bench-2 --tiers grid-S,grid-M,grid-L --no-sweep-latency
```
