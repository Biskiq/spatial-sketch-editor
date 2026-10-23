/**
 * P23B.11 S3 — the M-1 pair short-circuits, proved by the adversarial bbox rows.
 *
 * WHAT THIS FILE IS. S3 landed M-1 in `buildCorrespondenceComponents`: the pairs
 * that can never union are now removed BEFORE their geometry is evaluated —
 * (a) `unionAuthorized` first (a pure component-label comparison, the same
 * decision today's loop reaches only after paying for the predicates), then
 * (b) an inflated-box prune that fires only when BOTH merge conditions are
 * impossible, then (c) containment before the overlap predicate, with the
 * containment CALL itself skipped when the witness's own box proves it cannot be
 * strictly inside the face. Each saving is EXACT: every skip is justified by the
 * predicate it removes, so the component output and the reconciliation outcome
 * must be untouched.
 *
 * WHAT IS (AND IS NOT) IN THIS FILE. This is the cheap half of that proof (plan
 * §7.6 area 1): the adversarial rows below drive
 * `buildCorrespondenceComponents` directly with synthetic geometry — the same
 * call the planner makes — so every boundary case is isolated, both modes are
 * run side by side inside one test, and NO file-wide setup is needed. The
 * expensive half — the frozen-reference differential over the whole 44-case
 * table (OR-1, OR-2 neutrality, OR-6 count oracle) — needs a `beforeAll` that
 * runs that table twice, so it lives in the heavy lane's
 * `correspondence-reference-differential.test.ts`. Both halves read the same
 * `./p23b11-correspondence-reference` freeze.
 *
 * WHY THE GLOBAL FLAG IS SAFE HERE. `disableCorrespondenceShortCircuitsForTest`
 * and the observer are the P23B.4 pattern: opt-in, test-only, never persisted,
 * and unset changes nothing at all. Vitest isolates test files, so the module
 * state below is this file's own; `afterEach` clears it anyway.
 *
 * THE ADVERSARIAL ROWS each isolate one boundary case: a touching edge, an edge
 * touch at a vertex, a collinear zero-area ring, coincident identical rings, an
 * overlap decided by the polygon predicate while the witness sits ON the face
 * ring, an overlap that survives a bounds-skipped containment call, a gap WITHIN
 * the predicates' own slack, a gap BEYOND it, a far gap, an empty polygon, absent
 * evidence, a NaN polygon, a NaN witness, and the D-12 identity rows
 * (same-group, cross-group, one-sided) whose geometry ADMITS a union that
 * identity must still deny. The both-undefined rows deliberately exercise the
 * DEFENSIVE "neither side resolves" branch, so the class can never mask a
 * geometry skip; the identity rows then exercise the branches where a label
 * decides. Every row asserts the shipped and exhaustive modes produce the same
 * component output, and that a skipped call or pruned pair was a TRUE NEGATIVE
 * in the exhaustive run — the exact statement of INV-4.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
	buildCorrespondenceComponents,
	clearCorrespondenceObserverForTest,
	disableCorrespondenceShortCircuitsForTest,
	setCorrespondenceObserverForTest,
	type ComponentLineage,
	type CorrespondenceObservation,
	type DerivedCandidateFace,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallFirstRoom,
	type OrientedWallRef
} from '@portfolio/layout-core';

afterEach(() => {
	clearCorrespondenceObserverForTest();
	disableCorrespondenceShortCircuitsForTest(false);
});

/** Component membership only — the pair decisions, independent of ordering. */
function componentKeyset(components: readonly ComponentLineage[]): string[] {
	return components
		.map(
			(component) =>
				`${[...component.candidateFaceKeys].sort().join('|')}=>${[
					...component.predecessorRoomIds
				]
					.sort()
					.join('|')}`
		)
		.sort();
}

/** The one union decision this file asks about: does face and Room share a component? */
function unions(
	components: readonly ComponentLineage[],
	faceKey: string,
	roomId: string
): boolean {
	return components.some(
		(component) =>
			[...component.candidateFaceKeys].includes(faceKey) &&
			[...component.predecessorRoomIds].includes(roomId)
	);
}

