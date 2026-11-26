// @vitest-environment jsdom
/** Mounted host pointer contract. Reuses the source-replacement route probes and
 * virtual-module aliases; boot, Camera, facade, Layout adapter and F4 are real.
 * Only WebGL/Head rendering and local network IO are doubled. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
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
import { readFileSync } from 'node:fs';
import { flushSync, mount, tick, unmount } from 'svelte';
import { captureUnitSave, type CameraFreeSceneDocument } from '@portfolio/project-model/units';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
import { createClosedWallCircleDocument, createEmptyWallFirstLayoutDocument, LAYOUT_WALL_FIRST_FORMAT_VERSION, planCreateWallFirstOpening, wallCubicChain, wallFirstWallLength, type LayoutDocumentWallFirst, type LayoutWall, type LayoutWallCurveKnot } from '@portfolio/layout-core/wall';
import { deriveChainSpans, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { layoutCapturedId } from '@portfolio/layout-core/plan';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import { wallUnfoldSourceSpans, wallUnfoldTopPoint } from '$lib/layout/wall-unfold';
import { buildWallUnfoldDisplay, unfoldDisplayPointAtStation, type WallUnfoldDisplay } from '$lib/layout/wall-unfold-pick';
import {
	buildStarterEnclosureLayout,
	STARTER_TEMPLATE_ID_CAPTURE
} from '$lib/authoring/stage/starter-gallery';

/** The starter keeps its fixed captured identity across every boot. */
const STARTER_WALL_2 = layoutCapturedId(STARTER_TEMPLATE_ID_CAPTURE, 'wall-chain-2');
import { armedLightKind, armLight, clearArmedLight } from '$lib/authoring/look/light-tool.svelte';
import { sliceReading } from '$lib/authoring/stage/slice/slice-reading.svelte';
import { pausedWallProposal } from '$lib/authoring/adapters/layout/paused-proposal';
import { wallStationFrame } from '$lib/authoring/adapters/layout/precision-frames';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import {
	draftingSnapIncrementMeters,
	metersPerCssPixelForScaleRatio
} from '$lib/authoring/stage/stage-drafting';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
import { stageEnvelope, stageLayout } from '$lib/authoring/stage/unit-stage-source';
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
/**
 * The keys' words never change: Grid and Snap are toggles, and their state lives
 * in `aria-pressed` and the shared engaged fill. The drafting session still owns
 * the fact, so the helper keeps reading it.
 */
const currentSnapLabel = () => {
	void draftingSnapIncrementMeters(facade().session.drafting());
	return 'Snap';
};
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

/**
 * The shell's dock/Ink/Delete wiring, driven through the **mounted route**.
 *
 * These are the caller-level facts the adapter suite cannot prove: that a tool is
 * armed from the dock with nothing selected, that its taps reach the adapter and
 * never re-select underneath it, that `Enter` finishes and the tool survives the
 * install it caused, that `Escape` unwinds palette-first, and that `Delete`
 * discloses a Wall's consequences before the second press runs it.
 */

/**
 * R217.S05 — the drafting furniture, driven through the mounted route.
 *
 * The pure facts live in `stage-drafting.test.ts` and the grid arithmetic in
 * `stage-grid.test.ts`. What only the mounted host proves is that the furniture
 * is wired to those facts, that its changes never reach F4/history/Save, and
 * that Scale asks the existing Camera intent seam rather than composing a pose.
 */

/**
 * R217.S23 — the Ink row, its upward disclosures and the constrained Index, mounted. Every
 * Ink mode and typed path is driven through the palette's own controls, so a row that
 * lost one would fail here as a missing hook or a chain that did not move.
 */

/* ------------------------------------------------------------------------- *
 * C3 checkpoint 5 — inverse picking through the live mounted Stage.
 *
 * These tests deliberately do not call `pickWallUnfold` themselves for the
 * behaviour under test. They enter the real unfold session, dispatch a real
 * pointer event at the Stage element and read the route's own pick record and
 * ordinary selection. The display is constructed only to find a developed
 * point to press and to state the expected canonical attribution.
 * ------------------------------------------------------------------------- */
