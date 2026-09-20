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
	type PlanWallFirstContext
} from '$lib/editor/layout/plan-overlays';
import type { LayoutRoom } from '$lib/layout/layout-codec';
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
 * A selected Room's overlay styles, resolved exactly the way the viewport resolves
 * them: the legacy `rooms` list the projection reads for selected-Room geometry
 * (`[]` for a wall-first document — `'floors' in layout` is false there) plus the
 * optional wall-first context.
 */
function selectedRoomStyles(options: {
	wallFirst: boolean;
	rooms: readonly LayoutRoom[];
	context?: PlanWallFirstContext;
}) {
	const document = options.wallFirst ? wallFirstDocument() : g2LineRectangleDocument();
	const model = buildLayoutPreviewModel(document).model;
	const state = createLayoutInteractionState();
	selectLayoutRoom(state, model.rooms[0]!.roomId);
	const projection = buildPlanInteractionProjection(state, options.rooms, model, options.context);
	return {
		selection: projection.selection.map((primitive) => primitive.style),
		handles: projection.handles.map((primitive) => primitive.style)
	};
}

const legacyRooms = g2LineRectangleDocument().floors[0]!.rooms;

describe('P23.14 Decision 7 — no Room rotation affordance in wall-first Layout', () => {
	it('keeps the arm and handle for a legacy line-format Room', () => {
		const { selection } = selectedRoomStyles({ wallFirst: false, rooms: legacyRooms });
		expect(selection).toContain('selection-bounds');
		expect(selection).toContain('rotation-arm');
		expect(selection).toContain('rotation-handle');
	});

	it('suppresses the arm and handle whenever the document is wall-first', () => {
		// The guard, not an accident of an empty `rooms` list: a line-shaped Room
		// told that its document is canonical loses the arm too.
		const guarded = selectedRoomStyles({
			wallFirst: false,
			rooms: legacyRooms,
			context: wallFirstContext()
		});
		expect(guarded.selection).not.toContain('rotation-arm');
		expect(guarded.selection).not.toContain('rotation-handle');

		// And the shipped path — a canonical document, whose `rooms` list is empty
		// because it has no legacy `floors`.
		const shipped = selectedRoomStyles({
			wallFirst: true,
			rooms: [],
			context: wallFirstContext()
		});
		expect(shipped.selection).not.toContain('rotation-arm');
		expect(shipped.selection).not.toContain('rotation-handle');
	});

	it('keeps a legacy Room editable through its vertex handles', () => {
		const { handles } = selectedRoomStyles({ wallFirst: false, rooms: legacyRooms });
		expect(handles).toContain('vertex-handle');
	});
});
