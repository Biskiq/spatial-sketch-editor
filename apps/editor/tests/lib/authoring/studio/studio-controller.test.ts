import { describe, expect, it, vi } from 'vitest';
import {
	createStudioController,
	type StudioBounds,
	type StudioPorts
} from '../../../../src/lib/authoring/studio/studio-controller.svelte';
import type { StudioEntityRead, StudioPickScope, StudioViewRecord } from '../../../../src/lib/authoring/studio/studio-model';

const VIEW: StudioViewRecord = { reading: '3d', eye: [6, 5, 6], target: [0, 1, 0], fovYDegrees: 45, targetPlaneHeightMeters: 2 };
const BOX: StudioBounds = { min: [-1, 0, -1], max: [1, 2, 1] };
const form = (id: string): StudioEntityRead => ({ id, name: `Form ${id}`, kind: 'form' });

function harness(initial: StudioEntityRead[], over: Partial<StudioPorts> = {}) {
	const state = {
		entities: initial,
		selected: null as string | null,
		scope: null as StudioPickScope | null,
		url: undefined as { objectId: string | null } | null | undefined,
		mounted: true,
		pending: true,
		index: false
	};
	const calls = {
		fit: vi.fn(), fitAll: vi.fn(), restore: vi.fn(() => true), arm: vi.fn(), closeCreation: vi.fn(),
		notice: vi.fn(), navigate: vi.fn(), focus: vi.fn()
	};
	const ports: StudioPorts = {
		entities: () => state.entities,
		selectedEntityId: () => state.selected,
		select: (id) => { state.selected = id; return true; },
		setScope: (scope) => { state.scope = scope; },
		captureView: () => VIEW,
		restoreView: calls.restore,
		rootBounds: () => (state.mounted ? BOX : null),
		fit: (bounds) => { calls.fit(bounds); return true; },
		contentBounds: () => BOX,
		fitAll: calls.fitAll,
		armCreation: calls.arm,
		closeCreation: calls.closeCreation,
		settlePending: () => state.pending,
		notice: calls.notice,
		syncUrl: (next) => { state.url = next; },
		navigate: calls.navigate,
		focusReturn: calls.focus,
		indexOpen: () => state.index,
		setIndexOpen: (open) => { state.index = open; },
		...over
	};
	return { studio: createStudioController(ports), state, calls };
}

describe('world entry and return', () => {
	it('scopes the form, frames it and restores the view, selection and focus on return', () => {
		const { studio, state, calls } = harness([form('a'), form('b')]);
		state.selected = 'b';
		state.index = true;
		expect(studio.enterFromWorld('b', 'card-edit')).toBe(true);
		expect(studio.phase).toEqual({ kind: 'active', rootId: 'b' });
		expect(state.scope).toEqual({ entityId: 'b' });
		expect(state.url).toEqual({ objectId: 'b' });
		expect(calls.fit).toHaveBeenCalledWith(BOX);
		state.index = false;
		expect(studio.backToWorld()).toBe(true);
		expect(studio.active).toBe(false);
		expect(state.scope).toBeNull();
		expect(state.url).toBeNull();
		expect(calls.restore).toHaveBeenCalledWith(VIEW);
		expect(state.selected).toBe('b');
		expect(state.index).toBe(true);
		expect(calls.focus).toHaveBeenCalledWith('card-edit');
	});
	it('falls back to Fit with a notice when the saved view no longer looks at the work', () => {
		const { studio, calls } = harness([form('a')], { contentBounds: () => ({ min: [900, 0, 900], max: [901, 1, 901] }) });
		studio.enterFromWorld('a', null);
		studio.backToWorld();
		expect(calls.restore).not.toHaveBeenCalled();
		expect(calls.fitAll).toHaveBeenCalled();
		expect(calls.notice).toHaveBeenCalled();
	});
	it('does not restore a selection whose entity is gone', () => {
		const { studio, state } = harness([form('a')]);
		studio.enterFromWorld('a', null);
		state.entities = [];
		studio.reconcile();
		expect(studio.phase.kind).toBe('unavailable');
		studio.backToWorld();
		expect(state.selected).toBeNull();
	});
	it('refuses a non-form and stays inactive', () => {
		const { studio, calls } = harness([{ id: 'm', name: 'M', kind: 'model' }]);
		expect(studio.enterFromWorld('m', null)).toBe(false);
		expect(studio.active).toBe(false);
		expect(calls.notice).toHaveBeenCalled();
	});
	it('blocks the exit while pending input cannot be settled', () => {
		const { studio, state } = harness([form('a')]);
		studio.enterFromWorld('a', null);
		state.pending = false;
		expect(studio.backToWorld()).toBe(false);
		expect(studio.active).toBe(true);
	});
});

