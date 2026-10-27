# T5 G0 — Independent proposal: stratified form

**Independent Stage 1 architecture proposal for peer reconciliation with G0 · 27 October 2026 ·
awaiting review.** Written against the [approved G0 commission](../g0-foundation-architecture-commission.md)
by a second architect, independently of the [G0 proposal (PR #202)](https://github.com/Biskiq/spatial-sketch-editor/pull/202),
read at its head [`97c72bfe`](https://github.com/Biskiq/spatial-sketch-editor/blob/97c72bfe2a175c061d2cb479e07c4a4e0cbc6261/docs/roadmap/t5-expressive-geometry/g0-architecture-proposal/README.md).
“G0 §n” below cites that document. This is not a ratified contract, registered phase, implementation
plan or dependency approval. It changes no commission, track register, release list, contract or
existing roadmap file. No prototype, benchmark or creator study was run; measured figures are quoted
from their cited records and everything else is labelled analysis or hypothesis.

## 1. Position

**Verdict on G0.** G0's foundation is sound, and I would keep most of it as a package: authored
intent separated from generated geometry; a small directed hybrid with one representation route per
operation version; qualified correspondence with explicit repair; integration through F4, the shared
Stage, Camera and T4 rather than a T5 document; Manifold first, Clipper2 for new planar work and
functional fields as the next expressive substrate; validation independent of kernel success flags;
frozen solved controls; its performance targets and licensing analysis. I found no evidence that a
different kernel, representation family or ownership allocation would serve Biskiq better. Where this
proposal agrees, it cites G0 instead of restating it.

**Where I would change it.** G0 deliberately leaves the *shape* of the authored form general: a recipe
of versioned operations whose typed inputs may include other operations' output roles, edited through
a planner that chooses which change implements a gesture (G0 §3). That generality sits exactly where
parametric-history CAD became fragile, and where PR #192 (“the family's parameters are the history”),
PR #196 (sections are “not the object's construction history”) and PR #200 (“history spaghetti”) each
warned, in different words. I recommend committing now to a specific structure — **stratified form** —
whose laws remove whole classes of revision failure by construction instead of managing them through
correspondence afterwards:

1. **Dependencies run through frames, never through generated geometry** ([§3.2](#32-law-1-dependencies-run-through-frames)).
2. **Evaluation order comes from what a contribution means, not when it was made.** A form is a part
   tree; each part evaluates fixed strata — Mass, Shape, True, Detail, Finish
   ([§3.3](#33-law-2-order-comes-from-meaning)).
3. **Precision stays above expression.** Dimensioned features evaluate after shaping in their own
   frames, and kept regions are masks rather than solver constraints ([§3.4](#34-law-3-precision-stays-above-expression)).
4. **Solve at acceptance, evaluate purely.** Every solve, located datum and identity-bearing topology
   outcome is decided once, during preparation, and recorded; evaluation is a pure, deterministic
   function of source ([§4](#4-law-4-solve-at-acceptance-evaluate-purely)).
5. **Gestures address facts; interpretation proposes.** A gesture changes what it visibly touches.
   Inference — “make these flow together”, an agent's brief — returns an explicit, reviewable
   proposal, never a hidden choice of mechanism ([§5](#5-law-5-gestures-address-facts-interpretation-proposes)).

Two further positions are owner-level. The North Star's permanent non-goals (sculpting,
general-purpose geometry modelling) need an explicit bounded amendment before T5 ships expressive form
([§9](#9-scope-the-north-star-amendment-t5-needs)). And the first production increment should be
thinner than G0's, preceded by a headless **form-semantics harness** that encodes *both* architectures
against the same revision scenarios, so reconciliation is settled by evidence rather than preference
([§10](#10-sequencing-and-initial-deliverables)).

## 2. Reconciliation with G0 at a glance

**Converge** means adopt G0 as written; **refine** means keep G0's direction with a narrower or
stronger mechanism; **diverge** means a different commitment. The last column names the evidence that
should decide each non-converging row.

| Concern | G0 | Stratified form | Relation | Settled by |
| --- | --- | --- | --- | --- |
| Authored intent vs generated geometry | Recipe is source; meshes are views (§1, §5) | Same | Converge | — |
| Shape of authored source | Versioned operations; inputs may be other operations' output roles (§3) | Part tree of frame-bound contributions in fixed strata | **Diverge** | Harness survival, repair and nesting measures |
| Editing the starting outline after reshaping | Recipe replay keeps the outline editable (§1, §3), while citing Shape Focus, whose §11.1 forbids replaying the original extrusion | Mass/Shape separation gives both: outline stays editable; no reshape becomes a replayed station | Refine | Harness; Focus formative study |
| Order of edits | Operation sequence/DAG | Derived from binding meaning; hierarchy replaces sequence | **Diverge** | Harness expressiveness rate |
| Protected regions | Constrained lattice solve with residual validation (§3–4) | Masks: displacement exactly zero inside; G0's solve as fallback | Refine | Harness transition quality |
| Precision under deformation | Small local solves and checked invariants (§3) | True stratum after Shape, exact by construction | Refine | Increment 2 acceptance |
| Gesture to change | Planner tries the smallest supported change, may add a deformation or operation (§3) | Gesture addresses the visible fact; interpretation returns proposals | **Diverge** | 15-minute study; predictability measures |
| Frozen decisions | Nonlinear solve results frozen as captured inputs (§6) | Every acceptance-time decision recorded, including located datums and topology outcomes | Refine | Cross-engine harness |
| Determinism | Pinned semantics and builds; replay risk named (§6, §10) | Plus numeric discipline: no implementation-approximated maths in canonical paths; confirm, never re-decide | Refine | Cross-engine harness |
| Correspondence | Qualified, graded, explicit repair (§5) | Same, plus label-diff mechanism; shaping is identity-neutral | Converge + refine | — |
| Representation progression | Constructive → functional fields → sampled, SubD, B-rep on demand (§4) | Same; one softness fact unifies crisp and soft joins; n-ary order-independent blending | Converge + refine | Increment 3 |
| Kernels and licensing | Manifold, Clipper2; Fidget conditional; OCCT later ([kernel evidence](https://github.com/Biskiq/spatial-sketch-editor/blob/97c72bfe2a175c061d2cb479e07c4a4e0cbc6261/docs/roadmap/t5-expressive-geometry/g0-architecture-proposal/kernel-evidence.md)) | Same; WASM also serves as the determinism boundary | Converge | — |
| Ownership and F amendments | Six amendment shapes, minimum per first consumer (§6) | Same shapes, staged at most two new interfaces per increment | Converge + refine | Plan review |
| Object Focus | Editing scope plus Camera-evaluated view (§3) | Same; strata appear as kinds of marks, never as a list to reorder | Converge | Prototype |
| Performance and memory targets | Proposed decision targets (§7) | Adopt; add per-stratum invalidation assertions | Converge + refine | — |
| North Star non-goals | Not addressed | Explicit bounded amendment | **Diverge** (scope) | Owner ruling |
| First increment | Complete revisable loop incl. deformation and Focus (§8) | Headless harness first; World Shape, then Focus | **Diverge** (sequence) | Owner ruling |
| Long-term horizons | Draw/reshape → … → explain/exchange (§8) | Essentially the same horizons | Converge | — |

Also adopted without change: G0's explicit tolerance quantities and validation checklist (§4), its
caution on deformation injectivity (§4), worker evaluation and memory discipline (§7), the formative
study criteria (§8) and the licensing paths ([kernel evidence §4](https://github.com/Biskiq/spatial-sketch-editor/blob/97c72bfe2a175c061d2cb479e07c4a4e0cbc6261/docs/roadmap/t5-expressive-geometry/g0-architecture-proposal/kernel-evidence.md)).

## 3. Stratified form

### 3.1 Vocabulary

- **Form** — the authored definition of a native object, held in a Scene definition/resource. It is a
  tree of parts. It is not a T5 document.
- **Part** — a node with its own frame and its own strata. It may contain sub-parts and enters its
  parent as a Mass contribution.
- **Contribution** — a keyed authored element in exactly one stratum: an extruded outline, a revolve,
  a join, a cut, a shaping field, a dimensioned hole, a groove.
- **Frame** — an orthonormal placement in SI units. **Source frames** are computed analytically from
  source: a part frame, a profile segment at a parameter, a sweep station. **Located datums** are
  frames found on evaluated geometry at acceptance and recorded ([§4](#4-law-4-solve-at-acceptance-evaluate-purely)).
- **Fact** — an addressable value with a unit, a frame and a meaning (height, rim radius, width at
  slice, softness, count). Each fact is a Card row and a mark a handle can pull, as
  [PLATE §0.8.4](../../../reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination)
  already requires.
- **Relation** — an explicit constraint among facts and frames (equal, symmetric, distance, aligned,
  on a host). A snap creates none.
- **Edit meaning** — every recorded edit value is **relative** (a delta in its frame: “30 mm
  narrower here”) or **absolute** (a target: “270 mm wide at this slice”). G0 does not distinguish
  them; after an upstream change they mean different things, so the source must say which.

### 3.2 Law 1: dependencies run through frames

Within a revision, a contribution's inputs are other contributions' *source* — profiles, carriers,
facts, source frames — and located datums. Never their evaluated meshes, faces, edges or vertices.
The evaluation graph therefore contains only source and frames, and generated geometry never feeds
back into source evaluation within a revision.

*Why.* Inside a form this eliminates the topological-naming problem rather than mitigating it: nothing
needs a stable generated-face name because nothing refers to generated topology. Correspondence is
still required, but only at the form's boundary — materials by region, attachments, Experience anchors,
Layout hosts — and for Detail, and it becomes a mechanical diff ([§6](#6-identity-and-correspondence)).
Biskiq already works this way where it is most robust: production Openings are cut analytically in
their Wall's own (s, z) frame without a boolean, and the
[wall mesher](../../../../apps/editor/src/lib/layout/wall-mesh-builder.ts) gives every triangle one
role owner rather than an index ([geometry §1](../../../../broad-research/native-creative-depth/geometry-identity-and-performance.md#1-findings-in-brief)).

*How “draw on that face” works.* The hit supplies a point on the evaluated surface. Preparation
records a located datum: its frame, the (contribution, role) it was found on, and source parameters
where the role is analytic. Evaluation uses the recorded frame. After an upstream edit, preparation
re-locates an absolute datum (“centred on the front, 120 mm above the base”), keeps a relative one,
and grades both ([§6](#6-identity-and-correspondence)) — never slides one silently.
[Native Form Lab](../../../../prototypes/native-form-lab/FINDINGS.md) rebased a child's source frame
at its first drawn point for exactly this reason.

*What it costs.* “Fillet that edge of the boolean result” cannot be expressed as a reference to the
edge. It is expressed by the contribution that creates the edge: a join's softness, a cutter's edge
radius, a profile's rim radius — the treatment is modelled into the tool, as Biskiq's Opening reveals
already are. Arbitrary-edge B-rep fillets remain G0's later precision island (G0 §4), inside which
face/edge references are admitted with full lifetime rules.

### 3.3 Law 2: order comes from meaning

Each part evaluates five strata in a fixed order:

| Stratum | Contributions | Composition | Default route |
| --- | --- | --- | --- |
| **Mass** | Outline extrusions, revolves, sweeps, primitive masses, foreign bodies, sub-parts; additive or subtractive | Per join group: additive members united, then subtractive members removed; each join has a softness fact s ≥ 0 | Analytic tessellation; Manifold for s = 0; field island for s > 0 ([§7](#7-representation-kernels-and-performance)) |
| **Shape** | Slice reshapes, bends, tapers, twists, lattice or cage maps; kept-region masks | Rest-space displacement fields, each multiplied by (1 − keep mask) | Closed-form per-vertex maps with deterministic refinement inside reach |
| **True** | Dimensioned holes and recesses, mounting flats, fixture seats, attachment datums | Evaluated after Shape, each in its own datum frame | Manifold in datum frames |
| **Detail** | Grooves, creases, engraving, relief and text along curves on the surface; later authored sampled detail | Bound to (contribution, role, surface parameters) or projected from a frame; weaker survival, declared | Sweeps plus Manifold; displacement later |
| **Finish** | Materials, real-scale UV policy, visibility per role group | No geometric change | — |

Rules that follow:

- **Order-insensitive meaning, canonical arithmetic.** Within Mass, True and Detail, composition does
  not depend on creation order; members evaluate in key order so floating-point results reproduce.
- **Nobody reorders anything.** Where a sequence genuinely matters — shape two masses together, then
  add a third that stays unshaped — it is expressed by hierarchy: the shaped pair becomes a part that
  joins the third in its parent. Selecting several contributions and shaping them together creates
  that part. **Hierarchy replaces history**: a part tree is something people already understand, and
  unlike an operation list it does not grow with every edit.
- **Shaping is identity-neutral.** Shape fields move vertices but cannot change connectivity; a fold
  or self-intersection refuses, as [Shape Focus §9.2](../../../../prototypes/native-object-shaping/UX-SPEC.md#92-explicit-failure-states)
  already specifies. A reshape therefore never creates, retires or splits a region. Only Mass, True
  and Detail edits can.
- **Binding decides the stratum, and the reading chip says which.** A recess drawn freehand into a
  body follows shaping (subtractive Mass); a recess given a dimension stays true (True). Switching is a
  re-read in the same undo step, under the existing Pen rule.

This is how the Shape Focus conflict dissolves. Its [§11.1](../../../../prototypes/native-object-shaping/UX-SPEC.md#111-the-current-body-is-the-starting-point)
refuses to replay an original extrusion over later work; G0 wants the original outline editable after
refinement. In stratified form the outline is a Mass fact and every reshape is a rest-space Shape
field, so editing the outline re-evaluates Mass and re-applies the fields: the outline stays editable,
and no reshape ever becomes a loft station.

**One open sub-choice.** Shape fields can **superpose** over rest coordinates (x′ = x + Σ dᵢ(x)), which
keeps each reshape's meaning independent of edits to the others, or **compose** in sequence, which
mirrors “each edit reads the body as it now is” more literally for large overlapping edits. The Shape
Focus feasibility check composed two maps in sequence ([§11.3](../../../../prototypes/native-object-shaping/UX-SPEC.md#113-tolerances-and-validation));
both fit its UX. Superposition is my hypothesis; it is a harness decision
([§10.1](#101-increment-0-form-semantics-harness)), not an architectural commitment. Laws 1, 3, 4 and 5
hold either way.

### 3.4 Law 3: precision stays above expression

- **True features are exact by construction.** They evaluate after Shape, so “this hole stays 80 mm”
  is met within the declared tolerance however the body was shaped, with no constraint solve. This
  makes PR #200's [“precision can live above the sculpt”](../../../../broad-research/expressive-3d-form-sculpting-hybrid-modeling-2026-10-27.md#precision-can-live-above-the-sculpt)
  a property of evaluation order rather than a solver obligation.
- **Kept means exactly unchanged.** A kept region ([Shape Focus §8](../../../../prototypes/native-object-shaping/UX-SPEC.md#8-preserve-a-part-without-building-a-constraint-system))
  is a rest-space volume captured from a slice side. Every shaping field is multiplied by (1 − m),
  where m = 1 inside and falls to 0 across a validated transition band, so displacement inside is
  zero rather than a residual below tolerance. If the mask prevents a requested contour from being
  met, the candidate refuses or yields visibly; it is never silently shrunk. G0's constrained lattice
  solve (G0 §3) remains the fallback if masks produce visibly worse transitions.
- **Dimensions are absolute.** Typed dimension facts on Mass (outline width) and Shape (width at
  slice) are absolute targets, re-solved during preparation when upstream source changes. Freehand
  pushes are relative.
- **Relations stay compact.** Equal, symmetric, distance and aligned relate facts and frames, never
  surface samples, and are solved in small blocks at preparation — G0's local solve blocks, adopted.
  Symmetry is preferably a frame generator (a mirrored contribution) rather than a constraint.

The creator-facing rule is one sentence: **what you shape bends; what you dimension stays true.**

### 3.5 Parts, repetition and found objects

- **Repetition** is a distribution contribution that generates member frames along a carrier, each
  member a part instance, keyed by count slots or allocated keys exactly as
  [geometry §5.2](../../../../broad-research/native-creative-depth/geometry-identity-and-performance.md#52-recommended-policy)
  proposes. A member override is a keyed record; detaching keeps the member's meaning.
- **Reuse across placed objects** stays T2's definition/instance model. Promoting a part to a
  reusable definition uses the same mechanism; there is no second instancing system.
- **Found objects are Mass contributions with foreign provenance** — imported or AI-generated meshes,
  given no fabricated history (G0 §3, PR #200). Shape, True (when the body is a closed manifold),
  Detail and Finish apply uniformly, so Shape focus works on an imported vase as on a native one. A
  non-manifold import refuses booleans in words and can still be shaped and finished.

### 3.6 One plinth across ten hours

| When | Creator act | Stratum and record |
| --- | --- | --- |
| 0–5 min | Ink an asymmetric outline, read it as Shape, pull height 420 mm and rim radius 12 mm; ink a second overlapping outline and choose **Join** | Mass: extrusions A and B; join softness 0 |
| 5–15 min | Brush walnut on the sides and stone on the top; place an exhibit on the top | Finish by role group; attachment to a relative located datum on A's top cap |
| Hour 1 | In Shape focus, keep the lower 60 mm as **Base**; redraw the front contour to narrow the waist, Local reach | Shape: kept mask K1; field F1 (relative) |
| Hour 2 | Draw a recess on the front, type 600 × 300 mm; attach a light to it | True: recess T1 in an absolute located datum; light bound to T1's frame |
| Hour 3 | Soften the A/B join to 40 mm | Mass: s > 0, field route; region labelled blend of A and B |
| Hour 4 | Draw a groove along a curve on the top | Detail: D1 bound to A's top cap surface parameters |
| Hour 6 | Widen the original outline A by 200 mm | One candidate: Mass re-evaluates; F1 and K1 re-apply in rest space; T1 re-locates and stays exactly 600 × 300; the light follows T1; D1 is re-projected with its deviation shown; the exhibit's datum maps to A's surviving top cap; materials are unchanged. The ripple reports Keeps · Moves · Projected before Apply; one undo step |

G0's recipe could reach the same result, and G0 also prefers anchors and datums. The difference is
that here it is guaranteed by structure: only the groove referred to generated surface, and it alone
is graded below Strong.

## 4. Law 4: solve at acceptance, evaluate purely

Preparation — F4 candidate preparation, possibly in a worker — may run solvers, locate datums,
interpret gestures and detect component splits. Its results are recorded as captured values in the
candidate. Accepted source therefore contains no unsolved relation and no live reference to generated
geometry, and evaluation in the editor, Preview, visitor runtime and release lowering is a pure
function: source plus evaluator version gives geometry plus region labels.

Preparation records:

- solved fact values for relations and absolute targets;
- located datums;
- **identity-bearing topology outcomes** — when a Mass or True edit splits a region into components or
  a body into pieces, preparation allocates never-reused component keys and records the mapping. Later
  evaluations *confirm* the recorded outcome and raise a typed mismatch diagnostic if an evaluator or
  browser disagrees. They never re-decide identity;
- survival grades for affected references ([§6](#6-identity-and-correspondence)).

This generalizes G0's frozen nonlinear solves (G0 §6) to every acceptance-time decision on which
identity or downstream meaning depends. An upstream edit re-solves dependent absolute targets and
re-locates absolute datums *inside the same candidate*, so all consequences are previewed together and
accepted as one undo result, consistent with [shared authoring operations](../../../reference/north-star.md#shared-authoring-operations).
Relative contributions simply re-apply.

**Numeric discipline.** JavaScript's transcendental `Math` functions have implementation-dependent
precision, so “different browsers can give a different result”, and even one engine can differ across
operating systems and architectures ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math)).
WebAssembly arithmetic uses IEEE 754 round-to-nearest-even with non-determinism confined to NaN
payloads ([WebAssembly numerics](https://webassembly.github.io/spec/core/exec/numerics.html)), plus the
separately specified relaxed-SIMD instructions; it has no transcendental instructions, so a compiled-in
math library returns the same bits in every engine. Therefore:

- canonical evaluation and preparation-time decisions run either in WebAssembly without relaxed SIMD,
  or in TypeScript restricted to addition, subtraction, multiplication, division and square root in a
  fixed order;
- reach bands use polynomial falloffs, such as a quintic smoothstep with zero slope at both ends,
  instead of Shape Focus's prototype raised cosine ([§7.3](../../../../prototypes/native-object-shaping/UX-SPEC.md#73-reach-is-part-of-the-edit));
  revolve angles use a deterministic routine or values recorded at preparation.

This turns cross-browser address determinism — untested by Native Form Lab — into a designed and
testable property, and gives G0's “replay changes after browser/kernel upgrade” risk (G0 §10) a
mechanism: recorded outcomes plus confirm-and-diagnose. Byte-level source guarantees stay separate from
geometric tolerance, and an evaluator upgrade that changes a recorded outcome is a declared migration,
as G0 §6 requires. The visitor runtime never needs a solver.

## 5. Law 5: gestures address facts; interpretation proposes

G0's central product hypothesis is that a small vocabulary of creative intentions drives many
operations, with a planner that “first tries the smallest supported change to existing controls” and
otherwise “may propose an additional deformation or constructive operation” (G0 §3). That puts an
inverse-modelling search on the path of ordinary edits; G0's own first risk is unpredictable inverse
modelling (G0 §10). I would invert the default:

- **A gesture changes what it visibly touches.** Pulling a height ray changes height. Redrawing a
  contour at a slice creates or edits a Shape field with its reach shown. A closed outline drawn across
  a body offers Join, Cut or Separate on the reading chip; a stroke on a face offers recess (follows
  shaping), exact cut (stays true) or groove. This is PLATE's ratified law — “dragging a legible mark
  pulls the fact it addresses”, one Pen with readings, a chip only for ambiguous strokes.
- **Interpretation returns a proposal.** “Wider, but keep the mount”, “make these flow together”, an
  agent's brief or an AI generator yields explicit contributions and fact changes, shown in pencil as
  in [Vellum](../../../../prototypes/p3-vellum/DESIGN.md) with affected scope, survival grades and lost
  guarantees, then accepted or amended like any candidate. It is never required for ordinary editing.
- **One typed intent surface** serves the UI, the harness and agents: add a contribution, set a fact,
  reshape at a slice, keep or release a region, join, set softness, locate a datum, make a part,
  distribute, consolidate, propose. That is the North Star's
  [agent surface](../../../reference/north-star.md#ai-and-agent-surface) applied to form.

*Architectural consequences.* Legibility becomes a schema requirement: each fact carries a unit, a
frame and enough to draw its handle. Edit latency and predictability do not depend on a search. AI
output becomes compact, order-free contribution sets, which are far easier to generate, diff and review
than an ordered history — PR #200's case for generating “editable construction, not a final mesh”.

*Cost.* G0's single-gesture “wider while keeping the mount” becomes keep plus pull unless the assist
proposes it. Shape Focus already designs it as two acts, and I think explicitness serves both the
15-minute and the ten-hour creator.

## 6. Identity and correspondence

Convergent with G0 §5 and [geometry §5.2](../../../../broad-research/native-creative-depth/geometry-identity-and-performance.md#52-recommended-policy):
durable references prefer authored concepts, generated indices never establish identity, removed or
ambiguous targets keep their original reference with a typed repair state, keys are allocated
monotonically and never revived, Undo restores exact keys, copies re-root. Stratified form adds:

- **Region labels.** Every output triangle carries (part path, contribution key, role key), propagated
  through Manifold's original and face identifiers. A soft join's transition carries its contributor
  set, so “the blend between A and B” is a role a material can target rather than a false single parent.
- **Correspondence is a diff.** Between accepted revisions it is the difference of label sets plus the
  recorded component splits of [§4](#4-law-4-solve-at-acceptance-evaluate-purely). Geometric matching
  may propose repair candidates; it never establishes continuity.
- **Graded survival** ([PR #200](../../../../broad-research/expressive-3d-form-sculpting-hybrid-modeling-2026-10-27.md#revision-survival-should-be-graded-not-binary)):
  **Strong** — label and source persist; **Mapped** — a declared continuation such as a profile segment
  split publishing one segment to two; **Projected** — Detail re-projected with a stated deviation;
  **Invalidated** — retired, the reference keeps its last pose and becomes a repair state. Every label
  survives a Shape edit as Strong ([§3.3](#33-law-2-order-comes-from-meaning)).
- **Coarse by default.** References default to the object, then a role group, then a role; sub-role
  targets only on explicit selection. The harness logs actual granularity, keeping PR #192's premise
  test alive before investing in fine-grained tracking.

## 7. Representation, kernels and performance

Convergent with G0 §4, §7 and the kernel evidence: Manifold (Apache-2.0) first for crisp solids and
True cuts; Clipper2 (BSL-1.0) for new planar offsets; TypeScript curves, frames and sweeps, whose
historical probes cost under a millisecond for positions ([geometry §1](../../../../broad-research/native-creative-depth/geometry-identity-and-performance.md#1-findings-in-brief));
functional fields as the soft-join substrate, starting from a permissive route such as Manifold's
level-set facility, with Fidget conditional on a weak-copyleft ruling; OCCT only for a named precision
consumer; independent output validation; no product-licence decision driven by geometry. Refinements:

- **One softness fact unifies crisp and soft joins.** The creator sees one concept, “join, softness s”.
  s = 0 routes to Manifold; s > 0 routes to the field island. Softness exists in the source schema from
  the first increment, so soft joins later arrive as an evaluator route rather than a source migration.
  Role vocabulary must be identical on both routes; the jump at s → 0⁺ is a declared tessellation
  discontinuity, never an identity change.
- **n-ary, order-independent blending.** Pairwise smooth-minimum operators are commutative but in
  general not associative, so three softly joined masses would depend on evaluation order. A soft join
  group uses a symmetric n-ary operator evaluated in key order. The operator is an implementation
  choice for the field spike; order independence is the architectural requirement.
- **Shape needs no kernel.** Shaping fields are closed-form per-vertex maps with deterministic
  refinement inside reach bands. They apply to Manifold output, contoured field output and foreign
  meshes alike, and stay in-house.
- **WebAssembly is also the determinism boundary** ([§4](#4-law-4-solve-at-acceptance-evaluate-purely)),
  another reason beyond speed and licence to keep canonical solid evaluation in Manifold.

**Performance.** Adopt G0's proposed decision targets, object envelope, stress case and memory target
(G0 §7) and S06's [measurement method](../../t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md).
Strata add a structural locality claim that work counters can assert:

| Edit | Recomputes | Must not recompute |
| --- | --- | --- |
| Finish | Material binding | Any geometry |
| Shape field or kept region | That part's Shape, True and Detail | Mass |
| True feature | That part's True and Detail | Mass, Shape |
| Detail | That part's Detail | Mass, Shape, True |
| Mass | That part's strata and its parent's join; preparation re-solves absolute targets | Sibling parts |
| Instance transform | Nothing (G0 §7) | Shared definition geometry |

Honest worst cases: a Mass edit at the root of a deep part tree is global for that form, and True cuts
on a densely refined shaped mesh may dominate Manifold time. Both are harness measurements, not
assumptions.

## 8. Integration with existing authorities

Convergent with G0 §6's ownership table: Layout keeps architecture and the canonical compiler, Scene
owns placed objects and definitions, F4 owns acceptance, the shared Stage and renderer stay single,
Camera stays the viewing authority, T4 ships prepared derivatives without editor machinery. Additions:

- **Scene owns the whole form** — part tree, strata, facts, relations and recorded outcomes — inside a
  definition/resource, consistent with the [Scene destination](../../../reference/components/scene-content.md#ratified-destination-not-shipped).
- **One grammar, two owners.** Layout families (canopies, shells, vaults, roofs over curves) may reuse
  the stratum evaluator modules and contribution grammar inside the canonical compiler while keeping
  Layout ownership — PR #192's [profile, carrier and rule](../../../../broad-research/native-creative-depth/synthesis-and-direction.md#4-one-creative-language-profile-carrier-and-rule)
  insight extended from families to free composition.
- **Object Focus** is an editing scope and Camera-evaluated view over the same definition, as in G0.
  Inside it, strata become visible as kinds of marks — outlines, reach bands, kept hatching, true
  datums, detail curves — never as a list.
- **F amendments are staged** so that no increment needs more than two new cross-domain interfaces
  ([§10.2](#102-production-increments)). G0's six amendment shapes remain the target set.

## 9. Scope: the North Star amendment T5 needs

The North Star's [permanent non-goals](../../../reference/north-star.md#permanent-non-goals) exclude
“general-purpose DCC-style mesh editing, sculpting … as the normal editor workflow” and list sculpting
and general-purpose geometry modelling as likely external territory. The
[T5 direction](../../../reference/decisions/t5-g0-approval-2026-10-27.md) (expressive 3D modelling,
capability not limited by today's prototypes) and G0's horizons (“spend hours shaping surface flow,
creases, engraved strokes and local detail”) approach that line without amending it. Because the
ratified record outranks track text, the ambiguity would resurface in every T5 plan review.

**Proposed amendment shape**, for an owner ruling (nothing is drafted into the North Star):

- **In scope:** expressive native form as retained, revisable semantic contributions — masses, joins,
  cuts, shaping fields, true features, surface-bound detail — owned by Scene definitions (and Layout
  families by role), edited in World and Object Focus.
- **Still non-goals:** vertices, edges and faces as authored source; brush sculpting whose only result
  is a mesh; retopology; hand UV unwrapping; rigging and character animation; fabrication
  documentation.
- **Admitted with bounds:** authored sampled detail as a consolidated, bounded detail resource inside a
  native form, never as the object's foundation.
- **Admission test** extended to: “…or creates native form whose meaning is retained as revisable
  contributions.”

## 10. Sequencing and initial deliverables

### 10.1 Increment 0: form-semantics harness

**Purpose.** Falsify the riskiest semantic claims of *both* proposals cheaply — before any F interface
is drafted, any UI is built or any dependency is admitted to production — and give reconciliation one
shared set of numbers. G0 wanted its first production increment to test revision survival; this tests
it sooner, at a fraction of the cost, without production commitments.

**Deliverable** (requires its own authorization; this proposal authorizes nothing): a headless,
browser-run TypeScript harness in the prototypes tree, outside production packages, containing:

1. draft source types for stratified form — not a codec — and a G0-style ordered-recipe encoding of
   the same capabilities;
2. a minimal pure evaluator: analytic extrude, revolve and sweep; Manifold for s = 0 joins and True
   cuts, under a spike-only admission request (Apache-2.0, permissive); banded planar and lattice Shape
   fields; kept masks; region labels;
3. the typed intent surface of [§5](#5-law-5-gestures-address-facts-interpretation-proposes) driving both
   encodings;
4. a revision corpus of about twelve objects from existing evidence — G0's plinth and chair, PR #200's
   plinth after several hours, Shape Focus walkthroughs B and D, PR #192's lamp, vessel and display bay,
   an imported vase — each with scripted hostile revisions from PR #200's
   [topology-destruction list](../../../../broad-research/expressive-3d-form-sculpting-hybrid-modeling-2026-10-27.md#test-semantic-anchors-through-topology-destruction)
   and upstream outline edits after 20, 50 and 100 refinements;
5. runs in Chromium, WebKit and Gecko through the repository's existing Playwright tooling.

**Measures.** Survival-grade distribution of every reference after each upstream edit; repairs per 100
edits; silent retargets (must be zero); recorded-outcome mismatches across engines (must be zero);
source size and part-nesting depth over long sequences; share of corpus steps each encoding can
express; per-stratum evaluation time and cache reuse; refusal and fold rates of superposed versus
sequential Shape fields; transition quality of masks versus constrained solves at kept boundaries.

**Decisions it feeds.** Superposition or composition; whether fixed strata survive
([§12](#12-tradeoffs-risks-and-falsifiers)); default reference granularity; the reconciled
source-structure choice between this proposal and G0. It is neither a production increment nor a
creator study.

### 10.2 Production increments

Each still requires owner approval, a real consumer, owning-track and F review and a released plan.

| Increment | Consumer and deliverable | New interfaces | Acceptance and decision |
| --- | --- | --- | --- |
| **1. Shape in World** | T2 creator inks an outline, reads it as **Shape** (already a ratified reading), pulls height and rim radius, joins or cuts a second outline crisply, assigns materials by role group; Save, reopen, Undo. World only | F.2 native-form definition codec (Scene); F.1 role-group references with typed resolution results | Production codec, Stage and Save path; zero silent retargets; outline edits after joins keep labels Strong or Mapped; G0's 15-minute formative criterion as a baseline; G0's performance targets |
| **2. Shape focus** | Reach-band reshapes, kept parts, True features, located datums carrying an attachment; editing the starting outline after reshaping | Additive AM-5 review for the Focus scope, view and inverses; an F.4 async-preparation scope only if the existing entry cannot express it | Kept displacement exactly zero; True dimensions within declared tolerance after any shaping; empty label diff for every reshape; preview equals accepted result |
| **3. Soften and carve** | Softness > 0 through the field island; carving; sweeps along drawn carriers | None cross-domain (new contribution versions inside the F.2 unit); licensing ruling only if Fidget is pursued | Identical role vocabulary at s = 0 and s > 0; permuting keys gives identical bits; G0's functional-versus-sampled comparator |
| **4. Multiply craft** | Parts, distributions with slots, shared definitions, one admitted Layout host relation | F.1 member-slot references; F.3 fact outputs for variants and Experience | G0 increment 4's 20 → 19 → 20, deletion, host-split, detach and mixed-history fixtures |
| **5. Finish for hours** | Detail stratum; **consolidation** (flatten many Shape fields into one authored displacement resource, loss disclosed); long-session corpus; prepared delivery | F.2 authored detail resource; F.5 prepared geometry derivative | G0 increment 5's ten-hour-equivalent corpus plus PR #200's revision-distance metric |

**Why thinner than G0's first increment.** G0's increment 1 bundles profile construction, deformation,
a protected region, a material region, an anchor, Object Focus and Save, touching most of its six
amendment shapes at once. Splitting it reduces review blast radius, puts a production capability —
the Shape reading PLATE already ratified — in creators' hands sooner, and leaves the revision-survival
risk to increment 0, where it is cheaper to falsify.

## 11. Capability trajectory

These are horizons, not phases. The compounding test is that **no horizon introduces a new source
model**: each adds contribution kinds, evaluator routes or interfaces inside the same laws.

| Horizon | What a creator gains | What is added |
| --- | --- | --- |
| **Draw a thing** (minutes) | A distinctive plinth, sign, vessel or display from a drawn outline, joined and cut, finished by role | Mass extrude/revolve, crisp joins, Finish |
| **Shape it** (first hour) | Waists, leans and bulges with visible reach; a kept base; exact recesses and seats | Shape fields, masks, True stratum, located datums |
| **Soften and carve** (hours) | Masses that flow together, carved hollows, swept arms and rails | Field island, sweeps on drawn carriers |
| **Multiply craft** | One custom part becomes shelving, a light rail, a family of fixtures; revise one, update many | Parts, distributions, shared definitions, Layout host relations |
| **Finish for hours** | Creases, engraving, relief, text, local texture; long sessions stay fast and reversible | Detail stratum, consolidation, authored sampled detail |
| **Compose environments** | Canopies, shells, vaults and landscape forms that belong to the architecture | Layout families reusing the grammar inside the canonical compiler |
| **Explain, vary, exchange** | Variants as alternative fact sets; parts explained in Experiences; AI proposes whole forms as editable contributions; specialist handoff | F.3 fact outputs, role-addressed Presentations, proposal assist, glTF out; a precision island only for a named consumer |

## 12. Tradeoffs, risks and falsifiers

What stratified form gives up relative to G0: an arbitrary operation graph, single-gesture inferred
edits, and picking generated edges for treatment. What it gains: identity that cannot break inside a
form, exactness under shaping by construction, order-free source that agents can generate and people
can review, structural cache locality, and a concrete replay-determinism mechanism.

| Risk | Earliest discriminating proof | If wrong |
| --- | --- | --- |
| Fixed strata are too rigid | Harness: share of corpus steps needing nesting deeper than two, or inexpressible | Adopt G0's general recipe with strata as default ordering; keep Laws 1, 3, 4 and 5 |
| Deep part trees become history in disguise | Harness nesting depth over long sequences; Focus formative study | Consolidation of subtrees; reconsider hierarchy-by-selection |
| Superposed Shape fields feel wrong | Harness fold rates; Focus formative comparison | Sequential composition |
| “Bends versus stays true” is not understood | 15-minute study | Fix the default per reading; expose the distinction only in Focus |
| Absolute re-solve surprises creators | Upstream-edit study after refinement | Relative by default; absolute only for typed dimensions |
| Located datums are invalidated too often | Harness repairs per 100 edits | Add G0's surface-relative transport for Detail-class datums |
| Masks crease at kept boundaries | Harness transition quality | G0's constrained solve in the transition band |
| Numeric discipline is too costly in TypeScript | Harness timing with and without discipline | Move canonical evaluation wholly into WebAssembly |
| Frame-only dependencies are too weak for real attachment needs | Reference-granularity logs | Admit surface-bound datums with Projected grade, explicitly |
| North Star amendment refused | Owner ruling | Bound T5 to PR #192's families plus Shape focus; stratified form still applies with Mass, Shape and True only |

## 13. Established now versus emerging through evidence

**Architecturally establish at the owner ruling** (each reversible only by a deliberate decision):

1. Authored and generated geometry stay separate; native forms are never mesh-sourced; foreign bodies
   are explicit.
2. No evaluation-time dependency on generated geometry; located datums are recorded (Law 1).
3. A part tree evaluated in meaning-ordered strata with canonical key-ordered composition; hierarchy,
   not reorderable history (Law 2), subject to the harness falsifier.
4. “Kept” means exactly unchanged and dimensioned True features evaluate after shaping (Law 3).
5. Solve at acceptance; recorded identity-bearing outcomes; deterministic numeric discipline (Law 4).
6. Relative or absolute edit meaning as a source-level field.
7. Gestures address facts; interpretation emits explicit proposals; one typed intent surface for UI and
   agents (Law 5).
8. Region labels, label-diff correspondence, graded survival and typed repair states.
9. Softness as a join fact from the first schema; order-independent soft blending.
10. Scene owns the form; Layout reuses the grammar by role; F4 acceptance; no T5 document; staged F
    amendments.
11. The North Star scope boundary of [§9](#9-scope-the-north-star-amendment-t5-needs).

**Let emerge through prototyping and implementation evidence:**

- superposition or sequential composition of Shape fields;
- the shaping-field families (banded planar, lattice, Kelvinlet, ARAP) and their falloffs;
- masks or constrained solves at kept transitions;
- each reading's default between “follows shaping” and “stays true”; how strata are drawn in Focus;
  whether parts are explicit objects or emerge from multi-selection;
- functional or sampled fields, and Manifold level-set or Fidget;
- reference granularity and whether sub-role tracking is ever needed;
- consolidation triggers and what metadata survives them;
- envelope numbers, budgets and refinement density;
- the scope and form of the interpretation assist;
- whether a B-rep precision island is ever justified.

## 14. Evidence and stopping point

Read at merged `main` `83c79c40`: the North Star and its convergence destination, the architecture and
F contracts, the Scene destination, PLATE §0.8.4, the T5 charter, commission and approval, the
[native creative depth package](../../../../broad-research/native-creative-depth/synthesis-and-direction.md)
(PR #192), [Native Form Lab](../../../../prototypes/native-form-lab/FINDINGS.md) (PR #194),
[Shape Focus](../../../../prototypes/native-object-shaping/UX-SPEC.md) (PR #196), Vellum, the
[expressive form study](../../../../broad-research/expressive-3d-form-sculpting-hybrid-modeling-2026-10-27.md)
(PR #200), and G0 with its kernel evidence (PR #202 at `97c72bfe`). External claims new to this
proposal are limited to the JavaScript and WebAssembly numeric semantics cited in
[§4](#4-law-4-solve-at-acceptance-evaluate-purely). Every other kernel, licensing and performance
claim is G0's or its cited records'. Stratified form's advantages are analysis; the harness of
[§10.1](#101-increment-0-form-semantics-harness) is how they should be tested.

This proposal adds one Markdown file under the commission's `g0-*` convention. It performs no
prototype, benchmark, dependency installation, production change, phase registration, contract
ratification or roadmap reconciliation, and it stops here for peer reconciliation and owner review.
