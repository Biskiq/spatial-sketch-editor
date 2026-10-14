# Preservation — closed work, anchors and recovery

Shared reference for `slice-closeout` (step 8, compaction) and `phase-closeout` (its closed-work
step). Read it at that step only; both skills own their own procedure and neither restates this.

## Sequence and safety

```text
review → acceptance → routine closeout → merge → post-merge anchor verification
```

Compaction happens **before** the merge commit, and the anchor is verified **after** it. A close
never rewrites history to make its own recovery line work, and it never fabricates an anchor: if no
valid committed recovery anchor exists for an artifact, **retain the full body** rather than write a
recovery line that does not resolve.

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

**The permanent-stub cost is explicit and owner-owned.** Under this policy *every* closed prose
artifact keeps a permanent stub, so the number of permanent artifacts grows with the slice count even
when all reusable knowledge has been promoted. That is an accepted cost, not an oversight: a close
does not silently relax it, and reducing it is a bounded owner decision against the 2026-09-22
ruling. What a close does control is not adding a redundant permanent document — promote the durable
conclusion into its real owner, and keep exactly one stub per closed artifact rather than a stub plus
a summary plus an index.

## Stub contents

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

## Research artifacts

```text
A durable current knowledge       findings still needed to understand current behaviour → promote
                                  into the owning docs/reference/** doc, then stub. Live architecture
                                  MUST NOT depend on an unowned roadmap research file.
B decision-support research       alternatives, rejected approaches, explorations, harvests → stub +
                                  anchor once promoted or spent. No archive copy.
C independently valuable evidence atlases, screenshots, plates, measurements → archive a copy.
```

One artifact may be both A and C.

## Anchor mechanics

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

- `<slice-id>` is the identifier the phase README writes (`T1.P01.S01`); a phase close tags the phase.
- Tag `A`, never the compaction commit; determine `A` first.
- A tag keeps its target and every ancestor reachable. Verify each recorded anchor is an ancestor of
  the tag target — NEVER assume. Not an ancestor → tag a common reachable preservation commit, or add
  another tag.
- Name every anchor in the preservation report. The skill that compacts does not push: report the
  tag's push state (an unpushed tag protects this clone only). Name the convention in the phase README
  at first use.

## Archive copying

`docs/archive/**` holds browsable evidence, never a second prose knowledge tree. A Markdown stub cannot
stand in for a `.png`/`.svg`/`.pdf` — the extension would break and every link with it — so evidence
keeps a live path by shape (sibling stub, bundle `CLOSED.md`, or HTML redirect stub), with bytes
copied unmodified. Mechanics → `docs/archive/README.md`.

A close MUST NOT create a new live-document dependency on archived prose. A live doc needing prose
research → promote it into that information's live owner first, then stub the artifact; live docs cite
the stub at its own path. Evidence links into the archive are its purpose. Leave pre-existing
dependencies alone unless this close touches them.

## Preservation report

Write it into the slice's acceptance-record stub. A phase close writes it into the final-gate
artifact's stub, or the phase README's `PHASE CLOSE` block when the gate artifact has none — never
into a slice stub the phase close did not touch.

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
permanent stubs added:           N   (the owner-ratified cost: one per closed prose artifact)
```
