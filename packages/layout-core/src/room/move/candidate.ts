import { translateWallCenterline } from '../../wall/centerline';
import { buildRoundRoomGeometryFromCertified, certifyRoundRoom } from '../round-room';
import type {
	LayoutDocumentWallFirst,
	LayoutRoomRound,
	LayoutWallCenterline,
} from '../../wall/types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import { rotatePointAbout, sampleMovedWallProposals, transformWallCenterline } from './shared';

/**
 * The moving set one rigid Room-unit gesture transforms, as its boundary graph:
 * the connected Room group the shared isolation policy resolved at pointer-down.
 */
export type RoomUnitMoveSubgraph = {
	wallIds: readonly string[];
	junctionIds: readonly string[];
	associatedObjectIds?: readonly string[];
};

/** One moved Wall's overlay attempt: its canonical centerline, already transformed. */
export type RoomUnitMoveProposalWall = {
	wallId: string;
	/** Sampled centerline points in document X/Z. Overlay truth only. */
	points: LayoutVec2[];
};

/**
 * The **single** moving-set→candidate mapping shared by the release planner and
 * the live preview proposal below, so neither can describe geometry the other
 * does not have — the same rule the P23.11 architecture proposal follows.
 *
 * Translates the group's boundary Junctions, the centerlines of the group's
 * Walls, and the explicitly associated objects. Nothing is validated and nothing
 * is written back: the caller keeps the canonical baseline installed.
 */
export function roomUnitMoveCandidate(
	document: LayoutDocumentWallFirst,
	subgraph: RoomUnitMoveSubgraph,
	delta: LayoutVec2,
): LayoutDocumentWallFirst {
	const [dx, dz] = delta;
	const movedJunctionIds = new Set(subgraph.junctionIds);
	const movedWallIds = new Set(subgraph.wallIds);
	const associatedObjectIds = new Set(subgraph.associatedObjectIds ?? []);

	// Round Rooms rebuild from the certified centre-local template and add the
	// destination centre once per point so old-location rounding never carries
	// back when translating toward the origin.
	const roundJunctionPoints = new Map<string, LayoutVec2>();
	const roundWallCenterlines = new Map<string, LayoutWallCenterline>();
	const updatedRoomRound = new Map<string, LayoutRoomRound>();
	// Choose each shared Junction and Wall once, by stable Room identity rather
	// than document array order. The release planner certifies all owners below.
	for (const room of [...document.rooms].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
		if (!room.round) continue;
		if (!room.boundary.every((ref) => movedWallIds.has(ref.wallId))) continue;
		const cert = certifyRoundRoom(document, room);
		if (cert.kind !== 'certified') continue;
		const newCenter: LayoutVec2 = [cert.certified.center[0] + dx, cert.certified.center[1] + dz];
		const rebuilt = buildRoundRoomGeometryFromCertified({
			document,
			certified: cert.certified,
			center: newCenter,
			radius: cert.certified.radius,
			seamDirection: cert.certified.seamDirection,
		});
		for (const [id, pt] of rebuilt.junctionPoints)
			if (!roundJunctionPoints.has(id)) roundJunctionPoints.set(id, pt);
		for (const [id, cl] of rebuilt.wallCenterlines)
			if (!roundWallCenterlines.has(id)) roundWallCenterlines.set(id, cl);
		updatedRoomRound.set(room.id, rebuilt.round);
	}

	return {
		...document,
		junctions: document.junctions.map((junction) => {
			const roundPoint = roundJunctionPoints.get(junction.id);
			if (roundPoint) return { ...junction, point: roundPoint };
			return movedJunctionIds.has(junction.id)
				? {
						...junction,
						point: [junction.point[0] + dx, junction.point[1] + dz] as LayoutVec2,
					}
				: junction;
		}),
		// A moved Wall's curve anchors are absolute document X/Z, so
		// they translate with the same delta as its Junctions. Anchors left
		// behind would not preserve the moved shape: the curve would swing back
		// toward the baseline position and can cross a Wall outside the move
		// group. Flat `line` centerlines carry no absolute data and are shared.
		walls: document.walls.map((wall) => {
			const roundCenterline = roundWallCenterlines.get(wall.id);
			if (roundCenterline) return { ...wall, centerline: roundCenterline };
			return movedWallIds.has(wall.id)
				? { ...wall, centerline: translateWallCenterline(wall.centerline, [dx, dz]) }
				: wall;
		}),
		rooms:
			updatedRoomRound.size > 0
				? document.rooms.map((room) => {
						const nextRound = updatedRoomRound.get(room.id);
						return nextRound ? { ...room, round: nextRound } : room;
					})
				: document.rooms,
		objects: document.objects.map((object) =>
			associatedObjectIds.has(object.id)
				? {
						...object,
						position: [
							object.position[0] + dx,
							object.position[1],
							object.position[2] + dz,
						] as typeof object.position,
					}
				: object,
		),
	};
}

/**
 * Derive the live preview of a rigid Room-unit **translation**, without
 * validating or installing a candidate document.
 *
 * Runs the planner's own moving-set→candidate mapping and samples each moved
 * Wall through the one canonical centerline sampler, so the drawn attempt IS the
 * release planner's geometry rather than a second description of it. A rigid
 * translation is shown by moving the canonical points, never by re-deriving a
 * sampling density, so the drawn curve cannot sit fractionally off the committed
 * one. `undefined` results inside the sampler are skipped exactly as the
 * architecture proposal skips them; an empty array is a truthful "nothing to
 * draw", never a rejection.
 */
