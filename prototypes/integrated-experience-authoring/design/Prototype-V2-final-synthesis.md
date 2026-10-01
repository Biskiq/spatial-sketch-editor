# Final V2 design synthesis — integrated Experience authoring

## 0. Decision

The final direction original core:

- **Set** for one Presentation’s Camera Views;
- **Seam** for the relationship between adjacent Stop occurrences;
- **stable Card + contextual Deck** rather than a morphing all-purpose surface;
- **Ask Rule** whenever an edit reaches beyond the immediate use;
- progressive Camera disclosure from automatic framing to direct spatial precision.

The peer-review revision strengthens that model with five changes:

1. disclosure is understood as **Scale × Depth**, not one linear hierarchy;
2. ordinary Guide awareness begins with a quiet **Peek rail**, not a full Deck;
3. a Seam may have **multiple possible origin Views**;
4. Camera Views can appear as a **Presentation-local unordered constellation**;
5. temporal coordination is a second projection of one spatial relation, not a second route editor.

Guide overview remains intentionally abstract: numbered Stop entry pins on Stage, with Camera View detail disclosed only when the creator expands an occurrence or works on its Seam.

The goal is a spatial authoring system whose complexity expands around the creator’s current question without fragmenting World, Camera and Experience into separate applications.

---

# 1. Product model

The design continues to reflect four distinct concepts:

```text
WORLD
what exists

CAMERA
how it can be seen and traversed

PRESENTATION
what visitor meaning and participation attach to a subject

GUIDE
which Presentation occurrence happens next
```

A Presentation is reusable visitor meaning.

A Camera View is reusable framing.

A Stop is one Guide occurrence referencing a Presentation.

A Seam is the transition into the following Stop.

Therefore:

```text
View progression ≠ Guide order ≠ Camera connectivity
```

and:

```text
Presentation identity ≠ Stop occurrence identity
```

No visual treatment may imply otherwise.

---

# 2. The governing interaction model: Scale × Depth

The strongest correction from peer review is that two independent questions must not be forced into one disclosure ladder:

### Scale

**What am I currently working on?**

```text
Subject
    ↓
Presentation
    ↓
Camera View
    ↓
Stop occurrence
    ↓
Guide / Seam
```

### Depth

**How much instrument do I need for that thing?**

Examples:

```text
Camera
Auto → Hints → Capture → Rig

Seam
Route / pace → Coordination → Precision
```

Scale changes context.

Depth reveals more control within that context.

Changing scale does not imply increasing technical depth.

Opening precision does not require zooming out to the whole Guide.

This is the basis of progressive disclosure.

---

# 3. Final shell

The final shell keeps stable landmarks:

```text
┌──────────────────────────────────────────────────────────┐
│ HEAD                                                     │
├───────────┬───────────────────────────────┬──────────────┤
│ INDEX     │                               │ CARD         │
│ / locator │            STAGE              │              │
│           │                               │              │
│           │                               │              │
├───────────┴───────────────────────────────┴──────────────┤
│ contextual DECK                                         │
└──────────────────────────────────────────────────────────┘
```

## Head

Persistent.

Owns:

- project identity;
- World | Experience lens;
- active Experience;
- save/history;
- Preview.

## Index

Locator, not primary authoring surface.

In Experience it primarily exposes Presentations and relevant relationships.

It may collapse toward a spine in dense or narrow windows.

## Stage

Dominant continuous spatial surface.

Owns:

- World spatial context;
- Set / View geometry;
- Camera rig;
- Camera routes;
- Guide entry pins;
- direct manipulation;
- Plan and 3D readings.

## Card

Stable semantic and scope surface.

Its physical landmark does not turn into the Deck.

The Card answers:

> What is this thing, who owns this property, and how far will this edit reach?

## Deck

Absent unless Guide work requires it.

One stable bottom surface with three disclosure postures:

```text
Peek
Overview
Seam
```

Coordination appears inside Seam depth rather than becoming a permanent fourth workspace.
 **semantic information and extended order/path information have predictable homes**.

---

# 4. Ordinary default state

The default Experience state is deliberately quiet.

```text
Experience
3D Stage
Index
Card
no full Deck
no timeline
no Camera rig
```

Selecting a World subject in Experience shows its relation to Experience authoring.

`Present this` creates or opens a Presentation.

A fresh Presentation initially exposes only:

```text
Meaning
Focus
Show

+ Add behavior or offer
```

Guide UI does not appear before a Guide exists.

Camera precision does not appear before it is requested.

The creator can reach Preview without constructing a Guide or Camera graph first.

The revised proposal explicitly removes the old behavior where the full Guide Deck appeared immediately after the first Guide addition.

---

# 5. Presentation authoring: the Set

A Presentation’s Camera Views form a **Set**.

