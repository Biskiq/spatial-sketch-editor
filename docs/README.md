# Museum docs — context router

**Audience:** agents + humans.
**Bootstrap:** [`../AGENTS.md`](../AGENTS.md) ·
**Plan status / what's next:** [`roadmap/README.md`](./roadmap/README.md) ·
**Live working-tree state:** [`operations/current.md`](./operations/current.md) ·
**Roadmap gate:** P12, core P3B, P14–P22 shipped. **P23 in flight.**
P3B.7b deferred non-blocking; P13 proposed/unscheduled.
See tracker for P-level pipeline/order.

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

Two separations: **P-level status** is the roadmap tracker's job (slice status
lives in phase/slice READMEs), not this chain's; **direction/priority conflicts are owner decisions**, not doc
conflicts — never "resolve" a product question by doc order.

## Where truth lives

```text
reference = landed truth
roadmap = future work
operations = live work
archive = history
```

| Need | Read | Code |
|------|------|------|
| What's next? | [`roadmap/README.md`](./roadmap/README.md), then STOP | — |
| Architecture / ownership | [`reference/architecture.md`](./reference/architecture.md) | — |
| Product direction | [`reference/north-star.md`](./reference/north-star.md) | — |
| Product routes | [`reference/architecture.md`](./reference/architecture.md) §Product routes | — |
| Shell / workspaces / timeline | [`reference/components/shell.md`](./reference/components/shell.md) · [`reference/design-system/design-shell-specs.md`](./reference/design-system/design-shell-specs.md) (+ per-domain [`reference/design-system/shell-scene-workspaces.md`](./reference/design-system/shell-scene-workspaces.md) / [`reference/design-system/shell-camera-workspaces.md`](./reference/design-system/shell-camera-workspaces.md)) | `apps/editor/src/lib/editor/app/` |
| Scene entities / materials / lights | [`reference/components/scene-content.md`](./reference/components/scene-content.md) | app-local `src/lib/content/` facades |
| Placement / transforms | [`reference/components/placement.md`](./reference/components/placement.md) | `apps/editor/src/lib/editor/gizmo/` |
| Camera / tour / motion | [`reference/components/camera-tour.md`](./reference/components/camera-tour.md) | `packages/camera-core/src/` · visitor components in `apps/museum/src/lib/museum/navigation/` |
| Persistence / schema / history | [`reference/components/persistence.md`](./reference/components/persistence.md) | `packages/project-model/src/` · `packages/layout-core/src/` · app facades |
| Scene codec internals | [`reference/components/scene-codec.md`](./reference/components/scene-codec.md) | `packages/project-model/src/scene-codec/` · app facade |
| Assets / catalogue | [`reference/components/assets.md`](./reference/components/assets.md) | app-local `src/lib/content/assets.ts` |
| Themes | [`reference/components/theme.md`](./reference/components/theme.md) | `theme.svelte.ts` + `styles/tokens.css` |
| Current worktree | [`operations/current.md`](./operations/current.md) | — |
| Tech debt | [`operations/tech-debt/`](./operations/tech-debt/) | — |
| Tests | [`../apps/editor/tests/README.md`](../apps/editor/tests/README.md) | — |
| History | [`archive/`](./archive/) (opt-in; nothing here is current truth) | — |

```text
IMPLEMENT: roadmap → phase → slice → plan
DESIGN: phase/slice README → routed design
RESEARCH: phase/slice README → routed research
STOP: task answered
```

**Archive:** live routers never treat archived material as authority. Enter only
when the task explicitly requires historical rationale.

Docs = WHAT is true + WHERE truth lives. Skills = HOW to perform an occasional
workflow (see `.agents/skills/`; most valuable first: `slice-closeout`).

## Meta — how to write the handoff and the next plan

**Handoff (`operations/current.md`)** — strict template, live delta only:

```text
## Working tree    — what is in the tree right now (uncommitted)
## Next action     — phase README pointer + immediate artifact + any gate
## Verification    — test count, svelte-check, build state
## Known bugs      — live defects, one line each
## Traps           — terse gotchas that cost debugging time
## Non-negotiables — relic frozen, no commits unless asked, visitor purity
```

Lifecycle: on **slice open**, update Working tree + Next action. On **slice
close**, follow `.agents/skills/slice-closeout/SKILL.md` (procedure lives there).

**Sliding window:** `current.md` references only the **immediate previous slice**
(one back-pointer) and the **single next action** — never enumerate shipped
slices or the full plan sequence. History is chased backward through the phase
README and each archived plan's own prerequisites; archaeology follows the chain,
it is not pre-loaded. Keep **Known bugs** / **Traps** bounded — delete entries
when resolved or deferred elsewhere.

**Next plan** — the slice README owns the exact plan path; the phase README
owns child order/status. Before implementing any increment, write a brief
covering: (1) user outcome and out-of-scope behavior, (2) source components
and existing APIs to reuse, (3) new props/state/dependencies, (4)
mount/unmount and selection semantics, (5) exact acceptance tests and manual
scenarios, (6) relic/Plan/visitor boundaries, and (7) rollback or fallback
split if the increment expands.

New phase → folder + README; discovery/design as needed; umbrella marks
transition to build program.

## Update rules

- Contract change → matching `reference/components/*.md` or `reference/architecture.md`.
- P-level status / order → [`roadmap/README.md`](./roadmap/README.md) (tracker);
  slice status/order → owning phase README.
- Working-tree delta → `operations/current.md`.
- Direction / priority change → owner decision, recorded as a scope decision
  and reflected in the tracker.
- Archive reference → only this router's link + phase README stubs; never explain
  what is archived inline.
