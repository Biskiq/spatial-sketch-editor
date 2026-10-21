# D1 corrective amendment — TD-11 and TD-12

**Status: owner-approved October 20, 2026.** The owner explicitly answered “Approve the narrow amendment” in the PR #168 takeover chat after reviewing this exact scope. This supplements Batch D D1; it does not expand its other boundaries.

Authorize only the corrective host increments introduced in `5beb1e83`:

- **TD-11:** translate Stage-local pointer CSS to viewport CSS, and projected viewport CSS back to Stage-local overlay CSS, once at the existing host boundary.
- **TD-12:** retain the evaluation identity of a claimed adapter press across ordinary Camera evaluations, while preserving the accepted S05 reading-change contract: end the writer without committing, retain the exact paused parameter, and offer Resume/Discard. Include the narrow route correction if investigation confirms that lease cancellation bypasses this path.
- Preserve the projection of the claimed adapter press by refusing concurrent host navigation until release; explicit reading interruption still uses the existing paused-proposal path. This is part of TD-12’s corrective press lifecycle, with no new controller.
- Add the necessary regressions through the existing facade, adapter and mounted-route harness, covering offset selection/hits, continuous drag, genuine reading interruption, explicit cancellation and history integrity.

These corrections enable the already authorized S06 journeys. They authorize no additional host capability, redesign, architecture change, second controller/evaluator, F2/F4 change, Layout/Scene planner change, API change, prototype change, T3 authoring work, phase closure or merge. Batch D ownership constraints continue to apply.

Owner decision: **approved**, October 20, 2026, PR #168 takeover chat.

## Supplemental amendment — Index selection cloneability

**Owner-approved October 20, 2026.** The owner explicitly answered “Approve this narrow Index correction” in the takeover chat. The real browser reproduced `DataCloneError` from `selectSource` passing a reactive Plan fragment reference into immutable selection. This is distinct from TD-11/12. The proposed correction declares the route's generated `planView` as `$state.raw` (it is replaced whole, never mutated), plus a mounted Index-selection regression. It changes no domain, F4 contract, selection authority or authored data.
