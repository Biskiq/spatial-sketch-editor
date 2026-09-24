/**
 * P23B.3a S1 — PRE-POLICY REFERENCE FREEZE (the dependency map's
 * REFERENCE-FIRST ORACLE RULE). S4 and S5 have since FLIPPED rows.
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
 * ASSERTED HERE, NEVER FLIPS        T6 · T7 · T9–T13 · R-b · R-d — plus T8's PERMANENT
 *                                   half (a SAME-COMPONENT collinear overlap stays
 *                                   refused atomically), which is asserted in the very
 *                                   test that now also carries its S5 successor.
 * FLIPPED AT S4                     T2 · T4 · T5 · R-a · R-c — their S1 pre-policy
 *                                   expectations are RETIRED and their successors
 *                                   (F2 · F4 · F5) are asserted in the S4 suite below.
 *                                   The retired verdicts survive here as RECORDED
 *                                   history (`pins`), never as active assertions.
 * FLIPPED AT S5                     T8's chain-authoring observation — the chain gate
 *                                   was the last document-subject gate, so S5 admits the
 *                                   INDEPENDENT crossing and asserts that the authored
 *                                   Wall joins nothing (F8's scoped negative half, AM-3).
 * FLIPPED AT S6                     T3 — the chain planner's implicit ADOPTION of a
 *                                   coincident Junction is withdrawn from INDEPENDENT
 *                                   placement, so its successor F3 (distinct Junction
 *                                   ids, no connectivity, no Wall fragmentation) is
 *                                   asserted in the S6 suite below and the S1 adoption
 *                                   verdict survives here as recorded history.
 * FLIPPED AT S7                     T1 — the duplicate path's own chord-exact batch
 *                                   gate is replaced by the canonical authority, so a
 *                                   Room duplicated onto an overlapping position is
 *                                   permitted placement; its successor F1 is asserted in
 *                                   the S7 suite below and the S1 refusal survives here
 *                                   as recorded history. NO ROW ASSERTS A PRE-POLICY
 *                                   VERDICT ANY MORE: every flip step has landed.
 * ```
 *
 * S6 (the authoring-intent split in `planWallChain`) has LANDED. Two of the NEVER-FLIPS
 * rows are RE-BASED IN PLACE, not flipped: T8's permanent same-component refusal and T13
 * still assert exactly the verdict they always did, and now DECLARE the anchor that makes
 * the operation an intentional extension (operation class 3). The declared-intent split
 * changes what a caller must SAY, never what an intentional extension produces — that is
 * precisely the containment rule the policy's M-3a-4 exists to protect.
 *
 * S7 (duplicate/import gate parity + the D-8 comment correction) has LANDED. The
 * duplicate path no longer owns a crossing rule of its own: it calls the canonical
 * `validateWallFirstTopology`, so its verdict and the canonical gate's cannot differ by
 * construction — the F-C1 / F-C6 ingress hole closed by WIRING, not by a second rule.
 * Ingestion is deliberately NOT wired to topology: the codec still carries no geometric
 * rule, so a payload remains codec-valid while the topology authority stays a separate,
 * later verdict (F6's scope).
 *
 * Nothing in this file is a target: it is a record of what the shipped
 * implementation does, and it changes exactly where a row names a flipping step.
 *
 * Rows owned by an EXISTING suite are recorded in the table rather than
 * duplicated here (T9 round-trip, T10 undo/redo, T11 Plan/3D/visitor parity).
 */
import { describe, expect, it } from 'vitest';

import {
	classifyWallIntersection,
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
	landedAt?: 'S4' | 'S5' | 'S6' | 'S7';
	/** The post-policy counterpart, when the case flips. */
	post?: string;
	/** `this file` asserts it executably; an existing suite owns the rest. */
	owner: string;
};

