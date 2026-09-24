/**
 * P23B.3a S3 → S3a — OR-D12-1…6: the recorded reproduction, then the proof.
 *
 * S3 recorded the hazard against the unfixed reconciliation. S3a implemented the
 * guarantee (a predecessor Room and a candidate face may union only when
 * authored identity puts them in the same connected component of the candidate
 * Wall graph) and this file became its PROOF. The pre-fix measurements are kept
 * in the comments of each measured-outcome test as the historical half of the
 * differential; the assertions assert the post-fix result, which is why the
 * `it.fails` cases of S3 are ordinary `it` cases here.
 *
 * D-12's guarantee: an UNRELATED group retains its identity; the OPERATED group
 * retains or changes identity only per that operation's own existing authorized
 * lineage contract; spatial overlap ALONE may never cause either change.
 *
 * The pre-states are two graph-INDEPENDENT Rooms that share no Junction id and
 * overlap only geometrically — `room-k` is the UNRELATED one, `room-c` is the
 * OPERATED one. They are exactly what the policy makes admissible at S4.
 *
 * HOW THE TWO KINDS OF CASE ARE WRITTEN, and why:
 *
 * - the MEASURED OUTCOME of each shape is asserted as an ordinary, passing test,
 *   so the pre-fix result is recorded precisely rather than described. These
 *   observations are replaced at S3a (the guarantee tests below take over) with
 *   the measured numbers kept here as the historical half of the differential;
 * - the GUARANTEE is asserted only about the UNRELATED Room's identity and
 *   ownership. It never requires the OPERATED Room to survive: a role change on
 *   the operated Room's Wall legitimately retires that Room under its own
 *   lineage contract, and demanding its survival would make the case pass or
 *   fail for a reason that has nothing to do with D-12;
 * - where the guarantee already HOLDS, the case is an ordinary passing test; where
 *   it does not, `it.fails` keeps the FINDING as a required check while the
 *   guarantee itself stays outside every mandatory green lane (the ratified S3
 *   quarantine). S3a converts the remaining `it.fails` into ordinary `it` cases.
 *
 * OR-D12-5 and OR-D12-6 obligations for S3a: evaluate against the GENERAL
 * Wall/Junction test (`wallJunctionComponents`), never `connectedRoomIds`, and
 * exercise every caller: wall delete · role change · dissolve · migration ·
 * Room move · chain. Role change is the caller exercised here.
 *
 * The D-12 FALLBACK proof has its own suite at the end of this file: faces are
 * always extracted from the candidate document they are reconciled against, and
 * the assertion is the reconciliation OUTCOME. Its comment records which
 * boundary replacements a shipped planner can actually reach — and which it
 * cannot, so the limitation is documented rather than covered by new capability.
 */
import { describe, expect, it } from 'vitest';

import {
	buildCorrespondenceComponents,
	connectedRoomIds,
	correspondenceAuthorization,
	createAuthoringRoomAllocator,
	createEmptyWallFirstLayoutDocument,
	decodeLayoutValueCompatible,
	extractBoundaryCandidateFaces,
	interiorWitness,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	migrateLegacyLayoutDocument,
	reconcileRooms,
	roomBoundaryPolygon,
	planDeleteWall,
	planDissolveJunction,
	planRemoveRoom,
	planWallChain,
	planWallFirstRoomMove,
	planWallRoleChange,
	planWallSubdivision,
	validateWallFirstLayoutDocument,
	validateWallFirstTopology,
	type LayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type NodingIdAllocator
} from '@portfolio/layout-core';

const LINE: LayoutWallCenterline = { kind: 'line' };

function wall(id: string, start: string, end: string, role: 'boundary' | 'partition') {
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		role,
		thickness: 0.2,
		height: 3,
		centerline: LINE
	} as LayoutWall;
}

function emptyDocument(): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	base.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	return base;
}

type Enclosure = { prefix: string; x: number; z: number; width: number; depth: number };

