---
name: slice-closeout
description: Close a shipped roadmap slice/child deterministically. Use when a roadmap slice has completed acceptance and is ready to close, or when explicitly asked to close/ship/archive that slice. If the slice is its phase's declared final gate, this makes the phase closable and stops — closing the phase itself is the separate, owner-invoked phase-closeout skill.
---

# Slice Closeout

Deterministic slice lifecycle: plan → implementation → QA → reference update → handoff → closed work
→ preservation report. Closing a declared final phase gate makes the phase *closable*; it never
closes the phase.

Closed work is *compacted, never deleted*: keep the live knowledge surface small and deterministic,
and the path from landed behaviour back to its owning slice cheap.

## Guard — is this the phase's declared final gate?

Read the phase README (`docs/roadmap/<phase>/README.md`) **before step 1** and compare this child
against its declared final gate:

```text
no FINAL PHASE GATE line, or it names another child
  → ordinary child close: run steps 1–11.

FINAL PHASE GATE names this child
  → run steps 1–6, set the pending-owner baton (step 7 override), finish the slice's own hygiene
    (steps 8–11, with the step-8 gate-artifact exception), then STOP. The child is fully closed;
    the phase becomes CLOSABLE, not CLOSED. See "Final-gate hand-off".
```

The declared line is the only signal — never child numbering, "this looks like the last child", or the
gate artifact's title — so a normal child close cannot close its parent, and **no child close ever
touches P-level status or the Architecture Cycle**.

## Procedure

1. Verify acceptance: run the rows the plan requires plus `npm test`, `npm run check`,
   `npm run build`, and record the gate numbers. Reuse unchanged evidence rather than re-running an
   expensive gate. **Missing acceptance evidence stops the closeout** — report it, never close on
   assumption.
2. Retire any active checkpoint: promote its durable findings first (deferred bug →
   `operations/tech-debt/`; completed research → owning artifact; landed behaviour → `reference/*`;
   verification → closeout; status → phase README), then delete the checkpoint and any `current.md`
   RESUME pointer. Never archive a raw checkpoint.
3. Update `docs/reference/...` only where the slice established or changed durable knowledge a
   future agent would otherwise rediscover, and reconcile the stale claims it invalidates. Only
   landed behaviour moves: **roadmap proposals and rejected or speculative research never become
   reference truth.** Promote a closing artifact's durable conclusion to its real owner before the
   artifact closes, but never promote review chronology — Git/PR history owns deliberation. (Durable
   plan-writing is owned by `docs/README.md`, "Plan hygiene".)
4. Write or update the closeout evidence: acceptance record, rulings, residuals.
5. Mark the slice shipped in its phase README — which owns child status/order and routes each
   child's exact plan/QA artifact. Do not create a slice README or index for status.
6. Update `docs/roadmap/README.md` only if P-level execution, planning or order changed; a slice
   close never changes the phase's own P-level status.
7. Update `docs/operations/current.md` to the next work item (baton, not history). **Final-gate
   override:** there the next work item is the phase-close decision — set that baton, then finish
   steps 8–11 and STOP.
8. Closed work: apply "Closed work (hybrid rule)" to every artifact this close touches, and write
   the Closeout Preservation Report. **Final-gate exception:** leave the declared gate artifact live
   while it serves as phase-close evidence (`phase-closeout` step 2 re-reads it), compacting the
   child's other work now — and if `FINAL PHASE GATE` is later reassigned, the change that reassigns
   it must also process the former gate artifact as ordinary closed work.
9. Prune transient/stale artifacts (empty states, superseded husks, `__qa-*` plates).
10. Repair links for every path this close moved **in the live tree** — Markdown, HTML/image and
    prototype relative paths, case-sensitively. Never rewrite links inside an archived copy: the
    live stub is the link target.
11. Verify no live router (`docs/README.md`, `docs/roadmap/README.md`, phase READMEs,
    `docs/operations/current.md`) treats closed material as authority, and that this close created
    no **new** live → archived-prose link. There is no checked-in docs/link checker: run the manual
    search over every moved or stubbed path, evidence assets included. **Report an invalid
    preservation link or missing evidence — never accept it silently.**

## Final-gate hand-off

Reached only from the guard. The child is fully closed; the phase is CLOSABLE and stays in-progress.

```text
PHASE:    <phase>
CHILD:    <final gate child> — accepted (<date>)
STAGE:    phase-close decision pending owner ratification
NEXT:     owner may close <phase>, or leave it open
ROUTE:    phase README FINAL PHASE GATE block + the gate artifact
BLOCKER:  owner phase-close decision
```

STOP means the slice is done and the baton is set — nothing about the phase closes here:

```text
- no P-level phase status change
- no `PHASE CLOSE` block
- no `architecture-cycle.md` transition
- no cycle META write or removal
- no automatic `phase-closeout`
```

**Same-task authorization.** Closing the final slice *and* the phase in one task is already
authorized: continue into `phase-closeout`, which validates the owner request itself. An accepted
gate or a pending baton never manufactures it.

## Closed work (hybrid rule) — compaction, not deletion

```text
STUB + EXACT GIT RECOVERY — the default for anything readable
  any prose work artifact: plan · QA/acceptance record · reconciliation · addendum · research ·
  design study · owner-rulings record. The body leaves the live tree; a stub stays at its path.

ARCHIVE A COPY (docs/archive/roadmap/<phase>/<slice>/…, plus the stub at the live path)
  renderable evidence only: PNG/SVG/HTML atlases, screenshots, plates, measurements — things whose
  value is that one can look at them.

LEAVE ALONE
  already-correctly-archived material · P1–P22 · older closed slices · the live phase README. Never
  rewrite them for consistency: migrate only what this close touches, or what an owner ruling
  directs (OD-4's bounded batch migration of the grandfathered P23 plans at P23 close is one).
```

