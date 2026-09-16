/**
 * P23.13 S2 — salience: semantic-zoom regime, per-feature projected gates and
 * their hysteresis, gesture freeze, paper/grid/ruler thresholds.
 *
 * The three questions this slice separates are tested separately: the *regime*
 * traversal (policy + hysteresis), the *per-feature* gates (Door fallback,
 * Window stroke count, Wall ink aid, passive Scene ink), and the *freeze* that
 * holds the vocabulary still while a gesture is live. Nothing here asserts a
 * document field: every value is transient presentation tuning.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-codec';
import { LAYOUT_PLAN_GRID_STEP } from '$lib/layout/layout-wall-first-precision';
import {
	buildPlanRenderModel,
	PLAN_PRESENTATION_SOURCE_DEFAULT,
	type PlanPolylinePrimitive
} from '$lib/layout/plan-render-model';
import {
	buildPlanGrid,
	buildSegmentedScaleBar,
	createPlanViewportState,
	planGridDetail,
	planRulerStep,
	snapToGrid,
	PLAN_GRID_MAJOR_MIN_SPACING_PX,
	PLAN_GRID_MINOR_MIN_SPACING_PX,
	PLAN_RULER_MIN_LABEL_SPACING_PX,
	type PlanViewportState
} from '$lib/editor/layout/layout-plan-transform';
import {
	JUNCTION_HANDLES_MIN_PX_PER_M,
	ROOM_LABEL_MIN_PX_PER_M
} from '$lib/editor/layout/plan-overlays';
import {
	classifyPlanRegime,
	createPlanSalienceMemory,
	nextPlanRegime,
	planSalienceGates,
	resolvePlanSalience,
	PLAN_ARCHITECTURE_CONTROLS_MIN_PX_PER_M,
	PLAN_DOOR_CUE_FULL_ENTER_PX,
	PLAN_DOOR_CUE_FULL_LEAVE_PX,
	PLAN_REGIME_FAR_TO_NORMAL_PX_PER_M,
	PLAN_REGIME_NEAR_MIN_PX_PER_M,
	PLAN_REGIME_NEAR_TO_NORMAL_PX_PER_M,
	PLAN_REGIME_NORMAL_TO_FAR_PX_PER_M,
	PLAN_REGIME_NORMAL_TO_NEAR_PX_PER_M,
	PLAN_ROOM_LABELS_MIN_PX_PER_M,
	PLAN_SCENE_INK_DEFAULT,
	PLAN_SCENE_INK_FAR,
	PLAN_WINDOW_SECOND_LINE_ENTER_PX,
	PLAN_WINDOW_SECOND_LINE_LEAVE_PX,
	type PlanSalienceMemory
} from '$lib/editor/layout/plan-salience';

const LIB_DIR = new URL('../../../src/lib/', import.meta.url);

function readLibSource(relativePath: string): string {
	return readFileSync(new URL(relativePath, LIB_DIR), 'utf8');
}

function viewAt(pixelsPerMeter: number): PlanViewportState {
	return { ...createPlanViewportState(), pixelsPerMeter };
}

/** Rectangle enclosure, one Door on a 0.2 m Wall and one Window on a 0.35 m Wall. */
function doorWindowDocument(): LayoutDocumentWallFirst {
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

/** Two genuinely parallel Walls 0.06 m apart — the dense-ink case. */
function parallelWallsDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'p-1', point: [0, 0] },
			{ id: 'p-2', point: [4, 0] },
			{ id: 'p-3', point: [0, 0.06] },
			{ id: 'p-4', point: [4, 0.06] }
		],
		walls: [
			{ id: 'wall-1', startJunctionId: 'p-1', endJunctionId: 'p-2', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-2', startJunctionId: 'p-3', endJunctionId: 'p-4', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const }
		],
		openings: [],
		rooms: [],
		objects: []
	};
}

/** One straight Wall split at a junction — a continuation, not a stack. */
function splitWallDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 's-1', point: [0, 0] },
			{ id: 's-2', point: [2, 0] },
			{ id: 's-3', point: [4, 0] }
		],
		walls: [
			{ id: 'wall-left', startJunctionId: 's-1', endJunctionId: 's-2', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-right', startJunctionId: 's-2', endJunctionId: 's-3', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const }
		],
		openings: [],
		rooms: [],
		objects: []
	};
}

