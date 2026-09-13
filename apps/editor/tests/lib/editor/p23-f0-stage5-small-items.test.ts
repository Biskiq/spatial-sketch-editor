/**
 * P23.0 F0 stage 5 — named small items.
 *
 * 1. Standalone Scene import (`importStandaloneSceneDocument`): world-local
 *    parses directly; legacy room-local + explicit user frame mapping converts
 *    once; legacy without a mapping rejects with the dedicated
 *    `missing_legacy_room_frame_context` diagnostic (never guessed, never
 *    identity-filled). The current legacy session keeps its own direct legacy
 *    install path (a legacy scene is native there); this import targets
 *    world-local installs, so no menu behavior changes pre-F0.
 * 2. Portal Save-blocker: legacy nonadjacent relations stay
 *    compatibility-readable (verbatim + migration diagnostic) but
 *    `validateWallFirstProject` rejects them fail-closed under the strict
 *    P23.3 adjacency contract (door-only, distinct rooms, exactly the two
 *    rooms adjacent to the hosting boundary wall).
 * 3. No-second-transform regression at the museum/visitor seams: world-local
 *    records pass through `resolveSceneDocument` (the exact seam the museum
 *    relic and both composers share) unchanged even against a
 *    frame-carrying registry, end-to-end through the Preview and visitor
 *    composers on the adversarial legacy-layout + world-scene pairing.
 */
import { describe, expect, it } from 'vitest';

import {
	importStandaloneSceneDocument,
	collectLegacySceneRoomIds
} from '@portfolio/project-model';
import {
	validateWallFirstPortalRelations,
	type WallFirstPortalIssue
} from '$lib/layout/layout-portals';
import { planFirstEnclosureCreation, type LayoutDocumentWallFirst } from '$lib/layout/layout-wall-topology-ops';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-wall-first-codec';
import {
	validateWallFirstProject,
	serializeWallFirstProject
} from '@portfolio/project-model';
import { decodeProjectCompatible } from '$lib/content/scene-format';
import { resolveSceneDocument } from '$lib/content/scene';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { composeDetachedPreviewBundle } from '$lib/editor/preview/preview-coordinator';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';
import type { LayoutDocument } from '$lib/layout/layout-types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const stubTextureStore = {
	has: () => false,
	getEntry: () => null
};

function legacyRoom(config: {
	id: string;
	name: string;
	min?: [number, number];
	max?: [number, number];
	origin?: [number, number];
	openings?: LayoutDocument['floors'][number]['rooms'][number]['openings'];
}): LayoutDocument['floors'][number]['rooms'][number] {
	const [minX, minZ] = config.min ?? [0, 0];
	const [maxX, maxZ] = config.max ?? [6, 4];
	return {
		id: config.id,
		name: config.name,
		frame: { origin: config.origin ?? [0, 0], yaw: 0 },
		wallThickness: 0.2,
		floorThickness: 0.1,
		ceilingThickness: 0.1,
		boundary: {
			closed: true,
			segments: [
				{ id: `${config.id}-s`, kind: 'line', start: [minX, minZ], end: [maxX, minZ] },
				{ id: `${config.id}-e`, kind: 'line', start: [maxX, minZ], end: [maxX, maxZ] },
				{ id: `${config.id}-n`, kind: 'line', start: [maxX, maxZ], end: [minX, maxZ] },
				{ id: `${config.id}-w`, kind: 'line', start: [minX, maxZ], end: [minX, minZ] }
			]
		},
		openings: config.openings ?? []
	};
}

function legacyScene(nodes: Array<{ id: string; roomId?: string; position: [number, number, number]; adjacent?: string[] }>) {
	return {
		textures: [],
		materials: [],
		entities: [],
		navigationNodes: nodes.map((node) => ({
			id: node.id,
			label: node.id,
			...(node.roomId ? { roomId: node.roomId } : {}),
			position: node.position,
			cameraTarget: [node.position[0] + 1, node.position[1], node.position[2]] as [number, number, number],
			fov: 60,
			connectedNodeIds: node.adjacent ?? []
		})),
		connections: []
	};
}

function worldScene(nodes: Array<{ id: string; position: [number, number, number]; adjacent?: string[] }>) {
	return {
		formatVersion: 1,
		...legacyScene(nodes.map((node) => ({ id: node.id, position: node.position, ...(node.adjacent ? { adjacent: node.adjacent } : {}) })))
	};
}

