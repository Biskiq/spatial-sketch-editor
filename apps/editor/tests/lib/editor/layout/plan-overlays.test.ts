import { describe, expect, it } from 'vitest';
import { g2AutoBezierDocument, g2LineRectangleDocument } from '../../layout/__fixtures__/layout-g2-fixtures';
import { buildLayoutPreviewModel } from '$lib/editor/layout/layout-mesh-factory';
import {
	beginLayoutPrimitiveDraft,
	beginLayoutRoomUnitDrag,
	beginRectangle,
	createLayoutInteractionState,
	selectLayoutInteriorAnchor,
	selectLayoutRoom,
	selectLayoutWall,
	setLayoutDraftTool,
	updateLayoutPrimitiveDraft,
	updateLayoutRoomUnitDrag,
	updateRectangle
} from '$lib/editor/layout/layout-interaction';
import {
	buildPlanInteractionProjection,
	architectureEditIntentFor,
	withArchitectureEditIntent
} from '$lib/editor/layout/plan-overlays';
import type { LayoutArchitectureEditGesture } from '$lib/editor/layout/layout-interaction';

/** One live Junction-move gesture, with the fields the intent gate reads. */
function junctionGesture(
	patch: Partial<Extract<LayoutArchitectureEditGesture, { kind: 'junction-move' }>> = {}
): LayoutArchitectureEditGesture {
	return {
		kind: 'junction-move',
		pointerId: 1,
		junctionId: 'A',
		startPointer: [0, 0],
		baselinePoint: [0, 0],
		junctionExcludePoints: [[0, 0], [4, 0]],
		affectedWallIds: ['w1'],
		candidatePoint: [1, 1],
		valid: false,
		...patch
	};
}

describe('P23.10 architecture-edit intent gate', () => {
	it('renders nothing before the press becomes a drag', () => {
		// A pointer-down over a Wall is still a click: no candidate has been
		// requested, so nothing may flash an invalid overlay.
		expect(architectureEditIntentFor(junctionGesture(), false)).toBeNull();
		expect(architectureEditIntentFor(junctionGesture({ valid: true }), false)).toBeNull();
		expect(architectureEditIntentFor(null, true)).toBeNull();
	});

	it('renders nothing for an accepted candidate or a silent no-op', () => {
		// An accepted candidate is already previewed by the installed document.
		expect(architectureEditIntentFor(junctionGesture({ valid: true }), true)).toBeNull();
		// A no-op release asked for nothing: drawing it as a rejection would
		// report a failure the user never requested.
		expect(
			architectureEditIntentFor(junctionGesture({ rejectionCode: 'no_op' }), true)
		).toBeNull();
		expect(
			architectureEditIntentFor(junctionGesture({ rejectionCode: undefined }), true)
		).toBeNull();
	});

	it('renders the rejected attempt after a drag, from baseline-derived values', () => {
		expect(
			architectureEditIntentFor(junctionGesture({ rejectionCode: 'duplicate_junction' }), true)
		).toEqual({ kind: 'junction-move', point: [1, 1] });

		const wall: LayoutArchitectureEditGesture = {
			kind: 'wall-move',
			pointerId: 1,
			wallId: 'w1',
			startPointer: [0, 0],
			baselineGrabPoint: [0, 0],
			startJunctionId: 'A',
			endJunctionId: 'B',
			baselineStart: [0, 0],
			baselineEnd: [4, 0],
			affectedWallIds: ['w1'],
			candidateDelta: [1, 2],
			valid: false,
			rejectionCode: 'topology_invalid'
		};
		expect(architectureEditIntentFor(wall, true)).toEqual({
			kind: 'wall-move',
			start: [1, 2],
			end: [5, 2]
		});
	});

	it('draws a rejected intent with the transient token and nothing when null', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const base = {
			selection: [],
			handles: [],
			drafts: [],
			labels: []
		} as unknown as Parameters<typeof withArchitectureEditIntent>[0];
		expect(architectureEditIntentFor(junctionGesture({ rejectionCode: 'no_op' }), true)).toBeNull();
		const intent = architectureEditIntentFor(
			junctionGesture({ rejectionCode: 'topology_invalid' }),
			true
		);
		const drawn = withArchitectureEditIntent(base, intent);
		expect(drawn.drafts).toHaveLength(1);
		expect(drawn.drafts[0]).toMatchObject({
			kind: 'circle',
			style: 'architecture-edit-intent-invalid'
		});
		expect(withArchitectureEditIntent(base, null).drafts).toHaveLength(0);
		expect(model.rooms.map((room) => room.roomId)).toEqual(['room-rectangle']);
	});
});

