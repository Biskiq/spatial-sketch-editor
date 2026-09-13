/**
 * P23.6H + P23.6I — Vertical Wall Semantics (core domain + compiler +
 * compatibility). P23.6I supersedes P23.6H's Floor cap, Floor-derived birth and
 * Floor-derived Room/Floor envelope, so the assertions that pinned those are
 * **replaced here** rather than deleted.
 *
 * `LayoutWall.height` is the authoritative physical Wall height:
 *
 * ```text
 * bottomY = floor.elevation
 * topY    = floor.elevation + wall.height
 * wall.height > 0        // finite, strictly positive, NO upper bound
 * ```
 *
 * This suite pins what the slice exists for:
 * 1. the **creation rule** — a new Wall takes the named
 *    `WALL_AUTHORING_DEFAULT_HEIGHT` or a deterministic topological seed, never a
 *    Floor-derived value and never an unnamed literal;
 * 2. **pre-baseline policy** — the wall-first `4` generation that reached `main`
 *    before this branch is **not** migrated: it fails as an unsupported version
 *    rather than being reinterpreted as `5` (P23.6I, `docs/north-star.md` →
 *    Development-stage schema compatibility);
 * 3. **one compiler path** — compiled Wall vertical bounds/sections follow
 *    `wall.height`, and a Room's ceiling is the derived flat plane at
 *    `floor.elevation + max(boundary Wall heights)`;
 * 4. **one edit operation** — `planExactWallHeight` accepts any positive finite
 *    value, rejects an Opening-invalidating lowering (never clamps) and leaves
 *    Wall/Junction/Opening/Room identity and topology untouched.
 */
import { describe, expect, it } from 'vitest';

