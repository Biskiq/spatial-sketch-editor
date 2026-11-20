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
 * only that URI. The Stage reloads failed item textures through the
 * representation's `reloadTextures`, so a recovered image appears without
 * rebuilding the Scene.
 */
import { Texture as ThreeTextureClass, TextureLoader, type Texture as ThreeTexture } from 'three';
import { probeArtworkImage } from '@portfolio/project-model';
import {
	invalidateScopedMaterialLoads,
	invalidateTextureSource,
	loadSourceTexture,
	type TextureLoadScope
} from './texture-store';
import { imageSha256 } from '$lib/render/artwork/image-digest';

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
	const loaded = new Map<string, ThreeTexture>();
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
		const cached = invalidateTextureSource(scope.scopeId, uri);
		const texture = loaded.get(uri);
		if (texture !== undefined) {
			if (!cached) texture.dispose();
			loaded.delete(uri);
		}
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
			colorSpaceConversion: 'none'
		});
	}

	function publish(assetId: string, probe: { pixelWidth: number; pixelHeight: number }, blob: Blob): void {
		dimensions.set(assetId, { width: probe.pixelWidth, height: probe.pixelHeight });
		if (!previewUris.has(assetId)) previewUris.set(assetId, URL.createObjectURL(blob));
	}

	async function loadProjectImage(
		assetId: string,
		isCurrent: () => boolean = () => true,
		raw = false
	): Promise<ThreeTexture> {
		const pin = input.pins().get(assetId);
		if (pin === undefined) throw new Error('The image is not registered in this project.');
		const content = await input.load(assetId, abort.signal);
		abort.signal.throwIfAborted();
		const probe = probeArtworkImage(content.bytes);
		if (raw && probe.orientation !== 1) {
			throw new Error('Raw material maps require identity EXIF orientation.');
		}
		const digest = `sha256-${await imageSha256(content.bytes)}`;
		if (
			content.mime !== pin.mime ||
			probe.mime !== pin.mime ||
			content.bytes.length !== pin.size ||
			digest !== pin.hash
		) {
			throw new Error('The image bytes do not match the saved project.');
		}
		const blob = new Blob([Uint8Array.from(content.bytes)], { type: pin.mime });

		if (raw) {
			const bitmap = await decodeRaw(content.bytes, pin.mime);
			if (bitmap !== null) {
				if (disposed || !isCurrent()) {
					bitmap.close();
					throw new Error('The project texture scope is closed.');
				}
				publish(assetId, probe, blob);
				return new ThreeTextureClass(bitmap);
			}
		}

		const url = URL.createObjectURL(blob);
		try {
			const texture = await loader.loadAsync(url);
			if (disposed || !isCurrent()) {
				texture.dispose();
				throw new Error('The project texture scope is closed.');
			}
			publish(assetId, probe, blob);
			return texture;
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	async function loadCatalogue(uri: string, raw = false): Promise<ThreeTexture> {
		if (raw) {
			// A raw map cannot silently fall back to the colour-managed loader: that
			// would turn a normal/roughness map into display-referred sRGB bytes.
			if (typeof createImageBitmap !== 'function' || typeof fetch !== 'function') {
				throw new Error('Raw material maps require fetch and createImageBitmap.');
			}
			const response = await fetch(uri);
			if (!response.ok) throw new Error(`Could not load raw material map (${response.status}).`);
			const blob = await response.blob();
			const bitmap = await decodeRaw(new Uint8Array(await blob.arrayBuffer()), blob.type || 'image/png');
			if (bitmap === null) throw new Error('Raw material maps require createImageBitmap.');
			if (disposed) {
				bitmap.close();
				throw new Error('The project texture scope is closed.');
			}
			return new ThreeTextureClass(bitmap);
		}
		const texture = await loader.loadAsync(uri);
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
			const raw =
				options?.policy === 'raw' || (options === undefined && slot !== 'map');
			try {
				const texture =
					assetId === null
						? await loadCatalogue(uri, raw)
						: await loadProjectImage(
							assetId,
							() => (generations.get(uri) ?? 0) === generation,
							raw
							);
				if (disposed || (generations.get(uri) ?? 0) !== generation) {
					texture.dispose();
					throw new Error('That texture load was superseded.');
				}
				loaded.set(uri, texture);
				input.onSuccess?.(uri);
				return texture;
			} catch (error) {
				if (!disposed && (generations.get(uri) ?? 0) === generation) {
					const message = error instanceof Error ? error.message : 'The image could not load.';
					input.onFailure?.(uri, message);
				}
				throw error;
			}
		},
		prepare: async (uris) => {
			if (disposed) return;
			for (const uri of uris) {
				// A dispose during an earlier awaited load must stop the whole list,
				// not start the next URI and cache its closed-scope failure.
				if (disposed) return;
				requested.add(uri);
				const assetId = PROJECT_ASSET_URI.exec(uri)?.[1] ?? null;
				const pinHash = assetId === null ? null : (input.pins().get(assetId)?.hash ?? null);
				// A resource pin is immutable in a valid Scene, but a restored or
				// tampered envelope can change it under the same URI. Never serve the
				// previous bytes (or the previous failure) for a new pin.
				if (prepared.has(uri) && (assetId === null || preparedPins.get(uri) === pinHash)) continue;
				if (prepared.has(uri)) forget(uri);
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
			// Invalidate every requested URI, not only the successes: a cached
			// failure or an aborted in-flight load otherwise outlives this route and
			// the next scope with the same id never asks again.
			for (const uri of requested) {
				const cached = invalidateTextureSource(scope.scopeId, uri);
				const texture = loaded.get(uri);
				if (texture !== undefined && !cached) texture.dispose();
			}
			invalidateScopedMaterialLoads(scope.scopeId);
			loaded.clear();
			requested.clear();
			generations.clear();
			for (const url of previewUris.values()) URL.revokeObjectURL(url);
			previewUris.clear();
			dimensions.clear();
			prepared.clear();
			preparedPins.clear();
		}
	};
	return scope;
}
