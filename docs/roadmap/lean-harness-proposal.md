# Lean harness proposal — documentation and agent-workflow prune

**Status:** draft proposal for owner review. It authorizes nothing and changes no rule until the
owner merges it. **Timing:** execute after R217.S25 merges and closes out, and before R217.S11
(the integrated final gate) starts. Remaining R217.S24 follow-up and R217.S25 finish under the
current rules.

## Why

The repository's routing and documentation exist so that agents can maintain the project and move
it toward the [North Star](../reference/north-star.md) with the owner reviewing occasionally. The
intent is right. The cost has outgrown it:

- `docs/` holds about 386 Markdown files and about 600k words (archive included); 281 of those
  files are roadmap documents.
- Since 2026-10-01, 729 of 1,191 commits touched documentation and 453 touched application or
  package code.
- R217.S24's acceptance record is about 2,530 words against a 408-word plan. R217.S11's plan alone
  is about 2,850 words.
- Merge anchors get their own pull requests (for example #257 after #256), although Git already
  records the merge.
- [The release list](./now.md) stores permission as paragraphs of authorization history that an
  agent must parse before it may start.
- Agents follow the rules too literally: slices end in a documentation-only final acceptance plus
  bug fixes, closeouts stall waiting for independent review, and planning requests cross-track
  review between tracks whose "owners" are all agents.

The durable reference tier is not the problem. The North Star, architecture, F contract, design
system and component contracts together are about 60k words and stay. The bloat is roadmap state,
authorization records, acceptance prose and archive churn.

## Goals

1. **Lean onboarding.** A new agent or team member asks "what's next?" and learns, in a handful of
   reads, what is shipped, what is missing and what is already claimed.
2. **Parallel work without duplication.** Independent work can be picked up safely; nobody builds
   the same thing twice.
3. **Self-building toward the North Star.** Given enough compute, an agent can read the North Star,
   find the next gap, build it, prove it and merge it, escalating only for real judgment calls.
4. **Bounded context.** Agents load only what their task needs, enforced by repository structure
   rather than by reading rules.
5. **Keep the real guardrails.** Sacred contracts, semantic authorities, visitor isolation and the
   boundary tests stay. Strictness moves from prose into executable checks.

## Principles

- **Truth in the repo, claims in GitHub.** Shipped and passing state is durable and lives in the
  repository. Who-is-working-on-what is ephemeral and lives in draft pull requests or assigned
  issues, so batons and release rows stop generating commits.
- **Checks over prose.** A rule that can be a test or lint becomes one, with an error message that
  says how to fix the violation. A rule that cannot be checked is guidance and blocks nothing.
- **Structure over etiquette.** Progressive disclosure comes from where files live and how they
  open, not from instructions on how to read.
- **Docs change with code.** A behavior change and its contract update ship in the same pull
  request. No separate documentation, closeout or anchor pull requests.
- **Delete by default.** Closed plans and authorization history move to the archive; Git keeps the
  rest.
- **Judgment clause.** When following a rule costs more than the risk it guards, the agent states
  that in one line in the pull request and proceeds. Tier 2 work is excepted.

## Changes

### A — One state file: the capability ledger

Add a root `capabilities.json` seeded from the North Star. It is the single source for "what is
shipped and what is missing" and the definition of done that lets agents stop. Roadmap tables
become generated views of it, not hand-maintained registers.

```json
{
  "id": "publish.hosted-link",
  "northStar": "north-star.md#preview-and-publish",
  "area": "release",
  "state": "missing",
  "checks": ["npm run test:e2e -- publish-hosted-link"],
  "passes": false,
  "quality": ["design-system screenshot review", "visitor journey walkthrough"]
}
```

- `state` is one of `missing`, `partial` or `shipped`; `passes` flips only when every check
  passes in CI.
- Agents edit only `state` and `passes` during normal work; adding or reshaping capabilities is
  Tier 2.
- A small script validates the file and lists gaps; the gap scanner (H) reads it.

### B — Claims move to GitHub

- Claiming work means opening a draft pull request (or self-assigning an issue) titled with the
  capability id.
- An agent checks open drafts before starting. One `gh` call replaces reading per-track batons.
- The per-track `current.md` batons and [the release list](./now.md) retire to the archive.

### C — Autonomy by risk tier

This table replaces per-slice owner releases.

```text
Tier 0  inside one area, no contract or format change
        → agent plans, builds, gets one fresh-context agent review, merges on green CI
Tier 1  touches a sacred contract, persisted format, cross-domain acceptance (F.4)
        or the visitor/public surface
        → fresh-context agent review, then owner skims before merge
Tier 2  changes the North Star or capability ledger shape, adds an authority, migrates
        production data, activates production, licence or new dependency
        → owner decides
```

### D — Tracks become ownership areas, not review boundaries

- Keep T1–T5 as areas of the codebase, mapped to paths in a CODEOWNERS-style file.
- A script, not the agent, decides when another area must review: only when a diff touches that
  area's contract files.
- Planning never triggers cross-track review. When human teammates join, the same ownership file
  routes their reviews.
- [Cross-track execution](./cross-track-execution.md) shrinks to the ownership map and merge-order
  rules, or retires.

### E — Plan-writing rules

Every slice plan uses one template, capped at about 600 words:

```text
Goal        capability id + North Star link
Scope       in / out
Contracts   which contracts it touches → sets the tier
Checks      spec files or commands, written first and failing before implementation
Risks       what could go wrong and how it would show
```

- **A slice is one user-visible, demoable behavior.** Refactors and bug fixes are ordinary pull
  requests with a regression test and no plan.
- **No final-gate slices.** A phase is accepted when every slice check passes, one end-to-end
  journey spec for the phase passes, and the owner does a short walkthrough. Defects found then are
  fix pull requests, not a slice and not a document.
- **No acceptance documents.** Evidence goes in the pull request description; screenshots go in
  the pull request, not the repository. Durable browser acceptance becomes a committed Playwright
  spec rather than captured JSON evidence.
- **One review round with severity.** A fresh-context reviewer subagent, spawned by the
  implementer, reviews once. P0 and P1 block; P2 and below become issues unless trivial. Escalate
  to the owner only on disagreement or Tier 2.
- **Closeout happens in the same pull request:** flip `passes` and move the plan to completed.
- **Plans are frozen after merge.** Deviations are recorded in the pull request.

The [slice-closeout skill](../../.agents/skills/slice-closeout/SKILL.md) and
[phase-closeout skill](../../.agents/skills/phase-closeout/SKILL.md) are rewritten to this flow.

### F — Structural progressive disclosure

- **Nested AGENTS.md files** inside each package or area hold that area's local rules and point to
  its contracts. Agent tools load them when work happens in that directory.
- **A path-to-doc map** (and optionally a context script that takes changed files and prints the
  relevant doc sections) replaces concern-based routing.
- **Every durable doc opens with a header box** of at most ten lines: what it covers, its key
  invariants, the paths it governs, and when to read further.
- **The [docs router](../README.md) shrinks to an index** of about 40 lines, one line per doc.
- **Authority collapses to three levels:** code and tests state current behavior; reference
  contracts state invariants; the North Star states intent. Plans are temporary.
- **Deep exploration runs in subagents** that return short summaries, so the main session stays
  clean without rationing reads.
- [AGENTS.md](../../AGENTS.md) drops the reading-etiquette and precedence prose (current rules 9
  and 10) and stays at or under about 100 lines. A new line is added only after an observed agent
  failure.

### G — Reference tier: keep and trim

- **Keep** the North Star, architecture, the F contract, component contracts and the
  [shell and visual-system contract](../reference/design-system/editor-shell-and-visual-system.md).
  The design system is the taste specification agents need to reach polish.
- **Trim** the design system to rules and tokens. Tokens live in code and the doc points to them.
  Designer-brief summaries are generated on demand rather than maintained by hand.
- **Decision records:** contract-changing decisions stay as one-page ADRs. Authorization records
  move to the archive; the tier table replaces them.

### H — Two scheduled agents

- **Gardener (weekly):** deletes dead docs, archives closed plans, flags drift between docs and
  code, and opens one reviewable pull request.
- **Gap scanner:** compares the North Star with the capability ledger, checks open claims, and
  proposes the next unclaimed slice with a draft plan.

## Sequencing

1. R217.S24 finishes any open review follow-up under the current rules (its implementation and
   closeout anchors are already on `main` at 08602245).
2. R217.S25 merges and closes out under the current rules. No new slice starts afterward until
   this proposal is decided.
3. The owner reviews and merges this proposal (Tier 2 by its own definition).
4. **Prune pull request 1, structure:** new AGENTS.md, nested AGENTS.md files, header boxes,
   router index, path-to-doc map.
5. **Prune pull request 2, workflow:** capability ledger seeded from the North Star, tier table,
   plan template, rewritten closeout skills, ownership map; retire batons and the release list.
6. **Prune pull request 3, archive sweep:** closed phases, authorization records and completed
   plans move to the archive; the documentation-reference gate stays green throughout.
7. **R217.S11 runs as the first lean final gate:** its existing plan is replaced by the end-to-end
   journey spec, green CI and an owner walkthrough. R217 closes.
8. T4 (release and delivery) is the first track planned entirely under the new rules.
9. The gardener and gap scanner are scheduled after the ledger exists.

## What does not change

- The hard rules on Camera authority, distinct semantic authorities, authored-truth exclusions,
  visitor isolation and no second compiler.
- The public-surface and preview-surface boundary tests and the documentation-reference gate.
- The North Star's ratified direction and the creative-depth admission test.
- Owner control of North Star changes, production activation, licence and dependencies.

## Risks

- **Lower review bar, more slop.** Mitigated by the tier table, executable checks and the gardener.
- **Agents claim done too early.** Mitigated by checks written first and `passes` flipping only in
  CI.
- **The prune becomes its own governance project.** Mitigated by three bounded pull requests and
  no new process documents beyond this one.
- **Lost history.** Nothing is deleted outright: closed material moves to the archive, and Git
  keeps everything.

## Acceptance for this proposal

- A fresh agent, given only the repository, answers "what's next and is anyone on it?" in five or
  fewer file reads plus one `gh` call.
- AGENTS.md is about 100 lines or fewer; the router index is about 40 lines or fewer.
- The live roadmap surface (outside the archive) is under 10% of today's word count.
- A Tier 0 slice goes from plan to merge with no owner action and no documentation-only commits.
- All existing architecture and documentation-reference tests stay green.

## Open questions for the owner

1. Is the capability ledger JSON in the repository, or GitHub issues with a label scheme? This
   proposal recommends JSON for shipped state and GitHub only for claims.
2. Should Tier 1 require an owner skim, or only a second fresh-context agent review?
3. Should R217.S11's existing plan be retired outright or kept in the archive as reference?
4. Does T5 depth pause until T4 delivers a working publish loop?
