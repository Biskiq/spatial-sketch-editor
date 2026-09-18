# Camera and tour

**Read when:** nodes, connections, paths, guided order, timeline, framing, sequence preview.  
**Last reviewed:** 2026-09-07 (P21.6 Slice B closeout)
**Deep dump (rare):** [`../archive/CAMERA_AND_LAYOUT.md`](../../archive/CAMERA_AND_LAYOUT.md)

---

| Term | Meaning |
|------|---------|
| Camera node | Eye / target / FOV (world-local; `roomId` absent — legacy room-local only) |
| Connection | Edge; JSON stores **interior** anchors only |
| Path kinds | `rounded-polyline` · `auto-bezier` (no tangent handles) |
| Order | Open chain (main route + branches); loop derived from a distinct tail↔head connection |

Defaults: eye **1.65 m**, target **1.25 m**, distance **3 m**, clearance **0.35 m**.  
Resolver inserts `node:<id>:position` — **never** persist those as interiors.  
Editor preview + visitor share **`@portfolio/camera-core`** (`camera-route` +
`camera-motion`) only. Durable scene/runtime types and graph construction live
in **`@portfolio/project-model`**; camera-core consumes only structural camera
graph inputs. Visitor-only `CameraDirector.svelte` and
`NavigationNode.svelte` remain app components.

Directional view tracks may carry one optional `framingEnvelope` per travel
direction: `0 ≤ enterStart ≤ enterEnd ≤ exitStart ≤ exitEnd ≤ 1`. Route
construction selects and deep-copies only the oriented direction's envelope;
motion samples its enter/exit smootherstep ramps against edge-local distance
progress and applies the resulting weight to both Cartesian target and FOV.
Missing envelope preserves legacy full-authored framing; envelopes on tracks
without authored keys remain automatic. Motion creation compiles stateless
minimum-standoff, POI angular-rate, and hazardous late-exit bypass guards;
runtime seeks apply those target-only corrections deterministically. Larger FOV
is wider / zoomed out; smaller FOV is tighter / zoomed in.

Verified dense invariants (P1.4, 2026-08-19): over whole transitions and at
arbitrary seeks, enveloped motion stays finite with `distance(target, eye) ≥
VISITOR_CAMERA_PROJECTION.near`, canonical node poses at `p = 0/1` in every
branch (forward keys · reversed keys · reversed-no-key `travelFacingEnds` ·
legacy no-envelope · automatic no-key), deterministic great-circle fallback on
over-capacity and near-antipodal remaps, no adjacent 180° pops, bounded angular
rate wherever compiled rate limiting applies (peak measured from the compiled
segment pairs, never the nominal policy constant), and bypass/standoff guards
that change only the target. The double-whip bypass turns on exactly at the
policy off-axis, path-excess, and angular-rate thresholds. FOV rides the same
envelope weight as the target and is never changed by target-only guards.

One exception is deliberate, not a defect: **zero-width envelope ramps**
(`enterStart = enterEnd` or `exitStart = exitEnd`) are legal intentional steps.
They are exempt from the smooth-ramp rate assertion; they must still be
deterministic, finite, non-degenerate, and exact on both sides of the bound.

## Camera Plan (P1.5)

**Canonical for camera-graph authoring behavior.** Routing/chrome:
[`shell.md`](./shell.md) · exposure MUSTs:
[`../design-system/shell-camera-workspaces.md`](../design-system/shell-camera-workspaces.md) §9.

Camera → Plan is the live top-down camera-graph authoring surface over the
architectural backdrop. It answers **where** cameras and paths are; framing
stays in Camera 3D. Camera Plan reads `store.document` + `store.rooms`
(`resolvePlanSceneGraphFromDocument`), samples the exact shared draft curve
(`createDraftConnectionPositionPath` + the visual sample-count policy), and
reuses every store command (`beginCameraPlacement`,
`createPendingNavigationNodeAt`, `beginConnectExistingNodes`,
`connectPendingNavigationNode`, `connectNavigationNodes`,
`deleteNavigationNode`, `deleteConnection`, `setConnectionTiming`) and
selection action (`selectNavigationNode`, `selectConnection`,
`selectCameraConnectionDirection`, `selectAnchor`). Node/edge/connection
selection, discovery direction, Sequence panel, timeline, and history survive
Plan ↔ 3D; a persisted view-keyframe selection gets only a passive
“Edit framing in Camera 3D” message.

- **Backdrop:** live compiled geometry, subdued, never selectable — Camera
  Plan contains no `selectLayout*`/`clearLayoutSelection`/`layoutInteraction`
  path (source-asserted). Add Camera needs a room-floor hit.
  **Known defect (open, deferred to P24):** in canonical wall-first projects that
  floor hit is refused, so no camera node can be placed at all —
  [`../../operations/tech-debt/README.md`](../../operations/tech-debt/README.md) TD-1.
- **Hit priority:** camera node → visible interior anchor → connection curve →
  empty (deselects the active camera selection). Tolerances are screen-px
  constants divided by `pixelsPerMeter`.
- **Edges:** every connection once, undirected, no arrowheads; retained
  (non-flow) edges stay visible in a distinct style. Order changes numbering,
  never the edge set.
- **Order/free:** ordered nodes show stable `1…N` labels from
  `store.mainFlowNodeIds`; unsequenced nodes show an unnumbered dashed ring and
  “Unsequenced” in the inspector.
