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
	JUNCTION_COINCIDENCE_EPSILON,
	planWallChain,
	planWallSegment,
	roomBoundaryPolygon,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

/**
 * P23B.3a S6 — how a fixture gesture CONNECTS to existing geometry.
 *
 * The policy reads the operation's DECLARED intent and never the coordinates, so
 * every fixture gesture has to say what it means. The two channels are exactly
 * the planner's:
 *
 * - `hosts` — declare these host Walls (array index = draft point index). This is
 *   what the editor's wall-span snap passes for the endpoint the author clicked
 *   onto a Wall's face, and it is also how an operation states "I attach to that
 *   Wall's group" when it joins a group its endpoints do not touch;
 * - `junctions` — declare these Junction anchors (array index = draft point
 *   index), the stronger statement that names the identity being extended.
 *
 * Omitting the option keeps the fixtures' original, product-faithful reading: an
 * endpoint that lands on an existing straight Wall's SPAN declares that host
 * (snap semantics), and everything else is independent placement.
 */
export type FixtureConnection = {
	hosts?: readonly string[];
	junctions?: readonly string[];
};

export const p = (x: number, z: number): LayoutVec2 => [x, z];

export function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

/**
 * The straight Wall whose SPAN (strict interior) carries `point`, if any — the
 * host a wall-span snap resolves to. Exported because several suites declare the
 * same product behaviour for their own fixtures.
 */
export function hostWallAtSpan(document: LayoutDocumentWallFirst, point: LayoutVec2): string | undefined {
	const pointById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	for (const wall of document.walls) {
		if (wall.centerline.kind !== 'line') continue;
		const start = pointById.get(wall.startJunctionId);
		const end = pointById.get(wall.endJunctionId);
		if (!start || !end) continue;
		const dx = end[0] - start[0];
		const dz = end[1] - start[1];
		const squared = dx * dx + dz * dz;
		if (!(squared > 0)) continue;
		const t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared;
		if (!(t > 0 && t < 1)) continue;
		const distance = Math.hypot(start[0] + dx * t - point[0], start[1] + dz * t - point[1]);
		if (distance <= JUNCTION_COINCIDENCE_EPSILON) return wall.id;
	}
	return undefined;
}

/** The snap semantics an author's clicks express: a host per span-endpoint. */
function snappedHosts(
	document: LayoutDocumentWallFirst,
	start: LayoutVec2,
	end: LayoutVec2
): Array<{ pointIndex: number; wallId: string }> {
	const snaps: Array<{ pointIndex: number; wallId: string }> = [];
	const startHost = hostWallAtSpan(document, start);
	if (startHost) snaps.push({ pointIndex: 0, wallId: startHost });
	const endHost = hostWallAtSpan(document, end);
	if (endHost) snaps.push({ pointIndex: 1, wallId: endHost });
	return snaps;
}

export function plan(
	baseline: LayoutDocumentWallFirst,
	start: LayoutVec2,
	end: LayoutVec2,
	connection?: FixtureConnection
): ReturnType<typeof planWallSegment> {
	const hostSnaps = connection?.hosts
		? connection.hosts.map((wallId, index) => ({ pointIndex: index, wallId }))
		: snappedHosts(baseline, start, end);
	const junctionSnaps = (connection?.junctions ?? []).map((junctionId, index) => ({
		pointIndex: index,
		junctionId
	}));
	return planWallSegment({
		baseline,
		start,
		end,
		role: 'boundary',
		...(hostSnaps.length > 0 ? { endpointHostSnaps: hostSnaps } : {}),
		...(junctionSnaps.length > 0 ? { endpointJunctionSnaps: junctionSnaps } : {})
	});
}

export function commit(
	baseline: LayoutDocumentWallFirst,
	start: LayoutVec2,
	end: LayoutVec2,
	connection?: FixtureConnection
): LayoutDocumentWallFirst {
	const result = plan(baseline, start, end, connection);
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

