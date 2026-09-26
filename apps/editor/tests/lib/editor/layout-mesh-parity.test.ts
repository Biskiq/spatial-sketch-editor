/**
 * P23.6H — editor / visitor / museum Wall-mesh parity.
 *
 * One compiled contract, every live surface that renders wall-first
 * architecture:
 *
 * ```text
 * CompiledLayoutGeometry.walls[].height
 *   → buildStandaloneWallMesh(wall, floorElevation, resolvedEnds)
 *   → identical vertical extent everywhere
 *
 * P23.15 adds the second half of the contract: every surface passes the compiled
 * Junction ends (`legJoinsByWall(geometry.junctions)`), so no surface solves
 * topology and none can silently square-cap a connected Wall.
 * ```
 *
 * The builder exists twice (editor app + standalone museum app) and the copies
 * are byte-identical by contract, so this suite asserts both the geometry (via
 * the editor copy) and the source/consumer contracts that keep the four live
 * surfaces on the same path.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { compileWallFirstLayoutGeometry, legJoinsByWall } from '@portfolio/layout-core';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';
import type { LayoutVec2 } from '$lib/layout/layout-types';

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src');
const repoRoot = resolve(srcRoot, '../../..');

const EDITOR_BUILDER = 'apps/editor/src/lib/layout/wall-mesh-builder.ts';
const MUSEUM_BUILDER = 'apps/museum/src/lib/layout/wall-mesh-builder.ts';
const EDITOR_MUSEUM_SHELL = 'apps/editor/src/lib/museum/layout/LayoutMuseumShell.svelte';
const STANDALONE_MUSEUM_SHELL = 'apps/museum/src/lib/museum/layout/LayoutMuseumShell.svelte';
const VISITOR_SHELL = 'apps/editor/src/lib/visitor/VisitorLayoutShell.svelte';

function source(relativePath: string): string {
	return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

/**
 * P23.15 — the Wall's already-resolved Junction ends, exactly what every live
 * surface passes. The builder fails closed without them, so "identical extent"
 * is now asserted on the Junction-aware path, not on a square-cap path.
 */
function endsFor(compilation: ReturnType<typeof compileWallFirstLayoutGeometry>, wallId: string) {
	return legJoinsByWall(compilation.geometry.junctions).get(wallId) ?? null;
}

/** One straight canonical Wall from (0,0) to (4,0) at the given height. */
function wallDocument(options: { wallHeight: number; elevation?: number; sillHeight?: number; openingHeight?: number }): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 5,
		// P23.6I — the canonical Floor has no vertical extent; only the Wall does.
		floor: { id: 'floor-1', name: 'Floor 1', elevation: options.elevation ?? 0 },
		junctions: [
			{ id: 'j1', point: [0, 0] as LayoutVec2 },
			{ id: 'j2', point: [4, 0] as LayoutVec2 }
		],
		walls: [
			{
				id: 'w1',
				startJunctionId: 'j1',
				endJunctionId: 'j2',
				role: 'partition',
				thickness: 0.2,
				height: options.wallHeight,
				centerline: { kind: 'line' } as const,
			}
		],
		rooms: [],
		openings:
			options.openingHeight !== undefined
				? [
						{
							id: 'door-1',
							wallId: 'w1',
							kind: 'door',
							offset: 1,
							width: 0.9,
							height: options.openingHeight,
							sillHeight: options.sillHeight ?? 0,
							profile: 'rectangular'
						}
					]
				: [],
		objects: []
	};
}

