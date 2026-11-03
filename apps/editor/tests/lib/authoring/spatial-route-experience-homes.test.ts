// @vitest-environment jsdom
/**
 * R217.S25 — the Experience lens works in the shared homes.
 *
 * The route is mounted for real (boot, facade, acceptance, Stage), with the Head and the
 * Stage canvas doubled as in the gesture suite. The Experience lens draws no full-surface
 * overlay; its Index groups, its one Card and its lower edge are the shared homes. One Card
 * selection (D10): an Index row, a Stage pick or a Card link replaces the subject, and a
 * revision-only change never clears it. The Guide is closed on every lens entry; the Index
 * Guide row opens it, the dock key shows or hides it and × closes it; Esc clears the
 * selection first and then closes the Guide. Capture (D1, D2) never adds a Stop and never
 * binds a subject unless Present this asked for one. Undo restores the source through the
 * acceptance host.
 *
 * The Head double (`fixtures/HeadProbe.svelte`) renders neither Preview nor Undo, so Preview's
 * single Head entry is checked against the Head's own source, and Undo is driven through the
 * acceptance host the route built (captured by the wrapper below).
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { CAMERA_UNIT_FORMAT_VERSION, createEmptyUnitSceneDocument } from '@portfolio/project-model/units';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { primitiveEntity } from './__fixtures__/f4-current-source-fixtures';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
import { CONNECTIONS, EXPERIENCE, VIEWS } from '../experience/fixtures';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

const harness = vi.hoisted(() => ({
	document: null as unknown,
	facade: null as unknown,
	acceptance: null as unknown
}));

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

vi.mock('$lib/authoring/stage/host-acceptance', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/host-acceptance')>();
	return {
		...actual,
		createStageAcceptanceHost: (...args: Parameters<typeof actual.createStageAcceptanceHost>) => {
			const host = actual.createStageAcceptanceHost(...args);
			harness.acceptance = host;
			return host;
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
const acceptance = () => harness.acceptance as { undo(): Promise<{ kind: string }> };

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

function dockKey(tool: string): HTMLButtonElement {
	return target.querySelector<HTMLButtonElement>(`[data-experience-dock] [data-dock-tool="${tool}"]`)!;
}

function dockGuide(): HTMLButtonElement {
	return dockKey('guide');
}

/** The Guide instrument, rendered in the lower edge while it is open. */
function guidePanel(): Element | null {
	return target.querySelector('[data-experience-guide]');
}

/** The one shared Card, or null when no subject is shown. */
function card(): HTMLElement | null {
	return target.querySelector<HTMLElement>('aside.card');
}

function cardKind(): string | null {
	return card()?.querySelector('.kind')?.textContent?.trim() ?? null;
}

/** The Index's Experience crumb: its name, or null before any Experience exists. */
function experienceName(): string | null {
	return target.querySelector('[aria-current="location"]')?.textContent ?? null;
}

function presentationRow(presentationId: string): HTMLButtonElement | null {
	return target.querySelector<HTMLButtonElement>(`[data-presentation-id="${presentationId}"] .presentation-row`);
}

function presentationRows(): NodeListOf<Element> {
	return target.querySelectorAll('[data-presentation-id]');
}

function guideRow(guideId: string): HTMLButtonElement | null {
	return target.querySelector<HTMLButtonElement>(`[data-guide-id="${guideId}"] .guide-row`);
}

async function pressEscape(): Promise<void> {
	target.querySelector<HTMLElement>('.stage')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
	await frame();
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

/** The starter Layout, the Camera's two Views, a Presentation pair with one Guide, and one Scene entity. */
async function seededExperienceProject(): Promise<unknown> {
	return createUnitProject({
		id: 'project-1',
		name: 'Experience homes',
		layout: buildStarterEnclosureLayout(),
		scene: { ...createEmptyUnitSceneDocument(), entities: [primitiveEntity(0)] },
		camera: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: VIEWS, connections: CONNECTIONS },
		experience: EXPERIENCE
	});
}

async function enterExperience(): Promise<void> {
	target.querySelector<HTMLButtonElement>('[data-testid="lens-experience"]')!.click();
	await frame();
	// The lens mounts its controller once the admitted source is bound; wait for its Index groups.
	await vi.waitFor(() => expect(target.querySelector('#index-presentations')).not.toBeNull());
}

