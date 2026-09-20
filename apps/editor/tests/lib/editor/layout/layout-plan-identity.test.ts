/**
 * P23.12 S7 — Plan and status surfaces (bounded).
 *
 * The earlier revision of this suite claimed `.plan-meta` / status lines print
 * no internal selection terminology but never asserted it: its only check was
 * `not.toContain('internal')`, while the strip rendered
 * `Selected: {interaction.selection.kind}` — so `physicalWall`, `wallOpening`
 * and `interiorAnchor` reached the user. The selected-Opening canvas label had
 * a matching gap: `reference ?? kind` silently dropped an authored Opening
 * name. Both branches are now pinned, and the label composition is tested
 * BEHAVIORALLY through the shared display-identity layer rather than by
 * matching source text.
 *
 * Still bounded, unchanged from the slice:
 * - Plan Room labels stay name-driven and gated by area/scale/suppression
 *   (`layout-drafting.test.ts` stays untouched);
 * - no permanent per-entity reference label appears on the canvas;
 * - no P23.13 surface (line weights, symbols, dimension or collision code) is
 *   touched.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	createEmptyWallFirstLayoutDocument,
	promoteLayoutIdentity,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

import { layoutSelectionLabel } from '$lib/editor/identity/layout-identity-view';
import type { LayoutSelection } from '$lib/editor/layout/layout-interaction';

const VIEWPORT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../src/lib/editor/layout/LayoutPlanViewport.svelte'
);
const PROJECTION = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../src/lib/editor/layout/plan-overlays.ts'
);

function viewportSource(): string {
	return readFileSync(VIEWPORT, 'utf8');
}

function overlaySource(): string {
	return readFileSync(PROJECTION, 'utf8');
}

const LINE = { kind: 'line' } as const;

/** One 4×3 wall-first Room with a door on `w1`, optionally named. */
function squareDocument(names: { room?: string; wall1?: string; door?: string } = {}): LayoutDocumentWallFirst {
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
			centerline: LINE,
			...(names.wall1 ? { name: names.wall1 } : {})
		},
		{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'w4', startJunctionId: 'D', endJunctionId: 'A', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
	];
	document.rooms = [
		{
			id: 'room',
			name: names.room ?? 'Room',
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
	document.openings = [
		{
			id: 'door',
			wallId: 'w1',
			kind: 'door',
			offset: 1,
			width: 0.9,
			height: 2.1,
			sillHeight: 0,
			profile: 'rectangular',
			...(names.door ? { name: names.door } : {})
		}
	];
	return document;
}

/** The same document with a minted identity ledger. */
function ledgerDocument(names: { room?: string; wall1?: string; door?: string } = {}): LayoutDocumentWallFirst {
	return promoteLayoutIdentity(squareDocument(names)).document;
}

/** Every internal `selection.kind` token this surface must never print. */
const INTERNAL_TOKENS = /physicalWall|wallOpening|interiorAnchor|interior-anchor|physical-wall/;

describe('P23.12 plan — selected-target identity', () => {
	it('names the selected Room by its authored name, never by its raw ID', () => {
		const document = ledgerDocument({ room: 'Gallery A' });
		expect(layoutSelectionLabel(document, { kind: 'room', roomId: 'room' })).toBe('Room Gallery A');
	});

	it('reads an unnamed Wall by its compact reference', () => {
		const document = ledgerDocument();
		const label = layoutSelectionLabel(document, { kind: 'physicalWall', wallId: 'w1' });
		expect(label).toMatch(/^Wall W-[0-9A-Z]+$/);
		expect(label).not.toContain('w1');
	});

	it('prefers an authored Wall name over its reference', () => {
		const document = ledgerDocument({ wall1: 'North Gallery Wall' });
		expect(layoutSelectionLabel(document, { kind: 'physicalWall', wallId: 'w1' })).toBe(
			'Wall North Gallery Wall'
		);
	});

	it('reads an Opening by authored name, else its reference', () => {
		const unnamed = layoutSelectionLabel(ledgerDocument(), {
			kind: 'wallOpening',
			wallId: 'w1',
			openingId: 'door'
		});
		expect(unnamed).toMatch(/^Opening O-[0-9A-Z]+$/);

		const named = layoutSelectionLabel(ledgerDocument({ door: 'Main Entrance' }), {
			kind: 'wallOpening',
			wallId: 'w1',
			openingId: 'door'
		});
		expect(named).toBe('Opening Main Entrance');
	});

	it('reads a Junction by its reference (Junctions are never named)', () => {
		const label = layoutSelectionLabel(ledgerDocument(), { kind: 'junction', junctionId: 'A' });
		expect(label).toMatch(/^Junction J-[0-9A-Z]+$/);
	});

	it('never prints an internal selection token for any selection kind', () => {
		const document = ledgerDocument({ room: 'Gallery A', wall1: 'Party Wall', door: 'Main Entrance' });
		const selections: LayoutSelection[] = [
			{ kind: 'room', roomId: 'room' },
			{ kind: 'wall', roomId: 'room', segmentId: 'w1' },
			{ kind: 'physicalWall', wallId: 'w1' },
			{ kind: 'junction', junctionId: 'A' },
			{ kind: 'opening', roomId: 'room', segmentId: 'w1', openingId: 'door' },
			{ kind: 'wallOpening', wallId: 'w1', openingId: 'door' },
			{ kind: 'interiorAnchor', roomId: 'room', segmentId: 'w1', anchorId: 'a1' },
			{ kind: 'object', objectId: 'obj-1' }
		];
		for (const selection of selections) {
			const label = layoutSelectionLabel(document, selection);
			expect(label, `${selection.kind} must render`).not.toBeNull();
			// The jargon tokens are the leak; plain English `object`/`room` are not.
			expect(label, `${selection.kind} label`).not.toMatch(INTERNAL_TOKENS);
		}
		// A legacy room-owned anchor has no ledger identity: it reads as the
		// human concept, not as the internal token.
		expect(layoutSelectionLabel(document, { kind: 'interiorAnchor', roomId: 'room', segmentId: 'w1', anchorId: 'a1' })).toBe(
			'Wall bend point'
		);
		expect(layoutSelectionLabel(document, { kind: 'none' })).toBeNull();
	});

	it('falls back to the raw-ID display label only when the document has no ledger', () => {
		// No ledger: the identity layer resolves nothing, so the D2 third tier
		// (the raw-ID display label) is the only identity that exists.
		const legacy = squareDocument();
		expect(layoutSelectionLabel(legacy, { kind: 'physicalWall', wallId: 'w1' })).toBe('Wall W1');
		expect(layoutSelectionLabel(legacy, { kind: 'room', roomId: 'room' })).toBe('Room Room');
	});

	it('.plan-meta renders that label, never interaction.selection.kind', () => {
		const text = viewportSource();
		expect(text).toContain('Selected: {planSelectionLabel}');
		expect(text).not.toContain('Selected: {interaction.selection.kind}');
		// The composition itself comes from the shared identity layer, so the
		// meta strip and the canvas label cannot drift apart.
		expect(text).toContain(
			'layoutSelectionLabel(preview.project.layout, interaction.selection)'
		);
		expect(text).toContain("from '../identity/layout-identity-view'");
	});

	it('the selection label is name-first and consumes the identity contract', () => {
		const text = viewportSource();
		// name → reference → kind, composed by the shared layer.
		expect(text).toContain('identityPrimaryLabel(selectedOpeningIdentity, selectedOpening.kind)');
		expect(text).toContain('{selectedOpeningLabel} · {selectedOpening.width.toFixed(2)} m × ');
		// The Plan never queries the ledger directly (D5).
		expect(text).not.toMatch(/referenceFor\(/);
	});

	it('no permanent reference label field is added to the canvas', () => {
		const text = viewportSource();
		const matches = text.match(/selection-label|room-name/g) ?? [];
		expect(matches.length).toBeGreaterThan(0);
		expect(text).not.toMatch(/wallReferenceLabel|junctionLabel|permanent.*reference/i);
	});

	it('Room labels stay name-driven in the overlay projection', () => {
		const text = overlaySource();
		expect(text).toContain('room-name');
		expect(text).not.toMatch(/referenceFor|layout-identity/);
	});

	it('no P23.13 surface is touched', () => {
		const text = viewportSource();
		// No new line-weight/symbol/dimension constants or collision code.
		expect(text).not.toMatch(/lineWeight|collisionMargin|dimensionOffset/);
	});
});

describe('P23.12 D6 — Room creation copy names the Room by identity', () => {
	const MOUNT_SURFACES = [
		'../../../../src/lib/editor/app/PlanWorkspace.svelte',
		'../../../../src/lib/editor/EditorViewport.svelte'
	];

	it('both mount surfaces compose the message from the shared identity layer', () => {
		for (const relative of MOUNT_SURFACES) {
			const path = resolve(dirname(fileURLToPath(import.meta.url)), relative);
			const text = readFileSync(path, 'utf8');
			// `Created ${result.roomId}` was the leak: the raw canonical Room ID
			// reached the user on every drafted Room.
			expect(text).not.toContain('`Created ${result.roomId}`');
			expect(text).toContain(
				'`Created ${roomIdentityText(layoutPreview.project.layout, result.roomId)}`'
			);
		}
	});
});
