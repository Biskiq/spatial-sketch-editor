/**
 * Editor-only conditional Save state. Not reachable from the public route: the
 * platform client and the state machine are authoring machinery, proved absent
 * by the F.4/visitor isolation boundary (arch lane).
 */

export * from './save-state';
export * from './api-transport';
