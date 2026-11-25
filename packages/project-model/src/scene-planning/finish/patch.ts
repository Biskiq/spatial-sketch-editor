/**
 * The typed Finish patch: edit, fork or reset.
 *
 * A patch is a list of field edits. Each names exactly one field and one of
 * three operations:
 *
 * - `set` authors a value (a factor, the colour, the set mapping, or one map
 *   binding);
 * - `disable` (maps only) authors `null`: the base's map is explicitly off;
 * - `reset` deletes the override so the base's value applies again.
 *
 * The patch is applied to one instance copy and the result is read by the
 * strict override reader; it never clamps. Field rules the plan fixes:
 *
 * - replacing a map keeps every factor as authored, including an explicit 0;
 * - disabling the normal map keeps `normalScale` authored but dormant;
 * - `normalScale` may only be set when the resulting Finish binds a normal map;
 * - resetting the colour map follows S4's tint rule: the white tint S4 wrote to
 *   keep an image untinted is removed with the image when no other map override
 *   remains and the patch does not itself author the colour.
 */
import { normalizeOffset, normalizeRotation, pruneOverrides, readOverrides } from '../../materials/read';
import { catalogueRecipe } from '../../materials/catalogue';
import { NEUTRAL_RECIPE } from '../../materials/neutral';
import {
	MATERIAL_MAP_ROLES,
	type FinishOverrides,
	type MapRole,
	type Mapping,
	type Recipe
} from '../../materials/types';
import type { SceneMaterialInstance } from '../../scene';

export const FINISH_PATCH_FACTOR_FIELDS = [
	'color',
	'roughness',
	'metalness',
	'occlusionStrength',
	'normalScale',
	'mapping'
] as const;
export type FinishPatchFactorField = (typeof FINISH_PATCH_FACTOR_FIELDS)[number];
export type FinishPatchMapField = `maps.${MapRole}`;
export type FinishPatchField = FinishPatchFactorField | FinishPatchMapField;

export const FINISH_PATCH_FIELDS: readonly FinishPatchField[] = [
	...FINISH_PATCH_FACTOR_FIELDS,
	...MATERIAL_MAP_ROLES.map((role) => `maps.${role}` as const)
];

export type FinishPatchEdit =
	| { readonly field: FinishPatchField; readonly op: 'set'; readonly value: unknown }
	| { readonly field: FinishPatchMapField; readonly op: 'disable' }
	| { readonly field: FinishPatchField; readonly op: 'reset' };

export type FinishPatchProblem = {
	readonly code:
		| 'duplicate-field'
		| 'unknown-field'
		| 'invalid-operation'
		| 'invalid-value'
		| 'normal-control-without-normal'
		| 'no-change';
	readonly path: string;
	readonly message: string;
};

export type FinishPatchResult =
	| { readonly ok: true; readonly instance: SceneMaterialInstance; readonly touchesSampling: boolean }
	| { readonly ok: false; readonly problem: FinishPatchProblem };

function isMapField(field: FinishPatchField): field is FinishPatchMapField {
	return field.startsWith('maps.');
}

function normalizeMapping(raw: unknown): unknown {
	if (typeof raw !== 'object' || raw === null) return raw;
	const mapping = raw as Mapping;
	try {
		if (mapping.kind === 'uv') {
			return {
				...mapping,
				rotation: typeof mapping.rotation === 'number' ? normalizeRotation(mapping.rotation) : mapping.rotation,
				offset: Array.isArray(mapping.offset)
					? mapping.offset.map((value) => (typeof value === 'number' ? normalizeOffset(value) : value))
					: mapping.offset
			};
		}
		if ((mapping.kind === 'target' || mapping.kind === 'surface') && typeof mapping.metric === 'object' && mapping.metric !== null) {
			return {
				...mapping,
				metric: {
					...mapping.metric,
					rotation: typeof mapping.metric.rotation === 'number' ? normalizeRotation(mapping.metric.rotation) : mapping.metric.rotation,
					offset: Array.isArray(mapping.metric.offset)
						? mapping.metric.offset.map((value) => (typeof value === 'number' ? normalizeOffset(value) : value))
						: mapping.metric.offset
				}
			};
		}
	} catch {
		return raw;
	}
	return raw;
}

function normalizeBinding(raw: unknown): unknown {
	if (typeof raw !== 'object' || raw === null || !('mapping' in raw)) return raw;
	return { ...(raw as Record<string, unknown>), mapping: normalizeMapping((raw as { mapping: unknown }).mapping) };
}

/** The base recipe a Finish instance inherits, when it is readable. */
export function baseRecipeOf(
	instance: SceneMaterialInstance,
	materialRecipes: ReadonlyMap<string, Recipe>
): Recipe | undefined {
	if ('catalogue' in instance.base) return catalogueRecipe(instance.base.catalogue);
	return materialRecipes.get(instance.base.material);
}

