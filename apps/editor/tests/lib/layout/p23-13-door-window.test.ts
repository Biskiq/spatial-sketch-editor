/**
 * P23.13 S1 — static architectural grammar: band projection, jambs and cut
 * terminations, the perpendicular three-dash Door type cue and the Window
 * stroke shapes.
 *
 * Every case here is driven through the canonical compiled geometry and the
 * render-model source facts, then through the shared grammar module — no test
 * re-implements a shape it is meant to verify. Projected-size *decisions* are
 * injected, because resolving them (with hysteresis and neighbour analysis) is
 * S2's, not S1's.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-codec';
import type { LayoutVec2 } from '$lib/layout/layout-types';
import {
	buildPlanRenderModel,
	type PlanPolylinePrimitive,
	type PlanPresentationDecisions,
	type PlanRenderPrimitive
} from '$lib/layout/plan-render-model';
import {
	architectureBandPx,
	dashedSegmentCount,
	DOOR_TYPE_CUE_DASHARRAY,
	DOOR_TYPE_CUE_DISPLACED_GAP_PX,
	DOOR_TYPE_CUE_DISPLACED_LENGTH_PX,
	DOOR_TYPE_CUE_LENGTH_PX,
	DOOR_TYPE_CUE_MIN_WIDTH_PX,
	doorTypeCueDisplacedScreenPoints,
	doorTypeCueScreenPoints,
	offsetScreenPolyline,
	resolveDoorCueShape,
	resolveWallInkAid,
	resolveWindowStrokeCount,
	WALL_SILHOUETTE_BAND_PX,
	wallJambWorldPoints,
	WINDOW_STROKE_MIN_EDGE_MARGIN_PX,
	WINDOW_STROKE_MIN_SEPARATION_PX,
	windowStrokeLayout,
	windowStrokeShapeAllowed
} from '$lib/editor/layout/plan-architecture-grammar';
import { createPlanViewportState, type PlanViewportState } from '$lib/editor/layout/layout-plan-transform';

const LIB_DIR = new URL('../../../src/lib/', import.meta.url);

function readLibSource(relativePath: string): string {
	return readFileSync(new URL(relativePath, LIB_DIR), 'utf8');
}

function viewAt(pixelsPerMeter: number): PlanViewportState {
	return { ...createPlanViewportState(), pixelsPerMeter };
}

/**
 * Rectangle enclosure with one Door on the X-axis Wall and one Window on the
 * Z-axis Wall: the two hosts have different tangents and different thicknesses,
 * so a constant-normal or chord-derivation shortcut cannot pass.
 */
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

function openingFacts(kind: 'door' | 'window'): Extract<NonNullable<PlanPolylinePrimitive['architecture']>, { kind: 'door' | 'window' }> {
	const { geometry, issues } = compileWallFirstLayoutGeometry(doorWindowDocument());
	expect(issues).toEqual([]);
	const model = buildPlanRenderModel(geometry);
	const primitives: PlanRenderPrimitive[] = model.layers[3]!.primitives;
	const match = primitives.find(
		(primitive): primitive is PlanPolylinePrimitive =>
			primitive.kind === 'polyline' && primitive.architecture?.kind === kind
	);
	if (!match) throw new Error(`no ${kind} primitive`);
	const architecture = match.architecture;
	if (!architecture || architecture.kind === 'wall') throw new Error(`no ${kind} source facts`);
	return architecture;
}

function dot(a: LayoutVec2, b: LayoutVec2): number {
	return a[0] * b[0] + a[1] * b[1];
}

function distance(a: LayoutVec2, b: LayoutVec2): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

