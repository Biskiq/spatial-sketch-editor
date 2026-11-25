/**
 * The Scene `DomainPlanner` set over F.4's landed contracts.
 *
 * This module registers **planners**, not a history, an installer or an adapter:
 * a candidate is admitted by the current-source adapter and installed by the
 * editor coordinator. Live registration in a host belongs to the host↔F4
 * wiring; nothing here is
 * reachable from a route.
 *
 * The normalized-definition policy is **injected** (`options.definitions`,
 * captured from the editor object-definition policy). Planning never reads the
 * application catalogue, and the intent carries the captured
 * `metadataContentId`, so a policy that changed underneath an intent refuses
 * (`definition-changed`) instead of silently placing a different object.
 *
 * Every admitted operation is single-domain Scene with `compound`, `units` and
 * `resources` false; the landed registry refuses anything wider.
 */

export { createScenePlanners } from './planners/planner';
export type { ScenePlannerOptions } from './planners/contracts';
