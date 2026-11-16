/**
 * The curated Finish catalogue.
 *
 * Scene 8 resolves a project Finish on top of one of these six definitions, and
 * a release pins their texture URIs through the shipped-static registry. Pinning
 * the complete definition catches a silent appearance change: a label edit is
 * allowed, every render field is not.
 */
import { describe, expect, it } from 'vitest';
import { SHIPPED_MATERIALS } from '@portfolio/project-model';
import { materials } from '$lib/content/materials';
import type { MaterialDefinition } from '$lib/types/materials';

const CATALOGUE: readonly MaterialDefinition[] = [
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
	it('pins every appearance field of all six ids', () => {
		// A label is presentation, not appearance: compare every other field.
		const appearance = (list: readonly MaterialDefinition[]) =>
			list.map(({ label: _label, ...definition }) => definition);
		expect(appearance(materials)).toEqual(appearance(CATALOGUE));
		expect(materials.map((definition) => definition.id)).toEqual(CATALOGUE.map((definition) => definition.id));
	});

	it('pins the shipped-static texture URIs to each definition', () => {
		expect(SHIPPED_MATERIALS.map((entry) => entry.id)).toEqual(
			CATALOGUE.map((definition) => definition.id)
		);
		for (const definition of CATALOGUE) {
			const shipped = SHIPPED_MATERIALS.find((entry) => entry.id === definition.id);
			expect(shipped, definition.id).toBeDefined();
			expect(shipped?.textureUris).toEqual(Object.values(definition.textures ?? {}));
		}
	});
});
