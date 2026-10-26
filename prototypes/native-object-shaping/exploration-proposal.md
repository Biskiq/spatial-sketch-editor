# Biskiq — Native 3D Object Sketching

> Superseded by the converged [Shape focus UX specification](./UX-SPEC.md). This document remains the earlier exploration; its competing-prototype program is no longer the recommended next step.

**An independent design exploration proposal · 26 October 2026**

**Status:** proposal for an interactive investigation. The earlier experiments, their implementation evidence and selected research precedents have been inspected; the interaction proposed here has not been built or tested with creators. This document specifies that next experiment. It makes no production architecture, kernel, schema or adoption decision.

## Recommendation

Explore **drawing a body through a few deliberate cross-sections**, with a visible region showing how far each change travels through the volume.

The creator begins with an empty drawing surface, gives an original outline depth, then moves through the body and redraws its shape where needed. Before accepting a change, they can see the altered volume, the transition into unchanged material, and the parts that will remain fixed. Exactness comes from refining a meaningful stretch of drawing or a visible measurement, rather than managing a net of points.

The central hypothesis is that **control over where a drawing acts is more valuable than increasingly clever recognition of what the drawing resembles**.

This is a provisional recommendation, not a claim of a new geometric invention. First compare it against editing a body's silhouette from different viewpoints. If cross-sections demand more spatial reasoning than they save, change direction before polishing the interface.

## 1. What the existing experiments establish

The evidence has three distinct sources: the commission's assessment of the experience; observations recorded by the earlier prototype authors; and source, documentation and retained screenshot inspection in this investigation. None substitutes for a new creator study.

| Experiment | Worth carrying forward | Assumption to challenge |
| --- | --- | --- |
| **Living Drawings** | Drawing against visible context; redrawing instead of rebuilding; explicit relationships; keeping displaced or unresolved work visible. Its own findings describe the value of a face-on profile lens and the danger of tidying away a deliberate taper. | Existing surroundings should not be the admission ticket to drawing. Its context-driven interpretations and plan/profile construction favor certain objects and situations. Original object invention must work before there is a room, host or named object. |
| **Native Form Lab** | Retained source drawings, consistent preview and acceptance, reversible edits, and explicit handling when a referenced part disappears. Its findings carefully distinguish automated browser evidence from usability evidence. | Technically editable source is not necessarily a useful creative interface. Exposing operation choices, coordinate locks, profile lists and carrier values can transfer the system's bookkeeping to the creator. |
| **P3 Vellum** | Drawing receives a visible reading; accepted work and suggestions look different; Draw and Select have distinct responsibilities; a snap does not silently become a persistent relationship. | Contextual interpretation must not become an expanding vocabulary of recognized objects. A generic outline can mean an original body without being classified as a lamp, bench or plinth. |

Sources: [Living Drawings proposal](../living-drawing/index.html), [round two](../living-drawing/round-two.html), [Native Form Lab findings](../native-form-lab/FINDINGS.md), [Vellum design](../p3-vellum/DESIGN.md).

Two cautions matter. First, Living Drawings' claim that its narrower construction cannot fail is stronger than its evidence supports. Its documented offset, clamping and carving limits already show that removing general booleans does not remove geometric difficulty. The commission's reports of unreliable cuts remain unresolved; this investigation did not reproduce and diagnose those failures. Second, Native Form Lab's successful identity and reload checks establish particular behaviors, not that its interface is natural.

### How PR #192 changes this proposal

