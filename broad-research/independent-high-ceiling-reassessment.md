---
kind: independent decision brief
status: "Research input and evidence artifact. It is not a product contract, ratification, routed authority or implementation authorization. docs/README.md and docs/reference/ govern product truth."
evidence_base: "main @ 26290839 (2026-10-18): Research 6 and the five domain studies in this folder, the routed docs authorities, source and tests, and a few targeted external checks"
independence: "Written without reading other Research 6 reconciliation PRs, their branches or their reviews"
---

# Hosted staging: an independent reassessment of Biskiq after Research 6

> **What this is.** This is a third, independent assessment of product direction, architecture and
> execution priority. It uses [Research 6](./biskiq-integrated-product-synthesis.md), the five domain
> studies and the repository at `26290839`. Proposals here are **proposed, not authorized**. Nothing in
> this brief amends a ratified contract, a roadmap register or an authorized plan.

## Decision summary

**Verdict.**

- **The ratified North Star stays.** It remains the strongest destination and needs no architectural
  amendment.
- **Research 6's Conservatory has the wrong center of gravity.** It is a sound shell expression of that
  destination. But it starts creators at architecture, it spends its "high ceiling" on expressive
  geometry, and its revision promise assumes relationships that nobody has scheduled.
- **The proposed reframing.** Biskiq should be **the place where people stage what they already have,
  and keep it right while they revise it.** "What they have" means images, objects, words, and a space
  that is built, imported or captured.
- **The most consequential new opportunity is hosted staging.** This makes "placed *on* something" the
  default composition relationship. That something can be a wall face, a floor, a plinth, an object or
  a captured surface. It is the cheapest route to novice success with a creator's own content, and it
  is the precondition for the revision triage that both Research 6 and the North Star promise. Biskiq
  has already built the hard part once, for wall Openings.
- **The most urgent change is about evidence, not features.** No creator or audience has yet used a
  Biskiq authoring surface, and the current plan schedules that evidence last.

| If designed today, we would… | What |
| --- | --- |
| **Preserve** | Distinct Layout / Scene / Camera / Experience / resource authorities. One Camera authority. The one canonical architectural compiler. F.1 identity with explicit resolution results. F.4 expected-revision acceptance. Many Experiences over one world. Compiled, visitor-isolated releases. "No Room, tour or modeling workflow is mandatory." Honest `Needs Review` / `Unresolved` repair. |
| **Change** | **The novice entry:** from "draw your walls" to "pick or bring a venue, drop your content". **The composition default:** from world-local coordinates to hosted placement. **The evidence order:** creator and audience trials with disposable prototypes now, not after the publication track. **Execution:** surface tested kernels as creator verbs before minting new contracts. **Research 6's evidence tiering:** correct it before the study is used as design input. |
| **Pursue** | **Hosted staging (B1).** **Venue pluralism (B2):** captured, imported or generated environments, with Layout as the semantic layer where needed, validated first by a spike. |
| **Refuse** | **Expressive overhead geometry before any creator asks for it:** dual-skin shells, hypar or rib lofts, straight-skeleton roof chemistry, void prisms. **Authoring physics bake and puppeteering. Inline sync ribbons.** **A generic constraint solver. A third "Interface" lens.** **Re-hosting existing content by proximity.** **A shadow publication path that quietly becomes durable.** **Building Research 6's Category A seam list as up-front infrastructure.** |

## Evidence basis and confidence

**What was read:**

- Research 6 in full.
- All five domain studies. Their bodies were mined in full (partly by a delegated reader), and the
  load-bearing citations were re-checked directly.
- The ratified [decision record](../docs/reference/decisions/northstar-ratification-2026-09-27.md) and
  its [World | Experience amendment](../docs/reference/decisions/world-experience-reconciliation-2026-09-29.md).
- [North Star](../docs/reference/north-star.md).
- The [F contract](../docs/reference/composition-execution.md), including AM-1 to AM-8.
- The [shell contract](../docs/reference/design-system/editor-shell-and-visual-system.md).
- The [roadmap](../docs/roadmap/README.md), its gate register, and the T1–T4 track READMEs and batons.
- [Core Editor Stability](../docs/roadmap/core-editor-stability.md).

**Code verification.** Source and tests were traced end-to-end for every claim marked **Fact** below.

**What this is not.** It is not a creator study, a runtime benchmark or a prototype result. Labels:

- **Fact:** verified at `26290839`, or a cited external fact.
- **Inference:** follows directly from facts.
- **Judgment:** my weighing of the evidence.
- **Hypothesis:** needs the experiments in §F.

### Where the product actually stands (Fact)

