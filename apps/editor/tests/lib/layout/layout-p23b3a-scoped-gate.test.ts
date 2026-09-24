/**
 * P23B.3a S4/S5 — the component-scoped SUBJECT, and its own oracle.
 *
 * S4 re-scoped the subject of the canonical gate (`validateWallFirstTopology`,
 * and with it the sampled crossing authority `detectWallCurveTopologyCrossings`)
 * from "all Walls in the document" to "Walls in the connected component". S5
 * COMPLETED the authority, so no gate is left on the pre-policy subject:
 *
 * ```text
 * S4  the canonical pairwise and sampled checks; the separate CHAIN gate
 *     (`validateChainTopology`) deliberately kept its document subject behind a
 *     transitional `{ subject: 'document' }` option, so for one step the two gates
 *     could still disagree about the same pair (risk R-3);
 * S5  the chain gate is scoped the same way — its chord loop AND its sampled call —
 *     and that transitional option is REMOVED from production, so there is no way
 *     left to ask for the pre-policy subject; the COINCIDENCE rule
 *     (`duplicate_junction_point`) is scoped too (D-9), which is what makes
 *     identical endpoint coordinates between INDEPENDENT components representable
 *     and valid.
 * ```
 *
 * This file asserts the three obligations the slice's acceptance criteria name for
 * a re-scope (OR-3a, OR-3b, OR-4a), the S5 chain-gate parity, and the D-9
 * coincidence proof (independent coincidence admitted, accidental duplicates
 * inside ONE component still refused) — rather than restating the cases the S1
 * reference register already owns (T8's flip lives there). It also pins the S5
 * review blocker: the unattached label is collision-proof against every authored
 * Wall id, including a Wall literally named after the old sentinel string.
 *
 * ```text
 * OR-3a  SCOPED SUBJECT ≡ the same verdict the pre-policy gate produced for pairs
 *        in the SAME component. Asserted by ISOLATION: for a document whose Walls
 *        fall into components C1…Cn, a component isolated into its own document
 *        has exactly ONE component, so the scoped gate on that document IS the
 *        pre-policy gate on it — every pair there is same-component by
 *        construction, and INV-2 says only WHICH PAIRS are evaluated changed. So
 *        `gate(multi) ≡ gate(isolate(Ci))` is the equivalence, case by case, with
 *        the code, the message and the target ID compared exactly.
 * OR-3b  A permitted INDEPENDENT-GROUP overlap is NOT a failure, and,
 *        symmetrically, a same-component failure is NOT dropped. Asserted BOTH
 *        ways over one table of overlap kinds.
 * OR-4a  ATOMICITY on refusal: the source document is untouched, and the gate
 *        itself is a pure read.
 * ```
 *
 * WHAT IS *NOT* PART OF THIS RE-SCOPE is pinned in the same place: the INTENT
 * guards and authoring behaviour. `planWallChain` still adopts a Junction and still
 * nodes a crossing it can node — withdrawing that from INDEPENDENT placement is the
 * authoring-intent split (S6, T3 → F3), so the canonical gate's new subject alone
 * never decides an authoring verdict here.
 */
import { describe, expect, it } from 'vitest';

import {
	deriveChainSpans,
	detectWallCurveTopologyCrossings,
	junctionsShareTopologyComponent,
	planExactJunctionMove,
	planWallChain,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	topologyComponentKeyByJunctionId,
	UNATTACHED_JUNCTION_COMPONENT,
	validateWallFirstLayoutDocument,
	validateWallFirstTopology,
	wallCubicChain,
	wallsShareTopologyComponent,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCurveKnot,
	type LayoutWallFirstRoom,
	type TopologySegment
} from '@portfolio/layout-core';

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
		objects: []
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

