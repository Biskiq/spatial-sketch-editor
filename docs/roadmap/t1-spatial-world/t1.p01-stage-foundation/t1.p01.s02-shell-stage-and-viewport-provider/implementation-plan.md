# T1.P01.S02 — Shell, Stage and viewport provider: implementation plan

**Slice:** T1.P01.S02 · **Status:** approved (owner-authorized 2026-10-16,
[record](../../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) — not started ·
**Phase:** [T1.P01](../README.md) · [slice register](../README.md#slice-register) · **Track:**
[T1](../../README.md) · **Runbook:** [T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F3.channels@1
REQUIRES: F1.reference@1:references-v1, F3.channels@1:inspection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p01.s06-integrated-final-gate/implementation-plan.md
```

**Engineering principle.** Exercise ambitious independent engineering judgment: challenge
assumptions, investigate missing invariants and cross-system failure modes, pursue stronger or
simpler solutions, and resolve demonstrated defects without speculative abstractions or
unauthorized contract changes.

## Prerequisite

`F1.reference@1:references-v1` and `F3.channels@1:inspection-v1` are accepted on post-PR #126
`main`, where the accepted implementation `ee463d0b` is an ancestor; a branch cut from that base
satisfies the trusted-base rule. S02 consumes nothing from S03, `T2.P01.S01` or `T3.P01.S01`, which
run in parallel under the [batch protocol](../../../cross-track-execution.md#parallel-batch-2026-10-16).

## Produces

`T1.viewport-projection@1` with capability `viewport-projection-v1`
([AM-5](../../../../reference/composition-execution.md#am-5-shared-stage-and-starter-gallery-v1)),
with the [exact seam](../interfaces.md#viewport-projection-v1). This is the cycle opener. Re-arm
M5 at actual project/session replacement wiring. S02 also owns the compile-generation identity that
representation fragments carry and that the T2 floor-support query is called with.

## Scope

Replace the spatial notice with a real route host: current-format cloud read, explicit
current-format source-JSON open, validated starter-gallery/empty boot, loading/error/refusal, single
replacement epoch and teardown. No legacy recognizer. Starter template boot compiles a real floor and
has no live Wall-creation command; it does not re-arm M4. Replacement validates first, then
atomically cancels writers, clears old selection/task/return context and swaps project/session; stale
load and Camera completions cannot affect the replacement. No project-specific singleton survives it.

Build the minimal PLATE Head, Index, Stage, contextual Card and one instrument host needed by
consumer conformance. Defer broad Search/Browse depth and nonessential shell polish to S04; keep
selection, focus, keyboard/narrow posture and the required semantic host here. At rest there is no
empty Card/instrument. Add minimal selection and subject Search/Browse; keep Select, Open location
and Bring into view separate. Experience has a real empty/unavailable lens posture until T3 mounts
its adapter; Preview/Save explain unavailable capability. Do not invent Presentations, Guides, Views
or a mock editable Experience.

Use one persistent Threlte Canvas/Stage across readings and lenses. Select the shadow-map type
explicitly at the new Canvas, as the landed r186 upgrade does (`PCFShadowMap`); no boolean `shadows`
that would resolve to the removed PCFSoft filtering path. Render canonical Layout and existing Scene
through runtime-safe adapters. Add Layout-owned ordinary Plan evaluation from compiled solids/queries:
cut/projected/hidden/symbol streams, source correspondence, finite depth and reasoned membership. This
is ordinary horizontal Plan only, not Section or Unroll. Add Camera-owned pan/orbit/zoom, explicit
Fit/Bring into view and Plan↔3D evaluation. Plan is exactly orthographic; transitions use the
authority's evaluated projective projection, not a near-orthographic FOV hack, shell tween or second
Plan affine transform.

## Reconciliation with the landed F1/F3 providers

The phase interface draft predates S01's acceptance. Where it differs from what landed, **the landed
`references-v1`/`inspection-v1` surface wins**; changing it is an F amendment, not provider latitude.

- **Plan family.** Implement the landed `layout.plan@1` family in
  [`families.ts`](../../../../../packages/project-model/src/channels/families.ts): `cut-height`
  (relative to the level datum), required `depth` (> 0), optional `lateral-span` (> 0),
  `source-kind-filter` and union `reveal`. The contract's "lateral span/crop" is that one
  `lateral-span` property; there is no separate crop property, so the membership stage reports
  `included`, `outside-depth`, `outside-span`, `filtered-type` or `no-meaningful-projection`. An
  absent `lateral-span` means explicit unbounded lateral coverage. Its geometric meaning (for
  example the half-width around the inspection target) and the default values are provider
  calibration, documented with the evaluator and proven by fixtures, never copied into authored Layout.
- **Correspondence.** Every selectable fragment carries the landed `DerivedSourceRef`
  (`source`, `generationId`, `stream`, `subRef`). Sub-references use only the landed `component` and
  `interval` kinds: a Wall side, if a fragment needs one, is a Layout-declared `componentId`; an
  Opening span is an `interval`. A new sub-reference kind is an F1 extension, not part of this slice.
  `@portfolio/layout-core` sits below `@portfolio/project-model` (which depends on it) and cannot
  import F1 types: the Layout representation speaks Layout-native source IDs plus the caller's
  generation, and qualification into `DerivedSourceRef` happens at the project-model or host
  boundary. No F1 type is copied into `layout-core`, and no dependency cycle is introduced.
- **Read adapters and frames.** The current-domain read adapters bind to the source object they were
  built from, so the host rebuilds them for every accepted source, never mutates one in place. Owner
  frames resolve `missing` in the landed resolvers; S02 evaluates in project-world plus the level
  datum and invents no owner frame.
- **Camera output.** The viewport acquires its inspection output through the landed ticket protocol
  in [`camera-output.ts`](../../../../../packages/project-model/src/channels/camera-output.ts).
  `rebaseCameraOutputSource` ends the live claim when content identity changes and returns
  `unchanged` for identical content. After a content change the host re-acquires inspection at the
  current pose, without moving or refitting the view; an in-flight transition settles to a
  deterministic endpoint; a replacement starts a fresh output state for its epoch. S02 ships before
  any editing command exists, so it proves this path by installing a content-changed source through
  the single accepted-source slot in a test.
- **Stage snapshot.** S02 composes its read snapshot over the landed `CurrentDomainSource` and
  `SnapshotIdentity`, using the AM-4 `AcceptedSnapshot@1` field names (accepted revision,
  source-content identity, source kind/version, domain read access) so that `T1.P01.S04` swaps in
  S03's export without renaming consumers. S02 defines no F4 type, intent or acceptance result and
  imports nothing from S03.
- **Content identity.** The boot snapshot's source-content identity is the single project-model
  export described in [S03](../t1.p01.s03-local-acceptance-and-history-foundation/implementation-plan.md#content-identity):
  [`sha256Bytes`](../../../../../packages/project-model/src/package-sha.ts) over the strict writer's
  canonical bytes, invariant to input key order and whitespace. Whichever of S02/S03 merges first
  lands the export with its invariance tests; the other reuses it.

## Boot, persistence and admission

- **Read-only cloud boot.** The host performs only the project GET. It never calls `saveProject` or
  the pending-cloud-save helpers in
  [`project-persistence.ts`](../../../../../apps/editor/src/lib/platform/project-persistence.ts) — the
  current API `PUT` has no expected revision, and conditional Save is `T3.P01.S02`'s. A call-site test
  proves the editor host reaches no write path.
- **Explicit states.** New, missing, forbidden, network/server error and refused (invalid or
  non-current format) are distinct, tested states. A project ID minted by `/editor` and absent on the
  server opens the starter gallery/empty boot; an unknown ID reached any other way is `missing`, never
  silently treated as new. The mechanism is the implementer's.
- **Admission equals runtime preparation.** A source is shown only when it passes `validateProject`
  with the host's Scene options and resolves through the runtime Scene path, as the visitor cold
  runtime does. A source whose canonical compile has blocking issues opens an explicit diagnostics
  state naming them; it never renders a silent empty or partial Stage.
- **Starter gallery.** Templates are static canonical current-format documents; a test validates and
  compiles each with no blocking issue.

## Shared files and integration

Under the [batch protocol](../../../cross-track-execution.md#parallel-batch-2026-10-16), S02 is the
sole writer of `@portfolio/camera-core` and of the editor host and route modules. In
`@portfolio/layout-core` it adds the Plan representation as new modules only and changes neither the
compiler nor its tolerances. Barrels and the test-lane list change by appending. No module this
slice adds to a package barrel may reach editor machinery: the public-route boundary checks the
module graph by path. At its own closeout S02 updates
[`architecture.md`](../../../../reference/architecture.md) §Product routes for the replaced notice;
this plan does not pre-edit that landed contract.

A seam-first internal order lowers risk without binding the implementer: projection/inverse and
Camera output first, then the Layout Plan representation, then the host, boot states and shell, then
the consumer probes. S02 is the largest slice of the batch and the critical path for every viewport
consumer. If it proves too large, the implementer stops and proposes a registered split to the owner;
it never moves an acceptance criterion into a later slice silently.

## Acceptance criteria

Shared projection drives meshes, overlays, pointer rays and working-plane inverses; top-down axes are
to scale; flip preserves target and target-plane scale, settles azimuth at the nearest 90° and returns
to last working elevation without refitting. Card, instrument and sheets do not resize/reframe Stage;
resize updates projection aspect without an implicit fit. Empty, free-standing/curved/shared Walls and
hosted Openings render truthfully. Editor/visitor Wall positions, surfaces and Junction attribution
agree for identical compile inputs. Hidden/ineligible targets cannot intercept input. T2/T3-style
consumer probes consume the seam through the public editor interface and no private Stage state
(details in interfaces). Keyboard/focus, reduced-motion endpoints, replacement teardown and public
isolation pass.

In addition, recorded acceptance must show:

- Plan evaluation over the landed family, with fixtures for every property, the absence of
  `lateral-span`, each membership reason and Reveal; every fragment carries a landed
  `DerivedSourceRef`;
- the post-edit Camera-output path: a content-changing install re-acquires inspection without
  moving the view, identical content leaves the claim in place, and prior-epoch completions cannot
  install;
- every boot state above, the blocking-compile diagnostics state and the no-write call-site proof;
- content-identity invariance to key order and whitespace, wherever the export lands;
- the public route's module graph free of every module this slice adds outside the runtime-safe
  packages.

Record seam acceptance independently of the phase final gate, then make it available at a
subsequent consumer's trusted base. No consumer may claim readiness from this plan alone.

## Readiness declaration

`T1.viewport-projection@1` names this slice as its sole provider in the
[gate register](../../../README.md#gate-register) and stays `ratified` until real code, independent
review and recorded evidence exist; this authorization implements nothing. Because this slice is a
listed exposure of the phase's bounded window, its first authorized implementation opens that window
through the runbook's start step (see
[Bounded architecture-cycle window](../README.md#bounded-architecture-cycle-window)); it may not start
without that hook. The criteria above are not met, reviewed or evidenced; evidence belongs in
[acceptance.md](./acceptance.md).
