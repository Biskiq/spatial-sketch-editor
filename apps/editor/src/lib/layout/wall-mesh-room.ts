import type {
	CompiledRoom,
	CompiledWall,
	LayoutGeometryIssue
} from '@portfolio/layout-core/geometry';
import {
	WALL_CLEARANCE_INSUFFICIENT_CODE,
	WALL_OFFSET_FOLD_CODE,
	WALL_OFFSET_FOLD_MESSAGE,
	WALL_OFFSET_OVERLAP_CODE,
	WALL_OFFSET_OVERLAP_MESSAGE,
	wallOffsetClearanceFailure,
	wallPairClearanceOverlap
} from '@portfolio/layout-core/wall';
import type {
	Corner,
	ResolvedEndClip,
	ResolvedFaceSuppression,
	SectionFaces,
	RevealFaces,
	BridgeFaces,
	WallFaces,
	WallMeshBuildResult,
	WallMeshOptions,
	WallMeshSectionRef,
	WallMeshSurfaceKey
} from './wall-mesh-types';
import { DEFAULT_MITER_LIMIT, DEFAULT_WELD_TOLERANCE } from './wall-mesh-types';
import { computeCorners, roomHeightBreakpoints } from './wall-mesh-geometry';
import { buildRevealFaces, buildSectionFaces } from './wall-mesh-sections';
import { buildStartBridgeFaces } from './wall-mesh-corners';
import { assertWindingAgreesWithNormals, emitMesh } from './wall-mesh-emit';

export function buildRoomWallMesh(room: CompiledRoom, options: WallMeshOptions = {}): WallMeshBuildResult {
	const issues = validateRoom(room);
	if (issues.length > 0) return { mesh: undefined, issues };

	const overlapIssues = detectOffsetOverlap(room);
	if (overlapIssues.length > 0) return { mesh: undefined, issues: overlapIssues };

	const classify = options.classifySurface ?? ((ref: WallMeshSectionRef) => ref.kind);
	const weldTolerance = options.weldTolerance ?? DEFAULT_WELD_TOLERANCE;

	const wallResult = buildAllWallFaces(room, options, classify);
	if (wallResult.issues.length > 0) return { mesh: undefined, issues: wallResult.issues };
	const mesh = emitMesh(
		room.roomId,
		wallResult.wallsFaces,
		classify,
		weldTolerance,
		options.attribution === true
	);
	if (options.assertWinding) assertWindingAgreesWithNormals(mesh);
	return { mesh, issues: [] };
}


export function withSuppressionBreakpoints(
	breakpoints: readonly number[],
	suppressions: readonly ResolvedFaceSuppression[]
): number[] {
	if (suppressions.length === 0) return [...breakpoints];
	const edges = new Set<number>(breakpoints);
	for (const suppression of suppressions) {
		for (const band of suppression.bands) {
			edges.add(band.bottomY);
			edges.add(band.topY);
		}
	}
	return [...edges].sort((a, b) => a - b);
}

export function validateRoom(room: CompiledRoom): LayoutGeometryIssue[] {
	const issues: LayoutGeometryIssue[] = [];
	if (room.walls.length === 0) {
		issues.push({ path: `rooms.${room.roomId}`, code: 'room_no_walls', message: 'Room has no walls to build a mesh for.', targetId: room.roomId });
		return issues;
	}
	if (!Number.isFinite(room.wallThickness) || room.wallThickness <= 0) {
		issues.push({ path: `rooms.${room.roomId}`, code: 'wall_thickness_invalid', message: 'Room wall thickness must be finite and greater than zero.', targetId: room.roomId });
	}
	for (const wall of room.walls) {
		if (wall.samples.length < 2) {
			issues.push({ path: `rooms.${room.roomId}.walls.${wall.segmentId}`, code: 'wall_degenerate', message: 'Wall has too few samples to build a mesh.', targetId: wall.segmentId });
		}
		if (!Number.isFinite(wall.thickness) || wall.thickness <= 0) {
			issues.push({ path: `rooms.${room.roomId}.walls.${wall.segmentId}`, code: 'wall_thickness_invalid', message: 'Wall thickness must be finite and greater than zero.', targetId: wall.segmentId });
		}
	}
	return issues;
}

/**
 * Reject offset-overlap: local curvature folds (offset polyline self-intersects)
 * and global overlaps (non-adjacent walls, or non-adjacent samples of one wall,
 * closer than the wall thickness so their `±thickness/2` offsets overlap).
 */
