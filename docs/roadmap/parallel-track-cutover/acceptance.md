# R115.S01 — execution acceptance record — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's `PHASE CLOSE`
           block (./README.md) and the track register's `shipped` row
           (../README.md#track-register); the phase's plan of record is
           ./implementation-plan.md.

STATUS:    SHIPPED and CLOSED 2026-10-14. `R115.S01` was closed by `slice-closeout`, which left
           R115 `closable`; the owner then invoked `phase-closeout`, which compacted this record —
           the declared final-gate artifact — to this stub. That is the only reason the body is
           gone: nothing was retracted, and every result below is the one that was accepted.
ROLE:      accept and evidence the architecture reset PR #115 performed (frozen-lane isolation,
           aggressive prune, documentation cutover, execution system).
NOT:       a product contract · a plan · a status store · authority for new work · authority for
           any capability the reset declined to build (see Residuals)
```

## Delivered

PR #115 externalized the frozen Chopin museum project out of the repository, pruned the
new-product tree to its foundation, installed current-format-only readers and writers, consolidated
documentation onto the reduced current truth, and replaced sequential capability planning with the
Track → Phase → Slice execution system whose gates are enforced by `tests/docs/`. The phase ran as
WP0 → WP1 → WP2 → WP3 → WP3R → WP3T → WP4 → WP5 → WP6 → WP7 (`./implementation-plan.md` §12) and
was accepted against the plan's §13 criteria with no unmet criterion and no unresolved
implementation-acceptance failure.

## Contract (final, accepted)

The reset's accepted scope is the plan (`./implementation-plan.md`, revision 4): the retained
foundation tree of its §4.1/§4.3, the documented intentional capability loss of §4.4, and the
execution-structure rules of §9. Durable product truth stayed where it already lived under
`docs/reference/**`; that is what the close promotes nothing out of and what this record never
owned.

## Provenance

```text
implementation   PR #115 (frozen-lane isolation, prune and cutover); owner-authorized 2026-10-13,
                 implementation execution authorized through WP7
accepted revision  the WP6 acceptance head 3b30b408 and the WP7 closeout revision that followed it
landed           `main` at 6bd15aa2, as a rebased landing (see Recovery for the consequence)
evidence         WP0 manifests · WP2 Checkpoint B · WP3 Checkpoint C · WP3R Checkpoint D ·
                 WP3T Checkpoint D-T · WP4 documentation walk · WP5 execution structure ·
                 WP6 cross-reference sweep · WP7 final acceptance (recovered body §1–§23)
```

## Evidence

Recorded in the recovered body, at the revision each checkpoint names:

```text
final acceptance   §23.1 — the plan's §13 criteria, each checked against the tree, all met
integration         §23.2 — the complete §7.4 contract on the integrated tree, 0 skipped:
                    architecture lane 15 files / 131 tests · full editor suite 116 files /
                    1525 tests · editor, kernel-package and API type checks · production build ·
                    DB-backed API contracts 39 tests, 0 failures, 0 skipped against a local
                    PostgreSQL · clean whitespace check over the #115 range · the retained product
                    routes rendering with no failed request
isolation proof     the frozen folder is absent from this tree, `apps/museum` is gone and no
                    product file references it; the isolation test is green
manifests           §1–§5 — the closure counts, per-file source/test/docs manifests and the
                    protected hashes that classify every baseline path exactly once
manual-owed         the frozen-project Checkpoint A steps remain owner-verified WP1 evidence and
                    cannot be re-executed from this repository (§6.5)
merge verification  the landed `main` tree is identical to the accepted PR branch tip (empty diff),
                    so the recorded results describe the shipped code
```

## Entry points

```text
implementation   apps/editor/src/lib/authoring/README.md   the retention criteria for what survived
                 packages/project-model/src · packages/layout-core/src · packages/camera-core/src
                 apps/editor/src/lib/museum · apps/editor/src/lib/visitor · apps/api/src
validation       apps/editor/tests/docs/parallel-track-gates.test.ts      execution-structure gate
                 apps/editor/tests/docs/documentation-references.test.ts documentation gate
                 apps/editor/tests/lib/legacy-isolation.test.ts          frozen-lane isolation
plan / routing   ./implementation-plan.md · ./README.md · ../README.md
```

## Residuals

Named owners, unchanged by this close and none of them hidden:

```text
deferred production dispositions   b1 → T2 (the Scene unit) · b2 → T3 (the Save path) ·
                                   d1 → T2/T3 · d2 → T1 · c1 → `project-model` · c2/a7 retained
                                   as found (recorded body §10)
capability loss                    the loss list and each replacement's owner → recovered body
                                   §4.4 and ../t1-spatial-world/planning-evidence.md,
                                   ../t2-composition/planning-evidence.md,
                                   ../t3-experience/planning-evidence.md
TD ledger                          TD-1/TD-2 non-recurrence → T2/T1 planning evidence; TD-4/TD-5
                                   stay unresolved-by-design → docs/operations/tech-debt/README.md
production residue                 the stale `virtual:museum-editor-entry` declaration in
                                   apps/editor/src/vite-env.d.ts was reported, not edited
owner-visible deferrals            CI enforcement of the architecture lane stays an owner decision;
                                   the permanent-stub cost of the owner-ratified 2026-09-22 hybrid
                                   policy stays a bounded owner decision
retained, not compacted            ./implementation-plan.md stays live: the execution-structure gate
                                   reads its `VERIFICATION: exhaustive` declaration, and it is the
                                   phase's registered plan. It is therefore the one prose artifact of
                                   this phase a future close could still revisit, and doing so is an
                                   owner call, not an omission here.
```

## Recovery

```text
full accepted body (3875 lines: §1 closure counts, §2–§5 the source/test/docs manifests and
protected hashes, §6–§22 the per-checkpoint records and their review corrections, §23 the final
acceptance, the slice closeout, the R115.S01 preservation report and its limitations):

  git show 6bd15aa2:docs/roadmap/parallel-track-cutover/acceptance.md

ANCHOR DEGRADATION — R115.S01 (recorded, not hidden)
`R115.S01`'s own anchor 3b30b408 — tag `closed/r115.s01`, pushed to origin — is NOT an ancestor of
`main`: PR #115 landed rebased, so the branch's pre-merge revisions were rewritten even though the
tree is byte-identical to the landed one (an empty diff against the main-side revision 79dcf42e).
The primary routes above resolve `main`; the pre-merge revision resolves through the pushed tag or
the PR ref:

  git fetch origin tag closed/r115.s01 && git show 3b30b408:<path>
  git fetch origin refs/pull/115/head    && git show 3b30b408:<path>
  git show 79dcf42e:docs/roadmap/parallel-track-cutover/acceptance.md    (identical tree)

anchor 6bd15aa2 · tag `closed/r115` (created by the phase close; local only — not pushed by it,
and not required to resolve, because the anchor is an ancestor of `main`)

REQUIRED MERGE METHOD — P1: this closeout lands as a merge commit (no squash, no rebase), so the
recorded anchors stay ancestors of `main` and the recovery reads above resolve. Post-merge
verification is `git merge-base --is-ancestor 6bd15aa2 main` plus a `git show 6bd15aa2:<path>`
recovery read; it is owed by the owner's merge and is not claimed here.
```

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — R115 (phase close, 2026-10-14)
prose compacted:                1   acceptance.md, the declared gate artifact — this stub, at its own path
reference promotions:           0   durable truth already sat with its owners under docs/reference/**
renderable evidence archived:   0   the protected prototypes were conserved in place by plan §8.3
evidence stubs / manifests:     0
transient artifacts removed:    0
historical anchor:              6bd15aa2 · tag closed/r115 (local only — not pushed by the close)
new live → archive prose links: 0
manual-owed verification rows:  1   the frozen-project Checkpoint A steps (owner-verified WP1 evidence)
remaining deferred items:       named with owners in Residuals above
permanent stubs added:          1   (the owner-ratified 2026-09-22 hybrid policy's accepted cost)
```

**Why the plan was not compacted with the gate artifact.** `./implementation-plan.md` is still read
by `apps/editor/tests/docs/parallel-track-gates.test.ts`, whose final-gate rule requires the plan's
`VERIFICATION: exhaustive` declaration to resolve through the phase README's `Plan` cell, and it is
the phase's registered plan of record for the reduced tree. Compacting it would either break an
enforced contract or turn a live declaration into a stub written to satisfy a checker, so it is
retained full-body and named as a residual above. The two anchors above are the phase's complete
recovery surface.
