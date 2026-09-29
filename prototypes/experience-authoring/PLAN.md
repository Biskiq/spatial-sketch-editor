# Biskiq spatial Experience prototype

EVIDENCE-PATHS: start — the paths below quote the authoring session's external checkout (`/Users/tony/Documents/Prototype-4`); they are kept as written and are not routes in this repository.

## Summary and delivery

Build a standalone local application in `/Users/tony/Documents/Prototype-4`. The workspace is empty; no existing application or repository constrains the implementation.

Use React 19.3, TypeScript 7, [Vite 8](https://vite.dev/guide/), and [Three.js 0.186](https://threejs.org/docs/) with OrbitControls. Use plain CSS, native form controls, and React reducers. Lock dependencies with npm. Deliver `dev`, `build`, `typecheck`, `test`, and `test:e2e` scripts plus brief running instructions.

The prototype must support genuine authoring from an empty Experience. Geometry, animation, narration, and playback may be simple simulations. The identities, editing consequences, navigation, and lifecycle relationships must work.

## Authoring model and editor

**Keep the model in plain TypeScript, independent of rendering.**

| Entity | Responsibility |
|---|---|
| World document | Subjects with stable IDs, transforms, source properties, and capability profiles |
| Encounter | Audience intention and organizational references to contributions |
| Definition | Reusable view framing or subject presentation/behavior parameters |
| Contribution use | A particular use of a definition, with its own subject binding and start/end relationships |
| Guide position | A particular navigation appearance referencing an Encounter and an optional view use |
| Guide connection | Next, labelled choice, or detour targeting a Guide position |
| Visitor session | Current position, navigation history, activity instances, overrides, and detour bookmark |

A view shown in the Encounter editor and its Guide position refer to the same view use. Adding another appearance creates another use. Linked reuse shares its definition; independent duplication copies it. “Edit this use” detaches on the first change. Shared editing displays the affected-use count. Connections and lifetimes are never shared implicitly.

**Use one spatial workspace.**

- Header: World/Experience mode, Preview, Undo/Redo, Reset, Load example, and Reviewer Presenter.
- Center: primitive 3D room with selection, framing, spatial markers, and camera navigation.
- Side panel: Encounter outline and contextual inspector.
- Optional Guide strip: positions, Next targets, choices, pacing, and gates. Show deeper controls only when requested.

Encounter creation accepts a subject, multiselection, a region defined by two floor points, the current viewpoint, or the room environment. A view is optional. Exploratory Encounters remain accessible through spatial markers without a Guide.

**Make capabilities generic.**

A capability description supplies a stable ID, label, control type, parameters, supported signals, and controlled property/channel. Reusable buttons, toggles, and sliders render these descriptions. Adapters supply simulated effects.

In Experience mode, manipulating an unused control auditions an override; **Use in Experience** captures it, and **Let visitors activate this** creates a binding. Existing contributions edit directly. The subject-local interface must contain no machine-, piano-, or Wall-specific authoring branches.

In World mode, supported source properties and transforms edit the world. Switching there first clears presentation previews. Both the persistent mode label and the selected control identify the editing scope.

**Implement structural editing and repair.**

- Add, rename, remove, duplicate, replace, and reorganize authored elements.
- Reordering the Guide rebuilds its default Next chain; labelled choices retain their target IDs.
- Removing a Guide position reconnects its default predecessor and successor. Other references become repair notices.
- Removing a view from a position leaves a valid “Keep current viewpoint” position.
- Removing an Encounter preserves its contributions as ungrouped items and exposes affected navigation and lifecycle references for repair.
- Regrouping contributions never changes their start/end relationships.
- Undo/redo covers authored edits, with a continuous drag treated as one edit.

## Preview execution and revision behavior

Implement a small deterministic runtime accepting elapsed time and visitor events. Maintain activity-specific playheads and statuses; do not create a global authoring timeline. Render the shared world plus temporary overrides. Preview must never write into authored documents.

**Supported coordination:**

- Start on Encounter entry, visitor activation, or another contribution’s completion/marker.
- End on completion, departure from the Encounter, explicit stop, or Experience end.
- Narration has editable text, duration, and labelled local markers.
- Autoplay pacing supports dwell, narration marker, or completion signal.
- A separate gate can require one supported state/completion condition before following a connection.
- Subject interactions remain available without any active Encounter or Guide.

**Lock these execution defaults:**

- Moving between positions in the same Encounter changes direction without restarting its contributions.
- Entering a different Encounter starts a new visit. Previous follows actual navigation history; crossing back starts a new scoped explanation, without duplicating carried activities.
- A detour preserves the parent visit, pauses its narration, and lets subject activities follow their declared boundaries. Return resumes that visit without firing entry behavior again.
- Free exploration releases the camera and pauses automatic navigation. Activities continue according to their boundaries. Return restores the saved position; autoplay resumes only when requested.
- Already passed navigation cues cannot move the visitor backward. Resuming autoplay after its cue has passed uses the default four-second dwell.
- The latest command to a subject control replaces its earlier command. Camera changes do not reissue commands or undo visitor choices.
- The final Guide position remains available for exploration. Exiting Preview ends the Experience session and clears all overrides.
- Ordinary editing occurs outside Preview; restarting Preview creates a fresh session.

Use bounding-box framing and direct camera interpolation. Support current-view capture, subject-relative versus fixed anchoring, distance adjustment, and reset to automatic. Narration and piano playback can use visible progress indicators without sound.

World editing supports moving subjects, changing source properties, and replacing their capability profiles. Subject-relative views follow their targets; fixed views remain fixed and receive review notices after relevant source changes.

Validate missing references, removed capabilities, unsupported signals, and dependency cycles. Preserve invalid authored instructions for repair. Preview unaffected content, disable unavailable invocations and invalid transitions, and retain Back, exploration, and exit. Do not claim comprehensive framing or occlusion validation.

## Fixture and reviewer Presenter

Use one room containing:

- **Machine:** casing opening with a completion signal; independently running rotor.
- **Piano:** simulated Play/Stop.
- **Wall:** one unfold control usable as a source property or Experience presentation.
- **Light:** intensity control.
- **Imported mesh:** generic visibility and emphasis.

Provide a replacement machine profile lacking rotor support.

**Reset** restores the baseline room, empties the Experience, and clears history and execution. **Load example** restores that room with three authored Encounters: a three-view machine explanation, a comparison reusing its overview, and a Wall detour. Include the independent piano interaction. Neither control starts playback automatically.

The reviewer-only Presenter is a small dismissible panel with one instruction, its purpose, progress, and Back/Next/Skip. It observes real application state; it does not author the work for the reviewer. Back changes instructions without undoing work. Closing or reopening preserves work.

Its main walkthrough starts from Reset:

1. Select the machine, create an Encounter, and add narration.
2. Capture three views and refine one.
3. Capture casing opening; start the rotor after completion and extend its lifetime.
4. Create a comparison from two subjects and add Guide positions.
5. Link the overview into the comparison.
6. Bind piano activation to Play independently.
7. Create the Wall detour and return connection.
8. Preview: advance early, explore, operate the piano, and rejoin.
9. Edit one reused view independently and verify the other appearance.

Completion checks inspect authored relationships and resulting runtime state, not exact names or elapsed reading time. An incomplete or skipped step never silently creates missing content.

Offer compact optional trials for environmental creation, World/Experience editing scope, a deliberate gate, and missing-capability repair. Edge-state shortcuts use the same document commands as the application and remain explicitly reviewer-only.

## Implementation sequence and verification

1. **Foundation:** scaffold the application, domain types, reducers, undo, and fixture. Add Reset/Load example and one complete create → edit → preview flow.
2. **Spatial authoring:** selection, focus creation, contextual capability controls, audition/capture, and unmistakable World/Experience switching. Add the first Presenter steps.
3. **Coordination:** multiple views, reusable definitions, independent activities, Guide connections, pacing, gates, exploration, and detour return.
4. **Revision:** source changes, replacement profiles, structural removal, validation, and local repair. Complete the example and Presenter.
5. **Verification:** finish meaningful automated checks and run the entire authoring walkthrough manually through the visible UI.

Use Vitest for reducer/runtime tests and Playwright for Chromium interaction tests.

Required checks:

- Runtime activity leaves authored world and Experience documents unchanged.
- Three views share one continuing narration; early Next remains available.
- Opening completion starts the rotor; departure does not stop an explicitly carried rotor.
- Visitor Stop survives subsequent camera changes.
- Detour rejoin preserves narration position and does not duplicate activity.
- Linked edits affect all linked definitions; local edits affect only the selected use and preserve connections.
- Piano activation works with no Guide or Encounter.
- Non-object-centered creation works without inventing a focal object.
- Source editing and presentation editing change the intended state.
- Missing capabilities and deleted targets preserve repairable instructions.
- A new capability description renders through the existing UI without fixture-specific changes.
- Presenter steps use real authoring controls; dismissing it preserves free exploration.
- Reset and Load example reliably restore their documented states.

Completion requires passing typecheck, production build, domain tests, and browser checks, plus a manual pass over spatial manipulation and editing-scope clarity. Visual polish is not an acceptance criterion.

Assume desktop use and one in-memory Experience per session. Intentionally omit durable storage, backend APIs, collaboration, publishing, real asset import, realistic simulation/audio, advanced Camera paths, arbitrary condition scripting, and production accessibility or device-coverage work. Preserve basic keyboard-operable controls and readable labels.
