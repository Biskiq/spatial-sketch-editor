# Biskiq

**Draw a place. Arrange it. Tell it to someone.**

Biskiq is a browser-native studio for making spatial experiences. You sketch a
building by hand, arrange what goes in it, and direct how a visitor moves through
it — as one continuing project, with every change open to revision.

![Four Biskiq studies: Vellum, Smart Wall, Conservatory and the unified production shell](docs/assets/readme/cover.jpg)

> **Where this stands.** The production editor is being rebuilt in stages. The
> studies below are working prototypes and accepted design evidence — not the
> shipped editor. The last one is the owner-ratified destination interface; the
> production integration it describes is still ahead. See the
> [release list](docs/roadmap/now.md).

## The idea

Most spatial tools ask you to think like the software: choose an object type,
enter its parameters, pick a modifier. Biskiq starts from how people describe a
place — a stroke for a wall, a loop for a room, a patch of shade for a canopy — and
reads the drawing back in words, so the intent can be corrected instead of redrawn.

Three commitments run through every study.

**Intent, not parameters.** Draw a closed stroke and the table answers *Room*,
*Raised platform*, *Sunken court* or *Canopy*; press Tab to choose another
reading. The stroke, the reading and the correction are one undo step.

**Relationships, not coordinates.** A roof rests on a wall and follows it. A
painting keeps its 0.50 m gap when the wall bends. A removed divider makes the
room whole again. When a change has consequences, the tool names them instead of
inventing a replacement.

**Telling is part of making.** The same model becomes a visitor's walk — views,
holds, reveals, a route — and the visitor sees none of the authoring machinery.

Biskiq is not a general 3D modeller. It is for spaces you will keep changing:
rooms, levels, openings, light, and how someone moves through them. Ornament,
detailed façades, freeform surfaces, terrain and construction documents belong to
other tools, and the studies say so in the app.

## One system, studied in parts

The studies were made at different times, for different questions, so their
surfaces differ — Vellum's warm drafting table, Smart Wall's dark gallery, the
shell's forest-and-ivory instrument. Underneath, they exercise one grammar:
**draw, hold, revise, tell**. Each study takes one part of it further than the
others.

| | Vellum | Smart Wall | Conservatory | Round-2 shell |
| --- | --- | --- | --- | --- |
| **Draw** | One pen reads walls, rooms, roofs, stairs | — | — | Ink readings, including Shape |
| **Hold** | Blue handles; the sheet; roof zone drags | Brass floor handles; 3D works and lights | Views, Stops, paths | Rays and points for every transform |
| **Revise** | Ripples, loose ends, set-aside tray | Conflicts, comparison, selective restore | Cut/Travel, Stop order, holds | Cross-domain erase review |
| **Tell** | Make · Tell · Visit | — | Presentations, Guides, Preview | World \| Experience, one Camera |

The destination is one workspace, not four. The production shell study — the
last chapter — is where the World and Experience halves are brought into one
Head, Index, Stage, Card and dock. The studies are not wired together: what they
share is the model of creation, and the proof that each part can work.

## Study 01 · Vellum: draw the building

[Vellum](prototypes/p3-vellum/README.md) treats architecture as drawing rather
than modelling. There are two tools: **Select** picks, shapes and moves and never
draws; **Draw** only draws and never inspects. A stroke is read against what it
touches — the table, a wall face, another floor, the raised sheet — and the reading
is spoken aloud before it becomes ink.

![A roof selected on the Old hall in Vellum, with its card, section and remembered relationships](docs/assets/readme/vellum-roof.jpg)

<sub>A selected roof reports what it covers, its section, and what it remembers: it rests on Old hall, fits its walls, and keeps sharp creases sharp.</sub>

The depth is in how revision behaves. Every edit is one transaction that reports
what moved with it; choices and repairs amend the same undo step. Unrepaired
consequences become **loose ends**, never blockers. Anything displaced — an opening
that loses its wall, a merged room's settings — waits in the **set-aside tray**
rather than disappearing.

<p>
<img src="docs/assets/readme/vellum-draw.jpg" width="48.5%" alt="Drawing a room in Vellum: the reading chip, the wall card, and the consequence card">
<img src="docs/assets/readme/vellum-walk.jpg" width="48.5%" alt="Vellum's Tell mode: the visitor's walk with moments, views and reveals">
</p>

<sub>Left: one closed stroke became Room 1, divided the gallery, borrowed a height and brought the roof with it — one undo step, described in words. Right: Tell locks the building, turns the pen into the visitor's walk, and makes each bead a moment.</sub>

What you can try:

- Draw walls, arcs, round rooms, doors and arches; snap to faces, angles and
  corners, and decide explicitly whether a wall *touches* or *joins* another.
- Raise the sheet to draw in the air: roofs, canopies, decks, bridges, lightwells.
- Hold a roof's ridge, slope, end or eave; edit its section in context, against
  the floors, headroom and neighbours behind it.
- Add a storey; or let Vellum offer a mezzanine or a stair, having checked the
  headroom, the landing and the posts.