/** A closed rectangular enclosure with its own four Junctions and boundary cycle. */
function enclosure(prefix: string, x: number, z: number, width: number, depth: number) {
	const junctions: Array<[string, number, number]> = [
		[`${prefix}-a`, x, z],
		[`${prefix}-b`, x + width, z],
		[`${prefix}-c`, x + width, z + depth],
		[`${prefix}-d`, x, z + depth]
	];
	const walls: SeededWall[] = [
		{ id: `${prefix}-a1`, start: `${prefix}-a`, end: `${prefix}-b` },
		{ id: `${prefix}-b1`, start: `${prefix}-b`, end: `${prefix}-c` },
		{ id: `${prefix}-c1`, start: `${prefix}-c`, end: `${prefix}-d` },
		{ id: `${prefix}-d1`, start: `${prefix}-d`, end: `${prefix}-a` }
	];
	const room: LayoutWallFirstRoom = {
		id: `room-${prefix}`,
		name: `Room ${prefix}`,
		boundary: walls.map((wall) => ({ wallId: wall.id, direction: 'forward' as const })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	};
	return { junctions, walls, room };
}

/**
 * Isolate the complete component identified by the seed Walls, including every
 * Room whose full boundary belongs to it. A caller cannot accidentally compare
 * a same-component verdict against only the pair that exposed the variant.
 */
function isolateComponent(
	document: LayoutDocumentWallFirst,
	wallIds: readonly string[]
): LayoutDocumentWallFirst {
	const seedWallId = wallIds[0];
	if (!seedWallId || !document.walls.some((wall) => wall.id === seedWallId)) {
		throw new Error('isolateComponent requires at least one existing seed Wall');
	}
	const keep = new Set(
		document.walls
			.filter(
				(wall) =>
					wall.id === seedWallId || wallsShareTopologyComponent(document, seedWallId, wall.id)
			)
			.map((wall) => wall.id)
	);
	if (wallIds.some((wallId) => !keep.has(wallId))) {
		throw new Error('isolateComponent seed Walls must all belong to the same component');
	}
	const walls = document.walls.filter((wall) => keep.has(wall.id));
	const junctionIds = new Set(
		walls.flatMap((wall) => [wall.startJunctionId, wall.endJunctionId])
	);
	const rooms = document.rooms.filter((room) =>
		room.boundary.every((ref) => keep.has(ref.wallId))
	);
	const roomIds = new Set(rooms.map((room) => room.id));
	return {
		...document,
		junctions: document.junctions.filter((junction) => junctionIds.has(junction.id)),
		walls,
		rooms,
		openings: document.openings.filter((opening) => keep.has(opening.wallId)),
		objects: document.objects.filter(
			(object) => object.roomId === undefined || roomIds.has(object.roomId)
		)
	};
}

function segmentsOf(document: LayoutDocumentWallFirst): Map<string, TopologySegment> {
	const pointById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	const segments = new Map<string, TopologySegment>();
	for (const wall of document.walls) {
		const start = pointById.get(wall.startJunctionId);
		const end = pointById.get(wall.endJunctionId);
		if (start && end) segments.set(wall.id, { id: wall.id, start, end });
	}
	return segments;
}

// ---------------------------------------------------------------------------
// OR-3a fixtures — an invalid component beside an INDEPENDENT, clean one
// ---------------------------------------------------------------------------

/**
 * BOTH components are internally invalid (each pair shares an explicit Junction
 * and overlaps collinearly beyond it). `solo` is authored first, so the document
 * order of the FIRST failure is provable as well.
 */
const ORDERED_FAILURES = documentOf({
	junctions: [
		['solo-a', 0, 0],
		['solo-b', 6, 0],
		['solo-c', 3, 0],
		['late-a', 0, 10],
		['late-b', 6, 10],
		['late-c', 3, 10]
	],
	walls: [
		{ id: 'solo-long', start: 'solo-a', end: 'solo-b', role: 'partition' },
		{ id: 'solo-short', start: 'solo-c', end: 'solo-b', role: 'partition' },
		{ id: 'late-long', start: 'late-a', end: 'late-b', role: 'partition' },
		{ id: 'late-short', start: 'late-c', end: 'late-b', role: 'partition' }
	]
});

/** A clean component first, then the SAMPLED failure (a curve crossing in one component). */
const CURVE_FAILURE_BEHIND_A_CLEAN_COMPONENT = documentOf({
	junctions: [
		['clean-a', 0, 0],
		['clean-b', 4, 0],
		['curve-a', 0, 20],
		['curve-m', 6, 20],
		['curve-b', 6, 24]
	],
	walls: [
		{ id: 'clean-h', start: 'clean-a', end: 'clean-b', role: 'partition' },
		{ id: 'curve-straight', start: 'curve-a', end: 'curve-m', role: 'partition' },
		{
			id: 'curve-bowed',
			start: 'curve-m',
			end: 'curve-b',
			role: 'partition',
			centerline: curved([6, 20], [6, 24], [[1, 18]], 'curve-bowed')
		}
	]
});

/** A clean component first, then a Room-level failure (a two-Wall boundary). */
const ROOM_FAILURE_BEHIND_A_CLEAN_COMPONENT = documentOf({
	junctions: [
		['clean-a', 0, 0],
		['clean-b', 4, 0],
		['thin-a', 0, 10],
		['thin-b', 4, 10],
		['thin-c', 4, 14]
	],
	walls: [
		{ id: 'clean-wall', start: 'clean-a', end: 'clean-b', role: 'partition' },
		{ id: 'thin-1', start: 'thin-a', end: 'thin-b' },
		{ id: 'thin-2', start: 'thin-b', end: 'thin-c' }
	],
	rooms: [
		{
			id: 'room-thin',
			name: 'Thin',
			boundary: [
				{ wallId: 'thin-1', direction: 'forward' },
				{ wallId: 'thin-2', direction: 'forward' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	]
});

/** A shallow sampled crossing beside an unrelated clean group (near-tangent variant). */
const NEAR_TANGENT_CURVE_FAILURE = documentOf({
	junctions: [
		['clean-a', 20, 0],
		['clean-b', 24, 0],
		['near-a', 0, 0],
		['near-m', 6, 0],
		['near-b', 6, 4]
	],
	walls: [
		{ id: 'clean-near', start: 'clean-a', end: 'clean-b', role: 'partition' },
		{ id: 'near-straight', start: 'near-a', end: 'near-m', role: 'partition' },
		{
			id: 'near-bowed',
			start: 'near-m',
			end: 'near-b',
			role: 'partition',
			centerline: curved([6, 0], [6, 4], [[3, -0.001]], 'near-bowed')
		}
	]
});

/** Reverses both overlapping Wall endpoint orders while retaining their explicit shared Junction. */
const REVERSED_WALL_OVERLAP = documentOf({
	junctions: [
		['clean-a', 20, 10],
		['clean-b', 24, 10],
		['reverse-a', 0, 10],
		['reverse-j', 6, 10],
		['reverse-c', 3, 10]
	],
	walls: [
		{ id: 'clean-reverse', start: 'clean-a', end: 'clean-b', role: 'partition' },
		{ id: 'reverse-long', start: 'reverse-j', end: 'reverse-a', role: 'partition' },
		{ id: 'reverse-short', start: 'reverse-j', end: 'reverse-c', role: 'partition' }
	]
});

/** A sampled crossing where one Wall has a zero-width X bounding box before expansion. */
const DEGENERATE_BOX_CURVE_FAILURE = documentOf({
	junctions: [
		['clean-a', 20, 0],
		['clean-b', 24, 0],
		['box-v-a', 4, 0],
		['box-v-b', 4, 8],
		['box-c', 10, 0]
	],
	walls: [
		{ id: 'clean-box', start: 'clean-a', end: 'clean-b', role: 'partition' },
		{ id: 'box-vertical', start: 'box-v-a', end: 'box-v-b', role: 'partition' },
		{
			id: 'box-bowed',
			start: 'box-v-a',
			end: 'box-c',
			role: 'partition',
			centerline: curved([4, 0], [10, 0], [[4, 6]], 'box-bowed')
		}
	]
});

/** Reversed, axis-aligned Walls give valid shared-endpoint relations and zero-area boxes. */
const REVERSED_DEGENERATE_VALID_COMPONENT = documentOf({
	junctions: [
		['clean-a', 20, 10],
		['clean-b', 24, 10],
		['valid-left', 0, 0],
		['valid-j', 4, 0],
		['valid-up', 4, 4]
	],
	walls: [
		{ id: 'clean-valid', start: 'clean-a', end: 'clean-b', role: 'partition' },
		{ id: 'valid-reversed-horizontal', start: 'valid-j', end: 'valid-left', role: 'partition' },
		{ id: 'valid-vertical', start: 'valid-j', end: 'valid-up', role: 'partition' }
	]
});

/** Two valid Room faces in one transitive Wall/Junction component. */
const TWO_ROOMS_SHARED_COMPONENT = documentOf({
	junctions: [
		['room-a', 0, 0],
		['room-m', 3, 0],
		['room-b', 6, 0],
		['room-c', 6, 4],
		['room-n', 3, 4],
		['room-d', 0, 4],
		['clean-a', 20, 0],
		['clean-b', 24, 0]
	],
	walls: [
		{ id: 'clean-room', start: 'clean-a', end: 'clean-b', role: 'partition' },
		{ id: 'room-south-left', start: 'room-a', end: 'room-m' },
		{ id: 'room-south-right', start: 'room-m', end: 'room-b' },
		{ id: 'room-east', start: 'room-b', end: 'room-c' },
		{ id: 'room-north-right', start: 'room-c', end: 'room-n' },
		{ id: 'room-north-left', start: 'room-n', end: 'room-d' },
		{ id: 'room-west', start: 'room-d', end: 'room-a' },
		{ id: 'room-shared', start: 'room-m', end: 'room-n' }
	],
	rooms: [
		{
			id: 'room-left',
			name: 'Left',
			boundary: [
				{ wallId: 'room-south-left', direction: 'forward' },
				{ wallId: 'room-shared', direction: 'forward' },
				{ wallId: 'room-north-left', direction: 'forward' },
				{ wallId: 'room-west', direction: 'forward' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		},
		{
			id: 'room-right',
			name: 'Right',
			boundary: [
				{ wallId: 'room-south-right', direction: 'forward' },
				{ wallId: 'room-east', direction: 'forward' },
				{ wallId: 'room-north-right', direction: 'forward' },
				{ wallId: 'room-shared', direction: 'reverse' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	]
});

// ---------------------------------------------------------------------------
// OR-3b fixtures — every overlap kind, as an INDEPENDENT pair
// ---------------------------------------------------------------------------

const INDEPENDENT_STRAIGHT_CROSSING = documentOf({
	junctions: [
		['h-a', 0, 0],
		['h-b', 8, 0],
		['v-a', 4, -3],
		['v-b', 4, 3]
	],
	walls: [
		{ id: 'wall-h', start: 'h-a', end: 'h-b', role: 'partition' },
		{ id: 'wall-v', start: 'v-a', end: 'v-b', role: 'partition' }
	]
});

const INDEPENDENT_COLLINEAR_OVERLAP = documentOf({
	junctions: [
		['l-a', 0, 0],
		['l-b', 6, 0],
		['r-a', 3, 0],
		['r-b', 9, 0]
	],
	walls: [
		{ id: 'wall-left', start: 'l-a', end: 'l-b', role: 'partition' },
		{ id: 'wall-right', start: 'r-a', end: 'r-b', role: 'partition' }
	]
});

/**
 * An independent partition stub whose endpoint lands on the interior of an
 * unrelated Wall — the T the pre-policy gate called `endpoint-on-interior`.
 */
const INDEPENDENT_TEE = documentOf({
	junctions: [
		['host-a', 0, 0],
		['host-b', 8, 0],
		['stub-a', 4, 0],
		['stub-b', 4, 3]
	],
	walls: [
		{ id: 'wall-host', start: 'host-a', end: 'host-b', role: 'partition' },
		{ id: 'wall-stub', start: 'stub-a', end: 'stub-b', role: 'partition' }
	]
});

const INDEPENDENT_CURVE_CROSSING = documentOf({
	junctions: [
		['up-a', 0, 0],
		['up-b', 10, 0],
		['dn-a', 0, 6],
		['dn-b', 10, 6]
	],
	walls: [
		{
			id: 'wall-up',
			start: 'up-a',
			end: 'up-b',
			role: 'partition',
			centerline: curved([0, 0], [10, 0], [[5, 3.6]], 'wall-up')
		},
		{
			id: 'wall-down',
			start: 'dn-a',
			end: 'dn-b',
			role: 'partition',
			centerline: curved([0, 6], [10, 6], [[5, 2.6]], 'wall-down')
		}
	]
});

/**
 * A Room plus a partition stub whose FAR endpoint lands on the interior of the
 * Room's south boundary Wall. `attached` starts the stub at one of the Room's OWN
 * Junctions, so the crossing is INSIDE one component; otherwise the stub owns both
 * of its Junctions and the crossing is between independent structures (OR-D12-5's
 * standalone-stub case).
 */
function stubAcrossRoomBoundary(attached: boolean): LayoutDocumentWallFirst {
	const { junctions, walls, room } = enclosure('r', 0, 0, 6, 4);
	return documentOf({
		junctions: [
			...junctions,
			...(attached ? [] : ([['stub-in', 3, 0]] as Array<[string, number, number]>)),
			['stub-far', 3, -3]
		],
		walls: [
			...walls,
			{
				id: 'wall-stub',
				start: attached ? 'r-c' : 'stub-in',
				end: 'stub-far',
				role: 'partition'
			}
		],
		rooms: [room]
	});
}

// ---------------------------------------------------------------------------

describe('P23B.3a S4/S5 — the sampled authority has exactly ONE subject', () => {
	it('defaults to the connected component, with no pre-policy escape left for any caller', () => {
		// The independent pair is skipped: their crossing is permitted geometry…
		expect(
			detectWallCurveTopologyCrossings(
				INDEPENDENT_CURVE_CROSSING,
				segmentsOf(INDEPENDENT_CURVE_CROSSING)
			)
		).toBeUndefined();
		// …and the transitional `{ subject: 'document' }` form S4 kept for the ONE
		// remaining document-subject caller (the chain gate) is GONE. The two-argument
		// call above is the entire public signature now, so no caller can make this gate
		// answer for a pair the shipped policy permits — which is the whole point of
		// scoping the chain gate in the same commit (R-3). The chain path's own verdict is
		// asserted through its planner in the S5 block below, and T8's flip lives in the
		// reference register.

		// A pair INSIDE one component is still reported: the component subject contracts
		// the examined set and nothing else (INV-2).
		const connected = documentOf({
			junctions: [
				['c-a', 0, 0],
				['c-m', 6, 0],
				['c-b', 6, 4]
			],
			walls: [
				{ id: 'c-straight', start: 'c-a', end: 'c-m', role: 'partition' },
				{
					id: 'c-bowed',
					start: 'c-m',
					end: 'c-b',
					role: 'partition',
					centerline: curved([6, 0], [6, 4], [[1, -2]], 'c-bowed')
				}
			]
		});
		expect(wallsShareTopologyComponent(connected, 'c-straight', 'c-bowed')).toBe(true);
		expect(detectWallCurveTopologyCrossings(connected, segmentsOf(connected))).toEqual({
			kind: 'pair',
			wallIds: ['c-straight', 'c-bowed'],
			sharedJunctionId: 'c-m'
		});
		const issue = validateWallFirstTopology(connected);
		expect(issue?.code).toBe('unsupported_wall_topology');
		expect(issue?.targetId).toBe('c-bowed');
		expect(issue?.message).toContain('cross away from their shared Junction');
	});
});

describe('P23B.3a S4 / OR-3a — for a same-component pair the scoped verdict IS the pre-policy verdict', () => {
	it('reports the FIRST failing component in document order, with that component’s own verdict', () => {
		const verdict = validateWallFirstTopology(ORDERED_FAILURES);
		const solo = isolateComponent(ORDERED_FAILURES, ['solo-long', 'solo-short']);
		expect(verdict).toEqual(validateWallFirstTopology(solo));
		expect(verdict?.code).toBe('unsupported_wall_topology');
		expect(verdict?.targetId).toBe('solo-short');
		expect(verdict?.message).toContain('overlap beyond their explicit shared Junction');

		// Removing the first failing component promotes the SECOND one unchanged: the
		// scoping neither invents nor loses a verdict on the way.
		const rest = isolateComponent(ORDERED_FAILURES, ['late-long', 'late-short']);
		const promoted = validateWallFirstTopology(rest);
		expect(promoted?.code).toBe('unsupported_wall_topology');
		expect(promoted?.targetId).toBe('late-short');
		// The two groups are independent of each other, so the promoted verdict is not a
		// document-order artifact of the multi-component input: it is `late`'s own.
		expect(wallsShareTopologyComponent(ORDERED_FAILURES, 'solo-long', 'late-long')).toBe(false);
	});

	it('does the same for an intrinsically-broken Room behind a clean component', () => {
		const verdict = validateWallFirstTopology(ROOM_FAILURE_BEHIND_A_CLEAN_COMPONENT);
		expect(verdict).toEqual(
			validateWallFirstTopology(
				isolateComponent(ROOM_FAILURE_BEHIND_A_CLEAN_COMPONENT, ['thin-1', 'thin-2'])
			)
		);
		expect(verdict?.code).toBe('unsupported_wall_topology');
		expect(verdict?.message).toContain('at least three boundary Walls');
	});

	it('does the same for the sampled crossing authority', () => {
		const verdict = validateWallFirstTopology(CURVE_FAILURE_BEHIND_A_CLEAN_COMPONENT);
		expect(verdict).toEqual(
			validateWallFirstTopology(
				isolateComponent(CURVE_FAILURE_BEHIND_A_CLEAN_COMPONENT, [
					'curve-straight',
					'curve-bowed'
				])
			)
		);
		expect(verdict?.code).toBe('unsupported_wall_topology');
		expect(verdict?.message).toContain('cross away from their shared Junction');
	});

	it('names ONLY Walls of one component, whatever the document contains', () => {
		// The scoped gate's whole claim, checked structurally: every failure it reports
		// is a failure INSIDE one component. The pair is read back out of the message and
		// the general Wall/Junction test is asked about it directly.
		for (const document of [
			ORDERED_FAILURES,
			CURVE_FAILURE_BEHIND_A_CLEAN_COMPONENT,
			ROOM_FAILURE_BEHIND_A_CLEAN_COMPONENT
		]) {
			const issue = validateWallFirstTopology(document);
			expect(issue).toBeDefined();
			const pair = /Walls '([^']+)' and '([^']+)'/.exec(issue!.message);
			if (!pair) continue;
			expect(wallsShareTopologyComponent(document, pair[1]!, pair[2]!)).toBe(true);
		}
	});
});

describe('P23B.3a S8 / OR-3a — deferred same-component variants', () => {
	const invalidVariants: ReadonlyArray<{
		label: string;
		document: LayoutDocumentWallFirst;
		wallIds: readonly [string, string];
	}> = [
		{
			label: 'near-tangent sampled curves',
			document: NEAR_TANGENT_CURVE_FAILURE,
			wallIds: ['near-straight', 'near-bowed']
		},
		{
			label: 'reversed collinear Walls',
			document: REVERSED_WALL_OVERLAP,
			wallIds: ['reverse-long', 'reverse-short']
		},
		{
			label: 'sampled crossing with a zero-width Wall box',
			document: DEGENERATE_BOX_CURVE_FAILURE,
			wallIds: ['box-vertical', 'box-bowed']
		}
	];

	const validVariants: ReadonlyArray<{
		label: string;
		document: LayoutDocumentWallFirst;
		wallIds: readonly [string, string];
		expectedRoomIds?: readonly string[];
	}> = [
		{
			label: 'reversed endpoint order and zero-area axis-aligned boxes',
			document: REVERSED_DEGENERATE_VALID_COMPONENT,
			wallIds: ['valid-reversed-horizontal', 'valid-vertical']
		},
		{
			label: 'multiple Rooms in one connected component',
			document: TWO_ROOMS_SHARED_COMPONENT,
			wallIds: ['room-south-left', 'room-south-right'],
			expectedRoomIds: ['room-left', 'room-right']
		}
	];

	it('does not drop an invalid same-component relation in the added variants', () => {
		for (const variant of invalidVariants) {
			const fullDocumentVerdict = validateWallFirstTopology(variant.document);
			const isolatedComponentVerdict = validateWallFirstTopology(
				isolateComponent(variant.document, variant.wallIds)
			);
			expect(
				wallsShareTopologyComponent(variant.document, ...variant.wallIds),
				variant.label
			).toBe(true);
			expect(fullDocumentVerdict, variant.label).toEqual(isolatedComponentVerdict);
			expect(fullDocumentVerdict, variant.label).toMatchObject({
				code: 'unsupported_wall_topology'
			});
		}
	});

	it('does not turn valid same-component relations into failures in the added variants', () => {
		for (const variant of validVariants) {
			const fullDocumentVerdict = validateWallFirstTopology(variant.document);
			const isolatedComponent = isolateComponent(variant.document, variant.wallIds);
			if (variant.expectedRoomIds) {
				expect(isolatedComponent.rooms.map((room) => room.id)).toEqual(variant.expectedRoomIds);
			}
			const isolatedComponentVerdict = validateWallFirstTopology(isolatedComponent);
			expect(
				wallsShareTopologyComponent(variant.document, ...variant.wallIds),
				variant.label
			).toBe(true);
			expect(fullDocumentVerdict, variant.label).toBeUndefined();
			expect(fullDocumentVerdict, variant.label).toEqual(isolatedComponentVerdict);
		}
	});

	it('continues to permit overlap across independent components', () => {
		for (const entry of [INDEPENDENT_CURVE_CROSSING, INDEPENDENT_COLLINEAR_OVERLAP, INDEPENDENT_TEE]) {
			expect(validateWallFirstTopology(entry)).toBeUndefined();
		}
		expect(wallsShareTopologyComponent(INDEPENDENT_CURVE_CROSSING, 'wall-up', 'wall-down')).toBe(
			false
		);
	});
});

describe('P23B.3a S4 / OR-3b — permitted overlap BETWEEN groups, preserved failure WITHIN one', () => {
	const PERMITTED: ReadonlyArray<{ label: string; document: LayoutDocumentWallFirst }> = [
		{ label: 'straight/straight proper crossing', document: INDEPENDENT_STRAIGHT_CROSSING },
		{ label: 'collinear overlap', document: INDEPENDENT_COLLINEAR_OVERLAP },
		{ label: 'endpoint-on-interior tee', document: INDEPENDENT_TEE },
		{ label: 'curve crossing whose chords miss', document: INDEPENDENT_CURVE_CROSSING },
		{ label: 'standalone stub across a Room boundary', document: stubAcrossRoomBoundary(false) }
	];

	it('reports nothing for each independent-group overlap kind', () => {
		for (const entry of PERMITTED) {
			expect(validateWallFirstTopology(entry.document), entry.label).toBeUndefined();
		}
		// Independence is NOT inferred from the pass: the general Wall/Junction test is
		// asked directly, never `connectedRoomIds` (OR-D12-5's requirement).
		expect(wallsShareTopologyComponent(INDEPENDENT_TEE, 'wall-host', 'wall-stub')).toBe(false);
		expect(wallsShareTopologyComponent(INDEPENDENT_STRAIGHT_CROSSING, 'wall-h', 'wall-v')).toBe(
			false
		);
		const crossingRoom = stubAcrossRoomBoundary(false);
		expect(wallsShareTopologyComponent(crossingRoom, 'wall-stub', 'r-a1')).toBe(false);
	});

	it('still refuses the SAME relations realized INSIDE one connected group', () => {
		// The containment direction OR-3b names: component scoping must not drop a
		// same-component failure. Each case is the relation above, realized in one
		// component — where the relation is expressible at all: two properly crossing
		// straight Walls cannot share a Junction without one of them being split first,
		// so the straight/straight case is represented by the overlap it admits instead.
		const sharedJunctionOverlap = documentOf({
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
		expect(
			wallsShareTopologyComponent(sharedJunctionOverlap, 'wall-long', 'wall-short')
		).toBe(true);
		const overlapIssue = validateWallFirstTopology(sharedJunctionOverlap);
		expect(overlapIssue?.code).toBe('unsupported_wall_topology');
		expect(overlapIssue?.message).toContain('overlap beyond their explicit shared Junction');

		// The tee, INSIDE one component: `wall-brace` links the stub's far Junction to the
		// host Wall's end, so the stub's endpoint lands on the host's interior while all
		// three Walls share one component.
		const tee = documentOf({
			junctions: [
				['host-a', 0, 0],
				['host-b', 8, 0],
				['stub-a', 4, 0],
				['stub-b', 4, 3]
			],
			walls: [
				{ id: 'wall-host', start: 'host-a', end: 'host-b', role: 'partition' },
				{ id: 'wall-stub', start: 'stub-a', end: 'stub-b', role: 'partition' },
				{ id: 'wall-brace', start: 'stub-b', end: 'host-b', role: 'partition' }
			]
		});
		expect(wallsShareTopologyComponent(tee, 'wall-host', 'wall-stub')).toBe(true);
		expect(validateWallFirstTopology(tee)?.code).toBe('unsupported_wall_topology');

		// The same stub attached to the Room's OWN Junction: one component, so the
		// crossing it makes is intra-group and stays refused.
		const attached = stubAcrossRoomBoundary(true);
		expect(wallsShareTopologyComponent(attached, 'wall-stub', 'r-a1')).toBe(true);
		expect(validateWallFirstTopology(attached)?.code).toBe('unsupported_wall_topology');

		// A self-intersecting centerline is a component of ONE Wall, and stays refused.
		const selfCrossing = documentOf({
			junctions: [
				['s-a', 0, 0],
				['s-b', 1, 0]
			],
			walls: [
				{
					id: 'wall-self',
					start: 's-a',
					end: 's-b',
					role: 'partition',
					centerline: curved([0, 0], [1, 0], [[5, 0]], 'wall-self')
				}
			]
		});
		const selfIssue = validateWallFirstTopology(selfCrossing);
		expect(selfIssue?.code).toBe('unsupported_wall_topology');
		expect(selfIssue?.message).toContain('intersects itself');
	});

});

describe('P23B.3a S5 / R-3 — the WALL-CHAIN gate takes the SAME subject in both halves', () => {
	it('chord half — an INDEPENDENT collinear pair no longer refuses an unrelated authored chain', () => {
		// `planWallChain` is the chain gate's production caller, so its verdict is the
		// evidence. The pre-policy gate examined EVERY pair of the candidate document, so
		// the two independent Walls' collinear overlap (wall-left 0…6, wall-right 3…9 at
		// z = 0) refused the whole command even though nothing in the authored chain
		// touches them — the pre-policy refusal this case records. S5 scopes the chord loop
		// exactly as S4 scoped the canonical one: the pair spans two components, so it is
		// skipped and the command is admitted.
		const baseline = INDEPENDENT_COLLINEAR_OVERLAP;
		const plan = planWallChain({
			baseline,
			points: [
				[-5, 10],
				[-1, 10]
			],
			close: false,
			role: 'partition'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.createdWallIds).toHaveLength(1);
		// The authored chain is a THIRD component: it adopted nothing, split nothing and
		// joined nothing — the gate skip is a verdict change, not a connectivity change.
		expect(plan.document.walls.map((wall) => wall.id)).toEqual([
			'wall-left',
			'wall-right',
			plan.createdWallIds[0]
		]);
		expect(wallsShareTopologyComponent(plan.document, 'wall-left', 'wall-right')).toBe(false);
		for (const wallId of ['wall-left', 'wall-right']) {
			expect(
				wallsShareTopologyComponent(plan.document, wallId, plan.createdWallIds[0]!)
			).toBe(false);
		}
		expect(validateWallFirstTopology(plan.document)).toBeUndefined();
	});

	it('sampled half — an independent crossing is admitted, and the result is the document the canonical gate accepts', () => {
		// The same parity for the sampled authority: the two INDEPENDENT curved Walls
		// cross, and the			authored straight Wall crosses both bows while its chords stay
		// clear. Under the pre-policy subject this was `self_intersecting_chain`; S5 gives
		// the chain gate the canonical subject, so the same authoring command succeeds.
		const plan = planWallChain({
			baseline: INDEPENDENT_CURVE_CROSSING,
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
		expect(plan.document.walls.map((wall) => wall.id)).toEqual([
			'wall-up',
			'wall-down',
			authored.id
		]);
		// The crossing is visual only: no shared Junction, no split (the two curved Walls
		// keep their own endpoints), and the canonical gate agrees with the chain gate
		// about the document the planner produced — the two gates can no longer disagree.
		for (const wallId of ['wall-up', 'wall-down']) {
			expect(wallsShareTopologyComponent(plan.document, wallId, authored.id)).toBe(false);
		}
		expect(validateWallFirstTopology(plan.document)).toBeUndefined();
	});
});

describe('P23B.3a S5 / D-9 — the COINCIDENCE rule is component-scoped', () => {
	it('admits two INDEPENDENT structures at identical coordinates, and joins nothing', () => {
		// The pre-policy verdict here was `duplicate_junction_point`: the rule compared
		// EVERY Junction pair in the document, so equal coordinates alone were refused.
		// S5 scopes it the same way S4 scoped the intersection checks — a coincident node
		// is an accident only where the two nodes describe ONE graph — so the document is
		// ADMITTED, exactly like the overlapping pairs OR-3b permits.
		const near = enclosure('p', 0, 0, 6, 4);
		const far = enclosure('q', 0, 0, 6, 4);
		const coincident = documentOf({
			junctions: [...near.junctions, ...far.junctions],
			walls: [...near.walls, ...far.walls],
			rooms: [near.room, far.room]
		});
		// The coordinates really are identical — the permission is NOT "the fixture drifted".
		const pointOf = (id: string) => coincident.junctions.find((junction) => junction.id === id)!.point;
		expect(pointOf('p-a')).toEqual(pointOf('q-a'));
		expect(pointOf('p-c')).toEqual(pointOf('q-c'));
		expect(junctionsShareTopologyComponent(coincident, 'p-a', 'q-a')).toBe(false);
		expect(wallsShareTopologyComponent(coincident, 'p-a1', 'q-a1')).toBe(false);
		expect(validateWallFirstTopology(coincident)).toBeUndefined();
		// No implicit join, merge or repair: identity is exactly what was authored.
		expect(coincident.junctions).toHaveLength(8);
		expect(coincident.walls).toHaveLength(8);
		expect(coincident.rooms.map((room) => room.id)).toEqual(['room-p', 'room-q']);
	});

	it('still refuses coincident Junctions INSIDE one component — the accidental duplicate', () => {
		// The containment half of D-9, on the same shape: a second Wall attached to the
		// FIRST structure's own Junction `p-a` whose far end lands exactly on `p-b`. Both
		// nodes are in ONE component, so the coincidence is the accidental duplicate the
		// rule exists for and stays invalid — code, message and target unchanged (INV-2).
		const near = enclosure('p', 0, 0, 6, 4);
		const folded = documentOf({
			junctions: [...near.junctions, ['p-dup', 6, 0]],
			walls: [...near.walls, { id: 'p-fold', start: 'p-a', end: 'p-dup', role: 'partition' }],
			rooms: [near.room]
		});
		expect(junctionsShareTopologyComponent(folded, 'p-b', 'p-dup')).toBe(true);
		const issue = validateWallFirstTopology(folded);
		expect(issue?.code).toBe('duplicate_junction_point');
		expect(issue?.targetId).toBe('p-dup');
		expect(issue?.message).toContain("Junction 'p-dup' duplicates the point of 'p-b'");
	});

	it('keeps the explicit UNATTACHED-JUNCTION rule in both directions', () => {
		// A Junction no Wall references carries the single `UNATTACHED_JUNCTION_COMPONENT`
		// label, so two coincident dangling Junctions are one "component" for this rule and
		// stay INVALID — the check is kept, not silently dropped for the case it cannot
		// classify. (The dangling Junctions are at [40, 40], nowhere near the enclosure.)
		const near = enclosure('p', 0, 0, 6, 4);
		const danglingPair = documentOf({
			junctions: [
				...near.junctions,
				['dangling-a', 40, 40],
				['dangling-b', 40, 40]
			],
			walls: [...near.walls],
			rooms: [near.room]
		});
		expect(junctionsShareTopologyComponent(danglingPair, 'dangling-a', 'dangling-b')).toBe(true);
		const issue = validateWallFirstTopology(danglingPair);
		expect(issue?.code).toBe('duplicate_junction_point');
		expect(issue?.targetId).toBe('dangling-b');

		// The other direction is explicit and intended (D-9): an unattached Junction is
		// never in a Wall component, so its coincidence with a Wall's Junction is the
		// permitted case above — the dangling node is NOT a second Junction at `p-a`.
		const danglingOnWall = documentOf({
			junctions: [...near.junctions, ['dangling-c', 0, 0]],
			walls: [...near.walls],
			rooms: [near.room]
		});
		expect(junctionsShareTopologyComponent(danglingOnWall, 'dangling-c', 'p-a')).toBe(false);
		expect(validateWallFirstTopology(danglingOnWall)).toBeUndefined();
	});

	it('keeps a Wall id equal to the old sentinel STRING from claiming the unattached label', () => {
		// S5 review blocker: a Wall component is labelled by its first member Wall's
		// authored id, and the unattached-Junction label used to be the STRING
		// 'unattached-junctions'. A Wall legitimately named `unattached-junctions` therefore
		// claimed that string for its own component, so its Junctions and every unattached
		// Junction compared EQUAL: an unattached Junction coinciding with that Wall's
		// endpoint was refused as `duplicate_junction_point` — reported as connected to a
		// Wall it shares no identity with. The label is now a SYMBOL, which no authored
		// string can equal. Each fixture below passes the codec, so the Wall id is
		// legitimate authored input rather than an out-of-band value.
		const sentinelWallId = 'unattached-junctions';
		const coincidentDangling = documentOf({
			junctions: [
				['w-a', 0, 0],
				['w-b', 6, 0],
				// No Wall references this Junction, and it sits exactly on `w-a`.
				['w-dangling', 0, 0]
			],
			walls: [{ id: sentinelWallId, start: 'w-a', end: 'w-b', role: 'partition' }]
		});
		expect(validateWallFirstLayoutDocument(coincidentDangling).success).toBe(true);
		const keyByJunctionId = topologyComponentKeyByJunctionId(coincidentDangling);
		// The Wall component really is labelled with the sentinel's old string...
		expect(keyByJunctionId.get('w-a')).toBe(sentinelWallId);
		// ... and the unattached Junction is still NOT in it: independent, and permitted.
		expect(keyByJunctionId.get('w-dangling')).toBe(UNATTACHED_JUNCTION_COMPONENT);
		expect(junctionsShareTopologyComponent(coincidentDangling, 'w-dangling', 'w-a')).toBe(false);
		expect(validateWallFirstTopology(coincidentDangling)).toBeUndefined();

		// Two coincident UNATTACHED Junctions still share the single unattached label, so
		// their coincidence stays the accidental duplicate the rule exists for.
		const danglingPair = documentOf({
			junctions: [
				['w-a', 0, 0],
				['w-b', 6, 0],
				['w-orphan-1', 40, 40],
				['w-orphan-2', 40, 40]
			],
			walls: [{ id: sentinelWallId, start: 'w-a', end: 'w-b', role: 'partition' }]
		});
		expect(validateWallFirstLayoutDocument(danglingPair).success).toBe(true);
		expect(junctionsShareTopologyComponent(danglingPair, 'w-orphan-1', 'w-orphan-2')).toBe(true);
		const orphanIssue = validateWallFirstTopology(danglingPair);
		expect(orphanIssue?.code).toBe('duplicate_junction_point');
		expect(orphanIssue?.targetId).toBe('w-orphan-2');
		expect(orphanIssue?.message).toContain("Junction 'w-orphan-2' duplicates the point of 'w-orphan-1'");

		// And the same-component rejection the rule already had is preserved under that
		// Wall id: a second Wall attached to `w-a` whose free end lands exactly on `w-b`
		// is still the accidental duplicate, because both nodes are in ONE component.
		const folded = documentOf({
			junctions: [
				['w-a', 0, 0],
				['w-b', 6, 0],
				['w-dup', 6, 0]
			],
			walls: [
				{ id: sentinelWallId, start: 'w-a', end: 'w-b', role: 'partition' },
				{ id: 'w-fold', start: 'w-a', end: 'w-dup', role: 'partition' }
			]
		});
		expect(validateWallFirstLayoutDocument(folded).success).toBe(true);
		expect(junctionsShareTopologyComponent(folded, 'w-b', 'w-dup')).toBe(true);
		const foldedIssue = validateWallFirstTopology(folded);
		expect(foldedIssue?.code).toBe('duplicate_junction_point');
		expect(foldedIssue?.targetId).toBe('w-dup');
		expect(foldedIssue?.message).toContain("Junction 'w-dup' duplicates the point of 'w-b'");
	});
});

describe('P23B.3a S4 / OR-4a — atomicity on refusal, and a pure read', () => {
	it('refuses a same-component failure through a real planner and writes nothing', () => {
		// The scoped gate reached through a shipped precision planner: a partition
		// ATTACHED to the Room's own Junction `r-c`, starting outside the Room, whose
		// free end is then moved onto the interior of the Room's `r-d1`. The conflict is
		// INSIDE one connected group, so the re-scope must not relax it, and the refusal
		// must leave the caller's document byte-identical.
		const { junctions, walls, room } = enclosure('r', 0, 0, 6, 4);
		const attachedStub = documentOf({
			junctions: [...junctions, ['stub-far', 10, 4]],
			walls: [
				...walls,
				{ id: 'wall-stub', start: 'r-c', end: 'stub-far', role: 'partition' }
			],
			rooms: [room]
		});
		// The baseline is valid, and the stub IS in the Room's component: the refusal
		// below is about the candidate, not about the pre-state.
		expect(validateWallFirstTopology(attachedStub)).toBeUndefined();
		expect(wallsShareTopologyComponent(attachedStub, 'wall-stub', 'r-d1')).toBe(true);

		const snapshot = JSON.stringify(attachedStub);
		const plan = planExactJunctionMove(attachedStub, 'stub-far', [0, 1]);
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('topology_invalid');
		expect(plan.rejection.message).toContain('endpoint-on-interior');
		expect(JSON.stringify(attachedStub)).toBe(snapshot);
	});

	it('is a pure read: validating a refused document changes nothing', () => {
		for (const document of [
			ORDERED_FAILURES,
			INDEPENDENT_CURVE_CROSSING,
			stubAcrossRoomBoundary(false)
		]) {
			const snapshot = JSON.stringify(document);
			validateWallFirstTopology(document);
			validateWallFirstTopology(document);
			expect(JSON.stringify(document)).toBe(snapshot);
		}
	});
});
