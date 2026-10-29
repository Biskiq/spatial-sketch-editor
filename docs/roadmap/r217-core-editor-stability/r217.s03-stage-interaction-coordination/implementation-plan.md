# R217.S03 — Stage interaction coordination: implementation plan

**Slice:** R217.S03 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2 (Scene provider), T5 (form provider), T3 (Experience lens, Undo reason) ·
**Runbook:** [T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

## 1. Outcome

The Stage decides who gets the pointer in one place, by one documented rule. Every domain keeps its
own hit, occlusion and refusal policy beneath it. Hover exists as session state for every reading
and tool. Every way a press can be interrupted ends it the same clean way. Selection and picking
results are unchanged on the fixtures, apart from listed interruption fixes. The visible changes
come in S04 and S07.

## 2. Why this is the smallest sensible slice

Much of the authority already exists and is kept:

- **one gesture lease** (`StageSession.acquireGesture`), with per-lease reading-change policies;
- **live proposals** (`registerProposal` / `liveProposal`) as the only "Undo unavailable" reason;
- **Esc**, which offers `cancel` to the owning binding and then aborts the host gesture (the route's `dismiss` branch);
- **lens change**, which cancels all writers (`changeLens`);
- **`pointercancel` and lost capture**, which converge on `cancelAdapterDrag` / `abortGesture`.

What is missing, from the S01 inventory:

| Gap | Today | After S03 |
| --- | --- | --- |
| Cross-domain click resolution | `StageFacade.resolveSourceHit` asks each adapter `hitProvider` in **registration order** (alphabetical by file), then the Plan pick index | One rule: spatial truth across domains, domain policy within one |
| No-task press arbitration | `pressWhenNoTask` bindings are asked in registration order; the first claim wins | Only the binding that owns the primary selection is asked |
| Hover | Only an open task's `hoverIntent` sees unpressed moves; nothing for Select | Session hover from the same resolver |
| Interruptions | Window `blur`, `visibilitychange` and a second touch point are not handled | Each one ends the press through the existing cancel path |

**Deferred:** visible hover and selection (S07), the mark tier's contents (S07), and Paper draw
order (S04 supplies its layer ranks).

## 3. Dependencies

- R217.S01 is accepted; its inventory is the checklist for §4.
- **Claims:** `stage-facade.ts`, `stage-session.ts`, `stage-input.ts`, the spatial route's pointer
  and key handlers, and the `hitProvider` / `pressWhenNoTask` declarations in `scene.adapter.ts` and
  `layout.adapter.ts`. Scene changes are bounded patches reviewed by T2; form-ray changes by T5.

## 4. Design

### 4.1 Domain picks (additive binding contract)

Resolution has **two stages**:

1. Each domain resolves its **own** winner with its own policy.
2. The host arbitrates **only between domain winners**.

The host never sees two candidates from one domain, so it cannot reorder within a domain.

`StageAdapterBinding` gains these members in `stage-facade.ts`:

```ts
type StagePickQuery = { readonly css: readonly [number, number]; readonly evaluationId: string;
  readonly purpose: 'select' | 'hover' | 'tool'; readonly tool: StageToolQuery | null };
type StageToolQuery = { readonly kind: string; readonly scope: 'domain' | 'host' };
type StageDomainPick = {
  readonly hit: StageSourceHit;        // the domain's winner, chosen by its own policy
  readonly refusal: string | null;     // domain words when this subject is ineligible for the tool
  readonly depthMeters: number | null; // 3D: distance along the pointer ray to the winner's surface
  readonly planLayer: number | null;   // Plan: draw rank of the winner's layer (higher on top)
  readonly cssDistance: number;        // screen distance from the pointer to the winner
};
// StageAdapterBinding additions
readonly pick?: (query: StagePickQuery, context: StageAdapterContext) => StageDomainPick | null;
readonly hostTools?: readonly string[]; // host tool kinds this domain answers, e.g. 'erase', 'measure'
```

Each domain computes its winner as it does today:

- **Layout.** The retained Plan pick index moves from the facade into a Layout provider module,
  `plan-pick-provider.ts`, beside `apps/editor/src/lib/authoring/layout/plan-pick-index.ts`. Its
  locked Wall → Opening → object → floor priority and the 8 px tolerance choose the **one** Layout
  winner, exactly as `resolveSourceHit` does now. In 3D, `depthMeters` is the ray distance to that
  winner's pick surface at its drawn height (`pickSurfacesOf` / `worldPointOnSurface`, moved
  unchanged).
- **Scene.** The existing `hitProvider` body becomes `pick`. It keeps its rendered-raycast test
  (`pickScene`), its yield to a nearer Layout or floor surface, its Plan footprint test, its
  edge-halo probe and support occlusion. Its winner's depth is the raycast distance. Native forms
  are Scene entities, so T5 reviews only the form-ray portion.
- **Experience lens.** The bindings keep their framing hits and are wrapped unchanged.

`hitProvider` is removed once both domains have moved; there is no compatibility shim. Any change a
domain wants to its own priority (for example Opening over Wall on Paper) is that domain's policy
change. It needs its owner's decision and its own test, and it is outside this slice.

### 4.2 The resolver

`resolveStagePick(query)` lives in a new `stage-pick.ts` in `apps/editor/src/lib/authoring/stage/`.
It replaces `resolveSourceHit`'s body and keeps its `ResolvedStageHit` result type, so callers are
unchanged.

1. **Ask.** Which bindings are asked depends on the query:

   | Query | Bindings asked |
   | --- | --- |
   | `select`, `hover` | Every binding |
   | `tool` with `scope: 'domain'` (Ink, the Library's placement) | Only the binding that owns the armed tool |
   | `tool` with `scope: 'host'` (Measure, Eraser; S10) | Every binding whose `hostTools` includes `tool.kind` |

   For a host tool, each domain applies **its own** eligibility for that tool kind. It returns its
   winner, with `refusal` set when the winner is ineligible (a Room floor for `erase`). It never
   skips to an eligible subject behind it. For `measure`, the winner's `hit.worldPoint` is the
   domain's preferred measurable point: Layout snaps to a Wall end or Junction within its
   tolerance; Scene snaps to a bounds corner within 8 px; otherwise the surface point.
2. **Mark tier.** It is reserved and returns nothing until S07. A mark winner, when one exists,
   beats every domain winner.
3. **Arbitrate between domain winners only:**
   - **3D:** the smallest `depthMeters` wins; ties within 1 mm fall to the lower `cssDistance`.
   - **Plan:** the highest `planLayer` wins, then the lower `cssDistance`.
     - **Until S04,** Scene winners take layer 60 and Layout winners layer 40, which reproduces today's Scene-first order.
     - **From S04,** the Paper layer table supplies the ranks.
   - **Final tie** across domains: adapter id, recorded as a last resort.
4. **Result.** The winning domain's pick is returned as it was given. A refused winner is returned as
   a refusal carrying the domain's words. The resolver never synthesizes a hit, never rewrites a
   refusal and never consults a second candidate from any domain.

### 4.3 Press arbitration

With no task open, a press is offered only to the binding whose domain owns the **primary
selection**. With nothing selected, no binding is asked and the press goes to navigation. This
matches today's behaviour, because only the selection's owner shows handles. It removes the
dependence on registration order.

### 4.4 Hover

- `StageSession` gains `hover(): StageSelectionEntry | null` and `setHover(entry)`, as view state:
  never history, Save or dirty, and cleared on replacement and on lens change.
- The route resolves hover with `purpose: 'hover'` on an unpressed move, at most once per animation
  frame, only while no gesture lease is held and the pointer type is not touch.
- An open task's `hoverIntent` still runs first. When it returns `true`, the host hover is cleared,
  so a tool's own preview owns the moment.
- Hover and click use the same resolver, so the winners are equal by construction (tested in §5).

### 4.5 Interruptions

A new module `stage-interruption.ts` in `apps/editor/src/lib/authoring/stage/` installs window and
document listeners once per route mount. It calls the route's existing `cancelAdapterDrag` /
`abortGesture` path with a typed reason:

| Trigger | Today | After |
| --- | --- | --- |
| `pointercancel`, `lostpointercapture` | Handled | Unchanged; logged with its reason |
| Window `blur` | Not handled | Ends the press |
| `visibilitychange` → hidden | Not handled | Ends the press |
| A second `pointerdown` with a different `pointerId` while a press is live (pinch start) | Refused, with a notice | Ends the first press, then hands the pointers to navigation |
| Esc, lens change, reading change | Handled | Unchanged; covered by tests |
| Replacement (open, reload) | Handled by `replace` | Unchanged; covered by tests |

**Outcome of every interruption:**
- the adapter receives `cancel` and discards its candidate;
- the lease is released, so no history entry and no dirty change are made;
- selection is kept, capture is released and the hover is cleared;
- `liveProposal()` returns `null` unless an **open multi-step proposal** (an Ink chain, an open numeric entry) is still registered.

Those proposals are not presses and survive every trigger except Esc, Finish, Backtrack, lens
change and replacement. Save during a live press saves the accepted source only; this is already
true by construction and becomes a test.

## 5. Tests and acceptance criteria

1. **Pick differential** (a new `stage-pick-differential.test.ts` in `apps/editor/tests/lib/authoring/`).
   - **Inputs:** the starter, the L Layout fixture and a fixture with a catalogue model, a primitive and a native form; a fixed grid of 400 pointer samples in each reading.
   - **Result:** `resolveStagePick({ purpose: 'select' })` equals the recorded pre-S03 `resolveSourceHit` result for every sample. **Zero differences are expected.**
   - Any difference fails the test. It may be admitted only as an intended cross-domain policy change approved by T1 and T2 in the acceptance record, and never within a domain.
2. **Domain order is preserved.**
   - The tests in `plan-pick-index.test.ts`, `scene-floor-support.test.ts` and `shape-reading-adapter.test.ts` pass without edits.
   - **Regression (new):** a Wall with a hosted Opening, sampled where the Opening and the Wall overlap within tolerance in both readings. The winner equals Layout's locked-priority winner today, the Wall.
   - A seeded resolver that ranks two candidates from one domain fails the test. The `pick` contract returns one winner per domain, so this is a type and structural check.
3. **Hover equals click.** For every differential sample, hover and select resolve the same winner.
   Hover produces no F4 entry, no dirty state and nothing in the Save payload.
4. **Press arbitration.** With a Wall selected, a press on its end handle is claimed by Layout. With
   an object selected, a press at the same CSS point is not offered to Layout. With nothing
   selected, no adapter is asked (`stage-facade.test.ts`).
5. **Interruptions** (`spatial-route-gesture.test.ts`). For each trigger in §4.5 during a Wall drag,
   an object drag and a navigation pan:
   - the adapter received `cancel`;
   - there is no F4 entry and no dirty change;
   - selection is unchanged and the lease is null;
   - an immediate new press is granted.

   An Ink chain survives `blur` and a hidden page with its points intact.
6. **Undo reason.** During a live Wall drag, the Head's Undo reason equals the drag's registered
   reason; after each interruption it is clear.
7. **Removal.** `hitProvider` and the registration-order loops are gone from `stage-facade.ts`
   (structural check). The S01 inventory rows for picking point at `stage-pick.ts` or a domain
   provider.
8. **Host-tool routing.**
   - A test-only host tool kind `probe` declared by Layout and Scene receives winners from both domains and arbitrates them spatially.
   - A domain that does not declare it is never asked.
   - A refused nearest winner returns its domain's refusal rather than a subject behind it.
   - With a domain tool armed, only its owning binding is asked.

## 6. Reviews and stop conditions

- **Reviews:** T2 for the Scene provider move (no policy edits), T5 for form rays, T3 for the
  Experience wrapping and the Undo reason.
- **Stop and report if:**
  - the differential shows a change that is not the one admissible case;
  - a domain cannot return its single winner without changing its policy;
  - pinch hand-off needs a Camera change. That goes to Camera's owner.

## 7. Handoff

S04 supplies Paper `planLayer` ranks. S07 fills the mark tier and draws the hover state. S10's
Eraser and Measure call the resolver with `purpose: 'tool'`.
