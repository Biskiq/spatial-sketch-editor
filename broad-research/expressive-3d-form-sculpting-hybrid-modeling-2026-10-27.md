# Expressive 3D Form, Sculpting & Hybrid Modeling for Biskiq

## Executive synthesis

The strongest conclusion from this research is that **“digital sculpting” is probably too narrow a framing for Biskiq’s expressive geometry problem**. Brush-based clay manipulation is excellent at one thing: translating hand motion into continuous local shape change with almost no conceptual overhead. But the moment the same object must also preserve a 900 mm opening, remain attached to a wall, accept a revised profile, expose meaningful parts, survive a topology change, or export cleanly into a downstream engineering workflow, “just sculpt the mesh” starts charging interest like a loan shark. Existing systems repeatedly split those concerns among separate representations and modes because they genuinely make different mathematical promises. citeturn16search4turn17search1turn24search8

The more promising framing is **expressive form authoring**: creators manipulate *meaningful controls*—strokes, silhouettes, masses, profiles, spines, primitives, regions, dimensions, relationships and deformation handles—while the system continuously synthesizes whatever geometric representation is appropriate underneath. Teddy demonstrated how little interface machinery is required to generate convincing volumes from silhouettes; FiberMesh went further by letting the artist’s original curves remain on the surface as persistent deformation handles; Structured Annotations showed that constraints such as equal length, symmetry, alignment and connection can coexist with sketch-like modelling instead of being relegated to a CAD afterthought. Those systems are old research prototypes, but the interaction ideas remain unusually relevant to Biskiq’s “15 minutes to something beautiful, 10 hours to refine it” objective. citeturn19search4turn19search1turn20search3

**The critical architectural separation should be between authored intent and generated geometry.** A triangulated display mesh, a subdivision limit surface, a B-rep, or an SDF should not automatically be equated with “the object”. Each can instead be an evaluated representation of an authored object whose durable state consists of operations, semantic controls, relationships, stable identifiers and selectively stored artistic edits. This distinction becomes especially important because persistent references to generated faces and edges are inherently ambiguous after topology-changing edits; even mature CAD systems maintain history maps and use heuristics rather than possessing a universal solution. Open CASCADE explicitly records primitive/generated/modified/deleted evolution, FreeCAD now uses operation history to mitigate its long-running topological-naming problem, and recent B-rep matching research describes persistent correspondence as inherently ambiguous. citeturn24search3turn24search4turn24search2

That leads to a central recommendation:

> **Biskiq should investigate a multi-representation authoring system with one semantic object model, rather than a universal geometry representation.**

A particularly promising division of labour is:

| Layer | Recommended role |
|---|---|
| **Authored semantic model** | Stable object/operation IDs, profiles, curves, primitives, dimensions, regions, constraints, relationships, attachments, provenance |
| **Expressive form representation** | Procedural/functional solids, sweeps and profiles, field/SDF compositions, deformation operators, selected freeform surface representations |
| **Surface refinement** | Subdivision or adaptive mesh where explicit surface control/detail is useful |
| **Precision solid representation** | B-rep/NURBS where exact analytic surfaces, manufacturing interoperability or specialist CAD operations demand it |
| **Generated geometry** | Disposable/adaptive render, selection, collision, export and presentation meshes |
| **Detail/presentation** | Materials, normal/displacement detail and other information that should not need to become literal base geometry |

This is an architectural inference from the representation behaviour described below, not a claim that one implementation has already demonstrated the whole stack. The closest commercial evidence that the UX premise is viable comes from systems such as Substance 3D Modeler, whose authored “Clay” is SDF-based while rendering is polygonal, and Womp, which currently presents browser-based SDF/CSG composition, smooth blending and freehand strokes that remain parametric. Womp’s claims about error-free operations should be treated as vendor claims rather than general properties of all implicit modelling, but its existence is strong evidence that browser users need not be exposed to polygon topology to create solid form. citeturn16search2turn17search0turn17search4

Five findings are especially consequential for Biskiq:

**First, topology freedom and persistent downstream identity are opposing pressures.** Adaptive remeshing and voxel/SDF sculpting deliberately throw topology away to free the artist from it; UVs, face sets and similar attributes are exactly the things that then become hard to preserve. Blender’s current documentation is unusually blunt: Dyntopo can lose or corrupt UV maps, colour attributes and face sets, whereas voxel remeshing reconstructs topology and attempts to reproject selected attributes. That is not merely a Blender quirk; it exposes a fundamental issue whenever downstream information is attached to topology that an upstream edit is allowed to destroy. citeturn16search4

**Second, precision does not have to mean control-point editing.** The creator can constrain *intent*—a centreline, plane, radius, clearance, attachment frame, symmetry relation or protected region—while continuously deforming the surrounding shape. Structured sketch systems already showed semantic constraints applied to freeform primitives, while deformation research such as ARAP and Kelvinlets shows that intuitive handles can drive large regions through optimisation or analytical deformation fields. Biskiq therefore has room for something far friendlier than alternating between “CAD mode” and “sculpt mode”. citeturn20search3turn19search3turn19search6

**Third, conversion is useful but is not equivalent to semantic interoperability.** Fusion can convert T-Splines to B-reps and selected B-rep faces back to T-Splines, but conversion has geometric restrictions; triangle-heavy meshes do not convert cleanly to T-Splines. Rhino can convert SubD to NURBS, yet extraordinary vertices must be approximated and continuity/shape fidelity trade against each other. These are successful production workflows precisely because they accept a boundary between representations rather than pretending the boundary does not exist. citeturn17search1turn17search2

**Fourth, local sculpting should be one operator family, not the foundation of the object model.** Regularized Kelvinlets produce grab, pinch, twist and scale-like deformations from closed-form elasticity solutions; ARAP produces intuitive detail-preserving deformation from sparse constraints; cage techniques and differential editing similarly move large amounts of geometry from a small number of controls. These approaches suggest Biskiq can make surfaces feel “sculptable” even when the underlying authored object is not a traditional sculpt mesh. citeturn19search6turn19search3

**Fifth, browser-native serious geometry is now technically credible, but performance architecture matters more than language choice.** WebGPU exposes rendering and compute pipelines; Emscripten supports stable SharedArrayBuffer-based pthreads behind the necessary cross-origin isolation headers; production and open-source projects demonstrate OCCT, solid-mesh kernels and other substantial geometry stacks in WebAssembly. The browser is no longer the reason to avoid sophisticated geometry. It *is* a reason to design around workers, incremental evaluation, sparse representations and progressive results rather than synchronously rebuilding giant models on the UI thread like an absolute goblin. citeturn23search3turn23search1turn25search4turn25search5


## Creative paradigms and what they actually buy

### Digital clay and adaptive sculpting

Traditional sculpting succeeds because its interaction contract is absurdly simple: **point somewhere, move your hand, shape changes there**. ZBrush’s Sculptris Pro dynamically adds and removes triangles under the brush so polygon distribution does not need to be planned in advance; DynaMesh periodically rebuilds the object to restore more uniform geometric density; subdivision modelling instead preserves a hierarchy of coarse-to-fine surface levels. Blender exposes essentially the same three-way trade: voxel remeshing for unrestricted block-out, Dyntopo for locally adaptive topology, and multiresolution subdivision for coarse-to-fine refinement when topology is stable. citeturn16search1turn16search4

