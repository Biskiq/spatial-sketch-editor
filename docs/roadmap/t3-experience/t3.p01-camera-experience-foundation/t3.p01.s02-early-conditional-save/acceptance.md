# T3.P01.S02 — acceptance record: Early conditional Save

**Slice:** T3.P01.S02 · **Status:** **implemented 2026-10-16 on PR #133 — awaiting independent
review; not accepted** · **Plan:** [implementation-plan.md](./implementation-plan.md) — owns this
slice's acceptance criteria · **Phase:** [T3.P01](../README.md) · **Register:**
[phase slice register](../README.md#slice-register)

This record holds implementation evidence for independent review. It is **not** acceptance:

- `F4.intent-acceptance@1:conditional-save-current-v1` stays **unaccepted**, with no
  Accepted-capabilities entry and no gate-register change.
- The phase stays `in-progress`; no closeout, merge or phase event is claimed.
- The T1 Head integration (`T1.P01.S04` by default) is **not** part of this slice: no Save control is
  mounted and no route or shell module was edited (decision 1,
  [record](../../../../reference/decisions/s02-pair-authorization-2026-10-16.md)).

## Tested revision and environment

| | |
| --- | --- |
| Branch | `T3-P01-S02` |
| PR | [#133](https://github.com/Biskiq/spatial-sketch-editor/pull/133) |
| Base | post-PR #132 `main` (`74367936ea0cb1754c45021c4f10ca69b17ca7b0`) |
| Tested code revision | `5593b8bc2bf316546cdd8b95486f8dd712367436` (implementation + tests) |
| Evidence docs | this record's docs commit after the tested revision; docs-only, no product change |
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
| `npx vitest run` on the six new editor suites | 6 files / **28 tests** pass |
| `npm run test:arch` | 18 files / **151 tests pass** |
| `npx vitest run --maxWorkers=1` (the complete default config) | 140 files / **1845 tests pass** |
| `DATABASE_URL=postgresql://localhost:5432/biskiq_s02 npm run test:api` | **51 tests pass, 0 failed, 0 skipped** |

The full editor suite includes the heavy lane (`test:heavy` members run in the default config). At
the tested revision, plain `npm test` reached **1844/1845** and failed only on the **pre-existing 5 s
timeout** of `camera-output-conformance.test.ts` (a file this slice does not touch) while the host
was heavily loaded; the same command had been fully green (1844/1844) at `f2fe1650` earlier. The
complete suite was therefore run with one worker (`npx vitest run --maxWorkers=1`, same config,
assertions and timeouts) and passed **1845/1845**. No test was skipped, narrowed or given a longer
timeout. The API command is the DB-backed `test:api` lane; its zero-skip output is the
concurrency/failure evidence, not a mock.

## Exit-criterion evidence

### Real-Postgres Save conformance — `apps/api/tests/save.test.mjs` (12 tests, no skip guards)

| Criterion | Evidence |
| --- | --- |
| Same-base writers, exactly one winner | Two `expected-saved-base` Saves from one token, issued concurrently: one 200, one 409 `conflict` with no remote contents, one new version, one new receipt. |
| Concurrent `create-only`, one winner | Two concurrent create-only Saves on one ID: one 200, one 409 `save_collision`; exactly one version and one receipt. |
| Owner-blind collision | Owner and stranger both receive the identical `save_collision` body; expected-precondition stranger receives 404 `not_found`. |
| No partial version/pointer update | An injected `BEFORE UPDATE` trigger on `projects` fails the pointer write after version staging: 503, zero new version, zero receipt, pointer/token unchanged; a subsequent Save succeeds. |
| Retry returns original receipt | Exact replay returns byte-identical acknowledgement and adds no version/receipt. Two **concurrent** identical retries both replay the winner's receipt with one version. |
| Changed-payload retry refuses | Same operation ID with different source, and same operation ID with a changed precondition, both return 400 `retry-payload-mismatch`; no version. |
| Failed full validation | Invalid document, unknown registry asset and unknown registry material each return 400 `invalid_project` with issues and write nothing. |
| Editor/API unknown-asset parity | API Save refuses `asset-not-in-the-host-catalogue`; the editor-side fixture in `save-admission-parity.test.ts` refuses the same source through `MUSEUM_SCENE_VALIDATION_OPTIONS`. |
| Unconditioned body refuses | 400 `precondition_required`; no project row and no write. |
| Any refusal writes nothing at all | A create-only admission refusal leaves no project row **and no `users` row**: the whole transaction, owner record included, is undone. |
| Scheme / source-version / digest mismatch | Each returns its own refusal (`identity-scheme-mismatch`, `source-version-mismatch`, `content-identity-mismatch`), never `conflict`; non-canonical bytes also return `content-identity-mismatch`. |
| Revision identity reuse | Same accepted revision with different contents returns 400 `revision-reuse`; no version. |
| Legacy base that fails registry admission | A permissively written unknown-asset row (token, no revision/digest) contributes an empty baseline; a valid candidate saves as version 2 and repairs it. |

`apps/api/tests/projects.test.mjs` additionally proves conditional create/update, immutable version
rows, owner isolation, additive `GET` metadata, stale-token conflict, malformed/invalid/mismatched/
oversized request distinction, and a payload just under 2 MiB.

### Client Save state — `apps/editor/tests/lib/authoring/save-state.test.ts` (7 tests)

Driven by a real `createAcceptanceCoordinator` and the current-source adapter:

- an edit during an in-flight Save stays `dirty`, and only the captured bytes become acknowledged;
- a replacement session epoch drops the response (`stale-epoch`), marking nothing saved;
- a conflict preserves the local accepted revision, source and history, loads remote data only as an
  offer, and `reloadRemote()` returns data for the Head's replacement guard;
- Undo back to saved contents reads `saved` on full-source equality;
- a cursor-only divergence with an equal digest reads `dirty` (full-byte comparison);
- a pre-migration token-only baseline starts `dirty` and uses the token as its precondition;
- Save adds no history entry and leaves Undo unavailable.

### Client transport and draft — `apps/editor/tests/lib/platform/project-persistence.test.ts` (9 tests)

One conditional PUT body with the whole capture; conflict/collision/auth mapping; additive `GET`
metadata including a legacy null revision/digest; pending draft carries the capture and keeps
`ready.project`; legacy v1 drafts read `invalid` and are cleared; expiry and bare-document refusal.

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

## Explicit non-claims and review focus

- **No acceptance.** The capability is not accepted, the gate register is unchanged, and no T1/T2
  slice may enable Save from this evidence.
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
