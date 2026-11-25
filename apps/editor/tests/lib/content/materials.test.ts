/**
 * The Finish catalogue facade.
 *
 * Scene 8 resolves a project Finish on top of a catalogue definition, and a
 * release pins its texture URIs through the shipped-static registry. The six
 * legacy placeholders are pinned field by field: existing documents and
 * baselines must keep reading them unchanged, although no shelf offers them.
 * The curated entries (T2.S8 F) are joined to the pure records by
 * `catalogue-pins.test.ts`; here they are checked as the creator shelf.
 */
import { describe, expect, it } from 'vitest';
import { SHIPPED_MATERIALS } from '@portfolio/project-model/package';
import { CATALOGUE_MATERIAL_IDS } from '@portfolio/project-model/materials';
import { getMaterial, isMaterialId, legacyMaterials, materials } from '$lib/content/materials';
import type { MaterialDefinition } from '$lib/types/materials';

const LEGACY: readonly MaterialDefinition[] = [
	{
		id: 'plaster-warm',
		label: 'Warm Plaster',
		textures: {
			map: '/textures/plaster-warm/map.png',
			roughnessMap: '/textures/plaster-warm/roughness.png'
		},
		fallbackColor: '#c4b4a0',
		roughness: 0.92,
		metalness: 0.02,
		defaultTileSizeMeters: [2, 2]
	},
	{
		id: 'wood-walnut',
		label: 'Walnut Wood',
		textures: {
			map: '/textures/wood-walnut/map.png',
			roughnessMap: '/textures/wood-walnut/roughness.png'
		},
		fallbackColor: '#3d2a1a',
		roughness: 0.78,
		metalness: 0.04,
		defaultTileSizeMeters: [1.5, 1.5]
	},
	{
		id: 'brass-aged',
		label: 'Aged Brass',
		textures: { map: '/textures/brass-aged/map.png' },
		fallbackColor: '#d6b35f',
		roughness: 0.45,
		metalness: 0.85,
		defaultTileSizeMeters: [0.5, 0.5]
	},
	{
		id: 'marble-light',
		label: 'Light Marble',
		fallbackColor: '#e8e4dc',
		roughness: 0.35,
		metalness: 0.08,
		defaultTileSizeMeters: [1.2, 1.2]
	},
	{
		id: 'velvet-dark',
		label: 'Dark Velvet',
		fallbackColor: '#3a1822',
		roughness: 0.95,
		metalness: 0,
		defaultTileSizeMeters: [1, 1]
	},
	{
		id: 'paper-aged',
		label: 'Aged Paper',
		fallbackColor: '#e2d2b0',
		roughness: 0.9,
		metalness: 0,
		defaultTileSizeMeters: [0.4, 0.4]
	}
];

describe('the Finish catalogue', () => {
	it('pins every appearance field of the six legacy ids', () => {
		// A label is presentation, not appearance: compare every other field.
		const appearance = (list: readonly MaterialDefinition[]) =>
			list.map(({ label: _label, ...definition }) => definition);
		expect(appearance(legacyMaterials)).toEqual(appearance(LEGACY));
		expect(legacyMaterials.map((definition) => definition.id)).toEqual(LEGACY.map((definition) => definition.id));
	});

	it('keeps the legacy ids resolvable but off the creator shelf', () => {
		const shelf = new Set(materials.map((definition) => definition.id));
		for (const definition of LEGACY) {
			expect(shelf.has(definition.id), definition.id).toBe(false);
			expect(isMaterialId(definition.id), definition.id).toBe(true);
			expect(getMaterial(definition.id).fallbackColor).toBe(definition.fallbackColor);
		}
	});

	it('offers exactly the curated catalogue, each with a measured shelf swatch', () => {
		expect(materials.map((definition) => definition.id)).toEqual([...CATALOGUE_MATERIAL_IDS]);
		for (const definition of materials) {
			expect(definition.swatchColor, definition.id).toMatch(/^#[0-9a-f]{6}$/);
		}
		expect(legacyMaterials.every((definition) => definition.swatchColor === undefined)).toBe(true);
	});

	it('pins the shipped-static texture URIs to each definition', () => {
		const all = [...LEGACY, ...materials];
		expect(SHIPPED_MATERIALS.map((entry) => entry.id)).toEqual(all.map((definition) => definition.id));
		for (const definition of all) {
			const shipped = SHIPPED_MATERIALS.find((entry) => entry.id === definition.id);
			expect(shipped, definition.id).toBeDefined();
			// A curated ORM image serves both the roughness and occlusion slots.
			expect(shipped?.textureUris).toEqual([...new Set(Object.values(definition.textures ?? {}))]);
		}
	});
});
