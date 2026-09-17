import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	PLAN_CONTROL_MARKS,
	planControlTargetRadiusPx,
	planFocusGeometry,
	resolvePlanAcquisition,
	type PlanControlCandidate
} from '$lib/editor/layout/plan-acquisition';
import { resolvePlanHit } from '$lib/editor/layout/plan-hit';
import {
	buildPlanInteractionProjection,
	JUNCTION_HANDLES_MIN_PX_PER_M,
	type PlanWallFirstContext
} from '$lib/editor/layout/plan-overlays';
import {
	clearLayoutSelection,
	clearPlanFocus,
	createLayoutInteractionState,
	selectLayoutPhysicalWall,
	selectLayoutWallOpening,
	setPlanFocus,
	type LayoutInteractionState
} from '$lib/editor/layout/layout-interaction';
import { buildLayoutPreviewModel } from '$lib/editor/layout/layout-mesh-factory';

/**
 * P23.13 S4 — state composition, hit authority and shape-coded controls.
 *
 * The suite is deliberately split by authority layer:
 * - the tier engine is tested as pure policy (no document, no paint),
 * - the canonical resolver is tested for the ONE reordering §6 requires,
 * - the overlay is tested for the marks, focus ring and control geometry it
 *   paints, driven through the real projection.
 */

const p = (x: number, z: number): [number, number] => [x, z];

function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

function commitChain(
	baseline: LayoutDocumentWallFirst,
	points: [number, number][],
	role: 'boundary' | 'partition'
): LayoutDocumentWallFirst {
	const plan = planWallChain({ baseline, points, close: false, role });
	if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
	return plan.document;
}

/** Two boundary Walls meeting at a corner, so Junction handles have owners. */
function cornerDocument(): LayoutDocumentWallFirst {
	const first = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
	return commitChain(first, [p(4, 0), p(4, 3)], 'boundary');
}

/** One Wall carrying a door, so width-edge and slide controls exist. */
function doorDocument(): LayoutDocumentWallFirst {
	const wall = commitChain(baseDocument(), [p(0, 0), p(6, 0)], 'boundary');
	const plan = planCreateWallFirstOpening(wall, { wallId: wall.walls[0]!.id, kind: 'door', offset: 2 });
	if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
	return plan.document;
}

function interactionState(): LayoutInteractionState {
	const state = createLayoutInteractionState();
	state.planView.pixelsPerMeter = 80;
	return state;
}

function wallFirstContext(document: LayoutDocumentWallFirst, patch: Partial<PlanWallFirstContext> = {}): PlanWallFirstContext {
	return {
		junctions: document.junctions.map((junction) => ({
			id: junction.id,
			point: [junction.point[0], junction.point[1]] as [number, number]
		})),
		curveControls: [],
		junctionFocus: null,
		roomNames: new Map(),
		runStartPoint: null,
		issues: [],
		...patch
	};
}

function candidate(patch: Partial<PlanControlCandidate> & Pick<PlanControlCandidate, 'id' | 'kind' | 'point'>): PlanControlCandidate {
	return { ownerId: 'owner', ...patch };
}

