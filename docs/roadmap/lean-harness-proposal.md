# Lean harness proposal — documentation and agent-workflow prune

**Status:** draft proposal for owner review, revision 3 (folds in the peer review of `23e3756c`). It authorizes nothing and changes no rule
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
- **Status is computed, never claimed.** Tests and confirmed bug reports drive a report that
  derives each capability's maturity and health from the latest complete run on `main`.
- **Checks over prose.** A rule that can be a test or lint becomes one. Other guidance blocks
  nothing, with one exception: the retained hard rules and approved designs bind whether or not
  tests fully cover them.
- **Areas, not gates.** Tracks organize code, context and expertise. Anyone may change any area.
- **Design leads.** An owner-approved design is the target for the surface it covers; the shell
  reference follows what ships.
- **Flag, don't guess and don't stall.** Open a flag, continue on the most reversible reading, or
  pick other work.
- **Judgment clause.** When following a guideline costs more than the risk it guards, say so in one
  line in the pull request and proceed. It never applies to the retained hard rules, approved
  designs or Tier 2 work.
- **Enforcement before autonomy.** No mechanism is retired until its replacement is enforced.

## Changes

### A — Capability ledger with computed status

A root `capabilities.json` lists what the product should do: one entry per thing a creator would
say they can do. It holds definitions and the owner's review record, never status.

```json
{
  "id": "layout.roof.gable-join",
  "area": "T1",
  "summary": "Two gable roofs meeting at a corner join automatically with a correct valley",
  "northStar": "north-star.md#product-convergence-destination",
  "surface": ["layout-core: roof evaluation", "editor: roof authoring tools"],
  "design": null,
  "review": null
}
```

A review record, once the owner accepts design-led work, names what was reviewed:
`{ "implementation": "<commit>", "design": "<design revision>", "date": "...", "verdict": "accepted" }`.

**Tests carry the claims.** Each test declares the capability and level it proves in its title, for
example `[cap:layout.roof.gable-join core]` or `[cap:layout.roof.gable-join edge]`. A reproducer
for a confirmed defect merges as an **expected failure** linked to its issue
(`[cap:layout.roof.gable-join core known-failing:#301]`, using the runner's expected-failure mode).
CI stays green because the test is expected to fail, the report counts it as failing, and when a
fix makes it pass CI flags the stale marker so the fix pull request removes it. A skipped check
also counts as failing.

**Two axes, reported separately.** Maturity says what has been proven; health says whether it works
right now. Health is never hidden behind maturity.

| Maturity | Meaning |
| --- | --- |
| `missing` | no core check is defined, or none passes |
| `partial` | some core checks pass |
| `working` | at least one core check exists, and every core check passes |
| `polished` | `working`, every edge check passes, and the owner's review is current |

| Health | Meaning |
| --- | --- |
| `healthy` | no failing checks and no confirmed open bug |
| `degraded` | an edge check fails, or a confirmed bug that does not block the main journey is open |
| `broken` | a core check fails, or a confirmed bug labelled `blocks-core` is open, even before any reproducer exists |
| `unknown` | the latest report for this capability is stale, incomplete or missing |

A capability whose maturity or health worsened since the previous report is marked **regressed**.

**The report states its own provenance:** the commit it tested, when it ran, which suites ran and
whether each completed. A report older than the current `main` head, or with an interrupted or
missing suite, marks the affected capabilities `unknown` instead of presenting old results as
current.

**Owner reviews are bound to both design and implementation.** A review goes stale when its design
changes, or when a later merge touches the capability's `surface` (path globs in practice; shown as
descriptions above). Changes elsewhere keep it. A stale review drops `polished` to `working` until
the owner looks again.

**When a "shipped" feature turns out broken** (for example, gable roofs fail to join on a T-shape):

1. Whoever finds it reproduces it on current `main` and opens a `bug` issue with the steps,
   labelled with the capability, adding `blocks-core` if the main journey fails. The report reads
   issues live, so health changes at once, before any test exists.
2. If the defect can be automated, a reproducer merges as an expected failure linked to the issue,
   so the report keeps showing it through the test. If it cannot be automated yet (a visual
   defect, for example), the issue alone carries it.
3. The fix pull request makes the reproducer pass and removes its marker, or, for an issue-only
   defect, closes the issue with the evidence that it is fixed. Health recovers on the next report.

Nobody edits a status field, reopens a slice or writes a document at any step.

**The hard guards,** enforced in CI: removing a tagged check, retagging it to a lower level,
dropping `blocks-core` from a confirmed bug, or closing a `blocks-core` bug without a linked fix all
need the owner's label on the pull request or issue.

Agents may add capabilities and checks freely. The initial seeding from the North Star is reviewed
by the owner once.

### B — Claims and flags in GitHub

- **Claims:** a draft pull request or self-assigned issue whose title names the capability id. An
  agent checks open issues and pull requests before starting, and again right after creating its
  claim, because two agents can both see "unclaimed" first. If another claim for the same
  capability exists, the earlier one keeps it and the later one closes or narrows its scope. The
  status report also lists duplicate claims.
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

A single command (`npm run status`) prints the report's commit, age and completeness, then, per
capability: maturity, health, regressions, failing checks, open flags and claims. That is the lean scan a new agent starts from.

### C — Autonomy by risk tier

```text
Tier 0  everything not listed below
        → one fresh-context agent review, merge on green CI
Tier 1  changes a contract's details within the retained hard rules, the visitor/public
        surface or shared shell rules; or changes a persisted format that the previous
        reader can still read, or that ships a tested migration and recovery path
        → agent review, merge on green CI; the owner reviews it at the next
          significant-change checkpoint; revert is the recovery path
Tier 2  changes a retained hard rule, the North Star, an approved design or the ledger's
        shape; any persisted-format change without that compatibility or tested recovery;
        removes or downgrades a check; records an owner review; production data or
        activation; licence; new dependency
        → owner decides before merge
```

