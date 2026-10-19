---
kind: post-P01 planning proposal — boundary ledger and coordination record
status: "For owner review. Not a contract, ratification, phase registration, slice authorization, prototype acceptance or change to any P01 scope or milestone criterion."
date: 2026-10-19
repository_snapshot: "main 5fee2a2d (PR #147 merged) on branch docs/research-6-ux-design-program"
---

# After P01: two coordinated roadmaps

This record coordinates two roadmaps that let Biskiq make the strongest justified progress after P01
without locking its architecture or product into decisions that the next design rounds may overturn:

- the **[engineering authorization roadmap](./engineering-authorization-roadmap.md)**: what T1, T2 and T3
  can build now and next, as concrete owner authorization candidates, executable without waiting for any
  prototype;
- the **[prototype roadmap](./prototype-roadmap.md)**: an open-ended, Research 6–driven portfolio of
  interactive prototypes and technical probes, each judged by the owner for whether it is intuitive,
  acceptable and aligned with the vision.

This record owns what both share: the **boundary test**, the single **disposition ledger** (build /
prototype / research further / defer), the **focused research rounds**, the **decision points** where the
two roadmaps meet, and the **amendment candidates** that adopted prototypes may motivate.

## 1. Recommendation

1. **Build the Core Editor Stability workflow and its P02 phases now.** Every item on that path is
   justified by a ratified promise, an owner ruling, a proposed criterion or a verified defect, and none
   depends on an open design question. The F2 cutover (T3.P01.S04) is the critical path; finish the
   current-source P01 slices before it activates.
2. **Run an ambitious prototype program in parallel, aimed at the boundary.** The first prototypes are
   the ones whose verdicts settle decision points engineering will reach soonest: Guide-free discovery,
   revision policy, *Present this*, asset truth.
3. **Build only foundations that are the intersection of plausible directions and have a present
   consumer.** Nine qualify (lowering that keeps every Presentation, a semantic destination index, one
   world presentation for capture and Preview, plain Presentation text, an image resource, ground
   support, ID non-reuse, an exact face query, solve-once framing). Ten tempting foundations do not, and
   are named.
4. **Stop four branches at a precise line** until design or research closes: Experience depth beyond
   T3.P02; persistent relationships beyond solve-once placement; vertical and overhead architecture,
   which **needs another design and research round before any implementation**; semantic assets and
   reuse beyond flat import. Look development, visitor movement and delivery stop too, for narrower
   reasons.
5. **Change no ratified authority now.** Nothing found contradicts the North Star, the decision record,
   F or PLATE. Nine amendment candidates are listed; each is drafted only if its triggering verdict or
   first consumer arrives.

## 2. What changed from the earlier draft in this PR

The earlier draft (`broad-research/research-6-exploration-program.md` at `bd25489e`) proposed one
staged research program with creator and audience studies. This revision replaces it with the two
roadmaps above.

| Kept | Where it lives now |
| --- | --- |
| Creative questions as the organizing unit, not features | The prototype roadmap's §5 headings |
| "What is established and what is not", refreshed to `5fee2a2d` | Engineering roadmap §2 |
| E2's narrow reading (bounded geometric feasibility only) | TP3's scope; RR-4 |
| Known correctness work as a separate queue that never waits for research | Engineering roadmap §2.3 and AC-2 to AC-4 |
| The mechanism, space and flat-content briefs, with matched comparators | Prototype roadmap §4 |
| R1–R6's decisions and falsifiers | Recast as prototypes and probes (table below) |
| Composability cases, safeguards, exclusions, external evidence | Prototype roadmap §5.8, §10, §11, §12 |

| Removed | Why |
| --- | --- |
| Schedules, person-days, staffing, recruitment plans | Not wanted; dependency order replaces calendar order |
| Participant matrices, audience sample sizes, numeric screening thresholds | The owner judges interaction value; technical claims keep their own evidence standard |
| "Observe the stability product" as a program stage | Becomes an owner option after stability, never a gate |