/** Two-room wall-first birth sharing wall-e (6x4 rect split at x=3). */
function sharedWallBirth(): LayoutDocumentWallFirst {
	const birth = planFirstEnclosureCreation({
		candidateDocument: {
			units: 'meters' as const,
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [
				{ id: 'j-a', point: [0, 0] as [number, number] },
				{ id: 'j-m', point: [3, 0] as [number, number] },
				{ id: 'j-b', point: [6, 0] as [number, number] },
				{ id: 'j-c', point: [6, 4] as [number, number] },
				{ id: 'j-n', point: [3, 4] as [number, number] },
				{ id: 'j-d', point: [0, 4] as [number, number] }
			],
			walls: [
				{ id: 'wall-a1', startJunctionId: 'j-a', endJunctionId: 'j-m', role: 'boundary' as const, thickness: 0.2, height: 3 },
				{ id: 'wall-a2', startJunctionId: 'j-m', endJunctionId: 'j-b', role: 'boundary' as const, thickness: 0.2, height: 3 },
				{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary' as const, thickness: 0.2, height: 3 },
				{ id: 'wall-c1', startJunctionId: 'j-c', endJunctionId: 'j-n', role: 'boundary' as const, thickness: 0.2, height: 3 },
				{ id: 'wall-c2', startJunctionId: 'j-n', endJunctionId: 'j-d', role: 'boundary' as const, thickness: 0.2, height: 3 },
				{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary' as const, thickness: 0.2, height: 3 },
				{ id: 'wall-e', startJunctionId: 'j-m', endJunctionId: 'j-n', role: 'boundary' as const, thickness: 0.2, height: 3 }
			],
			rooms: [],
			openings: [],
			objects: []
		}
	});
	if (birth.kind !== 'success') throw new Error('birth fixture failed');
	return birth.document;
}

function doorOn(
	layout: LayoutDocumentWallFirst,
	opening: { id: string; wallId: string; kind?: 'door' | 'window'; offset?: number; connectsRoomIds?: [string, string] }
): LayoutDocumentWallFirst {
	return {
		...layout,
		openings: [
			{
				id: opening.id,
				wallId: opening.wallId,
				kind: opening.kind ?? 'door',
				offset: opening.offset ?? 1,
				width: 0.9,
				height: 2.1,
				sillHeight: 0,
				profile: 'rectangular' as const,
				...(opening.connectsRoomIds ? { connectsRoomIds: opening.connectsRoomIds } : {})
			}
		]
	};
}

function savePayload(layout: LayoutDocumentWallFirst) {
	return {
		id: 'project-portal-save',
		name: 'Portal Save',
		layout,
		scene: worldScene([{ id: 'node-1', position: [1, 0, 1] }])
	};
}

// ---------------------------------------------------------------------------
// 1. Standalone Scene import
// ---------------------------------------------------------------------------

describe('P23.0 stage 5 — standalone Scene import with frame provenance', () => {
	const legacyNodes = [{ id: 'node-1', roomId: 'room-a', position: [1, 2, 3] as [number, number, number] }];

	it('parses a world-local Scene directly with no mapping', () => {
		const scene = worldScene([{ id: 'node-1', position: [1, 0, 1] }]);
		const imported = importStandaloneSceneDocument(structuredClone(scene));
		expect(imported.kind).toBe('ready');
		if (imported.kind !== 'ready') return;
		expect(imported.scene).toEqual({ ...scene });
		expect(imported.sceneSpace).toBe('project-world');
		expect(imported.mappingRooms).toEqual([]);
		// An unneeded mapping is ignored, not rejected.
		expect(importStandaloneSceneDocument(structuredClone(scene), { 'room-a': { origin: [0, 0], yaw: 0, floorElevation: 0 } }).kind).toBe('ready');
	});

	it('converts a legacy Scene once through an explicit frame mapping', () => {
		const scene = legacyScene(legacyNodes);
		const imported = importStandaloneSceneDocument(structuredClone(scene), {
			'room-a': { origin: [10, 5], yaw: 0, floorElevation: 0 }
		});
		expect(imported.kind).toBe('ready');
		if (imported.kind !== 'ready') return;
		expect(imported.sceneSpace).toBe('project-world');
		expect(imported.mappingRooms).toEqual(['room-a']);
		const node = imported.scene.navigationNodes[0]!;
		// Converted exactly once through the supplied frame…
		expect(node.position).toEqual([11, 2, 8]);
		expect(node.cameraTarget).toEqual([12, 2, 8]);
		// …and stripped of room ownership.
		expect('roomId' in node).toBe(false);
		expect(imported.scene.formatVersion).toBe(1);
	});

	it('rejects a legacy Scene without a mapping by name (never guesses)', () => {
		const snapshot = legacyScene(legacyNodes);
		const imported = importStandaloneSceneDocument(structuredClone(snapshot));
		expect(imported).toMatchObject({ kind: 'rejected', reason: 'missing-frame-mapping' });
		if (imported.kind !== 'rejected') return;
		expect(imported.issues.some((issue) => issue.code === 'missing_legacy_room_frame_context')).toBe(true);
	});

	it('rejects an incomplete mapping naming the missing rooms (never identity-fills)', () => {
		const scene = legacyScene([
			...legacyNodes,
			{ id: 'node-2', roomId: 'room-b', position: [4, 2, 3] as [number, number, number] }
		]);
		const imported = importStandaloneSceneDocument(structuredClone(scene), {
			'room-a': { origin: [10, 5], yaw: 0, floorElevation: 0 }
		});
		expect(imported).toMatchObject({ kind: 'rejected', reason: 'incomplete-frame-mapping' });
		if (imported.kind !== 'rejected') return;
		expect(imported.issues[0]!.code).toBe('incomplete_frame_mapping');
		expect(imported.issues[0]!.message).toContain('room-b');
	});

	it('rejects an invalid mapping (non-finite frame values)', () => {
		const imported = importStandaloneSceneDocument(legacyScene(legacyNodes), {
			'room-a': { origin: [Number.NaN, 5], yaw: 0, floorElevation: 0 }
		});
		expect(imported).toMatchObject({ kind: 'rejected', reason: 'invalid-frame-mapping' });
	});

	it('rejects unrecognized payloads with the codec issues', () => {
		const imported = importStandaloneSceneDocument({ nope: true });
		expect(imported).toMatchObject({ kind: 'rejected', reason: 'unrecognized' });
	});

	it('collects every referenced room and never mutates its input', () => {
		const scene = legacyScene(legacyNodes);
		expect(collectLegacySceneRoomIds(scene as never)).toEqual(['room-a']);
		const snapshot = structuredClone(scene);
		importStandaloneSceneDocument(scene, { 'room-a': { origin: [0, 0], yaw: 0, floorElevation: 0 } });
		expect(scene).toEqual(snapshot);
	});
});

// ---------------------------------------------------------------------------
// 2. Portal Save-blocker
// ---------------------------------------------------------------------------

describe('P23.0 stage 5 — portal-relation Save-blocker', () => {
	it('a valid adjacent pair on the shared wall passes Save', () => {
		const born = sharedWallBirth();
		const [leftId, rightId] = born.rooms.map((room) => room.id);
		const payload = savePayload(doorOn(born, { id: 'door-bridge', wallId: 'wall-e', connectsRoomIds: [leftId!, rightId!] }));
		expect(validateWallFirstPortalRelations(payload.layout)).toEqual([]);
		const result = validateWallFirstProject(payload);
		expect(result.success).toBe(true);
		// Serialization round-trips the relation for the valid pair.
		const written = serializeWallFirstProject(payload);
		const decoded = decodeProjectCompatible(JSON.parse(written.canonicalJson));
		expect(decoded.kind).toBe('wall-first');
	});

	it('a perimeter-hosted relation naming both rooms blocks Save by name', () => {
		const born = sharedWallBirth();
		const [leftId, rightId] = born.rooms.map((room) => room.id);
		// wall-a1 is a perimeter wall (one adjacent room); relating both born
		// rooms through it is the legacy nonadjacent shape.
		const payload = savePayload(doorOn(born, { id: 'door-outer', wallId: 'wall-a1', connectsRoomIds: [leftId!, rightId!] }));
		const result = validateWallFirstProject(payload);
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.issues.some((issue) => issue.code === 'nonadjacent_portal_relation')).toBe(true);
		expect(result.issues.every((issue) => issue.side === 'layout')).toBe(true);
	});

	it('window relations block Save at the codec gate (door-only rule)', () => {
		const born = sharedWallBirth();
		const [leftId, rightId] = born.rooms.map((room) => room.id);
		// Rule 1 lives in the wall-first codec, ahead of the adjacency gate:
		// a window relation can never reach Save validation.
		const win = validateWallFirstProject(
			savePayload(doorOn(born, { id: 'win-bridge', wallId: 'wall-e', kind: 'window', connectsRoomIds: [leftId!, rightId!] }))
		);
		expect(win.success).toBe(false);
		if (!win.success) {
			expect(win.issues.some((issue) => issue.code === 'invalid_value')).toBe(true);
		}
	});

	it('self-pairs block Save at the codec gate (distinct-rooms rule)', () => {
		const born = sharedWallBirth();
		const [leftId] = born.rooms.map((room) => room.id);
		const self = validateWallFirstProject(
			savePayload(doorOn(born, { id: 'door-self', wallId: 'wall-e', connectsRoomIds: [leftId!, leftId!] }))
		);
		expect(self.success).toBe(false);
		if (!self.success) {
			expect(self.issues.some((issue) => issue.code === 'invalid_value')).toBe(true);
		}
	});

	it('a legacy nonadjacent relation stays readable and diagnosed, then blocks Save', () => {
		// Two independent rooms; the door on rect 1 names room-2, which shares
		// no wall with the host — the classic legacy nonadjacent shape.
		const payload = {
			id: 'project-legacy-portal',
			name: 'Legacy Portal',
			layout: {
				units: 'meters' as const,
				floors: [
					{
						id: 'floor-1',
						name: 'Floor 1',
						elevation: 0,
						height: 3,
						rooms: [
							legacyRoom({
								id: 'room-1',
								name: 'One',
								openings: [
									{ id: 'door-far', segmentId: 'room-1-s', kind: 'door' as const, offset: 1, width: 0.9, height: 2.1, sillHeight: 0, profile: 'rectangular' as const, connectsRoomIds: ['room-1', 'room-2'] as [string, string] }
								]
							}),
							legacyRoom({ id: 'room-2', name: 'Two', min: [20, 0], max: [26, 4] })
						]
					}
				],
				objects: []
			},
			scene: legacyScene([])
		};
		const decoded = decodeProjectCompatible(structuredClone(payload));
		expect(decoded.kind).toBe('migrated');
		if (decoded.kind !== 'migrated') return;
		// Readable: the relation migrates verbatim, never silently cleared
		// (migration namespaces authored IDs — match the carried relation)…
		const door = decoded.project.layout.openings.find((opening) => opening.connectsRoomIds)!;
		expect(door.connectsRoomIds).toEqual(['room-1', 'room-2']);
		// …diagnosed in the migration report…
		expect(
			decoded.report.layout!.diagnostics.some((issue) => issue.code === 'nonadjacent_portal_relation')
		).toBe(true);
		// …and blocking new-schema Save until resolved.
		const save = validateWallFirstProject({ ...decoded.project, scene: worldScene([]) });
		expect(save.success).toBe(false);
		if (!save.success) {
			expect(save.issues.some((issue) => issue.code === 'nonadjacent_portal_relation')).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// 3. No-second-transform regression at the museum/visitor seams
// ---------------------------------------------------------------------------

describe('P23.0 stage 5 — no second Room transform at the museum/visitor seams', () => {
	// Adversarial pairing: a legacy Layout with nonzero Room frames alongside
	// a world-local Scene. Migration must fail (curved boundary keeps it on
	// the compat path) so a frame-carrying registry meets room-less records.
	function adversarialPayload() {
		const room = legacyRoom({ id: 'room-a', name: 'A', origin: [10, 5] });
		room.boundary.segments[2] = {
			id: 'room-a-n',
			kind: 'auto-bezier',
			start: [6, 4],
			end: [0, 4],
			interiorAnchors: [{ id: 'room-a-a1', point: [3, 5] }]
		};
		// A connection requires mutual adjacency claims.
		const scene = worldScene([
			{ id: 'node-1', position: [1, 2, 3], adjacent: ['node-2'] },
			{ id: 'node-2', position: [7, 2, 3], adjacent: ['node-1'] }
		]);
		return {
			id: 'project-adversarial',
			name: 'Adversarial',
			layout: {
				units: 'meters' as const,
				floors: [{ id: 'floor-1', name: 'Floor 1', elevation: 0, height: 3, rooms: [room] }],
				objects: []
			},
			scene: {
				...scene,
				// Every connection-scoped record shape, all room-less: a
				// second transform has nowhere to hide.
				connections: [
					{
						id: 'conn-1',
						fromNodeId: 'node-1',
						toNodeId: 'node-2',
						clearance: 1,
						positionPath: {
							kind: 'rounded-polyline',
							anchors: [{ id: 'anchor-1', position: [2, 0, 2] }]
						},
						targetWaypoints: [{ position: [3, 0, 3] }],
						viewTracks: {
							forward: [{ id: 'key-f', progress: 0.5, cameraTarget: [4, 0, 4], fov: 60 }],
							reverse: [{ id: 'key-r', progress: 0.5, cameraTarget: [4, 0, 4], fov: 60 }]
						}
					}
				]
			}
		};
	}

	function expectConnectionPassthrough(scene: { connections: Array<{ positionPath: { anchors: Array<{ id: string; position: [number, number, number] }> }; targetWaypoints?: Array<[number, number, number]>; viewTracks?: { forward: Array<{ cameraTarget: [number, number, number] }>; reverse: Array<{ cameraTarget: [number, number, number] }> } }> }) {
		const connection = scene.connections[0]!;
		// Interior records survive between the derived node endpoints
		// (resolve prepends/appends endpoint positions/targets; runtime
		// waypoints are bare Vec3s).
		expect(connection.positionPath.anchors.find((anchor) => anchor.id === 'anchor-1')!.position).toEqual([2, 0, 2]);
		expect(connection.positionPath.anchors[0]!.position).toEqual([1, 2, 3]);
		expect(connection.targetWaypoints).toEqual([
			[2, 2, 3],
			[3, 0, 3],
			[8, 2, 3]
		]);
		expect(connection.viewTracks!.forward[0]!.cameraTarget).toEqual([4, 0, 4]);
		expect(connection.viewTracks!.reverse[0]!.cameraTarget).toEqual([4, 0, 4]);
	}

	it('resolveSceneDocument passes world records through a frame-carrying registry untouched', () => {
		const payload = adversarialPayload();
		const rooms = createLayoutRoomRegistry(payload.layout as never);
		expect(rooms.entries).toHaveLength(1);
		// The registry WOULD shift room-local values (frames are nonzero)…
		expect(rooms.point('room-a', [1, 2, 3])).not.toEqual([1, 2, 3]);
		// …but room-less world records never consult it (museum seam shape).
		const resolved = resolveSceneDocument(payload.scene, rooms);
		expect(resolved.navigationNodes[0]!.position).toEqual([1, 2, 3]);
		expect(resolved.navigationNodes[0]!.cameraTarget).toEqual([2, 2, 3]);
		expectConnectionPassthrough(resolved);
	});

	it('the adversarial pairing prepares legacy-compatible/project-world with passthrough', () => {
		const payload = adversarialPayload();
		const decoded = decodeProjectCompatible(structuredClone(payload));
		expect(decoded.kind).toBe('legacy-compatible');
		if (decoded.kind !== 'legacy-compatible') return;
		expect(decoded.sceneSpace).toBe('project-world');
	});

	it('both composers preserve world positions end-to-end on the adversarial pairing', () => {
		const payload = adversarialPayload();
		const preview = composeDetachedPreviewBundle({
			scene: payload.scene as never,
			layout: payload.layout as never,
			projectId: payload.id,
			projectName: payload.name,
			textureStore: stubTextureStore
		});
		const visitor = composeColdReleaseBundle({
			projectId: payload.id,
			projectName: payload.name,
			layout: payload.layout,
			scene: payload.scene,
			manifest: { releaseId: `${payload.id}@v1`, bytesByUri: new Map() }
		});
		try {
			for (const bundle of [preview, visitor]) {
				expect(bundle.scene.navigationNodes[0]!.position).toEqual([1, 2, 3]);
				expect(bundle.scene.navigationNodes[0]!.cameraTarget).toEqual([2, 2, 3]);
				expectConnectionPassthrough(bundle.scene);
			}
			expect(visitor.geometry).toEqual(preview.geometry);
		} finally {
			preview.textures.dispose();
			visitor.dispose();
		}
	});
});