export function detectOffsetOverlap(room: CompiledRoom): LayoutGeometryIssue[] {
	const issues: LayoutGeometryIssue[] = [];
	for (const wall of room.walls) {
		// The finite-thickness decision comes from `layout-core`, the
		// same predicate the canonical compile gate runs. This builder keeps its
		// own issue shaping only; it never re-derives the rule.
		const clearance = wallOffsetClearanceFailure(wall.samples, wall.thickness);
		if (clearance === 'fold') {
			issues.push({
				path: `rooms.${room.roomId}.walls.${wall.segmentId}`,
				code: WALL_OFFSET_FOLD_CODE,
				message: WALL_OFFSET_FOLD_MESSAGE,
				targetId: wall.segmentId
			});
		} else if (clearance === 'neck') {
			issues.push({
				path: `rooms.${room.roomId}.walls.${wall.segmentId}`,
				code: WALL_OFFSET_OVERLAP_CODE,
				message: WALL_OFFSET_OVERLAP_MESSAGE,
				targetId: wall.segmentId
			});
		}
	}

	const count = room.walls.length;
	for (let i = 0; i < count; i += 1) {
		for (let j = i + 1; j < count; j += 1) {
			if (j === i + 1 || (i === 0 && j === count - 1)) continue; // adjacent walls share a corner
			const a = room.walls[i]!;
			const b = room.walls[j]!;
			if (wallPairClearanceOverlap(a, b)) {
				issues.push({
					path: `rooms.${room.roomId}`,
					code: WALL_CLEARANCE_INSUFFICIENT_CODE,
					message: `Walls ${a.segmentId} and ${b.segmentId} are closer than their combined thickness; offset regions overlap.`,
					targetId: room.roomId
				});
			}
		}
	}
	return issues;
}

export function buildAllWallFaces(
	room: CompiledRoom,
	options: WallMeshOptions,
	classify: (ref: WallMeshSectionRef) => WallMeshSurfaceKey
): { wallsFaces: WallFaces[]; issues: LayoutGeometryIssue[] } {
	const cornerResult = computeCorners(room.walls, options.miterLimit ?? DEFAULT_MITER_LIMIT, room);
	if (cornerResult.issues.length > 0) return { wallsFaces: [], issues: cornerResult.issues };
	const corners = cornerResult.corners;
	const wallHeight = room.ceilingElevation - room.floorElevation;
	const roomBreakpoints = roomHeightBreakpoints(room);
	const count = room.walls.length;
	const wallsFaces = room.walls.map((wall, index) => {
		const cornerStart = corners[index]!;
		const cornerEnd = corners[(index + 1) % count]!;
		const prevWall = room.walls[(index - 1 + count) % count]!;
		const nextWall = room.walls[(index + 1) % count]!;
		return buildWallFaces(room, wall, prevWall, nextWall, cornerStart, cornerEnd, wallHeight, roomBreakpoints, classify);
	});
	return { wallsFaces, issues: [] };
}

export function buildWallFaces(
	room: CompiledRoom,
	wall: CompiledWall,
	prevWall: CompiledWall,
	nextWall: CompiledWall,
	cornerStart: Corner,
	cornerEnd: Corner,
	wallHeight: number,
	roomBreakpoints: readonly number[],
	classify: (ref: WallMeshSectionRef) => WallMeshSurfaceKey,
	emitBridges = true,
	clip?: ResolvedEndClip,
	suppressions: readonly ResolvedFaceSuppression[] = [],
	attribution = false
): WallFaces {
	const half = wall.thickness / 2;
	const sections: SectionFaces[] = [];
	for (const [sectionIndex, section] of wall.sections.entries()) {
		const ref: WallMeshSectionRef = {
			roomId: room.roomId,
			segmentId: wall.segmentId,
			sectionIndex,
			...(section.openingId ? { openingId: section.openingId } : {}),
			kind: section.kind
		};
		const surfaceKey = classify(ref);
		const faces = buildSectionFaces(
			room,
			wall,
			section,
			half,
			cornerStart,
			cornerEnd,
			roomBreakpoints,
			clip,
			suppressions,
			attribution
		);
		if (faces.length > 0) sections.push({ ref, surfaceKey, faces });
	}

	const reveals: RevealFaces[] = [];
	for (const opening of wall.openings) {
		const surfaceKey = classify({
			roomId: room.roomId,
			segmentId: wall.segmentId,
			sectionIndex: -1,
			...(opening.openingId ? { openingId: opening.openingId } : {}),
			kind: 'side'
		});
		const faces = buildRevealFaces(
			room,
			wall,
			prevWall,
			nextWall,
			opening,
			half,
			wallHeight,
			roomBreakpoints,
			cornerStart,
			cornerEnd,
			clip,
			attribution
		);
		if (faces.length > 0) reveals.push({ openingId: opening.openingId, surfaceKey, faces });
	}

	// Beveled joint at this wall's start (the corner shared with `prevWall`).
	// The standalone Junction path passes `emitBridges = false` and supplies its
	// own resolved bridges from both ends.
	const bridges: BridgeFaces[] = [];
	if (emitBridges) {
		const bridge = buildStartBridgeFaces(room, prevWall, wall, cornerStart, wallHeight, roomBreakpoints, classify);
		if (bridge) bridges.push(bridge);
	}

	return {
		segmentId: wall.segmentId,
		sections,
		reveals,
		bridges,
		development: { samples: wall.samples, thickness: wall.thickness, floorElevation: room.floorElevation }
	};
}

