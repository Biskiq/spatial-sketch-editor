/**
 * T1 X1 / T2 §10 — the shadow contract for a lifted overhead.
 *
 * T2's approved rule is that "a surface hidden from the camera still casts and
 * blocks light". Lift hides an overhead from the Stage camera, so the two facts
 * that decide whether it still shadows must stay separate:
 *
 * - **caster state** — `mesh.castShadow`, set by the representation that builds
 *   the mesh;
 * - **effective shadow-camera eligibility** — whether `mesh.layers` intersects
 *   the layers the shadow pass actually uses. In r187 that is the light's
 *   `shadow.camera.layers` when its mask has any bit other than 0, and otherwise
 *   the **viewing camera's** layers.
 *
 * A mesh shadows only when both hold. Lift changes the second fact for lid meshes
 * and never the first. Today no generated lid casts, so the contract holds
 * vacuously; the first PR that makes any overhead cast must enable
 * `LIFTED_RENDER_LAYER` on every light-store shadow camera, and Assertion B
 * refuses it until it does.
 *
 * **V1 obligation — fixture work, not automatic coverage.** The *sources* below
 * are enumerated through `overheadSourcesOf`, so V1's authored overhead regions
 * must join that function (V1b) and this suite's subject list follows with no
 * edit here. Its *fixture* does not follow: every mesh this file tests is found
 * by name inside the Room representation's generated lid
 * (`VisitorCeiling:<roomId>`), and a V1 region will be built by its own
 * representation. The PR that adds one must extend this fixture to build that
 * representation's mesh (its `castShadow` and its lifted layer) and keep
 * Assertions A–C green for it. Claiming automatic coverage would overstate what
 * this file proves.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Group, Mesh, PerspectiveCamera, type Camera, type Light, type Object3D } from 'three';
import {
	compileWallFirstLayoutGeometry,
	overheadSourcesOf,
	type CompiledLayoutGeometry
} from '@portfolio/layout-core';

import { stageCameraLayerMask } from '$lib/authoring/stage/paper-plan';
import { LIFTED_RENDER_LAYER } from '$lib/render/render-layers';
import { createRoomRepresentation } from '$lib/render/layout-room-representation';
import { createWallRepresentation } from '$lib/render/layout-wall-representation';
import { createObjectRepresentation } from '$lib/render/layout-object-representation';
import { createGeometryStore } from '$lib/render/resources/geometry-store';
import { createMaterialStore } from '$lib/render/resources/material-store';
import {
	createLightStore,
	type LightStore
} from '$lib/render/resources/light-store';
import type {
	SpotLightDescriptor,
	SunLightDescriptor
} from '$lib/render/resources/light-descriptor';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from '../layout/__fixtures__/layout-scale-fixtures';

/** The Sun the Sky realizes: it always casts, with its complete shadow configuration. */
const SUN: SunLightDescriptor = {
	kind: 'sun',
	color: '#fff4e2',
	intensity: 3.2,
	position: [6, 12, 8],
	target: [0, 0, 0],
	shadow: {
		mapSize: 2048,
		bias: -0.0005,
		normalBias: 0.02,
		radius: 2,
		camera: { left: -20, right: 20, top: 20, bottom: -20, near: 0.5, far: 80 }
	}
};

/** An authored Spot, shadow-casting, realized on the same terms as any entity light. */
const SPOT: SpotLightDescriptor = {
	kind: 'spot',
	color: '#ffd9a0',
	intensity: 40,
	distance: 0,
	decay: 2,
	angle: Math.PI / 5,
	penumbra: 0.35,
	castShadow: true
};

type ShadowCastingLight = Light & { readonly shadow: { readonly camera: Camera } };

/** r187's rule, stated in this suite's own words (and pinned against the source below). */
function effectiveShadowLayers(light: ShadowCastingLight, viewingCamera: Camera): Camera['layers'] {
	return (light.shadow.camera.layers.mask & 0xfffffffe) !== 0
		? light.shadow.camera.layers
		: viewingCamera.layers;
}

/** Every mesh under `root` a shadow pass would draw: casting, visible, and on an eligible layer. */
function shadowedSet(
	light: ShadowCastingLight,
	viewingCamera: Camera,
	root: Object3D
): string[] {
	const layers = effectiveShadowLayers(light, viewingCamera);
	const names: string[] = [];
	root.traverseVisible((object) => {
		const mesh = object as Mesh;
		if (mesh.isMesh !== true || mesh.castShadow !== true) return;
		if (!mesh.layers.test(layers)) return;
		names.push(mesh.name);
	});
	return names.sort();
}

