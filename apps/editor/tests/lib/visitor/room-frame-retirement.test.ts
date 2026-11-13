/**
 * E1/I3 — the three preconditions that make the Room-owned wall path and the
 * Room frame dead, as executable facts.
 *
 * (a) No compile of a format-7 document yields a non-empty `room.walls`
 *     (so the shell's `room.walls` mesh and portal loops have nothing to read).
 * (b) The Scene codec refuses `roomId` wherever it can appear (so no Scene
 *     record can name a Room frame).
 * (c) No production caller populates the Room registry: the runtime registry
 *     is empty, and the empty constructor has exactly one production caller.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createLayoutCompileReuse,
	type CompiledLayoutGeometry
} from '@portfolio/layout-core';
import { prepareUnitRuntime } from '@portfolio/project-model/units';
import { validateCameraFreeScenePayload } from '@portfolio/project-model/units';
import { listSourceFiles, relativeToRepo, EDITOR_SRC, PACKAGES_ROOT } from '../../helpers/import-closure';
import { addOpenings, buildGrid, sequentialCaptures } from '../../../perf/lib/workloads/grid';
import { buildCountingSceneFixture } from '../authoring/__fixtures__/counting-scene';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function expectNoRoomOwnedWalls(geometry: CompiledLayoutGeometry): void {
	expect(geometry.rooms.length).toBeGreaterThan(0);
	expect(geometry.walls.length).toBeGreaterThan(0);
	for (const room of geometry.rooms) {
		expect(room.walls).toEqual([]);
		expect(room.openings).toEqual([]);
	}
}

describe('I3 precondition (a): a format-7 compile never yields Room-owned walls', () => {
	it('cold compile of the M grid', () => {
		for (const k of [7]) {
			const document = addOpenings(buildGrid(k, sequentialCaptures(`i3-${k}-`)), sequentialCaptures(`i3o-${k}-`));
			expect(document.openings.length).toBeGreaterThan(0);
			expectNoRoomOwnedWalls(compileWallFirstLayoutGeometry(document).geometry);
		}
	}, 60_000);

	it('incremental compile through the retained store', () => {
		const document = addOpenings(buildGrid(7, sequentialCaptures('i3r-')), sequentialCaptures('i3ro-'));
		const reuse = createLayoutCompileReuse();
		expectNoRoomOwnedWalls(compileWallFirstLayoutGeometry(document, undefined, reuse).geometry);
		// A second compile of the same document takes the retained/delta path.
		expectNoRoomOwnedWalls(compileWallFirstLayoutGeometry(document, undefined, reuse).geometry);
	});
});

describe('I3 precondition (b): the Scene codec refuses roomId', () => {
	it('refuses roomId on every entity kind the counting fixture carries', async () => {
		const fixture = await buildCountingSceneFixture();
		const kinds = new Set<string>();
		for (const entity of fixture.entities) {
			if (kinds.has(entity.kind)) continue;
			kinds.add(entity.kind);
			const scene = (extra: Record<string, unknown>) => ({
				formatVersion: 6,
				textures: [],
				materials: [],
				entities: [{ ...entity, ...extra }],
				artworkLibrary: []
			});
			const clean = validateCameraFreeScenePayload(scene({}));
			const dirty = validateCameraFreeScenePayload(scene({ roomId: 'room-x' }));
			const roomIdIssues = (result: ReturnType<typeof validateCameraFreeScenePayload>) =>
				result.success ? [] : result.issues.filter((issue) => issue.path.endsWith('.roomId'));
			expect(roomIdIssues(clean)).toEqual([]);
			// Named refusal, or an unknown-key refusal for kinds that never allowed it.
			const refusals = roomIdIssues(dirty);
			expect(refusals.length).toBeGreaterThan(0);
			expect(['room_id_forbidden_in_world_local', 'unknown_property']).toContain(refusals[0]!.code);
			expect(dirty.success).toBe(false);
		}
		expect(kinds.size).toBeGreaterThanOrEqual(4);
	});
});

describe('I3 final state: the Room frame and its registry are gone', () => {
	it('the prepared runtime carries no Room registry', async () => {
		const fixture = await buildCountingSceneFixture();
		const prepared = prepareUnitRuntime(fixture.project);
		if (prepared.kind !== 'ready') throw new Error(`fixture did not prepare: ${prepared.kind}`);
		expect('rooms' in prepared).toBe(false);
	});

	it('no product source names the Room registry, the Room frame type or a Scene roomId', () => {
		const productionFiles = [
			...listSourceFiles(EDITOR_SRC),
			...readdirSync(PACKAGES_ROOT).flatMap((name) => listSourceFiles(path.join(PACKAGES_ROOT, name, 'src')))
		].filter((file) => /\.(ts|svelte)$/.test(file));
		const offenders: string[] = [];
		for (const file of productionFiles) {
			const source = readFileSync(file, 'utf8');
			if (/\bLayoutRoomRegistry\b|createEmptyLayoutRoomRegistry|\bcross_room_cluster_member\b/.test(source)) {
				offenders.push(relativeToRepo(file));
			}
		}
		expect(offenders).toEqual([]);
	});

	it('the Scene product types carry no roomId field', () => {
		const source = readFileSync(path.join(PACKAGES_ROOT, 'project-model/src/scene.ts'), 'utf8');
		expect(source).not.toMatch(/\broomId\??:/);
		expect(source).not.toMatch(/\bRoomId\b/);
	});

	it('the visitor shell builds no Room-owned wall or portal from a Room', () => {
		const shell = readFileSync(path.join(EDITOR_SRC, 'lib/visitor/VisitorLayoutShell.svelte'), 'utf8');
		expect(shell).not.toMatch(/buildRoomWallMesh|room\.walls|room\.openings|VisitorWallFailure/);
	});
});