These are **not interchangeable implementations of the same idea**.

| Sculpting strategy | What it makes easy | What it sacrifices |
|---|---|---|
| **Dynamic topology mesh** | Add arbitrary local form without preparing topology; resolution follows brush scale | Stable topology and topology-attached data; Blender warns of slower performance and lost/corrupted UVs, colours and face sets |
| **Voxel/SDF remeshing** | Merge, split, stretch and rebuild volumes with little topology concern; typically yields closed/manifold volumes | Stable vertex/face correspondence; resolution is spatial rather than tied to intentional surface structure |
| **Subdivision / multires** | Work on broad proportions at coarse levels and details at fine levels; efficient smooth evaluation | Topology changes become difficult after detail exists; good base topology matters |
| **Fixed dense mesh** | Straightforward brush displacement and mature downstream tooling | Either wastes geometry or eventually runs out of resolution; topology management leaks into workflow |

These tradeoffs are directly visible in Blender and ZBrush documentation rather than being theoretical distinctions. citeturn16search4turn16search5

For Biskiq, the important lesson is **not** “pick the best sculpting mode”. It is that creators naturally need different stability contracts at different stages. Early exploration wants topology to be disposable. Late detail wants correspondence to be stable. Precise attachments want some geometric relationships to be invariant throughout both stages. A single low-level representation is unlikely to optimise all three simultaneously. citeturn16search4turn24search8

Substance 3D Modeler offers another clue. Adobe describes its “Clay” as an SDF stored on a voxel grid; the user need not manage polygons, the clay stays watertight, and polygons are generated for screen rendering rather than defining the authored object. This is a particularly relevant separation for Biskiq: **the surface users see and select need not be the thing they author**. citeturn16search2

### Sketching can outperform sculpting for initial form

The sketch-based modelling literature contains ideas that conventional DCC tools have oddly failed to absorb.

Teddy asked users to draw silhouettes and inflated those silhouettes into plausible 3D volumes. Its informal study reported that first-time users typically learned the operations in about ten minutes and could construct interesting shapes within minutes. Teddy intentionally targeted approximate creative modelling rather than precise modelling, so it is evidence for a first-stage interaction paradigm, not a complete professional workflow. citeturn19search4

SmoothSketch expanded that idea to drawings containing T-junctions, cusps and hidden contours. Its deeper lesson is that **a 2D drawing can be treated as an underconstrained statement of shape intent**, with the computer inferring a plausible 3D solution rather than requiring the creator to explicitly construct every degree of freedom. Ambiguous drawings remain inherently ambiguous, which is precisely why inference should be reversible and editable rather than silently becoming irreversible geometry. citeturn20search2

FiberMesh is even more relevant to Biskiq. Instead of throwing away the original sketch once geometry was generated, the system kept user-drawn curves on the resulting surface and used them as handles for subsequent edits. Curves could be added, removed and deformed while a smooth embedding was continuously optimised. The paper reports sophisticated models and describes real-time surface and control-curve optimisation. This anticipates an important Biskiq principle: **input gestures should often become durable authoring structure, not ephemeral commands**. citeturn19search1

Structured Annotations then shows how sketch-like freedom can coexist with semantic precision. Users could specify equal lengths and angles, alignment, mirror symmetry and connection curves, and the system solved a coherent 3D construction from those annotated relationships. The authors explicitly positioned it as a way to rapidly create useful initial models for later refinement rather than a replacement for every modelling technique. citeturn20search3

Put together, these systems imply a richer starting vocabulary than “sphere + brushes”:

**silhouette → mass; stroke → spine or solid ribbon; closed stroke → profile; cross-section strokes → loft; gesture → cut/split; curve → persistent form handle; annotation → constraint; primitive → semantic mass.** All can later expose progressively deeper controls. This is a product inference based on the mechanisms demonstrated by Teddy, FiberMesh and Structured Annotations. citeturn19search4turn19search1turn20search3

### Deformation is a third path between modelling and sculpting

A surprising amount of sculpt-like freedom does not require sculpt geometry at all.

As-Rigid-As-Possible surface editing formulates deformation as an optimisation that tries to keep local transformations as rigid as possible while satisfying user constraints. The result is large, intuitive changes that preserve local surface character better than naive vertex movement. citeturn19search3

Regularized Kelvinlets approach the problem volumetrically. Grab, scale, twist and pinch behaviours arise from regularised solutions to linear elasticity; the resulting deformation fields are analytical, volume-aware, efficient to evaluate and naturally parallelisable. Multiple Kelvinlets can also be combined subject to displacement or derivative constraints. citeturn19search6

This is strategically useful because **space deformation is representation-agnostic at the interaction level**. A deformation field can move sample points from a mesh, control vertices from a cage, generated geometry from a procedural object, or potentially parameters of a higher-level object through fitting. The exact implementation differs, but the artist can experience a consistent “grab and bend this thing” tool across object types. ARAP and Kelvinlets demonstrate two different mathematical families for achieving that sort of behaviour. citeturn19search3turn19search6

The consequence for Object Focus is significant: there may be no need to expose “sculpt mode” as a hard conceptual universe. **Brushes can instead be spatial operators with different persistence policies.** A grab might remain a parametric deformation operator; a crease might become a persistent feature curve; a broad flatten operation might become a planar constraint plus deformation; only genuinely destructive/high-frequency work would require baking into a topology-changing surface layer. That part is a proposed Biskiq design direction, not something the cited systems already combine end-to-end. citeturn19search1turn19search6

### Procedural construction need not feel procedural

A second false dichotomy is “direct manipulation versus procedural modelling”. A procedural system is only unpleasant when users have to think like programmers.

Womp’s current product is an interesting example: it describes its browser-native “Liquid 3D” system as SDF/CSG shapes that blend, merge and carve, with freehand strokes becoming solid parametric geometry. The notable idea is not Womp’s particular UI or the company’s broad claims of Boolean robustness; it is the **retention of editable construction after direct, gestural input**. citeturn17search0turn17search4

libfive offers a research/open-source version of the same conceptual inversion. Its functional representation describes solids through mathematical expressions; its Studio interface includes direct manipulation in which pushing and pulling the surface changes variables in the underlying script. In other words, **a procedural program can be the persistence mechanism without becoming the interaction mechanism**. citeturn22search1

That distinction is extremely important for Biskiq. “Procedural” should be considered an implementation/persistence property. Users could draw, drag, bend and sculpt while Biskiq quietly retains enough construction structure to make later edits intelligible. The product should expose the procedure only when doing so provides leverage—repetition, relationships, variants, dimensions, remapping—not because procedural machinery happens to exist underneath. citeturn22search1turn20search3


## Geometry, compatibility and the limits of a universal representation

No representation wins this problem. Each encodes a different notion of what is fundamental.

### Polygon meshes

Triangle and quad meshes make surface geometry explicit. They are extraordinarily convenient for rendering, selection, deformation, animation, interchange and local geometric algorithms. They also match GPU pipelines and glTF’s runtime representation directly; glTF deliberately describes itself as a runtime asset delivery format rather than an authoring format. citeturn18search0

Meshes become awkward when the creator wants the representation itself to carry exact intent. “This is a cylinder of radius 75 mm” is not naturally encoded by a cloud of vertices approximating a cylinder. Nor is “this opening remains circular after I edit the surrounding form”. Those semantics can be layered *on top* of a mesh, but the mesh alone does not provide them. Adaptive sculpting makes the limitation more obvious because the exact vertices and faces may disappear entirely after remeshing. citeturn16search4turn24search8

