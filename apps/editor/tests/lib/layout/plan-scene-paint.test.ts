/**
 * P23.13 S9 (step 1) — the non-architectural paint row: passive Scene context
 * and LayoutObject footprints (§1.12). **A6 owner** — the single place this
 * paint vocabulary is proven (`salience` and `surrounds` used to carry their own
 * copies of the same claims).
 *
 * Two claims are pinned here, one per surface the row names:
 *
 * 1. **Scene context is continuous, fill-free ink.** The *resting* footprint is
 *    an outline and nothing else — §5's 15%/30% regime (and §1.12's 10% inside a
 *    live instrument zone) is per-primitive *opacity*, never fill — while the
 *    state variants keep their fills, because a hovered/active/selected Scene
 *    entity is feedback ink rather than passive context. The Camera Plan is a
 *    different surface with its own ratified footprint look (P14), so the Layout
 *    defaults changed *behind* the hooks Camera already sets, and the Layout Plan
 *    is pinned as never setting them.
 * 2. **An object is its authored footprint.** Exactly one polygon per committed
 *    object carrying the compiled footprint verbatim — no resampling and no
 *    per-detail pass a zoom could drop — painted in screen-constant ink so the
 *    outline can never thin below the ratified 1 px floor.
 *
 * **T2b — mechanism.** Every paint claim below used to be a regex slice of
 * `PlanSvg.svelte`'s raw source text (`rule('.scene-footprint')` + `toContain`).
 * That mechanism could not see whether the class was ever *emitted*, and it read
 * the stylesheet through a hand-rolled regex that a comment could defeat. The
 * claims are now driven through `tests/helpers/plan-render-harness.ts`: the
 * shipped component is rendered through its own props, and the paint
 * declarations come from the Svelte compiler's stylesheet. The two halves are
 * asserted together, so a rule whose class is never emitted (or a class with no
 * rule) fails.
 */
import { describe, expect, it } from 'vitest';
import {
	componentPath,
	componentRule,
	planSvgRule,
	planSvgStylesheet,
	renderPlanSvg
} from '../../helpers/plan-render-harness';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-codec';
import type { LayoutVec2 } from '$lib/layout/layout-types';
import {
	buildPlanRenderModel,
	PLAN_PRESENTATION_DEFAULTS,
	type PlanPolygonPrimitive,
	type PlanRenderPrimitive,
	type PlanSceneProjection
} from '$lib/layout/plan-render-model';
import { createLayoutObject } from '$lib/editor/layout/layout-object-editing';

/** One Wall and one authored LayoutObject — enough for both paint claims. */
function sceneDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j-1', point: [0, 0] },
			{ id: 'j-2', point: [4, 0] }
		],
		walls: [
			{
				id: 'wall-1',
				startJunctionId: 'j-1',
				endJunctionId: 'j-2',
				role: 'boundary',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' } as const
			}
		],
		openings: [],
		rooms: [],
		objects: [createLayoutObject({ id: 'box-a', kind: 'box', position: [1, 0.5, 1], dimensions: [2, 1, 1] })]
	};
}

const FOOTPRINT_POINTS: LayoutVec2[] = [
	[1, 1],
	[3, 1],
	[3, 2],
	[1, 2]
];

/**
 * The four Scene states §1.12 names, one key each — plus a second *resting*
 * footprint, because the regime value is resolved per primitive (§5/§8), so one
 * footprint cannot show that two of them can differ.
 */
function sceneProjection(): PlanSceneProjection {
	return {
		footprints: [
			{
				key: 'scene-rest',
				entityId: 'e-rest',
				kind: 'model',
				points: FOOTPRINT_POINTS
			},
			{
				key: 'scene-rest-2',
				entityId: 'e-rest-2',
				kind: 'model',
				points: FOOTPRINT_POINTS
			},
			{ key: 'scene-active', entityId: 'e-active', kind: 'model', points: FOOTPRINT_POINTS, presentation: 'active' },
			{
				key: 'scene-hover',
				entityId: 'e-hover',
				kind: 'model',
				points: FOOTPRINT_POINTS,
				presentation: 'bridge-hover'
			},
			{
				key: 'scene-selected',
				entityId: 'e-selected',
				kind: 'model',
				points: FOOTPRINT_POINTS,
				presentation: 'selected'
			}
		]
	};
}

