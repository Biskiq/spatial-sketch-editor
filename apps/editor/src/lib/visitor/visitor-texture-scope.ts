/**
 * P22.1 — store-free release texture scope.
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
import { TextureLoader, type Texture as ThreeTexture } from 'three';
import type { MaterialTextureSlot } from '$lib/types/materials';
import { isAllowedShippedTextureUri } from './shipped-static-registry';

export type ReleaseBytesEntry = {
	bytes: Uint8Array;
	mime: string;
	sha256?: string;
};

export type ReleaseTextureScopeInit = {
	releaseId: string;
	bytesByUri: ReadonlyMap<string, ReleaseBytesEntry>;
};

export type ReleaseTextureScope = {
	releaseId: string;
	scopeId: string;
	objectUrlByUri: ReadonlyMap<string, string>;
	resolveTexture: (uri: string) => string | null;
	createSourceLoader: () => (uri: string, slot: MaterialTextureSlot) => Promise<ThreeTexture>;
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
	const createSourceLoader = () => {
		return async (uri: string, _slot: MaterialTextureSlot): Promise<ThreeTexture> => {
			const resolved = resolveTexture(uri);
			if (!resolved) throw new Error(`Texture not available in release ${releaseId}: ${uri}`);
			return loader.loadAsync(resolved);
		};
	};

	const dispose = () => {
		if (disposed) return;
		disposed = true;
		revokeAll();
	};

	return { releaseId, scopeId: releaseId, objectUrlByUri, resolveTexture, createSourceLoader, dispose };
}
