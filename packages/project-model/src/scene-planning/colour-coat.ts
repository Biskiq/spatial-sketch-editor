/**
 * Colour coats (T2.S8 U3, decision D3).
 *
 * A colour painted with Paint keeps what the target wears — relief, sheen and
 * tiling — and replaces only its colour. The result is a **derived Finish**:
 * the target's source Finish with its colour override set to the pick and its
 * colour image disabled. Equivalent coats share one Finish (*one coat Finish
 * per base and colour*), and a palette coat follows its slot.
 *
 * Nothing here is a new format: `color: {slot}` and `maps.color: null` are
 * existing `pbr-metallic-roughness/v1` override vocabulary.
 *
 * This module is pure. The editor and the `scene-colour-coat` planner call the
 * same `planColourCoats`, so the number of Finish ids the editor allocates and
 * the number the planner consumes cannot disagree.
 */
import type { LayoutSurfaceRef } from '@portfolio/layout-core';
import { surfaceKey } from '@portfolio/layout-core';
import type { MaterialId, SceneColor, SceneMaterialInstance } from '../scene';
import { catalogueRecipe } from '../materials/catalogue';
import { pruneOverrides } from '../materials/read';
import type { FinishBase, FinishOverrides, Recipe } from '../materials/types';
import {
	isFinishPaintable,
	isPristineInstance,
	materialInstanceById,
	nextFinishName,
	type FinishEntity,
	type FinishScene
} from './finish-model';
import { sameSceneValues } from './record-scope';

/**
 * The catalogue an unassigned Layout surface coats over: the one the Layout
 * default look and `resolveSceneSurfaceLook`'s fallback already read.
 */
export const UNASSIGNED_SURFACE_COAT_BASE = 'plaster-warm' as MaterialId;

export type CoatTarget =
	| { readonly kind: 'entity'; readonly id: string }
	| { readonly kind: 'surface'; readonly surface: LayoutSurfaceRef };

/** What a target wears now, as a coat reads it. */
export type CoatSource = {
	readonly base: FinishBase;
	readonly overrides?: FinishOverrides;
	/** The project Finish the target wears, or null for a curated/unassigned one. */
	readonly projectId: string | null;
	/** The worn Finish's display name, when it is a project Finish. */
	readonly name: string | null;
};

export type CoatRefusal = { readonly kind: 'refused'; readonly code: string; readonly message: string };

export const MODEL_OWN_COAT_REFUSAL = "A model's own materials take no colour. Paint a material first.";

/** The recipe identity of a Finish: base plus canonical overrides, never id or name. */
export type CoatRecipe = { readonly base: FinishBase; readonly overrides?: FinishOverrides };

function surfaceAssignment(scene: FinishScene, surface: LayoutSurfaceRef) {
	const key = surfaceKey(surface);
	return (scene.surfaceFinishes ?? []).find((entry) => surfaceKey(entry.surface) === key);
}

function sourceOfInstance(instance: SceneMaterialInstance): CoatSource {
	const pristine = isPristineInstance(instance);
	return {
		base: instance.base,
		...(instance.overrides === undefined ? {} : { overrides: instance.overrides }),
		projectId: pristine ? null : instance.id,
		name: pristine ? null : instance.name
	};
}

