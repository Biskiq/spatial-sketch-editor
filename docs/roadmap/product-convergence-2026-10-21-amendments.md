# Product convergence — proposed contract amendments (step 3)

**Status: proposed, unratified, 2026-10-22.** This file holds the exact wording that the
[convergence proposal's decision set](./product-convergence-2026-10-21.md#proposed-decision-set-step-3-unratified)
would place in its owning contracts. It is not normative. **Normative text below has not been
applied**: it enters its owning contract only after explicit owner acceptance in this PR's review,
with any accepted edits to its wording. Destination wording keeps its *destination* label, and
landed descriptions stay current until an actual cutover (AGENTS rule 10). An incompatible change
to an accepted interface still needs a new version through
[F extension/version negotiation](../reference/composition-execution.md#extension-points-and-version-negotiation)
and the [gate register](./README.md#gate-register). Evidence is in the three step-2 packets under
[`broad-research/post-p01-roadmaps/convergence-2026-10-21/`](../../broad-research/post-p01-roadmaps/convergence-2026-10-21/relationships-and-revision.md).

Two kinds of change:

- **Applied (descriptive).** Triage-B corrections of stale current-behavior prose to match landed
  source and phase acceptances ([router](../README.md)). They state no new capability or rule.
  They are applied in this PR and still reviewed with it.
- **Proposed (normative).** New rules or destination commitments. The owner accepts, edits or
  rejects each one. "Retain" entries record a deliberate decision not to change the section.

## Applied descriptive corrections

| ID | Location | Change |
| --- | --- | --- |
| A-D1 | [North Star › opening "Current shell"](../reference/north-star.md) | Replaces the "read-only Stage / no editing or history" paragraph with the capabilities accepted by T1.P01, T2.P01 and T3.P01, and the capabilities that are still absent. Destination framing is unchanged. |
| A-D2 | [F.1 › Current implementation](../reference/composition-execution.md#f1-identity-and-reference) | Adds: unit resolvers refuse a non-null `componentId`; landed Layout planners allocate by occupancy and can re-mint an ID after delete or Undo. |
| A-D3 | [F.3 › Current behavior](../reference/composition-execution.md#f3-channels-and-representation-parameters) | Replaces "no general channel system is landed" with the landed family-generic `inspection-v1` negotiation, its two families and its missing component-existence check. |
| A-D4 | [F.4 › Current implementation](../reference/composition-execution.md#f4-compound-acceptance) | Adds: the compound host is landed; the planner-scope gap; snapshot Undo restores many-to-one migrations exactly. |
| A-D5 | [Session state › Current behavior](../reference/composition-execution.md#session-state-and-declarative-logic) | Replaces "no typed session declarations, reducer or expression evaluator exist" with the landed AM-6 interpreter, its same-run reset behavior and the missing Presentation entry. |
| A-D6 | [Architecture › Ownership › Layout semantic mutation](../reference/architecture.md#ownership-current-source-of-truth) | States that compound acceptance landed with `unit-acceptance-v1` at the T3.P01 cutover, not at a future cutover. |

Roadmap-side descriptive corrections are left to step 4: the track READMEs' removed-surface tables,
the milestone's Today cells, and the "PR #154 prototype" citations in the T3.P02 README and S01 plan.

## Proposed normative amendments

### F — composition and execution ([contract](../reference/composition-execution.md))

**N-F1 — F.1 "Stable internal IDs" (CD-1).** Replace the bullet with:

> - **Stable internal IDs.** Every addressable subject, component, occurrence, resource and
>   location a reference can name has a stable identity distinct from its display name.
>   Instance-ID paths stay stable through edits that preserve the instance. An allocated identity
>   is never re-minted for a different subject within a project's lineage — across undone
>   branches, saved and reloaded revisions and byte-identical recreation; Undo may restore the
>   same subject. Content identity proves equal content, not continuity of a subject.

**N-F2 — F.1, new bullet after "Revision context" (CD-2).**

> - **Owner-published correspondence.** Continuity across a topology edit or a resource revision
>   comes only from correspondence published by the owning domain (Layout transport records;
>   component preserved/retired/replaced maps at re-admission), never from names, indices or
>   nearest geometry. Without it the reference is not retargeted: its evaluation status reports it
>   unresolvable, and an accepted operation that keeps the dependent records an AM-2
>   `UnresolvedBinding` with the original reference and repair status. Evaluation status is
>   derived on every evaluation and never written back.

**N-F3 — F.3, new bullet after "Conflict rules" (CD-7).**

> - **Component-qualified validity.** A family whose address names a `componentId` declares an
>   owner validator that resolves it through the owning domain's component provider at the
>   contribution's revision. Negotiation alone never admits a component that does not exist.

**N-F4 — F.4 acceptance step 1 (CD-1).** Replace step 1 with:

> 1. Allocate identities and capture external inputs or pinned resources explicitly before
>    evaluation. Allocation is captured in the intent and never reuses an identity (F.1); an
>    accepted operation never falls back to allocation by current occupancy.

**N-F5 — F.4, new bullet after "Failure preserves the previous project" (CD-3).**

> - **Declared scope is enforced.** Acceptance checks the units a candidate changes against the
>   planner's own declared domain and compound scope, not only against the intent's targets or an
>   adapter-wide flag. A cross-domain consequence is a registered joint planner, never a read-time
>   mutation.
> - **Removal resolves its dependents.** A candidate that removes or retires a subject another unit
>   references is refused unless a registered joint planner resolves each dependent explicitly in
>   the same acceptance (re-target through published correspondence, detach, delete, or record an
>   AM-2 `UnresolvedBinding`).

**N-F6 — Session state, new bullet after "Isolation" (CD-7).**

> - **Reset and re-entry fence earlier work.** A visitor Reset, and every re-entry, that can
>   outlive asynchronous work starts a new run epoch; no completion, cleanup or contribution from
>   an earlier epoch applies after it.

**Deferred F extensions (named here, drafted by their first consumer).** None is pre-classified as
additive. Each needs its own compatibility decision, made by its first consumer: a new or bumped
version, negotiation as required or optional capability, and the behaviour of an older reader
(refuse, ignore an optional part, or report unsupported). Each lands through an AM-style amendment
and a gate-register entry:
- F.2: a model resource revision carries source and derivative pins, recipe identity/version and a
  component table; the Experience unit gains annotation records and Presentation subject and
  annotation uses (CD-5/CD-6).
- F.5/AM-6: an `annotation` program content kind with a compiled locator, and a Presentation-entry
  event (CD-6/CD-7).
- F.3: a datum-qualified Plan reading for capture (`layout.plan@1` takes a numeric `datumMeters`);
  this waits for a capture consumer (CD-2).
- Scene attachment as an F extension, once the owner selects it (CD-3).
- The reset/re-entry fence (N-F6) changes the meaning of an existing AM-6 instruction. If accepted,
  it is a versioned interpreter/profile change, not an optional addition.

**Retain:** AM-1 `layout-location` and `FrameReference@1` (`levelId` = datum ID; no F change for
datums); AM-4 snapshot history; the open-mechanism entries "level mechanism … expansion versus
isolation; slab/ceiling ownership" (the answer belongs in the T1 plan).

### Architecture ([contract](../reference/architecture.md))

**N-A1 — Ownership › Layout semantic mutation (CD-2).** Append after the descriptive A-D6
sentence:

> *Destination:* a topology-changing plan also returns a transport record — each retired or split
> input interval mapped to its output ID, offset and orientation — so a dependent domain consumes
> owner-published correspondence instead of re-deriving the planner's rules.

**N-A2 — Ownership › Wall role, final owed decisions (CD-4).** Replace "and Layout must decide
two things then: migrating existing `partition` Walls, and whether a closed ring may ever be
intentionally non-enclosing." with:

> and Layout must decide then: migrating existing `partition` Walls; whether a closed ring may
> ever be intentionally non-enclosing; how native drawing treats a nested or overlapping
> independent enclosure (today it validates and derives a second coplanar floor and generated
> ceiling); and how it treats collinear overlapping Walls in separate components (today two
> solids, no issue).

**N-A3 — Geometry boundary, new destination paragraph before "Representation is a Layout-owned"
(CD-4/CD-8).**

> *Vertical destination:* each placed structure has one frame (translation and yaw; tilt, scale
> and mirror refuse until supported) with its own named datums and Junctions. A join between
> structures is a declared connection evaluated as validity and reported when broken, never a
> shared Junction. Whether structures expand into one compile with qualified, disjoint topology
> or compile in isolation is an open compiler-organization mechanism, decided by the cutover plan. A Wall has one base reference and one top definition (height, datum reference
> or an explicit roof eave, with cycles refused); floor steps belong to slabs. Roof, canopy,
> ceiling (closure or suspended), slab and void are independently identified Layout elements that
> Rooms never own; fitting is one-shot unless a membership policy is accepted. Plan-only component
> independence is complemented by a 3D duplicate-solid gate. A geometry library, including a
> higher-level one such as a skeleton or mesh-boolean package, runs only inside the compiler as the
> evaluator of a Layout-declared family. The compiler keeps persisted parameters, family
> qualification, refusal, identity and correspondence. A kernel exception is a typed refusal, never
> fallback geometry; a valid empty result is a result. Numerical tolerances are declared for a
> stated coordinate range or local frame. Consumers, including the viewer, read compiled output;
> a solver ships to the viewer only if viewer execution requires it.

The closure sentence depends on the owner's CD-4 call. Recommended (room-switch) wording, which
supersedes T1 planning evidence D2/§12 "generated fallback only for uncovered enclosure":

> An authored closure meeting a derived Room switches off that Room's whole generated fallback
> and reports any uncovered remainder, including after a Room merge spreads the switch to the
> merged Room.

Alternative (per-area) wording, if the owner keeps the accepted planning rule:

> Generated fallback closes only the uncovered part of a Room; every intentional gap must be
> marked explicitly, and an unmarked gap is closed by fallback.

**Retain:** Semantic authorities; the current format-5 single-datum encoding until the cutover.

### North Star ([contract](../reference/north-star.md))

**N-N1 — Build, new paragraph after "Destination (re-derived under F as track T1)" (CD-4).**

> **Vertical and overhead direction (destination).** Levels are named datums local to a placed
> structure; a conventional storey stack is an optional workflow over them, never the source. A
> Wall has one base and one top definition, and steps in a floor belong to slabs. Roofs,
> canopies, ceilings, slabs and voids are independent Layout elements: a canopy or a mezzanine
> needs no Room, and Rooms derive within a level context without owning overheads. Expressive
> roof forms grow family by family inside the one compiler; an unsupported form refuses honestly
> or is imported.

**N-N2 — Experience lens, new paragraph after the first paragraph (CD-6; owner direction
2026-10-22).**

> **Object explanation (destination).** An imported object keeps its admitted parts. A creator
> annotates the object or a part, and the explanation is reusable across contexts: standalone in
> an otherwise empty World, among other content in a Room or exhibition, or within a Guide,
> without copying Scene data and with Rooms, Guides and Stops optional. Parts are admitted
> explicitly per resource revision; names and node order never establish them, and an object
> without separable parts is annotated at a point.

The first consumer's narrower choice (one Presentation over one placed instance) belongs in its
slice plan, not in the North Star.

**N-N3 — Authority paragraph, "Open mechanism decisions" list.** No change until the T1 cutover
plan records the level mechanism; then remove "level mechanism" from the open list.

### Scene ([contract](../reference/components/scene-content.md))

**N-S1 — Validation and transform contract › "Placement, transforms and attachment", after the
Attachment sentence (CD-3; only once the owner selects attachment).**

> Solve-once surface placement writes an ordinary world pose and creates no relationship. An
> attachment is a host reference plus surface parameters (distance along the host, side,
> stand-off, footprint) whose evaluated pose is the sole pose authority while it exists.
> Out-of-span, over-Opening and frame-unavailable states are derived from the binding and the
> accepted Layout, never stored. A host topology edit migrates bindings only through a registered
> joint operation that applies Layout-published transport. Deleting or retiring a referenced host
> without published transport is one joint Layout+Scene acceptance that resolves every dependent
> explicitly: detach at the evaluated pose (default), delete the dependent, or keep it as an
> authored `UnresolvedBinding` with its surface parameters, which renders nothing and is repaired
> only by Re-pick, explicit placement or deletion. Detach is available only while the host
> resolves.

**N-S2 — Ratified destination › "Resources, identity, and ingest", append (CD-5).**

> Components are admitted explicitly: each admitted component receives an opaque identity that is
> never reused, held in a definition-owned table that maps it to a locator pinned to the exact
> resource revision (source and derivative node). A replacement revision carries explicit
> preserved/retired/replaced correspondence, or the bindings that named its components stay
> unresolved for repair. Annotations are Experience records, not Scene state.

Then remove "component-identity mechanics" from that section's open mechanism decisions.

### Assets ([contract](../reference/components/assets.md))

**N-R1 — Ratified destination › "Truthful ingest", append (CD-5).**

> A creator import retains its source bytes and content hash and its recipe identity and version.
> Its render derivative preserves nodes — no pruning of empty leaves, mesh deduplication, join or
> flatten — or records a source-to-derivative node map. Its ingest report lists observed
> structure, clips, variants and extensions separately from admitted capabilities. The catalogue
> preparation recipe merges and prunes parts and is not used for creator import.

**Retain:** the "Model preparation and validation checklist" as the catalogue procedure (it already
excludes creator import).

### Camera ([contract](../reference/components/camera-tour.md))

**Retain.** Framing a part is ordinary View capture; Camera gains no part-target evaluation.

### PLATE ([contract](../reference/design-system/editor-shell-and-visual-system.md))

**N-P1 — §0.8.1 › Scene subjects, new paragraph after the second paragraph (CD-9).** This needs PLATE
conformance review.

> When a subject's resource has admitted parts, its Card offers part selection as deeper
> capability on invocation; a selected part keeps the placed subject's identity visible and stays
> distinct from Presentation selection. An object without admitted parts shows no part
> affordance. Annotation is authored from the Card into a Presentation and shows where it is
> used. A subject's relationship state — independent, attached, needs review or unresolved — is
> shown on its Card, with Detach and Re-pick as ordinary repairs; proximity never implies
> following.

**N-P2 — §0.8.1 › Information homes, Scene subject row, "What it shows" cell.** Append: "part
selection and annotation on invocation; relationship state".

### Performance and delivery (CD-10)

**N-T1 — [Test contract](../../apps/editor/tests/README.md#correctness-tests-vs-performance-benchmarks)
§Correctness tests vs performance benchmarks, append.** Owner acceptance of this wording is the
separate authorization that the section itself requires.

> **Performance evidence in final gates.** Benchmarks stay on demand
> and outside CI. A phase final gate whose slices touch a budgeted flow records a performance
> evidence row from the browser harness (`perf:browser`: Playwright + CDP, Apache-2.0
> devDependency, own config outside the default lanes) and from the bundle report. The row
> records reference profile, workload id, browser, commit and pass/target/disposition for each
> budget line. Report at least 10 runs per measurement as p75/p95/p99, cold and repeated. Records
> live beside the acceptance record. Timing never substitutes for a correctness oracle, and a
> correctness suite never substitutes for timing.

**N-N4 — [North Star › Technology gates](../reference/north-star.md#technology-gates), replace
"Optimization work follows measured large-scene/runtime bottlenecks." with:**

> Optimization work follows measured bottlenecks against a declared baseline: reference laptop A
> (a 4-core mid-range x86 laptop with integrated graphics, 8 GB, 1080p at 60 Hz, Chrome) and B (M1,
> 8 GB), with Safari and Firefox secondary, and stated network profiles. Editor and viewer flows
> carry explicit budgets for input-to-next-paint latency, frame-time tails, compilation, memory and
> delivered bytes, owned by the performance contract. A slice that misses a hard budget resolves it
> within its scope: profile first, then remove duplicated work, compute incrementally, cache, move
> whole pure stages to workers, use compiled derivatives and split delivery. Each step keeps one
> canonical authority and the intended architectural expressiveness.

**N-A4 — [Architecture › Release packages](../reference/architecture.md#release-packages-destination),
new paragraph "Delivery budget and visitor closure".**

> The visitor's first-load set carries a byte budget, and model decoders, Preview and other optional
> capabilities load lazily, only when content needs them. Editor machinery never reaches visitor
> chunks. A solver or the Layout compiler reaches them only while visitor execution requires it. A
> prepared package may replace runtime compilation with a compiled derivative without changing
> ownership. Each acceptance that touches visitor-reachable code lists the visitor load set's
> editor and solver modules, justifies each one, and compares bytes with the last accepted record.

**Where the budget table lives.** The budget and workload tables in the performance packet move to
a new durable reference section once accepted. Recommended: a new `performance.md` component contract under `docs/reference/components/`,
routed from the docs router. Until then the packet is the proposal.

**Code-level corrections (held; not documentation).** Repointing the visitor boundary gates'
forbidden set from the deleted `src/lib/editor/` tree to `src/lib/authoring/**` is a code change for
the first visitor-touching slice. AGENTS rule 5 needs no wording change.

## Not amended here

- The ratified decision record: retain. Its revision-report vocabulary and reverse dependency
  index already cover the relationship reports.
- T1 planning evidence D2/D3/D4/§12 dispositions, convergence C1/C2 scope text and the T3.P02.S01
  clarifications: step 4 (roadmap/phase routes).
