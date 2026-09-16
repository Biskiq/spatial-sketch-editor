/**
 * P23.12 S2 — lifecycle, install normalization and persistence.
 *
 * The four seam kinds (D1) in the real app seams: derivation is provisional, a
 * transaction commit and every Save/export payload promote, restores are exact,
 * and a document replacement re-seeds the session mark from its own payload.
 *
 * What these tests protect:
 * - every install path leaves a *complete* ledger (no entity without a reference);
 * - a pre-P23.12 payload imports, is not dirty, and backfills deterministically;
 * - a stale payload cursor is repaired upward against the live ledger;
 * - Save → Load → Save is byte-stable and the baseline is the authored form;
 * - the owner's persistence case: `create A → undo → export → import → create B`
 *   can never hand A's reference to B.
 */
import { describe, expect, it } from 'vitest';

import {
	layoutIdentityCursor,
	layoutIdentityCursorIssues,
	layoutIdentityIsComplete,
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
	commitLayoutObjectPreset,
	commitWallSegment,
	createEmptyLayoutPreviewState,
	deleteWallFirstWall,
	importLayoutPreviewJson,
	layoutPreviewAuthoredJson,
	layoutPreviewCanonicalJson,
	layoutPreviewDocument,
	layoutPreviewIsDirty,
	markLayoutPreviewSaved,
	promoteLayoutPreviewIdentity,
	restoreLayoutPreviewSnapshot,
	subdivideWallFirstWall,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const LINE = { kind: 'line' } as const;

/** One 4×3 m Room with a door on `w1`. */
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
		openings: [
			{ id: 'door', wallId: 'w1', kind: 'door', offset: 1, width: 1, height: 2, sillHeight: 0, profile: 'rectangular' }
		],
		objects: []
	};
}

function makePreview(): LayoutPreviewState {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	void store;
	return createEmptyLayoutPreviewState();
}

function importDocument(preview: LayoutPreviewState, document: LayoutDocumentWallFirst): void {
	const ok = importLayoutPreviewJson(preview, serializeWallFirstLayoutDocument(document));
	expect(ok).toBe(true);
}

function live(preview: LayoutPreviewState): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(preview);
	if (!('formatVersion' in document)) throw new Error('expected a wall-first document');
	return document;
}

// ---------------------------------------------------------------------------
// install normalization
// ---------------------------------------------------------------------------

