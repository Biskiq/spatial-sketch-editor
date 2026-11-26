/**
 * T2.S8 U7 — My library card facts.
 *
 * The G payload carries the portable recipe and name only; a card must not
 * invent a base material, family or project provenance it does not have.
 */
import { describe, expect, it } from 'vitest';
import type {
	MaterialLibraryItemSummary,
	MaterialLibraryPayload,
} from '@portfolio/project-model/library';
import { privateLibraryEntry } from '$lib/authoring/library/private-library-entries';

const summary: MaterialLibraryItemSummary = {
	id: 'item-1',
	name: 'Lobby oak',
	kind: 'material',
	formatVersion: 1,
	contentId: 'sha256-content',
	createdAt: '2026-11-24T10:20:30.000Z',
	recipeHash: 'sha256-recipe',
	imageCount: 3,
	hasThumbnail: true,
};

const payload: MaterialLibraryPayload = {
	formatVersion: 1,
	kind: 'material',
	name: 'Lobby oak',
	recipe: {
		profile: 'pbr-metallic-roughness/v1',
		color: '#8a6a4a',
		roughness: 0.42,
		metalness: 0.1,
		occlusionStrength: 1,
		normalScale: 1,
		mapping: { kind: 'target', metric: { tileMeters: [1, 1], rotation: 0, offset: [0, 0] } },
		maps: {},
	},
};

describe('T2.S8 U7 — My library entries', () => {
	it('reads saved facts from the payload and keeps the item identity', () => {
		const entry = privateLibraryEntry({ summary, payload, flattened: ['Sage'] }, 'blob:thumb');
		expect(entry).toMatchObject({
			key: 'mine:item-1',
			source: 'mine',
			ref: null,
			name: 'Lobby oak',
			materialLabel: 'Saved Finish',
			family: null,
			familyLabel: 'Other',
			color: '#8a6a4a',
			imageUri: 'blob:thumb',
			usage: 0,
			changes: 0,
			sheen: 0.42,
			metalness: 0.1,
			hasColourImage: false,
			libraryItem: {
				id: 'item-1',
				savedAt: '2026-11-24',
				flattened: ['Sage'],
				imageCount: 3,
			},
		});
	});

	it('falls back to a swatch and no recipe where the payload could not be read', () => {
		const entry = privateLibraryEntry({ summary: { ...summary, hasThumbnail: false } }, null);
		expect(entry.imageUri).toBeNull();
		expect(entry.color).toBe('#999999');
		expect(entry.hasColourImage).toBe(false);
		expect(entry.libraryItem?.imageCount).toBe(3);
	});
});
