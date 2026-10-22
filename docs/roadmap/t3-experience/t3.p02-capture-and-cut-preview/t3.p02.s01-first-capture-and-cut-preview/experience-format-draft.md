# T3.P02.S01 — Experience format draft (AM-9 authored homes, Presentation entry)

**Status:** draft for owner review with S01's finalized scope, 2026-10-22. Not ratified, not
implemented. [AM-9](../../../../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover)
leaves the authored homes for presentation text and the Cut/Travel selector to their first authoring
consumer, T3.P02; this is that consumer's proposal. It changes [AM-6](../../../../reference/composition-execution.md#am-6-execution-program-and-visitor-profile-v1)
only by adding Presentation entry. Plan: [S01](./implementation-plan.md).

## Why the current unit cannot carry S01 (verified at `f516e1ff`)

The Experience unit is format 1 with a strict reader that refuses unknown keys. A Presentation is
`{id, label, viewId}`: one View and no subject or text. A Stop is `{id, presentationId, holdSeconds?,
continuation?}`, with no Stop-local entry View and no Cut/Travel choice. The approved scope needs
all of these: Presentation subject/use, Information-panel text, a Default View distinct from Stop-local
entry, and Cut or supported Travel. The interpreter cannot enter a Presentation without a Stop:
`enter` with no entry Stop completes at once, and `navigate` takes only Stop IDs. The visitor works
around this outside the interpreter.

## Proposed format 2

Under the North Star's [pre-baseline rule](../../../../reference/north-star.md#release-and-source-baselines),
the Experience unit moves to format 2 and readers refuse format 1. There is no migration.

| Record | Format 2 fields (additions in bold) | Rules |
| --- | --- | --- |
| Presentation | `id`, `label`, **`viewIds`**, **`defaultViewId`**, **`subject`**, **`text`** | `viewIds` replaces `viewId`: ordered, unique Camera View IDs this Presentation uses, possibly empty; display order only, never Guide order or connectivity. `defaultViewId` is one of them or null; an unset Default is an honest state that cannot be entered. `subject` is an F.1 semantic reference with `componentId: null`, or null for an environment or region Presentation; no Room or clone is created to host it. `text` is null or `{kind: 'plain', body}`. |
| Presentation text | `kind: 'plain'`, `body` | A closed kind set with one member. Plain text with paragraph breaks and a bounded length; no markup, links or part keys. A later annotation kind joins the set with its own format change. |
| Stop | `id`, `presentationId`, **`entryViewId`**, `holdSeconds`, `continuation` | Optional `entryViewId` must be one of its Presentation's `viewIds`; when absent the Stop enters at the Default. Hold and continuation are unchanged. |
| Continuation edge | target (`sequence-next`, a Stop, `end`), **`transition`** | `cut` (the default) or `travel`. Travel is valid only where Camera connectivity supports that pair of Views; otherwise authoring and Preview report a gap. Experience never silently cuts instead, and never searches the Camera graph. |
| Guide, Experience | unchanged | Guide order remains the only order writer; `entryGuideId` stays null when there is no Guide. |

**Program and interpreter.** Lowering emits an entry for every Presentation with a Default View, and
the interpreter gains a Presentation-entry event that starts a run at that View with no Stop, then
exits through the same Camera return. The program format number bumps, and lowering and interpreter
change together. No program is persisted today: Preview is the first production caller of lowering.

**Resolution.** View references resolve through F.1 unit resolution across the Camera unit; `subject`
resolves to a Scene entity or Layout element. An unresolved reference stays as written with derived
diagnostics, as Experience IDs do today, and is never retargeted.

**Run epochs.** Every Preview entry builds a fresh runtime, so it has a fresh run epoch. Camera output
tickets carry that epoch, so a completion from an exited run is refused. S01 offers no same-run
Reset. A case that would need one stops and reports, because it requires the ratified reset-fence
interpreter change.

## Open points for review

1. The text length bound (proposed 4,000 characters) and whether Stop-local text is excluded from S01
   (proposed: excluded; text belongs to the shared Presentation).
2. Whether `entryViewId` alone covers "distinct entry roles" at reused Stops (proposed: yes; holds
   and continuation already differ per Stop).
