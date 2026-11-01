// @vitest-environment jsdom
/** Mounted host pointer contract. Reuses the source-replacement route probes and
 * virtual-module aliases; boot, Camera, facade, Layout adapter and F4 are real.
 * Only WebGL/Head rendering and local network IO are doubled. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
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
import { readFileSync } from 'node:fs';
import { mount, tick, unmount } from 'svelte';
import { captureUnitSave } from '@portfolio/project-model/units';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import { layoutCapturedId, planCreateWallFirstOpening } from '@portfolio/layout-core';
import {
	buildStarterEnclosureLayout,
	STARTER_TEMPLATE_ID_CAPTURE
} from '$lib/authoring/stage/starter-gallery';

/** The starter keeps its fixed captured identity across every boot. */
const STARTER_WALL_2 = layoutCapturedId(STARTER_TEMPLATE_ID_CAPTURE, 'wall-chain-2');
import { pausedWallProposal } from '$lib/authoring/adapters/layout/paused-proposal';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import {
	draftingSnapIncrementMeters,
	metersPerCssPixelForScaleRatio
} from '$lib/authoring/stage/stage-drafting';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';
const RECT = { left: 352, top: 73, width: 928, height: 720, right: 1280, bottom: 793, x: 352, y: 73, toJSON() { } };
let component: ReturnType<typeof mount>;
let target: HTMLElement;
let frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let wallId: string;
let captureDescriptor: PropertyDescriptor | undefined;
const facade = () => harness.facade as StageFacade;
const currentSnapLabel = () =>
	draftingSnapIncrementMeters(facade().session.drafting()) === null ? 'Snap off' : 'Snap';
const button = (text: string) => {
	const found = [...target.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent)?.replace(/\s+/g, '').toLowerCase() === text.replace(/\s+/g, '').toLowerCase());
	if (!found)
		throw new Error(`Missing button ${text}`);
	return found;
};
/**
 * The Index row for one canonical source. The row's `li` carries the identity (its
 * Layout form is `layout:<kind>:<id>`, so a bare id names the same row); its select
 * control is `.item-row`, which is labelled with the subject's name.
 */
function indexRowOf(root: ParentNode, sourceId: string): HTMLButtonElement | null {
	const row = [...root.querySelectorAll<HTMLElement>('.item[data-source-id]')].find((item) => {
		const identity = item.getAttribute('data-source-id') ?? '';
		return identity === sourceId || identity.endsWith(`:${sourceId}`);
	});
	return row?.querySelector<HTMLButtonElement>('.item-row') ?? null;
}
const stage = () => target.querySelector<HTMLElement>('.stage')!;
/** Fit is the lower-right cluster's own button (O8). */
async function fitAll() {
	const fit = target.querySelector<HTMLButtonElement>('[data-stage-fit]');
	if (fit === null) throw new Error('Missing Fit control');
	fit.click();
	await tick();
}
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
], shift = false, id = 1, pointerType = 'mouse') {
	// jsdom has no native PointerEvent/capture. Dispatch the DOM event to the real route handlers.
	const event = new MouseEvent(type, { bubbles: true, clientX: point[0], clientY: point[1], shiftKey: shift });
	Object.defineProperty(event, 'pointerId', { value: id });
	Object.defineProperty(event, 'pointerType', { value: pointerType });
	stage().dispatchEvent(event);
}
const history = () => target.querySelector<HTMLElement>('[data-testid="head"]')!.dataset;
function key(key: string) { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); }
/** A projected Wall that is not the selected one, so its hover is not a mark. */
function anotherWall(): { readonly id: string; readonly css: [number, number] } {
	const plan = facade().plan();
	if (plan.kind !== 'evaluated') throw new Error('no Plan');
	const fragment = plan.plan.fragments.find((f) => f.ref.sourceKind === 'wall' && f.ref.sourceId !== wallId)!;
	const geometry = fragment.geometry;
	const points = geometry.kind === 'span' ? [geometry.start, geometry.end] : geometry.kind === 'polyline' ? geometry.polyline : geometry.polygon;
	const center = points.reduce((sum, p) => [sum[0]! + p[0] / points.length, sum[1]! + p[1] / points.length], [0, 0]);
	return { id: fragment.ref.sourceId, css: projected([center[0]!, fragment.elevationMeters, center[1]!]) };
}

async function startDrag() {
	// R217.S15 — the end point now moves the shared Junction; the measure ray is
	// the outward grip at that end. Marks are already in Stage-local CSS; pointer
	// intents add the accepted Stage rect.
	const ray = facade().marks().find((mark) => mark.id === 'layout-wall-length');
	if (ray?.tip === null || ray?.tip === undefined) throw new Error('the Wall length ray is not projected');
	const press: [number, number] = [ray.tip[0] + RECT.left, ray.tip[1] + RECT.top];
	pointer('pointerdown', press);
	await frame();
	expect(facade().session.gesture()).not.toBeNull();
	const desired = projected([5.5, 0, -4]);
	pointer('pointermove', desired);
	await frame();
	expect([...target.querySelectorAll('.marker')].some(e => e.textContent?.includes('Length'))).toBe(true);
	return desired;
}

async function mountRoute(layout = buildStarterEnclosureLayout()): Promise<void> {
	wallId = layout.walls[0]!.id;
	harness.document = await createUnitProject({ id: 'project-1', name: 'Mounted gestures', layout });
	target = document.createElement('div');
	document.body.append(target);
	component = mount(Page, { target });
	await vi.waitFor(() => expect(target.querySelector('[data-testid="stage-canvas"]')).not.toBeNull());
	await frame();
	button('2D').click();
	await frame();
	await fitAll();
	await frame();
}

async function selectFirstWall(): Promise<void> {
	const center = projected([3.5, 0, -4]);
	pointer('pointerdown', center);
	pointer('pointerup', center);
	pointer('click', center);
	await frame();
	expect(facade().selection()?.sourceId).toBe(wallId);
}

