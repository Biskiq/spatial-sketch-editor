/**
 * T2.P01.S03 — the candidate's drawn body.
 *
 * A proposal is shown as the object's own shape at the captured pose, so both
 * readings present what acceptance will install instead of a label beside an
 * unchanged object. A placement candidate has no accepted entity yet, so it uses
 * the admitted native definition's dimensions. Approved models can show a
 * footprint-based proxy; models without confirmed bounds stay hidden.
 */

import type { SceneEntity } from '@portfolio/project-model';
import type { StageGhostMesh } from '$lib/authoring/stage/stage-facade';
import { NATIVE_PLACEMENT_DIMENSIONS, type NativePlacementPrimitive } from '../../scene/object-definition-policy';

import type { SceneCandidate } from './placement';

export type CandidateGhostOptions = {
	/** Only approved creator-model metadata may supply a proxy extent. */
	readonly modelFootprint?: { readonly width: number; readonly depth: number } | null;
	readonly treatment?: StageGhostMesh['treatment'];
};

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
	candidate: SceneCandidate,
	options: CandidateGhostOptions = {}
): StageGhostMesh | null {
	let treatment = options.treatment ?? 'subject';
	let center: SceneCandidate['position'] = candidate.position;
	const shape: StageGhostMesh['shape'] | null = (() => {
		if (candidate.kind === 'place') {
			// A My Objects insertion previews the item's own authored body, never
			// a stand-in primitive: what the creator sees is what acceptance writes.
			if (candidate.form !== undefined) return { kind: 'form', form: candidate.form };
			if (candidate.primitive !== null) return primitiveShape(candidate.primitive);
			if (candidate.footprint === undefined) return null;
			treatment = options.treatment ?? 'proxy';
			center = [candidate.position[0], candidate.position[1] + 0.5, candidate.position[2]];
			return { kind: 'box', size: [candidate.footprint.width, 1, candidate.footprint.depth] };
		}
		if (entity === null) return null;
		if (entity.kind === 'form') return { kind: 'form', form: candidate.form ?? entity.form };
		if (entity.kind === 'model') {
			const footprint = options.modelFootprint ?? candidate.footprint;
			if (footprint === undefined || footprint === null) return null;
			const scale = candidate.scale;
			treatment = options.treatment ?? 'proxy';
			center = [candidate.position[0], candidate.position[1] + 0.5 * scale, candidate.position[2]];
			return { kind: 'box', size: [footprint.width * scale, scale, footprint.depth * scale] };
		}
		if (entity.kind !== 'primitive') return null;
		// A Resize candidate is drawn at the scale it would install, so the ghost is
		// the object's own new body rather than its previous size at the new Y.
		const scale = candidate.kind === 'resize' ? candidate.scale : 1;
		switch (entity.primitive) {
			case 'box':
				return {
					kind: 'box',
					size: [
						entity.dimensions.width * scale,
						entity.dimensions.height * scale,
						entity.dimensions.depth * scale
					]
				};
			case 'plane':
				// The drawn plane has no thickness; a hair of depth keeps the ghost
				// visible from the side without implying a solid object.
				return {
					kind: 'box',
					size: [entity.dimensions.width * scale, entity.dimensions.height * scale, 0.01]
				};
			case 'cylinder':
				return {
					kind: 'cylinder',
					radius: entity.dimensions.radius * scale,
					height: entity.dimensions.height * scale
				};
			case 'sphere':
				return { kind: 'sphere', radius: entity.dimensions.radius * scale };
		}
		return null;
	})();
	if (shape === null) return null;
	return {
		id: 'scene-candidate',
		center: [...center],
		yaw: candidate.rotation[1],
		treatment,
		shape
	};
}
