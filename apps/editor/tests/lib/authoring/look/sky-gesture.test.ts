import { afterEach, expect, it, vi } from 'vitest';
import { skyFromPreset } from '@portfolio/project-model/units';
import { createSkyGesture } from '$lib/authoring/look/sky-gesture.svelte';

function harness() {
	const sky = skyFromPreset('golden-hour', 135);
	let revision = { projectId: 'gallery', revisionId: '1' };
	let busy = false;
	let frame: FrameRequestCallback | undefined;
	vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
	vi.stubGlobal('cancelAnimationFrame', vi.fn(() => { frame = undefined; }));
	const preview = vi.fn();
	const update = vi.fn(async () => {});
	const gesture = createSkyGesture({ sky: () => sky, revision: () => revision, busy: () => busy, preview, update });
	return {
		sky, gesture, preview, update, flush() { const queued = frame; frame = undefined; queued?.(0); },
		drift() { revision = { ...revision, revisionId: '2' }; },
		block() { busy = true; }
	};
}

afterEach(() => vi.unstubAllGlobals());

it('coalesces previews and holds the last sample until one accepted write completes', async () => {
	const { gesture, flush, preview, update, sky } = harness();
	let accept = () => {};
	update.mockImplementationOnce(() => new Promise<void>((resolve) => { accept = resolve; }));
	expect(gesture.begin('time')).toBe(true);
	gesture.move('time', { time: 22 });
	gesture.move('time', { time: 23 });
	expect(preview).not.toHaveBeenCalled();
	flush();
	expect(preview).toHaveBeenCalledExactlyOnceWith({ ...sky, time: 23 });
	const commit = gesture.commit('time');
	expect(update).toHaveBeenCalledExactlyOnceWith({ time: 23 }, { projectId: 'gallery', revisionId: '1' });
	expect(preview).toHaveBeenLastCalledWith({ ...sky, time: 23 });
	await gesture.commit('time');
	accept();
	await commit;
	expect(update).toHaveBeenCalledOnce();
	expect(preview).toHaveBeenLastCalledWith(null);
});

it('drops canceled input, trailing changes, and stale releases without writing', async () => {
	const { gesture, drift, block, flush, update, preview } = harness();
	expect(gesture.begin('Sky colour')).toBe(true);
	gesture.move('Sky colour', { skyColor: '#123456' });
	flush();
	expect(gesture.cancel()).toBe(true);
	gesture.move('Sky colour', { skyColor: '#654321' });
	await gesture.commit('Sky colour');
	expect(preview).toHaveBeenLastCalledWith(null);
	expect(gesture.begin('compass')).toBe(true);
	gesture.move('compass', { heading: 180 });
	drift();
	await gesture.commit('compass');
	expect(gesture.owner).toBeNull();
	expect(update).not.toHaveBeenCalled();
	block();
	expect(gesture.begin('compass')).toBe(false);
});
