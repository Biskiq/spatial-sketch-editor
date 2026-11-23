/**
 * T2.S8 U5 — the Library browse model.
 *
 * The accepted 21-entry catalogue folds to 20 D1 cards, and every source,
 * family, search term and filter narrows the same immutable entries. No test
 * here reads a texture: the browse model names card entries only.
 */
import { describe, expect, it } from 'vitest';
import type { MaterialId } from '$lib/types/materials';
import { getMaterial, materials } from '$lib/content/materials';
import { materialFamilyOf, type MaterialFamilyId } from '$lib/content/material-presentation';
import {
	browseLibrary,
	curatedLibraryCards,
	libraryCardsOf,
	libraryCategoryOptions,
	librarySourceCount,
	type LibraryFilter,
	type LibraryFinishEntry
} from '$lib/authoring/library/library-catalogue';
import type { FinishSheenReading } from '@portfolio/project-model/scene-planning';

function reading(effective: number, current: 'matte' | 'satin' | 'gloss' = 'satin'): FinishSheenReading {
	return {
		steps: [
			{ id: 'matte', label: 'Matte', target: 0.2, factor: 0.3, disabled: false },
			{ id: 'satin', label: 'Satin', target: 0.45, factor: 0.6, disabled: false },
			{ id: 'gloss', label: 'Gloss', target: 0.8, factor: 1, disabled: false }
		],
		current,
		original: 'satin',
		originalExact: false,
		effective,
		scan: { mean: 1, approximate: false },
		changed: false
	};
}

function curated(id: MaterialId, patch: Partial<LibraryFinishEntry> = {}): LibraryFinishEntry {
	const material = getMaterial(id);
	const family = materialFamilyOf(id) as MaterialFamilyId | null;
	return {
		key: `curated:${id}`,
		source: 'curated',
		ref: { curated: id },
		name: material.label,
		materialLabel: material.label,
		family,
		familyLabel: family ?? 'Other',
		subline: 'Family · 1 m',
		color: material.swatchColor ?? material.fallbackColor,
		imageUri: null,
		curatedId: id,
		projectId: null,
		favourite: false,
		usage: 0,
		userKeys: [],
		changes: 0,
		reading: reading(material.roughness),
		sheen: material.roughness,
		metalness: material.metalness,
		hasColourImage: true,
		warning: null,
		...patch
	};
}

function project(id: string, patch: Partial<LibraryFinishEntry> = {}): LibraryFinishEntry {
	return {
		key: `project:${id}`,
		source: 'project',
		ref: { project: id },
		name: 'Lobby oak',
		materialLabel: 'Oak Veneer',
		family: 'wood',
		familyLabel: 'Wood',
		subline: 'from Oak Veneer · 2 changes',
		color: '#8a6a4a',
		imageUri: null,
		curatedId: null,
		projectId: id,
		favourite: false,
		usage: 2,
		userKeys: ['entity:a', 'surface:wall:left'],
		changes: 2,
		reading: reading(0.5),
		sheen: 0.5,
		metalness: 0,
		hasColourImage: true,
		warning: null,
		...patch
	};
}

const catalogue = materials.map((material) => curated(material.id));
const state = {
	source: 'all' as const,
	category: 'all' as const,
	filters: new Set<LibraryFilter>(),
	query: ''
};

