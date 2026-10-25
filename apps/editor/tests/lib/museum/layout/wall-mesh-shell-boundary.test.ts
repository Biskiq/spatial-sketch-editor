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
 *
 * T1.P02.S06 D.3 (H4) moved the **physical-Wall** meshes into
 * `lib/render/layout-wall-representation.ts`, which retains one mesh per compiled
 * Wall and reconciles it in place. The invariants did not move with them: each is
 * asserted against the file that now owns it, and the shell keeps the Room
 * surfaces, door portals and the explicit failure surface.
 */
const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src');
const shellPath = resolve(srcRoot, 'lib/visitor/VisitorLayoutShell.svelte');
const representationPath = resolve(srcRoot, 'lib/render/layout-wall-representation.ts');
const objectRepresentationPath = resolve(srcRoot, 'lib/render/layout-object-representation.ts');
const shadowTriggersPath = resolve(srcRoot, 'lib/authoring/stage/shell/StageShadowTriggers.svelte');
const shadowInvalidationPath = resolve(srcRoot, 'lib/render/shadow-invalidation.ts');
const stageCanvasPath = resolve(srcRoot, 'lib/authoring/stage/shell/StageCanvas.svelte');
const factoryPath = resolve(srcRoot, 'lib/museum/layout/wall-material-factory.ts');

const shell = () => readFileSync(shellPath, 'utf8');
const representation = () => readFileSync(representationPath, 'utf8');
const objectRepresentation = () => readFileSync(objectRepresentationPath, 'utf8');
const shadowTriggers = () => readFileSync(shadowTriggersPath, 'utf8');
const shadowInvalidation = () => readFileSync(shadowInvalidationPath, 'utf8');
const stageCanvas = () => readFileSync(stageCanvasPath, 'utf8');

describe('G4 visitor shell boundary', () => {
	it('removes the per-span chord-box wall path in favor of the builder + adapter', () => {
		for (const source of [shell(), representation()]) {
			// The old loop iterated `wall.solidSpans` and built a `T.BoxGeometry` per
			// span. Neither owner may reintroduce it.
			expect(source).not.toContain('solidSpans');
		}
		const owned = representation();
		expect(owned).toContain('buildStandaloneWallMesh');
		expect(owned).toContain('toWallBufferGeometry');
		expect(owned).toContain('createVisitorWallMaterialFactory');
		expect(shell()).toContain('buildRoomWallMesh');
		expect(shell()).toContain('toWallBufferGeometry');
		expect(shell()).toContain('createVisitorWallMaterialFactory');
		// Door portals and floor/ceiling ShapeGeometry stay with the shell.
		expect(shell()).toContain('RoomPortal');
		expect(shell()).toContain('ShapeGeometry');
	});

	it('keeps the visitor wall-material factory free of editor imports', () => {
		const source = readFileSync(factoryPath, 'utf8');
		expect(source).not.toMatch(/from\s+['"]\$lib\/editor/);
		expect(source).not.toMatch(/from\s+['"]svelte['"]/);
	});

	it('renders an explicit failure surface rather than silently omitting a room', () => {
		expect(shell()).toContain('VisitorWallFailure:');
		expect(shell()).toContain('ok === false');
		// The retained Wall representation owns its own failure surface too.
		expect(representation()).toContain('VisitorPhysicalWallFailure:');
		expect(representation()).toContain('failureBox');
	});

	it('filters detail-less rooms BEFORE buildRoomWallMesh, matching the topology estimator', () => {
		const source = shell();
		// The guard must gate the build loop itself, not only hide the rendered
		// group — otherwise the live scene still pays the build cost and diverges
		// from estimateWallMeshTopology's exclusion semantics. This is P23.6H: a
		// wall-first canonical Room carries no Room-owned wall detail (its Walls
		// render through the canonical physical-Wall path), so it must build no
		// room mesh at all rather than a fabricated failure surface.
		const buildIndex = source.lastIndexOf('buildRoomWallMesh');
		const emptyRoomIndex = source.indexOf('if (room.walls.length === 0) return [];');
		expect(buildIndex).toBeGreaterThan(0);
		expect(emptyRoomIndex).toBeGreaterThan(0);
		expect(emptyRoomIndex).toBeLessThan(buildIndex);
	});

	it('mounts Layout objects as one retained subtree, not a component per object', () => {
		// T1.P02.S06 D.3 (H4): the Stage's mount cost was one Svelte component pair
		// per drawn entity. Objects now render through the retained representation,
		// which owns one mesh per compiled object and one material for its lifetime.
		const owned = objectRepresentation();
		expect(owned).toContain('geometry.objects');
		expect(owned).toContain('VisitorLayoutObject:');
		expect(owned).toContain('MeshStandardMaterial');
		expect(shell()).toContain('createObjectRepresentation');
		expect(shell()).toContain('objects.object3d');
		// The per-object component loop is gone, so nothing re-creates a geometry
		// per render from the compiled object list.
		expect(shell()).not.toContain('geometry.objects as object');
		expect(shell()).not.toContain('T.BoxGeometry args={object.dimensions}');
	});

	it('renders shadow maps only when a shadow input changed (H9)', () => {
		// The Stage owns its shadow-map invalidation, mounted inside the one Canvas
		// because it needs that renderer; the trigger set is the plan's D.6
		// contract, and the camera is deliberately not one of them.
		expect(stageCanvas()).toContain('StageShadowTriggers');
		expect(stageCanvas()).toContain('<StageShadowTriggers {geometry} {scene} {modelUrls} />');
		const triggers = shadowTriggers();
		expect(triggers).toContain('createShadowInvalidation');
		expect(triggers).toContain('renderer.shadowMap');
		expect(triggers).toContain('requestFrame: invalidate');
		expect(triggers).toContain('shadows.dispose()');
		const controller = shadowInvalidation();
		expect(controller).toContain('webglcontextrestored');
		expect(controller).toContain('autoUpdate');
		expect(controller).toContain('needsUpdate');
		// The camera must never appear as a dependency: a shadow map renders from
		// the light's shadow camera, which is the whole saving.
		expect(triggers).not.toMatch(/const \{[^}]*camera/);
	});

	it('renders canonical physical Walls through the one compiled contract (P23.6H)', () => {
		const owned = representation();
		// The shell previously rendered Room meshes only, so wall-first canonical
		// Walls never appeared. They now render through the retained representation.
		expect(owned).toContain('buildStandaloneWallMesh');
		expect(owned).toContain('geometry.walls');
		expect(owned).toContain('VisitorPhysicalWall');
		expect(shell()).toContain('createWallRepresentation');
		expect(shell()).toContain('walls.object3d');
		// Vertical extent comes from the compiled Wall's own `height`; no
		// floor-derived ceiling may be computed and passed in from the shell.
		expect(owned).not.toMatch(/buildStandaloneWallMesh\(\s*wall,\s*[^)]*height/);
		// And the representation's only elevation input is the compiled Floor datum.
		expect(owned).toContain('floor.elevation');
	});
});
