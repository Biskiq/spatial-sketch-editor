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
| [Production shell wireframe](./production-shell-wireframe/README.md) | Owner-approved shell target states, guided interaction and atlas | Approved design evidence for its scope; mock mechanisms are not architecture |
| [Experience donor](../docs/archive/prototypes/experience-authoring/README.md) | Executable behavior and regression cases | Historical regression evidence; retain until successors demonstrably catch the same failures |

## Authority and use

[Shell](../docs/reference/design-system/editor-shell-and-visual-system.md),
[spatial grammar](../docs/reference/design-system/spatial-instrument-grammar.md),
[World sheet](../docs/reference/design-system/world-interaction-sheet.html) and
[Experience sheet](../docs/reference/design-system/experience-interaction-sheet.html) route approved UX.
Design approval establishes the desired state for its approved scope: implementation is planned
backward from it. Current code limitations do not lower an approved target. Surface genuine conflicts
with hard domain invariants for owner judgment. Proposed experiments do not establish approval.

Each package records its own run command, real versus simulated behavior, findings and limits.
Preserve unique research, alternatives, counterexamples, mathematical findings and executable tests.
Prototype snapshot Undo, mock Camera, renderer shortcuts and data shapes must never silently become
production authorities. A retained package is not an instruction to resume its old phase plan.

When editing or moving an executable, keep its assets/tests together and run its local checks.
No product imports from prototypes. Documentation links remain checked by the unconditional
architecture lane; being opt-in does not exempt a live research route from reference integrity.
