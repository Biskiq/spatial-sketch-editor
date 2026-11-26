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
import { armedLightKind, armLight, clearArmedLight } from '$lib/authoring/look/light-tool.svelte';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
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
function revealWallSize(): void {
	// A drag interruption leaves the disclosure open and the ray admitted; toggling
	// it again would close the control the next press needs.
	if (facade().marks().some((candidate) => candidate.id === 'layout-wall-length')) return;
	const chip = facade().marks().find(
		(candidate) => candidate.id === 'layout-wall-size-chip' && candidate.role === 'disclose'
	);
	if (chip === undefined || !facade().activateDisclosure(chip.id))
		throw new Error('the Wall size chip did not open');
}
async function startDrag() {
	// R217.S15 — the end point now moves the shared Junction; the measure ray is
	// the outward grip at that end. Marks are already in Stage-local CSS; pointer
	// intents add the accepted Stage rect.
	revealWallSize();
	const ray = facade().marks().find((mark) => mark.id === 'layout-wall-length');
	if (ray?.tip === null || ray?.tip === undefined) throw new Error('the Wall length ray is not projected');
	const press: [number, number] = [ray.tip[0] + RECT.left, ray.tip[1] + RECT.top];
	pointer('pointerdown', press);
	await frame();
	expect(facade().session.gesture()).not.toBeNull();
	const desired = projected([5.5, 0, -4]);
	pointer('pointermove', desired);
	await frame();
	expect(target.querySelector('.candidate .tag')?.textContent).toContain('→');
	return desired;
}
/** The World toolbar's dock key, by its visible word. */
function worldKey(label: string): HTMLButtonElement {
	const key = [...target.querySelectorAll<HTMLButtonElement>('[data-world-toolbar] .dock .key')]
		.find((node) => `${node.getAttribute('title') ?? ''} ${node.textContent ?? ''}`.includes(label));
	if (key === undefined) throw new Error(`Missing World key ${label}`);
	return key;
}
/** One kind in the external Library's rail. */
function libraryKind(label: string): HTMLButtonElement {
	const kind = [...target.querySelectorAll<HTMLButtonElement>('[data-stage-library] [data-library-kind]')]
		.find((node) => node.textContent?.includes(label));
	if (kind === undefined) throw new Error(`the Library offers no ${label} kind`);
	return kind;
}
/** Open the Library, show Objects, and choose the first approved object to arm placement. */
async function openPlacement(): Promise<void> {
	worldKey('Library').click();
	await settled();
	libraryKind('Objects').click();
	await settled();
	const tile = target.querySelector<HTMLButtonElement>('[data-stage-library] [data-library-simple]');
	if (tile === null) throw new Error('the Library offers no object tile');
	tile.click();
	await settled();
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

describe('mounted stage drawing', () => {
	/** One dock key, by its contributed entry id — the dock shows adapter labels. */
	/** The World toolbar owns the dock now; Build is the visible Ink key. */
	function dockKey(id: string): HTMLButtonElement {
		if (id === 'layout-ink') return worldKey('Build');
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

	it('arms Ink from the dock, taps points without re-selecting, and finishes with Enter', async () => {
		const before = facade().selection()?.sourceId;
		const pose = facade().camera.state().pose;
		// Nothing is selected-and-invoked first: the dock is how a tool is armed.
		dockKey('layout-ink').click();
		await settled();
		expect(dockKey('layout-ink').getAttribute('aria-pressed')).toBe('true');
		expect(target.querySelector('[data-ink-plate]')).not.toBeNull();
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
		expect(target.querySelector('[data-ink-plate]')).not.toBeNull();

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
		// The World row arms Ink with its exact palette folded; open that layer so
		// Escape can exercise the palette-first unwind.
		target.querySelector<HTMLButtonElement>('[data-ink-plate] .act.more')!.click();
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
		expect(dockKey('layout-ink').getAttribute('aria-pressed')).toBe('true');

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
		expect(type.mock.calls.map(([intent]) => intent)).toEqual(['2', 'm', 'e', 'l', 'p', 'v'].map((key) => ({ kind: 'type', key })));
		expect(facade().evaluation()?.settledReading).toBe('plan');
		expect(facade().session.task()).toBeNull();
		pointer('pointercancel', desired);
		await frame();
	});

	it('arms every dock key by its shortcut and from Find without changing the selection', async () => {
		const before = facade().selectionState();
		for (const [letter, kind] of [['p', 'layout-ink'], ['m', 'host-measure'], ['e', 'host-erase']] as const) {
			key(letter);
			await settled();
			expect(facade().session.task()?.kind, letter).toBe(kind);
			expect(facade().selectionState()).toEqual(before);
			const engaged = [
				...target.querySelectorAll<HTMLElement>(
					'[data-world-toolbar] .dock .key[aria-pressed="true"], [data-view-measure][aria-pressed="true"]'
				)
			];
			expect(engaged, letter).toHaveLength(1);
		}
		// U5: `L` opens the Library (the dock key's own action), not a placement.
		key('l');
		await settled();
		expect(target.querySelector('[data-stage-library]')).not.toBeNull();
		expect(facade().selectionState()).toEqual(before);
		key('l');
		await settled();
		expect(target.querySelector('[data-stage-library]')).toBeNull();
		key('v');
		await settled();
		expect(facade().session.task()).toBeNull();
		expect(worldKey('Select').getAttribute('aria-pressed')).toBe('true');
		expect(facade().selectionState()).toEqual(before);
		// The World dock order is Select · families · direct tools · Library.
		expect(
			[...target.querySelectorAll<HTMLElement>('[data-world-toolbar] .dock .kl')].map((node) => node.textContent?.trim())
		).toEqual(['Select', 'Build', 'Form', 'Landscape', 'Furnish', 'Paint', 'Erase', 'Library']);
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

	it('opens the placement Instrument from the Library key', async () => {
		await openPlacement();
		expect(facade().session.task()?.kind).toBe('place-object');
		expect(target.querySelector('[data-stage-instrument="place-object"]')).not.toBeNull();
	});

	it('hides a selected Wall\'s marks while an armed Lights task owns the surface', async () => {
		const wallMark = facade().marks().find((mark) => mark.id.startsWith('layout-wall-'));
		expect(wallMark).toBeDefined();
		armLight('project-1', 'spot');
		try {
			const opened = facade().openContributedTask('light-place', 'light');
			expect(opened.kind).toBe('opened');
			await frame();
			expect(facade().session.task()?.kind).toBe('light-place');
			expect(facade().selection()?.sourceId).toBe(wallId);
			expect(armedLightKind('project-1')).toBe('spot');
			// The open Lights task may keep its own selected-light marks, but the
			// previously selected Wall's marks belong to Layout, not this task.
			expect(facade().marks()).toEqual([]);
			expect(target.querySelector('[data-mark-id^="layout-wall-"]')).toBeNull();
			expect(facade().hitMark({ css: wallMark!.anchor, coarse: false })).toBeNull();
		} finally {
			facade().closeTask();
			clearArmedLight();
		}
	});
});
