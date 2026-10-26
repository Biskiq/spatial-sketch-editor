# Architectural depth without becoming CAD

**A design study for P3 Vellum.** Compound roofs, dormers, spiral stairs, railings and the
transitions between them, treated as evidence rather than as a feature list.

| | |
| --- | --- |
| Status | Design study. Prototype only. Nothing here is ratified architecture, and nothing here is production code. |
| Where | `prototypes/p3-depth/` in the isolated worktree `p3-depth-lab`, branch `design/p3-architectural-depth`. No production file, package or ratified document was touched. |
| Depends on | P3 Vellum (the existing prototype) and PR **#192**, native creative depth: *creator evidence* §4.2–4.3, §6, and the *synthesis* §1. |
| Evidence | 25 model and card tests, a 22-fixture roof corpus, an 8-fixture walk corpus, measured in the same evaluator the demo runs. |

---

## 0. The answer in one page

The commission asks how far Biskiq can push intuitive, context-aware architectural creation
before it turns into a modelling tool. The study's answer is a rule about where depth should
live:

> **Depth comes from derivation, not from more tools.**
> Give the creator a small number of *authored facts* that a domain already understands.
> Derive everything visible from them. Put the handle on the derived thing, and let the
> derived thing report what it is.

Three evaluators carry the whole study:

| Authored facts | Derived | The claim it tests |
| --- | --- | --- |
| a **plan** with an eave, gable or open end per edge, a run per eave, and a **section** profile | roof surface, hips, valleys, ridges, fascia, gable faces, walls below the eave | a compound roof is one field over one plan |
| a **walk** (line, polyline or helix), a total rise, a width, what happens at a turn | treads, risers, winders, platforms, stringers, posts, the rail path, the band between rails | a stair is a walk, and a rail is the walk offset |
| a **band** swept along that walk, a height, a frame, an infill | handrail, infill (ribbon, glass, balusters), post spacing | a railing is not an object, it is a rule on a path |

Everything else in this document is what happens when those three meet the awkward cases.

**What the prototype demonstrates.** A creator can put a hip-and-valley roof on an L, a T,
a U, a plus, a courtyard, an off-axis hexagon or a rectangle with two different pitches
without drawing a single hip, valley or ridge. They can stand a dormer on a slope, and the
same object becomes a cross-gable when it is tall enough — the drawing changes its *name*,
not its geometry. They can run a stair up a line, a bent line or a helix and get treads,
winders, landings, stringers, posts, a handrail and a band from the same four authored facts.

**What it costs.** Count the numbers a creator actually authors, not the concepts. The
simplest roof is a rectangle (two numbers), one kind per edge, a run per edge that differs, an
eave height, a rise and a section: **five numbers before any edge is special, one more for
each edge that is**. A walk is a line, a total rise, a width and a turn rule: four. The claim
is that this stays a small, nameable set as the form gets strange — §4 tests it, and the
ten-hour path is where the study is weakest (§8).

**Where it stops.** Where the form stops being a height field (an eyebrow dormer, a roof
passing over another roof), where a curved section has to meet a vertical cheek, and where
the joint is joinery (a wreath, a volute, a handrail easing). In those places the prototype
**refuses in words** and names the specialist work rather than approximating it. That
refusal is the boundary, and it is set by the operation the creator can name, not by the
name of the element. This is the research's hypothesis in §4.3 of the creator evidence, and
the prototype is the first thing in this repository that tests it rather than restating it.

**What it must never become.** No object library of "roof plane", "dormer" and "railing"
objects; no constraint graph; no layers; no boolean operations as the main path; no feature
history. Every one of those exists to hold a form the evaluators above cannot derive, and in
this corpus they were not needed.

---

## 1. What P3 has, and what #192 says breaks

P3 Vellum already earns the fifteen minutes: you draw, the tool reads the stroke back, a card
explains the reading, and revisions are honest about what they touch. What it does **not**
have is architectural depth beyond the first idea of each element. The research records the
gap precisely, and this study is aimed at the three items in it that are architectural rather
than object-scale.

From the creator evidence (§4.1–4.3):

- Roofs are the clearest case of *native depth hitting a wall*. Vellum resolved wing roofs on
  L, T, U and plus plans of up to four rectilinear wings, and one explicit join of two
  compatible gables. It deferred joins across pitches, off-axis and freehand plans,
  courtyards, dormers and lean-tos — naming, as the production direction, "a height-field
  upper envelope over an exact planar arrangement, with valley and abutment classification",
  straight-skeleton hips for arbitrary polygons, and dormers as a feature on top of the
  envelope.