| A creator can… | State on `main` | Evidence |
| --- | --- | --- |
| Start from a starter enclosure (7 × 6 m) or an empty project. Save conditionally, reload, undo/redo, download or open source JSON. | Reachable | `apps/editor/src/lib/authoring/stage/starter-gallery.ts`, `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` |
| Edit wall height and thickness, opening dimensions and names. Place a Layout plinth by typed X/Z. | Reachable. These are exactly the five production planners. | `createLayoutPlanners` in `apps/editor/src/lib/authoring/adapters/layout/precision.ts` |
| Draw walls, rooms or openings. Change a wall's length, angle or position. | Kernel planners are tested but not wired: about 38 of about 45 layout-core planners have no product caller. | `packages/layout-core/src/`. Length, angle and move wait for the unauthorized T1.P01.S05. |
| Place, move or delete objects, lights or materials. | Seven Scene planners exist but are test-only. Scene renders read-only. | `packages/project-model/src/scene-planning/`. T2.P01.S03 is authorized but not started. |
| Import their own model or images. | **GLB: absent.** **Images:** the asset API accepts PNG, WebP and JPEG only, and nothing in the editor calls it. | `apps/api/src/asset-persistence.ts` |
| Capture a View, create a Presentation or Stop, preview as a visitor. | Absent from the UI. The Experience@1 codec, interpreter and Camera handoff are imported only by tests, and the Preview button is disabled. | `packages/project-model/src/units/` |
| Publish. | API only. The visitor receives the *authored snapshot*, re-validated and compiled by the current code. | `apps/api/src/publication-persistence.ts`, `apps/editor/src/routes/p/[publicationId]/+page.svelte` |
| Let visitors walk freely. | Absent. Visitors either orbit or step along Scene navigation nodes. | No free-navigation controller exists in source. |

**Scale** (line counts at `26290839`, approximate):

- **Product packages:** about 49.6k lines (layout-core 25.2k, project-model 19.9k, camera-core 4.4k).
- **Editor:** library 20.7k, routes 2.8k.
- **Editor tests:** about 70k lines across 162 files.
- **Live docs:** 17.7k lines, of which roadmap is 11.0k; the archive adds 15.8k more.
- **Accepted but inactive foundation code:** about 15k lines (units, references, channels, program,
  migration, Scene planning) that only tests consume.

These figures are not a criticism of the foundations; the kernels are well tested. **Inference:** almost
every creator-facing claim in Research 6 and in the North Star is untested by any creator. The
cheapest near-term capability gains come from wiring kernels that already exist, not from new
contracts.

**Evidence drift runs both ways (Fact).**

- **Docs understate the source.** The repository `README.md` still calls the spatial route "read-only …
  no write path", although T1.P01.S04 added Layout edits and Save.
- **Acceptance records overstate it.** The S04 acceptance record states that "pending sign-in drafts
  resume". Yet `writePendingCloudSave` has no caller in `apps/editor/src`, and the `?resume-save=1`
  flag that `/` emits is read nowhere.
- **Why it matters.** The documentation gates check documents against documents. No gate checks that a
  claimed capability is reachable in the browser. Core Editor Stability's browser journeys are the
  right corrective, and they should run before more capability is claimed.

## A. Strategic verdict

**Does the North Star remain the strongest direction?** Yes, as a destination. Four parts of it are
correct:

- **One world, many Experiences.** Its separation of World truth from audience-specific Experience
  matches how the work is really divided.
- **Distinct authorities.** These protect exactly what makes Biskiq more than a template tour:
  precise, editable architecture, objects with identity, and Camera views that mean something.
- **Compiled, isolated releases.** These let authoring evolve without breaking published work.
- **Shared intents for humans and agents.** Making agents operate through the same typed intents
  avoids a separate "AI mode".

None of the competing directions in §C beats this architecture. The strongest challenger, capture-first
authoring, can be absorbed into it as a kind of venue.

**What has gone wrong in practice is not in the North Star's text but in its center of gravity.** The
North Star is permissive: a project "may start from native architecture, imported content, reusable
components, or an experience idea". The executed plan and Research 6 are architecture-first:

- **Core Editor Stability** *requires* drawing straight walls from empty and a bounded GLB import. It
  *excludes* attachments, and it offers no image import, although images are the content every creator
  already has.
- **Research 6's four creator journeys** are a gallery, a gallery, a gallery revision and a kinetic
  hyperbolic-paraboloid pavilion. The one study with non-museum creators (the visitor-interface study:
  lab training, a B2B configurator, a portfolio) has none of its journeys carried into Research 6.
- **Research 6's Day-1 journey is close to what this brief proposes, but it is not what the plan
  executes.** That creator drops their files and picks a rectangular layout. The plan instead requires
  wall drawing and GLB import, and has no path for images.
- **The largest body of product code** is the Layout kernel (25k lines). The plan's first creator
  journey, "starter gallery → place → save", follows the strongest code, not the weakest creator need.

**Judgment:** this is a natural drift for a project born as a virtual museum. Left alone, it will
produce an excellent architectural sketcher that few people can fill with their own work.

**Is a substantial reframing justified?** A **moderate reframing of emphasis and entry, not of
architecture**: from *scenographic medium where you build spaces and then stage exhibitions* to
**revision-safe staging: bring a venue, stage what you have, direct how people move through it, revise
without breaking it.**

- **Native architecture becomes one way to obtain a venue.** It is the most precise and most revisable
  way, which is why it stays first-class.
- **A captured room, an imported building model, or a starter venue are others.**
- **No authority, F interface or hard rule changes.** The North Star's existing text already admits
  all of this. What changes is which capabilities come first and what the first milestone proves.

**What would materially improve the North Star direction:**

1. Make hosted placement the default composition grammar and schedule it early (B1).
2. Treat the venue as pluggable, and protect that seam now even before building captured venues (B2).
3. Move creator and audience evidence to the front, using disposable prototypes (B3).
4. Correct Research 6's evidence classification and its conflicts with ratified contracts (§D2 and the
   appendix) before using it to design features.

## B. Strongest unexplored opportunities

### B1 · Hosted staging: relationships before coordinates

**What creators gain.** Every placement is "on" something meaningful by default:

- an image or video on a wall face;
- a caption beside a work;
- an object on a plinth;
- a lamp aimed at a subject;
- a label on an object's part.