const REFERENCE_ROWS: readonly ReferenceRow[] = [
	{
		id: 'T1',
		// RETIRED AT S7 — kept as the historical half of the differential.
		pins: 'duplicating a Room onto its own position was REFUSED by the duplicate path\u2019s own chord-exact batch gate',
		flipStep: 'S7',
		landedAt: 'S7',
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
		// RETIRED AT S6 — kept as the historical half of the differential.
		pins: 'two INDEPENDENT Walls with identical endpoint coordinates shared ONE Junction id — the implicit join the policy REFUSED',
		flipStep: 'S6',
		landedAt: 'S6',
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
		// TWO verdicts travel in this case, and only one of them moved. The atomic
		// refusal of a SAME-COMPONENT collinear overlap is permanent and is asserted in
		// the same test below. What flipped at S5 is the chain path's refusal of an
		// INDEPENDENT crossing: the chain gate (`validateChainTopology`, its sampled call
		// included) was the LAST document-subject gate, and S5 scoped it, so the crossing
		// is now admitted and nothing is joined (F8's scoped negative half).
		pins: 'a genuinely invalid operation is REFUSED ATOMICALLY inside one connected group (permanent), while the chain path REFUSED an INDEPENDENT crossing (RETIRED at S5 — the chain gate takes the component subject now, so the crossing is admitted and the authored Wall joins nothing)',
		flipStep: 'S5',
		landedAt: 'S5',
		post: 'F8 (scoped negative half — AM-3; the deliberate-join half is a contract with no test)',
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
		pins: 'the chord-exact batch gate ADMITS a duplicated Room whose endpoint CHORDS stay disjoint while its curve crosses (permanent), while the canonical gate REJECTED the document it admitted (RETIRED at S4 — the two gates now agree)',
		flipStep: 'S4',
		landedAt: 'S4',
		post: 'F4',
		owner: 'this file'
	},
	{
		id: 'R-b',
		pins: 'a refused duplicate leaves the source document byte-identical — pinned permanently on a SAME-COMPONENT refusal (the batch now runs the canonical gate, so a document already violating it inside one component is REFUSED); the INDEPENDENT-overlap refusal was pre-policy and its S7 flip is an ADMISSION that keeps the source byte-identical too',
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
 * The S7 parity fixture: the SAME-COMPONENT curve crossing above — which only the
 * SAMPLED authority can see, because its two Walls share the Junction `j-m` and
 * their endpoint CHORDS never overlap — reproduced far from an otherwise isolated
 * `room-1`. Nothing about the crossing touches the Room, so a Room duplicate over
 * this document is a batch whose verdict hinges entirely on WHICH topology rule
 * the duplicate path runs: a chord-exact pair scan cannot see the crossing and
 * admits, while the canonical gate refuses.
 */
function isolatedRoomWithCurveCrossingDocument(): LayoutDocumentWallFirst {
	const base = documentOf({
		junctions: [
			['j-a', 0, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-d', 0, 4],
			['j-s', 34, 0],
			['j-m', 40, 0],
			['j-t', 40, 4]
		],
		walls: [
			{ id: 'wall-a1', start: 'j-a', end: 'j-b' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c', start: 'j-c', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{ id: 'wall-straight', start: 'j-s', end: 'j-m', role: 'partition' },
			{
				id: 'wall-curved',
				start: 'j-m',
				end: 'j-t',
				role: 'partition',
				centerline: curved([40, 0], [40, 4], [[35, -2]], 'wall-curved')
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
const ISOLATED_ROOM_WITH_CURVE_CROSSING = isolatedRoomWithCurveCrossingDocument();
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
		expect(landed.map((row) => row.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T8', 'R-a', 'R-c']);
		for (const row of landed) {
			// The step that RETIRED the S1 expectation is the step the row names, so a
			// later step can never quietly inherit an earlier step's flip.
			expect(row.landedAt).toBe(row.flipStep);
			expect(row.post).toBeDefined();
			// The retired verdict is still described, not deleted: the words the S1
			// freeze used for the pre-policy behaviour survive in `pins`.
			expect(row.pins).toMatch(/REFUSED|REJECTED/);
		}
		// S7 landed the LAST flip, so no row asserts a pre-policy verdict any more: the
		// file holds permanent rows and retired history only. The empty set is asserted
		// rather than deleted so a future row cannot quietly reintroduce a pre-policy
		// expectation beside its successor (AM-1).
		const stillPrePolicy = REFERENCE_ROWS.filter(
			(row) => row.landedAt === undefined && row.flipStep !== 'never'
		).map((row) => row.id);
		expect(stillPrePolicy).toEqual([]);
		expect(REFERENCE_ROWS.filter((row) => row.flipStep === 'S7').map((row) => row.id)).toEqual([
			'T1'
		]);
	});
});

describe('P23B.3a S7 — the FLIPPED verdict (F1), asserted where the S1 row was retired', () => {
	it('T1 → F1 — duplicating a Room onto its OWN position commits: SEPARATE ids, no connectivity, both groups independently editable', () => {
		// S1 pinned the opposite here: the duplicate path ran its own chord-exact
		// pair loop, so a clone whose every endpoint chord lay exactly along its
		// source's was REFUSED (`topology_invalid`, `collinear-overlap`). S7 deletes
		// that second rule and calls the canonical authority instead, whose subject
		// is the connected component: a clone introduces a NEW Junction id at each
		// coincident coordinate, so the two structures are independent and the
		// overlap is permitted placement (F1/F5, D-9).
		const snapshot = JSON.stringify(ISOLATED_ROOM);
		const plan = success(
			planDuplicateIsolatedRoom(ISOLATED_ROOM, { roomId: 'room-1', delta: [0, 0] })
		);
		expect(plan.createdRoomId).toBe('room-1-copy');

		const sourceJunctionIds = new Set(ISOLATED_ROOM.junctions.map((junction) => junction.id));
		const sourceWallIds = new Set(ISOLATED_ROOM.walls.map((wall) => wall.id));
		const pointById = new Map(
			plan.document.junctions.map((junction) => [junction.id, junction.point])
		);

		// F1 (1) SEPARATE ids — every cloned Junction and Wall is a new record, and
		// the coincident coordinates are ALSO separate records (a clone Junction sits
		// exactly on its source Junction, which the S5-scoped coincidence rule permits
		// across components and would refuse inside one).
		expect(plan.createdJunctionIds).toHaveLength(4);
		expect(plan.createdWallIds).toHaveLength(4);
		expect(plan.createdJunctionIds.every((id) => !sourceJunctionIds.has(id))).toBe(true);
		expect(plan.createdWallIds.every((id) => !sourceWallIds.has(id))).toBe(true);
		for (const id of plan.createdJunctionIds) {
			const point = pointById.get(id)!;
			const coincides = ISOLATED_ROOM.junctions.filter(
				(junction) =>
					Math.hypot(junction.point[0] - point[0], junction.point[1] - point[1]) < 1e-9
			);
			expect(coincides).toHaveLength(1);
		}

		// F1 (2) NO AUTOMATIC CONNECTIVITY — each clone Wall meets only the clone's
		// own Junctions, so no clone Wall shares a component with any source Wall.
		const cloneJunctions = new Set(plan.createdJunctionIds);
		for (const wallId of plan.createdWallIds) {
			const wall = plan.document.walls.find((candidate) => candidate.id === wallId)!;
			expect(cloneJunctions.has(wall.startJunctionId)).toBe(true);
			expect(cloneJunctions.has(wall.endJunctionId)).toBe(true);
			expect(wallsShareTopologyComponent(plan.document, wallId, 'wall-a1')).toBe(false);
		}
		// Nothing was fragmented to make a join, and nothing was adopted.
		expect(plan.document.walls.map((wall) => wall.id)).toEqual([
			...ISOLATED_ROOM.walls.map((wall) => wall.id),
			...plan.createdWallIds
		]);
		expect(plan.document.junctions.map((junction) => junction.id)).toEqual([
			...ISOLATED_ROOM.junctions.map((junction) => junction.id),
			...plan.createdJunctionIds
		]);

		// F1 (3) BOTH GROUPS INDEPENDENTLY EDITABLE — the canonical gate accepts what the
		// planner produced (planner and gate agree), and moving the CLONE alone leaves
		// the source group exactly where it was.
		expect(validateWallFirstTopology(plan.document)).toBeUndefined();
		const sourceWallsBefore = JSON.stringify(
			plan.document.walls.filter((wall) => sourceWallIds.has(wall.id))
		);
		const moved = success(planWallFirstRoomMove(plan.document, 'room-1-copy', [30, 0]));
		expect(moved.movedRoomIds).toEqual(['room-1-copy']);
		expect(
			JSON.stringify(moved.document.walls.filter((wall) => sourceWallIds.has(wall.id)))
		).toBe(sourceWallsBefore);
		expect(moved.document.rooms.map((room) => room.id)).toEqual(['room-1', 'room-1-copy']);

		// Atomicity: the planner never mutated its input.
		expect(JSON.stringify(ISOLATED_ROOM)).toBe(snapshot);
	});

	it('S7 PARITY — a Wall-introducing batch is judged by the CANONICAL gate, so the duplicate path and the gate cannot disagree', () => {
		// The F-C1 hole existed because the duplicate path classified Wall pairs with
		// the chord-exact `classifyWallIntersection` and never asked the sampled
		// authority. Fixing the SUBJECT alone would not have closed it: this baseline
		// carries a SAME-COMPONENT curve crossing, which component scoping does not
		// relax and a chord scan cannot see. The proof below is therefore about WIRING,
		// not about loosening anything.
		expect(validateWallFirstLayoutDocument(ISOLATED_ROOM_WITH_CURVE_CROSSING).success).toBe(
			true
		);
		const baselineIssue = validateWallFirstTopology(ISOLATED_ROOM_WITH_CURVE_CROSSING);
		expect(baselineIssue?.code).toBe('unsupported_wall_topology');
		expect(baselineIssue?.message).toContain('cross away from their shared Junction');

		// The chord-exact rule the duplicate path used to run CANNOT see it: the two
		// Walls share the Junction j-m, so their pair takes the shared-junction branch,
		// and their chords are not collinear — the branch that returns a verdict never
		// fires. This is the asymmetry S7 removes.
		const straightChord = { id: 'wall-straight', start: [34, 0] as LayoutVec2, end: [40, 0] as LayoutVec2 };
		const curvedChord = { id: 'wall-curved', start: [40, 0] as LayoutVec2, end: [40, 4] as LayoutVec2 };
		expect(classifyWallIntersection(straightChord, curvedChord, ['j-m']).kind).toBe(
			'shared-explicit-junction'
		);
		expect(classifyWallIntersection(straightChord, curvedChord, []).kind).not.toBe(
			'collinear-overlap'
		);

		// The batch that introduces Walls is refused with the CANONICAL verdict, and
		// the refusal is atomic. (The clone itself is clear of everything: the refusal
		// is the baseline's own same-component violation, which the policy does not
		// relax — T7/A-4.)
		const snapshot = JSON.stringify(ISOLATED_ROOM_WITH_CURVE_CROSSING);
		const plan = planDuplicateIsolatedRoom(ISOLATED_ROOM_WITH_CURVE_CROSSING, {
			roomId: 'room-1',
			delta: [0, 0]
		});
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('topology_invalid');
		expect(plan.rejection.message).toContain('cross away from their shared Junction');
		expect(plan.rejection.issues?.[0]?.code).toBe('unsupported_wall_topology');
		expect(JSON.stringify(ISOLATED_ROOM_WITH_CURVE_CROSSING)).toBe(snapshot);

		// Parity is ONE rule, not a stricter duplicate: the SAME batch over a document
		// without the crossing is admitted, and the gate agrees with it.
		const admitted = success(
			planDuplicateIsolatedRoom(ISOLATED_ROOM, { roomId: 'room-1', delta: [0, 0] })
		);
		expect(validateWallFirstTopology(admitted.document)).toBeUndefined();
	});

	it('S7 — ingestion stays CODEC-valid while topology stays a separate gate (F-C6 is a scope, not a stricter codec)', () => {
		// The distinction the change preserves: the codec answers "is this document
		// representable", the topology gate answers "is this topology admissible".
		// Wiring the duplicate batch to the gate must NOT be read as licence to give
		// the codec a geometric rule.
		expect(validateWallFirstLayoutDocument(ISOLATED_ROOM_WITH_CURVE_CROSSING).success).toBe(
			true
		);
		const preview = createEmptyLayoutPreviewState();
		expect(
			importLayoutPreviewJson(
				preview,
				serializeWallFirstLayoutDocument(ISOLATED_ROOM_WITH_CURVE_CROSSING)
			)
		).toBe(true);
		// Same document, same moment: the topology authority refuses it, and it is the
		// ONLY authority that does.
		expect(validateWallFirstTopology(ISOLATED_ROOM_WITH_CURVE_CROSSING)?.code).toBe(
			'unsupported_wall_topology'
		);
	});
});

describe('P23B.3a S6 — the FLIPPED verdict (F3), asserted where the S1 row was retired', () => {
	function twoIndependentWalls(): LayoutDocumentWallFirst {
		return documentOf({
			junctions: [
				['j-1', 0, 0],
				['j-2', 4, 0]
			],
			walls: [{ id: 'wall-a', start: 'j-1', end: 'j-2', role: 'partition' }]
		});
	}

	it('T3 → F3 — two INDEPENDENT Walls with identical endpoint coordinates share NO Junction and join nothing', () => {
		// S1 pinned the opposite here: the chain planner ADOPTED the coincident
		// Junction, so two INDEPENDENT Walls ended up with ONE node — the "touching IS
		// joining" reflex. S6 withdraws that reflex from INDEPENDENT placement
		// (operation class 2, §4.0.1 / M-3a-4): the discriminator is the operation's
		// DECLARED intent, never the geometry, so an operation that declares nothing
		// mints its own Junction record even at a coordinate an existing record
		// already occupies. Together with T13 this is the D-9 rule in test form.
		const baseline = twoIndependentWalls();
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
		// F3 (1) DISTINCT ids: the coincident coordinate is a new record, not j-2.
		expect(added.startJunctionId).not.toBe('j-2');
		// F3 (2) NO CONNECTIVITY: the two Walls are separate components, so neither
		// the crossing rule nor the coincidence rule may pair them.
		expect(wallsShareTopologyComponent(authored.document, 'wall-a', added.id)).toBe(false);
		// F3 (3) NO WALL FRAGMENTATION: the baseline Wall is byte-identical and the
		// authored Wall is the whole request — nothing was split to make a join.
		expect(authored.document.walls).toHaveLength(2);
		expect(authored.document.walls.find((wall) => wall.id === 'wall-a')).toEqual(baseline.walls[0]);
		expect(authored.splitWallIds).toHaveLength(0);
		expect(authored.authoredWallIds).toEqual([added.id]);
		const coincident = authored.document.junctions.filter(
			(junction) => Math.hypot(junction.point[0] - 4, junction.point[1] - 0) < 1e-9
		);
		expect(coincident.map((junction) => junction.id).sort()).toEqual(
			['j-2', added.startJunctionId].sort()
		);
		// The two coincident records are permitted geometry now, so the shipped gate
		// accepts what the planner produced: the planner and the gate agree (R-3).
		expect(validateWallFirstTopology(authored.document)).toBeUndefined();
	});

	it('F3 differential — the SAME geometry with a DECLARED anchor adopts instead (class 3 unchanged)', () => {
		// The declaration is the whole difference: with the anchor named, the
		// extension is exactly what it always was — ONE Junction id, the new Wall
		// joined to the group it named (T13's contract, reached by declaring it).
		const plan = planWallChain({
			baseline: twoIndependentWalls(),
			points: [
				[4, 0],
				[4, 4]
			],
			close: false,
			role: 'partition',
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: 'j-2' }]
		});
		const authored = success(plan);
		const added = authored.document.walls.find((wall) => wall.id !== 'wall-a')!;
		expect(added.startJunctionId).toBe('j-2');
		expect(wallsShareTopologyComponent(authored.document, 'wall-a', added.id)).toBe(true);
		const coincident = authored.document.junctions.filter(
			(junction) => Math.hypot(junction.point[0] - 4, junction.point[1] - 0) < 1e-9
		);
		expect(coincident).toHaveLength(1);
		expect(validateWallFirstTopology(authored.document)).toBeUndefined();
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
		//
		// S6 RE-BASED THIS TEST IN PLACE, verdict unchanged: the operation now
		// DECLARES the anchor it starts from (class 3 — intentionally extending this
		// group), and that declaration is the only thing that changed. The refusal,
		// its code, its message and its atomicity are exactly what S1 pinned; the
		// identical geometry WITHOUT the declaration is the independent-placement case
		// that F3/F8 admit (mints its own Junction, joins nothing).
		const snapshot = JSON.stringify(SHARED_WALL_ROOMS);
		const plan = planWallChain({
			baseline: SHARED_WALL_ROOMS,
			points: [
				[0, 0],
				[3, 0]
			],
			close: false,
			role: 'partition',
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-a' },
				{ pointIndex: 1, junctionId: 'j-m' }
			]
		});
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('collinear_overlap');
		expect(plan.rejection.message).toContain('overlap beyond their explicit shared junction');
		expect(JSON.stringify(SHARED_WALL_ROOMS)).toBe(snapshot);
	});

	it('T8 → F8 (S5) — an INDEPENDENT crossing is ADMITTED, and the authored Wall joins nothing', () => {
		// The chain path's own gate (`validateChainTopology`, its sampled call included)
		// was the LAST document-subject gate; S5 scoped it in the same commit as the
		// coincidence rule, so the crossing this case pinned as a refusal is permitted
		// geometry now. Its S1 expectation is RETIRED here — the step that owns the flip
		// (AM-1) — and survives as the recorded history in the register above.
		//
		// F8 is asserted ONLY in its SCOPED NEGATIVE HALF (AM-3): the authored Wall crosses
		// two independent curved Walls and adopts NOTHING — no shared Junction is created at
		// either crossing, neither curved Wall is split, and the canonical gate accepts the
		// document the chain planner produced (so the two gates agree about it; R-3). The
		// positive half ("a deliberate join is the only way") is a CONTRACT: no test asserts it
		// until a join operation ships (D-10).
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
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.createdWallIds).toHaveLength(1);
		const authored = plan.document.walls.find((wall) => wall.id === plan.createdWallIds[0])!;
		// The authored chain is exactly the request, not a re-routed or noded path.
		const pointById = new Map(plan.document.junctions.map((junction) => [junction.id, junction.point]));
		expect(pointById.get(authored.startJunctionId)).toEqual([-1, 3]);
		expect(pointById.get(authored.endJunctionId)).toEqual([11, 3]);
		// Both curved Walls survive un-split, and the new Wall is a THIRD component: the
		// crossing is a visual overlap, never a topology edge.
		expect(plan.document.walls.map((wall) => wall.id)).toEqual([
			'wall-up',
			'wall-down',
			authored.id
		]);
		for (const wallId of ['wall-up', 'wall-down']) {
			expect(wallsShareTopologyComponent(plan.document, wallId, authored.id)).toBe(false);
		}
		expect(wallsShareTopologyComponent(plan.document, 'wall-up', 'wall-down')).toBe(false);
		expect(validateWallFirstTopology(plan.document)).toBeUndefined();
		// ATOMICITY has to hold on the admitted path too: the source document is untouched.
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
		// S6 RE-BASED THIS TEST IN PLACE, verdict unchanged: "intentional" is now
		// DECLARED rather than inferred, so the operation names the Junction of the
		// group it extends. That declaration is exactly what M-3a-4 retains adoption
		// FOR — remove it and T3 → F3 above shows the same geometry joining nothing.
		const plan = planWallChain({
			baseline: SHARED_WALL_ROOMS,
			points: [
				[6, 4],
				[10, 4]
			],
			close: false,
			role: 'partition',
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: 'j-c' }]
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

	it('R-b → S7 — an INDEPENDENT-overlap duplicate now COMMITS, and the source stays byte-identical', () => {
		// S1 recorded this as a PRE-POLICY observation (refused, atomically) and named
		// S7 as the step owning its flip: the refusal came from the duplicate path's own
		// chord-exact rule, which S7 deletes. The overlap is permitted placement under
		// the canonical gate, so the observation becomes an ADMISSION — and atomicity
		// has to hold on the admitted path exactly as it held on the refused one.
		//
		// The PERMANENT half of R-b (a same-component refusal, byte-identical source)
		// is the test above and is unchanged by this flip.
		const snapshot = JSON.stringify(ISOLATED_ROOM);
		const plan = success(
			planDuplicateIsolatedRoom(ISOLATED_ROOM, { roomId: 'room-1', delta: [1, 0] })
		);
		expect(plan.createdRoomId).toBe('room-1-copy');
		expect(JSON.stringify(ISOLATED_ROOM)).toBe(snapshot);
	});

	it('R-d — the import path ADMITS an independent-group crossing today AND must keep admitting it (no flip)', () => {
		const admitted = success(
			planDuplicateIsolatedRoom(CURVED_BOW_AND_ROOM, { roomId: 'room-1', delta: [10, 0] })
		);
		// S7 PARITY, PROVEN BY CONSTRUCTION: the batch gate IS the canonical gate now
		// (the duplicate path calls `validateWallFirstTopology`), so there is no verdict
		// left for the two to disagree about — the document the batch admitted is one
		// the canonical validator accepts.
		expect(validateWallFirstTopology(admitted.document)).toBeUndefined();
		const preview = createEmptyLayoutPreviewState();
		const imported = importLayoutPreviewJson(
			preview,
			serializeWallFirstLayoutDocument(admitted.document)
		);
		// Ingestion is already permissive because the codec carries no topology rule.
		// Post-policy it stays permissive for the SAME document (F6), so this is not a
		// transition: the codec is untouched by S7 and the ingress verdict does not move.
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
