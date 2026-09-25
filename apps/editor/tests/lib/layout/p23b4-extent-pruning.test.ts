import { describe, expect, it } from 'vitest';

import {
	detectWallCurveTopologyCrossings,
	sampledWallExtentsOverlap,
	sampledWallSelfIntersects,
	sampledWallsCross,
	topologyComponentKeyByWallId,
	validateWallFirstTopology,
	wallCenterlineSamples,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type SampledTopologyWall,
	type TopologySegment,
	type WallCurveTopologyCrossing
} from '@portfolio/layout-core';
import {
	buildP23BCorrectnessFixture,
	buildP23BMatrixFixture,
	P23B_CORRECTNESS_SPECS,
	P23B_MATRIX_SPECS,
	P23B_OWNER_LAYOUT
} from '$lib/bench/p23b-fixtures';

/**
 * P23B.4 S7 — M-2a extent pruning (OR-3/OR-9 in the same commit).
 *
 * OR-3: pruned validation returns verdicts identical to the unpruned validator on
 * (a) matrix cells, (b) owner payload, (c) crossing documents (N-2 admitted across
 * components, N-2i rejected within one), (d) already-invalid baselines (class-4 set).
 * OR-9: the pruned candidate set is a superset of every pair the narrow phase rejects —
 * proven by an independent unpruned oracle (same exported predicate, no extent gate)
 * agreeing verdict-for-verdict, plus direct gate tests over touching endpoints, shared
 * junctions, near-tangent curves, reversed walls, multi-room documents and degenerate
 * boxes. Every verdict is compared against the FULL validator, never a scoped variant.
 */

function points(document: LayoutDocumentWallFirst): Map<string, LayoutVec2> {
	return new Map(document.junctions.map((junction) => [junction.id, junction.point]));
}

/** Independent wallSegments build (junction lookup + zero-length guard, no prune). */
function segmentsOf(document: LayoutDocumentWallFirst): Map<string, TopologySegment> {
	const lookup = points(document);
	const segments = new Map<string, TopologySegment>();
	for (const wall of document.walls) {
		const start = lookup.get(wall.startJunctionId);
		const end = lookup.get(wall.endJunctionId);
		if (!start || !end) continue;
		const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
		if (!(length > 0)) continue;
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

/**
 * Independent UNPRUNED oracle: the same pairwise structure as the production gate
 * (component skip, straight/straight skip, shared-junction rule, first-wins order)
 * through the same exported narrow-phase predicate — minus only the extent gate.
 */
function unprunedCrossing(document: LayoutDocumentWallFirst): WallCurveTopologyCrossing | undefined {
	const lookup = points(document);
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
	for (const wall of document.walls) {
		if (wall.centerline.kind === 'line') continue;
		const candidate = sampled.get(wall.id);
		if (candidate && sampledWallSelfIntersects(candidate)) {
			return { kind: 'self', wallId: wall.id };
		}
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
			if (!sampledWallsCross(sampledA, sampledB, shared)) continue;
			return shared
				? { kind: 'pair', wallIds: [a.id, b.id], sharedJunctionId: shared }
				: { kind: 'pair', wallIds: [a.id, b.id] };
		}
	}
	return undefined;
}

function s7Fixtures(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	const entries: Array<{ id: string; document: LayoutDocumentWallFirst }> = [];
	for (const spec of P23B_MATRIX_SPECS) entries.push({ id: spec.id, document: buildP23BMatrixFixture(spec) });
	entries.push({ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT });
	for (const spec of P23B_CORRECTNESS_SPECS) {
		if (spec.id === 'class4-zero-length-wall-v1') continue; // zero-length never reaches the sampled gate
		entries.push({ id: spec.id, document: buildP23BCorrectnessFixture(spec) });
	}
	return entries;
}

function sampleAt(point: LayoutVec2) {
	return { point, distance: 0, tangent: [1, 0] as LayoutVec2, normal: [0, 1] as LayoutVec2, t: 0 };
}

describe('P23B.4 S7 — extent-pruning equivalence', () => {
	it('OR-9: the extent gate keeps every interacting pair and drops disjoint ones', () => {
		const line = (from: LayoutVec2, to: LayoutVec2) => ({
			samples: [sampleAt(from), sampleAt(to)]
		});
		// Touching endpoints overlap (never pruned).
		expect(sampledWallExtentsOverlap(line([0, 0], [4, 0]), line([4, 0], [8, 0]))).toBe(true);
		// Disjoint boxes prune.
		expect(sampledWallExtentsOverlap(line([0, 0], [4, 0]), line([10, 0], [14, 0]))).toBe(false);
		// Degenerate point boxes: coincident kept, separated pruned.
		expect(sampledWallExtentsOverlap(line([5, 5], [5, 5]), line([5, 5], [5, 5]))).toBe(true);
		expect(sampledWallExtentsOverlap(line([5, 5], [5, 5]), line([9, 9], [9, 9]))).toBe(false);
		// Near-tangent within tolerance is kept (superset, never widened).
		expect(sampledWallExtentsOverlap(line([0, 0], [4, 0]), line([0, 0.00005], [4, 0.00005]))).toBe(true);
		// Reversed sample order covers the same extent.
		const forward = {
			samples: [sampleAt([1, 1]), sampleAt([2, 3]), sampleAt([5, 1])]
		};
		const reversed = { samples: [...forward.samples].reverse() };
		expect(sampledWallExtentsOverlap(forward, reversed)).toBe(true);
		expect(sampledWallExtentsOverlap(forward, line([100, 100], [101, 101]))).toBe(false);
	});

	it('OR-3/OR-9: pruned gate agrees with the unpruned oracle on every fixture', () => {
		for (const { id, document } of s7Fixtures()) {
			const production = detectWallCurveTopologyCrossings(document, segmentsOf(document));
			expect(production ?? null, `${id} pruned vs unpruned`).toEqual(unprunedCrossing(document) ?? null);
		}
	});

	it('OR-3: full-validator verdicts are unchanged by pruning (admitted and invalid baselines)', () => {
		for (const { id, document } of s7Fixtures()) {
			const verdict = validateWallFirstTopology(document);
			// S1 froze these verdicts pre-pruning; this assertion re-proves them post-pruning.
			if (id === 'N-2i' || id === 'class4-self-intersection-v1' || id === 'class4-open-room-boundary-v1') {
				expect(verdict?.code, id).toBe('unsupported_wall_topology');
			} else if (id === 'class4-component-duplicate-junction-v1') {
				expect(verdict?.code, id).toBe('duplicate_junction_point');
			} else {
				expect(verdict, id).toBeUndefined();
			}
		}
	});
});
