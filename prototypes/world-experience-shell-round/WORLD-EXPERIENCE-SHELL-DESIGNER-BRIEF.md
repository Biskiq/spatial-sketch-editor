# Museum Editor — World | Experience shell design commission

## The product and the assignment

Museum Editor lets creators build and arrange spatial worlds, then give visitors ways to understand, explore and participate in them. **World** and **Experience** are two authoring lenses over one project. World addresses what exists and what it can do. Experience addresses what it means to a visitor and how that visitor encounters it.

Design one coherent shell across **World | Experience**. Switching lenses should feel like changing intention within one application, while keeping spatial memory and identity. The task is to discover a stronger World expression that naturally belongs to the accepted Experience product.

Two accepted design bodies accompany this commission. **V2 Experience** establishes the leading shell, visual and disclosure direction. **P26 spatial authoring** establishes powerful World behavior and interaction laws. Experience semantics and P26 capabilities remain accepted. P26's sidebar, tool exposure, panels and control placement are open to redesign. Existing software structure and migration effort impose no design constraints.

After acceptance, the unified shell will be adopted by the deep P26 World prototype before V2 builds Experience and cross-lens integration on it. Your assignment is product and interaction design, with no repository knowledge or implementation plan required.

## The accepted shared shell

Keep these landmarks recognizable across both lenses. Their responsibilities are strongly settled; World-side information, density, proportions and contextual transitions are the design opportunity.

| Landmark | Responsibility |
| --- | --- |
| **Head** | Persistent project identity, World/Experience switch, active Experience, save/history and Preview access. A project can support several Experiences over the same world. |
| **Index** | Locate the current work and its relationships. Experience primarily exposes Presentations and relevant relationships. World needs structural orientation, search and source context. The Index is not the main property-editing surface. |
| **Stage** | The dominant continuous spatial surface: the world, direct manipulation, spatial relations, Camera instruments, and Plan/3D readings. |
| **Card** | Stable identity, meaning, ownership, scope and edit reach. Keep its identity header available; disclose lower detail when useful. It does not transform into the Deck. |
| **Contextual Deck / instrument** | Predictable lower depth around the current task. In Experience, Guide work discloses Peek → Overview → Seam, with coordination deeper inside Seam. Design how World instruments belong to this same product without borrowing Guide semantics. |

Ordinary Experience remains quiet: useful Stage, locator and Card; no Camera rig or full timeline. A fresh Presentation exposes **Meaning, Focus, Show**, with an optional invitation to add behavior or an offer. Guide machinery appears only when a Guide exists. An existing Guide begins with a quiet Peek rather than a full Deck. Precision appears when requested.

Use **Scale × Depth** as two independent questions:

- **Scale:** What am I working on — a subject, Presentation, View, Stop occurrence, or wider relationship?
- **Depth:** How much instrument does this task need — ordinary choices, contextual inspection, coordination, or precise control?

Changing scale does not require more technical depth. Opening precision does not require opening the whole wider system. A World creator should be able to keep structural context visible while increasing detail only around the current task.

## World breadth and legitimate density

**Preserve World breadth. Progressively disclose World depth.** World creators must locate, compare and edit source truth. Persistent structure and search may be appropriate even when Experience is much quieter.

Support orientation through a project, its Buildings or placed structures, Levels, and Rooms/Spaces, with relevant architecture and objects. **Level** names vertical organization; “floor” is a familiar display term, while a physical floor is also an architectural element. A Room is an enclosed kind of Space, not the required container for everything. Open/outdoor Spaces and cross-cutting Zones must not require fictitious Rooms.

For an indoor project, a useful orientation might read:

```text
Project
  Building / structure
    Level (floor)
      Room / Space
        Architecture: Walls, hosted Openings, ceilings, other elements
        Objects: placed content and relevant components
```

This is an orientation example, not a prescribed stored tree. Architecture and Objects can be contextual groupings. A shared Wall may appear through two Space contexts while remaining one selected identity. An Opening belongs to its host Wall. A placed object shown within a Room context retains its own source ownership. Containment, location, hosting, attachment and reuse are different relationships.

Where relevant, distinguish a reusable definition, a placed instance and an internal component. Creators need to know whether an edit affects this placement or shared source. Provide selected-location recovery, intelligible search results and on-demand relation/where-used information. Do not require every relation to have a permanent panel.