/** The source Finish a coat derives from, or why this target takes no coat. */
export function coatSourceOf(scene: FinishScene, target: CoatTarget): CoatSource | CoatRefusal {
	if (target.kind === 'surface') {
		const assignment = surfaceAssignment(scene, target.surface);
		if (assignment === undefined) {
			return { base: { catalogue: UNASSIGNED_SURFACE_COAT_BASE }, projectId: null, name: null };
		}
		const finish = assignment.finish;
		if ('materialId' in finish) return { base: { catalogue: finish.materialId }, projectId: null, name: null };
		const instance = materialInstanceById(scene.materials, finish.materialInstanceId);
		if (instance === undefined) {
			return { kind: 'refused', code: 'unknown-finish', message: 'That surface’s Finish no longer exists.' };
		}
		return sourceOfInstance(instance);
	}
	const entity = scene.entities.find((candidate) => candidate.id === target.id);
	if (entity === undefined) {
		return { kind: 'refused', code: 'unknown-entity', message: `No Scene object "${target.id}" is in the current revision.` };
	}
	if (!isFinishPaintable(entity)) {
		return {
			kind: 'refused',
			code: 'not-paintable',
			message: entity.kind === 'light' ? 'Lights have no Finish.' : 'That subject cannot be painted.'
		};
	}
	const instance = materialInstanceById(scene.materials, (entity as FinishEntity).materialInstanceId);
	if (instance !== undefined) return sourceOfInstance(instance);
	if (entity.kind === 'model') return { kind: 'refused', code: 'not-paintable', message: MODEL_OWN_COAT_REFUSAL };
	const materialId = (entity as FinishEntity).materialId;
	if (materialId === undefined) {
		return { kind: 'refused', code: 'not-paintable', message: 'That object has no Finish.' };
	}
	return { base: { catalogue: materialId }, projectId: null, name: null };
}

/** The base recipe a Finish base inherits, when it is readable. */
function baseRecipe(base: FinishBase, recipes: ReadonlyMap<string, Recipe>): Recipe | undefined {
	return 'catalogue' in base ? catalogueRecipe(base.catalogue) : recipes.get(base.material);
}

/**
 * The coat of `colour` over `source`: every override kept, the colour set, the
 * colour image disabled when the base binds one (or dropped when only the
 * override bound one). An unreadable base is treated as binding one, so the
 * coat never shows an image it cannot see.
 */
export function coatRecipe(
	source: Pick<CoatSource, 'base' | 'overrides'>,
	colour: SceneColor,
	recipes: ReadonlyMap<string, Recipe> = new Map()
): CoatRecipe {
	const overrides = JSON.parse(JSON.stringify(source.overrides ?? {})) as Record<string, unknown>;
	overrides.color = typeof colour === 'string' ? colour : { slot: colour.slot };
	const maps = { ...((overrides.maps as Record<string, unknown> | undefined) ?? {}) };
	const recipe = baseRecipe(source.base, recipes);
	if (recipe === undefined || recipe.maps.color !== undefined) maps.color = null;
	else delete maps.color;
	if (Object.keys(maps).length === 0) delete overrides.maps;
	else overrides.maps = maps;
	const pruned = pruneOverrides(overrides as FinishOverrides);
	return { base: source.base, ...(pruned === undefined ? {} : { overrides: pruned }) };
}

/** Coat identity: base and overrides, compared by value. */
export function sameCoatRecipe(left: CoatRecipe, right: CoatRecipe): boolean {
	return sameSceneValues(
		{ base: left.base, overrides: left.overrides ?? null },
		{ base: right.base, overrides: right.overrides ?? null }
	);
}

/** Whether the source binds an image a coat keeps (relief or sheen). */
export function coatKeepsRelief(source: Pick<CoatSource, 'base' | 'overrides'>, recipes: ReadonlyMap<string, Recipe> = new Map()): boolean {
	const recipe = baseRecipe(source.base, recipes);
	return (['normal', 'roughness', 'metalness', 'occlusion'] as const).some((role) => {
		const override = source.overrides?.maps?.[role];
		if (override === null) return false;
		if (override !== undefined) return true;
		return recipe?.maps[role] !== undefined;
	});
}

/** The material half of a coat's name: a catalogue label, or a resource Finish's material. */
export function coatMaterialLabel(
	source: Pick<CoatSource, 'base' | 'name'>,
	labelForMaterial: (id: MaterialId) => string
): string {
	if ('catalogue' in source.base) return labelForMaterial(source.base.catalogue as MaterialId);
	const name = source.name ?? 'Material';
	const cut = name.indexOf(' · ');
	return cut > 0 ? name.slice(0, cut) : name;
}

