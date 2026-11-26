import { UNIT_TEMPLATE_SCALARS, unitToWorldPoint } from '../round-template';
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { LayoutDocumentIssue } from '../../plan/issue';
import type {
	LayoutDocumentWallFirst,
	LayoutRoomRound,
	LayoutWallCenterline,
	LayoutWallCubicSpan,
	LayoutWallCurveKnot,
} from '../../wall/types';
import type { CertifiedRoundRoom, CertifiedRoundSubspan } from './certify';
import { certifyRoundRoom, isEnclosedClosedCircleBoundary } from './certify';
import { TEMPLATE_SPAN_COUNT, templateSubspanUnitScalar } from './interval';

/**
 * Validate all Rooms in a Layout document for Round consistency:
 * - rejects any enclosed closed-circle Room that omits `round`;
 * - certifies every Room carrying `round` (isolated closed Wall or open cubic ring).
 */
export function validateRoundRooms(
	document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls' | 'rooms'>,
	path = '$',
): LayoutDocumentIssue[] {
	const issues: LayoutDocumentIssue[] = [];
	const junctionById = new Map(document.junctions.map((j) => [j.id, j] as const));
	const wallById = new Map(document.walls.map((w) => [w.id, w] as const));
	for (let index = 0; index < document.rooms.length; index += 1) {
		const room = document.rooms[index]!;
		const roomPath = `${path}.rooms[${index}]`;
		if (room.round === undefined) {
			if (isEnclosedClosedCircleBoundary(room, wallById)) {
				issues.push({
					path: `${roomPath}.round`,
					code: 'missing_round_fact',
					message: `Enclosed closed-circle Room '${room.id}' must state round centre and radius`,
				});
			}
			continue;
		}
		const result = certifyRoundRoom(document, room, roomPath, { junctionById, wallById });
		if (result.kind === 'invalid') {
			issues.push(result.issue);
		}
	}
	return issues;
}

/**
 * Rebuild a certified Round Room's Wall centerlines and Junction points at a
 * target `(center, radius, seamDirection)` by applying the local template once
 * and adding `center` once per point at the write boundary.
 *
 * Preserves all Wall IDs, Junction IDs, knot IDs and Wall orientations. Uses
 * one shared Junction coordinate per shared Junction.
 */
export function buildRoundRoomGeometryFromCertified(options: {
	readonly document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'>;
	readonly certified: CertifiedRoundRoom;
	readonly center: LayoutVec2;
	readonly radius: number;
	readonly seamDirection: LayoutVec2;
	/** Optional explicit seam point (e.g. exact authored rim on initial creation). */
	readonly explicitSeamPoint?: LayoutVec2;
}): {
	readonly junctionPoints: ReadonlyMap<string, LayoutVec2>;
	readonly wallCenterlines: ReadonlyMap<
		string,
		Extract<LayoutWallCenterline, { kind: 'cubic-chain' }>
	>;
	readonly round: LayoutRoomRound;
} {
	const { document, certified, center, radius, seamDirection, explicitSeamPoint } = options;
	const wallById = new Map(document.walls.map((w) => [w.id, w] as const));
	const junctionPoints = new Map<string, LayoutVec2>();

	const seamWorld: LayoutVec2 = explicitSeamPoint
		? [explicitSeamPoint[0], explicitSeamPoint[1]]
		: unitToWorldPoint(UNIT_TEMPLATE_SCALARS[0]![0], center, radius, seamDirection);
	junctionPoints.set(certified.seamJunctionId, seamWorld);

	// Group subspans by Wall so each Wall's knots and spans are written cleanly.
	const wallSubspans = new Map<string, CertifiedRoundSubspan[]>();
	for (const sub of certified.subspans) {
		const list = wallSubspans.get(sub.wallId) ?? [];
		list.push(sub);
		wallSubspans.set(sub.wallId, list);
	}

	const wallCenterlines = new Map<string, Extract<LayoutWallCenterline, { kind: 'cubic-chain' }>>();

	for (const [wallId, subs] of wallSubspans.entries()) {
		const wall = wallById.get(wallId)!;
		if (wall.centerline.kind !== 'cubic-chain') {
			throw new Error(`Certified Round Wall '${wallId}' must be a cubic-chain`);
		}
		const spanCount = wall.centerline.spans.length;
		const newSpans: LayoutWallCubicSpan[] = new Array(spanCount);
		const newKnotPoints: LayoutVec2[] = new Array(wall.centerline.knots.length);

		for (const sub of subs) {
			const unitPts = templateSubspanUnitScalar(sub.templateSpanIndex, sub.tStart, sub.tEnd);
			const isSeamStart = sub.templateSpanIndex === 0 && sub.tStart === 0;
			const isSeamEnd = sub.templateSpanIndex === TEMPLATE_SPAN_COUNT - 1 && sub.tEnd === 1;
			const p0 = isSeamStart
				? seamWorld
				: unitToWorldPoint(unitPts[0], center, radius, seamDirection);
			const p1 = unitToWorldPoint(unitPts[1], center, radius, seamDirection);
			const p2 = unitToWorldPoint(unitPts[2], center, radius, seamDirection);
			const p3 = isSeamEnd
				? seamWorld
				: unitToWorldPoint(unitPts[3], center, radius, seamDirection);

			const s = sub.wallSpanIndex;
			if (sub.direction === 'forward') {
				newSpans[s] = { handleOut: p1, handleIn: p2 };
				if (s === 0 && !junctionPoints.has(wall.startJunctionId)) {
					junctionPoints.set(wall.startJunctionId, p0);
				}
				if (s === spanCount - 1 && !junctionPoints.has(wall.endJunctionId)) {
					junctionPoints.set(wall.endJunctionId, p3);
				}
				if (s < spanCount - 1) {
					newKnotPoints[s] = p3;
				}
			} else {
				newSpans[s] = { handleOut: p2, handleIn: p1 };
				if (s === spanCount - 1 && !junctionPoints.has(wall.endJunctionId)) {
					junctionPoints.set(wall.endJunctionId, p0);
				}
				if (s === 0 && !junctionPoints.has(wall.startJunctionId)) {
					junctionPoints.set(wall.startJunctionId, p3);
				}
				if (s > 0) {
					newKnotPoints[s - 1] = p3;
				}
			}
		}

		const newKnots: LayoutWallCurveKnot[] = wall.centerline.knots.map((knot, idx) => ({
			id: knot.id,
			point: newKnotPoints[idx]!,
		}));
		wallCenterlines.set(wallId, {
			kind: 'cubic-chain',
			knots: newKnots,
			spans: newSpans,
		});
	}

	return {
		junctionPoints,
		wallCenterlines,
		round: {
			center: [center[0], center[1]],
			radius,
		},
	};
}