/**
 * Assertion B's predicate: casting lids the shadow pass would **not** draw.
 *
 * Empty is the contract. A non-empty result names every lid whose lift silently
 * stopped it shadowing, which is the failure T2 §10 forbids.
 */
function unshadowableCastingLids(
	light: ShadowCastingLight,
	viewingCamera: Camera,
	lids: readonly Mesh[]
): string[] {
	const layers = effectiveShadowLayers(light, viewingCamera);
	return lids
		.filter((lid) => lid.castShadow === true && !lid.layers.test(layers))
		.map((lid) => lid.name);
}

type Fixture = {
	readonly geometry: CompiledLayoutGeometry;
	readonly root: Object3D;
	/** One entry per Layout overhead source, so a test can lift exactly that Space. */
	readonly lids: readonly { readonly roomId: string; readonly mesh: Mesh }[];
	readonly camera: Camera;
	readonly lights: readonly ShadowCastingLight[];
	readonly stores: { readonly materials: ReturnType<typeof createMaterialStore>; readonly geometry: ReturnType<typeof createGeometryStore>; readonly lights: LightStore };
	readonly rooms: ReturnType<typeof createRoomRepresentation>;
	dispose(): void;
};

function fixture(): Fixture {
	const geometry = compileWallFirstLayoutGeometry(buildScaleFixture(SCALE_FIXTURE_SEEDS.small)).geometry;
	const materials = createMaterialStore();
	const geometryStore = createGeometryStore();
	const lightStore = createLightStore();

	const rooms = createRoomRepresentation(materials);
	const walls = createWallRepresentation(materials);
	const objects = createObjectRepresentation(materials, geometryStore);
	rooms.update(geometry);
	walls.update(geometry);
	objects.update(geometry);

	const root = new Group();
	root.name = 'VisitorLayoutShell';
	root.add(rooms.object3d, walls.object3d, objects.object3d);

	// The lids this contract speaks about are exactly Layout's overhead sources.
	const lids: { roomId: string; mesh: Mesh }[] = [];
	for (const source of overheadSourcesOf(geometry, { kind: 'all' })) {
		const ceiling = rooms.object3d.getObjectByName(`VisitorCeiling:${source.subject.id}`);
		if (ceiling === undefined) throw new Error(`no ceiling mesh for ${source.subject.id}`);
		lids.push({ roomId: source.subject.id, mesh: ceiling as Mesh });
	}

	// The Stage's own viewing camera mask, with Paper not drawn.
	const camera = new PerspectiveCamera();
	camera.layers.disableAll();
	for (const layer of stageCameraLayerMask(false)) camera.layers.enable(layer);

	const lights = [lightStore.acquire(SUN).light, lightStore.acquire(SPOT).light] as ShadowCastingLight[];

	return {
		geometry,
		root,
		lids,
		camera,
		lights,
		stores: { materials, geometry: geometryStore, lights: lightStore },
		rooms,
		dispose() {
			rooms.dispose();
			walls.dispose();
			objects.dispose();
			materials.dispose();
			geometryStore.dispose();
			lightStore.dispose();
		}
	};
}

/** The lid meshes as a flat list, for the eligibility predicates. */
function lidMeshes(scene: Fixture): Mesh[] {
	return scene.lids.map((lid) => lid.mesh);
}

