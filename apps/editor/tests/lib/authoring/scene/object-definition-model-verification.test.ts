import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { Box3, Group, REVISION, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { cloneModelScene, disposeModelInstance } from '$lib/museum/assets/model-utils';
import { getAssetById } from '$lib/content/assets';
import { CATALOGUE_MODEL_CONTACT_RECORDS, catalogueModelDefinition } from '$lib/authoring/scene/object-definition-policy';

describe('catalogue admission on the retained r186 geometry path', () => {
	it('reproduces the piano footprint/contact mismatch with normalization applied once', async () => {
		expect(REVISION).toBe('186');
		const asset = getAssetById('paris-grand-piano')!;
		const bytes = await readFile(new URL('../../../../static' + asset.productionFile, import.meta.url));
		const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
		// No browser image decoder is needed to disprove geometric admission. Only
		// WebP textures are substituted; Meshopt, transforms, meshes and accessors
		// follow the real loader. This cannot establish material/readiness admission.
		const textures: Texture[] = [];
		loader.register(() => ({
			name: 'EXT_texture_webp', loadTexture: () => {
				const texture = new Texture(); textures.push(texture); return Promise.resolve(texture);
			}
		}));
		const gltf = await loader.parseAsync(Uint8Array.from(bytes).buffer, '');
		const sourceScale = gltf.scene.scale.toArray();
		const instance = cloneModelScene(gltf.scene, asset.castShadow, asset.receiveShadow);
		const root = new Group();
		root.scale.setScalar(asset.defaultScale);
		if (asset.defaultRotation) root.rotation.set(...asset.defaultRotation);
		root.add(instance); root.updateMatrixWorld(true);
		try {
			const bounds = new Box3().setFromObject(root, true);
			const observed = CATALOGUE_MODEL_CONTACT_RECORDS.find(record => record.assetId === asset.id)!.verificationFailure!;
			expect(bounds.min.y).toBeCloseTo(observed.contactMinY, 10);
			expect(bounds.max.x - bounds.min.x).toBeCloseTo(observed.footprintWidth, 10);
			expect(bounds.max.z - bounds.min.z).toBeCloseTo(observed.footprintDepth, 10);
			expect(bounds.max.z - bounds.min.z).toBeGreaterThan(asset.footprint!.depth + 0.9);
			expect(bounds.min.y).toBeGreaterThan(1e-6);
			expect(await catalogueModelDefinition(asset.id)).toBeNull();
			expect(gltf.scene.scale.toArray()).toEqual(sourceScale);
			expect(gltf.scene.parent).toBeNull();
		} finally {
			// Retained clone ownership: instance materials only. Source cache geometry
			// and source materials remain the loader owner's responsibility.
			disposeModelInstance(instance);
			root.remove(instance);
			gltf.scene.traverse(object => {
				const mesh = object as import('three').Mesh;
				if (!mesh.isMesh) return;
				mesh.geometry.dispose();
				for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
			});
			for (const texture of textures) texture.dispose();
		}
	});

	it('verifies the salon chair contact and conservatively rounded footprint after normalization once', async () => {
		expect(REVISION).toBe('186');
	const asset = getAssetById('paris-salon-chair')!;
	const bytes = await readFile(new URL('../../../../static' + asset.productionFile, import.meta.url));
	const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
	const textures: Texture[] = [];
	loader.register(() => ({
		name: 'EXT_texture_webp',
		loadTexture: () => {
			const texture = new Texture();
			textures.push(texture);
			return Promise.resolve(texture);
		}
	}));
	const gltf = await loader.parseAsync(Uint8Array.from(bytes).buffer, '');
	const sourceScale = gltf.scene.scale.toArray();
	const instance = cloneModelScene(gltf.scene, asset.castShadow, asset.receiveShadow);
	const root = new Group();
	root.scale.setScalar(asset.defaultScale);
	if (asset.defaultRotation) root.rotation.set(...asset.defaultRotation);
	root.add(instance);
	root.updateMatrixWorld(true);
	try {
		const bounds = new Box3().setFromObject(root, true);
		const extent = bounds.getSize(new Vector3());
		const record = CATALOGUE_MODEL_CONTACT_RECORDS.find((entry) => entry.assetId === asset.id)!;
		expect(record.verified).toBe(true);
		expect(record.contactSource).toBe('r186-loader-verification');
		expect(record.verificationId).toBe('r186-salon-chair-contact-footprint-v1');
		expect(bounds.min.y).toBeCloseTo(record.contactMinY, 10);
		expect(bounds.min.y).toBeCloseTo(0, 10);
		expect(extent.x).toBeLessThanOrEqual(asset.footprint!.width);
		expect(extent.z).toBeLessThanOrEqual(asset.footprint!.depth);
		expect(asset.footprint!.width - extent.x).toBeLessThan(0.001);
		expect(asset.footprint!.depth - extent.z).toBeLessThan(0.001);
		expect(await catalogueModelDefinition(asset.id)).not.toBeNull();
		expect(gltf.scene.scale.toArray()).toEqual(sourceScale);
		expect(gltf.scene.parent).toBeNull();
	} finally {
		disposeModelInstance(instance);
		root.remove(instance);
		gltf.scene.traverse(object => {
			const mesh = object as import('three').Mesh;
			if (!mesh.isMesh) return;
			mesh.geometry.dispose();
			for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
		});
		for (const texture of textures) texture.dispose();
	}
	});
});
