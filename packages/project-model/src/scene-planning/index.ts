/**
 * T2.P01.S01 — deterministic Scene planning.
 *
 * The normalized definition input, the yaw-only local frame and its inverse,
 * the captured-metadata identity and `place-object` candidate preparation.
 * Runtime-safe: no editor module, no Three, no F.4 type and no catalogue
 * import reaches this module; `@portfolio/layout-core` sits below this package
 * and supplies the floor-support vocabulary the planner consumes.
 */
export * from './types';
export * from './frame';
export * from './metadata-identity';
export * from './place-object';
