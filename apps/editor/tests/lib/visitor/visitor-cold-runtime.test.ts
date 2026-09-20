import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	loadEffectiveTextures,
	resetTextureCachesForTests,
	__resetDefaultSourceLoaderForTests,
	setDefaultTextureSourceLoader,
	acquireEffectiveVariant,
	releaseEffectiveVariant,
	type TextureLoadScope
} from '$lib/museum/materials/texture-cache';
import { remapModelMaterials, releaseModelMaterialRemap } from '$lib/museum/assets/instance-material-remap';
import {
	createReleaseTextureScope,
	type ReleaseBytesEntry
} from '$lib/visitor/visitor-texture-scope';
import {
	composeColdReleaseBundle,
	isRootRelativeSafe,
	validateColdReleaseReferences
} from '$lib/visitor/visitor-cold-runtime';
import { isSafeTextureUri as canonicalIsSafeTextureUri } from '$lib/content/texture-uri';
import {
	SHIPPED_STATIC_REGISTRY_VERSION,
	isAllowedShippedTextureUri,
	getShippedMaterialById,
	getShippedModelByAssetId,
	listShippedTextureUris,
	listShippedModelFiles
} from '$lib/visitor/shipped-static-registry';
import { createEmptyProject } from '@portfolio/project-model';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import type { Texture as ThreeTexture } from 'three';

function fakeTexture(id: string): ThreeTexture {
	return {
		uuid: id,
		isTexture: true,
		image: { complete: true },
		needsUpdate: false,
		colorSpace: '',
		wrapS: 0,
		wrapT: 0,
		repeat: { set() {}, x: 1, y: 1 },
		rotation: 0,
		center: { set() {} },
		clone(this: ThreeTexture) {
			return { ...this, uuid: `${id}#clone` } as unknown as ThreeTexture;
		},
		dispose() {}
	} as unknown as ThreeTexture;
}

function scopeWith(loader: (uri: string) => Promise<ThreeTexture>, scopeId: string): TextureLoadScope {
	return { scopeId, loader: ((uri: string) => loader(uri)) as TextureLoadScope['loader'] };
}

