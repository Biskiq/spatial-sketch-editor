// @vitest-environment jsdom
/**
 * R217.S25 — the Experience lens works in the shared homes.
 *
 * The route is mounted for real (boot, facade, acceptance, Stage), with the Head and the
 * Stage canvas doubled as in the gesture suite. The Experience lens must draw no full-surface
 * overlay; its Index groups, its Card and its lower edge are the shared homes; the Guide is
 * closed until it is opened, and closed again on each entry; and Capture and Create go
 * through the one acceptance port.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

const harness = vi.hoisted(() => ({ document: null as unknown }));

vi.mock('$lib/authoring/stage/shell/EditorHead.svelte', async () => ({ default: (await import('./fixtures/HeadProbe.svelte')).default }));
vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({ default: (await import('./fixtures/StageCanvasProbe.svelte')).default }));
vi.mock('$lib/platform/project-persistence', async (original) => {
	const actual = await original<typeof import('$lib/platform/project-persistence')>();
	return {
		...actual,
		createProjectAuth: () => ({ getSession: async () => ({ authenticated: false }), signIn() { }, async signOut() { } }),
		createProjectApi: () => ({
			async loadProject() {
				return {
					document: harness.document,
					savedBaseToken: 'base',
					savedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
					savedSourceContentId: 'content-1'
				};
			}
		})
	};
});

const RECT = { left: 352, top: 73, width: 928, height: 720, right: 1280, bottom: 793, x: 352, y: 73, toJSON() { } };

let component: ReturnType<typeof mount>;
let target: HTMLElement;
let frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let captureDescriptor: PropertyDescriptor | undefined;

async function frame(): Promise<void> {
	await tick();
	const pending = [...frames.values()];
	frames.clear();
	for (const callback of pending) callback(performance.now());
	await tick();
}

/** The one control with this accessible name or text, in the mounted route. */
function control(text: string): HTMLButtonElement {
	const wanted = text.replace(/\s+/g, '').toLowerCase();
	const found = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => (button.getAttribute('aria-label') ?? button.textContent ?? '').replace(/\s+/g, '').toLowerCase() === wanted
	);
	if (!found) throw new Error(`Missing button ${text}`);
	return found;
}

function dockGuide(): HTMLButtonElement {
	return target.querySelector<HTMLButtonElement>('[data-experience-dock] [data-dock-tool="guide"]')!;
}

function guidePanel(): Element | null {
	return target.querySelector('[data-stage-instrument="experience-guide"]');
}

async function mountRoute(): Promise<void> {
	harness.document = await createUnitProject({ id: 'project-1', name: 'Experience homes', layout: buildStarterEnclosureLayout() });
	target = document.createElement('div');
	document.body.append(target);
	component = mount(Page, { target });
	await vi.waitFor(() => expect(target.querySelector('[data-testid="stage-canvas"]')).not.toBeNull());
	await frame();
	control('2D').click();
	await frame();
}

async function enterExperience(): Promise<void> {
	target.querySelector<HTMLButtonElement>('[data-testid="lens-experience"]')!.click();
	await frame();
	// The lens mounts its controller once the admitted source is bound; wait for its Index groups.
	await vi.waitFor(() => expect(target.querySelector('#index-presentations')).not.toBeNull());
}

beforeEach(async () => {
	frames = new Map();
	frameId = 0;
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		frames.set(++frameId, cb);
		return frameId;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
	vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion'), addEventListener() { }, removeEventListener() { } }));
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(RECT.width);
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(RECT.height);
	captureDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'setPointerCapture');
	Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: () => { } });
	await mountRoute();
});

