/**
 * P23.0 F0 stage 3 — P23.8 defaults/allocation/replay fixture suite against
 * the stage-2 writers.
 *
 * P23.0 execution order item 3: first-enclosure creation and
 * Partition→boundary Room birth must pass the P23.8 defaults / allocation /
 * replay fixtures, routed through the stage-2 planners (not just the raw
 * `reconcileRooms` engine, which pins the same rules one layer down in
 * `layout-room-reconciliation.test.ts`):
 *
 * - Room identity: deterministic IDs/names, 0.1 m defaults, canonical
 *   allocation order, failed matches never masquerading as births, tiny-but-
 *   valid candidates (H3 validity, no H5 epsilon);
 * - Layout-object semantics: unassociated objects stay unassociated with
 *   byte-identical transforms, dangling associations reject at the canonical
 *   gate, replay restores exact associations, inputs are never mutated;
 * - Subdivision: a writer-born Room flows through `planWallSplit` + 1→1
 *   reconciliation with its ID preserved, boundaries rewritten
 *   (forward and reverse arms), openings rebased (before/after plus exact
 *   opening-edge splits), interior splits rejected without mutation, and an
 *   associated object retaining the split survivor per the P23.8 rule.
 *   Split/merge remap and disappearance clearing live one layer down in
 *   `layout-room-reconciliation.test.ts` (births have no predecessors, so
 *   there is nothing to remap from here).
 * - Portal: perimeter doors survive births unchanged, relations to unknown
 *   rooms reject, and a valid ADJACENT born relation (shared-wall pair per
 *   the stage-5 Save-blocker contract) survives the Save round-trip.
 *
 * Writers stay disabled (pre-F0 stance) — this suite only calls the planners
 * as pure functions; the `wall-first` layout mutation policy remains
 * `disabled` (pinned in the stage-2 suite).
 */
import { describe, expect, it } from 'vitest';

import {
	planFirstEnclosureCreation,
	planPartitionToBoundaryRoomBirth,
	ROOM_CREATION_DEFAULTS,
	type WallFirstOpPlan
} from '$lib/layout/layout-wall-topology-ops';
import {
	planWallSplit,
	type NodingIdAllocator
} from '$lib/layout/layout-wall-noding';
import { reconcileRooms } from '$lib/layout/layout-room-reconciliation';
import { extractBoundaryCandidateFaces } from '$lib/layout/layout-face-extraction';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst
} from '$lib/layout/layout-wall-first-codec';
import {
	serializeWallFirstProject,
	validateWallFirstProject
} from '@portfolio/project-model';
import { decodeProjectCompatible } from '$lib/content/scene-format';
import type { SceneDocument } from '$lib/content/scene';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type JunctionSeed = readonly [string, number, number];
type WallSeed = readonly [string, string, string];

type OpeningSeed = {
	id: string;
	wallId: string;
	kind: 'door' | 'window';
	offset: number;
	width: number;
	height?: number;
	sillHeight?: number;
	connectsRoomIds?: [string, string];
};

type ObjectSeed = {
	id: string;
	roomId?: string;
	position?: readonly [number, number, number];
};

function birthDocument(parts: {
	junctions: readonly JunctionSeed[];
	walls: readonly WallSeed[];
	role?: 'boundary' | 'partition';
	openings?: readonly OpeningSeed[];
	objects?: readonly ObjectSeed[];
}): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: parts.junctions.map(([id, x, z]) => ({ id, point: [x, z] as [number, number] })),
		walls: parts.walls.map(([id, start, end]) => ({
			id,
			startJunctionId: start,
			endJunctionId: end,
			role: parts.role ?? ('boundary' as const),
			thickness: 0.2,
			height: 3
		})),
		rooms: [],
		openings: (parts.openings ?? []).map((opening) => ({
			id: opening.id,
			wallId: opening.wallId,
			kind: opening.kind,
			offset: opening.offset,
			width: opening.width,
			height: opening.height ?? 2.1,
			sillHeight: opening.sillHeight ?? 0,
			profile: 'rectangular' as const,
			...(opening.connectsRoomIds ? { connectsRoomIds: opening.connectsRoomIds } : {})
		})),
		objects: (parts.objects ?? []).map((object) => ({
			id: object.id,
			kind: 'box' as const,
			position: (object.position ? [...object.position] : [1, 0, 1]) as [number, number, number],
			rotation: [0, 0, 0] as [number, number, number],
			dimensions: [1, 1, 1] as [number, number, number],
			...(object.roomId ? { roomId: object.roomId } : {})
		}))
	};
}

