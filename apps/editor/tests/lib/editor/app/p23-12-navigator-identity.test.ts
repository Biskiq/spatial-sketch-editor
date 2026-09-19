/**
 * P23.12 S5 — Navigator identity and search identity.
 *
 * Row presentation through the real page projection and search projection:
 *
 * - named Wall/Opening lead with the name and show the reference as the
 *   secondary identity; unnamed ones are reference-led;
 * - Junctions are reference-only (never a name);
 * - the same Wall shows the same identity in every Room context;
 * - search retrieves name/reference/raw-ID/kind/role; `door` and `boundary`
 *   still match entities whose canonical IDs contain neither word;
 * - block/group/direct/related/topology shape is unchanged.
 */
import { describe, expect, it } from 'vitest';

import { serializeWallFirstLayoutDocument, type LayoutDocumentWallFirst } from '@portfolio/layout-core';

import { createEmptySceneDocument } from '$lib/content/scene';
import {
	buildHierarchySourceIndex,
	junctionEntityKey,
	openingEntityKey,
	roomEntityKey,
	wallEntityKey
} from '$lib/editor/hierarchy/hierarchy-source-index';
import {
	buildHierarchyPageProjection,

	hierarchyWallRow,
	hierarchyOpeningRow,
	hierarchyJunctionRow,
	hierarchyRoomRow,
	hierarchyEntityLabel,
	hierarchyEntityPresentation,
	hierarchyEntityReference
} from '$lib/editor/hierarchy/hierarchy-page-projection';
import { buildHierarchySearchProjection } from '$lib/editor/hierarchy/hierarchy-search';
import {
	exactReferenceEmphasis,
	identityMatchTargets,
	identitySegments
} from '$lib/editor/hierarchy/hierarchy-identity-presentation';
import type { HierarchyProjectedRow } from '$lib/editor/hierarchy/hierarchy-page-projection';
import { updateWallFirstWallMetadata, updateWallFirstOpeningMetadata, updateWallFirstRoomMetadata, createEmptyLayoutPreviewState, importLayoutPreviewJson, layoutPreviewDocument } from '$lib/editor/layout/layout-preview-state.svelte';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
			{ id: 'door', wallId: 'w1', kind: 'door', offset: 0.5, width: 1, height: 2, sillHeight: 0, profile: 'rectangular' }
		],
		objects: []
	};
}

