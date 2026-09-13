/**
 * P23.0 F0 stage 4 — visitor parity + cold-load byte-identity proofs.
 *
 * F0 checklist items closed here:
 *
 * - "new wall-first Project compiles identically for editor Preview and
 *   visitor": both bundle composers (`composeDetachedPreviewBundle` for
 *   Preview, `composeColdReleaseBundle` for the visitor) now open through the
 *   one shared `prepareCompatibleRuntime` adapter, which decodes compatibly
 *   and compiles through the single shared core (`compileLayoutGeometrySource`
 *   under both the legacy and wall-first entries). The parity tests feed one
 *   wall-first payload through both composers and pin identical geometry and
 *   runtime scenes.
 * - "old active published Project cold-loads without rewriting stored
 *   bytes": canonical legacy bytes decode + prepare with the input left
 *   deep-equal to its snapshot, and re-serialization is byte-identical —
 *   at the adapter level for the checked-in legacy project and at both
 *   composer levels for a realistic legacy document.
 *
 * Legacy behavior is unchanged by construction: both composers keep the
 * legacy render-model preflight (`derivePreviewBundle`, whose wall-mesh build
 * fails closed) for `legacy-compatible` inputs, and the adapter's legacy
 * branch runs the same strict decoders plus the same scene↔room reference
 * gate `validateProject` enforced.
 */
import { describe, expect, it } from 'vitest';

import { prepareCompatibleRuntime } from '$lib/project/compat-runtime';
import {
	compileLayoutGeometry,
	compileWallFirstLayoutGeometry
} from '$lib/layout/layout-geometry';
import { derivePreviewBundle } from '$lib/editor/layout/layout-preview-state.svelte';
import {
	composeDetachedPreviewBundle,
	computeVisitorPreviewBlocker
} from '$lib/editor/preview/preview-coordinator';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { planFirstEnclosureCreation } from '$lib/layout/layout-wall-topology-ops';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-wall-first-codec';
import { chopinProject } from '$lib/content/chopin-project';
import { serializeProject } from '$lib/project/project-codec';
import type { LayoutDocument } from '$lib/layout/layout-types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const stubTextureStore = {
	has: () => false,
	getEntry: () => null
};

function coldManifest() {
	return { releaseId: 'project:stage4@v1', bytesByUri: new Map() };
}

/** One axis-aligned legacy room (cribbed from the P23.0b migration suite). */
function legacyRoom(config: {
	id: string;
	name: string;
	origin?: [number, number];
	curve?: boolean;
}): LayoutDocument['floors'][number]['rooms'][number] {
	const [minX, minZ] = [0, 0];
	const [maxX, maxZ] = [6, 4];
	const north = config.curve
		? {
				id: `${config.id}-n`,
				kind: 'auto-bezier' as const,
				start: [maxX, maxZ] as [number, number],
				end: [minX, maxZ] as [number, number],
				interiorAnchors: [{ id: `${config.id}-a1`, point: [3, 5] as [number, number] }]
			}
		: { id: `${config.id}-n`, kind: 'line' as const, start: [maxX, maxZ] as [number, number], end: [minX, maxZ] as [number, number] };
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
				north,
				{ id: `${config.id}-w`, kind: 'line', start: [minX, maxZ], end: [minX, minZ] }
			]
		},
		openings: []
	};
}

function legacyProject(config: {
	id: string;
	name: string;
	rooms: ReturnType<typeof legacyRoom>[];
	nodes?: Array<{ id: string; roomId?: string; position: [number, number, number] }>;
}) {
	return {
		id: config.id,
		name: config.name,
		layout: {
			units: 'meters' as const,
			floors: [{ id: 'floor-1', name: 'Floor 1', elevation: 0, height: 3, rooms: config.rooms }],
			objects: []
		},
		scene: {
			textures: [],
			materials: [],
			entities: [],
			navigationNodes: (config.nodes ?? []).map((node) => ({
				id: node.id,
				label: node.id,
				...(node.roomId ? { roomId: node.roomId } : {}),
				position: node.position,
				cameraTarget: [node.position[0] + 1, node.position[1], node.position[2]] as [number, number, number],
				fov: 60,
				connectedNodeIds: []
			})),
			connections: []
		}
	};
}

