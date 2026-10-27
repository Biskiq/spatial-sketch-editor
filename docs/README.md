# Museum docs — context router

**Audience:** agents + humans.
**Bootstrap:** [`../AGENTS.md`](../AGENTS.md).

## Context discipline (progressive disclosure)

Do not preload the documentation tree. Start here, identify the task surface,
then read **the smallest routed context that can answer the task**.

A routed file is not automatically a full-file read: read the smallest relevant
section / authority box / route block first, then stop unless the task, missing
information, or contradictory evidence requires expanding within the file.
A plan referencing a contract does not imply preloading that contract; the test
README existing does not imply preloading every lane before implementation starts.

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
- active phase manifest;
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
reference/decisions = ratified destination direction (normative for new design)
reference = current intended system (authoritative but falsifiable — see below)
roadmap/now.md = current release list (an owner release writes it; a closeout does not)
roadmap = future work (pre-redesign plans are evidence, re-derived against F)
operations = live work
prototypes = runnable product hypotheses + QA/reference evidence (never authority)
archive = history
```

**Authority precedence:** the ratified decision record
([`reference/decisions/northstar-ratification-2026-09-27.md`](./reference/decisions/northstar-ratification-2026-09-27.md)),
as refined by the later [World | Experience amendment](./reference/decisions/world-experience-reconciliation-2026-09-29.md),
is normative for all new design and outranks conflicting pre-ratification
`reference/` and `roadmap/` text. Landed contracts keep describing current
behavior until their explicit cutover; the destination is never presented as
shipped.

The [2026-10-22 convergence ratification](./reference/decisions/product-convergence-ratification-2026-10-22.md)
refines the core destination in the owning references and authorizes the bounded on-demand
performance workflow. Named consumer decisions remain; the [current post-Batch-E coordination](./roadmap/cross-track-execution.md#next-parallel-batch)
routes the three owner-released lanes. The production hold remains for all omitted scopes.

The [2026-10-27 T5 G0 ratification](./reference/decisions/t5-g0-ratification-2026-10-27.md)
promotes creative-depth principles into the North Star and owning reference contracts. It selects
no implementation or prototype. [T5 E0](./roadmap/t5-expressive-geometry/README.md#e0-next-experimental-decision-gate)
is the next experimental decision gate and requires separate owner authorization.

| Need | Read | Code |
|------|------|------|
| Run the project locally | [`local-development.md`](./local-development.md) — editor, API, database and worktree setup | Root npm scripts |
| Tell me about this project | [`orientation.md`](./orientation.md), then stop | — |
| What's next? | [`roadmap/now.md`](./roadmap/now.md) for released scopes/conditions → [current coordination](./roadmap/cross-track-execution.md#next-parallel-batch) for the DAG and ownership → owning phase/plan when a lane is named; stop without a source survey | — |
| Ratified direction / decision provenance | [`reference/decisions/northstar-ratification-2026-09-27.md`](./reference/decisions/northstar-ratification-2026-09-27.md), as refined by the [`2026-09-29 World \| Experience amendment`](./reference/decisions/world-experience-reconciliation-2026-09-29.md) the [2026-10-15 F-interface ratification](./reference/decisions/f-ratification-2026-10-15.md) and the [2026-10-23 production shell Round 2 ratification](./reference/decisions/production-shell-round-2-ratification-2026-10-23.md) (normative for shell composition and visual/interaction language); promoted concerns live in the routed contracts below | — |
| Foundation contracts (F) — ratified target contract; F.1–F.5 written, implementation status inside | [`reference/composition-execution.md`](./reference/composition-execution.md) (phase registration/status → [`roadmap/f-foundation-contracts/README.md`](./roadmap/f-foundation-contracts/README.md)) | — |
| Architecture / ownership | [`reference/architecture.md`](./reference/architecture.md) | — |
| Layout authority | [`reference/architecture.md`](./reference/architecture.md) §Semantic authorities | `packages/layout-core/src/` |
| Experience authority | [`reference/architecture.md`](./reference/architecture.md) §Semantic authorities | `packages/project-model/src/units/experience/` · `apps/editor/src/lib/visitor/` |
| Typed resources | [`reference/architecture.md`](./reference/architecture.md) §Semantic authorities | `packages/project-model/src/units/` · `apps/api/src/asset-persistence.ts` |
| API | [`local-development.md`](./local-development.md) | `apps/api/src/` |
| Product direction | [`reference/north-star.md`](./reference/north-star.md) | — |
| T5 creative depth / G0 promotion / next E0 decision | [Ratification and limits](./reference/decisions/t5-g0-ratification-2026-10-27.md) → [T5 tracking](./roadmap/t5-expressive-geometry/README.md); the original proposals remain historical evidence | — |
| Accepted unified UX / Experience authoring (#114) | [PLATE shared shell](./reference/design-system/editor-shell-and-visual-system.md#shared-shell-08) and [Experience expression/acceptance](./reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression) own the ratified destination shell: Production shell Round 2 ([ratification record](./reference/decisions/production-shell-round-2-ratification-2026-10-23.md), PR #181) supersedes Conservatory chrome, Paper and earlier PLATE shell treatments. Experience semantics from #114 are unchanged. [Interactive Conservatory](../prototypes/experience-ux-alternative/README.md) supplies reproducible Experience scenario states and creator journeys, not shell chrome; [Round 2 wireframe](../prototypes/production-shell-wireframe/README.md) is the accepted visual/behavioral evidence; UX3/V3 and earlier Experience shell plans/PNGs are historical. Production behavior and domain contracts remain distinct | — |
| World authoring design (dock tools, Card as the one writer, Find in the Head, rays and points, precision, drafting state, Wall authoring) | [PLATE §0.8.4](./reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination) (anchor kept; title now World authoring) owns it as ratified by Round 2; the rail, Draw/Opening/Place families and Dimensions Instrument are superseded. The [Paper shell proposal](../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md) keeps rationale/specimens. PA0–PA12 is [inactive evidence](../prototypes/paper-authoring-commission/plans/inactive-adoption-plan.md), not #115's mandate. Wall-role Layout cutover → [`reference/architecture.md`](./reference/architecture.md) §Ownership | — |
| Product routes | [`reference/architecture.md`](./reference/architecture.md) §Product routes | — |
| Shell **design** — composition, lower-surface span, material, typography, control metrics, state and return | [`reference/design-system/editor-shell-and-visual-system.md`](./reference/design-system/editor-shell-and-visual-system.md) — owner-ratified unified destination (Production shell Round 2): authority/invariants → shared shell → World or Experience → visual/state, return and responsive rules. PR #115 removed the earlier full authoring shell; the [current North Star summary](./reference/north-star.md) routes the bounded Stage/Experience loops now landed; they do not implement the full destination | Partial: bounded shared Stage authoring; full destination remains future |
| Stage-local instruments — spatial facts, handles, helpers, precision, layering and interaction legibility | [`reference/design-system/spatial-instrument-grammar.md`](./reference/design-system/spatial-instrument-grammar.md) — soft-frozen destination representation grammar; consumes shell roles and domain operations, with feature-specific instruments/hit policies | Domain-specific editor helpers and adapters |
| Scene entities / materials / lights (incl. the kernel-level validation/transform contract) | [`reference/components/scene-content.md`](./reference/components/scene-content.md) | `apps/editor/src/lib/content/` · generic renderer in `apps/editor/src/lib/museum/` |
| Camera / tour / motion | [`reference/components/camera-tour.md`](./reference/components/camera-tour.md) | `packages/camera-core/src/` · `apps/editor/src/lib/visitor/` · retained pure Camera authoring math in `apps/editor/src/lib/authoring/camera/` |
| Persistence / schema | [`reference/components/persistence.md`](./reference/components/persistence.md) | `packages/project-model/src/` · `packages/layout-core/src/` · `apps/editor/src/lib/platform/project-persistence.ts` |
| Scene codec internals | [`reference/components/scene-codec.md`](./reference/components/scene-codec.md) | `packages/project-model/src/scene-codec/` · `apps/editor/src/lib/content/scene.ts` |
| Assets / catalogue | [`reference/components/assets.md`](./reference/components/assets.md) | `apps/editor/src/lib/content/assets.ts` |
| Retained authoring semantics (`lib/authoring/`) | [`apps/editor/src/lib/authoring/README.md`](../apps/editor/src/lib/authoring/README.md) — the retention criteria and what is retained | `apps/editor/src/lib/authoring/{camera,layout,scene,a11y}/` |
| Tracks (objectives, phase register, starting foundation, evidence) | [`roadmap/t1-spatial-world/README.md`](./roadmap/t1-spatial-world/README.md) · [`roadmap/t2-composition/README.md`](./roadmap/t2-composition/README.md) · [`roadmap/t3-experience/README.md`](./roadmap/t3-experience/README.md) · [`roadmap/t4-release/README.md`](./roadmap/t4-release/README.md) — each links its own runbook and planning evidence; no track authorizes implementation | — |
| Gate register (exact interfaces and cutovers) | [`roadmap/README.md`](./roadmap/README.md) §Gate register — version, provider slice, exports, conformance and acceptance identity; F semantics stay in [`reference/composition-execution.md`](./reference/composition-execution.md) | — |
| Current work / baton | [`operations/current.md`](./operations/current.md) (navigation) → the owning track's `operations/<track>/current.md` | — |
| Interrupted work / resume | [`operations/checkpoints/`](./operations/checkpoints/) — transient only; `work-checkpoint` skill owns procedure | — |
| Event procedures (track completion · integration acceptance · milestone acceptance · replanning) | [`operations/README.md`](./operations/README.md) — entered only by its explicit events; ordinary slice work never loads it | — |
| Operational runbook for a track | [`operations/t1-spatial-world/README.md`](./operations/t1-spatial-world/README.md) · [`operations/t2-composition/README.md`](./operations/t2-composition/README.md) · [`operations/t3-experience/README.md`](./operations/t3-experience/README.md) · [`operations/t4-release/README.md`](./operations/t4-release/README.md) — eligibility, start step, test families, routes and debt handling | — |
| Tech debt | [`operations/tech-debt/`](./operations/tech-debt/) | — |
| Architecture cycle (meta) | [`operations/architecture-cycle.md`](./operations/architecture-cycle.md) — stage, bounded exposure window and mechanism register; loaded only by its three hooks (phase planning, implementation start, slice closeout) | — |
| Browser performance / delivery | [`reference/components/performance.md`](./reference/components/performance.md) — owner-ratified PR #173 destination; metrics, baseline, budgets and consuming-slice evidence; current benchmark policy stays in the test contract | — |
| Tests | [`../apps/editor/tests/README.md`](../apps/editor/tests/README.md) | — |
| Prototype / QA reference — runnable product hypotheses and their specimens | [`../prototypes/README.md`](../prototypes/README.md) — durable executable artifacts; they test and challenge contracts but are **not** production, persisted-format or implementation authority | — |
| History | [`archive/`](./archive/) (opt-in; nothing here is current truth) | — |

```text
START: docs/README.md
ASSIGNED WORK: operations/current.md → your track's operations/<track>/current.md → exact phase README → exact slice plan. Do not open another track's baton or the archive.
UNASSIGNED PLANNING: roadmap/README.md → requested track README → phase plan (when registered)
F-INTERFACE GAP: slice plan → F amendment / gate register row
START IMPLEMENTATION: track runbook start step (eligibility, including the release list, + one-line cycle check). Do not open another track's baton or the archive.
VERIFY: slice acceptance rows + the test manual (the gates test runs in the arch lane)
SLICE CLOSE: slice-closeout (final-gate guard; cycle-window check only)
PHASE CLOSE: explicit owner invocation → phase-closeout
TRACK / PROGRAM / REPLAN: explicit event → exact operations/README.md section
DESIGN: phase → exact routed context/design artifact
RESEARCH: phase → exact routed research/synthesis artifact
STOP: no more reading unless a concrete contradiction or missing fact requires it
```

The hierarchy is ownership, not mandatory preloading. Ordinary slice work never loads the program
runbook, the phase-close procedure, the whole F contract, archived diagnosis or the architecture
cycle.

The normal route has no mandatory intermediate slice router: the **phase README**
owns child status/order and links the exact artifact. Slice artifacts may live in
a slice workspace directory; a workspace directory does not require a README, and
a local index there is navigation-only if one exists.

**Archive:** live routers never treat archived material as current authority.
Enter only when the task explicitly requires historical rationale, or when
bounded current evidence cannot resolve a material provenance/contradiction
question.

### Startup boundary

```text
STARTUP (ordinary fresh implementation work) ends here once the task is routed:
current work → phase status → exact active plan → durable authority → test contract.
STOP HERE if the route is resolved and no contradiction exists.

