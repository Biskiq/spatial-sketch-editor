# Deepening Biskiq without becoming another 3D modeling or BIM application

**Research date:** 25 October 2026  
**Status:** Research and product recommendations. No architecture ratification, production implementation, dependency adoption, or roadmap release.

**Central question:** What could deepen Biskiq while preserving an effortless beginning, a gradual learning curve, and a self-contained workflow for multidisciplinary creators?

## 1. Recommendation

Biskiq should deepen the complete act of making a spatial experience: sketch a place, make the few custom forms it needs, arrange and finish it, and let someone experience it.

The strongest direction combines five capabilities:

1. **Spatial drawing:** reliable lines, curves, profiles, surfaces and workplanes throughout 3D space.
2. **Editable form creation:** a small family of profile and path operations, with ordinary scene objects as a safe result.
3. **Reusable detail:** components, patterns and a few configurable construction recipes.
4. **Revision continuity:** dimensions, materials, supports, hosts, references and shared uses remain understandable through change.
5. **Visual and experiential completion:** attractive defaults, coherent materials, lighting, camera composition and a short path to visitor preview and sharing.

The product opportunity is the continuity between these activities. None is individually unique. The combination could let a photographer design a distinctive pavilion, an exhibition designer make a custom display system, or an educator build an explanatory scene without maintaining a CAD-to-DCC-to-engine pipeline.

**The main priority correction:** richer geometry alone does not satisfy “beautiful in 15 minutes.” Placement, materials, lighting and framing deserve equal standing in the research. Conversely, ten hours of useful polishing requires editable sources and reliable revision; more modeling commands cannot compensate for losing previous work.

### What “good enough” should mean

“Most tasks” needs a named denominator. This report recommends **ordinary tasks required to create, revise and communicate a small or medium spatial environment**, across exhibitions, interiors, installations, architectural concepts, product demonstrations and educational scenes.

It does not mean most tasks performed by every specialist in those professions.

| Creator's need | Biskiq should aim to finish | Specialist handoff remains appropriate |
| --- | --- | --- |
| Architectural concept | Proportions, enclosures, openings, levels, overhead forms, circulation and an understandable walkthrough | Construction documentation, code checking, structural and services coordination |
| Exhibition or interior | Layout, custom pedestals and displays, placement, finishes, lighting and visitor presentation | Fabrication drawings, detailed procurement and building delivery |
| Object or furniture concept | Custom profiles, simple forms, proportions, repeated parts and scene reuse | Manufacturing tolerances, mechanical assemblies, complex surface engineering |
| Educational or narrative scene | Space, objects, explanatory information, views and bounded interactions | General game development, character production and arbitrary simulation |

These are proposed product boundaries, not claims about today's shipped editor.

## 2. Method, sources and limits

The investigation combines current Biskiq contracts and prior research, targeted inspection of both requested repositories, primary product documentation, original interaction and geometry research, and a small qualitative sample of community discussions.

### Repository snapshots

| Repository | Revision inspected | Commit date | Method |
| --- | --- | --- | --- |
| Biskiq/spatial-sketch-editor | `976323da9e18e96978649e595bc555021964631a` | 25 October 2026 | Current contracts, release list, S06 plan and relevant prior research |
| hew3d/hew | `f7734a5dfa262c03822d0eae918206705223e6b3` | 24 October 2026 | Architecture, Rust/WASM bridge, drawing and inference code, cross-plane tests, component and Follow Me documentation |
| CacheFactory/draft-down | `12f7f43033b9807b019d0c8b9b7980b54467278d` | 12 August 2026 | Line, Push/Pull, sweep, geometry engine, scene synchronization, history and Manifold integration |

Public web indexing did not expose every source file. Repository contents were retrieved directly through GitHub; the bibliography links the inspected revisions.

**Evidence limits:** This was static code and document investigation. I did not run either application, execute their test suites, benchmark them against Biskiq, or conduct new user studies. Reading a regression test establishes what it covers, not that the current application passes it. Repository assertions about robustness are identified as design claims unless the inspected implementation supports a narrower observation.

Community posts demonstrate particular needs and frustrations; they do not establish their prevalence. Product documentation establishes advertised behavior, not comparative usability. The proposed priorities, interaction choices and performance targets below are research judgments that need experiments.

The two supplied text attachments are prompt-writing guidance. Their useful methodological principles—challenge assumptions, use primary evidence, distinguish proposals from implementation, and define falsification—inform this report. They are not external evidence about modeling.

### Use of previous Biskiq work

The repository already contains substantial research into scenography, look development, multilevel structure, roofs and performance. Its integrated synthesis explicitly distinguishes research from authority. This report extends that base through native form creation and the two requested code studies; it does not restart or ratify the earlier studies. [B6][B7]

## 3. What the evidence changes

### 3.1 SketchUp's appeal is a useful interaction model

The sampled discussions include occasional workshop users questioning ongoing cost, makers comparing tools for woodworking, and designers struggling with construction-oriented extension controls. Other posts reveal confusion about drawing planes and sticky geometry. These are different needs; a pricing complaint is not evidence that users want BIM or a more sophisticated solid kernel. [C1][C2][C3][C4][C5]

The useful inference is that generalists value a short path from an idea to a comprehensible object or space. They also need help with the tasks surrounding geometry: organization, placement, dimensions and presentation.

One unusually relevant thread is a designer discussing Medeek: the complaint concerns interpreting builder-oriented choices and insufficient visual explanations. That is a warning against exposing specialist terminology simply because Biskiq's underlying system supports it. [C5]

### 3.2 Procedural modeling is already part of the competitive baseline

SketchUp's current official documentation, updated 21 October 2026, describes editable procedural Follow Me and Copy Along. Its Solid Tools documentation also includes procedural operations. Biskiq should therefore compare against current workflows rather than assuming all SketchUp creation is destructive. [P1][P2][P3]

Editable generators remain valuable. Their differentiation would come from how they integrate with spatial meaning, appearance, revision and an interactive audience.

### 3.3 An easy beginning and a high ceiling need multiple routes

Resnick and Silverman's construction-kit research emphasizes accessible entry and many possible creations. The related low-floor, high-ceiling, wide-walls framing is useful here: creators should be able to develop different kinds of projects with shared fundamentals. It is an analogy from creative learning, not proof of Biskiq's target completion time. [E1]

Progressive disclosure helps only when the route to deeper capability is visible. NN/g's work also warns that users often stay with a small learned feature set. Hiding advanced functionality in an obscure menu does not create a gradual learning curve. [E2][E3]

**Implication:** teach additional power through the same objects and actions. A new creator drags a pattern's spacing handle; a returning creator types an exact distance; a practiced creator edits its source profile and endpoint behavior. Avoid requiring a new application-wide “expert mode.”

### 3.4 Beautiful defaults can remove substantial labor

