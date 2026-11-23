/**
 * The Finish Card's treatment vocabulary (T2.S8 U4; decisions D6, D8).
 *
 * A Finish is a Material plus a treatment. The Card edits that treatment in
 * the creator's words — a colour mode, a sheen step, a pattern size — and every
 * word here is a pure reading of, or a typed patch toward, the existing
 * `pbr-metallic-roughness/v1` override vocabulary. Nothing is persisted that a
 * Finish did not already store.
 *
 * - **Colour modes.** Natural (no colour), Stained (a colour over the kept
 *   colour image) and Painted (a colour with the colour image disabled — a U3
 *   coat). A base without a colour image offers Natural and Painted.
 * - **Sheen (D6).** Three targets on effective roughness, `factor × scanned
 *   mean` of the base's roughness image. A value within 0.05 of a target reads
 *   as that step, anything else as Custom; a step rougher than the capture
 *   (factor above 1) is disabled.
 * - **Swap.** A base change that carries the treatment: colour mode (Stained
 *   becomes Painted on a plain base), a changed sheen at its effective value, a
 *   changed metalness and the pattern direction. Everything tied to the old
 *   images is dropped, and the pattern returns to the new material's real size.
 * - **Names.** `<material> · <colour>[ stain][ · <step | Custom sheen>]`,
 *   regenerated only while the stored name still equals the generated one.
 *
 * Runtime-safe and catalogue-agnostic: presentation facts (labels, families,
 * scanned means, per-family targets) arrive through `FinishTreatmentFacts`.
 */
import type { MaterialId, SceneColor, SceneMaterialInstance, ScenePaletteSlot } from '../scene';
import { catalogueRecipe } from '../materials/catalogue';
import { pruneOverrides } from '../materials/read';
import {
	MATERIAL_MAP_ROLES,
	type FinishBase,
	type FinishOverrides,
	type Mapping,
	type Recipe
} from '../materials/types';
import type { FinishPatchEdit, FinishPatchFactorField } from './finish-patch';
import { nextFinishName } from './finish-model';

// ------------------------------------------------------------------ facts

export type SheenStepId = 'matte' | 'satin' | 'gloss';
export type SheenTargets = Readonly<Record<SheenStepId, number>>;

/** D6: the default targets on effective roughness. */
export const DEFAULT_SHEEN_TARGETS: SheenTargets = { matte: 0.8, satin: 0.5, gloss: 0.2 };
/** A value within this distance of a target reads as that step. */
export const SHEEN_STEP_TOLERANCE = 0.05;
export const SHEEN_STEP_LABELS: Readonly<Record<SheenStepId, string>> = {
	matte: 'Matte',
	satin: 'Satin',
	gloss: 'Gloss'
};
const SHEEN_STEP_ORDER: readonly SheenStepId[] = ['matte', 'satin', 'gloss'];

/** Presentation facts the treatment words read; every member is optional. */
export type FinishTreatmentFacts = {
	/** A catalogue entry's display label. */
	readonly labelForMaterial?: (id: MaterialId) => string;
	/** Whether colour on this catalogue entry reads as a stain by default (wood, stone, …). */
	readonly stainsByDefault?: (id: MaterialId) => boolean;
	/** The scanned mean of a catalogue entry's roughness image, when characterized. */
	readonly roughnessMeanOf?: (id: MaterialId) => number | undefined;
	/** The sheen targets of a catalogue entry's family. */
	readonly sheenTargetsOf?: (id: MaterialId) => SheenTargets;
};

export type FinishSource = {
	readonly base: FinishBase;
	readonly overrides?: FinishOverrides;
};

function recipeOf(base: FinishBase, recipes: ReadonlyMap<string, Recipe>): Recipe | undefined {
	return 'catalogue' in base ? catalogueRecipe(base.catalogue) : recipes.get(base.material);
}

const roundFactor = (value: number): number => Math.round(value * 1000) / 1000;

