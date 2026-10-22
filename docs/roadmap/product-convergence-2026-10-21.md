# Product convergence — draw, arrange, explain, revise

**Draft convergence round, scope revised by the owner 2026-10-22.** PR #173 now covers focused
research, product/design/architecture reconciliation, proposed amendments to the owning contracts,
and the concurrent roadmap/DAG with the next batch recommendation. These outcomes belong in this
PR before merge; no separate reconciliation PR is planned. The owner accepted the P1–P3 creative
findings and deferred P4. This scope revision makes no architectural decision, registers no phase,
authorizes no implementation and accepts no product milestone. Initial evidence baseline:
`78cafc3acaad0f9919855901a7ea4d98aeecd85f` (includes PR #171 and Vellum's latest polish).
The [coordination record](../../broad-research/post-p01-roadmaps/README.md) owns the capability
disposition ledger and research index; phase registers and the [gate register](./README.md#gate-register)
remain the operational authorities. No track baton changes in this round.

## Scope and sequence

**Production implementation is held**, including previously authorized work such as T3.P02.S01.
The [owner hold](./README.md#production-implementation-hold) preserves historical authorizations
and accepted evidence but prevents implementation from starting or resuming until the owner
explicitly releases named scopes. Research, documentation and bounded disposable probes may
proceed within their commissioned step. Merging this PR alone does not release the hold.

| Step | Work in this PR | Completion boundary |
| --- | --- | --- |
| 1 — revise scope and briefs | Record the hold, the expanded scope, research handoffs and merge criteria | This documentation revision only; no new research execution, contract amendment or DAG redesign |
| 2 — independent research | Run the three focused commissions in parallel where useful, reusing existing studies and PR #171 | Decision-relevant evidence, strong alternatives, falsifiers and explicit unsupported/deferred boundaries; not every listed probe |
| 3 — reconcile direction and architecture | Combine findings; resolve shared seams and remaining product/design/architecture gaps; prepare exact amendments in the owning North Star, PLATE, architecture, domain and F contracts where justified | One coherent proposed decision set in this PR, with explicit owner calls and preserved landed-versus-destination distinctions |
| 4 — reconcile roadmap and DAG | Update the canonical cross-track DAG and affected roadmap/phase routes; re-derive the next batch and next slice to plan in each lane | Dependencies, concurrent lanes, provider prerequisites, shared-file ownership, near-term outcomes and planning triggers; detail only launch slices needed for immediate authorization |
| 5 — owner review before merge | Record acceptance of selected architectural/design decisions and any selected batch authorization | Unaccepted commitments stay explicitly unresolved/deferred; only the owner ratifies changes or releases named implementation scopes |

The remaining probe executions, contract reconciliation and DAG updates are **pending**, not
results of step 1. Do not mark this PR ready merely because briefs and initial findings exist.
Keep results in their commission packets and fold their conclusions into this proposal and the
existing owning documents. Avoid another synthesis ledger or parallel execution roadmap.

## Proposed direction

Biskiq should make **spatial work easy to create, explain and substantially revise**. A creator can
begin with an object in an empty World, sketch a pavilion, or import a venue; arrange and light its
contents; compose an interactive Presentation; then change the architecture or source object while
understanding what follows, what stays and what needs repair. Build and explanation reinforce one
another without becoming a mandatory sequence. Museums are a demanding use case, not the ontology.

The convergence is a common creative grammar, rather than a combined prototype application:

- **Read the intent.** A stroke, drag, selection or supported capability suggests a meaningful
  operation. Ambiguity offers a small set of legible alternatives; coordinates never silently
  create connectivity, attachment or capability.
- **Show the result and reach.** Preview the actual proposed operation, disclose affected work,
  distinguish an ordinary pose from a continuing relationship, and keep precision available.
- **Accept, refine, recover.** Install through canonical F4 acceptance; Undo/Redo retains identity.
  A refused candidate leaves accepted work intact. Subsequent repairs are deliberate edits; whether
  a choice can amend an open proposal or needs a later acceptance must follow the history contract.
- **Explain through actual capabilities.** Visitor controls use admitted domain operations, Camera
  Views and Experience content. A Presentation works without a Room, Guide or Stop. Reuse never
  fabricates a clip, component role or compatible target.

This is a **proposed design synthesis**. World | Experience, the shared host and PLATE remain the
design baseline. Vellum's Make/Tell/Visit, its pen and sheet, and Smart Wall's ribbons are evidence
for task instruments; their shell composition, data structures and evaluators are not adopted.
The design should preserve immediacy without requiring a modal approval dialog for every gesture.

## Accepted findings and evidence limits

| Finding supplied by the owner | Consequence | What it does not establish |
| --- | --- | --- |
| P1: a meaningful interactive Presentation needs no Room, Guide or Stop | Treat Guide-free explanation as a complete creator outcome; preserve empty-Layout entry | The exact control grammar, imported capabilities, reusable bindings or production execution proof |
| P2: Smart Wall makes intelligent manipulation and revision intuitive | Preserve surface-aware manipulation, explicit intent and visible consequences | A general solver, automatic correspondence or a persisted attachment format |
| P3: Vellum makes architectural sketching intuitive and expressive | Preserve drawing/readings, contextual height and shape editing, and recoverable revision | Room-owned architecture, a floor-stack schema, roof algorithms or unlimited native shapes |
| P4: deferred | Keep human/agent intent parity; schedule no harness, model connection or agent platform | A prerequisite for P1–P3 or for this batch |

P2's [solver](../../prototypes/p2-smart-wall/src/core/RelationalSolver.ts) and
[types](../../prototypes/p2-smart-wall/src/core/types.ts) demonstrate a specialized wall/artwork
model. P3's [design](../../prototypes/p3-vellum/DESIGN.md) and
[real/prepared/unsupported disclosure](../../prototypes/p3-vellum/README.md#whats-real-prepared-simulated-or-unsupported)
are useful evidence, including explicit touching/joining and preview/commit qualification.
Neither proves the production boundaries. No retained P1 executable was located in the bounded
repository inspection; the owner's P1 finding is accepted as supplied, while asset and lifecycle
claims still need the concrete evidence specified in the capability brief. Locating that artifact
does not introduce a technical prerequisite for settled Guide-free capture; the owner hold still
applies to its implementation.

The existing studies, Research 6 reconciliation and procedural assessment remain inputs. Their
older schedules, confidence numbers and speculative schemas are not acceptance criteria. PR #171
is a library/probe harvest, not a dependency decision; the vertical brief qualifies its CGAL claim
and identifies which measurements lack a retained reproducible harness.

## Authority already sufficient, and commitments still missing

The [North Star](../reference/north-star.md#ratified-north-star) already establishes the ambitious
category: optional Rooms/tours, native and imported starts, capability-aware composition, explicit
relationships, revision/reuse, typed intent parity and separate lifetimes. Reconcile those promises
with the findings and amend concrete missing or contradictory commitments; avoid restating the
whole vision. The following questions are the starting boundary, not a presumption that all product
or architectural commitments are already sufficient.

| Concern | Existing authority | Proposed commitment or precise unresolved choice | Disposition |
| --- | --- | --- | --- |
| First useful creator loop | North Star; K1/K3/K4; T3.P02 | Draw/import → arrange → capture → isolated Preview → Save/reopen, with a successful revision | Bounded engineering and later integrated acceptance; no new research gate |
| Intelligent operations and revision feedback | PLATE precision/refusal, source/reach/repair; spatial instrument grammar | Common interaction grammar above; ordinary precision/keyboard equivalents, discoverable interpretation alternatives and proportional impact feedback | Focused design reconciliation; owner accepts any PLATE departure |
| Placement versus attachment versus arrangement | Scene owns composition/attachments; Layout owns support; F1/F4 own qualified references/acceptance | Which intent persists, parameter/face correspondence, overconstraint/refusal and deliberate repair; groups/containment never imply attachment | Relationship brief; resolve before persisting following |
| Vertical architecture | Layout owns levels/structures; world-local placement with explicit internal frames; Rooms derived | Stable datums and irregular elevations, structure placement, Wall base/top authority and invalidation | Vertical brief; a Layout cutover, not a Scene hierarchy |
| Overheads | Layout owns architecture and the canonical compiler; independent interior intent already retained in T1 evidence | Independent roof/ceiling/slab/void semantics, supported geometry families, Wall-top agreement, joins and tolerances | Vertical brief; library choice follows representation and failure policy |
| Interactive Presentation | Experience owns visitor content/interactions; domains own capabilities; Camera owns movement | Minimal event/target/action grammar, admitted capability evidence, durable component roles/rebinding and scoped execution/reset | Capability brief; first consumer determines exact F/domain extensions |
| Inspection used for explanation | Layout runtime-safe readings; Camera capture; Experience invocation | Which representation parameters can be captured and how a missing/unsupported contribution is exposed | Capability + vertical briefs share only the representation-channel seam |
| Reliable revision as product quality | North Star, F1/F4 and PLATE already require it | A creator can predict the affected scope, preserve unrelated work, repair a real break and reopen the result | Put observable journeys in each consuming plan; no new universal engine |

The initial investigation supports three **provisional architecture recommendations**, each
subject to the linked falsifiers:

- Offer independent poses and explicit evaluated attachment. Favor attachment for intentional
  following, with owner-provided parameter/face correspondence; compare bounded binding migration
  against stable owner identity or persisted lineage where topology changes. A universal constraint
  solver is not the default answer to spacing, contact and identity together.
- Favor local datums and structure frames with independently identified architectural surface
  families. Keep conventional storeys as an optional workflow. Roof, ceiling, slab and void have
  distinct meaning; bounded analytic/profile/envelope kernels can coexist inside the one compiler.
  Compare retained parametric definitions and skeleton/import expansion at demonstrated limits.
- Favor explicit, revision-pinned capability admission and finite Experience offer/action records
  over heuristic execution or a page/behavior engine. Reuse the existing interpreter and Camera
  handoff; reusable roles declare requirements and bind to concrete identities explicitly.

Step 3 must prepare the exact reconciliation in this PR: North Star for product commitments;
PLATE for interaction/shell changes; architecture and Layout/Scene/assets/Camera contracts for
domain semantics; F for cross-domain shapes and negotiation. Proposed contract diffs remain
unratified during review; record the owner's accepted decisions and integrate their final wording
before merge. Do not merge an unaccepted proposal as a normative contract. Preserve landed
descriptions until an actual cutover and label the new destination honestly. An incompatible
accepted interface requires a new version; an accepted gate row never implies new capabilities
without the required implementation/acceptance evidence.

**Descriptive reconciliation, separate from ratification.** At this baseline, T1.P01, T2.P01 and
T3.P01 are closed; T3.P02.S01 remains authorized and unimplemented. The North Star's opening
“read-only/no editing/history” paragraph, the track READMEs' removed-surface tables, and the
milestone's older Today cells lag their owning acceptance records. This is router triage **B**
(landed change with stale prose) for those specific descriptions, not evidence that new capabilities
shipped. Step 3 includes a bounded docs correction citing phase acceptances and keeping destination labels;
do not rewrite current truth to match P1–P3. The Card-over-Compose residual in
[S06 acceptance](./t1-spatial-world/t1.p01-stage-foundation/t1.p01.s06-integrated-final-gate/acceptance.md#residual)
remains a T1 shell obligation, not an accepted solution or a reason to reopen the completed phase.

## Research commissions

These three packets contain initial independent investigation and executable remaining questions.
They consolidate RR-1–RR-6; they do not add three mandatory sequential research phases. Each can run
from the recorded baseline, read only its listed inputs and return a bounded decision packet.
Step 2 execution has not started under this revised scope. Record the actual source revision for
each later run, and recheck only evidence affected by a changed baseline.

| Commission | First production consumer and decision | Required handoff |
| --- | --- | --- |
| [Relationships and revision](../../broad-research/post-p01-roadmaps/convergence-2026-10-21/relationships-and-revision.md) — RR-4 | T2 wall-mounted content/arrangement, with T1 support and topology | Policy/correspondence comparison; split/reversal/delete/Undo/reload fixtures; explicit fallback and F4 implications |
| [Vertical and overhead](../../broad-research/post-p01-roadmaps/convergence-2026-10-21/vertical-and-overhead.md) — RR-1/RR-2 | T1 native pavilion, mezzanine and expressive roof/ceiling | Datum/top/element model; bounded geometry/tolerance proof; import comparator and typed refusal; #171 spike disposition |
| [Capability-aware interaction](../../broad-research/post-p01-roadmaps/convergence-2026-10-21/capability-aware-interaction.md) — RR-3/RR-5/RR-6 | T3 Guide-free interactive explanation over a real T2/native capability | Real asset manifest; action/role alternatives; lifecycle/input evidence; exact versioned extension and design proposal |

Run them in parallel. Cross-report only three seams: **owner-qualified support/correspondence**,
**Layout representation contributions**, and **capability identity/revision**. The convergence lead
resolves shared vocabulary and conflicting recommendations in this proposal; researchers do not
write separate normative contracts or duplicate the capability ledger. RR-7 remains consumer-triggered;
simple controls do not justify advanced conditions, visit memory or an unrestricted behavior graph.

Each handoff must separate observed repository facts, externally verified facts, proposals and
unexecuted experiments; compare a strong alternative; state a falsifier and a useful fallback;
and name its first consuming scope. Also identify exact contract amendment locations, dependency
changes, any missing provider/capability, and the next slice to plan. Researchers hand these to
the convergence lead; they do not independently ratify contracts or edit the canonical DAG.
A documented unsupported boundary is a valid result. Stop
research when existing contracts plus the focused evidence decide the first consumer. Broader studies,
a general constraint engine, universal roof generation and semantic ingest for every asset are not
prerequisites for that outcome.

## Proposed next engineering batch

**Provisional inputs for step 4, not a fixed batch.** Re-derive the recommendation after the
research and architectural reconciliation. The current first-wave hypothesis is T1 native Wall
creation, T2 own-model GLB admission and T3 capture/Guide-free Preview, with project rename/delete
as a bounded follow-on. An exposed shared prerequisite may need to precede those lanes. Do not
preserve C1–C3 automatically or start any lane while the owner hold applies. The candidate labels
below are local proposal labels, not registered slice IDs or implementation permission.

### Existing capture and Preview scope to reconcile

[T3.P02.S01](./t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/implementation-plan.md)
has historical implementation authorization and is **held**. Step 3/4 must check its plan against
the chosen decisions and propose any precise scope/prerequisite correction. Preserve its full capture/Presentation/optional Stop,
ordinary text/hold/continuation, Camera handoff, isolated Cut Preview and F2/F4 Save/recovery scope.
P1 rich controls are a successor consumer; they are not added to this slice. Its
[S02 integrated final gate](./t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/implementation-plan.md)
still needs its separate owner authorization after S01 acceptance. Starting or resuming S01 needs
explicit owner release from the hold; the earlier authorization alone is insufficient. Neither is shipped.

### C1 — Native straight-Wall creation (K3), T1

**Outcome:** from empty or starter Layout, draw straight Walls with deliberate Junction reuse,
close an enclosure, add a Wall-hosted Opening, divide it and delete a Wall. Rooms/floors derive
from canonical topology; the creator never chooses boundary/partition before drawing.

**Implementation contract to finalize:** extend the one Layout planner/compiler and Stage task;
declare the F2 Layout unit version and explicit role-encoding cutover/legacy retirement; capture
IDs and expected revision through unit acceptance. The bounded creation increment need not implement
levels, closed circles, overheads or attachments, but its identity/frame and encoding choices must
fit the reconciled architecture. Reassess the single-datum starting scope after RR-1/RR-2 rather
than freezing a conflicting format before that decision. Role derivation remains established direction.

**Acceptance:** empty → draw → close → divide → Opening → delete; no implicit coordinate adoption;
invalid crossing/topology refuses without partial source; Undo/Redo and Save/reload preserve IDs;
delete/recreate and a new edit after Undo cannot recycle another subject's identity;
Plan and 3D agree; keyboard/numeric entry remains useful. Recheck Junction, noding, Room
reconciliation, compiler and isolation contracts. The phase final gate is exhaustive. First plan
must also disposition the inherited Card-over-Compose residual and the actual Layout unit cutover.

### C2 — Own flat GLB import (K1), T2

**Outcome:** upload one creator model with its maps, validate/stage it, explicitly record
scale/pivot/footprint, approve it, then place, duplicate, transform, Save and reopen it as admitted
Scene content. Two placed instances share the immutable resource revision and have independent
instance identity. No capability is inferred from node names or hierarchy.

**Implementation contract to finalize:** use project resource storage and exact F2 locks, the
accepted unit profile and Scene placement; keep staging/approval distinct from source history;
declare invalid file/unsupported extension/missing-map behavior and cancellation/cleanup. Static
admission does not flatten a future semantic source irreversibly: retain source provenance and
make the derivative's limits explicit. No clips/components/re-export matching or T4 release closure.

**Acceptance:** valid model plus maps → approve/place → Save/reload; invalid/missing resource refuses
honestly; cancel or stale upload cannot install into a replaced project; explicit metric scale and
contact work in both readings; duplicate/delete/Undo preserve captured identity; Preview sees the
same admitted resource. API changes require check:api and DB-backed tests with zero skips; the
consuming phase final gate is exhaustive. Capability research is not a prerequisite for static K1.

### C3 — Project rename/delete (K4), T3 persistence/API with T1 shell

**Provisional placement:** bounded follow-on to the first-wave hypothesis above; step 4 decides
its actual priority and concurrency from milestone need, dependencies and shared-file contention.

**Outcome:** rename an owned project and delete it through a deliberate confirmation, from Hub
and the supported project context. Define the canonical project-name home and how unsaved work,
an open editor and a deleted remote project behave. Preserve guarded replacement and Save conflict
recovery. The precise confirmation surface is ordinary PLATE design, not a new prototype program.

**Acceptance:** owned versus foreign/missing project; rename survives reopen; delete cancellation
preserves work; accepted deletion cannot be undone by a stale Save; in-flight operations cannot
install into another session; dirty editor exits through the replacement policy. Scope API and
shell adapters separately, with a named integration owner and exhaustive final proof including
DB-backed tests with zero skips. Do not add archive, duplicate, sharing or collaboration implicitly.

### Dependency and merge discipline

All candidates verify accepted gates/scopes at the trusted base through their track runbook.
C1 and C2 use `F1.reference@1`, `F2.unit-envelope@1` and `F4.intent-acceptance@1` with
`unit-resolution-v1`, `unit-envelope-v1`, `unit-acceptance-v1` and
`conditional-save-units-v1`, plus the accepted viewport scope where they contribute Stage UI.
Camera/Experience consumers additionally declare their cutover and Camera-handoff prerequisites.
C3's final declaration follows the project-name/replacement impact; no claim that every API action
is a source edit. These are prerequisite candidates, not gate readiness supplied by this document.

Step 4 must update [the canonical cross-track DAG](./cross-track-execution.md#execution-dag-and-earliest-product-milestones)
and the affected track/phase roadmaps, not create a second live graph here. Distinguish accepted
providers from merely ratified interfaces; add missing provider nodes and genuine prerequisites
instead of assuming current F4 admission supports a new compound operation. Show proposed
parallel lanes, shared Stage/codec/API file ownership and merge/integration order. Disposition
obsolete scheduling text without changing historical accepted identities or gate readiness.

Each recommended batch row must name its owner, concrete outcome, prerequisites, next slice to
plan (or existing reviewed plan), verification/integration route and readiness for authorization.
If immediate implementation authorization is requested, its launch slices need reviewed plans and
normal registration; otherwise label the next act as planning. Later slices need only outcomes,
dependencies, deferred decisions and planning triggers. No production dispatch occurs during
this convergence round; normal eligibility and explicit owner hold release precede implementation.

Surface-aware **solve-once placement**, ordinary materials/lights and Camera frame/refit are justified
next candidates under existing authority. Step 4 chooses their position from a concrete consumer;
do not add them as speculative foundations. Persistent following, new datums/overheads and rich
interaction bindings consume their specific decided interfaces. The temporary owner hold is
distinct from an invented requirement to finish every advanced research question.

### Creative successors opened by individual decisions

These are the selected seams' first useful consumers, ready to turn into production plans when
their named choices are resolved. They can be authorized independently of one another and of
unrelated research expansion.

| Consumer | Decision boundary before implementation | Bounded acceptance target |
| --- | --- | --- |
| P2 → mounted composition, T2 with T1 support | Chosen host/parameter policy, finite contact, hard/preferred spacing, split/reversal correspondence and cold repair; if migration crosses domains, jointly scoped Layout/Scene intent, planner admission and named integration owner | Place four panels on a canonical curved Wall, deliberately attach or keep independent, revise the Wall, explain infeasible spacing, repair one lost host; one accepted result per edit, Undo/reload without guessed retargeting |
| P3 → contextual vertical pavilion, T1 | Chosen datum/frame/Wall-top and independent overhead/closure model; qualified geometry family and tolerances | Draw at unequal heights, add an open canopy/partial floor and an expressive selected roof family with independent ceiling intent; revise height/section and keep identity; supported cases agree in Plan/Section/3D, unsupported cases refuse honestly |
| P1 → interactive explanation, T3 with admitted T2/native capability | Chosen finite offer/action grammar, truthful positive capability fixture, scoped lifecycle and component/role binding | Guide-free Presentation in an empty World with text, Views and a meaningful control; keyboard access, cancel/re-entry/stale completion, compatible reuse and explicit incompatible repair; no hidden Scene clone |

These acceptance targets are proposals, not a claim that all constituent prototype features were
accepted. The research packets compare alternatives before fixing the first consumer's exact scope.
Current Scene planners are single-domain (`compound: false`); accepted F4 unit capability does not
supply a new compound operation or authorize widening T2.P01. Stable-host evaluated following can
leave a shape edit Layout-only; an acceptance-time binding migration needs its own joint consumer.

## Owner review and exit

This PR's merge review must have all of the following, at the depth needed for the selected batch:

- The three research packets contain decision-relevant results or explicit bounded deferrals,
  with reproducible evidence and no unexecuted probe presented as a result.
- One coherent product/design/architecture decision set resolves cross-packet conflicts and
  names the remaining owner calls. Required amendments and stale descriptive corrections are
  folded into their existing owning documents in this PR; no reconciliation PR remains queued.
- The canonical DAG and affected roadmaps agree on current evidence, proposed concurrent lanes,
  real dependencies, shared-file ownership, inherited residuals and the next capability waves.
- The recommended batch states exactly what the owner can authorize now, what needs its next
  slice planned, and what stays held/deferred. Launch slices have the required reviewed plans
  if immediate implementation authorization is requested; later slices are not overplanned.
- The owner explicitly accepts the selected contract/design decisions before their normative
  wording merges. Architecture ratification, slice authorization and release from the hold are
  distinct acts that can be recorded during the same final review; one never implies the others.

Review the exact Core Editor Stability criteria as part of roadmap reconciliation, retaining
their current proposed status until the owner confirms them. Its later integrated acceptance
plan still follows the [milestone route](./core-editor-stability.md#acceptance-route); do not create
that workspace early or silently add P3 depth. T4 remains deferred under R1-D, and P4 remains deferred.

The [architecture cycle](../operations/architecture-cycle.md) still awaits the owner's mechanism
verdict; its protocol explicitly says the pending verdict blocks only its own handoff. This proposal
does not record that verdict, configure another exposure window or close any phase/track.

After merge, the owner must be able to identify the accepted direction, next batch to authorize,
next slice to plan in each lane and the dependencies that permit concurrency from the existing
roadmap routes. No separate reconciliation round is required for those near-term decisions.
This PR stays draft until its expanded review is complete; merging alone leaves production held
unless the owner has also explicitly released named scopes. This task performs neither merge nor implementation.

## Verification and provenance

Step 1 changes documentation only. Later research may add bounded disposable/reproducible probe
evidence outside production code; it does not implement the product. Run the focused documentation
gates during editing and the complete `npm run test:arch` before each PR update, per the
[test contract](../../apps/editor/tests/README.md#focused-verification). These checks prove document
and boundary integrity, not the new interactions, roof algorithms, capability lifecycle or product
acceptance. The independent briefs label their actual inspections and remaining unrun probes.

External precedent informs the proposed grammar without deciding Biskiq's architecture:
[Microsoft HAX](https://www.microsoft.com/en-us/haxtoolkit/guideline/scope-services-when-in-doubt/)
recommends narrowing or disambiguating uncertain assistance;
[Shapr3D's repair guidance](https://support.shapr3d.com/hc/en-us/articles/14410530503580-Fix-broken-dependencies-in-Design-History)
shows explicit missing-reference diagnosis and deliberate replacement. The inference here is that
intelligent creation needs equally deliberate revision/repair, not that Biskiq should adopt a
parametric modeling history or require AI for drawing.
