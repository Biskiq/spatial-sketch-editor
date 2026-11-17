// @vitest-environment jsdom
/**
 * X2 §10.2 — stationary work, at the boundaries that own it.
 *
 * The real-WebGL lane already proves 120 stationary frames produce one image and
 * one program count. That does not prove the cap layer skipped its assembly, the
 * Wall representation skipped a material swap, or X2 asked for a frame. This test
 * mounts the real layer and drives the real representation with fresh-but-equal
 * arrays, so every assertion reads an existing ownership boundary:
 *
 * - `countWork('cutaway:cap-assembly')` is incremented only where the layer
 *   actually calls `assembleCutawayCaps`;
 * - `invalidate()` is the layer's only frame request;
 * - `setCutaway()` returns whether it swapped a Wall, and `stats()` reports
 *   distinct materials; the retained mesh identity is the no-buffer-rebuild
 *   proof.
 *
 * Threlte is mocked only for `T` and `useThrelte`; there is no Canvas in jsdom.
 * The cap assembly, geometry, SectionInputs and material representation are real.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import type { Mesh } from 'three';
import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	setWorkObserver,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { createWallRepresentation } from '$lib/render/layout-wall-representation';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';
import StageCutawayLayer from '$lib/authoring/stage/cutaway/StageCutawayLayer.svelte';
import { reactiveCell } from '../../__fixtures__/reactive-cell.svelte';

const threlte = vi.hoisted(() => ({ invalidate: vi.fn() }));
const clip = vi.hoisted(() => ({
	setCutawayTop: vi.fn(),
	clipInk: (material: unknown) => material
}));

vi.mock('@threlte/core', () => {
	const Noop = () => {};
	return { T: Noop, useThrelte: () => ({ invalidate: threlte.invalidate }) };
});

vi.mock('$lib/authoring/stage/slice/stage-clip', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/authoring/stage/slice/stage-clip')>()),
	useStageClip: () => clip
}));

type WallSeed = {
	readonly id: string;
	readonly start: readonly [string, LayoutVec2];
	readonly end: readonly [string, LayoutVec2];
};

function scene(walls: readonly WallSeed[]): LayoutDocumentWallFirst {
	const junctionById = new Map<string, LayoutVec2>();
	for (const wall of walls) {
		junctionById.set(wall.start[0], wall.start[1]);
		junctionById.set(wall.end[0], wall.end[1]);
	}
	return {
		units: 'meters',
		formatVersion: 8,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [...junctionById].map(([id, point]) => ({ id, point })),
		walls: walls.map(
			(wall): LayoutWall =>
				({
					id: wall.id,
					startJunctionId: wall.start[0],
					endJunctionId: wall.end[0],
					thickness: 0.2,
					height: 3,
					centerline: { kind: 'line' }
				}) as LayoutWall
		),
		rooms: [],
		openings: [],
		objects: []
	};
}

const layout = scene([{ id: 'w1', start: ['a', [0, 0]], end: ['b', [6, 0]] }]);
const compilation = compileWallFirstLayoutGeometry(layout);
const geometry = compilation.geometry;
const wall = geometry.walls[0]!;
const built = buildStandaloneWallMesh(
	wall,
	0,
	legJoinsByWall(geometry.junctions ?? []).get(wall.wallId) ?? { start: null, end: null }
);

let mounted: ReturnType<typeof mount> | null = null;
let restoreObserver: (() => void) | null = null;

afterEach(() => {
	if (mounted !== null) unmount(mounted);
	mounted = null;
	restoreObserver?.();
	restoreObserver = null;
	threlte.invalidate.mockClear();
	clip.setCutawayTop.mockClear();
	vi.restoreAllMocks();
});

describe('X2 stationary work', () => {
	it('a repeated cut set rebuilds no caps and asks for no frame', () => {
		expect(compilation.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
		expect(built.issues).toEqual([]);
		expect(built.mesh).toBeDefined();

		let capBuilds = 0;
		let rebuildChecks = 0;
		const previous = setWorkObserver({
			span() {},
			count(name) {
				if (name === 'cutaway:cap-assembly') capBuilds += 1;
				if (name === 'cutaway:rebuild-check') rebuildChecks += 1;
			}
		});
		restoreObserver = () => setWorkObserver(previous);

		// Real Svelte state, not a plain object: each set reruns the mounted
		// component's effect exactly as the host's own reactive props do.
		const wallIds = reactiveCell<readonly string[]>(['w1']);
		const revision = reactiveCell('r1');
		const issues: unknown[] = [];
		const failures: string[][] = [];
		mounted = mount(StageCutawayLayer, {
			target: document.createElement('div'),
			props: {
				get wallIds() {
					return wallIds.value;
				},
				stubTopY: 1,
				junctions: geometry.junctions ?? [],
				walls: geometry.walls,
				floors: [{ floorId: 'floor-1', elevation: 0 }],
				inputs: [
					{
						identity: `wall:${wall.wallId}`,
						positions: built.mesh!.positions,
						index: built.mesh!.indices
					}
				],
				get revision() {
					return revision.value;
				},
				width: 800,
				height: 600,
				onIssues: (next) => issues.push(...next),
				onFailure: (next) => failures.push([...next])
			}
		});
		flushSync();

		expect(capBuilds).toBe(1);
		expect(issues).toEqual([]);
		expect(failures).toEqual([]);
		expect(clip.setCutawayTop).toHaveBeenLastCalledWith(1);
		expect(threlte.invalidate).toHaveBeenCalledTimes(1);

		// Positive control: a reactive revision change must reach the component.
		capBuilds = 0;
		rebuildChecks = 0;
		threlte.invalidate.mockClear();
		clip.setCutawayTop.mockClear();
		revision.value = 'r2';
		flushSync();
		expect(rebuildChecks).toBe(1);
		expect(capBuilds).toBe(1);
		expect(threlte.invalidate).toHaveBeenCalledTimes(1);
		expect(clip.setCutawayTop).toHaveBeenLastCalledWith(1);

		// A fresh array with the same ids reruns the effect but moves no signature.
		capBuilds = 0;
		rebuildChecks = 0;
		threlte.invalidate.mockClear();
		clip.setCutawayTop.mockClear();
		for (let frame = 0; frame < 120; frame += 1) {
			wallIds.value = ['w1'];
			flushSync();
		}
		expect(rebuildChecks).toBe(120);
		expect(capBuilds).toBe(0);
		expect(threlte.invalidate).not.toHaveBeenCalled();
		expect(clip.setCutawayTop).not.toHaveBeenCalled();
	});

	it('a repeated cut set swaps no Wall material and rebuilds no buffer', () => {
		const store = createMaterialStore();
		const representation = createWallRepresentation(store);
		representation.update(geometry);
		const object = representation.objectOf('w1') as Mesh;
		expect(object).toBeTruthy();

		expect(representation.setCutaway(new Set(['w1']))).toBe(true);
		const material = object.material;
		const buffer = object.geometry;
		const stats = store.stats();

		for (let frame = 0; frame < 120; frame += 1) {
			expect(representation.setCutaway(new Set(['w1']))).toBe(false);
		}
		expect(store.stats()).toEqual(stats);
		expect(representation.update(geometry).built).toBe(0);
		expect(representation.objectOf('w1')).toBe(object);
		expect(object.material).toBe(material);
		expect(object.geometry).toBe(buffer);

		representation.dispose();
	});
});