/** Create the first Experience through the Index's crumb menu (New Experience). */
async function createExperience(): Promise<void> {
	control('New Experience').click();
	await vi.waitFor(() => expect(experienceName()).toBe('Experience 1'));
	await frame();
}

async function setThreeD(): Promise<void> {
	control('3D').click();
	await frame();
}

/** Dock Capture. Capture is accepted asynchronously, so callers wait on the outcome they expect. */
async function pressCapture(): Promise<void> {
	dockKey('capture').click();
	await frame();
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

/** A Stage pick of the seeded Scene entity, through the Stage's own selection call. */
async function selectSceneEntityOnStage(): Promise<void> {
	const stage = facade();
	const subject = stage.subjects().find((item) => item.reference.domain === 'scene' && item.reference.subject.kind === 'entity');
	if (subject === undefined) throw new Error('the seeded Scene has no entity subject');
	stage.setSelection({ ordered: [{ reference: subject.reference }], primary: subject.reference });
	await frame();
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

	it('shows the Presentations group with the crumb create when no Experience exists, and the dock keys', async () => {
		await enterExperience();
		expect(experienceName()).toBeNull();
		expect(target.querySelector('.index-empty')?.textContent).toBe('No Experience yet');
		expect(target.querySelector('[aria-label="Switch or create Experience"]')).not.toBeNull();
		expect(control('New Experience')).toBeDefined();
		expect(target.textContent).toContain('Create an Experience from the menu above to start presenting.');
		// Search appears only from eight Presentations, so an empty Experience has none.
		expect(target.querySelector('input[aria-label="Find a Presentation or View"]')).toBeNull();
		// The dock: Select, Place a View (placeholder), Capture and Guide. Path shows only with a Guide open.
		const keys = [...target.querySelectorAll<HTMLElement>('[data-experience-dock] [data-dock-tool]')].map((key) => key.dataset.dockTool);
		expect(keys).toEqual(['select', 'place-view', 'capture', 'guide']);
		expect(target.querySelector('[data-stage-dock]')).toBeNull();
	});

	it('creates the Experience through the crumb menu, and the Index then shows its Guide group', async () => {
		await enterExperience();
		await createExperience();
		expect(target.querySelector('#index-guides')).not.toBeNull();
		expect(target.querySelector('[data-guide-id]')).toBeNull();
		expect(target.querySelector('#index-guides')?.parentElement?.textContent).toContain('No Guide yet');
		expect(target.textContent).toContain('Nothing presented yet. Select an object and choose Present this, or press Capture in the dock.');
	});

	it('keeps New Experience available after the first and preserves multi-Experience switching', async () => {
		await enterExperience();
		await createExperience();
		control('New Experience').click();
		await vi.waitFor(() => expect(experienceName()).toBe('Experience 2'));

		const switcher = target.querySelector<HTMLDetailsElement>('.siblings')!;
		const first = [...switcher.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Experience 1');
		expect(first).toBeDefined();
		first!.click();
		await frame();
		expect(experienceName()).toBe('Experience 1');
	});

	it('keeps the Guide closed on lens entry; the dock key opens it with a status before any Experience exists', async () => {
		await enterExperience();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('false');
		expect(guidePanel()).toBeNull();

		dockGuide().click();
		await frame();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('true');
		expect(target.querySelector('.lower-column')?.textContent).toContain('Create an Experience in the Index before composing its Guide.');
		dockGuide().click();
		await frame();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('false');
	});

	it('reads the tour through the entry Guide before any Guide is opened: Presentations show their Stop numbers, not free', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		expect(guidePanel()).toBeNull();
		expect(guideRow('guide-1')?.querySelector('.chip')?.textContent).not.toBe('Open');
		expect(presentationRow('presentation-1')?.textContent).toContain('Stops 1');
		expect(presentationRow('presentation-2')?.textContent).toContain('Stops 2');
		expect(target.querySelector('.free-tag')).toBeNull();
	});
});

