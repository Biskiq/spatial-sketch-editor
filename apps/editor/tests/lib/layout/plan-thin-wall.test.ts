/**
 * P23.13 S10 — thin-wall-at-zoom eyeball, pinned (open since S2).
 *
 * Real pipeline end to end: canonical compile → render model → salience
 * projection at 8/20/100 px/m → the shipped `PlanSvg.svelte` rendered through
 * the test render harness. At 8 px/m every sub-2px band resolves the centered
 * 1px silhouette aid with the canonical band preserved beneath, and the close
 * thin pair resolves dense (one neutral aid, casing skipped); at 20/100 px/m
 * the bands stand alone. **A10** — the paint conditions used to be sliced out
 * of the template that owns them; they are now read off what that template
 * emits, with the aid computed by the real salience pipeline at the same zoom.
 */
import { describe, expect, it } from 'vitest';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-codec';
import {
	buildPlanRenderModel,
	type PlanPolylinePrimitive,
	type PlanRenderPrimitive
} from '$lib/layout/plan-render-model';
import {
	createPlanSalienceMemory,
	resolvePlanSalience
} from '$lib/editor/layout/plan-salience';
import {
	architectureBandPx,
	resolveWallInkAid
} from '$lib/editor/layout/plan-architecture-grammar';
import {
	createPlanViewportState,
	type PlanViewportState
} from '$lib/editor/layout/layout-plan-transform';
import {
	elementsWithClass,
	planSvgRule,
	renderPlanSvg
} from '../../helpers/plan-render-harness';

/** Rect enclosure + thin partition + close thin pair (0.3 m apart). */
function thinWallDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-b', point: [6, 0] },
			{ id: 'j-c', point: [6, 4] },
			{ id: 'j-d', point: [0, 4] },
			{ id: 'j-e', point: [0, 2] },
			{ id: 'j-f', point: [6, 2] },
			{ id: 'j-g', point: [0, 5] },
			{ id: 'j-h', point: [6, 5] },
			{ id: 'j-i', point: [0, 5.3] },
			{ id: 'j-j', point: [6, 5.3] }
		],
		walls: [
			{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-thin', startJunctionId: 'j-e', endJunctionId: 'j-f', role: 'partition', thickness: 0.1, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-dense-a', startJunctionId: 'j-g', endJunctionId: 'j-h', role: 'boundary', thickness: 0.1, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-dense-b', startJunctionId: 'j-i', endJunctionId: 'j-j', role: 'boundary', thickness: 0.1, height: 3, centerline: { kind: 'line' } as const }
		],
		openings: [],
		rooms: [],
		objects: []
	};
}

function wallAidsAt(pixelsPerMeter: number): Map<string, string> {
	const { geometry, issues } = compileWallFirstLayoutGeometry(thinWallDocument());
	expect(issues).toEqual([]);
	const model = buildPlanRenderModel(geometry);
	const view = { ...createPlanViewportState(), pixelsPerMeter };
	const presentation = resolvePlanSalience({ model, view }, createPlanSalienceMemory());
	const aids = new Map<string, string>();
	for (const layer of model.layers) {
		for (const primitive of layer.primitives as readonly PlanRenderPrimitive[]) {
			if (primitive.kind !== 'polyline') continue;
			const architecture = primitive.architecture;
			if (architecture?.kind !== 'wall') continue;
			const wall = primitive as PlanPolylinePrimitive;
			const bandPx = architectureBandPx(pixelsPerMeter, architecture.thicknessMeters);
			aids.set(
				wall.key,
				resolveWallInkAid(presentation.decisionsFor(wall).wallInkAid, bandPx)
			);
		}
	}
	expect(aids.size).toBe(7);
	return aids;
}

describe('P23.13 S10 thin walls at zoom (S2 eyeball, pinned)', () => {
	it('aids every sub-2px band at 8 px/m and marks the close pair dense', () => {
		const aids = wallAidsAt(8);
		for (const aid of aids.values()) expect(aid).not.toBe('none');
		const dense = [...aids.values()].filter((aid) => aid === 'dense');
		expect(dense.length).toBe(2);
	});

	it('stands the bands alone at 20 and 100 px/m', () => {
		for (const ppm of [20, 100]) {
			for (const aid of wallAidsAt(ppm).values()) expect(aid).toBe('none');
		}
	});

	it('paints the aid as a separate mark over the preserved band', () => {
		// The aid is computed by the real salience pipeline at the same zoom the
		// plan is drawn at, then rendered through the shipped component: the band
		// polyline is unconditional, and the aid is *added* to it rather than
		// replacing it.
		const aids = wallAidsAt(8);
		const rendered = renderAt(8);
		const bands = elementsWithClass(rendered, 'wall-line');
		const silhouettes = elementsWithClass(rendered, 'wall-silhouette');
		expect(bands).toHaveLength(aids.size);
		expect(silhouettes).toHaveLength(aids.size);
		expect(silhouettes.every((element) => element.tag === 'polyline')).toBe(true);
		// The aid is a *mark*, never a measurement: it carries no band width of its
		// own, so nothing downstream can read a scale out of it.
		expect(silhouettes.every((element) => element.attrs.style === undefined)).toBe(true);
		expect(bands.every((element) => element.attrs.style?.includes('--architecture-band-width'))).toBe(
			true
		);
	});

	it('collapses the stacked profiles to the one neutral aid when a pair is dense', () => {
		const aids = wallAidsAt(8);
		const dense = [...aids.values()].filter((aid) => aid === 'dense').length;
		expect(dense).toBeGreaterThan(0);
		const rendered = renderAt(8);
		// One casing per Wall that is *not* dense; the dense pair keeps its band and
		// its neutral aid and loses the inner profile (casing skipped).
		expect(elementsWithClass(rendered, 'wall-casing')).toHaveLength(aids.size - dense);
		expect(elementsWithClass(rendered, 'wall-line')).toHaveLength(aids.size);
		expect(elementsWithClass(rendered, 'wall-silhouette')).toHaveLength(aids.size);
	});

	it('drops the aid entirely once the bands stand on their own', () => {
		const aids = wallAidsAt(8);
		for (const ppm of [20, 100]) {
			const rendered = renderAt(ppm);
			expect(elementsWithClass(rendered, 'wall-line')).toHaveLength(aids.size);
			expect(elementsWithClass(rendered, 'wall-silhouette')).toHaveLength(0);
			expect(elementsWithClass(rendered, 'wall-casing')).toHaveLength(aids.size);
		}
		// The aid's ink is 1px screen ink under its own token, read from the
		// compiler's stylesheet rather than a regex over the file.
		const silhouette = planSvgRule('.wall-silhouette');
		expect(silhouette['stroke-width']).toBe('1');
		expect(silhouette.stroke).toContain('var(--editor-plan-silhouette)');
	});
});

/** The shipped plan at a zoom, with the real salience projection for that zoom. */
function renderAt(pixelsPerMeter: number): ReturnType<typeof renderPlanSvg> {
	const { geometry } = compileWallFirstLayoutGeometry(thinWallDocument());
	const model = buildPlanRenderModel(geometry);
	const view: PlanViewportState = { ...createPlanViewportState(), pixelsPerMeter };
	const presentation = resolvePlanSalience({ model, view }, createPlanSalienceMemory());
	return renderPlanSvg({ model, planView: view, presentation });
}
