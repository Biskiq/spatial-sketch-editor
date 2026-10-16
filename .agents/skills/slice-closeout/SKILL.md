---
name: slice-closeout
description: Close a shipped roadmap slice deterministically. Use when a slice has completed acceptance and is ready to close, or when explicitly asked to close/ship/archive that slice. If the slice is its phase's declared final gate, this makes the phase closable and stops — closing the phase itself is the separate, owner-invoked phase-closeout skill.
---

# Slice Closeout

Close one accepted slice. Compact closed work; never delete it. Keep the live surface small and the
path from landed behaviour back to its owning slice cheap.

Closing the declared final gate makes the phase CLOSABLE, never CLOSED.

## Resolve the exact target

```text
1  the phase README:   docs/roadmap/<track>/<phase-id>-<capability>/README.md
2  its slice register: this slice's Status · Consumes · Effects · Plan · Acceptance row
3  the phase README's FINAL PHASE GATE line, to know whether this close is the final one
4  the track README ONLY when the phase row, the track's objectives, or a gate version is in question
```

The phase README owns child status and order and routes the exact plan/acceptance artifact; this
skill resolves it and reads no further. A track README, the global roadmap, `operations/README.md`
and `operations/architecture-cycle.md` are **not** ordinary closeout reading — the cycle is entered
only through the hook in step 1a.

## Workflow — P1 (default)

```text
implement → PR review → fix/re-review until implementation accepted → run this skill on the same
branch → closeout self-check → merge commit → post-merge anchor verification
```

Implementation acceptance authorizes routine closeout. Routine closeout requires no second review;
exceptional triggers below reopen review. This skill owns mechanical documentation and preservation
verification — it REUSES the implementer's and reviewer's recorded evidence and re-runs nothing.

When the owner explicitly authorizes a **combined acceptance-and-closeout** request, first adjudicate
the existing independent-review evidence against every approved acceptance criterion and prerequisite.
If it passes, record formal acceptance and each capability outcome in the routed acceptance artifact
and owning registers, then continue this procedure in the same invocation. If evidence is missing,
stale, contradictory or fails a criterion, STOP and report it. Green tests or invoking this skill
alone never constitute acceptance; all acceptance prerequisites, evidence-validity rules and
independent-review requirements above still apply.

```text
implementation accepted   code, architecture and required acceptance evidence passed review
merge-ready               closeout complete and its self-check passed
```

## Guard — declared final gate?

Read the phase README before step 1. Compare this slice with its FINAL PHASE GATE line:

```text
no line, or it names another slice → ordinary close: run steps 1–11
it names this slice               → run steps 1–6, set the pending-owner baton (step 7 override),
                                    finish steps 8–11 (step-8 gate-artifact exception), STOP
```

Finality comes only from that line — never slice numbering or the gate artifact's title. On STOP:

```text
no phase closure · no track completion · no cycle transition · no automatic phase-closeout
```

## Procedure

1. **Verify acceptance is RECORDED, not re-produced.** The implementation/review evidence must
   already carry the slice plan's declared **verification tier** and its rows — for a slice plan
   whose tier is narrower than the full contract, the plan declares the **integration route** that
   still owes the integrated result, and that route is where the proof lives. Commands, tiers and
   escalation are owned by `apps/editor/tests/README.md` ("What a change requires" and the focused
   ladder); reuse the recorded numbers and name them in the closeout artifact. A PR #115 checkpoint
   keeps the complete plan contract — no closeout narrows it. Verify the evidence's **tested
   revision and working-diff identity**: subsequent production, test or config edits invalidate the
   affected rows, and every invalidated check is reopened. Missing or stale acceptance evidence →
   STOP and report it.
   1a. **Cycle window.** If this slice is listed under the cycle's `Exposure slices`, follow
   `record-exposure` and then `close-window` when the closure predicate is now true, in
   `docs/operations/architecture-cycle.md`. That is the only reason an ordinary close opens the
   cycle document.
2. Retire any active checkpoint: promote durable findings first (deferred bug → `operations/tech-debt/`;
   research → owning artifact; landed behaviour → `reference/*`; verification → closeout; status →
   phase README), then delete the checkpoint and any RESUME pointer in the owning track's baton.
   NEVER archive a raw checkpoint.
3. Update `docs/reference/...` only where the slice changed durable knowledge a future agent would
   rediscover; reconcile the stale claims it invalidates. Only landed behaviour moves: roadmap
   proposals and rejected or speculative research NEVER become reference truth. Promote a closing
   artifact's durable conclusion to its owner; never promote review chronology. Plan hygiene →
   `docs/README.md`.
4. Write or update closeout evidence: acceptance record, rulings, residuals — in the slice's
   acceptance artifact, which the phase README's `Acceptance` cell already routes.
5. Mark the slice shipped in the phase README, which owns child status and order. Do not create a
   slice README or a status index.
6. Update the track README or `docs/roadmap/README.md` only if the phase's or track's registration
   changed (a new phase row, a gate version and its provider, a superseded row). A slice close never
   changes a track's or phase's status.