function modelFor(document: LayoutDocumentWallFirst) {
	const { geometry } = compileWallFirstLayoutGeometry(document);
	return buildPlanRenderModel(geometry);
}

function polylineWith(
	model: ReturnType<typeof buildPlanRenderModel>,
	predicate: (primitive: PlanPolylinePrimitive) => boolean
): PlanPolylinePrimitive {
	for (const layer of model.layers) {
		for (const primitive of layer.primitives) {
			if (primitive.kind === 'polyline' && predicate(primitive)) return primitive;
		}
	}
	throw new Error('no matching polyline primitive');
}

const doorModel = modelFor(doorWindowDocument());
const doorPrimitive = polylineWith(
	doorModel,
	(primitive) => primitive.architecture?.kind === 'door'
);
const windowPrimitive = polylineWith(
	doorModel,
	(primitive) => primitive.architecture?.kind === 'window'
);
const wallPrimitive = polylineWith(doorModel, (primitive) => primitive.architecture?.kind === 'wall');

describe('P23.13 S2 — regime', () => {
	it('uses the ratified initial bands and hysteresis overlaps', () => {
		expect(classifyPlanRegime(23.99)).toBe('far');
		expect(classifyPlanRegime(24)).toBe('normal');
		expect(classifyPlanRegime(79.99)).toBe('normal');
		expect(classifyPlanRegime(PLAN_REGIME_NEAR_MIN_PX_PER_M)).toBe('near');
		// A first frame has no history, so degenerate input is never 'near'.
		expect(classifyPlanRegime(0)).toBe('far');
		expect(classifyPlanRegime(Number.NaN)).toBe('far');

		expect(PLAN_REGIME_FAR_TO_NORMAL_PX_PER_M).toBe(28);
		expect(PLAN_REGIME_NORMAL_TO_FAR_PX_PER_M).toBe(20);
		expect(PLAN_REGIME_NORMAL_TO_NEAR_PX_PER_M).toBe(88);
		expect(PLAN_REGIME_NEAR_TO_NORMAL_PX_PER_M).toBe(72);
	});

	it('traverses 19/25/28/80/88/79/71 without flicker', () => {
		const memory = createPlanSalienceMemory();
		const view = viewAt(19);
		const regimes = [19, 25, 28, 80, 88, 79, 71].map((pixelsPerMeter) => {
			view.pixelsPerMeter = pixelsPerMeter;
			return resolvePlanSalience({ model: doorModel, view }, memory).regime;
		});
		// 80 stays Normal (below the 88 enter) and 79 stays Near (above the 72
		// leave): the direction of travel decides, not the instantaneous scale.
		expect(regimes).toEqual(['far', 'far', 'normal', 'normal', 'near', 'near', 'normal']);
		// Naive re-classification of the same samples, for contrast: 25, 80 and 79
		// each sit on the other side of their own band boundary.
		expect([19, 25, 28, 80, 88, 79, 71].map(classifyPlanRegime)).toEqual([
			'far',
			'normal',
			'normal',
			'near',
			'near',
			'normal',
			'normal'
		]);
	});

	it('resolves a pre-regime→far crossing in one step', () => {
		// A jump (document re-frame, reset, keyboard zoom) must not walk the
		// regimes one at a time.
		expect(nextPlanRegime('near', 2)).toBe('far');
		expect(nextPlanRegime('far', 200)).toBe('near');
		expect(nextPlanRegime('far', 27.9)).toBe('far');
	});

	it('carries the regime policy: passive Scene ink, room labels, controls', () => {
		const far = planSalienceGates('far', 8);
		const normal = planSalienceGates('normal', 50);
		const near = planSalienceGates('near', 100);
		expect(far.sceneInk).toBe(PLAN_SCENE_INK_FAR);
		expect(normal.sceneInk).toBe(PLAN_SCENE_INK_DEFAULT);
		expect(near.sceneInk).toBe(PLAN_SCENE_INK_DEFAULT);
		expect(far.sceneInk).toBe(0.15);
		expect(normal.sceneInk).toBe(0.3);

		// Per-feature floors are projected size, not regime: the same 0.2 m Wall
		// keeps its band at near and its aid at far.
		expect(planSalienceGates('far', 5.99).architectureControls).toBe(false);
		expect(planSalienceGates('far', 6).architectureControls).toBe(true);
		expect(planSalienceGates('normal', 6).roomLabels).toBe(true);
		expect(planSalienceGates('normal', 5.99).roomLabels).toBe(false);
	});

	it('keeps one gate table: the overlay floors are the salience floors', () => {
		expect(ROOM_LABEL_MIN_PX_PER_M).toBe(PLAN_ROOM_LABELS_MIN_PX_PER_M);
		expect(JUNCTION_HANDLES_MIN_PX_PER_M).toBe(PLAN_ARCHITECTURE_CONTROLS_MIN_PX_PER_M);
	});
});

