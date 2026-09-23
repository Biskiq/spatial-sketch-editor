/**
 * P23B.3a S3 — OR-D12-1…3 evaluated against the CURRENT (unfixed)
 * reconciliation: the recorded KNOWN-RED reproduction.
 *
 * D-12's guarantee: an UNRELATED group retains its identity; the OPERATED group
 * retains or changes identity only per that operation's own existing authorized
 * lineage contract; spatial overlap ALONE may never cause either change.
 *
 * The pre-states below are constructible and are exactly what the policy makes
 * admissible at S4 — two GRAPH-INDEPENDENT Rooms that share no Junction id and
 * overlap only geometrically. Each case records what the reconciliation does
 * TODAY. The guarantee cases are written with `it.fails`, so the FINDING is a
 * required check while the GUARANTEE is deliberately NOT in a mandatory green
 * lane (the ratified S3 quarantine); S3a makes them ordinary `it` cases that
 * must pass, and the observed pre-fix behaviour stays recorded here as the
 * historical half of the differential.
 *
 * OR-D12-5 and OR-D12-6 obligations for S3a: evaluate these against the GENERAL
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
 * Two graph-independent Rooms: `k` is the UNRELATED one, `c` is the OPERATED
 * one. They share no Junction id — only coordinates.
 */
function pairDocument(inner: Enclosure, outer: Enclosure): LayoutDocumentWallFirst {
	const base = emptyDocument();
	const outerEnclosure = enclosure(outer);
	const innerEnclosure = enclosure(inner);
	return {
		...base,
		junctions: [...outerEnclosure.junctions, ...innerEnclosure.junctions],
		walls: [...outerEnclosure.walls, ...innerEnclosure.walls],
		rooms: [outerEnclosure.room, innerEnclosure.room]
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

function operatedWallId(document: LayoutDocumentWallFirst): string {
	// The operated Room is `room-c`; its south Wall `c-a1` is boundary role today.
	expect(document.rooms.map((room) => room.id)).toContain('room-c');
	return 'c-a1';
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
		//    Walls intersect nothing, and there is no coincident Junction to catch.
		//    RECORDED FINDING: the identity hazard OR-D12-3 describes is therefore
		//    reachable NOW, not only once the policy lands.
		expect(validateWallFirstTopology(FULL_CONTAINMENT)).toBeUndefined();
	});

	it.fails(
		'OR-D12-1 (KNOWN RED) — through a role change on the OTHER Room, the unrelated coincident Room keeps its identity',
		() => {
			const plan = planWallRoleChange(EXACT_COINCIDENCE, operatedWallId(EXACT_COINCIDENCE), 'partition');
			expect(plan.kind).toBe('success');
			if (plan.kind !== 'success') return;
			// OBSERVED TODAY: the two coincident Rooms collapse into ONE
			// correspondence component, so `room-k` — untouched by this operation —
			// is retired and its identity is lost. Only the operated `room-c` remains.
			expect(plan.document.rooms.map((room) => room.id).sort()).toEqual(['room-c', 'room-k']);
		}
	);

	it.fails(
		'OR-D12-2 (KNOWN RED) — with a partial overlap, each face is attributed to its own predecessor',
		() => {
			const plan = planWallRoleChange(PARTIAL_OVERLAP, operatedWallId(PARTIAL_OVERLAP), 'partition');
			expect(plan.kind).toBe('success');
			if (plan.kind !== 'success') return;
			expect(plan.document.rooms.map((room) => room.id).sort()).toEqual(['room-c', 'room-k']);
		}
	);

	it.fails(
		'OR-D12-3 (KNOWN RED) — containment is not a lineage event for the unrelated Room',
		() => {
			const plan = planWallRoleChange(FULL_CONTAINMENT, operatedWallId(FULL_CONTAINMENT), 'partition');
			expect(plan.kind).toBe('success');
			if (plan.kind !== 'success') return;
			expect(plan.document.rooms.map((room) => room.id).sort()).toEqual(['room-c', 'room-k']);
		}
	);
});
