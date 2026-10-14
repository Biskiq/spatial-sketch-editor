# T3 — Experience: planning evidence and obligations

**Status:** planning evidence for the T3 track (PR #115, `implementation-plan.md` §8.4).
Evidence and obligations, not an implementation plan: nothing here authorizes a slice.
**Authority:** the ratified [F contract](../../reference/composition-execution.md) (F.1–F.5),
[`../../reference/north-star.md`](../../reference/north-star.md) and
[`../../reference/architecture.md`](../../reference/architecture.md) own the destination. Where this
summary and a ratified contract differ, the contract wins.
**Grounding:** the four §4.3-criteria Camera modules are retained under
`apps/editor/src/lib/authoring/camera` (this track decides their later home).

## 1. Vocabulary: Destination, Presentation, Stop, visit

- **Destination** is a *navigation target/address role*, not a second authored entity (F.2). A
  Destination names the canonical Camera/Spatial meaning a visitor is sent to; it never owns pose,
  path or timing (F.1).
- **Presentation** is reusable Experience composition. **Stop** is one authored Guide occurrence
  that references a Presentation. A **visit** is a session invocation of a Stop (F.1).
- **The distinction is load-bearing for repeats.** Repeated visits to the same Stop are separate
  runs; runtime lifecycle may never be keyed only by Presentation, Stop or authored-use identity
  (F.1). One reusable subject appearing twice in a Guide must yield two distinguishable contexts
  without duplicating a View, path or pose (P25 research §6/§16-E).
- **Consequence:** the minimum is Destination + Stop-occurrence + Content → Info Panel +
  `Activate`/`DestinationReached` + `ShowContent`/`NavigateTo`/`OpenUrl` + guided/free navigation +
  the a11y/motion contract (P25 research §2, retained below).

## 2. The Experience unit is collection-capable with no "Destination" duplicate

- The Experience unit owns **Presentations, Experience-wide Interactions, and optional Guides whose
  Stops reference Presentations**; a project may hold several Experiences over one shared world
  (F.2). Collection-capable is the unit's shape, not a speculatively designed schema.
- **"Destination" must not be re-authored as a second entity** beside Presentation/Stop (F.2).
  It is a role; a first-class `Destination` record would duplicate the reference target.
- Experience stores **references and context only**; Camera keeps View, route and projection truth.
  An Experience invocation never holds a duplicate Camera graph or pose/FOV authority (F.2).
- Proposal status: `ExperienceDocument` ownership is semantically clear but its envelope is
  deferred; no Experience document is designed (F.2, `architecture.md` Experience row).

## 3. Camera ↔ Experience cutover: geometry/timing intrinsic, order moves out

- **Camera keeps as one authority** connectivity, routes, framing, projection and evaluation. Every
  profile controller (guided travel, free look, reduced motion, film, future XR) realizes viewing
  intent through that authority; no second navigation, motion or pose/FOV interpolation authority
  exists.
- **Experience takes over** editorial occurrences, order, holds, continuation, explicit Gates,
  interaction policy and detours at cutover. A Stop may reference a View and supply supported entry
  context and invocation time mapping, or deliberately keep the current viewpoint; it never copies
  Camera truth. A missing referenced View is a repairable unresolved binding, distinct from
  intentional keep-viewpoint.
- **One simultaneous cutover, not two migrations.** The `nextNodeId` / `previousNodeId` /
  `holdSeconds` retirement from Camera nodes and the Camera-unit split land together as one
  migration of `navigationNodes` (F.2). Legacy `lockInteraction` is migration *input* to explicit
  Experience Gates, continuation or interaction policy.
- **Two editable order systems may never coexist.** A read-only legacy order adapter may assist the
  migration; it is not a second writer (F.2). "Node links and Experience order must never remain
  coequal writable authorities."
- **Keep the invocation, not the mechanism.** `camera-route.ts` / `camera-motion.ts`, the curve/guard
  model and the app components are replaceable implementation, not the guarantee.

### 3.1 The order-field retirement row (§5.1, T3-owned)

> Scene/Camera editorial order fields; `camera-core` main-flow/node-order orchestration —
> **RETIRE AT T3** camera-experience cutover. Concrete dependency: the retained visitor guided
> runtime consumes order, and Experience order is its successor representation. The new product has
> no writer for these fields after #115.

Fields in scope per §2.2: `nextNodeId`, `previousNodeId`, `holdSeconds`, `detourOfNodeId`,
`lockInteraction`. This row is blocked until the replacement representation exists; it is never
"later cleanup".

## 4. Visitor navigation, DOM companion and accessibility

- **DOM companion navigation is a mandatory platform contract, not polish**: a semantic
  `<nav>`/control surface that reaches every Destination and the current position — never
  raycast- or WebGL-only access. Keyboard and pointer/touch equivalence for every action.
- **Focus, labels and steps:** visible focus and logical order; Info-Panel focus-in/Escape/return;
  `aria-current` on the current Destination/Stop; progress is platform-derived (`Step 2 of 5`);
  real link semantics with a new-context warning; touch floor 24×24 CSS px with ~44 px controls.
- **Content accessibility:** required author labels (Destination, interactive target, Content
  title/body, meaningful link text), image alt *or* decorative declaration, captions where audio
  matters, and a **transcript for audio-only narration**.
- **Reduced motion reaches the same semantic destination:** `Normal: A→authored motion→B`;
  `Reduced: A→cut/dissolve/minimal→same B`. No alternate destination and no second route. An
  accelerated traversal is *not* motion removal; narration is unaffected by a motion preference and
  the author may never disable the preference.
- **Preview and publication share visitor semantics.** Preview is the same runtime under the same
  evaluation; parity is a contract, not a visual comparison.
- **Autoplay constraints:** audible autoplay is blocked before visitor interaction, so arrival can
  never unconditionally start narration — a visible play affordance is the fallback; opening a new
  browser context requires transient activation.

## 5. History and acceptance invariants (successors to deleted tests)

`implementation-plan.md` §7.2 carries these forward as **T3 F.4 acceptance criteria**, because the
editor `history-controller`, `document-store` and `mutation-guards` suites are deleted with their
subjects. Each is a same-defect obligation, not a fresh idea:

- **One logical result.** An accepted compound change produces exactly one accepted result and one
  undo result (F.4 acceptance sequence).
- **No-op writes nothing.** A change that alters nothing produces no history entry.
- **Rollback.** Failed validation leaves the previous accepted state intact; a failed upload may
  leave collectable staged bytes, never a half-installed composition (F.4).
- **Cap.** A bounded history depth is retained as behavior, with the same observable consequence.
- **Stale writers are rejected** by the expected-revision precondition — see §6.
- **Atomic group/duplicate validation** is validated as one unit, not per item.

## 6. Expected-revision Save

- An authoring operation is a deterministic function of **one expected project revision plus a
  typed, serializable intent** (F.4). The expected-revision precondition rejects stale local *and*
  cloud writers.
- **Concrete gap to close:** today's cloud Save takes a row lock and appends versions but accepts no
  expected-revision precondition, so a stale full-document writer can overwrite newer intent (F.4,
  F.2 current behavior). This gap is the F.4 cutover obligation before simultaneous human/agent
  writers.
- **Owners:** `apps/api` is retained and refactored at T3/T4; the relocated
  `apps/editor/src/lib/platform` persistence path is refactored at T3 to add expected-revision
  acceptance (§5.1). Human UI and agents use the same operations, diagnostics and expected-revision
  rule.
- Typed session declarations, run isolation and run-scoped events are part of the same foundation;
  a stale event may never change a later accepted contribution.

## 7. Camera authoring math placement

- The retained pure Camera authoring modules live at `apps/editor/src/lib/authoring/camera`
  (framing envelopes, interior-anchor path editing, directed-edge timing, connectivity, route
  clone). They are Camera-owned semantics independent of the shell (§4.3).
- **T3 decides their home** — the Camera-unit extraction. The open question is whether they belong
  in `packages/camera-core`; editorial-order parts are explicitly *not* among them. §5.1 defers the
  decision to T3 rather than settling it here.
- Routes: `lib/authoring/camera` (+ `lib/authoring/layout`, `lib/authoring/a11y` for neighboring
  concerns) per §4.3.

## 8. Retained P25 findings (a11y and repeated-occurrence)

Extracted from the archived compact
([`../../archive/technical/experience/P25-research-compact.md`](../../archive/technical/experience/P25-research-compact.md));
the rest of that document's framing is provenance for a pre-#115 model and is not current truth.

- **Repeated occurrence (current):** one reusable subject cannot be two contextual visits while
  order lives on Camera nodes, because order is single-valued (`nextNodeId`/`previousNodeId`) and
  the visitor walk keys visited state to rooms, not occurrences. Confirms §1/§3 above.
- **Index identity fails:** binding to a positional index (`sequence[3]`) mis-targets on any insert,
  reorder, delete or duplicate before it. Array index is never identity; a stable occurrence
  identity is required (F.1).
- **Rejected by evidence:** duplicating Camera nodes to express semantic repeats (viewpoint
  duplication and edit drift), Experience-owned pose, raw coordinates as identity, and an
  independent Experience tour graph beside Camera.
- **Accessibility, platform-owned:** one semantic `Activate` unifying pointer/touch/keyboard/DOM; DOM
  companion surface; `aria-current="step"` for progress; modal focus-in/Escape/containment/return;
  keyboard play/pause/mute/volume; target-size floor; identical Preview/Publish semantics; and
  device-independent XR access with sickness alternatives (`prefers-reduced-motion`).
- **Named-but-open (not decided):** narration as a first-depth capability with real lifecycle,
  transcripts and explicit enablement; transient `Highlight`; session-only `Once`/`FirstVisit`;
  whether a Sequence becomes occurrence-based; Stop storage owner; media representation and
  pinning. These are gated on the Camera/Experience cutover, not on this record.

## 9. Boundary

Nothing in this record reopens a landed contract, adds an Experience document, schema, codec or
authoring surface, or authorizes T3 implementation. Capability work requires its own approved scope
and accepted gates.

## Provenance

Baseline `e90a58224443bdbf44114d7285d55c983b79cc84`. Consulted: `docs/reference/composition-execution.md`
(F.1–F.5), `docs/reference/architecture.md` (Experience row), `docs/reference/components/camera-tour.md`,
`docs/reference/north-star.md`, `docs/reference/design-system/editor-shell-and-visual-system.md`,
`docs/operations/tech-debt/README.md`, `docs/roadmap/parallel-track-cutover/implementation-plan.md`
§2.2/§4.3/§5.1/§7.2/§8.4/§9.1, the archived P25 compact, and the prototype plans under
`prototypes/experience-ux-v3/design/`, `prototypes/spatial-authoring/plans/experience-v2-prototype/`,
`prototypes/spatial-authoring/plans/unified-design-reconciliation/` and
`prototypes/spatial-authoring/plans/world-authoring-prototype.md`. Retiring-roadmap sources are cited
in the recoverable form `git show e90a58224443bdbf44114d7285d55c983b79cc84:<path>` rather than as live
routes.
