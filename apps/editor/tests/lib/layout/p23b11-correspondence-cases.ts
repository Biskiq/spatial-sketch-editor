/**
 * P23B.11 S2 — the OR-1 case table and the shared correspondence analysis.
 *
 * WHAT THIS MODULE IS. The plan's OR-1 differential compares "the optimized path"
 * against "today's whole-document behaviour", so the whole-document behaviour has
 * to be FROZEN FIRST (the plan's REFERENCE-FIRST rule) and both sides must run the
 * SAME cases. This module owns the cases and the single analysis function that
 * turns a case into a comparable record; `p23b11-correspondence-reference.ts` owns
 * the frozen values, and the tests are the two consumers.
 *
 * HOW A CASE IS ANALYSED, and why this is the planner's own pass. For a PLANNED
 * case the real planner runs first (the editor's own operation: `planWallSegment`
 * for a two-point sketch, `planWallChain` for a closed one, `planWallRoleChange` /
 * `planRemoveRoom` for the topology edits that make Rooms merge or retire). Its
 * accepted document supplies the candidate's Junctions and Walls, which are the
 * only inputs the reconciliation pass reads from the candidate besides the
 * baseline Rooms. The pass is then rebuilt EXACTLY as `planWallChain` performs it
 * (baseline room polygons from `roomBoundaryPolygon` + `interiorWitness`, faces
 * from `extractBoundaryCandidateFaces`, `buildCorrespondenceComponents`, then
 * `reconcileRooms`) and the rebuilt document must equal the planner's own
 * reconciled Rooms/objects/openings — the fidelity row the S2 test asserts before
 * it asserts anything else. That row is what makes the freeze a statement about
 * production behaviour rather than about a test-only construction.
 *
 * WHY SOME CASES ARE NOT 'planned'. The junction move runs the PRECISION path
 * (`finalizeWallGeometryCandidate`), whose lineage is declared as an identity set
 * (`canonicalBoundaryCycleKey` per Room) rather than derived by geometric
 * correspondence, so it has no `buildCorrespondenceComponents` pass at all: it is
 * an operation-verdict-only row, recorded as such. The whole-boundary-replacement
 * row is 'direct' because no shipped planner produces that candidate (the D-12
 * suite documents why); it hands the pass explicit inputs so the D-12 denial is
 * covered by the freeze even though no editor gesture reaches it.
 *
 * OR-1 CASE COVERAGE, and what each row is (measured 2026-09-27 on today's code):
 *
 *   (a) clear-gap independent segment — the ratified harness gesture on the two
 *       size-40 matrix fixtures and the owner payload: ten Rooms, ten faces, ONE
 *       HUNDRED pairs, no face created, no Room touched;
 *   (b) Rect Room creation — the ratified closed gesture on the same three
 *       fixtures: eleven faces, 110 pairs, one 0→1 birth;
 *   (c) a chain that DIVIDES a Room — host-declared two-point sketches that node
 *       into the Room's own Walls: 1→2 with a `split-survivor` plus a `created`;
 *   (d) a chain (or the topology edit a chain leaves behind) that MERGES, TRIMS or
 *       RETIRES Rooms. MEASURED AND RECORDED: the chain path itself only adds and
 *       nodes Walls, so it reaches births, 1→1 and 1→2 but never 2→1 or a
 *       retirement — a Room's whole boundary identity can only be lost by an
 *       operation that removes or re-roles a Wall. Those two decisions are
 *       therefore covered by the REAL planners that reach them:
 *       `planWallRoleChange` on the connected grid's SHARED wall produces a genuine
 *       2→1 merge (one component, two predecessors, `merge-survivor` + retirement),
 *       and a role change on an OUTER wall retires a Room whose enclosure is gone
 *       (the D-12 one-sided denial), exactly as `planRemoveRoom` does on the
 *       coincident pair;
 *   (e) a baseline with coincident/nested Rooms — the recorded D-12 fixtures with
 *       a chain landing across them, plus the refusal row the collinear landing
 *       still produces;
 *   (f) the D-12 hazard rows verbatim — role change on the operated Room's own
 *       Wall for all three recorded pre-states, the mirrored row, the reachable
 *       `planRemoveRoom` retirement and the coherent whole-boundary replacement;
 *   (g) no Rooms at all — the empty document and a faces-only document, both with
 *       zero pairs (the empty-extraction control);
 *   (h) the CONNECTED case — authoring INSIDE the grid's own cell (the ratified
 *       harness target), the host-declared division, the shared-wall merge and the
 *       outer-wall retirement, all on one Wall group where the group check skips
 *       nothing and neighbouring Rooms' boxes genuinely overlap.
 *
 * NO VALUE HERE IS A THRESHOLD, and nothing here writes anything.
 */
