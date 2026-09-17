/**
 * P23.13 S10 — thin-wall-at-zoom eyeball, pinned (open since S2).
 *
 * Real pipeline end to end: canonical compile → render model → salience
 * projection at 8/20/100 px/m. At 8 px/m every sub-2px band resolves the
 * centered 1px silhouette aid with the canonical band preserved beneath, and
 * the close thin pair resolves dense (one neutral aid, casing skipped); at
 * 20/100 px/m the bands stand alone. The paint conditions themselves are
 * source-pinned against the template that owns them.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { createPlanViewportState } from '$lib/editor/layout/layout-plan-transform';

const here = dirname(fileURLToPath(import.meta.url));

function readLibSource(relativePath: string): string {
	return readFileSync(resolve(here, '../../../src/lib', relativePath), 'utf8');
}

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
		const plan = readLibSource('editor/layout/PlanSvg.svelte');
		// The band polyline is unconditional; the aid is additive.
		expect(plan).toContain("{#if inkAid !== 'none'}");
		expect(plan).toContain('class="wall-silhouette"');
		// Dense collapses stacked profiles to the one neutral aid (casing skipped).
		expect(plan).toContain("{#if inkAid !== 'dense'}");
		// The aid is 1px screen ink, excluded from measure/snap/hit by construction.
		expect(plan).toContain('.wall-silhouette { stroke: var(--editor-plan-silhouette); stroke-width: 1;');
	});
});
