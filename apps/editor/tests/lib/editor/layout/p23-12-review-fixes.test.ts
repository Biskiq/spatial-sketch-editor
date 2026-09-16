/**
 * P23.12 review fixes — the four working-tree seams a reviewer reproduced.
 *
 * Each test is the *failing* reproduction the review supplied, now pinned:
 *
 * - Save baselines the **snapshot that was sent**, so an edit made while the
 *   request is in flight stays dirty (it is not in the persisted payload);
 * - Cloud Load and resumed saves **normalize** the incoming document, so a
 *   pre-P23.12 project installs ledger-complete instead of staying reference-less
 *   until the next mutation or Save;
 * - a wholesale replacement (import) derives from **its own** cursor and
 *   re-seeds the mark from the installed document, so importing the same
 *   ledger-less payload twice resolves identically;
 * - duplicating a Room copies the optional Wall and Opening names.
 */
import { describe, expect, it } from 'vitest';

import {
	layoutIdentityCursor,
	layoutIdentityCursorIssues,
	layoutIdentityIsComplete,
	planDuplicateIsolatedRoom,
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
	createEmptyLayoutPreviewState,
	derivePreviewBundle,
	importLayoutPreviewJson,
	layoutAuthoredJsonOf,
	layoutPreviewDocument,
	layoutPreviewIsDirty,
	markLayoutPreviewSaved,
	normalizeIncomingLayout,
	replacementIdentityBase,
	updateWallFirstWallMetadata,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';

const LINE = { kind: 'line' } as const;

/** One 4×3 m Room with a door on `w1` — authored, **no identity ledger**. */
function ledgerLessDocument(): LayoutDocumentWallFirst {
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

/** A bigger ledger-less payload, used only to move a session's allocation mark. */
function widerLedgerLessDocument(): LayoutDocumentWallFirst {
	const document = ledgerLessDocument();
	return {
		...document,
		junctions: [
			...document.junctions,
			{ id: 'E', point: [8, 0] },
			{ id: 'F', point: [8, 3] }
		],
		walls: [
			...document.walls,
			{ id: 'w5', startJunctionId: 'E', endJunctionId: 'F', role: 'partition', thickness: 0.2, height: 3, centerline: LINE }
		]
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
	expect(importLayoutPreviewJson(preview, serializeWallFirstLayoutDocument(document))).toBe(true);
}

function live(preview: LayoutPreviewState): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(preview);
	if (!('formatVersion' in document)) throw new Error('expected a wall-first document');
	return document;
}

function referencesOf(preview: LayoutPreviewState) {
	const document = live(preview);
	return {
		walls: document.walls.map((wall) => [wall.id, referenceFor(document, 'walls', wall.id)] as const),
		openings: document.openings.map(
			(opening) => [opening.id, referenceFor(document, 'openings', opening.id)] as const
		)
	};
}

// ---------------------------------------------------------------------------
// P1 — Save baselines the snapshot that was sent
// ---------------------------------------------------------------------------

describe('P23.12 review — Save baselines the sent snapshot', () => {
	it('an edit made while the request is in flight stays dirty', () => {
		const preview = makePreview();
		importDocument(preview, ledgerLessDocument());
		expect(updateWallFirstWallMetadata(preview, 'w1', { name: 'North' }).success).toBe(true);

		// The payload the request captured, and therefore what the server holds.
		const sent = layoutPreviewDocument(preview) as unknown as LayoutDocumentWallFirst;
		const sentAuthoredJson = layoutAuthoredJsonOf(sent);

		// The user keeps editing before the response lands.
		expect(updateWallFirstWallMetadata(preview, 'w2', { name: 'Later' }).success).toBe(true);

		// Success callback: baseline the snapshot, never the live document.
		markLayoutPreviewSaved(preview, sentAuthoredJson);

		expect(layoutPreviewIsDirty(preview)).toBe(true);
	});

	it('a save with no intervening edit is still clean', () => {
		const preview = makePreview();
		importDocument(preview, ledgerLessDocument());
		expect(updateWallFirstWallMetadata(preview, 'w1', { name: 'North' }).success).toBe(true);
		markLayoutPreviewSaved(preview, layoutAuthoredJsonOf(live(preview)));
		expect(layoutPreviewIsDirty(preview)).toBe(false);
	});

	it('baselining the sent snapshot is what the live document would have hidden', () => {
		// Direct comparison: after an edit, the two authored forms differ, so a
		// callback that baselined the live document would report clean.
		const preview = makePreview();
		importDocument(preview, ledgerLessDocument());
		const sent = layoutAuthoredJsonOf(live(preview));
		expect(updateWallFirstWallMetadata(preview, 'w1', { name: 'North' }).success).toBe(true);
		expect(layoutAuthoredJsonOf(live(preview))).not.toBe(sent);
	});
});

// ---------------------------------------------------------------------------
// P2 — Cloud Load / resumed save normalize the incoming document
// ---------------------------------------------------------------------------

describe('P23.12 review — incoming replacements normalize before install', () => {
	it('a pre-P23.12 payload installs ledger-complete through the Load composition', () => {
		// Normalization repairs a stale cursor against the payload's own ledger;
		// a ledger-less document is already consistent, so nothing is minted here.
		const incoming = normalizeIncomingLayout(ledgerLessDocument());
		expect(layoutIdentityCursorIssues(incoming as LayoutDocumentWallFirst)).toEqual([]);
		expect(layoutIdentityCursor(incoming as LayoutDocumentWallFirst)).toBe(0);

		const bundle = derivePreviewBundle(
			'p1',
			'Loaded',
			incoming,
			createEmptySceneDocument(),
			undefined,
			replacementIdentityBase(incoming)
		);
		const installed = bundle.project.layout as unknown as LayoutDocumentWallFirst;
		expect(layoutIdentityIsComplete(installed)).toBe(true);
		expect(referenceFor(installed, 'walls', 'w1')).toMatch(/^W-/);
		expect(referenceFor(installed, 'openings', 'door')).toMatch(/^O-/);
	});

	it('deriving without an identity base leaves references unresolved (the reported bug)', () => {
		const bundle = derivePreviewBundle(
			'p1',
			'Loaded',
			ledgerLessDocument(),
			createEmptySceneDocument()
		);
		const installed = bundle.project.layout as unknown as LayoutDocumentWallFirst;
		expect(referenceFor(installed, 'walls', 'w1')).toBeUndefined();
		expect(layoutIdentityIsComplete(installed)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// P2 — Import reseeds from the incoming document, never the previous mark
// ---------------------------------------------------------------------------

describe('P23.12 review — import determinism', () => {
	it('importing the same ledger-less payload twice resolves identically', () => {
		const preview = makePreview();
		importDocument(preview, ledgerLessDocument());
		const first = referencesOf(preview);

		// A different document in between moves the session allocation mark.
		importDocument(preview, widerLedgerLessDocument());
		importDocument(preview, ledgerLessDocument());
		const second = referencesOf(preview);

		expect(second).toEqual(first);
	});

	it('re-seeds the session mark from the installed document', () => {
		const preview = makePreview();
		importDocument(preview, ledgerLessDocument());
		const installedCursor = layoutIdentityCursor(live(preview));
		expect(installedCursor).toBeGreaterThan(0);

		// Import the wide document, then the small one again: the mark must come
		// back down to the small payload, not stay at the wide payload's mark.
		importDocument(preview, widerLedgerLessDocument());
		const wideCursor = layoutIdentityCursor(live(preview));
		expect(wideCursor).toBeGreaterThan(installedCursor);
		importDocument(preview, ledgerLessDocument());
		expect(layoutIdentityCursor(live(preview))).toBe(installedCursor);
	});

	it('a fresh preview and a reused preview agree on the same payload', () => {
		const reused = makePreview();
		importDocument(reused, widerLedgerLessDocument());
		importDocument(reused, ledgerLessDocument());

		const fresh = makePreview();
		importDocument(fresh, ledgerLessDocument());

		expect(referencesOf(reused)).toEqual(referencesOf(fresh));
	});
});

// ---------------------------------------------------------------------------
// P2 — Room duplication keeps the optional Wall/Opening names
// ---------------------------------------------------------------------------

describe('P23.12 review — duplicate copies authored names', () => {
	it('a named Room duplicates with its named Walls and Opening', () => {
		const document = ledgerLessDocument();
		const named: LayoutDocumentWallFirst = {
			...document,
			walls: document.walls.map((wall) => (wall.id === 'w1' ? { ...wall, name: 'North Gallery Wall' } : wall)),
			openings: document.openings.map((opening) =>
				opening.id === 'door' ? { ...opening, name: 'Main Entrance' } : opening
			)
		};

		const plan = planDuplicateIsolatedRoom(named, { roomId: 'room', delta: [10, 0] as LayoutVec2 });
		if (plan.kind !== 'success') throw new Error('expected the isolated Room to duplicate');

		const clonedWall = plan.document.walls.find(
			(wall) => plan.createdWallIds.includes(wall.id) && wall.name !== undefined
		);
		expect(clonedWall?.name).toBe('North Gallery Wall');
		const clonedOpening = plan.document.openings.find(
			(opening) => plan.createdOpeningIds.includes(opening.id) && opening.name !== undefined
		);
		expect(clonedOpening?.name).toBe('Main Entrance');

		// Every created Wall/Opening keeps the source name count — no name is
		// dropped, and no source entity is renamed.
		expect(plan.createdWallIds).toHaveLength(4);
		expect(plan.createdOpeningIds).toHaveLength(1);
		expect(plan.document.walls.find((wall) => wall.id === 'w1')?.name).toBe('North Gallery Wall');
	});

	it('an unnamed source duplicates with no invented name', () => {
		const plan = planDuplicateIsolatedRoom(ledgerLessDocument(), {
			roomId: 'room',
			delta: [10, 0] as LayoutVec2
		});
		if (plan.kind !== 'success') throw new Error('expected the isolated Room to duplicate');
		for (const wall of plan.document.walls) {
			if (plan.createdWallIds.includes(wall.id)) expect(wall.name).toBeUndefined();
		}
		for (const opening of plan.document.openings) {
			if (plan.createdOpeningIds.includes(opening.id)) expect(opening.name).toBeUndefined();
		}
	});
});