Tiny Glade advertises context-sensitive building detail: paths can produce doors and raised structures gain supports. Townscaper emphasizes immediate building and beauty. These demonstrate product approaches that automate finishing and assembly decisions, although they do not establish the flexibility or accuracy Biskiq needs. [P10][P11]

Biskiq can borrow the reduction in repetitive work while keeping consequential architectural meaning explicit. Suggested finishes, trim or arrangement can be easy to revise; silently inventing a structural host or changing a room's identity would violate a different expectation.

## 4. The capabilities worth deepening

The following ordering weighs cross-workflow value, compatibility with Biskiq's interaction direction, and the cost of keeping revisions reliable. It is an argued prioritization, not a quantified market ranking.

| Capability family | Quick result | Depth over hours | Recommendation | Boundary |
| --- | --- | --- | --- | --- |
| Spatial Ink and precision | Draw on a visible face or plane; pull a line vertically | Arbitrary planes, curved profiles, cross-plane chains and exact dimensions | Foundation | Never invent a face from a nonplanar loop |
| Editable profiles and extrusion | Draw a custom plinth, shelf or enclosure detail | Edit outlines, holes, heights and bounded taper | First native form capability | No raw mesh topology workflow |
| Components and repetition | Duplicate a useful object and distribute it evenly | Shared source, path/radial patterns, spacing, orientation and local variation | High priority alongside forms | Shared edits and instance identity must be explicit |
| Placement and spatial relationships | Put objects on supports and align them naturally | Persistent attachments where requested, fit behavior and repair | Foundation | A snap must not secretly become a constraint |
| Materials, lighting and framing | Produce a considered image immediately | Layered finishes, texture scale/orientation, light targeting and composed views | Equal priority for the product promise | No mandatory UV, shader-node or photometry workflow |
| Revolve and sweep | Make a column, vessel, rail or trim from a profile | Edit the source, axis/path and corner behavior | Strong next family | Generated detail must survive ordinary revision |
| Bounded architectural recipes | Make stairs, railings, frames or a display assembly quickly | Expose meaningful dimensions and replaceable profiles | Selective, after shared foundations | No catalog of unrelated wizards |
| Limited loft, rounding and explicit booleans | Resolve forms that extrusion cannot express | Refine transitions, soften edges, cut a custom object | Research-gated | No blanket promise of arbitrary solid or surface editing |
| Geometry-to-semantic interpretation | Recognize supported hosted operations | Promotion, relationship continuity and refusal | Investigate with the above | No category inference from appearance alone |
| Reference, trace and handoff | Work from a sketch, image or imported object | Reuse and replace assets while preserving placement | Essential to “self-contained” | Interchange is an escape route, not a forced daily pipeline |

### 4.1 Spatial Ink: three dimensions with understandable depth

The priority is a reliable drawing context, not arbitrary 3D cursor freedom.

Start from a hit surface or a visible plane. Preview its orientation and the inferred direction, allow a deliberate lock or switch, and use the same resolved geometry for preview and acceptance. Biskiq retains X/Z horizontally and Y vertically; SketchUp and Hew conventions should not be copied internally.

Separate three cases:

- **Planar drawing:** endpoints belong to one plane; valid closed profiles can form an area.
- **Spatial chains:** segments can change plane and connect across space; closure alone does not imply an area.
- **Hosted surface drawing:** a stroke is interpreted in a host's coordinates. On a curved wall, the meaning of a circle or length needs a defined mapping; it cannot be treated casually as a planar sketch.

Useful support includes endpoints, midpoints, centers, axes, parallel/perpendicular inference, unit-aware entry and optional guides. The visible cue must explain whether a point is exact, projected or constrained.

Feather's translucent drawing guides offer an adjacent example of making the drawing surface visible. SKETCH's original research demonstrates a long-standing interest in performing conceptual operations in the 3D scene. Neither establishes that unconstrained freehand input is the best default for Biskiq. [P7][E4]

**Research choice:** compare a surface-first approach with visible workplanes against a more automatic inference approach. Use the number and severity of corrective plane changes, not apparent demo fluidity, to decide.

### 4.2 Forms: preserve the idea that generated them

A useful minimum is an editable outline, optional holes and a depth. That already supports custom displays, shelves, platforms and stylized furniture parts.

The next operations have unusually broad leverage:

- **Revolve:** columns, bases, vessels, lamps and turned furniture forms.
- **Sweep:** frames, rails, moldings, pipes and curved display edges.
- **Offset:** borders, thickness and related outlines.
- **Bounded taper:** a meaningful refinement of an existing form.
- **A limited two-profile loft:** worth testing for canopies and transitions that otherwise require many parts.

A loft should earn inclusion by completing common scenes that simpler operations cannot. General patch surfacing and arbitrary continuity controls have a much weaker fit.

A creator should be able to return to a form's outline, axis, path and parameters. This does not require exposing a CAD feature tree. A selected column can offer “Edit profile” and a revolution angle; a selected trim can expose its path and section.

The difficult requirement is continuity: profile edits should preserve the placed object's identity, its finishes, eligible attachments and Experience references whenever there is a valid continuation. If topology changes make that impossible, Biskiq must explain the unresolved relationship.

### 4.3 Repetition: more authored intent, less repetitive labor

Components and patterns have value across almost every target discipline: chairs, balusters, display bays, windows, lights, shelves and exhibit layouts.

Spline's documentation provides a relevant precedent for reusable components whose instances follow source changes, and for sharing geometry as a scene optimization. These are useful product and rendering precedents; they do not resolve Biskiq's generated-member identity rules. [P8][P9]

The basic interaction can be a copy dragged into place, followed by an optional repeat count or spacing. Deeper controls include path/radial placement, endpoint policy, orientation, offsets and supported local variation.

Three distinctions are essential:

1. A component definition is shared source; a placement is a use.
2. A pattern is a placement rule; it need not be hundreds of independent source objects.
3. A visible generated member may still need a stable address for selection, materials or Experience references.

“Use instancing” only addresses part of rendering. It does not decide identity when a pattern changes from 20 elements to 19, which members keep overrides, or how a referenced member is retired. Those require explicit domain behavior.

For curved paths, distinguish keep-upright, follow-tangent and fixed orientation. Avoid presenting an unexplained “align” checkbox that hides several incompatible meanings.

### 4.4 Relationships: the most valuable hidden depth

A powerful generalist workflow often depends more on changing an existing scene safely than on producing another kind of primitive.

A display rests on a platform. A painting sits on a wall. A light aims at an exhibit. A trim follows an opening. These relations can make editing feel effortless when the object changes.

However, **transient assistance and persistent relations are different operations**. Snapping two shelves to the same height need not bind them forever. A creator should opt into continuing alignment or attachment where that behavior is supported. Previous Biskiq research already makes this distinction; it should be preserved. [B6]

Avoid turning “support-aware” into a full rigid-body simulation. Simple authored support and placement rules can cover many cases more predictably and cheaply.

### 4.5 Finish: make rough work presentable and refined work distinctive

