/**
 * F.4 `intent-acceptance` — the shared acceptance contract, reader, planner
 * registry and current-source admission (T1.P01.S03's provider).
 *
 * Exports: the AM-4 shapes (`AuthoringIntent@1`, `AcceptedSnapshot@1`,
 * `AcceptanceResult@1`, correspondence and change records), the strict intent
 * reader and scope classifier, the single-domain planner registry with the pure
 * `prepareIntent` dispatch, and the current-source admission with its content
 * identity and source adapter.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import, so the same
 * validation and admission run in the editor and server-side (`T3.P01.S02`'s
 * shared validation). The editor-only coordinator and its 100-entry history are
 * **not** here: they are `apps/editor/src/lib/authoring/f4/**` and never enter a
 * package barrel the public route's module graph includes.
 *
 * There is no history, no installer and no Save here: this is the boundary
 * contract and its admission, and the coordinator that installs through it lives
 * in the editor.
 */

export * from './types';
export * from './intent';
export * from './prepare';
export * from './admission';