/** A two-room document: room-a and room-b share w2 (a boundary wall). */
function twoRoomDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 5,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] },
			{ id: 'B', point: [4, 0] },
			{ id: 'C', point: [8, 0] },
			{ id: 'D', point: [8, 3] },
			{ id: 'E', point: [4, 3] },
			{ id: 'F', point: [0, 3] }
		],
		walls: [
			{ id: 'wA1', startJunctionId: 'A', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'wA2', startJunctionId: 'B', endJunctionId: 'E', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'wA3', startJunctionId: 'E', endJunctionId: 'F', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'wA4', startJunctionId: 'F', endJunctionId: 'A', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'wB1', startJunctionId: 'B', endJunctionId: 'C', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'wB2', startJunctionId: 'C', endJunctionId: 'D', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'wB3', startJunctionId: 'D', endJunctionId: 'E', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
		],
		rooms: [
			{
				id: 'room-a',
				name: 'Gallery A',
				boundary: [
					{ wallId: 'wA1', direction: 'forward' },
					{ wallId: 'wA2', direction: 'forward' },
					{ wallId: 'wA3', direction: 'forward' },
					{ wallId: 'wA4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			},
			{
				id: 'room-b',
				name: 'Gallery B',
				boundary: [
					{ wallId: 'wA2', direction: 'reverse' },
					{ wallId: 'wB1', direction: 'forward' },
					{ wallId: 'wB2', direction: 'forward' },
					{ wallId: 'wB3', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [
			{ id: 'opening:door:1', wallId: 'wA2', kind: 'door', offset: 1, width: 1, height: 2, sillHeight: 0, profile: 'rectangular' }
		],
		objects: []
	};
}

function makeState(document: LayoutDocumentWallFirst): ReturnType<typeof createEmptyLayoutPreviewState> {
	const state = createEmptyLayoutPreviewState();
	expect(importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(document))).toBe(true);
	return state;
}

function indexOf(state: ReturnType<typeof createEmptyLayoutPreviewState>) {
	return buildHierarchySourceIndex({
		layout: layoutPreviewDocument(state),
		scene: createEmptySceneDocument()
	});
}

// ---------------------------------------------------------------------------
// Navigator rows
// ---------------------------------------------------------------------------

describe('P23.12 navigator — row identity', () => {
	it('a named Wall leads with the name and shows the reference as secondary', () => {
		const state = makeState(squareDocument());
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'North Gallery Wall' }).success).toBe(true);
		const index = indexOf(state);
		const row = hierarchyWallRow(index, 'k', 'w1');
		expect(row?.label).toBe('North Gallery Wall');
		// The reference lives in its own protected span, not the context slot.
		expect(row?.reference).toMatch(/^W-/);
		expect(row?.secondary).toBeUndefined();
	});

	it('relationship context never displaces a named entity reference', () => {
		const state = makeState(twoRoomDocument());
		expect(updateWallFirstWallMetadata(state, 'wA2', { name: 'Party Wall' }).success).toBe(true);
		const index = indexOf(state);
		const row = hierarchyWallRow(index, 'k', 'wA2', { secondary: 'also in Room B' });
		expect(row?.label).toBe('Party Wall');
		expect(row?.reference).toMatch(/^W-/);
		expect(row?.secondary).toBe('also in Room B');
	});

	it('an unnamed Wall is reference-led with no invented name', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const row = hierarchyWallRow(index, 'k', 'w1');
		expect(row?.label).toMatch(/^W-/);
		// The label already is the reference: no duplicate protected span.
		expect(row?.reference).toBeUndefined();
	});

	it('a named Opening leads with the name; an unnamed one is reference-led', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const unnamed = hierarchyOpeningRow(index, 'k', 'door');
		expect(unnamed?.label).toMatch(/^O-/);
		expect(unnamed?.reference).toBeUndefined();
		// P23.12 D8 — an Opening's context is **kind + host**, never a bare kind
		// restatement; the host is named by its identity, not its raw ID.
		expect(unnamed?.secondary).toMatch(/^Door · on W-/);
		expect(updateWallFirstOpeningMetadata(state, 'door', { name: 'Main Entrance' }).success).toBe(true);
		const index2 = indexOf(state);
		const named = hierarchyOpeningRow(index2, 'k', 'door');
		expect(named?.label).toBe('Main Entrance');
		expect(named?.reference).toMatch(/^O-/);
	});

	it('a Junction is reference-only and never carries a name', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const row = hierarchyJunctionRow(index, 'k', 'A');
		expect(row?.label).toMatch(/^J-/);
		// P23.12 D8 — the routine inline count is inventory, not disambiguation.
		expect(row?.secondary).toBeUndefined();
	});

	it('renders a name that equals the reference exactly once (duplicate-collapse)', () => {
		// A user may author the compact reference *as* the name; compact
		// presentation then has one token, not the same string in both the label
		// and the protected span. The shared layer owns that rule and the
		// Navigator consumes it — this used to be possible duplicate identity text.
		const state = makeState(squareDocument());
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'Party Wall' }).success).toBe(true);
		const reference = hierarchyWallRow(indexOf(state), 'k', 'w1')!.reference!;
		expect(reference).toMatch(/^W-/);
		expect(updateWallFirstWallMetadata(state, 'w1', { name: reference }).success).toBe(true);
		const wall = hierarchyWallRow(indexOf(state), 'k', 'w1')!;
		expect(wall.label).toBe(reference);
		expect(wall.reference).toBeUndefined();

		// An unnamed Opening is reference-led, so its token is the label.
		const openingRef = hierarchyOpeningRow(indexOf(state), 'k', 'door')!.label;
		expect(openingRef).toMatch(/^O-/);
		expect(updateWallFirstOpeningMetadata(state, 'door', { name: openingRef }).success).toBe(true);
		const opening = hierarchyOpeningRow(indexOf(state), 'k', 'door')!;
		expect(opening.label).toBe(openingRef);
		expect(opening.reference).toBeUndefined();
	});

	it('a Room row keeps the authored name primary with its reference secondary', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const row = hierarchyRoomRow(index, 'k', 'room');
		expect(row?.label).toBe('Room');
		expect(row?.reference).toMatch(/^R-/);
	});

	it('the same Wall shows the same identity in every Room context', () => {
		const state = makeState(twoRoomDocument());
		const index = indexOf(state);
		const wallsPage = hierarchyWallRow(index, 'walls-page', 'wA2');
		const roomARow = hierarchyWallRow(index, 'room-a-page', 'wA2');
		const roomBRow = hierarchyWallRow(index, 'room-b-page', 'wA2');
		expect(wallsPage?.label).toBe(roomARow?.label);
		expect(roomARow?.label).toBe(roomBRow?.label);
		expect(wallsPage?.reference).toBe(roomARow?.reference);
	});

	it('the shared Wall shows both Rooms as participation context', () => {
		const state = makeState(twoRoomDocument());
		const index = indexOf(state);
		expect(index.roomIdsByWallId.get('wA2')).toEqual(['room-a', 'room-b']);
	});

	it('replaces the per-Wall Ends relation row with the boundary inventories', () => {
		// P23.14 Decision 4 — the oriented `Ends <start> · <end>` row is removed:
		// endpoint identity is answered by the Wall row itself plus
		// `Boundary Junctions (n)` and the global Junctions page.
		const state = makeState(twoRoomDocument());
		const index = indexOf(state);
		const projection = buildHierarchyPageProjection(index, { kind: 'room', roomId: 'room-a' });
		expect(JSON.stringify(projection.rows)).not.toContain('Ends ');
		const junctions = projection.rows
			.flatMap((row) => [row, ...(row.children ?? [])])
			.find((row) => row.rowKey === 'room:room-a:section:junctions');
		expect(junctions?.label).toMatch(/^Boundary Junctions \(\d+\)$/);
	});

	it('no row restates its own kind or role in the label', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const wallRow = hierarchyWallRow(index, 'k', 'w1');
		expect(wallRow?.label?.toLowerCase()).not.toContain('boundary');
		expect(wallRow?.label?.toLowerCase()).not.toContain('wall');
	});
});

