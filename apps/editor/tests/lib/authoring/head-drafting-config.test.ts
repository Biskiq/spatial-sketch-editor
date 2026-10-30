// @vitest-environment jsdom
/**
 * R217.S13 — drafting values left the Head's Viewing group.
 *
 * Grid and Snap are fixed and owned by the Stage's drafting words. The Head no
 * longer renders a Grid interval menu or a Snap-to-grid checkbox: those were the
 * only settings in the old ⚙ disclosure, and the menu must not reintroduce a
 * second drafting authority. Viewing preferences (2D appearance, Height Sheet,
 * reduced motion, motion speed) stay.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';

let component: ReturnType<typeof mount> | undefined;
let target: HTMLElement;

afterEach(() => {
	if (component !== undefined) unmount(component);
	component = undefined;
	target.remove();
});

function mountHead(): HTMLElement {
	target = document.createElement('div');
	document.body.append(target);
	component = mount(EditorHead, {
		target,
		props: {
			projectId: 'project-1',
			projectName: 'Drafting fixture',
			lens: 'world' as const,
			onLens: () => {},
			canDownloadSource: true,
			onDownloadSource: () => {},
			historyUnavailableReason: 'Nothing to undo yet.',
			saveUnavailableReason: 'Conditional Save needs the cloud client; this session has none.',
			previewUnavailableReason: 'Preview needs an admitted project source.',
			reducedMotion: false,
			onToggleReducedMotion: () => {}
		}
	});
	return target;
}

describe('R217.S13 — Head Viewing has no drafting values', () => {
	it('renders no Grid interval menu or Snap-to-grid checkbox', async () => {
		const host = mountHead();
		(host.querySelector('.app-menu') as HTMLDetailsElement).open = true;
		await tick();

		const labels = [...host.querySelectorAll('.app-menu label')];
		expect(labels.some((label) => label.textContent?.includes('Grid interval'))).toBe(false);
		expect(labels.some((label) => label.textContent?.includes('Snap to the grid'))).toBe(false);
		expect(host.querySelector('.app-menu select option[value="automatic"]')).toBeNull();
	});

	it('keeps viewing and motion preferences in their own groups', async () => {
		const host = mountHead();
		(host.querySelector('.app-menu') as HTMLDetailsElement).open = true;
		await tick();
		const menu = host.querySelector('.app-menu')!;
		const groups = [...menu.querySelectorAll('strong')].map((node) => node.textContent);
		expect(groups).toContain('Viewing');
		expect(groups).toContain('Settings');
		const labels = [...menu.querySelectorAll('label')].map((label) => label.textContent ?? '');
		expect(labels.some((label) => label.includes('2D appearance'))).toBe(true);
		expect(labels.some((label) => label.includes('Height Sheet'))).toBe(true);
		expect(labels.some((label) => label.includes('Reduce motion'))).toBe(true);
	});
});