describe('P23.11 fix 5 — an invalid curve drag renders the attempted Wall', () => {
	function curveGesture(
		patch: Partial<Extract<LayoutArchitectureEditGesture, { kind: 'wall-bend' }>> = {}
	): LayoutArchitectureEditGesture {
		return {
			kind: 'wall-bend',
			command: 'layout.wall.bend',
			pointerId: 1,
			wallId: 'wall-a',
			startPointer: [0, 0],
			baselineGrabPoint: [3, 0],
			bendDistance: 3,
			bendExcludePoints: [],
			affectedWallIds: ['wall-a'],
			candidatePoint: [3, 4],
			valid: false,
			rejectionCode: 'geometry_invalid',
			...patch
		};
	}

	it('carries the caller proposal into the intent instead of a bare point', () => {
		const shape: [number, number][] = [[0, 0], [2, 2], [4, 0]];
		expect(architectureEditIntentFor(curveGesture(), true, shape)).toEqual({
			kind: 'wall-bend',
			point: [3, 4],
			shape
		});
		// No proposal degrades to the rejected point marker alone.
		expect(architectureEditIntentFor(curveGesture(), true)).toEqual({
			kind: 'wall-bend',
			point: [3, 4]
		});
	});

	it('draws the whole attempted Wall polyline with invalid styling', () => {
		const base = {
			selection: [],
			handles: [],
			drafts: [],
			labels: []
		} as unknown as Parameters<typeof withArchitectureEditIntent>[0];
		const shape: [number, number][] = [[0, 0], [2, 2], [4, 0]];
		const drawn = withArchitectureEditIntent(base, {
			kind: 'curve-control-move',
			point: [2, 2],
			shape
		});
		expect(drawn.drafts).toHaveLength(2);
		expect(drawn.drafts[0]).toMatchObject({
			kind: 'polyline',
			points: shape,
			style: 'architecture-edit-intent-invalid'
		});
		expect(drawn.drafts[1]).toMatchObject({
			kind: 'circle',
			style: 'architecture-edit-intent-invalid'
		});
		// A bare point still renders as the single marker (no fabricated curve).
		const pointOnly = withArchitectureEditIntent(base, {
			kind: 'curve-control-move',
			point: [2, 2]
		});
		expect(pointOnly.drafts).toHaveLength(1);
		expect(pointOnly.drafts[0]).toMatchObject({ kind: 'circle' });
	});
});

