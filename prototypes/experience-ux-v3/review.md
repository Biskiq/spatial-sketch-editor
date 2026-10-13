# Experience V3 — package self-review

**Status: SUPERSEDED historical UX3/V3 specimens (#114, 2026-10-13).**
The owner accepts [interactive Conservatory](../experience-ux-alternative/README.md);
[PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md)
owns current UX acceptance. These 15 PNGs, compositor and original notes are
preserved provenance, not pixel/layout-equivalence or implementation gates.
The standalone V3 plan is inactive; no generation or runtime changes are needed.

**Original specimen/review notes follow as history**, including their former
pending-ratification and acceptance language.

**Proposed design package, 2026-10-13; no owner ratification or runtime acceptance.**
Source inspection used fetched PR #114 head
`de41341e82f4a745abe85537c59a217c160c60f3`. No application UI/runtime was changed.

## Visual production and review

- 15 PNGs rendered with the static specimen compositor in a task-owned
  agent-browser session: thirteen 1440×900 desktop states, one 1024×768 Stop
  state and one 768×900 movement state. Full-size images were visually inspected.
- One gallery and per-board acceptance notes cover all nine requested concerns,
  plus meaningful Guide-reorder, Follow, visitor and narrow variants.
- The museum is the same illustrative fixture in Plan, 3D, thumbnail and visitor
  boards. Camera observers/bearings project from that fixture, with no compressed
  world positions. Path vertices are illustrative; actual implementation must use
  Camera evaluation.
- Review corrected duplicate Exit controls, a false selected owner row, weak
  visitor-brand contrast, a visible visitor grid, inaccessible clipped Card
  content and a mismatched illustrated playhead/Follow framing. Active displacement
  has one writer home, related context is green, Card bodies scroll, and both
  playback views show the Inside hold at 0:09.2 of 0:11.6.
- Runtime screenshots and all eight older Design-QAs remain unchanged. New images
  have specimen watermarks; they are not functional or owner-acceptance evidence.

## Product and implementation self-review

Independent product critique was folded into the owning proposal/plan sections:
explicit Guide execution metadata, atomic whole-Guide conversion, no silent mixed
mode, settled forward adjacency versus in-flight/backward Cut, explicit Finish
rather than automatic completion, Previous stop cancellation/fresh paused visit,
fixed Default-derived seeds and one persistent inspection return. All new model
relationships are marked proposed prototype shapes, not production codecs.

The source audit distinguishes reuse/adaptation/new/runtime/UI-only work. Six
implementation slices carry dependencies and meaningful exits. One realistic
creator path, representative visual captures and essential source/Camera/isolation
checks replace automatic broad/mutation acceptance chains. Old evidence is preserved;
its tests do not validate V3 visual conformance.

## Checks performed

| Check | Result |
|---|---|
| PNG signature, count and dimensions | 15/15 valid; thirteen desktop, two narrow as specified |
| JavaScript, shell and Python source syntax | Passed (`node --check`, `bash -n`, Python AST parse) |
| Palette text/Camera contrasts | Main text 14.60:1; muted text 6.14:1; white on action green 6.38:1; gold on deep forest 7.90:1; Camera blue on Plan 5.30:1; light Camera blue on mat 6.26:1 |
| Repository Markdown gate including new staged files | 22/22 passed; relative links, written paths and anchors resolve |
| Whitespace and application/evidence boundary | `git diff --check` passed; no application/runtime, old PNG or before/runtime capture mutations |
| Browser/server cleanup | Task-owned capture session and localhost server closed; no user browser attached |

Contrast values cover the named role pairs, not a claimed full accessibility
certification. Static render checks prove artifact delivery/fit, not working
product interactions. Existing C9/UX functional test totals were inspected as
historical evidence, not rerun or claimed for this design-only change. No full
prototype, production regression or mutation sweep ran.

## Reproduction provenance

The [manifest](./manifest.json) records dimensions and SHA-256 for every PNG.
Core compositor hashes at delivery:

| Source | SHA-256 |
|---|---|
| `boards.html` | `a7a2515e48d50778536e055de2e8405d4b1b70ed4075c05c5f5a941fc18325ca` |
| `specimens.js` | `5a197bcb02f079624233ef6fbebea5087de1357eefe2bd74a6881dde8d68417e` |
| `specimens.css` | `f443a5021d36f43066366169bdbf6762921d0bc7c60b3f4e2a12d039475cc9f9` |

See the [board package](./README.md) for capture commands/lifecycle and the
[reconciliation record](../../docs/roadmap/p25-experience/design/experience-ux-v3/reconciliation.md)
for route and historical disposition. Owner ratification of the recommended
Stop-local model and visitor progression cutoff remains the next step.