describe('T1 X1 / T2 §10 — Lift changes no light and no shadow', () => {
	it('keeps r187’s effective-layer rule as the test states it', () => {
		const source = readFileSync(
			createRequire(import.meta.url).resolve('three/src/renderers/webgl/WebGLShadowMap.js'),
			'utf8'
		);
		// A three upgrade that changes this rule must fail here, not silently make
		// every assertion below test a rule three no longer uses.
		expect(source).toContain(
			'const layers = ( shadow.camera.layers.mask & 0xFFFFFFFE ) !== 0 ? shadow.camera.layers : camera.layers;'
		);
		expect(source).toContain('const visible = object.layers.test( layers );');
	});

	it('draws the same casters off, on all, on one Space, and after Put back', () => {
		const scene = fixture();
		try {
			const camera = scene.camera;
			const before = scene.lights.map((light) => ({
				shadowed: shadowedSet(light, camera, scene.root),
				cast: castStateOf(scene.root)
			}));

			const roomId = scene.geometry.rooms[0]!.roomId;
			const states = [
				new Set<string>(),
				new Set(scene.geometry.rooms.map((room) => room.roomId)),
				new Set([roomId])
			];
			for (const lifted of states) {
				scene.rooms.setLifted(lifted);
				scene.lights.forEach((light, index) => {
					expect(shadowedSet(light, camera, scene.root), `lifted ${lifted.size}`).toEqual(
						before[index]!.shadowed
					);
				});
				// Caster and receiver state is untouched by Lift, on every mesh.
				expect(castStateOf(scene.root)).toEqual(before[0]!.cast);
			}

			scene.rooms.setLifted(new Set());
			scene.lights.forEach((light, index) => {
				expect(shadowedSet(light, camera, scene.root), 'after put back').toEqual(
					before[index]!.shadowed
				);
			});
			expect(castStateOf(scene.root)).toEqual(before[0]!.cast);
		} finally {
			scene.dispose();
		}
	});

	it('leaves every casting lid eligible in every shadow pass (today: no lid casts)', () => {
		const scene = fixture();
		try {
			// Today's generated lids cast nothing, so this is the contract's vacuous
			// case — recorded rather than skipped: the assertion becomes load-bearing
			// the moment a lid casts.
			const lids = lidMeshes(scene);
			expect(lids.every((lid) => lid.castShadow === false)).toBe(true);

			for (const lifted of [
				new Set(scene.geometry.rooms.map((room) => room.roomId)),
				new Set([scene.geometry.rooms[0]!.roomId])
			]) {
				scene.rooms.setLifted(lifted);
				for (const light of scene.lights) {
					expect(
						unshadowableCastingLids(light, scene.camera, lids),
						'a casting lid was lifted out of this light’s shadow pass: enable LIFTED_RENDER_LAYER on every light-store shadow camera in the PR that made the overhead cast (T2 §10)'
					).toEqual([]);
				}
			}
		} finally {
			scene.dispose();
		}
	});

	it('detects the failure it forbids, and accepts the one-line fix', () => {
		const scene = fixture();
		try {
			const target = scene.lids[0]!;
			const lid = target.mesh;
			const lidName = lid.name;
			const lids = lidMeshes(scene);
			// A scratch caster, exactly as a V1 slab or a T2 caster policy would make it.
			lid.castShadow = true;

			const camera = scene.camera;
			const shadowed = scene.lights.map((light) => shadowedSet(light, camera, scene.root));
			for (const set of shadowed) expect(set).toContain(lidName);
			expect(unshadowableCastingLids(scene.lights[0]!, camera, lids)).toEqual([]);

			// 1. The unmodified light store: lifting the caster removes it from every
			//    shadow pass while `castShadow` still reads true.
			scene.rooms.setLifted(new Set([target.roomId]));
			scene.lights.forEach((light, index) => {
				expect(shadowedSet(light, camera, scene.root)).not.toContain(lidName);
				expect(shadowedSet(light, camera, scene.root)).toEqual(
					shadowed[index]!.filter((name) => name !== lidName)
				);
			});
			expect(lid.castShadow).toBe(true);
			expect(unshadowableCastingLids(scene.lights[0]!, camera, lids)).toEqual([lidName]);

			// 2. The fix the contract requires: the lifted layer on every shadow
			//    camera. The caster is eligible again and the predicate is empty.
			for (const light of scene.lights) light.shadow.camera.layers.enable(LIFTED_RENDER_LAYER);
			scene.lights.forEach((light, index) => {
				expect(shadowedSet(light, camera, scene.root)).toEqual(shadowed[index]!);
			});
			expect(unshadowableCastingLids(scene.lights[0]!, camera, lids)).toEqual([]);
			expect(unshadowableCastingLids(scene.lights[1]!, camera, lids)).toEqual([]);
		} finally {
			scene.dispose();
		}
	});
});

/** Every mesh's caster and receiver flags, in scene order, as one comparable list. */
function castStateOf(root: Object3D): Array<[string, boolean, boolean]> {
	const state: Array<[string, boolean, boolean]> = [];
	root.traverse((object) => {
		const mesh = object as Mesh;
		if (mesh.isMesh !== true) return;
		state.push([mesh.name, mesh.castShadow, mesh.receiveShadow]);
	});
	return state;
}