- Stairs and railings are the densest cluster of failures in the field evidence, and the
  failures are **transitions**, not straight runs: rails that will not continue across a
  landing, profiles that twist along a three-dimensional path, typed railings that float. The
  research also states the uncomfortable part plainly: *a helical stair is not geometrically
  deeper than an L stair.*
- The mechanism table names what Biskiq's natural ground is: **M7** (the tool lacks domain
  logic — rise and run, hips), **M8** (semantic systems fail at transitions), and **M12**
  (failures are diagnosed late by experts). **M1** (a profile frame drifting on a 3D path) is
  the geometric one that cannot be argued away.

The synthesis (§1) proposes one creative language — **profile, carrier, rule** — and domain
families that compose it. This study accepts that language and then asks a sharper question
of it: for a roof, is the carrier really a curve? The answer the prototype gives is no. A
roof's carrier is a **plan region**, and its rule is an **envelope**, not a sweep. That single
change is what turns four deferred roof cases into ordinary input, and it is the main
technical claim of this study.

---

## 2. The field: a roof is one surface over one plan

### 2.1 The model

A roof volume is:

- a **plan region** (any simple polygon, with holes), and
- one entry per plan edge: `eave` with a **run**, `gable`, or `open` (the back of a dormer,
  where the volume merges into its host), and
- an **eave height**, a **rise**, and a **section**: a monotone profile from `u = 0` at the
  eave to `u = 1` one run in.

Each eave grows a plane inwards: `u = distance / run`, so `u` is dimensionless and `run` is
the pitch. The surface of one volume is the **lower envelope** of its eave planes over the
plan, then the section is applied along `u`:

```
z(p) = eaveZ + rise * section( u(p) ),   u(p) = min over eaves that see p of dist(p, eave) / run
```

An eave sees a point when the point is in front of it **and inside the slab of its own
segment**. That second clause is not a detail; it is the difference between a roof and a
nonsense (see §2.6).

Volumes are combined with an **upper envelope**: a volume that is higher where it stands
simply wins, and the vertical step at its plan boundary is its cheek. A dormer, a cross-gable,
a stepped wing and a second roof are the same object at different heights.

Features are then classified by comparison, not declared by type:

- where two planes of the same volume meet, the arrangement knows the seam is a **hip** at a
  convex corner, a **valley** at a reflex corner, and a **ridge** where two planes top out;
- where a raised volume's boundary stands above the host, the foot of the step is a **valley**
  and the step itself is a **cheek**;
- where the raised volume reaches the host's ridge, the drawing stops calling it a dormer and
  calls it a **cross-gable**. Same object, same facts, one number moved.

### 2.2 What that buys, measured

The corpus is a fixture set built from the research's roof cases plus the controls the
research expects to be specialist work. All of it runs in the demo, in the same evaluator.
Timings are the best of five evaluations after a warm-up, on the study machine — not a
benchmark, and not a rendering cost.

| Fixture | Status | Plan cells | Cost | Valley |
| --- | --- | --- | --- | --- |
| Gable rectangle | built | 4 | 0.03 ms | 0.0 m |
| Hip rectangle | built | 20 | 0.12 ms | 0.0 m |
| Shed (one eave) | built | 2 | 0.01 ms | 0.0 m |
| L plan, all eaves | built | 47 | 0.31 ms | 4.0 m |
| T plan, all eaves | built | 106 | 0.87 ms | 8.4 m |
| U plan, all eaves | built | 60 | 0.45 ms | 8.0 m |
| Plus plan, all eaves | built | 112 | 1.26 ms | 24.0 m |
| Off-axis hexagon | built | 127 | 0.93 ms | 0.0 m |
| Courtyard (hole with its own eaves) | built | 206 | 1.39 ms | 19.0 m |
| Unequal pitches | built | 4 | 0.03 ms | 0.0 m |
| Cross-gable (raised volume) | built | 35 | 0.19 ms | 14.9 m |
| Gable dormer | built | 51 | 0.24 ms | 6.9 m |
| Shed dormer | built | 26 | 0.12 ms | 0.0 m |
| Two dormers | built | 82 | 0.42 ms | 13.7 m |
| Stepped wing | built | 112 | 0.61 ms | 21.6 m |
| Lean-to against a wall (separate volume) | built | 8 | 0.04 ms | 0.0 m |
| Gambrel section | built | 4 | 0.07 ms | 0.0 m |
| Vault section | built | 4 | 0.05 ms | 0.0 m |
| Mansard section | built | 4 | 0.09 ms | 0.0 m |
| Eyebrow dormer | **refused** | — | 0.02 ms | — |
| Roof over roof | **refused** | — | 0.02 ms | — |
| Dormer on a vault | **refused** | — | 0.04 ms | — |