ON-DEMAND (same document, read only at the trigger):
- source/tests/Git contradicting a reference claim → falsifiability triage below
- first actual plan mutation / review fold-in / owner ruling → Plan hygiene
- substantial work establishing or changing durable knowledge → Knowledge promotion / completion
- promoting truth, changing status, checkpointing, closing, recording debt → Update rules / Meta handoff
- slice accepted → slice-closeout skill; explicit owner phase close → phase-closeout skill;
  interrupted work → work-checkpoint skill (skills stay unloaded until their event)
```

## Progressive project knowledge (on-demand — reconciliation / completion)

> **Trigger:** read when reconciling substantial work or promoting durable
> knowledge — not at slice start. Exception: the falsifiability triage below
> (implementation regression vs stale reference vs ambiguous evidence) stays one
> hop away during implementation via the Startup boundary above; use it on any
> source-vs-reference contradiction.

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
established by P23.14, slice closed 2026-09-21) is the first instance. The 2026-09-27
northstar ratification is the second: the decision record stays at
[`reference/decisions/`](./reference/decisions/) as provenance, while each concern is
promoted into its routed live contract (`north-star.md`, `architecture.md`, the component
contracts, the roadmap) — one live normative statement per concern.

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
workflow (see `.agents/skills/`; most valuable first: `slice-closeout`, then the
manual-only `phase-closeout`).

## Meta — how to write the handoff and the next plan (on-demand — read at the action moment)

> **Trigger:** read the row for the action being performed (checkpointing,
> resuming, planning, shipping, closing) — not at slice start. Route
> discoverability stays ambient: CURRENT → product baton, RESUME/CHECKPOINT →
> work-checkpoint, SHIP → slice-closeout, PHASE CLOSE → phase-closeout,
> explicit owner request only.

```text
CURRENT: transient semantic baton only; inspect Git for branch/HEAD/dirty state.
INCREMENT / VERIFY: optional current-work fields.
RESUME: interrupted work only → operations/checkpoints/ via work-checkpoint skill.
CHECKPOINT: continue same unit; handoff = start next unit.
PLAN: phase README routes the exact plan path and owns child order/status; a slice workspace needs no README.
PHASE: create README first; a phase registers in its track README and owns its own slice register.
SHIP: use slice-closeout skill.
PHASE CLOSE: explicit owner request only → phase-closeout skill.
TRACK / PROGRAM: explicit event only → operations/README.md event section.
```

### Plan hygiene (on-demand — first plan mutation)

> **Trigger:** read when making the first actual plan mutation, folding in a
> review correction, or incorporating an owner ruling — not when starting
> implementation from an already-approved plan. Authority stays here; delivery
> moves to the mutation moment.

An active plan is a projection of current approved intent, not a review diary.

```text
KEEP:
- current scope
- current/final decisions folded into the section they govern
- implementation sequence
- acceptance criteria
- unresolved owner calls
- concise rationale when removing it would make a decision
  unsafe or confusing to reverse

