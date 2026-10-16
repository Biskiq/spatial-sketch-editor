# T3.P01.S01 — Shared unit and program codecs: implementation plan

**Slice:** T3.P01.S01 · **Status:** approved (owner-authorized 2026-10-16,
[record](../../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) — not started ·
**Phase:** [T3.P01](../README.md) · [slice register](../README.md#slice-register) · **Track:**
[T3](../../README.md) · **Runbook:** [T3 operations](../../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F3.channels@1
REQUIRES: F1.reference@1:references-v1, F3.channels@1:inspection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t3.p01.s04-live-ownership-cutover/implementation-plan.md
```

The integration route is the phase's exhaustive final gate, where these codecs first become live; a
narrowed tier never stands in for it, and every merge still runs the complete repository gate.

**Engineering principle.** Exercise ambitious independent engineering judgment: challenge
assumptions, investigate missing invariants and cross-system failure modes, pursue stronger or
simpler solutions, and resolve demonstrated defects without speculative abstractions or
unauthorized contract changes.

## Prerequisite

`F1.reference@1:references-v1` and `F3.channels@1:inspection-v1` are accepted on post-PR #126
`main` (`ee463d0b` is an ancestor). No F4, viewport or Save dependency. This slice consumes nothing
from `T1.P01.S02`, `T1.P01.S03` or `T2.P01.S01`, which run in parallel under the
[batch protocol](../../../cross-track-execution.md#parallel-batch-2026-10-16).

## Produces

- The sole `F2.unit-envelope@1` provider with `unit-envelope-v1`
  ([AM-2](../../../../reference/composition-execution.md#am-2-f2-unit-envelope-v1)): envelope format 1,
  `UnitHeader`, `DomainUnit`, `DependencyLock`, `UnresolvedBinding`, and the unit codecs — Layout
  payload 5 (wrapping the strict current document), Camera-free Scene 2, Camera 1, Experience 1 and
  typed resources 1.
- The additive F1 extension `F1.reference@1:unit-resolution-v1`: a `DependencyLockReader` over the
  F2 lock, `project-lock` resolution and Experience/resource subjects over unit sources.
- The runtime-safe `ExecutionProgram@1` codec
  ([AM-6](../../../../reference/composition-execution.md#am-6-execution-program-and-visitor-profile-v1)).
- The sole current-source converter
  ([AM-7](../../../../reference/composition-execution.md#am-7-source-migration-v1)) as a pure,
  inactive candidate/report operation.

Acceptance records two capability records — `unit-envelope-v1` on the F2 row and `unit-resolution-v1`
on the F1 row — plus the F2 gate evidence. This slice provides no F4 scope and no behavioral T3 gate.

## Reconciliation decisions

- **Inactive and off the root barrel.** None of the new codecs, the converter or the program codec is
  exported from `@portfolio/project-model`'s root barrel or used by a normal reader/writer, the API,
  the visitor runtime or the editor host before `T3.P01.S04`. They are reached through explicit
  package subpath exports. The public route's module graph contains none of them, proven by test.
- **Standalone program closure.** The `ExecutionProgram@1` entry imports delivery validation only: no
  source codec, Layout compiler, root barrel, Camera evaluator or Three. A module-graph test over that
  entry's closure proves it. `T4.P01.S02` imports this entry for F5 program slots.
- **Scene 1 untouched.** The Scene v1 codec, its validation and current readers keep their exact
  behavior. Scene 2 is a new codec; shared pure validators may be reused only where v1 behavior is
  provably unchanged.
- **`unit-resolution-v1` is additive.** The `references-v1` conformance suite stays unchanged and
  green; the current-domain resolver still returns `incompatible` for `project-lock`. Unit resolution
  is a separate adapter over F2 sources; no landed F1/F3 behavior is edited.
- **No Camera-core change.** `T1.P01.S02` is `@portfolio/camera-core`'s sole writer in this batch.
  The Camera 1 codec owns structure (IDs, references, finite values) and may call existing pure
  validators read-only; evaluation stays in camera-core.
- **Content identities.** A unit's `contentRevision` is `sha256Bytes` over that codec's canonical
  bytes, domain data only; the envelope's source-content digest excludes `acceptedRevision` and
  session/history/receipt metadata. Canonical forms are key-order and whitespace invariant, proven by
  test. The same hash primitive serves the current-source identity owned by `T1.P01.S03`; this slice
  defines no competing current-source identity.
- **Converter as pure preparation.** Inputs are the strict post-#115 pair, captured IDs, typed policy
  decisions (cycle entry, `lockInteraction` mapping, View-key hold mapping and the other matrix
  choices), staged pins and the captured migration baseline (project ID, source-content identity,
  stored version). Output is every unit candidate plus the mapping report, or a typed refusal such as
  requires-policy-mapping, per the [conversion matrix](../README.md#conversion-and-refusal-matrix).
  No IO, clock or randomness; replay is exact. S01 decides no policy and is wired to no route;
  `T3.P01.S04` activates it. It lives behind its own migration-only entry and retires with it.
- **Closed minimum formats.** Experience 1 and `ExecutionProgram@1` carry exactly the AM-2/AM-6
  minimum, with no speculative optional fields. Both freeze before the interpreter (`T3.P01.S03`) and
  the first authoring surface exist, so hand-authored non-empty fixtures cover every AM-6 conformance
  case at the codec level now; a demonstrated need to change a required meaning later is a versioned F
  amendment, never an in-place edit.
- **No evaluator.** Lowering and the one interpreter are `T3.P01.S03`'s; S01 ships no reference
  evaluator that could become a second interpreter.
- **Typed resources.** Admit only the existing project texture/asset family with verified pins; never
  fabricate a pin, and an empty registry is valid only when nothing requires a resource.

## Shared files and integration

Under the [batch protocol](../../../cross-track-execution.md#parallel-batch-2026-10-16), S01 is the
sole writer of the new unit, program and converter modules in `@portfolio/project-model`, of that
package's `exports` additions and of the additive reference-extension module. It edits no landed
reference or channel behavior, no Scene v1 codec, no camera-core or layout-core module, no F4 module
(`T1.P01.S03`'s) and no host or route file. Barrels, package `exports` and the test-lane list change
by appending only.

A suggested internal order, not binding: envelope/header/lock and unit codecs, then unit resolution,
then the program entry, then the converter. S01 is the largest T3 piece; if it proves too large, the
implementer proposes a registered split (for example, the converter as its own slice before S04) to
the owner and never moves a criterion away silently.

## Exit criteria

Prove empty/two-Experience and non-empty program round trips, required-kind/version refusal,
references/lock diagnostics and genuine resource pins. Implement the sole current-source converter as
a pure candidate/report operation using captured IDs/policy decisions. New codecs/conversion are not
active in normal readers/writers. No Camera-only live split. S01 enables T4 F5 schema work before
runtime activation; it does not provide F4 or accept the behavioral T3 gate.

In addition, recorded acceptance must show:

- strict refusal of unknown keys, non-finite values, header/payload version mismatch and
  duplicate/conflicting pins;
- codec-level fixtures for every AM-6 conformance case, and the standalone program closure;
- one converter fixture per conversion-matrix row, with the source unchanged on preparation or
  refusal, identities, data and pins preserved, and identical replay;
- `unit-resolution-v1` conformance with the `references-v1` suite unchanged;
- canonical-form invariance for every unit and the envelope digest;
- the public route's module graph and the current readers/writers unchanged;
- the two capability records with their exports, conformance and acceptance paths.

These criteria are not met, reviewed or evidenced; evidence belongs in [acceptance.md](./acceptance.md).

## Readiness declaration

`F2.unit-envelope@1` names this slice as its sole provider in the
[gate register](../../../README.md#gate-register) and stays `ratified` with empty evidence until real
code, independent review and recorded evidence exist. Neither scope is accepted by this authorization,
and no consumer may claim either from this plan.