- **Node colors (P21.5 Slice 2B):** node role colors are canvas-invariant
  tokens — plan paper is theme-invariant, so node ink never follows the shell
  theme. Sequenced nodes fill `#2F8CFF` with white bold tabular numerals and a
  1.5px white ring; selected deepens to `#1976DF`, grows 24→28px, and gains a
  translucent blue halo ring. Unsequenced nodes are paper discs with a 2px
  dashed emerald ring and an emerald dot; when selected they take a blue tint
  fill, a solid emerald ring, and the same halo. Selection uses halos + size,
  never fill inversion, and picking uses its own screen-px hit radius — the
  24→28px growth is presentation-only.
- **3D camera visualization (P21.6 Slices A/B):** 3D nodes/paths/frustums are
  authored spatial truth, invariant in every theme (`SCENE_PALETTE` camera
  tokens, never chrome accent). Sequenced 3D cores fill `#2F8CFF` with an
  HTML numbered badge (blue disc, 1.5px white keyline, white tabular numeral);
  unsequenced cores are transparent emerald with an emerald perimeter ring
  (billboarded); selection adds a concentric `#1976DF` ring, never fill
  inversion. Paths run `#2F8CFF` (selected `#55A1FF`); retained edges keep the
  gray dashed language. The selected camera shows a translucent `#2F8CFF`
  frustum fill (9%, scene-occluded) with a 1px blue perimeter, a dark apex
  nub at the eye, compact blue FOV handles, a dashed slate look-at ray to a
  target reticle, and off-white anchor dots for the selected connection only.
  Picking rides invisible shells (`colorWrite:false + depthWrite:false +
  opacity:1`) clamped to a 24px minimum projected diameter; same-class
  overlaps arbitrate by closest projected center under the existing
  nodes > view-keyframes > anchors > connections priority. FOV drags freeze
  their basis at pointer-down (signed top/bottom identity, true grab offset)
  with a vertical-slider fallback below 0.15 alignment — one undoable
  gesture, invalid intersections hold the last valid FOV. Paused Director
  preview yields the frustum to an editable node/view-keyframe selection;
  paused with no editable selection owns `none` (clean viewport, never a
  resurrected wireframe); playback keeps the playhead owner. Frame off
  suppresses both frustum implementations; an ineligible selection helper
  (wrong workspace / pending placement) cannot suppress the playhead — no
  stop/seek side effects. Arbitration covers camera handles only
  (placements/architecture keep distance order) with winning-class-first +
  CSS-pixel order shared by hover/click/drag-entry; per-move FOV alignment
  rechecks hold grazing blowups; hidden helpers never pick; nub + preview
  orient from the shared framing basis.
- **Anchors:** interior anchors render only for the selected connection;
  dragging an edge with no anchor inserts one at the nearest curve progress
  (shared `getCameraPathInsertionIndex` / `insertConnectionAnchorAtWorldPoint`
  ownership rules) then drags it. Authored node/anchor Y is preserved
  byte-for-byte; snap adjusts X/Z only.
- **Timing:** each edge shows one compact pill at the spline midpoint with
  durations only — `4.2s` when both directions resolve the same readout,
  otherwise `4.2s · 3.8s` (forward · reverse); non-finite reads `—`. Pill ink
  is canvas-invariant (the Plan canvas is paper in every theme — never the
  chrome accent): unselected pills are white with a slate border + charcoal
  ink so they read on paper and room floors; the selected edge's pill takes a
  deep-sapphire fill + white ink with an electric-blue perimeter tied to the
  route. Automatic segments carry a dotted underline (3px offset) + tooltip,
  authored segments render solid. Node names,
  direction breakdown, and derived speed live in the connection Inspector.
  The Camera Plan connection inspector authors `durationSeconds` per direction
  through `setConnectionTiming` (finite-positive validation, one undo step,
  “Use automatic” removes only duration, preserving easing). Path length,
  effective duration, and derived speed come from the exact per-direction
  `CameraMotion` the timeline constructs — never UI-local math.
- **History:** add, connect, delete, node drag, anchor insert/drag, and timing
  edits each produce one scene-history entry; selection/hover/pan/zoom/toolbar
  changes and failed/cancelled gestures produce none. Escape cancels an active
  drag first (capture-phase, cannot fall through to pending-command
  cancellation), then the pending navigation command, then returns to Select.
- **Preview grammar (P12):** ordinary Camera/connection selection is
  selection-only. `Preview Camera` explicitly enters paused static `Camera`
  scope for an Unsequenced node; `Preview Edge` explicitly enters paused local
  `Edge` scope with deterministic direction; the Scope menu explicitly enters
  `Sequence`. None autoplays. A sequenced-node click seeks + pauses only while
  Sequence scope is already active. Active scope labels stay compact (`Camera ·
  C`, `Edge · B → C`, `Sequence (Full Tour)`). Connections remain one undirected
  topology model; direction is traversal/preview state. Safe authoring pauses a
  playing preview in place. Main-editor transport is binary Play/Pause; Play at
  end restarts from `0`, Escape pauses without tearing down, and Repeat/loop /
  distinct Replay chrome is absent. Edge Repeat and stop-on-Escape remain only
  in the frozen relic.

Visitor: plays the open-chain order (loop derived); free nodes via BFS; transitioning = no nav; Paris = fixed eye + free-look. No ribbons on `/museum`.

Limits: no collision/navmesh; synthesized look; timeline drag-connect ≤1 new edge; guarded deletes.  
Future Experience / Interaction consumers reference this canonical camera
graph/route/motion evaluation; they do not implement another one.
