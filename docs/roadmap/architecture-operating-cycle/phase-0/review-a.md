# Phase 0 semantic architecture investigation — Reviewer A

Status: independently completed and frozen locally. This document records candidate evidence only. It does not classify candidates, ratify architecture, propose enforcement mechanisms, or answer the owner's adjudication questions.

## 1. Scope and method

The exact retrospective range was:

```text
f8411f7f0dc8cd0bb8e05683259d7c2aa6a9fdbb..b5f75e7ecba5149ed03a26237402ba5a41266372
```

I first verified the review workspace rather than extending that range. GitHub records PR #76, **Phase 0 — mechanical control pass over the frozen P23 range**, as merged to `main` at merge commit `722280f1e8575b9890f17637b2a56f9229ea437c`. A fresh fetch left `origin/main` at that commit. The review branch contained it, the worktree was clean, and both the frozen brief and `mechanical-control-pass.md` were present. No synchronization merge was required.

The semantic review used the following method:

1. Read §8 of `docs/roadmap/architecture-operating-cycle-plan.md`, the frozen investigation brief, the frozen evidence-range document, and the mechanical control pass.
2. Enumerated the 432 commits and 36 first-parent merges in the frozen range, using the first-parent merge sequence to identify the 45 listed P23 pull requests and direct commits.
3. Inspected meaningful implementation diffs by merge, expanding into individual parents where a merge topology combined more than one PR. PR #55, for example, entered the first-parent history inside `c2a2404`, so its own merge `f3efed9` was also inspected.
4. Used commit-local `git grep`, `git show <revision>:<path>`, and `git diff <revision>^1 <revision>` to establish occurrences, recurrence, and endpoint counts. I did not use today's reference text as evidence of what was authoritative earlier.
5. Retrieved the governing documents from each relevant revision. Before the documentation restructure in `650f7c1`, the durable contracts lived primarily at `docs/architecture.md`, `docs/north-star.md`, and `docs/components/*.md`; after it, the corresponding material lived under `docs/reference/`. Slice plans were treated as authority for their approved slice scope, not as proof that a mechanism was already a durable cross-slice convention.
6. Searched beyond the mechanical pass's three measured structural sets: mutation planning, vertical ownership, curve representation, identity allocation, hierarchy, openings, room reconciliation, delete/dissolve behavior, junction compilation, presentation boundaries, camera/navigation, and test/project organization were also inspected.

The review used merged repository evidence only. It did not inspect another reviewer's branch, refs, worktree, output, or discussion. It also did not inspect unmerged review discussion. Consequently, the evidence below can establish what merged and what the written contracts said, but not every reason reviewers or the owner may have had for accepting it.

## 2. Candidate: a reusable semantic-mutation planner boundary

### Inferred convention

Topology-changing wall-first authoring operations are increasingly represented as pure `@portfolio/layout-core` planners: they accept canonical layout input and semantic intent, return either a deterministic planned result (often an exact replacement `LayoutDocumentWallFirst` plus changed-object lineage) or a named rejection, while editor code owns transient preview state and the eventual history transaction.

This is narrower than “all commands use planners.” The evidence supports a recurring boundary for consequential layout mutations, not a universal result shape or naming rule.

### Occurrence and recurrence