type UnfoldFixture = {
	readonly label: string;
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
};

function unfoldKnots(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
	return points.map((point, index) => ({ id: `wall-a:knot:${index + 1}`, point: [point[0], point[1]] }));
}

function unfoldDocument(
	centerline: LayoutWall['centerline'],
	start: LayoutVec2,
	end: LayoutVec2
): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'j-a', point: [start[0], start[1]] },
		{ id: 'j-b', point: [end[0], end[1]] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			thickness: 0.2,
			height: 3,
			centerline
		} as LayoutWall
	];
	return document;
}

function unfoldChain(points: LayoutVec2[]): LayoutDocumentWallFirst {
	return unfoldDocument(
		wallCubicChain(unfoldKnots(...points.slice(1, -1)), deriveChainSpans(points)),
		points[0]!,
		points.at(-1)!
	);
}

function unfoldFixtures(): UnfoldFixture[] {
	const multi: LayoutVec2[] = [[0, 0], [2, 1.5], [4, -1], [6, 1], [8, -1], [10, 1.2], [12, 0]];
	const sCurve: LayoutVec2[] = [[0, 0], [1.5, 2.5], [4.5, -2.5], [6, 0]];
	const circle = createClosedWallCircleDocument({
		center: [0, 0],
		rim: [5, 0],
		junctionId: 'j-circle',
		wallId: 'wall-circle',
		thickness: 0.2,
		height: 3
	});
	if (circle.kind !== 'success') throw new Error(JSON.stringify(circle.rejection));
	return [
		{ label: 'straight', wallId: 'wall-a', document: unfoldDocument({ kind: 'line' }, [0, 0], [6, 0]) },
		{ label: 'multi-bezier', wallId: 'wall-a', document: unfoldChain(multi) },
		{ label: 's-curve', wallId: 'wall-a', document: unfoldChain(sCurve) },
		{
			label: 'inflection',
			wallId: 'wall-a',
			document: unfoldDocument(
				wallCubicChain([], [{ handleOut: [1.5, 3], handleIn: [4.5, -3] }]),
				[0, 0],
				[6, 0]
			)
		},
		{ label: 'closed-circle', wallId: 'wall-circle', document: circle.document }
	];
}

function openingOn(fixture: UnfoldFixture, offset: number, width: number) {
	const plan = planCreateWallFirstOpening(
		fixture.document,
		{ wallId: fixture.wallId, kind: 'window', offset, width, height: 1.2, sillHeight: 1 },
		freshCapture(),
		fixture.document.floor.id
	);
	if (plan.kind === 'rejected') throw new Error(JSON.stringify(plan.rejection));
	return { document: plan.document, openingId: plan.changedOpeningIds[0]! };
}

async function remountWith(layout: LayoutDocumentWallFirst): Promise<void> {
	unmount(component);
	target.remove();
	await mountRoute(layout);
	await frame();
}

/** Enter the real session and let the declared 1 s face transition settle. */
async function enterUnfold(wallId: string, anchorStation = 0): Promise<void> {
	const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
	const wall = facade().snapshot().domain.geometry.walls.find((candidate) => candidate.wallId === wallId);
	if (wall === undefined) throw new Error(`missing compiled Wall ${wallId}`);
	wallUnfold.enter(wall, anchorStation);
	clock.mockReturnValue(2000);
	for (let index = 0; index < 4; index += 1) await frame();
	expect(wallUnfold.state?.u).toBe(1);
}

type DisplayTriangle = WallUnfoldDisplay['mesh']['triangles'][number];

