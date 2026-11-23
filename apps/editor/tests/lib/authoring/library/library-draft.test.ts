/**
 * T2.S8 U5 — the Library's Customise… draft.
 *
 * Beginning, changing and closing a draft is pure view state; Apply's plan is
 * the only thing that becomes an authoring call, and it keeps the Finish Card's
 * reach rules: one user edits in place, a shared project Finish copies just the
 * selected user, and a curated Finish materializes one Finish for its users.
 */
import { describe, expect, it } from 'vitest';
import type { FinishSheenReading } from '@portfolio/project-model/scene-planning';
import {
	beginLibraryDraft,
	libraryDraftChanged,
	libraryDraftPlan,
	type LibraryDraftEntry
} from '$lib/authoring/library/library-draft';
import type { LibraryTarget } from '$lib/authoring/library/library-target';

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

const table: LibraryTarget = {
	kind: 'entity',
	key: 'entity:a',
	entityId: 'a',
	label: 'Table',
	finishKey: 'project:oak'
};
const wall: LibraryTarget = {
	kind: 'surface',
	key: 'surface:wall:left',
	surface: { kind: 'wall-side', wallId: 'wall', side: 'left' },
	label: 'Wall · left',
	finishKey: 'project:oak'
};

describe('T2.S8 U5 — Library draft', () => {
	it('opens on the current sheen and changes only its local step', () => {
		const source = entry('project', ['entity:a']);
		const draft = beginLibraryDraft(source);
		expect(draft.step).toBe('satin');
		const gloss = { ...draft, step: 'gloss' as const };
		expect(gloss.step).toBe('gloss');
		expect(draft.step).toBe('satin');
		expect(source.reading.current).toBe('satin');
	});

	it('plans one in-place patch for a project Finish with one user', () => {
		const draft = { ...beginLibraryDraft(entry('project', ['entity:a'])), step: 'gloss' as const };
		expect(libraryDraftPlan(draft, table, reading(), ['entity:a'])).toMatchObject({
			ok: true,
			mode: 'in-place',
			selectedUsers: ['entity:a'],
			expectedUsers: ['entity:a'],
			allocates: false,
			edits: [{ field: 'roughness', op: 'set', value: 1 }]
		});
	});

	it('copies just the selected user of a shared project Finish', () => {
		const draft = { ...beginLibraryDraft(entry('project', ['entity:a', 'surface:wall:left'])), step: 'gloss' as const };
		expect(libraryDraftPlan(draft, wall, reading(), ['entity:a', 'surface:wall:left'])).toMatchObject({
			ok: true,
			mode: 'just-this',
			selectedUsers: ['surface:wall:left'],
			expectedUsers: ['entity:a', 'surface:wall:left'],
			allocates: true
		});
	});

	it('materializes a curated Finish for its single user', () => {
		const curatedTarget = { ...table, finishKey: 'curated:wood-oak-veneer' };
		const draft = { ...beginLibraryDraft(entry('curated', ['entity:a'])), step: 'matte' as const };
		expect(libraryDraftPlan(draft, curatedTarget, reading(), ['entity:a'])).toMatchObject({
			ok: true,
			mode: 'all',
			selectedUsers: ['entity:a'],
			allocates: true,
			edits: [{ field: 'roughness', op: 'set', value: 0.3 }]
		});
	});

	it('refuses no target, another Finish, a vanished user and the current sheen', () => {
		const draft = { ...beginLibraryDraft(entry('project', ['entity:a'])), step: 'gloss' as const };
		expect(libraryDraftPlan(draft, null, reading(), ['entity:a'])).toEqual({
			ok: false,
			message: 'Select an object or surface first.'
		});
		expect(libraryDraftPlan(draft, { ...table, finishKey: 'curated:wood-walnut-veneer' }, reading(), ['entity:a'])).toMatchObject({
			ok: false,
			message: 'Select a surface wearing Lobby oak first.'
		});
		expect(libraryDraftPlan(draft, table, reading(), ['entity:b'])).toMatchObject({
			ok: false,
			message: 'Table no longer wears Lobby oak.'
		});
		const settled = { ...reading(), current: 'gloss' as const, original: 'gloss' as const, originalExact: true };
		expect(libraryDraftPlan({ ...draft, step: 'gloss' }, table, settled, ['entity:a'])).toEqual({
			ok: false,
			message: 'That sheen is already set. Choose another.'
		});
	});

	it('reads a draft as changed only when its step would write', () => {
		const settled = {
			...reading(),
			current: 'satin' as const,
			original: 'satin' as const,
			originalExact: true
		};
		const draft = beginLibraryDraft({ ...entry('project', ['entity:a']), reading: settled });
		expect(libraryDraftChanged(draft, settled)).toBe(false);
		expect(libraryDraftChanged({ ...draft, step: 'gloss' }, settled)).toBe(true);
	});

	it('does not arm Apply when the draft already sits on an overridden current sheen', () => {
		const overridden = {
			...reading(),
			current: 'satin' as const,
			original: 'matte' as const,
			originalExact: true,
			changed: true
		};
		const source = { ...entry('project', ['entity:a']), reading: overridden };
		const draft = beginLibraryDraft(source);
		expect(draft.step).toBe('satin');
		expect(libraryDraftChanged(draft, overridden)).toBe(false);
		expect(libraryDraftPlan(draft, table, overridden, ['entity:a'])).toEqual({
			ok: false,
			message: 'That sheen is already set. Choose another.'
		});
	});
});
