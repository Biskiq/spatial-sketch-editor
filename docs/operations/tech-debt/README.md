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

## TD-6 — the migration runner races between two concurrent processes

Status        open
Found         2026-10-16, reproduced while verifying T3.P01.S02 on a fresh database
Owner         `apps/api` persistence/migration (`apps/api/src/migrate.ts`) — no slice currently owns it
Symptom       Two migration processes started at once against one fresh database: one exits 0, the
              other exits 1 although the schema ends complete (`pg_type` duplicate-object and a
              duplicate version insert are the observed failures).
Reproduce     Start two `npm run migrate` processes against the same empty database; the loser fails
              while `schema_migrations` and the tables finish complete.
Root cause    `apps/api/src/migrate.ts` reads `schema_migrations` and runs `CREATE TABLE IF NOT
              EXISTS` outside any lock, so the check-then-create and the version insert are not
              serialized. Latent for every migration; S02's additive 004 is idempotent, which removes
              only the constraint-exists failure mode, not this one.
Why green     No suite starts two migration runners concurrently; the single-runner path never sees it.
Fix options   Take a session advisory lock (`pg_advisory_lock`) around the whole run before reading
              `schema_migrations`, or serialize with a transaction-level lock. Do NOT treat
              `IF NOT EXISTS` as a lock — it is not one.
Then add      A two-runner integration test: at most one process exits non-zero, the schema is
              complete, and `schema_migrations` records each version once.

## TD-7 — an `expected-saved-base` Save locks a foreign project row before the owner test

Status        open
Found         2026-10-16, noted during the T3.P01.S02 server-concurrency review
Owner         `apps/api` Save persistence (`apps/api/src/save-persistence.ts`) — identified by T3.P01.S02
Symptom       An `expected-saved-base` Save naming another owner's project takes `SELECT … FOR UPDATE`
              on that foreign row and only then answers `not-found`.
Reproduce     Call the conditional Save route with a well-formed saved-base precondition for a project
              owned by another user; the row is locked before the 404 is produced.
Root cause    The row lock precedes the ownership predicate — the same shape the removed client
              `saveProject` had — and the create-only owner-blind collision path needs to see foreign
              rows, so the lock is load-bearing there.
Why green     Tests assert the refusal code, not the lock order; a concurrent foreign write is not
              exercised.
Fix options   Test ownership before taking the write lock where the collision path allows it, or take
              a weaker lock for the owner test while keeping the create-only collision owner-blind. Do
              NOT reveal owner, name or contents while distinguishing the row.
Then add      A concurrency test: a foreign `expected-saved-base` Save does not block the row owner's
              own Save, and still answers `not-found` with no write.

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

TD-6 and TD-7 are the open entries. A new deferred defect is added under `## Open` using the
template, with the track or file that owns the remaining obligation named in `Owner`.