The [research package](https://github.com/Biskiq/spatial-sketch-editor/pull/192) is useful evidence, especially its distinction between geometric foundations and usable workflows. Its recommendations are hypotheses to reconsider against this narrower commission.

| Finding or recommendation | Treatment here |
| --- | --- |
| A reliable drawing context matters more than an unconstrained 3D cursor. | **Keep.** The drawing surface must exist visibly before the stroke, stay fixed during it, and remain understandable after orbiting. |
| Prefer hosts and defer free workplanes until they earn their place. | **Change the starting condition.** For object creation from nothing, an independent drawing surface belongs in the first experiment. This does not require a workplane manager or unrestricted spatial chains. |
| Profile, carrier and rule form a compact language. | **Keep as one explanation of geometry, not the presumed interaction language.** A compact implementation vocabulary can still impose substantial conceptual work on a creator. |
| Families can preserve identity and refuse invalid work. | **Keep the revision obligation.** Do not require a semantic object family before someone can shape a body. |
| Freeform props can often arrive as assets. | **Reopen for this commission.** Import may complete a scene efficiently, but it does not answer whether a person can originate a distinctive native object. |
| Construction can outperform booleans on the measured fixtures. | **Do not generalize into an interaction decision.** Wall benchmarks establish neither the usability nor the validity of a new object-shaping method. |

The most relevant source sections are the [original study's spatial ink and forms discussion](https://github.com/Biskiq/spatial-sketch-editor/blob/de2f84230926a5daf610b01a458e00069112f3df/broad-research/spatial-modeling-depth-research-2026-10-25.md), the [synthesis](https://github.com/Biskiq/spatial-sketch-editor/blob/de2f84230926a5daf610b01a458e00069112f3df/broad-research/native-creative-depth/synthesis-and-direction.md), and proofs P2, P3 and P5 in the [proof agenda](https://github.com/Biskiq/spatial-sketch-editor/blob/de2f84230926a5daf610b01a458e00069112f3df/broad-research/native-creative-depth/proof-agenda.md).

## 2. Useful precedents, and their limits

These precedents support possible mechanisms. Their published demonstrations do not validate the proposed Biskiq experience.

| Precedent | What it suggests | What it does not settle |
| --- | --- | --- |
| [Teddy, 1999](https://www-ui.is.s.u-tokyo.ac.jp/~takeo/research/teddy/teddy.htm) | A drawn silhouette can produce an immediate, plausible volume. | Its inflation rule favors rounded forms. A pleasant first volume does not establish control over intentional depth or later precision. |
| [FiberMesh, 2007](https://igl.ethz.ch/projects/FiberMesh/) | Drawings can remain useful controls on the resulting surface, rather than being discarded after recognition. | A collection of surface curves can become its own modeling discipline. Surface interpolation does not automatically explain the reach of a local edit. |
| [ILoveSketch, 2008](https://www.dgp.utoronto.ca/~ravin/papers/uist2008_ilovesketch.pdf) | Drawing surfaces, oversketching and view changes can form a coherent creative workflow. | Its focus on professional design and curve models does not establish novice comprehension of solid bodies. Hidden gestures and automatic camera changes need independent scrutiny. |
| [True2Form, 2014](https://www.cs.ubc.ca/labs/imager/tr/2014/True2Form/index.htm) | Selective regularization can balance drawing fidelity with geometric regularity. | Inferred symmetry or orthogonality may remove precisely the irregularity someone intended. Reconstruction success is not consent to a geometric relationship. |
| [Surface Trees, 2008](https://www.dgp.toronto.edu/~rms/pubs/SurfaceTreeEG08.html) | Freeform surface edits can retain relationships to earlier work and support later revision. | Layered dependencies still need a comprehensible interaction. Hiding the tree is not enough to explain what will change. |

My inference from these precedents: preserve the drawing as a meaningful way back into the form, but make its spatial location and influence observable. Avoid presenting the surface-generation algorithm as the creator's task.

## 3. Four directions worth comparing

The comparison below is a design judgment, not a measured ranking. The decisive criteria are blank-start freedom, understanding depth, predicting revision, achieving deliberate precision, and sustaining variation without escalating interface complexity.

### A. Turn and redraw the silhouette

Draw an outline, obtain a provisional body, turn it, and redraw the outline from another view. The experience resembles correcting a sculpture by looking at it from different sides.

This has the strongest immediate appeal. It puts recognition of shape ahead of construction knowledge, and could suit people who think through images. However, an outline says little about hidden concavities or thickness. Two views can admit many bodies. A correction from one view can damage a satisfactory appearance from another.

**Keep as the main challenger.** Test whether a small second-view preview and explicit preservation of a previous view make those ambiguities manageable. Do not quietly treat a silhouette as a section through the body.

### B. Draw sections with visible influence — recommended first

Draw the shape at a particular place in the body. Redraw it, then see and adjust the band of volume that follows the change. The endpoints of that band remain fixed.

It asks the creator to understand a slice, but gives a concrete answer to “where does this change happen?” It can support independent front and back shapes, asymmetry, taper, swelling and precise local revisions without classifying the object.

Its danger is becoming a loft editor disguised as drawing. If people must plan a stack of profiles, manage correspondence or repeatedly add sections to defeat the system, the direction has failed its purpose.

### C. Draw a spatial scaffold and let a skin follow

Create a few characteristic curves: a spine, a rim, a crease. The system connects them with a surface. This could express forms that resist parallel sections, including branching or bent structures.

It offers substantial range, but the blank start becomes harder: where does each curve sit, which curves connect, and what fills the spaces between them? It risks becoming point-based modeling with curves replacing points.

**Reserve as a later comparison** if a section-based body repeatedly prevents ordinary intended shapes. Do not add a second drawing grammar preemptively.

### D. Shape a volume like clay

Sketch a rough body, then push, add, remove or pinch material with a broad tool. This offers immediate local expression and can accommodate topological change.

The difficult questions are precise boundaries, preserving earlier decisions and getting a controlled edge without repeated corrective brushing. Brush size, depth, strength and falloff can become another specialist interface.

**Use as a counterexample**, particularly for organic work. Do not dismiss it because the product is drawing-led, but do not assume that a clay metaphor solves control.

**Why B leads:** it addresses the stated section-to-volume uncertainty directly and makes missing depth explicit. A is the better candidate if B's spatial explanation costs too much attention. Neither wins simply by producing a more attractive prepared model.

## 4. The proposed experience

Working description: **draw a body; redraw where you mean**. This is an extension of Vellum's drawing-and-reading philosophy.

### Begin without a host

Open to a quiet stage with one upright translucent drawing sheet and a small ground shadow. The sheet has a visible border and a plain label, **Upright**. There is no room, primitive, named furniture object or operation chooser.

The creator can immediately draw a closed outline. The first mark lands on the visible sheet; no initial click is consumed merely selecting it. **Lay flat** and **Face me** provide alternative starting orientations. A border grip can tilt the sheet, with its ground intersection and angle visible. No coordinate system is required.

Orientation is a deliberate choice made between strokes. Orbiting never silently moves the sheet; the sheet never jumps to a nearby surface halfway through drawing. An optional dimension establishes scale, and a small scale mark prevents an arbitrary screen-sized object from masquerading as dimensionally specified work.

An open stroke stays an open drawing. Closure is proposed with a visible joining segment, never silently invented across a large gap.

### Give the drawing depth

The accepted outline remains a flat drawing. A visible grip labelled **Give depth** pulls a copy away from it. The two outlines and connecting volume appear together. A compact side reading shows their separation even when the drawing is viewed face-on; the grip uses a screen-space drag in that reading, avoiding an unusable end-on spatial handle.

The first volume has constant cross-section. This is an honest default, not guessed inflation. The creator sees the assumption and can immediately change either end or any intermediate section.

They may type a depth into the same displayed measurement. Both routes produce the same proposed body. Acceptance creates one undoable change; Escape returns to the drawing.

### Find a place and redraw its shape

Selecting the body exposes a small **Shape here** affordance. Moving it along the body's depth reveals a cross-section sheet. A linked side reading shows exactly where the sheet passes through the solid. The normal drawing view can face that sheet while an oblique view of the whole body remains visible.

The active section is a bold continuous contour. Hidden body edges are subdued; the old contour appears as a thin ghost while editing. A person can redraw part of the contour without tracing the entire loop.

Starting and ending near an existing contour proposes the replaced stretch, highlighting it before acceptance. If two possible stretches fit the stroke, the system highlights the alternatives rather than guessing the shorter one. A stroke away from the contour remains a new drawing until the creator chooses a meaning. Drawing inside a body does not automatically become a hole.

The system's reading is geometric and local: **Replace this stretch, at this depth**. It does not say **Make a vase** or **Edit bench back**.

### Show how the section changes the body

Each proposed redraw reveals a translucent band extending to either side of the section. Its two boundaries mark unchanged sections. The volume beyond them is visibly held in place.

```text
unchanged body | transition toward redraw | redrawn section | transition back | unchanged body
              ^ near boundary                               far boundary ^
```

The creator drags the band's boundaries to change the reach. The live body and side reading update together. Narrowing the band makes a local shoulder or waist; widening it changes a larger proportion of the object. Boundaries do not automatically step across another retained section.

Three promises must be visible and testable:

1. The edited contour reaches the accepted drawing at the active section.
2. Geometry outside the displayed band stays unchanged.
3. The transition between them is visible before acceptance; continuity or smoothness is never implied by a polished material alone.

The band initially ends at the nearest retained sections on either side, or at the body's ends. If there are no intermediate sections, the entire depth may participate; the preview must make that broad reach conspicuous. A whole-body change is an explicit widening of reach, not a hidden interpretation.

This is the consequential departure from a profile editor: **the drawing and the extent of its effect are one reviewable action**.

### Keep important decisions

A creator can select an existing section and choose **Keep this shape**. It becomes a visible boundary for subsequent changes. This preserves that cross-section's position and contour; it does not promise that an entire silhouette, surface patch or apparent perspective stays unchanged.

Ordinary accepted sections also remain editable drawings. Moving a boundary past one offers a preview of replacing its influence; it cannot silently erase the drawing. A deliberately kept section cannot be crossed without an explicit release.

This is a limited preservation rule, not a conventional constraint graph. If it requires a growing panel of locks or complicated conflict resolution, simplify or reject it. A body with dozens of unexplained retained drawings is not a successful outcome.

When an edit cannot satisfy a kept section, leave accepted work intact, highlight the conflict and retain the proposed stroke. The creator can shorten the reach, revise the stroke or deliberately release the kept section. The system must not fix the conflict by quietly distorting another side.

### Make precision an act of drawing

Freehand is one input method, not an accuracy requirement. The same contour supports a ruled straight segment and an arc drawn between endpoints with a bend gesture. No permanent control polygon is exposed.

Straightening, smoothing and rounding act on a selected stretch. Each previews the difference from the actual drawing. The prototype must preserve a small intended taper and deliberate asymmetry; a global **Tidy** switch is too coarse for this test.

Measurements name the thing being changed: **Depth**, **Width at this section**, or **Distance from first end**. Entering a width shows which side stays fixed and which moves; a centered resize is a visible alternative. Numeric precision cannot be credible if its pivot or scope is hidden.

For repeated adjustments, measurements can be dragged or typed. These are two ways to revise the same visible fact. Choosing an exact line or dimension does not silently establish symmetry, equality or an ongoing relationship elsewhere.

### Keep looking and drawing distinct

Carry forward Vellum's distinction between Draw and Select. Orbit and pan must be available with a trackpad or mouse without accidentally making marks. Pen pressure and hover are optional enhancements, never prerequisites.

**Face the drawing** and **Return to my view** are visible actions. No automatic camera motion occurs during a stroke. If the sheet becomes nearly edge-on, explain the problem and offer to face it instead of producing unstable projected marks.

The normal workspace shows the object, the active drawing and one compact depth reading. Retained sections appear on request or when they constrain the current change. There is no persistent operation shelf, profile hierarchy or coordinate inspector.

## 5. What the genuinely interactive prototype must contain

The deliverable after this proposal should be a runnable local prototype, not a narrated animation or a set of linked screens. Its initial state must be blank. Prepared examples belong behind **Examples**, and use the same data and interaction paths as newly drawn work.

### A small but complete geometric scope

Build one connected body described by compatible, closed cross-sections along one initial direction. Sections may be asymmetric, translated relative to one another, and curved or angular. The first body can be upright, flat or tilted independently of existing geometry.

The first prototype deliberately limits a body to parallel section planes and a single contour per section. Turning the camera changes the view, not that construction direction. It does not support arbitrary re-slicing as an equivalent editing representation. That limitation must be disclosed in the interface when encountered, not hidden behind a sample that happens to fit.

Real capabilities must include blank drawing, depth, orbit, section positioning, partial redraw, visible reach, deliberate preservation, local line/arc refinement, numeric measurements, cancel, undo/redo and local save/reopen. Save the editable work, not only an exported mesh or image.

No new hole, branch, merged body, arbitrary cut or seamless junction is required to prove the central interaction. These remain deliberate challenge cases in evaluation. If common desired objects depend on them, that is evidence against the proposed scope, not a reason to quietly substitute a prepared object.

### An unscripted demonstration

Ask the creator to invent a small object whose character comes from its form. They choose what it is; the interface receives no object category. Record from the empty stage, including mistakes and recoveries.

Within the session, demonstrate that they can:

- Establish an upright original outline without creating a supporting wall.
- Give it a deliberate depth and inspect it from more than one angle.
- Make front and back differ, or create a local swelling, narrowing or offset.
- Preserve a part they like while changing another part.
- Make one local measurement exact without erasing a deliberate irregularity.
- Reject an unwanted interpretation, undo an accepted edit, and continue.
- Save, reopen and revise the same drawing-based body.

For reproducible internal checks, an asymmetric handle-like body, a shallow sculptural relief and a broad angular display object exercise different proportions. These are test subjects, not required templates or evidence of general expressive range.

### The minimum trust contract

| Situation | Required behavior |
| --- | --- |
| A stroke begins on a sheet | Its spatial interpretation remains fixed until the stroke ends. |
| A valid preview is accepted | The accepted shape matches that preview. Any later exact computation must be shown and reviewed first if it changes the result. |
| A candidate becomes invalid | Show the attempted stroke and failure location over the last valid body. Do not present a clamped body as the requested result. |
| The creator cancels | Restore the complete prior accepted state. |
| The creator accepts a redraw and its reach | One undo restores both together. Camera motion does not create geometry history. |
| A drawing is replaced or disappears | Preserve any unresolved dependent work visibly; never retarget it by proximity. |
| A kept boundary conflicts with an edit | Identify that boundary and retain the proposed work for correction. |

## 6. What is geometrically difficult

**Depth cannot be recovered uniquely from a single outline.** Some assumption or additional input is unavoidable. The proposal makes depth an explicit, manipulable decision. Silhouette editing must likewise reveal its assumptions.

**A silhouette is not a cross-section.** An outer appearance depends on viewpoint and occlusion; a section describes an intersection at a specific place. Do not use the same mark for both without an explicit change of meaning. A small side view can explain this distinction but does not prove that people understand it.

**Interpolating sections is not automatically safe.** Concavity, narrow necks, inconsistent corner correspondence and rapidly changing outlines can produce folds or self-intersection. Avoiding booleans does not eliminate those cases. A feasibility spike must examine the whole connecting volume, not merely validate each 2D loop.

**Smoothness and local preservation can conflict.** Making a drastic change over a narrow band may require an abrupt transition or may be invalid. A wider transition can be offered, but must never be applied without showing that it affects more material. The prototype must distinguish a valid hard transition from a promised smooth one.

**Persistent meaning remains difficult.** Redrawing a contour can split or erase a meaningful stretch. The earlier labs offer useful evidence for preserving work and reporting unresolved references, but role names alone do not solve arbitrary topology changes.

**Representation limits are real creative limits.** Parallel single-loop sections will not cover every bent, branching, hollow or interlocking object. Rejecting a valid intended form is a limitation of this prototype, not proof that the creator's idea is invalid. Track those cases explicitly.

Specialized tools will remain preferable for complex topology, engineered fit and tolerances, controlled surface continuity, detailed sculpting and fabrication preparation. This investigation should establish a valuable native shaping range; it should not promise to eliminate those tools.

## 7. How to decide whether the interaction is better

### First compare the two strongest ideas

Make two narrow interactive probes: A, silhouette revision from another view; and B, section revision with visible reach. Give them the same starting-body capability, rendering quality, undo behavior and precision support. Use a common set of feasible revisions to compare control, then separate open-ended creation tasks to expose differences in expressive range.

Start with six to eight multidisciplinary creators, including people comfortable drawing who do not model professionally, and some experienced modelers. Counterbalance the order of A and B and use different but comparable objects to reduce practice effects. This is formative research, not a statistically conclusive preference study.

Before selected revisions, ask participants to indicate what they expect to move, including the hidden side. Compare that prediction with the preview and accepted outcome. This distinguishes understanding from merely correcting surprises until a result looks acceptable.

Then run a fresh, unscripted 15-minute creation session with the stronger candidate. Keep instruction short and consistent. Record when the facilitator intervenes; assisted completion is not unassisted success.

| Question | Evidence to collect |
| --- | --- |
| Can someone begin independently? | Time to first accepted volume; wrong-surface strokes; requests for a missing wall, plane or primitive. |
| Do they understand depth? | Correct predictions about the active section and the hidden side; interpretation corrections; recovery time. |
| Can they revise intentionally? | Unwanted remote changes, canceled previews, undos caused by surprise, and successful preservation of an intended part. |
| Is precision available without point work? | Completion of a local straight edge, an exact dimension and a small intentional taper. |
| Is the range meaningful? | Participant-defined forms, abandoned ideas, geometry refusals and workarounds, including ideas outside the representation. |
| Does the experience produce something worth keeping? | The creator's own assessment, identifiable decisions they intended, and willingness to continue. Rendering polish alone is insufficient. |

Suggested decision gates, to agree before testing: at least six of eight participants make and deliberately revise their own body within 15 minutes with no rescue after onboarding; at least 80% of sampled change predictions correctly identify the affected region; and no accepted edit silently changes a kept boundary. These are proposed design thresholds, not findings or population estimates. Report individual failures alongside aggregates.

To investigate refinement over hours, invite at least four participants to continue for 90–120 minutes and return in a second session. Look for accumulation of sections, loss of orientation, increased refusal rates, disappearing intent, and whether refinement remains drawing or becomes administrative repair. A first-session success cannot establish the longer promise.

**Reasons to abandon or substantially change B:** users repeatedly interpret the section as a silhouette; the influence band is ignored or misunderstood; ordinary changes require a forest of sections; geometric correspondence becomes a user responsibility; or users can make only close relatives of the demonstrations. If A performs better on prediction and recovery, prefer A. If both fail, revisit the spatial scaffold or clay direction instead of combining all four into a larger interface.

## 8. Proposed sequence and deliverables

| Stage | Work | Decision before proceeding |
| --- | --- | --- |
| **1. Resolve geometric honesty** | Spike blank outline-to-depth, asymmetric section revision, a kept boundary, concave contours, near-zero necks and incompatible changes. Inspect the full connecting geometry and preview/acceptance agreement. | Can the proposed band guarantee unchanged geometry outside it and clearly refuse unsupported changes? |
| **2. Compare interaction mechanisms** | Build the thin A/B probes and observe prediction, depth comprehension and recovery. | Which approach earns the next round? Do not polish B by default. |
| **3. Complete one creative loop** | Build the stronger direction into the blank-start prototype with precision, history and local save/reopen. | Can an unscripted creator originate and revise a distinctive form? |
| **4. Test sustained refinement** | Run the 15-minute sessions, longer work and return visits; include unsupported topology and awkward views. | Does additional effort improve the object without disproportionate management or repair? |
| **5. Report the boundary** | Deliver the runnable prototype, concise controls, editable participant artifacts with permission, recordings or transcripts, and findings tied to observed behavior. | State what is demonstrated, unproven, refused, or better served elsewhere. |

The findings should include one successful unscripted session, one difficult recovery, and one intended form the approach could not support. Prepared examples may explain the system, but cannot carry its acceptance case.

The proposition being tested is specific: **a creator can shape an original volume by revising a small number of understandable drawings, while seeing where each revision acts and deliberately protecting what already works**. If the prototype cannot sustain that promise, adding more recognized objects or more operations will not rescue this direction.

## Evidence notes

- PR #192 was verified through GitHub metadata and inspected at merge commit `de2f84230926a5daf610b01a458e00069112f3df`. The linked documents are pinned to that revision.
- Living Drawings and Native Form Lab were inspected in the local `native-form-lab` checkout at `c4c6675d97452d7f7ed3966d55922fa2dbd8b3f1`. Inspection included documentation, selected implementation paths and the retained [Native Form Lab browser screenshot](../native-form-lab/qa/evidence/02-pedestal-marker-reload.png). Earlier test results are attributed to their authors; they were not rerun for this proposal.
- Vellum's design and usage documentation were inspected in the local `spatial-sketch-editor` checkout at `0961000aaa6cefcd6a35f4e85efb4681c4210aaa`.
- The external precedents above were checked against author or research-institution sources. Transfer to Biskiq is explicitly a design inference.
- No sub-agents were used. No new interactive prototype or creator evaluation is claimed by this document.