describe('standalone entry', () => {
	it('opens a minted project on an empty mat with Objects ready', () => {
		const { studio, state, calls } = harness([]);
		studio.openFromEntry({ objectId: null, minted: true });
		expect(studio.phase.kind).toBe('empty');
		expect(state.scope).toEqual({ entityId: null });
		expect(calls.arm).toHaveBeenCalled();
	});
	it('makes the first accepted form the root', () => {
		const { studio, state } = harness([]);
		studio.openFromEntry({ objectId: null, minted: true });
		state.entities = [form('n1')];
		studio.reconcile();
		expect(studio.phase).toEqual({ kind: 'active', rootId: 'n1' });
		expect(state.selected).toBe('n1');
	});
	it('names an unavailable explicit root and requalifies it when Undo restores it', () => {
		const { studio, state } = harness([form('a')]);
		studio.openFromEntry({ objectId: 'gone', minted: false });
		expect(studio.phase).toMatchObject({ kind: 'unavailable', requestedId: 'gone' });
		expect(state.scope).toEqual({ entityId: null });
		state.entities = [form('a'), form('gone')];
		studio.reconcile();
		expect(studio.phase).toEqual({ kind: 'active', rootId: 'gone' });
	});
	it('offers the chooser for several roots and Back to Projects goes through navigate', () => {
		const { studio, calls } = harness([form('a'), form('b')]);
		studio.openFromEntry({ objectId: null, minted: false });
		expect(studio.phase.kind).toBe('choose');
		studio.chooseRoot('b');
		expect(studio.rootId).toBe('b');
		studio.backToProjects();
		expect(calls.navigate).toHaveBeenCalledWith('/projects');
	});
	it('Open in World leaves the posture, keeps the root selected and adds no object', () => {
		const { studio, state } = harness([form('a')]);
		studio.openFromEntry({ objectId: null, minted: false });
		expect(studio.openInWorld()).toBe(true);
		expect(studio.active).toBe(false);
		expect(state.selected).toBe('a');
		expect(state.entities).toHaveLength(1);
	});
});

describe('root management', () => {
	it('New object here empties the scope, and cancelling recovers the previous root', () => {
		const { studio, state, calls } = harness([form('a')]);
		studio.openFromEntry({ objectId: null, minted: false });
		studio.newObjectHere();
		expect(studio.phase.kind).toBe('empty');
		expect(state.scope).toEqual({ entityId: null });
		expect(studio.creating).toBe(true);
		studio.cancelCreation();
		expect(studio.phase).toEqual({ kind: 'active', rootId: 'a' });
		expect(studio.creating).toBe(false);
		expect(calls.closeCreation).toHaveBeenCalled();
	});
	it('New object here adopts the created form, not the earlier one', () => {
		const { studio, state } = harness([form('a')]);
		studio.openFromEntry({ objectId: null, minted: false });
		studio.newObjectHere();
		state.entities = [form('a'), form('b')];
		studio.reconcile();
		expect(studio.phase).toEqual({ kind: 'active', rootId: 'b' });
	});
	it('Undo of a creation leaves a named unavailable state, not a stale scope', () => {
		const { studio, state } = harness([form('a')]);
		studio.openFromEntry({ objectId: null, minted: false });
		state.entities = [];
		studio.reconcile();
		expect(studio.phase).toMatchObject({ kind: 'unavailable', lost: true });
		expect(state.scope).toEqual({ entityId: null });
	});
	it('retries a frame that waited for the body to mount', () => {
		const { studio, state, calls } = harness([form('a')]);
		state.mounted = false;
		studio.openFromEntry({ objectId: null, minted: false });
		expect(calls.fit).not.toHaveBeenCalled();
		state.mounted = true;
		studio.retryFrame();
		expect(calls.fit).toHaveBeenCalledTimes(1);
	});
});