import * as layoutCore from '@portfolio/layout-core';
import {
	compileWallFirstLayoutGeometry,
	decodeLayoutValueCompatible,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	migrateLegacyLayoutDocument,
	planDuplicateIsolatedRoom,
	planExactWallHeight,
	planWallChain,
	planWallSegment,
	planWallSubdivision,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	validateWallFirstWallHeights,
	wallFirstCanonicalFormatVersionIssue,
	WALL_AUTHORING_DEFAULT_HEIGHT,
	type LayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

/** Deterministic noding allocator (test-local; mirrors the editor's shape). */
const testAllocator = {
	nextWallId(base: LayoutDocumentWallFirst, seed: string): string {
		const taken = new Set(base.walls.map((wall) => wall.id));
		if (!taken.has(seed)) return seed;
		let index = 2;
		while (taken.has(`${seed}.${index}`)) index += 1;
		return `${seed}.${index}`;
	},
	nextJunctionId(base: LayoutDocumentWallFirst, seed: string): string {
		const taken = new Set(base.junctions.map((junction) => junction.id));
		if (!taken.has(seed)) return seed;
		let index = 2;
		while (taken.has(`${seed}:${index}`)) index += 1;
		return `${seed}:${index}`;
	}
};

/**
 * One closed rectangular Room (4×3 m) with four boundary Walls, in the current
 * canonical format (P23.6I: the Floor carries no `height`). Wall/junction ids are
 * stable so tests can address them.
 */
function rectangleDocument(options: {
	elevation?: number;
	wallHeight?: number;
	/** Per-Wall override, in document Wall order (w1…w4). */
	wallHeights?: [number, number, number, number];
} = {}): LayoutDocumentWallFirst {
	const wallHeight = options.wallHeight ?? WALL_AUTHORING_DEFAULT_HEIGHT;
	const corners: Array<[string, number, number]> = [
		['j1', 0, 0],
		['j2', 4, 0],
		['j3', 4, 3],
		['j4', 0, 3]
	];
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: options.elevation ?? 0 },
		junctions: corners.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: [
			['w1', 'j1', 'j2'],
			['w2', 'j2', 'j3'],
			['w3', 'j3', 'j4'],
			['w4', 'j4', 'j1']
		].map(([id, startJunctionId, endJunctionId], index) => ({
			id,
			startJunctionId,
			endJunctionId,
			role: 'boundary' as const,
			thickness: 0.2,
			height: options.wallHeights?.[index] ?? wallHeight
		})),
		rooms: [
			{
				id: 'room-a',
				name: 'Room A',
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

function withOpening(
	document: LayoutDocumentWallFirst,
	opening: { id: string; wallId: string; sillHeight: number; height: number; width?: number; offset?: number }
): LayoutDocumentWallFirst {
	return {
		...document,
		openings: [
			{
				id: opening.id,
				wallId: opening.wallId,
				kind: 'door',
				offset: opening.offset ?? 1,
				width: opening.width ?? 0.9,
				height: opening.height,
				sillHeight: opening.sillHeight,
				profile: 'rectangular'
			}
		]
	};
}

/**
 * Reserialize a document as the superseded wall-first `4` payload, Floor height
 * included. P23.6I does **not** migrate that generation, so this payload exists
 * in these tests only to prove it is refused by name — never to prove it loads.
 */
function asV4Payload(document: LayoutDocumentWallFirst, floorHeight: number): unknown {
	return JSON.parse(
		JSON.stringify({
			...document,
			formatVersion: 4,
			floor: { ...document.floor, height: floorHeight }
		})
	);
}

function wallById(document: LayoutDocumentWallFirst, wallId: string) {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) throw new Error(`missing wall ${wallId}`);
	return wall;
}

describe('P23.6H/P23.6I creation rule — a new Wall is never born at a Floor-derived height', () => {
	it('gives every chain Wall the named authoring default, with no Floor involvement', () => {
		const baseline: LayoutDocumentWallFirst = {
			...rectangleDocument(),
			junctions: [],
			walls: [],
			rooms: [],
			openings: []
		};
		const plan = planWallChain({
			baseline,
			points: [
				[0, 0],
				[4, 0],
				[4, 3],
				[0, 3]
			],
			close: true,
			role: 'boundary'
		});
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(plan.document.walls.length).toBeGreaterThan(0);
		for (const wall of plan.document.walls) {
			expect(wall.height).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);
		}
		// A Rectangle/Polygon gesture is one bounded command: one uniform height.
		expect(new Set(plan.document.walls.map((wall) => wall.height)).size).toBe(1);
	});

	it('gives an isolated single Wall segment the same named default', () => {
		const baseline: LayoutDocumentWallFirst = {
			...rectangleDocument({ elevation: 2 }),
			junctions: [],
			walls: [],
			rooms: [],
			openings: []
		};
		const plan = planWallSegment({
			baseline,
			start: [0, 0],
			end: [3, 0],
			role: 'partition'
		});
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(plan.document.walls.map((wall) => wall.height)).toEqual([
			WALL_AUTHORING_DEFAULT_HEIGHT
		]);
	});

	it('still honors an explicit height override', () => {
		const baseline: LayoutDocumentWallFirst = {
			...rectangleDocument(),
			junctions: [],
			walls: [],
			rooms: [],
			openings: []
		};
		const plan = planWallSegment({
			baseline,
			start: [0, 0],
			end: [3, 0],
			role: 'partition',
			height: 1.2
		});
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(plan.document.walls[0]!.height).toBe(1.2);
	});

	it('has no Floor-birth rejection left (the Floor cannot supply a birth height any more)', () => {
		const baseline: LayoutDocumentWallFirst = {
			...rectangleDocument({ elevation: -2 }),
			junctions: [],
			walls: [],
			rooms: [],
			openings: []
		};
		const plan = planWallSegment({ baseline, start: [0, 0], end: [3, 0], role: 'partition' });
		expect(plan.kind).toBe('success');
	});

	it('preserves the source height through a Wall split', () => {
		const document = rectangleDocument({ wallHeight: 1.5 });
		// Subdivide w1 (length 4 from j1) at 2 m.
		const plan = planWallSubdivision(document, 'w1', 2, testAllocator);
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		for (const wall of plan.document.walls) {
			expect(wall.height).toBe(1.5);
		}
	});

	it('preserves the source height through an isolated Room duplicate', () => {
		const document = rectangleDocument({ wallHeight: 1.5 });
		const plan = planDuplicateIsolatedRoom(document, { roomId: 'room-a', delta: [10, 0] });
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(plan.createdWallIds.length).toBeGreaterThan(0);
		for (const wallId of plan.createdWallIds) {
			expect(wallById(plan.document, wallId).height).toBe(1.5);
		}
	});
});

describe('P23.6I pre-baseline policy — the wall-first `4` generation is not migrated', () => {
	it('rejects a format-4 payload as an unsupported version instead of reinterpreting it', () => {
		// P23.6I is pre-Compatibility-Baseline: the wall-first `4` generation that
		// reached `main` before this branch is deliberately **not** migrated, because
		// having existed on `main` does not by itself create a compatibility
		// obligation before the baseline (`docs/north-star.md` → Development-stage
		// schema compatibility).
		//
		// Migration was rejected on meaning, not effort: a format-5 H document meant
		// `Room ceiling = floor.height` while Wall-derived semantics mean
		// `max(boundary Wall heights)`, so advancing a stored payload without
		// rewriting it would silently change what that document *says*.
		const historical = asV4Payload(rectangleDocument({ wallHeight: 3 }), 2.5);
		const before = JSON.stringify(historical);
		const decoded = decodeLayoutValueCompatible(historical);
		expect(decoded.kind).toBe('unrecognized');
		if (decoded.kind !== 'unrecognized') return;
		expect(decoded.reason).toBe('unsupported-format-version');
		expect(decoded.issues.map((issue) => issue.code)).toContain('unsupported_format_version');
		expect(decoded.issues.map((issue) => issue.path)).toContain('$.formatVersion');
		// Decoding is a pure read: a rejected payload is never rewritten in place.
		expect(JSON.stringify(historical)).toBe(before);
	});

	it('rejects the payload at the strict codec too, where `4` is not a known version', () => {
		const result = validateWallFirstLayoutDocument(asV4Payload(rectangleDocument(), 2.5));
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.map((issue) => issue.code)).toContain('unsupported_format_version');
	});

	it('names the version rather than shape noise when only the version is superseded', () => {
		// The payload below is a perfectly valid current-format document apart from
		// its declared version, so the diagnosis must be the version — not a pile of
		// structural complaints about fields that are correct for `5`.
		const payload = { ...rectangleDocument(), formatVersion: 4 };
		const decoded = decodeLayoutValueCompatible(payload);
		expect(decoded.kind).toBe('unrecognized');
		if (decoded.kind !== 'unrecognized') return;
		expect(decoded.issues.every((issue) => issue.code === 'unsupported_format_version')).toBe(true);
	});

	it('keeps floor.height out of the canonical schema', () => {
		// The canonical Floor carries no vertical extent, so a present `height` is
		// `unknown_key` rather than a tolerated optional: there is no persisted
		// Floor-level vertical authority to fall back to.
		const current = validateWallFirstLayoutDocument({
			...rectangleDocument(),
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0, height: 3 }
		});
		expect(current.success).toBe(false);
		if (current.success) return;
		expect(current.issues.map((issue) => issue.code)).toContain('unknown_key');
		expect(current.issues.map((issue) => issue.path)).toContain('$.floor.height');
		// The fixture every writer emits is the same shape.
		expect('height' in layoutCore.createEmptyWallFirstLayoutDocument().floor).toBe(false);
	});

	it('exposes no historical v4 decoder, normalizer or version constant', () => {
		// A regression guard for the policy itself: re-adding a `4` path means
		// re-adding these names and failing here first.
		const exported = Object.keys(layoutCore);
		expect(exported).not.toContain('normalizePreHWallFirstLayoutV4');
		expect(exported).not.toContain('LAYOUT_PRE_AUTHORITATIVE_WALL_HEIGHT_FORMAT_VERSION');
		expect(layoutCore.KNOWN_LAYOUT_FORMAT_VERSIONS).toEqual([LAYOUT_WALL_FIRST_FORMAT_VERSION]);
	});

	it('canonical writers reject a format-4 payload fail-closed', () => {
		// The writer gate is current-format strictness, not a migration branch: a
		// superseded payload cannot reach storage at all, and there is no read-side
		// normalization path that could make it writable.
		const historical = asV4Payload(rectangleDocument(), 2.5);
		expect(wallFirstCanonicalFormatVersionIssue(historical)?.code).toBe(
			'unsupported_format_version'
		);
		expect(() => serializeWallFirstLayoutDocument(historical)).toThrowError(
			/Canonical Layout Save requires formatVersion 5/
		);
		// A canonical document round-trips through the same writer unchanged.
		expect(serializeWallFirstLayoutDocument(rectangleDocument())).toContain(
			`"formatVersion": ${LAYOUT_WALL_FIRST_FORMAT_VERSION}`
		);
	});

	it('still rejects an unknown format version by name', () => {
		const unknown = decodeLayoutValueCompatible({
			...rectangleDocument(),
			formatVersion: 9
		});
		expect(unknown.kind).toBe('unrecognized');
		if (unknown.kind !== 'unrecognized') return;
		expect(unknown.reason).toBe('unsupported-format-version');
	});
});

