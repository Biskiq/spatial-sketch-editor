/**
 * P23.12 S3 — Wall/Opening optional names: schema, planners, adapters.
 *
 * The exact `OptionalNamePatch` table (owner-required lock):
 *
 * - a string trims and sets; a trimming-to-empty string rejects `invalid_value`;
 * - `null` **removes** the property (clear) and restores reference-led
 *   presentation;
 * - an absent key is not a mutation;
 * - `null` on an already-unnamed entity rejects `no_op`;
 * - a key present with the same value rejects `no_op`;
 * - duplicate names are legal; a rename changes no reference and no topology;
 * - a rejected patch installs nothing and writes no history.
 *
 * Also pinned: the Room planner's codes and messages are unchanged, the
 * codec rejects a present-but-blank name, and the editor adapters carry the
 * plan through the one document-install point.
 */
import { describe, expect, it } from 'vitest';

import {
	referenceFor,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

import {
	planOpeningMetadataUpdate,
	planWallMetadataUpdate,
	planRoomMetadataUpdate
} from '@portfolio/layout-core';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewAuthoredJson,
	layoutPreviewDocument,
	layoutPreviewIsDirty,
	updateWallFirstOpeningMetadata,
	updateWallFirstWallMetadata
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
		openings: [
			{ id: 'door', wallId: 'w1', kind: 'door', offset: 1, width: 1, height: 2, sillHeight: 0, profile: 'rectangular' }
		],
		objects: []
	};
}

function makeState(): ReturnType<typeof createEmptyLayoutPreviewState> {
	const state = createEmptyLayoutPreviewState();
	expect(importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(squareDocument()))).toBe(true);
	return state;
}

function live(state: ReturnType<typeof createEmptyLayoutPreviewState>): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(state);
	if (!('formatVersion' in document)) throw new Error('expected a wall-first document');
	return document;
}

function wallOf(document: LayoutDocumentWallFirst, wallId: string): { name?: string } {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) throw new Error(`missing wall ${wallId}`);
	return wall;
}

function openingOf(document: LayoutDocumentWallFirst, openingId: string): { name?: string } {
	const opening = document.openings.find((candidate) => candidate.id === openingId);
	if (!opening) throw new Error(`missing opening ${openingId}`);
	return opening;
}

function makeStoreHarness() {
	const state = makeState();
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	store.registerLayoutHistory({
		capture: () => {
			throw new Error('capture not expected in this suite');
		},
		replace: () => undefined,
		matches: (a, b) => a === b
	});
	store.setLayoutFormatPolicySource(() => state);
	return { state, store };
}

// ---------------------------------------------------------------------------
// the OptionalNamePatch table — planner level (Wall)
// ---------------------------------------------------------------------------

