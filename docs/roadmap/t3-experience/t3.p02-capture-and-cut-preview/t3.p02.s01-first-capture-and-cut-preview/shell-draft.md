# T3.P02.S01 — Shell draft: capture, Guide and Preview

**Status:** first draft, 2026-10-22; its Preview entry rule is owner-accepted (batch E,
[record](../../../../reference/decisions/batch-e-authorization-2026-10-22.md), E5), and the rest is reviewed before build, under PLATE's
[feature design loop](../../../../reference/design-system/editor-shell-and-visual-system.md#product-convergence-destination).
It sets no pixel, keymap or format and is revised after browser observation. Authority stays in
[PLATE Experience expression](../../../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression)
and [Preview takeover](../../../../reference/design-system/editor-shell-and-visual-system.md#preview-takeover);
the Experience scenarios (originally Conservatory's; shell chrome follows [Production shell Round 2](../../../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md): Experience tools in the shared dock) — the [scenarios](../../../../reference/design-system/editor-shell-and-visual-system.md#experience-design-acceptance)
are the acceptance language. Prototype chrome is not adopted.

## Starting point (landed partial shell)

The Head already has the World | Experience lens switch, Undo/Redo, Save and a disabled Preview button
whose reason reads *Visitor Preview arrives with T3*. The Experience lens has no content yet. Index,
Card and the lower instrument host exist, and contributions reach them through the Stage adapter
contract; a needed host seam is a stop-and-report to T1.

## Homes

| Context | Index | Card | Lower surface | Stage |
| --- | --- | --- | --- | --- |
| Empty Experience | *Create Experience* door | — | — | The world, no assumed Guide |
| Presentations | Presentations with their Views, searchable for the 20/50-View fixtures; Guides listed separately | Selected Presentation: thumbnails, Default marked, subject, text, *Used in* Stops | An open Guide may stay | View markers; selecting never moves the Camera |
| Capture | — | *Capture View* on the Presentation Card; *Present this* on a Scene subject Card creates a Presentation with that subject | — | A capture frame showing the View's aspect over the current standpoint |
| Look through | — | Identity and *Update View* / *Exit* only | — | The evaluated Camera image; provisional until Update; Exit returns through Camera |
| Guide open | Guide marked open, distinct from selection | Selected Stop: Presentation, entry View, hold, continuation, transition | The Guide instrument: ordered Stop items, insert, reorder by keyboard and pointer, transitions with Cut/Travel and gap notes | Entry Views of nearby Stops |
| Preview | — | — | — | Isolated visitor execution with an obvious *Exit Preview* |

The Guide instrument may claim breadth: long Guides need their Stop order and transitions legible
together, which is the case PLATE names. It keeps Card identity canonical and follows T1's
Card/instrument arbitration. Until T1.P02.S02 lands that rule, S01 verifies no overlap at the tested
widths and adds no new collision.

## Preview entry and exit

Preview opens from the Head. It enters *what you are working on*: from the selected Stop of an open
Guide, otherwise from that Guide's entry Stop; from a selected Presentation with no Guide open, that
Presentation alone through Presentation entry; otherwise the Experience's entry Guide; with no Guide
at all, a visitor list of enterable Presentations. A Presentation without a Default View is listed as
unavailable with the reason. Exit, Esc, or the end of a Guide returns to the lens, selection, Card,
standpoint and open Guide from which Preview was entered. Preview code loads on first use, and a
repeat entry reuses the loaded chunk.

## States to build and observe

Empty Experience, one Presentation without Views, unset Default, a missing View reference, a shared
View used by two Presentations (Ask Rule on Update), Presentation reused at two Stops with different
entry View and hold, Travel unsupported between two Views (gap shown, no silent Cut), dense 20/50-View
and 15/30-Stop fixtures, keyboard-only capture and Guide editing, narrow viewport, reduced motion in
Preview, and exit during Travel.

## Review checkpoints

Before build: review the Preview entry rule and the Guide breadth claim, which are the two choices
PLATE leaves to domain planning. After build: real-route browser journeys in both readings, recorded
with revision, viewport and reduced-motion state; revise. Proposed departures: none.
