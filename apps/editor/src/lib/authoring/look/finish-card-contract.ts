/**
 * The Finish Card contract: target/view types, reach and write-plan readings,
 * and the shared material helpers the card and its readings use.
 */
import {
	baseRecipeOf,
	editsToward,
	surfaceUserKey,
	type FinishColourMode,
	type FinishPatchEdit,
	type FinishSheenReading,
	type FinishSource,
	type FinishTreatmentFacts,
	type InspectedFinishUser,
	type SceneFinishRef,
} from '@portfolio/project-model/scene-planning';
import type {
	MaterialId,
	SceneColor,
	SceneMaterialInstance,
	ScenePaletteSlot,
	SceneSurfaceRef,
} from '@portfolio/project-model/scene';
import type { MapRole, Mapping, Recipe } from '@portfolio/project-model/materials';
import { type StageAdapterServices } from '../stage/stage-adapter-host';

export type FinishCardTarget =
	| { readonly kind: 'entity'; readonly entityId: string }
	| { readonly kind: 'surface'; readonly surface: SceneSurfaceRef };

export type FinishReachChoice = 'this' | 'all';

/** What one Card edit writes, from the reach shown before it. */
export type FinishWritePlan = {
	readonly mode: 'in-place' | 'all' | 'just-this';
	readonly selectedUsers: readonly string[];
	/** Users whose Finish the edit changes (the cobalt set plus the target). */
	readonly reached: readonly string[];
	readonly allocates: boolean;
};

export type FinishCardReach = {
	/** Every user of the Finish today, dormant surfaces included. */
	readonly users: number;
	/** The line under the meta: "On North wall · only here" or "Shared by 3". */
	readonly line: string;
	readonly shared: boolean;
	/** Null when there is nothing to choose. */
	readonly options: null | {
		readonly thisLabel: string;
		readonly allLabel: string;
		readonly allTitle: string;
	};
	readonly choice: FinishReachChoice;
	/** D5: the users of the other kind that keep a curated Finish under *All*. */
	readonly keepNote: string | null;
};

export type FinishCardColour = {
	readonly modes: readonly FinishColourMode[];
	readonly mode: FinishColourMode;
	readonly colour: SceneColor | null;
	/** The hex the colour reads as today (the slot's colour for a follower). */
	readonly hex: string | null;
	readonly caption: string;
	readonly chips: readonly {
		readonly id: string;
		readonly name: string;
		readonly color: string;
		readonly active: boolean;
	}[];
	/** A literal colour not linked to the palette. */
	readonly custom: boolean;
};

export type FinishCardPattern = {
	readonly realMeters: number;
	readonly tileMeters: number;
	/** log2(tile / real), rounded when exact; null between steps. */
	readonly step: number | null;
	readonly degrees: number;
	readonly caption: string;
	readonly canSmaller: boolean;
	readonly canLarger: boolean;
};

export type FinishCardView =
	| { readonly kind: 'none'; readonly targetKey: string; readonly message: string }
	| { readonly kind: 'model-own'; readonly targetKey: string; readonly message: string }
	| {
			readonly kind: 'finish';
			readonly targetKey: string;
			readonly finishKey: string;
			readonly ref: Exclude<SceneFinishRef, 'model-own'>;
			readonly curated: boolean;
			readonly name: string;
			readonly canRename: boolean;
			readonly renameTitle: string;
			readonly meta: string;
			/** The FinishTile source and swatch colour of the Finish itself. */
			readonly tile: {
				readonly source: { readonly kind: 'catalogue'; readonly id: MaterialId } | null;
				readonly color: string;
			};
			/** `sub` is the prototype's second line: family and source (`Wood · Curated`, `Imported`). */
			readonly material: {
				readonly label: string;
				readonly sub: string;
				readonly catalogueId: MaterialId | null;
				readonly swappable: boolean;
			};
			readonly reach: FinishCardReach;
			readonly colour: FinishCardColour;
			readonly sheen: FinishSheenReading & { readonly caption: string };
			readonly pattern: FinishCardPattern | null;
			readonly align: { readonly kind: 'wall' | 'floor'; readonly label: string } | null;
			readonly more: {
				readonly roughness: number;
				readonly roughnessMax: number;
				readonly metal: boolean;
				readonly tileMeters: number | null;
				readonly degrees: number | null;
				readonly canReplaceImage: boolean;
			};
			readonly resetCount: number;
			readonly favourite: boolean;
	  };

