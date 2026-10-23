# T3.P02.S01 — First capture and Cut Preview: implementation plan

**Slice:** T3.P02.S01 · **Status:** shipped as `owner-override` at integrated revision
`1bb281bb16dc839588e4174514b240de6c52bf79`; historical batch D authorization
([record](../../../../reference/decisions/batch-d-authorization-2026-10-20.md), D3) preserved.
This plan remains live because its declared exhaustive integration route is T3.P02.S02 ·
**Phase:** [T3.P02](../README.md) · [slice register](../README.md#slice-register) ·
**Track:** [T3](../../README.md) · **Runbook:** [T3 operations](../../../../operations/t3-experience/README.md)

The historical batch D authorization and approved state are preserved as provenance. S01's
acceptance ruling and closeout status live in the [acceptance record](./acceptance.md) and
[phase register](../README.md#slice-register); T3.P02.S02 remains proposed and unauthorized.

## Finalized convergence scope (owner-accepted 2026-10-22)

The owner accepted this scope, the Experience format draft and the shell draft's Preview entry rule
in batch E ([record](../../../../reference/decisions/batch-e-authorization-2026-10-22.md), E5). The 2026-10-22 ratified clarifications are resolved against the
landed code as follows:

- **Formats.** The [Experience format draft](./experience-format-draft.md) is the slice's format:
  Experience unit format 2 with Presentation `viewIds`/`defaultViewId`, an F.1 `subject` naming a
  whole subject (component and capability null, no Room or clone invented), closed `plain` text, Stop-local `entryViewId` and a Cut/Travel
  selector on the continuation edge, plus a Presentation-entry event in the program. Under the
  pre-baseline rule the numbers bump and readers refuse older formats; nothing is migrated or
  negotiated. No part or annotation field enters. The draft's two open points are settled at
  implementation review: text is bounded at 4,000 code points and stays Presentation-only (no
  Stop-local text), and `entryViewId` alone carries a Stop's entry role because hold, continuation
  target and Cut/Travel already differ per Stop. S01 implemented this format; acceptance posture and
  the exact integration evidence route are recorded below and in the acceptance record.
- **Guide-free Preview.** Preview enters a Presentation with zero Guides and zero Stops through the
  one lowering/interpreter and exits through the same Camera return. The Guide path stays fully in
  scope.
- **Run epochs.** Each Preview entry is a fresh runtime and run epoch; stale Camera completions refuse
  by ticket. S01 exposes no same-run Reset; a need for one stops and reports.
- **Delivery.** Preview is a lazy chunk loaded on first use, inside the Preview surface boundary.
  H0's bundle report proves it is absent from the Stage first-load set.
- **Shell.** The [shell draft](./shell-draft.md) proposes homes, the Preview entry rule and the Guide
  breadth claim. It is reviewed before build and revised after browser observation; prototype chrome
  is not imported.
- **Order.** H0's `T3.P03.S01` merges first. Capture-and-bind uses the joint Camera/Experience
  planner, whose write set H0 declares.

Owner rulings at implementation review (2026-10-22) narrow this scope:

- **First Guide creation moves to `T3.P02.S02`.** S01 adds a Stop only to an existing Guide and has
  no operation that creates the first one. Scope items 3, 4 and 6 land and are proven at the
  planner, lowering and interpreter level; on the real route they become reachable with S02's
  Guide-creation operation.
- **Preview takeover.** Preview unmounts the Stage surface and runs its own isolated visitor canvas;
  the Stage's Camera output ticket is not handed over, and exit remounts the Stage with authoring
  identity, selection and history intact. The explicit Preview handover and return token of
  [phase laws 4 and 5](../README.md) are not realized in S01 and remain a phase residual that the
  final gate reads against those laws.
- **Leaving a Guide is explicit both ways.** Entering a Presentation from the visitor list during a
  Guide run suspends the Guide at the Stop the visitor left; only an explicit Resume returns there,
  and Continue never does.
- **Whole-subject Presentations only.** Part- and capability-scoped subjects wait for part admission;
  several captured Views of one subject are the S01 way to present its parts.

These complete the accepted P1 optional-Guide direction; they add no rich controls, part annotations,
vertical architecture or second Camera authority.

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t3.p02.s02-integrated-final-gate/acceptance.md
```

This plan retains the accepted implementation scope and the deferred exhaustive proof route through
`T3.P02.S02`. The integrated revision is owner-accepted as recorded in the routed acceptance
artifact; this plan does not claim the unrun integration or merge gates as completed.

## Scope

A creator, on the shared Stage, can:

1. **Create or select an Experience** when none exists — explicitly, never by implicit document
   creation on first edit. A collection-capable source holds several Experiences over one world; the
   UI may concentrate on one and must switch between two in conformance.
2. **Capture a Camera View** from the current Stage framing (eye, target, FOV and the frame's aspect)
   as a deliberate, validated Camera action. Capture is not a silent side effect of selection, and it
   discloses shared reach when the View is already referenced.
3. **Bind a Presentation** — Default role plus subject/use, and optionally a Stop in an existing
   Guide — in **one**
   accepted operation with one undo payload. Rebinding to a deliberately captured View is the narrow
   alternative to editing a shared one in place.
4. **Reuse one Presentation at distinct Stops**, and **reorder Stops by stable identity**; a repeated
   visit to one Stop starts a fresh run.
5. **Edit bounded editorial fields**: Stop and Presentation labels, Information-panel text, finite
   holds, and explicit continuation targets (including nonadjacent targets and End).
6. **Use a first coherent Cut Guide**: the Guide renders as one ordered set of Stops whose Cuts
   resolve Views without travel and without manufacturing Connections. Existing supported **Travel**
   is selectable where Camera connectivity supports it, and an unsupported transition reports a gap;
   Experience never silently falls back to a Cut or searches the Camera graph.
7. **Enter an isolated visitor Preview** over the same lowering/interpreter the visitor uses, and
   **return** to the remounted Stage with authoring identity, selection and history intact (the
   Preview takeover ruling above). Source edits stop stale playback; Preview never writes source.
8. **Undo/Redo, Save and reload** through F2/F4: one chronological source history for lenses and
   authoring, a conditional unit Save with conflict preservation, and a reload that preserves Views,
   Presentations, Stops and order.

**Interaction surface.** Mount through the accepted public T1 Stage seam: selection, task focus and
gestures stay host-owned; the slice contributes AM-5 task/Find/instrument entries and adapter-backed
commands. Exactly one Camera output ticket governs inspection, Look-through and Follow; S01's
Preview takeover is the ruled exception above. Exact numeric/keyboard routes are first-class peers of pointer routes, and every command
that can produce a candidate has a truthful refusal path.

**Explicitly out of scope:** rich interactive control authoring beyond the first Cut Guide (Gate and
choice grammar, conditional branching), advanced path/anchor authoring and Camera path editing tools,
a second Camera controller or a second navigation graph, a second Experience timeline or sequence
editor, general animation orchestration, media authoring/playback, publication or prepared readers,
and any change to Layout/Scene ownership. The accepted P1 finding and
[retained prototype evidence](../../../../../prototypes/README.md) motivate later capability
consumers; this slice does not import their implementations or shell composition.

## Sequence

1. **Experience unit surface.** Land the reviewed [format draft](./experience-format-draft.md):
   Experience create/select, Presentation and Stop identity, `viewIds`/Default and Stop-local entry,
   subject and text, Guide order as one list of stable Stop IDs, holds, continuation and its
   Cut/Travel selector. Anything beyond the reviewed draft stops and reports rather than changing a
   ratified shape unilaterally.
2. **Capture and binding.** View capture through the Camera unit + `camera-core` evaluation; one typed
   F4 intent carrying the new View/Presentation/Stop IDs, captured frame and precondition; one
   planner result; one history entry.
3. **Guide and editorial fields.** Order by stable identity, holds/continuation resolution by
   occurrence, and one order writer.
4. **Preview.** Isolated session over the shared interpreter, entered and left by Stage takeover
   (ruled above), with an explicit Resume back into a suspended Guide, no editor machinery in the lazy preview chunk, and entry for a standalone
   Presentation with no Guide or Stop as well as the full Guide path.
5. **Save/reload.** Unit conditional Save with receipts and conflict preservation; strict admission for
   pre-epoch or unknown-version sources.
6. **Surface review.** Real-route browser review in both readings, narrow viewport and reduced motion,
   including the shell-layout observation `T3.P01.S04` carried forward (the Card overlapping Compose
   buttons) where this slice's surface touches it.

## Acceptance criteria

Recorded acceptance requires the phase's
[acceptance evidence](../README.md#acceptance-evidence-to-carry) rows that this slice can prove, at
this declared **architecture-integration** tier: behavioral planner/acceptance tests for the capture,
binding and order operations; narrow call-site proof for the Stage contribution and the Preview
entry/exit wiring; F4 history and stale-writer proof; Save/conflict/reload proof with the API lane
where the Save path is exercised; the visitor isolation and public-surface boundary suites; and real
route browser journeys with recorded revision, viewport and reduced-motion state. Dense 20/50-View and
15/30-Stop fixtures prove discovery and orientation without becoming product limits.

The exhaustive integrated result — including two Experiences over one world, the full editorial
matrix, DOM reach with gap explanation and the complete repository gate — is `T3.P02.S02`'s
declared integration route, recorded in
[its acceptance](../t3.p02.s02-integrated-final-gate/acceptance.md). Focused iteration never
substitutes for that gate, and every implementation-PR merge keeps the complete repository gate,
including heavy correctness and `check:api`/`test:api` with zero skips for the Save path.
Before S01 acceptance, record capture/bind result completion, first/repeated Preview entry and
return, delivered Preview bytes and repeated enter/exit memory behavior against
[the ratified performance reference](../../../../reference/components/performance.md). Hard F10 rows
are accepted on the designated reference machine, the owner's MacBook Air M2 with 16 GB
([batch E, E6 amendment](../../../../reference/decisions/batch-e-authorization-2026-10-22.md#amendment-e6-reference-machine-named)); the lazy-chunk delivery row needs no machine. The phase final
gate rechecks the integrated result; it does not defer a hard miss.

## Shared-file ownership

Batch D's ownership rows are historical: `T1.P01.S06` has shipped and its phase is closed, and no
closed-phase permission is reused. On resumption this slice runs under the authorized
[batch E shared-file and merge rules](../../../cross-track-execution.md#batch-e-shared-files-and-merge-order).
T3 writes the Experience and Camera units, lowering, interpreter, the Preview surface and T3 authoring
adapters. Edits to the shared unit type and validation modules are confined to the Experience entries
and merge serially. The Head's Preview entry and the Preview takeover are an owned integration patch
reviewed by T1. Any other host change is a stop-and-report to T1, not an edit. A file outside these
rows is read-only.

## Readiness declaration

This slice starts only from a trusted base where every consumed gate is `accepted` and every
`Requires` scope is `active` (true on `main` `9a457f6b` after `T3.P01.S04` and still true on `f516e1ff`), in
which `T3.P03.S01` has merged, and in which
`T3.camera-experience-cutover@1` is `accepted` rather than `ratified`. The runbook start step re-checks
it. It does not wait for `T1.P01.S06`: S06 is the integrated gate for the authoring foundation that
already shipped and its evidence excludes unaccepted T3.P02 work. No gate state, capability entry,
acceptance or commit is claimed here, and this slice neither opens nor waits for an architecture-cycle
window.
