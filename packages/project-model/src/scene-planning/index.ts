/**
 * Deterministic Scene planning.
 *
 * The normalized definition input, the yaw-only local frame and its inverse,
 * the captured-metadata identity and `place-object` candidate preparation.
 * Runtime-safe: no editor module, no Three, no F.4 type and no catalogue
 * import reaches this module; `@portfolio/layout-core` sits below this package
 * and supplies the floor-support vocabulary the planner consumes.
 *
 * It also holds the operation set over F.4's contracts: the
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
export * from './form';
export * from './operations';
export * from './light-operations';
export * from './intent-payload';
export * from './model-resource';
export * from './planners';

export * from './finish-model';
export * from './finish-planners';
export * from './palette-adoption';
export * from './texture-resource';
export * from './artwork-planners';
