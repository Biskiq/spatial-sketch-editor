/**
 * Angled-plan test fixtures — extracted by T4 so the noding/projection sweep
 * suite (`angled-plan-noding-sweeps.test.ts`) and the behavioral suite
 * (`p23-6e-extra-angled-plan-integrity.test.ts`) share one owner for the
 * document builders instead of duplicating them across lanes.
 */

import {
	buildCorrespondenceComponents,
	createEmptyWallFirstLayoutDocument,
	extractBoundaryCandidateFaces,
	interiorWitness,
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
	return buildCorrespondenceComponents(
		faces,
		document.rooms.map((room) => room.id),
		witnesses,
		polygons
	).map((component) => `${component.predecessorRoomIds.length}→${component.candidateFaceKeys.length}`);
}

