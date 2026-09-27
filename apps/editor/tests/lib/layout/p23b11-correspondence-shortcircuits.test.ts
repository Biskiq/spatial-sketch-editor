/**
 * P23B.11 S3 — the M-1 pair short-circuits, proved against the S2 freeze.
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
 * must be untouched. This file is the proof, and it reads the plan's three
 * obligations together:
 *
 *   OR-1  the frozen rows (`p23b11-correspondence-reference.ts`) re-derived on
 *         the SHIPPED path — including the CONNECTED rows (h), mandatory here;
 *   OR-2  filter neutrality: the SAME rows re-derived with the test-only bypass
 *         that restores today's evaluation order (geometry before authorization,
 *         both predicates for every pair), plus an adversarial bbox set that must
 *         show no pair removed that the exact predicates admit;
 *   OR-6  the count oracle: cross-group geometry evaluations ZERO for EVERY case
 *         and operation, same-group counts bounded by the frozen reference, and
 *         the exact accounting that says WHERE each avoided call went.
 *
 * WHY THE GLOBAL FLAG IS SAFE HERE. `disableCorrespondenceShortCircuitsForTest`
 * and the observer are the P23B.4 pattern: opt-in, test-only, never persisted,
 * and unset changes nothing at all. Vitest isolates test files, so the module
 * state below is this file's own; `afterEach` clears it anyway.
 *
 * WHAT "EQUAL" MEANS, and why the frozen counts still match. The freeze carries
 * `insideEvaluations`/`overlapEvaluations` = pairs — the number TODAY's loop
 * performed — and those fields are a property of the case (both predicates ran
 * for every pair), not a live measurement. The optimized path is therefore
 * compared on the whole frozen row (components, ordering, lineage, retired ids,
 * Rooms, document digest) with those baseline fields UNCHANGED, and the counts
 * that actually moved are asserted separately from the observer. That is why the
 * S2 test stays green after S3: it is one half of this differential.
 *
 * THE ADVERSARIAL ROWS drive `buildCorrespondenceComponents` directly with
 * synthetic geometry — the same call the planner makes — so each boundary case is
 * isolated: a touching edge, an edge touch at a vertex, a collinear zero-area
 * ring, coincident identical rings, an overlap decided by the polygon predicate
 * while the witness sits ON the face ring, an overlap that survives a
 * bounds-skipped containment call, a gap WITHIN the predicates' own slack, a gap
 * BEYOND it, a far gap, an empty polygon, absent evidence, a NaN polygon, a NaN
 * witness, and the D-12 identity rows (same-group, cross-group, one-sided) whose
 * geometry ADMITS a union that identity must still deny. The both-undefined rows
 * deliberately exercise the DEFENSIVE "neither side resolves" branch, so the
 * class can never mask a geometry skip; the identity rows then exercise the
 * branches where a label decides. Every row asserts the shipped and exhaustive
 * modes produce the same component output, and that a skipped call or pruned pair
 * was a TRUE NEGATIVE in the exhaustive run — the exact statement of INV-4.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

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

import {
	analyzeCorrespondenceCase,
	freezeAnalysis,
	P23B11_CORRESPONDENCE_CASES,
	type P23B11FrozenCase
} from './p23b11-correspondence-cases';
import { P23B11_OR1_REFERENCE } from './p23b11-correspondence-reference';

const frozenById = new Map(P23B11_OR1_REFERENCE.map((row) => [row.id, row]));

/** One whole-table run in one mode, with the observer's per-case reports. */
type TableRun = {
	mode: CorrespondenceObservation['mode'];
	rows: P23B11FrozenCase[];
	/** The pass observations per case, in table order (planner pass + rebuilt pass). */
	observations: CorrespondenceObservation[][];
	rowsByCase: Map<string, P23B11FrozenCase>;
};

function runTable(mode: CorrespondenceObservation['mode']): TableRun {
	const rows: P23B11FrozenCase[] = [];
	const observations: CorrespondenceObservation[][] = [];
	disableCorrespondenceShortCircuitsForTest(mode === 'exhaustive');
	try {
		for (const entry of P23B11_CORRESPONDENCE_CASES) {
			const collected: CorrespondenceObservation[] = [];
			setCorrespondenceObserverForTest((observation) => collected.push(observation));
			try {
				rows.push(freezeAnalysis(analyzeCorrespondenceCase(entry)));
			} finally {
				clearCorrespondenceObserverForTest();
			}
			observations.push(collected);
		}
	} finally {
		disableCorrespondenceShortCircuitsForTest(false);
	}
	return {
		mode,
		rows,
		observations,
		rowsByCase: new Map(rows.map((row) => [row.id, row]))
	};
}

let shipped: TableRun;
let exhaustive: TableRun;

