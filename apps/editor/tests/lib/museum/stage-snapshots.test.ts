/**
 * R217.S28 — the snapshot service is derived render state: deduplicated by exact
 * pose and accepted source revision, bounded, and invalidated when the scene or a
 * renderer changes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	clearStageSnapshotCache,
	invalidateStageSnapshots,
	registerStageSnapshotRenderer,
	requestStageSnapshot,
	snapshotKey
} from '../../../src/lib/authoring/stage/stage-snapshots';

const request = {
	viewId: 'view-1',
	sourceRevision: 'rev-1',
	pose: { eye: [1, 2, 3], target: [0, 1, 0], fovDegrees: 54 } as const,
	aspect: 16 / 10
};

afterEach(() => {
	registerStageSnapshotRenderer(null);
	clearStageSnapshotCache();
});

describe('R217.S28 — Stage snapshots', () => {
	it('renders once per exact pose and source revision, ignoring the View id', async () => {
		const render = vi.fn(async () => 'data:image/png;base64,one');
		registerStageSnapshotRenderer(render);
		const [first, second] = await Promise.all([requestStageSnapshot(request), requestStageSnapshot({ ...request, viewId: 'view-2' })]);
		expect(first).toBe('data:image/png;base64,one');
		expect(second).toBe(first);
		expect(render).toHaveBeenCalledTimes(1);
		expect(snapshotKey(request)).toBe(snapshotKey({ ...request, viewId: 'view-2' }));
		expect(snapshotKey(request)).not.toBe(
			snapshotKey({ ...request, pose: { ...request.pose, eye: [1, 2, 3.0000001] } })
		);
		await requestStageSnapshot({ ...request, pose: { ...request.pose, eye: [1, 2, 3.001] } });
		expect(render).toHaveBeenCalledTimes(2);
	});

	it('invalidates cached images when the host is torn down or replaced', async () => {
		const first = vi.fn(async () => 'data:image/png;base64,first');
		const unregister = registerStageSnapshotRenderer(first);
		expect(await requestStageSnapshot(request)).toBe('data:image/png;base64,first');
		unregister();
		expect(await requestStageSnapshot(request)).toBeNull();

		const second = vi.fn(async () => 'data:image/png;base64,second');
		registerStageSnapshotRenderer(second);
		expect(await requestStageSnapshot(request)).toBe('data:image/png;base64,second');
		expect(first).toHaveBeenCalledTimes(1);
	});

	it('skips obsolete queued renders after invalidation', async () => {
		let release = (_url: string): void => {};
		const render = vi.fn(() => new Promise<string | null>((resolve) => { release = resolve; }));
		registerStageSnapshotRenderer(render);
		const stale = requestStageSnapshot(request);
		const queued = requestStageSnapshot({ ...request, pose: { ...request.pose, target: [1, 2, 3] } });
		invalidateStageSnapshots();
		release('data:image/png;base64,stale');
		expect(await stale).toBeNull();
		expect(await queued).toBeNull();
		// Both requests were invalidated before the queued microtask ran.
		expect(render).toHaveBeenCalledTimes(0);
	});

	it('invalidates by generation when geometry becomes renderable', async () => {
		const render = vi.fn(async () => 'data:image/png;base64,one');
		registerStageSnapshotRenderer(render);
		await requestStageSnapshot(request);
		invalidateStageSnapshots();
		await requestStageSnapshot(request);
		expect(render).toHaveBeenCalledTimes(2);
		expect(snapshotKey(request)).toContain('rev-1');
	});

	it('serializes different poses through the one shared render target', async () => {
		let active = 0;
		let peak = 0;
		const render = vi.fn(async () => {
			active += 1;
			peak = Math.max(peak, active);
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
			active -= 1;
			return 'data:image/png;base64,serialized';
		});
		registerStageSnapshotRenderer(render);
		const [first, second] = await Promise.all([
			requestStageSnapshot({ ...request, viewId: 'view-a' }),
			requestStageSnapshot({ ...request, viewId: 'view-b', pose: { ...request.pose, target: [1, 2, 3] } })
		]);
		expect(first).toBe('data:image/png;base64,serialized');
		expect(second).toBe(first);
		expect(render).toHaveBeenCalledTimes(2);
		expect(peak).toBe(1);
	});

	it('resolves null when no renderer is registered or a render fails', async () => {
		expect(await requestStageSnapshot(request)).toBeNull();
		registerStageSnapshotRenderer(async () => null);
		expect(await requestStageSnapshot(request)).toBeNull();
		registerStageSnapshotRenderer(async () => {
			throw new Error('readback failed');
		});
		expect(await requestStageSnapshot({ ...request, viewId: 'view-2' })).toBeNull();
	});
});
