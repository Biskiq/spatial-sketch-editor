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

	it('renders the live attempt after a drag, whatever the last verdict was', () => {
		// P23.11 transient pass — this intent is the DRAG PREVIEW, not a rejection
		// report. The canonical document is no longer written per pointermove, so
		// an attempt with no verdict, one the planner last accepted, a silent
		// `no_op` and a refused one all draw the geometry the pointer is asking
		// for. Whether it commits is decided once, by the planner, at release — so
		// the gate must not read the verdict at all.
		for (const patch of [
			{},
			{ valid: true },
			{ rejectionCode: 'no_op' },
			{ rejectionCode: 'duplicate_junction' }
		]) {
			expect(architectureEditIntentFor(junctionGesture(patch), true)).toEqual({
				kind: 'junction-move',
				point: [1, 1]
			});
		}
	});

	it('renders the attempted rigid Wall move from baseline-derived values', () => {
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

	it('draws a live attempt pending, and the refused token for a known-invalid one', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const base = {
			selection: [],
			handles: [],
			drafts: [],
			labels: []
		} as unknown as Parameters<typeof withArchitectureEditIntent>[0];
		const drawn = withArchitectureEditIntent(
			base,
			architectureEditIntentFor(junctionGesture(), true)
		);
		expect(drawn.drafts).toHaveLength(1);
		// Pending: validity is not a pointermove fact, so the attempt must not
		// claim to be refused.
		expect(drawn.drafts[0]).toMatchObject({
			kind: 'circle',
			style: 'architecture-edit-intent'
		});
		// A known-invalid attempt (the caller's cheap canonical preflight refuted
		// it, or — as here, with no proposal — it could not be derived at all)
		// renders in the existing refused language while still following the
		// pointer.
		const refused = withArchitectureEditIntent(
			base,
			architectureEditIntentFor(junctionGesture(), true, null, 'known-invalid')
		);
		expect(refused.drafts).toHaveLength(1);
		expect(refused.drafts[0]).toMatchObject({
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
		// No proposal degrades to the attempt's point marker alone.
		expect(architectureEditIntentFor(curveGesture(), true)).toEqual({
			kind: 'wall-bend',
			point: [3, 4]
		});
	});

	it('draws the whole attempted Wall polyline in the attempt language', () => {
		const base = {
			selection: [],
			handles: [],
			drafts: [],
			labels: []
		} as unknown as Parameters<typeof withArchitectureEditIntent>[0];
		const shape: [number, number][] = [[0, 0], [2, 2], [4, 0]];
		const live = withArchitectureEditIntent(base, {
			kind: 'curve-control-move',
			point: [2, 2],
			shape
		});
		expect(live.drafts).toHaveLength(2);
		expect(live.drafts[0]).toMatchObject({
			kind: 'polyline',
			points: shape,
			style: 'architecture-edit-intent'
		});
		expect(live.drafts[1]).toMatchObject({
			kind: 'circle',
			style: 'architecture-edit-intent'
		});
		// The refused language is still reachable, and still means the same
		// thing: this attempt could not be derived.
		const refused = withArchitectureEditIntent(base, {
			kind: 'curve-control-move',
			point: [2, 2],
			shape,
			invalid: true
		});
		expect(refused.drafts).toHaveLength(2);
		expect(refused.drafts[0]).toMatchObject({
			kind: 'polyline',
			style: 'architecture-edit-intent-invalid'
		});
		expect(refused.drafts[1]).toMatchObject({
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

describe('P23.11 follow-up — all invalid architecture edits render proposal geometry', () => {
	const walls = [
		{ wallId: 'curved', points: [[0, 0], [2, 1], [4, 0]] as [number, number][] },
		{ wallId: 'neighbour', points: [[4, 0], [4, 2]] as [number, number][] }
	];

	it('renders complete Junction-local Wall geometry with one invalid visual language', () => {
		const intent = architectureEditIntentFor(junctionGesture(), true, walls);
		expect(intent).toEqual({ kind: 'junction-move', point: [1, 1], walls });
		const base = { drafts: [], selection: [], labels: [] } as unknown as Parameters<
			typeof withArchitectureEditIntent
		>[0];
		const drawn = withArchitectureEditIntent(base, intent);
		expect(drawn.drafts).toHaveLength(3);
		expect(drawn.drafts.slice(0, 2).every((draft) => draft.style === 'architecture-edit-intent')).toBe(true);
		expect(drawn.drafts[0]).toMatchObject({ kind: 'polyline', points: walls[0]!.points });
		expect(drawn.drafts[1]).toMatchObject({ kind: 'polyline', points: walls[1]!.points });
		expect(drawn.drafts[2]).toMatchObject({ kind: 'circle', style: 'architecture-edit-intent' });
	});

	it('renders a curved rigid-move proposal instead of an endpoint chord', () => {
		const wallGesture: LayoutArchitectureEditGesture = {
			kind: 'wall-move',
			pointerId: 1,
			wallId: 'curved',
			startPointer: [0, 0],
			baselineGrabPoint: [2, 0],
			startJunctionId: 'A',
			endJunctionId: 'B',
			baselineStart: [0, 0],
			baselineEnd: [4, 0],
			affectedWallIds: ['curved', 'neighbour'],
			candidateDelta: [1, 1],
			valid: false,
			rejectionCode: 'topology_invalid'
		};
		const intent = architectureEditIntentFor(wallGesture, true, walls);
		expect(intent).toEqual({ kind: 'wall-move', walls });
		const base = { drafts: [], selection: [], labels: [] } as unknown as Parameters<
			typeof withArchitectureEditIntent
		>[0];
		const drawn = withArchitectureEditIntent(base, intent);
		expect(drawn.drafts).toHaveLength(2);
		expect(drawn.drafts[0]).toMatchObject({ kind: 'polyline', points: walls[0]!.points });
		expect(drawn.drafts[1]).toMatchObject({ kind: 'polyline', points: walls[1]!.points });
	});
});

describe('buildPlanInteractionProjection', () => {
	it('emits only the persistent Room label stack for an idle state on a line room', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const projection = buildPlanInteractionProjection(createLayoutInteractionState(), document.floors[0]!.rooms, model);
		expect(projection.selected).toEqual({ kind: 'none' });
		expect(projection.selection).toEqual([]);
		expect(projection.handles).toEqual([]);
		expect(projection.drafts).toEqual([]);
		// P23.13 S3 — the idle Plan presents the Room's name and its derived area
		// as one stacked free-space label (reference line absent: this fixture's
		// Rooms carry no ledger reference).
		expect(projection.labels.map((primitive) => (primitive.kind === 'text' ? primitive.style : null))).toEqual([
			'room-name',
			'room-area'
		]);
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
			// P23.13 S3 — the persistent Room label stack rides the labels layer
			// last, name first and the derived area beneath it.
			document.floors[0]!.rooms[0]!.name,
			'24.0 m²'
		]);
	});

	it('does not emit room-selection overlays when a wall is selected', () => {
		const document = g2LineRectangleDocument();
		const model = buildLayoutPreviewModel(document).model;
		const state = createLayoutInteractionState();
		selectLayoutWall(state, 'room-rectangle', 'room-rectangle:wall:0');
		const projection = buildPlanInteractionProjection(state, document.floors[0]!.rooms, model);
		expect(projection.selection).toEqual([]);
		// P23.13 S3 — only the persistent Room label stack remains on the labels
		// layer (name + derived area for this reference-less fixture).
		expect(projection.labels.map((primitive) => primitive.style)).toEqual([
			'room-name',
			'room-area'
		]);
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
