/**
 * P23.12 S1 — compact reference identity primitives.
 *
 * A reference is **presentation identity only**: six characters, family-prefixed
 * (`R`/`W`/`O`/`J`), document-unique and never reassigned. These tests pin the
 * properties the whole slice rests on:
 *
 * - the mapping is an exact bijection over the allocation space (so the persisted
 *   cursor can be validated against every live token in O(1) per token);
 * - allocation is monotone with respect to a **latched base**, which is what stops
 *   `create A → undo → create B` from handing A's retired reference to B;
 * - a provisional resolution is copy-on-write and deterministic, so a cancelled
 *   gesture consumes nothing;
 * - the authored fingerprint excludes the cursor (bookkeeping) but keeps the
 *   ledger and the names (authored).
 */
import { describe, expect, it } from 'vitest';

import {
	LAYOUT_IDENTITY_CURSOR_BEHIND_REFERENCE,
	LAYOUT_IDENTITY_EXHAUSTED_CODE,
	LAYOUT_REFERENCE_ALPHABET,
	LAYOUT_REFERENCE_INVERSE_MULTIPLIER,
	LAYOUT_REFERENCE_MULTIPLIER,
	LAYOUT_REFERENCE_OFFSET,
	LAYOUT_REFERENCE_SPACE,
	LayoutIdentityExhaustedError,
	createEmptyWallFirstLayoutDocument,
	emptyLayoutIdentityLedger,
	formatLayoutReference,
	indexOfReference,
	isLayoutReference,
	layoutAuthoredCanonicalJson,
	layoutIdentityCursor,
	layoutIdentityCursorIssues,
	layoutIdentityIsComplete,
	parseLayoutReference,
	promoteLayoutIdentity,
	referenceFor,
	repairLayoutIdentityCursor,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	withLayoutIdentity,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

function documentWithRooms(count: number): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.rooms = Array.from({ length: count }, (_, index) => ({
		id: `room-${index + 1}`,
		name: `Room ${index + 1}`,
		boundary: [{ wallId: `wall-${index + 1}`, direction: 'forward' as const }],
		floorThickness: 0.1,
		ceilingThickness: 0.1
	}));
	return document;
}

/** A structurally valid document with `count` enclosed Rooms (one Wall each). */
function validDocumentWithRooms(count: number): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	const rooms = [];
	for (let index = 0; index < count; index += 1) {
		const start = `junction-${index * 2 + 1}`;
		const end = `junction-${index * 2 + 2}`;
		const wallId = `wall-${index + 1}`;
		document.junctions.push(
			{ id: start, point: [index * 5, 0] },
			{ id: end, point: [index * 5 + 4, 0] }
		);
		document.walls.push({
			id: wallId,
			startJunctionId: start,
			endJunctionId: end,
			role: 'boundary',
			thickness: 0.16,
			height: 2.6,
			centerline: { kind: 'line' }
		});
		rooms.push({
			id: `room-${index + 1}`,
			name: `Room ${index + 1}`,
			boundary: [{ wallId, direction: 'forward' as const }],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		});
	}
	document.rooms = rooms;
	return document;
}