The first-use baseline should already have useful lighting, readable surfaces, a stable ground/reference context and a flattering camera. A creator can then change a coherent look without tuning dozens of render parameters.

High-value depth includes:

- Material scale and orientation expressed in meaningful physical units.
- Object, face/region and supported shared-source scope.
- Surface finishes that follow profile and path edits.
- Light placement and aim through direct spatial controls.
- A few coherent lighting and environment starting points.
- Shadows and edge treatment appropriate to the performance budget.
- Saved, well-framed views and an uncomplicated visitor preview.

Rounded edges deserve selective research because they can materially improve everyday objects. Compare analytic profile rounding, bounded geometric bevels and purely visual edge treatment. A shading effect is not a physical fillet and must not be offered as fabrication geometry.

The appearance system should help a novice make a coherent scene while allowing an experienced creator to refine individual subjects. Avoid locking the entire product into one procedural aesthetic.

### 4.6 Recipes: domain knowledge without specialist workbenches

A railing combines a path, repeated uprights and a swept handrail. A display wall combines supports, shelves and spacing. These are good candidates for reusable recipes built from ordinary capabilities.

Recipes should expose useful handles—rise, run, depth, count, spacing, section—while preserving editable constituent intent. They should not require the user to operate a node graph.

The failure mode is a collection of incompatible generators: a stair wizard with one vocabulary, a shelf wizard with another, and a roof editor that starts a new application. Test whether new recipes reuse existing concepts before expanding their catalog.

## 5. Effortless authoring and a gradual learning curve

Effortless should mean low coordination and recovery costs. It cannot mean that the system always guesses correctly.

### Interaction principles

| Principle | Practical behavior | Failure to avoid |
| --- | --- | --- |
| Start with useful defaults | A first shape is visible, grounded, selectable and attractively lit | A blank model requiring rendering setup |
| Show the active context | Plane, surface, shared source and operation reach appear when relevant | Invisible modes and accidental edits |
| Let direct work become precise | Drag, read, type and later edit the same fact | Separate approximate and exact tools |
| Make deeper routes discoverable | Contextual actions, clear labels, Find synonyms and brief in-context hints | Advanced features buried several levels down |
| Preserve a small vocabulary | Draw, pull, place, align, repeat, finish and inspect combine | A permanent button for every algorithm |
| Keep reversal cheap | Preview, cancel and coherent Undo; accepted work remains stable | Partial commits and repair chores |
| Explain interpretation | Show what a gesture will create before consequential acceptance | Silent cross-domain guessing |
| Allow several starting points | Native drawing, a reference image, existing content or an imported object | Architecture required before all other work |

Shapr3D combines direct and history-based editing, and its current Parameter Cards aim to expose tool settings in modeling space. Plasticity deliberately emphasizes direct modeling without the engineering feature-tree workflow. These are competing precedents; Biskiq should test which kinds of source editing need persistent parameters rather than adopt either model wholesale. [P4][P5][P6]

### A proposed 15-minute task

The clock starts with an empty project or explicitly identified starting kit. External asset search and preparation must be counted or supplied consistently; do not hide them outside the measurement.

| Time | Creator action | Product support being tested |
| --- | --- | --- |
| 0–3 min | Sketch a small pavilion or exhibit area | Understandable drawing, sensible height and attractive default rendering |
| 3–6 min | Make one custom display from an outline and pull | Native custom form without leaving Biskiq |
| 6–9 min | Place a supplied collection and repeat/align a few items | Reliable support, scale and arrangement |
| 9–12 min | Choose a finish and lighting mood, adjust a view | Coherent appearance without technical setup |
| 12–15 min | Add a title or basic content and inspect a visitor presentation | A complete communicable result |

These timings are a proposed benchmark, not evidence that the product can currently achieve it. Test an untemplated path as well as a starter-kit path.

### Ten hours should develop the same project

The creator can replace a plinth's outline, revolve custom supports, sweep a trim, refine a path pattern, tune material scale, make a local instance variation, improve lighting and direct a more deliberate experience.

A substantive revision comes halfway through: resize the pavilion or curve the display wall. Then ask what survived. If polish is destroyed, the product has depth of creation but little depth of use.

Learning should be gradual in two senses: capabilities become understandable as needed, and earlier work remains suitable for later refinement. A beginner's creation must not be disposable scaffolding for an expert-only format.

## 6. What Hew teaches Biskiq

Hew is the stronger reference for rigorous direct solid editing. Its product model is still different from Biskiq's semantic and experiential model.

### 6.1 The boundary around geometry

Hew separates Rust kernel, inference and tessellation responsibilities from a TypeScript/React interface and Three.js rendering. The kernel compiles to WASM in both browser and desktop shells. Its document includes Objects, Sketches, Groups, component definitions/instances and Guides. [H1][H2]

**Lesson:** keep computational geometry behind an explicit interface independent of UI and rendering. That interface need not be Rust initially, and it must not become a second owner of Biskiq's architectural truth.

### 6.2 Explicit objects protect against accidental welding

Hew confines sticky editing to an object. Touching objects remain separate until an explicit combining operation. Its architecture distinguishes selection from editing context. [H3]

For Biskiq, an ordinary custom form should likewise be safe to move next to a wall without joining it. Snapping to a wall is a read operation; hosting, cutting and joining are deliberate semantic operations.

This separation is especially important when the same Ink vocabulary can create architecture and decoration.

### 6.3 A useful transaction pattern

The inspected `draftCommit.ts` brackets drafting with a target and a label, cancels on failure, parses changed objects/sketches and dispatches refresh hooks. Its target distinguishes planes, faces, sketches and entered instances. [H4]

The transferable idea is one meaningful accepted gesture with explicit effects and one reversible history result. Biskiq should adapt this to its existing cross-domain composition contracts rather than import Hew's history authority.

### 6.4 The cross-plane regression is an excellent probe

Hew's `LineTool.crossSketch3d.test.ts` describes three coupled failures: a true endpoint filtered out by the active plane; a transient preview becoming a false snap candidate; and a committed segment remaining on a frozen plane despite an off-plane snap. The test exercises a real tool gesture with a mock kernel and points to separate inference tests. [H5]

**Lesson:** test the contract across input, inference, preview and acceptance. It is insufficient to test only the line algorithm. Include an oblique camera and a closed noncoplanar chain that remains linework.

The historical fix does not prove all cross-plane cases are solved.

### 6.5 Spatial indexing should preserve the answer

The inspected inference index uses bounding volumes and BVHs to prune candidate sets, with deterministic ordering and exact candidate checks after pruning. [H6]

This is a strong design principle for Biskiq: acceleration should reduce the work required to obtain the same snap result. Do not use an approximate nearest object as a substitute for canonical host identity.

Screen-space pick tolerance and geometric coincidence tolerance are different things. One helps a human acquire a target; the other determines whether geometry is the same.

### 6.6 Rust does not settle interaction performance

The WASM loader exposes direct calls to a scene object; the bridge includes buffer-returning accessors that clone data. This supports investigating boundary cost rather than assuming zero-copy or off-main-thread execution. [H7][H11]

