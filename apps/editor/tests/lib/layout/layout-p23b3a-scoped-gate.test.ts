/**
 * P23B.3a S4 — the component-scoped SUBJECT, and its own oracle.
 *
 * S4 re-scoped the subject of the canonical gate (`validateWallFirstTopology`,
 * and with it the sampled crossing authority `detectWallCurveTopologyCrossings`)
 * from "all Walls in the document" to "Walls in the same connected component".
 * This file is that step's evidence, and it asserts the three obligations the
 * slice's acceptance criteria name for a re-scope (OR-3a, OR-3b, OR-4a) rather
 * than restating the cases the S1 reference register already owns.
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
 * TWO BOUNDARIES THIS FILE PINS SO NEITHER IS MISREAD AS PART OF S4:
 *
 * ```text
 * · the COINCIDENCE rule (`duplicate_junction_point`) is still document-global
 *   here. D-9's scoping is P23B.3a S5's subject, so two exactly-coincident
 *   independent structures are STILL refused today, and this file asserts that
 *   rather than pretending S4 delivered it;
 * · the CHAIN gate (`validateChainTopology`) still examines the whole document.
 *   Its re-scope is S5's, which is why `detectWallCurveTopologyCrossings` keeps an
 *   explicit `{ subject: 'document' }` form for that caller and for the parity
 *   assertion below.
 * ```
 */
import { describe, expect, it } from 'vitest';

import {
	deriveChainSpans,
	detectWallCurveTopologyCrossings,
	planExactJunctionMove,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
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
 * Keep ONLY the named Walls and everything that belongs to them. Safe by
 * construction: a Room or Opening that straddled the removed Walls is dropped
 * rather than left dangling, so the isolated document is a well-formed one.
 */
function isolateComponent(
	document: LayoutDocumentWallFirst,
	wallIds: readonly string[]
): LayoutDocumentWallFirst {
	const keep = new Set(wallIds);
	const walls = document.walls.filter((wall) => keep.has(wall.id));
	const junctionIds = new Set(
		walls.flatMap((wall) => [wall.startJunctionId, wall.endJunctionId])
	);
	return {
		...document,
		junctions: document.junctions.filter((junction) => junctionIds.has(junction.id)),
		walls,
		rooms: document.rooms.filter((room) =>
			room.boundary.every((ref) => keep.has(ref.wallId))
		),
		openings: document.openings.filter((opening) => keep.has(opening.wallId))
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

describe('P23B.3a S4 — the sampled authority’s subject', () => {
	it('defaults to the connected component, and keeps the document subject explicitly for the chain gate', () => {
		// The independent pair is skipped by the DEFAULT subject...
		expect(
			detectWallCurveTopologyCrossings(
				INDEPENDENT_CURVE_CROSSING,
				segmentsOf(INDEPENDENT_CURVE_CROSSING)
			)
		).toBeUndefined();
		// ...and the crossing it hides is still there for the caller that asks for the
		// pre-policy subject — which is exactly the Wall-chain gate until S5 re-scopes it.
		expect(
			detectWallCurveTopologyCrossings(
				INDEPENDENT_CURVE_CROSSING,
				segmentsOf(INDEPENDENT_CURVE_CROSSING),
				{ subject: 'document' }
			)
		).toEqual({ kind: 'pair', wallIds: ['wall-up', 'wall-down'] });

		// A pair INSIDE one component is reported under BOTH subjects: the component
		// subject contracts the examined set and nothing else (INV-2).
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
		const expected = {
			kind: 'pair',
			wallIds: ['c-straight', 'c-bowed'],
			sharedJunctionId: 'c-m'
		};
		expect(detectWallCurveTopologyCrossings(connected, segmentsOf(connected))).toEqual(expected);
		expect(
			detectWallCurveTopologyCrossings(connected, segmentsOf(connected), {
				subject: 'document'
			})
		).toEqual(expected);
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

	it('leaves the COINCIDENCE rule alone — two coincident independent structures are still refused (S5 owns that)', () => {
		// The boundary of S4, asserted so it cannot be mistaken for delivered policy:
		// D-9's component-scoped coincidence is P23B.3a S5's subject. Two enclosures at
		// exactly the same coordinates overlap geometrically AND carry coincident
		// Junctions, and the document-global coincidence rule still refuses them.
		const near = enclosure('p', 0, 0, 6, 4);
		const far = enclosure('q', 0, 0, 6, 4);
		const coincident = documentOf({
			junctions: [...near.junctions, ...far.junctions],
			walls: [...near.walls, ...far.walls],
			rooms: [near.room, far.room]
		});
		expect(wallsShareTopologyComponent(coincident, 'p-a1', 'q-a1')).toBe(false);
		expect(validateWallFirstTopology(coincident)?.code).toBe('duplicate_junction_point');
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