describe('P23.12 reference format', () => {
	it('is six characters, family-prefixed, from the unambiguous alphabet', () => {
		for (const family of ['rooms', 'junctions', 'walls', 'openings'] as const) {
			const token = formatLayoutReference(family, 0);
			expect(token).toHaveLength(6);
			expect(isLayoutReference(token)).toBe(true);
			expect(layoutAuthoredCanonicalJson(documentWithRooms(0))).toContain('"units"');
		}
		expect(formatLayoutReference('rooms', 0)).toBe('R-2QUS');
		expect(LAYOUT_REFERENCE_ALPHABET).not.toMatch(/[0O1IL]/);
	});

	it('maps distinct indices to distinct tokens (bijection over the space)', () => {
		expect(LAYOUT_REFERENCE_MULTIPLIER).toBe(1000003 % LAYOUT_REFERENCE_SPACE);
		expect(LAYOUT_REFERENCE_MULTIPLIER).toBe(76482);
		expect(LAYOUT_REFERENCE_INVERSE_MULTIPLIER).toBe(298772);
		expect((LAYOUT_REFERENCE_MULTIPLIER * LAYOUT_REFERENCE_INVERSE_MULTIPLIER) % LAYOUT_REFERENCE_SPACE).toBe(1);

		// Sweep a large prefix of the space: no index collides with an earlier one
		// (the closed-form inverse above is the whole-space proof).
		const seen = new Set<string>();
		for (let index = 0; index < 200000; index += 1) {
			seen.add(formatLayoutReference('walls', index));
		}
		expect(seen.size).toBe(200000);
		// The last index is formattable, so the space is not silently truncated.
		expect(isLayoutReference(formatLayoutReference('walls', LAYOUT_REFERENCE_SPACE - 1))).toBe(true);
		expect(() => formatLayoutReference('walls', LAYOUT_REFERENCE_SPACE)).toThrow(RangeError);
	}, 30000);

	it('inverts exactly, including the first 200 000 allocations', () => {
		let roundTripFailures = 0;
		for (let index = 0; index < 200000; index += 1) {
			if (indexOfReference(formatLayoutReference('openings', index)) !== index) {
				roundTripFailures += 1;
			}
		}
		expect(roundTripFailures).toBe(0);
		expect(parseLayoutReference(formatLayoutReference('junctions', 7))).toEqual({
			family: 'junctions',
			index: 7
		});
		expect(indexOfReference('X-2QUS')).toBeUndefined();
		expect(indexOfReference('W-0000')).toBeUndefined();
		expect(indexOfReference('W-2QUS')).toBe(0);
		expect(indexOfReference('not-a-reference')).toBeUndefined();
	});

	it('does not leak a visible ordinal: successive allocations differ in every character', () => {
		let minimumDiffering = 4;
		for (let index = 0; index < 20000; index += 1) {
			const current = formatLayoutReference('walls', index);
			const next = formatLayoutReference('walls', index + 1);
			let differing = 0;
			for (let character = 2; character < 6; character += 1) {
				if (current[character] !== next[character]) differing += 1;
			}
			minimumDiffering = Math.min(minimumDiffering, differing);
		}
		expect(minimumDiffering).toBe(4);
		expect(formatLayoutReference('walls', 0)).toBe('W-2QUS');
		expect(formatLayoutReference('walls', 1)).toBe('W-5AEX');
	});
});

