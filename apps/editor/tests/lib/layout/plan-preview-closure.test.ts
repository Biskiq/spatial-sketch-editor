import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildLayoutPreviewModel } from '$lib/editor/layout/layout-mesh-factory';
import {
	beginWallChain,
	createLayoutInteractionState,
	setLayoutDraftTool,
	updateWallChainCursor
} from '$lib/editor/layout/layout-interaction';
import {
	buildPlanInteractionProjection,
	PLAN_CLOSE_AT_JUNCTION_COPY,
	type PlanWallFirstContext
} from '$lib/editor/layout/plan-overlays';
import { planClosureRule, resolvePlanClosureCue } from '$lib/editor/layout/plan-preview';
import {
	wallChainClosureEvidence,
	wallChainClosureProbeKey
} from '$lib/editor/layout/layout-wall-chain-closure';

/**
 * P23.13 S8 / §7 — the per-tool preview composer's one deciding row: a closure
 * cue may show a Room face **only** when the closing leg's own canonical plan
 * produced that face, and otherwise it says `Close at junction` and promises no
 * Room. The evidence is the planner's, the decision is the cue's, and the paint
 * layer is handed canonical polygons — never a shoelace guess at enclosure.
 */

const p = (x: number, z: number): [number, number] => [x, z];

function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

function committed(
	points: [number, number][],
	role: 'boundary' | 'partition'
): LayoutDocumentWallFirst {
	const plan = planWallChain({ baseline: baseDocument(), points, role, close: false });
	if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
	return plan.document;
}

function emptyContext(overrides: Partial<PlanWallFirstContext> = {}): PlanWallFirstContext {
	return {
		junctions: [],
		junctionFocus: null,
		curveControls: [],
		roomNames: new Map(),
		runStartPoint: null,
		issues: [],
		...overrides
	};
}

describe('P23.13 S8 closure rule (per tool)', () => {
	it('decides the rule per tool and never lets a partition promise a face', () => {
		expect(planClosureRule('wall-draw')).toBe('canonical-face');
		expect(planClosureRule('partition-draw')).toBe('junction-only');
		expect(resolvePlanClosureCue({ tool: 'wall-draw', closing: true, yieldsFace: true })).toBe(
			'room-face'
		);
		// A partition closes onto a junction and says so — even with evidence.
		expect(resolvePlanClosureCue({ tool: 'partition-draw', closing: true, yieldsFace: true })).toBe(
			'close-at-junction'
		);
	});

	it('never paints a cue when the candidate is not closing', () => {
		expect(resolvePlanClosureCue({ tool: 'wall-draw', closing: false, yieldsFace: true })).toBe(
			'none'
		);
		expect(resolvePlanClosureCue({ tool: 'partition-draw', closing: false, yieldsFace: false })).toBe(
			'none'
		);
	});

	it('falls back to the junction copy when no canonical face is offered', () => {
		expect(resolvePlanClosureCue({ tool: 'wall-draw', closing: true, yieldsFace: false })).toBe(
			'close-at-junction'
		);
	});
});

describe('P23.13 S8 canonical closure evidence', () => {
	it('reads the face out of the closing leg\u2019s own plan', () => {
		// Two committed legs of a triangle; the third leg closes the run.
		// P23B.3a S6 — the probe plans the operation the click would perform, and
		// that operation extends the run's own group: the live leg's start Junction
		// and the run's start Junction are DECLARED, exactly as the viewport's probe
		// declares them. Without them the closing leg would be independent placement
		// and could not birth the face the cue is asking about.
		const document = committed([p(0, 0), p(4, 0), p(4, 3)], 'boundary');
		const junctionIdAt = (x: number, z: number): string =>
			document.junctions.find(
				(junction) => junction.point[0] === x && junction.point[1] === z
			)!.id;
		const evidence = wallChainClosureEvidence({
			baseline: document,
			start: p(4, 3),
			end: p(0, 0),
			role: 'boundary',
			startJunctionId: junctionIdAt(4, 3),
			runStartJunctionId: junctionIdAt(0, 0)
		});
		expect(evidence.yieldsFace).toBe(true);
		expect(evidence.faces.length).toBeGreaterThan(0);
		const face = evidence.faces[0]!;
		expect(face.length).toBeGreaterThanOrEqual(3);
		// The face is the enclosure itself: every corner of the triangle is on it.
		for (const corner of [p(0, 0), p(4, 0), p(4, 3)]) {
			expect(
				face.some((point) => Math.hypot(point[0] - corner[0], point[1] - corner[1]) < 1e-6)
			).toBe(true);
		}
	});

	it('offers no face for a partition run, whatever it closes onto', () => {
		const document = committed([p(0, 0), p(4, 0), p(4, 3)], 'partition');
		expect(
			wallChainClosureEvidence({
				baseline: document,
				start: p(4, 3),
				end: p(0, 0),
				role: 'partition'
			})
		).toEqual({ yieldsFace: false, faces: [] });
	});

	it('offers no face for a degenerate closing leg (a refusal is not a face)', () => {
		const document = committed([p(0, 0), p(4, 0)], 'boundary');
		expect(
			wallChainClosureEvidence({
				baseline: document,
				start: p(0, 0),
				end: p(0, 0),
				role: 'boundary'
			})
		).toEqual({ yieldsFace: false, faces: [] });
	});

	it('keys the probe on canonical identities so one closure is planned once', () => {
		const key = (overrides: Partial<Parameters<typeof wallChainClosureProbeKey>[0]> = {}) =>
			wallChainClosureProbeKey({
				startJunctionId: 'J-1',
				start: p(4, 3),
				runStartJunctionId: 'J-0',
				end: p(0, 0),
				role: 'boundary',
				height: null,
				...overrides
			});
		// Same closure, a different pointer position inside the junction's radius:
		// the leg is identical, so the key must not move with the pointer.
		expect(key()).toBe(key({ start: p(4.02, 3.01), end: p(-0.01, 0) }));
		// A different start junction is a different closure.
		expect(key({ startJunctionId: 'J-9' })).not.toBe(key());
		expect(key({ role: 'partition' })).not.toBe(key());
		expect(key({ height: 3 })).not.toBe(key());
	});
});

