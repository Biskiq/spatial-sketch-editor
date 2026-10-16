/**
 * T1.P01.S02 — the ordinary horizontal Plan representation.
 *
 * The representation is the Layout-owned half of `T1.viewport-projection@1`'s
 * minimal Plan: it reads one compiled Layout and answers, per source, which stream
 * a fragment belongs to, what its Layout-native correspondence is, and why an
 * excluded source was excluded. The suite is deliberately split the way the plan's
 * criteria are:
 *
 * 1. **Real compiled geometry** proves the stream mapping, correspondence,
 *    membership and ordering against the canonical compiler (`cut` walls,
 *    `projected` floor slabs, `symbol` openings) — never a hand-drawn shape.
 * 2. **Constructed candidates** prove the branches the current single-datum format
 *    cannot reach yet (`projected` above the cut, `hidden` below it, an
 *    object's footprint, a Wall with no compiled solids).
 * 3. **Reveal** proves the one rule that a plain filter cannot express: eligibility
 *    is widened, the declared reason is not rewritten, and geometry is not invented.
 *
 * The compiled input is asserted to be unmutated, because the invariant that gives
 * this representation its authority is read-only consumption of the one compiler's
 * output.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	eligiblePlanFragments,
	evaluateLayoutPlan,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	planMembershipOf,
	WALL_AUTHORING_DEFAULT_HEIGHT,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type PlanEvaluation,
	type PlanParameters,
	type PlanSourceContext
} from '@portfolio/layout-core';

/**
 * One closed rectangular Room (4×3 m) with four boundary Walls — the same
 * canonical wall-first shape the kernel suites use, so this suite never invents a
 * second way to build a valid document.
 */
