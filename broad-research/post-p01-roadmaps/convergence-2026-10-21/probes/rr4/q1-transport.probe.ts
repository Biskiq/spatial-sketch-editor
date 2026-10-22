/**
 * RR-4 Q1 — surface transport through owner split/dissolve (disposable).
 * Prints a JSON ledger line per case (`RR4 Q1 …`) and asserts only the oracles.
 */
import { describe, expect, it } from 'vitest';
import {
	JUNCTION_COINCIDENCE_EPSILON,
	orientedWallChainKnotsAndSpans,
	planDissolveJunction,
	planWallSplit,
	resolveWallCurveSplit,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import {
	CURVE_ARC_LENGTH_TOLERANCE,
	arcLength,
	curvedWall,
	emptyDoc,
	evaluate,
	lineWall,
	occupancyAllocator,
	overOpening,
	residual,
	transportDissolve,
	transportSplit,
	wallOf,
	type Binding
} from './rr4-support';

const log = (label: string, value: unknown) => console.log(`RR4 Q1 ${label} ${JSON.stringify(value)}`);

function panels(hostWallId: string): Binding[] {
	const out: Binding[] = [];
	for (const s of [1, 3, 6]) for (const side of ['left', 'right'] as const) out.push({ id: `p${s}${side[0]}`, hostWallId, s, side, width: 1, standoff: 0.02 });
	return out;
}

const STRAIGHT_POINTS: Record<string, LayoutVec2> = { A: [0, 0], B: [8, 0] };
const CURVE_POINTS: Record<string, LayoutVec2> = { A: [0, 0], B: [8, 0] };

function straightDoc(): LayoutDocumentWallFirst {
	return emptyDoc(STRAIGHT_POINTS, [lineWall('W', 'A', 'B')]);
}
function curvedDoc(): LayoutDocumentWallFirst {
	return emptyDoc(CURVE_POINTS, [curvedWall('W', 'A', 'B', CURVE_POINTS, [[2.5, 1.2], [5.5, -0.8]])]);
}

function splitCase(name: string, doc: LayoutDocumentWallFirst, tolerance: number) {
	const before = doc;
	const bindings = panels('W');
	const posesBefore = bindings.map((binding) => evaluate(before, binding)!);
	const plan = planWallSplit(before, 'W', 4, occupancyAllocator);
	if (plan.kind !== 'success') throw new Error(JSON.stringify(plan));
	const after = plan.document;
	const created = plan.createdWallIds[0]!;
	const rows = bindings.map((binding, index) => {
		const moved = transportSplit(after, 'W', created, binding);
		if (moved.kind !== 'transported') throw new Error('unexpected review');
		const pose = evaluate(after, moved.binding)!;
		const r = residual(posesBefore[index]!, pose);
		return { id: binding.id, host: moved.binding.hostWallId, s: moved.binding.s, side: moved.binding.side, dPos: r.position, facingDot: r.facingDot };
	});
	const resolvedD = arcLength(after, 'W');
	const maxPos = Math.max(...rows.map((row) => row.dPos));
	const minDot = Math.min(...rows.map((row) => row.facingDot));
	log(`${name}-split`, { returnedFields: Object.keys(plan), resolvedD, requestedD: 4, dDelta: resolvedD - 4, maxPos, minDot, tolerance });
	expect(maxPos).toBeLessThanOrEqual(tolerance);
	expect(minDot).toBeGreaterThan(1 - tolerance);
	// Straddling footprint: owner returns no typed answer for a Scene subject; consumer must.
	const straddle = transportSplit(after, 'W', created, { id: 'straddle', hostWallId: 'W', s: 4, side: 'left', width: 1, standoff: 0.02 });
	expect(straddle.kind).toBe('needs-review');
	return { before, after, created };
}

/**
 * Build the reversal configuration from the owner's own split output: reverse
 * the retained fragment's canonical direction with the single traversal owner,
 * so both fragments START at X. Dissolving X then reverses the survivor.
 */
function reversedPair(after: LayoutDocumentWallFirst, created: string, junctionId: string): LayoutDocumentWallFirst {
	const walls = after.walls.map((wall) => {
		if (wall.id !== 'W') return wall;
		const oriented = orientedWallChainKnotsAndSpans(wall.centerline, 'reverse');
		return {
			...wall,
			startJunctionId: wall.endJunctionId,
			endJunctionId: wall.startJunctionId,
			centerline: wall.centerline.kind === 'line' ? wall.centerline : wallCubicChain(oriented.knots, oriented.spans)
		};
	});
	expect(walls.find((wall) => wall.id === 'W')!.startJunctionId).toBe(junctionId);
	expect(walls.find((wall) => wall.id === created)!.startJunctionId).toBe(junctionId);
	return { ...after, walls };
}

function dissolveCase(name: string, before: LayoutDocumentWallFirst, junctionId: string, tolerance: number) {
	const bindings = before.walls.flatMap((wall) =>
		[0.8, 2.2].flatMap((s) => (['left', 'right'] as const).map((side) => ({ id: `${wall.id}-${s}${side[0]}`, hostWallId: wall.id, s, side, width: 0.6, standoff: 0.02 })))
	);
	const posesBefore = bindings.map((binding) => evaluate(before, binding)!);
	const plan = planDissolveJunction(before, junctionId);
	if (plan.kind !== 'success') throw new Error(JSON.stringify(plan));
	const after = plan.document;
	const measure = (flipSide: boolean) =>
		bindings.map((binding, index) => {
			const moved = transportDissolve(before, after, plan, binding, { flipSide });
			if (moved.kind !== 'transported') throw new Error('unexpected');
			return residual(posesBefore[index]!, evaluate(after, moved.binding)!);
		});
	const flipped = measure(true);
	const naive = measure(false);
	const survivorBefore = wallOf(before, plan.survivorWallId)!;
	const joined = wallOf(after, plan.survivorWallId)!;
	const reversed = survivorBefore.startJunctionId !== joined.startJunctionId;
	const row = {
		returnedFields: Object.keys(plan),
		survivor: plan.survivorWallId,
		retired: plan.retiredWallId,
		survivorReversed: reversed,
		maxPos: Math.max(...flipped.map((r) => r.position)),
		minDot: Math.min(...flipped.map((r) => r.facingDot)),
		naiveNoFlipMaxPos: Math.max(...naive.map((r) => r.position)),
		naiveNoFlipMinDot: Math.min(...naive.map((r) => r.facingDot)),
		tolerance
	};
	log(`${name}-dissolve`, row);
	expect(row.maxPos).toBeLessThanOrEqual(tolerance);
	expect(row.minDot).toBeGreaterThan(1 - tolerance);
	return row;
}

describe('RR-4 Q1 surface transport', () => {
	it('straight 8 m Wall: split at 4, dissolve forward and reversed survivor', () => {
		const { after, created } = splitCase('straight', straightDoc(), JUNCTION_COINCIDENCE_EPSILON);
		const junctionId = wallOf(after, 'W')!.endJunctionId;
		const forward = dissolveCase('straight-forward', after, junctionId, JUNCTION_COINCIDENCE_EPSILON);
		expect(forward.survivorReversed).toBe(false);
		const reversed = dissolveCase('straight-reversed', reversedPair(after, created, junctionId), junctionId, JUNCTION_COINCIDENCE_EPSILON);
		expect(reversed.survivorReversed).toBe(true);
		// Without side transport the panel lands on the opposite face.
		expect(reversed.naiveNoFlipMaxPos).toBeGreaterThan(0.2);
	});

	it('canonical cubic Wall: split at 4, dissolve forward and reversed survivor', () => {
		const doc = curvedDoc();
		const chainLength = arcLength(doc, 'W');
		const { after, created } = splitCase('curved', doc, CURVE_ARC_LENGTH_TOLERANCE);
		log('curved-length', { chainLength });
		const junctionId = wallOf(after, 'W')!.endJunctionId;
		dissolveCase('curved-forward', after, junctionId, CURVE_ARC_LENGTH_TOLERANCE);
		const reversed = dissolveCase('curved-reversed', reversedPair(after, created, junctionId), junctionId, CURVE_ARC_LENGTH_TOLERANCE);
		expect(reversed.survivorReversed).toBe(true);
	});

	it('requested vs resolved split distance on a curve (owner does not return it)', () => {
		const doc = curvedDoc();
		const wall = wallOf(doc, 'W')!;
		if (wall.centerline.kind !== 'cubic-chain') throw new Error('fixture');
		const resolved = resolveWallCurveSplit({ startPoint: [0, 0], endPoint: [8, 0], knots: wall.centerline.knots, spans: wall.centerline.spans }, 4);
		if (resolved.kind !== 'resolved') throw new Error('fixture');
		log('curved-resolved-distance', { requested: 4, resolved: resolved.result.distance, delta: resolved.result.distance - 4 });
		expect(Math.abs(resolved.result.distance - 4)).toBeLessThanOrEqual(CURVE_ARC_LENGTH_TOLERANCE);
	});

	it('Opening at the contact: owner rebases the Opening; the panel overlap is consumer-detected only', () => {
		const doc: LayoutDocumentWallFirst = {
			...straightDoc(),
			openings: [{ id: 'O1', wallId: 'W', kind: 'window', offset: 5.5, width: 1, height: 1.2, sillHeight: 0.9, profile: 'rectangular' }]
		};
		const plan = planWallSplit(doc, 'W', 4, occupancyAllocator);
		if (plan.kind !== 'success') throw new Error(JSON.stringify(plan));
		const moved = transportSplit(plan.document, 'W', plan.createdWallIds[0]!, panels('W').find((p) => p.s === 6)!);
		if (moved.kind !== 'transported') throw new Error('unexpected');
		const opening = plan.document.openings[0]!;
		log('opening-contact', { openingAfter: { wallId: opening.wallId, offset: opening.offset }, panelAfter: { host: moved.binding.hostWallId, s: moved.binding.s }, overOpening: overOpening(plan.document, moved.binding) });
		// Witness agreement: the owner's private Opening rule and the consumer rule match.
		expect(opening.wallId).toBe(moved.binding.hostWallId);
		expect(opening.offset).toBe(moved.binding.s - 0.5);
		expect(overOpening(plan.document, moved.binding)).toBe(true);
		// The owner refuses a split through an Opening interior; a straddling panel gets no owner refusal.
		expect(planWallSplit(doc, 'W', 6, occupancyAllocator).kind).toBe('rejected');
	});
});