A synchronous expensive WASM call can still interrupt input. Measure module initialization, retained memory, conversion/copies, tessellation, transfer, renderer update and end-to-end latency.

Rust's memory safety does not by itself establish geometric correctness.

### 6.7 Hew is not a ready-made parametric source system

Its stated interaction model has no parametric feature history, and extrusion consumes a sketch profile into solid geometry. The Follow Me guide describes direct modeling behavior. [H3][H9]

Therefore, Hew does not establish the desired Biskiq workflow of repeatedly editing a retained profile and regenerating a form while preserving every attachment and finish.

Its deterministic plane-unit keys are interesting for addressing derived drawing units, but geometry-dependent keys are not a general solution to semantic identity through arbitrary shape changes. [H8]

### 6.8 Adoption position

Adopt the principles of object isolation, explicit draft targets, deterministic inference, typed refusals and geometry/UI separation. Study the actual failure cases.

Do not adopt Hew's entire solids-first document model, baked-transform choices, edit-session machinery or core code by default. Layout, Scene, Camera and Experience responsibilities in Biskiq remain different. Hew's repository declares AGPL-3.0-only plus a scoped Plugin API Exception; it is not a permissively licensed core dependency. [H12]

## 7. What DraftDown teaches Biskiq

DraftDown is especially useful as an example close to Biskiq's current TypeScript/Three.js environment.

### 7.1 A practical drawing state machine

Its Line tool handles axis locks, an initial face-plane context, numeric length entry and rubber-band feedback. It applies direction inference when committing as well as previewing. [D2]

This demonstrates a useful separation of pointer intent from accepted geometry. It is not evidence that every arbitrary workplane transition works correctly. Hard point snaps, projection and plane changes need a documented precedence, not just a set of fallbacks.

### 7.2 Push/Pull deserves careful interaction engineering

The inspected tool handles face-normal distance, typed values, snapping and repeat distance. Its click path explicitly preserves a snap that the preview showed rather than letting a small cursor drift produce a different result. [D3]

That detail is highly relevant to “effortless”: the preview must be a trustworthy promise. Biskiq can offer pulling as a contextual form action without adopting DraftDown's permanent tool roster.

### 7.3 TypeScript can implement substantial geometry interaction

DraftDown contains a half-edge structure, a geometry engine and face/edge editing infrastructure. It is useful evidence against assuming that basic form creation requires a wholesale Rust migration. [D1]

Its breadth also shows the amount of machinery hidden under apparently simple operations. A README feature list alone is not a robustness assessment.

### 7.4 Sweep has a concrete technique worth learning

`SweepOperation.ts` constructs section rings along a path and uses a rotation-minimizing frame calculation based on double reflection. The original Wang et al. paper supplies the mathematical reference. [D6][E5]

This matters for rails and trim that otherwise twist unexpectedly. A production feature still needs explicit corner, self-intersection and closed-loop seam behavior. Biskiq should compare bounded transport strategies against its intended path families.

The inspected operation can consume the source face and writes generated geometry. It is not a retained, fully editable generator graph.

### 7.5 Dirty updates and batching are useful, with an important qualification

`SceneBridge.ts` includes dirty-vertex adjacency, a face triangulation cache, in-place buffer updates, batched imported geometry and extraction of active geometry for editing. It preserves mappings for picking batched faces. [D4]

However, the inspected dirty path still traverses wider face sets for liveness and generation changes. It would be inaccurate to describe the entire synchronization path as strictly proportional only to changed entities.

**Lesson:** borrow the affected-set and stable-buffer ideas, then count actual work across the entire path. A dirty flag is not proof that every global scan disappeared.

### 7.6 History records changes, but mutations need discipline

`HistoryManager.ts` records map deltas and includes special snapshots/diffs for tools that mutate cached vertex positions directly. [D5]

The useful lesson is history proportional to meaningful changes. The caution is that in-place mutation can bypass an otherwise elegant recording mechanism. Biskiq should not add another generic history system beside its existing source history.

### 7.7 DraftDown also uses WASM

Its Boolean integration loads `manifold-3d`; the inspected desktop bridge routes operations through Electron IPC, while the direct path loads the module. Inputs are flattened into typed arrays and temporary native objects are explicitly deleted. [D7][D9]

It is therefore inaccurate to frame the comparison as “pure TypeScript DraftDown versus WASM Hew.” A more useful comparison is a TypeScript authoring layer with a specialized imported kernel versus a Rust kernel owning much more of the model.

The application's browser build also needs its own integration verification; desktop IPC behavior is not browser proof.

### 7.8 A boolean result is not semantic continuity

The inspected `applyManifoldResult` deletes the original regions' faces and bulk-imports the generated result with new entity IDs. [D8]

That is a workable geometric replacement mechanism. It does not itself preserve Biskiq's hosted openings, shared-source identity, attached content or references to semantic parts. Keep a boundary between “we got the correct solid” and “the user's project still means the same thing.”

### 7.9 Adoption position

Learn from the drawing and snapping contract, repeat-distance workflow, sweep frames, renderer caching/batching and delta recording.

Do not copy its geometry engine or synchronization bridge as a drop-in subsystem. The inspected repository tree contains no license file, and its package manifest does not provide a license grant. Treat code incorporation as unresolved until an explicit suitable grant is obtained. The README's “open-source” description alone is insufficient for Biskiq's dependency admission policy. [D1][D9][D10]

## 8. The most useful architectural direction

**Recommendation:** retain semantic source ownership, introduce bounded editable form definitions where their domain admits them, and derive renderable geometry through replaceable evaluators.

This is a proposed direction, not a persisted schema.

### 8.1 Separate four responsibilities

| Responsibility | Examples | Requirement |
| --- | --- | --- |
| Authored intent | Profile, path, axis, depth, repetition rule, qualified relation | Compact, editable and versionable |
| Semantic meaning | Wall, Opening, derived enclosure, ordinary placed object | One writable authority per fact |
| Geometric evaluation | Intersections, extrusion, sweep, solid validation, tessellation | Explicit inputs, outputs, refusals and affected sets |
| Display and interaction | Meshes, instance buffers, hit mappings, marks and previews | Derived, disposable and faithful to source |

A half-edge mesh or B-rep may be a useful internal evaluation representation without becoming the universal authoring model.

Similarly, “one architectural compiler” does not forbid a Scene form generator. It forbids another consumer reconstructing competing Layout truth. Shared numeric machinery can serve both domains through their owners. [B1][B2][B3]

### 8.2 The hardest seam is stable identity

Keeping the top-level object ID is necessary but insufficient. Ask what happens to:

- Material regions when an outline gains a segment.
- A painting or ornament attached to a generated side.
- A light aimed at a patterned member.
- A locally specialized use after its shared source changes.
- An Experience reference when a generated part disappears.

