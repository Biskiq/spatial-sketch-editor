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

## Fixed

## TD-8 — a task's scoped services go stale after an accepted install, refusing `Begin`

Status        fixed — shipped in `T1.P01.S05` (PR #156), accepted at `3d432836` on base `919c2904`;
              the merge revision becomes the mainline anchor once #156 lands as a merge commit
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
Fix          Host-side, in `stage-facade.ts` — **option 2 plus a close notification**, not the
             plan's prescribed option 1. Option 1 (rebuild the panel's services on every
             `onAdaptersChanged`) was rejected because that signal also fires for registration,
             selection and re-binds: the panel would re-acquire services on events that do not end
             its authority, and it would still need to distinguish “task gone” from “content
             changed”. The implementation:
             1) the guard no longer captures `writerGeneration()`. It captures the **task object**
                it was opened for and answers live only while `session.task()` is that same object
                and this binding still owns the contributed task (`adapterId` + contribution id).
                The task object is the real lifetime: every path that bumps the generation
                (`openTask`, `resumeTask`, `closeTask`/`cancelTaskWriters`) also replaces or clears
                it, so an accepted install, `Resume`, same-contribution re-open, close or disposal
                revokes the old services. The generation guard's protection is preserved;
             2) an accepted install that **closes the open task** notifies the contribution surface
                synchronously (an install is a command, not a derivation), so a panel showing that
                task learns immediately that it is inactive and can offer `Resume`/reopen instead
                of holding services that silently refuse. The instrument still holds only the
                services it was handed.
             Consequence: **every accepted install closes the open task** — the session has no
             keep-open install path — so a panel never keeps acting across one. The defect was that
             the closed services refused with `stale-epoch` and nothing told the panel, so `Begin`
             looked live but broken. The fix makes the refusal truthful (`inactive-task`) and the
             recovery reachable (the synchronous signal plus fresh services on Resume/reopen); it
             does not pretend a closed task's services still work.
Tests        `tests/lib/authoring/stage-host-acceptance.test.ts`:
             - “re-provisions usable services after an accepted install closed the task” (a real
               adapter view; an accepted install closes the task, the old services refuse
               `inactive-task`, and reopening the contributed task hands out services whose
               `Begin` installs);
             - “invalidates the previous services when the contributed task is replaced”
               (`session.openTask` replaces the task object; the old services refuse and the
               facade's current services install);
             - “notifies the contribution surface synchronously when an accepted install closes the
               open task” (asserts the signal and the closed task immediately after the command);
             - “refuses the same task-scoped services after the contributed task has ended”
               (`closeTask`, then `inactive-task`, no history, no content change).

## Closed by T3.P01.S04

| TD | Subject | Disposition | Surviving obligation |
| --- | --- | --- | --- |
| **TD-6** | Two migration runners raced on one database: one exited 0, the loser exited 1 although the schema finished complete | **fixed.** `apps/api/src/migrate.ts` takes `pg_try_advisory_lock(MIGRATION_LOCK_KEY)` on the session before reading `schema_migrations`, polls with a bounded 30 s wait and releases in `finally`; a dropped connection releases the session lock too. | None. `apps/api/tests/migration.test.mjs` pins lock-before-read and the unlock; `apps/api/tests/migration-fence.test.mjs` runs two concurrent runners in one throwaway schema — both fulfil and `schema_migrations` records 1–5 once each. |
| **TD-7** | An `expected-saved-base` Save locked a foreign project row before the owner test | **fixed.** The unit Save path proves ownership with a non-locking owner/F2 query before `SELECT … FOR UPDATE`; a foreign project answers not-found without locking its row. The create-only collision path stays intentionally owner-blind and never reveals owner, name or contents. | None. `apps/api/tests/save-units.test.mjs` asserts the foreign refusal and that no lock precedes the owner test; the live Save lane is the unit handler only. |
| **TD-9** | The sign-in Save resume was half-wired: only the same mounted session could retry, and the spatial route ignored `resume-save` | **fixed.** The Head writes the exact unit Save capture (operation ID, precondition, canonical source) through a Save-owned pending-capture seam before the sign-in redirect; the draft is v2 with a 15-minute expiry and the legacy v1 shape is invalid. The spatial route consumes `resume-save` by **offering**, never auto-running: a create-only capture is still offered after the cloud 404; resuming goes through the host replacement/unsaved-work confirmation, re-admits under the captured `acceptedRevision` and calls the existing Head retry. Cancellation keeps the current content, selection, history and saved base; a stale admission cannot overwrite a newer session. | None. `spatial-route-resume-save.test.ts` drives Save → sign-in redirect → return → offer → exact replay for create-only and expected-base, including the 404 path, cancellation and the stale-admission drop; `head-save.test.ts` covers the transport and disabled states. Mounted and browser creator runs exercise the full redirect/return/explicit Resume path with external OIDC mocked only at its adapter boundary; real Google OAuth was not exercised. |

## Open

## TD-10 — a late successful source Open applies after a newer session epoch

Status        open — disclosed by the PR #159 review; pre-existing, not introduced by that fix
Found         2026-10-19, while reviewing the refused-Open host follow-up
Owner         T1 Stage host (the spatial route); closed before or with `T1.P01.S06`, which verifies
              the host journeys end to end
Symptom       Expected from the code, not reproduced in a browser: an Open that was admitted before
              a newer project replacement (or reload) finishes can still install its source after
              the newer epoch is mounted, overwriting the newer project and its saved base.
Reproduce     Admit a Source JSON Open, supersede the project before its result resolves (for
              example by an admitted replacement), then let the first result arrive. A route-level
              harness can delay the admission port instead of racing a real file dialog.
Root cause    `openSourceJson` and `applyReloadOffer` in
              `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` capture the
              admission context but never capture/re-check `session.isCurrent(token)` after the
              awaited admission, unlike `load`. The refused-source contract does not depend on it,
              so PR #159 deliberately did not broaden its scope.
Why green     `spatial-route-source-replacement.test.ts` exercises refusals and one admitted Open
              within a single epoch. No test supersedes the session while an admission is in flight.
Fix options   1) Capture the session token before admission and abandon the result when
              `!session.isCurrent(token)`, mirroring `load`; report nothing for the stale action.
              2) Re-check the boot state after admission — weaker: it still races a replacement that
              starts after the check. Do NOT install a late result as a new baseline, and do NOT
              clear the newer saved base.
Then add      A route-level regression: a delayed admitted Open superseded by a newer replacement
              must leave the newer project, its history and saved base intact and must not show a
              stale success or refusal notice.

No other entry is open.

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

TD-10 is the open entry. TD-6, TD-7 and TD-9 were fixed by `T3.P01.S04` (see the closure table
above). A new deferred defect is added under `## Open` using the template, with the track or file
that owns the remaining obligation named in `Owner`.
