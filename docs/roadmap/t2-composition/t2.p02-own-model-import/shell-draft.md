# T2.P02 — Shell draft: import, review and place an own model

> **Round 2 alignment (2026-10-23).** [Production shell Round 2](../../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md) is the destination: read "Place family" as the Library, "Dimensions" as the Card's fields and Stage rays and points, and Find as Find in the Head. Approved scope is unchanged; reconciliation happens at this draft's review.

**Status:** first draft for review, 2026-10-22, under PLATE's
[feature design loop](../../../reference/design-system/editor-shell-and-visual-system.md#product-convergence-destination).
It sets no pixel, keymap or format, and it is revised after S02's browser observation. Authority stays
in [PLATE](../../../reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination):
Import is a **procedure** (steps, validation, Apply), so it lives in the lower World Instrument and is
reached from the **Place** family and Find; it earns no permanent chrome.

## Flow

| Step | Instrument content | Stage and Card | Refusal and cancel |
| --- | --- | --- | --- |
| Choose | *Import model…* in Place and Find opens the procedure with a file chooser and drop target; it accepts one GLB, or a glTF with its buffers and maps chosen together | Unchanged; selection kept | Wrong type or over the size bound refuses before reading, in words |
| Read | Progress while the worker validates and prepares the derivative; Cancel always available | Unchanged | Validation errors listed plainly; Cancel discards everything |
| Review | The ingest report: size, triangles, maps, textures reduced; *found but not used yet*: parts, animations, variants | A ghost at the Stage centre, at the proposed scale, sitting on its pivot | — |
| Confirm size | Measured bounds shown in metres; a units choice (metres, centimetres, millimetres, inches) when the bounds look implausible, never silently guessed; pivot defaults to bottom-centre with a choice of bounds centre | The ghost updates; footprint shown on the floor | — |
| Approve | *Approve and place* uploads source and derivative with progress, then approves | — | Network failure keeps the review for retry; a replaced project or ended session drops the result without installing |
| Place | Place stays armed with the approved model; a click on floor support places it | The placed instance becomes selected; the Card shows name, kind *Imported model*, footprint, and a ⋯ list with Duplicate and Delete | Placement refusal stays at the pointer |

After approval the model is a Place entry for this project, so later instances do not re-import.
Move, turn, resize and duplicate use the existing Scene gestures and Dimensions; contact comes from the
approved definition, so the model sits on the floor in Plan and 3D.

## States to build and observe

Ordinary use, a large file near the bound, an invalid file, a Draco/meshopt/KTX2 source, a model with
parts or animation (reported, not offered), cancel at every step, offline during approve, keyboard-only
use of the whole procedure, narrow viewport (the instrument keeps local span; the Card compresses per
the T1.P02 arbitration), and reduced motion.

## Review checkpoints

Before S02 build: review this flow and the report wording. After S02 build: browser observation of
import → place → duplicate → Save → reopen → Preview, recorded with revision and viewport; revise.
Proposed departures from PLATE: none.
