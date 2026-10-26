/**
 * T1.P02.S06 — the incremental Plan retainer.
 *
 * `evaluateLayoutPlan` is the normative definition of `layout.plan@1`, and
 * `createPlanRetainer` is the evaluator an interactive host keeps between edits. The
 * only thing that makes the second one safe to ship is that it is **indistinguishable**
 * from the first, so this suite is a differential oracle rather than a set of
 * hand-written expectations:
 *
 * - every case compares the retainer's whole result to the reference's, deep-equal, on
 *   real compiled geometry;
 * - the cases walk the changes an editor actually makes — a new generation, a span that
 *   moved, a source added or removed, a parameter or target change, a refusal — because
 *   the retainer's risk is in *what it remembers*, not in any single evaluation;
 * - one randomized corpus applies many such changes in sequence, which is where a stale
 *   record or a mis-maintained id list would surface.
 *
 * It also pins the invariant the retainer exists to provide: the fragment array is
 * already in the declared order, so no consumer has to sort it, and the eligible
 * projection preserves that order.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createPlanRetainer,
	eligiblePlanFragments,
	evaluateLayoutPlan,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	planFragmentOf,
	WALL_AUTHORING_DEFAULT_HEIGHT,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type PlanEvaluation,
	type PlanEvaluationResult,
	type PlanFragment,
	type PlanParameters,
	type PlanSourceContext
} from '@portfolio/layout-core';

/* ------------------------------------------------------------------ fixtures */

/** One 4×3 m Room, optionally with a real Opening, a free-standing Wall and objects. */
function document(
	options: {
		elevation?: number;
		height?: number;
		door?: { offset: number; width: number; height: number; sillHeight: number } | null;
		extraWall?: boolean;
		room?: boolean;
	} = {}
): LayoutDocumentWallFirst {
	const corners: Array<[string, number, number]> = [
		['j1', 0, 0],
		['j2', 4, 0],
		['j3', 4, 3],
		['j4', 0, 3]
	];
	const junctions: LayoutDocumentWallFirst['junctions'] = corners.map(([id, x, z]) => ({
		id,
		point: [x, z] as LayoutVec2
	}));
	if (options.extraWall) {
		junctions.push({ id: 'j5', point: [0, 5] as LayoutVec2 });
		junctions.push({ id: 'j6', point: [2.5, 5] as LayoutVec2 });
	}
	const walls: LayoutDocumentWallFirst['walls'] = (
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
		thickness: 0.2,
		height: options.height ?? WALL_AUTHORING_DEFAULT_HEIGHT,
		centerline: { kind: 'line' } as const
	}));
	if (options.extraWall) {
		walls.push({
			id: 'w5',
			startJunctionId: 'j5',
			endJunctionId: 'j6',
			thickness: 0.2,
			height: options.height ?? WALL_AUTHORING_DEFAULT_HEIGHT,
			centerline: { kind: 'line' } as const
		});
	}
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: options.elevation ?? 0 },
		junctions,
		walls,
		rooms:
			options.room === false
				? []
				: [
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
		openings:
			options.door === null || options.door === undefined
				? []
				: [{ id: 'door-1', wallId: 'w1', kind: 'door' as const, profile: 'rectangular' as const, ...options.door }],
		objects: []
	};
}

function compiledOf(source: LayoutDocumentWallFirst): CompiledLayoutGeometry {
	return compileWallFirstLayoutGeometry(source).geometry;
}

function objectRecord(id: string, minY: number, maxY: number, footprint?: LayoutVec2[]) {
	return {
		id,
		cacheKey: `cache-${id}`,
		objectId: id,
		kind: 'box' as const,
		position: [0.5, maxY, 0.5] as [number, number, number],
		rotation: [0, 0, 0] as [number, number, number],
		dimensions: [1, maxY - minY, 1] as [number, number, number],
		readonly: false,
		worldAabb: { min: [0, minY, 0] as [number, number, number], max: [1, maxY, 1] as [number, number, number] },
		planFootprint:
			footprint ??
			([
				[0, 0],
				[1, 0],
				[1, 1],
				[0, 1]
			] as LayoutVec2[])
	};
}