The Set is not a sequence.

It is a collection of reusable ways the Presentation may be seen.

Example:

```text
Why this piano matters

SHOW

          Entry
            ○

    ○ Under lid

                       ○ Keyboard

             ○ Rear
```

Views can carry Presentation-local roles such as:

```text
Entry
Cue: lid opens
Visitor may choose
Suggested framing
```

Those roles belong to the Presentation’s use of the View.

The View geometry remains Camera-owned.

There is:

- no `View 1 / View 2 / View 3`;
- no implied linear progression;
- no automatic Stop creation;
- no View-to-View edge merely because two Views coexist.

The peer-review revision replaces the earlier View strip with an **unordered constellation**, preserving the original Set idea while removing any filmstrip implication.

---

# 6. Where Camera Views appear

View visibility follows progressive disclosure.

### Ordinary 3D Presentation work

Only the working Presentation’s Set appears.

Views exist spatially around their actual focus.

### Plan

The same working Set appears at map scale.

The meaning remains identical.

Plan does not create a separate Camera graph.

### Guide overview

Camera constellations disappear.

Stage shows **numbered Stop entry pins only**.

No entry-facing glyph is added.

The whole-Guide view answers:

> Where are the Guide occurrences and how are they ordered?

It deliberately does not answer:

> Which way does every Camera View face?

### Expanded Stop occurrence

Its Presentation’s full Set becomes visible again:

- spatially on Stage;
- schematically inside the expanded occurrence.

### Seam selected

Only now do Camera route relationships appear.

They are scoped specifically to:

- possible origin Views;
- the destination entry View;
- the selected Seam.

A full connectivity overlay can still be requested separately.

This preserves the boundary:

```text
Guide overview ≠ Camera graph
```



---

# 7. Guide awareness: Peek → Overview → expanded occurrence

Once a Guide exists, the bottom Deck begins as a very quiet **Peek rail**, approximately 28px high.

It overlays or minimally occupies the Stage edge rather than immediately resizing the workspace.

Example:

```text
● 1   ○ 2   ● 3   ◉ 4   ○ 5   ○ 6
                    ↑
                 current
```

The rail exists to answer one question:

> Where am I in the Guide?

No Guide means no rail.

This prevents Guidance from appearing mandatory.

## Guide overview

Expanding the rail produces Stop occurrence cards.

Occurrence density has three levels:

```text
L0
compact identity / position

L1
thumbnail
title
entry View name
warning state

L2
expanded occurrence
Presentation summary
View constellation
Guide-specific details
```

The selected occurrence expands.

Nearby occurrences may remain L1.

Distant occurrences compress toward L0, producing a fisheye rather than equal-width clutter.

The Stage simultaneously shows numbered Stop entry pins.

The Guide overview is therefore both:

```text
Deck → editorial order
Stage → spatial occurrence location
```

without exposing Camera topology yet.

---

# 8. Repeated Presentations

The same Presentation may appear multiple times in the Guide.

Example:

```text
Stop 2
Why this piano matters

Stop 5
Why this piano matters
```

These are distinct occurrence identities referencing one shared Presentation.

Occurrence-local properties may differ:

- entry View;
- Cut / Travel;
- pacing;
- continuation;
- Gate;
- visitor choices.

Shared meaning remains shared unless explicitly forked.

The UI must always distinguish:

```text
shared Presentation
vs
this Stop
```

The Card carries that distinction.

The Deck shows occurrences.

---

# 9. Seam: the first-class Guide transition

The **Seam** remains the strongest interaction idea from the original Designer 5 proposal.

A Seam is the transition into the following Stop.

Collapsed:

```text
[ Stop 4 ] ─── Seam ─── [ Stop 5 ]
```

Selecting the Seam does not create a separate Camera workspace.

Instead, the Deck changes posture.

Unrelated Stops compress strongly.

The neighboring occurrences become bookends.

The center becomes the Seam instrument.

```text
┌────────────┐ ┌───────────────────────────────┐ ┌────────────┐
│  STOP 4    │ │             SEAM              │ │  STOP 5    │
│  Piano     │ │                               │ │  Gallery   │
└────────────┘ └───────────────────────────────┘ └────────────┘
```

This remains a stable bottom landmark rather than a new editor.

---

# 10. Seam opening does not move the Stage

A critical revision is:

> **Opening a Seam is view intent. Editing its route is edit intent.**

Therefore opening the Seam does not automatically tilt into Plan or move the current authoring camera.

The creator can inspect the transition without losing context.

Only when an operation needs spatial route legibility, such as:

```text
Draw route
grab anchor
repair route
```

does the Stage move toward Plan.

A clear return crumb restores the previous spatial reading.

This keeps spatial memory intact.

---