/** One closed rectangular enclosure with its OWN Junctions and boundary cycle. */
function enclosure(options: Enclosure) {
	const { prefix, x, z, width, depth } = options;
	const junctions = [
		{ id: `${prefix}-a`, point: [x, z] as LayoutVec2 },
		{ id: `${prefix}-b`, point: [x + width, z] as LayoutVec2 },
		{ id: `${prefix}-c`, point: [x + width, z + depth] as LayoutVec2 },
		{ id: `${prefix}-d`, point: [x, z + depth] as LayoutVec2 }
	];
	const walls = [
		wall(`${prefix}-a1`, `${prefix}-a`, `${prefix}-b`, 'boundary'),
		wall(`${prefix}-b1`, `${prefix}-b`, `${prefix}-c`, 'boundary'),
		wall(`${prefix}-c1`, `${prefix}-c`, `${prefix}-d`, 'boundary'),
		wall(`${prefix}-d1`, `${prefix}-d`, `${prefix}-a`, 'boundary')
	];
	const room = {
		id: `room-${prefix}`,
		name: `Room ${prefix}`,
		boundary: [
			{ wallId: `${prefix}-a1`, direction: 'forward' as const },
			{ wallId: `${prefix}-b1`, direction: 'forward' as const },
			{ wallId: `${prefix}-c1`, direction: 'forward' as const },
			{ wallId: `${prefix}-d1`, direction: 'forward' as const }
		],
		floorThickness: 0.1,
		ceilingThickness: 0.1
	};
	return { junctions, walls, room };
}

/**
 * Two graph-independent Rooms plus the UNRELATED Room's OWNED state: one
 * associated object and one hosted Opening, so "identity" means id and name and
 * "ownership" means the object→Room and Opening→Wall bindings.
 */
function pairDocument(operated: Enclosure, unrelated: Enclosure): LayoutDocumentWallFirst {
	const base = emptyDocument();
	const unrelatedEnclosure = enclosure(unrelated);
	const operatedEnclosure = enclosure(operated);
	return {
		...base,
		junctions: [...unrelatedEnclosure.junctions, ...operatedEnclosure.junctions],
		walls: [...unrelatedEnclosure.walls, ...operatedEnclosure.walls],
		rooms: [unrelatedEnclosure.room, operatedEnclosure.room],
		openings: [
			{
				id: 'opening:k:door:1',
				wallId: 'k-a1',
				kind: 'door',
				offset: 1,
				width: 0.9,
				height: 2.1,
				sillHeight: 0,
				profile: 'rectangular'
			}
		],
		objects: [
			{
				id: 'obj-k',
				kind: 'box',
				position: [3, 0.5, 2],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-k'
			}
		]
	};
}

/** OR-D12-1 pre-state: identical coordinates, distinct identities. */
const EXACT_COINCIDENCE = pairDocument(
	{ prefix: 'c', x: 0, z: 0, width: 6, depth: 4 },
	{ prefix: 'k', x: 0, z: 0, width: 6, depth: 4 }
);

/** OR-D12-2 pre-state: the operated Room partly overlaps the unrelated one. */
const PARTIAL_OVERLAP = pairDocument(
	{ prefix: 'c', x: 3, z: 0, width: 6, depth: 4 },
	{ prefix: 'k', x: 0, z: 0, width: 6, depth: 4 }
);

/** OR-D12-3 pre-state: the operated Room is wholly INSIDE the unrelated one. */
const FULL_CONTAINMENT = pairDocument(
	{ prefix: 'c', x: 1, z: 1, width: 4, depth: 2 },
	{ prefix: 'k', x: 0, z: 0, width: 6, depth: 4 }
);

/**
 * Minimal legacy storey. `layout` is either two Rooms occupying IDENTICAL extents
 * (the collapsed-lineage case) or two Rooms sharing a Wall (the legitimate case),
 * and each Room owns one associated legacy object so an identity merge would be
 * visible as a remapped association.
 */
