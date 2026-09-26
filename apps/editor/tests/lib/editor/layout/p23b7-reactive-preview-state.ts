/**
 * P23B.7 S6 / P23B.6 S-R — a test harness that gives a test the same outer
 * preview `$state` graph the editor runs on, including S-R's raw geometry/model
 * field accessors.
 *
 * WHY THIS EXISTS. `EditorApp.svelte` holds the preview as
 * `$state(createEmptyWallFirstLayoutPreviewState())`. Ordinary Node tests use
 * SSR transforms, where `$state(...)` collapses to the raw object and cannot
 * exercise the client proxy boundary. Wrapping the preview root with the client
 * runtime recreates that boundary: the root is a proxy, while S-R's accessor
 * fields keep compiled geometry and its projected model raw. This proves that
 * consumers retain reactivity without changing cache keys.
 *
 * WHY IT CALLS THE CLIENT RUNTIME DIRECTLY. Vitest runs this suite with
 * `environment: 'node'`, whose transform mode is SSR, so `vite-plugin-svelte`
 * compiles `.svelte.ts` modules with `generate: 'server'` and `$state(x)`
 * collapses to the raw value — a `$state(...)` harness built the editor's way
 * silently degrades to a plain state here. `$.proxy(x)` is the function a CLIENT
 * compile emits for a plain-object `$state(x)` root (verified against Svelte
 * 5.56.4's `compileModule`/`compile` output), so this recreates that root
 * construction, not an approximation of it.
 *
 * `svelte/internal/client` is private API, which is why this file is a plain
 * `.ts` test helper (the Svelte compiler rejects the import inside any module it
 * compiles) and why nothing in `src/` uses it.
 */
import { proxy } from 'svelte/internal/client';

import { createEmptyLayoutPreviewState, type LayoutPreviewState } from '$lib/editor/layout/layout-preview-state.svelte';

/** The editor's own preview state, on the client runtime's reactive graph. */
export function createReactiveLayoutPreviewState(): LayoutPreviewState {
	return proxy(createEmptyLayoutPreviewState()) as LayoutPreviewState;
}

/**
 * Is this value a Svelte state proxy? The same detector the P23B measurement
 * step's identity pin used: `structuredClone` throws a `DataCloneError` for the
 * proxy exotic object and succeeds for the plain object behind it. It reports
 * `false` for a state produced by an SSR-compiled `$state(...)`, which is the
 * property that makes this harness's own precondition testable.
 */
export function isSvelteStateProxy(value: unknown): boolean {
	try {
		structuredClone(value);
		return false;
	} catch {
		return true;
	}
}