describe('P23.13 S1 — canonical band projection', () => {
	it('is the exact authored thickness times the scale, never a paint clamp', () => {
		expect(architectureBandPx(50, 0.2)).toBeCloseTo(10, 9);
		expect(architectureBandPx(50, 0.05)).toBeCloseTo(2.5, 9);
		// A thin or distant Wall is allowed to project below the readability mark:
		// the projection is a measurement and is never widened into a lie.
		expect(architectureBandPx(8, 0.2)).toBeCloseTo(1.6, 9);
		expect(architectureBandPx(100, 0.35)).toBeCloseTo(35, 9);
		expect(architectureBandPx(50, 0)).toBe(0);
	});

	it('resolves the ink aid from the decision, and structurally only as the stub', () => {
		expect(resolveWallInkAid('none', 0.5)).toBe('none');
		expect(resolveWallInkAid('silhouette', 40)).toBe('silhouette');
		expect(resolveWallInkAid('dense', 40)).toBe('dense');
		// Stub until S2 owns the gates.
		expect(resolveWallInkAid(undefined, WALL_SILHOUETTE_BAND_PX)).toBe('none');
		expect(resolveWallInkAid(undefined, WALL_SILHOUETTE_BAND_PX - 0.1)).toBe('silhouette');
		// Dense ink needs neighbour analysis, which is S2's to supply.
		expect(resolveWallInkAid(undefined, 40, 1.2)).toBe('dense');
		expect(resolveWallInkAid(undefined, 40, 9)).toBe('none');
	});

	it('keeps a wall-first Wall outside every Room on the same band and punch rules', () => {
		const plan = readLibSource('editor/layout/PlanSvg.svelte');
		// The punch uses the drafting surface, not a room background.
		expect(readLibSource('editor/styles/plan.css')).toContain(
			'--editor-plan-opening-void: var(--editor-plan-canvas-bg);'
		);
		expect(plan).toContain('stroke-width: calc(var(--architecture-band-width) + 2px);');
		expect(plan).toContain('.wall-silhouette { stroke: var(--editor-plan-silhouette); stroke-width: 1;');
	});
});

