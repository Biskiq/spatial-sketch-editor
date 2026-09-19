# Museum docs — context router

**Audience:** agents + humans.
**Bootstrap:** [`../AGENTS.md`](../AGENTS.md).

## Context discipline (progressive disclosure)

Do not preload the documentation tree. Start here, identify the task surface,
then read **the smallest routed context that can answer the task**.

> A stop point means no additional reading is currently justified — not that
> further investigation is forbidden. Do not preload deeper or adjacent
> documentation speculatively. Expand only when the task, missing information,
> or contradictory evidence requires it.

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
Open only matching docs/code/tests/Git needed to resolve question.

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
reference = current intended system (authoritative but falsifiable — see below)
roadmap = future work
operations = live work
archive = history
```

| Need | Read | Code |
|------|------|------|
| What's next? | [`roadmap/README.md`](./roadmap/README.md), then stop (no source survey) | — |
| Architecture / ownership | [`reference/architecture.md`](./reference/architecture.md) | — |
| Product direction | [`reference/north-star.md`](./reference/north-star.md) | — |
| Product routes | [`reference/architecture.md`](./reference/architecture.md) §Product routes | — |
| Shell **design** — composition, material, typography, control metrics, state language (durable, owner-ratified) | [`reference/design-system/editor-shell-and-visual-system.md`](./reference/design-system/editor-shell-and-visual-system.md) — read §0 first (authority graph · ratification record · open calls); established by the P23.14 slice, which stays under owner review | `apps/editor/src/lib/editor/styles/tokens.css` + `controls.css` |
| Shell / workspaces / timeline — **capability, exposure, ownership** | [`reference/components/shell.md`](./reference/components/shell.md) · [`reference/design-system/design-shell-specs.md`](./reference/design-system/design-shell-specs.md) (+ per-domain [`reference/design-system/shell-scene-workspaces.md`](./reference/design-system/shell-scene-workspaces.md) / [`reference/design-system/shell-camera-workspaces.md`](./reference/design-system/shell-camera-workspaces.md)) — descriptive of the landed shell; their shell dimension/type/control numbers are superseded by the durable shell contract above | `apps/editor/src/lib/editor/app/` |
| Scene entities / materials / lights | [`reference/components/scene-content.md`](./reference/components/scene-content.md) | app-local `src/lib/content/` facades |
| Placement / transforms | [`reference/components/placement.md`](./reference/components/placement.md) | `apps/editor/src/lib/editor/gizmo/` |
| Camera / tour / motion | [`reference/components/camera-tour.md`](./reference/components/camera-tour.md) | `packages/camera-core/src/` · visitor components in `apps/museum/src/lib/museum/navigation/` |
| Persistence / schema / history | [`reference/components/persistence.md`](./reference/components/persistence.md) | `packages/project-model/src/` · `packages/layout-core/src/` · app facades |
| Scene codec internals | [`reference/components/scene-codec.md`](./reference/components/scene-codec.md) | `packages/project-model/src/scene-codec/` · app facade |
| Assets / catalogue | [`reference/components/assets.md`](./reference/components/assets.md) | app-local `src/lib/content/assets.ts` |
| Themes | [`reference/components/theme.md`](./reference/components/theme.md) | `theme.svelte.ts` + `styles/tokens.css` |
| Current work / baton | [`operations/current.md`](./operations/current.md) | — |
| Interrupted work / resume | [`operations/checkpoints/`](./operations/checkpoints/) — transient only; `work-checkpoint` skill owns procedure | — |
| Tech debt | [`operations/tech-debt/`](./operations/tech-debt/) | — |
| Tests | [`../apps/editor/tests/README.md`](../apps/editor/tests/README.md) | — |
| History | [`archive/`](./archive/) (opt-in; nothing here is current truth) | — |

```text
IMPLEMENT: roadmap → phase → slice → plan
DESIGN: phase/slice README → routed design
RESEARCH: phase/slice README → routed research
STOP: no additional reading currently justified
```

**Archive:** live routers never treat archived material as current authority.
Enter only when the task explicitly requires historical rationale, or when
bounded current evidence cannot resolve a material provenance/contradiction
question.

## Progressive project knowledge

The map is intentionally incomplete and grows through normal work:

```text
existing map
→ cheapest relevant starting point
→ enough context?
   ├─ yes → work
   └─ no  → bounded discovery in source/tests/Git
                ↓
             verify
                ↓
       reusable durable knowledge?
          ├─ no → keep task-local / discard
          └─ yes → reconcile / promote into project knowledge