export function coatColourLabel(scene: Pick<FinishScene, 'palette'>, colour: SceneColor): string | null {
	if (typeof colour === 'string') return colour.toUpperCase();
	return scene.palette?.find((slot) => slot.id === colour.slot)?.name ?? null;
}

export type CoatAssignment =
	| { readonly kind: 'existing'; readonly finishId: string }
	| { readonly kind: 'create'; readonly index: number };

export type ColourCoatPlan =
	| {
			readonly kind: 'planned';
			/** Per target, in request order. */
			readonly assignments: readonly CoatAssignment[];
			/** The Finishes this coat creates, in allocation order. */
			readonly creates: readonly (CoatRecipe & { readonly name: string })[];
			/** Whether every target already wears its coat. */
			readonly already: boolean;
	  }
	| CoatRefusal;

/**
 * Plan one coat of `colour` over every target: reuse an equal project Finish
 * (document order, never a pristine one), else create one per distinct recipe.
 */
export function planColourCoats(
	scene: FinishScene,
	input: {
		readonly colour: SceneColor;
		readonly targets: readonly CoatTarget[];
		readonly materialRecipes?: ReadonlyMap<string, Recipe>;
		readonly labelForMaterial?: (id: MaterialId) => string;
	}
): ColourCoatPlan {
	const recipes = input.materialRecipes ?? new Map<string, Recipe>();
	const colourLabel = coatColourLabel(scene, input.colour);
	if (colourLabel === null) return { kind: 'refused', code: 'unknown-slot', message: 'That palette colour is gone.' };
	if (input.targets.length === 0) return { kind: 'refused', code: 'invalid-value', message: 'Paint needs at least one target.' };
	const candidates = scene.materials.filter((instance) => !isPristineInstance(instance));
	const creates: (CoatRecipe & { name: string })[] = [];
	const assignments: CoatAssignment[] = [];
	let already = true;
	for (const target of input.targets) {
		const source = coatSourceOf(scene, target);
		if ('kind' in source) return source;
		const recipe = coatRecipe(source, input.colour, recipes);
		const existing = candidates.find((instance) =>
			sameCoatRecipe({ base: instance.base, ...(instance.overrides === undefined ? {} : { overrides: instance.overrides }) }, recipe)
		);
		if (existing !== undefined) {
			assignments.push({ kind: 'existing', finishId: existing.id });
			if (source.projectId !== existing.id) already = false;
			continue;
		}
		already = false;
		const pending = creates.findIndex((entry) => sameCoatRecipe(entry, recipe));
		if (pending !== -1) {
			assignments.push({ kind: 'create', index: pending });
			continue;
		}
		const label = `${coatMaterialLabel(source, input.labelForMaterial ?? ((id) => id))} · ${colourLabel}`;
		const taken = [...scene.materials, ...creates.map((entry) => ({ name: entry.name }) as SceneMaterialInstance)];
		const name = taken.some((material) => material.name === label) ? nextFinishName(label, taken) : label;
		creates.push({ ...recipe, name });
		assignments.push({ kind: 'create', index: creates.length - 1 });
	}
	return { kind: 'planned', assignments, creates, already };
}


/**
 * Whether a Finish is a coat: it has a colour override and a coat of that same
 * colour over it is itself. The dropper then samples its colour (a palette slot
 * or a literal) rather than the Finish. Structural, never a stored flag.
 */
export function coatColourOf(
	instance: SceneMaterialInstance,
	recipes: ReadonlyMap<string, Recipe> = new Map()
): SceneColor | null {
	const colour = instance.overrides?.color;
	if (colour === undefined || isPristineInstance(instance)) return null;
	const self: CoatRecipe = { base: instance.base, ...(instance.overrides === undefined ? {} : { overrides: instance.overrides }) };
	return sameCoatRecipe(coatRecipe(self, colour, recipes), self) ? colour : null;
}
