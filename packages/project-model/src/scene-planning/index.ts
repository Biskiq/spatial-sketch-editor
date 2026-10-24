/**
 * T2.P01.S01 — deterministic Scene planning.
 *
 * The normalized definition input, the yaw-only local frame and its inverse,
 * the captured-metadata identity and `place-object` candidate preparation.
 * Runtime-safe: no editor module, no Three, no F.4 type and no catalogue
 * import reaches this module; `@portfolio/layout-core` sits below this package
 * and supplies the floor-support vocabulary the planner consumes.
 *
 * T2.P01.S02 appends the operation set over F.4's landed contracts: the
 * snapshot-qualified support re-derivation, the record-scope guard, the seven
 * operation implementations, the strict intent reader and the `DomainPlanner`
 * set. They register into the accepted coordinator; no history, installer or
 * adapter variant is added here.
 */
export * from './types';
export * from './frame';
export * from './metadata-identity';
export * from './place-object';
export * from './support';
export * from './record-scope';
export * from './operations';
export * from './intent-payload';
export * from './model-resource';
export * from './planners';
