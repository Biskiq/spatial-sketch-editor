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

TD-11/TD-12 were found by the S06 browser leg and initially exceeded the TD-10-only code scope.
The owner explicitly ratified their narrow corrective amendment during the PR #168 takeover, then
separately approved the TD-13 Index correction. The exact scope and provenance are recorded in the
[S06 amendment](../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s06-integrated-final-gate/d1-amendment.md).

---

## Fixed

## TD-13 — Index selection passes a reactive Plan reference to immutable selection

Status        fixed (`b1ffa4e3`, PR #168 takeover; owner-approved narrow correction)
Found         2026-10-20, real-browser selection of an eligible Index row
Owner         T1 Stage host (spatial route)
Symptom       An Index row throws `DataCloneError` and leaves selection unchanged.
Root cause    `planView` was deep reactive state. `selectSource` handed its proxied fragment reference
              to immutable selection, whose `structuredClone` refuses a Svelte proxy.
Correction    Generated Plan evaluations are replaced whole through `$state.raw`; no nested Plan
              mutation exists and no selection/serialization authority changes.
Evidence      `spatial-route-gesture.test.ts`: mounted Index row selects the requested Wall through
              the real route/session/facade. Real browser independently selected the two named
              Walls, coincident Walls and long identity. The mutation restoring `$state` fails.

## TD-12 — an adapter drag re-reads the evaluation id every frame, so it never commits

Status        fixed (`5beb1e83`, completed by `b1ffa4e3` and route regressions in PR #168)
Found         2026-10-20, driving the direct 3D edit with a real pointer during S06
Owner         T1 Stage host (the spatial route)
Symptom       Selecting a Wall and dragging a Dimensions handle moved the preview for the first
              sample only: the drag then stopped advancing, and release committed nothing or was
              refused as stale. Direct manipulation was effectively unreachable in the browser.
Reproduce     Select a Wall, open `Inspect · Layout → Dimensions`, press a handle and move the
              pointer. Before the fix the overlay preview stopped after the first move and no
              acceptance followed.
Root cause    `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` sent
              `facade.evaluationId()` on every `move`/`up`/`cancel`. The Camera raises a new
              evaluation generation per frame, so the id changed on every sample while the adapter
              was told its projection had changed, and the gesture could never reach a commit.
              Latent: the release path also committed after a reading change had already cancelled
              the lease, instead of cancelling the press.
Why green     The adapter suites drive `pointerIntent` directly with one explicit evaluation id, so
              no test ever re-read the id between phases.
Fix options   1) Carry the evaluation the press was measured in from the claimed `down` through
              every later phase and clear it with the press, and cancel instead of releasing when
              the gesture lease is already gone. 2) Re-evaluate the pointer against the newest
              projection each move — do NOT take this: it silently rebases a drag the creator did
              not measure in that view.
Then add      The browser journey itself (drag commit, Escape cancel, drag after a reading flip).
              The takeover adds `spatial-route-gesture.test.ts`, through the existing route probes:
              ordinary evaluation updates commit once; a genuine reading flip preserves the exact
              request with explicit Resume/Discard; stale release commits nothing. It also covers
              offset hits/echo, cancellation, capture loss, Escape and subsequent reading changes.
              The first repair's direct abort bypassed the accepted S05 pause path; the takeover
              now notifies the existing adapter mismatch path before clearing ownership. A
              reproduced navigation drift during a claimed press is prevented by refusing host
              wheel/Fit/keyboard navigation until release; explicit reading interruption still runs.

## TD-11 — Stage pointer hits and overlay markers mix Stage-local and viewport CSS

Status        fixed (`5beb1e83`, `T1.P01.S06` browser leg)
Found         2026-10-20, driving Plan selection and the Dimensions instrument during S06
Owner         T1 Stage host (the facade and the spatial route)
Symptom       With the Index open beside the Stage, a Plan click selected a subject roughly one
              Index panel away from the pointer, and a Dimensions handle could not be claimed at
              all because the click never reached it. Selection markers painted offset by the same
              amount.
Reproduce     At 1280×900 with the Index open, click a Wall span in Plan: the Card named a
              different Wall (or a room floor). Project a known world point, subtract the evaluated
              rect, and resolve that Stage-local point — pre-fix it missed every surface.
Root cause    `StagePointerIntent.css` and the overlay layer are Stage-surface coordinates, while
              `evaluateViewport`/`projectWorld` return viewport CSS. `stage-facade.ts` compared the
              Stage-local candidate against viewport projections, and `overlays()` returned adapter
              markers in viewport CSS, while the route's `selectionEcho` did the same. The
              translation existed nowhere; it only looked correct while the surface began at the
              window origin.
