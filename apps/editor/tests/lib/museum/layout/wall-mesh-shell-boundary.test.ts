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
 * floor/ceiling surfaces and door portals. E1/I3 removed the Room-owned wall path
 * and its shell-level failure surface.
 */
const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src');
const shellPath = resolve(srcRoot, 'lib/visitor/VisitorLayoutShell.svelte');
const representationPath = resolve(srcRoot, 'lib/render/layout-wall-representation.ts');
const objectRepresentationPath = resolve(srcRoot, 'lib/render/layout-object-representation.ts');
const roomRepresentationPath = resolve(srcRoot, 'lib/render/layout-room-representation.ts');
const shadowTriggersPath = resolve(srcRoot, 'lib/authoring/stage/shell/StageShadowTriggers.svelte');
const shadowInvalidationPath = resolve(srcRoot, 'lib/render/shadow-invalidation.ts');
const stageCanvasPath = resolve(srcRoot, 'lib/authoring/stage/shell/StageCanvas.svelte');
const stageEntitiesPath = resolve(srcRoot, 'lib/authoring/stage/shell/StageEntities.svelte');
const entityGroupsPath = resolve(srcRoot, 'lib/visitor/VisitorEntityGroups.svelte');
const entityFormPath = resolve(srcRoot, 'lib/museum/entities/EntityForm.svelte');
const factoryPath = resolve(srcRoot, 'lib/museum/layout/wall-material-factory.ts');

const shell = () => readFileSync(shellPath, 'utf8');
const representation = () => readFileSync(representationPath, 'utf8');
const objectRepresentation = () => readFileSync(objectRepresentationPath, 'utf8');
const roomRepresentation = () => readFileSync(roomRepresentationPath, 'utf8');
const shadowTriggers = () => readFileSync(shadowTriggersPath, 'utf8');
const shadowInvalidation = () => readFileSync(shadowInvalidationPath, 'utf8');
const stageCanvas = () => readFileSync(stageCanvasPath, 'utf8');
const stageEntities = () => readFileSync(stageEntitiesPath, 'utf8');
const entityGroups = () => readFileSync(entityGroupsPath, 'utf8');
const entityForm = () => readFileSync(entityFormPath, 'utf8');

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
		// E1/I3: the Room-owned wall path is gone; the shell builds no wall mesh.
		expect(shell()).not.toContain('buildRoomWallMesh');
		expect(shell()).not.toContain('toWallBufferGeometry');
		expect(shell()).not.toContain('createVisitorWallMaterialFactory');
		// Door portals stay with the shell; E6/R3 moved the floor/ceiling
		// triangulation into the retained Room representation.
		expect(shell()).toContain('RoomPortal');
		expect(shell()).not.toContain('ShapeGeometry');
		expect(roomRepresentation()).toContain('ShapeGeometry');
	});

	it('keeps the visitor wall-material factory free of editor imports', () => {
		const source = readFileSync(factoryPath, 'utf8');
		expect(source).not.toMatch(/from\s+['"]\$lib\/editor/);
		expect(source).not.toMatch(/from\s+['"]svelte['"]/);
	});

	it('renders an explicit failure surface through the retained Wall representation', () => {
		// E1/I3: the shell's Room-owned failure surface left with the Room-owned
		// wall path. The retained Wall representation owns the failure surface.
		expect(shell()).not.toContain('VisitorWallFailure:');
		expect(shell()).not.toContain('room.walls');
		expect(representation()).toContain('VisitorPhysicalWallFailure:');
		expect(representation()).toContain('failureBox');
	});

	it('mounts Layout objects as one retained subtree, not a component per object', () => {
		// T1.P02.S06 D.3 (H4): the Stage's mount cost was one Svelte component pair
		// per drawn entity. Objects now render through the retained representation,
		// which owns one mesh per compiled object and one material for its lifetime.
		const owned = objectRepresentation();
		expect(owned).toContain('geometry.objects');
		expect(owned).toContain('VisitorLayoutObject:');
		// E6/R2a: the surface is a descriptor acquired from the Canvas store, so
		// the representation itself no longer constructs a material.
		expect(owned).toContain('OBJECT_SURFACE');
		expect(owned).toContain('store.acquire(');
		expect(shell()).toContain('createObjectRepresentation');
		expect(shell()).toContain('objects.object3d');
		// Teardown must not live in an update effect: Svelte runs a returned cleanup
		// before each re-run, and `geometry` changes identity on every compile, so a
		// combined effect would dispose the representation and then update a
		// disposed one. One teardown effect releases the representations first and
		// the material store last, because they lease from it.
		const teardown = /\$effect\(\s*\(\) => \(\) => \{([\s\S]*?)\}\s*\);/u.exec(shell())?.[1] ?? '';
		expect(teardown).toContain('rooms.dispose()');
		expect(teardown.indexOf('walls.dispose()')).toBeGreaterThan(teardown.indexOf('rooms.dispose()'));
		expect(teardown.indexOf('objects.dispose()')).toBeGreaterThan(teardown.indexOf('walls.dispose()'));
		expect(teardown.indexOf('materials.dispose()')).toBeGreaterThan(teardown.indexOf('objects.dispose()'));
		expect(shell()).not.toMatch(/\$effect\(\(\) => \{[\s\S]{0,200}?return \(\) => (walls|objects|rooms)\.dispose\(\);/);
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
		// The render projection, not only the accepted Scene, is the trigger: a
		// previewed or candidate light must move its cast shadow with its light.
		expect(stageCanvas()).toContain('<StageShadowTriggers {geometry} scene={renderScene} {modelUrls} {formRenderRevision} />');
		expect(stageCanvas()).toContain('onFormRendererReady={formRendererReady}');
		expect(stageEntities()).toContain('{onFormRendererReady} {includeLights} Model={ModelComponent}');
		const groups = entityGroups();
		expect(groups).toContain('onMounted={onFormRendererReady}');
		expect(entityForm()).toContain("import { onMount } from 'svelte'");
		expect(entityForm()).toContain('onMount(() => onMounted?.())');
		const triggers = shadowTriggers();
		expect(triggers).toContain('createShadowInvalidation');
		expect(triggers).toContain('renderer.shadowMap');
		expect(triggers).toContain('requestFrame: invalidate');
		expect(triggers).toContain('shadows.dispose()');
		expect(triggers).toContain('formRenderRevision] as const');
		// A caster whose arrival cannot be observed (a parsed model) keeps today's
		// per-frame updates instead of a trigger that might miss it.
		expect(triggers).toContain('setAlwaysUpdate');
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