# 11. Multi-origin Seam reachability

The peer review exposed an important correction to the original Seam model.

A Presentation may have several Views.

A visitor may therefore reach the Seam while standing at more than one Camera View.

Travel cannot simply mean:

```text
Presentation A → Presentation B
```

or even:

```text
one View A → one View B
```

Instead the transition must ask:

> From every View the visitor might legitimately occupy at the end of Stop A, can they reach Stop B’s entry View?

The left Seam bookend may therefore expand into:

```text
PIANO

Entry        ✓
Under lid    ✓
Keyboard     GAP
```

with a headline such as:

```text
Reachable from 2 of 3 Piano Views
```

The destination bookend identifies the Stop’s entry View.

Fixing one missing origin does not silently claim the others are fixed.

This becomes part of route authoring and repair.

---

# 12. Cut and Travel

The distinction remains strict.

## Cut

Occurrence-local entry policy.

```text
Stop A
   │
   × no Camera edge
   │
Stop B
```

Cut creates no Camera route.

Nothing is drawn across spatial topology.

## Travel

References supported Camera connectivity.

```text
origin View
     │
 Camera route
     │
destination entry View
```

Travel cannot silently invent motion.

Missing Camera support is an explicit gap.

---

# 13. Route authoring

When route work begins, Plan becomes the preferred reading.

Stage shows Camera-owned infrastructure:

```text
A ───◆────○────◆─── B
    anchor generated anchor
```

Authored anchors are directly manipulable.

Generated points remain derived.

Camera ownership stays visually distinct from Guide ownership.

Pace can be represented spatially along the route.

The route remains the only place where path geometry is edited.

---

# 14. Coordination depth

Most Seams need no timeline.

Therefore the temporal strip does not open with the Seam.

A normal Seam contains:

```text
route
pace
spatial status
```

Only when the creator chooses `Coordinate`, or existing coordination already exists, does a compact temporal strip appear.

The Stage must remain dominant.

This is not a global timeline.

It is a **local projection of the selected Seam**.

---

# 15. Spatial and temporal mirroring

The spatial route and temporal strip are not two editable copies.

They are two projections of the same authored relationship.

Example:

```text
PLAN
A ──◆────○────◆── B
       ▲
      beat

COORDINATION
0m ─◆────○────◆─ 13m
      ▲
     beat
```

The synchronization rule is based on stable stations:

```text
station-ref =
depart
anchor k
arrive
named marker
```

A beat binds to a station, not directly to a second value.

Therefore:

```text
"open lid at anchor 2"
```

survives a change in route pace.

Generated points cannot become station references.

Camera owns:

- anchors;
- route;
- pace.

This Stop owns:

- beats;
- holds;
- occurrence-specific coordination.

The strip may display Camera stations as quiet orientation ticks but does not edit the route.

Path editing remains exclusively on Stage.

---

# 16. Card and Ask Rule

The Card remains vertically stable.

Its header is always visible and declares:

```text
target
owner
reach
```

For example:

```text
PRESENTATION
Why this piano matters
used by 2 Stops
```

or:

```text
CAMERA VIEW
Under the lid
used by 4
```

or:

```text
THIS STOP
05
appearance 2 of Why this piano matters
```

Lower strata collapse when not needed.

Slots appear according to actual content rather than as permanent empty machinery.

Any edit whose reach is broader than the current use invokes the **Ask Rule**.

Example:

```text
CAMERA VIEW · 4 USES

Update all 4
Only here
```

Local work remains quiet.

Wide-reaching edits announce themselves.

---

# 17. Precise Camera authoring

The original four-depth Camera model remains:

```text
AUTO
derived framing

HINTS
near / far
side
height
look-at
movement intent

CAPTURE
explicit Camera View

PRECISE
direct Camera instrument
```

At precise depth, the interaction grammar has three spatial postures.

## Outside

The creator sees the observer in the room.

Best for:

- relation to architecture;
- height;
- distance;
- route;
- target placement.

## Through

The Stage looks through the Camera View.

The image itself becomes the framing instrument.

Controls may include:

- frame gate;
- horizon / height;
- lens;
- target crosshair.

Editor chrome remains visible so this cannot be mistaken for Visitor Preview.

## Plan

Best for:

- routes;
- connectivity;
- anchors;
- spatial relationship.

All three edit the same Camera View / route.

They do not create separate Camera systems.

Only the **active grip** displays its numeric tape.

The earlier all-values-at-once rig is retired.

---

# 18. Plan and 3D

Plan and 3D remain readings of one Stage.

They answer different questions.

## 3D

Best for:

```text
How does this feel here?
What does the visitor see?
Where is the focus?
How should this View frame the subject?
```

## Plan

Best for:

