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
import { sliceReading } from '$lib/authoring/stage/slice/slice-reading.svelte';
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
/** A projected Wall that is not the selected one, so its hover is not a mark. */
function anotherWall(): { readonly id: string; readonly css: [number, number];
} {
	const plan = facade().plan();
	if (plan.kind !== 'evaluated') throw new Error('no Plan');
	const fragment = plan.plan.fragments.find((f) => f.ref.sourceKind === 'wall' && f.ref.sourceId !== wallId)!;
	const geometry = fragment.geometry;
	const points = geometry.kind === 'span' ? [geometry.start, geometry.end] : geometry.kind === 'polyline' ? geometry.polyline : geometry.polygon;
	const center = points.reduce((sum, p) => [sum[0]! + p[0] / points.length, sum[1]! + p[1] / points.length], [0, 0]);
	return { id: fragment.ref.sourceId, css: projected([center[0]!, fragment.elevationMeters, center[1]!]) };
}
/** The World toolbar's dock key, by its visible word. */
function worldKey(label: string): HTMLButtonElement {
	const key = [...target.querySelectorAll<HTMLButtonElement>('[data-world-toolbar] .dock .key')]
		.find((node) => `${node.getAttribute('title') ?? ''} ${node.textContent ?? ''}`.includes(label));
	if (key === undefined) throw new Error(`Missing World key ${label}`);
	return key;
}
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

describe('mounted stage selection and tools', () => {
	it('arms Drawn from the Slice plate and commits one finite reading', async () => {
		worldKey('Build').click();
		await settled();
		const sliceTool = [...target.querySelectorAll<HTMLButtonElement>('[data-world-toolbar] .tier .sub')].find(
			(node) => node.textContent?.trim() === 'Slice'
		);
		if (sliceTool === undefined) throw new Error('the Build family offers no Slice tool');
		sliceTool.click();
		await settled();
		expect(sliceReading.reading).toMatchObject({ kind: 'level' });
		expect(target.querySelector('[data-slice-plate]')).not.toBeNull();

		button('Drawn cut').click();
		await settled();
		expect(button('Drawn cut').getAttribute('aria-pressed')).toBe('true');

		const start = projected([0, 0, -4]);
		const end = projected([4, 0, -4]);
		pointer('pointerdown', start);
		await frame();
		pointer('pointermove', end);
		await frame();
		pointer('pointerup', end);
		await settled();

		const reading = sliceReading.reading;
		if (reading?.kind !== 'drawn') throw new Error('the drawn gesture did not commit');
		expect(reading.start[0]).toBeCloseTo(0, 6);
		expect(reading.start[1]).toBeCloseTo(-4, 6);
		expect(reading.end[0]).toBeCloseTo(4, 6);
		expect(reading.end[1]).toBeCloseTo(-4, 6);
		// The route probe's Canvas does not publish content bounds, so this is the
		// minimum; the real Canvas defaults to the far-side distance.
		expect(reading.depthMeters).toBeGreaterThanOrEqual(0.1);
		expect(target.querySelector('[data-slice-pill]')?.textContent).toContain('Drawn cut');

		button('Flip').click();
		await settled();
		expect(sliceReading.reading).toMatchObject({ hidden: 'left' });

		target.querySelector<HTMLButtonElement>('[data-slice-put-back]')!.click();
		await settled();
		expect(sliceReading.reading).toBeNull();
	});

	it('moves every registered task entry to Find or the dock and leaves the Index a locator', () => {
		// The host's own dock keys (Select, Paint, Measure, Eraser) are Find entries too.
		const registered = [
			...facade().findEntries().map((entry) => `${entry.adapterId}:${entry.id}`),
			'project-replacement:starter',
			'host:host-select',
			'host:host-paint',
			'host:host-measure',
			'host:host-erase',
			// T1 SL1: Slice is a dock tool, so its host key is a Find entry too.
			'host:host-slice',
			// T5.1: Object Studio's route-level entry (a new object in its own project).
			'studio:new-object-project'
		].sort();
		const reachable = [...target.querySelectorAll<HTMLElement>('[data-head-find] [data-find-id]')]
			.filter((entry) => !['subject','scope','view-command'].includes(entry.dataset.findAdapter??''))
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
		target.querySelector<HTMLButtonElement>('[aria-label="Subject actions"]')!.click();
		await frame();
		target.querySelector<HTMLButtonElement>('[aria-label="Subject actions"]')!.click();
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

	it('leaves Select to the Stage gizmo instead of opening a plate', async () => {
		// A family arms its plate, so Select has one to dismiss.
		worldKey('Build').click();
		await settled();
		expect(target.querySelector('[data-world-toolbar] .tier')).not.toBeNull();

		worldKey('Select').click();
		await settled();
		expect(target.querySelector('[data-world-toolbar] .tier')).toBeNull();
		const select = worldKey('Select');
		expect(select.getAttribute('aria-pressed')).toBe('true');
		expect(select.hasAttribute('aria-expanded')).toBe(false);
		expect(select.hasAttribute('aria-controls')).toBe(false);

		// A second press only re-arms the tool; it never reopens a readout.
		select.click();
		await settled();
		expect(target.querySelector('[data-world-toolbar] .tier')).toBeNull();
		expect(target.textContent).not.toContain('Nothing selected');

		// Selection itself is unchanged: the Stage still selects and reports it.
		const center = projected([3.5, 0, -4]);
		pointer('pointerdown', center);
		pointer('pointerup', center);
		pointer('click', center);
		await settled();
		expect(facade().selection()?.sourceId).toBe(wallId);
	});

	it('keeps Stage, Card and Index on the same selected identity with an offset Stage', async () => {
		// The placeholder gold dot is gone; identity is echoed by the Card and the
		// Index rather than by a second projection marker.
		expect(target.querySelector('.stage .selection')).toBeNull();
		expect(facade().selection()?.sourceId).toBe(wallId);
		// The Card and the Index show the subject's name; its canonical identity is the
		// row's `data-source-id` and the Card's, never visible text.
		const card = target.querySelector('[aria-label="Selected subject"]');
		expect(card?.getAttribute('data-source-id')).toBe(wallId);
		const index = target.querySelector('[data-plate-landmark="index"]');
		expect(indexRowOf(index as HTMLElement, wallId)?.getAttribute('aria-current')).toBe('true');
	});

	it('reports excluded Plan subjects on a miss without reporting ordinary empty clicks', async () => {
		const point: [number, number] = [RECT.left + 25, RECT.top + 25];
		const notice = 'Nothing selectable there — some subjects are excluded from this Plan; Reveal one from the Index.';
		const stageFacade = facade();
		const initial = stageFacade.plan();
		if (initial.kind !== 'evaluated') throw new Error('the Plan did not evaluate');
		expect(initial.plan.membership.every((row) => row.eligible)).toBe(true);
		pointer('pointerdown', point); pointer('pointerup', point); pointer('click', point);
		await frame();
		expect(target.textContent).not.toContain('Nothing selectable there');

		stageFacade.setPlanParameters({ sourceKindFilter: ['wall'] });
		const filtered = stageFacade.plan();
		if (filtered.kind !== 'evaluated' || !filtered.plan.membership.some((row) => !row.eligible)) {
			throw new Error('the fixture needs an excluded Plan subject');
		}
		await frame();
		pointer('pointerdown', point); pointer('pointerup', point); pointer('click', point);
		await frame();
		expect(target.textContent).toContain(notice);
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
});
