# F — foundation contracts

**Status:** registered 2026-09-27 by the ratified decision record; **F.1–F.5
written and owner-ratified 2026-09-27 with amendments** (Camera cutover timing,
interface ownership, required/optional extensions) in the target contract
[`../../reference/composition-execution.md`](../../reference/composition-execution.md);
**no implementation is authorized.**

**Goal:** settle the bounded cross-domain contract shapes for the ratified
direction **before P24/P25/P26 or later capabilities are re-planned**. F is
contract-writing against the destination — not another architecture research
cycle, and not a requirement to implement the complete composition kernel.
Independent operational work (the P23B baton — that phase CLOSED 2026-09-29, so nothing runs
beside F now) continues by owner decision;
consumers must share these formats from their first new persisted or
cross-domain implementation.

**Authority:** [`../../reference/decisions/northstar-ratification-2026-09-27.md`](../../reference/decisions/northstar-ratification-2026-09-27.md)
§6 and §10; destination statements live in
[`../../reference/north-star.md`](../../reference/north-star.md) and
[`../../reference/architecture.md`](../../reference/architecture.md).

## The five contracts

| Contract | Required shape | Extension points it must declare |
| --- | --- | --- |
| **F.1 Identity and reference** | Domain-qualified semantic identity, stable instance-ID paths and revision context; names, indices and mutable hierarchy paths never establish identity. Include Layout levels, structures and instanced definitions, Experience/occurrence identity, local/library resources, and generation-qualified fragments with source correspondence. Public addresses select a publication or pinned release plus a durable semantic location. | Reference kinds (and their validation/conformance rules). |
| **F.2 Storage units and envelope** | One explicit codec-bounded, versioned unit per semantic domain inside a project envelope holding the accepted revision and dependency lock. The Experience unit supports a collection. Camera is settled as its own codec-bounded unit; the split lands in the same cutover as the Experience order cutover. | Domain admission contract for new units (authority, validation, evaluator, release lowering, fixtures). |
| **F.3 Channels and representation parameters** | `instance → component → capability/property → frame` addresses with types, units, scope and domain-owned operators. Cut, depth, peel, lift, reveal and related inspection parameters are channel-addressable semantic values; Layout evaluates architectural representation and Camera evaluates viewing intent. | Channel families and operators (declared semantics, validation, conflict rules). |
| **F.4 Compound acceptance** | One expected project revision; typed, serializable authoring intents; validation across affected domains and resource locks; one atomic accepted result and one undo result. First implemented with the Experience cutover (capture a Camera View, bind it to a Presentation and optionally create a Stop in one acceptance). | Intent kinds and their domain planners; stale-revision rejection for local and cloud writers. |
| **F.5 Release envelope** | Versioned manifest, closed dependencies, required-capability profiles, selected Experience identities/entry points, semantic public addresses, and program slots for occurrences, typed session declarations and declarative logic. The reader never depends on the authoring validator. | Program node kinds, session-state types, profile capabilities. |

Extensions require declared semantics, validation and conformance; unsupported
required capabilities fail explicitly. Additive capability growth should use
these points rather than invent parallel formats. They do not guarantee formats
never change: incompatible semantics require deliberate versioning.

The normative written form is
[`../../reference/composition-execution.md`](../../reference/composition-execution.md);
this table remains the phase registration summary.

## Contract decisions — resolved by the ratified contract

- Camera's codec boundary: **its own codec-bounded unit**, split in the same
  cutover as the Experience order cutover — one `navigationNodes` migration
  (F.2).
- Extension/version negotiation, including required/optional declarations, and
  minimum supported program/state coverage: declared in
  [`../../reference/composition-execution.md`](../../reference/composition-execution.md)
  §Extension points.
- Typed session-declaration scope, initial values, reset behavior and permitted
  writers; syntax, UI and the initial operator set stay planning choices.

Exact interfaces (reference and resolution result, unit header, project
envelope, authoring intent with expected revision, release manifest) are
drafted by their first consumer, then ratified as explicit amendments to the
contract and implemented in shared code; no track mints its own. Byte encodings
and containers stay deferred.

## Explicitly open — not decided by this registration

Concrete encodings/containers, kernel substrate/implementation, storage of
audience records, level mechanism and Layout structure expansion vs isolation,
slab/ceiling ownership, channel operators, correspondence algorithms,
invalidation/cache design, compilation placement, and history implementation
(snapshot/op-log/CRDT). These are mechanism decisions resolved inside the
ratified shapes by F and focused capability planning, never by inventing a
parallel format.

**Do not write schemas, child slices, or implementation plans from this
registration.** The contract is owner-ratified with the amendments above;
implementation and child planning stay separately authorized, and exact
interfaces land only through F amendments in shared code. Capability
re-planning re-derives against it; no implementation is authorized.