**19 of 19 ordinary fixtures built; 3 controls refused; median 0.12 ms; the heaviest case, a
courtyard with 206 plan cells, is 1.39 ms** in the run recorded in `evidence.json` beside this
document. `npm run evidence` reprints and rewrites it. Repeated runs on the study machine put
the median between 0.11 and 0.22 ms and the worst case between 1.4 and 2.1 ms, so read the
cost column as "a sub-frame rebuild" and not as a benchmark.

The cost line matters for the interaction, not for the machine: a whole roof is evaluated
inside one frame, so every handle drag can rebuild the truth rather than approximate it. The
demo never shows a proxy.

### 2.3 Discovery: compound is not a special case

The L is the cleanest statement of the study. Vellum needed wing decomposition, a join
operation, and a refusal wherever a one-span roof would stop in mid-air. The field needs a
polygon. The inside corner is a valley because that is where two profiles meet; the outside
corners are hips for the same reason. Nothing is drawn: the ink in the demo is the *report* of
where the surfaces intersect, including where the valley stops on the ridge.

The same evaluator then handles, without new concepts:

- **unequal pitches** — the ridge slides toward the steeper side and stays level;
- **courtyards** — a hole is a polygon with eaves pointing at the hole; the ring reads as a
  hip roof turned inside out, and its four corners are valleys;
- **off-axis plans** — no right angles anywhere; a rectilinear decomposition would refuse the
  plan, the field does not care;
- **sections** — a gambrel, a mansard and a vault are the same plan with a different profile,
  and a gambrel's break is a real crease along the roof, which the demo draws.

### 2.4 Discovery: a dormer is a step, not an element

The interesting result is not that a dormer can be modelled. It is that **the type is a
reading**. Place a box on a slope with its back open and its own gable facing out: where it is
above the host you see its roof, where it is below you see nothing, and its foot is a valley.
Move its peak up past the host ridge and the same object is a cross-gable. The card says
which, and the geometry never changes type. This is the strongest answer the study has to the
"don't become BIM" worry: BIM would ask the creator to choose an element *before* seeing the
consequence; here the consequence is computed and then named.

The same machinery produces a lean-to (a second volume whose eave is caught by a wall) and a
stepped wing (a raised volume that is not a dormer), which is why those two fixtures cost no
new code.

### 2.5 Discovery: the refusal is the boundary, and it is honest

The three controls are not failures of effort; they are the places where the height-field
model stops meaning something, and the prototype says so in the creator's language:

- **Eyebrow dormer** — "the cheek folds under the roof: an eyebrow is not a height field, and
  the field refuses it instead of drawing a guess."
- **Roof over roof** — "the lower roof's eave would sit under another roof, with no surface
  above it. Split the plan into two roofs instead."
- **Dormer on a vault** — "a curved section meets a vertical cheek in a curve. This prototype
  keeps the profile and the compound apart rather than sampling a lie."

