/**
 * The shipped catalogue manifest against the actual editor files.
 *
 * A catalogue recipe is portable only if its image pins describe the bytes that
 * ship. This suite hashes `apps/editor/static` directly and compares the
 * manifest's MIME, byte length and SHA; it also keeps the editor's existing
 * catalogue facade joined to the pure records so a display label cannot hide a
 * changed factor, tile or URI.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	CATALOGUE_MATERIAL_IDS,
	SHIPPED_MATERIAL_IMAGES,
	catalogueMaterials,
	catalogueRenderFacts
} from '@portfolio/project-model/materials';
import { listShippedTextureUris } from '@portfolio/project-model';
import { materials as editorCatalogue } from '$lib/content/materials';
import type { MaterialTextureSlot } from '$lib/types/materials';

const STATIC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../static');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ROLE_OF_EDITOR_SLOT: Readonly<Record<MaterialTextureSlot, string>> = {
	map: 'color',
	normalMap: 'normal',
	roughnessMap: 'roughness',
	aoMap: 'occlusion',
	metalnessMap: 'metalness'
};

describe('shipped material image pins', () => {
	it('hashes exactly the bytes the editor serves', () => {
		for (const image of SHIPPED_MATERIAL_IMAGES) {
			const bytes = readFileSync(resolve(STATIC_ROOT, image.uri.replace(/^\//, '')));
			const digest = `sha256-${createHash('sha256').update(new Uint8Array(bytes)).digest('hex')}`;
			expect(bytes.byteLength, image.uri).toBe(image.byteSize);
			expect(digest, image.uri).toBe(image.hash);
			expect(image.mime, image.uri).toBe('image/png');
			expect(bytes.subarray(0, 8).equals(new Uint8Array(PNG_SIGNATURE)), image.uri).toBe(true);
		}
	});

	it('admits only allowlisted shipped URIs and unique identities', () => {
		const allowlist = new Set(listShippedTextureUris());
		expect(SHIPPED_MATERIAL_IMAGES.map((image) => image.uri).filter((uri) => !allowlist.has(uri))).toEqual([]);
		expect(new Set(SHIPPED_MATERIAL_IMAGES.map((image) => image.uri)).size).toBe(
			SHIPPED_MATERIAL_IMAGES.length
		);
		expect(new Set(SHIPPED_MATERIAL_IMAGES.map((image) => image.hash)).size).toBe(
			SHIPPED_MATERIAL_IMAGES.length
		);
	});

	it('joins the pure catalogue records to the editor catalogue exactly', () => {
		expect(CATALOGUE_MATERIAL_IDS).toEqual(editorCatalogue.map((definition) => definition.id));
		for (const definition of editorCatalogue) {
			const facts = catalogueRenderFacts(definition.id);
			expect(facts, definition.id).toBeDefined();
			expect(facts?.color, definition.id).toBe(definition.fallbackColor);
			expect(facts?.roughness, definition.id).toBe(definition.roughness);
			expect(facts?.metalness, definition.id).toBe(definition.metalness);
			expect(facts?.defaultTileSizeMeters, definition.id).toEqual(
				definition.defaultTileSizeMeters ?? [1, 1]
			);
			const expectedUris: Record<string, string> = {};
			for (const [slot, uri] of Object.entries(definition.textures ?? {})) {
				expectedUris[ROLE_OF_EDITOR_SLOT[slot as MaterialTextureSlot]] = uri!;
			}
			expect(facts?.mapUris, definition.id).toEqual(expectedUris);
		}
	});

	it('keeps the technical neutral base out of the creator catalogue', () => {
		const creator = catalogueMaterials().filter((entry) => !entry.technical);
		expect(creator.map((entry) => entry.id)).toEqual(CATALOGUE_MATERIAL_IDS);
		expect(catalogueMaterials().find((entry) => entry.id === 'pbr-neutral-v1')?.technical).toBe(true);
		expect(editorCatalogue.some((definition) => (definition.id as string) === 'pbr-neutral-v1')).toBe(false);
	});
});
