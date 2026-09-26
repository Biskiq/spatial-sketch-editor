/**
 * P23B.7 S6 — the one client-runtime declaration `p23b7-reactive-preview-state.ts`
 * needs.
 *
 * `svelte/internal/*` ships no types because it is private API, and the Svelte
 * compiler rejects importing it from any module the compiler itself processes, so
 * the import lives in a plain test helper and is declared here — scoped to the
 * single function that helper calls, which is the same `$.proxy(...)` a client
 * compile emits for `$state(...)`. Nothing in `src/` may import it.
 *
 * `$state` parameterizes the raw value's type on assignment via `$state<T>()`; the
 * editor's own calls pass an already-typed object, so the runtime returns that
 * same type here.
 */
declare module 'svelte/internal/client' {
	export function proxy<T>(value: T): T;
}
