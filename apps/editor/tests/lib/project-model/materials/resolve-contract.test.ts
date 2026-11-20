/**
 * One immutable definition plus sparse overrides.
 *
 * The suite catches: a pristine catalogue Finish losing its derived identity, an
 * authored value equal to its base being mistaken for inheritance, `null`
 * failing to disable one role, a binding replacement accidentally inheriting the
 * old convention or mapping, a local image id changing definition identity, and
 * a scoped instance edit changing the definition another user shares.
 */
import { describe, expect, it } from 'vitest';
import {
	catalogueRecipe,
	createImageIndex,
	finishIdentityKey,
	isPristineFinish,
	readFinish,
	readRecipe,
	recipeHash,
	resolveFinish,
	shippedImageIndex,
	type FinishOverrides,
	type PaletteSlot
} from '@portfolio/project-model/materials';
import { IMAGE_HASH, IMAGE_SOURCE, fixtureImageIndex, fullRecipe } from './fixtures';

const PALETTE: readonly PaletteSlot[] = [
	{ id: 'slot-walnut', name: 'Walnut', color: '#5a3a22' },
	{ id: 'slot-invalid', name: 'Broken', color: 'brown' }
];

function finishFor(overrides?: FinishOverrides, id = 'finish-a') {
	const read = readFinish({
		id,
		name: 'Walnut',
		base: { catalogue: 'wood-walnut' },
		...(overrides === undefined ? {} : { overrides })
	});
	if (!read.success) throw new Error(JSON.stringify(read.issues));
	return read.finish;
}