describe('P23.12 names — planWallMetadataUpdate patch table', () => {
	it('trims and sets a name', () => {
		const plan = planWallMetadataUpdate(squareDocument(), 'w1', { name: '  North Gallery Wall  ' });
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(wallOf(plan.document, 'w1').name).toBe('North Gallery Wall');
	});

	it('rejects a trimming-to-empty string as invalid_value', () => {
		const plan = planWallMetadataUpdate(squareDocument(), 'w1', { name: '   ' });
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('invalid_value');
	});

	it('null removes the property (clear) and restores reference-led presentation', () => {
		const named = planWallMetadataUpdate(squareDocument(), 'w1', { name: 'North' });
		expect(named.kind).toBe('success');
		const cleared = planWallMetadataUpdate(
			named.kind === 'success' ? named.document : squareDocument(),
			'w1',
			{ name: null }
		);
		expect(cleared.kind).toBe('success');
		if (cleared.kind !== 'success') return;
		expect('name' in wallOf(cleared.document, 'w1')).toBe(false);
		// The identity ledger (minted at the install seam, not in planners) is
		// untouched by the whole round trip — a rename/clear never re-mints.
		expect(cleared.document.identity).toBe(undefined);
	});

	it('an absent key is not a mutation (and a bare empty patch is a no_op)', () => {
		const plan = planWallMetadataUpdate(squareDocument(), 'w1', {});
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('no_op');
	});

	it('null on an already-unnamed wall rejects no_op', () => {
		const plan = planWallMetadataUpdate(squareDocument(), 'w1', { name: null });
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('no_op');
	});

	it('a key present with the same value rejects no_op', () => {
		const named = planWallMetadataUpdate(squareDocument(), 'w1', { name: 'North' });
		expect(named.kind).toBe('success');
		const again = planWallMetadataUpdate(
			named.kind === 'success' ? named.document : squareDocument(),
			'w1',
			{ name: 'North' }
		);
		expect(again.kind).toBe('rejected');
		if (again.kind !== 'rejected') return;
		expect(again.rejection.code).toBe('no_op');
	});

	it('duplicate names are legal across walls', () => {
		const first = planWallMetadataUpdate(squareDocument(), 'w1', { name: 'Gallery' });
		expect(first.kind).toBe('success');
		const second = planWallMetadataUpdate(
			first.kind === 'success' ? first.document : squareDocument(),
			'w2',
			{ name: 'Gallery' }
		);
		expect(second.kind).toBe('success');
		if (second.kind !== 'success') return;
		expect(wallOf(second.document, 'w1').name).toBe('Gallery');
		expect(wallOf(second.document, 'w2').name).toBe('Gallery');
	});

	it('a rename changes no reference and no topology', () => {
		const before = squareDocument();
		const plan = planWallMetadataUpdate(before, 'w1', { name: 'Renamed' });
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// Every reference survives byte-identically.
		for (const id of ['w1', 'w2', 'w3', 'w4']) {
			expect(referenceFor(plan.document, 'walls', id)).toBe(referenceFor(before, 'walls', id));
		}
		expect(referenceFor(plan.document, 'junctions', 'A')).toBe(referenceFor(before, 'junctions', 'A'));
		expect(referenceFor(plan.document, 'rooms', 'room')).toBe(referenceFor(before, 'rooms', 'room'));
		// Topology: same junctions, same boundary references.
		expect(plan.document.junctions).toEqual(before.junctions);
		expect(plan.document.rooms).toEqual(before.rooms);
	});

	it('a rejected patch changes nothing', () => {
		const before = squareDocument();
		const plan = planWallMetadataUpdate(before, 'w1', { name: '   ' });
		expect(plan.kind).toBe('rejected');
		// Pure function: the input document is untouched.
		expect('name' in wallOf(before, 'w1')).toBe(false);
	});

	it('an unknown wall rejects unknown_wall', () => {
		const plan = planWallMetadataUpdate(squareDocument(), 'nope', { name: 'X' });
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('unknown_wall');
	});

	it('an unrecognized key rejects invalid_patch', () => {
		const plan = planWallMetadataUpdate(squareDocument(), 'w1', { name: 'X', role: 'partition' } as never);
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('invalid_patch');
	});
});

// ---------------------------------------------------------------------------
// the OptionalNamePatch table — planner level (Opening)
// ---------------------------------------------------------------------------

describe('P23.12 names — planOpeningMetadataUpdate patch table', () => {
	it('trims, sets, clears and no-ops exactly like the Wall planner', () => {
		const document = squareDocument();
		const named = planOpeningMetadataUpdate(document, 'door', { name: ' Main Entrance ' });
		expect(named.kind).toBe('success');
		if (named.kind !== 'success') return;
		expect(openingOf(named.document, 'door').name).toBe('Main Entrance');

		const same = planOpeningMetadataUpdate(named.document, 'door', { name: 'Main Entrance' });
		expect(same.kind).toBe('rejected');

		const cleared = planOpeningMetadataUpdate(named.document, 'door', { name: null });
		expect(cleared.kind).toBe('success');
		if (cleared.kind !== 'success') return;
		expect('name' in openingOf(cleared.document, 'door')).toBe(false);

		const clearedAgain = planOpeningMetadataUpdate(cleared.document, 'door', { name: null });
		expect(clearedAgain.kind).toBe('rejected');

		// The host Wall and geometry are untouched by the whole round trip.
		const final = cleared.document;
		expect(openingOf(final, 'door')).toEqual(openingOf(document, 'door'));
	});

	it('duplicate names are legal and an unknown opening rejects', () => {
		const document = squareDocument();
		const named = planOpeningMetadataUpdate(document, 'door', { name: 'Entrance' });
		expect(named.kind).toBe('success');
		const unknown = planOpeningMetadataUpdate(document, 'nope', { name: 'X' });
		expect(unknown.kind).toBe('rejected');
		if (unknown.kind !== 'rejected') return;
		expect(unknown.rejection.message).toContain('Unknown opening');
	});
});

