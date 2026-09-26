---
name: slice-closeout
description: Close a shipped roadmap slice/child deterministically. Use when a roadmap slice has completed acceptance and is ready to close, or when explicitly asked to close/ship/archive that slice. If the slice is its phase's declared final gate, this makes the phase closable and stops — closing the phase itself is the separate, owner-invoked phase-closeout skill.
---

# Slice Closeout

Close one accepted slice. Compact closed work; never delete it. Keep the live surface small and the
path from landed behaviour back to its owning slice cheap.

Closing the declared final gate makes the phase CLOSABLE, never CLOSED.

## Workflow — P1 (default)

```text
implement → PR review → fix/re-review until implementation accepted → run this skill on the same
branch → closeout self-check → merge commit → post-merge anchor verification
```

Implementation acceptance authorizes routine closeout. Routine closeout requires no second review;
exceptional triggers below reopen review. This skill owns mechanical documentation and preservation
verification — it REUSES the implementer's and reviewer's recorded gate numbers and re-runs nothing.

```text
implementation accepted   code, architecture and required acceptance evidence passed review
merge-ready               closeout complete and its self-check passed
```

## Guard — declared final gate?

Read `docs/roadmap/<phase>/README.md` before step 1. Compare this child with the FINAL PHASE GATE line:

```text
no line, or it names another child → ordinary close: run steps 1–11
it names this child               → run steps 1–6, set the pending-owner baton (step 7 override),
                                    finish steps 8–11 (step-8 gate-artifact exception), STOP
```

Finality comes only from that line — never child numbering or the gate artifact's title. On STOP:

```text
no P-level status change · no PHASE CLOSE block · no architecture-cycle transition · no cycle META ·
no automatic phase-closeout
```

## Procedure

1. Verify acceptance is RECORDED, not re-produced: the implementation/review evidence must already carry the plan's required rows plus `npm test`, `npm run check`, `npm run build` gate numbers. A routine closeout is documentation-only and NEVER re-runs a suite or gate for its own sake — reuse the recorded evidence and name it in the closeout artifact. Re-run a lane only when a closeout change itself invalidates recorded evidence; a docs-only close never does. Missing recorded acceptance evidence → STOP, report it.
2. Retire any active checkpoint: promote durable findings first (deferred bug → `operations/tech-debt/`; research → owning artifact; landed behaviour → `reference/*`; verification → closeout; status → phase README), then delete the checkpoint and any `current.md` RESUME pointer. NEVER archive a raw checkpoint.
3. Update `docs/reference/...` only where the slice changed durable knowledge a future agent would rediscover; reconcile the stale claims it invalidates. Only landed behaviour moves: roadmap proposals and rejected or speculative research NEVER become reference truth. Promote a closing artifact's durable conclusion to its owner; never promote review chronology. Plan hygiene → `docs/README.md`.
4. Write or update closeout evidence: acceptance record, rulings, residuals.
5. Mark the slice shipped in the phase README, which owns child status/order and routes the child's plan/QA artifact. Do not create a slice README or status index.
6. Update `docs/roadmap/README.md` only if P-level execution, planning or order changed. A slice close never changes the phase's P-level status.
7. Rewrite `docs/operations/current.md` as the current-state snapshot (invariant below). Reconcile every existing entry against the repository and the phase README: replace what changed, delete superseded status/NEXT statements, drop completed execution narrative and closeout reports, and route completed evidence to its owning documents. Never append the new state onto the old. Final-gate override: the next item is the phase-close decision. Then finish steps 8–11 and STOP.
8. Compact closed work ("Closed work") and write the preservation report. Final-gate exception: keep the gate artifact live while it is phase-close evidence; compact the child's other work. If FINAL PHASE GATE is later reassigned, process the former gate artifact as ordinary closed work.
9. Prune transient artifacts (empty states, superseded husks, `__qa-*` plates).
10. Repair links for every path this close moved in the live tree — Markdown, HTML/image and prototype paths, case-sensitively. NEVER rewrite links inside an archive copy; the live stub is the target.
11. Confirm no live router (`docs/README.md`, `docs/roadmap/README.md`, phase READMEs, `docs/operations/current.md`) treats closed material as authority, and that this close added no new live → archived-prose link. No docs/link checker exists: search every moved or stubbed path by hand, evidence included. Invalid preservation link or missing evidence → report it, NEVER accept it silently.

## current.md invariant

`docs/operations/current.md` is a replaceable current-state snapshot, never an append-only historical
ledger. It carries only: phase · active child with its authorization and immediate next step · real
blockers and unresolved dependencies · minimal routes to authoritative documents · brief
carry-forwards. Owners: phase README → status/order; closed stubs → completed work and evidence;
QA/acceptance records → gate numbers; `operations/tech-debt/` → deferred bugs; Git → history.

Closeout rewrites the file in place — reconcile existing entries, remove superseded status and NEXT
text, and leave it no larger than the current state it describes.

## Self-check — required before reporting merge-ready

```text
acceptance    every claim matches recorded evidence; manual-owed rows stay explicit and are carried
              only by owner ruling
promotion     durable conclusions sit with their correct reference owners
preservation  stubs, Git anchors, tags and archive/evidence links all valid
routing       routers, child status and next-work baton agree
baton         current.md is the reconciled snapshot: one statement per status · superseded
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

The child is fully closed; the phase is CLOSABLE and stays in-progress.

```text
PHASE:    <phase>
CHILD:    <final gate child> — accepted (<date>)
STAGE:    phase-close decision pending owner ratification
NEXT:     owner may close <phase>, or leave it open
ROUTE:    phase README FINAL PHASE GATE block + the gate artifact
BLOCKER:  owner phase-close decision
```

Closing the final slice and the phase in one task is already authorized: continue into
`phase-closeout`, which validates the owner request itself. An accepted gate or a pending baton never
manufactures that authorization.

## Closed work (hybrid rule)

```text
STUB + EXACT GIT RECOVERY — default for anything readable
  prose artifacts: plan · QA/acceptance record · reconciliation · addendum · research · design
  study · owner-rulings record. The body leaves the live tree; a stub stays at its path.

