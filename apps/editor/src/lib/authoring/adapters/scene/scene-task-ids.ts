/**
 * X7 — the Scene adapter's contributed task identities.
 *
 * Shared by the contribution projections (which advertise the tasks), the
 * placement binding (which arms, reopens and closes them) and the adapter
 * (which dispatches on them). One spelling, no module owns another's constant.
 */

export const SCENE_PLACE_TASK = 'scene-place';
/** The `taskKind` the Place task and its Find entries carry. */
export const SCENE_PLACE_KIND = 'place-object';
/**
 * T2.P01.S04's bounded composition surface: uniform Resize, duplicate and
 * delete of the selected entity. One task, three scoped commands; the three
 * Find entries all open it so each command is discoverable by name.
 */
export const SCENE_COMPOSE_TASK = 'scene-compose';
/**
 * T2.P02.S02's `creator-import@1` procedure: choose, read, review, approve and
 * arm one of the creator's own models. Library and Head Find invoke it; there is
 * no permanent pointer tool for Import.
 */
export const SCENE_IMPORT_TASK = 'scene-import';
export const SCENE_IMPORT_KIND = 'import-model';
