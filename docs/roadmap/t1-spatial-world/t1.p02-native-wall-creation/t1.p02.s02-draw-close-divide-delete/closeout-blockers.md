# T1.P02.S02 — closeout blockers

**Slice:** T1.P02.S02 · **Branch:** `t1-p02-s02-draw-close-divide-delete` · **Reviewed implementation:** `bf9007ff` (every later commit is docs-only)
**Decision:** **closeout BLOCKED — do not record acceptance, do not mark shipped.**

Implementation review is accepted: T3 accepted the shared Head/F4 diff at `bf9007ff`
([review](./t3-implementation-review.md)), and the full automated gate at that revision is recorded
there (check, fast, heavy, full, arch, build and the four package checks). That is
implementation-review acceptance, not slice acceptance.

The [slice plan](./implementation-plan.md#acceptance-and-verification) declares the slice's
acceptance criteria; the [review handoff](./review-handoff.md#known-limits) records what has not
been run. Two required evidence families are absent, so the slice-closeout procedure's step 1
("acceptance is RECORDED, not re-produced") cannot pass.

## Missing evidence

### 1. Browser journey (required proof, not recorded)

The plan requires browser evidence for the creator path — **empty and starter**: free Wall →
deliberate join → enclosure → division → deletion; Plan/3D agree at each step; one Undo/Redo per
accepted chain/delete; Save/reload preserve identities. It also names keyboard-only operation,
invalid numeric entry, narrow and short shells, reduced motion, Card precision, active Library/Guide
arbitration and unsaved project replacement, each with revision, viewport and observed outcome.

The handoff's [known limits](./review-handoff.md#known-limits) state: “No browser journey was run.”
The jsdom suite drives the route through the real facade/session but does not drive a GPU or a real
pointer, and the performance harness smoke is not a journey. No row above is recorded at `bf9007ff`.

### 2. Owner-run performance acceptance (required proof, not recorded)

The plan requires, on the designated MacBook Air M2 under S06's measurement method:
F3 input-to-matching-preview, latest-input age, final-preview completion, frames and long tasks;
per-move evaluation; F4 commit and F8 Undo/Redo at **S and M**; F2 open; F13 leak cycles; and the
Stage first-load delta.

The handoff records only a **harness smoke, not acceptance evidence** (grid-S, n=1 rows) and says the
plan's performance acceptance “stays with the designated M2 under S06's method… No agent run is
presented as that evidence.” A Bench pass needs owner direction. No S/M row, power state or
owner-operated pass is recorded at `bf9007ff`.

## Evidence that is recorded (not a substitute)

The full automated gate at `bf9007ff` and the focused drawing/Card/route suites pass and are listed
in the [T3 review](./t3-implementation-review.md#4-verification-at-the-reviewed-revision). The
DB-backed API evidence is recorded from the round-2 revision (`78705c0d`); the later shell/Card
repairs do not touch API contracts, but the handoff does not re-run it at `bf9007ff`. The scratch
integration branch (this branch + T2 #199) passed check/arch/full and the S03 acceptance smoke, but
those are integration observations and explicitly not T1 or T2 acceptance evidence.

## Owner decisions required

1. Run the browser journey on the responsive/reading matrix and record it against a named revision
   (or record an explicit owner ruling that narrows or waives it — per-slice, per-revision, with the
   waived rows named).
2. Direct the owner-run M2 performance pass on S06's method and record it (or record an explicit
   owner ruling for the performance rows, including the Stage first-load delta). The integration
   measurement is 456.0 KiB JS br on the merged tree, +9.0 KiB over the #199 base; both exceed the
   ≤400 KiB hard budget.
3. Only then rerun `slice-closeout`; acceptance, the phase register's shipped row, M4 re-arm and the
   baton are untouched until that decision.

No phase closure, track completion, merge claim or acceptance is recorded here.
