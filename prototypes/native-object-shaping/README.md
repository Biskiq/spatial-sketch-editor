# Native object shaping — Shape focus

**Status:** proposed, implementation-ready prototype UX design; not production
ratification. This workspace evolves the retained Living Drawings, Native Form
Lab and Vellum evidence. It does not contain a functioning shaping prototype.

**Hub:** [retained prototypes and design evidence](../README.md).

Start with the [Shape focus UX specification](./UX-SPEC.md). It converges on one
experience: create and compose a native object in the Scene, then refine the same
placed body through linked drawing and spatial views. Temporary cross-sections,
visible reach and kept regions make the effect of a precise contour change
reviewable before acceptance.

The specification defines the creative workflow, interaction states, precision
rules, preservation and relationship behavior, geometric assumptions, refusal
states, walkthroughs and prototype acceptance criteria. Implementation and review
must still establish geometric robustness, creator comprehension and production
integration. The existing production contracts remain authoritative.

The [earlier exploration](./exploration-proposal.md) is retained as superseded
rationale. Its competing-direction program is not the next implementation brief.

## Visual states

These are authored illustrations of the proposed UX, not screenshots of an
implemented product. The PNGs are embedded beside the relevant specification
sections; the SVGs retain editable vector sources.

| State | Preview | Vector source |
| --- | --- | --- |
| Create in the Scene | [PNG](./figures/01-create.png) | [SVG](./figures/01-create.svg) |
| Adjust the selected object | [PNG](./figures/02-scene.png) | [SVG](./figures/02-scene.svg) |
| Enter Shape focus | [PNG](./figures/03-focus.png) | [SVG](./figures/03-focus.svg) |
| Redraw within a visible reach | [PNG](./figures/04-redraw.png) | [SVG](./figures/04-redraw.svg) |
| Retain and explain an invalid draft | [PNG](./figures/05-refusal.png) | [SVG](./figures/05-refusal.svg) |
| Return to the same Scene | [PNG](./figures/06-return.png) | [SVG](./figures/06-return.svg) |

The dependency-free [Python generator](./figures/draw_states.py) regenerates the
SVGs with `python3 prototypes/native-object-shaping/figures/draw_states.py` from
the repository root. The checked-in PNGs are 1440 × 850 raster exports of those
SVGs; when editing figures, regenerate both formats. This generator is an
illustration aid, not prototype geometry or a proposed production renderer.

## Review focus

- Whether Scene creation, Shape focus and return feel like one continuous act
  of editing the same object.
- Whether temporary sections, Local/Throughout reach and kept material regions
  make each revision predictable without introducing a retained loft editor.
- Whether the admitted geometry, precision rules and failure behavior are
  sufficiently explicit to implement and assess this prototype honestly.

This package changes no product implementation, persisted format, geometric
kernel choice, release plan or ratified shell contract.
