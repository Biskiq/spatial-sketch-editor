// @vitest-environment jsdom
/**
 * T2.S8 U2 — the Paint tray's own surface: tabs only when Colours exists, the
 * swatch row as a listbox with roving focus, the reach control, the wheel and
 * refusals as a line in place. It draws a view and calls back; it owns no Finish.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import StagePaintTray from '$lib/authoring/stage/shell/StagePaintTray.svelte';
import { createPaintTrayState } from '$lib/authoring/look/paint-tray-state.svelte';
import type { PaintSwatch, PaintTrayView } from '$lib/authoring/look/finish-authoring.svelte';

const material = (key: string, label: string, favourite = false): PaintSwatch => ({ kind: 'finish', key, label, color: '#c0a080', favourite });
const colour = (key: string, label: string): PaintSwatch => ({ kind: 'colour', key, label, color: key.startsWith('#') ? key : '#336699', favourite: false });

function view(overrides: Partial<PaintTrayView> = {}): PaintTrayView {
	return {
		colourEnabled: false,
		active: null,
		dropper: false,
		colours: { row: [colour('#336699', '#336699'), colour('slot:sage', 'Sage')], palette: [{ id: 'sage', name: 'Sage', color: '#889977' }] },
		materials: {
			row: [material('curated:a', 'Alpha'), material('curated:b', 'Beta', true)],
			project: [],
			curated: [material('curated:a', 'Alpha'), material('curated:b', 'Beta')]
		},
		...overrides
	};
}

const mounted: Record<string, unknown>[] = [];
afterEach(() => {
	for (const instance of mounted.splice(0)) void unmount(instance);
	document.body.innerHTML = '';
});

function render(tray: PaintTrayView, extra: Record<string, unknown> = {}) {
	const state = createPaintTrayState();
	const callbacks = {
		onPick: vi.fn(),
		onColour: vi.fn(),
		onFavourite: vi.fn(),
		onDropper: vi.fn(),
		onRadius: vi.fn(),
		onLibrary: vi.fn()
	};
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted.push(
		mount(StagePaintTray, {
			target,
			props: { tray, view: state, radius: 'surface', ...callbacks, ...extra }
		}) as Record<string, unknown>
	);
	return { target, state, ...callbacks };
}

describe('T2.S8 U2 — Paint tray', () => {
	it('draws Colours and Brush as inert future affordances until they exist', () => {
		const one = render(view());
		const colours = one.target.querySelector<HTMLButtonElement>('[data-paint-tab-button="colours"]')!;
		expect(colours.getAttribute('aria-disabled')).toBe('true');
		colours.click();
		flushSync();
		expect(one.target.querySelector('[data-paint-tab]')?.getAttribute('data-paint-tab')).toBe('materials');
		const brush = one.target.querySelector<HTMLButtonElement>('[data-paint-radius="brush"]')!;
		expect(brush.getAttribute('aria-disabled')).toBe('true');
		brush.click();
		expect(one.onRadius).not.toHaveBeenCalled();

		const two = render(view({ colourEnabled: true }));
		expect(two.target.querySelectorAll('[role="tab"]')).toHaveLength(2);
		two.target.querySelector<HTMLButtonElement>('[data-paint-tab-button="colours"]')!.click();
		flushSync();
		expect(two.target.querySelector('[data-paint-tab]')?.getAttribute('data-paint-tab')).toBe('colours');
		// Colours are circles; the wheel door replaces Browse all.
		expect(two.target.querySelector('[data-paint-wheel-open]')).not.toBeNull();
		expect(two.target.querySelector('[data-paint-library]')).toBeNull();
	});

	it('picks from the row, marks the pick selected and stars a favourite', () => {
		const tray = view({ active: material('curated:b', 'Beta', true) });
		const { target, onPick, onFavourite } = render(tray);
		const options = [...target.querySelectorAll<HTMLButtonElement>('[role="option"]')];
		expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'true']);
		options[0]!.click();
		expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ key: 'curated:a' }));
		const star = target.querySelector<HTMLButtonElement>('[data-paint-favourite]')!;
		expect(star.getAttribute('aria-pressed')).toBe('true');
		star.click();
		expect(onFavourite).toHaveBeenCalledTimes(1);
	});

	it('moves focus along the row with the arrow keys and never picks by moving', () => {
		const { target, onPick } = render(view());
		const options = [...target.querySelectorAll<HTMLButtonElement>('[role="option"]')];
		expect(options.map((option) => option.tabIndex)).toEqual([0, -1]);
		options[0]!.focus();
		options[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		expect(document.activeElement).toBe(options[1]);
		expect(onPick).not.toHaveBeenCalled();
	});

	it('reports the reach and the dropper', () => {
		const { target, onRadius, onDropper } = render(view());
		expect(target.querySelector('[data-paint-radius="surface"]')?.getAttribute('aria-pressed')).toBe('true');
		target.querySelector<HTMLButtonElement>('[data-paint-radius="space"]')!.click();
		expect(onRadius).toHaveBeenCalledWith('space');
		target.querySelector<HTMLButtonElement>('[data-paint-dropper]')!.click();
		expect(onDropper).toHaveBeenCalledTimes(1);
		// Brush is drawn as a decided future radius, inert; only Surface and Space act.
		expect(target.querySelectorAll('[data-paint-radius]:not([aria-disabled])')).toHaveLength(2);
		expect(target.querySelectorAll('[data-paint-radius="brush"][aria-disabled="true"]')).toHaveLength(1);
	});

	it('leaves the consequence line to the Stage view bar', () => {
		// The accepted design reads Paint's next press on the view bar; the tray head is tabs | radius | dropper.
		expect(render(view({ active: material('curated:a', 'Alpha') })).target.querySelector('[data-paint-consequence]')).toBeNull();
	});

	it('opens Paint colour above Custom colour while collapsed, and Done hands back a literal colour', () => {
		const { target, state, onColour } = render(view({ colourEnabled: true }));
		state.setTab('colours');
		flushSync();
		target.querySelector<HTMLButtonElement>('[data-paint-wheel-open]')!.click();
		flushSync();
		expect(state.expanded).toBe(false);
		expect(target.querySelector('[data-paint-more]')).toBeNull();
		const picker = target.querySelector('[data-paint-picker] [data-paint-wheel]');
		expect(picker).not.toBeNull();
		expect(picker!.getAttribute('role')).toBe('dialog');
		const hex = target.querySelector<HTMLInputElement>('[data-paint-hex]')!;
		hex.value = '#123456';
		hex.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onColour).not.toHaveBeenCalled();
		target.querySelector<HTMLButtonElement>('[data-paint-wheel-use]')!.click();
		expect(onColour).toHaveBeenCalledWith({ kind: 'literal', hex: '#123456' });
		expect(state.wheelOpen).toBe(false);
	});

	it('arms a linked slot from a picker chip and from the expanded palette', () => {
		const { target, state, onColour } = render(view({ colourEnabled: true }));
		state.setTab('colours');
		state.setWheelOpen(true);
		flushSync();
		target.querySelector<HTMLButtonElement>('[data-paint-wheel-slot="sage"]')!.click();
		expect(onColour).toHaveBeenLastCalledWith({ kind: 'slot', slotId: 'sage' });
		state.toggleExpanded();
		flushSync();
		target.querySelector<HTMLButtonElement>('[data-paint-palette-slot="sage"]')!.click();
		expect(onColour).toHaveBeenLastCalledWith({ kind: 'slot', slotId: 'sage' });
	});

	it('closes Paint colour on Escape without arming and returns focus to Custom colour', () => {
		const { target, state, onColour } = render(view({ colourEnabled: true }));
		state.setTab('colours');
		state.setWheelOpen(true);
		flushSync();
		const dialog = target.querySelector<HTMLElement>('[data-paint-wheel]')!;
		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		flushSync();
		expect(state.wheelOpen).toBe(false);
		expect(onColour).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(target.querySelector('[data-paint-wheel-open]'));
	});

	it('adds to the palette through the one-Undo command, then arms the returned slot', async () => {
		const add = vi.fn(async () => 'slot-new');
		const palette = { slots: [], room: true, add, rename: vi.fn(), setColor: vi.fn(), remove: vi.fn() };
		const { target, state, onColour } = render(view({ colourEnabled: true }), { palette });
		state.setTab('colours');
		state.setWheelOpen(true);
		flushSync();
		target.querySelector<HTMLButtonElement>('[data-paint-wheel-add]')!.click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		flushSync();
		expect(add).toHaveBeenCalledTimes(1);
		expect(onColour).toHaveBeenLastCalledWith({ kind: 'slot', slotId: 'slot-new' });
	});

	it('explains a full palette and keeps the picker open', async () => {
		const add = vi.fn(async () => null);
		const palette = { slots: [], room: false, add, rename: vi.fn(), setColor: vi.fn(), remove: vi.fn() };
		const { target, state, onColour } = render(view({ colourEnabled: true }), { palette });
		state.setTab('colours');
		state.setWheelOpen(true);
		flushSync();
		target.querySelector<HTMLButtonElement>('[data-paint-wheel-add]')!.click();
		await Promise.resolve();
		flushSync();
		expect(add).not.toHaveBeenCalled();
		expect(onColour).not.toHaveBeenCalled();
		expect(state.wheelOpen).toBe(true);
		expect(target.querySelector('[data-paint-wheel-message]')?.textContent ?? '').toMatch(/full|eight/i);
	});

	it('folds the wheel, then the expansion, one Escape rung at a time', () => {
		const state = createPaintTrayState();
		state.toggleExpanded();
		state.setWheelOpen(true);
		expect(state.expanded).toBe(true);
		expect(state.dismiss()).toBe(true);
		expect(state.wheelOpen).toBe(false);
		expect(state.expanded).toBe(true);
		expect(state.dismiss()).toBe(true);
		expect(state.dismiss()).toBe(false);
		expect(state.tab).toBe('materials');
		state.toggleTab(false);
		expect(state.tab).toBe('materials');
		state.toggleTab(true);
		expect(state.tab).toBe('colours');
	});
});