describe('P23.13 S2 — Door fallback resolution', () => {
	it('enters the full cue at 9 px and leaves it at 7 px', () => {
		const memory = createPlanSalienceMemory();
		const view = viewAt(8);
		const shapeAt = (pixelsPerMeter: number) => {
			view.pixelsPerMeter = pixelsPerMeter;
			return resolvePlanSalience({ model: doorModel, view }, memory).decisionsFor(doorPrimitive).doorCueShape;
		};
		// 0.9 m opening: 7.2 px → displaced, then 7.65 px → still displaced,
		// 9 px → full, then back down to 7.2 px (≥7 leave) → stays full.
		expect(shapeAt(8)).toBe('displaced');
		expect(shapeAt(8.5)).toBe('displaced');
		expect(shapeAt(10)).toBe('full');
		expect(shapeAt(8)).toBe('full');
		// Below the leave threshold it finally falls back, once.
		expect(shapeAt(7.5)).toBe('displaced');
		expect(shapeAt(7.5)).toBe('displaced');
		expect(PLAN_DOOR_CUE_FULL_ENTER_PX).toBe(9);
		expect(PLAN_DOOR_CUE_FULL_LEAVE_PX).toBe(7);
	});

	it('keeps the decision per Opening, not per frame', () => {
		const memory = createPlanSalienceMemory();
		const view = viewAt(100);
		expect(resolvePlanSalience({ model: doorModel, view }, memory).decisionsFor(doorPrimitive).doorCueShape).toBe('full');
		// The Window on the same document does not inherit the Door's memory.
		expect(memory.doorCueShape.has(windowPrimitive.key)).toBe(false);
		expect(memory.doorCueShape.get(doorPrimitive.key)).toBe('full');
	});

	it('drops memories for pruned primitives only', () => {
		const memory = createPlanSalienceMemory();
		const view = viewAt(100);
		resolvePlanSalience({ model: doorModel, view }, memory);
		memory.windowStrokes.set('opening-that-was-deleted', 2);
		memory.doorCueShape.set('opening-that-was-deleted', 'full');
		resolvePlanSalience({ model: doorModel, view }, memory);
		expect(memory.windowStrokes.has('opening-that-was-deleted')).toBe(false);
		expect(memory.doorCueShape.has('opening-that-was-deleted')).toBe(false);
		expect(memory.windowStrokes.get(windowPrimitive.key)).toBe(2);
	});
});

