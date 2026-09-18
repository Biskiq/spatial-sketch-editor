/**
 * P23.0 F0 stage 2 — canonical writers for the P23 minimum.
 *
 * Covers the three stage-2 planner/writer surfaces (P23.0 execution order
 * item 2) against the P23.8 engine:
 *
 * 1. headless first-enclosure creation — deterministic IDs/names, 0.1 m
 *    defaults, rejection before any commit;
 * 2. Partition → boundary Room birth — the same foundation operation behind
 *    the P23.9 role-flip entry point;
 * 3. canonical wall-first Project Save (wall-first Layout + world-local
 *    Scene) plus the portable package manifest versioning.
 *
 * The F0 gate boundary stays pinned: the editor layout mutation policy for
 * wall-first documents remains `disabled` — writers exist, writes stay off
 * until the full acceptance checklist passes.
 */
import { describe, expect, it } from 'vitest';

import {
	createAuthoringRoomAllocator,
	planFirstEnclosureCreation,
	planPartitionToBoundaryRoomBirth,
	ROOM_CREATION_DEFAULTS,
	type WallFirstOpPlan
} from '$lib/layout/layout-wall-topology-ops';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	validateWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import { decodeProjectCompatible } from '$lib/content/scene-format';
import {
	PACKAGE_MANIFEST_FORMAT_VERSION,
	buildPackageManifest,
	serializeWallFirstProject,
	validateWallFirstProject,
	WallFirstProjectValidationError
} from '@portfolio/project-model';
import { LAYOUT_MUTATION_POLICY, LAYOUT_MUTATION_REASONS } from '$lib/editor/store/document-format-policy.svelte';
import { chopinProject } from '$lib/content/chopin-project';
import type { SceneDocument } from '$lib/content/scene';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type JunctionSeed = readonly [string, number, number];
type WallSeed = readonly [string, string, string];

function wallFirstDocument(parts: {
	junctions: readonly JunctionSeed[];
	walls: readonly WallSeed[];
	role?: 'boundary' | 'partition';
	objects?: Array<{ id: string; roomId?: string }>;
}): ReturnType<typeof documentWithoutRooms> {
	return documentWithoutRooms(parts);
}