function rectangleDocument(options: { elevation?: number; wallHeight?: number } = {}): LayoutDocumentWallFirst {
	const corners: Array<[string, number, number]> = [
		['j1', 0, 0],
		['j2', 4, 0],
		['j3', 4, 3],
		['j4', 0, 3]
	];
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: options.elevation ?? 0 },
		junctions: corners.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: (
			[
				['w1', 'j1', 'j2'],
				['w2', 'j2', 'j3'],
				['w3', 'j3', 'j4'],
				['w4', 'j4', 'j1']
			] as const
		).map(([id, startJunctionId, endJunctionId]) => ({
			id,
			startJunctionId,
			endJunctionId,
			role: 'boundary' as const,
			thickness: 0.2,
			height: options.wallHeight ?? WALL_AUTHORING_DEFAULT_HEIGHT,
			centerline: { kind: 'line' } as const
		})),
		rooms: [
			{
				id: 'room-a',
				name: 'Room A',
				boundary: [
					{ wallId: 'w1', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [],
		objects: []
	};
}

/** The same document with one 0.9 m door in `w1`, hosting a real Opening interval. */
function withDoor(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	return {
		...document,
		openings: [
			{
				id: 'door-1',
				wallId: 'w1',
				kind: 'door' as const,
				offset: 1,
				width: 0.9,
				height: 2.1,
				sillHeight: 0,
				profile: 'rectangular' as const
			}
		]
	};
}

const OUTPUT_IDENTITY = { generationId: 'gen-1', target: [2, 1.5] as LayoutVec2, datumMeters: 0 };

function parameters(overrides: Partial<PlanParameters> = {}): PlanParameters {
	return {
		cutHeightMeters: 1.2,
		depthMeters: 100,
		lateralSpanHalfWidthMeters: null,
		sourceKindFilter: null,
		reveal: [],
		...overrides
	};
}

function context(overrides: Partial<PlanSourceContext> = {}): PlanSourceContext {
	return { ...OUTPUT_IDENTITY, ...overrides };
}

function evaluation(
	compiled: CompiledLayoutGeometry,
	given: Partial<PlanParameters> = {},
	source: Partial<PlanSourceContext> = {}
): PlanEvaluation {
	const result = evaluateLayoutPlan(compiled, parameters(given), context(source));
	if (result.kind !== 'evaluated') throw new Error(`expected an evaluated plan: ${JSON.stringify(result.issues)}`);
	return result.plan;
}

/**
 * A compiled geometry assembled from explicit records. Used only for the branches
 * the current single-datum format cannot produce yet — never as a substitute for
 * the real compiler, which owns the cases above.
 */
function constructed(parts: Partial<CompiledLayoutGeometry>): CompiledLayoutGeometry {
	return {
		floors: [],
		rooms: [],
		walls: [],
		objects: [],
		queries: { points: [], spans: [], polygons: [], aabbs: [] },
		bounds: null,
		...parts
	};
}

function constructedObject(input: { id: string; minY: number; maxY: number; footprint?: LayoutVec2[] }): CompiledLayoutGeometry['objects'][number] {
	const footprint: LayoutVec2[] = input.footprint ?? [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1]
	];
	return {
		id: input.id,
		cacheKey: `cache-${input.id}`,
		objectId: input.id,
		kind: 'box',
		position: [0.5, input.maxY, 0.5],
		rotation: [0, 0, 0],
		dimensions: [1, input.maxY - input.minY, 1],
		readonly: false,
		worldAabb: { min: [0, input.minY, 0], max: [1, input.maxY, 1] },
		planFootprint: footprint
	};
}

describe('Plan representation over real compiled geometry', () => {
	const compiled = compileWallFirstLayoutGeometry(withDoor(rectangleDocument())).geometry;

	it('places cut Walls, the projected floor slab and the Opening symbol', () => {
		const plan = evaluation(compiled);
		expect(plan.cutElevationMeters).toBeCloseTo(1.2, 12);
		expect(plan.streams.cut.length).toBeGreaterThan(0);
		expect(plan.streams.cut.every((fragment) => fragment.ref.sourceKind === 'wall')).toBe(true);
		expect(plan.streams.cut.every((fragment) => fragment.elevationMeters === plan.cutElevationMeters)).toBe(true);
		// A floor slab sits below the cut plane, so the Plan shows it by projection.
		expect(plan.streams.projected.map((fragment) => fragment.ref.sourceId)).toContain('room-a');
		expect(plan.streams.symbol.map((fragment) => fragment.ref.sourceId)).toContain('door-1');
	});

	it('carries Layout-native correspondence with the caller generation on every fragment', () => {
		const plan = evaluation(compiled);
		for (const fragment of plan.fragments) {
			expect(fragment.ref.generationId).toBe('gen-1');
			expect(fragment.ref.sourceId).not.toBe('');
			expect(['wall', 'opening', 'object', 'room-floor']).toContain(fragment.ref.sourceKind);
			expect(['cut', 'projected', 'hidden', 'symbol']).toContain(fragment.ref.stream);
			if (fragment.ref.subRef !== null) {
				expect(['component', 'interval']).toContain(fragment.ref.subRef.kind);
				if (fragment.ref.subRef.kind === 'interval') {
					expect(Number.isFinite(fragment.ref.subRef.start)).toBe(true);
					expect(fragment.ref.subRef.end).toBeGreaterThan(fragment.ref.subRef.start);
				}
			}
		}
		// The Opening's interval is its authored span along its own Wall.
		const opening = plan.streams.symbol.find((fragment) => fragment.ref.sourceId === 'door-1')!;
		expect(opening.ref.subRef).toEqual({ kind: 'interval', start: 1, end: 1.9 });
	});

	it('keeps a fragment and its source membership together', () => {
		const plan = evaluation(compiled);
		for (const fragment of plan.fragments) {
			const row = planMembershipOf(plan, fragment.ref.sourceId)!;
			expect(fragment.membership).toBe(row.reason);
			expect(row.eligible).toBe(true);
		}
		// Every compiled Wall and Room reports exactly one membership row, even when it
		// contributes several fragments — membership is per source, not per primitive.
		expect(plan.membership.filter((row) => row.sourceKind === 'wall').map((row) => row.sourceId).sort()).toEqual([
			'w1',
			'w2',
			'w3',
			'w4'
		]);
	});

	it('is deterministic and depends on stable identity, not array order', () => {
		const forward = evaluation(compiled);
		const reversed = evaluation({
			...compiled,
			walls: [...compiled.walls].reverse(),
			rooms: [...compiled.rooms].reverse()
		});
		expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
	});

	it('never mutates the compiled input', () => {
		const before = JSON.stringify(compiled);
		evaluation(compiled);
		evaluation(compiled, { sourceKindFilter: ['wall'] as const, reveal: ['w1'] });
		expect(JSON.stringify(compiled)).toBe(before);
	});
});

describe('Plan membership reasons', () => {
	it('reports outside-depth for a source below the depth window', () => {
		const shallow = constructed({ objects: [constructedObject({ id: 'low', minY: 0, maxY: 0.3 })] });
		const plan = evaluation(shallow, { depthMeters: 0.5 });
		const row = planMembershipOf(plan, 'low')!;
		expect(row.reason).toBe('outside-depth');
		expect(row.depthBelowCutMeters).toBeCloseTo(0.9, 12);
		expect(row.eligible).toBe(false);
		expect(plan.fragments).toEqual([]);
		expect(eligiblePlanFragments(plan)).toEqual([]);
	});

	it('reports outside-span only when a lateral span is declared', () => {
		const compiled = compileWallFirstLayoutGeometry(rectangleDocument()).geometry;
		const unbounded = evaluation(compiled);
		expect(unbounded.lateralSpanHalfWidthMeters).toBeNull();
		expect(unbounded.membership.every((row) => row.lateralDistanceMeters === null)).toBe(true);
		expect(unbounded.membership.every((row) => row.reason === 'included')).toBe(true);

		// The target sits in the middle of the 4×3 m room: every Wall is 1.5 m or more
		// away, so a 1 m half-width excludes all four and keeps the floor it contains.
		const bounded = evaluation(compiled, { lateralSpanHalfWidthMeters: 1 });
		expect(bounded.membership.filter((row) => row.reason === 'outside-span').map((row) => row.sourceId).sort()).toEqual([
			'w1',
			'w2',
			'w3',
			'w4'
		]);
		expect(planMembershipOf(bounded, 'room-a')!.reason).toBe('included');
		expect(planMembershipOf(bounded, 'room-a')!.lateralDistanceMeters).toBe(0);
	});

	it('reports no-meaningful-projection for a Wall with no compiled solids', () => {
		const compiled = compileWallFirstLayoutGeometry(rectangleDocument()).geometry;
		const stripped = constructed({
			walls: compiled.walls.map((wall) => ({ ...wall, solidSpans: [], openings: [] }))
		});
		const plan = evaluation(stripped);
		for (const wall of compiled.walls) {
			expect(planMembershipOf(plan, wall.wallId)!.reason).toBe('no-meaningful-projection');
		}
		expect(plan.fragments).toEqual([]);
	});

	it('places a source above the cut plane in projected and below it in hidden', () => {
		const high = constructed({ objects: [constructedObject({ id: 'high', minY: 2, maxY: 3 })] });
		expect(planMembershipOf(evaluation(high), 'high')!.reason).toBe('included');
		expect(evaluation(high).streams.projected.map((fragment) => fragment.ref.sourceId)).toEqual(['high']);

		const low = constructed({ objects: [constructedObject({ id: 'low', minY: 0, maxY: 0.3 })] });
		expect(evaluation(low).streams.hidden.map((fragment) => fragment.ref.sourceId)).toEqual(['low']);

		const straddling = constructed({ objects: [constructedObject({ id: 'mid', minY: 1, maxY: 2 })] });
		const midPlan = evaluation(straddling);
		expect(midPlan.streams.cut.map((fragment) => fragment.ref.sourceId)).toEqual(['mid']);
		expect(midPlan.streams.cut[0]!.elevationMeters).toBe(midPlan.cutElevationMeters);
	});
});

describe('Plan reveal', () => {
	const compiled = compileWallFirstLayoutGeometry(rectangleDocument()).geometry;

	it('reports filtered-type and reveals eligibility without rewriting the reason', () => {
		const filtered = evaluation(compiled, { sourceKindFilter: ['room-floor'] as const });
		expect(planMembershipOf(filtered, 'w1')!.reason).toBe('filtered-type');
		expect(planMembershipOf(filtered, 'w1')!.eligible).toBe(false);
		expect(filtered.fragments.every((fragment) => fragment.ref.sourceKind === 'room-floor')).toBe(true);

		const revealed = evaluation(compiled, { sourceKindFilter: ['room-floor'] as const, reveal: ['w1'] });
		const row = planMembershipOf(revealed, 'w1')!;
		expect(row.reason).toBe('filtered-type');
		expect(row.revealed).toBe(true);
		expect(row.eligible).toBe(true);
		expect(revealed.fragments.some((fragment) => fragment.ref.sourceId === 'w1')).toBe(true);
		// Reveal is a union of declared source identities: an unknown id is ignored and reported.
		expect(revealed.unmatchedRevealIds).toEqual([]);
		const unknown = evaluation(compiled, { reveal: ['nobody'] });
		expect(unknown.unmatchedRevealIds).toEqual(['nobody']);
		expect(unknown.membership.every((rule) => rule.revealed === false)).toBe(true);
	});

	it('does not invent geometry for a revealed source that has none', () => {
		const stripped = constructed({
			walls: compiled.walls.map((wall) => ({ ...wall, solidSpans: [], openings: [] }))
		});
		const plan = evaluation(stripped, { reveal: ['w1'] });
		const row = planMembershipOf(plan, 'w1')!;
		expect(row.revealed).toBe(true);
		expect(row.eligible).toBe(true);
		expect(row.reason).toBe('no-meaningful-projection');
		expect(plan.fragments).toEqual([]);
	});

	it('keeps a revealed source inside the depth window it was measured against', () => {
		const shallow = constructed({ objects: [constructedObject({ id: 'low', minY: 0, maxY: 0.3 })] });
		const plan = evaluation(shallow, { depthMeters: 0.5, reveal: ['low'] });
		expect(plan.depthMeters).toBe(0.5);
		expect(planMembershipOf(plan, 'low')!.reason).toBe('outside-depth');
		expect(plan.streams.hidden.map((fragment) => fragment.ref.sourceId)).toEqual(['low']);
	});
});

describe('Plan parameter boundary', () => {
	const compiled = compileWallFirstLayoutGeometry(rectangleDocument()).geometry;

	it('refuses a missing or non-positive depth', () => {
		for (const depthMeters of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			const result = evaluateLayoutPlan(compiled, parameters({ depthMeters }), context());
			expect(result.kind).toBe('refused');
			if (result.kind === 'refused') expect(result.code).toBe('invalid-parameters');
		}
	});

	it('refuses non-finite parameters and an empty lateral span', () => {
		for (const overrides of [
			{ cutHeightMeters: Number.NaN },
			{ lateralSpanHalfWidthMeters: 0 },
			{ lateralSpanHalfWidthMeters: Number.NEGATIVE_INFINITY },
			{ sourceKindFilter: [] as const }
		]) {
			const result = evaluateLayoutPlan(compiled, parameters(overrides), context());
			expect(result.kind).toBe('refused');
		}
	});

	it('refuses an invalid context separately from invalid parameters', () => {
		const result = evaluateLayoutPlan(compiled, parameters(), context({ generationId: ' ' }));
		expect(result.kind).toBe('refused');
		if (result.kind === 'refused') expect(result.code).toBe('invalid-context');
		for (const bad of [
			context({ target: [Number.NaN, 0] as LayoutVec2 }),
			context({ datumMeters: Number.POSITIVE_INFINITY })
		]) {
			const refused = evaluateLayoutPlan(compiled, parameters(), bad);
			expect(refused.kind).toBe('refused');
			if (refused.kind === 'refused') expect(refused.code).toBe('invalid-context');
		}
	});

	it('takes the cut height relative to the level datum', () => {
		const raised = compileWallFirstLayoutGeometry(rectangleDocument({ elevation: 2 })).geometry;
		const plan = evaluation(raised, { cutHeightMeters: 1.2 }, { datumMeters: 2 });
		expect(plan.cutElevationMeters).toBeCloseTo(3.2, 12);
		// The walls reach the raised datum too, so the cut plane still passes through them.
		expect(plan.streams.cut.length).toBeGreaterThan(0);
	});
});
