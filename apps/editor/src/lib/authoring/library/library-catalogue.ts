/**
 * The Library's browse model (T2.S8 U5).
 *
 * Pure presentation data and pure filtering over the accepted catalogue and
 * Scene. It never reads a texture URI, never writes a project and never opens a
 * renderer: cards only name a `FinishTile` source, so opening the Library reads
 * the U1 masters and never a full-resolution catalogue image.
 *
 * D1 folding lives here: Smooth and Polished concrete are one card with a
 * Matte / Polished chip, and the card keeps its stable identity while the chip
 * changes which entry its actions name.
 */
import type { MaterialId } from '$lib/types/materials';
import type { FinishSheenReading, SceneFinishRef } from '@portfolio/project-model/scene-planning';
import {
	foldVariantCards,
	materialFamilies,
	variantCardOf,
	type MaterialFamilyId
} from '$lib/content/material-presentation';

export type LibrarySource = 'all' | 'curated' | 'project';

export type LibraryFilter =
	| 'favourites'
	| 'textured'
	| 'plain'
	| 'metal'
	| 'matte'
	| 'glossy'
	| 'used';

export type LibraryCategory = MaterialFamilyId | 'other' | 'all';

/** One Finish the Library can show. Curated entries are raw materials; project entries are Finishes. */
export type LibraryFinishEntry = {
	/** `curated:<MaterialId>` or `project:<FinishId>`. */
	readonly key: string;
	readonly source: 'curated' | 'project';
	readonly ref: Exclude<SceneFinishRef, 'model-own'>;
	readonly name: string;
	/** The base material's label, or `Imported material`. */
	readonly materialLabel: string;
	readonly family: MaterialFamilyId | null;
	readonly familyLabel: string;
	/** `Wood · 0.5 m` or `from Oak Veneer · 2 changes`. */
	readonly subline: string;
	readonly color: string;
	readonly imageUri: string | null;
	readonly curatedId: MaterialId | null;
	readonly projectId: string | null;
	readonly favourite: boolean;
	readonly usage: number;
	readonly userKeys: readonly string[];
	readonly changes: number;
	/** The Finish's sheen steps and the effective value they reach. */
	readonly reading: FinishSheenReading;
	/** Effective roughness after Treatment (0 matte .. 1 rough). */
	readonly sheen: number;
	readonly metalness: number;
	readonly hasColourImage: boolean;
	readonly warning: string | null;
};

/** One grid card. A D1 card keeps a stable key while its variant changes. */
export type LibraryCard = {
	readonly key: string;
	readonly entry: LibraryFinishEntry;
	readonly title: string;
	readonly primary: MaterialId | null;
	readonly variant: MaterialId | null;
	readonly variants: readonly { readonly id: MaterialId; readonly label: string }[];
};

export type LibraryBrowseState = {
	readonly source: LibrarySource;
	readonly category: LibraryCategory;
	readonly filters: ReadonlySet<LibraryFilter>;
	readonly query: string;
};

export type LibraryGroup = {
	readonly label: string | null;
	readonly cards: readonly LibraryCard[];
};

export const LIBRARY_SOURCES: readonly { readonly id: LibrarySource; readonly label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'curated', label: 'Curated' },
	{ id: 'project', label: 'This project' }
];

export const LIBRARY_FILTERS: readonly { readonly id: LibraryFilter; readonly label: string }[] = [
	{ id: 'favourites', label: '★ Favourites' },
	{ id: 'textured', label: 'Textured' },
	{ id: 'plain', label: 'Plain colour' },
	{ id: 'metal', label: 'Metal' },
	{ id: 'matte', label: 'Matte' },
	{ id: 'glossy', label: 'Glossy' },
	{ id: 'used', label: 'Used here' }
];

export function libraryFamilyLabel(family: MaterialFamilyId | null): string {
	return materialFamilies.find((entry) => entry.id === family)?.label ?? 'Other';
}

export function libraryCategoryOf(entry: LibraryFinishEntry): LibraryCategory {
	return entry.family ?? 'other';
}

/** The family categories present in the current source, in taxonomy order. */
export function libraryCategoryOptions(
	entries: readonly LibraryFinishEntry[],
	source: LibrarySource
): readonly { readonly id: LibraryCategory; readonly label: string }[] {
	const visible = entries.filter((entry) => source === 'all' || entry.source === source);
	const present = new Set(visible.map(libraryCategoryOf));
	const options: { id: LibraryCategory; label: string }[] = [{ id: 'all', label: 'All materials' }];
	for (const family of materialFamilies) {
		if (present.has(family.id)) options.push({ id: family.id, label: family.label });
	}
	if (present.has('other')) options.push({ id: 'other', label: 'Other' });
	return options;
}

