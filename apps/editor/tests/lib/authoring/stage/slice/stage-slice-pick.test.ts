/**
 * SL1 — the Stage's hit path never lands on a body the cut hides.
 *
 * The source's filter is proved on its own in `scene-pick-hidden`; this proves
 * the wire: one wrapped pick reads the live reading, so arming a Slice and
 * putting it back change what a click selects without re-creating the facade.
 */
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { pickThroughSlice } from '$lib/authoring/stage/slice/stage-slice-pick';
import { resolveSlice, type ResolvedSlice } from '$lib/authoring/stage/slice/slice-cut';

import { compileWallFirstLayoutGeometryFresh, createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import { buildRegionMeshGeometry } from '$lib/render/layout/region-mesh-builder';
import { tagRenderIdentity } from '$lib/render/render-identity';

function stage() {
	const source = createScenePickSource();
	const data = { entities: [{ id: 'high' }, { id: 'low' }] } as never;
	const geometry = new BoxGeometry(1, 1, 1);
	const material = new MeshBasicMaterial();
	// The upper body spans 1.5–2.5 m, the lower one −0.1–0.9 m: a cut at 1.2 m
	// separates them with room to spare, and the ray meets the upper one first.
	const high = new Mesh(geometry, material);
	high.position.set(0, 2, 0);
	const low = new Mesh(geometry, material);
	low.position.set(0, 0.4, 0);
	source.register('high', high);
	source.register('low', low);
	source.setSource(data);
	return {
		source,
		data,
		dispose: () => {
			geometry.dispose();
			material.dispose();
		}
	};
}

const RAY = { origin: [0, 5, 0] as [number, number, number], direction: [0, -1, 0] as [number, number, number] };
const TO_FLOOR: ResolvedSlice = { kind: 'level', cutY: 1.2, lowerY: null };

describe('the Stage pick through a Slice', () => {
	it('selects the nearest body as today with no Slice on', () => {
		const { source, data, dispose } = stage();
		const pick = pickThroughSlice(source, () => null);
		// No reading at all: the ray's nearest hit, unchanged from the unwrapped pick.
		expect(pick(RAY, data)?.entityId).toBe('high');
		expect(source.pick(RAY, data)?.entityId).toBe('high');
		dispose();
	});

	it('skips a body above the cut and takes the one below it', () => {
		const { source, data, dispose } = stage();
		let resolved: ResolvedSlice | null = null;
		const pick = pickThroughSlice(source, () => resolved);
		resolved = TO_FLOOR;

		const hit = pick(RAY, data);
		expect(hit?.entityId).toBe('low');
		// The point is the visible surface, not the hidden one the ray met first.
		expect(hit?.worldPoint[1]).toBeLessThan(1.2);

		// The same wrapped pick follows a put back: nothing is hidden again.
		resolved = null;
		expect(pick(RAY, data)?.entityId).toBe('high');
		dispose();
	});

	it('skips the lower hidden piece as well, and reports no hit when nothing is shown', () => {
		const { source, data, dispose } = stage();
		let resolved: ResolvedSlice = TO_FLOOR;
		const pick = pickThroughSlice(source, () => resolved);
		// A band of 1.2 → 0.6 keeps the lower body's surface at 0.9 m.
		resolved = { kind: 'level', cutY: 1.2, lowerY: 0.6 };
		expect(pick(RAY, data)?.entityId).toBe('low');

		// A band that starts above it hides both: the click lands on nothing rather
		// than on the nearer of two invisible bodies.
		resolved = { kind: 'level', cutY: 1.2, lowerY: 0.95 };
		expect(pick(RAY, data)).toBeNull();
		dispose();
	});

	it('picks the slab over a coincident floor and follows Level and finite Drawn cap identity', () => {
		const document = createEmptyWallFirstLayoutDocument();
		document.regions = [{
			id: 'terrace', role: 'floor', elevation: 0, thickness: 0.4,
			form: { kind: 'flat' }, intendedGaps: [],
			footprint: { kind: 'polygon', points: [[-1, -1], [1, -1], [1, 1], [-1, 1]] }
		}];
		const { geometry } = compileWallFirstLayoutGeometryFresh(document);
		const source = createScenePickSource();
		const data = { entities: [] } as never;
		const root = new Group();
		const material = new MeshBasicMaterial();
		const floor = new Mesh(new PlaneGeometry(4, 4), material);
		floor.rotateX(-Math.PI / 2);
		tagRenderIdentity(floor, 'floor', 'room-floor');
		const slab = new Mesh(buildRegionMeshGeometry(geometry.regions[0]!), [material, material]);
		tagRenderIdentity(slab, 'region', 'terrace');
		root.add(floor, slab);
		source.registerLayout(root);
		source.registerLayoutIdentity({ objectOf: () => slab, regionMeshes: () => [slab] });
		source.setSource(data);
		let resolved: ResolvedSlice | null = null;
		const pick = pickThroughSlice(source, () => resolved);
		expect(pick(RAY, data)?.region).toEqual({ regionId: 'terrace', surface: 'top' });
		resolved = { kind: 'level', cutY: 0, lowerY: null };
		expect(pick(RAY, data)?.region?.surface).toBe('top');
		resolved = { kind: 'level', cutY: -0.2, lowerY: null };
		const levelHit = pick(RAY, data);
		expect(levelHit?.region).toEqual({ regionId: 'terrace', surface: 'edge' });
		expect(levelHit?.worldPoint[1]).toBeCloseTo(-0.2001, 8);

		resolved = resolveSlice({
			kind: 'drawn', start: [-0.5, 0], end: [0.5, 0], hidden: 'right', depthMeters: 0.5
		}, { sheetHeight: 1.2, datumMeters: 0 });
		const drawnRay = { origin: [0, -0.2, 2], direction: [0, 0, -1] } satisfies import('@portfolio/camera-core').PointerRay;
		const drawnHit = pick(drawnRay, data);
		expect(drawnHit?.region).toEqual({ regionId: 'terrace', surface: 'edge' });
		expect(drawnHit?.worldPoint[2]).toBeCloseTo(-0.0001, 8);
		expect(pick({ ...drawnRay, origin: [0.8, -0.2, 2] }, data)?.worldPoint[2]).toBe(1);
		floor.geometry.dispose();
		slab.geometry.dispose();
		material.dispose();
	});

});
