/**
 * T1 V2a · T-P1 — a level Wall is byte-identical to the pre-bump output.
 *
 * The fixture beside this file is the pre-format-11 (commit `cdb15f896`, latest
 * `main`) output of `compileWallFirstLayoutGeometry` and
 * `buildStandaloneWallMesh` for the existing G1 geometry fixtures. The fixtures
 * are reconstructed here from their source builders, now with the required
 * `top: { kind: 'level' }` on every Wall; everything else is unchanged.
 *
 * A digest only passes if every byte of the compiled records (including the
 * cache keys) and of each Wall's positions, normals, UVs, indices and material
 * groups is unchanged. That is the proof the level path never enters the new
 * code: a `topProfile`, an extra cache-key part or a different top vertex would
 * move a digest.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core/geometry';
import { legJoinsByWall, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-standalone';
import {
	g1LShapedDocument,
	g1LineRectangleDocument,
	g1MultipleOpeningsDocument,
	g1ProfileMatrixDocument
} from '../../../../../packages/layout-core/tests/__fixtures__/layout-g1-fixtures';

type MeshBaseline = {
	wallId: string;
	cacheKey: string;
	positions: string;
	normals: string;
	uvs: string;
	indices: string;
	materialGroups: unknown;
	pickRanges: number;
	bounds: unknown;
	vertexCount: number;
	triangleCount: number;
};

type FixtureBaseline = {
	compiledDigest: string;
	junctionCacheKeys: Array<[string, string]>;
	wallCacheKeys: Array<[string, string]>;
	meshes: MeshBaseline[];
};

const baseline = JSON.parse(
	readFileSync(
		fileURLToPath(new URL('./__fixtures__/wall-top-level-compile-baseline.json', import.meta.url)),
		'utf8'
	)
) as Record<string, FixtureBaseline>;

const FIXTURES: Record<string, () => LayoutDocumentWallFirst> = {
	'g1-rectangle': g1LineRectangleDocument,
	'g1-l-shaped': g1LShapedDocument,
	'g1-multiple-openings': g1MultipleOpeningsDocument,
	'g1-profile-matrix': g1ProfileMatrixDocument
};

function sha(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function buffers(value: Float32Array | Uint32Array): string {
	return sha(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
}

describe('T-P1 · a level Wall compiles and meshes byte-identically to the pre-bump output', () => {
	for (const [name, build] of Object.entries(FIXTURES)) {
		it(`${name}: compiled records, cache keys and mesh buffers`, () => {
			const expected = baseline[name]!;
			const document = build();
			for (const wall of document.walls) expect(wall.top).toEqual({ kind: 'level' });
			const compiled = compileWallFirstLayoutGeometry(document);
			expect(compiled.issues).toEqual([]);
			const geometry = compiled.geometry;
			expect(
				sha(
					JSON.stringify({
						walls: geometry.walls,
						junctions: geometry.junctions,
						queries: geometry.queries,
						bounds: geometry.bounds
					})
				)
			).toBe(expected.compiledDigest);
			expect(geometry.junctions!.map((junction) => [junction.junctionId, junction.cacheKey])).toEqual(
				expected.junctionCacheKeys
			);
			expect(geometry.walls.map((wall) => [wall.wallId, wall.cacheKey])).toEqual(expected.wallCacheKeys);
			expect(geometry.walls.every((wall) => wall.topProfile === undefined)).toBe(true);

			const joins = legJoinsByWall(geometry.junctions);
			const meshes = geometry.walls.map((wall) => {
				const built = buildStandaloneWallMesh(wall, document.floor.elevation, joins.get(wall.wallId) ?? null);
				expect(built.issues).toEqual([]);
				const mesh = built.mesh!;
				return {
					wallId: wall.wallId,
					cacheKey: wall.cacheKey,
					positions: buffers(mesh.positions),
					normals: buffers(mesh.normals),
					uvs: buffers(mesh.uvs),
					indices: buffers(mesh.indices),
					materialGroups: mesh.materialGroups,
					pickRanges: mesh.pickRanges.length,
					bounds: mesh.bounds,
					vertexCount: mesh.positions.length / 3,
					triangleCount: mesh.indices.length / 3
				};
			});
			expect(meshes).toEqual(expected.meshes);
		});
	}
});
