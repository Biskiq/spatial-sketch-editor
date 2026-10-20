# T1.P01.S06 — acceptance record: Integrated final gate

**Slice:** T1.P01.S06 · **Status:** in progress — **not accepted** (owner-authorized 2026-10-20 as batch D, ruling D1)
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:** [T1.P01](../README.md) · **Declared** `FINAL PHASE GATE` artifact of T1.P01

This record claims only what was executed. The TD-10 obligation is discharged and every automated lane
the plan requires is green on this branch; the **browser-journey leg of the exhaustive gate is
incomplete**, so the gate is **not accepted**, `T1.P01` is **not closable**, and this page is not
acceptance or readiness evidence for the phase.

```text
tested revision   branch `T1-P01-S06`, based on `origin/main` `bb166c67` (the batch D merge)
                  with the TD-10 increment `21c18402` applied
run               2026-10-20, local checkout, Node 20, macOS (arm64), local Postgres 18 on :5432
```

## TD-10 — closed (slice first increment)

`openSourceJson` and `applyReloadOffer` installed their admitted result without re-checking the
session epoch, unlike `load` and the resumed-save path. Both now capture `session.token()` before the
admission await and abandon a result whose epoch is no longer current, **before** any status branch,
so a stale action installs no source, adopts no saved base and reports neither a success nor a
refusal. No second guard, no session/lifetime refactor.

**Regression:** `apps/editor/tests/lib/authoring/spatial-route-source-replacement.test.ts` — four
mounted route cases (delayed admitted Open superseded by an admitted reload; delayed refused Open;
delayed admitted Reload superseded by an admitted Open; delayed refused Reload), each proving the
newer project, its Stage node and its saved base survive with no stale notice. The suite's Head
double now takes its reload offer from `fixtures/reload-offer.ts` so an admitting reload is reachable.
**Mutation proof:** disabling either guard fails exactly those four cases (4 failed | 6 passed);
restoring them passes 10/10, and the paired `spatial-route-resume-save` suite stays 5/5.
Ledger: [TD-10 fixed](../../../../operations/tech-debt/README.md#td-10--a-late-successful-source-open-applies-after-a-newer-session-epoch).

## Automated gate — green

| Check | Result |
| --- | --- |
| `npm run check` (svelte-check, editor) | exit 0 — 0 errors, 0 warnings |
| `npm run build` (editor) | exit 0 |
| `npm run check:api`, `check:project-model`, `check:layout-core`, `check:camera-core` | exit 0 each |
| `npm run test:full` (complete editor suite) | exit 0 — **169 files / 2,215 tests** |
| `npm run test:arch` (unconditional lane) | exit 0 — 20 files / 166 tests |
| `npm run test:heavy` | exit 0 — 8 files / 118 tests |
| DB-backed `npm run test:api` (isolated database `biskiq_s06_gate`, no skips) | exit 0 — 11 files / **80 tests, 0 failed, 0 skipped** |
| Migration + concurrent-runner fence (`migration.test.mjs`, `migration-fence.test.mjs`) | inside the API lane above |

The suite count rose from S04's 2,211 to 2,215 with exactly the four TD-10 cases. The kernel lanes
(`layout-core`, `project-model` fast/heavy), the boundary suites (`wall-mesh-shell`, `camera-core`,
`project-model`, `preview-surface`, `visitor/*`) and the documentation/execution gates all run inside
those lanes; nothing was skipped or narrowed.

## Browser journeys — partially executed, not sufficient

Run against a real headed Chromium (agent-browser, owned session) and the Vite dev server on
`127.0.0.1:5173`, at 1280×900 and 720×640, with **no API client** (this environment has no `.env`
and no Compose stack, so the route boots a locally minted gallery project and the Head reports Save
and Preview unavailable by design).

**Executed:** the starter gallery boots through the real admission path and compiles; the Plan and 3D
readings both render from the shared Stage; a Plan Stage click establishes a canonical selection (the
Card appears with the selected subject, `eligible true`, `revealed false`, datum `0 m`); the Scene
`Compose` instrument opens from the Index; the reduced-motion control renders in the Head.

**Not executed:** the precision field edit and typed refusal, the direct 3D edit/cancel, Undo/Redo,
canonical source download/reopen, project replacement, the empty-baseline journey, the reduced-motion
behaviour, and — because no cloud client exists here — the F2 unit Save/conflict/*Reload remote* and
the TD-9 sign-in Save resume end to end. Those remain covered only by their route/head suites and the
API lane, which is **not** the recorded browser evidence the plan requires.

**Unresolved observation:** for the selected Layout subject, the `Dimensions` task opened the route's
membership body (*Declared membership: included*, *Reveal*) rather than an adapter field surface, so
the precision-edit journey could not be driven from it in this run. Whether that is a missing
contribution for that subject or a lens/adapter mismatch is not established here.

## Residual — Card over the Compose instrument (owner: T1 shell composition)

Reproduced, not fixed. With a subject selected and a Scene task open at **1280×900**:

```text
.card        box x 368 → 704, y 627 → 884   z-index 12   (from `.stage-frame`, `bottom: 1rem`, `inset-inline-start: 1rem`)
.instrument  box x 369 → 1262, y 658 → 888  z-index  6   (`left: 50%`, `bottom: 0.75rem`, centred)
```

The Card paints over the instrument's left third, hiding the Compose actions and clipping its text —
the observation `T3.P01.S04` carried forward, and it is not specific to a narrow shell. The cause is
deterministic (two bottom-anchored overlays, the Card nearer the viewer and up to `min(21rem, 100% − 2rem)`
wide). It is recorded as a residual rather than fixed because the correction is a shell-composition
decision — how the Card and the bottom instrument band dock — and this slice's authorization covers
**no code outside the TD-10 repair** (D1). Owner: T1 shell composition, next T1 increment; the screenshots
and boxes above are the reproduction.

## What therefore remains before acceptance

1. The browser leg of the gate: the journeys listed as not executed, with a cloud client (local
   Compose stack) for the Save/conflict/Reload and sign-in-resume paths.
2. A resolution of the `Dimensions` observation above (defect or expected contribution).
3. Then this record's acceptance, which is what makes `T1.P01` **closable** — closing it stays an
   explicit owner event, and the architecture-cycle verdicts stay `owner-verdict-owed`.