| Revision / merged slice | Concrete occurrence | Contract authoritative at that occurrence |
| --- | --- | --- |
| `d5ec0df` / PR #9, P23.1 | `packages/layout-core/src/layout-wall-first-precision.ts` introduced `PrecisionPlan`, with planned/rejected variants, an exact candidate document, operation kind, and changed IDs. The editor adapter performed the single layout replacement/history action. | The active plan `docs/plans/2026-09-08-P23.1-precise-placement-and-dimensions.md` prescribed this slice's pure candidate pipeline. `docs/architecture.md` assigned canonical layout semantics to `@portfolio/layout-core` and selection/history/UI state to the editor, but did not state a general `plan*` convention. `docs/components/placement.md` already described a pure candidate pipeline for the placement gizmo, so the boundary had an adjacent precedent. |
| `5f20aaa` / PR #18, P23.9 | `WallChainPlan` returned either a committed replacement document with lineage or a named rejection for wall-chain sketching. | The P23.9 plan governed the slice. The same durable package/editor ownership boundary remained in force; it still did not require other semantic mutations to adopt this planner result pattern. |
| `d1705b7` / PR #19, P23.3 | Opening creation and editing added core planning functions and semantic rejection results before editor commit. | The active `2026-09-08-P23.3-openings-that-fit.md` plan governed openings. The durable architecture owned opening validity in layout-core, but did not prescribe this reusable planner form. |
| `c6601f2` / PR #21, P23.4 | `DuplicatePlan` carried a replacement document, created IDs, and final-gate rejection behavior for duplicate/repeat. | The active `2026-09-08-P23.4-duplicate-and-linear-repeat.md` plan governed the operation. Durable contracts divided domain mutation from editor interaction but did not name a common mutation-planning protocol. |
| `59b8e81` / PR #27, P23.6a | `RoomMovePlan` planned a replacement document and explicit rejection without making the editor the semantic mutation owner. | The active `2026-09-12-P23.6a-wall-first-room-unit-move.md` plan governed the slice. The then-current architecture assigned canonical room/wall semantics to layout-core, but did not generalize the planner interface. |
| `2716f61` / PR #57, P23.6c | Wall deletion/dissolve introduced `DissolvePlan`, again returning a planned full document or semantic rejection for editor application. | The active `2026-09-13-P23.6c-canonical-wall-deletion.md` plan governed delete/dissolve behavior. By then the repeated source pattern was substantial, but the durable reference contract still described ownership and canonical compilation rather than a cross-operation planner boundary. |

The name-based endpoint probe reinforces recurrence without proving semantic uniformity: the base revision had no exported `plan[A-Z]*` function in `packages/layout-core/src`; the end revision had 41 such exports across nine modules (`layout-align`, duplicate, room-move, wall-chain, wall-dissolve, wall-first-precision, wall-noding, wall-openings, and wall-topology-ops). Later P23.10/P23.11 work reused or extended these planning surfaces for direct manipulation and curved walls.

### Counterevidence

- The P23.1 placement path was not created without precedent: the then-authoritative placement contract already specified a pure candidate pipeline and one layout transaction for its own adapter.
- Every representative occurrence had an active slice plan, and several source headers explicitly cite that plan. Repetition may therefore reflect separately approved slice designs rather than an independently ratified repository-wide mechanism.
- The endpoint count is deliberately only a search aid. For example, layout alignment can return a position rather than a replacement document; the 41 functions are not 41 instances of one exact protocol.
- The durable North Star already said that the document owning an entity determines its mutation domain. That supports layout-core ownership, though not the more specific planner/result/rejection convention inferred here.

### Limitations

The merged source establishes a recurring implementation boundary, but not whether contributors were expected to copy its names, result types, full-document replacement style, or preview/commit split into every future operation. No unmerged design or review conversation was considered. The candidate therefore concerns the repeated semantic boundary, not a proposed common interface.

## 3. Candidate: Wall-owned vertical authority

### Inferred convention

In canonical wall-first layout data, vertical architectural truth is wall-owned: a `Floor` supplies a horizontal elevation datum, each `Wall` owns an unbounded positive height, and a room's ceiling height is derived as the maximum of its boundary-wall heights. New or split walls acquire height through layout-core birth/inheritance policy rather than an editor- or room-owned vertical setting.

### Occurrence and recurrence