describe('P23.6H mesh parity — one compiled Wall contract', () => {
	it('builds a Wall mesh whose top equals the compiled Wall top (1.2 m partition)', () => {
		const document = wallDocument({ wallHeight: 1.2, elevation: 0 });
		const compiled = compileWallFirstLayoutGeometry(document);
		const wall = compiled.geometry.walls[0]!;
		expect(wall.height).toBe(1.2);
		expect(wall.bounds3.max[1]).toBe(1.2);

		const result = buildStandaloneWallMesh(wall, document.floor.elevation, endsFor(compiled, wall.wallId));
		if (!result.mesh) throw new Error(`expected mesh: ${JSON.stringify(result.issues)}`);
		expect(result.mesh.bounds.max[1]).toBe(wall.bounds3.max[1]);
		expect(result.mesh.bounds.min[1]).toBe(wall.bounds3.min[1]);
	});

	it('keeps mesh and compiled extent identical on a raised Floor too', () => {
		const document = wallDocument({ wallHeight: 0.9, elevation: 1.25 });
		const compiled = compileWallFirstLayoutGeometry(document);
		const wall = compiled.geometry.walls[0]!;
		const result = buildStandaloneWallMesh(wall, document.floor.elevation, endsFor(compiled, wall.wallId));
		if (!result.mesh) throw new Error('expected mesh');
		expect(result.mesh.bounds.min[1]).toBe(1.25);
		expect(result.mesh.bounds.max[1]).toBe(2.15);
		expect(result.mesh.bounds.max[1]).toBe(wall.bounds3.max[1]);
	});

	it('cuts an Opening against the hosting Wall height, not the Floor envelope', () => {
		// 2.4 m Wall with a 2.1 m door: the cut must end at the Wall top, and the
		// mesh must not extend to the 3 m Floor ceiling.
		const document = wallDocument({ wallHeight: 2.4, openingHeight: 2.1 });
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(compiled.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
		const wall = compiled.geometry.walls[0]!;
		const result = buildStandaloneWallMesh(wall, document.floor.elevation, endsFor(compiled, wall.wallId), {
			classifySurface: () => 'wall'
		});
		if (!result.mesh) throw new Error(`expected mesh: ${JSON.stringify(result.issues)}`);
		expect(result.mesh.bounds.max[1]).toBe(2.4);
	});

	it('ships the two builder copies byte-identical', () => {
		expect(source(EDITOR_BUILDER)).toBe(source(MUSEUM_BUILDER));
	});

	it('derives the standalone Wall extent from the compiled Wall height', () => {
		const builder = source(EDITOR_BUILDER);
		// The ceiling parameter is gone: no call site can pass a floor-derived
		// vertical extent, and the builder reads the authoritative height.
		expect(builder).toContain('const wallHeight = wall.height;');
		expect(builder).not.toMatch(/ceilingElevation\s*:\s*number/);
	});
});

describe('P23.6H mesh parity — live surface contracts', () => {
	it('renders canonical physical Walls in the editor-app museum shell', () => {
		const shell = source(EDITOR_MUSEUM_SHELL);
		expect(shell).toContain('buildStandaloneWallMesh');
		expect(shell).toContain('geometry.walls');
		expect(shell).toContain('LayoutPhysicalWall');
		// A wall-first canonical Room has no Room-owned wall detail and must not
		// produce a fabricated mesh-failure surface.
		expect(shell).toContain('if (room.walls.length === 0) return [];');
	});

	it('renders canonical physical Walls in the standalone museum shell', () => {
		const shell = source(STANDALONE_MUSEUM_SHELL);
		expect(shell).toContain('buildStandaloneWallMesh');
		expect(shell).toContain('geometry.walls');
		expect(shell).toContain('LayoutPhysicalWall');
	});

	it('renders canonical physical Walls in the visitor shell', () => {
		const shell = source(VISITOR_SHELL);
		expect(shell).toContain('buildStandaloneWallMesh');
		expect(shell).toContain('geometry.walls');
	});

	it('passes the compiled resolved Junction ends from every live surface', () => {
		// P23.15 — the renderer is a pure consumer: it looks the Wall's resolved
		// ends up from the compiled Junction topology and hands them to the
		// builder. It never inspects the document and never decides the seam.
		for (const path of [EDITOR_MUSEUM_SHELL, STANDALONE_MUSEUM_SHELL, VISITOR_SHELL]) {
			const text = source(path);
			expect(text).toContain('legJoinsByWall(geometry.junctions)');
			expect(text).toMatch(/buildStandaloneWallMesh\(wall, [a-zA-Z.]+, endsByWall\.get\(wall\.wallId\) \?\? null/);
		}
		const preview = source('apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts');
		const preparation = source('apps/editor/src/lib/editor/layout/prepared-wall-meshes.ts');
		expect(preview).toContain('prepareWallMeshes');
		expect(preview).not.toContain('buildStandaloneWallMesh');
		expect(preparation).toContain('legJoinsByWall(geometry.junctions ?? [])');
		expect(preparation).toContain('buildStandaloneWallMesh(input.wall, input.floorElevation, input.ends)');
	});

	it('never passes a floor-derived ceiling to the standalone builder anywhere', () => {
		for (const path of [EDITOR_MUSEUM_SHELL, STANDALONE_MUSEUM_SHELL, VISITOR_SHELL]) {
			const text = source(path);
			expect(text).not.toMatch(/buildStandaloneWallMesh\([^)]*ceilingElevation/);
			expect(text).not.toMatch(/buildStandaloneWallMesh\([\s\S]{0,80}?frame\.elevation \+ frame\.height/);
		}
	});
});
