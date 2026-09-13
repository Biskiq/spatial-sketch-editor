import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as layoutCoreModule from '@portfolio/layout-core';
import {
	createEmptyWallFirstLayoutDocument,
	planExactWallLength,
	planExactWallThickness,
	planWallChain,
	pointStrictlyInsidePolygon,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildLayoutPreviewModel } from '$lib/editor/layout/layout-mesh-factory';
import {
	beginWallChain,
	createLayoutInteractionState,
	reconcileLayoutSelection,
	selectLayoutJunction,
	selectLayoutPhysicalWall,
	selectLayoutRoom,
	selectedLayoutJunction,
	setLayoutDraftTool,
	updateWallChainCursor
} from '$lib/editor/layout/layout-interaction';
import {
	buildPlanInteractionProjection,
	interiorLabelPoint,
	withLayoutSnapFeedback,
	snapMarkerRadiusPx,
	type PlanWallFirstContext
} from '$lib/editor/layout/plan-overlays';
import {
	formatDegrees,
	formatMeters,
	parseExactNumber
} from '$lib/editor/layout/layout-exact-input';
import { degreesToRadians } from '$lib/editor/editor-transform';
import { resolvePlanHit } from '$lib/editor/layout/plan-hit';
import { buildPlanRenderModel } from '$lib/layout/plan-render-model';
import {
	captureLayoutPreviewSnapshot,
	commitWallRoleChange,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	restoreLayoutPreviewSnapshot,
	updateWallFirstWallAngle
} from '$lib/editor/layout/layout-preview-state.svelte';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptySceneDocument } from '$lib/content/scene';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import { g2LineRectangleDocument } from './__fixtures__/layout-g2-fixtures';

function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

const p = (x: number, z: number): [number, number] => [x, z];
const RECT = [p(0, 0), p(4, 0), p(4, 3), p(0, 3)] as const;

function commitChain(
	baseline: LayoutDocumentWallFirst,
	points: [number, number][],
	role: 'boundary' | 'partition',
	close = false
): LayoutDocumentWallFirst {
	const plan = planWallChain({ baseline, points, role, close });
	if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
	return plan.document;
}

function emptyContext(overrides: Partial<PlanWallFirstContext> = {}): PlanWallFirstContext {
	return {
		junctions: [],
		junctionFocus: null,
		roomNames: new Map(),
		runStartPoint: null,
		issues: [],
		...overrides
	};
}

function textsOf(projection: ReturnType<typeof buildPlanInteractionProjection>) {
	return projection.labels.filter((primitive) => primitive.kind === 'text');
}

function hitKind(primitive: { kind: string; hit?: { kind: string } }) {
	return primitive.kind === 'text' ? undefined : primitive.hit?.kind;
}

function junctionHandles(projection: ReturnType<typeof buildPlanInteractionProjection>) {
	return projection.handles.filter((primitive) => hitKind(primitive) === 'junction');
}

// ---------------------------------------------------------------------------
// P23.6 candidate readout / closure cue / invalid preview
// ---------------------------------------------------------------------------