- Walk the result: **Make → Tell → Visit**, with no creator tools in the visit.

**Status** — executable prototype; accepted expressive architectural sketching
and revision evidence. Read [DESIGN.md](prototypes/p3-vellum/DESIGN.md) for the
argument, and *What's real?* in the app for the honest capability list.

```sh
cd prototypes/p3-vellum && npm install && npm run dev   # localhost:5191
```

## Study 02 · Smart Wall: arrangement that keeps its promises

[Smart Wall](prototypes/p2-smart-wall/README.md) takes the hardest ordinary act in
a gallery — *change the wall after the show is hung* — and makes it a relationship
problem rather than a redraw. Four works sit on a curved wall, each with a locked
gap, a proportional position along the arc, and a bound spotlight.

![The gallery wall bent into a serpentine, with four artworks and their spotlights following](docs/assets/readme/smart-wall-bend.jpg)

<sub>Bending the wall into a serpentine: the works keep their 0.50 m rhythm and their lighting, and the unfolded ribbon below reads the same surface flat.</sub>

The wall, the works, the spacing tokens and the lights share one model. Drag a
floor handle and the works flow along the new curve; drag a painting across
another and the arrangement swaps magnetically. Below the stage, the **unfolded
ribbon** shows the wall's true arc length, so a curved hang can be read and edited
like a straight one.

<p>
<img src="docs/assets/readme/smart-wall-compare.jpg" width="48.5%" alt="Holding Space shows a ghost of the previous arrangement with per-work restore controls">
<img src="docs/assets/readme/smart-wall-revision.jpg" width="48.5%" alt="A squeeze conflict explained in two consequence cards, with repairs offered">
</p>

<sub>Left: hold Space to compare with the previous arrangement; every work can be restored on its own. Right: a squeeze conflict says what broke, offers the equal-rhythm repair, and explains the concave bend behind a wide frame.</sub>

What you can try:

- Reshape the wall from brass floor handles, or run the revision scenarios.
- Cycle each gap through *locked*, *equal rhythm* and *free*; drag the number to
  scrub the spacing.
- Move a work and watch its light follow; add a fifth from the staging rack.
- Compare against the previous arrangement and recover individual works without
  undoing the whole edit.

**Status** — executable prototype; accepted relationship-aware spatial
manipulation evidence.

```sh
cd prototypes/p2-smart-wall && npm install && npm run dev   # localhost:5175
```

## Study 03 · Conservatory: author the visit

[Conservatory](prototypes/experience-ux-alternative/README.md) is the accepted
Experience design: how a creator composes what a visitor will see. A
**Presentation** is a subject with its **Views**. A **Guide** is an ordered
sequence of **Stops**, each with transitions, holds and the Views it visits. One Camera
evaluator answers every request for a pose — guided playback, thumbnails, Look
through, and both visitor modes.

![Conservatory in the Experience lens: the plan with a five-stop route, View thumbnails, a Presentation card and the Guide instrument](docs/assets/readme/conservatory-guide.jpg)

<sub>Experience authoring: Views placed in plan, a five-Stop Guide with Cut and Travel transitions, and the Pleyel piano's Presentation card. The Stage is the work; the Index says where you are, the Card what you selected, the Guide what you invoked.</sub>

The interactions are the design. Reorder Stops by dragging a card — or drag it
onto the overview bar to move it far. Click a transition to switch Cut/Travel;
click the gold path to add a point and drag it through a doorway. Select a Stop
and rearrange its Views without changing the Presentation's default. Then
**Preview** the result exactly as a visitor meets it.

![The visitor preview: a Salon Chopin welcome card offering a guided tour or free exploration](docs/assets/readme/conservatory-visit.jpg)

<sub>Preview — what a visitor sees: take the guided tour, or explore the five views freely. No editor chrome is present in either mode.</sub>

**Status** — executable design prototype with mock data; owner-accepted Experience
semantics (2026-10-13). Its shell chrome and visual treatment are superseded by
Production shell Round 2, below; the Experience interactions remain the accepted
design. See the [design rationale](prototypes/experience-ux-alternative/design-rationale.md).

```sh
cd prototypes/experience-ux-alternative && python3 -m http.server 8841   # localhost:8841
```

## Study 04 · The destination: one workspace

The [Production shell, Round 2](prototypes/production-shell-wireframe/README.md)
is the owner-ratified destination interface (2026-10-23). It is the first complete
picture of the integrated product: World and Experience are two lenses over one
project, sharing a single **Head, Index, Stage, Card** and lower working edge.

![The unified shell in the Experience lens with a Guide open: stop cards, a route on the Stage, and the shared dock](docs/assets/readme/shell-guide.jpg)

<sub>The shared shell in the Experience lens. The same Head, Index, Stage, Card and dock carry World authoring; Preview is isolated from every editor mechanism.</sub>

