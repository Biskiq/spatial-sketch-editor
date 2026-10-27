# Biskiq

**Draw a place. Arrange it. Tell it to someone.**

Biskiq is a browser-based studio for making spatial experiences. You sketch a
building by hand, arrange what goes in it, and direct how a visitor moves through
it.

It is being built as one tool, and four prototype studies explore the parts. Each
is separate and at a different stage. Together they show what already works and
where the product is heading.

Biskiq is not a replacement for specialist CAD, BIM or Blender. It is for shaping
a place, changing your mind about it, and showing someone the result.

![Four Biskiq studies: Vellum, Smart Wall, Conservatory and the unified shell](docs/assets/readme/cover.jpg)

## Four studies

| Study | What it explores | What it is |
| --- | --- | --- |
| 01 Vellum | Drawing and revising a building by hand | Working prototype |
| 02 Smart Wall | Arranging a show so it survives change | Working prototype |
| 03 Conservatory | Directing a guided or free visit | Working prototype, mock content |
| 04 The shell | One workspace for world and experience | Interactive wireframe |

## 01 · Vellum: draw the building

Vellum is about drawing architecture. It has two tools: **Select** picks, shapes
and moves, and **Draw** only draws. A stroke is read against what it touches: the
table, a wall face, another floor, or the sheet raised in the air. The table says
what it understood, such as *Room*, *Arched opening, 1.4 × 2.6 m* or *Canopy*, and
Tab offers the other readings. The stroke, the reading and your correction stay in
one undo step.

![A roof selected in Vellum, with its section and the walls it depends on](docs/assets/readme/vellum-roof.jpg)

<sub>A selected roof, its section, and the walls it says it depends on.</sub>

Revision is where it gets interesting. Move a wall and a roof fitted to it
follows. Remove a divider and the room becomes whole again. Anything that loses
its home waits in a set-aside tray instead of disappearing. When you are ready,
Tell locks the building and turns the pen into the visitor's route.

<p>
<img src="docs/assets/readme/vellum-draw.jpg" width="48.5%" alt="A drawn room with its reading chip and a card describing what changed">
<img src="docs/assets/readme/vellum-walk.jpg" width="48.5%" alt="Tell mode: the visitor's walk with moments, views and reveals">
</p>

<sub>One stroke became Room 1, divided the gallery and brought the roof with it. Tell mode turns the result into a walk.</sub>

- Draw a room, then press Tab to change how the stroke was read.
- Raise the sheet to draw a roof, canopy, deck or bridge in the air.
- Pull a roof's ridge, slope or eave, or edit its section in place.
- Add a storey, or take a suggested mezzanine, then draw the walk in Tell.

Read more: [prototype notes](prototypes/p3-vellum/README.md) · [design notes](prototypes/p3-vellum/DESIGN.md)

## 02 · Smart Wall: arrange and revise

Smart Wall takes one demo gallery wall, four photographs and four spotlights,
and asks what happens when the wall changes after the show is hung. Each work has a
relationship to the wall: an equal 0.45 m gap, a proportional place along the
curve, and a spotlight that follows it. Drag a brass floor handle and the whole arrangement
flows into the new shape.

![The gallery wall bent into a serpentine, with artworks and spotlights following](docs/assets/readme/smart-wall-bend.jpg)

<sub>Bending the wall into a serpentine. The works keep their spacing and their lights follow.</sub>

Push it too far and the prototype explains the conflict. The wall may be too
short to keep the spacing, or a wide frame may sit on a sharp bend. It offers a
repair. Hold Space to see the previous arrangement and restore one work without
undoing the rest.

<p>
<img src="docs/assets/readme/smart-wall-compare.jpg" width="48.5%" alt="A ghost of the previous arrangement, with restore controls for each artwork">
<img src="docs/assets/readme/smart-wall-revision.jpg" width="48.5%" alt="A squeeze conflict explained in consequence cards, with repairs offered">
</p>

<sub>Compare with the previous arrangement, or read why a squeeze cannot keep every gap.</sub>

- Drag the floor handles to bend the wall, or run a revision scenario.
- Cycle a gap through free, locked and equal rhythm, or drag its number.
- Move a work and watch its spotlight follow, or hang a fifth from the staging rack.
- Hold Space to compare and restore individual works.

Read more: [prototype notes](prototypes/p2-smart-wall/README.md)

## 03 · Conservatory: direct the visit

Conservatory looks at the visitor's side of the work. A **Presentation** collects
**Views** of one subject, such as the Pleyel piano. A **Guide** arranges **Stops**,
each with a few Views and holds, plus a transition to the next. The same camera
serves the editor, the thumbnails and playback, so what you compose is what the
visitor sees.

![Conservatory in the Experience lens: the plan, a five-stop Guide and a Presentation card](docs/assets/readme/conservatory-guide.jpg)

<sub>The plan, a five-stop Guide and the piano's Presentation in the Experience lens.</sub>