- **The highest applicable tier wins.** A change's tier follows what it does, whether or not a test
  notices.
- **Why the persisted-format line:** reverting code does not make newly written files readable by
  the old reader, so "revert is the recovery path" only holds for formats that stay readable or
  ship a tested way back.
- **Autonomous merges start only after the required merge gate exists** (see Sequencing). Until
  then, the current rules apply.

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
  ranks next"). Each agent claims its item with a draft pull request and runs the post-claim
  collision check, so parallel agents do not build the same thing. Each pull request merges on its own; there is no batch-level greenlight.
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
3. **Prune pull request 1, enforcement first** (runs under the current rules):
   - a repository merge-gate workflow running `npm run check`, `npm run test:arch`, `npm test`,
     `npm run build`, `npm run check:api` and DB-backed `npm run test:api` with zero skips, made a
     required check on `main` through branch protection. Today the only checked-in workflow is the
     path-filtered native-form goldens job, so this gate does not yet exist;
   - the status script with main-branch reporting, provenance and the `unknown` state;
   - the hard guards on checks and confirmed bugs;
   - the ledger seeded from the North Star (owner reviews the seed), existing tests tagged, flag
     and `blocks-core` labels. The first report will look lower than reality wherever tests are
     missing; that is the honest starting point.
4. **Prune pull request 2, structure** (new rules apply from here): new AGENTS.md, nested
   AGENTS.md files, header boxes, router index, glossary, path-to-doc map.
5. **Prune pull request 3, workflow and archive:** tier table, plan template, design-leads rule,
   closeout skills retired, batons and the release list archived, closed phases and authorization
   records swept to the archive.
6. **R217.S11 runs as the first lean final gate.** Only its recording gets lighter; its proof does
   not. The obligations in its [current plan](./r217-core-editor-stability/r217.s11-integrated-final-gate/implementation-plan.md)
   carry over as tagged tests and a pull request checklist:
   - the complete merge gate, including DB-backed API tests with zero skips;
   - journeys J1–J17 across the pointer and viewport matrix, as tagged end-to-end tests wherever
     automatable;
   - the owner-run Safari cells and the native-touch cell, or an explicit owner waiver;
   - visitor, public and preview isolation plus the build-chunk scan;
   - the seam reviews, as tests where possible;
   - the real-import evidence R217.S17 carried to J15;
   - an independent review of the integrated diff and an owner walkthrough.

   Screenshots go in the pull request instead of an acceptance record. Any obligation that is
   dropped is retired by an explicit owner decision recorded in that pull request. R217 then
   closes.
7. T4 (release and delivery) is the first area planned entirely under the new rules.
8. The checkpoint, gardener and breaker skills are added once the status report exists.

**Test migration.** In `apps/editor/tests/docs/parallel-track-gates.test.ts`, the assertions on the
router routes, track batons, the release list and the closeout-skill preflights are replaced in
the same pull request that retires each mechanism, by assertions on its replacement (router index,
ledger validity, guard behavior). The documentation-reference gate and every product architecture,
isolation and boundary test stay unchanged. No guarantee disappears without being named in the
pull request that removes it.

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

1. An agent runs `npm run status`, sees `layout.roof.gable-join` at `partial` with no claim, opens
   a draft pull request claiming it and re-checks for a colliding claim.
2. If the work needs a plan, the first commit is the plan; it is reviewed in the draft.
3. The agent writes the tagged checks (failing), implements until they pass, gets one
   fresh-context review and fixes P0/P1 findings.
4. Tier 0 or 1: it merges on green CI. Tier 2: it waits for the owner.
5. The next report shows `working` and `healthy`. Any open question it hit is now a flag issue.
6. Later, when the owner runs the breaker, it finds a T-shape failure and adds an expected-failure
   edge test linked to a `bug` issue. The capability reads `degraded` and regressed until someone
   fixes it. Had the main journey broken, the issue's `blocks-core` label would have shown it as
   `broken` immediately.

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
- **Review invalidation churn.** Scoped `surface` paths keep unrelated changes from expiring an
  owner review.
- **Status trusted while CI is missing.** Mitigated by building the merge gate and report first,
  and by the `unknown` state for stale or incomplete runs.
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
- Both defect paths are demonstrated once, with no documentation edits: an automatable defect
  (bug issue, expected-failure reproducer, fix) and an issue-only defect. Health drops on
  confirmation and recovers after the fix.
- A capability with zero core checks never reads `working`.
- A report from an older commit or with an incomplete suite shows `unknown`, and the report prints
  its commit, run time and completeness.
- The required merge gate is enforced on `main` before any change merges without owner action.
- AGENTS.md is about 100 lines or fewer; the router index is about 40 lines or fewer.
- The live roadmap surface (outside the archive) is under 10% of today's word count.
- A Tier 0 change goes from claim to merge with no owner action and no documentation-only commits.
- Product architecture, isolation, boundary and documentation-reference tests stay green and
  unchanged; obsolete process assertions are replaced in the pull request that retires their
  mechanism.

## Open questions for the owner

1. Tier 1: owner review at the next significant-change checkpoint after merge (recommended), or a
   skim before merge?
2. Plans as the first commit of the working draft pull request (recommended), or as separate
   GitHub issues?
3. Ledger granularity: about one entry per creator-recognizable action (recommended), or coarser?
4. Which R217.S11 obligations, if any, should be retired by owner decision (for example the
   native-touch cell)? The rest carry into the lean gate.
5. Does T5 depth pause until T4 delivers a working publish loop?
