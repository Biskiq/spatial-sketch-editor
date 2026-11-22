// @vitest-environment jsdom
/** The mounted shell hands a host's texture Retry to Walls, Rooms and Regions once. */
import { expect, it, vi } from 'vitest';

const spies = vi.hoisted(() => ({ walls: vi.fn(), rooms: vi.fn(), regions: vi.fn() }));
const representation = vi.hoisted(() => (reloadTextures?: () => void) => () => ({
	object3d: {},
	reloadTextures,
	update: () => false,
	setHidden() {},
	setCutaway: () => false,
	setTreatment: () => false,
	setScene: () => false,
	setLifted: () => false,
	objectOf: () => null,
	meshes: () => [],
	dispose() {}
}));
vi.mock('$lib/render/layout-wall-representation', () => ({ createWallRepresentation: representation(spies.walls) }));
vi.mock('$lib/render/layout-room-representation', () => ({ createRoomRepresentation: representation(spies.rooms) }));
vi.mock('$lib/render/layout-region-representation', () => ({ createRegionRepresentation: representation(spies.regions) }));
vi.mock('$lib/render/layout-object-representation', () => ({ createObjectRepresentation: representation() }));
vi.mock('$lib/render/resources/render-resources', () => ({ useRenderResources: () => ({}) }));
vi.mock('$lib/render/renderer-context', () => ({ tryUseCanvasRendererState: () => null }));
vi.mock('@threlte/core', () => ({
	T: Object.assign(() => {}, { Group: () => {} }),
	useThrelte: () => ({ invalidate() {} })
}));
vi.mock('$lib/render/layout/RoomPortal.svelte', () => ({ default: () => {} }));
vi.mock('$lib/render/layout/GroundPlinth.svelte', () => ({ default: () => {} }));

import { flushSync, mount, unmount } from 'svelte';
import { fromStore, writable } from 'svelte/store';
import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
import VisitorLayoutShell from '$lib/visitor/VisitorLayoutShell.svelte';

it('reloads once per Retry, and neither on mount nor on a compile', async () => {
	const compiled = () => ({ floors: [], walls: [] }) as unknown as CompiledLayoutGeometry;
	const geometry = writable(compiled());
	const revision = writable(0);
	const currentGeometry = fromStore(geometry);
	const currentRevision = fromStore(revision);
	const shell = mount(VisitorLayoutShell, {
		target: document.createElement('div'),
		props: {
			get geometry() {
				return currentGeometry.current;
			},
			get textureRevision() {
				return currentRevision.current;
			}
		}
	});
	flushSync();
	const calls = () => [spies.walls, spies.rooms, spies.regions].map((spy) => spy.mock.calls.length);
	expect(calls()).toEqual([0, 0, 0]);
	for (const next of [1, 2]) {
		revision.set(next);
		flushSync();
		expect(calls()).toEqual([next, next, next]);
	}
	geometry.set(compiled());
	flushSync();
	expect(calls()).toEqual([2, 2, 2]);
	await unmount(shell);
});