describe('Finish identity', () => {
	it('keeps an override-free catalogue Finish pristine and curated', () => {
		const finish = finishFor();
		expect(isPristineFinish(finish)).toBe(true);
		expect(finishIdentityKey(finish)).toBe('curated:wood-walnut');
	});

	it('keeps an authored value equal to its base as a project override', () => {
		const finish = finishFor({ roughness: 0.78 });
		expect(isPristineFinish(finish)).toBe(false);
		expect(finishIdentityKey(finish)).toBe('project:finish-a');
		const resolved = resolveFinish(
			{ catalogue: 'wood-walnut' },
			finish.overrides,
			undefined,
			shippedImageIndex()
		);
		expect(resolved.inputs?.roughness).toBe(0.78);
		expect(resolved.inputs?.provenance.roughness).toEqual({ source: 'override' });
	});

	it('always gives a resource-backed Finish project identity', () => {
		const read = readRecipe(fullRecipe());
		expect(read.success).toBe(true);
		if (!read.success) return;
		const finish = readFinish({
			id: 'resource-finish',
			name: 'Imported Walnut',
			base: { material: 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
		});
		expect(finish.success).toBe(true);
		if (!finish.success) return;
		expect(isPristineFinish(finish.finish)).toBe(false);
		expect(finishIdentityKey(finish.finish)).toBe('project:resource-finish');
	});

	it('names one identity for the same shared definition across scoped edits', async () => {
		const read = readRecipe(fullRecipe());
		expect(read.success).toBe(true);
		if (!read.success) return;
		const definitionHash = await recipeHash(read.recipe);
		const sharedA = readFinish({
			id: 'finish-left',
			name: 'Left',
			base: { material: definitionHash },
			overrides: {
				maps: {
					color: { image: { textureId: 'local-left' } }
				}
			}
		});
		const sharedB = readFinish({
			id: 'finish-right',
			name: 'Right',
			base: { material: definitionHash }
		});
		expect(sharedA.success && sharedB.success).toBe(true);
		if (!sharedA.success || !sharedB.success) return;

		const leftIndex = createImageIndex([
			{ hash: IMAGE_HASH.color, source: { textureId: 'local-left' } },
			{ hash: IMAGE_HASH.normal, source: IMAGE_SOURCE.normal },
			{ hash: IMAGE_HASH.orm, source: IMAGE_SOURCE.orm },
			{ hash: IMAGE_HASH.roughness, source: IMAGE_SOURCE.roughness }
		]);
		const left = resolveFinish(
			{ material: read.recipe },
			sharedA.finish.overrides,
			undefined,
			leftIndex
		);
		const right = resolveFinish(
			{ material: read.recipe },
			sharedB.finish.overrides,
			undefined,
			fixtureImageIndex()
		);
		expect(left.issues).toEqual([]);
		expect(right.issues).toEqual([]);
		expect(left.inputs?.maps.color?.image?.source).toEqual({ textureId: 'local-left' });
		expect(right.inputs?.maps.color?.image?.source).toEqual(IMAGE_SOURCE.color);
		// The scoped edit changed one instance's binding, never the shared definition.
		expect(await recipeHash(read.recipe)).toBe(definitionHash);
		expect(left.inputs?.roughness).toBe(right.inputs?.roughness);
		expect(left.inputs?.normalScale).toBe(right.inputs?.normalScale);
	});
});

describe('sparse override semantics', () => {
	it('inherits an omitted binding, including its convention and mapping', () => {
		const read = readRecipe(fullRecipe());
		expect(read.success).toBe(true);
		if (!read.success) return;
		const resolved = resolveFinish(
			{ material: read.recipe },
			{ roughness: 0.5 },
			undefined,
			fixtureImageIndex()
		);
		expect(resolved.issues).toEqual([]);
		expect(resolved.inputs?.maps.normal?.convention).toBe('+Y');
		expect(resolved.inputs?.maps.normal?.mapping).toEqual(read.recipe.mapping);
		expect(resolved.inputs?.provenance.maps.normal).toEqual({ source: 'base' });
		expect(resolved.inputs?.provenance.roughness).toEqual({ source: 'override' });
	});

	it('replaces the whole binding, never only its image', () => {
		const read = readRecipe(fullRecipe());
		expect(read.success).toBe(true);
		if (!read.success) return;
		const resolved = resolveFinish(
			{ material: read.recipe },
			{
				maps: {
					normal: { image: { textureId: 'replacement-normal' }, convention: '-Y' }
				}
			},
			undefined,
			createImageIndex([
				{ hash: IMAGE_HASH.color, source: IMAGE_SOURCE.color },
				{ hash: IMAGE_HASH.normal, source: { textureId: 'replacement-normal' } },
				{ hash: IMAGE_HASH.orm, source: IMAGE_SOURCE.orm },
				{ hash: IMAGE_HASH.roughness, source: IMAGE_SOURCE.roughness }
			])
		);
		expect(resolved.issues).toEqual([]);
		expect(resolved.inputs?.maps.normal?.convention).toBe('-Y');
		// The base binding carried its own mapping; a replacement binding without
		// one follows the set mapping again.
		expect(resolved.inputs?.maps.normal?.mapping).toEqual(resolved.inputs?.mapping);
		expect(resolved.inputs?.provenance.maps.normal).toEqual({ source: 'override' });
	});

	it('disables exactly one role with null and keeps the others', () => {
		const resolved = resolveFinish(
			{ catalogue: 'plaster-warm' },
			{ maps: { roughness: null } },
			undefined,
			shippedImageIndex()
		);
		expect(resolved.issues).toEqual([]);
		expect(resolved.inputs?.maps.roughness).toBeUndefined();
		expect(resolved.inputs?.maps.color?.image?.source).toEqual({
			shipped: '/textures/plaster-warm/map.png'
		});
		expect(resolved.inputs?.provenance.maps.roughness).toEqual({ source: 'disabled' });
		expect(resolved.inputs?.provenance.maps.color).toEqual({ source: 'base' });
	});

	it('restores the parent binding when the override is reset (removed)', () => {
		const base = resolveFinish(
			{ catalogue: 'plaster-warm' },
			undefined,
			undefined,
			shippedImageIndex()
		);
		const disabled = resolveFinish(
			{ catalogue: 'plaster-warm' },
			{ maps: { roughness: null } },
			undefined,
			shippedImageIndex()
		);
		const reset = resolveFinish(
			{ catalogue: 'plaster-warm' },
			{},
			undefined,
			shippedImageIndex()
		);
		expect(disabled.inputs?.maps.roughness).toBeUndefined();
		expect(reset.inputs?.maps).toEqual(base.inputs?.maps);
		expect(reset.inputs?.provenance).toEqual(base.inputs?.provenance);
	});

	it('replaces the set mapping for every binding without one', () => {
		const setMapping = {
			kind: 'uv' as const,
			set: 1 as const,
			repeat: [2, 3] as const,
			rotation: 1.2,
			offset: [0.1, 0.9] as const
		};
		const resolved = resolveFinish(
			{ catalogue: 'plaster-warm' },
			{ mapping: setMapping },
			undefined,
			shippedImageIndex()
		);
		expect(resolved.issues).toEqual([]);
		expect(resolved.inputs?.mapping).toEqual(setMapping);
		expect(resolved.inputs?.maps.color?.mapping).toEqual(setMapping);
		expect(resolved.inputs?.maps.roughness?.mapping).toEqual(setMapping);
		expect(resolved.inputs?.provenance.mapping).toEqual({ source: 'override' });
	});

	it('accepts zero factors wherever the range includes it', () => {
		const resolved = resolveFinish(
			{ catalogue: 'brass-aged' },
			{ roughness: 0, metalness: 0, occlusionStrength: 0, normalScale: 0.25 },
			undefined,
			shippedImageIndex()
		);
		expect(resolved.issues).toEqual([]);
		expect(resolved.inputs?.roughness).toBe(0);
		expect(resolved.inputs?.metalness).toBe(0);
		expect(resolved.inputs?.occlusionStrength).toBe(0);
		expect(resolved.inputs?.normalScale).toBe(0.25);
		expect(resolved.inputs?.provenance.roughness).toEqual({ source: 'override' });
	});

	it('resolves a palette follower and keeps the slot in its provenance', () => {
		const resolved = resolveFinish(
			{ catalogue: 'marble-light' },
			{ color: { slot: 'slot-walnut' } },
			PALETTE,
			shippedImageIndex()
		);
		expect(resolved.issues).toEqual([]);
		expect(resolved.inputs?.color).toBe('#5a3a22');
		expect(resolved.inputs?.provenance.color).toEqual({
			source: 'override',
			paletteSlot: 'slot-walnut'
		});
	});

	it('reports a missing palette slot and preserves the base colour', () => {
		const resolved = resolveFinish(
			{ catalogue: 'marble-light' },
			{ color: { slot: 'slot-absent' } },
			PALETTE,
			shippedImageIndex()
		);
		expect(resolved.inputs?.color).toBe('#e8e4dc');
		expect(resolved.issues).toContainEqual({
			code: 'missing-palette-slot',
			path: '$.overrides.color',
			action: 'Restore the palette slot or set a literal colour.'
		});
		expect(resolved.inputs?.provenance.color).toEqual({
			source: 'override',
			paletteSlot: 'slot-absent'
		});
	});

	it('reports an invalid palette colour rather than binding it', () => {
		const resolved = resolveFinish(
			{ catalogue: 'marble-light' },
			{ color: { slot: 'slot-invalid' } },
			PALETTE,
			shippedImageIndex()
		);
		expect(resolved.inputs?.color).toBe('#e8e4dc');
		expect(resolved.issues).toContainEqual({
			code: 'invalid-colour',
			path: '$.overrides.color',
			action: 'Use a lowercase #rrggbb palette colour.'
		});
	});
});

describe('image and base diagnostics', () => {
	it('reports a missing base pin with the role and an exact action', () => {
		const read = readRecipe(fullRecipe());
		expect(read.success).toBe(true);
		if (!read.success) return;
		const resolved = resolveFinish(
			{ material: read.recipe },
			undefined,
			undefined,
			createImageIndex([])
		);
		expect(resolved.inputs).not.toBeNull();
		expect(resolved.inputs?.maps.color?.image).toBeNull();
		expect(resolved.issues).toContainEqual({
			code: 'missing-pin',
			path: '$.maps.color.image',
			role: 'color',
			action: 'Pin the image or remove the binding.'
		});
	});

	it('reports an override image that no project pin verifies', () => {
		const resolved = resolveFinish(
			{ catalogue: 'marble-light' },
			{ maps: { color: { image: { textureId: 'unimported' } } } },
			undefined,
			createImageIndex([])
		);
		expect(resolved.issues).toContainEqual({
			code: 'missing-pin',
			path: '$.overrides.maps.color.image',
			role: 'color',
			action: 'Import or pin the image before binding it.'
		});
		expect(resolved.inputs?.maps.color?.image).toBeNull();
	});

	it('refuses an unknown catalogue base without inventing inputs', () => {
		const resolved = resolveFinish(
			{ catalogue: 'does-not-exist' },
			undefined,
			undefined,
			shippedImageIndex()
		);
		expect(resolved.inputs).toBeNull();
		expect(resolved.issues).toEqual([
			{
				code: 'unknown-catalogue-base',
				path: '$.base.catalogue',
				action: 'Use an admitted catalogue base.'
			}
		]);
	});

	it('reports an unknown shipped image as a missing pin', () => {
		const resolved = resolveFinish(
			{ catalogue: 'marble-light' },
			{ maps: { color: { image: { shipped: '/textures/absent.png' } } } },
			undefined,
			shippedImageIndex()
		);
		expect(resolved.issues).toContainEqual({
			code: 'missing-pin',
			path: '$.overrides.maps.color.image',
			role: 'color',
			action: 'Import or pin the image before binding it.'
		});
	});

	it('resolves a resource definition image through its own verified index', () => {
		const read = readRecipe(fullRecipe());
		expect(read.success).toBe(true);
		if (!read.success) return;
		const resolved = resolveFinish(
			{ material: read.recipe },
			undefined,
			undefined,
			createImageIndex([
				{ hash: IMAGE_HASH.color, source: { textureId: 'definition-color' } },
				{ hash: IMAGE_HASH.normal, source: { textureId: 'definition-normal' } },
				{ hash: IMAGE_HASH.orm, source: { textureId: 'definition-orm' } },
				{ hash: IMAGE_HASH.roughness, source: { textureId: 'definition-roughness' } }
			])
		);
		expect(resolved.issues).toEqual([]);
		expect(resolved.inputs?.maps.color?.image).toEqual({
			hash: IMAGE_HASH.color,
			source: { textureId: 'definition-color' }
		});
	});

	it('keeps factors separate from map bindings (untreated inspection value)', () => {
		const resolved = resolveFinish(
			{ catalogue: 'plaster-warm' },
			undefined,
			undefined,
			shippedImageIndex()
		);
		expect(resolved.inputs?.roughness).toBe(0.92);
		expect(resolved.inputs?.maps.roughness?.component).toBe('g');
		// The map is not multiplied into the factor here; lowering applies it once.
		expect(resolved.inputs?.roughness).not.toBe(0.92 * 0.5);
	});

	it('resolves every verified alias of duplicate image bytes to one canonical digest', () => {
		const index = createImageIndex([
			{ hash: IMAGE_HASH.color, source: { textureId: 'texture-a' } },
			{ hash: IMAGE_HASH.color, source: { textureId: 'texture-b' } }
		]);
		expect(index.byHash(IMAGE_HASH.color)?.source).toEqual({ textureId: 'texture-a' });
		expect(index.hashOf({ textureId: 'texture-b' })).toBe(IMAGE_HASH.color);

		const base = catalogueRecipe('marble-light');
		expect(base).toBeDefined();
		const resolved = resolveFinish(
			{ material: base! },
			{ maps: { color: { image: { textureId: 'texture-b' } } } },
			undefined,
			index
		);
		expect(resolved.issues).toEqual([]);
		expect(resolved.inputs?.maps.color?.image).toEqual({
			hash: IMAGE_HASH.color,
			source: { textureId: 'texture-a' }
		});
	});

	it('refuses a source claimed for two different digests', () => {
		const index = createImageIndex([
			{ hash: IMAGE_HASH.color, source: { textureId: 'shared' } },
			{ hash: IMAGE_HASH.normal, source: { textureId: 'shared' } }
		]);
		expect(index.hashOf({ textureId: 'shared' })).toBe(IMAGE_HASH.color);
		// The conflicting second identity is not admitted: one source cannot answer
		// with two contents.
		expect(index.byHash(IMAGE_HASH.normal)).toBeNull();
	});

	it('sorts multiple diagnostics by path and role', () => {
		const read = readRecipe(fullRecipe());
		expect(read.success).toBe(true);
		if (!read.success) return;
		const resolved = resolveFinish(
			{ material: read.recipe },
			{ color: { slot: 'missing-slot' } },
			[],
			createImageIndex([])
		);
		const paths = resolved.issues.map((issue) => issue.path);
		expect(paths).toEqual([...paths].sort());
		expect(resolved.issues.some((issue) => issue.code === 'missing-palette-slot')).toBe(true);
		expect(resolved.issues.some((issue) => issue.code === 'missing-pin')).toBe(true);

		// A reader-level failure is never partially applied: an invalid roughness
		// leaves every authored override un-applied and reports its own path.
		const invalid = resolveFinish(
			{ catalogue: 'wood-walnut' },
			{ color: '#112233', roughness: 3 },
			undefined,
			shippedImageIndex()
		);
		expect(invalid.inputs?.roughness).toBe(0.78);
		expect(invalid.inputs?.color).toBe('#3d2a1a');
		expect(invalid.issues).toContainEqual(
			expect.objectContaining({ code: 'out-of-range', path: '$.overrides.roughness' })
		);
	});
});
