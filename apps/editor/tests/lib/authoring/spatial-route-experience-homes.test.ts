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
import { CAMERA_UNIT_FORMAT_VERSION } from '@portfolio/project-model/units';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
import { CONNECTIONS, EXPERIENCE, VIEWS } from '../experience/fixtures';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

const harness = vi.hoisted(() => ({ document: null as unknown, facade: null as unknown }));

vi.mock('$lib/authoring/stage/stage-facade', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/stage-facade')>();
	return {
		...actual,
		createStageFacade: (...args: Parameters<typeof actual.createStageFacade>) => {
			const facade = actual.createStageFacade(...args);
			harness.facade = facade;
			return facade;
		}
	};
});

vi.mock('$lib/authoring/stage/shell/EditorHead.svelte', async () => ({ default: (await import('./fixtures/HeadProbe.svelte')).default }));
vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({ default: (await import('./fixtures/StageCanvasProbe.svelte')).default }));
vi.mock('$lib/visitor/VisitorPreviewSurface.svelte', async () => ({ default: (await import('./fixtures/StageCanvasProbe.svelte')).default }));
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
const facade = () => harness.facade as StageFacade;

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

async function mountRoute(source?: unknown): Promise<void> {
	harness.document = source ?? await createUnitProject({ id: 'project-1', name: 'Experience homes', layout: buildStarterEnclosureLayout() });
	target = document.createElement('div');
	document.body.append(target);
	component = mount(Page, { target });
	await vi.waitFor(() => expect(target.querySelector('[data-testid="stage-canvas"]')).not.toBeNull());
	await frame();
	control('2D').click();
	await frame();
}

async function remountRouteWith(source: unknown): Promise<void> {
	unmount(component);
	target.remove();
	await mountRoute(source);
}

async function seededExperienceProject(): Promise<unknown> {
	return createUnitProject({
		id: 'project-1',
		name: 'Experience homes',
		layout: buildStarterEnclosureLayout(),
		camera: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: VIEWS, connections: CONNECTIONS },
		experience: EXPERIENCE
	});
}

async function selectWallOnStage(): Promise<void> {
	const stage = target.querySelector<HTMLElement>('.stage')!;
	stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true }));
	await frame();
	const stageFacade = facade();
	const evaluationId = stageFacade.evaluationId();
	if (evaluationId === null) throw new Error('the Stage has no evaluation');
	const projected = stageFacade.projectWorld([3.5, 0, -4], evaluationId);
	if (projected.kind !== 'projected') throw new Error('the starter Wall is not projected');
	const [x, y] = projected.css;
	const point = [x, y] as const;
	for (const type of ['pointerdown', 'pointerup', 'click']) {
		const event = new MouseEvent(type, { bubbles: true, clientX: point[0], clientY: point[1] });
		Object.defineProperty(event, 'pointerId', { value: 1 });
		Object.defineProperty(event, 'pointerType', { value: 'mouse' });
		stage.dispatchEvent(event);
	}
	await frame();
	expect(facade().selectionState().primary?.subject.kind).toBe('wall');
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

	it('offers a saved sole Guide before Guide focus and shows its Stops after selection', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		dockGuide().click();
		await frame();

		const panel = guidePanel()!;
		const picker = panel.querySelector<HTMLSelectElement>('select')!;
		expect([...picker.options].map((option) => option.textContent?.trim())).toEqual(['None', 'Main']);
		expect(panel.textContent).toContain('No Guide is selected');
		expect(panel.textContent).not.toContain('This Experience carries no Guide');

		picker.value = 'guide-1';
		picker.dispatchEvent(new Event('change', { bubbles: true }));
		await frame();
		expect(panel.querySelectorAll('ol[aria-label="Stops"] button.row')).toHaveLength(2);
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

	it('keeps Create Experience available after the first and preserves multi-Experience switching', async () => {
		await enterExperience();
		control('Create Experience').click();
		await vi.waitFor(() => expect(target.querySelector('[aria-current="location"]')?.textContent).toBe('Experience 1'));

		control('Create Experience').click();
		await vi.waitFor(() => expect(target.querySelector('[aria-current="location"]')?.textContent).toBe('Experience 2'));
		const switcher = target.querySelector<HTMLDetailsElement>('.siblings')!;
		expect(switcher).not.toBeNull();
		switcher.querySelector('summary')!.click();
		await frame();
		const first = [...switcher.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Experience 1');
		expect(first).toBeDefined();
		first!.click();
		await frame();
		expect(target.querySelector('[aria-current="location"]')?.textContent).toBe('Experience 1');
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

	it('keeps the Stage Wall in the Card after a refused Capture without changing Preview focus', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		target.querySelector<HTMLButtonElement>('[data-presentation-id="presentation-1"] .item-row')!.click();
		await frame();
		expect(target.querySelector('aside.card .kind')?.textContent).toBe('Presentation');
		const focusBefore = experienceFocus.read();
		expect(focusBefore.presentationId).toBe('presentation-1');

		await selectWallOnStage();

		expect(target.querySelector('aside.card .kind')?.textContent).toBe('Wall');
		control('Capture').click();
		await vi.waitFor(() =>
			expect(target.querySelector('.experience-feedback')?.textContent).toContain('Capture needs the 3D reading')
		);
		expect(target.querySelectorAll('[data-presentation-id]')).toHaveLength(2);
		expect(target.querySelector('aside.card .kind')?.textContent).toBe('Wall');
		expect(experienceFocus.read()).toEqual(focusBefore);
	});

	it('shows the selected Stage Wall after Stop focus while retaining the Guide and Stop for Preview', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		dockGuide().click();
		await frame();
		const panel = guidePanel()!;
		const picker = panel.querySelector<HTMLSelectElement>('select')!;
		picker.value = 'guide-1';
		picker.dispatchEvent(new Event('change', { bubbles: true }));
		await frame();
		const stop = panel.querySelector<HTMLButtonElement>('ol[aria-label="Stops"] button.row')!;
		stop.click();
		await frame();
		expect(target.querySelector('aside.card .kind')?.textContent).toBe('Stop');
		const focusBefore = experienceFocus.read();
		expect(focusBefore.guideId).toBe('guide-1');
		expect(focusBefore.stopId).toBe('stop-1');

		await selectWallOnStage();

		expect(target.querySelector('aside.card .kind')?.textContent).toBe('Wall');
		expect(experienceFocus.read()).toEqual(focusBefore);
		expect(panel.querySelector('ol[aria-label="Stops"] button.row[aria-pressed="true"]')?.textContent).toContain('Piano');
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
