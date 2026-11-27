/**
 * My library entries for the shared Library browse model.
 *
 * A saved item carries only the portable recipe and its name (G's format 1).
 * Its base material identity, family and project provenance are deliberately
 * not part of the payload, so the card says "Saved Finish" rather than inventing
 * facts the saved copy does not carry.
 */
import { finishSheenReading } from '@portfolio/project-model/scene-planning';
import type {
	MaterialLibraryItemSummary,
	MaterialLibraryPayload,
} from '@portfolio/project-model/library';
import { libraryTileLabel, type LibraryFinishEntry } from './library-catalogue';

export type PrivateLibraryItem = {
	readonly summary: MaterialLibraryItemSummary;
	readonly payload?: MaterialLibraryPayload;
	/** Palette slots whose literal this save captured. */
	readonly flattened?: readonly string[];
};

export function privateLibraryEntry(
	item: PrivateLibraryItem,
	imageUri: string | null,
): LibraryFinishEntry {
	const recipe = item.payload?.recipe;
	const mapping = recipe?.mapping;
	const reading = finishSheenReading(
		{ base: { material: item.summary.recipeHash } },
		recipe === undefined ? new Map() : new Map([[item.summary.recipeHash, recipe]]),
	);
	const imageCount = item.summary.imageCount;
	return {
		key: `mine:${item.summary.id}`,
		source: 'mine',
		ref: null,
		name: item.summary.name,
		materialLabel: 'Saved Finish',
		family: null,
		familyLabel: 'Other',
		subline: `Saved Finish · ${imageCount} image${imageCount === 1 ? '' : 's'}`,
		tileSize: mapping && mapping.kind !== 'uv' ? libraryTileLabel(mapping.metric.tileMeters) : null,
		color: recipe?.color ?? '#999999',
		imageUri,
		curatedId: null,
		projectId: null,
		favourite: false,
		usage: 0,
		userKeys: [],
		changes: 0,
		reading,
		sheen: recipe?.roughness ?? reading.effective,
		metalness: recipe?.metalness ?? 0,
		hasColourImage: recipe?.maps.color !== undefined,
		warning: null,
		libraryItem: {
			id: item.summary.id,
			savedAt: item.summary.createdAt.slice(0, 10),
			savedFrom: '',
			flattened: item.flattened ?? [],
			imageCount,
		},
	};
}
