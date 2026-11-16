import { describe, expect, it, vi } from 'vitest';
import { resolveSceneMaterial } from '$lib/render/materials/scene-instance-material';
import { CLAY_COLOR, CLAY_ROUGHNESS, FLAT_MIN_ROUGHNESS } from '$lib/render/materials/treatment';
import type { LookSource } from '$lib/render/materials/scene-instance-material';
import type { SceneDocument } from '$lib/content/scene';

const WALL_TEXTURE = { id: 'wall-detail', name: 'Wall Detail', uri: '/textures/wall-detail.webp' };
const FLOOR_TEXTURE = { id: 'floor-grain', name: 'Floor Grain', uri: '/textures/floor-grain.png' };
const NORMAL_TEXTURE = { id: 'wall-normal', name: 'Wall Normal', uri: '/textures/wall-normal.png' };

function doc(
	materials: SceneDocument['materials'],
	textures: SceneDocument['textures'] = [WALL_TEXTURE, FLOOR_TEXTURE, NORMAL_TEXTURE],
	extra: { palette?: LookSource['palette']; environment?: LookSource['environment'] } = {}
): LookSource {
	return { materials, textures, ...extra } as LookSource;
}

describe('resolveSceneMaterial', () => {
	it('returns catalogue slot URIs when no instance is set', () => {
		const result = resolveSceneMaterial(doc([]), {
			materialInstanceId: null,
			fallbackCatalogueId: 'plaster-warm'
		});

		expect(result.catalogue).toBe('plaster-warm');
		expect(result.slotUris.map).toBe('/textures/plaster-warm/map.png');
		expect(result.slotUris.roughnessMap).toBe('/textures/plaster-warm/roughness.png');
		expect(result.roughness).toBe(0.92);
		expect(result.metalness).toBe(0.02);
		expect(result.color).toBe('#c4b4a0');
		expect(result.defaultTileSizeMeters).toEqual([2, 2]);
		expect(result.normalScale).toBeNull();
		expect(result.rotation).toBe(0);
		expect(result.offset).toEqual([0, 0]);
	});

	it('replaces exactly the colour slot when an instance supplies maps.color', () => {
		const result = resolveSceneMaterial(
			doc([
				{
					id: 'wall-material',
					name: 'Wall Material',
					baseMaterialId: 'plaster-warm',
					maps: { color: 'wall-detail' }
				}
			]),
			{ materialInstanceId: 'wall-material', fallbackCatalogueId: 'plaster-warm' }
		);

		expect(result.slotUris.map).toBe('/textures/wall-detail.webp');
		expect(result.slotUris.roughnessMap).toBe('/textures/plaster-warm/roughness.png');
	});

	it('falls back to the catalogue map when a finish map id is unknown (with dev warn)', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		const result = resolveSceneMaterial(
			doc([
				{
					id: 'wall-material',
					name: 'Wall Material',
					baseMaterialId: 'plaster-warm',
					maps: { color: 'nonexistent' }
				}
			]),
			{ materialInstanceId: 'wall-material', fallbackCatalogueId: 'plaster-warm' }
		);

		expect(result.slotUris.map).toBe('/textures/plaster-warm/map.png');
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('reads a normal map and derives its authored scale and flip', () => {
		const args = (normal: {
			readonly normalScale?: number;
			readonly normalFlipY?: boolean;
		}) =>
			[
				doc([
					{
						id: 'wall-normal-material',
						name: 'Wall Normal Material',
						baseMaterialId: 'plaster-warm',
						maps: { normal: 'wall-normal' },
						...normal
					}
				]),
				{ materialInstanceId: 'wall-normal-material', fallbackCatalogueId: 'plaster-warm' as const }
			] as const;

		expect(resolveSceneMaterial(...args({})).normalScale).toEqual([1, 1]);
		expect(resolveSceneMaterial(...args({ normalScale: 0.5 })).normalScale).toEqual([0.5, 0.5]);
		expect(resolveSceneMaterial(...args({ normalFlipY: true })).normalScale).toEqual([1, -1]);
		expect(resolveSceneMaterial(...args({ normalScale: 0.25, normalFlipY: true })).normalScale).toEqual([
			0.25, -0.25
		]);
	});

	it('uses instance mapping for tile size, rotation and offset', () => {
		const result = resolveSceneMaterial(
			doc([
				{
					id: 'mapped',
					name: 'Mapped',
					baseMaterialId: 'plaster-warm',
					mapping: { tileMeters: [0.5, 0.25], rotation: Math.PI / 4, offset: [0.25, -0.5] }
				}
			]),
			{ materialInstanceId: 'mapped', fallbackCatalogueId: 'plaster-warm' }
		);

		expect(result.defaultTileSizeMeters).toEqual([0.5, 0.25]);
		expect(result.rotation).toBe(Math.PI / 4);
		expect(result.offset).toEqual([0.25, -0.5]);
	});

	it('resolves a literal colour and a palette follower', () => {
		const literal = resolveSceneMaterial(
			doc([{ id: 'm', name: 'M', baseMaterialId: 'plaster-warm', color: '#112233' }]),
			{ materialInstanceId: 'm', fallbackCatalogueId: 'plaster-warm' }
		);
		expect(literal.color).toBe('#112233');

		const follower = resolveSceneMaterial(
			doc(
				[{ id: 'm', name: 'M', baseMaterialId: 'plaster-warm', color: { slot: 'accent' } }],
				undefined,
				{ palette: [{ id: 'accent', name: 'Accent', color: '#aabbcc' }] }
			),
			{ materialInstanceId: 'm', fallbackCatalogueId: 'plaster-warm' }
		);
		expect(follower.color).toBe('#aabbcc');
	});

	it('falls back to the catalogue colour when a follower slot is missing (with dev warn)', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const result = resolveSceneMaterial(
			doc([{ id: 'm', name: 'M', baseMaterialId: 'plaster-warm', color: { slot: 'missing' } }]),
			{ materialInstanceId: 'm', fallbackCatalogueId: 'plaster-warm' }
		);
		expect(result.color).toBe('#c4b4a0');
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('keeps the natural look and its seed exactly as Scene 7 resolved it', () => {
		const materials: SceneDocument['materials'] = [
			{ id: 'm', name: 'M', baseMaterialId: 'plaster-warm', maps: { color: 'wall-detail' }, roughness: 0.4 }
		];
		const natural = resolveSceneMaterial(doc(materials), {
			materialInstanceId: 'm',
			fallbackCatalogueId: 'plaster-warm'
		});
		const explicit = resolveSceneMaterial(doc(materials, undefined, { environment: {} }), {
			materialInstanceId: 'm',
			fallbackCatalogueId: 'plaster-warm'
		});
		expect(explicit.variantSeed).toBe(natural.variantSeed);
		expect(natural.color).toBe('#c4b4a0');
		expect(natural.slotUris.map).toBe('/textures/wall-detail.webp');
	});

	it('applies Clay as resolved values with no maps and a changed variant', () => {
		const materials: SceneDocument['materials'] = [
			{
				id: 'm',
				name: 'M',
				baseMaterialId: 'plaster-warm',
				color: { slot: 'accent' },
				maps: { color: 'wall-detail', normal: 'wall-normal' },
				roughness: 0.2
			}
		];
		const natural = resolveSceneMaterial(doc(materials), {
			materialInstanceId: 'm',
			fallbackCatalogueId: 'plaster-warm'
		});
		const clay = resolveSceneMaterial(
			doc(materials, undefined, {
				palette: [{ id: 'accent', name: 'Accent', color: '#aabbcc' }],
				environment: { treatment: 'clay' }
			}),
			{ materialInstanceId: 'm', fallbackCatalogueId: 'plaster-warm' }
		);

		expect(clay.color).toBe(CLAY_COLOR);
		expect(clay.roughness).toBe(CLAY_ROUGHNESS);
		expect(clay.metalness).toBe(0);
		expect(clay.slotUris).toEqual({});
		expect(clay.normalScale).toBeNull();
		expect(clay.variantSeed).not.toBe(natural.variantSeed);
	});

	it('applies Flat as a roughness floor with no maps', () => {
		const flat = resolveSceneMaterial(
			doc(
				[
					{
						id: 'm',
						name: 'M',
						baseMaterialId: 'plaster-warm',
						color: '#445566',
						maps: { color: 'wall-detail' },
						roughness: 0.2
					}
				],
				undefined,
				{ environment: { treatment: 'flat-colour' } }
			),
			{ materialInstanceId: 'm', fallbackCatalogueId: 'plaster-warm' }
		);

		expect(flat.color).toBe('#445566');
		expect(flat.roughness).toBe(FLAT_MIN_ROUGHNESS);
		expect(flat.metalness).toBe(0);
		expect(flat.slotUris).toEqual({});
	});

	it('uses instance overrides for roughness and metalness when set', () => {
		const result = resolveSceneMaterial(
			doc([
				{
					id: 'm',
					name: 'M',
					baseMaterialId: 'plaster-warm',
					roughness: 0.35,
					metalness: 0.6
				}
			]),
			{ materialInstanceId: 'm', fallbackCatalogueId: 'plaster-warm' }
		);

		expect(result.roughness).toBe(0.35);
		expect(result.metalness).toBe(0.6);
	});

	it('uses unknown materialInstanceId without override (with dev warn)', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		const result = resolveSceneMaterial(doc([]), {
			materialInstanceId: 'missing',
			fallbackCatalogueId: 'marble-light'
		});

		expect(result.catalogue).toBe('marble-light');
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('generates a stable variantSeed for identical inputs', () => {
		const a = resolveSceneMaterial(doc([]), { materialInstanceId: null, fallbackCatalogueId: 'plaster-warm' });
		const b = resolveSceneMaterial(doc([]), { materialInstanceId: null, fallbackCatalogueId: 'plaster-warm' });
		expect(a.variantSeed).toBe(b.variantSeed);
	});

	it('produces the same variantSeed for the same effective (slot, roughness, metalness)', () => {
		const args = (id: string) => [
			doc([{ id, name: 'M', baseMaterialId: 'plaster-warm', maps: { color: 'wall-detail' } }]),
			{ materialInstanceId: id, fallbackCatalogueId: 'plaster-warm' as const }
		] as const;
		const a = resolveSceneMaterial(...args('m1'));
		const b = resolveSceneMaterial(...args('m3'));
		expect(a.variantSeed).toBe(b.variantSeed);
	});

	it('produces different variantSeeds for different effective textures', () => {
		const args = (id: string, textureId: string) => [
			doc([{ id, name: 'M', baseMaterialId: 'plaster-warm', maps: { color: textureId } }]),
			{ materialInstanceId: id, fallbackCatalogueId: 'plaster-warm' as const }
		] as const;
		const wallResolve = resolveSceneMaterial(...args('m-wall', 'wall-detail'));
		const floorResolve = resolveSceneMaterial(...args('m-floor', 'floor-grain'));
		expect(wallResolve.variantSeed).not.toBe(floorResolve.variantSeed);
	});
});