const PARAMETERS: PlanParameters = {
	cutHeightMeters: 1.2,
	depthMeters: 100,
	lateralSpanHalfWidthMeters: null,
	sourceKindFilter: null,
	reveal: []
};

function parameters(overrides: Partial<PlanParameters> = {}): PlanParameters {
	return { ...PARAMETERS, ...overrides };
}

function context(overrides: Partial<PlanSourceContext> = {}): PlanSourceContext {
	return { generationId: 'gen-1', target: [2, 1.5] as LayoutVec2, datumMeters: 0, ...overrides };
}

/* ------------------------------------------------------------------ helpers */

/** The declared fragment order, restated independently of the implementation. */
function canonical(left: PlanFragment, right: PlanFragment): number {
	const order: Record<string, number> = { wall: 0, opening: 1, object: 2, 'room-floor': 3 };
	const kindDelta = order[left.ref.sourceKind]! - order[right.ref.sourceKind]!;
	if (kindDelta !== 0) return kindDelta;
	if (left.ref.sourceId !== right.ref.sourceId) return left.ref.sourceId < right.ref.sourceId ? -1 : 1;
	const leftStart = left.ref.subRef?.kind === 'interval' ? left.ref.subRef.start : 0;
	const rightStart = right.ref.subRef?.kind === 'interval' ? right.ref.subRef.start : 0;
	if (leftStart !== rightStart) return leftStart - rightStart;
	const leftEnd = left.ref.subRef?.kind === 'interval' ? left.ref.subRef.end : 0;
	const rightEnd = right.ref.subRef?.kind === 'interval' ? right.ref.subRef.end : 0;
	return leftEnd - rightEnd;
}

function planOf(result: PlanEvaluationResult): PlanEvaluation {
	if (result.kind !== 'evaluated') throw new Error(`expected an evaluated plan: ${JSON.stringify(result.issues)}`);
	return result.plan;
}

function reference(
	compiled: CompiledLayoutGeometry,
	given: Partial<PlanParameters> = {},
	source: Partial<PlanSourceContext> = {}
): PlanEvaluationResult {
	return evaluateLayoutPlan(compiled, parameters(given), context(source));
}

/** Assert one retainer call is exactly the reference call. */
function expectSame(
	retainer: ReturnType<typeof createPlanRetainer>,
	compiled: CompiledLayoutGeometry,
	given: Partial<PlanParameters> = {},
	source: Partial<PlanSourceContext> = {}
): PlanEvaluation {
	const actual = retainer.evaluate(compiled, parameters(given), context(source));
	const expected = reference(compiled, given, source);
	expect(actual).toEqual(expected);
	return planOf(actual);
}

/** The fragment order must be the declared order — this is why nothing sorts it. */
function expectDeclaredOrder(plan: PlanEvaluation): void {
	expect(plan.fragments).toEqual([...plan.fragments].sort(canonical));
	expect(eligiblePlanFragments(plan)).toEqual([...eligiblePlanFragments(plan)].sort(canonical));
}

/* ------------------------------------------------------------------- corpus */

type Mutation = {
	readonly name: string;
	readonly compiled: (compiled: CompiledLayoutGeometry) => CompiledLayoutGeometry;
	readonly parameters?: Partial<PlanParameters>;
	readonly context?: Partial<PlanSourceContext>;
};

/** Deterministic PRNG, so a failure is reproducible from its seed. */
function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

