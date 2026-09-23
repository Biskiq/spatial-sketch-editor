/**
 * P23B.3a S1 — PRE-POLICY REFERENCE FREEZE (the dependency map's
 * REFERENCE-FIRST ORACLE RULE).
 *
 * This file pins the verdicts the SHIPPED, PRE-POLICY gates produce for the
 * decision record §6 acceptance cases (T1–T13) and the RT-1 regression cases
 * (R-a…R-d). It is the reference side of every later differential: the S4, S6
 * and S7 commits assert the POST-policy verdicts and RETIRE the reference
 * expectation of the case they flip, in the SAME commit — a case's pre- and
 * post-policy verdicts are never required green at once (P23B.3a AM-1).
 *
 * Every assertion here is green on landing because it asserts code that
 * already exists. Nothing in this file is a target: it is a record of what the
 * current implementation does, and it is expected to change exactly where
 * `REFERENCE_ROWS` names a flipping step.
 *
 * Rows owned by an EXISTING suite are recorded in the table rather than
 * duplicated here (T9 round-trip, T10 undo/redo, T11 Plan/3D/visitor parity).
 */
import { describe, expect, it } from 'vitest';

import {
	connectedRoomIds,
	deriveChainSpans,
	extractBoundaryCandidateFaces,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	planDuplicateIsolatedRoom,
	planWallChain,
	planWallFirstRoomMove,
	resolveIsolatedRoomGroupSubgraph,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	validateWallFirstTopology,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCurveKnot,
	type LayoutWallFirstRoom
} from '@portfolio/layout-core';
import {
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson
} from '$lib/editor/layout/layout-preview-state.svelte';

// ---------------------------------------------------------------------------
// Case → flip-step register (the reference freeze's own map)
// ---------------------------------------------------------------------------

type ReferenceRow = {
	id: string;
	/** The pre-policy behaviour this case pins. */
	pins: string;
	/** The P23B.3a step that flips the expectation, or `never`. */
	flipStep: 'never' | 'S4' | 'S6' | 'S7';
	/** The post-policy counterpart, when the case flips. */
	post?: string;
	/** `this file` asserts it executably; an existing suite owns the rest. */
	owner: string;
};

const REFERENCE_ROWS: readonly ReferenceRow[] = [
	{
		id: 'T1',
		pins: 'duplicating a Room onto its own position is REFUSED by the chord-exact batch gate',
		flipStep: 'S7',
		post: 'F1',
		owner: 'this file'
	},
	{
		id: 'T2',
		pins: 'a Room moved through an independent Room is REFUSED by the document-global gate',
		flipStep: 'S4',
		post: 'F2',
		owner: 'this file'
	},
	{
		id: 'T3',
		pins: 'two INDEPENDENT Walls with identical endpoint coordinates share ONE Junction id (authoring adoption)',
		flipStep: 'S6',
		post: 'F3',
		owner: 'this file'
	},
	{
		id: 'T4',
		pins: 'two independent curved Walls that cross are REFUSED by the sampled crossing authority',
		flipStep: 'S4',
		post: 'F4',
		owner: 'this file'
	},
	{
		id: 'T5',
		pins: 'collinear overlap between two independent groups is REFUSED',
		flipStep: 'S4',
		post: 'F5',
		owner: 'this file'
	},
	{
		id: 'T6',
		pins: 'two Rooms with a DELIBERATE shared Wall are ACCEPTED as one rigid group',
		flipStep: 'never',
		owner: 'this file'
	},
	{
		id: 'T7',
		pins: 'an intrinsic failure INSIDE one connected group stays REFUSED',
		flipStep: 'never',
		owner: 'this file'
	},
	{
		id: 'T8',
		pins: 'a genuinely invalid operation is REFUSED ATOMICALLY',
		flipStep: 'never',
		owner: 'this file'
	},
	{
		id: 'T9',
		pins: 'save/import round-trip preserves identity and relationships exactly',
		flipStep: 'never',
		owner: 'existing suite: layout-codec / layout-wall-first-codec round-trip tests'
	},
	{
		id: 'T10',
		pins: 'undo/redo reproduces the exact placement with no stale artefact',
		flipStep: 'never',
		owner: 'existing suite: editor history / preview-snapshot tests'
	},
	{
		id: 'T11',
		pins: 'Plan, 3D and visitor consume equivalent canonical geometry',
		flipStep: 'never',
		owner: 'existing suite: layout-geometry-parity / visitor boundary tests'
	},
	{
		id: 'T12',
		pins: 'repeated validation over the SAME ordered input returns the same verdict and diagnostic order (order-PRESERVING)',
		flipStep: 'never',
		owner: 'this file'
	},
	{
		id: 'T13',
		pins: 'intentionally EXTENDING an already connected group still ADOPTS one of ITS OWN Junction ids',
		flipStep: 'never',
		owner: 'this file'
	},
	{
		id: 'R-a',
		pins: 'a duplicated Room whose endpoint CHORDS stay disjoint while its curve crosses is ADMITTED today (chord-only batch gate)',
		flipStep: 'S7',
		post: 'F6',
		owner: 'this file'
	},
	{
		id: 'R-b',
		pins: 'a refused duplicate leaves the source document byte-identical',
		flipStep: 'never',
		owner: 'this file'
	},
	{
		id: 'R-c',
		pins: 'an UNRELATED edit is refused by a PRE-EXISTING crossing it did not cause, naming the crossing Walls',
		flipStep: 'S4',
		post: 'F2',
		owner: 'this file'
	},
	{
		id: 'R-d',
		pins: 'the import path ADMITS a document carrying an independent-group crossing (F-C6)',
		flipStep: 'S7',
		post: 'F6',
		owner: 'this file'
	}
];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LINE: LayoutWallCenterline = { kind: 'line' };

