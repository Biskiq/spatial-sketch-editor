# Biskiq spatial Experience authoring prototype

A disposable local prototype of audience Encounters, independent contributions, generic subject capabilities, an optional Guide, and a small spatial presentation runtime.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. **Reset** restores the baseline room and clears authored work; **Load example** loads a complete, editable Experience. Neither starts playback. Use **Reviewer Presenter** to author from a clean state.

## Quickstart (low floor)

1. Select a subject (for example Machine), leave *Include a suggested view* checked, press **Create Encounter**, give it a purpose, write a short **explanation**, then operate a subject control and choose **Use in Experience**. Press **Preview** — a Guide is not required.
2. Exit Preview, select the Encounter and press **Add encounter to Guide**. It adds exactly **one** position. Repeat the loop for a second Encounter and use **Next** between the two.
3. In Preview, choose **Free exploration**, move the camera, then **Return to guide**.

Nothing above requires a duration, cue, start/end relationship, lifetime, definition/use scope, or schema field. Timing and lifecycle detail is optional and lives behind *Presentation details*.

## Model in one page

- **Encounter** — audience intention plus organizational membership. Contributions can be regrouped without changing when they run.
- **View** — reusable framing. A first View can be presented on entry; additional Views are connected to a named phrase with **Show during this explanation** or left available for manual viewing. Listing Views creates neither playback order nor Guide positions.
- **Explanation** — the narration textarea. Duration and captions derive from the text at a fixed reading rate; the duration field is an optional override.
- **Activity** — an authored subject operation with its own start, boundary and interruption policy.
- **Interaction** — a visitor offer with a separate activation subject and an invocation target. Availability is Experience-wide or Encounter-contextual.
- **Optional Guide** — one route with positions. Each position is a distinct occurrence; repeated checkpoints share a View use unless you explicitly copy it.

### Guide, reuse and Next

- **Add Encounter to Guide** creates one position. **Add selected views as checkpoints** is a separate, explicit action, and adding or removing Guide content never edits the Encounter.
- Each position chooses one of three presentation behaviours: **Present this Encounter** runs its authored viewing relationships, **Start from this View** frames that View and continues with future cues, and **Keep current viewpoint** suppresses automatic viewing entirely while Activities continue. A null View reference alone is never asked to mean both.
- Route order is the single authority for default **Next**. A position may instead carry an explicit target or end; one resolver serves the Guide strip, inspector, runtime and tests.
- **Only this View use** edits one appearance; **Everywhere this View is used** edits the definition and reports the affected count. **Edit only this checkpoint** makes a private copy and retargets that position before editing. Adding a checkpoint never copies by itself.
- Shared framing never shares connections, cue relationships, gates, lifetimes or interruption policies.

## Auto pacing and Camera

Make **Auto** the pacing default. It derives readiness from the latest relevant narration end, Camera arrival, finite completion or scheduled persistent start, plus one two-second breathing allowance; overlapping work is not summed and a persistent Activity never contributes an infinite end. Optional dwell and signal overrides stay available in *Presentation details*.

Camera travel duration is the greater of observer/target displacement divided by a documented preset rate — Cut takes zero time, Slow 4, Auto 7, Fast 13 units per second. Visitor movement runs on deterministic session time that the Scene samples; the editor keeps its own framing animation. Movements are evaluated one at a time: a presentation cue that arrives during travel queues behind it, while explicit navigation interrupts and replaces it at the interpolated current pose. Rejoin and early redirection also start from the actual current pose.

## Visitor agency and interruption

- Next is available whenever a valid destination and its explicit gate permit it. Camera travel, narration, unfinished Activities and the estimate are never implicit gates.
- On departure, not-yet-started work scoped to the visit is disarmed. Already started finite work follows its type default — narration and local highlighting stop, casing motion can finish — and an explicitly persistent Activity continues. A finite completion retains its result until the declared boundary or a newer command.
- **Visitor Stop** cancels only the effect its owner still holds; later Camera changes never undo it.
- The last command to a subject channel wins. Camera changes alone never reissue Activity commands.
- Free exploration releases the Camera and pauses autoplay; guidance resumes from the current pose with autoplay off.

## Reviewer Presenter

The Presenter observes real application state and is dismissible; Back and Skip never author content. It opens with a three-step **quickstart** (create → guide → explore), continues through the richer walkthrough, then offers optional trials: environmental creation, an early checkpoint jump, detour pause, editing scope, a deliberate gate, and capability loss.

## Experimental defaults and findings (4.1)

Two policies are provisional experiments; their characterization tests record 4.1 behaviour but do not settle product semantics.

| Trial | Initial 4.1 behaviour | What to record |
|---|---|---|
| Checkpoint → presentation cursor | Frame the selected View immediately, leave the narration playhead unchanged, and replace any movement that would take the visitor backward before that View while allowing future cues. An unscheduled View frames and waits. | Before an early or out-of-order jump, ask whether the creator/visitor expects narration and the next View to continue, seek or restart; compare with playback, including a repeated appearance. |
| Detour pause | Save the parent visit/position and narration playhead, pause parent narration and automatic viewing, let subject Activities follow their own boundaries, then resume from the current pose without replaying entry behavior. | Ask whether the explanation should pause, continue or restart, then observe the return; note whether captions and ongoing behaviour made the default understandable. |

Automated checks confirm the 4.1 defaults, source isolation, no duplicated entry and visitor freedom to leave. The reviewer expectation record itself must be collected from a manual Presenter pass; a passing prebuilt example is not evidence that authoring from Reset is understandable.

## Checks

```sh
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Domain tests cover identity, structural editing, Next resolution, the Camera adapter, presentation estimates (including the numeric oracle), Auto pacing, interaction, interruption and fixed-step equivalence. Browser checks author through the same controls the Presenter describes, then assert outcomes from read-only snapshots.

## Prototype boundaries

Everything is in memory; refreshing loses it. Narration, captions and piano playback are visible simulations without audio. Geometry, straight-line Camera evaluation and text-derived duration are mocked; provider capabilities and real structural edits are not. Fixed framing is flagged for review after world revisions; this is not comprehensive occlusion validation.

Omitted by design: backend and durable persistence, publishing, collaboration, asset import, production audio, full Camera routes/physics, arbitrary conditions, multiple named Guides, custom Camera rates, smart transcript alignment, a full interruption-policy editor and production accessibility coverage. Basic keyboard operation and readable labels are preserved.