describe('P23.13 S4 acquisition — tiers decide authority, not distance', () => {
	it('uses the ratified 24 px target, and 44 px on a coarse pointer', () => {
		expect(planControlTargetRadiusPx(false)).toBe(12);
		expect(planControlTargetRadiusPx(true)).toBe(22);
	});

	it('acquires a control at 11 px but not at 30 px, and reaches further on a coarse pointer', () => {
		const at = (x: number): PlanControlCandidate =>
			candidate({ id: 'junction:j1', kind: 'junction', point: p(x, 0), ownerSelected: true });
		const input = { planView: { pixelsPerMeter: 1 }, point: p(0, 0) as [number, number] };
		expect(resolvePlanAcquisition({ ...input, candidates: [at(11)] })).not.toBeNull();
		expect(resolvePlanAcquisition({ ...input, candidates: [at(13)] })).toBeNull();
		// The same control is acquirable on a coarse pointer: the target grows,
		// the visible mark does not.
		expect(resolvePlanAcquisition({ ...input, candidates: [at(20)], coarsePointer: true })).not.toBeNull();
	});

	it('measures distance in screen px, so the target does not scale with zoom', () => {
		const control = candidate({ id: 'junction:j1', kind: 'junction', point: p(0.5, 0), ownerSelected: true });
		const near = resolvePlanAcquisition({
			candidates: [control],
			point: p(0, 0),
			planView: { pixelsPerMeter: 20 }
		});
		const far = resolvePlanAcquisition({
			candidates: [control],
			point: p(0, 0),
			planView: { pixelsPerMeter: 40 }
		});
		expect(near).toMatchObject({ distancePx: 10, tier: 'selected-owner' });
		expect(far).toBeNull();
	});

	it('ranks captured → focused-owner → selected-owner → tool-eligible above proximity', () => {
		const point = p(0, 0) as [number, number];
		const run = (candidates: PlanControlCandidate[]) =>
			resolvePlanAcquisition({ candidates, point, planView: { pixelsPerMeter: 1 } });
		// A far controlled target beats a near tool-eligible one.
		expect(
			run([
				candidate({ id: 'b', kind: 'junction', point: p(8, 0), toolEligible: true }),
				candidate({ id: 'a', kind: 'opening-edge', point: p(10, 0), ownerSelected: true })
			])?.id
		).toBe('a');
		// Focus only outranks selection while its owner is selected.
		expect(
			run([
				candidate({ id: 'a', kind: 'junction', point: p(10, 0), ownerSelected: true }),
				candidate({ id: 'b', kind: 'junction', point: p(11, 0), ownerSelected: true, focused: true })
			])?.id
		).toBe('b');
		expect(
			run([candidate({ id: 'b', kind: 'junction', point: p(11, 0), focused: true })])
		).toBeNull();
		// A captured gesture keeps its control whatever the distance.
		expect(
			run([
				candidate({ id: 'a', kind: 'junction', point: p(1, 0), ownerSelected: true }),
				candidate({ id: 'b', kind: 'junction', point: p(200, 0), captured: true })
			])
		).toMatchObject({ id: 'b', tier: 'captured' });
	});

	it('breaks a same-tier tie by canonical identity, independent of input order', () => {
		const point = p(0, 0) as [number, number];
		const candidates = [
			candidate({ id: 'junction:zzz', kind: 'junction', point: p(5, 0), ownerSelected: true }),
			candidate({ id: 'junction:aaa', kind: 'junction', point: p(5, 0), ownerSelected: true })
		];
		const forward = resolvePlanAcquisition({ candidates, point, planView: { pixelsPerMeter: 1 } });
		const reversed = resolvePlanAcquisition({
			candidates: [...candidates].reverse(),
			point,
			planView: { pixelsPerMeter: 1 }
		});
		expect(forward?.id).toBe('junction:aaa');
		expect(reversed?.id).toBe('junction:aaa');
	});

	it('claims nothing when no tier applies, leaving the entity fallback in charge', () => {
		const authority = resolvePlanAcquisition({
			candidates: [candidate({ id: 'junction:j1', kind: 'junction', point: p(0, 0) })],
			point: p(0, 0),
			planView: { pixelsPerMeter: 1 }
		});
		expect(authority).toBeNull();
	});
});