describe('P23.13 S8 closure cue paint', () => {
	function chainState(cursor: [number, number]) {
		const document = committed([p(0, 0), p(4, 0)], 'boundary');
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		setLayoutDraftTool(state, 'wall-chain');
		beginWallChain(state, [4, 0]);
		updateWallChainCursor(state, cursor);
		return { document, model, state };
	}

	it('paints the junction copy and no wash when no face is proved', () => {
		const { model, state } = chainState([0.05, 0]);
		const projection = buildPlanInteractionProjection(
			state,
			[],
			model,
			emptyContext({ runStartPoint: [0, 0] })
		);
		expect(
			projection.labels.some(
				(primitive) =>
					primitive.kind === 'text' && primitive.text === PLAN_CLOSE_AT_JUNCTION_COPY
			)
		).toBe(true);
		expect(projection.drafts.some((primitive) => primitive.style === 'closure-wash')).toBe(false);
	});

	it('paints the canonical face instead of the words when the plan proved one', () => {
		const { model, state } = chainState([0.05, 0]);
		const face: [number, number][] = [p(0, 0), p(4, 0), p(4, 3)];
		const projection = buildPlanInteractionProjection(
			state,
			[],
			model,
			emptyContext({ runStartPoint: [0, 0], closureFaces: [face] })
		);
		const wash = projection.drafts.find((primitive) => primitive.style === 'closure-wash');
		expect(wash?.kind).toBe('polygon');
		expect(wash?.kind === 'polygon' && wash.points).toEqual(face);
		// The cue marker still marks the run start; the words are gone, because
		// the drawing is showing the enclosure itself rather than describing it.
		expect(
			projection.drafts.some(
				(primitive) => primitive.kind === 'circle' && primitive.style === 'snap-marker'
			)
		).toBe(true);
		expect(
			projection.labels.some(
				(primitive) =>
					primitive.kind === 'text' && primitive.text === PLAN_CLOSE_AT_JUNCTION_COPY
			)
		).toBe(false);
	});

	it('leaves a partition run on the junction copy even with face evidence', () => {
		const document = committed([p(0, 0), p(4, 0)], 'partition');
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		setLayoutDraftTool(state, 'partition-chain');
		beginWallChain(state, [4, 0]);
		updateWallChainCursor(state, [0.05, 0]);
		const projection = buildPlanInteractionProjection(
			state,
			[],
			model,
			emptyContext({ runStartPoint: [0, 0], closureFaces: [[p(0, 0), p(4, 0), p(4, 3)]] })
		);
		expect(projection.drafts.some((primitive) => primitive.style === 'closure-wash')).toBe(false);
		expect(
			projection.labels.some(
				(primitive) =>
					primitive.kind === 'text' && primitive.text === PLAN_CLOSE_AT_JUNCTION_COPY
			)
		).toBe(true);
	});

	it('paints no cue at all when the candidate is nowhere near the run start', () => {
		const { model, state } = chainState([9, 0]);
		const projection = buildPlanInteractionProjection(
			state,
			[],
			model,
			emptyContext({ runStartPoint: [0, 0], closureFaces: [[p(0, 0), p(4, 0), p(4, 3)]] })
		);
		expect(projection.drafts.some((primitive) => primitive.style === 'closure-wash')).toBe(false);
		expect(
			projection.labels.some(
				(primitive) =>
					primitive.kind === 'text' && primitive.text === PLAN_CLOSE_AT_JUNCTION_COPY
			)
		).toBe(false);
	});
});
