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
} from '$lib/render/resources/texture-store';
import { modelLookFor, realizeModel } from '$lib/render/models/model-realization';
import { createMaterialStore } from '$lib/render/resources/material-store';
import type { EffectiveSceneMaterial } from '$lib/render/materials/scene-instance-material';
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
import {
	MODEL_RESOURCE_MIME,
	RESOURCE_UNIT_FORMAT_VERSION,
	skyFromPreset,
	SCENE_UNIT_FORMAT_VERSION
} from '@portfolio/project-model/units';
import { createUnitProject } from '../authoring/__fixtures__/unit-envelope-fixtures';
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
		offset: { set() {}, x: 0, y: 0 },
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
		vi.unstubAllGlobals();
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
		const effective: EffectiveSceneMaterial = {
			catalogue: 'plaster-warm',
			slotUris: { map: p20Uri },
			roughness: 0.9,
			metalness: 0,
			color: '#ffffff',
			defaultTileSizeMeters: [1, 1],
			rotation: 0,
			offset: [0, 0],
			normalScale: null,
			variantSeed: 'vP20A'
		};
		const result = await loadEffectiveTextures(effective, scope);
		expect(result.status).toBe('ready');
		expect(loader).toHaveBeenCalledTimes(1);
		expect(loader).toHaveBeenCalledWith(p20Uri);
	});

	it('loads shipped Warm Plaster and Walnut roughness maps through the raw policy', async () => {
		const testDir = dirname(fileURLToPath(import.meta.url));
		const fetchMock = vi.fn(async (input: string) => ({
			ok: true,
			status: 200,
			blob: async () => ({
				arrayBuffer: async () =>
					Uint8Array.from(readFileSync(resolve(testDir, '../../../static', input.slice(1))))
			})
		}));
		vi.stubGlobal('fetch', fetchMock);
		const bitmaps: Array<{ width: number; height: number; close: ReturnType<typeof vi.fn> }> = [];
		const createBitmap = vi.fn(async (_blob: Blob, options: ImageBitmapOptions) => {
			expect(options).toEqual({
				imageOrientation: 'none',
				premultiplyAlpha: 'none',
				colorSpaceConversion: 'none'
			});
			const bitmap = { width: 256, height: 256, close: vi.fn() };
			bitmaps.push(bitmap);
			return bitmap;
		});
		vi.stubGlobal('createImageBitmap', createBitmap);
		const scope = createReleaseTextureScope({
			releaseId: 'release-shipped-raw',
			bytesByUri: new Map<string, ReleaseBytesEntry>()
		});
		const loader = scope.createSourceLoader();
		const uris = [
			'/textures/plaster-warm/roughness.png',
			'/textures/wood-walnut/roughness.png'
		];
		for (const uri of uris) {
			const texture = await loader(uri, 'roughnessMap', { policy: 'raw' });
			expect(texture.image).toBe(bitmaps.at(-1));
			texture.dispose();
		}
		expect(fetchMock.mock.calls.map(([uri]) => uri)).toEqual(uris);
		expect(createBitmap).toHaveBeenCalledTimes(2);
		scope.dispose();
	});

	it('refuses an unknown static raw map without fetching it', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const scope = createReleaseTextureScope({
			releaseId: 'release-unknown-raw',
			bytesByUri: new Map<string, ReleaseBytesEntry>()
		});
		await expect(
			scope.createSourceLoader()('/textures/not-shipped/roughness.png', 'roughnessMap', { policy: 'raw' })
		).rejects.toThrow(/not available/);
		expect(fetchMock).not.toHaveBeenCalled();
		scope.dispose();
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
			rotation: 0,
			offset: [0, 0] as [number, number],
			normalScale: null,
			variantSeed: 'vOVERRIDE1'
		};
		const loaded = await loadEffectiveTextures(effective, scope);
		expect(loaded.status).toBe('ready');
		expect(loader).toHaveBeenCalledWith(overrideUri);

		const group = new Group();
		group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
		const store = createMaterialStore();
		const realization = realizeModel(group, {
			asset: 'scope-test-model',
			store,
			look: modelLookFor(effective, scope, true),
			wireframe: false,
			castShadow: false,
			receiveShadow: false
		});
		const mesh = realization.root.children[0] as Mesh;
		const material = mesh.material as MeshStandardMaterial;
		expect(material.map).toBeDefined();
		expect(realization.leaseCount()).toBe(2);
		realization.release();
		expect(store.stats().live).toBe(0);
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
			rotation: 0,
			offset: [0, 0] as [number, number],
			normalScale: null,
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

	it('blocks a Finish whose normal map is not a Scene texture record', () => {
		const issues = validateColdReleaseReferences({
			scene: {
				textures: [],
				materials: [{ id: 'm', name: 'M', base: { catalogue: 'plaster-warm' }, overrides: { maps: { normal: { image: { textureId: 'missing' }, convention: '+Y' } } } }],
				entities: []
			},
			manifest: { releaseId: 'r1', bytesByUri: new Map<string, ReleaseBytesEntry>() }
		});
		expect(issues).toEqual([
			{ path: '$.scene.materials[0].overrides.maps.normal.image.textureId', message: 'Unknown finish map "missing"' }
		]);
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
					textures: [{ id: 'gone', name: 'Missing', uri: '/project-assets/gone' }],
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

	it('refuses a native form in a cold release', () => {
		// Publication admits no form yet: T4 owns any admission, so a release must
		// refuse one explicitly rather than ship it by omission.
		const issues = validateColdReleaseReferences({
			scene: {
				textures: [],
				materials: [],
				entities: [{ kind: 'form', materialId: 'plaster-warm' }]
			},
			manifest: { releaseId: 'r1', bytesByUri: new Map<string, ReleaseBytesEntry>() }
		});
		expect(issues).toEqual([
			{ path: '$.scene.entities[0]', message: 'Native forms are not admitted for publication' }
		]);
	});

	it('refuses to compose a release that carries a native form', async () => {
		const project = await createUnitProject({
			id: 'project:cold-form',
			name: 'Cold form',
			scene: {
				formatVersion: 1,
				textures: [],
				materials: [],
				entities: [
					{
						kind: 'form',
						id: 'entity-form',
						name: 'Drawn plinth',
						position: [1, 0, 1],
						rotation: [0, 0, 0],
						form: {
							generator: {
								kind: 'extrude',
								plane: 'plan',
								outline: [
									{ key: 1, u: 0, v: 0, smooth: false },
									{ key: 2, u: 1, v: 0, smooth: false },
									{ key: 3, u: 1, v: 1, smooth: false },
									{ key: 4, u: 0, v: 1, smooth: false }
								],
								extent: 0.6
							},
							scale: [1, 1, 1],
							nextKey: 5
						},
						materialId: 'plaster-warm',
						castShadow: true,
						receiveShadow: true
					}
				],
				navigationNodes: [],
				connections: []
			}
		});
		expect(() =>
			composeColdReleaseBundle({
				document: project,
				manifest: { releaseId: `${project.id}@v1`, bytesByUri: new Map() }
			})
		).toThrow(/Native forms are not admitted for publication/);
	});

	it('refuses outgoing Layout source through the cold release reader', async () => {
		const current = await createUnitProject({ id: 'project:outgoing-layout', name: 'Outgoing source' });
		const outgoing = structuredClone(current);
		const oldLayout = {
			header: { ...outgoing.units.layout.header, formatVersion: 8 },
			data: { ...outgoing.units.layout.data, formatVersion: 8 }
		};
		expect(() => composeColdReleaseBundle({
			document: { ...outgoing, units: { ...outgoing.units, layout: oldLayout } },
			manifest: { releaseId: `${outgoing.id}@v1`, bytesByUri: new Map() }
		})).toThrow('$.units.layout.header.formatVersion must be 10 for the layout unit');
	});

	it('composes an empty project store-free and disposes cleanly', async () => {
		setDefaultTextureSourceLoader(null);
		const project = await createUnitProject({ id: 'project:cold-a', name: 'Cold A' });
		const bundle = composeColdReleaseBundle({
			document: project,
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

	it('composes a P20-textured release from supplied bytes; missing bytes fail closed', async () => {
		const uri = '/project-assets/pinned-1';
		const project = await createUnitProject({
			id: 'project:cold-b',
			name: 'Cold B',
			scene: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: [{ id: 'pinned-1', name: 'Pinned', uri }],
				materials: [],
				entities: []
			},
			// A released texture must carry its typed-resource record; release
			// composition refuses an unresolved resource rather than inventing bytes.
			resources: {
				formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
				resources: [
					{ kind: 'texture', id: 'pinned-1', contentRevision: 'revision-pinned-1', pin: null, unresolved: null }
				]
			}
		});
		const bytes = new Map<string, ReleaseBytesEntry>([
			[uri, { bytes: new Uint8Array([137, 80, 78, 71]), mime: 'image/png' }]
		]);
		const bundle = composeColdReleaseBundle({
			document: project,
			manifest: { releaseId: `${project.id}@v3`, bytesByUri: bytes }
		});
		expect(bundle.textureScope.objectUrlByUri.has(uri)).toBe(true);
		bundle.dispose();

		expect(() =>
			composeColdReleaseBundle({
				document: project,
				manifest: { releaseId: `${project.id}@v4`, bytesByUri: new Map() }
			})
		).toThrow(/missing release bytes/i);
	});

	it('carries the stored Sky and Treatment, and palette followers, into a cold public visit', async () => {
		const start = structuredClone(skyFromPreset('golden-hour', 0));
		const project = await createUnitProject({
			id: 'project:cold-sky',
			name: 'Golden Sky',
			scene: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: [],
				materials: [
					{ id: 'finish-coral', name: 'Coral', base: { catalogue: 'plaster-warm' }, overrides: { color: { slot: 'coral' } } }
				],
				entities: [],
				palette: [{ id: 'coral', name: 'Coral', color: '#ee6c4d' }],
				environment: { sky: start, treatment: 'clay' }
			}
		});
		const bundle = composeColdReleaseBundle({
			document: project,
			manifest: { releaseId: `${project.id}@v1`, bytesByUri: new Map() }
		});
		expect(bundle.scene.environment).toEqual({ sky: start, treatment: 'clay' });
		expect(bundle.scene.materials[0]).toMatchObject({ overrides: { color: { slot: 'coral' } } });
		expect(bundle.scene.palette?.[0]).toMatchObject({ id: 'coral', color: '#ee6c4d' });
		bundle.dispose();

		const route = readFileSync(
			resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/routes/p/[publicationId]/+page.svelte'),
			'utf8'
		);
		expect(route).toContain('sky={readyBundle.scene.environment?.sky ?? null}');
		expect(route).toContain('scene={readyBundle.scene}');
		const surface = readFileSync(
			resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/lib/visitor/VisitorPreviewSurface.svelte'),
			'utf8'
		);
		expect(surface).toContain('treatment={scene.environment?.treatment}');
	});

	it('needs release bytes for a map-named P20 texture', async () => {
		const uri = '/project-assets/pinned-map';
		const project = await createUnitProject({
			id: 'project:cold-map',
			name: 'Map Pinned',
			scene: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: [{ id: 'pinned-map', name: 'Pinned map', uri }],
				materials: [
					{ id: 'm', name: 'M', base: { catalogue: 'plaster-warm' }, overrides: { maps: { color: { image: { textureId: 'pinned-map' } } } } }
				],
				entities: []
			},
			resources: {
				formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
				resources: [
					{ kind: 'texture', id: 'pinned-map', contentRevision: 'revision-pinned-map', pin: null, unresolved: null }
				]
			}
		});
		const manifest = { releaseId: `${project.id}@v1`, bytesByUri: new Map<string, ReleaseBytesEntry>() };
		const issues = validateColdReleaseReferences({ scene: project.units.scene.data as never, manifest });
		expect(issues).toContainEqual(
			expect.objectContaining({ path: '$.scene.textures[0]' })
		);
		expect(() => composeColdReleaseBundle({ document: project, manifest })).toThrow(/missing release bytes/i);
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
			// The live editor tree is `$lib/authoring/`; the deleted `$lib/editor/`
			// token this replaces could never match again.
			for (const token of [
				'$lib/authoring/',
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
	it('refuses a creator model in a cold release: the visitor reader stays catalogue-only', async () => {
		const hash = `sha256-${'d'.repeat(64)}`;
		const base = await createUnitProject({
			id: 'project:cold-creator-model',
			name: 'Creator model',
			scene: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: [],
				materials: [],
				entities: [
					{
						kind: 'model',
						id: 'entity-creator-model',
						name: 'Creator model',
						assetId: 'creator-model',
						fallback: 'generic',
						position: [0, 0, 0],
						rotation: [0, 0, 0]
					}
				]
			},
			resources: {
				formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
				resources: [
					{
						kind: 'model',
						id: 'creator-model',
						contentRevision: hash,
						pin: { hash, mime: MODEL_RESOURCE_MIME, size: 1024, locator: `/projects/project:cold-creator-model/models/content/${hash}` },
						unresolved: null,
						model: {
							source: { manifestHash: `sha256-${'e'.repeat(64)}`, size: 2048, fileCount: 2 },
							recipe: { id: 'creator-import', version: 1 },
							reportDigest: `sha256-${'f'.repeat(64)}`,
							placement: {
								metresPerSourceUnit: 0.5,
								pivot: [0, 0, 0],
								footprint: { width: 1.2, depth: 0.8 },
								contactMinY: 0,
								placement: 'floor'
							}
						}
					}
				]
			}
		});
		const document = {
			...base,
			dependencyLock: {
				formatVersion: 1 as const,
				entries: [
					{
						domain: 'resource:model' as const,
						subjectKind: 'resource',
						subjectId: 'creator-model',
						instancePath: [],
						contentRevision: hash,
						requiredCapabilities: [{ id: 'F2.unit-envelope', version: '1' }],
						pin: { hash, mime: MODEL_RESOURCE_MIME, size: 1024, locator: `/projects/project:cold-creator-model/models/content/${hash}` }
					}
				]
			}
		};

		// The cold runtime uses the shipped catalogue predicate, not the editor's
		// model-registry admission, so the unknown id is refused at preparation.
		expect(() =>
			composeColdReleaseBundle({
				document,
				manifest: { releaseId: `${base.id}@v1`, bytesByUri: new Map() }
			})
		).toThrow(/Unknown asset: creator-model/);
	});

});