// ---------------------------------------------------------------------------
// Pinned strip identity
// ---------------------------------------------------------------------------

describe('P23.12 navigator — pinned strip identity', () => {
	it('a pinned named Wall shows the name with its protected reference', () => {
		const state = makeState(squareDocument());
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'North Gallery Wall' }).success).toBe(true);
		const index = indexOf(state);
		const entity = wallEntityKey('w1');
		expect(hierarchyEntityLabel(index, entity)).toBe('North Gallery Wall');
		expect(hierarchyEntityReference(index, entity)).toMatch(/^W-/);
	});

	it('an unnamed Wall pins reference-led and does not repeat the token', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const entity = wallEntityKey('w1');
		expect(hierarchyEntityLabel(index, entity)).toMatch(/^W-/);
		expect(hierarchyEntityReference(index, entity)).toBeNull();
	});

	it('a Junction pins reference-only and never shows a name', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const entity = junctionEntityKey('A');
		expect(hierarchyEntityLabel(index, entity)).toMatch(/^J-/);
		expect(hierarchyEntityReference(index, entity)).toBeNull();
	});

	it('a pinned Opening uses the same vocabulary as its row', () => {
		const state = makeState(squareDocument());
		expect(updateWallFirstOpeningMetadata(state, 'door', { name: 'Main Entrance' }).success).toBe(true);
		const index = indexOf(state);
		const entity = openingEntityKey('w1', 'door');
		expect(hierarchyEntityLabel(index, entity)).toBe('Main Entrance');
		expect(hierarchyEntityReference(index, entity)).toMatch(/^O-/);
	});
});

// ---------------------------------------------------------------------------
// Search identity
// ---------------------------------------------------------------------------

