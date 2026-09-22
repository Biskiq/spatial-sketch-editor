# Phase 0 evidence workspace — index

```text
ROLE:  NAVIGATION ONLY — output paths and assignment boundaries.
NOT:   status · plan · decision · acceptance · contract · evidence authority · tracker
STATE: ../../../operations/architecture-cycle.md   (sole live meta-state authority)
RANGE: ./2026-09-22-P0-frozen-evidence-range.md   (frozen; both reviewers get exactly this)
```

One bounded cycle stage, four isolated workspaces. This directory prepares **where** each
investigation lands and **who owns it**, and records nothing about what any of them will find. The
mechanical control pass has since completed (`./mechanical-control-pass.md`); the three
investigations have no output yet.

## Output destinations and assignment boundaries

| Output | Owner workspace / branch | Responsibility |
|---|---|---|
| `mechanical-control-pass.md` | Coordination — `meta/phase0` | bounded structural control pass, run **before** semantic review · **complete 2026-09-22** |
| `review-a.md` | Reviewer A — `meta/phase0-review-a` | independent semantic architecture review |
| `review-b.md` | Reviewer B — `meta/phase0-review-b` | independent semantic architecture review |
| `structural-workflow.md` | Workflow — `meta/phase0-workflow` | structural-workflow companion diagnostic |
| `adjudication.md` | Coordination — `meta/phase0` | owner adjudication record and the evidence integration |

```text
mechanical-control-pass.md  a few already-cheap structural sets, provenance-labelled; precedes the
                            semantic reviews and is NOT the structural-workflow diagnostic
review-a.md                 one of two fresh-context semantic architecture reviews (lane A)
review-b.md                 the other, run independently over the same frozen range (lane A)
structural-workflow.md      separate question, separate evidence — NOT a third architecture reviewer
adjudication.md             written only after both reviews and the diagnostic are frozen
```

Every output must record source, method, revision range, evidence and limitations. An output
without its revision range is not usable as Phase-0 evidence.

## Isolation rules

- Each workspace is a separate Git worktree on its own branch. Reviewers share no working directory.
- **Publication embargo — both or neither.** Neither review is pushed, published, posted, summarised
  or integrated until **both** independent outputs are frozen. Finishing first is not a licence to
  publish: pushing Reviewer A while Reviewer B is still working destroys the independence the
  two-review design exists to produce, and it is forbidden even though A's output is complete.
- **Working-directory separation is not information separation.** Worktrees and branches share one
  local Git object store and one set of refs. A reviewer must not read the other review's branch,
  commits or worktree — no `git log <other-branch>`, no `git show <other-branch>:<path>`, no
  cross-worktree file reads, no inspecting the other reviewer's worktree directory. The embargo is
  an instruction because the filesystem does not enforce it.
- The workflow diagnostic is not an architecture reviewer: an architecture finding never justifies a
  tooling or workflow mechanism, and a workflow finding never justifies an architecture contract. The
  two lanes adjudicate separately and transition together.
- The coordination workspace integrates completed evidence only once the embargo lifts — both
  independent outputs frozen — and it is the only workspace that writes `adjudication.md`.

## Lifecycle boundary

- This directory holds **work artifacts**. At cycle completion they shed authority under the
  closed-work rule (path-preserving stub with a recovery anchor), like any other plan/research/QA
  artifact.
- No second tracker, no permanent evidence registry and no standing audit is created here.
- `PHASE_0_ACTIVE` is the current stage. The mechanical control pass is **complete** and written to
  `./mechanical-control-pass.md`; the two semantic reviews and the workflow diagnostic are owed and
  none has run, and neither review output exists. Evidence collection does not advance the cycle; the
  `ADJUDICATION` transition does, and it is the owner's.