describe('T2.S8 U5 — Library catalogue', () => {
	it('folds the 21 accepted entries into 20 D1 cards and keeps their order', () => {
		const cards = curatedLibraryCards(catalogue);
		expect(catalogue).toHaveLength(21);
		expect(cards).toHaveLength(20);
		expect(cards[0]?.title).toBe('Oak Veneer');
		const concrete = cards.find((card) => card.title === 'Concrete');
		expect(concrete?.variants.map((variant) => variant.label)).toEqual(['Matte', 'Polished']);
		expect(concrete?.entry.curatedId).toBe('concrete-smooth');
	});

	it('keeps a D1 card key stable while its chosen variant changes the entry', () => {
		const before = curatedLibraryCards(catalogue).find((card) => card.title === 'Concrete');
		const after = curatedLibraryCards(catalogue, { 'concrete-smooth': 'concrete-polished' }).find(
			(card) => card.title === 'Concrete'
		);
		expect(after?.key).toBe(before?.key);
		expect(after?.entry.curatedId).toBe('concrete-polished');
		expect(after?.variant).toBe('concrete-polished');
		expect(after?.entry.ref).toEqual({ curated: 'concrete-polished' });
	});

	it('groups All as this project first, then the curated shelf', () => {
		const groups = browseLibrary([project('oak'), ...catalogue], state);
		expect(groups.map((group) => group.label)).toEqual(['This project', 'Curated']);
		expect(groups[0]?.cards).toHaveLength(1);
		expect(groups[1]?.cards).toHaveLength(20);
		expect(browseLibrary(catalogue, { ...state, source: 'curated' })[0]?.label).toBeNull();
		expect(browseLibrary([project('oak')], { ...state, source: 'project' })[0]?.cards).toHaveLength(1);
	});

	it('searches names, families and origins, and folds D1 before matching', () => {
		const concrete = browseLibrary(catalogue, { ...state, query: 'concrete' });
		// The family search also finds Plaster & Concrete; D1 still leaves one Concrete card.
		expect(libraryCardsOf(concrete)).toHaveLength(2);
		expect(libraryCardsOf(concrete).map((card) => card.title)).toContain('Concrete');
		const oak = libraryCardsOf(browseLibrary(catalogue, { ...state, query: 'oak' }));
		expect(oak.map((card) => card.title)).toEqual(['Oak Veneer', 'Oak Plank Floor']);
		expect(libraryCardsOf(browseLibrary([project('oak')], { ...state, query: 'lobby' }))).toHaveLength(1);
		expect(browseLibrary(catalogue, { ...state, query: 'no such material' })).toEqual([]);
	});

	it('filters by family, favourites, usage, texture, metal and sheen', () => {
		const wood = libraryCardsOf(browseLibrary(catalogue, { ...state, category: 'wood' }));
		expect(wood.map((card) => card.title)).toEqual([
			'Oak Veneer',
			'Walnut Veneer',
			'Oak Plank Floor',
			'Herringbone Parquet'
		]);
		const all = catalogue.map((entry) =>
			entry.curatedId === 'wood-oak-veneer' ? { ...entry, favourite: true, usage: 3 } : entry
		);
		expect(libraryCardsOf(browseLibrary(all, { ...state, filters: new Set(['favourites']) }))).toHaveLength(1);
		expect(libraryCardsOf(browseLibrary(all, { ...state, filters: new Set(['used']) }))).toHaveLength(1);
		const plain = [...catalogue, project('plain', { hasColourImage: false })];
		expect(
			libraryCardsOf(browseLibrary(plain, { source: 'all', category: 'all', filters: new Set(['plain']), query: '' }))
				.map((card) => card.key)
		).toEqual(['project:plain']);
		const metal = libraryCardsOf(browseLibrary(catalogue, { ...state, filters: new Set(['metal']) }));
		expect(metal.length).toBeGreaterThan(0);
		expect(metal.every((card) => card.entry.metalness >= 0.5)).toBe(true);
		const matte = libraryCardsOf(
			browseLibrary([{ ...catalogue[0]!, sheen: 0.8 }, { ...catalogue[1]!, sheen: 0.4 }], {
				...state,
				filters: new Set(['matte'])
			})
		);
		expect(matte).toHaveLength(1);
		expect(matte[0]?.title).toBe('Oak Veneer');
		const glossy = libraryCardsOf(
			browseLibrary([{ ...catalogue[0]!, sheen: 0.8 }, { ...catalogue[1]!, sheen: 0.4 }], {
				...state,
				filters: new Set(['glossy'])
			})
		);
		expect(glossy).toHaveLength(1);
		expect(glossy[0]?.title).toBe('Walnut Veneer');
	});

	it('offers only families that exist in the chosen source', () => {
		const options = libraryCategoryOptions([project('oak'), ...catalogue], 'curated');
		expect(options[0]).toEqual({ id: 'all', label: 'All materials' });
		expect(options.map((option) => option.id)).toContain('wood');
		expect(options.map((option) => option.id)).not.toContain('other');
		const projectOptions = libraryCategoryOptions([project('imported', { family: null, familyLabel: 'Other' })], 'project');
		expect(projectOptions).toEqual([
			{ id: 'all', label: 'All materials' },
			{ id: 'other', label: 'Other' }
		]);
	});

	it('counts a source the way its grid reads: D1 is 20 curated cards', () => {
		expect(librarySourceCount(catalogue, 'curated')).toBe(20);
		expect(librarySourceCount([project('oak')], 'project')).toBe(1);
		expect(librarySourceCount([project('oak'), ...catalogue], 'all')).toBe(21);
	});

	it('does not mutate the entries it reads', () => {
		const snapshot = structuredClone(catalogue);
		browseLibrary(catalogue, { ...state, query: 'oak', filters: new Set(['textured']) });
		expect(catalogue).toEqual(snapshot);
	});
});