DO NOT APPEND:
- review-round logs
- reviewer commentary
- R1 / R2 / Rn correction ledgers
- chronological owner-decision ledgers
- resolved alternatives
- implementation/debug chronology
- rehearsal transcripts
- commit-by-commit history
```

When review changes the plan: rewrite the owning section into the corrected current form.
When the owner decides: fold the ruling into the rule/section it governs.

**Plans preserve conclusions and necessary rationale; Git/PR history preserves
deliberation.**

### Historical paths in a record (on-demand — writing a record)

> **Trigger:** read when a record quotes a file that has since moved or been
> deleted, or quotes another repository's checkout.

A record states what was true at the revision it describes, so a path it quotes is
evidence, not a route: a contract since moved under `docs/reference/`, a
validation test a later phase deleted, another project's `packages/…` tree. Keep
those paths exactly as written and declare them, rather than rewriting the record
or letting them fail the cross-reference gate:

```text
EVIDENCE-PATHS: start — <what these paths are evidence of, and the revision>
EVIDENCE-PATHS: end
```

Written paths inside the region are not resolved. Links, definitions and
`#anchors` still are — a record's link is the reader's route today — and an
unclosed `start` runs to the end of the document, so a wholly historical record
declares one line. A path that routes a reader today ("the gate record is at …")
is fixed rather than declared: the gate is
`apps/editor/tests/docs/documentation-references.test.ts`.

