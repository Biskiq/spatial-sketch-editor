// @vitest-environment jsdom
/**
 * T2.S6 — the Sky · Looks tab row follows the tablist keyboard map.
 *
 * Arrow keys move to the other tab; Home always selects Sky and End always
 * selects Looks, whichever tab is current (the first correction pass fixed a
 * toggle-only Home/End).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { skyFromPreset } from '@portfolio/project-model/units';
import SkyPanel from '$lib/authoring/environment/SkyPanel.svelte';
import type { LookAuthoring } from '$lib/authoring/look/look-authoring.svelte';

function fake(): LookAuthoring & { panelTab: 'sky' | 'looks' } {
	const look = {
		panelTab: 'sky' as 'sky' | 'looks',
		setPanelTab: vi.fn((tab: 'sky' | 'looks') => {
			look.panelTab = tab;
		}),
		shownSky: skyFromPreset('dusk', 0),
		edited: false,
		busy: false,
		gesture: {
			owner: null,
			value: skyFromPreset('dusk', 0),
			cancel: vi.fn(),
			begin: vi.fn(() => false),
			move: vi.fn(),
			commit: vi.fn()
		},
		setEnvironment: vi.fn(),
		updateSky: vi.fn(),
		resetSky: vi.fn(),
		aimThroughWindows: vi.fn()
	};
	return look as unknown as LookAuthoring & { panelTab: 'sky' | 'looks' };
}

let mounted: ReturnType<typeof mount> | null = null;
afterEach(() => {
	if (mounted !== null) unmount(mounted);
	mounted = null;
	document.body.innerHTML = '';
});

function tab(root: HTMLElement, name: 'sky' | 'looks'): HTMLButtonElement {
	const found = root.querySelector<HTMLButtonElement>(`[data-tab="${name}"]`);
	if (found === null) throw new Error(`no ${name} tab`);
	return found;
}

function press(node: HTMLElement, key: string): void {
	node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('T2.S6 — Sky and Looks tabs', () => {
	it('moves to the other tab with an arrow key', async () => {
		const look = fake();
		mounted = mount(SkyPanel, { target: document.body, props: { look } });
		await tick();
		const root = document.body;
		press(tab(root, 'sky'), 'ArrowRight');
		expect(look.setPanelTab).toHaveBeenLastCalledWith('looks');
		press(tab(root, 'looks'), 'ArrowLeft');
		expect(look.setPanelTab).toHaveBeenLastCalledWith('sky');
	});

	it('selects Sky with Home and Looks with End, not a toggle', async () => {
		const look = fake();
		mounted = mount(SkyPanel, { target: document.body, props: { look } });
		await tick();
		const root = document.body;
		// Move the reading without re-rendering the Looks panel: the handler must
		// obey Home/End regardless of which tab is current.
		look.panelTab = 'looks';
		press(tab(root, 'sky'), 'Home');
		expect(look.setPanelTab).toHaveBeenLastCalledWith('sky');
		press(tab(root, 'sky'), 'End');
		expect(look.setPanelTab).toHaveBeenLastCalledWith('looks');
	});
});