The defining occurrence is `746aa16` (PR #25, P23.6H/I):

- `packages/layout-core/src/layout-wall-first-types.ts` changed the canonical layout to format 5 and documented `Wall.height` as the only authored vertical extent, `Floor.elevation` as a datum without vertical extent, and room ceiling as derived rather than authored.
- `packages/layout-core/src/layout-wall-heights.ts` centralized validation, defaulting, and height selection/inheritance.
- The canonical codec parsed and emitted per-wall height; the compiler derived vertical surfaces and room ceilings from it.
- Editor and Museum wall builders consumed the compiled height rather than inventing a separate room-level or renderer-level authority.

The choice recurred across later work rather than remaining a serializer-only field. `59b8e81` (P23.6a room move) explicitly preserved wall heights through a semantic move; P23.11 curve work retained height on the same canonical Wall representation; and the P23.15 junction compiler partitioned vertical wall faces using the incident walls' per-leg vertical bands.

At `746aa16`, the authoritative durable architecture assigned layout truth and canonical compilation to `LayoutDocument`/layout-core, but searches of `docs/architecture.md`, `docs/north-star.md`, `docs/components/`, the repository agent rules, and the editor test contract found no corresponding statement that vertical truth specifically belonged to Wall, that Floor was datum-only, or that room ceiling was this derived maximum. `docs/components/persistence.md` still described the older room-framed persistence shape. The active plans `2026-09-12-P23.6H-vertical-wall-semantics.md` and `2026-09-12-P23.6I-wall-defined-vertical-envelope.md` were the explicit authority for the slice itself.

### Counterevidence

- The implementation was deliberate and plan-backed: its source comments and both active plans describe the selected model as the final P23 vertical model.
- The then-authoritative compatibility policy allowed pre-baseline schema replacement and did not require a decoder for every intermediate draft schema. The lack of a canonical format-4 decoder is therefore not part of this candidate.
- The general durable ownership rule already located architectural truth in LayoutDocument/layout-core; the unrecorded portion was the more specific allocation of vertical truth among Floor, Wall, and derived Room data.

### Limitations

P23's supported product model was effectively one-floor and deliberately bounded. The evidence does not establish a convention for storeys, slabs, roofs, stepped floors, or any future multi-level model. It establishes only the merged P23 allocation of vertical authority.

## 4. Candidate: the persisted cubic-chain curve model

### Inferred convention

A canonical curved Wall is persisted as a `line | cubic-chain` union in which endpoint positions remain Junction-owned, interior knots have stable IDs, cubic spans are positional rather than independently identified, and the stored control points are the read-path authority rather than values re-derived by renderers or editors.

### Occurrence and recurrence

`9118696` (PR #51, P23.11) introduced the representation:

- `packages/layout-core/src/layout-wall-first-types.ts` defined line and cubic-chain centerlines, stable interior-knot identity, the `spans.length === knots.length + 1` relationship, Junction-owned endpoints, and persisted controls.
- `packages/layout-core/src/layout-wall-first-codec.ts` validated the exact union and cardinality, required stable knot IDs, and did not give spans their own persistent IDs.
- The representation was consumed by the shared curve evaluator, wall-chain planning, curve algebra, precision operations, the plan viewport, and the editor inspector. A commit-local search found ten implementation files using the new curve vocabulary at introduction, spanning core types/codec/geometry and editor consumers.
- P23.15 later reused the P23.11 evaluator facts in junction resolution rather than introducing another curve representation or re-fitting controls.

The then-authoritative `docs/north-star.md` did bound the curved-wall feature to the canonical workflow and explicitly excluded a general CAD/NURBS surface. `docs/architecture.md` also said downstream consumers must not independently resample/reconstruct canonical geometry. However, an exact search at `9118696` found none of `cubic-chain`, curve-knot identity, cubic-span identity, `handleIn`, or `handleOut` in the durable contracts or hard rules. The active `2026-09-14-P23.11-canonical-curved-walls-and-render-safe-validation.md` plan was the authority that selected the concrete persisted model for that slice.

### Counterevidence

- The North Star already required a bounded canonical curved-wall workflow, and the architecture contract already prohibited a second geometry compiler. Those rules substantially constrain the design space even though they do not select this persisted shape.
- The first introduction was a broad, coherent PR: several consumers adopting the representation in that PR are one occurrence with multiple consequences, not independent selections.
- Later uses mostly consume the chosen model. They show that it became load-bearing, but not that the representation was independently reconsidered and selected again.

### Limitations

This evidence is specific to architectural wall centerlines. It does not support transferring cubic-chain persistence, knot identity, or positional span semantics to camera motion, free-form drawing, animation, or a future CAD subsystem.

## 5. Candidate: persisted compact-reference ledger and allocation state

### Inferred convention

Human-readable architectural references are backed by one document-level identity ledger keyed by canonical object IDs. A per-family opaque allocation cursor is persisted as bookkeeping, while authored-change comparison includes durable assignments but excludes cursor-only movement. Provisional previews and durable commits share a latched high-water allocation base so that references retired by undo or abandoned previews are not reused.

### Occurrence and recurrence

PR #55's merge `f3efed9`, incorporated into the first-parent range by `c2a2404` (P23.12), introduced the mechanism:

- `packages/layout-core/src/layout-identity.ts` defined document-scoped compact references for Room, Wall, Opening, and Junction families; distinguished provisional allocation from durable promotion; and maintained a high-water base across create/undo flows.
- `packages/layout-core/src/layout-wall-first-types.ts` added the persisted identity ledger and optional allocation cursor to canonical layout data. Canonical writing emitted the identity state.
- `withLayoutIdentity` and `promoteLayoutIdentity` distinguished assignment changes from cursor bookkeeping. The authored canonical comparison retained assignments but excluded cursor-only movement.
- Editor preview state and durable application used the same identity layer, preventing preview and history paths from allocating from unrelated local counters.

The representation recurred in `368a799` (PR #58, P23.13), where plan labels and hierarchy-facing room identity consumed the shared ledger rather than recomputing presentation labels. By the end revision, hierarchy, inspector/index, plan-label, and persistence paths all resolved references through the same identity layer.

Before the change, the durable North Star required stable architectural display identity but did not define a persisted ledger, family cursors, or the authored-versus-bookkeeping comparison. The active `docs/design/P23.12-final-design-contract.md` and `docs/plans/2026-09-15-P23.12-names-and-stable-display-identity.md` governed the slice. After the documentation restructure, `650f7c1` recorded the user-visible behavior in `docs/reference/components/shell.md`: stable document-unique references, bounded family strings, no reuse, and exact history/persistence behavior. That durable text still described the observable identity contract rather than requiring this particular ledger/cursor representation.

### Counterevidence

- The user-visible requirements were not accidental: the P23.12 final design contract explicitly selected compact, stable, non-reused references, and later durable shell documentation retained those requirements.
- Tests pinned persistence and undo behavior. Those tests are strong evidence for required outcomes, but do not by themselves establish that every future implementation must retain an opaque cursor with the same authored-change exclusion.
- P23.13 recurrence is consumption of the shared P23.12 layer, not a second independent allocation design.

### Limitations

The evidence supports a representation/ownership candidate only for Layout architectural identity. It does not imply that Scene entities, user-facing names, database keys, or transient editor handles should use the same families, alphabet, cursor, or ledger.

## 6. Rules explicitly written at the time that implementation contradicted

The following is separated from the candidates above. It records textual contradictions only; it does not decide why the conflicting change was accepted or how it should be adjudicated.

### P23.0 canonical cutover crossed still-live schema and visitor rules

At the relevant P23.0 revisions, the root `AGENTS.md` hard rules still said:

- Scene SoT was `scene.json v6` with its then-described authored connection-anchor form.
- `rooms.ts` remained canonical until specified gates, new rooms then belonged in LayoutDocument, and layout was not to drive `/museum` before those gates.

Concrete contradictory changes were:

1. `41a5cde` (P23.0b) changed canonical SceneDocument semantics to the world-local Scene format associated with `formatVersion: 1`: conversion emitted version 1 and removed persisted room ownership from canonical entities. `b5427d8` then made the canonical project writer require Layout format 4 plus Scene format 1. This was textually inconsistent with the still-written Scene SoT rule and with the then-current `docs/components/persistence.md`, which described one unversioned canonical Scene shape and the older room-framed Layout shape.
2. `2c9b04d` (P23 staged rollout stage 4) changed the visitor cold-start path from legacy validation/compilation to `prepareCompatibleRuntime`; its wall-first/migrated branch invoked the wall-first layout compiler. That allowed the public `/museum` runtime to be driven by LayoutDocument while the hard rule still prohibited that before its named gates. `32b2e8f` subsequently enabled wall-first layout mutation at the F0 gate while the text remained unchanged.

Counterevidence and limits:

- These changes were part of the ratified P23.0/F0 transition and were supported by the active staged-rollout plans and the North Star's pre-baseline compatibility policy. This section records the contemporaneous text conflict; it does not infer that the implementation direction itself was unauthorized.
- The phrase `scene.json v6` in the old hard rule does not map cleanly to a `formatVersion: 6` field in the legacy source. The contradiction established here is between the old rule's named Scene SoT and the new canonical world-local Scene v1 contract, not a claim that the old JSON necessarily carried that numeric field.
- `650f7c1` (PR #59) later reconciled the durable documentation and hard rules around canonical wall-first Layout format 5 and world-local Scene format 1. That later correction does not remove the earlier overlap inside the frozen range.

No other explicit-rule contradiction met the evidence threshold. In particular, the P23.15 junction work changed and then extended the reference description during the slice; its final Y/star correction left a descriptive warning sentence behind, but the implementation continued to satisfy the contract's core requirements of compiled, deterministic, wall-attributed ownership. I therefore did not treat that sentence lag as a separate explicit-rule contradiction.

## 7. Areas investigated without another meaningful candidate

- **P23.0 compatibility, schema, writers, and visitor entry:** aside from the contemporaneous rule conflicts above, the ownership direction and cutover were expressly covered by the ratified North Star and active P23.0 plans. The mechanical writer/format/import counts were used as evidence, not promoted into a semantic candidate by themselves.
- **P23.8 topology and persistent-room reconciliation:** explicit Junction connectivity, wall-first canonical layout, and stable derived-room reconciliation were already stated in the North Star/architecture contracts. Individual epsilon and polygon details were local implementation policy.
- **P23.1 through P23.10 authoring features:** snapping, dimensions, wall sketching, openings, duplicate/repeat, presets, room move, hierarchy, deletion, and direct manipulation were inspected. No additional cross-slice convention cleared the threshold beyond the planner boundary and vertical-ownership candidate already recorded.
- **Persistence compatibility facades:** retained app-local layout/scene paths looked convention-like by name, but the historical persistence contract explicitly allowed app paths as compatibility facades. They were therefore excluded as already-contracted behavior.
- **P23.13 presentation modules:** hierarchy rows, plan labels, presentation DTOs, and inspector composition were predominantly UI/presentation boundaries. Their reuse of stable references is evidence for the identity candidate, not a separate semantic architecture candidate.
- **P23.14 shell and visual-system work:** the owner-ratified durable shell/visual-system contract existed at `a479f78` before the implementation slices it governed. Those choices were excluded as already-contracted behavior.
- **P23.15 junction compilation:** the implementation kept junction ownership in canonical compilation and updated the durable architecture at `4cae710` and `ae3e724` with network-aware, per-wall deterministic ownership. The investigated final Y/star changes did not establish a separate uncontracted ownership convention.
- **Camera route and motion:** within the frozen range, meaningful camera-core change was limited to Scene type adaptation during P23.0b. No second navigation graph or motion evaluator appeared, and there was no repeated semantic choice to nominate.
- **Visitor/editor dependency isolation:** history inspection found no semantic candidate beyond the already-written isolation rule; the mechanical endpoint scan likewise showed no new editor import in the visitor graph.
- **Project/test organization and late refactors:** package extraction, test-lane organization, and naming/path cleanup in the later P23 range did not introduce a consequential product representation or ownership rule. They were treated as organization or implementation evidence rather than architecture candidates.
