/**
 * T1.P02.S06 — Plan interaction locality against the compiler's persistent roots.
 *
 * The retainer's earlier guarantee was "no sort, and only the changed sources are
 * re-derived", but it reached that by **reading the complete compiled arrays** and by
 * producing the complete output on every evaluation. Both were assumptions, not
 * measurements, and both are now testable:
 *
 * - `compiled.walls`/`compiled.rooms` are lazy views of persistent vectors, so touching
 *   them is visible as `materialize:*` work. The complete walk must not touch them.
 * - an accepted edit is a new compile generation, but `compiled.fragments` is only one
 *   consumer's view of the output. An evaluation that never reads it must not produce it.
 * - the changed set must come from the compiler's own root difference, so a one-Wall
 *   edit must not re-derive its neighbours.
 *
 * Everything here is a deterministic work count or an exact-output differential. No
 * timing, no benchmark, no profiler.
 */
import { describe, expect, it } from 'vitest';
import {
	createLayoutCompileSession,
	createPlanRetainer,
	evaluateLayoutPlan,
	planFragmentOf,
	planMembershipOf,
	setWorkObserver,
	type CompiledLayoutGeometry,
	type PlanEvaluationResult
} from '@portfolio/layout-core';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';

/** Run `work` with a counting observer, and return the counts it produced. */
function observe<T>(work: () => T): { result: T; counts: Map<string, number> } {
	const counts = new Map<string, number>();
	const previous = setWorkObserver({
		span() {},
		count(name, amount) {
			counts.set(name, (counts.get(name) ?? 0) + amount);
		}
	});
	try {
		return { result: work(), counts };
	} finally {
		setWorkObserver(previous);
	}
}

function count(counts: Map<string, number>, name: string): number {
	return counts.get(name) ?? 0;
}

/** A document with one Wall's authored height changed — a single-source content edit. */
function withTallerWall(document: ReturnType<typeof buildScaleFixture>, index: number) {
	return {
		...document,
		walls: document.walls.map((wall, at) =>
			at === index ? { ...wall, height: wall.height + 0.4 } : wall
		)
	};
}

function evaluated(result: PlanEvaluationResult) {
	if (result.kind !== 'evaluated') throw new Error(`expected an evaluated plan: ${JSON.stringify(result.issues)}`);
	return result.plan;
}

const PARAMETERS = {
	cutHeightMeters: 1.2,
	depthMeters: 100,
	lateralSpanHalfWidthMeters: null,
	sourceKindFilter: null,
	reveal: []
};