const RECT_JUNCTIONS: readonly JunctionSeed[] = [
	['j-a', 0, 0],
	['j-b', 6, 0],
	['j-c', 6, 4],
	['j-d', 0, 4]
];

const RECT_CLOSED: readonly WallSeed[] = [
	['wall-a', 'j-a', 'j-b'],
	['wall-b', 'j-b', 'j-c'],
	['wall-c', 'j-c', 'j-d'],
	['wall-d', 'j-d', 'j-a']
];

function expectSuccess(plan: WallFirstOpPlan): asserts plan is Extract<WallFirstOpPlan, { kind: 'success' }> {
	expect(plan.kind).toBe('success');
	if (plan.kind !== 'success') throw new Error(`expected success, got: ${JSON.stringify(plan)}`);
}

/** Cyclic rotation equivalence of two oriented boundary cycles (directions included). */
function isBoundaryRotation(
	a: readonly { wallId: string; direction: 'forward' | 'reverse' }[],
	b: readonly { wallId: string; direction: 'forward' | 'reverse' }[]
): boolean {
	if (a.length !== b.length || a.length === 0) return false;
	return a.some((_, start) =>
		a.every(
			(entry, index) =>
				entry.wallId === b[(start + index) % b.length]!.wallId &&
				entry.direction === b[(start + index) % b.length]!.direction
		)
	);
}

function expectRejected(plan: WallFirstOpPlan, code: string): void {
	expect(plan.kind).toBe('rejected');
	if (plan.kind !== 'rejected') return;
	expect(plan.rejection.code).toBe(code);
	// Rejections carry no partial document.
	expect('document' in plan).toBe(false);
}

/** Deterministic noding allocator (same seed policy as the noding suite). */
function nodingAllocator(): NodingIdAllocator {
	return {
		nextWallId(base, seed) {
			let candidate = `${seed}-1`;
			let counter = 1;
			while (base.walls.some((wall) => wall.id === candidate)) {
				counter += 1;
				candidate = `${seed}-${counter}`;
			}
			return candidate;
		},
		nextJunctionId(base, seed) {
			let candidate = `j-${seed}-1`;
			let counter = 1;
			while (base.junctions.some((junction) => junction.id === candidate)) {
				counter += 1;
				candidate = `j-${seed}-${counter}`;
			}
			return candidate;
		}
	};
}

function worldLocalScene(): SceneDocument {
	return {
		formatVersion: 1,
		textures: [],
		materials: [],
		entities: [],
		navigationNodes: [],
		connections: []
	};
}

// ---------------------------------------------------------------------------
// 1. Room identity — defaults / allocation / replay through the writers
// ---------------------------------------------------------------------------