describe('forms added from inside Studio', () => {
	it('follows a form placed (or duplicated) while a root is scoped', () => {
		const { studio, state, calls } = harness([form('a')]);
		studio.openFromEntry({ objectId: null, minted: false });
		state.entities = [form('a'), form('copy')];
		studio.reconcile();
		expect(studio.phase).toEqual({ kind: 'active', rootId: 'copy' });
		expect(state.selected).toBe('copy');
		expect(calls.closeCreation).toHaveBeenCalled();
	});
	it('leaves an unchanged project alone on every reconcile', () => {
		const { studio, calls } = harness([form('a')]);
		studio.openFromEntry({ objectId: null, minted: false });
		calls.fit.mockClear();
		studio.reconcile();
		studio.reconcile();
		expect(studio.phase).toEqual({ kind: 'active', rootId: 'a' });
		expect(calls.fit).not.toHaveBeenCalled();
	});
});

describe('pending work at the boundaries', () => {
	it('refuses to enter Studio from the World while a gesture cannot settle, and stays in the World', () => {
		const { studio, state, calls } = harness([form('a')]);
		state.pending = false;
		expect(studio.enterFromWorld('a', 'card-edit')).toBe(false);
		expect(studio.active).toBe(false);
		expect(state.scope).toBeNull();
		expect(calls.fit).not.toHaveBeenCalled();
	});
	it('leaves for another lens only when pending work settles, then ends the posture without moving the view', () => {
		const { studio, state, calls } = harness([form('a')]);
		studio.enterFromWorld('a', null);
		state.pending = false;
		expect(studio.leaveForLens()).toBe(false);
		expect(studio.active).toBe(true);
		state.pending = true;
		expect(studio.leaveForLens()).toBe(true);
		expect(studio.active).toBe(false);
		expect(state.scope).toBeNull();
		expect(calls.restore).not.toHaveBeenCalled();
	});
	it('is a no-op success when Studio is not active', () => {
		const { studio } = harness([form('a')]);
		expect(studio.leaveForLens()).toBe(true);
	});
});

describe('place copy in World', () => {
	it('settles first, sends the active root once, and ignores a second press while saving', async () => {
		let release: (value: boolean) => void = () => {};
		const placeCopy = vi.fn(() => new Promise<boolean>((resolve) => { release = resolve; }));
		const { studio, state } = harness([form('a')], { placeCopy });
		studio.openFromEntry({ objectId: 'a', minted: false });
		state.pending = false;
		expect(await studio.placeCopyInWorld()).toBe(false);
		expect(placeCopy).not.toHaveBeenCalled();
		state.pending = true;
		const first = studio.placeCopyInWorld();
		expect(studio.placingCopy).toBe(true);
		expect(await studio.placeCopyInWorld()).toBe(false);
		release(true);
		expect(await first).toBe(true);
		expect(placeCopy).toHaveBeenCalledTimes(1);
		expect(placeCopy).toHaveBeenCalledWith('a');
		expect(studio.placingCopy).toBe(false);
	});
	it('clears the busy state when the journey fails, so the creator can retry', async () => {
		const placeCopy = vi.fn(async () => false);
		const { studio } = harness([form('a')], { placeCopy });
		studio.openFromEntry({ objectId: 'a', minted: false });
		expect(await studio.placeCopyInWorld()).toBe(false);
		expect(studio.placingCopy).toBe(false);
		expect(await studio.placeCopyInWorld()).toBe(false);
		expect(placeCopy).toHaveBeenCalledTimes(2);
	});
	it('does nothing without an active root', async () => {
		const placeCopy = vi.fn(async () => true);
		const { studio } = harness([], { placeCopy });
		expect(await studio.placeCopyInWorld()).toBe(false);
		expect(placeCopy).not.toHaveBeenCalled();
	});
});
