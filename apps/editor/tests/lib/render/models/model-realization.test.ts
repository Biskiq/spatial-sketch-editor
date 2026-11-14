/**
 * E8/R5 + R2c — model realization: clone parity, skeleton independence, shared
 * surfaces, scoped teardown and the stale-arrival gate, through the real store
 * and the real texture cache (only the GPU-side texture source is a fake).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AnimationClip,
	AnimationMixer,
	Bone,
	BoxGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	QuaternionKeyframeTrack,
	SkinnedMesh,
	Skeleton,
	Texture,
	type Object3D
} from 'three';
import {
	cloneModelHierarchy,
	createArrivalGate,
	meshesOf,
	modelLookFor,
	realizeModel,
	type ModelLook
} from '$lib/render/models/model-realization';
import { createMaterialStore } from '$lib/render/resources/material-store';
import {
	flushDeferredTextureReleases,
	loadEffectiveTextures,
	resetTextureCachesForTests,
	type TextureLoadScope
} from '$lib/render/resources/texture-store';
import type { EffectiveSceneMaterial } from '$lib/museum/materials/scene-instance-material';

const LOOK_A: ModelLook = { material: { color: '#c4b4a0', roughness: 0.9, metalness: 0 }, texture: null };
const LOOK_B: ModelLook = { material: { color: '#2b3d5c', roughness: 0.4, metalness: 0.1 }, texture: null };

function template(): Group {
	const group = new Group();
	group.name = 'template';
	group.position.set(1, 0, 2);
	for (let i = 0; i < 3; i += 1) {
		const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x808080 }));
		mesh.name = `part-${i}`;
		mesh.position.set(i, 0, 0);
		group.add(mesh);
	}
	return group;
}

function skinnedTemplate(): { root: Group; bone: Bone; skeleton: Skeleton } {
	const root = new Group();
	const bone = new Bone();
	bone.name = 'arm';
	const skeleton = new Skeleton([bone]);
	const mesh = new SkinnedMesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial());
	mesh.add(bone);
	mesh.bind(skeleton);
	root.add(mesh);
	return { root, bone, skeleton };
}

function spinClip(): AnimationClip {
	return new AnimationClip('spin', 1, [
		new QuaternionKeyframeTrack('arm.quaternion', [0, 1], [0, 0, 0, 1, 0, 0.7071068, 0, 0.7071068])
	]);
}

function surfacesOf(root: Object3D): Mesh[] {
	return meshesOf(root);
}

function allMaterials(roots: readonly Object3D[]): Set<unknown> {
	const materials = new Set<unknown>();
	for (const root of roots) {
		for (const mesh of surfacesOf(root)) materials.add(mesh.material);
	}
	return materials;
}

describe('static clone parity (E8/R5)', () => {
	it('keeps the template hierarchy, transforms and geometry', () => {
		const source = template();
		const instance = cloneModelHierarchy(source);
		expect(instance).not.toBe(source);
		expect(instance.position.toArray()).toEqual([1, 0, 2]);
		expect(instance.children.map((child) => child.name)).toEqual(['part-0', 'part-1', 'part-2']);
		const drawn = surfacesOf(instance);
		const original = surfacesOf(source);
		drawn.forEach((mesh, index) => {
			expect(mesh.geometry).toBe(original[index]!.geometry);
			expect(mesh.position.toArray()).toEqual(original[index]!.position.toArray());
		});
	});

	it('draws an unstyled instance with a store-owned copy, never the template material', () => {
		const source = template();
		const store = createMaterialStore();
		const realization = realizeModel(source, {
			asset: 'static-asset',
			store,
			look: null,
			wireframe: false,
			castShadow: true,
			receiveShadow: true
		});
		const drawn = surfacesOf(realization.root);
		const templateMaterials = surfacesOf(source).map((mesh) => mesh.material);
		for (const mesh of drawn) {
			expect(templateMaterials).not.toContain(mesh.material);
			expect(mesh.castShadow).toBe(true);
			expect(mesh.receiveShadow).toBe(true);
		}
		expect(store.stats().live).toBe(3);
		realization.release();
		expect(store.stats().live).toBe(0);
	});
});

describe('skinned clone independence (E8/R5)', () => {
	it('binds every instance to its own skeleton', () => {
		const { root, skeleton } = skinnedTemplate();
		const a = cloneModelHierarchy(root) as Group;
		const b = cloneModelHierarchy(root) as Group;
		const skinnedA = a.children[0] as SkinnedMesh;
		const skinnedB = b.children[0] as SkinnedMesh;
		expect(skinnedA.skeleton).not.toBe(skeleton);
		expect(skinnedB.skeleton).not.toBe(skeleton);
		expect(skinnedA.skeleton).not.toBe(skinnedB.skeleton);
		expect(skinnedA.skeleton.bones[0]).not.toBe(skinnedB.skeleton.bones[0]);
		expect(skinnedA.skeleton.bones[0]!.parent).toBe(skinnedA);
	});

	it('plays an animation on one instance and leaves the others and the template at rest', () => {
		const { root, bone } = skinnedTemplate();
		const restQuaternion = bone.quaternion.clone();
		const a = cloneModelHierarchy(root) as Group;
		const b = cloneModelHierarchy(root) as Group;
		const mixer = new AnimationMixer(a);
		mixer.clipAction(spinClip()).play();
		mixer.update(0.5);
		const boneA = (a.children[0] as SkinnedMesh).skeleton.bones[0]!;
		const boneB = (b.children[0] as SkinnedMesh).skeleton.bones[0]!;
		expect(boneA.quaternion.equals(restQuaternion)).toBe(false);
		expect(boneB.quaternion.equals(restQuaternion)).toBe(true);
		expect(bone.quaternion.equals(restQuaternion)).toBe(true);
		mixer.stopAllAction();
	});
});

describe('shared surfaces (E8/R2c)', () => {
	it('N instances of one look hold one material per mesh', () => {
		const source = template();
		const store = createMaterialStore();
		const instances = Array.from({ length: 8 }, () =>
			realizeModel(source, { asset: 'shared', store, look: LOOK_A, wireframe: false, castShadow: true, receiveShadow: true })
		);
		expect(allMaterials(instances.map((instance) => instance.root)).size).toBe(3);
		expect(store.stats().live).toBe(3);
		expect(store.stats().created).toBe(3);
		for (const instance of instances) expect(instance.leaseCount()).toBe(3);
	});

	it('N instances over m looks hold m materials per mesh, not N', () => {
		const source = template();
		const store = createMaterialStore();
		const looks = [LOOK_A, LOOK_B];
		const instances = Array.from({ length: 8 }, (_, index) =>
			realizeModel(source, {
				asset: 'variants',
				store,
				look: looks[index % 2]!,
				wireframe: false,
				castShadow: true,
				receiveShadow: true
			})
		);
		// Two looks, three meshes each: six materials for eight instances.
		expect(allMaterials(instances.map((instance) => instance.root)).size).toBe(6);
		expect(store.stats().live).toBe(6);
	});

	it('an unstyled template is one store copy per mesh, shared by every instance', () => {
		const source = template();
		const store = createMaterialStore();
		const instances = Array.from({ length: 5 }, () =>
			realizeModel(source, { asset: 'imported', store, look: null, wireframe: false, castShadow: true, receiveShadow: true })
		);
		expect(allMaterials(instances.map((instance) => instance.root)).size).toBe(3);
		expect(store.stats().created).toBe(3);
	});

	it('releasing one instance never disposes a material another instance still leases', () => {
		const source = template();
		const store = createMaterialStore();
		const a = realizeModel(source, { asset: 'shared', store, look: LOOK_A, wireframe: false, castShadow: true, receiveShadow: true });
		const b = realizeModel(source, { asset: 'shared', store, look: LOOK_A, wireframe: false, castShadow: true, receiveShadow: true });
		const survivor = surfacesOf(b.root)[0]!.material as MeshStandardMaterial;
		const disposeSpy = vi.spyOn(survivor, 'dispose');
		a.release();
		expect(disposeSpy).not.toHaveBeenCalled();
		expect(store.stats().live).toBe(3);
		expect(surfacesOf(b.root)[0]!.material).toBe(survivor);
		b.release();
		expect(disposeSpy).toHaveBeenCalledTimes(1);
		expect(store.stats().live).toBe(0);
	});

	it('never disposes the template materials, even when the last instance is released', () => {
		const source = template();
		const templateMaterials = surfacesOf(source).map((mesh) => mesh.material as MeshStandardMaterial);
		const spies = templateMaterials.map((material) => vi.spyOn(material, 'dispose'));
		const store = createMaterialStore();
		const instance = realizeModel(source, { asset: 'imported', store, look: null, wireframe: false, castShadow: true, receiveShadow: true });
		instance.release();
		for (const spy of spies) expect(spy).not.toHaveBeenCalled();
	});

	it('restyling to an identical look creates nothing new, and restyling away gives the lease back', () => {
		const source = template();
		const store = createMaterialStore();
		const instance = realizeModel(source, { asset: 'shared', store, look: LOOK_A, wireframe: false, castShadow: true, receiveShadow: true });
		const before = store.stats().created;
		instance.restyle({ look: LOOK_A, wireframe: false, castShadow: true, receiveShadow: true });
		expect(store.stats().created).toBe(before);
		expect(store.stats().live).toBe(3);
		instance.restyle({ look: LOOK_B, wireframe: false, castShadow: true, receiveShadow: true });
		expect(store.stats().live).toBe(3);
		instance.restyle({ look: null, wireframe: false, castShadow: true, receiveShadow: true });
		expect(store.stats().live).toBe(3);
		instance.release();
		expect(store.stats().live).toBe(0);
	});

	it('release is idempotent and refuses a restyle afterwards', () => {
		const store = createMaterialStore();
		const instance = realizeModel(template(), { asset: 'shared', store, look: LOOK_A, wireframe: false, castShadow: true, receiveShadow: true });
		instance.release();
		instance.release();
		expect(instance.leaseCount()).toBe(0);
		expect(() => instance.restyle({ look: LOOK_A, wireframe: false, castShadow: true, receiveShadow: true })).toThrow();
	});
});

describe('textured looks (E8/R2c)', () => {
	beforeEach(() => {
		resetTextureCachesForTests();
	});

	afterEach(() => {
		flushDeferredTextureReleases();
		resetTextureCachesForTests();
	});

	function textured(seed: string, uri: string) {
		const loader = vi.fn((_uri: string) => Promise.resolve(new Texture()));
		const scope: TextureLoadScope = { scopeId: `models-${seed}`, loader: ((u: string) => loader(u)) as TextureLoadScope['loader'] };
		const effective: EffectiveSceneMaterial = {
			catalogue: null,
			slotUris: { map: uri },
			roughness: 0.8,
			metalness: 0,
			color: '#ffffff',
			defaultTileSizeMeters: [1, 1],
			variantSeed: seed
		};
		return { effective, scope, loader };
	}

	it('binds one texture variant per instance and gives it back with the instance', async () => {
		const { effective, scope, loader } = textured('t-models-1', '/project/brick.png');
		const loaded = await loadEffectiveTextures(effective, scope);
		expect(loaded.status).toBe('ready');
		expect(loader).toHaveBeenCalledTimes(1);
		const store = createMaterialStore();
		const source = template();
		const look = modelLookFor(effective, scope, true);
		const a = realizeModel(source, { asset: 'textured', store, look, wireframe: false, castShadow: true, receiveShadow: true });
		const b = realizeModel(source, { asset: 'textured', store, look, wireframe: false, castShadow: true, receiveShadow: true });
		const material = surfacesOf(a.root)[0]!.material as MeshStandardMaterial;
		expect(material.map).toBeDefined();
		expect(surfacesOf(b.root)[0]!.material).toBe(material);
		expect(a.leaseCount()).toBe(4);
		a.release();
		expect(b.leaseCount()).toBe(4);
		b.release();
		flushDeferredTextureReleases();
		expect(store.stats().live).toBe(0);
	});

	it('an untextured look binds no variant and holds no texture lease', () => {
		const store = createMaterialStore();
		const instance = realizeModel(template(), {
			asset: 'plain',
			store,
			look: LOOK_A,
			wireframe: false,
			castShadow: true,
			receiveShadow: true
		});
		expect(instance.leaseCount()).toBe(3);
		instance.release();
	});
});

describe('arrival gate (E8 stale-arrival rejection)', () => {
	it('accepts only the newest load', () => {
		const gate = createArrivalGate();
		const first = gate.begin();
		expect(gate.accepts(first)).toBe(true);
		const second = gate.begin();
		expect(gate.accepts(first)).toBe(false);
		expect(gate.accepts(second)).toBe(true);
	});

	it('invalidates every outstanding token on close, so a teardown mounts nothing late', () => {
		const gate = createArrivalGate();
		const token = gate.begin();
		gate.close();
		expect(gate.accepts(token)).toBe(false);
	});
});

describe('realization identity', () => {
	it('names every mesh by its depth-first index, the identity a remap is keyed by', () => {
		const source = template();
		expect(surfacesOf(source).map((mesh) => mesh.name)).toEqual(['part-0', 'part-1', 'part-2']);
		const store = createMaterialStore();
		const instance = realizeModel(source, { asset: 'identity', store, look: null, wireframe: false, castShadow: false, receiveShadow: false });
		expect(surfacesOf(instance.root).map((mesh) => mesh.name)).toEqual(['part-0', 'part-1', 'part-2']);
		instance.release();
	});
});