describe('P23.0 stage 3 — Room identity fixtures against the birth writers', () => {
	it('both birth paths stamp the P23.8 0.1 m floor/ceiling defaults', () => {
		const first = planFirstEnclosureCreation({
			candidateDocument: birthDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED })
		});
		expectSuccess(first);
		expect(first.document.rooms[0]!.floorThickness).toBe(ROOM_CREATION_DEFAULTS.floorThickness);
		expect(first.document.rooms[0]!.ceilingThickness).toBe(ROOM_CREATION_DEFAULTS.ceilingThickness);

		const flipped = planPartitionToBoundaryRoomBirth({
			candidateDocument: birthDocument({
				junctions: RECT_JUNCTIONS,
				walls: RECT_CLOSED,
				role: 'partition'
			}),
			chainWallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d']
		});
		expectSuccess(flipped);
		expect(flipped.document.rooms[0]!.floorThickness).toBe(0.1);
		expect(flipped.document.rooms[0]!.ceilingThickness).toBe(0.1);
		// Same foundation operation: identical faces birth identical Rooms.
		expect(flipped.document.rooms).toEqual(first.document.rooms);
	});

	it('three independent faces allocate Draft Room 1..3 in canonical face-key order', () => {
		const junctions: readonly JunctionSeed[] = [
			...RECT_JUNCTIONS,
			['j-e', 10, 0],
			['j-f', 15, 0],
			['j-g', 15, 4],
			['j-h', 10, 4],
			['j-i', 20, 0],
			['j-j', 24, 0],
			['j-k', 24, 4],
			['j-l', 20, 4]
		];
		const walls: readonly WallSeed[] = [
			...RECT_CLOSED,
			['wall-e', 'j-e', 'j-f'],
			['wall-f', 'j-f', 'j-g'],
			['wall-g', 'j-g', 'j-h'],
			['wall-h', 'j-h', 'j-e'],
			['wall-i', 'j-i', 'j-j'],
			['wall-j', 'j-j', 'j-k'],
			['wall-k', 'j-k', 'j-l'],
			['wall-l', 'j-l', 'j-i']
		];
		const plan = planFirstEnclosureCreation({
			candidateDocument: birthDocument({ junctions, walls })
		});
		expectSuccess(plan);
		expect(plan.document.rooms).toHaveLength(3);
		expect(plan.document.rooms.map((room) => room.name)).toEqual([
			'Draft Room 1',
			'Draft Room 2',
			'Draft Room 3'
		]);
		const ids = plan.document.rooms.map((room) => room.id);
		expect(new Set(ids).size).toBe(3);
		expect([...ids].sort()).toEqual(ids);
	});

	it('allocation order is independent of input wall order (canonical face keys)', () => {
		const forward = planFirstEnclosureCreation({
			candidateDocument: birthDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED })
		});
		const reversed = planFirstEnclosureCreation({
			candidateDocument: birthDocument({
				junctions: RECT_JUNCTIONS,
				walls: [...RECT_CLOSED].reverse()
			})
		});
		expectSuccess(forward);
		expectSuccess(reversed);
		// Face keys (and therefore IDs/names/defaults) are rotation-
		// canonicalized, so both orders birth the same Room identity — but the
		// stored boundary cycle may start at a different wall depending on
		// traversal start. Assert rotation equivalence with directions, not
		// byte equality (extraction normalizes traversal orientation once,
		// so a pure rotation — never a reversal — relates the two).
		expect(reversed.document.rooms.map((room) => room.id)).toEqual(
			forward.document.rooms.map((room) => room.id)
		);
		expect(reversed.document.rooms.map((room) => room.name)).toEqual(
			forward.document.rooms.map((room) => room.name)
		);
		expect(
			isBoundaryRotation(
				forward.document.rooms[0]!.boundary,
				reversed.document.rooms[0]!.boundary
			)
		).toBe(true);
	});

	it('a partial partition flip that leaves the chain open births no Room', () => {
		const frozen = birthDocument({
			junctions: RECT_JUNCTIONS,
			walls: RECT_CLOSED,
			role: 'partition'
		});
		const snapshot = structuredClone(frozen);
		// Only two of four walls flip: the remaining partitions stay out of
		// face extraction, so no enclosed face exists — a failed match must
		// never masquerade as a birth.
		const plan = planPartitionToBoundaryRoomBirth({
			candidateDocument: frozen,
			chainWallIds: ['wall-a', 'wall-b']
		});
		expectRejected(plan, 'no_enclosed_face');
		expect(frozen).toEqual(snapshot);
	});

	it('a tiny-but-valid candidate births (H3 validity, no H5 epsilon)', () => {
		const plan = planFirstEnclosureCreation({
			candidateDocument: birthDocument({
				junctions: [
					['j-a', 0, 0],
					['j-b', 0.4, 0],
					['j-c', 0.4, 0.4],
					['j-d', 0, 0.4]
				],
				walls: RECT_CLOSED
			})
		});
		expectSuccess(plan);
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.name).toBe('Draft Room 1');
	});
});

// ---------------------------------------------------------------------------
// 2. Layout-object semantic associations through births
// ---------------------------------------------------------------------------

