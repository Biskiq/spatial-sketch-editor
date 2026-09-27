/**
 * P23B.11 S4 — the M-2/M-3 conditions as TEST-SIDE definitions.
 *
 * WHY THEY LIVE HERE, tests only. The plan makes S4 a GATE: before either conditional
 * mechanism is allowed to land, its condition must be shown to preserve the verdict where
 * real plans live — the CONNECTED case and the D-12 hazard rows. So this module DEFINES
 * both conditions in the terms the mechanisms will implement, with no production code
 * touched, and `p23b11-conditional-gate.test.ts` proves them against the pair proof the
 * shipped pass already runs. S5 implements the mechanisms; this module stays their oracle.
 *
 * THE TWO CONDITIONS, and why they are the same question asked twice.
 *
 * M-3 — THE ROOM-NEUTRAL EARLY-OUT. A candidate face's key IS the canonical boundary cycle
 * key of its boundary (`canonicalBoundaryCycleKey`, the one derivation face extraction and
 * Room lineage share). So a predecessor Room whose own boundary cycle still exists as a
 * candidate face IS that face's owner, by authored identity alone: the union needs no
 * geometry. That is the statement `finalizeWallGeometryDecision` already relies on in the
 * precision path, one component per Room. The rest of the statement is its contrapositive,
 * which is what makes the early-out save whole passes: a face owned by one Room can match
 * NO OTHER Room, and a Room whose own face is identified can match no other face.
 *
 * M-2 — THE AFFECTED EXTENT. A pair the scope leaves out must have ALL FOUR of its inputs
 * unchanged from the baseline (predecessor polygon, witness, face polygon, both component
 * labels), because nothing stores the baseline's verdict — the verdict is known only via
 * identity. The extent here is deliberately STRUCTURAL and cheap: changed/removed Junction
 * and Wall records, and the Rooms/faces whose boundary refs touch them, plus new-key faces
 * (a face with no baseline counterpart cannot have an unchanged polygon). Whether that
 * definition is strong enough is exactly what the gate's four-input oracle measures: if a
 * structurally-unaffected pair's polygon or label moved, the scope as defined is not sound
 * and the gate records it.
 *
 * NO CACHE, NO STATE: every function here is a pure read of the documents it is handed.
 */
