import { describe, expect, it, vi } from 'vitest';
import { runPlaceCopy, type PlaceCopyPorts } from '../../../../src/lib/authoring/studio/place-copy-journey';
import {
	createStudioController,
	type StudioPorts
} from '../../../../src/lib/authoring/studio/studio-controller.svelte';
import type { StudioEntityRead } from '../../../../src/lib/authoring/studio/studio-model';

type Entity = { id: string };
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => { resolve = r; });
	return { promise, resolve };
}

function journeyPorts(over: Partial<PlaceCopyPorts<Entity>> = {}) {
	const calls = { notice: vi.fn(), begin: vi.fn(), open: vi.fn(async () => {}) };
	const ports: PlaceCopyPorts<Entity> = {
		entity: (id) => (id === 'a' ? { id } : null),
		isDirty: () => false,
		saveFirst: async () => ({ kind: 'saved' }),
		saveToLibrary: async () => ({ kind: 'saved', itemId: 'item', name: 'Form a' }),
		beginTransfer: calls.begin,
		openChooser: calls.open,
		notice: calls.notice,
		...over
	};
	return { ports, calls };
}

describe('place copy journey', () => {
	it('saves, captures, records the way back and opens the chooser', async () => {
		const { ports, calls } = journeyPorts({ isDirty: () => true });
		expect(await runPlaceCopy('a', () => true, ports)).toBe('navigated');
		expect(calls.begin).toHaveBeenCalledWith('item', 'Form a');
		expect(calls.open).toHaveBeenCalledWith('item');
	});
	it('stops with the work intact when the project Save fails, sending nothing', async () => {
		const toLibrary = vi.fn();
		const { ports, calls } = journeyPorts({
			isDirty: () => true,
			saveFirst: async () => ({ kind: 'error', message: 'offline.' }),
			saveToLibrary: toLibrary
		});
		expect(await runPlaceCopy('a', () => true, ports)).toBe('failed');
		expect(toLibrary).not.toHaveBeenCalled();
		expect(calls.open).not.toHaveBeenCalled();
		expect(calls.notice.mock.calls[0]![0]).toContain('could not be saved: offline.');
	});
	it('keeps the saved project and says so when the library write fails', async () => {
		const { ports, calls } = journeyPorts({ saveToLibrary: async () => ({ kind: 'refused', message: 'Library full.' }) });
		expect(await runPlaceCopy('a', () => true, ports)).toBe('failed');
		expect(calls.open).not.toHaveBeenCalled();
		expect(calls.notice.mock.calls[0]![0]).toContain('The project is saved');
	});
	it('does not navigate when the creator moved on during a slow Save', async () => {
		const save = deferred<{ kind: string }>();
		let live = true;
		const toLibrary = vi.fn();
		const { ports, calls } = journeyPorts({ isDirty: () => true, saveFirst: () => save.promise, saveToLibrary: toLibrary });
		const run = runPlaceCopy('a', () => live, ports);
		live = false;
		save.resolve({ kind: 'saved' });
		expect(await run).toBe('stale');
		expect(toLibrary).not.toHaveBeenCalled();
		expect(calls.open).not.toHaveBeenCalled();
		expect(calls.notice).not.toHaveBeenCalled();
	});
	it('does not navigate on a delayed library success after the creator moved on', async () => {
		const write = deferred<{ kind: 'saved'; itemId: string; name: string }>();
		let live = true;
		const { ports, calls } = journeyPorts({ saveToLibrary: () => write.promise });
		const run = runPlaceCopy('a', () => live, ports);
		live = false;
		write.resolve({ kind: 'saved', itemId: 'item', name: 'Form a' });
		expect(await run).toBe('stale');
		expect(calls.begin).not.toHaveBeenCalled();
		expect(calls.open).not.toHaveBeenCalled();
	});
	it('stays silent on a delayed failure after the creator moved on', async () => {
		const write = deferred<{ kind: 'refused'; message: string }>();
		let live = true;
		const { ports, calls } = journeyPorts({ saveToLibrary: () => write.promise });
		const run = runPlaceCopy('a', () => live, ports);
		live = false;
		write.resolve({ kind: 'refused', message: 'Library full.' });
		expect(await run).toBe('stale');
		expect(calls.notice).not.toHaveBeenCalled();
	});
	it('reads the root again after the Save, and refuses a root that vanished', async () => {
		let present = true;
		const { ports, calls } = journeyPorts({
			isDirty: () => true,
			entity: (id) => (present && id === 'a' ? { id } : null),
			saveFirst: async () => { present = false; return { kind: 'saved' }; }
		});
		expect(await runPlaceCopy('a', () => true, ports)).toBe('failed');
		expect(calls.open).not.toHaveBeenCalled();
	});
});