function documentWithoutRooms(parts: {
	junctions: readonly JunctionSeed[];
	walls: readonly WallSeed[];
	role?: 'boundary' | 'partition';
	objects?: Array<{ id: string; roomId?: string }>;
}) {
	return {
		units: 'meters' as const,
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: parts.junctions.map(([id, x, z]) => ({ id, point: [x, z] as [number, number] })),
		walls: parts.walls.map(([id, start, end]) => ({
			id,
			startJunctionId: start,
			endJunctionId: end,
			role: parts.role ?? ('boundary' as const),
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' } as const,
		})),
		rooms: [],
		openings: [],
		objects: (parts.objects ?? []).map((object) => ({
			id: object.id,
			kind: 'box' as const,
			position: [1, 0, 1] as [number, number, number],
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

/** Closed rectangular ring — the minimal first-enclosure fixture. */
const RECT_CLOSED: readonly WallSeed[] = [
	['wall-a', 'j-a', 'j-b'],
	['wall-b', 'j-b', 'j-c'],
	['wall-c', 'j-c', 'j-d'],
	['wall-d', 'j-d', 'j-a']
];

/** Open chain — same rectangle minus the closing wall. */
const RECT_OPEN: readonly WallSeed[] = RECT_CLOSED.slice(0, 3);

function expectRejected(plan: WallFirstOpPlan, code: string): void {
	expect(plan.kind).toBe('rejected');
	if (plan.kind !== 'rejected') return;
	expect(plan.rejection.code).toBe(code);
}

// ---------------------------------------------------------------------------
// 1. Headless first-enclosure creation
// ---------------------------------------------------------------------------

describe('P23.0 stage 2 — headless first-enclosure creation', () => {
	it('creates a Room with deterministic ID, Draft Room 1 name and 0.1 m defaults', () => {
		const plan = planFirstEnclosureCreation({
			candidateDocument: wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED })
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		const room = plan.document.rooms[0]!;
		// The deterministic ID seeds from the sanitized canonical face key
		// (the tuple-safe serialization of the oriented wall cycle).
		expect(room.id).toMatch(/^room\.[A-Za-z0-9._:-]+$/);
		expect(room.id).toContain('wall-a');
		expect(room.name).toBe('Draft Room 1');
		expect(room.floorThickness).toBe(ROOM_CREATION_DEFAULTS.floorThickness);
		expect(room.ceilingThickness).toBe(ROOM_CREATION_DEFAULTS.ceilingThickness);
		expect(room.boundary).toHaveLength(4);
		expect(plan.lineage).toHaveLength(1);
		expect(plan.lineage[0]).toMatchObject({ roomId: room.id, kind: 'created' });
		// Walls are untouched by the birth.
		expect(plan.document.walls).toHaveLength(4);
	});

	it('is deterministic: two runs allocate identical IDs/names', () => {
		const first = planFirstEnclosureCreation({
			candidateDocument: wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED })
		});
		const second = planFirstEnclosureCreation({
			candidateDocument: wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED })
		});
		expect(first.kind).toBe('success');
		expect(second.kind).toBe('success');
		if (first.kind !== 'success' || second.kind !== 'success') return;
		expect(first.document).toEqual(second.document);
		expect(first.document.rooms[0]!.id).not.toMatch(/random|timestamp/i);
	});

	it('allocates several independent faces in canonical order', () => {
		// Two independent closed rings sharing nothing — two birth components.
		const junctions: readonly JunctionSeed[] = [
			...RECT_JUNCTIONS,
			['j-e', 10, 0],
			['j-f', 16, 0],
			['j-g', 16, 4],
			['j-h', 10, 4]
		];
		const walls: readonly WallSeed[] = [
			...RECT_CLOSED,
			['wall-e', 'j-e', 'j-f'],
			['wall-f', 'j-f', 'j-g'],
			['wall-g', 'j-g', 'j-h'],
			['wall-h', 'j-h', 'j-e']
		];
		const plan = planFirstEnclosureCreation({
			candidateDocument: wallFirstDocument({ junctions, walls })
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(2);
		// Canonical face-key order decides allocation order.
		const ids = plan.document.rooms.map((room) => room.id);
		expect(ids[0]!).toMatch(/^room\./);
		expect(ids[1]!).toMatch(/^room\./);
		expect([...ids].sort()).toEqual(ids);
		// Names allocate collision-free in allocation order.
		expect(plan.document.rooms.map((room) => room.name)).toEqual(['Draft Room 1', 'Draft Room 2']);
	});

	it('rejects an open chain with no enclosed face and no document', () => {
		const plan = planFirstEnclosureCreation({
			candidateDocument: wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_OPEN })
		});
		expectRejected(plan, 'no_enclosed_face');
		if (plan.kind !== 'rejected') return;
		// The dangle/cut-edge evidence names the unclosed walls.
		expect(
			plan.rejection.wallIds?.length ?? plan.rejection.topology?.length ?? 0
		).toBeGreaterThan(0);
	});

	it('rejects an empty document before extraction', () => {
		const plan = planFirstEnclosureCreation({
			candidateDocument: wallFirstDocument({ junctions: [], walls: [] })
		});
		expectRejected(plan, 'no_boundary_walls');
	});

	it('rejects a candidate that already carries rooms (zero-predecessor operation)', () => {
		const document = wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED });
		const plan = planFirstEnclosureCreation({
			candidateDocument: {
				...document,
				rooms: [
					{
						id: 'room-existing',
						name: 'Draft Room 1',
						boundary: [{ wallId: 'wall-a', direction: 'forward' }],
						floorThickness: 0.1,
						ceilingThickness: 0.1
					}
				]
			}
		});
		expectRejected(plan, 'no_enclosed_face');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.message).toContain('zero-predecessor');
	});

	it('exact undo/redo replay: re-running the planner on the baseline restores exact IDs', () => {
		const baseline = wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED });
		const plan = planFirstEnclosureCreation({ candidateDocument: baseline });
		if (plan.kind !== 'success') throw new Error('expected success');
		// Undo = restore baseline; redo = the committed snapshot. A re-run on
		// the baseline must reproduce the exact committed snapshot (allocation
		// is deterministic and never depends on wall-clock or session state).
		const rerun = planFirstEnclosureCreation({ candidateDocument: baseline });
		expect(rerun).toEqual(plan);
	});

	it('custom allocator is honored (P23.8 injection seam)', () => {
		const allocator = createAuthoringRoomAllocator();
		const seen: string[] = [];
		const plan = planFirstEnclosureCreation({
			candidateDocument: wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED }),
			allocator: {
				nextRoomId(baseDocument, faceKey) {
					seen.push(faceKey);
					return allocator.nextRoomId(baseDocument, faceKey);
				},
				nextRoomName: (names) => allocator.nextRoomName(names)
			}
		});
		expect(plan.kind).toBe('success');
		expect(seen).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// 2. Partition → boundary Room birth
