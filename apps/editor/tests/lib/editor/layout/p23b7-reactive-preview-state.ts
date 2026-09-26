/**
 * P23B.7 S6 — a test harness that gives a test the SAME preview state the editor
 * runs on: a Svelte `$state` graph.
 *
 * WHY THIS EXISTS. `EditorApp.svelte` holds the preview as
 * `$state(createEmptyWallFirstLayoutPreviewState())`, so every read of
 * `preview.geometry` in the running editor returns the proxy Svelte's client
 * runtime created for the compiled geometry — a DIFFERENT object identity from
 * the compile's own. `createEmptyLayoutPreviewState()` itself returns a plain
 * object, so an ordinary unit fixture runs the identical code on a raw graph and
 * takes the other branch of the mesh cache. That divergence is exactly what the
 * P23B measurement-only step pinned in the browser (install id 52 `proxy=NO`,
 * capture/restore id 53 `proxy=YES`), and a plain-object harness cannot
 * reproduce it — it has no proxy to disagree about.
 *
 * WHY IT CALLS THE CLIENT RUNTIME DIRECTLY. Vitest runs this suite with
 * `environment: 'node'`, whose transform mode is SSR, so `vite-plugin-svelte`
 * compiles `.svelte.ts` modules with `generate: 'server'` and `$state(x)`
 * collapses to the raw value — a `$state(...)` harness built the editor's way
 * silently degrades to a plain state here and cannot fail on a proxy-only defect
 * (the measurement step hit exactly this and recorded it as `notProvedHere`).
 * `$.proxy(x)` is the function a CLIENT compile emits for `$state(x)` in both
 * components and `.svelte.ts` modules (verified against Svelte 5.56.4's
 * `compileModule`/`compile` output), so wrapping the state with it is the
 * identical construction, not an approximation of it.
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
