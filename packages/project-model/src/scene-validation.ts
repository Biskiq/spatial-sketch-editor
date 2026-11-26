import type { SceneObjectFallback } from './scene';

export type SceneConnectivityPolicy = 'single-component' | 'independent-components';

export type SceneValidationOptions = {
	/**
	 * Connectivity context. The default is the Scene document's one-graph
	 * invariant. Camera units opt into independent components explicitly through
	 * their named policy; no authored field carries this choice.
	 */
	connectivity?: SceneConnectivityPolicy;
	/** Catalogue seam: the model cannot know which asset IDs a host ships. */
	isKnownAssetId?: (assetId: string) => boolean;
	/** Catalogue seam for material definitions. */
	isKnownMaterialId?: (materialId: string) => boolean;
	isSceneObjectFallback?: (value: unknown) => value is SceneObjectFallback;
	isSafeTextureUri?: (uri: string) => boolean;
};

export type ResolvedSceneValidationOptions = {
	connectivity: SceneConnectivityPolicy;
	isKnownAssetId: (assetId: string) => boolean;
	isKnownMaterialId: (materialId: string) => boolean;
	isSceneObjectFallback: (value: unknown) => value is SceneObjectFallback;
	isSafeTextureUri: (uri: string) => boolean;
};

const MATERIAL_IDS = new Set([
	'wood-oak-veneer',
	'wood-walnut-veneer',
	'wood-oak-planks',
	'wood-herringbone-parquet',
	'stone-travertine',
	'stone-terrazzo',
	'masonry-brick-red',
	'plaster-painted',
	'concrete-smooth',
	'concrete-polished',
	'tile-ceramic-white',
	'metal-stainless-satin',
	'metal-brass-satin',
	'metal-copper-satin',
	'metal-gold-satin',
	'metal-stainless-brushed',
	'metal-aluminium-brushed',
	'textile-linen',
	'textile-carpet-loop',
	'leather-cognac',
	'synthetic-plastic-matte',
	// Legacy placeholder bases: existing documents keep resolving.
	'plaster-warm',
	'wood-walnut',
	'brass-aged',
	'marble-light',
	'velvet-dark',
	'paper-aged',
	// The technical base is a valid fallback for a resource-backed Finish and
	// for a primitive whose project Finish supplies the authored signals.
	'pbr-neutral-v1',
]);

const FALLBACKS = new Set<SceneObjectFallback>([
	'piano',
	'chair',
	'sofa',
	'table',
	'chandelier',
	'desk',
	'lamp',
	'frame',
	'books',
	'clock',
	'rug',
	'generic',
]);

export function withSceneValidationOptions(
	options: SceneValidationOptions = {},
): ResolvedSceneValidationOptions {
	return {
		connectivity: options.connectivity ?? 'single-component',
		isKnownAssetId: options.isKnownAssetId ?? (() => true),
		isKnownMaterialId: options.isKnownMaterialId ?? ((id) => MATERIAL_IDS.has(id)),
		isSceneObjectFallback:
			options.isSceneObjectFallback ??
			((value): value is SceneObjectFallback =>
				typeof value === 'string' && FALLBACKS.has(value as SceneObjectFallback)),
		isSafeTextureUri: options.isSafeTextureUri ?? isSafeTextureUri,
	};
}

/** Root-relative, query-free, traversal-free texture URI validation. */
export function isSafeTextureUri(uri: string): boolean {
	if (
		!uri.startsWith('/') ||
		uri.startsWith('//') ||
		uri.includes('\\') ||
		uri.includes('?') ||
		uri.includes('#')
	) {
		return false;
	}
	let decoded = uri;
	let stable = false;
	for (let depth = 0; depth < 8; depth += 1) {
		let next: string;
		try {
			next = decodeURIComponent(decoded);
		} catch {
			return false;
		}
		if (next === decoded) {
			stable = true;
			break;
		}
		decoded = next;
	}
	if (!stable) return false;
	if (
		!decoded.startsWith('/') ||
		decoded.startsWith('//') ||
		decoded.includes('\\') ||
		decoded.includes('?') ||
		decoded.includes('#') ||
		/[\u0000-\u001f\u007f]/.test(decoded)
	) {
		return false;
	}
	return decoded.split('/').every((segment) => segment !== '.' && segment !== '..');
}