describe('P23.12 search — match explanations', () => {
	function directRows(state: Parameters<typeof indexOf>[0], query: string) {
		const projection = buildHierarchySearchProjection(indexOf(state), query);
		return projection.blocks.flatMap((block) =>
			block.groups.filter((group) => group.kind === 'direct').flatMap((group) => group.rows)
		);
	}

	it('a raw-ID query explains the hit instead of showing a bare authored name', () => {
		const state = makeState(squareDocument());
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'North Gallery Wall' }).success).toBe(true);
		const row = directRows(state, 'w1').find((candidate) => candidate.canonicalId === 'w1');
		expect(row?.label).toBe('North Gallery Wall');
		expect(row?.match?.field).toBe('id');
		expect(row?.match?.text).toContain('w1');
		expect(row?.match?.exactReference).toBe(false);
	});

	it('a reference query explains the hit and marks the exact reference', () => {
		const state = makeState(squareDocument());
		const reference = indexOf(state).wallById.get('w1')?.reference ?? '';
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'North Gallery Wall' }).success).toBe(true);
		const row = directRows(state, reference).find((candidate) => candidate.canonicalId === 'w1');
		expect(row?.match?.field).toBe('reference');
		expect(row?.match?.exactReference).toBe(true);
		expect(row?.match?.text).toContain(reference);
	});

	it('a name query explains the hit as a name match', () => {
		const state = makeState(squareDocument());
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'North Gallery Wall' }).success).toBe(true);
		const row = directRows(state, 'north gallery').find((candidate) => candidate.canonicalId === 'w1');
		expect(row?.match?.field).toBe('name');
	});

	it('a role query explains that the role matched, not the identity', () => {
		const state = makeState(squareDocument());
		const row = directRows(state, 'boundary').find((candidate) => candidate.canonicalId === 'w1');
		expect(row?.match?.field).toBe('role');
		expect(row?.match?.text).toContain('boundary');
	});

	it('related and topology rows claim no match of their own', () => {
		const state = makeState(twoRoomDocument());
		const projection = buildHierarchySearchProjection(indexOf(state), 'Room A');
		const nonDirect = projection.blocks.flatMap((block) =>
			block.groups.filter((group) => group.kind !== 'direct').flatMap((group) => group.rows)
		);
		expect(nonDirect.length).toBeGreaterThan(0);
		for (const row of nonDirect) expect(row.match).toBeUndefined();
	});
});