describe('R217.S25 — the Guide instrument (D3)', () => {
	it('an Index Guide row opens the instrument with that Guide active and selects the Guide Card', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		expect(guideRow('guide-1')?.textContent).toContain('Main');
		expect(guideRow('guide-1')?.textContent).toContain('2 stops');
		expect(guidePanel()).toBeNull();

		guideRow('guide-1')!.click();
		await frame();

		expect(guidePanel()).not.toBeNull();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('true');
		expect(guideRow('guide-1')?.querySelector('.chip')?.textContent).toBe('Open');
		expect(cardKind()).toBe('Guide');
		expect(guidePanel()!.querySelectorAll('[aria-label="Stops in Main"] button.stop-card')).toHaveLength(2);
	});

	it('the dock Guide key shows and hides the active Guide, opening the entry Guide when none is active, and selects nothing', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();

		dockGuide().click();
		await frame();
		expect(guidePanel()).not.toBeNull();
		expect(guideRow('guide-1')?.querySelector('.chip')?.textContent).toBe('Open');
		// The key opens context only: no Card subject appears.
		expect(card()).toBeNull();
		expect(experienceFocus.subject).toBeNull();

		dockGuide().click();
		await frame();
		expect(guidePanel()).toBeNull();

		dockGuide().click();
		await frame();
		expect(guidePanel()).not.toBeNull();
		expect(guideRow('guide-1')?.querySelector('.chip')?.textContent).toBe('Open');
	});

	it('× closes the instrument', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		dockGuide().click();
		await frame();

		control('Close Guide').click();
		await frame();
		expect(guidePanel()).toBeNull();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('false');
	});

	it('Esc clears the selection first, and only the next Esc closes the Guide', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		dockGuide().click();
		await frame();
		target.querySelector<HTMLButtonElement>('[data-stop-id="stop-1"]')!.click();
		await frame();
		expect(cardKind()).toMatch(/^Stop 1 of 2/);

		await pressEscape();
		expect(card()).toBeNull();
		expect(experienceFocus.subject).toBeNull();
		expect(guidePanel()).not.toBeNull();

		await pressEscape();
		expect(guidePanel()).toBeNull();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('false');
	});

	it('closes the Guide again on each entry to the Experience lens', async () => {
		await remountRouteWith(await seededExperienceProject());
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

	it('a Stop subject left from the last visit does not reopen the Guide on lens entry', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		dockGuide().click();
		await frame();
		target.querySelector<HTMLButtonElement>('[data-stop-id="stop-1"]')!.click();
		await frame();
		expect(cardKind()).toMatch(/^Stop 1 of 2/);

		target.querySelector<HTMLButtonElement>('[data-testid="lens-world"]')!.click();
		await frame();
		await enterExperience();
		expect(experienceFocus.subject).toBeNull();
		expect(guidePanel()).toBeNull();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('false');
	});

	it('a Presentation subject never closes the open Guide', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		dockGuide().click();
		await frame();

		presentationRow('presentation-1')!.click();
		await frame();
		expect(cardKind()).toBe('Presentation');
		expect(guidePanel()).not.toBeNull();
		expect(dockGuide().getAttribute('aria-pressed')).toBe('true');
	});

	it('a Stop card keeps its menu: Move earlier and Move later reorder the active Guide', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		dockGuide().click();
		await frame();
		target.querySelector<HTMLButtonElement>('[data-stop-id="stop-1"]')!.click();
		await frame();

		control('Subject actions').click();
		await frame();
		expect(card()!.querySelector<HTMLButtonElement>('[data-card-menu="move-earlier"]')!.disabled).toBe(true);
		const later = card()!.querySelector<HTMLButtonElement>('[data-card-menu="move-later"]')!;
		expect(later.disabled).toBe(false);
		later.click();
		await frame();

		await vi.waitFor(() => expect(cardKind()).toMatch(/^Stop 2 of 2/));
		expect(guidePanel()!.querySelector('[aria-label="Stops in Main"]')?.firstElementChild?.getAttribute('data-stop-id')).toBe('stop-2');
	});
});