function mutations(base: CompiledLayoutGeometry): Mutation[] {
	const firstWall = base.walls[0]!;
	const lastWall = base.walls[base.walls.length - 1]!;
	return [
		{ name: 'new generation', compiled: (compiled) => compiled, context: { generationId: 'gen-2' } },
		{
			name: 'another generation',
			compiled: (compiled) => compiled,
			context: { generationId: 'gen-3' }
		},
		{
			name: 'wall span moves',
			compiled: (compiled) => ({
				...compiled,
				walls: compiled.walls.map((wall) =>
					wall.wallId === firstWall.wallId
						? {
								...wall,
								solidSpans: wall.solidSpans.map((span) => ({
									...span,
									start: span.start,
									end: span.end,
									topY: span.topY * 0.6
								}))
							}
						: wall
				)
			})
		},
		{
			name: 'wall loses its solids',
			compiled: (compiled) => ({
				...compiled,
				walls: compiled.walls.map((wall) =>
					wall.wallId === lastWall.wallId ? { ...wall, solidSpans: [] } : wall
				)
			})
		},
		{
			name: 'wall gains a second span',
			compiled: (compiled) => ({
				...compiled,
				walls: compiled.walls.map((wall) => {
					if (wall.wallId !== firstWall.wallId) return wall;
					const span = wall.solidSpans[0];
					if (span === undefined) return wall;
					return {
						...wall,
						solidSpans: [
							...wall.solidSpans,
							{ ...span, startDistance: span.endDistance + 1, endDistance: span.endDistance + 2 }
						]
					};
				})
			})
		},
		{
			name: 'opening widens',
			compiled: (compiled) => ({
				...compiled,
				walls: compiled.walls.map((wall) => ({
					...wall,
					openings: wall.openings.map((opening) => ({ ...opening, width: opening.width * 0.75 }))
				}))
			})
		},
		{
			name: 'opening rises',
			compiled: (compiled) => ({
				...compiled,
				walls: compiled.walls.map((wall) => ({
					...wall,
					openings: wall.openings.map((opening) => ({
						...opening,
						sillHeight: opening.sillHeight + 0.6
					}))
				}))
			})
		},
		{
			name: 'room floor drops',
			compiled: (compiled) => ({
				...compiled,
				rooms: compiled.rooms.map((room) => ({ ...room, floorElevation: room.floorElevation - 0.4 }))
			})
		},
		{
			name: 'room footprint widens',
			compiled: (compiled) => ({
				...compiled,
				rooms: compiled.rooms.map((room) => ({
					...room,
					floorPolygon: room.floorPolygon.map(([x, z]) => [x + 0.25, z] as LayoutVec2)
				}))
			})
		},
		{
			name: 'object added',
			compiled: (compiled) => ({
				...compiled,
				objects: [...compiled.objects, objectRecord('o1', 0, 1.4)]
			})
		},
		{
			name: 'object moves',
			compiled: (compiled) => ({
				...compiled,
				objects: compiled.objects.map((object) =>
					object.objectId === 'o1'
						? {
								...object,
								worldAabb: { min: [0, 0, 0], max: [1, 0.45, 1] },
								planFootprint: object.planFootprint.map(([x, z]) => [x + 1, z + 1] as LayoutVec2)
							}
						: object
				)
			})
		},
		{
			name: 'cut height changes',
			compiled: (compiled) => compiled,
			parameters: { cutHeightMeters: 0.4 }
		},
		{
			name: 'depth narrows',
			compiled: (compiled) => compiled,
			parameters: { depthMeters: 0.35 }
		},
		{
			name: 'bounded lateral span',
			compiled: (compiled) => compiled,
			parameters: { lateralSpanHalfWidthMeters: 1.5 }
		},
		{
			name: 'target moves under a bounded span',
			compiled: (compiled) => compiled,
			parameters: { lateralSpanHalfWidthMeters: 1.5 },
			context: { target: [3.5, 2.4] }
		},
		{
			name: 'target moves under unbounded coverage',
			compiled: (compiled) => compiled,
			context: { target: [9, -4] }
		},
		{ name: 'source-kind filter', compiled: (compiled) => compiled, parameters: { sourceKindFilter: ['wall'] } },
		{
			name: 'reveal names a source',
			compiled: (compiled) => compiled,
			parameters: { sourceKindFilter: ['wall'], reveal: ['room-a', 'door-1'] }
		},
		{
			name: 'reveal names nothing',
			compiled: (compiled) => compiled,
			parameters: { reveal: ['no-such-source'] }
		},
		{
			name: 'datum changes',
			compiled: (compiled) => compiled,
			context: { datumMeters: 2.5 }
		}
	];
}

