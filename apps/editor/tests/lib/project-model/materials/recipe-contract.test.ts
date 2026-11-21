/**
 * The `pbr-metallic-roughness/v1` recipe grammar and identity.
 *
 * The suite names the material failures it catches: a canonicalization change
 * that moves the hash oracle, a local texture id leaking into identity, two
 * different signals sharing a digest, a tolerant reader admitting an
 * out-of-domain value, and a normalized recipe that a caller can mutate.
 */
import { describe, expect, it } from 'vitest';
import {
	CATALOGUE_BASE_IDS,
	CATALOGUE_MATERIAL_IDS,
	NEUTRAL_RECIPE,
	NEUTRAL_RECIPE_HASH,
	canonicalRecipeBytes,
	canonicalRecipeJson,
	catalogueMaterial,
	catalogueRecipe,
	catalogueRenderFacts,
	createImageIndex,
	dedupeMaterialIssues,
	isHash,
	normalizeOffset,
	normalizeRotation,
	readFinish,
	readOverrides,
	readRecipe,
	readRecipeWithHash,
	recipeHash,
	resolveFinish,
	shippedImageIndex,
	type MaterialIssue,
	type Recipe
} from '@portfolio/project-model/materials';
import { IMAGE_HASH, IMAGE_SOURCE, contentHash, fixtureImageIndex, fullRecipe } from './fixtures';

const ORACLE_JSON =
	'{"color":"#ffffff","mapping":{"kind":"target","metric":{"offset":[0,0],"rotation":0,"tileMeters":[1,1]}},"maps":{},"metalness":0,"normalScale":1,"occlusionStrength":1,"profile":"pbr-metallic-roughness/v1","roughness":0.5}';

async function hashOf(recipe: Recipe): Promise<string> {
	return recipeHash(recipe);
}

function mutated(recipe: Recipe, change: (next: Record<string, unknown>) => void): Record<string, unknown> {
	const next = JSON.parse(JSON.stringify(recipe)) as Record<string, unknown>;
	change(next);
	return next;
}