import { createHash } from 'node:crypto';
import {
	buildCorrespondenceComponents,
	correspondenceAuthorization,
	createAuthoringRoomAllocator,
	createEmptyWallFirstLayoutDocument,
	extractBoundaryCandidateFaces,
	interiorWitness,
	planExactJunctionMove,
	planRemoveRoom,
	planWallChain,
	planWallRoleChange,
	planWallSegment,
	reconcileRooms,
	roomBoundaryPolygon,
	wallCenterlineSamples,
	type ComponentLineage,
	type DerivedCandidateFace,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWallCenterline,
	type ReconciliationResult
} from '@portfolio/layout-core';
import {
	buildP23BCorrectnessFixture,
	buildP23BMatrixFixture,
	P23B_CORRECTNESS_SPECS,
	P23B_MATRIX_SPECS,
	P23B_OWNER_LAYOUT
} from '$lib/bench/p23b-fixtures';
import { buildP23B11ConnectedCase } from '$lib/bench/p23b11-connected-case';

/**
 * Every plan shape the case table drives. The four geometry/topology planners all
 * carry `lineage`/`retiredRoomIds` on success; the precision planner
 * (`planExactJunctionMove`) does not, which is exactly why its row is
 * operation-only and never analysed as a correspondence pass.
 */
export type P23B11Plan =
	| ReturnType<typeof planWallChain>
	| ReturnType<typeof planWallSegment>
	| ReturnType<typeof planWallRoleChange>
	| ReturnType<typeof planRemoveRoom>
	| ReturnType<typeof planExactJunctionMove>;

export type P23B11CaseKind = 'planned' | 'direct' | 'operation-only';

export type P23B11CorrespondenceCase = {
	id: string;
	/** The OR-1 row this case covers; a row may be shared by more than one case. */
	covers: string;
	kind: P23B11CaseKind;
	/** The pre-operation document; a fresh one per call, never shared mutable state. */
	baseline: () => LayoutDocumentWallFirst;
	/** The real planner operation, for 'planned'/'operation-only' rows. */
	plan?: (baseline: LayoutDocumentWallFirst) => P23B11Plan;
	/** The candidate document as the caller hands it to the pass, for 'direct' rows. */
	candidate?: (baseline: LayoutDocumentWallFirst) => LayoutDocumentWallFirst;
	/** Why a row looks unusual, when it does. */
	note?: string;
};

function fixtureDocument(id: string): LayoutDocumentWallFirst {
	const spec = P23B_MATRIX_SPECS.find((candidate) => candidate.id === id);
	if (!spec) throw new Error(`Unknown P23B matrix fixture '${id}'`);
	return buildP23BMatrixFixture(spec);
}

function correctnessDocument(id: string): LayoutDocumentWallFirst {
	const spec = P23B_CORRECTNESS_SPECS.find((candidate) => candidate.id === id);
	if (!spec) throw new Error(`Unknown P23B correctness fixture '${id}'`);
	return buildP23BCorrectnessFixture(spec);
}

const STRAIGHT_40 = 'p23b-40-wall-straight-v1';
const CURVED_40 = 'p23b-40-wall-all-curved-v1';
const STRAIGHT_12 = 'p23b-12-wall-straight-v1';
const CURVED_12 = 'p23b-12-wall-all-curved-v1';

/** Ratified harness targets: the same 4 m gesture the S1/S7 captures perform. */
const MATRIX_AUTHORING: readonly [LayoutVec2, LayoutVec2] = [
	[14, 5],
	[18, 5]
];
const OWNER_AUTHORING: readonly [LayoutVec2, LayoutVec2] = [
	[24, 24],
	[28, 24]
];
/** Ratified Rect Room gestures (4×2 m), matching the harness's creation class. */
const MATRIX_RECT: readonly LayoutVec2[] = [
	[14, 5],
	[18, 5],
	[18, 7],
	[14, 7]
];
const OWNER_RECT: readonly LayoutVec2[] = [
	[24, 24],
	[28, 24],
	[28, 26],
	[24, 26]
];
/** Ratified connected-case target: the 4 m sketch inside the grid's own cell (0,0). */
const CONNECTED_AUTHORING: readonly [LayoutVec2, LayoutVec2] = [
	[3, 5],
	[7, 5]
];

