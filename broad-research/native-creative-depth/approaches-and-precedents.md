# How other tools make creation feel effortless, and what it costs them

**Research date:** 25 October 2026  
**Status:** Research evidence and inference. No architecture ratification, production implementation, dependency adoption, or roadmap release.  
**Package:** [Native creative depth](./README.md) · labels follow the package's [evidence conventions](./README.md#3-how-to-read-the-evidence)

This document examines competing paradigms:

- direct and "clay-like" modeling, with Shapr3D and its lineage;
- alternative representations, and sketch-modeling research;
- procedural recipe systems, from BIM to games;
- AI generation, assets and tool history;
- finishing and handoff precedents.

The question throughout is which *mechanisms* create the effortless feel, and which of them transfer to a semantic browser tool. The original study's [Hew and DraftDown lessons](../spatial-modeling-depth-research-2026-10-25.md#6-what-hew-teaches-biskiq) are not repeated.

## 1. Findings in brief

1. **I** The clay-like feel breaks down into about ten mechanisms. Roughly half are pure interaction design that works over any representation:
   - explicit handles;
   - "selection is the operation";
   - essential parameters on the canvas;
   - scrub, type and expression fields;
   - remembered values;
   - tap empty canvas to commit;
   - visible inference with a lock;
   - one undo step per gesture.

   The rest depend on representation. Neighbor-face healing needs a B-rep kernel. Never-fail blends need signed distance fields. Structural consequences, such as a door appearing where a path crosses a wall, need a semantic model.