describe('recipe canonical identity', () => {
	it('matches the recorded neutral hash oracle byte for byte', async () => {
		expect(canonicalRecipeJson(NEUTRAL_RECIPE)).toBe(ORACLE_JSON);
		expect(new TextDecoder().decode(canonicalRecipeBytes(NEUTRAL_RECIPE))).toBe(ORACLE_JSON);
		expect(await recipeHash(NEUTRAL_RECIPE)).toBe(NEUTRAL_RECIPE_HASH);
		expect(NEUTRAL_RECIPE_HASH).toBe(
			'sha256-ce95db1ce6fb2381d7ff4542e05f83b857599e8dc673ca01d082cfc129c973bc'
		);
	});

	it('is order- and whitespace-invariant and has no trailing newline', async () => {
		const shuffled = {
			maps: {},
			normalScale: 1,
			mapping: {
				metric: { offset: [0, 0], rotation: 0, tileMeters: [1, 1] },
				kind: 'target'
			},
			occlusionStrength: 1,
			metalness: 0,
			roughness: 0.5,
			color: '#ffffff',
			profile: 'pbr-metallic-roughness/v1'
		};
		const read = readRecipe(shuffled);
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(canonicalRecipeJson(read.recipe)).toBe(ORACLE_JSON);
		expect(canonicalRecipeJson(read.recipe).endsWith('\n')).toBe(false);
		expect(await recipeHash(read.recipe)).toBe(NEUTRAL_RECIPE_HASH);
	});

	it('gives every changed signal a distinct digest', async () => {
		const variants: Record<string, Record<string, unknown>> = {
			neutral: JSON.parse(JSON.stringify(NEUTRAL_RECIPE)),
			color: mutated(NEUTRAL_RECIPE, (next) => {
				next.color = '#eeeeee';
			}),
			roughness: mutated(NEUTRAL_RECIPE, (next) => {
				next.roughness = 0.51;
			}),
			metalness: mutated(NEUTRAL_RECIPE, (next) => {
				next.metalness = 0.01;
			}),
			occlusionStrength: mutated(NEUTRAL_RECIPE, (next) => {
				next.occlusionStrength = 0.9;
			}),
			normalScale: mutated(NEUTRAL_RECIPE, (next) => {
				next.normalScale = 1.1;
			}),
			tile: mutated(NEUTRAL_RECIPE, (next) => {
				(next.mapping as { metric: { tileMeters: number[] } }).metric.tileMeters = [2, 1];
			}),
			rotation: mutated(NEUTRAL_RECIPE, (next) => {
				(next.mapping as { metric: { rotation: number } }).metric.rotation = 0.1;
			}),
			offset: mutated(NEUTRAL_RECIPE, (next) => {
				(next.mapping as { metric: { offset: number[] } }).metric.offset = [0.1, 0];
			}),
			colorMap: mutated(NEUTRAL_RECIPE, (next) => {
				next.maps = { color: { image: IMAGE_HASH.color } };
			}),
			roughnessComponent: mutated(NEUTRAL_RECIPE, (next) => {
				next.maps = { roughness: { image: IMAGE_HASH.roughness, component: 'g', invert: false } };
			}),
			roughnessComponentSwapped: mutated(NEUTRAL_RECIPE, (next) => {
				next.maps = { roughness: { image: IMAGE_HASH.roughness, component: 'b', invert: false } };
			}),
			roughnessInverted: mutated(NEUTRAL_RECIPE, (next) => {
				next.maps = { roughness: { image: IMAGE_HASH.roughness, component: 'g', invert: true } };
			}),
			normalPlusY: mutated(NEUTRAL_RECIPE, (next) => {
				next.maps = { normal: { image: IMAGE_HASH.normal, convention: '+Y' } };
			}),
			normalMinusY: mutated(NEUTRAL_RECIPE, (next) => {
				next.maps = { normal: { image: IMAGE_HASH.normal, convention: '-Y' } };
			})
		};
		const digests = new Map<string, string>();
		for (const [name, input] of Object.entries(variants)) {
			const read = readRecipe(input);
			expect(read.success, name).toBe(true);
			if (!read.success) continue;
			digests.set(name, await hashOf(read.recipe));
		}
		// The two roughness-component spellings are the ORM-swap oracle: a swapped
		// component must change the digest even though the image is identical.
		expect(digests.get('roughnessComponent')).not.toBe(digests.get('roughnessComponentSwapped'));
		expect(digests.get('normalPlusY')).not.toBe(digests.get('normalMinusY'));
		expect(new Set(digests.values()).size).toBe(Object.keys(variants).length);
	});

	it('keeps local texture ids out of the digest', async () => {
		const recipe = fullRecipe();
		const read = readRecipe(recipe);
		expect(read.success).toBe(true);
		if (!read.success) return;
		const projectA = createImageIndex([
			{ hash: IMAGE_HASH.color, source: { textureId: 'project-a-color' } },
			{ hash: IMAGE_HASH.normal, source: { textureId: 'project-a-normal' } },
			{ hash: IMAGE_HASH.orm, source: { textureId: 'project-a-orm' } },
			{ hash: IMAGE_HASH.roughness, source: { textureId: 'project-a-roughness' } }
		]);
		const projectB = createImageIndex([
			{ hash: IMAGE_HASH.color, source: { textureId: 'project-b-color' } },
			{ hash: IMAGE_HASH.normal, source: { textureId: 'project-b-normal' } },
			{ hash: IMAGE_HASH.orm, source: { textureId: 'project-b-orm' } },
			{ hash: IMAGE_HASH.roughness, source: { textureId: 'project-b-roughness' } }
		]);
		const a = resolveFinish({ material: read.recipe }, undefined, undefined, projectA);
		const b = resolveFinish({ material: read.recipe }, undefined, undefined, projectB);
		expect(a.inputs?.maps.color?.image?.source).toEqual({ textureId: 'project-a-color' });
		expect(b.inputs?.maps.color?.image?.source).toEqual({ textureId: 'project-b-color' });
		expect(await hashOf(read.recipe)).toBe(await hashOf(read.recipe));
		expect(a.issues).toEqual([]);
		expect(b.issues).toEqual([]);
	});

	it('readRecipeWithHash returns the normalized recipe and its digest together', async () => {
		const result = await readRecipeWithHash(NEUTRAL_RECIPE);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.hash).toBe(NEUTRAL_RECIPE_HASH);
		expect(Object.isFrozen(result.recipe)).toBe(true);
	});

	it('freezes the normalized recipe against mutation', () => {
		const read = readRecipe(NEUTRAL_RECIPE);
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(Object.isFrozen(read.recipe)).toBe(true);
		expect(Object.isFrozen(read.recipe.mapping)).toBe(true);
		expect(() => {
			(read.recipe as { roughness: number }).roughness = 0;
		}).toThrow(TypeError);
	});

	it('wraps authored angles and offsets and normalizes -0', () => {
		expect(normalizeRotation(0)).toBe(0);
		expect(normalizeRotation(-0)).toBe(0);
		expect(normalizeRotation(Math.PI * 2)).toBe(0);
		expect(normalizeRotation(-Math.PI / 2)).toBeCloseTo((Math.PI * 3) / 2, 12);
		expect(normalizeOffset(0)).toBe(0);
		expect(normalizeOffset(-0.25)).toBe(0.75);
		expect(normalizeOffset(2.5)).toBe(0.5);
		const read = readRecipe(
			mutated(NEUTRAL_RECIPE, (next) => {
				const metric = (next.mapping as { metric: { rotation: number; offset: number[] } }).metric;
				metric.rotation = -Math.PI / 2;
				metric.offset = [-0.25, 2.5];
			})
		);
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.recipe.mapping.kind).toBe('target');
		if (read.recipe.mapping.kind === 'uv') return;
		expect(read.recipe.mapping.metric.rotation).toBeCloseTo((Math.PI * 3) / 2, 12);
		expect(read.recipe.mapping.metric.offset).toEqual([0.75, 0.5]);
	});
});

