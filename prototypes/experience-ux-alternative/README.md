# Experience UX — independent alternative ("Conservatory")

**Status:** independent design proposal, 2026-10-13. A coded visual prototype with mock data.
Not an application, not a runtime, not a persisted format, not implementation authority.
It was designed without reading the competing Experience V3 proposal; the product owner
compares the two.

```sh
cd prototypes/experience-ux-alternative
python3 -m http.server 8841
# open http://localhost:8841/
```

No build step. Three.js r170 is vendored in `vendor/`. Fonts load from Google Fonts with system
fallbacks. ES modules need the local server (not `file://`).

## The design in one paragraph

The Stage is the work. Everything else is either **where you are** (a slim outline on the left),
**what you selected** (a Card that appears only when something is selected, docked over the Stage
edge so the Stage never reflows), or **the order of the visit** (the Guide, a dark instrument strip
along the bottom that is *also* the playback timeline). There is one Camera evaluator: guided
playback, Follow, Look through, thumbnails and both visitor modes all ask it for poses. Green is
the frame and the commit; gold is attention — what is selected, the current moment, the visitor’s
eye.

## Try this (about five minutes)

1. **Start fresh.** *Prototype ▾ → Start from an empty experience.* Click the piano on the Stage →
   **Present this**. A Presentation appears with a first View already framed on it.
2. **Add Views.** In 3D, orbit and press **Capture View**; in Plan, press **Place a View**, then press
   where the camera stands and drag toward what it sees.
3. **Load the Salon tour** (*Prototype ▾*). Select **The Pleyel piano** in the outline: its Views,
   Default ◆, and which Stops use it.
4. **Look through** a View, drag to re-aim, **Update View** or **Exit View** (Esc). You return to
   exactly the Plan/3D standpoint you left.
5. **Select Stop 2** in the Guide. Drag its guided Views to reorder; *Include* Pianist’s seat;
   change holds. The Presentation’s Default does not change. Stop 5 visits the same Presentation
   with a different sequence.
6. **Drag Stop tiles** to reorder the Guide (or focus one and press Alt ←/→). Drag a Presentation
   from the outline onto the Guide to insert a Stop.
7. **Click a connector** (`Next · ↗ 8s`) to select the transition. Switch Cut/Travel; click the gold
   path on the Plan to add a point, drag points through doorways. A path through a wall turns red.
8. **Play** in the Guide bar, scrub the rail, turn on **Follow camera**, then turn it off — the Stage
   returns to where you were.
9. **Preview** → *Take the guided tour* (Views advance by themselves; **Next stop** advances the
   tour) or *Explore freely* (every Presentation and View, including ones no Stop uses).
10. *Prototype ▾ → Simulate width → Tablet / Phone* for the narrow compositions (container queries;
    resizing the window works too).

Undo/Redo (Ctrl+Z / Ctrl+Shift+Z) changes the document; **Back** in the Card only changes what you
are looking at. Space plays/pauses. Esc leaves the foremost mode, then clears the selection.

## Package

| File | Contents |
| --- | --- |
| [`design-rationale.md`](./design-rationale.md) | Main UX decisions and the interaction model |
| [`visual-language.md`](./visual-language.md) | Palette roles, type, components, layout behaviour, states |
| [`scope-and-critique.md`](./scope-and-critique.md) | What is demonstrated, what is deferred, where this disagrees with the brief, prototype shortcuts |
| `index.html`, `styles/`, `app/` | The prototype. `app/camera.js` is the single pose evaluator; `app/world.js` the mock museum and seed experience |

Pre-UX3 evidence consulted: the existing application behaviour as described in
[`../spatial-authoring/README.md`](../spatial-authoring/README.md) and the earlier
[Design-QA boards](../integrated-experience-authoring/Design-QAs/README.md).
