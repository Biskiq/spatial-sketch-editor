// @vitest-environment jsdom
/** Mounted host pointer contract. Reuses the source-replacement route probes and
 * virtual-module aliases; boot, Camera, facade, Layout adapter and F4 are real.
 * Only WebGL/Head rendering and local network IO are doubled. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
const harness = vi.hoisted(() => ({ document: null as unknown, facade: null as unknown, host: null as unknown }));
vi.mock('$lib/authoring/stage/stage-facade', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/stage-facade')>();
	return { ...actual, createStageFacade: (...args: Parameters<typeof actual.createStageFacade>) => {
			const facade = actual.createStageFacade(...args);
			harness.facade = facade;
			return facade;
		} };
});
vi.mock('$lib/authoring/stage/host-acceptance', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/host-acceptance')>();
	return { ...actual, createStageAcceptanceHost: (...args: Parameters<typeof actual.createStageAcceptanceHost>) => {
			const host = actual.createStageAcceptanceHost(...args);
			harness.host = host;
			return host;
		} };
});
vi.mock('$lib/authoring/stage/shell/EditorHead.svelte', async () => ({ default: (await import('./fixtures/HeadProbe.svelte')).default }));
vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({ default: (await import('./fixtures/StageCanvasProbe.svelte')).default }));
vi.mock('$lib/platform/project-persistence', async (original) => {
	const actual = await original<typeof import('$lib/platform/project-persistence')>();
	return { ...actual, createProjectAuth: () => ({ getSession: async () => ({ authenticated: false }), signIn() { }, async signOut() { } }),
		createProjectApi: () => ({ async loadProject() { return { document: harness.document, savedBaseToken: 'base', savedRevision: { projectId: 'project-1', revisionId: 'revision-1' }, savedSourceContentId: 'content-1' }; } }) };
});
import { mount, tick, unmount } from 'svelte';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { layoutCapturedId } from '@portfolio/layout-core';
import {
	buildStarterEnclosureLayout,
	STARTER_TEMPLATE_ID_CAPTURE
} from '$lib/authoring/stage/starter-gallery';

/** The starter keeps its fixed captured identity across every boot. */
const STARTER_WALL_2 = layoutCapturedId(STARTER_TEMPLATE_ID_CAPTURE, 'wall-chain-2');
import { pausedWallProposal } from '$lib/authoring/adapters/layout/paused-proposal';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';
const RECT = { left: 352, top: 73, width: 928, height: 720, right: 1280, bottom: 793, x: 352, y: 73, toJSON() { } };
let component: ReturnType<typeof mount>;
let target: HTMLElement;
let frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let wallId: string;
let captureDescriptor: PropertyDescriptor | undefined;
const facade = () => harness.facade as StageFacade;
const button = (text: string) => {
	const found = [...target.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent)?.replace(/\s+/g, '').toLowerCase() === text.replace(/\s+/g, '').toLowerCase());
	if (!found)
		throw new Error(`Missing button ${text}`);
	return found;
};
const stage = () => target.querySelector<HTMLElement>('.stage')!;
async function frame() {
	await tick();
	const pending = [...frames.values()];
	frames.clear();
	for (const callback of pending)
		callback(performance.now());
	await tick();
}
async function settled() { await tick(); await new Promise(r => setTimeout(r, 0)); await frame(); }
function projected(point: readonly [
	number,
	number,
	number
]): [
	number,
	number
] {
	const result = facade().projectWorld(point, facade().evaluationId()!);
	if (result.kind !== 'projected')
		throw new Error(JSON.stringify(result));
	return [...result.css];
}
function pointer(type: string, point: readonly [
	number,
	number
], shift = false) {
	// jsdom has no native PointerEvent/capture. Dispatch the DOM event to the real route handlers.
	const event = new MouseEvent(type, { bubbles: true, clientX: point[0], clientY: point[1], shiftKey: shift });
	Object.defineProperty(event, 'pointerId', { value: 1 });
	stage().dispatchEvent(event);
}
const history = () => target.querySelector<HTMLElement>('[data-testid="head"]')!.dataset;
function key(key: string) { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); }
async function startDrag() {
	const end = projected([7, 0, -4]);
	pointer('pointerdown', end, true);
	await frame();
	expect(facade().session.gesture()).not.toBeNull();
	const desired = projected([7, 0, -3.7]);
	pointer('pointermove', desired, true);
	await frame();
	expect([...target.querySelectorAll('.marker')].some(e => e.textContent?.includes('Angle'))).toBe(true);
	return desired;
}
beforeEach(async () => {
	frames = new Map();
	frameId = 0;
	const layout = buildStarterEnclosureLayout();
	wallId = layout.walls[0]!.id;
	harness.document = await createUnitProject({ id: 'project-1', name: 'Mounted gestures', layout });
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++frameId, cb); return frameId; });
	vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
	vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() { }, removeEventListener() { } }));
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(RECT.width);
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(RECT.height);
	captureDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'setPointerCapture');
	Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: () => { } });
	target = document.createElement('div');
	document.body.append(target);
	component = mount(Page, { target });
	await vi.waitFor(() => expect(target.querySelector('[data-testid="stage-canvas"]')).not.toBeNull());
	await frame();
	button('Plan').click();
	await frame();
	button('Fit').click();
	await frame();
	const center = projected([3.5, 0, -4]);
	pointer('pointerdown', center);
	pointer('pointerup', center);
	pointer('click', center);
	await frame();
	expect(facade().selection()?.sourceId).toBe(wallId);
	// T1.P02.S02: the Wall's own Card carries its fields and a handle press is direct
	// manipulation, so this contract runs with **no** contributed task open — an
	// adapter's gesture is offered the press first either way.
	await settled();
});
afterEach(() => {
	unmount(component);
	target.remove();
	if (captureDescriptor === undefined)
		Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
	else
		Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', captureDescriptor);
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
describe('mounted Stage pointer lifecycle', () => {
	it('selects a located Index row without passing a reactive proxy to immutable selection', async () => {
		const row = [...target.querySelectorAll<HTMLButtonElement>('.item-row')].find(b => b.textContent?.includes(STARTER_WALL_2))!;
		row.click();
		await frame();
		expect(facade().selection()?.sourceId).toBe(STARTER_WALL_2);
	});
	it('hits and echoes the same Wall with an offset Stage', async () => {
		const plan = facade().plan();
		if (plan.kind !== 'evaluated')
			throw new Error('no Plan');
		const fragment = plan.plan.fragments.find(f => f.ref.sourceId === wallId)!;
		const geometry = fragment.geometry;
		const points = geometry.kind === 'span' ? [geometry.start, geometry.end] : geometry.kind === 'polyline' ? geometry.polyline : geometry.polygon;
		const center = points.reduce((sum, p) => [sum[0]! + p[0] / points.length, sum[1]! + p[1] / points.length], [0, 0]);
		const point = projected([center[0]!, fragment.elevationMeters, center[1]!]);
		const transform = target.querySelector('.selection')!.getAttribute('transform')!;
		const coords = transform.match(/translate\(([^ ]+) ([^)]+)\)/)!;
		expect(Number(coords[1])).toBeCloseTo(point[0] - RECT.left, 8);
		expect(Number(coords[2])).toBeCloseTo(point[1] - RECT.top, 8);
		expect(facade().selection()?.sourceId).toBe(wallId);
	});
	it('commits one uninterrupted drag across ordinary Camera evaluation updates', async () => {
		const baseline = facade().snapshot().canonicalJson;
		const id = facade().evaluationId();
		const point = await startDrag();
		expect(facade().evaluationId()).not.toBe(id);
		expect(target.textContent).not.toContain('Paused after a reading change');
		pointer('pointerup', point, true);
		await vi.waitFor(() => expect(facade().snapshot().canonicalJson).not.toBe(baseline));
		await frame();
		expect(history().canUndo).toBe('true');
		expect(history().canRedo).toBe('false');
		expect((harness.host as StageAcceptanceHost).history()).toMatchObject({ depth: 2, position: 1 });
	});
	it('keeps the press projection stable when navigation is requested during an adapter drag', async () => {
		const point = await startDrag();
		const pose = facade().camera.state().pose;
		stage().dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
		button('Fit').click();
		key('ArrowRight');
		await frame();
		expect(facade().camera.state().pose).toEqual(pose);
		pointer('pointermove', point, true);
		pointer('pointerup', point, true);
		await vi.waitFor(() => expect((harness.host as StageAcceptanceHost).history().depth).toBe(2));
	});
	it('preserves the exact paused request on a genuine reading flip, ignores stale up, then resumes once', async () => {
		const baseline = facade().snapshot().canonicalJson;
		const point = await startDrag();
		key('3');
		await frame();
		pointer('pointerup', point, true);
		await frame();
		expect(facade().snapshot().canonicalJson).toBe(baseline);
		expect(history().canUndo).toBe('false');
		const paused = pausedWallProposal(facade().snapshot().domain.unitRevisions.layout, wallId);
		expect(paused).not.toBeNull();
		expect(button('Resume')).toBeDefined();
		expect(button('Discard')).toBeDefined();
		const request = paused!.request;
		expect(request.kind).toBe('angle');
		const accept = vi.spyOn(harness.host as StageAcceptanceHost, 'accept');
		button('Resume').click();
		await vi.waitFor(() => expect(facade().snapshot().canonicalJson).not.toBe(baseline));
		await frame();
		expect(facade().snapshot().canonicalJson).not.toBe(baseline);
		expect(history().canUndo).toBe('true');
		button('Plan').click();
		await frame();
		expect(facade().evaluation()?.settledReading).toBe('plan');
		expect(target.querySelector('.instrument')).toBeNull();
		expect([...target.querySelectorAll('.marker')].some(e => e.textContent?.includes('Paused'))).toBe(false);
		expect(accept).toHaveBeenCalledTimes(1);
		expect(accept.mock.calls[0]![0]).toMatchObject({ payload: { angleRadians: request.kind === 'angle' ? request.angleRadians : NaN } });
		expect((harness.host as StageAcceptanceHost).history()).toMatchObject({ depth: 2, position: 1 });
	});
	it('discards a reading-interrupted proposal without history or a stale release commit', async () => {
		const baseline = facade().snapshot().canonicalJson;
		const point = await startDrag();
		button('3D').click();
		await frame();
		button('Discard').click();
		await frame();
		pointer('pointerup', point, true);
		await frame();
		expect(facade().snapshot().canonicalJson).toBe(baseline);
		expect(history().canUndo).toBe('false');
		expect(pausedWallProposal(facade().snapshot().domain.unitRevisions.layout, wallId)).toBeNull();
	});
	it.each(['pointercancel', 'lostpointercapture', 'Escape'])('cancels %s without a proposal or history', async (type) => {
		const baseline = facade().snapshot().canonicalJson;
		const point = await startDrag();
		if (type === 'Escape')
			key(type);
		else
			pointer(type, point);
		pointer('pointerup', point);
		await frame();
		expect(facade().snapshot().canonicalJson).toBe(baseline);
		expect(history().canUndo).toBe('false');
		expect(pausedWallProposal(facade().snapshot().domain.unitRevisions.layout, wallId)).toBeNull();
	});
});

/**
 * The shell's dock/Ink/Delete wiring, driven through the **mounted route**.
 *
 * These are the caller-level facts the adapter suite cannot prove: that a tool is
 * armed from the dock with nothing selected, that its taps reach the adapter and
 * never re-select underneath it, that `Enter` finishes and the tool survives the
 * install it caused, that `Escape` unwinds palette-first, and that `Delete`
 * discloses a Wall's consequences before the second press runs it.
 */
describe('mounted Stage drawing and deletion', () => {
	/** One dock key, by its contributed entry id — the dock shows adapter labels. */
	function dockKey(id: string): HTMLButtonElement {
		const key = target.querySelector<HTMLButtonElement>(`[data-dock-tool="${id}"]`);
		if (key === null)
			throw new Error(`Missing dock key ${id}`);
		return key;
	}

	async function drawPoint(point: readonly [number, number, number]) {
		const css = projected(point);
		pointer('pointerdown', css);
		pointer('pointerup', css);
		pointer('click', css);
		await frame();
	}

	it('arms Ink from the dock, taps points without re-selecting, and finishes with Enter', async () => {
		const before = facade().selection()?.sourceId;
		const pose = facade().camera.state().pose;
		// Nothing is selected-and-invoked first: the dock is how a tool is armed.
		dockKey('layout-ink').click();
		await settled();
		expect(dockKey('layout-ink').getAttribute('aria-pressed')).toBe('true');
		expect(target.querySelector('[data-layout-ink-palette]')).not.toBeNull();
		expect(facade().session.task()?.kind).toBe('layout-ink');

		await drawPoint([2, 0, -1]);
		await drawPoint([5, 0, -1]);
		// An armed tool's taps are its own gesture: they place points and never move
		// the selection or the view underneath it.
		expect(facade().selection()?.sourceId).toBe(before);
		expect(facade().camera.state().pose).toEqual(pose);
		expect(inkSurface()?.snapshot().points).toHaveLength(2);

		const canonical = facade().snapshot().canonicalJson;
		key('Enter');
		await vi.waitFor(() => expect(facade().snapshot().canonicalJson).not.toBe(canonical));
		await frame();
		await settled();
		// One chain, one undo entry, and the same tool is armed against the installed
		// source — the install closed its task and the host re-armed the dock's key.
		expect((harness.host as StageAcceptanceHost).history()).toMatchObject({ depth: 2, position: 1 });
		expect(facade().session.task()?.kind).toBe('layout-ink');
		expect(target.querySelector('[data-layout-ink-palette]')).not.toBeNull();

		// The Head is a probe in this suite, so Undo runs through the host it drives.
		expect(await (harness.host as StageAcceptanceHost).undo()).toMatchObject({ kind: 'installed' });
		expect(facade().snapshot().canonicalJson).toBe(canonical);
	});

	it('cancels the live chain before it disarms the tool, then unwinds on the next Escape', async () => {
		dockKey('layout-ink').click();
		await settled();
		const canonical = facade().snapshot().canonicalJson;
		await drawPoint([2, 0, -1]);
		expect(inkSurface()?.snapshot().points).toHaveLength(1);

		// Palette-first: the chain ends here and the tool stays armed, so no proposal
		// survives as an invisible block on history.
		key('Escape');
		await frame();
		expect(inkSurface()?.snapshot().points).toHaveLength(0);
		expect(facade().session.task()?.kind).toBe('layout-ink');
		expect(history().canUndo).toBe('false');
		expect(facade().snapshot().canonicalJson).toBe(canonical);

		// The next unwind is the tool's: it disarms and leaves Select.
		key('Escape');
		await frame();
		expect(facade().session.task()).toBeNull();
		expect(target.querySelector('[data-layout-ink-palette]')).toBeNull();
	});

	it('names the Wall deletion and its Room consequence from the keyboard before running it', async () => {
		const canonical = facade().snapshot().canonicalJson;
		key('Delete');
		await frame();
		const notice = [...target.querySelectorAll('.stage-note')]
			.map((node) => node.textContent ?? '')
			.join(' ');
		expect(notice).toContain('Delete Wall');
		// The disclosure is the planner's own words: this Wall closes the enclosure.
		expect(notice).toContain('retires 1 Room');
		expect(facade().snapshot().canonicalJson).toBe(canonical);

		// Escape keeps the Wall and spends the offer.
		key('Escape');
		await frame();
		expect(facade().snapshot().canonicalJson).toBe(canonical);

		// The Wall is still selected, and the second Delete press runs it.
		key('Delete');
		await frame();
		key('Delete');
		await vi.waitFor(() => expect(facade().snapshot().canonicalJson).not.toBe(canonical));
		await frame();
		expect((harness.host as StageAcceptanceHost).history()).toMatchObject({ depth: 2, position: 1 });
	});
});