describe('P23.12 allocation and ledger', () => {
	it('mints in the documented fixed order and is idempotent', () => {
		const document = createEmptyWallFirstLayoutDocument();
		document.junctions = [
			{ id: 'junction-1', point: [0, 0] },
			{ id: 'junction-2', point: [4, 0] }
		];
		document.walls = [
			{
				id: 'wall-1',
				startJunctionId: 'junction-1',
				endJunctionId: 'junction-2',
				role: 'boundary',
				thickness: 0.16,
				height: 2.6,
				centerline: { kind: 'line' }
			}
		];
		document.rooms = documentWithRooms(1).rooms;
		document.openings = [
			{
				id: 'opening-1',
				wallId: 'wall-1',
				kind: 'door',
				offset: 1,
				width: 0.9,
				height: 2.1,
				sillHeight: 0,
				profile: 'rectangular'
			}
		];

		const minted = withLayoutIdentity(document);
		expect(layoutIdentityIsComplete(minted)).toBe(true);
		expect(referenceFor(minted, 'rooms', 'room-1')).toBe(formatLayoutReference('rooms', 0));
		expect(referenceFor(minted, 'junctions', 'junction-1')).toBe(formatLayoutReference('junctions', 1));
		expect(referenceFor(minted, 'junctions', 'junction-2')).toBe(formatLayoutReference('junctions', 2));
		expect(referenceFor(minted, 'walls', 'wall-1')).toBe(formatLayoutReference('walls', 3));
		expect(referenceFor(minted, 'openings', 'opening-1')).toBe(formatLayoutReference('openings', 4));
		expect(layoutIdentityCursor(minted)).toBe(5);

		// Copy-on-write: a second resolution changes nothing and returns the input.
		expect(withLayoutIdentity(minted)).toBe(minted);
	});

	it('prunes retired ids and never hands their reference to a different entity', () => {
		const document = withLayoutIdentity(documentWithRooms(2));
		const first = referenceFor(document, 'rooms', 'room-1')!;
		const retired = { ...document, rooms: document.rooms.slice(1) };
		const pruned = withLayoutIdentity(retired);
		expect(referenceFor(pruned, 'rooms', 'room-1')).toBeUndefined();
		// A recycled canonical ID is a *new* entity and must get a fresh reference.
		const recycled: LayoutDocumentWallFirst = {
			...pruned,
			rooms: [
				...pruned.rooms,
				{
					id: 'room-1',
					name: 'Room 3',
					boundary: [{ wallId: 'wall-9', direction: 'forward' }],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			]
		};
		const reminted = withLayoutIdentity(recycled);
		expect(referenceFor(reminted, 'rooms', 'room-1')).not.toBe(first);
	});

	it('latches a base so an undo branch cannot inherit a retired reference', () => {
		const document = documentWithRooms(1);
		// Operation 1: create A (room-1) — indices 0..0, cursor 1, mark 1.
		const afterA = promoteLayoutIdentity(document);
		expect(afterA.cursor).toBe(1);
		const mark = afterA.cursor;

		// Undo: the document rewinds, the session mark does not.
		const rewound = document;
		expect(layoutIdentityCursor(rewound)).toBe(0);

		// Operation 2 with the latched base `max(document cursor, mark)`:
		// create B (a different Room, reusing the recycled canonical ID).
		const base = Math.max(layoutIdentityCursor(rewound), mark);
		const withB: LayoutDocumentWallFirst = {
			...rewound,
			rooms: [
				{
					id: 'room-1',
					name: 'B',
					boundary: [{ wallId: 'wall-1', direction: 'forward' }],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			]
		};
		const afterB = promoteLayoutIdentity(withB, { base });
		const referenceA = referenceFor(afterA.document, 'rooms', 'room-1');
		const referenceB = referenceFor(afterB.document, 'rooms', 'room-1');
		expect(referenceB).not.toBe(referenceA);
		expect(indexOfReference(referenceB!)!).toBeGreaterThan(indexOfReference(referenceA!)!);
		// Promotion never lowers the mark, even when it mints nothing.
		expect(afterB.cursor).toBeGreaterThanOrEqual(mark);
		const noMint = promoteLayoutIdentity(afterB.document, { base: mark });
		expect(noMint.cursor).toBeGreaterThanOrEqual(mark);
	});

	it('keeps the cursor at least at the mark when nothing needs allocating', () => {
		const promoted = promoteLayoutIdentity(documentWithRooms(1));
		const renameOnly = promoteLayoutIdentity(promoted.document, { base: 42 });
		expect(renameOnly.cursor).toBe(42);
		expect(layoutIdentityCursor(renameOnly.document)).toBe(42);
		expect(referenceFor(renameOnly.document, 'rooms', 'room-1')).toBe(
			referenceFor(promoted.document, 'rooms', 'room-1')
		);
	});

	it('isolates a provisional candidate from its base document', () => {
		const baseline = withLayoutIdentity(documentWithRooms(1));
		const base = layoutIdentityCursor(baseline);
		const candidate = documentWithRooms(2);
		const resolved = withLayoutIdentity(candidate, { base });
		// The base document is untouched: a cancelled gesture consumes nothing.
		expect(layoutIdentityCursor(baseline)).toBe(base);
		expect(Object.keys(baseline.identity!.rooms)).toEqual(['room-1']);
		// A repeated resolution of the same candidate is deterministic.
		expect(withLayoutIdentity(candidate, { base })).toEqual(resolved);
	});

	it('fails closed with a named code when the space is exhausted', () => {
		const document: LayoutDocumentWallFirst = {
			...documentWithRooms(1),
			identity: { ...emptyLayoutIdentityLedger(), cursor: LAYOUT_REFERENCE_SPACE }
		};
		try {
			withLayoutIdentity(document);
			throw new Error('expected exhaustion');
		} catch (error) {
			expect(error).toBeInstanceOf(LayoutIdentityExhaustedError);
			expect((error as LayoutIdentityExhaustedError).code).toBe(LAYOUT_IDENTITY_EXHAUSTED_CODE);
		}
	});
});

describe('P23.12 cursor consistency', () => {
	it('flags a cursor that sits at or below a live token and repairs it upward', () => {
		const minted = withLayoutIdentity(documentWithRooms(3));
		expect(layoutIdentityCursorIssues(minted)).toEqual([]);

		const stale: LayoutDocumentWallFirst = {
			...minted,
			identity: { ...minted.identity!, cursor: 1 }
		};
		const issues = layoutIdentityCursorIssues(stale);
		expect(issues.length).toBeGreaterThan(0);
		expect(issues.every((issue) => issue.code === LAYOUT_IDENTITY_CURSOR_BEHIND_REFERENCE)).toBe(true);

		const repaired = repairLayoutIdentityCursor(stale);
		expect(layoutIdentityCursorIssues(repaired)).toEqual([]);
		expect(layoutIdentityCursor(repaired)).toBe(3);
		// Idempotent, and never lowers a cursor.
		expect(repairLayoutIdentityCursor(repaired)).toBe(repaired);
		const overshot = repairLayoutIdentityCursor({
			...minted,
			identity: { ...minted.identity!, cursor: 99 }
		});
		expect(layoutIdentityCursor(overshot)).toBe(99);
	});

	it('flags malformed tokens and cross-family tokens', () => {
		const minted = withLayoutIdentity(documentWithRooms(1));
		const malformed: LayoutDocumentWallFirst = {
			...minted,
			identity: {
				...minted.identity!,
				rooms: { 'room-1': 'W-2QUS' }
			}
		};
		expect(layoutIdentityCursorIssues(malformed).length).toBeGreaterThan(0);
	});
});

describe('P23.12 authored fingerprint', () => {
	it('ignores the cursor but not the ledger, the names or the geometry', () => {
		const minted = withLayoutIdentity(documentWithRooms(2));
		const cursorMoved: LayoutDocumentWallFirst = {
			...minted,
			identity: { ...minted.identity!, cursor: 77 }
		};
		expect(layoutAuthoredCanonicalJson(cursorMoved)).toBe(layoutAuthoredCanonicalJson(minted));

		const ledgerChanged: LayoutDocumentWallFirst = {
			...minted,
			identity: {
				...minted.identity!,
				rooms: { ...minted.identity!.rooms, 'room-1': 'R-9999' }
			}
		};
		expect(layoutAuthoredCanonicalJson(ledgerChanged)).not.toBe(layoutAuthoredCanonicalJson(minted));

		const renamed = withLayoutIdentity({
			...documentWithRooms(1),
			rooms: [{ ...documentWithRooms(1).rooms[0]!, name: 'Kitchen' }]
		});
		const other = withLayoutIdentity(documentWithRooms(1));
		expect(layoutAuthoredCanonicalJson(renamed)).not.toBe(layoutAuthoredCanonicalJson(other));
	});

	it('is byte-identical to the codec canonical form minus the cursor line', () => {
		const minted = withLayoutIdentity(validDocumentWithRooms(3));
		const canonical = serializeWallFirstLayoutDocument(minted);
		expect(canonical).toContain(`"cursor": ${layoutIdentityCursor(minted)},`);
		// The cursor is the only difference between the two canonical forms, and it is
		// bookkeeping: dropping its line must reproduce the authored fingerprint exactly.
		expect(layoutAuthoredCanonicalJson(minted)).toBe(canonical.replace(/^\s*"cursor": \d+,\n/m, ''));
	});
});

describe('P23.12 codec round trip', () => {
	it('keeps the ledger and the names through validation and serialization (C1)', () => {
		const document = withLayoutIdentity({
			...documentWithRooms(1),
			junctions: [
				{ id: 'junction-1', point: [0, 0] },
				{ id: 'junction-2', point: [4, 0] }
			],
			walls: [
				{
					id: 'wall-1',
					startJunctionId: 'junction-1',
					endJunctionId: 'junction-2',
					role: 'boundary',
					thickness: 0.16,
					height: 2.6,
					centerline: { kind: 'line' },
					name: 'North wall'
				}
			],
			openings: [
				{
					id: 'opening-1',
					wallId: 'wall-1',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					name: 'Front door'
				}
			]
		});

		const result = validateWallFirstLayoutDocument(document);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.document.identity).toEqual(document.identity);
		expect(result.document.walls[0]!.name).toBe('North wall');
		expect(result.document.openings[0]!.name).toBe('Front door');
		expect(serializeWallFirstLayoutDocument(result.document)).toBe(result.canonicalJson);
	});

	it('accepts a legacy document without a ledger or names', () => {
		const legacy = createEmptyWallFirstLayoutDocument();
		delete legacy.identity;
		const result = validateWallFirstLayoutDocument(legacy);
		expect(result.success).toBe(true);
		if (result.success) expect(result.document.identity).toBeUndefined();
	});

	it('rejects a blank name, a malformed token and a duplicate token', () => {
		const document = withLayoutIdentity(documentWithRooms(2));
		const blankName: LayoutDocumentWallFirst = {
			...document,
			rooms: [{ ...document.rooms[0]!, name: '   ' }, document.rooms[1]!]
		};
		expect(validateWallFirstLayoutDocument(blankName).success).toBe(false);

		const malformed: LayoutDocumentWallFirst = {
			...document,
			identity: { ...document.identity!, rooms: { 'room-1': 'R-0000' } }
		};
		const malformedResult = validateWallFirstLayoutDocument(malformed);
		expect(malformedResult.success).toBe(false);
		if (!malformedResult.success) {
			expect(malformedResult.issues[0]!.code).toBe('invalid_value');
		}

		const duplicate: LayoutDocumentWallFirst = {
			...document,
			identity: {
				...document.identity!,
				rooms: { ...document.identity!.rooms, 'room-2': document.identity!.rooms['room-1']! }
			}
		};
		const duplicateResult = validateWallFirstLayoutDocument(duplicate);
		expect(duplicateResult.success).toBe(false);
		if (!duplicateResult.success) {
			expect(duplicateResult.issues.some((issue) => issue.code === 'duplicate_reference')).toBe(true);
		}
	});

	it('still rejects unknown keys inside the ledger', () => {
		const document = withLayoutIdentity(documentWithRooms(1));
		const result = validateWallFirstLayoutDocument({
			...document,
			identity: { ...document.identity!, extra: {} }
		});
		expect(result.success).toBe(false);
	});
});