describe('P23.13 S2 — Window stroke resolution', () => {
	it('resolves 1/1/2 strokes for the 0.35 m host at 8/20/100 px/m', () => {
		const memory = createPlanSalienceMemory();
		const view = viewAt(8);
		const countAt = (pixelsPerMeter: number) => {
			view.pixelsPerMeter = pixelsPerMeter;
			return resolvePlanSalience({ model: doorModel, view }, memory).decisionsFor(windowPrimitive).windowFrameCount;
		};
		expect(countAt(8)).toBe(1);
		expect(countAt(20)).toBe(1);
		expect(countAt(100)).toBe(2);
	});

	it('holds the second stroke inside the 3.5/2.5 separation band', () => {
		const memory = createPlanSalienceMemory();
		const view = viewAt(100);
		expect(resolvePlanSalience({ model: doorModel, view }, memory).decisionsFor(windowPrimitive).windowFrameCount).toBe(2);
		// 0.35 m at 25.4 px/m → 8.89 px thickness → 3.2 px separation: inside the
		// 3.5/2.5 band, so a frame that already has two strokes keeps them ...
		view.pixelsPerMeter = 25.4;
		expect(resolvePlanSalience({ model: doorModel, view }, memory).decisionsFor(windowPrimitive).windowFrameCount).toBe(2);
		// ... while a frame starting from one stroke needs the higher 3.5 px.
		const fresh = createPlanSalienceMemory();
		expect(resolvePlanSalience({ model: doorModel, view }, fresh).decisionsFor(windowPrimitive).windowFrameCount).toBe(1);
		expect(PLAN_WINDOW_SECOND_LINE_ENTER_PX).toBe(3.5);
		expect(PLAN_WINDOW_SECOND_LINE_LEAVE_PX).toBe(2.5);
	});

	it('never lets hysteresis override the shape budget', () => {
		// A memory of two strokes cannot survive a host too thin to carry them:
		// 0.1 m at 50 px/m → 5 px thickness → 1.8 px separation.
		const facts = windowPrimitive.architecture;
		if (!facts || facts.kind === 'wall') throw new Error('no window source facts');
		const thinWindow: PlanPolylinePrimitive = {
			...windowPrimitive,
			key: 'thin-window',
			architecture: { ...facts, wallThicknessMeters: 0.1 }
		};
		const memory = createPlanSalienceMemory();
		memory.windowStrokes.set('thin-window', 2);
		const view = viewAt(50);
		expect(
			resolvePlanSalience({ model: doorModel, view }, memory).decisionsFor(thinWindow).windowFrameCount
		).toBe(1);
	});
});

describe('P23.13 S2 — Wall ink aid resolution', () => {
	it('resolves the silhouette aid from the projected band at 8/20/100 px/m', () => {
		const memory = createPlanSalienceMemory();
		const view = viewAt(8);
		const aidAt = (pixelsPerMeter: number) => {
			view.pixelsPerMeter = pixelsPerMeter;
			return resolvePlanSalience({ model: doorModel, view }, memory).decisionsFor(wallPrimitive).wallInkAid;
		};
		// 0.2 m Wall: 1.6 px at Far gets the aid, 4 px and 20 px do not.
		expect(aidAt(8)).toBe('silhouette');
		expect(aidAt(20)).toBe('none');
		expect(aidAt(100)).toBe('none');
	});

	it('collapses competing parallel profiles to the dense aid', () => {
		const model = modelFor(parallelWallsDocument());
		const view = viewAt(100);
		const salience = resolvePlanSalience({ model, view });
		const walls = model.layers
			.flatMap((layer) => layer.primitives)
			.filter(
				(primitive): primitive is PlanPolylinePrimitive =>
					primitive.kind === 'polyline' && primitive.architecture?.kind === 'wall'
			);
		expect(walls.length).toBe(2);
		// 0.2 m bands at 100 px/m are 20 px each on centerlines 6 px apart.
		expect(salience.projectedInk.separationPx.get(walls[0]!.key)).toBeCloseTo(6, 6);
		for (const wall of walls) {
			expect(salience.projectedInk.denseKeys.has(wall.key)).toBe(true);
			expect(salience.decisionsFor(wall).wallInkAid).toBe('dense');
		}
		// The room document's walls are metres apart and keep their band.
		expect(resolvePlanSalience({ model: doorModel, view }).projectedInk.denseKeys.size).toBe(0);
	});

	it('never treats a join as competing ink: corners and continuations survive', () => {
		// The room fixture: four Walls meeting at four corners, all at distance 0
		// from their neighbours. A join is not a stack, so nothing is collapsed.
		const corners = resolvePlanSalience({ model: doorModel, view: viewAt(100) });
		expect(corners.projectedInk.denseKeys.size).toBe(0);
		expect(corners.projectedInk.separationPx.size).toBeGreaterThan(0);

		// One straight Wall split at a junction: the pass sees the pair (distance 0)
		// and still refuses, because the two halves are the same line.
		const split = modelFor(splitWallDocument());
		const salience = resolvePlanSalience({ model: split, view: viewAt(100) });
		const halves = split.layers
			.flatMap((layer) => layer.primitives)
			.filter(
				(primitive): primitive is PlanPolylinePrimitive =>
					primitive.kind === 'polyline' && primitive.architecture?.kind === 'wall'
			);
		expect(halves).toHaveLength(2);
		expect(salience.projectedInk.denseKeys.size).toBe(0);
		for (const half of halves) {
			expect(salience.decisionsFor(half).wallInkAid).toBe('none');
		}
	});

	it('passes passive Scene ink and leaves feedback ink alone', () => {
		const plan = readLibSource('editor/layout/PlanSvg.svelte');
		expect(plan).toContain("return style === 'scene-footprint' ? `opacity: ${presentation.sceneInk}` : undefined;");
		// Active / hovered / selected Scene entities are exempt by construction.
		expect(plan).not.toContain("style === 'scene-footprint-selected'");
		expect(PLAN_PRESENTATION_SOURCE_DEFAULT.sceneInk).toBe(1);
	});
});