export type FinishCardHost = {
	readonly services: () => StageAdapterServices | null;
	readonly labelForMaterial: (id: MaterialId) => string;
	readonly facts: FinishTreatmentFacts;
	/** The curated entry's swatch colour, for the head tile's fallback. */
	readonly swatchOf?: (id: MaterialId) => string;
	readonly isFavourite?: (finishKey: string) => boolean;
	readonly toggleFavourite?: (finishKey: string) => void;
	/** More › Image › Replace for an object (S4b's From-image flow). */
	readonly replaceImage?: (
		entityId: string,
		file: File,
		mode: 'in-place' | 'all' | 'just-this',
	) => Promise<import('./finish-image.svelte').FinishImageOutcome>;
	/** Called after any accepted write (e.g. to note the Finish as recently used). */
	readonly onAccepted?: (finishKey: string) => void;
	/** Select every user of a Finish (Card ⋯ › Select all). */
	readonly selectFinishUsers?: (ref: Exclude<SceneFinishRef, 'model-own'>) => Promise<boolean>;
	/** Toast notification after "Give this surface its own copy". */
	readonly onOwnCopy?: () => void;
};

export type Inspected = {
	readonly target: FinishCardTarget;
	readonly targetKey: string;
	readonly ref: Exclude<SceneFinishRef, 'model-own'>;
	readonly finishKey: string;
	readonly instance: SceneMaterialInstance;
	readonly users: readonly InspectedFinishUser[];
	readonly palette: readonly ScenePaletteSlot[];
	readonly recipes: ReadonlyMap<string, Recipe>;
	readonly entityKind: 'primitive' | 'form' | 'model' | null;
};

export function finishCardTargetKey(target: FinishCardTarget): string {
	return target.kind === 'entity' ? `entity:${target.entityId}` : surfaceUserKey(target.surface);
}

export const userKind = (key: string): 'entity' | 'surface' =>
	key.startsWith('entity:') ? 'entity' : 'surface';

/** The word a reach line uses for one user of this kind. */
export function finishTargetWord(target: FinishCardTarget): string {
	if (target.kind === 'entity') return 'object';
	switch (target.surface.kind) {
		case 'wall-side':
			return 'side';
		case 'room-floor':
			return 'floor';
		case 'room-lid':
			return 'ceiling';
		case 'region-face':
			return 'surface';
	}
}

/**
 * The reach → patch mapping. Pure, so the Card, the cobalt
 * outlines and the tests read one rule.
 */
export function finishWritePlan(
	input: {
		readonly curated: boolean;
		readonly users: readonly string[];
		readonly targetKey: string;
	},
	choice: FinishReachChoice,
): FinishWritePlan {
	const { curated, users, targetKey } = input;
	if (users.length <= 1) {
		return curated
			? { mode: 'all', selectedUsers: users, reached: users, allocates: true }
			: { mode: 'in-place', selectedUsers: users, reached: users, allocates: false };
	}
	if (choice === 'this') {
		return { mode: 'just-this', selectedUsers: [targetKey], reached: [targetKey], allocates: true };
	}
	if (!curated) return { mode: 'all', selectedUsers: users, reached: users, allocates: false };
	// D5: a curated Finish materializes for the target's own kind only.
	const sameKind = users.filter((key) => userKind(key) === userKind(targetKey));
	return sameKind.length === users.length
		? { mode: 'all', selectedUsers: users, reached: users, allocates: true }
		: { mode: 'just-this', selectedUsers: sameKind, reached: sameKind, allocates: true };
}

/** The default reach: *This* for a curated Finish, *All* for a shared project Finish. */
export function defaultReach(curated: boolean): FinishReachChoice {
	return curated ? 'this' : 'all';
}