/**
 * The accounting identities every observation must obey, per mode. In
 * short-circuit mode the reduction identity names WHERE the avoided calls went:
 * `2*pairs` is today's evaluation count, and every call the pass did not make is
 * exactly a denied pair, a pruned pair, an absent-evidence pair (two calls each),
 * a bounds-skipped containment call (one), or a containment admission that made
 * the overlap call unnecessary (one). Exhaustive mode pays for everything instead,
 * and its admission counters are what prove a D-12 denial was preceded by real
 * geometry.
 */
function expectAccounting(observation: CorrespondenceObservation): void {
	expect(
		observation.sameGroupPairs + observation.crossGroupPairs + observation.undefinedPairs
	).toBe(observation.pairs);
	expect(
		observation.identitySettled +
			observation.authorizationSkips +
			observation.absentEvidenceSkips +
			observation.boundsSkips +
			observation.insideSkipsByBounds +
			observation.insideCalls
	).toBe(observation.pairs);
	if (observation.mode === 'short-circuit') {
		expect(observation.identityUnions + observation.identityRefusals).toBe(
			observation.identitySettled
		);
		expect(observation.insideCalls + observation.insideSkipsByBounds).toBe(
			observation.insideDecisions + observation.overlapCalls
		);
		expect(observation.insideDecisions).toBeLessThanOrEqual(observation.insideCalls);
		expect(2 * observation.pairs - (observation.insideCalls + observation.overlapCalls)).toBe(
			2 *
				(observation.identitySettled +
					observation.authorizationSkips +
					observation.absentEvidenceSkips +
					observation.boundsSkips) +
				observation.insideSkipsByBounds +
				observation.insideDecisions
		);
	} else {
		expect(observation.insideSkipsByBounds).toBe(0);
		expect(observation.insideDecisions + observation.overlapDecisions).toBeLessThanOrEqual(
			observation.pairs
		);
	}
}

/** The identity arrangement a synthetic row gives its face and its predecessor. */
type AdversarialIdentity = 'both-undefined' | 'same-group' | 'cross-group' | 'one-sided';

type AdversarialRow = {
	id: string;
	note: string;
	facePolygon: LayoutVec2[];
	/** `undefined` models absent polygon evidence (no map entry at all). */
	roomPolygon: LayoutVec2[] | undefined;
	/** `undefined` models an absent predecessor witness. */
	witness: LayoutVec2 | undefined;
	identity: AdversarialIdentity;
	/** The final component decision — the ONLY thing geometry and identity may produce. */
	expectUnion: boolean;
	/** Pairs the exact predicates ADMIT (exhaustive mode decisions). */
	expectExhaustiveDecisions: 0 | 1;
	/** Shipped mode: pruned by the inflated boxes before either call. */
	expectBoundsSkip: boolean;
	/** Shipped mode: the containment CALL skipped, the overlap call still made. */
	expectInsideCallSkip: boolean;
	/** Shipped mode: predicate calls actually made. */
	expectInsideCalls: 0 | 1;
	expectOverlapCalls: 0 | 1;
};

const SQUARE: LayoutVec2[] = [
	[0, 0],
	[1, 0],
	[1, 1],
	[0, 1]
];

/** The overlap-proving room: it covers the face's right half, witness ON the face ring. */
const OVERLAPPING_ROOM: LayoutVec2[] = [
	[0.5, -0.5],
	[1.5, -0.5],
	[1.5, 0.5],
	[0.5, 0.5]
];

const ON_RING_TOLERANCE = 1e-9;

/** The unit square to the RIGHT of the face, pushed out by `offsetX`: gap-first rows. */
function translatedSquare(offsetX: number): LayoutVec2[] {
	return [
		[1 + offsetX, 0],
		[2 + offsetX, 0],
		[2 + offsetX, 1],
		[1 + offsetX, 1]
	];
}