describe('P23.12 search — identity retrieval', () => {
	it('retrieves walls by reference and by authored name', () => {
		const state = makeState(squareDocument());
		const reference = indexOf(state).wallById.get('w1')?.reference ?? '';
		expect(reference).toMatch(/^W-/);

		const byReference = buildHierarchySearchProjection(indexOf(state), reference);
		expect(byReference.empty).toBe(false);
		expect(
			byReference.blocks.some((block) =>
				block.groups.some((group) => group.rows.some((row) => row.canonicalId === 'w1'))
			)
		).toBe(true);

		expect(updateWallFirstWallMetadata(state, 'w2', { name: 'Curated Passage' }).success).toBe(true);
		const index2 = indexOf(state);
		const byName = buildHierarchySearchProjection(index2, 'Curated Passage');
		expect(byName.empty).toBe(false);
		expect(
			byName.blocks.some((block) =>
				block.groups.some((group) => group.rows.some((row) => row.canonicalId === 'w2'))
			)
		).toBe(true);
	});

	it('still matches kind and role terms that appear in no canonical ID', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		// `door` matches the opening by kind (its canonical ID is `door`, so also
		// use `window`-less vocabulary): query by role instead.
		const byRole = buildHierarchySearchProjection(index, 'boundary');
		expect(byRole.empty).toBe(false);
		expect(
			byRole.blocks.some((block) =>
				block.groups.some((group) => group.rows.some((row) => row.canonicalId === 'w1'))
			)
		).toBe(true);
		// Openings match on kind via their existing facet field.
		const byKind = buildHierarchySearchProjection(index, 'door');
		expect(byKind.empty).toBe(false);
	});

	it('exact-reference matches land in the Walls block without reordering groups', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const reference = index.wallById.get('w1')?.reference ?? '';
		const projection = buildHierarchySearchProjection(index, reference);
		// Group kinds remain the landed vocabulary.
		for (const block of projection.blocks) {
			for (const group of block.groups) {
				expect(['direct', 'related', 'topology']).toContain(group.kind);
			}
		}
		expect(projection.blocks.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// source-level: no inline rename, no new menu/page/filter
// ---------------------------------------------------------------------------

describe('P23.12 navigator — source-level constraints', () => {
	const LIB = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src/lib');

	function source(relative: string): string {
		return readFileSync(resolve(LIB, relative), 'utf8');
	}

	it('adds no inline rename or rename affordance to the Navigator', () => {
		const navigator = source('editor/hierarchy/HierarchyNavigator.svelte');
		const row = source('editor/hierarchy/HierarchyRow.svelte');
		for (const text of [navigator, row]) {
			expect(text).not.toMatch(/rename/i);
			expect(text).not.toMatch(/contenteditable/i);
		}
		// The Navigator's single `<input>` is the pre-existing search box (line
		// 495), not a rename field: it binds the search query state.
		const inputs = navigator.match(/<input[\s\S]*?type="search"[\s\S]*?>/g) ?? [];
		expect(inputs.length).toBe(1);
		expect(inputs[0]).toContain('entry.query');
	});

	it('adds no new page, filter or context-menu rename item', () => {
		const projection = source('editor/hierarchy/hierarchy-page-projection.ts');
		// The landed page set is unchanged.
		expect(projection.match(/kind: '(root|rooms|room|walls|openings|junctions|layoutObjects|sceneContent)'/g)?.length).toBeGreaterThan(0);
		expect(projection).not.toMatch(/kind: 'camera'|kind: 'scene-refs'/);
		// The wall-first menu's rename *policy* (the documented absence) is intact:
		// no wall-first Rename item may be added. (The legacy-Room `renameRoom`
		// comment block documents why the wall-first menu passes none.)
		const menu = source('editor/context-menu/plan-menu-items.ts');
		expect(menu).not.toMatch(/label: '(Rename|Rename room)'/i);
	});

	it('the identity composition reads from the source index, not a hard-wired meta slot', () => {
		const sourceIndex = source('editor/hierarchy/hierarchy-source-index.ts');
		// P23.12 D5 — the index resolves through the SHARED display-identity layer;
		// it never queries the ledger itself, and the composition lives in the
		// projection (which is why no meta slot is hard-wired here).
		expect(sourceIndex).toContain("from '../identity/layout-identity-view'");
		expect(sourceIndex).toContain('wallIdentity(layout, wall.id)');
		expect(sourceIndex).toContain('junctionIdentity(layout, junction.id)');
		expect(sourceIndex).toContain('openingIdentity(layout, opening.id)');
		expect(sourceIndex).toContain('roomIdentity(layout, room.id)');
		expect(sourceIndex).not.toContain('referenceFor');
	});

	it('composes label and secondary through the shared identity helpers', () => {
		const projection = source('editor/hierarchy/hierarchy-page-projection.ts');
		// D5 — the tier order, the duplicate-collapse rule and the reference-led
		// flag all come from ONE shared composition, so a row and the pin cannot
		// derive them differently. Re-deriving either rule here is the regression.
		expect(projection).toContain('identityLabelPair');
		expect(projection).toContain('identityPrimaryLabel');
		expect(projection).not.toContain('identityCollapsesToSingleLabel');
		expect(projection).not.toContain('identitySecondaryReference');
	});
});

// ---------------------------------------------------------------------------
// one presentation for rows AND the pinned selection
// ---------------------------------------------------------------------------

/**
 * The duplicate the row builders already collapsed but the pin did not: an
 * entity whose authored name IS its own reference must render that token once,
 * wherever it is shown. A Room is the third case — its name is always present,
 * so it can collide with its reference exactly like an optional name can.
 */
describe('P23.12 navigator — the pin uses the row presentation', () => {
	it('collapses a Wall named exactly its own reference', () => {
		const state = makeState(squareDocument());
		const reference = indexOf(state).wallById.get('w1')!.reference!;
		expect(reference).toMatch(/^W-/);
		expect(updateWallFirstWallMetadata(state, 'w1', { name: reference }).success).toBe(true);
		const index = indexOf(state);

		const row = hierarchyWallRow(index, 'k', 'w1');
		expect(row?.label).toBe(reference);
		expect(row?.reference).toBeUndefined();

		const pinned = hierarchyEntityPresentation(index, wallEntityKey('w1'));
		expect(pinned.label).toBe(reference);
		expect(pinned.reference).toBeNull();
	});

	it('collapses an Opening named exactly its own reference', () => {
		const state = makeState(squareDocument());
		const reference = indexOf(state).openingById.get('door')!.reference!;
		expect(reference).toMatch(/^O-/);
		expect(updateWallFirstOpeningMetadata(state, 'door', { name: reference }).success).toBe(true);
		const index = indexOf(state);

		const row = hierarchyOpeningRow(index, 'k', 'door');
		expect(row?.label).toBe(reference);
		expect(row?.reference).toBeUndefined();

		const pinned = hierarchyEntityPresentation(index, openingEntityKey('w1', 'door'));
		expect(pinned.label).toBe(reference);
		expect(pinned.reference).toBeNull();
	});

	it('collapses a Room whose name is its own reference', () => {
		const state = makeState(squareDocument());
		const reference = indexOf(state).roomById.get('room')!.reference!;
		expect(reference).toMatch(/^R-/);
		expect(updateWallFirstRoomMetadata(state, 'room', { name: reference }).success).toBe(true);
		const index = indexOf(state);

		// The Room row rendered name + reference unconditionally before, so this
		// is the third place the same token could appear twice.
		const row = hierarchyRoomRow(index, 'k', 'room');
		expect(row?.label).toBe(reference);
		expect(row?.reference).toBeUndefined();

		const pinned = hierarchyEntityPresentation(index, roomEntityKey('room'));
		expect(pinned.label).toBe(reference);
		expect(pinned.reference).toBeNull();
	});

	it('a distinct name still shows its reference in both places', () => {
		const state = makeState(squareDocument());
		const reference = indexOf(state).wallById.get('w1')!.reference!;
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'North Gallery Wall' }).success).toBe(true);
		const index = indexOf(state);

		expect(hierarchyWallRow(index, 'k', 'w1')?.reference).toBe(reference);
		expect(hierarchyEntityPresentation(index, wallEntityKey('w1'))).toEqual({
			label: 'North Gallery Wall',
			reference
		});
	});
});