beforeEach(async () => {
	frames = new Map();
	frameId = 0;
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++frameId, cb); return frameId; });
	vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
	vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion'), addEventListener() { }, removeEventListener() { } }));
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(RECT.width);
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(RECT.height);
	captureDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'setPointerCapture');
	Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: () => { } });
	await mountRoute();
	await selectFirstWall();
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
	it('moves every registered task entry to Find or the dock and leaves the Index a locator', () => {
		// The host's own dock keys (Select, Measure, Eraser) are Find entries too.
		const registered = [
			...facade().findEntries().map((entry) => `${entry.adapterId}:${entry.id}`),
			'project-replacement:starter',
			'host:host-select',
			'host:host-measure',
			'host:host-erase'
		].sort();
		const reachable = [...target.querySelectorAll<HTMLElement>('[data-head-find] [data-find-id]')]
			.filter((entry) => entry.dataset.findAdapter !== 'subject')
			.map((entry) => `${entry.dataset.findAdapter}:${entry.dataset.findId}`).sort();
		// O8: the five Scale detents are Find entries now that Scale left the toolbar.
		const detents = [20, 50, 100, 200, 500].map((ratio) => `scale:scale:${ratio}`);
		// R217.S20: every former ☰ capability, and Keys, is a Find entry too.
		const formerMenu = [
			'preference:appearance:paper',
			'preference:appearance:shaded',
			'preference:height-sheet:right',
			'preference:height-sheet:left',
			'preference:reduce-motion',
			'preference:motion-speed:slow',
			'preference:motion-speed:normal',
			'preference:motion-speed:fast',
			'keys:keys',
			'project-menu:rename',
			'project-menu:delete',
			'project-menu:download',
			'project-menu:source'
		];
		expect(reachable).toEqual([...registered, ...detents, ...formerMenu].sort());
		expect(target.querySelector('[data-plate-landmark="index"] .contributed-group')).toBeNull();
	});
	it('changes a browser preference without changing project source or history', async () => {
		const before = facade().snapshot().canonicalJson;
		const historyBefore = (harness.host as StageAcceptanceHost).history();
		// R217.S20: Reduce motion lives in the Stage's ⚙ now, and writes the same preference.
		target.querySelector<HTMLButtonElement>('[data-stage-viewing]')!.click();
		await frame();
		const motion = target.querySelector<HTMLInputElement>('[data-stage-viewing-panel] input[type="checkbox"]')!;
		const motionBefore = motion.checked;
		motion.click();
		await frame();
		expect(motion.checked).toBe(!motionBefore);
		expect(facade().snapshot().canonicalJson).toBe(before);
		expect((harness.host as StageAcceptanceHost).history()).toEqual(historyBefore);
	});
	it('panel changes and viewport resize do not request Camera framing', async () => {
		const stageFacade = facade();
		const request = vi.spyOn(stageFacade, 'requestViewingIntent');
		const before = stageFacade.camera.state().pose;
		target.querySelector<HTMLButtonElement>('[data-head-index]')!.click();
		await frame();
		expect(target.querySelector('[data-plate-landmark="index"]')?.hasAttribute('hidden')).toBe(true);
		target.querySelector<HTMLButtonElement>('[data-head-location]')!.click();
		await frame();
		button('Collapse').click();
		await frame();
		button('Expand').click();
		await frame();
		const place = [...target.querySelectorAll<HTMLButtonElement>('[data-head-find] button')].find((item) => item.textContent?.includes('Place plinth'))!;
		place.click();
		await frame();
		vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1024);
		await frame();
		expect(stageFacade.camera.state().pose).toEqual(before);
		expect(request).not.toHaveBeenCalled();
	});
	it('selects a located Index row without passing a reactive proxy to immutable selection', async () => {
		const row = indexRowOf(target, STARTER_WALL_2)!;
		row.click();
		await frame();
		expect(facade().selection()?.sourceId).toBe(STARTER_WALL_2);
	});
	it('keeps Stage, Card and Index on the same selected identity with an offset Stage', async () => {
		// The placeholder gold dot is gone; identity is echoed by the Card and the
		// Index rather than by a second projection marker.
		expect(target.querySelector('.selection')).toBeNull();
		expect(facade().selection()?.sourceId).toBe(wallId);
		// The Card and the Index show the subject's name; its canonical identity is the
		// row's `data-source-id` and the Card's, never visible text.
		const card = target.querySelector('[aria-label="Selected subject"]');
		expect(card?.getAttribute('data-source-id')).toBe(wallId);
		const index = target.querySelector('[data-plate-landmark="index"]');
		expect(indexRowOf(index as HTMLElement, wallId)?.getAttribute('aria-current')).toBe('true');
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
		await fitAll();
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
		expect(request.kind).toBe('length');
		const accept = vi.spyOn(harness.host as StageAcceptanceHost, 'accept');
		button('Resume').click();
		await vi.waitFor(() => expect(facade().snapshot().canonicalJson).not.toBe(baseline));
		await frame();
		expect(facade().snapshot().canonicalJson).not.toBe(baseline);
		expect(history().canUndo).toBe('true');
		button('2D').click();
		await frame();
		expect(facade().evaluation()?.settledReading).toBe('plan');
		expect(target.querySelector('.instrument')).toBeNull();
		expect([...target.querySelectorAll('.marker')].some(e => e.textContent?.includes('Paused'))).toBe(false);
		expect(accept).toHaveBeenCalledTimes(1);
		expect(accept.mock.calls[0]![0]).toMatchObject({ payload: { length: request.kind === 'length' ? request.length : NaN, fixed: 'start' } });
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
	it('resolves hover once per frame without changing selection, history, or source', async () => {
		const baseline = facade().snapshot().canonicalJson;
		const selection = facade().selectionState();
		const other = anotherWall();
		pointer('pointermove', other.css);
		await frame();
		const hover = facade().session.hover();
		expect(hover?.reference.subject.id).toBe(other.id);
		expect(facade().selectionState()).toEqual(selection);
		expect(facade().snapshot().canonicalJson).toBe(baseline);
		expect(history().canUndo).toBe('false');
		pointer('pointerdown', other.css); pointer('pointerup', other.css); pointer('click', other.css);
		await frame();
		expect(facade().selectionState().primary?.subject.id).toBe(hover?.reference.subject.id);
		pointer('pointermove', other.css, false, 4, 'touch');
		await frame();
		expect(facade().session.hover()).toBeNull();
	});
	it('lets an open tool own hover before the host updates it', async () => {
		const point = anotherWall().css;
		pointer('pointermove', point); await frame();
		expect(facade().session.hover()).not.toBeNull();
		const hover = vi.fn(() => true);
		facade().registerStageAdapter({ id: 'hover-probe', tasks: [{ id: 'hover-probe-task', taskKind: 'hover-probe-task', label: 'Probe' }], hoverIntent: hover });
		expect(facade().openContributedTask('hover-probe-task', 'hover-probe').kind).toBe('opened');
		pointer('pointermove', point); await frame();
		expect(hover).toHaveBeenCalledOnce();
		expect(facade().session.hover()).toBeNull();
	});
	it('reports the active drag reason and saves only the accepted source', async () => {
		const host = harness.host as StageAcceptanceHost;
		const before = await captureUnitSave({ snapshot: host.coordinator().acceptedSnapshot(), operationId: 'before', precondition: { kind: 'create-only' } });
		await startDrag();
		await frame();
		const reason = facade().session.liveProposal()?.reason;
		expect(reason).toBeTruthy();
		expect(history().undoReason).toBe(reason);
		const during = await captureUnitSave({ snapshot: host.coordinator().acceptedSnapshot(), operationId: 'during', precondition: { kind: 'create-only' } });
		expect(before.kind).toBe('captured'); expect(during.kind).toBe('captured');
		if (before.kind === 'captured' && during.kind === 'captured') expect(during.capture.canonicalJson).toBe(before.capture.canonicalJson);
		window.dispatchEvent(new Event('blur'));
		await frame();
		expect(facade().session.liveProposal()).toBeNull();
		expect(history().undoReason).not.toBe(reason);
	});
	it('cancels a Wall drag when a second touch starts, then navigates by pinch', async () => {
		const baseline = facade().snapshot().canonicalJson;
		const selected = facade().selectionState();
		const first = await startDrag();
		const second: [number, number] = [first[0] + 100, first[1]];
		pointer('pointerdown', second, false, 2, 'touch');
		await frame();
		expect(facade().session.gesture()?.navigation).toBe(true);
		expect(facade().session.liveProposal()).toBeNull();
		const before = facade().camera.state().pose.targetPlaneHeightMeters;
		pointer('pointermove', [second[0] + 40, second[1]], false, 2, 'touch');
		await frame();
		expect(facade().camera.state().pose.targetPlaneHeightMeters).toBeLessThan(before);
		pointer('pointerup', second, false, 2, 'touch');
		await frame();
		expect(facade().session.gesture()).toBeNull();
		expect(facade().snapshot().canonicalJson).toBe(baseline);
		expect(facade().selectionState()).toEqual(selected);
		expect(history().canUndo).toBe('false');
	});
	it.each(['blur', 'hidden', 'pointercancel', 'lostpointercapture', 'Escape', 'second-pointer'])('cancels a Scene drag on %s without an accepted change', async (type) => {
		unmount(component); target.replaceChildren();
		const scene = { formatVersion: 1 as const, textures: [], materials: [], navigationNodes: [], connections: [], entities: [{
			kind: 'primitive' as const, primitive: 'box' as const, id: 'gesture-box', name: 'Box', dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'plaster-warm' as const, castShadow: true, receiveShadow: true, position: [2, .5, -2] as [number, number, number], rotation: [0, 0, 0] as [number, number, number]
		}] };
		harness.document = await createUnitProject({ id: 'project-1', name: 'Scene gesture', layout: buildStarterEnclosureLayout(), scene });
		component = mount(Page, { target });
		await vi.waitFor(() => expect(target.querySelector('[data-testid="stage-canvas"]')).not.toBeNull());
		await frame();
		const reference = sceneEntityReference('gesture-box', facade().snapshot().domain.unitRevisions.scene);
		expect(facade().setSelection({ ordered: [{ reference }], primary: reference }).kind).toBe('selected');
		// Object manipulation is direct: no Arrange task exists, and a press on the
		// admitted Move mark claims its own writer lease.
		const move = facade().marks().find((mark) => mark.id === 'scene-object-move');
		expect(move).toBeDefined();
		const selected = facade().selectionState();
		const baseline = facade().snapshot().canonicalJson;
		const point: [number, number] = [RECT.left + move!.anchor[0], RECT.top + move!.anchor[1]];
		pointer('pointerdown', point);
		expect(facade().session.gesture()).not.toBeNull();
		pointer('pointermove', [point[0] + 30, point[1]], true);
		if (type === 'blur') window.dispatchEvent(new Event('blur'));
		else if (type === 'hidden') { vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')); }
		else if (type === 'Escape') key(type);
		else if (type === 'second-pointer') {
			pointer('pointerdown', [point[0] + 100, point[1]], false, 2, 'touch');
			expect(facade().session.gesture()?.navigation).toBe(true);
			pointer('pointerup', [point[0] + 100, point[1]], false, 2, 'touch');
		}
		else pointer(type, point);
		await frame();
		expect(facade().session.gesture()).toBeNull();
		expect(facade().session.liveProposal()).toBeNull();
		expect(facade().snapshot().canonicalJson).toBe(baseline);
		expect(facade().selectionState()).toEqual(selected);
		expect((harness.host as StageAcceptanceHost).history().depth).toBe(1);
		pointer('pointerdown', point);
		expect(facade().session.gesture()).not.toBeNull();
		pointer('pointercancel', point);
	});
	it.each(['blur', 'hidden', 'pointercancel', 'lostpointercapture', 'Escape'])('ends navigation on %s and permits an immediate new press', async (type) => {
		const point: [number, number] = [RECT.left + 25, RECT.top + 25];
		const baseline = facade().snapshot().canonicalJson;
		const selected = facade().selectionState();
		pointer('pointerdown', point);
		expect(facade().session.gesture()?.navigation).toBe(true);
		pointer('pointermove', [point[0] + 10, point[1] + 10]);
		if (type === 'blur') window.dispatchEvent(new Event('blur'));
		else if (type === 'hidden') { vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')); }
		else if (type === 'Escape') key(type);
		else pointer(type, point);
		await frame();
		expect(facade().session.gesture()).toBeNull();
		expect(facade().snapshot().canonicalJson).toBe(baseline);
		expect(facade().selectionState()).toEqual(selected);
		pointer('pointerdown', point);
		expect(facade().session.gesture()?.navigation).toBe(true);
		pointer('pointerup', point);
	});
	it.each(['blur', 'hidden'])('interrupts a Wall drag on %s and permits a new press', async (type) => {
		const baseline = facade().snapshot().canonicalJson;
		const selected = facade().selectionState();
		await startDrag();
		if (type === 'blur') window.dispatchEvent(new Event('blur'));
		else {
			vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
			document.dispatchEvent(new Event('visibilitychange'));
		}
		await frame();
		expect(facade().snapshot().canonicalJson).toBe(baseline);
		expect(facade().selectionState()).toEqual(selected);
		expect(facade().session.gesture()).toBeNull();
		expect(facade().session.liveProposal()).toBeNull();
		expect(history().canUndo).toBe('false');
		await startDrag();
		expect(facade().session.gesture()).not.toBeNull();
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

	/** Select a subject through the Index, as a creator does. */
	async function selectIndexRow(sourceId: string) {
		const row = indexRowOf(target, sourceId);
		if (row === null) throw new Error(`Missing Index row ${sourceId}`);
		row.click();
		await frame();
	}

	/** Invoke a contributed task from Find by its visible row label. */
	async function invokeIndexTask(label: string): Promise<void> {
		const row = [...target.querySelectorAll<HTMLButtonElement>('[data-head-find] .find-results button')].find(
			(item) => item.textContent?.includes(label)
		);
		if (row === undefined) throw new Error(`Missing contributed row ${label}`);
		row.click();
		await settled();
	}

	/** The projected center of one Wall, for a press that resolves to it. */
	function wallCenterCss(sourceId: string): readonly [number, number] {
		const plan = facade().plan();
		if (plan.kind !== 'evaluated') throw new Error('no Plan');
		const fragment = plan.plan.fragments.find((candidate) => candidate.ref.sourceId === sourceId);
		if (fragment === undefined) throw new Error(`Missing Plan fragment ${sourceId}`);
		const geometry = fragment.geometry;
		const points =
			geometry.kind === 'span'
				? [geometry.start, geometry.end]
				: geometry.kind === 'polyline'
					? geometry.polyline
					: geometry.polygon;
		const center = points.reduce(
			(sum, point) => [sum[0]! + point[0] / points.length, sum[1]! + point[1] / points.length],
			[0, 0]
		);
		return projected([center[0]!, fragment.elevationMeters, center[1]!]);
	}

	/** The Card's own scoped action for the selected Wall. */
	function deleteAction(): HTMLButtonElement {
		const action = target.querySelector<HTMLButtonElement>('[data-card-action="layout-wall-delete"]');
		if (action === null) throw new Error('the Card offers no Wall deletion');
		return action;
	}

	/** Every notice the Stage is showing, as one string. */
	function notices(): string {
		return [...target.querySelectorAll('.stage-note')].map((node) => node.textContent ?? '').join(' ');
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

	it.each(['blur', 'hidden'])('keeps an open Ink chain on %s', async (type) => {
		dockKey('layout-ink').click(); await settled();
		await drawPoint([2, 0, -1]); await drawPoint([5, 0, -1]);
		const points = structuredClone(inkSurface()!.snapshot().points);
		if (type === 'blur') window.dispatchEvent(new Event('blur'));
		else { vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')); }
		await frame();
		expect(inkSurface()?.snapshot().points).toEqual(points);
		expect(facade().session.liveProposal()).not.toBeNull();
	});
	it('leaves Enter to a focused palette control instead of finishing the chain', async () => {
		dockKey('layout-ink').click();
		await settled();
		await drawPoint([2, 0, -1]);
		await drawPoint([5, 0, -1]);
		const canonical = facade().snapshot().canonicalJson;
		const accept = vi.spyOn(harness.host as StageAcceptanceHost, 'accept');

		// Backtrack is enabled by the two live points. Enter on it is the button's
		// activation (backtrack in a browser), never the tool's Finish.
		const backtrack = target.querySelector<HTMLButtonElement>('[data-ink-backtrack]')!;
		expect(backtrack.disabled).toBe(false);
		backtrack.focus();
		backtrack.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await tick();

		expect(accept).not.toHaveBeenCalled();
		expect(facade().snapshot().canonicalJson).toBe(canonical);
		expect(inkSurface()?.snapshot().points).toHaveLength(2);
	});

	it('keeps the Ink palette collapsed after an accepted drawing re-arms it', async () => {
		dockKey('layout-ink').click();
		await settled();
		await drawPoint([2, 0, -1]);
		await drawPoint([5, 0, -1]);
		const canonical = facade().snapshot().canonicalJson;
		dockKey('layout-ink').click();
		await settled();
		expect(target.querySelector('[data-layout-ink-palette]')).toBeNull();
		key('Enter');
		await vi.waitFor(() => expect(facade().snapshot().canonicalJson).not.toBe(canonical));
		await settled();
		expect(facade().session.task()?.kind).toBe('layout-ink');
		expect(target.querySelector('[data-layout-ink-palette]')).toBeNull();
	});

	it('keeps Stage selection while a non-dock contributed task is open', async () => {
		const otherWall = wallCenterCss(STARTER_WALL_2);
		await invokeIndexTask('Place plinth');
		expect(facade().session.task()?.kind).toBe('layout-plinth-place');

		// The task owns the press, but a click that no adapter claimed is still the
		// host's own Select: T2's Compose/Arrange/Import tasks rely on that to reach
		// a subject after their instrument opens.
		pointer('pointerdown', otherWall);
		pointer('pointerup', otherWall);
		pointer('click', otherWall);
		await frame();
		expect(facade().selection()?.sourceId).toBe(STARTER_WALL_2);
	});

	it('does not re-arm the dock tool after another operation closes', async () => {
		dockKey('layout-ink').click();
		await settled();
		expect(facade().session.task()?.kind).toBe('layout-ink');
		dockKey('layout-ink').click();
		await settled();
		expect(target.querySelector('[data-stage-instrument]')).toBeNull();

		// Invoking another operation takes the lower column. When that task closes
		// (an install, a replacement or an explicit close), the tool the creator
		// left must not come back.
		await invokeIndexTask('Place plinth');
		expect(facade().session.task()?.kind).toBe('layout-plinth-place');
		expect(target.querySelector('[data-stage-instrument="layout-plinth-place"]')).not.toBeNull();
		facade().closeTask();
		await settled();
		expect(facade().session.task()).toBeNull();
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

		// R217.S10: the next Escape folds the open palette and keeps the tool armed…
		key('Escape');
		await frame();
		expect(facade().session.task()?.kind).toBe('layout-ink');
		expect(target.querySelector('[data-layout-ink-palette]')).toBeNull();
		expect(target.querySelector('[data-dock-caret]')).not.toBeNull();

		// …and the one after it disarms and leaves Select.
		key('Escape');
		await frame();
		expect(facade().session.task()).toBeNull();
		expect(target.querySelector('[data-layout-ink-palette]')).toBeNull();
	});

	/** R217.S10 — the dock's keys, shortcuts, Find and host tools through the route. */
	it('leaves Dock letters and 2 with the live numeric writer', async () => {
		const desired = await startDrag();
		const type = vi.spyOn(facade(), 'gestureKeyIntent');
		for (const letter of ['2', 'm', 'e', 'l', 'p', 'v']) key(letter);
		expect(type.mock.calls.map(([intent]) => intent)).toEqual(['2', 'm', 'e', 'l', 'p', 'v'].map(key => ({ kind: 'type', key })));
		expect(facade().evaluation()?.settledReading).toBe('plan');
		expect(facade().session.task()).toBeNull();
		pointer('pointercancel', desired);
		await frame();
	});

	it('arms every dock key by its shortcut and from Find without changing the selection', async () => {
		const before = facade().selectionState();
		for (const [letter, kind] of [['p', 'layout-ink'], ['m', 'host-measure'], ['e', 'host-erase'], ['l', 'place-object']] as const) {
			key(letter);
			await settled();
			expect(facade().session.task()?.kind, letter).toBe(kind);
			expect(facade().selectionState()).toEqual(before);
			expect(target.querySelectorAll('[data-stage-dock] [aria-pressed="true"]')).toHaveLength(1);
		}
		key('v');
		await settled();
		expect(facade().session.task()).toBeNull();
		expect(target.querySelector('[data-dock-select]')?.getAttribute('aria-pressed')).toBe('true');
		expect(facade().selectionState()).toEqual(before);
		// The dock order is the owner's: Select · Ink · Measure · Eraser | Library.
		expect([...target.querySelectorAll<HTMLElement>('[data-stage-dock] [data-dock-slot]')].map((node) => node.dataset.dockSlot))
			.toEqual(['select', 'ink', 'measure', 'erase', 'library']);
		// Find arms the same five keys with its Arm verb.
		for (const [id, kind] of [['host-measure', 'host-measure'], ['host-erase', 'host-erase'], ['layout-ink', 'layout-ink'], ['scene-place', 'place-object'], ['host-select', null]] as const) {
			target.querySelector<HTMLButtonElement>(`[data-head-find] [data-find-id="${id}"]`)!.click();
			await settled();
			expect(facade().session.task()?.kind ?? null, id).toBe(kind);
		}
		// `2` is now the Plan reading; `p` no longer flips it.
		key('3');
		await frame();
		key('p');
		await settled();
		expect(facade().evaluation()?.renderedReading).not.toBe('plan');
		key('Escape');
		key('Escape');
		await settled();
		key('2');
		await frame();
		await frame();
		expect(facade().evaluation()?.settledReading).toBe('plan');
	});

	it('measures with two clicks and writes nothing; Escape clears it, then disarms', async () => {
		const canonical = facade().snapshot().canonicalJson;
		key('m');
		await settled();
		await drawPoint([0, 0, 0]);
		await drawPoint([7, 0, 0]);
		const tag = target.querySelector<SVGElement>('[data-measure]');
		expect(tag?.getAttribute('data-measure-label')).toMatch(/ m$/);
		expect(facade().snapshot().canonicalJson).toBe(canonical);
		expect((harness.host as StageAcceptanceHost).history()).toMatchObject({ depth: 1, position: 0 });
		expect(facade().session.liveProposal()).toBeNull();
		key('Escape');
		await frame();
		expect(target.querySelector('[data-measure]')).toBeNull();
		expect(facade().session.task()?.kind).toBe('host-measure');
		key('Escape');
		await frame();
		expect(facade().session.task()).toBeNull();
	});

	it('draws the erase treatment only while the Eraser is armed, and erases a Wall after its disclosure', async () => {
		const otherWall = wallCenterCss(STARTER_WALL_2);
		pointer('pointermove', otherWall);
		await frame();
		expect(target.querySelector('[data-testid="stage-canvas"]')?.getAttribute('data-hover-tone')).toBe('hover');
		key('e');
		await settled();
		pointer('pointermove', [otherWall[0] + 1, otherWall[1]]);
		await frame();
		const canvas = () => target.querySelector<HTMLElement>('[data-testid="stage-canvas"]')!;
		expect(canvas().dataset.hoverTone).toBe('erase');
		expect(canvas().dataset.hoverId).toBe(STARTER_WALL_2);
		const canonical = facade().snapshot().canonicalJson;
		pointer('pointerdown', otherWall);
		pointer('pointerup', otherWall);
		pointer('click', otherWall);
		await settled();
		// The Wall closes the Room, so Layout's disclosure is read first.
		expect(target.querySelector('[data-erase-notice="disclose"]')).not.toBeNull();
		expect(facade().snapshot().canonicalJson).toBe(canonical);
		expect(facade().selection()?.sourceId).toBe(wallId);
		pointer('pointerdown', otherWall);
		pointer('pointerup', otherWall);
		pointer('click', otherWall);
		await vi.waitFor(() => expect(facade().snapshot().canonicalJson).not.toBe(canonical));
		await settled();
		expect((harness.host as StageAcceptanceHost).history()).toMatchObject({ depth: 2, position: 1 });
		// The Eraser stays armed against the installed source.
		expect(facade().session.task()?.kind).toBe('host-erase');
		key('Escape');
		await settled();
		key('Escape');
		await settled();
		expect(facade().session.task()).toBeNull();
		expect(canvas().dataset.hoverTone).toBe('hover');
		expect(await (harness.host as StageAcceptanceHost).undo()).toMatchObject({ kind: 'installed' });
		expect(facade().snapshot().canonicalJson).toBe(canonical);
	});

	it('keeps Measure and Eraser live across rendered frames during a press', async () => {
		key('m');
		await settled();
		const from = projected([0, 0, 0]);
		const to = projected([7, 0, 0]);
		pointer('pointerdown', from);
		await frame();
		pointer('pointermove', to);
		await frame();
		pointer('pointerup', to);
		await settled();
		expect(Number(target.querySelector('[data-measure]')?.getAttribute('data-measure-label')?.replace(' m', ''))).toBeCloseTo(7, 3);

		key('e');
		await settled();
		const wall = wallCenterCss(STARTER_WALL_2);
		pointer('pointerdown', wall);
		await frame();
		pointer('pointerup', wall);
		await settled();
		expect(target.querySelector('[data-erase-notice="disclose"]')).not.toBeNull();
	});

	it('refuses a Room floor beside the pointer with no entry', async () => {
		key('e');
		await settled();
		const canonical = facade().snapshot().canonicalJson;
		const floor = projected([2, 0, -2]);
		pointer('pointerdown', floor);
		pointer('pointerup', floor);
		pointer('click', floor);
		await settled();
		expect(target.querySelector('[data-erase-notice="refused"]')?.textContent).toContain('A Room floor cannot be erased.');
		expect(facade().snapshot().canonicalJson).toBe(canonical);
		expect((harness.host as StageAcceptanceHost).history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('opens the placement Instrument from the Library key', async () => {
		target.querySelector<HTMLButtonElement>('[data-dock-slot="library"]')!.click();
		await settled();
		expect(facade().session.task()?.kind).toBe('place-object');
		expect(target.querySelector('[data-stage-instrument="place-object"]')).not.toBeNull();
	});

	it('binds a Card confirmation to the subject whose consequences it disclosed', async () => {
		const canonical = facade().snapshot().canonicalJson;
		deleteAction().click();
		await frame();
		expect(deleteAction().textContent?.trim()).toBe('Confirm Delete Wall');

		// Another Wall: the words the creator read belonged to the first one, so the
		// new subject offers its own disclosure instead of a confirmation.
		await selectIndexRow(STARTER_WALL_2);
		expect(deleteAction().textContent?.trim()).toBe('Delete Wall');
		deleteAction().click();
		await frame();
		expect(deleteAction().textContent?.trim()).toBe('Confirm Delete Wall');
		expect(facade().snapshot().canonicalJson).toBe(canonical);
	});

	it('spends a disclosed deletion when the selection moves away, even if it returns', async () => {
		const canonical = facade().snapshot().canonicalJson;
		key('Delete');
		await frame();
		expect(notices()).toContain('Delete Wall');

		// Away and back: the offer was read for one subject in one selection, and
		// returning to it must not turn the next press into a silent confirmation.
		await selectIndexRow(STARTER_WALL_2);
		await selectIndexRow(wallId);
		key('Delete');
		// Long enough for any acceptance that press started to land: "nothing was
		// deleted" has to mean it, not that the write had not arrived yet.
		await new Promise((resolve) => setTimeout(resolve, 50));
		await frame();
		expect(facade().snapshot().canonicalJson).toBe(canonical);
		expect(notices()).toContain('Delete Wall');

		// The press after the fresh disclosure is the one that confirms it.
		key('Delete');
		await vi.waitFor(() => expect(facade().snapshot().canonicalJson).not.toBe(canonical));
		await frame();
		expect((harness.host as StageAcceptanceHost).history()).toMatchObject({ depth: 2, position: 1 });
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

describe('Objects drag interruption', () => {
	it.each(['blur', 'hidden', 'pointercancel', 'lostpointercapture', 'second-pointer'])('drops a Box drag on %s and leaves no trace', async (ending) => {
		target.querySelector<HTMLButtonElement>('[data-dock-slot="library"]')!.click();
		await settled();
		const baseline = facade().snapshot().canonicalJson;
		const from = projected([2, 0, -1]);
		const to = projected([4, 0, -3]);
		pointer('pointerdown', from); pointer('pointermove', to); await frame();
		if (ending === 'blur') window.dispatchEvent(new Event('blur'));
		else if (ending === 'hidden') { vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')); }
		else if (ending === 'second-pointer') { pointer('pointerdown', [to[0] + 100, to[1]], false, 2, 'touch'); pointer('pointercancel', [to[0] + 100, to[1]], false, 2, 'touch'); }
		else pointer(ending, to);
		await frame();
		expect(facade().session.gesture()).toBeNull();
		expect(facade().snapshot().canonicalJson).toBe(baseline);
	});
});

/**
 * R217.S05 — the drafting furniture, driven through the mounted route.
 *
 * The pure facts live in `stage-drafting.test.ts` and the grid arithmetic in
 * `stage-grid.test.ts`. What only the mounted host proves is that the furniture
 * is wired to those facts, that its changes never reach F4/history/Save, and
 * that Scale asks the existing Camera intent seam rather than composing a pose.
 */
describe('R217.S05 — mounted drafting furniture', () => {
	const gridKey = () => target.querySelector<HTMLButtonElement>('[data-drafting-grid]')!;
	const snapKey = () => target.querySelector<HTMLButtonElement>('[data-drafting-snap]')!;

	it('toggles Grid and Snap without an F4 entry, dirty history or changed Save bytes', async () => {
		const host = harness.host as StageAcceptanceHost;
		const before = facade().snapshot().canonicalJson;
		const historyBefore = host.history();
		const saveBefore = await captureUnitSave({
			snapshot: host.coordinator().acceptedSnapshot(),
			operationId: 'drafting-before',
			precondition: { kind: 'create-only' }
		});

		expect(gridKey().getAttribute('aria-pressed')).toBe('true');
		gridKey().click();
		await frame();
		expect(gridKey().getAttribute('aria-pressed')).toBe('false');
		expect(gridKey().textContent?.trim()).toBe('Grid off');

		expect(snapKey().getAttribute('aria-pressed')).toBe('true');
		snapKey().click();
		await frame();
		expect(snapKey().getAttribute('aria-pressed')).toBe('false');
		expect(snapKey().textContent?.trim()).toBe('Snap off');

		// View state is not authored content: no install, no history entry, and the
		// Save capture is byte-identical.
		expect(facade().snapshot().canonicalJson).toBe(before);
		expect(host.history()).toEqual(historyBefore);
		expect((harness.host as StageAcceptanceHost).history()).toMatchObject({ depth: 1, position: 0 });
		const saveAfter = await captureUnitSave({
			snapshot: host.coordinator().acceptedSnapshot(),
			operationId: 'drafting-after',
			precondition: { kind: 'create-only' }
		});
		expect(saveBefore.kind).toBe('captured');
		expect(saveAfter.kind).toBe('captured');
		if (saveBefore.kind === 'captured' && saveAfter.kind === 'captured') {
			expect(saveAfter.capture.canonicalJson).toBe(saveBefore.capture.canonicalJson);
		}

		// Grid and Snap are independent: Grid stays off while Snap comes back on.
		snapKey().click();
		await frame();
		expect(snapKey().textContent?.trim()).toBe(currentSnapLabel());
		expect(gridKey().textContent?.trim()).toBe('Grid off');
	});

	it('holds Snap off while Alt/Option is down and restores it on release and blur', async () => {
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true, bubbles: true }));
		await frame();
		expect(facade().session.drafting().snapSuspended).toBe(true);
		expect(snapKey().textContent?.trim()).toBe('Snap held');

		window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', bubbles: true }));
		await frame();
		expect(facade().session.drafting().snapSuspended).toBe(false);
		expect(snapKey().textContent?.trim()).toBe(currentSnapLabel());

		// Losing the window cannot strand the modifier off.
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true, bubbles: true }));
		await frame();
		expect(facade().session.drafting().snapSuspended).toBe(true);
		window.dispatchEvent(new Event('blur'));
		await frame();
		expect(facade().session.drafting().snapSuspended).toBe(false);
	});

	it('reaches Scale detents through Find and Fit through the zoom cluster', async () => {
		const request = vi.spyOn(facade(), 'requestViewingIntent');
		const detent = target.querySelector<HTMLButtonElement>('[data-head-find] [data-find-id="scale:100"]')!;
		expect(detent).not.toBeNull();
		detent.click();
		await frame();

		const detentIntent = request.mock.calls.at(-1)![0];
		expect(detentIntent.kind).toBe('zoom');
		expect(detentIntent.kind === 'zoom' ? detentIntent.scale : 0).toBeGreaterThan(0);
		// The intent lands on the stated 1:100 ratio in the real Camera evaluation,
		// not merely on a positive multiplier.
		const evaluation = facade().evaluation();
		expect(evaluation).not.toBeNull();
		expect(evaluation!.targetPlaneMetersPerCssPixel).toBeCloseTo(
			metersPerCssPixelForScaleRatio(100)!,
			9
		);
		// A refused framing request moves neither the Camera nor the ruler.
		const before = evaluation!.targetPlaneMetersPerCssPixel;
		request.mockReturnValue({
			kind: 'superseded',
			state: facade().camera.state(),
			message: 'the inspection output is held by another run'
		});
		const refused = target.querySelector<HTMLButtonElement>('[data-head-find] [data-find-id="scale:50"]')!;
		refused.click();
		await frame();
		expect(facade().evaluation()!.targetPlaneMetersPerCssPixel).toBeCloseTo(before, 9);
		// No new intent kind and no Camera pose composition in the shell.
		expect(request.mock.calls.every(([intent]) => ['zoom', 'fit'].includes(intent.kind))).toBe(true);

		target.querySelector<HTMLButtonElement>('[data-stage-fit]')!.click();
		await frame();
		expect(request.mock.calls.at(-1)![0]).toMatchObject({ kind: 'fit' });
	});

	it('exposes the fixed values on both readings and hides the ruler in 3D', async () => {
		const bar = target.querySelector<HTMLElement>('[data-stage-scale-bar]')!;
		expect(bar).not.toBeNull();
		expect(bar.getAttribute('aria-label')).toMatch(/^Scale bar: [0-9.]+ m$/);
		expect(bar.querySelectorAll('.tick')).toHaveLength(2);
		expect(bar.querySelector('.length')?.textContent?.trim()).toMatch(/[0-9.]+ m/);
		// Grid and Snap are fixed values, so their words name no zoom-driven interval.
		expect(gridKey().textContent?.trim()).toBe('Grid');
		expect(snapKey().textContent?.trim()).toBe('Snap');
		expect(gridKey().getAttribute('title')).toContain('fixed 1 m and 5 m');
		expect(snapKey().getAttribute('title')).toContain('fixed 0.5 m');

		button('3D').click();
		await frame();
		expect(target.querySelector('[data-stage-scale-bar]')).toBeNull();
		expect(gridKey().textContent?.trim()).toBe('Grid');
		expect(snapKey().textContent?.trim()).toBe('Snap');

		// The words keep working on the mat: the fixed values are not a Plan-only
		// preference. Turn them back on before leaving the reading.
		gridKey().click();
		snapKey().click();
		await frame();
		expect(gridKey().getAttribute('aria-pressed')).toBe('false');
		expect(snapKey().getAttribute('aria-pressed')).toBe('false');
		expect(gridKey().textContent?.trim()).toBe('Grid off');
		expect(snapKey().textContent?.trim()).toBe('Snap off');
		gridKey().click();
		snapKey().click();
		await frame();
		expect(gridKey().textContent?.trim()).toBe('Grid');
		expect(snapKey().textContent?.trim()).toBe('Snap');

		button('2D').click();
		await frame();
		expect(target.querySelector('[data-stage-scale-bar]')).not.toBeNull();
	});

	it('offers zoom in, zoom out and Fit as the lower-right cluster, with no Scale or config disclosure', async () => {
		const request = vi.spyOn(facade(), 'requestViewingIntent');
		expect(target.querySelector('[data-drafting-scale]')).toBeNull();
		expect(target.querySelector('[data-drafting-config]')).toBeNull();
		const zoomIn = target.querySelector<HTMLButtonElement>('[data-stage-zoom-in]')!;
		const zoomOut = target.querySelector<HTMLButtonElement>('[data-stage-zoom-out]')!;
		expect(zoomIn).not.toBeNull();
		expect(zoomOut).not.toBeNull();
		zoomIn.click();
		await frame();
		const inward = request.mock.calls.at(-1)![0];
		expect(inward.kind).toBe('zoom');
		expect(inward.kind === 'zoom' ? inward.scale : 1).toBeCloseTo(0.8, 9);
		zoomOut.click();
		await frame();
		const outward = request.mock.calls.at(-1)![0];
		expect(outward.kind).toBe('zoom');
		expect(outward.kind === 'zoom' ? outward.scale : 1).toBeCloseTo(1.25, 9);
		target.querySelector<HTMLButtonElement>('[data-stage-fit]')!.click();
		await frame();
		expect(request.mock.calls.at(-1)![0]).toMatchObject({ kind: 'fit' });
	});

	it('keeps the zoom cluster clear of a right-side Sheet', () => {
		// Geometry is browser calibration; the route owns the clearance rule. A
		// regression here let the lifted cluster overlap the Sheet by 10 px.
		const route = readFileSync('src/routes/project/[projectId]/spatial/+page.svelte', 'utf8');
		expect(route).toMatch(/\.stage-zoom-slot\.sheet-right\s*\{[^}]*right:\s*calc\(5\.5rem \+ 1rem\)/s);
		expect(target.querySelector('.stage-zoom-slot')?.classList.contains('sheet-right')).toBe(true);
	});

	it('strikes the off words and centres the ruler label below its rule', () => {
		const control = readFileSync('src/lib/authoring/stage/shell/StageDraftingControl.svelte', 'utf8');
		expect(control).toMatch(/text-decoration:\s*line-through/);
		expect(control).toMatch(/\.words button\[aria-pressed='false'\]/);
		const ruler = readFileSync('src/lib/authoring/stage/shell/StageScaleBar.svelte', 'utf8');
		expect(ruler).toMatch(/align-items:\s*center/);
		expect(ruler).not.toMatch(/justify-items:\s*start/);
	});

	it('announces the temporary Snap hold without changing the durable switch', async () => {
		const status = target.querySelector<HTMLElement>('#drafting-snap-state')!;
		expect(status.getAttribute('role')).toBe('status');
		expect(status.textContent?.trim()).toBe(currentSnapLabel());
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true, bubbles: true }));
		await frame();
		expect(status.textContent?.trim()).toBe('Snap held');
		// The durable fact is still on; only the hold is temporary.
		expect(snapKey().getAttribute('aria-pressed')).toBe('true');
		window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', bubbles: true }));
		await frame();
		expect(status.textContent?.trim()).toBe(currentSnapLabel());
	});

	it('switches 2D | 3D through set-reading and keeps grid, snap and selection', async () => {
		const request = vi.spyOn(facade(), 'requestViewingIntent');
		const selection = facade().selectionState();
		const drafting = facade().session.drafting();
		button('3D').click();
		await frame();
		expect(request.mock.calls.at(-1)![0]).toMatchObject({ kind: 'set-reading', reading: '3d' });
		expect(facade().selectionState()).toEqual(selection);
		expect(facade().session.drafting()).toEqual(drafting);

		button('2D').click();
		await frame();
		expect(request.mock.calls.at(-1)![0]).toMatchObject({ kind: 'set-reading', reading: 'plan' });
	});

	it('exposes the words as native, stateful, focusable controls with 44 px coarse targets', async () => {
		// Two readings, two words and the R217.S20 ⚙ disclosure, all native buttons.
		const controls = [...target.querySelectorAll<HTMLButtonElement>('[data-stage-drafting] button')];
		expect(controls.length).toBe(5);
		expect(target.querySelector('[data-stage-viewing]')?.getAttribute('aria-expanded')).toBe('false');
		for (const control of controls) {
			expect(control.tagName).toBe('BUTTON');
			expect(control.getAttribute('type')).toBe('button');
			expect(control.tabIndex).toBe(0);
			expect(control.disabled).toBe(false);
		}
		// Keyboard activation is the native button's own; the state is announced.
		expect(gridKey().getAttribute('aria-pressed')).toMatch(/^(true|false)$/);
		expect(snapKey().getAttribute('aria-pressed')).toMatch(/^(true|false)$/);
		expect(target.querySelector('[data-drafting-reading="plan"]')!.getAttribute('aria-pressed')).toBe('true');
		expect(target.querySelector('[data-drafting-scale]')).toBeNull();
		expect(target.querySelector('[data-drafting-config]')).toBeNull();

		const source = readFileSync(
			'src/lib/authoring/stage/shell/StageDraftingControl.svelte',
			'utf8'
		);
		expect(source).toContain('@media (pointer: coarse)');
		expect(source).toMatch(/min-height:\s*44px/);
		expect(source).toMatch(/min-width:\s*44px/);
	});
});

describe('R217.S06 — mounted Height Sheet', () => {
	const sheetNode = () => target.querySelector<HTMLElement>('[data-stage-height-sheet]');
	const sliderNode = () => sheetNode()?.querySelector<HTMLElement>('[role="slider"]') ?? null;
	const height = () => facade().session.heightSheet().height();
	const pins = () => facade().session.heightSheet().pins();
	const canvasProbe = () => target.querySelector<HTMLElement>('[data-testid="stage-canvas"]');
	const snapToggle = () => target.querySelector<HTMLButtonElement>('[data-drafting-snap]')!;
	function trackPointer(type: string, clientY: number, pointerId = 7): void {
		const track = sliderNode();
		if (track === null) throw new Error('the Height Sheet slider is not mounted');
		const event = new MouseEvent(type, {
			bubbles: true,
			cancelable: true,
			clientX: RECT.left + RECT.width / 2,
			clientY
		});
		Object.defineProperty(event, 'pointerId', { value: pointerId });
		Object.defineProperty(event, 'pointerType', { value: 'touch' });
		track.dispatchEvent(event);
	}

	it('steps the one height fact without an F4 entry, dirty history or changed Save bytes', async () => {
		const host = harness.host as StageAcceptanceHost;
		const sheet = target.querySelector<HTMLElement>('[data-stage-height-sheet]');
		expect(sheet).not.toBeNull();
		const slider = sheet!.querySelector<HTMLElement>('[role="slider"]');
		expect(slider).not.toBeNull();
		expect(slider!.getAttribute('aria-valuenow')).toBe('1.2');

		const before = facade().snapshot().canonicalJson;
		const historyBefore = host.history();
		const saveBefore = await captureUnitSave({
			snapshot: host.coordinator().acceptedSnapshot(),
			operationId: 'height-before',
			precondition: { kind: 'create-only' }
		});

		slider!.focus();
		slider!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await frame();
		const raised = facade().session.heightSheet().height();
		expect(raised).toBeGreaterThan(1.2);
		expect(Number(slider!.getAttribute('aria-valuenow'))).toBeCloseTo(raised, 6);

		// Pins and a drag are the same session fact, not a source edit.
		sheet!.querySelector<HTMLButtonElement>('button[aria-label^="Pin the height"]')!.click();
		await frame();
		expect(pins()).toHaveLength(1);
		sheet!.querySelector<HTMLButtonElement>('button[aria-label^="Remove the pin"]')!.click();
		await frame();
		expect(pins()).toEqual([]);
		const max = Number(slider!.getAttribute('aria-valuemax'));
		const fromY = RECT.bottom - (height() / max) * RECT.height;
		trackPointer('pointerdown', fromY);
		await frame();
		trackPointer('pointermove', fromY + 48);
		await frame();
		trackPointer('pointerup', fromY + 48);
		await frame();
		expect(height()).toBeLessThan(raised);
		// The slider is still focused after the release, so the plane must remain
		// up instead of starting its hide tail behind a focused control.
		expect(canvasProbe()?.dataset.heightPlane).toBe('true');

		// The Sheet is view state: no install, no history entry, and Save is the
		// same canonical bytes as before the step.
		expect(facade().snapshot().canonicalJson).toBe(before);
		expect(host.history()).toEqual(historyBefore);
		const saveAfter = await captureUnitSave({
			snapshot: host.coordinator().acceptedSnapshot(),
			operationId: 'height-after',
			precondition: { kind: 'create-only' }
		});
		expect(saveBefore.kind).toBe('captured');
		expect(saveAfter.kind).toBe('captured');
		if (saveBefore.kind === 'captured' && saveAfter.kind === 'captured') {
			expect(saveAfter.capture.canonicalJson).toBe(saveBefore.capture.canonicalJson);
		}
	});

	it('drops a mounted pin when the session fact resets', async () => {
		sheetNode()!.querySelector<HTMLButtonElement>('button[aria-label^="Pin the height"]')!.click();
		await frame();
		expect(pins()).toHaveLength(1);
		expect(
			sheetNode()!.querySelector<HTMLButtonElement>('button[aria-label^="Remove the pin"]')
		).not.toBeNull();

		facade().session.heightSheet().reset();
		await frame();
		expect(pins()).toEqual([]);
		expect(
			sheetNode()!.querySelector<HTMLButtonElement>('button[aria-label^="Remove the pin"]')
		).toBeNull();
	});

	it.each(['lostpointercapture', 'blur'] as const)(
		'stops a drag when %s interrupts the gesture',
		async (interruption) => {
			const slider = sliderNode();
			expect(slider).not.toBeNull();
			const max = Number(slider!.getAttribute('aria-valuemax'));
			const fromY = RECT.bottom - (height() / max) * RECT.height;
			trackPointer('pointerdown', fromY);
			await frame();
			const stopped = height();

			if (interruption === 'lostpointercapture') {
				trackPointer('lostpointercapture', fromY);
			} else {
				window.dispatchEvent(new Event('blur'));
			}
			await frame();
			trackPointer('pointermove', fromY + 80);
			await frame();

			expect(height()).toBeCloseTo(stopped, 6);
			expect(sheetNode()!.querySelector('.snap')).toBeNull();
		}
	);

	it('keeps a drag with its initiating pointer through secondary contacts', async () => {
		const slider = sliderNode()!;
		const max = Number(slider.getAttribute('aria-valuemax'));
		const fromY = RECT.bottom - (height() / max) * RECT.height;
		const capture = vi.spyOn(HTMLElement.prototype, 'setPointerCapture');
		trackPointer('pointerdown', fromY, 7);
		await frame();
		const started = height();

		trackPointer('pointerdown', fromY + 140, 8);
		trackPointer('pointermove', fromY + 140, 8);
		trackPointer('pointerup', fromY + 140, 8);
		await frame();
		expect(capture.mock.calls.map(([id]) => id)).toEqual([7]);
		expect(height()).toBeCloseTo(started, 6);

		trackPointer('pointermove', fromY + 48, 7);
		await frame();
		const moved = height();
		expect(moved).not.toBeCloseTo(started, 4);
		trackPointer('pointerup', fromY + 48, 7);
		trackPointer('pointermove', fromY + 120, 7);
		await frame();
		expect(height()).toBeCloseTo(moved, 6);
	});

	it('invalidates a live control drag when session.replace resets to the same height', async () => {
		const slider = sliderNode()!;
		const max = Number(slider.getAttribute('aria-valuemax'));
		const fromY = RECT.bottom - (height() / max) * RECT.height;
		trackPointer('pointerdown', fromY, 7);
		await frame();
		expect(height()).toBeCloseTo(1.2, 6);

		// This is the route's actual replacement seam: activate() calls
		// session.replace(snapshot) before rebuilding the facade.
		facade().session.replace({ sessionEpoch: 'height-sheet-replacement' } as unknown as StageReadSnapshot);
		await frame();
		trackPointer('pointermove', fromY + 120, 7);
		await frame();
		expect(height()).toBeCloseTo(1.2, 6);
		expect(sheetNode()!.querySelector('.snap')).toBeNull();
	});

	it('steps by the drafting increment, falls back to 0.1 m, jumps ticks and names the nearest', async () => {
		// The route reads the merged tick set after the binding exists; force that
		// read so the aria name is the owner's Floor, not an empty placeholder.
		facade().heightTicks();
		await frame();
		const slider = sliderNode();
		expect(slider).not.toBeNull();
		expect(slider!.getAttribute('aria-valuetext')).toMatch(/metres, nearest Floor/);
		const step = draftingSnapIncrementMeters(facade().session.drafting()) ?? 0.1;
		const start = height();
		const max = Number(slider!.getAttribute('aria-valuemax'));
		slider!.focus();
		slider!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await frame();
		expect(height()).toBeCloseTo(Math.min(max, start + step), 6);

		// Snap off: the same key steps a fixed 0.1 m.
		snapToggle().click();
		await frame();
		const beforeFallback = height();
		slider!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await frame();
		expect(height()).toBeCloseTo(Math.max(0, beforeFallback - 0.1), 6);

		// Page Up/Down and Home walk the owner ticks and pins, not an invented grid.
		facade().session.heightSheet().set(0.75, 'key');
		await frame();
		sheetNode()!.querySelector<HTMLButtonElement>('button[aria-label^="Pin the height"]')!.click();
		await frame();
		facade().session.heightSheet().set(0.4, 'key');
		await frame();
		slider!.focus();
		slider!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
		await frame();
		expect(height()).toBeCloseTo(0.75, 6);
		slider!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
		await frame();
		expect(height()).toBeCloseTo(0, 6);
		slider!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		await frame();
		expect(height()).toBe(0);
		sheetNode()!.querySelector<HTMLButtonElement>('button[aria-label^="Remove the pin"]')!.click();
		await frame();
		expect(pins()).toEqual([]);
	});

	it('hides the Sheet and its plane in Experience and returns the session height', async () => {
		facade().session.heightSheet().set(0.8, 'key');
		await frame();
		const slider = sliderNode();
		expect(slider).not.toBeNull();
		slider!.focus();
		await frame();
		expect(canvasProbe()?.dataset.heightMeters).toBe('0.8');
		expect(canvasProbe()?.dataset.heightPlane).toBe('true');

		target.querySelector<HTMLButtonElement>('[data-testid="lens-experience"]')!.click();
		await frame();
		expect(sheetNode()).toBeNull();
		// The zoom cluster and ruler are World-lens chrome: Experience keeps its
		// own point of view and does not inherit Stage framing furniture.
		expect(target.querySelector('[data-stage-zoom]')).toBeNull();
		expect(target.querySelector('[data-stage-scale-bar]')).toBeNull();
		expect(canvasProbe()?.dataset.heightMeters ?? 'none').toBe('none');
		expect(canvasProbe()?.dataset.heightPlane ?? 'false').toBe('false');
		expect(height()).toBeCloseTo(0.8, 6);

		target.querySelector<HTMLButtonElement>('[data-testid="lens-world"]')!.click();
		await frame();
		expect(sheetNode()).not.toBeNull();
		expect(target.querySelector('[data-stage-zoom]')).not.toBeNull();
		expect(target.querySelector('[data-stage-scale-bar]')).not.toBeNull();
		expect(Number(sliderNode()!.getAttribute('aria-valuenow'))).toBeCloseTo(0.8, 6);
		// The unmount published inactive before the lens returned; no tail survives
		// the switch and the plane starts hidden until the Sheet is activated again.
		expect(canvasProbe()?.dataset.heightPlane).toBe('false');
	});

	it('keeps a 44 px coarse target and names the snap while dragging', async () => {
		const source = readFileSync('src/lib/authoring/stage/shell/StageHeightSheet.svelte', 'utf8');
		expect(source).toContain('@media (pointer: coarse)');
		expect(source).toMatch(/width:\s*44px/);
		expect(source).toMatch(/min-width:\s*44px/);
		expect(source).toMatch(/min-height:\s*44px/);

		const slider = sliderNode();
		expect(slider).not.toBeNull();
		sheetNode()!.querySelector<HTMLButtonElement>('button[aria-label^="Pin the height"]')!.click();
		await frame();
		const max = Number(slider!.getAttribute('aria-valuemax'));
		const pinY = RECT.bottom - (height() / max) * RECT.height;
		trackPointer('pointerdown', pinY);
		await frame();
		const snap = sheetNode()!.querySelector<HTMLElement>('.snap');
		expect(snap?.textContent ?? '').toContain('Snapped to Pin');
		trackPointer('pointerup', pinY);
		await frame();
		sheetNode()!.querySelector<HTMLButtonElement>('button[aria-label^="Remove the pin"]')!.click();
	});
});

describe('R217.S15 — Stage cursor truth', () => {
	it('shows move over the selected Wall and grab over anything else', async () => {
		const body = projected([3.5, 0, -4]);
		pointer('pointermove', body);
		await frame();
		expect(stage().dataset.cursor).toBe('move');

		const other = anotherWall();
		pointer('pointermove', other.css);
		await frame();
		expect(stage().dataset.cursor).toBe('grab');
	});
});

describe('R217.S15 — Card Junction writer', () => {
	it('refreshes the sibling fields from the accepted source after a Start X commit', async () => {
		const details = target.querySelector<HTMLDetailsElement>('details[data-layout-junction-fields]');
		expect(details).not.toBeNull();
		details!.open = true;
		const startX = details!.querySelector<HTMLInputElement>('input[data-field="startX"]')!;
		const lengthBefore = target.querySelector<HTMLInputElement>('input[data-field="length"]')!.value;
		const startZBefore = target.querySelector<HTMLInputElement>('input[data-field="startZ"]')!.value;
		startX.value = '0.5';
		startX.dispatchEvent(new Event('input', { bubbles: true }));
		startX.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await vi.waitFor(() => {
			expect(target.querySelector<HTMLInputElement>('input[data-field="length"]')!.value).not.toBe(lengthBefore);
		});
		// The companion coordinate is the accepted one: committing X never rewrites Z.
		expect(target.querySelector<HTMLInputElement>('input[data-field="startZ"]')!.value).toBe(startZBefore);
	});
});

describe('R217.S15 — press routing', () => {
	it('pans from an unselected Wall without selecting it or writing history', async () => {
		const other = anotherWall();
		const before = [...facade().camera.state().pose.target];
		const beforeSelection = facade().selection()?.sourceId;
		const historyBefore = history();
		pointer('pointerdown', other.css);
		pointer('pointermove', [other.css[0] + 60, other.css[1] + 40]);
		await frame();
		pointer('pointerup', [other.css[0] + 60, other.css[1] + 40]);
		pointer('click', [other.css[0] + 60, other.css[1] + 40]);
		await frame();
		expect(facade().camera.state().pose.target).not.toEqual(before);
		expect(facade().selection()?.sourceId).toBe(beforeSelection);
		expect(history()).toEqual(historyBefore);
	});

	it('pans from the empty Stage without selecting or writing history', async () => {
		const before = [...facade().camera.state().pose.target];
		const beforeSelection = facade().selection()?.sourceId;
		const historyBefore = history();
		const start: [number, number] = [RECT.left + 40, RECT.bottom - 40];
		pointer('pointerdown', start);
		pointer('pointermove', [start[0] + 50, start[1] - 20]);
		await frame();
		pointer('pointerup', [start[0] + 50, start[1] - 20]);
		pointer('click', [start[0] + 50, start[1] - 20]);
		await frame();
		expect(facade().camera.state().pose.target).not.toEqual(before);
		expect(facade().selection()?.sourceId).toBe(beforeSelection);
		expect(history()).toEqual(historyBefore);
	});

	it('keeps a click on the selected body a click, not a commit', async () => {
		const body = projected([3.5, 0, -4]);
		const historyBefore = history();
		pointer('pointerdown', body);
		pointer('pointerup', body);
		pointer('click', body);
		await frame();
		expect(facade().selection()?.sourceId).toBe(wallId);
		expect(history()).toEqual(historyBefore);
		expect(facade().candidatePreviews()).toHaveLength(0);
	});
});

describe('R217.S16 — selected Opening body priority', () => {
	it('slides an Opening at its Wall end before the overlapping idle Junction can claim it', async () => {
		unmount(component);
		target.remove();
		const layout = buildStarterEnclosureLayout();
		const wall = layout.walls[0]!;
		const openingPlan = planCreateWallFirstOpening(
			layout,
			{ wallId: wall.id, kind: 'door', offset: 0, width: 0.9, height: 2, sillHeight: 0 },
			freshCapture(),
			layout.floor.id
		);
		if (openingPlan.kind === 'rejected') throw new Error(`Opening fixture refused: ${openingPlan.rejection.message}`);
		const openingId = openingPlan.changedOpeningIds[0]!;
		await mountRoute(openingPlan.document);
		target.querySelector<HTMLButtonElement>('[data-drafting-snap]')!.click();
		await frame();

		const junctions = new Map(layout.junctions.map((junction) => [junction.id, junction.point]));
		const start = junctions.get(wall.startJunctionId)!;
		const end = junctions.get(wall.endJunctionId)!;
		const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
		const direction: [number, number] = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
		const pointAt = (offset: number): [number, number] => [start[0] + direction[0] * offset, start[1] + direction[1] * offset];
		const openingCenter = projected([pointAt(0.45)[0], 0, pointAt(0.45)[1]]);
		pointer('pointerdown', openingCenter);
		pointer('pointerup', openingCenter);
		pointer('click', openingCenter);
		await frame();
		expect(facade().selection()?.sourceId).toBe(openingId);

		const nearEnd = projected([pointAt(0.04)[0], 0, pointAt(0.04)[1]]);
		const local = [nearEnd[0] - RECT.left, nearEnd[1] - RECT.top] as [number, number];
		const evaluationId = facade().evaluationId()!;
		expect(facade().hitMark({ css: local, coarse: false })).toBeNull();
		expect(facade().idleHoverIntent({ phase: 'move', css: local, evaluationId, coarse: false })).toMatchObject({
			id: 'layout-junction-hover', adapterId: 'layout'
		});

		const pointerDown = nearEnd;
		pointer('pointerdown', pointerDown);
		expect(facade().session.gesture()).not.toBeNull();
		const moved = projected([pointAt(0.54)[0], 0, pointAt(0.54)[1]]);
		pointer('pointermove', moved);
		await frame();
		pointer('pointerup', moved);
		pointer('click', moved);
		await vi.waitFor(() => {
			const current = stageEnvelope(facade().snapshot()).units.layout.data.openings.find((opening) => opening.id === openingId);
			expect(current?.offset).toBeCloseTo(0.5, 5);
		});
		const accepted = stageEnvelope(facade().snapshot()).units.layout.data;
		expect(accepted.junctions.find((junction) => junction.id === wall.startJunctionId)?.point).toEqual(start);
		expect((harness.host as StageAcceptanceHost).history()).toMatchObject({ depth: 2, position: 1 });
	});
});

describe('R217.S21 — Index and Card on the mounted route', () => {
	it('labels an unnamed Wall with a generated Kind n in its Index row, never with its identity', () => {
		const row = indexRowOf(target, wallId)!;
		const name = row.querySelector('.item-name');
		expect(name?.textContent).toMatch(/^Wall \d+$/);
		expect(name?.classList.contains('generated')).toBe(true);
		// The canonical identity is in the accessible name, not in the visible text.
		expect(row.getAttribute('aria-label')).toContain(wallId);
		expect(row.textContent).not.toContain(wallId);
	});

	it('shows the Card title on the Index label, and keeps the canonical ID out of the header', () => {
		const label = indexRowOf(target, wallId)!.querySelector('.item-name')!.textContent;
		const card = target.querySelector<HTMLElement>('[aria-label="Selected subject"]')!;
		expect(card.querySelector('h2.name')?.textContent).toBe(label);
		expect(card.querySelector('.card-head')?.textContent).not.toContain(wallId);
		// The identity is still the Card's own data, and Technical details still holds it.
		expect(card.getAttribute('data-source-id')).toBe(wallId);
		expect(card.querySelector('.technical')?.textContent).toContain(wallId);
	});

	it('states each Wall fact once: the writer carries the dimensions and the Card keeps only the derived Role', () => {
		const card = target.querySelector<HTMLElement>('[aria-label="Selected subject"]')!;
		const facts = [...card.querySelectorAll('dl.facts:not(.mono) dt')].map((term) => term.textContent);
		expect(facts).toEqual(['Datum', 'Role']);
		expect(card.querySelector('[data-card-writer]')?.getAttribute('data-card-writer')).toBe('Wall fields');
		expect(card.querySelector('input[data-field="height"]')).not.toBeNull();
		expect(card.querySelector('input[data-field="thickness"]')).not.toBeNull();
		// Stream, Eligible and Revealed are diagnostics, so they live under Technical details.
		const technical = [...card.querySelectorAll('.technical dt')].map((term) => term.textContent);
		expect(technical).toEqual(['Canonical ID', 'Stream', 'Eligible', 'Revealed']);
	});

	it('styles only Delete as destructive and keeps Focus and Open task one disclosure away', () => {
		const card = target.querySelector<HTMLElement>('[aria-label="Selected subject"]')!;
		const remove = card.querySelector<HTMLButtonElement>('[data-card-action="layout-wall-delete"]')!;
		expect(remove.classList.contains('destructive')).toBe(true);
		const more = card.querySelector<HTMLDetailsElement>('[data-card-more]')!;
		expect(more.open).toBe(false);
		expect([...more.querySelectorAll('button')].map((item) => item.textContent?.trim())).toEqual(['Focus', 'Open task']);
	});

	it('discloses the Index row operations behind the row\'s Actions control', async () => {
		const row = target.querySelector<HTMLElement>(`.item[data-source-id$=${JSON.stringify(`:${wallId}`)}]`)!;
		const toggle = row.querySelector<HTMLButtonElement>('.item-actions-toggle')!;
		expect(row.querySelectorAll('.op')).toHaveLength(0);
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		toggle.click();
		await frame();
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect([...row.querySelectorAll('.op')].map((item) => item.textContent?.trim())).toEqual([
			'Open location',
			'Bring into view'
		]);
		toggle.click();
		await frame();
		expect(row.querySelectorAll('.op')).toHaveLength(0);
	});

	it('keeps Select and Bring into view distinct: a row select leaves the Camera, the row\'s frame operation moves it', async () => {
		const other = STARTER_WALL_2;
		const before = facade().camera.state().pose;
		indexRowOf(target, other)!.click();
		await frame();
		expect(facade().selection()?.sourceId).toBe(other);
		expect(facade().camera.state().pose).toEqual(before);

		const row = target.querySelector<HTMLElement>(`.item[data-source-id$=${JSON.stringify(`:${other}`)}]`)!;
		row.querySelector<HTMLButtonElement>('.item-actions-toggle')!.click();
		await frame();
		const frameOp = [...row.querySelectorAll<HTMLButtonElement>('.op')].find((item) => item.textContent?.trim() === 'Bring into view')!;
		frameOp.click();
		await settled();
		expect(facade().camera.state().pose).not.toEqual(before);
	});

	it('feeds the context chip the subject\'s canonical floor, never the selection', async () => {
		target.querySelector<HTMLButtonElement>('[data-head-index]')!.click();
		await frame();
		const chip = target.querySelector<HTMLElement>('[data-head-location]');
		expect(chip?.textContent).toBe(buildStarterEnclosureLayout().floor.name);
		expect(chip?.textContent).not.toContain('Wall');
		expect(chip?.textContent).not.toContain(wallId);
	});
});
