# Museum Editor — "Conservatory" (World + Experience)

**Status:** design refinement, 2026-10-13 — round 2 of the Conservatory proposal, now the
candidate unified Museum Editor design. A coded visual prototype with mock data.
Not an application, not a runtime, not a persisted format, not implementation authority.
Round 1 was designed without reading Experience UX3; round 2 studied UX3 and adopted parts of
it selectively (see [design rationale §0](./design-rationale.md#0-round-2-what-changed)).

```sh
cd prototypes/experience-ux-alternative
python3 -m http.server 8841
# open http://localhost:8841/
```

No build step. Three.js r170 is vendored in `vendor/`. Fonts load from Google Fonts with system
fallbacks. ES modules need the local server (not `file://`).

## The design in one paragraph

The Stage is the work. Everything else is **where you are** (the Index on the left),
**what you selected** (a Card that appears only with a selection, docked over the Stage edge so
the Stage never reflows), or **the task you invoked** (an instrument inset at the bottom of the
Stage). In Experience the instrument is the **Guide**: you open it from the Index, it holds the
Stop sequence *and* playback, and closing it leaves the Stage quiet. In World the same
instrument slot holds World tasks (here: Measure). There is one Camera evaluator: guided
playback, Follow, Look through, thumbnails and both visitor modes all ask it for poses. Green is
the frame and the commit; gold is attention — what is selected, the current moment, the
visitor’s eye.

## Try this (about five minutes)

1. **Quiet start.** The Salon tour loads with nothing selected: no Card, no Guide, no paths —
   just View markers. Select **The Pleyel piano** in the Index: its Views, Default ◆ and the
   Stops that use it.
2. **Add Views.** In Plan, **Place a View** (press where the camera stands, drag toward what it
   sees). In 3D, orbit and **Capture View**.
3. **Look through** a View, drag to re-aim, **Update View** or **Exit View** (Esc). You return to
   exactly the Plan/3D standpoint you left.
4. **Open the Guide** — *Salon tour* in the Index. The Guide instrument appears with light Stop
   cards, transitions and the overview bar. Selecting Stops, transitions or their Views keeps it
   open; **×** (or Esc after clearing the selection) closes it fully.
5. **Select Stop 2.** Reorder its guided Views, *Include* Pianist’s seat, change holds. The
   Presentation’s Default does not change. ‹ › in the Card walk Stop to Stop.
6. **Reorder Stops**: drag a card; or drag it onto the overview bar to move it far; or Alt ←/→.
   ←/→ alone walks the selection. Drag a Presentation from the Index onto the Guide to insert.
7. **Click a transition** (`↗ 8s`). Switch Cut/Travel; click the gold path on the Plan to add a
   point, drag points through doorways. A path through a wall turns red.
8. **Show ▾** on the Stage: *Whole Guide* vs *Selection only*, and markers, frustums, paths,
   labels. Editor visibility only.
9. **Play**, scrub the overview bar, **Follow camera**, then turn it off — the Stage returns to
   where you were. ⌄ compacts the Guide to its overview.
10. **World** (Head). Same Head, Index, Card and Stage grammar: Context Index (place, bounds,
    openings, located here, Search), object/room/wall Cards with *Details*, and **Measure** as a
    World instrument. A selected object stays selected across the switch.
11. **Preview** → guided tour or free exploration.
12. *Prototype ▾* — stress content (15 / 30 Stops, 20 / 50 Views, 40 Presentations) and
    *Simulate width → Tablet / Phone*.

Undo/Redo (Ctrl+Z / Ctrl+Shift+Z) changes the document; **Back** in the Card only changes what
you are looking at. Space plays/pauses while the Guide is open. Esc leaves the foremost mode,
then clears the selection, then closes the Guide.

## Package

| File | Contents |
| --- | --- |
| [`design-rationale.md`](./design-rationale.md) | Main UX decisions and the interaction model |
| [`visual-language.md`](./visual-language.md) | Palette roles, type, components, layout behaviour, states |
| [`scope-and-critique.md`](./scope-and-critique.md) | What is demonstrated, what is deferred, where this disagrees with the brief, prototype shortcuts |
| `index.html`, `styles/`, `app/` | The prototype. `app/camera.js` is the single pose evaluator; `app/world.js` the mock museum, seed experience and stress generators |

Evidence consulted: round 1 — the existing application behaviour as described in
[`../spatial-authoring/README.md`](../spatial-authoring/README.md) and the earlier
[Design-QA boards](../integrated-experience-authoring/Design-QAs/README.md). Round 2 — the
[UX3 boards](../experience-ux-v3/README.md) and its shell/visual specification, and the accepted
[World shell synthesis](../world-experience-shell-round/design/design-synthesis.md).