7. Rewrite the **owning track's** baton `docs/operations/<track>/current.md` as the current-state
   snapshot (invariant below); never edit another track's baton. Reconcile
   every existing entry against the repository and the phase README: replace what changed, delete
   superseded status/NEXT statements, drop completed execution narrative and closeout reports, and
   route completed evidence to its owning documents. Never append the new state onto the old.
   Final-gate override: the next item is the phase-close decision. Then finish steps 8–11 and STOP.
8. Compact closed work ("Closed work") and write the preservation report. Final-gate exception: keep
   the gate artifact live while it is phase-close evidence; compact the slice's other work. If
   FINAL PHASE GATE is later reassigned, process the former gate artifact as ordinary closed work.
9. Prune transient artifacts (empty states, superseded husks, `__qa-*` plates).
10. Repair links for every path this close moved in the live tree — Markdown, HTML/image and
    prototype paths, case-sensitively. NEVER rewrite links inside an archive copy; the live stub is
    the target. A closeout that touched only documentation reruns the documentation gate
    (`apps/editor/tests/docs/documentation-references.test.ts`, in the arch lane:
    `npx vitest run --config vitest.arch.config.ts tests/docs`), not every product gate.
11. Confirm no live router (`docs/README.md`, `docs/roadmap/README.md`, the track README, the phase
    README, the owning track's baton) treats closed material as authority, and that this close
    added no new live → archived-prose link. The documentation cross-reference checker
    (`apps/editor/tests/docs/documentation-references.test.ts`) resolves links, written paths and
    anchors mechanically; run it after any link edit, and report every moved or stubbed path it
    cannot see by hand. Invalid preservation link or missing evidence → report it, NEVER accept it
    silently.

## baton invariant

`docs/operations/current.md` is navigation only. The **owning track's** baton
(`docs/operations/<track>/current.md`) is that track's replaceable current-state snapshot, never an
append-only historical ledger. It carries only: phase · active slice with its authorization and
immediate next step · real blockers and unresolved dependencies · minimal routes to authoritative
documents · brief carry-forwards. Owners: the phase README → status/order; closed stubs → completed
work and evidence; acceptance records → gate numbers; `operations/tech-debt/` → deferred bugs; Git →
history. Never synchronize another track's baton, and never treat stale baton text as a blocker.

Closeout rewrites only the owning track's file in place — reconcile existing entries, remove
superseded status and NEXT text, and leave it no larger than the current state it describes.

## Self-check — required before reporting merge-ready

```text
acceptance    every claim matches recorded evidence, at the evidence's tested revision; manual-owed
              rows stay explicit and are carried only by owner ruling
tier          the slice plan's declared verification tier is what actually ran; a narrowed tier
              resolves its declared integration route, and the deferred integrated result is recorded
shims         accepted evidence contains no unowned remaining shim — an extracted responsibility
              was migrated with its callers and ownership boundaries, or its forwarding surface names
              an owner and a retirement condition; implementation review made that call, and closeout
              edits no production file
promotion     durable conclusions sit with their correct reference owners
preservation  stubs, Git anchors, tags and archive/evidence links all valid
routing       routers, slice status and next-work baton agree
baton         the owning track's current.md is the reconciled snapshot: one statement per status · superseded
              status/NEXT text deleted · no completed slice's execution narrative · no closed work
              listed as a blocker without a real unresolved dependency · no fact already owned by a
              closed stub or phase documentation · no unnecessary growth of the operational index
stable        documentation is merge-stable: no pending-merge statement, no pinned branch-head SHA
              that this PR's own merge invalidates
report        preservation report complete
scope         no implementation code changed during closeout
P1            required merge method and post-merge anchor verification recorded
```

A failing line → fix or report it. Do not report merge-ready while one is open.

## Exceptional review trigger

Do not reopen review for routine status updates, reference reconciliation, stub creation or archive
compaction. Return to review only if closeout introduces or discovers:

```text
- a substantive product or architecture decision
- changed scope or acceptance criteria
- missing or contradictory acceptance evidence
- an unresolved correctness issue
- implementation-code changes
```

If implementation changed, revalidate the affected evidence before closing.

## Final-gate hand-off

The slice is fully closed; the phase is CLOSABLE and stays in-progress.

```text
PHASE:    <phase-id> (<phase README>)
SLICE:    <final gate slice> — accepted (<date>)
STAGE:    phase-close decision pending owner ratification
NEXT:     owner may close <phase>, or leave it open
ROUTE:    phase README FINAL PHASE GATE block + the gate artifact
BLOCKER:  owner phase-close decision
```

Closing the final slice and the phase in one task is already authorized: continue into
`phase-closeout`, which validates the owner request itself. An accepted gate or a pending baton never
manufactures that authorization.

## Closed work, anchors and the preservation report

The rules live in `references/preservation.md` and are read at step 8: the hybrid preservation rule
(prose → stub + Git anchor, renderable evidence → archive copy), research dispositions, anchor/tag
and merge safety, archive mechanics, and the preservation report template. It also states the
**permanent-stub cost** of the owner-ratified hybrid policy, so a close never adopts it blind. This
skill links it only at the compaction step and never restates it.
