# T1.P01.S03 — Local acceptance and history foundation: implementation plan

**Slice:** T1.P01.S03 · **Status:** in-progress (owner-authorized 2026-10-16,
[record](../../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) — implementation and independent review recorded; acceptance pending
**Phase:** [T1.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)
**Track:** [T1](../../README.md) · **Runbook:**
[T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1
REQUIRES: F1.reference@1:references-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p01.s06-integrated-final-gate/implementation-plan.md
```

**Engineering principle.** Exercise ambitious independent engineering judgment: challenge
assumptions, investigate missing invariants and cross-system failure modes, pursue stronger or
simpler solutions, and resolve demonstrated defects without speculative abstractions or
unauthorized contract changes.

## Prerequisite

`F1.reference@1:references-v1` is accepted on post-PR #126 `main` (`ee463d0b` is an ancestor). The
F4 shapes are owner-ratified in
[AM-4](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1).
No F2/F3 dependency. S03 consumes nothing from S02, `T2.P01.S01` or `T3.P01.S01`, which run in
parallel under the [batch protocol](../../../cross-track-execution.md#parallel-batch-2026-10-16).

## Produces

The sole shared `F4.intent-acceptance@1` provider with **both** scopes AM-4 assigns this slice:

- `acceptance-invariants-v1` — the enduring layer: one opaque accepted revision per accepted change,
  canonical content-digest comparison, one atomic validated install with exactly one undo result,
  stale/ABA rejection and one bounded chronological history. It is never retired and is the
  prerequisite of `T3.P01.S03`'s unit capabilities.
- `local-single-domain-v1` — the current-source admission, which requires the layer above and retires
  with the current-source adapter at `T3.P01.S04`.

Acceptance records both, each with its own capability record and conformance evidence. Exact shapes
are in the [phase interfaces](../interfaces.md#f4-intentrevisionresult-and-early-local-foundation--s03-provider)
and AM-4; where they differ, AM-4 wins.

## Scope

Register Layout and Scene single-domain preparation/validation; prove one real Layout candidate and
one real validated Scene scalar candidate. This is admission infrastructure, not T2 placement UI.
Preserve co-located Camera/resource fields and run complete current-project validation. Source format
is behind the current adapter, not in public signatures. Multi-domain/resource-changing/unit requests
refuse explicitly. Use captured IDs/inputs, exact expected `AcceptedRevision` and one immutable
install/undo result. Separate content digest and host epoch. No private T1 stack.

Undo/Redo use the same boundary, fresh revisions, exact source restoration and a 100-entry cap.
No-op/refusal/cancel adds no entry; new edits truncate redo; replacement invalidates old tokens.
Selection changes only through accepted correspondence. Local acceptance never labels Save safe.

## Placement: shared contracts in the package, history in the editor

`@portfolio/project-model` has one root export, and the public route's module graph includes it; the
public-surface boundary checks that graph by path, not by tree-shaking. So:

- **Package (runtime-safe, contracts only):** the AM-4 types, the current-source admission check and
  the content-identity function. They import no editor module and are usable server-side, where
  `T3.P01.S02` recomputes the digest and reruns the same validation.
- **Editor-only:** the acceptance coordinator (registration, preparation dispatch, install, revision
  minting, epoch guard) and the 100-entry history. They live in a new editor module outside S02's host
  and route files and never enter a package barrel.

A module-graph test proves the public route reaches neither the coordinator nor the history.

## Admission

**Admission equals runtime preparation.** An accepted current-source candidate passes
`validateProject` with the host's Scene options, resolves through the runtime Scene path the visitor
cold runtime uses, and introduces no blocking canonical-compile issue absent from its baseline.
Otherwise the editor could accept a document the visitor refuses. Because S02's boot refuses sources
with blocking issues, the accepted chain normally carries none; the baseline-relative wording matters
only if a later repair mode admits one.

**Proof registrations are conformance-scoped.** S03 ships the registration seam and Layout/Scene
admission, not production operation kinds or commands. Its real Layout candidate (through a retained
`layout-core` planner) and its Scene scalar candidate are registered by the conformance suite only.
Production Layout operations belong to S04/S05 and Scene operations to `T2.P01.S02`.

**Camera bytes.** The proof Scene candidate changes entity-level fields only; the conformance compares
the canonical bytes of the Camera-bearing Scene fields before and after accept, Undo and Redo.

## Content identity

One current-source content identity, exported once from `@portfolio/project-model`: the landed
`sha256Bytes` over canonical authored bytes: the strict writer's normalized document, with
ID-keyed Layout identity maps ordered and only the persisted `identity.cursor` omitted from the
digest. The full canonical source retains that cursor for exact persistence/history restoration;
Layout already defines it as allocation bookkeeping (`LayoutIdentityLedger`). S03 owns its meaning:

- it is invariant to input key order and whitespace; if the writer's output follows input key order,
  S03 fixes the canonical form and proves permuted-key equality;
- different authored contents give different identities, and identical contents give the same one —
  so an Undo back to earlier contents restores that content identity under a fresh revision, and the
  Camera output rebase is `unchanged`;
- revision and allocation bookkeeping never enter it. A cursor-only candidate is a no-op and
  neither installs nor creates history; an authored change that also advances the cursor stores
  the full canonical source and restores that cursor exactly on Undo/Redo. Hash equality alone
  cannot prove byte-exact restoration or an identical Save retry payload.

S02 needs the same identity for boot in parallel. Whichever slice merges first lands the export with
these tests; the other reuses it. `T3.P01.S02`'s server recomputation reuses it too.

## Concurrency and lifetime invariants

The digest is asynchronous (WebCrypto). Whatever the mechanism, these hold and are tested:

- revisions are minted by the coordinator outside deterministic planning; replay compares contents,
  never revision IDs;
- installation is serialized: of two preparations against the same expected revision, exactly one
  installs and the other is rejected as stale, including when their digests resolve out of order;
- the expected revision and the session epoch are rechecked after every asynchronous step; a
  completion from a prior epoch or a superseded preparation never installs;
- an accepted revision is published exactly once, after its install is complete and its snapshot is
  immutable — later extensions capture that snapshot for Save without copying or re-validating it.

## Extension seams this slice must not foreclose

- `T3.P01.S02` adds `conditional-save-current-v1`: it captures an immutable accepted source, revision
  and digest. S03 exposes that capture; it builds no Save.
- `T3.P01.S03` adds `unit-acceptance-v1` over F2 candidates on the same coordinator, requiring
  `acceptance-invariants-v1` only. The invariants layer therefore names no `ProjectDocument` in a
  required signature.
- **Host wiring is not this slice's.** Installing accepted snapshots into the Stage, Undo/Redo
  commands, the history baseline on replacement, selection requalification and the Camera-output
  rebase belong to `T1.P01.S04` by default. S03 returns correspondence as data and is proven without
  S02's host.

## Shared files and integration

Under the [batch protocol](../../../cross-track-execution.md#parallel-batch-2026-10-16), S03 is the
sole writer of the F4 contract, admission and content-identity modules in `@portfolio/project-model`
and of the editor coordinator/history module. It edits no landed F1/F3 behavior and no host or route
file. Barrels and the test-lane list change by appending.

## Acceptance criteria

Deterministic input/replay, stale and ABA refusal, one mixed Layout/Scene stack, full-validator
rollback, unsupported compound/resource/unit requests, preserved Camera bytes, previous-epoch
cancellation and source serialization round trip. One accepted revision is published once. No direct
UI/history assignment bypasses shared validation. No cloud or compound readiness is asserted. Source
cutover later replaces all current adapters with one new-format baseline.

In addition, recorded acceptance must show:

- separate conformance evidence and capability records for `acceptance-invariants-v1` and
  `local-single-domain-v1`;
- admission refusal of a candidate the visitor cold runtime would refuse (invalid Scene resolution,
  new blocking compile issue);
- content-identity invariance, distinctness and the Undo-to-identical-contents case;
- the concurrency and lifetime invariants above, including out-of-order digest completion;
- the public route's module graph free of the coordinator and history;
- a recorded per-accept cost observation (validation, serialization and digest) on the densest
  current fixture, measured on the input the editor actually hands in.

Implementation and independent-review evidence is recorded in [acceptance.md](./acceptance.md);
formal acceptance and capability readiness remain pending.

## Readiness declaration

`F4.intent-acceptance@1` names this slice as its sole provider in the
[gate register](../../../README.md#gate-register) and stays `ratified` with empty evidence until real
code, independent review and recorded evidence exist. Neither scope is accepted by this authorization,
and no consumer may claim either from this plan.
