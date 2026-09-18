# Museum docs — context router

**Audience:** agents + humans.
**Bootstrap:** [`../AGENTS.md`](../AGENTS.md) ·
**Plan status / what's next:** [`roadmap/README.md`](./roadmap/README.md) ·
**Live working-tree state:** [`operations/current.md`](./operations/current.md) ·
**Roadmap gate:** P12, core P3B, P14, P15, P16, P17, P18, P19, P20, P21, and P22 are shipped. **P23 is in flight** (P23.0–P23.13 landed; P23.14 → P23.15 → P23.16 remaining). P3B.7b remains deferred and non-blocking; P13 remains proposed/unscheduled.

## Context discipline (progressive disclosure)

Do not preload the documentation tree. Start here, identify the task surface,
then read **only the referenced documents required for that task**.

> Stop reading once the routed files answer the task. Do not recursively scan adjacent documentation merely because it exists.

### Reading depths

```text
L0 — ROUTING
Read AGENTS.md + docs/README.md.

L1 — NORMAL TASK
Read only:
- routed roadmap manifest if relevant;
- active phase/slice manifest;
- active plan;
- directly affected reference contracts.

L2 — BOUNDED INVESTIGATION
Search exact terms/symbols/paths.
Open only matching docs/code needed to resolve question.

L3 — DEEP EXPLORATION
Allowed only when:
- user explicitly requests deep research/audit;
- a bug remains unresolved after bounded investigation;
- active plan requires a harvest/spike;
- architecture cannot be resolved from routed current authority.

Never escalate automatically because more documents exist.
```

For code implementation, this rule applies to docs first. Normal code search may
inspect required source files; avoid broad repository archaeology without a reason.

## Truth precedence — when live docs conflict, highest wins

```text
source code + tests      → enforced reality
operations/current.md    → current working-tree state (uncommitted)
active plan              → intended current change
component contract       → stable subsystem behavior
reference/architecture.md → ownership / boundaries
reference/north-star.md  → product direction
archive/                 → rationale only (opt-in)
```