World may expose more structure than Experience. Share interaction architecture, visual identity, selection, the Stage, return behavior and progressive depth; allow different information density because the jobs differ.

## World behavior that must remain possible

Preserve the reasons behind the accepted spatial-authoring behavior, while designing its shell expression freely.

| Capability / law | Why it matters |
| --- | --- |
| **Plan ↔ 3D continuity** | Read and edit the same world from useful standpoints without losing the selected subject or spatial orientation. Plan and 3D are readings of the Stage, not separate applications. |
| **Face** | Approach a useful side of a Wall or its hosted subject for direct work. Inside/outside remains spatially intelligible. |
| **Open / Unroll** | Move obstructing architecture aside temporarily; pull a curved Wall open and stop at useful intermediate curvature. Keep its as-built location understandable. The flattened work is the same source, not a copy. |
| **Section / Part / Reveal** | Choose and preview a cut, control direction and included depth, part what obstructs the work, and temporarily reveal a selected source. Excluded from this view does not mean deleted. |
| **Lift / Look-up** | Lift a ceiling to inspect contacts and gaps, preview supported fixes, and look upward to edit overhead work. Preserve orientation and distinguish an intentional opening from a problem. |
| **SETTLE and scale honesty** | Signal when the picture reads to scale, per axis. A partly curved Wall may show true height while widths foreshorten. Exact model numbers remain exact even when the picture is perspective. Settling is not permission to edit. |
| **Edit where the axis reads** | Offer a local handle where its axis is legible. If an axis is edge-on, withhold the misleading handle and retain numeric access. Precision must remain available from useful standpoints. |
| **One value, one coherent edit** | Handles, local numeric tapes and disclosed detail controls address the same source value. Only the current writing interaction is active; competing controls must not disagree. Readouts remain distinguishable from controls. |
| **Explicit refusal** | Refuse invalid proposals close to the affected work, explain why and offer a useful correction. An invalid released gesture cancels without an accepted edit; valid completion produces one logical edit. |
| **Find with reason** | Search must explain why a subject is not visible: behind something, outside the frame, beyond inspection depth, or temporarily set aside. Identify it without silently moving or changing the work; offer deliberate recovery such as bring into view, include, Reveal or Face. |
| **Exact return** | Separate stepping out of nested inspection, revisiting inspection history, and Undoing source edits. Return restores the recorded standpoint, zoom and relevant cut/depth, curvature/side, Reveal or mirrored overhead reading. Accepted source edits stay. Undo does not unexpectedly move the viewpoint. |

Direct gestures, quick access and useful intermediate states are important. Exact gesture shapes, key bindings, timing, tool counts, numeric tape appearance and instrument hosts are open. First-use motion may explain correspondence; practised work should remain efficient. Reduced motion preserves the same endpoint meaning and access. Motion speed and whether motion occurs are distinct concerns.

## Experience semantics to preserve

These definitions are sufficient for shell design; they are not invitations to redesign the accepted Experience model.

- A **Presentation** is reusable visitor-facing meaning and composition. It can exist without a Guide and can focus on subjects, relationships or a captured viewpoint. An Experience may also offer Interactions without a Presentation or Guide.
- A **Camera View** is reusable framing. One Presentation's **Set** of Views is unordered. Coexisting Views do not create route edges, a sequence or Stops.
- A **Guide** orders **Stops**. A Stop is one occurrence referencing a Presentation; repeated Stops may share the same Presentation while having distinct entry/pacing/continuation context.
- A **Seam** is the transition into the following Stop. It opens contextual Deck depth without automatically moving the Stage. Route manipulation can invite a more legible reading and must provide return.
- **Cut** creates no spatial route. **Travel** uses supported Camera connectivity; unsupported movement is an explicit gap. Guide overview does not become the whole Camera graph.
- **Ask Rule:** an edit reaching beyond the immediate use reveals its owner and affected uses and asks for deliberate scope. Local work stays quiet. Shared meaning and “this Stop” must remain distinguishable.
- Camera depth progresses from automatic framing through hints and explicit capture to precision. **Outside**, **Through** and **Plan** expose the same Camera truth. Only the active precision grip needs its numeric emphasis. Through remains visibly authoring, not Visitor Preview.
- Local coordination is deeper contextual work. Its spatial and temporal readings refer to the same authored relationship; a temporal strip cannot become another route editor.

