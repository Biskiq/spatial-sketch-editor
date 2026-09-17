/**
 * P23.13 S9 (step 1) — the non-architectural paint row: passive Scene context
 * and LayoutObject footprints (§1.12).
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
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-codec';
import type { LayoutVec2 } from '$lib/layout/layout-types';
import {
	buildPlanRenderModel,
	type PlanPolygonPrimitive,
	type PlanRenderPrimitive,
	type PlanSceneProjection
} from '$lib/layout/plan-render-model';
import { createLayoutObject } from '$lib/editor/layout/layout-object-editing';

const here = dirname(fileURLToPath(import.meta.url));

function readLibSource(relativePath: string): string {
	return readFileSync(resolve(here, '../../../src/lib', relativePath), 'utf8');
}

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

function model() {
	const { geometry } = compileWallFirstLayoutGeometry(sceneDocument());
	return { geometry, built: buildPlanRenderModel(geometry) };
}

const planSvg = readLibSource('editor/layout/PlanSvg.svelte');

/** The polygon primitives of a built model — the paint claims are all polygons. */
function polygons(primitives: readonly PlanRenderPrimitive[]): PlanPolygonPrimitive[] {
	return primitives.filter(
		(primitive): primitive is PlanPolygonPrimitive => primitive.kind === 'polygon'
	);
}

/** The declarations of one class rule, for the paint pins. */
function rule(selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	return new RegExp(`${escaped} \\{([^}]*)\\}`, 'u').exec(planSvg)?.[1] ?? '';
}

describe('P23.13 S9 passive Scene paint (§1.12, §5)', () => {
	it('paints the resting footprint as continuous, fill-free ink', () => {
		const rest = rule('.scene-footprint');
		expect(rest).toContain('fill: var(--plan-footprint-fill, none)');
		expect(rest).toContain('stroke-dasharray: var(--plan-footprint-dasharray, none)');
		// The old dashes are gone from the base ink, not merely overridden.
		expect(rest).not.toContain('stroke-dasharray: 5 4');
		// Non-hittable by paint as well as by model (the primitive carries no hit).
		expect(rest).toContain('pointer-events: none');
	});

	it('leaves the Scene state variants as feedback ink', () => {
		expect(rule('.scene-footprint.active')).toContain('fill: rgb(47 140 255 / 10%)');
		expect(rule('.scene-footprint.bridge-hover')).toContain('fill: rgb(47 140 255 / 16%)');
		expect(rule('.scene-footprint.selected')).toContain('fill: rgb(47 140 255 / 24%)');
	});

	it('applies the regime fraction as opacity, and only to the resting footprint', () => {
		// S2's fraction (and S8's per-footprint zone override) is the *weight* of
		// the outline; a state variant answers to the state, so it keeps full
		// opacity and its own fill.
		expect(planSvg).toContain("if (primitive.style !== 'scene-footprint') return undefined;");
		expect(planSvg).toContain('presentation.sceneInkFor?.(primitive) ?? presentation.sceneInk');
	});

	it('keeps the Camera Plan’s dashed filled footprints on its own surface', () => {
		const scenePlan = readLibSource('editor/layout/LayoutPlanViewport.svelte');
		const cameraPlan = readLibSource('editor/camera-plan/CameraPlanViewport.svelte');
		expect(cameraPlan).toContain('--plan-footprint-dasharray: 5 4');
		expect(cameraPlan).toContain('--plan-footprint-fill: var(--editor-camera-footprint-fill)');
		// The Layout Plan never sets the hooks, so it gets the continuous,
		// fill-free defaults above rather than the Camera vocabulary.
		expect(scenePlan).not.toContain('--plan-footprint');
	});

	it('emits Scene footprints with no hit identity and their own points', () => {
		const { built } = model();
		const points: LayoutVec2[] = [
			[1, 1],
			[3, 1],
			[3, 2],
			[1, 2]
		];
		const scene: PlanSceneProjection = {
			footprints: [
				{ key: 'scene-rest', entityId: 'e-rest', kind: 'model', points },
				{ key: 'scene-active', entityId: 'e-active', kind: 'model', points, presentation: 'active' },
				{ key: 'scene-hover', entityId: 'e-hover', kind: 'model', points, presentation: 'bridge-hover' },
				{ key: 'scene-selected', entityId: 'e-selected', kind: 'model', points, presentation: 'selected' }
			]
		};
		const rendered = buildPlanRenderModel(
			compileWallFirstLayoutGeometry(sceneDocument()).geometry,
			undefined,
			undefined,
			scene
		);
		const footprints = polygons(rendered.layers.flatMap((layer) => layer.primitives)).filter(
			(primitive) => primitive.style.startsWith('scene-footprint')
		);
		expect(footprints.map((primitive) => primitive.style).sort()).toEqual([
			'scene-footprint',
			'scene-footprint-active',
			'scene-footprint-bridge-hover',
			'scene-footprint-selected'
		]);
		for (const footprint of footprints) {
			// The projected footprint is the Scene's own polygon, verbatim: the
			// paint is a passive *reading* of context, never a re-derivation.
			expect(footprint).toMatchObject({ kind: 'polygon', points });
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
		const rest = rule('.layout-object');
		// Screen-constant ink: an object outline is never scaled down with zoom.
		expect(rest).toContain('vector-effect: non-scaling-stroke');
		const width = Number(/stroke-width: ([\d.]+)/u.exec(rest)?.[1] ?? '0');
		expect(width).toBeGreaterThanOrEqual(1);
	});
});
