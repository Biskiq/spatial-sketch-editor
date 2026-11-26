/**
 * Manual composition and set correction share one lowering (T2.S8 E5, step 3).
 *
 * `draftFromCandidate` turns a proposed candidate plus the creator's
 * corrections into `DraftEdits`; manual creation writes `DraftEdits` directly.
 * `composeDraft` is the only function that turns edits into a recipe, so an
 * automatically recognized set and the same set assembled by hand produce the
 * same canonical recipe, digest and registration.
 *
 * Defaults on a **new** composed recipe: the neutral PBR base, except that a
 * supplied roughness or metallic map makes that role's factor 1 so the map is
 * read unscaled. An explicit factor (including zero) is always kept.
 */
import { NEUTRAL_RECIPE } from '../materials/neutral';
import { normalizeOffset, normalizeRotation, readRecipe } from '../materials/read';
import {
	MATERIAL_MAP_ROLES,
	MATERIAL_PROFILE,
	type MapRole,
	type Mapping,
} from '../materials/types';
import type {
	CandidateCorrections,
	ComposeResult,
	DraftEdits,
	DraftIssue,
	DraftRoleEdit,
	SetCandidate,
	SetFileFact,
} from './types';

/** The longest Finish display name, shared with the Scene planners. */
export const DRAFT_NAME_MAX_LENGTH = 120;

const FALLBACK_NAME = 'Imported material';

function sortIssues(issues: DraftIssue[]): DraftIssue[] {
	return issues.sort((left, right) =>
		left.path !== right.path
			? left.path < right.path
				? -1
				: 1
			: (left.role ?? '') !== (right.role ?? '')
				? (left.role ?? '') < (right.role ?? '')
					? -1
					: 1
				: left.code < right.code
					? -1
					: left.code > right.code
						? 1
						: 0,
	);
}

/** Wrap user angles and offsets; leave dimensions for the strict reader to judge. */
export function normalizeDraftMapping(mapping: Mapping): Mapping {
	if (mapping.kind === 'uv') {
		return {
			kind: 'uv',
			set: mapping.set,
			repeat: [mapping.repeat[0], mapping.repeat[1]],
			rotation: normalizeRotation(mapping.rotation),
			offset: [normalizeOffset(mapping.offset[0]), normalizeOffset(mapping.offset[1])],
		};
	}
	return {
		kind: mapping.kind,
		metric: {
			tileMeters: [mapping.metric.tileMeters[0], mapping.metric.tileMeters[1]],
			rotation: normalizeRotation(mapping.metric.rotation),
			offset: [
				normalizeOffset(mapping.metric.offset[0]),
				normalizeOffset(mapping.metric.offset[1]),
			],
		},
	};
}

/** A title-cased display name from a normalized stem. */
export function displayNameOfStem(stem: string): string {
	const trimmed = stem.trim();
	if (trimmed.length === 0) return FALLBACK_NAME;
	return trimmed
		.split(' ')
		.map((word) => (word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1)))
		.join(' ')
		.slice(0, DRAFT_NAME_MAX_LENGTH);
}

/**
 * Lower one candidate and its corrections to draft edits.
 *
 * Unacknowledged guesses and unresolved conflicts stay **blocking**: they are
 * returned as issues rather than resolved by a default.
 */
export function draftFromCandidate(
	candidate: SetCandidate,
	corrections: CandidateCorrections = {},
):
	| { readonly ok: true; readonly edits: DraftEdits }
	| { readonly ok: false; readonly issues: readonly DraftIssue[] } {
	const issues: DraftIssue[] = [];
	const excluded = new Set(corrections.exclude ?? []);
	const acknowledged = new Set(corrections.acknowledge ?? []);
	const roles: Partial<Record<MapRole, DraftRoleEdit>> = {};
	for (const role of MATERIAL_MAP_ROLES) {
		if (excluded.has(role)) continue;
		const explicit = corrections.set?.[role];
		if (explicit !== undefined) {
			if (explicit.role !== role) {
				issues.push({
					code: 'invalid-value',
					path: `$.set.${role}`,
					role,
					action: `Bind the ${role} correction to the ${role} role.`,
				});
				continue;
			}
			roles[role] = explicit;
			continue;
		}
		const conflict = candidate.conflicts.find((entry) => entry.role === role);
		if (conflict !== undefined) {
			issues.push({
				code: 'unresolved-role',
				path: `$.roles.${role}`,
				role,
				action: conflict.action,
			});
			continue;
		}
		const choice = candidate.roleChoices.find((entry) => entry.role === role);
		if (choice === undefined) continue;
		if (choice.acknowledge !== undefined && !acknowledged.has(role)) {
			issues.push({
				code: 'unacknowledged-guess',
				path: `$.roles.${role}`,
				role,
				action: 'Confirm whether the normal map is OpenGL (+Y) or DirectX (−Y).',
			});
			continue;
		}
		if (role === 'color') roles.color = { role: 'color', file: choice.file };
		else if (role === 'normal')
			roles.normal = { role: 'normal', file: choice.file, convention: choice.convention ?? '+Y' };
		else {
			roles[role] = {
				role,
				file: choice.file,
				component: choice.component ?? 'r',
				invert: choice.invert ?? false,
			};
		}
	}
	if (issues.length > 0) return { ok: false, issues: sortIssues(issues) };
	return {
		ok: true,
		edits: {
			name: corrections.name ?? displayNameOfStem(candidate.stem),
			...(corrections.factors === undefined ? {} : { factors: corrections.factors }),
			...(corrections.mapping === undefined ? {} : { mapping: corrections.mapping }),
			roles,
		},
	};
}

