---
kind: proposed research commission and initial evidence packet
status: "Owner review; not a contract, active slice, ratification or implementation authorization"
baseline: 78cafc3a
date: 2026-10-21
---

# RR-4 — Relationships that survive revision

**Round boundary, revised 2026-10-22:** follow the [convergence sequence](../../../docs/roadmap/product-convergence-2026-10-21.md#scope-and-sequence).
Step 1 revised the brief only. **Step 2 executed at revision `ce9b7156`**; `git diff 78cafc3a ce9b7156 --stat`
touches only `broad-research/` and `docs/` prose, so every inspected source is unchanged from the
`78cafc3a` baseline. Results are in [Step 2 results](#step-2-results) and the
[handoff](#handoff-to-the-convergence-lead); the sections before them keep the step 1 brief, with
falsified findings corrected there rather than silently rewritten. Keep the decision handoff in
PR #173, for combined contract and roadmap/DAG reconciliation. The
[owner production hold](../../../docs/roadmap/README.md#production-implementation-hold) includes
previously authorized work; neither a research result nor merge releases it.

## Decision and first consumer

Decide the smallest explicit relationship model that preserves P2 Smart Wall's accepted promise of intuitive, intelligent spatial manipulation **and revision**, including deliberate spacing, surface offsets and understandable repair. Do not reduce that promise to successful first placement, or assume the prototype's solver is the production design. P3 Vellum supplies a second consumer: architectural support and joining during sketch revision. P1's meaningful interactive Presentation requires neither Room, Guide nor Stop; neither consumer may restore those prerequisites. P4 is deferred.

The decision has three independent axes: **pose authority** (world pose or evaluated attachment), **intent policy** (hard requirement, preference or one-time assistance), and **identity continuity** (proved mapping, explicit repair or removal). Choose each explicitly. An attractive following animation settles none of the persisted semantics.

**Proposed commission:** T2 leads the first Scene placement/attachment consumer; T1 supplies canonical architectural geometry and correspondence. Camera and Experience owners review their own downstream policies. Produce a decision packet and disposable geometric/acceptance probes, not a general relationship platform. This brief authorizes no production mutation, phase change, contract amendment, merge or deployment.

## Bounded inputs and initial repository findings

Read the following sections/symbols first; expand only for a failed claim. Paths below are repository-relative. Current facts are separated from older research and destination rules.

| Input | Exact concern and finding |
| --- | --- |
| `docs/README.md`; `broad-research/post-p01-roadmaps/README.md` §§2–6 | Authority route; RR-4 asks for owner geometry, split/reversal/delete, identity non-reuse, Undo/reload, fallback and repair. Prototype acceptance and production authorization are distinct. |
| `docs/reference/architecture.md` §Semantic authorities | Layout owns architecture/hosted Openings; Scene owns object attachments/base transforms; Camera owns framing; Experience owns visitor composition. Project coordination owns atomic acceptance, not relationship meaning. |
| `docs/reference/components/scene-content.md` §Placement, transforms and attachment; `docs/reference/north-star.md` §Stage / World composition and shared assets | **Destination:** attachment is typed host + parameters. Roots default to world-local; internal component frames are distinct. Grouping/proximity never establishes ownership or connectivity. Attachment remains unshipped in the inspected contract. |
| `docs/reference/decisions/northstar-ratification-2026-09-27.md` §§Dependencies, invalidation, and deterministic evaluation; Representation, revision, and atomic authoring | **Normative:** declared reads/outputs and reverse dependency index; reject cycles unless a supported solver/delay defines them. Relationship-specific revision reports: unchanged, recomputed, needs review, unresolved, with cause/action. Retain locked framing; recompute explicitly assisted framing. |
| `docs/reference/composition-execution.md` F.1, F.4, AM-1, AM-3, Extension points and version negotiation | **Normative/current distinction:** reference identity includes domain, revision, subject, instance/location qualification and component/capability. No nearest/name retargeting or read-side repair. One expected revision, composed validation, atomic result and undo. Current unit acceptance/history exists; Undo/Redo mint fresh revisions. Repairable authored state and executable closure are separate. |
| `broad-research/research-6-unified-reconciliation.md` §§2.3, 4.2–4.3 | **Earlier evidence, not rerun here:** E2 reports exact curve arc-length mapping but missing published parametric correspondence and cold continuity. Its A1-first recommendation predates the accepted P2 direction. Its rejection of compound rebasing is a judgment, not an F.4 prohibition. |
| `prototypes/p2-smart-wall/src/core/{types,RelationalSolver,WallSplineEngine}.ts`; `src/App.tsx` | **Source finding:** one sampled Catmull–Rom wall; meter/proportional/apex anchors and gap clusters; first cluster member controls anchor mode. `solveWallReshape` compresses positions when locked gaps cannot fit, while reporting a warning and offering resolutions. Snapshot UI uses local React state and random/time IDs, not the canonical acceptance seam. This proves a concrete interaction hypothesis, not cross-domain/cold persistence. |
| `prototypes/p3-vellum/src/model/{types,runs,settle}.ts`, symbols `Tie`, `resolveTies`, `carryStanding`, `settle` | **Source finding:** explicit endpoint ties coexist with inferred carrying by footprint/height tests. Ties receive three ordered passes; missing hosts clear ties. Overheads follow maximum supporting Room top; loss of all Rooms clears `restsOn`. Room continuity uses overlap/order, dormant seeds and revival. These policies are prototype choices, not proof of convergence, ownership or durable repair. |
| `packages/project-model/src/f4/types.ts` `CorrespondenceEntry`; `apps/editor/src/lib/authoring/f4/acceptance-coordinator.ts` `invertCorrespondence`, `qualifyCorrespondence` | **Current source finding:** correspondence holds before/after semantic references and preserved/created/retired/replaced relation. It supplies no face orientation, interval map, ambiguity or parameter transport. Undo exchanges before/after pairs; that alone cannot invert a lossy many-to-one attachment migration. **Corrected in step 2 (Corr-1):** Undo restores the recorded whole-envelope state, so it does not depend on inverting correspondence. |
| `packages/layout-core/src/layout-wall-chain.ts` `defaultChainAllocator`; `layout-wall-first-types.ts` `LayoutIdentityLedger` | **Current source finding:** default allocation checks currently occupied IDs, not lifetime tombstones. The ledger explicitly concerns presentation references; its cursor is not a canonical entity non-reuse guarantee. Caller-supplied IDs need a separate audit before claiming all accepted operations can re-mint IDs. **Audited in step 2 (Corr-3).** |

**Known gap, not a newly established defect:** the older E2 numerical results and full production delete/recreate path have not been re-executed in this commission. Existing identity-pair correspondence supports selection; it does not establish persistent surface correspondence. Unit F.4 readiness does not discharge that missing domain obligation.

## Externally verified facts and their limited implications

- **Topological naming:** OCCT OCAF records selection information and per-operation topology evolution (modified/generated/deleted shapes) to maintain references. Its algorithms must provide that evolution; an ID or final mesh alone is insufficient input. **Inference:** obtain transport evidence from Layout planners, not an independent Scene reconstruction. This does not recommend adopting OCCT or guarantee automatic naming in every edit. [Official OCAF guide](https://occt3d.com/dev/doc/overview/html/occt_user_guides__ocaf.html)
- **Constraint scope:** Cassowary handles incremental linear equalities/inequalities, including required constraints and strengths for preferences. The authors explicitly distinguish these from nonlinear/non-numeric constraints. **Inference:** equal gaps on fixed arc coordinates can be a bounded linear problem; curved-face collision, changing contact frames and host identity require other owner semantics. A constraint library does not solve correspondence. [Authors' report](https://constraints.cs.washington.edu/solvers/cassowary-tr.html), [authors' constraint discussion](https://constraints.cs.washington.edu/web/mm97.dir/)
- **Containment differs from reference:** IFC 4.3 distinguishes one hierarchical spatial container from zero/multiple nonhierarchical spatial references, including a curtain wall spanning storeys. **Inference:** an object may concern multiple spaces without acquiring multiple transform parents; importing IFC's hierarchy is not a Biskiq requirement. [buildingSMART IFC 4.3 definition](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcRelReferencedInSpatialStructure.htm)
- **Following differs from ordinary parenting:** Blender's Child Of relationship exposes target, location/rotation/scale influence and inverse offset; it is distinct from regular parenting. **Inference:** explicit attachment can preserve pose on attach/detach without placing Layout and Scene in one ownership tree. Blender's transform constraint supplies no wall-split identity contract. [Official Blender manual](https://docs.blender.org/manual/en/latest/animation/constraints/relationship/child_of.html)

Sources verified for this packet; cited mechanisms are evidence for alternatives, not borrowed product requirements.

## Real alternatives and costs

| Alternative | Benefit and evidence | Material cost / failure boundary |
| --- | --- | --- |
| A0 — solve once, retain only world pose | Smallest useful surface drag; free composition remains first class. No ongoing evaluation dependency. | Cannot know the creator intended continued support; cannot honestly report host-intent breakage. Insufficient if the selected consumer promises following; the owner's accepted manipulation/revision finding alone does not select that policy. |
| A1 — world pose plus non-driving provenance; explicit Re-seat | Research 6's conservative option: diagnose moved/deleted host while preserving deliberate pose. Useful for independent placement and deliberate release from following. | Identity integrity and geometry/contact validation still required. Split onto a new child can require re-pick. Frequent repair may defeat P2; cannot label unchanged poses “recomputed.” |
| B — explicit evaluated attachment; migrate only bindings when topology demands it | Scene's host parameters solely determine attached pose. Layout owns surface/frame queries and transport evidence. Ordinary shape edits need no Scene pose rewrite. OCAF supports the need for owner evolution evidence; Blender illustrates explicit relationship offsets. | Requires a cold-safe binding-continuity strategy, exact frames and declared failure policy. Old-ID references cannot follow a retired host merely because yesterday's acceptance had a pair mapping. Add immutable lineage, stable owner component identity, or atomic binding migration; compare below. |
| C — acceptance-time compound rebase to ordinary world poses | Layout intent prepares Layout plus dependent Scene changes and accepts them together. Every accepted snapshot contains direct inspectable transforms; no read-time following graph for those poses. | Couples host edits to dependent planning/validation; larger change/undo results and dependency enumeration. Loses continued intent unless separately retained. Nevertheless valid F.4 architecture, and useful when policies rewrite bindings/poses; reject only with measured cost or a simpler complete model. |
| D — bounded constraint composition, with optional general solver | A declared fixed-order equal-gap group can satisfy simultaneous requirements/preferences more coherently than sequential pushes. Cassowary supplies a real linear candidate. | Priority, tie-break, infeasibility, units, determinism and cycle semantics must be specified. General 3D/contact/topology solving is much larger and outside the active program; a successful linear spacing probe does not authorize it. |

**Provisional recommendation (step 1 proposal; revised in [Step 2 results](#revised-alternatives-recommendation-and-falsifiers)):** offer independent placement (A0/A1) and deliberately attached following (B) as explicit intent, not a mandatory global mode. Favor B for accepted P2 attached objects. Permit C narrowly for binding transport or operations whose meaning is explicitly a coordinated rewrite. Prototype one bounded spacing group before choosing a solver; retain hard/soft distinctions even without a library. Do not make a universal graph, physics system or CAD constraint language a prerequisite.

The earlier synthesis conflates **no continuous Scene pose rebasing** with **no cross-domain mutation ever needed**. A Layout shape edit can remain single-domain when a stable host identity still evaluates. A split retiring a referenced host needs either durable owner-provided correspondence resolution, stable component continuity, or an explicit F.4 binding migration. None may mutate a reference as a read effect. This boundary, rather than “B versus C” as exclusive platforms, is the consequential design decision.

**Falsifiers:** prefer A1 if creators repeatedly choose independent poses and explicit repair completes the same revision task with no material extra intervention. Prefer C over B if B requires unbounded lineage, changes results after reload, or cannot expose a single deterministic accepted result without hidden repair. Admit a bounded solver only if the fixed-order spacing oracle demonstrates a task that sequential policy cannot satisfy predictably. If the canonical owner cannot publish a unique mapping, refuse automatic following for that edit and return a specific repair choice; do not weaken identity silently.

## Semantic questions the commission must settle

1. **Intent and contact:** “placed on,” “follows,” “supported by,” “contained in,” “grouped with” and “component of” are distinct. Which action authors each? Snapping is session assistance unless explicitly promoted. Physical contact alone creates no durable attachment. Architectural support within Layout stays Layout-owned; Scene attachments consume Layout facts without making Walls Scene children.
2. **Coordinate policy:** choose centerline meter distance, end distance, normalized distance or an authored landmark. Reversal must transport side and tangent orientation; do not mirror images merely because start/end reverse. A landmark disappearing or bifurcating is an identity event, not “pick the next apex.” Decide finite panel footprint contact, deliberate stand-off and opening exclusions, not just center-point proximity.
3. **Hard versus preferred:** a locked 0.45 m gap either remains hard and reports infeasibility, or the UI states it is a preference and explains the relaxation. P2's compression warning is useful evidence but does not settle that choice. Distinguish proposed preview positions, accepted parameters and evaluated fallback; never rewrite a hard target silently.
4. **Continuity:** split, dissolve, reversal and replacement need orientation/interval-aware transport. A subject straddling a split may legitimately have no unique child. Deletion/recreation at identical geometry is a new subject absent explicit owner-proved continuity. Undo can restore the same old subject; allocating another subject after Undo must not recycle its identity. Reload must not need the in-memory undo stack.
5. **Cross-domain reporting:** Scene owns attachment validity/light aim; Camera owns locked/assisted framing feasibility; Experience owns whether existing interpretation still applies. A recomputed pose does not prove an explanation remains correct. An invalidation index can be rebuilt from authored references; it is not another authored relationship authority.
6. **Failure and repair:** keep the original unresolved binding, cause and affected identity. Pick new host and Detach are explicit F.4 operations; Detach captures the evaluated pose against the expected revision. An editor may show a session-only last-valid ghost, but a generated pose is not silently serialized as a second authored transform. Decide required Preview behavior separately from authored validity; publication remains outside this commission.

## Unexecuted probes — implementable oracles and stop boundaries

Step 1 executed no probes. Step 2 executed Q1–Q3 and Q6 and deferred Q4, Q5 and Q7 with their triggers; see the [disposition ledger](#q1q8-disposition-ledger). The commands below are reproducible baseline controls, **not** evidence of attachment readiness. From the repository root:

```sh
npm exec -w @portfolio/editor -- vitest run tests/lib/layout/layout-curve-split-primitives.test.ts tests/lib/layout/layout-dissolve-curves.test.ts tests/lib/authoring/f4-acceptance.test.ts
npm --prefix prototypes/p3-vellum test -- tests/hold.test.ts tests/storey.test.ts
```

For a separately scoped scratch execution, use disposable tests importing `@portfolio/layout-core` and the existing F.4 coordinator. Begin from `apps/editor/tests/lib/layout/layout-dissolve-curves.test.ts` and `layout-curve-split-primitives.test.ts` fixtures; consume `planWallSplit`, `planDissolveJunction`, `wallCenterlineCubics`, `wallCurveChainLength` and owner evaluators. Do not reconstruct a competing topology. Use `apps/editor/tests/README.md` focused commands for the scratch file; broader acceptance follows the consuming plan, not these filters.

| Probe | Fixture / implementable oracle | Pass or useful stop |
| --- | --- | --- |
| Q1 — surface transport | Straight 8 m Wall and canonical cubic Wall; panels at arc distances 1, 3, 6 m on both sides; split at 4 m, then dissolve in both survivor orientations. Transport maps old intervals to owner-qualified new intervals with orientation. On reversal use `s' = L − s` and side/frame transport together; verify world contact/tangent agreement. Include a footprint crossing the split and an Opening at the contact. | Shape-preserving split/dissolve preserves world pose within owner numerical tolerances, without mirror. Ambiguous footprint/Opening returns typed review/refusal. Stop and list exact missing owner fields if only identity pairs exist; do not infer mapping from nearest mesh. |
| Q2 — cold continuity choices | Run move → split → reverse/dissolve → save/JSON round trip → fresh evaluator; compare B with (i) bounded persisted lineage, (ii) stable owner component identity, (iii) C binding migration. Compare direct evaluation with composed transport. | Same host meaning, parameter and diagnostic after reload; no renderer/history dependency. Record bytes per edit, resolver work and compaction rule for lineage. A missing bridge produces unresolved, never successful guessed transport. |
| Q3 — identity ABA | Attach to a split child, delete it, recreate identical geometry with the same allocator seed; repeat after Undo + new branch and after reload. Run with default allocator and captured preallocated IDs. Also Undo deletion without creating another subject. | New subject cannot resolve the old binding; Undo restoration may restore it. A failing default allocator is evidence for a canonical allocation obligation, not evidence to substitute the presentation reference. Identify whether tombstones, durable incarnation IDs or allocation policy supplies the guarantee. |
| Q4 — infeasible composition | Four 1 m panels, three hard 0.45 m gaps, 0.1 m end margins: minimum 5.55 m Wall. Shorten to 5.0 m. Test hard versus preferred gaps, active panel at either end, and reordered input arrays with stable IDs. | Hard case reports infeasible and preserves authored gap targets; preferred case lists violated targets/residuals with deterministic priority. Same accepted inputs yield same result independent of prior frames. Compare sequential policy with a bounded linear solver; no curved-collision claim follows. |
| Q5 — support versus parenting | Move a deck under one free object, one explicitly attached object and one Wall whose foot touches/overlaps it; include two supports at different heights. Repeat a support deletion and coincident replacement. | Only declared relationships follow. No footprint-containment parent inference. Multi-support elevation/rotation rule is explicit or returns review; lost reference remains repairable. Use P3's `carryStanding` and `restsOn` as adversarial comparisons, not the oracle. |
| Q6 — atomic migration and history | Layout split plus Scene binding rewrite plus optional Camera assistance prepared against revision R. Inject invalid Scene reference, stale R, thrown planner and rejection after candidate preparation. Successful case followed by Undo/Redo; also merge two source intervals into one survivor. | Exactly one accepted snapshot/undo result or none; no half-followed object. Undo restores exact prior bindings, not a guessed inverse of a many-to-one map; Redo gets a fresh revision. Locked Camera remains locked and diagnoses; assisted Camera uses its owner. If no registered consumer operation admits the intent, stop at the missing contract/provider instead of bypassing acceptance. |
| Q7 — deterministic dependency boundary | Wall → attached image → aimed light and assisted View; additionally propose image → same View → image feedback. Evaluate accepted input permutations and cold reconstruction. | Acyclic results and impact causes agree; undeclared cycle rejects. No arbitrary repeated “settle” passes masquerading as convergence. A specialized solver is a separately declared capability. |

Numerical tolerances come from canonical owner contracts (for curves, use exported `CURVE_ARC_LENGTH_TOLERANCE` where applicable), not screen pixels or a new research-wide epsilon. Record position, orientation, contact residual, target identity, revision and diagnostic separately. Observed UX success cannot substitute for these oracles; geometric success cannot establish creator preference.

## Deliverables, completion and owner routes

**Execution order and bound:** use Q1–Q3 plus Q6 to decide the selected attachment/edit family; include Q4 when persistent spacing is promised. Q5's architectural-support comparison opens only for the P3 support consumer. Q7's Camera/light chain opens only for a claimed dependent capability; ordinary cycle rejection still belongs to any admitted relationship family. Compare creator interventions in A1 versus B only while that interaction choice remains unresolved. Record unneeded probes as deferred with their trigger; do not execute the whole catalogue merely to close this commission.

Deliver **one decision packet** containing: (a) policy matrix for the selected operations/relationships; (b) a Q1–Q7 disposition ledger with results for triggered probes and explicit deferred/blocked interfaces; (c) evaluated-versus-rebased cold-continuity comparison with data/cost measurements; (d) schema/operation sketches with one pose authority and explicit unresolved state; (e) any still-needed A1/B creator comparison, documenting interventions and owner verdict without fabricated numerical UX claims; (f) exact contract departures and a smallest consuming production scope. Disposable tests and raw results are evidence, not new authority.

For the combined reconciliation, name the exact owning contract sections to amend or retain,
the strongest rejected alternative and remaining owner call, any new provider/capability and its
dependency edges, and the next consuming slice to plan. Assess whether native Wall creation or
another proposed first-wave scope must change or wait for a provider. Hand these to the lead;
do not independently edit normative contracts, canonical roadmap/DAG or registration. The lead
folds the chosen amendments and scheduling consequences into this same PR before owner review.

**Pass:** owner can choose the attachment/failure model from competing demonstrated alternatives; each promised automatic operation has unique owner-provided transport or an explicit refusal; cold load, Undo branches, hard conflicts and atomic failures meet the stated oracles. **Stop:** no honest geometry provider, ambiguous correspondence, missing unit/provider, uncontrolled cycle, or a proposed format exceeding the agreed consumer. Return the missing interface and bounded alternatives; do not compensate with nearest matching, independent geometry reconstruction, hidden mutable caches or silent constraint relaxation. A blocked probe is a useful completed finding, not permission to invent its provider.

Owner decisions are distinct: choose UX semantics (attached/independent, hard/preferred, repair/freeze/refusal); choose first supported host/edit families; accept the research recommendation; authorize any production consumer. T1 owns canonical identity/frame/correspondence and architectural validity; T2 owns Scene attachment/pose/spacing and repair; Camera and Experience owners choose their dependent consequences. Project coordination reviews composed validation/history and cold source closure. No track receives blanket scope from this packet.

Current Scene planners declare `compound: false` in `packages/project-model/src/scene-planning/planners.ts`. A proposal for Layout/Scene binding migration must therefore name a jointly scoped intent, planner admission and integration owner before production work. Existing F4 unit acceptance is a reusable boundary, not that missing operation or authorization; the closed T2.P01 scope is not widened by this brief. **Corrected in step 2 (Corr-2):** the compound *admission* provider is landed and live; the missing pieces are the joint operation, a Scene attachment format and per-planner scope enforcement.

New persisted relationship shape or transport semantics goes through the owning domain contract plus [F extension/version negotiation](../../../docs/reference/composition-execution.md#extension-points-and-version-negotiation), with the [gate register](../../../docs/roadmap/README.md#gate-register) where an interface changes. New Layout support/geometry remains Layout-owned. A changed authoring surface follows [PLATE conformance](../../../docs/reference/design-system/editor-shell-and-visual-system.md#conformance-test-for-future-design); changed phase scope follows owner-authorized [bounded replanning](../../../docs/operations/README.md#bounded-replanning). Research completion does not ratify any sketch, reopen delivery, or authorize implementation.

## Step 2 results

Executed at `ce9b7156` with disposable probes in [`probes/rr4/`](./probes/rr4/README.md) (exact
commands, isolation proof and raw output lines there). Baseline controls: editor 57/57 passed;
P3 Vellum 17/17 passed. Probes: 4 files, 14/14 cases passed; the step 3 follow-up added Q8
(5 files, 15/15), then its unavailable-pose branch (5 files, 16/16), run from the repository root. The probe binding,
evaluator and transport are **unratified probe constructs** composed only from exported
`layout-core` primitives; their passing proves feasibility of the measured arithmetic, not a design.

### Q1–Q8 disposition ledger

| Probe | Disposition | Result (observed unless labelled) |
| --- | --- | --- |
| Q1 surface transport | **Executed** (`q1-transport.probe.ts`) | Straight 8 m Wall, panels at 1/3/6 m both sides, split at 4 m: world residual 0 m, facing dot 1. Canonical cubic Wall (L = 9.1347 m): split residual 1.04e-12 m; owner-resolved split distance differs from the request by 4.97e-13 m (within `CURVE_ARC_LENGTH_TOLERANCE` = 1e-6) and is **not returned** by `planWallSplit` — the probe reads it back as the retained fragment's owner arc length. Dissolve, forward survivor: 0 m. Dissolve, reversed survivor: 0 m straight / 4.4e-16 m curved **only with side transport**; keeping canonical `side` lands every panel on the opposite face (0.24 m = thickness + 2 × stand-off, facing dot −1). Footprint straddling the split: owner gives no answer for a Scene subject; the consumer must return review. Opening witness: the owner moved the Opening to `W-b` offset 1.5, identical to the consumer rule (panel `s` = 2), and the overlap was consumer-detected only; the owner refuses a split through an Opening interior but has no Scene-footprint equivalent. |
| Q2 cold continuity | **Executed** (`q2-cold-continuity.probe.ts`), depth: one 4-edit chain, 4 bindings, JSON round trip, fresh evaluator | See [comparison](#evaluated-versus-rebased-cold-continuity). (ii) stable owner component identity: **blocked** — no owner identity survives split (`W` keeps `A→X`) or dissolve (one ID retires); missing interface: a Layout-owned run/component identity persisting across both. |
| Q3 identity ABA | **Executed** (`q3-identity-aba.probe.ts`) | Default chain allocation: draw → delete → redraw re-mints `wall-chain-1`, both at identical geometry and at a different location. Identical redraw is **byte-identical**, so an F.1 `exact` reference to the original Layout content revision resolves the recreated Wall (`resolved`): content identity cannot detect this ABA. Occupancy noding: split at 4 → Undo → split at 6 re-mints `W-b` and `W-split` for a different interval ([4,8] vs [6,8]). Undo of a deletion restores the same subject at the same content revision (legitimate). P23.12 presentation ledger: with the document cursor as base, the undone Wall's token `W-7V24` is re-issued; only the in-memory session high-water base (`W-FJSK`) prevents it. Captured-nonce sketch: recreate and Undo-branch IDs differ; replay with the same nonce is identical. **Live path:** plinth placement captures `nextLayoutPresetObjectId` (occupancy), and `planCommitLayoutObjectPresetWithId` refuses any other captured ID (`invalid_value` for a nonce ID); create → Undo → create elsewhere re-mints `layout-object-1`. |
| Q4 infeasible composition | **Deferred** | Trigger: the owner promises persistent hard or preferred spacing for the first mounted consumer. Solve-once placement and following do not need it; the 5.55 m vs 5.0 m arithmetic is trivial, the decision is semantic (hard/preferred, priority). |
| Q5 support versus parenting | **Deferred** | Trigger: P3 architectural-support consumer opens (RR-1/RR-2 seam). |
| Q6 atomic migration and history | **Executed** (`q6-atomic-migration.probe.ts`) on the live unit-host shape | All five probe planners register under `createUnitPlannerRegistry` (no refusals). Injections leave canonical JSON and history depth unchanged: stale R → `stale-revision`; throw after Layout preparation → `planner-rejected/planner-failed`; NaN Scene pose → `admission-refused/invalid-envelope`; unresolvable target → `unsupported-operation/unresolved-target`. **Persisting a binding is blocked**: an `attachment` field on a Scene entity is refused at `$.units.scene.data.entities[1].attachment` (Scene unit format 2 has no attachment). A compound Layout move + Scene pose rebase accepted once, changing exactly the `layout` and `scene` units. Split then many-to-one dissolve (captured IDs) accepted; three Undos restored each recorded state byte-exactly; Redo minted a fresh revision. **Scope gap:** a planner declaring the landed Scene admission (`domain: 'scene', compound: false`) that also moves a Wall is **accepted**, untargeted and Scene-targeted alike. Camera locked/assisted framing not exercised (Q7 trigger). |
| Q7 dependency boundary | **Deferred** | Trigger: a claimed dependent capability (aimed light, assisted View) on an attached subject. Ordinary cycle rejection remains an obligation of any admitted family. |
| Q8 missing-host repair, cold (step 3 follow-up) | **Executed** (`q8-missing-host-repair.probe.ts`) | One 8 m Wall, two attached panels, `planDeleteWall`, JSON round trip, fresh reader. (i) deletion-time detach: both panels render at an authored pose equal to the last evaluated pose (residual 0 m); no repair pending. (ii) kept as an AM-2-shaped `UnresolvedBinding` plus retained surface parameters: renders nothing; Re-pick, explicit placement or delete only; no pose is recoverable. (ii′) as (ii) with the last evaluated pose as diagnostic-only data: renders nothing (editor ghost only); an explicit "detach at last known pose" recovers 0 m; costs a pose-shaped non-authoritative field. (iii) Detach against the exact pre-delete Layout revision: the F.1 resolver answers `missing` with `reacquire-reference` after reload — the old content is not in the project. (v) the step-2 matrix (Layout-only delete, dangling binding): renders nothing, no pose recoverable, and nothing records that the break was accepted deliberately. Undo before reload restores the host and re-resolves both bindings under every policy (snapshot). Probe-shaped Scene JSON; the Scene format still refuses attachments (Q6). |

Q8's bounded follow-up keeps a curved host present, with one evaluable binding and one beyond its
arc length. Default detach refuses before producing a candidate; the prior Layout and Scene JSON
remain identical. Explicit keep-unresolved and delete-dependents prepare joint deletion candidates
that survive a JSON round trip. The kept records pass `validateUnresolvedBinding`, but their new
Scene container is still a proposed versioned format, not live F.4 admission. Q8 proves pose/data
availability under these policies, not creator preference or a production attachment provider.

### Verified and corrected findings

- **Verified:** correspondence is identity pairs only; `planWallSplit` returns
  `{document, junctionId, createdWallIds, splitWallIds}` and `planDissolveJunction`
  `{document, survivorWallId, retiredWallId, retiredJunctionId, createdKnotId?}`. Interval offsets
  and orientation exist only inside the planners (Opening rebasing). They are **derivable** from
  `(before, after, returned IDs)` plus owner arc length without nearest matching (Q1), but the
  dissolve mirror rule then exists twice — a second-authority risk. Research 6's E2 arc-length
  figure is consistent (4.6e-13 m then; 4.97e-13 m split-distance delta now, on a different curve).
- **Verified:** no exported Wall face-frame query exists; the probe composes one from
  `resolveWallCurveSplit` and `cubicBezierDerivative`.
- **Corr-1 (correction):** step 1 said Undo "cannot invert a lossy many-to-one attachment migration".
  `AuthoringHistory` stores accepted states and Undo reinstalls them (`acceptance-coordinator.ts`
  `restore`); only the returned correspondence is inverted, as advisory data. Q6 measured exact
  restoration. History is therefore not the risk; the risks are non-persisted transport and
  references living outside the snapshot.
- **Corr-2 (correction):** step 1 (and the convergence doc) framed `compound: false` in
  `scene-planning/planners.ts` as the missing provider. `unit-acceptance-v1` is landed and live:
  `createStageAcceptanceHost` builds `createUnitPlannerRegistry` (compound, units) with
  `createUnitAcceptanceAdapter({ compound: true })`. A Layout+Scene planner can register today.
  What is missing is the operation itself, a persistable Scene attachment, and enforcement:
  the dispatcher checks a planner's `compound` against intent **targets**, while the adapter's
  `validateChange` checks changed units only against the adapter-wide flag, so a planner's own
  single-domain declaration is not enforced on its candidate (Q6). Research 6's "compound
  acceptance arrives with the cutover" is likewise superseded.
- **Corr-3 (audit, refines step 1):** no production F4 path creates, splits, dissolves or deletes a
  Wall today (`adapters/layout/precision.ts` edits existing Walls). The live plinth path does
  capture a Layout-object ID, but the capture is the occupancy ID and the planner refuses any
  other, so production already re-mints Layout-object IDs after Undo; the exposure stays latent
  only while no persisted reference names a Layout object (not exhaustively searched here).
  Scene placement captures `entity-${crypto.randomUUID()}`. Every landed Wall-creating planner
  falls back to occupancy allocation (`defaultChainAllocator`, `nodingAllocatorAdapter`), and
  `promoteLayoutIdentity` has no production caller. C1 is therefore the first production
  consumer of Layout identity allocation.
- **Strengthened:** Research 6 named ID re-minting; Q3 adds that byte-identical recreation
  defeats `exact` content qualification, that any allocator state stored inside the undoable
  snapshot rewinds with Undo, and that the presentation cursor alone rewinds on reload.

### Policy matrix for the selected first operations

Proposal. "Attached" is the B-mig family below; "independent" is A0 (A1 adds diagnostics only).
Reports use the ratified revision vocabulary.

| Edit | Independent | Attached: authored effect | Attached: report |
| --- | --- | --- | --- |
| Wall shape edit (move, length, angle, curve) | Pose unchanged | Layout-only acceptance; pose re-evaluates at the same `(host, s, side)` | `recomputed`; `needs review` when out of span or over an Opening |
| Split, footprint wholly on one fragment | Pose unchanged | One compound acceptance: bindings on `X→B` move to the new ID with `s − d` | `unchanged` (world pose preserved, Q1) |
| Split through a footprint | Pose unchanged | Binding stays on the retained ID | `needs review` (re-pick, Detach) |
| Dissolve, either survivor orientation | Pose unchanged | Compound: interval offset; reversed side flips and `s' = L − s` | `unchanged` |
| Delete host (corrected, Q8; proposal gated on attachment adoption) | Pose unchanged | Joint Layout+Scene acceptance. Recommended default: detach at the evaluated pose only when every affected attachment evaluates. Otherwise refuse without an install and require an explicit keep-unresolved or delete-dependents choice. Keep retains a proposed Scene `UnresolvedBinding` and surface parameters | Detach: `unchanged` world pose. Keep: `unresolved` — renders nothing; Re-pick, place explicitly or delete; Detach unavailable |
| Recreate at the same place | Pose unchanged | New ID; a kept `UnresolvedBinding` stays unresolved — no revival | `unresolved` |
| Opening inserted at contact | Pose unchanged | Layout-only; evaluates over-opening | `needs review` |
| Undo / Redo / reload | Snapshot / stored pose | Exact snapshot; fresh revision; cold evaluation from Layout + binding | Same derived diagnostics |

### Evaluated versus rebased cold continuity

Measured on one chain (move `P` → split `Q` at 1.5 m → dissolve `X` with reversed survivor `P` →
move `P`), four bindings, JSON round trip, fresh evaluator. Bytes are probe-shaped JSON, illustrative only.

| Strategy | Scene records rewritten per edit (E1/E2/E3/E4) | Persisted after E4 | Cold result |
| --- | --- | --- | --- |
| B-mig: evaluated, bindings migrated in a topology acceptance | 0 / 1 / 3 / 0 | 317 B Scene | Poses agree, 0 m; equals in-session poses exactly |
| B-lin: evaluated, never rewritten, Layout lineage | 0 / 0 / 0 / 0 | 313 B Scene + 179 B lineage (49 B split, 127 B dissolve; must snapshot geometry such as lengths) | 0 m; 2 fold steps per binding; **0 records compactable** while any binding names a retired ID |
| C-pose without intent | 4 / 0 / 0 / — | 216 B | E4 leaves all 4 objects behind: following is lost |
| C-pose with A1 provenance | 4 / 1 / 3 / 4 | 620 B (pose + binding) | 0 m, but transports bindings exactly like B-mig **and** rewrites poses |

Findings: rebasing (C) moves the cost to shape edits (every move rewrites dependents) and still
needs the same binding transport once intent is retained; B-lin keeps edits single-domain only by
persisting Scene-motivated, uncompactable history in Layout. B-mig confines cross-domain work to
the topology edits that retire or split a referenced host.

### Unratified schema and operation sketch

One pose authority: while `attachment` is present the evaluated pose is authoritative and the
entity carries no writable world pose; Detach writes the evaluated pose and removes `attachment`.
It is available only when that pose evaluates, not merely when the host identity resolves.

Transport is required only when an edit changes a referenced identity or parameterization.
Unchanged stable owner IDs continue to resolve through the accepted revision/lock: splitting `W2`
does not require an identity map or reference rewrite for unrelated `W1`.

```ts
// UNRATIFIED — Scene entity extension (needs F extension/version negotiation; Scene unit format 2 refuses it today)
attachment?: {
  host: SemanticReference;          // layout:wall, revision via dependency-lock context, layout-location
  s: number;                        // meters from the host's canonical start, centreline arc length
  side: 'left' | 'right';           // relative to the canonical start→end tangent
  standoff: number;                 // meters from the face
  footprint: { width: number; height: number; bottom: number };
};
// Evaluation status is DERIVED, never stored: resolved | host-unresolvable | out-of-span | over-opening |
// frame-unavailable, computed by the Scene evaluator from (binding, accepted Layout) with cause and identity.
// Proposed versioned Scene reuse of AM-2's record for an explicitly kept unresolved attachment, replacing `host`:
//   attachment?: { unresolved: UnresolvedBinding; s; side; standoff; footprint }   // renders nothing
```

**Correction (step 3 follow-up, Corr-4):** the step 2 sketch and report said "unresolved state is
derived, never stored". That was **imprecise, and wrong for the explicit case**. Landed source has
two forms. (a) A stored AM-2 `UnresolvedBinding` (`units/types.ts`: `{reference, domain, status,
message}`, strictly validated by `validateUnresolvedBinding`). Its only consumer today is
`TypedResource.unresolved`, which is required when a resource has neither revision nor pin.
(b) Derived envelope diagnostics: `unresolved-view`, `unresolved-presentation` and `unresolved-stop`
are recomputed by `envelopeFindings` over retained IDs and never stored. Both are domain-admitted
ways to retain repairable authored bindings under F.1: that contract does not require an
`UnresolvedBinding` wrapper for every domain. For example, Experience retains an absent `viewId`
and derives `unresolved-view`; its current codec has no wrapper slot. For attachments, evaluation
status remains derived. Reusing AM-2's record for a deliberately kept removed host is a **proposed
Scene format extension**, requiring version/compatibility negotiation, not a claim of existing
Scene admission or an alteration of other domains' binding formats.

Proposed attachment-record lifecycle (only after owner adoption and the format extension):
- **Creates the record:** an accepted host deletion or retirement without published transport, when
  the creator chooses keep-unresolved; an import or resource replacement that retires a referenced
  component (cross-seam).
- **Clears the record:** Re-pick, explicit placement or delete.
- **Restores the resolved binding:** Undo, by snapshot.
- **Never creates the record:** out-of-span, over-Opening, frame-unavailable, a split straddle (the
  host still resolves), or a dangling reference with no deliberate acceptance.

Operations (unratified): `scene.attach-to-surface` and `scene.detach` / `scene.repick-host`
(single-domain Scene, values captured from the owner frame query at the expected revision);
`layout.split-wall` and `layout.dissolve-junction` gain compound variants that apply the
owner-published transport to referencing bindings in one acceptance, returning wall and binding
correspondence plus `needs review` diagnostics. Deleting a referenced Wall (Q8) becomes a joint
`layout.delete-wall` variant that resolves each affected attachment explicitly. The recommended
default detaches only when every affected pose evaluates; otherwise the whole operation refuses
without source/history changes until an explicit keep-unresolved or delete-dependents choice.
Other dependents retain their domain's admitted repairable representation and owner policy; a
Scene attachment wrapper is not a universal cross-domain requirement. An unreferenced Wall
deletion stays Layout-only.

### Revised alternatives, recommendation and falsifiers

**Recommendation (proposal):** (1) Ship **A0 solve-once surface placement** first; it needs only
an owner face-frame query and no relationship schema. (2) For deliberately attached content choose
**B-mig**: evaluated attachment as the sole pose authority; shape edits stay single-domain Layout;
a topology edit that retires or splits a referenced host is one compound acceptance applying
owner-published transport to affected bindings; unchanged stable targets need no transport.
Ambiguity stays a typed review on the original binding. If attachment is adopted, the recommended
host-delete default is a joint acceptance that detaches affected attachments at their evaluated
poses (Q8 (i)). An unavailable pose refuses the whole default operation; keep-unresolved and
delete-dependents are explicit delete-time alternatives. (3) Every
persisted cross-domain reference needs **non-reusing captured allocation** first.

**Strongest rejected alternative: B-lin** (persisted lineage, never cross-domain). It is the only
option that keeps every Layout edit single-domain, but its lineage is Scene-motivated history inside
Layout, needs geometry snapshots and cannot compact without a global reference scan (Q2).
**C-pose** stays the fallback if the owner declines a Scene attachment format: it is executable on
landed formats today (Q6), but without retained intent it does not follow (Q2 E4).

**Falsifiers:** prefer B-lin if topology edits must remain single-unit (for example, unit-partitioned
concurrent writers). Prefer C-pose/A1 if creators do not want following, or if the attachment
format is refused. B-mig fails for an edit family whose owner cannot publish a unique interval and
orientation map; that family refuses following and returns review. Captured-nonce allocation fails
if persistence later needs operation-independent IDs (for example, merging concurrent writers),
which would require a persisted allocator outside undoable history.

**Delete-host policy (Q8):**
- **Recommended, unratified and gated on attachment adoption: (i) detach at deletion.** When every
  affected pose evaluates, this leaves the detached content renderable with no repair after
  reload and no pose-shaped secondary field. If any pose cannot evaluate, refuse the whole default
  operation without an install; require explicit keep-unresolved or delete-dependents instead.
- **(ii) keep-unresolved:** a deliberate delete-time alternative for creators who will re-pick.
- **(ii′) diagnostic last pose:** credible and single-authority only if typed as diagnostic,
  excluded from release lowering and the visitor runtime, and promoted only by an explicit
  operation. Q8 also recovers the exact pose cold under this alternative (0 m residual); rejecting
  it as the default is a policy recommendation, not a failure of pose recovery. It is not
  recommended because its additional pose-shaped field invites being read as authority, and the
  proposed Scene format would need to declare and version that field separately from AM-2's record.
- **Rejected:** (iii), which depends on unpersisted prior content; and (v), the step 2 row, which
  is an undeliberate break with nothing recoverable.
- **Falsifiers:** prefer (ii) as the default if creators commonly delete and redraw a host and
  re-pick with the retained parameters, saving material effort. Prefer (ii′) only if deferred
  detach after reload is a demonstrated need and the owner accepts the extension.

**Remaining owner calls:** the delete-host default and which delete-time alternatives to offer; attached versus independent as the default gesture; coordinate policy
(start distance followed by the moved start Junction in Q2 E1, versus end, normalized or landmark);
split-straddle policy (review versus keep on the retained fragment); hard versus preferred spacing
(Q4); Layout ID policy for C1 (captured nonce versus persisted cursor outside history); A1-versus-B
creator comparison (deliverable (e) remains **unexecuted**; no UX numbers are claimed).

## Handoff to the convergence lead

**Owning contract sections** (amend or retain; not edited here):

| Location | Proposed amendment (one or two sentences) |
| --- | --- |
| `docs/reference/composition-execution.md` [§F.1 Identity and reference](../../../docs/reference/composition-execution.md#f1-identity-and-reference), "Stable internal IDs" | Amend: an allocated identity is never re-minted for a different subject within a project's lineage, including undone branches, saved revisions and byte-identical recreation; content identity is not continuity. |
| Same file, [§F.4 Compound acceptance](../../../docs/reference/composition-execution.md#f4-compound-acceptance), step 1 and its current-implementation note | Amend: identity allocation is captured and non-reusing (no occupancy fallback in an accepted operation); acceptance enforces each planner's declared domain/compound scope against the units its candidate changes, not only against intent targets. |
| Same file, [AM-4](../../../docs/reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1) | Retain: snapshot history already restores many-to-one migrations exactly (Q6). |
| `docs/reference/architecture.md` [§Ownership](../../../docs/reference/architecture.md#ownership-current-source-of-truth), "Layout semantic mutation" | Amend: topology planners return transport for affected referenced identities or parameterizations (input interval → output ID, offset, orientation) beside created/split lineage; unchanged stable targets need no map or rewrite. Compound acceptance is landed; an operation changing Layout and Scene needs a registered joint planner, not a new admission provider. |
| `docs/reference/components/scene-content.md` [§Validation and transform contract](../../../docs/reference/components/scene-content.md#validation-and-transform-contract-current), "Placement, transforms and attachment" | Amend when the owner selects B: attachment is a host reference plus surface parameters with the evaluated pose as sole authority, derived unresolved state and Detach capturing the pose; keep the destination label until cutover. **Superseded by the N-S1 gist below.** |
| Lead's step 3 wording: CD-2 / N-F2 (`docs/roadmap/product-convergence-2026-10-21.md` §Proposed decision set; `…-amendments.md` N-F2) | Evaluation status is derived and never written back. An explicitly kept unresolved dependent retains its original authored reference in the owning domain's admitted repairable form; existing Experience IDs plus derived diagnostics remain valid. The proposed versioned Scene attachment format may reuse AM-2 `UnresolvedBinding`; this does not add that storage slot to every domain. Owner correspondence is needed only where referenced identity or parameterization changes. |
| Lead's step 3 wording: CD-3 / N-S1 delete-host part | If attachment is adopted, recommend joint deletion with detach-at-evaluated-pose only when every affected attachment evaluates. Otherwise refuse atomically and offer explicit keep-unresolved or delete-dependents. Kept Scene attachments use the proposed versioned unresolved form and render nothing; Re-pick, explicit placement or deletion repairs them. Diagnostic last-pose storage also permits exact cold recovery but remains an unselected policy alternative. |
| `docs/reference/decisions/northstar-ratification-2026-09-27.md` §§Dependencies, invalidation, and deterministic evaluation; Representation, revision, and atomic authoring | Retain: the four report states and rebuildable reverse index map directly onto the policy matrix. |
| `docs/roadmap/product-convergence-2026-10-21.md` §C1 "Implementation contract to finalize"; §Creative successors P2 row | Retain C1's no-recycling acceptance; add the allocation policy to its contract. Replace the P2 row's "planner admission" prerequisite with the joint planner, Scene attachment format and scope enforcement. |

**Missing providers and dependency edges:**

- **P-ID** (T1, with the F4 host capture): non-reusing captured Layout allocation, e.g. one captured
  operation nonce prefixing each planner seed (`ID_PATTERN` admits it), including the live
  Layout-object path (`nextLayoutPresetObjectId` / `planCommitLayoutObjectPresetWithId`). C1 ← P-ID;
  every persisted cross-domain reference to Layout ← P-ID.
- **P-FRAME** (T1): `wallSurfaceFrameAt(wall, s, side)` with occupied intervals (Openings).
  A0 surface placement ← P-FRAME; B ← P-FRAME.
- **P-TRANSPORT** (T1): split/dissolve results publish the interval/orientation map for affected
  identities/parameterizations; unchanged stable targets need no map.
  B-mig joint planners ← P-TRANSPORT.
- **P-SCOPE** (owner of `unit-acceptance-v1`): enforce per-planner changed-unit scope. Any registered
  Layout+Scene planner ← P-SCOPE (a small provider fix; report only, not made here).
- **P-SCENE-ATTACH** (T2, F extension/version negotiation, gate register): Scene attachment format.
  B-mig ← P-SCENE-ATTACH ← owner choice of B.
- **P-JOINT** (T2 lead, T1 support, named integration owner): compound split/dissolve-with-bindings
  planners **and the joint delete-referenced-host planner** (Q8). ← P-TRANSPORT (split/dissolve
  only), P-SCOPE, P-SCENE-ATTACH, P-ID, P-DEP.
- **P-DEP** (F4 provider with T1/T2 and each affected domain owner): acceptance-time reverse-reference
  check, rebuildable from authored references (the ratified reverse dependency index; unbuilt).
  Each affected binding gets an explicit domain-owned outcome; retained-ID unresolved forms remain
  available where admitted. Changes to other units require a registered joint planner, and new
  unresolved storage slots require their own format decision. P-JOINT delete ← P-DEP.

**First-wave dependency changes:** C1 need not wait for a separate provider slice, but **its scope
grows**: it must choose and land P-ID and always pass the captured allocator, with Q3-style guards
(delete/recreate, Undo branch, reload); otherwise its divide and delete operations recreate exactly
the measured ABA. C2 (own GLB) has no RR-4 dependency; its instances already use captured random
IDs. T3 capture/Preview has no RR-4 dependency; Camera framing of attached subjects stays behind Q7.

**Next consuming slice to plan:** T2 lead with T1 support — *Wall-surface solve-once placement*:
place a finite-footprint panel on a straight or canonical curved Wall face, refuse Opening overlap,
no persisted relationship. Prerequisites: P-FRAME; P-ID wherever it creates Layout identity.
Planning trigger for attached composition: owner selects B and its semantics, then P-SCENE-ATTACH,
P-TRANSPORT and P-SCOPE.

**Explicit uncertainties:** Q2 covers one chain and four bindings; T-junction noding, X crossings,
curve edits, Room merges and level qualification are untested. B-mig migration cost grows with
bindings per retired host and is unmeasured at scale. Captured-nonce allocation is a sketch with no
persistence or concurrency review. The face frame uses centreline arc length; face-length effects on
curves are a coordinate-policy call. Creator preference is unmeasured.

**Cross-seam — owner-qualified support/correspondence (RR-1/RR-2):** a binding's host reference must
carry level/structure `layout-location`; the unit resolver currently answers the single floor. Level,
datum and overhead identities need the same P-ID non-reuse. Vertical edits that retire or split a
supporting element need the same owner transport shape (interval → output ID, orientation) or an
explicit review.

**Cross-seam — capability identity/revision (RR-3/5/6), including the owner's P1 clarification**
(imported parts annotated once, reused standalone, in a Room or in a Guide): Q3's non-reuse finding
applies **equally** to part-qualified references (`componentId`, `capabilityId` on a placed instance's
resource). Component IDs derived from node names, indices or occupancy would recur across resource
revisions; an `exact` resource revision then fails safe, but a dependency-lock reference that follows
a new pin silently retargets. Byte-identical re-upload legitimately yields the same revision. Q1/Q2
transport (arc intervals, orientation, side flip, split/dissolve) is **Layout-specific**. Part
correspondence across resource revisions is a discrete preserved/retired/replaced map produced at
re-import admission, which the in-acceptance, unpersisted `CorrespondenceEntry` does not cover.
Migrating annotations on a resource revision is compound plus resource staging, which the live Stage
host does not grant. Q6's exact snapshot Undo and the scope gap apply unchanged.