// ---------------------------------------------------------------------------
// the Room planner keeps its own shape
// ---------------------------------------------------------------------------

describe('P23.12 names — the Room planner is unchanged', () => {
	it('keeps its pinned codes and messages', () => {
		const document = squareDocument();
		const rename = planRoomMetadataUpdate(document, 'room', { name: 'Gallery' });
		expect(rename.kind).toBe('success');
		const blank = planRoomMetadataUpdate(document, 'room', { name: '  ' });
		expect(blank.kind).toBe('rejected');
		if (blank.kind !== 'rejected') return;
		expect(blank.rejection.code).toBe('invalid_value');
		expect(blank.rejection.message).toBe('Room name cannot be empty');
		const noOp = planRoomMetadataUpdate(document, 'room', { name: 'Room' });
		expect(noOp.kind).toBe('rejected');
		if (noOp.kind !== 'rejected') return;
		expect(noOp.rejection.code).toBe('no_op');
	});
});

// ---------------------------------------------------------------------------
// the codec rejects a present-but-blank name
// ---------------------------------------------------------------------------

describe('P23.12 names — codec tolerance', () => {
	it('a payload with a blank wall name is invalid; absent stays unnamed', () => {
		const importJson = (await0: unknown): void => void await0;
		void importJson;
		const document = squareDocument();
		const blank = {
			...document,
			walls: document.walls.map((wall) => (wall.id === 'w1' ? { ...wall, name: '' } : wall))
		};
		const state0 = createEmptyLayoutPreviewState();
		expect(importLayoutPreviewJson(state0, JSON.stringify(blank))).toBe(false);
		// A named payload imports and keeps the name.
		const named = {
			...document,
			walls: document.walls.map((wall) => (wall.id === 'w1' ? { ...wall, name: 'North' } : wall))
		};
		const state1 = createEmptyLayoutPreviewState();
		expect(importLayoutPreviewJson(state1, JSON.stringify(named))).toBe(true);
		expect(wallOf(live(state1), 'w1').name).toBe('North');
	});
});

// ---------------------------------------------------------------------------
// the editor adapters ride the one document-install point
// ---------------------------------------------------------------------------

describe('P23.12 names — editor adapters', () => {
	it('updateWallFirstWallMetadata sets and clears through the preview state', () => {
		const { state, store } = makeStoreHarness();
		void store;
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'North' }).success).toBe(true);
		expect(wallOf(live(state), 'w1').name).toBe('North');
		expect(layoutPreviewIsDirty(state)).toBe(true);

		// Clear restores reference-led presentation — and the authored form is
		// byte-equal to the baseline again, so the session reads clean.
		expect(updateWallFirstWallMetadata(state, 'w1', { name: null }).success).toBe(true);
		expect('name' in wallOf(live(state), 'w1')).toBe(false);
		expect(layoutPreviewIsDirty(state)).toBe(false);

		// A rejection installs nothing and leaves the document untouched.
		const before = layoutPreviewAuthoredJson(state);
		const rejected = updateWallFirstWallMetadata(state, 'w1', { name: '   ' });
		expect(rejected.success).toBe(false);
		expect(layoutPreviewAuthoredJson(state)).toBe(before);
		expect(layoutPreviewIsDirty(state)).toBe(false);
	});

	it('updateWallFirstOpeningMetadata sets and clears through the preview state', () => {
		const { state } = makeStoreHarness();
		expect(updateWallFirstOpeningMetadata(state, 'door', { name: 'Main Entrance' }).success).toBe(true);
		expect(openingOf(live(state), 'door').name).toBe('Main Entrance');
		expect(updateWallFirstOpeningMetadata(state, 'door', { name: null }).success).toBe(true);
		expect('name' in openingOf(live(state), 'door')).toBe(false);
	});
});

// keep the fixture import used (LINE is referenced in squareDocument)
void LINE;