describe('P23.13 S4 hit authority — the resolver is adapted, never forked', () => {
	function compiled(): ReturnType<typeof compileWallFirstLayoutGeometry> {
		return compileWallFirstLayoutGeometry(cornerDocument());
	}

	it('keeps the class fallback byte-identical when no authority is supplied', () => {
		const { geometry } = compiled();
		const point = p(4, 0) as [number, number];
		const hit = resolvePlanHit(geometry.queries, point, 0.5);
		expect(hit?.kind).toBe('wallEndpoint');
		expect(resolvePlanHit(geometry.queries, point, 0.5, { controlAuthority: null })?.kind).toBe(
			'wallEndpoint'
		);
	});

	it('lets a selected-owner curve control beat a co-located Junction', () => {
		const { geometry } = compiled();
		const point = p(4, 0) as [number, number];
		const curveControls = [
			{ wallId: 'wall-a', anchorId: 'anchor-1', point: p(4, 0) as [number, number] }
		];
		// Without a verdict the endpoint wins, which is exactly the gap §6 names.
		expect(resolvePlanHit(geometry.queries, point, 0.5, { curveControls })?.kind).toBe('wallEndpoint');
		const hit = resolvePlanHit(geometry.queries, point, 0.5, {
			curveControls,
			controlAuthority: {
				kind: 'curve-control',
				id: 'anchor-1',
				ownerId: 'wall-a',
				tier: 'selected-owner',
				distancePx: 6
			}
		});
		expect(hit).toMatchObject({ kind: 'wallCurveControl', wallId: 'wall-a', anchorId: 'anchor-1' });
	});

	it('stands the endpoint tier down for a non-Junction control the pointer owns', () => {
		const { geometry } = compiled();
		const point = p(4, 0) as [number, number];
		const hit = resolvePlanHit(geometry.queries, point, 0.5, {
			controlAuthority: {
				kind: 'opening-edge',
				id: 'opening-1:start',
				ownerId: 'opening-1',
				tier: 'selected-owner',
				distancePx: 4
			}
		});
		expect(hit?.kind).not.toBe('wallEndpoint');
		// The verdict is not a blank cheque: with nothing else under the pointer
		// the resolver still returns the canonical fallback rather than inventing
		// a record for a control it cannot see.
		expect(hit?.kind).toBe('physicalWall');
	});

	it('never fabricates a record for a verdict naming a control that is gone', () => {
		const { geometry } = compiled();
		const point = p(4, 0) as [number, number];
		const hit = resolvePlanHit(geometry.queries, point, 0.5, {
			curveControls: [
				{ wallId: 'wall-a', anchorId: 'anchor-other', point: p(4, 0) as [number, number] }
			],
			controlAuthority: {
				kind: 'curve-control',
				id: 'anchor-1',
				ownerId: 'wall-a',
				tier: 'focused-owner',
				distancePx: 2
			}
		});
		// The verdict cannot conjure a control that is no longer drawn. The
		// resolver falls through to its own fallback, which may still find a
		// *different* control — but never the named one.
		expect(hit).not.toMatchObject({ anchorId: 'anchor-1' });
	});
});

describe('P23.13 S4 control marks — shape carries the role', () => {
	function project(
		document: LayoutDocumentWallFirst,
		state: LayoutInteractionState,
		context?: Partial<PlanWallFirstContext>
	) {
		const model = buildLayoutPreviewModel(document).model;
		// These fixtures author no Rooms: the projection's Room list is empty.
		return buildPlanInteractionProjection(state, [], model, wallFirstContext(document, context));
	}

	it('draws Junction controls as 7 px diamonds, not circles', () => {
		const document = cornerDocument();
		const state = interactionState();
		selectLayoutPhysicalWall(state, document.walls[0]!.id);
		const projection = project(document, state);
		const junctions = projection.handles.filter(
			(handle) => handle.kind === 'circle' && handle.style.toString().startsWith('vertex-handle')
		);
		expect(junctions.length).toBeGreaterThan(0);
		for (const junction of junctions) {
			expect(junction).toMatchObject({
				shape: PLAN_CONTROL_MARKS.junction.shape,
				radiusPx: PLAN_CONTROL_MARKS.junction.radiusPx
			});
		}
	});

	it('draws Opening width edges as squares straddling the jamb, plus a paired slide grip', () => {
		const document = doorDocument();
		const opening = document.openings[0]!;
		const state = interactionState();
		selectLayoutWallOpening(state, opening.wallId, opening.id);
		const projection = project(document, state);

		const edges = projection.handles.filter((handle) => handle.style === 'opening-handle');
		expect(edges).toHaveLength(2);
		for (const edge of edges) {
			expect(edge).toMatchObject({
				kind: 'circle',
				shape: PLAN_CONTROL_MARKS['opening-edge'].shape,
				radiusPx: PLAN_CONTROL_MARKS['opening-edge'].radiusPx
			});
		}

		const grip = projection.handles.filter(
			(handle) => handle.kind === 'polyline' && handle.style === 'opening-slide-grip'
		);
		expect(grip).toHaveLength(2);
		// Two marks, one either side of the symbol center, perpendicular to the
		// host, and screen-constant: the world length is 9 px at this scale.
		const lengths = grip.map((handle) => {
			if (handle.kind !== 'polyline') throw new Error('expected polyline');
			const [a, b] = handle.points as [number, number][];
			return Math.hypot(b![0] - a![0], b![1] - a![1]) * state.planView.pixelsPerMeter;
		});
		expect(lengths[0]).toBeCloseTo(9, 6);
		expect(lengths[1]).toBeCloseTo(9, 6);
		// The grip is ink-only: it must not read as a filled handle.
		expect(grip.every((handle) => handle.kind === 'polyline')).toBe(true);
	});

	it('hides every control below the Plan control floor, so nothing invisible is acquirable', () => {
		const document = doorDocument();
		const opening = document.openings[0]!;
		const state = interactionState();
		selectLayoutWallOpening(state, opening.wallId, opening.id);
		state.planView.pixelsPerMeter = JUNCTION_HANDLES_MIN_PX_PER_M / 2;
		const projection = project(document, state);
		// Junctions, curve controls and — since S4 — the Opening's own width edges
		// and slide grip are all §6 controls, and all of them stand down under the
		// §5 vocabulary floor. Nothing invisible may be a pointer target.
		expect(projection.handles).toEqual([]);
	});
});