## Update rules (on-demand — status / closeout / checkpoint events)

> **Trigger:** read when actually promoting landed truth, changing P-level or
> child/phase status, checkpointing/resuming, closing work, recording debt, or
> repairing archive pointers — not at slice start. Startup keeps only the compact
> routes: slice accepted → slice-closeout, explicit owner phase close →
> phase-closeout, interrupted work → work-checkpoint. Procedure detail already
> owned by the relevant skill is not duplicated here beyond these destinations.

```text
UPDATE:
- track/phase lifecycle + gate register + future work → roadmap/README.md
- release list → roadmap/now.md (owner release only; a closeout does not write it)
- track objectives/phase register → owning track README
- phase scope/slice register/FINAL PHASE GATE/PHASE CLOSE → owning phase README
- track completion / integration acceptance / milestone acceptance / replanning → operations/README.md event sections
- current work baton → the owning track's operations/<track>/current.md (never another track's)
- interrupted resumable work → operations/checkpoints/ via work-checkpoint skill
- landed truth → reference/* (reconcile; supersede stale claims, never silently promote roadmap proposals)
- deferred bug → operations/tech-debt/
- slice ship → slice-closeout skill
- phase close (explicit owner request only) → phase-closeout skill
- direction change → owner decision (scope decision)
- archive pointer → router link + phase stub only
```
