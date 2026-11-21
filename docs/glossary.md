# Glossary — domain and shell terms

> **Covers:** the terms a new contributor meets first. **Authority:** the routed contract wins when
> this summary is insufficient. **Read next:** [architecture](./reference/architecture.md),
> [composition](./reference/composition-execution.md), [shell](./reference/design-system/editor-shell-and-visual-system.md).

| Term | Meaning |
| --- | --- |
| **Layout** | Architectural authority: floors, junctions, walls, rooms, openings, levels, placed structures and validated alternatives. Persisted as a versioned unit; code in `packages/layout-core`. |
| **Space** | The product word for one persistent Room record. An enclosed Space has no `virtualEdges`; an open Space states straight virtual edges between existing Junctions to close its Wall gaps. The collection and type keep the name Room. |
| **Horizontal Region** | An independent Layout slab with a polygon footprint and thickness. Floor regions measure elevation at the top, and overhead regions measure it at the underside. |
| **Virtual edge** | One stated straight open side between two existing Junctions, in a Space's boundary cycle. It has no id, height, thickness, Opening or surface, and never takes part in noding or connectivity. |
| **Scene** | Object-composition authority: entities, materials, textures, lights, native forms, world presentation. Persisted as a versioned unit; no Camera or editorial fields. |
| **Camera** | Viewing authority: Views, connectivity, paths, framing, projection and evaluation. One evaluator serves World inspection and Experience playback. |
| **Experience** | Visitor-facing editorial authority: Presentations, Guides, Stops, pacing, invitations, detours and the run program. Experience owns meaning and order, not Camera geometry. |
| **Presentation** | A reusable visitor-facing composition about Scene subjects, a region or the environment. It has ordered Views and an explicit Default (its first View); it is not a container. |
| **View** | A Camera-owned standpoint/framing used by a Presentation; Experience owns which View a Stop enters and when. |
| **Guide** | One linear authored order of Stops with `automatic` or `manual` pacing. Opening Guide is explicit on the Experience; no start Stop, continuation node or Gate is authored in format 4. |
| **Stop** | One visit to a Presentation: one entry View (or the Presentation Default), one finite stay, an optional invitation and an optional outgoing Cut/Travel. |
| **World lens** | Creator view exposing Layout/Scene truth, composition and Camera inspection. It is not a separate persisted `WorldDocument`. |
| **Experience lens** | Creator view for visitor meaning and occurrences; it may expose Camera authoring through the canonical Camera operations. |
| **PLATE** | The owner-ratified shell and visual-system contract: Head, Index, Stage, Card and the lower working edge, with their material, type, state and return rules. |
| **Stage** | The dominant spatial workspace. Plan/3D readings show the same world through one viewport/Camera authority; it is not a second renderer or scene graph. |
| **Object Studio** | The first focused scope: native-object authoring on the same Stage, project and source, entered from World or as a standalone object project. Dual entry and profile revision are implemented. It is not another Scene, renderer or material model ([T5 Studio](./roadmap/t5-expressive-geometry/object-studio-design.md)). |
| **Focused context** | A focused scope, such as Object Studio, that narrows work to one subject or task and may expose deeper tools; lenses and temporary readings are the other authoring contexts. It changes scope, not source, and owns no capability ([shell](./reference/design-system/editor-shell-and-visual-system.md#focused-authoring-contexts)). |
| **Finish** | A project's reusable, shareable appearance, assigned to objects, Layout surfaces and imported models. Its base is a catalogue entry or a content-addressed `material` resource, plus sparse overrides. |
| **Material family** | A versioned material grammar and evaluator, such as `pbr-metallic-roughness/v1`. A family owns its source and evaluator and is admitted as a whole; the first is not the universal editable format, and later families are not limited to its signals ([appearance authoring](./reference/architecture.md#appearance-authoring-destination)). |
| **F2 / unit envelope** | The current project source shape: one envelope containing versioned Layout, Scene, Camera, Experience and resource units plus accepted revision and dependency lock. |
| **Capability ledger** | Definitions of what creators should be able to do, with review records but no hand-edited status. Health/maturity are computed from tagged checks and live bug state. |

- **Environment control** — the World Stage control at bottom-right that opens the Sky panel.
- **Celestial Dial** — the Stage instrument that shows the Sun or Moon bearing, noon heading,
  and the shadow of its central pin.
