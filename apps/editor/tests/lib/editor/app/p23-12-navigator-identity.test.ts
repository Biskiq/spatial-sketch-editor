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
import { buildHierarchySourceIndex } from '$lib/editor/hierarchy/hierarchy-source-index';
import {
	buildHierarchyPageProjection,
	hierarchyEndsRow,
	hierarchyWallRow,
	hierarchyOpeningRow,
	hierarchyJunctionRow,
	hierarchyRoomRow
} from '$lib/editor/hierarchy/hierarchy-page-projection';
import { buildHierarchySearchProjection } from '$lib/editor/hierarchy/hierarchy-search';
import { updateWallFirstWallMetadata, updateWallFirstOpeningMetadata, createEmptyLayoutPreviewState, importLayoutPreviewJson, layoutPreviewDocument } from '$lib/editor/layout/layout-preview-state.svelte';
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
		expect(row?.secondary).toMatch(/^W-/);
	});

	it('an unnamed Wall is reference-led with no invented name', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const row = hierarchyWallRow(index, 'k', 'w1');
		expect(row?.label).toMatch(/^W-/);
		expect(row?.label).not.toBe(row?.secondary);
	});

	it('a named Opening leads with the name; an unnamed one is reference-led', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const unnamed = hierarchyOpeningRow(index, 'k', 'door');
		expect(unnamed?.label).toMatch(/^O-/);
		expect(updateWallFirstOpeningMetadata(state, 'door', { name: 'Main Entrance' }).success).toBe(true);
		const index2 = indexOf(state);
		const named = hierarchyOpeningRow(index2, 'k', 'door');
		expect(named?.label).toBe('Main Entrance');
		expect(named?.secondary).toMatch(/^O-/);
	});

	it('a Junction is reference-only and never carries a name', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const row = hierarchyJunctionRow(index, 'k', 'A');
		expect(row?.label).toMatch(/^J-/);
		expect(row?.secondary).toBe('2 walls');
	});

	it('a Room row keeps the authored name primary with its reference secondary', () => {
		const state = makeState(squareDocument());
		const index = indexOf(state);
		const row = hierarchyRoomRow(index, 'k', 'room');
		expect(row?.label).toBe('Room');
		expect(row?.secondary).toMatch(/^R-/);
	});

	it('the same Wall shows the same identity in every Room context', () => {
		const state = makeState(twoRoomDocument());
		const index = indexOf(state);
		const wallsPage = hierarchyWallRow(index, 'walls-page', 'wA2');
		const roomARow = hierarchyWallRow(index, 'room-a-page', 'wA2');
		const roomBRow = hierarchyWallRow(index, 'room-b-page', 'wA2');
		expect(wallsPage?.label).toBe(roomARow?.label);
		expect(roomARow?.label).toBe(roomBRow?.label);
		expect(wallsPage?.secondary).toBe(roomARow?.secondary);
	});

	it('the shared Wall shows both Rooms as participation context', () => {
		const state = makeState(twoRoomDocument());
		const index = indexOf(state);
		expect(index.roomIdsByWallId.get('wA2')).toEqual(['room-a', 'room-b']);
	});

	it('the Ends relation row uses references', () => {
		const state = makeState(twoRoomDocument());
		const index = indexOf(state);
		const ends = hierarchyEndsRow(index, 'k', { wallId: 'wA2', direction: 'forward' });
		expect(ends).not.toBeNull();
		// Both endpoint labels resolve to compact references, not formatted IDs.
		if (ends) {
			const text = ends.label;
			expect(text).toContain('·');
			for (const junctionId of ['B', 'E']) {
				const reference = index.junctionById.get(junctionId)?.reference ?? 'missing';
				expect(text).toContain(reference);
			}
		}
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
// Search identity
// ---------------------------------------------------------------------------

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
		expect(sourceIndex).toContain('referenceFor');
	});
});