function matchesQuery(card: LibraryCard, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (needle.length === 0) return true;
	return [
		card.title,
		card.entry.name,
		card.entry.materialLabel,
		card.entry.familyLabel,
		card.entry.subline
	].some((value) => value.toLowerCase().includes(needle));
}

function matchesFilter(entry: LibraryFinishEntry, filter: LibraryFilter): boolean {
	switch (filter) {
		case 'favourites':
			return entry.favourite;
		case 'textured':
			return entry.hasColourImage;
		case 'plain':
			return !entry.hasColourImage;
		case 'metal':
			return entry.metalness >= 0.5;
		case 'matte':
			return entry.sheen >= 0.7;
		case 'glossy':
			return entry.sheen <= 0.55;
		case 'used':
			return entry.usage > 0;
	}
}

function matchesCategory(card: LibraryCard, category: LibraryCategory): boolean {
	return category === 'all' || libraryCategoryOf(card.entry) === category;
}

/**
 * One curated entry per D1 card, showing the creator's chosen variant. The
 * choice is a view state, never authored, and an unknown choice falls back to
 * the primary.
 */
export function curatedLibraryCards(
	entries: readonly LibraryFinishEntry[],
	variantChoice: Readonly<Record<string, MaterialId | undefined>> = {}
): LibraryCard[] {
	const curated = entries
		.filter((entry) => entry.source === 'curated' && entry.curatedId !== null)
		.map((entry) => ({ ...entry, id: entry.curatedId! }));
	return foldVariantCards(curated, (primary) => variantChoice[primary]).map((folded) => {
		const { id, cardLabel, variants, ...entry } = folded;
		const primary = variantCardOf(id)?.primary ?? id;
		return {
			key: cardLabel === null ? `curated:${id}` : `card:curated:${primary}`,
			entry: entry as LibraryFinishEntry,
			title: cardLabel ?? entry.name,
			primary: cardLabel === null ? null : primary,
			variant: id,
			variants
		};
	});
}

function projectCard(entry: LibraryFinishEntry): LibraryCard {
	return {
		key: entry.key,
		entry,
		title: entry.name,
		primary: null,
		variant: null,
		variants: []
	};
}

/**
 * Filter and group the Library grid. `all` reads as one project shelf followed
 * by the curated shelf; a single source reads as one unlabelled group.
 */
export function browseLibrary(
	entries: readonly LibraryFinishEntry[],
	state: LibraryBrowseState,
	variantChoice: Readonly<Record<string, MaterialId | undefined>> = {}
): LibraryGroup[] {
	const keep = (card: LibraryCard): boolean => {
		if (!matchesCategory(card, state.category)) return false;
		if (!matchesQuery(card, state.query)) return false;
		for (const filter of state.filters) if (!matchesFilter(card.entry, filter)) return false;
		return true;
	};
	const curated = state.source === 'project'
		? []
		: curatedLibraryCards(entries, variantChoice).filter(keep);
	const project = state.source === 'curated'
		? []
		: entries
			.filter((entry) => entry.source === 'project')
			.map(projectCard)
			.filter(keep);
	if (state.source === 'curated') return [{ label: null, cards: curated }];
	if (state.source === 'project') return [{ label: null, cards: project }];
	return [
		{ label: 'This project', cards: project },
		{ label: 'Curated', cards: curated }
	].filter((group) => group.cards.length > 0);
}

/** Every card currently shown, in reading order. */
export function libraryCardsOf(groups: readonly LibraryGroup[]): LibraryCard[] {
	return groups.flatMap((group) => [...group.cards]);
}

/** A count for a source switch; D1 makes Curated 20 cards from 21 entries. */
export function librarySourceCount(
	entries: readonly LibraryFinishEntry[],
	source: LibrarySource,
	variantChoice: Readonly<Record<string, MaterialId | undefined>> = {}
): number {
	if (source === 'curated') return curatedLibraryCards(entries, variantChoice).length;
	if (source === 'project') return entries.filter((entry) => entry.source === 'project').length;
	return entries.filter((entry) => entry.source === 'project').length +
		curatedLibraryCards(entries, variantChoice).length;
}

