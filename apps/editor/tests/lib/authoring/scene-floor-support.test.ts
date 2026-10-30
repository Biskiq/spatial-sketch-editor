/**
 * T2.P01.S03 — floor support is the drawn geometry, not just the datum plane.
 *
 * The point of these tests is the defect the datum intersection cannot catch: a
 * Wall or another object stands between the pointer and the floor, so the pose
 * behind it is not support the creator can see. The ray is the same world-space
 * ray the viewport evaluation produced; the occluders are the compiled solid
 * spans the shared wall-mesh builder draws plus the resolved Scene's primitives.
 */
import { describe, expect, it } from 'vitest';
import type { SceneEntity, Vec3 } from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';

import { floorSupport, supportOccluders } from '$lib/authoring/adapters/scene/support-occlusion';
import { snapFreePlacement } from '$lib/authoring/adapters/scene/placement';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const PROJECT_ID = 'project-floor-support';

function project(entities: readonly SceneEntity[]): Promise<ProjectEnvelope> {
	const planned = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		capture: freshCapture(),
		levelId: createEmptyWallFirstLayoutDocument().floor.id
	});
	if (planned.kind !== 'success') throw new Error('the wall fixture was refused');
	return createUnitProject({
		id: PROJECT_ID,
		name: 'Floor support',
		layout: planned.document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [...entities],
			navigationNodes: [],
			connections: []
		}
	});
}

function box(id: string, position: Vec3): SceneEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: 'Block',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0]
	};
}

function form(
	id: string,
	position: Vec3,
	outline: readonly (readonly [number, number])[] = [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1]
	],
	rotation: Vec3 = [0, 0, 0]
): SceneEntity {
	return {
		kind: 'form',
		id,
		name: 'Drawn form',
		position,
		rotation,
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				outline: outline.map(([u, v], index) => ({ key: index + 1, u, v, smooth: false })),
				extent: 1
			},
			scale: [1, 1, 1],
			nextKey: outline.length + 1
		},
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true
	};
}

/** A unit-length ray; the code only relies on `origin + t * direction`. */
function ray(origin: Vec3, towards: Vec3) {
	const delta: Vec3 = [towards[0] - origin[0], towards[1] - origin[1], towards[2] - origin[2]];
	const length = Math.hypot(delta[0], delta[1], delta[2]);
	return {
		origin,
		direction: [delta[0] / length, delta[1] / length, delta[2] / length] as Vec3
	};
}

