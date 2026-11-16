/**
 * `@portfolio/project-model/units` — the F.2 `unit-envelope-v1` provider
 * (AM-2), reached only through this explicit subpath.
 *
 * Nothing here is exported from the package's root barrel, and the subpath is
 * explicit. It is live: the API read/Save boundary and the
 * visitor runtime import this entry, and the unit Save handler is the live
 * writer. In particular this entry is *not* the delivery-only program entry —
 * `./program` keeps its own closure.
 *
 * Exports: the envelope/unit/header/lock/payload shapes, strict validation,
 * canonical bytes, unit content revisions and the envelope source-content digest.
 *
 * `./acceptance-staging` is the F.2-dependent half of
 * `unit-acceptance-v1`: staging needs the envelope's resource registry, so it
 * belongs behind this subpath rather than in `f4/**` (whose closure the
 * architecture gate keeps free of the F.2 entries).
 */

export * from './types';
export * from './sky-presets';
export * from './source';
export * from './canonical';
export * from './envelope';
export * from './runtime';
export * from './camera-connectivity';
export * from './validate';
export * from './acceptance-staging';
export * from './planning';
export * from './experience-structure';
export * from './acceptance';
export * from './save';
// The F.4-facing half of the same capability (the wider registry and the
// dispatcher entry) is re-exported here so a host that opts into F.2 reaches one
// unit-acceptance entry. It imports no unit module, so this stays acyclic.
export { createUnitPlannerRegistry, createUnitTargetInspector, prepareUnitIntent, validateUnitTargets } from '../f4/unit-acceptance';
// The shared Experience lowering, interpreter and semantic
// companion. Appended: they read the same inactive envelope and activate with it.
export * from './experience';
// Type-only: an editor that executes a lowered program names its type without
// pulling the program's validation closure into a source module.
export type { ExecutionProgram, ProgramInvocation } from '../program/types';