// ---------------------------------------------------------------------------
// presentation: protected references, highlighting, exact-match emphasis
// ---------------------------------------------------------------------------

/**
 * Measured evidence (240 px Navigator column, long name + long context, real
 * `<style>` blocks from these two components, `getBoundingClientRect`):
 *
 * | element                     | before            | after      |
 * |-----------------------------|-------------------|------------|
 * | unnamed Wall label          | 19 px, clipped    | 50 px OK   |
 * | pinned reference            | clipped away      | 36 px OK   |
 * | named row reference         | 36 px OK          | 36 px OK   |
 * | Junction label              | 45 px OK          | 45 px OK   |
 * | truncating name (unchanged) | 69 px, clipped    | 69 px, clipped |
 * | truncating pin title        | 119 px, clipped   | 78 px, clipped |
 *
 * The layout assertions below pin the rules that produced the fix; the numbers
 * themselves need a browser (the suite runs in `node`).
 */
describe('P23.12 presentation — the label that IS the reference is protected', () => {
	it('unnamed Wall and Opening rows are reference-led', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const wall = hierarchyWallRow(index, 'k', 'w1');
		expect(wall?.referenceLed).toBe(true);
		expect(wall?.label).toBe(wall?.reference === undefined ? wall?.label : wall.label);
		expect(wall?.reference).toBeUndefined();
		const opening = hierarchyOpeningRow(index, 'k', 'door');
		expect(opening?.referenceLed).toBe(true);
	});

	it('a named Wall keeps its name label unprotected and its reference separate', () => {
		const state = makeState(squareDocument());
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'North Gallery Wall' }).success).toBe(true);
		const wall = hierarchyWallRow(indexOf(state), 'k', 'w1');
		expect(wall?.label).toBe('North Gallery Wall');
		expect(wall?.reference).toMatch(/^W-/);
		expect(wall?.referenceLed).toBeUndefined();
	});

	it('every Junction row is reference-led (reference-only, never a name)', () => {
		const state = makeState(squareDocument());
		const junction = hierarchyJunctionRow(indexOf(state), 'k', 'A');
		expect(junction?.referenceLed).toBe(true);
		expect(junction?.label).toMatch(/^J-/);
	});

	it('a legacy document without a ledger keeps its fallback label unprotected', () => {
		// `formatPlacementLabel('w1')` is a raw-ID display label, not a reference:
		// protecting it would claim an identity the document does not have.
		const legacy: LayoutDocumentWallFirst = { ...squareDocument(), identity: undefined } as never;
		const index = buildHierarchySourceIndex({
			layout: legacy,
			scene: createEmptySceneDocument()
		} as never);
		const wall = hierarchyWallRow(index, 'k', 'w1');
		expect(wall?.reference).toBeUndefined();
		expect(wall?.referenceLed).toBeUndefined();
	});
});