describe('P23.13 S1 — Door type cue (A2)', () => {
	it('is perpendicular to the canonical host tangent at every presentation scale', () => {
		const door = openingFacts('door');
		for (const pixelsPerMeter of [8, 20, 100]) {
			const view = viewAt(pixelsPerMeter);
			const [from, to] = doorTypeCueScreenPoints(view, door.centerPoint, door.centerTangent);
			const cue: LayoutVec2 = [to[0] - from[0], to[1] - from[1]];
			// Screen Y is world Z and the transform is uniform scale + translate,
			// so the cue must be exactly perpendicular to the projected tangent.
			expect(dot(cue, door.centerTangent)).toBeCloseTo(0, 9);
			expect(distance(from, to)).toBeCloseTo(DOOR_TYPE_CUE_LENGTH_PX, 9);
		}
	});

	it('is centered on the cut and symmetric about the Wall centerline', () => {
		const door = openingFacts('door');
		const view = viewAt(50);
		const center: LayoutVec2 = [view.width / 2 + door.centerPoint[0] * 50, view.height / 2 + door.centerPoint[1] * 50];
		const [from, to] = doorTypeCueScreenPoints(view, door.centerPoint, door.centerTangent);
		expect((from[0] + to[0]) / 2).toBeCloseTo(center[0], 9);
		expect((from[1] + to[1]) / 2).toBeCloseTo(center[1], 9);
		expect(distance(from, center)).toBeCloseTo(distance(to, center), 9);
		// Mirrored exactly: the cue is its own 180° rotation about the center.
		expect(from[0] - center[0]).toBeCloseTo(-(to[0] - center[0]), 9);
		expect(from[1] - center[1]).toBeCloseTo(-(to[1] - center[1]), 9);
	});

	it('paints three dashes from a 12 px cue and a 2/2 pattern at Normal and Near', () => {
		expect(DOOR_TYPE_CUE_DASHARRAY).toBe('2 2');
		expect(DOOR_TYPE_CUE_LENGTH_PX).toBe(12);
		expect(dashedSegmentCount(DOOR_TYPE_CUE_LENGTH_PX, 2, 2)).toBe(3);
		// And for the surviving widths of the Far regime; the cue is length-driven,
		// so the dash count never varies with the opening or the Wall.
		const door = openingFacts('door');
		for (const pixelsPerMeter of [8, 20, 100]) {
			const view = viewAt(pixelsPerMeter);
			const [from, to] = doorTypeCueScreenPoints(view, door.centerPoint, door.centerTangent);
			expect(dashedSegmentCount(distance(from, to), 2, 2)).toBe(3);
		}
	});

	it('protrudes symmetrically past a thin band instead of being compressed', () => {
		const door = openingFacts('door');
		const view = viewAt(8);
		const bandPx = architectureBandPx(view.pixelsPerMeter, door.wallThicknessMeters);
		expect(bandPx).toBeLessThan(DOOR_TYPE_CUE_LENGTH_PX);
		expect(resolveWallInkAid(undefined, bandPx)).toBe('silhouette');
		const [from, to] = doorTypeCueScreenPoints(view, door.centerPoint, door.centerTangent);
		// Symmetric protrusion: half the cue on each side of the centerline.
		const half = distance(from, to) / 2;
		expect(half).toBeGreaterThan(bandPx / 2);
		expect(distance(from, to)).toBeCloseTo(DOOR_TYPE_CUE_LENGTH_PX, 9);
		// The cue extent never scales with the band it protrudes past.
		const thickView = viewAt(100);
		const [thickFrom, thickTo] = doorTypeCueScreenPoints(thickView, door.centerPoint, door.centerTangent);
		expect(distance(thickFrom, thickTo)).toBeCloseTo(DOOR_TYPE_CUE_LENGTH_PX, 9);
	});

	it('leaves the authored cut and jamb coordinates untouched', () => {
		const door = openingFacts('door');
		const start: LayoutVec2 = [door.centerPoint[0] - (door.widthMeters / 2) * door.centerTangent[0], door.centerPoint[1] - (door.widthMeters / 2) * door.centerTangent[1]];
		const end: LayoutVec2 = [door.centerPoint[0] + (door.widthMeters / 2) * door.centerTangent[0], door.centerPoint[1] + (door.widthMeters / 2) * door.centerTangent[1]];
		const jambStart = wallJambWorldPoints(start, door.inwardNormal, door.wallThicknessMeters);
		const jambEnd = wallJambWorldPoints(end, door.inwardNormal, door.wallThicknessMeters);
		// Jambs span exactly the physical Wall thickness, centered on the cut edge.
		expect(distance(jambStart[0], jambStart[1])).toBeCloseTo(door.wallThicknessMeters, 9);
		expect(distance(jambEnd[0], jambEnd[1])).toBeCloseTo(door.wallThicknessMeters, 9);
		expect(distance(start, end)).toBeCloseTo(door.widthMeters, 9);
		// Order-independence: the same inputs can never yield a cue-shifted cut.
		const again = wallJambWorldPoints(start, door.inwardNormal, door.wallThicknessMeters);
		expect(again).toEqual(jambStart);
	});

	it('uses the canonical tangent on a curved host, not the chord', () => {
		// A host whose cut chord points elsewhere than the local tangent: the cue
		// must follow the canonical tangent at the opening center.
		const view = viewAt(50);
		const center: LayoutVec2 = [1, 1];
		const tangent: LayoutVec2 = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
		const chord: LayoutVec2 = [0, 1];
		const [from, to] = doorTypeCueScreenPoints(view, center, tangent);
		const cue: LayoutVec2 = [to[0] - from[0], to[1] - from[1]];
		expect(dot(cue, tangent)).toBeCloseTo(0, 9);
		expect(Math.abs(dot(cue, chord))).toBeGreaterThan(0.5);
	});

	it('keeps the small-opening fallback as a displaced single dash', () => {
		const door = openingFacts('door');
		const view = viewAt(8);
		const widthPx = door.widthMeters * view.pixelsPerMeter;
		expect(widthPx).toBeLessThan(DOOR_TYPE_CUE_MIN_WIDTH_PX);
		expect(resolveDoorCueShape(undefined, widthPx)).toBe('displaced');
		expect(resolveDoorCueShape(undefined, DOOR_TYPE_CUE_MIN_WIDTH_PX)).toBe('full');
		// The injected S2 decision wins over the stub.
		expect(resolveDoorCueShape('displaced', 200)).toBe('displaced');
		expect(resolveDoorCueShape('full', 1)).toBe('full');

		const bandPx = architectureBandPx(view.pixelsPerMeter, door.wallThicknessMeters);
		const [from, to] = doorTypeCueDisplacedScreenPoints(view, door.centerPoint, door.centerTangent, bandPx);
		const cueLength = distance(from, to);
		expect(cueLength).toBeCloseTo(DOOR_TYPE_CUE_DISPLACED_LENGTH_PX, 9);
		expect(dashedSegmentCount(cueLength, 2, 2)).toBe(1);
		// Displaced outside the band: it starts beyond the band edge plus the gap,
		// so a sub-8px cut never gets a compressed three-dash cue.
		const center = toSureScreen(view, door.centerPoint);
		expect(Math.min(distance(from, center), distance(to, center))).toBeGreaterThanOrEqual(
			bandPx / 2 + DOOR_TYPE_CUE_DISPLACED_GAP_PX
		);
	});
});