describe('P23.13 S4 focus — ring, owner control net and the true centerline', () => {
	function focusContext(document: LayoutDocumentWallFirst, focus: PlanWallFirstContext['focus']) {
		const state = interactionState();
		selectLayoutPhysicalWall(state, document.walls[0]!.id);
		const model = buildLayoutPreviewModel(document).model;
		return buildPlanInteractionProjection(state, [], model, wallFirstContext(document, { focus }));
	}

	it('paints a paper moat under a dark double ring at the focused control', () => {
		const document = cornerDocument();
		const junction = document.junctions[0]!;
		const projection = focusContext(document, {
			point: [junction.point[0], junction.point[1]],
			radiusPx: PLAN_CONTROL_MARKS.junction.radiusPx,
			geometry: null
		});
		const moat = projection.handles.findIndex((handle) => handle.style === 'focus-moat');
		const ring = projection.handles.findIndex((handle) => handle.style === 'focus-ring');
		expect(moat).toBeGreaterThanOrEqual(0);
		// The moat paints first, so the ring's inner edge reads against paper
		// rather than against whatever mark it surrounds.
		expect(ring).toBeGreaterThan(moat);
		expect(projection.handles[moat]).toMatchObject({ kind: 'circle' });
	});

	it('paints nothing when no control is focused', () => {
		const projection = focusContext(cornerDocument(), null);
		expect(projection.handles.some((handle) => handle.style === 'focus-moat')).toBe(false);
		expect(projection.handles.some((handle) => handle.style === 'focus-ring')).toBe(false);
	});

	it('draws both rings outside the mark, so the focused control stays legible inside', () => {
		const document = cornerDocument();
		const junction = document.junctions[0]!;
		const markRadiusPx = PLAN_CONTROL_MARKS.junction.radiusPx;
		const projection = focusContext(document, {
			point: [junction.point[0], junction.point[1]],
			radiusPx: markRadiusPx,
			geometry: null
		});
		const rings = projection.handles.filter(
			(handle) => handle.kind === 'circle' && handle.style === 'focus-ring'
		);
		expect(rings).toHaveLength(2);
		const radii = rings.map((ring) => (ring.kind === 'circle' ? ring.radiusPx : 0));
		// Innermost ink must clear the circumscribed corner of the diamond, or the
		// focused control disappears under its own ring (found in the §6 visual
		// pass: a 5 px moat at +4 erased a 7 px square).
		const circumscribed = markRadiusPx * Math.SQRT2;
		expect(radii[0]! - 0.75).toBeGreaterThan(circumscribed);
		expect(radii[1]!).toBeGreaterThan(radii[0]!);
	});

	it('survives selection, hover and the tool LOD it is drawn under', () => {
		const document = cornerDocument();
		const junction = document.junctions[0]!;
		const point: [number, number] = [junction.point[0], junction.point[1]];
		const model = buildLayoutPreviewModel(document).model;
		const state = interactionState();
		selectLayoutPhysicalWall(state, document.walls[0]!.id);
		const projection = buildPlanInteractionProjection(
			state,
			[],
			model,
			wallFirstContext(document, { focus: { point, radiusPx: 3.5, geometry: null } }),
			{ kind: 'junction', junctionId: junction.id }
		);
		// The focused control also happens to be the hovered one; the ring is
		// still drawn, because focus composes with the other states instead of
		// being replaced by them.
		expect(projection.handles.some((handle) => handle.style === 'focus-ring')).toBe(true);
	});

	it('paints the reference centerline per opening-free span, never across the void', () => {
		// The door splits the host Wall's canonical centerline into two spans. One
		// flattened polyline would draw a phantom segment straight through the
		// authored cut — wrong ink in a helper whose contract is "never invent a
		// centerline".
		const document = doorDocument();
		const spans = compileWallFirstLayoutGeometry(document).geometry.walls[0]!
			.solidCenterlinePolylines;
		expect(spans.length).toBeGreaterThan(1);
		const projection = focusContext(document, {
			point: [0, 0],
			radiusPx: 3.5,
			geometry: {
				point: [0, 0],
				controlPoints: [
					[0, 0],
					[6, 0]
				],
				centerlineSpans: spans
			}
		});
		const centerlines = projection.handles.filter(
			(handle) => handle.style === 'control-centerline'
		);
		expect(centerlines).toHaveLength(spans.length);
		for (const span of centerlines) {
			if (span.kind !== 'polyline') throw new Error('expected polyline');
			// Each painted span is one of the compiled spans, order preserved.
			expect(spans.some((candidate) => candidate.length === span.points.length)).toBe(true);
		}
	});

	it('draws the owner control net from the caller, so a curve never becomes a chord', () => {
		const document = doorDocument();
		const bendNet: [number, number][] = [
			[0, 0],
			[2, 1],
			[4, 0],
			[6, 1]
		];
		const projection = focusContext(document, {
			point: [0, 0],
			radiusPx: 3.5,
			geometry: planFocusGeometry(
				{ ownerId: document.walls[0]!.id, point: [0, 0], controlNet: bendNet },
				compileWallFirstLayoutGeometry(document).geometry.walls
			)
		});
		const polygon = projection.handles.find((handle) => handle.style === 'control-polygon');
		if (polygon?.kind !== 'polyline') throw new Error('expected polyline');
		// The net follows the bends, so it is not the end-to-end chord.
		expect(polygon.points).toEqual(bendNet);
	});

	it('refuses focus geometry when the owner is absent, unspanned, or has no net', () => {
		const walls = [
			{
				wallId: 'wall-a',
				solidCenterlinePolylines: [[[0, 0], [1, 1], [2, 0]]] as [number, number][][]
			}
		];
		const geometry = planFocusGeometry({ ownerId: 'wall-a', point: [1, 0] }, walls);
		expect(geometry).toMatchObject({ point: [1, 0], controlPoints: [] });
		// A curve keeps every sample: no chord substitution.
		expect(geometry?.centerlineSpans[0]).toHaveLength(3);
		expect(planFocusGeometry({ ownerId: 'missing' }, walls)).toBeNull();
		expect(
			planFocusGeometry({ ownerId: 'wall-a', point: [0, 0] }, [
				{
					wallId: 'wall-a',
					solidCenterlinePolylines: [[[1, 1]]] as [number, number][][]
				}
			])
		).toBeNull();
		expect(planFocusGeometry(null, [])).toBeNull();
	});
});