Drag Stops to reorder them. Switch a transition between Cut and Travel, or drag
the gold path through a doorway in plan. Select a Stop and rearrange its Views
without changing the Presentation's default. Preview plays the tour, then lets the
visitor wander off on their own.

![The visitor preview offering a guided tour or free exploration](docs/assets/readme/conservatory-visit.jpg)

<sub>The visitor's opening screen. Take the tour or explore freely.</sub>

- Place a View in plan or capture one in 3D.
- Open the Guide and drag Stops into a new order.
- Change a transition, or shape its path through the rooms.
- Preview the tour, then explore freely.

Read more: [prototype notes](prototypes/experience-ux-alternative/README.md) · [design notes](prototypes/experience-ux-alternative/design-rationale.md)

## 04 · The shell: one workspace

The shell asks a simple question: what if World and Experience lived in one
workspace? The same Head, Index, Stage and Card stay put as you switch lenses.
World is where you draw, place and inspect. Experience is where you arrange Views,
Stops and a Guide.

![The shared shell in the Experience lens with a Guide open](docs/assets/readme/shell-guide.jpg)

<sub>The Experience lens with a Guide open, inside the shared shell.</sub>

Every change uses the same small vocabulary: white rays and points for what you
can do, gold for what is selected, a value that appears only on hover or drag. Edit
a roof in 3D with its section a click away, slice into the building to look
inside, then open a Guide and play the space as a visitor. It is a wireframe, so
the building and its contents are mock data, but the states are interactive.

<p>
<img src="docs/assets/readme/shell-objects.jpg" width="48.5%" alt="An oak bench selected, with axis rays, a rotation ring and a live value">
<img src="docs/assets/readme/shell-roof.jpg" width="48.5%" alt="A roof edited in place, with its section one click away">
</p>

<sub>Rays, points and a live value on an object. A roof edited in place, with its section one click away.</sub>

- Run one of the ten tours to see a workflow step by step.
- Select an object, wall, opening or roof and use the same rays and points.
- Cut a section, lift a roof, or open its shape for editing.
- Switch to Experience and play the Guide on the same Stage.

Read more: [wireframe notes](prototypes/production-shell-wireframe/README.md) · [design note](prototypes/production-shell-wireframe/DESIGN-NOTE.md) · [atlas, 28 states](prototypes/production-shell-wireframe/atlas.html)

## Also in the collection

Other studies ask narrower or more speculative questions.

| Study | What it explores | What it is |
| --- | --- | --- |
| [World Spatial Interaction Reference (V2)](prototypes/spatial-authoring/README.md) | Unroll, section, lift, look and return in a large building | Working prototype |
| [P3 Architectural Depth](prototypes/p3-depth/README.md) | Compound roofs, dormers, stairs and railings from a few inputs | Design study with a working demo |
| [Living Drawings](prototypes/living-drawing/README.md) | Drawing new 3D forms inside an existing room | Proposal and interactive studio |
| [Native Form Lab](prototypes/native-form-lab/README.md) | Editable extrusions, revolutions and sweeps | Exploratory prototype |
| [Object Composition](prototypes/object-composition-prototype/README.md) | Assemblies, provenance, stale revisions and repair | Research prototype |

## What works today

| Area | Today |
| --- | --- |
| **Working interactions** | Drawing and revision in Vellum; wall bending, gap modes, comparison and single-work restore in Smart Wall; Views, Stops, transitions, playback and visitor preview in Conservatory; tours, atlas and editing states in the shell. |
| **Simplified or simulated** | Vellum uses simple rules for headroom, stair fit and structural support, and fakes the glow under a lightwell. Imported models can be viewed but not reshaped. Conservatory and the shell use mock buildings and content. The shell has no persistence. |
| **Not built yet** | One editor with a shared project, publishing, and the four studies wired together. |

## Try them

Each study runs on its own. Start from the repository root; Vellum and Smart Wall need `npm install` first.

```sh
cd prototypes/p3-vellum && npm install && npm run dev                   # localhost:5191
cd prototypes/p2-smart-wall && npm install && npm run dev               # localhost:5175
cd prototypes/experience-ux-alternative && python3 -m http.server 8841  # localhost:8841
cd prototypes/production-shell-wireframe && python3 serve.py 8850       # localhost:8850
```

The [prototype index](prototypes/README.md) explains what each study is for, and
each prototype README has its own run notes.

## Development

- [Local development](docs/local-development.md): editor, API and database setup.
- [Documentation](docs/orientation.md): the product, the architecture and the domain docs.
- [Verification](apps/editor/tests/README.md): test commands and requirements.
- [Release list](docs/roadmap/now.md): the next engineering batch.
- [Contributing](CONTRIBUTING.MD): branch, verification and review expectations.

`apps/` holds the editor and API. `packages/` holds the shared layout,
project-model and camera cores. `prototypes/` holds the studies above. The
prototypes are not part of the production workspace, so the production install,
build and tests never include them.