function legacyDocumentWithCoincidentRooms(
	order: [string, string] = ['room-1', 'room-2'],
	layout: 'coincident' | 'shared-wall' = 'coincident'
): LayoutDocument {
	const extents: Record<string, [number, number, number, number]> = {
		'room-1': [0, 0, 6, 4],
		'room-2': layout === 'coincident' ? [0, 0, 6, 4] : [6, 0, 12, 4]
	};
	const names: Record<string, string> = { 'room-1': 'Legacy one', 'room-2': 'Legacy two' };
	const legacyRoom = (id: string) => {
		const [minX, minZ, maxX, maxZ] = extents[id]!;
		return {
			id,
			name: names[id]!,
			frame: { origin: [0, 0] as LayoutVec2, yaw: 0 },
			wallThickness: 0.2,
			floorThickness: 0.1,
			ceilingThickness: 0.1,
			boundary: {
				closed: true,
				segments: [
					{ id: `${id}-s`, kind: 'line' as const, start: [minX, minZ] as LayoutVec2, end: [maxX, minZ] as LayoutVec2 },
					{ id: `${id}-e`, kind: 'line' as const, start: [maxX, minZ] as LayoutVec2, end: [maxX, maxZ] as LayoutVec2 },
					{ id: `${id}-n`, kind: 'line' as const, start: [maxX, maxZ] as LayoutVec2, end: [minX, maxZ] as LayoutVec2 },
					{ id: `${id}-w`, kind: 'line' as const, start: [minX, maxZ] as LayoutVec2, end: [minX, minZ] as LayoutVec2 }
				]
			},
			openings: []
		};
	};
	const objectFor = (id: string) => ({
		id: `obj-${id}`,
		kind: 'box' as const,
		position: [1, 0.5, 1] as [number, number, number],
		rotation: [0, 0, 0] as [number, number, number],
		dimensions: [1, 1, 1] as [number, number, number],
		roomId: id
	});
	return {
		units: 'meters',
		floors: [
			{
				id: 'floor-1',
				name: 'Floor 1',
				elevation: 0,
				height: 3,
				rooms: order.map((id) => legacyRoom(id))
			}
		],
		objects: order.map((id) => objectFor(id))
	} as unknown as LayoutDocument;
}

/** The operation under test: change the OPERATED Room's own south Wall to partition. */
function operateOnOperatedRoom(document: LayoutDocumentWallFirst) {
	expect(document.rooms.map((room) => room.id)).toContain('room-c');
	return planWallRoleChange(document, 'c-a1', 'partition');
}

function roomsOf(document: LayoutDocumentWallFirst) {
	return document.rooms.map((room) => [room.id, room.name] as const);
}

function ownedObjectRoomId(document: LayoutDocumentWallFirst, objectId: string) {
	return document.objects.find((object) => object.id === objectId)?.roomId;
}

