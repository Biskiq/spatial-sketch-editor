// @vitest-environment jsdom
/** Mounted host pointer contract. Reuses the source-replacement route probes and
 * virtual-module aliases; boot, Camera, facade, Layout adapter and F4 are real.
 * Only WebGL/Head rendering and local network IO are doubled. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
const harness = vi.hoisted(() => ({
	document: null as unknown,
	facade: null as unknown,
	host: null as unknown,
	artwork: {
		assetId: '00000000-0000-4000-8000-000000000001',
		bytes: Uint8Array.from(
			Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64')
		),
		row: {
			id: '00000000-0000-4000-8000-000000000001',
			projectId: 'project-1',
			name: 'Gesture print',
			kind: 'texture',
			storageKind: 'r2',
			sourceKind: 'upload',
			sourceRef: null,
			mime: 'image/png',
			byteSize: 68,
			sha256: 'sha256-5e3d382db4dd83d59aa5742793ad6b7903409e865c83bcbc54835049f043bc15',
			importState: 'ready',
			createdAt: '2026-11-11T00:00:00.000Z',
			updatedAt: '2026-11-11T00:00:00.000Z'
		}
	}
}));
vi.mock('$lib/render/artwork/artwork-decode', () => ({ verifyArtworkDecode: async () => {} }));
vi.mock('$lib/authoring/stage/stage-facade', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/stage-facade')>();
	return { ...actual, createStageFacade: (...args: Parameters<typeof actual.createStageFacade>) => {
			const facade = actual.createStageFacade(...args);
			vi.spyOn(facade, 'acquireInspection');
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
vi.mock('$lib/authoring/stage/shell/EditorHead.svelte', async () => ({ default: (await import('../fixtures/HeadProbe.svelte')).default }));
vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({ default: (await import('../fixtures/StageCanvasProbe.svelte')).default }));
vi.mock('$lib/platform/project-persistence', async (original) => {
	const actual = await original<typeof import('$lib/platform/project-persistence')>();
	return { ...actual, createProjectAuth: () => ({ getSession: async () => ({ authenticated: false }), signIn() { }, async signOut() { } }),
		createProjectApi: () => ({
			async loadProject() { return { document: harness.document, savedBaseToken: 'base', savedRevision: { projectId: 'project-1', revisionId: 'revision-1' }, savedSourceContentId: 'content-1' }; },
			async listAssets() { return [harness.artwork.row]; },
			async loadAssetContent() { return { bytes: harness.artwork.bytes, mime: 'image/png' }; }
		}) };
});
import { mount, tick, unmount } from 'svelte';
import { type CameraFreeSceneDocument } from '@portfolio/project-model/units';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { layoutCapturedId } from '@portfolio/layout-core/plan';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import {
	buildStarterEnclosureLayout,
	STARTER_TEMPLATE_ID_CAPTURE
} from '$lib/authoring/stage/starter-gallery';
/** The starter keeps its fixed captured identity across every boot. */
const STARTER_WALL_2 = layoutCapturedId(STARTER_TEMPLATE_ID_CAPTURE, 'wall-chain-2');
import Page from '../../../../src/routes/project/[projectId]/spatial/+page.svelte';
const RECT = { left: 352, top: 73, width: 928, height: 720, right: 1280, bottom: 793, x: 352, y: 73, toJSON() { } };
let component: ReturnType<typeof mount>;
/** False after a test intentionally unmounts its route, so afterEach is not a second teardown. */
let componentMounted = false;
let target: HTMLElement;
let frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let wallId: string;
let captureDescriptor: PropertyDescriptor | undefined;
const facade = () => harness.facade as StageFacade;
const button = (text: string) => {
	const found = [...target.querySelectorAll('button')].find(
		(b) => (b.getAttribute('aria-label') ?? b.textContent)?.replace(/\s+/g, '').toLowerCase() === text.replace(/\s+/g, '').toLowerCase());
	if (!found)
		throw new Error(`Missing button ${text}`);
	return found;
};
const stage = () => target.querySelector<HTMLElement>('.stage')!;
/** Fit is the lower-right cluster's own button (O8). */
async function fitAll() {
	// The real guarded Fit shortcut replaces the retired persistent cluster.
	stage().dispatchEvent(
		new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true })
	);
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
async function settled() { await tick(); await new Promise((r) => setTimeout(r, 0)); await frame(); }
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
async function mountRoute(
	layout = buildStarterEnclosureLayout(),
	scene?: CameraFreeSceneDocument
): Promise<void> {
	wallId = layout.walls[0]!.id;
	harness.document = await createUnitProject({ id: 'project-1', name: 'Mounted gestures', layout, ...(scene === undefined ? {} : { scene }) });
	target = document.createElement('div');
	document.body.append(target);
	component = mount(Page, { target });
	componentMounted = true;
	await vi.waitFor(() => expect(target.querySelector('[data-testid="stage-canvas"]')).not.toBeNull());
	await frame();
	button('Plan').click();
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
	// Browser-local app preferences persist across mounts, so a test that changes
	// one would otherwise seed every later mount's reading transition.
	try {
		globalThis.localStorage?.clear();
	} catch {
		// A runtime without web storage cannot have persisted a preference.
	}
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
	target.querySelector<HTMLButtonElement>('.facets button[aria-label="Walls"]')?.click();
	await tick();
	// T1.P02.S02: the Wall's own Card carries its fields and a handle press is direct
	// manipulation, so this contract runs with **no** contributed task open — an
	// adapter's gesture is offered the press first either way.
	await settled();
});
afterEach(() => {
	// The unfold store is a singleton session. A failed assertion must not leave
	// it active for the next mounted route, where it would deliberately suppress
	// ordinary Stage selection (the unfolded display owns the surface).
	wallUnfold.exit();
	if (componentMounted) unmount(component);
	componentMounted = false;
	target.remove();
	if (captureDescriptor === undefined)
		Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
	else
		Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', captureDescriptor);
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('mounted stage measure and erase', () => {
	async function drawPoint(point: readonly [number, number, number]) {
		const css = projected(point);
		pointer('pointerdown', css);
		pointer('pointerup', css);
		pointer('click', css);
		await frame();
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
});