/** A point ON a Wall's sampled centerline — what a host-declared sketch endpoint lands on. */
function centerlineSamplePoint(
	document: LayoutDocumentWallFirst,
	wallId: string,
	fraction: number,
	direction: 'forward' | 'reverse' = 'forward'
): LayoutVec2 {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) throw new Error(`Unknown wall '${wallId}'`);
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const start = junctionById.get(wall.startJunctionId);
	const end = junctionById.get(wall.endJunctionId);
	if (!start || !end) throw new Error(`Unresolved wall '${wallId}'`);
	if (wall.centerline.kind === 'line') {
		const from = direction === 'forward' ? start.point : end.point;
		const to = direction === 'forward' ? end.point : start.point;
		return [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction];
	}
	const sampled = wallCenterlineSamples(wall, start.point, end.point, direction);
	if (!sampled) throw new Error(`Unsampled curve '${wallId}'`);
	const samples = sampled.samples;
	const index = Math.max(
		1,
		Math.min(samples.length - 2, Math.round(fraction * (samples.length - 1)))
	);
	return [...samples[index]!.point] as LayoutVec2;
}

/** The two-point host-declared sketch that divides a Room between two of its own Walls. */
function divisionSketch(
	baseline: LayoutDocumentWallFirst,
	leftWallId: string,
	rightWallId: string
): P23B11Plan {
	return planWallSegment({
		baseline,
		start: centerlineSamplePoint(baseline, leftWallId, 0.5),
		end: centerlineSamplePoint(baseline, rightWallId, 0.5),
		role: 'boundary',
		endpointHostSnaps: [
			{ pointIndex: 0, wallId: leftWallId },
			{ pointIndex: 1, wallId: rightWallId }
		]
	});
}

const LINE: LayoutWallCenterline = { kind: 'line' };

/** A faces-only document: one enclosure with NO Room records (OR-1(g)'s second control). */
function facesOnlyDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions.push(
		{ id: 'f-a', point: [0, 0] },
		{ id: 'f-b', point: [6, 0] },
		{ id: 'f-c', point: [6, 4] },
		{ id: 'f-d', point: [0, 4] }
	);
	const corners = ['f-a', 'f-b', 'f-c', 'f-d'];
	for (let edge = 0; edge < corners.length; edge += 1) {
		document.walls.push({
			id: `f-${edge + 1}`,
			startJunctionId: corners[edge]!,
			endJunctionId: corners[(edge + 1) % corners.length]!,
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: LINE
		});
	}
	return document;
}

/**
 * P23B.11 OR-1 — the case table.
 *
 * Row ids are stable: the frozen reference is keyed by them and both the S2 freeze
 * test and the S3 differential address cases by id, never by index.
 */
