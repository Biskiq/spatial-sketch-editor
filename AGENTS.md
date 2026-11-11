# Agent context — Personal / Museum

**Bootstrap:** [`docs/README.md`](./docs/README.md) (router). **Human start:**
[`README.md`](./README.md#first-ten-minutes). **Status:** `npm run status`.
**Workflow:** [`docs/workflow.md`](./docs/workflow.md) (claims, flags, risk tiers, plans).
**Focus:** [`focus.md`](./focus.md). **Glossary:** [`docs/glossary.md`](./docs/glossary.md).
**Path map:** [`docs/path-map.md`](./docs/path-map.md).

For product truth, read the smallest routed contract or area context that answers the task. Code and
tests state current behavior; reference contracts and approved designs state invariants and targets;
the North Star states intent. Do not read the archive unless current evidence needs it.

## Repo facts

- npm workspaces; apps are `@portfolio/editor` and `@biskiq/api`; shared packages are
  `@portfolio/layout-core`, `@portfolio/project-model`, `@portfolio/camera-core` and
  `@portfolio/geometry-core`. PR #115 removed `apps/museum`, superseded by the separately hosted
  frozen project.
- `prototypes/` holds durable runnable prototypes and their QA/reference evidence
  ([`prototypes/README.md`](./prototypes/README.md)). They are **not** npm workspaces, not
  production applications and not authority — a prototype shortcut never becomes a production
  contract by being kept there.
- “Camera” = **3D guided PerspectiveCamera navigation**, not webcam.
- **Frozen, separate projects are outside product scope.** The Chopin museum project was externalized
  by PR #115: it is independently hosted and versioned, the folder is absent from this repository,
  and no product file imports, aliases or references it. Product rules, authorities and tests do not
  apply to such a project, and the product's public routes never serve it.
- Root `dev` / `test` / `build` / `check` target the editor app only; the API has its own `dev:api` /
  `build:api` / `check:api` / `test:api` scripts, which root `build` and `check` never run.

## Hard rules

1. **One Camera authority** — one authority for connectivity, routes, framing, projection and
   evaluation; every profile controller (guided travel, free look, reduced motion, film, future XR)
   realizes viewing intent through it, and no second navigation graph, evaluator, or independent
   pose/FOV interpolation exists. Experience owns editorial occurrences, order, holds and pacing;
   invocation time mapping evaluates through Camera. The current `camera-route.ts` +
   `camera-motion.ts` mechanism and its curve/guard model are replaceable implementation, not the
   guarantee, and "one motion" does not mean one motion kind.
2. **Distinct, never-merged semantic authorities** — Layout owns architecture (including levels,
   placed structures, reusable definitions and validated alternatives); Scene owns object
   composition, placed instances and world presentation; Camera owns views, routes, framing,
   projection and evaluation; Experience owns visitor-facing composition and editorial occurrences;
   typed resources form their own independently versioned system. Never hide a new domain inside
   another document. World-local project placement with explicit internal frames; no mandatory Room
   frame. The landed F2 encoding is separate Layout, Camera-free Scene 6, Camera 1, Experience 4 and
   resources 2 units. Camera data inside `project.scene` was the pre-cutover encoding (historical, not
   the destination); the separate Camera unit is the landed split.
3. **Authored truth excludes generated/render/session state** — authored connection anchors are
   interior only; node-view endpoints are generated at runtime, never authored; generated geometry,
   Three objects, renderer handles, selection and history are never serialized. Immutable,
   reproducible delivery derivatives (compiled release payloads) are explicitly permitted outside
   authored documents; generated Camera endpoints may exist in a compiled delivery descriptor, never
   as a second authored set of connection anchors.
4. **Visitor isolation** — the product serves `/` and `/editor` (no build-flag gating).
   `/p/[publicationId]` and public releases are visitor-only: no editor session, selection, history,
   gizmo, layout UI, or authoring infrastructure in visitor chunks. `/museum` and `/museum/editor`
   are **not product routes**: they belong to the frozen, independently deployed project, which this
   repository neither builds nor serves. Runtime-safe domain evaluators (e.g. Layout representation)
   are shared with visitor runtimes; isolation is about editor machinery, not about forking domain
   math.
5. **Editor helpers stay outside visitor/public imports** — no editor-only module reaches the visitor
   or published surface (`visitor/*` and `public-surface-boundary` own it; a bespoke
   `MuseumScene.svelte` in the preview surface is refused by `preview-surface-boundary`).
6. **No second authority** — one canonical architectural compiler; Layout-owned representation and
   runtime-safe algorithms consume its output, and release lowering may derive shared kernel dataflow
   without becoming a second navigation authority or architectural reconstruction. Prefer
   Floor/Wall/Ceiling planes.
7. Svelte 5 runes; Threlte patterns.
8. **No commits** unless the user asks.
9. **Scope limits mutation, not inspection or verification.** For implementation/code tasks, local
   task scope never narrows the repository-level verification required by the applicable test
   contract. Inspect callers, dependents, wiring, tests and adjacent code as needed to establish
   impact. If correctness appears to require a change outside the assigned scope, report it rather
   than making it unless scope is explicitly expanded. Concrete editor commands and lane semantics
   stay owned by `apps/editor/tests/README.md` and are deliberately not duplicated here.
10. **No agent footer in commits** — when asked to commit, the message is the message: never append a
    `Generated with …` line or a `Co-Authored-By: <agent>` trailer for any tool, guide or harness.

## Verification and browser QA

Unit, integration, contract, geometry, typecheck and build checks are the routine default. For a
change whose visual or interaction behavior matters, an agent may open the running application,
interact with the changed feature, inspect rendering and console errors, and capture targeted
evidence. That is **focused manual browser QA**, and it is allowed.

Do **not** require full Playwright capture, exhaustive automated browser journeys, scripted E2E
replay, or bulk screenshot/video recording for ordinary changes. Those need explicit owner
authorization. The owner retains final manual browser acceptance; agent spot checks are evidence,
not a substitute for that acceptance. Historical browser artifacts and unrelated test coverage stay
in place: this policy changes what is *required*, not what is preserved.

Concrete commands and lane semantics stay owned by `apps/editor/tests/README.md`; do not duplicate
them here.

## Workflow

**Status** is computed: `npm run status` prints report provenance, maturity, health, flags and
claims. **Focus and holds** live in [`focus.md`](./focus.md); change that file only by an owner
commit. **Claims** are a draft PR or self-assigned issue whose title names the capability id; check
open issues and draft PRs before and immediately after claiming. **Flags** are issues labelled
`needs-decision`, `needs-ux`, `needs-research`, `ambiguous` or `bug` plus the capability: proceed
only on a reversible default, otherwise pick other work. **Plans** are written only for multi-PR,
Tier 2 or invention-risking work, as the first commit of the work's own draft PR. Merging is the
closeout: no acceptance document, anchor PR, closeout PR or phase-close record.

**Tiers** (highest wins): **Tier 0** ordinary work → one fresh-context review, merge on green CI.
**Tier 1** contract details within the hard rules, visitor/public or shared shell surface, or a
persisted-format change the previous reader can still read (or with a tested recovery) → agent
review, merge on green CI, owner check at the next checkpoint. **Tier 2** hard-rule, North Star,
approved-design or ledger-shape change, incompatible format, check removal, owner review,
production activation, licence or new dependency → owner decides before merge.

On-demand skills: `work-checkpoint`, `owner-checkpoint`, `gardener` (archive-only) and `breaker`.
No schedules. The
full process contract is [`docs/workflow.md`](./docs/workflow.md).