export const plural = (count: number, one: string, many = `${one}s`) =>
	`${count} ${count === 1 ? one : many}`;

export function formatMeters(value: number): string {
	if (value >= 1) return `${Number(value.toFixed(2))} m`;
	return `${Number(value.toFixed(3))} m`;
}

export const RATIO: Readonly<Record<string, string>> = {
	'-3': '⅛',
	'-2': '¼',
	'-1': '½',
	'1': '2',
	'2': '4',
	'3': '8',
};

export function mappingOf(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
): Mapping | undefined {
	if (source.overrides?.mapping !== undefined) return source.overrides.mapping;
	const recipe =
		'catalogue' in source.base
			? baseRecipeOf({ id: '', name: '', base: source.base }, recipes)
			: recipes.get(source.base.material);
	return recipe?.mapping;
}

export function recipeOfSource(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
): Recipe | undefined {
	return baseRecipeOf({ id: '', name: '', base: source.base }, recipes);
}

/** A scalar role's channel when neither the override nor the base names one (glTF ORM packing). */
export const DEFAULT_SCALAR_COMPONENT: Readonly<
	Record<'roughness' | 'metalness' | 'occlusion', 'r' | 'g' | 'b'>
> = {
	occlusion: 'r',
	roughness: 'g',
	metalness: 'b',
};

/** A project image imported by the S4 flow, as a replacement binding needs it. */
export type FinishRoleImage = {
	readonly assetId: string;
	readonly sha256: string;
	readonly mime: string;
	readonly byteSize: number;
	readonly name: string;
};

/**
 * The binding that swaps one role's image and keeps everything else the role
 * already says (its own mapping, normal convention, scalar channel and invert),
 * from the override when there is one and the base otherwise.
 */
export function roleImageBinding(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	role: MapRole,
	textureId: string,
): Record<string, unknown> {
	const override = source.overrides?.maps?.[role];
	const current = (override ?? recipeOfSource(source, recipes)?.maps?.[role] ?? null) as {
		readonly mapping?: Mapping;
		readonly convention?: '+Y' | '-Y';
		readonly component?: 'r' | 'g' | 'b' | 'a';
		readonly invert?: boolean;
	} | null;
	const image = { textureId };
	const mapping = current?.mapping === undefined ? {} : { mapping: current.mapping };
	if (role === 'color') return { image, ...mapping };
	if (role === 'normal') return { image, convention: current?.convention ?? '+Y', ...mapping };
	return {
		image,
		component: current?.component ?? DEFAULT_SCALAR_COMPONENT[role],
		invert: current?.invert ?? false,
		...mapping,
	};
}

/** The edits that set a mapping, resetting it when it equals the base's own. */
export function mappingEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	next: Mapping,
): FinishPatchEdit[] {
	const base = recipeOfSource(source, recipes)?.mapping;
	const overrides = { ...(source.overrides ?? {}) } as Record<string, unknown>;
	if (base !== undefined && JSON.stringify(base) === JSON.stringify(next)) delete overrides.mapping;
	else overrides.mapping = next;
	return editsToward(source.overrides, overrides);
}

export function factorEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	field: 'roughness' | 'metalness',
	value: number,
): FinishPatchEdit[] {
	const base = recipeOfSource(source, recipes)?.[field];
	const overrides = { ...(source.overrides ?? {}) } as Record<string, unknown>;
	const rounded = Math.round(value * 1000) / 1000;
	if (base !== undefined && Math.abs(base - rounded) < 0.0005) delete overrides[field];
	else overrides[field] = rounded;
	return editsToward(source.overrides, overrides);
}

/** The Stage subject that owns a surface: its Wall, Room or Region. */
export function subjectKeyOfSurface(surface: SceneSurfaceRef): string {
	return surface.kind === 'wall-side'
		? `wall:${surface.wallId}`
		: surface.kind === 'region-face'
			? `region:${surface.regionId}`
			: `room:${surface.roomId}`;
}