The creator never sees XYZ unless they ask. When the wall is lengthened, moved or split, the content
follows it. When it cannot follow, Biskiq says so instead of leaving things floating in air. The same
relationship gives experts precise values: "North wall, inner face, 1.20 m from the left, centre at
1.50 m".

**Why it matters more than its current priority suggests:**

1. **The revision promise cannot be computed without it (Inference from Fact).**
   - `Preserved` / `Needs Review` / `Unresolved` triage needs *declared* relationships to evaluate.
   - What exists today:
     - Scene placement is world-local, and `roomId` is rejected by the codec.
     - T2.P01 plans floor-support placement whose height is resolved from support rather than
       authored, and stored as a world-local position.
     - Core Editor Stability lists attachments as *not required*.
     - The F contract has no section on impact reporting or hosting (search of
       `docs/reference/composition-execution.md`). The decision record (§6) ratifies the report in
       principle only.
   - **Consequence under the current plan:** the most common revision a creator makes ("make this wall
     longer", "move this partition") strands wall-mounted content without telling anyone.
   - **And it cannot be repaired automatically later.** Re-hosting by proximity is a permanent non-goal,
     so content placed world-local during trials is never re-hosted automatically.
2. **Biskiq has already solved the hard case once (Fact).** Openings are hosted records:
   - They store `wallId`, a meter `offset` from the canonical wall start, and `sillHeight`
     (`LayoutWallOpening` in `packages/layout-core/src/layout-wall-first-types.ts`).
   - They are rebased "by exact arc-offset arithmetic" when walls split or dissolve
     (`packages/layout-core/src/layout-wall-dissolve.ts`).
   - They go away atomically with their host wall (`packages/layout-core/src/layout-wall-topology-ops.ts`).
   - They are validated as a set.
   - **The opportunity is to export that solved problem across the domain boundary**, as a Layout-owned,
     runtime-safe host frame and the correspondence it already computes. It does not need inventing.
3. **It removes complexity instead of adding it (Inference).**
   - The world transform of hosted content is *evaluated*, not authored. Most World edits therefore stay
     single-domain Layout acceptances followed by re-evaluation, with no compound cross-domain write.
   - The impact report becomes a pure query: compare the evaluated host states of two accepted revisions
     and classify each relationship. No new authority, log or solver is needed.
4. **It is the composition grammar for most creators' content (Judgment).**
   - **Images on surfaces.** Still images are the one content type every creator category in the
     studies already owns: photos, scans, posters, diagrams, slides, product shots, screenshots.
   - **Objects on supports.** Plinths, tables and object surfaces are the other half.
   - **What already exists for images.** The server path is mostly built: a PNG/WebP/JPEG upload API,
     R2 storage, and release pinning of `/project-assets/*`.
   - **What is missing.** Today an image can only be a plane primitive with a texture material, in
     world coordinates, with no editor upload.

**Relative value: this is not "wall art first".** The brief deliberately did not assume wall-mounted
artwork deserves priority. The case rests on generality, not on museums:

- **One relationship family covers every creator category in the studies:**
  - a showroom: a product on a plinth, a spec card attached to a part;
  - training: a step label on equipment;
  - a portfolio: a project image on a wall;
  - a design review: a comment anchored to a wall.
- **Lighting:** a target-linked light is a hosted relationship to a subject.
- **Camera:** framing a subject is a reference to a subject.
- **Experience:** a caption anchored to a work is a reference to a subject.

If hosting is delayed, every one of these defaults to coordinates, and revision integrity becomes a
promise without a mechanism.

**Minimum credible capability (Hypothesis).**

- **Hosts:**
  - a Layout wall face, with arc-length position and height, exactly the Opening pattern;
  - a derived Room floor;
  - a Layout plinth or object top.
- **Hosted content:** a still image (optionally framed), a text panel, and a catalogue or imported model.
- **Ordering:** rails, object-part hosts and captured surfaces come later, through the same
  relationship.

### B2 · Venue pluralism: captured, imported and generated spaces

**What creators gain.** They can start from the space they actually have:

- a phone scan of a gallery, studio, shop, classroom or heritage site;
- a building model from an architect's own tools;
- a generated environment for a speculative or narrative work.

They then stage content, Presentations and Guides over it. Native Layout remains the precise and
revisable option, and it can also be traced over a capture to give that capture walls, floors and
hosts.

**Why now (Fact, external).**

- **Khronos standardization.** Khronos announced a release candidate of the glTF Gaussian-splatting
  extension (`KHR_gaussian_splatting`) on 3 February 2026
  ([press release](https://www.khronos.org/news/press/gltf-gaussian-splatting-press-release)), with
  early adopters including Scaniverse and CesiumJS.
- **A compatible renderer.** World Labs' MIT-licensed Spark renderer for three.js loads PLY and SPZ
  splats ([sparkjs.dev](https://sparkjs.dev/)). Its three.js requirement (r179 or r180+, per different
  sources) is compatible in principle with Biskiq's r186 base. That is unverified here.
- **Generated worlds export the right pieces.** Marble exports splats together with a collider mesh
  ([World Labs docs](https://docs.worldlabs.ai/marble/export/gaussian-splat)).

**Why it matters.**

- **It reaches categories the studies name but no journey serves:**
  - digitizing physical exhibitions, the most common real "virtual exhibition";
  - heritage;
  - retail;
  - training rooms (the visitor-interface study's lab-SOP journey starts from an imported room);
  - venue and event planning.
- **It is the strongest answer to "useful immediately with my own content"** for anyone whose content
  is a place.

**Why it is not the primary direction (Judgment).**

- **Captures are semantically opaque.** They have no walls, faces or components unless a creator traces
  them.
- **Captures cannot be relit.** This undercuts Biskiq's lighting ceiling.
- **Payloads are large for mobile.**
- **The ground is crowded.** Matterport, Polycam and Kuula already occupy capture-and-annotate.
- **Biskiq's differentiators weaken.** Precision, revision integrity and direction all work best over
  structured space.

**What to protect now (Judgment).** Do not define floor support, hosting or free-roam navigation as if
the venue were always a compiled Layout. Define each as a capability that compiled Layout provides
*first*. This costs little in the plans now in flight. The current T2 floor-support query is a new
layout-core module that can stay the first provider.

### B3 · The evidence loop is the scarcest resource

**Facts.**

- **No creator or audience study is recorded anywhere** in `docs/` or `prototypes/`.
- **All accepted UX was reviewed by the owner or designers, not by creators.** This covers
  Conservatory, Paper, V2 and UX3.
- **Research 6's Tier-1 experiments have not run.** Its experiment portfolio also omits the
  direction-changing prototypes that the studies themselves proposed:
  - split-level platforms vs room blocks;
  - inverse light painting;
  - implicit vs explicit visitor memory;
  - one-gizmo roofs;
  - crisp vs soft atrium cutters.
- **The ratified proof "human value and audience outcome" is first in the proof portfolio but is
  unscheduled.** The "promised creator/audience trial" sits after three things:
  1. Core Editor Stability;
  2. the publication track (deferred by R1-D);
  3. T2 ingest.

**Consequence (Inference).** The product will have built wall drawing, floor placement, GLB import, View
and Stop capture, Preview and Save before anyone uses it with their own material, or before any audience
sees a result. The ratified decision itself names the evidence that should steer this: "If users only
want fast viewing, prioritize import/publish over deep native authoring". The current sequence cannot
produce that evidence in time to matter.

**Opportunity.** Run a disposable staging-and-share prototype with real creators now (E1, E3, E5 in §F),
outside production and outside T4. Use the result to settle Core Editor Stability's criteria, which are
still *proposed pending explicit owner confirmation*. This is the cheapest moment in the program to
change them.

### Considered and not elevated

| Idea | Why not now |
| --- | --- |
| **Conversational / agent scaffolding:** a folder of images plus a CSV, turned into an editable starter. | **Evidence:** the one end-user authoring study in the corpus found non-programmers state goals conversationally (storytelling study, ref 56). Separately, EditHero finds that generate-then-edit drifts while part-level operations hold. Both favour scaffolds that emit ordinary editable intents. **Why later:** no typed intent surface is wired yet. Build it later as a *client* of the same intents. |
| **Publish-time quality derivatives:** baked light, LOD and compressed textures. | **Value:** Shapespark shows that baked lighting makes browser walkthroughs look good on modest devices. This is a real lever on perceived output quality. **Where it belongs:** in T4 delivery profiles. AM-8's content-hashed, closed release already permits such derivatives, so nothing needs protecting now. |
| **Deliverables for physical exhibitions:** hang plans, elevations, label schedules. | Demand is speculative, and the work drifts toward documentation that the North Star excludes. Revisit if trials show exhibition designers as core users. |
| **Scroll and embed web-native delivery.** | Already ratified (North Star, P30-class). It matters for portfolios and brands. Note the visitor-interface study's point that a web-component embed beats an iframe. |
| **Remix, templates gallery, community.** | No study examined it, so there is no evidence either way. Defer. |
| **Multiple levels, chromatic horizons, overhead shells.** | Heavy machinery with no creator demand recorded. Keep the ratified seams (level-qualified references already exist in F.1). Build when a trial creator needs a second floor. |

## C. Competing product and execution strategies

| Strategy | Core bet | Strengths | Failure modes | Architectural implications | Evidence that would change my preference |
| --- | --- | --- | --- | --- | --- |
| **S1 · Build-first Conservatory (current plan)** | Stabilize a complete editor, then publish, then run trials. | Coherent, low rework risk, consistent with every ratified contract. | **Evidence arrives last.** **The novice enters by drawing walls.** **The revision promise is untestable** for content placed by coordinates. **Polish lands before value is proven.** | None new. | E1 shows creators *prefer* drawing their own space first; E5 shows audiences don't need sharing early. |
| **S2 · Staging-first Conservatory (preferred)** | Same architecture. Content staging on hosts and creator evidence come first. | **Novice success with own content.** **Revision integrity for the common case.** **Early discriminating evidence.** **Reuses Opening math and the existing image upload.** | **Hosting is a real cross-domain contract:** wall-face identity and split correspondence. **It may compete with stability work.** **Venue starters may feel generic.** | A Layout-owned host-frame query and correspondence. A Scene host relationship. Impact classification as a query. No new authority. | E2 fails: hosting needs proximity heuristics or unstable face identity. Or E1 shows creators ignore hosts. |
| **S3 · Any-venue (capture- or generate-first) reframing** | Biskiq is the authoring layer over any space; native Layout is an optional trace. | **Broadest reach and an immediate start for anyone with a place.** **Timely** with splat standardization. | **Captures are opaque and cannot be relit.** **Payloads are large.** **Crowded category.** **Biskiq's precision and revision strengths weaken.** | A new environment resource kind and renderer path, a navigation proxy, and trace semantics, which touch the open Layout role decision. | E4 runs well on mid-range phones, *and* E1 recruits mostly have physical spaces to present rather than to design. |
| **S4 · Exhibition vertical** | A focused virtual-exhibition product with templates. | Fastest to a narrow market, simple to explain. | **It competes in the low-ceiling template category Research 6 itself rejects.** **It abandons direction and revision as differentiators.** | Shrinks the scope. Much of F becomes unnecessary. | Trials show nearly all willing creators are artists and galleries who never revise. |
| **S5 · Agent-first authoring** | Describe the project, an agent builds it from semantic intents, and the editor is for refinement. | 2026-native. Fastest scaffolding *if* the operations exist. | **No intent surface is wired.** **Drifts toward prompt-to-3D, a non-goal.** **Edit-after quality is unproven.** | Needs F.4 intents and impact diagnostics first, which is the same work as S2. | An agent spike produces editable starters that creators keep and refine more than hand-built ones. |

**Qualitative scorecard** (judgment, not measurement; H = strong, M = moderate, L = weak):

| Criterion | S1 | **S2** | S3 | S4 | S5 |
| --- | --- | --- | --- | --- | --- |
| Creative discovery ceiling | H | **H** | M | L | M |
| Long-term extensibility | H | **H** | M | L | H |
| Novice success with own content | L–M | **M–H** | H (if they have a place) | H | H (unproven) |
| Expert continuity | H | **H** | M | L | M |
| Revision integrity | M | **H** | L–M | M | M |
| Architectural risk (H = low risk) | H | **M–H** | M | H | M |
| Implementation leverage | M | **H** | M | H (short-term) | L (now) |
| Differentiation | M | **H** | M | L | M |
| Validation potential | L | **H** | H | H | M |

**Decisive tradeoffs.**

- **S2 beats S1** on revision integrity and validation for one reason: S1's own promises (triage, the
  revision loop as the retention event) need relationships and creators that S1 schedules late.
- **S2 beats S3** because Biskiq's distinctive value is structured space that stays right under
  revision, and captures are least structured.
- **S3's real insight survives inside S2 as a venue seam and a spike.**
- **S5 is a multiplier on S2's intents, not an alternative to them.**
- **S4 is the strategy to fall back to only if trials show nobody revises.**

## D. Architectural reconciliation

### D1 · What exists, what is missing, and of which kind

| Capability (product requirement) | Semantic requirement | Status at `26290839` | Gap type |
| --- | --- | --- | --- |
| Stage a creator's own images and models | Typed resources with identity and provenance, plus an ingest declaration | Image upload API only; GLB is absent; Core Editor Stability K1 plans GLB only | **Wiring plus scope:** add still images to the bounded ingest |
| Hosted placement on walls, floors and plinths | An explicit host relationship, a host-relative frame, and correspondence under split/merge | The pattern exists only inside Layout, for Openings. Scene is world-local. | **Missing contract:** a Layout host-frame provider plus a Scene host relationship |
| Revision triage across domains | A reverse dependency over declared relationships; unchanged / recomputed / needs review / unresolved | F.1 resolution results and repairable bindings exist. Impact reporting is ratified in principle but absent from F. | **Missing contract**, small if it is a read-only query |
| Free-roam publish with zero Stops | A Camera profile controller for walking or click-to-move, plus an Experience entry policy | Absent. AM-6's visitor profile v1 covers Cut, Travel, Stops and DOM navigation, not free movement. | **Missing capability** under the existing Camera authority |
| Captions and Presentation text | An Experience-owned, authored, localizable content home | A **disclosed T3 residual**: presentation text "has no authored F2 home" | **Missing contract**, already owned by T3 |
| Default "looks good" lighting | A Scene world-presentation default, inspectable and replaceable | Lights exist. No environment or look concept. | **Ratified, absent** |
| Section and cutaway readings | Layout-owned representation channels | AM-3 Plan family (cut height, depth, Reveal). The Section workbench is not built. | **Ratified, partially implemented** |
| Many Experiences, Stops and Guides | Experience@1 units, the program codec, the interpreter | Implemented, accepted and test-only. They activate at T3.P01.S04. | **Implemented, inactive** |
| Release package | The F.5 envelope and a prepared reader | Undrafted. The P22 authored-snapshot path is live. | **Ratified, deferred** (R1-D) |
| Multiple levels, dual-skin shells, poses, cue stacks | Layout multiplicity, typed states and performances | Level-qualified references only | **Speculative for now** |

### D2 · Where Research 6 must yield to ratified contracts

| Research 6 statement | Ratified or landed contract | Consequence |
| --- | --- | --- |
| Camera "exclusively owns … section/clipping planes" (§1 table, §3 workbenches) | F.3 / AM-3: **Layout** owns cut height, depth and Reveal as a Layout representation family. Camera owns pose and projection. | Research 6's per-entity "Clip Participation: Exclude" has no owner as written. For architecture it is Layout representation. For Scene objects it needs an explicit Scene-presentation decision. |
| "Room-local origins" and room-local `(x, y, z)` anchoring (§1, Seam A1) | Scene is world-local and `roomId` is rejected. AM-1: "a Room without an authored frame cannot qualify" as a frame. | "Anchor to a room" must be a typed *host relationship* to a Room subject, never a Room coordinate frame. |
| "Immutable versioned release snapshot" | AM-8: a prepared package with independent release identity. The P22 *authored snapshot* is the path being retired. | Change the terminology; otherwise the retired design will be re-derived. |
| Environmental Looks scoped to "Zones", plus an "Invisible Zone Separator" made from a deleted wall line | Layout owns topology. Whether a ring may be non-enclosing or non-rendering is an **open Layout decision** (`architecture.md` §Wall role). | Zones need an owner before any look is scoped to one. |
| The Look-Dev Ribbon folded into runtime Environmental Looks | The decision record distinguishes runtime *states* from validated *alternatives*. | A/B comparison while authoring and visitor-triggered looks have different lifecycles; keep them separate. The scene-composition study's original ribbon was the authoring kind. |
| Pose-in-Place in the Experience lens captures a shared Entity Pose | Decision record §5: capture becomes authored intent only through "an explicit validated operation with a stated target scope" (definition / instance / invocation). | The pose's scope must be shown before capture; otherwise one tour's poses leak into every Experience. |
| Free roam is "natively included" in Experience | AM-6 v1 has no free-movement profile, and no controller exists in source. | The "Subtraction Baseline" is a missing capability, not a default. |
| Evidence tiers treat vendor figures as peer-reviewed | See the appendix. | Re-tier before use. |

### D3 · Hosted staging: architecture options and the case against

| Option | How it works | Cost and risk |
| --- | --- | --- |
| **1 · Snap only** | A transient assist; the commit stays world-local. | **Cheapest, with no new contract.** But content placed this way is never revision-safe, triage has nothing to evaluate, and trial content cannot be re-hosted later because proximity inference is refused. |
| **2 · Hosted reference resolved through Layout correspondence (preferred hypothesis)** | **Scene side:** Scene records an explicit relationship to a Layout host, using the Opening pattern: a host subject plus a host-relative position. **Layout side:** Layout provides a runtime-safe host-frame evaluation, and publishes the split/dissolve correspondence it already computes with each accepted revision. **Result:** Scene's world transform is evaluated. Layout acceptance stays single-domain, and impact classification is a query. | **Needs:** stable *face* identity under reversal, split and dissolve; correspondence exposed across revisions; and hosts on curved walls by arc length. **F.1 may already suffice** if Layout declares face components, and E2 decides that. **Downside:** Scene evaluation then depends on Layout compile output, which is a declared dependency, not a hidden one. |
| **3 · Compound rebase at acceptance** | A Layout acceptance rewrites dependent Scene host references in one F.4 compound acceptance. | Scene references are always current. But every Layout edit becomes cross-domain. T2.P01's phase rule ("a mixed Layout/Scene transaction is not introduced") would need revisiting, and compound acceptance only arrives with the T3 cutover. |

**Strongest case against Option 2:**

1. **Face identity is harder than Opening offsets.** Junction trims, thickness changes, reversed
   traversal and curved centerlines can all move "the inner face".
2. **Snap-only already delivers most of the *first-session* benefit.** Hosting can be added later as an
   optional field, with world-local staying valid.
3. **It adds a dependency edge** (Layout → Scene evaluation) to every Layout edit.
4. **It pulls T1 and T2 into a shared contract** during a stability milestone.

**Why I still prefer it:**

- **Point 2 hides the cost.** Everything placed before hosting exists stays world-local for good, and
  the trials meant to prove the *revision* loop would run on content that cannot show it.
- **Points 1 and 3 are exactly what E2 measures.**
- **One asymmetry must be designed, not inherited.** Layout *rejects* an edit that would invalidate its
  own Openings. Cross-domain hosted content must instead *never block* a valid Layout edit; it becomes
  `Unresolved` (Research 6 §3, World | Experience amendment). Reusing the Opening arithmetic must not
  reuse the Opening refusal policy.

### D4 · Venue pluralism: options and risks

**Options.** These are not mutually exclusive.

- **(a) A captured environment as a typed Scene world-presentation resource**, with an imported
  collider or navigation proxy.
- **(b) Layout "trace" walls and floors over a capture**, used as hosts and for navigation with their
  rendering suppressed. This touches the open Layout decision on non-enclosing or non-rendering walls.
- **(c) Host planes picked on the capture**, as Scene-owned anchors.

**Strongest case against.** It means a new renderer path and dependency, and the trouble of mixing
splats with meshes (depth sorting). It brings mobile memory limits and capture-quality variance. It
pulls toward a category Biskiq does not lead. And captures cannot be relit.

**Unknowns that only a spike resolves.**

- Frame time and memory at 0.5–2M splats on target phones.
- Whether depth compositing works with Biskiq's mesh content.
- Whether pointer rays can pick reliably on splats.

### D5 · Genuinely missing contracts, and speculative ones to leave alone

**Missing contracts.**

- The revision impact report, as a read-only classification over declared relationships.
- A Layout host-frame provider, with correspondence.
- A Scene host relationship.
- A still-image resource kind in the bounded ingest.
- A free-roam Camera profile controller, with an Experience entry policy.
- An authored home for Presentation text (already a T3 residual).

**Not missing.** Each of these should be reused, not re-invented:

- identity and resolution (F.1);
- acceptance (F.4);
- channel conflict (F.3);
- the Camera authority.

**Speculative mechanisms to refuse for now.**

- Research 6's Category A seam ledger built as up-front infrastructure.
- Zones.
- A tri-modal UI engine.
- DOM pool thresholds.
- Look-Dev state ribbons.
- A generic relationship *solver*. Hosting is one-directional (dependent → host) and acyclic; anything
  else follows the ratified "reject cycles unless a declared solver" rule.

### D6 · Implementation inventory (Fact): wire before minting

Accepted code that no product route reaches:

- the F.2 units, program, migration and Experience interpreter;
- the Scene planners;
- most layout-core planners, including wall-chain, enclosure and opening creation.

**Duplicate tour stepping.** Three tour-stepping implementations coexist, and only the legacy
`visitor-runtime-state` one is live. This is planned transitional duplication until T3.P01.S04, but it is
maintenance carried without creator value.

**Dead retained modules.** About a dozen modules under `apps/editor/src/lib/authoring/camera/` and
`apps/editor/src/lib/authoring/scene/` have no importer in source or tests (by import search). That
conflicts with the retention rule in `apps/editor/src/lib/authoring/README.md`.

**Inference.** The next creator capabilities are mostly UI wiring over tested kernels. Judge progress by
which creator verbs are reachable in the browser, not by gates accepted.

## E. T1–T4 and milestone consequences

Every row below is **proposed, not authorized**. Core Editor Stability's criteria are themselves still
"proposed pending explicit owner confirmation". Nothing here expands the milestone silently; one row
proposes a deliberate *substitution* for the owner to decide.

| Category | Proposal | Owner |
| --- | --- | --- |
| **No change** | The ratified authorities and hard rules. F1–F4 gates and their accepted capabilities. The T3.P01.S04 authorization path (inventory, migration, the K2 gap). R1-D's deferral of *durable* publication. Core Editor Stability's intent: a useful, stable creator workflow without publication. | — |
| **Reprioritization within tracks** | **T2:** the bounded ingest phase (K1) becomes "flat GLB **plus still images**", reusing the existing image upload path, and is followed by hosted placement. **T2.P01.S03:** proceed as authorized, but keep its placement intent open to a later host relationship; do not treat "Y support-resolved at placement" as the only placement mode. | T2 |
| | **T1:** a Layout-owned host frame (wall face by arc length and height, Room floor, plinth top) and an exported split/dissolve correspondence, as T2's provider. The existing creation planners (wall chain, enclosure, opening) get UI before any new Layout kernel work. | T1 |
| | **T3:** in the candidate T3.P02, an authored home for Presentation text and an Experience with no Guide (free exploration) as a first-class Preview case. A free-movement Camera profile controller is registered explicitly as Camera-authority work, with the owner assigning the track, not left implicit. | T3 (+ owner) |
| | **T4:** no change now. Revisit after E5. If trials need a share link before T4, use a disposable prototype export, not a second production delivery path. | — |
| **Additional future capabilities** | A revision impact report as a read-only F-level query plus per-domain classifiers. A captured-environment resource kind, *only* if E4 passes. Publish-time quality derivatives as T4 profile options. | F owner, T2, T4 |
| **Revised integration sequence** | **The Core Editor Stability journey proves the revision promise on the creator's own content:** starter venue → import images and one GLB → place them hosted on walls and plinths → caption → Preview (free exploration and Cut) → Save → change a wall → see `Preserved` / `Unresolved` → reload. **One possible substitution, decided after E1/E2:** if venue starters plus precision edits (length, angle, move, split) satisfy creators, then K3's "draw straight walls from empty into closed enclosures" moves to the first post-milestone T1 phase, and hosted image placement takes its place. **Judgment:** the net scope is roughly neutral, because general wall-drawing UX is substantial while image upload and the hosting arithmetic already exist. That is uncertain. | Owner (milestone criteria) |
| **North Star or architectural amendment** | **None required.** Two optional clarifications for the normal reconciliation route. (1) Scene attachments include hosting on Layout-provided host frames, with Layout supplying the frame and correspondence. (2) "Imported content" explicitly includes captured or generated environments. | Owner, only if desired |

## F. Highest-leverage validation experiments

All five are disposable. None builds production infrastructure. E1, E3 and E5 can share one prototype
and one recruit pool.

| # | Hypothesis | What to demonstrate (minimum) | What falsifies it | Decision that follows |
| --- | --- | --- | --- | --- |
| **E1 · Staging-first entry** (UX prototype in `prototypes/`) | Creators with their own content reach a share-worthy, personally authored result faster, and with more authorship, starting from a venue plus content drop with hosted placement than starting from drawing walls. | 6–8 creators across at least 3 categories (artist or photographer, educator or object explainer, designer with a model, small institution). **Arm A:** pick one of 3–5 venues, drop images and one model, hosted placement, captions, free exploration. **Arm B:** draw walls in Plan, then place. Both end in a static share link exported by the prototype. Also observe what creators choose when free. | Arm B is as fast or faster *and* rated as more "theirs". Or most creators reject the venues and successfully draw their own. Or hosted placement confuses more than it helps. | Settles the Core Editor Stability substitution (§E): wall drawing vs hosted image placement as the milestone's must-have. |
| **E2 · Hosting revision spike** (throwaway branch, real `@portfolio/layout-core`) | Hosting on Layout wall faces can classify six canonical edits deterministically, with no proximity heuristics and no cross-domain writes. The six edits are lengthen, shorten past content, move, split, dissolve or merge, and delete. | A test-only resolver: host = wall + face + arc length + height. Run the real planners and compiler on fixtures including a curved wall and a reversed wall. Output each relationship's class. | Face identity is unstable under reversal, split or trim. Or classification needs nearest-surface guessing. Or arc length breaks on curved centerlines. | **Pass:** register Option 2 (§D3) as T1-provider and T2-consumer work. **Fail:** keep world-local plus snapping, and reword the revision promise for content honestly. |
| **E3 · Revision trust on one's own work** (UX, the E1 recruits a week later) | Creators understand and trust explicit triage on their *own* project more than silent re-projection or blocking warnings. | Apply structural edits to their saved E1 project. Compare explicit triage, silent adaptation and blocking modals (Research 6 Tier 1.3, on real content rather than fixtures). | Most creators ignore or misread triage, or prefer silent adaptation even after seeing a stranded item. | Sets triage granularity: whether `Recomputed` is ever surfaced, and when `Needs Review` interrupts. |
| **E4 · Captured-venue spike** (disposable Threlte stage at r186 with Spark) | A 0.5–2M-splat capture can serve as a venue alongside mesh content and DOM labels, with Camera-evaluated navigation and traced host planes, at acceptable frame time on a mid-range phone. | Load a Scaniverse or Marble export. Add two GLBs, an image and a label. Pick on traced planes. Measure frame time and memory on one phone and one laptop. | Under about 30 fps on the target phone at 500K splats. Memory failure. Unusable splat/mesh depth compositing. Unreliable picking. | **Pass:** register a captured-environment resource kind as later T2 scope. **Fail:** keep it deferred and close S3. |
| **E5 · Audience loop pilot** (E1 outputs, real audiences) | Creators share with a real audience, get feedback, and revise and re-share within two weeks: the ratified retention event. | Disposable share links, plus a feedback form outside the product. | Few creators share, or nobody revises after feedback. | **If audiences matter early:** after Core Editor Stability, sequence T4 before deeper authoring (materials, multi-level, advanced Camera). **If not:** keep R1-D and invest in authoring. |

**Do not build to answer these:** a production share route, a release format, an ingest pipeline,
a generic relationship engine, or agent infrastructure.

## G. Final recommendation

**Now (owner decisions).**

1. **Authorize E1–E3** as disposable work in `prototypes/` and a throwaway spike branch, alongside batch
   B. E4 is optional at the same time; E5 follows E1.
2. **Hold Core Editor Stability's criteria open until E1 and E2 report.** Then decide the substitution in
   §E: hosted still-image placement as a must-have, and whether general wall drawing stays a must-have.
   Ask for nothing that is already ratified.

**Can proceed alongside currently authorized work.**

- **Close batch B:** T1.P01.S04's merge and residuals, and T2.P01.S03 as authorized. S03's placement
  intent should stay open to a host relationship.
- **Continue T3.P01.S04's authorization path.**
- **Reconcile the documentation drift noted under "Evidence basis" through its owners.** The
  sign-in-draft resume claim in the S04 acceptance and the README's "no write path" are reported here,
  not fixed.

**Wait for evidence.**

- The scope of K3 wall drawing (E1).
- The hosting contract (E2).
- Triage presentation (E3).
- Captured venues (E4).
- Whether T4 should precede deeper authoring after the milestone (E5).
- Any agent scaffolding, until typed intents are wired.

**Defer, keeping the ratified seams.**

- Multiple levels and chromatic horizons.
- Poses, cue stacks and performances beyond the existing program codec.
- Transcript pinning.
- Tri-modal UI and component variants.
- Collaboration and permissions.
- Kits and libraries.
- Physical-exhibition deliverables.

**Refuse.**

- Expressive overhead and volumetric geometry (shells, lofts, void prisms) before any creator demand.
- Authoring physics bake and puppeteering.
- Inline sync ribbons.
- A generic constraint solver or node graph.
- A third "Interface" lens.
- SDF sculpting of any kind.
- Re-hosting by proximity.
- A shadow publication path that becomes durable by habit.
- Building the Category A seam ledger as infrastructure ahead of consumers.
- New governance machinery that is not tied to a correctness risk.

**The one sentence to carry forward.** Biskiq's distinctive value is not that it can build expressive
architecture. It is that **a person's own work, staged in a meaningful space, stays right while they
change it**. Build the relationship that makes that true before anything that only makes it bigger.

## Appendix · Research 6 evidence corrections

**Spot-checked claims.** All were checked against the domain studies' own citations.

| Research 6 use | What the source actually is | Correct tier |
| --- | --- | --- |
| Visitor reading-affinity split (40.4 / 34.0 / 25.5 %) is listed as **Tier 1, peer-reviewed** | A museum display-holder vendor page (visitor-interface study, ref 6) | Unsourced claim, not evidence |
| AUC Rhino-to-Revit "79.9 % conversion failure" | A peer-reviewed survey of n = 35. **79.9 % is not attainable with 35 respondents** (28/35 = 80.0 %). It measures professional interoperability, not authoring UX. | Tier 1 for its own question. Misapplied to Biskiq UX. |
| "Unculled DOM label layout bottleneck (> 50 elements at 60 fps)" called a **hardware rendering benchmark** | A development agency's blog (visitor-interface study, ref 31) | Implementation assumption |
| Smith & Smith dwell times (17 s median, 27 s mean) | Real, but measured in a physical museum. It drives no Research 6 decision. | Context only |
| Physical label densities per 100 m² and Smithsonian word counts | Guidelines, not measurements | Recipe defaults, Tier 4 |
| Default Room Illumination Look, Domain Starter Kits, Asset Readiness pipeline, onboarding timing | Research 6's own additions, with no study basis | Hypotheses |
