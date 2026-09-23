/**
 * P23B.3a S3 — OR-D12-1…3 evaluated against the CURRENT (unfixed)
 * reconciliation: the recorded KNOWN-RED reproduction.
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
	createEmptyWallFirstLayoutDocument,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	planWallRoleChange,
	validateWallFirstLayoutDocument,
	validateWallFirstTopology,
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

	it('MEASURED PRE-FIX, exact coincidence — the UNRELATED Room is retired and its owned object is TRANSFERRED', () => {
		const plan = operateOnOperatedRoom(EXACT_COINCIDENCE);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// Only the operated Room survives; the unrelated `room-k` is gone entirely...
		expect(roomsOf(plan.document)).toEqual([['room-c', 'Room c']]);
		expect(plan.retiredRoomIds).toEqual(['room-k']);
		// ... and `room-k`'s OWNED object has been reassigned to `room-c`, while the
		// Opening keeps its own Wall binding. This is the D-12 defect in its purest
		// form: spatial overlap alone changed an unrelated group's identity AND
		// ownership. S3a must make the guarantee case below pass.
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-c');
		expect(plan.document.openings.map((opening) => [opening.id, opening.wallId])).toEqual([
			['opening:k:door:1', 'k-a1']
		]);
	});

	it('MEASURED PRE-FIX, partial overlap — the UNRELATED Room survives; the OPERATED Room is retired', () => {
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

	it('MEASURED PRE-FIX, containment — same shape of result: containment alone is NOT the defect', () => {
		const plan = operateOnOperatedRoom(FULL_CONTAINMENT);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// Recorded so the hazard is not over-claimed: containing the operated Room
		// does not by itself reassign the unrelated Room's identity or ownership.
		expect(roomsOf(plan.document)).toEqual([['room-k', 'Room k']]);
		expect(plan.retiredRoomIds).toEqual(['room-c']);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
	});

	it.fails(
		'OR-D12-1 (KNOWN RED) — exact coincidence: the UNRELATED Room keeps its identity AND its owned object',
		() => {
			const plan = operateOnOperatedRoom(EXACT_COINCIDENCE);
			expect(plan.kind).toBe('success');
			if (plan.kind !== 'success') return;
			// ONLY the unrelated group is asserted on: the operated Room's own fate is
			// its operation's business and is deliberately not required here.
			expect(roomsOf(plan.document)).toContainEqual(['room-k', 'Room k']);
			expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
		}
	);

	it('OR-D12-2 (already holds, must keep holding) — partial overlap keeps the unrelated identity and ownership', () => {
		const plan = operateOnOperatedRoom(PARTIAL_OVERLAP);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(roomsOf(plan.document)).toContainEqual(['room-k', 'Room k']);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
	});

	it('OR-D12-3 (already holds, must keep holding) — containment is not a lineage event for the unrelated Room', () => {
		const plan = operateOnOperatedRoom(FULL_CONTAINMENT);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(roomsOf(plan.document)).toContainEqual(['room-k', 'Room k']);
		expect(ownedObjectRoomId(plan.document, 'obj-k')).toBe('room-k');
	});
});
