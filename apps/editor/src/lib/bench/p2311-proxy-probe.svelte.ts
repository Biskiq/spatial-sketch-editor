/**
 * P23.11 diagnostic probe — the reactive-wrapper half of the Bend
 * investigation.
 *
 * `EditorApp.svelte` and `MuseumEditorApp.svelte` hold the preview state as
 * `$state(createEmptyWallFirstLayoutPreviewState())`. The root and authored
 * `project.layout` remain deeply reactive; P23B.6 S-R keeps the wholesale-
 * replaced `geometry` and projected `model` raw behind field-level state
 * signals. This probe compares the real wrapped root with a plain graph when
 * measuring authored traversal and derived mesh work.
 *
 * Dev/test-only: nothing in the editor imports this module; the P23.11
 * diagnosis suite is its only consumer.
 */

/**
 * `$state(...)` is only legal as a declaration initializer, so the wrapper is a
 * one-field class: the field's generated setter runs `$.set(source, value, true)`
 * (verified against Svelte 5.56.4's `compileModule` output and `state()`'s
 * `should_proxy` handling), which wraps the assigned plain-object root like the
 * editor's `$state(createEmptyWallFirstLayoutPreviewState())` does.
 */
class P2311StateBox<T extends object> {
	value = $state() as T;
}

/**
 * Wrap a value exactly the way the editor wraps the live preview state, so a
 * benchmark can run the shipped code against a proxied graph.
 */
export function p2311WrapState<T extends object>(value: T): T {
	const box = new P2311StateBox<T>();
	box.value = value;
	return box.value;
}

/**
 * Unwrap a `$state` graph to plain data — an independent raw graph with the same
 * content, used as the third data point when comparing traversal cost.
 */
export function p2311UnwrapState<T>(value: T): T {
	return $state.snapshot(value) as T;
}
