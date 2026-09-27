/**
 * P23B.11 S1/S7 advisory node probe (measurement-only; writes nothing).
 *
 * Execute from apps/editor with:
 *
 *   npm exec -- vite-node --config vitest.config.ts --mode development tests/lib/bench/p23b11-node-probe.cli.ts
 *
 * It re-derives the node-side release shape on the three committed fixtures and
 * on the CONNECTED case (§0.8(d)): the generated 2×2 grid of adjacent curved
 * Rooms whose Walls are one connected group. Per fixture it reports the plan p50
 * for a clear-gap segment and for a Rect chain, the extracted-face shape and the
 * face×room pair subjects split by D-12 class (cross-group vs same-group), using
 * the shipped `correspondenceAuthorization` authority rather than a copy of it.
 * For the connected case it additionally drives the three operations the slice
 * names: clear-gap authoring, one Room division, and a move along the shared run.
 *
 * Every number is advisory (one machine, DEV); no baseline and no ratchet is
 * read or written, no threshold is asserted, and the P23B.6 diagnosis probe
 * stays live and untouched beside it.
 */
import {
	compileWallFirstLayoutGeometry,
	correspondenceAuthorization,
	createEmptyWallFirstLayoutDocument,
	extractBoundaryCandidateFaces,
	planExactJunctionMove,
	planWallChain,
	planWallSegment,
	validateWallFirstLayoutDocument,
	wallCenterlineSamples,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS, P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';
import { buildP23B11ConnectedCase, P23B11_CONNECTED_CASE_ID } from '$lib/bench/p23b11-connected-case';

/** Marks this slice's S1 step adds; the containment harness nests them. */
const MARK_NAMES = [
	'p2311:wall-chain-plan',
	'p2311:chain-topology-gate',
	'p2311:face-extraction',
	'p2311:correspondence',
	'p2311:room-reconciliation',
	'p2311:chain-canonical-gates',
	'p2311:wall-chain-commit-install'
] as const;

const MEASURED_RUNS = 9;
const WARMUP_RUNS = 2;

function p50(values: readonly number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)]!;
}

function timeRuns(work: () => void): number {
	for (let index = 0; index < WARMUP_RUNS; index += 1) work();
	const runs: number[] = [];
	for (let index = 0; index < MEASURED_RUNS; index += 1) {
		const start = performance.now();
		work();
		runs.push(performance.now() - start);
	}
	return p50(runs);
}

/** Face × predecessor-Room pair subjects by D-12 class, from the shipped authority. */
function pairClasses(baseline: LayoutDocumentWallFirst, candidate: LayoutDocumentWallFirst) {
	const extraction = extractBoundaryCandidateFaces(candidate);
	const authorization = correspondenceAuthorization({
		baselineRooms: baseline.rooms,
		candidateDocument: candidate,
		faces: extraction.faces
	});
	let sameGroup = 0;
	let crossGroup = 0;
	let undefinedSide = 0;
	for (const face of extraction.faces) {
		const faceComponentKey = authorization.faceComponentKeyByKey.get(face.key);
		for (const room of baseline.rooms) {
			const roomComponentKey = authorization.predecessorComponentKeyByRoomId.get(room.id);
			if (faceComponentKey === undefined || roomComponentKey === undefined) undefinedSide += 1;
			else if (faceComponentKey === roomComponentKey) sameGroup += 1;
			else crossGroup += 1;
		}
	}
	return {
		faces: extraction.faces.length,
		faceVertices: extraction.faces.reduce((sum, face) => sum + face.polygon.length, 0),
		predecessorRooms: baseline.rooms.length,
		pairSubjects: extraction.faces.length * baseline.rooms.length,
		sameGroupPairs: sameGroup,
		crossGroupPairs: crossGroup,
		undefinedSidePairs: undefinedSide
	};
}

function bounds(document: LayoutDocumentWallFirst): { maxX: number; minZ: number } {
	const points = document.junctions.map((junction) => junction.point);
	return {
		maxX: Math.max(...points.map((point) => point[0])),
		minZ: Math.min(...points.map((point) => point[1]))
	};
}

