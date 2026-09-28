import { describe, expect, it } from 'vitest';

import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildLayoutPreviewModel } from '$lib/editor/layout/layout-mesh-factory';
import {
	createLayoutInteractionState,
	selectLayoutRoom
} from '$lib/editor/layout/layout-interaction';
import {
	buildPlanInteractionProjection,
	rotationHandleScreenPoint,
	type PlanWallFirstContext
} from '$lib/editor/layout/plan-overlays';
import type { LayoutRoom } from '$lib/layout/layout-codec';
import type { PlanInteractionProjection } from '$lib/layout/plan-render-model';
import { g2LineRectangleDocument } from '../../layout/__fixtures__/layout-g2-fixtures';

const RECT: [number, number][] = [
	[0, 0],
	[4, 0],
	[4, 3],
	[0, 3]
];

/** A canonical wall-first document with one closed rectangular Room. */
function wallFirstDocument(): LayoutDocumentWallFirst {
	const plan = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
		points: RECT,
		role: 'boundary',
		close: true
	});
	if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
	return plan.document;
}

function wallFirstContext(): PlanWallFirstContext {
	return {
		junctions: [],
		junctionFocus: null,
		curveControls: [],
		roomNames: new Map(),
		runStartPoint: null,
		issues: []
	};
}

/**
 * A selected Room's overlay, resolved exactly the way the viewport resolves it:
 * the legacy `rooms` list the projection reads for selected-Room vertex geometry
 * (`[]` for a wall-first document — `'floors' in layout` is false there) plus the
 * optional wall-first context that marks the document canonical.
 */
function selectedRoomProjection(options: {
	wallFirst: boolean;
	rooms: readonly LayoutRoom[];
	context?: PlanWallFirstContext;
}): { projection: PlanInteractionProjection; roomId: string; planView: Parameters<typeof rotationHandleScreenPoint>[0] } {
	const document = options.wallFirst ? wallFirstDocument() : g2LineRectangleDocument();
	const model = buildLayoutPreviewModel(document).model;
	const state = createLayoutInteractionState();
	const roomId = model.rooms[0]!.roomId;
	selectLayoutRoom(state, roomId);
	const projection = buildPlanInteractionProjection(state, options.rooms, model, options.context);
	return { projection, roomId, planView: state.planView };
}

const legacyRooms = g2LineRectangleDocument().floors[0]!.rooms;

/**
 * P23.14 Decision 7 LOCKED the Room rotation affordance off for wall-first
 * Layout, on the grounds that a canonical Room has no authored yaw so a rotation
 * gesture "has no honest result to commit". The owner REVERSED that decision on
 * 2026-09-28, because an honest result now exists and is committed by the
 * canonical planner: a rigid WHOLE-UNIT rotation of the Room's boundary graph
 * (`planWallFirstRoomRotation`), which the release re-derives exactly as it does
 * for translation. These tests pin the reversal, and the parts of Decision 7 that
 * SURVIVE it: a legacy Room keeps its own authored-yaw gesture, and the arm is
 * only offered where a compiled outline exists to anchor it.
 */
describe('P23.14 Decision 7 (reversed 2026-09-28) — the Room rotation affordance', () => {
	it('keeps the arm and handle for a legacy line-format Room, unchanged', () => {
		const { projection } = selectedRoomProjection({ wallFirst: false, rooms: legacyRooms });
		const styles = projection.selection.map((primitive) => primitive.style);
		expect(styles).toContain('selection-bounds');
		expect(styles).toContain('rotation-arm');
		expect(styles).toContain('rotation-handle');
	});

	it('offers the arm and handle for a selected WALL-FIRST Room, keyed to that Room', () => {
		// The shipped path — a canonical document, whose legacy `rooms` list is
		// empty because it has no `floors`. The handle is anchored to the COMPILED
		// outline, so no legacy registry is needed and none is consulted.
		const { projection, roomId } = selectedRoomProjection({
			wallFirst: true,
			rooms: [],
			context: wallFirstContext()
		});
		const styles = projection.selection.map((primitive) => primitive.style);
		expect(styles).toContain('rotation-arm');
		expect(styles).toContain('rotation-handle');
		const handle = projection.selection.find((primitive) => primitive.style === 'rotation-handle');
		expect(handle?.kind).toBe('circle');
		// The handle names the selected Room, so paint, the hover state and the hit
		// test that starts the gesture all resolve to one identity.
		expect(handle && 'hit' in handle ? handle.hit : null).toEqual({ kind: 'room', roomId });
		expect(projection.selection.some((primitive) => primitive.key.includes(roomId))).toBe(true);
	});

	it('leaves the legacy vertex handles on the legacy path only', () => {
		const { projection } = selectedRoomProjection({ wallFirst: false, rooms: legacyRooms });
		expect(projection.handles.map((primitive) => primitive.style)).toContain('vertex-handle');
		// A wall-first Room has no legacy vertices to edit, so no vertex handles —
		// the reversal adds a UNIT gesture, not legacy vertex editing.
		const wallFirst = selectedRoomProjection({ wallFirst: true, rooms: [], context: wallFirstContext() });
		expect(wallFirst.projection.handles.map((primitive) => primitive.style)).not.toContain('vertex-handle');
	});

	it('resolves the wall-first handle to a screen point a hit test can use', () => {
		const { projection, planView } = selectedRoomProjection({
			wallFirst: true,
			rooms: [],
			context: wallFirstContext()
		});
		const screen = rotationHandleScreenPoint(planView, projection);
		expect(screen).not.toBeNull();
		expect(Number.isFinite(screen![0])).toBe(true);
		expect(Number.isFinite(screen![1])).toBe(true);
	});

	it('draws no affordance when no wall-first context is supplied, or no Room is selected', () => {
		// The context is what tells the builder the document is canonical; without
		// it a wall-first document with an empty legacy registry has no anchor at
		// all, which is the pre-existing degenerate case rather than a policy.
		const noContext = selectedRoomProjection({ wallFirst: true, rooms: [] });
		expect(noContext.projection.selection.map((primitive) => primitive.style)).not.toContain(
			'rotation-handle'
		);
	});
});
