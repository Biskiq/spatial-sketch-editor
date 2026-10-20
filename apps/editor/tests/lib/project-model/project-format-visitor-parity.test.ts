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

import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { validateProjectEnvelope } from '@portfolio/project-model/units';
import { prepareUnitRuntime } from '@portfolio/project-model/units';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';
import { planFirstEnclosureCreation } from '@portfolio/layout-core';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '@portfolio/layout-core';
import { createUnitProject } from '../authoring/__fixtures__/unit-envelope-fixtures';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function coldManifest() {
	return { releaseId: 'project:stage4@v1', bytesByUri: new Map() };
}

/** The one envelope every case opens: a wall-first enclosure plus one Camera view. */
async function wallFirstPayload() {
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
	return createUnitProject({
		id: 'project-wall-first-parity',
		name: 'Wall First Parity',
		layout: birth.document,
		camera: {
			formatVersion: 1,
			views: [
				{
					id: 'node-1',
					label: 'Entrance',
					eye: [1, 0, 1],
					target: [2, 0, 2],
					fov: 60,
					connectedViewIds: []
				}
			],
			connections: []
		}
	});
}

// ---------------------------------------------------------------------------
// 1. Compile parity — one wall-first Project, both consumers
// ---------------------------------------------------------------------------

describe('P23.0 stage 4 — visitor compile parity for wall-first', () => {
	it('the visitor composer compiles the wall-first payload through the one shared core', async () => {
		const payload = await wallFirstPayload();
		const visitor = composeColdReleaseBundle({ document: payload, manifest: coldManifest() });
		try {
			expect(visitor.geometry.rooms).toHaveLength(1);
			expect(visitor.graph.navigationNodes).toHaveLength(1);
		} finally {
			visitor.dispose();
		}
	});

	it('runtime preparation equals the direct wall-first compiler output (one shared core)', async () => {
		const payload = await wallFirstPayload();
		const prepared = prepareUnitRuntime(structuredClone(payload));
		if (prepared.kind === 'rejected') {
			throw new Error(`expected ready: ${JSON.stringify(prepared.issues)}`);
		}
		const direct = compileWallFirstLayoutGeometry(payload.units.layout.data);
		expect(prepared.geometry).toEqual(direct.geometry);
		expect(prepared.issues).toEqual(direct.issues);
	});
});

// ---------------------------------------------------------------------------
// 2. Current-format preparation and rejection discipline
// ---------------------------------------------------------------------------

describe('P23.0 stage 4 — current-format preparation discipline', () => {
	it('the Camera unit supplies the navigation graph, with no Room frame to consult', async () => {
		const payload = await wallFirstPayload();
		const prepared = prepareUnitRuntime(structuredClone(payload));
		if (prepared.kind === 'rejected') throw new Error('expected ready');
		expect(prepared.runtimeScene.navigationNodes.map((node) => node.id)).toEqual(['node-1']);
		expect(prepared.rooms.entries).toEqual([]);
	});

	it('rejects an unknown root key through the canonical validator, before any state is installed', async () => {
		// One acceptance authority: runtime preparation must not be laxer than the
		// persisted-document reader, or a stored record could load here and fail
		// (or vice versa) depending on which entry point opened it.
		const withExtraKey = { ...(await wallFirstPayload()), extra: true };
		const viaRuntime = prepareUnitRuntime(withExtraKey);
		expect(viaRuntime).toMatchObject({ kind: 'rejected', reason: 'invalid-envelope' });
		if (viaRuntime.kind !== 'rejected') return;
		expect(viaRuntime.issues.some((issue) => issue.code === 'unknown-key')).toBe(true);
		const viaReader = validateProjectEnvelope(withExtraKey);
		expect(viaReader.success).toBe(false);
	});

	it('rejects anything that is not the admitted envelope, before any state is installed', async () => {
		expect(prepareUnitRuntime({ nope: true })).toMatchObject({
			kind: 'rejected',
			reason: 'invalid-envelope'
		});

		// A Camera view that carries an editorial field is refused by the strict
		// Camera reader, so no such value reaches the runtime projection.
		const payload = await wallFirstPayload();
		const dangling = JSON.parse(JSON.stringify(payload)) as {
			units: { camera: { data: { views: Record<string, unknown>[] } } };
		};
		dangling.units.camera.data.views = [
			{ ...dangling.units.camera.data.views[0]!, roomId: 'room-nope' }
		];
		const rejected = prepareUnitRuntime(dangling);
		expect(rejected).toMatchObject({ kind: 'rejected' });

		expect(() =>
			composeColdReleaseBundle({ document: { nope: true }, manifest: coldManifest() })
		).toThrow();
	});
});

// ---------------------------------------------------------------------------
// 3. Cold-load byte-identity — stored bytes are never rewritten on load
// ---------------------------------------------------------------------------

describe('P23.0 stage 4 — cold-load byte-identity (no stored-byte rewrites)', () => {
	it('the visitor composer leaves a realistic envelope untouched', async () => {
		const payload = await wallFirstPayload();
		const snapshot = structuredClone(payload);
		const bundle = composeColdReleaseBundle({ document: payload, manifest: coldManifest() });
		try {
			expect(bundle.geometry.rooms).toHaveLength(1);
			expect(payload).toEqual(snapshot);
		} finally {
			bundle.dispose();
		}
	});
});
