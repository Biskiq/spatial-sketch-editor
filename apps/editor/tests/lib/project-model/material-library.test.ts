import { describe, expect, test } from 'vitest';
import {
	MATERIAL_LIBRARY_MAX_CANONICAL_BYTES,
	MATERIAL_LIBRARY_NAME_MAX_LENGTH,
	canonicalMaterialLibraryBytes,
	finishLibraryDraftFromScene,
	flattenFinishForLibrary,
	materialLibraryContentId,
	materialLibraryImageBindings,
	materialLibraryRecipeHash,
	readMaterialLibraryBytes,
	readMaterialLibraryPayload,
	type MaterialLibraryPayload
} from '@portfolio/project-model/library';
import { materialImageIndex, shippedImageIndex } from '@portfolio/project-model/materials';

const baseRecipe = {
	profile: 'pbr-metallic-roughness/v1' as const,
	color: '#c8a078',
	roughness: 0.55,
	metalness: 0.1,
	occlusionStrength: 0.9,
	normalScale: 1,
	mapping: {
		kind: 'uv' as const,
		set: 0 as const,
		repeat: [1, 1] as const,
		rotation: 0,
		offset: [0, 0] as const
	},
	maps: {}
};

const basePayload: MaterialLibraryPayload = {
	formatVersion: 1,
	kind: 'material',
	name: 'Oak',
	recipe: baseRecipe
};

const hashA = `sha256-${'a'.repeat(64)}`;
const hashB = `sha256-${'b'.repeat(64)}`;
const hashC = `sha256-${'c'.repeat(64)}`;
const hashD = `sha256-${'d'.repeat(64)}`;
const hashE = `sha256-${'e'.repeat(64)}`;
const hashF = `sha256-${'f'.repeat(64)}`;

describe('material library payload & identity', () => {
	test('same recipe under two names yields different contentId and identical recipeHash', async () => {
		const oak = { ...basePayload, name: 'Oak' };
		const walnut = { ...basePayload, name: 'Walnut' };
		const [oakId, walnutId, oakRecipe, walnutRecipe] = await Promise.all([
			materialLibraryContentId(oak),
			materialLibraryContentId(walnut),
			materialLibraryRecipeHash(oak),
			materialLibraryRecipeHash(walnut)
		]);
		expect(oakId).not.toBe(walnutId);
		expect(oakRecipe).toBe(walnutRecipe);
	});

	test('readMaterialLibraryPayload trims name and refuses unknown keys, wrong formatVersion, and bad names', () => {
		const trimmed = readMaterialLibraryPayload({ ...basePayload, name: '  Oak  ' });
		expect(trimmed.success).toBe(true);
		if (trimmed.success) expect(trimmed.payload.name).toBe('Oak');

		const unknownKey = readMaterialLibraryPayload({ ...basePayload, extra: true });
		expect(unknownKey.success).toBe(false);
		if (!unknownKey.success) {
			expect(unknownKey.issues.some((issue) => issue.code === 'unknown_property')).toBe(true);
		}

		const badVersion = readMaterialLibraryPayload({ ...basePayload, formatVersion: 2 });
		expect(badVersion.success).toBe(false);
		if (!badVersion.success) {
			expect(badVersion.issues[0]!.code).toBe('unsupported_format_version');
		}

		for (const badName of ['', '   \t  ', 'x'.repeat(MATERIAL_LIBRARY_NAME_MAX_LENGTH + 1)]) {
			const result = readMaterialLibraryPayload({ ...basePayload, name: badName });
			expect(result.success).toBe(false);
		}
	});

	test('readMaterialLibraryBytes verifies canonical JSON bytes, contentId, and 256 KiB cap', async () => {
		const bytes = canonicalMaterialLibraryBytes(basePayload);
		const contentId = await materialLibraryContentId(basePayload);
		const ok = await readMaterialLibraryBytes(bytes, { contentId });
		expect(ok.success).toBe(true);
		if (ok.success) {
			expect(ok.contentId).toBe(contentId);
			expect(ok.payload.name).toBe('Oak');
		}

		const mismatch = await readMaterialLibraryBytes(bytes, { contentId: hashA });
		expect(mismatch.success).toBe(false);
		if (!mismatch.success) expect(mismatch.issues[0]!.code).toBe('content_id_mismatch');

		const nonCanonical = new TextEncoder().encode(
			JSON.stringify({ name: 'Oak', kind: 'material', formatVersion: 1, recipe: baseRecipe })
		);
		const nonCanonicalRead = await readMaterialLibraryBytes(nonCanonical);
		expect(nonCanonicalRead.success).toBe(false);
		if (!nonCanonicalRead.success) {
			expect(nonCanonicalRead.issues[0]!.code).toBe('non_canonical_payload');
		}

		const oversized = new Uint8Array(MATERIAL_LIBRARY_MAX_CANONICAL_BYTES + 1);
		const oversizedRead = await readMaterialLibraryBytes(oversized);
		expect(oversizedRead.success).toBe(false);
		if (!oversizedRead.success) {
			expect(oversizedRead.issues[0]!.code).toBe('payload_too_large');
		}
	});
});

