import { describe, expect, it } from 'vitest';
import {
	SAMPLE_TILE_MASTER_SIZE,
	SAMPLE_TILE_MAX_WINDOW_METERS,
	SAMPLE_TILE_MIN_WINDOW_METERS,
	SAMPLE_TILE_RECIPE,
	createSampleTileGeometry,
	defaultSampleTileFraming,
	normalizeSampleTileFraming,
	sampleTileFramingKey,
	sampleTileKey,
	sampleTileMetricFacts
} from '$lib/render/materials/sample-tile';
import { materials } from '$lib/content/materials';
import { materialThumbnailFraming } from '$lib/content/material-presentation';
import { resolveSampleTile } from '$lib/render/materials/sample-tile-resolve';
import { INSPECTION_THUMBNAIL_SIZE, inspectionThumbnailKey } from '$lib/render/materials/inspection';

describe('the sample-tile recipe', () => {
	it('is its own recipe at one 256 px master', () => {
		expect(SAMPLE_TILE_RECIPE).toBe('sample-tile/1');
		expect(SAMPLE_TILE_MASTER_SIZE).toBe(256);
	});

	it('frames a default window from the tile size alone: 40% of the smaller edge, within bounds', () => {
		expect(defaultSampleTileFraming([1, 1])).toEqual({ windowMeters: 0.4 });
		expect(defaultSampleTileFraming([2, 0.5])).toEqual({ windowMeters: 0.2 });
		expect(defaultSampleTileFraming([0.04, 0.04]).windowMeters).toBe(SAMPLE_TILE_MIN_WINDOW_METERS);
		expect(defaultSampleTileFraming([40, 40]).windowMeters).toBe(SAMPLE_TILE_MAX_WINDOW_METERS);
		expect(defaultSampleTileFraming(null).windowMeters).toBe(0.4);
	});

	it('makes any hint safe', () => {
		expect(normalizeSampleTileFraming({ windowMeters: Number.NaN, centre: [4, -2] })).toEqual({
			windowMeters: 0.4,
			centre: [1, 0]
		});
		expect(normalizeSampleTileFraming({ windowMeters: 9 }).windowMeters).toBe(SAMPLE_TILE_MAX_WINDOW_METERS);
		expect(normalizeSampleTileFraming({ windowMeters: 0.2 }).centre).toEqual([0.5, 0.5]);
	});

	it('binds the Finish against the window: one UV unit is the window', () => {
		expect(sampleTileMetricFacts({ windowMeters: 0.28 })).toEqual({
			uvMeters: [0.28, 0.28],
			surfaceMeters: [0.28, 0.28]
		});
	});

	describe('key', () => {
		const base = { recipeKey: 'recipe-a', framing: { windowMeters: 0.28, centre: [0.5, 0.5] as const }, lightingVersion: 2 };

		it('is deterministic and never collides with an E7 reference key', () => {
			expect(sampleTileKey(base)).toBe(sampleTileKey({ ...base }));
			expect(sampleTileKey(base)).toMatch(/^tile-[0-9a-f]+$/);
			expect(sampleTileKey(base)).not.toBe(inspectionThumbnailKey({ recipeKey: 'recipe-a' }));
			expect(INSPECTION_THUMBNAIL_SIZE).toBe(192);
		});

		it.each([
			['the recipe', { recipeKey: 'recipe-b' }],
			['the window', { framing: { windowMeters: 0.3, centre: [0.5, 0.5] as const } }],
			['the window centre', { framing: { windowMeters: 0.28, centre: [0.4, 0.5] as const } }],
			['the size', { width: 112 }],
			['the lighting version', { lightingVersion: 3 }]
		])('changes with %s', (_, change) => {
			expect(sampleTileKey({ ...base, ...change })).not.toBe(sampleTileKey(base));
		});

		it('hashes the normalized window, so equal pictures share a key', () => {
			expect(sampleTileFramingKey({ windowMeters: 0.28 })).toBe(sampleTileFramingKey({ windowMeters: 0.28, centre: [0.5, 0.5] }));
			expect(sampleTileKey({ ...base, framing: { windowMeters: 0.28 } })).toBe(sampleTileKey(base));
		});
	});

	describe('window geometry', () => {
		function uvExtent(geometry: ReturnType<typeof createSampleTileGeometry>) {
			const uv = geometry.getAttribute('uv');
			const values = Array.from({ length: uv.count }, (_, i) => [uv.getX(i), uv.getY(i)] as const);
			const xs = values.map((v) => v[0]);
			const ys = values.map((v) => v[1]);
			return { x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)] };
		}

		it('fits the visible square to exactly one window, centred', () => {
			const geometry = createSampleTileGeometry({ windowMeters: 0.28 }, null);
			const { x, y } = uvExtent(geometry);
			// A plane larger than the camera sees: the UV range spans a little more than one window.
			expect(x[1]! - x[0]!).toBeGreaterThan(0.9);
			expect((x[0]! + x[1]!) / 2).toBeCloseTo(0.5, 6);
			expect((y[0]! + y[1]!) / 2).toBeCloseTo(0.5, 6);
			geometry.dispose();
		});

		it('moves the window to its centre on the tile', () => {
			const centred = uvExtent(createSampleTileGeometry({ windowMeters: 0.34, centre: [0.5, 0.5] }, [1, 1]));
			const left = uvExtent(createSampleTileGeometry({ windowMeters: 0.34, centre: [0.42, 0.5] }, [1, 1]));
			// 0.08 of a 1 m tile, in window units.
			expect(centred.x[0]! - left.x[0]!).toBeCloseTo(0.08 / 0.34, 6);
			expect(centred.y[0]).toBeCloseTo(left.y[0]!, 6);
		});
	});

	describe('catalogue framing', () => {
		it('hints every curated entry, within bounds, and nothing else', () => {
			expect(Object.keys(materialThumbnailFraming).sort()).toEqual(materials.map((material) => material.id).sort());
			for (const material of materials) {
				const hint = materialThumbnailFraming[material.id];
				expect(hint, material.id).toBeDefined();
				const tile = material.defaultTileSizeMeters!;
				expect(hint!.windowMeters).toBeGreaterThanOrEqual(SAMPLE_TILE_MIN_WINDOW_METERS);
				// A window is a piece of the material, never a repeat: it fits inside the tile it frames, within the 0.9 m herringbone exception.
				expect(hint!.windowMeters, material.id).toBeLessThanOrEqual(Math.max(tile[0], tile[1]) + 1e-9);
			}
		});

		it('resolves every curated entry to a key, deterministically', () => {
			const keys = new Set<string>();
			for (const material of materials) {
				const hint = materialThumbnailFraming[material.id] ?? 'default';
				const first = resolveSampleTile({ kind: 'catalogue', id: material.id }, hint);
				const again = resolveSampleTile({ kind: 'catalogue', id: material.id }, hint);
				expect(first.key, material.id).not.toBeNull();
				expect(first.key).toBe(again.key);
				keys.add(first.key!);
			}
			// Smooth and Polished concrete differ by a factor, so their pictures have distinct keys.
			expect(keys.size).toBe(materials.length);
		});

		it('changes a key when the hint changes, and not when it is restated', () => {
			const id = 'masonry-brick-red' as const;
			const hinted = resolveSampleTile({ kind: 'catalogue', id }, materialThumbnailFraming[id]!);
			const moved = resolveSampleTile({ kind: 'catalogue', id }, { windowMeters: 0.5 });
			expect(moved.key).not.toBe(hinted.key);
			expect(resolveSampleTile({ kind: 'catalogue', id }, { ...materialThumbnailFraming[id]! }).key).toBe(hinted.key);
		});
	});
});
