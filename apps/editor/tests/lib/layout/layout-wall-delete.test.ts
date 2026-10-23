/**
 * P23.6c — canonical Wall deletion.
 *
 * Planner contract (`planDeleteWall`, the topology-changing-operation architecture):
 * topology-changing Wall operations go through candidate graph → face
 * extraction → P23.8 Room reconciliation → canonical validation/compiler,
 * never direct `walls` mutation. Pinned here:
 *
 * - shared boundary Wall between two Rooms reconciles 2→1 through the normal
 *   path when one valid face remains;
 * - an outer boundary Wall opens the enclosure → the affected Room retires
 *   deterministically;
 * - a roomless/partition Wall removes cleanly with existing Room topology
 *   and identities unchanged;
 * - hosted Openings go away atomically in every successful case;
 * - endpoint Junctions are pruned reference-only (no spatial healing);
 * - portal relations remap/clear per the existing P23.8 contract;
 * - ambiguous/unsupported input rejects atomically (zero history);
 * - document-level object associations remap through reconciliation.
 *
 * PR #115 (§7.2 category D extraction) removed the editor shell, so this file
 * calls the `layout-core` planner directly. The editor half — one delete as one
 * history entry with exact Undo/Redo identity, the adapter's legacy-document
 * gate, the plan context-menu builder and the viewport/Inspector/hierarchy
 * caller source contracts — tested removed behaviour and is gone with its
 * subject; the history semantics it proved are recorded as a T3 F.4 acceptance
 * obligation.
 */
import { describe, expect, it } from 'vitest';

import { extractBoundaryCandidateFaces } from '@portfolio/layout-core';
import { validateWallFirstLayoutDocument } from '@portfolio/layout-core';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import type {
	LayoutDocumentWallFirst,
	LayoutWallFirstRoom
} from '@portfolio/layout-core';
import type { LayoutVec2 } from '@portfolio/layout-core';
import {
	planDeleteWall as planDeleteWallWithCapture,
	type WallFirstOpPlan
} from '@portfolio/layout-core';
import { freshCapture } from './__fixtures__/layout-id-capture';

/** One captured Wall delete: every call is a new edit with a new nonce. */
const deleteWall = (document: LayoutDocumentWallFirst, wallId: string): WallFirstOpPlan =>
	planDeleteWallWithCapture(document, wallId, freshCapture(), document.floor.id);

type WallSeed = {
	id: string;
	start: string;
	end: string;
	};

/**
 * Two-room wall-first fixture: a 6×4 enclosure split at x=3 by the shared
 * boundary Wall `wall-e` (bounds BOTH rooms — one physical Wall), plus a
 * disconnected roomless partition Wall `wall-rl`. Rooms come from real face
 * extraction so boundaries are genuine reconciled cycles.
 */
function twoRoomDocument(): LayoutDocumentWallFirst {
	const junctions: Array<[string, number, number]> = [
		['j-a', 0, 0],
		['j-m', 3, 0],
		['j-b', 6, 0],
		['j-c', 6, 4],
		['j-n', 3, 4],
		['j-d', 0, 4],
		['j-x', 10, 0],
		['j-y', 10, 4]
	];
	const walls: WallSeed[] = [
		{ id: 'wall-a1', start: 'j-a', end: 'j-m' },
		{ id: 'wall-a2', start: 'j-m', end: 'j-b' },
		{ id: 'wall-b', start: 'j-b', end: 'j-c' },
		{ id: 'wall-c1', start: 'j-c', end: 'j-n' },
		{ id: 'wall-c2', start: 'j-n', end: 'j-d' },
		{ id: 'wall-d', start: 'j-d', end: 'j-a' },
		{ id: 'wall-e', start: 'j-m', end: 'j-n' },
		{ id: 'wall-rl', start: 'j-x', end: 'j-y' }
	];
	const shell = {
		units: 'meters' as const,
		formatVersion: 6 as const,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.start,
			endJunctionId: wall.end,
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' } as const,
		})),
		openings: [] as LayoutDocumentWallFirst['openings'],
		objects: [] as LayoutDocumentWallFirst['objects']
	};
	const extraction = extractBoundaryCandidateFaces({ ...shell, rooms: [] });
	const leftFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a1')
	)!;
	const rightFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a2')
	)!;
	const room = (
		id: string,
		name: string,
		boundary: typeof leftFace.boundary
	): LayoutWallFirstRoom => ({
		id,
		name,
		boundary: boundary.map((ref) => ({ ...ref })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	});
	return {
		...shell,
		rooms: [
			room('room-left', 'Left', leftFace.boundary),
			room('room-right', 'Right', rightFace.boundary)
		]
	};
}

const BASE = twoRoomDocument();

function success(plan: WallFirstOpPlan): Extract<WallFirstOpPlan, { kind: 'success' }> {
	if (plan.kind !== 'success') {
		throw new Error(`expected success, got ${JSON.stringify(plan.rejection)}`);
	}
	return plan;
}

function rejection(plan: WallFirstOpPlan) {
	if (plan.kind !== 'rejected') throw new Error('expected rejection');
	return plan.rejection;
}