describe('P23.13 S4 paint composition — the Wall state never becomes the Wall', () => {
	const source = readFileSync(
		resolve(
			dirname(fileURLToPath(import.meta.url)),
			'../../../src/lib/editor/layout/PlanSvg.svelte'
		),
		'utf8'
	);

	it('paints contour → moat → profile → band, so the state sits outside the ink', () => {
		const contour = source.indexOf('class="wall-contour selected"');
		const moat = source.indexOf('class="wall-contour-moat selected"');
		const casing = source.indexOf('wall-casing ${wallPartitionClass(primitive)}');
		const band = source.indexOf('${tokenClass(primitive.style)} ${wallPartitionClass(primitive)}');
		expect(contour).toBeGreaterThan(-1);
		expect(moat).toBeGreaterThan(contour);
		expect(casing).toBeGreaterThan(moat);
		expect(band).toBeGreaterThan(casing);
	});

	it('separates the state contour from the band by the §2 figure, measured from the band edge', () => {
		// §2: "Hover | 1 px neutral contour, 3 px outside body" and
		// "Selected | 1.5 px blue outer contour, 2 px paper separation". The atlas
		// draws the same thing as a rect offset 4 px (hover, 1 px stroke) and 3 px
		// (selected, 1.5 px stroke) from the band edge. Both figures are measured
		// from the BAND edge, which is why the visible gap from the 1 px profile is
		// one pixel smaller — the profile is 1 px of that distance.
		const strokeOf = (selector: string): number => {
			const start = source.indexOf(`${selector} {`);
			if (start < 0) return Number.NaN;
			const rule = source.slice(start, source.indexOf('}', start));
			const match = /band-width\) \+ ([\d.]+)px/u.exec(rule);
			return match ? Number(match[1]) : Number.NaN;
		};
		// Ink extends (stroke/2) outside the band; the moat erases everything
		// inside its own extent, so the visible band is the difference.
		const selectedInk = strokeOf('.wall-contour.selected') / 2;
		const selectedMoat = strokeOf('.wall-contour-moat.selected') / 2;
		const hoverInk = strokeOf('.wall-contour.neutral') / 2;
		const hoverMoat = strokeOf('.wall-contour-moat.neutral') / 2;
		expect(selectedMoat).toBeCloseTo(2, 6);
		expect(selectedInk - selectedMoat).toBeCloseTo(1.5, 6);
		expect(hoverMoat).toBeCloseTo(3, 6);
		expect(hoverInk - hoverMoat).toBeCloseTo(1, 6);
	});

	it('never recolours the Wall mass with a state token', () => {
		const casingRules = [...source.matchAll(/\.wall-casing[^{]*\{([^}]*)\}/gu)].map(
			(match) => match[0]
		);
		for (const rule of casingRules) {
			expect(rule).not.toContain('editor-plan-selection');
			expect(rule).not.toContain('hover-stroke');
		}
	});
});

