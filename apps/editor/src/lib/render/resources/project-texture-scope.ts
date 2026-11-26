/**
 * The editor's authenticated project texture scope (T2.S4b).
 *
 * A Finish image is creator bytes in P20 storage, so the editor must load it
 * through the API, verify it against the Scene's pinned `texture` resource and
 * hand Three an object URL it revokes immediately. Catalogue textures keep
 * their landed static path, so this scope is a drop-in `TextureLoadScope` for
 * every Scene material.
 *
 * The scope is one per route. It holds:
 *
 * - **Pins** from the accepted Scene's `texture` resources. A URI with no pin
 *   is refused rather than fetched, so a tampered Scene cannot make the editor
 *   download arbitrary project bytes.
 * - **Digest and MIME verification** on every load, using the same sha256 the
 *   asset registry and release manifest carry. A mismatch is a refusal and the
 *   object falls back to its Finish colour through the resolver's existing
 *   missing-texture behaviour.
 * - **Decoded dimensions**, so the Card can state a low-resolution warning and
 *   derive a tile's aspect without a second decoder.
 *
 * Retry is targeted: `retry(uri)` drops that one source-cache error and reloads
 * only that URI. The Stage then calls every representation's `reloadTextures`, so
 * a recovered image appears on items, models and Layout surfaces without
 * rebuilding the Scene.
 */
import { Texture as ThreeTextureClass, TextureLoader, type Texture as ThreeTexture } from 'three';
import { probeArtworkImage } from '@portfolio/project-model/artwork';
import {
	invalidateScopedMaterialLoads,
	invalidateTextureSource,
	loadSourceTexture,
	releaseTextureScope,
	retainDecodedImage,
	type TextureLoadScope,
} from './texture-store';
import { imageSha256 } from '$lib/render/artwork/image-digest';
import { probeRawImage } from './image-encoding';
import { ImageLoadFailure, isImageLoadFailure } from './image-load-failure';
import { invalidateFinishViewsForSource, releaseFinishViewsForScope } from './finish-views';

export type ProjectTexturePin = {
	readonly hash: string;
	readonly mime: string;
	readonly size: number;
};

export type ProjectTextureResolution = {
	readonly bytes: Uint8Array;
	readonly mime: string;
};

export type TextureDimensions = {
	readonly width: number;
	readonly height: number;
};

/** One canonical P20 project-asset URI; every other URI is a catalogue path. */
const PROJECT_ASSET_URI = /^\/project-assets\/([^/]+)$/;

export type ProjectTextureScope = TextureLoadScope & {
	/** Warm the decoded dimensions of every project texture the Scene names. */
	prepare(uris: readonly string[]): Promise<void>;
	/** Drop one cached failure and reload that URI. */
	retry(uri: string): void;
	/** Decoded pixel size, or `null` until the image has loaded. */
	dimensionsOf(assetId: string): TextureDimensions | null;
	/** Width ÷ height, or `null` until the image has loaded. */
	aspectOf(assetId: string): number | null;
	/**
	 * A retained object URL of the verified image for CSS previews (the Card
	 * swatch and Library tiles), or `null` until it has loaded. The scope owns
	 * it and revokes it on dispose; a second decoder is never involved.
	 */
	previewUriOf(assetId: string): string | null;
	dispose(): void;
};

export type ProjectTextureScopeInput = {
	readonly scopeId: string;
	readonly load: (assetId: string, signal: AbortSignal) => Promise<ProjectTextureResolution>;
	readonly pins: () => ReadonlyMap<string, ProjectTexturePin>;
	readonly onFailure?: (uri: string, message: string) => void;
	readonly onSuccess?: (uri: string) => void;
};