Its contribution is a visual and behavioural language that holds across domains.
Selection is gold. A transformation is a thin white dashed ray with an open
arrowhead — on an object, a wall, an opening, a platform, a roof, even the Slice.
Anchors are small white points that turn gold while held. Values appear in a dark
mono tag only on hover or drag. Ten guided tours walk the shell's own scenarios;
the [atlas](prototypes/production-shell-wireframe/atlas.html) opens 28 scripted
states as live, linked frames.

<p>
<img src="docs/assets/readme/shell-objects.jpg" width="48.5%" alt="An oak bench selected, with axis rays, a rotation ring and a live dimension tag">
<img src="docs/assets/readme/shell-roof.jpg" width="48.5%" alt="A roof edited in place, with Section 2D one segment away">
</p>

<sub>Left: one manipulation vocabulary for every subject — rays, a rotation ring, a scale point, and the value only while you drag. Right: a roof edited directly in 3D, with its section one segment away and the same Camera behind both.</sub>

**Status** — interactive wireframe with mock data; owner-ratified as the
destination shell, and accepted visual and behavioural evidence. It is not
production, not a contract, and not an integration of the other studies. The
dispositions and the ratified design are in the
[ratification record](docs/reference/decisions/production-shell-round-2-ratification-2026-10-23.md)
and [DESIGN-NOTE](prototypes/production-shell-wireframe/DESIGN-NOTE.md).

```sh
cd prototypes/production-shell-wireframe && python3 serve.py 8850   # localhost:8850
```

## Also in the collection

Other studies ask narrower, older or more speculative questions. They are kept
because they answer something the main four do not.

| Study | What it explores | Status |
| --- | --- | --- |
| [World Spatial Interaction Reference (V2)](prototypes/spatial-authoring/README.md) | Plan ↔ 3D continuity, curved-wall Unroll, finite Section/Cut, Ceiling Lift, nested Look and exact return | Executable advanced-interaction and behavioural QA reference |
| [P3 Architectural Depth](prototypes/p3-depth/README.md) | How far a field over a plan, a walk between levels and a band along a walk can carry compound roofs, dormers, spiral stairs and railings | Executable design study, 30-fixture corpus |
| [Living Drawings](prototypes/living-drawing/README.md) | Drawing original 3D forms in an existing room: fit, pull, draw over, carve, repeat and keep exceptions | Proposal with an interactive studio |
| [Native Form Lab](prototypes/native-form-lab/README.md) | Editable extrude, revolve and sweep profiles with host-local drawing and identity through revision | Exploratory prototype |
| [Object Composition](prototypes/object-composition-prototype/README.md) | Assembly, provenance, reach, stale revisions and repair for composed objects | Unratified research prototype |

## How much is demonstrated

Four layers of claim sit behind this README, and they are not interchangeable.

| Layer | Where you can see it | What it means |
| --- | --- | --- |
| **Executable** | Vellum, Smart Wall, Conservatory, V2 reference, P3 Depth | Runs in a browser today; you can try the behaviour |
| **Accepted design** | Conservatory's Experience semantics; Production shell Round 2 | Owner-accepted as the direction; not yet built into production |
| **Research** | Living Drawings, Object Composition, Native Form Lab | Runnable studies that probe a question; no product or format authority |
| **Destination** | [North star](docs/reference/north-star.md), [release list](docs/roadmap/now.md) | The system being built, slice by slice |

No executable study here is the production editor. None of the accepted designs
is shipped. The destination shell is a design for the integration, not a
record of it having happened. Where a study and a ratified contract disagree, the
contract governs; the study is retained as evidence, not authority.

## Run the studies

Each prototype is self-contained and outside the npm workspace. Serve each on its
own port; they can run at the same time.

| Study | Command | Port |
| --- | --- | --- |
| Production shell Round 2 | `cd prototypes/production-shell-wireframe && python3 serve.py 8850` | 8850 |
| Conservatory | `cd prototypes/experience-ux-alternative && python3 -m http.server 8841` | 8841 |
| Vellum | `cd prototypes/p3-vellum && npm install && npm run dev` | 5191 |
| Smart Wall | `cd prototypes/p2-smart-wall && npm install && npm run dev` | 5175 |
| World reference (V2) | `cd prototypes/spatial-authoring && python3 -m http.server 8826` | 8826 |
| P3 Architectural Depth | `cd prototypes/p3-depth && npm run dev` | 5194 |

The [prototype index](prototypes/README.md) records each study's role, acceptance
boundary and shortcuts.

## Development

- [Run locally](docs/local-development.md) — editor, API and database setup.
- [Documentation](docs/orientation.md) — what this project is, then the contracts.
- [Verification](apps/editor/tests/README.md) — test commands and requirements.
- [Release list](docs/roadmap/now.md) — the next engineering batch.
- [Contributing](CONTRIBUTING.MD) — branch, verification and review expectations.

`apps/` holds the production editor and API; `packages/` the shared layout,
project-model and camera cores; `prototypes/` the studies above. The prototypes
are deliberately not npm workspaces, so the production install, build and test
lanes never reach into them.
