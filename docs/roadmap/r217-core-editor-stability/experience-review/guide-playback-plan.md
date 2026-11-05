# Guide pacing, invitations, explore and return: refinement plan (sheet §31)

**Status:** accepted 2026-11-04; implemented in slices 1–7 on `claude/eloquent-goldberg-yrasgu` (owner acceptance of journeys A–H pending). The landed contract is [composition-execution AM-11](../../../reference/composition-execution.md#am-11-guide-pacing-explore-and-return).
**Superseded in part (2026-11-05)** by [fix.md](./fix.md), the owner's second review: the Guide's start Stop, explicit continuations, the Guide Card and the welcome's place are replaced there and in AM-11. This plan is kept as the record of slices 1–7; where it disagrees with fix.md or AM-11, they win.
**Design:** [sheet §31](../../../reference/design-system/experience-interaction-sheet.html#s31), with
interactive journeys A–H, and [sheet §32](../../../reference/design-system/experience-interaction-sheet.html#s32)
for where each setting is edited (open for review).
**Parent:** [fix-plan.md](./fix-plan.md), "Revised model before building Round 4". This plan
replaces per-Stop "until Next" with Guide pacing and retires Gates.

## Locked model (not reopened)

- A Stop is one visit to one Presentation: one entry View, one stay, never a timed sequence of Views.
- A Presentation's Views are ordered and optional, joined by Cut or Travel. They take no Guide time and
  never advance the Guide.
- A Guide is ordered Stops plus the transitions between them. There is no View-level timeline.
- Camera stays the one authority for Views, paths, path time and evaluation.

## What §31 decides

| Topic | Decision |
|---|---|
| Pacing | One Guide field, `pacing: 'automatic' \| 'manual'`. Automatic (the default): each Stop stays for its time, then plays on. Manual: each Stop waits for Next. Transitions play in both. |
| Stay | `staySeconds` is always a finite number, at least 1 s. Manual ignores it and keeps it for switching back. Per-Stop "until Next" goes. |
| Next | Always available. During an arrival Travel it lands now (a Cut to the entry View); at a Stop it moves on; on the last Stop it finishes. In Automatic it also resumes play. |
| Pause | Automatic only. It freezes the Guide clock, mid-Travel included. It becomes run state, so Explore can remember it. |
| Explore | In the bar at every arrived Stop, including one-View Presentations (then it means look around). It freezes the Guide clock and keeps the Stop occurrence. During a Travel it lands first. |
| In Explore | ‹ › play the Presentation's authored steps. Any non-adjacent pick is a Cut, and Experience never searches the Camera graph. Drag to look around; ⟲ cuts back to the last saved View. Places switches Presentations with one resume point. Walking is later. |
| Back to the tour | A Cut to the Stop's current View. It restores the playhead, the play/pause/wait state and the same occurrence. If under 2 s of the stay remained, the playhead steps back to leave 2 s. |
| Invitation | Per Stop: `invitation: { prompt: string \| null } \| null`, off by default. It shows on arrival and leaves with the Stop. Accepting it equals pressing Explore; ✕ hides it for that visit; ignoring it changes nothing. ★ placement: a card beside Explore. |
| Gates | Retired. No editor operation creates one; Manual pacing covers waiting, and visit behaviour belongs to a Stop, not a Presentation. |
| Detours | Unchanged and still unexposed. They are authored branching between Stops, a separate capability from exploring. |
| Glance | Unchanged: dragging during a Stop never pauses the tour, and the next arrival resets it. |

## Contract changes

One bump: Experience format 4 and program v4. Format 3 is strictly refused, and v3 releases are republished.

- **Experience unit**
  - Guide: + `pacing` (required; new Guides are `automatic`).
  - Stop: `entryViewId: string | null` (`null` is the Default); `staySeconds: number`, at least 1 s; + `invitation`. `views` goes.
  - Presentation: `views: [{ viewId, transition? }]`; the first is the Default.
  - Experience: `gates` removed; `detours` kept.
  - Remove `ExperienceGate`, `ExperienceGuidedView` and `EXPERIENCE_STEP_DEFAULT_HOLD_SECONDS`.
- **Program v4**
  - + `pacing`.
  - `ProgramStop`: `entryViewId`, `staySeconds: number | null` (`null` exactly when Manual), `invitation`.
  - `ProgramPresentation.steps` (resolved Cut or Travel between neighbours).
  - `localTime` holds one entry per timed Stop and is empty for Manual. It keeps today's validator cross-check against the Stops.
  - Runtime policy carries detours only.
- **Interpreter**
  - Remove `gated`, the `blocked` phase and the `gates` option.
  - `continue` during a stay ends it (Next).
  - + `pause` / `play` events and a `paused` field. Ticks are ignored while paused or exploring.
  - `enter-presentation` takes an optional start View. Entered from a Stop, it keeps that occurrence suspended (`stopId`, `occurrenceId`, `holdRemainingMs`, play state) instead of clearing it.
  - + `explore-view`: the authored step when adjacent, else a Cut.
  - `resume` restores the suspended occurrence with the 2 s lead-in. It is no longer a fresh arrival, so arrival lifecycle actions do not re-run.
- **Guide time map** (`packages/camera-core/src/guide-time-map.ts`): **no change.** The adapter passes one View per Stop: `holdSeconds = staySeconds` in Automatic and `null` (a wait) in Manual. The wait cap, the `+ N waits` total and stop-at-wait playback already exist.
- **Camera, Layout, Scene, resources:** no change.

## Slices

| # | Slice | Main files | Tests (by family) | Needs |
|---|---|---|---|---|
| 1 | Experience format 4 | `packages/project-model/src/units/{types,validate,canonical,planning,experience-structure}.ts`; removal consequences (`gate-removed` goes; a removed entry View uses the existing `stop-entry-fallback`) | `apps/editor/tests/lib/project-model/units-conformance`, `units-canonical-form`; `experience/experience-structure*`; fixtures that carry `gates:` | — |
| 2 | Program v4 and lowering | `packages/project-model/src/program/{types,validate}.ts`; `units/experience/{lowering,policy}.ts`. Manual lowers to `null` stays. A Travel gap on an explore step is a typed refusal, never a silent Cut. | `project-model/program-conformance`, `program-entry-closure`; lowering cases in `experience/experience-runtime` | 1 |
| 3 | Interpreter | `units/experience/{interpreter,companion}.ts` | `experience/experience-runtime`: Next ends a stay; Manual waits; pause/explore freeze ticks; resume keeps the occurrence, remaining stay and play state; lead-in; Places keeps one resume point; no Gates | 2 |
| 4 | One Guide clock | Move the pure `playback-map.ts` adapter to a visitor-safe module (for example `apps/editor/src/lib/visitor/guide-run-map.ts`) that the editor imports. Make `VisitorCameraDirector.svelte` time-aligned everywhere (retire the public overtake, where holds count during Travel). | `experience/guide-time-map`, `playback`; `visitor/visitor-camera-director`; a new parity test: a replayed run's arrival times equal the map's Stop entries; visitor boundary tests | 2, 3 |
| 5 | Visitor Preview | `visitor/{VisitorPreviewSurface.svelte,visitor-runtime-state.svelte.ts,VisitorCameraDirector.svelte}`: a bar per pacing, Explore always (settle when travelling), the invitation (`role=status`, polite, never takes focus), the explore strip, Places, Back, welcome copy | `visitor/visitor-runtime-state`, `visitor-camera-director`, `preview-surface-closure` | 3, 4 |
| 6 | Editor Cards | `authoring/experience/`, one Card field per setting (sheet §32): `ExperienceGuideWriter` (Pacing), `ExperienceStopWriter` (Enter at, Stay or *Until Next* linking to the Guide Card, Invite, *Connections* links), `ExperiencePresentationWriter` (the View rail: order and Default, Cut/Travel and time on the spine, range set, reorder, folding past 10 Views; Listed in Places; Used by), `ExperienceGuide` (✦ and +N badges, Manual caps, a pacing label that opens the Guide Card), `ExperienceTransitionWriter` (Guide connections only, path uses), `commands.ts`, `experience-controller.svelte.ts`, `experience-card-model.ts`, `experience-removal.ts`. New intents: `setGuidePacing`, `setStopInvitation`, `setStopEntry`, `setStopStay`, `setPresentationStep`, `movePresentationView`. Retire `setViewHold`, `setStopViews` and the Guided views list. | `experience/experience-controller`, `experience-card-model`, `experience-authoring`, `first-guide`, `timeline-scrub`; `authoring/spatial-route-experience-homes` | 1, 4 |
| 7 | Acceptance | Journeys A–H below, in the browser; lanes per [`apps/editor/tests/README.md`](../../../../apps/editor/tests/README.md) for the touched families | — | all |

Slices 5 and 6 can run in parallel once 4 lands; 6 can start its Card work after 1.

**Visitor keys (proposed):** → or Enter is Next (as today), ← is Previous, Space is Pause
(Automatic), E is Explore. In Explore, ← → step Views and B goes back to the tour. Esc stays
*Exit preview* in the editor.

## Acceptance journeys

Each is runnable in sheet §31 and is the owner's check in the product.

- **A · Follow along (Automatic).** The invitation shows at Stop 2. Ignored, the tour moves on when the
  stay ends and the invitation leaves with the Stop. Next during the Travel to Stop 4 arrives at once.
- **B · Step aside and rejoin.** At Stop 2, 4 s in: accept, › Keyboard (Travel along its path), pick
  Strings (Cut), look around. Back: a Cut to Front, the same playhead, playing.
- **C · Manual.** Stop 1 waits. Next: the Travel plays, then Stop 2 waits. Explore, pick a
  non-adjacent View (Cut), Back: still waiting. Next continues.
- **D · Second visit.** Stop 4 revisits the piano, enters at Keyboard and has no invitation. Explore
  starts at Keyboard with no jump; ‹ plays the same step backwards; Back cuts to Keyboard.
- **E · One View.** Stop 5 invites with its own prompt. Explore means looking around; ⟲ returns to the
  saved View; Back.
- **F · Another place.** Explore → Places → North window → Garden. Back returns to Stop 2 at the same
  playhead.
- **G · Paused first.** Pause at Stop 3, Explore, Back: still paused. Play continues.
- **H · Little time left.** Explore with 0.8 s left. Back steps the playhead back to leave 2 s.

## Unchanged

Camera (unit, authority, paths, guards, evaluation, reduced-motion settling), Layout, Scene and
resources. Detours and continuations. The Experience list and welcome text. Presentation text and
subject, including §27's name following. The Guide time map module and §28's wait cap and scrub.
The §25 compact Guide, §19 path editing, §23 Plan camera and §24 Advanced camera. The look-around
glance. Places and Guide-free Presentations. The end screen, visitor isolation, and one interpreter
for Preview and release.

## Risks

1. **Timing parity.** The interpreter counts stays and the time map derives them. Both read
   `staySeconds`, and Travel time comes from Camera in both. Retiring the overtake path and adding the
   parity test keep them equal; the welcome's "about m:ss" comes from the map.
2. **Optional content can block Preview.** An explore step bound to a missing path refuses lowering,
   like a Guide edge. The editor shows ⚠ on that connection with a fix (decided: refuse Preview with a fix).
3. **Strict refusal of format 3** stops the owner's test projects that have multi-View Stops from
   opening (accepted: no converter).
4. **Resume is no longer an arrival.** Arrival lifecycle actions don't re-run on return. Tests that
   assumed a fresh arrival change with slice 3.
5. **One pause flag.** Pause moves from the surface into run state. The director and the surface must
   read it there, never keep their own.
6. **Expectation of walking.** v1 Explore is saved Views and looking around. The Preview shows Walk as
   later, because camera-core has no free-move controller or collision limits.

## Owner decisions (2026-11-04)

- **Q1–Q9:** as recommended. No mixed pacing. Coming back is a Cut, with the 2 s lead-in. The
  invitation shows on arrival and is off by default. v1 Explore has no walking. An explore-step gap
  refuses Preview with a fix. Previous goes to the previous Stop. There is no glance-triggered hint.
- **Q10:** no old-version support. Format 3 is strictly refused, with no converter (risk 3 is accepted).
- **Q11:** leave room for narration only. Nothing in this plan builds audio. Data and clock shapes must
  not block a per-Stop clip on the Guide clock.
- **Control placement:** [sheet §32](../../../reference/design-system/experience-interaction-sheet.html#s32)
  gives every setting one owner and one Card field; other surfaces show the value and link to it.
  Accepted with every recommendation; slice 6 follows it.

## Control placement (sheet §32, accepted 2026-11-04)

- **A Guide connection** opens its Transition Card, the one place its Cut/Travel and time are edited.
  The Stop Card shows *Connections* links; the strip header shows the pacing and links to the Guide Card.
- **The Presentation View list** is the rail: one row per View, the connection on the spine with its
  time, range set, reorder. Past 10 Views it folds to the first 8 with *Show all N Views*, which names
  what's hidden (count, Cut/Travel, ⚠, Stops entering there); opened, it scrolls in its own box of about
  12 rows. Selecting, editing or moving a View past row 8 opens it. The fold state is session state.
- **Shared path time** is edited at the connection you're on, showing ×N and the uses.
## Out of scope

Narration audio, walking, per-visit Travel time mapping, mixed pacing, a Choices/Detour UI, and
activating the public route (T4).