Prefer source-level and semantic-role references where they have an honest meaning. Require an explicit policy for splits, merges, retirement and unresolved relations. A triangle index, BVH leaf or current array offset must not silently become a durable identity.

For pattern members, test stable slots or another declared identity scheme. Different count/spacing policies may imply different continuations; there is no universal free solution.

### 8.3 Lightweight source does not mean free computation

A pattern described by one source object, a path and a count can be small in storage while producing expensive evaluation, picking and GPU work. Its visible members still require spatial transforms and sometimes individual metadata.

Sharing geometry helps repeated identical parts. Unique per-member edits, materials, shadow casting and transparency can reduce that benefit. Three.js instancing supports shared geometry/materials and per-instance transforms; its hit results can identify an instance. Semantic addressing remains Biskiq's responsibility. [K6]

Use measured affected sets, caches, render batching and bounded work scheduling. Count history and serialization costs as well as geometry arithmetic.

### 8.4 Cheap previews must remain truthful

An earlier broad suggestion—use a cheap preview, rebuild exact geometry on commit—needs qualification against current Biskiq contracts. S06 explicitly preserves exact semantics and preview/planner equivalence; it does not authorize approximate geometric acceptance. [B5]

Cheap can mean less repeated work, equivalent analytic feedback, changed-region evaluation or reduced render tessellation where allowed. It must not mean the accepted operation unexpectedly differs from what the creator approved.

Any proposed approximation should identify what is approximate, how it is shown, what remains exact, and whether a contract change is required.

### 8.5 Surface hosting needs more than generic face editing

A curved Wall has semantic coordinates, openings and relationships. A generic solid face has geometric topology. Treating both as “draw on whatever triangle was hit” loses important meaning.

Investigate host-local parameterization, length measurement, normal/orientation, preview mapping and revision behavior. A circular opening drawn in an unrolled wall reading needs a defined spatial interpretation when rendered on the curved host.

An arbitrary boolean subtraction should not silently become a canonical Opening. Promotion must be an explicit, supported domain operation.

## 9. Geometry technology: compare responsibility and cost

The strongest near-term technical hypothesis is **TypeScript-owned interaction and source orchestration, with specialized geometry modules only where capability or measurement justifies them**.

The first comparison should be build-versus-adapt for a particular operation, not Rust-versus-JavaScript in the abstract.

| Option | Best research use | Advantage | Limitation or decision needed |
| --- | --- | --- | --- |
| Existing TypeScript stack with bounded generators | Profiles, extrusion, revolve, pattern transforms and initial inference | Fits current development and enables small experiments | Robust intersections, offsets and topology still require serious engineering |
| Manifold through its JS/WASM binding | Explicit custom-object booleans and mesh-solid generation | Specialized existing implementation; project declares Apache-2.0 | Mesh-based interface, valid-input requirements, memory lifecycle and surface/reference mapping |
| A small custom Rust/WASM module | A proven numeric hotspot or capability poorly served by existing code | Tight representation and reusable computational boundary | Startup, transfers, copies, build/debug overhead and threading remain real |
| Truck | A permissively licensed Rust B-rep/NURBS comparison | Modular geometry, topology, modeling and shape-operation crates | Considerably more integration and maturity verification than a demo proves |
| Open CASCADE and wrappers | Architectural reference for analytic CAD and interchange | Broad established geometric machinery | OCCT declares LGPL with an exception; outside the current full-permissive admission rule |
| Hew's core | Reference for direct modeling and invariants | An integrated example worth studying | Its core license and product model do not make it an admitted dependency |

Manifold's own documentation distinguishes manifold input requirements and surface/property tracking. Its useful provenance facilities deserve a real probe; a triangle output does not inherently require losing all materials. DraftDown's particular replacement path and Biskiq's semantic reference problem are separate issues. [K1][K2][D8]

Truck's Apache-2.0 declaration makes it worth investigating, but it does not establish that its complete dependency closure or required WASM path meets Biskiq's requirements. Open CASCADE's wrapper license cannot replace the underlying kernel's license. No candidate is adopted by this report. [K3][K4][K5][B7]

### What a kernel comparison must include

Use the same operation definitions and fixtures. Measure total operation latency, UI responsiveness, cold and warm startup, loaded bytes, peak/retained memory, conversion and mesh upload. Include failed operations and repeated editing, not only successful isolated extrusions.

Validate source editability, region/material correspondence, deterministic save/reload and Undo alongside speed. A kernel that computes a solid quickly but forces destructive reauthoring may be a poor product fit.

For worker experiments, include cancellation and stale-result handling. Moving work away from the UI does not eliminate it, and a late result must not overwrite a newer source revision.

## 10. Reconciliation with current Biskiq

Current destination design already provides much of the interaction foundation: World | Experience, one continuous Stage, contextual Ink, a Shape reading, direct manipulation, a precision ladder and capability-driven disclosure. These are accepted design intentions, not proof of production delivery. [B1][B2]

The release list inspected for this report releases S06 performance foundation and a separate bounded project-lifecycle scope; it does not release Spatial Ink or the proposed modeling families. [B4]

| Finding | Current status | Research consequence |
| --- | --- | --- |
| Ink on ground, raised sheets and wall faces; Shape as a contextual reading | Destination shell authority | Extend and test this vocabulary instead of designing a parallel object toolbar |
| Arbitrary planes and cross-plane 3D chains | Not established by the inspected shell as a complete feature contract | Specify precedence, inference, guides and refusal through experiments |
| Wall-first Layout and derived Rooms | Existing semantic ownership | Generic solid generation must not replace architectural meaning |
| Editable revolved/swept forms and pattern behavior | Capability proposals | Need ownership, source, identity and revision decisions |
| Scene objects and presentation | Established domain responsibility, delivery varies | Determine how native forms participate without inventing another source store |
| Boundary-inclusive performance evidence for Rust/WASM | Existing technology gate | No rewrite justified by language reputation |
| Full-permissive dependency admission | Current project direction | Study Hew and DraftDown, but do not treat their repositories as copy-ready inputs |
| 15-minute success and 10-hour polish | User's product target | Define and test complete workflows; no present performance claim |

### Two interaction conflicts deserve explicit decisions

**Circle on a wall:** the ratified shell reads this as a round Opening without a reading chip. Custom form authoring also creates legitimate circles for medallions, trim or relief. Research must preserve the current rule or propose a clear amendment. An explicit temporary Shape intent is already a retained shell alternative worth comparing, not a decision made here.

**Closed horizontal strokes:** active Wall-authoring enclosure behavior and the destination Shape reading have different delivery boundaries. The new research must not silently change the active T1 interpretation.

The product's current non-goal language also places general-purpose geometry modeling upstream. Bounded native form creation therefore needs a clear scope statement: forms used to make and communicate spatial environments, with specialist workflows remaining external. Whether to broaden that boundary further is an owner product decision after evidence, not an implication of adding extrusion. [B1][B2][B3]

## 11. A bounded research and prototype program

The following experiments are recommendations for future authorization. They were not executed during this research.