import {
	canonicalBoundaryCycleKey,
	correspondenceAuthorization,
	extractBoundaryCandidateFaces,
	interiorWitness,
	roomBoundaryPolygon,
	type DerivedCandidateFace,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

/**
 * The gate's case set: OR-4's (e), (f) and (h) obligations, as the plan names them — every
 * D-12 hazard row, the coincident/nested baselines, and the CONNECTED rows that actually run
 * a correspondence pass. The refused (e) row and the operation-only (h) row are asserted
 * separately in the test: they have no pass, so no condition can be evaluated on them.
 */
export const P23B11_CONDITIONAL_GATE_CASE_IDS: readonly string[] = [
	'e-exact-coincidence-chain-across',
	'e-full-containment-chain-across',
	'f-d12-exact-coincidence-role-change',
	'f-d12-partial-overlap-role-change',
	'f-d12-full-containment-role-change',
	'f-d12-full-containment-mirror-role-change',
	'f-d12-whole-boundary-replacement',
	'd-connected-shared-wall-merge',
	'd-connected-outer-wall-retire',
	'h-connected-authoring-inside',
	'h-connected-room-division'
];

/** One face × predecessor-Room subject, keyed the way both passes can address it. */
export type P23B11PairKey = string;

export function pairKey(faceKey: string, roomId: string): P23B11PairKey {
	return `${faceKey}::${roomId}`;
}

export type P23B11IdentityClaim = { roomId: string; faceKey: string };

/**
 * The M-3 identity set of one pass, derived from authored identity alone.
 *
 * `claims` are the pairs identity settles as UNIONS; `refusalPairs` are the pairs it
 * settles as NON-unions (a Room with a known face against a DIFFERENT Room's known face —
 * the contrapositive that removes every neighbour pair); `ambiguousFaceKeys` are faces two
 * or more Rooms name, which the runtime must REFUSE rather than settle (the merge shape:
 * two predecessors whose boundary cycles became the same one).
 */
export type P23B11IdentityGate = {
	claims: P23B11IdentityClaim[];
	unclaimedRoomIds: string[];
	claimedFaceKeys: string[];
	ambiguousFaceKeys: string[];
	claimPairs: P23B11IdentityClaim[];
	refusalPairs: P23B11IdentityClaim[];
	settledPairKeys: P23B11PairKey[];
	geometryPairKeys: P23B11PairKey[];
	totalPairs: number;
};

export function identityGate(options: {
	baseline: LayoutDocumentWallFirst;
	faces: readonly Pick<DerivedCandidateFace, 'key'>[];
}): P23B11IdentityGate {
	const { baseline, faces } = options;
	const faceKeySet = new Set(faces.map((face) => face.key));
	const faceKeyByRoomId = new Map<string, string>();
	for (const room of baseline.rooms) {
		const key = canonicalBoundaryCycleKey(room.boundary);
		if (faceKeySet.has(key)) faceKeyByRoomId.set(room.id, key);
	}
	const claimantsByFaceKey = new Map<string, string[]>();
	for (const [roomId, faceKey] of faceKeyByRoomId) {
		const claimants = claimantsByFaceKey.get(faceKey) ?? [];
		claimants.push(roomId);
		claimantsByFaceKey.set(faceKey, claimants);
	}
	const ambiguousFaceKeys = new Set(
		[...claimantsByFaceKey].filter(([, claimants]) => claimants.length > 1).map(([key]) => key)
	);
	const claims: P23B11IdentityClaim[] = [];
	for (const [roomId, faceKey] of faceKeyByRoomId) {
		if (ambiguousFaceKeys.has(faceKey)) continue;
		claims.push({ roomId, faceKey });
	}
	// Settled: both sides of the pair resolve to exactly one owner. Refused: both resolve and
	// it is the wrong pairing — the face belongs to a different (unambiguous) Room.
	const claimByRoomId = new Map(claims.map((claim) => [claim.roomId, claim.faceKey]));
	const unambiguousFaceKeys = new Set(claims.map((claim) => claim.faceKey));
	const claimPairs: P23B11IdentityClaim[] = [];
	const refusalPairs: P23B11IdentityClaim[] = [];
	const settledPairKeys: P23B11PairKey[] = [];
	const geometryPairKeys: P23B11PairKey[] = [];
	for (const face of faces) {
		for (const room of baseline.rooms) {
			const key = pairKey(face.key, room.id);
			const roomFaceKey = claimByRoomId.get(room.id);
			if (roomFaceKey === undefined || !unambiguousFaceKeys.has(face.key)) {
				geometryPairKeys.push(key);
				continue;
			}
			if (roomFaceKey === face.key) claimPairs.push({ roomId: room.id, faceKey: face.key });
			else refusalPairs.push({ roomId: room.id, faceKey: face.key });
			settledPairKeys.push(key);
		}
	}
	return {
		claims,
		unclaimedRoomIds: baseline.rooms
			.filter((room) => !faceKeyByRoomId.has(room.id))
			.map((room) => room.id),
		claimedFaceKeys: [...unambiguousFaceKeys],
		ambiguousFaceKeys: [...ambiguousFaceKeys],
		claimPairs,
		refusalPairs,
		settledPairKeys,
		geometryPairKeys,
		totalPairs: faces.length * baseline.rooms.length
	};
}

/** The M-2 extent, structural: what the change can reach, not what it happened to touch. */
export type P23B11ChainAffectedExtent = {
	changedJunctionIds: string[];
	changedWallIds: string[];
	removedWallIds: string[];
	affectedRoomIds: string[];
	affectedFaceKeys: string[];
};

function recordsEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function chainAffectedExtent(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
}): P23B11ChainAffectedExtent {
	const { baseline, candidate } = options;
	const baselineJunctionById = new Map(baseline.junctions.map((junction) => [junction.id, junction]));
	const changedJunctionIds: string[] = [];
	for (const junction of candidate.junctions) {
		const previous = baselineJunctionById.get(junction.id);
		baselineJunctionById.delete(junction.id);
		if (!previous || !recordsEqual(previous.point, junction.point)) changedJunctionIds.push(junction.id);
	}
	// Junctions the candidate REMOVED are unavailable too: a Wall record referencing one can
	// no longer resolve, which is how a whole-boundary replacement reaches its Room.
	for (const junction of baselineJunctionById.values()) changedJunctionIds.push(junction.id);
	const candidateWallById = new Map(candidate.walls.map((wall) => [wall.id, wall]));
	const changedWallIdSet = new Set<string>();
	for (const wall of candidate.walls) {
		const previous = baseline.walls.find((candidateWall) => candidateWall.id === wall.id);
		if (!previous || !recordsEqual(previous, wall)) changedWallIdSet.add(wall.id);
	}
	// P23B.7's own conservatism: a Wall incident to a MOVED Junction is affected even when
	// its own record is byte-identical — its geometry derives from the Junction it references.
	const changedJunctionIdSet = new Set(changedJunctionIds);
	for (const wall of candidate.walls) {
		if (
			changedJunctionIdSet.has(wall.startJunctionId) ||
			changedJunctionIdSet.has(wall.endJunctionId)
		) {
			changedWallIdSet.add(wall.id);
		}
	}
	const changedWallIds = [...changedWallIdSet];
	const removedWallIds: string[] = [];
	for (const wall of baseline.walls) {
		if (!candidateWallById.has(wall.id)) removedWallIds.push(wall.id);
	}
	const unavailableWallIds = new Set([...changedWallIds, ...removedWallIds]);
	const candidateRoomById = new Map(candidate.rooms.map((room) => [room.id, room]));
	const affectedRoomIds: string[] = [];
	for (const room of baseline.rooms) {
		const candidateRoom = candidateRoomById.get(room.id);
		const changedBoundary = !candidateRoom || !recordsEqual(room, candidateRoom);
		const touchesChangedWall =
			changedBoundary ||
			room.boundary.some((ref) => unavailableWallIds.has(ref.wallId)) ||
			(candidateRoom?.boundary.some((ref) => unavailableWallIds.has(ref.wallId)) ?? false);
		if (touchesChangedWall) affectedRoomIds.push(room.id);
	}
	const baselineFaces = extractBoundaryCandidateFaces(baseline).faces;
	const baselineFaceByKey = new Map(baselineFaces.map((face) => [face.key, face]));
	const candidateFaces = extractBoundaryCandidateFaces(candidate).faces;
	const affectedFaceKeys: string[] = [];
	for (const face of candidateFaces) {
		const baselineFace = baselineFaceByKey.get(face.key);
		const touchesChangedWall = face.boundary.some((ref) => unavailableWallIds.has(ref.wallId));
		// A face with no baseline counterpart is new by construction: no baseline polygon can
		// be equal to it, so it can never be an excluded side.
		const changedGeometry =
			!baselineFace || !recordsEqual(baselineFace.polygon, face.polygon);
		if (touchesChangedWall || changedGeometry) affectedFaceKeys.push(face.key);
	}
	return {
		changedJunctionIds,
		changedWallIds,
		removedWallIds,
		affectedRoomIds,
		affectedFaceKeys
	};
}

