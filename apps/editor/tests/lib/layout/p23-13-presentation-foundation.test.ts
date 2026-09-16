/**
 * P23.13 S0 — presentation-foundation contract.
 *
 * S0 makes the band/ink split real and exposes the canonical source facts every
 * later slice paints from. It is behavior-preserving for compiled geometry and
 * for the render model's committed projection: the model gains renderer-neutral
 * facts only (never CSS px, zoom regime, or hysteresis), and the SVG adapter
 * stops deriving parts of the opening grammar itself.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';
import { compileLayoutGeometry, compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-codec';
import {
	buildPlanRenderModel,
	PLAN_PRESENTATION_DEFAULTS,
	type PlanPolylinePrimitive,
	type PlanRenderPrimitive
} from '$lib/layout/plan-render-model';
import { g2MultipleOpeningsDocument } from './__fixtures__/layout-g2-fixtures';

const LIB_DIR = new URL('../../../src/lib/', import.meta.url);

function readLibSource(relativePath: string): string {
	return readFileSync(new URL(relativePath, LIB_DIR), 'utf8');
}

/**
 * Two opening hosts with non-axis-aligned continuation: `wall-a` runs along X,
 * `wall-b` runs along Z, so a cue rotated from the canonical tangent cannot
 * accidentally pass a constant-normal check.
 */
function wallFirstOpeningDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-b', point: [6, 0] },
			{ id: 'j-c', point: [6, 4] },
			{ id: 'j-d', point: [0, 4] }
		],
		walls: [
			{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.35, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const }
		],
		openings: [
			{ id: 'opening-door', wallId: 'wall-a', kind: 'door', offset: 2, width: 0.9, height: 2.1, sillHeight: 0, profile: 'rectangular' },
			{ id: 'opening-window', wallId: 'wall-b', kind: 'window', offset: 1.5, width: 1.2, height: 1.2, sillHeight: 1, profile: 'rectangular' }
		],
		rooms: [
			{
				id: 'room-main',
				name: 'Main Room',
				boundary: [
					{ wallId: 'wall-a', direction: 'forward' },
					{ wallId: 'wall-b', direction: 'forward' },
					{ wallId: 'wall-c', direction: 'forward' },
					{ wallId: 'wall-d', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		objects: []
	};
}

function openingPrimitives(primitives: readonly PlanRenderPrimitive[]): PlanPolylinePrimitive[] {
	return primitives.filter((primitive): primitive is PlanPolylinePrimitive => {
		if (primitive.kind !== 'polyline') return false;
		const kind = primitive.architecture?.kind;
		return kind === 'door' || kind === 'window';
	});
}

describe('P23.13 S0 — opening source facts', () => {
	it('copies canonical host orientation, extent and thickness for wall-first openings', () => {
		const document = wallFirstOpeningDocument();
		const { geometry, issues } = compileWallFirstLayoutGeometry(document);
		expect(issues).toEqual([]);
		const model = buildPlanRenderModel(geometry);
		const openings = openingPrimitives(model.layers[3]!.primitives);
		expect(openings).toHaveLength(2);

		const compiledById = new Map(
			(geometry.walls ?? []).flatMap((wall) => wall.openings.map((opening) => [opening.openingId, { wall, opening }] as const))
		);

		for (const primitive of openings) {
			const architecture = primitive.architecture!;
			if (architecture.kind === 'wall') throw new Error('expected an opening source fact');
			const hit = primitive.hit!;
			if (hit.kind !== 'wallOpening') throw new Error('expected a canonical wall-first opening hit');
			const source = compiledById.get(hit.openingId);
			expect(source).toBeDefined();
			const { wall, opening } = source!;

			// Renderer-neutral passthrough: exact canonical values, no rounding,
			// no screen-space reinterpretation.
			expect(architecture.centerTangent).toEqual(opening.center.tangent);
			expect(architecture.centerNormal).toEqual(opening.center.normal);
			expect(architecture.yaw).toBe(opening.center.yaw);
			expect(architecture.offsetMeters).toBe(opening.offset);
			expect(architecture.widthMeters).toBe(opening.width);
			expect(architecture.wallThicknessMeters).toBe(wall.thickness);
			expect(architecture.kind).toBe(opening.kind);
		}
	});

	it('keeps the legacy room-owned path on the same source facts', () => {
		const { geometry } = compileLayoutGeometry(g2MultipleOpeningsDocument());
		const model = buildPlanRenderModel(geometry);
		const openings = openingPrimitives(model.layers[3]!.primitives);
		expect(openings.map((primitive) => primitive.architecture?.kind)).toEqual(['door', 'window', 'door']);

		for (const primitive of openings) {
			const architecture = primitive.architecture!;
			if (architecture.kind === 'wall') throw new Error('expected an opening source fact');
			expect(Math.hypot(architecture.centerTangent[0], architecture.centerTangent[1])).toBeCloseTo(1, 9);
			expect(Math.hypot(architecture.centerNormal[0], architecture.centerNormal[1])).toBeCloseTo(1, 9);
			// The room-relative vector stays a separate fact from the canonical normal.
			expect(Math.hypot(architecture.inwardNormal[0], architecture.inwardNormal[1])).toBeCloseTo(1, 9);
			expect(Number.isFinite(architecture.yaw)).toBe(true);
			expect(architecture.offsetMeters).toBeGreaterThanOrEqual(0);
		}
	});

	it('carries no screen-space, zoom-regime, or hysteresis state into architecture facts', () => {
		const { geometry } = compileWallFirstLayoutGeometry(wallFirstOpeningDocument());
		const model = buildPlanRenderModel(geometry);

		for (const layer of model.layers) {
			for (const primitive of layer.primitives) {
				if (primitive.kind !== 'polyline' || !primitive.architecture) continue;
				const keys = Object.keys(primitive.architecture).sort();
				if (primitive.architecture.kind === 'wall') {
					expect(keys).toEqual(['kind', 'role', 'thicknessMeters']);
				} else {
					expect(keys).toEqual([
						'centerNormal',
						'centerTangent',
						'inwardNormal',
						'kind',
						'offsetMeters',
						'wallThicknessMeters',
						'widthMeters',
						'yaw'
					]);
				}
				expect(JSON.stringify(primitive.architecture)).not.toMatch(/px|zoom|regime|hysteres/i);
			}
		}
	});

	it('resolves presentation decisions outside the model, with ratified defaults', () => {
		expect(PLAN_PRESENTATION_DEFAULTS).toEqual({ windowFrameCount: 2, wallSilhouetteAid: false });
	});
});

describe('P23.13 S0 — adapter paint contract', () => {
	const plan = readLibSource('editor/layout/PlanSvg.svelte');
	const tokens = readLibSource('editor/styles/plan.css');

	it('projects the canonical band width and keeps the ink floor out of geometry', () => {
		expect(plan).toContain('const ARCHITECTURE_TEMPORARY_INK_FLOOR_PX = 7;');
		expect(plan).toContain('--architecture-band-width: ${bandWidth}px; --architecture-ink-width: ${inkWidth}px;');
		// The clamp is no longer the geometry truth it used to be.
		expect(plan).not.toContain('Math.max(7,');
		expect(plan).toContain('stroke-width: var(--architecture-ink-width);');
		expect(plan).toContain('stroke-width: calc(var(--architecture-ink-width) + 2px);');
		expect(plan).not.toContain('--architecture-width');
	});

	it('paints at most two Window strokes and never the retired third frame', () => {
		expect(plan).toContain('const WINDOW_FRAME_RATIO = 0.18;');
		expect(plan).toContain('? [0]');
		expect(plan).toContain('[-WINDOW_FRAME_RATIO, WINDOW_FRAME_RATIO]');
		expect(plan).not.toContain('0.28');
		// The injected count is the S2 salience decision, consumed as input.
		expect(plan).toContain('presentation.windowFrameCount ?? PLAN_PRESENTATION_DEFAULTS.windowFrameCount');
	});

	it('retires the host-parallel Door threshold and leaves no second ink path', () => {
		expect(plan).not.toContain('door-threshold');
		expect(plan).not.toContain('door-leaf');
		expect(plan).not.toContain('door-swing');
	});

	it('paints from the band/ink/silhouette/partition/cue role tokens', () => {
		for (const token of [
			'--editor-plan-wall-band',
			'--editor-plan-wall-ink',
			'--editor-plan-silhouette',
			'--editor-plan-partition-body',
			'--editor-plan-door-cue',
			'--editor-plan-opening-void'
		]) {
			expect(tokens).toContain(`${token}:`);
		}
		// S0 converts the paint path at today's values: no visual drift.
		expect(tokens).toContain('--editor-plan-wall-band: var(--editor-plan-wall-fill);');
		expect(tokens).toContain('--editor-plan-wall-ink: var(--editor-plan-wall);');
		expect(tokens).toContain('--editor-plan-opening-void: var(--editor-plan-room-bg);');
		expect(plan).toContain('stroke: var(--editor-plan-wall-band);');
		expect(plan).toContain('stroke: var(--editor-plan-wall-ink);');
		expect(plan).toContain('stroke: var(--editor-plan-opening-void);');
	});
});