export function proposeWallFirstRoomUnitGeometry(
	document: LayoutDocumentWallFirst,
	subgraph: RoomUnitMoveSubgraph,
	delta: LayoutVec2,
): RoomUnitMoveProposalWall[] {
	return sampleMovedWallProposals(
		roomUnitMoveCandidate(document, subgraph, delta),
		subgraph.wallIds,
	);
}

/**
 * The **rotation** partner of the candidate above: the same moving set rigidly
 * rotated about `pivot`.
 *
 * WIRED on the owner's direction (pre-P23B.8 follow-up, 2026-09-28), which
 * reversed P23.14 Decision 7 — the reason that decision gave was that a
 * canonical Room has no authored yaw so "a rotation gesture has no honest result
 * to commit", and the honest result is now this candidate, committed by
 * `planWallFirstRoomRotation` exactly as a translation is committed by
 * `planWallFirstRoomMove`. The release re-derives at the release angle against
 * the frozen baseline, so the transient attempt the Plan drag draws is this same
 * mapping (see `proposeWallFirstRoomUnitRotation` below).
 *
 * ONE CAVEAT, recorded rather than hidden: a Wall's canonical sampling density
 * is NOT rotation-invariant, so `samples(rotated)` and `rotate(samples)` do not
 * agree on their sample count. A rotation therefore cannot be drawn by moving
 * the baseline's canonical points, the way a translation is; it is drawn by
 * RESAMPLING the rotated centerline through the same sampler the release uses.
 * That makes the drawn attempt the release's own geometry — stronger than the
 * translation path needs — but the attempt's ink density can differ by a sample
 * from the baseline's. It is a redraw difference, never a geometry difference.
 */
export function rotateRoomUnitMoveCandidate(
	document: LayoutDocumentWallFirst,
	subgraph: RoomUnitMoveSubgraph,
	pivot: LayoutVec2,
	yaw: number,
): LayoutDocumentWallFirst {
	const rotate = (point: LayoutVec2): LayoutVec2 => rotatePointAbout(point, pivot, yaw);
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	const movedJunctionIds = new Set(subgraph.junctionIds);
	const movedWallIds = new Set(subgraph.wallIds);
	const associatedObjectIds = new Set(subgraph.associatedObjectIds ?? []);

	const roundJunctionPoints = new Map<string, LayoutVec2>();
	const roundWallCenterlines = new Map<string, LayoutWallCenterline>();
	const updatedRoomRound = new Map<string, LayoutRoomRound>();
	for (const room of document.rooms) {
		if (!room.round) continue;
		if (!room.boundary.every((ref) => movedWallIds.has(ref.wallId))) continue;
		const cert = certifyRoundRoom(document, room);
		if (cert.kind !== 'certified') continue;
		const newCenter = rotate(cert.certified.center);
		const [ux, uz] = cert.certified.seamDirection;
		const rotatedDir: LayoutVec2 = [ux * cos + uz * sin, -ux * sin + uz * cos];
		const rebuilt = buildRoundRoomGeometryFromCertified({
			document,
			certified: cert.certified,
			center: newCenter,
			radius: cert.certified.radius,
			seamDirection: rotatedDir,
		});
		for (const [id, pt] of rebuilt.junctionPoints) roundJunctionPoints.set(id, pt);
		for (const [id, cl] of rebuilt.wallCenterlines) roundWallCenterlines.set(id, cl);
		updatedRoomRound.set(room.id, rebuilt.round);
	}

	return {
		...document,
		junctions: document.junctions.map((junction) => {
			const roundPoint = roundJunctionPoints.get(junction.id);
			if (roundPoint) return { ...junction, point: roundPoint };
			return movedJunctionIds.has(junction.id)
				? { ...junction, point: rotate(junction.point) }
				: junction;
		}),
		// A rotation is rigid about the pivot, so a moved Wall's absolute curve
		// anchors rotate with its Junctions exactly as they translate with them.
		walls: document.walls.map((wall) => {
			const roundCenterline = roundWallCenterlines.get(wall.id);
			if (roundCenterline) return { ...wall, centerline: roundCenterline };
			return movedWallIds.has(wall.id)
				? { ...wall, centerline: transformWallCenterline(wall.centerline, rotate) }
				: wall;
		}),
		rooms:
			updatedRoomRound.size > 0
				? document.rooms.map((room) => {
						const nextRound = updatedRoomRound.get(room.id);
						return nextRound ? { ...room, round: nextRound } : room;
					})
				: document.rooms,
		// Associated objects follow the same rigid motion as the Walls: an object
		// left in place would keep its baseline X/Z and stop being associated with
		// the Room it travelled with — and an object that orbited with the Room but
		// kept its old heading would point the wrong way. Owner ruling: the yaw is
		// inherited, the same convention as the legacy Room transform.
		objects: document.objects.map((object) => {
			if (!associatedObjectIds.has(object.id)) return object;
			const [x, z] = rotate([object.position[0], object.position[2]]);
			return {
				...object,
				position: [x, object.position[1], z] as typeof object.position,
				rotation: [object.rotation[0], object.rotation[1] + yaw, object.rotation[2]],
			};
		}),
	};
}

/** The overlay attempt for a rigid Room-unit **rotation**. See the candidate above. */
export function proposeWallFirstRoomUnitRotation(
	document: LayoutDocumentWallFirst,
	subgraph: RoomUnitMoveSubgraph,
	pivot: LayoutVec2,
	yaw: number,
): RoomUnitMoveProposalWall[] {
	return sampleMovedWallProposals(
		rotateRoomUnitMoveCandidate(document, subgraph, pivot, yaw),
		subgraph.wallIds,
	);
}