function model() {
	const { geometry } = compileWallFirstLayoutGeometry(sceneDocument());
	return { geometry, built: buildPlanRenderModel(geometry) };
}

function sceneModel(scene: PlanSceneProjection) {
	return buildPlanRenderModel(
		compileWallFirstLayoutGeometry(sceneDocument()).geometry,
		undefined,
		undefined,
		scene
	);
}

/** The polygon primitives of a built model — the paint claims are all polygons. */
function polygons(primitives: readonly PlanRenderPrimitive[]): PlanPolygonPrimitive[] {
	return primitives.filter(
		(primitive): primitive is PlanPolygonPrimitive => primitive.kind === 'polygon'
	);
}

/** The rendered polygons carrying a `scene-footprint*` class. */
function renderedFootprints(
	scene: PlanSceneProjection,
	presentation?: Parameters<typeof renderPlanSvg>[0]['presentation']
) {
	return renderPlanSvg({ model: sceneModel(scene), presentation }).filter((element) =>
		element.classes.includes('scene-footprint')
	);
}

describe('P23.13 S9 passive Scene paint (§1.12, §5)', () => {
	it('paints the resting footprint as continuous, fill-free ink', () => {
		const rest = planSvgRule('.scene-footprint');
		expect(rest.fill).toBe('var(--plan-footprint-fill, none)');
		expect(rest['stroke-dasharray']).toBe('var(--plan-footprint-dasharray, none)');
		// The old dashes are gone from the base ink, not merely overridden.
		expect(rest['stroke-dasharray']).not.toContain('5 4');
		// Non-hittable by paint as well as by model (the primitive carries no hit).
		expect(rest['pointer-events']).toBe('none');
		// …and the resting state is emitted at all: a rule whose class never reaches
		// the markup is dead CSS, not a paint contract.
		const resting = renderedFootprints(sceneProjection()).filter(
			(element) => element.classes.length === 1
		);
		expect(resting).toHaveLength(2);
		expect(resting.every((element) => element.tag === 'polygon')).toBe(true);
	});

	it('leaves the Scene state variants as feedback ink', () => {
		expect(planSvgRule('.scene-footprint.active').fill).toBe('rgb(47 140 255 / 10%)');
		expect(planSvgRule('.scene-footprint.bridge-hover').fill).toBe('rgb(47 140 255 / 16%)');
		expect(planSvgRule('.scene-footprint.selected').fill).toBe('rgb(47 140 255 / 24%)');
		// Each presentation state reaches the markup as the class the rule paints, so
		// the state → class → ink chain is proven end to end rather than in halves.
		const emitted = renderedFootprints(sceneProjection());
		expect(emitted.map((element) => element.classes.join(' ')).sort()).toEqual([
			'scene-footprint',
			'scene-footprint',
			'scene-footprint active',
			'scene-footprint bridge-hover',
			'scene-footprint selected'
		]);
	});

	it('applies the regime fraction as opacity, and only to the resting footprint', () => {
		// S2's fraction is the *weight* of the outline; a state variant answers to
		// the state, so it keeps full opacity and its own fill.
		const atRegime = renderedFootprints(sceneProjection(), {
			decisionsFor: () => PLAN_PRESENTATION_DEFAULTS,
			sceneInk: 0.3
		});
		const restingInk = atRegime
			.filter((element) => element.classes.length === 1)
			.map((element) => element.attrs.style);
		expect(restingInk).toEqual(['opacity: 0.3', 'opacity: 0.3']);
		for (const state of ['scene-footprint active', 'scene-footprint bridge-hover', 'scene-footprint selected']) {
			expect(
				atRegime.find((element) => element.classes.join(' ') === state)?.attrs.style,
				state
			).toBeUndefined();
		}
		// S8/§1.12 — a source with a zone answers per footprint, so the one footprint
		// inside the live instrument zone dims while every other frame keeps the
		// regime value. One number for the whole plan could not express that.
		const zoned = renderedFootprints(sceneProjection(), {
			decisionsFor: () => PLAN_PRESENTATION_DEFAULTS,
			sceneInk: 0.3,
			sceneInkFor: (primitive) => (primitive.key === 'scene-rest' ? 0.1 : 0.3)
		});
		const zoneInk = zoned
			.filter((element) => element.classes.length === 1)
			.map((element) => element.attrs.style);
		expect(zoneInk).toEqual(['opacity: 0.1', 'opacity: 0.3']);
		// The Layout Plan authors the passive regime; the *LayoutObject* row is a
		// different ink and is never dimmed by it.
		const object = renderPlanSvg({
			model: sceneModel(sceneProjection()),
			presentation: { decisionsFor: () => PLAN_PRESENTATION_DEFAULTS, sceneInk: 0.3 }
		}).find((element) => element.classes.includes('layout-object'));
		expect(object?.attrs.style).toBeUndefined();
	});

	it('keeps the Camera Plan’s dashed filled footprints on its own surface', () => {
		const camera = componentPath('editor/camera-plan/CameraPlanViewport.svelte');
		const hooks = componentRule(camera, '.plan-canvas');
		expect(hooks['--plan-footprint-dasharray']).toBe('5 4');
		expect(hooks['--plan-footprint-fill']).toBe('var(--editor-camera-footprint-fill)');
		// The Layout Plan never sets the hooks, so it gets the continuous,
		// fill-free defaults above rather than the Camera vocabulary — checked on the
		// compiled stylesheet, where a comment cannot fake a declaration.
		const layoutStylesheet = planSvgStylesheet();
		expect(layoutStylesheet).not.toContain('--plan-footprint-dasharray:');
		expect(layoutStylesheet).not.toContain('--plan-footprint-fill:');
	});

	it('emits Scene footprints with no hit identity and their own points', () => {
		const { built } = model();
		const rendered = buildPlanRenderModel(
			compileWallFirstLayoutGeometry(sceneDocument()).geometry,
			undefined,
			undefined,
			sceneProjection()
		);
		const footprints = polygons(rendered.layers.flatMap((layer) => layer.primitives)).filter(
			(primitive) => primitive.style.startsWith('scene-footprint')
		);
		expect(footprints.map((primitive) => primitive.style).sort()).toEqual([
			'scene-footprint',
			'scene-footprint',
			'scene-footprint-active',
			'scene-footprint-bridge-hover',
			'scene-footprint-selected'
		]);
		for (const footprint of footprints) {
			// The projected footprint is the Scene's own polygon, verbatim: the
			// paint is a passive *reading* of context, never a re-derivation.
			expect(footprint).toMatchObject({ kind: 'polygon', points: FOOTPRINT_POINTS });
			// "Scene never hittable in Layout": no identity reaches any hit path.
			expect(footprint.hit).toBeUndefined();
		}
		// The passive model itself is untouched by the Scene pass.
		expect(
			polygons(built.layers.flatMap((layer) => layer.primitives)).some(
				(primitive) => primitive.hit?.kind === 'object'
			)
		).toBe(true);
	});
});

