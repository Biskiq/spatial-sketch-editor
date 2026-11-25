import { describe, expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from 'three';
import { surfaceKey } from '@portfolio/layout-core/plan';
import { tagRenderIdentity } from '$lib/render/render-identity';
import { repairSurfaceGeometry } from '$lib/authoring/stage/shell/stage-selection-source';
import { repairSurfaceRef } from '$lib/authoring/look/appearance-issues.svelte';

function mesh(kind: 'wall' | 'floor' | 'lid' | 'region', id: string): Mesh {
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(27), 3));
	geometry.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
	return tagRenderIdentity(new Mesh(geometry, new MeshBasicMaterial()), kind, id);
}

describe('repair surface coverage', () => {
	it('decodes canonical JSON keys, including ids containing colons', () => {
		const surface = { kind: 'wall-side', wallId: 'wall:1', side: 'right' } as const;
		expect(repairSurfaceRef(`surface:${surfaceKey(surface)}`)).toEqual(surface);
		expect(repairSurfaceRef('surface:wall-side:wall:1:right')).toBeNull();
	});

	it('restricts a wall hatch to the selected side, excluding caps and the opposite side', () => {
		const wall = mesh('wall', 'wall:1');
		wall.geometry.userData.pickRanges = [
			{ kind: 'wall', segmentId: 'wall:1', surface: 'side', paintSide: 'left', start: 0, count: 3 },
			{ kind: 'wall', segmentId: 'wall:1', surface: 'side', paintSide: 'right', start: 3, count: 3 },
			{ kind: 'wall', segmentId: 'wall:1', surface: 'bridge', start: 6, count: 3 }
		];
		const selected = repairSurfaceGeometry(wall, { kind: 'wall-side', wallId: 'wall:1', side: 'right' });
		expect(Array.from(selected!.getIndex()!.array)).toEqual([3, 4, 5]);
		selected!.dispose();
	});

	it('distinguishes the floor from its sibling lid and each region face from its edges', () => {
		const group = new Group();
		const floor = mesh('floor', 'room');
		const lid = mesh('lid', 'room');
		group.add(floor, lid);
		expect(repairSurfaceGeometry(floor, { kind: 'room-lid', roomId: 'room' })).toBeNull();
		expect(repairSurfaceGeometry(lid, { kind: 'room-lid', roomId: 'room' })).toBe(lid.geometry);
		const region = mesh('region', 'slab');
		region.geometry.userData.regionSurfaces = ['top', 'underside', 'edge'];
		const selected = repairSurfaceGeometry(region, { kind: 'region-face', regionId: 'slab', face: 'underside' });
		expect(Array.from(selected!.getIndex()!.array)).toEqual([3, 4, 5]);
		selected!.dispose();
	});
});
