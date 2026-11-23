# Prototype and experiment library

Opt-in runnable experiments, approved design specimens and proposed interaction studies.
They are outside npm workspaces and production imports. Read only when a task needs their evidence;
start with the [accepted product](../README.md) and [canonical references](../docs/README.md).

## Evidence catalogue

| Package | Question or retained evidence | Interpretation |
| --- | --- | --- |
| [Architectural depth](./p3-depth/README.md) | Roof fields, walking lines and rail bands; 30-fixture falsification corpus with evaluator/refusal checks | Experimental geometry, not a production family or user study |
| [Vellum](./p3-vellum/README.md) | Architectural sketching, roofs, levels, ties and revision; model tests and mesh/evaluator comparisons | Accepted interaction evidence; local geometry and inferred relationships are prototype choices |
| [Smart Wall](./p2-smart-wall/README.md) | Wall reshaping with artwork/light relationships and revision comparison | Accepted interaction evidence; continuing relationships exceed the accepted core |
| [Native Form Lab](./native-form-lab/README.md) | Editable profile families, role identity, cap lifetime, explicit repair, host revision and cold reload | Runnable technical evidence; no creator study or performance certification |
| [Living Drawings](./living-drawing/README.md) | Contextual creation, continuing revision, repetition and exceptions | Proposed interaction model and runnable study |
| [Shape Focus](./native-object-shaping/README.md) | Temporary sections, visible reach, kept regions and refusal | Proposed UX specification and illustrations, not a functioning shaping prototype |
| [Object Composition](./object-composition-prototype/README.md) | Definitions/uses, scope, provenance, attachment, revision comparison and repair | Unratified runnable study; ingest/storage/network are simulated |
| [Spatial Authoring](./spatial-authoring/README.md) | Plan/3D continuity, Rotunda, Section, Ceiling Lift, nested return and World journeys A–F | Specialized spatial interaction evidence; old Experience and shell treatments are historical |
| [Conservatory](./experience-ux-alternative/README.md) | Dense Views, long Guides and reproducible Experience scenarios | Historical semantics/scenario evidence; its shell and old runtime model are not current authority |
| [World creation tools](./world-creation-tools/README.md) | One lower-edge instrument: eight labelled keys (four families: Build, Form, Landscape, Furnish) and one tier for tools and options, selection actions or Library; Sky in the head; shared shape keys, in-place consequence tokens amendable in one undo step, Paint reach and the Ask Rule; Living Draft identity with Living and Paper profiles | Interaction and identity donor for T1/T2, for owner review; Canvas sketch geometry, snapshot history, no persistence |
| [Production shell wireframe](./production-shell-wireframe/README.md) | Owner-approved shell target states, guided interaction and atlas | Approved design evidence for its scope; mock mechanisms are not architecture |
| [Appearance UX](./appearance-ux/README.md) | Paint, colour picker, Finish Card, Library and inspection, Material editor, Align, import, repair and transfer, plus the shared dock treatment in D12. See the [recommended app](./appearance-ux/app.html), [responsive board](./appearance-ux/board.html) and [owner decisions](./appearance-ux/index.html#decisions). | **Approved production UX target** ([#399](https://github.com/Biskiq/spatial-sketch-editor/pull/399), 2026-11-22). Scope covers the recommended states. Index and Guide, prototype scaffold, alternatives and future ladder features sit outside this approval. |
| [Render cost calibration](./render-cost-calibration/README.md) | Three r187 backends on deterministic scenes: per-draw/per-triangle/light/shadow constants, light-budget curves, a P1 count census and a prepared Gate C prediction | Runnable research evidence on one M2 laptop; synthetic scenes, one device, no product visuals; the P3 prediction is not yet checked against a real reading |
| [Experience donor](../docs/archive/prototypes/experience-authoring/README.md) | Executable behavior and regression cases | Historical regression evidence; retain until successors demonstrably catch the same failures |

## Authority and use

[Workflow](../docs/workflow.md#design-and-reference-maintenance) defines the two approval modes
and design review. The [shared shell](../docs/reference/design-system/editor-shell-and-visual-system.md)
and [spatial grammar](../docs/reference/design-system/spatial-instrument-grammar.md) cover common
editor behavior.

Each package records its own run command, real versus simulated behavior, findings and limits.
Preserve unique research, alternatives, counterexamples, mathematical findings and executable tests.
See [prototype area instructions](./AGENTS.md) for package maintenance.
