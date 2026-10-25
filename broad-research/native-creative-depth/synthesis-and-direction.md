# Native creative depth: synthesis and recommended direction

**Research date:** 25 October 2026  
**Status:** Research synthesis and recommendations. No architecture ratification, production implementation, dependency adoption, or roadmap release.  
**Package:** [Native creative depth](./README.md) · labels follow the package's [evidence conventions](./README.md#3-how-to-read-the-evidence)

**Question:** How can Biskiq become a powerful yet effortless, self-contained environment for multidisciplinary spatial creation, without inheriting the complexity of traditional 3D modeling, CAD or BIM software?

## 1. The answer in brief

**R** Make *context* the modeling tool.

**I** Most of the custom form an ordinary spatial project needs is **context-dependent**. It fits a wall, follows a stair, runs around a room, sits on a platform, or repeats along an edge. Generic modelers make creators rebuild that context by hand, from planes, booleans and plugins. That is where most of the community pain sits ([creator evidence](./creator-evidence.md#6-twelve-recurring-mechanisms)).

Biskiq already owns that context. Walls with exact curved frames, hosted Openings, derived Rooms, Levels and overheads are its semantic structure.

**R** The recommended direction has seven parts:

1. **One small creative language: profile, carrier and rule.** A *profile* is a 2D section or outline. A *carrier* is where it goes, usually taken from an existing host. A *rule* says how the two meet: extrude, revolve, sweep, distribute, subdivide, or span between two carriers.

   Domain-owned *families* compose the language and add meaning, validation and refusal. One family is a railing on a stair, which belongs to architecture. Another is a lamp revolved from a profile, which belongs to Scene. ([§4](#4-one-creative-language-profile-carrier-and-rule))
2. **Draw on things first, with basic spatial drafting as part of the foundation.** Profiles and outlines are drawn in readings that provide an exact surface: ground, a raised sheet, Face, Unroll, Section and Edit shape. Carriers are picked from hosts more often than drawn.

   **Basic spatial drafting** belongs in the foundation:
   - axis locks;
   - vertical linework;
   - planar host faces at any orientation, such as a roof plane or a ramp;
   - planes offset from a host.

   A free workplane on no host must earn its place, and unrestricted cross-plane chains are a late, narrow need ([§5](#5-how-the-language-fits-the-ratified-shell); [P2](./proof-agenda.md#p2-a-drafting-ladder-from-host-surfaces-to-free-chains)).
3. **Presentation depth has equal standing.** This means:
   - real-scale texture coordinates on every generated form;
   - profile-level rounding;
   - material-level detail, such as cut-outs with correct shadows, decals, text and photo standees;
   - lighting, saved views and still capture.

   The "fake it" route experts recommend is legitimate depth for this product, provided it survives free movement in the visitor runtime.
4. **Found objects are first-class content.** Furniture, sculpture, ornament and manufacturer items arrive through import or AI generation. They need a light, non-destructive edit kit and re-import that keeps placement and finishes. Imports can also fill semantic slots, for example a baluster in a railing pattern or a capital on a column.
5. **Families heal semantically and refuse in words.** When a host changes, hosted work follows declared relations, and the consequence is previewed. Silent repair is forbidden by the [North Star](../../docs/reference/north-star.md#permanent-non-goals).

   Every family names its failures in design terms, such as "the rail is steeper than the stair allows", and offers the fix. Validation counts as a feature.
6. **Identity is designed, not recovered.** Families name their parts by role, using persisted authored keys. Their owners publish correspondence. References default to whole objects or role groups. ([geometry §5](./geometry-identity-and-performance.md#5-identity-and-correspondence))
7. **The technical base is TypeScript domain evaluators.** They run inside the owning compilers and share small, runtime-safe numeric modules: curves, offsets, frames, sweeps, tessellation and UVs.
   - **Manifold** remains the only admissible solid-boolean library. It would be a gated, editor-only spike for explicit Scene booleans.
   - **No custom Rust/WASM case is established.** No evidence gathered meets the North Star gate, and none rules it out. The one production hot path measured, the wall compiler and mesher, is TypeScript with algorithmic levers still unused ([geometry §1](./geometry-identity-and-performance.md#1-findings-in-brief)).
   - **No heavy kernel** reaches the visitor runtime. Visitors receive compiled derivatives, or re-evaluate cheap families with the same runtime-safe evaluators. ([geometry §4](./geometry-identity-and-performance.md#4-typescript-rustwasm-and-specialized-kernels))

**R** **What stays outside:**

- arbitrary B-rep editing with neighbor healing;
- general booleans as the main path;
- three-dimensional fillets;
- freeform surfacing;
- feature-history trees;
- node graphs;
- sculpting and UV unwrapping;
- fabrication documentation.

These remain specialist work, reached through glTF handoff and import. They fit the North Star's existing list of upstream territory, and the research found no evidence that ordinary creators need them inside Biskiq.

**I** **Why this is effortless rather than merely capable:**

- The language has three concepts, not thirty operations.
- Every parameter is a Card fact that a handle can pull.
- Carriers come for free from what the creator has already made.
- Revision preserves work because families keep intent.

The creator never meets a face that will not form, a profile that twists, a tolerance, a segment count, a broken boolean, or a regeneration that wipes their edits. Those are the twelve mechanisms in the creator evidence.

## 2. Status ledger: what exists, by kind of evidence

**O** The table separates what is demonstrated, ratified, proposed, open and undecided. Use it to avoid treating a prototype or a destination as shipped.

| Capability relevant to native form | Status | Evidence | Consequence |
| --- | --- | --- | --- |
| Curved Walls as cubic chains with arc-length parameterization | **Production** | `LayoutWallCenterline` (`'line' \| 'cubic-chain'`) in [`packages/layout-core/src/layout-wall-first-types.ts`](../../packages/layout-core/src/layout-wall-first-types.ts); arc-length tolerance 1e-6 m in [`packages/layout-core/src/layout-geometry-curve.ts`](../../packages/layout-core/src/layout-geometry-curve.ts) | A curved host already has an exact (s, z) frame. Host-local drawing extends existing mathematics |
| Openings cut in the Wall's (s, z) frame: rectangular, rounded or pointed, with metre offsets from the Wall start, and no CSG | **Production** (geometry) | `LayoutWallOpening`; [assessment §1](../procedural-architectural-authoring-assessment.md#1-executive-verdict); a curved wall with 40 arched Openings compiles and meshes without issues ([probe](./probe-methods.md#4-results-the-matched-40-opening-wall)) | The *geometry* of the SketchUp curved-wall-window failure class is solved analytically. Generalize the pattern, not a boolean kernel |
| Wall mesher: metric arc-length UVs, opening reveals, a role-tagged pick partition, fail-closed issues; shared with the visitor runtime | **Production** | [`wall-mesh-builder.ts`](../../apps/editor/src/lib/layout/wall-mesh-builder.ts) (`Layout3dTriangleRef`, `pickRanges`) | Generated forms can own real-scale UVs and role-addressed surfaces by construction. Identity by role already ships at surface granularity |
| Opening authoring on the Stage | **Not wired.** Layout-core plans Opening create and delete, but "none is wired to the editor". The Opening family slice (S03) is not authorized | [T1.P02](../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md); [S03 outline](../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s03-opening-family/implementation-plan.md) | **The creator workflow does not exist yet.** The foundation is production; the workflow is two held or unauthorized slices away |
| Curved hosts and curve authoring | **Unplanned.** S03 excludes curved hosts; curve allocators stay outside accepted intents "until the first curve-authoring slice", which no plan scopes; T1.P02's outcome draws straight Walls | S03 outline; [S05 plan](../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s05-legacy-layout-retirement/implementation-plan.md) | No planned slice lets a creator put a window in a curved wall. This is a reconciliation observation, not a promotion ([handoff §7](./roadmap-handoff.md#7-reconciliation-with-current-authorities-and-roadmap)) |
| Exact planar noding and face extraction (`robust-predicates`) | **Production** | [harvest §1](../geometry-library-harvest.md#1-what-p3-has-and-what-it-relies-on) | A robust 2D base exists. There are no area booleans or offsets yet |
| Primitives (box, plane, cylinder, sphere) and the creator's own GLB models placed on compiled support; move, yaw, uniform resize, duplicate, delete | **Production** (T2.P01; T2.P02.S02) | [Scene content](../../docs/reference/components/scene-content.md#current-implementation) | Imported objects have a working path. Native custom forms and non-uniform edits do not |
| One accepted history, typed intents, F4 acceptance | **Production** (T3.P01) | [North Star](../../docs/reference/north-star.md#shared-authoring-operations) | Every form operation can be one accepted intent with one undo step |
| Wall drawing on the Stage | **Held** (T1.P02.S02, behind the S06 performance-first halt) | [release list](../../docs/roadmap/now.md) | No production drawing gesture exists yet to extend |
| Stroke readings with Tab alternatives, Box and Round tips, explained snapping | **Prototype** (P3 Vellum, accepted creative finding) | [Vellum README](../../prototypes/p3-vellum/README.md) | The "draw what you mean, read it back" grammar is demonstrated as interaction intent |
| Overhead as one authored section of profile points with stable IDs and crease flags, carried across an outline by extrusion or revolve, with Edit shape in context | **Prototype** (P3) | `Overhead` in [`prototypes/p3-vellum/src/model/types.ts`](../../prototypes/p3-vellum/src/model/types.ts) | **The profile, carrier and rule idea already works for overheads, with stable profile identity** |
| Fixed object catalog; Vellum's design notes cede ornament, freeform surfaces and terrain to Rhino, SketchUp, Blender or Revit | **Prototype** (P3) | `ObjType` in the same file; [Vellum DESIGN](../../prototypes/p3-vellum/DESIGN.md) | Custom object forms are untested anywhere in Biskiq |
| One-answer qualification: chip, preview and commit share one pure function | **Prototype** (P3); recommended compiler invariant | [harvest §5](../geometry-library-harvest.md#5-recommendation-matrix-reconciled-2026-10-22) | Every family should qualify once and refuse in words |
| Arrangement and light responding to a reshaped Wall | **Prototype** (P2) | [Smart Wall](../../prototypes/p2-smart-wall/README.md) | Revision continuity is the value creators feel. It depends on declared relations |
| Ink with readings; Shape as a reading pulled by a height ray; Height Sheet; Face, Unroll and Section; Edit shape; precision ladder; the Card as the one writer; capability placement | **Ratified destination** (PLATE, Round 2) | [PLATE §0.8.4](../../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination) | The shell already contains nearly all the interaction vocabulary the language needs |
| Native forms grow family by family in the canonical compiler; established kernels may evaluate Layout-declared families; a kernel exception is a typed refusal; owners publish correspondence | **Ratified destination** (convergence, 2026-10-22) | [architecture](../../docs/reference/architecture.md#product-convergence-destination) | Layout families are ratified. Scene-owned native forms are not addressed |
| Definitions exposing parameters, material slots, configurations and limits; instances with overrides; solve-once placement; deliberate attachment; admitted parts with opaque identity | **Ratified destination** (Scene) | [Scene content](../../docs/reference/components/scene-content.md#ratified-destination-not-shipped) | **A parametric Scene form fits the definition and instance model directly.** Generated-part identity is not specified |
| AI as a first-class client of the same typed operations | **Ratified direction** | [North Star](../../docs/reference/north-star.md#ai-and-agent-surface) | Native families are agent infrastructure by construction |
| "General-purpose geometry modeling" listed as likely upstream territory; richer parametric architectural operations and procedural libraries are deferred, not refused | **Ratified non-goal and deferral language** | [non-goals](../../docs/reference/north-star.md#permanent-non-goals); [deferred scope](../../docs/reference/north-star.md#deferred-scope-is-not-a-non-goal) | Native form needs a scope statement that separates context-dependent form from general modeling ([D1](./roadmap-handoff.md#4-owner-decisions)) |
| Spatial Ink on arbitrary planes, editable profiles and extrusion, components and patterns, revolve and sweep, recipes, kernel comparison | **Proposed** (original study) | [study §4](../spatial-modeling-depth-research-2026-10-25.md#4-the-capabilities-worth-deepening) | Re-weighted in [§3](#3-what-this-package-confirms-and-challenges-in-the-original-study) |
| Clipper2 for 2D booleans and offsets; Manifold if CSG is needed | **Proposed** (harvest) | [harvest §5](../geometry-library-harvest.md#5-recommendation-matrix-reconciled-2026-10-22) | The same 2D offset kernel has wide leverage: trim, rounding, reveals, text |
| Kernel substrate, correspondence algorithms, invalidation and cache design, history implementation | **Open mechanism decisions** | [technology gates](../../docs/reference/north-star.md#technology-gates) | No kernel or algorithm choice is implied by this package |
| Product licence | **Undecided**; admission is permissive-only | [licensing direction](../../docs/reference/decisions/post-batch-e-authorization-2026-10-23.md#licensing-direction) | Blocked: OCCT (LGPL), web-ifc (MPL), CGAL (GPL), libfive (MPL or GPL) |

## 3. What this package confirms and challenges in the original study

The [original study](../spatial-modeling-depth-research-2026-10-25.md) is preserved verbatim. This table is the reconciliation layer.

| Study position | Verdict | Evidence | Consequence |
| --- | --- | --- | --- |
| Five capabilities: drawing, editable forms, reusable detail, revision continuity, visual completion ([§1](../spatial-modeling-depth-research-2026-10-25.md#1-recommendation)) | **Confirmed** | All research passes | Keep the five. This package supplies the language that joins the first three |
| Placement, materials, lighting and framing deserve equal standing | **Confirmed and strengthened** | Experts' "fake it" default; clients value stills ([approaches §7](./approaches-and-precedents.md#7-finish-presentation-and-handoff-precedents)) | Material-level detail and still capture enter the native core |
| Spatial Ink as foundation ([§4.1](../spatial-modeling-depth-research-2026-10-25.md#41-spatial-ink-three-dimensions-with-understandable-depth)): its first-hour column ("draw on a visible face or plane; pull a line vertically") and its ten-hour column (arbitrary planes and cross-plane chains) | **Confirmed for basic spatial drafting; challenged for arbitrary planes and free chains as foundation.** The first revision of this package overstated the disagreement; the study already said "the priority is a reliable drawing context" | Drawing without a surface is error-prone ([Arora 2017](https://research.autodesk.com/publications/experimental-evaluation-of-sketching-on-surfaces-in-vr)). Community 3D paths (rails, ramps) derive from hosts. The ratified readings already provide surfaces | Basic drafting is foundational: drawing in readings, picked carriers, axis locks, vertical linework, tilted host faces, offset planes. Free workplanes and unrestricted chains must justify themselves. [P2](./proof-agenda.md#p2-a-drafting-ladder-from-host-surfaces-to-free-chains) tests where the line falls |
| Editable profiles and extrusion as the first native form ([§4.2](../spatial-modeling-depth-research-2026-10-25.md#42-forms-preserve-the-idea-that-generated-them)) | **Confirmed, with two additions** | Users expect native rounding; revolve covers lamps, vessels and columns cheaply | Ship profile-corner rounding with the first family. Bring revolve forward |
| Repetition, with explicit identity ([§4.3](../spatial-modeling-depth-research-2026-10-25.md#43-repetition-more-authored-intent-less-repetitive-labor)) | **Confirmed; concrete policy proposed** | No system keeps per-member overrides through regeneration ([approaches §5](./approaches-and-precedents.md#5-procedural-and-recipe-systems)) | Ordinal slots with suppression, anchors that pin positions, and orphaned overrides kept visible |
| Relationships: transient assistance is not persistent relation ([§4.4](../spatial-modeling-depth-research-2026-10-25.md#44-relationships-the-most-valuable-hidden-depth)) | **Confirmed** | Solid Edge Live Rules show the cost of inferred relations | Declared relations heal; snaps stay transient |
| Finish ([§4.5](../spatial-modeling-depth-research-2026-10-25.md#45-finish-make-rough-work-presentable-and-refined-work-distinctive)) | **Confirmed and extended** | Box projection fails on curves; cut-out shadow complaints; live-link identity failures | Arc-length UVs for every family, cut-out materials, decals and standees, and finish overrides keyed by role |
| Recipes: selective, after foundations ([§4.6](../spatial-modeling-depth-research-2026-10-25.md#46-recipes-domain-knowledge-without-specialist-workbenches)) | **Confirmed and sharpened** | Users reject recipes that trap them; transitions break typed systems; recipes consume assets | **Few deep recipes**, with transition rules, module slots for imports, validation, and an escape hatch that **keeps the semantic label** |
| Limited loft, rounding and explicit booleans are research-gated | **Partly challenged** | Profile rounding is cheap and expected. The positions of a ruled strip between carriers cost 0.2 ms (*probe*). General loft correspondence is hard. 3D fillets need a kernel | Rounding: baseline, not gated. Ruled strips: inside families. Loft and booleans: still gated. 3D fillets: out of scope |
| Geometry-to-semantic interpretation, investigated with care | **Confirmed, with a warning** | Live Rules need constant overrides; Tiny Glade's in-context readings delight | Readings stay limited to what domains support, visible before commit, one undo step away |
| Reference, trace and handoff as essential | **Confirmed and elevated** | Asset-first tools survive; AI erodes the freeform layer; platform closures | Add a **found-object edit kit** and **non-destructive re-import**. Imports fill family slots |
| Four responsibilities: intent, meaning, evaluation, display ([§8.1](../spatial-modeling-depth-research-2026-10-25.md#81-separate-four-responsibilities)) | **Confirmed** | Kernel persistence adds nothing when generated geometry is never authored truth | Keep the split |
| Identity is the hardest seam ([§8.2](../spatial-modeling-depth-research-2026-10-25.md#82-the-hardest-seam-is-stable-identity)) | **Confirmed; less of a blocker than feared for bounded families** | Role addresses from authored keys avoid topological naming. Practice gets by with coarse identity. The production wall mesher already assigns every triangle one role-tagged owner | Role-address policy plus measurement before investing in boolean-split tracking |
| Truthful previews ([§8.4](../spatial-modeling-depth-research-2026-10-25.md#84-cheap-previews-must-remain-truthful)) | **Confirmed** | Domain paths are fast enough to preview exactly | Booleans: proxy during drag, exact on commit, with the proxy honestly labeled |
| Surface hosting needs more than face editing ([§8.5](../spatial-modeling-depth-research-2026-10-25.md#85-surface-hosting-needs-more-than-generic-face-editing)) | **Confirmed and generalized** | Production Openings already prove the host-frame pattern | Host-local frames become the general mechanism: wall, roof plane, walking line, room offset, Shape plane |
| TypeScript first, specialized modules only where justified ([§9](../spatial-modeling-depth-research-2026-10-25.md#9-geometry-technology-compare-responsibility-and-cost)) | **Confirmed in direction; the measurements were narrowed after review** | A matched probe: construction beats booleans within each library; Manifold beats OCCT 50–200 times on one fixture; plain JavaScript was not closed by default. The production wall path is TypeScript at 3–9 ms per dense wall. OCCT is blocked and heavy; Truck is immature ([probe methods](./probe-methods.md)) | No custom Rust/WASM case is established; the gate is unmet. Manifold is the one boolean spike, later. Dense-host evaluation is S06's to measure |
| Circle on a wall ([§10](../spatial-modeling-depth-research-2026-10-25.md#two-interaction-conflicts-deserve-explicit-decisions)) | **Resolution path proposed** | Context readings delight when visible and reversible | Keep the rule; offer the alternative reading inside the same undo step ([D5](./roadmap-handoff.md#4-owner-decisions)) |
| Adoption order ([§12](../spatial-modeling-depth-research-2026-10-25.md#12-suggested-adoption-order)) | **Re-weighted** | See above | Found objects, rounding and carriers from context move earlier; arbitrary planes move later ([handoff §2](./roadmap-handoff.md#2-capability-tranches)) |
| Drift risks ([§13](../spatial-modeling-depth-research-2026-10-25.md#13-what-would-cause-drift)) | **Confirmed; four added** | [§9](#9-risks-and-falsifiers) | Recipe catalog sprawl, reading inference creep, presentation-only fakery, and AI-as-answer |

**New in this package**, not present in the original study:

- the profile, carrier and rule language;
- validation as a feature;
- failure diagnosis as product surface;
- a found-object edit kit;
- imports in semantic slots;
- exhibition families;
- material-level detail;
- the distinction between the geometric foundation for curved-wall openings, which is production, and the creator workflow, which is unbuilt and partly unplanned;
- the role-address identity policy with falsification tests;
- matched kernel evidence and a measurement of the production wall path, with reproducible [probe methods](./probe-methods.md);
- a boundary analysis for compound roofs and helical forms ([§6.1](#61-where-native-depth-stops-compound-roofs-and-helical-forms)).

## 4. One creative language: profile, carrier and rule

### 4.1 The three concepts

| Concept | What it is | Where it comes from, in order of preference | Ratified vehicle |
| --- | --- | --- | --- |
| **Profile** | A 2D outline or section with stable point keys and per-corner crease or round flags | Picked from a small library; drawn with Ink in a reading (Section, Face, Edit shape, ground); derived from text or SVG; or taken from an existing outline | Ink; Edit shape's roof-local section; Library |
| **Carrier** | Where the profile goes: a path, an axis, a footprint or a host frame | **Picked from a host:** a Wall base, top or face; a Room boundary; an Opening outline; a stair walking line; a roof edge; a Level edge. Drawn on a surface with Ink. A free three-dimensional chain comes last | Select; host preference; Library placement that "seeks eligible hosts" |
| **Rule** | How profile and carrier meet | Extrude (height, rim radius); revolve (angle, radial ribs); sweep (frame mode: upright, pitch-normal or path-normal; corner policy); distribute (count or spacing, anchors, end rule); subdivide (cells); span (a ruled strip between two carriers) | Card facts; handles on Stage |

A **family** is a domain-owned, named composition of the three. It has:

- a meaning;
- a role vocabulary for its parts;
- validation;
- its readings;
- defaults;
- an escape.

The family is where specialized behavior lives, for example stair rise and run rules, or hosting an Opening. The language stays small because every family reuses it.

### 4.2 The same language for ordinary objects and for architecture

| Family | Profile | Carrier | Rule | Owner (**I**) | Status |
| --- | --- | --- | --- | --- | --- |
| Opening | Head shape (rectangular, rounded, pointed) | Wall (s, z) frame | Cut through the thickness | Layout | **Production** |
| Overhead or roof | Section (Vellum `ProfilePt[]`) | Outline or footprint edges | Extrude or revolve; fit, hip | Layout | **Prototype** |
| Plinth, pedestal, platform | Outline with holes and rounded corners | Ground, raised sheet or Level | Extrude, with rim radius | Scene (Shape) | **Proposed** |
| Lamp, vase, column | Half-section | Axis | Revolve, with radial ribs or flutes | Scene; Layout if it is a structural column | **Proposed** |
| Trim, baseboard, crown, casing | Molding profile | Room boundary, Wall top or base, Opening outline | Sweep, with corner policy (mitre, cope, return) | Layout | **Proposed** |
| Railing | Rail and post profiles; infill | Stair walking line plus height; a platform edge | Sweep plus distribute plus span; transition rules | Layout on a stair; ownership open on a Scene platform | **Proposed** |
| Stair (straight, L, U) | Tread and nosing profiles | Walking line between two surfaces | Distribute under a total-rise constraint; stringer sweep; validation | Layout | **Prototype** (P3 surface-to-surface) |
| Slat screen, baffles, display bays | Slat section | Line, arc, Wall face, ceiling | Distribute with anchors and end rules | Scene or Layout by host | **Proposed** |
| Shelving, vitrine | Box | Scope | Subdivide into cells; module slots | Scene | **Proposed** |
| Signage, relief | Text or SVG outline | Fascia, Wall face, panel | Extrude or emboss on a host frame | Scene | **Proposed** |
| Shade sail, canopy | Boundary points | Posts or Wall anchors | Span or Coons patch with sag | Scene | **Gated** |

**I** **This answers "one coherent creative language" without merging domains.**

- The creator learns one grammar: draw or pick a profile, put it on something, and adjust the rule.
- Each object keeps its specialized behavior through its family and owner. A Railing knows stair transitions. An Opening knows its host. A Plinth knows nothing about either.
- Layout families compile in the canonical Layout compiler.
- Scene families are parametric **definitions** with parameters, material slots and limits, exactly as the [Scene destination](../../docs/reference/components/scene-content.md#ratified-destination-not-shipped) already describes.
- Both draw on the same **runtime-safe numeric modules**: curves, offsets, frames, sweeps, tessellation and UVs. These own no truth and so create no second compiler.

### 4.3 Rules the language must keep

1. **Carriers come from context first**, are drawn in readings second, and are drawn freely in space last.
2. **One profile editor everywhere.** Vellum's Edit shape, generalized: a section drawn on the object, with the joint points and midpoint marks already ratified.
3. **Every parameter is one Card fact**, and a handle pulls it. Constraint-preserving handles beat fields. Dragging a stair end adds treads while keeping the total rise.
4. **Families qualify once and refuse in words.** Chip, preview and commit share one function, and a refusal names a cause and a fix.
5. **Repetition has anchors.** A pattern's members keep their slots through path edits. Overrides survive or become visibly orphaned, never silently moved.
6. **There is an escape, and it keeps the meaning.** "Make this member custom" detaches one member. It keeps the family label and the member's parameters as metadata. "Bake to plain objects" is explicit and one-way.
7. **Imports fill slots.** A post, baluster, capital or panel slot accepts a placed definition. The family sizes it from its bounds.
8. **Specialist parameters wait.** Defaults such as "spread to fit, post at each corner" hide justification and leftover rules until refinement.

### 4.4 What the language deliberately omits

- **Arbitrary face push/pull.** Pull legible facts instead.
- **Unrelated booleans.** Use host-local cuts and family subtraction.
- **Free surfaces.** A span between two named carriers is allowed. An unnamed patch is not.
- **History trees.** The family's parameters *are* the history.
- **Node graphs.** Recipes expose parameters, not graphs.

## 5. How the language fits the ratified shell

**I** The language needs no new permanent dock tool. Every step maps onto ratified PLATE vocabulary ([§0.8.4](../../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination)).

| Creator step | Ratified vehicle | What remains to define (**I**) |
| --- | --- | --- |
| Draw an outline on the ground or a raised sheet | Ink, then a reading chip, then **Shape**, pulled by a height ray | Shape's family parameters: rim radius, holes, taper |
| Draw on a wall | Ink on a wall face; Face or Unroll as a reading; host preference | The circle-on-wall alternative ([D5](./roadmap-handoff.md#4-owner-decisions)) |
| Basic spatial drafting: a vertical line, an axis-locked stroke, drawing on a tilted host face, drawing on a plane offset from a host | Ink, with its Line option, reads ground, a raised sheet or a wall face; the raised sheet is a horizontal offset plane at any Height Sheet height; the height ray is a vertical pull; axis rays are an existing transformation mark | Axis locks during an Ink stroke; whether vertical linework is source or an object; which further planar host faces Ink reads, such as roof planes and ramps, which would extend PLATE's list (an owner decision); offset planes from a wall face. The drawn vertical Slice stays inspection, never source ([P2](./proof-agenda.md#p2-a-drafting-ladder-from-host-surfaces-to-free-chains)) |
| Edit a profile | Edit shape, as already ratified for roofs: a local section with joint points and ＋ marks | Generalize it to every profile family |
| Turn a Shape into a revolve or sweep | The Card's kind fact ("a supported kind change sits on the kind fact itself") | Which kinds a Shape supports; how a carrier is picked |
| Pick a carrier | Select with host preference; the scoped ⋯ list on a selected profile; a Library item placed onto a host | A "run along…" capability, registered through capability placement |
| Set count, spacing, rise or radius | Card facts; handles on legible marks; typing at the gesture | Constraint-preserving handles |
| Apply materials by role group | Brush, with its face or whole-room scope; the Ask Rule for shared sources | A role-group scope, for example "all sides" or "caps" |
| See consequences | Creates · Keeps · Splits · Moves · Connects · Elsewhere; one undo step | Role-level counts from families |
| Inspect a profile family | Look offers Section through the family | — |
| Multi-step work such as import | An Instrument procedure | Re-import diff review |

**O** The precision ladder (Direct, Read, Type, Card, Procedure) matches the mechanisms that make Shapr3D and Plasticity feel immediate: explicit handles, numeric entry at the gesture, essential parameters on canvas, and confirmation on an empty-canvas tap ([approaches §2](./approaches-and-precedents.md#2-shapr3d-and-the-clay-like-feel)).

## 6. Capability map: native, asset, extension, specialist

"Extension" here means a future optional module or recipe pack. Biskiq has no extension system, and none is proposed.

| Capability | Example tasks | Placement (**R**) | Owner (**I**) | Evidence strength |
| --- | --- | --- | --- | --- |
| Host-local cutting (Openings) | Windows in curved walls; arched heads; niches | **Native**: geometry in production; authoring not wired; curved hosts unplanned | Layout | Strong (pain documented; geometry solved; workflow missing) |
| Basic spatial drafting | Vertical lines; axis-locked strokes; drawing on a roof plane, ramp or tilted panel; a plane offset from a wall | **Native**, foundational | Shell, with readings owned by each host's domain | Moderate (original study; PLATE vocabulary; P2 pending) |
| Free workplanes and unrestricted 3D chains | A plane hinged on a picked edge; a nonplanar path drawn in space | **Gated** behind P2 rungs 4 and 5 | Shell | Weak (community 3D paths mostly derive from hosts) |
| Profile families: extrude, with rounding | Plinths, platforms, panels, counters | **Native**, first | Scene (Shape) | Strong |
| Revolve family | Lamps, vessels, columns, turned legs | **Native**, early | Scene | Moderate |
| Profile on carrier | Trim, baseboards, casings, rails, edge bands | **Native** | Layout (on architecture), Scene (on objects) | Strong |
| Distributions | Balusters, slats, flutes, lights, display bays | **Native** | By host | Strong |
| Few deep recipes | Railing with transitions; straight, L and U stairs; simple roofs; shelving | **Native**, selective | Layout or Scene | Strong pain, with a warning about trapping |
| Bounded compound roofs and helical stairs | Joins across pitches; hips on irregular polygons; gable and shed dormers; a circular helical stair with rails | **Candidate native**, gated by P12 ([§6.1](#61-where-native-depth-stops-compound-roofs-and-helical-forms)) | Layout | Strong pain; the native boundary is unproven |
| Exhibition families | Vitrine, plinth, partition, slat screen, graphics panel | **Native** (compositions of the above) | Scene | Inferred (forum evidence thin) |
| Validation and diagnostics | Rise and run, roof feasibility, opening fit, self-intersection | **Native**, from the first family | Each family's owner | Strong |
| Real-scale UVs, creases, rounding | Every generated form | **Native** | Evaluators | Strong |
| Material-level detail | Perforation, cut-outs, decals, text, standees | **Native** | Scene materials | Moderate (real-time behavior untested) |
| Found-object edit kit | Scale to dimension, mirror, array, re-pivot, re-material by slot, section view | **Native**, bounded | Scene | Moderate |
| Non-destructive re-import, glTF out, still capture | Update a supplier model; hand off; present | **Native** | Ingest; Experience | Strong |
| Lofts, Coons spans, membranes, cushions, terrain heightfields | Transitions, sails, soft goods, berms | **Gated** behind proofs | Scene | Mixed |
| Booleans on found objects | Cut a found table to fit | **Gated** (Manifold spike) | Scene | Weak demand evidence |
| Signed-distance soft forms | Organic plinths | **Gated**, possibly never | Scene | Weak |
| Freeform objects, furniture, sculpture, ornament, manufacturer items | Chairs, art, capitals, volutes | **Asset and AI**, via canonical ingest | Scene ingest | Strong |
| Recipe or profile packs | Regional moldings, stair styles | **Extension** later, as library resources | Library | — |
| IFC, STEP and DWG import | BIM context; CAD parts | **Specialist or extension**; blocked by current licences | Ingest | — |
| Fabrication solids, 3D fillets, freeform surfacing, framing and trusses, MEP, roofs that are not a height field, curved-surface roof intersections between families, handrail wreaths and easements for joinery, sculpting, UV unwrapping, construction documents | — | **Specialist** (external) | — | Strong |

The first revision of this map placed "complex roofs, winder and helical stairs" wholly under specialist work. That contradicted the anchor case and §4.2, which assign helical rails to a family that knows its carriers. The split above replaces it.

### 6.1 Where native depth stops: compound roofs and helical forms

**I** The native boundary should be set by the **geometric operation** a case needs, not by the element's name. A case is a native candidate when it reduces to the language: a profile, a carrier taken from a host, and a bounded rule, all evaluated analytically in a host frame. It is specialist when it needs one of the operations this package keeps outside: general surface–surface intersection, solid booleans as the main path, free three-dimensional chains, or fabrication-grade continuity.

| Case | Bounded operation it reduces to | Evidence | Placement (**I**) |
| --- | --- | --- | --- |
| Gables joined at one eave and pitch; wing roofs on L, T, U and plus plans | Planar upper envelope; rectilinear wing decomposition | **Prototype** in P3, with refusals ([record §3](../../prototypes/p3-vellum/plans/roof-footprints-final-polish.md#3-supported-footprint-families-p3)) | Native |
| Joins across pitches, eaves or families of planar roofs | A height-field upper envelope over an exact planar arrangement, with valley and abutment classification | P3's recorded production direction; not built | Candidate native |
| Hips on arbitrary polygons | Straight skeleton of the footprint, then per-edge planes | Robust implementations are hard. CGAL's is GPL, so a permissive one would be needed | Candidate native; the robustness risk is real |
| Gable and shed dormers; a lean-to against a taller wall | A profile hosted in a roof plane's (or wall's) local frame, extruded until it meets the host plane: a plane–plane intersection | The roof analogue of an Opening in a Wall's (s, z) frame; P3 calls it "a Layout relation and a feature on top of the envelope" | Candidate native |
| Courtyards in a cover | Rings with holes through the cover pipeline | Deferred in P3 | Candidate native |
| A roof passing over another roof; eyebrow dormers; vault meeting gable at unequal spans | Not a height field; curved surface–surface intersection | Medeek's complex roofs still "under construction" after years | Specialist |
| Framing, trusses, structural roofs | Member layout and engineering | Dedicated extensions | Specialist |
| Circular helical stair, constant radius, with inner and outer rails | Helix carrier; treads distributed under a total-rise constraint; rails swept with an explicit frame; a ruled band between rails paired at authored stations | Positions for sweep and ruled strip cost under 1 ms (*probe*); the anchor case's inferences | Candidate native |
| Helical rail joined to a straight landing rail | A tangent-continuous transition curve between a helix and a line | Revit's railings fail at exactly these transitions | Candidate native if a bounded transition (for example a cubic blend with G1 continuity) satisfies creators; specialist if fair-curve joinery is needed |
| Variable-radius or elliptical spirals with balanced winders; wreathed handrails for fabrication | Fair-curve design and joinery geometry | Stair-builder evidence: dedicated software is expensive and CNC-oriented | Specialist |

**What would prove either position.** [P12](./proof-agenda.md#p12-where-native-depth-stops-compound-roofs-and-helical-stairs) runs two fixture corpora drawn from the creator evidence.

The **native position holds** if bounded families:

- cover a stated share of ordinary cases without manual planes;
- refuse the rest in words;
- keep hosted features, such as dormers and rail transitions, through pitch, footprint, rise and radius edits;
- meet the per-edit budget at the M scale.

The **specialist position holds** if:

- reaching the common cases needs general surface–surface intersection, solid booleans or free 3D chains;
- refusal rates on ordinary renovation roofs stay high;
- hosted features do not survive edits.

The shares are decision points for the owner, not sourced numbers.

**I** Showing a case can be native does not make it worth scheduling. P12 decides placement on the capability map. D1, P3 and P4 still decide whether any recipe is built.

## 7. Ownership and architecture seams

These are seams that a future architecture cycle would decide. This package decides none of them.

1. **Scene-owned native forms.** PLATE says "Scene decides whether and how a Shape is stored". The Scene destination's parametric definitions are the natural home.

   **Open:** whether a project-local Shape is an inline definition with one instance; how profile and parameters are stored; how role addresses are versioned.
2. **Shared numeric modules.** Pure, deterministic, runtime-safe functions used by the Layout compiler and by Scene evaluation. They own no truth.

   **Open:** package placement and versioning. This is an instance of the open "kernel substrate" mechanism decision.
3. **Correspondence.** Families publish role correspondence, which fits the ratified "owner publishes correspondence" transport. Consumers never infer it.

   **Open:** the record format and reference-kind resolution ([geometry §5.2](./geometry-identity-and-performance.md#52-recommended-policy)).
4. **Cross-domain carriers.** Two cases:
   - A railing on a Layout stair is a Layout family.
   - A railing on a Scene platform, or trim on a Scene object, crosses domains.

   **Open:** whether such a family is Scene-owned with a deliberate attachment to its host, which the ratified binding rules already describe, or Layout-owned.
5. **Profiles as resources.** A profile library is a typed resource. A change to a shared profile follows the Ask Rule.

   **Open:** whether profiles are their own resource type or part of a definition.
6. **Escape that keeps meaning.** A family that holds a custom member keeps the semantic label. This needs a schema concept for "member detached from rule".

   **Open.**
7. **Found-object edits.** Non-uniform scale, mirror and re-pivot change the Scene transform contract, which today supports only uniform resize.

   **Open,** and owned by Scene.
8. **Delivered derivatives.** Kernel-evaluated families reach the visitor runtime as immutable, reproducible delivery derivatives, which the North Star permits. Cheap families may be re-evaluated instead.

   **Open:** which, per family.

## 8. The complete experience: create, revise, finish, communicate

An illustrative project shows how the pieces combine: a small photography exhibition in a pavilion. Every step names the capability, and the [proof agenda](./proof-agenda.md) turns the sequence into tests. **H** throughout.

| Time | Creator action | Capability exercised |
| --- | --- | --- |
| 0–3 min | Ink a curved enclosure; read it as Walls; add two arched windows on the curve | Wall drawing (held); curve authoring (unplanned); Opening authoring (not wired; S03 excludes curved hosts); host-local Opening geometry (production) |
| 3–6 min | Ink three outlines on the floor and read them as Shapes; set heights; round the rims | Extrude family with rounding |
| 6–9 min | Place supplied prints on the curved wall; distribute twelve picture lights along it | Solve-once placement; distribution on a host carrier |
| 9–12 min | Pick the room boundary and add a baseboard from the profile library | Profile on carrier; arc-length UVs |
| 12–15 min | Choose a lighting look; frame two views; capture a still; preview as a visitor | Presentation; still capture; Experience preview |
| Hours 1–3 | Revise the enclosure. Windows, lights and baseboard follow. One light referenced by a View goes unresolved and is re-picked | Semantic healing; correspondence; repair |
| Hours 3–6 | Add a revolved lamp family; a slat screen with anchors at each end; perforated panels with dappled shadow | Revolve; distribution with anchors; material-level detail |
| Hours 6–10 | Replace a supplier vitrine with a new version and keep its placement and finishes; make one slat custom; export glTF for a renderer; publish | Re-import diff; escape that keeps meaning; handoff |

**I** The ten-hour value is in hours 1–3 and 6–10. Each needs only modest geometry, but each depends on intent and identity surviving revision. That is the original study's [ten-hour check](../spatial-modeling-depth-research-2026-10-25.md#the-ten-hour-check), made concrete.

## 9. Risks and falsifiers

| Risk | Why it is plausible | Early signal | Response if confirmed |
| --- | --- | --- | --- |
| Families feel rigid ("my lamp isn't a revolve") | Evidence shows users then fall back to images and assets | Frequent escapes or abandoned families in [P3](./proof-agenda.md#p3-profile-families-stay-editable) | Strengthen import and escape first; add a family only for recurring demand |
| Recipe catalog sprawl | Every vendor ends with incompatible wizards | A new recipe needs a new concept | Admission test: it must reuse the language |
| Reading inference creep | Live Rules needed constant overrides | Wrong first readings above a threshold in [P2](./proof-agenda.md#p2-a-drafting-ladder-from-host-surfaces-to-free-chains) | Keep readings few and visible; prefer explicit kind changes |
| Fakes read flat in motion | Cut-outs and decals are tuned for stills | Visitors notice cards edge-on in [P7](./proof-agenda.md#p7-material-level-detail-in-motion) | Limit fakes to distant or lateral roles; real geometry for hero objects |
| AI makes native forms unnecessary faster than expected | Part-aware, editable AI generation is advancing | AI props can be dimensioned and revised reliably | Shift investment toward slots, the edit kit and agent operations |
| AI cannot use families well | Agents need robust typed operations | An agent fails on the [P10](./proof-agenda.md#p10-agents-operate-families) family tasks | Improve operation design, not agent prompts |
| Identity policy too strict | Users expect "the same face" to persist | Unresolved states per 100 edits in [P5](./proof-agenda.md#p5-identity-through-ordinary-revision) | Richer authored continuation in the profile editor, never guessing |
| Performance on 8 GB laptops | WASM heaps never shrink; distributions multiply members; the production wall path already costs 3–9 ms per opening-dense wall in Node on the M2 | [P6](./proof-agenda.md#p6-evaluator-placement-and-the-kernel-question) memory and latency on reference laptop A; S06's per-edit evaluation rows | Evaluate only the changed host; tessellation density by level of detail; instancing; lazy kernels; refusal at limits |
| Shared numeric modules become a second compiler | Convenience pressure to compute truth there | Domain facts appearing in shared code | Review rule: shared modules take numbers and return numbers |
| Scope creep beyond the non-goal | Each family invites the next | Requests for B-rep features | The D1 scope statement plus the original study's [feature-admission test](../spatial-modeling-depth-research-2026-10-25.md#a-feature-admission-test) |
| The 15-minute target fails for non-geometric reasons | Scene setup may dominate | [P1](./proof-agenda.md#p1-a-convincing-place-in-fifteen-minutes) time split | Prioritize presentation defaults and content-in over forms |

**What would falsify the central thesis:** observed target creators spending most of their custom-form effort on *context-independent* objects that import or AI cannot supply, such as a bespoke freeform sculpture designed in Biskiq. In that case general modeling depth would matter more than families. The research found no such evidence, but it also found no survey of time allocation. [P11](./proof-agenda.md#p11-where-creators-time-actually-goes) closes that gap.

## 10. What this package does not decide

- **Scope.** No change to the North Star's non-goal language. D1 proposes wording for the owner.
- **Domain schemas.** No Scene definition schema, profile resource type or correspondence record format.
- **Dependencies.** No dependency admission. Manifold, Clipper2 and three.js addons remain candidates.
- **Shell.** No new shell tool, reading or amendment. The circle-on-wall alternative is an owner decision.
- **Roadmap.** No scope, phase or release placement. The [handoff](./roadmap-handoff.md) orders capabilities by dependency, not by track.
