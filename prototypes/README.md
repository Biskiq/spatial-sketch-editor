# Prototype library — approved targets and exploratory donors

Runnable specimens, approved visual targets and exploratory studies. They are outside npm
workspaces; **production code never imports `prototypes/`**. Start with the
[accepted product](../README.md), the [contract router](../docs/README.md) and the
[shared design system](../docs/design-system.md).

## Approved production visual targets (by surface)

These own feature layout, controls, actions and responsive states for their scope. A later explicit
approval supersedes an older detail within that scope; domain ownership, single selection, one Undo
and visitor isolation always remain binding.

| Surface | Approved target | Scope |
| --- | --- | --- |
| **Shared shell & dock** | [design system](../docs/design-system.md) + [D12 dock in Appearance UX](./appearance-ux/index.html#decisions) ([#399](https://github.com/Biskiq/spatial-sketch-editor/pull/399), [#402](https://github.com/Biskiq/spatial-sketch-editor/pull/402)) + [Round 2 shell atlas](./production-shell-wireframe/README.md) | Head, zero-width Index, dominant Stage, Card, lower working edge, dock chassis and armed-key treatment. The atlas is historical visual evidence; later approvals win. |
| **World & Layout spatial interactions** | [World interaction sheet](../docs/design-system/world-interaction-sheet.html) + [T1 interaction sketches](../docs/plans/t1-spatial-world/interaction-sketches.html) | Stage marks, direct manipulation and reading behavior for World; the T1 sketches cover the remaining T1 slices. |
| **Appearance, Paint, Finish Card, Library & Material editor** | [Appearance UX](./appearance-ux/README.md): [recommended app](./appearance-ux/app.html), [responsive board](./appearance-ux/board.html), [decisions](./appearance-ux/index.html#decisions) | Approved [#399](https://github.com/Biskiq/spatial-sketch-editor/pull/399) with the [#408](https://github.com/Biskiq/spatial-sketch-editor/pull/408) **1024 px Index coexistence amendment**: with the Index open, Library and draft editors yield the left lane so both Index filter and Library controls stay clickable. Index and Guide, prototype scaffold, alternatives and future ladder features sit outside the approval. |
| **Lights, Environment & Sky** | [Light & Sky UX](./light-and-sky-ux/index.html) ([notes](./light-and-sky-ux/README.md)) | Light Cards, Environment/Sky controls and shell placement (owner ruling, 2026-11-13). |
| **Experience & Guide** | [Experience interaction sheet](../docs/design-system/experience-interaction-sheet.html) | Guide context, Stop composition, Cut/Travel, path work and playback. Editorial semantics stay with the [Experience contract](../docs/reference/experience.md). |
| **Object Studio** | [T5 Studio specification](../docs/plans/t5-expressive-geometry/object-studio-design.md) | Focused object-editing scope, entry/return and per-axis form work. |

The shared [design system](../docs/design-system.md) owns philosophy, shell landmarks, 1024 px
coexistence and Stage mark grammar; the approved target owns the surface's composition. Neither
outranks a domain contract about what an operation means.

## Exploratory studies, interaction donors and technical benchmarks

These preserve unique research, alternatives, counterexamples and executable evidence. They are
**not** current UX authority; where a donor's shell or semantics differ, the approved targets and
contracts above win.

| Package | Question or retained evidence | Status |
| --- | --- | --- |
| [Vellum](./p3-vellum/README.md) | Architectural sketching, roofs, levels, ties and revision; model tests and mesh/evaluator comparisons | Accepted interaction evidence; local geometry and inferred relationships are prototype choices |
| [Smart Wall](./p2-smart-wall/README.md) | Wall reshaping with artwork/light relationships and revision comparison | Accepted interaction evidence; continuing relationships exceed the accepted core |
| [World creation tools](./world-creation-tools/README.md) | One lower-edge instrument, shared shape keys, consequence tokens, Paint reach and the Ask Rule; Living and Paper profiles | Interaction and identity donor for T1/T2; Canvas sketch geometry, no persistence |
| [Spatial Authoring](./spatial-authoring/README.md) | Plan/3D continuity, Rotunda, Section, Ceiling Lift, nested return and World journeys A–F | Specialized spatial interaction evidence; old Experience and shell treatments are historical |
| [Living Drawings](./living-drawing/README.md) | Contextual creation, continuing revision, repetition and exceptions | Proposed interaction model and runnable study |
| [Native Form Lab](./native-form-lab/README.md) | Editable profile families, role identity, cap lifetime, explicit repair, host revision and cold reload | Runnable technical evidence; no creator study or performance certification |
| [Shape Focus](./native-object-shaping/README.md) | Temporary sections, visible reach, kept regions and refusal | Proposed UX specification and illustrations, not a functioning shaping prototype |
| [Object Composition](./object-composition-prototype/README.md) | Definitions/uses, scope, provenance, attachment, revision comparison and repair | Unratified runnable study; ingest/storage/network are simulated |
| [Conservatory](./experience-ux-alternative/README.md) | Dense Views, long Guides and reproducible Experience scenarios | Historical semantics/scenario evidence; its shell and old runtime model are not current authority |
| [Architectural depth](./p3-depth/README.md) | Roof fields, walking lines and rail bands; 30-fixture falsification corpus with evaluator/refusal checks | Experimental geometry, not a production family or user study |
| [Render cost calibration](./render-cost-calibration/README.md) | Three r187 backends on deterministic scenes: per-draw/per-triangle/light/shadow constants, light-budget curves, a P1 count census and a prepared Gate C prediction | Runnable research evidence on one M2 laptop; synthetic scenes, one device, no product visuals; the prediction is not yet checked against a real reading |

## Use and maintenance

Each package records its own run command, real versus simulated behavior, findings and limits.
Preserve unique research, alternatives, counterexamples, mathematical findings and executable tests.
Static pages have no build step; serve the folder and confirm no console errors when changing them.
Documentation links are checked by `npm run test:arch` in `apps/editor`.
