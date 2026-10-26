# T1.P02.S06 — optimize step: review handoff

**Status:** independent review round 3 complete (2026-10-25) on the persistent-root takeover and its
H1/H4/H9 integration, through `6c077295` (both findings fixed) and `606edcc5` (the round-3 record),
with the harness-only `4890b23b`. Two findings were substantiated — one behavioural
(`session.retained()` answered differently depending on which store shape served the last compile)
and one dead allocation — and both are fixed with falsifiers. The rest of the review's observations
are documented preconditions, not code changes. No expensive performance work was re-run. Bench 2
ran as the owner-approved **diagnostic** pass and remains contaminated/non-acceptance. The owner
direction of 2026-10-26 replaced the formal Bench 3 **for S06** with the decision-driven milestone
gate, implemented and independently reviewed below and executed on the designated machine; the
results are adjudicated in the [acceptance record](./acceptance.md#s06-milestone-gate-owner-direction-2026-10-26).
The formal 10-run method is unchanged for other consumers, and S06 step acceptance remains separate;
nothing is merged.

## S06 milestone gate (owner direction, 2026-10-26)

**Owner direction.** Bench 1 was more expensive than the engineering decision required. The S06
gate is now **decision-driven**: measure until the engineering decision is clear, verify
correctness independently, and spend additional samples only while uncertainty could change the
decision. The milestone supersedes the formal Bench 3 **for S06 only**. The formal 10-run method,
every budget, the workload definitions and the original Bench 1/Bench 2 meanings stay unchanged;
a later consumer that needs formal statistics still uses the 10-run method. The
[owning contract](../../../../reference/components/performance.md#s06-milestone-decision-method-owner-amendment-2026-10-26)
is amended to authorize the method, and the acceptance record carries the execution and adjudication.

**What one sample is.** A run is one independent repetition (a fresh cold context, or one more run
in the warm/repeat-use context). Pointer events inside a run are not independent experiments; each
decision row uses one p95 per independent run.

**Decision rule.** With budget `B`: a **pass** requires at least three independent runs and every
run's p95 at or below `0.75 B` (25 % headroom); a **fail** requires at least three runs and every
run above `B`; anything else is **borderline**, which spends exactly one more independent run at a
time to a bound of 10 (F7: 5). At the bound the contract's pooled p95 decides, with the instability
recorded. Frame rows pass at the display floor ±0.05 ms rather than 25 % below it, because a 25 %
band below a 60 Hz refresh interval cannot be entered by an observed frame. A row that cannot
produce three usable runs by its bound is a failure of evidence, never a pass.

**Coverage.** F2 cold+warm at S/M; F3 input latency, latest-input age, frame-time p95/p99 and long
tasks, F4 completion and F8 Undo/Redo warm at S/M/L; the per-edit Layout compile at M; F7 warm
p95/p99 with zero long tasks at S/M; F13 cold and repeat-use ten-cycle growth at S/M/L; the full
E5 matrix. F13's first measured cycle is a one-time first-load sample for both cold and repeat-use;
steady growth starts at the second measured cycle and is normalised to ten cycles. Cold/repeat-use
F3/F4/F8 are one-run checks, F2 L and F7 L are Target rows and F13 warm is one cycle: recorded,
never statistical gates. A.6, the delayed-preview proof, F2 repeat-use, F7 cold/repeat-use, grid-XL,
realistic-L and the sweep latency rows are **not measured**; the manifest and every row name them,
and no omitted row may be read as passing.

**Implementation.** `perf/lib/milestone.ts` owns the pure rule; `perf/lib/profile.ts` owns the
milestone plan; `perf/lib/browser.ts` enforces the bounded one-run-at-a-time extension; the four
flow specs attach one verdict per decision row; `perf/bench.ts` aggregates every promised decision
row (15 rows for the S/M/L milestone) and is the only pass-scoped acceptance authority. Per-flow
reports record `passScoped: false` and are never evidence on their own. The bench refuses a
milestone label that does not name the method and never combines its own early stop with the
milestone extension. Machine provenance, the pinned Chrome build, the lock, load/thermal/power
snapshots and contamination handling are Bench 2's unchanged.

**Independent review before execution.** Two read-only reviewers checked the rule and the
provenance/claims. Their substantiated findings and fixes:

| Finding | Fix |
| --- | --- |
| F7's escalation would have failed its own `toHaveLength(3)` assertion on any borderline row | assert `>= plan` and `<= 5` |
| F7's verdict omitted the contract's hard p99 clause | pooled p99 checked; breach keeps the row open below the bound and fails at it |
| F3's budget was adjudicated without its frame-time p95/p99 or long-task clauses | the drag's own rAF intervals and long tasks are measured per run; F3-frame is a decision row |
| F3/F4/F8 could silently drop an undecided row from `milestone:verdicts` | one entry per row, including `undecided`, with its rule |
| a missing completion mark silently shrank a per-run sample | completion counts per run are recorded; a run with none is unusable |
| F13 compared 9 cold intervals with a 10-cycle budget | growth is normalised to ten cycles; the first measured cycle is excluded for both cold and repeat-use as a one-time first-load step |
| `acceptanceEvidence` was true for a bare flow report and was row-unaware | per-flow reports are `passScoped: false`; the manifest requires all 15 promised rows to report `pass` |
| F2/F7 did not pass their completed-run count into the bound | `completedRuns` is threaded through, so a bound with too little evidence fails |

The first execution then caught a further real defect the review could not see: the cold F13
baseline was index 1 (the first-load cycle) instead of index 2, turning 2.1 MiB of steady growth
into a 10.9 MiB false failure. The fix is covered by unit tests using the measured series shape.

**Verification.** The focused milestone/profile suites pass (24 tests); the targeted perf typecheck
reaches only the two pre-existing `registry.ts` Buffer overload errors; a milestone grid-S smoke
passes with the new F3 frame evidence; a real grid-L F13 cold/repeat-use run passes at 2.55/2.54 MiB
normalised growth after the baseline fix. The final measured pass and its adjudication are recorded
in the [acceptance record](./acceptance.md#s06-milestone-gate-owner-direction-2026-10-26).

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
| 6c077295 — fix(layout): count retained units the same way in both store shapes | `session.retained()` parity; invalid-object storage falsifier |
| 606edcc5 — docs(t1): record independent S06 review round 3 | Review handoff and acceptance record |
| 4890b23b — perf(perf): bound harness reads and add decisive early stop | In-page ledger reads, settle sampling, browser facts; opt-in early stop; the first strategy draft |

The documentation/evidence commit records the exact measured code revision, not a fictitious
post-review verdict. `4890b23b` also carries an unrelated `prototypes/production-shell-wireframe/README.md`
edit; it is outside every measured surface and is not part of the S06 claims.

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

The requested boundary is **ready for the diagnostic pass described below**; a formal Bench 2
verdict still needs the owner's ruling on the sample plan and pass structure. Do not merge, close
S06, close the phase, or treat this review — or any earlier one — as a performance acceptance of
this implementation.

### Final candidate round (2026-10-26): the merged tree

**What was reviewed.** The branch head after integrating `main` (merge commit `d7600576`, main
`51dcb764` into the reviewed S06 head `86fb631e`, corrections committed as `d89554b1` — that code SHA
is the candidate; everything after it is this record), plus the corrections that round produced. Two
reviewers read it and edited nothing: one on correctness (the seven merge resolutions, the delta
certificate, `applyDelta`, lazy output/snapshot isolation, the live-target wrapper, `wallUnchanged`'s
pairing) and one on ownership/provenance (Bench provenance, acceptance authority, lifecycle and
visitor fences, and the test-policy changes made during integration).

**What a reviewer must still be able to falsify.** Unchanged from the maps above, with three new
obligations the merge created:

| Claim | Falsifier |
| --- | --- |
| A memoised unit revision is byte-identical to the recomputed one | `units-canonical-form.test.ts` (revision equality and phase list) and `verifyUnitContentRevisions`, which never reads the memo |
| A caller passing neither new option behaves exactly as before | the two `verifyUnitDependencyLocks` call sites (admission passes only the known id, Save passes only instrumentation) |
| A plan read after a later evaluation still describes its own generation | `layout-plan-locality.test.ts` “keeps a returned plan describing its own generation after a newer evaluation”, which fails without the per-evaluation `fork()` |

**Disposition.** One merge-induced attribution defect, one provenance finding and three
comment/documented-invariant corrections; nothing was weakened to make a lane pass. The defect: the
merge left Save's `verifyUnitDependencyLocks` call positional against the S06 options-object
signature, so the already-measured `save.lock-source-id` digest ran unmeasured — fixed to
`{ instrumentation }`. Identity, refusals and every resolved digest were unaffected. No semantic or
identity defect was found in the merged tree. One reviewer's order-dependence finding was dismissed
on inspection (the revision memo is written only for deeply frozen values, and that test's literal is
never frozen). One F9 interpretation caveat is now recorded in `perf/README.md`: attributed Save work
depends on whether
the frozen revision memo serves the digest, so rows and benches must be compared at like cache state.
The detail, the complexity table and the verification commands are in
[the acceptance record](./acceptance.md#final-integration-review-and-bench-3-candidate-2026-10-26).

### Branch integration status

`main` (`51dcb764`) is an ancestor of the branch, so PR #190 is mergeable with no rebase and no
rebase-shaped loss of benchmark provenance: every S06 commit keeps its SHA and Bench 1/2 pass
composition is unchanged (`perf/bench.ts`'s `TIER_FLOWS` did not move). Resolving the merge
autonomously was correct for the seven routine conflicts; nothing there changed a budget, threshold,
flow definition or another team's contract. **No change to Bench 3's comparison conditions was made**,
and the only interpretive shift is the frozen-memo F9 caveat named above and in `perf/README.md`.

**Ownership boundary, precisely.** This round reviews implementation correctness and integration, not
performance acceptance, and it is not a T3 sign-off. T3 review is still owed for the Plan evaluator's
retention protocol, the compiler-delta certificate and the Plan-key/retained-target change; the
acceptance-authority files keep one digest authority and the same refusal codes, so no new contract
was introduced. **Bench 3 remains the owner's** — it is the only place any of these locality gains
become a measured claim.

## Bench 2/3 strategy: implemented diagnostic Bench 2 (2026-10-26)

**Status:** owner-approved and implemented. Bench 2 is a diagnostic pass; it counts as the second
authorized pass but cannot discharge a statistical acceptance gate. The formal method is reserved
for Bench 3. The harness-only reductions recorded earlier remain implemented and smoke-verified;
the formal sample plan and every benchmark default are unchanged when no profile is named. Bench 2
and Bench 3 have not run. Every wall time below is read from the retained Bench 1/1b result files in
the machine's results directory (`$TMPDIR/biskiq-perf-results/`), not re-run.

### The measured cost is the sample plan, not setup

Bench 1's per-flow wall times (measured rows, three cache states):

| Flow | grid-L | grid-M | grid-S | What dominates |
| --- | ---: | ---: | ---: | --- |
| F3/F4/F8 | 4,678 s (78 min) | 1,159 s (19 min) | 564 s (9 min) | 5 drags + 5 precision commits + 20 Undo/Redo cycles per run, 10 runs/state |
| F7 orbit | 1,051 s (17.5 min) | 887 s (15 min) | ~800 s (13 min, inferred) | ~30 s/run: 10 s orbit, 4 s idle, 8 s D1 all-visible windows, setup |
| F13 lifecycle | 675 s (11 min) | 180 s (3 min) | ~60 s (inferred) | 10 cold + 10 repeat-use cycles at 20 edits, plus warm |
| F2 open | 168 s | 23 s | 13 s | 10 opens/state at L's 5.1 s open |
| F2 old (A.6) | not run | 138 s | 15 s | planner rebuild inside every setup |
| stage traces | — | 160 s | ~50 s (inferred) | 5 traced windows, one open |
| E5 counts/pixels | 858 s (all workloads) | | | 7 workloads, one warm session each |

The whole-pass ceiling is 3 h 36 min. **Setup is 4.8–8.7 % of the L drag wall** (71–142 s per
cache state) and 76–79 s per F7 state; across the pass all setup is about **15–16 min**. The
often-cited ~450 opens therefore cost roughly **10–15 min**, not three hours. The rest is the
ratified interaction plan hitting L's measured per-edit cost (F4 636–670 ms, F8 519–536 ms,
F3 164–166 ms): 3,000 pointer inputs and 50 drag / 50 precision / 200 undo observations per state.

That is also why the previous harness pass saved only 7–13 min. The remaining overhead inside a
drag state is real but is **per-sample UI**, not per-open setup: its 1,500 s is roughly half measured
input/completion waits and half Index selections, Undo/Redo clicks, forced-GC reads and Playwright
polling. Cutting runs, samples or cycles is the only lever of the required size, and it is a
sample-plan decision, not an orchestration fix.

### Consolidation candidates, with verdicts

| Candidate | Saving | Verdict |
| --- | ---: | --- |
| F3, F4 and F8 share one open and interaction sequence | already done | No further share: each run is exactly that consolidation, and its 5/5/20 samples are the cost |
| Keep F2's cold context and run F3's cold setup in it | ~1 min/pass (11 opens/tier) | **Reject.** Couples two measured flows for a rounding error; F2's measured context becomes F3's carrier |
| Run F7 before the edits in F3's session | ~4 min at L (30 opens) | **Reject.** F7 would still start from the opened peak, but F3/F4/F8 would then start after a 10 s orbit and two camera fits; the reverse order is worse because the drag path leaks +2,968 live geometries per accepted commit at L |
| Merge F13 into another flow | large on paper | **Reject.** F13 measures open/close cycles and heap growth; sharing removes the lifecycle it measures |
| Merge the stage traces into F3 | small | **Reject.** The trace session also traces F2's open and F7's orbit; five windows in one session is already the consolidation |
| Merge E5 with a tier flow | ~14 min | **Reject.** E5 uses museum/sweep workloads and count/pixel semantics; no compatible session |
| Drop cold/repeat-use where the row is not a cache-state row | large | **Reject.** Contradicts the contract's every-row cache-state rule |
| A.6 old-method rows only in Bench 1 | 2.5–3 min/pass | **Owner decision.** A.6 says "inside Bench 1"; repeating it in 2/3 is not required |
| Delay proof once per harness revision, not per pass | ~3 min/pass | **Owner decision.** Bench 1 proved it; the correlation code is unchanged |
| F7's D1 all-visible windows on the last run per cache state | ~9–13 min/pass | **Owner decision.** D1 says "inside each run"; the orbit timing still has 10 runs |
| F8 20→5 cycles/run, F3/F4 5→3 samples/run | ~26 min/pass | **Owner decision.** Keeps 10 runs, 60 inputs and every cache state; reduces within-run observations |
| F13 20→10 edits/cycle | ~5 min/pass | **Owner decision.** Keeps 10 cycles and the per-edit retention reading |

**Consolidation ceiling: about 10–15 min/pass** from the sharing that is actually valid. Reaching
2 h 30 min requires changing the within-run sample plan, which is a measurement-methodology
decision, not an orchestration fix.

### Lean formal plan (not ratified)

Still the full contract shape: 10 measured runs per flow × cache state, 60 pointer inputs per drag
run, cold/warm/repeat-use, N1, every hard tier, E5, traces and the real chooser.

The earlier proposal changed, only with owner ratification:

| Change | From → to | Observations kept | Saving/pass |
| --- | --- | --- | ---: |
| F3/F4 in-session samples | 5 → 3 per run | 30 drag + 30 precision per state (1,800 inputs) | ~15 min at L, ~6 min M+S |
| F8 Undo/Redo cycles | 20 → 5 per run | 50 undo + 50 redo per state | ~11 min at L, ~6 min M+S |
| F7 D1 all-visible windows | every run → last run per state | the two windows on 3 runs instead of 30 per tier | ~12 min |
| F13 edits per cycle | 20 → 10 | 10 cycles, heap per cycle + per edit | ~5 min |
| A.6 old-method rows | Bench 2/3 → Bench 1 only | — | ~3 min |
| Delay proof | every pass → once per harness revision | — | ~3 min |
| **Total** | | | **~48–61 min** |

**This plan is not ratified and is not implemented.** It is not represented by
`PERF_PROFILE=diagnostic`; the formal defaults remain the Bench 1 method. The review's assessment of
the two duration cuts the owner asked about:

- **F8 20 → 5 cycles is not only a statistical reduction.** It shortens the deepest Undo/Redo
  history exercised by the measured row from 20 commands to 5. The 50 undo observations per state
  still give a usable completion distribution, but they no longer exercise a deep stack, repeated
  redo invalidation or late Undo/Redo correctness in the pass. The separate lifecycle/history tests
  are correctness evidence, not this benchmark row. **Recommendation: do not ratify the F8 cut for
  Bench 3** unless a 20-deep Undo/Redo proof is run in the same pass. Keeping 20 cycles costs about
  17 min across the hard tiers.
- **F13 20 → 10 edits weakens cumulative leak detection.** It halves the edits per cycle (and the
  total measured edits) while keeping 10 cycles, so a leak that appears late in a long edit sequence
  is less likely to be seen; the per-edit slope is also computed from half the points. The separate
  110-edit reachability/replay evidence is not the F13 heap row. **Recommendation: keep 20 edits for
  Bench 3** unless the owner accepts weaker leak sensitivity and adds a separate deep-cycle measured
  proof.
- F3/F4 5 → 3 samples is the least risky cut: it reduces the p95 resolution of 30 observations per
  state (from 50) and nothing else; 1,800 pointer inputs per state remain.
- F7 windows on the last run per state keep the orbit frame row and all-visible evidence on every
  cache state, at reduced repetition. This is an attribution-coverage cut, not a timing-row cut.
- A.6 and the delay proof as Bench 1 evidence is reasonable while the admission/correlation code is
  unchanged; re-run them if that code changes.

Without the F8 and F13 cuts, the lean plan saves about **25–35 min** rather than 48–61 min, putting a
formal pass at about **2 h 50 min – 3 h 05 min** before product gains. With all six changes it would
be about **2 h 25 min – 2 h 45 min**. These are arithmetic from the retained Bench 1 walls, not a
new measurement.

### Implemented diagnostic Bench 2 (not acceptance evidence)

**Status: owner-approved and implemented at the head of PR #190.** Bench 2 is a diagnostic pass.
It counts as the second authorized pass, but its rows **cannot discharge a statistical acceptance
gate**. The formal, ratified method is reserved for Bench 3. Bench 2 has not been run.

The diagnostic plan is selected by `PERF_PROFILE=diagnostic` or `perf:bench --profile diagnostic`.
The formal sample plan and measured behavior are unchanged when no profile is named; reports gain
provenance fields and the tiered test names name the states they actually run.

| Flow | grid-L | grid-M | grid-S |
| --- | --- | --- | --- |
| F2 | cold 3 + warm 3 opens | cold 3 + warm 3 | cold 3 + warm 3 |
| F3/F4/F8 | warm 3 runs × 2 samples; cold 1; repeat-use 1; 5 Undo/Redo cycles | same | same |
| F7 | warm 1 run (10 s orbit, idle, both all-visible windows) | warm 1 | warm 1 |
| F13 | cold 1 / warm 2 / repeat-use 1 measured cycles; 10 edits per cycle | same | same |
| Stage traces | 1 warm session, 5 windows | — | — |
| A.6 / delay proof | not run (Bench 1 evidence) | — | — |
| E5 | full seven-workload count and framebuffer matrix | | |

The measured totals are 18 F2 opens, 30 drags + 30 precision commits (1,800 pointer inputs), 75
Undo/Redo cycles, 3 warm F7 runs, 12 measured F13 cycles plus 6 discarded warm-up cycles (180 edits
including warm-ups) and 5 traced windows. F1 and the preview-lifecycle transferred rows also use the
diagnostic `RUNS` (3); they are not S06 hard rows and remain non-acceptance.

**Real interactions are preserved.** The diagnostic uses the real Open-source-JSON chooser, real
pointer drags and typed commits through the shipped input path, the real preview presentation mark,
real Undo/Redo, the real New Project/Back lifecycle, actual cold/warm/repeat-use contexts, rAF frame
sampling, the D1 all-visible windows, post-GC heap/ownership reads, the full E5 framebuffer
differential and the existing trace provenance. No timing is synthesized and no measured window is
replaced by a shortcut.

**What is directly comparable to Bench 1.** Same workloads, digests, build, boundaries, network N1,
browser pin, viewport and cache-state definitions. Medians of the diagnostic rows can be read beside
the Bench 1 medians for direction and gross magnitude. F7 frame intervals are still computed over
hundreds of frames in one run. E5 is directly comparable because it is count/pixel equality, not a
sample distribution.

**What is not comparable.** F2 has 3 opens per state instead of 10 and no repeat-use row, so no p95
or spread. F3/F4/F8 warm rows have 6 completion observations instead of 50, and cold/repeat-use are
single-run checks (2 observations), not distributions; their p95 is not a formal p95. F7 has no
cold/repeat-use and one start per tier, so run-to-run variance is unknown. F13 has one cold cycle and
only two warm cycles, so heap growth is a check, not a leak trend; the retained-per-edit slope uses
10 edits. Reads of medians are diagnostic-only and must not be quoted as hard-row acceptance.

**Expected duration: 40–50 min** on the Bench 1 machine, not the earlier 35–45 min sketch. The
arithmetic: build/serve/pre-flight ~2–3 min; 180 s cool-downs before M and S = 6 min; full E5
~14.3 min; transferred rows ~2.5 min; grid-L matrix ~13–18 min (F2 ~0.7, F3/F4/F8 ~5–7.5, F7 ~0.6,
F13 ~1.5–2, traces ~3–5); grid-M ~3–4 min; grid-S ~1.5–2 min. The extra over the sketch comes from
keeping 10 F13 edits and 3 warm F3 runs. If S06's per-edit completion has fallen as targeted, the L
drag and F13 terms shrink.

**Owner decisions implemented**

1. **Option A.** Bench 2 is the diagnostic pass; Bench 3 carries the formal statistical acceptance.
   The S06 plan and acceptance record are amended accordingly.
2. **Diagnostic sampling profile.** Approved as above, including warm-focused coverage, limited
   cold/repeat-use checks, representative F7/F13 observations and full E5 correctness evidence.
3. **Bench 1 baseline.** Preserved unchanged as the historical baseline; no Bench 1 row is
   reinterpreted.
4. **Early stop.** Implemented, default-off, hard rows only, never a pass. See the review finding
   below for the correction made before handoff.

**Owner decisions still open**

1. **Bench 3 lean plan.** Not ratified. In particular, the F8 20→5 and F13 20→10 cuts are not
   recommended for formal acceptance without a separate deep-history/deep-cycle proof.
2. **Bench 3 early stop.** If wanted, it must be passed explicitly (`--early-stop`); it remains off
   by default.
3. **Borderline diagnostic.** If the diagnostic lands near a hard budget, the owner decides between
   another optimization step and letting Bench 3's 10-run p95 settle it. A diagnostic p95 is never
   that decision.
4. **Targeted formal M run.** If L is clearly healthy but M is borderline, a full M-only pass is a
   possible compromise; it is not acceptance for the whole slice without the owner's ruling.

### Implementation and independent review

Changes in the tree:

- `perf/lib/profile.ts` and `perf/lib/config.ts`: the two sample plans, profile parsing, per-flow
  cache states/run counts,  actual-plan limitations, and a `REDUCED_PASS` that now also notices a reduced warm-up or F13
  cycle count.
- `perf/bench.ts`: `--profile` / `PERF_PROFILE`, diagnostic label and tier refusal, profile in the
  child env and manifest, diagnostic omissions, and false `acceptanceEvidence` for smoke,
  diagnostic, reduced or partial-hard-tier passes.
- `perf/lib/report.ts`: profile, acceptance flag and sample plan in every report; false
  `acceptanceEvidence` for smoke, reduced or diagnostic reports.
- The four tiered flows and `stage-trace` read the profile; the formal paths are unchanged.
- `perf/lib/early-stop.ts` and the F2/F3/F4/F8 flows: opt-in decisive failure stop.
- `perf/lib/flow.ts` and `perf/flows/e5-sweep.spec.ts`: E5's opening-heavy C10 sweep gets a
  600,000 ms open bound (isolated reproduction: H10 2.1 s, C10 322.4 s), and non-crash E5 failures
  name the workload in the abort cause. The C10 open time is setup, not a timing row.

Independent review findings (all fixed unless marked accepted):

1. **MAJOR — early stop could decide before three runs.** The first implementation passed pooled
   observations to `decisiveHardFailure`, so two runs × two F4 samples or one run × 60 F3 inputs
   could satisfy the three-sample floor. That contradicted the documented “three measured runs”
   rule and would have terminated a row after one slow run. **Fixed:** F3 now passes each run's p95,
  F4/F8 each run's minimum completion, so the rule's three entries are three runs, and a decision
  still requires every run beyond the 25 % margin. The row also records
  `earlyStop: demonstrated failure (not a pass)` beside its partial run count.
2. **MINOR — acceptance flag was optimistic.** `startReport` and the bench manifest called an
   acceptance-profile pass acceptance evidence even in smoke, env-reduced or partial-tier runs.
   **Fixed:** smoke, diagnostic, `REDUCED_PASS` and a missing hard tier now set it false.
3. **MINOR — `REDUCED_PASS` missed warm-up and F13 cycles.** A run with `PERF_WARMUP=0` or
   `PERF_F13_CYCLES=1` could still call itself formal. **Fixed:** both reductions are included.
4. **MINOR — diagnostic limitations did not name F13 cycles or the incomplete gates.** **Fixed:**
   the rows now print the actual 1/2/1 cycle plan, sample counts, trace tier and the missing formal
   gates.
5. **Accepted limitation — F7 warm only.** One run cannot measure run-to-run variance; that is the
   diagnostic contract, not a defect.
6. **Accepted limitation — F13 1/2/1 cycles.** It is a leak check, not a trend; formal leak
   acceptance stays in Bench 3.
7. **No finding** in the tier gating, E5 full matrix, real-chooser path, cache-state selection,
   trace provenance or the formal-default path. Consolidation candidates that would couple flows
   remain rejected for the reasons above.

### Verification actually run for this section

| Check | Result |
| --- | --- |
| `npx vitest run --config vitest.fast.config.ts tests/lib/perf/profile.test.ts tests/lib/perf/early-stop.test.ts` | 2 files / 10 tests pass |
| `npx tsc --noEmit -p tsconfig.json` (project-wide) | pass (the perf directory is outside this project config) |
| Targeted `tsc --strict` on the changed perf libraries (`profile`, `config`, `report`, `early-stop`, `browser`) | pass |
| Targeted `tsc --strict` including `bench.ts` and the flow specs | reaches only two pre-existing `perf/lib/workloads/registry.ts` `Buffer`/`Uint8Array` overload errors; the changed files add no error |
| Diagnostic smoke, grid-S (`PERF_PROFILE=diagnostic PERF_SMOKE=1 PERF_TIERS=grid-S`) | 4 flows pass, 1 skipped (delay proof), 34.3 s; rows say `[diagnostic, not evidence]`; F2 cold/warm only, F7 warm only, F13 1/2/1 cycles; a report JSON records `profile: diagnostic`, `acceptanceEvidence: false` |
| Bench refusals (diagnostic label, report-only tier) | exit 2 before taking the lock; no lock left behind |
| Docs gate (`documentation-references` + `parallel-track-gates`, arch config) | 56/56 pass (2 files, 2.8 s) |
| Bench 2 / Bench 3 / expensive probe | **not run** |

The smoke proves wiring and marking, not duration or statistics. Its 34–39 s is a smoke figure, not a
preview of the 40–50 min pass. The flow specs and bench were also loaded and executed by the smoke
and the refusal checks; the registry typing errors are pre-existing and unrelated to this change.

### Owner execution: pre-flight and diagnostic Bench 2

Run from the pushed head (`t1/p02-s06-bench-setup`, PR #190) on the designated MacBook Air M2, on
battery, Low Power Mode off, with the pinned branded Chrome. Node 26.7 is the tested runtime.

```sh
cd /path/to/repository
git status -sb
git log -1 --oneline

# Fresh, reproducible workload cache: S, M and museum are rebuilt and digest-compared (~1.5 min).
npm run perf:workloads --workspace @portfolio/editor -- --verify

# No other pass may be running; a stale lock names its holder.
test ! -e /tmp/biskiq-perf.lock || cat /tmp/biskiq-perf.lock/holder.json

# Pinned browser and declared power state.
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --version
cat apps/editor/perf/chrome-pin.json
pmset -g batt
pmset -g therm
node --version

# Raw results stay outside Git; this also makes the console log easy to find.
export PERF_RESULTS_DIR="$HOME/biskiq-perf-results"
mkdir -p "$PERF_RESULTS_DIR"
set -o pipefail

caffeinate -dims npm run perf:bench --workspace @portfolio/editor -- \
  --label diagnostic-2 \
  --profile diagnostic \
  --tiers grid-L,grid-M,grid-S \
  --no-sweep-latency \
  2>&1 | tee "$PERF_RESULTS_DIR/diagnostic-2-console.log"
```

`--early-stop` is deliberately **not** in this command. With three warm measured runs it cannot
decide before the diagnostic's last run, so it would save nothing; it is meaningful only on a formal
10-run pass. If it is passed anyway, it never changes a pass and is inert in smoke.

**Why these flags.** `--profile diagnostic` selects the implemented plan and marks every row
non-acceptance. A diagnostic label containing `diagnostic` is required by the bench. `--tiers` is
required because the diagnostic refuses the report-only grid-XL and realistic-L tiers. The sweep
latency rows are already off in the diagnostic; `--no-sweep-latency` states it explicitly.
`PERF_RESULTS_DIR` defaults to `$TMPDIR/biskiq-perf-results`; setting it to a stable path makes the
artifacts easy to retrieve. The bench builds and serves the production bundle itself; do not point a
counted pass at a server you started for something else.

**Cache verification.** `perf:workloads --verify` is the workload-cache check: it rebuilds S, M and
the museum and compares canonical digests, and the bench independently refuses missing, stale or
corrupt workloads and records every fixture digest in the manifest. Browser cache state is created
by the harness (fresh context per cold run; one context for warm/repeat-use), not by a user profile
or a manual clear. The rows and the sample plan name each state; F2 runs cold+warm, F3/F4/F8 run all
three, F7 warm only and F13 all three.

**Where the output is.** The console ends with the pass directory. Inside it:

- `manifest.json`: profile, `acceptanceEvidence: false`, exact sample plan, diagnostic omissions,
  tier order, fixture digests, Chrome/pin, machine, start/end load and thermal state, contamination,
  deviations, every phase's wall time and exit, and the total.
- `<stamp>-f2-open-<tier>-chrome.json`, `…-drag-correlation-…`, `…-f7-orbit-…`,
  `…-f13-cycles-…`, `…-stage-trace-…` and the E5/transferred reports: per-row metrics, stats,
  limitations, measured run counts, cache state and the diagnostic label.
- `artifacts/<phase>/`: Playwright artifacts for a failed phase.
- The console log you teed above.

```sh
PASS_DIR=$(ls -td "$PERF_RESULTS_DIR"/*diagnostic-2 | head -1)
cat "$PASS_DIR/manifest.json"
```

**How to read it.** First reject the pass if `aborted` or `contaminated` is true, if the Chrome pin
is mismatched, or if the workload digests are not fresh; do not turn a contaminated run into
evidence. Then use medians and maxima, never the diagnostic p95 as a gate:

| Row | Diagnostic decision band | What it means |
| --- | --- | --- |
| L F4 / F8 | median ≤ 120 ms and max ≤ 160 ms = clear margin; 120–200 ms = borderline; > 200 ms = still missing | Bench 1 was 636–670 / 519–536 ms; this is the main S06 question |
| L F3 | median ≤ 70 ms and max ≤ 100 ms = clear; 70–100 ms = borderline; > 100 ms = still missing | hard row is ≤ 100 ms p95; diagnostic has 6 warm completions, so treat the max as a tail hint |
| M F3 / F4 / F8 | F3 median ≤ 35 ms and max ≤ 50; F4/F8 median ≤ 80 ms and max ≤ 100 = clear; F8 90–120 = borderline | F8 at M was 95–111 ms in Bench 1, the closest row |
| S F3 / F4 / F8 | F3 max ≤ 33; F4/F8 max ≤ 100 | Bench 1 had wide margin; a breach is a regression signal |
| L F2 | cold median ≤ 2.0 s (Target); ~5 s means the mount work is unchanged | Target, not a hard gate |
| F7 | frame-interval p95 ≈ 16.7 ms, no long tasks, frames at rest 0 | one warm run; run-to-run spread is unknown |
| F13 | warm growth small, stage geometries back to baseline, no per-cycle climb | 1/2/1 cycles is a leak check, not a formal trend |
| E5 | H framebuffer equality exact; D/C recorded | count/pixel correctness, directly comparable |

Then choose:

- **Clear margin on every hard row:** prepare Bench 3. Do not run another optimization pass just
  because the diagnostic median is above the old Bench 1 number. Ratify (or reject) the Bench 3 lean
  plan separately; the formal defaults are intact.
- **Clear miss (beyond the hard budget by more than the 25 % rule) at L or M:** optimize the named
  stage, then run the diagnostic again only if the owner rules that it is a new pass. Do not run
  Bench 3 as a discovery tool.
- **Borderline:** the diagnostic cannot decide. Either make the targeted optimization now or let
  Bench 3's ten-run p95 decide; do not record a partial-sample result as a pass.
- **Aborted/contaminated:** fix the cause and ask the owner whether the attempt consumes the second
  authorized pass. The bench never retries.

### Diagnostic Bench 2 result (2026-10-26)

The owner ran the command above as `diagnostic-2` at commit `e8cc2fc0`, from a tree dirty with this
harness work, on AC power with the pinned Chrome, at a start 1-minute load of 4.51 (> 4.0). The pass
built and served the production bundle, ran grid-L, grid-M and grid-S peak-first with the recorded
180 s cool-downs, then aborted at E5 with `exit 1` when C10 missed the 300 s open bound. Totals:
1,860.1 s wall, 13.6 s setup, 360 s cool-down; end load 5.31. The manifest is
`contaminated: true`, `aborted: true`, `acceptanceEvidence: false`. Raw results:
`$HOME/biskiq-perf-results/2026-10-26T09-25-26-100Z-diagnostic-2/`.

**Tier rows against the bands.** Medians span the three cache states; maxima are the worst
measured run. F3/F4/F8 had one cold and one repeat-use run plus three warm runs.

| Row | Measured (diagnostic) | Band | Verdict |
| --- | --- | --- | --- |
| L F3 | input→preview median 15.5 ms, max 25.0 | ≤ 70 / ≤ 100 clear | **clear** (Bench 1: 164–166 ms) |
| L F4 | commit median 94–116 ms, max 151 | ≤ 120 / ≤ 160 clear | **clear** (Bench 1: 636–670 ms) |
| L F8 | undo/redo median 37–51 ms, max 88.5 | ≤ 120 / ≤ 160 clear | **clear** (Bench 1: 519–536 ms) |
| M F3 / F4 / F8 | F3 15.4–15.6 (max 16.6); F4 24.6–37.5 (max 51.8); F8 7.4–10.8 (max 11.9) | F3 ≤ 35 / 50; F4/F8 ≤ 80 / 100 | **clear** |
| S F3 / F4 / F8 | F3 max 16.5; F4 max 28.9; F8 max 14.4 | F3 ≤ 33; F4/F8 ≤ 100 | **clear** |
| L F2 | cold median 5.16 s, warm 5.34 s | ≤ 2.0 s Target (~5 s = mount work unchanged) | **Target miss**, not a hard gate |
| F7 | p95 16.7 ms, max 33.3 ms, 0 long tasks, 0 dropped frames, frames at rest 0, 603 frames | ≈ 16.7 p95, no long tasks | **clear**, one warm run |
| F13 | warm heap 54.91 → 63.66 → 64.31 MiB; repeat 54.78 → 63.69; stage geometries 2,339 and meshes 1,850 constant every cycle; cold growth 53.4 MiB includes first load | no per-cycle climb, geometries back to baseline | **leak check passes directionally**; 1/2/1 cycles, one-time 8.8 MiB step (textures 3 → 6, programs 2 → 4) then +0.65 MiB, not a trend |

**E5, completed after the C10 bound fix.** The abort left no E5 rows (the report is written only
after all seven workloads). The owner then reran only `flows/e5-sweep.spec.ts` under
`PERF_PROFILE=diagnostic`: `1 passed` in 12.3 min at load ≈ 2–3, with the new 600 s C10 open bound.
That rerun is a bare Playwright invocation — no bench manifest, lock or contamination record — and
its report is still `acceptanceEvidence: false`.
`$HOME/biskiq-perf-results/e5-diagnostic-2/2026-10-26T14-52-44-946Z-e5-sweep-chrome.json`.

| Check | Result |
| --- | --- |
| H3 / H10 vs ×1, before and after the fixed edit | **0 / 0 differing pixels** — the asserted gate |
| D3, D10, C3, C10 (recorded, not asserted) | **0 differing pixels** before and after |
| Museum control edit | **3,120 pixels changed** — identical to Bench 1; the check can see a change |
| Fixed-view hashes | identical across all seven workloads (before `a822a5c8…`, after `dd9b2dc6…`) |

| Workload | draws/frame | triangles/frame | live geometries | meshes |
| --- | ---: | ---: | ---: | ---: |
| museum (×1) | 1,447 | 1,116,418 | 926 | 1,372 |
| H3 = D3 (×3) | 3,542 | 2,719,638 | 2,186 | 3,353 |
| H10 = D10 (×10) | 10,526 | 8,067,110 | 6,386 | 9,953 |
| C3 (×3) | 4,679 | 2,917,246 | 3,323 | 4,490 |
| C10 (×10) | 15,443 | 8,921,038 | 11,303 | 14,870 |

Shadow work is flat everywhere (1 map pass, 24 shadow draws/frame), and programs (14) and textures
(34) are constant. Main-pass submission still scales with added Walls: H10 is 10,526 draws against
Bench 1's 10,398 (+1.2 %; museum 1,447 vs 1,421, +1.8 %) — the known one-mesh-per-Wall path (H6),
not a new regression and not a pixel failure.

**E5 count finding — the fixed edit is still whole-envelope.** With `compile = 2` on every
workload, the commit's validation, canonicalization, digest and snapshot work grows with the whole
project rather than the changed Wall:

| Commit counter | museum | H10 | C10 |
| --- | ---: | ---: | ---: |
| `validation:layout-array-entry` | 908 | 6,758 | 8,019 |
| `canonical:utf8-bytes` / `digest:bytes` | 582,932 | 6,020,993 | 8,850,161 |
| `snapshot:generated-property-read` | 604,623 | 6,150,293 | 6,057,175 |

That is a locality finding for attribution under I1's named-global-operations class (I4/H7): the
compile is local, the envelope validation/canonical/digest/snapshot path is not. It is never
presented as local work, and it is a finding, not an E5 assert failure — E5's asserted gate is
pixel equality, which passed.

### What this means for acceptance

The tier rows classify **clear on every hard row** (L F3/F4/F8, M, S, F7, F13), with two recorded
misses outside the hard gates: the L F2 cold Target (5.16 s vs 2.0 s) and C10's 322.4 s open
(setup, never a timing row). E5's full seven-workload pixel and count matrix is now complete and
clean, so E5 no longer blocks Bench 3. But the pass itself is **contaminated and aborted**, so no
diagnostic row is acceptance evidence, and under A.7 the owner must rule whether the attempt
consumes the second authorized pass. Per the bands above, the direction is **prepare Bench 3's
formal method**, not another broad optimization pass: the C10 open cost, the L F2 mount and the
whole-envelope commit path are recorded as named product/owner findings, and any fix landing before
Bench 3 is a deliberate revision that this diagnostic does not judge. Step acceptance remains
withheld until Bench 3; do not close S06, treat a diagnostic median as a hard-row pass, or skip the
formal statistics.

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
3. **F4/F8 at L are predictions (≈ 80–120 ms)** — plausible against 200 ms, checked by the
   diagnostic Bench 2 and settled by formal Bench 3.
4. **H9's framebuffer differential is unrun** — the count oracle is landed; the image equality is an
   E5 obligation.
5. **The object representation has fixture-level evidence only.**
6. **An idle-stage regression would be silent in the lanes** (no headless renderer): the wiring is
   pinned by source assertions, the behaviour by the diagnostic Bench 2's F7 rest-frame row and
   formal Bench 3.

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