describe('P23.13 S2 — gesture freeze', () => {
	it('holds the vocabulary while geometry keeps resolving', () => {
		const memory = createPlanSalienceMemory();
		const view = viewAt(100);
		const frozen = resolvePlanSalience({ model: doorModel, view }, memory);
		expect(frozen.regime).toBe('near');
		expect(frozen.decisionsFor(doorPrimitive).doorCueShape).toBe('full');

		// The pointer drags and the wheel turns mid-gesture: the held snapshot is
		// a plain object, so none of it can move under the gesture.
		view.pixelsPerMeter = 8;
		expect(frozen.regime).toBe('near');
		expect(frozen.gates.sceneInk).toBe(PLAN_SCENE_INK_DEFAULT);
		expect(frozen.sceneInk).toBe(PLAN_SCENE_INK_DEFAULT);
		expect(frozen.decisionsFor(doorPrimitive).doorCueShape).toBe('full');

		// Live resolution at gesture end differs, which is what makes the freeze
		// observable rather than a no-op.
		view.pixelsPerMeter = 7.5;
		const live = resolvePlanSalience({ model: doorModel, view }, memory);
		expect(live.regime).toBe('far');
		expect(live.decisionsFor(doorPrimitive).doorCueShape).toBe('displaced');
	});

	it('judges a mid-gesture primitive without disturbing frozen memory', () => {
		const memory = createPlanSalienceMemory();
		const view = viewAt(100);
		const frozen = resolvePlanSalience({ model: doorModel, view }, memory);
		const newDoor: PlanPolylinePrimitive = { ...doorPrimitive, key: 'gesture-new-door' };
		expect(frozen.decisionsFor(newDoor).doorCueShape).toBe('full');
		// The fallback path resolved at the frozen scale and wrote nothing.
		expect(memory.doorCueShape.has('gesture-new-door')).toBe(false);
		expect(frozen.decisionsFor(newDoor).doorCueShape).toBe('full');
	});

	it('never walks the regime forward twice for the same scale', () => {
		const memory = createPlanSalienceMemory();
		const view = viewAt(28);
		expect(resolvePlanSalience({ model: doorModel, view }, memory).regime).toBe('normal');
		expect(resolvePlanSalience({ model: doorModel, view }, memory).regime).toBe('normal');
		expect(memory.regime).toBe('normal');
	});
});

