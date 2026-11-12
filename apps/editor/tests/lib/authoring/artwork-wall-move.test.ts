import { describe, expect, it } from 'vitest';
import type { PointerRay } from '@portfolio/camera-core';
import type { Vec3 } from '@portfolio/project-model';
import type { SceneRenderedHit } from '$lib/authoring/scene/scene-pick-source';
import {
	artworkFaceNormal,
	artworkFitsWall,
	artworkFrameSamples,
	artworkIsHung,
	artworkWallIsCurved
} from '$lib/authoring/artwork/artwork-wall-move';

/** A flat wall at z = 0, spanning x in [-limit, limit] and y in [0, 3]. */
function wallPick(limit = 2): (ray: PointerRay) => SceneRenderedHit | null {
	return (ray) => {
		if (Math.abs(ray.direction[2]) < 1e-9) return null;
		const distance = -ray.origin[2] / ray.direction[2];
		if (distance <= 0) return null;
		const point: Vec3 = [
			ray.origin[0] + ray.direction[0] * distance,
			ray.origin[1] + ray.direction[1] * distance,
			0
		];
		if (Math.abs(point[0]) > limit || point[1] < 0 || point[1] > 3) return null;
		return {
			entityId: 'wall-1',
			kind: 'layout',
			distanceMeters: distance,
			worldPoint: point,
			normal: [0, 0, 1],
			wallId: 'wall-1',
			wallNormal: [0, 0, 1]
		} as SceneRenderedHit;
	};
}

const outer = { width: 1, height: 0.8 };

describe('artwork wall move', () => {
	it('samples a 3x3 outer-frame grid around the pose', () => {
		const samples = artworkFrameSamples([1, 1.5, 0.002], 0, outer);
		expect(samples).toHaveLength(9);
		expect(Math.min(...samples.map((point) => point[0]))).toBeCloseTo(0.5, 9);
		expect(Math.max(...samples.map((point) => point[0]))).toBeCloseTo(1.5, 9);
		expect(Math.min(...samples.map((point) => point[1]))).toBeCloseTo(1.1, 9);
		expect(Math.max(...samples.map((point) => point[1]))).toBeCloseTo(1.9, 9);
	});

	it('accepts a pose whose every outer sample meets the same wall face', () => {
		expect(artworkFitsWall([1, 1.5, 0.002], 0, outer, 'wall-1', wallPick())).toBe(true);
	});

	it('rejects a pose that hangs past the wall end even though its centre still fits', () => {
		expect(artworkFitsWall([1.2, 1.5, 0.002], 0, outer, 'wall-1', wallPick(1.5))).toBe(false);
	});

	it('rejects a pose whose sample meets a different wall', () => {
		expect(artworkFitsWall([1, 1.5, 0.002], 0, outer, 'wall-2', wallPick())).toBe(false);
	});

	it('reads a flat Artwork on the wall as hung and one standing off it as free', () => {
		expect(artworkIsHung([0, 1.5, 0.002], 0, wallPick())).toBe(true);
		expect(artworkIsHung([0, 1.5, 0.02], 0, wallPick())).toBe(false);
		expect(artworkIsHung([0, 1.5, 1], 0, wallPick())).toBe(false);
	});

	it('preserves a flat, centre-tangent Artwork on a curved Wall', () => {
		// A curved face stands away from the tangent plane at the frame corners;
		// the same-wall check still applies but the straight-face distance does not.
		const curvedPick = (ray: PointerRay) => {
			const hit = wallPick(2)(ray);
			if (hit === null) return null;
			const sagitta = (hit.worldPoint[0] - 1) ** 2 * 0.4;
			return { ...hit, distanceMeters: hit.distanceMeters + sagitta } as SceneRenderedHit;
		};
		expect(artworkFitsWall([1, 1.5, 0.002], 0, outer, 'wall-1', curvedPick)).toBe(false);
		expect(artworkFitsWall([1, 1.5, 0.002], 0, outer, 'wall-1', curvedPick, { curved: true })).toBe(true);
		expect(artworkFitsWall([1, 1.5, 0.002], 0, outer, 'wall-1', wallPick(1.4), { curved: true })).toBe(false);
	});

	it('recognizes a face whose compiled samples change tangent', () => {
		const hit = wallPick()({ origin: [0, 1.5, 1], direction: [0, 0, -1] })!;
		const flat = { walls: [{ wallId: 'wall-1', samples: [{ tangent: [1, 0] as const }, { tangent: [1, 0] as const }, { tangent: [1, 0] as const }] }] };
		const curved = { walls: [{ wallId: 'wall-1', samples: [{ tangent: [1, 0] as const }, { tangent: [0.98, 0.2] as const }, { tangent: [0.9, 0.4] as const }] }] };
		expect(artworkWallIsCurved(hit, flat)).toBe(false);
		expect(artworkWallIsCurved(hit, curved)).toBe(true);
	});

	it('turns the face normal with the Artwork yaw', () => {
		expect(artworkFaceNormal(0)).toEqual([0, 0, 1]);
		const turned = artworkFaceNormal(Math.PI / 2);
		expect(turned[0]).toBeCloseTo(1, 9);
		expect(turned[2]).toBeCloseTo(0, 9);
	});
});
