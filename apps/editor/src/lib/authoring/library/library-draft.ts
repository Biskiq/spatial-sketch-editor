/**
 * The Library's Customise… draft (T2.S8 U5).
 *
 * A draft is local view state: beginning it, changing a sheen step and closing
 * it never touch the authoring host, so the project cannot change until Apply.
 * Apply is one accepted `scene-finish-patch` over the draft's Finish, with the
 * same reach rules the Finish Card uses. U6's Material editor replaces the
 * draft's one control; this module fixes the no-write and one-Undo contract it
 * must keep.
 */
import {
	sheenStepEdits,
	type FinishPatchEdit,
	type FinishSheenReading,
	type SceneFinishRef,
	type SheenStepId
} from '@portfolio/project-model/scene-planning';
import type { LibraryFinishEntry } from './library-catalogue';
import type { LibraryTarget } from './library-target';

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
	/** The users the entry had when the draft opened; Apply re-reads them. */
	readonly users: readonly string[];
};

export type LibraryDraftPlan =
	| {
			readonly ok: true;
			readonly mode: 'just-this' | 'all' | 'in-place';
			readonly selectedUsers: readonly string[];
			readonly expectedUsers: readonly string[];
			readonly edits: readonly FinishPatchEdit[];
			/** Curated and just-this patches allocate one Scene Finish. */
			readonly allocates: boolean;
	  }
	| { readonly ok: false; readonly message: string };

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
		users: [...entry.userKeys]
	};
}

/**
 * What Apply would write, or the refusal in place. `reading` and `users` are
 * passed fresh so a changed target, reach or base refuses rather than widens.
 */
export function libraryDraftPlan(
	draft: LibraryDraft,
	target: LibraryTarget | null,
	reading: FinishSheenReading,
	users: readonly string[]
): LibraryDraftPlan {
	if (target === null) return { ok: false, message: 'Select an object or surface first.' };
	if (target.finishKey !== draft.finishKey) {
		return { ok: false, message: `Select a surface wearing ${draft.name} first.` };
	}
	if (!users.includes(target.key)) {
		return { ok: false, message: `${target.label} no longer wears ${draft.name}.` };
	}
	const edits = sheenStepEdits(reading, draft.step);
	if (edits.length === 0 || !libraryDraftChanged(draft, reading)) {
		const alternative = reading.steps.some((step) => !step.disabled && step.id !== reading.current);
		return {
			ok: false,
			message: alternative
				? 'That sheen is already set. Choose another.'
				: 'No other sheen is reachable for this material.'
		};
	}
	if (users.length <= 1) {
		return {
			ok: true,
			mode: draft.source === 'curated' ? 'all' : 'in-place',
			selectedUsers: [target.key],
			expectedUsers: users,
			edits,
			allocates: draft.source === 'curated'
		};
	}
	return {
		ok: true,
		mode: 'just-this',
		selectedUsers: [target.key],
		expectedUsers: users,
		edits,
		allocates: true
	};
}

/** Whether the draft's step differs from what the Finish now reads. */
export function libraryDraftChanged(draft: LibraryDraft, reading: FinishSheenReading): boolean {
	const step = reading.steps.find((candidate) => candidate.id === draft.step);
	if (step === undefined || step.disabled) return false;
	if (step.id !== reading.current) return true;
	// Re-selecting the current step writes nothing, except the explicit reset of
	// a Finish whose base already reads as that step.
	return step.id === reading.original && reading.originalExact && reading.changed;
}

/** A user-facing label for one step. */
export function librarySheenStepLabel(draft: LibraryDraft, id: SheenStepId): string {
	return draft.reading.steps.find((step) => step.id === id)?.label ?? id;
}
