import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '$lib/content/material-thumbnails.json';
import { materials } from '$lib/content/materials';
import { INSPECTION_VERSION, inspectionThumbnailKey } from '$lib/render/materials/inspection';
import { INSPECTION_GEOMETRY_VERSION } from '$lib/render/materials/inspection-geometry';
import { INSPECTION_LIGHTING_VERSION } from '$lib/render/materials/inspection-lighting';
import { resolveInspectionSubject } from '$lib/render/materials/inspection-subject';
import { catalogueThumbnailUri } from '$lib/render/materials/catalogue-thumbnails';
import type { MaterialId } from '$lib/types/materials';
import { EDITOR_ROOT } from '../../../helpers/import-closure';

const directory = join(EDITOR_ROOT, 'static', 'material-thumbnails');
const rows = manifest.thumbnails;

describe('the shipped 192×192 reference derivatives', () => {
	it('has exactly one row and one file per catalogue entry, in shelf order', () => {
		expect(rows.map((row) => row.id)).toEqual(materials.map((material) => material.id));
		expect(readdirSync(directory).sort()).toEqual(rows.map((row) => row.file).sort());
	});

	it.each(rows)('$id is the declared bytes at the reference size, under the current key', (row) => {
		const bytes = readFileSync(join(directory, row.file));
		expect(createHash('sha256').update(new Uint8Array(bytes)).digest('hex')).toBe(row.sha256);
		expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
		expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([192, 192]);
		expect([row.width, row.height, row.geometry]).toEqual([192, 192, 'sphere']);

		const { recipeKey } = resolveInspectionSubject({ kind: 'catalogue', id: row.id as MaterialId }, 'sphere');
		expect(inspectionThumbnailKey({ recipeKey: recipeKey! }), 'regenerate the derivatives').toBe(row.key);
		expect(catalogueThumbnailUri(row.id as MaterialId)).toBe(`/material-thumbnails/${row.file}`);
	});

	it('records the recipe versions it was generated with', () => {
		expect(manifest.versions).toEqual({
			inspection: INSPECTION_VERSION,
			lighting: INSPECTION_LIGHTING_VERSION,
			geometry: INSPECTION_GEOMETRY_VERSION
		});
	});

	it('offers none for an id outside the manifest', () => {
		expect(catalogueThumbnailUri('velvet-dark' as MaterialId)).toBeUndefined();
	});
});