describe('recipe strict reading', () => {
	it('reports an unsupported profile at its path', () => {
		const read = readRecipe(
			mutated(NEUTRAL_RECIPE, (next) => {
				next.profile = 'pbr-metallic-roughness/v2';
			})
		);
		expect(read.success).toBe(false);
		if (read.success) return;
		expect(read.issues).toContainEqual({
			code: 'unknown-profile',
			path: '$.profile',
			action: 'Use pbr-metallic-roughness/v1.'
		});
	});

	it('refuses unknown keys, wrong role selectors and non-finite values', () => {
		const wrongSelector = readRecipe(
			mutated(NEUTRAL_RECIPE, (next) => {
				next.maps = { color: { image: IMAGE_HASH.color, convention: '+Y' } };
			})
		);
		expect(wrongSelector.success).toBe(false);
		if (wrongSelector.success) return;
		expect(wrongSelector.issues).toContainEqual({
			code: 'wrong-role-selector',
			path: '$.maps.color.convention',
			role: 'color',
			action: 'Remove convention from the color binding.'
		});
		expect(wrongSelector.issues.some((issue) => issue.code === 'unknown-key')).toBe(false);

		const nonFinite = readRecipe(
			mutated(NEUTRAL_RECIPE, (next) => {
				next.roughness = Number.POSITIVE_INFINITY;
			})
		);
		expect(nonFinite.success).toBe(false);
		if (nonFinite.success) return;
		expect(nonFinite.issues).toMatchObject([{ code: 'invalid-type', path: '$.roughness' }]);

		const unknown = readRecipe(
			mutated(NEUTRAL_RECIPE, (next) => {
				next.extra = 1;
			})
		);
		expect(unknown.success).toBe(false);
		if (unknown.success) return;
		expect(unknown.issues).toMatchObject([{ code: 'unknown-key', path: '$.extra' }]);
	});

	it('refuses out-of-domain values without clamping', () => {
		const cases: Array<[string, Record<string, unknown>]> = [
			['roughness', { roughness: 1.01 }],
			['metalness', { metalness: -0.01 }],
			['occlusionStrength', { occlusionStrength: 2 }],
			['normalScale', { normalScale: 0 }],
			['normalScaleMax', { normalScale: 10.01 }],
			[
				'tileMin',
				{ mapping: { kind: 'target', metric: { tileMeters: [0.001, 1], rotation: 0, offset: [0, 0] } } }
			],
			[
				'tileMax',
				{ mapping: { kind: 'target', metric: { tileMeters: [101, 1], rotation: 0, offset: [0, 0] } } }
			],
			[
				'uvRepeatMin',
				{ mapping: { kind: 'uv', set: 0, repeat: [0, 1], rotation: 0, offset: [0, 0] } }
			],
			[
				'uvRepeatMax',
				{ mapping: { kind: 'uv', set: 0, repeat: [1, 1024.01], rotation: 0, offset: [0, 0] } }
			]
		];
		for (const [name, change] of cases) {
			const read = readRecipe(mutated(NEUTRAL_RECIPE, (next) => Object.assign(next, change)));
			expect(read.success, name).toBe(false);
			if (read.success) continue;
			expect(read.issues.some((issue) => issue.code === 'out-of-range'), name).toBe(true);
		}
	});

	it('refuses an invalid colour and a missing required field', () => {
		const badColour = readRecipe(
			mutated(NEUTRAL_RECIPE, (next) => {
				next.color = '#fff';
			})
		);
		expect(badColour.success).toBe(false);
		if (badColour.success) return;
		expect(badColour.issues).toMatchObject([{ code: 'invalid-colour', path: '$.color' }]);

		const missing = readRecipe(
			mutated(NEUTRAL_RECIPE, (next) => {
				delete next.maps;
			})
		);
		expect(missing.success).toBe(false);
		if (missing.success) return;
		expect(missing.issues).toMatchObject([{ code: 'missing-field', path: '$.maps' }]);
	});

	it('orders diagnostics by path, then role, then target', () => {
		const read = readRecipe(
			mutated(NEUTRAL_RECIPE, (next) => {
				next.color = '#fff';
				next.roughness = 2;
				next.maps = {
					normal: { image: 'not-a-hash', convention: 'up' },
					roughness: { image: 'not-a-hash', component: 'x', invert: 'no' },
					color: { image: 'not-a-hash', component: 'r' }
				};
			})
		);
		expect(read.success).toBe(false);
		if (read.success) return;
		const paths = read.issues.map((issue) => issue.path);
		expect(paths).toEqual([...paths].sort());
		// A stable total order means the exact same list on a second read.
		const again = readRecipe(
			mutated(NEUTRAL_RECIPE, (next) => {
				next.color = '#fff';
				next.roughness = 2;
				next.maps = {
					normal: { image: 'not-a-hash', convention: 'up' },
					roughness: { image: 'not-a-hash', component: 'x', invert: 'no' },
					color: { image: 'not-a-hash', component: 'r' }
				};
			})
		);
		expect(again.success).toBe(false);
		if (again.success) return;
		expect(again.issues).toEqual(read.issues);
		expect(dedupeMaterialIssues([...read.issues].reverse())).toEqual(read.issues);
	});

	it('reads sparse overrides and keeps zero as an authored value', () => {
		const read = readOverrides({ roughness: 0, metalness: 0, maps: { normal: null } });
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.overrides).toEqual({
			roughness: 0,
			metalness: 0,
			maps: { normal: null }
		});
	});

	it('refuses a selector that belongs to another override role', () => {
		const read = readOverrides({
			maps: { roughness: { image: { textureId: 'r' }, convention: '+Y' } }
		});
		expect(read.success).toBe(false);
		if (read.success) return;
		expect(read.issues).toContainEqual({
			code: 'wrong-role-selector',
			path: '$.maps.roughness.convention',
			role: 'roughness',
			action: 'Remove convention from the roughness binding.'
		});
	});

	it('requires exactly one local image selector and an allowlisted URI shape', () => {
		const both = readOverrides({
			maps: { color: { image: { textureId: 'a', shipped: '/textures/a.png' } } }
		});
		expect(both.success).toBe(false);
		if (both.success) return;
		expect(both.issues.some((issue) => issue.code === 'wrong-role-selector')).toBe(true);

		const relative = readOverrides({ maps: { color: { image: { shipped: 'textures/a.png' } } } });
		expect(relative.success).toBe(false);
		if (relative.success) return;
		expect(relative.issues.some((issue) => issue.code === 'invalid-value')).toBe(true);
	});

	it('omits an empty override container from a Finish', () => {
		const read = readFinish({
			id: 'finish-1',
			name: '  Walnut  ',
			base: { catalogue: 'wood-walnut' },
			overrides: {}
		});
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.finish.name).toBe('Walnut');
		expect(read.finish.overrides).toBeUndefined();

		const emptyMaps = readFinish({
			id: 'finish-2',
			name: 'Walnut',
			base: { catalogue: 'wood-walnut' },
			overrides: { maps: {} }
		});
		expect(emptyMaps.success).toBe(true);
		if (!emptyMaps.success) return;
		expect(emptyMaps.finish.overrides).toBeUndefined();
	});
});

