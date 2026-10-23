/**
 * T2.P02.S01 — the generic creator-model fallback is the approved footprint box.
 *
 * `AssetModel`/`AssetFallback` draw a creator model with no loaded GLB as a box.
 * Its plan extent comes from the approved revision's placement (metres), not a
 * catalogue dimension: the format owns the footprint and the renderer reads it.
 * Height stays a neutral 1 m because the placement format carries no height.
 */
import { describe, expect, it } from 'vitest';

import { getAssetById } from '$lib/content/assets';
import { assetFallbackDimensions, fallbackDimensionsFor, fallbackKindFor } from '$lib/museum/assets/fallbacks';

describe('creator-model generic fallback', () => {
	it('uses the approved footprint width and depth', () => {
		expect(fallbackDimensionsFor('generic', { width: 1.2, depth: 0.8 })).toEqual([1.2, 1, 0.8]);
		expect(fallbackDimensionsFor('generic', { width: 4, depth: 0.25 })).toEqual([4, 1, 0.25]);
	});

	it('falls back to the neutral 1 m box when no approved footprint is available', () => {
		expect(fallbackDimensionsFor('generic')).toEqual([1, 1, 1]);
	});

	it('resolves an id the catalogue cannot know to the generic footprint box', () => {
		expect(getAssetById('creator-model-1')).toBeUndefined();
		expect(fallbackKindFor(undefined, getAssetById('creator-model-1'))).toBe('generic');
		expect(fallbackKindFor(undefined, getAssetById('paris-grand-piano'))).toBe('piano');
		expect(fallbackKindFor('chair', getAssetById('paris-grand-piano'))).toBe('chair');
	});

	it('leaves every catalogue fallback kind on its catalogue dimensions', () => {
		for (const kind of Object.keys(assetFallbackDimensions) as Array<keyof typeof assetFallbackDimensions>) {
			if (kind === 'generic') continue;
			expect(fallbackDimensionsFor(kind, { width: 9, depth: 9 })).toEqual(assetFallbackDimensions[kind]);
		}
	});
});
