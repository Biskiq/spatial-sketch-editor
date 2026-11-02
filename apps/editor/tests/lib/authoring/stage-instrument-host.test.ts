// @vitest-environment jsdom
/**
 * R217.S23 — the instrument row's facts are reachable without hover.
 *
 * The adapter's facts (the Ink Finish keys, the Opening host rule) carry real guidance. A title
 * attribute is pointer-only, so the host names them as the instrument's accessible description and
 * offers a focusable info control that reveals them as a visible list. This suite mounts the host
 * and drives those controls, so a regression to a hover-only title fails here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { StageInstrumentContent } from '$lib/authoring/stage/stage-facade';
import StageInstrumentHost from '$lib/authoring/stage/shell/StageInstrumentHost.svelte';

const FACTS = [
	{ label: 'Reading', value: 'Straight Wall' },
	{ label: 'Finish', value: 'Enter · Close ring from the start point · Esc cancels the chain' }
];
const TASK = { kind: 'layout-ink', label: 'Ink · Wall', targetLabel: null };

let component: ReturnType<typeof mount> | null = null;
let target: HTMLElement | null = null;

afterEach(() => {
	if (component !== null) unmount(component);
	target?.remove();
	component = null;
	target = null;
});

async function mountHost(instrument: StageInstrumentContent | null, onClose = vi.fn()): Promise<HTMLElement> {
	target = document.createElement('div');
	document.body.append(target);
	component = mount(StageInstrumentHost, { target, props: { task: TASK, onClose, instrument } });
	await tick();
	return target;
}

describe('R217.S23 — instrument facts reachable without hover', () => {
	it('names the adapter facts as the instrument description, and keeps them out of a hover-only title', async () => {
		const root = await mountHost({ summary: 'Ink · Wall', facts: FACTS } as unknown as StageInstrumentContent);
		const section = root.querySelector<HTMLElement>('[data-stage-instrument]');
		const describedBy = section?.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		const description = root.querySelector<HTMLElement>(`#${describedBy}`);
		expect(description?.textContent).toContain('Straight Wall');
		expect(description?.textContent).toContain('Enter · Close ring from the start point · Esc cancels the chain');
		// The heading carries no title attribute: the facts are not available only on hover.
		expect(root.querySelector('h2.title')?.hasAttribute('title')).toBe(false);
	});

	it('reveals the facts from a focusable info control, which says whether they are open', async () => {
		const root = await mountHost({ summary: 'Ink · Wall', facts: FACTS } as unknown as StageInstrumentContent);
		const info = root.querySelector<HTMLButtonElement>('button.about');
		expect(info).not.toBeNull();
		expect(info!.getAttribute('aria-label')).toBe('About Ink · Wall');
		expect(info!.getAttribute('aria-expanded')).toBe('false');
		expect(root.querySelector('dl.about-facts')).toBeNull();

		info!.click();
		await tick();
		expect(info!.getAttribute('aria-expanded')).toBe('true');
		const list = root.querySelector<HTMLElement>(`#${info!.getAttribute('aria-controls')}`);
		expect(list?.tagName).toBe('DL');
		expect([...(list?.querySelectorAll('dt') ?? [])].map((term) => term.textContent)).toEqual(['Reading', 'Finish']);
		expect(list?.querySelectorAll('dd')[1]?.textContent).toBe('Enter · Close ring from the start point · Esc cancels the chain');

		info!.click();
		await tick();
		expect(info!.getAttribute('aria-expanded')).toBe('false');
		expect(root.querySelector('dl.about-facts')).toBeNull();
	});

	it('draws no info control for an instrument with no facts, and Close still closes it', async () => {
		const onClose = vi.fn();
		const root = await mountHost({ summary: 'Objects', facts: [] } as unknown as StageInstrumentContent, onClose);
		expect(root.querySelector('button.about')).toBeNull();
		expect(root.querySelector('section')?.hasAttribute('aria-describedby')).toBe(false);
		root.querySelector<HTMLButtonElement>('button.close')!.click();
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