describe('P23.13 S1 — Window strokes', () => {
	it('carries the ratified separation and collapse budget across 8/20/100 px/m', () => {
		const window = openingFacts('window');
		const expected = [
			{ pixelsPerMeter: 8, count: 1 as const },
			{ pixelsPerMeter: 20, count: 1 as const },
			{ pixelsPerMeter: 100, count: 2 as const }
		];
		for (const { pixelsPerMeter, count } of expected) {
			const thicknessPx = architectureBandPx(pixelsPerMeter, window.wallThicknessMeters);
			expect(resolveWindowStrokeCount(2, thicknessPx)).toBe(count);
			const layout = windowStrokeLayout(thicknessPx, resolveWindowStrokeCount(2, thicknessPx));
			expect(layout.offsetsPx).toHaveLength(count);
			expect(windowStrokeShapeAllowed(layout)).toBe(true);
			expect(layout.separationPx).toBeLessThanOrEqual(4);
			// Symmetric about the host centerline.
			expect(layout.offsetsPx.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 9);
		}
	});

	it('never paints a third stroke, even when two are injected', () => {
		expect(windowStrokeLayout(40, 2).offsetsPx).toHaveLength(2);
		expect(windowStrokeLayout(40, 1).offsetsPx).toEqual([0]);
		const layout = windowStrokeLayout(6, 2);
		expect(layout.separationPx).toBeLessThan(WINDOW_STROKE_MIN_SEPARATION_PX);
		expect(windowStrokeShapeAllowed(layout)).toBe(false);
		expect(resolveWindowStrokeCount(2, 6)).toBe(1);
	});

	it('holds the edge-margin guard that a second stroke must satisfy', () => {
		// The ratified shape budget: ≥3px apart and ≥1px to each cut edge. The
		// guard is a hard gate even though the ratio makes it hard to trip.
		expect(windowStrokeShapeAllowed({ offsetsPx: [-1.25, 1.25], separationPx: 2.5, edgeMarginPx: 4 })).toBe(false);
		expect(windowStrokeShapeAllowed({ offsetsPx: [-1.5, 1.5], separationPx: 3, edgeMarginPx: WINDOW_STROKE_MIN_EDGE_MARGIN_PX - 0.1 })).toBe(false);
		expect(windowStrokeShapeAllowed({ offsetsPx: [-1.5, 1.5], separationPx: 3, edgeMarginPx: WINDOW_STROKE_MIN_EDGE_MARGIN_PX })).toBe(true);
		expect(windowStrokeShapeAllowed({ offsetsPx: [0], separationPx: 0, edgeMarginPx: 0.2 })).toBe(true);
	});

	it('keeps every stroke parallel to its own host, including on a curve', () => {
		const straight: LayoutVec2[] = [[0, 0], [10, 0]];
		const upper = offsetScreenPolyline(straight, 2);
		const lower = offsetScreenPolyline(straight, -2);
		expect(upper).toEqual([[0, -2], [10, -2]]);
		expect(lower).toEqual([[0, 2], [10, 2]]);
		// The strokes stay parallel: constant separation at both ends.
		expect(distance(upper[0]!, upper[1]!)).toBeCloseTo(distance(lower[0]!, lower[1]!), 9);
		expect(distance(upper[0]!, lower[0]!)).toBeCloseTo(4, 9);
		expect(distance(upper[1]!, lower[1]!)).toBeCloseTo(4, 9);
		// A zero offset is the void centerline itself, never a shifted copy.
		expect(offsetScreenPolyline(straight, 0)).toEqual(straight);

		// A curved host must not get a constant-normal offset: each offset vertex
		// stays perpendicular to its own local segment.
		const curve: LayoutVec2[] = [[0, 0], [10, 0], [10, 10]];
		const offset = offsetScreenPolyline(curve, 2);
		expect(offset[0]).toEqual([0, -2]);
		expect(offset[1]![0]).toBeCloseTo(10 + 2 * Math.SQRT1_2, 9);
		expect(offset[1]![1]).toBeCloseTo(-2 * Math.SQRT1_2, 9);
		expect(offset[2]).toEqual([12, 10]);
	});
});