export function createProjectTextureScope(input: ProjectTextureScopeInput): ProjectTextureScope {
	const loader = new TextureLoader();
	const abort = new AbortController();
	const dimensions = new Map<string, TextureDimensions>();
	const previewUris = new Map<string, string>();
	const prepared = new Set<string>();
	/** The pin each prepared URI was loaded under, so a changed pin invalidates it. */
	const preparedPins = new Map<string, string>();
	/** Every URI this scope has asked the shared cache to load, including failures. */
	const requested = new Set<string>();
	/** Per-URI load generation; a late completion from an older one is discarded. */
	const generations = new Map<string, number>();
	let disposed = false;

	/** Drop one URI's decoded texture, source cache, dimensions and preview. */
	function forget(uri: string): void {
		requested.add(uri);
		generations.set(uri, (generations.get(uri) ?? 0) + 1);
		invalidateScopedMaterialLoads(scope.scopeId);
		// Views first: they detach what a live material still samples. The store then
		// disposes the rest, including a decode that has not reached its cache entry.
		invalidateFinishViewsForSource(scope.scopeId, uri);
		invalidateTextureSource(scope.scopeId, uri);
		const assetId = PROJECT_ASSET_URI.exec(uri)?.[1];
		if (assetId !== undefined) {
			dimensions.delete(assetId);
			const preview = previewUris.get(assetId);
			if (preview !== undefined) URL.revokeObjectURL(preview);
			previewUris.delete(assetId);
		}
		prepared.delete(uri);
		preparedPins.delete(uri);
	}

	function pinHashOf(uri: string): string | null {
		const assetId = PROJECT_ASSET_URI.exec(uri)?.[1];
		return assetId === undefined ? null : (input.pins().get(assetId)?.hash ?? null);
	}

	/**
	 * A resource pin is immutable in a valid Scene, but a restored or tampered
	 * envelope can change it under the same URI. Never serve the previous bytes
	 * (or the previous failure) for a new pin.
	 */
	function forgetChangedPin(uri: string): void {
		if (!prepared.has(uri) || !PROJECT_ASSET_URI.test(uri)) return;
		if (preparedPins.get(uri) !== pinHashOf(uri)) forget(uri);
	}

	/**
	 * Decode verified bytes without colour conversion, premultiplication or EXIF
	 * rotation. Raw maps must preserve the file's channels and authored
	 * orientation; a browser `<img>` decode would apply all three.
	 */
	async function decodeRaw(bytes: Uint8Array, mime: string): Promise<ImageBitmap | null> {
		if (typeof createImageBitmap !== 'function') return null;
		return createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: mime }), {
			imageOrientation: 'none',
			premultiplyAlpha: 'none',
			colorSpaceConversion: 'none',
		});
	}

	function publish(
		assetId: string,
		probe: { pixelWidth: number; pixelHeight: number },
		blob: Blob,
	): void {
		dimensions.set(assetId, { width: probe.pixelWidth, height: probe.pixelHeight });
		if (!previewUris.has(assetId)) previewUris.set(assetId, URL.createObjectURL(blob));
	}

	function httpStatusOf(error: unknown): number | undefined {
		if (typeof error !== 'object' || error === null) return undefined;
		const status =
			(error as { status?: unknown; httpStatus?: unknown }).httpStatus ??
			(error as { status?: unknown }).status;
		return typeof status === 'number' && Number.isInteger(status) ? status : undefined;
	}

	async function loadProjectImage(
		assetId: string,
		isCurrent: () => boolean = () => true,
		raw = false,
		signal: AbortSignal = abort.signal,
	): Promise<ThreeTexture> {
		const pin = input.pins().get(assetId);
		if (pin === undefined) {
			throw new ImageLoadFailure('The image is not registered in this project.', 'acquire', 404);
		}
		let content: ProjectTextureResolution;
		try {
			content = await input.load(assetId, signal);
		} catch (error) {
			if (signal.aborted || disposed || !isCurrent()) throw error;
			if (isImageLoadFailure(error)) throw error;
			throw new ImageLoadFailure(
				error instanceof Error ? error.message : 'The image could not be loaded.',
				'acquire',
				httpStatusOf(error),
			);
		}
		signal.throwIfAborted();
		let probe: ReturnType<typeof probeArtworkImage>;
		try {
			probe = probeArtworkImage(content.bytes);
			// A raw role must preserve stored channels; validate the container before
			// the decoder allocates anything (orientation, precision, profile).
			if (raw) probeRawImage(content.bytes);
		} catch (error) {
			throw new ImageLoadFailure(
				error instanceof Error ? error.message : 'The image cannot be decoded.',
				'decode',
			);
		}
		const digest = `sha256-${await imageSha256(content.bytes)}`;
		if (
			content.mime !== pin.mime ||
			probe.mime !== pin.mime ||
			content.bytes.length !== pin.size ||
			digest !== pin.hash
		) {
			throw new ImageLoadFailure('The image bytes do not match the saved project.', 'verify');
		}
		const blob = new Blob([Uint8Array.from(content.bytes)], { type: pin.mime });

		if (raw) {
			let bitmap: ImageBitmap | null;
			try {
				bitmap = await decodeRaw(content.bytes, pin.mime);
			} catch (error) {
				if (signal.aborted || disposed || !isCurrent()) throw error;
				throw new ImageLoadFailure(
					error instanceof Error ? error.message : 'The raw image cannot be decoded.',
					'decode',
				);
			}
			if (signal.aborted) {
				bitmap?.close();
				signal.throwIfAborted();
			}
			if (bitmap !== null) {
				if (disposed || !isCurrent()) {
					bitmap.close();
					throw new Error('The project texture scope is closed.');
				}
				publish(assetId, probe, blob);
				const texture = new ThreeTextureClass(bitmap);
				(texture.userData ??= {}).s8SourceBytes = content.bytes.length;
				return texture;
			}
		}

		const url = URL.createObjectURL(blob);
		try {
			let texture: ThreeTexture;
			try {
				texture = await loader.loadAsync(url);
			} catch (error) {
				if (signal.aborted || disposed || !isCurrent()) throw error;
				throw new ImageLoadFailure(
					error instanceof Error ? error.message : 'The image cannot be decoded.',
					'decode',
				);
			}
			if (disposed || !isCurrent()) {
				texture.dispose();
				throw new Error('The project texture scope is closed.');
			}
			publish(assetId, probe, blob);
			(texture.userData ??= {}).s8SourceBytes = content.bytes.length;
			return texture;
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	async function loadCatalogue(
		uri: string,
		raw = false,
		signal?: AbortSignal,
	): Promise<ThreeTexture> {
		if (raw) {
			// A raw map cannot silently fall back to the colour-managed loader: that
			// would turn a normal/roughness map into display-referred sRGB bytes.
			if (typeof createImageBitmap !== 'function' || typeof fetch !== 'function') {
				throw new Error('Raw material maps require fetch and createImageBitmap.');
			}
			let response: Response;
			try {
				response = await fetch(uri, { signal });
			} catch (error) {
				if (signal?.aborted || disposed) throw error;
				throw new ImageLoadFailure(
					error instanceof Error ? error.message : 'The material map is unreachable.',
					'acquire',
				);
			}
			if (!response.ok) {
				throw new ImageLoadFailure(
					`Could not load raw material map (${response.status}).`,
					'acquire',
					response.status,
				);
			}
			const blob = await response.blob();
			const bytes = new Uint8Array(await blob.arrayBuffer());
			let bitmap: Awaited<ReturnType<typeof decodeRaw>>;
			try {
				probeRawImage(bytes);
				bitmap = await decodeRaw(bytes, blob.type || 'image/png');
			} catch (error) {
				if (signal?.aborted || disposed || isImageLoadFailure(error)) throw error;
				throw new ImageLoadFailure(
					error instanceof Error ? error.message : 'The material map cannot be decoded.',
					'decode',
				);
			}
			if (signal?.aborted) {
				bitmap?.close();
				signal.throwIfAborted();
			}
			if (bitmap === null) throw new Error('Raw material maps require createImageBitmap.');
			if (disposed) {
				bitmap.close();
				throw new Error('The project texture scope is closed.');
			}
			const texture = new ThreeTextureClass(bitmap);
			(texture.userData ??= {}).s8SourceBytes = bytes.byteLength;
			return texture;
		}
		let texture: ThreeTexture;
		try {
			texture = await loader.loadAsync(uri);
		} catch (error) {
			if (signal?.aborted || disposed) throw error;
			throw new ImageLoadFailure(
				error instanceof Error ? error.message : 'The material image could not load.',
				'acquire',
			);
		}
		if (disposed) {
			texture.dispose();
			throw new Error('The project texture scope is closed.');
		}
		return texture;
	}

	const scope: ProjectTextureScope = {
		scopeId: input.scopeId,
		loader: async (uri, slot, options) => {
			if (disposed) throw new Error('The project texture scope is closed.');
			requested.add(uri);
			// A load does not supersede another load of the same URI. S4's eager
			// prepare and a sampled colour view can decode the same pinned bytes in
			// parallel under different storage policies; only `forget` (Retry, pin
			// change, disposal) advances this generation and invalidates them.
			const generation = generations.get(uri) ?? 0;
			const assetId = PROJECT_ASSET_URI.exec(uri)?.[1] ?? null;
			const raw = options?.policy === 'raw' || (options === undefined && slot !== 'map');
			// A caller's cancellation releases only its interest; the texture store
			// aborts the shared read when its last waiter leaves. The scope's own
			// abort also ends this load on teardown.
			const loadController = new AbortController();
			const abortLoad = (): void => loadController.abort();
			options?.signal?.addEventListener('abort', abortLoad, { once: true });
			abort.signal.addEventListener('abort', abortLoad, { once: true });
			if (options?.signal?.aborted === true || abort.signal.aborted) abortLoad();
			try {
				const texture =
					assetId === null
						? await loadCatalogue(uri, raw, loadController.signal)
						: await loadProjectImage(
								assetId,
								() => (generations.get(uri) ?? 0) === generation,
								raw,
								loadController.signal,
							);
				if (disposed || (generations.get(uri) ?? 0) !== generation) {
					// The store has not taken ownership yet, so nothing else closes the bitmap.
					retainDecodedImage(texture);
					texture.dispose();
					throw new Error('That texture load was superseded.');
				}
				input.onSuccess?.(uri);
				return texture;
			} catch (error) {
				if (!disposed && (generations.get(uri) ?? 0) === generation) {
					const message = error instanceof Error ? error.message : 'The image could not load.';
					input.onFailure?.(uri, message);
				}
				throw error;
			} finally {
				options?.signal?.removeEventListener('abort', abortLoad);
				abort.signal.removeEventListener('abort', abortLoad);
			}
		},
		prepare: async (uris) => {
			if (disposed) return;
			// Every changed pin goes before the first await: meanwhile a consumer may ask for any of them.
			for (const uri of uris) forgetChangedPin(uri);
			for (const uri of uris) {
				// A dispose during an earlier awaited load must stop the whole list,
				// not start the next URI and cache its closed-scope failure.
				if (disposed) return;
				requested.add(uri);
				// Again, for a pin that changed during an earlier await.
				forgetChangedPin(uri);
				if (prepared.has(uri)) continue;
				const pinHash = pinHashOf(uri);
				prepared.add(uri);
				if (pinHash !== null) preparedPins.set(uri, pinHash);
				try {
					// The same source-cache entry the Stage asks for, so warming an
					// aspect costs no second download.
					await loadSourceTexture(uri, 'map', scope);
				} catch {
					// A failed prepare leaves the failure cached; the Card's Retry
					// invalidates it. The Stage still renders the Finish colour.
				}
			}
		},
		retry: (uri) => {
			if (disposed) return;
			forget(uri);
			void scope.prepare([uri]);
		},
		dimensionsOf: (assetId) => dimensions.get(assetId) ?? null,
		aspectOf: (assetId) => {
			const size = dimensions.get(assetId);
			return size === undefined ? null : size.width / size.height;
		},
		previewUriOf: (assetId) => previewUris.get(assetId) ?? null,
		dispose: () => {
			if (disposed) return;
			disposed = true;
			abort.abort();
			// Release this route's uploaded Finish views now; budget eviction is for
			// live working sets, not a teardown guarantee.
			releaseFinishViewsForScope(scope.scopeId);
			// Release every source, variant and failed material result for this
			// route, including URIs whose load failed or is still in flight.
			releaseTextureScope(scope.scopeId);
			requested.clear();
			generations.clear();
			for (const url of previewUris.values()) URL.revokeObjectURL(url);
			previewUris.clear();
			dimensions.clear();
			prepared.clear();
			preparedPins.clear();
		},
	};
	return scope;
}