2. **O** The only quantitative datum on immediacy is vendor-reported, without a published method. Making Shapr3D's push-pull arrows explicit raised task success by "two orders of magnitude" ([Apple Developer](https://developer.apple.com/news/?id=i6qdbzn9)).
3. **O** Shapr3D's Parameter Cards (announced 28 September 2026) put essential parameters on the canvas. They support scrubbing, open the full card on request, and confirm when the user taps empty canvas ([Shapr3D](https://www.shapr3d.com/content-library/how-parameter-cards-will-help-you-design-better)). **I** This independently converges on Biskiq's ratified **precision ladder** (Direct, Read, Type, Card, Procedure). That is evidence for the ladder, not a reason to change it.
4. **O** Direct tools aimed at long refinement grow re-editable history. Hidden dependencies then make "local" edits non-local. In a Shapr3D thread (January 2026), deleting a sketch removed bodies and copies stayed linked. Staff replied: "We don't plan to implement a 'direct modeling mode'" ([Shapr3D Community](https://discourse.shapr3d.com/t/shapr3d-is-losing-its-unique-value-direct-iterative-prototyping/40173)).

   **I** A semantic tool already owns its dependencies. It should make them visible at the moment of deletion or change, not add a second geometric dependency graph.
5. **I** The evidence refutes clay-like *representation* as the owner of architectural meaning: sticky meshes, signed distance fields, raw solids without history. It supports clay-like *gestures* over a semantic owner that **heals by domain rules**. When a Wall moves, its Openings ride along and Rooms re-derive. This is the semantic analogue of Parasolid's extend, trim and stitch. It must stay explicit and previewed, never silent automatic repair, which the [North Star](../../docs/reference/north-star.md#permanent-non-goals) forbids.
6. **O** Of 24 procedural and recipe systems examined, none keeps a per-member override robustly through host or path regeneration. Identity is positional, so overrides break when a path changes.
7. **O** Users reject recipes that trap them, not recipes in general:
   - Archicad stair: about 15 minutes by hand, versus days with the stair tool.
   - Revit: glass railings built as curtain walls because that is "more stable".
   - Medeek: users rename assemblies so the plugin will not regenerate them.

   **I** What users want: a few deep recipes, a cheap escape hatch, and a semantic label that survives the escape.
8. **O** Mainstream products now generate single objects from text or images. These are visually convincing, textured, take one to three minutes, and cost about US$0.20 per call. SketchUp has shipped Generate Object since December 2025. Dimensioned, structured CAD remains unsolved: a CAD GUI agent completed 17.5% of tasks, against 87% for experts ([CADWorld, September 2026](https://arxiv.org/abs/2609.16251)). **I** AI erodes the freeform-prop layer fastest and leaves the dimensioned, site-specific, revisable layer to native tools.
9. **O** Live-link renderer pipelines lose materials because they match by name, list index or file path. **I** This is the same identity problem as generated parts, at a different seam.

## 2. Shapr3D and the clay-like feel

**O** **What Shapr3D does**, from vendor sources:

- **Kernel.** It runs on Parasolid. Moving a face extends, shrinks, trims and stitches its neighbors and reblends fillets. An edit fails when a face would cease to exist ([Shapr3D blog](https://www.shapr3d.com/blog/how-does-direct-modeling-actually-work)).
- **Interaction.** Physical-metaphor tools, explicit handles, and selection-driven operations.
- **History.**
  - Background history reached general availability in April 2024.
  - Direct edits appear as steps in the history.
  - Sketches are linked to their bodies.
  - "Deleting sketches will result in all subsequent models also being deleted" ([Shapr3D content library](https://www.shapr3d.com/content-library/shapr3d-history-based-parametric-modeling)).
- **Market.** Its target segments are manufacturing: consumer electronics, appliances, automotive process engineering, and jigs and fixtures. Its own comparison concedes weaker parametric assemblies ([Shapr3D vs Fusion](https://www.shapr3d.com/de-de/content-library/shapr3d-vs-fusion-360)).
- **Scale.** Staff warned that edits to foundational history in models of about 10,000 bodies "still won't be fast" ([Shapr3D Community, 2023](https://discourse.shapr3d.com/t/history-based-parametric-modeling-is-coming-to-shapr3d/26632)).

**O** **Academic context.** Industrial hybrid systems mostly treat direct edits as pseudo-features appended to history, which "offers little" toward real integration ([Zou, Feng and Gao, 2023](https://arxiv.org/abs/2301.02999)).

**I** **Shapr3D's trajectory** runs: direct, then hybrid with background history, then Parameter Cards that bring history back to the gesture. This suggests a direct tool aimed at ten-hour refinement eventually needs re-editable parameters.

Biskiq's answer can be simpler, because its parameters are already the authored source: profile, path, count, rise. It has no need for a parallel history of geometric features.

**I** **What does not transfer:**

- Arbitrary face push/pull with neighbor healing on general solids. This is kernel territory, and it fails even there.
- G1 and G2 surfacing.
- Feature trees that compete with semantic ownership.
- Shapr3D's market direction. It points away from architecture and exhibition.

## 3. The direct-modeling lineage

| Precedent | Mechanism worth learning | Warning it carries |
| --- | --- | --- |
| SketchUp | Faces form automatically between coplanar edges; push/pull; locked inference directions ([SketchUp blog](https://blog.sketchup.com/home/turning-20-never-looked-so-good)) | Geometry "accumulates and merges" until grouped; users enter groups to push/pull ([forum](https://forums.sketchup.com/t/stickiness/82977)) |
| SpaceClaim, now Discovery | Pull: the selection decides the operation (a face offsets, an edge rounds); secondary guides choose variants ([Wikipedia](https://en.wikipedia.org/wiki/SpaceClaim)) | Retired into Discovery in 2025 R1; current behavior unverified |
| Solid Edge Synchronous Technology | Face-selection intent; color-coded inferred relations; a Solution Manager resolves conflicts in place ([Siemens](https://blogs.sw.siemens.com/solidedge/live-rules-and-the-solution-manager/)) | **A warning case.** Inferred geometric intent needs a large rule vocabulary and frequent manual switching-off of wrong inferences |
| Onshape | Delete Face offers heal, cap or leave open, and remembers the choice ([Onshape](https://cad.onshape.com/help/Content/PartStudio/delete_face.htm)) | Direct edits become features in the tree |
| Fusion | Press Pull | Turning history off is permanent ([AU handout](https://static.au-uw2-stg.autodesk.com/PD16277_handout_16277_autodesk-university-2016-presentation-direct_20modeling.pdf)) |
| Plasticity | Direct-first NURBS on Parasolid; gizmo with typed distance; a dot shows where curves truly join ([2026.1](https://doc.plasticity.xyz/release-notes/whats-new-2026.1)) | No feature tree by design; calls itself a "complement" to other CAD; added constraints in October 2026 for controlled refinement ([CG Channel](https://www.cgchannel.com/2026/10/plasticity-2026-2-is-out/)) |

**I** **Solid Edge Live Rules** are the closest industrial analogue to semantic relations, and also the clearest warning. A semantic model can replace most *inferred* relations with *declared* ones: an Opening is hosted, a Room is bounded by Walls. Inference is then needed only for the residue, such as alignment between unrelated objects. Even there, transient snapping must not silently become a persistent relation. The original study already makes this point in [§4.4](../spatial-modeling-depth-research-2026-10-25.md#44-relationships-the-most-valuable-hidden-depth).

**I** **Onshape's heal, cap or open** is a good model for Biskiq's consequence bubble when an edit removes something a neighbour depends on. It offers a few named alternatives, remembers the last choice, and makes a single acceptance.

## 4. Alternative representations and sketch research

| Family | Examples | Strength | Limit for Biskiq |
| --- | --- | --- | --- |
| Signed distance fields and voxel "clay" | Womp (browser), Substance 3D Modeler, Dreams, MagicaCSG | Booleans "don't fail"; real-time blends; forgiving ([MagicaCSG](https://www.cgchannel.com/2021/06/check-out-cool-free-lightweight-modelling-app-magicacsg/), [Womp](https://womp.com/solutions/easy-3d/)) | Doubling the resolution costs up to 8× the voxels; dense, approximate exports; weak crisp edges and dimensions ([Adobe](https://helpx.adobe.com/substance-3d-modeler/desktop/technical-support/how-does-modeler-work.html)) |
| Strokes on guide surfaces | Feather, Mental Canvas, Gravity Sketch | Fast expression at true scale | No solids; drawing in mid-air is inaccurate |
| Primitive CSG with a solid/hole duality | Tinkercad | A beginner mental model for voids; 100 million users claimed ([Autodesk](https://www.autodesk.com/products/fusion-360/blog/autodesk-the-first-to-pioneer-cloud-cad-with-over-55-million-users-today/)) | Beginner scope |
| Procedural interpretation | Townscaper, Tiny Glade | One gesture builds a lot. In Tiny Glade, a path through a wall becomes a door ([GamingOnLinux](https://gamingonlinux.com/2024/06/tiny-glade-is-a-gorgeous-castle-doodling-game-thats-real-clever-to-relax-with)) | No dimensions. Townscaper fails silently. Tiny Glade's developers found "simple" requests such as doors hard to build procedurally ([80.lv](https://80.lv/articles/exclusive-tiny-glade-developers-discuss-bevy-proceduralism-publishers-cozy-games/)) |

**O** **Sketch-modeling research** points the same way:

- **A surface to draw on matters a lot.** Without one, drawing in 3D is error-prone, and the error depends on surface orientation. Visual guides improve accuracy but can harm the look of strokes ([Arora et al., CHI 2017](https://research.autodesk.com/publications/experimental-evaluation-of-sketching-on-surfaces-in-vr)).
- **Strokes can stay as handles.** In FiberMesh, sketched strokes remain on the surface as editable controls ([FiberMesh](https://www-ui.is.s.u-tokyo.ac.jp/~takeo/research/fibermesh/index.html)).
- **Precision comes from context.** It is gained by regularizing to inferred constraints (True2Form) and by reading each sketch against the existing model (Sketch2CAD; [arXiv 2009.04927](https://arxiv.org/pdf/2009.04927)).
- **Learnability claims are informal and narrow.** Teddy's "within 10 minutes" comes from an informal study of rounded freeform shapes ([SIGGRAPH History](https://history.siggraph.org/?p=116413)).
- **Open problems remain.** A 2026 survey co-authored with architecture and construction researchers still lists controllability and information-rich outputs as unsolved ([arXiv 2603.03287](https://arxiv.org/abs/2603.03287)).

**I** **These findings support Biskiq's ratified direction:**

- Ink reads the surface it lands on.
- Readings such as Face, Unroll, Section and the Height Sheet provide drawing surfaces.
- Shape outlines stay editable.

They also **challenge** the original study's emphasis on arbitrary-plane drawing and cross-plane 3D chains ([§4.1](../spatial-modeling-depth-research-2026-10-25.md#41-spatial-ink-three-dimensions-with-understandable-depth)). The research favors drawing *on* something. The [synthesis](./synthesis-and-direction.md#3-what-this-package-confirms-and-challenges-in-the-original-study) develops this point.

**I** **A bounded signed-distance niche** could serve soft sculptural Scene objects, such as organic plinths and exhibition forms, through a bake to mesh. It is not a fit for architecture. Its value is unproven, and import may serve the same need.

## 5. Procedural and recipe systems

### 5.1 Four editability models

**O** Across Revit, Archicad, Chief Architect, Vectorworks, SketchUp Dynamic and Live Components, Medeek, Profile Builder, Blender Geometry Nodes, Archipack, Bonsai, Houdini, CityEngine CGA, Grasshopper, Unreal PCG, Tiny Glade, Townscaper and consumer planners, four models recur:

| Model | Examples | What users get | What hurts |
| --- | --- | --- | --- |
| Live and type-driven, with one-way detach | Revit, Archicad, Live Components | Edits propagate; a type change updates all uses | Editing a railing sub-element makes it CUSTOM and disconnected (Archicad). Convert-to-sketch is irreversible (Revit). Variation needs a duplicated type |
| Regenerate and wipe | Medeek, Building Tools, many extensions | Fast regeneration | A regeneration deletes manual edits ([Medeek Q&A](https://forums.sketchup.com/t/medeek-extensions-q-a/166841)) |
| Live graph with explicit bake | Houdini, Unreal PCG, Blender modifiers | Full procedural control | Baking is one-way ([SideFX](https://www.sidefx.com/docs/houdini/unreal/packaging.html)) |
| Fully automatic, no overrides | Tiny Glade, Townscaper | Delight with no parameters | No control; silent failures |

**O** A schema upgrade in Bonsai dropped the parametric settings of an existing stair flight ([OSArch](https://community.osarch.org/discussion/comment/27462/)).

**I** Users accept one-way escape hatches. What they object to is silent loss.

### 5.2 Parameters non-specialists understand

**O** No formal usability study was found. Indirect evidence is consistent:

- **Understood easily:** overall dimensions, counts, layout presets and drawn paths.
- **Causes trouble:** justification, leftover fill, break-at-angle rules, inner-post distribution, stringer types, eave alignment and per-edge slope definitions. One example is Revit's baluster dialog ([Autodesk Help](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-426BE12E-A906-457B-A205-A5DFF08B07D7.htm)).
- **Direct-manipulation handles help.** Revit's stair handle adds or removes treads while keeping the height, and shows live riser numbers ([Autodesk Help](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-0FD4C314-E5AE-4937-ABAB-8EBD95A45695.htm)).
- **Rule-literate guardrails propose alternatives.** Archicad's Rules and Standards checks ranges and proposes alternatives on conflict ([Graphisoft](https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-188.htm)).
- **Cleaning paths automatically removes a failure class.** Unreal PCG's Clean Spline removes co-located and collinear points ([Epic](https://dev.epicgames.com/documentation/unreal-engine/using-shape-grammar-with-pcg-in-unreal-engine)).

**I** A **constraint-preserving handle** is easier to grasp than raw numeric fields. In such a handle, a drag changes the count while the total stays fixed. Specialist parameters should hide behind good defaults until the refinement stage. One such default: spread to fit, with a post at every corner.

### 5.3 A small set of primitives recurs

**O** The same mechanisms recur across very different products. The examples below come from more than three systems each:

- a path driver;
- a profile sweep;
- distribute or split along a length, with endpoint rules;
- anchors and break points;
- scope or surface subdivision;
- host binding and hosted cut;
- a footprint with per-edge attributes;
- a module slot that holds an asset;
- validation rules.

**O** The hard part of every recipe is its **corner, join and endpoint logic** and its **validation**, and those are recipe-specific. Examples:

- Revit mitres;
- Archicad L-segments;
- PCG tight corners;
- Divide Surface border tiles.

**I** A composable kit still needs a corner and join policy for each recipe.

**O** Recipes consume assets:

- Epic's fence generator uses a mesh pack.
- A Blender stair add-on sells 40 post designs and 40 handrail profiles ([Superhive](https://superhivemarket.com/products/stairs-architect)).
- Townscaper's look depends on hundreds of hand-made tiles.

**I** Native recipes therefore need a small curated profile and module kit, and slots that accept imported meshes.

### 5.4 Specialist territory

**O** Mature tools fail, or users abandon them, in these areas:

- winder and tight-well stairs;
- structural framing;
- freeform panelization;
- complex intersecting roofs ([Chief KB-02911](https://www.chiefarchitect.com/support/article/KB-02911/message-cannot-produce-a-roof-plane.html));
- ornate furniture;
- city-scale grammars;
- manufacturer catalogs;
- tileset-style automatic architecture.

**I** These stay specialist or import territory. Native territory includes:

- straight, L and U stairs with landings;
- post-and-rail railings and fences;
- simple hip, gable and shed roofs;
- trim as profile sweeps;
- shelving as box subdivision;
- rectilinear facade bays on a Wall;
- patterns along a path or over a face.

## 6. AI generation, assets and tool history

**O** **Tool history:**

- **Survivors had three things:** free or cheap distribution, a large asset ecosystem, and a place for output to go.
  - Google SketchUp had 3D Warehouse and Earth.
  - Tinkercad had classrooms and 3D printing.
- **Deeper tools were folded away.** Autodesk ended the 123D suite and kept only the simplest app, Tinkercad ([CG Channel](https://www.cgchannel.com/2016/12/autodesk-cans-its-123d-apps/)).
- **Platform-bet tools died with their parent's strategy:** Paint 3D and Remix 3D, Google Poly and Blocks, Mozilla Hubs.
- **Asset platforms closed or migrated:** Poly closed in 2021, and the Sketchfab Store moved to Fab ([9to5Google](https://9to5google.com/2020/12/02/google-poly-shutdown/), [Sketchfab](https://sketchfab.com/blogs/community/sketchfab-update-what-you-need-to-know-now-that-fabs-live/)).

**O** **AI in October 2026:**

- **Speed and cost.** Image and text to 3D gives single static textured objects in about 1.5–3 minutes, for US$0.18–0.25 per call, in a vendor-affiliated stress test.
- **Not measured.** That test did not measure proportion, scale or retopology time ([HackerNoon](https://hackernoon.com/how-i-stress-tested-3-ai-3d-generators-on-the-same-inputs-what-the-numbers-actually-show?source=rss)).
- **Inside mainstream tools.** SketchUp 2026.1 added Generate Object and AI Render ([SketchUp](https://help.sketchup.com/en/sketchup-desktop-20261)).
- **Text to CAD is unsolved.** It degrades beyond basic geometry ([Text2CAD-Bench](https://arxiv.org/abs/2605.18430), [MUSE](https://arxiv.org/abs/2605.28579v2)).
- **Verification and solvers help.**
  - Programmatic checks raise median IoU from 0.81 to 0.96 ([CADSmith](https://www.alphaxiv.org/abs/2603.26512)).
  - Placing objects by raw coordinates collides without a solver ([Holodeck](https://arxiv.org/pdf/2312.09067)).
- **Agents use native operations.** Spline V2 (August 2026) added agent access and a constraint solver *and* deepened native booleans, bevels and UVs ([Spline](https://blog.spline.design/spline-v2)).
- **Copyright.** The US Copyright Office does not grant authorship for purely prompted material ([Sidley summary](https://datamatters.sidley.com/2025/02/07/u-s-copyright-office-issues-report-on-artificial-intelligence-and-copyrightability/)).
- **No survey quantifies** the share of scene content that is library-sourced versus modeled. This is the largest quantitative gap for the whole question.

**I** **Where to invest:**

- **Native:** dimensioned semantic architecture, parametric exhibition and interior families, and placement relations.
- **Native but bounded:** an edit kit for found objects.
- **Delegate:** freeform objects, to AI and import, with provenance kept.
- **Agent-callable:** native operations. The [North Star](../../docs/reference/north-star.md#ai-and-agent-surface) already makes AI a first-class client of the same typed operations. The research confirms that direction and adds one point: a weak native toolset caps what agents can do inside the product.

**I** **The strongest counterargument**, stated fairly: simple 3D tools for ordinary creators have never won on modeling depth. They won on access, assets and a destination. Every engineer-month spent on booleans competes with free Blender and well-funded AI labs.

Its weak point: the 2026 evidence shows AI cannot yet deliver the dimensioned, revisable, site-specific geometry that exhibition and interior shells depend on.

## 7. Finish, presentation and handoff precedents

| Seam | Observation | Inference for Biskiq |
| --- | --- | --- |
| Texture on generated geometry | Box (triplanar) projection plus a real-world repeat size covers most flat surfaces with no UV work, but smears on curved and swept forms ([Studio Matrx, September 2026](https://www.studiomatrx.org/students/architectural-visualization-rendering/texturing-and-uv-mapping)). Houdini derives sweep UVs from profile and path lengths | Biskiq already uses metric arc-length UVs on Walls. Every family can own real-scale texture coordinates by construction, with no user UV work, consistent with the North Star's UV non-goal |
| Edge quality | Bevel shaders cost render time and do not export; normals are lost or re-guessed across formats | Authored creases from profile corners; real profile rounding; runtime ambient occlusion and outlines for style |
| Live links to renderers | Lumion matches by name; Twinmotion 2026.1 is suspected of matching by list index; D5 depends on file names. Shapespark's linked/unlinked properties and Enscape's host-stored materials survive updates | Stable identity plus per-property ownership. Finishes stored as overrides, never baked into imported meshes |
| What clients value | Clients value still images above everything else ([Chaos/Architizer, 1,114 respondents](https://www.chaos.com/the-state-of-architectual-visualization-2025)) | Still capture deserves first-class treatment beside the visitor runtime |
| Round trip | Community advice is to stop live-syncing finished work and make one final export | One reliable final handoff may matter more than continuous sync |

## 8. What transfers to Biskiq

| Mechanism | Representation needed | Transfer verdict (**I**) | Biskiq vehicle |
| --- | --- | --- | --- |
| Explicit handles on what can move | Any | Transfer; highest return | Select pulls legible marks ([PLATE §0.8.4](../../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination)) |
| Selection or landing surface decides the operation | Any | Transfer | Ink reads the surface it lands on |
| Closed stroke offers regions | Any | Transfer | Reading chip: Room, Platform, Shape |
| Stroke-in-context consequences (path through a wall becomes a door) | Semantic | Transfer; Biskiq's natural ground | Readings limited to what owning domains support |
| Essential parameters at the gesture; full card on request | Any | Already ratified | Precision ladder; Card as the one writer |
| Strokes remain as handles | Any | Transfer | Shape outlines, Wall baselines, roof sections stay editable |
| Healing choices offered in words | Any | Transfer | Consequence vocabulary and bubble; refusal in words |
| Semantic healing | Semantic | Transfer, previewed and declared, never silent | Hosted Openings follow Walls; Rooms re-derive |
| Neighbor-face healing on general solids | B-rep kernel | Do not transfer as a general capability | Bounded families avoid needing it |
| Never-fail soft blends | Signed distance fields | Possible bounded Scene niche; unproven | Test against import |
| Geometric feature history beside semantics | Feature tree | Conflicts with ownership; do not transfer | Authored parameters are the history |
| Inferred geometric relations (Live Rules) | B-rep plus rules | Mostly replace with declared relations | Transient snaps stay transient |
| Recipes with a one-way escape that keeps the label | Semantic | Transfer | Families keep semantics when members turn manual |
| Agent access to native operations | Any | Already ratified | Typed domain operations |

## 9. Gaps

- No controlled study isolates which immediacy mechanism matters most.
- No study compares architects or exhibition designers using Shapr3D or Plasticity with those using SketchUp or BIM.
- No usage data compares handles with dialogs in recipe tools.
- No public system found robustly re-applies per-member overrides after host regeneration. Its absence among the systems covered is an observation, not proof.
- Independent cost and quality data for AI object generation in real exhibition or interior work is missing.