describe('P23.0 stage 3 — object associations through the birth writers', () => {
	it('unassociated objects stay unassociated with byte-identical transforms', () => {
		const plan = planFirstEnclosureCreation({
			candidateDocument: birthDocument({
				junctions: RECT_JUNCTIONS,
				walls: RECT_CLOSED,
				objects: [
					{ id: 'crate-1', position: [4, 0, 2] },
					{ id: 'crate-2', position: [1, 0, 3] }
				]
			})
		});
		expectSuccess(plan);
		expect(plan.document.objects).toHaveLength(2);
		for (const object of plan.document.objects) {
			expect(object.roomId).toBeUndefined();
		}
		expect(plan.document.objects[0]).toMatchObject({
			id: 'crate-1',
			position: [4, 0, 2],
			rotation: [0, 0, 0],
			dimensions: [1, 1, 1]
		});
	});

	it('objects with dangling roomIds reject at the canonical gate (no silent clear)', () => {
		const frozen = birthDocument({
			junctions: RECT_JUNCTIONS,
			walls: RECT_CLOSED,
			objects: [{ id: 'crate-1', roomId: 'room-does-not-exist' }]
		});
		const snapshot = structuredClone(frozen);
		const plan = planFirstEnclosureCreation({ candidateDocument: frozen });
		// Reconciliation has no predecessor to remap from, so the dangling
		// association reaches the codec, which rejects unknown roomIds.
		expectRejected(plan, 'invalid_candidate_document');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.issues?.some((issue) => issue.code === 'unknown_key' || issue.path.includes('roomId'))).toBe(
			true
		);
		expect(frozen).toEqual(snapshot);
	});

	it('partition birth preserves unassociated objects and replays them exactly', () => {
		const baseline = birthDocument({
			junctions: RECT_JUNCTIONS,
			walls: RECT_CLOSED,
			role: 'partition',
			objects: [{ id: 'crate-1', position: [2, 0, 2] }]
		});
		const first = planPartitionToBoundaryRoomBirth({
			candidateDocument: baseline,
			chainWallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d']
		});
		expectSuccess(first);
		expect(first.document.objects[0]!.roomId).toBeUndefined();
		expect(first.document.objects[0]!.position).toEqual([2, 0, 2]);
		// Undo/redo replay: re-running on the baseline restores the exact
		// committed snapshot, associations included.
		const rerun = planPartitionToBoundaryRoomBirth({
			candidateDocument: baseline,
			chainWallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d']
		});
		expect(rerun).toEqual(first);
	});

	it('planners never mutate their input, on success or rejection', () => {
		const good = birthDocument({
			junctions: RECT_JUNCTIONS,
			walls: RECT_CLOSED,
			objects: [{ id: 'crate-1' }]
		});
		const goodSnapshot = structuredClone(good);
		expectSuccess(planFirstEnclosureCreation({ candidateDocument: good }));
		expect(good).toEqual(goodSnapshot);

		const bad = birthDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED.slice(0, 3) });
		const badSnapshot = structuredClone(bad);
		expectRejected(planFirstEnclosureCreation({ candidateDocument: bad }), 'no_enclosed_face');
		expect(bad).toEqual(badSnapshot);
	});
});

// ---------------------------------------------------------------------------
// 3. Subdivision integration — writer-born Rooms through planWallSplit
// ---------------------------------------------------------------------------

