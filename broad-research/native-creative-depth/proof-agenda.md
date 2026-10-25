# Native creative depth: feasibility and proof agenda

**Research date:** 25 October 2026  
**Status:** Proposed proofs for future commissioning. None was executed as a product prototype during this research, and none is authorized by this document.  
**Package:** [Native creative depth](./README.md) · labels follow the package's [evidence conventions](./README.md#3-how-to-read-the-evidence)

These proofs test the [synthesis](./synthesis-and-direction.md) before any production commitment. They refine the original study's [Experiments 1–6](../spatial-modeling-depth-research-2026-10-25.md#11-a-bounded-research-and-prototype-program) and do not replace them. Each proof below names the experiment it sharpens.

The roadmap allows research, documentation and bounded disposable probes within a commissioned step ([production hold](../../docs/roadmap/README.md#production-implementation-hold)). Each proof here would need such a commission.

## 1. Portfolio, ranked by decision value

| Rank | Proof | Decision it unblocks | Refines | Size |
| --- | --- | --- | --- | --- |
| 1 | [P1](#p1-a-convincing-place-in-fifteen-minutes) A convincing place in fifteen minutes | Whether forms, presentation or content-in comes first | Exp. 1 | M |
| 2 | [P3](#p3-profile-families-stay-editable) Profile families stay editable | Whether profile, carrier and rule is the right first native form | Exp. 3 | M |
| 3 | [P5](#p5-identity-through-ordinary-revision) Identity through ordinary revision | Whether the role-address policy can be ratified | §8.2 | S–M |
| 4 | [P2](#p2-draw-on-things-or-in-space) Draw on things, or in space | How much arbitrary-plane drawing to build | Exp. 2 | M |
| 5 | [P4](#p4-a-deep-recipe-railing-and-stair-with-transitions) A deep recipe with transitions | Whether recipes earn their cost, and how the escape works | Exps. 4 and 5 | M–L |
| 6 | [P7](#p7-material-level-detail-in-motion) Material-level detail in motion | Whether presentation fakes are legitimate depth in a real-time viewer | Exp. 1 | S |
| 7 | [P8](#p8-found-objects-edit-kit-and-re-import) Found objects: edit kit and re-import | The Scene transform contract; re-import ownership | — | M |
| 8 | [P6](#p6-evaluator-placement-and-the-kernel-question) Evaluator placement and the kernel question | Whether to commission a Manifold spike, and where evaluation runs | Exp. 6 | M |
| 9 | [P11](#p11-where-creators-time-actually-goes) Where creators' time actually goes | Confirms or falsifies the central thesis | — | S–M |
| 10 | [P9](#p9-reference-granularity-log) Reference granularity log | Whether boolean-split tracking is ever needed | — | S |
| 11 | [P10](#p10-agents-operate-families) Agents operate families | Whether family operations serve agents | North Star agent proof | S–M |

**I** P1, P3 and P5 together answer the central question. Can a creator make a convincing place quickly, and revise it for hours without losing work? P2 and P4 decide the shape of the interaction and the recipe layer. The rest reduce specific risks.

## 2. Shared method

- **Reference hardware.** Hard rows run on the reference machine, an M2 with 16 GB. Reference laptops A (x86, 8 GB) and B (M1, 8 GB) serve as stress tests. Follow the S06 owner-run benchmark method and pass limits. Report boundary-inclusive latency: input, evaluation, transfer, buffer upload and visible frame. See the [performance foundation decision](../../docs/reference/decisions/performance-foundation-authorization-2026-10-24.md).
- **Budgets.** Compare against the ratified contract:
  - drag input to matching preview, p95 ≤33, 50 and 100 ms at S, M and L;
  - per-edit Layout evaluation ≤4, 8 and 16 ms;
  - commit ≤100 ms;
  - visitor first-load JavaScript ≤250 KiB brotli.

  These are comparison points, not new gates.
- **Participants.** Use 8–12 people per study, drawn from:
  - photographers and educators;
  - exhibition and interior creators;
  - spatially experienced generalists.

  Small samples find usability failures. They do not estimate success rates.
- **Truthfulness.** Prototypes must keep preview equal to acceptance. Any approximation is labeled on screen. The original study's [§8.4](../spatial-modeling-depth-research-2026-10-25.md#84-cheap-previews-must-remain-truthful) covers this.
- **Disposability.** A probe lives outside production packages. It adopts no dependency into the product and writes nothing to persisted formats.
- **Common fixtures.** Use the geometry fixture set in [§4](#4-shared-geometry-fixtures) wherever a proof touches evaluation.

## 3. The proofs

### P1. A convincing place in fifteen minutes

- **Question.** With context forms available, what dominates the first fifteen minutes: drawing, custom forms, placement, or presentation?
- **Setup.** Two prototype conditions with the same tasks:
  - **A:** the full loop, with Walls, hosted Openings, a Shape extrusion with rounded rim, a trim-on-room family, a lighting look, a saved view and a still capture.
  - **B:** the same, without the Shape and trim families. Participants use supplied assets instead.
- **Tasks.** The pavilion scenario in [synthesis §8](./synthesis-and-direction.md#8-the-complete-experience-create-revise-finish-communicate), minutes 0–15. Include the curved wall with arched windows, because it is the most documented SketchUp pain.
- **Measures.**
  - time to first coherent scene;
  - time split by activity;
  - corrective operations;
  - help requests;
  - external tools wanted;
  - independent ratings of composition, lighting and coherence against a stated rubric.
- **Falsified if** condition A shows no gain over B, or presentation setup consumes most of the time in both.
- **Response.** Put presentation defaults and content-in ahead of new families.

### P2. Draw on things, or in space

- **Question.** Do readings plus picked carriers cover ordinary drawing needs, or do creators need arbitrary workplanes and free 3D chains?
- **Setup.** Three conditions:
  - **Readings only:** ground, raised sheet, Face, Unroll, Section and Edit shape, with carriers picked from hosts.
  - **Readings plus explicit workplanes:** visible planes with a lock.
  - **Readings plus inferred three-dimensional chains.**
- **Tasks.**
  - A molding along a room;
  - a rail along a stair;
  - a circle ornament on a curved wall;
  - a tilted display panel;
  - a canopy edge between two posts;
  - a path that must stay nonplanar linework.

  Run them on a trackpad, with oblique cameras, near-edge-on planes and occlusion.
- **Measures.**
  - mistaken-plane commits;
  - recovery time;
  - exact snaps achieved;
  - preview-equals-acceptance violations;
  - which tasks were impossible in each condition.
- **Falsified if** two or more ordinary tasks are impossible with readings only, or they need awkward workarounds.
- **Response.** Admit explicit workplanes for those tasks only.

### P3. Profile families stay editable

- **Question.** Can extrude, revolve and sweep families keep their source editable, keep polish and identity through substantial revision, and feel no harder than direct modeling?
- **Setup.**
  - A plinth by extrusion, with holes and a rounded rim.
  - A lamp by revolve, with eight radial ribs.
  - A baseboard swept along a curved room.
  - Profile rounding on all three.
  - Comparison: the same objects built by direct solid editing in a reference tool.
- **Revisions.**
  - Add a profile point.
  - Change the rim radius past half the feature width, which should be refused.
  - Reverse the carrier.
  - Move the Wall under the baseboard.
  - Change the revolve to 270°.
  - Swap the baseboard profile for a design option.
- **Measures.**
  - edits completed;
  - repair actions;
  - refusals, and whether participants understood them;
  - material and attachment survival;
  - save/reload determinism;
  - one undo step per accepted edit.
- **Falsified if** retained families create more repair than they save, or users routinely escape a family to finish ordinary edits.
- **Response.** Narrow the families and strengthen import and escape.

### P4. A deep recipe: railing and stair with transitions

- **Question.** Does one deep recipe built from the language justify its cost? Does the escape that keeps meaning work?
- **Setup.**
  - An L-shaped stair with a landing.
  - A railing derived from the walking line, with an upright or pitch-normal frame-mode toggle.
  - Balusters distributed with anchors at corners.
  - A glass infill span.
  - A manufacturer baluster imported into the post slot.
- **Revisions.**
  - Change the total rise.
  - Drag the run end to add treads while keeping the height.
  - Turn the landing.
  - Make one baluster custom.
  - Suppress member 7.
  - Change the count from 20 to 19 and back to 20.
- **Measures.**
  - time against a SketchUp-plus-extensions baseline built by an expert;
  - validation messages understood;
  - override survival;
  - whether the "custom" member still reads as part of the railing.
- **Falsified if** participants abandon the recipe for manual building on ordinary variations (the Archicad pattern), or transitions fail.
- **Response.** Keep the primitives and drop the recipe.

### P5. Identity through ordinary revision

- **Question.** Does the [role-address policy](./geometry-identity-and-performance.md#52-recommended-policy) meet its twelve falsification tests at acceptable cost?
- **Setup.** Run tests 1–12 from [geometry §5.3](./geometry-identity-and-performance.md#53-falsification-tests) against the P3 and P4 prototypes. Include the boolean test only if P6 has run.
- **Measures.**
  - pass or fail per test;
  - overhead of publishing correspondence, against the evaluation budget;
  - unresolved references per 100 scripted edits;
  - time to repair.
- **Falsified if** any test shows a silent retarget, or overhead dominates evaluation.
- **Response.** Fix the policy before any architecture cycle ratifies it.

### P6. Evaluator placement and the kernel question

- **Question.** Can plain-TypeScript evaluators meet the budgets in real browsers on 8 GB laptops? Does Manifold earn an editor-only spike for explicit booleans?
- **Setup.**
  - **Contenders.**
    - A: TypeScript domain generators.
    - B: Manifold in a worker, with the independent validator.
    - C: three-bvh-csg as a baseline.
    - D, optional: Truck through a WebAssembly build.
    - OCCT as a non-shipped reference ceiling.
  - **Browsers:** Chrome, Safari and Firefox.
- **Measures.**
  - p50, p95 and p99 latency per operation and end to end;
  - cold start with and without cached compilation;
  - lazy-chunk bytes, confirming nothing reaches visitor first-load;
  - heap high-water mark over a ten-minute session;
  - validity checks;
  - refusal quality, where a silent wrong result counts as a severity-zero failure;
  - determinism across browsers and CPU architectures;
  - provenance fidelity after 1, 5 and 20 chained operations.
- **Falsified if** TypeScript generators miss budgets on laptop A, or Manifold's validated path cannot meet commit latency or memory.
- **Response.** Either case is a real input to the Rust/WASM gate rather than a reason to bypass it.
- **Earlier evidence.** The local Node probes reported in [geometry §3](./geometry-identity-and-performance.md#3-operation-feasibility) are the starting hypothesis.

### P7. Material-level detail in motion

- **Question.** Do the experts' presentation fakes hold up when a visitor moves freely in Biskiq's real-time runtime? The fakes in question are alpha cut-outs, perforated materials, photo standees and decals.
- **Setup.**
  - A perforated screen with dappled shadow, rendered with an alpha-tested depth material.
  - Two photo standees of people.
  - A decal sign on a curved fascia.
  - The same scene with real geometry as a control.
- **Measures.**
  - viewer detection of fakes along a walkthrough;
  - frame time on laptop A;
  - shadow correctness;
  - authoring time against real geometry.
- **Falsified if** fakes read as flat or broken in common visitor paths.
- **Response.** Restrict fakes to distant or lateral roles, and invest in cheap real geometry for hero objects.

### P8. Found objects: edit kit and re-import

- **Question.** What light edits do creators need on imported and AI-generated objects? Can re-import keep placement and finishes?
- **Setup.**
  - A supplier vitrine GLB and an AI-generated chair.
  - Available edits:
    - scale to a dimension, uniform or per axis;
    - mirror;
    - array;
    - re-pivot;
    - re-material by material slot;
    - a section view.
  - Then re-import a revised vitrine with a renamed node and an added part.
- **Measures.**
  - which edits are used and wanted;
  - edits that would need geometry booleans;
  - survival of placement and finishes through re-import;
  - clarity of the diff.
- **Falsified if** ordinary tasks need booleans or topology edits on found objects. That would push toward the gated Manifold path, or toward external tools.

### P9. Reference granularity log

- **Question.** How fine-grained are the references creators actually make?
- **Setup.** Instrument the P3 and P4 prototypes. Log each persisted reference as object, role group, single role or sub-role.
- **Decision rule.** Proposed, not sourced: if nearly all references are object or role-group, defer boolean-split identity tracking.
- **Cost.** Very low. It rides on other proofs.

### P10. Agents operate families

- **Question.** Can an agent use family operations, through the same typed operations as people, to complete the pavilion's family steps?
- **Setup.** Use the ratified [agent proof](../../docs/reference/north-star.md#ai-and-agent-surface) shape:

  inspect → propose → apply typed operations → preview → validate → refine

  Run it over P3 and P4. Tasks:
  - make three plinths 1,200 × 600 mm;
  - distribute twelve lights on the curved wall;
  - change the railing count;
  - respond to a refusal.
- **Measures.**
  - task success;
  - refusals the agent understood;
  - operations that needed a human.
- **Falsified if** the agent needs raw geometry mutation. That would show the operation design is too low-level.

### P11. Where creators' time actually goes

- **Question.** How do target creators split effort between modeling custom forms, sourcing objects, placing them, finishing, and presenting? How much of their custom form depends on context?
- **Setup.**
  - Interview 8–12 creators from the target groups.
  - Run a diary study of one real project each.
  - Collect an artifact audit of finished projects, classifying each visible object as context-dependent native, context-independent sourced, or modeled elsewhere.
- **Why it matters.** No survey anywhere quantifies the library-versus-modeled share. This is the central thesis's largest evidence gap.
- **Falsified if** context-independent bespoke modeling dominates.
- **Response.** General modeling depth would then deserve reconsideration, through the owner's scope decision.

## 4. Shared geometry fixtures

These fixtures come from the kernel research behind [geometry §3](./geometry-identity-and-performance.md#3-operation-feasibility). They are regenerated from authored parameters, never from stored meshes.

| Fixture | Content |
| --- | --- |
| F1 Wall with openings | 1, 10, 40 and 200 openings. Built three ways: profile extrusion with holes, batch difference, and sequential differences |
| F2 Coincidence suite | Stacked boxes; an equal-height through-hole; A minus A; near-coincident offsets below tolerance (Manifold #1888); coincident-face shards; slabs flush with walls |
| F3 Curved booleans | Sphere and cylinder at 8,000, 32,000 and 131,000 triangles |
| F4 Spiral rail | A helix sweep with a 24-sided profile at 500, 2,000 and 8,000 samples; a ruled strip between rails with unequal sample counts; closed-loop twist; refusal when the profile radius exceeds the curvature radius |
| F5 Lofts | Square to circle (4 versus 64 vertices); L-shape to rectangle; three sections with twist; different hole counts, which should be refused |
| F6 Rounding | Profile fillet plus extrusion, against mesh smoothing, against a reference 3D fillet. Measure silhouette deviation from the true radius |
| F7 Text and SVG | Glyphs with counters ("B", "&", "@"); self-intersecting paths under even-odd and nonzero fill |
| F8 Drag traces | Recorded 120-frame drags: opening position, helix pitch, loft section scale |
| F9 Fuzz | Vertex jitter at 1×, 2× and 8× tolerance; 10,000 seeds per operation |

**Independent validator checks.** These apply after any boolean:

- each directed edge is paired exactly once;
- there are no T-junctions;
- genus;
- signed volume and area against analytic values;
- every output face lies on an input plane;
- the self-intersection count, through a bounding-volume hierarchy.

## 5. Suggested sequence

1. **P11 and P9.** P11 starts at once and runs in parallel. It needs no prototype. P9 starts with the first instrumented prototype.
2. **P1 and P3.** These share one prototype of the complete loop with the extrude, revolve and sweep families.
3. **P5.** It runs on the P3 prototype. Its results feed an architecture cycle on identity.
4. **P2 and P7.** They are independent of each other and can run in parallel with P5.
5. **P4.** It needs the P3 families and the P5 policy.
6. **P8 and P6.** P6 only if P8 or P4 show booleans in ordinary tasks.
7. **P10.** It runs on whatever families exist.
