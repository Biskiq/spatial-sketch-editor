# Workflow — work, claims, tiers and reviews

**Role:** the settled agent workflow: focus, claims, flags, risk tiers, work units, plans and review.
**Not:** a status store, release list, baton, DAG or closeout procedure.
**Status is computed:** `npm run status`. **Focus:** [`../focus.md`](../focus.md).

## Start a batch

The owner starts a batch by prompt; nothing runs on a schedule. Prefer work that matches the focus
line. A hold stops new claims; in-flight work finishes its pull request or parks as a draft.

- **Claim:** a draft pull request or self-assigned issue whose title names the capability id. Check
  open issues and pull requests before claiming and again right after. The earlier claim keeps it.
- **Flag:** an issue carrying a capability label and one flag label.

| Flag | Meaning | What the agent does |
| --- | --- | --- |
| `needs-decision` | a product choice is undecided | proceed only on a reversible default; otherwise pick other work |
| `needs-ux` | the flow or UI is not designed | build the logic behind a minimal surface; never invent final UX |
| `needs-research` | the technical foundation is unknown | run a bounded spike whose exit is a decision |
| `ambiguous` | the spec is unclear or contradicts itself | ask in the issue and proceed on the most reversible reading |
| `bug` | behavior is wrong | write a failing tagged test first, then fix |

A defect lands as a `bug` issue. A skipped check counts as failing.

## Risk tiers (the highest applicable tier wins)

```text
Tier 0  everything not listed below
        → one fresh-context review; merge on green CI

Tier 1  contract details within the retained hard rules; the visitor/public surface or
        shared shell rules; a persisted format the previous reader still reads, or one
        with a tested recovery path
        → fresh-context review; merge on green CI; owner reviews at the next checkpoint

Tier 2  a retained hard rule, the North Star, the ledger's shape or a material departure
        from an approved design; an incompatible format without tested recovery;
        removing or downgrading a check; recording an owner review; production data or
        activation; licence; new dependency
        → the owner decides before merge
```

A prior scoped owner approval covers implementation of that design, including a shared shell change
within the approval. Apply the other Tier 2 criteria independently.

## Work units and plans

The unit of work is a pull request that adds or passes checks for one or more capability ids.

A plan is written when the work needs one: multi-PR work, Tier 2 work, or work where an implementer
would otherwise invent an interaction, algorithm or data shape. It is the first commit of the work's
own draft pull request, reviewed there before code (owner for Tier 2, otherwise a fresh-context
agent), then the same pull request implements it. Sections as needed: Goal, Design, Scope,
Specification, Checks, Flags, Risks. Link settled designs and specify only unresolved decisions,
integration and checks. Before final merge, promote enduring rules and delete the completed plan.

**One review round:** a fresh-context reviewer receives the diff, the touched areas' `AGENTS.md`,
the linked design and the capability checks. P0/P1 findings block; P2 and below become issues unless
trivial. **Merging is the closeout.** No acceptance documents, release rows, batons, phase-close
records or closeout pull requests.

## CI, queue and merging

The merge gate runs every pull request, every merge group and manual dispatch. A code pull request
runs the lean profile; merge groups run Full. The editor suite is three disjoint lanes
(`test:fast`, `test:arch`, `test:heavy`) whose union is `npm test`; CI runs each once and never
reruns the full suite on top. The single required context is `merge gate`.

The model is implement → focused local tests → PR → review → CI → merge queue → merge. Once the
owner activates the queue, it validates a batch against current `main`. Agents do not manually
rebase sibling work or rerun CI to integrate an unrelated merge. See
[CI and merge automation](./operations/ci-merge-automation.md).

## Areas, not gates

T1–T5 name areas (Spatial world, Composition, Experience, Release, Expressive geometry), not
permission gates. Anyone may change any area: read the touched area's `AGENTS.md`, keep its tests
green and respect the invariants its tests enforce. Parallel safety comes from claims and small pull
requests.

## On-demand skills

`work-checkpoint` preserves interrupted work; `owner-checkpoint` summarizes significant changes,
status movements, Tier 1 merges, ranked flags and next unclaimed work; `gardener` archives dead or
closed material and opens one reviewable pull request; `breaker` turns each defect it finds into a
failing tagged test or `bug` issue. None runs on a schedule.

## Design and reference maintenance

Prototype approvals have two modes, recorded in the design PR or the
[prototype catalogue](../prototypes/README.md): an **exploratory / interaction donor**, where only
explicitly harvested findings become product decisions, and an **approved production UX target**,
where an explicit owner decision sets the intended experience for named surfaces, interactions and
responsive states. Treat unclear approval as research evidence.

A later explicit approval supersedes an older prescription within its scope, from the time of
approval. Domain ownership, identity, geometry, security, persistence, selection, history and
visitor isolation are independent constraints. Bring a genuine conflict with a production invariant
to the owner before changing the design.

In the implementation PR, link the approved states and show representative comparisons for material
visual changes, including a constrained layout when behavior changes there. Record material
departures for an owner decision before merge.

References describe enduring principles, ownership, interfaces and invariants. Update them only for
an actual contract change, accepted design promotion, material contradiction or deliberate audit.
Replace superseded text rather than appending an amendment chain; delete completed plans and
obsolete authorization paperwork after extracting unique obligations. Keep research opt-in. Git is
history.
