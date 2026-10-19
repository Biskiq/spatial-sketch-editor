# Tech-debt ledger — deferred defects

**Audience:** the implementer of a future slice, plus whoever triages a bug report
against this repository.
**Purpose:** record a defect that is **understood, reproduced and deliberately not
fixed yet** — with the evidence needed to fix it without re-deriving it.
**Not** a plan, not a status tracker and not current working-tree state: those live
in [`docs/roadmap/README.md`](../../roadmap/README.md) and in the track batons routed from
[`docs/operations/current.md`](../current.md).

Entry template:

```text
## TD-n — <one-line defect>
Status        open | removed (<PR>) | retired (<PR>) | fixed (<commit>) | superseded
Found         date + how it was found
Owner         track/slice that owns the remaining obligation
Symptom       user-visible behaviour, exactly as observed
Reproduce     recipe (and the probe that proved it, if temporary)
Root cause    files/lines, layered primary → latent
Why green     which tests would have had to exist to catch it
Fix options   options with tradeoffs + the option that must NOT be taken
Then add      acceptance tests the fix owes
```

**Status vocabulary.** A defect whose implementation #115 deleted is **removed**, and
one whose subject retired with the benchmark is **retired**. Neither is ever recorded
as *fixed*: nothing was repaired, and the obligation that survives is the one named
below, not the entry.

---

## Open

## TD-8 — a task's scoped services go stale after an accepted install, refusing `Begin`

Status        open — intermittent; root cause located
Found         2026-10-18, during T2.P01.S03's browser acceptance run
Owner         Stage host task-scoped services (`apps/editor/src/lib/authoring/stage/stage-facade.ts`,
              `taskServices`/`active()`), not the Scene adapter that surfaced it
Symptom       After a typed commit, Undo and Redo, the Scene instrument's `Use selection` + `Begin`
              refused `stale-epoch: This editing session is stale.` and no form opened. Closing and
              reopening the task recovered it, and the same sequence then worked.
Reproduce     Observed once: commit a typed yaw, Undo, Redo, reopen `Arrange`, `Use selection`,
              `Begin`. It did not reproduce on demand afterwards, so the recipe is not yet reliable.
Recheck       S03's completed acceptance journeys (2026-10-18) ran `Use selection` + `Begin` after
              three accepted installs — two typed `Place`s and one typed `Commit` — at 1280×900 with
              reduced motion on and off. Every `Begin` was accepted; the refusal did not recur. The
              entry stays open: one clean session is not a reproduction, and the generation capture
              it describes is still in the code.
Root cause    The task-scoped services capture `generation = session.writerGeneration()` and gate
              every call on `generation === session.writerGeneration()`. An accepted install or a
              history command bumps the writer generation; if the panel that holds the instrument is
              not rebuilt, its services keep the old generation and every later call refuses.
Why green     No test drives a writer-generation bump while a task panel stays mounted: the
              task-services tests build services after the bump, so they never see a stale copy.
Fix options   1) Have the panel rebuild its task services on `onAdaptersChanged`/install (host-side,
              cheapest); 2) make `active()` compare liveness rather than a captured generation and
              let the facade refuse per operation (wider blast radius). Do **not** let the instrument
              re-acquire services from internals — that would give the adapter a second authority.
Then add      A facade/instrument test that bumps the writer generation under a mounted task and
              asserts the next `Begin` is accepted, plus one that asserts a genuinely ended task
              still refuses.

## TD-9 — the sign-in Save resume is half-wired

Status        open — found by source inspection; not yet reproduced in a browser
Found         2026-10-19, during Batch C coordination (also noted in the unmerged research of PR #154)
Owner         T1 Head integration (the spatial route and Head Save mount). Under batch C ruling C6
              (approved 2026-10-19), `T3.P01.S04` must deliver working F2 recovery when it migrates Save
              callers (deleting the old path does not close this entry), and `T1.P01.S06` verifies the journey end to end.
Symptom       Expected from the code, not yet observed: a Save that needs sign-in can resume only
              while the same editor session stays mounted (*Resume pending save* in the Head). If
              sign-in navigates away, nothing restores the captured Save. T1.P01.S04's acceptance
              text says "pending sign-in drafts resume", which overstates the shipped behaviour.
Reproduce     Signed out, edit a project, then Save; sign in through the redirect flow and return.
              Expected: the capture is not offered again. A browser run must confirm this.
Root cause    `writePendingCloudSave` (`apps/editor/src/lib/platform/project-persistence.ts`) has no
              production caller; only tests call it. The root route reads the draft and redirects
              with `?resume-save=1`, but the spatial route never reads that parameter. The
              same-session retry in `authoring/save/head-save.ts` is the only live path.
Why green     The persistence tests cover the draft codec in isolation. No route-level test drives
              Save → sign-in redirect → return.
Fix options   1) Write the captured `SaveAcceptedSource` draft before the sign-in redirect, and have
              the spatial route consume `resume-save` by offering, never auto-running, the resumed
              Save through the Head. 2) Delete the dead draft path and state that only same-session
              resume is supported — **not acceptable** without an owner-recorded product gap,
              because Core Editor Stability requires sign-in Save recovery. Do NOT resume by installing the draft's document as a new
              baseline without the user's action, and do NOT keep an old-format draft path alive
              past the F2 cutover.