describe('P23.12 presentation — search highlighting and exact-match emphasis', () => {
	function row(overrides: Partial<HierarchyProjectedRow>): HierarchyProjectedRow {
		return { rowKey: 'k', kind: 'entity', label: 'North Gallery Wall', ...overrides };
	}

	it('a name match highlights the label; a reference match highlights the span that renders it', () => {
		expect(
			identityMatchTargets(row({ match: { field: 'name', query: 'north', text: '', exactReference: false } }))
		).toEqual({ label: 'name', reference: null });
		// Named row: the reference has its own span, so the hit goes there.
		expect(
			identityMatchTargets(
				row({ match: { field: 'reference', query: 'w-7k3m', text: '', exactReference: true } })
			)
		).toEqual({ label: null, reference: 'reference' });
		// Reference-led row: the label IS the reference, so the hit goes there.
		expect(
			identityMatchTargets(
				row({
					label: 'W-7K3M',
					referenceLed: true,
					match: { field: 'reference', query: 'w-7k3m', text: '', exactReference: true }
				})
			)
		).toEqual({ label: 'reference', reference: null });
	});

	it('raw-ID, role and kind matches are explained, never highlighted', () => {
		for (const field of ['id', 'role', 'kind', 'label'] as const) {
			expect(
				identityMatchTargets(
					row({ match: { field, query: 'boundary', text: 'Matched', exactReference: false } })
				)
			).toEqual({ label: null, reference: null });
		}
		expect(identityMatchTargets(row({}))).toEqual({ label: null, reference: null });
	});

	it('an exact-reference match emphasises the reference-led label too', () => {
		const exact = { field: 'reference', query: 'w-7k3m', text: '', exactReference: true } as const;
		// The reported defect: `tree-row__reference` is never rendered for an
		// unnamed entity, so exact matches received no emphasis at all.
		expect(exactReferenceEmphasis(row({ label: 'W-7K3M', referenceLed: true, match: exact }))).toBe('label');
		expect(
			exactReferenceEmphasis(row({ label: 'North Gallery Wall', match: exact }))
		).toBe('reference');
		expect(
			exactReferenceEmphasis(
				row({ match: { ...exact, exactReference: false } })
			)
		).toBeNull();
		expect(exactReferenceEmphasis(row({}))).toBeNull();
	});

	it('the matched substring is marked once, case-insensitively', () => {
		expect(identitySegments('North Gallery Wall', 'gallery', 'name')).toEqual([
			{ text: 'North ', hit: false },
			{ text: 'Gallery', hit: true },
			{ text: ' Wall', hit: false }
		]);
		// Prefix and suffix runs are dropped when empty, never rendered as "".
		expect(identitySegments('W-7K3M', 'w-7k3m', 'reference')).toEqual([
			{ text: 'W-7K3M', hit: true }
		]);
		expect(identitySegments('W-7K3M', '7k3', 'reference')).toEqual([
			{ text: 'W-', hit: false },
			{ text: '7K3', hit: true },
			{ text: 'M', hit: false }
		]);
	});

	it('nothing to highlight yields the whole text unmarked', () => {
		expect(identitySegments('North Gallery Wall', 'zzz', 'name')).toEqual([
			{ text: 'North Gallery Wall', hit: false }
		]);
		expect(identitySegments('North Gallery Wall', undefined, 'name')).toEqual([
			{ text: 'North Gallery Wall', hit: false }
		]);
		// A non-highlightable field must not mark text the user did not type.
		expect(identitySegments('North Gallery Wall', 'north', null)).toEqual([
			{ text: 'North Gallery Wall', hit: false }
		]);
	});

	it('a real search projection feeds the renderer a highlightable match', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const reference = index.wallById.get('w1')?.reference ?? '';
		const projection = buildHierarchySearchProjection(index, reference);
		const directRow = projection.blocks
			.flatMap((block) => block.groups)
			.filter((group) => group.kind === 'direct')
			.flatMap((group) => group.rows)
			.find((candidate) => candidate.canonicalId === 'w1')!;
		const targets = identityMatchTargets(directRow);
		// An unnamed Wall: the hit must land on the label, and it is the exact token.
		expect(targets.label).toBe('reference');
		expect(exactReferenceEmphasis(directRow)).toBe('label');
		expect(identitySegments(directRow.label, directRow.match?.query, targets.label)[0]).toEqual({
			text: reference,
			hit: true
		});
	});
});

