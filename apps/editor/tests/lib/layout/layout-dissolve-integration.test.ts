/**
 * P23 Junction dissolve — kernel output assertions.
 *
 * PR #115 (§7.2 category D extraction) removed the editor shell, so this file
 * calls the `layout-core` planner directly instead of driving it through the
 * deleted preview-state adapter and its history runner. The document
 * expectations are the ones the editor integration asserted verbatim; the
 * editor-wiring half (exactly-one history entry, Undo/Redo, the adapter's
 * format gate and the `LayoutPlanViewport`/`PlanWorkspace` source contract)
 * tested removed behaviour and is gone with its subject. The history
 * semantics it proved are recorded as a T3 F.4 acceptance obligation.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planDissolveJunction as planDissolveJunctionWithCapture,
	validateWallFirstLayoutDocument
} from '@portfolio/layout-core';
import type { LayoutDocumentWallFirst, LayoutVec2 } from '@portfolio/layout-core';
import { freshCapture } from './__fixtures__/layout-id-capture';

/** One captured dissolve operation: every call is a new edit with a new nonce. */
const dissolve = (document: LayoutDocumentWallFirst, junctionId: string) =>
	planDissolveJunctionWithCapture(document, junctionId, freshCapture(), document.floor.id);

/** 4×3 Room with a pre-split south edge (M) and a door on the survivor side. */
function seed(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 10,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] as LayoutVec2 },
			{ id: 'M', point: [2, 0] as LayoutVec2 },
			{ id: 'B', point: [4, 0] as LayoutVec2 },
			{ id: 'C', point: [4, 3] as LayoutVec2 },
			{ id: 'D', point: [0, 3] as LayoutVec2 }
		],
		walls: [
			{ id: 'w1a', startJunctionId: 'A', endJunctionId: 'M', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w1b', startJunctionId: 'M', endJunctionId: 'B', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w4', startJunctionId: 'D', endJunctionId: 'A', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
		],
		rooms: [
			{
				id: 'room',
				name: 'Room',
				boundary: [
					{ wallId: 'w1a', direction: 'forward' },
					{ wallId: 'w1b', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				virtualEdges: [], overhead: 'closed',
			}
		],
		openings: [
			{ id: 'door', wallId: 'w1a', kind: 'door', offset: 0.5, width: 0.9, height: 2, sillHeight: 0, profile: 'rectangular' }
		],
		objects: [] as LayoutDocumentWallFirst['objects'],
		regions: []
	};
}

describe('planDissolveJunction — kernel output', () => {
	it('validates the fixture document before any operation', () => {
		expect(validateWallFirstLayoutDocument(seed()).success).toBe(true);
	});

	it('retires the degree-2 Junction, joins the survivor Wall and rebases the Opening', () => {
		const plan = dissolve(seed(), 'M');
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		const after = plan.document;

		expect(after.walls.map((wall) => wall.id)).toEqual(['w1a', 'w2', 'w3', 'w4']);
		expect(after.junctions.map((junction) => junction.id)).toEqual(['A', 'B', 'C', 'D']);
		expect(after.rooms.map((room) => room.id)).toEqual(['room']);
		expect(after.openings).toHaveLength(1);
		expect(after.openings[0]).toMatchObject({ id: 'door', wallId: 'w1a', offset: 0.5 });
	});

	it('maps a reversed survivor’s left/right before Join Finish precedence', () => {
		const document = createEmptyWallFirstLayoutDocument();
		document.junctions = [
			{ id: 'west', point: [-3, 0] },
			{ id: 'joint', point: [0, 0] },
			{ id: 'east', point: [3, 0] }
		];
		// Both stored walls start at the joint. The smaller-id Wall survives, and
		// the joined Wall starts at its far end, reversing that survivor in place.
		document.walls = [
			{ id: 'a-survivor', startJunctionId: 'joint', endJunctionId: 'west', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'b-absorbed', startJunctionId: 'joint', endJunctionId: 'east', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
		];
		const plan = dissolve(document, 'joint');
		if (plan.kind !== 'success') throw new Error(`expected reversed join to succeed: ${JSON.stringify(plan)}`);
		expect(plan.document.walls.find((wall) => wall.id === 'a-survivor')).toMatchObject({
			startJunctionId: 'west', endJunctionId: 'east'
		});
		expect(plan.surfaceLineage).toEqual([
			{
				to: { kind: 'wall-side', wallId: 'a-survivor', side: 'left' },
				from: [
					{ kind: 'wall-side', wallId: 'a-survivor', side: 'right' },
					{ kind: 'wall-side', wallId: 'b-absorbed', side: 'left' }
				]
			},
			{
				to: { kind: 'wall-side', wallId: 'a-survivor', side: 'right' },
				from: [
					{ kind: 'wall-side', wallId: 'a-survivor', side: 'left' },
					{ kind: 'wall-side', wallId: 'b-absorbed', side: 'right' }
				]
			}
		]);
	});

	it('rejects a repeated dissolve of the retired Junction', () => {
		const plan = dissolve(seed(), 'M');
		if (plan.kind !== 'success') throw new Error('expected first dissolve to succeed');
		// The retired junction is gone from the committed document.
		const repeated = dissolve(plan.document, 'M');
		expect(repeated.kind).toBe('rejected');
	});

	it('rejects an angled pair at corner B and leaves the input document untouched', () => {
		const document = seed();
		const before = JSON.stringify(document);
		const plan = dissolve(document, 'B');
		expect(plan.kind).toBe('rejected');
		expect(JSON.stringify(document)).toBe(before);
	});

	it('surfaces the planner rejection message per code', () => {
		const angled = dissolve(seed(), 'B');
		expect(angled.kind).toBe('rejected');
		if (angled.kind !== 'rejected') throw new Error('unreachable');
		expect(angled.rejection.message).toContain('angle');

		const unknown = dissolve(seed(), 'missing');
		expect(unknown.kind).toBe('rejected');
		if (unknown.kind !== 'rejected') throw new Error('unreachable');
		expect(unknown.rejection.message).toContain('missing');
	});
});