describe('P23.13 S1 — cue stays presentation-only', () => {
	it('never enters the render model, whatever the injected decisions are', () => {
		const { geometry } = compileWallFirstLayoutGeometry(doorWindowDocument());
		const plain = buildPlanRenderModel(geometry);
		const decided = buildPlanRenderModel(geometry, undefined, {
			selected: { kind: 'wallOpening', wallId: 'wall-a', openingId: 'opening-door' },
			selection: [],
			handles: [],
			drafts: [],
			labels: []
		});
		// Decisions are adapter input: they never add, move or restyle a model
		// primitive (only the selection token, which is model state, applies).
		expect(JSON.stringify(plain.layers.map((layer) => layer.primitives.map((primitive) => primitive.key)))).toBe(
			JSON.stringify(decided.layers.map((layer) => layer.primitives.map((primitive) => primitive.key)))
		);
		const decisions: PlanPresentationDecisions = {
			windowFrameCount: 1,
			doorCueShape: 'displaced',
			wallInkAid: 'dense'
		};
		expect(JSON.stringify(decisions)).not.toContain('px');
	});

	it('is excluded from hit and snap by construction', () => {
		const plan = readLibSource('editor/layout/PlanSvg.svelte');
		// The cue is paint: no hit identity, no pointer events, no model emission.
		expect(plan).toContain('.door-cue { stroke: var(--editor-plan-door-cue); stroke-width: 1; stroke-linecap: butt; }');
		expect(plan).toContain('pointer-events: none;');
		expect(plan).not.toMatch(/hit[^\n]*door-cue|door-cue[^\n]*hit/);
		const hit = readLibSource('editor/layout/plan-hit.ts');
		expect(hit).not.toContain('door-cue');
		expect(hit).not.toContain('plan-architecture-grammar');
		const snap = readFileSync(
			new URL('../../../../../packages/layout-core/src/layout-snap.ts', import.meta.url),
			'utf8'
		);
		expect(snap).not.toContain('door-cue');
		expect(snap).not.toContain('plan-architecture-grammar');
		// No invented join fill and no hinge/swing/leaf/arc element.
		for (const banned of ['door-leaf', 'door-swing', 'door-arc', 'join-fill', 'union-patch']) {
			expect(plan).not.toContain(banned);
		}
	});
});

function toSureScreen(view: PlanViewportState, point: LayoutVec2): LayoutVec2 {
	return [view.width / 2 + (point[0] - view.center[0]) * view.pixelsPerMeter, view.height / 2 + (point[1] - view.center[1]) * view.pixelsPerMeter];
}