Two separations: **status authority** (what's next) is the roadmap tracker's job, not
this chain's; **direction/priority conflicts are owner decisions**, not doc
conflicts — never "resolve" a product question by doc order.

## Decide what to read

| Task | Read |
|------|------|
| What's next? | [`roadmap/README.md`](./roadmap/README.md), then STOP |
| Implement current slice | [`roadmap/README.md`](./roadmap/README.md) → phase README → slice README → implementation plan |
| Architecture/ownership question | [`reference/architecture.md`](./reference/architecture.md) |
| Current subsystem behavior | `reference/components/<surface>.md` |
| Current product direction | [`reference/north-star.md`](./reference/north-star.md) |
| Current worktree/handoff | [`operations/current.md`](./operations/current.md) |
| Known bug / tech debt | [`operations/tech-debt/`](./operations/tech-debt/) |
| Design current slice | slice README → routed design files |
| Research current slice | slice README → routed research files |
| Historical rationale | [`archive/`](./archive/) (opt-in; nothing here is current truth) |

## Folder map

```text
docs/
  README.md              ← this router (navigation, rules, meta)
  reference/             ← what is true now (durable truth)
    architecture.md      ← ownership / boundaries
    north-star.md        ← final product vision
    components/          ← one contract per surface
    design-system/       ← canonical UI/design contracts + visual registry
  roadmap/               ← what are we changing, and what comes next
    README.md            ← status authority (current phase/slice/next)
    p23-layout-depth/    ← active phase
    p24-scene-staging/   ← proposed phase
    p25-experience/      ← proposed phase
    p26-spatial-depth/   ← research-stage phase
    backlog/             ← proposed/unscheduled (P13, branch rejoin)
    model-assessment.md  ← per-increment model routing
  operations/            ← what is happening right now
    current.md           ← live working-tree delta (baton, not history)
    tech-debt/           ← deferred defects (reproduced + diagnosed)
  archive/               ← why did old work happen (opt-in evidence only)
```

**Archive:** live routers never treat archived material as authority. Enter only
when the task explicitly requires historical rationale.

## Product surface

| Route | Role |
|---|---|
| `/` | Public entry (start creating guest project, or continue with Google) |
| `/editor` | Compatibility redirect → `/project/:id/spatial` |
| `/projects` | Project Hub (owned cloud project list for authenticated creators) |
| `/project/:id/spatial` | Spatial workspace (Scene · Camera × Plan · 3D) |
| `/project/:id/publish` | Publish surface (owner-only status, publish/update/unpublish) |
| `/p/:publicationId` | Public visitor route (cold release bootstrap, no auth) |
| `/project/:id/preview` | Visitor Preview takeover (transient snapshot, no save required) |
| `/museum` | Frozen Chopin visitor relic (checked-in `chopin-project.json`) |
| `/museum/editor` | Frozen legacy editor relic (Scene · Camera, no Layout) |
| `/dev/materials` · `/dev/assets` · `/dev/perf` | Development previews / G3 harness |

The editor boots into a fresh empty project; no Chopin/legacy state is loaded
or migrated. Guest/local work lives in the browser session with portable
export/import. Authenticated cloud work adds owned Save/Load with a project
list and versioned saves.

## Read what you need

| Surface | Contract doc | Key source |
|---------|--------------|------------|
| Shell / workspaces / timeline | [`reference/components/shell.md`](./reference/components/shell.md) · [`reference/design-system/design-shell-specs.md`](./reference/design-system/design-shell-specs.md) (+ per-domain [`reference/design-system/shell-scene-workspaces.md`](./reference/design-system/shell-scene-workspaces.md) / [`reference/design-system/shell-camera-workspaces.md`](./reference/design-system/shell-camera-workspaces.md)) | `apps/editor/src/lib/editor/app/` |
| Scene entities / materials / lights | [`reference/components/scene-content.md`](./reference/components/scene-content.md) | app-local `src/lib/content/` facades |
| Gizmo / placement / transforms | [`reference/components/placement.md`](./reference/components/placement.md) | `apps/editor/src/lib/editor/gizmo/` |
| Camera / tour / motion | [`reference/components/camera-tour.md`](./reference/components/camera-tour.md) | `packages/camera-core/src/` · visitor components in `apps/museum/src/lib/museum/navigation/` |
| Persistence / schema / history | [`reference/components/persistence.md`](./reference/components/persistence.md) | `packages/project-model/src/` · `packages/layout-core/src/` · app facades |
| Scene codec internals | [`reference/components/scene-codec.md`](./reference/components/scene-codec.md) | `packages/project-model/src/scene-codec/` · app facade |
| Assets / catalogue | [`reference/components/assets.md`](./reference/components/assets.md) | app-local `src/lib/content/assets.ts` |
| Themes | [`reference/components/theme.md`](./reference/components/theme.md) | `theme.svelte.ts` + `styles/tokens.css` |
| Tests | [`../apps/editor/tests/README.md`](../apps/editor/tests/README.md) | |

Docs = WHAT is true + WHERE truth lives. Skills = HOW to perform an occasional
workflow (see `.agents/skills/`; most valuable first: `slice-closeout`).

## Meta — how to write the handoff and the next plan

**Handoff (`operations/current.md`)** — strict template, live delta only:

```text
## Working tree    — what is in the tree right now (uncommitted)
## Next action     — tracker pointer + immediate artifact + any gate
## Verification    — test count, svelte-check, build state
## Known bugs      — live defects, one line each
## Traps           — terse gotchas that cost debugging time
## Non-negotiables — relic frozen, no commits unless asked, visitor purity
```

Lifecycle: on **slice open**, update Working tree + Next action. On **slice
close**, follow `.agents/skills/slice-closeout/SKILL.md`: verify acceptance,
update affected reference contracts, write closeout evidence, mark slice shipped
in phase README, advance `roadmap/README.md`, update `operations/current.md`,
archive the completed bundle when appropriate, prune transients, repair links,
verify no live router treats archived material as authority.
**Shipped narrative → archive, never current** (archive owns history).

**Sliding window:** `current.md` references only the **immediate previous slice**
(one back-pointer) and the **single next action** — never enumerate shipped
slices or the full plan sequence. History is chased backward through the phase
README and each archived plan's own prerequisites; archaeology follows the chain,
it is not pre-loaded. Keep **Known bugs** / **Traps** bounded — delete entries
when resolved or deferred elsewhere.

**Next plan** — file `docs/roadmap/<phase>/YYYY-MM-DD-P<number>-<slug>.md` — the
P-number is assigned on registration and carried in the filename; the roadmap
tracker ([`roadmap/README.md`](./roadmap/README.md)) owns its status, order, and
depends-on. Before implementing any increment, write a brief covering: (1) user
outcome and out-of-scope behavior, (2) source components and existing APIs to
reuse, (3) new props/state/dependencies, (4) mount/unmount and selection
semantics, (5) exact acceptance tests and manual scenarios, (6) relic/Plan/visitor
boundaries, and (7) rollback or fallback split if the increment expands.

## Update rules

- Contract change → matching `reference/components/*.md` or `reference/architecture.md`.
- Plan status / order → [`roadmap/README.md`](./roadmap/README.md) (tracker).
- Working-tree delta → `operations/current.md`.
- Direction / priority change → owner decision, recorded as a scope decision
  and reflected in the tracker.
- Archive reference → only this router's link + phase README stubs; never explain
  what is archived inline.
