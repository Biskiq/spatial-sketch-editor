/**
 * TEST-ONLY sentinel: STAGE_BROWSER_CONFORMANCE_PROBE_STATE. No production import.
 *
 * The probe's adapter-owned instrument has no props of its own, so the two facts a
 * browser run needs to read — what the last operation returned and what the Stage
 * echoed through `selectionChanged` — are published here. It is a plain store, not
 * a second Stage authority: every value is written from a callback the facade
 * invoked (`selectionChanged`) or from the response the public port returned.
 */
import { writable } from 'svelte/store';

export type ProbeState = {
	readonly lastResult: string;
	/** Ordered canonical subject ids from the session's one selection value. */
	readonly ordered: readonly string[];
	readonly primary: string | null;
	readonly selectionChanges: number;
	readonly entityId: string | null;
	readonly receiveShadow: boolean | null;
};

export const probeState = writable<ProbeState>({
	lastResult: 'Ready',
	ordered: [],
	primary: null,
	selectionChanges: 0,
	entityId: null,
	receiveShadow: null
});

/** Publish on a microtask: the facade can call back inside a derived read. */
export function publishProbe(patch: Partial<ProbeState>): void {
	queueMicrotask(() => probeState.update((current) => ({ ...current, ...patch })));
}

/** Record one `selectionChanged` delivery from the Stage. */
export function recordSelectionEcho(ordered: readonly string[], primary: string | null): void {
	queueMicrotask(() => probeState.update((current) => ({
		...current, selectionChanges: current.selectionChanges + 1, ordered, primary
	})));
}

export function setResult(lastResult: string): void {
	probeState.update((current) => ({ ...current, lastResult }));
}