describe('the controller drops a transfer when the posture changes', () => {
	const form = (id: string): StudioEntityRead => ({ id, name: `Form ${id}`, kind: 'form' });
	function harness(entities: StudioEntityRead[], placeCopy: StudioPorts['placeCopy']) {
		const state = { entities, selected: null as string | null };
		const calls = { navigate: vi.fn(), notice: vi.fn() };
		const ports: StudioPorts = {
			entities: () => state.entities,
			selectedEntityId: () => state.selected,
			select: (id) => { state.selected = id; return true; },
			setScope: () => {}, captureView: () => null, restoreView: () => true,
			rootBounds: () => null, fit: () => true, contentBounds: () => null, fitAll: () => {},
			armCreation: () => {}, closeCreation: () => {}, settlePending: () => true,
			notice: calls.notice, syncUrl: () => {}, navigate: calls.navigate, focusReturn: () => {},
			placeCopy
		};
		return { studio: createStudioController(ports), state, calls };
	}
	async function staleAfter(change: (h: ReturnType<typeof harness>) => void) {
		let current: () => boolean = () => true;
		const gate = deferred<boolean>();
		const h = harness([form('a'), form('b')], async (_root, isCurrent) => { current = isCurrent; return gate.promise; });
		h.studio.openFromEntry({ objectId: 'a', minted: false });
		const run = h.studio.placeCopyInWorld();
		expect(current()).toBe(true);
		expect(h.studio.placingCopy).toBe(true);
		change(h);
		const stale = !current();
		gate.resolve(true);
		await run;
		return { stale, h };
	}
	it('on Back to Projects, so a delayed success or failure cannot redirect the creator', async () => {
		for (const outcome of [true, false]) {
			let current: () => boolean = () => true;
			const gate = deferred<boolean>();
			const h = harness([form('a')], async (_root, isCurrent) => { current = isCurrent; return gate.promise; });
			h.studio.openFromEntry({ objectId: 'a', minted: false });
			const run = h.studio.placeCopyInWorld();
			expect(current()).toBe(true);
			h.studio.backToProjects();
			expect(h.calls.navigate).toHaveBeenCalledTimes(1);
			expect(h.calls.navigate).toHaveBeenCalledWith('/projects');
			expect(current()).toBe(false);
			expect(h.studio.placingCopy).toBe(false);
			gate.resolve(outcome);
			expect(await run).toBe(outcome);
			// The accepted navigation is the only one; a late result adds nothing.
			expect(h.calls.navigate).toHaveBeenCalledTimes(1);
			expect(h.calls.notice).not.toHaveBeenCalled();
		}
	});
	it('on a root switch', async () => {
		const { stale, h } = await staleAfter(({ studio }) => studio.chooseRoot('b'));
		expect(stale).toBe(true);
		expect(h.studio.placingCopy).toBe(false);
		expect(h.studio.rootId).toBe('b');
	});
	it('on leaving to the Experience lens', async () => {
		const { stale } = await staleAfter(({ studio }) => studio.leaveForLens());
		expect(stale).toBe(true);
	});
	it('on the chooser, a new object and Open in World', async () => {
		expect((await staleAfter(({ studio }) => studio.openChooser())).stale).toBe(true);
		expect((await staleAfter(({ studio }) => studio.newObjectHere())).stale).toBe(true);
		expect((await staleAfter(({ studio }) => studio.openInWorld())).stale).toBe(true);
	});
	it('when the root is removed under it', async () => {
		const { stale } = await staleAfter(({ studio, state }) => {
			state.entities = [form('b')];
			studio.reconcile();
		});
		expect(stale).toBe(true);
	});
	it('stays current across a same-root re-read, and a later transfer owns the busy flag', async () => {
		const gates: Array<ReturnType<typeof deferred<boolean>>> = [];
		const currents: Array<() => boolean> = [];
		const h = harness([form('a'), form('b')], async (_root, isCurrent) => {
			const gate = deferred<boolean>();
			gates.push(gate);
			currents.push(isCurrent);
			return gate.promise;
		});
		h.studio.openFromEntry({ objectId: 'a', minted: false });
		const first = h.studio.placeCopyInWorld();
		h.studio.reconcile();
		expect(currents[0]!()).toBe(true);
		h.studio.chooseRoot('b');
		expect(currents[0]!()).toBe(false);
		const second = h.studio.placeCopyInWorld();
		expect(h.studio.placingCopy).toBe(true);
		gates[0]!.resolve(false);
		await first;
		expect(h.studio.placingCopy).toBe(true);
		gates[1]!.resolve(false);
		await second;
		expect(h.studio.placingCopy).toBe(false);
	});
});