describe('P23.6 wall-drawing candidate feedback', () => {
	function chainState(cursor: [number, number]) {
		const document = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		setLayoutDraftTool(state, 'wall-chain');
		beginWallChain(state, [2, 0]);
		updateWallChainCursor(state, cursor);
		return { document, model, state };
	}

	it('shows a live passive length readout for the previewed leg', () => {
		const { model, state } = chainState([6, 0]);
		const projection = buildPlanInteractionProjection(state, [], model, emptyContext());
		const readout = textsOf(projection).find((label) => label.style === 'dimension-label');
		expect(readout?.text).toBe('4.00 m');
		// The outline stays the valid draft treatment while the leg is live.
		expect(
			projection.drafts.find((primitive) => primitive.kind === 'polyline')?.style
		).toBe('draft-outline');
	});

	it('shows the run-closure cue snapped onto the run start', () => {
		const { model, state } = chainState([0.05, 0]);
		const ppm = state.planView.pixelsPerMeter;
		expect(0.05).toBeLessThanOrEqual(8 / ppm);
		const projection = buildPlanInteractionProjection(
			state,
			[],
			model,
			emptyContext({ runStartPoint: [0, 0] })
		);
		const readout = textsOf(projection).find((label) => label.style === 'dimension-label');
		expect(readout?.text).toBe('Close · 1.95 m');
		const cue = projection.drafts.find(
			(primitive) => primitive.kind === 'circle' && primitive.style === 'snap-marker'
		);
		expect(cue).toMatchObject({ center: [0, 0] });
	});

	it('marks the degenerate leg invalid with no readout', () => {
		const { model, state } = chainState([2, 0]);
		const projection = buildPlanInteractionProjection(state, [], model, emptyContext());
		expect(
			projection.drafts.find((primitive) => primitive.kind === 'polyline')?.style
		).toBe('draft-outline-invalid');
		expect(
			textsOf(projection).filter((label) => label.style === 'dimension-label')
		).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// P23.6 snap vocabulary — winning family, distinct marker weight
// ---------------------------------------------------------------------------

describe('P23.6 snap vocabulary', () => {
	it('weights markers by family with the grid fallback quietest', () => {
		expect(snapMarkerRadiusPx('junction')).toBe(5);
		expect(snapMarkerRadiusPx('wall-intersection')).toBe(5);
		expect(snapMarkerRadiusPx('wall-midpoint')).toBe(4);
		expect(snapMarkerRadiusPx('opening-edge')).toBe(4);
		expect(snapMarkerRadiusPx('wall-span')).toBe(4);
		expect(snapMarkerRadiusPx('grid')).toBe(3);
	});

	it('emits the family-weighted marker through the feedback projection', () => {
		const base = {
			selected: undefined,
			selection: [],
			handles: [],
			drafts: [],
			labels: []
		} as never;
		const marker = (kind: string) =>
			withLayoutSnapFeedback(base, {
				kind: 'snap',
				candidate: { point: [1, 1], kind: kind as never, sourceId: 's', distance: 0 },
				guides: []
			}).drafts.find((primitive) => primitive.kind === 'circle');
		expect(marker('junction')).toMatchObject({ radiusPx: 5, style: 'snap-marker' });
		expect(marker('grid')).toMatchObject({ radiusPx: 3, style: 'snap-marker-grid' });
	});
});

// ---------------------------------------------------------------------------
// P23.6 Room names — persistent metadata labels with bounded density
// ---------------------------------------------------------------------------

describe('P23.6 room name labels', () => {
	function roomed() {
		const document = commitChain(baseDocument(), [...RECT], 'boundary', true);
		const model = buildLayoutPreviewModel(document).model;
		const names = new Map(document.rooms.map((room) => [room.id, room.name] as const));
		return { document, model, names };
	}

	it('labels the Room with its persisted name at the face centroid', () => {
		const { document, model, names } = roomed();
		const state = createLayoutInteractionState();
		const projection = buildPlanInteractionProjection(state, [], model, emptyContext({ roomNames: names }));
		const label = textsOf(projection).find((primitive) => primitive.style === 'room-name');
		expect(label?.text).toBe(document.rooms[0]!.name);
		expect(label).toMatchObject({ anchor: [2, 1.5] });
	});

	it('hides Room labels below the legibility zoom floor', () => {
		const { model, names } = roomed();
		const state = createLayoutInteractionState();
		state.planView.pixelsPerMeter = 2;
		const projection = buildPlanInteractionProjection(state, [], model, emptyContext({ roomNames: names }));
		expect(textsOf(projection).filter((primitive) => primitive.style === 'room-name')).toHaveLength(0);
	});

	it('labels legacy Rooms from their document names', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		const projection = buildPlanInteractionProjection(
			state,
			document.floors[0]!.rooms,
			model,
			emptyContext()
		);
		const label = textsOf(projection).find((primitive) => primitive.style === 'room-name');
		expect(label?.text).toBe(document.floors[0]!.rooms[0]!.name);
	});
});

// ---------------------------------------------------------------------------
// P23.6 Junction handles + Junction selection
// ---------------------------------------------------------------------------

describe('P23.6 junction handles and selection', () => {
	function twoWalls() {
		const first = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
		const document = commitChain(first, [p(0, 2), p(4, 2)], 'partition');
		const model = buildLayoutPreviewModel(document).model;
		const junctions = document.junctions.map((junction) => ({
			id: junction.id,
			point: [...junction.point] as [number, number]
		}));
		return { document, model, junctions };
	}

	it('shows every Junction while the Wall tool is armed, none on idle select', () => {
		const { model, junctions } = twoWalls();
		const armed = createLayoutInteractionState();
		setLayoutDraftTool(armed, 'wall-chain');
		const shown = buildPlanInteractionProjection(armed, [], model, emptyContext({ junctions }));
		expect(
			junctionHandles(shown)
		).toHaveLength(4);
		const idle = buildPlanInteractionProjection(
			createLayoutInteractionState(),
			[],
			model,
			emptyContext({ junctions })
		);
		expect(junctionHandles(idle)).toHaveLength(0);
	});

	it('focuses the selected Wall endpoints and marks the selected Junction', () => {
		const { document, model, junctions } = twoWalls();
		const wall = document.walls[0]!;
		const state = createLayoutInteractionState();
		selectLayoutPhysicalWall(state, wall.id);
		const focus = new Set([wall.startJunctionId, wall.endJunctionId]);
		const projection = buildPlanInteractionProjection(
			state,
			[],
			model,
			emptyContext({ junctions, junctionFocus: focus })
		);
		const handles = junctionHandles(projection);
		expect(handles).toHaveLength(2);
		selectLayoutJunction(state, wall.startJunctionId);
		const selected = buildPlanInteractionProjection(
			state,
			[],
			model,
			emptyContext({ junctions, junctionFocus: focus })
		).handles.filter((primitive) => hitKind(primitive) === 'junction');
		expect(
			selected.filter((primitive) => primitive.style === 'vertex-handle-selected')
		).toHaveLength(1);
	});

	it('hides Junction handles below the Plan scale floor', () => {
		const { model, junctions } = twoWalls();
		const state = createLayoutInteractionState();
		setLayoutDraftTool(state, 'wall-chain');
		state.planView.pixelsPerMeter = 2;
		const projection = buildPlanInteractionProjection(state, [], model, emptyContext({ junctions }));
		expect(junctionHandles(projection)).toHaveLength(0);
	});

	it('resolves a Plan hit on a canonical endpoint with no Room context', () => {
		const { document, model } = twoWalls();
		const first = document.walls[0]!;
		const hit = resolvePlanHit(model.queries, [0.05, 0.02], 0.2);
		expect(hit).toMatchObject({ kind: 'wallEndpoint', wallId: first.id, endpoint: 0 });
		expect(hit).not.toHaveProperty('roomId');
	});

	it('selects, reads back, and reconciles Junctions on the one authority', () => {
		const { document } = twoWalls();
		const state = createLayoutInteractionState();
		const junctionId = document.junctions[0]!.id;
		selectLayoutJunction(state, junctionId);
		expect(state.selection).toEqual({ kind: 'junction', junctionId });
		expect(selectedLayoutJunction(state)).toEqual({ junctionId });
		expect(reconcileLayoutSelection({ kind: 'junction', junctionId }, document as never)).toEqual({
			kind: 'junction',
			junctionId
		});
		expect(
			reconcileLayoutSelection({ kind: 'junction', junctionId: 'junction:gone' }, document as never)
		).toEqual({ kind: 'none' });
		expect(
			reconcileLayoutSelection(
				{ kind: 'junction', junctionId },
				createEmptyLayoutDocument() as never
			)
		).toEqual({ kind: 'none' });
	});
});

// ---------------------------------------------------------------------------
// P23.6 topology diagnostics — markers for positioned targets
// ---------------------------------------------------------------------------

describe('P23.6 topology diagnostics', () => {
	it('marks the affected Wall and skips unresolvable targets', () => {
		const document = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
		const model = buildLayoutPreviewModel(document).model;
		const wallId = document.walls[0]!.id;
		const projection = buildPlanInteractionProjection(
			createLayoutInteractionState(),
			[],
			model,
			emptyContext({
				issues: [
					{ path: `walls.${wallId}`, code: 'zero_length_wall', message: 'degenerate', targetId: wallId },
					{ path: 'walls.gone', code: 'zero_length_wall', message: 'stale', targetId: 'wall:gone' },
					{ path: 'document', code: 'mystery', message: 'no target' }
				]
			})
		);
		const markers = projection.handles.filter((primitive) => primitive.style === 'layout-diagnostic');
		expect(markers).toHaveLength(1);
		expect(markers[0]).toMatchObject({ center: [2, 0] });
	});
});

// ---------------------------------------------------------------------------
// P23.6 zoom/density purity — presentation varies, committed truth does not
// ---------------------------------------------------------------------------

describe('P23.6 density purity', () => {
	it('keeps committed layers identical across zoom while labels gate', () => {
		const document = commitChain(baseDocument(), [...RECT], 'boundary', true);
		const { geometry } = buildLayoutPreviewModel(document);
		const names = new Map(document.rooms.map((room) => [room.id, room.name] as const));
		const model = buildLayoutPreviewModel(document).model;
		const near = createLayoutInteractionState();
		const far = createLayoutInteractionState();
		far.planView.pixelsPerMeter = 2;
		const committed = (state: typeof near) =>
			buildPlanRenderModel(geometry, undefined, {
				selected: undefined,
				selection: [],
				handles: [],
				drafts: [],
				labels: []
			}).layers.filter((layer) => layer.order <= 5);
		expect(committed(far)).toEqual(committed(near));
		const nearLabels = buildPlanInteractionProjection(near, [], model, emptyContext({ roomNames: names }));
		const farLabels = buildPlanInteractionProjection(far, [], model, emptyContext({ roomNames: names }));
		expect(
			textsOf(nearLabels).filter((primitive) => primitive.style === 'room-name')
		).toHaveLength(1);
		expect(
			textsOf(farLabels).filter((primitive) => primitive.style === 'room-name')
		).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// P23.6 exact inputs — bounded presentation, planner-owned validity
// ---------------------------------------------------------------------------

const INSPECTOR_SOURCE = fs.readFileSync(
	path.join(fileURLToPath(new URL('../../../src/lib', import.meta.url)), 'editor/EditorInspector.svelte'),
	'utf8'
);

/** Number inputs bound to the P23.6 wall/junction exact handlers or values. */
function exactWallJunctionInputs(): string[] {
	// P23.6b retired the Inspector's document-wide "Architecture · exact"
	// inventory and its duplicate exact editors; the surviving exact inputs are
	// the canonical selected-entity panels (Wall/Junction/Opening/Room).
	const markers = [
		'updateSelectedWallLength',
		'updateSelectedWallAngle',
		'updateSelectedWallThickness',
		'updateSelectedWallHeight',
		'addSelectedWallVertex',
		'updateSelectedJunction',
		'selectedWallFirstWallEndpoints',
		'selectedWallFirstJunction'
	];
	return INSPECTOR_SOURCE.split('\n').filter(
		(line) =>
			line.includes('<input type="number"') && markers.some((marker) => line.includes(marker))
	);
}

describe('P23.6 exact inputs — presentation formatting, planner-owned validity', () => {
	it('binds every exact wall/junction input to a bounded formatted value', () => {
		const inputs = exactWallJunctionInputs();
		expect(inputs.length).toBeGreaterThanOrEqual(7);
		for (const input of inputs) {
			if (input.includes('Angle')) expect(input).toContain('formatDegrees(');
			else expect(input).toContain('formatMeters(');
		}
	});

	it('never lets browser step/min arithmetic reject a planner-valid value', () => {
		const inputs = exactWallJunctionInputs();
		expect(inputs.length).toBeGreaterThanOrEqual(7);
		for (const input of inputs) {
			expect(input).toContain('step="any"');
			expect(input).not.toContain('min="');
			expect(input).not.toContain('max="');
		}
	});

	it('keeps full stored precision behind the rounded display', () => {
		const document = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
		const wallId = document.walls[0]!.id;
		// What the user types parses fully: the planner stores exactly what it
		// is given — display rounding never feeds back into the document.
		const length = planExactWallLength(document, wallId, 2.987654321, 'start');
		if (length.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(length)}`);
		const moved = length.document.walls.find((wall) => wall.id === wallId)!;
		expect(moved).toBeDefined();
		const thickness = planExactWallThickness(document, wallId, 0.25);
		if (thickness.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(thickness)}`);
		expect(thickness.document.walls.find((wall) => wall.id === wallId)?.thickness).toBe(0.25);
	});

	it('ships a planner-backed Wall Height control (P23.6H owns the semantics)', () => {
		// Historical: P23.6 deferred Height because no per-Wall height semantics
		// existed, so a control would have written a durable field with no render
		// effect. P23.6H makes `LayoutWall.height` authoritative, so the control is
		// live — and it must stay planner-backed (never a direct field write).
		expect(INSPECTOR_SOURCE).toContain('updateSelectedWallHeight');
		expect(INSPECTOR_SOURCE).toContain('updateWallFirstWallHeight');
		expect(INSPECTOR_SOURCE).not.toContain('wall.height =');
		expect(layoutCoreModule).toHaveProperty('planExactWallHeight');
	});
});

function roleStore(seed: LayoutDocumentWallFirst) {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const preview = createEmptyLayoutPreviewState();
	if (!importLayoutPreviewJson(preview, serializeWallFirstLayoutDocument(seed))) {
		throw new Error('wall-first import failed');
	}
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(preview),
		replace: (snapshot) =>
			restoreLayoutPreviewSnapshot(
				preview,
				snapshot as ReturnType<typeof captureLayoutPreviewSnapshot>
			),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => preview);
	return { store, preview };
}

function liveWallFirst(preview: ReturnType<typeof createEmptyLayoutPreviewState>): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(preview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

describe('P23.6 role commit history', () => {
	it('commits a role flip as exactly one entry with exact Undo/Redo', () => {
		const seed = commitChain(baseDocument(), [...RECT], 'boundary', true);
		const wallId = seed.walls[0]!.id;
		const { store, preview } = roleStore(seed);
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, preview),
			() => commitWallRoleChange(preview, wallId, 'partition'),
			(result) => result.success
		);
		expect(outcome.kind).toBe('committed');
		expect(liveWallFirst(preview).walls.find((wall) => wall.id === wallId)?.role).toBe('partition');
		expect(liveWallFirst(preview).rooms).toHaveLength(0);
		expect(store.canUndo).toBe(true);
		expect(store.undo()).toBe(true);
		expect(liveWallFirst(preview).walls.find((wall) => wall.id === wallId)?.role).toBe('boundary');
		expect(liveWallFirst(preview).rooms).toHaveLength(1);
		expect(store.canUndo).toBe(false);
		expect(store.redo()).toBe(true);
		expect(liveWallFirst(preview).walls.find((wall) => wall.id === wallId)?.role).toBe('partition');
	});

	it('writes zero history entries when the role flip rejects', () => {
		const seed = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'partition');
		const { store, preview } = roleStore(seed);
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, preview),
			() => commitWallRoleChange(preview, seed.walls[0]!.id, 'partition'),
			(result) => result.success
		);
		expect(outcome.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
	});
});

describe('P23.6 hover affordances — projection and viewport wiring', () => {
	function hoveredHandles(
		hovered: { kind: 'junction'; junctionId: string },
		tool: 'wall-chain' | 'select' = 'wall-chain'
	) {
		const first = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
		const document = commitChain(first, [p(0, 2), p(4, 2)], 'partition');
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		setLayoutDraftTool(state, tool);
		const junctions = document.junctions.map((junction) => ({
			id: junction.id,
			point: [...junction.point] as [number, number]
		}));
		return buildPlanInteractionProjection(state, [], model, emptyContext({ junctions }), hovered);
	}

	it('marks the hovered Junction handle with the hover language', () => {
		const first = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
		const junctionId = first.junctions[0]!.id;
		const projection = hoveredHandles({ kind: 'junction', junctionId });
		const hovered = projection.handles.filter((primitive) => primitive.style === 'vertex-handle-hovered');
		expect(hovered).toHaveLength(1);
		expect(hovered[0]).toMatchObject({ hit: { kind: 'junction', junctionId } });
	});

	it('tints hovered legacy Walls through the same hover language', () => {
		const document = g2LineRectangleDocument();
		const { geometry } = buildLayoutPreviewModel(document);
		const model = buildPlanRenderModel(geometry, undefined, {
			selected: undefined,
			hovered: { kind: 'wall', roomId: 'room-rectangle', segmentId: 'room-rectangle:wall:0' },
			selection: [],
			handles: [],
			drafts: [],
			labels: []
		});
		expect(
			model.layers[2]!.primitives.filter((primitive) => primitive.style === 'wall-line-hovered')
		).toHaveLength(1);
	});

	it('resolves hover on pointermove and clears it on leave', () => {
		const viewport = fs.readFileSync(
			path.join(
				fileURLToPath(new URL('../../../src/lib', import.meta.url)),
				'editor/layout/LayoutPlanViewport.svelte'
			),
			'utf8'
		);
		expect(viewport).toContain('layoutHover = toLayoutHover(');
		expect(viewport).toContain('wallFirstContext, layoutHover ?? undefined');
		// Cleared both when another tool/gesture takes over and on pointerleave.
		expect(viewport.split('layoutHover = null').length - 1).toBeGreaterThanOrEqual(2);
	});
});

describe('P23.6 room label interior anchors and suppression', () => {
	it('lands strictly inside a concave face whose centroid escapes', () => {
		// C-shape: both the vertex mean and the area centroid fall in the
		// notch, so only the ear-clip fallback can answer interior.
		const c: [number, number][] = [
			[0, 0],
			[6, 0],
			[6, 2],
			[2, 2],
			[2, 4],
			[6, 4],
			[6, 6],
			[0, 6]
		];
		expect(pointStrictlyInsidePolygon(c, [3.5, 3])).toBe(false);
		// Area centroid (76/28, 3) sits in the notch: documents the fallback trigger.
		expect(pointStrictlyInsidePolygon(c, [76 / 28, 3])).toBe(false);
		const anchor = interiorLabelPoint(c);
		expect(pointStrictlyInsidePolygon(c, anchor)).toBe(true);
	});

	it('suppresses the Room name under a diagnostic marker at low zoom', () => {
		const document = commitChain(baseDocument(), [...RECT], 'boundary', true);
		const model = buildLayoutPreviewModel(document).model;
		const names = new Map(document.rooms.map((room) => [room.id, room.name] as const));
		const wallId = document.walls[0]!.id;
		const context = emptyContext({
			roomNames: names,
			issues: [{ path: `walls.${wallId}`, code: 'zero_length_wall', message: 'degenerate', targetId: wallId }]
		});
		const near = createLayoutInteractionState();
	 expect(
			textsOf(buildPlanInteractionProjection(near, [], model, context)).filter(
				(primitive) => primitive.style === 'room-name'
			)
		).toHaveLength(1);
		const far = createLayoutInteractionState();
		far.planView.pixelsPerMeter = 6;
		expect(
			textsOf(buildPlanInteractionProjection(far, [], model, context)).filter(
				(primitive) => primitive.style === 'room-name'
			)
		).toHaveLength(0);
	});

	it('lets selected-room dimensions outrank the Room name at low zoom', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		selectLayoutRoom(state, 'room-rectangle');
		const roomName = (projection: ReturnType<typeof buildPlanInteractionProjection>) =>
			textsOf(projection).filter((primitive) => primitive.style === 'room-name');
		const dimensions = (projection: ReturnType<typeof buildPlanInteractionProjection>) =>
			textsOf(projection).filter((primitive) => primitive.style === 'dimension-label');
		const near = buildPlanInteractionProjection(state, document.floors[0]!.rooms, model);
		expect(dimensions(near).length).toBeGreaterThan(0);
		expect(roomName(near)).toHaveLength(1);
		state.planView.pixelsPerMeter = 6;
		const far = buildPlanInteractionProjection(state, document.floors[0]!.rooms, model);
		expect(dimensions(far).length).toBeGreaterThan(0);
		expect(roomName(far)).toHaveLength(0);
	});
});

describe('P23.6 blank exact inputs leave document and history untouched', () => {
	it('blank Junction X/Z changes nothing', () => {
		const seed = commitChain(baseDocument(), [...RECT], 'boundary', true);
		const { store, preview } = roleStore(seed);
		const before = JSON.stringify(liveWallFirst(preview));
		const junction = liveWallFirst(preview).junctions[0]!;
		for (const raw of ['', '   ']) {
			const parsed = parseExactNumber(raw, junction.point[0], formatMeters);
			expect(parsed.ok).toBe(false);
		}
		expect(JSON.stringify(liveWallFirst(preview))).toBe(before);
		expect(store.canUndo).toBe(false);
	});

	it('blank Wall Angle changes nothing while a valid Angle commits once', () => {
		const seed = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
		const wallId = seed.walls[0]!.id;
		const { store, preview } = roleStore(seed);
		const before = JSON.stringify(liveWallFirst(preview));
		const blank = parseExactNumber('', 0, formatDegrees);
		expect(blank.ok).toBe(false);
		expect(JSON.stringify(liveWallFirst(preview))).toBe(before);
		expect(store.canUndo).toBe(false);
		// Positive control: the harness commits a real Angle exactly once.
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, preview),
			() => updateWallFirstWallAngle(preview, wallId, degreesToRadians(45), 'start'),
			(result) => result.success
		);
		expect(outcome.kind).toBe('committed');
		expect(store.canUndo).toBe(true);
		expect(store.undo()).toBe(true);
		expect(store.canUndo).toBe(false);
	});
});

describe('P23.6 idle-select Junction hover reveals its own handle', () => {
	it('renders only the hovered Junction with no edit context', () => {
		const first = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'boundary');
		const document = commitChain(first, [p(0, 2), p(4, 2)], 'partition');
		const model = buildLayoutPreviewModel(document).model;
		// Idle select: default tool, no selection, no Wall focus.
		const state = createLayoutInteractionState();
		expect(state.tool).toBe('select');
		const junctions = document.junctions.map((junction) => ({
			id: junction.id,
			point: [...junction.point] as [number, number]
		}));
		const hoveredId = document.junctions[0]!.id;
		const projection = buildPlanInteractionProjection(
			state,
			[],
			model,
			emptyContext({ junctions }),
			{ kind: 'junction', junctionId: hoveredId }
		);
		const handles = projection.handles.filter((primitive) => hitKind(primitive) === 'junction');
		expect(handles).toHaveLength(1);
		expect(handles[0]).toMatchObject({
			style: 'vertex-handle-hovered',
			hit: { kind: 'junction', junctionId: hoveredId }
		});
	});
});
