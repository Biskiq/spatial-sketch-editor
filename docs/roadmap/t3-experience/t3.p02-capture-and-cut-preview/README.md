# T3.P02 — First capture and Cut Preview: phase proposal

**Status:** candidate next phase, proposed 2026-10-16 — **not registered**. No phase, slice, gate
version or authorization exists for it; this page holds the scope the
[2026-10-16 decision](../../../reference/decisions/parallel-slice-authorization-2026-10-16.md) moved
out of the proposed T3.P01 so that T3.P01 could be registered truthfully. Routes: [T3](../README.md) ·
[T3.P01](../t3.p01-camera-experience-foundation/README.md) ·
[runbook](../../../operations/t3-experience/README.md) ·
[gate register](../../README.md#gate-register).

## Why a separate phase

Both candidate slices consume `T3.camera-experience-cutover@1` and declare the
`camera-authoring-migration` effect, which requires that gate and `T1.viewport-projection@1` accepted.
The cutover gate is still `undrafted` with no version, so a registered row could name neither an
honest `Consumes` nor a registered version. The phase registers once the gate is drafted and
owner-ratified at version 1 (its provider is `T3.P01.S04`), and its slices become eligible only once
that gate and the viewport are accepted at their trusted base. Capture/Cut Preview stays the first T3
authoring milestone: it does not wait for T3.P01's phase closure, advanced path/anchor authoring,
rich transport/scrub UI, media or broad behavior editing.

## Outcome

After the Camera/Experience source cutover, a creator captures a View and binds a Presentation plus
optional Guide Stop in one acceptance; reuses a Presentation in distinct Stops; reorders by stable
identity; sets finite holds/continuation; and runs a **Cut-based isolated Preview** with labels/text
Info Panel, semantic navigation and reduced motion. Collection-capable source supports two
Experiences over one world; the first UI may concentrate on one but switches between two in
conformance.

## Candidate slices

| Candidate | Consumes, accepted at trusted base | Effect | Scope and exit |
| --- | --- | --- | --- |
| T3.P02.S01 — First capture and Cut Preview | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1 | camera-authoring-migration | See below. `architecture-integration`, integration route to S02. |
| T3.P02.S02 — Integrated final gate | as S01 | — | Exhaustive final gate. |

Both would require `unit-resolution-v1`, `unit-envelope-v1`, `camera-handoff-v1`, `unit-acceptance-v1`,
`conditional-save-units-v1` and `viewport-projection-v1`.

**S01.** Mount the public Stage adapter: explicitly create/select an Experience when none exists, then
capture Camera View, bind Presentation/Default and optional Stop in one operation; repeat/reorder
stable Stops, edit labels/text/holds/continuation, switch two Experiences and Undo/Redo. A first
**Cut Guide** and isolated Preview must work without new Travel path/anchor authoring or rich
scrub/transport. Existing supported Travel can be selected with clear gap diagnostics through the
same Camera/runtime primitives. Advanced Camera/path tools are a later T3 phase, not hidden work
inside this first useful surface.

Use the shared Camera output tickets for inspection/Look-through/Follow/Preview ownership and return;
use the shared gesture host with explicit operation transition policy and one selection. Expose exact
rendered capture aspect. View Update discloses shared reach; rebinding to a deliberately captured View
is a narrow alternative. Source edits stop stale playback. Preview hides authoring infrastructure,
executes the same shared lowering/interpreter as T4 and exits through the Camera return token,
preserving authoring identity/context. It never writes source or requires T4 activation.

**S02.** Record independent acceptance of first capture/Cut Preview on the integrated tree, with a
starter/composed subject, repeat Presentation with distinct Stop/run identity, holds/Continue,
supported existing Travel/gap, two Experiences, source Undo/Save/reload and Preview return. Advanced
path editing is not an acceptance prerequisite. Passing makes the phase closable; closure remains an
owner event.

## Acceptance evidence to carry

Beyond T3.P01's [verification probes](../t3.p01-camera-experience-foundation/README.md#verification-and-acceptance-criteria),
which stay green:

| Probe | Observable evidence required |
| --- | --- |
| Real authoring | Selection alone never navigates. Capture/Update/Exit, Ask Rule reach, shared Default versus Stop-local entry/hold, one Guide context, supported existing Travel/gap, paused edit lifecycle and one-step source Undo work on T1's host. Preview removes authoring chrome; exit preserves authoring identity and returns through Camera. Dense 20/50-View and 15/30-Stop fixtures test discovery/orientation, not product limits. |

## Registration preconditions

`T3.camera-experience-cutover@1` drafted and owner-ratified; an owner registration of this phase with
slice plans and acceptance records; authorization per slice. Nothing on this page is claimable work.
