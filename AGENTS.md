# Agent context — Biskiq

**Start:** [documentation router](./docs/README.md), [approved visual targets](./prototypes/README.md),
[local development](./README.md#development). Read the smallest owning contract. Code and tests
establish landed behavior; approved designs set scoped UX targets; contracts state invariants.

## Core invariants

1. **One Camera authority.** `@portfolio/camera-core` owns Views, connectivity, routes, framing,
   projection and pose/FOV evaluation across every profile; Experience maps invocation time through
   Camera. No second navigation graph, evaluator or pose/FOV interpolation exists.
2. **Distinct semantic authorities.** Layout (`@portfolio/layout-core`, one runtime-safe compiler),
   Camera-free world-local Scene and Camera and Experience and typed resources are separate units in
   the F2 `ProjectEnvelope`. Native Forms are evaluated by `@portfolio/geometry-core`. A new domain
   declares its own unit; it is never hidden inside another document.
3. **Authored truth versus derived state.** Persist semantic source and interior connection anchors
   only. Never serialize generated geometry, node-view endpoints, Three/WebGPU objects, selection,
   gizmos or history. Immutable, reproducible delivery derivatives stay separate.
4. **Visitor and prototype isolation.** `/p/[publicationId]` and visitor Preview share runtime-safe
   evaluators and render layers and exclude editor session, selection, history, gizmos and authoring
   UI (`npm run test:arch`). Production never imports `prototypes/` or externalized `/museum`.
   Frozen `/museum` projects are outside this repository's product routes and tests.
5. **One admitted format version pre-beta.** Bump the owning codec version and regenerate fixtures in
   the same change; reject every other version with `unsupported_format_version`. Keep version-refusal
   coverage per family. `LAYOUT_UNIT_FORMAT_VERSION` is the Layout payload version itself.
6. **Stack and locality.** Svelte 5 runes and Threlte patterns; one cohesive operation family per
   module; `npm run test:arch` and `tools/metrics/budgets.json` hold boundaries and size. Pass
   optional per-call observers rather than production test seams.
7. **Autonomy, verification and Git hygiene.** A prompt or linked issue/PR sets scope; make
   reversible engineering choices directly. Pause for the owner only on invariant/design conflict,
   material UX departure, destructive data/schema action, a new dependency or licence, or gate
   weakening. Verify touched lanes — including `check:api` and zero-skip DB-backed `test:api` for
   API/shared codecs, and the approved visual target on the live Stage for visual work. Commit only
   when asked, with no agent attribution or co-author trailers; never commit single-PR plans or
   closeout reports to `docs/`.

## Routes

| Need | Read |
| --- | --- |
| Domain contracts and planning guidance | [docs/README.md](./docs/README.md) |
| Shared shell and Stage marks | [docs/design-system.md](./docs/design-system.md) |
| Feature layout and states | [prototypes/README.md](./prototypes/README.md) |
| Test lanes and browser QA | [apps/editor/tests/README.md](./apps/editor/tests/README.md) |
| API auth, Save and DB gate | [apps/api/AGENTS.md](./apps/api/AGENTS.md) |
| Local stack | [README.md#development](./README.md#development) |
| Active multi-PR blueprints | [docs/plans/README.md](./docs/plans/README.md) |
| Harness profiles and CI | [tools/harness/README.md](./tools/harness/README.md) |

`broad-research/` holds long-term research quarantined from routine search; read it only for the
specific evidence a task needs.
