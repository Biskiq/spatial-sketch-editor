import { describe, expect, it } from 'vitest';

import {
	classifyWallIntersection,
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
	// Genuine near-tangent same-component pair: parallel curved Walls 2e-4 apart
	// (above the 1e-4 predicate tolerance) joined by a link Wall. Boxes overlap so
	// the pair IS evaluated, and the narrow phase admits it. A 5e-5 sibling (below
	// tolerance) is rejected through the same evaluated path.
	{
		const near = (gap: number, suffix: string) => {
			const doc = createEmptyWallFirstLayoutDocument() as LayoutDocumentWallFirst;
			doc.junctions.push(
				{ id: `${suffix}-j-0`, point: [0, 0] },
				{ id: `${suffix}-j-1`, point: [8, 0] },
				{ id: `${suffix}-j-2`, point: [0, 0.7 + gap] },
				{ id: `${suffix}-j-3`, point: [8, 0.7 + gap] }
			);
			doc.walls.push(
				{ id: `${suffix}-w-low`, startJunctionId: `${suffix}-j-0`, endJunctionId: `${suffix}-j-1`, role: 'partition', thickness: 0.2, height: 3, centerline: curve([0, 0], [8, 0], [4, 0.35], `${suffix}-w-low:knot:1`) },
				{ id: `${suffix}-w-link`, startJunctionId: `${suffix}-j-1`, endJunctionId: `${suffix}-j-3`, role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
				{ id: `${suffix}-w-high`, startJunctionId: `${suffix}-j-2`, endJunctionId: `${suffix}-j-3`, role: 'partition', thickness: 0.2, height: 3, centerline: curve([0, 0.7 + gap], [8, 0.7 + gap], [4, 0.35 + gap], `${suffix}-w-high:knot:1`) }
			);
			return doc;
		};
		fixtures.push({ id: 'edge-near-tangent-miss', document: near(0.0002, 'miss') });
		fixtures.push({ id: 'edge-near-tangent-touch', document: near(0.00005, 'touch') });
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
	// Connected two-Room crossing: room-1's east Wall bows into room-2 and crosses
	// room-2's south Wall. Same component via the shared a2 junction; chords are
	// legally joined there, so any rejection MUST come from the sampled branch.
	// Three construction paths: gentle admitted control, knot-move edit of that
	// control, and the crossed state built directly as an already-invalid baseline.
	{
		const crossRoom = (eastKnot: LayoutVec2 | null) => {
			const doc = createEmptyWallFirstLayoutDocument() as LayoutDocumentWallFirst;
			doc.junctions.push(
				{ id: 'a0', point: [0, 0] },
				{ id: 'a1', point: [8, 0] },
				{ id: 'a2', point: [8, 8] },
				{ id: 'a3', point: [0, 8] },
				{ id: 'b1', point: [16, 8] },
				{ id: 'b2', point: [16, 16] },
				{ id: 'b3', point: [8, 16] }
			);
			doc.walls.push(
				{ id: 'r1-south', startJunctionId: 'a0', endJunctionId: 'a1', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
				{ id: 'r1-east', startJunctionId: 'a1', endJunctionId: 'a2', role: 'boundary', thickness: 0.2, height: 3, centerline: eastKnot ? curve([8, 0], [8, 8], eastKnot, 'r1-east:knot:1') : { kind: 'line' } },
				{ id: 'r1-north', startJunctionId: 'a2', endJunctionId: 'a3', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
				{ id: 'r1-west', startJunctionId: 'a3', endJunctionId: 'a0', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
				{ id: 'r2-south', startJunctionId: 'a2', endJunctionId: 'b1', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
				{ id: 'r2-east', startJunctionId: 'b1', endJunctionId: 'b2', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
				{ id: 'r2-north', startJunctionId: 'b2', endJunctionId: 'b3', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
				{ id: 'r2-west', startJunctionId: 'b3', endJunctionId: 'a2', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
			);
			doc.rooms.push(
				{ id: 'room-1', name: 'SW', floorThickness: 0.1, ceilingThickness: 0.1, boundary: [
					{ wallId: 'r1-south', direction: 'forward' }, { wallId: 'r1-east', direction: 'forward' },
					{ wallId: 'r1-north', direction: 'forward' }, { wallId: 'r1-west', direction: 'forward' } ] },
				{ id: 'room-2', name: 'NE', floorThickness: 0.1, ceilingThickness: 0.1, boundary: [
					{ wallId: 'r2-south', direction: 'forward' }, { wallId: 'r2-east', direction: 'forward' },
					{ wallId: 'r2-north', direction: 'forward' }, { wallId: 'r2-west', direction: 'forward' } ] }
			);
			return doc;
		};
		const gentle = crossRoom([12, 4]);
		fixtures.push({ id: 'edge-crossroom-admitted', document: gentle });
		// Edited form: the SAME admitted document with the knot moved into the crossing.
		const edited = JSON.parse(JSON.stringify(gentle)) as LayoutDocumentWallFirst;
		const editedWall = edited.walls.find((wall) => wall.id === 'r1-east')!;
		if (editedWall.centerline.kind === 'cubic-chain') {
			editedWall.centerline.knots[0]!.point = [12, 9];
		}
		fixtures.push({ id: 'edge-crossroom-edited', document: edited });
		// Already-invalid form: the crossed state built directly as a baseline.
		fixtures.push({ id: 'edge-crossroom-invalid', document: crossRoom([12, 9]) });
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

/** The OR-9 containment oracle: throws naming the first rejecting pair the candidate gate drops. */
function assertRejectingPairsSurvive(
	document: LayoutDocumentWallFirst,
	isKept: (aId: string, bId: string, a: SampledTopologyWall, b: SampledTopologyWall) => boolean,
	label: string
): void {
	const sampled = sampledWallsOf(document);
	for (const rejecting of exhaustiveRejectingPairs(document)) {
		if ('self' in rejecting) continue; // self-check has no prune gate by design
		const a = sampled.get(rejecting.a)!;
		const b = sampled.get(rejecting.b)!;
		if (!isKept(rejecting.a, rejecting.b, a, b)) {
			throw new Error(`${label}: candidate gate dropped rejecting pair ${rejecting.a}x${rejecting.b}`);
		}
	}
}

function minPolylineDistance(a: SampledTopologyWall['samples'], b: SampledTopologyWall['samples']): number {
	let min = Infinity;
	for (const pa of a) for (const pb of b) {
		min = Math.min(min, Math.hypot(pa.point[0] - pb.point[0], pa.point[1] - pb.point[1]));
	}
	return min;
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

	it('OR-3: first-wins order holds with multiple crossings', () => {		const multi = edgeFixtures().find((fixture) => fixture.id === 'edge-multi-crossing')!;
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
			assertRejectingPairsSurvive(document, (_aId, _bId, a, b) => sampledWallExtentsOverlap(a, b), id);
		}
	});

	it('OR-9: near-tangent pairs are evaluated through the tolerance-sensitive branch', () => {
		const edges = edgeFixtures();
		const miss = edges.find((fixture) => fixture.id === 'edge-near-tangent-miss')!;
		const touch = edges.find((fixture) => fixture.id === 'edge-near-tangent-touch')!;
		for (const [fixture, expected] of [
			[miss, 'admitted'],
			[touch, 'unsupported_wall_topology']
		] as const) {
			const sampled = sampledWallsOf(fixture.document);
			const lowId = `${fixture.id === 'edge-near-tangent-miss' ? 'miss' : 'touch'}-w-low`;
			const highId = `${fixture.id === 'edge-near-tangent-miss' ? 'miss' : 'touch'}-w-high`;
			const low = sampled.get(lowId)!;
			const high = sampled.get(highId)!;
			const distance = minPolylineDistance(low.samples, high.samples);
			// Precondition: the pair runs inside the tolerance band (miss) or inside it
			// (touch) — genuinely tolerance-sensitive, not far apart.
			expect(distance, `${fixture.id} polyline gap`).toBeGreaterThan(0.00001);
			expect(distance, `${fixture.id} polyline gap`).toBeLessThan(0.002);
			// The pair is evaluated, never pruned: boxes overlap.
			expect(sampledWallExtentsOverlap(low, high), `${fixture.id} evaluated`).toBe(true);
			// Exhaustive result asserted on both validators.
			const pruned = validateWallFirstTopology(fixture.document);
			const exhaustive = validateWallFirstTopology(fixture.document, { disableExtentPruneForTest: true } as never);
			expect((pruned?.code ?? 'admitted') as string, `${fixture.id} pruned verdict`).toBe(expected);
			expect(exhaustive, `${fixture.id} full issue`).toEqual(pruned);
			if (expected === 'unsupported_wall_topology') {
				const crossing = detectWallCurveTopologyCrossings(fixture.document, segmentsOf(fixture.document));
				expect(crossing?.kind, `${fixture.id} sampled pair branch`).toBe('pair');
			}
		}
	});

	it('OR-3(c/d): connected two-Room crossing in edited and already-invalid forms', () => {
		const edges = edgeFixtures();
		const admitted = edges.find((fixture) => fixture.id === 'edge-crossroom-admitted')!;
		const edited = edges.find((fixture) => fixture.id === 'edge-crossroom-edited')!;
		const invalid = edges.find((fixture) => fixture.id === 'edge-crossroom-invalid')!;
		// Preconditions: different-Room ownership, one connected component.
		const roomOf = (document: LayoutDocumentWallFirst, wallId: string): string | undefined =>
			document.rooms.find((room) => room.boundary.some((ref) => ref.wallId === wallId))?.id;
		expect(roomOf(edited.document, 'r1-east'), 'edited r1-east room').toBe('room-1');
		expect(roomOf(edited.document, 'r2-south'), 'edited r2-south room').toBe('room-2');
		const keyByWallId = topologyComponentKeyByWallId(edited.document);
		expect(keyByWallId.get('r1-east'), 'edited one component').toBe(keyByWallId.get('r2-south'));
		// Chord level is legally joined at a2, so the rejection MUST come from the
		// sampled branch (not the chord gate).
		const segments = segmentsOf(edited.document);
		const chordVerdict = classifyWallIntersection(segments.get('r1-east')!, segments.get('r2-south')!, ['a2']);
		expect(chordVerdict.kind, 'chords legally joined at a2').toBe('shared-explicit-junction');
		// Edited and already-invalid forms report the identical sampled pair…
		for (const [id, document] of [['edited', edited.document], ['invalid', invalid.document]] as const) {
			const crossing = detectWallCurveTopologyCrossings(document, segmentsOf(document));
			expect(crossing, `${id} sampled pair branch`).toEqual({
				kind: 'pair',
				wallIds: ['r1-east', 'r2-south'],
				sharedJunctionId: 'a2'
			});
			const pruned = validateWallFirstTopology(document);
			const exhaustive = validateWallFirstTopology(document, { disableExtentPruneForTest: true } as never);
			expect(pruned?.code, `${id} rejected`).toBe('unsupported_wall_topology');
			expect(exhaustive, `${id} full issue`).toEqual(pruned);
		}
		// …while the gentle control stays admitted on both validators (Option E's
		// independent-overlap control N-2 is covered in the main differential).
		expect(validateWallFirstTopology(admitted.document)?.code ?? 'admitted', 'gentle admitted').toBe('admitted');
		expect(
			validateWallFirstTopology(admitted.document, { disableExtentPruneForTest: true } as never),
			'gentle exhaustive'
		).toEqual(validateWallFirstTopology(admitted.document));
	});

	it('OR-9 negative control: a deliberately dropped rejecting pair fails the oracle', () => {
		const multi = edgeFixtures().find((fixture) => fixture.id === 'edge-multi-crossing')!;
		const rejecting = exhaustiveRejectingPairs(multi.document).filter((entry) => 'a' in entry);
		expect(rejecting.length, 'multi has rejecting pairs to drop').toBeGreaterThanOrEqual(2);
		const dropped = rejecting[0] as { a: string; b: string };
		const sampled = sampledWallsOf(multi.document);
		expect(sampledWallExtentsOverlap(sampled.get(dropped.a)!, sampled.get(dropped.b)!), 'dropped pair was kept by the true gate').toBe(true);
		// The SAME containment oracle, with a faulty gate that omits one genuinely
		// rejecting pair, must throw naming that pair.
		expect(() =>
			assertRejectingPairsSurvive(
				multi.document,
				(aId, bId, a, b) => {
					if ([aId, bId].sort().join('x') === [dropped.a, dropped.b].sort().join('x')) return false;
					return sampledWallExtentsOverlap(a, b);
				},
				'faulty-gate'
			)
		).toThrow(`dropped rejecting pair ${dropped.a}x${dropped.b}`);
	});
});
