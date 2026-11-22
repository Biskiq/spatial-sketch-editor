import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '$lib/content/material-tiles.json';
import thumbnails from '$lib/content/material-thumbnails.json';
import { materials } from '$lib/content/materials';
import { catalogueTile, catalogueTileKey } from '$lib/render/materials/catalogue-tiles';
import { catalogueThumbnailUri } from '$lib/render/materials/catalogue-thumbnails';
import { SAMPLE_TILE_RECIPE } from '$lib/render/materials/sample-tile';
import type { MaterialId } from '$lib/types/materials';
import { MATERIAL_LIBRARY_MAX_THUMBNAIL_BYTES, MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE } from '@portfolio/project-model/library';
import { EDITOR_ROOT } from '../../../helpers/import-closure';

const directory = join(EDITOR_ROOT, 'static', 'material-tiles');
const rows = manifest.tiles;

describe('the 256×256 sample-tile masters', () => {
	it('declares a product master of the current recipe', () => {
		expect(manifest.purpose).toBe('product-sample-tile-master');
		expect(manifest.recipe).toBe(SAMPLE_TILE_RECIPE);
	});

	it('has exactly one row and one file per catalogue entry, in catalogue order', () => {
		expect(rows.map((row) => row.id)).toEqual(materials.map((material) => material.id));
		expect(readdirSync(directory).sort()).toEqual(rows.map((row) => row.file).sort());
	});

	it.each(rows)('$id is the declared bytes, at the master size, under the current key', (row) => {
		const bytes = readFileSync(join(directory, row.file));
		expect(createHash('sha256').update(new Uint8Array(bytes)).digest('hex')).toBe(row.sha256);
		expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
		expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([256, 256]);
		expect([row.width, row.height]).toEqual([256, 256]);
		// The same file would be a valid private-library thumbnail.
		expect(bytes.byteLength).toBeLessThanOrEqual(MATERIAL_LIBRARY_MAX_THUMBNAIL_BYTES);
		expect(row.width).toBeLessThanOrEqual(MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE);

		expect(catalogueTileKey(row.id as MaterialId), 'regenerate the masters').toBe(row.key);
		expect(catalogueTile(row.id as MaterialId)).toEqual({ key: row.key, uri: `/material-tiles/${row.file}` });
	});

	it('offers none for an id outside the manifest', () => {
		expect(catalogueTile('velvet-dark' as MaterialId)).toBeUndefined();
	});

	it('leaves E7 engineering references and their manifest alone', () => {
		expect(thumbnails.purpose).toBe('engineering-reference');
		expect(thumbnails.thumbnails.every((row) => row.width === 192 && row.geometry === 'sphere')).toBe(true);
		expect(catalogueThumbnailUri('wood-oak-veneer')).toBe(`/material-thumbnails/${thumbnails.thumbnails[0]!.file}`);
		// A master never shares a key with a reference.
		const references = new Set(thumbnails.thumbnails.map((row) => row.key));
		expect(rows.some((row) => references.has(row.key))).toBe(false);
	});

	it('shares the G slot: the master edge is the library thumbnail cap, and 192 stays valid', () => {
		expect(MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE).toBe(256);
		expect(192).toBeLessThanOrEqual(MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE);
	});
});