```text
Where does this Experience fit together?
Which Stops occupy which places?
Which Views are spatially related?
Can this Seam travel?
Where are its Camera anchors?
How does coordination align with movement?
```

No ownership changes when switching.

---

# 19. Preview

Preview remains a visitor takeover rather than an editor overlay.

Authoring infrastructure disappears.

Visitor session state never writes back into source truth.

Exit restores:

- authoring lens;
- selection;
- Card context;
- Stage standpoint;
- open inspection state.

Preview is execution, not another authoring mode.

---

# 20. Final progressive disclosure picture

The final Experience authoring flow should feel approximately like:

```text
WORLD SUBJECT
    │
    └─ Present this
          │
          ▼
    PRESENTATION
    Meaning / Focus / Set
          │
          ├─ select View
          │      │
          │      └─ Auto → Hints → Capture → Rig
          │
          └─ Add to Guide
                 │
                 ▼
              PEEK RAIL
                 │
             expand
                 ▼
           GUIDE OVERVIEW
                 │
          expand occurrence
                 ▼
       PRESENTATION + VIEW SET
                 │
           select Seam
                 ▼
               SEAM
         route / reachability
                 │
          Coordinate if needed
                 ▼
       LOCAL TEMPORAL STRIP
```

Camera precision remains reachable directly from a View and does not require traversing the Guide branch.

This is why the model is **Scale × Depth**, not one mandatory ladder.

---

# 21. Explicitly rejected directions

The synthesis rejects:

- permanent global Camera timeline;
- permanent Guide Deck before a Guide exists;
- full-height Deck appearing after first Add to Guide;
- View filmstrip implying sequence;
- View-to-View edges inside a Presentation merely because Views coexist;
- Camera route topology drawn across whole Guide overview;
- entry-facing glyphs on every Stop in whole-Guide overview;
- morphing the vertical Card itself into the horizontal Guide Deck;
- automatically switching to Plan merely because a Seam was opened;
- all Camera numeric tapes visible simultaneously;
- one-origin-only Seam logic;
- Guide order and Camera topology rendered as one graph;
- temporal strip acting as a second route editor.

---

# 22. Final canonical visual QA set

The finalized design should be represented by six canonical visual states.

### QA-1 — Ordinary Presentation

3D.

Show:

- Stage;
- Set;
- quiet Card;
- no Guide if none exists, or Peek rail only;
- no advanced Camera controls.

### QA-2 — Guide overview

Plan or useful spatial overview.

Show:

- Peek expanded into occurrence cards;
- fisheye L0/L1 density;
- selected Stop expanded only as appropriate;
- numbered Stage entry pins;
- **no entry-facing glyphs**;
- no Camera route graph.

### QA-3 — Expanded occurrence

Show:

- one Stop at L2;
- shared Presentation context;
- entry View;
- full unordered View constellation;
- occurrence-local versus shared information.

### QA-4 — Seam route authoring

Plan.

Show:

- unrelated Stops compressed;
- two bookends;
- multi-origin reachability;
- destination entry View;
- Camera route and anchors;
- no coordination strip yet.

### QA-5 — Seam coordination

Same Seam.

Show:

- same spatial Camera route;
- local coordination strip;
- same station markers in both projections;
- Stop-local beats / holds clearly distinct from shared Camera route.

### QA-6 — Precise Camera

Prefer Through plus enough chrome to show editor state.

Show:

- precise Camera grip;
- active-grip-only value;
- Camera ownership/reach;
- same Card landmark;
- obvious distinction from Preview.

These become the canonical visual contract for the implementation plan.

---

# 23. Remaining experiments, not unresolved architecture

Only a few interaction details should remain intentionally experimental.

### E1 — Through versus Outside default

At precise Camera depth, should the first posture be:

```text
Through
```

or:

```text
Outside
```

Both remain available.

### E2 — Deck crop-docking

Verify that Peek → Overview → Seam preserves enough spatial memory when the Stage visible rectangle changes.

### E3 — Station-bound coordination

Verify creators correctly predict what happens to beats when:

- anchors move;
- Camera pace changes;
- a shared route is edited;
- another Stop uses the same Camera infrastructure.

These are usability experiments.

They do not change the ownership model or shell architecture.

---

# 24. Final design principle

The final system can be summarized as:

> **Keep the current question local. Reveal the wider system only when the creator asks for wider context, and reveal precision only when the task requires precision.**

And structurally:

```text
Card
= identity, meaning, ownership, reach

Stage
= spatial truth and direct manipulation

Deck
= Guide order, Seam and local coordination

Set
= unordered Camera framings for one Presentation

Seam
= occurrence transition into the next Stop

Ask Rule
= explicit boundary whenever an edit reaches further than the current use
```

This is the design direction to carry into canonical QA imagery and the repo-aware implementation plan.