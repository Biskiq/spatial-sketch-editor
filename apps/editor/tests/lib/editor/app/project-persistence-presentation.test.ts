import { describe, expect, it } from 'vitest';
import { projectPersistencePresentation } from '$lib/editor/app/project-persistence-presentation';
import { readLibSource } from '../../../helpers/lib-source';

describe('Project Row persistence presentation', () => {
	it.each([
		[false, false, false, null, 'Local Session', 'Session active', false],
		[false, true, false, null, 'Local Session', 'Save to Cloud', true],
		[true, false, false, null, 'Cloud', 'Saved', false],
		[true, true, false, null, 'Cloud', 'Save changes', true],
		[true, true, true, 'Busy', 'Cloud', 'Saving…', false],
		[true, true, false, 'Invalid layout', 'Cloud', 'Save Blocked', false],
		[false, true, false, 'Missing texture', 'Local Session', 'Save Blocked', false]
	] as const)('keeps location independent from save state (%s, %s, %s, %s)',
		(owned, dirty, saving, blocker, location, label, actionable) => {
			expect(projectPersistencePresentation({ owned, dirty, saving, blocker }))
				.toMatchObject({ location, label, actionable });
		});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.1 shared shell', () => {
	it('never pops the document menu on background cloud errors', () => {
		// Only the explicit save-auth interruption surfaces the menu; a
		// failed owned-projects refresh on fresh guest load must not.
		const row = readLibSource('editor/app/ProjectRow.svelte');
		// P23.14 #40 — the same gate now also closes the row's sibling popovers,
		// so it goes through the coordinating opener.
		expect(row).toContain('if (saveAuthGateOpen) openDocumentMenu()');
		expect(row).toContain('function openDocumentMenu()');
		expect(row).not.toContain('cloudError) projectMenuOpen = true');
		expect(row).not.toContain('cloudError) openDocumentMenu()');
	});
	it('disables the save-state pill when neither actionable nor blocked', () => {
		const row = readLibSource('editor/app/ProjectRow.svelte');
		expect(row).toContain('(!presentation.actionable && !saveBlocker)');
	});
});
