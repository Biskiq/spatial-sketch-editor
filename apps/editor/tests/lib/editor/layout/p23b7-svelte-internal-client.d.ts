/**
 * P23B.7 S6 — test-only client runtime access for the state proxy and a small
 * effect-root harness. Nothing in `src/` may import these private APIs.
 *
 * `svelte/internal/*` ships no types because it is private API, and the Svelte
 * compiler rejects importing the module from any `.svelte.ts` source, so test
 * imports live in plain `.ts` files and are declared here.
 *
 * `$state` parameterizes the raw value's type on assignment via `$state<T>()`; the
 * editor's own calls pass an already-typed object, so the runtime returns that
 * same type here.
 */
declare module 'svelte/internal/client' {
	export function proxy<T>(value: T): T;
	export function effect_root(fn: () => void | (() => void)): () => void;
	export function render_effect(fn: () => void | (() => void), flags?: number): unknown;
	export function flush<T = void>(fn?: () => T): T;
}
