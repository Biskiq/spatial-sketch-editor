# Glossary — domain and shell terms

> **Covers:** the terms a new contributor meets first. **Authority:** the routed contract wins when
> this summary is insufficient. **Read next:** [architecture](./reference/architecture.md),
> [composition](./reference/composition-execution.md), [shell](./reference/design-system/editor-shell-and-visual-system.md).

| Term | Meaning |
| --- | --- |
| **Layout** | Architectural authority: floors, junctions, walls, rooms, openings, levels, placed structures and validated alternatives. Persisted as a versioned unit; code in `packages/layout-core`. |
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
| **Object Focus** | A proposed T5 editing scope for refining one object on the same Stage and source. It is not a current feature, another Scene or a second renderer. |
| **F2 / unit envelope** | The current project source shape: one envelope containing versioned Layout, Scene, Camera, Experience and resource units plus accepted revision and dependency lock. |
| **Capability ledger** | Definitions of what creators should be able to do, with review records but no hand-edited status. Health/maturity are computed from tagged checks and live bug state. |
