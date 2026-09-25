/**
 * P23B.4 correction (F1) — shared observation collector for consumer sampling.
 *
 * Runs each REAL consumer with the test-only observers enabled and returns
 * deterministic digests of the ACTUAL arrays each consumer derived/consumed
 * (not test-selected seam calls). All five CurveSample fields contribute at full
 * precision; checksums are SHA-256 over the exact JSON encoding.
 *
 * Keyed by consumer/site/traversal/resolved endpoints. Used both to GENERATE the
 * pre-optimization reference (run at ca04983a with hooks backported) and to ASSERT
 * it (run on the correction tree, default per-call path + shared path).
 */
import { createHash } from 'node:crypto';
import {
	clearFaceSamplingObserverForTest,
	clearSampleSegmentObserverForTest,
	clearTopologyGateObserverForTest,
	clearWallSamplingObserverForTest,
	compileWallFirstLayoutGeometry,
	extractBoundaryCandidateFaces,
	planExactJunctionMove,
	setFaceSamplingObserverForTest,
	setSampleSegmentObserverForTest,
	setTopologyGateObserverForTest,
	setWallSamplingObserverForTest,
	validateWallFirstOpeningSet,
	validateWallFirstTopology,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

export function sha(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function encSample(sample: {
	point: readonly number[];
	distance: number;
	tangent: readonly number[];
	normal: readonly number[];
	t: number;
}): string {
	return JSON.stringify({
		p: sample.point,
		d: sample.distance,
		tan: sample.tangent,
		nor: sample.normal,
		u: sample.t
	});
}

function hashSamples(
	samples: readonly { point: readonly number[]; distance: number; tangent: readonly number[]; normal: readonly number[]; t: number }[] | undefined
): string {
	if (!samples) return 'undefined';
	return sha(samples.map(encSample).join('|'));
}

export type ConsumerObservationDigest = {
	wallCalls: string;
	gateWalls: string;
	faceConsumed: string;
	kernelCalls: string;
};

function digestWallCalls(
	calls: Array<{ wallId: string; traversal: string; start: readonly number[]; end: readonly number[]; ok: boolean; hash: string; count: number; length: number | null }>
): string {
	const sorted = [...calls].sort((a, b) =>
		a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : a.traversal < b.traversal ? -1 : 1
	);
	const parts = sorted.map(
		(call) =>
			`${call.wallId}:${call.traversal}:${JSON.stringify(call.start)}:${JSON.stringify(call.end)}:${call.ok}:${call.count}:${call.length === null ? 'null' : String(call.length)}:${call.hash}`
	);
	return `n=${parts.length} checksum=${sha(parts.join('~'))}`;
}

function digestGateWalls(entries: Array<{ wallId: string; hash: string; count: number }>): string {
	const sorted = [...entries].sort((a, b) => (a.wallId < b.wallId ? -1 : 1));
	return `n=${sorted.length} checksum=${sha(sorted.map((entry) => `${entry.wallId}:${entry.count}:${entry.hash}`).join('~'))}`;
}

function digestFace(entries: Array<{ wallId: string; direction: string; hash: string; count: number }>): string {
	const sorted = [...entries].sort((a, b) =>
		a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : a.direction < b.direction ? -1 : 1
	);
	return `n=${sorted.length} checksum=${sha(sorted.map((entry) => `${entry.wallId}:${entry.direction}:${entry.count}:${entry.hash}`).join('~'))}`;
}

function digestKernel(entries: Array<{ segmentId: string; kind: string; ok: boolean; hash: string; count: number }>): string {
	const sorted = [...entries].sort((a, b) =>
		a.segmentId < b.segmentId ? -1 : a.segmentId > b.segmentId ? 1 : a.kind < b.kind ? -1 : 1
	);
	return `n=${sorted.length} checksum=${sha(sorted.map((entry) => `${entry.segmentId}:${entry.kind}:${entry.ok}:${entry.count}:${entry.hash}`).join('~'))}`;
}

type Collector = {
	wallCalls: Array<{ wallId: string; traversal: string; start: readonly number[]; end: readonly number[]; ok: boolean; hash: string; count: number; length: number | null }>;
	gateEntries: Array<{ wallId: string; hash: string; count: number }>;
	faceEntries: Array<{ wallId: string; direction: string; hash: string; count: number }>;
	kernelEntries: Array<{ segmentId: string; kind: string; ok: boolean; hash: string; count: number }>;
};

function startCollecting(): Collector {
	const collector: Collector = { wallCalls: [], gateEntries: [], faceEntries: [], kernelEntries: [] };
	setWallSamplingObserverForTest((observation, result) => {
		collector.wallCalls.push({
			wallId: observation.wallId,
			traversal: observation.traversal,
			start: [...observation.start],
			end: [...observation.end],
			ok: observation.ok,
			hash: hashSamples(result?.samples),
			count: result?.samples.length ?? 0,
			length: result ? result.length : null
		});
	});
	setTopologyGateObserverForTest((_summary, byId) => {
		for (const [wallId, samples] of byId) {
			collector.gateEntries.push({ wallId, hash: hashSamples(samples), count: samples.length });
		}
	});
	setFaceSamplingObserverForTest((observation, samples) => {
		collector.faceEntries.push({
			wallId: observation.wallId,
			direction: observation.direction,
			hash: hashSamples(samples),
			count: samples?.length ?? 0
		});
	});
	setSampleSegmentObserverForTest((observation, result) => {
		collector.kernelEntries.push({
			segmentId: observation.segmentId,
			kind: observation.kind,
			ok: observation.ok,
			hash: hashSamples(result?.samples),
			count: result?.samples.length ?? 0
		});
	});
	return collector;
}

function stopCollecting(): void {
	clearWallSamplingObserverForTest();
	clearTopologyGateObserverForTest();
	clearFaceSamplingObserverForTest();
	clearSampleSegmentObserverForTest();
}

function digest(collector: Collector): ConsumerObservationDigest {
	return {
		wallCalls: digestWallCalls(collector.wallCalls),
		gateWalls: digestGateWalls(collector.gateEntries),
		faceConsumed: digestFace(collector.faceEntries),
		kernelCalls: digestKernel(collector.kernelEntries)
	};
}

function withCollector(work: () => void): ConsumerObservationDigest {
	const collector = startCollecting();
	try {
		work();
	} finally {
		stopCollecting();
	}
	return digest(collector);
}

export type FixtureConsumerDigests = {
	topologyDefer: ConsumerObservationDigest;
	topologyTranslate: ConsumerObservationDigest;
	faces: ConsumerObservationDigest;
	openings: ConsumerObservationDigest;
	compile: ConsumerObservationDigest;
	planner: ConsumerObservationDigest;
	plannerVerdict: string;
};

/** Observe every real consumer on one fixture (default per-call path, no derivation). */
export function collectFixtureDigests(document: LayoutDocumentWallFirst): FixtureConsumerDigests {
	const topologyDefer = withCollector(() => {
		validateWallFirstTopology(document, { openingSet: 'defer' });
	});
	const topologyTranslate = withCollector(() => {
		validateWallFirstTopology(document);
	});
	const faces = withCollector(() => {
		extractBoundaryCandidateFaces(document);
	});
	const openings = withCollector(() => {
		validateWallFirstOpeningSet(document);
	});
	const compile = withCollector(() => {
		compileWallFirstLayoutGeometry(document);
	});
	let plannerVerdict = 'skipped-no-junction';
	const planner = withCollector(() => {
		const firstJunction = document.junctions[0];
		if (!firstJunction) return;
		const moved: [number, number] = [firstJunction.point[0] + 0.05, firstJunction.point[1]];
		const plan = planExactJunctionMove(document, firstJunction.id, moved);
		plannerVerdict =
			plan.kind === 'success'
				? `success:${sha(plan.acceptance?.documentJson ?? JSON.stringify(plan.document))}`
				: `rejected:${plan.rejection.code}:${sha(plan.rejection.message)}`;
	});
	return { topologyDefer, topologyTranslate, faces, openings, compile, planner, plannerVerdict };
}