// ---------------------------------------------------------------------------

describe('P23.0 stage 2 — partition → boundary Room birth', () => {
	it('flips the closed partition chain to boundary and births the Room', () => {
		const plan = planPartitionToBoundaryRoomBirth({
			candidateDocument: wallFirstDocument({
				junctions: RECT_JUNCTIONS,
				walls: RECT_CLOSED,
				role: 'partition'
			}),
			chainWallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d']
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.walls.map((wall) => wall.role)).toEqual([
			'boundary',
			'boundary',
			'boundary',
			'boundary'
		]);
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.floorThickness).toBe(0.1);
	});

	it('flips only the submitted chain, leaving other walls authored', () => {
		const document = wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED, role: 'partition' });
		// wall-e is an extra partition wall not part of the chain.
		const withExtra = {
			...document,
			walls: [
				...document.walls,
				{
					id: 'wall-e',
					startJunctionId: 'j-a',
					endJunctionId: 'j-c',
					role: 'partition' as const,
					thickness: 0.2,
					height: 3,
					centerline: { kind: 'line' } as const,
				}
			]
		};
		const plan = planPartitionToBoundaryRoomBirth({
			candidateDocument: withExtra,
			chainWallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d']
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const extra = plan.document.walls.find((wall) => wall.id === 'wall-e');
		expect(extra?.role).toBe('partition');
	});

	it('rejects unknown chain walls by ID', () => {
		const plan = planPartitionToBoundaryRoomBirth({
			candidateDocument: wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED }),
			chainWallIds: ['wall-a', 'wall-missing']
		});
		expectRejected(plan, 'no_boundary_walls');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.wallIds).toContain('wall-missing');
	});

	it('rejects an empty chain', () => {
		const plan = planPartitionToBoundaryRoomBirth({
			candidateDocument: wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED }),
			chainWallIds: []
		});
		expectRejected(plan, 'no_boundary_walls');
	});

	it('an open partition chain does not birth a Room (no enclosed face)', () => {
		const plan = planPartitionToBoundaryRoomBirth({
			candidateDocument: wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_OPEN, role: 'partition' }),
			chainWallIds: ['wall-a', 'wall-b', 'wall-c']
		});
		expectRejected(plan, 'no_enclosed_face');
	});
});

// ---------------------------------------------------------------------------
// 3. Canonical wall-first Project Save writer
// ---------------------------------------------------------------------------

function worldLocalScene(): SceneDocument {
	return {
		formatVersion: 1,
		textures: [],
		materials: [],
		entities: [],
		navigationNodes: [
			{
				id: 'node-1',
				label: 'Entrance',
				position: [1, 0, 1],
				cameraTarget: [2, 0, 2],
				fov: 60,
				connectedNodeIds: []
			}
		],
		connections: []
	};
}

