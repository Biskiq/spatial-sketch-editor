import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * G4 visitor shell boundary.
 *
 * PR #115 removed the Chopin-specific `lib/museum/layout/LayoutMuseumShell.svelte`
 * (isolated for legacy at WP1), together with `apps/museum`'s fork. The surviving
 * visitor-facing layout surface in this repository is
 * `lib/visitor/VisitorLayoutShell.svelte`, which is the same shell the cold public
 * route mounts. Every invariant below was re-pointed to it with the same
 * expectation; only the case names it asserts changed (`LayoutWallFailure` /
 * `LayoutPhysicalWall` became the `VisitorWallFailure:` / `VisitorPhysicalWall:`
 * mesh names this file uses).
 */
const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src');
const shellPath = resolve(srcRoot, 'lib/visitor/VisitorLayoutShell.svelte');
const factoryPath = resolve(srcRoot, 'lib/museum/layout/wall-material-factory.ts');

describe('G4 visitor shell boundary', () => {
	it('removes the per-span chord-box wall path in favor of the builder + adapter', () => {
		const source = readFileSync(shellPath, 'utf8');
		// The old loop iterated `wall.solidSpans` and built a `T.BoxGeometry` per span.
		expect(source).not.toContain('solidSpans');
		// The new path builds one room wall mesh and wraps it through the adapter.
		expect(source).toContain('buildRoomWallMesh');
		expect(source).toContain('toWallBufferGeometry');
		expect(source).toContain('createVisitorWallMaterialFactory');
		// Door portals and floor/ceiling ShapeGeometry stay.
		expect(source).toContain('RoomPortal');
		expect(source).toContain('ShapeGeometry');
	});

	it('keeps the visitor wall-material factory free of editor imports', () => {
		const source = readFileSync(factoryPath, 'utf8');
		expect(source).not.toMatch(/from\s+['"]\$lib\/editor/);
		expect(source).not.toMatch(/from\s+['"]svelte['"]/);
	});

	it('renders an explicit failure surface rather than silently omitting a room', () => {
		const source = readFileSync(shellPath, 'utf8');
		expect(source).toContain('VisitorWallFailure:');
		expect(source).toContain('ok === false');
	});

	it('filters detail-less rooms BEFORE buildRoomWallMesh, matching the topology estimator', () => {
		const source = readFileSync(shellPath, 'utf8');
		// The guard must gate the build loop itself, not only hide the rendered
		// group — otherwise the live scene still pays the build cost and diverges
		// from estimateWallMeshTopology's exclusion semantics. This is P23.6H: a
		// wall-first canonical Room carries no Room-owned wall detail (its Walls
		// render through the canonical physical-Wall path), so it must build no
		// room mesh at all rather than a fabricated failure surface.
		//
		// The Chopin shell also gated a bespoke-room list here; that shell is gone
		// with `apps/museum`, and the surviving shell keeps the empty-Room guard.
		const buildIndex = source.lastIndexOf('buildRoomWallMesh');
		const emptyRoomIndex = source.indexOf('if (room.walls.length === 0) return [];');
		expect(buildIndex).toBeGreaterThan(0);
		expect(emptyRoomIndex).toBeGreaterThan(0);
		expect(emptyRoomIndex).toBeLessThan(buildIndex);
	});

	it('renders canonical physical Walls through the one compiled contract (P23.6H)', () => {
		const source = readFileSync(shellPath, 'utf8');
		// This shell previously rendered Room meshes only, so wall-first canonical
		// Walls never appeared.
		expect(source).toContain('buildStandaloneWallMesh');
		expect(source).toContain('geometry.walls');
		expect(source).toContain('VisitorPhysicalWall');
		// Vertical extent comes from the compiled Wall's own `height`; no
		// floor-derived ceiling may be computed and passed in from the shell.
		expect(source).not.toMatch(/buildStandaloneWallMesh\(\s*wall,\s*[^)]*height/);
	});
});
