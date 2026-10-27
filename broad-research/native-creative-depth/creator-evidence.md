# Where ordinary spatial creation breaks: creator evidence

**Research date:** 25 October 2026  
**Status:** Research evidence and inference. No architecture ratification, production implementation, dependency adoption, or roadmap release.  
**Package:** [Native creative depth](./README.md) · labels follow the package's [evidence conventions](./README.md#3-how-to-read-the-evidence)

This document collects what creators struggle with when they make ordinary architectural elements, objects, surfaces and patterns. It also collects what experts tell them to do instead. It is the evidence base for the [synthesis](./synthesis-and-direction.md). The [original study](../spatial-modeling-depth-research-2026-10-25.md#15-sources-and-evidence-register) holds earlier community examples; they are not repeated here.

## 1. Findings in brief

1. **O** Across roughly a hundred fetched cases (2014–2026), about twelve mechanisms explain almost every failure. They are listed in [section 6](#6-twelve-recurring-mechanisms).
2. **I** The failures split into two kinds:
   - **Geometric:** sweeps that twist, offsets that fold, faces that will not form, tolerance tricks, and faceted curves.
   - **Semantic:** the tool does not know what a stair, roof, opening or pattern is.

   Biskiq's semantic model addresses the second kind structurally. The first kind needs a small set of robust generators underneath it, not a general kernel.
3. **O** The most expensive SketchUp recipe in the corpus is an opening in a curved wall. It takes 4 steps with paid Solid Tools and about 14 steps for an arched head, with optional lofting.
   - **Biskiq production has the geometric foundation for this case.** Wall-hosted Openings are cut analytically in the Wall's own (s, z) coordinates, with no boolean ([assessment §1](../procedural-architectural-authoring-assessment.md#1-executive-verdict)). The production mesher builds them on curved Walls with reveals and real-scale UVs ([probe](./probe-methods.md#4-results-the-matched-40-opening-wall)).
   - **It does not have the creator workflow.** No creator can draw a curved Wall or place an Opening in one today, and no planned slice delivers that yet ([§4.1](#41-element-table)).
4. **O** Many failures reported as modeling problems are design errors that the geometry tool cannot see:
   - inconsistent rise and run;
   - a walking line that does not match the rail;
   - winders that do not converge;
   - a rail floating off its treads.

   **I** For stairs and railings, domain validation is likely worth more per engineering hour than another geometric operator.
5. **O** Expert advice is often to model less:
   - fake detail with a texture or cut-out image;
   - keep geometry low-poly;
   - import an asset;
   - simplify the design;
   - accept a representational approximation.

   This is legitimate for presentation work. It is not a failure of ambition.
6. **O** Users of a mature desktop modeler still expect native rounded edges. A paid tool without a fillet drew complaints as late as 2025, and a free round-corner extension thread has about 60,000 views. **I** Some native depth is a credibility baseline, not only a power feature.
7. **O** Solved cases often chain two to five extensions; about 30 distinct extensions were recommended across the stair, roof and trim cases. **I** The demand concentrates on a small set of primitives: helix, upright sweep, surface between curves, path or radial array, footprint roof, opening in a curved host, and an editable profile on a path.

## 2. Method and limits

- **Sources.** Public SketchUp, SketchUcation, Rhino (McNeel), Shapr3D, Onshape, Autodesk, Chief Architect, Sweet Home 3D, Graphisoft and AAM community threads, vendor documentation and product pages. Two research passes covered architectural elements, and objects, surfaces and patterns.
- **Counts are not prevalence.** A table row counts fetched cases. Forums over-represent hard problems and under-represent things that are easy or bought as assets.
- **Access limits.**
  - Reddit was unreachable through every route tried on 25 October 2026. A direct request returned HTTP 403; the web-fetch tool refuses reddit.com; the in-app browser blocks reddit.com and old.reddit.com by policy; a web search found no index of the thread.
  - Autodesk and AUGI pages often returned 403, so Revit items are search-result summaries.
  - Graphisoft community pages were blocked.
  - The shared search budget ran out before glass balustrades, bay windows, Archicad railings and Vectorworks were covered.
- **The anchor thread is unverified by this research.** The cited Reddit thread ([r/Sketchup, "Trouble with faces"](https://www.reddit.com/r/Sketchup/comments/1xcfrht/trouble_with_faces/)) could not be read. [Section 3](#3-the-anchor-case-a-surface-between-two-nonplanar-curves) describes the case from the brief's summary and from closely matching SketchUp threads, not from that post.
  - Peer review reports that the thread is accessible and gives direct evidence of the author's manual workaround. That report is recorded here but not adopted, because this package does not quote or paraphrase content it could not read ([review response §5](./review-response.md#5-source-evidence)).
  - If the workaround is manual stitching or triangulation, it adds a rung to the escalation ladder in §3 and strengthens its inferences. If the thread shows a different intention, the anchor framing should be corrected.

## 3. The anchor case: a surface between two nonplanar curves

**The intention.** Fill the band between two helical edges of a spiral-stair railing, such as an inner and outer edge, or a tread edge and the rail. This is the brief's summary of the anchor thread, which this research could not read ([§2](#2-method-and-limits)).

**O** **Why it fails in SketchUp**, from matching threads:

1. A face forms only when all its edges are coplanar. Connecting matching points on two helices makes quadrilaterals whose four corners are almost never coplanar, so no face forms ([unevenly angled roofs, 2022](https://forums.sketchup.com/t/question-how-can-i-make-unevenly-angled-roofs/198191)).
2. Each quadrilateral must be split into two triangles. Move's Autofold does this with diagonals the user does not choose, which leaves "a bunch of rather ugly hidden edges" ([solid handrail for spiral stairs, 2022](https://forums.sketchup.com/t/help-with-creating-a-solid-handrail-for-spiral-stairs-please/199245)).
3. If the two curves have different segment counts, there is no one-to-one pairing, so stitching by hand gets much harder. Skinning tools exist to automate this. Curviloft has about 1.47 million downloads ([SketchUcation](https://sketchucation.com/plugin/1175-curviloft)).
4. A profile swept with Follow Me along the same helix rotates as it climbs. One expert put it this way: "The twist is built in" ([SketchUcation](https://community.sketchucation.com/post/993704)).

**O** **The community's escalation ladder:**

1. Rebuild the construction as an array of wedge components (an expert-designed 24-step recipe).
2. Use a helix generator plus an upright extruder.
3. Use a surface generator (Curviloft).
4. Bend a straight model (Shape Bender, TrueBend, FredoScale).
5. Repair it freeform (Vertex Tools, SubD).

Students barred from extensions needed several days of expert help.

**I** **What it implies:**

- a ruled or lofted strip between two carriers, with deterministic arc-length pairing and no user-visible triangulation;
- a helix path;
- a sweep whose orientation rule is explicit and visible.

**I** **What it reveals about Biskiq.** In a stair-and-railing family, both edges of that band derive from one walking line and a rail height. The surface between them belongs to the family's own output, not a free surface operation. The anchor case argues more for a **family that knows the carriers** than for general lofting.

## 4. Architectural elements

### 4.1 Element table

Each row condenses many cases. Citations are representative, not exhaustive.

| Element | What creators intend | What breaks | Typical cost | Biskiq today | Implied capability (**I**) |
| --- | --- | --- | --- | --- | --- |
| Curved and spiral stair rails | A rail that rises with the stair without twisting | Follow Me rotates the profile; different extensions give different frames; experts disagree whether the profile should stay vertical or follow the pitch ([2018](https://forums.sketchup.com/t/curved-staircase-railing-losing-orientation/75030), [volute 2018](https://forums.sketchup.com/t/staircase-handrail/66817)) | Hours to about a week; 1–5 extensions; several cases left unfinished ([2025](https://forums.sketchup.com/t/how-can-i-create-this/330766)) | **Prototype:** P3 stair from surface to surface. No production stair | A sweep with a visible frame mode (upright or pitch-normal). A rail path derived from nosings plus height |
| Stair layout | Consistent rise, run, walking line, winders and landings | Layout errors surface as geometry failures: uneven slope, winders not converging, floating rail ([irregular stair 2025–26](https://forums.sketchup.com/t/irregular-staircase/333386), [tricky stairs 2024](https://forums.sketchup.com/t/tricky-stairs/271116)) | Week-long threads; advice to redesign | **Ratified:** stairs named as a good candidate in the [North Star](../../docs/reference/north-star.md#permanent-non-goals); depth is evidence-gated | A typed stair with derived treads, stringers, soffit and rails, plus rise/run validation that explains itself |
| Railings in BIM | Rails that continue across landings and turns | Typed railings float at landings, will not join across runs, or need several railings and in-place sweeps ([Revit summaries](https://forums.autodesk.com/t5/revit-architecture-forum/join-railings-on-adjacent-stairs/m-p/12175589)) | Users leave the semantic system | — | **Transition rules** (landing, turn, termination) matter more than the straight run |
| Roofs on irregular footprints | Hips and valleys on any outline; dormers; walls meeting the roof | Each plane is built by hand; a vertex slightly off-plane breaks a face; repeated Intersect passes leave holes and reversed faces ([2020](https://forums.sketchup.com/t/hip-roof-design/144979), [2021](https://forums.sketchup.com/t/roof-intersections/160238)) | Expert recipes; extensions such as Instant Roof (US$39 a year) and Medeek ($180) | **Prototype:** Vellum overheads with Edit shape; wing roofs on L, T, U and plus plans of up to four rectilinear wings; a join of two compatible gables with a valley. **Ratified:** Edit shape for roofs in [PLATE §0.8.4](../../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination) | A footprint roof with per-edge slope, hosted dormers and walls that meet the roof. Visible failure with a fallback |
| Complex roofs, by specialists | Intersecting roofs with dormers | A dedicated framing extension called complex roofs its "biggest hurdle" in 2017 ([forum](https://forums.sketchup.com/t/medeek-truss/16452?page=34)). They are still "under construction" on its October 2026 product page ([Medeek](https://design.medeek.com/resources/medeektrussplugin.html)) | Years of specialist effort | **Deferred in P3:** joins across pitches or families, off-axis and freehand plans, courtyards, dormers and lean-tos ([record §6](../../prototypes/p3-vellum/plans/roof-footprints-final-polish.md#6-deferred--carry-to-t1--rr-2)) | **I** The boundary is set by operation, not by name ([§4.3](#43-roofs-show-the-limit-of-native-depth)): bounded joins, skeleton hips and hosted dormers may be native; framing and non-height-field massing stay specialist |
| Openings in curved walls | Put this window in that wall | A cut-opening component cuts only one flat face; a faceted curved wall offers none ([tutorial 396](https://sketchucation.com/resources/tutorials/beginner/396-window-in-a-round-wall), [arched, tutorial 397](https://sketchucation.com/resources/tutorials/intermediate/397-arched-window-curved-wall)) | 4 steps with Solid Tools; about 14 for arched heads | **Production geometry:** Openings cut in the Wall's (s, z) frame, with rectangular, rounded and pointed profiles, meshed on curved Walls. **No workflow:** Opening create and delete are planned in layout-core but "none is wired to the editor"; the Opening slice excludes curved hosts; curve authoring has no slice ([T1.P02](../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md), [S03 outline](../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s03-opening-family/implementation-plan.md)) | Extend the same host-local pattern; do not add a general boolean. The missing piece is authoring, not geometry |
| Moldings, cornices, crown and baseboards | One profile around a room, swapped for design options | Wide profiles fold at short segments and tight radii; output is non-manifold; a boolean on it can reportedly wipe the parent collection ([Ruby API, 2026](https://forums.sketchup.com/t/safely-merging-followme-cornice-groups-at-a-90-corner-non-manifold-boolean-reliability-su-2017-through-2026/346777)). Swapping a profile means re-sweeping every run: "No. There isn't. Not natively." ([2022](https://forums.sketchup.com/t/modeling-and-updating-trim-molding-profiles/194676)) | Rework for every design option | **Production:** Walls, Openings and derived Rooms supply the paths | A persistent profile on a path, with paths from room boundaries, wall tops or opening outlines, plus a corner rule. It regenerates on edit |
| Sloped ceilings and compound corners | The same stock crown everywhere | A perpendicular sweep reshapes the profile: "The projection does change the profile" ([2020](https://forums.sketchup.com/t/crown-molding-angles-design/116269)) | Carpentry-style jigs | — | Say so and offer choices: keep the profile and accept a gap, cope the joint, or use a rake variant |
| Columns, domes, vaults and coffers | Fluted, tapered shafts; vaults of unequal span; coffers on a slope | Fluting on a taper needs a loft, not a sweep. Groin curves of unequal spans are not planar. Semantic soffit tools assume horizontal ([live session 2020](https://forums.sketchup.com/t/modeling-some-fancy-columns-live/122329), [vault](https://community.sketchucation.com/post/1375124), [Chief 2022](https://chieftalk.chiefarchitect.com/topic/34499-create-a-vaulted-and-coffered-ceiling-with-trim-reference-pic-included)) | "After 6 failed attempts"; workarounds lose material-list tracking | **Prototype:** Vellum revolve overheads | A revolve with a radial modulation (flutes). Ceiling types as overhead readings. Classical orders as assets |

### 4.2 Stairs and railings are the densest cluster

**O** About twenty SketchUp threads from 2014 to 2026 concern stairs and rails, ten of them from 2022 or later. Three breaks recur:

1. the profile twists along a three-dimensional path;
2. stair logic is missing, so experts end up debating code and layout instead of geometry;
3. bending a straight stair onto a curve distorts it.

A professional stair builder in 2020 said dedicated stair software exists but is expensive and aimed at CNC production. He still wanted a general tool for presentation ([thread](https://forums.sketchup.com/t/as-a-stair-builder-id-appreciate-a-little-bit-of-narration-or-commentary-on-a-stair-modeling-demo/125831)).

**I** A semantic stair is valuable only if it covers transitions: landings, turns, terminations and changes of pitch. Revit's evidence shows that typed systems fail at exactly those edges, and users then leave them for in-place sweeps or three separate railings.

**I** **A helical stair is not geometrically deeper than an L stair.** A circular helical stair is one walking line on a helix, treads distributed under a total-rise constraint, and rails swept with an explicit frame. Its hard parts are the L stair's hard parts: validation along the walking line, and the transitions where the helix meets a landing or a straight run. Handrail easements and wreaths made for joinery are fabrication work. Where the native line falls is tested by [P12](./proof-agenda.md#p12-where-native-depth-stops-compound-roofs-and-helical-stairs).

### 4.3 Roofs show the limit of native depth

**O** Selection-driven roof tools make conventional roofs quick. Instant Roof's promotional article claims a complex roof takes about three seconds once learned ([SketchUp blog, 2023](https://sketchup.trimble.com/en/blog/article/instant-roof-instant-productivity)). Intersecting, dormered renovation roofs remain manual, even in a dedicated extension with 103,950 installations.

**O** **What P3 resolved and deferred.** Vellum's [roof footprints record](../../prototypes/p3-vellum/plans/roof-footprints-final-polish.md) is more specific than "common footprints".

It **resolved**, as interaction intent:

- wing roofs on L, T, U and plus plans of up to four rectilinear wings, with level eaves and meeting valleys;
- an explicit join of two gables with the same eave, pitch, hip and fit, into one roof with a valley, previewed and one undo step;
- refusal with the reason wherever a one-span roof would stop in mid-air.

It **deferred**:

- joins across families, eaves or pitches, which "need true surface–surface intersection, beyond the planar envelope";
- off-axis, curved or freehand plans, and plans of more than four rectangles;
- courtyards;
- stepped or one-sided wing sections;
- dormers and lean-tos, as "new massing semantics".

The record also names each production direction:

- a height-field upper envelope over an exact planar arrangement, with valley and abutment classification;
- straight-skeleton hips for arbitrary polygons;
- dormers and lean-tos as a Layout relation and a feature on top of the envelope.

**I** **The boundary should be set by operation, not by element name.** Each deferred case maps to a bounded operation in the profile, carrier and rule language, or it does not:

- **Plausibly native:**
  - joins across pitches, as an envelope of planes;
  - hips on arbitrary polygons, by straight skeleton;
  - gable and shed dormers, as profiles hosted in a roof plane's local frame, the roof analogue of an Opening in a Wall's (s, z) frame.
- **Plausibly specialist:**
  - roofs that pass over other roofs, which are not a height field;
  - curved-surface intersections between families, such as a vault meeting a gable at unequal spans;
  - framing and trusses.

Native roofs should still fail visibly with a fallback (split the footprint, or a flat or manual plane), rather than chase every permutation. Where the line falls is a hypothesis, tested by [P12](./proof-agenda.md#p12-where-native-depth-stops-compound-roofs-and-helical-stairs) and analysed in [synthesis §6.1](./synthesis-and-direction.md#61-where-native-depth-stops-compound-roofs-and-helical-forms).

## 5. Objects, surfaces and patterns

**O** A second pass covered 59 cases about furniture, lamps, soft goods, surfaces, patterns and geometry hygiene.

| Area | Representative failure | Typical workaround | Implied capability (**I**) |
| --- | --- | --- | --- |
| Rounded edges and soft forms | No native fillet; round-corner plugins fail on complex corners; soft forms need SubD stacks ([built-in fillet request, 2025](https://forums.sketchup.com/t/built-in-fillet-round-corner-please/308065)) | 2–6 extensions and libraries from two stores | Edge radius and chamfer as profile or object attributes, generated as real rounded geometry |
| Curves and tolerance | Small faces do not form; users scale models by 10, 100 or 1000 (the "Dave method") | Folk knowledge | Analytic curves, tessellated late; no tolerance the user ever sees |
| Invisible defects | Non-manifold geometry, gaps and reversed faces found much later | Solid Inspector, CleanUp, face-orientation checks | Objects that cannot hold invalid states |
| Sweeps and lofts | Hidden correspondence and seam rules; "start a new document" fixes in Onshape | Splitting profiles, end tricks | Bounded blends with automatic resampling |
| Patterns | One-time copies; changing count or spacing means rework ([slats with end behavior, 2026](https://forums.sketchup.com/t/wood-slats-on-a-curve-w-radius-and-end-behaviour/342872)) | Divide plus snap, PathCopy | A live distribution object with end conditions |
| Dense detail | 7,000 holes produce about 1.5 million edges; textured holes cast no dappled shadow without V-Ray ([perforated sheet](https://forums.sketchup.com/t/whats-the-best-way-to-model-a-perforated-sheet-in-sketchup-without-slowing-down-the-model/348145), [holes](https://forums.sketchup.com/t/cutting-a-lot-of-holes-into-a-flat-face/283658)) | Alpha textures, low poly, proxies | Instancing, plus material-level cut-outs whose shadows respect the alpha |
| 2D content | Logos and lettering go through Illustrator or Inkscape, then DXF, then a face plugin. A bas-relief came from an AI depth map and a custom script ([relief, 2024](https://forums.sketchup.com/t/2d-image-to-3d-bas-relief-via-sketchup-and-ruby/254315)) | Several applications | SVG and text to profile; emboss, relief and decals |
| Operation order | Shell after fillet; large radii before small | Trial and error, restart | Recompute from intent, so order does not matter |
| Soft goods and fabric | Cloth simulation does not deliver the intended drape or sag | Manual quad mesh plus SubD | Target-driven forms: drape, cushion puff, sail sag from boundary points |
| Changing tools mid-object | SubD for soft parts; T-Splines; upgrading to Pro | New mental model and licence | One coherent object vocabulary; assets for specialist forms |

**O** Beginners also fail on fundamentals that no operation would fix. One example is "sticky" geometry merging into neighbours until grouped ([forum, 2022](https://forums.sketchup.com/t/is-sketch-up-sponsored-by-the-super-glue-corporation/212920)). **I** Objects that never merge remove a whole class of SketchUp failures. Biskiq's ownership model already implies them.

## 6. Twelve recurring mechanisms

This merged taxonomy combines the architectural (A-P1–P12) and object (B-P1–P11) pattern tables from the two research passes. The right-hand columns are inference.

| # | Mechanism | Example cases | Kind | Where Biskiq's answer lies (**I**) |
| --- | --- | --- | --- | --- |
| M1 | The profile frame drifts on a three-dimensional path | Helical rails, ramps, stringers | Geometric | Sweep with an explicit frame mode; carriers from hosts |
| M2 | Offsets fold at short segments and tight corners | Cornices, mantels, round-overs | Geometric | 2D offset per profile point; corner rules (mitre, cope, return) |
| M3 | Nonplanar faces will not form | Railing panels, roof faces, soffits | Geometric | Generators own their triangulation; ruled strips between carriers |
| M4 | Bending trades accuracy for speed | Bent stairs and windows | Geometric | Generate *on* the curve rather than bend |
| M5 | Repetition is a one-time copy | Balusters, flutes, slats, coffers | Representational | Live distributions with anchors and end rules |
| M6 | Cutting a curved or sloped host needs booleans | Windows in curved walls, dormers | Semantic | Host-local cutting (already in production for Walls) |
| M7 | The tool lacks domain logic | Stair rise and run, roof hips | Semantic | Typed families with validation |
| M8 | Semantic systems fail at transitions | Landings, run-to-run joins | Semantic | Transition rules; an escape hatch that keeps the label |
| M9 | Tolerance and precision are fixed | ×100 scaling, far-from-origin models | Representational | Host-local frames; declared precision |
| M10 | Results cannot be edited after creation | Swapping trim, changing a count | Representational | Retained intent that regenerates |
| M11 | Curves are faceted | Segment-count folklore | Representational | Analytic curves, level-of-detail tessellation |
| M12 | Failures are discovered late and diagnosed by experts | Non-manifold geometry, failed booleans | Workflow | Refusal in words, at the gesture, with a fix |

**I** Representational problems (M5, M9–M11) come from storing a mesh instead of intent. Biskiq avoids them by construction if it keeps intent. Semantic problems (M6–M8) are Biskiq's natural ground. Geometric problems (M1–M4) need a few robust generators.

**I** M12 is a large source of community labor, and the cheapest to address: a forum's main job today is diagnosis. Biskiq's ratified **refusal in words** ([PLATE §0.8.4](../../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination)) is a real differentiator, provided the words name the cause and a next step.

## 7. What experts actually advise: model less

This section is the counter-evidence. It tests the premise that native modeling depth is the answer.

**O** Common expert advice:

- **Fake it.** Perforations as alpha textures; rattan as texture plus render-time displacement; ruffled chandeliers and sculptures as cut-out images; fluted glass as a surface with no thickness ([perforations](https://forums.sketchup.com/t/whats-the-best-way-to-model-a-perforated-sheet-in-sketchup-without-slowing-down-the-model/348145), [lamp](https://forums.sketchup.com/t/best-and-easiest-way-to-model-this-lamp/347908), [chandelier](https://forums.sketchup.com/t/complex-ruffled-fabric-chandelier/330124)).
- **Import.** A manufacturer-profile handrail from an external program; a star vault from 3D Warehouse or Blender ([SketchUcation](https://community.sketchucation.com/post/993704), [Sweet Home 3D](https://www.sweethome3d.com/support/forum/printthread_thread,11873)).
- **Simplify or redesign.** A steel-tube rail instead of a moulded timber one; fewer winders; omitting crown on a difficult ceiling ([stair](https://forums.sketchup.com/t/irregular-staircase/333386), [crown](https://forums.sketchup.com/t/crown-molding-angles-design/116269)).
- **Accept representational accuracy.** Bending distortion is acceptable "for representation" but not for shop drawings ([Shape Bender](https://forums.sketchup.com/t/curving-stairs-with-the-shape-bender-plugin/209833)). A vault was "close enough for the concept."
- **Use a specialist tool.** Blender for organic forms; dedicated stair software for fabrication.
- **Remember purpose.** Decide what the model is for before chasing precision ([curved chair](https://forums.sketchup.com/t/advice-help-on-modeling-curved-chair/121355)).

**O** Deeper tools fail too, in different places:

- Shapr3D fillets on simple parts;
- Onshape lofts that need a fresh document;
- Fusion constraint frustration;
- disputed fillet reliability between Plasticity and Rhino.

One participant in that dispute wrote: "No Software can absolve you from having to know what you are doing" ([McNeel](https://discourse.mcneel.com/t/plasticity-new-software/152284?page=15)).

**O** Repurposing semantic tools works but breaks semantics. Chief Architect users who built coffers from cabinets and symbols lost their material-list tracking ([ChiefTalk](https://chieftalk.chiefarchitect.com/topic/16155-coffered-and-vaulted-ceiling/)).

**I** What follows:

- Depth moves the failure surface; it does not remove it.
- For convincing, publishable spatial experiences, depth of **presentation** is often worth as much as depth of geometry: materials with cut-outs and correct shadows, instancing, standees, decals and good assets.
- Geometric depth pays where intent fits in a few parameters: radius, count, sag, profile, rise.

**H** Fakes that work in a still render may read as flat when a visitor moves freely in real time. No evidence was found either way. Biskiq's visitor runtime makes this a real question ([proof agenda](./proof-agenda.md)).

## 8. Overlooked use cases

**O** Exhibition, interior and installation creators need a cluster of objects between furniture and building that each fail in their own way:

- lighting fixtures (four lamp cases, 2024–2026, each with a different workaround);
- artworks and sculptures as scene content;
- slatted ceilings, walls and benches, a question Rhino users ask too ([McNeel](https://discourse.mcneel.com/t/modeling-wooden-slats-on-a-curved-surface/130715));
- perforated and pegboard panels;
- signage and lettering on curved fascias and awnings ([awning](https://forums.sketchup.com/t/bending-text-to-conform-to-awning-shape/24481));
- reliefs and logos;
- shade sails and fabric canopies;
- terrain basics such as plinths, berms and landscape seating;
- stage drapes;
- curved trade-show stands, which are sold as assets with no engineering drawings ([TurboSquid](https://www.turbosquid.com/3d-models/modern-corner-booth-design-4x4-3d-model-2539496)).

A museum-professionals thread (May 2023) reports SketchUp in use for exhibit planning before installation and for collaborating with curators, educators and collections staff ([AAM](https://community.aam-us.org/discussion/museum-exhibit-display-software)).

**I** Candidate families with high frequency and low geometric risk:

- plinths and pedestals (chamfer and radius);
- vitrines and display cases;
- slat or baffle distributions;
- perforated or patterned panels;
- revolved lamps, vases and shades with radial ribs;
- cushions;
- drapes;
- shade sails;
- terrain patches;
- signage from text or SVG;
- relief panels;
- photo cut-out standees that cast shadows.

**O** Forums contain almost no cases about pedestals, vitrines, gondolas, slatwall or exhibition graphics panels. **I** Two explanations fit: these objects are easy as boxes, or their makers rely on supplier assets. Neither is verified, and the difference matters for Biskiq's priorities.

## 9. What the evidence implies for Biskiq

All points in this section are inference. They feed the [capability map](./synthesis-and-direction.md#6-capability-map-native-asset-extension-specialist).

1. **Biskiq has the geometric foundation for the most documented SketchUp pain, not the workflow.** Curved-wall openings compile and mesh analytically in production. A creator cannot yet draw a Wall, place an Opening, or author a curve, and curved hosts sit outside every planned slice. The gaps are authoring, custom forms and presentation depth. The geometry, the part that defeats SketchUp users, is already solved by construction.
2. **Families that know their carriers beat free surfaces.** The surface between rail edges, the rail path along nosings, trim along a room, flutes around a shaft: in each case the carrier comes from a host the family already knows.
3. **Validation is a feature.** Stair rules, roof feasibility and opening fit explain failures before they become geometry.
4. **Edits after creation are the 10-hour win.** Swapping a trim profile, changing a count, or moving a wall with its hosted work intact.
5. **Material-level detail is legitimate depth.** It needs correct cut-out shadows, real-scale texture coordinates on curves, decals and standees.
6. **Imports should land in semantic slots.** Examples: an imported volute as a rail termination, a capital on a column family, a manufacturer baluster in a railing pattern.
7. **Rounded edges are a baseline.** Profile-level rounding is cheap when the profile is the source.
8. **Failure messages are product surface.** Name the cause in design terms and offer the fix.

## 10. Gaps

- No survey or telemetry gives the prevalence of any pattern, or the share of content modeled versus imported.
- Glass balustrades, baluster spacing on curved rails, bay windows, trim around arched openings, and baseboards along curved walls have no fetched case. They are inferred to share the mechanisms above.
- Archicad and Vectorworks evidence is missing. Revit evidence is second-hand.
- How exhibition and interior teams split time between modeling, sourcing and presentation is unmeasured. The [proof agenda](./proof-agenda.md) proposes how to measure it with Biskiq's own participants.