**Ratified rule (owner ruling 2026-09-22):** hybrid preservation — prose defaults to stub + exact
anchor, renderable evidence to an archive copy. Provenance and the superseded OD-4 wording live in
the operating-cycle harvest (§0, §7.2).

### What the stub must carry

Enough that a future agent answers **without archaeology**:

```text
delivered      what the slice actually shipped, one or two lines
contract       the final accepted contract/decision, or the reference/* doc that now owns it
provenance     implementation PR / accepted revision
evidence       the verification actually obtained — gate numbers, manual-owed rows, oracles
entry points   the code, validation and regression tests that own the behaviour, as plain paths:
                 implementation  packages/.../foo.ts
                 validation      packages/.../foo-validation.ts
                 regressions     apps/.../foo.test.ts
residuals      deferred or carried scope, named, with owners
recovery       git show <A>:<path>  [· git show closed/<slice-id>:<path>]
```

The entry points are the debugging index — the cheap reverse path from behaviour to owning slice.
Task-by-task history and reviewer commentary are not the stub's job (Git/PR history owns
deliberation), and provenance comments are never scattered through production code. A stub must
never read as live instruction: `AUTHORITY: NONE`, nothing competing with `reference/*`.

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

One artifact may be both A and C.

### Anchor mechanics — P1 is the default

Compute the anchor **before** writing the stub; `A` is the last commit containing the full body:

```bash
A=$(git log -1 --format=%H -- <path>)
```

```text
P1 — DEFAULT (owner-ratified 2026-09-22)
  implement → accept → closeout commit on the same branch → review → merge commit → post-merge
  anchor verification. Record A and the merge method the PR must use.

P2 — recovery/exception
  the accepted full body already landed on `main` in an earlier PR: verify A, then compact in a
  later commit or PR.
```

Never use `--amend` — it rewrites `A` and invalidates the written anchor. If a squash or force-push
already invalidated the recovery line, annotate it to the reachable form
(`git fetch origin refs/pull/<n>/head && git show <A>:<path>`) and record the degradation. Verify in
the same session — after the merge for P1 — before declaring the close complete:

```bash
git merge-base --is-ancestor <A> main && echo "anchor reachable"
git show <A>:<path> | head -3
```

**Durable tag.** A bare SHA survives only while reachable, and P1 is where that risk is highest:

```bash
git tag -a closed/<slice-id> "$A" -m "<slice-id> closed work — anchor $A"    # closed/p23.15
```

`<slice-id>` is the identifier the phase README already writes (`closed/p23.15`); a phase close tags
the phase (`closed/p23`). Tag `A`, never the compaction commit, and determine `A` first.

A tag keeps its commit *and its ancestors* reachable — so **verify every anchor this close records is
an ancestor of the tag target, and never assume it.** If one is not, tag a common reachable
preservation commit or add a second tag; a close with several anchors names them all in the
preservation report. The closeout does not push, so the report states whether the tag was pushed — an
unpushed tag protects this clone only. Name the convention in the phase README at its first use.

### Archive copying

`docs/archive/**` means browsable evidence, never a second prose knowledge tree. A Markdown stub
cannot stand in for a `.png`, `.svg` or `.pdf` — the extension would break and every link with it —
so evidence sheds its body by shape:

```text
SINGLE EVIDENCE FILE   <dir>/<name>.<ext>
  bytes → docs/archive/roadmap/<phase>/<slice>/<dir>/<name>.<ext>   (unmodified)
  live  → <dir>/<name>.<ext>.md   sibling stub: AUTHORITY: NONE, RECOVER:, ARCHIVE: <path>
  links → repointed to the archived copy — being viewable is what that copy is for

EVIDENCE BUNDLE        <dir>/   the evidence moves whole, internal structure preserved so its own
  relative links keep resolving; the live path stays occupied by a stub directory holding only
  live  → <dir>/CLOSED.md   one manifest: every archived file + its anchor

HTML ENTRY POINT       <dir>/index.html → the manifest convention above; if a live doc links to it,
  write a valid HTML redirect stub at the live path instead (meta refresh to the archive copy),
  never a Markdown file carrying an `.html` name.
```

A mixed bundle therefore keeps prose stubs at their own paths, keeps the renderable copy, and gets one
manifest per moved directory.

- Copy bytes **unmodified**: a byte-identical copy costs no object storage, because Git stores one
  blob for both paths, while a rewritten copy forks a real duplicate and adds a second
  link-maintenance surface. Links that escape a bundle go stale as a result — record that in its
  manifest or nearest live stub, and do not repair the copy, but do repair the **live** links that
  pointed at moved evidence. No size cap: report the archived size so growth stays visible.

> A slice closeout must not create a **new** live-document dependency on archived prose.

If a live doc needs something from a prose research or design artifact, promote it into that
information's live owner first, then stub the artifact; live docs cite the stub at its own path.
Evidence links into `docs/archive/**` are the archive's purpose and are unaffected; dependencies made
before this rule are left alone unless this close touches them.

## Closeout preservation report

Write it into the slice's QA-record stub. A phase close writes it into the final-gate artifact's stub
— or the phase README's `PHASE CLOSE` block when the gate artifact has none — never into a slice stub
the phase close did not touch.

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
