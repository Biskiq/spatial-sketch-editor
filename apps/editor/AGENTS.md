# Editor area context

**Read first:** root [`AGENTS.md`](../../AGENTS.md) · [`docs/README.md`](../../docs/README.md) ·
[`path map`](../../docs/path-map.md) · [`tests/README.md`](tests/README.md).

**Owns:** the SvelteKit product surface, authoring shell/adjacent Stage work, visitor Preview and
public visitor route, and the editor's tests. Shared domain math belongs to its package.

## Composition

- The spatial route is only `createWorkspaceHost` + `<WorkspaceHost>`. Put a capability in its
  feature entry and sub-owners (`src/lib/authoring/<feature>/`), never in the route or host.
- Shared composition changes are declarative: one manifest entry
  (`tests/lib/authoring/integration-ownership.manifest.ts`), the feature's `LIFECYCLE_ORDER` steps,
  its `ESCAPE_LADDER` rung, its `REGION_KEY_OWNER` keys and its declared ports.
- Feature entries compose; they hold no runes, state or helper functions. Sub-owners never import
  a sibling at runtime.
- `npm run test:arch` proves the ownership contract; `integration-ownership.test.ts` is the
  admission check for a new capability.

## Invariants

- One Stage Canvas, one evaluated viewport and one Camera realizer. No `OrbitControls`, second scene
  graph or independent pose/FOV interpolation.
- One canonical selection and one chronological F4 history. Session state is never saved.
- `visitor/*` and public chunks import no editor-only machinery. Runtime-safe domain evaluators may be
  shared; editor session/authoring code may not.
- Experience authoring follows [AM-11](../../docs/reference/components/experience.md#current-authoring-and-runtime-contract):
  linear Guide order, one entry View/stay per Stop, strip-owned Guide editing, one Camera evaluator.

Use the [shared shell grammar](../../docs/reference/design-system/editor-shell-and-visual-system.md)
and the [approved design for the affected feature](../../prototypes/README.md). Reuse equivalent
presentation roles and preserve coarse-pointer targets and narrow layouts.

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

Use [focused browser QA](tests/README.md#browser-qa-policy) for affected behavior and
[design review](../../docs/workflow.md#design-and-reference-maintenance) for approved UX changes.
