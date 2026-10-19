/**
 * T2.P01.S03 — the candidate's drawn body.
 *
 * A proposal is shown as the object's own shape at the captured pose, so both
 * readings present what acceptance will install instead of a label beside an
 * unchanged object. A placement candidate has no accepted entity yet, so it uses
 * the admitted native definition's dimensions. Only shapes with authored
 * dimensions are drawn; a model has no verified extent in this slice, and
 * inventing one would be a false preview.
 */

import type { SceneEntity } from '@portfolio/project-model';
import type { StageGhostMesh } from '$lib/authoring/stage/stage-facade';
import { NATIVE_PLACEMENT_DIMENSIONS, type NativePlacementPrimitive } from '../../scene/object-definition-policy';

import type { SceneCandidate } from './placement';

function primitiveShape(primitive: NativePlacementPrimitive): StageGhostMesh['shape'] {
	switch (primitive) {
		case 'box': {
			const dimensions = NATIVE_PLACEMENT_DIMENSIONS.box;
			return { kind: 'box', size: [dimensions.width, dimensions.height, dimensions.depth] };
		}
		case 'cylinder': {
			const dimensions = NATIVE_PLACEMENT_DIMENSIONS.cylinder;
			return { kind: 'cylinder', radius: dimensions.radius, height: dimensions.height };
		}
		case 'sphere':
			return { kind: 'sphere', radius: NATIVE_PLACEMENT_DIMENSIONS.sphere.radius };
	}
}

export function candidateGhost(
	entity: SceneEntity | null,
	candidate: SceneCandidate
): StageGhostMesh | null {
	const shape: StageGhostMesh['shape'] | null = (() => {
		if (candidate.kind === 'place') {
			return candidate.primitive === null ? null : primitiveShape(candidate.primitive);
		}
		if (entity === null || entity.kind !== 'primitive') return null;
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
