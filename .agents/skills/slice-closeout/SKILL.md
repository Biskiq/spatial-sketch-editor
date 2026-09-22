---
name: slice-closeout
description: Close a shipped roadmap slice/child deterministically. Use when a roadmap slice has completed acceptance and is ready to close, or when explicitly asked to close/ship/archive that slice. If the slice is its phase's declared final gate, this makes the phase closable and stops — closing the phase itself is the separate, owner-invoked phase-closeout skill.
---

# Slice Closeout

Deterministic slice lifecycle: plan → implementation → QA → reference update → handoff → closed
work → preservation report. Closing a declared final phase gate makes the phase *closable*; it
never closes the phase.

Two goals at once: keep the **live knowledge surface small and deterministic**, and keep future
debugging/architectural archaeology **cheap**. Closed work is *compacted, never deleted*, and a
recovered body is never a dead end — it must lead back to the live owner of the behaviour.

## Guard — is this the phase's declared final gate?

Read the phase README (`docs/roadmap/<phase>/README.md`) **before step 1** and compare this
child against its declared final gate:

```text
no FINAL PHASE GATE line, or it names another child
  → ordinary child close: run steps 1–11.

FINAL PHASE GATE names this child
  → run steps 1–6, set the pending-owner baton (step 7 override), finish the
    slice's own hygiene (steps 8–11, with the final-gate artifact exception in
    step 8), then STOP. The child is fully closed; the phase becomes CLOSABLE,
    not CLOSED. Closing the phase is a separate, owner-invoked procedure — see
    "Final-gate hand-off" below.
```

Finality is never inferred from child numbering, from "this looks like the last child", or from
the gate artifact's title — the declared line is the only signal. A normal child close therefore
cannot accidentally close its parent, and no child close ever touches P-level status or the
Architecture Cycle.

## Procedure

1. Verify implementation/acceptance: run the slice acceptance rows live plus
   `npm test`, `npm run check`, `npm run build` as the plan requires. Record gate numbers.
   Do not rerun already-valid expensive gates when unchanged evidence is
   trustworthy; rerun only when changes invalidate evidence, acceptance
   requires it, or uncertainty exists.
2. Inspect any active checkpoint for that slice: promote durable findings first
   (deferred bug → `operations/tech-debt/`; completed research → owning
   artifact; landed behavior → `reference/*`; verification/rulings →
   closeout/archive; status → phase README), then delete the checkpoint
   and remove any `current.md` RESUME pointer. Do not archive raw checkpoints.
3. Update affected durable reference contracts (`docs/reference/...`) only if the
   slice established or changed durable knowledge future work would otherwise
   rediscover; reconcile/supersede stale claims it invalidates.
   Roadmap proposals must never silently become reference truth; only landed behavior moves.
   **Promotion backstop (any closing work artifact):** before it closes, promote final
   durable decisions/rules to their actual current owner and fold the final conclusion into
   that owner — do **not** promote review chronology or reviewer discussion, because Git/PR
   history owns deliberation. Do not rewrite already-clean artifacts or write a review
   summary merely for completeness. This is a safety net; the durable plan-writing rule is
   owned by `docs/README.md` ("Plan hygiene").
4. Write/update slice closeout evidence (acceptance record, rulings, residuals).
5. Mark the slice shipped in its phase README (`docs/roadmap/<phase>/README.md`) —
   the phase README owns child status/order and routes each child's exact plan/QA
   artifact directly. Do not create or maintain a slice README/index for status;
   the exact plan stays its own artifact.
6. Update `docs/roadmap/README.md` only if P-level execution/planning/order changed.
   A slice close never changes the phase's own P-level status.
7. Update `docs/operations/current.md` to the next work item (baton, not history).
   **Final-gate override:** at a declared final gate whose phase is not yet owner-closed, the next
   work item *is* the phase-close decision — set that baton (see "Final-gate hand-off" below).
   Then finish the slice's own hygiene (steps 8–11) and STOP. Do not mark the P-level phase
   shipped, do not write a `PHASE CLOSE` block, do not transition `architecture-cycle.md`, and do
   not write cycle META; all of that belongs to the owner-invoked `phase-closeout` skill.
