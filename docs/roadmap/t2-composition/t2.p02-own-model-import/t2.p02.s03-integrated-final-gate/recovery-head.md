# T2.P02.S03 — recovery at `b9ba493b` — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records a historical recovery.
STATUS:    HISTORICAL. The recovered product, tests and harness at b9ba493b repaired the two defects
           the ea42c745 review found, passed the full repository contract and 3/3 branded-Chrome
           acceptance tests, and measured 422.3 KiB br Stage JS. The owner accepted that revision on
           2026-10-27 and amended the Stage hard budget to ≤425 KiB br.
NOT:       the current verdict, a pass for any performance row or an acceptance/merge authorization.
```

## What it recorded

- **Repairs:** the public preview route's first-load graph was restored by sharing
  `VisitorEntityGroups` while only the editor Stage supplies an idle lazy renderer; choosing a native
  primitive now consumes the project-scoped armed model; the acceptance spec header stopped calling
  asserted rows diagnostic-only.
- **Repository contract at `b9ba493b`:** 215 files / 2,663 tests, arch 22/180, heavy 11/138, `check`
  0 errors / 0 warnings, clean build, API 14/114 with zero skips, `perf:bundle` exit 0.
- **Browser evidence:** acceptance 3/3 in 45.8 s and diagnostics 3/3 in 39.6 s on the designated M2 in
  branded Chrome, against the real in-process API, Postgres and object store. The pointer journey
  selected the placed model and committed Resize/Undo/Redo, Duplicate/Delete and typed move/turn; the
  empty-project row drew an Ink enclosure, then placed the model.
- **Delivery:** 422.3 KiB br Stage JS against the then ≤400 KiB hard row — a 22.3 KiB miss that the
  owner later amended to ≤425 KiB. The recorded F5/F6/F9/F13 rows were observations or proxies, not
  passes; GPU memory was unmeasurable and F2/F3/F4/F7/F8 and the owner-run rows remained unrun.

The full revision-specific body — repair table, verification contract, browser assertions, budget
attribution and every measured row — is recoverable from Git. The current verdict, the amended
budget, the named deferrals and the preservation report are in the
[acceptance stub](./acceptance.md) and the
[decision record](../../../../reference/decisions/t2-s03-acceptance-and-budget-amendment-2026-10-27.md).

## Recovery

```text
git show 221facc4252b680695084765a2b97f35097d7b94:docs/roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/recovery-head.md
anchor  221facc4 · tags closed/T2.P02.S03 and closed/T2.P02
```