export const P23B11_CORRESPONDENCE_CASES: readonly P23B11CorrespondenceCase[] = [
	// --- (a) clear-gap independent segment -----------------------------------
	{
		id: 'a-straight-40-clear-gap',
		covers: 'OR-1(a)',
		kind: 'planned',
		baseline: () => fixtureDocument(STRAIGHT_40),
		plan: (baseline) =>
			planWallSegment({
				baseline,
				start: MATRIX_AUTHORING[0],
				end: MATRIX_AUTHORING[1],
				role: 'boundary'
			})
	},
	{
		id: 'a-all-curved-40-clear-gap',
		covers: 'OR-1(a)',
		kind: 'planned',
		baseline: () => fixtureDocument(CURVED_40),
		plan: (baseline) =>
			planWallSegment({
				baseline,
				start: MATRIX_AUTHORING[0],
				end: MATRIX_AUTHORING[1],
				role: 'boundary'
			})
	},
	{
		id: 'a-owner-40-clear-gap',
		covers: 'OR-1(a)',
		kind: 'planned',
		baseline: () => P23B_OWNER_LAYOUT,
		plan: (baseline) =>
			planWallSegment({
				baseline,
				start: OWNER_AUTHORING[0],
				end: OWNER_AUTHORING[1],
				role: 'boundary'
			})
	},

	// --- (b) Rect Room creation ---------------------------------------------
	{
		id: 'b-straight-40-rect-room',
		covers: 'OR-1(b)',
		kind: 'planned',
		baseline: () => fixtureDocument(STRAIGHT_40),
		plan: (baseline) =>
			planWallChain({ baseline, points: MATRIX_RECT, close: true, role: 'boundary' })
	},
	{
		id: 'b-all-curved-40-rect-room',
		covers: 'OR-1(b)',
		kind: 'planned',
		baseline: () => fixtureDocument(CURVED_40),
		plan: (baseline) =>
			planWallChain({ baseline, points: MATRIX_RECT, close: true, role: 'boundary' })
	},
	{
		id: 'b-owner-40-rect-room',
		covers: 'OR-1(b)',
		kind: 'planned',
		baseline: () => P23B_OWNER_LAYOUT,
		plan: (baseline) =>
			planWallChain({ baseline, points: OWNER_RECT, close: true, role: 'boundary' })
	},

	// --- (c) a chain that divides a Room ------------------------------------
	{
		id: 'c-straight-12-room-division',
		covers: 'OR-1(c)',
		kind: 'planned',
		baseline: () => fixtureDocument(STRAIGHT_12),
		plan: (baseline) => divisionSketch(baseline, 'room-0:wall-3', 'room-0:wall-1')
	},
	{
		id: 'c-all-curved-12-room-division',
		covers: 'OR-1(c)',
		kind: 'planned',
		baseline: () => fixtureDocument(CURVED_12),
		plan: (baseline) => divisionSketch(baseline, 'room-0:wall-3', 'room-0:wall-1')
	},

	// --- (d) merge / trim / retire, through the planners that reach them -----
	{
		id: 'd-connected-shared-wall-merge',
		covers: 'OR-1(d) + OR-1(h)',
		kind: 'planned',
		baseline: () => buildP23B11ConnectedCase(),
		plan: (baseline) => planWallRoleChange(baseline, 'grid:v-1-0', 'partition'),
		note: 'The recorded 2→1 MERGE: re-roling the shared wall leaves one candidate face claimed by BOTH cells, so the component is 2→1 with a merge survivor and a retirement. No chain gesture produces this (measured), and it is the strongest same-group row on the connected case.'
	},
	{
		id: 'd-connected-outer-wall-retire',
		covers: 'OR-1(d) + OR-1(h)',
		kind: 'planned',
		baseline: () => buildP23B11ConnectedCase(),
		plan: (baseline) => planWallRoleChange(baseline, 'grid:h-0-0', 'partition'),
		note: 'Retirement: the cell loses its whole enclosure, so its predecessor never reaches a face and retires — the D-12 one-sided denial on a connected plan.'
	},
	{
		id: 'd-straight-12-outer-wall-retire',
		covers: 'OR-1(d)',
		kind: 'planned',
		baseline: () => fixtureDocument(STRAIGHT_12),
		plan: (baseline) => planWallRoleChange(baseline, 'room-0:wall-0', 'partition')
	},
	{
		id: 'd-d12-remove-room-retire',
		covers: 'OR-1(d)',
		kind: 'planned',
		baseline: () => correctnessDocument('d12-exact-coincidence-v1'),
		plan: (baseline) => planRemoveRoom(baseline, 'room-c'),
		note: "The reachable one-sided denial: the operated Room's whole ring goes while the unrelated Room's face is still authored."
	},

	// --- (e) coincident / nested Rooms in the baseline -----------------------
	{
		id: 'e-exact-coincidence-chain-across',
		covers: 'OR-1(e)',
		kind: 'planned',
		baseline: () => correctnessDocument('d12-exact-coincidence-v1'),
		plan: (baseline) =>
			planWallSegment({ baseline, start: [-4, 2], end: [10, 2], role: 'boundary' }),
		note: 'Two Rooms occupying identical coordinates under a chain that crosses both: both faces stay separate components of their own groups, neither Room is touched.'
	},
	{
		id: 'e-full-containment-chain-across',
		covers: 'OR-1(e)',
		kind: 'planned',
		baseline: () => correctnessDocument('d12-full-containment-v1'),
		plan: (baseline) =>
			planWallSegment({ baseline, start: [-4, 2], end: [10, 2], role: 'boundary' }),
		note: 'A nested Room pair under the same chain: containment alone authorizes nothing.'
	},
	{
		id: 'e-exact-coincidence-collinear-chain',
		covers: 'OR-1(e)',
		kind: 'planned',
		baseline: () => correctnessDocument('d12-exact-coincidence-v1'),
		plan: (baseline) =>
			planWallSegment({
				baseline,
				start: [0, 0],
				end: [6, 0],
				role: 'boundary',
				endpointJunctionSnaps: [
					{ pointIndex: 0, junctionId: 'k-a' },
					{ pointIndex: 1, junctionId: 'k-b' }
				]
			}),
		note: 'The REFUSAL row: landing a chain exactly along an authored wall is still refused with the same code, so the freeze pins a refusal as well as acceptances.'
	},

	// --- (f) the D-12 hazard rows -------------------------------------------
	{
		id: 'f-d12-exact-coincidence-role-change',
		covers: 'OR-1(f)',
		kind: 'planned',
		baseline: () => correctnessDocument('d12-exact-coincidence-v1'),
		plan: (baseline) => planWallRoleChange(baseline, 'c-a1', 'partition')
	},
	{
		id: 'f-d12-partial-overlap-role-change',
		covers: 'OR-1(f)',
		kind: 'planned',
		baseline: () => correctnessDocument('d12-partial-overlap-v1'),
		plan: (baseline) => planWallRoleChange(baseline, 'c-a1', 'partition')
	},
	{
		id: 'f-d12-full-containment-role-change',
		covers: 'OR-1(f)',
		kind: 'planned',
		baseline: () => correctnessDocument('d12-full-containment-v1'),
		plan: (baseline) => planWallRoleChange(baseline, 'c-a1', 'partition')
	},
	{
		id: 'f-d12-full-containment-mirror-role-change',
		covers: 'OR-1(f)',
		kind: 'planned',
		baseline: () => correctnessDocument('d12-full-containment-v1'),
		plan: (baseline) => planWallRoleChange(baseline, 'k-a1', 'partition'),
		note: "The mirrored row: the UNRELATED Room's own wall changes, so the operated Room is the one that retires."
	},
	{
		id: 'f-d12-whole-boundary-replacement',
		covers: 'OR-1(f)',
		kind: 'direct',
		baseline: () => correctnessDocument('d12-exact-coincidence-v1'),
		candidate: (baseline) => ({
			...baseline,
			walls: baseline.walls.map((wall) =>
				wall.id.startsWith('c-') ? { ...wall, id: `${wall.id}-replaced` } : wall
			)
		}),
		note: 'The coherent whole-boundary replacement (the D-12 fallback proof): every operated Wall carries a new authored id, so that predecessor resolves to nothing while the unrelated Room and the extracted faces still resolve. Faces are extracted from THIS candidate. No shipped planner produces it; it is frozen so the denial branch is covered.'
	},

	// --- (g) no Rooms at all -------------------------------------------------
	{
		id: 'g-empty-closed-chain',
		covers: 'OR-1(g)',
		kind: 'planned',
		baseline: () => createEmptyWallFirstLayoutDocument(),
		plan: (baseline) =>
			planWallChain({
				baseline,
				points: [
					[0, 0],
					[4, 0],
					[4, 2],
					[0, 2]
				],
				close: true,
				role: 'boundary'
			}),
		note: 'The empty-extraction control: a closed chain on an empty document, zero pairs, one birth.'
	},
	{
		id: 'g-faces-only-clear-gap',
		covers: 'OR-1(g)',
		kind: 'planned',
		baseline: () => facesOnlyDocument(),
		plan: (baseline) =>
			planWallSegment({ baseline, start: [10, 0], end: [14, 0], role: 'boundary' }),
		note: 'Faces but no Rooms: the pass runs with an empty predecessor set, so zero pairs and a birth of the pre-existing face.'
	},

	// --- (h) the CONNECTED case ---------------------------------------------
	{
		id: 'h-connected-authoring-inside',
		covers: 'OR-1(h)',
		kind: 'planned',
		baseline: () => buildP23B11ConnectedCase(),
		plan: (baseline) =>
			planWallSegment({
				baseline,
				start: CONNECTED_AUTHORING[0],
				end: CONNECTED_AUTHORING[1],
				role: 'boundary'
			}),
		note: 'The ratified capture gesture, landing INSIDE the grid cell (0,0): four faces against four same-group Rooms, sixteen pairs, no reconciliation effect.'
	},
	{
		id: 'h-connected-room-division',
		covers: 'OR-1(c) + OR-1(h)',
		kind: 'planned',
		baseline: () => buildP23B11ConnectedCase(),
		plan: (baseline) => divisionSketch(baseline, 'grid:v-0-0', 'grid:v-1-0'),
		note: 'Host-declared division inside one grid cell: a new face appears inside the single Wall group, so the split is 1→2 and every pair is same-group.'
	},
	{
		id: 'h-connected-shared-run-junction-move',
		covers: 'OR-1(h)',
		kind: 'operation-only',
		baseline: () => buildP23B11ConnectedCase(),
		plan: (baseline) => planExactJunctionMove(baseline, 'grid:j-1-0', [12.5, 0.5]),
		note: 'The move along the shared run. This planner is the PRECISION path: it declares one identity component per Room from `canonicalBoundaryCycleKey` and never runs the geometric correspondence, so the row freezes its ACCEPTANCE and its document only — recorded rather than silently given a pass that production does not execute.'
	}
];