describe('P23.6I range and validation — positive, finite, unbounded', () => {
	it('reports every invalid Wall height in document order', () => {
		const document = rectangleDocument({ wallHeight: 1 });
		document.walls[1]!.height = 0;
		document.walls[3]!.height = Number.NaN;
		const issues = validateWallFirstWallHeights(document);
		expect(issues.map((issue) => [issue.wallId, issue.code])).toEqual([
			['w2', 'wall_height_invalid'],
			['w4', 'wall_height_invalid']
		]);
	});

	it('accepts tall Walls with no storey-shaped ceiling', () => {
		for (const height of [0.4, 3, 3.5, 6, 40]) {
			const document = rectangleDocument({
				wallHeights: [height, height, height, height]
			});
			expect(validateWallFirstWallHeights(document)).toEqual([]);
			const result = validateWallFirstLayoutDocument(document);
			expect(result.success).toBe(true);
		}
	});

	it('has no Floor-cap code left anywhere in the rule set', () => {
		const document = rectangleDocument({ wallHeights: [1.2, 4, 0.5, 3] });
		const codes = validateWallFirstWallHeights(document).map((issue) => issue.code);
		expect(codes).not.toContain('wall_height_exceeds_floor');
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
	});

	it('rejects zero, negative and non-finite heights in the current format', () => {
		for (const height of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			const document = rectangleDocument({ wallHeight: 1 });
			document.walls[0]!.height = height;
			const result = validateWallFirstLayoutDocument(document);
			expect(result.success).toBe(false);
		}
	});
});/**
 * P23.6I supersedes the P23.6H "standalone Walls share the Floor envelope" rule:
 * there is no Floor envelope any more. Nothing in `layout-wall-heights.ts` reads
 * Room membership, so a freestanding partition — referenced by no Room — has
 * exactly the same (unbounded) Wall rule as a Room-bounding one. These assertions
 * replace the former cap pins.
 */
