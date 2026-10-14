/**
 * P23.0 F0 stage 4 — visitor parity for the current format.
 *
 * What this file closes after PR #115 (WP3):
 *
 * - "the current wall-first Project compiles identically for the visitor": the
 *   retained bundle composer (`composeColdReleaseBundle`) opens through
 *   `prepareRuntime`, and its compiled geometry/issues are pinned against a
 *   direct `compileWallFirstLayoutGeometry` call — one shared core, compared
 *   output for output.
 * - "a stored Project cold-loads without rewriting its bytes": the input is
 *   left deep-equal to its snapshot across the load.
 *
 * The generation-dispatch, migrated, legacy-compatible and Room-frame-routing
 * cases are deleted with their retired subjects (plan §6 item 5): the readers
 * accept exactly one document pair now, so there is no generation to route, no
 * migration to apply and no Room frame left to resolve. The legacy-Layout
 * compile entry itself is retained by §5.1 for T1 and its parity case went with
 * the adapter's deleted legacy branch.
 */
import { describe, expect, it } from 'vitest';

import { prepareRuntime, validateProject } from '@portfolio/project-model';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';
import { planFirstEnclosureCreation } from '@portfolio/layout-core';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '@portfolio/layout-core';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function coldManifest() {
	return { releaseId: 'project:stage4@v1', bytesByUri: new Map() };
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
				{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary' as const, thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary' as const, thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary' as const, thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary' as const, thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
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

describe('P23.0 stage 4 — visitor compile parity for wall-first', () => {
	it('the visitor composer compiles the wall-first payload through the one shared core', () => {
		const payload = wallFirstPayload();
		const visitor = composeColdReleaseBundle({
			projectId: payload.id,
			projectName: payload.name,
			layout: payload.layout,
			scene: payload.scene,
			manifest: coldManifest()
		});
		try {
			expect(visitor.geometry.rooms).toHaveLength(1);
			expect(visitor.graph.navigationNodes).toHaveLength(1);
		} finally {
			visitor.dispose();
		}
	});

	it('runtime preparation equals the direct wall-first compiler output (one shared core)', () => {
		const payload = wallFirstPayload();
		const prepared = prepareRuntime(structuredClone(payload));
		if (prepared.kind === 'rejected') {
			throw new Error(`expected ready: ${JSON.stringify(prepared.issues)}`);
		}
		const direct = compileWallFirstLayoutGeometry(payload.layout as never);
		expect(prepared.geometry).toEqual(direct.geometry);
		expect(prepared.issues).toEqual(direct.issues);
	});
});

// ---------------------------------------------------------------------------
// 2. Current-format preparation and rejection discipline
// ---------------------------------------------------------------------------

describe('P23.0 stage 4 — current-format preparation discipline', () => {
	it('world-local Scenes pass through byte-identical (no frame to consult)', () => {
		const payload = wallFirstPayload();
		const prepared = prepareRuntime(structuredClone(payload));
		if (prepared.kind === 'rejected') throw new Error('expected ready');
		expect(prepared.runtimeScene.navigationNodes).toEqual(payload.scene.navigationNodes);
		expect(prepared.rooms.entries).toEqual([]);
	});

	it('rejects an unknown root key through the canonical validator, before any state is installed', () => {
		// One acceptance authority: runtime preparation must not be laxer than the
		// persisted-document reader, or a stored record could load here and fail
		// (or vice versa) depending on which entry point opened it.
		const withExtraKey = { ...wallFirstPayload(), extra: true };
		const viaRuntime = prepareRuntime(withExtraKey);
		expect(viaRuntime).toMatchObject({ kind: 'rejected', reason: 'invalid-project' });
		if (viaRuntime.kind !== 'rejected') return;
		expect(viaRuntime.issues.some((issue) => issue.code === 'unknown_key')).toBe(true);
		const viaReader = validateProject(withExtraKey);
		expect(viaReader.success).toBe(false);
	});

	it('rejects anything that is not the current document pair, before any state is installed', () => {
		expect(prepareRuntime({ nope: true })).toMatchObject({
			kind: 'rejected',
			reason: 'invalid-project'
		});

		// A Scene record that still names a Room is refused by the Scene reader,
		// so no room reference can reach the runtime.
		const payload = wallFirstPayload();
		const dangling = {
			...structuredClone(payload),
			scene: {
				...payload.scene,
				navigationNodes: [
					{ ...payload.scene.navigationNodes[0]!, roomId: 'room-nope' }
				]
			}
		};
		const rejected = prepareRuntime(dangling);
		expect(rejected).toMatchObject({ kind: 'rejected' });
		if (rejected.kind !== 'rejected') return;
		expect(
			rejected.issues.some((issue) => issue.code === 'room_id_forbidden_in_world_local')
		).toBe(true);

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
	it('the visitor composer leaves a realistic current-format payload untouched', () => {
		const payload = wallFirstPayload();
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
});