describe('R217.S25 — one Card selection (D10)', () => {
	it('an Index Presentation clears the Stage selection; a Stage Scene pick then replaces the Experience subject', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		await selectWallOnStage();
		expect(cardKind()).toBe('Wall');

		presentationRow('presentation-1')!.click();
		await frame();
		expect(cardKind()).toBe('Presentation');
		expect(experienceFocus.read().presentationId).toBe('presentation-1');
		expect(facade().selectionState().primary ?? null).toBeNull();
		expect(presentationRow('presentation-1')?.getAttribute('aria-current')).toBe('true');

		await setThreeD();
		await selectSceneEntityOnStage();
		expect(cardKind()).toBe('Scene object');
		expect(control('Present this')).toBeDefined();
		expect(experienceFocus.subject).toBeNull();
		expect(experienceFocus.read().presentationId).toBeNull();
		expect(presentationRow('presentation-1')?.getAttribute('aria-current')).toBeNull();

		// The old Presentation never comes back by itself.
		await frame();
		expect(cardKind()).toBe('Scene object');
		expect(experienceFocus.read().presentationId).toBeNull();
	});

	it('a revision-only change keeps an Experience subject: a rename of the shown Presentation does not clear it', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		presentationRow('presentation-1')!.click();
		await frame();
		expect(cardKind()).toBe('Presentation');

		card()!.querySelector<HTMLButtonElement>('h2.name button')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		await frame();
		const input = card()!.querySelector<HTMLInputElement>('input.rename-input')!;
		input.value = 'Piano first';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await vi.waitFor(() => expect(presentationRow('presentation-1')?.textContent).toContain('Piano first'));
		await frame();

		expect(cardKind()).toBe('Presentation');
		expect(experienceFocus.read().presentationId).toBe('presentation-1');
		expect(presentationRow('presentation-1')?.getAttribute('aria-current')).toBe('true');

		// A requalification with the same (empty) Stage subject re-runs the route's sync through the
		// adapters-changed path; it must leave the Experience subject alone too.
		facade().setSelection({ ordered: [], primary: null });
		await frame();
		expect(cardKind()).toBe('Presentation');
		expect(experienceFocus.read().presentationId).toBe('presentation-1');
	});

	it('an undone Presentation clears the subject that named it, so no stale or blank Card remains', async () => {
		await enterExperience();
		await createExperience();
		await setThreeD();
		await pressCapture();
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(1));
		expect(experienceFocus.subject?.kind).toBe('presentation');
		expect(cardKind()).toBe('Presentation');

		// Undo removes the Presentation the subject names: the subject must not outlive it.
		const outcome = await acceptance().undo();
		expect(outcome.kind).toBe('installed');
		await vi.waitFor(() => expect(experienceFocus.subject).toBeNull());
		await frame();
		expect(presentationRows()).toHaveLength(0);
		expect(card()).toBeNull();
	});

	it('a Stage Wall pick replaces a selected Stop but keeps the active Guide as context', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		dockGuide().click();
		await frame();
		target.querySelector<HTMLButtonElement>('[data-stop-id="stop-1"]')!.click();
		await frame();
		expect(cardKind()).toMatch(/^Stop 1 of 2/);
		expect(experienceFocus.read()).toMatchObject({ guideId: 'guide-1', stopId: 'stop-1' });

		await selectWallOnStage();

		expect(cardKind()).toBe('Wall');
		expect(experienceFocus.read()).toMatchObject({ guideId: 'guide-1', stopId: null, presentationId: null });
		expect(guidePanel()?.querySelector('[data-stop-id="stop-1"]')?.getAttribute('aria-pressed')).toBe('false');
	});

	it('a Stage Wall pick in 2D is no Capture subject: the refused Capture writes nothing and the Wall Card stays', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		await selectWallOnStage();

		await pressCapture();
		await vi.waitFor(() =>
			expect(target.querySelector('.experience-feedback')?.textContent).toContain('Capture needs the 3D reading')
		);
		expect(presentationRows()).toHaveLength(2);
		expect(cardKind()).toBe('Wall');
	});
});