// ------------------------------------------------------------------ colour

export type FinishColourMode = 'natural' | 'stained' | 'painted';

/** Whether a Stained mode exists: the Finish can show a colour image when its colour is not disabled. */
export function finishHasColourImage(source: FinishSource, recipes: ReadonlyMap<string, Recipe> = new Map()): boolean {
	const override = source.overrides?.maps?.color;
	if (override !== undefined && override !== null) return true;
	const recipe = recipeOf(source.base, recipes);
	// An unreadable base is treated as binding one, as the coat recipe does.
	return recipe === undefined || recipe.maps.color !== undefined;
}

export function finishColourMode(source: FinishSource, recipes: ReadonlyMap<string, Recipe> = new Map()): FinishColourMode {
	const colour = source.overrides?.color;
	if (colour === undefined) return 'natural';
	if (source.overrides?.maps?.color === null) return 'painted';
	return finishHasColourImage(source, recipes) ? 'stained' : 'painted';
}

/** The mode a first colour takes on a Natural Finish. */
export function defaultColourMode(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe> = new Map(),
	facts: FinishTreatmentFacts = {}
): Exclude<FinishColourMode, 'natural'> {
	if (!finishHasColourImage(source, recipes)) return 'painted';
	if (!('catalogue' in source.base)) return 'stained';
	return facts.stainsByDefault?.(source.base.catalogue as MaterialId) ? 'stained' : 'painted';
}

/** The overrides a colour mode leaves, from the current ones. */
function colourModeOverrides(
	source: FinishSource,
	mode: FinishColourMode,
	colour: SceneColor | null,
	recipes: ReadonlyMap<string, Recipe>
): FinishOverrides | undefined {
	const overrides = JSON.parse(JSON.stringify(source.overrides ?? {})) as Record<string, unknown>;
	const maps = { ...((overrides.maps as Record<string, unknown> | undefined) ?? {}) };
	const recipe = recipeOf(source.base, recipes);
	const baseBindsImage = recipe === undefined || recipe.maps.color !== undefined;
	if (mode === 'natural') {
		delete overrides.color;
		if (maps.color === null) delete maps.color;
	} else {
		if (colour === null) throw new Error('A colour mode other than Natural needs a colour.');
		overrides.color = typeof colour === 'string' ? colour.toLowerCase() : { slot: colour.slot };
		if (mode === 'stained') {
			if (maps.color === null) delete maps.color;
		} else if (baseBindsImage) {
			maps.color = null;
		} else {
			// The coat rule: an override image is dropped on a plain base.
			delete maps.color;
		}
	}
	if (Object.keys(maps).length === 0) delete overrides.maps;
	else overrides.maps = maps;
	return pruneOverrides(overrides as FinishOverrides);
}

/**
 * The patch for a colour mode and colour. Painted equals the U3 coat of that
 * colour; Stained keeps the colour image; Natural removes the colour and
 * restores a disabled base image. A mode a Finish cannot take (Stained without
 * an image) reads as Painted.
 */
export function colourModeEdits(
	source: FinishSource,
	mode: FinishColourMode,
	colour: SceneColor | null,
	recipes: ReadonlyMap<string, Recipe> = new Map()
): FinishPatchEdit[] {
	const effective = mode === 'stained' && !finishHasColourImage(source, recipes) ? 'painted' : mode;
	return editsToward(source.overrides, colourModeOverrides(source, effective, colour, recipes));
}

// ------------------------------------------------------------------ sheen

export type FinishSheenScan = {
	/** The mean the factor scales; 1 when no roughness image is bound. */
	readonly mean: number;
	/** True when the bound roughness image is not characterized (steps act on the factor). */
	readonly approximate: boolean;
};

