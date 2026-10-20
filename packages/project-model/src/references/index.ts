/**
 * F.1 `references-v1` — the shared reference/resolution provider (AM-1).
 *
 * Exports: shapes, strict validation, the resolver host and resolution, frame
 * resolution and generation-qualified correspondence. The bounded current-domain
 * read adapters are retired with the current source; the live unit-backed read
 * context and resolvers are the explicit `./unit-resolution` subpath.
 * Runtime-safe: no editor, renderer, Svelte or Three import reaches this module,
 * so a visitor runtime and an editor adapter resolve the same identity through
 * the same code.
 */

export * from './types';
export * from './validate';
export * from './resolve';
