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
- Experience authoring follows [AM-11](../../docs/reference/components/experience.md#current-authoring-and-runtime-contract):
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

## Browser QA

Focused agent-driven manual browser QA is allowed: open the app, exercise the changed interaction,
inspect rendering and console errors, and capture targeted evidence where it helps review. Do not
require full Playwright capture, exhaustive browser journeys, scripted E2E replay or bulk
screenshots/video for ordinary changes; those need explicit owner authorization. The owner keeps
final manual browser acceptance. Unit, integration, contract, geometry, typecheck and build checks
remain the routine gate.
