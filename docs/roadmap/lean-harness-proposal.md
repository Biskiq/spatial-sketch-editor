# Lean harness proposal — documentation and agent-workflow prune

**Status:** draft proposal for owner review, revision 2. It authorizes nothing and changes no rule
until the owner merges it. **Timing:** execute after R217.S25 merges and closes out, and before
R217.S11 (the integrated final gate) starts. Remaining R217.S24 follow-up and R217.S25 finish under
the current rules. Once executed, this document moves to the archive.

## Why

The repository's routing and documentation exist so that agents can maintain the project and move
it toward the [North Star](../reference/north-star.md) with the owner reviewing occasionally. The
intent is right. The cost has outgrown it:

- `docs/` holds about 386 Markdown files and about 600k words (archive included); 281 of those
  files are roadmap documents.
- Since 2026-10-01, 729 of 1,191 commits touched documentation and 453 touched application or
  package code.
- R217.S24's acceptance record is about 2,530 words against a 408-word plan; R217.S11's plan alone
  is about 2,850 words. Merge anchors get their own pull requests (for example #257 after #256).
- [The release list](./now.md) stores permission as paragraphs of authorization history.
- Agents follow the rules too literally: slices end in documentation-only acceptance plus bug
  fixes, closeouts stall waiting for review, and planning requests cross-track review.
- Planning reconciled approved designs down to the current shell instead of building the design,
  which produced the drift R217 had to unwind.

The durable reference tier (North Star, architecture, F contract, design system, component
contracts; about 60k words) is not the problem and stays.

## Goals

1. **Lean onboarding.** A new agent or contributor asks "what's next?" and learns what works, what
   is broken, what is undecided and what is already claimed, in a handful of reads.
2. **Parallel work without duplication or gates.** Anyone can pick up independent work in any area.
3. **Self-building toward the North Star.** An agent can find the next gap, build it, prove it and
   merge it, escalating only for real judgment calls.
4. **Honest, recoverable status.** "Shipped" can never be a stale claim; a broken feature shows as
   broken as soon as anyone proves it.
5. **Self-aware maintenance.** Undecided product choices, missing UX, missing research and
   ambiguity are surfaced as visible flags instead of being guessed around or blocking everything.
6. **Bounded context without reading rules.** Structure gives agents the right context; judgment,
   not a reading quota, decides when they have read enough.

## Principles

- **Durable truth in the repo, flow in GitHub.** Code, tests, the capability ledger, reference
  contracts and decisions live in the repository. Claims, plans, flags and review conversations
  live in GitHub issues and pull requests.
- **Status is computed, never claimed.** Tests prove capabilities; a report derives each
  capability's level from the latest test run on `main`.
- **Checks over prose.** A rule that can be a test or lint becomes one; anything else is guidance
  and blocks nothing.
- **Areas, not gates.** Tracks organize code, context and expertise. Anyone may change any area.
- **Design leads.** An owner-approved design is the target for the surface it covers; the shell
  reference follows what ships.
- **Flag, don't guess and don't stall.** Open a flag, continue on the most reversible reading, or
  pick other work.
- **Judgment clause.** When following a guideline costs more than the risk it guards, say so in one
  line in the pull request and proceed. Tier 2 work is excepted.

## Changes

### A — Capability ledger with computed status

A root `capabilities.json` lists what the product should do: one entry per thing a creator would
say they can do. It holds definitions only, never status.

```json
{
  "id": "layout.roof.gable-join",
  "area": "T1",
  "summary": "Two gable roofs meeting at a corner join automatically with a correct valley",
  "northStar": "north-star.md#product-convergence-destination",
  "design": null,
  "review": null
}
```

Tests declare which capability they prove and at what level, in the test title, for example
`[cap:layout.roof.gable-join core]` or `[cap:layout.roof.gable-join edge]`. A status script runs on
`main` (nightly for the full end-to-end suite) and derives each capability's level:

| Level | Meaning |
| --- | --- |
| `missing` | no tagged check passes, or none exists yet |
| `partial` | some core checks pass |
| `working` | every core check passes |
| `polished` | every core and edge check passes, no open bug, and the owner's review of the current design is accepted and not stale |

A capability whose level dropped since the previous report is shown as **regressed**. An owner
review goes stale automatically when its referenced design changes after the review date.

**When a "shipped" feature turns out broken** (for example, gable roofs fail to join on a T-shape):

1. Whoever finds it adds a failing test tagged with the capability: `core` if the main journey is
   broken, `edge` otherwise. If a test is not practical yet (visual defects), they open a `bug`
   issue labelled with the capability instead.
2. The next report lowers the level and marks it regressed. Nobody edits a status field, reopens a
   slice or writes a document.
3. A fix pull request makes the test pass, and the level recovers on the next report.

**The one hard guard:** removing a tagged check or retagging it to a lower level needs the owner's
label on the pull request, enforced in CI. Skipping a check is allowed but counts as failing, so
status stays honest without blocking anyone.

Agents may add capabilities and checks freely. The initial seeding from the North Star is reviewed
by the owner once.

### B — Claims and flags in GitHub

- **Claims:** a draft pull request or self-assigned issue whose title names the capability id. An
  agent checks open drafts before starting.
- **Flags:** issues with a capability label and one of these flag labels.

| Label | Meaning | What an agent does |
| --- | --- | --- |
| `needs-decision` | a product choice is undecided | proceed only on a reversible default and record the assumption; otherwise pick other work |
| `needs-ux` | the flow or UI is not designed | build the logic behind it with a minimal surface; never invent final UX |
| `needs-research` | the technical foundation is unknown | run a bounded spike whose exit is a decision, not an open-ended study |
| `ambiguous` | the spec or design is unclear or contradicts itself | ask in the issue and proceed on the most reversible reading |
| `bug` | behavior is wrong | write a failing tagged test first, then fix |

Agents open flags whenever they hit one; that is the self-aware maintenance loop. Research output
lands as a short conclusion linked from its issue and, when it settles something, as a decision or
a ledger change.

A single command (`npm run status`) prints, per capability: level, regressions, failing checks,
open flags and claims. That is the lean scan a new agent starts from.

### C — Autonomy by risk tier

```text
Tier 0  everything not listed below
        → one fresh-context agent review, merge on green CI
Tier 1  changes a contract invariant, a persisted format, the visitor/public surface,
        or shared shell rules
        → agent review, merge on green CI; the owner reviews it at the next
          significant-change checkpoint; revert is the recovery path
Tier 2  changes the North Star, an approved design or the ledger's shape; removes or
        downgrades a check; records an owner review; production data or activation;
        licence; new dependency
        → owner decides before merge
```

### D — Areas, not gates

- T1–T5 remain names for areas: Spatial world, Composition, Experience, Release, Expressive
  geometry. They organize code, local context and expertise.
- **Fix it where you find it.** An agent working mostly in T2 may complete something T4 missed; T5
  may build a foundation T1 lacks. Nobody delegates a gap to "the owning track".
- Touching another area means reading its local AGENTS.md, keeping its tests green and respecting
  its invariants (which tests enforce). Nothing more.
- Reviews are area-aware without area owners: the reviewer subagent receives the touched areas'
  AGENTS.md files.
- If ownership files are added for human teammates, they notify and never block. Risk tier, not
  area, decides escalation.
- Parallel safety comes from claims and small pull requests. Whoever merges second rebases.

### D2 — Parallel work, focus and holds

The owner still drives work by prompting agents; nothing runs on a schedule.

- **Starting a batch is a prompt, not a pull request.** The owner tells one or more agents what to
  pursue ("the next unclaimed T4 capabilities", "these three gaps", or "whatever `npm run status`
  ranks next"). Each agent claims its item with a draft pull request, so parallel agents never
  pick the same thing. Each pull request merges on its own; there is no batch-level greenlight.
- **Focus line.** A short focus file at the repository root states the current priority in a few
  lines (for example "T4 publish loop first; T5 depth paused"). `npm run status` prints it, and
  agents prefer work that matches it. Changing it is a one-line owner commit.
- **Hold.** When a new research idea or design rethink needs everything to stop, the owner sets the
  focus file to a hold: no new claims, in-flight work either finishes its current pull request or
  parks as a draft. The hold names its question and what ends it (a decision, a design, a research
  conclusion). Lifting the hold is editing the same file.
- **Converge.** If the idea changes direction, its outcome lands as ledger changes, an approved
  design or a North Star amendment (Tier 2), and parked drafts rebase onto it or close.

### E — Design leads

- An owner-approved design (a prototype or design artifact marked `approved` in its README or
  referenced by a capability's `design` field) is the target for the surface it covers. It outranks
  the current shell and the shell reference for that surface. Designs marked `exploring` inform but
  do not direct.
- Agents build toward the approved design. They never reshape it to fit the current shell. If the
  design cannot be built without breaking an invariant, or is unclear, they open `needs-decision`
  or `ambiguous` rather than reconciling silently.
- Acceptance for design-led work is the owner's review against the design; it is the review that
  makes a capability `polished`.
- After acceptance, the [shell and visual-system contract](../reference/design-system/editor-shell-and-visual-system.md)
  is updated, in the same pull request or the next, to describe what shipped. The design is the
  destination; the reference describes the accepted current.

### F — Work units and plans

- New work is identified by capability ids, not phase and slice numbers. Existing T/P/S identifiers
  stay valid as history.
- **The unit of work is a pull request** that adds or passes checks for one or more capabilities.
  Small work needs no plan.
- **A plan is written when the work needs one:** multi-PR work, Tier 2 work, or any work where an
  implementer would otherwise have to invent an interaction, an algorithm or a data shape.
- **Detail is judged by the no-invention test, not by length.** A plan is complete when an
  implementer can follow it without inventing new interaction, algorithm or format decisions. A
  novel algorithm or interaction gets as much specification as it needs (states, edge cases,
  pseudocode, worked examples); routine work gets a few lines. What a plan leaves out is
  ceremony: authorization history, evidence logistics, and restated contracts it can link to.
- **The plan is the first commit of the work's own draft pull request**, in a plans folder under
  docs. It is reviewed in that draft before code is written (by the owner for Tier 2, otherwise by
  a fresh-context agent), then the same pull request implements it. There is no separate plan pull
  request. On merge, durable decisions from the plan (an algorithm, an interaction rule, a format)
  move into the owning reference contract or code comments, and the plan file moves to the archive.
- Plan sections, used as needed:

```text
Goal         capability ids + North Star link
Design       approved design reference, or "none"
Scope        in / out
Specification  interactions, states, algorithms, data shapes, edge cases — enough that
               nothing has to be invented during implementation
Checks       tagged tests to add, written first and failing
Flags        open decisions, UX, research or ambiguity this work depends on
Risks        what could go wrong and how it would show
```

- **One review round:** a fresh-context reviewer subagent, spawned by the implementer, receives
  the diff, the touched areas' AGENTS.md files, the linked design and the capability's checks.
  P0 and P1 findings block; P2 and below become issues unless trivial. Disagreement goes to the
  owner.
- **No closeout step.** Merging is the closeout; the status report updates itself. No acceptance
  documents, anchor pull requests or phase-close records.
- Durable knowledge discovered while planning goes into reference contracts or a one-page decision
  record, never into a plan.

The [slice-closeout skill](../../.agents/skills/slice-closeout/SKILL.md) and
[phase-closeout skill](../../.agents/skills/phase-closeout/SKILL.md) retire; the
[work-checkpoint skill](../../.agents/skills/work-checkpoint/SKILL.md) stays for long resumable work.

### G — Context without reading rules

- **Understanding check, not a reading quota.** Before changing code, an agent should be able to
  state what it will change, what could break and who consumes it, and how it will prove the
  change. Read until it can; stop when it can. Review is not a substitute for reading.
- **Wide reading goes to explorer subagents** that return short summaries, so the main session
  stays clean.
- **Structure carries the routing:** nested AGENTS.md files per package or area; a header box of at
  most ten lines at the top of each durable doc (what it covers, invariants, governed paths, when
  to read further); a path-to-doc map; the [docs router](../README.md) reduced to an index of about
  40 lines.
- **Three levels of authority:** code and tests state current behavior; reference contracts and
  approved designs state invariants and targets; the North Star states intent.
- [AGENTS.md](../../AGENTS.md) drops current rules 9 and 10 and the boot contract, and stays at or
  under about 100 lines. A line is added only after an observed agent failure.

### H — Onboarding

- A "first ten minutes" section in the root README: clone, install, `npm run status`, read
  AGENTS.md, the glossary and the North Star header box, pick an unclaimed item.
- A one-page glossary of domain terms (Layout, Scene, Camera, Experience, Presentation, Guide,
  Stop, World and Experience lenses, PLATE, Stage, Object Focus).
- Human contributors and agents use the same path.

### I — Reference tier: keep and trim

- **Keep** the North Star, architecture, the F contract, component contracts and the shell
  contract.
- **Trim** the design system to rules and tokens; tokens live in code and the doc points to them.
  Designer-brief summaries are generated on demand.
- **Decision records:** Tier 2 decisions only, one page each. Authorization records move to the
  archive.

### J — On-demand agent skills

These are skills the owner (or an agent finishing a significant change) invokes when useful. None
runs on a schedule and none is a required step in a plan.

- **Checkpoint:** after a significant functionality change, summarizes for the owner what changed,
  status movements and regressions, Tier 1 merges since the last checkpoint, open flags ranked by
  how much work they block, and the next unclaimed capabilities. This replaces any fixed digest.
- **Gardener:** moves dead or closed material to the archive (it never deletes outright), flags
  drift between docs and code, and opens one reviewable pull request. Useful before onboarding
  someone, after a large merge, or when context starts to feel heavy.
- **Breaker:** exploratory testing of `working` and `polished` capabilities. Every defect it finds
  lands as a failing tagged test or a `bug` issue.

## Sequencing

1. R217.S24 follow-up and R217.S25 finish under the current rules.
2. The owner reviews and merges this proposal (Tier 2).
3. **Prune pull request 1, structure:** new AGENTS.md, nested AGENTS.md files, header boxes,
   router index, glossary, path-to-doc map.
4. **Prune pull request 2, status:** ledger seeded from the North Star (owner reviews the seed),
   existing tests tagged, status script and its CI guard, flag labels. The first report will look
   lower than reality wherever tests are missing; that is the honest starting point.
5. **Prune pull request 3, workflow and archive:** tier table, plan template, design-leads rule,
   closeout skills retired, batons and the release list archived, closed phases and authorization
   records swept to the archive.
6. **R217.S11 runs as the first lean final gate:** the R217 journey tests green on `main` plus an
   owner walkthrough. R217 closes.
7. T4 (release and delivery) is the first area planned entirely under the new rules.
8. The checkpoint, gardener and breaker skills are added once the status report exists.

The prune pull requests themselves follow the new rules.

## After it is in effect

**What disappears**

- Owner release rows and authorization records. Permission comes from the tier table, not from a
  per-slice release.
- Closeout, anchor and phase-close pull requests. Merging is the closeout; status updates itself.
- Acceptance documents. Evidence is tests plus the pull request description.
- Baton and register updates. Claims are draft pull requests; status is computed.
- Required cross-area review.

**What remains documentation-only, by design**

- North Star changes, Tier 2 decision records and approved-design updates (owner decisions).
- Gardener pull requests, when the owner invokes it (doc drift and archive sweeps).
- Focus and hold changes (a one-line owner commit).
- Reference-contract updates that follow an accepted design, when they cannot ride in the
  implementing pull request.

**What the owner still does**

- Approves designs and reviews design-led work to mark it `polished`.
- Decides Tier 2 items and answers `needs-decision` and `needs-ux` flags.
- Reviews at a checkpoint after each significant functionality change: regressions, Tier 1 merges,
  top flags, next capabilities. This is the owner's habit, not a step written into plans.
- Starts batches by prompting agents, and sets focus or a hold when direction needs to change.
- Reviews plans for Tier 2 work in their draft pull requests.

**A typical cycle**

1. An agent runs `npm run status`, sees `layout.roof.gable-join` at `partial` with no claim, and
   opens a draft pull request claiming it.
2. If the work needs a plan, the first commit is the plan; it is reviewed in the draft.
3. The agent writes the tagged checks (failing), implements until they pass, gets one
   fresh-context review and fixes P0/P1 findings.
4. Tier 0 or 1: it merges on green CI. Tier 2: it waits for the owner.
5. The next report shows `working`. Any open question it hit is now a flag issue.
6. Later, when the owner runs the breaker, it finds a T-shape failure and adds a failing edge test; the capability
   reads `working` (regressed from `polished`) until someone fixes it.

## What does not change

- The hard rules on Camera authority, distinct semantic authorities, authored-truth exclusions,
  visitor isolation and no second compiler.
- The public-surface and preview-surface boundary tests and the documentation-reference gate.
- The North Star's ratified direction and the creative-depth admission test.
- Owner control of the North Star, approved designs, check removal, production activation, licence
  and dependencies.

## Risks

- **Weak tests make status look better than reality.** Mitigated by the breaker agent, owner
  review for `polished`, and the guard on removing checks.
- **Seeding the ledger is a large one-time job.** Seed coarsely, refine as work touches each area.
- **Detailed plans go stale.** Mitigated by moving durable decisions into references on merge and
  archiving the plan file.
- **Lower review bar, more slop.** Mitigated by the tier table, checks written first and the
  gardener.
- **GitHub dependence for flow.** Durable truth stays in the repository, so losing GitHub loses
  conversation, not product knowledge.
- **The prune becomes its own governance project.** Mitigated by three bounded pull requests and no
  new process documents beyond this one.

## Acceptance for this proposal

- A fresh agent, given only the repository and `gh`, answers "what's next, what's broken, what's
  undecided and is anyone on it?" from `npm run status` plus at most five file reads.
- Adding one failing tagged test lowers a capability's level in the next report, and fixing it
  restores the level, with no documentation edits (demonstrated once).
- AGENTS.md is about 100 lines or fewer; the router index is about 40 lines or fewer.
- The live roadmap surface (outside the archive) is under 10% of today's word count.
- A Tier 0 change goes from claim to merge with no owner action and no documentation-only commits.
- All existing architecture and documentation-reference tests stay green.

## Open questions for the owner

1. Tier 1: owner review at the next significant-change checkpoint after merge (recommended), or a
   skim before merge?
2. Plans as the first commit of the working draft pull request (recommended), or as separate
   GitHub issues?
3. Ledger granularity: about one entry per creator-recognizable action (recommended), or coarser?
4. Retire R217.S11's existing plan outright, or keep it in the archive as reference?
5. Does T5 depth pause until T4 delivers a working publish loop?