Do not reopen Set, Seam, Guide, Ask Rule, Presentation/Stop identity, Camera ownership or Preview. The Experience side should remain recognizably the accepted V2 product.

## Product guardrails

These rules can invalidate a proposal regardless of visual quality.

| Owner / boundary | Required meaning |
| --- | --- |
| **Layout** | Owns architecture, topology, dimensions, hosted Openings, levels and architectural validity, including contextual representation. |
| **Scene** | Owns placed object composition, definitions/components, transforms, attachments, materials, lights and world presentation. |
| **Camera** | One authority for Views, spatial connectivity/routes, framing, projection and movement evaluation. Contextual controls in either lens cannot create an independent Camera system. |
| **Experience** | Owns visitor meaning, Presentations, Guide occurrences/order, continuation and contextual behavior uses. It references source subjects and supported capabilities rather than duplicating them. |
| **Reusable resources** | Keep independent identity and reuse scope; editing a use does not silently rewrite every use or an instance's baseline. |

World is a lens exposing source truth and intrinsic capabilities, not a new merged document or semantic owner. Ownership is never inferred from the panel, lens or hierarchy in which something appears.

Maintain one canonical current selected identity and one coherent accepted-edit/history path across lenses. Compound work accepts together and can be undone coherently; failed acceptance leaves prior source intact. Repeated names are not identity, and missing references cannot silently be repaired by name, proximity or containment.

Use project/world-local placement with explicit internal frames and attachment relationships. A Room is not a mandatory coordinate parent. Local precision states the meaningful frame/datum; grouping and proximity do not make a subject follow another subject automatically.

Temporary inspection is not authored visitor behavior unless explicitly captured with a stated target and scope. A lens switch is not capture. Guide order and Camera spatial topology remain distinct. Generated display geometry and route marks are not new authored subjects or editable copies.

**Preview is visitor execution:** authoring infrastructure disappears, session choices do not write source, and exiting restores the lens, selection, Card context, standpoint and relevant inspection. Published visitors likewise receive no editor machinery. Missing required behavior remains explicit rather than appearing executable.

## Visual language and design freedom

The accepted V2 boards lead the shared visual direction: a quiet engineered chassis, dominant spatial Stage, dark mat where depth matters, drafting vellum where measured work matters, restrained technical ink, clear selection, contextual instruments and local numeric precision. Keep decorative noise low. Dense source information should feel professional and legible; secondary metadata should compress before identity or location disappears. Avoid proliferating dashboards.

**Locked distinctions:** selected, hover, keyboard focus, armed, disabled, refusal, warning, temporary inspection, preview and authored versus derived information remain distinguishable. Use more than hue. Refusal must preserve readable focus and selected identity; view-only displacement must not look like damage or an accepted source move.

**Open treatment:** World hierarchy/search presentation, relation browsing, Card expansion, tool exposure, instrument transitions, density, sizing and responsive collapse. Refine shared treatments while keeping the Experience side close to accepted V2. P26 references communicate behavior and emerging materials; their exact chrome and colors are not a visual template.

A settled V2 treatment may be challenged only when it creates a genuine cross-lens contradiction. Explain the contradiction, why the accepted treatment fails, and how the replacement preserves the underlying rule and strengthens coherence. Stylistic matching alone is insufficient reason to reopen Experience.

## Situations to demonstrate

These are coverage requirements, not a mandatory screenshot count. Use coherent subjects across the sequences so continuity can be assessed.

