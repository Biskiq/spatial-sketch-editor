# T3.P01.S05 — Unit acceptance and unit Save: implementation plan

**Slice:** T3.P01.S05 · **Status:** in-progress — owner-authorized 2026-10-17
([record](../../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md)) · **Phase:** [T3.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T3](../../README.md) · **Runbook:**
[T3 operations](../../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:acceptance-invariants-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t3.p01.s04-live-ownership-cutover/implementation-plan.md
```

**Engineering principle.** Exercise independent engineering judgment: challenge assumptions,
investigate missing invariants and cross-system failure modes, pursue stronger or simpler solutions,
and resolve demonstrated defects without speculative abstractions or unauthorized contract changes.

## Prerequisite

S01 and S02 accepted, with `T1.P01.S03`'s local acceptance, at this slice's trusted base. Every
required scope is `active` at post-PR #139 `main` (`d2607caf`): `unit-envelope-v1` and
`unit-resolution-v1` were accepted at `6dcb6d6d`, `acceptance-invariants-v1` at `8ec0c5f1`.
The slice consumes no `T1.viewport-projection@1`, editor route, host or Stage module, so the T1
viewport cycle neither blocks it nor is blocked by it.

The split of `T3.P01.S03` is recorded in
[the approved split proposal](../t3.p01.s03-compound-and-runtime-preparation/split-proposal.md) and
[the follow-up authorization record](../../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md).
S03 stays the in-progress umbrella; this slice owns the original unit-acceptance, candidate, staging
and Save obligations, and `T3.P01.S06` owns the original runtime/handoff obligations.

## Scope

Complete the additive F4 extension with `F4.intent-acceptance@1:unit-acceptance-v1` and
`F4.intent-acceptance@1:conditional-save-units-v1`, over the inactive F.2 subpath. No source/runtime
activation and no live unit writer.

1. **Real candidates.** Build the domain planners that construct actual F2 candidates:
   a single-domain `camera-view-update@1` and a compound
   `experience-presentation-stop-create@1` that creates one Camera View, one Presentation and,
   when requested, one Stop inserted into a Guide — all in one candidate. IDs are captured before
   planning (`allocatedIds`), never minted by the planner. The planner reads its payload strictly
   (unknown keys refuse), validates every pre-existing reference through F.1 over the supplied
   envelope, and refuses duplicate/conflicting IDs before constructing anything.
2. **One envelope for validation.** Apply domain validation (`validateProjectEnvelope`, which owns
   per-unit and cross-unit structural validation), the F.1 dependency-lock reader and resource
   staging to the **same** candidate envelope. No caller-supplied pin or resolver set may disagree
   with that envelope: the adapter re-derives unit headers and lock identities from it. Revision
   *authority* is the coordinator's `AcceptedSnapshot.acceptedRevision`; the embedded
   `acceptedRevision` in an F.2 envelope is the baseline the candidate was prepared from, because
   the landed coordinator installs source bytes unchanged and history restoration is byte-exact.
   The Save capture stamps the accepted revision into the persisted bytes.
3. **Resource staging and locks.** Extend `stageUnitResources` into the acceptance path: the
   candidate's resource registry and dependency lock are the only inputs; a resource stages by its
   concrete revision or external-byte pin, never by a fabricated one, and a changed resource is
   re-pointed at the candidate registry's new identity and staged through the same F.1 resolver as
   every other target. A captured staging set (in the intent's `capturedInputs`) must equal that
   derivation — including pin MIME, size and locator, not just its hash — so a candidate can never
   install resource bytes or pins that the admitted envelope does not name.
4. **Atomic install and whole-operation history.** Reuse the landed `acceptance-invariants-v1`
   coordinator and its bounded chronological history: one intent produces one candidate, one
   admitted envelope, one install, one undo result. A refused planner, unresolved reference, lock
   mismatch, staging mismatch or admission failure installs nothing and writes no history. Undo/redo
   restore the whole envelope (all affected units, resources and lock) under a fresh revision.
5. **Unit Save.** Capture an accepted F2 envelope as `SaveAcceptedSource@1` (`sourceKind`
   `unit-envelope`, `sourceVersion` 1, canonical envelope bytes, envelope source-content digest) and
   exercise the landed conditional Save protocol over it: server-side re-validation of the envelope,
   dependency lock and unit content revisions, saved-base token comparison and idempotent receipts
   under a row lock, with **real PostgreSQL conformance at zero skips**. The live HTTP Save route
   remains current-source-only: the unit admission is injected at the service boundary and no route,
   client or host wires it until `T3.P01.S04`.
6. **Isolation.** Nothing here is imported by the editor or visitor application source. The F.2 and
   F.4 extension modules stay behind their explicit subpaths; the architecture gate's inactivity
   proof and closure are updated only where the split genuinely adds an exported entry (the new
   unit-acceptance and save-capture modules stay inside the already-inactive `./units` closure).

## Explicit non-goals

- No source cutover, migration inventory, API activation, Head Save integration or live unit writer;
  `conditional-save-current-v1` remains the only live Save route.
- No Experience runtime, lowering, interpreter, controller or Camera handoff (`T3.P01.S06`'s scope).
- No new F contract, no new persisted format and no AM-2/AM-4 amendment. The F.2 envelope and F.4
  shapes are used exactly as accepted; the extension adds admission and persistence behavior.
- No second history, installer, validator or content-identity implementation. The landed coordinator,
  `validateProjectEnvelope`, `computeEnvelopeSourceContentId` and `save-persistence` are reused.

## Criteria and evidence

| Original S03 obligation | This slice's evidence |
| --- | --- |
| Actual Camera View + Presentation + optional Stop candidates | Planner conformance: single-domain View update; compound View+Presentation+Stop in one candidate; optional Stop omitted changes nothing else; unknown keys/IDs refuse. |
| Complete domain/reference/resource identity and lock validation | Adapter conformance: invalid unit version, unresolved reference, a stale or dangling dependency lock and a malformed pin all refuse before install; validation reads only the candidate envelope. A declared unit header that disagrees with its bytes is **re-derived**, never trusted, and the installed envelope carries the recomputed revision (a revision is a derived fact); Save separately refuses a captured byte string whose declared headers disagree with its data. |
| Locks and the complete F2 envelope | Lock verification over the same envelope: a changed resource's content revision/pin and the unit bytes install in one operation, the entry's existing `requiredCapabilities` are preserved, unrelated entries stay byte-identical, and external pins keep hash/MIME/size/locator. This slice derives no new capability requirements. |
| Staged admitted resources and resource rollback | Staging derivation from the candidate's registry through the F.1 resolver equals the captured staging (revision-only, pin-only and both-identity resources); a staging mismatch, unresolved resource or fake pin refuses; failed operation leaves the previous envelope, lock and staging untouched. |
| Single/compound acceptance, atomic installation, whole-operation history | One accepted result and one undo payload for the compound operation; a failure after partial candidate construction installs nothing and adds no history; undo/redo restore every affected unit/resource/lock with a fresh revision and truncate redo. |
| `unit-acceptance-v1` | Exported admission module behind `./units`/`./f4/unit-acceptance`, with no live consumer; capability record written only when independent acceptance passes. |
| `conditional-save-units-v1` over F2 with real-DB conformance at zero skips | Save conformance on real Postgres: two Saves with one base → exactly one wins; missing precondition refuses; identical retry replays the receipt; changed payload under the same operation ID refuses; re-validation failure and transaction failure after staging but before the pointer update leave the prior version and saved base intact; unit content revisions and lock cannot diverge from the saved bytes. |
| Current-source Save stays the only live route until S04 | Call-site proof: an API source scan proves no route/client module references the unit handler or the F.2 subpath, `app.ts` imports only `saveAcceptedSource`, its handler list is the current source, and the existing current-source route behavior and suite are unchanged. |

Tests protect behavior, not implementation structure: they assert refused installs leave accepted
state and history untouched, that undo restores the whole operation, and that Save compares the
durable base under the lock rather than trusting the client's digest.

## Verification

Tier: **architecture-integration** (the plan's declared tier; integration route is
`T3.P01.S04`). Run on the tested commit and record exact results in [acceptance.md](./acceptance.md):

- `npm run check:project-model`, `npm run check:api` and `npm run check` (editor) as affected;
- the focused conformance files (`f4-unit-acceptance`, `units-conformance`,
  `unit-resolution-conformance`, `f4-acceptance`, `save-protocol`, `save-call-sites`) and the
  affected whole contracts they belong to;
- `npm run test:arch` whole (unconditional; includes the F.2 inactivity and execution-structure
  gates);
- `npm run test` (editor full lane) after the focused ladder is green;
- `npm run test:api` with a reachable `DATABASE_URL` and **zero skips**, including the new unit Save
  contract. If the database is unreachable the slice is not accepted; a skip is not evidence.

## Residuals and handoff obligations

- The unit admission and unit Save remain **inactive** at acceptance. `T3.P01.S04` owns enabling
  them, migrating callers, the live inventory, quiescence/recovery and the publication disposition.
- The captured staging set is **host-asserted**: it proves the host staged the identity the candidate
  names and that the payload, registry and lock agree, not that uploaded bytes match that hash.
  Byte-level verification of uploaded resource content is `T3.P01.S04`/storage work; this slice adds
  no byte store and no second content-addressing path.
- The envelope's embedded `acceptedRevision` is the baseline revision, not the installed one. A future
  consumer must read revision authority from the accepted snapshot (or the Save capture's stamped
  bytes), never from the source's embedded field; `T3.P01.S04` should state that explicitly when it
  activates the envelope.
- The capability records for `unit-acceptance-v1` and `conditional-save-units-v1` are written at
  acceptance and must name F.2 plus the enduring `acceptance-invariants-v1` as prerequisites — never
  the retiring `local-single-domain-v1` or `conditional-save-current-v1`.
- `T3.P01.S06` consumes none of this slice's output; the two slices share only the phase register and
  the F2 unit shapes, which are already accepted.