8. Closed work: apply "Closed work (hybrid rule)" below to every artifact this close touches. Prose gets a path-preserving stub (the default); durable research conclusions
   are promoted to their `reference/*` owner **first**; only renderable evidence is archived.
   Write the result as the Closeout Preservation Report.
   **Final-gate exception:** keep the declared final-gate artifact itself live while it still
   serves as phase-close evidence (`phase-closeout` step 2 re-reads it to verify the gate).
   Compact the child's other completed work normally now; `phase-closeout` owns the gate
   artifact's final compaction when the phase is actually closed. When `FINAL PHASE GATE` is
   later reassigned, the change that reassigns it must also process the former gate artifact as
   ordinary completed child work under this closed-work rule.
9. Prune transient/stale artifacts (empty states, superseded husks, `__qa-*` plates).
10. Repair links: for every path this close **moved in the live tree**, search the repo and fix
    Markdown, HTML/image and prototype relative paths; verify case-sensitive paths. Do **not**
    rewrite relative links inside an archived copy — the live stub is the link target (see
    "Archive copying").
11. Verify no live router treats closed material as authority (`docs/README.md`,
    `docs/roadmap/README.md`, phase READMEs, `docs/operations/current.md`) and that this close
    created **no new** live → archived-prose link. There is no checked-in docs/link checker: run
    the manual search explicitly over every moved or stubbed path, including evidence assets, and
    verify case-sensitive paths.

## Final-gate hand-off

Reached only from the guard, when this child is the phase's declared final gate. Run steps 1–6,
apply the step-7 override, finish the slice-local hygiene (steps 8–11, with the gate-artifact
exception in step 8), then STOP.

The child is fully closed; the phase is CLOSABLE and stays in-progress. Major-phase closure is
owner-invoked only.

Set the baton:

```text
PHASE:    <phase>
CHILD:    <final gate child> — accepted (<date>)
STAGE:    phase-close decision pending owner ratification
NEXT:     owner may close <phase>, or leave it open
ROUTE:    phase README FINAL PHASE GATE block + the gate artifact
BLOCKER:  owner phase-close decision
```

STOP means: the slice is done and the baton is set. Do not close the phase here:

```text
- no P-level phase status change
- no `PHASE CLOSE` block
- no `architecture-cycle.md` transition
- no cycle META write or removal
- no automatic `phase-closeout`
```

**Same-task explicit authorization.** If the owner explicitly asked to close the final slice *and*
to close the major phase in the same task (for example "close P23.16 and then close P23"), that
authorization already exists: continue into the `phase-closeout` skill, which validates the owner
request itself before acting. A pending-baton message, an accepted final gate, or "the phase looks
complete" never manufactures that authorization.

## Closed work (hybrid rule) — compaction, not deletion

Classify every artifact this close touches:

```text
STUB + EXACT GIT RECOVERY — the default for anything readable
  any prose work artifact: plan · QA/acceptance record · reconciliation · addendum · research ·
  design study · owner-rulings record. The body leaves the live tree; a stub stays at its path.

ARCHIVE A COPY (docs/archive/roadmap/<phase>/<slice>/…, plus the stub at the live path)
  renderable/browsable evidence only: PNG/SVG/HTML atlases, screenshots, plates, measured
  artifacts, fixtures whose value is that one can look at them.

LEAVE ALONE
  already-correctly-archived material · P1–P22 · older closed slices · the live phase README
```

### What the stub must carry

Enough that a future agent answers **without archaeology**:

```text
delivered      what the slice actually shipped, one or two lines
contract       the final accepted contract/decision, or the reference/* doc that now owns it
provenance     implementation PR / accepted revision
evidence       the verification actually obtained — gate numbers, manual-owed rows, oracles
entry points   the code, validation and regression tests that own the behaviour
residuals      deferred or carried scope, named, with owners
recovery       git show <A>:<path>  [· git show closed/<phase>.<slice>:<path>]
```

Task-by-task execution history, review chronology and reviewer commentary are **not** the stub's
job — Git/PR history owns deliberation. Entry points are plain paths in the stub; never scatter
provenance comments through production code to satisfy this rule. A stub must never be readable as
live instructions: `AUTHORITY: NONE`, and nothing that competes with `reference/*`.

### Research artifacts — classify, don't blanket-rule

```text
A  durable current knowledge       findings still needed to understand current behaviour →
                                   promote/reconcile into the owning docs/reference/** doc, then
                                   stub. Live architecture must never depend on an unowned
                                   roadmap research file.
B  decision-support research       alternatives, rejected approaches, explorations, harvests →
                                   stub + anchor once its conclusions are promoted (A) or spent.
                                   No archive copy: this is exactly what the anchor is for.
C  independently valuable evidence atlases, screenshots, plates, measurements → archive a copy.
```

