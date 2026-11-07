# Workflow — work, claims, tiers and reviews

**Role:** the settled agent workflow: focus, claims, flags, risk tiers, work units, plans and review.
**Not:** a status store, release list, baton, DAG or closeout procedure.
**Status is computed:** `npm run status`. **Focus:** [`../focus.md`](../focus.md).

## Start a batch

- The owner starts a batch by prompt. No agent, skill or digest runs on a schedule.
- Prefer work that matches the focus line. A hold stops new claims; in-flight work finishes its
  pull request or parks as a draft.
- **Claim:** a draft pull request or self-assigned issue whose title names the capability id. Check
  open issues and pull requests before claiming, and again right after — two agents can both see
  "unclaimed" first. The earlier claim keeps it; the later one narrows or closes.
- **Flag:** an issue carrying a capability label and one flag label.

| Flag | Meaning | What the agent does |
| --- | --- | --- |
| `needs-decision` | a product choice is undecided | proceed only on a reversible default and record it; otherwise pick other work |
| `needs-ux` | the flow or UI is not designed | build the logic behind a minimal surface; never invent final UX |
| `needs-research` | the technical foundation is unknown | run a bounded spike whose exit is a decision |
| `ambiguous` | the spec or design is unclear or contradicts itself | ask in the issue and proceed on the most reversible reading |
| `bug` | behavior is wrong | write a failing tagged test first, then fix |

A defect lands as a `bug` issue; an automatable reproducer merges as an expected failure linked to
it. A skipped check counts as failing.

## Risk tiers (the highest applicable tier wins)

```text
Tier 0  everything not listed below
        → one fresh-context review; merge on green CI

Tier 1  contract details within the retained hard rules; the visitor/public surface or
        shared shell rules; a persisted format the previous reader still reads, or one
        with a tested migration and recovery path
        → fresh-context review; merge on green CI; owner reviews at the next checkpoint

Tier 2  a retained hard rule, the North Star, an approved design or the ledger's shape;
        a persisted-format change without that compatibility or tested recovery;
        removing or downgrading a check; recording an owner review; production data or
        activation; licence; new dependency
        → the owner decides before merge
```

Tier 0 and Tier 1 merge on the required green gate after one fresh-context review; Tier 2 waits
for the owner's decision. This workflow takes effect after the owner merges #259; until then the
current rules apply, and #259 itself remains owner-final-check/owner-merge only.

## Work units and plans

- The unit of work is a pull request that adds or passes checks for one or more capability ids.
- **A plan is written when the work needs one:** multi-PR work, Tier 2 work, or any work where an
  implementer would otherwise invent an interaction, algorithm or data shape. The plan is the first
  commit of the work's own draft pull request. It is reviewed in that draft before code is written
  (by the owner for Tier 2, otherwise by a fresh-context agent), then the same pull request
  implements it. Sections, as needed: Goal, Design, Scope, Specification, Checks, Flags, Risks.
  Detail is set by the no-invention test, not by length. Before final merge, promote genuinely enduring rules where needed and delete the completed plan.
  Git/PR history retains its review. Archive only evidence with a concrete retention purpose.
- **One review round:** a fresh-context reviewer receives the diff, the touched areas' `AGENTS.md`,
  the linked design and the capability checks. P0/P1 findings block; P2 and below become issues
  unless trivial.
- **Merging is the closeout.** No acceptance documents, release rows, batons, phase-close records or
  closeout pull requests. No dated decision-record tier is created. Canonical references directly state the resulting rules.

## Areas, not gates

T1–T5 name areas (Spatial world, Composition, Experience, Release, Expressive geometry), not
permission gates. Anyone may change any area: read the touched area's `AGENTS.md`, keep its tests
green and respect the invariants its tests enforce. Parallel safety comes from claims and small pull
requests; whoever merges second rebases.

## On-demand skills

None runs on a schedule. `work-checkpoint` preserves interrupted work; `owner-checkpoint`
summarizes significant changes, status movements, Tier 1 merges, ranked flags and next unclaimed
work for the owner; `gardener` moves dead or closed material to the archive and opens one
reviewable pull request; `breaker` explores `working` and `polished` capabilities and turns each
defect into a failing tagged test or `bug` issue.

## Design and reference maintenance

An explicitly owner-approved UX is target authority for its approved scope. Plan backward from it;
never lower it to match current code or shell limitations. Surface genuine conflicts with hard
invariants for owner judgment. Proposed research does not establish design approval.

Implementation acceptance triggers deliberate promotion of genuinely enduring rules when needed.
References describe enduring principles, ownership, interfaces and invariants. Update them only for
an actual contract change, accepted design promotion, material contradiction or deliberate audit;
routine implementation does not trigger reference edits. Replace superseded text rather than append
an amendment or reconciliation chain. Delete obsolete authorization paperwork and completed plans
after extracting unique obligations. Keep substantive research, alternatives, counterexamples and
runnable experiments opt-in. Archive only evidence with an explicit retention purpose; Git is history.
