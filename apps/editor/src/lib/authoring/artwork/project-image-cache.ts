/**
 * The short-lived cache of bytes verified for the project load that is about to
 * install.
 *
 * Cold Load verifies the complete image closure before the candidate replaces
 * the current session. The Stage, Artwork scope and Finish texture scope then
 * consume those exact bytes instead of asking the API a second time. The cache
 * is bounded and insertion-ordered: bytes are evicted oldest-first when the
 * budget would be exceeded, and every entry is consumed at most once. A later
 * consumer that misses re-fetches through the normal route, which verifies the
 * same pin again.
 *
 * A candidate that fails verification clears the entries it had already put, so
 * a refused replacement never leaves bytes for the next project to read.
 */
import type { ProjectAssetContent } from '$lib/platform/project-persistence';

export const VERIFIED_PROJECT_IMAGE_CACHE_BYTES = 96 * 1024 * 1024;

export type VerifiedProjectImageCache = {
	put(projectId: string, assetId: string, image: ProjectAssetContent): void;
	take(projectId: string, assetId: string): ProjectAssetContent | null;
	clear(projectId: string): void;
	readonly bytes: number;
	readonly size: number;
};

function keyOf(projectId: string, assetId: string): string {
	return `${projectId}\u0000${assetId}`;
}

export function createVerifiedProjectImageCache(
	options: { maxBytes?: number } = {}
): VerifiedProjectImageCache {
	const maxBytes = options.maxBytes ?? VERIFIED_PROJECT_IMAGE_CACHE_BYTES;
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
		throw new Error('Verified image cache needs a positive byte budget');
	}
	const entries = new Map<string, ProjectAssetContent>();
	let bytes = 0;

	function forget(key: string): void {
		const existing = entries.get(key);
		if (existing === undefined) return;
		entries.delete(key);
		bytes -= existing.bytes.byteLength;
	}

	return {
		put(projectId, assetId, image) {
			const size = image.bytes.byteLength;
			if (size > maxBytes) return;
			const key = keyOf(projectId, assetId);
			forget(key);
			while (bytes + size > maxBytes) {
				const oldest = entries.keys().next();
				if (oldest.done === true) break;
				forget(oldest.value);
			}
			entries.set(key, image);
			bytes += size;
		},
		take(projectId, assetId) {
			const key = keyOf(projectId, assetId);
			const value = entries.get(key);
			if (value === undefined) return null;
			forget(key);
			return value;
		},
		clear(projectId) {
			const prefix = `${projectId}\u0000`;
			for (const key of [...entries.keys()]) {
				if (key.startsWith(prefix)) forget(key);
			}
		},
		get bytes() {
			return bytes;
		},
		get size() {
			return entries.size;
		}
	};
}