### Experiment 1 — Does the first complete result become attractive quickly?

Compare a minimal spatial-creation loop with and without carefully designed appearance/placement defaults. Include one native custom form in both.

Recruit a small initial group across photographers/educators, exhibition/interior creators and spatially experienced generalists. An initial 8–12 participants can uncover usability failures, but cannot establish market-wide success rates.

Measure time to first coherent scene, task completion, corrective operations, help requests and the external tools needed. Have independent reviewers and creators assess readability, composition, lighting and coherence using a stated rubric.

**Falsification:** geometry additions do not remove the main blockers, or scene setup consumes most of the 15 minutes. Respond by prioritizing placement/look development rather than adding more form operations.

### Experiment 2 — Which drawing context is easiest to predict?

Compare surface-first visible workplanes with more automatic inference and explicit locks. Tasks: vertical then horizontal lines; a tilted profile; snapping back to an off-plane origin; a loop that must remain nonplanar linework.

Include trackpad input, an oblique camera, occlusion and near-edge-on planes.

Measure mistaken-plane commits, recovery time, successful exact snaps and whether preview equals acceptance.

**Falsification:** the apparent simplicity of automatic inference produces repeated hidden-depth errors. Favor more explicit context instead of adding smarter but opaque guesses.

### Experiment 3 — Can useful forms remain editable?

Build a pedestal by extrusion, a column by revolve and a trim by sweep. Compare retained source editing with a direct-solid approach on substantial revisions.

Then change an outline, reverse a path, alter an axis and split a material region. Verify placement, finishes, supported attachments, references, save/reload and Undo. Include controlled invalid inputs.

**Falsification:** retained generators create more dependency repair than they save, or ordinary source revisions frequently destroy polish. Narrow the operation family and define stable correspondence before expanding it.

### Experiment 4 — Does repetition add detail without multiplying authoring burden?

Use 20, 200 and 1,000 repeated elements on straight and curved paths. These are proposed workloads, not supported product limits.

Change length, curvature, count and spacing; specialize one member; delete a referenced member; edit shared source.

Measure source size, accepted history size, evaluation counts, picking latency, buffers uploaded, draw calls, heap and visual correspondence.

**Falsification:** adding visible detail also multiplies independent source validation/history, or changing a local use recomputes unrelated scene data. Revisit representation and locality before increasing counts.

### Experiment 5 — Can semantic assistance remain unsurprising?

Give users tasks that look similar but mean different things: a circular window, a circular wall ornament, a standalone disc, a raised platform and a decorative horizontal outline.

Compare the accepted contextual reading approach against an explicit temporary Shape intent. Record incorrect interpretations, confirmation burden and learning transfer.

Also change or remove a host and ask what the creator expects to happen.

**Falsification:** users routinely commit the wrong semantic entity or cannot explain an operation's reach. Favor legible intent over more aggressive automatic recognition.

### Experiment 6 — Which evaluator serves a demonstrated capability gap?

Only after defining equivalent operation semantics, compare the existing-stack implementation against Manifold and one justified Rust option. Use a corpus of concave profiles, holes, thin features, curved paths, coplanar contact, tangency and extreme-but-supported scales.

The existing reference machine is the **MacBook Air M2 with 16 GB**, on the project's specified browser/power conditions. An 8 GB machine is an additional product-target stress test, not the current S06 reference machine. Respect the separate S06 owner-run benchmark method and pass limits. [B5]

Report:

- Input-to-visible-feedback latency, median, p95 and worst cases.
- Time spent computing, serializing/copying, transferring and updating rendering.
- Main-thread long tasks, frame pacing and cancellation behavior.
- Cold/warm startup and bytes loaded.
- Peak and retained JS/WASM/GPU memory, as far as the browser can measure reliably.
- Failed edits, deterministic results and identity/material survival.

A proposed interactive target is feedback within a roughly 16.7 ms frame at 60 Hz for ordinary local gestures, with costly accepted operations separately measured and honestly indicated. This is an experimental aim, not a new F gate or a claim that every boolean must complete in one frame.

**Falsification:** a faster kernel does not improve end-to-end response, or the transfer/correspondence cost cancels the gain. Keep the simpler implementation or change the boundary.

### The ten-hour check

Continue the same projects across several sessions totaling approximately ten hours. Include a major revision after substantial finish work. Track time spent creating versus recovering, lost work, unresolved relationships and external-tool exits.

The decisive question is whether deeper learning enables better work on the original project. A polished demo created by the research team does not answer it.

## 12. Suggested adoption order

This is a dependency sequence for planning, not a production release.

1. **Complete the generalist loop.** Reliable basic drawing/placement, one custom extruded form, a coherent look, a useful view and visitor presentation. Establish a baseline for the 15-minute target.
2. **Deepen spatial control and source editing.** Workplanes, vertical/cross-plane chains, precision and editable outlines. Preserve identity and revision from the first form family.
3. **Make reuse powerful.** Components, simple repeat, alignment and shared/local edit scope. Add path/radial placement where evidence justifies it.
4. **Add broad form operations.** Revolve, sweep and offset using the same sources, handles, materials and relationship conventions.
5. **Compose a small recipe library.** Railings, stairs, frames, shelving and displays that reuse the underlying capabilities.
6. **Admit expensive geometric depth selectively.** Limited lofts, geometric fillets and explicit booleans only when they complete recurring target workflows better than existing tools or import.

Look development and revision continuity run through every step. They are not finishing phases postponed until the modeling engine is complete.

## 13. What would cause drift

| Attractive request | Why it can cause drift | Better admission question |
| --- | --- | --- |
| “Support arbitrary mesh editing” | Introduces topology repair, selection modes and DCC expectations | Which recurring spatial task cannot be completed through profiles, paths, components or import? |
| “Become BIM-aware everywhere” | Classification, schedules, technical assemblies and compliance become the product | Does this semantic relationship directly improve authoring or the visitor experience? |
| “Use a full parametric CAD solver” | Adds constraint management and dependency repair to ordinary creation | Can a bounded relation or generator deliver the needed edit? |
| “Expose all kernel operations” | Implementation inventory becomes interface structure | What creator intention does the operation express, and where does it fit the current grammar? |
| “Add a node editor for power users” | Demands another authoring language and support surface | Can the recurring operation become an editable recipe or a specialist external workflow? |
| “Automatically recognize every shape” | Ambiguity produces hidden ownership and revision surprises | Can the first reading be useful while remaining visible and easy to change? |
| “Rewrite geometry in Rust” | Technology investment can outrun the measured problem | Which capability or bottleneck improves after boundary and integration costs? |
| “Add every import/export format” | Endless interoperability maintenance can consume the project | Which handoff is frequent enough to unblock the target creator? |

### A feature-admission test

For each capability proposal, require a concrete ordinary task, a short first-use path, a useful deeper revision and an explanation of specialist complexity it avoids imposing.

