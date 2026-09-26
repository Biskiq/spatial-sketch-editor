/**
 * P23B.6-explore advisory probe: Wall-authoring / Room-creation release-delay reproduction.
 *
 * Advisory only. Run from apps/editor with:
 *
 *   npm exec -- vite-node --config vitest.config.ts --mode development tests/lib/bench/p23b6-release-delay-probe.cli.ts
 *
 * It drives the exact planner entry points the Plan editor commits through for
 * Wall-chain acceptance (`planWallSegment`, role `boundary` — the Wall tool's
 * role) and Rect Room creation (`planWallChain`, close:true, role `boundary`),
 * on the committed 40-Wall fixtures, and reports p50 commit-plan times plus
 * curve-sampling call counts and extracted-face sizes. It writes no baseline
 * and no ratchet. See the diagnosis record beside the P23B.6 plan for the
 * interpretation (unmarked `buildCorrespondenceComponents` cost).
 */
import {
	compileWallFirstLayoutGeometry,
	extractBoundaryCandidateFaces,
	planWallChain,
	planWallSegment,
	setSampleSegmentObserverForTest,
	clearSampleSegmentObserverForTest,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS, P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';

function p50(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)]!;
}

function timeRuns(measured: number, warmup: number, work: () => void): number {
	for (let i = 0; i < warmup; i++) work();
	const runs: number[] = [];
	for (let i = 0; i < measured; i++) {
		const start = performance.now();
		work();
		runs.push(performance.now() - start);
	}
	return p50(runs);
}

const straightSpec = P23B_MATRIX_SPECS.find((spec) => spec.id === 'p23b-40-wall-straight-v1')!;
const curvedSpec = P23B_MATRIX_SPECS.find((spec) => spec.id === 'p23b-40-wall-all-curved-v1')!;
const fixtures: Array<{
	id: string;
	document: LayoutDocumentWallFirst;
	segment: [[number, number], [number, number]];
	rect: [number, number][];
}> = [
	{
		id: 'p23b-40-wall-straight-v1',
		document: buildP23BMatrixFixture(straightSpec),
		segment: [[14, 5], [18, 5]],
		rect: [[14, 5], [18, 5], [18, 7], [14, 7]]
	},
	{
		id: 'p23b-40-wall-all-curved-v1',
		document: buildP23BMatrixFixture(curvedSpec),
		segment: [[14, 5], [18, 5]],
		rect: [[14, 5], [18, 5], [18, 7], [14, 7]]
	},
	{
		id: 'owner-40-curved-v1',
		document: P23B_OWNER_LAYOUT,
		segment: [[24, 24], [28, 24]],
		rect: [[24, 24], [28, 24], [28, 26], [24, 26]]
	}
];

for (const fixture of fixtures) {
	const curvedWalls = fixture.document.walls.filter((wall) => wall.centerline.kind !== 'line').length;
	const extraction = extractBoundaryCandidateFaces(fixture.document);
	const faceVertices = extraction.faces.reduce((sum, face) => sum + face.polygon.length, 0);
	const segmentPlanMs = timeRuns(5, 2, () => {
		const plan = planWallSegment({
			baseline: fixture.document,
			start: fixture.segment[0],
			end: fixture.segment[1],
			role: 'boundary'
		});
		if (plan.kind !== 'success') throw new Error(`segment rejected: ${plan.rejection.code}`);
	});
	const rectPlanMs = timeRuns(5, 2, () => {
		const plan = planWallChain({ baseline: fixture.document, points: fixture.rect, close: true, role: 'boundary' });
		if (plan.kind !== 'success') throw new Error(`rect rejected: ${plan.rejection.code}`);
	});
	let samples = 0;
	setSampleSegmentObserverForTest(() => {
		samples += 1;
	});
	planWallSegment({ baseline: fixture.document, start: fixture.segment[0], end: fixture.segment[1], role: 'boundary' });
	const segmentSamples = samples;
	samples = 0;
	const accepted = planWallSegment({
		baseline: fixture.document,
		start: fixture.segment[0],
		end: fixture.segment[1],
		role: 'boundary'
	});
	if (accepted.kind !== 'success') throw new Error('segment rejected');
	samples = 0;
	compileWallFirstLayoutGeometry(accepted.document);
	const compileSamples = samples;
	clearSampleSegmentObserverForTest();
	console.log(
		`${fixture.id} walls=${fixture.document.walls.length} curved=${curvedWalls} ` +
			`faces=${extraction.faces.length} faceVerts=${faceVertices} ` +
			`segmentPlanP50Ms=${segmentPlanMs.toFixed(1)} rectPlanP50Ms=${rectPlanMs.toFixed(1)} ` +
			`segmentSamples=${segmentSamples} compileSamples=${compileSamples}`
	);
}
