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
 */
import { describe, expect, it } from 'vitest';

import {
	connectedRoomIds,
	correspondenceAuthorization,
	createEmptyWallFirstLayoutDocument,
	extractBoundaryCandidateFaces,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	migrateLegacyLayoutDocument,
	planDeleteWall,
	planDissolveJunction,
	planWallChain,
	planWallFirstRoomMove,
	planWallRoleChange,
	validateWallFirstLayoutDocument,
	validateWallFirstTopology,
	type LayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline
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

/** Minimal legacy storey with two rooms occupying IDENTICAL extents. */
function legacyDocumentWithCoincidentRooms(): LayoutDocument {
	const legacyRoom = (id: string, name: string) => ({
		id,
		name,
		frame: { origin: [0, 0] as LayoutVec2, yaw: 0 },
		wallThickness: 0.2,
		floorThickness: 0.1,
		ceilingThickness: 0.1,
		boundary: {
			closed: true,
			segments: [
				{ id: `${id}-s`, kind: 'line' as const, start: [0, 0] as LayoutVec2, end: [6, 0] as LayoutVec2 },
				{ id: `${id}-e`, kind: 'line' as const, start: [6, 0] as LayoutVec2, end: [6, 4] as LayoutVec2 },
				{ id: `${id}-n`, kind: 'line' as const, start: [6, 4] as LayoutVec2, end: [0, 4] as LayoutVec2 },
				{ id: `${id}-w`, kind: 'line' as const, start: [0, 4] as LayoutVec2, end: [0, 0] as LayoutVec2 }
			]
		},
		openings: []
	});
	return {
		units: 'meters',
		floors: [
			{
				id: 'floor-1',
				name: 'Floor 1',
				elevation: 0,
				height: 3,
				rooms: [legacyRoom('room-1', 'Legacy one'), legacyRoom('room-2', 'Legacy two')]
			}
		],
		objects: []
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
	it('records the pre-state verdicts, which differ across the three overlap shapes', () => {
		// The codec accepts all three: topology is explicitly outside its scope.
		for (const document of [EXACT_COINCIDENCE, PARTIAL_OVERLAP, FULL_CONTAINMENT]) {
			expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		}
		// 1. EXACT COINCIDENCE — refused, and by the DOCUMENT-WIDE coincidence rule
		//    first (the OBSTACLE S5 re-scopes), not by wall geometry.
		expect(validateWallFirstTopology(EXACT_COINCIDENCE)?.code).toBe('duplicate_junction_point');
		// 2. PARTIAL OVERLAP — refused by the document-global wall-geometry rule.
		expect(validateWallFirstTopology(PARTIAL_OVERLAP)?.code).toBe('unsupported_wall_topology');
		// 3. FULL CONTAINMENT — ALREADY ADMITTED today: the contained enclosure's
		//    Walls intersect nothing and there is no coincident Junction to catch.
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
	}

	it('OR-D12-6 wall delete — deleting the OPERATED Room\'s Wall leaves the unrelated Room intact', () => {
		const plan = planDeleteWall(FULL_CONTAINMENT, 'c-a1');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		assertUnrelatedSurvives(plan.document, 'wall delete');
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

	it.fails(
		'OR-D12-6 migration (KNOWN RED — OPEN GAP) — coincident LEGACY Rooms keep their identity',
		() => {
			// MEASURED: the migration SUCCEEDS and silently retires the unrelated Room —
			// only 'room-1' survives, and 'room-2' is gone with no explicit join and no
			// refusal. This caller is NOT fixed by S3a and the guarantee is deliberately
			// NOT claimed green for it.
			//
			// WHY IT IS DIFFERENT: migration's predecessors are LEGACY records that
			// carry no authored Wall identity at all (`boundary: []`), so the D-12
			// authorization has nothing to key on; its declared components still come
			// from witness containment, and migration DEDUPES the two coincident
			// enclosures into one, leaving a single face that claims both predecessors
			// and merges them. Resolving it is a product choice, not a mechanical fix:
			// (i) refuse as ambiguous instead of merging, (ii) migrate the legacy Rooms
			// to distinct coincident enclosures with their own Junctions, or (iii) accept
			// the merge and record the retired identity as explicit lineage. It is
			// escalated for review rather than guessed here.
			const legacy = legacyDocumentWithCoincidentRooms();
			const result = migrateLegacyLayoutDocument(legacy);
			expect(result.kind).toBe('success');
			if (result.kind !== 'success') return;
			expect(result.document.rooms.map((room) => [room.id, room.name]).sort()).toEqual([
				['room-1', 'Legacy one'],
				['room-2', 'Legacy two']
			]);
		}
	);

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
