# Agent context — Personal / Museum

**Start:** [documentation router](./docs/README.md), [development](./README.md#development)
and `npm run status`. Code and tests establish behavior, approved designs set scoped targets,
reference contracts state invariants, and the North Star sets intent. Read the smallest relevant
contract. Historical evidence stays in the archive.

**Read when relevant:** [workflow](./docs/workflow.md), [focus](./focus.md), [glossary](./docs/glossary.md),
[path map](./docs/path-map.md), [prototype catalogue](./prototypes/README.md),
[composition and current formats](./docs/reference/composition-execution.md),
[persistence](./docs/reference/components/persistence.md), [test contract](./apps/editor/tests/README.md),
[CI and merge automation](./docs/operations/ci-merge-automation.md).

## Hard rules

1. **One Camera authority.** Camera owns connectivity, routes, framing, projection and evaluation.
   Guided travel, free look, reduced motion, film and future XR evaluate through it. Experience
   owns occurrences, order, holds and pacing and maps invocation time through Camera. One
   navigation graph and evaluator serve all profiles. Route and motion algorithms are replaceable.
2. **Distinct semantic authorities.** Layout owns architecture, levels, placed structures,
   reusable definitions and validated alternatives. Scene owns object composition, placed instances
   and world presentation. Camera owns views and navigation. Experience owns visitor composition.
   Typed resources are independently versioned. F2 carries separate Layout, Camera-free Scene,
   Camera, Experience and typed resource units. Use world-local placement with explicit internal
   frames. A Room frame is optional.
3. **Authored truth.** Persist interior connection anchors only. Generate node-view endpoints at
   runtime. Generated geometry, Three objects, renderer handles, selection and history stay
   outside authored data. Immutable reproducible delivery derivatives can include generated
   Camera endpoints.
4. **Visitor isolation.** The product serves `/` and `/editor` without build-flag gating.
   `/p/[publicationId]` and releases serve visitors. Their imports and chunks exclude editor
   sessions, selection, history, gizmos, layout UI and authoring infrastructure. Runtime-safe
   domain evaluators are shared. `visitor/*`, public-surface and preview-surface contracts enforce
   isolation. Frozen independent projects, including `/museum` and `/museum/editor`, are outside
   this repository and its product routes, imports and tests.
5. **One architectural compiler.** Layout-owned representation and runtime-safe algorithms
   consume its output. Release lowering may derive shared kernel dataflow. Prefer Floor, Wall and
   Ceiling planes.
6. **One persisted version per format before beta.** Bump the version for format changes and
   update fixtures with it. Reject other versions at the owning codec with
   `unsupported_format_version`. Keep version-refusal coverage in the codec suite for each family.
7. Use Svelte 5 runes and Threlte patterns.
8. Commit only when asked. Keep agent attribution and co-author trailers out of commit messages.
9. **Scope limits mutation and preserves verification.** Inspect callers, wiring, adjacent code,
   tests and dependents. Report required edits outside authorized scope. Follow the owning test
   contract for local and integration gates.

## Locality

- One operation family per module. Group the operations that share inputs, outputs and invariants,
  with their private helpers. One planner registry per authority maps kinds to family modules.
- Files target 600 lines with a hard cap of 800. Functions, including closure factories, target
  200 lines. Ratchet [budget exceptions](./tools/metrics/budgets.json) down as work lands.
  An addition needs a reviewed one-line reason for a data table or a cohesive algorithm whose
  phases share mutable state.
- Split at real seams. Avoid pass-through modules, single-implementation interfaces, long
  parameter lists or carrier state used by one operation.
- Observe kernels through optional per-call observers in existing options. Keep test-only
  seams out of production.
- Comments explain current invariants, mathematical reasoning and tolerances. Leave roadmap
  history in Git.
- Mirror tests to workspace families or features. Preserve independent reference oracles,
  distinct invariants and call-site proofs. Use the test contract for deletion.

## Verification and workflow

Root `dev`, `check` and `build` target the editor. Root Vitest covers editor and package
projects. The API has separate `dev:api`, `check:api`, `build:api` and DB-backed `test:api`
commands. Focused manual browser QA is welcome for affected interactions. The owner retains
final manual browser acceptance.

Follow the owner-committed focus and holds. Check claims and flags through the workflow.
Use the highest applicable risk tier. Ordinary changes get fresh-context review. Tier 1
adds a later owner checkpoint. Tier 2 needs an owner decision before merge. Plan multi-PR,
Tier 2 and invention-risking work in the first commit of its draft PR. Merge closes the work.

The native queue integrates green PRs once activated. Keep sibling branches and CI runs
independent. `work-checkpoint`, `owner-checkpoint`, `gardener` and `breaker` run on demand.