type SeededWall = {
	id: string;
	start: string;
	end: string;
	role?: 'boundary' | 'partition';
	centerline?: LayoutWallCenterline;
};

function documentOf(options: {
	junctions: Array<[string, number, number]>;
	walls: SeededWall[];
	rooms?: LayoutWallFirstRoom[];
	openings?: LayoutDocumentWallFirst['openings'];
	objects?: LayoutDocumentWallFirst['objects'];
}): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: options.junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: options.walls.map(
			(seed): LayoutWall => ({
				id: seed.id,
				startJunctionId: seed.start,
				endJunctionId: seed.end,
				role: seed.role ?? 'boundary',
				thickness: 0.2,
				height: 3,
				centerline: seed.centerline ?? LINE
			})
		),
		rooms: options.rooms ?? [],
		openings: options.openings ?? [],
		objects: options.objects ?? []
	};
}

/** A cubic chain through the authored interior points (endpoints stay junctions). */
function curved(start: LayoutVec2, end: LayoutVec2, through: readonly LayoutVec2[], wallId: string) {
	const knots: LayoutWallCurveKnot[] = through.map((point, index) => ({
		id: `${wallId}:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
	return wallCubicChain(knots, deriveChainSpans([start, ...through, end]));
}

function roomFromFace(
	id: string,
	name: string,
	face: ReturnType<typeof extractBoundaryCandidateFaces>['faces'][number]
): LayoutWallFirstRoom {
	return {
		id,
		name,
		boundary: face.boundary.map((ref) => ({ ...ref })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	};
}

function faceOwningWall(
	base: LayoutDocumentWallFirst,
	wallId: string
): ReturnType<typeof extractBoundaryCandidateFaces>['faces'][number] {
	const face = extractBoundaryCandidateFaces(base).faces.find((candidate) =>
		candidate.boundary.some((ref) => ref.wallId === wallId)
	);
	if (!face) throw new Error(`no candidate face owns Wall '${wallId}'`);
	return face;
}

/** Straight isolated enclosure `room-1` (x 0…6, z 0…4) plus a roomless partition. */
function isolatedRoomDocument(): LayoutDocumentWallFirst {
	const base = documentOf({
		junctions: [
			['j-a', 0, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-d', 0, 4],
			['j-x', 20, 0],
			['j-y', 20, 4]
		],
		walls: [
			{ id: 'wall-a1', start: 'j-a', end: 'j-b' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c', start: 'j-c', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{ id: 'wall-rl', start: 'j-x', end: 'j-y', role: 'partition' }
		]
	});
	return { ...base, rooms: [roomFromFace('room-1', 'Alone', faceOwningWall(base, 'wall-a1'))] };
}

/** Two GRAPH-INDEPENDENT enclosures: `room-1` (x 0…6) and `room-2` (x 12…18). */
function twoIndependentRoomsDocument(): LayoutDocumentWallFirst {
	const base = documentOf({
		junctions: [
			['j1-a', 0, 0],
			['j1-b', 6, 0],
			['j1-c', 6, 4],
			['j1-d', 0, 4],
			['j2-a', 12, 0],
			['j2-b', 18, 0],
			['j2-c', 18, 4],
			['j2-d', 12, 4]
		],
		walls: [
			{ id: 'wall-1a', start: 'j1-a', end: 'j1-b' },
			{ id: 'wall-1b', start: 'j1-b', end: 'j1-c' },
			{ id: 'wall-1c', start: 'j1-c', end: 'j1-d' },
			{ id: 'wall-1d', start: 'j1-d', end: 'j1-a' },
			{ id: 'wall-2a', start: 'j2-a', end: 'j2-b' },
			{ id: 'wall-2b', start: 'j2-b', end: 'j2-c' },
			{ id: 'wall-2c', start: 'j2-c', end: 'j2-d' },
			{ id: 'wall-2d', start: 'j2-d', end: 'j2-a' }
		]
	});
	return {
		...base,
		rooms: [
			roomFromFace('room-1', 'One', faceOwningWall(base, 'wall-1a')),
			roomFromFace('room-2', 'Two', faceOwningWall(base, 'wall-2a'))
		]
	};
}

/** Two enclosures DELIBERATELY sharing the interior boundary Wall `wall-e` at x = 3. */
function sharedWallRoomsDocument(): LayoutDocumentWallFirst {
	const base = documentOf({
		junctions: [
			['j-a', 0, 0],
			['j-m', 3, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-n', 3, 4],
			['j-d', 0, 4]
		],
		walls: [
			{ id: 'wall-a1', start: 'j-a', end: 'j-m' },
			{ id: 'wall-a2', start: 'j-m', end: 'j-b' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c1', start: 'j-c', end: 'j-n' },
			{ id: 'wall-c2', start: 'j-n', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{ id: 'wall-e', start: 'j-m', end: 'j-n' }
		]
	});
	return {
		...base,
		rooms: [
			roomFromFace('room-left', 'Left', faceOwningWall(base, 'wall-a1')),
			roomFromFace('room-right', 'Right', faceOwningWall(base, 'wall-a2'))
		]
	};
}

/**
 * Two INDEPENDENT curved Walls whose endpoint chords are parallel and disjoint
 * (z = 0 and z = 6) while the bows cross in the middle: `wall-up` bows to
 * z = 3.6 and `wall-down` bows to z = 2.6, both at x = 5.
 */
function twoCrossingCurvedWallsDocument(): LayoutDocumentWallFirst {
	return documentOf({
		junctions: [
			['j-up-a', 0, 0],
			['j-up-b', 10, 0],
			['j-dn-a', 0, 6],
			['j-dn-b', 10, 6]
		],
		walls: [
			{
				id: 'wall-up',
				start: 'j-up-a',
				end: 'j-up-b',
				role: 'partition',
				centerline: curved([0, 0], [10, 0], [[5, 3.6]], 'wall-up')
			},
			{
				id: 'wall-down',
				start: 'j-dn-a',
				end: 'j-dn-b',
				role: 'partition',
				centerline: curved([0, 6], [10, 6], [[5, 2.6]], 'wall-down')
			}
		]
	});
}

/** Two INDEPENDENT straight Walls whose spans overlap collinearly between x = 3…6. */
function collinearIndependentWallsDocument(): LayoutDocumentWallFirst {
	return documentOf({
		junctions: [
			['j-l-a', 0, 0],
			['j-l-b', 6, 0],
			['j-r-a', 3, 0],
			['j-r-b', 9, 0]
		],
		walls: [
			{ id: 'wall-left', start: 'j-l-a', end: 'j-l-b', role: 'partition' },
			{ id: 'wall-right', start: 'j-r-a', end: 'j-r-b', role: 'partition' }
		]
	});
}

/**
 * The R-a pre-state: straight `room-1` (x 0…6, z 0…4) plus an INDEPENDENT curved
 * partition whose chord is the segment (10, 8)→(18, 8) and whose bow dips
 * through (14, 2.5). Duplicating `room-1` by +10 lands its walls inside the
 * bow's excursion while every endpoint chord stays disjoint.
 */
function curvedBowAndRoomDocument(): LayoutDocumentWallFirst {
	const base = documentOf({
		junctions: [
			['j-a', 0, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-d', 0, 4],
			['j-bow-a', 10, 8],
			['j-bow-b', 18, 8]
		],
		walls: [
			{ id: 'wall-a1', start: 'j-a', end: 'j-b' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c', start: 'j-c', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{
				id: 'wall-bow',
				start: 'j-bow-a',
				end: 'j-bow-b',
				role: 'partition',
				centerline: curved([10, 8], [18, 8], [[14, 2.5]], 'wall-bow')
			}
		]
	});
	return { ...base, rooms: [roomFromFace('room-1', 'Alone', faceOwningWall(base, 'wall-a1'))] };
}

const ISOLATED_ROOM = isolatedRoomDocument();
const TWO_INDEPENDENT_ROOMS = twoIndependentRoomsDocument();
const SHARED_WALL_ROOMS = sharedWallRoomsDocument();
const TWO_CROSSING_CURVED_WALLS = twoCrossingCurvedWallsDocument();
const COLLINEAR_INDEPENDENT_WALLS = collinearIndependentWallsDocument();
const CURVED_BOW_AND_ROOM = curvedBowAndRoomDocument();

function success<T extends { kind: string }>(plan: T): T & { kind: 'success' } {
	if (plan.kind !== 'success') {
		throw new Error(`expected success, got ${JSON.stringify(plan)}`);
	}
	return plan as T & { kind: 'success' };
}

// ---------------------------------------------------------------------------

describe('P23B.3a S1 — the reference register', () => {
	it('covers every decision-record case exactly once, with the step that flips it named', () => {
		const expected = [
			...Array.from({ length: 13 }, (_, index) => `T${index + 1}`),
			'R-a',
			'R-b',
			'R-c',
			'R-d'
		];
		expect(REFERENCE_ROWS.map((row) => row.id)).toEqual(expected);
		for (const row of REFERENCE_ROWS) {
			expect(row.pins.length).toBeGreaterThan(20);
			expect(row.owner.length).toBeGreaterThan(0);
			if (row.flipStep === 'never') {
				expect(row.post).toBeUndefined();
			} else {
				// A flipping case names its successor; the successor is asserted in the
				// step named here, and this reference expectation is retired there.
				expect(row.post).toBeDefined();
				expect(['S4', 'S6', 'S7']).toContain(row.flipStep);
			}
		}
	});

	it('delegates only the cases an existing suite already pins', () => {
		const delegated = REFERENCE_ROWS.filter((row) => row.owner.startsWith('existing suite')).map(
			(row) => row.id
		);
		expect(delegated).toEqual(['T9', 'T10', 'T11']);
	});
});

describe('P23B.3a S1 — reference verdicts that the policy changes (T1/T2/T3/T4/T5, R-a/R-c/R-d)', () => {
	it('T1 — duplicating a Room onto its own position is refused by the chord-exact batch gate', () => {
		const plan = planDuplicateIsolatedRoom(ISOLATED_ROOM, { roomId: 'room-1', delta: [0, 0] });
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('topology_invalid');
		expect(plan.rejection.message).toContain('collinear-overlap');
	});

	it('T2 — moving a Room through an independent Room is refused by the full gate, atomically', () => {
		const snapshot = JSON.stringify(TWO_INDEPENDENT_ROOMS);
		const plan = planWallFirstRoomMove(TWO_INDEPENDENT_ROOMS, 'room-1', [9, 0]);
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('topology_invalid');
		expect(plan.rejection.message).toContain('unsupported');
		expect(JSON.stringify(TWO_INDEPENDENT_ROOMS)).toBe(snapshot);
	});

	it('T3 — two INDEPENDENT Walls with identical endpoint coordinates adopt ONE Junction id', () => {
		const baseline = documentOf({
			junctions: [
				['j-1', 0, 0],
				['j-2', 4, 0]
			],
			walls: [{ id: 'wall-a', start: 'j-1', end: 'j-2', role: 'partition' }]
		});
		const plan = planWallChain({
			baseline,
			points: [
				[4, 0],
				[4, 4]
			],
			close: false,
			role: 'partition'
		});
		const authored = success(plan);
		const added = authored.document.walls.find((wall) => wall.id !== 'wall-a')!;
		// PRE-POLICY: touching IS joining — the new Wall reuses the existing Junction.
		expect(added.startJunctionId).toBe('j-2');
		const coincident = authored.document.junctions.filter(
			(junction) => Math.hypot(junction.point[0] - 4, junction.point[1] - 0) < 1e-9
		);
		expect(coincident).toHaveLength(1);
	});

	it('T4 — two independent curved Walls that cross are refused by the sampled authority', () => {
		const issue = validateWallFirstTopology(TWO_CROSSING_CURVED_WALLS);
		expect(issue?.code).toBe('unsupported_wall_topology');
		expect(issue?.message).toContain('centerline crossing');
		// The endpoint chords themselves stay clear of each other.
		expect(validateWallFirstTopology(collinearIndependentWallsDocument())?.message).toContain(
			'collinear-overlap'
		);
	});

	it('T5 — collinear overlap between two independent groups is refused', () => {
		const issue = validateWallFirstTopology(COLLINEAR_INDEPENDENT_WALLS);
		expect(issue?.code).toBe('unsupported_wall_topology');
		expect(issue?.message).toContain('collinear-overlap');
	});

	it('R-a — a cloned Room whose CHORDS stay disjoint while the cloned walls cross a curve is ADMITTED today', () => {
		// Pre-state validity: the base document is clean under both gates.
		expect(validateWallFirstTopology(CURVED_BOW_AND_ROOM)).toBeUndefined();
		const plan = planDuplicateIsolatedRoom(CURVED_BOW_AND_ROOM, { roomId: 'room-1', delta: [10, 0] });
		const admitted = success(plan);
		// The chord-only batch gate sees nothing: every cloned chord is clear of the bow's chord.
		expect(admitted.createdWallIds.length).toBe(4);
		// ... while the canonical (full) gate rejects the very document just admitted.
		const issue = validateWallFirstTopology(admitted.document);
		expect(issue?.code).toBe('unsupported_wall_topology');
		expect(issue?.message).toContain('centerline crossing');
		expect(issue?.message).toContain('wall-bow');
	});

	it('R-c — a later UNRELATED edit is refused by the pre-existing crossing it did not cause', () => {
		const admitted = success(
			planDuplicateIsolatedRoom(CURVED_BOW_AND_ROOM, { roomId: 'room-1', delta: [10, 0] })
		);
		// Move room-1 far away from the bow: this edit creates no crossing of its own.
		const plan = planWallFirstRoomMove(admitted.document, 'room-1', [0, 20]);
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('topology_invalid');
		expect(plan.rejection.message).toContain('centerline crossing');
		expect(plan.rejection.message).toContain('wall-bow');
	});

	it('R-d — the import path ADMITS a document carrying an independent-group crossing (F-C6)', () => {
		const admitted = success(
			planDuplicateIsolatedRoom(CURVED_BOW_AND_ROOM, { roomId: 'room-1', delta: [10, 0] })
		);
		const preview = createEmptyLayoutPreviewState();
		const imported = importLayoutPreviewJson(
			preview,
			serializeWallFirstLayoutDocument(admitted.document)
		);
		expect(imported).toBe(true);
	});
});

describe('P23B.3a S1 — reference verdicts the policy must NOT move (T6–T8, T12, T13, R-b)', () => {
	it('T6 — two Rooms with a deliberate shared Wall are accepted and form one rigid group', () => {
		expect(validateWallFirstTopology(SHARED_WALL_ROOMS)).toBeUndefined();
		const connected = [...connectedRoomIds(SHARED_WALL_ROOMS, 'room-left')].sort();
		expect(connected).toEqual(['room-left', 'room-right']);
		const group = resolveIsolatedRoomGroupSubgraph(SHARED_WALL_ROOMS, 'room-left');
		expect(group.kind).toBe('success');
		if (group.kind !== 'success') return;
		// The shared Wall travels exactly once with the group.
		expect(group.subgraph.wallIds.filter((wallId) => wallId === 'wall-e')).toHaveLength(1);
		expect(new Set(group.subgraph.wallIds).size).toBe(7);
		expect([...group.subgraph.roomIds].sort()).toEqual(['room-left', 'room-right']);
	});

	it('T7 — an intrinsic failure INSIDE one connected group stays refused', () => {
		const broken = {
			...SHARED_WALL_ROOMS,
			walls: SHARED_WALL_ROOMS.walls.map((wall) =>
				wall.id === 'wall-e' ? { ...wall, role: 'partition' as const } : wall
			)
		};
		const issue = validateWallFirstTopology(broken);
		expect(issue?.code).toBe('unsupported_wall_topology');
		expect(issue?.message).toContain('non-boundary');
	});

	it('T8 — a genuinely invalid operation is refused atomically', () => {
		const snapshot = JSON.stringify(TWO_CROSSING_CURVED_WALLS);
		const plan = planWallChain({
			baseline: TWO_CROSSING_CURVED_WALLS,
			points: [
				[-1, 3],
				[11, 3]
			],
			close: false,
			role: 'partition'
		});
		expect(plan.kind).toBe('rejected');
		expect(JSON.stringify(TWO_CROSSING_CURVED_WALLS)).toBe(snapshot);
	});

	it('T12 — repeated validation over the same ordered input returns the same verdict and order', () => {
		const first = validateWallFirstTopology(TWO_CROSSING_CURVED_WALLS);
		const second = validateWallFirstTopology(TWO_CROSSING_CURVED_WALLS);
		expect(second).toEqual(first);
		// Authored Wall order is the reported order: reversing the input reports the
		// other member first, so the contract is order-PRESERVING, not invariant.
		const reversed = {
			...TWO_CROSSING_CURVED_WALLS,
			walls: [...TWO_CROSSING_CURVED_WALLS.walls].reverse()
		};
		const reversedIssue = validateWallFirstTopology(reversed);
		expect(reversedIssue?.targetId).not.toBe(first?.targetId);
	});

	it('T13 — intentionally extending a connected group still adopts one of ITS OWN Junctions', () => {
		const plan = planWallChain({
			baseline: SHARED_WALL_ROOMS,
			points: [
				[6, 4],
				[10, 4]
			],
			close: false,
			role: 'partition'
		});
		const authored = success(plan);
		const baselineWallIds = new Set(SHARED_WALL_ROOMS.walls.map((wall) => wall.id));
		const added = authored.document.walls.filter((wall) => !baselineWallIds.has(wall.id));
		expect(added).toHaveLength(1);
		expect(added[0]!.startJunctionId).toBe('j-c');
		const coincident = authored.document.junctions.filter(
			(junction) => Math.hypot(junction.point[0] - 6, junction.point[1] - 4) < 1e-9
		);
		expect(coincident).toHaveLength(1);
	});

	it('R-b — a refused duplicate leaves the source document byte-identical', () => {
		const snapshot = JSON.stringify(ISOLATED_ROOM);
		const plan = planDuplicateIsolatedRoom(ISOLATED_ROOM, { roomId: 'room-1', delta: [1, 0] });
		expect(plan.kind).toBe('rejected');
		expect(JSON.stringify(ISOLATED_ROOM)).toBe(snapshot);
	});

	it('keeps the reference fixtures schema-valid so a later failure is a verdict change, not a fixture drift', () => {
		for (const document of [
			ISOLATED_ROOM,
			TWO_INDEPENDENT_ROOMS,
			SHARED_WALL_ROOMS,
			TWO_CROSSING_CURVED_WALLS,
			COLLINEAR_INDEPENDENT_WALLS,
			CURVED_BOW_AND_ROOM
		]) {
			const structural = validateWallFirstLayoutDocument(document);
			expect(structural.success).toBe(true);
		}
	});
});