**Best Biskiq role:** universal evaluated surface, imported-asset representation, deformation substrate and optional explicit modelling layer—not the sole durable definition of every authored object.

### Subdivision surfaces

Subdivision retains a relatively compact control mesh and evaluates a smooth limit surface. OpenSubdiv is expressly optimised for high-performance subdivision evaluation on parallel CPU/GPU architectures, particularly deforming objects with static topology. ZBrush and Blender demonstrate the artist advantage of multiresolution editing: broad changes can be made at coarse levels and details retained at finer ones. citeturn25search0turn16search5turn16search4

Its Achilles heel is hiding in OpenSubdiv’s phrase **“static topology”**. Subdivision excels once surface connectivity is meaningful and stable; it is considerably less happy when the creator repeatedly merges masses, drills arbitrary holes, changes genus or grows new branches. Multires sculpting therefore complements rather than replaces remeshing/dynamic topology. citeturn25search0turn16search4

Conversion to precision surfaces is possible but demonstrates the boundary. Rhino 8 can convert SubD to NURBS, yet extraordinary vertices require approximation; enforcing higher continuity there can introduce bulges or dents. Geometry can cross the boundary, but it does not cross unchanged in every mathematical property. citeturn17search2

**Best Biskiq role:** refined freeform surfaces where persistent surface flow, smoothness and controlled creases matter; potentially a later-stage “surface refinement” representation rather than the universal sketching primitive.

### B-reps and NURBS

Boundary representations encode a solid through topological faces, edges and vertices whose underlying geometry can consist of precise parametric surfaces and curves. That makes them powerful for exact planes, cylinders, cones, fillets, trims, shells, Boolean construction and established CAD exchange. The mature Open CASCADE kernel is a concrete open implementation of this class of modelling technology. citeturn24search8turn25search11

B-reps are therefore attractive wherever Biskiq needs **engineering-grade explicit geometry**. They are less naturally suited to arbitrary brush-based topology-changing sculpting. Every face and trim is meaningful to the data structure, and downstream operations frequently refer to those entities—hence the large body of work around topological naming and feature history. citeturn24search3turn24search8

Fusion demonstrates a productive compromise. Users can convert B-rep faces into T-Spline form for freeform manipulation and later return T-Splines to B-reps. Yet T-Spline conversion imposes conditions: intersecting T-Spline edges prevent conversion, and triangle-heavy meshes are poor inputs. This is evidence that hybrid tools work, but also that **representation boundaries have contracts**. citeturn17search1

**Best Biskiq role:** explicit precision bodies, exact architectural/product features, high-value downstream interoperability and perhaps selected procedural operations—not necessarily the medium for every organic gesture.

### Voxels and sampled SDFs

An SDF represents the signed distance to a surface. A dense 3D grid is conceptually simple but expensive when fine detail exists throughout a large bounding volume. Adaptively Sampled Distance Fields addressed this by storing more samples where the field contains detail and fewer where it varies smoothly, organised in a hierarchy; the original work demonstrated artistic carving, precision forms, level of detail and other operations. citeturn20search0

Sparse volume structures take the same core efficiency problem seriously. OpenVDB is designed around sparse volumetric data and supports operations including SDF processing and conversion back to polygons; Houdini’s VDB tooling exposes practical conversions between VDBs, dense volumes and polygonal surfaces. citeturn22search7turn16search3

SDFs are particularly attractive for **unioning masses, subtracting volumes, smooth blending, offsets and topology change** because these operations can be expressed as operations on fields rather than surgical edits to an explicit surface mesh. Adobe’s clay system and Womp’s SDF/CSG workflow are production examples of the interaction advantages. citeturn16search2turn17search4

Producing an explicit surface is a separate operation. Classical contouring extracts polygons from a scalar field; Dual Contouring instead uses Hermite samples and a quadratic error formulation and can retain sharp edges and vertices better than basic marching approaches while operating on adaptive octrees. Its original paper even demonstrated real-time destructive modification of a signed-octree model. citeturn20search1

SDFs are not magic clay, however. A field does not inherently say “this patch is the original north face”, “this curve is a trim edge”, or “this UV coordinate should remain stable”. Thin features also demand adequate spatial resolution in sampled fields. Sharp features require appropriate construction/evaluation/meshing rather than emerging automatically from smooth blends. Those limitations follow from what is represented—samples or functions of spatial position rather than explicit persistent surface topology. citeturn20search0turn20search1

**Best Biskiq role:** highly compelling for early/mid-stage solid massing, topology-free sculptural construction, smooth blend/subtract workflows and possibly a persistent layer of parametric implicit operations.

### Functional and procedural implicit solids

A functional representation takes the field idea one step further: instead of primarily storing sampled values, it stores an expression that can answer whether or how far a point lies from a surface. CSG, primitives, transforms, blends and deformations can compose into expression trees. libfive describes this as functional solid modelling and supplies feature-preserving watertight meshing. citeturn22search1

The representation is conceptually beautiful for Biskiq because its authored state can remain compact and semantic: a sphere remains a sphere; a stroke-sweep remains a stroke-sweep; a blend remains an operator. Keeter’s work on massively parallel rendering of closed-form implicit surfaces shows how expression simplification, spatial subdivision and GPU evaluation can render fairly complicated functional models without first committing them permanently to a mesh. citeturn12search2

Fidget is a particularly interesting current open-source research implementation. As of October 2026 it is actively developed, uses Rust, supports point, interval, SIMD and gradient evaluation, provides 2D/3D implicit rendering and manifold dual-contouring meshing, and contains ongoing `wgpu` work. It is MPL-2.0 licensed. It should be viewed as a highly relevant technology/reference implementation rather than assumed to be a drop-in browser production kernel. citeturn22search2turn22search6

The major risk is evaluation complexity. A huge procedural tree cannot simply be evaluated naively at every pixel or sample. Spatial acceleration, expression pruning/canonicalisation, dirty-region evaluation and caching become central architectural concerns. There is also a user-model problem: arbitrary destructive edits do not trivially map back to elegant expression trees. citeturn12search2turn22search2

**Best Biskiq role:** perhaps the most interesting candidate for Biskiq-native authored “mass” geometry, especially when combined with persistent strokes/primitives and aggressive generated caches—but it should be experimentally compared against sparse sampled fields rather than crowned prematurely.

### Curves, sweeps and generalized structure

Curves deserve first-class representation status instead of being treated merely as helpers for making surfaces.

FiberMesh demonstrates curves as both construction inputs and persistent editing handles. Structured Annotations represents generalized cylinders through a spine, varying cross-sections and related semantic structure. These representations map unusually well to spatial design: rails, furniture legs, ducts, branches, fabric-like edges, exhibition structures, architectural sweeps and hand-drawn spatial gestures are naturally expressed by centreline plus section rather than a fully freeform blob. citeturn19search1turn20search3

This suggests a major Biskiq opportunity: **stroke-native solids**. A drawn stroke could remain a curve entity with profile, taper, twist, blend behaviour and attachment semantics rather than immediately degenerating into anonymous triangles. The exact sweep might evaluate to a B-rep when analytically tractable, an implicit volume while blended into neighbouring masses, or a mesh for display. That multi-output behaviour is an architectural proposal supported by the demonstrated usefulness of persistent curve controls. citeturn19search1turn17search1