function clearGapSegment(document: LayoutDocumentWallFirst): [LayoutVec2, LayoutVec2] {
	const { maxX, minZ } = bounds(document);
	return [
		[maxX + 8, minZ],
		[maxX + 12, minZ]
	];
}

function clearGapRect(document: LayoutDocumentWallFirst): LayoutVec2[] {
	const { maxX, minZ } = bounds(document);
	return [
		[maxX + 8, minZ],
		[maxX + 12, minZ],
		[maxX + 12, minZ + 2],
		[maxX + 8, minZ + 2]
	];
}

/**
 * ONE node-side chain plan with the S1 marks live, read back as measures.
 *
 * This is the node half of the browser/node relation the S1 step records: the
 * same six `p2311:` marks the browser containment harness reports, produced by
 * the same planner, on the same fixture. The opt-in flag is turned off again
 * after the run, so nothing else in this probe is instrumented.
 */
function timeWithChainMarks(work: () => void): { totalMs: number; marks: Record<string, number> } {
	const gate = globalThis as { __P2311_PERF__?: boolean };
	performance.clearMeasures();
	gate.__P2311_PERF__ = true;
	const start = performance.now();
	try {
		work();
	} finally {
		gate.__P2311_PERF__ = false;
	}
	const totalMs = Math.round((performance.now() - start) * 100) / 100;
	const marks: Record<string, number> = {};
	for (const entry of performance.getEntriesByType('measure')) {
		if (!entry.name.startsWith('p2311:')) continue;
		marks[entry.name.replace(/^p2311:/, '')] = Math.round(entry.duration * 100) / 100;
	}
	performance.clearMeasures();
	return { totalMs, marks };
}

/** A point on a Wall's sampled centerline — the span a host declaration snaps to. */
function centerlineSamplePoint(
	document: LayoutDocumentWallFirst,
	wallId: string,
	fraction: number
): LayoutVec2 {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) throw new Error(`missing wall ${wallId}`);
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const start = junctionById.get(wall.startJunctionId)!;
	const end = junctionById.get(wall.endJunctionId)!;
	if (wall.centerline.kind === 'line') {
		return [
			start.point[0] + (end.point[0] - start.point[0]) * fraction,
			start.point[1] + (end.point[1] - start.point[1]) * fraction
		];
	}
	const sampled = wallCenterlineSamples(wall, start.point, end.point, 'forward');
	if (!sampled) throw new Error(`unsampled curve ${wallId}`);
	const index = Math.max(
		1,
		Math.min(sampled.samples.length - 2, Math.round(fraction * (sampled.samples.length - 1)))
	);
	return [...sampled.samples[index]!.point] as LayoutVec2;
}

function fixtureEntries(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	const entries: Array<{ id: string; document: LayoutDocumentWallFirst }> = [];
	for (const id of ['p23b-40-wall-straight-v1', 'p23b-40-wall-all-curved-v1']) {
		const spec = P23B_MATRIX_SPECS.find((candidate) => candidate.id === id)!;
		entries.push({ id, document: buildP23BMatrixFixture(spec) });
	}
	entries.push({ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT });
	entries.push({ id: P23B11_CONNECTED_CASE_ID, document: buildP23B11ConnectedCase() });
	return entries;
}

function fixtureReports() {
	return fixtureEntries().map(({ id, document }) => {
		const validation = validateWallFirstLayoutDocument(document);
		if (!validation.success) throw new Error(`${id} fixture invalid: ${validation.issues[0]?.message}`);
		const compiled = compileWallFirstLayoutGeometry(validation.document);
		const segment = clearGapSegment(document);
		const rect = clearGapRect(document);
		return {
			fixtureId: id,
			walls: document.walls.length,
			curvedWalls: document.walls.filter((wall) => wall.centerline.kind !== 'line').length,
			rooms: document.rooms.length,
			compileIssues: compiled.issues.length,
			selfPairClasses: pairClasses(document, document),
			clearGapSegmentPlanP50Ms: timeRuns(() => {
				const plan = planWallSegment({
					baseline: document,
					start: segment[0],
					end: segment[1],
					role: 'boundary'
				});
				if (plan.kind !== 'success') throw new Error(`clear-gap segment rejected: ${plan.rejection.code}`);
			}),
			rectChainPlanP50Ms: timeRuns(() => {
				const plan = planWallChain({ baseline: document, points: rect, close: true, role: 'boundary' });
				if (plan.kind !== 'success') throw new Error(`rect chain rejected: ${plan.rejection.code}`);
			}),
			nodeMarkSplit: timeWithChainMarks(() => {
				const plan = planWallChain({ baseline: document, points: rect, close: true, role: 'boundary' });
				if (plan.kind !== 'success') throw new Error(`rect chain rejected: ${plan.rejection.code}`);
			})
		};
	});
}