describe('R217.S25 — Capture and Present this (D1, D2)', () => {
	it('refuses Capture outside the 3D reading, and writes no View', async () => {
		await enterExperience();
		await createExperience();

		await pressCapture();
		await vi.waitFor(() =>
			expect(target.querySelector('.experience-feedback')?.textContent).toContain('Capture needs the 3D reading')
		);
		expect(presentationRows()).toHaveLength(0);
		expect(target.textContent).toContain('Nothing presented yet. Select an object and choose Present this, or press Capture in the dock.');
	});

	it('captures a Presentation in 3D and shows it through the shared Card, with its writer, Add to Guide and no Save', async () => {
		await enterExperience();
		await createExperience();
		await setThreeD();

		await pressCapture();
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(1));
		await frame();

		expect(cardKind()).toBe('Presentation');
		expect(card()!.querySelector('[data-experience-writer="presentation"]')).not.toBeNull();
		expect(card()!.textContent).not.toContain('Save Presentation');
		// A standpoint Presentation has no Scene subject, so Bring into view has no place to go.
		expect(card()!.querySelector('[aria-label="Bring into view"]')).toBeNull();
		expect(card()!.querySelector('[data-card-more]')).not.toBeNull();
		// Add to Guide is the visible button at the top of the writer; the Card's ••• holds no Add to Guide item.
		expect(control('Add to Guide').closest('[data-experience-writer="presentation"]')).not.toBeNull();
		expect(card()!.querySelector('[data-card-menu="add-to-guide"]')).toBeNull();
		expect(target.querySelector('[data-presentation-id] [aria-current="true"]')).not.toBeNull();
	});

	it('dock Capture with a Presentation shown adds a View to it and keeps its Default', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		presentationRow('presentation-1')!.click();
		await frame();
		await setThreeD();

		await pressCapture();
		await vi.waitFor(() => expect(card()!.querySelectorAll('[data-view-tile]')).toHaveLength(2));
		expect(presentationRows()).toHaveLength(2);
		const tiles = [...card()!.querySelectorAll<HTMLElement>('[data-view-tile]')];
		expect(tiles[0]!.getAttribute('aria-label')).toContain('Default View');
		expect(tiles[1]!.getAttribute('aria-label')).not.toContain('Default View');
		expect(cardKind()).toBe('Presentation');
		expect(experienceFocus.read().presentationId).toBe('presentation-1');
		expect(guideRow('guide-1')?.textContent).toContain('2 stops');
	});

	it('with no Experience subject shown, Capture creates a new Presentation with no subject and no Stop, even with a Scene entity selected', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		await setThreeD();
		await selectSceneEntityOnStage();
		expect(cardKind()).toBe('Scene object');
		expect(experienceFocus.subject).toBeNull();
		const seededIds = [...presentationRows()].map((row) => row.getAttribute('data-presentation-id') ?? '');
		expect(seededIds).toHaveLength(2);

		await pressCapture();
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(3));
		await frame();

		// A new standpoint Presentation: named as a Presentation, not about the Scene object.
		expect(cardKind()).toBe('Presentation');
		expect(card()!.querySelector('.kind-link')).toBeNull();
		// The new row is the one that was not listed before the Capture, and it is the selected one.
		const created = [...presentationRows()].filter((row) => !seededIds.includes(row.getAttribute('data-presentation-id') ?? ''));
		expect(created).toHaveLength(1);
		expect(created[0]!.querySelector('[aria-current="true"]')).not.toBeNull();
		// No Stop: the Guide keeps its two.
		expect(guideRow('guide-1')?.textContent).toContain('2 stops');
	});

	it('Present this binds the Scene entity to a new Presentation and adds no Stop', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		await setThreeD();
		await selectSceneEntityOnStage();

		control('Present this').click();
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(3));
		await frame();

		expect(cardKind()).toContain('Presentation · about');
		expect(card()!.querySelector('.kind-link')).not.toBeNull();
		expect(guideRow('guide-1')?.textContent).toContain('2 stops');
	});

	it('Add to Guide with no Guide asks the first Guide name inline in the Presentation writer, then makes the Guide', async () => {
		await enterExperience();
		await createExperience();
		await setThreeD();
		await pressCapture();
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(1));

		control('Add to Guide').click();
		await frame();

		const naming = card()!.querySelector('section[aria-label="Name the new Guide"]');
		expect(naming).not.toBeNull();
		const name = naming!.querySelector<HTMLInputElement>('input[aria-label="Guide name"]')!;
		name.value = 'Tour';
		name.dispatchEvent(new Event('input', { bubbles: true }));
		await frame();
		control('Create Guide').click();

		await vi.waitFor(() => expect(target.querySelector('[data-guide-id]')).not.toBeNull());
		expect(target.querySelector('[data-guide-id] .guide-row')?.textContent).toContain('Tour');
		expect(target.querySelector('[data-guide-id] .guide-row')?.textContent).toContain('1 stops');
		// The new Stop is the subject: its Card carries the Stop writer and the Guide's Stop menu.
		expect(cardKind()).toMatch(/^Stop 1 of 1/);
		expect(card()!.querySelector('[data-experience-writer="stop"]')).not.toBeNull();
		expect(card()!.textContent).not.toContain('Save Stop');
	});

	it('Add to Guide with no Guide opens the Guide instrument on the new Guide', async () => {
		await enterExperience();
		await createExperience();
		await setThreeD();
		await pressCapture();
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(1));
		expect(guidePanel()).toBeNull();

		control('Add to Guide').click();
		await frame();
		const name = card()!.querySelector<HTMLInputElement>('section[aria-label="Name the new Guide"] input[aria-label="Guide name"]')!;
		name.value = 'Tour';
		name.dispatchEvent(new Event('input', { bubbles: true }));
		await frame();
		control('Create Guide').click();

		await vi.waitFor(() => expect(target.querySelector('[data-experience-guide]')).not.toBeNull());
		expect(dockGuide().getAttribute('aria-pressed')).toBe('true');
		expect(target.querySelector('[data-guide-id] .guide-row .chip')?.textContent).toBe('Open');
		expect(cardKind()).toMatch(/^Stop 1 of 1 · Tour/);
	});

	it('Add to Guide with a Guide present adds a Stop to it after the selected one, and names no first Guide', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		presentationRow('presentation-2')!.click();
		await frame();

		control('Add to Guide').click();
		await vi.waitFor(() => expect(guideRow('guide-1')?.textContent).toContain('3 stops'));
		expect(card()!.querySelector('section[aria-label="Name the new Guide"]')).toBeNull();
	});
});