beforeAll(() => {
	shipped = runTable('short-circuit');
	exhaustive = runTable('exhaustive');
}, 300000);

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
		observation.authorizationSkips +
			observation.absentEvidenceSkips +
			observation.boundsSkips +
			observation.insideSkipsByBounds +
			observation.insideCalls
	).toBe(observation.pairs);
	if (observation.mode === 'short-circuit') {
		expect(observation.insideCalls + observation.insideSkipsByBounds).toBe(
			observation.insideDecisions + observation.overlapCalls
		);
		expect(observation.insideDecisions).toBeLessThanOrEqual(observation.insideCalls);
		expect(2 * observation.pairs - (observation.insideCalls + observation.overlapCalls)).toBe(
			2 *
				(observation.authorizationSkips +
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

/** Rows that actually ran a correspondence pass, with the frozen subject counts. */
function passRows(run: TableRun): Array<{ row: P23B11FrozenCase; observations: CorrespondenceObservation[] }> {
	return run.rows
		.map((row, index) => ({ row, observations: run.observations[index]! }))
		.filter((entry) => entry.row.counts.pairs > 0);
}

describe('P23B.11 S3 — OR-1: the shipped short-circuits reproduce the frozen reference', () => {
	it('every case, including the CONNECTED rows (h), re-derives its frozen row on today’s SHIPPED path', () => {
		expect(shipped.rows.map((row) => row.id)).toEqual(P23B11_OR1_REFERENCE.map((row) => row.id));
		for (const row of shipped.rows) {
			expect(row, row.id).toEqual(frozenById.get(row.id));
		}
		// OR-1(h) is MANDATORY at S3, and the exclusion is deliberate: the four
		// CONNECTED rows with a pass (authoring inside, division, shared-wall merge,
		// outer-wall retire) are compared above like every other row.
		const connected = passRows(shipped).filter((entry) => entry.row.covers.includes('OR-1(h)'));
		expect(connected.map((entry) => entry.row.id).sort()).toEqual([
			'd-connected-outer-wall-retire',
			'd-connected-shared-wall-merge',
			'h-connected-authoring-inside',
			'h-connected-room-division'
		]);
	});

	it('no row differs anywhere: not a component, not a lineage record, not a document digest', () => {
		// Named projections, so a drift names the field instead of the blob: the
		// component sets, the lineage, the retirements and the diffed counts.
		for (const row of shipped.rows) {
			const frozen = frozenById.get(row.id)!;
			expect(componentKeyset(row.components), row.id).toEqual(componentKeyset(frozen.components));
			expect(row.faceKeys, row.id).toEqual(frozen.faceKeys);
			expect(row.fidelity, row.id).toBe(frozen.fidelity);
			expect(row.operation, row.id).toEqual(frozen.operation);
			expect(row.reconciliation.kind, row.id).toBe(frozen.reconciliation.kind);
			if (row.reconciliation.kind === 'ok' && frozen.reconciliation.kind === 'ok') {
				expect(row.reconciliation.lineage, row.id).toEqual(frozen.reconciliation.lineage);
				expect(row.reconciliation.retiredRoomIds, row.id).toEqual(
					frozen.reconciliation.retiredRoomIds
				);
				expect(row.reconciliation.rooms, row.id).toEqual(frozen.reconciliation.rooms);
				expect(row.reconciliation.documentSha256, row.id).toBe(
					frozen.reconciliation.documentSha256
				);
			}
		}
	});
});

describe('P23B.11 S3 — OR-2: filter neutrality, with today’s order restored', () => {
	it('the exhaustive bypass reproduces the frozen reference on every OR-1 case', () => {
		// This is the freeze's own validity check FROM THE OTHER SIDE: the reference
		// was made from today's code, and the bypass is today's loop verbatim.
		expect(exhaustive.rows).toEqual(P23B11_OR1_REFERENCE);
	});

	it('the two modes agree case-for-case and pair-for-pair', () => {
		expect(shipped.rows.map((row) => row.id)).toEqual(exhaustive.rows.map((row) => row.id));
		for (const index of shipped.rows.keys()) {
			const optimized = shipped.rows[index]!;
			const reference = exhaustive.rows[index]!;
			expect(optimized, optimized.id).toEqual(reference);
			expect(componentKeyset(optimized.components), optimized.id).toEqual(
				componentKeyset(reference.components)
			);
		}
	});

	it('the exhaustive mode is today’s evaluation order: both predicates, every pair, no skip', () => {
		for (const { row, observations } of passRows(exhaustive)) {
			expect(observations.length, row.id).toBeGreaterThanOrEqual(1);
			for (const observation of observations) {
				expect(observation.mode, row.id).toBe('exhaustive');
				expect(observation.pairs, row.id).toBe(row.counts.pairs);
				expect(observation.insideCalls, row.id).toBe(row.counts.pairs);
				expect(observation.overlapCalls, row.id).toBe(row.counts.pairs);
				expect(
					observation.authorizationSkips +
						observation.absentEvidenceSkips +
						observation.boundsSkips +
						observation.insideSkipsByBounds,
					row.id
				).toBe(0);
				expectAccounting(observation);
			}
		}
	});

	it('a refused or operation-only row runs no pass; an empty document runs a zero-subject one', () => {
		// Deterministic (iii): a refused row does not silently run a partial pass,
		// and an operation-only row has no geometric correspondence at all. The
		// empty-extraction controls (g) DO run the pass — with zero subjects, every
		// counter zero — which is exactly how today behaves.
		for (const index of P23B11_CORRESPONDENCE_CASES.keys()) {
			const entry = P23B11_CORRESPONDENCE_CASES[index]!;
			const row = shipped.rows[index]!;
			const observations = shipped.observations[index]!;
			if (row.operation.verdict === 'rejected' || entry.kind === 'operation-only') {
				expect(observations, row.id).toEqual([]);
				expect(exhaustive.observations[index]!, row.id).toEqual([]);
				expect(row.counts.pairs, row.id).toBe(0);
				continue;
			}
			for (const observation of observations) {
				expect(observation.pairs, row.id).toBe(row.counts.pairs);
				if (row.counts.pairs > 0) continue;
				expect(observation.insideCalls + observation.overlapCalls, row.id).toBe(0);
				expect(
					observation.authorizationSkips +
						observation.absentEvidenceSkips +
						observation.boundsSkips +
						observation.insideSkipsByBounds,
					row.id
				).toBe(0);
			}
		}
	});
});

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
		role: 'boundary',
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

describe('P23B.11 S3 — OR-6: the count oracle', () => {
	it('cross-group geometry evaluations are ZERO for every case and operation', () => {
		// Unconditional: the group check runs FIRST for every pair, so this is a
		// claim about every shipped operation, not only the clear-gap case.
		for (const index of P23B11_CORRESPONDENCE_CASES.keys()) {
			const row = shipped.rows[index]!;
			for (const observation of shipped.observations[index]!) {
				expect(observation.mode, row.id).toBe('short-circuit');
				expect(observation.insideCallsCrossGroup, row.id).toBe(0);
				expect(observation.overlapCallsCrossGroup, row.id).toBe(0);
				expect(observation.crossGroupPairs, row.id).toBe(row.counts.crossGroupPairs);
				if (row.counts.pairs > 0) {
					expect(
						observation.authorizationSkips,
						`${row.id}: every cross-group pair is denied by identity`
					).toBeGreaterThanOrEqual(row.counts.crossGroupPairs);
				}
			}
		}
	});

	it('the subject counts the observer sees are the frozen row’s own counts', () => {
		for (const { row, observations } of passRows(shipped)) {
			expect(observations.length, row.id).toBeGreaterThanOrEqual(1);
			const last = observations[observations.length - 1]!;
			expect(last.mode, row.id).toBe('short-circuit');
			expect(last.pairs, row.id).toBe(row.counts.pairs);
			expect(last.sameGroupPairs, row.id).toBe(row.counts.sameGroupPairs);
			expect(last.crossGroupPairs, row.id).toBe(row.counts.crossGroupPairs);
			expect(last.undefinedPairs, row.id).toBe(row.counts.undefinedPairs);
		}
	});

	it('same-group geometry stays bounded by the frozen reference on every case, CONNECTED included', () => {
		for (const { row, observations } of passRows(shipped)) {
			for (const observation of observations) {
				// Today's loop paid two evaluations per same-group pair; the optimized
				// path can pay at most that, and never more than the frozen baseline in
				// total.
				expect(
					observation.insideCallsSameGroup + observation.overlapCallsSameGroup,
					row.id
				).toBeLessThanOrEqual(2 * observation.sameGroupPairs);
				expect(
					observation.insideCalls + observation.overlapCalls,
					row.id
				).toBeLessThanOrEqual(row.counts.insideEvaluations + row.counts.overlapEvaluations);
				expectAccounting(observation);
			}
		}
	});

	it('the island rows shed their cross-group evaluations (the main lever, measured)', () => {
		// On the size-40 island fixtures ≥90% of pairs cross groups (the freeze's own
		// property row), so the shipped path must be STRICTLY cheaper than today:
		// each cross-group pair contributes zero calls instead of two.
		const islands = passRows(shipped).filter(
			(entry) =>
				entry.row.counts.pairs > 0 &&
				entry.row.counts.crossGroupPairs / entry.row.counts.pairs >= 0.9
		);
		expect(islands.length).toBeGreaterThanOrEqual(3);
		for (const { row, observations } of islands) {
			for (const observation of observations) {
				expect(
					observation.insideCalls + observation.overlapCalls,
					`${row.id}: cross-group pairs must cost nothing`
				).toBeLessThan(2 * observation.pairs);
			}
		}
	});

	it('the CONNECTED rows save exactly where M-1(b)/(c) proves a skip — never by identity', () => {
		// The S4 gate reads this row family: on one Wall group the group check has
		// nothing to skip, so whatever the optimized path saves there comes from the
		// box prune and the containment skip — both proven neutral above.
		const connected = passRows(shipped).filter((entry) => entry.row.covers.includes('OR-1(h)'));
		expect(connected).toHaveLength(4);
		for (const { row, observations } of connected) {
			expect(row.counts.crossGroupPairs, row.id).toBe(0);
			expect(row.counts.undefinedPairs, row.id).toBe(0);
			for (const observation of observations) {
				expect(observation.crossGroupPairs, row.id).toBe(0);
				expect(observation.authorizationSkips, row.id).toBe(0);
				expect(observation.absentEvidenceSkips, row.id).toBe(0);
				expectAccounting(observation);
			}
		}
	});
});
