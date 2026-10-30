// @vitest-environment jsdom
/**
 * R217.S05 — the drafting configuration is also reachable from the app menu.
 *
 * PLATE requires Grid/Snap configuration from the drafting words **and** the app
 * menu's Viewing group. The Head renders the same facts and hands each change
 * back to the host; it owns no Grid/Snap state itself.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';

let component: ReturnType<typeof mount> | undefined;
let target: HTMLElement;

afterEach(() => {
	if (component !== undefined) unmount(component);
	component = undefined;
	target.remove();
});

function mountHead(props: {
	readonly gridMinorMeters: number;
	readonly gridIntervalMode: 'automatic' | 'override';
	readonly snapOnGrid: boolean;
	readonly onGridMinorMeters: (mode: 'automatic' | 'override', meters?: number) => void;
	readonly onSnapOnGrid: (snap: boolean) => void;
}): HTMLElement {
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
			onToggleReducedMotion: () => {},
			...props
		}
	});
	return target;
}

describe('R217.S05 — Head Viewing drafting configuration', () => {
	it('edits the minor interval and the Snap fact by handing them to the host', async () => {
		const onGridMinorMeters = vi.fn();
		const onSnapOnGrid = vi.fn();
		const host = mountHead({
			gridMinorMeters: 1,
			gridIntervalMode: 'automatic',
			snapOnGrid: true,
			onGridMinorMeters,
			onSnapOnGrid
		});
		(target.querySelector('.app-menu') as HTMLDetailsElement).open = true;
		await tick();

		const labels = [...host.querySelectorAll('label')];
		const interval = labels.find((label) => label.textContent?.includes('Grid interval'))!
			.querySelector('select')!;
		expect(interval.value).toBe('automatic');
		interval.value = '2';
		interval.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onGridMinorMeters).toHaveBeenCalledWith('override', 2);
		interval.value = 'automatic';
		interval.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onGridMinorMeters).toHaveBeenCalledWith('automatic');

		const snap = labels.find((label) => label.textContent?.includes('Snap to the grid'))!
			.querySelector('input')!;
		expect(snap.checked).toBe(true);
		snap.click();
		expect(onSnapOnGrid).toHaveBeenCalledWith(false);
	});

	it('keeps the configuration out of Settings so motion stays its own group', async () => {
		const host = mountHead({
			gridMinorMeters: 1,
			gridIntervalMode: 'automatic',
			snapOnGrid: true,
			onGridMinorMeters: () => {},
			onSnapOnGrid: () => {}
		});
		const menu = host.querySelector('.app-menu')!;
		const viewing = [...menu.querySelectorAll('strong')].find((node) => node.textContent === 'Viewing')!;
		const gridLabel = [...menu.querySelectorAll('label')].find((label) =>
			label.textContent?.includes('Grid interval')
		)!;
		expect(viewing.compareDocumentPosition(gridLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});
});