1. **Ordinary World:** Building/Level/Room or Space orientation, architecture/objects, search, an ordinary selected subject, simple Card and dominant Stage. Deep machinery remains undisclosed.
2. **Dense World:** multiple levels and Spaces, architecture and objects, long and repeated names/categories, shared contextual identities, locatable selection, usable search and relations. A useful stress case is three levels, eight or more Spaces per level and many dozens of Walls; these are test contents, not a mandatory data structure.
3. **Contextual inspection:** use accepted Face, Open, Section or Reveal behavior. Show how deeper capability gathers around current work and how the creator steps back exactly.
4. **World precision:** local handles, dimensions, typed tape, a meaningful refusal and exact source editing. Show how precision closes or collapses without losing identity.
5. **World → Experience:** carry the selected subject, Stage, standpoint and relevant inspection where appropriate. Replace source-edit affordances with visitor composition; structural orientation gives way to Presentation/relationship context. Make any context change deliberate and understandable.
6. **Experience → World:** restore useful source context and structure with standpoint/selection continuity. Experience authorship remains preserved but inactive. Define what happens when the creator selects an unrelated World subject; do not silently attach it to remembered meaning or recapture a View.
7. **Cross-lens density stress:** show structurally dense World alongside progressively quiet Experience. Both must read as states of one product, including when depth or available window space changes.

## Deliverables and review questions

Provide a recommended unified shell expression, with annotated states or sequences covering the situations above. Choose boards, diagrams, component studies, a small interactive prototype or another form that makes interaction and transitions convincing. Include a short rationale for breadth/depth decisions, what remains persistent, what becomes contextual, selection/scope grammar and return behavior. Include density and accessibility treatments sufficient to assess the proposal. Document any proposed exception to settled V2 with the contradiction and preserved rule.

You are not asked to define storage, settle unresolved domain policies, redesign Experience capability, implement software or optimize migration cost. If a behavior needs an unspecified product decision, state the question and illustrate the supported behavior without inventing an automatic rule.

Review will ask:

- With lens labels hidden, do the screens unmistakably belong to one application?
- Does Experience retain the accepted V2 landmarks, quiet default and progressive disclosure?
- Can World keep necessary hierarchy/search breadth without permanent deep tooling?
- Can creators locate the selected identity, host/location and edit reach under density pressure?
- Are all accepted P26 capabilities accessible, with honest scale, local precision, refusal and exact return?
- Do lens changes preserve spatial memory and source/meaning context without accidental capture or duplicated ownership?
- Are Guide order, Camera topology, shared meaning and occurrence-local work visually distinct?
- Does the Stage remain useful as instruments expand, at smaller desktop sizes and with reduced motion/keyboard interaction?
- Is there real improvement in World expression, with a clear basis for later adoption by the spatial-authoring prototype?

## How to read the accompanying visual package

The ten images are deliberately selective. Treat their content as evidence for the lessons below; the brief supplies the interaction rules that static images cannot prove.

| Image filename | Learn from it | Do not freeze |
| --- | --- | --- |
| `01-v2-ordinary-experience.png` | Ordinary Presentation, unordered framing Set, Card and quiet Guide Peek | Fixture, pixels, implied connectivity from association lines; no Guide means no Peek |
| `02-v2-contextual-deck.png` | Guide overview, abstract Stop pins, lower depth with stable landmarks | Always-open Deck, exact spacing or automatic viewpoint change |
| `03-v2-camera-precision.png` | Through precision, local value, ownership and explicit return | Mandatory initial posture or separate Camera application |
| `04-v2-scope-and-reuse.png` | Shared Presentation versus this Stop; deliberate wider edit reach | Literal prompt text or permanently expanded scope choices |
| `05-p26-ordinary-world.png` | Structural breadth, hosted subject, local editing and dark spatial mat | Rail, sidebar, permanently open property set or toolbar population |
| `06-p26-plan-and-relations.png` | Same world read in Plan; scale and contextual wall/ceiling relation | Exact view switch or a before/after selection claim: 05 and 06 select different subjects |
| `07-p26-unroll-and-scale.png` | Useful partial Unroll and height-only scale honesty | Upper strip, dial, preset or locator geometry |
| `08-p26-section-and-depth.png` | View-only Section depth; selected source and understandable exclusions | Badge rendering, permanent depth controls or default depth |
| `09-p26-local-precision-refusal.png` | Local numeric entry, retained selection and readable syntax refusal | Exact popover or literal message; also demonstrate a geometric refusal in your proposal |
| `10-p26-find-with-reason.png` | Hidden-behind results and structural context | Search modal, fixture query, historical palette or surrounding chrome |

The P26 rasters include differing accent treatments. They are not a color specification. Follow the accepted V2 common visual identity while preserving clear semantic state distinctions and the World behavior described here.
