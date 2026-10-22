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
>   component preserved/retired/replaced maps at re-admission). Without it a reference stays
>   unresolved with a repair offer; unresolved state is derived from the reference and the
>   accepted owner state and is never stored.

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

**N-F6 — Session state, new bullet after "Isolation" (CD-7).**

> - **Reset and re-entry fence earlier work.** A visitor Reset, and every re-entry, that can
>   outlive asynchronous work starts a new run epoch; no completion, cleanup or contribution from
>   an earlier epoch applies after it.

**Deferred F extensions (named here, drafted by their first consumer).** Each is additive, through
an AM-style amendment and gate-register entry:
- F.2: a model resource revision carries source and derivative pins, recipe identity/version and a
  component table; the Experience unit gains annotation records and Presentation subject and
  annotation uses (CD-5/CD-6).
- F.5/AM-6: an `annotation` program content kind with a compiled locator, and a Presentation-entry
  event (CD-6/CD-7).
- F.3: a datum-qualified Plan reading for capture (`layout.plan@1` takes a numeric `datumMeters`);
  this waits for a capture consumer (CD-2).
- Scene attachment as an F extension, once the owner selects it (CD-3).

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
> shared Junction. A Wall has one base reference and one top definition (height, datum reference
> or an explicit roof eave, with cycles refused); floor steps belong to slabs. Roof, canopy,
> ceiling (closure or suspended), slab and void are independently identified Layout elements that
> Rooms never own; fitting is one-shot unless a membership policy is accepted. Plan-only component
> independence is complemented by a 3D duplicate-solid gate. A geometry kernel runs only inside
> the compiler; its failure is a typed refusal, never fallback geometry, and numerical tolerances
> are declared for a stated coordinate range or local frame.

The closure sentence depends on the owner's CD-4 call. Recommended wording:

> An authored closure meeting a derived Room replaces that Room's generated fallback and
> reports any uncovered remainder.

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
> annotates the object or a part and explains it standalone in an otherwise empty World, among
> other content in a Room, or as one Stop of a Guide — the same placed subject, annotations and
> Presentation, with Rooms, Guides and Stops optional. Parts are admitted explicitly per resource
> revision; names and node order never establish them, and an object without separable parts is
> annotated at a point.

**N-N3 — Authority paragraph, "Open mechanism decisions" list.** No change until the T1 cutover
plan records the level mechanism; then remove "level mechanism" from the open list.

### Scene ([contract](../reference/components/scene-content.md))

**N-S1 — Validation and transform contract › "Placement, transforms and attachment", after the
Attachment sentence (CD-3; only once the owner selects attachment).**

> Solve-once surface placement writes an ordinary world pose and creates no relationship. An
> attachment is a host reference plus surface parameters (distance along the host, side,
> stand-off, footprint) whose evaluated pose is the sole pose authority while it exists;
> host-missing, out-of-span and over-Opening states are derived from the binding and the accepted
> Layout, never stored. Detach captures the evaluated pose. A host topology edit migrates
> bindings only through a registered joint operation that applies Layout-published transport.

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

## Not amended here

- The ratified decision record: retain. Its revision-report vocabulary and reverse dependency
  index already cover the relationship reports.
- T1 planning evidence D2/D3/D4/§12 dispositions, convergence C1/C2 scope text and the T3.P02.S01
  clarifications: step 4 (roadmap/phase routes).