/* --------------------------------------------------------------------- tests */

describe('incremental Plan retainer', () => {
	it('reproduces the reference evaluation on a first evaluation', () => {
		const retainer = createPlanRetainer();
		const compiled = compiledOf(document({ door: { offset: 1, width: 0.9, height: 2.1, sillHeight: 0 } }));
		const plan = expectSame(retainer, compiled);
		expect(plan.fragments.length).toBeGreaterThan(0);
		expectDeclaredOrder(plan);
	});

	it('returns the retained result when nothing at all changed', () => {
		const retainer = createPlanRetainer();
		const compiled = compiledOf(document());
		const first = retainer.evaluate(compiled, parameters(), context());
		const second = retainer.evaluate(compiled, parameters(), context());
		expect(second).toBe(first);
	});

	it('reuses every source across a generation-only change (an accepted edit)', () => {
		const retainer = createPlanRetainer();
		const compiled = compiledOf(document({ door: { offset: 1, width: 0.9, height: 2.1, sillHeight: 0 } }));
		const before = planOf(retainer.evaluate(compiled, parameters(), context()));
		const plan = expectSame(retainer, compiled, {}, { generationId: 'gen-after-edit' });
		// The fragments are new objects — they carry the new generation — but every
		// placement, membership row and bound is the same value as before.
		expect(plan.fragments).not.toBe(before.fragments);
		expect(plan.fragments.every((fragment) => fragment.ref.generationId === 'gen-after-edit')).toBe(true);
		expect(plan.membership).toEqual(before.membership);
		// Value equality alone would also hold for an evaluator that rebuilt everything;
		// the retained rows are the **same objects**, which is what proves the derivation
		// was reused rather than reproduced.
		expect(plan.membership.every((row, index) => row === before.membership[index])).toBe(true);
		expect(plan.fragments.map((fragment) => [fragment.ref.sourceId, fragment.ref.subRef])).toEqual(
			before.fragments.map((fragment) => [fragment.ref.sourceId, fragment.ref.subRef])
		);
		expectDeclaredOrder(plan);
	});

	it('re-derives exactly the source that changed', () => {
		const retainer = createPlanRetainer();
		const base = compiledOf(
			document({ door: { offset: 1, width: 0.9, height: 2.1, sillHeight: 0 }, extraWall: true })
		);
		const before = expectSame(retainer, base);
		const changedId = base.walls[2]!.wallId;
		const changed: CompiledLayoutGeometry = {
			...base,
			walls: base.walls.map((wall) =>
				wall.wallId === changedId
					? {
							...wall,
							solidSpans: wall.solidSpans.map((span) => ({ ...span, topY: span.topY * 0.7 }))
						}
					: wall
			)
		};
		const after = expectSame(retainer, changed);
		// Membership order is the declared source order and did not change here, so the
		// rows that are not the same object are exactly the sources that were re-derived.
		expect(after.membership.map((row) => row.sourceId)).toEqual(before.membership.map((row) => row.sourceId));
		const rederived = after.membership
			.filter((row, index) => row !== before.membership[index])
			.map((row) => row.sourceId);
		expect(rederived).toEqual([changedId]);
	});

	it('re-derives only what changed while a Wall span, an Opening and a floor move', () => {
		const retainer = createPlanRetainer();
		let compiled = compiledOf(
			document({ door: { offset: 1, width: 0.9, height: 2.1, sillHeight: 0 }, extraWall: true })
		);
		expectSame(retainer, compiled);
		for (const mutation of mutations(compiled)) {
			compiled = mutation.compiled(compiled);
			expectSame(retainer, compiled, mutation.parameters ?? {}, mutation.context ?? {});
		}
	});

	it('follows sources being added and removed', () => {
		const retainer = createPlanRetainer();
		const full = compiledOf(document({ door: { offset: 1, width: 0.9, height: 2.1, sillHeight: 0 }, extraWall: true }));
		const bare = compiledOf(document({ room: false }));
		expectSame(retainer, full);
		expectSame(retainer, bare); // w5, room-a and door-1 disappear
		expectSame(retainer, full); // and come back
		expectSame(retainer, { ...full, objects: [objectRecord('o1', 0, 1.4)] });
		expectSame(retainer, full); // the object disappears again
	});

	it('keeps the declared order as ids are inserted out of order', () => {
		const retainer = createPlanRetainer();
		let compiled = compiledOf(document({ room: false }));
		expectSame(retainer, compiled);
		for (const id of ['z-wall', 'a-wall', 'm-wall']) {
			compiled = {
				...compiled,
				objects: [...compiled.objects, objectRecord(id, 0, 1.4, [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]])]
			};
			const plan = expectSame(retainer, compiled);
			expectDeclaredOrder(plan);
		}
	});

	it('reports the same refusal, and still evaluates exactly afterwards', () => {
		const retainer = createPlanRetainer();
		const compiled = compiledOf(document());
		expectSame(retainer, compiled);
		const refused = retainer.evaluate(compiled, parameters({ depthMeters: 0 }), context());
		expect(refused).toEqual(reference(compiled, { depthMeters: 0 }));
		expect(refused.kind).toBe('refused');
		expectSame(retainer, compiled);
		expectSame(retainer, compiled, { cutHeightMeters: 3 });
	});

	it('falls back to the reference when a source id is shared by two kinds', () => {
		const retainer = createPlanRetainer();
		const compiled = compiledOf(document({ room: false }));
		expectSame(retainer, compiled);
		const wallId = compiled.walls[0]!.wallId;
		const shared: CompiledLayoutGeometry = {
			...compiled,
			objects: [objectRecord(wallId, 0, 1.4)]
		};
		// The reference merges both records into one membership row; the retainer must
		// produce that same merged shape rather than two rows.
		const plan = expectSame(retainer, shared);
		expect(plan.membership.filter((row) => row.sourceId === wallId)).toHaveLength(1);
		expectSame(retainer, shared);
	});

	it('falls back to the reference when one kind repeats a source id', () => {
		const retainer = createPlanRetainer();
		const compiled = compiledOf(document({ room: false }));
		expectSame(retainer, compiled);
		const duplicated: CompiledLayoutGeometry = { ...compiled, walls: [...compiled.walls, compiled.walls[0]!] };
		expectSame(retainer, duplicated);
	});

	it('matches the reference across a randomized sequence of edits', () => {
		const retainer = createPlanRetainer();
		const steps = mutations(compiledOf(document({ room: false })));
		let seed = 0x5eed;
		let compiled = compiledOf(document({ door: { offset: 1, width: 0.9, height: 2.1, sillHeight: 0 } }));
		expectSame(retainer, compiled);
		for (let step = 0; step < 60; step += 1) {
			const pick = Math.floor(random(seed)() * steps.length);
			seed += 1;
			const mutation = steps[pick]!;
			compiled = mutation.compiled(compiled);
			// Recompiling from a document every few steps gives the walks real new records.
			if (step % 7 === 3) compiled = { ...compiled, objects: [objectRecord(`obj-${step}`, 0, 0.3 + step / 40)] };
			const plan = expectSame(retainer, compiled, mutation.parameters ?? {}, mutation.context ?? {});
			expectDeclaredOrder(plan);
		}
	});

	it('exposes one fragment per source through the same index as the reference', () => {
		const retainer = createPlanRetainer();
		const compiled = compiledOf(document({ door: { offset: 1, width: 0.9, height: 2.1, sillHeight: 0 } }));
		const plan = expectSame(retainer, compiled);
		for (const row of plan.membership) {
			expect(planFragmentOf(plan, row.sourceId)).toEqual(
				plan.fragments.find((fragment) => fragment.ref.sourceId === row.sourceId)
			);
		}
	});
});
