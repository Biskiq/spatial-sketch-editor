/**
 * P23B.3a S1 — PRE-POLICY REFERENCE FREEZE (the dependency map's
 * REFERENCE-FIRST ORACLE RULE). S4 has since FLIPPED four of its rows.
 *
 * This file pins the verdicts the SHIPPED gates produce for the decision
 * record §6 acceptance cases (T1–T13) and the RT-1 regression cases (R-a…R-d).
 * It is the reference side of every later differential: the S4, S6 and S7
 * commits assert the POST-policy verdicts and RETIRE the reference expectation
 * of the case they flip, in the SAME commit — a case's pre- and post-policy
 * verdicts are never required green at once (P23B.3a AM-1).
 *
 * S4 (the component-scoped SUBJECT for `validateWallFirstTopology` and the
 * sampled crossing authority) has LANDED, so this file now holds three kinds of
 * row, and the register below names each one:
 *
 * ```text
 * ASSERTED HERE, STILL PRE-POLICY   T1, T3 — the duplicate batch gate (S7) and the
 *                                   chain planner's adoption (S6) own their flip, so
 *                                   they keep asserting the verdict the shipped code
 *                                   produces today.
 * ASSERTED HERE, NEVER FLIPS        T6–T13, R-b, R-d — including T8's chain-authoring
 *                                   observation, whose owning step is S5: S4 re-scoped
 *                                   the CANONICAL gate only, and the chain gate keeps
 *                                   its document subject until S5 re-scopes it.
 * FLIPPED AT S4                     T2 · T4 · T5 · R-a · R-c — their S1 pre-policy
 *                                   expectations are RETIRED and their successors
 *                                   (F2 · F4 · F5) are asserted in the S4 suite below.
 *                                   The retired verdicts survive here as RECORDED
 *                                   history (`pins`), never as active assertions.
 * ```
 *
 * Nothing in this file is a target: it is a record of what the shipped
 * implementation does, and it changes exactly where a row names a flipping step.
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
	wallsShareTopologyComponent,
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
	/** The pre-policy behaviour this case pinned at S1. */
	pins: string;
	/**
	 * The P23B.3a step that owns the successor, or `never` when the case is a
	 * permanent regression case. S5 appears here for the chain path's own
	 * subject, which S4 deliberately left alone.
	 */
	flipStep: 'never' | 'S4' | 'S5' | 'S6' | 'S7';
	/**
	 * The step at which the successor was ACTUALLY asserted, once it has landed.
	 * Its presence means the S1 expectation is retired: it is kept in `pins` as
	 * recorded history and is no longer asserted anywhere (AM-1).
	 */
	landedAt?: 'S4';
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
		// RETIRED AT S4 — kept as the historical half of the differential.
		pins: 'a Room moved through an independent Room was REFUSED by the document-global gate, atomically',
		flipStep: 'S4',
		landedAt: 'S4',
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
		// RETIRED AT S4 — kept as the historical half of the differential.
		pins: 'two independent curved Walls that cross were REFUSED by the sampled crossing authority',
		flipStep: 'S4',
		landedAt: 'S4',
		post: 'F4',
		owner: 'this file'
	},
	{
		id: 'T5',
		// RETIRED AT S4 — kept as the historical half of the differential.
		pins: 'collinear overlap between two independent groups was REFUSED',
		flipStep: 'S4',
		landedAt: 'S4',
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
		pins: 'a genuinely invalid operation is REFUSED ATOMICALLY, inside one connected group; the chain path\u2019s refusal of an INDEPENDENT crossing is a separate pre-policy OBSERVATION whose flip S5 owns \u2014 S4 re-scoped the canonical gate only, so it still holds here',
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
		// The CONTRACT does not flip: report order follows authored order, before and
		// after the policy. RE-BASED AT S4: the independent crossing S1 used to
		// demonstrate ordering is permitted now, so the ordering half is asserted on
		// a SAME-COMPONENT failure instead, beside the "permitted crossings report
		// nothing, repeatedly" half.
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
		// TWO verdicts travel in this case, and only one of them moved. ADMISSION by
		// the chord-exact batch gate is permanent and never flips. What flipped at S4
		// is the CANONICAL gate's rejection of the document the batch gate just
		// admitted — an independent-group crossing, which S4 stops rejecting. The
		// agreement is therefore NOT an S7 transition, and S7's remaining job is
		// batch↔validator PARITY rather than an ingress change.
		pins: 'the chord-exact batch gate ADMITS a duplicated Room whose endpoint CHORDS stay disjoint while its curve crosses (permanent), while the canonical gate REJECTED the document it admitted (RETIRED at S4 \u2014 the two gates now agree)',
		flipStep: 'S4',
		landedAt: 'S4',
		post: 'F4',
		owner: 'this file'
	},
	{
		id: 'R-b',
		pins: 'a refused duplicate leaves the source document byte-identical — pinned permanently on a SAME-COMPONENT refusal, with the independent-overlap refusal recorded as a pre-policy observation whose flip S7 owns',
		flipStep: 'never',
		owner: 'this file'
	},
	{
		id: 'R-c',
		// RETIRED AT S4 — kept as the historical half of the differential.
		pins: 'an UNRELATED edit was REFUSED by a PRE-EXISTING crossing it did not cause, naming the crossing Walls',
		flipStep: 'S4',
		landedAt: 'S4',
		post: 'F2',
		owner: 'this file'
	},
	{
		id: 'R-d',
		// The ingress verdict does NOT flip: the codec admits such a document today and
		// must keep admitting it (F6). S7 owns proving batch/validator/import PARITY and
		// continued correct import behaviour, not an admission transition.
		pins: 'the import path ADMITS a document carrying an independent-group crossing today AND keeps admitting it post-policy (no flip; S7 owns parity, not ingress)',
		flipStep: 'never',
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
 * SAME-COMPONENT failure (T12's ordering half): two Walls of ONE connected group
 * — they share the explicit Junction `j-b` — whose spans overlap collinearly
 * BEYOND that shared Junction. That is a malformed graph edge, not a relationship
 * between independent structures, so component scoping cannot reach it. The
 * authored order is the reported order: `wall-long` is authored first, so
 * `wall-short` is named as the partner, and reversing the array reports
 * `wall-long` instead.
 */
function sameComponentOverlapDocument(): LayoutDocumentWallFirst {
	return documentOf({
		junctions: [
			['j-a', 0, 0],
			['j-b', 6, 0],
			['j-c', 3, 0]
		],
		walls: [
			{ id: 'wall-long', start: 'j-a', end: 'j-b', role: 'partition' },
			{ id: 'wall-short', start: 'j-c', end: 'j-b', role: 'partition' }
		]
	});
}

/**
 * SAME-COMPONENT curve crossing (T12's ordering half, through the SAMPLED
 * authority): `wall-curved` leaves the Junction `j-m` the two Walls share and
 * bows through (1, −2), so it crosses `wall-straight` well away from that
 * Junction. The chords meet only AT `j-m`, so the chord classifier reports
 * `none` — only the sampled authority can see this, and it must keep seeing it
 * now that its subject is the component.
 */
function sameComponentCurveCrossingDocument(): LayoutDocumentWallFirst {
	return documentOf({
		junctions: [
			['j-a', 0, 0],
			['j-m', 6, 0],
			['j-b', 6, 4]
		],
		walls: [
			{ id: 'wall-straight', start: 'j-a', end: 'j-m', role: 'partition' },
			{
				id: 'wall-curved',
				start: 'j-m',
				end: 'j-b',
				role: 'partition',
				centerline: curved([6, 0], [6, 4], [[1, -2]], 'wall-curved')
			}
		]
	});
}

/**
 * The R-a/R-c pre-state: straight `room-1` (x 0…6, z 0…4) plus an INDEPENDENT curved
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

/**
 * Isolated `room-1` plus a STATIONARY partition stub reaching one of the room's
 * own Junctions (j-c). Same component, so the refusal it causes is intrinsic and
 * survives any subject-scoping change.
 */
function stubAttachedRoomDocument(): LayoutDocumentWallFirst {
	const base = isolatedRoomDocument();
	return {
		...base,
		junctions: [...base.junctions, { id: 'j-c-out', point: [6, 8] as LayoutVec2 }],
		walls: [
			...base.walls,
			{
				id: 'wall-stub',
				startJunctionId: 'j-c',
				endJunctionId: 'j-c-out',
				role: 'partition',
				thickness: 0.2,
				height: 3,
				centerline: LINE
			}
		]
	};
}

const ISOLATED_ROOM = isolatedRoomDocument();
const TWO_INDEPENDENT_ROOMS = twoIndependentRoomsDocument();
const SHARED_WALL_ROOMS = sharedWallRoomsDocument();
const TWO_CROSSING_CURVED_WALLS = twoCrossingCurvedWallsDocument();
const COLLINEAR_INDEPENDENT_WALLS = collinearIndependentWallsDocument();
const CURVED_BOW_AND_ROOM = curvedBowAndRoomDocument();
const SAME_COMPONENT_OVERLAP = sameComponentOverlapDocument();
const SAME_COMPONENT_CURVE_CROSSING = sameComponentCurveCrossingDocument();

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
				expect(['S4', 'S5', 'S6', 'S7']).toContain(row.flipStep);
			}
		}
	});

	it('delegates only the cases an existing suite already pins', () => {
		const delegated = REFERENCE_ROWS.filter((row) => row.owner.startsWith('existing suite')).map(
			(row) => row.id
		);
		expect(delegated).toEqual(['T9', 'T10', 'T11']);
	});

	it('retires a flipped row only at the step that owns it, and keeps its S1 verdict as history', () => {
		// AM-1: once a successor has landed the S1 expectation is REMOVED as an
		// assertion — never left asserting a verdict the shipped code no longer
		// produces, and never required green beside its successor. The S1 verdict
		// itself stays in `pins` as the historical half of the differential.
		const landed = REFERENCE_ROWS.filter((row) => row.landedAt !== undefined);
		expect(landed.map((row) => row.id)).toEqual(['T2', 'T4', 'T5', 'R-a', 'R-c']);
		for (const row of landed) {
			expect(row.flipStep).toBe('S4');
			expect(row.post).toBeDefined();
			// The retired verdict is still described, not deleted: the words the S1
			// freeze used for the pre-policy behaviour survive in `pins`.
			expect(row.pins).toMatch(/REFUSED|REJECTED/);
		}
		// Every row still asserting a PRE-POLICY verdict here is one whose flip step
		// has not landed, so no commit ever requires both verdicts green at once.
		const stillPrePolicy = REFERENCE_ROWS.filter(
			(row) => row.landedAt === undefined && row.flipStep !== 'never'
		).map((row) => row.id);
		expect(stillPrePolicy).toEqual(['T1', 'T3']);
	});
});

