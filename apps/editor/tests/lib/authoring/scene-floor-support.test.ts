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
import {
	createEmptyWallFirstProject,
	type ProjectDocument,
	type SceneEntity,
	type Vec3
} from '@portfolio/project-model';
import { planWallChain } from '@portfolio/layout-core';

import { floorSupport, supportOccluders } from '$lib/authoring/adapters/scene/support-occlusion';
import { admitSource } from '$lib/authoring/stage/source-admission';

const PROJECT_ID = 'project-floor-support';

function project(entities: readonly SceneEntity[]): ProjectDocument {
	const base = createEmptyWallFirstProject({ id: PROJECT_ID, name: 'Floor support' });
	const planned = planWallChain({
		baseline: base.layout,
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		role: 'boundary'
	});
	if (planned.kind !== 'success') throw new Error('the wall fixture was refused');
	return { ...base, layout: planned.document, scene: { ...base.scene, entities: [...entities] } };
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
	const admitted = await admitSource(project(entities), {
		sessionEpoch: 'session-floor-support',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-1' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`the fixture was not admitted: ${admitted.kind}`);
	return admitted.snapshot.domain;
}

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
