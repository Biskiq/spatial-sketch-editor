/**
 * Angled-plan test fixtures — extracted by T4 so the noding/projection sweep
 * suite (`angled-plan-noding-sweeps.test.ts`) and the behavioral suite
 * (`layout-angled-plan-integrity.test.ts`) share one owner for the
 * document builders instead of duplicating them across lanes.
 *
 * `bottomStart`/`bottomEnd` and `twoRoomsWithOneObliqueDivider` are shared: the
 * behavioral suite's "one shared Junction" regression and the heavy lane's
 * 591-step 2→3 sweep both build on the same oblique host.
 */

import { expect } from 'vitest';
import {
	buildCorrespondenceComponents,
	createEmptyWallFirstLayoutDocument,
	extractBoundaryCandidateFaces,
	interiorWitness,
	planWallChain,
	planWallSegment,
	roomBoundaryPolygon,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

export const p = (x: number, z: number): LayoutVec2 => [x, z];

export function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

export function plan(
	baseline: LayoutDocumentWallFirst,
	start: LayoutVec2,
	end: LayoutVec2
): ReturnType<typeof planWallSegment> {
	return planWallSegment({ baseline, start, end, role: 'boundary' });
}

export function commit(
	baseline: LayoutDocumentWallFirst,
	start: LayoutVec2,
	end: LayoutVec2
): LayoutDocumentWallFirst {
	const result = plan(baseline, start, end);
	if (result.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(result)}`);
	return result.document;
}

/** Same nearest-point arithmetic used by wall-span snap candidates. */
export function projectToSpan(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): LayoutVec2 {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const squared = dx * dx + dz * dz;
	const t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared;
	return [start[0] + dx * t, start[1] + dz * t];
}

/** The oblique divider whose rounded projection dust the 2→3 sweep walks. */
export const bottomStart = p(0, -0.9142857142857137);
export const bottomEnd = p(7, -0.9333333333333336);

/** Two Rooms divided by that oblique Wall — the shape the 2→3 regression needs. */
export function twoRoomsWithOneObliqueDivider(): LayoutDocumentWallFirst {
	const enclosure = planWallChain({
		baseline: baseDocument(),
		points: [p(0, -4), p(7, -4), p(7, 2), p(0, 2)],
		close: true,
		role: 'boundary'
	});
	if (enclosure.kind !== 'success') throw new Error('enclosure failed');
	const document = commit(enclosure.document, bottomStart, bottomEnd);
	expect(document.rooms).toHaveLength(2);
	return document;
}

/** Room ↔ face correspondence of a document against its own faces. */
export function selfComponents(document: LayoutDocumentWallFirst): string[] {
	const faces = extractBoundaryCandidateFaces(document).faces;
	const polygons = new Map(
		document.rooms.map((room) => [room.id, roomBoundaryPolygon(document, room.id)!])
	);
	const witnesses = new Map(
		document.rooms.map((room) => [
			room.id,
			interiorWitness(roomBoundaryPolygon(document, room.id)!)
		])
	);
	return buildCorrespondenceComponents({
		faces,
		predecessorRoomIds: document.rooms.map((room) => room.id),
		predecessorWitnesses: witnesses,
		predecessorPolygons: polygons,
		candidateDocument: document,
		baselineRooms: document.rooms
	}).map((component) => `${component.predecessorRoomIds.length}→${component.candidateFaceKeys.length}`);
}

