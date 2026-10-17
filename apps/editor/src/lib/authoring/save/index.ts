/**
 * Editor-only conditional Save state.
 *
 * Reachable from the spatial route host (T1.P01.S04 mounts it on the Head), but
 * never from a visitor surface: the platform client and the state machine are
 * authoring machinery, proved absent by the visitor/public isolation boundary
 * (arch lane).
 */

export * from './save-state';
export * from './api-transport';
export * from './head-save';
