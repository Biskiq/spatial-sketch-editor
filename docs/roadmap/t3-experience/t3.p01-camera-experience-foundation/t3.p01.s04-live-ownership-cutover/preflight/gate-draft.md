# `T3.camera-experience-cutover@1` — DRAFT for owner ratification

**Status:** drafted, **not ratified, not registered, not authorized**. Drafting this text changes no
register row, authorizes no work and creates no version. Only the owner's ratification act can move
the gate to `ratified`.

**Drafting slice:** T3.P01.S04 (intended sole provider) · **Owning track:** T3 ·
**Kind:** capability (a declared cutover, not a foundation interface) ·
**Phase:** [T3.P01](../../README.md) · **Plan:** [implementation-plan.md](../implementation-plan.md)

## 1. Identifier and purpose

`T3.camera-experience-cutover@1` is the one declared cutover in which Camera and Experience become
separate authored authorities, the Scene stops carrying editorial traversal, and every live reader,
writer and consumer moves to the F2 unit format in a single atomic transition.

It exists so that:

- Camera owns Views, framing, projection, connectivity, routes, intrinsic motion and evaluation;
- Experience owns Presentations, Stop identity, Guide order, holds, continuation and Gates;
- editorial node order/hold/detour/lock fields no longer live in Scene or Camera structural types;
- the current-source F4/Stage/Save/starter adapters retire together with their callers, and no
  normal reader accepts two formats;
- T3 authoring (T3.P02) and T4 public delivery consume one accepted transition instead of inventing a
  second interpreter or a legacy identity map.

This gate does **not** deliver Camera authoring UI, Preview UX, publication UX or prepared delivery.
Those remain T3.P02 and T4.

## 2. Provider

Exactly one provider: **`T3.P01.S04`**. No other slice may provide, extend or partially satisfy this
gate at version 1.

## 3. Consumers

| Consumer | Consumption | Eligibility |
| --- | --- | --- |
| T3.P02 (candidate, unregistered) | Authoring surface over Camera/Experience units and the shared execution program | Requires this gate `accepted` and `T1.viewport-projection@1:viewport-projection-v1` |
| `T4.prepared-reader@1` (T4.P01.S05, deferred by R1-D) | Prepared publication/API/resource/browser activation over the migrated source | Requires this gate `accepted`; T4 remains deferred until Core Editor Stability is accepted |

No consumer may self-satisfy the gate. Neither consumer is authorized by this draft.

## 4. Preconditions

At the provider's trusted base, all must be accepted and active:

- `F1.reference@1:unit-resolution-v1`
- `F2.unit-envelope@1:unit-envelope-v1`
- `F3.channels@1:camera-handoff-v1`
- `F4.intent-acceptance@1:unit-acceptance-v1`
- `F4.intent-acceptance@1:conditional-save-units-v1`
- the enduring `F4.intent-acceptance@1:acceptance-invariants-v1`, plus each scope's declared
  prerequisite closure.

And the slice-level authorization path must be closed: measured AM-7 inventory, reviewed
migration/refusal coverage, rehearsed quiescence/recovery, an owner-approved publication disposition,
and the owner's own S04 authorization record. The gate can be ratified before those are complete; it
cannot be **implemented** or `accepted` before they are.

## 5. What the version promises

1. **One source epoch.** Activation installs one source revision/lock, one Camera unit, one
   Experience unit, one Scene unit and one history baseline atomically. No intermediate
   Camera-only, order-only or partially-converted state is observable.
2. **Current-format-only normal admission.** Normal readers/writers accept only the new format.
   Old clients fail with an explicit version/revision-required diagnostic. The read-only converter is
   an administrative entry, never a sniffer or transparent fallback.
3. **Retirement.** Live node order/hold/detour/lock fields, `walkFlowChain`/`resolveFlowRoute`/
   `getFlowRoute`/`getFlowLoopConnectionId` exports and their callers, node-keyed visitor
   orchestration, and the current-source F4/Stage/Save/starter adapters are gone. `camera-core`
   spatial route resolution and motion sampling remain.
4. **Caller migration.** Every existing T1/T2 caller and every unfinished consumer requirement is
   migrated to the new F2/unit scopes in the same version; no consumer keeps a retired
   current-source admission.
5. **Occurrence semantics.** Stop identity is stable and distinct from Presentation/View; repeated
   visits start a fresh run; Guide order is one ordered Stop-ID list with no reciprocal next/previous
   cache; explicit continuation overrides the default successor.
6. **One Camera output owner.** Free/guided/Cut/rejoin/reduced-motion/Follow hand off through one
   declared controller; a stale completion cannot reclaim a newer owner.
7. **Recovery.** Failed planning/staging/CAS leaves prior state untouched. Backup and coordinated
   rollback are rehearsed; after a new-format edit, recovery rolls forward or restores a disclosed
   backup.
8. **Publication honesty.** During any owner-approved gap, cold public reads return an explicit
   unavailable/not-found outcome, status/Unpublish stay truthful, new Publish/Update returns
   `prepared-reader-required`, and `/p/` plus isolation remain real.

## 6. Verification obligations

The gate is not `accepted` until evidence exists for:

| Obligation | Evidence |
| --- | --- |
| Codec/migration | Every matrix row has a convert or refuse fixture; determinism, immutability and no-partial-install assertions |
| Atomic acceptance/undo | One compound install, one undo payload, fresh revisions, no-op adds nothing, stale/ABA refusal |
| Cloud contention | Two conditional Saves with one base: exactly one wins; receipts replay; changed-payload retry refuses; real Postgres, zero skips |
| Motion/continuation | Forward/reverse timing, envelopes, interior Y, Cut changes no topology, Travel gap never silently cuts |
| Session/handoff | Two sessions with independent clocks; stale arrival cannot advance a newer run |
| Accessibility | DOM/keyboard/pointer/touch parity; reduced motion reaches the same destination |
| Architecture | One evaluation authority, one order writer, no legacy flow callers, editor machinery absent from public chunks |
| Integrated tree | Full merge gate, root check/build, relevant package checks, full editor lanes and `check:api`/`test:api` on a reachable DB with zero skips; recorded revision |

## 7. Failure and rollback semantics

- A failed conversion refuses at the project level with a typed code and path; other projects may
  still convert, but the epoch is not considered installed until the approved inventory is discharged
  or explicitly dispositioned.
- A failure between planning and CAS leaves accepted source, lock, history and publications unchanged.
- A failure immediately after activation is recovered by restoring the pre-cutover database and
  object-store backup plus the recorded deployment digest, under the fence.
- There is no reverse serializer, dual write, writable feature flag or indefinite migration reader.
- The converter retires when the covered inventory is completed/discharged and recovery is verified,
  before the Source Baseline.

## 8. Register row (proposal, not applied)

Current row:

```text
| T3.camera-experience-cutover | — | capability | T3 | — | undrafted | — | — | — | — | — | — |
```

On **owner ratification only**, the row becomes:

```text
| T3.camera-experience-cutover | 1 | capability | T3 | — | ratified | T3.P01.S04 | — | — | — | — | — |
```

The `Contract anchor` cell stays `—` in this draft: the validator resolves that column as a
link target, and the AM-9 section does not exist yet. The owner's ratification act fills it with
the link to the exact heading `AM-9 Shared Camera and Experience cutover` (slug
`am-9-shared-camera-and-experience-cutover`) in the composition-execution reference, and only
then is the row pasteable.

`ratified` keeps evidence columns empty per the register legend. `T3.P01.S04` fills the **Provider
slice** column directly: the phase is registered, so this is a normal row, not a provisional
assignment to be repaired later by amendment text. On `implemented`, exports and conformance paths
appear; on `accepted`, an acceptance record and an ancestor commit.

### Drift: there is no `drafted-for-ratification` state

The task brief asked for a register transition `undrafted → drafted-for-ratification`. The enforced
vocabulary is `undrafted | ratified | implemented | accepted | superseded`
([gate register](../../../../README.md#gate-register)), validated by
`apps/editor/tests/docs/parallel-track-gates.test.ts`. Adding a state would change the checker and the
lifecycle contract, which this preflight must not do. Therefore:

- **drafting changes no row** — it stays `undrafted`, version `—`;
- this file's existence and the amendment draft are the drafting evidence;
- the single legal transition is `undrafted → ratified` at the owner's ratification act.

## 9. Amendment proposal

The register requires a resolvable contract anchor. The cutover has no ratified contract section yet,
so one of the following must be chosen by the owner (see [owner-decisions.md](./owner-decisions.md)):

### Proposed text — new `AM-9` in `docs/reference/composition-execution.md`

> **AM-9 Shared Camera and Experience cutover.** After activation, Camera owns View identity, framing,
> projection, connectivity, route geometry and intrinsic directed motion/evaluation; Experience owns
> Presentation/Stop identity, Guide order, holds, continuation, Gates and invocation time mapping.
> Scene and Camera structural types carry no editorial order, hold, detour or lock fields; exactly one
> Experience order writer and one Camera output owner exist per source/session. Normal readers and
> writers admit only the F2 unit format; the current-source admissions retire together with their
> callers, and the sole read-only converter retires when the covered inventory is discharged and
> recovery is verified. Undo never crosses the format boundary. A temporary publication gap is
> permitted only with a recorded owner disposition after the AM-7 inventory; public and owner routes
> must report honest unavailability, and prepared delivery remains T4's.

Heading text: `### AM-9 Shared Camera and Experience cutover` in
`docs/reference/composition-execution.md`. Its slug is `am-9-shared-camera-and-experience-cutover`
(lowercase, spaces to hyphens, no slash or em dash), so the register cell — written relative to
`docs/roadmap/README.md` — is
`../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover`. The owner must add
the section with exactly that heading text; changing the heading changes the anchor.

### Alternative — a dedicated contract page

A new page in the reference directory (proposed, not written yet) carrying the same text, heading
`## T3 Camera and Experience cutover`, with register anchor `t3-camera-and-experience-cutover`. Lower
blast radius on a ratified document, but splits the F-contract neighbourhood and needs its own index
entry.

Either choice is a contract decision: it must be owner-ratified before the register row can name the
anchor. This draft does not edit `composition-execution.md`.

## 10. Ratification checklist

- [ ] Owner approves the amendment anchor (§9) and its text.
- [ ] Owner ratifies version 1 and records the ratification act with a date.
- [ ] Register row moves `undrafted → ratified` with version `1` and the resolving anchor.
- [ ] Provider stays `T3.P01.S04`, sole.
- [ ] Consumers re-declare the gate only in their own authorization records.
- [ ] No capability, acceptance or implementation state is claimed by this draft.
