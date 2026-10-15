/**
 * F.1 `references-v1` — the shared reference/resolution provider (AM-1).
 *
 * Exports: shapes, strict validation, the resolver host and resolution, the
 * bounded current-domain read adapters (actual Layout/Scene/read-only current
 * Camera subjects), frame resolution and generation-qualified correspondence.
 * Runtime-safe: no editor, renderer, Svelte or Three import reaches this module,
 * so a visitor runtime and an editor adapter resolve the same identity through
 * the same code.
 */

export * from './types';
export * from './validate';
export * from './resolve';
export * from './read-adapter';