/** Whether the effective Finish binds a normal map. */
function bindsNormal(overrides: FinishOverrides | undefined, base: Recipe | undefined): boolean {
	const override = overrides?.maps?.normal;
	if (override === null) return false;
	if (override !== undefined) return true;
	return (base ?? NEUTRAL_RECIPE).maps.normal !== undefined;
}

/**
 * Apply one typed patch to an instance copy. The result keeps the instance's
 * id, name and base; only its overrides change.
 */
export function applyFinishPatch(
	instance: SceneMaterialInstance,
	edits: readonly FinishPatchEdit[],
	baseRecipe: Recipe | undefined
): FinishPatchResult {
	const seen = new Set<FinishPatchField>();
	const overrides = JSON.parse(JSON.stringify(instance.overrides ?? {})) as Record<string, unknown>;
	const maps = { ...((overrides.maps as Record<string, unknown> | undefined) ?? {}) };
	let touchesSampling = false;
	let authorsColour = false;
	let resetsColourMap = false;
	for (const [index, edit] of edits.entries()) {
		const path = `$.payload.edits[${index}]`;
		if (!FINISH_PATCH_FIELDS.includes(edit.field)) {
			return { ok: false, problem: { code: 'unknown-field', path: `${path}.field`, message: `"${String(edit.field)}" is not a Finish field.` } };
		}
		if (seen.has(edit.field)) {
			return { ok: false, problem: { code: 'duplicate-field', path: `${path}.field`, message: `"${edit.field}" is edited twice in one patch.` } };
		}
		seen.add(edit.field);
		if (isMapField(edit.field)) {
			const role = edit.field.slice('maps.'.length) as MapRole;
			touchesSampling = true;
			if (edit.op === 'set') maps[role] = normalizeBinding(edit.value);
			else if (edit.op === 'disable') maps[role] = null;
			else if (edit.op === 'reset') {
				delete maps[role];
				if (role === 'color') resetsColourMap = true;
			} else {
				return { ok: false, problem: { code: 'invalid-operation', path: `${path}.op`, message: 'A map edit is set, disable or reset.' } };
			}
			continue;
		}
		if (edit.op === 'disable') {
			return { ok: false, problem: { code: 'invalid-operation', path: `${path}.op`, message: 'Only a map can be disabled.' } };
		}
		if (edit.op !== 'set' && edit.op !== 'reset') {
			return { ok: false, problem: { code: 'invalid-operation', path: `${path}.op`, message: 'A field edit is set or reset.' } };
		}
		if (edit.field === 'mapping') touchesSampling = true;
		if (edit.field === 'color') authorsColour = true;
		if (edit.op === 'reset') {
			delete overrides[edit.field];
			continue;
		}
		const value = edit.field === 'mapping'
			? normalizeMapping(edit.value)
			: edit.field === 'color' && typeof edit.value === 'string'
				? edit.value.toLowerCase()
				: edit.value;
		overrides[edit.field] = value;
		if (edit.field === 'normalScale') {
			// Validated below against the resulting binding.
		}
	}
	if (Object.keys(maps).length === 0) delete overrides.maps;
	else overrides.maps = maps;
	// S4's tint rule: the white tint written for an untinted colour image leaves
	// with that image when nothing else still needs it.
	if (resetsColourMap && !authorsColour && overrides.maps === undefined && overrides.color === '#ffffff') {
		delete overrides.color;
	}
	const read = readOverrides(overrides);
	if (!read.success) {
		const first = read.issues[0]!;
		return {
			ok: false,
			problem: {
				code: 'invalid-value',
				path: first.path === '$' ? '$.payload.edits' : `$.payload.overrides${first.path.slice(1)}`,
				message: first.action ?? `${first.path} is not admissible (${first.code}).`
			}
		};
	}
	const pruned = pruneOverrides(read.overrides);
	const setsNormalScale = edits.some((edit) => edit.field === 'normalScale' && edit.op === 'set');
	// Resetting the normal map back to a base without one leaves any authored
	// strength with nothing to scale; a patch must reset it too. Disabling keeps
	// the stored positive strength dormant, so it stays allowed.
	const resetsNormalMap = edits.some((edit) => edit.field === 'maps.normal' && edit.op === 'reset');
	const strandsNormalScale =
		resetsNormalMap && pruned?.normalScale !== undefined && !bindsNormal(pruned, baseRecipe);
	if ((setsNormalScale || strandsNormalScale) && !bindsNormal(pruned, baseRecipe)) {
		return {
			ok: false,
			problem: {
				code: 'normal-control-without-normal',
				path: '$.payload.edits',
				message: 'Normal strength needs a normal map. Bind one first.'
			}
		};
	}
	const next: SceneMaterialInstance = {
		id: instance.id,
		name: instance.name,
		base: instance.base,
		...(pruned === undefined ? {} : { overrides: pruned })
	};
	if (JSON.stringify(next.overrides ?? null) === JSON.stringify(instance.overrides ?? null)) {
		return { ok: false, problem: { code: 'no-change', path: '$.payload.edits', message: 'That Finish already has those values.' } };
	}
	return { ok: true, instance: next, touchesSampling };
}