Why green     Every facade/adapter suite used a rect at the window origin
              (`left: 0, top: 0`), where the two spaces coincide.
Fix options   1) Translate once at the facade boundary in both directions (`resolveSourceHit` adds
              the evaluated rect; `overlays` and the route's selection echo subtract it).
              2) Make adapters project in surface space — rejected: it duplicates the Camera's
              projection contract in every adapter.
Then add      `stage-facade.test.ts` (offset hit resolution, offset overlay marker) and
              `layout-wall-manipulation.test.ts` (handle claim from Stage-local CSS) — added with
              the fix. The takeover adds the mounted route offset-hit/selection-echo assertion in
              `spatial-route-gesture.test.ts`.

## TD-10 — a late successful source Open applies after a newer session epoch

Status        fixed (`21c18402`, `T1.P01.S06` first increment) — disclosed by the PR #159 review;
              pre-existing there, not introduced by that fix
Found         2026-10-19, while reviewing the refused-Open host follow-up
Owner         T1 Stage host (the spatial route) — the obligation is discharged here; the slice that
              consumes the corrected behaviour is `T1.P01.S06`
Symptom       Expected from the code, reproduced at route level: an Open that was admitted before a
              newer project replacement (or reload) finishes could still install its source after the
              newer epoch was mounted, overwriting the newer project and its saved base. The same
              window let a stale refusal print over the newer project.
Reproduce     Admit a Source JSON Open, supersede the project before its result resolves (for
              example by an admitted replacement), then let the first result arrive. A route-level
              harness can delay the admission port instead of racing a real file dialog.
Root cause    `openSourceJson` and `applyReloadOffer` in
              `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` captured the
              admission context but never captured/re-checked `session.isCurrent(token)` after the
              awaited admission, unlike `load` and the resumed-save path. The refused-source
              contract does not depend on it, so PR #159 deliberately did not broaden its scope.
Why green     `spatial-route-source-replacement.test.ts` exercised refusals and one admitted Open
              within a single epoch. No test superseded the session while an admission was in flight.
Fix options   1) Capture the session token before admission and abandon the result when
              `!session.isCurrent(token)`, mirroring `load`; report nothing for the stale action.
              2) Re-check the boot state after admission — weaker: it still races a replacement that
              starts after the check. Do NOT install a late result as a new baseline, and do NOT
              clear the newer saved base.
Fix           Option 1 in both paths. The token is captured before the admission await and the
              result is dropped when its epoch is no longer current, before any status branch, so a
              stale action installs no source, adopts no saved base and reports neither a success nor
              a refusal. No second guard and no session/lifetime refactor.
Then add      A route-level regression: a delayed admitted Open superseded by a newer replacement
              must leave the newer project, its history and saved base intact and must not show a
              stale success or refusal notice.
Tests         `tests/lib/authoring/spatial-route-source-replacement.test.ts`, four mounted cases —
              a delayed admitted Open (superseded by an admitted reload), a delayed refused Open, a
              delayed admitted Reload (superseded by an admitted Open) and a delayed refused Reload;
              each asserts the newer project, its Stage node and its saved base survive and that no
              stale notice is shown. Removing either guard fails exactly those four and leaves the
              six existing replacement cases green. The suite's Head double now takes its reload
              offer from `fixtures/reload-offer.ts`, so an admitting reload is reachable.

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

## TD-16 — perf browser flows still locate the removed ☰ menu and the Stage's Open source JSON

Status        open
Found         2026-11-01, R217.S20 acceptance and independent review (recorded as a residual; the flows were not run)
Owner         T1 Stage host and shell (the controls the flows drive); the integrated perf run belongs to R217.S11
Symptom       The `apps/editor/perf` browser flows press controls that R217.S20 moved or removed. They
              look for "Download source JSON" in the ☰ menu, which the Head no longer has, and for "Open
              source JSON" among the Stage actions, which now sit in the project name's menu and in Find.
              Some also name Stage controls that R217.S13 renamed or moved (Fit, Plan, the `.stage-actions` locator).
Reproduce     Run the affected flows against the Cloud stack (the S20 session had none). Affected files, found by
              search: `apps/editor/perf/lib/flow.ts` (Open source JSON on the Stage, line 118),
              `apps/editor/perf/flows/t1-s02-browser-acceptance.spec.ts`,
              `t1-s03-opening-acceptance.spec.ts`, `t1-s04-integrated-acceptance.spec.ts`,
              `native-form-acceptance.spec.ts`, `s17a-objects-acceptance.spec.ts` and `project-lifecycle.spec.ts`.
