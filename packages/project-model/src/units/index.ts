/**
 * `@portfolio/project-model/units` — the F.2 `unit-envelope-v1` provider
 * (AM-2), reached only through this explicit subpath.
 *
 * Nothing here is exported from the package's root barrel, and no normal reader,
 * writer, API route, visitor runtime or editor host imports it: the envelope is
 * the target of the one source migration and stays inactive until `T3.P01.S04`
 * activates it. In particular this entry is *not* the delivery-only program
 * entry — `./program` keeps its own closure.
 *
 * Exports: the envelope/unit/header/lock/payload shapes, strict validation,
 * canonical bytes, unit content revisions and the envelope source-content digest.
 */

export * from './types';
export * from './canonical';
export * from './validate';
