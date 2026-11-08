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
import { stageCamera, stageExperience } from '$lib/authoring/stage/unit-stage-source';
import { registerStageSnapshotRenderer, type SnapshotRequest } from '$lib/authoring/stage/stage-snapshots';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
import type { ExperienceHomes } from '$lib/authoring/experience/experience-homes';
import { previewEntryFor } from '$lib/authoring/experience/preview-entry';
import { CONNECTIONS, EXPERIENCE, VIEWS } from '../experience/fixtures';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

const harness = vi.hoisted(() => ({
	document: null as unknown,
	facade: null as unknown,
	acceptance: null as unknown,
	homes: null as ExperienceHomes | null
}));

vi.mock('$lib/authoring/experience/experience-homes', async (original) => {
	const actual = await original<typeof import('$lib/authoring/experience/experience-homes')>();
	return {
		...actual,
		provideExperienceHomes: (homes: ExperienceHomes) => {
			harness.homes = homes;
			actual.provideExperienceHomes(homes);
		}
	};
});

vi.mock('$lib/authoring/experience/preview-entry', async (original) => {
	const actual = await original<typeof import('$lib/authoring/experience/preview-entry')>();
	return { ...actual, previewEntryFor: vi.fn(actual.previewEntryFor) };
});

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

// The Stage canvas is doubled, so no Scene meshes register with the real pick
// source. Present this needs a drawn body; supply deterministic render bounds for
// the entities this suite seeds while leaving picking and lifecycle untouched.
vi.mock('$lib/authoring/scene/scene-pick-source', async (original) => {
	const actual = await original<typeof import('$lib/authoring/scene/scene-pick-source')>();
	return {
		...actual,
		createScenePickSource: () => {
			const source = actual.createScenePickSource();
			return {
				...source,
				bounds: (id: string, scene: Parameters<typeof source.bounds>[1]) =>
					source.bounds(id, scene) ??
					(scene.entities.some((entity) => entity.id === id)
						? { min: [-0.5, 0, -0.5] as [number, number, number], max: [0.5, 1, 0.5] as [number, number, number] }
						: null)
			};
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

/** The kind line's own words, without the R217.S26 *‹ Back* link that may precede them. */
function cardKind(): string | null {
	const kind = card()?.querySelector('.kind');
	if (kind == null) return null;
	const words = kind.cloneNode(true) as HTMLElement;
	words.querySelector('[data-card-back]')?.remove();
	return words.textContent?.trim() ?? null;
}

/** The Index's current Experience row: its name, or null before any Experience exists (the draft). */
function experienceName(): string | null {
	return target.querySelector('[data-experience-row] [aria-current="location"] .exp-name')?.textContent ?? null;
}

/** Experience review 1: the list's + opens an inline name; Enter creates it. */
async function newExperienceInline(): Promise<void> {
	control('New Experience').click();
	await frame();
	const input = target.querySelector<HTMLInputElement>('input[aria-label="New Experience name"]')!;
	input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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
	harness.homes = null;
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
async function seededExperienceProject(experience = EXPERIENCE): Promise<unknown> {
	return createUnitProject({
		id: 'project-1',
		name: 'Experience homes',
		layout: buildStarterEnclosureLayout(),
		scene: { ...createEmptyUnitSceneDocument(), entities: [primitiveEntity(0)] },
		camera: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: VIEWS, connections: CONNECTIONS },
		experience
	});
}

async function enterExperience(): Promise<void> {
	target.querySelector<HTMLButtonElement>('[data-testid="lens-experience"]')!.click();
	await frame();
	// The lens mounts its controller once the admitted source is bound; wait for its Index groups.
	await vi.waitFor(() => expect(target.querySelector('#index-presentations')).not.toBeNull());
}

/** Create the first Experience through the Index's Experiences list (+). */
async function createExperience(): Promise<void> {
	await newExperienceInline();
	await vi.waitFor(() => expect(experienceName()).toBe('Experience 1'));
	await frame();
}

async function settleReading(reading: '3d' | 'plan'): Promise<void> {
	let now = performance.now();
	const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
	try {
		for (let pumped = 0; pumped < 160; pumped += 1) {
			const state = facade().camera.state();
			if (state.reading === reading && state.transition === null) return;
			now += 20;
			await frame();
		}
	} finally {
		clock.mockRestore();
	}
	throw new Error(`The Stage reading did not settle to ${reading}.`);
}

async function setThreeD(): Promise<void> {
	control('3D').click();
	await frame();
	await settleReading('3d');
}

async function setTwoD(): Promise<void> {
	control('2D').click();
	await frame();
	await settleReading('plan');
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

describe('R217.S28 — Stage View markers keep click and edit distinct', () => {
	function turnMarker(): { mark: SVGGElement; hit: SVGPathElement; viewId: string } {
		const mark = target.querySelector<SVGGElement>('[data-view-mark][data-mark-kind="turn"]');
		const hit = mark?.querySelector<SVGPathElement>('[data-turn-grip]') ?? null;
		if (mark === null || hit === null) throw new Error('no turn grip rendered');
		return { mark, hit, viewId: mark.getAttribute('data-view-mark')! };
	}

	function pointer(type: string, element: Element, pointerId: number, x: number, y: number): void {
		const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
		Object.defineProperty(event, 'pointerId', { value: pointerId });
		Object.defineProperty(event, 'pointerType', { value: 'mouse' });
		element.dispatchEvent(event);
	}

	function markerPoint(): [number, number] {
		const { hit } = turnMarker();
		const coordinates = hit.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
		return [RECT.left + (coordinates[0]! + coordinates[2]!) / 2, RECT.top + (coordinates[1]! + coordinates[3]!) / 2];
	}

	async function withSvgPointerCapture(run: () => Promise<void>): Promise<void> {
		const proto = SVGElement.prototype as SVGElement & {
			setPointerCapture?: (id: number) => void;
			hasPointerCapture?: (id: number) => boolean;
			releasePointerCapture?: (id: number) => void;
		};
		const saved = ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture'] as const;
		const descriptors = saved.map((name) => Object.getOwnPropertyDescriptor(proto, name));
		Object.defineProperty(proto, 'setPointerCapture', { configurable: true, value: () => {} });
		Object.defineProperty(proto, 'hasPointerCapture', { configurable: true, value: () => true });
		Object.defineProperty(proto, 'releasePointerCapture', { configurable: true, value: () => {} });
		try {
			await run();
		} finally {
			saved.forEach((name, index) => {
				if (descriptors[index] === undefined) Reflect.deleteProperty(proto, name);
				else Object.defineProperty(proto, name, descriptors[index]!);
			});
		}
	}

	it('places a View on click and opens the new Presentation name', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		await setThreeD();
		dockKey('place-view').click();
		await frame();
		const stage = facade();
		const id = stage.evaluationId();
		if (id === null) throw new Error('no evaluation');
		const start = stage.projectWorld([1, 0, 1], id);
		if (start.kind !== 'projected') throw new Error('floor point not projected');
		const surface = target.querySelector<HTMLElement>('.stage')!;
		pointer('pointerdown', surface, 1, start.css[0], start.css[1]);
		pointer('pointerup', surface, 1, start.css[0], start.css[1]);
		for (let pumped = 0; pumped < 120 && target.querySelector('input.rename-input') === null; pumped += 1) await frame();
		await vi.waitFor(() => expect(target.querySelector('input.rename-input')).not.toBeNull());
	}, 15000);

	it.each(['3D', '2D'] as const)('anchors the %s placement ghost, commits its aimed pose once, and cancels with Escape', async (reading) => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		if (reading === '3D') await setThreeD();
		else await setTwoD();
		const stage = facade();
		const id = stage.evaluationId()!;
		const start = stage.projectWorld([1, 0, 1], id);
		const aim = stage.projectWorld([3, 0, 1], id);
		if (start.kind !== 'projected' || aim.kind !== 'projected') throw new Error('Floor points must project');
		const surface = target.querySelector<HTMLElement>('.stage')!;
		const ghost = () => target.querySelector('[data-view-placement-ghost]');
		const frustum = () => ghost()?.querySelector(reading === '3D' ? '[data-camera-wire]' : '[data-placement-wedge]');
		const eye = () => reading === '3D'
			? [ghost()?.querySelector('.stem')?.getAttribute('x1'), ghost()?.querySelector('.stem')?.getAttribute('y1')]
			// Review round 3: the Plan ghost is the Plan camera glyph; its translate is the eye.
			: (ghost()?.querySelector('[data-plan-camera]')?.getAttribute('transform')?.match(/translate\(([^ ]+) ([^)]+)\)/)?.slice(1, 3) ?? [null, null]);
		const baseline = stage.snapshot().canonicalJson;
		const viewIds = new Set(stageCamera(stage.snapshot()).views.map((view) => view.id));
		const adapterPointer = vi.spyOn(stage, 'pointerIntent');
		const acquireGesture = vi.spyOn(stage, 'acquireGesture');

		dockKey('place-view').click();
		await frame();
		pointer('pointerdown', surface, 1, ...start.css);
		await frame();
		expect(Boolean(ghost()?.querySelector('[data-camera-glyph]'))).toBe(reading === '3D');
		expect(ghost()?.querySelector('[role="button"]')).toBeNull();
		const startWire = frustum()?.getAttribute('d');
		const startEye = eye();
		expect(startWire).toBeTruthy();
		expect(startEye.every(Boolean)).toBe(true);
		// A second pointer cannot take over or end the active placement.
		pointer('pointerdown', surface, 2, ...aim.css);
		pointer('pointermove', surface, 2, ...aim.css);
		pointer('pointerup', surface, 2, ...aim.css);
		await frame();
		expect(frustum()?.getAttribute('d')).toBe(startWire);
		expect(eye()).toEqual(startEye);
		expect(adapterPointer).not.toHaveBeenCalled();
		expect(acquireGesture).not.toHaveBeenCalled();
		pointer('pointermove', surface, 1, ...aim.css);
		await frame();
		// Placement claims the press before either an adapter or navigation can use it.
		expect(adapterPointer).not.toHaveBeenCalled();
		expect(acquireGesture).not.toHaveBeenCalled();
		expect(eye()).toEqual(startEye);
		expect(frustum()?.getAttribute('d')).not.toBe(startWire);
		expect(stage.snapshot().canonicalJson).toBe(baseline);

		await pressEscape();
		pointer('pointerup', surface, 1, ...aim.css);
		await frame();
		expect(ghost()).toBeNull();
		expect(stage.snapshot().canonicalJson).toBe(baseline);
		expect((await acceptance().undo()).kind).not.toBe('installed');

		dockKey('place-view').click();
		await frame();
		pointer('pointerdown', surface, 2, ...start.css);
		pointer('pointermove', surface, 2, ...aim.css);
		await frame();
		const previewWire = frustum()?.getAttribute('d');
		const previewEye = eye().map(Number);
		expect(previewWire).toBeTruthy();
		pointer('pointerup', surface, 2, ...aim.css);
		await vi.waitFor(() => expect(stageCamera(stage.snapshot()).views).toHaveLength(viewIds.size + 1));
		await frame();
		expect(ghost()).toBeNull();
		const view = stageCamera(stage.snapshot()).views.find((candidate) => !viewIds.has(candidate.id))!;
		expect(view.eye[0]).toBeCloseTo(1);
		expect(view.eye[2]).toBeCloseTo(1);
		expect(view.target[0]).toBeGreaterThan(view.eye[0]);
		expect(view.target[2]).toBeCloseTo(view.eye[2]);
		const acceptedFrustum = reading === '3D'
			? target.querySelector(`[data-view-mark="${view.id}"] [data-camera-wire]`)
			: target.querySelector(`[data-view-frustum="${view.id}"]`);
		// The accepted View is no longer the selected ghost, so its frustum may be
		// shorter; it keeps the ghost's eye and aim direction.
		const firstLeg = (d: string | null | undefined) => {
			const [x0, y0, x1, y1] = (d ?? '').match(/-?\d+(?:\.\d+)?/g)!.slice(0, 4).map(Number) as [number, number, number, number];
			const length = Math.hypot(x1 - x0, y1 - y0);
			return { eye: [x0, y0], direction: [(x1 - x0) / length, (y1 - y0) / length] };
		};
		const accepted = firstLeg(acceptedFrustum?.getAttribute('d'));
		const preview = firstLeg(previewWire);
		if (reading === '3D') {
			expect(accepted.eye[0]).toBeCloseTo(preview.eye[0]!, 0);
			expect(accepted.eye[1]).toBeCloseTo(preview.eye[1]!, 0);
		} else {
			// Review round 3: the Plan wedge starts at the lens front, which sits further out
			// on the larger selected camera, so the eye is the Plan camera glyph's own position.
			const acceptedEye = target.querySelector(`[data-view-mark="${view.id}"] [data-plan-camera]`)
				?.getAttribute('transform')?.match(/translate\(([^ ]+) ([^)]+)\)/)?.slice(1, 3).map(Number) ?? [];
			expect(acceptedEye[0]).toBeCloseTo(previewEye[0]!, 0);
			expect(acceptedEye[1]).toBeCloseTo(previewEye[1]!, 0);
		}
		expect(accepted.direction[0]).toBeCloseTo(preview.direction[0]!, 2);
		expect(accepted.direction[1]).toBeCloseTo(preview.direction[1]!, 2);
		expect((await acceptance().undo()).kind).toBe('installed');
		expect(stageCamera(stage.snapshot()).views.map((candidate) => candidate.id)).toEqual([...viewIds]);
	}, 15000);

	it('reserves a 3D glyph press for its mark and keeps it out of Stage navigation', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		await setThreeD();
		const glyph = target.querySelector<SVGGElement>('[data-view-mark][data-mark-kind="glyph"]');
		const hit = glyph?.querySelector<SVGCircleElement>('.hit') ?? null;
		if (glyph === null || hit === null) throw new Error('no 3D glyph rendered');
		const viewId = glyph.getAttribute('data-view-mark')!;
		const x = RECT.left + Number(hit.getAttribute('cx'));
		const y = RECT.top + Number(hit.getAttribute('cy'));
		pointer('pointerdown', hit, 1, x, y);
		pointer('pointerup', hit, 1, x, y);
		hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await frame();
		expect(experienceFocus.subject).toEqual({ kind: 'view', viewId, presentationId: 'presentation-1' });
	});

	it('releases the View edit lease if pointer capture fails', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		target.querySelector<SVGCircleElement>('[data-view-mark][data-mark-kind="eye"] .hit')!.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true })
		);
		await vi.waitFor(() => turnMarker());
		const stage = facade();
		const before = stage.snapshot().canonicalJson;
		await withSvgPointerCapture(async () => {
			const [x, y] = markerPoint();
			const { hit } = turnMarker();
			Object.defineProperty(hit, 'setPointerCapture', {
				configurable: true,
				value: () => { throw new DOMException('Pointer ended', 'NotFoundError'); }
			});
			try {
				pointer('pointerdown', hit, 1, x, y);
				expect(stage.session.gesture()).toBeNull();
				pointer('pointermove', hit, 1, x + 30, y + 12);
				pointer('pointerup', hit, 1, x + 30, y + 12);
				await frame();
				expect(stage.snapshot().canonicalJson).toBe(before);
			} finally {
				Reflect.deleteProperty(hit, 'setPointerCapture');
			}
			pointer('pointerdown', hit, 2, x, y);
			expect(stage.session.gesture()?.owner).toBe('experience-view-edit');
			pointer('pointerup', hit, 2, x, y);
		});
	});

	it('authors one turn update, ignores a second pointer, and preserves click/double-click without authoring', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		// The turn grip appears on the selected View.
		target.querySelector<SVGCircleElement>('[data-view-mark][data-mark-kind="eye"] .hit')!.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true })
		);
		await vi.waitFor(() => turnMarker());
		const { viewId } = turnMarker();
		const before = stageCamera(facade().snapshot()).views.find((view) => view.id === viewId)!;
		const beforeTarget = [...before.target];

		await withSvgPointerCapture(async () => {
			const [x, y] = markerPoint();
			const { hit } = turnMarker();
			pointer('pointerdown', hit, 1, x, y);
			await frame();
			pointer('pointerdown', hit, 2, x, y);
			pointer('pointermove', hit, 2, x + 30, y);
			pointer('pointerup', hit, 2, x + 30, y);
			await frame();
			pointer('pointermove', hit, 1, x + 30, y + 12);
			pointer('pointerup', hit, 1, x + 30, y + 12);
			await frame();
		});
		let afterTurnTarget: readonly number[] = [];
		await vi.waitFor(() => {
			const after = stageCamera(facade().snapshot()).views.find((view) => view.id === viewId)!;
			expect(after.target).not.toEqual(beforeTarget);
			expect(after.eye).toEqual(before.eye);
			expect(after.target[1]).toBe(before.target[1]);
			expect(after.fov).toBe(before.fov);
			afterTurnTarget = [...after.target];
		});

		// A click on the marker still selects the View, and a double-click opens Look through.
		await withSvgPointerCapture(async () => {
			const hit = target.querySelector<SVGCircleElement>('[data-view-mark][data-mark-kind="eye"] .hit')!;
			const x = RECT.left + Number(hit.getAttribute('cx'));
			const y = RECT.top + Number(hit.getAttribute('cy'));
			pointer('pointerdown', hit, 1, x, y);
			pointer('pointerup', hit, 1, x, y);
			hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			await frame();
			hit.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
			await frame();
		});
		expect(target.querySelector('[data-through-frame]')).not.toBeNull();
		expect(stageCamera(facade().snapshot()).views.find((view) => view.id === viewId)!.target).toEqual(afterTurnTarget);

		// Re-aim owns the Stage before adapter presses and ordinary navigation.
		const stage = facade();
		const adapterPointer = vi.spyOn(stage, 'pointerIntent');
		const acquireGesture = vi.spyOn(stage, 'acquireGesture');
		const turn = vi.spyOn(stage.camera, 'turnLookThrough');
		const surface = target.querySelector<HTMLElement>('.stage')!;
		pointer('pointerdown', surface, 1, 700, 350);
		pointer('pointermove', surface, 1, 730, 365);
		pointer('pointerup', surface, 1, 730, 365);
		expect(turn).toHaveBeenCalled();
		expect(adapterPointer).not.toHaveBeenCalled();
		expect(acquireGesture).not.toHaveBeenCalled();
	});

	it('renders the Advanced Card picture only after a drag is accepted', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		experienceFocus.select({ kind: 'view', viewId: 'view-1', presentationId: 'presentation-1' });
		await frame();
		control('Advanced').click();
		await frame();

		const render = vi.fn(async (request: SnapshotRequest) =>
			`/snapshot-${request.pose.target[0]}.png`
		);
		const unregister = registerStageSnapshotRenderer(render);
		try {
			const picture = () => card()?.querySelector('.hero img')?.getAttribute('src');
			await vi.waitFor(() => expect(picture()).toBe('/snapshot-0.png'));
			const baseline = facade().snapshot().canonicalJson;
			const before = picture();

			await withSvgPointerCapture(async () => {
				for (const cancel of [true, false]) {
					const [x, y] = markerPoint();
					const { hit } = turnMarker();
					render.mockClear();
					pointer('pointerdown', hit, 1, x, y);
					pointer('pointermove', hit, 1, x + 30, y + 12);
					await frame();
					expect(target.querySelector('[data-view-edit-ghost]')).not.toBeNull();
					expect(picture()).toBe(before);
					expect(render).not.toHaveBeenCalled();
					if (cancel) await pressEscape();
					pointer('pointerup', hit, 1, x + 30, y + 12);
					await frame();
					if (cancel) {
						expect(facade().snapshot().canonicalJson).toBe(baseline);
						expect(picture()).toBe(before);
						expect(render).not.toHaveBeenCalled();
					}
				}
			});

			await vi.waitFor(() => {
				const accepted = stageCamera(facade().snapshot()).views.find(view => view.id === 'view-1')!;
				expect(accepted.target[0]).not.toBe(0);
				expect(picture()).toBe(`/snapshot-${accepted.target[0]}.png`);
				expect(render.mock.calls.filter(([request]) => request.viewId === 'view-1')).toHaveLength(1);
			});
		} finally {
			unregister();
		}
	});

	it('discloses Advanced in Plan without a write, and confirms a shared edit once', async () => {
		const source = structuredClone(EXPERIENCE);
		const experience = source.experiences[0]!;
		const shared = {
			...source, experiences: [{ ...experience, presentations: experience.presentations.map(presentation =>
				presentation.id === 'presentation-2' ? { ...presentation, views: [...presentation.views, { viewId: 'view-1', transition: 'cut' as const }] } : presentation
			) }]
		};
		await remountRouteWith(await seededExperienceProject(shared));
		await enterExperience();
		experienceFocus.select({ kind: 'view', viewId: 'view-1', presentationId: 'presentation-1' });
		await frame();
		const baseline = facade().snapshot().canonicalJson;
		const advanced = control('Advanced');
		expect(advanced.getAttribute('aria-checked')).toBe('false');
		advanced.click();
		await frame();
		expect(advanced.getAttribute('aria-checked')).toBe('true');
		expect(target.querySelector('[data-advanced-handle="lift"]')).toBeNull();
		expect(facade().snapshot().canonicalJson).toBe(baseline);

		const dialog = () => target.querySelector('[aria-label="Update a shared View"]');
		control('Raise camera').click();
		await vi.waitFor(() => expect(dialog()?.textContent).toContain('Also changes Gallery'));
		expect(facade().snapshot().canonicalJson).toBe(baseline);
		await pressEscape();
		expect(dialog()).toBeNull();
		expect((await acceptance().undo()).kind).not.toBe('installed');

		control('Raise camera').click();
		await vi.waitFor(() => expect(dialog()).not.toBeNull());
		dialog()!.querySelector<HTMLButtonElement>('button')!.click();
		await vi.waitFor(() => {
			const view = stageCamera(facade().snapshot()).views.find(candidate => candidate.id === 'view-1')!;
			expect(view.eye[1]).toBeCloseTo(VIEWS[0]!.eye[1] + 0.05);
			expect(view.target[1]).toBeCloseTo(VIEWS[0]!.target[1] + 0.05);
		});
		expect((await acceptance().undo()).kind).toBe('installed');
		expect(facade().snapshot().canonicalJson).toBe(baseline);
		expect((await acceptance().undo()).kind).not.toBe('installed');
	});

	it('moves in proportion to small wheel deltas and pans the provisional View with Shift-drag', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		const hit = target.querySelector<SVGCircleElement>('[data-view-mark][data-mark-kind="eye"] .hit')!;
		hit.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
		await frame();

		const camera = facade().camera;
		const surface = target.querySelector<HTMLElement>('.stage')!;
		const before = camera.provisionalView()!;
		surface.dispatchEvent(new WheelEvent('wheel', { deltaY: -5, bubbles: true, cancelable: true }));
		await frame();
		const first = camera.provisionalView()!;
		surface.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, bubbles: true, cancelable: true }));
		await frame();
		const second = camera.provisionalView()!;
		const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((value, axis) => value - b[axis]!));
		expect(distance(first.eye, before.eye)).toBeCloseTo(0.02);
		expect(distance(second.eye, first.eye)).toBeCloseTo(0.04);
		expect(second.fovYDegrees).toBe(before.fovYDegrees);

		pointer('pointerdown', surface, 1, 400, 250);
		const move = new MouseEvent('pointermove', { shiftKey: true, clientX: 460, clientY: 270, bubbles: true });
		Object.defineProperty(move, 'pointerId', { value: 1 });
		surface.dispatchEvent(move);
		pointer('pointerup', surface, 1, 460, 270);
		const panned = camera.provisionalView()!;
		expect(distance(panned.eye, second.eye)).toBeGreaterThan(0.01);
		expect(panned.fovYDegrees).toBe(second.fovYDegrees);
		for (const [axis, coordinate] of panned.target.entries()) {
			expect(coordinate - second.target[axis]!).toBeCloseTo(panned.eye[axis]! - second.eye[axis]!);
		}
	});
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

	it('authors the World environment before opening Experience and reads it in both lenses', async () => {
		const chip = () => target.querySelector<HTMLButtonElement>('[data-environment-chip]')!;
		expect(chip().textContent).toContain('Paper');
		chip().click();
		await frame();
		target.querySelector<HTMLButtonElement>('[data-environment="golden-hour"]')!.click();
		await vi.waitFor(() => expect(chip().textContent).toContain('Golden hour'));

		await enterExperience();
		expect(chip().textContent).toContain('Golden hour');
		expect((await acceptance().undo()).kind).toBe('installed');
		await vi.waitFor(() => expect(chip().textContent).toContain('Paper'));
	});

	it('shows the ready draft and the list + when no Experience exists, and the dock keys', async () => {
		await enterExperience();
		expect(experienceName()).toBeNull();
		expect(target.querySelector('[data-experience-draft]')?.textContent).toContain('Untitled experience');
		expect(control('New Experience')).toBeDefined();
		expect(target.textContent).toContain('Nothing presented yet. Start from the Stage.');
		// The search always heads the Index, so the top row is never empty.
		expect(target.querySelector('input[aria-label="Find a Presentation or View"]')).not.toBeNull();
		// The dock: Select, Place a View, Capture and Guide.
		const keys = [...target.querySelectorAll<HTMLElement>('[data-experience-dock] [data-dock-tool]')].map((key) => key.dataset.dockTool);
		expect(keys).toEqual(['select', 'place-view', 'capture', 'guide']);
		expect(target.querySelector('[data-stage-dock]')).toBeNull();
	});

	it('creates the Experience through the list +, and the Index then shows its Guide group', async () => {
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
		await newExperienceInline();
		await vi.waitFor(() => expect(experienceName()).toBe('Experience 2'));

		const first = target.querySelector<HTMLButtonElement>('[data-experience-row] .exp-open:not([aria-current])');
		expect(first?.textContent).toContain('Experience 1');
		first!.click();
		await frame();
		expect(experienceName()).toBe('Experience 1');
	});

	it('registers the Guide closed before the first Experience entry', async () => {
		if (harness.homes === null) throw new Error('Experience homes were not registered');
		expect(harness.homes.guideOpen()).toBe(false);
		await enterExperience();
		expect(harness.homes.guideOpen()).toBe(false);
		expect(guidePanel()).toBeNull();
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

	it('drops a carried World selection on entry when no Experience exists', async () => {
		await selectWallOnStage();
		expect(card()).not.toBeNull();

		await enterExperience();
		expect(experienceName()).toBeNull();
		expect(facade().selectionState().primary).toBeNull();
		expect(card()).toBeNull();
	});

	it('runs the mounted Guide clock and restores the Stage standpoint after Follow', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		guideRow('guide-1')!.click();
		await frame();
		const panel = guidePanel();
		if (panel === null) throw new Error('the Guide did not open');
		const stage = facade();
		const capture = vi.spyOn(stage.camera, 'captureStandpoint');
		const restore = vi.spyOn(stage.camera, 'restoreStandpoint');
		const viewing = vi.spyOn(stage, 'requestViewingIntent');
		const play = panel.querySelector<HTMLButtonElement>('[aria-label="Play"]');
		if (play === null || play.disabled) throw new Error('Guide playback is unavailable');
		const registeredPlayback = harness.homes?.playback() ?? null;
		if (registeredPlayback === null) throw new Error('the registered homes did not provide playback');
		expect(registeredPlayback.status).toBe('idle');
		let now = performance.now();
		const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
		play.click();
		await frame();
		const startTime = panel.querySelector('[data-playback-total]')?.textContent;
		now += 1200;
		await frame();
		expect(panel.querySelector('[data-playback-total]')?.textContent).not.toBe(startTime);
		expect(panel.querySelector('[aria-label="Pause"]')).not.toBeNull();
		expect(registeredPlayback.status).toBe('playing');
		expect(capture).not.toHaveBeenCalled();
		expect(viewing).not.toHaveBeenCalled();
		clock.mockRestore();

		const follow = panel.querySelector<HTMLButtonElement>('button[title="Follow the camera"]');
		if (follow === null || follow.disabled) throw new Error('Follow is unavailable');
		follow.click();
		await frame();
		expect(follow.getAttribute('aria-pressed')).toBe('true');
		expect(capture).toHaveBeenCalled();
		expect(viewing).toHaveBeenCalled();
		follow.click();
		await frame();
		expect(follow.getAttribute('aria-pressed')).toBe('false');
		expect(restore).toHaveBeenCalled();
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
	it('an Index Guide row opens the instrument with that Guide active and keeps the Experience Card', async () => {
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
		// D-2/R33: no Guide Card subject; the Experience Card stays.
		expect(cardKind()).toBe('Experience');
		expect(experienceFocus.subject).toEqual({ kind: 'experience' });
		expect(guidePanel()!.querySelectorAll('[aria-label="Stops in Main"] button.stop-card')).toHaveLength(2);
	});

	it('the dock Guide key shows and hides the active Guide, opening the entry Guide when none is active, and selects nothing', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();

		dockGuide().click();
		await frame();
		expect(guidePanel()).not.toBeNull();
		expect(guideRow('guide-1')?.querySelector('.chip')?.textContent).toBe('Open');
		// The key opens context only: no subject appears, and the Experience Card remains.
		expect(cardKind()).toBe('Experience');
		expect(experienceFocus.subject).toBeNull();

		dockGuide().click();
		await frame();
		expect(guidePanel()).toBeNull();

		dockGuide().click();
		await frame();
		expect(guidePanel()).not.toBeNull();
		expect(guideRow('guide-1')?.querySelector('.chip')?.textContent).toBe('Open');
	});

	it('routes the registered start transport to the mounted Guide', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		dockGuide().click();
		await frame();
		await frame();
		if (harness.homes === null) throw new Error('Experience homes were not registered');
		const playback = harness.homes.playback();
		if (playback === null) throw new Error('the registered homes did not provide playback');
		const prepare = vi.spyOn(playback, 'prepare');
		harness.homes.playGuide('guide-1', { kind: 'start' });
		await frame();
		await frame();
		expect(prepare).toHaveBeenCalled();
		const panel = guidePanel();
		if (panel === null) throw new Error('the Guide did not open');
		expect(panel.querySelector('[aria-label="Pause"]')).not.toBeNull();
		expect(panel.querySelector('[data-playback-total]')?.textContent).toContain('0:00');
	});

	it('passes the registered Preview mode and Guide to the route takeover', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		if (harness.homes === null) throw new Error('Experience homes were not registered');
		vi.mocked(previewEntryFor).mockClear();
		harness.homes.previewMode('free', 'guide-1');
		await vi.waitFor(() => expect(target.querySelector('.preview-takeover:not([hidden])')).not.toBeNull());
		expect(vi.mocked(previewEntryFor)).toHaveBeenCalledWith(expect.objectContaining({
			focus: expect.objectContaining({ guideId: 'guide-1', stopId: null, presentationId: null })
		}));
		expect(target.querySelector('.preview-takeover [data-testid="stage-canvas"]')?.getAttribute('data-start-mode')).toBe('free');
	});

	it('routes Stop and transition playback actions to the mounted Guide', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		dockGuide().click();
		await frame();
		target.querySelector<HTMLButtonElement>('[data-stop-id="stop-2"]')!.click();
		await frame();
		control('Play from this Stop').click();
		await frame();
		await frame();
		const panel = guidePanel();
		if (panel === null) throw new Error('the Guide did not open');
		expect(panel.querySelector('[aria-label="Pause"]')).not.toBeNull();
		expect(panel.querySelector('[data-playback-total]')?.textContent).toContain('0:02');

		panel.querySelector<HTMLButtonElement>('[data-connector="stop-1"]')!.click();
		await frame();
		control('Preview this move').click();
		await frame();
		await frame();
		expect(panel.querySelector('[aria-label="Pause"]')).not.toBeNull();
		expect(panel.querySelector('[data-playback-total]')?.textContent).toContain('0:04');
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
		expect(cardKind()).toBe('Experience');
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
		// A first Stop that travels cannot become last (travel-after-last), so this
		// reorder fixture Cuts into its successor and the move is legal.
		const reorderable = structuredClone(EXPERIENCE) as typeof EXPERIENCE;
		reorderable.experiences[0]!.stops.find((stop) => stop.id === 'stop-1')!.transition = 'cut';
		await remountRouteWith(await seededExperienceProject(reorderable));
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

	it('Pick on the Stage links in one shot, while Esc cancels the pick', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		presentationRow('presentation-1')!.click();
		await frame();
		control('Pick on the Stage').click();
		await frame();

		await selectSceneEntityOnStage();
		await vi.waitFor(() => expect(cardKind()).toMatch(/^Presentation/));
		expect(experienceFocus.read().presentationId).toBe('presentation-1');
		expect(card()!.textContent).toContain('Following the object\'s name');

		// One shot: the next Stage pick is an ordinary Scene selection, not another link.
		await selectSceneEntityOnStage();
		await frame();
		expect(cardKind()).toBe('Scene object');

		presentationRow('presentation-2')!.click();
		await frame();
		control('Pick on the Stage').click();
		await frame();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await frame();
		await selectSceneEntityOnStage();
		await frame();
		expect(cardKind()).toBe('Scene object');
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
		expect(cardKind()).toBe('Experience');
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
		// Experience Cards carry no More disclosure: the writer already shows the relations.
		expect(card()!.querySelector('[data-card-more]')).toBeNull();
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
		await vi.waitFor(() => expect(card()!.querySelectorAll('[data-rail-view]')).toHaveLength(2));
		expect(presentationRows()).toHaveLength(2);
		// The new View is appended to the rail after View 1, the Default.
		const rows = [...card()!.querySelectorAll<HTMLElement>('[data-rail-view]')];
		expect(rows[0]!.getAttribute('aria-label')).toContain('the Default');
		expect(rows[1]!.getAttribute('aria-label')).not.toContain('the Default');
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

		const standpoint = facade().camera.state().pose;
		control('Present this').click();
		for (let pumped = 0; pumped < 240 && presentationRows().length < 3; pumped += 1) await frame();
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(3), { timeout: 6000 });
		expect(presentationRows()).toHaveLength(3);

		expect(facade().camera.state().pose).toEqual(standpoint);
		expect(cardKind()).toContain('Presentation · about');
		expect(card()!.querySelector('.kind-link')).not.toBeNull();
		expect(guideRow('guide-1')?.textContent).toContain('2 stops');
	}, 15000);

	it('Add to Guide with no Guide creates Tour and its first Stop, with no prompt (D-9)', async () => {
		await enterExperience();
		await createExperience();
		await setThreeD();
		await pressCapture();
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(1));

		control('Add to Guide').click();

		await vi.waitFor(() => expect(target.querySelector('[data-guide-id]')).not.toBeNull());
		expect(target.querySelector('[data-guide-id] .guide-row')?.textContent).toContain('Tour');
		expect(target.querySelector('[data-guide-id] .guide-row')?.textContent).toContain('1 stop ');
		expect(card()!.querySelector('section[aria-label="Name the new Guide"]')).toBeNull();
		// The new Stop is the subject: its Card carries the Stop writer and the Guide's Stop menu.
		expect(cardKind()).toMatch(/^Stop 1 of 1/);
		expect(card()!.querySelector('[data-experience-writer="stop"]')).not.toBeNull();
		expect(card()!.textContent).not.toContain('Save Stop');
	});

	it('Add to Guide with no Guide opens the Guide instrument on Tour', async () => {
		await enterExperience();
		await createExperience();
		await setThreeD();
		await pressCapture();
		await vi.waitFor(() => expect(presentationRows()).toHaveLength(1));
		expect(guidePanel()).toBeNull();

		control('Add to Guide').click();

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
		const headMounts = [...route.matchAll(/<EditorHead\b[\s\S]*?\/>/g)];
		expect(headMounts).toHaveLength(1);
		expect(headMounts[0]![0].match(/onPreview=\{/g)).toHaveLength(1);
		expect(route.match(/onPreview=\{/g)).toHaveLength(1);

		const homes = [
			'src/lib/authoring/experience/ExperienceDock.svelte',
			'src/lib/authoring/experience/ExperienceGuide.svelte',
			'src/lib/authoring/experience/ExperiencePresentationWriter.svelte',
			'src/lib/authoring/experience/ExperienceStopWriter.svelte',
			'src/lib/authoring/experience/ExperienceViewWriter.svelte',
			'src/lib/authoring/experience/ExperienceTransitionWriter.svelte',
			'src/lib/authoring/experience/ExperienceExperienceWriter.svelte',
			'src/lib/authoring/experience/ExperienceSubjectWriter.svelte',
			'src/lib/authoring/stage/shell/EditorIndex.svelte',
			'src/lib/authoring/stage/shell/EditorCard.svelte'
		];
		for (const file of homes) {
			// S30 Card actions may say Preview (a move or a mode), but no home owns
			// another Preview *entry*: they command the same Head-owned route through
			// the homes callback, never `openPreview`/`data-head-preview` themselves.
			const source = readFileSync(file, 'utf8');
			expect(source, file).not.toMatch(/data-head-preview|onEnterPreview|openPreview/);
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

describe('R217.S26 — structure and removal through the route', () => {
	async function openStopCard(stopId: string): Promise<void> {
		experienceFocus.select({ kind: 'stop', stopId });
		await frame();
	}
	function openMenu(): void {
		card()!.querySelector<HTMLButtonElement>('[aria-label="Subject actions"]')!.click();
	}
	function menuItem(id: string): HTMLButtonElement {
		return card()!.querySelector<HTMLButtonElement>(`[data-card-menu="${id}"]`)!;
	}

	it('removes a Stop after its consequence block, selects its Guide, and Undo restores it', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		await openStopCard('stop-2');
		openMenu();
		await frame();
		expect(menuItem('remove-stop').classList.contains('danger')).toBe(true);
		menuItem('remove-stop').click();
		await frame();
		const block = card()!.querySelector('[data-card-consequence="remove-stop"]')!;
		expect(block.textContent).toContain('Removes Stop 2. Gallery stays.');
		block.querySelector<HTMLButtonElement>('[data-card-consequence-run]')!.click();

		await vi.waitFor(() => expect(guideRow('guide-1')?.textContent).toContain('1 stop '));
		expect(experienceFocus.subject).toBeNull();
		expect(target.querySelector('.experience-feedback')?.textContent).toBe('Stop 2 removed. Main has 1 Stop.');

		expect((await acceptance().undo()).kind).toBe('installed');
		await vi.waitFor(() => expect(guideRow('guide-1')?.textContent).toContain('2 stops'));
	});

	it('Add to Guide ▸ New Guide… makes a second, active Guide; *opens* stays on the first', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		presentationRow('presentation-2')!.click();
		await frame();
		openMenu();
		await frame();
		menuItem('add-to-guide').click();
		await frame();
		menuItem('new-guide').click();

		await vi.waitFor(() => expect(target.querySelectorAll('[data-guide-id]')).toHaveLength(2));
		const rows = [...target.querySelectorAll('[data-guide-id]')];
		expect(rows.map((row) => row.querySelector('[data-opening-guide]') !== null)).toEqual([true, false]);
		expect(rows[1]!.textContent).toContain('Tour 2');
		expect(rows[1]!.querySelector('.chip')?.textContent).toBe('Open');
		expect(cardKind()).toMatch(/^Stop 1 of 1 · Tour 2/);
	});

	it('names no back link after stepping between sibling Stops (review round 3)', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		await openStopCard('stop-1');
		await openStopCard('stop-2');
		expect(cardKind()).toMatch(/^Stop 2 of 2/);
		expect(card()!.querySelector('[data-card-back]')).toBeNull();
	});

	it('Alt+← returns to the previous subject; the kind line shows it as *‹ Stop 2*', async () => {
		await remountRouteWith(await seededExperienceProject());
		await enterExperience();
		await openStopCard('stop-2');
		experienceFocus.select({ kind: 'view', viewId: 'view-1', presentationId: 'presentation-1' });
		await frame();
		expect(card()!.querySelector('[data-card-back]')?.textContent).toBe('‹ Stop 2');
		target.querySelector<HTMLElement>('.stage')!.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true })
		);
		await frame();
		expect(experienceFocus.subject).toEqual({ kind: 'stop', stopId: 'stop-2' });
		expect(target.querySelector('[data-can-undo="true"]')).toBeNull();
	});
});

it('R217.S27/R33 writes welcome text on blur on the Experience Card, its only home', async () => {
	await remountRouteWith(await seededExperienceProject());
	await enterExperience();
	experienceFocus.select({ kind: 'experience' });
	await frame();

	const welcome = card()!.querySelector<HTMLTextAreaElement>('textarea')!;
	expect(welcome.maxLength).toBe(600);
	welcome.value = 'Welcome to the gallery.';
	welcome.dispatchEvent(new Event('input', { bubbles: true }));
	await frame();
	welcome.dispatchEvent(new FocusEvent('blur'));
	await vi.waitFor(() => expect(
		stageExperience(facade().snapshot()).experiences[0]?.welcome
	).toEqual({ kind: 'plain', body: 'Welcome to the gallery.' }));
});
