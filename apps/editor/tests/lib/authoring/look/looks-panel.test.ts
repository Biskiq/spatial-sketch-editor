// @vitest-environment jsdom
/**
 * T2.S6 — the Looks tab has no inert control.
 *
 * Every visible control is exercised against a fake Look seam: a Look tile
 * applies, a Treatment choice sets, Previous appears only when captured, and the
 * palette row either explains itself, offers the preview, or shows the preview's
 * Adopt/Cancel. The panel itself owns no Esc ladder; the Sky popover's existing
 * one still closes it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import {
	SCENE_LOOK_STARTS,
	skyFromPreset,
	type SceneLookStart
} from '@portfolio/project-model/units';
import type { PaletteAdoptionPlan } from '@portfolio/project-model/scene-planning';
import LooksPanel from '$lib/authoring/environment/LooksPanel.svelte';
import type { LookAuthoring } from '$lib/authoring/look/look-authoring.svelte';

const RISO = SCENE_LOOK_STARTS.find((look) => look.id === 'riso')!;
const CLAY = SCENE_LOOK_STARTS.find((look) => look.id === 'clay')!;

const PLAN: PaletteAdoptionPlan = {
	slots: 1,
	rows: [
		{
			color: '#ee6c4d',
			slotId: 'coral',
			slotName: 'Coral',
			slotColor: '#ee6c4d',
			finishes: 2,
			objects: 3
		}
	],
	skipped: { inherited: 1, imageTints: 2 }
};

function fake(overrides: Partial<Record<keyof LookAuthoring, unknown>> = {}): LookAuthoring {
	const base = {
		looks: SCENE_LOOK_STARTS as readonly SceneLookStart[],
		activeLook: null,
		treatment: undefined,
		previousEnvironment: null,
		palette: [],
		adoptionPlan: null,
		adoptionPreview: null,
		busy: false,
		canAdopt: false,
		applyLook: vi.fn(),
		setTreatment: vi.fn(),
		restorePrevious: vi.fn(),
		beginAdoption: vi.fn(),
		cancelAdoption: vi.fn(),
		adoptPalette: vi.fn()
	};
	return { ...base, ...overrides } as unknown as LookAuthoring;
}

let mounted: ReturnType<typeof mount> | null = null;
afterEach(() => {
	if (mounted !== null) unmount(mounted);
	mounted = null;
	document.body.innerHTML = '';
});

function render(look: LookAuthoring): HTMLElement {
	mounted = mount(LooksPanel, { target: document.body, props: { look } });
	return document.body;
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
	const found = [...root.querySelectorAll('button')].find(
		(candidate) => candidate.textContent?.trim() === label
	);
	if (found === undefined) throw new Error(`no button ${label}`);
	return found;
}

/** A Look tile is labelled by its `strong`, not by the summary beside it. */
function lookTile(root: HTMLElement, label: string): HTMLButtonElement {
	const strong = [...root.querySelectorAll('button strong')].find(
		(candidate) => candidate.textContent === label
	);
	const tile = strong?.closest('button');
	if (tile === undefined || tile === null) throw new Error(`no Look tile ${label}`);
	return tile;
}

describe('the Looks tab', () => {
	it('applies the pressed Look and every other Look tile', async () => {
		const look = fake({ activeLook: RISO });
		const root = render(look);
		await tick();
		expect(root.textContent).toContain('Riso');
		expect(root.textContent).toContain(CLAY.summary);
		expect(lookTile(root, 'Riso').getAttribute('aria-pressed')).toBe('true');
		expect(lookTile(root, 'Clay').getAttribute('aria-pressed')).toBe('false');
		lookTile(root, 'Clay').click();
		expect(look.applyLook).toHaveBeenCalledWith('clay');
	});

	it('switches Treatment through one segmented control', async () => {
		const look = fake({ treatment: 'clay' });
		const root = render(look);
		await tick();
		expect(button(root, 'Clay').getAttribute('aria-pressed')).toBe('true');
		expect(root.textContent).toContain('one matte clay surface');
		button(root, 'Natural').click();
		expect(look.setTreatment).toHaveBeenCalledWith('natural');
	});

	it('offers Previous only when an environment was captured', async () => {
		const without = fake();
		const first = render(without);
		await tick();
		expect(first.textContent).not.toContain('Previous');
		unmount(mounted!);
		mounted = null;

		const look = fake({ previousEnvironment: { sky: skyFromPreset('dusk', 0), treatment: undefined, sessionKey: 's' } });
		const root = render(look);
		await tick();
		button(root, 'Previous').click();
		expect(look.restorePrevious).toHaveBeenCalled();
	});

	it('explains an empty palette and names what a Look would bring', async () => {
		const root = render(fake({ activeLook: RISO }));
		await tick();
		expect(root.textContent).toContain('No palette yet');
		expect(root.textContent).toContain('Coral, Ink, Gold');
		expect([...root.querySelectorAll('button')].some((entry) => entry.textContent?.includes('Adopt'))).toBe(false);
	});

	it('opens the preview without writing and offers Adopt and Cancel', async () => {
		const look = fake({
			palette: [{ id: 'coral', name: 'Coral', color: '#ee6c4d' }],
			adoptionPlan: PLAN,
			canAdopt: true
		});
		const root = render(look);
		await tick();
		expect(root.textContent).toContain('1 literal colour can follow this palette.');
		button(root, 'Adopt palette…').click();
		expect(look.beginAdoption).toHaveBeenCalled();
		expect(look.adoptPalette).not.toHaveBeenCalled();

		unmount(mounted!);
		mounted = null;
		const preview = fake({ palette: [{ id: 'coral', name: 'Coral', color: '#ee6c4d' }], adoptionPreview: PLAN });
		const previewRoot = render(preview);
		await tick();
		expect(previewRoot.textContent).toContain('#ee6c4d → Coral');
		expect(previewRoot.textContent).toContain('2 Finishes · 3 objects');
		expect(previewRoot.textContent).toContain('2 image-tinted');
		button(previewRoot, 'Adopt').click();
		button(previewRoot, 'Cancel').click();
		expect(preview.adoptPalette).toHaveBeenCalled();
		expect(preview.cancelAdoption).toHaveBeenCalled();
	});

	it('says when every Finish already follows the palette', async () => {
		const root = render(fake({ palette: [{ id: 'coral', name: 'Coral', color: '#ee6c4d' }], adoptionPlan: { ...PLAN, rows: [] } }));
		await tick();
		expect(root.textContent).toContain('Every Finish already follows the palette.');
	});
});