describe('Plan locality against the compiler roots', () => {
	it('walks the retained Wall root without materializing the legacy arrays', () => {
		const document = buildScaleFixture({ ...SCALE_FIXTURE_SEEDS.small, roomCount: 10 });
		const session = createLayoutCompileSession();
		const compiled = session.compile(document).geometry;
		const retainer = createPlanRetainer();
		const { result, counts } = observe(() =>
			retainer.evaluate(compiled, PARAMETERS, { generationId: 'gen-1', target: [0, 0], datumMeters: 0 })
		);
		// The evaluation happened…
		expect(evaluated(result).generationId).toBe('gen-1');
		// …without flattening either legacy array.
		expect(count(counts, 'materialize:compiled-walls:slots')).toBe(0);
		expect(count(counts, 'materialize:compiled-rooms:slots')).toBe(0);
		// And without producing the complete output nobody asked for.
		expect(count(counts, 'plan:output-fragments')).toBe(0);
		expect(count(counts, 'plan:output-membership')).toBe(0);
		// The cold path is the complete walk, and says so.
		expect(count(counts, 'plan:source-compared')).toBeGreaterThan(0);
		expect(count(counts, 'plan:source-delta-applied')).toBe(0);
	});

	/** One Wall's authored height changed, then compiled in the same session. */
	function editOneWall(roomCount: number) {
		const document = buildScaleFixture({ ...SCALE_FIXTURE_SEEDS.small, roomCount });
		const session = createLayoutCompileSession();
		const first = session.compile(document).geometry;
		const retainer = createPlanRetainer();
		retainer.evaluate(first, PARAMETERS, { generationId: 'gen-1', target: [0, 0], datumMeters: 0 });
		const second = session.compile(withTallerWall(document, 4)).geometry;
		const { result, counts } = observe(() =>
			retainer.evaluate(second, PARAMETERS, { generationId: 'gen-2', target: [0, 0], datumMeters: 0 })
		);
		return { second, result, counts };
	}

	it('re-derives a constant number of sources, however large the project is', () => {
		const small = editOneWall(10);
		const large = editOneWall(40);

		// Exactly the edited Wall: the compiler's own root difference says which compiled
		// records were replaced, and only that record's derivation has to be rebuilt — its
		// Openings and the Room around it are separate records the change did not reach.
		expect(count(small.counts, 'plan:source-derived')).toBe(1);
		expect(count(large.counts, 'plan:source-derived')).toBe(1);
		expect(count(small.counts, 'plan:source-derived:wall')).toBe(1);
		expect(count(large.counts, 'plan:source-derived:wall')).toBe(1);
		expect(large.second.walls.length).toBeGreaterThan(small.second.walls.length * 2);

		// The proof that matters: the compiler's own root difference replaced the walk, so
		// **no unrelated source was even compared** at either size.
		for (const measured of [small, large]) {
			expect(count(measured.counts, 'plan:source-delta-applied')).toBe(1);
			expect(count(measured.counts, 'plan:source-compared')).toBe(0);
		}

		// No complete walk and no legacy-array materialization at either size.
		for (const measured of [small, large]) {
			expect(count(measured.counts, 'materialize:compiled-walls:slots')).toBe(0);
			expect(count(measured.counts, 'materialize:compiled-rooms:slots')).toBe(0);
			expect(count(measured.counts, 'plan:output-fragments')).toBe(0);
		}

		// Exactness against the canonical implementation for the same snapshot.
		const reference = evaluateLayoutPlan(large.second, PARAMETERS, {
			generationId: 'gen-2',
			target: [0, 0],
			datumMeters: 0
		});
		expect(large.result).toEqual(reference);
	});

	/** One Wall appended: a membership change no root difference can prove. */
	function insertOneWall(roomCount: number) {
		const document = buildScaleFixture({ ...SCALE_FIXTURE_SEEDS.small, roomCount });
		const session = createLayoutCompileSession();
		const first = session.compile(document).geometry;
		const retainer = createPlanRetainer();
		retainer.evaluate(first, PARAMETERS, { generationId: 'gen-1', target: [0, 0], datumMeters: 0 });
		const added = { ...document.walls[0]!, id: 'inserted-wall' };
		const second = session.compile({ ...document, walls: [...document.walls, added] }).geometry;
		const { result, counts } = observe(() =>
			retainer.evaluate(second, PARAMETERS, { generationId: 'gen-2', target: [0, 0], datumMeters: 0 })
		);
		return { second, result, counts };
	}

	it('re-derives a constant number of sources when the delta cannot be proved', () => {
		// An insertion shifts every later compiled slot, so the roots cannot be compared
		// position by position and the retainer must take the complete walk. The walk's
		// per-source predicate is then the only thing between one edit and N derivations —
		// and it has to survive Walls whose solid spans share an interval at two elevations,
		// which an index-paired comparison cannot prove unchanged.
		const small = insertOneWall(10);
		const large = insertOneWall(40);
		expect(count(large.counts, 'plan:source-compared')).toBeGreaterThan(0);
		expect(count(small.counts, 'plan:source-delta-applied')).toBe(0);
		expect(count(large.counts, 'plan:source-derived')).toBe(
			count(small.counts, 'plan:source-derived')
		);
		expect(count(large.counts, 'plan:source-derived')).toBeLessThan(4);

		// …and the complete output is still exactly the canonical one.
		const reference = evaluateLayoutPlan(large.second, PARAMETERS, {
			generationId: 'gen-2',
			target: [0, 0],
			datumMeters: 0
		});
		expect(large.result).toEqual(reference);
	});

	it('serves the two per-frame questions without materializing the output', () => {
		const document = buildScaleFixture({ ...SCALE_FIXTURE_SEEDS.small, roomCount: 10 });
		const session = createLayoutCompileSession();
		const first = session.compile(document).geometry;
		const retainer = createPlanRetainer();
		retainer.evaluate(first, PARAMETERS, { generationId: 'gen-1', target: [0, 0], datumMeters: 0 });

		const second = session.compile(withTallerWall(document, 6)).geometry;
		const plan = evaluated(
			retainer.evaluate(second, PARAMETERS, { generationId: 'gen-2', target: [0, 0], datumMeters: 0 })
		);
		const sourceId = plan.membership.length > 0 ? plan.membership[0]!.sourceId : second.walls[0]!.wallId;
		const probe = observe(() => {
			const fragment = planFragmentOf(plan, sourceId);
			const row = planMembershipOf(plan, sourceId);
			return { fragment, row };
		});
		expect(probe.result.row).not.toBeNull();
		// The fragment is generation-qualified without the whole array existing.
		expect(probe.result.fragment?.ref.generationId).toBe('gen-2');
		expect(count(probe.counts, 'plan:output-fragments')).toBe(0);
		expect(count(probe.counts, 'plan:output-membership')).toBe(0);

		// A consumer that does ask for the complete output gets exactly that, once.
		const materialized = observe(() => plan.fragments);
		expect(count(materialized.counts, 'plan:output-fragments')).toBe(materialized.result.length);
		expect(materialized.result.every((fragment) => fragment.ref.generationId === 'gen-2')).toBe(true);
		// …and asking again is free.
		const again = observe(() => plan.fragments);
		expect(count(again.counts, 'plan:output-fragments')).toBe(0);
	});

	it('keeps a returned plan describing its own generation after a newer evaluation', () => {
		// The output is materialized lazily, so a plan can be read after the retainer has
		// evaluated a newer generation. It must still describe the sources it was assembled
		// from — not the newer ones under the older generation — which means the assembled
		// evaluation captures its own view instead of reading the retainer's live index.
		const document = buildScaleFixture({ ...SCALE_FIXTURE_SEEDS.small, roomCount: 10 });
		const session = createLayoutCompileSession();
		const first = session.compile(document).geometry;
		const retainer = createPlanRetainer();
		const older = evaluated(
			retainer.evaluate(first, PARAMETERS, { generationId: 'gen-1', target: [0, 0], datumMeters: 0 })
		);
		// A **parameter** change is the loudest case: every source is re-derived, so a plan that
		// read the retainer's live index would report the newer cut's placements under its own
		// generation.
		const newer = evaluated(
			retainer.evaluate(
				first,
				{ ...PARAMETERS, cutHeightMeters: 2.6 },
				{ generationId: 'gen-2', target: [0, 0], datumMeters: 0 }
			)
		);
		const reference = evaluateLayoutPlan(first, PARAMETERS, {
			generationId: 'gen-1',
			target: [0, 0],
			datumMeters: 0
		});
		if (reference.kind !== 'evaluated') throw new Error('expected an evaluated reference');

		// The newer plan really differs, so this is not comparing two equal plans.
		expect(newer.cutHeightMeters).toBe(2.6);
		expect(newer.fragments).not.toEqual(reference.plan.fragments);
		expect(older.fragments).toEqual(reference.plan.fragments);
		expect(older.membership).toEqual(reference.plan.membership);
		expect(older.bounds).toEqual(reference.plan.bounds);
		expect(older.streams).toEqual(reference.plan.streams);
		expect(older.fragments.every((fragment) => fragment.ref.generationId === 'gen-1')).toBe(true);

		// …including the two per-frame questions asked from the source index.
		const sourceId = document.walls[4]!.id;
		expect(planFragmentOf(older, sourceId)).toEqual(planFragmentOf(reference.plan, sourceId));
		expect(planMembershipOf(older, sourceId)).toEqual(planMembershipOf(reference.plan, sourceId));
	});

	it('stays exact when the compiler cannot prove a delta', () => {
		// Hand-built geometry has no retained world, so both the walk and the delta must
		// fall back — and the result must still be the reference result.
		const handBuilt: CompiledLayoutGeometry = {
			floors: [],
			rooms: [],
			walls: [],
			objects: [
				{
					id: 'o1',
					cacheKey: 'cache-o1',
					objectId: 'o1',
					kind: 'box',
					position: [0.5, 1, 0.5],
					rotation: [0, 0, 0],
					dimensions: [1, 1, 1],
					readonly: false,
					worldAabb: { min: [0, 0, 0], max: [1, 1, 1] },
					planFootprint: [
						[0, 0],
						[1, 0],
						[1, 1],
						[0, 1]
					]
				}
			],
			queries: { points: [], spans: [], polygons: [], aabbs: [] },
			bounds: null
		};
		const retainer = createPlanRetainer();
		const context = { generationId: 'gen-1', target: [0, 0] as [number, number], datumMeters: 0 };
		expect(retainer.evaluate(handBuilt, PARAMETERS, context)).toEqual(
			evaluateLayoutPlan(handBuilt, PARAMETERS, context)
		);
		// A second generation over the same hand-built geometry keeps matching.
		const next = { ...context, generationId: 'gen-2' };
		expect(retainer.evaluate(handBuilt, PARAMETERS, next)).toEqual(
			evaluateLayoutPlan(handBuilt, PARAMETERS, next)
		);
	});
});