function triangleCentroid(display: WallUnfoldDisplay, triangle: DisplayTriangle): [number, number, number] {
	const sum: [number, number, number] = [0, 0, 0];
	for (const index of triangle.indices) {
		sum[0] += display.positions[index * 3]!;
		sum[1] += display.positions[index * 3 + 1]!;
		sum[2] += display.positions[index * 3 + 2]!;
	}
	return [sum[0] / 3, sum[1] / 3, sum[2] / 3];
}

function wrappedStation(value: number, length: number): number {
	const wrapped = value % length;
	return wrapped < 0 ? wrapped + length : wrapped;
}

/** The station at the triangle centroid, from its three attributed vertices. */
function triangleStation(display: WallUnfoldDisplay, triangle: DisplayTriangle): number {
	return triangle.indices.reduce((sum, index) => sum + display.mesh.vertices[index]!.station, 0) / 3;
}

function developedDisplay(fixture: UnfoldFixture): WallUnfoldDisplay {
	const wall = facade().snapshot().domain.geometry.walls.find((candidate) => candidate.wallId === fixture.wallId)!;
	const state = wallUnfold.state!;
	const spans = wallUnfoldSourceSpans(fixture.document, fixture.wallId, wall.length);
	const display = buildWallUnfoldDisplay(wall, state, {
		floorY: facade().snapshot().domain.datumMeters,
		spans,
		sideAngle: wallUnfold.presentationAngle
	});
	if (display === null) throw new Error('the developed display was refused');
	return display;
}

function openingFaceTriangle(display: WallUnfoldDisplay, offset: number, width: number): DisplayTriangle | undefined {
	return display.mesh.triangles.find((triangle) => {
		const middle = (triangle.stationStart + triangle.stationEnd) / 2;
		return (
			triangle.face === 'right' &&
			middle > offset + Math.min(0.05, width * 0.1) &&
			middle < offset + width - Math.min(0.05, width * 0.1)
		);
	});
}

/* ------------------------------------------------------------------------- *
 * X2 — extracted gesture lifetimes through the mounted route.
 *
 * These cases exercise the ownership moved into stage-artwork-interaction,
 * stage-unfold-gestures and the input arbiter: one captured lease, one accepted
 * operation on success, zero on cancel, unchanged selected identity, and no
 * second history writer. The route only composes the controllers.
 * ------------------------------------------------------------------------- */
const ARTWORK_ID = 'gesture-artwork';
const ARTWORK_ASSET = harness.artwork.assetId;

function artworkScene(): CameraFreeSceneDocument {
	return {
		formatVersion: 12,
		textures: [],
		materials: [],
		artworkLibrary: [
			{ assetId: ARTWORK_ASSET, name: 'Gesture print', pixelWidth: 1, pixelHeight: 1 }
		],
		entities: [
			{
				kind: 'artwork',
				id: ARTWORK_ID,
				name: 'Gesture print',
				position: [0, 1.6, 0],
				rotation: [0, 0, 0],
				source: { kind: 'image', assetId: ARTWORK_ASSET, pixelWidth: 1, pixelHeight: 1 },
				widthMeters: 1.4
			}
		]
	};
}

async function remountWithScene(scene: CameraFreeSceneDocument): Promise<void> {
	unmount(component);
	target.remove();
	await mountRoute(buildStarterEnclosureLayout(), scene);
	await frame();
}

/** Settle the declared reading transition into 3D without waiting on wall-clock. */
async function settle3d(): Promise<void> {
	const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
	button('3D').click();
	clock.mockReturnValue(2_000);
	for (let index = 0; index < 4; index += 1) await frame();
	expect(facade().evaluation()?.settledReading).toBe('3d');
}

/** Dispatch a pointer event on a control (the Stage grip owns its own press). */
function pointerOn(
	node: EventTarget,
	type: string,
	point: readonly [number, number],
	id = 1
): void {
	const event = new MouseEvent(type, { bubbles: true, clientX: point[0], clientY: point[1] });
	Object.defineProperty(event, 'pointerId', { value: id });
	Object.defineProperty(event, 'pointerType', { value: 'mouse' });
	node.dispatchEvent(event);
}