describe('buildPlanInteractionProjection', () => {
	it('emits only the persistent room name for an idle state on a line room', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const projection = buildPlanInteractionProjection(createLayoutInteractionState(), document.floors[0]!.rooms, model);
		expect(projection.selected).toEqual({ kind: 'none' });
		expect(projection.selection).toEqual([]);
		expect(projection.handles).toEqual([]);
		expect(projection.drafts).toEqual([]);
		// P23.6 — the idle Plan still presents the persistent Room name.
		expect(projection.labels).toHaveLength(1);
		expect(projection.labels[0]).toMatchObject({
			kind: 'text',
			style: 'room-name',
			text: document.floors[0]!.rooms[0]!.name
		});
	});

	it('emits selection bounds, rotation handle, vertex handles, and dimensions for a selected room', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		selectLayoutRoom(state, 'room-rectangle');
		const projection = buildPlanInteractionProjection(state, document.floors[0]!.rooms, model);

		expect(projection.selected).toEqual({ kind: 'room', roomId: 'room-rectangle' });
		expect(projection.selection.map((primitive) => primitive.style)).toEqual([
			'selection-bounds',
			'rotation-arm',
			'rotation-handle'
		]);

		const bounds = projection.selection[0]!;
		expect(bounds.kind).toBe('polygon');
		if (bounds.kind === 'polygon') expect(bounds.points).toEqual([[0, 0], [6, 0], [6, 4], [0, 4]]);

		const arm = projection.selection[1]!;
		expect(arm.kind).toBe('polyline');
		if (arm.kind === 'polyline') {
			expect(arm.points).toEqual([[3, 0], [3, 0]]);
			expect(arm.endOffsetPx).toEqual([0, -28]);
		}

		const handle = projection.selection[2]!;
		expect(handle.kind).toBe('circle');
		if (handle.kind === 'circle') {
			expect(handle.center).toEqual([3, 0]);
			expect(handle.offsetPx).toEqual([0, -28]);
			expect(handle.hit).toEqual({ kind: 'room', roomId: 'room-rectangle' });
		}

		expect(projection.handles.map((primitive) => primitive.style)).toEqual([
			'vertex-handle',
			'vertex-handle',
			'vertex-handle',
			'vertex-handle'
		]);
		expect(projection.labels.map((primitive) => (primitive.kind === 'text' ? primitive.text : null))).toEqual([
			'6.00 m',
			'4.00 m',
			'6.00 m',
			'4.00 m',
			// P23.6 — the persistent Room name rides the labels layer last.
			document.floors[0]!.rooms[0]!.name
		]);
	});

	it('does not emit room-selection overlays when a wall is selected', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		selectLayoutWall(state, 'room-rectangle', 'room-rectangle:wall:0');
		const projection = buildPlanInteractionProjection(state, document.floors[0]!.rooms, model);
		expect(projection.selection).toEqual([]);
		// P23.6 — only the persistent Room name remains on the labels layer.
		expect(projection.labels.map((primitive) => primitive.style)).toEqual(['room-name']);
		expect(projection.handles.map((primitive) => primitive.style)).toEqual([]);
	});

	it('marks an interior anchor selected only for the matching room, segment, and anchor', () => {
		const document = g2AutoBezierDocument();
		const model = buildLayoutPreviewModel(document).model;
		const record = model.queries.points.find((point) => point.kind === 'interior-anchor')!;
		if (record.roomId === undefined) throw new Error('expected room-owned anchor');

		const state = createLayoutInteractionState();
		selectLayoutInteriorAnchor(state, record.roomId, record.segmentId, record.sourceId);
		const projection = buildPlanInteractionProjection(state, document.floors[0]!.rooms, model);
		expect(projection.selected).toEqual({ kind: 'interiorAnchor', roomId: record.roomId, segmentId: record.segmentId, anchorId: record.sourceId });
		expect(projection.handles.some((primitive) => primitive.style === 'interior-anchor-selected')).toBe(true);

		const wrongRoom = createLayoutInteractionState();
		selectLayoutInteriorAnchor(wrongRoom, 'other-room', record.segmentId, record.sourceId);
		const wrongProjection = buildPlanInteractionProjection(wrongRoom, document.floors[0]!.rooms, model);
		expect(wrongProjection.handles.some((primitive) => primitive.style === 'interior-anchor-selected')).toBe(false);
	});

	it('emits interior anchors from compiled query points', () => {
		const document = g2AutoBezierDocument();
		const model = buildLayoutPreviewModel(document).model;
		const projection = buildPlanInteractionProjection(createLayoutInteractionState(), document.floors[0]!.rooms, model);
		expect(projection.handles).toHaveLength(1);
		expect(projection.handles[0]).toMatchObject({ kind: 'circle', style: 'interior-anchor' });
	});

	it('emits a primitive ghost polygon while drafting a box', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		beginLayoutPrimitiveDraft(state, 'box', [1, 1], 'room-rectangle');
		updateLayoutPrimitiveDraft(state, [3, 4], 'room-rectangle');
		const projection = buildPlanInteractionProjection(state, document.floors[0]!.rooms, model);
		expect(projection.drafts.map((primitive) => primitive.style)).toEqual(['primitive-ghost']);
		const ghost = projection.drafts[0]!;
		expect(ghost.kind).toBe('polygon');
		if (ghost.kind === 'polygon') expect(ghost.points).toEqual([[1, 1], [3, 1], [3, 4], [1, 4]]);
	});

	it('emits a draft outline with points while drawing a rectangle', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		setLayoutDraftTool(state, 'rectangle');
		beginRectangle(state, [0, 0]);
		updateRectangle(state, [2, 2]);
		const projection = buildPlanInteractionProjection(state, document.floors[0]!.rooms, model);
		expect(projection.drafts.map((primitive) => primitive.style)).toEqual([
			'draft-outline',
			'draft-point',
			'draft-point',
			'draft-point',
			'draft-point'
		]);
	});

	it('emits rotation feedback while dragging a rotation', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		selectLayoutRoom(state, 'room-rectangle');
		beginLayoutRoomUnitDrag(state, 'room-rectangle', 'rotate', [3, 0], [3, 2]);
		updateLayoutRoomUnitDrag(state, [4, 2], false, true);
		const projection = buildPlanInteractionProjection(state, document.floors[0]!.rooms, model);
		const feedback = projection.selection.find((primitive) => primitive.style === 'rotation-feedback');
		expect(feedback).toMatchObject({ kind: 'text', text: '+90°' });
	});
});