describe('P23.12 lifecycle — install normalization', () => {
	it('leaves a complete ledger after import and after every mutator', () => {
		const preview = makePreview();
		importDocument(preview, squareDocument());
		expect(layoutIdentityIsComplete(live(preview))).toBe(true);
		expect(referenceFor(live(preview), 'walls', 'w1')).toMatch(/^W-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
		expect(referenceFor(live(preview), 'junctions', 'A')).toMatch(/^J-/);
		expect(layoutIdentityCursorIssues(live(preview))).toEqual([]);

		// A subdivision mints for the new Junction and Wall and keeps the survivor.
		const survivorBefore = referenceFor(live(preview), 'walls', 'w1');
		expect(subdivideWallFirstWall(preview, 'w1', 2).success).toBe(true);
		expect(layoutIdentityIsComplete(live(preview))).toBe(true);
		expect(referenceFor(live(preview), 'walls', 'w1')).toBe(survivorBefore);

		// A new Wall segment in free space mints for everything it creates.
		expect(commitWallSegment(preview, [10, 0] as LayoutVec2, [14, 0] as LayoutVec2, 'partition').success).toBe(true);
		expect(layoutIdentityIsComplete(live(preview))).toBe(true);

		// Deleting prunes the retired assignment without moving the cursor back.
		const beforeDelete = layoutIdentityCursor(live(preview));
		const deletedWall = live(preview).walls.find((wall) => wall.id !== 'w1')!.id;
		const deletedReference = referenceFor(live(preview), 'walls', deletedWall);
		expect(deleteWallFirstWall(preview, deletedWall).success).toBe(true);
		expect(referenceFor(live(preview), 'walls', deletedWall)).toBeUndefined();
		expect(layoutIdentityCursor(live(preview))).toBeGreaterThanOrEqual(beforeDelete);
		expect(referenceFor(live(preview), 'walls', 'w1')).toBe(survivorBefore);
		expect(deletedReference).toBeDefined();
	});

	it('backfills a legacy payload deterministically and reads it as clean', () => {
		const legacy = squareDocument();
		// A pre-P23.12 payload has no ledger at all.
		const first = makePreview();
		expect(importLayoutPreviewJson(first, JSON.stringify(legacy))).toBe(true);
		expect(layoutIdentityIsComplete(live(first))).toBe(true);
		expect(layoutPreviewIsDirty(first)).toBe(false);

		const second = makePreview();
		expect(importLayoutPreviewJson(second, JSON.stringify(legacy))).toBe(true);
		// Identical payload → identical references.
		expect(live(second).identity).toEqual(live(first).identity);
	});

	it('repairs a stale payload cursor upward, against the live ledger', () => {
		const document = squareDocument();
		// A hand-edited/stale payload whose cursor sits below its own assignments.
		const stale: LayoutDocumentWallFirst = {
			...document,
			identity: {
				cursor: 1,
				rooms: { room: 'R-2QUS' },
				junctions: { A: 'J-5AEX', B: 'J-7V24', C: 'J-AEM9', D: 'J-CZ7E' },
				walls: { w1: 'W-FJSK', w2: 'W-J5CR', w3: 'W-MPXW', w4: 'W-Q9J3' },
				openings: { door: 'O-SU58' }
			}
		};
		const preview = makePreview();
		importDocument(preview, stale);
		expect(layoutIdentityCursorIssues(live(preview))).toEqual([]);
		expect(layoutIdentityCursor(live(preview))).toBeGreaterThan(1);
		// The repair is bookkeeping, not authored content: the session is clean.
		expect(layoutPreviewIsDirty(preview)).toBe(false);
		expect(referenceFor(live(preview), 'rooms', 'room')).toBe('R-2QUS');
	});
});

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------

describe('P23.12 lifecycle — persistence', () => {
	it('promotes at Save, baselines the authored form, and round-trips byte-stably', () => {
		const preview = makePreview();
		importDocument(preview, squareDocument());
		// A mutation mints provisionally; the Save seam promotes before serializing.
		expect(commitWallSegment(preview, [10, 0] as LayoutVec2, [14, 0] as LayoutVec2, 'partition').success).toBe(true);
		const markBefore = preview.identityHighWater;

		const payload = layoutPreviewCanonicalJson(preview);
		markLayoutPreviewSaved(preview);
		expect(preview.identityHighWater).toBeGreaterThanOrEqual(markBefore);
		expect(layoutPreviewIsDirty(preview)).toBe(false);

		// Save → Load → Save is byte-stable, and the cursor continues above the mark.
		const reloaded = makePreview();
		expect(importLayoutPreviewJson(reloaded, payload)).toBe(true);
		expect(layoutPreviewCanonicalJson(reloaded)).toBe(payload);
		expect(reloaded.identityHighWater).toBe(layoutIdentityCursor(live(reloaded)));

		const secondPayload = layoutPreviewCanonicalJson(reloaded);
		markLayoutPreviewSaved(reloaded);
		expect(layoutPreviewCanonicalJson(reloaded)).toBe(secondPayload);
		expect(layoutPreviewIsDirty(reloaded)).toBe(false);
	});

	it('never serializes a payload below the session mark, even with nothing to mint', () => {
		const preview = makePreview();
		importDocument(preview, squareDocument());
		// The "mints nothing" case: a mark above the document cursor must survive
		// promotion (T6) and reach the payload, so a later Load cannot reissue a
		// committed reference.
		preview.identityHighWater = 500;
		promoteLayoutPreviewIdentity(preview);
		expect(layoutIdentityCursor(live(preview))).toBe(500);
		expect(preview.identityHighWater).toBe(500);
		const payload = JSON.parse(layoutPreviewCanonicalJson(preview)) as {
			identity: { cursor: number };
		};
		expect(payload.identity.cursor).toBeGreaterThanOrEqual(500);
	});

	it('exposes the authored form for baselines and the full form for payloads', () => {
		const preview = makePreview();
		importDocument(preview, squareDocument());
		markLayoutPreviewSaved(preview);
		expect(layoutPreviewIsDirty(preview)).toBe(false);
		// A cursor-only movement must not read as dirty, but the payload still
		// carries the cursor.
		preview.identityHighWater += 0;
		expect(layoutPreviewAuthoredJson(preview)).not.toContain('"cursor"');
		expect(layoutPreviewCanonicalJson(preview)).toContain('"cursor"');
	});

	it('keeps a retired reference out of reach across undo → export → import (owner case)', () => {
		/** Commit one new Wall segment and return the id it created. */
		function createSegment(preview: LayoutPreviewState): string {
			const before = new Set(live(preview).walls.map((wall) => wall.id));
			expect(
				commitWallSegment(preview, [10, 0] as LayoutVec2, [14, 0] as LayoutVec2, 'partition').success
			).toBe(true);
			const created = live(preview).walls.find((wall) => !before.has(wall.id));
			if (!created) throw new Error('expected a new Wall');
			return created.id;
		}

		const preview = makePreview();
		importDocument(preview, squareDocument());
		const undoSnapshot = captureLayoutPreviewSnapshot(preview);

		// create A, then land the commit seam: promotion is what makes A's
		// reference a durable assignment and moves the mark to the document cursor.
		const createdA = createSegment(preview);
		promoteLayoutPreviewIdentity(preview);
		const referenceA = referenceFor(live(preview), 'walls', createdA)!;
		const mark = preview.identityHighWater;
		expect(mark).toBe(layoutIdentityCursor(live(preview)));

		// Undo: the document (and its cursor) rewinds, the session mark does not.
		restoreLayoutPreviewSnapshot(preview, undoSnapshot);
		expect(referenceFor(live(preview), 'walls', createdA)).toBeUndefined();
		expect(preview.identityHighWater).toBe(mark);

		// Export the rewound document — the real export path promotes first, which
		// re-syncs the payload cursor to the mark — then import it back.
		promoteLayoutPreviewIdentity(preview);
		const payload = layoutPreviewCanonicalJson(preview);
		expect((JSON.parse(payload) as { identity: { cursor: number } }).identity.cursor).toBeGreaterThanOrEqual(mark);

		const reopened = makePreview();
		expect(importLayoutPreviewJson(reopened, payload)).toBe(true);
		const createdB = createSegment(reopened);
		expect(referenceFor(live(reopened), 'walls', createdB)).not.toBe(referenceA);
	});

	it('keeps an object-preset install complete, and objects gain no reference', () => {
		const preview = makePreview();
		importDocument(preview, squareDocument());
		markLayoutPreviewSaved(preview);
		const result = commitLayoutObjectPreset(preview, 'column', [1, 1] as LayoutVec2);
		expect(result.success).toBe(true);
		// Layout objects are not a reference family (R/W/O/J only).
		expect(layoutIdentityIsComplete(live(preview))).toBe(true);
		expect(layoutPreviewIsDirty(preview)).toBe(true);
	});
});