### What converts cleanly—and what does not

The compatibility landscape can be summarised more honestly as follows:

| From → to | Geometric viability | Semantic survival |
|---|---|---|
| B-rep → mesh | Excellent and routine | Analytic surfaces, feature intent and exactness are generally reduced unless separately retained |
| Mesh → B-rep | Possible in restricted/reconstructed form | Weak; arbitrary triangle topology does not reveal original design intent |
| SubD → B-rep/NURBS | Production-proven | Approximation issues occur around extraordinary topology |
| B-rep ↔ T-Spline/freeform surface | Production-proven under conditions | Better than arbitrary mesh conversion, but validity restrictions remain |
| SDF/implicit → mesh | Natural through contouring | Construction history disappears unless explicitly carried as provenance |
| Mesh → SDF | Straightforward geometrically for suitable closed geometry | Original face identity/parameterisation is not recovered automatically |
| Procedural implicit → B-rep | Feasible for special analytic cases; difficult in general | Operation semantics can survive only where the conversion understands them |
| Any authored form → render mesh | Should be treated as routine | Safe **only** if the mesh is regarded as generated output rather than the sole source of truth |

The geometric conversion mechanisms are demonstrated by Houdini/OpenVDB, Fusion, Rhino and implicit contouring research; the semantic-survival column is the architectural inference that follows from persistent-reference research and the documented conversion constraints. citeturn16search3turn17search1turn17search2turn20search1turn24search8

This gives Biskiq a useful doctrine:

> **Do not require representations to be reversibly convertible. Require authored objects to retain enough source intent that an alternative evaluated representation can be regenerated when appropriate.**

That is a much more achievable requirement.


## Persistent editability, semantics and precision

### The topology problem is really an identity problem

Consider a sculpted exhibition plinth with a spotlight attached to “the upper-right face”. Now revise the plinth so the upper volume blends into a second mass. The original face might split, merge or cease to exist.

Open CASCADE’s TNaming machinery records old/new shape pairs with states including generated, modified, deleted and selected; one old face can correspond to multiple new faces after a split, and multiple old faces can correspond to a merged result. That machinery is useful precisely because entity evolution is not trivial. citeturn24search3turn24search6

FreeCAD’s 1.0 work on the topological-naming problem likewise added history mapping that tracks modified/generated/deleted sub-elements to make dependencies more resilient. The project describes this as mitigation of a long-standing problem, not the discovery of an eternal face identity handed down from geometry heaven. citeturn24search4

Recent cross-CAD B-rep matching research makes the theoretical problem clearer: persistent referencing is inherently ambiguous, and typical systems exploit feature history plus geometric heuristics. When history is unavailable across CAD systems, the researchers use geometry, topology and learned matching to recover likely correspondences. citeturn24search2turn24search8

**Implication:** Biskiq should not make generated vertex/edge/face IDs its highest-level identity system.

Instead, references should preferentially target durable authored concepts:

`Object → operation → authored region/control → generated geometric correspondence`

For example, “outer side of profile extrusion A”, “section of stroke B between control markers”, “blend generated between masses C and D”, “top cap of primitive E”, or “attachment anchor F” are potentially more durable than `Face 1772`. When generated topology changes, Biskiq can regenerate a correspondence and explicitly flag uncertainty where a one-to-one mapping no longer exists. This is an inference from CAD naming mechanisms and would need dedicated design/testing. citeturn24search3turn24search8

### Strokes and edits should have coordinate systems

Persistent editability becomes far more tractable when an edit is stored in the coordinate system where it actually means something.

A decorative groove painted along a sweep should ideally be parameterised along the sweep. An attachment on an authored primitive should use that primitive’s local frame. A deformation of a region might be attached to semantic handles or a cage. Surface detail on a stable SubD can use surface-relative coordinates. A spatial field deformation can live in object or world space depending on intent. Only the least semantic fallback should be “these exact vertices moved by these vectors”. FiberMesh’s retention of original curves as surface controls is a particularly clean historical example of making interaction data persistent rather than baking it away immediately. citeturn19search1

This suggests Biskiq should define several explicit **binding policies** for operations: object-relative, control-relative, surface-relative and world-relative. A crease painted onto a vase may be expected to follow the vase when its proportions change; a dent representing collision with a fixed wall may instead belong in world coordinates. The distinction is product semantics rather than a geometry-algorithm requirement, but making it explicit would prevent many “why did my detail move like that?” failures. citeturn19search1turn24search8

### Revision survival should be graded, not binary

A non-destructive system cannot truthfully promise that every downstream detail survives every upstream edit.

Blender’s multiresolution workflow is resilient when topology stays compatible: users can return to a low level for broad changes while preserving higher-frequency detail. But Blender explicitly warns that multiresolution prefers clean topology and that topology-changing workflows such as Dyntopo have different attribute-preservation behaviour. ZBrush makes the same coarse-versus-fine subdivision model central to refinement. citeturn16search4turn16search5

Biskiq should therefore model revision survival with different guarantees:

**Strong survival:** semantic constraints and authored controls can reevaluate exactly.

**Mapped survival:** downstream operations can be reattached through known provenance.

**Projected survival:** detail can be transferred geometrically to a changed surface but may distort.

**Invalidated:** the upstream edit destroyed the concept the downstream operation referred to.

That hierarchy is a proposed product contract derived from the different persistence behaviour of procedural history, persistent referencing and multires/detail transfer. citeturn24search3turn24search8turn16search4

Explicitly admitting invalidation is better than silently choosing a plausible but wrong surface. Sophisticated software often becomes untrustworthy not because it occasionally cannot preserve an edit, but because it pretends nothing happened.

### Precision can live above the sculpt

A common assumption is that expressive and dimensioned modelling must be separated because one manipulates shapes and the other manipulates equations. Structured Annotations is useful evidence against that assumption: sketch-created primitives were subjected to semantic relations such as equality, alignment, symmetry and connection. citeturn20search3

A Biskiq object could therefore have **protected invariants** while remaining visually freeform. Examples include:

- a hole remains 80 mm diameter;
- a seating surface remains 450 mm above the floor;
- two connection points remain 600 mm apart;
- a mounting patch stays planar;
- a light remains aimed at its target;
- a freeform shell keeps a minimum clearance around an existing object;
- a centreline stays attached to another authored curve.

These examples are proposed Biskiq behaviours; the feasibility of expressing relational constraints over higher-level controls is supported by structured sketching and established parametric/B-rep systems. citeturn20search3turn17search1

The trick is **not to constrain every surface sample**. Solve dimensions and relationships over a compact semantic parameter set wherever possible, then evaluate or deform the surrounding surface. A 50,000-vertex sculpture should not suddenly become a 150,000-variable CAD sketch because somebody typed “900 mm”. Differential deformation methods show how sparse handles can drive dense geometry, which is the useful computational pattern here. citeturn19search3turn19search6

Where an exact invariant conflicts with the requested artistic deformation, Biskiq should expose the conflict locally—lock, relax, break, or reinterpret the relationship—rather than entering a monolithic “constraint mode”. That interaction design is speculative but follows directly from treating constraints as first-class semantic relationships instead of a separate modelling universe.

### A possible persistent operation stack

A promising object might conceptually contain operations such as:

```text
SilhouetteMass
  └─ profile: Curve A
  └─ depth interpretation: symmetric
  └─ semantic regions: front / back / rim

Blend
  └─ target: Mass B
  └─ radius: 120 mm

Dimension
  └─ region: base width
  └─ value: 900 mm

SpatialDeform
  └─ handle curve: C
  └─ falloff: elastic

CreaseStroke
  └─ path: Curve D on authored region
  └─ depth: 8 mm

DetailLayer
  └─ projected / surface-relative data
```

Nothing in the cited literature implements exactly this Biskiq stack. The individual ingredients are demonstrated independently: inferred masses from sketching, persistent surface curves, semantic annotations, elastic deformation and operation-history tracking. The research opportunity is to find the smallest common authoring abstraction that lets these mechanisms cooperate. citeturn19search4turn19search1turn20search3turn19search6turn24search3


## Browser-native technical foundations and open-source opportunities

### The browser is viable, but geometry must be asynchronous

As of October 2026, WebGPU remains on the W3C Candidate Recommendation track and directly exposes both render and compute pipelines; WGSL likewise defines compute and rendering shader stages. This makes GPU field evaluation, parallel geometric kernels, selection acceleration and surface generation technically accessible from browser applications without abusing fragment shaders as pretend compute infrastructure. citeturn23search3turn23search0

For CPU kernels, Emscripten supports pthread-style shared-memory multithreading through SharedArrayBuffer and Web Workers. Production deployment requires the appropriate COOP/COEP isolation headers. Emscripten also exposes a lower-level Wasm Workers API when a native POSIX threading model is unnecessary. citeturn23search1turn23search10

The architecture that follows is fairly clear:

```text
Main browser thread
    UI, pointer input, immediate lightweight preview
          │
          ├── Geometry worker(s), WebAssembly
          │      B-rep / mesh / CPU solvers
          │
          ├── Evaluation worker(s)
          │      procedural graph, meshing, imports
          │
          └── WebGPU
                 render
                 field evaluation
                 compute-heavy spatial operations
```

This architecture is a recommendation, but the need to keep expensive model calculation off the interface thread is independently reflected in replicad’s documentation, which specifically recommends loading its OpenCascade WebAssembly module in a Web Worker so the interface remains responsive. citeturn25search4

A further rule should be **preview first, exact result second**. A brush or profile drag can update a coarse/local representation immediately; higher-quality contouring, B-rep conversion or full-detail recomputation can catch up asynchronously. This is an engineering inference consistent with adaptive representations and the browser worker model rather than a benchmarked Biskiq result. citeturn20search0turn23search10

### Incremental evaluation matters more than peak benchmark numbers

A procedural or hybrid system becomes unusable if every 5 mm cursor movement reevaluates the entire object graph.

Biskiq should therefore make locality architectural: operations need dirty bounds, representation caches need spatial subdivision, downstream evaluation should run only where inputs changed, and expensive conversions should happen lazily. Adaptive distance fields already demonstrate detail-directed hierarchical storage; Fidget and related functional-representation work use interval evaluation and expression simplification to prune regions that cannot intersect a surface. citeturn20search0turn22search2turn12search2

For example, dragging one blend control on a two-metre object should ideally invalidate a bounded volume around that blend, regenerate only intersecting field/mesh tiles and leave distant material coordinates, selection acceleration and high-detail patches untouched. That behaviour is a proposed implementation target, not a performance result currently demonstrated for Biskiq.

### The most relevant open foundations

| Foundation | What is useful | Browser / maturity signal | Licence / caution |
|---|---|---|---|
| **Manifold** | Robust solid Boolean operations on manifold triangle meshes; arbitrary vertex properties; provenance-style IDs for source surfaces | Active development in 2026; official JS/TS/WASM binding; performance/reliability are explicit project goals | Apache-2.0 citeturn22search0turn22search4 |
| **Open CASCADE Technology** | Mature B-rep/NURBS geometry, topology, fillets, chamfers, STEP and engineering operations | OCCT 8.0.1 current in 2026; Open Cascade itself now demonstrates local browser/WASM engineering workflows through CascadeScope; replicad wraps OCCT for browser modelling | LGPL-2.1 with Open CASCADE exception; integration surface is large citeturn25search11turn25search5turn23search2 |
| **replicad / OCCT WebAssembly ecosystem** | Higher-level JS abstraction over OCCT; practical precedent for browser CAD | Runs in modern browsers and documents worker-based OCCT integration | Useful integration reference; does not remove OCCT’s underlying architectural complexity citeturn25search1turn25search4 |
| **OpenVDB** | Sparse hierarchical volumes/SDFs and a substantial volume-processing ecosystem | Very active native project; useful algorithmic/data-structure foundation | Apache-2.0; full OpenVDB is a large native stack rather than a purpose-built browser editor citeturn22search7turn22search3 |
| **libfive** | Functional representations, CSG, feature-preserving watertight meshing, direct manipulation of procedural variables | Mature research/open-source implementation; active maintenance visible in 2026 | Core/stdlib MPL-2.0; Studio portions GPL; valuable reference even if not adopted directly citeturn22search1 |
| **Fidget** | Modern high-performance implicit evaluation, intervals, gradients, SIMD, meshing; ongoing GPU work | Very active in October 2026; Rust architecture is potentially attractive for Wasm experimentation | MPL-2.0; still better viewed as research-grade foundation/reference than complete production CAD subsystem citeturn22search2turn22search6 |
| **OpenSubdiv** | Industrial-quality high-performance subdivision evaluation | Version 3.8 released in 2026; CPU/GPU parallel evaluation; optimised for static-topology deforming surfaces | Current project uses the TOST licence; review fit before adoption citeturn25search0turn25search12 |
| **libigl** | Broad collection of mesh-processing/deformation algorithms suitable for experimentation | Mature geometry-processing library rather than a complete kernel | Useful algorithm source/building block rather than object model or persistence system citeturn8search7 |

There is no obvious single dependency Biskiq should bet the product on. A plausible combination is **OCCT for specialist precision B-rep operations, Manifold for robust generated-mesh solid work, and a dedicated Biskiq-native field/procedural layer informed by libfive/Fidget/OpenVDB research**. OpenSubdiv could then serve smooth explicit surfaces where appropriate. That is an architectural hypothesis to benchmark, not a recommendation to concatenate five kernels and pray. citeturn22search0turn25search11turn22search2turn22search7turn25search0

In fact, dependency sprawl is one of the strongest arguments **against** an over-general hybrid architecture. Cross-representation provenance, duplicate spatial acceleration structures, memory copies between JS/Wasm/GPU, numerical tolerance differences and debugging across multiple kernels can overwhelm the theoretical elegance. Biskiq should therefore require each additional canonical representation to justify itself through creative capabilities that cannot be achieved reasonably in the primary representation.

### A browser-specific rendering strategy

For implicit/form-field objects, there are three plausible rendering paths:

**Mesh continuously.** Straightforward downstream rendering and picking, but potentially expensive while editing.

**Render the field directly.** Functional implicit research demonstrates direct GPU evaluation and ray intersection approaches, avoiding continuous full remeshing but requiring sophisticated acceleration and field-aware rendering. citeturn12search2

**Hybrid preview.** Direct/coarse field rendering during interaction, followed by asynchronously generated adaptive meshes for stable display, selection, shadows, exports and downstream operations.