describe('P23.13 S4 focus lifecycle', () => {
	it('sets focus for a new control and no-ops on the same one', () => {
		const state = createLayoutInteractionState();
		selectLayoutPhysicalWall(state, 'wall-a');
		const target = { kind: 'junction' as const, id: 'j1', ownerId: 'j1' };
		setPlanFocus(state, target);
		expect(state.planFocus).toEqual(target);
		const before = state.planFocus;
		setPlanFocus(state, { ...target });
		// Same target: no new object, so no downstream churn.
		expect(state.planFocus).toBe(before);
	});

	it('never touches selection when focus moves', () => {
		const state = createLayoutInteractionState();
		selectLayoutPhysicalWall(state, 'wall-a');
		setPlanFocus(state, { kind: 'opening-edge', id: 'o1:start', ownerId: 'o1' });
		expect(state.selection).toEqual({ kind: 'physicalWall', wallId: 'wall-a' });
		clearPlanFocus(state);
		expect(state.planFocus).toBeNull();
		expect(state.selection).toEqual({ kind: 'physicalWall', wallId: 'wall-a' });
	});

	it('releases focus with the selection it belongs to', () => {
		// A delete clears the selection; P23.12 recycles canonical ids, so a focus
		// left behind could reattach a ring (and its owner control net) to a
		// reissued Junction/Opening the user never pressed.
		const state = createLayoutInteractionState();
		selectLayoutPhysicalWall(state, 'wall-a');
		setPlanFocus(state, { kind: 'junction', id: 'j1', ownerId: 'j1' });
		clearLayoutSelection(state);
		expect(state.selection).toEqual({ kind: 'none' });
		expect(state.planFocus).toBeNull();
	});
});