const ADVERSARIAL_ROWS: readonly AdversarialRow[] = [
	{
		id: 'touching-shared-edge',
		note: 'Adjacent squares sharing a full edge. The overlap predicate refuses an edge touch, so the pair must not be treated as a clear gap; the witness sits outside the face box, so the shipped mode may skip only the containment CALL.',
		facePolygon: SQUARE,
		roomPolygon: [
			[1, 0],
			[2, 0],
			[2, 1],
			[1, 1]
		],
		witness: [1.5, 0.5],
		identity: 'both-undefined',
		expectUnion: false,
		expectExhaustiveDecisions: 0,
		expectBoundsSkip: false,
		expectInsideCallSkip: true,
		expectInsideCalls: 0,
		expectOverlapCalls: 1
	},
	{
		id: 'touching-at-vertex',
		note: 'Squares touching at one corner: the same adjacency rule, decided by the overlap call the shipped mode must still make.',
		facePolygon: SQUARE,
		roomPolygon: [
			[1, 1],
			[2, 1],
			[2, 2],
			[1, 2]
		],
		witness: [1.5, 1.5],
		identity: 'both-undefined',
		expectUnion: false,
		expectExhaustiveDecisions: 0,
		expectBoundsSkip: false,
		expectInsideCallSkip: true,
		expectInsideCalls: 0,
		expectOverlapCalls: 1
	},
	{
		id: 'collinear-zero-area-ring',
		note: 'A zero-area ring lying exactly along the face’s right edge. It has no interior and no ear triangle, and its boxes overlap, so the pair is NEVER pruned — the exact predicates decide.',
		facePolygon: SQUARE,
		roomPolygon: [
			[1, 0],
			[1, 1],
			[1, 0.5]
		],
		witness: [1, 0.5],
		identity: 'both-undefined',
		expectUnion: false,
		expectExhaustiveDecisions: 0,
		expectBoundsSkip: false,
		expectInsideCallSkip: false,
		expectInsideCalls: 1,
		expectOverlapCalls: 1
	},
	{
		id: 'coincident-identical-rings',
		note: 'Identical rings: containment decides the pair, so the overlap predicate — which would need the ear-triangle fallback — is not even called on the shipped side.',
		facePolygon: SQUARE,
		roomPolygon: SQUARE,
		witness: [0.5, 0.5],
		identity: 'both-undefined',
		expectUnion: true,
		expectExhaustiveDecisions: 1,
		expectBoundsSkip: false,
		expectInsideCallSkip: false,
		expectInsideCalls: 1,
		expectOverlapCalls: 0
	},
	{
		id: 'overlap-decided-by-polygon',
		note: 'The witness lies ON the face ring (containment is false, and it is not provably outside the box), while the polygon genuinely overlaps: the shipped side must still reach the overlap predicate and union.',
		facePolygon: SQUARE,
		roomPolygon: OVERLAPPING_ROOM,
		witness: [1, 0],
		identity: 'both-undefined',
		expectUnion: true,
		expectExhaustiveDecisions: 1,
		expectBoundsSkip: false,
		expectInsideCallSkip: false,
		expectInsideCalls: 1,
		expectOverlapCalls: 1
	},
	{
		id: 'overlap-survives-containment-skip',
		note: 'M-1(c) at its most dangerous: the witness is far OUTSIDE the face box, so the containment call is skipped — but the polygon still overlaps, so the overlap call must union exactly as today.',
		facePolygon: SQUARE,
		roomPolygon: OVERLAPPING_ROOM,
		witness: [5, 5],
		identity: 'both-undefined',
		expectUnion: true,
		expectExhaustiveDecisions: 1,
		expectBoundsSkip: false,
		expectInsideCallSkip: true,
		expectInsideCalls: 0,
		expectOverlapCalls: 1
	},
	{
		id: 'gap-within-tolerance-slack',
		note: 'The gap is HALF the predicates’ own ring tolerance: inside the slack the pruning must never fire, and the overlap call must confirm what the predicate says.',
		facePolygon: SQUARE,
		roomPolygon: translatedSquare(ON_RING_TOLERANCE / 2),
		witness: [1.5, 0.5],
		identity: 'both-undefined',
		expectUnion: false,
		expectExhaustiveDecisions: 0,
		expectBoundsSkip: false,
		expectInsideCallSkip: true,
		expectInsideCalls: 0,
		expectOverlapCalls: 1
	},
	{
		id: 'gap-beyond-tolerance-slack',
		note: 'The gap is twice the predicate’s tolerance: the boxes PROVE both conditions impossible, so the pair is pruned — and the exhaustive run shows the predicates refused it too.',
		facePolygon: SQUARE,
		roomPolygon: translatedSquare(ON_RING_TOLERANCE * 4),
		witness: [1.5, 0.5],
		identity: 'both-undefined',
		expectUnion: false,
		expectExhaustiveDecisions: 0,
		expectBoundsSkip: true,
		expectInsideCallSkip: false,
		expectInsideCalls: 0,
		expectOverlapCalls: 0
	},
	{
		id: 'far-gap',
		note: 'A clear-gap pair: pruned, no calls, no union — the row the island fixtures are made of.',
		facePolygon: SQUARE,
		roomPolygon: [
			[10, 0],
			[11, 0],
			[11, 1],
			[10, 1]
		],
		witness: [10.5, 0.5],
		identity: 'both-undefined',
		expectUnion: false,
		expectExhaustiveDecisions: 0,
		expectBoundsSkip: true,
		expectInsideCallSkip: false,
		expectInsideCalls: 0,
		expectOverlapCalls: 0
	},
	{
		id: 'empty-polygon',
		note: 'A present-but-empty polygon: its boxes are undefined, so it is NEVER pruned, and both predicate steps are visited with no evidence to decide on.',
		facePolygon: SQUARE,
		roomPolygon: [],
		witness: undefined,
		identity: 'both-undefined',
		expectUnion: false,
		expectExhaustiveDecisions: 0,
		expectBoundsSkip: false,
		expectInsideCallSkip: false,
		expectInsideCalls: 1,
		expectOverlapCalls: 1
	},
	{
		id: 'absent-evidence',
		note: 'No witness AND no polygon: both conditions are false by definition, today’s loop walks them and discards them, and the skip saves the walk — never a verdict.',
		facePolygon: SQUARE,
		roomPolygon: undefined,
		witness: undefined,
		identity: 'both-undefined',
		expectUnion: false,
		expectExhaustiveDecisions: 0,
		expectBoundsSkip: false,
		expectInsideCallSkip: false,
		expectInsideCalls: 0,
		expectOverlapCalls: 0
	},
	{
		id: 'nan-polygon',
		note: 'A NaN coordinate in the room polygon makes its boxes undefined, so the pair is never pruned; containment still decides it exactly.',
		facePolygon: SQUARE,
		roomPolygon: [
			[NaN, 0],
			[1, 0],
			[0, 1]
		],
		witness: [0.5, 0.5],
		identity: 'both-undefined',
		expectUnion: true,
		expectExhaustiveDecisions: 1,
		expectBoundsSkip: false,
		expectInsideCallSkip: false,
		expectInsideCalls: 1,
		expectOverlapCalls: 0
	},
	{
		id: 'nan-witness',
		note: 'A NaN witness can never be proven outside a box, so the polygon evidence is still consulted and unions — the guard is conservative, not convenient.',
		facePolygon: SQUARE,
		roomPolygon: OVERLAPPING_ROOM,
		witness: [NaN, NaN],
		identity: 'both-undefined',
		expectUnion: true,
		expectExhaustiveDecisions: 1,
		expectBoundsSkip: false,
		expectInsideCallSkip: false,
		expectInsideCalls: 1,
		expectOverlapCalls: 1
	},
	{
		id: 'identity-same-group-overlap',
		note: 'The authorized path with overlapping boxes: the only row family where M-1(b)/(c) can save work on a connected plan, and it must union exactly as before.',
		facePolygon: SQUARE,
		roomPolygon: OVERLAPPING_ROOM,
		witness: [1, 0],
		identity: 'same-group',
		expectUnion: true,
		expectExhaustiveDecisions: 1,
		expectBoundsSkip: false,
		expectInsideCallSkip: false,
		expectInsideCalls: 1,
		expectOverlapCalls: 1
	},
	{
		id: 'identity-cross-group-geometry-admits',
		note: 'D-12 under M-1(a): two graph-independent structures whose geometry ADMITS a union. The exhaustive run pays for both predicates and THEN denies; the shipped run must deny without evaluating them — and neither may union.',
		facePolygon: SQUARE,
		roomPolygon: OVERLAPPING_ROOM,
		witness: [1, 0],
		identity: 'cross-group',
		expectUnion: false,
		expectExhaustiveDecisions: 1,
		expectBoundsSkip: false,
		expectInsideCallSkip: false,
		expectInsideCalls: 0,
		expectOverlapCalls: 0
	},
	{
		id: 'identity-one-sided-denied',
		note: 'The exactly-one-resolves branch: the face has authored identity, the predecessor has none. Geometry admits, identity denies, and the shipped first check must preserve the denial without paying for the predicates.',
		facePolygon: SQUARE,
		roomPolygon: OVERLAPPING_ROOM,
		witness: [1, 0],
		identity: 'one-sided',
		expectUnion: false,
		expectExhaustiveDecisions: 1,
		expectBoundsSkip: false,
		expectInsideCallSkip: false,
		expectInsideCalls: 0,
		expectOverlapCalls: 0
	}
];