/** Wall-first payload born through the stage-2 writer (rect + door + node). */
function wallFirstPayload() {
	const birth = planFirstEnclosureCreation({
		candidateDocument: {
			units: 'meters' as const,
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [
				{ id: 'j-a', point: [0, 0] as [number, number] },
				{ id: 'j-b', point: [6, 0] as [number, number] },
				{ id: 'j-c', point: [6, 4] as [number, number] },
				{ id: 'j-d', point: [0, 4] as [number, number] }
			],
			walls: [
				{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary' as const, thickness: 0.2, height: 3 },
				{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary' as const, thickness: 0.2, height: 3 },
				{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary' as const, thickness: 0.2, height: 3 },
				{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary' as const, thickness: 0.2, height: 3 }
			],
			rooms: [],
			openings: [
				{ id: 'door-1', wallId: 'wall-a', kind: 'door' as const, offset: 1, width: 0.9, height: 2.1, sillHeight: 0, profile: 'rectangular' as const }
			],
			objects: []
		}
	});
	if (birth.kind !== 'success') throw new Error('birth fixture failed');
	return {
		id: 'project-wall-first-parity',
		name: 'Wall First Parity',
		layout: birth.document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [],
			navigationNodes: [
				{
					id: 'node-1',
					label: 'Entrance',
					position: [1, 0, 1] as [number, number, number],
					cameraTarget: [2, 0, 2] as [number, number, number],
					fov: 60,
					connectedNodeIds: []
				}
			],
			connections: []
		}
	};
}

// ---------------------------------------------------------------------------
// 1. Compile parity — one wall-first Project, both consumers
// ---------------------------------------------------------------------------

describe('P23.0 stage 4 — Preview/visitor compile parity for wall-first', () => {
	it('one wall-first payload compiles identically through the Preview and visitor composers', () => {
		const payload = wallFirstPayload();
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
			manifest: coldManifest()
		});
		try {
			expect(visitor.geometry).toEqual(preview.geometry);
			expect(visitor.scene).toEqual(preview.scene);
			expect(visitor.geometry.rooms).toHaveLength(1);
			expect(visitor.graph.navigationNodes).toHaveLength(1);
		} finally {
			preview.textures.dispose();
			visitor.dispose();
		}
	});

	it('adapter geometry equals the direct wall-first compiler output (one shared core)', () => {
		const payload = wallFirstPayload();
		const prepared = prepareCompatibleRuntime(structuredClone(payload));
		if (prepared.kind !== 'rejected') {
			expect(prepared.decodeKind).toBe('wall-first');
			expect(prepared.sceneSpace).toBe('project-world');
			const direct = compileWallFirstLayoutGeometry(payload.layout as never);
			expect(prepared.geometry).toEqual(direct.geometry);
			expect(prepared.issues).toEqual(direct.issues);
			return;
		}
		throw new Error(`expected ready: ${JSON.stringify(prepared.issues)}`);
	});

	it('legacy geometry is unchanged: adapter equals the direct legacy compile and the render-model bundle', () => {
		const payload = legacyProject({
			id: 'project-legacy-parity',
			name: 'Legacy Parity',
			rooms: [legacyRoom({ id: 'room-a', name: 'A' })]
		});
		const prepared = prepareCompatibleRuntime(structuredClone(payload));
		if (prepared.kind === 'rejected') throw new Error('expected ready');
		expect(prepared.decodeKind).toBe('migrated');
		// The migrated wall-first geometry matches a direct compile of the
		// migrated layout through the same shared core.
		const direct = compileWallFirstLayoutGeometry(prepared.project.layout as never);
		expect(prepared.geometry).toEqual(direct.geometry);
		// And the legacy render-model entry still compiles the source layout.
		const legacyDirect = compileLayoutGeometry(payload.layout as never);
		expect(legacyDirect.geometry.rooms).toHaveLength(1);
		const bundle = derivePreviewBundle(payload.id, payload.name, payload.layout, payload.scene as never);
		expect(bundle.geometry).toEqual(legacyDirect.geometry);
	});

	it('the Preview entry gate passes a wall-first payload with no retained bytes', () => {
		const payload = wallFirstPayload();
		const reason = computeVisitorPreviewBlocker({
			scene: payload.scene as never,
			layout: payload.layout as never,
			projectId: payload.id,
			projectName: payload.name,
			conditions: {
				interactionActive: false,
				documentTransactionActive: false,
				projectMutationInFlight: false,
				projectAssetMutationInFlight: false,
				pendingPlacementActive: false,
				bootstrapBusy: false,
				pendingSaveHandoff: false
			},
			textureStore: stubTextureStore
		});
		expect(reason).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// 2. Runtime preparation routing + exactly-once Room-frame resolution
// ---------------------------------------------------------------------------

describe('P23.0 stage 4 — preparation routing and Room-frame discipline', () => {
	it('routes every generation explicitly (migrated / legacy-compatible / wall-first)', () => {
		const migrated = prepareCompatibleRuntime(
			legacyProject({ id: 'p-mig', name: 'Mig', rooms: [legacyRoom({ id: 'room-a', name: 'A' })] })
		);
		if (migrated.kind === 'rejected') throw new Error('expected migrated');
		expect(migrated.decodeKind).toBe('migrated');
		expect(migrated.sceneSpace).toBe('project-world');

		const compat = prepareCompatibleRuntime(
			legacyProject({ id: 'p-com', name: 'Com', rooms: [legacyRoom({ id: 'room-a', name: 'A', curve: true })] })
		);
		if (compat.kind === 'rejected') throw new Error('expected legacy-compatible');
		expect(compat.decodeKind).toBe('legacy-compatible');
		expect(compat.sceneSpace).toBe('legacy-room-local');
		expect(compat.report!.issues.length).toBeGreaterThan(0);

		const wallFirst = prepareCompatibleRuntime(wallFirstPayload());
		if (wallFirst.kind === 'rejected') throw new Error('expected wall-first');
		expect(wallFirst.decodeKind).toBe('wall-first');
		expect(wallFirst.sceneSpace).toBe('project-world');
	});

	it('legacy-compatible Scenes resolve through Room frames exactly once', () => {
		const local: [number, number, number] = [1, 2, 3];
		const payload = legacyProject({
			id: 'project-resolve-once',
			name: 'Resolve Once',
			rooms: [legacyRoom({ id: 'room-a', name: 'A', origin: [10, 5], curve: true })],
			nodes: [{ id: 'node-1', roomId: 'room-a', position: local }]
		});
		const prepared = prepareCompatibleRuntime(structuredClone(payload));
		if (prepared.kind === 'rejected') throw new Error('expected ready');
		expect(prepared.decodeKind).toBe('legacy-compatible');

		const rooms = createLayoutRoomRegistry(payload.layout as never);
		const once = rooms.point('room-a', local);
		// Resolution happened (not the raw local value) exactly once (not doubled).
		expect(prepared.runtimeScene.navigationNodes[0]!.position).toEqual(once);
		expect(once).not.toEqual(local);
		expect(prepared.runtimeScene.navigationNodes[0]!.position).not.toEqual(rooms.point('room-a', once));
	});

	it('migrated Scenes arrive world-local with no second transform', () => {
		const local: [number, number, number] = [1, 2, 3];
		const payload = legacyProject({
			id: 'project-migrated-once',
			name: 'Migrated Once',
			rooms: [legacyRoom({ id: 'room-a', name: 'A', origin: [10, 5] })],
			nodes: [{ id: 'node-1', roomId: 'room-a', position: local }]
		});
		const prepared = prepareCompatibleRuntime(structuredClone(payload));
		if (prepared.kind === 'rejected') throw new Error('expected ready');
		expect(prepared.decodeKind).toBe('migrated');
		const rooms = createLayoutRoomRegistry(payload.layout as never);
		expect(prepared.runtimeScene.navigationNodes[0]!.position).toEqual(rooms.point('room-a', local));
	});

	it('world-local Scenes pass through byte-identical (no frame to consult)', () => {
		const payload = wallFirstPayload();
		const prepared = prepareCompatibleRuntime(structuredClone(payload));
		if (prepared.kind === 'rejected') throw new Error('expected ready');
		expect(prepared.runtimeScene.navigationNodes).toEqual(payload.scene.navigationNodes);
		expect(prepared.rooms.entries).toEqual([]);
	});

	it('rejects unrecognized payloads and dangling room references by name', () => {
		expect(prepareCompatibleRuntime({ nope: true })).toMatchObject({
			kind: 'rejected',
			reason: 'unrecognized'
		});
		const dangling = prepareCompatibleRuntime(
			legacyProject({
				id: 'project-dangling',
				name: 'Dangling',
				rooms: [legacyRoom({ id: 'room-a', name: 'A' })],
				nodes: [{ id: 'node-1', roomId: 'room-nope', position: [1, 2, 3] }]
			})
		);
		expect(dangling).toMatchObject({ kind: 'rejected', reason: 'invalid-references' });
		if (dangling.kind !== 'rejected') return;
		expect(dangling.issues.some((issue) => issue.code === 'unknown_room')).toBe(true);

		expect(() =>
			composeColdReleaseBundle({
				projectId: 'project-dangling',
				projectName: 'Dangling',
				layout: { nope: true },
				scene: {},
				manifest: coldManifest()
			})
		).toThrow();
	});
});

// ---------------------------------------------------------------------------
// 3. Cold-load byte-identity — stored bytes are never rewritten on load
// ---------------------------------------------------------------------------

describe('P23.0 stage 4 — cold-load byte-identity (no stored-byte rewrites)', () => {
	it('the checked-in legacy project prepares without mutating its stored bytes', () => {
		const canonicalBytes = serializeProject(chopinProject);
		const parsed: unknown = JSON.parse(canonicalBytes);
		const snapshot = structuredClone(parsed);
		const prepared = prepareCompatibleRuntime(parsed);
		if (prepared.kind === 'rejected') throw new Error('expected ready');
		expect(prepared.decodeKind).toBe('legacy-compatible');
		// The load rewrote nothing: input deep-equals its pre-load snapshot…
		expect(parsed).toEqual(snapshot);
		// …and re-serialization is byte-identical to the stored bytes.
		expect(serializeProject(parsed)).toBe(canonicalBytes);
	});

	it('the visitor composer leaves a realistic legacy payload untouched', () => {
		const payload = legacyProject({
			id: 'project-cold-bytes',
			name: 'Cold Bytes',
			rooms: [legacyRoom({ id: 'room-a', name: 'A' })],
			nodes: [{ id: 'node-1', roomId: 'room-a', position: [1, 2, 3] }]
		});
		const snapshot = structuredClone(payload);
		const bundle = composeColdReleaseBundle({
			projectId: payload.id,
			projectName: payload.name,
			layout: payload.layout,
			scene: payload.scene,
			manifest: coldManifest()
		});
		try {
			expect(bundle.geometry.rooms).toHaveLength(1);
			expect(payload).toEqual(snapshot);
		} finally {
			bundle.dispose();
		}
	});

	it('the Preview composer leaves a realistic legacy payload untouched', () => {
		const payload = legacyProject({
			id: 'project-preview-bytes',
			name: 'Preview Bytes',
			rooms: [legacyRoom({ id: 'room-a', name: 'A' })],
			nodes: [{ id: 'node-1', roomId: 'room-a', position: [1, 2, 3] }]
		});
		const snapshot = structuredClone(payload);
		const bundle = composeDetachedPreviewBundle({
			scene: payload.scene as never,
			layout: payload.layout as never,
			projectId: payload.id,
			projectName: payload.name,
			textureStore: stubTextureStore
		});
		try {
			expect(bundle.geometry.rooms).toHaveLength(1);
			expect(payload).toEqual(snapshot);
		} finally {
			bundle.textures.dispose();
		}
	});
});

// ---------------------------------------------------------------------------
// 4. F0 review — legacy composer-vs-composer parity + true-compat identity
// ---------------------------------------------------------------------------

describe('P23.0 stage 4 — legacy composer parity on a true compat shape (F0 review)', () => {
	/** Curved boundary keeps migration rejected: genuinely legacy-compatible. */
	function compatPayload() {
		const room = legacyRoom({ id: 'room-a', name: 'A', origin: [10, 5], curve: true });
		return legacyProject({
			id: 'project-compat-parity',
			name: 'Compat Parity',
			rooms: [room],
			nodes: [{ id: 'node-1', roomId: 'room-a', position: [1, 2, 3] }]
		});
	}

	it('both composers agree on a true legacy-compatible payload', () => {
		const payload = compatPayload();
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
			manifest: coldManifest()
		});
		try {
			// Preview returns the render-model geometry, the visitor the
			// adapter geometry — both compile the same decoded legacy layout
			// through the shared core, so they must agree.
			expect(visitor.geometry).toEqual(preview.geometry);
			expect(visitor.scene).toEqual(preview.scene);
		} finally {
			preview.textures.dispose();
			visitor.dispose();
		}
	});

	it('a true legacy-compatible payload serializes identically across the load', () => {
		const payload = compatPayload();
		const canonicalBytes = serializeProject(payload);
		const parsed: unknown = JSON.parse(canonicalBytes);
		const snapshot = structuredClone(parsed);
		const prepared = prepareCompatibleRuntime(parsed);
		if (prepared.kind === 'rejected') throw new Error('expected ready');
		expect(prepared.decodeKind).toBe('legacy-compatible');
		expect(parsed).toEqual(snapshot);
		expect(serializeProject(parsed)).toBe(canonicalBytes);
	});
});