/** The scanned mean of the roughness image a Finish samples. */
export function finishSheenScan(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe> = new Map(),
	facts: FinishTreatmentFacts = {}
): FinishSheenScan {
	const override = source.overrides?.maps?.roughness;
	if (override === null) return { mean: 1, approximate: false };
	if (override !== undefined) return { mean: 1, approximate: true };
	const recipe = recipeOf(source.base, recipes);
	if (recipe !== undefined && recipe.maps.roughness === undefined) return { mean: 1, approximate: false };
	const mean = 'catalogue' in source.base ? facts.roughnessMeanOf?.(source.base.catalogue as MaterialId) : undefined;
	return mean === undefined || !(mean > 0) ? { mean: 1, approximate: true } : { mean, approximate: false };
}

export function finishSheenTargets(source: FinishSource, facts: FinishTreatmentFacts = {}): SheenTargets {
	return 'catalogue' in source.base
		? (facts.sheenTargetsOf?.(source.base.catalogue as MaterialId) ?? DEFAULT_SHEEN_TARGETS)
		: DEFAULT_SHEEN_TARGETS;
}

export type FinishSheenStep = {
	readonly id: SheenStepId;
	readonly label: string;
	readonly target: number;
	/** The factor that reaches the target on this scan. */
	readonly factor: number;
	/** Rougher than the capture: the factor would exceed 1. */
	readonly disabled: boolean;
};

export type FinishSheenReading = {
	readonly steps: readonly FinishSheenStep[];
	/** The step the effective value reads as, or null for Custom. */
	readonly current: SheenStepId | null;
	/** The reachable step nearest the base's own value (the dot), or null when none is reachable. */
	readonly original: SheenStepId | null;
	/** Whether the base's own value already reads as `original`. */
	readonly originalExact: boolean;
	readonly effective: number;
	readonly scan: FinishSheenScan;
	/** Whether the Finish authors its roughness. */
	readonly changed: boolean;
};

function nearestStep(value: number, steps: readonly FinishSheenStep[]): FinishSheenStep | null {
	let best: FinishSheenStep | null = null;
	for (const step of steps) {
		if (step.disabled) continue;
		if (best === null || Math.abs(step.target - value) < Math.abs(best.target - value)) best = step;
	}
	return best;
}

function stepAt(value: number, steps: readonly FinishSheenStep[]): FinishSheenStep | null {
	return steps.find((step) => Math.abs(step.target - value) <= SHEEN_STEP_TOLERANCE + 1e-9) ?? null;
}

/** D6: the three steps over effective roughness for one Finish. */
export function finishSheenReading(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe> = new Map(),
	facts: FinishTreatmentFacts = {}
): FinishSheenReading {
	const recipe = recipeOf(source.base, recipes);
	const baseFactor = recipe?.roughness ?? 1;
	const factor = source.overrides?.roughness ?? baseFactor;
	const scan = finishSheenScan(source, recipes, facts);
	const targets = finishSheenTargets(source, facts);
	const steps: FinishSheenStep[] = SHEEN_STEP_ORDER.map((id) => {
		const exact = targets[id] / scan.mean;
		return {
			id,
			label: SHEEN_STEP_LABELS[id],
			target: targets[id],
			factor: roundFactor(Math.min(1, exact)),
			disabled: exact > 1 + 1e-6
		};
	});
	const effective = factor * scan.mean;
	const baseEffective = baseFactor * scan.mean;
	const original = nearestStep(baseEffective, steps);
	return {
		steps,
		current: stepAt(effective, steps)?.id ?? null,
		original: original?.id ?? null,
		originalExact: original !== null && Math.abs(original.target - baseEffective) <= SHEEN_STEP_TOLERANCE + 1e-9,
		effective,
		scan,
		changed: source.overrides?.roughness !== undefined
	};
}

/** The patch a sheen step writes: the step's factor, or a reset when the base already reads as it. */
export function sheenStepEdits(reading: FinishSheenReading, id: SheenStepId): FinishPatchEdit[] {
	const step = reading.steps.find((candidate) => candidate.id === id);
	if (step === undefined || step.disabled) return [];
	if (id === reading.original && reading.originalExact) {
		return reading.changed ? [{ field: 'roughness', op: 'reset' }] : [];
	}
	return [{ field: 'roughness', op: 'set', value: step.factor }];
}

