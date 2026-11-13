# E4 — Compile and candidate ownership: implementation design

**Packet:** E4 = I2 + G1 + I5 ([execution schedule](./execution-schedule.md#e4--compile-and-candidate-ownership-i2--g1--i5)).
**Specifications:** [I2](./slices.md#i2--one-read-path-for-compiled-geometry),
[G1](./slices.md#g1--candidate-previews-once-per-distinct-candidate),
[I5](./slices.md#i5--opening-symbols-come-from-the-layout-plan-representation), decomposition
[contract L](./decomposition.md#l--layout-adapter-e4-x5-x6), owner decisions D1–D3.
**Base:** `main` at `bc9d2662` (E0, PR #318). **Tier:** 1 (I2/G1 Tier 1; one facade lifetime
detail, below). Revised after a fresh-context architecture review (findings 1–11 folded in). This note fixes the lifetimes before code; it introduces no new algorithm, cache
authority, authored field or dependency.

## 1. Baseline as built (characterised)

| Owner today | Lifetime | Disposition |
| --- | --- | --- |
| Passive record (`layout-geometry-delta.ts`, `WeakMap<document, {geometry, issues}>`) | document object | **Becomes the one session-less read** (§2) |
| `compiledBySource` in `project-model/scene-planning/support.ts` | module, document-keyed | **Deleted**; reads the entry |
| `plannerCompileSession` in `adapters/layout/precision.ts` | **module singleton**; survives project close holding one document's units | **Replaced** by a project-epoch compile context (§3) |
| Host `compileSession` + `admittedByContentId` (`host-acceptance.ts`) | host = project epoch | Unchanged (already epoch-owned; admission/undo cache, outside E4) |
| Session-less compiles in `candidate-preview.ts` (×4) | per call | Through the compile seam (§3, §4) |
| `starterBlockingIssueMessages` (starter gallery) | test-only | Moves into its test (§2) |

Counted per still tick at M (E0): 1 compile (`compile:walls` 112) + 1 `candidate:paper-build`; 3D
Opening compiles twice; Opening Repeat and Circle replan every tick (`previewOpeningRepeat`,
`planCircleDraft` inside `candidatePreviews`). The facade calls `candidatePreview` from the route's
refresh, i.e. per tick.

## 2. One canonical read path (I2)

`compileWallFirstLayoutGeometry(document)` without a store, under canonical sampling and no
sampling test observer, **returns the passive record for that document object when the record was written while the
document already carried a deep immutable-JSON proof** (`sealed` via `verifiedFrozenSource`, the same
proof `restoreImmutableCompileSnapshot` requires; `Object.isFrozen` alone is shallow and proves
nothing, so a shallow external freeze is never sealed). A record written before a late freeze is
never served; the next compile rewrites it sealed. `countWork('compile')` and `compile:passive-read` increment,
`compile:walls` does not. The result is `{ geometry: record.geometry, issues: [...record.issues] }`
— the same geometry object, a fresh issue array. Identity is the key: a structurally equal but
distinct document compiles; an unfrozen document (a planner candidate) always compiles, and its reuse
is carried by the per-binding candidate memo (§4), not by the record. No content-keyed cache.

- **Widening is local.** Only the session-less call site records issue-bearing results, with
  `clean = issues.length === 0`; seeding (`seedReuseFromPassiveCompile`, `seedFromCompiled`) reads
  only clean records, as today. The exported `recordPassiveCompiledGeometry` stays clean-only. The
  host's linked-clone records (geometry compiled for an equal cloned document, issues =
  `domain.warnings`, equal because blocking documents are refused before install) are an existing
  reuse of equal content and are kept as is.
- **Fresh entry for oracles.** `compileWallFirstLayoutGeometryFresh(document, sampling?)` never
  reads a record (and records nothing). Every cold-oracle and differential site (`t1s06-*`,
  `perf/regressions/persistent-cold-oracle.ts`) moves to it, so a session compile can never be
  compared with its own record. Mutation proof: a corrupted delta result fails a named differential.
- **Shared result.** Session-less callers may now receive a shared (possibly deep-frozen) geometry;
  the layout-core consumers only read it. A test-lane check asserts records are unchanged after the
  mounted gesture flows.
- `compiledBySource` (`project-model/scene-planning/support.ts`) is deleted; it reads the entry.

**Guard (`compile-entry-boundary`, arch lane).** Under `apps/editor/src`, only
`stage/host-acceptance.ts` and `adapters/layout/compile-context.ts` may reach a compile function
(`compileWallFirstLayoutGeometry`, `compileWallFirstLayoutGeometryFresh`,
`compileLayoutGeometrySource`, `createLayoutCompileSession`, `withLayoutCompileSession`,
`activeLayoutCompileSession`); `recordPassiveCompiledGeometry` / `readPassiveCompiledGeometry` only
in `host-acceptance.ts`. Specifiers resolve through `tests/helpers/import-closure.ts`; aliases, local
re-exports, `export *` barrels, namespace and dynamic imports are followed. The unused import in
`layout.adapter.ts` is removed; the starter gallery's test-only `starterBlockingIssueMessages` moves
into its test (its comment claimed a route refusal no production code performs). Indirect compiles
stay allowed on purpose because they reach the canonical read: `prepareValidatedUnitRuntime`,
`resolveSceneSupport`, layout-core planners.

## 3. Project-owned compile context and adapter binding ownership

**New** `adapters/layout/compile-context.ts`:

```ts
type LayoutCompileContext = {
  /** Run one planner step with this project's session bound (seeded from the accepted baseline). */
  plan<T>(accepted: LayoutDocumentWallFirst, body: () => T): T;
  /** The canonical session-less read (passive record or one compile). */
  compiled(document: LayoutDocumentWallFirst): CompiledLayoutGeometryResult;
  retained(): { walls; junctions; rooms; objects };
  dispose(): void;   // idempotent: reset store → retained() = 0
};
```

- **Owner:** `createAdapter(services)` — invoked exactly once per facade / acceptance-host pair
  (`mountStageAdapter`, project epoch), so the context lives for one opened project. It wraps every
  Layout planner it registers (`prepare` → `context.plan(accepted layout, prepare)`); `layoutPlanner`
  binds no session; no module singleton remains. Direct test callers of `createLayoutPlanners()` run
  cold (equal by the session's construction proof).
- **After dispose** `plan()` runs its body with **no** session bound and leaves the store untouched,
  so a late `prepare` (the disposed adapter stays reachable from session disposables until route
  teardown) cannot refill it; proved by `plan()` after `dispose` with `retained()` still 0.
- **Bindings borrow, never own.** A rebind (every accepted install) disposes the binding and builds a
  new one over the same context; binding disposal never disposes the context.
- **Release — the one facade detail.** Each factory registration gets one shared, once-only "end
  registration": dispose the current binding, then call the factory adapter's own `dispose`. Both
  `endAdapters()` (facade dispose) and the registration's `dispose` call it. Type comments on
  `StageAdapter.dispose` are updated ("for a factory adapter: ends the registration"). The Scene and
  Light factories define `dispose` only on their bindings, so no current factory changes behaviour
  (pinned by a test). No new member, no route change. The facade file is E3/X4's; E4 changes only
  this.

## 4. Candidate presentation and memo (contract L, G1 step 1)

**New** `adapters/layout/candidate-presenter.ts`, one per live binding, created in `bind` and
disposed with it. It owns the binding's candidate memo and calls `candidate-preview.ts` (which keeps
conversion: plan evaluation, `buildPaperPlan`, filtering, datum lift) with **compiled geometry** from
the context — `candidate-preview.ts` no longer imports the compiler.

- **Presentation slot (one entry).** Key = candidate document identity, reading
  (`plan|face|attempt`), the facade's retained `plan()` result identity, datum, subject/affected
  id-set contents; attempt key = accepted document identity, `wallId`, `offset`, `kind`, `profile`,
  `width`, `height`, `sillHeight`. A hit returns the same previews; a miss builds once and replaces
  the entry. A non-finite Plan target is never retained by the facade, so `plan()` returns a new
  identity and the memo misses — correct; the still-pointer proofs use a finite target.
- **Proposal slot (one entry), Opening Repeat only.** Key = accepted document identity, opening id,
  count, spacing. `previewOpeningRepeat` mints a capture per call; the memo pins the preview ids for
  its lifetime; the commit's capture is unaffected.
- **Circle needs no memo.** The hover already holds the plan in `inkPreview`; the preview branch reads
  it instead of calling `planCircleDraft` per tick. `commitCircle`'s own plan is untouched.
- Gestures whose candidate document is already state (Ink chain/Box/Arc, Opening placement, scalar,
  mark, circle radius/translate) key on that document's identity; a still pointer builds nothing.
- **3D Opening:** the face reading no longer builds the Plan Paper it discarded; it checks
  `plan().kind` for the same null condition and reads compiled geometry once.
- **Invalidation and release:** keys are identities of current state, so a hit is never stale.
  (a) each `candidatePreviews` tick drops a slot it did not consult (end/cancel ⇒ next tick
  releases); (b) the binding's terminators call `presenter.reset()`; (c) rebase/install disposes the
  binding and its presenter. Room duplicate keeps its existing per-gesture memo.
- **Not changed:** refusal semantics, candidate/release correspondence, preview ids/roles/labels,
  the facade's single projection.

**G1 step 2** (preview session seeded from the accepted compile, changed-wall Paper) is decided only
after step 1 on a remaining-cost measurement (per-move counts, plus the one D1 named trace if a
browser session can run). Without a trace it is recorded **declined/unmeasured**; the step-1 bound
stands.

## 5. Opening-symbol parity (I5)

The compiler's Opening centre frame, centre polyline, `sampledIsClosed` and `OPENING_CENTER_EPSILON`
move into the leaf `layout-geometry-curve.ts` (beside `pointAlongSamples`, importing nothing from the
compiler); `compileOpening` calls them. They take an explicit **unclamped** mode used only by the
attempt path, because a refused attempt stays at its raw dimensions and may overhang a Wall end
(`pointAlongSamples` clamps). `openingPlanSymbol` moves from `stage/paper-plan.ts` into
`layout-core/layout-plan-representation.ts` as the one builder over an Opening description
`{ kind, width, center: {point, tangent}, centerPolyline }` and the host Wall thickness, returning
`{ segments, dashedSegments }`. Accepted Paper passes the `CompiledOpening`; the attempt passes the
description built from the compiled host Wall's samples. The hand-built construction in
`candidate-preview.ts` is deleted (today the attempt swings from the tangent, the accepted from the
normal — the accepted wins). The unused `openingPlanSymbolSegments` is deleted. No import cycle:
`layout-plan-representation.ts` is imported only by `index.ts`.

## 6. Proof plan

| Gate | Test (fixture: certified `grid-M` / `grid-L`, `counting-scene`; E0 seam) |
| --- | --- |
| Frozen identical document 0 compiles, same geometry; unfrozen and distinct equal documents W; issue-bearing reuse; observer bypass; fresh entry never reads | layout-core unit + `stage-counting` |
| Closed project releases context (`retained()` → 0, also after a late `plan()`); rebind borrows same context; binding disposal does not release it; Scene/Light factories unchanged | mounted facade + host + real adapter |
| Still pointer 60 ticks: `candidate:paper-build` ≤ 1, `compile:walls` ≤ W — wall chain (Plan), Opening placement (3D), Opening Repeat (Plan + 3D), Circle | mounted adapter, grid-M |
| Each changed pointer: exactly 1 build; output equals an un-memoised build | same |
| End / cancel / rebase empties the memo | same |
| Candidate and accepted Opening symbols equal segment-for-segment (door, window, curved host); overhanging attempt unclamped | `layout-candidate-preview` + layout-core |
| Mutation proofs: restore module singleton / per-tick compile / private symbol copy → named test fails | recorded in PR |
| Dense differentials (`t1s06-*`, cold oracle) on the fresh entry; corrupted delta fails one | moved oracle sites, green |
| Records unchanged after mounted flows | mounted gate |

Rollback: step 2 (if any) removable alone. Otherwise revert the compile seam with its consumers
together; no dual path, no persisted change.

## 7. Implementation notes (amendments found while implementing)

- **Circle uses a proposal memo, not `inkPreview`.** The hover's `inkPreview` is not the preview
  branch's input in every state, so `circleDraftPreview` holds `planCircleDraft` in the proposal slot,
  keyed by accepted document, chain capture identity, ink thickness/height and the circle's centre and
  radii (the minted capture is excluded, as for Repeat). The commit still plans for itself.
- **Planner compile handover.** A proposal planned and then presented in one frame (Opening Repeat)
  would compile its result twice: once inside the bound session, once on the read. The context's
  bound session records its last compile `{document, result}`; `compiled(document)` takes it once
  when it is the **same object** (fresh issues array), and `plan()` / `dispose()` clear it. It is a
  one-shot hand-off of a result the session already holds, not a second cache.
- **`finalizeCandidate` (layout-core `layout-duplicate.ts`)** compiles through the bound session when
  one is active (`activeLayoutCompileSession()?.compile`), so planner-internal compiles reuse the
  project's units instead of compiling cold beside them.
- **I5 frame shape.** `openingCenterFrame` also returns `yaw` computed from the un-normalised
  tangent, so `compileOpening` output stays bit-identical.
- **G1 step 2: declined (unmeasured).** After step 1 a still pointer does zero work after the first
  tick in every gated scenario, and each distinct candidate costs one whole compile plus the
  planner's own (bounded by the session). No browser trace was run, so the changed-wall Paper step
  is not justified by measurement and is not implemented.
- **Counters.** Besides `candidate:paper-build`, the still-pointer gate counts
  `candidate:opening-build` (3D outline and refused-attempt symbol) and `candidate:proposal-plan`
  (a proposal-slot miss), so a per-tick Repeat/Circle replan or 3D outline rebuild fails the gate,
  not only a per-tick Plan Paper build.
- **Where the proofs live.** I2 read: `tests/lib/layout/e4-canonical-read.test.ts`; guard:
  `compile-entry-boundary` (arch); G1 and lifetimes: `layout-candidate-memo`; I5:
  `tests/lib/layout/e4-opening-symbol-parity.test.ts`.
- **Mutation proofs (recorded).** A module-singleton session in `precision.ts` fails
  `compile-entry-boundary`; disabling both memo hit paths fails all seven still/changed-pointer
  gates; a drifting private symbol copy fails the four I5 parity cases; a delta that treats any two
  numbers as equal fails four `t1s06-incremental-compile` differentials. Each was reverted.