/** The connected case's own operations, exactly as the slice names them. */
function connectedCaseOperations(document: LayoutDocumentWallFirst) {
	const segment = clearGapSegment(document);
	const clearGap = planWallSegment({
		baseline: document,
		start: segment[0],
		end: segment[1],
		role: 'boundary'
	});
	// A Room division inside the grid: endpoints land on the spans of that cell's
	// own curved side Walls and declare both hosts, so the operation extends the
	// grid's single group (class 3) and divides the Room it was drawn into.
	const division = planWallSegment({
		baseline: document,
		start: centerlineSamplePoint(document, 'grid:v-0-0', 0.5),
		end: centerlineSamplePoint(document, 'grid:v-1-0', 0.5),
		role: 'boundary',
		endpointHostSnaps: [
			{ pointIndex: 0, wallId: 'grid:v-0-0' },
			{ pointIndex: 1, wallId: 'grid:v-1-0' }
		]
	});
	// A move along the SHARED run: the middle Junction on the bottom row line is
	// shared by two cells, so the candidate keeps four Rooms on one group.
	const sharedRunMove = planExactJunctionMove(document, 'grid:j-1-0', [12.5, 0.5]);
	const candidates: Array<{ id: string; plan: ReturnType<typeof planWallSegment> | ReturnType<typeof planExactJunctionMove> }> = [
		{ id: 'connected-clear-gap-segment', plan: clearGap },
		{ id: 'connected-room-division', plan: division },
		{ id: 'connected-shared-run-junction-move', plan: sharedRunMove }
	];
	return candidates.map(({ id, plan }) => {
		if (plan.kind !== 'success') {
			return { id, accepted: false, rejection: plan.rejection.code, message: plan.rejection.message };
		}
		const validation = validateWallFirstLayoutDocument(plan.document);
		return {
			id,
			accepted: true,
			candidateValid: validation.success,
			rooms: plan.document.rooms.length,
			candidatePairClasses: pairClasses(document, plan.document)
		};
	});
}

function emptyDocumentControl() {
	const chain = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
		points: [
			[0, 0],
			[4, 0],
			[4, 2],
			[0, 2]
		],
		close: true,
		role: 'boundary'
	});
	return chain.kind === 'rejected'
		? { outcome: 'rejected', rejection: chain.rejection.code }
		: { outcome: 'success', rooms: chain.document.rooms.length };
}

const connectedDocument = buildP23B11ConnectedCase();
const connectedValidation = validateWallFirstLayoutDocument(connectedDocument);

console.log(
	JSON.stringify(
		{
			protocol:
				'P23B.11 S1/S7 advisory node probe; p50 over 9 measured runs after 2 warm-up runs; no baseline, no ratchet, no threshold',
			provenance: {
				date: new Date().toISOString(),
				node: process.version,
				platform: `${process.platform} ${process.arch}`,
				svelteRuntime: process.env.NODE_ENV ?? 'unset',
				markNames: MARK_NAMES
			},
			fixtures: fixtureReports(),
			connectedCase: {
				fixtureId: P23B11_CONNECTED_CASE_ID,
				valid: connectedValidation.success,
				issues: connectedValidation.success ? [] : connectedValidation.issues.map((issue) => issue.code),
				shapes: pairClasses(connectedDocument, connectedDocument),
				operations: connectedCaseOperations(connectedDocument)
			},
			emptyDocumentControl: emptyDocumentControl()
		},
		null,
		2
	)
);
