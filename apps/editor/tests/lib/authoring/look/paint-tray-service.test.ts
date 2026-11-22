import { describe, expect, it, vi } from 'vitest';
import { materials } from '$lib/content/materials';
import { createFinishAuthoring } from '$lib/authoring/look/finish-authoring.svelte';
import type { PaintColourPort } from '$lib/authoring/look/finish-authoring.svelte';
import { createMemoryPaintPreferences } from '$lib/authoring/look/paint-preferences';

const FIRST = `curated:${materials[0]!.id}`;
const SECOND = `curated:${materials[1]!.id}`;

function service(options: { armed?: boolean; colourCoat?: PaintColourPort } = {}) {
	const notices: string[] = [];
	const store = createMemoryPaintPreferences();
	const finishes = createFinishAuthoring({
		services: () => null,
		onNotice: (message) => notices.push(message),
		openFinishes: () => undefined,
		armPaint: () => undefined,
		isPaintArmed: () => options.armed ?? true,
		preferences: store,
		...(options.colourCoat === undefined ? {} : { colourCoat: options.colourCoat })
	});
	return { finishes, notices, store };
}

describe('T2.S8 U2 — Paint tray service', () => {
	it('arms a material without writing and without touching recents', () => {
		const { finishes, store } = service();
		expect(finishes.paintTray().active).toBeNull();
		finishes.pickMaterialKey(FIRST);
		expect(finishes.paintTray().active).toMatchObject({ kind: 'finish', key: FIRST });
		expect(finishes.hasActive()).toBe(true);
		// Arming is not using: recents join only when a stroke writes.
		expect(finishes.paintTray().materials.row).toEqual([]);
		expect(store.saved().recentMaterials).toEqual([]);
	});

	it('offers one tab until a colour-coat port exists, and ignores colour picks without it', () => {
		const { finishes } = service();
		expect(finishes.paintTray().colourEnabled).toBe(false);
		finishes.pickColour({ kind: 'literal', hex: '#336699' });
		expect(finishes.paintTray().active).toBeNull();
		expect(finishes.hasActive()).toBe(false);
	});

	it('arms a literal colour through the seam and replaces the material pick', () => {
		const colourCoat: PaintColourPort = {
			paintEntities: vi.fn(async () => true),
			paintSurfaces: vi.fn(async () => true)
		};
		const { finishes } = service({ colourCoat });
		finishes.pickMaterialKey(FIRST);
		finishes.pickColour({ kind: 'literal', hex: '#336699' });
		expect(finishes.paintTray().colourEnabled).toBe(true);
		expect(finishes.paintTray().active).toMatchObject({ kind: 'colour', key: '#336699', color: '#336699' });
		finishes.pickMaterialKey(SECOND);
		expect(finishes.paintTray().active).toMatchObject({ kind: 'finish', key: SECOND });
		expect(colourCoat.paintEntities).not.toHaveBeenCalled();
	});

	it('stars and unstars the active pick, and keeps it as a preference', () => {
		const { finishes, store } = service();
		finishes.pickMaterialKey(FIRST);
		finishes.toggleActiveFavourite();
		expect(store.saved().favouriteMaterials).toEqual([FIRST]);
		expect(finishes.paintTray().materials.row).toEqual([expect.objectContaining({ key: FIRST, favourite: true })]);
		finishes.toggleActiveFavourite();
		expect(store.saved().favouriteMaterials).toEqual([]);
	});

	it('refuses a Finish that is not in this project', () => {
		const { finishes, notices } = service();
		finishes.pickMaterialKey('project:missing');
		expect(notices).toEqual(['That Finish is not in this project.']);
		expect(finishes.paintTray().active).toBeNull();
	});

	it('loads saved favourites on creation', () => {
		const store = createMemoryPaintPreferences({
			favouriteColours: [],
			recentColours: [],
			favouriteMaterials: [SECOND, 'project:gone'],
			recentMaterials: []
		});
		const finishes = createFinishAuthoring({
			services: () => null,
			onNotice: () => undefined,
			openFinishes: () => undefined,
			armPaint: () => undefined,
			preferences: store
		});
		// The unresolved project Finish is left out, never shown broken.
		expect(finishes.paintTray().materials.row.map((entry) => entry.key)).toEqual([SECOND]);
	});
});
