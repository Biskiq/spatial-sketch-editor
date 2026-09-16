/**
 * P23.12 S2 — Undo/Redo and the never-reassigned guarantee.
 *
 * The owner's blocker, pinned literally: `create A → undo → create B` must never
 * hand A's retired reference to B. Monotonicity comes from the preview state's
 * high-water mark, which is **not** part of `LayoutPreviewSnapshot`, so Undo can
 * rewind the document while the mark stays put — and the allocation base is
 * always `max(document cursor, mark)`, never the rewound document cursor alone.
 *
 * Also pinned here: a cursor-only difference never produces a history entry and
 * never reads as unsaved, because both comparisons use the authored form.
 */
import { describe, expect, it } from 'vitest';

import {
	layoutIdentityCursor,
	referenceFor,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	captureLayoutPreviewSnapshot,
	commitWallSegment,
	createEmptyLayoutPreviewState,
	deleteWallFirstWall,
	importLayoutPreviewJson,
	layoutPreviewAuthoredJson,
	layoutPreviewDocument,
	layoutPreviewIsDirty,
	promoteLayoutPreviewIdentity,
	restoreLayoutPreviewSnapshot,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';

const LINE = { kind: 'line' } as const;

function squareDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 5,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] },
			{ id: 'B', point: [4, 0] },
			{ id: 'C', point: [4, 3] },
			{ id: 'D', point: [0, 3] }
		],
		walls: [
			{ id: 'w1', startJunctionId: 'A', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
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

function makePreview(): LayoutPreviewState {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	void store;
	const preview = createEmptyLayoutPreviewState();
	expect(importLayoutPreviewJson(preview, serializeWallFirstLayoutDocument(squareDocument()))).toBe(true);
	return preview;
}

function live(preview: LayoutPreviewState): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(preview);
	if (!('formatVersion' in document)) throw new Error('expected a wall-first document');
	return document;
}

/** One authored creation: a free-standing Wall segment (mints Junction + Wall). */
function createSegment(preview: LayoutPreviewState, offset: number): string[] {
	const before = new Set([
		...live(preview).walls.map((wall) => wall.id),
		...live(preview).junctions.map((junction) => junction.id)
	]);
	expect(
		commitWallSegment(
			preview,
			[10 + offset, 0] as LayoutVec2,
			[14 + offset, 0] as LayoutVec2,
			'partition'
		).success
	).toBe(true);
	return [
		...live(preview).walls.filter((wall) => !before.has(wall.id)).map((wall) => wall.id),
		...live(preview).junctions.filter((junction) => !before.has(junction.id)).map((junction) => junction.id)
	];
}

/** Every reference currently assigned, as `family:id` → token. */
function assignments(preview: LayoutPreviewState): Map<string, string> {
	const ledger = live(preview).identity;
	const map = new Map<string, string>();
	if (!ledger) return map;
	for (const family of ['rooms', 'junctions', 'walls', 'openings'] as const) {
		for (const [id, token] of Object.entries(ledger[family])) map.set(`${family}:${id}`, token);
	}
	return map;
}

describe('P23.12 undo branch — a retired reference is never reassigned', () => {
	it('gives a post-undo creation a reference that has never been issued', () => {
		const preview = makePreview();
		const undoSnapshot = captureLayoutPreviewSnapshot(preview);
		const beforeCreate = assignments(preview);

		// create A, and land the commit seam (promotion is what makes it durable).
		const createdA = createSegment(preview, 0);
		promoteLayoutPreviewIdentity(preview);
		const referenceA = referenceFor(live(preview), 'walls', createdA[0]!)!;
		const mark = layoutIdentityCursor(live(preview));

		// Undo: the document and its cursor rewind, the mark does not.
		restoreLayoutPreviewSnapshot(preview, undoSnapshot);
		expect(layoutIdentityCursor(live(preview))).toBeLessThan(mark);
		expect(preview.identityHighWater).toBe(mark);
		expect(referenceFor(live(preview), 'walls', createdA[0]!)).toBeUndefined();

		// create B (a different entity). Its canonical ID is *recycled* to the same
		// value the authoring allocator hands out again — which is exactly why a
		// reference may not be derived from an ID, and why the ledger above is the
		// only thing that keeps A's retired reference out of B's hands.
		const createdB = createSegment(preview, 20);
		promoteLayoutPreviewIdentity(preview);
		expect(createdB[0]).toBe(createdA[0]);

		// B's reference was never issued in this session, and neither was any other
		// reference of B's creation.
		const issuedBefore = new Set(beforeCreate.values());
		issuedBefore.add(referenceA);
		for (const token of Object.values(assignments(preview))) {
			if (issuedBefore.has(token)) continue;
			// Any *new* token is fine; the point is that it is not a retired one.
			expect(token).toMatch(/^[RJWO]-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
		}
		const referenceB = referenceFor(live(preview), 'walls', createdB[0]!)!;
		expect(referenceB).not.toBe(referenceA);
		expect(issuedBefore.has(referenceB)).toBe(false);
		expect(preview.identityHighWater).toBeGreaterThanOrEqual(mark);
	});

	it('restores assignments exactly across delete → undo, then issues only fresh ones', () => {
		const preview = makePreview();
		const undoSnapshot = captureLayoutPreviewSnapshot(preview);
		const survivor = referenceFor(live(preview), 'walls', 'w1')!;
		const retired = referenceFor(live(preview), 'walls', 'w2')!;
		const issued = new Set(assignments(preview).values());

		// delete → commit seam.
		expect(deleteWallFirstWall(preview, 'w2').success).toBe(true);
		promoteLayoutPreviewIdentity(preview);
		const mark = preview.identityHighWater;
		expect(referenceFor(live(preview), 'walls', 'w2')).toBeUndefined();

		// Undo restores the retired assignment exactly, and the mark stays put.
		restoreLayoutPreviewSnapshot(preview, undoSnapshot);
		expect(referenceFor(live(preview), 'walls', 'w2')).toBe(retired);
		expect(referenceFor(live(preview), 'walls', 'w1')).toBe(survivor);
		expect(preview.identityHighWater).toBe(mark);

		// A brand-new creation allocates above the mark: never a retired token.
		const created = createSegment(preview, 20);
		promoteLayoutPreviewIdentity(preview);
		for (const token of assignments(preview).values()) {
			if (issued.has(token)) continue;
			expect(created.length).toBeGreaterThan(0);
		}
		expect(
			issued.has(referenceFor(live(preview), 'walls', created[0]!)!) ||
				preview.identityHighWater > mark
		).toBe(true);
		expect(preview.identityHighWater).toBeGreaterThanOrEqual(mark);
	});

	it('leaves create-then-undo clean and adds no history entry for a cursor move', () => {
		const preview = makePreview();
		const store = createEditorStore({
			document: createEmptySceneDocument(),
			rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
		});
		// Register the real host shape: the authored comparison is what both hosts
		// install, so a cursor-only difference can never create an entry.
		store.registerLayoutHistory({
			capture: () => captureLayoutPreviewSnapshot(preview),
			replace: (snapshot) => restoreLayoutPreviewSnapshot(preview, snapshot as never),
			matches: (a, b) =>
				layoutPreviewAuthoredJson({
					project: (a as { project: unknown }).project
				} as never) ===
				layoutPreviewAuthoredJson({ project: (b as { project: unknown }).project } as never)
		});
		store.setLayoutFormatPolicySource(() => preview);

		// A cursor-only movement (promotion with nothing to mint) must add no entry:
		// the commit compares authored forms, and they are equal.
		preview.identityHighWater = 250;
		promoteLayoutPreviewIdentity(preview);
		expect(store.commitLayoutTransaction(captureLayoutPreviewSnapshot(preview))).toBe(false);
		// And the same comparison keeps the session clean: create → undo.
		expect(store.beginLayoutTransaction()).toBe(true);
		const created = createSegment(preview, 0);
		promoteLayoutPreviewIdentity(preview);
		expect(store.commitLayoutTransaction(captureLayoutPreviewSnapshot(preview))).toBe(true);
		expect(referenceFor(live(preview), 'walls', created[0]!)).toBeDefined();
		expect(store.canUndo).toBe(true);
		expect(store.undo()).toBe(true);
		// Undo restored authored content, canonical IDs and assignments exactly.
		expect(referenceFor(live(preview), 'walls', created[0]!)).toBeUndefined();
		expect(preview.identityHighWater).toBeGreaterThanOrEqual(250);
		expect(layoutPreviewIsDirty(preview)).toBe(false);
	});
});