Then add      A route-level test, Save → sign-in → return, that offers exactly the captured Save with
              its precondition and operation ID; and, after the cutover, a test that refuses an
              old-format draft with a notice.

No other entry is open.

## Closed by T3.P01.S04

| TD | Subject | Disposition | Surviving obligation |
| --- | --- | --- | --- |
| **TD-6** | Two migration runners raced on one database: one exited 0, the loser exited 1 although the schema finished complete | **fixed.** `apps/api/src/migrate.ts` takes `pg_try_advisory_lock(MIGRATION_LOCK_KEY)` on the session before reading `schema_migrations`, polls with a bounded 30 s wait and releases in `finally`; a dropped connection releases the session lock too. | None. `apps/api/tests/migration.test.mjs` pins lock-before-read and the unlock; the S04 rehearsal ran two concurrent runners on a fresh database — both exited 0 and `schema_migrations` recorded 1–5 once each. |
| **TD-7** | An `expected-saved-base` Save locked a foreign project row before the owner test | **fixed.** The unit Save path proves ownership with a non-locking owner/F2 query before `SELECT … FOR UPDATE`; a foreign project answers not-found without locking its row. The create-only collision path stays intentionally owner-blind and never reveals owner, name or contents. | None. `apps/api/tests/save-units.test.mjs` asserts the foreign refusal and that no lock precedes the owner test; the live Save lane is the unit handler only. |

TD-9 remains open below. A new deferred defect is added under `## Open` using the template, with the
track or file that owns the remaining obligation named in `Owner`.

---

## Closed by PR #115

All five entries below were dispositioned by the reset. Their full bodies — symptom,
reproduction, root cause, blast radius, options and owed tests — are recoverable, and
nothing is lost by compacting them here:

```text
git show e90a58224443bdbf44114d7285d55c983b79cc84:docs/operations/tech-debt/README.md
```

| TD | Subject | Disposition | Surviving obligation |
| --- | --- | --- | --- |
| **TD-1** | Floor-supported placement was unreachable in canonical (wall-first) projects — no camera, primitive, light or asset could be placed | **implementation removed, not fixed.** The defective placement wiring (the room-first acceptance predicate, the Scene-embedded navigation-graph mutator and the Camera Plan/3D placement branches) was deleted with the editor shell, so the format-gated defect cannot recur: there is no placement path left to fail it. | Its **five acceptance tests transferred verbatim** to [`docs/roadmap/t2-composition/planning-evidence.md`](../../roadmap/t2-composition/planning-evidence.md) §9, including the refusal-is-honest clause and the reasoned-refusal vocabulary (do not invent a second one). |
| **TD-2** | Inspector numeric fields announced `:invalid` while holding legal values (a `min` that was not on the `step` grid) | **implementation removed, not fixed.** The rows were deleted with the editor shell. | The **non-recurrence criterion** — the same defect must not recur in the PLATE number field — is carried in [`docs/roadmap/t1-spatial-world/planning-evidence.md`](../../roadmap/t1-spatial-world/planning-evidence.md) §14. |
| **TD-3** | Editor number fields duplicated the canonical axis colours instead of reading the axis tokens (issue #35) | **fixed** at `be4e23b` (P23.16, owner amendment 2026-09-22): both field components read `--editor-axis-x/y/z`, and the shell type-role test rejects the duplicated hex. The two components themselves were removed by #115. | None from this ledger; the theme contract's invariant (`docs/reference/design-system/spatial-instrument-grammar.md` and the shell contract) still owns the canonical axis palette. |
| **TD-4** | Curved-fixture release-cost increases that did not reproduce across sessions | **retired with the benchmark.** Every number in that family was advisory by design — no threshold, budget or regression guard was ever set — and the harness that produced them (the PERF lane, `lib/bench/**`, the checked-in baseline and the reuse ratchet) was removed by #115. | Recorded as **unresolved**, never as fixed. A future measurement re-derives a same-session before/after arm under a separately authorized benchmark scope. |
| **TD-5** | Reuse and comparison over `$state`-proxied compiled geometry paid a ~12× per-read penalty, and a measured candidate optimization was proven output-identical yet slower | **retired with the benchmark.** No test measured per-access proxy cost, and the reuse counters were counts, not durations. | Its **lesson** — do not deep-proxy compiled geometry, and measure against the input the editor actually hands in — is carried in [`docs/roadmap/t1-spatial-world/planning-evidence.md`](../../roadmap/t1-spatial-world/planning-evidence.md) §15. |

TD-9 is the open entry. TD-6 and TD-7 were fixed by `T3.P01.S04` (see the closure table above). A new
deferred defect is added under `## Open` using the template, with the track or file that owns the
remaining obligation named in `Owner`.
