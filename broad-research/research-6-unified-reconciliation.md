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
| What should change, and why? | Emphasis and sequence inside existing authority. Close the two places where code contradicts "no mandatory Room or tour". Give creators' flat content (images, text) a path in. Design tools as *intent in, ordinary state out*. Stop elaborating research machinery (§1, §3). |
| Which creator capabilities are most valuable next? | In order: Guide-free Presentation access in Preview; still images as content; authored Presentation text; surface placement; one shared visual default; then intent tools such as Frame this and Light this (§3.1). |
| Which overlooked opportunities warrant deeper investigation? | The presented piece as the unit of creative work (§5.1), and the scroll-first page (§5.2). Conditions, alternatives and new geometry wait for named planning events (§5.3). |
| What does the code support, and what is missing? | A large accepted-but-inactive foundation, three verified contradictions, and five separable hosting obligations from E2 (§2). |
| What should be prototyped, not designed abstractly? | The scroll-first page. Also observing real creators on the stability build before T4 planning renews (§6.3). |
| What stays deferred or refused? | §6.5. |
| What needs a new owner decision? | Two scope choices at planning events that must happen anyway: T3.P02 registration and K1 registration. Also confirming the pending Core Editor Stability criteria (§6.4). |

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
- **The ordinary tools that make output credible are the thinnest (Fact).** Lighting is hard-coded and
  differs between editor and visitor, and no assisted framing, surface placement, alignment or replace operation
  is planned before the milestone. The decision record warns that semantic structure "will not compensate
  for weak direct manipulation or unattractive output"
  ([decision record](../docs/reference/decisions/northstar-ratification-2026-09-27.md#a-focused-entry-without-a-narrow-ontology)).

**Preferred direction (Judgment).**

- **Every entry reaches a previewable result without requiring another entry.** A space, a folder of
  content and an Experience idea are each a complete starting point.
- **Every step is an ordinary operation owned by one domain.** The creator states the result; the
  domain produces inspectable state.
- **Tours, relationships and architecture deepen a result. They do not gate it.**

In one line: **make the presented piece (content, placement, View and words) the unit of creative work,
and make it work without Rooms or Guides.**

**What this overturns in PR #153's earlier brief and addendum.**

| Earlier conclusion | Now | Why |
| --- | --- | --- |
| Hosted staging is the most consequential new opportunity, built first. | **Demoted.** Surface placement ships first as a solve-once operation; live hosting waits for evidence (§4.3). | Hosting is a revision-time differentiator. Creators first need their content in and shown. A placement-time relationship can be added later through an explicit attach. |
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

**Why this direction still holds.**

1. **Stranding stays visible.** A read-only geometric check can report content that no longer touches a
   surface. That is a validity fact, not a claim of ownership.
2. **Upgrading stays explicit.** An explicit "attach to this wall" remains possible later. The ratified
   prohibition is on *implied* ownership ("proximity and grouping never imply ownership"), not on a
   creator's choice.
3. **Upgrading stays cheap.** Before a baseline, schemas may break without migration layers
   ([North Star](../docs/reference/north-star.md#development-stage-schema-compatibility-pre-baseline)).
4. **Live hosting is feasible when needed.** E2 shows this, once T1 meets the identity and correspondence obligations in §2.3.
5. **Integrity needs something to protect.** Revision integrity protects nothing until creators can get
   their content in and show it.

**What would change my mind:** creators observed in X2 who repeatedly revise walls under placed content
and then fail to notice or repair the result.

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
  - Core Editor Stability's proposed criteria already say "bind a Presentation plus an optional Stop"
    and require Preview "through the shared lowering".
  - The [T3.P02 proposal](../docs/roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md) repeats
    "optional Guide Stop".
  - So as planned, P02 would let creators author Presentations that its own Preview silently drops.
- **The fix is small.** The program codec already admits Presentations that no Stop uses
  ([validate.ts](../packages/project-model/src/program/validate.ts)). The fix belongs in lowering, in an
  interpreter activation path for a Presentation without a Stop, in the companion's destinations, and in
  an Experience entry policy for zero Guides. It must not manufacture invisible Stops.

**Composition requires a Room (Fact).**

- [`layout-floor-support.ts`](../packages/layout-core/src/layout-floor-support.ts) considers only
  derived `room-floor` polygons. Outside one, the result is `none`.
- `place-object` then refuses with `no-support`.
- T2.P01 chose this boundary deliberately: "Genuinely empty Layout … Place refuses and offers Start
  gallery … Neither a datum nor T1's plinth is support"
  ([T2.P01](../docs/roadmap/t2-composition/t2.p01-supported-composition/README.md#outcome-and-boundary)).
- **Inside the milestone it is coherent**, because K3 supplies Rooms.
- **Beyond the milestone it contradicts the ratified destination.** That destination says a creator
  importing one model "should reach composition and direction immediately"
  ([decision record](../docs/reference/decisions/northstar-ratification-2026-09-27.md#a-focused-entry-without-a-narrow-ontology)).
- It also blocks two cases: objects on plinths, and object-only creators (product, education).

**The editor and the visitor render different, unauthored light (Fact).**

- The Stage uses ambient 0.35 plus directional lights of 1.1 and 0.35
  ([StageCanvas.svelte](../apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte)).
- The visitor surface that `/p/` uses has ambient 0.2 plus one directional light of 0.7
  ([VisitorPreviewSurface.svelte](../apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte)).
- Authored Scene lights add to both.
- **Consequence.** What a creator judges in the editor is not what the visitor sees. No inspectable
  default exists for a creator to adjust.

**Drift reported by PR #153 still stands (Fact). Report it through the router's triage; do not fix it
here.**

- **The sign-in draft resume path is dead.**
  - The T1.P01.S04 acceptance record says "pending sign-in drafts resume".
  - `writePendingCloudSave` in [project-persistence.ts](../apps/editor/src/lib/platform/project-persistence.ts)
    has no caller, so `/` reads a draft that nothing writes.
  - This matters to the milestone: "resume of the sign-in Save draft" is a *required* Core Editor
    Stability criterion.
- **The README is stale.** The repository README still calls the spatial route "no write path".

### 2.3 E2: what the hosting spike did and did not establish

E2 was a throwaway, test-only spike against the real `@portfolio/layout-core` planners and compiler.
Its provenance and limits are in §7.3. **Result:** 25/25 tests, and none of the three falsifiers fired.
It covered 19 single-step edits and 2 composed chains, on reversed, curved, shared and two-Room
fixtures.

As the owner's review asked, the five obligations are kept separate, because existing F.4 entries do not
discharge them automatically.

| Obligation | What E2 showed | What exists in code | Status |
| --- | --- | --- | --- |
| **1. Identity integrity** | Canonical wall IDs **can be re-minted**. The default chain allocator avoids collisions only against the *current* document, so after `wS-b` is deleted, a later split mints `wS-b` again for an unrelated span. Both ID-only readings then silently re-hosted content. | No rule forbids reuse. The P23.12 ledger protects presentation references only. | **A T1 finding independent of hosting.** It affects any future persisted cross-domain reference to a Layout subject. |
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
| 1 | Show Presentations without authoring a tour | Everyone who wants free exploration; every unbound Presentation | Codec admits it; Conservatory's "Empty / ordinary Experience" assumes no active Guide | Lowering, interpreter activation, companion destinations, entry policy | Small | **Build in T3.P02** (owner decision 1) |
| 2 | Bring still images in as content | Photographer, educator, product, editorial | Upload API, image sniffing, storage and release pinning; textured plane schema | Editor upload, an image resource with physical size and aspect, a placeable definition | Small to medium | **Decide at K1 registration** (owner decision 2) |
| 3 | Write words that visitors read | Everyone | Program text records; P02 plans "edit labels/text" | An authored home at the cutover | Small | Already planned (T3.P02); keep |
| 4 | Put content on a surface (wall, plinth or object top), and compose without a Room | Photographer, exhibition, product, object-only | Floor support; a read-only compiled face geometry | Surface-placement operation; Room-free support decision | Medium | **First post-stability T2 candidate** (§4.3) |
| 5 | Credible lighting with no setup, the same in editor and visitor | Everyone | Scene lights | One inspectable world-presentation default (Scene-owned) used by both | Small | Post-stability T2 candidate. Until then, Preview must render as the visitor does. |
| 6 | Make one presented piece in one gesture | Everyone | Compound acceptance lands with the cutover; "Present this" | Items 1–4 plus Frame this (§5.1) | Medium | **Post-stability T2/T3 target** |
| 7 | Walk or click-to-move freely | Explorers, venues | Camera authority; free-controller ownership | A movement profile controller | Medium | Post-stability T3; not needed for item 1 |
| 8 | Content follows a revised wall | Exhibition, architect | E2 | §2.3 obligations 1–5 | Large | **Evidence-gated** (X2) |
| 9 | Scroll-first page | Product, portfolio, editorial | Scroll driver ratified; Guides | Seek, rich content, a delivery profile | Medium to large | **Prototype first** (X1) |

### 3.2 PR #152's product findings, judged on product merit

| Finding | Product merit | Problem with the proposed mechanism | Disposition |
| --- | --- | --- | --- |
| Bring images, text, media and models into an editable spatial experience | **High, and the strongest point in #152.** Every creator type has images and text. | It frames the need as wall-hung art for "museum curators … overwhelmingly". That is gallery-centric. | Images and text as general content (outcomes 2–4). Not wall art first. |
| Content-first, space-first and Experience-first entry without mandatory Rooms or Guides | High; already ratified | It treats entry as UI sequencing, and misses the two code contradictions (§2.2) | Fix the contradictions; a content tray is just the resource collection. No persona chooser. |
| Basic 2D artwork and accessible primitives | High | — | A framed image panel and text as Experience content in the semantic DOM. No world-baked text yet. |
| Honest import readiness, scale, pivot, footprint, provenance and replacement | High; K1 already requires scale, pivot and footprint | `Ready / Needs Repair / Blocked` adopted as a schema | K1 planning names its states. Replacement waits for the first replace workflow. |
| Useful visual defaults | High: the "unattractive output" warning | "Balanced Gallery Wash" is gallery-specific, and nothing says who owns it | A neutral Scene world-presentation default, used identically in editor Preview and visitor (outcome 5) |
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
- **Default mode is solved-once ordinary state, with provenance where useful.** A kind is *live* only
  where declared, matching "assisted direction resolves into the same inspectable project state".
- **World-local free composition stays valid on its own,** as the default rather than a fallback.
- **Kinds are independent.** Lights, Views and conditions target subjects whether or not anything is
  hosted.
- **Ordering is not a failure.** A chain (wall, image, light, View) needs deterministic evaluation order,
  which the ratified dependency rules already require.

### 4.3 Surface placement and hosting

| Option | What a wall edit does | Cost | When |
| --- | --- | --- | --- |
| **A · Solve-once surface placement.** A runtime-safe, read-only Layout face query proposes the transform, and Scene commits a world-local result. | Content stays put. A read-only check can flag content that no longer touches a surface. | Medium: one Scene operation and one Layout query. No cross-domain contract. Fits T2.P01's "support is transient evidence". | **First** (outcome 4) |
| **B · Live hosting, evaluated.** Scene stores host and parameters; Layout publishes correspondence. | Content follows. Classification is a read-only query, and Layout acceptance stays single-domain. | Large: all five §2.3 obligations, plus a Scene host schema and an evaluator | When X2 shows creators revising walls under content |
| **C · Compound rebase.** Every Layout edit rewrites the dependent Scene data in one acceptance. | Content follows. | Every Layout edit becomes cross-domain. | Not preferred; E2 shows B suffices |

**Not preferred: PR #152's `SceneSurfaceAnchor` plus an authoritative cached world transform.** It
stores two authorities for one pose. A visitor that must not evaluate host frames can instead read a
compiled delivery derivative, which hard rule 3 permits.

**Independent of the choice: T1 should decide never to reuse canonical Layout IDs within a project**,
for example through a ledger or tombstones. That decision should come before any persisted
cross-domain reference to a Layout subject ships. It is cheap, it closes E2's identity hazard, and it
does not commit T1 to publishing parametric correspondence.

**E2b (a light and a View chained through a hosted image) is withdrawn.** It was meant to decide whether
T1's obligation is relationship-generic. It is not needed for that:

- What Layout must publish is the same whichever consumer reads it.
- A light aim and a View framing depend on Scene and Camera subject identity, not on wall faces.
- Deterministic chain order is already ratified.

### 4.4 Real missing mechanisms

| Mechanism | Owner | First consumer | When |
| --- | --- | --- | --- |
| Guide-free activation: lowering, interpreter, companion and an entry policy for zero Guides | T3 (Experience), ratified alongside the consumer | T3.P02 Preview | P02 registration |
| An authored home for Presentation text and invocation bindings | T3 | T3.P02 | Cutover (already a pre-S04 decision) |
| A still-image resource with physical size, aspect and provenance | T2 and resources | K1, or the next T2 phase | K1 registration |
| A read-only face query and a surface-placement operation; deciding what supports an object without a Room | T1 (query), T2 (operation) | T2 surface placement | After stability |
| An inspectable world-presentation default | T2 (Scene) | Stage and visitor | When T2 plans lighting |
| Canonical Layout ID non-reuse | T1 | Any persisted Layout reference | Before that reference ships |
| A movement profile controller (walk, click-to-move) | T3 (Camera authority) | Free exploration | After stability |
| Impact-report classifiers over the reverse dependency index | Each domain | The first relationship that persists | With that relationship |
| Seek and progress mapping for scroll-driven Guides | T3, and T4 profiles | Scroll delivery | After X1 |

### 4.5 Rejected and corrected proposals

| Proposal | From | Problem | What survives |
| --- | --- | --- | --- |
| A new `CompositionalAdvisory` / `Needs Review` tier via **AM-9** | #152 | The four-state report is already ratified. **AM-9 is taken:** the merged S04 preflight proposes it as "Shared Camera and Experience cutover" ([gate draft](../docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/preflight/gate-draft.md)). | Implement the ratified states with the first persisted relationship. |
| `Needs Review` as a general rule ("acknowledge and publish") | #152 | Whether release is blocked depends on the selected program and profile, and a warning cannot waive an executable failure (#151) | Keep it per profile at T4 |
| `SceneSurfaceAnchor` with a cached authoritative transform; Room-floor and wall-face `FrameResolver`s | #152 | Two pose authorities. AM-1: "a Room without an authored frame cannot qualify". E2: Room hosts carry membership only. | Option A, then B (§4.3) |
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

### 5.1 The presented piece: the unit of creative work

**The opportunity (Judgment; none of the reviews identified it).** Creators think in *pieces shown with
meaning*: a work, where it sits, how it is seen and what it says. Biskiq rightly splits these across
Scene, Camera and Experience. The largest UX risk of that architecture is that one exhibit then needs
three places. The ratified bridge already exists:

- **Compound acceptance.** The decision record's own example is "insert kit, attach to Wall, capture a
  View, bind it to a Presentation, optionally create a Stop". Its first implementation lands with the
  cutover.
- **Conservatory's "Present this".** Creation starts from a subject.

**The flow.**

1. The creator drops an image, a model or a text card, or selects a subject.
2. Biskiq proposes four things:
   - a placement on the surface under the cursor, or beside the subject;
   - a framed View (Frame this);
   - a Presentation with title and caption fields;
   - optionally, a Stop in the open Guide.
3. All of it is one acceptance with one Undo.
4. Each part is then ordinary state, editable in its own domain.
5. Once Guide-free access exists, the piece is reachable in Preview immediately. A Guide is simply an
   order over pieces.

**The same flow serves every creator type.**

| Creator | A presented piece is |
| --- | --- |
| Photographer | An image on a wall, with its caption |
| Product explainer | A part of a model, with its spec text and View |
| Educator | Equipment, with a step label |
| Architect | A room, with a design note and its View |
| Storyteller | A clue, with narration |

**What it needs.** Nothing beyond §4.4's items and the cutover. **Smallest test:** in the first slice
that ships it, observe whether creators keep the proposed placement and View or redo them. **Owner
decision:** none now; it is a post-stability target for T2 and T3.

### 5.2 A · Spatial web and scroll-first Experiences

This is the most consequential unresolved UX question. **A scroll-driven Camera controller is not an
authored scroll-first Experience.** The ratified texts admit both:

- **The decision record.** "A scroll driver maps progress to supported direction", and drivers "share
  evaluation, not necessarily identical session state"
  ([hosting and embeds](../docs/reference/decisions/northstar-ratification-2026-09-27.md#hosting-embeds-live-sessions-film-and-sdks)).
- **The North Star's web experience layer.** It lets Experience author "text, images, panels, buttons,
  links, audio/video, forms, responsive overlays, and page/view navigation". It also rules out "a
  Webflow-like website builder"
  ([web layer](../docs/reference/north-star.md#web-experience-layer)).

The three forms compare as follows.

| Form | Mechanism | Fit with Conservatory | Missing |
| --- | --- | --- | --- |
| **1 · A Guide driven by scroll** | Stops become sections. Scroll progress maps to Stop index and Travel fraction, evaluated by Camera. | **Natural.** It is the same Guide instrument with a scroll Preview profile. | Seek and scrub (the interpreter is forward-only), and a section layout for Presentation content |
| **2 · Guide-free progression** | Free exploration plus a Presentation index. This is the "escape hatch" the interface study finds even expressive portfolios keep ([navigation](./spatial-interface-authoring-ux.md#1-1-visitor-navigation-and-wayfinding-p3)). | **Natural.** Conservatory's "Empty / ordinary Experience" already assumes no active Guide. | §2.2's fix; a movement controller for free roam |
| **3 · A rich page** | DOM sections with typographic content, media and HTML interactions bound to Presentations, with a pinned or embedded canvas | **Open.** It may need one *invoked* Experience instrument for reading layout. It is not a lens. | Rich content records; layout hints; embed delivery |

**Two findings shape the answer.**

- **Scroll is linear.** A scroll spine cannot cross a Gate or branch without an explicit choice point.
  So scroll-first Experiences are linear Guides with inline, non-branching interactions. Branching
  stories belong to forms 2 or 3.
- **There is a real opening (Fact, from the interface study).** Spline "lacks a native, accessible 2D
  typographic layout and multi-stop curatorial storytelling engine"
  ([web design](./spatial-interface-authoring-ux.md#2-1-web-design-and-stateful-p2)). Biskiq's
  Presentations, Guides and required semantic DOM navigation fit that gap.

**Disposition.**

- **Keep:** one Camera authority, one Experience domain and the existing lenses. No Website lens and no
  second Camera timeline.
- **Do not declare the question solved** because scroll can drive Camera.
- **Run X1** (§6.3). It decides whether form 3 needs an invoked page instrument and a richer content
  model, or whether automatic section layout of form 1 is enough.

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
  Place on this surface (Scene, with the Layout query); Light this (Scene: aim at the subject at a chosen
  incidence); Align and distribute (Scene); Centre an Opening (Layout).
- **When to apply directly, and when to suggest.** Use a **smart default** when the solution is unique,
  cheap to undo and low in taste content. Offer an **explicit suggestion with alternatives** when taste
  or ambiguity is involved. **Disclose uncertainty** where the solve is approximate, for example
  view-dependent highlights ([direction 3](./creative-scene-composition-ux.md#direction-3-p3)) or
  occluded framing.
- **Provenance** is kept only where the ratified revision policy recomputes (assisted framing). **No
  universal solver.** The study's top-priority prototype, effect-first lighting, becomes a UX check when
  T2 plans lights ([experiment 1](./creative-scene-composition-ux.md#priority-experiment-1)).
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
| **T1** | P01: S01–S04 and S07 shipped; S05 and S06 proposed. K3 bounded straight-Wall creation is ruled for after the F2 cutover, and unplanned. | No change to P01 or K3. Inputs for later planning: canonical ID non-reuse (§4.3); a runtime-safe, read-only face query with face extents in canonical arc parameter and an exact evaluator that errors rather than clamps; correspondence publication only if live hosting is registered. Levels and overhead geometry stay future decisions. | Planning input |
| **T2** | P01: S01–S02 shipped; S03 authorized, in review as PR #147; S04 proposed. K1 bounded GLB import is ruled for after T3.P01.S04, and unplanned. | No change to P01, whose floor support stays transient. K1 registration: owner decision 2. Post-stability candidates: surface placement with the Room-free support decision; the shared world-presentation default; Light this; the presented piece with T3. | Owner decision 2; candidates |
| **T3** | P01: S01–S03, S05 and S06 shipped; S04 proposed, with its preflight merged (inventory "not executed"). Cutover gate undrafted. P02 is a candidate and unregistered. | The S04 path is unchanged. Input to the cutover gate draft: the Guide-free drop is not among S06's residuals. P02 registration: owner decision 1, plus Frame this as an optional verb. The authored text home stays as planned. A movement controller comes after stability. | Owner decision 1; input |
| **T4** | Planning; no registered phase. F5 and the prepared reader are undrafted. R1-D defers all T4 work. | No change. When planning renews: Guide-free execution, the scroll and embed profile informed by X1, and image resource closure. | Trigger |
| **Core Editor Stability** | Direction and K1–K4 approved; criteria still "proposed pending explicit owner confirmation". | Confirm with no Research 6 criteria added. Decisions 1 and 2 are scope of contributing phases, not new criteria. The acceptance plan should include a Guide-free journey if P02 includes one, and may adopt #151's continuity specimen. The sign-in draft resume criterion needs its dead path triaged (§2.2). | Owner decision 3 |

### 6.2 Sequence

1. **Now, unchanged:**
   - finish the authorized T2.P01.S03 (PR #147);
   - continue T3.P01.S04's existing route to authorization: the actual inventory, migration and refusal
     coverage, recovery and publication disposition that its owner decisions require;
   - triage the two drift items.
2. **At planning events that must happen anyway:**
   - T3.P02 registration (decision 1);
   - K1 registration (decision 2);
   - K3 and K4 as ruled;
   - confirming the criteria (decision 3).
3. **After stability acceptance:**
   - run X2;
   - renew T4 planning under R1-D, because sharing is the ratified activation event;
   - in parallel, T2 surface placement and the presented piece;
   - in parallel, T3's movement controller.

### 6.3 Experiments

| ID | Question | Minimum | Falsifier | Decision it settles | When |
| --- | --- | --- | --- | --- | --- |
| **X1 · Scroll-first page** (disposable, no product code) | Is a scroll page a Guide with auto-laid sections, or does it need an invoked page instrument and richer content? | Render a 5-Stop Guide fixture as a scroll page. Use the real interpreter and camera-core sampling, a pinned canvas and Presentation text and images as sections. Then have 3–5 creators (or an owner review) rebuild two reference pages. | Auto-layout is rejected in at least half the tasks, or typical content needs branching mid-spine. | The Experience content model; whether Conservatory gains an invoked reading-layout instrument; the T4 scroll and embed profile | Any time; before T4 planning renews |
| **X2 · Creators on the stability build** | What do creators do with their own content and a real audience? Do they revise walls under content? | 3–5 creators in at least 3 non-gallery categories, using their own material. Each shows the result to an audience in Preview, because publication may be unavailable between the cutover and T4 (K2). | — (observational) | The post-stability order (T4 against T2 and T3 depth); whether to register live hosting (§4.3) | Between stability acceptance and T4 planning |

**Dormant, each with a trigger.**

- **Captured venues (E4):** creators who mostly present existing places.
- **Conditions (B):** before T3 Gates.
- **Session A/B (C):** before T2 lighting.
- **Light this (D):** with T2 lighting.
- **The multi-level study's P2 (E):** before T1 levels.

**Do not build to answer these:** a production share route, a release format, an ingest pipeline, a
relationship engine or agent infrastructure.

### 6.4 Owner decisions

| # | Decision | Recommendation | If nothing is decided |
| --- | --- | --- | --- |
| 1 | **At T3.P02 registration:** include Guide-free Presentation reach? | **Include the minimum.** No Presentation is silently dropped. Presentations outside the active Guide are reachable through semantic navigation, with a Cut to their View. Zero Guides gets an Experience entry policy. The interpreter and companion change is ratified alongside P02. No free movement, and no invisible Stops. | P02 ships authoring that creates Presentations its own Preview drops, inside a capability the milestone already proposes. |
| 2 | **At K1 registration:** does the bounded import admit still images alongside GLB? | **Admit them,** if T2 planning confirms that images reuse the existing upload, sniffing and storage path and the same staging, readiness and provenance flow. Placement stays within existing support (for example a framed panel), until surface placement follows. Otherwise make images the first post-stability T2 phase. | The milestone's creators (and X2) have no way to use the most common content they own. |
| 3 | **Confirm the Core Editor Stability criteria** (pending since 2026-10-17) | Confirm them with no Research 6 additions. Treat 1 and 2 as contributing-phase scope. | No settled acceptance definition exists for lifting the T4 deferral. |

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
- kits (after the presented piece).

**Refuse:**

- **Second authorities:** a generic relationship engine, constraint solver or node graph; a second Camera
  timeline, or recorded camera trajectories replayed outside Camera evaluation; two authorities for one
  pose; implicit runtime visit memory; a standalone Cue stack.
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

All runs were on `26290839`, on 2026-10-18.

- **Isolation lane.** `test:arch`: 20 files, **163/163**, including the 25 documentation-reference tests.
- **Experience and units suites.** `experience-runtime.test.ts` and `units-conformance.test.ts`:
  **63/63**. This reproduces PR #151's run.
- **The Guide-free probe.** One temporary test using the canonical fixture writer, with two cases. Its
  output is quoted in §2.2. It was run once and deleted, and changed no source.
- **E2 re-run.** **25/25** (§7.3).
- **Source reads.** Lowering, interpreter, companion, program codec, Camera controllers, the live visitor
  director, F.1 adapters, F.4 history, F.3 families, Scene schema and planners, floor support, the asset
  API, and the Stage and visitor lighting.
- **Registers and records.** Phase registers, the gate register, the S06 residuals, the S04 preflight and
  the T3.P02 proposal.

### 7.3 E2 provenance and limits

- **Where it lives.** A throwaway test file, its findings and its output. They sit uncommitted under
  `tests/spikes/` in another session's worktree, on branch `claude/practical-grothendieck-119f1c` at
  base `26290839`. They are not part of this PR and are not to be merged.
- **How it was checked.** Another session wrote it. I re-ran it twice, getting 25/25 both times, and
  read its findings.
- **Limits:**
  - Four synthetic fixtures, 19 single-step edits and 2 chains.
  - Real Layout planners and compiler, but no Scene schema, F.1 face component, UI or creator.
  - Classification thresholds (1e-6 m) were the spike's own choice.
  - Not exercised: plinth or object hosts, T-junctions, and overlap with Openings.
  - It has not been independently reviewed.
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
