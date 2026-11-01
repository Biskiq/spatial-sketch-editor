// @vitest-environment jsdom
/**
 * R217.S20 — the ⚙ holds no drafting value, and the Head holds no viewing value.
 *
 * R217.S13 removed the Grid interval and the Snap-to-the-grid checkbox with the old
 * ☰ menu. Grid and Snap are fixed and owned by the Stage's drafting words, so no
 * settings control may reintroduce a second drafting authority. S20 returns the ⚙
 * with the viewing preferences only (2D appearance, Height Sheet side, Reduce
 * motion, motion speed), and moves them out of the Head.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';
import StageDraftingControl from '$lib/authoring/stage/shell/StageDraftingControl.svelte';

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
			previewUnavailableReason: 'Preview needs an admitted project source.'
		}
	});
	return target;
}

type ControlProps = {
	planAppearance?: 'paper' | 'shaded';
	onPlanAppearance?: (value: 'paper' | 'shaded') => void;
	heightSheetSide?: 'left' | 'right';
	onHeightSheetSide?: (side: 'left' | 'right') => void;
	reducedMotion?: boolean;
	onToggleReducedMotion?: () => void;
	motionSpeed?: 'slow' | 'normal' | 'fast';
	onMotionSpeed?: (value: 'slow' | 'normal' | 'fast') => void;
};

function mountControl(props: ControlProps = {}): HTMLElement {
	target = document.createElement('div');
	document.body.append(target);
	component = mount(StageDraftingControl, {
		target,
		props: {
			drafting: { grid: true, snap: true, snapSuspended: false },
			reading: 'plan' as const,
			gridWord: 'Grid',
			snapWord: 'Snap',
			onReading: () => {},
			onPatch: () => {},
			...props
		}
	});
	return target;
}

/**
 * Mounts the cluster inside a wrapper that stops pointerdown, as the Stage's `.stage-actions`
 * does, so a press on the cluster never reaches the window in the bubble phase.
 */
function mountControlInStoppingCluster(): HTMLElement {
	target = document.createElement('div');
	const wrapper = target;
	wrapper.addEventListener('pointerdown', (event) => event.stopPropagation());
	const inner = document.createElement('div');
	wrapper.append(inner);
	document.body.append(wrapper);
	component = mount(StageDraftingControl, {
		target: inner,
		props: {
			drafting: { grid: true, snap: true, snapSuspended: false },
			reading: 'plan' as const,
			gridWord: 'Grid',
			snapWord: 'Snap',
			onReading: () => {},
			onPatch: () => {}
		}
	});
	return wrapper;
}

function press(node: Element | Document): void {
	node.dispatchEvent(new Event('pointerdown', { bubbles: true }));
}

describe('R217.S20 — the ⚙ closes on a press outside it, as the Head disclosures do', () => {
	it('closes on a press outside the ⚙ and its panel', async () => {
		const host = mountControl();
		const gear = host.querySelector<HTMLButtonElement>('[data-stage-viewing]')!;
		gear.click();
		await tick();
		expect(gear.getAttribute('aria-expanded')).toBe('true');
		press(document.body);
		await tick();
		expect(gear.getAttribute('aria-expanded')).toBe('false');
		expect(host.querySelector<HTMLElement>('[data-stage-viewing-panel]')!.hidden).toBe(true);
	});

	it('stays open for a press on the ⚙ itself or inside its panel', async () => {
		const host = mountControl();
		const gear = host.querySelector<HTMLButtonElement>('[data-stage-viewing]')!;
		gear.click();
		await tick();
		press(host.querySelector<HTMLElement>('[data-stage-viewing-panel] .group-title')!);
		await tick();
		expect(gear.getAttribute('aria-expanded')).toBe('true');
		press(gear);
		await tick();
		expect(gear.getAttribute('aria-expanded')).toBe('true');
	});

	it('closes on a press on another cluster control, even where the cluster stops pointer events', async () => {
		const host = mountControlInStoppingCluster();
		const gear = host.querySelector<HTMLButtonElement>('[data-stage-viewing]')!;
		gear.click();
		await tick();
		press(host.querySelector<HTMLButtonElement>('[data-drafting-grid]')!);
		await tick();
		expect(gear.getAttribute('aria-expanded')).toBe('false');
	});

	it('does nothing to a closed panel', async () => {
		const host = mountControl();
		const gear = host.querySelector<HTMLButtonElement>('[data-stage-viewing]')!;
		press(document.body);
		await tick();
		expect(gear.getAttribute('aria-expanded')).toBe('false');
	});
});

describe('R217.S20 — the Head holds no viewing or drafting value', () => {
	it('renders no application menu, no Grid interval and no Snap-to-grid control', () => {
		const host = mountHead();
		expect(host.querySelector('.app-menu')).toBeNull();
		expect(host.querySelector('[data-head-motion]')).toBeNull();
		expect(host.querySelectorAll('select')).toHaveLength(0);
		expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
		const text = host.textContent ?? '';
		expect(text).not.toContain('Grid interval');
		expect(text).not.toContain('Snap to the grid');
		expect(text).not.toContain('Museum Editor');
		expect(text).toContain('Biskiq');
	});

	it('keeps the Head to one row of named permanent homes', () => {
		const host = mountHead();
		// Viewing preferences and Keys are never Head controls; project utilities sit under the name.
		expect(host.querySelector('[data-stage-viewing]')).toBeNull();
		expect(host.querySelector('[data-head-project-menu]')).not.toBeNull();
		expect(host.querySelector('[data-head-project-menu] [data-head-download]')).not.toBeNull();
		expect(host.querySelector('[data-head-project-menu] [data-head-source]')).not.toBeNull();
		expect(host.querySelector('.technical')).toBeNull();
	});
});