/** The four inputs one pair decision consumes, serialized for exact comparison. */
export type P23B11PairInputs = {
	predecessorPolygon: string;
	witness: string;
	facePolygon: string;
	roomLabel: string | null;
	faceLabel: string | null;
};

/**
 * Every pair subject's inputs for ONE side of the differential. The BASELINE side is the
 * self-pass — the baseline reconciled against itself, the only baseline pair decision that
 * exists without a cache — and the CANDIDATE side is the pass under test. Identical
 * construction on both sides: same baseline polygon/witness derivation, same shipped
 * authority for the labels.
 */
export function pairInputs(options: {
	baseline: LayoutDocumentWallFirst;
	candidateDocument: Pick<LayoutDocumentWallFirst, 'walls' | 'junctions'>;
	faces: readonly DerivedCandidateFace[];
}): Map<P23B11PairKey, P23B11PairInputs> {
	const { baseline } = options;
	const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
	const predecessorWitnesses = new Map<string, LayoutVec2>();
	for (const room of baseline.rooms) {
		const polygon = roomBoundaryPolygon(baseline, room.id);
		if (!polygon) continue;
		predecessorPolygons.set(room.id, polygon);
		predecessorWitnesses.set(room.id, interiorWitness(polygon));
	}
	const authorization = correspondenceAuthorization({
		baselineRooms: baseline.rooms,
		candidateDocument: options.candidateDocument,
		faces: options.faces
	});
	const inputs = new Map<P23B11PairKey, P23B11PairInputs>();
	for (const face of options.faces) {
		for (const room of baseline.rooms) {
			const polygon = predecessorPolygons.get(room.id);
			const witness = predecessorWitnesses.get(room.id);
			inputs.set(pairKey(face.key, room.id), {
				predecessorPolygon: JSON.stringify(polygon ?? null),
				witness: JSON.stringify(witness ?? null),
				facePolygon: JSON.stringify(face.polygon),
				roomLabel: authorization.predecessorComponentKeyByRoomId.get(room.id) ?? null,
				faceLabel: authorization.faceComponentKeyByKey.get(face.key) ?? null
			});
		}
	}
	return inputs;
}

/** True when the pair is excluded from the scope: NEITHER side is affected. */
export function isPairExcluded(options: {
	extent: P23B11ChainAffectedExtent;
	faceKey: string;
	roomId: string;
}): boolean {
	return (
		!options.extent.affectedFaceKeys.includes(options.faceKey) &&
		!options.extent.affectedRoomIds.includes(options.roomId)
	);
}