The hybrid is the most promising for Biskiq because it decouples interaction latency from final representation quality. Fidget’s current combination of implicit evaluation, GPU-oriented work and dual-contouring meshing illustrates that these two paths can coexist in one technology stack, although its exact performance in Biskiq’s browser workloads needs measurement. citeturn22search2turn22search6

### Interchange should distinguish authoring from delivery

Biskiq should not expect standard interchange formats to preserve its complete authoring model.

glTF explicitly states that it is **not an authoring format**; it prioritises compact, efficient runtime delivery of meshes, materials, animation and scenes. That makes it ideal for publishing/presentation and a sensible mesh/material interchange target, but not the canonical persistence format for Biskiq’s editable operations. citeturn18search0

OpenUSD has a different strength: it is designed for scalable scene description, layering, references, variants and non-destructive composition across applications. Its own documentation distinguishes those scene-composition responsibilities from specialised high-performance behaviours such as rigging execution. USD therefore looks valuable for world/asset interchange and composition semantics, but it still does not solve Biskiq’s internal expressive-geometry semantics automatically. citeturn17search3

For engineering exchange, STEP/B-rep export through a kernel such as OCCT is the natural specialist path. Browser OCCT stacks such as replicad already demonstrate STEP export in a WebAssembly-backed application. citeturn25search1turn25search4

The practical model is therefore:

**Biskiq authored document → evaluators → fit-for-purpose interchange**

rather than

**external interchange format = Biskiq document model**.


## Implications for Biskiq and competing architectural interpretations

### A recommended product model: semantic form with representation islands

The strongest architecture emerging from the evidence is a **semantic authoring graph with representation islands**.

An authored Biskiq object would not have to declare itself forever as “a mesh”, “an SDF” or “a B-rep”. It would consist of semantic operations. Contiguous portions of its evaluation graph could use whichever representation best satisfies those operations. Conversion boundaries would be explicit and cached. Persistent identity would belong primarily to the semantic graph; evaluated geometry would carry provenance back to it. This recommendation follows from the conversion limits and persistent-reference problems described earlier. citeturn17search1turn17search2turn24search8

A conceptual graph might look like:

```text
Sketch / primitive / imported source
              │
              ▼
      semantic construction
   profiles • spines • masses
   dimensions • relationships
              │
      ┌───────┴────────┐
      ▼                ▼
 implicit island    B-rep island
 blends/sculpt      exact features
      │                │
      └───────┬────────┘
              ▼
       deformation layer
              │
       optional SubD/detail
              │
              ▼
      generated render mesh
```

The key word is **island**. Do not continuously bounce geometry back and forth between B-rep, mesh and SDF after every operator. Keep compatible operations together and cross representation boundaries only where the user intent genuinely changes. Fusion and Rhino demonstrate that conversion boundaries can be useful; their documented restrictions also show why excessive round-tripping would be dangerous. citeturn17search1turn17search2

### What should probably be native in Biskiq

**Stroke- and profile-driven creation should be native.** It has exceptionally high expressive leverage per interaction, maps well to both architecture and object design, and can remain semantic rather than immediately becoming raw geometry. FiberMesh and structured sketching provide especially strong evidence for persistent curves as authored controls. citeturn19search1turn20search3

**Implicit mass composition should receive serious architectural investment.** Smooth union/subtraction, topology freedom and the ability to turn strokes or primitives into persistent volumetric contributors align directly with Biskiq’s spatial/multidisciplinary use cases. Adobe Modeler, Womp, ADF research, libfive and Fidget together show that this is not an exotic dead end. citeturn16search2turn17search4turn20search0turn22search1turn22search2

**Spatial deformation should be representation-spanning.** Grab, bend, twist, bulge, pinch, taper and cage/handle transformations are likely more useful as a common Biskiq interaction language than as tools locked inside a sculpting subsystem. Kelvinlets and ARAP provide plausible computational families. citeturn19search6turn19search3

**Dimensions and relationships should attach to semantic controls.** This provides a route to measured expressive form without turning Biskiq into a sketch-constraint CAD application. Structured Annotations offers direct precedent for mixing freeform input and semantic constraints. citeturn20search3

**A controlled destructive escape hatch should also be native.** There will always be forms that the semantic graph did not anticipate. Preventing creators from making them in the name of editability would turn “progressive mastery” into “progressive annoyance”. Dynamic topology or local field sculpting should therefore exist, but the UI should communicate when an edit is crossing from strongly parametric intent into weaker correspondence. Blender’s split among Dyntopo, voxel remeshing and multires is evidence that these editing contracts genuinely differ. citeturn16search4

### What should probably remain specialist territory

Biskiq does not need to reproduce all of a mechanical CAD kernel’s surface-construction repertoire in its own interaction language. Exact fillet pathology, complex trimmed-surface repair, manufacturing feature recognition and industrial STEP healing are specialist problems that mature kernels such as OCCT exist to solve. A high-quality integration boundary is likely more defensible than rebuilding decades of CAD numerics merely to claim feature parity. citeturn25search11turn23search2

Likewise, high-end character-production retopology, rigging and animation-specific topology are not natural core Biskiq requirements merely because they appear next to sculpting in conventional DCC software. Subdivision should be adopted where its surface behaviour serves Biskiq’s objects, not because Maya/ZBrush workflows imply every sculpt must eventually become an animation-ready quad cage. OpenSubdiv itself is an evaluator for static-topology subdivision; it does not imply a whole DCC workflow. citeturn25search0

### Imported and AI-generated geometry should not be granted fake semantics

Imported STL/OBJ/glTF or AI-generated meshes often arrive without the construction intent that produced them. Biskiq should resist pretending otherwise.

Such an object can still support transformation, spatial deformation, segmentation, material assignment, Boolean use, SDF conversion, snapping and presentation. But recovering a clean sequence such as “extrude this profile, then fillet these edges” from arbitrary triangles is a fundamentally different inference problem from editing an authored Biskiq object. Persistent-reference research already demonstrates how difficult correspondence is even between two B-reps of related CAD designs. citeturn24search8

Therefore, imported geometry should have an explicit **foreign/derived provenance state**. A creator could progressively re-author important parts: identify an axis, fit a plane/cylinder, draw a replacement profile, declare symmetry, wrap a cage, or convert a selected region into a native mass. AI assistance could accelerate that process, but the resulting semantic entities should be reviewable and editable rather than hidden guesses.

For AI generation specifically, the most valuable output for Biskiq would often be **editable construction**, not a final mesh: primitives, curves, parts, approximate dimensions, relationships and procedural operations. Where a model can only provide an opaque surface, treat it as an asset/reference rather than contaminating the core authored graph with fabricated certainty. This is a product recommendation rather than a claim about current general-purpose AI reliability.

### Concrete workflow scenarios

#### Exhibition plinth in fifteen minutes

The creator draws an asymmetrical top-view silhouette, pulls its height, then drags a second freehand stroke across one side to add a protruding mass. The two blend smoothly. A broad grab makes the upper portion lean. A flat-bottom relationship keeps it planted on the floor.

Teddy supports the plausibility of silhouette-to-volume input; Womp and implicit modelling demonstrate direct composition/blending of volumetric forms; Kelvinlets provide a technical model for the broad spatial grab. citeturn19search4turn17search4turn19search6

The user never sees topology.

#### The same plinth after several hours

