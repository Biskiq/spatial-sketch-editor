/**
 * Store-free release texture scope.
 *
 * Visitor-safe: pure + `three` only. No session/store imports. Takes verified
 * P20 bytes supplied by the caller (future API manifest, current tests), mints
 * per-release object URLs, and resolves every texture through one read-only
 * scope. Shipped-static URIs pass through only when allowlisted in the
 * compatibility registry; everything else (`/local/`, package rewrite paths,
 * `blob:`/`data:`, external URLs, unknown static, missing P20 refs) resolves
 * to null so callers surface a retryable failure instead of partial texturing.
 *
 * Lifetime: the owner revokes URLs via `dispose()` on unmount/failure. Dispose
 * is idempotent and never touches shared state.
 */
import { Texture as ThreeTextureClass, TextureLoader, type Texture as ThreeTexture } from 'three';
import type { MaterialTextureSlot } from '$lib/types/materials';
import { isAllowedShippedTextureUri } from './shipped-static-registry';
import { probeRawImage } from '$lib/render/resources/image-encoding';
import { releaseFinishViewsForScope } from '$lib/render/resources/finish-views';
import { releaseTextureScope } from '$lib/render/resources/texture-scope-release';

export type ReleaseBytesEntry = {
	bytes: Uint8Array;
	mime: string;
	sha256?: string;
};

type ReleaseSourceLoader = (
	uri: string,
	slot: MaterialTextureSlot,
	options?: { readonly policy: 'srgb' | 'raw' | string; readonly signal?: AbortSignal },
) => Promise<ThreeTexture>;

export type ReleaseTextureScopeInit = {
	releaseId: string;
	bytesByUri: ReadonlyMap<string, ReleaseBytesEntry>;
};

export type ReleaseTextureScope = {
	releaseId: string;
	scopeId: string;
	objectUrlByUri: ReadonlyMap<string, string>;
	resolveTexture: (uri: string) => string | null;
	createSourceLoader: () => ReleaseSourceLoader;
	dispose: () => void;
};

function assertReleaseId(releaseId: string): void {
	if (!releaseId.trim()) throw new Error('Release scope requires a non-empty releaseId');
}

export function createReleaseTextureScope(init: ReleaseTextureScopeInit): ReleaseTextureScope {
	assertReleaseId(init.releaseId);
	const releaseId = init.releaseId;
	const objectUrlByUri = new Map<string, string>();
	let disposed = false;

	const revokeAll = () => {
		for (const url of objectUrlByUri.values()) {
			try {
				URL.revokeObjectURL(url);
			} catch {
				// Best effort.
			}
		}
		objectUrlByUri.clear();
	};

	try {
		for (const [uri, entry] of init.bytesByUri) {
			if (!entry || entry.bytes.byteLength === 0) {
				throw new Error(`Release ${releaseId} has no bytes for texture: ${uri}`);
			}
			const blob = new Blob([entry.bytes.slice()], { type: entry.mime });
			objectUrlByUri.set(uri, URL.createObjectURL(blob));
		}
	} catch (error) {
		revokeAll();
		throw error;
	}

	const resolveTexture = (uri: string): string | null => {
		if (disposed) return null;
		const scoped = objectUrlByUri.get(uri);
		if (scoped) return scoped;
		if (isAllowedShippedTextureUri(uri)) return uri;
		return null;
	};

	const loader = new TextureLoader();
	/**
	 * Read one shipped raw map through the same pre-decode admission as the
	 * editor: only an allowlisted static URI may be fetched, and the probe runs
	 * before the browser allocates a bitmap. The release manifest never needs to
	 * carry bytes for catalogue-implied maps.
	 */
	const readShippedRaw = async (
		uri: string,
		signal: AbortSignal | undefined,
	): Promise<{ bytes: Uint8Array; mime: string }> => {
		if (!isAllowedShippedTextureUri(uri)) {
			throw new Error(`Raw texture is not a shipped or release asset in ${releaseId}: ${uri}`);
		}
		if (typeof fetch !== 'function') {
			throw new Error(`Raw shipped texture loading requires fetch in release ${releaseId}: ${uri}`);
		}
		const response = await fetch(uri, { signal });
		if (!response.ok) throw new Error(`HTTP ${response.status} for shipped texture: ${uri}`);
		const blob = await response.blob();
		const bytes = new Uint8Array(await blob.arrayBuffer());
		if (disposed || signal?.aborted) {
			throw signal?.reason ?? new Error(`Release ${releaseId} is closed`);
		}
		return { bytes, mime: probeRawImage(bytes).mime };
	};

	const createSourceLoader = () => {
		return async (
			uri: string,
			_slot: MaterialTextureSlot,
			options?: { readonly policy: 'srgb' | 'raw' | string; readonly signal?: AbortSignal },
		): Promise<ThreeTexture> => {
			const resolved = resolveTexture(uri);
			if (!resolved) throw new Error(`Texture not available in release ${releaseId}: ${uri}`);
			if (options?.signal?.aborted) throw options.signal.reason;
			if (options?.policy === 'raw') {
				if (typeof createImageBitmap !== 'function') {
					throw new Error(`Raw texture decoding is unavailable in release ${releaseId}: ${uri}`);
				}
				const privateEntry = init.bytesByUri.get(uri);
				const raw =
					privateEntry === undefined
						? await readShippedRaw(uri, options.signal)
						: { bytes: privateEntry.bytes, mime: probeRawImage(privateEntry.bytes).mime };
				// Preserve stored channels: refuse a non-8-bit, CMYK, animated or
				// EXIF-oriented map before the browser allocates its bitmap.
				const bitmap = await createImageBitmap(new Blob([raw.bytes.slice()], { type: raw.mime }), {
					imageOrientation: 'none',
					premultiplyAlpha: 'none',
					colorSpaceConversion: 'none',
				});
				if (disposed || options?.signal?.aborted) {
					bitmap.close();
					throw options?.signal?.reason ?? new Error(`Release ${releaseId} is closed`);
				}
				const texture = new ThreeTextureClass(bitmap);
				texture.userData.s8SourceBytes = raw.bytes.byteLength;
				return texture;
			}
			const texture = await loader.loadAsync(resolved);
			if (disposed || options?.signal?.aborted) {
				texture.dispose();
				throw options?.signal?.reason ?? new Error(`Release ${releaseId} is closed`);
			}
			return texture;
		};
	};

	const dispose = () => {
		if (disposed) return;
		disposed = true;
		// A release teardown frees its uploaded Finish views immediately; a
		// still-leased view is retired until its final release.
		releaseFinishViewsForScope(releaseId);
		releaseTextureScope(releaseId);
		revokeAll();
	};

	return {
		releaseId,
		scopeId: releaseId,
		objectUrlByUri,
		resolveTexture,
		createSourceLoader,
		dispose,
	};
}
