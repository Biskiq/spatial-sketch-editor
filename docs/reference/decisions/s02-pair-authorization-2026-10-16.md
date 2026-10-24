# T2.P01.S02 ∥ T3.P01.S02 authorization and reconciliation decision

**Date:** October 16, 2026. **Status:** **owner-authorized**, conditional on the reconciliation
below. The owner authorizes `T2.P01.S02` and `T3.P01.S02` to run in parallel and settles Save
ownership: **T3 owns persistence and client Save state; T1 owns the shell Head integration.** The
authorization and the reconciled plans land together in one docs-only PR. They take effect only
when that PR merges after independent review. Until then nothing here is claimable work.

This record is decision provenance, like the
[2026-10-16 parallel authorization](./parallel-slice-authorization-2026-10-16.md). It changes no
ratified contract. F.4 semantics stay in
[AM-4](../composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1), lifecycle and
gate identity stay in the [roadmap register](../../roadmap/README.md#gate-register), and each slice's
scope stays in its own plan.

## Authorization

| Slice | Phase | Plan | Consumes / Requires at authorization |
| --- | --- | --- | --- |
| `T2.P01.S02`: Scene operations and shared history | T2.P01 | [plan](../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s02-scene-operations-and-history/implementation-plan.md) | `F1.reference@1`, `F4.intent-acceptance@1` / `references-v1`, `local-single-domain-v1` |
| `T3.P01.S02`: Early conditional Save | T3.P01 | [plan](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s02-early-conditional-save/implementation-plan.md) | `F1.reference@1`, `F4.intent-acceptance@1` / `references-v1`, `local-single-domain-v1` |

Every consumed gate and required scope is `accepted` on the trusted base, post-PR #129 `main`
(`1315b1a2`). `F1.reference@1:references-v1` was accepted at `ee463d0b`.
`F4.intent-acceptance@1:local-single-domain-v1` and its prerequisite `acceptance-invariants-v1` were
accepted at `8ec0c5f1`. Both commits are ancestors of `1315b1a2`. `T2.P01.S01`, the in-phase
prerequisite of `T2.P01.S02`, shipped in PR #130. `T3.P01.S01` (PR #131) is not a prerequisite of
`T3.P01.S02`.

**Independence from PR #128.** Neither slice consumes `T1.viewport-projection@1`, the editor host
or anything that PR #128 (`T1.P01.S02`, open) adds. Neither waits for #128 to merge, and neither may
build on its unmerged output. Neither slice is an exposure of the T1.P01 architecture-cycle window.
That window's state, open or not, blocks neither.

## Reconciliation decisions

| # | Decision | Why | Owner of the live statement |
| --- | --- | --- | --- |
| 1 | **Save ownership split.** `T3.P01.S02` owns the `SaveAcceptedSource@1` protocol, the server write path and its migration, the editor client and a framework-free client Save state machine. That state machine takes explicit inputs and commands and has no Svelte or host dependency. T1 owns the **Head integration**: mounting that state and its commands in the PLATE Head, unsaved-work signalling at project exit and replacement, and routing *Reload* through the host's replacement guard. The Head integration belongs to the T1 slice that owns host↔F4 wiring (`T1.P01.S04` by default). That slice's scope is fixed at its authorization: it includes the integration only if `F4.intent-acceptance@1:conditional-save-current-v1` is accepted at that time, in which case that capability joins its `Requires` and register row. Until then the Head keeps `T1.P01.S02`'s "Save unavailable" posture. | The owner's ruling. It keeps the Head single (one shell owner, PLATE §Head) without making T3 wait for the host, and it keeps the persistence protocol in one owner across the T3.P01.S04 retirement. | T3.P01.S02 plan; T1.P01.S04 plan; T2.P01.S04 plan |
| 2 | **Server admission is the shared current-source admission.** Save runs `admitCurrentSourceContent` (full validation, runtime preparation, blocking-compile comparison) with the API's existing registry Scene catalogue, which moves into one API module shared with publication. The blocking-issue baseline is the expected saved base's blocking compile issues; `create-only`, and a stored base that fails registry admission (rows from today's permissive `PUT`), have an empty baseline, so a legacy row never blocks a valid Save. A parity fixture proves editor and API refuse the same unknown-asset source. | Today `PUT` runs `validateProject` with permissive default Scene options, while publication validates against the shipped registry. A Save could therefore persist a source that the visitor and the editor refuse ("admission equals runtime preparation", 2026-10-16 decision 3). | T3.P01.S02 plan |
| 3 | **The load side is in scope.** `GET` returns the durable saved-base token and the persisted revision/digest *beside* the document. The shape is additive, so the read-only T1 boot keeps working in either merge order. Pre-migration rows receive a token from the migration. Their revision/digest stay absent, and the token alone is the precondition. | Without it, a reloaded project cannot form `expected-saved-base`, and the plan's "fresh saved-base token" has no reader. | T3.P01.S02 plan |
| 4 | **Saved and dirty compare the full captured canonical source**, not only the cursor-excluded content digest. Retry identity likewise binds the operation ID to the full canonical bytes and the precondition. | AM-4: equal digests do not prove full-source equality. A cursor-only divergence (allocate then delete) shown as "saved" would let a reload regress Layout's allocation high-water mark. | T3.P01.S02 plan; T2.P01.S04 plan |
| 5 | **Identity-scheme skew refuses explicitly (R8).** The content-identity scheme travels as transport metadata outside `SaveAcceptedSource@1`, so AM-4's exact capture shape is unchanged. Its constant lives in T3's Save subpath module, pinned by a golden-digest test to the landed export's output under T1 review; `content-identity.ts` is not edited. Refusals: scheme mismatch → `identity-scheme-mismatch`; unadmitted `sourceKind`/`sourceVersion` → `source-version-mismatch`; same-scheme digest disagreement → `content-identity-mismatch`. None is a conflict. | "Refuse on version mismatch" had nothing concrete to compare. Without a declared scheme, a canonicalization change would silently turn every Save into a false conflict or a false match. Keeping the constant out of `content-identity.ts` avoids the file PR #128 still carries a stale copy of. | T3.P01.S02 plan |
| 6 | **Create-only collision is owner-blind.** A `create-only` Save against any existing ID returns one collision refusal that reveals no owner, name or contents. `expected-saved-base` against another owner's project remains `not-found`. An unconditioned (old-client) body is refused with no write and no implicit create. | Today's `INSERT … ON CONFLICT DO NOTHING` silently creates on a new ID. On another owner's ID it answers 404 only after a write attempt. | T3.P01.S02 plan |
| 7 | **The pending sign-in draft carries its capture.** The session-storage draft is re-keyed to hold the whole `SaveAcceptedSource@1` capture: precondition, operation ID and source. Legacy entries read as `invalid`. The `/` route's reader shape stays compatible, so S02 edits no route. Resuming a draft into a live session is part of T1's Head integration. | Otherwise resuming a draft could only reach the server as an unconditioned write. Editor routes stay with PR #128's writer. | T3.P01.S02 plan |
| 8 | **Chronological Undo, not selective Undo.** The T2 exit criterion "undoing Scene never rolls back an intervening Layout result" becomes: each Undo reverts exactly the latest accepted result, whatever its domain, to the exact prior full snapshot; an L1→S1→L2 sequence undoes L2, then S1, then L1. Interleaving uses `T1.P01.S03`'s conformance Layout planner in tests only. | The landed F4 history is a snapshot stack. The old wording implied per-domain selective undo, which would be a second history semantic. A production Layout operation belongs to `T1.P01.S04`/`S05`. | T2.P01.S02 plan |
| 9 | **T2 enforces record-level Scene scope.** The landed adapter already refuses changes to Layout, `navigationNodes`, `connections`, `materials` and `textures` for every Scene change, but not *which* entities or clusters an operation touches. Every T2 planner passes one T2-owned record-scope guard, admitting only the targeted entity, its captured new entity, membership cleanup and empty-cluster removal. Its mutation control rewrites an untargeted entity or cluster, which the adapter would admit. The T1-owned adapter is not modified. | A single-entity operation that silently edits a second entity would pass admission today. | T2.P01.S02 plan |
| 10 | **Support evidence is snapshot-qualified.** Planners that need support re-derive floor candidates from the snapshot's canonical compile through the landed floor-support query. The captured support choice is qualified by the snapshot's accepted revision and content identity, and a choice the snapshot no longer yields refuses. Mapping the viewport's compile-generation identity onto it is `T2.P01.S03`'s. | The compile-generation identity is `T1.P01.S02`'s (#128). Requiring it would make S02 depend on #128. | T2.P01.S02 plan |
| 11 | **T2 S02 ships planners and conformance, not live registration.** It exports the Scene planner set and proves it against a real `createAcceptanceCoordinator` in tests. Registration in the live host belongs to the host↔F4 wiring and `T2.P01.S03`'s surface. | No host exists on `main`, and S02 must not wait for one. | T2.P01.S02 plan; T2.P01 README |
| 12 | **Parallel shared-file protocol** for this pair alongside the still-open #128. See the [pair section](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#parallel-pair-2026-10-16). | Both slices write `project-model` and test lanes while #128 still writes camera-core, layout-core, editor routes and host. | cross-track execution |
| 13 | **Each plan carries the engineering principle verbatim** (2026-10-16 decision 15). | Owner direction for implementing agents. | Both plans |

## Explicit non-implications

- **No other slice is authorized.** `T1.P01.S04`–`S06`, `T2.P01.S03`–`S04` and `T3.P01.S03`–`S04`
  stay `proposed`. The Head Save integration is assigned, not authorized; it needs its T1 slice's own
  authorization.
- **No gate changes state.** `conditional-save-current-v1` is not accepted by this record and gets
  no Accepted-capabilities entry until `T3.P01.S02` is accepted. `F4.intent-acceptance@1`'s sole
  provider stays `T1.P01.S03`, with `T3.P01.S02` as the extension slice.
- **No cycle transition, no contract change, no Requires change.** AM-1–AM-8, PLATE, landed
  `reference/*` and the gate rules are unchanged. The `T1.P01.S04` plan records the Head assignment
  but leaves that slice's `Requires` unchanged until it is authorized.

## Remaining decisions (non-blocking)

- **Which T1 slice mounts Save**, if the owner authorizes `T2.P01.S03` or a T1 slice other than
  `T1.P01.S04` first. That authorization names it; it must precede `T2.P01.S04`.
- **Conflict resolution beyond Reload.** S02 offers *Reload remote* (after offering a local JSON
  download) and no overwrite-remote path. Any other explicit resolution is a later owner call, not
  provider latitude.

## Provenance

Owner request, 2026-10-16, against post-PR #129 `main` (`1315b1a2`), with PR #128 open. The
authorization PR carries the reconciled plans, registers, batons and this record. Independent review
precedes merge, and no implementation starts before the merge.