describe('P23.6I standalone (non-room-bounding) Walls have the same unbounded rule', () => {
	function standalonePartitionDocument(wallHeight: number, elevation = 0): LayoutDocumentWallFirst {
		const document = rectangleDocument({ elevation });
		return {
			...document,
			rooms: [],
			walls: [{ ...document.walls[0]!, role: 'partition', height: wallHeight }]
		};
	}

	it('accepts a freestanding Wall taller than any former storey at the codec', () => {
		const document = standalonePartitionDocument(4);
		expect(document.rooms).toEqual([]);
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		expect(validateWallFirstWallHeights(document)).toEqual([]);
	});

	it('lets the exact Height planner raise a freestanding Wall above 3 m', () => {
		const document = standalonePartitionDocument(1.2);
		const taller = planExactWallHeight(document, 'w1', 4);
		if (taller.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(taller)}`);
		expect(taller.document.walls[0]!.height).toBe(4);

		const shorter = planExactWallHeight(document, 'w1', 2.4);
		if (shorter.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(shorter)}`);
		expect(shorter.document.walls[0]!.height).toBe(2.4);

		const veryTall = planExactWallHeight(standalonePartitionDocument(1.2), 'w1', 12);
		if (veryTall.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(veryTall)}`);
		expect(veryTall.document.walls[0]!.height).toBe(12);
	});

	it('does not depend on the Floor elevation or any Floor scalar', () => {
		// The same Wall on an elevated Floor still admits the same heights: the
		// reachable range is the Wall's own `0 < height`, full stop.
		const document = standalonePartitionDocument(1.2, 2);
		const taller = planExactWallHeight(document, 'w1', 9);
		if (taller.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(taller)}`);
		expect(taller.document.walls[0]!.height).toBe(9);
		const compiled = compileWallFirstLayoutGeometry(taller.document);
		const wall = compiled.geometry.walls.find((candidate) => candidate.wallId === 'w1')!;
		expect(wall.bounds3.min[1]).toBe(2);
		expect(wall.bounds3.max[1]).toBe(11);
	});
});

