# Experience V3 — proposed design QA boards

**Status: SUPERSEDED historical UX3/V3 specimens (#114, 2026-10-13).**
The owner accepts [interactive Conservatory](../experience-ux-alternative/README.md);
[PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md)
owns current UX acceptance. These 15 PNGs, compositor and original notes are
preserved provenance, not pixel/layout-equivalence or implementation gates.
The standalone V3 plan is inactive; no generation or runtime changes are needed.

**Original specimen/review notes follow as history**, including their former
pending-ratification and acceptance language.

**Generated design specimens, not runtime screenshots. Proposed 2026-10-13;
owner ratification pending.** This package is the visual companion to the
[product proposal](../../docs/roadmap/p25-experience/design/experience-ux-v3/README.md),
[design specification](../../docs/roadmap/p25-experience/design/experience-ux-v3/design-system.md)
and [implementation plan](../../docs/roadmap/p25-experience/design/experience-ux-v3/implementation-plan.md).
It proposes replacements for the eight old Experience Design-QAs. Their PNGs and
all prior actual runtime/before-state captures remain intact.

Open the [visual gallery](./gallery.html) to scan the complete package. Open a
PNG at full size when judging hierarchy or density. A coding agent reads the
acceptance note beside its state, then the corresponding design/plan section.
After ratification these boards guard composition and interaction meaning;
until then they are candidate references, never claimed as owner acceptance.

## What is binding, and what is illustrative

Essential: Stage allocation, one primary creation, Card identity and source link,
available versus local View sequence, Guide order, distinct selection/task/Camera
roles, contextual lower instruments, ruler clearance, explicit return and separate
guided/free visitor behavior. Follow the written specification if an incidental
pixel or label conflicts with it.

Illustrative: the low-poly museum fixture, exhibit materials/lighting, sample
names, exact route vertices, thumbnail pixels, typography raster and incidental
grid spacing. Every board uses the same museum fixture, with observer positions
and marker bearings projected from its own cameras. Plan and 3D depict the same
rectangular Machine gallery and adjacent Rotunda. This is plausible workspace
geometry, not an unrelated image backdrop. The path line illustrates editable
interior points; the implementation draws its actual Camera evaluator's samples.
The specimen compositor is not a navigation evaluator or architectural compiler.

Static buttons are design marks, not working application commands. These are
rendered HTML/CSS/Three specimens; no new application UI, controller, runtime
architecture or source-model implementation is included. Watermarks distinguish
the boards from [actual latest runtime captures](../spatial-authoring/screens/experience-ux456/).
Implementation screenshots must go into a new clearly named runtime evidence
directory rather than overwrite these target specimens.

## Board acceptance notes

| Board / size | Essential composition and interactions | Semantics to verify in implementation |
|---|---|---|
| [01 · initial workspace](./boards/01-workspace-start.png), 1440×900 | Green spatial ground, complete museum, one Stage creation invitation, small empty Index, no empty right Card. Browse World remains secondary. | New Presentation creates one Presentation + Default Camera use atomically. Present this is contextual on a selected object, not a competing permanent creation species. |
| [02 · Presentation in 3D](./boards/02-presentation-3d.png), 1440×900 | 208 px Index, dominant Stage, 304 px Card. Available Views are named preview rows, one Default badge; Capture View and Add to Guide are distinct jobs. | Select a View without moving Camera. Capturing makes available inventory only; Add to Guide creates an occurrence. True observer markers remain world anchored. |
| [03 · selected View in Plan](./boards/03-view-plan.png), 1440×900 | Same language on cool Plan ground, selected observer has blue core/gold ring, faithful preview in View Card; Look through is primary. | Marker's dot and bearing come from Camera pose/projection; label displacement has a leader when needed. Make Default changes a role, never local slot order. |
| [04 · Look through](./boards/04-look-through-3d.png), 1440×900 | Explicit persistent Stage inspection control and sole Exit View; through-camera scene occupies Stage; owning View Card shows read-only inspection status. No redundant Put back/Exit button. | Switch inspected Views without overwriting first return. Exit restores initial author standpoint; Card navigation/Back does not strand or silently apply return. |
| [05 · Guide overview](./boards/05-guide-overview-3d.png), 1440×900 | Shallow central green Guide ribbon, four named Stops and View counts, inter-Stop Cut/Travel; summary Card; no global graph, no selected fake first Stop. | Repeated The drive is two occurrences. Presentation inventory remains available independently; opening Guide is a task context. |
| [06 · Stop curation in Plan](./boards/06-stop-plan.png), 1440×900 | Stop identity + source Presentation door; only this Stop's ordered preview rows, dwell and internal movement; next destination/entry below; ribbon stays shallow. | First slot is local entry; reorder does not change Presentation Default. Stage shows actual selected Stop View observers, not independent Stop nodes. Output remains free inventory. |
| [07 · direct Guide reorder](./boards/07-reorder-guide.png), 1440×900 | Insertion line and grabbed chip on the existing ribbon; contextual menu supplies Open Presentation/Move/Remove; no permanent per-chip action clutter or Edit Guide popover. | Release is one reorder command/Undo; Escape cancels. Keyboard Move invokes same operation. Legacy explicit Next cannot masquerade as adjacent linear continuation. |
| [08 · Travel/path in Plan](./boards/08-movement-path-plan.png), 1440×900 | Owning Stop identity, Movement heading, actual named endpoints, Cut/Travel and shared-path reach; direct point handles; one compact Stage instrument above ruler. | Cut creates no edge. Travel explicitly reuses/prepares direct Camera support. Add is armed; ordinary click does nothing. Generated endpoints are not authored points. No topology Deck. |
| [09 · playback from outside](./boards/09-playback-3d.png), 1440×900 | Compact bounded hold/Travel/hold axis, Play/Pause, derived clock and explicit Follow off. Evaluated rig visible on the Stage; no Cue writer or station list. | Read-only playback uses Experience mapping over Camera evaluation, invokes no Activities and writes nothing. Dwell is slot-local. Whole-Stop player scope is explicit. |
| [10 · Follow Camera](./boards/10-follow-camera-3d.png), 1440×900 | Same player, sole active Follow toggle on and read-only Stage status; through-camera scene. No separate Journey workspace. | Follow uses the same playhead/invocation and preserves initial author return; turn off restores it. Leaving player pauses/rehosts exit on Stage. Editing path pauses playback. |
| [11 · visitor entry](./boards/11-visitor-entry.png), 1440×900 | Museum fills window, restrained museum identity, Start guided tour / Explore freely, one Exit Preview; no authoring panels/grid/markers. | Real isolated visitor runtime; choices select distinct contexts. No Guide skips this chooser and enters free exploration directly. |
| [12 · guided visitor](./boards/12-visitor-guided.png), 1440×900 | Content title, quiet local progress and View choice/Pause; distinct large Next · Materials action and Previous stop; no author terms or Stop IDs. | Main Next leaves Stop. Local pager selects included Views; final View waits. During an early skip, action says Next now and Cuts explicitly. Last Stop says Finish. |
| [13 · free visitor](./boards/13-visitor-explore.png), 1440×900 | Museum scene with named viewpoint tray and Browse museum; no Guide progression controls; Output visible. | Omitted guided Views remain eligible. Direct explicitly available Camera Path or Cut only; no automatic shortest-path graph route. |
| [14 · narrow Stop](./boards/14-narrow-stop.png), 1024×768 | 64 px locator, single 288 px Card, same local sequence and central ribbon with internal overflow. Body scrolling is allowed; identity stays recoverable. | No sideways page overflow; no automatic Camera navigation on panel changes. All operations have keyboard alternatives. |
| [15 · narrow movement](./boards/15-narrow-movement.png), 768×900 | Full Stage, one invoked Card sheet, bounded movement instrument and clear ruler/axis. Sheet/instrument do not become an opaque full-screen technical dashboard. | Inventory and Card sheet replace each other. Explicit point edit and Back remain reachable; source and Camera stay unchanged by opening/collapsing sheets. |

The common example has four Stops: Gallery light → The drive → Materials → The
drive. The drive's available Views are Overview (Default), Inside and Output;
Stop 2 uses Overview/Inside while Output remains in free inventory. Overview hold
4.0 s + Travel 2.6 s + Inside hold 5.0 s = a derived 11.6 s Stop playback. Materials
entry is Close-up; the nominal outgoing Travel takes 3.2 s. These numbers
communicate timing structure, not hard-coded production durations.

## Supersession of earlier boards

All eight PNGs in [the retained V2 Design-QAs](../integrated-experience-authoring/Design-QAs/)
are **historical comparison evidence** for #114's former target. V3 proposes:

| Earlier board | Candidate successor / retained lesson |
|---|---|
| QA 1 Camera Path | 08/15; retain evaluated route + point editing, replace From/topology lane and workspace split |
| QA 2 Journey | 09/10; retain time over Camera/holds, replace Cue-first Card and broad lane |
| QA 3 Presentation/Views | 01–04; retain inventory/Default/explicit inspection, replace semi-spatial markers and primary precision/deferred writers |
| QA 4 Guide/Stops | 05–07/14; retain horizontal order and occurrence identity, replace independent Entry/Next forms, numbered Stop pins and separate order popover |
| QA 5 Scene subject | 01/02 creation flow plus written subject rules; Present this/usage remain useful, capability writers are deferred |
| QA 6 Visitor | 11–13; retain full takeover/Exit/semantic choices, add explicit guided/free entry and local-vs-Stop progression |
| Camera precision Outside/Through | 03/04 + written Adjust View procedure; retain truthful observer/explicit return lesson, defer detailed precision acceptance |

## Reproduce and inspect

From the repository root, with `agent-browser` and Python 3 installed:

```sh
bash prototypes/experience-ux-v3/scripts/capture.sh
# Or regenerate only the boards whose static source changed:
bash prototypes/experience-ux-v3/scripts/capture.sh 06-stop-plan 14-narrow-stop
```

The script serves the repository on an available localhost port, uses the
task-owned `experience-v3` named session and closes its browser/server through
`trap` on success, failure and interruption. It does not attach to user browsers.
Only this package's candidate PNGs are regenerated. Its compositor loads the
existing vendored Three module; it makes no font/image network request.

[boards.html](./boards.html), [specimens.js](./specimens.js) and
[specimens.css](./specimens.css) are the editable visual source.
[Review record](./review.md) states captures/checks, limits and the source hash.
Generated pixels cannot authorize implementation or substitute for actual runtime
interaction/visual acceptance.