The creator sets the overall width to 1,800 mm, constrains a display recess to 600 × 300 mm, attaches lighting geometry to a named recess frame, adds deliberate crease curves and tunes transitions. Fine surface irregularity is added as a late detail layer.

Here the original massing remains editable because the silhouette, added mass and deformation are authored operations. Dimensions operate over semantic controls. Attachments target authored frames, not arbitrary generated face indices. Detail may be surface-relative and therefore carry a weaker revision guarantee than the dimensions. That workflow is the proposed synthesis of persistent curves, semantic constraints and topology-history lessons. citeturn19search1turn20search3turn24search8

#### Sculptural chair

The seat begins as an inflated profile; the user draws leg spines and assigns cross-sections. A symmetry relationship is initially active, then deliberately broken. A broad elastic deformation changes the posture of the chair without individually editing control points. The mounting points to the floor remain fixed.

Generalized cylinders/spines, persistent curves and constraint-based deformation all have research precedent, even though their integration in this exact workflow is a Biskiq proposal. citeturn20search3turn19search1turn19search6

#### Imported generated statue

The statue arrives as a dense triangle mesh. Biskiq displays it immediately and allows positioning, materials and cage/field deformation. The creator selects the pedestal region and asks Biskiq to rebuild that part as a native dimensioned cylinder while leaving the figure as imported geometry.

This avoids the doomed requirement that a single conversion recover complete parametric authorship from arbitrary surface geometry. Production conversion tools themselves impose substantial restrictions even for much more structured SubD/T-Spline inputs. citeturn17search1turn17search2

### The strongest alternative: make everything an implicit field

There is a credible argument for going much further and making an implicit/functional representation the canonical Biskiq object substrate.

The appeal is enormous: solids are closed by construction; topology changes naturally; primitives and procedural operations remain compact; strokes can become volumetric contributors; blending and Boolean composition are elegant; meshing becomes a downstream concern. ADFs, libfive, Adobe Modeler, Womp and current Fidget work collectively establish a substantial evidence base for the representation family. citeturn20search0turn22search1turn16search2turn17search4turn22search2

**The argument against it is equally serious.** Exact B-rep semantics, clean surface parameterisation, stable surface identity, explicit sharp/trim features, mature CAD interchange and arbitrary artist-directed surface flow do not naturally fall out of an SDF. Sampled fields introduce resolution concerns; functional fields introduce evaluation complexity; both need meshing or specialised direct rendering for many downstream tasks. citeturn20search0turn20search1turn17search1

My assessment is therefore: **implicit geometry is the strongest candidate for Biskiq’s native expressive mass language, but a weak candidate for being the only geometry language.**

### The conservative alternative: mesh/SubD core plus B-rep specialist mode

A second credible strategy is to use explicit mesh/SubD surfaces for almost all freeform work and invoke B-rep tools only when precision solids are needed.

The advantage is ecosystem maturity. Mesh deformation, rendering, selection, UVs and subdivision are deeply understood; OpenSubdiv is production-proven; adaptive mesh sculpting is ubiquitous. B-rep precision can remain delegated to OCCT. citeturn25search0turn16search4turn25search11

The weakness is that Biskiq then inherits the exact workflow seams it hopes to transcend: topology becomes visible sooner, Boolean/topology changes fight detail persistence, and converting between expressive mesh and exact B-rep remains semantically lossy. Fusion and Rhino’s conversion constraints illustrate the problem. citeturn17search1turn17search2

This approach is lower conceptual risk, but may produce a nicer browser DCC rather than the differentiated creation model Biskiq is seeking.

### The radical alternative: everything is procedural intent

At the other extreme, Biskiq could model every edit as an operation in a persistent procedural graph.

This maximises replayability, provenance and semantic revision. libfive’s direct manipulation of script parameters shows that procedural state need not force code-based interaction. citeturn22search1

The failure mode is “history spaghetti”: a ten-hour creative session can accumulate hundreds or thousands of operations whose dependencies are difficult to reason about or reevaluate efficiently. Worse, some hand-made edits simply do not possess a meaningful compact parameterisation. Requiring one creates an authoring tax.

The more defensible compromise is therefore **selective procedural persistence**: retain meaningful construction and editable gestures; compact/bake low-value history into explicit layers when appropriate; preserve provenance through that bake so later operations still know what they refer to.


## Discriminating experiments and unresolved questions

The next step should not be another giant architecture document based purely on taste. A small set of prototypes can eliminate entire families of bad assumptions.

### The highest-value experiment: semantic implicit massing

Build a browser prototype with only:

1. primitive masses;
2. stroke-swept masses;
3. smooth union/subtraction;
4. direct transform;
5. grab/bend deformation;
6. dimension constraints on selected controls;
7. generated adaptive display mesh.

Implement the authoring graph independently from the evaluator. Compare a **functional implicit evaluator** inspired by Fidget/libfive with a **sparse sampled-field evaluator** inspired by ADF/OpenVDB concepts. Use identical interactions and documents so representation differences can be measured rather than argued about. The relevant prior work establishes both representation families as viable; it does not establish which is superior for Biskiq’s workload. citeturn22search2turn22search1turn20search0

Measure end-to-end latency for drag updates, memory growth, meshing cost, thin-feature fidelity, sharp-feature handling, model complexity scaling, load/save size and the cost of changing an early operation after hundreds of later operations.

A particularly important test is not “can it make a blob?” Every respectable field system can make a damn blob. Test a mixed object: smooth upholstered mass + crisp slot + thin arm + exact cylindrical opening + several late-stage creases.

### Test whether persistent strokes beat generic brushes

Prototype two versions of the same design exercise.

In one, strokes are conventional destructive sculpt strokes.

In the other, strokes become persistent curves that can control a sweep, crease, blend boundary or deformation.

Then ask users to make a form quickly, leave it, return and substantially revise proportions without recreating secondary detail. FiberMesh suggests persistent curves can preserve far more design leverage than ephemeral sketch gestures; Biskiq should test whether that advantage generalises to spatial-design objects rather than character-like freeform models. citeturn19search1

The discriminating metric is not only completion time. Measure **revision distance**: how many user actions are required to turn version A into a materially different version B while preserving intentional detail?

### Test semantic anchors through topology destruction

Create objects with lights, materials, dimensions, annotations and child objects attached to regions. Then perform deliberately hostile edits:

- merge two volumes;
- split one volume;
- drill a new opening through an attachment region;
- massively alter a silhouette;
- convert a section between representations;
- remesh at radically different density.

Compare four attachment strategies: raw face ID, geometric nearest-point matching, operation-history/provenance, and semantic anchor + geometric fallback.

CAD research predicts that purely topological identifiers will be fragile and that historical information materially improves correspondence. This experiment would determine how much additional semantic structure Biskiq actually needs for its workflows. citeturn24search3turn24search8

A key UX experiment should accompany it: when correspondence becomes ambiguous, is it better to ask the user, show multiple candidates, preserve the old spatial position, or explicitly break the reference?

### Test precision inside deformation, not beside it

Take a sculptural object with five invariants—two fixed attachment points, one planar region, one diameter and one distance.

Compare three approaches:

**A:** deform freely, then repair precision afterwards.

**B:** forbid the deformation where it would violate constraints.

**C:** continuously project the deformation back into a constraint-satisfying solution, with local feedback where constraints resist the gesture.

