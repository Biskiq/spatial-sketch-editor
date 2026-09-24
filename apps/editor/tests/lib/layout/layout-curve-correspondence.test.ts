import { describe, expect, it } from 'vitest';
import {
	buildCorrespondenceComponents,
	extractBoundaryCandidateFaces,
	interiorWitness,
	parseWallFirstLayoutDocumentJson,
	planWallChain,
	roomBoundaryPolygon,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import repro from './fixtures/curved-correspondence-repro.json';
import { hostWallAtSpan } from '../../helpers/angled-plan-fixtures';

function suppliedLayout(): LayoutDocumentWallFirst {
	const parsed = parseWallFirstLayoutDocumentJson(JSON.stringify(repro));
	if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
	return parsed.document;
}

describe('curved neighbour Room correspondence', () => {
	it('keeps the supplied two Rooms separate against their own curved faces', () => {
		const document = suppliedLayout();
		const faces = extractBoundaryCandidateFaces(document).faces;
		const polygons = new Map(
			document.rooms.map((room) => [room.id, roomBoundaryPolygon(document, room.id)!])
		);
		const witnesses = new Map(
			document.rooms.map((room) => [room.id, interiorWitness(polygons.get(room.id)!)])
		);
		const components = buildCorrespondenceComponents({
			faces,
			predecessorRoomIds: document.rooms.map((room) => room.id),
			predecessorWitnesses: witnesses,
			predecessorPolygons: polygons,
			candidateDocument: document,
			baselineRooms: document.rooms
		});
		expect(components.map((component) =>
			`${component.predecessorRoomIds.length}→${component.candidateFaceKeys.length}`
		)).toEqual(['1→1', '1→1']);
	});

	it('can split the larger Room from the top Wall to the bottom Wall', () => {
		const baseline = suppliedLayout();
		const start: [number, number] = [1.7, -3.5];
		const end: [number, number] = [0.5, 3.666666666666667];
		// P23B.3a S6 — both ends land on the larger Room's own Walls (a wall-span
		// snap), so the divider DECLARES those hosts: extending the enclosure's group
		// is what splits the Room, and the declaration is what says so.
		const plan = planWallChain({
			baseline,
			points: [start, end],
			close: false,
			role: 'boundary',
			endpointHostSnaps: [
				{ pointIndex: 0, wallId: hostWallAtSpan(baseline, start)! },
				{ pointIndex: 1, wallId: hostWallAtSpan(baseline, end)! }
			]
		});
		expect(plan.kind, plan.kind === 'success' ? '' : JSON.stringify(plan)).toBe('success');
		if (plan.kind === 'success') expect(plan.document.rooms).toHaveLength(3);
	});

	it('can add an independent Wall without a false 2→2 Room component', () => {
		const plan = planWallChain({
			baseline: suppliedLayout(),
			points: [[7, -5], [8, -5]],
			close: false,
			role: 'boundary'
		});
		expect(plan.kind, plan.kind === 'success' ? '' : JSON.stringify(plan)).toBe('success');
		if (plan.kind === 'success') expect(plan.document.rooms).toHaveLength(2);
	});
});