describe('R217.S25 — Preview and Undo (D-harvest "Kept")', () => {
	it('keeps one Preview entry, in the Head, and no Experience home carries its own', () => {
		// The Head renders one Preview entry: an enabled and a disabled button in one `{#if canPreview}`.
		const head = readFileSync('src/lib/authoring/stage/shell/EditorHead.svelte', 'utf8');
		expect(head.match(/\{#if canPreview\}/g)).toHaveLength(1);
		expect(head.match(/data-head-preview=""/g)).toHaveLength(1);
		expect(head.match(/data-head-preview-button/g)).toHaveLength(2);

		const route = readFileSync('src/routes/project/[projectId]/spatial/+page.svelte', 'utf8');
		expect(route.match(/onPreview=\{/g)).toHaveLength(1);

		const homes = [
			'src/lib/authoring/experience/ExperienceDock.svelte',
			'src/lib/authoring/experience/ExperienceGuide.svelte',
			'src/lib/authoring/experience/ExperiencePresentationWriter.svelte',
			'src/lib/authoring/experience/ExperienceStopWriter.svelte',
			'src/lib/authoring/experience/ExperienceViewWriter.svelte',
			'src/lib/authoring/experience/ExperienceTransitionWriter.svelte',
			'src/lib/authoring/experience/ExperienceGuideWriter.svelte',
			'src/lib/authoring/experience/ExperienceSubjectWriter.svelte',
			'src/lib/authoring/stage/shell/EditorIndex.svelte',
			'src/lib/authoring/stage/shell/EditorCard.svelte'
		];
		for (const file of homes) {
			expect(readFileSync(file, 'utf8'), file).not.toMatch(/aria-label="Preview"|>Preview</);
		}
	});

	it('Undo after a Capture restores the previous source through the controller, and the Presentation leaves the Index', async () => {
		await enterExperience();
		await createExperience();
		await setThreeD();
		await pressCapture();
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(1));
		expect(target.querySelector('[data-can-undo="true"]')).not.toBeNull();

		const outcome = await acceptance().undo();
		expect(outcome.kind).toBe('installed');
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(0));
		// Undo restores only the Capture: the Experience created before it stays.
		expect(experienceName()).toBe('Experience 1');
		expect(target.textContent).toContain('Nothing presented yet. Select an object and choose Present this, or press Capture in the dock.');
	});
});