Structured sketching demonstrates semantic constraints in freeform construction, while ARAP/Kelvinlets provide dense deformation mechanisms. What remains unresolved is whether the combined interaction feels empowering or as though the software is wrestling the creator. citeturn20search3turn19search3turn19search6

That user-experience result should heavily influence whether precision is deeply integrated into expressive form or deliberately kept at representation boundaries.

### Benchmark kernel boundaries in the actual browser

Build the same ten geometry operations in:

- Manifold/Wasm;
- OCCT/Wasm;
- the candidate implicit evaluator;
- generated mesh operations where appropriate.

Run them on ordinary target laptops, not workstation fantasy machines.

Manifold already exposes Wasm bindings and emphasises solid-mesh reliability; OCCT has concrete browser deployments and a rich B-rep stack; WebGPU/WebAssembly provide the execution foundation. None of that tells Biskiq what latency, binary size or memory behaviour its own workloads will see. citeturn22search0turn25search5turn23search3

Measure cold-load size, peak memory, Boolean latency, incremental recomputation, main-thread blocking, mesh transfer costs, worker startup, cross-representation conversion and high-DPI rendering cost. Open Cascade’s own browser documentation notes that the OCCT runtime/format workers make the first load larger than an ordinary webpage, illustrating why deployment characteristics deserve first-class measurement. citeturn25search5

### Determine where baking becomes a feature rather than a failure

Perfect infinite editability is probably the wrong goal.

An operation graph should allow intentional **checkpoints**: “freeze this mass into a stable freeform surface”, “commit this implicit result as a B-rep”, “collapse these 80 deformation gestures into a single editable shape state”. The unresolved problem is what metadata must survive that boundary so children, constraints and later details remain meaningful.

Production conversion systems make such representation transitions routine, while persistent-reference literature shows why identity must be handled deliberately during them. citeturn17search1turn17search2turn24search8

A successful Biskiq checkpoint would therefore not mean “everything before this is gone”. It would mean “the evaluated geometry is now authoritative for this layer, while selected authored anchors and provenance are retained.”

### Questions that should remain deliberately open

**Should the principal expressive representation be functional implicit or sparse sampled SDF?** Functional representations preserve construction compactly and potentially offer elegant direct manipulation; sampled fields can make arbitrary local modification and bounded incremental updates conceptually simpler. The research supports both; workload-specific measurement is needed. citeturn22search1turn22search2turn20search0

**How much SubD does Biskiq actually need?** Subdivision is tremendously good at smooth surface refinement, but committing too early creates a static-topology regime. It may belong as an optional refinement island rather than a mandatory destination for every expressive object. citeturn25search0turn16search4

**Can B-rep operations be embedded invisibly enough that creators never experience a CAD “mode switch”?** Fusion’s T-Spline/B-rep workflow shows that representations can cooperate, but conversion constraints and topology semantics remain real. Biskiq may be able to hide the machinery for common cases while exposing specialist boundaries only when necessary. citeturn17search1

**Can detail be represented independently enough from base form to survive radical revisions?** Multiresolution sculpting succeeds while correspondence is stable; topology-changing sculpting breaks that assumption. A combination of semantic strokes, surface-relative displacement and reprojection may substantially extend revision survival, but this deserves dedicated experimentation. citeturn16search4turn19search1

**How much history should a creator ever see?** A semantic graph is technically powerful, but exposing a Houdini-like node network by default would violate Biskiq’s immediate-creation goal. The important research problem is to design history as an underlying capability that emerges through direct manipulation, lightweight object structure and contextual editing rather than graph management.

## Strategic conclusion

The most defensible long-term direction is **not to build a browser ZBrush, nor a prettier CAD modeller, nor an implicit modeller with twenty more buttons**.

Biskiq has an opportunity to treat expressive 3D creation as a continuum:

**draw intent → infer form → manipulate form → establish relationships → refine surfaces → add artistic detail → compose in space → revise any of the meaningful controls that remain semantically valid.**

The strongest prior systems each solve a slice of that continuum. Teddy shows how aggressively 3D construction can be inferred from a tiny amount of input. FiberMesh shows that the original sketch can remain part of the object instead of being discarded. Structured Annotations shows that freeform creation can carry dimensions and relationships. Sculpting systems show the visceral value of topology-free local manipulation. Kelvinlets and ARAP show that sculpt-like interaction can operate through deformation rather than raw vertex editing. Implicit representations show how topology-changing construction can remain compact and editable. CAD kernels show where exact geometry and industrial interoperability still matter. Persistent-naming research shows why none of the generated representations should be trusted as the sole location of long-term identity. citeturn19search4turn19search1turn20search3turn16search4turn19search6turn19search3turn22search1turn24search8

The resulting architectural principle is:

> **Preserve intent where intent exists; preserve geometry where geometry is the intent; generate everything else.**

That means a circle the creator dimensioned should remain a circle. A stroke they drew as a spine should remain a spine. A blend should remain a blend while it is useful to do so. A hand-sculpted wrinkle that has no deeper semantic meaning does not need to masquerade as a procedural feature. And the millions of triangles required to render the result absolutely do not deserve promotion to supreme commander of the object model just because the GPU happens to like them.

For **World**, this points toward a deliberately compressed interaction vocabulary: strokes, profiles, masses, cut/add/blend, direct deformation, snapping, relational dimensions and semantic attachments. The user should usually manipulate an object at the level at which they are thinking about it.

For **Object Focus**, the same authored object can progressively disclose its deeper structure: control curves, sections, deformation handles, blends, implicit contributors, exact regions, constraints, surface refinement and selective destructive detail. Nothing about “progressive mastery” requires hiding sophisticated geometry; it requires postponing sophistication until it creates leverage.

For the **geometry foundation**, the evidence argues against choosing one universal representation prematurely. The most promising architecture to investigate is a semantic operation graph whose first-class expressive language combines curves, parametric primitives, implicit masses and spatial deformations; generated adaptive meshes provide ubiquitous display/interchange; SubD or explicit meshes handle selected refined surfaces; B-rep exists as an exact-geometry island where its strengths justify the additional complexity. Functional implicit systems such as Fidget/libfive, sparse-field work such as ADF/OpenVDB, Manifold’s robust solid-mesh kernel and browser-capable OCCT each provide valuable foundations or reference implementations, but none individually resolves the whole authoring problem. citeturn22search2turn22search1turn20search0turn22search7turn22search0turn25search5

And for **long-term differentiation**, the most interesting opportunity is not a novel brush. It is a geometry system in which **gesture, precision and revision are not separate modes of thought**. A user could sketch a form as casually as drawing, pull it around like clay, tell one opening to stay 800 mm wide, attach another object to a meaningful region, revisit the original silhouette hours later and have the system preserve everything it legitimately can while honestly identifying what it cannot.

No existing approach reviewed here demonstrates that complete experience. The component ideas, however, are surprisingly well supported. The biggest research risk is no longer whether sophisticated browser geometry is possible; current WebGPU, WebAssembly, browser OCCT deployments and active Wasm-capable geometry projects make that increasingly credible. The real risk is **semantic architecture**: deciding what Biskiq considers authored, what can be regenerated, what identities survive revision, when a representation boundary should be crossed, and when the system should stop being clever and let the creator bake the damn thing. citeturn23search3turn23search1turn25search5turn22search0

Those are exactly the questions the next architecture investigation should optimise around.