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
import { readFileSync } from 'node:fs';
import { mount, tick, unmount } from 'svelte';
import { captureUnitSave } from '@portfolio/project-model/units';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { layoutCapturedId } from '@portfolio/layout-core';
import {
	buildStarterEnclosureLayout,
	STARTER_TEMPLATE_ID_CAPTURE
} from '$lib/authoring/stage/starter-gallery';

/** The starter keeps its fixed captured identity across every boot. */
const STARTER_WALL_2 = layoutCapturedId(STARTER_TEMPLATE_ID_CAPTURE, 'wall-chain-2');
import { pausedWallProposal } from '$lib/authoring/adapters/layout/paused-proposal';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { metersPerCssPixelForScaleRatio } from '$lib/authoring/stage/stage-drafting';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
import { shapeReadingSurface } from '$lib/authoring/adapters/scene/shape/reading';
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
/** Scale detents and Fit all live behind the Scale word, as PLATE specifies. */
async function fitAll() {
	const scale = target.querySelector<HTMLButtonElement>('[data-drafting-scale]');
	if (scale === null) throw new Error('Missing Scale control');
	scale.click();
	await tick();
	button('Fit all').click();
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
	// The Wall's free end is the length mark; the angle ring is gone (owner ruling
	// 2026-10-29), so direct manipulation is length or move. Marks are already in
	// Stage-local CSS; pointer intents add the accepted Stage rect.
	const end = facade().marks().find((mark) => mark.id === 'layout-wall-end-mark');
	if (end === undefined) throw new Error('the Wall end mark is not projected');
	const press: [number, number] = [end.anchor[0] + RECT.left, end.anchor[1] + RECT.top];
	pointer('pointerdown', press);
	await frame();
	expect(facade().session.gesture()).not.toBeNull();
	const desired = projected([5.5, 0, -4]);
	pointer('pointermove', desired);
	await frame();
	expect([...target.querySelectorAll('.marker')].some(e => e.textContent?.includes('Length'))).toBe(true);
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
	vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion'), addEventListener() { }, removeEventListener() { } }));
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
	button('2D').click();
	await frame();
	await fitAll();
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
	it('moves every registered task entry to Find or the dock and leaves the Index a locator', () => {
		const registered = facade().findEntries().map((entry) => `${entry.adapterId}:${entry.id}`).sort();
		const reachable = [...target.querySelectorAll<HTMLElement>('[data-head-find] [data-find-id]')]
			.filter((entry) => entry.dataset.findAdapter !== 'subject')
			.map((entry) => `${entry.dataset.findAdapter}:${entry.dataset.findId}`).sort();
		expect(reachable).toEqual(registered);
		expect(target.querySelector('[data-plate-landmark="index"] .contributed-group')).toBeNull();
	});
	it('changes a browser preference without changing project source or history', async () => {
		const before = facade().snapshot().canonicalJson;
		const historyBefore = (harness.host as StageAcceptanceHost).history();
		target.querySelector<HTMLButtonElement>('[data-head-motion]')!.click();
		await frame();
		expect(facade().snapshot().canonicalJson).toBe(before);
		expect((harness.host as StageAcceptanceHost).history()).toEqual(historyBefore);
	});
	it('panel changes and viewport resize do not request Camera framing', async () => {
		const stageFacade = facade();
		const request = vi.spyOn(stageFacade, 'requestViewingIntent');
		const before = stageFacade.camera.state().pose;
		target.querySelector<HTMLButtonElement>('.index-toggle')!.click();
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
		const row = [...target.querySelectorAll<HTMLButtonElement>('.item-row')].find(b => b.textContent?.includes(STARTER_WALL_2))!;
		row.click();
		await frame();
		expect(facade().selection()?.sourceId).toBe(STARTER_WALL_2);
	});
	it('keeps Stage, Card and Index on the same selected identity with an offset Stage', async () => {
		// The placeholder gold dot is gone; identity is echoed by the Card and the
		// Index rather than by a second projection marker.
		expect(target.querySelector('.selection')).toBeNull();
		expect(facade().selection()?.sourceId).toBe(wallId);
		const card = target.querySelector('[aria-label="Selected subject"]');
		expect(card?.textContent).toContain(wallId);
		const index = target.querySelector('[data-plate-landmark="index"]');
		expect(index?.textContent).toContain(wallId);
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
		expect(facade().openContributedTask('scene-arrange', 'scene').kind).toBe('opened');
		const selected = facade().selectionState();
		const baseline = facade().snapshot().canonicalJson;
		const point: [number, number] = [RECT.left + 100, RECT.top + 100];
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
		const row = [...target.querySelectorAll<HTMLButtonElement>('.item-row')].find((item) =>
			item.textContent?.includes(sourceId)
		);
		if (row === undefined) throw new Error(`Missing Index row ${sourceId}`);
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

		// The next unwind is the tool's: it disarms and leaves Select.
		key('Escape');
		await frame();
		expect(facade().session.task()).toBeNull();
		expect(target.querySelector('[data-layout-ink-palette]')).toBeNull();
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

describe('Shape depth press interruption', () => {
	it.each(['blur', 'hidden', 'pointercancel', 'lostpointercapture', 'second-pointer', 'pointerup'])('keeps the correct Create depth after %s', async (ending) => {
		target.querySelector<HTMLButtonElement>('[data-dock-tool="layout-ink"]')!.click();
		await settled();
		inkSurface()!.controller.setReading('shape');
		await settled();
		const shape = shapeReadingSurface()!;
		for (const point of [[2, 0, -1], [4, 0, -1], [4, 0, -3], [2, 0, -3]] as const) {
			const css = projected(point);
			pointer('pointerdown', css); pointer('pointerup', css); pointer('click', css); await frame();
		}
		shape.controller.finish(); await frame();
		const before = shape.snapshot();
		expect(before.phase).toBe('depth');
		const marker = facade().overlays().find((entry) => entry.id === 'scene-shape-depth')!;
		const from: [number, number] = [marker.css[0] + RECT.left, marker.css[1] + RECT.top];
		const to: [number, number] = [from[0], from[1] - 80];
		pointer('pointerdown', from); pointer('pointermove', to); await frame();
		const during = shape.snapshot().depth;
		expect(during).not.toBe(before.depth);
		if (ending === 'blur') window.dispatchEvent(new Event('blur'));
		else if (ending === 'hidden') { vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')); }
		else if (ending === 'second-pointer') { pointer('pointerdown', [to[0] + 100, to[1]], false, 2, 'touch'); pointer('pointerup', [to[0] + 100, to[1]], false, 2, 'touch'); }
		else pointer(ending, to);
		await frame();
		expect(facade().session.gesture()).toBeNull();
		expect(shape.snapshot().phase).toBe('depth');
		expect(shape.snapshot().depth).toBe(ending === 'pointerup' ? during : before.depth);
		const baseline = facade().snapshot().canonicalJson;
		shape.controller.create();
		await vi.waitFor(() => expect(facade().snapshot().canonicalJson).not.toBe(baseline));
		const created = facade().snapshot().domain.scene.entities.find((entry) => entry.kind === 'form');
		if (created?.kind !== 'form') throw new Error('No created form');
		expect(created.form.generator.extent).toBe(ending === 'pointerup' ? during : before.depth);
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
		expect(snapKey().textContent?.trim()).toBe('Snap 1 m');
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
		expect(snapKey().textContent?.trim()).toBe('Snap 1 m');

		// Losing the window cannot strand the modifier off.
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true, bubbles: true }));
		await frame();
		expect(facade().session.drafting().snapSuspended).toBe(true);
		window.dispatchEvent(new Event('blur'));
		await frame();
		expect(facade().session.drafting().snapSuspended).toBe(false);
	});

	it('requests Scale detents and Fit all as existing Camera viewing intents', async () => {
		const request = vi.spyOn(facade(), 'requestViewingIntent');
		target.querySelector<HTMLButtonElement>('[data-drafting-scale]')!.click();
		await tick();
		expect(target.querySelector<HTMLButtonElement>('[data-drafting-scale]')!.getAttribute('aria-expanded')).toBe('true');
		target.querySelector<HTMLButtonElement>('[data-drafting-detent="100"]')!.click();
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
		// A refused framing request moves neither the Camera nor the word.
		const before = evaluation!.targetPlaneMetersPerCssPixel;
		request.mockReturnValue({
			kind: 'superseded',
			state: facade().camera.state(),
			message: 'the inspection output is held by another run'
		});
		target.querySelector<HTMLButtonElement>('[data-drafting-scale]')!.click();
		await tick();
		target.querySelector<HTMLButtonElement>('[data-drafting-detent="50"]')!.click();
		await frame();
		expect(facade().evaluation()!.targetPlaneMetersPerCssPixel).toBeCloseTo(before, 9);
		// No new intent kind and no Camera pose composition in the shell.
		expect(request.mock.calls.every(([intent]) => ['zoom', 'fit'].includes(intent.kind))).toBe(true);

		target.querySelector<HTMLButtonElement>('[data-drafting-scale]')!.click();
		await tick();
		target.querySelector<HTMLButtonElement>('[data-drafting-fit]')!.click();
		await frame();
		expect(request.mock.calls.at(-1)![0]).toMatchObject({ kind: 'fit' });
	});

	it('dismisses a disclosure on a sibling press and moves focus into then out of it', async () => {
		const trigger = target.querySelector<HTMLButtonElement>('[data-drafting-scale]')!;
		trigger.click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		const panel = target.querySelector<HTMLElement>('#drafting-scale-panel')!;
		expect(panel).not.toBeNull();
		// Opening the dialog puts focus on a control inside it, not behind it.
		expect(panel.contains(document.activeElement)).toBe(true);

		// A sibling control is outside the disclosure and dismisses it before its
		// own click runs; the action wrapper's stopPropagation must not defeat that.
		gridKey().dispatchEvent(new Event('pointerdown', { bubbles: true }));
		await tick();
		expect(trigger.getAttribute('aria-expanded')).toBe('false');

		trigger.click();
		await tick();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await tick();
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(trigger);
	});

	it('announces the temporary Snap hold without changing the durable switch', async () => {
		const status = target.querySelector<HTMLElement>('#drafting-snap-state')!;
		expect(status.getAttribute('role')).toBe('status');
		expect(status.textContent?.trim()).toBe('Snap 1 m');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true, bubbles: true }));
		await frame();
		expect(status.textContent?.trim()).toBe('Snap held');
		// The durable fact is still on; only the hold is temporary.
		expect(snapKey().getAttribute('aria-pressed')).toBe('true');
		window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', bubbles: true }));
		await frame();
		expect(status.textContent?.trim()).toBe('Snap 1 m');
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
		const controls = [...target.querySelectorAll<HTMLButtonElement>('[data-stage-drafting] button')];
		expect(controls.length).toBeGreaterThan(3);
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
		expect(target.querySelector('[data-drafting-scale]')!.getAttribute('aria-expanded')).toBe('false');
		expect(target.querySelector('[data-drafting-config]')!.getAttribute('aria-expanded')).toBe('false');

		const source = readFileSync(
			'src/lib/authoring/stage/shell/StageDraftingControl.svelte',
			'utf8'
		);
		expect(source).toContain('@media (pointer: coarse)');
		expect(source).toMatch(/min-height:\s*44px/);
		expect(source).toMatch(/min-width:\s*44px/);
	});
});

describe('R217.S05 — the drafting configuration and scale bar', () => {
	it('overrides the minor interval from the configuration disclosure as view state', async () => {
		const before = facade().snapshot().canonicalJson;
		const interval = target.querySelector<HTMLSelectElement>('[data-drafting-config]')!;
		interval.click();
		await tick();
		const select = target.querySelector<HTMLSelectElement>('[data-drafting-config] + .panel select, .config-panel select');
		expect(select).not.toBeNull();
		select!.value = '2';
		select!.dispatchEvent(new Event('change', { bubbles: true }));
		await frame();
		expect(facade().session.drafting().gridMinorMeters).toBe(2);
		expect(target.querySelector('[data-drafting-grid]')!.textContent?.trim()).toBe('Grid 2 m');
		expect(facade().snapshot().canonicalJson).toBe(before);
	});

	it('reads a round scale bar on the settled evaluation', async () => {
		const bar = target.querySelector<HTMLElement>('[data-stage-scale-bar]');
		expect(bar).not.toBeNull();
		expect(bar!.getAttribute('aria-label')).toMatch(/^Scale bar: [0-9.]+ m$/);
		expect(bar!.querySelector('.rule')).not.toBeNull();
	});
});
