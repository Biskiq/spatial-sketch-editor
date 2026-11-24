/**
 * The Library's Customise… draft (T2.S8 U5 / U6).
 *
 * A draft is local view state: beginning it, editing any field and closing it
 * never touch the authoring host, so the project cannot change until Apply or
 * the first Paint stroke.
 *
 * Every edited-draft Apply and first draft Paint goes through one assign with
 * `derive: { edits, identity: 'reuse' }` on the named targets only: a curated
 * base with no overrides takes the curated path, an identical project Finish
 * (via the shared `findIdenticalFinish`) is reused with zero allocation, and
 * otherwise exactly one Finish is created. No existing Finish definition or
 * unrelated shared user is ever changed.
 */
import {
	applyFinishPatch,
	baseRecipeOf,
	findIdenticalFinish,
	isPristineInstance,
	type FinishPatchEdit,
	type FinishSheenReading,
	type SceneFinishRef,
	type SheenStepId
} from '@portfolio/project-model/scene-planning';
import { pruneOverrides, type Recipe } from '@portfolio/project-model/materials';
import type { SceneMaterialInstance } from '@portfolio/project-model';
import type { LibraryFinishEntry } from './library-catalogue';

export const SHEEN_STEP_ORDER: readonly SheenStepId[] = ['matte', 'satin', 'gloss'];

export type LibraryDraftEntry = Pick<
	LibraryFinishEntry,
	'key' | 'ref' | 'name' | 'materialLabel' | 'source' | 'reading' | 'userKeys'
>;

export type LibraryDraft = {
	readonly finishKey: string;
	readonly ref: Exclude<SceneFinishRef, 'model-own'>;
	readonly name: string;
	readonly baseLabel: string;
	readonly source: 'curated' | 'project';
	readonly step: SheenStepId;
	readonly reading: FinishSheenReading;
	/** Full typed patch list accumulated in the Material editor (U6). */
	readonly edits: readonly FinishPatchEdit[];
	readonly users: readonly string[];
};

export type DerivedAssignPrediction =
	| {
			readonly ok: true;
			/** Resolved Finish key (`curated:<id>` or `project:<id>`), or `null` when a new Finish will be created. */
			readonly existingKey: string | null;
			/** True when the assign command needs one allocated `scene-finish` id. */
			readonly allocates: boolean;
			/** The resulting synthetic instance for preview/inspection. */
			readonly instance: SceneMaterialInstance;
	  }
	| { readonly ok: false; readonly code: string; readonly message: string };

function defaultStep(reading: FinishSheenReading): SheenStepId {
	if (reading.current !== null) return reading.current;
	if (reading.original !== null) return reading.original;
	return SHEEN_STEP_ORDER.find((id) => reading.steps.some((step) => step.id === id && !step.disabled)) ?? 'satin';
}

/** Open a draft. This is view state: no host call, no write. */
export function beginLibraryDraft(
	entry: LibraryDraftEntry,
	step: SheenStepId = defaultStep(entry.reading)
): LibraryDraft {
	return {
		finishKey: entry.key,
		ref: entry.ref,
		name: entry.name,
		baseLabel: entry.materialLabel,
		source: entry.source,
		step,
		reading: entry.reading,
		edits: [],
		users: [...entry.userKeys]
	};
}

/**
 * Predict what a `derive: { edits, identity: 'reuse' }` assign will resolve to,
 * using the exact `findIdenticalFinish` helper shared with the planner.
 */
export function predictDerivedAssign(input: {
	readonly materials: readonly SceneMaterialInstance[];
	readonly sourceInstance: SceneMaterialInstance;
	readonly edits: readonly FinishPatchEdit[];
	readonly recipes: ReadonlyMap<string, Recipe>;
	readonly includesModel: boolean;
}): DerivedAssignPrediction {
	const { materials, sourceInstance, edits, recipes, includesModel } = input;
	let derived = sourceInstance;
	if (edits.length > 0) {
		const patched = applyFinishPatch(sourceInstance, edits, baseRecipeOf(sourceInstance, recipes));
		if (!patched.ok) {
			if (patched.problem.code !== 'no-change') {
				return { ok: false, code: patched.problem.code, message: patched.problem.message };
			}
		} else {
			derived = patched.instance;
		}
	}
	const pruned = pruneOverrides(derived.overrides);
	if ('catalogue' in derived.base && pruned === undefined) {
		const catId = derived.base.catalogue;
		const hasPristine = materials.some(
			(instance) => isPristineInstance(instance) && 'catalogue' in instance.base && instance.base.catalogue === catId
		);
		return {
			ok: true,
			existingKey: `curated:${catId}`,
			allocates: includesModel && !hasPristine,
			instance: { ...derived, overrides: undefined }
		};
	}
	const identical = findIdenticalFinish(materials, derived.base, pruned);
	if (identical !== null) {
		return {
			ok: true,
			existingKey: `project:${identical.id}`,
			allocates: false,
			instance: identical
		};
	}
	return {
		ok: true,
		existingKey: null,
		allocates: true,
		instance: pruned === undefined ? { ...derived, overrides: undefined } : { ...derived, overrides: pruned }
	};
}

/** Whether the draft has any edits relative to its source Finish. */
export function libraryDraftChanged(draft: LibraryDraft): boolean {
	return draft.edits.length > 0;
}

/** A user-facing label for one step. */
export function librarySheenStepLabel(draft: LibraryDraft, id: SheenStepId): string {
	return draft.reading.steps.find((step) => step.id === id)?.label ?? id;
}
