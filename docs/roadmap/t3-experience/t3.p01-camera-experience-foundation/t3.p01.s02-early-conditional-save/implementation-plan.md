# T3.P01.S02 — Early conditional Save: implementation plan

**Slice:** T3.P01.S02 · **Status:** approved (owner-authorized 2026-10-16,
[record](../../../../reference/decisions/s02-pair-authorization-2026-10-16.md)) — not started ·
**Phase:** [T3.P01](../README.md) · [slice register](../README.md#slice-register) · **Track:**
[T3](../../README.md) · **Runbook:** [T3 operations](../../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F4.intent-acceptance@1
REQUIRES: F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t3.p01.s04-live-ownership-cutover/implementation-plan.md
```

**Engineering principle.** Exercise ambitious independent engineering judgment: challenge
assumptions, investigate missing invariants and cross-system failure modes, pursue stronger or
simpler solutions, and resolve demonstrated defects without speculative abstractions or
unauthorized contract changes.

## Prerequisite

`T1.P01.S03`'s `local-single-domain-v1` and its prerequisite `acceptance-invariants-v1` were accepted
at `8ec0c5f1`. That commit is an ancestor of post-PR #129 `main` (`1315b1a2`), so a branch cut from
that base satisfies the trusted-base rule. The slice needs no F2, F3, viewport, editor host or source
cutover. It consumes nothing from `T1.P01.S02` (PR #128) or `T2.P01.S02`, which run in parallel under
the [pair protocol](../../../cross-track-execution.md#parallel-pair-2026-10-16).

## Produces and ownership

`F4.intent-acceptance@1:conditional-save-current-v1`
([AM-4](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1))
is an extension scope on T1's F4 entry. T1.P01.S03 stays the gate's sole provider. On acceptance, this
slice records the capability in its own durable record, which declares `local-single-domain-v1` as
its prerequisite and retires with it at `T3.P01.S04`.

| Concern | Owner |
| --- | --- |
| `SaveAcceptedSource@1`, receipt and refusal shapes; precondition semantics | This slice: runtime-safe, on a new `@portfolio/project-model` subpath export, off the root barrel |
| Server write/read path, migration, admission and receipts | This slice (`apps/api`) |
| Editor client and the client Save state machine | This slice: editor-only, never reachable from the public route |
| Mounting state and commands in the PLATE Head; unsaved-work signalling at exit/replacement; Reload through the host's replacement guard | T1 Head integration (the host↔F4 wiring slice, `T1.P01.S04` by default), outside this slice |

The state machine is framework-free. It takes explicit inputs: the coordinator's current admitted
source and session epoch, read through the landed `$lib/authoring/f4` API. It exposes commands and an
observable state for the Head to render. It imports no Svelte, host, Stage or route module and edits
no route.

## Scope

**Capture.** Save captures one immutable locally accepted source and its full canonical JSON,
`AcceptedRevision`, content digest, `sourceKind`/`sourceVersion`, the content-identity scheme, a
stable Save operation ID and a `create-only` or `expected-saved-base {token}` precondition. The scheme
is one additive constant beside the content-identity export. T3 adds it under T1 review; T1 keeps
ownership of the digest's meaning. Saving neither edits the source nor adds an Undo entry.

**Server write.** Use one write route. The transaction runs the shared current-source admission:
`admitCurrentSourceContent` with full validation, runtime preparation and blocking-compile
comparison. It uses the API's existing registry Scene catalogue, moved into one API module that
publication also uses, with publication behavior unchanged. The blocking-issue baseline is the
expected saved base's issues; `create-only` has an empty baseline. Under the row lock, compare
ownership and the saved-base token. Then recompute the digest with the single content-identity
export, and append the version and update the pointer atomically. A partial version/pointer update
is impossible.

The server stores the captured revision, digest and full-source hash beside the strict document,
never inside it. It returns the persisted revision/digest and a fresh saved-base token. That token is
durable metadata. It is distinct from the local revision, from the SQL `version` ordinal (which
publication status keeps reading unchanged) and from publication OCC.

**Refusals.** Each refusal writes nothing:

| Case | Refusal |
| --- | --- |
| Unconditioned body (old client) | Refused, with no implicit create |
| Token mismatch | `conflict`, carrying no remote contents |
| `create-only` against any existing ID | One owner-blind collision |
| Another owner's project under `expected-saved-base` | `not-found` |
| Admission failure | The admission's own issues |
| Scheme or source-kind/version mismatch | `identity-scheme-mismatch` |
| Same scheme, different digest | `content-identity-mismatch` |
| Revision identity reused with different contents | Refused |

**Receipts.** A receipt is keyed by project and Save operation ID. It binds the full canonical bytes
and the precondition. An identical retry returns the original receipt without another version. A
changed payload under the same ID refuses. A network-ambiguous Save is resolved through its receipt
before any retry from a new base. Receipts never enter the authored document and are visible only to
the owner.

**Load side.** `GET` additively returns the saved-base token and, where recorded, the persisted
revision/digest beside the document. Existing fields keep their meaning, so the read-only T1 boot
works in either merge order. The migration assigns tokens to existing rows. Their revision/digest
stay absent, and the token alone is the precondition. The `projects` listing is unchanged.

**Client.** Replace the unconditional client `saveProject` with the conditional call. No unconditioned
write remains in the editor. The pending sign-in draft is re-keyed to carry the whole capture
(precondition, operation ID and source). Legacy entries read as `unavailable`. `readPendingCloudSave`
and `clearPendingCloudSave` keep their signatures, so the `/` route needs no edit. Resuming a draft
into a live session belongs to T1's Head integration.

**Client state.** The state machine tracks never-saved (`create-only`), `saved`, `dirty`, `saving`
(with dirty-while-saving), `conflict`, `refused`, retryable `error` and `auth-required`.
- **Saved versus dirty** compares the full captured canonical source with the acknowledged one, not
  only the digest.
- **Acknowledgment** marks saved only the contents it captured. Edits made during a Save stay dirty.
- **Epoch guard:** a response from a replaced session epoch is dropped. It neither marks anything
  saved nor installs anything.
- **Conflict** keeps local source and history and the remote data. It offers *Reload remote* after
  offering a local JSON download, and nothing else: no automatic merge, rebase or overwrite.
- **Local editing and Undo** stay immediate; no edit becomes a server command.

## Exit criteria

- Real-Postgres conformance with **zero skips**: same-base writers with exactly one winner;
  concurrent `create-only` with one winner; owner-blind collision; another owner's project is
  `not-found`; no partial version/pointer update; retry returns the original receipt; a
  changed-payload retry refuses; failed full validation; an unknown-asset source refuses with the
  same result in editor admission and API Save (parity fixture); the unconditioned body refuses;
  scheme and digest mismatch refuse.
- Client-state conformance against a real `createAcceptanceCoordinator`:
  - an edit during an in-flight Save stays dirty;
  - a stale prior-epoch response is dropped;
  - a conflict preserves local source and history;
  - Undo back to saved contents reads `saved` only on full-source equality;
  - Save adds no history entry.
- Call-site proof: no editor module reaches an unconditioned write. The Save client and state are
  absent from the public route's module graph (additive boundary assertions).
- Publication status/version behavior is unchanged, and the API suites stay green.
- The common gate being accepted for local operations is not Save evidence. Record the capability
  before any T1/T2 slice enables Save. F2-backed Save remains unsupported until S03.

## Readiness declaration

This slice is **owner-authorized and approved, not started**. Nothing here claims implementation,
acceptance or readiness. Evidence belongs in [acceptance.md](./acceptance.md).