describe('P23B.3a S3 — the D-12 hazard, measured against the current reconciliation', () => {
	it('records the pre-state verdicts, re-based at S4/S5 onto the component-scoped subject', () => {
		// The codec accepts all three: topology is explicitly outside its scope.
		for (const document of [EXACT_COINCIDENCE, PARTIAL_OVERLAP, FULL_CONTAINMENT]) {
			expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		}
		// 1. EXACT COINCIDENCE — S3 RECORDED 'duplicate_junction_point' HERE, refused by
		//    the then-DOCUMENT-WIDE coincidence rule. THAT HALF FLIPPED AT S5, which
		//    scoped the rule to the connected component (D-9): the two enclosures' Junctions
		//    share no component, so identical coordinates are permitted geometry and the
		//    document is ADMITTED. The pre-policy verdict survives as the recorded history
		//    above rather than as an assertion (AM-1). The containment direction — coincident
		//    nodes INSIDE one component stay invalid — is pinned by the S5 oracle, and the
		//    same scoping is what keeps this hazard's own operations admissible.
		expect(validateWallFirstTopology(EXACT_COINCIDENCE)).toBeUndefined();
		// 2. PARTIAL OVERLAP — S3 RECORDED 'unsupported_wall_topology' HERE, refused by
		//    the then-document-global wall-geometry rule. THAT HALF FLIPPED AT S4, which
		//    scoped the gate's subject to the connected component: the two enclosures
		//    share no Junction id, so their collinear overlap is permitted geometry (F5)
		//    and the document is ADMITTED. The pre-policy verdict survives as the
		//    recorded history above rather than as an assertion (AM-1).
		expect(validateWallFirstTopology(PARTIAL_OVERLAP)).toBeUndefined();
		// 3. FULL CONTAINMENT — ALREADY ADMITTED before the policy: the contained
		//    enclosure's Walls intersect nothing and there is no coincident Junction to
		//    catch. Unchanged by S4 and by S5's coincidence scoping.
		expect(validateWallFirstTopology(FULL_CONTAINMENT)).toBeUndefined();
	});

	it('MEASURED (S3a), exact coincidence — the UNRELATED Room survives and keeps its owned object', () => {
		// S3 MEASURED THIS BEFORE THE FIX, and the numbers are the reason the fix
		// exists: rooms were [['room-c','Room c']], retiredRoomIds were ['room-k'], and
		// `room-k`'s owned object had been TRANSFERRED to `room-c` — spatial overlap
		// alone had changed an unrelated group's identity AND ownership.
		const plan = operateOnOperatedRoom(EXACT_COINCIDENCE);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// Now the two coincident Rooms never share a correspondence component, so the
		// unrelated Room keeps its id/name and the operation's own Room retires as its
		// boundary stops enclosing.
		expect(roomsOf(plan.document)).toEqual([['room-k', 'Room k']]);
		expect(plan.retiredRoomIds).toEqual(['room-c']);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
		expect(plan.document.openings.map((opening) => [opening.id, opening.wallId])).toEqual([
			['opening:k:door:1', 'k-a1']
		]);
	});

	it('MEASURED (S3 and S3a agree), partial overlap — the UNRELATED Room survives; the OPERATED Room is retired', () => {
		const plan = operateOnOperatedRoom(PARTIAL_OVERLAP);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// The face is attributed to its own predecessor here, so `room-k` keeps its
		// id, its name and its object, and the operation's own Room is the one that
		// retires — a legitimate lineage effect of the operation, not a D-12 defect.
		expect(roomsOf(plan.document)).toEqual([['room-k', 'Room k']]);
		expect(plan.retiredRoomIds).toEqual(['room-c']);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
	});

	it('MEASURED (S3 and S3a agree), containment — containment alone is NOT the defect', () => {
		const plan = operateOnOperatedRoom(FULL_CONTAINMENT);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// Recorded so the hazard is not over-claimed: containing the operated Room
		// does not by itself reassign the unrelated Room's identity or ownership.
		expect(roomsOf(plan.document)).toEqual([['room-k', 'Room k']]);
		expect(plan.retiredRoomIds).toEqual(['room-c']);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
	});

	it('OR-D12-1 — exact coincidence: the UNRELATED Room keeps its identity AND its owned object', () => {
		const plan = operateOnOperatedRoom(EXACT_COINCIDENCE);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// ONLY the unrelated group is asserted on: the operated Room's own fate is its
		// operation's business and is deliberately not required here.
		expect(roomsOf(plan.document)).toContainEqual(['room-k', 'Room k']);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
	});

	it('OR-D12-2 — partial overlap keeps the unrelated identity and ownership', () => {
		const plan = operateOnOperatedRoom(PARTIAL_OVERLAP);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(roomsOf(plan.document)).toContainEqual(['room-k', 'Room k']);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
	});

	it('OR-D12-3 — containment is not a lineage event for the unrelated Room', () => {
		const plan = operateOnOperatedRoom(FULL_CONTAINMENT);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(roomsOf(plan.document)).toContainEqual(['room-k', 'Room k']);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
		expect(plan.document.openings.map((opening) => [opening.id, opening.wallId])).toContainEqual([
			'opening:k:door:1',
			'k-a1'
		]);
	});

	it('OR-D12-4 — only the OPERATED Room follows its role-change lineage contract', () => {
		const plan = operateOnOperatedRoom(FULL_CONTAINMENT);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// The operation's own boundary Wall becomes a partition, so its Room may
		// retire under its existing contract. Spatial containment does not transfer
		// that identity or its associated state to the unrelated Room.
		expect(plan.retiredRoomIds).toEqual(['room-c']);
		expect(roomsOf(plan.document)).toEqual([['room-k', 'Room k']]);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
		expect(plan.document.openings.map((opening) => [opening.id, opening.wallId])).toEqual([
			['opening:k:door:1', 'k-a1']
		]);
	});

	it('OR-D12-5 — the authority is the GENERAL Wall/Junction test, never connectedRoomIds', () => {
		// A standalone partition stub reaching one of `room-k`'s own Junctions.
		const withStub: LayoutDocumentWallFirst = {
			...EXACT_COINCIDENCE,
			junctions: [
				...EXACT_COINCIDENCE.junctions,
				{ id: 'k-c-out', point: [6, 8] as LayoutVec2 }
			],
			walls: [
				...EXACT_COINCIDENCE.walls,
				{
					id: 'k-stub',
					startJunctionId: 'k-c',
					endJunctionId: 'k-c-out',
					role: 'partition',
					thickness: 0.2,
					height: 3,
					centerline: LINE
				}
			]
		};
		// The ROOM-only helper cannot see the stub at all...
		expect([...connectedRoomIds(withStub, 'room-k')]).toEqual(['room-k']);
		// ... while the general authority classifies it into `room-k`'s component, and
		// still keeps the two coincident Rooms apart.
		const faces = extractBoundaryCandidateFaces(withStub).faces;
		const authorization = correspondenceAuthorization({
			baselineRooms: withStub.rooms,
			candidateDocument: withStub,
			faces
		});
		const faceOfK = faces.find((face) =>
			face.boundary.some((ref) => ref.wallId === 'k-a1' || ref.wallId === 'k-stub')
		)!;
		const faceOfC = faces.find((face) =>
			face.boundary.some((ref) => ref.wallId === 'c-a1')
		)!;
		expect(authorization.predecessorComponentKeyByRoomId.get('room-k')).toBe(
			authorization.faceComponentKeyByKey.get(faceOfK.key)
		);
		expect(authorization.predecessorComponentKeyByRoomId.get('room-k')).not.toBe(
			authorization.faceComponentKeyByKey.get(faceOfC.key)
		);
		expect(authorization.predecessorComponentKeyByRoomId.get('room-c')).not.toBe(
			authorization.predecessorComponentKeyByRoomId.get('room-k')
		);
	});
});