describe('P23.13 S2 — grid, ruler and scale gates', () => {
	it('gates grid detail per line class without touching the snap step', () => {
		expect(PLAN_GRID_MAJOR_MIN_SPACING_PX).toBe(16);
		expect(PLAN_GRID_MINOR_MIN_SPACING_PX).toBe(12);
		expect(planGridDetail(10)).toEqual({ major: false, minor: false });
		expect(planGridDetail(16)).toEqual({ major: true, minor: false });
		expect(planGridDetail(40)).toEqual({ major: true, minor: false });
		expect(planGridDetail(48)).toEqual({ major: true, minor: true });

		// Detail dropping must never reach snapping: at 10 px/m no grid is drawn
		// and 0.25 m snapping still applies.
		const view = viewAt(10);
		expect(buildPlanGrid(view)).toEqual([]);
		expect(snapToGrid([0.3, 0.3], LAYOUT_PLAN_GRID_STEP)).toEqual([0.25, 0.25]);
		expect(snapToGrid([0.6, -0.4], LAYOUT_PLAN_GRID_STEP)).toEqual([0.5, -0.5]);
	});

	it('keeps every ruler step on a 1/2/5 progression above the label floor', () => {
		const scales = [2, 3, 5, 8, 10, 16, 24, 28, 40, 50, 79, 80, 88, 100, 240, 2000];
		for (const pixelsPerMeter of scales) {
			const step = planRulerStep(pixelsPerMeter);
			// 1/2/5 × 10ⁿ.
			const magnitude = 10 ** Math.floor(Math.log10(step));
			expect([1, 2, 5, 10]).toContain(Math.round(step / magnitude));
			// Default target: ~80 px, always clear of the floor.
			expect(step * pixelsPerMeter).toBeGreaterThanOrEqual(PLAN_RULER_MIN_LABEL_SPACING_PX);
		}
		// A caller asking for tighter labels gets the step promoted, never a
		// crowded ruler.
		expect(planRulerStep(50, 40)).toBe(1);
		expect(planRulerStep(8, 40)).toBe(10);
		expect(planRulerStep(8, 40) * 8).toBeGreaterThanOrEqual(PLAN_RULER_MIN_LABEL_SPACING_PX);
	});

	it('keeps the scale bar discrete and segmented', () => {
		const scale = buildSegmentedScaleBar(50);
		expect(scale.segments).toHaveLength(2);
		expect(scale.meters).toBe(2);
		expect(scale.segments.reduce((sum, segment) => sum + segment.widthPixel, 0)).toBeCloseTo(
			scale.meters * 50,
			9
		);
		// Segments stay at least 80 px total at any scale.
		for (const pixelsPerMeter of [2, 10, 50, 400, 2000]) {
			const bar = buildSegmentedScaleBar(pixelsPerMeter);
			const width = bar.segments.reduce((sum, segment) => sum + segment.widthPixel, 0);
			expect(width).toBeGreaterThanOrEqual(80);
		}
	});
});

describe('P23.13 S2 — ratified paper and single-token ownership', () => {
	const tokens = readLibSource('editor/styles/tokens.css');
	const plan = readLibSource('editor/styles/plan.css');

	it('paints the ratified cool paper with its cool grid companions', () => {
		expect(tokens).toContain('--editor-plan-bg: #f5f7f8;');
		expect(tokens).toContain('--editor-plan-grid-major: #ced6dd;');
		expect(tokens).toContain('--editor-plan-grid-minor: #e4e9ed;');
		expect(tokens).not.toContain('--editor-plan-bg: #f5f3ee;');
	});

	it('lets tokens.css own the grid greys: no later file redefines them', () => {
		// The regression this pins: plan.css loads after tokens.css, so a second
		// definition there silently reverts the ratified palette.
		expect(plan).not.toMatch(/--editor-plan-grid-(major|minor):\s*#[0-9a-fA-F]{3,8}/);
		// The roles still resolve through the token.
		expect(plan).toContain('--editor-plan-canvas-bg: var(--editor-plan-bg);');
	});

	it('keeps the band/ink split and the opening punch on the drafting surface', () => {
		expect(plan).toContain('--editor-plan-wall-band: var(--editor-plan-wall-fill);');
		expect(plan).toContain('--editor-plan-wall-ink: var(--editor-plan-wall);');
		expect(plan).toContain('--editor-plan-opening-void: var(--editor-plan-canvas-bg);');
	});

	it('persists nothing: salience is transient and geometry never reads it', () => {
		const salience = readLibSource('editor/layout/plan-salience.ts');
		for (const banned of ['JSON.stringify', 'localStorage', 'layout-wall-first-codec', 'history']) {
			expect(salience).not.toContain(banned);
		}
		// The document/render-model side never imports salience, so a threshold
		// cannot enter a snapshot, the history or the geometry contract.
		expect(readLibSource('layout/plan-render-model.ts')).not.toContain('plan-salience');
		expect(readLibSource('layout/layout-geometry.ts')).not.toContain('plan-salience');
		// And the memories are keyed per primitive, so no shared counter can drift.
		const memory: PlanSalienceMemory = createPlanSalienceMemory();
		expect(memory.windowStrokes).toBeInstanceOf(Map);
		expect(memory.doorCueShape).toBeInstanceOf(Map);
	});
});