describe('P22.1 cold runtime + asset seam', () => {
	beforeEach(() => {
		resetTextureCachesForTests();
		__resetDefaultSourceLoaderForTests();
	});

	afterEach(() => {
		resetTextureCachesForTests();
		__resetDefaultSourceLoaderForTests();
	});

	it('renders a custom P20 texture from supplied bytes with no global loader', async () => {
		// No editor setup: global loader stays null throughout.
		setDefaultTextureSourceLoader(null);
		const p20Uri = '/project-assets/custom-tex-1';
		const tex = fakeTexture('p20-bytes-A');
		const loader = vi.fn(async (uri: string) => {
			expect(uri).toBe(p20Uri);
			return tex;
		});
		const scope = scopeWith(loader, 'project-a@v1');
		const result = await loadEffectiveTextures(
			{
				catalogue: 'plaster-warm',
				slotUris: { map: p20Uri },
				roughness: 0.9,
				metalness: 0,
				color: '#ffffff',
				defaultTileSizeMeters: [1, 1],
				variantSeed: 'vP20A'
			},
			scope
		);
		expect(result.status).toBe('ready');
		expect(loader).toHaveBeenCalledTimes(1);
		expect(loader).toHaveBeenCalledWith(p20Uri);
	});

	it('texture override on a built-in model uses the supplied resolver', async () => {
		const overrideUri = '/project-assets/override-1';
		const tex = fakeTexture('override-bytes');
		const loader = vi.fn(async () => tex);
		const scope = scopeWith(loader, 'project-a@v1');
		const effective = {
			catalogue: 'plaster-warm' as const,
			slotUris: { map: overrideUri },
			roughness: 0.9,
			metalness: 0,
			color: '#ffffff',
			defaultTileSizeMeters: [1, 1] as [number, number],
			variantSeed: 'vOVERRIDE1'
		};
		const loaded = await loadEffectiveTextures(effective, scope);
		expect(loaded.status).toBe('ready');
		expect(loader).toHaveBeenCalledWith(overrideUri);

		const group = new Group();
		group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
		const { acquiredKey } = remapModelMaterials(group, effective, [1, 1], scope);
		expect(acquiredKey.scopeId).toBe('project-a@v1');
		const mesh = group.children[0] as Mesh;
		const material = mesh.material as MeshStandardMaterial;
		expect(material.map).toBeDefined();
		releaseModelMaterialRemap(acquiredKey, scope);
	});

	it('colliding logical URIs in two releases do not share textures', async () => {
		const uri = '/project-assets/shared-logical';
		const texA = fakeTexture('bytes-A');
		const texB = fakeTexture('bytes-B');
		const loaderA = vi.fn(async () => texA);
		const loaderB = vi.fn(async () => texB);
		const scopeA = scopeWith(loaderA, 'project-a@v1');
		const scopeB = scopeWith(loaderB, 'project-b@v9');
		const effective = {
			catalogue: 'plaster-warm' as const,
			slotUris: { map: uri },
			roughness: 0.9,
			metalness: 0,
			color: '#ffffff',
			defaultTileSizeMeters: [1, 1] as [number, number],
			variantSeed: 'vSHARED'
		};
		const [a, b] = await Promise.all([
			loadEffectiveTextures(effective, scopeA),
			loadEffectiveTextures(effective, scopeB)
		]);
		expect(a.status).toBe('ready');
		expect(b.status).toBe('ready');
		expect(loaderA).toHaveBeenCalledTimes(1);
		expect(loaderB).toHaveBeenCalledTimes(1);
		if (a.status === 'ready' && b.status === 'ready') {
			expect(a.maps.map).toBe(texA);
			expect(b.maps.map).toBe(texB);
			expect(a.maps.map).not.toBe(b.maps.map);
		}
		const variantA = acquireEffectiveVariant(effective, 1, 1, 0, scopeA);
		const variantB = acquireEffectiveVariant(effective, 1, 1, 0, scopeB);
		expect(variantA).not.toBe(variantB);
		expect(variantA.map?.uuid).not.toBe(variantB.map?.uuid);
		releaseEffectiveVariant(effective.variantSeed, 1, 1, 0, scopeA);
		releaseEffectiveVariant(effective.variantSeed, 1, 1, 0, scopeB);
		// Extra releases are idempotent.
		releaseEffectiveVariant(effective.variantSeed, 1, 1, 0, scopeA);
	});

	it('shipped-static registry is checked in, versioned, and present on disk', () => {
		expect(SHIPPED_STATIC_REGISTRY_VERSION).toBe(1);
		expect(isAllowedShippedTextureUri('/textures/plaster-warm/map.png')).toBe(true);
		expect(isAllowedShippedTextureUri('/textures/wall-detail.webp')).toBe(false);
		expect(getShippedMaterialById('plaster-warm')?.textureUris).toContain(
			'/textures/plaster-warm/map.png'
		);
		expect(getShippedModelByAssetId('paris-grand-piano')?.productionFile).toBe(
			'/museum/models/piano/grand-piano.glb'
		);
		// Fallback-only placeholders resolve as known assets with no bytes.
		expect(getShippedModelByAssetId('paris-writing-desk')?.fallbackOnly).toBe(true);

		const testDir = dirname(fileURLToPath(import.meta.url));
		const staticRoot = resolve(testDir, '../../../static');
		for (const uri of listShippedTextureUris()) {
			expect(existsSync(resolve(staticRoot, uri.slice(1))), uri).toBe(true);
		}
		for (const file of listShippedModelFiles()) {
			expect(existsSync(resolve(staticRoot, file.slice(1))), file).toBe(true);
		}
	});

	it('catalogue-implied dependencies validate without P20 bytes (drift-proof)', () => {
		const issues = validateColdReleaseReferences(
			{
				scene: {
					textures: [],
					materials: [],
					entities: [{ kind: 'primitive', materialId: 'plaster-warm', materialInstanceId: null }]
				},
				manifest: { releaseId: 'r1', bytesByUri: new Map() }
			}
		);
		expect(issues).toEqual([]);
	});

	it('release reference validation rejects session-local, unknown, and missing sources', () => {
		const bytes = new Map<string, ReleaseBytesEntry>();
		expect(
			validateColdReleaseReferences({
				scene: {
					textures: [{ id: 't1', name: 'Local', uri: '/local/abcdef123456/albedo.png' }],
					materials: [],
					entities: []
				},
				manifest: { releaseId: 'r1', bytesByUri: bytes }
			}).length
		).toBeGreaterThan(0);
		expect(
			validateColdReleaseReferences({
				scene: {
					textures: [{ id: 't1', name: 'Mystery', uri: '/textures/mystery-pack/map.png' }],
					materials: [],
					entities: []
				},
				manifest: { releaseId: 'r1', bytesByUri: bytes }
			}).length
		).toBeGreaterThan(0);
		expect(
			validateColdReleaseReferences({
				scene: {
					textures: [{ id: 't1', name: 'Missing', uri: '/project-assets/gone' }],
					materials: [],
					entities: []
				},
				manifest: { releaseId: 'r1', bytesByUri: bytes }
			}).length
		).toBeGreaterThan(0);
		expect(
			validateColdReleaseReferences({
				scene: {
					textures: [{ id: 't1', name: 'Data', uri: 'data:image/png;base64,AAAA' }],
					materials: [],
					entities: []
				},
				manifest: { releaseId: 'r1', bytesByUri: bytes }
			}).length
		).toBeGreaterThan(0);
	});

	it('composes an empty project store-free and disposes cleanly', () => {
		setDefaultTextureSourceLoader(null);
		const project = createEmptyProject({ id: 'project:cold-a', name: 'Cold A' });
		const bundle = composeColdReleaseBundle({
			projectId: project.id,
			projectName: project.name,
			layout: project.layout,
			scene: project.scene,
			manifest: { releaseId: `${project.id}@v1`, bytesByUri: new Map() }
		});
		expect(bundle.graph.navigationNodes).toHaveLength(0);
		expect(bundle.textureScope.resolveTexture('/textures/plaster-warm/map.png')).toBe(
			'/textures/plaster-warm/map.png'
		);
		expect(bundle.textureScope.resolveTexture('/project-assets/missing')).toBeNull();
		bundle.dispose();
		bundle.dispose();
		expect(bundle.textureScope.resolveTexture('/textures/plaster-warm/map.png')).toBeNull();
	});

	it('composes a P20-textured release from supplied bytes; missing bytes fail closed', () => {
		const project = createEmptyProject({ id: 'project:cold-b', name: 'Cold B' });
		const uri = '/project-assets/pinned-1';
		const scene = {
			...project.scene,
			textures: [{ id: 'tex-1', name: 'Pinned', uri }]
		};
		const bytes = new Map<string, ReleaseBytesEntry>([
			[uri, { bytes: new Uint8Array([137, 80, 78, 71]), mime: 'image/png' }]
		]);
		const bundle = composeColdReleaseBundle({
			projectId: project.id,
			projectName: project.name,
			layout: project.layout,
			scene,
			manifest: { releaseId: `${project.id}@v3`, bytesByUri: bytes }
		});
		expect(bundle.textureScope.objectUrlByUri.has(uri)).toBe(true);
		bundle.dispose();

		expect(() =>
			composeColdReleaseBundle({
				projectId: project.id,
				projectName: project.name,
				layout: project.layout,
				scene,
				manifest: { releaseId: `${project.id}@v4`, bytesByUri: new Map() }
			})
		).toThrow(/missing release bytes/i);
	});

	it('failed scope creation releases partial URLs (no leak)', () => {
		const created: string[] = [];
		const revoked: string[] = [];
		const originalCreate = URL.createObjectURL;
		const originalRevoke = URL.revokeObjectURL;
		URL.createObjectURL = vi.fn(() => {
			const url = `blob:test/${created.length + 1}`;
			created.push(url);
			return url;
		});
		URL.revokeObjectURL = vi.fn((url: string) => {
			revoked.push(url);
		});
		try {
			expect(() =>
				createReleaseTextureScope({
					releaseId: 'r-fail',
					bytesByUri: new Map<string, ReleaseBytesEntry>([
						['/project-assets/ok', { bytes: new Uint8Array([1, 2, 3]), mime: 'image/png' }],
						['/project-assets/empty', { bytes: new Uint8Array(0), mime: 'image/png' }]
					])
				})
			).toThrow(/no bytes/i);
			expect(created).toHaveLength(1);
			expect(revoked).toEqual(created);
		} finally {
			URL.createObjectURL = originalCreate;
			URL.revokeObjectURL = originalRevoke;
		}
	});

	it('scope dispose revokes URLs and is idempotent', () => {
		const revoked: string[] = [];
		const originalRevoke = URL.revokeObjectURL;
		URL.revokeObjectURL = vi.fn((url: string) => {
			revoked.push(url);
		});
		try {
			const scope = createReleaseTextureScope({
				releaseId: 'r-dispose',
				bytesByUri: new Map<string, ReleaseBytesEntry>([
					['/project-assets/a', { bytes: new Uint8Array([1]), mime: 'image/png' }]
				])
			});
			const url = scope.resolveTexture('/project-assets/a');
			expect(url?.startsWith('blob:')).toBe(true);
			scope.dispose();
			scope.dispose();
			expect(revoked).toHaveLength(1);
			expect(scope.resolveTexture('/project-assets/a')).toBeNull();
		} finally {
			URL.revokeObjectURL = originalRevoke;
		}
	});

	it('registry is append-only: golden snapshot fails on removal, allows additions', () => {
		// An existing release keeps resolving after a later catalogue/deploy
		// change only if entries are never removed or renamed. Pin the P22.1
		// set here: deletions break this test by design; additions pass.
		const pinnedTextures = [
			'/textures/plaster-warm/map.png',
			'/textures/plaster-warm/roughness.png',
			'/textures/wood-walnut/map.png',
			'/textures/wood-walnut/roughness.png',
			'/textures/brass-aged/map.png'
		];
		const pinnedModels = [
			'/museum/models/piano/grand-piano.glb',
			'/museum/models/furniture/chair/salon-chair.glb',
			'/museum/models/furniture/sofa/sofa-03.glb',
			'/museum/models/furniture/table/salon-table.glb',
			'/museum/models/decor/chandelier/chandelier2.glb',
			'/museum/models/decor/oil-lamp/victorian-oil-lamp.glb',
			'/museum/models/decor/clock/grandfather-clock.glb'
		];
		const actualTextures = listShippedTextureUris();
		const actualModels = listShippedModelFiles();
		for (const uri of pinnedTextures) {
			expect(actualTextures, `removed registry texture: ${uri}`).toContain(uri);
		}
		for (const file of pinnedModels) {
			expect(actualModels, `removed registry model: ${file}`).toContain(file);
		}
		// Every registry texture must stay allowlisted even if the live
		// catalogue later drops the material that implied it.
		for (const uri of listShippedTextureUris()) {
			expect(isAllowedShippedTextureUri(uri), uri).toBe(true);
		}
	});

	it('cold modules are self-contained: deleting the live catalogue cannot break release validation', () => {
		// Simulates the "later catalogue change" by proving the cold path
		// never reads it: no live-catalogue or session imports in the three
		// new modules, and validation passes without them.
		const testDir = dirname(fileURLToPath(import.meta.url));
		const sources = [
			'visitor-cold-runtime.ts',
			'visitor-texture-scope.ts',
			'shipped-static-registry.ts'
		].map((file) => readFileSync(resolve(testDir, '../../../src/lib/visitor', file), 'utf8'));
		for (const source of sources) {
			for (const token of [
				'$lib/editor/',
				'content/materials',
				'content/assets',
				'content/scene',
				'content/rooms',
				'chopin-',
				'project-codec',
				'export-store',
				'texture-store'
			]) {
				expect(source, token).not.toContain(token);
			}
		}
		expect(sources[0]).toContain('@portfolio/project-model');
		// A release built from registry identities alone validates with an
		// empty manifest — no live catalogue read involved.
		expect(
			validateColdReleaseReferences({
				scene: {
					textures: [{ id: 't1', name: 'Plaster', uri: '/textures/plaster-warm/map.png' }],
					materials: [],
					entities: [{ kind: 'model', assetId: 'paris-grand-piano', materialInstanceId: null }]
				},
				manifest: { releaseId: 'r-drift', bytesByUri: new Map() }
			})
		).toEqual([]);
	});

	it('release URI guard matches the canonical safe-URI predicate (no drift)', () => {
		const corpus = [
			'/textures/a.png',
			'/textures/plaster-warm/map.png',
			'/textures/space%20name.png',
			'/project-assets/abc_123-XY',
			'/local/abcdef123456/a.png',
			'/textures/package-abcdef123456/a.png',
			'//evil.com/x.png',
			'/a/../b.png',
			'/a/./b.png',
			'/a?b',
			'/a#b',
			'/a\\b',
			'blob:https://x/y',
			'data:image/png;base64,AAAA',
			'https://x/y.png',
			'/textures/%2e%2e/secret.png',
			'/textures/%252e%252e/secret.png',
			'/textures/\x01bad.png',
			''
		];
		for (const uri of corpus) {
			expect(isRootRelativeSafe(uri), uri).toBe(canonicalIsSafeTextureUri(uri));
		}
	});

	it('registry resources survive into production build output', () => {
		const testDir = dirname(fileURLToPath(import.meta.url));
		const staticRoot = resolve(testDir, '../../../static');
		const clientRoot = resolve(testDir, '../../../.svelte-kit/output/client');
		if (!existsSync(clientRoot)) {
			// No production build in this checkout — static/ coverage above is
			// the durable assertion; the built-output half runs post-build.
			expect(existsSync(staticRoot)).toBe(true);
			return;
		}
		for (const uri of listShippedTextureUris()) {
			expect(existsSync(resolve(clientRoot, uri.slice(1))), `build output: ${uri}`).toBe(true);
		}
		for (const file of listShippedModelFiles()) {
			expect(existsSync(resolve(clientRoot, file.slice(1))), `build output: ${file}`).toBe(true);
		}
	});
});
