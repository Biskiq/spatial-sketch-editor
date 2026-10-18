---
kind: unified research reconciliation and decision brief
status: "Research input for owner review. Not a product contract, ratification, routed authority, roadmap change or implementation authorization. docs/README.md and docs/reference/ govern product truth."
evidence_base: "main @ 26290839 (2026-10-18); PRs #151 (24445e6f), #152 (85bfeee2) and #153; Research 6 and the five domain studies; the ratified authorities; source, tests and probes listed in §7"
replaces: "PR #153's earlier brief (broad-research/independent-high-ceiling-reassessment.md) and its unpublished addendum, both withdrawn in favour of this document"
---

# Research 6: unified reconciliation

> **What this is.** One reconciled judgment on [Research 6](./biskiq-integrated-product-synthesis.md). It
> weighs three reviews as competing evidence, not as votes:
> [PR #151](https://github.com/Biskiq/spatial-sketch-editor/pull/151),
> [PR #152](https://github.com/Biskiq/spatial-sketch-editor/pull/152), and this PR's own earlier brief
> and addendum. It replaces that brief and addendum, and overturns several of their conclusions (§1).
> Every recommendation is **proposed**. Nothing here changes source, a ratified contract, a roadmap
> register, a gate or an authorized plan.

**Labels.** **Fact:** verified at `26290839` by source, tests or a probe listed in §7. **Inference:**
follows from facts. **Judgment:** my weighing. **Hypothesis:** needs the evidence named beside it.

## Answers at a glance

| Question | Answer |
| --- | --- |
| What should Biskiq deliberately preserve? | The ratified North Star, the five semantic authorities, one Camera authority, F.1–F.5, World \| Experience, Conservatory, visitor isolation, and every current authorization, gate state, K1–K4 ruling and R1-D. No evidence here justifies an architectural amendment (§4.1). |
| What should change, and why? | Emphasis and sequence inside existing authority. Close the two places where code contradicts "no mandatory Room or tour". Give creators' flat content (images, text) a path in. Design tools as *intent in, ordinary state out* with explicit provenance where revision diagnostics matter. Stop elaborating research machinery (§1, §3). |
| Which creator capabilities are most valuable next? | In order: Guide-free Presentation access in Preview; Look-through capture / Preview / visitor visual fidelity; still images as content; authored Presentation text; surface placement (with optional placement provenance); then intent tools such as Frame this, Present this and Light this (§3.1). |
| Which overlooked opportunities warrant deeper investigation? | The *Present this* compound workflow (`Subject(s) or Space → View → Presentation → optional Stop`) as the fastest novice entry (§5.1), and the scroll-first page (§5.2). Conditions, alternatives and new geometry wait for named planning events (§5.3). |
| What does the code support, and what is missing? | A large accepted-but-inactive foundation, four verified implementation/contract gaps, and five separable hosting obligations from E2 (§2). |
| What should be prototyped, not designed abstractly? | The scroll-first page (comparing a Guide-free Presentation constellation, auto-laid Guide sections with held choice branching, and a bounded invoked reading-layout instrument over comparable content). Also observing real creators on the stability build before T4 planning renews (§6.3). |
| What stays deferred or refused? | §6.5. |
| What needs a new owner decision? | Two scope choices at planning events that must happen anyway (T3.P02 registration and K1 registration), an owner disposition on sign-in Save recovery scope vs contract wording, and confirming the pending 13 Core Editor Stability acceptance-area rows, kept strictly separate from post-stability triggers (§6.4). |

## 1. Verdict

**Research 6 confirms the ratified direction.** None of the three reviews found an architectural reason
to change it, and neither did this one. The real problems sit closer to the creator.

- **Two ratified promises are contradicted by implementation boundaries (Fact, §2.2).** "A Presentation
  can exist without a Guide", yet lowering drops every Presentation no Stop uses. "The product must be
  useful with an empty Layout", yet placement refuses without a Room floor. Neither is an architectural
  fault; both need planning, not amendments.
- **Creators' most common content has no path in (Fact).** No editor code calls the image upload API,
  the Scene has no image or text kind beyond a hand-built textured plane, and Presentation text has no
  authored home yet (a disclosed residual that T3.P02 plans to close).
- **The ordinary tools that make output credible are the thinnest (Fact).** Unauthored lighting and fog
  are hard-coded and differ materially between editor and visitor, and no assisted framing, surface
  placement, alignment or replace operation is planned before the milestone. The decision record warns
  that semantic structure "will not compensate for weak direct manipulation or unattractive output"
  ([decision record](../docs/reference/decisions/northstar-ratification-2026-09-27.md#a-focused-entry-without-a-narrow-ontology)).

**Preferred direction — avoiding another narrow convergence (Judgment).**

Each earlier synthesis converged on a useful idea that also risked narrowing the product:
Research 6 centred on *architectural seams and capabilities*; PR #153's original brief centred on
*hosted wall staging* (gallery bias); its addendum centred on *directed relationships* (constraint
bias); and centering the whole product on *"the presented piece (one object + placement + View +
placard)"* would repeat the mistake by biasing Biskiq toward an annotated exhibit/placard viewer at
the expense of **space-as-subject architecture** (zero-object atmospheric or threshold Views),
**multi-subject process/mechanism explanations** ("How power reaches the generator"), and
**free-exploration / interaction-led spaces** that use no placards at all
([North Star](../docs/reference/north-star.md#composition-behavior-and-direction-model)).

The durable organizing loop across all of those creative modes is **directed spatial composition**:

```text
Subject(s), Space, or Relationship (Layout / Scene)
  ↔ Framed View(s) (Camera)
  ↔ Visitor Meaning, Entry & Pacing (Experience: Presentation, optional Guide, or free exploration)
```

Within that loop:

- **Every entry reaches a previewable result without requiring another entry.** An architectural space,
  an imported 3D assembly, a folder of flat images, or an Experience outline is each a complete starting
  point.
- **The *presented piece* (`Content + Placement + View + Words`) is the fastest novice compound workflow
  (*Present this*), not a mandatory ontology.** A Presentation may equally frame zero Scene objects (an
  architectural sightline), one piece, or a multi-subject spatial relationship, and an Experience may run
  with or without Guides.
- **Every step is an ordinary operation owned by one domain.** The creator states the result; the
  domain produces inspectable state, retaining explicit provenance only where revision diagnostics or
  declared relationships need it.
- **Tours, relationships and architecture deepen a result. They do not gate it.**

**What this overturns in PR #153's earlier brief and addendum.**

| Earlier conclusion | Now | Why |
| --- | --- | --- |
| Hosted staging is the most consequential new opportunity, built first. | **Demoted.** Surface placement ships first as a solve-once operation with optional non-rebasing placement provenance (`A1`); live parametric hosting (`B`) waits for evidence (§4.3). | Hosting is a revision-time differentiator. Creators first need their content in and shown. Retaining optional F.1 host + contact provenance (`placedOn`) supports conservative `Needs Review` / `Unresolved` diagnostics and explicit repair without blocking placement on full parametric correspondence. |
| "Directed relationships" are a new creative primitive. | **Already ratified.** It is the decision record's relationship-specific revision policy (§4.2). | The addendum re-derived ratified text: locked versus assisted framing, a four-state report and a reverse dependency index. |
| Hosting is the substrate every other relationship targets. | **Wrong.** | Lights, Views and conditions target *subjects*, and subjects exist without hosting. |
| Hosted image placement could substitute for K3 Wall creation. | **Withdrawn.** | The substitution was not scope-neutral, and K3 is an owner ruling that serves space-first creators. |
| Creator studies with disposable prototypes now (E1, E3, E5). | **Moved** to the stability build, before T4 planning renews (X2, §6.3). | Before the milestone, their results could change emphasis but not the table-stakes editor work. |
| A seven-experiment suite (E1–E7 and E2b). | **Pruned** to one prototype, one observation round and dormant triggers (§6.3). | E2b would not change what T1 must publish (§4.3). |
| Venue pluralism is something to pursue. | **Dormant**, with a trigger. | No creator evidence. Captures are opaque and cannot be relit. |
| "No free-navigation controller exists"; about 15k lines of inactive code. | **Corrected.** A test-only `createFreeController` handles ownership release and rejoin, but no movement controller exists. About 9k lines have no product caller. | Re-measured (§2.1). |

**Strongest counterargument.** Revision integrity is Biskiq's distinctive claim, and walls are where
creators revise most. If live hosting waits, early projects are composed in coordinates, and solve-once
tools make coordinates the habit. Biskiq would then start as one more content stager: the table-stakes
category it set out to transcend.

**Why this direction still holds — provided solve-once placement does not erase provenance.**

1. **Stranding requires lightweight placement provenance, not proximity guessing.** A pure pose-only
   solve-once tool (`A0`) that writes only world `[x, y, z]` *cannot* later distinguish a wall-placed item
   whose wall moved from an item intentionally placed in free space, and proximity-based guessing is
   forbidden ("proximity and grouping never imply ownership"). Retaining an optional, non-rebasing
   `placedOn` provenance record (`A1`: an F.1 host reference plus placement-time contact evidence)
   alongside the authoritative world-local pose lets a revision check conservatively distinguish
   `Unchanged`, `Needs Review` (host still resolves, stored pose no longer satisfies contact/bounds) and
   `Unresolved` (host deleted or retired), offering explicit `Re-seat` when the surviving host has a
   unique in-bounds projection or requiring host re-pick / `Detach` when topology splits, dissolves or
   deletes the host (§4.3).
2. **Upgrading to live hosting stays explicit.** An explicit live attachment (`B`) remains an opt-in
   upgrade once T1 publishes split/dissolve/merge correspondence.
3. **Upgrading stays cheap.** Before a baseline, schemas may break without migration layers
   ([North Star](../docs/reference/north-star.md#development-stage-schema-compatibility-pre-baseline)).
4. **Live hosting is feasible when needed.** E2 shows this, once T1 meets the identity and correspondence obligations in §2.3.
5. **Integrity needs something to protect.** Revision integrity protects nothing until creators can get
   their content in and show it.

**What would change my mind:** creators observed in X2 who repeatedly revise walls under placed content
and find conservative `placedOn` diagnostics + explicit `Re-seat` / re-pick (`A1`) insufficient compared
to automatic live hosting (`B`).

## 2. What the code supports

PR #151's grounding standard is applied to every review, this one included. Each capability is placed on
a three-step ladder:

- **Conceptual:** ratified or typed only.
- **Accepted-inactive:** a tested, accepted provider with no product caller.
- **End-to-end:** a creator or visitor can reach it in the browser.

### 2.1 Capability ladder

| Capability | Source and validation | Acceptance, lowering and evaluation | Editor or visitor consumption | Revision and recovery | Rung |
| --- | --- | --- | --- | --- | --- |
| Layout precision edits (Wall height and thickness, Openings, plinth) | Wall-first v5 | F.4 `local-single-domain-v1`; five planners in [precision.ts](../apps/editor/src/lib/authoring/adapters/layout/precision.ts) | T1.P01.S04, live | Undo/Redo and Head Save, live | **End-to-end** |
| Layout creation (walls, rooms, openings) | Kernel planners tested | Not exposed | No product caller | — | Accepted-inactive; K3 is unplanned |
| Scene placement and editing | Seven planners in [scene-planning](../packages/project-model/src/scene-planning/operations.ts) | Floor support needs a Room floor | Wiring is in open PR #147 (T2.P01.S03, authorized, not merged) | Correspondence covers created, preserved and retired | Accepted-inactive |
| Own content | The asset API stores PNG, WebP or JPEG ([asset-persistence.ts](../apps/api/src/asset-persistence.ts)). No GLB path. `TypedResource` has kinds `texture` and `asset`, and no scale, pivot or provenance fields. | — | No editor caller | — | Images server-only; GLB conceptual (K1) |
| Images and text as content | A textured `plane` primitive is the only image form, with no text entity ([scene.ts](../packages/project-model/src/scene.ts)). Program content is text-only. | Presentation text has no authored home (S06 residual) | — | — | Conceptual |
| Experience source (Presentations, Stops, Guides) | Experience@1 codec and validation (T3.P01.S01) | Unit acceptance (S05) | No product importer of `units` or `program` | Cutover pending (T3.P01.S04) | Accepted-inactive |
| Lowering, interpreter and companion | [lowering.ts](../packages/project-model/src/units/experience/lowering.ts), [interpreter.ts](../packages/project-model/src/units/experience/interpreter.ts), [companion.ts](../packages/project-model/src/units/experience/companion.ts) (S06) | Text, Cut/Travel bindings, state, lifecycle and channel policy are closed-fixture inputs ([S06 residuals](../docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s06-experience-runtime-and-camera-handoff/acceptance.md#residuals)) | Tests only | Deterministic replay | Accepted-inactive; Guide-free broken (§2.2) |
| Camera profile controllers | [experience-controllers.ts](../packages/camera-core/src/experience-controllers.ts): guided, free (release and rejoin only) and reduced motion | Emit intents; Camera evaluates | Tests only. The live visitor orbits, or steps nodes ([VisitorCameraDirector.svelte](../apps/editor/src/lib/visitor/VisitorCameraDirector.svelte)). | — | Accepted-inactive; **no movement controller** |
| F.1 reference resolution | Current-domain adapters resolve Layout, Scene and Camera subjects ([read-adapter.ts](../packages/project-model/src/references/read-adapter.ts)) | Owner frames are refused ("a Room without an authored frame is not one"); component identity is refused | Live for selection | Retired subjects never retarget | Partial: no wall-face or Room frame |
| F.4 correspondence | `CorrespondenceEntry` carries relation, before and after | Layout precision emits only `preserved` and `created` | Selection requalification, live | Kept for each of 100 editor history states ([history.ts](../apps/editor/src/lib/authoring/f4/history.ts)). Never saved, and has no parametric part. | Partial |
| F.3 channels | Two families: `layout.plan@1` and `camera.session-inspection@1` ([families.ts](../packages/project-model/src/channels/families.ts)) | Negotiation works for those two | Inspection, live | — | Partial; no Scene or Experience families |
| Revision impact report | Ratified as four states (unchanged, recomputed, needs review, unresolved) over a reverse dependency index ([decision record](../docs/reference/decisions/northstar-ratification-2026-09-27.md#representation-revision-and-atomic-authoring)) | — | — | — | Conceptual |
| Visual defaults | No authored environment | — | Hard-coded lights, different in the editor and the visitor (§2.2) | — | Gap |
| Publication | P22 authored snapshot, through the API | T4 deferred; F5 undrafted | `/p/[publicationId]` live | — | End-to-end (legacy path) |
| Visitor isolation | Boundary suites | — | — | — | **End-to-end:** arch lane 163/163 |

**Inference.** About 9k lines of accepted code have no product caller: units 4.5k, Scene planning 3.2k,
migration 0.8k and program 0.7k. References, channels and F.4 are partly live. The next creator
capabilities are mostly wiring over tested kernels, plus a few small, missing semantic pieces.

### 2.2 Verified contradictions and drift

**Guide-free Experiences lose their content (Fact).**

- **The mechanism.**
  - `lowerExperienceProgram` builds `usedPresentationIds` only from the selected Guide's Stop order.
  - The interpreter marks a run `completed` on `enter` when `entryStopId` is `null`.
  - The companion lists destinations only from `program.stops`.
  - The only navigation action is `navigate-to` a `stopId` ([program types](../packages/project-model/src/program/types.ts)).
- **A temporary probe confirmed it.** It was built on the canonical fixture writer, run once and
  deleted. It used two Presentations, zero Guides and zero Stops:

  ```text
  sourceValid true · envelope round-trip true · lowered: presentations 0, stops 0, entryStopId null
  phase after enter: completed · companion destinations 0
  ```

- **The probe also found the gap is wider than PR #151 reported.** With one Guide using one of two
  Presentations, the program keeps only that one. Every Presentation outside the selected Guide
  disappears too, including those meant for free exploration alongside a tour.
- **The gap is undisclosed.** It is not among S06's disclosed residuals.
- **The gap sits inside existing proposed scope.**
  - Core Editor Stability's proposed `Camera/Experience authoring` and `Isolated Preview` rows already
    say "bind a Presentation plus an optional Stop" and require Preview "through the shared lowering".
  - The [T3.P02 proposal](../docs/roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md) repeats
    "optional Guide Stop".
  - So as planned, P02 would let creators author Presentations that its own Preview silently drops.
- **Requirement versus mechanism (Judgment).**
  - `validateExecutionProgram` ([validate.ts](../packages/project-model/src/program/validate.ts)) already
    admits non-empty `presentations` when `stops` is empty (`entryStopId: null`), which proves that a
    zero-Stop program with Presentations is an admissible source/program shape.
  - However, the current `ExecutionProgram@1` action, interpreter and companion surfaces are
    Stop-oriented (`navigate-to` targets a `stopId`, interpreter navigation accepts a Stop, companion
    destinations are Stop-shaped, and `enter()` completes immediately when `entryStopId` is `null`).
    `validateExecutionProgram` accepting `stops: []` therefore does **not** prove that the complete
    Guide-free activation mechanism requires no API or contract adjustment.
  - **Proposed `T3.P02` requirement:** *Every valid authored Presentation must remain accounted for, and
    supported Guide-free Presentations must be reachable through explicit visitor navigation and Camera
    Cut semantics, without fabricated Stops.*
  - **Five sub-problems that `T3.P02` first-consumer design and owner ratification must settle** (leaving
    the exact representation and any contract amendment to `T3.P02` planning):
    1. **Preserving Presentations during lowering** (`lowerExperienceProgram` retaining valid
       `unit.presentations` even when unbound by the selected Guide's Stops).
    2. **Defining an explicit Guide-free Experience entry policy** (so entering a zero-Stop Experience
       does not immediately terminate in `completed`).
    3. **Activating a Presentation without a Stop occurrence** (evaluating its View via Camera Cut
       semantics without fabricating synthetic Stops).
    4. **Maintaining run/session identity and Camera handoff** across Guide-free Presentation selection
       and free camera release/rejoin.
    5. **Presenting semantic navigation consistently in the companion** so unbound Presentations are
       reachable alongside or without a Guide.

**Composition requires a Room (Fact).**

- [`layout-floor-support.ts`](../packages/layout-core/src/layout-floor-support.ts) considers only
  derived `room-floor` polygons (`polygon.kind !== 'room-floor'` is skipped). Outside one, the result
  is `none`.
- `place-object` in [`operations.ts`](../packages/project-model/src/scene-planning/operations.ts) then
  refuses `'floor-supported'` placement and movement with `no-support`.
- T2.P01 chose this boundary deliberately: "Genuinely empty Layout … Place refuses and offers Start
  gallery … Neither a datum nor T1's plinth is support"
  ([T2.P01](../docs/roadmap/t2-composition/t2.p01-supported-composition/README.md#outcome-and-boundary)).
- **Inside the milestone it is coherent**, because Starter Gallery and K3 supply Rooms.
- **Beyond the milestone it contradicts the ratified destination.** That destination says a creator
  importing one model "should reach composition and direction immediately"
  ([decision record](../docs/reference/decisions/northstar-ratification-2026-09-27.md#a-focused-entry-without-a-narrow-ontology)).
  It also blocks objects placed on T1 plinths and object-only creators (product, education).
- **Post-stability solution options compared:**
  1. **Option R1 · Explicit `floor-datum` support (recommended with R2):** when no derived `room-floor`
     polygon covers `(x, z)`, `queryFloorSupports` resolves the canonical `layout.floor.elevation` datum
     as a distinct support kind (`kind: 'floor-datum'`). Preserves grounded Y-elevation placement in
     empty Layouts without inventing fake Rooms.
  2. **Option R2 · Plinth / `LayoutObject` top-face support (recommended with R1):** admit T1 `box`
     plinth top faces in `queryFloorSupports` so Scene objects can rest on plinths with or without a Room.
  3. **Option R3 · Unconstrained `'free'` 3D placement only outside Rooms (rejected as sole answer):**
     forcing novice creators out of grounded floor placement into unconstrained 3D coordinates when
     Layout is empty degrades direct manipulation.

**The editor and the visitor render different, unauthored light and fog (Fact).**

- The Stage renders background `0x111117`, linear fog `40..120`, ambient `0.35`, plus directional lights
  of `1.1` (shadow-casting) and `0.35`
  ([StageCanvas.svelte](../apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte)).
- The visitor surface that `/p/[publicationId]` uses renders background `0x050508`, linear fog `22..54`,
  ambient `0.2`, plus one directional light of `0.7` (`#c9d1df`)
  ([VisitorPreviewSurface.svelte](../apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte)).
- Authored Scene lights add to both.
- **Product invariant and three-way separation (Judgment).** Because `VisitorPreviewSurface` starts
  fogging at `22 m` and clips by `54 m` (versus `40..120 m` in `StageCanvas`) with half the total light
  (`0.90` vs `1.80`), a View framed across a `25–50 m` space renders dark or fogged-out in the visitor
  surface, violating Conservatory §0.8.1 ("what the creator sees through the Camera is what the captured
  View represents", [shell contract](../docs/reference/design-system/editor-shell-and-visual-system.md#visitor-preview)).
  However, requiring identical constants across every Stage drafting reading is too rigid. The actual
  product invariant is:
  > **The actual Camera look-through/capture result must faithfully correspond to the saved View and its
  > visitor Preview realization under the same applicable world-presentation state.**

  Three concerns stay separate:
  1. **Capture / Preview / visitor fidelity (routed to `T3.P02` consumer planning, without starting T4
     work):** what the creator sees when looking through or capturing a Camera View must match the saved
     View and its isolated visitor Preview realization under the same world-presentation state.
  2. **Drafting and inspection aids:** ordinary Plan and 3D Stage readings may legitimately use working
     illumination, fog distances or inspection aids to stay legible during spatial drafting, provided
     Look-through and capture never misrepresent the captured View.
  3. **Future authored lighting and atmosphere (`T2.P02` / `K2`):** Scene-owned authored world
     presentation remains future T2 scope and is not a Core Editor Stability prerequisite.

**Drift reported by PR #153 still stands, with verified governance and ownership on sign-in Save (Fact).
Report it through the router's triage; do not fix product code here.**

- **Sign-in draft recovery works only within the same mounted editor session, not across `/auth` page
  navigation or unload.**
  - **What `T1.P01.S04` implemented:** Inspection of
    [`save-state.ts`](../apps/editor/src/lib/authoring/save/save-state.ts),
    [`head-save.ts`](../apps/editor/src/lib/authoring/save/head-save.ts) and
    [`EditorHead.svelte`](../apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte) (covered by
    [`head-save.test.ts`](../apps/editor/tests/lib/authoring/head-save.test.ts)) shows that when Head Save
    fails with `auth-required`, `SaveState` captures `pending: SaveRequest` **in memory** and switches the
    Head button to `Resume pending save` (`save.retry()`). This supports **same-mounted-session retry**
    while the `/project/:id/spatial` session remains mounted (not cross-tab state continuity and not
    survival across page unload).
  - **What remains missing for cross-navigation `/auth` recovery:** `EditorHead.svelte` has no in-place
    sign-in trigger, and navigating the tab to `/auth` unmounts the route and destroys `SaveState`.
    Meanwhile, [`project-persistence.ts`](../apps/editor/src/lib/platform/project-persistence.ts) defines
    `writePendingCloudSave` (line 219) and `readPendingCloudSave` (line 240) in `sessionStorage`
    (`portfolio-editor:pending-cloud-save`), and [`+page.svelte`](../apps/editor/src/routes/+page.svelte)
    (lines 70–85) reads `readPendingCloudSave` after `/auth?next=/`, but `writePendingCloudSave` has
    **zero production callers**, carries the legacy `{ name, layout, scene }` shape rather than the v2
    unit envelope, and is forbidden on `/project/:id/spatial` by
    [`editor-host-no-write.test.ts`](../apps/editor/tests/lib/authoring/editor-host-no-write.test.ts).
  - **What the reference and roadmap documents actually state:**
    [`persistence.md`](../docs/reference/components/persistence.md) (`P19`) specifies authenticated owned
    Save (`POST /api/projects` / `PUT /api/projects/:id`, `401` when unauthenticated) and does **not**
    promise `sessionStorage` draft handoff; the phrase "pending sign-in drafts resume" / "resume of the
    sign-in Save draft" appears in the
    [T1.P01.S04 acceptance record](../docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s04-existing-layout-precision/acceptance.md)
    and in the `Error recovery` acceptance-area row of
    [`core-editor-stability.md`](../docs/roadmap/core-editor-stability.md).
  - **Ownership, authorization and verification boundary:**
    [`T1.P01.S06`](../docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s06-integrated-final-gate/implementation-plan.md)
    is the **integrated final verification gate** (`Produces: Recorded phase integration acceptance only`),
    not an implementation slice, and must not have its scope implicitly expanded to add auth or
    persistence wiring. In the roadmap, **T3** (`T3.P01.S04`,
    [`implementation-plan.md`](../docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md))
    owns cutting `platform/project-persistence.ts` and `/routes/+page.svelte` over to the v2 unit
    envelope, while **T1** owns the `/project/:id/spatial` Head Save shell (which required an explicit
    narrow host-integration exception in `T1.P01.S04`). Neither track's current authorization covers new
    cross-navigation `/auth` draft persistence or auth-UI wiring. The owner must therefore either
    **(1)** qualify the `Error recovery` row of `core-editor-stability.md` (and S04's acceptance note) to
    specify same-mounted-session `auth-required` capture and retry while retiring the orphaned legacy
    `writePendingCloudSave` helper during `T3.P01.S04`, or **(2)** explicitly authorize a bounded T1/T3
    implementation change (with any required boundary adjustment) before gate verification. `T1.P01.S06`
    and the `Core Editor Stability` acceptance gate then **verify** the settled behavior.
- **Read-only Stage wording is stale in three docs.** Following PR #148 (`T1.P01.S04`),
  [`README.md`](../README.md), [`north-star.md`](../docs/reference/north-star.md) ("Current shell") and
  [`architecture.md`](../docs/reference/architecture.md) still describe `/project/:id/spatial` as
  read-only with "no write path".

### 2.3 E2: what the hosting spike did and did not establish

E2 was a throwaway, test-only spike against the real `@portfolio/layout-core` planners and compiler.
Its provenance and limits are in §7.3. **Result:** 25/25 tests (independently re-executed in this
review), and none of the three falsifiers fired. It covered 19 single-step edits and 2 composed chains,
on reversed, curved, shared and two-Room fixtures.

As the owner's review asked, the five obligations are kept separate, because existing F.4 entries do not
discharge them automatically.

| Obligation | What E2 showed | What exists in code | Status |
| --- | --- | --- | --- |
| **1. Identity integrity** | Canonical wall IDs **can be re-minted**. `defaultChainAllocator` in [`layout-wall-chain.ts`](../packages/layout-core/src/layout-wall-chain.ts) avoids collisions only against `document.walls` in the *current* document, so after `wS-b` is deleted, a later split mints `wS-b` again for an unrelated span. Both ID-only readings then silently re-hosted content. | No rule forbids canonical ID reuse. `LayoutIdentityLedger` ([`layout-wall-first-types.ts`](../packages/layout-core/src/layout-wall-first-types.ts)) uses a monotonic `cursor` for presentation references (`W1`, `W2`) only, not canonical `wall.id`. | **A T1 finding independent of hosting.** It affects any future persisted cross-domain reference to a Layout subject. |
| **2. Parametric correspondence** (split, reversal, merge) | Arc length is exact (within 4.6e-13 m on curves). A dissolve can keep the survivor's ID while flipping its orientation, and only the dissolve's traversal data maps it. Room merges need the lineage that `reconcileRooms` already computes. | Computed inside the planners; published only as IDs. | Feasible; not exposed |
| **3. Availability across revisions and Save/reload** | An `inferred` resolver matched 19/19 adjacent pairs, but only by re-implementing Layout's rules, which would make it a second authority. | Correspondence is held for each in-session history state, never across Save/reload, and never for non-adjacent revisions. | Missing |
| **4. Domain relationship evaluation** | A test-only face classifier. It needs a face-intrinsic frame (or a reversed survivor mirrors content), centerline (not face) arc length, the exact evaluator rather than compiled samples (which drift 6.4e-4 m), and out-of-range errors instead of clamping. | No Scene host schema, evaluator or F.1 face component. | Missing; design inputs known |
| **5. Acceptance versus impact analysis** | Classification was a pure read-only function of accepted revisions. Every Layout edit stayed single-domain. | The ratified reverse dependency index is unbuilt. Compound acceptance arrives with the cutover. | Read-only impact analysis is viable; nothing is built |

**What E2 does not prove (Inference).**

- **No general engine.** It does not show that Biskiq needs a general relationship engine.
- **No product value.** No creator was involved.
- **No coverage of other hosts or other domains.** It did not cover plinth or object hosts, T-junctions,
  or overlap with Openings, nor any light, View or condition.
- **No resolution of who acts.** It does not settle whether a hosting update is evaluated (Layout-only
  acceptance) or rewritten (compound acceptance).

## 3. Product priorities

### 3.1 Creator outcomes, ranked

Ranked by how many creator types are blocked, and by the cost of unblocking them (Judgment). The
creator types used throughout are: product explainer, educator, photographer or artist, architect or
exhibition designer, and storyteller.

| # | Creator outcome | Blocked today for | Exists | Missing | Cost | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Show Presentations without authoring a tour | Everyone who wants free exploration; every unbound Presentation | Source/program validator admits zero-Stop Presentations; Conservatory's "Empty / ordinary Experience" assumes no active Guide | `T3.P02` design & ratification for lowering preservation, zero-Guide entry policy, Stop-free Presentation activation, run/Camera handoff, and companion navigation (§2.2) | Small | **Settle & build in T3.P02** (owner decision 1) |
| 2 | Bring still images in as content | Photographer, educator, product, editorial | Upload API, image sniffing, storage and release pinning; textured plane schema | Editor upload, an image resource with physical size and aspect, a placeable definition | Small to medium | **Decide at K1 registration** (owner decision 2) |
| 3 | Write words that visitors read | Everyone | Program text records; P02 plans "edit labels/text" | An authored home at the cutover | Small | Already planned (T3.P02); keep |
| 4 | Put content on a surface (wall, plinth or object top), compose without a Room, and surface conservative host-revision diagnostics | Photographer, exhibition, product, object-only | Floor support; read-only compiled face geometry | Surface-placement operation + optional non-rebasing `placedOn` provenance (`A1`, §4.3); Room-free `floor-datum` / plinth support (§2.2) | Medium | **First post-stability T2 candidate** (§4.3) |
| 5 | Faithful Camera look-through/capture and visitor Preview realization, plus future authored lighting | Everyone | Scene lights; hard-coded canvas rigs | Capture / Preview / visitor visual fidelity under the same world-presentation state (`T3.P02`); future Scene-owned authored lighting/atmosphere (`T2.P02`) | Small (`T3.P02` fidelity) / Small (`T2.P02` default) | **Route capture/Preview fidelity to T3.P02 planning**; authored default in T2.P02 |
| 6 | *Present this*: frame a subject, space or piece into a Presentation (and optional Stop) in one gesture | Everyone | Compound acceptance lands with the cutover; Conservatory's "Present this" | Items 1–4 plus Frame this (§5.1) | Medium | **Post-stability T2/T3 target** |
| 7 | Walk or click-to-move freely | Explorers, venues | Camera authority; free-controller ownership | A movement profile controller | Medium | Post-stability T3; not needed for item 1 |
| 8 | Content automatically follows a revised wall | Exhibition, architect | E2 | §2.3 obligations 1–5 | Large | **Evidence-gated** (X2) |
| 9 | Scroll-first page | Product, portfolio, editorial | Scroll driver ratified; Guides | Seek, rich content, a delivery profile | Medium to large | **Prototype first** (X1) |

### 3.2 PR #152's product findings, judged on product merit

| Finding | Product merit | Problem with the proposed mechanism | Disposition |
| --- | --- | --- | --- |
| Bring images, text, media and models into an editable spatial experience | **High, and the strongest point in #152.** Every creator type has images and text. | It frames the need as wall-hung art for "museum curators … overwhelmingly". That is gallery-centric. | Images and text as general content (outcomes 2–4). Not wall art first. |
| Content-first, space-first and Experience-first entry without mandatory Rooms or Guides | High; already ratified | It treats entry as UI sequencing, and misses the two code contradictions (§2.2) | Fix the contradictions; a content tray is just the resource collection. No persona chooser. |
| Basic 2D artwork and accessible primitives | High | — | A framed image panel and text as Experience content in the semantic DOM. No world-baked text yet. |
| Honest import readiness, scale, pivot, footprint, provenance and replacement | High; K1 already requires scale, pivot and footprint | `Ready / Needs Repair / Blocked` adopted as a schema | K1 planning names its states. Replacement waits for the first replace workflow. |
| Useful visual defaults | High: the "unattractive output" warning | "Balanced Gallery Wash" is gallery-specific, and nothing says who owns it | Capture / Preview / visitor fidelity under the same world-presentation state in `T3.P02`, then a Scene-owned world-presentation default in `T2.P02` (outcome 5) |
| Subject-relative placement, intuitive editing, understandable repair | High | Delivered through a persisted `SceneSurfaceAnchor` with a cached world transform | Intent tools first (§5.3 D); repair through the ratified four-state report |

### 3.3 Does the planned order serve creators?

- **Until the milestone, mostly yes.** The cutover precedes Experience authoring and K1. That avoids
  building more on adapters that T3.P01.S04 retires (finding K6), and it is a real dependency, not habit.
- **Inside the milestone, the order follows architecture over outcomes in two places.**
  - It requires Wall drawing (K3) and GLB import (K1), but no image.
  - It lets a Presentation exist without a Stop, but plans no way to show one.
  - Both are fixed at planning events that must happen anyway (§6.4).
- **After the milestone, order by creator outcome.** Nothing is planned yet. R1-D's resumption point is
  the right moment to choose, informed by X2.
- **Too many mechanisms are being preserved (Judgment).** Research 6's seam ledger, PR #152's schemas
  and amendments, and this PR's own experiment suite all elaborated mechanisms ahead of any creator
  session. Meanwhile the ratified record names ordinary work as the high-ceiling foundation: "selection,
  duplication, alignment, replacement, camera framing, lighting".
- **Post-stability T2 and T3 phases should therefore favour expressive ordinary operations over new
  mechanisms.** That means align, distribute, replace, frame, place-on-surface and light-this, rather
  than rails, shells, looks or cue systems.

## 4. Architecture

### 4.1 Preserve

Every boundary the review asked to respect holds without change:

- **Layout and Scene stay separately owned.**
- **Camera stays one navigation and evaluation authority.**
- **Experience composes visitor meaning, not Camera geometry.**
- **F.1–F.5 hold.** That covers identity, atomic acceptance, deterministic history and isolation.
- **World \| Experience and Conservatory stay the UX destination.**

No reopening is proposed. Every gap in §2 has an owner under the ratified texts.

### 4.2 Relationships: what is already ratified

The addendum's "directed relationship" is a sound creator-facing idea, but it is **not new**. The ratified
texts already contain each part of it:

- **Attachment** is "a typed relationship with a host and parameters". World-local roots stay the
  default, and "proximity and grouping never imply ownership"
  ([North Star](../docs/reference/north-star.md#stage--world-composition-and-shared-assets)).
- **Revision policy is relationship-specific.** In the record's words: "retain locked Camera framing …
  recompute explicitly assisted framing; follow proved component correspondence … review content when
  its subject changes". It reports unchanged, recomputed, needs review or unresolved
  ([decision record](../docs/reference/decisions/northstar-ratification-2026-09-27.md#representation-revision-and-atomic-authoring)).
- **Each computation declares its reads and outputs.** A reverse dependency index serves invalidation
  and impact reporting. Cycles are rejected unless a declared solver defines them
  ([dependencies](../docs/reference/decisions/northstar-ratification-2026-09-27.md#dependencies-invalidation-and-deterministic-evaluation)).

**Reconciled position (Judgment).**

- **What it is.** A creator-facing principle over the ratified small protocol: F.1 references, F.4
  correspondence and the reverse dependency index. **Not** a generic relationship engine or solver.
- **Domain-owned semantics suffice.** Each kind belongs to the *dependent's* domain (Scene: attachment,
  light aim; Camera: framing provenance; Experience: conditions) and reads its host's published facts
  through a runtime-safe evaluator.
- **Default mode is solved-once ordinary state, with explicit provenance where revision diagnostics or
  recomputation are promised.** A kind is *live* only where declared, matching "assisted direction
  resolves into the same inspectable project state".
- **World-local free composition stays valid on its own,** as the default rather than a fallback.
- **Kinds are independent.** Lights, Views and conditions target subjects whether or not anything is
  hosted.
- **Ordering is not a failure.** A chain (wall, image, light, View) needs deterministic evaluation order,
  which the ratified dependency rules already require.

### 4.3 Surface placement and hosting: what non-rebasing provenance (`A1`) can and cannot guarantee

Comparing pose-only placement (`A0`), provenance-backed placement (`A1`), live parametric hosting (`B`),
and compound rebasing (`C`) requires stating both why `A0` is too weak for revision diagnostics and what
`A1` can and cannot establish without full parametric correspondence (`§2.3` Obligation 2). Nothing here
ratifies a `placedOn` schema, an automatic repair algorithm, or a universal four-state classifier ahead of
the owning T2 phase plan.

| Option | What Scene persists | What a Layout edit does | What revision diagnostics & repair it actually supports | Cost & when |
| --- | --- | --- | --- | --- |
| **A0 · Pose-only solve-once** | World-local `position` and `rotation` only (no provenance). | Content stays at its world coordinates. | **No reliable host-intent diagnostics.** Without provenance, a wall move or deletion leaves the item floating silently; guessing by proximity violates "proximity and grouping never imply ownership" and false-flags intentional free placements. | Small (zero schema change). |
| **A1 · Pose authority + optional non-rebasing provenance (recommended first step)** | Authoritative world-local `position` and `rotation` **plus** optional non-rebasing host provenance (an `F1.reference@1` host reference plus placement-time contact evidence, requiring T1 ID non-reuse). | Content stays at its world coordinates; Layout edit remains single-domain F.4. Never silently mirrors on `G2`/`C2` dissolve because world-local pose is authoritative. | **Conservative diagnostics (`Unchanged`, `Needs Review`, `Unresolved`) and bounded explicit repair** — see exact limits below. Does not auto-recompute poses (`Recomputed` never fires) and cannot auto-retarget across splits or merges without §2.3 Obligation 2. | Medium: one read-only Layout face query, one Scene operation, optional F.1 host + contact provenance, plus T1 ID non-reuse. **First post-stability T2 candidate.** |
| **B · Live parametric hosting, evaluated** | Host parameters are the authoritative pose source; world frame is evaluated on read. | Content follows automatically (`Recomputed`) on wall move, lengthen or proved split/dissolve; flags `Needs Review` / `Unresolved` on shorten or delete. | Requires all five §2.3 E2 obligations (monotonic IDs, published split/dissolve/merge correspondence, face-intrinsic frame, exact curve evaluator). | Large. **Evidence-gated on X2.** |
| **C · Compound rebase** | World-local pose or host parameters rewritten inside every Layout edit. | Content follows by mutating Scene inside every Layout F.4 acceptance. | Couples every Layout edit to Scene validation/history; rejected because E2 proves single-domain Layout acceptance (A1 or B) suffices. | **Rejected.** |

**Five technical boundaries govern Option A1 (Fact & Inference):**

1. **`placedOn` is a persistent `F.1` semantic dependency even though it does not drive live transforms.**
   Because `placedOn` persists a cross-domain reference from a Scene object to a Layout subject (`wallId`,
   `roomId` or plinth `LayoutObject`), it is an `F1.reference@1` semantic dependency under
   [composition-execution.md §F.1](../docs/reference/composition-execution.md#f1-identity-and-reference)
   and registers in the reverse dependency index for revision invalidation and impact reporting—even
   though the Scene object's world-local transform remains the sole runtime pose authority.
2. **Why `wallId + canonical side/offset` alone is not sufficient across all wall edits.**
   - *Wall reversal on dissolve (`G2` / `C2` in E2):* Because `A1` keeps the world-local pose
     authoritative, the placed object does **not** visually flip when a survivor wall reverses its
     `start → end` direction. However, if `placedOn` compared only canonical `side` (`left` / `right`)
     and centerline offset `s`, a survivor orientation flip would invert `left`/`right` and `L - s`
     even when the physical wall face in world space did not move. Conservative `A1` contact evaluation
     must therefore test the stored world-local pose (and placement-time world face normal / contact
     clearance) against the resolved wall's current compiled faces rather than relying on canonical
     `side` alone.
   - *Wall shortening, movement, thickness change or height lowering:* The host `wallId` still resolves,
     and testing the stored world-local pose against the resolved wall's current face surfaces and span/height
     bounds deterministically detects when the item now floats off the face, penetrates the wall, or
     overhangs a shortened span (`Needs Review`).
   - *Wall split (`wS` → `wS` + `wS-b`), wall merge/dissolve (`wS-b` retired into `wS`), or Room merge:*
     Without published topological correspondence (`§2.3` Obligation 2), `A1` **cannot** know that `wS-b`
     was split from `wS` or dissolved into `wS`, nor which survivor Room absorbed a retired `roomId`.
3. **How host identity, stored contact evidence and revision-qualified evaluation distinguish states in `A1`:**
   - **`Unchanged`:** `F.1` resolves the referenced host as `present` in the target Revision, and the
     stored world-local pose still satisfies face contact, outward normal alignment and span/height/opening
     bounds on that host (for example, an unrelated wall was edited, or the host wall was lengthened at
     its far end without moving the face under the object).
   - **`Needs Review`:** `F.1` resolves the referenced host as `present`, but revision-qualified
     evaluation shows the stored world-local pose no longer satisfies contact, orientation or bounds on
     that host (including when a split shortened `wS` so an object sitting on the new `wS-b` half now
     lies outside `wS`'s span).
   - **`Unresolved`:** `F.1` reports the referenced host ID as `missing` (deleted wall, dissolved wall ID
     `wS-b`, or retired Room ID after a merge), so no host surface exists to evaluate against.
   - *(Note: `Recomputed` belongs only to live relationships such as Option B; `A1` never silently moves
     the object.)*
4. **`Re-seat` is a single-domain Scene operation only when the original host still resolves and the
   projection is unique and in-bounds.**
   - **Supported as a single-domain Scene F.4 pose update:** the referenced `wallId` still resolves
     (`Needs Review` after a wall move or thickness edit) and projecting the object's world position onto
     the wall's current face yields a unique, unobstructed, in-bounds placement.
   - **Refused (requires explicit creator host re-pick or `Detach`):** when the host is `Unresolved`
     (deleted, or retired by a merge/dissolve), when a wall shortening or split leaves the projection
     out of bounds on the referenced `wallId` (since switching `placedOn` to `wS-b` without correspondence
     is a host change), or when the target span overlaps an Opening or is geometrically ambiguous. In
     those cases, automatic `Re-seat` refuses and the creator explicitly chooses **Pick new surface**
     (writing a new Scene pose + `placedOn` target) or **`Detach`** (clearing `placedOn` provenance to
     keep the free world-local pose).
5. **T1 canonical ID non-reuse is necessary for `A1`, not a substitute for correspondence.**
   - Non-reuse (for example via a monotonic entity-ID cursor alongside `LayoutIdentityLedger` in
     [`layout-wall-first-types.ts`](../packages/layout-core/src/layout-wall-first-types.ts)) is **required**
     so a deleted `wS-b` is never re-minted for a different wall and mistaken for `present`.
   - With ID non-reuse alone, `A1` handles single-wall move, thickness, height, shorten and delete
     conservatively, while topological splits, dissolves and Room merges degrade safely to `Needs Review`
     or `Unresolved` (manual re-pick or `Detach`). Automatic retargeting across splits, dissolves or
     merges requires `§2.3` Obligation 2 correspondence.

**Not preferred: PR #152's `SceneSurfaceAnchor` with both parametric host coordinates and an
authoritative cached world transform.** Storing two writable pose authorities creates reconciliation
ambiguity. In **Option A1**, the world-local transform is the *sole* pose authority and `placedOn` is
an F.1 semantic reference + contact provenance for conservative diagnostics and bounded explicit repair;
in **Option B**, the host parameters are the *sole* pose authority and visitor packages may carry a
compiled delivery derivative under hard rule 3.

**E2b (a light and a View chained through a hosted image) is withdrawn.** It was meant to decide whether
T1's obligation is relationship-generic. It is not needed for that:

- What Layout must publish is the same whichever consumer reads it.
- A light aim and a View framing depend on Scene and Camera subject identity, not on wall faces.
- Deterministic chain order is already ratified.

### 4.4 Real missing mechanisms

| Mechanism | Owner | First consumer | When |
| --- | --- | --- | --- |
| Guide-free Presentation reachability (lowering preservation, zero-Guide entry policy, Stop-free Presentation activation, run/Camera handoff, companion navigation) | T3 (Experience), designed and ratified alongside the consumer | T3.P02 Preview | P02 registration |
| An authored home for Presentation text and invocation bindings | T3 | T3.P02 | Cutover (already a pre-S04 decision) |
| Look-through capture / Preview / visitor visual fidelity under the same world-presentation state; later Scene-owned authored world presentation | T3.P02 consumer planning now; T2 (Scene) for authored lighting/atmosphere | T3.P02 capture & Preview; T2 lighting | Capture/Preview fidelity at P02; authored world presentation in T2.P02 |
| A still-image resource with physical size, aspect and provenance | T2 and resources | K1, or the next T2 phase | K1 registration |
| A read-only face query, a surface-placement operation with optional `placedOn` F.1 provenance (`A1`), and `floor-datum` / plinth support without a Room | T1 (query), T2 (operation) | T2 surface placement (Option A1) | After stability |
| Canonical Layout ID non-reuse (monotonic wall/junction ID allocation) | T1 | Any persisted Layout reference (`placedOn`, F.1, or Option B) | In K3 / T1.P02, before persisted Layout references ship |
| A movement profile controller (walk, click-to-move) | T3 (Camera authority) | Free exploration | After stability |
| Impact-report classifiers over the reverse dependency index | Each domain | The first relationship that persists | With that relationship |
| Seek and progress mapping for scroll-driven Guides | T3, and T4 profiles | Scroll delivery | After X1 |

### 4.5 Rejected and corrected proposals

| Proposal | From | Problem | What survives |
| --- | --- | --- | --- |
| A new `CompositionalAdvisory` / `Needs Review` tier via **AM-9** | #152 | The four-state report is already ratified. **AM-9 is taken:** the merged S04 preflight proposes it as "Shared Camera and Experience cutover" ([gate draft](../docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/preflight/gate-draft.md)). | Implement the ratified states with the first persisted relationship. |
| `Needs Review` as a general rule ("acknowledge and publish") | #152 | Whether release is blocked depends on the selected program and profile, and a warning cannot waive an executable failure (#151) | Keep it per profile at T4 |
| `SceneSurfaceAnchor` with a cached authoritative transform; Room-floor and wall-face `FrameResolver`s | #152 | Two pose authorities. AM-1: "a Room without an authored frame cannot qualify". E2: Room hosts carry membership only. | Option A1, then B if X2 warrants (§4.3) |
| `floorOffset` on derived Rooms | #152 | Conflicts with P23.6H/I, where Wall height is measured from the Floor elevation ([persistence](../docs/reference/components/persistence.md)) | A question for T1 levels planning |
| F.3 families `scene.environment@1`, `scene.light@1` and others | #152 | Invented. Only `layout.plan@1` and `camera.session-inspection@1` exist. | Mint families with their first consumer |
| Drafting F5 and a three-tier gate "for T4.P01" in parallel now | #152 | R1-D defers all T4 planning; T4.P01 is unregistered | Nothing until R1-D resumes |
| "FreeController mode" as free roam; "ExecutionProgram@1 shipped" | #152 | The free controller is release and rejoin with no movement; the program has no product caller | §2.1 |
| "About 80% already captured" | #152 | Not measurable | — |
| Poses, clips and looks inside Scene; Zones and Cue stacks; implicit runtime visit memory | Research 6 | Conflicts with typed resources, Conservatory §0.8.1 and declared session state. All three reviews agree. | Lower visit conditions into declared state at compile time |
| Camera owns section and clipping planes; Room-local origins; "every valid World edit always commits" | Research 6 | AM-3 gives Layout the representation; Scene is world-local; F.4 atomicity binds | #151's corrections stand |
| Hosted staging first; K3 substitution; directed relationships as a new primitive; venue pluralism pursued; E1–E7 | #153 | §1 | E2 evidence; drift findings; evidence re-tiering |
| Guide-free capability preferred as the first follow-on after P02, with P02 inclusion only as an alternative | #151 | Leaves P02 silently dropping content that its own criteria let creators author | Include the minimum in P02 (decision 1) |

## 5. Opportunities and open UX questions

### 5.1 *Present this*: the fastest compound workflow (without a piece-only ontology)

**The opportunity (Judgment).** Many novice and intermediate creators think in *subjects shown with
meaning*: a space, object or mechanism, how it is framed, and what the visitor reads or hears. Biskiq
rightly splits these across Layout/Scene, Camera and Experience. The UX risk of that separation is that
creating one presented moment can require visiting three surfaces. The ratified bridge already exists:

- **Compound acceptance.** The decision record's own example is "insert kit, attach to Wall, capture a
  View, bind it to a Presentation, optionally create a Stop". Its first implementation lands with the
  cutover.
- **Conservatory's "Present this".** Creation starts from any selected subject or current viewpoint.

**The flow.**

1. The creator drops an image or model, selects an existing subject (an object, a Wall/Room, or a
   multi-object group), or frames an architectural sightline with zero selected objects.
2. Invoking **Present this** proposes up to four domain-owned steps:
   - if new content was dropped, a placement on the surface under the cursor (with `placedOn` provenance);
   - a framed Camera View (*Frame this*, or the current Look-through view for a zero-object sightline);
   - a Presentation with title and caption fields bound to that View and optional subject reference(s);
   - optionally, a Stop in the active Guide.
3. Accepting commits one atomic F.4 entry with one Undo.
4. Each part remains ordinary state, independently editable in its own domain.
5. Once Guide-free access exists (§2.2), the Presentation is reachable in Preview immediately. When a
   Guide is used, it sequences **Stops** (editorial occurrences with their own entry invocation, hold and
   continuation, allowing repeat visits such as `Intro → Piano → Paris → Piano → Exit`), never a flat
   1:1 list of objects.

**Why this avoids narrowing the product.**

| Creative mode | How the workflow applies without forcing a "single piece + placard" mold |
| --- | --- |
| **Space-first / architectural** | Frames a threshold, Room proportion or daylight sightline with **zero Scene objects** (`subjectRefs: []`), binding a View and optional architectural note |
| **Piece-first / showcase & portfolio** | Places an image panel or 3D model on a surface, frames its View, and binds its caption |
| **Process / mechanism explainer** | References **multiple subjects** or a component relationship in one Presentation ("How power reaches the generator") |
| **Curated tour / narrative** | Reuses one Presentation across multiple Guide Stops with different entry framing or state guards |

**What it needs.** Nothing beyond §4.4's items and the cutover. **Smallest test:** in the first slice
that ships it, observe whether creators keep the proposed placement and View or redo them. **Owner
decision:** none now; it is a post-stability target for T2 and T3.

### 5.2 A · Spatial web and scroll-first Experiences

This is the most consequential unresolved UX question. **A scroll-driven Camera controller is not by
itself an authored scroll-first Experience.** The ratified texts admit both:

- **The decision record.** "A scroll driver maps progress to supported direction", and drivers "share
  evaluation, not necessarily identical session state"
  ([hosting and embeds](../docs/reference/decisions/northstar-ratification-2026-09-27.md#hosting-embeds-live-sessions-film-and-sdks)).
- **The North Star's web experience layer.** It lets Experience author "text, images, panels, buttons,
  links, audio/video, forms, responsive overlays, and page/view navigation". It also rules out "a
  Webflow-like website builder"
  ([web layer](../docs/reference/north-star.md#web-experience-layer)).

The three forms compare as follows (preserving Guide/Stop as the sole ordering authority — never a
second "ordered Presentation list" on `presentations[]`):

| Form | Mechanism | Fit with Conservatory | Missing |
| --- | --- | --- | --- |
| **1 · A Guide driven by scroll** | Stops become sections. Scroll progress maps to Stop index and Travel fraction, evaluated by Camera. | **Natural.** It is the same Guide instrument with a scroll Preview profile. | Seek and scrub (the interpreter is forward-only), and a section layout for Presentation content |
| **2 · Guide-free progression** | Unordered free exploration plus a Presentation destination index and spatial markers. This is the "escape hatch" the interface study finds even expressive portfolios keep ([navigation](./spatial-interface-authoring-ux.md#1-1-visitor-navigation-and-wayfinding-p3)). | **Natural.** Conservatory's "Empty / ordinary Experience" already assumes no active Guide. | §2.2's fix; a movement controller for free roam |
| **3 · A rich reading page** | DOM sections with typographic content, media and HTML interactions bound to Presentations and Guide Stops, with a pinned or embedded canvas | **Open.** It may justify one bounded *invoked* Experience instrument for reading layout over the same `Presentation` and `Guide` records. Never a new lens. | Rich content records; layout hints; embed delivery |

**Two findings shape the answer.**

- **Scroll is locally linear, but can still support authored choices at Stop holds without a competing
  Camera system.** While continuous scroll maps progress along the currently active Stop chain, a held
  Stop in `ExecutionProgram@1` can expose inline choice actions (`set-state` or guarded `navigate-to`).
  When a visitor reaches a choice Stop, forward scroll pauses at the hold until a choice is selected (or
  the choice updates session state / branches to the chosen Stop), and every resulting Cut or Travel
  continues to evaluate through the single Camera authority. Free-roam hub-and-spoke exploration belongs
  to Form 2.
- **There is a real opening (Fact, from the interface study).** Spline "lacks a native, accessible 2D
  typographic layout and multi-stop curatorial storytelling engine"
  ([web design](./spatial-interface-authoring-ux.md#2-1-web-design-and-stateful-p2)). Biskiq's
  Presentations, Guides and required semantic DOM navigation fit that gap.

**Disposition.**

- **Keep:** one Camera authority, one Experience domain and the existing lenses. No Website lens, no
  second Camera timeline, and no ordered sequence on `presentations[]` outside a Guide.
- **Do not declare the question solved** because scroll can drive Camera.
- **Run X1 across both Guide-free and Guide-based creation** (§6.3). Over comparable content, X1 tests:
  - **(Scenario 0 · Guide-free creation):** authoring and delivering a spatial-web page directly from
    `Presentation` records, contextual content and an unordered semantic destination index + spatial
    markers (no Guide authored, and no second writable Presentation order), testing whether creators can
    deliver a coherent spatial-web experience without a Guide or whether an explicit Guide is naturally
    necessary once they want scroll progression;
  - **(Variant A · Auto-laid Guide scroll):** auto-laid scroll sections derived directly from
    Conservatory's existing `Guide` Stops + `Presentation` cards (including one held choice branch);
  - **(Variant B · Invoked Reading / Page Layout instrument):** a bounded invoked reading-layout sheet
    over the same `Presentation` and `Guide` records.

### 5.3 The other four directions

**B · Narrative and condition authoring: defer, and keep two requirements.**

- **What it is.** Non-programmers state conditions in their own terms (visited, inspected, chose, or
  *n* of *m* found). Each one lowers deterministically into declared state and guards that experts can
  inspect. This is progressive semantic authoring over the ratified kernel, not a second runtime.
- **The addendum's claim is withdrawn.** It said subject predicates are revision-safe and variables are
  not. Static reachability analysis (Ink's "loose ends") catches an unreachable setter just as well.
- **Keep, as requirements:**
  - **Rehearsal:** "preview as a visitor who has…", through explicit initial state or checkpoints, which
    the ratified determinism rules support.
  - **Loose-end diagnostics.**
- **Program v1 has boolean and choice state only.** Counts, which training and showroom journeys need,
  are an operator-set planning choice.
- **Experiment:** the storytelling study's three-room mystery protocol, plus a revision step, with
  semantic phrases tested against a variable editor
  ([protocols](./spatial-storytelling-ux.md#experimental-protocols-for-the-four-discriminating-p2)).
- **When:** before T3 plans Gates or state authoring.

**C · Alternatives and Look-Dev: defer, keeping four lifecycles distinct.**

1. **Comparing revisions,** to see what changed. This belongs to impact-report UX.
2. **Provisional editor-session A/B.** Two candidates are prepared but not accepted; choosing one makes
   one ordinary acceptance. F.4's prepare/accept split already separates a candidate from accepted
   state. Holding two at once is new editor-session state, never serialized, but it needs no new
   document or history system.
3. **Persisted authored variants.** Layout's validated alternatives are ratified (P29).
4. **Visitor-controlled Looks.** These are runtime states held as typed resources.

Do not merge 2 into 4, which is Research 6's error. **Experiment:** when T2 plans light or environment
authoring, compare session A/B with plain Undo-based iteration
([pillar 4](./creative-scene-composition-ux.md#pillar-4)).

**D · Inverse manipulation and intent tools: adopt as a design principle now, with no new mechanism.**
The creator states a result, and the owning domain's planner solves its own narrow inverse into an
ordinary, inspectable F.4 intent.

- **Candidate tools, by owning domain:** Frame this (Camera: fit the subject's bounds to the frustum);
  Place on this surface (Scene, with the Layout query and optional `placedOn` provenance); Light this
  (Scene: aim at the subject at a chosen incidence); Align and distribute (Scene); Centre an Opening
  (Layout).
- **When to apply directly, and when to suggest.** Use a **smart default** when the solution is unique,
  cheap to undo and low in taste content. Offer an **explicit suggestion with alternatives** when taste
  or ambiguity is involved. **Disclose uncertainty** where the solve is approximate, for example
  view-dependent highlights ([direction 3](./creative-scene-composition-ux.md#direction-3-p3)) or
  occluded framing.
- **Provenance** is kept where revision diagnostics or recomputation require it (`placedOn` for surface
  stranding in Option A1; assisted framing in Camera). **No universal solver.** The study's top-priority
  prototype, effect-first lighting, becomes a UX check when T2 plans lights
  ([experiment 1](./creative-scene-composition-ux.md#priority-experiment-1)).
- **First candidates:** Frame this as an inverse capture verb in T3.P02, which proposes and lets the
  creator confirm through Look through (Conservatory forbids silently capturing a drafting reading); and
  Place on this surface in T2 surface placement.

**E · Alternative spatial representations: no change.**

- **Unroll, Section, Exploded and Reveal are representation only.** They extend Layout's AM-3 Plan
  family and the World/Stage instruments.
- **Unroll gains a concrete job once surface placement exists.** It becomes the precise 2D arrangement
  view for wall content.
- **Genuinely new geometry waits at T1's future decision points.** That covers continuous ramps,
  multi-level topology and overhead surfaces. When T1 plans levels, run the multi-level study's P2 with
  non-CAD users first ([direction 2](./multi-level-spatial-authoring-ux.md#direction-2),
  [stress tests](./multi-level-spatial-authoring-ux.md#stress-testing-p6)).

## 6. Roadmap consequences

### 6.1 T1–T4

| Track | Verified state | Implication | Kind |
| --- | --- | --- | --- |
| **T1** | P01: S01–S04 and S07 shipped; S05 and S06 proposed (`S06` is the phase final verification gate, producing recorded integration acceptance only). K3 bounded straight-Wall creation is ruled for after the F2 cutover, and unplanned. | No change to P01 or K3. Do not expand `T1.P01.S06` into an implementation slice; `S06` verifies the settled sign-in Save recovery behavior after the owner chooses between same-mounted-session retry wording or an explicitly authorized T1/T3 persistence change (§2.2). Inputs for K3 / T1.P02 planning: canonical ID non-reuse (§4.3); a runtime-safe, read-only face query with face extents in canonical arc parameter and an exact evaluator that errors rather than clamps; correspondence publication only if live hosting (`B`) is registered. Levels and overhead geometry stay future decisions. | Verification boundary; T1.P02 planning input |
| **T2** | P01: S01–S02 shipped; S03 authorized, in review as PR #147; S04 proposed. K1 bounded GLB import is ruled for after T3.P01.S04, and unplanned. | No change to P01, whose floor support stays transient. K1 registration: owner decision 2. Post-stability candidates: surface placement with optional non-rebasing `placedOn` provenance (Option A1) and `floor-datum` / plinth support (§2.2, §4.3); future Scene-owned authored lighting and atmosphere (`T2.P02`); Light this; *Present this* with T3. | Owner decision 2; candidates |
| **T3** | P01: S01–S03, S05 and S06 shipped; S04 proposed, with its preflight merged (inventory "not executed"). Cutover gate undrafted. P02 is a candidate and unregistered. | The S04 path is unchanged (and `S04` already owns cutting `platform/project-persistence.ts` over to the v2 unit envelope). Input to the cutover gate draft: the Guide-free drop is not among S06's residuals. P02 registration: owner decision 1 (settling the five Guide-free sub-problems and any ratified contract adjustment alongside the first consumer, §2.2), Look-through capture / Preview / visitor visual fidelity under the same world-presentation state (§2.2), plus Frame this as an optional verb. The authored text home stays as planned. A movement controller comes after stability. | Owner decision 1; P02 consumer planning input |
| **T4** | Planning; no registered phase. F5 and the prepared reader are undrafted. R1-D defers all T4 work. | No change, and no T4 work starts now. When planning renews: Guide-free execution, the scroll and embed profile informed by X1, visitor world-presentation parity, and image resource closure. | Trigger |
| **Core Editor Stability** | Direction and K1–K4 approved; the 13 acceptance-area rows in [`core-editor-stability.md`](../docs/roadmap/core-editor-stability.md) remain "proposed pending explicit owner confirmation". | Confirm the 13 acceptance-area rows with no Research 6 rows added. Decisions 1 and 2 are scope of contributing phases, not new milestone rows. For the `Error recovery` row ("resume of the sign-in Save draft"), resolve whether same-mounted-session retry satisfies the row or whether a bounded T1/T3 cross-navigation change is authorized before `T1.P01.S06` and milestone verification (§2.2). For the `Camera/Experience authoring` and `Isolated Preview` rows, include a Guide-free Presentation check if Decision 1 is approved. | Owner decision 3 |

### 6.2 Sequence

1. **Now, unchanged:**
   - finish the authorized T2.P01.S03 (PR #147);
   - continue T3.P01.S04's existing route to authorization: the actual inventory, migration and refusal
     coverage, recovery and publication disposition that its owner decisions require;
   - triage the verified drift items (owner disposition on sign-in Save same-mounted-session retry vs
     explicit T1/T3 authorization before `T1.P01.S06` verification; stale read-only Stage text in
     `README.md`, `north-star.md` and `architecture.md`).
2. **At planning events that must happen anyway:**
   - T3.P02 registration (decision 1 + Look-through capture / Preview / visitor fidelity planning);
   - K1 registration (decision 2);
   - K3 and K4 as ruled (including canonical Layout ID non-reuse in T1.P02);
   - confirming the 13 Core Editor Stability acceptance-area rows (decision 3).
3. **After stability acceptance:**
   - run X2;
   - renew T4 planning under R1-D, because sharing is the ratified activation event;
   - in parallel, T2 surface placement (Option A1) + Room-free `floor-datum`/plinth support and *Present this*;
   - in parallel, T3's movement controller.

### 6.3 Experiments

| ID | Question | Minimum | Falsifier | Decision it settles | When |
| --- | --- | --- | --- | --- | --- |
| **X1 · Scroll-first page** (disposable, no product code) | (1) Can creators author and deliver a coherent spatial-web experience directly from Guide-free `Presentation` records and contextual content, or is an explicit `Guide` naturally necessary once they want scroll progression? (2) When a Guide is used, do auto-laid sections suffice or does a bounded invoked *Reading / Page Layout* instrument earn its keep? | Using comparable content and the real interpreter + `camera-core` sampling, compare **(Scenario 0 · Guide-free)** a Presentation constellation with contextual content and an unordered semantic destination index + spatial markers (no Guide, no second writable Presentation order) against two 5-Stop Guide variants (including one held Stop with an inline choice that branches via `set-state` / `navigate-to`): **(Variant A)** auto-laid scroll sections from Conservatory's `Guide` + `Presentation` cards and **(Variant B)** a bounded invoked reading-layout sheet over the same records. Have 3–5 creators (or an owner review) rebuild two reference pages. | Scenario 0 tempts creators to invent a second writable Presentation order outside a Guide; Variant A is rejected in at least half the ordered tasks for layout/rhythm control; or Variant B tempts creators to author state that cannot lower to `Presentation` + `Guide`/`Stop`. | Whether Guide-free spatial-web pages suffice for non-linear pieces while scroll progression stays a `Guide` concern; the Experience content model; whether Conservatory gains a bounded invoked reading-layout instrument; how held choice branches behave in `scroll-progress@1` | Any time; before T4 planning renews |
| **X2 · Creators on the stability build** | What do creators do with their own content and a real audience? When they revise walls under surface-placed content, are conservative `placedOn` diagnostics (`Needs Review` / `Unresolved`) + bounded `Re-seat` / host re-pick (Option A1) sufficient or is live parametric hosting (Option B) required? | 3–5 creators in at least 3 non-gallery categories, using their own material. Each shows the result to an audience in Preview, because publication may be unavailable between the cutover and T4 (K2). | — (observational) | The post-stability order (T4 against T2 and T3 depth); whether Option A1 suffices or Option B live hosting + §2.3 correspondence should register (§4.3) | Between stability acceptance and T4 planning |

**Dormant, each with a trigger.**

- **Captured venues (E4):** creators who mostly present existing places.
- **Conditions (B):** before T3 Gates.
- **Session A/B (C):** before T2 lighting.
- **Light this (D):** with T2 lighting.
- **The multi-level study's P2 (E):** before T1 levels.

**Do not build to answer these:** a production share route, a release format, an ingest pipeline, a
relationship engine or agent infrastructure.

### 6.4 Owner decisions and governance classification

To avoid conflating bug fixes, phase-registration scope choices, milestone expansions and future
triggers, every action item from this reconciliation is classified by its exact governance kind:

| Governance kind | Items | Owner action required |
| --- | --- | --- |
| **1. Correcting a verified behavioral or contract inconsistency** | *(a)* Guide-free Presentations dropped by `lowerExperienceProgram` and `enter()` completing on `entryStopId === null` (§2.2); *(b)* sign-in Save recovery working only for same-mounted-session retry (`head-save.ts`) while the legacy `writePendingCloudSave` (`project-persistence.ts`) has zero production callers across `/auth` page navigation (§2.2); *(c)* Look-through capture vs visitor Preview lighting/fog mismatch (`40..120` vs `22..54`, §2.2); *(d)* stale read-only Stage text in `README.md`, `north-star.md` and `architecture.md`. | **(a)** is folded into **Owner Decision 1** at `T3.P02` registration (with exact representation and any contract amendment settled alongside the first consumer); **(b)** is resolved under **Owner Decision 3** (either qualifying the `Error recovery` row to same-mounted-session retry while `T3.P01.S04` retires the legacy helper, or explicitly authorizing a bounded T1/T3 change before `T1.P01.S06` verifies it); **(c)** routes Look-through capture / Preview / visitor fidelity to `T3.P02` consumer planning without starting T4 work; **(d)** is routine doc-triage cleanup. |
| **2. Changing a future phase's proposed scope at registration** | *(a)* Including Guide-free Presentation reachability in `T3.P02`; *(b)* optionally admitting still-image (`PNG`/`JPG`/`WebP`) import onto a canonical textured plane alongside `.glb` when `K1` (`T2.P02`) registers. | **Owner Decisions 1 and 2** below (taken when `T3.P02` and `T2.P02` register). |
| **3. Confirming vs expanding milestone acceptance criteria** | Core Editor Stability ([`core-editor-stability.md`](../docs/roadmap/core-editor-stability.md), 13 acceptance-area rows) pending confirmation since 2026-10-17. | **Owner Decision 3** below: confirm the existing 13 acceptance-area rows **without adding new rows**. Still-image import (Decision 2), even if admitted into `T2.P02`, does not become a new gate blocking stability acceptance. |
| **4. Registering a future capability or bounded prototype** | `X1` scroll-page comparison prototype (Guide-free Scenario 0 + Guide Variants A and B); `X2` post-stability creator observation; post-stability T2 surface placement with conservative `placedOn` provenance (Option A1) and `floor-datum`/plinth support; T1 canonical ID non-reuse in `T1.P02`. | No immediate authorization needed; scheduled at their named phase registrations or post-stability checkpoints. |
| **5. Deferring with an explicit trigger or refusing** | Live hosting Option B (gated on X2); narrative conditions (before T3 Gates); session A/B and Light this (with T2 lighting); multi-level P2 (before T1 levels); refused second authorities (§6.5). | None unless the named trigger fires. |

| # | Decision | Governance kind | Recommendation | If nothing is decided |
| --- | --- | --- | --- | --- |
| 1 | **At T3.P02 registration:** require Guide-free Presentation reachability and settle its mechanism with the first consumer? | Behavioral inconsistency fix + `T3.P02` phase-registration scope (does not add milestone rows) | **Adopt the requirement in `T3.P02`:** every valid authored Presentation must remain accounted for, and supported Guide-free Presentations must be reachable through explicit visitor navigation and Camera Cut semantics, without fabricated Stops. Leave the exact representation and any `ExecutionProgram`/interpreter/companion contract amendment across the five sub-problems (§2.2) to `T3.P02` first-consumer design and owner ratification. | P02 ships authoring that creates Presentations its own Preview silently drops, inside a capability ("bind a Presentation plus an optional Stop") the milestone's `Camera/Experience authoring` and `Isolated Preview` rows already propose. |
| 2 | **At K1 (`T2.P02`) registration:** admit still images (`PNG`/`JPG`/`WebP`) alongside bounded `.glb`? | Future phase-registration scope beyond ruling `K1` (kept out of milestone gate rows) | **Option 2A (low-risk):** keep `T2.P02` strictly `.glb`-only per `K1` and make still-image panels the first post-stability T2 slice. **Option 2B (recommended if T2 planning confirms low cost):** admit still images in `T2.P02` reusing the existing `asset-persistence.ts` upload/sniffing/storage path and textured-plane primitive, without adding a new milestone row. | If neither is planned promptly, creators in X2 have no way to use the most common flat content they own. |
| 3 | **Confirm the 13 Core Editor Stability acceptance-area rows** (pending since 2026-10-17) and settle the `Error recovery` sign-in Save disposition | Milestone acceptance criteria confirmation + T1/T3 ownership routing | **Confirm the existing 13 acceptance-area rows with zero Research 6 additions.** On the `Error recovery` row ("resume of the sign-in Save draft"), choose between **(3A)** qualifying the row (and `T1.P01.S04`'s note) to same-mounted-session `auth-required` capture and retry while `T3.P01.S04` retires the orphaned legacy `writePendingCloudSave` helper, or **(3B)** explicitly authorizing a bounded T1/T3 cross-navigation persistence/auth change before `T1.P01.S06` and milestone verification. Include a Guide-free Presentation check under the `Camera/Experience authoring` and `Isolated Preview` rows if Decision 1 is approved. | No settled acceptance definition exists for lifting the R1-D T4 deferral, or `T1.P01.S06` faces an unresolved gap between S04's same-mounted-session implementation and the `Error recovery` row wording. |

No new ruling is needed to keep authorities separate, keep one executor and one Camera authority,
forbid silent retargeting, require honest import capabilities, or keep R1-D. Those are already ratified
or ruled.

### 6.5 Defer and refuse

**Defer, with triggers:**

- live hosting and correspondence publication (X2);
- the impact-report UI (its first persisted relationship);
- the movement controller (after stability);
- the scroll and embed profile (X1, then T4);
- condition and state authoring (T3 Gates);
- session A/B and persisted variants (T2 lighting; P29);
- Light this, shutters and solving for the sun (T2 lighting);
- captured venues (creator demand);
- levels, ramps, overhead geometry and scoped SDF cutters (T1 levels or overhead planning);
- puppeteering and physics bake (a need that a GLB clip cannot meet);
- transcript pinning and a component-studio drawer (when their consumers are planned);
- agent scaffolding (once typed intents are wired);
- kits (after *Present this*).

**Refuse:**

- **Second authorities:** a generic relationship engine, constraint solver or node graph; a second Camera
  timeline, or recorded camera trajectories replayed outside Camera evaluation; two authorities for one
  pose; an ordered sequence on `presentations[]` outside a Guide; implicit runtime visit memory; a
  standalone Cue stack.
- **Ownership leaks:** ownership implied by proximity; Room-local coordinate frames; poses, clips or looks
  stored in Scene; authoring alternatives folded into runtime Looks; view-dependent highlights persisted
  as live relationships; invisible Stops to make Guide-free work.
- **Scope creep:** a Website lens or a third Interface lens; full-building SDF and general SDF sculpting;
  a shadow publication path; the Category A seam ledger as infrastructure; governance machinery not tied
  to a correctness risk; any T4 drafting before R1-D resumes.

## 7. Evidence and limits

### 7.1 Provenance

| Source | Revision | Use |
| --- | --- | --- |
| Repository `main` | `26290839` (PR #148 merge, 2026-10-18; unchanged at writing) | All code facts |
| [PR #151](https://github.com/Biskiq/spatial-sketch-editor/pull/151) | `24445e6f` | Competing review. Its Guide-free finding was verified and widened; its corrections were adopted. |
| [PR #152](https://github.com/Biskiq/spatial-sketch-editor/pull/152) | `85bfeee2` | Competing review. Its product findings were weighed (§3.2); its mechanisms were rejected (§4.5). |
| PR #153's brief and addendum | Brief at `12001607`; addendum unpublished | Replaced by this document |
| The owner's review of the three PRs | 2026-10-18 | Treated as hypotheses to test, not conclusions. It prompted the Guide-free check, the five-way E2 split and the five directions in §5. |
| [Research 6](./biskiq-integrated-product-synthesis.md) and the five studies in this folder | As merged in PR #150 | Evaluated synthesis; study anchors cited inline |
| Ratified authorities: [North Star](../docs/reference/north-star.md), [decision record](../docs/reference/decisions/northstar-ratification-2026-09-27.md), [F contract](../docs/reference/composition-execution.md), [shell contract](../docs/reference/design-system/editor-shell-and-visual-system.md#visitor-preview), [roadmap](../docs/roadmap/README.md), [Core Editor Stability](../docs/roadmap/core-editor-stability.md), [rulings](../docs/reference/decisions/next-batch-authorization-2026-10-17.md#core-editor-stability-rulings-2026-10-17) | At `26290839` | Boundaries, authorization and gate state |

### 7.2 Verification run for this document

All runs were on `26290839`, on 2026-10-18 (including an independent takeover review pass that
re-executed the test suites and verified the source claims below).

- **Isolation lane.** `test:arch`: 20 files, **163/163**, including the 25 documentation-reference tests.
- **Experience and units suites.** `experience-runtime.test.ts` (42/42) and `units-conformance.test.ts`
  (21/21): **63/63**. This independently reproduces PR #151's run.
- **The Guide-free probe.** One temporary test using the canonical fixture writer, with two cases. Its
  output is quoted in §2.2. It was run once and deleted, and changed no source; the takeover pass
  additionally verified `validateExecutionProgram` in [`validate.ts`](../packages/project-model/src/program/validate.ts)
  (lines 321–348) and `lowerExperienceProgram` in [`lowering.ts`](../packages/project-model/src/units/experience/lowering.ts)
  (line 231) directly in source.
- **E2 re-run.** **25/25** (§7.3), re-executed in both the initial synthesis and the independent
  takeover review pass.
- **Source reads.** Lowering, interpreter, companion, program codec and validator, Camera controllers,
  the live visitor director, F.1 adapters, F.4 history, F.3 families, Scene schema and planners, floor
  support, `layout-wall-chain.ts` and `layout-wall-first-types.ts`, the asset API, `save-state.ts`,
  `head-save.ts`, `EditorHead.svelte`, `project-persistence.ts`, and the Stage and visitor lighting/fog.
- **Registers and records.** Phase registers, the gate register, the S06 residuals, the T1.P01.S04
  acceptance record, the S04 preflight and the T3.P02 proposal.

### 7.3 E2 provenance and limits

- **Where it lives.** A throwaway test file, its findings and its output. They sit uncommitted under
  `tests/spikes/` in another session's worktree, on branch `claude/practical-grothendieck-119f1c` at
  base `26290839`. They are not part of this PR and are not to be merged.
- **How it was checked.** Another session wrote it. The synthesis pass re-ran it twice (25/25), and the
  independent takeover pass inspected its implementation (`hosting-e2.test.ts`) and re-ran it again
  (**25/25** in 114 ms).
- **Limits:**
  - Four synthetic fixtures, 19 single-step edits and 2 chains.
  - Real Layout planners and compiler, but no Scene schema, F.1 face component, UI or creator.
  - Classification thresholds (1e-6 m) were the spike's own choice.
  - Not exercised: plinth or object hosts, T-junctions, and overlap with Openings.
- **Treat it as a feasibility result,** not as a contract or a value result.

### 7.4 Research 6 evidence corrections (carried from PR #153, spot-checked against the studies' citations)

| Research 6 use | What the source is | Correct tier |
| --- | --- | --- |
| Visitor reading-affinity split (40.4 / 34.0 / 25.5 %), labelled "Tier 1, peer-reviewed" | A display-holder vendor page (interface study, ref 6) | Unsourced claim |
| "79.9 % conversion failure" (AUC Rhino to Revit) | A survey of n = 35, where 79.9 % is unattainable (28/35 = 80.0 %), about professional interoperability | Tier 1 for its own question; misapplied to Biskiq UX |
| "> 50 DOM labels at 60 fps", called a hardware benchmark | An agency blog (interface study, ref 31) | Implementation assumption |
| Room Illumination Look, Starter Kits, Asset Readiness pipeline, onboarding timings | Research 6's own additions | Hypotheses |

### 7.5 Limitations

- **No observed use.** No creator, audience or browser journey was observed. Every product-value claim
  is Judgment or Hypothesis.
- **Narrow probes.** The probes were in-memory and narrow. No performance, device or rendering
  measurement was made.
- **Partial re-verification of the other reviews.**
  - PR #151's test run was reproduced, and its central probe was re-run independently.
  - PR #152 was checked at each claim cited here, not line by line.
- **Studies read earlier.** The five studies were read in full for PR #153, partly by a delegated reader.
  Every anchor cited here resolves under the documentation-reference check.
- **External market claims are not used.** That includes PR #153's external facts on Gaussian splats,
  which matter only to the dormant venue question.