| Earlier record | Now |
| --- | --- |
| R1 First result and audience value | X3 *Present this*, X4 flat content |
| R2 Direction, participation, independent time | X1a, X1b, X5, X6, TP1 |
| R3 Revision, repair, reuse | X2 (the reconciliation's conditional X2b, promoted), X7, TP3 |
| R4 Spatial instruments | X8–X13 |
| R5 Browser fidelity | X14, TP4 |
| R6 Asset truth | TP2, X16 |
| R7 Stability product observation | Optional, owner's choice |

The [unified reconciliation](../research-6-unified-reconciliation.md) remains the evidence base; its
statement that T2.P01.S03 is "in review as PR #147" is now stale (merged).

## 3. The boundary test

Every capability, mechanism or foundation passes through four questions:

| # | Question | A "no" means |
| --- | --- | --- |
| 1 | **Mandate.** Is it required by a ratified promise, an owner ruling, a proposed stability criterion or a verified defect, or is it an ordinary operation the accepted contracts already govern? | No reason to build now → **DEFER**, with a trigger |
| 2 | **Invariance.** Is its shape the same under every live answer to the open design questions that touch it? | If the open question is about feel, legibility or vision fit → **PROTOTYPE**. If it is about a domain model, authority or format that no interaction verdict can choose → **RESEARCH FURTHER** |
| 3 | **Consumer.** Does a justified consumer in the same or next phase exercise it end to end? | "Future features might use it" is not a consumer → **DEFER** |
| 4 | **Reversibility.** Does it avoid committing an authority, a cross-domain format or a shell departure that an open decision could overturn? | Split it: **BUILD** the invariant part, route the rest to prototype or research |

All four "yes" → **BUILD**. The rule of thumb is **build the intersection, not the union**: the part of a
capability that every plausible direction needs, not a general mechanism big enough to host all of them.

Worked examples:

- **Guide-free Presentations.** Keeping every valid Presentation through lowering and reaching each one
  from a semantic index passes all four (a ratified promise, required by accessibility, neutral to every
  discovery design). How discovery should look and feel fails question 2 on feel → X1a.
- **Surface placement.** A solve-once "place on this surface" plus an exact, read-only face query passes.
  Whether placement keeps provenance or follows its host fails question 2 on feel and question 4 on
  format → X2, then RR-4 only if live hosting is adopted.
- **Levels.** Fails question 2 on the domain model; a prototype can supply requirements but not choose
  the model → X10 plus RR-1, and no T1 levels phase until RR-1 closes.
- **Publish UI.** Fails question 1 under R1-D → DEFER.

## 4. The disposition ledger

One row per capability. **BUILD** rows carry their timing (now, P02 wave, post-stability) and their
authorization candidate (AC-n, defined in the engineering roadmap's
[§6](./engineering-authorization-roadmap.md#6-authorization-candidates)). **PROTOTYPE** rows name their
prototype or probe (X-n, TP-n, defined in the prototype roadmap's [§5](./prototype-roadmap.md#5-the-portfolio)
and [§6](./prototype-roadmap.md#6-technical-probes)). **RESEARCH FURTHER** rows name their round (§5).
An arrow means "this disposition, then that one if the verdict is positive".

### 4.1 Experience and Camera

| Capability | Disposition | Boundary reason | Owner | Route |
| --- | --- | --- | --- | --- |
| F2 cutover (T3.P01.S04) | BUILD · now | Ruled prerequisite for K1, K3 and T3.P02 | T3 | AC-6 to AC-8 |
| View capture; Presentation with optional Stop in one acceptance; reorder; holds; two Experiences | BUILD · P02 wave | Stability criterion; ratified | T3 | AC-9 |
| Isolated Cut Preview with reduced motion and semantic navigation | BUILD · P02 wave | Stability criterion | T3 | AC-9 |
| Every Presentation kept through lowering and reachable from a semantic index | BUILD · P02 wave | Ratified promise contradicted in code; neutral to discovery design | T3 | AC-7, AC-9 (owner decision 1) |
| Guide-free discovery design: constellation, spatial markers, contextual entry | PROTOTYPE | Feel and legibility | T3 | X1a |
| Plain Presentation text | BUILD · P02 wave | Already in T3.P02's scope; neutral to the content model | T3 | AC-9 |
| Rich Presentation content: media, sections, layout hints | PROTOTYPE → RESEARCH FURTHER | Changes the program format; design open | T3 | X4, X1b, X14 → RR-6 |
| One world presentation for capture, Preview and visitor | BUILD · P02 wave | Verified defect; neutral to authored lighting | T3, then T2 authors it | AC-9 |
| Frame this, solve-once | BUILD · P02 wave (optional) | Ordinary Camera operation the decision record names | T3 | AC-9 |
| Assisted, recomputing framing | PROTOTYPE | Relationship policy under revision | T3 | X3, X2 |
| *Present this* compound workflow | PROTOTYPE → BUILD candidate | Compound acceptance is ratified; authorship and divergence unjudged | T2 + T3 | X3 |
| Travel path and anchor authoring | BUILD · post-stability | Ordinary Camera authoring on Conservatory's accepted grammar | T3 | AC-19 |
| Scroll-driven Guide; bounded reading-layout instrument | PROTOTYPE | The most consequential open Experience UX question; possible shell change | T3 | X1b |
| Scroll and embed delivery profiles; seek and scrub | DEFER | R1-D | T4 | Stability accepted and T4 planning renewed |
| Held choices and branching in authoring | PROTOTYPE | The program supports `set-state` and `navigate-to`; authoring and scroll behavior unjudged | T3 | X1b, X6 |
| Conditions and visitor state: counts, phrases, rehearsal, loose ends | PROTOTYPE → RESEARCH FURTHER | Operator set and lowering are format decisions | T3 | X6 → RR-7, before any T3 Gates phase |
| Independent performances and local timing | PROTOTYPE + probe → RESEARCH FURTHER | Shell rule and program-kind changes; feasibility unproven | T3 + Scene | X5, TP1 → RR-3 |
| Inspection captured into a Presentation | PROTOTYPE → RESEARCH FURTHER | Representation parameters inside the program | T3 + T1 | X12 → RR-3 |
| Visitor participation parameters | PROTOTYPE | Session-state types exist; authoring unjudged | T3 | X6 |
| Public integration interface: parameters, actions, events | DEFER | Delivery-facing | T4 | After R1-D |
| Movement controller: click-to-move to destinations | PROTOTYPE → BUILD candidate | No movement controller exists; feel unjudged | T3 | X15 |
| Walking with collision | DEFER → RESEARCH FURTHER if adopted | Walkable geometry undefined | T3 + T1 | X15, then a walkable-geometry question inside RR-1 |
| Narration, media, transcript-pinned cues | DEFER | Coordinated-direction scope; no consumer | T3 | X5 shows a need |
| Stop-at-next-occurrence playback; branch rejoin | DEFER | Already unscheduled experiments | T3 | Owner prioritizes |
| One composition, several readings | PROTOTYPE | Reuse value unjudged | T3 | X18 |

### 4.2 Scene and resources

| Capability | Disposition | Boundary reason | Owner | Route |
| --- | --- | --- | --- | --- |
| Resize, duplicate, delete, source JSON reload, Save journey | BUILD · now | Stability criterion; planned in T2.P01.S04 | T2 | AC-2 |
| Catalogue model admission | BUILD · now (correction), or criterion wording | Verified recorded failure; stability row names admitted models | T2 | AC-2, AC-13 |
| K1 flat GLB import | BUILD · P02 wave | Ruled | T2 | AC-10 |
| Image resource and image panel | BUILD · P02 wave (recommended) | Blocks most creator types; neutral to where images live in reading content | T2 + resources | AC-10 (owner decision 2) |
| Images as Presentation media | PROTOTYPE | Content model open | T3 | X4 → RR-6 |
| Ground-datum and plinth-top support | BUILD · P02 wave or post-stability | Ratified promise (useful with an empty Layout); neutral to placement design | T2, T1 query | AC-10 or AC-16 |
| Solve-once Place on this surface; exact read-only face query | BUILD · post-stability | Ordinary operation; the query is neutral to A0, A1 and B | T2 + T1 | AC-16 |
| `placedOn` provenance (A1) | PROTOTYPE | Which relationship persists is the open question | T2 | X2 |
| Live hosting (B); correspondence publication | PROTOTYPE → RESEARCH FURTHER | Needs Layout correspondence and an adopted need | T1 + T2 | X2, TP3 → RR-4 |
| Impact report in the four ratified states | PROTOTYPE now; BUILD with the first persisted relationship | States are ratified; no relationship persists yet | Each domain | X2 |
| Multi-select, align and distribute, replace | BUILD · post-stability | Ordinary operations the decision record names | T2 | AC-17 |
| Material and light property editing; a Scene-owned environment default | BUILD · post-stability | Scene owns them; neutral to looks | T2 | AC-17 |
| Light this (target-first, solve-once) | PROTOTYPE → BUILD candidate | Value unjudged | T2 | X8 |
| Editor-session A/B, persisted variants, visitor looks | PROTOTYPE (conditional) → RESEARCH FURTHER | Four lifecycles must stay distinct | T2 + resources | X13 |
| Shutters, sun solving, illuminance heatmaps | DEFER | No consumer | T2 | X8 names a need |
| Components, roles, hierarchical ingest, re-export continuity | Probe + PROTOTYPE → RESEARCH FURTHER | Real-file identity unproven | T2 + resources | TP2, X16 → RR-5 |
| Reusable explanations, kits, libraries | PROTOTYPE → RESEARCH FURTHER | Reuse value unproven | T2 + T3 | X7 → RR-5 |
| Physics staging, puppeteering, action recording | DEFER | Nondeterministic; X5 tests independent time more cheaply | — | A task fails with snapping and solve-once assistance |
| Surface material stacks, generated maps, moodboard extraction, SDF pedestals | DEFER | Not needed for attention or variation | T2 | X8 names a specific control |

### 4.3 Layout

| Capability | Disposition | Boundary reason | Owner | Route |
| --- | --- | --- | --- | --- |
| Straight-Wall manipulation; P01 final gate | BUILD · now | Stability criterion; planned | T1 | AC-1, AC-5 |
| K3 straight-Wall creation, Wall delete, Openings | BUILD · P02 wave | Ruled | T1 | AC-11 |
| Canonical ID non-reuse | BUILD · P02 wave | F.1 forbids silent retargeting; K3 is the consumer | T1 | AC-11 |
| Section/cutaway and Unroll as World readings | BUILD · post-stability | Ratified Layout ownership; accepted Spatial Authoring journeys | T1 | AC-18 |
| Unroll as a placement surface | PROTOTYPE | Depends on surface placement and the provenance verdict | T1 + T2 | X9 |
| Curved-Wall manipulation and drawing; remaining dormant canonical planners | BUILD · post-stability | Planners exist; PLATE §0.8.4 governs drawing | T1 | AC-18 |
| Plan-cut drawing | DEFER, or folded into K3 by owner ruling | Unassigned residual | T1 | AC-11 |
| Levels, vertical relationships, stairs, voids | PROTOTYPE → RESEARCH FURTHER | The level model is open | T1 | X10 → RR-1 |
| Slabs, ceilings, roofs and other overhead forms | PROTOTYPE → RESEARCH FURTHER | Slab and ceiling ownership is explicitly open | T1 | X11 → RR-2, TP5 |
| Spatial volumes, procedural grammars | DEFER | Second-compiler risk; no consumer | T1 | RR-2 names a family |

### 4.4 Visitor surfaces, persistence and cross-cutting work

| Capability | Disposition | Boundary reason | Owner | Route |
| --- | --- | --- | --- | --- |
| In-editor Preview takeover | BUILD · P02 wave | Stability criterion | T3 | AC-9 |
| Spatial labels, tethered callouts, reading surfaces | PROTOTYPE + probe → BUILD candidate after RR-6 | Content model and alignment open | T3 | X14, TP4 |
| Publish UI, prepared reader, F5, share routes | DEFER | R1-D | T4 | Stability accepted and two owner acts |
| Captured venues, XR, zero-chrome visitor mode | DEFER | No evidence | — | The owner's projects mostly start from existing places |
| Project rename and delete (K4) | BUILD · now (delete) and P02 wave (rename) | Ruled; stability criterion | T3 + T1 | AC-12 |
| Sign-in Save recovery | BUILD (3B) or criterion amendment (3A) | Verified defect | T1 + T3 | AC-4 (owner decision 3) |
| TD-8 stale task services | BUILD · now | Verified defect on every adapter path | T1 host | AC-3 |
| TD-6 migration race; TD-7 foreign-row lock | BUILD · on the cutover path | On S04's quiescence and Save path | API | AC-6 |
| Stale descriptive text | BUILD · now | Misroutes planning (triage case B) | Docs | AC-15 |
| Agents, MCP, autonomous generation | DEFER | Typed intents must be wired and stable first | — | Direct operations adopted |
| Collaboration, marketplaces, library distribution | DEFER | Reuse value unproven | — | X7 and RR-5 |

### 4.5 Already refused, not reopened here

From the ratified invariants and the reconciliation's
[refuse list](../research-6-unified-reconciliation.md#65-defer-and-refuse): a generic relationship
engine, constraint solver or node graph; a second Camera timeline or replayed trajectories; two pose
authorities; an ordered `presentations[]` outside a Guide; implicit visit memory; a standalone Cue stack;
ownership by proximity; Room-local frames; poses, clips or looks stored in Scene; alternatives folded
into runtime looks; persisted view-dependent highlights; invisible Stops; a Website or third Interface
lens; full-building or general SDF; a shadow publication path; a seam ledger as infrastructure; T4
drafting before R1-D lifts. A prototype may still produce a counterexample against one of these; that
becomes a finding for the owner, not a quiet reopening.

## 5. Focused research rounds

These are not another broad research cycle. Each answers one domain-model, authority or format question
that neither an owner verdict on an interaction nor an engineering plan can settle, opens only on its
trigger and ends when a defensible disposition exists. Each produces a **decision packet**: the problem,
the alternatives, the chosen and rejected models, pre-baseline replacement implications, any amendment
draft, and the named first consumer, or an explicit "no change".

| Round | Question | Why neither roadmap can settle it alone | Inputs | Opens when |
| --- | --- | --- | --- | --- |
| **RR-1 · Levels and vertical frames** | How levels are identified and qualified; how content spans heights; which frames are explicit; how Plan and Section follow; whether walkable surfaces are a Layout concept | It decides Layout's document shape and F.1 qualification; an interaction verdict supplies requirements, not a model | X10, X15 (if walking), the multi-level study's stress tests, T1 planning evidence | Before any T1 levels phase, or X10 adopted |
| **RR-2 · Overhead geometry and slab/ceiling ownership** | Who owns slabs and ceilings; which bounded overhead family (planes and profiles, straight skeleton, guided loft) extends the one compiler; how Wall tops agree | Ownership is explicitly open in the North Star; families need adversarial geometry | X11, X8, TP5, the roof study, current Wall-height semantics | X11 adopted |
| **RR-3 · Coordinated execution** | Performance resources; independent clocks; arrival versus editorial time; interruption, seek and reset; Scene channel families and arbitration; captured inspection parameters in programs | Program-kind and F.3 changes need a first consumer and conformance cases | TP1, X5, X12, S06's residuals | TP1 succeeds and X5 or X12 is adopted |
| **RR-4 · Persistent relationships and correspondence** | Which relationships persist; Layout split, dissolve and merge correspondence; identity across reload; the impact index | Live hosting is the largest commitment in Research 6 | X2, TP3, the E2 spike | X2 adopts B, or T2 planning needs the choice |
| **RR-5 · Semantic assets, components and reuse** | Component identity across re-export; role binding; kits as references with roles and slots | Real-file evidence and identity semantics, not feel | TP2, X7, X16 | X7 or X16 adopted |
| **RR-6 · Experience content and reading model** | Rich content records, layout hints, media, spatial labels as authored entities, without becoming a website builder; seek and progress recorded for T4 only | It changes the Experience format; delivery stays frozen | X1b, X4, X14, TP4 | Any of them adopted |
| **RR-7 · Conditions and visitor state** | The operator set (counts included or not); how semantic phrases lower into declared state; rehearsal from explicit initial state; loose-end diagnostics | Operators are a format decision with revision consequences | X6, the storytelling study's protocols, AM-6 | Before any T3 Gates planning, or X6 adopted |

## 6. Decision points where the roadmaps meet

### 6.1 Coordination rules

1. **Engineering never waits.** Every BUILD item is executable on its own evidence. A plan that reaches
   a decision point with no verdict takes the default in §6.2 and records that it did.
2. **A verdict moves a ledger row only through a proposed change.** The prototype PR proposes the row
   change in §4; the owner approves it with the verdict.
3. **Authority changes become amendment candidates (§7), never edits.** Each follows its owner's
   procedure: decision record, F amendment and gate version, PLATE rule change with its conformance test,
   or milestone definition amendment.
4. **Adopted directions enter engineering at the next planning event**, with the prototype's verdict and
   honesty ledger as evidence. Prototype code, mock data shapes, mock evaluators and snapshot Undo are
   never carried into production.
5. **Research rounds open only on their triggers** and close with a decision packet.
6. **When a probe and a verdict disagree, the probe wins on feasibility.** An adopted interaction found
   infeasible is relabeled "adopted, infeasible as shown" and returns to prototype or research; the
   engineering plan is not bent to fit it.

### 6.2 Decision points and defaults

| Engineering item | Decision point | Settled by | Default if no verdict when the plan freezes |
| --- | --- | --- | --- |
| T3.P02 (AC-9) | Discovery beyond the semantic index | X1a | Semantic index and Cut only |
| T3.P02 (AC-9) | Frame this as fixed or assisted framing | X3 | Fixed, solve-once, optional verb |
| T2.P02 (AC-10) | Image scope (owner decision 2) | X4 informs; owner decides | Image resource and image panel; no Presentation media |
| T2.P02 (AC-10) | Honest import capability states | TP2 | K1's ruled states (scale, pivot, footprint) only |
| Surface placement (AC-16) | Provenance: A0, A1 or B | X2 | A0, pose only, labeled as such; B is never a default |
| Surface placement (AC-16) | Unroll as the arrangement view | X9 | In-place placement only |
| T2 composition depth (AC-17) | Light this | X8 | Property editing only |
| T3 Camera depth (AC-19) | Movement controller | X15 | None built |
| T1.P02 (AC-11) | None | — | Drawing follows PLATE §0.8.4; no prototype needed |

## 7. Amendment candidates

Planning labels only. "AM-9" is already taken by the S04 preflight, so these use **AMC-n**. None is
drafted by this PR. No amendment to the North Star or the decision record is proposed.

| ID | Candidate | Authority and procedure | Motivated by | Drafted when |
| --- | --- | --- | --- | --- |
| AMC-1 | Cutover gate @1 content: S06 pre-S04 decisions, where Guide-free Presentations are preserved, K1 and K3 consumption | Gate draft, then owner ratification at version 1 | AC-7 | In the S04 gate draft |
| AMC-2 | Guide-free entry policy and companion navigation | F.2/`ExecutionProgram` amendment drafted by T3.P02 as first consumer | Owner decision 1 | T3.P02 planning |
| AMC-3 | Stability criteria wording | Owner amendment of the milestone definition before acceptance | Decisions 1 and 3; AC-2 | AC-13 |
| AMC-4 | Bounded invoked reading-layout instrument | PLATE rule change: name the changed rule, pass the conformance test | X1b adopted | After the verdict |
| AMC-5 | Local timing instrument | PLATE rule change plus an F program-kind amendment | X5 adopted and TP1 succeeds | After both |
| AMC-6 | `placedOn` provenance | Scene contract plus an F.1 reference-kind amendment, drafted by AC-16 | X2 adopts A1 | AC-16 planning |
| AMC-7 | A new Scene channel family | F.3 amendment with a real conflict example and conformance cases | TP1 plus X5 or X12 | RR-3 |
| AMC-8 | Section and Unroll in viewport projection | T1 capability extension of the AM-5 scope | AC-18 | AC-18 planning |
| AMC-9 | Session-state operators such as counts | F.2/program extension | X6 adopted, RR-7 | RR-7 |

## 8. Owner decisions, in dependency order

| # | Decision | Unblocks |
| --- | --- | --- |
| OD-1 | Accept, revise or reject these two roadmaps as planning direction (this registers nothing) | Everything below |
| OD-2 | Authorize the Research 6 prototype round: the shared base and the order-1 prototypes, later PRs under the same authority or one by one | Prototype roadmap §7 |
| OD-3 | Lane A: AC-1, AC-2 with the catalogue choice, AC-3, AC-4 (decision 3) | P01 closure |
| OD-4 | AC-13: confirm the 13 stability rows | The acceptance plan |
| OD-5 | AC-6: S04 evidence work, including the K2 publication gap decision | AC-7 |
| OD-6 | AC-7 and AC-8: ratify the cutover gate, then authorize S04 | The P02 wave |
| OD-7 | AC-9 to AC-12: register T3.P02 (decision 1), T2.P02 (decision 2), T1.P02 (cycle-window ruling), authorize K4 | Stability contributing work |
| OD-8 | AC-14: the stability acceptance plan | Core Editor Stability acceptance |
| OD-9 | AC-16 to AC-19, whenever chosen after stability | Post-stability depth |
| — | AC-15 descriptive doc triage, at any time | Accurate routing |

## 9. Evidence base and limits

**Evidence labels.** *Verified* means inspected in source, contracts, registers or Git at `5fee2a2d`.
*Inference* follows from verified facts. *Judgment* is the author's weighing for the owner to accept or
overrule.

**Inspected:** the gate register and every T1–T4 track and phase README; the T1.P01.S05, T2.P01.S04 and
T3.P01.S04 plans and their prerequisites; the T3.P02 proposal; the authorization records of 2026-10-15
to 2026-10-17 including R1-D and the K-rulings; the tech-debt ledger and architecture cycle; the
ratified North Star, decision record, World | Experience amendment, F contracts, PLATE and the instrument
grammar; the reconciliation, the integrated synthesis and the five study reports; every retained
prototype's README; and the live and dormant source for Layout, Scene, Camera, Experience, visitor and
API surfaces. Six read-only harvests gathered these in parallel; their findings were spot-checked against
source before use.

**Not done:** no test lane, browser journey, creator session or measurement was run; no prototype or
probe was built; no register, plan, contract or baton was changed. The docs and architecture gates are
run only on this PR's documents. Classification of code as dormant relies on importer and caller
searches.