One artifact may be both A and C — promote the finding, archive the rendering. Promotion obeys
`docs/README.md`: descriptive landed facts may move; **speculative or rejected research never
becomes reference truth**, and an approved roadmap proposal moves only once it lands.

### Anchor mechanics

Anchor `A` is the last commit that contained the artifact's full body; compute it **before**
writing the stub:

```bash
A=$(git log -1 --format=%H -- <path>)
```

The stub records `git show <A>:<path>`. Never use `--amend` — it rewrites `A` and invalidates the
written anchor. P2 canonical: the accepted full body already lands on main → compute/verify
A → a later commit/PR compacts and records A. P1 optimisation: A + compaction in one PR →
only with an explicit merge-commit guarantee; never assume squash/rebase preserves A.
If the recovery line was invalidated by a squash or force-push, annotate it to the reachable form
(`git fetch origin refs/pull/<n>/head && git show <A>:<path>`) and record the degradation. Verify
in the same session, after merge:

```bash
git merge-base --is-ancestor <A> main && echo "anchor reachable"
git show <A>:<path> | head -3
```

**Durable tag — the anchor's insurance.** A bare SHA survives only while its commit is reachable:
a squash merge, a deleted branch or `git gc --prune` can orphan it, and the P1 path above is
exactly where that risk is highest. When reachability rests on a process promise (P1), or the
owner wants anchors immune to history surgery, tag the anchor commit itself:

```bash
git tag -a closed/<phase>.<slice> "$A" -m "<slice> closed work — anchor $A"
```

Tag `A`, never the compaction commit, and determine `A` first. The closeout does not push, so flag
the tag to the owner for pushing; without a push it protects only the local clone. With the tag
created, the stub may record both refs, keeping the SHA for provenance. This repository has no tag
convention today — it is new, so name it in the phase README the first time it is used.

### Archive copying

`docs/archive/**` means **browsable evidence**, never a second prose knowledge tree. Prose that
used to be bundled (a design/QA/research tree) is stubbed instead: the anchor already guarantees
exact recovery, so a copied body buys nothing and costs a duplicate blob plus a second link
surface. This narrows the archive-copy scope ratified as OD-4 ("multi-file bundles and non-text
evidence") to the part that carries real value — what you can only *look at*.

- Copy bytes **unmodified**. Do not rewrite relative links or prepend headers to suit the new
  depth: an unmodified copy is byte-identical, so Git stores one blob for both paths and the copy
  costs no object storage; a rewritten copy forks the blob into a real duplicate and creates a
  second link-maintenance surface.
- Preserve the bundle's internal structure so its own relative links keep resolving — an atlas
  HTML and the screenshots beside it move together at the same relative depth.
- Links that escape the bundle go stale. That is expected: record it once in the nearest live
  stub (or a one-line `CLOSED.md` beside the copy) and don't repair the copy.
- No size cap. Report the archived size in the preservation report so growth stays visible.

### Live → archive dependencies

> A slice closeout must not create a **new** live-document dependency on archived prose.

If a live doc still needs something from a prose research/design artifact, promote it into that
information's live owner first, then stub the artifact. Live docs cite the **stub at its own path**
(which carries `AUTHORITY: NONE` and the anchor) — never an archive copy of prose. Historical
dependencies made before this rule are left alone unless this close touches them.

### Non-churn

Do not rewrite older closed slices, P1–P22 archives, or grandfathered flat plans purely for
consistency. Migrate only what the current close touches, or what an explicit owner ruling
directs — OD-4's bounded batch migration of the grandfathered P23 plans at P23 close is such a
ruling.

## Closeout preservation report

Close with this block written into the slice's closeout evidence (the QA-record stub), so
preservation cost and the resulting live surface are explicit rather than assumed:

```text
CLOSEOUT PRESERVATION — <slice> (<date>)
prose compacted:                 N   stubs at their own paths
reference promotions:            N   durable findings moved to their real owner in reference/*
renderable evidence archived:    N files / <size>
transient artifacts removed:     N
historical anchor:               <sha> [· tag closed/<phase>.<slice>]
new live → archive prose links:  0   non-zero is a violation to fix, not to report
manual-owed verification rows:   N   kept distinct from automated evidence
remaining deferred items:        N
```
