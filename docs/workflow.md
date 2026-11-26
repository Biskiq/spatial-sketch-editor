# Workflow — work, claims, tiers and reviews

The owner starts batches. Follow [focus](../focus.md), where holds stop new claims. Finish
in-flight pull requests or park them as drafts. Use `npm run status` for computed status.

## Start a batch

A draft PR or self-assigned issue with the capability ID in its title is a claim. Check open
issues and PRs before claiming and immediately afterward. The earlier claim keeps the work.
A flagged issue has the capability label and one of these labels.

| Flag | Action |
| --- | --- |
| `needs-decision` | Use a reversible default or pick other work. |
| `needs-ux` | Build the logic behind a minimal surface and leave final UX for design. |
| `needs-research` | Run a bounded spike that leads to a decision. |
| `ambiguous` | Ask in the issue and proceed with the most reversible reading. |
| `bug` | Write a failing tagged test first, then fix it. |

Record defects as `bug` issues. A skipped required check fails the gate.

## Risk tiers (the highest applicable tier wins)

| Tier | Scope | Gate |
| --- | --- | --- |
| 0 | Ordinary work | One fresh-context review and green CI |
| 1 | Contract detail within hard rules, visitor/public surface, shared shell, or persisted format with prior-reader support or tested recovery | Fresh-context review, green CI and owner review at the next checkpoint |
| 2 | Hard rule, North Star, ledger shape, material approved-design departure, incompatible format without tested recovery, check removal/downgrade, owner review, production data or activation, licence or new dependency | Owner decides before merge |

Scoped owner approval covers implementation of that design, including a shared shell change within
the approval. Apply the other Tier 2 criteria independently.

## Work units and plans

A PR delivers one or more capability checks. Plan multi-PR, Tier 2 and invention-risking work
as the first commit of its own draft PR, reviewed before code by the owner for Tier 2 or a
fresh-context agent otherwise. Link settled designs and specify unresolved decisions, integration
and checks. Promote lasting rules and delete the completed plan before merge.

Give a fresh-context reviewer the diff, touched area guides, approved design and capability checks.
P0/P1 findings block. File nontrivial P2 and lower findings as issues. Merge closes the work in
the implementation PR. Keep acceptance evidence there.

## CI, queue and merging

Implement → focused local tests → PR → review → CI → merge queue → merge. The native
queue validates against current `main` once activated. Use it to integrate sibling work.
The single required check is `merge gate`. See [CI and merge automation](./operations/ci-merge-automation.md)
for profiles and the [test contract](../apps/editor/tests/README.md) for verification.

T1–T5 identify product areas open to contributors following their area guides and invariants.
Claims and small PRs coordinate concurrent work.

## On-demand skills

Use `work-checkpoint` for interrupted work, `owner-checkpoint` for significant changes and
next unclaimed work, `gardener` to archive dead or closed material in one PR, and `breaker`
to turn defects into failing tagged tests or `bug` issues. Invoke them on demand.

## Design and reference maintenance

[Prototype approvals](../prototypes/README.md) identify either exploratory interaction donors
or approved production UX targets. Harvest only explicitly accepted findings from donors.
An explicit production approval sets the target for named surfaces, interactions and responsive
states. Treat unclear approval as research.

A later explicit approval supersedes older design details within its scope. Domain ownership,
identity, geometry, security, persistence, selection, history and visitor isolation still apply.
Bring conflicting production invariants to the owner before changing the design.

Link approved states in the implementation PR and show representative comparisons for material
visual changes, including constrained layouts when affected. Record material departures for an
owner decision before merge. Update enduring references for actual contract changes, design
promotion, material contradictions or deliberate audits. Replace superseded text and remove
completed plans and obsolete approvals after preserving unique obligations. Read research on demand.
