import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	__resetDefaultSourceLoaderForTests,
	acquireEffectiveVariant,
	invalidateTextureSource,
	loadEffectiveTextures,
	loadFinishTexture,
	loadSourceTexture,
	releaseFinishTexture,
	releaseEffectiveVariant,
	releaseTextureScope,
	resetTextureCachesForTests,
	setDefaultTextureSourceLoader,
	textureSourceMemoryStats
} from '$lib/render/resources/texture-store';
import type { EffectiveSceneMaterial } from '$lib/render/materials/scene-instance-material';
import type { Texture as ThreeTexture, Vector2 } from 'three';

const texturesByUri = new Map<string, ThreeTexture>();

function sizedTexture(id: string, width: number, height: number, sourceBytes?: number): ThreeTexture {
	return {
		uuid: id,
		isTexture: true,
		image: { width, height, complete: true },
		userData: sourceBytes === undefined ? {} : { s8SourceBytes: sourceBytes },
		needsUpdate: false,
		colorSpace: '',
		wrapS: 0,
		wrapT: 0,
		repeat: { set() {}, x: 1, y: 1 } as unknown as Vector2,
		rotation: 0,
		center: { set() {} },
		clone(this: ThreeTexture) {
			return { ...this } as ThreeTexture;
		},
		dispose() {}
	} as unknown as ThreeTexture;
}

vi.mock('three', async () => {
	const actual = await vi.importActual<typeof import('three')>('three');
	class MockTextureLoader {
		load(
			url: string,
			onLoad: (tex: ThreeTexture) => void,
			_onProgress: unknown,
			onError: (event: { message?: string }) => void
		): unknown {
			const existing = texturesByUri.get(url);
			if (existing) {
				queueMicrotask(() => onLoad(existing));
				return;
			}
			const tex: ThreeTexture = {
				source: { data: null },
				isTexture: true,
				uuid: url,
				// Three reads image.complete; coerce a plain object that satisfies the boolean field.
				image: { complete: true, naturalWidth: 32, naturalHeight: 32 },
				needsUpdate: false,
				colorSpace: '',
				wrapS: 0,
				wrapT: 0,
				repeat: {
					set(_x: number, _y: number) {
						/* mock */
					},
					x: 1,
					y: 1
				} as Vector2,
				rotation: 0,
				center: { set() {} },
				clone(this: ThreeTexture) {
					return { ...this } as ThreeTexture;
				},
				dispose() {
					/* mock */
				}
			} as unknown as ThreeTexture;
			texturesByUri.set(url, tex);
			queueMicrotask(() => onLoad(tex));
			return;
		}
	}
	return { ...actual, TextureLoader: MockTextureLoader };
});

const effectiveA: EffectiveSceneMaterial = {
	catalogue: 'plaster-warm',
	slotUris: { map: '/textures/a.png' },
	roughness: 0.92,
	metalness: 0.02,
	color: '#c4b4a0',
	defaultTileSizeMeters: [2, 2],
	rotation: 0,
	offset: [0, 0],
	normalScale: null,
	variantSeed: 'vAABBCC'
};

const effectiveB: EffectiveSceneMaterial = {
	catalogue: 'plaster-warm',
	slotUris: { map: '/textures/b.webp' },
	roughness: 0.92,
	metalness: 0.02,
	color: '#c4b4a0',
	defaultTileSizeMeters: [2, 2],
	rotation: 0,
	offset: [0, 0],
	normalScale: null,
	variantSeed: 'vDDEEFF'
};