/** One face × predecessor-Room pair, classified by the D-12 authority. */
export type P23B11PairClass = 'same-group' | 'cross-group' | 'undefined';

export type P23B11PairCounts = {
	faces: number;
	predecessors: number;
	pairs: number;
	sameGroupPairs: number;
	crossGroupPairs: number;
	undefinedPairs: number;
	/**
	 * Predicate evaluations TODAY's loop performs: both predicates run for EVERY
	 * pair, before any authorization test, and nothing skips a pair. These two
	 * fields freeze that baseline for OR-6; the optimized loop must report
	 * cross-group geometry evaluations of zero and same-group evaluations bounded
	 * by these numbers.
	 */
	insideEvaluations: number;
	overlapEvaluations: number;
};

export type P23B11PassOutcome =
	| { kind: 'rejected'; code: string }
	| {
			kind: 'ok';
			lineage: Array<{ faceKey: string; roomId: string; kind: string }>;
			retiredRoomIds: string[];
			rooms: Array<{ id: string; name: string }>;
			/** The reconciled candidate's Rooms, objects and openings as canonical JSON. */
			documentJson: string;
	  };

export type P23B11PassAnalysis = {
	caseId: string;
	covers: string;
	/** The planner verdict the case's own operation produced. */
	operation:
		| { verdict: 'success'; documentJson: string }
		| { verdict: 'rejected'; code: string }
		| { verdict: 'not-run'; reason: string };
	/**
	 * TRUE when the rebuilt pass reproduced the planner's own reconciled
	 * Rooms/objects/openings; null for rows without a planner pass.
	 */
	fidelity: boolean | null;
	counts: P23B11PairCounts;
	components: ComponentLineage[];
	faces: Array<{ key: string; polygon: readonly LayoutVec2[] }>;
	pairs: Array<{ faceKey: string; roomId: string; class: P23B11PairClass }>;
	reconciliation: P23B11PassOutcome | { kind: 'not-run'; reason: string };
};