function gripPoint(grip: HTMLElement): [number, number] {
	return [Number.parseFloat(grip.style.left) + RECT.left, Number.parseFloat(grip.style.top) + RECT.top];
}

async function selectArtwork(): Promise<HTMLButtonElement> {
	await settle3d();
	const row = indexRowOf(target, ARTWORK_ID);
	if (row === null) throw new Error('the Artwork has no Index row');
	row.click();
	await frame();
	await vi.waitFor(() => expect(target.querySelector('[aria-label="Resize Artwork"]')).not.toBeNull());
	return target.querySelector<HTMLButtonElement>('[aria-label="Resize Artwork"]')!;
}

describe('mounted Height Sheet', () => {
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

		// Pins and a drag are the same session fact, not a source edit. The Sheet
		// exposes no pin CRUD; a pin click moves the Sheet to the pin.
		facade().session.heightSheet().addPin(0.4);
		await frame();
		expect(pins()).toEqual([0.4]);
		sheet!.querySelector<HTMLButtonElement>('button[aria-label^="Jump to pin at 0.40"]')!.click();
		await frame();
		expect(height()).toBeCloseTo(0.4, 6);
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
		facade().session.heightSheet().addPin(0.4);
		await frame();
		expect(pins()).toHaveLength(1);
		expect(
			sheetNode()!.querySelector<HTMLButtonElement>('button[aria-label^="Jump to pin"]')
		).not.toBeNull();

		facade().session.heightSheet().reset();
		await frame();
		expect(pins()).toEqual([]);
		expect(
			sheetNode()!.querySelector<HTMLButtonElement>('button[aria-label^="Jump to pin"]')
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
		facade().session.heightSheet().addPin(0.75);
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
		expect(pins()).toEqual([0.75]);
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
		expect(target.querySelector('[data-stage-zoom]')).toBeNull();
		expect(target.querySelector('[data-stage-scale-bar]')).not.toBeNull();
		expect(Number(sliderNode()!.getAttribute('aria-valuenow'))).toBeCloseTo(0.8, 6);
		// The unmount published inactive before the lens returned; no tail survives
		// the switch and the plane starts hidden until the Sheet is activated again.
		expect(canvasProbe()?.dataset.heightPlane).toBe('false');
	});

	it('measures the lanes without observing an unmounted slot when the lens leaves World', async () => {
		// jsdom has no ResizeObserver, so the lane effects return before observing. A
		// browser's observer rejects anything that is not an Element; leaving World nulls
		// the zoom slot's binding, which must read as "no lane", never `observe(null)`.
		const observed: Element[] = [];
		class StrictResizeObserver {
			observe(element: unknown): void {
				if (!(element instanceof Element)) throw new TypeError("Failed to execute 'observe' on 'ResizeObserver'");
				observed.push(element);
			}
			unobserve(): void {}
			disconnect(): void {}
		}
		vi.stubGlobal('ResizeObserver', StrictResizeObserver);
		const errors: unknown[] = [];
		const onError = (event: ErrorEvent): void => {
			errors.push(event.error);
		};
		window.addEventListener('error', onError);
		try {
			target.querySelector<HTMLButtonElement>('[data-testid="lens-world"]')!.click();
			await frame();
			target.querySelector<HTMLButtonElement>('[data-testid="lens-experience"]')!.click();
			await frame();
			expect(target.querySelector('[data-stage-zoom]')).toBeNull();
			target.querySelector<HTMLButtonElement>('[data-testid="lens-world"]')!.click();
			await frame();
			expect(target.querySelector('[data-stage-zoom]')).toBeNull();
			expect(sheetNode()).not.toBeNull();
			expect(errors).toEqual([]);
			expect(observed.length).toBeGreaterThan(0);
		} finally {
			window.removeEventListener('error', onError);
			vi.unstubAllGlobals();
		}
	});

});