ARCHIVE A COPY (docs/archive/roadmap/<phase>/<slice>/…)
  renderable evidence only: PNG/SVG/HTML atlases, screenshots, plates, measurements.

LEAVE ALONE
  already-archived material · P1–P22 · older closed slices · the live phase README. Migrate only what
  this close touches, or what an owner ruling directs.
```

Owner ruling 2026-09-22: hybrid preservation — prose → stub + anchor, renderable evidence → archive
copy. Evidence path/manifest mechanics → `docs/archive/README.md` ("Closed-work evidence"). Provenance
and the superseded OD-4 wording → operating-cycle harvest §0, §7.2.

### Stub contents

Answer a future agent without archaeology:

```text
delivered      what shipped, one or two lines
contract       final accepted contract, or the reference/* doc that owns it
provenance     implementation PR / accepted revision
evidence       verification obtained — gate numbers, manual-owed rows, oracles
entry points   code, validation and regression tests that own the behaviour, as plain paths:
                 implementation  packages/.../foo.ts
                 validation      packages/.../foo-validation.ts
                 regressions     apps/.../foo.test.ts
residuals      deferred or carried scope, named, with owners
recovery       git show <A>:<path>  [· git show closed/<slice-id>:<path>]
```

Entry points are the debugging index: the reverse path from behaviour to owning slice. Omit task
history and reviewer commentary — Git/PR history owns deliberation — and never add provenance comments
to production code. A stub reads as `AUTHORITY: NONE` and competes with nothing in `reference/*`.

### Research artifacts

```text
A durable current knowledge       findings still needed to understand current behaviour → promote
                                  into the owning docs/reference/** doc, then stub. Live architecture
                                  MUST NOT depend on an unowned roadmap research file.
B decision-support research       alternatives, rejected approaches, explorations, harvests → stub +
                                  anchor once promoted or spent. No archive copy.
C independently valuable evidence atlases, screenshots, plates, measurements → archive a copy.
```

One artifact may be both A and C.

### Anchor mechanics

Compute the anchor before writing the stub. `A` is the last commit containing the full body:

```bash
A=$(git log -1 --format=%H -- <path>)
```

```text
P1 default    implement → accept → closeout commit on the same branch → review → merge commit →
              post-merge anchor verification. Record A and the merge method: P1 anchors are reachable
              only if the PR lands as a merge commit.
P2 exception  the accepted full body already landed on `main` in an earlier PR: verify A, then compact
              in a later commit or PR.
```

- NEVER `--amend`: it rewrites `A` and invalidates the written anchor.
- Squash or force-push invalidated the recovery line → annotate it to
  `git fetch origin refs/pull/<n>/head && git show <A>:<path>` and record the degradation.
- Verify in the same session, after merge for P1, before reporting complete:

```bash
git merge-base --is-ancestor <A> main && echo "anchor reachable"
git show <A>:<path> | head -3
```

Tag the anchor commit:

```bash
git tag -a closed/<slice-id> "$A" -m "<slice-id> closed work — anchor $A"    # closed/p23.15
```

- `<slice-id>` is the identifier the phase README writes; a phase close tags the phase (`closed/p23`).
- Tag `A`, never the compaction commit; determine `A` first.
- A tag keeps its target and every ancestor reachable. Verify each recorded anchor is an ancestor of the tag target — NEVER assume. Not an ancestor → tag a common reachable preservation commit, or add another tag.
- Name every anchor in the preservation report. This skill does not push: report the tag's push state (an unpushed tag protects this clone only). Name the convention in the phase README at first use.

### Archive copying

`docs/archive/**` holds browsable evidence, never a second prose knowledge tree. A Markdown stub cannot
stand in for a `.png`/`.svg`/`.pdf` — the extension would break and every link with it — so evidence
keeps a live path by shape (sibling stub, bundle `CLOSED.md`, or HTML redirect stub), with bytes
copied unmodified. Mechanics → `docs/archive/README.md`.

A close MUST NOT create a new live-document dependency on archived prose. A live doc needing prose
research → promote it into that information's live owner first, then stub the artifact; live docs cite
the stub at its own path. Evidence links into the archive are its purpose. Leave pre-existing
dependencies alone unless this close touches them.

## Preservation report

Write it into the slice's QA-record stub. A phase close writes it into the final-gate artifact's stub,
or the phase README's `PHASE CLOSE` block when the gate artifact has none — never into a slice stub the
phase close did not touch.

```text
CLOSEOUT PRESERVATION — <slice> (<date>)
prose compacted:                 N   stubs at their own paths
reference promotions:            N   durable findings moved to their real owner in reference/*
renderable evidence archived:    N files / <size>
evidence stubs / manifests:      N   sibling stubs or bundle CLOSED.md manifests
transient artifacts removed:     N
historical anchor:               <sha> · tag closed/<slice-id> (pushed | local only — not pushed)
new live → archive prose links:  0   non-zero is a violation to fix, not to report
manual-owed verification rows:   N   kept distinct from automated evidence
remaining deferred items:        N
```
