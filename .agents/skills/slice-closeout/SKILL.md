---
name: slice-closeout
description: Close a shipped roadmap slice/child deterministically. Use when a roadmap slice has completed acceptance and is ready to close, or when explicitly asked to close/ship/archive that slice. If the slice is its phase's declared final gate, this makes the phase closable and stops — closing the phase itself is the separate, owner-invoked phase-closeout skill.
---

# Slice Closeout

Deterministic slice lifecycle: plan → implementation → QA → reference update → handoff → closed
work. Closing a declared final phase gate makes the phase *closable*; it never closes the phase.

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
8. Closed work: apply the hybrid rule in "Closed work (hybrid rule)" below to this slice's
   artifacts — a path-preserving stub with exact Git recovery for single prose artifacts; an
   archive copy only for multi-file bundles and non-text evidence.
   **Final-gate exception:** keep the declared final-gate artifact itself live while it still
   serves as phase-close evidence (`phase-closeout` step 2 re-reads it to verify the gate).
   Compact the child's other completed work normally now; `phase-closeout` owns the gate
   artifact's final compaction when the phase is actually closed. When `FINAL PHASE GATE` is
   later reassigned, the change that reassigns it must also process the former gate artifact as
   ordinary completed child work under this closed-work rule.
9. Prune transient/stale artifacts (empty states, superseded husks, `__qa-*` plates).
10. Repair links: search the repo for every moved path; fix Markdown, HTML/image,
    and prototype relative paths; verify case-sensitive paths.
11. Verify no live router treats archived material as authority
    (`docs/README.md`, `docs/roadmap/README.md`, phase READMEs,
    `docs/operations/current.md`). Run any existing docs/link checks — there is no checked-in
    docs/link checker, so run the manual search explicitly: search every moved or stubbed path,
    including evidence assets, and verify case-sensitive paths.

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

## Closed work (hybrid rule)

Classify each artifact this close touches:

```text
ARCHIVE A COPY (copy the full body to docs/archive/roadmap/<phase>/<slice>/…, keep a stub)
  multi-file bundle/workspace (design/QA/research directories, assets), or non-text evidence

STUB + EXACT GIT RECOVERY (no archive copy)
  any single prose work artifact (plan, QA record, reconciliation, addendum)

LEAVE ALONE
  already-correctly-archived material · P1–P22 · the live phase README
```

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

A stub must never be readable as live instructions: `AUTHORITY: NONE` and no content that
competes with `reference/*`.