describe('R217.S20 — the Stage ⚙ holds viewing preferences and no drafting value', () => {
	it('opens a panel with the four viewing preferences and nothing drafting', async () => {
		const host = mountControl();
		const gear = host.querySelector<HTMLButtonElement>('[data-stage-viewing]')!;
		expect(gear.getAttribute('aria-expanded')).toBe('false');
		gear.click();
		await tick();
		expect(gear.getAttribute('aria-expanded')).toBe('true');

		const panel = host.querySelector<HTMLElement>('[data-stage-viewing-panel]')!;
		expect(panel.hidden).toBe(false);
		// Each label names its own preference; the option words are checked separately.
		const labels = [...panel.querySelectorAll('label > span')].map((span) => span.textContent?.trim());
		expect(labels).toEqual(['2D appearance', 'Height Sheet', 'Reduce motion', 'Editor motion speed']);
		const optionWords = [...panel.querySelectorAll('select')].map((select) =>
			[...select.options].map((option) => option.textContent?.trim())
		);
		expect(optionWords).toEqual([
			['Paper', 'Shaded'],
			['Right', 'Left'],
			['Slow', 'Normal', 'Fast']
		]);
		const text = panel.textContent ?? '';
		expect(text).not.toContain('Grid interval');
		expect(text).not.toContain('Snap to the grid');
		expect(panel.querySelector('option[value="automatic"]')).toBeNull();
	});

	it('leaves Grid and Snap as the cluster words, never as ⚙ values', async () => {
		const host = mountControl();
		host.querySelector<HTMLButtonElement>('[data-stage-viewing]')!.click();
		await tick();
		expect(host.querySelector('[data-drafting-grid]')!.textContent?.trim()).toBe('Grid');
		expect(host.querySelector('[data-drafting-snap]')!.textContent?.trim()).toBe('Snap');
		expect(host.querySelector('[data-stage-viewing-panel] [data-drafting-grid]')).toBeNull();
		expect(host.querySelector('[data-stage-viewing-panel] [data-drafting-snap]')).toBeNull();
	});

	it('writes each viewing preference through its own handler', async () => {
		const onPlanAppearance = vi.fn();
		const onHeightSheetSide = vi.fn();
		const onToggleReducedMotion = vi.fn();
		const onMotionSpeed = vi.fn();
		const host = mountControl({ onPlanAppearance, onHeightSheetSide, onToggleReducedMotion, onMotionSpeed });
		host.querySelector<HTMLButtonElement>('[data-stage-viewing]')!.click();
		await tick();

		const selects = host.querySelectorAll<HTMLSelectElement>('[data-stage-viewing-panel] select');
		selects[0]!.value = 'shaded';
		selects[0]!.dispatchEvent(new Event('change', { bubbles: true }));
		selects[1]!.value = 'left';
		selects[1]!.dispatchEvent(new Event('change', { bubbles: true }));
		selects[2]!.value = 'fast';
		selects[2]!.dispatchEvent(new Event('change', { bubbles: true }));
		host.querySelector<HTMLInputElement>('[data-stage-viewing-panel] input[type="checkbox"]')!.dispatchEvent(
			new Event('change', { bubbles: true })
		);

		expect(onPlanAppearance).toHaveBeenCalledWith('shaded');
		expect(onHeightSheetSide).toHaveBeenCalledWith('left');
		expect(onMotionSpeed).toHaveBeenCalledWith('fast');
		expect(onToggleReducedMotion).toHaveBeenCalledTimes(1);
	});

	it('closes on Escape, returns focus to the ⚙, and keeps the Escape from the Stage', async () => {
		const host = mountControl();
		const gear = host.querySelector<HTMLButtonElement>('[data-stage-viewing]')!;
		gear.click();
		await tick();
		const stageEscape = vi.fn();
		window.addEventListener('keydown', stageEscape);
		gear.focus();
		gear.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await tick();
		window.removeEventListener('keydown', stageEscape);

		expect(gear.getAttribute('aria-expanded')).toBe('false');
		expect(host.querySelector<HTMLElement>('[data-stage-viewing-panel]')!.hidden).toBe(true);
		expect(document.activeElement).toBe(gear);
		expect(stageEscape).not.toHaveBeenCalled();
	});

	it('reflects the viewing values it is handed', async () => {
		const host = mountControl({
			planAppearance: 'shaded',
			heightSheetSide: 'left',
			reducedMotion: true,
			motionSpeed: 'slow'
		});
		host.querySelector<HTMLButtonElement>('[data-stage-viewing]')!.click();
		await tick();
		const selects = host.querySelectorAll<HTMLSelectElement>('[data-stage-viewing-panel] select');
		expect(selects[0]!.value).toBe('shaded');
		expect(selects[1]!.value).toBe('left');
		expect(selects[2]!.value).toBe('slow');
		expect(host.querySelector<HTMLInputElement>('[data-stage-viewing-panel] input[type="checkbox"]')!.checked).toBe(true);
	});
});