Then ask whether it composes with current Ink, manipulation, source ownership, appearance and Experience; whether the result remains revisable; and whether the reference laptop can sustain the actual workflow.

A powerful feature can pass. A seemingly small feature can fail if it adds another coordinate system, hidden relation, permanent panel or recovery burden.

## 14. Decisions supported now, and decisions still open

**Strong recommendations supported by the investigation**

- Treat native environment-related form creation as a serious product capability.
- Put workplanes, preview/acceptance consistency and precision ahead of a broad operation catalog.
- Make source editability, reuse and revision survival part of the first useful form family.
- Study Hew's geometry boundary and explicit object behavior.
- Study DraftDown's interaction details, sweep technique and renderer/history mechanisms.
- Give placement, look development and communication equal weight with modeling.
- Compare bounded evaluators and kernels using full workflows.
- Keep the two projects as research references until code/dependency admission is resolved.

**Questions evidence has not yet settled**

- How broad ordinary native form creation should be relative to the current general-purpose-modeling non-goal.
- The best workplane inference and explicit-lock grammar.
- The appropriate mix of retained generators and direct edits.
- Identity rules for generated regions and pattern members.
- Exactly which relationships should persist automatically after accepted placement.
- The right extent of curved-host drawing and surface conforming.
- Whether lofts, fillets, booleans or a Rust kernel remove frequent enough blockers.
- Whether the 15-minute and ten-hour targets hold for the intended users.

**Recommended product statement**

Biskiq should let a multidisciplinary creator sketch a convincing place, make its distinctive objects and details, refine it through substantial change, and publish a spatial experience—all within one coherent project. Specialist tools remain available when the task becomes specialist work.

## 15. Sources and evidence register

Repository links below use inspected revisions where applicable. Product and community pages were accessed for this report on 25 October 2026. Code citations identify implementation evidence; repository documentation remains a project's stated contract or intent.

### Biskiq: current authority and prior research

- **B1:** [North Star](https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/docs/reference/north-star.md).
- **B2:** [Destination shell and visual-system contract](https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/docs/reference/design-system/editor-shell-and-visual-system.md).
- **B3:** [Architecture](https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/docs/reference/architecture.md).
- **B4:** [Release list](https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/docs/roadmap/now.md).
- **B5:** [S06 performance foundation implementation plan](https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md).
- **B6:** [Integrated product synthesis](https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/broad-research/biskiq-integrated-product-synthesis.md), [research index](https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/broad-research/README.md), [designer brief](https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/broad-research/p3-designer-brief.md), and relevant sections of [creative scene composition](https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/broad-research/creative-scene-composition-ux.md). Research inputs, not independent proof of their quantitative claims.
- **B7:** [Geometry library harvest and licensing supersession](https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/broad-research/geometry-library-harvest.md).

### Hew: architecture, source and tests

