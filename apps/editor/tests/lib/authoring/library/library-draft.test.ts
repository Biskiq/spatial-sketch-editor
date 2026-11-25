/**
 * T2.S8 U6 — the Library's Customise… draft and derived-recipe prediction.
 *
 * Beginning, editing and closing a draft is pure view state. Apply and the
 * first draft Paint stroke predict and commit through the shared
 * `findIdenticalFinish` helper (`identity: 'reuse'`), never mutating any
 * existing Finish definition or unrelated shared user.
 */
import { describe, expect, it } from 'vitest';
import type { FinishSheenReading } from '@portfolio/project-model/scene-planning';
import type { SceneMaterialInstance } from '@portfolio/project-model/scene';
import {
	beginLibraryDraft,
	libraryDraftChanged,
	predictDerivedAssign,
	type LibraryDraftEntry
} from '$lib/authoring/library/library-draft';

function reading(current: 'matte' | 'satin' | 'gloss' = 'satin'): FinishSheenReading {
	return {
		steps: [
			{ id: 'matte', label: 'Matte', target: 0.2, factor: 0.3, disabled: false },
			{ id: 'satin', label: 'Satin', target: 0.45, factor: 0.6, disabled: false },
			{ id: 'gloss', label: 'Gloss', target: 0.8, factor: 1, disabled: false }
		],
		current,
		original: 'satin',
		originalExact: false,
		effective: 0.45,
		scan: { mean: 1, approximate: false },
		changed: false
	};
}

function entry(source: 'project' | 'curated', users: readonly string[]): LibraryDraftEntry {
	return {
		key: source === 'curated' ? 'curated:wood-oak-veneer' : 'project:oak',
		ref: source === 'curated' ? { curated: 'wood-oak-veneer' } : { project: 'oak' },
		name: source === 'curated' ? 'Oak Veneer' : 'Lobby oak',
		materialLabel: 'Oak Veneer',
		source,
		reading: reading(),
		userKeys: users
	};
}

const emptyRecipes = new Map();

describe('T2.S8 U6 — Library draft & derived prediction', () => {
	it('opens unchanged with empty edits and changes only locally', () => {
		const source = entry('project', ['entity:a']);
		const draft = beginLibraryDraft(source);
		expect(draft.step).toBe('satin');
		expect(draft.edits).toEqual([]);
		expect(libraryDraftChanged(draft)).toBe(false);
		const edited = { ...draft, edits: [{ field: 'roughness' as const, op: 'set' as const, value: 0.3 }] };
		expect(libraryDraftChanged(edited)).toBe(true);
		expect(libraryDraftChanged(draft)).toBe(false);
	});

	it('predicts allocation when no identical Finish exists, and reuse when one matches (name ignored)', () => {
		const source: SceneMaterialInstance = { id: 'curated:wood-oak-veneer', name: 'Oak', base: { catalogue: 'wood-oak-veneer' } };
		const first = predictDerivedAssign({
			materials: [],
			sourceInstance: source,
			edits: [{ field: 'roughness', op: 'set', value: 0.4 }],
			recipes: emptyRecipes,
			includesModel: false
		});
		expect(first).toMatchObject({ ok: true, existingKey: null, allocates: true });

		const existing: SceneMaterialInstance = {
			id: 'fin-existing',
			name: 'Renamed Oak',
			base: { catalogue: 'wood-oak-veneer' },
			overrides: { roughness: 0.4 }
		};
		const second = predictDerivedAssign({
			materials: [existing],
			sourceInstance: source,
			edits: [{ field: 'roughness', op: 'set', value: 0.4 }],
			recipes: emptyRecipes,
			includesModel: false
		});
		expect(second).toMatchObject({ ok: true, existingKey: 'project:fin-existing', allocates: false });
	});

	it('predicts curated path when edits reset overrides to pristine, including model pristine allocation', () => {
		const existing: SceneMaterialInstance = {
			id: 'fin-rough',
			name: 'Rough Oak',
			base: { catalogue: 'wood-oak-veneer' },
			overrides: { roughness: 0.4 }
		};
		const onBox = predictDerivedAssign({
			materials: [existing],
			sourceInstance: existing,
			edits: [{ field: 'roughness', op: 'reset' }],
			recipes: emptyRecipes,
			includesModel: false
		});
		expect(onBox).toMatchObject({ ok: true, existingKey: 'curated:wood-oak-veneer', allocates: false });

		const onModel = predictDerivedAssign({
			materials: [existing],
			sourceInstance: existing,
			edits: [{ field: 'roughness', op: 'reset' }],
			recipes: emptyRecipes,
			includesModel: true
		});
		expect(onModel).toMatchObject({ ok: true, existingKey: 'curated:wood-oak-veneer', allocates: true });
	});

	it('refuses inadmissible edits with their E4 problem code', () => {
		const source: SceneMaterialInstance = { id: 'curated:wood-oak-veneer', name: 'Oak', base: { catalogue: 'wood-oak-veneer' } };
		const bad = predictDerivedAssign({
			materials: [],
			sourceInstance: source,
			edits: [{ field: 'roughness', op: 'set', value: 9 }],
			recipes: emptyRecipes,
			includesModel: false
		});
		expect(bad).toMatchObject({ ok: false, code: 'invalid-value' });
	});
});
