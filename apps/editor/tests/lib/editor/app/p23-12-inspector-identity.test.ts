/**
 * P23.12 S6 — Inspector identity, names and Technical details.
 *
 * Driven through the shipped presentation rules:
 *
 * - one header pattern across the four canonical kinds — Room, Wall,
 *   Junction, Opening (name leads, reference secondary, kind separate);
 * - the Layout object block is unchanged (byte-level markup assertion);
 * - optional-name set/clear/reject-revert with the emptied-field → `null`
 *   mapping;
 * - the Junction block has no name input, ever;
 * - Technical details starts collapsed, is keyboard/touch reachable,
 *   preserves state across selection changes, exposes the full ID with a
 *   copy control;
 * - relationship controls show references;
 * - no Room rename menu exists; legacy Room-owned and Camera blocks untouched.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { referenceFor, type LayoutDocumentWallFirst } from '@portfolio/layout-core';

import { formatPlacementLabel } from '$lib/editor/editor-outliner';
import {
	identityPrimaryLabel,
	wallIdentity
} from '$lib/editor/identity/layout-identity-view';

import {
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	updateWallFirstOpeningMetadata,
	updateWallFirstWallMetadata,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';

const LINE = { kind: 'line' } as const;

function squareDocument(): Record<string, unknown> {
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

function makeState(): LayoutPreviewState {
	const state = createEmptyLayoutPreviewState();
	expect(importLayoutPreviewJson(state, JSON.stringify(squareDocument()))).toBe(true);
	return state;
}

describe('P23.12 inspector — one header pattern', () => {
	const INSPECTOR = resolve(
		dirname(fileURLToPath(import.meta.url)),
		'../../../../src/lib/editor/EditorInspector.svelte'
	);
	const source = (): string => readFileSync(INSPECTOR, 'utf8');

	it('all four canonical headers resolve through the identity layer', () => {
		const text = source();
		// The four wall-first headers use name ?? reference ?? id fallbacks.
		expect(text).toContain('selectedWallFirstWall.name ?? selectedWallReference');
		expect(text).toContain('selectedJunctionReference ?? `Junction ${selectedWallFirstJunction.id}`');
		expect(text).toContain('selectedWallFirstOpening.name ?? selectedOpeningReference');
		// The Room header keeps the authored name primary.
		expect(text).toContain('<strong>{selectedWallFirstRoom.name}</strong>');
		// And the reference spans render beside the names.
		expect(text).toContain('{selectedWallReference}');
		expect(text).toContain('{selectedOpeningReference}');
		expect(text).toContain('{selectedRoomReference}');
	});

	it('the Layout object block is unchanged (byte-level marker assertion)', () => {
		const text = source();
		// The block's header is still `{selectedLayoutObject.kind} object` and it
		// gains no identity-reference span — a later unification is deliberate.
		expect(text).toContain('<strong>{selectedLayoutObject.kind} object</strong>');
		const objectBlockStart = text.indexOf('<strong>{selectedLayoutObject.kind} object</strong>');
		const objectBlockEnd = text.indexOf('{:else if selectedWallFirstWall');
		expect(objectBlockStart).toBeGreaterThan(-1);
		expect(objectBlockEnd).toBeGreaterThan(objectBlockStart);
		const objectBlock = text.slice(objectBlockStart, objectBlockEnd);
		expect(objectBlock).not.toContain('identity-reference');
		expect(objectBlock).not.toContain('referenceFor');
	});

	it('the Junction block has no name input', () => {
		const text = source();
		const junctionStart = text.indexOf('aria-label="Selected wall-first junction"');
		const junctionEnd = text.indexOf('{:else if selectedWallFirstOpening');
		expect(junctionStart).toBeGreaterThan(-1);
		expect(junctionEnd).toBeGreaterThan(junctionStart);
		const junctionBlock = text.slice(junctionStart, junctionEnd);
		expect(junctionBlock).not.toMatch(/Name \(optional\)/);
		expect(junctionBlock).not.toMatch(/type="text"/);
	});

	it('Wall and Opening blocks gain the optional Name field', () => {
		const text = source();
		const wallStart = text.indexOf('aria-label="Selected wall-first wall"');
		const wallEnd = text.indexOf('{:else if selectedWallFirstJunction}');
		const wallBlock = text.slice(wallStart, wallEnd);
		expect(wallBlock).toContain('Name (optional)');
		expect(wallBlock).toContain('updateSelectedWallName');
		const openingStart = text.indexOf('aria-label="Selected wall-first opening"');
		const openingEnd = text.indexOf('{:else if selectedLayoutOpening');
		const openingBlock = text.slice(openingStart, openingEnd);
		expect(openingBlock).toContain('Name (optional)');
		expect(openingBlock).toContain('updateSelectedOpeningName');
	});

	it('Technical details starts collapsed, exposes the full ID, and has a copy control', () => {
		const text = source();
		// `<details>` without `open` attribute starts collapsed and is natively
		// keyboard/touch operable; `bind:open` preserves state across re-renders.
		expect(text).toContain('<details class="technical-details" bind:open={technicalDetailsOpen}>');
		expect(text).toContain('<summary>Technical details</summary>');
		expect(text).toContain('<span class="technical-id">{selectedWallFirstWall.id}</span>');
		expect(text).toContain('Copy ID');
		expect(text).toContain('let technicalDetailsOpen = $state(false);');
	});

	it('all four entity kinds expose the technical identity block', () => {
		const text = source();
		// The review fix: Technical details and Copy ID exist for Walls *and*
		// Junctions, Openings and Rooms — one shared disclosure state, so the
		// panel does not collapse when selection changes kind.
		expect(text.match(/<details class="technical-details" bind:open=\{technicalDetailsOpen\}>/g)).toHaveLength(4);
		expect(text).toContain('<span class="technical-id">{selectedWallFirstWall.id}</span>');
		expect(text).toContain('<span class="technical-id">{selectedWallFirstJunction.id}</span>');
		expect(text).toContain('<span class="technical-id">{selectedWallFirstOpening.id}</span>');
		expect(text).toContain('<span class="technical-id">{selectedWallFirstRoom.id}</span>');
		expect(text.match(/>Copy ID<\/button>/g)).toHaveLength(4);
	});

	it('every kind can copy its compact reference, not just its raw ID', () => {
		const text = source();
		// The reference is conditional: an entity without a resolved ledger entry
		// has nothing to copy, so the control is absent rather than broken.
		expect(text.match(/>Copy reference<\/button>/g)).toHaveLength(4);
		expect(text).toContain('{#if selectedWallReference}<button type="button" onclick={copyTechnicalReference}>Copy reference</button>{/if}');
		expect(text).toContain('{#if selectedJunctionReference}<button type="button" onclick={copyTechnicalReference}>Copy reference</button>{/if}');
		expect(text).toContain('{#if selectedOpeningReference}<button type="button" onclick={copyTechnicalReference}>Copy reference</button>{/if}');
		expect(text).toContain('{#if selectedRoomReference}<button type="button" onclick={copyTechnicalReference}>Copy reference</button>{/if}');
		expect(text).toContain(
			'if (technicalDetailsReference) void navigator.clipboard?.writeText(technicalDetailsReference);'
		);
	});

	it('relationship controls show references', () => {
		const text = source();
		expect(text).toContain('startReference ?? selectedWallFirstWallEndpoints.start.id');
		expect(text).toContain('endReference ?? selectedWallFirstWallEndpoints.end.id');
	});

	it('the legacy Room-owned and Camera blocks are untouched', () => {
		const text = source();
		expect(text).toContain('<strong>{selectedLayoutRoom.name}</strong>');
		expect(text).toContain('<strong>{store.selectedCluster.name}</strong>');
		expect(text).toContain('<strong>{selectedLayoutOpening.kind} opening</strong>');
	});
});

describe('P23.12 inspector — user copy carries identity, never a canonical ID', () => {
	const INSPECTOR = resolve(
		dirname(fileURLToPath(import.meta.url)),
		'../../../../src/lib/editor/EditorInspector.svelte'
	);
	const source = (): string => readFileSync(INSPECTOR, 'utf8');

	it('wall and room status copy resolves through the identity helpers', () => {
		const text = source();
		expect(text).toContain(
			"`Wall ${wallIdentityText(layoutDocument, wall.id)} ${role === 'boundary' ? 'defines' : 'no longer defines'} a room boundary`"
		);
		expect(text).toContain('`Added a bend point to Wall ${wallIdentityText(layoutDocument, wall.id)}`');
		expect(text).toContain('`Wall ${wallIdentityText(layoutDocument, wall.id)} has no bend points left`');
		expect(text).toContain('`Updated Room ${roomIdentityText(layoutDocument, room.id)} ${metric}`');
		// The raw-ID forms are gone: the composers are the only route into copy.
		expect(text).not.toContain('`Wall ${wall.id}');
		expect(text).not.toContain('`Updated Room ${room.id}');
	});

	it('the tier order is not re-implemented here: the shared composers are the authority', () => {
		const text = source();
		// D5 — no surface-local copy helper. If this file defined its own
		// `wallIdentityText`/`roomIdentityText` the fallback tier could drift from
		// the Navigator's and the Plan's.
		expect(text).not.toMatch(/function (wall|junction|room|opening)IdentityText/);
		expect(text).toContain('\twallIdentityText\n} from \'./identity/layout-identity-view\'');
	});

	it('Align option labels state the display label, not the raw content ID', () => {
		const text = source();
		// The picked `id` stays the raw key the planner consumes; only the option
		// text is presentation (D6 — `{kind} · {raw id}` was the leak).
		expect(text).toContain('label: `${object.kind} · ${formatPlacementLabel(object.id)}`');
		expect(text).toContain('label: `Room bounds · ${formatPlacementLabel(selectedLayoutObject.roomId)}`');
		expect(text).toContain('label: `Wall · ${formatPlacementLabel(segment.id)}`');
	});

	it('bend-point copy uses the chain ordinal, never the canonical knot ID', () => {
		const text = source();
		// `Bend point ${knotId}` printed `w1:knot:2` — the knot ID embeds the raw
		// Wall ID, so it is chain data, not copy.
		expect(text).not.toContain('${knotId}');
		expect(text).not.toContain('{anchor.id} X (m)');
		expect(text).toContain('{bendPointLabel(anchor.id)} X (m)');
		expect(text).toContain('`Moved ${bendPointLabel(knotId).toLowerCase()}`');
		expect(text).toContain('`Removed ${bendPointLabel(knotId).toLowerCase()}`');
	});

	it('a geometry warning names its target by identity and keeps the raw ID out of copy', () => {
		const text = source();
		expect(text).toContain('{issue.targetId ? diagnosticTargetIdentityText(issue.targetId) : issue.path}');
		// The raw ID survives as the diagnostic tooltip (D6: diagnosis belongs in
		// Technical details / title attributes, never in the sentence).
		expect(text).toContain('title={issue.targetId ?? undefined}');
	});

	it('the copy tier prints the ledger reference or the name, and never the bare ID', () => {
		const state = makeState();
		const layout = layoutPreviewDocument(state) as unknown as LayoutDocumentWallFirst;
		// Tier 2: the ledger's compact reference, not `w1`.
		const reference = identityPrimaryLabel(wallIdentity(layout, 'w1'), 'w1');
		expect(reference).toMatch(/^W-/);
		expect(reference).not.toBe('w1');
		// Tier 1: an authored name leads.
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'North' }).success).toBe(true);
		const named = layoutPreviewDocument(state) as unknown as LayoutDocumentWallFirst;
		expect(identityPrimaryLabel(wallIdentity(named, 'w1'), 'w1')).toBe('North');
		// Tier 3: with no ledger entry the raw-ID *display* label is used, not the
		// bare canonical ID — which is the fallback the shared composers pass.
		expect(identityPrimaryLabel(wallIdentity(named, 'unledgered'), formatPlacementLabel('unledgered'))).toBe(
			'Unledgered'
		);
	});
});

describe('P23.12 inspector — optional-name semantics behind the fields', () => {
	it('an emptied field maps to null and the reference survives the clear', () => {
		const state = makeState();
		expect(updateWallFirstWallMetadata(state, 'w1', { name: 'North' }).success).toBe(true);
		const document = layoutPreviewDocument(state) as never as { walls: { id: string; name?: string }[] };
		expect(document.walls.find((wall) => wall.id === 'w1')?.name).toBe('North');
		// Clear (what an emptied field produces): the name is removed, and the
		// compact reference remains available for reference-led presentation.
		expect(updateWallFirstWallMetadata(state, 'w1', { name: null }).success).toBe(true);
		const document2 = layoutPreviewDocument(state) as never as { walls: { id: string; name?: string }[] };
		expect(document2.walls.find((wall) => wall.id === 'w1')?.name).toBeUndefined();
	});

	it('a rejection reverts: the field value comes from the document, which never changed', () => {
		const state = makeState();
		// An invalid patch is rejected by the planner; the adapter installs
		// nothing. The Inspector re-reads `wall.name` (undefined) on the next
		// render, which is the revert.
		const rejected = updateWallFirstWallMetadata(state, 'w1', { name: '   ' });
		expect(rejected.success).toBe(false);
		const document = layoutPreviewDocument(state) as never as { walls: { id: string; name?: string }[] };
		expect(document.walls.find((wall) => wall.id === 'w1')?.name).toBeUndefined();
	});

	it('the Opening name never shadows the reference in the ledger', () => {
		const state = makeState();
		expect(updateWallFirstOpeningMetadata(state, 'door', { name: 'Main Entrance' }).success).toBe(true);
		const document = layoutPreviewDocument(state) as never as Parameters<typeof referenceFor>[0];
		// Same-name-as-reference and duplicate names are legal; the reference
		// stays distinct either way.
		const reference = referenceFor(document, 'openings', 'door');
		expect(reference).toMatch(/^O-/);
		expect(reference).not.toBe('Main Entrance');
	});
});
