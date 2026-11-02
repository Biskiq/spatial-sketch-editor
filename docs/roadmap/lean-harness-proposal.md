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
        → agent review, merge on green CI, owner reviews in the weekly digest;
          revert is the recovery path
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
- **A plan is written only** for multi-PR work or Tier 2 work. It lives in the claiming issue or
  draft pull request, not in the repository, and is capped at about one page:

```text
Goal        capability ids + North Star link
Design      approved design reference, or "none"
Scope       in / out
Checks      tagged tests to add, written first and failing
Flags       open decisions, UX, research or ambiguity this work depends on
Risks       what could go wrong and how it would show
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

### J — Scheduled agents

- **Gardener (weekly):** deletes dead docs, archives closed material, flags drift between docs and
  code, opens one reviewable pull request.
- **Gap scanner (weekly):** compares the North Star with the ledger and status, and produces the
  owner digest: regressions, Tier 1 merges to review, flags ranked by how much work they block, and
  the next unclaimed capabilities.
- **Breaker (weekly):** exploratory testing of `working` and `polished` capabilities. Every defect
  it finds lands as a failing tagged test or a `bug` issue.

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
8. The scheduled agents start once the status report exists.

The prune pull requests themselves follow the new rules.

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

1. Tier 1: owner review in the weekly digest after merge (recommended), or a skim before merge?
2. Plans in GitHub issues and pull requests (recommended), or one-page files in the repository?
3. Ledger granularity: about one entry per creator-recognizable action (recommended), or coarser?
4. Retire R217.S11's existing plan outright, or keep it in the archive as reference?
5. Does T5 depth pause until T4 delivers a working publish loop?
