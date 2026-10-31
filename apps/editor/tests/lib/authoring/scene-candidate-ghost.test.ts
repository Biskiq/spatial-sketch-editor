import { describe, expect, it } from 'vitest';
import type { SceneEntity } from '@portfolio/project-model';
import { candidateGhost } from '$lib/authoring/adapters/scene/candidate-ghost';
import type { SceneCandidate } from '$lib/authoring/adapters/scene/placement';

const MODEL: SceneEntity = {
	kind: 'model',
	id: 'model-a',
	name: 'Model',
	assetId: 's17-approved-model',
	fallback: 'generic',
	position: [1, 0, 2],
	rotation: [0, 0, 0],
	scale: 1
};

function candidate(overrides: Partial<SceneCandidate> = {}): SceneCandidate {
	return {
		kind: 'move',
		entityId: 'model-a',
		primitive: null,
		position: [1, 0, 2],
		rotation: [0, 0, 0],
		worldXZ: [1, 2],
		yaw: 0,
		scale: 1,
		snappedStep: null,
		...overrides
	};
}

describe('Scene candidate ghosts', () => {
	it.each(['move', 'yaw'] as const)('keeps an already-sized primitive at its accepted extent during %s', (kind) => {
		const primitive: SceneEntity = {
			kind: 'primitive', primitive: 'box', id: 'scaled-box', name: 'Scaled box',
			dimensions: { width: 1.2, height: 0.5, depth: 0.6 }, scale: 3,
			materialId: 'plaster-warm', castShadow: true, receiveShadow: true,
			position: [1, 0.75, 2], rotation: [0, 0, 0]
		};
		const preview = candidateGhost(primitive, candidate({
			kind, entityId: primitive.id, scale: 3,
			position: [2, 0.75, 3], rotation: [0, Math.PI / 4, 0], yaw: Math.PI / 4
		}));
		expect(preview).toMatchObject({ center: [2, 0.75, 3], yaw: Math.PI / 4 });
		if (preview?.shape.kind !== 'box') throw new Error('expected a box ghost');
		expect(preview.shape.size[0]).toBeCloseTo(3.6, 9);
		expect(preview.shape.size[1]).toBeCloseTo(1.5, 9);
		expect(preview.shape.size[2]).toBeCloseTo(1.8, 9);
	});

	it('uses an approved model footprint as a faint proxy and omits a model with no approved bounds', () => {
		expect(candidateGhost(MODEL, candidate())).toBeNull();
		expect(candidateGhost(
			MODEL,
			candidate({ position: [1, 0.5, 2] }),
			{ modelFootprint: { width: 0.8, depth: 0.6 }, modelContactMinY: -0.5 }
		)).toMatchObject({
			shape: { kind: 'box', size: [0.8, 1, 0.6] },
			center: [1, 0.5, 2],
			treatment: 'proxy'
		});
	});

	it('seats an armed model Place proxy from its approved floor contact', () => {
		const preview = candidateGhost(
			null,
			candidate({
				kind: 'place',
				entityId: null,
				position: [2, 0.5, 1],
				worldXZ: [2, 1],
				footprint: { width: 0.45, depth: 0.35 },
				modelContactMinY: -0.5,
				modelAssetId: 's17-approved-model'
			}),
			{ treatment: 'refused' }
		);
		expect(preview).toMatchObject({
			center: [2, 0.5, 1],
			shape: { kind: 'box', size: [0.45, 1, 0.35] },
			treatment: 'refused'
		});
	});

	it('keeps a resized model proxy seated using its candidate scale', () => {
		const preview = candidateGhost(
			MODEL,
			candidate({ kind: 'resize', position: [1, 1, 2], scale: 2, modelContactMinY: -0.5 }),
			{ modelFootprint: { width: 0.8, depth: 0.6 } }
		);
		expect(preview).toMatchObject({
			center: [1, 1, 2],
			shape: { kind: 'box', size: [1.6, 2, 1.2] },
			treatment: 'proxy'
		});
	});
});