// ------------------------------------------------------------------ pattern

/** The real size a Finish's base tiles at, when its set mapping is metric. */
export function baseTileMeters(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe> = new Map()
): readonly [number, number] | null {
	const mapping = recipeOf(source.base, recipes)?.mapping;
	return mapping !== undefined && mapping.kind !== 'uv' ? mapping.metric.tileMeters : null;
}

// ------------------------------------------------------------------ swap

/**
 * The overrides a Finish keeps when its material changes to `nextBase`.
 * Returns the full next overrides (the caller diffs them into a patch).
 */
export function swapOverrides(
	source: FinishSource,
	nextBase: FinishBase,
	recipes: ReadonlyMap<string, Recipe> = new Map(),
	facts: FinishTreatmentFacts = {}
): FinishOverrides | undefined {
	const current = source.overrides ?? {};
	const nextRecipe = recipeOf(nextBase, recipes);
	const next: Record<string, unknown> = {};
	const mode = finishColourMode(source, recipes);
	if (mode !== 'natural' && current.color !== undefined) {
		const target: FinishSource = { base: nextBase };
		const nextMode = mode === 'stained' && finishHasColourImage(target, recipes) ? 'stained' : 'painted';
		Object.assign(next, colourModeOverrides(target, nextMode, current.color, recipes) ?? {});
	}
	if (current.roughness !== undefined) {
		const effective = current.roughness * finishSheenScan(source, recipes, facts).mean;
		const factor = roundFactor(Math.min(1, effective / finishSheenScan({ base: nextBase }, recipes, facts).mean));
		if (factor !== nextRecipe?.roughness) next.roughness = factor;
	}
	if (current.metalness !== undefined && current.metalness !== nextRecipe?.metalness) next.metalness = current.metalness;
	const mapping = current.mapping;
	if (mapping !== undefined) {
		if (mapping.kind === 'uv') {
			next.mapping = mapping;
		} else if (mapping.metric.rotation !== 0) {
			const real = baseTileMeters({ base: nextBase }, recipes) ?? mapping.metric.tileMeters;
			next.mapping = {
				kind: mapping.kind,
				metric: { tileMeters: [real[0], real[1]], rotation: mapping.metric.rotation, offset: [0, 0] }
			} satisfies Mapping;
		}
	}
	return pruneOverrides(next as FinishOverrides);
}

/** The typed patch toward the swap's overrides; the caller sends `base` alongside it. */
export function swapEdits(
	source: FinishSource,
	nextBase: FinishBase,
	recipes: ReadonlyMap<string, Recipe> = new Map(),
	facts: FinishTreatmentFacts = {}
): FinishPatchEdit[] {
	return editsToward(source.overrides, swapOverrides(source, nextBase, recipes, facts));
}

// ------------------------------------------------------------------ diff

const FACTOR_FIELDS: readonly FinishPatchFactorField[] = [
	'color',
	'roughness',
	'metalness',
	'occlusionStrength',
	'normalScale',
	'mapping'
];

const same = (left: unknown, right: unknown): boolean => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
/** A map override is absent, disabled (`null`) or a binding: three distinct states. */
const mapKey = (value: unknown): string => (value === undefined ? 'absent' : JSON.stringify(value));

/**
 * The typed edits that turn `current` into `next`: `set` for a new value,
 * `reset` for a removed one, `disable` for a map turned off. Fields that do not
 * change are omitted; an empty list means no change.
 */