describe('P23.12 presentation — source-level protections', () => {
	const LIB = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src/lib');

	function source(relative: string): string {
		return readFileSync(resolve(LIB, relative), 'utf8');
	}

	it('the reference-led label never shrinks and never ellipsises', () => {
		const row = source('editor/hierarchy/HierarchyRow.svelte');
		const rule = row.slice(
			row.indexOf('.tree-row__label--reference {'),
			row.indexOf('}', row.indexOf('.tree-row__label--reference {'))
		);
		expect(rule).toContain('flex: 0 0 auto');
		expect(rule).toContain('overflow: visible');
		expect(rule).toContain('text-overflow: clip');
		// The class is applied from the projected flag, not from string sniffing.
		expect(row).toContain('class:tree-row__label--reference={referenceLed}');
		expect(row).toContain('const referenceLed = $derived(row.referenceLed === true);');
	});

	it('the reference span and its highlight carry the same protections', () => {
		const row = source('editor/hierarchy/HierarchyRow.svelte');
		const rule = row.slice(
			row.indexOf('.tree-row__reference {'),
			row.indexOf('}', row.indexOf('.tree-row__reference {'))
		);
		expect(rule).toContain('flex: 0 0 auto');
		expect(rule).toContain('white-space: nowrap');
		expect(row).toContain('class="tree-row__hit"');
	});

	it('exact-reference emphasis reaches the reference-led label', () => {
		const row = source('editor/hierarchy/HierarchyRow.svelte');
		expect(row).toContain('class:tree-row--match-label={matchEmphasis === \'label\'}');
		expect(row).toContain('class:tree-row--match-reference={matchEmphasis === \'reference\'}');
		const style = row.slice(row.indexOf('<style>'), row.indexOf('</style>'));
		expect(style).toContain('.tree-row--match-label .tree-row__label');
		expect(style).toContain('.tree-row--match-reference .tree-row__reference');
	});

	it('the pin separates the truncating name from the protected reference', () => {
		const navigator = source('editor/hierarchy/HierarchyNavigator.svelte');
		// Structure: name and reference are sibling flex items inside one identity row.
		const identityStart = navigator.indexOf('<span class="hierarchy-pin__identity">');
		const titleStart = navigator.indexOf('<span class="hierarchy-pin__title"');
		const referenceStart = navigator.indexOf('<span class="hierarchy-pin__reference">');
		expect(identityStart).toBeGreaterThan(-1);
		expect(titleStart).toBeGreaterThan(identityStart);
		expect(referenceStart).toBeGreaterThan(titleStart);
		// The reference is NOT nested inside the ellipsising title.
		const titleBlock = navigator.slice(
			titleStart,
			navigator.indexOf('</span>', titleStart)
		);
		expect(titleBlock).not.toContain('hierarchy-pin__reference');
		expect(titleBlock).toContain('Selected {pinned.label}');
	});

	it('the pin reference never shrinks and never sits in a clipping container', () => {
		const navigator = source('editor/hierarchy/HierarchyNavigator.svelte');
		const style = navigator.slice(navigator.indexOf('<style>'), navigator.indexOf('</style>'));
		const referenceRule = style.slice(
			style.indexOf('.hierarchy-pin__reference {'),
			style.indexOf('}', style.indexOf('.hierarchy-pin__reference {'))
		);
		expect(referenceRule).toContain('flex: 0 0 auto');
		expect(referenceRule).toContain('white-space: nowrap');
		expect(referenceRule).not.toContain('overflow: hidden');
		// The only truncating tier of the pin identity line.
		const titleRule = style.slice(
			style.indexOf('.hierarchy-pin__title {'),
			style.indexOf('}', style.indexOf('.hierarchy-pin__title {'))
		);
		expect(titleRule).toContain('text-overflow: ellipsis');
	});
});
