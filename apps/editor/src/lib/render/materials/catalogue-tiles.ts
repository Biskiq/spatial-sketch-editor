/**
 * The curated catalogue's 256×256 sample-tile masters.
 *
 * One master per entry, drawn by the inspection host's `sample-tile/1` recipe
 * and committed with a manifest (`scripts/generate-material-tiles.mjs`). A row
 * is used only while its key equals the key the current entry, its framing
 * hint and every recipe version produce, so a changed entry has no master
 * rather than a stale one, and the picture falls back to the colour swatch.
 * Looking one up resolves a description only: it never loads a texture, and
 * never opens the full-resolution image set.
 *
 * The 192 px engineering references (`catalogue-thumbnails.ts`) are a separate
 * set with their own manifest and are untouched.
 */
import manifest from '$lib/content/material-tiles.json';
import { materialThumbnailFraming } from '$lib/content/material-presentation';
import type { MaterialId } from '$lib/types/materials';
import { SAMPLE_TILE_MASTER_SIZE, SAMPLE_TILE_RECIPE } from './sample-tile';
import { resolveSampleTile } from './sample-tile-resolve';

export type CatalogueTileRow = {
	readonly id: string;
	readonly key: string;
	readonly file: string;
	readonly width: number;
	readonly height: number;
	readonly sha256: string;
};

const rows = new Map((manifest.tiles as readonly CatalogueTileRow[]).map((row) => [row.id, row]));
const resolved = new Map<MaterialId, { readonly key: string; readonly uri: string } | undefined>();

/** The key the current catalogue entry's master must carry, or null when it cannot resolve. */
export function catalogueTileKey(id: MaterialId): string | null {
	return resolveSampleTile({ kind: 'catalogue', id }, materialThumbnailFraming[id] ?? 'default')
		.key;
}

/** The current 256 px master of one catalogue entry, or undefined when none is current. */
export function catalogueTile(
	id: MaterialId,
): { readonly key: string; readonly uri: string } | undefined {
	if (resolved.has(id)) return resolved.get(id);
	const row = rows.get(id);
	let tile: { readonly key: string; readonly uri: string } | undefined;
	if (
		row !== undefined &&
		manifest.recipe === SAMPLE_TILE_RECIPE &&
		row.width === SAMPLE_TILE_MASTER_SIZE &&
		row.height === SAMPLE_TILE_MASTER_SIZE &&
		catalogueTileKey(id) === row.key
	) {
		tile = { key: row.key, uri: `/material-tiles/${row.file}` };
	}
	resolved.set(id, tile);
	return tile;
}
