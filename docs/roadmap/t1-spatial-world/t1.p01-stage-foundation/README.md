# T1.P01 — Stage and authoring foundation: phase proposal

**Status:** proposed for owner review, 2026-10-14. Candidate identifiers below are reserved by
this proposal only; no phase or gate is registered, no slice is authorized or accepted, and
the architecture-cycle window remains selected and unopened. Planning route:
[T1](../README.md) · [roadmap](../../README.md) · [T1 runbook](../../../operations/t1-spatial-world/README.md).

**Recommendation:** build a shared World | Experience shell and one continuous Stage, accept
`T1.viewport-projection@1` early, then restore a small, useful Layout editing surface over
current-format projects. Keep new Wall drawing and the Layout schema cutover in the next
phase. The first implementation slice should be **T1.P01.S01**, after the owner ratifies its
exact F.1/F.3 interfaces and authorizes the phase. The exact provider/consumer proposal and
F amendments are in [interfaces.md](./interfaces.md); that document is a draft, not authority.

## Outcome and deliberate boundary

A creator can open a valid project or begin empty, place a native Layout plinth on its floor
datum, inspect its architecture and Scene content in Plan and 3D, select consistently from
Stage/Index/Search, and precisely change an existing
Wall's height/thickness, an existing Opening's supported dimensions/offset, or an existing
straight Wall's length/angle/position. They can see refusals, cancel proposals, Undo/Redo
accepted edits, and download the accepted current-format source JSON. T2/T3 can integrate
their own subject graphics, tools and instruments against the accepted viewport interface
before these Layout editing slices finish.

This is a foundation for authoring existing architecture, one small native architectural
placement, and T2/T3 authoring, **not a complete blank-project-to-publication loop**. An empty
project can receive a plinth, but this phase cannot construct its first enclosing Wall. Drawing it
correctly needs the derived-Wall-role cutover, not a temporary role chooser. This boundary
avoids coupling the shared shell to levels, circular Walls, overhead schemas or T3's unit
migration. Owner review must explicitly accept this restricted architectural entry boundary.

Cloud **reads** use the current validated project API. Cloud Save remains unavailable with an
explicit reason until T3 supplies expected-revision Save; do not revive today's stale-writer
Save behind an apparently safe button. Source download uses the current canonical project
serializer and preserves asset references; it is source JSON, not a portable asset package or
a publication. No resource upload/ingest is introduced here.

## Basis and retained-code findings