- **H1:** [README](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/README.md).
- **H2:** [Architecture orientation](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/docs/dev/ARCHITECTURE.md).
- **H3:** [Detailed architecture](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/docs/agents/ARCHITECTURE.md), especially object scope, source consumption and direct-modeling position.
- **H4:** [Draft commit bracket and change report](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/app/src/tools/draftCommit.ts).
- **H5:** [Cross-sketch 3D line regression test](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/app/src/tools/LineTool.crossSketch3d.test.ts).
- **H6:** [Spatial inference index](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/crates/inference/src/index.rs), with targeted inspection of [inference implementation](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/crates/inference/src/lib.rs).
- **H7:** [WASM API](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/crates/wasm-api/src/lib.rs), targeted sections on reports, buffer access and geometry calls.
- **H8:** [Plane-unit keys](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/crates/kernel/src/unit_key.rs).
- **H9:** [Follow Me guide](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/site/src/content/learn/follow-me.md).
- **H10:** [Boolean implementation](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/crates/kernel/src/boolean.rs), targeted inspection; no claim of a full correctness audit.
- **H11:** [WASM loader](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/app/src/wasm/loader.ts).
- **H12:** [License declaration in README](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/README.md#license) and [Plugin API Exception](https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/LICENSE-EXCEPTION).

### DraftDown: source and integration

- **D1:** [README](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/README.md), with targeted inspection of [GeometryEngine](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/engine.geometry/GeometryEngine.ts).
- **D2:** [Line tool](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/tool.line/lineTool.ts).
- **D3:** [Push/Pull tool](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/tool.pushpull/PushPullTool.ts).
- **D4:** [Scene bridge](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/renderer.webgl/SceneBridge.ts).
- **D5:** [History manager](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/data.history/HistoryManager.ts).
- **D6:** [Sweep operation](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/op.sweep/SweepOperation.ts) and [sweep tool](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/tool.sweep_tool/SweepTool.ts).
- **D7:** [Manifold bridge](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/native.manifold/ManifoldBridge.ts).
- **D8:** [Boolean conversion/replacement](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/op.boolean_union/BooleanUnion.ts) and [subtraction](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/op.boolean_subtract/BooleanSubtract.ts).
- **D9:** [Package manifest](https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/package.json).
- **D10:** [Repository tree at inspected revision](https://github.com/CacheFactory/draft-down/tree/12f7f43033b9807b019d0c8b9b7980b54467278d). Recursive path inventory used to check for a license file.

### Creative interaction and geometry research

- **E1:** Resnick and Silverman, [Some reflections on designing construction kits for kids](https://www.media.mit.edu/publications/some-reflections-on-designing-construction-kits-for-kids-2/), 2005.
- **E2:** Jakob Nielsen, [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/), 2006.
- **E3:** Jakob Nielsen, [User Expertise Stagnates at Low Levels](https://www.nngroup.com/articles/stagnating-expertise/), 2013.
- **E4:** Zeleznik, Herndon and Hughes, [SKETCH: An Interface for Sketching 3D Scenes](https://cs.brown.edu/people/bcz/sketch/sig.html), 1996.
- **E5:** Wang, Jüttler, Zheng and Liu, [Computation of Rotation Minimizing Frames](https://www.microsoft.com/en-us/research/publication/computation-rotation-minimizing-frames/?lang=fr-ca), 2008. Author/institutional publication page and paper.

### Primary product references

- **P1:** SketchUp, [Extruding with Follow Me](https://help.sketchup.com/en/sketchup/extruding-follow-me), updated 21 October 2026.
- **P2:** SketchUp, [Duplicating with Copy Along](https://help.sketchup.com/en/sketchup-copy-along), updated 21 October 2026.
- **P3:** SketchUp, [Modeling Complex 3D Shapes with the Solid Tools](https://help.sketchup.com/en/sketchup/modeling-complex-3d-shapes-solid-tools).
- **P4:** Shapr3D, [Modeling in Shapr3D](https://support.shapr3d.com/hc/en-us/articles/11634976393884-Modeling-in-Shapr3D).
- **P5:** Shapr3D, [Parameter Cards](https://support.shapr3d.com/hc/en-us/articles/31002224435356-Parameter-Cards), updated 13 October 2026; documented as a limited rollout at access time.
- **P6:** Plasticity, [FAQ](https://www.plasticity.xyz/faq).
- **P7:** Feather, [3D Guide interface](https://support.feather.art/docs/3dguide/interface) and [drawing guides](https://support.feather.art/docs/3dguide/draw).
- **P8:** Spline, [Components](https://docs.spline.design/designing-in-3-d/scenes/components).
- **P9:** Spline, [How to optimize your scene](https://docs.spline.design/exporting-your-scene/how-to-optimize-your-scene).
- **P10:** Pounce Light, [Tiny Glade's developer-authored store description](https://store.steampowered.com/app/2198150/Tiny_Glade/?l=english).
- **P11:** [Townscaper official site](https://www.townscapergame.com/).

### Community evidence: qualitative examples

- **C1:** Reddit, [Alternatives to SketchUp?](https://www.reddit.com/r/Sketchup/comments/1ndcmdr/alternatives_to_sketchup/).
- **C2:** South London Makerspace, [Recommendations for software for designing woodshop projects?](https://discourse.southlondonmakerspace.org/t/recommendations-for-software-for-designing-woodshop-projects/32636), 27 February 2024.
- **C3:** SketchUp Community, [Set a plane](https://forums.sketchup.com/t/set-a-plane/101972), 29 August 2019.
- **C4:** SketchUp Community, [What's the basic SketchUp workflow concept? I'm so confused](https://forums.sketchup.com/t/whats-the-basic-sketchup-workflow-concept-im-so-confused/34543), 23 November 2016.
- **C5:** SketchUp Community, [Medeek Engineering: love the concept, hate the UI, any alternatives?](https://forums.sketchup.com/t/medeek-engineering-love-the-concept-hate-the-ui-any-alternatives/345610), 24 March 2026.

### Geometry and rendering candidates

- **K1:** Manifold, [README and technical positioning](https://github.com/elalish/manifold).
- **K2:** Manifold, [Apache-2.0 license](https://github.com/elalish/manifold/blob/master/LICENSE).
- **K3:** Truck, [README and crate organization](https://github.com/ricosjp/truck).
- **K4:** Truck, [Apache-2.0 license](https://github.com/ricosjp/truck/blob/master/LICENSE).
- **K5:** Open CASCADE, [README and license declaration](https://github.com/Open-Cascade-SAS/OCCT).
- **K6:** Three.js, [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) and [Raycaster](https://threejs.org/docs/pages/Raycaster.html).

---

**Evidence discipline:** capability descriptions come from the sources identified above; the proposed product boundaries, priorities and experiments are this report's synthesis. No statistical user-demand estimate, measured Biskiq speedup or usability success rate is claimed.



[B1]: https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/docs/reference/north-star.md
[B2]: https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/docs/reference/design-system/editor-shell-and-visual-system.md
[B3]: https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/docs/reference/architecture.md
[B4]: https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/docs/roadmap/now.md
[B5]: https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md
[B6]: https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/broad-research/biskiq-integrated-product-synthesis.md
[B7]: https://github.com/Biskiq/spatial-sketch-editor/blob/976323da9e18e96978649e595bc555021964631a/broad-research/geometry-library-harvest.md
[H1]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/README.md
[H2]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/docs/dev/ARCHITECTURE.md
[H3]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/docs/agents/ARCHITECTURE.md
[H4]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/app/src/tools/draftCommit.ts
[H5]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/app/src/tools/LineTool.crossSketch3d.test.ts
[H6]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/crates/inference/src/index.rs
[H7]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/crates/wasm-api/src/lib.rs
[H8]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/crates/kernel/src/unit_key.rs
[H9]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/site/src/content/learn/follow-me.md
[H10]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/crates/kernel/src/boolean.rs
[H11]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/app/src/wasm/loader.ts
[H12]: https://github.com/hew3d/hew/blob/f7734a5dfa262c03822d0eae918206705223e6b3/README.md#license
[D1]: https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/README.md
[D2]: https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/tool.line/lineTool.ts
[D3]: https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/tool.pushpull/PushPullTool.ts
[D4]: https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/renderer.webgl/SceneBridge.ts
[D5]: https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/data.history/HistoryManager.ts
[D6]: https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/op.sweep/SweepOperation.ts
[D7]: https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/native.manifold/ManifoldBridge.ts
[D8]: https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/implementations/op.boolean_union/BooleanUnion.ts
[D9]: https://github.com/CacheFactory/draft-down/blob/12f7f43033b9807b019d0c8b9b7980b54467278d/package.json
[D10]: https://github.com/CacheFactory/draft-down/tree/12f7f43033b9807b019d0c8b9b7980b54467278d
[E1]: https://www.media.mit.edu/publications/some-reflections-on-designing-construction-kits-for-kids-2/
[E2]: https://www.nngroup.com/articles/progressive-disclosure/
[E3]: https://www.nngroup.com/articles/stagnating-expertise/
[E4]: https://cs.brown.edu/people/bcz/sketch/sig.html
[E5]: https://www.microsoft.com/en-us/research/publication/computation-rotation-minimizing-frames/?lang=fr-ca
[P1]: https://help.sketchup.com/en/sketchup/extruding-follow-me
[P2]: https://help.sketchup.com/en/sketchup-copy-along
[P3]: https://help.sketchup.com/en/sketchup/modeling-complex-3d-shapes-solid-tools
[P4]: https://support.shapr3d.com/hc/en-us/articles/11634976393884-Modeling-in-Shapr3D
[P5]: https://support.shapr3d.com/hc/en-us/articles/31002224435356-Parameter-Cards
[P6]: https://www.plasticity.xyz/faq
[P7]: https://support.feather.art/docs/3dguide/interface
[P8]: https://docs.spline.design/designing-in-3-d/scenes/components
[P9]: https://docs.spline.design/exporting-your-scene/how-to-optimize-your-scene
[P10]: https://store.steampowered.com/app/2198150/Tiny_Glade/?l=english
[P11]: https://www.townscapergame.com/
[C1]: https://www.reddit.com/r/Sketchup/comments/1ndcmdr/alternatives_to_sketchup/
[C2]: https://discourse.southlondonmakerspace.org/t/recommendations-for-software-for-designing-woodshop-projects/32636
[C3]: https://forums.sketchup.com/t/set-a-plane/101972
[C4]: https://forums.sketchup.com/t/whats-the-basic-sketchup-workflow-concept-im-so-confused/34543
[C5]: https://forums.sketchup.com/t/medeek-engineering-love-the-concept-hate-the-ui-any-alternatives/345610
[K1]: https://github.com/elalish/manifold
[K2]: https://github.com/elalish/manifold/blob/master/LICENSE
[K3]: https://github.com/ricosjp/truck
[K4]: https://github.com/ricosjp/truck/blob/master/LICENSE
[K5]: https://github.com/Open-Cascade-SAS/OCCT
[K6]: https://threejs.org/docs/pages/InstancedMesh.html
