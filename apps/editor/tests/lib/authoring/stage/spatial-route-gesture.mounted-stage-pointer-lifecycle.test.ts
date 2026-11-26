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
import { captureUnitSave, type CameraFreeSceneDocument } from '@portfolio/project-model/units';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import { pausedWallProposal } from '$lib/authoring/adapters/layout/paused-proposal';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
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

describe('mounted stage pointer lifecycle', () => {
	it('releases a navigation lease when pointer capture fails', async () => {
		const point: [number, number] = [RECT.left + 25, RECT.top + 25];
		vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementationOnce(() => {
			throw new DOMException('Pointer ended', 'NotFoundError');
		});
		expect(() => pointer('pointerdown', point)).not.toThrow();
		expect(facade().session.gesture()).toBeNull();
		pointer('pointerdown', point);
		expect(facade().session.gesture()?.navigation).toBe(true);
		pointer('pointerup', point);
	});

	it('offers a selected Wall press to its adapter before navigation', async () => {
		const stage = facade();
		const adapter = vi.spyOn(stage, 'pointerIntent');
		const gesture = vi.spyOn(stage, 'acquireGesture');
		revealWallSize();
		const mark = stage.marks().find((item) => item.id === 'layout-wall-length');
		if (mark?.tip == null) throw new Error('the Wall length ray is not projected');
		pointer('pointerdown', [mark.tip[0] + RECT.left, mark.tip[1] + RECT.top]);
		expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ phase: 'down' }));
		expect(stage.session.gesture()?.owner).not.toBe('stage-pointer');
		expect(gesture.mock.calls.some(([request]) => request.owner === 'stage-pointer')).toBe(false);
		pointer('pointercancel', [mark.tip[0] + RECT.left, mark.tip[1] + RECT.top]);
	});

	it('offers an unclaimed press to adapters before starting navigation', async () => {
		const stage = facade();
		const adapter = vi.spyOn(stage, 'pointerIntent');
		const gesture = vi.spyOn(stage, 'acquireGesture');
		const point: [number, number] = [RECT.left + 25, RECT.top + 25];
		pointer('pointerdown', point);
		const adapterDown = adapter.mock.calls.findIndex(([request]) => request.phase === 'down');
		const navigation = gesture.mock.calls.findIndex(([request]) => request.owner === 'stage-pointer');
		expect(adapterDown).toBeGreaterThanOrEqual(0);
		expect(navigation).toBeGreaterThanOrEqual(0);
		expect(adapter.mock.invocationCallOrder[adapterDown]!).toBeLessThan(gesture.mock.invocationCallOrder[navigation]!);
		expect(stage.session.gesture()?.navigation).toBe(true);
		pointer('pointerup', point);
	});

	it('commits one uninterrupted drag across ordinary Camera evaluation updates', async () => {
		const baseline = facade().snapshot().canonicalJson;
		const id = facade().evaluationId();
		const point = await startDrag();
		// An ordinary Camera update (not a reading flip) while the adapter owns the
		// drag: the evaluation changes, the proposal and press stay live.
		const evaluation = facade().camera.evaluation()!;
		facade().camera.applyIntent(
			{ kind: 'pan', deltaCss: [6, 0], rect: evaluation.rect },
			performance.now() / 1000
		);
		await frame();
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
		button('Plan').click();
		await frame();
		expect(facade().evaluation()?.settledReading).toBe('plan');
		expect(target.querySelector('.instrument')).toBeNull();
		expect([...target.querySelectorAll('.marker')].some((e) => e.textContent?.includes('Paused'))).toBe(false);
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

	it('contains a failed second-pointer capture during pinch', async () => {
		const first: [number, number] = [RECT.left + 25, RECT.top + 25];
		const second: [number, number] = [first[0] + 100, first[1]];
		const capture = vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation((id) => {
			if (id === 2) throw new DOMException('Pointer ended', 'NotFoundError');
		});
		const errors: unknown[] = [];
		const onError = (event: ErrorEvent) => {
			errors.push(event.error);
			event.preventDefault();
		};
		window.addEventListener('error', onError);
		try {
			pointer('pointerdown', first, false, 1, 'touch');
			pointer('pointerdown', second, false, 2, 'touch');
			await frame();
			expect(capture).toHaveBeenCalledWith(2);
			expect(errors).toEqual([]);
			expect(facade().session.gesture()?.navigation).toBe(true);
			pointer('pointerup', second, false, 2, 'touch');
			await frame();
			expect(facade().session.gesture()).toBeNull();
		} finally {
			window.removeEventListener('error', onError);
		}
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
			materialId: 'plaster-warm' as const, castShadow: true, receiveShadow: true, position: [2, 0.5, -2] as [number, number, number], rotation: [0, 0, 0] as [number, number, number]
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