describe('texture-cache extensions', () => {
	beforeEach(() => {
		texturesByUri.clear();
		resetTextureCachesForTests();
	});

	afterEach(() => {
		texturesByUri.clear();
		resetTextureCachesForTests();
	});

	it('loadEffectiveTextures returns ready when every URI resolves', async () => {
		const result = await loadEffectiveTextures(effectiveA);
		expect(result.status).toBe('ready');
		if (result.status === 'ready') {
			expect(result.maps.map?.uuid).toBe('/textures/a.png');
		}
	});

	it('acquireEffectiveVariant returns the same maps reference for repeat acquires', () => {
		const first = acquireEffectiveVariant(effectiveA, 2, 2, 0);
		const second = acquireEffectiveVariant(effectiveA, 2, 2, 0);
		expect(second).toBe(first);

		// Different effective → different variant
		const third = acquireEffectiveVariant(effectiveB, 2, 2, 0);
		expect(third).not.toBe(first);
	});

	it('release is idempotent and does not throw on extra calls', () => {
		acquireEffectiveVariant(effectiveA, 1, 1, 0);
		releaseEffectiveVariant(effectiveA.variantSeed, 1, 1, 0);
		releaseEffectiveVariant(effectiveA.variantSeed, 1, 1, 0);
		releaseEffectiveVariant(effectiveA.variantSeed, 1, 1, 0);
	});

	it('uses the slot key correctly when loading', async () => {
		// Concurrent loads for the same effective share the underlying THREE.Texture.
		const [a, b] = await Promise.all([
			loadEffectiveTextures(effectiveA),
			loadEffectiveTextures(effectiveA)
		]);
		expect(a.status).toBe('ready');
		expect(b.status).toBe('ready');
		expect(texturesByUri.size).toBe(1);
	});

	it('reports compressed and decoded peaks separately and releases them at scope teardown', async () => {
		const first = sizedTexture('memory-first', 64, 32, 1000);
		const second = sizedTexture('memory-second', 32, 32, 2000);
		const firstDispose = vi.spyOn(first, 'dispose');
		const scope = {
			scopeId: 'project:memory',
			loader: async (uri: string) => (uri.endsWith('first.png') ? first : second)
		};

		await loadSourceTexture('/textures/first.png', 'map', scope);
		expect(textureSourceMemoryStats()).toEqual({
			liveSources: 1,
			compressedBytes: 1000,
			decodedBytes: 64 * 32 * 4,
			peakCompressedBytes: 1000,
			peakDecodedBytes: 64 * 32 * 4
		});

		await loadSourceTexture('/textures/second.png', 'map', scope);
		expect(textureSourceMemoryStats()).toEqual({
			liveSources: 2,
			compressedBytes: 3000,
			decodedBytes: 64 * 32 * 4 + 32 * 32 * 4,
			peakCompressedBytes: 3000,
			peakDecodedBytes: 64 * 32 * 4 + 32 * 32 * 4
		});

		invalidateTextureSource('project:memory', '/textures/first.png');
		expect(firstDispose).toHaveBeenCalledTimes(1);
		expect(textureSourceMemoryStats()).toMatchObject({
			liveSources: 1,
			compressedBytes: 2000,
			decodedBytes: 32 * 32 * 4,
			peakCompressedBytes: 3000
		});

		releaseTextureScope('project:memory');
		expect(textureSourceMemoryStats()).toMatchObject({
			liveSources: 0,
			compressedBytes: 0,
			decodedBytes: 0,
			peakCompressedBytes: 3000,
			peakDecodedBytes: 64 * 32 * 4 + 32 * 32 * 4
		});
	});

	it('reports the fetched compressed bytes and decoded CPU size for a raw Finish map', async () => {
		const testDir = dirname(fileURLToPath(import.meta.url));
		const bytes = Uint8Array.from(
			readFileSync(resolve(testDir, '../../../../static/textures/plaster-warm/roughness.png'))
		);
		vi.stubGlobal('fetch', vi.fn(async () => ({
			ok: true,
			blob: async () => ({ arrayBuffer: async () => bytes })
		})));
		vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
			width: 256,
			height: 256,
			close: vi.fn()
		})));
		try {
			const texture = await loadFinishTexture('/textures/plaster-warm/roughness.png', 'roughness');
			expect(textureSourceMemoryStats()).toEqual({
				liveSources: 1,
				compressedBytes: bytes.length,
				decodedBytes: 256 * 256 * 4,
				peakCompressedBytes: bytes.length,
				peakDecodedBytes: 256 * 256 * 4
			});
			expect(releaseFinishTexture('/textures/plaster-warm/roughness.png', 'roughness')).toBe(true);
			expect(textureSourceMemoryStats()).toMatchObject({
				liveSources: 0,
				compressedBytes: 0,
				decodedBytes: 0
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});

	describe('defaultSourceLoader dispatcher', () => {
		afterEach(() => {
			setDefaultTextureSourceLoader(null);
		});

		it('default loader (null) falls through to the legacy fetch path', async () => {
			setDefaultTextureSourceLoader(null);
			const tex = await loadSourceTexture('/textures/legacy.png', 'map');
			expect(tex.uuid).toBe('/textures/legacy.png');
			expect(texturesByUri.has('/textures/legacy.png')).toBe(true);
		});

		it('loader is consulted once per URL and stored in sourceCache', async () => {
			const fakeTex: ThreeTexture = {
				uuid: 'fake-bytes',
				isTexture: true,
				image: { complete: true, naturalWidth: 32, naturalHeight: 32 },
				needsUpdate: false,
				colorSpace: '',
				wrapS: 0,
				wrapT: 0,
				repeat: { set() {}, x: 1, y: 1 } as unknown as Vector2,
				rotation: 0,
				center: { set() {} },
				clone(this: ThreeTexture) {
					return { ...this } as ThreeTexture;
				},
				dispose() {
					/* mock */
				}
			} as unknown as ThreeTexture;
			const loader = vi.fn(async (_uri: string, _slot: string) => fakeTex);
			setDefaultTextureSourceLoader(loader);

			const a = await loadSourceTexture('/textures/injected.png', 'map');
			const b = await loadSourceTexture('/textures/injected.png', 'map');
			expect(loader).toHaveBeenCalledTimes(1);
			expect(loader).toHaveBeenCalledWith(
				'/textures/injected.png',
				'map',
				expect.objectContaining({ policy: 'srgb', storage: 'legacy' })
			);
			expect(a).toBe(fakeTex);
			expect(b).toBe(fakeTex);
		});

		it('raw policy never falls back to the colour-managed loader', async () => {
			vi.stubGlobal('createImageBitmap', undefined);
			await expect(loadSourceTexture('/textures/raw.png', 'normalMap')).rejects.toThrow(
				/Raw texture loading requires/
			);
			vi.unstubAllGlobals();
		});

		it('rejection from loader produces a failed status (no legacy fallback)', async () => {
			const loader = vi.fn(async () => {
				throw new Error('binary-store refused');
			});
			setDefaultTextureSourceLoader(loader);
			const result = await loadEffectiveTextures({
				...effectiveA,
				slotUris: { map: '/textures/injected-fail.png' }
			});
			expect(result.status).toBe('failed');
			expect(loader).toHaveBeenCalledTimes(1);
			// The legacy TextureLoader path was NOT consulted — only the injected
			// loader.
			expect(texturesByUri.has('/textures/injected-fail.png')).toBe(false);
		});

		it('legacy fallback cache hits survive a later loader set', async () => {
			// Prime the cache with the legacy loader.
			setDefaultTextureSourceLoader(null);
			const legacyTex = await loadSourceTexture('/textures/legacy-cached.png', 'map');
			expect(legacyTex.uuid).toBe('/textures/legacy-cached.png');

			// After setting an injected loader, the next call MUST hit the cache
			// (no loader invocation).
			const shouldNotCall = vi.fn(async () => {
				throw new Error('should not be called');
			});
			setDefaultTextureSourceLoader(shouldNotCall);
			const cached = await loadSourceTexture('/textures/legacy-cached.png', 'map');
			expect(cached).toBe(legacyTex);
			expect(shouldNotCall).not.toHaveBeenCalled();
		});

		it('integration: loadEffectiveTextures drives the same dispatcher', async () => {
			const fakeTex: ThreeTexture = {
				uuid: 'one-shot-fake',
				isTexture: true,
				image: { complete: true, naturalWidth: 32, naturalHeight: 32 },
				needsUpdate: false,
				colorSpace: '',
				wrapS: 0,
				wrapT: 0,
				repeat: { set() {}, x: 1, y: 1 } as unknown as Vector2,
				rotation: 0,
				center: { set() {} },
				clone(this: ThreeTexture) {
					return { ...this };
				},
				dispose() {
					/* mock */
				}
			} as unknown as ThreeTexture;
			const loader = vi.fn(async () => fakeTex);
			setDefaultTextureSourceLoader(loader);

			const loaded = await loadSourceTexture('/textures/route.png', 'roughnessMap');
			expect(loaded).toBe(fakeTex);
			expect(loader).toHaveBeenCalledWith(
				'/textures/route.png',
				'roughnessMap',
				expect.objectContaining({ policy: 'raw', storage: 'legacy' })
			);
		});

		it('aborts shared IO only when its last waiter leaves', async () => {
			const signals: AbortSignal[] = [];
			const loader = vi.fn(
				(_uri: string, _slot: string, options?: { signal?: AbortSignal }) =>
					new Promise<ThreeTexture>((_resolve, reject) => {
						const signal = options!.signal!;
						signals.push(signal);
						signal.addEventListener('abort', () =>
							reject(new DOMException('aborted', 'AbortError'))
						);
					})
			);
			setDefaultTextureSourceLoader(loader);
			const first = new AbortController();
			const second = new AbortController();
			const one = loadFinishTexture('/textures/shared.png', 'color', null, first.signal);
			const two = loadFinishTexture('/textures/shared.png', 'color', null, second.signal);
			await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
			expect(signals).toHaveLength(1);

			first.abort();
			await expect(one).rejects.toThrow();
			// The second surface still needs the bytes: do not abort the shared read.
			expect(signals[0]!.aborted).toBe(false);

			second.abort();
			await expect(two).rejects.toThrow();
			expect(signals[0]!.aborted).toBe(true);
		});

		it('keeps a shared read alive for the remaining waiter', async () => {
			let settle: ((texture: ThreeTexture) => void) | undefined;
			const loader = vi.fn(
				(_uri: string, _slot: string, options?: { signal?: AbortSignal }) =>
					new Promise<ThreeTexture>((resolve, reject) => {
						settle = resolve;
						options?.signal?.addEventListener('abort', () =>
							reject(new DOMException('aborted', 'AbortError'))
						);
					})
			);
			setDefaultTextureSourceLoader(loader);
			const first = new AbortController();
			const one = loadFinishTexture('/textures/remaining.png', 'color', null, first.signal);
			const two = loadFinishTexture('/textures/remaining.png', 'color');
			await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));

			first.abort();
			await expect(one).rejects.toThrow();
			const texture = new (await import('three')).Texture();
			settle?.(texture);
			await expect(two).resolves.toBe(texture);
		});

		it('__resetDefaultSourceLoaderForTests clears the dispatcher', async () => {
			setDefaultTextureSourceLoader(async () => {
				throw new Error('first');
			});
			__resetDefaultSourceLoaderForTests();
			const legacyTex = await loadSourceTexture('/textures/post-reset.png', 'map');
			expect(legacyTex.uuid).toBe('/textures/post-reset.png');
		});
	});
});