A fourth refusal is not a control but a rule, and it fires at the gesture. If `run` is read the
way a creator reads it — the distance from the eave to where the slope is meant to stop, the
ridge — then **"Make this end a gable" is only legal on that stopping line.** On the demo's L
the two 4 m ends are closed by the long eaves before their 3 m runs are spent, so they accept a
gable; the four long walls are not, and the click is declined with the height it would have
reached and the run that would make it legal — *"the slope runs 1.3× its 3.0 m run and reaches
7.1 m at this wall … lengthen that run to 4.0 m so this end closes in one rise."* The same rule
is applied to states the UI can reach without a click: switch plan with a gable set, or drag
the opposite run short, and the gable is revoked for the drawing while the card says so (*"…
It is drawn as an eave instead."*). Nothing the field cannot justify is drawn. The consequence
is visible: the demo's four plans are pitched for hips, so most of their walls refuse a gable,
which is the honest reading of those runs rather than a missing feature.

That is the research's **M12** turned into a feature at the exact gesture where the field
evidence says creators lose a week.

### 2.6 What it cost to get right — the honest part

The model is small. Getting it to tell the truth was not, and the study found real errors in
its own implementation — three in the field, two in the renderer (§8, risk 1), and one class
in the card. Each is a class of bug a production family would inherit:

1. **The section was normalised per volume.** Dividing `u` by each volume's own maximum made
   `run` a no-op and put every ridge at full rise, so a 4 m-wide arm with a 3 m run produced a
   ridge as tall as the pitch allowed. Fixed by treating `run` as the pitch and letting a
   plane keep climbing past `u = 1`.
2. **Eave planes leaked past the ends of their segments.** The notch wall of an L cut a false
   valley straight through the bar at eave height. Fixed by requiring a point to be inside the
   eave's own slab.
3. **Creases took their height at the midpoint.** Every hip and valley was drawn level while
   the surface climbed under it. Fixed by sampling both ends.
4. **The card contradicted the drawing.** Removing the last dormer left a sentence describing
   a dormer that no longer existed, under a peak of 0.0 m; a gable end could be reported as
   selected while its wall was drawn under a plane that had run metres past its pitch; and a
   courtyard's hole inherited its edge kinds from the outline, so a gable on the outside of the
   plan also appeared on the inside of the court. Fixed by deriving every reading from the
   drawn volume, by settling gable legality on every state the UI can reach, and by giving
   holes their own edges.

None of these is exotic; all of them are the kind of thing that makes a semantic roof tool
"almost work" in the field evidence. All of them passed the tests that existed at the time.
The three in the field and the one in the card were found by looking at the drawing and
clicking through the states the UI allows — which is an argument for keeping the demo beside
the tests rather than instead of them, and the reason the card now has tests of its own (§5).

---

## 3. The walk: a stair is a walk, and a rail is the walk offset

### 3.1 The model

Authored: a **walking line** (straight, bent polyline, or helix), a **total rise**, a
**width**, what happens at each turn (`landing` or `winders`), and a rail spec (which sides, a
height, a **frame**, an **infill**).

Derived: the run of treads is divided so the riser is constant; platforms consume one riser
and are level; winders fan about the turn and keep rising; stringers follow the treads'
outer edge; posts sit on a spacing; the **handrail** follows the walk's pitch line — never the
stepped tread tops — and the band between the rail and the stair is swept with an explicit
frame.

**The frame is the whole argument.** The research's first mechanism (M1) is a profile whose
frame drifts on a three-dimensional path, and the field evidence shows experts disagreeing
about whether a stair rail's section should stay vertical or turn with the pitch. The
prototype makes that a visible, named fact with two settings:

- `upright` — the infill's sides stay vertical: balusters, glass, a ribbon;
- `pitch` — the section turns with the path: the case a moulded handrail actually is.

You can see the band twist when you switch, which is the point: the disagreement becomes a
chip, not a bug report.

### 3.2 What it proves

| Fixture | Status | Treads | Rail |
| --- | --- | --- | --- |
| Straight | built | 17 | 5.8 m |
| L with a landing | built | 16 | 8.4 m |
| L with winders | built | 16 | 8.3 m |
| U stair with two landings | built | 23 | 14.0 m |
| Spiral, 1¼ turns | built | 18 | 12.8 m |
| Spiral, 2 turns, glass | built | 25 | 22.9 m |
| Spiral, tight well | **refused** | — | — |
| Too short to be a stair | **refused** | — | — |

**6 of 8 built; 2 refused in words.** Refusals name the cause and the fix, in design terms:
*"At the newel the treads are 0 cm: the well is too tight for this width"*, *"Treads are 8 cm
at the walk line, under the 24 cm a foot wants."*

Three claims follow, and two of them contradict how stairs are usually discussed:

1. **A helical stair is not a deeper problem than an L stair.** The same evaluator samples a
   helix instead of a polyline; the treads fan because the path curves, the rails are the same
   two offsets, and the inner rail is steeper because it is nearer the newel. The demo's
   `Spiral / L stair / Straight` chips switch the authored line, not the algorithm.
2. **The transition is the work, and the prototype pays for it once.** A landing is level and
   costs a riser; winders fan and keep rising; the rail flattens across a landing and stays
   continuous through winders. The field evidence says typed railing systems fail exactly
   here; in this model there is no separate railing to fail, because the rail is derived from
   the same walk the stair is.
3. **Validation is a feature, not an error state.** Riser, going, the going at the newel and
   the well are computed on every rebuild and reported on the card, so "too steep" is a fact
   about the object, visible while you drag, not a message after a failed operation.

### 3.3 What is thin

- **Balusters are a distribution over the band, not a family.** The band can be drawn as a
  ribbon, glass, or evenly spaced balusters; there is no baluster profile, no code-driven
  spacing, no per-member suppression.
- **Terminations are not modelled.** A rail starts and stops at the walk's ends. A newel, a
  wall return, a volute and a wreath are absent — and the last two are joinery, which the
  study deliberately leaves out (§6).
- **The rail is a band, not a profile with a section.** The `pitch` frame is demonstrated as a
  twisting band; a moulded section with a real profile is a small extension of the same sweep,
  not yet built.

---

## 4. The interaction model: where the depth is paid for

The study is as much about the hand as about the geometry. Four rules carried over from P3
and made load-bearing:

1. **One handle per authored fact.** In the roof demo the handles sit on *derived* lines: a
   dot on the eave changes that eave's run (the pitch), and the hips, valleys and ridge move
   with it because they were never drawn. In the dormer demo one dot raises the feature's
   rise — and at a threshold the card changes the word "dormer" to "cross-gable".
2. **The card argues with numbers.** `valley · 2.0 m`, `ridge · 9.0 m`, `riser 172 mm`,
   `going 81 cm`, `at the newel 56 cm`. Depth that cannot be read out loud is not depth a
   creator can trust.
3. **The drawing reports, it does not decorate.** Hips, valleys and ridges are ink because
   they are seams between derived surfaces; the section's break on a gambrel is ink for the
   same reason. Nothing in the demo is drawn that the evaluator did not compute.
4. **Refusal in words, at the gesture.** The controls refuse where the model stops meaning
   something, and the words name a next step. This is the ratified PLATE behaviour
   (§0.8.4) applied to a domain that has never had it.

**The fifteen-minute test.** For a roof: pick a plan, drag the eave that looks wrong, choose a
section. For a walk: drag the line, set the rise, choose landing or winders. That is three or
four decisions, each with a visible consequence, each one undo step in a production shell.
The corpus exists to show that the *schema* stays sufficient as the plan gets strange: all
nineteen ordinary fixtures are expressed in the same fields — a plan, a kind and a run per
edge, an eave height, a rise, a section. That is a statement about what the model can express,
not a measurement of how long anyone takes. The study took no time-on-task measurement, and
§8 does not pretend otherwise.

**The ten-hour test is not demonstrated.** What exists is the *capacity* for it: the same
handles address every eave, every dormer and every walk, the reading is derived so it can be
trusted after twenty edits, and refusals prevent the object from entering a state the
evaluator cannot explain. What does not exist is the long session: no persistence, no undo, no
moment where a creator spends an hour on one roof and finds the tool still answering. §8 is
explicit about this.

---

## 5. Evidence, and how to read it

- **28 tests** (`npm test`) cover the claims that can be asserted, in two layers. The field:
  a hip rectangle has level ridges and no valleys; a gable end produces a gable face; a gable
  with no eave opposite is refused once per end, naming how far past its run the slope would go
  and the run that would close it; a hole takes its edge kinds from itself, not from the
  outline; an L produces a valley from the reflex corner; a courtyard's corners are valleys; a
  dormer has cheeks, a foot of valley and its own ridge; gambrel and vault change the surface
  without changing the plan features; changing one eave's run moves the ridge and keeps it
  level; a non-monotone section is refused. The walk: a straight stair derives treads and a
  valid riser; too short a run is refused with the riser; a landing is level and costs one
  riser; winders fan; a helix is one walk with two rails and a band; the frame changes the
  band; a tight well is refused. **The card and the scene** (`tests/scenes.test.mjs`), because
  the card is part of the claim: the host ridge is true with nothing selected; no reading
  survives the last dormer's removal; a declined gable never enters the state; a refusal
  leaves with the end it was made about; every plan and every edge either draws a gable face
  the card calls a gable, or draws an eave, says so, and leaves the peak at the eave roof's
  value instead of an extrapolation; and every line a creator can hover carries a creator's
  name rather than an internal kind.
- **The corpus** is 30 fixtures in the same evaluator the demo uses, including the three
  controls and two bad walks. It is a *fixture set assembled from the research*, not a survey
  of real buildings, and it is small. It is enough to separate "the model handles the case"
  from "the model was tuned to the demo".
- **Timings** are best-of-five per fixture in the same modules the browser imports. They
  establish that exact evaluation per drag is plausible (the whole roof is under a frame, on a
  laptop); they are not a rendering cost, and they say nothing about a phone.
- **What the corpus cannot tell you**: whether a *creator* finds these handles. There is no
  user study here, no time-on-task, no comparison with Vellum's wing-roof flow. Those are the
  next experiments, not conclusions.

Reproduce everything: `npm test` and `npm run evidence` in `prototypes/p3-depth/`.

---

## 6. Where native depth stops

The study's version of the line, with the evidence behind each row:

| Kept native | Why | Refused, and named | Why |
| --- | --- | --- | --- |
| Any simple plan or plan with holes, at any angle | the field is defined on polygons; 127 cells for an off-axis hexagon | **Roof over roof** | not a height field; splitting the plan is the fix |
| Unequal pitches per eave | the ridge is where profiles meet, so it moves | **Eyebrow dormer** | the cheek folds under the roof; not a height field |
| Gables, hips, valleys, ridges, fascia | derived seams | **Dormer on a curved section** | a curve meeting a vertical cheek is a curve |
| Dormers, cross-gables, stepped wings, lean-tos | upper envelope of volumes | **Wreath, volute, handrail easing** | joinery, and the research agrees it is fabrication work |
| Curved sections as profiles (vault, gambrel, mansard) | section is applied after the plan | **Framing and trusses** | specialist, and no creator in the evidence asked for it here |
| Walks of any plan shape, including helices; landings and winders; rails on either side | one evaluator, one path | **Railings as a separate object** | the rail is the walk offset; a second object would be the thing that drifts |
| Infill as a band (ribbon, glass, balusters) | a sweep with an explicit frame | **Roof openings, roof-to-wall junctions, parapets** | not built; the next slice, and honestly out of this study |

The pattern: **native where the creator can name the operation** — "this section over this
plan", "this walk between these levels", "this band along this walk". Specialist where the
form is not that operation, and there the tool must say so at the gesture, because the field
evidence says late discovery is the expensive failure.

---

## 7. Preserve, challenge, replace

### Preserve

- **The drafting table and the card.** The study adds no new panel, mode or palette. Every
  new fact is a chip or a handle on the same sheet.
- **Readings over tools.** The dormer/cross-gable reading is the same idea as Vellum reading a
  stroke: the tool names what it understood, before commit.
- **Refusal in words** (PLATE §0.8.4), including the rule that the words name a fix.
- **Host-local frames.** The walk's rail is defined in the walk's frame exactly as an Opening
  is defined in a Wall's `(s, z)`; the roof's dormer is defined in the host's plan and eave
  height. This is the pattern the research says generalises, and the prototype confirms it for
  two more hosts.
- **The North Star's non-goals.** No B-rep editing, no general booleans, no feature tree, no
  sculpting, no fabrication output. Nothing in the corpus wanted them.

### Challenge

- **"Wing roofs" as the unit of roof depth.** Rectilinear wing decomposition is a way to avoid
  the field, and it is why four cases had to be deferred. Replace with a polygon and a
  per-edge kind. The L, T, U, plus, courtyard and hexagon all fall out of one implementation.
- **The join as an explicit pair operation.** A join is what two surfaces do when they meet.
  Asking the creator to select two roofs and invoke a join makes them responsible for a
  consequence the evaluator can compute. Replace with the envelope; keep no join verb.
- **"Dormer" as a massing semantic.** A dormer is a raised volume whose peak is below the
  host ridge. Naming it at creation time freezes the thing the creator most wants to
  experiment with — its height. Make the name a reading.
- **A typed stair family with a separate railing.** The research's own conclusion is that
  typed systems fail at transitions. If the rail is derived from the walk, there is no join to
  fail. Make the **walk** the authored object and the stair its reading.
- **"Carrier is a curve."** The synthesis's language is right, but a roof's carrier is a
  region. Admit two carrier kinds — path and region — with one rule kind (carry a profile
  across it), rather than stretching "sweep" to cover roofs.
- **Per-edge `run` alone as pitch control.** It works, and it is what the demo drags, but a
  real roofer thinks in rise-over-run and in "make these two parallel". The prototype shows
  the geometry tolerates both; the interaction should say pitch, not run.

### Replace, concretely

| Today | In this study |
| --- | --- |
| wing roofs on up to four rectangles; a join verb; refusal where a span stops in mid-air | one polygon field; no join verb; the valley is computed |
| dormers and lean-tos deferred as "new massing semantics" | one upper-envelope feature; the type is a reading |
| stairs named as a future typed family | a walk with derived stair, and the rail as its offset |
| rail frame left to the sweep implementation | frame is an authored, visible choice (`upright` / `pitch`) |
| failure discovered later, diagnosed in a forum | refusal at the gesture, with the cause and a fix |

---

## 8. Risks, and what is not proven

This is a design study, and the honest list is longer than the demo suggests.

1. **The renderer is a study renderer.** Canvas 2D, painter's algorithm, no depth buffer. It
   needed three ad-hoc layering rules to be readable (near-plane clipping so a ground line
   cannot sweep the paper; the table as its own layer so the ground cannot swallow the model;
   walls under surfaces, feature volumes over their host). Those rules are defensible — a wall
   cannot hide a roof from an eye above the eaves, and a feature is above its host by
   construction — but they are *arguments*, not a depth buffer. Production needs the real
   thing, or the roof will occasionally paint wrong at an angle the study never tried.
   Two presentation bugs in this study make the point better than the corpus does: the first
   camera put the eye *under* the roof while the ray inverse disagreed with it, so every
   earlier screenshot was the underside of a roof and click-to-place landed on the far slope.
   Both passed the model tests. They were found by looking at the drawing and clicking on it.
   Placement is still clamped to a rectangle rather than to the host's slopes, so a dormer can
   be dropped where half of it hangs over the eave.
2. **Numerics are not production numerics.** The arrangement is floating point with epsilons.
   The corpus is small and clean. Production has robust predicates; a family built this way
   must be moved onto them and fuzzed with near-degenerate plans before anyone trusts it with
   a creator's afternoon.
3. **Curved sections are banded, not exact.** A vault is nine bands per cell. It looks right
   and it is not the surface; a gambrel's crease is exact, a vault's crown is not.
4. **The roof does not touch the building.** Walls below the eave are extruded skirts for
   context. There is no roof-to-wall junction, no gable wall that meets a slope, no parapet, no
   clerestory, no roof opening. These are the next real cases, and they are where a roof
   family meets the rest of Biskiq.
5. **The ten-hour path is asserted, not shown.** See §4. There is no persistence, no undo, no
   long session.
6. **Railings are the thinnest of the three.** A band is not a baluster family; a walk has no
   termination; there is no wall return. The band also renders as overlapping translucent
   panels, so its tone is not stable — a drawing bug, not a geometry one, but it hides the
   frame difference the demo is trying to show.
7. **No user evidence.** No creator has used this. The claims about cost are structural (a
   handful of authored numbers, counted in §0), not measured on people.
8. **The corpus is a fixture set.** 30 cases assembled from the research, not a sample of
   buildings. It shows coverage of the named cases; it does not show coverage of the world.
9. **Integration is unproven.** Nothing here is an accepted intent, a compiler family, or a
   component. The shapes of those seams (identity, correspondence, undo, preview) are assumed
   to be available because the shell already has them, and that assumption is untested.
10. **The gable rule can read as a missing feature.** It declines most walls on the demo's
    plans, because those runs were chosen for hips. The refusal is right for the model, but the
    interface offers the chip first and explains second; the next pass should mark the ends that
    can close, or show the run that would make one legal before the click, and test whether a
    creator reads that as guidance or as obstruction.

---

## 9. What I would build next, in order

Each step is small, testable, and chosen because it attacks a risk above rather than adding a
feature.

1. **Roof meets wall.** An eave that sits on a wall top, a gable wall that closes a slope, a
   parapet. The corpus does not cover it, and it is the first thing a creator will ask for.
2. **Openings in a roof plane.** A roof window or a chimney is an Opening in a host frame —
   the same pattern as a Wall — and it tests whether the "host-local frame" claim survives a
   host that slopes.
3. **Pitch as a pair, with a "make parallel" reading.** Replace the single `run` handle with
   rise-over-run and a derived reading that offers to match a neighbour. Tests the
   challenge in §7 without new geometry.
4. **Walk terminations and rail ends.** Newel, wall return, a rail that stops. This is the
   transition the field evidence says typed systems fail, and it is cheap here because the
   rail is already derived.
5. **Balusters as a distribution with end conditions.** Spacing, a profile, suppression at
   the ends — the research's M5, applied to the one place a creator will notice it.
6. **Move the arrangement onto production's robust predicates and fuzz it.** Nearest-degenerate
   plans, self-touching outlines, zero-length edges. If the model survives, the boundary in §6
   is real; if it does not, the boundary moves and that is a finding too.
7. **A creator session.** Ten edits to one roof, with undo, in front of someone who has not
   seen the demo. That is the only way to test the claim this study cares most about.

---

## 10. Run it, test it, read it

```bash
cd prototypes/p3-depth
npm test        # 28 tests: field, walk, and the card, node --test
npm run dev     # static server on http://127.0.0.1:5194
npm run evidence  # reprints the corpus table and writes evidence.json
```

No dependencies, no build step, no network. Four tabs, keys `1`–`4`, `R` resets the camera.

| Tab | What to do |
| --- | --- |
| **One roof** | Switch plan (L, T, off-axis, courtyard) and section (straight, gambrel, mansard, vault). Click an eave, drag its dot to change the pitch: the hips, valley and ridge move. |
| **Dormer** | Click a slope to drop a dormer; drag the white dot to raise it. Past the host ridge the card changes its reading to cross-gable. |
| **Walk & rail** | Switch walk (spiral, L, straight), turn (landing, winders), rail frame (upright, pitch) and infill (ribbon, balusters, glass, handrail only). Drag the white dot for total rise. |
| **Corpus** | The 30 fixtures, built live by the same evaluator; click a row. |

```
prototypes/p3-depth/
  DESIGN.md            this proposal
  README.md            the short version, run instructions, status
  index.html, styles.css
  src/core/plan.js     2D helpers: convex split, clipping, triangulation, point-in-region
  src/core/roof.js     the field: volumes, eaves, envelopes, sections, creases, the gable rule
  src/core/walk.js     the walk: path sampling, spans, treads, stringers, rails, band, validation
  src/core/corpus.js   the 22 roof and 8 walk fixtures, including the controls
  src/render/camera.js the projection: camera, near clipping, screen-space picking, no DOM
  src/render/ink.js    the painter: washes, ink and paint layers over canvas 2D
  src/scenes/faces.js  derived geometry → ink, once, for every scene that shows it
  src/scenes/roof.js   the roof demo: plans, state, the eave handle, the card's words
  src/scenes/dormer.js the dormer demo: host, placement, its two handles, the reading
  src/scenes/walk.js   the walk demo: the three walks, staging, its two handles, the words
  src/scenes/corpus.js the corpus demo: every fixture through the same builders and ink
  src/scenes/format.js number helpers: the one format, the one clamp; index.js is the surface
  src/ui/sheet.js      a scene's ui description → DOM
  src/app.js           the sheet: one table of demos, state, camera, pointer, handle lookup
  tests/roof.test.mjs   12 tests
  tests/walk.test.mjs    7 tests
  tests/scenes.test.mjs  9 tests: the card agrees with the drawing, and names what it shows
  tools/evidence.mjs   prints the table above, writes evidence.json
  tools/serve.mjs      the dev server
```

---

## 11. What is prototype-only, and what is recommended

**Prototype-only, and not to be copied into production as-is:** everything in `src/`. The
renderer, the arrangement's numerics, the banded curved sections, the skirt walls and the
absence of undo, identity and intent are all study scaffolding.

**Recommended for review, as direction, not as architecture:**

1. A roof is a **height field over a plan region**, with per-edge eave/gable/open, pitch as
   run, and a **section** applied afterwards; volumes compose by **upper envelope**; hips,
   valleys, ridges and cheeks are derived seams.
2. A dormer, a cross-gable, a stepped wing and a lean-to are **the same object** at different
   heights, and the name is a **reading**, not a type.
3. A stair is a **walk**; a railing is the **walk offset** with an explicit, visible **frame**;
   landings and winders are **transition rules**, not separate objects.
4. **Refusal in words is part of the model**, and the boundary it draws — height fields yes,
   curved-cheek intersections and roof-over-roof no, joinery never — is a better product
   boundary than a longer feature list.
5. Extend #192's language from one carrier kind to two: **path** and **region**, with one rule
   kind, "carry a profile". Roofs are the region case, walks the path case, and both are the
   same idea about context.

If only one thing survives review, it should be (2): *the type of a thing should be what the
tool reads back, not what the creator had to declare before seeing it.* That is the difference
between this and BIM, and it is the cheapest of the five to adopt.