describe('P23.6H compiler — compiled Wall vertical extent follows wall.height', () => {
	it('ends a Wall at floor.elevation + wall.height, on an unbounded scale', () => {
		const document = rectangleDocument({ elevation: 2, wallHeight: 1.5 });
		const compiled = compileWallFirstLayoutGeometry(document);
		const wall = compiled.geometry.walls.find((candidate) => candidate.wallId === 'w1')!;
		expect(wall.height).toBe(1.5);
		expect(wall.bounds3.min[1]).toBe(2);
		expect(wall.bounds3.max[1]).toBe(3.5);
	});

	it('changes compiled bounds and the physical-Wall cacheKey when only height changes', () => {
		const short = compileWallFirstLayoutGeometry(rectangleDocument({ wallHeight: 1.2 }));
		const tall = compileWallFirstLayoutGeometry(rectangleDocument({ wallHeight: 2.6 }));
		const shortWall = short.geometry.walls.find((wall) => wall.wallId === 'w1')!;
		const tallWall = tall.geometry.walls.find((wall) => wall.wallId === 'w1')!;
		expect(shortWall.bounds3.max[1]).toBe(1.2);
		expect(tallWall.bounds3.max[1]).toBe(2.6);
		expect(shortWall.id).toBe(tallWall.id);
		expect(shortWall.cacheKey).not.toBe(tallWall.cacheKey);
		// X/Z geometry and identity are untouched by a height-only change.
		expect(shortWall.bounds2).toEqual(tallWall.bounds2);
		expect(shortWall.length).toBe(tallWall.length);
	});

	it('SUPERSEDES the Floor-derived envelope: the Room ceiling follows the boundary Wall max', () => {
		// P23.6H pinned "a short Wall does not lower the Room ceiling" because the
		// ceiling was Floor-derived. P23.6I inverts that deliberately: the ceiling
		// *is* the max of the boundary Wall heights.
		const short = compileWallFirstLayoutGeometry(
			rectangleDocument({ elevation: 1, wallHeight: 1 })
		);
		const full = compileWallFirstLayoutGeometry(
			rectangleDocument({ elevation: 1, wallHeight: 3 })
		);
		const shortRoom = short.geometry.rooms.find((candidate) => candidate.roomId === 'room-a')!;
		const fullRoom = full.geometry.rooms.find((candidate) => candidate.roomId === 'room-a')!;
		expect(shortRoom.ceilingElevation).toBe(2);
		expect(fullRoom.ceilingElevation).toBe(4);
		expect(shortRoom.ceilingElevation).not.toBe(fullRoom.ceilingElevation);
		// The physical Wall tops differ with them, and no Floor scalar returns.
		expect(short.geometry.walls.find((wall) => wall.wallId === 'w1')!.bounds3.max[1]).toBe(2);
		expect(full.geometry.walls.find((wall) => wall.wallId === 'w1')!.bounds3.max[1]).toBe(4);
		expect('height' in short.geometry.floors[0]!).toBe(false);
	});

	it('renders a flat ceiling at the max while shorter boundary Walls stay short', () => {
		const document = rectangleDocument({ elevation: 0, wallHeights: [4, 2, 2, 2] });
		const compiled = compileWallFirstLayoutGeometry(document);
		const room = compiled.geometry.rooms.find((candidate) => candidate.roomId === 'room-a')!;
		expect(room.ceilingElevation).toBe(4);
		const shortWall = compiled.geometry.walls.find((wall) => wall.wallId === 'w2')!;
		expect(shortWall.height).toBe(2);
		expect(shortWall.bounds3.max[1]).toBe(2);
		// No wall-top infill: the band above the short Walls is intentional.
		expect(compiled.geometry.walls.length).toBe(4);
	});

	it('leaves roomless physical Walls contributing to the aggregate bounds', () => {
		const document: LayoutDocumentWallFirst = {
			...rectangleDocument({ wallHeight: 1.2 }),
			rooms: [],
			objects: []
		};
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(compiled.geometry.bounds).not.toBeNull();
		expect(compiled.geometry.bounds!.max[1]).toBe(1.2);
		expect(compiled.geometry.floors[0]!.bounds3).not.toBeNull();
	});

	it('validates an Opening against its hosting Wall in the compiler gate as well', () => {
		// Defensive: the compiler-side rule is host-Wall based too, so a document
		// that reached the compiler without the document-level Opening-set gate
		// still cannot render an Opening through a partial-height Wall.
		const document = withOpening(rectangleDocument({ wallHeight: 1 }), {
			id: 'door-1',
			wallId: 'w1',
			sillHeight: 1.2,
			height: 0.5
		});
		const compiled = compileWallFirstLayoutGeometry(document);
		const blocking = compiled.issues.filter((issue) => issue.severity !== 'warning');
		expect(blocking.map((issue) => issue.code)).toContain('opening_over_height');
		expect(blocking[0]!.message).toContain('w1');
	});

	it('compiles a partial-height Wall with a fitting Opening cleanly', () => {
		const document = withOpening(rectangleDocument({ wallHeight: 2.4 }), {
			id: 'door-1',
			wallId: 'w1',
			sillHeight: 0,
			height: 2.1
		});
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(compiled.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
		expect(compiled.geometry.walls.find((wall) => wall.wallId === 'w1')!.bounds3.max[1]).toBe(2.4);
	});
});

describe('P23.6H exact height operation', () => {
	it('sets the height, preserves identity and leaves the Opening untouched', () => {
		const document = withOpening(rectangleDocument(), {
			id: 'door-1',
			wallId: 'w1',
			sillHeight: 0,
			height: 2.1,
			offset: 1.5,
			width: 0.8
		});
		const before = snapshot(document);
		const plan = planExactWallHeight(document, 'w1', 2.4);
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(plan.operation).toBe('wall-height');
		expect(plan.changedWallIds).toEqual(['w1']);
		expect(wallById(plan.document, 'w1').height).toBe(2.4);
		// One field changed: the rest of the document is byte-identical.
		expect({
			...plan.document,
			walls: plan.document.walls.map((wall) => ({
				...wall,
				height: WALL_AUTHORING_DEFAULT_HEIGHT
			}))
		}).toEqual(document);
		expect(plan.document.openings).toEqual(document.openings);
		expectUnchanged(document, before);
	});

	it('accepts a height exactly equal to the opening top (epsilon boundary)', () => {
		const document = withOpening(rectangleDocument(), {
			id: 'door-1',
			wallId: 'w1',
			sillHeight: 0,
			height: 2.1
		});
		const plan = planExactWallHeight(document, 'w1', 2.1);
		expect(plan.kind).toBe('success');
	});

	it('rejects a Wall lowered below its hosted Opening instead of clamping or resizing it', () => {
		const document = withOpening(rectangleDocument(), {
			id: 'door-1',
			wallId: 'w1',
			sillHeight: 0.4,
			height: 2.1
		});
		const before = snapshot(document);
		const plan = planExactWallHeight(document, 'w1', 1);
		if (plan.kind !== 'rejected') throw new Error('expected rejection');
		expect(plan.rejection.code).toBe('wall_height_below_opening');
		expect(plan.rejection.message).toContain('w1');
		expect(plan.rejection.message).toContain('door-1');
		expectUnchanged(document, before);
	});

	it('SUPERSEDES the Floor cap: accepts a height above any former storey', () => {
		// P23.6H rejected this with `invalid_value` naming the Floor envelope.
		const document = rectangleDocument({ wallHeight: 2.5 });
		const before = snapshot(document);
		const plan = planExactWallHeight(document, 'w1', 4.5);
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(wallById(plan.document, 'w1').height).toBe(4.5);
		expectUnchanged(document, before);
	});

	it('rejects non-finite, zero and negative values', () => {
		const document = rectangleDocument();
		for (const height of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			const plan = planExactWallHeight(document, 'w1', height);
			if (plan.kind !== 'rejected') throw new Error('expected rejection');
			expect(plan.rejection.code).toBe('invalid_value');
		}
	});

	it('rejects a no-op and an unknown Wall', () => {
		const document = rectangleDocument({ wallHeight: 1.5 });
		const noOp = planExactWallHeight(document, 'w1', 1.5);
		if (noOp.kind !== 'rejected') throw new Error('expected rejection');
		expect(noOp.rejection.code).toBe('no_op');
		const missing = planExactWallHeight(document, 'wall-missing', 1);
		if (missing.kind !== 'rejected') throw new Error('expected rejection');
		expect(missing.rejection.code).toBe('unknown_wall');
	});
});

describe('P23.6H topology purity — height is not topology', () => {
	it('preserves Room, Wall, Junction and Opening identity, role and boundary cycle', () => {
		const document = withOpening(rectangleDocument({ wallHeight: 1.2 }), {
			id: 'door-1',
			wallId: 'w1',
			sillHeight: 0,
			height: 0.9
		});
		const plan = planExactWallHeight(document, 'w2', 2.8);
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(plan.document.rooms).toEqual(document.rooms);
		expect(plan.document.openings).toEqual(document.openings);
		expect(plan.document.junctions).toEqual(document.junctions);
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-a']);
		expect(plan.document.walls.map((wall) => wall.role)).toEqual(['boundary', 'boundary', 'boundary', 'boundary']);
		expect(plan.document.walls.map((wall) => wall.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
		// Exactly one Wall height changed; every other Wall keeps its value.
		expect(plan.document.walls.map((wall) => wall.height)).toEqual([1.2, 2.8, 1.2, 1.2]);
	});

	it('does not alter face extraction / Room correspondence inputs', () => {
		const document = rectangleDocument({ wallHeight: 3 });
		const plan = planExactWallHeight(document, 'w1', 1);
		if (plan.kind !== 'success') throw new Error('expected success');
		// Same boundary references, same directed cycle: reconciliation sees the
		// identical topology and can only preserve the Room.
		expect(plan.document.rooms[0]!.boundary).toEqual(document.rooms[0]!.boundary);
		expect(plan.document.junctions).toEqual(document.junctions);
		expect(plan.document.walls.map((wall) => [wall.startJunctionId, wall.endJunctionId])).toEqual(
			document.walls.map((wall) => [wall.startJunctionId, wall.endJunctionId])
		);
	});
});

describe('P23.6I legacy migration', () => {
	it('seeds migrated Walls from the legacy storey height and drops it from the canonical Floor', () => {
		const legacy: LayoutDocument = {
			units: 'meters',
			floors: [
				{
					id: 'floor-1',
					name: 'Floor 1',
					elevation: 0,
					height: 3.2,
					rooms: [
						{
							id: 'room-a',
							name: 'Room A',
							wallThickness: 0.2,
							floorThickness: 0.1,
							ceilingThickness: 0.1,
							frame: { origin: [0, 0], yaw: 0 },
							boundary: {
								closed: true,
								segments: [
									{ id: 's1', kind: 'line', start: [0, 0], end: [4, 0] },
									{ id: 's2', kind: 'line', start: [4, 0], end: [4, 3] },
									{ id: 's3', kind: 'line', start: [4, 3], end: [0, 3] },
									{ id: 's4', kind: 'line', start: [0, 3], end: [0, 0] }
								]
							},
							openings: []
						}
					]
				}
			],
			objects: []
		};
		const migration = migrateLegacyLayoutDocument(legacy);
		if (migration.kind !== 'success') throw new Error(`expected migration: ${JSON.stringify(migration)}`);
		expect(migration.document.formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(migration.document.walls.length).toBeGreaterThan(0);
		for (const wall of migration.document.walls) {
			expect(wall.height).toBe(3.2);
		}
		// The legacy storey value completed its one conversion job: it seeded the
		// Wall heights above and does not survive as canonical Floor truth.
		expect(migration.document.floor).toEqual({
			id: 'floor-1',
			name: 'Floor 1',
			elevation: 0
		});
		expect('height' in migration.document.floor).toBe(false);
	});
});

/** Snapshot helper: planners must never mutate their input document. */
function snapshot(document: LayoutDocumentWallFirst): string {
	return JSON.stringify(document);
}

/** Frozen input guard: the input document must be byte-identical afterwards. */
function expectUnchanged(document: LayoutDocumentWallFirst, before: string): void {
	expect(snapshot(document)).toBe(before);
}
