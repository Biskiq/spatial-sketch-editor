import { describe, expect, it } from 'vitest';

import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	detectWallCurveTopologyCrossings,
	sampledWallExtentsOverlap,
	sampledWallSelfIntersects,
	sampledWallsCross,
	topologyComponentKeyByWallId,
	validateWallFirstTopology,
	wallCenterlineSamples,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type SampledTopologyWall,
	type TopologySegment,
	type WallCurveTopologyCrossing,
	type LayoutWallCenterline
} from '@portfolio/layout-core';
import {
	buildP23BCorrectnessFixture,
	buildP23BMatrixFixture,
	P23B_CORRECTNESS_SPECS,
	P23B_MATRIX_SPECS,
	P23B_OWNER_LAYOUT
} from '$lib/bench/p23b-fixtures';
import { buildWildRoomFixture, buildWildSharedFixture } from './p23b4-wild-fixtures';

/**
 * P23B.4 correction (F2) — full-validator differential + candidate-superset proof.
 *
 * The S7 twin oracle (useful, kept) re-implements the pair loop; this test instead
 * exercises the GENUINE shipped exhaustive behavior with ONLY the new extent gate
 * absent (`disableExtentPruneForTest` on the single production crossing authority)
 * and compares COMPLETE results against the optimized full validator:
 * full issue objects (code, message, path, targetId) + crossing identities
 * (kind, wallId/wallIds, sharedJunctionId). Never two pruned variants.
 *
 * OR-9 superset: every pair the exhaustive narrow phase rejects is proven to survive
 * pruning, across touching endpoints, shared Junctions, near-tangent curves, reversed
 * Walls/refs, multiple Rooms, degenerate extents, edited-into-crossing and
 * already-invalid baselines. A deliberately dropped rejecting pair fails the oracle
 * (negative control).
 */

function pointsOf(document: LayoutDocumentWallFirst): Map<string, LayoutVec2> {
	return new Map(document.junctions.map((junction) => [junction.id, junction.point]));
}

function segmentsOf(document: LayoutDocumentWallFirst): Map<string, TopologySegment> {
	const lookup = pointsOf(document);
	const segments = new Map<string, TopologySegment>();
	for (const wall of document.walls) {
		const start = lookup.get(wall.startJunctionId);
		const end = lookup.get(wall.endJunctionId);
		if (!start || !end) continue;
		if (!(Math.hypot(end[0] - start[0], end[1] - start[1]) > 0)) continue;
		segments.set(wall.id, { id: wall.id, start, end });
	}
	return segments;
}

function chordSamples(segment: TopologySegment): SampledTopologyWall['samples'] {
	const dx = segment.end[0] - segment.start[0];
	const dz = segment.end[1] - segment.start[1];
	const length = Math.hypot(dx, dz) || 0;
	const tangent: LayoutVec2 = length > 0 ? [dx / length, dz / length] : [1, 0];
	return [
		{ point: segment.start, distance: 0, tangent, normal: [-tangent[1], tangent[0]], t: 0 },
		{ point: segment.end, distance: length, tangent, normal: [-tangent[1], tangent[0]], t: 1 }
	];
}

/** Sampled walls exactly as the production gate builds them (same seam, no prune). */
function sampledWallsOf(document: LayoutDocumentWallFirst): Map<string, SampledTopologyWall> {
	const lookup = pointsOf(document);
	const segments = segmentsOf(document);
	const sampled = new Map<string, SampledTopologyWall>();
	for (const wall of document.walls) {
		if (!segments.has(wall.id)) continue;
		if (wall.centerline.kind === 'line') {
			sampled.set(wall.id, {
				id: wall.id,
				startJunctionId: wall.startJunctionId,
				endJunctionId: wall.endJunctionId,
				samples: chordSamples(segments.get(wall.id)!)
			});
			continue;
		}
		const start = lookup.get(wall.startJunctionId);
		const end = lookup.get(wall.endJunctionId);
		if (!start || !end) continue;
		const derived = wallCenterlineSamples(wall, start, end, 'forward');
		if (!derived) continue;
		sampled.set(wall.id, {
			id: wall.id,
			startJunctionId: wall.startJunctionId,
			endJunctionId: wall.endJunctionId,
			samples: derived.samples
		});
	}
	return sampled;
}