async function domainFor(entities: readonly SceneEntity[]) {
	const admitted = await admitSource(await project(entities), {
		sessionEpoch: 'session-floor-support',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-1' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`the fixture was not admitted: ${admitted.kind}`);
	return admitted.snapshot.domain;
}

describe('R217.S05 — the shared drafting snap for free placement', () => {
	it('rounds the plan position only, so support elevation and yaw are untouched', () => {
		// Snap is one fact consumed by Scene; the support-resolved Y the planner
		// installs is not a plan coordinate and this helper never manufactures one.
		expect(snapFreePlacement([1.37, 2.81], 1)).toEqual({ x: 1, z: 3, snappedStep: 1 });
		expect(snapFreePlacement([1.37, 2.81], 0.5)).toEqual({ x: 1.5, z: 3, snappedStep: 0.5 });
		expect(snapFreePlacement([1.37, 2.81], 0.2)).toEqual({ x: 1.4, z: 2.8, snappedStep: 0.2 });
	});

	it('is off for a null, zero or non-positive increment rather than snapping to zero', () => {
		expect(snapFreePlacement([1.37, 2.81], null)).toEqual({ x: 1.37, z: 2.81, snappedStep: null });
		expect(snapFreePlacement([1.37, 2.81], 0)).toEqual({ x: 1.37, z: 2.81, snappedStep: null });
		expect(snapFreePlacement([1.37, 2.81], -1)).toEqual({ x: 1.37, z: 2.81, snappedStep: null });
	});
});

describe('floor support against drawn geometry', () => {
	it('reports the datum point when nothing is between the ray and the floor', async () => {
		const domain = await domainFor([box('entity-box', [2, 0.5, 2])]);
		const support = floorSupport(
			ray([3.5, 2, 1], [3.5, 0, 2]),
			domain.datumMeters,
			supportOccluders(domain.geometry, domain.scene)
		);
		expect(support.kind).toBe('floor');
		if (support.kind !== 'floor') return;
		expect(support.worldPoint[1]).toBe(domain.datumMeters);
		expect(support.worldPoint[0]).toBeCloseTo(3.5, 9);
	});

	it('refuses the floor point behind a Wall the renderer draws', async () => {
		const domain = await domainFor([]);
		expect(domain.geometry.walls.length).toBeGreaterThan(0);
		const support = floorSupport(
			// Outside the room, looking through the z = 0 Wall at the floor beyond it.
			ray([3.5, 2, -2], [3.5, 0, 2]),
			domain.datumMeters,
			supportOccluders(domain.geometry, domain.scene)
		);
		expect(support.kind).toBe('occluded');
		if (support.kind !== 'occluded') return;
		expect(support.occluderId.startsWith('wall:')).toBe(true);
	});

	it('refuses the floor point behind another object, but not behind its own subject', async () => {
		const domain = await domainFor([box('entity-box', [2, 0.5, 2])]);
		const looking = ray([2, 2, 5], [2, 0, 1]);
		const occluded = floorSupport(
			looking,
			domain.datumMeters,
			supportOccluders(domain.geometry, domain.scene)
		);
		expect(occluded.kind).toBe('occluded');
		if (occluded.kind !== 'occluded') return;
		expect(occluded.occluderId).toBe('scene:entity-box');

		// The entity being dragged is not its own support blocker: excluding it
		// resolves the same ray to the floor where the creator is pointing.
		const ownSubject = floorSupport(
			looking,
			domain.datumMeters,
			supportOccluders(domain.geometry, domain.scene, 'entity-box')
		);
		expect(ownSubject.kind).toBe('floor');
	});

	it('uses a form body for occlusion and excludes the live subject by entity id', async () => {
		const domain = await domainFor([form('entity-form', [0, 0, 0])]);
		const rayAtForm = ray([0.5, 2, 0.5], [0.5, 0, 0.5]);
		const occluders = supportOccluders(domain.geometry, domain.scene);
		const blocked = floorSupport(rayAtForm, domain.datumMeters, occluders);
		expect(blocked.kind).toBe('occluded');
		if (blocked.kind !== 'occluded') return;
		expect(blocked.occluderId).toBe('scene:entity-form');
		expect(blocked.distanceMeters).toBeCloseTo(1, 9);

		const ownSubject = floorSupport(
			rayAtForm,
			domain.datumMeters,
			supportOccluders(domain.geometry, domain.scene, 'entity-form')
		);
		expect(ownSubject.kind).toBe('floor');
	});

	it('occludes an oblique ray that meets a form side, not only its cap', async () => {
		// The form is a unit cube at the origin. From inside the room the ray enters
		// through the x = 1 side at y ≈ 0.9 and reaches the datum beyond it, so the
		// broad-phase local-bound test must not reject a body it enters off-axis.
		const domain = await domainFor([form('entity-side-form', [0, 0, 0])]);
		const blocked = floorSupport(
			ray([1.8, 1.1, 0.5], [-1, 0.4, 0.5]),
			domain.datumMeters,
			supportOccluders(domain.geometry, domain.scene)
		);
		expect(blocked.kind).toBe('occluded');
		if (blocked.kind === 'occluded') {
			expect(blocked.occluderId).toBe('scene:entity-side-form');
		}
	});

	it('applies the full Euler rotation when testing form occlusion', async () => {
		const rolledForm = form('entity-rolled-form', [0, 0, 0], undefined, [0, 0, Math.PI / 2]);
		const domain = await domainFor([rolledForm]);
		const occluders = supportOccluders(domain.geometry, domain.scene);

		// The quarter-turn around Z moves the unit form's top from +Y to -X.
		const onRenderedForm = floorSupport(
			ray([-0.5, 2, 0.5], [-0.5, 0, 0.5]),
			domain.datumMeters,
			occluders
		);
		expect(onRenderedForm.kind).toBe('occluded');
		if (onRenderedForm.kind === 'occluded') {
			expect(onRenderedForm.occluderId).toBe('scene:entity-rolled-form');
		}

		// X=0.5 lies in the old, yaw-only phantom footprint, not the rendered mesh.
		const outsideRenderedForm = floorSupport(
			ray([0.5, 2, 0.5], [0.5, 0, 0.5]),
			domain.datumMeters,
			occluders
		);
		expect(outsideRenderedForm.kind).toBe('floor');
	});

	it('does not let a concave form bounding box hide its empty interior corner', async () => {
		const concaveOutline: readonly (readonly [number, number])[] = [
			[0, 0],
			[2, 0],
			[2, 1],
			[1, 1],
			[1, 2],
			[0, 2]
		];
		const domain = await domainFor([form('entity-concave-form', [0, 0, 0], concaveOutline)]);
		const occluders = supportOccluders(domain.geometry, domain.scene);

		const solidArm = floorSupport(
			ray([0.5, 2, 0.5], [0.5, 0, 0.5]),
			domain.datumMeters,
			occluders
		);
		expect(solidArm.kind).toBe('occluded');
		if (solidArm.kind === 'occluded') expect(solidArm.occluderId).toBe('scene:entity-concave-form');

		// This point is inside the 2 × 2 bounds but outside both arms of the L.
		const emptyCorner = floorSupport(
			ray([1.5, 2, 1.5], [1.5, 0, 1.5]),
			domain.datumMeters,
			occluders
		);
		expect(emptyCorner.kind).toBe('floor');
	});

	it('reports no support for a parallel or backward ray', async () => {
		const domain = await domainFor([]);
		const occluders = supportOccluders(domain.geometry, domain.scene);
		expect(
			floorSupport({ origin: [2, 2, 2], direction: [1, 0, 0] }, domain.datumMeters, occluders)
		).toEqual({ kind: 'none', reason: 'parallel' });
		expect(
			floorSupport({ origin: [2, 2, 2], direction: [0, 1, 0] }, domain.datumMeters, occluders)
		).toEqual({ kind: 'none', reason: 'behind' });
	});
});
