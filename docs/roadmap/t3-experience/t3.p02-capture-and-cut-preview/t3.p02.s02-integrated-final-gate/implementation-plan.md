# T3.P02.S02 — First Guide, Camera return and integrated final gate

**Slice:** T3.P02.S02 · **Status:** approved — owner-authorized and released 2026-10-23. S01 is shipped;
the [owner release](../../../../reference/decisions/post-batch-e-authorization-2026-10-23.md) permits implementation
per the release list (`docs/roadmap/now.md`) once trusted-base gates are rechecked through the runbook start step.
**Phase:** [T3.P02](../README.md) · **Runbook:**
[T3 operations](../../../../operations/t3-experience/README.md) · **Coordination:**
[next parallel batch](../../../cross-track-execution.md#next-parallel-batch)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

This is the phase's declared **FINAL PHASE GATE** and S01's exhaustive integration route.
The plan describes future work and claims no implementation, evidence or acceptance. It creates
no gate/version and does not close a phase, track or architecture cycle.

## Trusted base and readiness

Start from integrated `main` containing Batch E, including PR #178 and the Round 2 shell
ratification (PR #181); recheck all consumed gates and active scopes at that trusted base.
S01's `owner-override` acceptance satisfies its predecessor condition. Its outstanding manual,
lens-wiring and performance rows remain unverified and are explicit work below. The later S01
integrated repository gate includes DB-backed API verification with zero skips; do not relabel
that historical gate as this slice's result.

S02 can run alongside T1's next Layout work and T2 import/placement: the existing starter and
Scene subjects suffice. It consumes neither native Wall creation nor own-model import, and has
no T4 dependency. One writer per shared file, T1 review of the named host patch, and a complete
gate on then-current `main` govern merging. Project rename/delete belongs to separate
[T3.P04](../../t3.p04-project-lifecycle/README.md), after S02 by T3 capacity.

## Bounded changes

### First Guide creation

Add a typed, deterministic F4 Experience operation reachable from Capture and the invoked Guide
context. From a selected Presentation, or an existing Stop's Presentation, it creates the first
Guide and its initial distinct Stop with captured stable IDs. Capture may request the same
creation in its compound Camera/Experience acceptance: View + Presentation + Guide + Stop are
one accepted install and one undo payload, not consecutive partially installed writes.

The request records expected AcceptedRevision, qualified targets, allocated Guide/Stop IDs,
label, initial entry Stop and supported Cut continuation. Experience owns the Guide, ordered
Stop IDs, entry roles, holds and continuation. Camera alone owns the captured View and any
existing Travel support. Reusing an existing Presentation creates a fresh Stop identity and
never copies Camera pose/FOV or manufactures a Connection. Creating the first Guide sets the
Experience entry Guide explicitly; it never makes Guide membership mandatory for other
Presentations. Preserve Guide-free capture and Preview.

Validate missing/stale subjects, duplicate IDs, invalid holds/continuation and invalid Guide
membership before install. Refusal/cancellation/no-op adds no history or source write. Redo
replays captured IDs; Undo restores the prior entry Guide and every affected unit atomically.
Keep the existing versioned formats unless their current admitted shapes cannot express this
operation; a format gap is a stop-and-report, not permission for an incidental migration.

### Real Camera handover and return

Resolve the phase residual that S01's owner-accepted scope recorded as its Preview takeover
([S01 plan](../t3.p02.s01-first-capture-and-cut-preview/implementation-plan.md#finalized-convergence-scope-owner-accepted-2026-10-22));
S02 supersedes that takeover. Stage unmount/remount alone does not
satisfy phase laws 4 and 5. Wire Preview entry and exit through the existing F3 Camera-output
acquire/replace/return/cancel protocol and its qualified tickets/return token. Preserve the
Stage inspection context across the isolated visitor session and restore it only on a valid
return. The Preview session still owns no editor source, selection or history and evaluates
through the shared Experience lowering/interpreter and Camera authority.

Use the existing `CameraSession` and Stage facade/adapter contracts rather than reaching into
private Stage state. The T1-reviewed host patch coordinates the existing output identity,
session epoch, source revision, run epoch and return token with the Preview lifecycle. Extend
only that bounded integration if existing public methods are insufficient; stop and report any
need for a new host authority or general shell API. A host extension requires T1 review before
implementation and must preserve the accepted viewport facade contract.

Acceptance probes must demonstrate successful return, cancelled/failed entry, repeated entry,
exit after source/project replacement, and an older completion/cancel arriving after a newer
owner has claimed output. A stale ticket must neither restore a pose nor cancel/clear a newer
owner. A returned authoring context retains identity, selection and chronological history.
Camera evaluation supplies all pose/FOV output; no UI interpolation or parallel navigation
model is introduced. Unmounting an isolated canvas remains a rendering decision, never the
ownership protocol. This plan does not waive or rewrite phase laws.

### Bounded Round 2 expression

Apply [PLATE Experience expression](../../../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression)
and the [Round 2 ratification](../../../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md)
to these consuming surfaces. Reach Capture and Guide through the shared lower dock; invoke one
contextual Guide Instrument for Stop composition/playback; keep ordinary editable facts in the
Card as their one writer. Use current host task/Find/instrument contributions, canonical
selection, refusal wording and Svelte 5/Threlte patterns. Record the bounded shell decisions in
this slice's implementation review and browser evidence.

This is the Capture/Guide contribution and its explicit T1-reviewed host patch, not a new
global shell. Do not implement unrelated World tools, the complete scope Index/Find redesign,
advanced Path or Place-a-View authoring, per-aspect framing, or move all landed Dimensions
fields. Any missing host seam is a stop-and-report to T1. Do not reuse superseded Conservatory
chrome or promote prototype Camera/controller shortcuts.

## Ownership and file surfaces

| Surface | Writer / review | Bounded work |
| --- | --- | --- |
| `apps/editor/src/lib/authoring/experience/{commands.ts,ExperienceSurface.svelte,preview-entry.ts,focus.svelte.ts}` and `authoring/adapters/experience.adapter.ts` | T3 | First Guide intent/UI, real-route reach, Guide context and Preview lifecycle |
| `packages/project-model/src/units/{planning.ts,experience/}`, the Experience intent registrations in the existing unit acceptance path | T3; F2/F4 owner review | Deterministic planning, atomic declared write set, existing lowering/interpreter semantics; no general F4 rewrite |
| `packages/project-model/src/channels/camera-output.ts`, `packages/camera-core/src/`, `apps/editor/src/lib/authoring/stage/camera-session.ts` | Existing Camera/host owners; T1 review of host integration | Consume existing ticket/evaluation contracts; any proven defect gets a bounded owned fix and its conformance evidence |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`, `authoring/stage/stage-adapter-host.ts`, `authoring/stage/shell/` | T1-owned, explicit T3 integration patch reviewed by T1 | Capture/Guide homes and Preview handover/return wiring only; serialize with T1 and with T2's host patch per the [shared-file table](../../../cross-track-execution.md#shared-files-and-merge-protocol) |
| `apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte` and shared visitor runtime | T3 | Isolated entry/return, semantic Guide/list/Resume behavior; no authoring imports |
| `apps/editor/tests/lib/experience/`, Camera-output/Stage contract tests, Preview/visitor boundary tests | T3 with owning-domain review | Behavioral regressions and unchanged unconditional boundaries |
| `apps/editor/perf/` consumer flow specs and gated marks | T3; measurement-owner review for shared harness changes | F10, repeated Preview lifecycle F13, lazy chunk proof; do not weaken bundle assertions |

T2 Scene/resource/import code and T1 Layout/compiler code are read-only. The API protocol is
consumed unchanged; if Save integration exposes an API defect, report the ownership/scope need
before changing it. Shared unit registries/barrels are additive and merged serially.

## Integrated acceptance matrix

Run on one recorded integrated revision with named fixtures, viewport, input mode and
reduced-motion state. Browser evidence includes visible outcomes and source/history checks,
not only planner tests.

| Journey / invariant | Required result |
| --- | --- |
| Empty Experience → Capture → Guide-free Presentation → Preview → return | One atomic captured/bound result, no fabricated Guide/Stop, real Camera ticket return; authoring identity/selection/history preserved |
| First Guide from capture; first Guide from existing Presentation or Stop | Reachable on the real route, stable allocated identities, explicit entry Guide, correct one-step Undo/Redo and Save/reload |
| One Presentation reused at two distinct Stops | Different holds/entry roles remain occurrence-local; reorder preserves Stop identity and one authoritative Guide order |
| Cut Guide and supported existing Travel | Cut never creates topology; Camera evaluates supported Travel; missing reach is explained, never silently converted into travel or a cut |
| Presentation detour during a Guide; repeated Stop visit | Guide suspends at the left Stop; explicit Resume returns; Continue does not; repeated visit starts a fresh run |
| Two Experiences over one world | Switching preserves Experience identity and explains shared-Camera reach without copying world or Camera truth |
| Capture/Update/Exit; Ask Rule; paused editing; lens wiring | Current route reaches each operation; selection alone does not navigate; Default versus Stop-local fields edit the intended owner; post-fix lens wiring verified |
| History, conditional Save/conflict, download/reload remote | One source history across domains, invalid/stale/no-op produce no entry; conflict keeps local work, reload preserves Views/Presentations/Stops/order |
| Ownership races and teardown | Failed entry, cancellation, source/project replacement and stale completions cannot reclaim newer Camera output; Preview writes no source |
| Dense discovery/orientation | 20/50-View and 15/30-Stop fixtures remain usable; these are fixtures, not product limits |
| Accessibility/isolation | Keyboard/pointer/touch share Activate meaning; narrow/coarse-pointer and reduced-motion journeys; DOM reach/explanations and Info without raycast; no editor machinery in visitor/public/Preview chunks |

Advanced path/anchor editing, interaction grammar, media, part annotation, project lifecycle
and publication are excluded. Repair a defect inside these admitted flows or report outside
scope; do not enlarge the feature set to make the final gate pass.

## Verification and performance evidence

**VERIFICATION: exhaustive.** Follow the [test manual](../../../../../apps/editor/tests/README.md#what-a-change-requires):
complete editor suite, architecture lane, heavy kernel correctness, root `check`/`build`, all
affected shared-package checks, `check:api` and a fresh DB-backed `test:api` with zero skips for
the exercised Save path. Record DB target and cleanup. Run meaningful focused behavioral
contracts during iteration; rerun the complete merge gate on then-current `main`. Independent
review and this slice's own acceptance/closeout remain required. Use
[browser hygiene](../../../../../.agents/skills/browser-hygiene/SKILL.md) for browser runs.

Before acceptance record capture/bind and Guide-free/Guide Preview entry (F10 hard S/M), lazy
Preview delivery and Stage initial-load delta, applicable Save/history observations, and F13
repeated Preview enter/exit in one application lifetime with renderer/resource cleanup.
Instrument through the installed on-demand workflow, consume its corrected bundle provenance
checks, and name source/output identities, cold/warm/repeat-use modes and unrun rows. F13 must
not infer cleanup from full-document reloads that destroy the realm.

The [performance contract](../../../../reference/components/performance.md) and batch E E6
reference rules govern hard evidence: owner-operated MacBook Air M2/16 GB, declared power and
run conditions, reference calibration for other-machine CPU equivalence. Record hard misses
and resolve them in scope; target misses require a written disposition. Do not relabel H0's
historical timings or tooling pass as S02's benchmark. H0's open trace-method decision remains
open unless separately ratified; use valid reproducible evidence and state method limitations.

S01 and H0 were accepted as `owner-override`; their waivers apply to those named revisions only.
They do not waive this slice's independent review, handover laws, manual journeys, F10/F13 or
reference evidence. If required evidence cannot be obtained, record the gap and seek an explicit
owner disposition rather than claiming acceptance. Passing makes P02 **closable**, not closed;
its [acceptance record](./acceptance.md) owns the result.