```

The repository is durable memory; the model context window is temporary
working memory. Docs accumulate high-value verified understanding — they do
not mirror or index the source tree.

**Promote** (into the appropriate existing `reference/` doc; new route only
when a recurring reusable concept has actually emerged): subsystem ownership,
architectural boundaries, persisted formats/contracts, reusable
transform/data-flow rules, non-obvious current behavior expensive to
rediscover, owner-approved architectural decisions, stable constraints future
implementation must respect.

**Do not promote:** files merely visited, search/traversal history, guesses or
inferred intent, debugging chronology, temporary implementation details, facts
trivially recoverable from source, proposed future behavior (stays in
roadmap).

**Descriptive vs normative:** agents may record descriptive current-system
facts derived from source/tests (which schema is persisted, which component
owns serialization, what tests enforce). Normative decisions ("there must be
only one nav system", "Layout/Scene ownership stays separate") need support
from existing approved reference/architecture, North Star, an approved
roadmap/design decision, or an explicit owner ruling — never canonize them
from implementation accidents alone. An approved roadmap/design decision is
authoritative within that planned scope; it moves into reference only when it
becomes a landed/current contract.

**Omission over invention:** under-mapping is safer than wrong mapping. The
map may stay partial (`CONFIRMED` / `PARTIAL` / `UNKNOWN` where it materially
aids clarity — no confidence database). Unsupported guesses never become
durable authority.

**Reference is authoritative but falsifiable.** If source/tests/Git
materially contradict a reference claim, determine which case applies:

```text
A. implementation regression → reference remains intended truth → repair implementation
B. legitimate implementation change + stale reference → reconcile reference to current truth
C. ambiguous evidence → do not guess → keep uncertainty explicit / escalate
```

**Ratified design contracts are promoted, not duplicated.** When a slice's ratified
design direction becomes the landed shell/system contract, move it into `reference/`
under a slice-independent name, fold the implementation-era owner ratifications into
the contract itself, leave a supersession pointer at the old slice path, and keep the
slice as its history. One live copy, discoverable from this router — the shell contract
([`reference/design-system/editor-shell-and-visual-system.md`](./reference/design-system/editor-shell-and-visual-system.md),
established by P23.14 and still slice-review-open) is the first instance.

Stale high-authority docs are more dangerous than missing docs — challenge and
reconcile them rather than silently following either side.

**Evidence anchors (selective):** for important non-obvious architectural
claims whose incorrectness would misroute future work, add lightweight
anchors — source path, symbol/export, schema, test, composition root. Not
every sentence needs a citation.

**Completion:** at the end of substantial work ask: did this establish or
change durable knowledge future work would otherwise rediscover? If yes,
reconcile the `reference/` doc, update routing only if necessary, keep
proposals in roadmap, supersede stale claims. If no, change no docs merely
for completeness.

Docs = WHAT is true + WHERE truth lives. Skills = HOW to perform an occasional
workflow (see `.agents/skills/`; most valuable first: `slice-closeout`).

## Meta — how to write the handoff and the next plan

```text
CURRENT: transient semantic baton only; inspect Git for branch/HEAD/dirty state.
INCREMENT / VERIFY: optional current-work fields.
RESUME: interrupted work only → operations/checkpoints/ via work-checkpoint skill.
CHECKPOINT: continue same unit; handoff = start next unit.
PLAN: slice README owns plan path; phase README owns child order/status.
PHASE: create README first; umbrella starts build program after discovery/design.
SHIP: use slice-closeout skill.
```

## Update rules

```text
UPDATE:
- P-level state/order → roadmap/README.md
- phase/slice state → owning README
- current work baton → operations/current.md
- interrupted resumable work → operations/checkpoints/ via work-checkpoint skill
- landed truth → reference/* (reconcile; supersede stale claims, never silently promote roadmap proposals)
- deferred bug → operations/tech-debt/
- slice ship → slice-closeout skill
- direction change → owner decision (scope decision)
- archive pointer → router link + phase stub only
```