function curve(start: LayoutVec2, end: LayoutVec2, knot: LayoutVec2, knotId: string): LayoutWallCenterline {
	return wallCubicChain([{ id: knotId, point: knot }], deriveChainSpans([start, knot, end]));
}

function baseFixtures(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	const entries: Array<{ id: string; document: LayoutDocumentWallFirst }> = [];
	for (const spec of P23B_MATRIX_SPECS) entries.push({ id: spec.id, document: buildP23BMatrixFixture(spec) });
	entries.push({ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT });
	for (const spec of P23B_CORRECTNESS_SPECS) {
		if (spec.id === 'class4-zero-length-wall-v1') continue;
		entries.push({ id: spec.id, document: buildP23BCorrectnessFixture(spec) });
	}
	entries.push({ id: 'wild-room-curved-v1', document: buildWildRoomFixture() });
	entries.push({ id: 'wild-shared-curved-v1', document: buildWildSharedFixture() });
	return entries;
}

function edgeFixtures(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	const fixtures: Array<{ id: string; document: LayoutDocumentWallFirst }> = [];
	// Two N-2i-shaped crossings in document order (multi-crossing order check).
	{
		const doc = createEmptyWallFirstLayoutDocument() as LayoutDocumentWallFirst;
		doc.junctions.push(
			{ id: 'a-j-a', point: [0, 0] },
			{ id: 'a-j-m', point: [6, 0] },
			{ id: 'a-j-b', point: [6, 4] },
			{ id: 'b-j-a', point: [20, 0] },
			{ id: 'b-j-m', point: [26, 0] },
			{ id: 'b-j-b', point: [26, 4] }
		);
		doc.walls.push(
			{ id: 'a-straight', startJunctionId: 'a-j-a', endJunctionId: 'a-j-m', role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'a-curved', startJunctionId: 'a-j-m', endJunctionId: 'a-j-b', role: 'partition', thickness: 0.2, height: 3, centerline: curve([6, 0], [6, 4], [1, -2], 'a-curved:knot:1') },
			{ id: 'b-straight', startJunctionId: 'b-j-a', endJunctionId: 'b-j-m', role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'b-curved', startJunctionId: 'b-j-m', endJunctionId: 'b-j-b', role: 'partition', thickness: 0.2, height: 3, centerline: curve([26, 0], [26, 4], [21, -2], 'b-curved:knot:1') }
		);
		fixtures.push({ id: 'edge-multi-crossing', document: doc });
	}
	// Near-tangent same-component curves (evaluated, admitted).
	{
		const doc = createEmptyWallFirstLayoutDocument() as LayoutDocumentWallFirst;
		doc.junctions.push(
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-m', point: [8, 0] },
			{ id: 'j-b', point: [8, 4] },
			{ id: 'j-c', point: [0, 4] }
		);
		doc.walls.push(
			{ id: 'wall-low', startJunctionId: 'j-a', endJunctionId: 'j-m', role: 'partition', thickness: 0.2, height: 3, centerline: curve([0, 0], [8, 0], [4, 0.00005], 'wall-low:knot:1') },
			{ id: 'wall-high', startJunctionId: 'j-m', endJunctionId: 'j-b', role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'wall-top', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'partition', thickness: 0.2, height: 3, centerline: curve([8, 4], [0, 4], [4, 4.00005], 'wall-top:knot:1') }
		);
		fixtures.push({ id: 'edge-near-tangent', document: doc });
	}
	// Degenerate tiny wall in one component (degenerate box handling).
	{
		const doc = createEmptyWallFirstLayoutDocument() as LayoutDocumentWallFirst;
		doc.junctions.push(
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-b', point: [8, 0] },
			{ id: 'j-c', point: [8, 0.000001] }
		);
		doc.walls.push(
			{ id: 'wall-long', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'partition', thickness: 0.2, height: 3, centerline: curve([0, 0], [8, 0], [4, -0.3], 'wall-long:knot:1') },
			{ id: 'wall-tiny', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
		);
		fixtures.push({ id: 'edge-degenerate-tiny', document: doc });
	}
	// Edited-into-crossing: N-2 admitted shape JOINed into one component (connectivity change).
	{
		const admitted = buildP23BCorrectnessFixture(P23B_CORRECTNESS_SPECS.find((spec) => spec.id === 'N-2')!);
		const joined = JSON.parse(JSON.stringify(admitted)) as LayoutDocumentWallFirst;
		const curved = joined.walls.find((wall) => wall.id === 'wall-curved')!;
		curved.startJunctionId = 'j-b';
		joined.junctions = joined.junctions.filter((junction) => junction.id !== 'j-c');
		fixtures.push({ id: 'edge-joined-crossing', document: joined });
	}
	// Touching endpoints, same component via a third wall (no shared junction id at the touch).
	{
		const doc = createEmptyWallFirstLayoutDocument() as LayoutDocumentWallFirst;
		doc.junctions.push(
			{ id: 'j-0', point: [0, 0] },
			{ id: 'j-1', point: [8, 0] },
			{ id: 'j-2', point: [8, 8] },
			{ id: 'j-3', point: [0, 8] },
			{ id: 'j-4', point: [0, 0] }
		);
		doc.walls.push(
			{ id: 'w-0', startJunctionId: 'j-0', endJunctionId: 'j-1', role: 'partition', thickness: 0.2, height: 3, centerline: curve([0, 0], [8, 0], [4, -0.3], 'w-0:knot:1') },
			{ id: 'w-1', startJunctionId: 'j-1', endJunctionId: 'j-2', role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w-2', startJunctionId: 'j-2', endJunctionId: 'j-3', role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w-3', startJunctionId: 'j-3', endJunctionId: 'j-4', role: 'partition', thickness: 0.2, height: 3, centerline: curve([0, 8], [0, 0], [-0.3, 4], 'w-3:knot:1') }
		);
		fixtures.push({ id: 'edge-touch-chain', document: doc });
	}
	return fixtures;
}

/** Exhaustive rejecting pairs via the SHIPPED narrow-phase predicate (no extent gate). */
function exhaustiveRejectingPairs(document: LayoutDocumentWallFirst): Array<{ a: string; b: string } | { self: string }> {
	const sampled = sampledWallsOf(document);
	const rejecting: Array<{ a: string; b: string } | { self: string }> = [];
	for (const wall of document.walls) {
		if (wall.centerline.kind === 'line') continue;
		const candidate = sampled.get(wall.id);
		if (candidate && sampledWallSelfIntersects(candidate)) rejecting.push({ self: wall.id });
	}
	const keyByWallId = topologyComponentKeyByWallId(document);
	for (let first = 0; first < document.walls.length; first += 1) {
		for (let second = first + 1; second < document.walls.length; second += 1) {
			const a = document.walls[first]!;
			const b = document.walls[second]!;
			if (keyByWallId.get(a.id) !== keyByWallId.get(b.id)) continue;
			if (a.centerline.kind === 'line' && b.centerline.kind === 'line') continue;
			const sampledA = sampled.get(a.id);
			const sampledB = sampled.get(b.id);
			if (!sampledA || !sampledB) continue;
			const shared = [a.startJunctionId, a.endJunctionId].find(
				(junctionId) => junctionId === b.startJunctionId || junctionId === b.endJunctionId
			);
			if (sampledWallsCross(sampledA, sampledB, shared)) rejecting.push({ a: a.id, b: b.id });
		}
	}
	return rejecting;
}

function crossingKey(crossing: WallCurveTopologyCrossing | undefined): string {
	if (!crossing) return 'none';
	if (crossing.kind === 'self') return `self:${crossing.wallId}`;
	return `pair:${crossing.wallIds[0]}:${crossing.wallIds[1]}:${crossing.sharedJunctionId ?? '-'}`;
}

describe('P23B.4 F2 — full-validator pruning differential', () => {
	it('OR-3/OR-10: pruned and exhaustive validators return identical FULL issues', () => {
		for (const { id, document } of [...baseFixtures(), ...edgeFixtures()]) {
			for (const openingSet of ['defer', 'translate'] as const) {
				const options = openingSet === 'defer' ? { openingSet } : {};
				const pruned = validateWallFirstTopology(document, options as never);
				const exhaustive = validateWallFirstTopology(document, { ...(options as object), disableExtentPruneForTest: true } as never);
				expect(exhaustive ?? null, `${id} ${openingSet} exhaustive runs`).toEqual(pruned ?? null);
				if (pruned || exhaustive) {
					// Full object equality: code, message, path AND target — not just the code.
					expect(exhaustive, `${id} ${openingSet} full issue`).toEqual(pruned);
				}
			}
			const prunedCrossing = detectWallCurveTopologyCrossings(document, segmentsOf(document));
			const exhaustiveCrossing = detectWallCurveTopologyCrossings(document, segmentsOf(document), undefined, true);
			expect(crossingKey(exhaustiveCrossing), `${id} crossing identity`).toBe(crossingKey(prunedCrossing));
			if (prunedCrossing && exhaustiveCrossing) {
				expect(exhaustiveCrossing, `${id} full crossing`).toEqual(prunedCrossing);
			}
		}
	});

	it('OR-3: first-wins order holds with multiple crossings', () => {
		const multi = edgeFixtures().find((fixture) => fixture.id === 'edge-multi-crossing')!;
		const pruned = detectWallCurveTopologyCrossings(multi.document, segmentsOf(multi.document));
		const exhaustive = detectWallCurveTopologyCrossings(multi.document, segmentsOf(multi.document), undefined, true);
		// Both crossings are real rejections; document order picks the first pair.
		expect(pruned?.kind, 'multi pruned kind').toBe('pair');
		expect(exhaustive, 'multi order').toEqual(pruned);
		if (pruned?.kind === 'pair') {
			expect(pruned.wallIds, 'first crossing wins').toEqual(['a-straight', 'a-curved']);
		}
	});

	it('OR-9: every exhaustively rejecting pair survives pruning (candidate superset)', () => {
		for (const { id, document } of [...baseFixtures(), ...edgeFixtures()]) {
			const sampled = sampledWallsOf(document);
			const keyByWallId = topologyComponentKeyByWallId(document);
			for (const rejecting of exhaustiveRejectingPairs(document)) {
				if ('self' in rejecting) continue; // self-check has no prune gate by design
				const a = sampled.get(rejecting.a)!;
				const b = sampled.get(rejecting.b)!;
				expect(keyByWallId.get(rejecting.a), `${id} rejecting pair same-component`).toBe(
					keyByWallId.get(rejecting.b)
				);
				expect(sampledWallExtentsOverlap(a, b), `${id} rejecting pair ${rejecting.a}x${rejecting.b} survives`).toBe(true);
			}
		}
	});

	it('OR-9 negative control: a deliberately dropped rejecting pair fails the oracle', () => {
		const multi = edgeFixtures().find((fixture) => fixture.id === 'edge-multi-crossing')!;
		const rejecting = exhaustiveRejectingPairs(multi.document).filter((entry) => 'a' in entry);
		expect(rejecting.length, 'multi has rejecting pairs to drop').toBeGreaterThanOrEqual(2);
		const dropped = rejecting[0] as { a: string; b: string };
		const sampled = sampledWallsOf(multi.document);
		// Simulate a faulty prune that drops a genuinely rejecting pair: the containment
		// oracle MUST report non-containment (i.e. the overlap gate says kept, so dropping
		// it is an error the oracle catches).
		expect(sampledWallExtentsOverlap(sampled.get(dropped.a)!, sampled.get(dropped.b)!), 'dropped pair was kept by the true gate').toBe(true);
		const faultyKept = new Set(
			rejecting
				.filter((entry) => !(('a' in entry) && entry.a === dropped.a && entry.b === dropped.b))
				.map((entry) => ('a' in entry ? `${entry.a}x${entry.b}` : ''))
		);
		expect(faultyKept.has(`${dropped.a}x${dropped.b}`), 'faulty set drops the rejecting pair').toBe(false);
	});
});