describe('P23.0 stage 3 — subdivision fixtures against writer-born Rooms', () => {
	function bornRectWithDoor(): LayoutDocumentWallFirst {
		const plan = planFirstEnclosureCreation({
			candidateDocument: birthDocument({
				junctions: RECT_JUNCTIONS,
				walls: RECT_CLOSED,
				openings: [{ id: 'door-1', wallId: 'wall-a', kind: 'door', offset: 4, width: 0.9 }],
				objects: [{ id: 'crate-1', position: [4, 0, 2] }]
			})
		});
		expectSuccess(plan);
		return plan.document;
	}

	/** 1→1 subdivision reconciliation with an allocator that must never run. */
	function reconcileSubdivision(baseline: LayoutDocumentWallFirst, split: LayoutDocumentWallFirst) {
		const extraction = extractBoundaryCandidateFaces({ ...split, rooms: [] });
		expect(extraction.faces).toHaveLength(1);
		const reconciled = reconcileRooms({
			baseline,
			candidateDocument: split,
			extraction,
			components: [
				{ candidateFaceKeys: [extraction.faces[0]!.key], predecessorRoomIds: [baseline.rooms[0]!.id] }
			],
			allocator: {
				nextRoomId: () => {
					throw new Error('1→1 preservation must not allocate');
				},
				nextRoomName: () => {
					throw new Error('1→1 preservation must not allocate');
				}
			}
		});
		if (!('document' in reconciled)) throw new Error('expected success');
		return reconciled.document;
	}

	it('splitting a born Room wall preserves the Room ID and rewrites the boundary', () => {
		const born = bornRectWithDoor();
		const bornRoomId = born.rooms[0]!.id;
		const split = planWallSplit(born, 'wall-a', 2, nodingAllocator());
		expect(split.kind).toBe('success');
		if (split.kind !== 'success') return;
		const fragmentId = split.createdWallIds[0]!;

		// Subdivision that preserves face count is a 1→1 lineage case: the
		// born identity survives, no allocator involved.
		const document = reconcileSubdivision(born, split.document);
		expect(document.rooms).toHaveLength(1);
		expect(document.rooms[0]!.id).toBe(bornRoomId);
		expect(document.rooms[0]!.name).toBe('Draft Room 1');
		const wallIds = new Set(document.rooms[0]!.boundary.map((ref) => ref.wallId));
		expect(wallIds.has('wall-a')).toBe(true);
		expect(wallIds.has(fragmentId)).toBe(true);
		// Object association + transform untouched by the subdivision.
		expect(document.objects[0]).toMatchObject({
			id: 'crate-1',
			position: [4, 0, 2]
		});
		expect(document.objects[0]!.roomId).toBeUndefined();
	});

	it('an associated object retains the survivor through born-room subdivision (P23.8 survivor rule)', () => {
		const born = bornRectWithDoor();
		const bornRoomId = born.rooms[0]!.id;
		// Births accept no predecessors, so association attaches post-birth
		// to the born identity — the survivor of the coming split.
		const associated: LayoutDocumentWallFirst = {
			...born,
			objects: [
				{
					id: 'crate-1',
					kind: 'box',
					position: [1, 0, 1],
					rotation: [0, 0, 0],
					dimensions: [1, 1, 1],
					roomId: bornRoomId
				}
			]
		};
		const split = planWallSplit(associated, 'wall-a', 2, nodingAllocator());
		expect(split.kind).toBe('success');
		if (split.kind !== 'success') return;
		const document = reconcileSubdivision(associated, split.document);
		// The association retains the predecessor ID without choosing by
		// object position — and the transform never moves.
		expect(document.objects).toHaveLength(1);
		expect(document.objects[0]!.roomId).toBe(bornRoomId);
		expect(document.objects[0]!.position).toEqual([1, 0, 1]);
	});

	it('reverse born boundaries rewrite [W reverse] → [W2 reverse, W reverse]', () => {
		const born = bornRectWithDoor();
		const reversed: LayoutDocumentWallFirst = {
			...born,
			rooms: [
				{
					...born.rooms[0]!,
					boundary: born.rooms[0]!.boundary.map((ref) => ({ ...ref, direction: 'reverse' as const }))
				}
			]
		};
		const split = planWallSplit(reversed, 'wall-a', 2, nodingAllocator());
		expect(split.kind).toBe('success');
		if (split.kind !== 'success') return;
		const fragmentId = split.createdWallIds[0]!;
		const boundary = split.document.rooms[0]!.boundary;
		const at = boundary.findIndex((ref) => ref.wallId === fragmentId);
		expect(at).toBeGreaterThanOrEqual(0);
		// Reverse arm: the new fragment precedes the retained wall, both reversed.
		expect(boundary.slice(at, at + 2)).toEqual([
			{ wallId: fragmentId, direction: 'reverse' },
			{ wallId: 'wall-a', direction: 'reverse' }
		]);
		const document = reconcileSubdivision(reversed, split.document);
		expect(document.rooms[0]!.id).toBe(born.rooms[0]!.id);
	});

	it('openings rebase by meter offset when a born wall splits around them', () => {
		const born = bornRectWithDoor();
		// door-1 sits on wall-a at [4, 4.9]; splitting at 2 m moves it to the
		// new fragment at offset 2 with the same ID.
		const split = planWallSplit(born, 'wall-a', 2, nodingAllocator());
		expect(split.kind).toBe('success');
		if (split.kind !== 'success') return;
		const door = split.document.openings.find((opening) => opening.id === 'door-1')!;
		expect(door.wallId).toBe(split.createdWallIds[0]!);
		expect(door.offset).toBe(2);
	});

	it('splitting exactly at a born opening edge rebases deterministically', () => {
		const plan = planFirstEnclosureCreation({
			candidateDocument: birthDocument({
				junctions: RECT_JUNCTIONS,
				walls: RECT_CLOSED,
				openings: [{ id: 'door-edge', wallId: 'wall-a', kind: 'door', offset: 2, width: 1 }]
			})
		});
		expectSuccess(plan);
		// Split exactly at the opening start: moves to the new wall at offset 0.
		const atStart = planWallSplit(plan.document, 'wall-a', 2, nodingAllocator());
		expect(atStart.kind).toBe('success');
		if (atStart.kind !== 'success') return;
		const moved = atStart.document.openings.find((opening) => opening.id === 'door-edge')!;
		expect(moved.wallId).toBe(atStart.createdWallIds[0]!);
		expect(moved.offset).toBe(0);
		// Split exactly at the opening end: remains on the retained wall.
		const atEnd = planWallSplit(plan.document, 'wall-a', 3, nodingAllocator());
		expect(atEnd.kind).toBe('success');
		if (atEnd.kind !== 'success') return;
		const kept = atEnd.document.openings.find((opening) => opening.id === 'door-edge')!;
		expect(kept.wallId).toBe('wall-a');
		expect(kept.offset).toBe(2);
	});

	it('splitting through a born door interior rejects and mutates nothing', () => {
		const born = bornRectWithDoor();
		const frozen = structuredClone(born);
		// door-1 occupies [4, 4.9] on the 6 m wall-a; splitting at 4.5 lands
		// inside the opening interior.
		const split = planWallSplit(born, 'wall-a', 4.5, nodingAllocator());
		expect(split).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({ code: 'split_through_opening_interior', wallId: 'wall-a' })
		});
		expect(born).toEqual(frozen);
	});

	it('re-splitting the same born wall at the same distance replays exact IDs', () => {
		const born = bornRectWithDoor();
		const first = planWallSplit(born, 'wall-a', 2, nodingAllocator());
		const second = planWallSplit(born, 'wall-a', 2, nodingAllocator());
		expect(first).toEqual(second);
	});
});