function syntheticWall(id: string, junctionId: string): LayoutWall {
	return {
		id,
		startJunctionId: junctionId,
		endJunctionId: junctionId,
		thickness: 0.2,
		height: 2.6,
		centerline: { kind: 'line' }
	};
}

type SyntheticRun = {
	components: ComponentLineage[];
	observation: CorrespondenceObservation;
	faceKey: string;
	roomId: string;
};

function runSynthetic(
	row: AdversarialRow,
	mode: CorrespondenceObservation['mode']
): SyntheticRun {
	const faceKey = `${row.id}:face`;
	const roomId = `${row.id}:room`;
	const walls: LayoutWall[] = [];
	const faceBoundary: OrientedWallRef[] = [];
	const roomBoundary: OrientedWallRef[] = [];
	if (row.identity === 'same-group') {
		walls.push(syntheticWall('w-shared', 'j-shared'));
		faceBoundary.push({ wallId: 'w-shared', direction: 'forward' });
		roomBoundary.push({ wallId: 'w-shared', direction: 'forward' });
	} else if (row.identity === 'cross-group') {
		walls.push(syntheticWall('w-face', 'j-face'), syntheticWall('w-room', 'j-room'));
		faceBoundary.push({ wallId: 'w-face', direction: 'forward' });
		roomBoundary.push({ wallId: 'w-room', direction: 'forward' });
	} else if (row.identity === 'one-sided') {
		walls.push(syntheticWall('w-face', 'j-face'));
		faceBoundary.push({ wallId: 'w-face', direction: 'forward' });
	}
	const faces: DerivedCandidateFace[] = [
		{ key: faceKey, boundary: faceBoundary, polygon: row.facePolygon, signedArea: 0 }
	];
	const predecessorWitnesses = new Map<string, LayoutVec2>();
	if (row.witness !== undefined) predecessorWitnesses.set(roomId, row.witness);
	const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
	if (row.roomPolygon !== undefined) predecessorPolygons.set(roomId, row.roomPolygon);
	const baselineRooms: LayoutWallFirstRoom[] = [
		{
			id: roomId,
			name: roomId,
			boundary: roomBoundary,
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	const candidateDocument: Pick<LayoutDocumentWallFirst, 'walls' | 'junctions'> = {
		walls,
		junctions: []
	};
	const observations: CorrespondenceObservation[] = [];
	disableCorrespondenceShortCircuitsForTest(mode === 'exhaustive');
	setCorrespondenceObserverForTest((observation) => observations.push(observation));
	let components: ComponentLineage[] = [];
	try {
		components = buildCorrespondenceComponents({
			faces,
			predecessorRoomIds: [roomId],
			predecessorWitnesses,
			predecessorPolygons,
			candidateDocument,
			baselineRooms
		});
	} finally {
		clearCorrespondenceObserverForTest();
		disableCorrespondenceShortCircuitsForTest(false);
	}
	expect(observations.length).toBe(1);
	return { components, observation: observations[0]!, faceKey, roomId };
}

describe('P23B.11 S3 — OR-2: the adversarial bbox rows (no pair removed that the predicates admit)', () => {
	for (const row of ADVERSARIAL_ROWS) {
		it(`${row.id}: identical in both modes, with only proven-true-negative calls removed`, () => {
			const optimized = runSynthetic(row, 'short-circuit');
			const reference = runSynthetic(row, 'exhaustive');
			// INV-1/INV-3: the component output — and therefore the union decision —
			// is IDENTICAL. A lost union or a fabricated one fails right here.
			expect(componentKeyset(optimized.components)).toEqual(componentKeyset(reference.components));
			expect(unions(optimized.components, optimized.faceKey, optimized.roomId), row.note).toBe(
				row.expectUnion
			);
			expect(unions(reference.components, reference.faceKey, reference.roomId), row.note).toBe(
				row.expectUnion
			);
			const observation = optimized.observation;
			expect(observation.mode).toBe('short-circuit');
			expect(observation.pairs).toBe(1);
			expectAccounting(observation);
			expect(observation.boundsSkips).toBe(row.expectBoundsSkip ? 1 : 0);
			expect(observation.insideSkipsByBounds).toBe(row.expectInsideCallSkip ? 1 : 0);
			expect(observation.insideCalls).toBe(row.expectInsideCalls);
			expect(observation.overlapCalls).toBe(row.expectOverlapCalls);
			// The exhaustive side is today's order, and it is the ORACLE for every
			// removed call: a pruned pair must have been refused by BOTH predicates,
			// and a skipped containment CALL must have been containment-false.
			const exhaustiveObservation = reference.observation;
			expect(exhaustiveObservation.mode).toBe('exhaustive');
			expect(exhaustiveObservation.insideCalls).toBe(1);
			expect(exhaustiveObservation.overlapCalls).toBe(1);
			expect(
				exhaustiveObservation.authorizationSkips +
					exhaustiveObservation.absentEvidenceSkips +
					exhaustiveObservation.boundsSkips +
					exhaustiveObservation.insideSkipsByBounds
			).toBe(0);
			expect(
				exhaustiveObservation.insideDecisions + exhaustiveObservation.overlapDecisions
			).toBe(row.expectExhaustiveDecisions);
			if (row.expectBoundsSkip) {
				expect(exhaustiveObservation.insideDecisions + exhaustiveObservation.overlapDecisions).toBe(
					0
				);
			}
			if (row.expectInsideCallSkip) {
				expect(exhaustiveObservation.insideDecisions).toBe(0);
			}
			if (row.identity === 'cross-group' || row.identity === 'one-sided') {
				// The first check is doing the denial alone now: no geometry at all on
				// the shipped side, while the exhaustive side evaluated it and denied
				// after the fact (that is what D-12 always said).
				expect(observation.authorizationSkips).toBe(1);
				expect(observation.insideCalls + observation.overlapCalls).toBe(0);
				expect(observation.crossGroupPairs).toBe(row.identity === 'cross-group' ? 1 : 0);
				expect(observation.undefinedPairs).toBe(row.identity === 'one-sided' ? 1 : 0);
				expect(exhaustiveObservation.insideCalls + exhaustiveObservation.overlapCalls).toBe(2);
			} else if (row.identity === 'same-group') {
				expect(observation.sameGroupPairs).toBe(1);
				expect(observation.authorizationSkips).toBe(0);
			} else {
				expect(observation.undefinedPairs).toBe(1);
				expect(observation.authorizationSkips).toBe(0);
			}
		});
	}
});
