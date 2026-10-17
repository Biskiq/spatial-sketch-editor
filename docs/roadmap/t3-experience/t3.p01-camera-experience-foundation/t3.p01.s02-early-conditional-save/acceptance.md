# T3.P01.S02 — acceptance record: Early conditional Save

**Slice:** T3.P01.S02 · **Status:** **ACCEPTED 2026-10-16 at reviewed implementation revision
`8dd53260` and shipped via PR #133** (owner-authorized combined acceptance-and-closeout) · **Plan:**
[implementation-plan.md](./implementation-plan.md) — owns this slice's acceptance criteria ·
**Phase:** [T3.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

Acceptance adjudication (owner-authorized 2026-10-16). The owner authorized a combined
acceptance-and-closeout. The already-recorded independent-review and verification evidence below was
adjudicated against every approved exit criterion and prerequisite before acceptance; this record
reuses that evidence and re-runs nothing:

- `F4.intent-acceptance@1:conditional-save-current-v1` is **accepted and active**, recorded in its
  durable [capability record](./capability-conditional-save-current-v1.md) and the gate register.
- Prerequisites `F1.reference@1:references-v1` (`ee463d0b`) and
  `F4.intent-acceptance@1:local-single-domain-v1` with `acceptance-invariants-v1` (`8ec0c5f1`) are
  accepted on this slice's trusted base and are ancestors of the reviewed revision.
- Independent review — three reviewers (server concurrency, the framework-free state machine,
  transport/draft integrity) plus two follow-up P1 rounds — recorded every substantiated in-scope
  finding as fixed at the tested revision; no in-scope defect remains open.
- The plan declares `architecture-integration`; its integration route is
  [T3.P01.S04](../t3.p01.s04-live-ownership-cutover/implementation-plan.md), which still owes the
  integrated result. That deferral does not narrow this slice's own exit-criteria evidence.
- The T1 Head integration (`T1.P01.S04` by default) is **not** part of this slice: no Save control is
  mounted and no route or shell module was edited (decision 1,
  [record](../../../../reference/decisions/s02-pair-authorization-2026-10-16.md)).

## Tested revision and environment

| | |
| --- | --- |
| Branch | `T3-P01-S02` |
| PR | [#133](https://github.com/Biskiq/spatial-sketch-editor/pull/133) |
| Base | post-PR #132 `main` (`74367936ea0cb1754c45021c4f10ca69b17ca7b0`) |
| Tested code revision | `8dd53260d4ba1545ef2977612d78a00f80d8d393` (implementation + tests, including the review and both P1 follow-ups) |
| Evidence docs | the commit after the tested revision: this record only, no product change |
| Runtime | macOS (aarch64), Node `v26.7.0` |
| Database | PostgreSQL `14.19` (Homebrew), local database `biskiq_s02`, migrations applied twice |

The DB target is deliberately a dedicated local database, not the shared `biskiq` database and not a
remote/production database. No production or preview environment was touched.

## Commands and results

| Command | Result |
| --- | --- |
| `npm run check:project-model` | pass (tsc, no errors) |
| `npm run check:api` | pass (tsc, no errors) |
| `npm run check` | pass (`svelte-check`, 0 errors / 0 warnings) |
| `npx vitest run` on the six new editor suites | 6 files / **39 tests** pass |
| `npm run test:arch` | 18 files / **151 tests pass** |
| `npx vitest run --maxWorkers=1` (the complete default config) | 140 files / **1856 tests pass** |
| `npm test` (the same complete config, default workers) | 140 files / **1856 tests pass** |
| `DATABASE_URL=postgresql://localhost:5432/biskiq_s02 npm run test:api` | **53 tests pass, 0 failed, 0 skipped** |
| `psql -f migrations/004-conditional-save.sql` twice on the migrated schema | both exit 0, one constraint |

The full editor suite includes the heavy lane (`test:heavy` members run in the default config). At
the tested revision, plain `npm test` passed **1856/1856**. Earlier in the slice the same command
intermittently failed only on **pre-existing 5 s timeouts** in files this slice does not touch
(`camera-output-conformance.test.ts`, 7.8–10.5 s; `p23b11-conditional-gate.test.ts`, 8.7 s) while
the host was heavily loaded, which is why the gate is also run with one worker (`npx vitest run
--maxWorkers=1`, same config, assertions and timeouts): **1856/1856**. No test was skipped, narrowed or given a longer timeout. The
API command is the DB-backed `test:api` lane; its zero-skip output is the concurrency/failure
evidence, not a mock.

## Exit-criterion evidence

### Real-Postgres Save conformance — `apps/api/tests/save.test.mjs` (14 tests, no skip guards)

| Criterion | Evidence |
| --- | --- |
| Same-base writers, exactly one winner | Two `expected-saved-base` Saves from one token, issued concurrently: one 200, one 409 `conflict` with no remote contents, one new version, one new receipt. |
| Concurrent `create-only`, one winner | Two concurrent create-only Saves on one ID: one 200, one 409 `save_collision`; exactly one version and one receipt. |
| Concurrent identical create-only retries | The same create-only request issued twice at once: both 200 with byte-identical acknowledgements, one version, one receipt. |
| One operation ID, different bytes, create race | Two concurrent create-only payloads under one operation ID: one 200, one 400 `retry-payload-mismatch`; one version and one receipt, owned by that operation. |
| Owner-blind collision | Owner and stranger both receive the identical `save_collision` body; expected-precondition stranger receives 404 `not_found`. |
| No partial version/pointer update | An injected `BEFORE UPDATE` trigger on `projects` fails the pointer write after version staging: 503, zero new version, zero receipt, pointer/token unchanged; a subsequent Save succeeds. |
| Retry returns original receipt | Exact replay returns byte-identical acknowledgement and adds no version/receipt. Two **concurrent** identical retries both replay the winner's receipt with one version. |
| Changed-payload retry refuses | Same operation ID with different source, and same operation ID with a changed precondition, both return 400 `retry-payload-mismatch`; no version. |
| Failed full validation | Invalid document, unknown registry asset and unknown registry material each return 400 `invalid_project` and write nothing; the unknown-asset refusal also asserts a non-empty `issues` array reaches the client. |
| Editor/API unknown-asset parity | API Save refuses `asset-not-in-the-host-catalogue`; the editor-side fixture in `save-admission-parity.test.ts` refuses the same source through `MUSEUM_SCENE_VALIDATION_OPTIONS`. |
| Unconditioned body refuses | 400 `precondition_required`; no project row and no write. |
| Any refusal writes nothing at all | A create-only admission refusal leaves no project row **and no `users` row**: the whole transaction, owner record included, is undone. |
| Scheme / source-version / digest mismatch | Each returns its own refusal (`identity-scheme-mismatch`, `source-version-mismatch`, `content-identity-mismatch`), never `conflict`; non-canonical bytes also return `content-identity-mismatch`. |
| Revision identity reuse | Same accepted revision with different contents returns 400 `revision-reuse`; no version. |
| Legacy base that fails registry admission | A permissively written unknown-asset row (token, no revision/digest) contributes an empty baseline; a valid candidate saves as version 2 and repairs it. |

`apps/api/tests/projects.test.mjs` additionally proves conditional create/update, immutable version
rows, owner isolation, additive `GET` metadata, stale-token conflict, malformed/invalid/mismatched/
oversized request distinction, and a payload just under 2 MiB.

### Client Save state — `apps/editor/tests/lib/authoring/save-state.test.ts` (16 tests)

Driven by a real `createAcceptanceCoordinator` and the current-source adapter:

- an edit during an in-flight Save stays `dirty`, and only the captured bytes become acknowledged;
- a replacement session epoch drops the response (`stale-epoch`), marking nothing saved;
- a conflict preserves the local accepted revision, source and history, loads remote data only as an
  offer, and `reloadRemote()` returns data for the Head's replacement guard;
- Undo back to saved contents reads `saved` on full-source equality;
- a cursor-only divergence with an equal digest reads `dirty` (full-byte comparison);
- a pre-migration token-only baseline starts `dirty` and uses the token as its precondition;
- Save adds no history entry and leaves Undo unavailable;
- a snapshot derives its steady `status` from the same comparison as `dirty`, so an accepted edit is
  never reported as `saved` before `refresh()` runs;
- a replaced session drops its retained capture, so `retry()` mints a fresh operation for the
  session's own revision instead of resending the previous project;
- a retryable failure keeps the capture and retries the same operation ID, while a refusal mints a
  new one;
- an acknowledgement that does not describe the captured project, revision and digest is refused as
  a non-retryable `server` error instead of being adopted;
- a conflict load only ever fills the conflict that requested it, never a newer one that captured
  the same bytes;
- a conflict's JSON offer is the **current** local source at snapshot time — an edit made during the
  Save *and* an edit made after the conflict was detected are both what the user can keep, with a
  digest that describes the same bytes, while the remote offer and the conflict's lifetime stay put;
- a new Save while a network-ambiguous capture is unresolved answers `unresolved`, sends nothing and
  keeps the capture; `retry()` then settles it through its receipt before newer contents save under
  a fresh operation ID.

### Client transport and draft — `apps/editor/tests/lib/platform/project-persistence.test.ts` (11 tests)

One conditional PUT body with the whole capture; conflict/collision/auth mapping; a 408 or 429 is a
retryable `network` failure so the capture survives for a receipt-resolved retry; additive `GET`
metadata including a legacy null revision/digest; pending draft carries the capture and keeps
`ready.project`; a draft whose capture names a different project than its bytes is refused on write
and read; legacy v1 drafts read `invalid` and are cleared; expiry and bare-document refusal.

### Protocol — `apps/editor/tests/lib/project-model/save-protocol.test.ts` (5 tests)

Exact capture reader; unknown keys, protocol, project/revision mismatch, malformed token, bad
operation ID, digest form, empty source and zero source version refuse; create-only vs
expected-saved-base are distinct; saved-base token format. The golden digest
(`sha256-794ff6c9…`) and full-source hash (`sha256-9a203a10…`) pin
`project-model/canonical-authored-json@1` to the landed content-identity export.

### Caller retirement and boundaries

- `apps/editor/tests/lib/authoring/save-call-sites.test.ts` (arch lane) scans the editor tree: no
  `saveProject` call and no bare `{ document: … }` save body remain; the one client entry point is
  `saveAcceptedSource`.
- `apps/editor/tests/lib/authoring/f4-public-isolation.test.ts` (arch lane) proves the public route
  closure excludes the Save state, the cloud client and all editor authoring machinery, and that the
  Save state closure has no visitor, Stage, route or Svelte module.

### Publication unchanged

`apps/api/tests/publication.test.mjs` remains green (10 tests) including publish/update/unpublish,
ABA OCC, release freezing and concurrent publishers. `latest_version` and publication status keep
their existing meaning; the saved-base token is separate.

## Refusal matrix as exercised

| Case | Observed |
| --- | --- |
| Unconditioned body | 400 `precondition_required`, no write |
| Token mismatch | 409 `conflict`, `{error}` only, no remote contents |
| `create-only` against any existing ID | 409 `save_collision`, identical for owner and stranger |
| Another owner under `expected-saved-base` | 404 `not_found` |
| Admission failure | 400 `invalid_project` with the admission's issues, no write |
| Identity-scheme mismatch | 400 `identity-scheme-mismatch` |
| Source kind/version not admitted | 400 `source-version-mismatch` |
| Same scheme, different digest/bytes | 400 `content-identity-mismatch` |
| Revision reused for different contents | 400 `revision-reuse` |
| Changed payload under one operation ID | 400 `retry-payload-mismatch` |

## Independent review (2026-10-16)

Three reviewers read the slice independently — server concurrency, the framework-free state machine,
and transport/draft integrity — and every finding was checked against the code before it was acted
on. Findings that survived scrutiny became code or tests at `b22d32f2`:

| Finding | Disposition |
| --- | --- |
| A snapshot could report `saved` while its `dirty` flag was true | Fixed: steady status derives from the same full-source comparison; covered. |
| A replaced session retained the previous capture, which `retry()` would resend | Fixed: the capture drops with the epoch; covered. |
| A stale conflict load could fill a newer conflict over the same bytes | Fixed: a load completes only the conflict it created; covered. |
| A foreign acknowledgement was adopted as saved | Fixed: project/revision/digest are cross-checked; covered. |
| A draft could pair a capture with a document of another project | Fixed on both write and read; covered. |
| 408/429 became a non-retryable refusal that discarded the capture | Fixed: both map to retryable `network`; covered. |
| The create-only lost-race receipt branch had no test | Covered: concurrent identical create retries and one-ID/different-bytes. |
| The same-base test counted receipts in aggregate only | Tightened: receipts are asserted per operation ID. |
| The record claimed admission `issues` while the test asserted only the code | Tightened: a non-empty `issues` array is asserted. |
| Migration 004's constraint was the tree's only non-idempotent statement | Fixed with a `pg_constraint` guard; re-applying the file twice is now a no-op (verified). |

Checked and **not** substantiated: no interleaving loses or duplicates a version; no refusal path
writes; Save and publish share no lock order that can deadlock; replaying a receipt whose token has
since moved is correct (returning the newer token would silently skip the other writer's version —
the next Save conflicts instead); the additive `GET` metadata is safe in either merge order.

### Follow-up P1 review (2026-10-16)

Two P1 findings were reproduced against the state machine and AM-4 before anything changed; both
regression tests failed on the reviewed head and pass at `fd3c55ec`.

| Finding | Reproduction | Disposition |
| --- | --- | --- |
| A conflict's recovery offer captured the in-flight bytes while local work had moved on, so the JSON the Head would hand the user was stale and its digest described a different source | Edit during an in-flight Save, then answer `conflict`: `localJson` was the captured bytes, `localSourceContentId` the newer source's digest | Fixed: the offer reads the current source and pairs it with its own digest. AM-4's "conflicts preserve local work/history" now holds for edits made during the Save. History is untouched, reload stays explicit. |
| After a network-ambiguous Save, a new Save with changed contents minted a fresh operation and overwrote the retained capture, discarding the receipt that could still decide whether the earlier write landed | Retryable error, edit, then `save()`: the transport was called with a new operation ID and `pending` was replaced | Fixed: `save()` answers `unresolved` while the retained capture no longer matches, so `retry()` resolves the ambiguity first; identical contents still reuse the operation and its receipt. An in-flight Save still answers `busy`. |
| Edits made *after* the conflict was detected were absent from the recovery download: the offer was captured once at detection | Conflict, then `acceptEdit`, then `getSnapshot()`: `conflict.localJson` still returned the detection-time bytes | Fixed: the snapshot derives the local side from the current source on every read, so the download is the newest work. The remote side and the conflict's lifetime are unchanged — `reloadRemote()` returns the same offer and the conflict still ends only through reload or a new Save. |

Both fixes are within the ratified contract: receipt idempotency, the conditional write, local
history and explicit conflict resolution are unchanged, and no server, protocol or migration file
was touched.

### Deferred findings (not this slice)

- **The migration runner is not safe for two concurrent processes.** `apps/api/src/migrate.ts`
  checks `schema_migrations` outside a lock, so two runners race on `CREATE TABLE IF NOT EXISTS`
  (`pg_type` duplicate) and on the version insert. Reproduced on a fresh database: one runner exits
  0, the other exits 1 although the schema is complete. This predates S02 and affects every
  migration; the fix is an advisory lock in the runner, which belongs to that file's owner. S02's
  own migration is idempotent, which removes the constraint-exists failure mode but not this one.
- **A foreign project row is locked before the owner test.** An `expected-saved-base` Save against
  another owner's project takes `FOR UPDATE` on that row and then answers `not-found`. The same
  shape existed in the removed `saveProject`, and the create-only owner-blind collision needs to
  see foreign rows, so it is documented rather than changed here.

## Explicit non-claims and review focus

- **Acceptance is this slice's, not a consumer's.** `F4.intent-acceptance@1:conditional-save-current-v1`
  is accepted and active from this evidence; a T1/T2 consumer enables Save only through that recorded
  capability and its prerequisite closure.
- **The Save state is bound to the baseline it was constructed with.** It is not re-derived when a
  session is replaced: a Head that swaps in a *different* project must construct a new state, or it
  will send the old project's token with the new project's capture. The server refuses and writes
  nothing, so this is a wiring rule, not a data risk — and it is the Head integration's to honour.
- **A returned `SaveOutcome` is a fact about that request**, not the live view: a second Save may
  already have replaced the snapshot by the time an earlier promise resolves. The Head must handle
  the `unresolved` outcome by offering `retry()`; that is the receipt path, not an error.
- **No Head integration.** The state machine is unmounted by design; `T1.P01.S04` (or the authorized
  host↔F4 slice) owns the PLATE Head, unsaved-work signalling and routing *Reload* through the
  replacement guard. The read-only T1 boot remains safe in either merge order because `GET` is
  additive.
- **F2-backed Save is unsupported** until `T3.P01.S03`; this slice admits the current source only.
- **No source cutover, migration inventory or recovery claim** — those remain `T3.P01.S04`'s.
- **No production database evidence.** The migration and contention proofs ran on a dedicated local
  PostgreSQL 14.19 database; deployment/migration on a hosted database is not claimed.

Independent review should focus on: the expected-base baseline rule for legacy rows; receipt
replay versus token movement; owner-blind collision and conflict bodies; exact canonical-byte
comparison versus the cursor-excluded digest; and the pending-draft legacy read.