Root cause    R217.S20 (O5) moved the source download, project lifecycle and Open source JSON off the ordinary
              surface and removed the ☰ menu. The flows were written against the pre-S20 surface and were not
              updated, because the perf lane needs the Cloud stack and sits outside the S20 tier.
Why green     No gate in the S20 tier runs the perf flows, so the stale locators cannot fail a merge gate.
Fix options   1) Point the locators at the Head's project-name menu, at Find, and at the route function both reach,
              by accessible name. 2) Restore a ☰ menu or a Stage "Open source JSON" button so the old locators
              resolve; do NOT take this, because it restores the second menu O5 removed.
Then add      Each affected flow passes on the Cloud stack with the new locators, and a locator for a removed control
              fails the lane instead of skipping.

## TD-15 — Height Sheet hint repetition is shared across Stage sessions

Status        open
Found         2026-10-30, independent S06 review
Owner         T1 / R217.S06 follow-up
Symptom       After the one-time found-tick hint has appeared in one Stage session, a later distinct
              Stage session may not show the hint even when its own first found tick appears.
Reproduce     In one module lifetime, mount Stage A and trigger the found-tick hint; unmount it,
              then mount a fresh Stage B with a found tick. The module-scoped flag suppresses B's hint.
Root cause    The hint-once flag is module-scoped rather than owned by the Stage session lifecycle.
Why green     Existing acceptance checks cover the hint within one Stage and do not create a second
              Stage session in the same module lifetime.
Fix options   Scope the flag to a Stage session/host, or explicitly define the hint as application-wide.
              Do not change the product's hint cadence without the owning T1 decision.
Then add      A mounted two-session regression that proves the selected cadence and teardown behavior.
Evidence      R217.S06 `evidence/independent-final-review.md` (P3 residual).


## TD-14 — envelope metadata moves outside a planner's content-derived scope check

Status        open
Found         2026-10-22, T3.P03.S01 review of `createUnitAcceptanceAdapter`'s `validateChange`
Owner         T3 F4 acceptance (`unit-acceptance-v1`); no current consumer is blocked
Symptom       An accepted operation can change envelope metadata that no unit payload owns — a unit
              header's `unitId`, or a unit-scoped lock entry's `requiredCapabilities` — while every
              changed-domain comparison reports nothing, so the change is attributed to no planner
              and no declared scope. No user-visible symptom exists: the gap is reachable only from
              planner code, and no authored journey produces it today.
Reproduce     Take a normalized `unit-envelope-v1` project and (a) rewrite `units.layout.header.unitId`
              only, or (b) append a resolvable `layout`/`object` lock entry whose
              `requiredCapabilities` name an uncatalogued capability. Both are admitted by
              `createUnitAcceptanceAdapter().admit`, and `validateChange` with a Layout-only planner
              returns no issue for either — confirmed by a temporary probe against the conformance
              fixture on 2026-10-22 (the probe was deleted; rebuild it from this recipe).
Root cause    `packages/project-model/src/units/acceptance.ts`: `changedDomains` compares
              `units[domain].header.contentRevision`, and `lockChanged` compares only `resource:`
              lock entries. `normalizeUnitEnvelope` (same file) recomputes the `contentRevision`
              field but preserves the rest of each header, every non-revision lock field, and the
              lock's `requiredCapabilities`; `verifyUnitDependencyLocks` re-checks subject
              revisions only. Layered: a unit header is authored-adjacent bookkeeping no planner is
              meant to write, so no check existed to widen.
Why green     No scope test builds a metadata-only candidate expecting acceptance. Every scope test
              changes at least one unit payload, which is exactly what the content-revision
              comparison can see.
Fix options   1) Extend `validateChange` to compare the authored envelope shape it owns — unit
              headers other than `contentRevision` against a recomputed canonical value, and unit
              lock `requiredCapabilities`/`pin` against the planner's grants — the correct fix, once
              a consumer decides whether a unit-scoped lock entry is planner-writable at all.
              2) Compare a whole-envelope digest — do NOT: derived rewrites would become scope
              failures and it duplicates the source-content identity. Keep the typed refusal
              surface unchanged until an option is chosen.
Then add      A refusal test per metadata field the chosen option covers, with the unchanged
              source/revision/history assertions the other scope refusals already use.

No other entry is open. TD-10 was open before it and is fixed above.

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

TD-6, TD-7 and TD-9 were fixed by `T3.P01.S04` (see the closure table above) and TD-10 by
`T1.P01.S06`'s first increment (`21c18402`). TD-14 is the one open entry. A new deferred defect is
added under `## Open` using the template, with the track or file that owns the remaining obligation
named in `Owner`.
