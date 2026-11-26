/**
 * What Paint holds and how its quick lists behave.
 *
 * Pure vocabulary, no Svelte and no Scene: the tray, the Finish service and the
 * preference store share these words. A **pick** is what the next stroke
 * applies: a material Finish (rounded square, replaces the whole Finish) or a
 * colour (circle, keeps relief and sheen, written by the colour-coat planner
 * that comes through `PaintColourPort`).
 *
 * Favourites and recents are references, never copies: a Finish key
 * (`curated:<id>` / `project:<id>`), a palette slot (`slot:<id>`) or a literal
 * colour (`#rrggbb`).
 */

import type { MaterialId } from '$lib/types/materials';
import type { FinishPatchEdit, SceneFinishRef } from '@portfolio/project-model/scene-planning';

/** The creator preference lists are 12 recents and 24 favourites per kind. */
export const PAINT_RECENTS_LIMIT = 12;
export const PAINT_FAVOURITES_LIMIT = 24;
/** Recents the always-visible row shows; the rest stay one chevron away. */
export const PAINT_ROW_RECENTS = 6;

export type PaintColour =
	| { readonly kind: 'slot'; readonly slotId: string }
	| { readonly kind: 'literal'; readonly hex: string };

export type PaintDraftPick = {
	readonly kind: 'draft';
	readonly ref: Exclude<SceneFinishRef, 'model-own'>;
	readonly edits: readonly FinishPatchEdit[];
	readonly name: string;
};

export type PaintPick =
	| { readonly kind: 'finish'; readonly key: string }
	| { readonly kind: 'colour'; readonly colour: PaintColour }
	| PaintDraftPick;

/** Paint's reach. A future freeform Brush joins this table; nothing else names it. */
export const PAINT_RADII = [
	{
		id: 'surface',
		label: 'Surface',
		hint: 'One surface per click, or every surface the stroke crosses',
	},
	{
		id: 'space',
		label: 'Space',
		hint: 'Every wall surface in the room, or every part of an object',
	},
] as const;

export type PaintRadius = (typeof PAINT_RADII)[number]['id'];

const HEX = /^#[0-9a-f]{6}$/;

export function normaliseHex(value: string): string | null {
	const text = value.trim().toLowerCase();
	const full = /^#[0-9a-f]{3}$/.test(text)
		? `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`
		: text;
	return HEX.test(full) ? full : null;
}

/** The stored reference for one colour. */
export function colourKey(colour: PaintColour): string {
	return colour.kind === 'slot' ? `slot:${colour.slotId}` : colour.hex.toLowerCase();
}

export function parseColourKey(key: string): PaintColour | null {
	if (key.startsWith('slot:') && key.length > 5) return { kind: 'slot', slotId: key.slice(5) };
	const hex = normaliseHex(key);
	return hex === null ? null : { kind: 'literal', hex };
}

export function pickKey(pick: PaintPick): string {
	if (pick.kind === 'finish') return pick.key;
	if (pick.kind === 'colour') return colourKey(pick.colour);
	const base =
		'curated' in pick.ref ? `curated:${pick.ref.curated}` : `project:${pick.ref.project}`;
	return `draft:${base}:${JSON.stringify(pick.edits)}`;
}

export function samePick(a: PaintPick | null, b: PaintPick | null): boolean {
	if (a === null || b === null) return a === b;
	return a.kind === b.kind && pickKey(a) === pickKey(b);
}

/** Most recent first, no duplicates, bounded. */
export function touchRecent(
	list: readonly string[],
	key: string,
	limit: number = PAINT_RECENTS_LIMIT,
): readonly string[] {
	return [key, ...list.filter((entry) => entry !== key)].slice(0, limit);
}

/** Add to the front of the favourites, or remove when already kept. */
export function toggleFavourite(
	list: readonly string[],
	key: string,
	limit: number = PAINT_FAVOURITES_LIMIT,
): readonly string[] {
	return list.includes(key)
		? list.filter((entry) => entry !== key)
		: [...list, key].slice(0, limit);
}

export type PaintRowEntry = { readonly key: string; readonly favourite: boolean };

/**
 * The always-visible row: favourites first, then the recents that are not
 * already favourites. Entries that no longer resolve (a project Finish from
 * another project, a removed palette slot) are left out, never shown broken.
 */
export function paintRow(
	favourites: readonly string[],
	recents: readonly string[],
	resolves: (key: string) => boolean,
	maxRecents: number = PAINT_ROW_RECENTS,
): readonly PaintRowEntry[] {
	const kept = favourites.filter(resolves);
	const fresh = recents.filter((key) => resolves(key) && !kept.includes(key)).slice(0, maxRecents);
	return [
		...kept.map((key) => ({ key, favourite: true })),
		...fresh.map((key) => ({ key, favourite: false })),
	];
}

/** HSL in degrees / percent, for the custom colour wheel. */
export type Hsl = { readonly h: number; readonly s: number; readonly l: number };

export function hslToHex({ h, s, l }: Hsl): string {
	const sat = Math.min(100, Math.max(0, s)) / 100;
	const light = Math.min(100, Math.max(0, l)) / 100;
	const hue = ((h % 360) + 360) % 360;
	const chroma = (1 - Math.abs(2 * light - 1)) * sat;
	const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = light - chroma / 2;
	const [r, g, b] =
		hue < 60
			? [chroma, x, 0]
			: hue < 120
				? [x, chroma, 0]
				: hue < 180
					? [0, chroma, x]
					: hue < 240
						? [0, x, chroma]
						: hue < 300
							? [x, 0, chroma]
							: [chroma, 0, x];
	const byte = (value: number) =>
		Math.round((value + m) * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${byte(r)}${byte(g)}${byte(b)}`;
}

export function hexToHsl(hex: string): Hsl {
	const text = normaliseHex(hex) ?? '#808080';
	const r = parseInt(text.slice(1, 3), 16) / 255;
	const g = parseInt(text.slice(3, 5), 16) / 255;
	const b = parseInt(text.slice(5, 7), 16) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) return { h: 0, s: 0, l: l * 100 };
	const s = d / (1 - Math.abs(2 * l - 1));
	const h =
		max === r
			? ((g - b) / d + (g < b ? 6 : 0)) * 60
			: max === g
				? ((b - r) / d + 2) * 60
				: ((r - g) / d + 4) * 60;
	return { h, s: s * 100, l: l * 100 };
}

/**
 * The picture source of a stored Finish key: a curated key is its catalogue
 * master, a project key goes through the page's project source (its Scene and
 * texture scope), anything else (a colour, the model's own look) has none.
 */
export function paintTileSource<S>(
	key: string,
	project: (finishId: string) => S | null,
): { readonly kind: 'catalogue'; readonly id: MaterialId } | S | null {
	if (key.startsWith('curated:'))
		return { kind: 'catalogue', id: key.slice('curated:'.length) as MaterialId };
	if (key.startsWith('project:')) return project(key.slice('project:'.length));
	return null;
}
