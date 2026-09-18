# Museum docs — context router

**Audience:** agents + humans.
**Bootstrap:** [`../AGENTS.md`](../AGENTS.md).

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

Direction/priority conflicts are owner decisions — never resolve a product
question by doc order.

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

```text
CURRENT: transient semantic baton only; inspect Git for branch/HEAD/dirty state.
PLAN: slice README owns plan path; phase README owns child order/status.
PHASE: create README first; umbrella starts build program after discovery/design.
SHIP: use slice-closeout skill.
```

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

```text
UPDATE:
- P-level state/order → roadmap/README.md
- phase/slice state → owning README
- live worktree → operations/current.md
- landed truth → reference/*
- deferred bug → operations/tech-debt/
- slice ship → slice-closeout skill
- direction change → owner decision (scope decision)
- archive pointer → router link + phase stub only
```