// ---------------------------------------------------------------------------
// 4. Portal fixtures through the birth writers
// ---------------------------------------------------------------------------

describe('P23.0 stage 3 — portal fixtures against the birth writers', () => {
	it('perimeter doors without relations survive birth unchanged', () => {
		const plan = planFirstEnclosureCreation({
			candidateDocument: birthDocument({
				junctions: RECT_JUNCTIONS,
				walls: RECT_CLOSED,
				openings: [
					{ id: 'door-1', wallId: 'wall-a', kind: 'door', offset: 1, width: 0.9 },
					{ id: 'win-1', wallId: 'wall-c', kind: 'window', offset: 2, width: 1.2 }
				]
			})
		});
		expectSuccess(plan);
		expect(plan.document.openings).toHaveLength(2);
		expect(plan.document.openings[0]).toMatchObject({
			id: 'door-1',
			wallId: 'wall-a',
			offset: 1,
			width: 0.9
		});
		expect(plan.document.openings[0]!.connectsRoomIds).toBeUndefined();
		// Replay keeps the openings byte-identical.
		const rerun = planFirstEnclosureCreation({
			candidateDocument: birthDocument({
				junctions: RECT_JUNCTIONS,
				walls: RECT_CLOSED,
				openings: [
					{ id: 'door-1', wallId: 'wall-a', kind: 'door', offset: 1, width: 0.9 },
					{ id: 'win-1', wallId: 'wall-c', kind: 'window', offset: 2, width: 1.2 }
				]
			})
		});
		expect(rerun).toEqual(plan);
	});

	it('relations to unknown rooms reject at the canonical gate', () => {
		const plan = planFirstEnclosureCreation({
			candidateDocument: birthDocument({
				junctions: RECT_JUNCTIONS,
				walls: RECT_CLOSED,
				openings: [
					{
						id: 'door-bridge',
						wallId: 'wall-a',
						kind: 'door',
						offset: 1,
						width: 0.9,
						connectsRoomIds: ['room-left', 'room-right']
					}
				]
			})
		});
		// No predecessors exist at birth, so no remap is possible — the codec
		// rejects the unknown relation instead of clearing it silently.
		expectRejected(plan, 'invalid_candidate_document');
	});

	it('a valid born portal relation survives the Save round-trip', () => {
		// Two rooms sharing wall-e (6x4 rect split at x=3): the door on the
		// shared wall declares the explicit semantic relation between the
		// born IDs, which is exactly the two rooms adjacent to the host.
		const junctions: readonly JunctionSeed[] = [
			['j-a', 0, 0],
			['j-m', 3, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-n', 3, 4],
			['j-d', 0, 4]
		];
		const walls: readonly WallSeed[] = [
			['wall-a1', 'j-a', 'j-m'],
			['wall-a2', 'j-m', 'j-b'],
			['wall-b', 'j-b', 'j-c'],
			['wall-c1', 'j-c', 'j-n'],
			['wall-c2', 'j-n', 'j-d'],
			['wall-d', 'j-d', 'j-a'],
			['wall-e', 'j-m', 'j-n']
		];
		const birth = planFirstEnclosureCreation({
			candidateDocument: birthDocument({ junctions, walls })
		});
		expectSuccess(birth);
		expect(birth.document.rooms).toHaveLength(2);
		const [leftId, rightId] = birth.document.rooms.map((room) => room.id);
		const withPortal: LayoutDocumentWallFirst = {
			...birth.document,
			openings: [
				{
					id: 'door-bridge',
					wallId: 'wall-e',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: [leftId!, rightId!]
				}
			]
		};
		const validated = validateWallFirstProject({
			id: 'project-portal-save',
			name: 'Portal Save',
			layout: withPortal,
			scene: worldLocalScene()
		});
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		const written = serializeWallFirstProject({
			id: 'project-portal-save',
			name: 'Portal Save',
			layout: withPortal,
			scene: worldLocalScene()
		});
		const decoded = decodeProjectCompatible(JSON.parse(written.canonicalJson));
		expect(decoded.kind).toBe('wall-first');
		if (decoded.kind !== 'wall-first') return;
		const openings =
			(decoded.project.layout as LayoutDocumentWallFirst).openings ?? [];
		expect(openings).toHaveLength(1);
		expect(openings[0]).toMatchObject({
			id: 'door-bridge',
			connectsRoomIds: [leftId, rightId]
		});
	});
});

// ---------------------------------------------------------------------------
// 5. Save-writer round-trip of writer-born content
// ---------------------------------------------------------------------------

describe('P23.0 stage 3 — Save writer round-trip of born content', () => {
	it('a born document with objects + openings round-trips byte-identically', () => {
		const birth = planFirstEnclosureCreation({
			candidateDocument: birthDocument({
				junctions: RECT_JUNCTIONS,
				walls: RECT_CLOSED,
				openings: [{ id: 'door-1', wallId: 'wall-a', kind: 'door', offset: 1, width: 0.9 }],
				objects: [{ id: 'crate-1', position: [4, 0, 2] }]
			})
		});
		expectSuccess(birth);
		const payload = {
			id: 'project-born-content',
			name: 'Born Content',
			layout: birth.document,
			scene: worldLocalScene()
		};
		const validated = validateWallFirstProject(payload);
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		const written = serializeWallFirstProject(payload);
		const decoded = decodeProjectCompatible(JSON.parse(written.canonicalJson));
		expect(decoded.kind).toBe('wall-first');
		if (decoded.kind !== 'wall-first') return;
		const layout = decoded.project.layout as LayoutDocumentWallFirst;
		// Full byte-identity: junctions, floor frame and every collection.
		expect(layout).toEqual(birth.document);
	});

	it('the Save writer still rejects born content with dangling references', () => {
		const birth = planFirstEnclosureCreation({
			candidateDocument: birthDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED })
		});
		expectSuccess(birth);
		const tampered: LayoutDocumentWallFirst = {
			...birth.document,
			objects: [
				{
					id: 'crate-1',
					kind: 'box',
					position: [1, 0, 1],
					rotation: [0, 0, 0],
					dimensions: [1, 1, 1],
					roomId: 'room-does-not-exist'
				}
			]
		};
		const result = validateWallFirstProject({
			id: 'project-tampered',
			name: 'Tampered',
			layout: tampered,
			scene: worldLocalScene()
		});
		expect(result.success).toBe(false);
	});
});
