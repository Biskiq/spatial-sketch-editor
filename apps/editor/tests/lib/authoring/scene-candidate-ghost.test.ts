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
	it('uses an approved model footprint as a faint proxy and omits a model with no approved bounds', () => {
		expect(candidateGhost(MODEL, candidate())).toBeNull();
		expect(candidateGhost(MODEL, candidate(), { modelFootprint: { width: 0.8, depth: 0.6 } })).toMatchObject({
			shape: { kind: 'box', size: [0.8, 1, 0.6] },
			center: [1, 0.5, 2],
			treatment: 'proxy'
		});
	});

	it('keeps the candidate footprint and refusal treatment on an armed model Place', () => {
		const preview = candidateGhost(
			null,
			candidate({
				kind: 'place',
				entityId: null,
				position: [2, 0, 1],
				worldXZ: [2, 1],
				footprint: { width: 0.45, depth: 0.35 },
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
});
