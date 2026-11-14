/**
 * F.4 `intent-acceptance` — the shared acceptance contract, reader and planner
 * dispatch.
 *
 * Exports: the AM-4 shapes (`AuthoringIntent@1`, `AcceptedSnapshot@1`,
 * `AcceptanceResult@1`, correspondence and change records), the strict intent
 * reader and scope classifier, and the planner registry with the pure
 * `prepareIntent` dispatch.
 *
 * The `local-single-domain-v1` admission is retired. The live source is the F.2 envelope, and its admission
 * adapter, registry profile and preparation seam are the explicit `./units`
 * entry, so this barrel stays free of the F.2 import closure the public route
 * must not include.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import. The editor-only
 * coordinator and its bounded history are **not** here: they are
 * `apps/editor/src/lib/authoring/f4/**`.
 */

export * from './types';
export * from './intent';
export * from './prepare';
export { immutableF4Data, freezeF4Data } from './immutable';
// The additive `unit-acceptance-v1` extension is deliberately NOT in
// this barrel: it reads the F.2 unit shapes, and the root barrel's import closure
// stays free of the F.2 entries. It is the explicit
// `@portfolio/project-model/f4/unit-acceptance` subpath instead.
