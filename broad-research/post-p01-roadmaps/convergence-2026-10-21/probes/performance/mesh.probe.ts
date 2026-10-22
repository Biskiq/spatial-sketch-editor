// Disposable probe: the CPU half of the per-edit render rebuild. VisitorLayoutShell
// (shared by the Stage canvas and the visitor Preview surface) rebuilds EVERY
// physical Wall mesh from the compiled geometry whenever geometry changes, one
// BufferGeometry per Wall. This measures that three-free mesh build
// (`buildStandaloneWallMesh` over all compiled Walls, with compiled Junction ends)
// and the resulting vertex/index volume. GPU upload and draw cost are not
// measurable in Node. Results: ./results/mesh-warm.json.
import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileWallFirstLayoutGeometry, legJoinsByWall } from '@portfolio/layout-core';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';
import { addOpenings, buildGrid } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));

it('measures the full wall-mesh rebuild by Layout size', () => {
	const rows: Record<string, unknown>[] = [];
	for (const k of (process.env.PERF_SIZES ?? '3,7,14').split(',').map(Number)) {
		const doc = addOpenings(buildGrid(k));
		const geometry = compileWallFirstLayoutGeometry(doc).geometry!;
		const elevation = new Map(geometry.floors.map((f) => [f.floorId, f.elevation] as const));
		const build = () => {
			const ends = legJoinsByWall(geometry.junctions);
			let vertices = 0;
			let indices = 0;
			let meshes = 0;
			let groups = 0;
			for (const wall of geometry.walls ?? []) {
				const result = buildStandaloneWallMesh(wall, elevation.get(wall.floorId) ?? 0, ends.get(wall.wallId) ?? null, {
					classifySurface: () => 'wall'
				});
				if (!result.mesh) continue;
				meshes++;
				vertices += result.mesh.positions.length / 3;
				indices += result.mesh.indices.length;
				groups += result.mesh.materialGroups.length;
			}
			return { meshes, vertices, triangles: indices / 3, materialGroups: groups };
		};
		const volume = build();
		const samples: number[] = [];
		for (let i = 0; i < 25; i++) {
			const t = performance.now();
			build();
			samples.push(performance.now() - t);
		}
		samples.sort((a, b) => a - b);
		const row = {
			label: `grid-${k}+openings`,
			walls: doc.walls.length,
			openings: doc.openings.length,
			...volume,
			// Float32 position+normal (3+3) + uv (2) per vertex, Uint32 index: upper bound of buffer bytes.
			bufferMiB: Math.round(((volume.vertices * 8 * 4 + volume.triangles * 3 * 4) / 1048576) * 100) / 100,
			rebuildMs: {
				median: Math.round(samples[12]! * 1000) / 1000,
				p95: Math.round(samples[23]! * 1000) / 1000,
				max: Math.round(samples[24]! * 1000) / 1000
			}
		};
		rows.push(row);
		console.log(JSON.stringify(row));
	}
	mkdirSync(path.join(here, 'results'), { recursive: true });
	writeFileSync(path.join(here, 'results', 'mesh-warm.json'), JSON.stringify({ node: process.version, date: new Date().toISOString(), rows }, null, 1) + '\n');
});
