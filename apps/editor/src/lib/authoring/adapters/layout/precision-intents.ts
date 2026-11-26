/**
 * Captured F.4 intents for Wall precision edits.
 *
 * One literal per operation, with captured identity and the explicit working
 * level, so preview and commit build byte-identical intents.
 */
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { FixedWallEndpoint } from '@portfolio/layout-core/wall';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SemanticReference } from '@portfolio/project-model/references';
import {
	LAYOUT_JUNCTION_MOVE_KIND,
	LAYOUT_WALL_ANGLE_KIND,
	LAYOUT_WALL_BEND_KIND,
	LAYOUT_WALL_KNOT_DELETE_KIND,
	LAYOUT_WALL_LENGTH_KIND,
	LAYOUT_WALL_MOVE_KIND,
	LAYOUT_WALL_STRAIGHTEN_KIND,
	buildLayoutIntent,
} from './precision';
import type { WallManipulationRequest } from './precision-frames';

/**
 * One F.4 intent for a Wall manipulation, with captured identity and revision.
 *
 * The reference names the level the accepted source owns, exactly as the
 * precision instrument does, so the target cannot name another level.
 */
export function wallManipulationIntent(input: {
	readonly request: WallManipulationRequest;
	readonly wallId: string;
	readonly fixed: FixedWallEndpoint;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	const reference: SemanticReference = {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: input.contentRevision },
		subject: { kind: 'wall', id: input.wallId },
		instancePath: [],
		location: { kind: 'layout-location', levelId: input.levelId, structureInstancePath: [] },
		componentId: null,
		capabilityId: null,
	};
	const base = {
		operationId: input.operationId,
		projectId: input.projectId,
		revisionId: input.revisionId,
		contentRevision: input.contentRevision,
		levelId: input.levelId,
		targets: [reference],
	};
	// One literal per operation: a shared conditional object would widen its
	// unselected keys to `undefined`, which is not an F.4 JSON value.
	if (input.request.kind === 'length') {
		return buildLayoutIntent({
			...base,
			kind: LAYOUT_WALL_LENGTH_KIND,
			payload: { wallId: input.wallId, length: input.request.length, fixed: input.fixed },
		});
	}
	if (input.request.kind === 'junction') {
		return buildLayoutIntent({
			...base,
			kind: LAYOUT_JUNCTION_MOVE_KIND,
			payload: {
				wallId: input.wallId,
				junctionId: input.request.junctionId,
				x: input.request.point[0],
				z: input.request.point[1],
			},
		});
	}
	if (input.request.kind === 'angle') {
		return buildLayoutIntent({
			...base,
			kind: LAYOUT_WALL_ANGLE_KIND,
			payload: {
				wallId: input.wallId,
				angleRadians: input.request.angleRadians,
				fixed: input.fixed,
			},
		});
	}
	return buildLayoutIntent({
		...base,
		kind: LAYOUT_WALL_MOVE_KIND,
		payload: {
			wallId: input.wallId,
			deltaX: input.request.delta[0],
			deltaZ: input.request.delta[1],
		},
	});
}

/**
 * One Bend intent: the physical station the press resolved, the pointer's
 * bend point, and the captured id the write may insert.
 *
 * Preview and commit build this same intent, so the document the preview draws
 * is the document acceptance writes, and Undo replays the captured knot id
 * rather than minting an occupancy-derived one.
 */
export function wallBendIntent(input: {
	readonly wallId: string;
	readonly distance: number;
	readonly point: LayoutVec2;
	readonly knotId: string;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	const reference: SemanticReference = {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: input.contentRevision },
		subject: { kind: 'wall', id: input.wallId },
		instancePath: [],
		location: { kind: 'layout-location', levelId: input.levelId, structureInstancePath: [] },
		componentId: null,
		capabilityId: null,
	};
	return buildLayoutIntent({
		operationId: input.operationId,
		projectId: input.projectId,
		revisionId: input.revisionId,
		contentRevision: input.contentRevision,
		levelId: input.levelId,
		targets: [reference],
		kind: LAYOUT_WALL_BEND_KIND,
		payload: {
			wallId: input.wallId,
			distance: input.distance,
			x: input.point[0],
			z: input.point[1],
			knotId: input.knotId,
		},
	});
}

/** One captured intent for removing the active bend point. */
export function wallKnotDeleteIntent(input: {
	readonly wallId: string;
	readonly knotId: string;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	const reference: SemanticReference = {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: input.contentRevision },
		subject: { kind: 'wall', id: input.wallId },
		instancePath: [],
		location: { kind: 'layout-location', levelId: input.levelId, structureInstancePath: [] },
		componentId: null,
		capabilityId: null,
	};
	return buildLayoutIntent({
		operationId: input.operationId,
		projectId: input.projectId,
		revisionId: input.revisionId,
		contentRevision: input.contentRevision,
		levelId: input.levelId,
		targets: [reference],
		kind: LAYOUT_WALL_KNOT_DELETE_KIND,
		payload: { wallId: input.wallId, knotId: input.knotId },
	});
}

/** One captured intent for Straighten Wall. */
export function wallStraightenIntent(input: {
	readonly wallId: string;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	const reference: SemanticReference = {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: input.contentRevision },
		subject: { kind: 'wall', id: input.wallId },
		instancePath: [],
		location: { kind: 'layout-location', levelId: input.levelId, structureInstancePath: [] },
		componentId: null,
		capabilityId: null,
	};
	return buildLayoutIntent({
		operationId: input.operationId,
		projectId: input.projectId,
		revisionId: input.revisionId,
		contentRevision: input.contentRevision,
		levelId: input.levelId,
		targets: [reference],
		kind: LAYOUT_WALL_STRAIGHTEN_KIND,
		payload: { wallId: input.wallId },
	});
}