describe('P23B.3a S1 — reference verdicts whose flip step has NOT landed yet (T1, T3)', () => {
	it('T1 — duplicating a Room onto its own position is refused by the chord-exact batch gate', () => {
		// S7 owns this flip: the duplicate path runs `validateBatchWallTopology`, which
		// S4 does not touch.
		const plan = planDuplicateIsolatedRoom(ISOLATED_ROOM, { roomId: 'room-1', delta: [0, 0] });
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('topology_invalid');
		expect(plan.rejection.message).toContain('collinear-overlap');
	});

	it('T3 — two INDEPENDENT Walls with identical endpoint coordinates adopt ONE Junction id', () => {
		// S6 owns this flip: the implicit Junction is created by the CHAIN PLANNER, so
		// re-scoping the canonical gate at S4 cannot remove it. PlanWallChain's own
		// gate keeps its document subject until S5 for the same reason.
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
});

describe('P23B.3a S4 — the FLIPPED verdicts (F2, F4, F5), asserted where the S1 rows were retired', () => {
	it('T2 → F2 — a Room moved through an INDEPENDENT Room is permitted, and neither group joins the other', () => {
		// S1 pinned the opposite here: the then-document-global gate refused this move
		// with `unsupported ... collinear-overlap`, atomically, and named the Walls.
		// S4 scoped the gate's SUBJECT to the connected component, and these two
		// enclosures share no Junction id, so their overlap is permitted geometry.
		const snapshot = JSON.stringify(TWO_INDEPENDENT_ROOMS);
		const moved = success(planWallFirstRoomMove(TWO_INDEPENDENT_ROOMS, 'room-1', [9, 0]));

		// The move committed, and it moved the operated group ONLY: room-2 stays put,
		// and both Rooms keep their identity.
		expect(moved.movedRoomIds).toEqual(['room-1']);
		expect(moved.document.rooms.map((room) => [room.id, room.name])).toEqual([
			['room-1', 'One'],
			['room-2', 'Two']
		]);
		const junctions = new Map(moved.document.junctions.map((junction) => [junction.id, junction.point]));
		expect(junctions.get('j1-a')).toEqual([9, 0]);
		expect(junctions.get('j2-a')).toEqual([12, 0]);

		// NO IMPLICIT JOIN — the policy's negative half. The geometry now overlaps,
		// and the groups are still graph-INDEPENDENT: no adopted Junction, no shared
		// Wall, no new id, no fragmented Wall.
		expect(moved.document.walls.map((wall) => wall.id)).toEqual(
			TWO_INDEPENDENT_ROOMS.walls.map((wall) => wall.id)
		);
		expect(moved.document.junctions.map((junction) => junction.id)).toEqual(
			TWO_INDEPENDENT_ROOMS.junctions.map((junction) => junction.id)
		);
		for (const first of ['wall-1a', 'wall-1b', 'wall-1c', 'wall-1d']) {
			for (const second of ['wall-2a', 'wall-2b', 'wall-2c', 'wall-2d']) {
				expect(wallsShareTopologyComponent(moved.document, first, second)).toBe(false);
			}
		}

		// The source document was never touched by the planner.
		expect(JSON.stringify(TWO_INDEPENDENT_ROOMS)).toBe(snapshot);
	});

	it('T4 → F4 — two independent curved Walls whose bows cross are permitted, and neither Wall is noded', () => {
		// S1 pinned the sampled authority's refusal here. Those Walls are two separate
		// components, so S4's subject scope admits the crossing; nothing is created to
		// "resolve" it.
		expect(wallsShareTopologyComponent(TWO_CROSSING_CURVED_WALLS, 'wall-up', 'wall-down')).toBe(
			false
		);
		expect(validateWallFirstTopology(TWO_CROSSING_CURVED_WALLS)).toBeUndefined();
		// Permitted is not "repaired": the document the gate examined is untouched.
		expect(TWO_CROSSING_CURVED_WALLS.walls.map((wall) => wall.id)).toEqual(['wall-up', 'wall-down']);
		expect(TWO_CROSSING_CURVED_WALLS.junctions.map((junction) => junction.id)).toEqual([
			'j-up-a',
			'j-up-b',
			'j-dn-a',
			'j-dn-b'
		]);
	});

	it('T5 → F5 — collinear overlap between two independent groups is permitted geometry', () => {
		// The overlap itself is unchanged and still exact; what changed is that the
		// pair is not in one connected group. The same-component counterpart of this
		// exact geometry is refused (see T12's ordering half).
		expect(wallsShareTopologyComponent(COLLINEAR_INDEPENDENT_WALLS, 'wall-left', 'wall-right')).toBe(
			false
		);
		expect(validateWallFirstTopology(COLLINEAR_INDEPENDENT_WALLS)).toBeUndefined();
	});

	it('R-a → the batch gate ADMITS the clone (permanent) and the canonical gate now AGREES', () => {
		// Pre-state validity: the base document is clean under the gate.
		expect(validateWallFirstTopology(CURVED_BOW_AND_ROOM)).toBeUndefined();
		const admitted = success(
			planDuplicateIsolatedRoom(CURVED_BOW_AND_ROOM, { roomId: 'room-1', delta: [10, 0] })
		);
		// HALF 1 — PERMANENT: the chord-only batch gate sees nothing, because every
		// cloned chord is clear of the bow's chord. This admission is not an S7
		// transition; it is true today and stays true.
		expect(admitted.createdWallIds.length).toBe(4);
		// HALF 2 — AS OF S4: the canonical (full) gate AGREES with the batch gate about
		// the document it admitted. S1 recorded the opposite verdict here, and that
		// assertion is retired in this same commit (AM-1).
		expect(validateWallFirstTopology(admitted.document)).toBeUndefined();
		// Agreement is not a merge: the clone is its own component, and so is the bow.
		expect(admitted.createdRoomId).toBe('room-1-copy');
		for (const wallId of admitted.createdWallIds) {
			expect(wallsShareTopologyComponent(admitted.document, 'wall-bow', wallId)).toBe(false);
			expect(wallsShareTopologyComponent(admitted.document, 'wall-a1', wallId)).toBe(false);
		}
	});

	it('R-c → F2 — an UNRELATED edit is no longer refused by the pre-existing crossing it did not cause', () => {
		const admitted = success(
			planDuplicateIsolatedRoom(CURVED_BOW_AND_ROOM, { roomId: 'room-1', delta: [10, 0] })
		);
		// S1 pinned the F-C1/F-C3 misattribution: the canonical gate refused this edit
		// and blamed it for the CLONE's pre-existing crossing. S4 removes the
		// misattribution by removing the refusal it came from.
		const moved = success(planWallFirstRoomMove(admitted.document, 'room-1', [0, 20]));
		expect(moved.movedRoomIds).toEqual(['room-1']);

		// The clone keeps the crossing it was admitted with, and the bow keeps its
		// identity: the accepted move joined neither group to the other, and it did
		// not node, split or re-anchor anything it did not operate on.
		expect(wallsShareTopologyComponent(moved.document, 'wall-bow', 'wall-a1-copy')).toBe(false);
		expect(wallsShareTopologyComponent(moved.document, 'wall-bow', 'wall-a1')).toBe(false);
		const bowBefore = admitted.document.walls.find((wall) => wall.id === 'wall-bow');
		const bowAfter = moved.document.walls.find((wall) => wall.id === 'wall-bow');
		expect(bowAfter).toEqual(bowBefore);
		expect(moved.document.walls.length).toBe(admitted.document.walls.length);
		expect(moved.document.junctions.length).toBe(admitted.document.junctions.length);
	});
});

describe('P23B.3a S1 — reference verdicts the policy must NOT move (T6–T8, T12, T13, R-b, R-d)', () => {
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

	it('T8 (PERMANENT) — a SAME-COMPONENT collinear overlap is refused atomically and keeps being refused', () => {
		// Same connected group: the authored chain runs from j-a to j-m, two of the
		// enclosure's OWN junctions, exactly along the existing boundary Wall
		// wall-a1. Collinear overlap beyond an explicit shared Junction is an
		// intrinsic, same-component failure that component scoping cannot relax, so it
		// must keep failing after the policy — unlike an independent crossing, which
		// the planner legitimately NODES inside a group.
		const snapshot = JSON.stringify(SHARED_WALL_ROOMS);
		const plan = planWallChain({
			baseline: SHARED_WALL_ROOMS,
			points: [
				[0, 0],
				[3, 0]
			],
			close: false,
			role: 'partition'
		});
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('collinear_overlap');
		expect(plan.rejection.message).toContain('overlap beyond their explicit shared junction');
		expect(JSON.stringify(SHARED_WALL_ROOMS)).toBe(snapshot);
	});

	it('T8 (pre-policy observation, NOT yet flipped) — an INDEPENDENT crossing is refused atomically', () => {
		// OBSERVATION, NOT A PERMANENT EXPECTATION, and its owning step is S5 — NOT
		// S4. S4 re-scoped the CANONICAL gate; the chain path runs its own
		// `validateChainTopology`, whose subject (the sampled authority's included) S5
		// re-scopes. So this verdict is unchanged by S4 and must stay unchanged until
		// S5 lands, which is exactly what the ratified S4 step says ("T6–T8 … assert
		// they did NOT move here and at every later step"). The ATOMICITY half has to
		// hold after S5 too; only the verdict flips there.
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

	it('T12 (1) — repeated validation of PERMITTED independent crossings consistently returns no issue', () => {
		// S4 re-based this half: the fixtures that used to demonstrate diagnostic
		// ordering are permitted geometry now, so the contract they demonstrate is
		// "no verdict at all, however many times the gate runs, in either Wall order".
		expect(validateWallFirstTopology(TWO_CROSSING_CURVED_WALLS)).toBeUndefined();
		expect(validateWallFirstTopology(TWO_CROSSING_CURVED_WALLS)).toBeUndefined();
		expect(validateWallFirstTopology(COLLINEAR_INDEPENDENT_WALLS)).toBeUndefined();
		const reversed = {
			...TWO_CROSSING_CURVED_WALLS,
			walls: [...TWO_CROSSING_CURVED_WALLS.walls].reverse()
		};
		expect(validateWallFirstTopology(reversed)).toBeUndefined();
	});

	it('T12 (2) — repeated validation of a SAME-COMPONENT failure preserves the verdict and its diagnostic order', () => {
		// The ordering contract is unchanged by the policy (it never flips), but it is
		// now demonstrated on a failure the policy CANNOT relax: authored Wall order is
		// the reported order, so reversing the array reports the other member of the
		// pair — order-PRESERVING, not order-invariant (decision record G2/T12).
		const first = validateWallFirstTopology(SAME_COMPONENT_OVERLAP);
		const second = validateWallFirstTopology(SAME_COMPONENT_OVERLAP);
		expect(first?.code).toBe('unsupported_wall_topology');
		expect(first?.message).toContain('overlap beyond their explicit shared Junction');
		expect(second).toEqual(first);
		const reversed = {
			...SAME_COMPONENT_OVERLAP,
			walls: [...SAME_COMPONENT_OVERLAP.walls].reverse()
		};
		const reversedIssue = validateWallFirstTopology(reversed);
		expect(reversedIssue?.code).toBe('unsupported_wall_topology');
		expect(reversedIssue?.targetId).not.toBe(first?.targetId);
		expect(new Set([first?.targetId, reversedIssue?.targetId])).toEqual(
			new Set(['wall-long', 'wall-short'])
		);

		// The same two assertions through the SAMPLED authority: a curve crossing inside
		// one connected group, reported with a stable verdict and an authored-order
		// pair.
		const curve = validateWallFirstTopology(SAME_COMPONENT_CURVE_CROSSING);
		expect(curve?.code).toBe('unsupported_wall_topology');
		expect(curve?.message).toContain('cross away from their shared Junction');
		expect(validateWallFirstTopology(SAME_COMPONENT_CURVE_CROSSING)).toEqual(curve);
		const reversedCurve = validateWallFirstTopology({
			...SAME_COMPONENT_CURVE_CROSSING,
			walls: [...SAME_COMPONENT_CURVE_CROSSING.walls].reverse()
		});
		expect(reversedCurve?.code).toBe('unsupported_wall_topology');
		expect(reversedCurve?.targetId).not.toBe(curve?.targetId);
		expect(new Set([curve?.targetId, reversedCurve?.targetId])).toEqual(
			new Set(['wall-straight', 'wall-curved'])
		);
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

	it('R-b (PERMANENT) — a SAME-COMPONENT refusal leaves the source document byte-identical', () => {
		// A stationary partition stub reaching one of the group's own Junctions: the
		// refusal is intrinsic to the group's connectivity, so it must survive the
		// policy and remain atomic.
		const withStub = stubAttachedRoomDocument();
		const snapshot = JSON.stringify(withStub);
		const plan = planDuplicateIsolatedRoom(withStub, { roomId: 'room-1', delta: [10, 0] });
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('room_not_isolated');
		expect(JSON.stringify(withStub)).toBe(snapshot);
	});

	it('R-b (pre-policy observation, NOT yet flipped) — an INDEPENDENT-overlap refusal leaves the source document byte-identical', () => {
		// OBSERVATION, NOT A PERMANENT EXPECTATION: the clone overlaps the source, and
		// the gate that refuses it is `validateBatchWallTopology` — S7's subject, which
		// S4 does not touch. The atomicity half is recorded here and must still hold
		// afterwards.
		const snapshot = JSON.stringify(ISOLATED_ROOM);
		const plan = planDuplicateIsolatedRoom(ISOLATED_ROOM, { roomId: 'room-1', delta: [1, 0] });
		expect(plan.kind).toBe('rejected');
		expect(JSON.stringify(ISOLATED_ROOM)).toBe(snapshot);
	});

	it('R-d — the import path ADMITS an independent-group crossing today AND must keep admitting it (no flip)', () => {
		const admitted = success(
			planDuplicateIsolatedRoom(CURVED_BOW_AND_ROOM, { roomId: 'room-1', delta: [10, 0] })
		);
		const preview = createEmptyLayoutPreviewState();
		const imported = importLayoutPreviewJson(
			preview,
			serializeWallFirstLayoutDocument(admitted.document)
		);
		// Ingestion is already permissive because the codec carries no topology rule.
		// Post-policy it stays permissive for the SAME document (F6), so this is not a
		// transition: S7's obligation is to prove the batch gate, the canonical
		// validator and the import path AGREE about this document, not to change it.
		expect(imported).toBe(true);
	});

	it('keeps the reference fixtures schema-valid so a later failure is a verdict change, not a fixture drift', () => {
		for (const document of [
			ISOLATED_ROOM,
			TWO_INDEPENDENT_ROOMS,
			SHARED_WALL_ROOMS,
			TWO_CROSSING_CURVED_WALLS,
			COLLINEAR_INDEPENDENT_WALLS,
			CURVED_BOW_AND_ROOM,
			SAME_COMPONENT_OVERLAP,
			SAME_COMPONENT_CURVE_CROSSING
		]) {
			const structural = validateWallFirstLayoutDocument(document);
			expect(structural.success).toBe(true);
		}
	});
});
