# Phase 0 evidence workspace — index

```text
ROLE:  NAVIGATION ONLY — output paths and assignment boundaries.
NOT:   status · plan · decision · acceptance · contract · evidence authority · tracker
STATE: ../../../operations/architecture-cycle.md   (sole live meta-state authority)
RANGE: ./2026-09-22-P0-frozen-evidence-range.md   (frozen; both reviewers get exactly this)
```

One bounded cycle stage, four outputs, four isolated workspaces. No output exists yet: this
directory prepares **where** each investigation lands and **who owns it**, and records nothing
about what any of them will find.

## Output destinations and assignment boundaries

| Output | Owner workspace / branch | Responsibility |
|---|---|---|
| `review-a.md` | Reviewer A — `meta/phase0-review-a` | independent semantic architecture review |
| `review-b.md` | Reviewer B — `meta/phase0-review-b` | independent semantic architecture review |
| `structural-workflow.md` | Workflow — `meta/phase0-workflow` | structural-workflow companion diagnostic |
| `adjudication.md` | Coordination — `meta/phase0` | owner adjudication record and the evidence integration |

```text
review-a.md              one of two fresh-context semantic architecture reviews (lane A)
review-b.md              the other, run independently over the same frozen range (lane A)
structural-workflow.md   separate question, separate evidence — NOT a third architecture reviewer
adjudication.md          written only after both reviews and the diagnostic are frozen
```

Every output must record source, method, revision range, evidence and limitations. An output
without its revision range is not usable as Phase-0 evidence.

## Isolation rules

- Each workspace is a separate Git worktree on its own branch. Reviewers share no working directory.
- **Reviewer A and Reviewer B must not read each other's findings before owner adjudication.** Their
  branches are not merged, and neither branch is inspected by the other, until both outputs are
  frozen.
- The workflow diagnostic is not an architecture reviewer: an architecture finding never justifies a
  tooling or workflow mechanism, and a workflow finding never justifies an architecture contract. The
  two lanes adjudicate separately and transition together.
- The coordination workspace integrates completed evidence only after the independent outputs are
  frozen, and it is the only workspace that writes `adjudication.md`.

## Lifecycle boundary

- This directory holds **work artifacts**. At cycle completion they shed authority under the
  closed-work rule (path-preserving stub with a recovery anchor), like any other plan/research/QA
  artifact.
- No second tracker, no permanent evidence registry and no standing audit is created here.
- `PHASE_0_ACTIVE` is the current stage: the three investigations are owed and none has run.
  Evidence collection does not advance the cycle; the `ADJUDICATION` transition does, and it is the
  owner's.