/**
 * Compose one normalized v1 recipe from draft edits and verified file facts.
 *
 * The strict recipe reader is the final judge of every value; this function
 * only wraps angles/offsets and supplies the defaults. It never clamps.
 */
export function composeDraft(
	edits: DraftEdits,
	files: ReadonlyMap<string, SetFileFact>,
): ComposeResult {
	const issues: DraftIssue[] = [];
	const name = edits.name.trim();
	if (name.length === 0 || name.length > DRAFT_NAME_MAX_LENGTH) {
		issues.push({
			code: 'invalid-name',
			path: '$.name',
			action: `Name the Finish with 1–${DRAFT_NAME_MAX_LENGTH} characters.`,
		});
	}
	const maps: Record<string, unknown> = {};
	const sources = new Map<string, string>();
	for (const role of MATERIAL_MAP_ROLES) {
		const edit = edits.roles[role];
		if (edit === undefined) continue;
		if (edit.role !== role) {
			issues.push({
				code: 'invalid-value',
				path: `$.roles.${role}`,
				role,
				action: `Bind the ${role} edit to the ${role} role.`,
			});
			continue;
		}
		const fact = files.get(edit.file);
		if (fact === undefined) {
			issues.push({
				code: 'unknown-file',
				path: `$.roles.${role}.file`,
				role,
				action: 'Select the file again.',
			});
			continue;
		}
		const admission = role === 'color' ? fact.colour : fact.raw;
		if (!admission.ok) {
			issues.push({
				code: 'unsupported-image-encoding',
				path: `$.roles.${role}.file`,
				role,
				action: admission.action,
			});
			continue;
		}
		const mapping =
			edit.mapping === undefined ? {} : { mapping: normalizeDraftMapping(edit.mapping) };
		if (edit.role === 'color') maps.color = { image: fact.hash, ...mapping };
		else if (edit.role === 'normal')
			maps.normal = { image: fact.hash, convention: edit.convention, ...mapping };
		else
			maps[role] = { image: fact.hash, component: edit.component, invert: edit.invert, ...mapping };
		// Two keys for the same digest are the same bytes; the first by key wins.
		const existing = sources.get(fact.hash);
		if (existing === undefined || fact.key < existing) sources.set(fact.hash, fact.key);
	}
	const factors = edits.factors ?? {};
	const raw = {
		profile: MATERIAL_PROFILE,
		color: typeof factors.color === 'string' ? factors.color.toLowerCase() : NEUTRAL_RECIPE.color,
		roughness:
			factors.roughness ?? (edits.roles.roughness !== undefined ? 1 : NEUTRAL_RECIPE.roughness),
		metalness:
			factors.metalness ?? (edits.roles.metalness !== undefined ? 1 : NEUTRAL_RECIPE.metalness),
		occlusionStrength: factors.occlusionStrength ?? NEUTRAL_RECIPE.occlusionStrength,
		normalScale: factors.normalScale ?? NEUTRAL_RECIPE.normalScale,
		mapping: normalizeDraftMapping(edits.mapping ?? NEUTRAL_RECIPE.mapping),
		maps,
	};
	if (issues.length > 0) return { ok: false, issues: sortIssues(issues) };
	const read = readRecipe(raw);
	if (!read.success) {
		return {
			ok: false,
			issues: sortIssues(
				read.issues.map((issue) => ({
					code: issue.code === 'out-of-range' ? 'out-of-range' : 'invalid-value',
					path: issue.path,
					...(issue.role === undefined ? {} : { role: issue.role }),
					action: issue.action ?? 'Correct this value.',
				})),
			),
		};
	}
	return { ok: true, draft: { name, recipe: read.recipe, files: sources } };
}