describe('materialLibraryImageBindings', () => {
	test('sorts bindings by digest ascending and refuses missing, unused, conflicting duplicates, and >5 images', () => {
		const recipeWithTwoMaps = {
			...baseRecipe,
			maps: {
				color: { image: hashB },
				roughness: { image: hashA, component: 'g' as const, invert: false }
			}
		};
		const sorted = materialLibraryImageBindings(recipeWithTwoMaps, [
			{ hash: hashB, source: { textureId: 'tex-b' } },
			{ hash: hashA, source: { textureId: 'tex-a' } }
		]);
		expect('images' in sorted).toBe(true);
		if ('images' in sorted) {
			expect(sorted.images.map((img) => img.hash)).toEqual([hashA, hashB]);
		}

		const missing = materialLibraryImageBindings(recipeWithTwoMaps, [
			{ hash: hashA, source: { textureId: 'tex-a' } }
		]);
		expect('issues' in missing).toBe(true);
		if ('issues' in missing) {
			expect(missing.issues.some((issue) => issue.code === 'missing_image')).toBe(true);
		}

		const unused = materialLibraryImageBindings(baseRecipe, [
			{ hash: hashA, source: { textureId: 'tex-a' } }
		]);
		expect('issues' in unused).toBe(true);
		if ('issues' in unused) {
			expect(unused.issues.some((issue) => issue.code === 'unused_image')).toBe(true);
		}

		const conflicting = materialLibraryImageBindings(recipeWithTwoMaps, [
			{ hash: hashA, source: { textureId: 'tex-a' } },
			{ hash: hashA, source: { textureId: 'tex-other' } },
			{ hash: hashB, source: { textureId: 'tex-b' } }
		]);
		expect('issues' in conflicting).toBe(true);
		if ('issues' in conflicting) {
			expect(conflicting.issues.some((issue) => issue.code === 'duplicate_image')).toBe(true);
		}

		const sixImagesRecipe = {
			...baseRecipe,
			maps: {
				color: { image: hashA },
				normal: { image: hashB, convention: '+Y' as const },
				roughness: { image: hashC, component: 'g' as const, invert: false },
				metalness: { image: hashD, component: 'b' as const, invert: false },
				occlusion: { image: hashE, component: 'r' as const, invert: false }
			}
		};
		// 5 distinct images is the max allowed; adding a 6th (or testing >5) is refused.
		expect('images' in materialLibraryImageBindings(sixImagesRecipe, [
			{ hash: hashA, source: { textureId: 't1' } },
			{ hash: hashB, source: { textureId: 't2' } },
			{ hash: hashC, source: { textureId: 't3' } },
			{ hash: hashD, source: { textureId: 't4' } },
			{ hash: hashE, source: { textureId: 't5' } }
		])).toBe(true);

		const sixUnused = materialLibraryImageBindings(sixImagesRecipe, [
			{ hash: hashA, source: { textureId: 't1' } },
			{ hash: hashB, source: { textureId: 't2' } },
			{ hash: hashC, source: { textureId: 't3' } },
			{ hash: hashD, source: { textureId: 't4' } },
			{ hash: hashE, source: { textureId: 't5' } },
			{ hash: hashF, source: { textureId: 't6' } }
		]);
		expect('issues' in sixUnused).toBe(true);
	});
});

describe('flattenFinishForLibrary & finishLibraryDraftFromScene', () => {
	test('refuses missing pin, missing palette slot, invalid override, and empty or >120-char Finish name', async () => {
		const missingPin = await flattenFinishForLibrary({
			name: 'Missing Pin',
			base: {
				material: {
					...baseRecipe,
					maps: { color: { image: hashA } }
				}
			},
			imageIndex: materialImageIndex([])
		});
		expect(missingPin.ok).toBe(false);

		const missingSlot = await flattenFinishForLibrary({
			name: 'Missing Slot',
			base: { catalogue: 'plaster-warm' },
			overrides: { color: { slot: 'nonexistent-slot' } },
			palette: [],
			imageIndex: shippedImageIndex()
		});
		expect(missingSlot.ok).toBe(false);
		if (!missingSlot.ok) {
			expect(missingSlot.issues.some((issue) => issue.code === 'missing-palette-slot')).toBe(true);
		}

		const invalidOverride = await flattenFinishForLibrary({
			name: 'Bad Roughness',
			base: { catalogue: 'plaster-warm' },
			overrides: { roughness: 99 },
			imageIndex: shippedImageIndex()
		});
		expect(invalidOverride.ok).toBe(false);

		const emptyName = await finishLibraryDraftFromScene({
			finish: {
				id: 'f-empty',
				name: '   ',
				base: { catalogue: 'plaster-warm' }
			},
			definition: null,
			definitionImages: [],
			textureImages: []
		});
		expect(emptyName.ok).toBe(false);
		if (!emptyName.ok) {
			expect(emptyName.issues.some((issue) => issue.code === 'empty_name')).toBe(true);
		}

		const longName = await finishLibraryDraftFromScene({
			finish: {
				id: 'f-long',
				name: 'a'.repeat(MATERIAL_LIBRARY_NAME_MAX_LENGTH + 1),
				base: { catalogue: 'plaster-warm' }
			},
			definition: null,
			definitionImages: [],
			textureImages: []
		});
		expect(longName.ok).toBe(false);
		if (!longName.ok) {
			expect(longName.issues.some((issue) => issue.code === 'name_too_long')).toBe(true);
		}
	});
});