describe('catalogue compatibility', () => {
	it('reads the six existing bases with their established appearance', async () => {
		const expected: Record<string, { color: string; roughness: number; metalness: number; tile: [number, number]; maps: string[] }> = {
			'plaster-warm': {
				color: '#c4b4a0',
				roughness: 0.92,
				metalness: 0.02,
				tile: [2, 2],
				maps: ['/textures/plaster-warm/map.png', '/textures/plaster-warm/roughness.png']
			},
			'wood-walnut': {
				color: '#3d2a1a',
				roughness: 0.78,
				metalness: 0.04,
				tile: [1.5, 1.5],
				maps: ['/textures/wood-walnut/map.png', '/textures/wood-walnut/roughness.png']
			},
			'brass-aged': {
				color: '#d6b35f',
				roughness: 0.45,
				metalness: 0.85,
				tile: [0.5, 0.5],
				maps: ['/textures/brass-aged/map.png']
			},
			'marble-light': { color: '#e8e4dc', roughness: 0.35, metalness: 0.08, tile: [1.2, 1.2], maps: [] },
			'velvet-dark': { color: '#3a1822', roughness: 0.95, metalness: 0, tile: [1, 1], maps: [] },
			'paper-aged': { color: '#e2d2b0', roughness: 0.9, metalness: 0, tile: [0.4, 0.4], maps: [] }
		};
		expect(CATALOGUE_MATERIAL_IDS).toEqual(Object.keys(expected));
		for (const id of CATALOGUE_MATERIAL_IDS) {
			const facts = catalogueRenderFacts(id);
			expect(facts, id).toBeDefined();
			expect(facts?.color).toBe(expected[id]!.color);
			expect(facts?.roughness).toBe(expected[id]!.roughness);
			expect(facts?.metalness).toBe(expected[id]!.metalness);
			expect(facts?.defaultTileSizeMeters).toEqual(expected[id]!.tile);
			expect(Object.values(facts?.mapUris ?? {})).toEqual(expected[id]!.maps);

			const resolved = resolveFinish({ catalogue: id }, undefined, undefined, shippedImageIndex());
			expect(resolved.issues, id).toEqual([]);
			expect(resolved.inputs?.color).toBe(expected[id]!.color);
			expect(resolved.inputs?.roughness).toBe(expected[id]!.roughness);
			expect(resolved.inputs?.metalness).toBe(expected[id]!.metalness);
			expect(resolved.inputs?.mapping.kind).toBe('target');
			if (resolved.inputs?.mapping.kind === 'target') {
				expect(resolved.inputs.mapping.metric.tileMeters).toEqual(expected[id]!.tile);
			}
			expect(resolved.inputs?.maps.color?.image?.source).toEqual(
				expected[id]!.maps.includes('/textures/plaster-warm/map.png') ||
					expected[id]!.maps.includes('/textures/wood-walnut/map.png') ||
					expected[id]!.maps.includes('/textures/brass-aged/map.png')
					? { shipped: expected[id]!.maps[0]! }
					: undefined
			);
			expect(await hashOf(catalogueRecipe(id)!)).toMatch(/^sha256-[0-9a-f]{64}$/);
		}
	});

	it('pins the six base recipe revisions as compatibility oracles', async () => {
		const expected: Record<string, string> = {
			'plaster-warm': 'sha256-834aa252d781156ddfb9df77150bd97215aea373381b77ce96f8d767c763a572',
			'wood-walnut': 'sha256-86092484bd0a9631c7f9b48c598be5840cab935178c42ec0e48a571edb52d265',
			'brass-aged': 'sha256-a08fcbf3f21e70a91932c7fc01623d7e78903d5cdeeff9e2b0381fb92e340d70',
			'marble-light': 'sha256-e29d0b584dbb87520ffb84686dd8be6fd9b3eadae1c49fc5ccab44a39f4dc27c',
			'velvet-dark': 'sha256-ded4ef9c43323776e45fdb3a3c5c19af6a3f58009f45ccb3d94f974adaa7330b',
			'paper-aged': 'sha256-79fa5adf7b9e7927e55c875209750b08f9ca59e29ff965c38657bf4b26286e46'
		};
		for (const [id, hash] of Object.entries(expected)) {
			expect(await hashOf(catalogueRecipe(id)!), id).toBe(hash);
		}
	});

	it('keeps the neutral base frozen and outside creator-facing counts', () => {
		expect(CATALOGUE_BASE_IDS).toEqual([...CATALOGUE_MATERIAL_IDS, 'pbr-neutral-v1']);
		expect(catalogueMaterial('pbr-neutral-v1')?.technical).toBe(true);
		expect(catalogueMaterial('pbr-neutral-v1')?.recipe).toBe(NEUTRAL_RECIPE);
		expect(catalogueMaterial('plaster-warm')?.technical).toBe(false);
	});

	it('resolves every shipped image by hash and allowlisted URI', () => {
		const index = shippedImageIndex();
		for (const id of CATALOGUE_MATERIAL_IDS) {
			const recipe = catalogueRecipe(id)!;
			for (const role of ['color', 'normal', 'roughness', 'metalness', 'occlusion'] as const) {
				const binding = recipe.maps[role];
				if (binding === undefined) continue;
				expect(isHash(binding.image)).toBe(true);
				const resolved = index.byHash(binding.image);
				expect(resolved, `${id}/${role}`).not.toBeNull();
				expect(resolved?.source).toMatchObject({ shipped: expect.stringMatching(/^\/textures\//) });
				expect(index.hashOf(resolved!.source)).toBe(binding.image);
			}
		}
		expect(index.hashOf({ shipped: '/textures/unknown.png' })).toBeNull();
		expect(index.hashOf({ textureId: 'project-texture' })).toBeNull();
	});

	it('keeps a fully-specified recipe byte-identical through a second read', async () => {
		const first = readRecipe(fullRecipe());
		expect(first.success).toBe(true);
		if (!first.success) return;
		const second = readRecipe(JSON.parse(JSON.stringify(first.recipe)));
		expect(second.success).toBe(true);
		if (!second.success) return;
		expect(await hashOf(second.recipe)).toBe(await hashOf(first.recipe));
		expect(canonicalRecipeJson(second.recipe)).toBe(canonicalRecipeJson(first.recipe));
	});
});

describe('image index', () => {
	it('resolves an override source to its pinned digest and merges scopes deterministically', () => {
		const index = fixtureImageIndex();
		expect(index.hashOf(IMAGE_SOURCE.color)).toBe(IMAGE_HASH.color);
		expect(index.byHash(IMAGE_HASH.color)?.source).toEqual(IMAGE_SOURCE.color);
		expect(index.byHash(contentHash('absent'))).toBeNull();

		const alternate = createImageIndex([
			{ hash: IMAGE_HASH.alternate, source: { textureId: 'alternate-texture' } }
		]);
		const merged = createImageIndex([
			...[
				{ hash: IMAGE_HASH.color, source: IMAGE_SOURCE.color },
				{ hash: IMAGE_HASH.normal, source: IMAGE_SOURCE.normal },
				{ hash: IMAGE_HASH.orm, source: IMAGE_SOURCE.orm },
				{ hash: IMAGE_HASH.roughness, source: IMAGE_SOURCE.roughness }
			],
			{ hash: IMAGE_HASH.alternate, source: { textureId: 'alternate-texture' } }
		]);
		expect(merged.byHash(IMAGE_HASH.alternate)?.source).toEqual({ textureId: 'alternate-texture' });
		expect(merged.hashOf({ textureId: 'alternate-texture' })).toBe(IMAGE_HASH.alternate);
		expect(alternate.byHash(IMAGE_HASH.color)).toBeNull();
	});

	it('keeps one canonical identity while admitting every duplicate-content alias', () => {
		const first = createImageIndex([
			{ hash: IMAGE_HASH.color, source: { textureId: 'first' } },
			{ hash: IMAGE_HASH.color, source: { textureId: 'second' } }
		]);
		expect(first.byHash(IMAGE_HASH.color)?.source).toEqual({ textureId: 'first' });
		expect(first.hashOf({ textureId: 'second' })).toBe(IMAGE_HASH.color);
	});

	it('does not admit a source claimed for two different digests', () => {
		const conflict = createImageIndex([
			{ hash: IMAGE_HASH.color, source: { textureId: 'shared' } },
			{ hash: IMAGE_HASH.normal, source: { textureId: 'shared' } }
		]);
		expect(conflict.hashOf({ textureId: 'shared' })).toBe(IMAGE_HASH.color);
		expect(conflict.byHash(IMAGE_HASH.normal)).toBeNull();
	});
});