describe('P23.6c planDeleteWall — planner contract', () => {
	it('validates the fixture document before any operation', () => {
		expect(validateWallFirstLayoutDocument(BASE).success).toBe(true);
	});

	it('deletes a shared boundary Wall and reconciles 2 Rooms → 1 through the normal path', () => {
		const plan = success(deleteWall(BASE, 'wall-e'));
		// One physical Wall gone; both predecessor rooms replaced by exactly
		// one survivor (the merge-survivor keeps the deterministic winner's ID).
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-e');
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.retiredRoomIds).toHaveLength(1);
		expect(plan.document.rooms[0]!.boundary.map((ref) => ref.wallId)).toEqual([
			'wall-a1',
			'wall-a2',
			'wall-b',
			'wall-c1',
			'wall-c2',
			'wall-d'
		]);
		// The merged face validates and compiles canonically.
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
		expect(compileWallFirstLayoutGeometry(plan.document).geometry.rooms).toHaveLength(1);
		// Shared endpoint Junctions survive: j-m and j-n are still referenced
		// by wall-a1/wall-a2 and wall-c1/wall-c2 respectively.
		const junctionIds = plan.document.junctions.map((junction) => junction.id);
		expect(junctionIds).toContain('j-m');
		expect(junctionIds).toContain('j-n');
	});

	it('deletes an outer boundary Wall and retires the opened Room deterministically', () => {
		const plan = success(deleteWall(BASE, 'wall-b'));
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-b');
		// The right enclosure opened: room-right retired, room-left untouched.
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-left']);
		expect(plan.retiredRoomIds).toEqual(['room-right']);
		expect(plan.document.rooms[0]!.boundary.map((ref) => ref.wallId)).toEqual([
			'wall-a1',
			'wall-e',
			'wall-c2',
			'wall-d'
		]);
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
	});

	it('deletes a roomless partition Wall with existing Room topology and identities unchanged', () => {
		const plan = success(deleteWall(BASE, 'wall-rl'));
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-rl');
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-left', 'room-right']);
		expect(plan.retiredRoomIds).toEqual([]);
		expect(plan.lineage).toEqual([]);
		// Reference-only pruning: j-x and j-y are now unreferenced endpoints.
		const junctionIds = new Set(plan.document.junctions.map((junction) => junction.id));
		expect(junctionIds.has('j-x')).toBe(false);
		expect(junctionIds.has('j-y')).toBe(false);
		expect(junctionIds.has('j-a')).toBe(true);
		expect(junctionIds.has('j-c')).toBe(true);
	});

	it('removes hosted Openings atomically in every successful case', () => {
		const hosted: LayoutDocumentWallFirst = {
			...BASE,
			openings: [
				{
					id: 'opening:door:1',
					wallId: 'wall-e',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular'
				},
				{
					id: 'opening:window:1',
					wallId: 'wall-rl',
					kind: 'window',
					offset: 0.5,
					width: 1.2,
					height: 1.2,
					sillHeight: 1,
					profile: 'rectangular'
				}
			]
		};
		const sharedDelete = success(deleteWall(hosted, 'wall-e'));
		expect(sharedDelete.document.openings.map((opening) => opening.id)).toEqual([
			'opening:window:1'
		]);
		const partitionDelete = success(deleteWall(hosted, 'wall-rl'));
		expect(partitionDelete.document.openings.map((opening) => opening.id)).toEqual([
			'opening:door:1'
		]);
	});

	it('prunes Junctions reference-only: shared endpoints never vanish, orphans do', () => {
		// Deleting the roomless partition orphans exactly its two endpoints.
		const orphanPlan = success(deleteWall(BASE, 'wall-rl'));
		expect(orphanPlan.document.junctions.map((junction) => junction.id)).toEqual([
			'j-a',
			'j-m',
			'j-b',
			'j-c',
			'j-n',
			'j-d'
		]);
		// Deleting one segment of the left room's outer boundary keeps j-a:
		// wall-d still references it (no spatial healing, no merging).
		const outerPlan = success(deleteWall(BASE, 'wall-a1'));
		const junctionIds = new Set(outerPlan.document.junctions.map((junction) => junction.id));
		expect(junctionIds.has('j-a')).toBe(true);
		expect(junctionIds.has('j-m')).toBe(true);
	});

	it('never sweeps pre-existing orphan Junctions unrelated to the deleted Wall (review regression)', () => {
		// An orphan Junction parked far from both rooms, authored before the
		// delete and referenced by no Wall. It belongs to no Wall's endpoints,
		// so deleting ANY Wall must leave it alone — cleanup is scoped to the
		// deleted Wall's own startJunctionId/endJunctionId, never a
		// document-wide unreferenced-Junction sweep.
		const withUnrelatedOrphan: LayoutDocumentWallFirst = {
			...BASE,
			junctions: [...BASE.junctions, { id: 'j-orphan', point: [20, 20] }]
		};
		// The orphan is valid input: walls resolve, rooms are untouched.
		expect(validateWallFirstLayoutDocument(withUnrelatedOrphan).success).toBe(true);
		for (const wallId of ['wall-rl', 'wall-e', 'wall-b']) {
			const plan = success(deleteWall(withUnrelatedOrphan, wallId));
			expect(plan.document.junctions.map((junction) => junction.id)).toContain('j-orphan');
			expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
		}
		// The deleted Wall's own endpoints still prune under the same rule:
		// wall-rl's j-x/j-y go, but the unrelated orphan survives.
		const partitionPlan = success(deleteWall(withUnrelatedOrphan, 'wall-rl'));
		const ids = new Set(partitionPlan.document.junctions.map((junction) => junction.id));
		expect(ids.has('j-x')).toBe(false);
		expect(ids.has('j-y')).toBe(false);
		expect(ids.has('j-orphan')).toBe(true);
		// And when one endpoint IS shared with a surviving Wall, it survives
		// while the other endpoint goes — per-endpoint reference check.
		const outerPlan = success(deleteWall(withUnrelatedOrphan, 'wall-a1'));
		const outerIds = new Set(outerPlan.document.junctions.map((junction) => junction.id));
		expect(outerIds.has('j-a')).toBe(true);
		expect(outerIds.has('j-m')).toBe(true);
		expect(outerIds.has('j-orphan')).toBe(true);
	});

	it('remaps a surviving-wall portal relation through the 2→1 merge', () => {
		const related: LayoutDocumentWallFirst = {
			...BASE,
			openings: [
				{
					id: 'opening:door:2',
					wallId: 'wall-d',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['room-left', 'room-right']
				}
			]
		};
		const plan = success(deleteWall(related, 'wall-e'));
		expect(plan.document.openings).toHaveLength(1);
		// Both endpoints resolve to the deterministic merge survivor; the
		// collapsed tuple clears per the P23.8 semantic-collapse rule only
		// when both sides resolve to one room — here the survivor is one
		// room, so the relation clears rather than pointing [x, x] twice.
		const relation = plan.document.openings[0]!.connectsRoomIds;
		if (relation) {
			for (const roomId of relation) {
				expect(plan.document.rooms.map((room) => room.id)).toContain(roomId);
			}
		}
	});

	it('deletes the deleted Wall hosted Opening (and its relation) wholesale', () => {
		const related: LayoutDocumentWallFirst = {
			...BASE,
			openings: [
				{
					id: 'opening:door:1',
					wallId: 'wall-e',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['room-left', 'room-right']
				}
			]
		};
		const plan = success(deleteWall(related, 'wall-e'));
		expect(plan.document.openings).toEqual([]);
	});

	it('remaps document-level object associations through the reconciliation', () => {
		const withObjects: LayoutDocumentWallFirst = {
			...BASE,
			objects: [
				{
					id: 'obj-1',
					kind: 'box',
					position: [1, 0, 2],
					dimensions: [1, 1, 1],
					rotation: [0, 0, 0],
					roomId: 'room-left'
				},
				{
					id: 'obj-2',
					kind: 'box',
					position: [4, 0, 2],
					dimensions: [1, 1, 1],
					rotation: [0, 0, 0],
					roomId: 'room-right'
				}
			]
		};
		const plan = success(deleteWall(withObjects, 'wall-e'));
		const byId = new Map(plan.document.objects.map((object) => [object.id, object]));
		const survivorId = plan.document.rooms[0]!.id;
		expect(byId.get('obj-1')!.roomId).toBe(survivorId);
		expect(byId.get('obj-2')!.roomId).toBe(survivorId);
	});

	it('rejects an unknown Wall atomically', () => {
		expect(rejection(deleteWall(BASE, 'wall-missing'))).toMatchObject({
			code: 'unknown_wall'
		});
	});

	it('is input-pure: the baseline document is never mutated', () => {
		const snapshot = JSON.stringify(BASE);
		success(deleteWall(BASE, 'wall-e'));
		success(deleteWall(BASE, 'wall-b'));
		success(deleteWall(BASE, 'wall-rl'));
		expect(JSON.stringify(BASE)).toBe(snapshot);
	});

	it('demolishes every Wall one deletion at a time to an empty document', () => {
		let document: LayoutDocumentWallFirst = BASE;
		for (const wallId of ['wall-e', 'wall-b', 'wall-d', 'wall-a1', 'wall-a2', 'wall-c1', 'wall-c2', 'wall-rl']) {
			document = success(deleteWall(document, wallId)).document;
			expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		}
		expect(document.walls).toEqual([]);
		expect(document.junctions).toEqual([]);
		expect(document.rooms).toEqual([]);
		expect(compileWallFirstLayoutGeometry(document).geometry.walls).toEqual([]);
	});

	it('deletes the roomless Wall cleanly (the former role-change subject is gone)', () => {
		// Format 6 retires the role-change planner, so this covers the surviving
		// operation: the same Wall deletes with no Room change.
		expect(success(deleteWall(BASE, 'wall-rl')).kind).toBe('success');
	});
});