/** Canonical JSON of the fields the pass owns (never the whole document envelope). */
export function reconciliationJson(document: LayoutDocumentWallFirst): string {
	return JSON.stringify({
		rooms: document.rooms,
		objects: document.objects,
		openings: document.openings
	});
}

export function planOutcome(plan: P23B11Plan):
	| { verdict: 'success'; documentJson: string }
	| { verdict: 'rejected'; code: string } {
	if (plan.kind !== 'success') return { verdict: 'rejected', code: plan.rejection.code };
	return { verdict: 'success', documentJson: reconciliationJson(plan.document) };
}

/** Classify every face × predecessor-Room pair using the shipped D-12 authority. */
export function classifyPairs(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: Pick<LayoutDocumentWallFirst, 'walls' | 'junctions'>;
	faces: readonly DerivedCandidateFace[];
}): Array<{ faceKey: string; roomId: string; class: P23B11PairClass }> {
	const authorization = correspondenceAuthorization({
		baselineRooms: options.baseline.rooms,
		candidateDocument: options.candidate,
		faces: options.faces
	});
	const pairs: Array<{ faceKey: string; roomId: string; class: P23B11PairClass }> = [];
	for (const face of options.faces) {
		const faceKey = authorization.faceComponentKeyByKey.get(face.key);
		for (const room of options.baseline.rooms) {
			const roomKey = authorization.predecessorComponentKeyByRoomId.get(room.id);
			const pairClass: P23B11PairClass =
				faceKey === undefined || roomKey === undefined
					? 'undefined'
					: faceKey === roomKey
						? 'same-group'
						: 'cross-group';
			pairs.push({ faceKey: face.key, roomId: room.id, class: pairClass });
		}
	}
	return pairs;
}

