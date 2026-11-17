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
import { TextureLoader, type Texture as ThreeTexture } from 'three';
import { probeArtworkImage } from '@portfolio/project-model';
import {
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
	let disposed = false;

	/** Drop one URI's decoded texture, source cache, dimensions and preview. */
	function forget(uri: string): void {
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

	async function loadProjectImage(assetId: string): Promise<ThreeTexture> {
		const pin = input.pins().get(assetId);
		if (pin === undefined) throw new Error('The image is not registered in this project.');
		const content = await input.load(assetId, abort.signal);
		abort.signal.throwIfAborted();
		const probe = probeArtworkImage(content.bytes);
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
		const url = URL.createObjectURL(blob);
		try {
			const texture = await loader.loadAsync(url);
			if (disposed) {
				texture.dispose();
				throw new Error('The project texture scope is closed.');
			}
			dimensions.set(assetId, { width: probe.pixelWidth, height: probe.pixelHeight });
			if (!previewUris.has(assetId)) previewUris.set(assetId, URL.createObjectURL(blob));
			return texture;
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	async function loadCatalogue(uri: string): Promise<ThreeTexture> {
		const texture = await loader.loadAsync(uri);
		if (disposed) {
			texture.dispose();
			throw new Error('The project texture scope is closed.');
		}
		return texture;
	}

	const scope: ProjectTextureScope = {
		scopeId: input.scopeId,
		loader: async (uri) => {
			const assetId = PROJECT_ASSET_URI.exec(uri)?.[1] ?? null;
			try {
				const texture = assetId === null ? await loadCatalogue(uri) : await loadProjectImage(assetId);
				loaded.set(uri, texture);
				input.onSuccess?.(uri);
				return texture;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'The image could not load.';
				input.onFailure?.(uri, message);
				throw error;
			}
		},
		prepare: async (uris) => {
			for (const uri of uris) {
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
			for (const [uri, texture] of loaded) {
				// Invalidation already disposes the cached texture; only a direct
				// `loader` result needs this second call.
				if (!invalidateTextureSource(scope.scopeId, uri)) texture.dispose();
			}
			loaded.clear();
			for (const url of previewUris.values()) URL.revokeObjectURL(url);
			previewUris.clear();
			dimensions.clear();
			prepared.clear();
		}
	};
	return scope;
}