export function editsToward(current: FinishOverrides | undefined, next: FinishOverrides | undefined): FinishPatchEdit[] {
	const from = (current ?? {}) as Record<string, unknown>;
	const to = (next ?? {}) as Record<string, unknown>;
	const edits: FinishPatchEdit[] = [];
	for (const field of FACTOR_FIELDS) {
		if (same(from[field], to[field])) continue;
		edits.push(to[field] === undefined ? { field, op: 'reset' } : { field, op: 'set', value: to[field] });
	}
	const fromMaps = (current?.maps ?? {}) as Record<string, unknown>;
	const toMaps = (next?.maps ?? {}) as Record<string, unknown>;
	for (const role of MATERIAL_MAP_ROLES) {
		if (mapKey(fromMaps[role]) === mapKey(toMaps[role])) continue;
		const field = `maps.${role}` as const;
		if (toMaps[role] === undefined) edits.push({ field, op: 'reset' });
		else if (toMaps[role] === null) edits.push({ field, op: 'disable' });
		else edits.push({ field, op: 'set', value: toMaps[role] });
	}
	return edits;
}

// ------------------------------------------------------------------ names

/** The material half of a name: a catalogue label, or a resource Finish's name up to its first ` · `. */
export function finishMaterialLabel(
	source: { readonly base: FinishBase; readonly name?: string | null },
	labelForMaterial: (id: MaterialId) => string
): string {
	if ('catalogue' in source.base) return labelForMaterial(source.base.catalogue as MaterialId);
	const name = source.name ?? 'Material';
	const cut = name.indexOf(' · ');
	return cut > 0 ? name.slice(0, cut) : name;
}

/** A colour's name: the palette slot's name, or the literal's uppercase hex; null for a missing slot. */
export function finishColourLabel(palette: readonly ScenePaletteSlot[] | undefined, colour: SceneColor): string | null {
	if (typeof colour === 'string') return colour.toUpperCase();
	return palette?.find((slot) => slot.id === colour.slot)?.name ?? null;
}

export type FinishNameContext = {
	readonly recipes?: ReadonlyMap<string, Recipe>;
	readonly palette?: readonly ScenePaletteSlot[];
	readonly facts?: FinishTreatmentFacts;
};

/**
 * `<material> · <colour>[ stain][ · <step | Custom sheen>]`. A resource base's
 * material is the source name up to its first ` · ` (the coat rule).
 */
export function generatedFinishName(
	source: FinishSource & { readonly name?: string | null },
	context: FinishNameContext = {}
): string {
	const recipes = context.recipes ?? new Map<string, Recipe>();
	const facts = context.facts ?? {};
	const parts = [
		finishMaterialLabel(source, facts.labelForMaterial ?? ((id) => id))
	];
	const mode = finishColourMode(source, recipes);
	const colour = source.overrides?.color;
	if (mode !== 'natural' && colour !== undefined) {
		const label = finishColourLabel(context.palette, colour) ?? 'Colour';
		parts.push(mode === 'stained' ? `${label} stain` : label);
	}
	if (source.overrides?.roughness !== undefined) {
		const reading = finishSheenReading(source, recipes, facts);
		parts.push(reading.current === null ? 'Custom sheen' : SHEEN_STEP_LABELS[reading.current]);
	}
	return parts.join(' · ');
}

/** Whether `name` is the generated name of `source`, or that name with a `nextFinishName` suffix. */
export function isGeneratedFinishName(
	name: string,
	source: FinishSource & { readonly name?: string | null },
	context: FinishNameContext = {}
): boolean {
	const generated = generatedFinishName(source, context);
	if (name === generated) return true;
	if (!name.startsWith(`${generated} `)) return false;
	return /^[2-9]\d*$/.test(name.slice(generated.length + 1));
}

/** `label`, or its first free `<label> <n>` when another Finish already holds it. */
export function uniqueFinishName(
	label: string,
	materials: readonly SceneMaterialInstance[],
	exceptId: string | null = null
): string {
	const others = exceptId === null ? materials : materials.filter((material) => material.id !== exceptId);
	return others.some((material) => material.name === label) ? nextFinishName(label, others) : label;
}