afterEach(() => {
	unmount(component);
	target.remove();
	if (captureDescriptor === undefined) Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
	else Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', captureDescriptor);
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('R217.S25 — the Experience lens mounts the shared homes', () => {
	it('draws no full-surface overlay, and the Head is the only lens control', async () => {
		await enterExperience();
		expect(target.querySelector('.lens-surface')).toBeNull();
		expect(target.querySelector('[aria-label="Experience lens"]')).toBeNull();
		// The Head's lens pair is the only place a lens is chosen. The Stage's own viewing
		// settings select is World chrome in both lenses; no select offers an Experience.
		expect(target.querySelectorAll('[data-testid^="lens-"]')).toHaveLength(2);
		const pickers = [...target.querySelectorAll('select')].filter((select) =>
			[...select.options].some((option) => /experience|preview/i.test(option.textContent ?? ''))
		);
		expect(pickers).toHaveLength(0);
	});

	it('shows the Presentations group in the Index, with the explicit create when no Experience exists', async () => {
		await enterExperience();
		expect(target.querySelector('input[aria-label="Filter presentations"]')).not.toBeNull();
		expect(target.textContent).toContain('This world has no Experience yet');
		expect(control('Create Experience')).toBeDefined();
		// The dock's own keys: Select, Capture and Guide, and no World tool key.
		const keys = [...target.querySelectorAll<HTMLElement>('[data-experience-dock] [data-dock-tool]')].map((key) => key.dataset.dockTool);
		expect(keys).toEqual(['select', 'capture', 'guide']);
		expect(target.querySelector('[data-stage-dock]')).toBeNull();
	});

	it('keeps the Guide closed by default, opens it from the dock, and closes it from its own control', async () => {
		await enterExperience();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('false');
		expect(guidePanel()).toBeNull();

		dockGuide().click();
		await frame();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('true');
		expect(guidePanel()?.textContent).toContain('Create an Experience in the Index');

		control('Close Guide').click();
		await frame();
		expect(guidePanel()).toBeNull();
	});

	it('closes the Guide again on each entry to the Experience lens', async () => {
		await enterExperience();
		dockGuide().click();
		await frame();
		expect(guidePanel()).not.toBeNull();

		target.querySelector<HTMLButtonElement>('[data-testid="lens-world"]')!.click();
		await frame();
		expect(target.querySelector('[data-experience-dock]')).toBeNull();

		await enterExperience();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('false');
		expect(guidePanel()).toBeNull();
	});

	it('creates the Experience through the Index, and the Index then shows its Guide group', async () => {
		await enterExperience();
		control('Create Experience').click();
		await vi.waitFor(() => expect(target.querySelector('[aria-current="location"]')?.textContent).toBe('Experience 1'));
		expect(target.querySelector('#index-guide')).not.toBeNull();
		expect(target.querySelector('.guide-toggle')?.textContent).toContain('No Guide yet');
		expect(target.textContent).toContain('No Presentation yet. Capture a View to make one.');
	});

	it('refuses Capture outside the 3D reading, and writes no View', async () => {
		await enterExperience();
		control('Create Experience').click();
		await vi.waitFor(() => expect(target.querySelector('[aria-current="location"]')?.textContent).toBe('Experience 1'));

		control('Capture').click();
		await vi.waitFor(() =>
			expect(target.querySelector('.experience-feedback')?.textContent).toContain('Capture needs the 3D reading')
		);
		expect(target.querySelectorAll('[data-presentation-id]')).toHaveLength(0);
		expect(target.textContent).toContain('No Presentation yet. Capture a View to make one.');
	});

	it('captures a Presentation in 3D and shows it through the shared Card, with its own writer and no `•••`', async () => {
		await enterExperience();
		control('Create Experience').click();
		await vi.waitFor(() => expect(target.querySelector('[aria-current="location"]')?.textContent).toBe('Experience 1'));
		control('3D').click();
		await frame();

		control('Capture').click();
		await vi.waitFor(() => expect(target.querySelectorAll('[data-presentation-id]')).toHaveLength(1));
		await frame();

		const card = target.querySelector<HTMLElement>('aside.card')!;
		expect(card).not.toBeNull();
		expect(card.querySelector('.kind')?.textContent).toBe('Presentation');
		expect(card.querySelector('[data-experience-writer="presentation"]')).not.toBeNull();
		expect(card.textContent).toContain('Save Presentation');
		// A Presentation has no `•••` functions and no Bring into view: the Card holds only what it owns.
		expect(card.querySelector('[aria-label="Subject actions"]')).toBeNull();
		expect(card.querySelector('[aria-label="Bring into view"]')).toBeNull();
		expect(card.querySelector('[data-card-more]')).not.toBeNull();
		expect(target.querySelector('[data-presentation-id] [aria-current="true"]')).not.toBeNull();
	});

	it('offers the first Guide once a Presentation exists and no Guide does, from the Guide panel', async () => {
		await enterExperience();
		control('Create Experience').click();
		await vi.waitFor(() => expect(target.querySelector('[aria-current="location"]')?.textContent).toBe('Experience 1'));
		control('3D').click();
		await frame();
		control('Capture').click();
		await vi.waitFor(() => expect(target.querySelectorAll('[data-presentation-id]')).toHaveLength(1));

		dockGuide().click();
		await frame();
		expect(guidePanel()?.querySelector('[aria-label="First Guide"]')).not.toBeNull();
		expect(guidePanel()?.textContent).toContain('This Experience carries no Guide');
		expect(target.querySelector('.guide-toggle')?.textContent).toContain('No Guide yet');
	});

	it('creates the first Guide from its panel, and selecting its Stop moves the Card to the Stop', async () => {
		await enterExperience();
		control('Create Experience').click();
		await vi.waitFor(() => expect(target.querySelector('[aria-current="location"]')?.textContent).toBe('Experience 1'));
		control('3D').click();
		await frame();
		control('Capture').click();
		await vi.waitFor(() => expect(target.querySelectorAll('[data-presentation-id]')).toHaveLength(1));

		dockGuide().click();
		await frame();
		const label = guidePanel()!.querySelector<HTMLInputElement>('[aria-label="First Guide"] input')!;
		label.value = 'Tour';
		label.dispatchEvent(new Event('input', { bubbles: true }));
		control('Create first Guide').click();
		await vi.waitFor(() => expect(guidePanel()?.querySelectorAll('ol[aria-label="Stops"] li button.row')).toHaveLength(1));
		expect(target.querySelector('.guide-toggle')?.textContent).toContain('Tour');

		// The Stop is the focused subject: the Card shows it, through its own writer.
		const stopRow = guidePanel()!.querySelector<HTMLButtonElement>('ol[aria-label="Stops"] button.row')!;
		stopRow.click();
		await frame();
		const card = target.querySelector<HTMLElement>('aside.card')!;
		expect(card.querySelector('.kind')?.textContent).toBe('Stop');
		expect(card.querySelector('[data-experience-writer="stop"]')).not.toBeNull();
		expect(card.textContent).toContain('Save Stop');
		expect(card.querySelector('[aria-label="Subject actions"]')).toBeNull();
	});
});