/**
 * THE SHARED ANALYSIS — the one function both the S2 freeze and the S3
 * differential call. It performs the pass exactly as `planWallChain` does, and
 * reports the planner verdict and (where a planner ran) the fidelity of the
 * rebuild against that planner's own reconciled document.
 */
export function analyzeCorrespondenceCase(entry: P23B11CorrespondenceCase): P23B11PassAnalysis {
	const baseline = entry.baseline();
	let operation: P23B11PassAnalysis['operation'] = {
		verdict: 'not-run',
		reason: entry.kind === 'direct' ? 'direct pass row: no planner operation' : 'no planner wired'
	};
	let plannedDocument: LayoutDocumentWallFirst | null = null;
	if (entry.kind !== 'direct') {
		if (!entry.plan) throw new Error(`${entry.id}: a planned row needs a plan()`);
		const plan = entry.plan(baseline);
		operation = planOutcome(plan);
		if (plan.kind === 'success') plannedDocument = plan.document;
		if (operation.verdict === 'rejected') {
			// A refused operation never reaches the pass: the refusal ITSELF is the
			// frozen behaviour for this row.
			return {
				caseId: entry.id,
				covers: entry.covers,
				operation,
				fidelity: null,
				counts: zeroCounts(),
				components: [],
				faces: [],
				pairs: [],
				reconciliation: { kind: 'not-run', reason: 'operation refused before the pass' }
			};
		}
	}
	if (entry.kind === 'operation-only') {
		// This row's planner is not the geometric correspondence — the precision
		// path declares its own identity lineage — so there is no pass to rebuild:
		// the row freezes the ACCEPTANCE and the document only, and says why.
		return {
			caseId: entry.id,
			covers: entry.covers,
			operation,
			fidelity: null,
			counts: zeroCounts(),
			components: [],
			faces: [],
			pairs: [],
			reconciliation: {
				kind: 'not-run',
				reason: 'operation-only row: this planner declares identity lineage and runs no geometric correspondence'
			}
		};
	}
	const candidate: LayoutDocumentWallFirst =
		entry.kind === 'direct'
			? entry.candidate!(baseline)
			: { ...baseline, junctions: plannedDocument!.junctions, walls: plannedDocument!.walls };
	const extraction = extractBoundaryCandidateFaces(candidate);
	const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
	const predecessorWitnesses = new Map<string, LayoutVec2>();
	for (const room of baseline.rooms) {
		const polygon = roomBoundaryPolygon(baseline, room.id);
		if (!polygon) throw new Error(`${entry.id}: predecessor '${room.id}' has no resolvable boundary`);
		predecessorPolygons.set(room.id, polygon);
		predecessorWitnesses.set(room.id, interiorWitness(polygon));
	}
	const components = buildCorrespondenceComponents({
		faces: extraction.faces,
		predecessorRoomIds: baseline.rooms.map((room) => room.id),
		predecessorWitnesses,
		predecessorPolygons,
		candidateDocument: candidate,
		baselineRooms: baseline.rooms
	});
	const pairs = classifyPairs({ baseline, candidate, faces: extraction.faces });
	const result: ReconciliationResult = reconcileRooms({
		baseline,
		candidateDocument: candidate,
		extraction,
		components,
		predecessorWitnesses,
		predecessorPolygons,
		allocator: createAuthoringRoomAllocator()
	});
	const reconciliation: P23B11PassOutcome =
		'kind' in result
			? { kind: 'rejected', code: result.rejection.code }
			: {
					kind: 'ok',
					lineage: result.lineage.map((record) => ({
						faceKey: record.faceKey,
						roomId: record.roomId,
						kind: record.kind
					})),
					retiredRoomIds: [...result.retiredRoomIds],
					rooms: result.document.rooms.map((room) => ({ id: room.id, name: room.name })),
					documentJson: reconciliationJson(result.document)
				};
	const fidelity =
		plannedDocument && reconciliation.kind === 'ok'
			? reconciliation.documentJson === reconciliationJson(plannedDocument)
			: plannedDocument
				? false
				: null;
	return {
		caseId: entry.id,
		covers: entry.covers,
		operation,
		fidelity,
		counts: {
			faces: extraction.faces.length,
			predecessors: baseline.rooms.length,
			pairs: pairs.length,
			sameGroupPairs: pairs.filter((pair) => pair.class === 'same-group').length,
			crossGroupPairs: pairs.filter((pair) => pair.class === 'cross-group').length,
			undefinedPairs: pairs.filter((pair) => pair.class === 'undefined').length,
			// Today's loop runs both predicates for every pair; see the type's doc.
			insideEvaluations: pairs.length,
			overlapEvaluations: pairs.length
		},
		components: components.map((component) => ({
			candidateFaceKeys: [...component.candidateFaceKeys],
			predecessorRoomIds: [...component.predecessorRoomIds]
		})),
		faces: extraction.faces.map((face) => ({ key: face.key, polygon: face.polygon })),
		pairs,
		reconciliation
	};
}

