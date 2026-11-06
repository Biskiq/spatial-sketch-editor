# Editor area context

**Read first:** root [`AGENTS.md`](../../AGENTS.md) · [`docs/README.md`](../../docs/README.md) ·
[`path map`](../../docs/path-map.md) · [`tests/README.md`](tests/README.md).

**Owns:** the SvelteKit product surface, authoring shell/adjacent Stage work, visitor Preview and
public visitor route, and the editor's tests. Shared domain math belongs to its package.

## Invariants

- One Stage Canvas, one evaluated viewport and one Camera realizer. No `OrbitControls`, second scene
  graph or independent pose/FOV interpolation.
- One canonical selection and one chronological F4 history. Session state is never saved.
- Shell behavior consumes the accepted PLATE roles; do not invent component-local metrics when an
  existing semantic role is equivalent. Preserve coarse-pointer targets and narrow layouts.
- `visitor/*` and public chunks import no editor-only machinery. Runtime-safe domain evaluators may be
  shared; editor session/authoring code may not.
- Experience authoring follows [AM-11](../../docs/reference/composition-execution.md#am-11-guide-pacing-explore-and-return):
  linear Guide order, one entry View/stay per Stop, strip-owned Guide editing, one Camera evaluator.

## Commands

Run from `apps/editor` unless noted:

```sh
npm run check                 # Svelte/TypeScript
npx vitest run <path>         # focused test
npm run test:fast             # inner loop
npm run test:arch             # architecture/docs/isolation gates
npm run build                 # production build when the change warrants it
```

Use the lane and evidence requirements in [`tests/README.md`](tests/README.md), not a generic triad.