function wallFirstProjectPayload() {
	return {
		id: 'project-wall-first',
		name: 'Wall First Save',
		layout: wallFirstDocument({ junctions: RECT_JUNCTIONS, walls: RECT_CLOSED }),
		scene: worldLocalScene()
	};
}

describe('P23.0 stage 2 — canonical wall-first Project Save', () => {
	it('validates and serializes the canonical wall-first payload', () => {
		const result = validateWallFirstProject(wallFirstProjectPayload());
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.project.layout.formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(result.project.scene.formatVersion).toBe(1);
		expect(result.layoutCanonicalJson).toContain(
			`"formatVersion": ${LAYOUT_WALL_FIRST_FORMAT_VERSION}`
		);
		expect(result.sceneCanonicalJson).toContain('"formatVersion": 1');
		expect(result.canonicalJson.endsWith('\n')).toBe(true);
		// The written layout document itself passes the wall-first codec.
		expect(validateWallFirstLayoutDocument(result.project.layout).success).toBe(true);
	});

	it('serializeWallFirstProject returns all three canonical strings', () => {
		const written = serializeWallFirstProject(wallFirstProjectPayload());
		expect(written.canonicalJson).toContain('"name": "Wall First Save"');
		expect(written.layoutCanonicalJson).toContain('"junctions"');
		expect(written.sceneCanonicalJson).toContain('"navigationNodes"');
	});

	it('rejects a legacy (Room-owned) layout by name — never silently migrated on Save', () => {
		const payload = { ...wallFirstProjectPayload(), layout: chopinProject.layout };
		const result = validateWallFirstProject(payload);
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.some((issue) => issue.side === 'layout')).toBe(true);
		// Missing version is never silently accepted as wall-first.
		expect(result.issues.some((issue) => issue.code === 'invalid_type')).toBe(true);
	});

	it('rejects a legacy (room-local) scene by name', () => {
		const payload = {
			...wallFirstProjectPayload(),
			scene: {
				textures: [],
				materials: [],
				entities: [],
				navigationNodes: [],
				connections: []
			}
		};
		const result = validateWallFirstProject(payload);
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.some((issue) => issue.side === 'scene')).toBe(true);
		// The legacy scene shape rejects BY NAME on the Save-side gate.
		expect(result.issues.some((issue) => issue.code === 'scene_not_world_local')).toBe(true);
	});

	it('rejects a world-local scene that still carries roomId', () => {
		const payload = {
			...wallFirstProjectPayload(),
			scene: {
				...worldLocalScene(),
				entities: [
					{
						kind: 'light',
						id: 'light-1',
						name: 'Lamp',
						roomId: 'room-x',
						light: 'point',
						color: '#ffffff',
						intensity: 1,
						position: [1, 2, 1],
						rotation: [0, 0, 0],
						scale: [1, 1, 1]
					}
				]
			}
		};
		const result = validateWallFirstProject(payload);
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.some((issue) => issue.code === 'room_id_forbidden_in_world_local')).toBe(true);
	});

	it('rejects unknown root keys, bad IDs and empty names', () => {
		const bad = {
			...wallFirstProjectPayload(),
			extra: true,
			id: 'bad id!',
			name: '   '
		};
		const result = validateWallFirstProject(bad);
		expect(result.success).toBe(false);
		if (result.success) return;
		const codes = result.issues.map((issue) => issue.code);
		expect(codes).toContain('unknown_key');
		expect(codes).toContain('invalid_id');
		expect(codes).toContain('invalid_value');
	});

	it('throws a typed error from the strict serializer', () => {
		expect(() => serializeWallFirstProject({ nope: true })).toThrow(WallFirstProjectValidationError);
	});

	it('saves round-trip through decodeProjectCompatible as wall-first', () => {
		const written = serializeWallFirstProject(wallFirstProjectPayload());
		const decoded = decodeProjectCompatible(JSON.parse(written.canonicalJson));
		expect(decoded.kind).toBe('wall-first');
		if (decoded.kind !== 'wall-first') return;
		expect(decoded.sceneSpace).toBe('project-world');
		expect(decoded.project.layout.formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(decoded.project.scene.formatVersion).toBe(1);
	});

	it('rejects a superseded layout version by name — canonical Save never migrates', () => {
		// The canonical writers are current-format strict: a payload declaring any
		// other version fails closed rather than being persisted as if it were
		// current. P23.6I recognizes exactly one wall-first version, so `4` is an
		// unsupported version (`docs/reference/north-star.md` → Development-stage schema
		// compatibility) and no read-side normalization could make it writable.
		const payload = {
			...wallFirstProjectPayload(),
			layout: { ...wallFirstProjectPayload().layout, formatVersion: 4 }
		};
		const result = validateWallFirstProject(payload);
		expect(result.success).toBe(false);
		if (result.success) return;
		const versionIssue = result.issues.find(
			(issue) => issue.code === 'unsupported_format_version'
		);
		expect(versionIssue?.side).toBe('layout');
		expect(versionIssue?.message).toContain('formatVersion 4');
		// The one recognized version is named in the same report, so the failure
		// tells the reader what *would* be accepted.
		expect(versionIssue?.message).toContain(`Recognized versions: ${LAYOUT_WALL_FIRST_FORMAT_VERSION}`);
		expect(() => serializeWallFirstProject(payload)).toThrow(WallFirstProjectValidationError);
	});
});

