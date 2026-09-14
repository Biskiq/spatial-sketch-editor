/**
 * P23.11 slice 6b — the Svelte surfaces that expose the curve contract.
 *
 * Slice 6a pinned the pure contract (hit authority, the transient gesture, the
 * commit path). This pins the surfaces that drive it:
 *
 * - the Plan overlay draws one handle per control of the SELECTED curved Wall,
 *   and nothing when no curved Wall is selected or below the Junction-handle
 *   scale floor — an invisible affordance must not be hittable;
 * - the viewport exposes controls on the select and hover hit paths only, so the
 *   context menu and the Opening tools keep the Wall body they used to resolve;
 * - the viewport's own wiring asserts on source text, matching how the P23.10
 *   direct-edit gestures are pinned: the gesture contract lives in the SFC, so
 *   nothing but the SFC can be inspected for it.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildLayoutPreviewModel } from '$lib/editor/layout/layout-mesh-factory';
import {
	JUNCTION_HANDLES_MIN_PX_PER_M,
	buildPlanInteractionProjection
} from '$lib/editor/layout/plan-overlays';
import {
	createLayoutInteractionState,
	selectLayoutPhysicalWall,
	selectLayoutRoom
} from '$lib/editor/layout/layout-interaction';
import { updateWallFirstWallCurveAnchor } from '$lib/editor/layout/layout-preview-state.svelte';
import {
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument
} from '$lib/editor/layout/layout-preview-state.svelte';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-wall-first-types';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
import type { PlanInteractionProjection } from '$lib/layout/plan-render-model';
import type { PlanCurveControlCandidate } from '$lib/editor/layout/plan-hit';

const LIB_DIR = fileURLToPath(new URL('../../../../src/lib', import.meta.url));

function readLibSource(relativePath: string): string {
	return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
}

const LINE = { kind: 'line' } as const;

/** A closed 4×3 m Room whose bottom Wall `w1` is bowed 0.5 m into the Room. */
function curvedRoom(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] },
			{ id: 'B', point: [4, 0] },
			{ id: 'C', point: [4, 3] },
			{ id: 'D', point: [0, 3] }
		],
		walls: [
			{
				id: 'w1',
				startJunctionId: 'A',
				endJunctionId: 'B',
				role: 'boundary',
				thickness: 0.2,
				height: 3,
				centerline: {
					kind: 'auto-bezier',
					interiorAnchors: [{ id: 'anchor-a1', point: [2, 0.5] }]
				}
			},
			{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w4', startJunctionId: 'D', endJunctionId: 'A', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
		],
		rooms: [
			{
				id: 'room',
				name: 'Room',
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
		openings: [],
		objects: []
	};
}

/** The viewport's context shape for the parts these tests exercise. */
function context(
	controls: readonly PlanCurveControlCandidate[],
	overrides: Record<string, unknown> = {}
) {
	return {
		junctions: [
			{ id: 'A', point: [0, 0] as [number, number] },
			{ id: 'B', point: [4, 0] as [number, number] }
		],
		junctionFocus: new Set(['A', 'B']),
		curveControls: controls,
		roomNames: new Map<string, string>(),
		runStartPoint: null,
		issues: [],
		...overrides
	};
}

function curveControlHandles(projection: PlanInteractionProjection) {
	return projection.handles.filter(
		(primitive) => primitive.kind === 'circle' && primitive.style.startsWith('curve-control')
	);
}

function projectionFor(
	document: LayoutDocumentWallFirst,
	controls: readonly PlanCurveControlCandidate[],
	options: { selected?: boolean; curved?: boolean; pixelsPerMeter?: number } = {}
) {
	const model = buildLayoutPreviewModel(document).model;
	const state = createLayoutInteractionState();
	if (options.selected !== false) selectLayoutPhysicalWall(state, 'w1');
	if (options.pixelsPerMeter !== undefined) state.planView.pixelsPerMeter = options.pixelsPerMeter;
	return buildPlanInteractionProjection(state, [], model, context(controls));
}

const ONE_CONTROL: readonly PlanCurveControlCandidate[] = [
	{ wallId: 'w1', anchorId: 'anchor-a1', point: [2, 0.5] }
];

// ---------------------------------------------------------------------------
// Overlay rendering
// ---------------------------------------------------------------------------

describe('P23.11 slice 6b — Plan control handles', () => {
	it('draws one handle per control of the selected curved Wall, keyed by { wallId, anchorId }', () => {
		const projection = projectionFor(curvedRoom(), ONE_CONTROL);
		const handles = curveControlHandles(projection);
		expect(handles).toHaveLength(1);
		expect(handles[0]).toMatchObject({
			kind: 'circle',
			center: [2, 0.5],
			radiusPx: 5,
			style: 'curve-control',
			hit: { kind: 'wallCurveControl', wallId: 'w1', anchorId: 'anchor-a1' }
		});
	});

	it('renders no control handle when nothing exposes controls', () => {
		// No curved Wall selected → the viewport passes an empty list.
		expect(curveControlHandles(projectionFor(curvedRoom(), []))).toHaveLength(0);
		// A Room selection never exposes a Wall's controls.
		const model = buildLayoutPreviewModel(curvedRoom()).model;
		const state = createLayoutInteractionState();
		selectLayoutRoom(state, 'room');
		expect(
			curveControlHandles(buildPlanInteractionProjection(state, [], model, context([])))
		).toHaveLength(0);
		// A straight Wall has no controls to expose.
		expect(curveControlHandles(projectionFor(curvedRoom(), []))).toHaveLength(0);
	});

	it('hides and refuses to expose controls below the Junction-handle scale floor', () => {
		const controls = curveControlHandles(
			projectionFor(curvedRoom(), ONE_CONTROL, {
				pixelsPerMeter: JUNCTION_HANDLES_MIN_PX_PER_M - 1
			})
		);
		expect(controls).toHaveLength(0);
	});

	it('marks the hovered control with hover language, never a second selection', () => {
		const projection = projectionFor(curvedRoom(), [
			{ wallId: 'w1', anchorId: 'anchor-a1', point: [2, 0.5] },
			{ wallId: 'w1', anchorId: 'anchor-a2', point: [3, 0.4] }
		]);
		expect(projection.selected).toEqual({ kind: 'physicalWall', wallId: 'w1' });

		const model = buildLayoutPreviewModel(curvedRoom()).model;
		const state = createLayoutInteractionState();
		selectLayoutPhysicalWall(state, 'w1');
		const hovered = buildPlanInteractionProjection(
			state,
			[],
			model,
			context([
				{ wallId: 'w1', anchorId: 'anchor-a1', point: [2, 0.5] },
				{ wallId: 'w1', anchorId: 'anchor-a2', point: [3, 0.4] }
			]),
			{ kind: 'wallCurveControl', wallId: 'w1', anchorId: 'anchor-a2' }
		);
		const styles = curveControlHandles(hovered).map((primitive) => primitive.style);
		expect(styles).toEqual(['curve-control', 'curve-control-hovered']);
		// Hover is presentation only: the Wall is still the one durable selection.
		expect(hovered.selected).toEqual({ kind: 'physicalWall', wallId: 'w1' });
	});

	it('centers every handle on the document anchor it belongs to', () => {
		// The overlay consumes the caller's list verbatim, so a committed control
		// position reaches the handle without a second derivation.
		const preview = createEmptyLayoutPreviewState();
		expect(
			importLayoutPreviewJson(preview, serializeWallFirstLayoutDocument(curvedRoom()))
		).toBe(true);
		expect(updateWallFirstWallCurveAnchor(preview, 'w1', 'anchor-a1', [2.6, 1.4]).success).toBe(true);

		const live = layoutPreviewDocument(preview);
		if (!('formatVersion' in live)) throw new Error('expected wall-first document');
		const wall = live.walls.find((candidate) => candidate.id === 'w1')!;
		if (wall.centerline.kind !== 'auto-bezier') throw new Error('expected a curved Wall');
		const controls = wall.centerline.interiorAnchors.map((anchor) => ({
			wallId: wall.id,
			anchorId: anchor.id,
			point: [anchor.point[0], anchor.point[1]] as [number, number]
		}));

		const handles = curveControlHandles(projectionFor(live, controls));
		expect(
			handles.map((primitive) => (primitive.kind === 'circle' ? primitive.center : null))
		).toEqual([[2.6, 1.4]]);
	});
});

// ---------------------------------------------------------------------------
// Viewport wiring contract
// ---------------------------------------------------------------------------

describe('P23.11 slice 6b — viewport hit and gesture wiring', () => {
	const viewport = readLibSource('editor/layout/LayoutPlanViewport.svelte');

	it('exposes controls on the select and hover hit paths only', () => {
		// Exactly the two interaction paths (pointer-down select, hover) ask for
		// controls: both pass the shared options object.
		expect(viewport).toContain(
			'LAYOUT_PLAN_HIT_RADIUS_PX / interaction.planView.pixelsPerMeter,\n\t\t\tplanHitOptions()\n\t\t);\n\t\tif (!target) {'
		);
		expect(viewport).toContain(
			'hoverPoint,\n\t\t\t\t\t\t\tLAYOUT_PLAN_HIT_RADIUS_PX / interaction.planView.pixelsPerMeter,\n\t\t\t\t\t\t\tplanHitOptions()'
		);
		// The Opening tools and the context menu keep the endpoint gate (and the
		// menu keeps no options at all), so a control can never block Opening
		// placement next to it or remove the Wall's own menu.
		expect(viewport).toContain(
			"planHitEndpointGate()\n\t\t\t);\n\t\t\tif (wallFirstLayoutDocument()) {"
		);
		expect(viewport).toContain('const target = resolvePlanHit(model.queries, point, tolerance);');
	});

	it('starts the control gesture from the hit without writing a second selection', () => {
		expect(viewport).toContain("if (target.kind === 'wallCurveControl') {");
		expect(viewport).toContain("kind: 'curve-control-move',");
		expect(viewport).toContain('selectLayoutPhysicalWall(interaction, target.wallId);');
		// The Wall stays the durable selection: no control selection slot exists.
		expect(viewport).not.toContain('selectLayoutCurveControl');
		expect(viewport).not.toContain('selectLayoutWallCurveControl');
	});

	it('freezes the baseline at pointer-down and routes the plan to the curve adapter', () => {
		expect(viewport).toContain('baselineAnchorPoint: [...baselineAnchorPoint] as LayoutVec2,');
		expect(viewport).toContain('curveExcludePoints: architectureEditJunctionExcludePoints()');
		expect(viewport).toContain(
			'updateWallFirstWallCurveAnchor(preview, gesture.wallId, gesture.anchorId, input);'
		);
		// A control move deforms only the edited Wall: both endpoint Junctions stay
		// put, so no neighbouring Wall reshapes and none is a frozen snap owner.
		expect(viewport).toContain('affectedWallIds: [baseline.wallId],');
	});

	it('exposes controls only for a selected curved Wall above the scale floor', () => {
		const controls = viewport.slice(
			viewport.indexOf('function selectedCurveControls'),
			viewport.indexOf('function planHitOptions')
		);
		expect(controls).toContain("if (selection.kind !== 'physicalWall') return [];");
		expect(controls).toContain(
			'if (interaction.planView.pixelsPerMeter < JUNCTION_HANDLES_MIN_PX_PER_M) return [];'
		);
		expect(controls).toContain("if (!wall || wall.centerline.kind !== 'auto-bezier') return [];");
		// The ONE list feeds both the rendered handles and the hit query.
		expect(viewport).toContain('curveControls: selectedCurveControls(document.walls),');
	});

	it('maps a control hit to hover identity so the hover language is reachable', () => {
		expect(viewport).toContain(
			"return { kind: 'wallCurveControl', wallId: hit.wallId, anchorId: hit.anchorId };"
		);
	});
});

// ---------------------------------------------------------------------------
// Inspector wiring contract
// ---------------------------------------------------------------------------

describe('P23.11 slice 6b — Inspector curve actions', () => {
	const inspector = readLibSource('editor/EditorInspector.svelte');

	it('converts both ways and lists the curved Wall controls', () => {
		expect(inspector).toContain('setSelectedWallCurved');
		expect(inspector).toContain('updateWallFirstWallCurve(layoutPreview, wall.id)');
		expect(inspector).toContain('updateWallFirstWallLine(layoutPreview, wall.id)');
		expect(inspector).toContain("checked={selectedWallFirstWall.centerline.kind === 'auto-bezier'}");
	});

	it('adds, moves and removes controls through the canonical adapter', () => {
		expect(inspector).toContain('insertWallFirstWallCurveAnchor(layoutPreview, wall.id,');
		expect(inspector).toContain(
			'updateWallFirstWallCurveAnchor(layoutPreview, wall.id, anchorId, point)'
		);
		expect(inspector).toContain('deleteWallFirstWallCurveAnchor(layoutPreview, wall.id, anchorId)');
	});

	it('reads the add-control coordinate from the compiled samples, never a re-derived midpoint', () => {
		const add = inspector.slice(
			inspector.indexOf('function addSelectedWallCurveAnchor'),
			inspector.indexOf('function updateSelectedWallCurveAnchor')
		);
		expect(add).toContain('const compiled = layoutPreview.geometry.walls.find');
		expect(add).toContain('const samples = compiled?.samples ?? [];');
		// Arc length is read from the compiled samples, never re-integrated here.
		expect(add).toContain('const half = (compiled?.length ?? 0) / 2;');
		expect(add).toContain('Math.abs(sample.distance - half) < Math.abs(best.distance - half)');
		expect(add).not.toContain('Math.hypot');
		// The planner owns projection onto the centerline; the panel passes a point.
		expect(add).toContain('[...midpoint.point] as [number, number]');
	});
});

// ---------------------------------------------------------------------------
// SVG adapter contract
// ---------------------------------------------------------------------------

describe('P23.11 slice 6b — SVG token for curve controls', () => {
	const svg = readLibSource('editor/layout/PlanSvg.svelte');

	it('renders the control token as a hollow handle distinct from a Junction handle', () => {
		expect(svg).toContain(
			'.curve-control { fill: var(--editor-plan-canvas-bg); stroke: var(--editor-plan-handle-stroke); stroke-width: 2; vector-effect: non-scaling-stroke; }'
		);
		expect(svg).toContain(
			'.curve-control.hovered, .curve-control-hovered { fill: var(--editor-plan-hover-stroke); stroke: var(--editor-plan-canvas-bg); }'
		);
		expect(svg).toContain("'curve-control-hovered': 'curve-control hovered'");
	});
});