The [T1 planning evidence](../planning-evidence.md) supplies obligations, not a mandated P26
sequence. [Architecture](../../../reference/architecture.md#semantic-authorities-ratified-destination),
[F](../../../reference/composition-execution.md), [PLATE](../../../reference/design-system/editor-shell-and-visual-system.md)
and the [spatial instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md)
govern the new design. [Conservatory](../../../../prototypes/experience-ux-alternative/README.md)
supplies shared-shell evidence; [World A–F](../../../../prototypes/spatial-authoring/README.md)
supplies continuity/interaction evidence; [Paper](../../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md)
supplies authoring depth. None supplies a production renderer, schema, camera evaluator or
history implementation. In particular, the prototype's sub-degree perspective Plan and
whole-world refitting buttons are not selected mechanisms.

| Evidence inspected | Planning consequence |
| --- | --- |
| `packages/layout-core/src/layout-geometry.ts`, `layout-geometry-types.ts`, `layout-wall-first-precision.ts`, `layout-wall-openings.ts` | Reuse `compileWallFirstLayoutGeometry`, compiled query/solid records and operation-specific planners; do not recreate topology in a view or impose one universal planner result type. Current scalar and straight-Wall precision already have a bounded implementation basis. |
| `apps/editor/src/lib/layout/wall-mesh-builder.ts`, `apps/editor/src/lib/render/wall-geometry-adapter.ts`, `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte` | The Stage must use the same Junction-aware mesh builders and adapter semantics as the visitor. Share runtime-safe rendering where useful; editor-only hit/highlight layers remain outside visitor imports. |
| `packages/camera-core/src/camera-motion.ts`, `camera-route.ts`, `index.ts` | Current evaluation covers perspective guided motion; it does not export the proposed editor projection API. Add session viewing/projection evaluation inside this authority, rather than claiming the removed viewport already exists. |
| [Retained authoring inventory](../../../../apps/editor/src/lib/authoring/README.md), `authoring/layout/plan-hit.ts`, `layout-exact-input.ts`, `authoring/a11y/roving-focus.ts` | Reuse pure hit/precision/focus semantics selectively. The Plan hit resolver takes world points and tolerance; it cannot become another affine viewport. Blank numeric parsing and fixed traversal need new composed-surface proof. |
| `packages/project-model/src/project-codec.ts`, `apps/editor/src/lib/platform/project-persistence.ts`, the spatial route | Current boot/validation/serialization and API reads exist; the route is a notice and Save lacks expected revision. Rebuild the host, with explicit replacement guards; do not restore the old shell wholesale. |
| `packages/layout-core/src/layout-room-frame.ts`, current Scene/Room types | The retained frame helper consumes legacy Room frames; current wall-first Rooms carry no frame and Scene roots are world-local. Preserve explicit room-local conversion semantics when a real frame is supplied, without inventing Room ownership or reintroducing legacy decoding. |

**Reference reconciliation finding, not an amendment:**
[persistence](../../../reference/components/persistence.md#one-document-format-post-115) says
Junction reuse is global at commit. `layout-wall-chain.ts` and
`apps/editor/tests/lib/layout/layout-junction-identity.test.ts` instead document and exercise
declared-connection reuse, with independent coincident placement; the precision gates are
component-scoped. Under the router's falsifiability triage this appears to be a later retained
policy plus stale descriptive text, but its provenance/contract reconciliation is owed before
new connectivity authoring. The North Star's [sacred contracts](../../../reference/north-star.md#sacred-contracts)
explicitly preserve the accepted independent-placement policy, supporting the stale-reference
diagnosis. Preserve that explicit-connectivity invariant; do not restore global coordinate
adoption from the older persistence wording.
This phase preserves existing Junction IDs and has no Wall birth, join, split or noding
command, so it does not require a new connection policy. M4 is not claimed re-armed.

## Ownership and composition

| Concern | Writable owner and permitted integration |
| --- | --- |
| Architecture/representation | Layout in `@portfolio/layout-core`: canonical compilation, representation fragments/membership, source correspondence, supported semantic planners. Renderer adapters consume its results. |
| Viewing and navigation | `@portfolio/camera-core`: one output controller per viewport, viewing intent, framing, projection, transitions and evaluation. The Stage realizes output; shell/input controllers submit intent. |
| Shell/Stage/session | T1 editor host: Svelte 5 runes, shared PLATE tokens/type/control roles, Head/Index/Card/instrument composition, one selection, focus, task/gesture ownership and lifecycle. Threlte owns realization/lifetime, not domain math. |
| Accepted project/history | Shared project coordination under F.4; proposed narrow local provider in S03 requires the owner scope/timing amendment below. T3 retains the compound acceptance, cloud revision precondition and Camera/Experience cutover. No T1-specific history format. |
| Scene graphics/placement | T2: canonical Scene identity, bounds, support-resolved placement, transforms/materials/lights and validation. T1 provides projection and input hosting, not a Scene mutation adapter. |
| Camera/Experience authoring | T3: Views, paths and editorial authoring adapters, Experience UI and Preview. T1's session Camera inspection changes no authored node, edge, order, hold, FOV key or unit. |

Prefer existing packages for shared runtime-safe interfaces: project-model for identity and
coordination contracts, Layout for representation parameters/evaluation, Camera for projection.
Do not add a package without real import/lifetime evidence. Editor mounting contracts remain
editor-only; they must not pull selection/history/runes/DOM into these shared packages.

**State laws:** accepted documents and compiled geometry are immutable snapshots held via
`$state.raw` or equivalent shallow ownership, never recursively proxied. One canonical
selection value is shared by both lenses; task focus, host and reference emphasis are separate.
Selection does not navigate. Source history is one chronological stack; reading, Camera
navigation, Scale/Grid/Snap, focus and disclosure never enter it. A gesture captures one
expected revision and one writer; invalid/cancel/no-op produces no entry. A reading flip keeps
selection, accepted edits, task and tool; a lens crossing cancels unaccepted writers and parks
tasks inactive. Explicit Resume revalidates without restoring old selection or viewpoint.

World-local roots remain the current document contract. An explicit room-local input frame
uses its origin/yaw and floor datum for forward/inverse conversion once at the domain boundary;
vectors exclude translation, angles remain radians internally, and round trips preserve values.
No polygon centroid, nearest Room, or containment is allowed to invent that frame. Missing
room-local context refuses the operation. This phase's precision uses project-world and
Wall-host frames; no Scene `roomId`, authored Room frame or transform migration is added.

## Slice register

All rows are **proposed**, with no authorization or acceptance. `@1` below denotes the
recommended first major version, contingent on ratification and global registration; these
are not currently registered or ready gates. Same-phase sequencing never bypasses the
trusted-base rule: each consumed gate must be accepted at the consumer's trusted base.

| Slice | Status | Consumes | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- |
| T1.P01.S01 | proposed | — | — | [Shared reference/representation interfaces](#s01-shared-interface-providers) | — | — |
| T1.P01.S02 | proposed | F1.reference@1, F3.channels@1 | — | [Shell, Stage and viewport provider](#s02-shell-stage-and-viewport-provider) | — | — |
| T1.P01.S03 | proposed | F1.reference@1, F3.channels@1 | — | [Local acceptance/history foundation](#s03-local-acceptance-and-history-foundation) | — | — |
| T1.P01.S04 | proposed | F1.reference@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1 | — | [Existing Layout precision](#s04-existing-layout-precision) | — | — |
| T1.P01.S05 | proposed | F1.reference@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1 | — | [Existing straight-Wall manipulation](#s05-existing-straight-wall-manipulation) | — | — |
| T1.P01.S06 | proposed | F1.reference@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1 | — | [Integrated final gate](#s06-integrated-final-gate) | — | — |

FINAL PHASE GATE: T1.P01.S06 → [proposed final-gate plan](#s06-integrated-final-gate).
Acceptance evidence is absent. PHASE CLOSE is not requested or recorded.

### S01 Shared interface providers

**Prerequisite:** owner approval, exact F.1/F.3 amendments and registered ratified gate rows.
**Produces:** `F1.reference@1`, `F3.channels@1` shared exports, strict validators and conformance
fixtures, as defined in [the F drafts](./interfaces.md#f-amendment-drafts). It consumes neither
of its own outputs; their implementation is one coherent provider. No live shell or document
cutover belongs here.

Implement domain-qualified identity/revision/frame/channel addressing, typed resolution,
generation-qualified correspondence and the narrow representation value family. F.3's gate
means this exact address/value/negotiation interface, not a complete execution kernel. Camera
and Layout attach their own evaluators later. Accept only after supported/unsupported kind,
revision, units and required-extension fixtures pass and visitor-safe import closure is proven.
Independent T2/T3 contract/data work can then reuse the same interfaces.

### S02 Shell, Stage and viewport provider

**Prerequisite:** S01's gates accepted at trusted base.
**Produces:** `T1.viewport-projection@1`, with the [exact seam](./interfaces.md#viewport-projection-v1).
This is the expected cycle opener. Re-arm M5 at actual project/session replacement wiring.

Replace the spatial notice with a real route host: current-format cloud read, explicit
current-format source-JSON open, valid empty boot, loading/error/refusal, single replacement
epoch and teardown. No legacy recognizer. Replacement validates first, then atomically cancels
writers, clears old selection/task/return context and swaps project/session; stale load and
Camera completions cannot affect the replacement. No project-specific singleton survives it.

Build PLATE Head, collapsible relation-aware Index, dominant Stage, contextual overlay Card,
one invoked instrument slot and responsive sheets using shared visual roles. At rest there
is no empty Card/instrument. Add minimal selection and subject Search/Browse; keep Select,
Open location and Bring into view separate. Experience has a real empty/unavailable lens
posture until T3 mounts its adapter; Preview/Save explain unavailable capability. Do not
invent Presentations, Guides, Views or a mock editable Experience.

Use one persistent Threlte Canvas/Stage across readings and lenses. Render canonical Layout
and existing Scene through runtime-safe adapters. Add Layout-owned ordinary Plan evaluation
from compiled solids/queries: cut/projected/hidden/symbol streams, source correspondence,
finite depth and reasoned membership. This is ordinary horizontal Plan only, not Section or
Unroll. Add Camera-owned pan/orbit/zoom, explicit Fit/Bring into view and Plan↔3D evaluation.
Plan is exactly orthographic; transitions use the authority's evaluated projective projection,
not a near-orthographic FOV hack, shell tween or second Plan affine transform.

**Acceptance:** shared projection drives meshes, overlays, pointer rays and working-plane
inverses; top-down axes are to scale; flip preserves target and target-plane scale, settles
azimuth at the nearest 90° and returns to last working elevation without refitting. Card,
instrument and sheets do not resize/reframe Stage; resize updates projection aspect without
an implicit fit. Empty, free-standing/curved/shared Walls and hosted Openings render truthfully.
Editor/visitor Wall positions, surfaces and Junction attribution agree for identical compile
inputs. Hidden/ineligible targets cannot intercept input. T2/T3-style consumer probes consume
the seam through the public editor interface and no private Stage state (details in interfaces).
Keyboard/focus, reduced-motion endpoints, replacement teardown and public isolation pass.
Record seam acceptance independently of the phase final gate, then make it available at a
subsequent consumer's trusted base. No consumer may claim readiness from this plan alone.

### S03 Local acceptance and history foundation

**Prerequisite:** F1/F3 accepted; explicit owner F.4 scope/timing amendment and ratified interface.
**Produces:** shared `F4.intent-acceptance@1` interface/coordination provider plus one editor
history host. This proposal asks the owner to delegate the narrow local provider to T1;
without that ruling, assign it to T3 and make S03 its integration consumer instead. It cannot
be implemented under the unamended F.4 first-implementation wording.

Implement typed expected-revision intents, deterministic prepare/validate/accept results,
one coherent accepted snapshot, no-op/refusal/stale preservation, and bounded chronological
undo/redo using shared project coordination. The initial adapter admits **one Layout domain**
over current ProjectDocument, with the existing Scene/Camera bytes unchanged and no resource
mutation/staging. A new undo/redo acceptance receives a fresh revision; it never resurrects an
old writable token. Project replacement invalidates tokens/history. The editor history may
store snapshots but cannot become a second mutation/acceptance authority.

**Acceptance:** equivalent baseline+intent+captured inputs gives equivalent result; stale
commands fail before installation; failure/no-op leaves project, selection and history
unchanged; acceptance publishes one snapshot and history result. Undo/redo restore exact source
and validate derived state, a new edit truncates redo, and depth is bounded (recommend 100
entries). Asynchronous prior-epoch callbacks cannot commit. No shell control writes source
directly. Multi-domain dispatch reports unsupported until T3 installs compound behavior;
this gate never claims the T3 cutover, cloud stale-write protection or a complete F.2 envelope.

### S04 Existing Layout precision

**Prerequisite:** S02/S03 providers accepted at trusted base. **Produces:** useful scalar
authoring and source download; re-arms M1 and M2. No schema change.

Card name, where the current kind supports one, is its sole writable fact, delegated through
canonical metadata planning; unnamed kinds retain read-only identity. Settled
measure facts open one Dimensions instrument. Expose Wall height/thickness and existing
Opening offset/width/height/sill using retained precision/Opening planners; show measured values
and floor/host datum. Do not expose independent arch rise, Wall roles, profile conversion or
Floor storey height. Preserve current curves and Opening host identity. Other measures remain
read-only with a clear unavailable operation. Capability Find contains supported operations,
not subjects; keep fixed semantic order and rail family homes, with unavailable families
explicit rather than inert controls pretending to work.

Admit one **Place → Layout plinth** item using the retained `layoutArchitecturalPreset`,
`layoutPresetPlacement` and `planCommitLayoutObjectPreset` semantics. It creates an ordinary
Layout box, not a Scene entity or a new preset schema. Working-plane X/Z plus the explicitly
selected current floor datum resolve the world-local center Y (floor + half height); no Room
containment or inferred support. Offer the same typed X/Z placement through its Instrument,
then dimensions through the existing Layout-object transform planner. A height edit declares
whether it keeps the bottom on the selected datum; retaining bottom is one explicit dimensions
plus position plan, never a persistent support constraint or two history steps. Capture the object ID
before evaluation under F.4; if the retained planner cannot consume that captured ID, add a
bounded explicit-ID input rather than accepting hidden allocation. No Scene Place item is
implemented until T2 supplies its adapter. Columns/platforms, arbitrary asset placement,
attachments and multi-support placement are deferred.

**Acceptance:** valid scalar edits compile and update Plan/3D coherently once with one undo;
invalid dimensions, host overrun/overlap and a Wall shortened below an Opening reject locally
with the original typed proposal/reason, accepted geometry and selection intact. Blank,
non-finite and invalid step-base input never become zero or false `:invalid` states (TD-2).
Precision preserves full typed values rather than saving rounded display values. Enter accepts,
Esc cancels and blur does not commit. Document Undo is unavailable during a live proposal with
a reason. Call-site proof fails if a UI writer bypasses the Layout planner or shared acceptance.
Cloud Save remains gated; downloaded JSON round-trips through the current strict codec and
contains no generated geometry, selection, tool, history or renderer state.
Empty boot → plinth placement → dimension edit → Undo/Redo → source reopen must work in both
readings with the same captured identity and floor-resolved Y. Invalid/stale placement creates
no object/history; replacement clears its ghost. This is the phase's smallest greenfield edit.

### S05 Existing straight-Wall manipulation

**Prerequisite:** S04 complete and listed gates accepted. **Produces:** bounded direct editing
in the shared Stage; this is the cycle terminal, not the phase final gate.

Expose existing straight-Wall length/angle with explicit fixed endpoint, and rigid translation
through `planExactWallLength`, `planExactWallAngle`, `planRigidWallMove`. Shared Junctions
remain shared: preview affected neighbours/reach, and refuse candidates the canonical planner
cannot preserve. Do not author Room geometry or join coincident independent structures.
Restrict controls to supported, legible axes; numeric Dimensions remains available when an
axis cannot be picked precisely in 3D. Curved-Wall shape/translation handles are deferred;
their scalar edits from S04 remain available.

Pointer capture owns the gesture. Preview from its immutable baseline; evaluate inverse and
snap against the rendered projection and compiled query records. Snap is an explicit
transient suggestion, never a coordinate-to-connectivity shortcut. Release commits once via
the same planner/intent as typed input; Esc/lost capture/replacement cancels with none. A
reading flip continues a gesture only while its parameter mapping remains valid; otherwise
pause that writer with an explanation, preserve the proposal, and offer explicit resume or
cancel. It must not silently commit, reinterpret a delta, or discard work on a flip.

**Acceptance:** pointer and numeric paths yield the same document for the same explicit
intent; one gesture has one history result; shared-neighbour invalidity rejects atomically;
Wall/Opening/Room identities and curve data are preserved by supported operations. Plan and
3D handles/highlights resolve the same source; inactive helpers do not pick. Navigation,
reading changes, grid/snap and Esc generate no document-history entries. M1/M2/M5 get real
composed-path exposure; M4 Wall-birth/noding identity remains dormant, honestly unexposed.

### S06 Integrated final gate

**Prerequisite:** S01–S05 accepted/closed through their applicable procedure; seam provider
remains independently accepted. **Produces:** recorded phase integration acceptance only.

VERIFICATION: exhaustive

Run the complete repository contract below and record independent review of: existing
project → Plan select/search → precision edit/refusal → flip to 3D → direct edit/cancel →
Undo/Redo → canonical source download/reopen → project replacement. Include an empty project,
nonzero floor datum, curved Wall, shared Junction, duplicate names, Opening void/cap,
independent coincident structures, dense geometry, long identity, narrow/short shell and
reduced motion. Add empty boot → native plinth → precision → source reopen. Include the seam
consumer probes and zero editor machinery in public chunks.

All slice implementation plans use **exhaustive** acceptance verification for this bounded
proposal; the declaration above applies to every linked slice section. Focused iteration is
allowed by the test manual and is never substituted for acceptance. If the owner later
narrows a slice tier, give it an explicit integration route to this exhaustive final gate.
The full implementation-PR merge contract still applies regardless of slice tier.

**Required evidence:** fast/heavy kernel correctness and full editor suite; unconditional arch
lane (including documentation/execution gates and visitor/public/preview boundaries); root
check/build and affected shared-package checks; browser journeys with recorded revision,
workload and consumer conformance. Use [tests/README](../../../../apps/editor/tests/README.md)
for exact lane/command policy and [browser hygiene](../../../../.agents/skills/browser-hygiene/SKILL.md)
when launching/attaching a browser. If API code is later added by approved scope expansion,
API check and DB-backed tests with zero skips are additional, never replaced by root scripts.
Performance-sensitive Stage work gets comparable workload observations over actual shallow
editor inputs, without reviving the retired benchmark harness or machine-time thresholds.

The final gate makes the phase **closable** after routine slice closeout. Only an explicit
owner phase-close request closes it; neither phase nor cycle closure is fabricated here.

## Bounded architecture-cycle window

Proposed configuration under [the phase-planning protocol](../../../operations/architecture-cycle.md#bounded-window-rules):

| Exposure slice | Real exposure already justified by capability work | Expected evidence |
| --- | --- | --- |
| T1.P01.S02 | Project/session replacement and navigation output lifetime (M5); real shell/Stage boundary | Replacement race/cancellation and consumer closure proof |
| T1.P01.S04 | Real Layout mutation call sites and Wall/Floor vertical authoring (M1/M2) | Bypass-sensitive call-site proof, valid/refused scalar edits and coherent source/history |
| T1.P01.S05 | Direct gesture-to-planner/acceptance path, existing Junction/curve identity preservation (M1/M3), replacement cancellation (M5) | Real pointer/numeric equivalence and cancellation evidence; terminal acceptance |

**Bound:** three real exposures. **Expected opener:** T1.P01.S02. **Terminal:** T1.P01.S05.
M3's installed curve proof remains green. M4's birth/join/noding editor half is not exposed;
its later owner verdict must say not-exposed if this boundary stands. M6/M7 are observed
through ordinary start/closeout routing, not an additional audit slice.

This table defines the proposed window; it does **not** edit live cycle state. On owner phase
approval/registration, configure the sole live state as `PHASE_1`, readiness `ready`, this
phase **selected, not open**, with these three IDs and their plan anchors. Leave Opened by,
exposure rows, Closed by and verdicts empty. Until registration, live readiness remains
`awaiting-bounded-slice-window-plan`. A planning change is never `open-window`.

Any listed slice starting authorized implementation opens the window, even if it is not S02.
Close only when S05 is accepted and S02/S04 are accepted or explicitly discharged in their
exposure rows; the terminal cannot be discharged. Then the owner owes per-mechanism verdicts.
S06/phase close and unrelated T2/T3/T4 work do not trigger those transitions or wait for a
cycle verdict. Do not grow the exposure list to fit later scope without an owner amendment.

## Dependencies and owner decisions

1. **Approve this phase boundary and S01 first.** Add the phase to the owning registers/baton
   in the authorized follow-up, with real artifact routes; leave all acceptance absent.
   The restricted native placement/existing-project entry and deferred new drawing are deliberate decisions.
2. **Ratify the narrow F.1/F.3 drafts** in [interfaces.md](./interfaces.md#f-amendment-drafts),
   then authorize S01 as their provider. Other tracks join these interfaces; they may refine
   the draft before ratification, but cannot create private replacements.
3. **Accept the S02 seam independently and early.** Register T1 as owner, S02 as sole provider,
   version 1, exact exports/conformance/acceptance and real commit identity at the appropriate
   later state. T2/T3 authoring depends on that acceptance, not S06 or all of T1. Their data
   work depends only on its own F gates. No T3 cutover prerequisite is imposed on S02.
4. **Choose the local history dependency.** Recommended: amend F.4's timing to allow the
   shared, Layout-only local foundation in T1 S03, with owner-authorized delegation of that
   bounded provider. Keep T3's first compound acceptance, unit/order migration and cloud
   precondition together. Alternative: T3 provides the same accepted local foundation first;
   re-declare S03 as consuming F4.intent-acceptance@1 and remove its provider claim. Until
   decided, S01/S02 planning can stand and S03–S06 are conditional, not authorized.
5. **Configure, do not open, the cycle window** after registration. Track-local proposal
   approval is not gate acceptance, T3 cutover, phase closure or shared-contract ratification.

## Deliberately deferred scope and next boundary

The next T1 phase should derive a bounded **Wall authoring/schema cutover**: creator-neutral
Draw, derived Wall roles, legacy partition disposition, intentional non-enclosing rings,
connectivity-policy reconciliation, current-format change/fresh-authority decision, Room
lineage and retirement of the legacy Layout types/codec/frame/compiler adapter. None is
smuggled into this phase through a role selector or a renderer heuristic.

Levels/structures and architectural definitions/instances have addressing capacity in F.1,
but no new authored schema or multi-level UI here. Single-Wall closed circles/periodic
Openings, top profiles, head-fixed independent arch rise, slabs/CeilingRegions, gaps/fit,
Section/crop/peel/Unroll/Lift/Look-up, nested exact-return recipes and exit-summary undo are
later T1 capability plans. Ordinary Plan depth/membership/source identity is not deferred.

Scene placement/gizmos/materials/lights/resources/ingest remain T2. Authored Camera View/path
adapters, Camera extraction and Experience order, compound acceptance, cloud expected-revision
Save and Preview remain T3. Any later T1 Camera-authoring migration consumes the accepted
`T3.camera-experience-cutover` version first and declares its Camera-authoring effect; none of
these slices has that effect. Release envelopes/prepared readers/publication UI remain T4.
No baseline, publication integration or track completion is proposed by this phase.