// ---------------------------------------------------------------------------
// 4. Portable package manifest versioning
// ---------------------------------------------------------------------------

describe('P23.0 stage 2 — package manifest format versioning', () => {
	it('writes an explicit package formatVersion on new manifests', () => {
		const manifest = buildPackageManifest({
			packageId: 'package-aabbccddeeff',
			createdAt: new Date('2026-09-09T00:00:00.000Z'),
			documentTitle: 'scene',
			textures: []
		});
		expect(manifest.package.formatVersion).toBe(PACKAGE_MANIFEST_FORMAT_VERSION);
	});

	it('keeps the package format version a separate concept from nested schema versions', () => {
		const manifest = buildPackageManifest({
			packageId: 'package-aabbccddeeff',
			createdAt: new Date('2026-09-09T00:00:00.000Z'),
			documentTitle: 'scene',
			textures: []
		});
		// Nested documents identify themselves independently; nothing here
		// dispatches on the generator string.
		expect(manifest.package.formatVersion).not.toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(manifest.package.generator).toBe('editor-5.4');
	});
});

// ---------------------------------------------------------------------------
// 5. Compat round-trips (legacy stays readable)
// ---------------------------------------------------------------------------

describe('P23.0 stage 2 — legacy compatibility round-trips', () => {
	it('the shipped legacy project still decodes as legacy-compatible', () => {
		const decoded = decodeProjectCompatible(chopinProject);
		expect(decoded.kind).toBe('legacy-compatible');
		if (decoded.kind !== 'legacy-compatible') return;
		expect(decoded.sceneSpace).toBe('legacy-room-local');
	});

	it('a legacy layout cannot be saved through the wall-first writer', () => {
		const result = validateWallFirstProject({
			id: 'project-legacy',
			name: 'Legacy',
			layout: chopinProject.layout,
			scene: chopinProject.scene
		});
		expect(result.success).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 6. F0 stage-6 flip — writes enabled (owner go-ahead 2026-09-10)
// ---------------------------------------------------------------------------

describe('P23.0 stage 6 — writer-enable flip', () => {
	it('wall-first layout mutation is adapted after the stage-6 flip', () => {
		expect(LAYOUT_MUTATION_POLICY['wall-first']).toBe('adapted');
		expect(LAYOUT_MUTATION_REASONS['wall-first']).toBeNull();
	});
});