describe('P23.13 S9 LayoutObject paint (§1.12)', () => {
	it('paints one outline per authored footprint, verbatim', () => {
		const { geometry, built } = model();
		const compiled = geometry.objects[0];
		expect(compiled).toBeTruthy();
		const primitives = polygons(built.layers.flatMap((layer) => layer.primitives));
		const object = primitives.find((primitive) => primitive.style.startsWith('layout-object'));
		expect(object).toBeTruthy();
		// Authored truth, not a rendering simplification: the compiler's own
		// footprint polygon, in its own order, is what the plan paints.
		expect(object!.points).toEqual(compiled!.planFootprint);
		expect(object!.hit).toEqual({ kind: 'object', objectId: compiled!.objectId });
		// One object, one primitive: there is no per-detail layer for a zoom to
		// drop, so "simplified only by projected size" cannot mean anything else.
		expect(primitives.filter((primitive) => primitive.hit?.kind === 'object')).toHaveLength(1);
	});

	it('keeps object ink at or above the 1 px floor at every zoom', () => {
		const rest = planSvgRule('.layout-object');
		// Screen-constant ink: an object outline is never scaled down with zoom.
		expect(rest['vector-effect']).toBe('non-scaling-stroke');
		expect(Number(rest['stroke-width'] ?? '0')).toBeGreaterThanOrEqual(1);
		// …at every zoom, not just in the stylesheet: the class is emitted for a
		// committed object, so the declaration is load-bearing.
		expect(renderedObjectClasses()).toContain('layout-object');
	});
});

/** The classes of the emitted LayoutObject polygon. */
function renderedObjectClasses(): string[] {
	const rendered = renderPlanSvg({ model: model().built });
	const object = rendered.find((element) => element.classes.includes('layout-object'));
	return object ? object.classes : [];
}
