/**
 * T2.P01.S03 — the candidate's drawn body.
 *
 * A proposal is shown as the object's own shape at the captured pose, so both
 * readings present what acceptance will install instead of a label beside an
 * unchanged object. Only shapes with authored dimensions are drawn; a model has
 * no verified extent in this slice, and inventing one would be a false preview.
 */

import type { SceneEntity } from '@portfolio/project-model';
import type { StageGhostMesh } from '$lib/authoring/stage/stage-facade';

import type { SceneCandidate } from './placement';

export function candidateGhost(entity: SceneEntity, candidate: SceneCandidate): StageGhostMesh | null {
	if (entity.kind !== 'primitive') return null;
	const shape: StageGhostMesh['shape'] | null = (() => {
		switch (entity.primitive) {
			case 'box':
				return {
					kind: 'box',
					size: [entity.dimensions.width, entity.dimensions.height, entity.dimensions.depth]
				};
			case 'plane':
				// The drawn plane has no thickness; a hair of depth keeps the ghost
				// visible from the side without implying a solid object.
				return { kind: 'box', size: [entity.dimensions.width, entity.dimensions.height, 0.01] };
			case 'cylinder':
				return { kind: 'cylinder', radius: entity.dimensions.radius, height: entity.dimensions.height };
			case 'sphere':
				return { kind: 'sphere', radius: entity.dimensions.radius };
		}
		return null;
	})();
	if (shape === null) return null;
	return {
		id: 'scene-candidate',
		center: [...candidate.position],
		yaw: candidate.rotation[1],
		shape
	};
}