function zeroCounts(): P23B11PairCounts {
	return {
		faces: 0,
		predecessors: 0,
		pairs: 0,
		sameGroupPairs: 0,
		crossGroupPairs: 0,
		undefinedPairs: 0,
		insideEvaluations: 0,
		overlapEvaluations: 0
	};
}

/** SHA-256 over the exact JSON encoding, the repository's digest convention. */
export function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

/**
 * THE FROZEN ROW SHAPE — what both the freeze and the differential compare.
 * The full reconciled JSON is carried as a digest (it is thousands of characters
 * on the size-40 cases) while the SMALL, DIAGNOSTIC parts are kept verbatim:
 * lineage, retired ids, Room identities, component membership and face keys. A
 * mismatch therefore names the Room, the component or the face before it names a
 * hash.
 */
export type P23B11FrozenCase = {
	id: string;
	covers: string;
	operation:
		| { verdict: 'success'; documentSha256: string }
		| { verdict: 'rejected'; code: string }
		| { verdict: 'not-run'; reason: string };
	/** Whether the rebuilt pass reproduced the planner's own reconciled document. */
	fidelity: boolean | null;
	counts: P23B11PairCounts;
	components: Array<{ candidateFaceKeys: string[]; predecessorRoomIds: string[] }>;
	faceKeys: string[];
	reconciliation:
		| { kind: 'rejected'; code: string }
		| { kind: 'not-run'; reason: string }
		| {
				kind: 'ok';
				lineage: Array<{ faceKey: string; roomId: string; kind: string }>;
				retiredRoomIds: string[];
				rooms: Array<{ id: string; name: string }>;
				documentSha256: string;
		  };
};

/**
 * Reduce one case analysis to the frozen row shape. The ONE quantization every
 * consumer uses, so a freeze row and a differential row can never be compared on
 * two different projections.
 */
export function freezeAnalysis(analysis: P23B11PassAnalysis): P23B11FrozenCase {
	return {
		id: analysis.caseId,
		covers: analysis.covers,
		operation:
			analysis.operation.verdict === 'success'
				? {
						verdict: 'success',
						documentSha256: sha256(analysis.operation.documentJson)
					}
				: analysis.operation,
		fidelity: analysis.fidelity,
		counts: analysis.counts,
		components: analysis.components.map((component) => ({
			candidateFaceKeys: [...component.candidateFaceKeys],
			predecessorRoomIds: [...component.predecessorRoomIds]
		})),
		faceKeys: analysis.faces.map((face) => face.key),
		reconciliation:
			analysis.reconciliation.kind === 'ok'
				? {
						kind: 'ok',
						lineage: analysis.reconciliation.lineage.map((record) => ({ ...record })),
						retiredRoomIds: [...analysis.reconciliation.retiredRoomIds],
						rooms: analysis.reconciliation.rooms.map((room) => ({ ...room })),
						documentSha256: sha256(analysis.reconciliation.documentJson)
					}
				: analysis.reconciliation
	};
}

/** Every case in table order, analysed and reduced — the freeze's subject. */
export function frozenCaseRows(
	cases: readonly P23B11CorrespondenceCase[] = P23B11_CORRESPONDENCE_CASES
): P23B11FrozenCase[] {
	return cases.map((entry) => freezeAnalysis(analyzeCorrespondenceCase(entry)));
}
