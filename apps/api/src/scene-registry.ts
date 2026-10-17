/**
 * The one API-side Scene catalogue boundary.
 *
 * Publication and conditional Save must validate against the **shipped**
 * registry, not the permissive defaults: a Save that persisted an unknown asset
 * would produce a document the visitor and the editor refuse. Keeping the
 * options here, shared by both paths, makes "admission equals runtime
 * preparation" a property of one module rather than two call sites that could
 * drift.
 */

import {
	getShippedMaterialById,
	getShippedModelByAssetId,
	isShippedFallback,
	type SceneObjectFallback,
	type SceneValidationOptions
} from '@portfolio/project-model';

export const REGISTRY_SCENE_OPTIONS: SceneValidationOptions = {
	isKnownAssetId: (assetId: string) => getShippedModelByAssetId(assetId) !== undefined,
	isKnownMaterialId: (materialId: string) => getShippedMaterialById(materialId) !== undefined,
	isSceneObjectFallback: (value: unknown): value is SceneObjectFallback => isShippedFallback(value),
	isSafeTextureUri: (uri: string) => isRootRelativeSafe(uri)
};

/**
 * Root-relative, query/hash-free, traversal-free URI. Publication and Save use
 * the same predicate so a texture URI cannot be safe for one and unsafe for the
 * other.
 */
export function isRootRelativeSafe(uri: string): boolean {
	if (!uri.startsWith('/') || uri.startsWith('//')) return false;
	if (uri.includes('\\') || uri.includes('?') || uri.includes('#')) return false;
	let decoded = uri;
	for (let depth = 0; depth < 8; depth += 1) {
		let next: string;
		try {
			next = decodeURIComponent(decoded);
		} catch {
			return false;
		}
		if (next === decoded) break;
		decoded = next;
		if (depth === 7) return false;
	}
	if (!decoded.startsWith('/') || decoded.startsWith('//')) return false;
	if (/[\u0000-\u001f\u007f]/.test(decoded)) return false;
	return decoded.split('/').every((segment) => segment !== '.' && segment !== '..');
}