describe('P23B.3a S3a — OR-D12-6, the other reconciliation callers', () => {
	/** Split the OPERATED Room's south Wall at a midpoint Junction (collinear pair). */
	function splitOperatedSouthWall(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
		const southWalls = document.walls.filter((wall) => wall.id !== 'c-a1');
		return {
			...document,
			junctions: [...document.junctions, { id: 'c-mid', point: [3, 1] as LayoutVec2 }],
			walls: [
				...southWalls,
				{ ...document.walls.find((wall) => wall.id === 'c-a1')!, id: 'c-a1a', endJunctionId: 'c-mid' },
				{
					...document.walls.find((wall) => wall.id === 'c-a1')!,
					id: 'c-a1b',
					startJunctionId: 'c-mid'
				}
			],
			rooms: document.rooms.map((room) =>
				room.id !== 'room-c'
					? room
					: {
							...room,
							boundary: room.boundary.flatMap((ref) =>
								ref.wallId === 'c-a1'
									? [
											{ wallId: 'c-a1a', direction: ref.direction },
											{ wallId: 'c-a1b', direction: ref.direction }
										]
									: [ref]
							)
						}
			)
		};
	}

	/** The operated Room's own boundary Wall in the containment pre-state. */
	function assertUnrelatedSurvives(document: LayoutDocumentWallFirst, label: string) {
		expect(
			document.rooms.map((room) => room.id),
			`${label}: the unrelated Room must survive the operation`
		).toContain('room-k');
		expect(document.rooms.find((room) => room.id === 'room-k')?.name).toBe('Room k');
		expect(ownedObjectRoomId(document, 'obj-k')).toBe('room-k');
		expect(document.openings.map((opening) => [opening.id, opening.wallId])).toContainEqual([
			'opening:k:door:1',
			'k-a1'
		]);
	}

	it('OR-D12-6 wall delete — deleting the OPERATED Room\'s Wall leaves the unrelated Room intact', () => {
		const plan = planDeleteWall(FULL_CONTAINMENT, 'c-a1');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		assertUnrelatedSurvives(plan.document, 'wall delete');
	});

	it('OR-D12-6 role change — changing the OPERATED Room\'s Wall keeps unrelated ownership intact', () => {
		const plan = operateOnOperatedRoom(FULL_CONTAINMENT);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		assertUnrelatedSurvives(plan.document, 'role change');
		expect(plan.retiredRoomIds).toEqual(['room-c']);
	});

	it('OR-D12-6 dissolve — dissolving the OPERATED Room\'s Junction leaves the unrelated Room intact', () => {
		// Dissolve only joins COLLINEAR straight Walls, so the operated Room's south
		// Wall is split at a midpoint Junction and that Junction is the one dissolved.
		const split = splitOperatedSouthWall(FULL_CONTAINMENT);
		const plan = planDissolveJunction(split, 'c-mid');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		assertUnrelatedSurvives(plan.document, 'dissolve');
	});

	it('OR-D12-6 chain — authoring into the OPERATED Room\'s Junction leaves the unrelated Room intact', () => {
		const plan = planWallChain({
			baseline: FULL_CONTAINMENT,
			points: [
				[5, 2],
				[8, 2]
			],
			close: false,
			role: 'partition'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		assertUnrelatedSurvives(plan.document, 'chain');
	});

	it('OR-D12-6 migration — collapsed LEGACY Room lineage is REFUSED, and the original project is preserved', () => {
		// Legacy predecessors carry no authored Wall identity, so migration can key
		// only on geometry. Two DISTINCT legacy Rooms resolving to the SAME candidate
		// face is therefore not authorized lineage, and the fail-closed contract makes
		// it a deterministic refusal rather than a successful merge: before this, the
		// migration SUCCEEDED and silently retired 'room-2' along with its association.
		const legacy = legacyDocumentWithCoincidentRooms();
		// The fixture is VALID legacy content, verified through the legacy codec rather
		// than assumed: the refusal below is about Room correspondence, not malformed
		// input.
		const decoded = decodeLayoutValueCompatible(legacy);
		expect(decoded.kind).toBe('legacy');

		const snapshot = JSON.stringify(legacy);
		const result = migrateLegacyLayoutDocument(legacy);
		expect(result.kind).toBe('rejected');
		if (result.kind !== 'rejected') return;
		expect(result.code).toBe('ambiguous-room-correspondence');
		// The refusal names BOTH Rooms, so the failure is attributable.
		const named = result.issues.map((issue) => issue.message).join(' ');
		expect(named).toContain('room-1');
		expect(named).toContain('room-2');
		// Neither Room identity nor object association was silently remapped: no
		// document was produced, and the legacy payload is byte-identical, which is
		// what lets `project-compat` keep the original project on the read-only
		// `legacy-compatible` path.
		expect(JSON.stringify(legacy)).toBe(snapshot);
	});

	it('OR-D12-6 migration — the refusal is independent of the legacy Room ORDER', () => {
		const forward = legacyDocumentWithCoincidentRooms(['room-1', 'room-2']);
		const reversed = legacyDocumentWithCoincidentRooms(['room-2', 'room-1']);
		const forwardResult = migrateLegacyLayoutDocument(forward);
		const reversedResult = migrateLegacyLayoutDocument(reversed);
		expect(forwardResult.kind).toBe('rejected');
		expect(reversedResult.kind).toBe('rejected');
		if (forwardResult.kind !== 'rejected' || reversedResult.kind !== 'rejected') return;
		expect(reversedResult.code).toBe(forwardResult.code);
		// Neither ordering silently keeps a different survivor: both refuse.
		expect(JSON.stringify(reversed)).not.toContain('"kind":"success"');
	});

	it('OR-D12-6 migration — a legitimate SHARED-WALL legacy payload still migrates', () => {
		// The fail-closed rule is about collapapsed lineage, not about migration in
		// general: two Rooms that share a Wall enclose DIFFERENT faces, so each claims
		// exactly one predecessor and the migration proceeds as before.
		const legacy = legacyDocumentWithCoincidentRooms(['room-1', 'room-2'], 'shared-wall');
		const result = migrateLegacyLayoutDocument(legacy);
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.rooms.map((room) => room.id).sort()).toEqual(['room-1', 'room-2']);
	});

	it('OR-D12-6 Room move — moving the OPERATED Room leaves the unrelated Room intact', () => {
		// Room move and migration declare their own exact boundary-lineage
		// components rather than deriving them geometrically, so this is the caller
		// that must be shown to agree with the rest.
		const plan = planWallFirstRoomMove(FULL_CONTAINMENT, 'room-c', [10, 0]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		assertUnrelatedSurvives(plan.document, 'Room move');
	});
});

/**
 * P23B.3a S3a — the D-12 fallback on COHERENT inputs, plus what boundary
 * replacement can actually reach.
 *
 * The first draft of this proof was not coherent (found in review): it renamed
 * the operated Room's Wall ids in the candidate but extracted faces from the
 * BASELINE, so the candidate graph and the candidate faces described two
 * different documents. It showed the low-level guard on input no caller can
 * produce. Both cases here fix that: faces always come from the candidate
 * document they are reconciled against, and the assertion is the OUTCOME of a
 * real reconciliation pass rather than the intermediate grouping.
 *
 * D-12's three cases, each proven separately:
 *
 * (a) UNAUTHORIZED REASSIGNMENT — never. A predecessor that lost every boundary
 *     identity cannot claim a face that authored identity attributes to another
 *     component. Reachable path: `planRemoveRoom` on the exact-coincidence
 *     pre-state, where the operated Room's whole ring goes and only the unrelated
 *     Room's Wall graph remains.
 * (b) AUTHORIZED CONTINUATION — a Room keeps its identity across a Wall-ID change
 *     when the operation supplies the lineage. Reachable path: `planWallSubdivision`,
 *     whose noder gives the survivor the original Wall id plus a new fragment, and
 *     whose precision path declares the 1→1 boundary-cycle lineage explicitly.
 * (c) UNRESOLVABLE LINEAGE — retirement, never a manufactured replacement. The same
 *     removal retires the Room whose enclosure is gone and creates nothing in its
 *     place.
 *
 * WHICH OPERATION REPLACES A WHOLE BOUNDARY? None shipped — recorded as a
 * limitation rather than answered with new capability. The four geometric
 * reconciliation callers, checked one by one:
 *
 * - `planWallRoleChange` keeps every Wall id;
 * - `planWallRemovalSet` / `planRemoveRoom` removes Walls; a Room whose whole ring
 *   is removed stops enclosing a face, so it RETIRES (case c) instead of being
 *   replaced;
 * - `planWallChain` nodes new Walls into the existing graph, and the noder's split
 *   survivor keeps the original Wall id (P23.12 §3), so the predecessor still
 *   resolves;
 * - `planDissolveJunction` joins two Walls onto the survivor's id;
 * - `planWallFirstRoomMove` and `finalizeWallGeometryCandidate` (the precision
 *   path) do not use this gate at all: they declare explicit 1→1 boundary-cycle
 *   lineage, which is how an operation that DOES change a boundary reference must
 *   supply its identity (case b at the contract level);
 * - migration replaces no Wall identity: it keys on geometry only and refuses
 *   collapsed lineage (already proven above).
 *
 * So a Room whose authored boundary identity is entirely gone is always a Room
 * whose enclosure is gone too: it takes rule 3's denial into retirement, never
 * into the unrelated Room it overlapped. The one shape that WOULD produce a
 * replacement face — the same enclosure re-authored under new Wall ids with no
 * declared lineage — is not producible by a shipped planner. The first case below
 * records what the guard does with it so its total behaviour is known; the second
 * proves the reachable paths. If such an operation is ever added, it must declare
 * explicit lineage like the precision path instead of leaning on that branch.
 */
describe('P23B.3a S3a — the D-12 fallback on coherent inputs, and reachable boundary replacement', () => {
	const nodingAllocator: NodingIdAllocator = {
		nextWallId: (_document, seed) => `${seed}-frag`,
		nextJunctionId: (_document, seed) => `${seed}-j`
	};

	/** Baseline-relative predecessor evidence, exactly as the callers derive it. */
	function predecessorEvidence(document: LayoutDocumentWallFirst) {
		const predecessorWitnesses = new Map<string, LayoutVec2>();
		const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
		for (const room of document.rooms) {
			const polygon = roomBoundaryPolygon(document, room.id)!;
			predecessorPolygons.set(room.id, polygon);
			predecessorWitnesses.set(room.id, interiorWitness(polygon));
		}
		return { predecessorWitnesses, predecessorPolygons };
	}

	it('(a)+(c) coherent inputs — an identity-less predecessor cannot claim the unrelated face, and the outcome is its documented retirement', () => {
		// The candidate a whole-boundary REPLACEMENT would produce: every `c-*` Wall
		// carries a NEW authored id, so `room-c`'s baseline boundary references nothing
		// that survives. The faces are extracted from THIS document, so the graph and
		// the faces describe one candidate.
		const baseline = EXACT_COINCIDENCE;
		const candidate: LayoutDocumentWallFirst = {
			...baseline,
			walls: baseline.walls.map((wall) =>
				wall.id.startsWith('c-') ? { ...wall, id: `${wall.id}-replaced` } : wall
			)
		};
		const extraction = extractBoundaryCandidateFaces(candidate);
		expect(extraction.faces).toHaveLength(2);
		const { predecessorWitnesses, predecessorPolygons } = predecessorEvidence(baseline);
		const components = buildCorrespondenceComponents({
			faces: extraction.faces,
			predecessorRoomIds: baseline.rooms.map((room) => room.id),
			predecessorWitnesses,
			predecessorPolygons,
			candidateDocument: candidate,
			baselineRooms: baseline.rooms
		});
		const authorization = correspondenceAuthorization({
			baselineRooms: baseline.rooms,
			candidateDocument: candidate,
			faces: extraction.faces
		});
		// `room-k` keeps authored identity in the candidate graph; `room-c` does not.
		expect(authorization.predecessorComponentKeyByRoomId.get('room-k')).toBeDefined();
		expect(authorization.predecessorComponentKeyByRoomId.get('room-c')).toBeUndefined();
		// A face extracted from the candidate ALWAYS resolves (every candidate Wall is
		// labelled), which is why the one-sided denial is the branch that fires here
		// and the defensive neither-resolves branch is not what this proves.
		expect([...authorization.faceComponentKeyByKey.keys()]).toHaveLength(2);
		// The identity-less predecessor is never unioned with the unrelated Room.
		for (const component of components) {
			expect(
				component.predecessorRoomIds.includes('room-k') &&
					component.predecessorRoomIds.includes('room-c')
			).toBe(false);
		}
		expect(components.flatMap((component) => [...component.predecessorRoomIds])).toEqual([
			'room-k'
		]);

		// --- the OUTCOME of a real reconciliation pass, not the grouping --------
		const result = reconcileRooms({
			baseline,
			candidateDocument: candidate,
			extraction,
			components,
			predecessorWitnesses,
			predecessorPolygons,
			allocator: createAuthoringRoomAllocator()
		});
		expect('kind' in result && result.kind === 'rejected').toBe(false);
		if ('kind' in result) return;
		// The unrelated Room is preserved with its name and its owned object, and no
		// merge happened. MEASURED pre-fix (this file re-run with the geometry-only
		// union restored): the two predecessors unioned into ONE component, so the loop
		// assertion above tripped and this reconciliation outcome was never reached —
		// i.e. geometry alone did authorize the union.
		expect(roomsOf(result.document)).toContainEqual(['room-k', 'Room k']);
		expect(ownedObjectRoomId(result.document, 'obj-k')).toBe('room-k');
		expect(result.lineage.filter((record) => record.kind === 'merge-survivor')).toEqual([]);
		// The identity-less predecessor retires, and its geometrically identical but
		// newly authored enclosure is a P23.8 0→1 birth under a FRESH identity:
		// recorded, not endorsed. No shipped planner produces this candidate (see the
		// suite comment), and no reachable path manufactures a replacement Room.
		expect(result.retiredRoomIds).toEqual(['room-c']);
		const created = result.lineage.filter((record) => record.kind === 'created');
		expect(created).toHaveLength(1);
		expect(created[0]!.roomId).not.toBe('room-k');
		expect(created[0]!.roomId).not.toBe('room-c');
		expect(roomsOf(result.document).map(([id]) => id).sort()).toEqual(
			['room-k', created[0]!.roomId].sort()
		);
	});

	it('(a)+(c) reachable — removing the operated Room\'s whole ring retires it without merging it into the unrelated Room', () => {
		// A real planner on the exact-coincidence pre-state. The operated Room's entire
		// boundary goes, so it holds NO surviving identity while the unrelated Room's
		// face is still authored — the one-sided branch, reachable. MEASURED pre-fix
		// (geometry-only union restored): the plan's only Room was
		// `[['room-c', 'Room c']]` — the lexical survivor took the enclosure, so the
		// UNRELATED Room was the one retired and `obj-k` the association remapped.
		const plan = planRemoveRoom(EXACT_COINCIDENCE, 'room-c');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(roomsOf(plan.document)).toEqual([['room-k', 'Room k']]);
		expect(plan.retiredRoomIds).toEqual(['room-c']);
		// (c) The documented retirement contract with nothing manufactured in its
		// place: the enclosure is gone, so no face is born for it.
		expect(plan.lineage).toEqual([]);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
		expect(plan.document.openings.map((opening) => [opening.id, opening.wallId])).toEqual([
			['opening:k:door:1', 'k-a1']
		]);
	});

	it('(b) reachable — a Wall-ID change an operation DOES declare keeps the Room\'s identity', () => {
		// `planWallSubdivision` rewrites the Room's boundary onto a NEW Wall fragment
		// while the noder's survivor keeps the original Wall id, and the precision path
		// declares the 1→1 lineage explicitly — the contract an operation that changes
		// a boundary reference must use. The unrelated Room is untouched.
		const plan = planWallSubdivision(FULL_CONTAINMENT, 'c-a1', 2, nodingAllocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const operated = plan.document.rooms.find((room) => room.id === 'room-c')!;
		// Identity survives the Wall-ID change...
		expect(operated.name).toBe('Room c');
		const originalIds = new Set(['c-a1', 'c-b1', 'c-c1', 'c-d1']);
		expect(operated.boundary.some((ref) => ref.wallId === 'c-a1')).toBe(true);
		expect(operated.boundary.filter((ref) => !originalIds.has(ref.wallId))).toHaveLength(1);
		// ...and so does the unrelated Room, with its owned object.
		expect(plan.document.rooms.map((room) => room.id)).toContain('room-k');
		expect(plan.document.rooms.find((room) => room.id === 'room-k')?.name).toBe('Room k');
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
	});
});
