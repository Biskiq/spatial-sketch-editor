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

import {
	createEmptyWallFirstLayoutDocument,
	referenceFor,
	deriveChainSpans,
	wallCubicChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

import { formatPlacementLabel } from '$lib/editor/editor-outliner';
import {
	identityPrimaryLabel,
	wallIdentity
} from '$lib/editor/identity/layout-identity-view';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';

import {
	createEmptyLayoutPreviewState,
	deleteWallFirstWallCurveKnot,
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
		// The four wall-first headers use name ?? reference ?? raw-ID *display
		// label* fallbacks — never a bare canonical ID.
		expect(text).toContain(
			'selectedWallFirstWall.name ?? selectedWallReference ?? `Wall ${formatPlacementLabel(selectedWallFirstWall.id)}`'
		);
		expect(text).toContain(
			'selectedJunctionReference ?? `Junction ${formatPlacementLabel(selectedWallFirstJunction.id)}`'
		);
		expect(text).toContain(
			'selectedWallFirstOpening.name ?? selectedOpeningReference ?? formatPlacementLabel(selectedWallFirstOpening.id)'
		);
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
		// The endpoint controls name the Junction by identity (reference, else
		// the display label) — not by its canonical ID.
		expect(text).toContain('junctionIdentityText(layoutDocument, selectedWallFirstWallEndpoints.start.id)');
		expect(text).toContain('junctionIdentityText(layoutDocument, selectedWallFirstWallEndpoints.end.id)');
		// The Wall header names the same endpoints, and its former raw-ID branch is
		// gone: `start.id → end.id` was the leak the copy guard caught.
		expect(text).not.toContain(
			'{selectedWallFirstWallEndpoints.start.id} → {selectedWallFirstWallEndpoints.end.id}'
		);
		expect(text).toContain('{junctionIdentityText(layoutDocument, selectedWallFirstWallEndpoints.start.id)} → {junctionIdentityText(layoutDocument, selectedWallFirstWallEndpoints.end.id)}');
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
		expect(text).toContain('`Moved ${bendPointLabelAt(knotIndex).toLowerCase()}`');
		expect(text).toContain('bendPointLabelAt(knotIndex)');
	});

	it('reads the bend-point ordinal and count BEFORE the delete mutates the chain', () => {
		const text = source();
		const start = text.indexOf('function deleteSelectedWallCurveKnot(');
		expect(start).toBeGreaterThan(-1);
		const handler = text.slice(start, text.indexOf('function deleteSelectedWallFirstWall'));

		const indexCapture = handler.indexOf(
			'const knotIndex = selectedWallFirstWallKnots.findIndex((knot) => knot.id === knotId);'
		);
		const countCapture = handler.indexOf(
			'const knotsBefore = selectedWallFirstWallKnots.length;'
		);
		const mutation = handler.indexOf('runLayoutMutationGuarded(');
		expect(indexCapture).toBeGreaterThan(-1);
		expect(countCapture).toBeGreaterThan(indexCapture);
		expect(mutation).toBeGreaterThan(countCapture);

		// The message answers from the captured chain: the removed knot is gone
		// afterwards, so a post-mutation ordinal lookup finds nothing and a
		// post-mutation count is one lower — a Wall with two bend points would
		// announce that it has none left after one removal.
		expect(handler).toContain('knotsBefore <= 1');
		expect(handler).not.toContain('selectedWallFirstWallKnots.length <= 1');
		expect(handler).not.toMatch(/bendPointLabel\(knotId\)/);
	});

	it('a Knot-move message also reads the ordinal from before the mutation', () => {
		const text = source();
		const start = text.indexOf('function updateSelectedWallCurveKnot(');
		const handler = text.slice(start, text.indexOf('function deleteSelectedWallCurveKnot('));
		const capture = handler.indexOf('const knotIndex = selectedWallFirstWallKnots.indexOf(knot);');
		const mutation = handler.indexOf('runLayoutMutationGuarded(');
		expect(capture).toBeGreaterThan(-1);
		expect(mutation).toBeGreaterThan(capture);
		expect(handler).toContain('bendPointLabelAt(knotIndex)');
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

	/**
	 * The canonical (wall-first) selection blocks: Wall → Junction → Opening, and
	 * the wall-first Room. The legacy room-owned Opening/Wall/Room blocks sit
	 * between them and are out of scope (their content IDs are a documented
	 * residual), so the slice stops at the first legacy branch each time.
	 */
	function canonicalInspectorCopy(text: string): string {
		const wallFirstStart = text.indexOf('aria-label="Selected wall-first wall"');
		const legacyStart = text.indexOf('{:else if selectedLayoutOpening && selectedLayoutSegment');
		const wallFirstRoomStart = text.indexOf('aria-label="Selected wall-first room"');
		const legacyRoomStart = text.indexOf('{:else if selectedLayoutRoom && selectedLayoutBounds}');
		expect(wallFirstStart).toBeGreaterThan(-1);
		expect(legacyStart).toBeGreaterThan(wallFirstStart);
		expect(wallFirstRoomStart).toBeGreaterThan(legacyStart);
		expect(legacyRoomStart).toBeGreaterThan(wallFirstRoomStart);
		const canonical =
			text.slice(wallFirstStart, legacyStart) + text.slice(wallFirstRoomStart, legacyRoomStart);
		// Copy, not machinery: the Technical details spans, the event handlers and
		// the canonical-ID VALUES an operation consumes are not user-visible text.
		return canonical
			.replace(/<span class="technical-id">[^<]*<\/span>/g, '')
			.replace(/(?:onclick|onchange|bind:[a-z]+)=\{[^}]*\}/g, '')
			.replace(/value=\{[^}]*\}/g, '')
			.replace(/\{#each [^}]*\}/g, '');
	}

	it('no wall-first Inspector block prints a raw canonical ID in copy', () => {
		// Every interpolation that *ends* in a canonical-ID field is a raw ID
		// printed as text: `{hostedOpening.id}`, `{selectedWallFirstOpening.wallId}`,
		// `{selectedWallFirstRoom.id}`, … A call that merely takes one as an
		// argument (`bendPointLabel(anchor.id)`) does not match, and the canonical
		// ID each operation needs is still in `value=`/handlers, which are not copy.
		expect(canonicalInspectorCopy(source())).not.toMatch(
			/\{[^{}]*\.(id|wallId|junctionId|roomId|openingId|segmentId)\}/
		);
	});

	it('the wall-first relational controls name entities by identity', () => {
		const text = source();
		// Hosted openings on the selected Wall.
		expect(text).toContain(
			'{hostedOpening.kind} · {openingIdentityText(layoutDocument, hostedOpening.id)}'
		);
		// The selected Opening's host Wall.
		expect(text).toContain('Wall: {wallIdentityText(layoutDocument, selectedWallFirstOpening.wallId)}');
		// The Room's boundary membership.
		expect(text).toContain('<span>Boundary walls: {selectedWallFirstRoomBoundaryLabel}</span>');
		// The exact-dimension selects: the option VALUE stays the canonical ID the
		// planner consumes, the option TEXT is identity.
		expect(text).toContain('<option value={id}>{junctionIdentityText(layoutDocument, id)}</option>');
		expect(text).toContain('<option value={wallId}>{wallIdentityText(layoutDocument, wallId)}</option>');
		// The Room header no longer repeats the raw ID beside name + reference (the
		// Technical details block still exposes it).
		expect(text).not.toContain('<span>{selectedWallFirstRoom.id}</span>');
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

// ---------------------------------------------------------------------------
// Bend-point removal — the message reports on the chain the user acted on
// ---------------------------------------------------------------------------

const LINE_SEGMENT = { kind: 'line' } as const;

/** A wall-first 4×3 Room whose `w1` carries a TWO-knot cubic chain. */
function twoKnotDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'A', point: [0, 0] },
		{ id: 'B', point: [4, 0] },
		{ id: 'C', point: [4, 3] },
		{ id: 'D', point: [0, 3] }
	];
	document.walls = [
		{
			id: 'w1',
			startJunctionId: 'A',
			endJunctionId: 'B',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: wallCubicChain(
				[
					{ id: 'w1:knot:1', point: [1, 1] },
					{ id: 'w1:knot:2', point: [3, -1] }
				],
				deriveChainSpans([
					[0, 0],
					[1, 1],
					[3, -1],
					[4, 0]
				])
			)
		},
		{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE_SEGMENT },
		{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE_SEGMENT },
		{ id: 'w4', startJunctionId: 'D', endJunctionId: 'A', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE_SEGMENT }
	];
	document.rooms = [
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
	];
	document.openings = [];
	return document;
}

function curvedWallKnots(state: LayoutPreviewState) {
	const document = layoutPreviewDocument(state) as unknown as LayoutDocumentWallFirst;
	const centerline = document.walls.find((wall) => wall.id === 'w1')!.centerline;
	if (centerline.kind !== 'cubic-chain') throw new Error('fixture Wall is not curved');
	return centerline.knots;
}

describe('P23.12 inspector — bend-point removal reports on the acted chain', () => {
	it('removing one of two bend points leaves one, so only the pre-mutation chain answers', () => {
		const state = createEmptyLayoutPreviewState();
		expect(importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(twoKnotDocument()))).toBe(true);

		const before = curvedWallKnots(state);
		expect(before).toHaveLength(2);
		const removed = before[0]!;
		expect(deleteWallFirstWallCurveKnot(state, 'w1', removed.id).success).toBe(true);

		const after = curvedWallKnots(state);
		// ONE bend point remains. A post-mutation `length <= 1` test would have
		// announced "has no bend points left" for a Wall that still has one, and a
		// post-mutation `bendPointLabel(knotId)` would have found no ordinal at all
		// — which is why the handler reads both facts before the mutation.
		expect(after).toHaveLength(1);
		expect(after.some((knot) => knot.id === removed.id)).toBe(false);
	});
});
