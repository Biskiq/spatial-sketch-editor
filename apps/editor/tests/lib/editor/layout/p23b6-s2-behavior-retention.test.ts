/**
 * P23B.6 S2 — current-behavior pins and the history/GPU retention harness.
 *
 * The mesh and Plan pins use the committed S1 fixtures. Retention tests drive
 * the same preview state and chronological store as the editor. With
 * `--expose-gc`, WeakRefs prove release; without it, the tests exercise the
 * counted-reference fallback through the public undo/redo behavior and the
 * controller's bounded stack depths.
 */
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BufferGeometry } from 'three';
import { flushSync, mount, unmount } from 'svelte-client-runtime';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import {
	captureLayoutPreviewSnapshot,
	importLayoutPreviewJson,
	createEmptyWallFirstLayoutPreviewState,
	restoreLayoutPreviewSnapshot,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS, P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import { buildPlanRenderModel } from '$lib/layout/plan-render-model';
import { legJoinsByWall } from '@portfolio/layout-core';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';
import {
	createClientReactiveLayoutPreviewState,
	isSvelteStateProxy,
	loadClientCompiledPreviewModule,
	type ClientPreviewRuntime
} from './p23b7-reactive-preview-state';
import LayoutPreviewSceneMountHarness from './p23b6-layout-preview-scene-mount-harness.svelte';
import type { LayoutPreviewSceneInputs } from './p23b6-layout-preview-scene-mount-harness.svelte';

const PIN_FIXTURES = [
	'p23b-40-wall-straight-v1',
	'p23b-40-wall-all-curved-v1',
	'owner-40-curved-v1'
] as const;
const RETENTION_FIXTURE = 'p23b-12-wall-target-curved-v1';
const EDIT_WALL = 'room-0:wall-0';
const GC_REQUIRED = process.env.P23B6_REQUIRE_GC === '1';
const EXPECTED_PLAN_LAYER_COUNTS = [
	[1, 10], [2, 10], [3, 40], [4, 0], [5, 0], [6, 0], [7, 0],
	[8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0]
];
const PLAN_GOLDENS: Record<(typeof PIN_FIXTURES)[number], string> = {
	'p23b-40-wall-straight-v1': '8704b4f62d3ec5cd2b846062ffdad05c8f3f7af8c218008a7caeb73b773f0dbf',
	'p23b-40-wall-all-curved-v1': '2a059ba0df6e595db062ff02c7b9d4253cbf77c00e5ad11deeca501bd69438ce',
	'owner-40-curved-v1': '29693743e0823420530c18e8879aab6d81b899784c473e58e993754b318edf8d'
};
let unmountEvidence: UnmountWitness | null = null;

const sceneAdapterLedger = vi.hoisted(() => ({
	entries: [] as { disposeCalls: number }[]
}));

// The scene's resource effects do not depend on Three's renderer. Keep the
// actual LayoutPreviewScene mounted, while replacing Threlte's Object3D sinks
// so this Node test can observe the production effect lifecycle without WebGL.
vi.mock('@threlte/core', () => ({
	T: new Proxy({}, { get: () => () => undefined })
}));

vi.mock('$lib/render/wall-geometry-adapter', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/render/wall-geometry-adapter')>();
	return {
		...actual,
		toWallBufferGeometry(...args: Parameters<typeof actual.toWallBufferGeometry>) {
			const adapted = actual.toWallBufferGeometry(...args);
			const entry = { disposeCalls: 0 };
			sceneAdapterLedger.entries.push(entry);
			const dispose = adapted.dispose.bind(adapted);
			adapted.dispose = () => {
				entry.disposeCalls += 1;
				dispose();
			};
			return adapted;
		}
	};
});

type MatrixFixtureId = (typeof PIN_FIXTURES)[number] | typeof RETENTION_FIXTURE;
type WeakGenerationWitness = {
	geometry: WeakRef<object>;
	meshMap: WeakRef<object>;
	mesh: WeakRef<object>;
};
type UnmountWitness = {
	generations: WeakGenerationWitness[];
	preview: WeakRef<object>;
	store: WeakRef<object>;
};

function fixtureDocument(id: MatrixFixtureId) {
	if (id === 'owner-40-curved-v1') return P23B_OWNER_LAYOUT;
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === id);
	if (!spec) throw new Error(`unknown P23B.6 fixture ${id}`);
	return buildP23BMatrixFixture(spec);
}

function fixtureJson(id: MatrixFixtureId): string {
	return serializeWallFirstLayoutDocument(fixtureDocument(id));
}

function makePreview(id: MatrixFixtureId): LayoutPreviewState {
	const preview = createEmptyWallFirstLayoutPreviewState();
	if (!importLayoutPreviewJson(preview, fixtureJson(id))) {
		throw new Error(`${id} import failed: ${preview.importError ?? 'unknown error'}`);
	}
	return preview;
}

type HistoryHarness = {
	store: ReturnType<typeof createEditorStore>;
	preview: LayoutPreviewState;
	runtime: ClientPreviewRuntime;
};

async function makeHistoryHarness(id: MatrixFixtureId = RETENTION_FIXTURE): Promise<HistoryHarness> {
	const runtime = await loadClientCompiledPreviewModule();
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const preview = await createClientReactiveLayoutPreviewState();
	if (!runtime.importLayoutPreviewJson(preview, fixtureJson(id))) {
		throw new Error(`${id} import failed: ${preview.importError ?? 'unknown error'}`);
	}
	if (isSvelteStateProxy(preview.geometry) || isSvelteStateProxy(preview.model)) {
		throw new Error('client raw-field generations must not be deep-proxied');
	}
	store.registerLayoutHistory({
		capture: () => runtime.captureLayoutPreviewSnapshot(preview),
		replace: (snapshot) => runtime.restoreLayoutPreviewSnapshot(preview, snapshot as never),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => preview);
	return { store, preview, runtime };
}


function commitWallMove(harness: HistoryHarness, index: number): string {
	const { store, preview, runtime } = harness;
	expect(store.beginLayoutTransaction(), 'the layout transaction begins').toBe(true);
	const delta = index % 2 === 0 ? 0.01 : -0.01;
	const result = runtime.updateWallFirstWallMove(preview, EDIT_WALL, [delta, 0]);
	expect(result.success, `the Wall move is accepted: ${result.success ? '' : result.message}`).toBe(true);
	const snapshot = runtime.captureLayoutPreviewSnapshot(preview);
	expect(store.commitLayoutTransaction(snapshot), 'the changed snapshot commits').toBe(true);
	return runtime.layoutPreviewAuthoredJson(preview);
}

function historyDepths(store: ReturnType<typeof createEditorStore>): { past: number; future: number } {
	// The controller intentionally exposes depths for its own invariant tests;
	// the facade keeps the controller itself private to product callers.
	const controller = (store as unknown as {
		historyController: { pastDepth: number; futureDepth: number };
	}).historyController;
	return { past: controller.pastDepth, future: controller.futureDepth };
}

function witness(preview: LayoutPreviewState): WeakGenerationWitness {
	const geometry = preview.geometry as object;
	const meshMap = preview.wallMeshesByWall as object;
	const mesh = preview.wallMeshesByWall.values().next().value as object | undefined;
	if (!mesh) throw new Error('fixture generation has no standalone Wall mesh');
	return {
		geometry: new WeakRef(geometry),
		meshMap: new WeakRef(meshMap),
		mesh: new WeakRef(mesh)
	};
}

function generationAlive(entry: WeakGenerationWitness): boolean {
	return entry.geometry.deref() !== undefined;
}

function liveGenerations(entries: readonly WeakGenerationWitness[]): number {
	return entries.filter(generationAlive).length;
}

async function forceCollection(): Promise<void> {
	const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
	if (!gc) return;
	// Do not dereference a WeakRef between collections: a dereference keeps its
	// target alive until the current JS job ends, which would make the next GC
	// in that same job a false negative. Cross a task boundary before the first
	// collection too, so WeakRef constructor keep-alive from the last witness
	// has expired.
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	for (let pass = 0; pass < 24; pass += 1) {
		gc();
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	}
}

function median(values: readonly number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function measureFullStackIncrementalBytes(id: (typeof PIN_FIXTURES)[number]): Promise<{
	heapBytes: number;
	externalBytes: number;
}> {
	const history = await makeHistoryHarness(id);
	await forceCollection();
	const before = process.memoryUsage();
	for (let index = 0; index < 100; index += 1) commitWallMove(history, index);
	await forceCollection();
	const after = process.memoryUsage();
	expect(historyDepths(history.store)).toEqual({ past: 100, future: 0 });
	return {
		heapBytes: (after.heapUsed - before.heapUsed) / 100,
		externalBytes: (after.external - before.external) / 100
	};
}

function deepMeshSet(state: LayoutPreviewState): Map<string, unknown> {
	return new Map([...state.wallMeshesByWall.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function scratchMeshSet(state: LayoutPreviewState): Map<string, unknown> {
	const elevations = new Map(state.geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const));
	const endsByWall = legJoinsByWall(state.geometry.junctions);
	const result = new Map<string, unknown>();
	for (const wall of state.geometry.walls) {
		const mesh = buildStandaloneWallMesh(
			wall,
			elevations.get(wall.floorId) ?? 0,
			endsByWall.get(wall.wallId) ?? null
		).mesh;
		if (mesh) result.set(wall.wallId, mesh);
	}
	return result;
}

function digest(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Minimal node implementation for mounting Svelte components whose output is all component slots. */
class SceneTestNode {
	parentNode: SceneTestNode | null = null;
	childNodes: SceneTestNode[] = [];
	nodeValue: string | null = null;

	constructor(readonly nodeType: number) {}

	get data(): string {
		return this.nodeValue ?? '';
	}

	set data(value: string) {
		this.nodeValue = value;
	}

	get firstChild(): SceneTestNode | null {
		return this.childNodes[0] ?? null;
	}

	get lastChild(): SceneTestNode | null {
		return this.childNodes.at(-1) ?? null;
	}

	get nextSibling(): SceneTestNode | null {
		if (!this.parentNode) return null;
		const index = this.parentNode.childNodes.indexOf(this);
		return this.parentNode.childNodes[index + 1] ?? null;
	}

	appendChild<T extends SceneTestNode>(node: T): T {
		if (node.nodeType === 11) {
			for (const child of [...node.childNodes]) this.appendChild(child);
			return node;
		}
		node.remove();
		node.parentNode = this;
		this.childNodes.push(node);
		return node;
	}

	append(...nodes: SceneTestNode[]): void {
		for (const node of nodes) this.appendChild(node);
	}

	insertBefore<T extends SceneTestNode>(node: T, reference: SceneTestNode | null): T {
		if (node.nodeType === 11) {
			for (const child of [...node.childNodes]) this.insertBefore(child, reference);
			return node;
		}
		if (reference === null) return this.appendChild(node);
		const index = this.childNodes.indexOf(reference);
		if (index < 0) throw new Error('Scene test DOM insertion reference is not a child');
		node.remove();
		node.parentNode = this;
		this.childNodes.splice(index, 0, node);
		return node;
	}

	removeChild<T extends SceneTestNode>(node: T): T {
		const index = this.childNodes.indexOf(node);
		if (index >= 0) this.childNodes.splice(index, 1);
		node.parentNode = null;
		return node;
	}

	before(...nodes: SceneTestNode[]): void {
		if (!this.parentNode) return;
		for (const node of nodes) this.parentNode.insertBefore(node, this);
	}

	after(...nodes: SceneTestNode[]): void {
		if (!this.parentNode) return;
		const parent = this.parentNode;
		const reference = this.nextSibling;
		for (const node of nodes) parent.insertBefore(node, reference);
	}

	remove(): void {
		this.parentNode?.removeChild(this);
	}

	cloneNode(deep = false): SceneTestNode {
		const clone = new SceneTestNode(this.nodeType);
		clone.nodeValue = this.nodeValue;
		if (deep) for (const child of this.childNodes) clone.appendChild(child.cloneNode(true));
		return clone;
	}

	addEventListener(): void {}
	removeEventListener(): void {}
}

class SceneTestElement extends SceneTestNode {
	constructor(readonly tagName: string) {
		super(1);
	}
	setAttribute(): void {}
	removeAttribute(): void {}
}

class SceneTestText extends SceneTestNode {
	constructor(value: string) {
		super(3);
		this.nodeValue = value;
	}
}

class SceneTestComment extends SceneTestNode {
	constructor(value: string) {
		super(8);
		this.nodeValue = value;
	}
}

class SceneTestDocumentFragment extends SceneTestNode {
	constructor() {
		super(11);
	}
	cloneNode(deep = false): SceneTestDocumentFragment {
		const clone = new SceneTestDocumentFragment();
		if (deep) for (const child of this.childNodes) clone.appendChild(child.cloneNode(true));
		return clone;
	}
}

class SceneTestTemplate extends SceneTestElement {
	content = new SceneTestDocumentFragment();

	constructor() {
		super('TEMPLATE');
	}

	set innerHTML(value: string) {
		this.content = new SceneTestDocumentFragment();
		for (const part of value.split(/(<!--[\s\S]*?-->)/g)) {
			if (part.startsWith('<!--')) this.content.appendChild(new SceneTestComment(part.slice(4, -3)));
			else if (part.length > 0) this.content.appendChild(new SceneTestText(part));
		}
	}

	cloneNode(deep = false): SceneTestTemplate {
		const clone = new SceneTestTemplate();
		clone.content = this.content.cloneNode(deep);
		return clone;
	}
}

class SceneTestDocument {
	createTextNode(value: string): SceneTestText {
		return new SceneTestText(value);
	}
	createComment(value: string): SceneTestComment {
		return new SceneTestComment(value);
	}
	createDocumentFragment(): SceneTestDocumentFragment {
		return new SceneTestDocumentFragment();
	}
	createElement(tagName: string): SceneTestElement {
		return tagName.toLowerCase() === 'template' ? new SceneTestTemplate() : new SceneTestElement(tagName);
	}
	addEventListener(): void {}
	removeEventListener(): void {}
}

function installSceneTestDom(): SceneTestElement {
	const host = globalThis as typeof globalThis & Record<string, unknown>;
	if (typeof host.document === 'undefined') {
		Object.assign(host, {
			document: new SceneTestDocument(),
			window: host,
			Node: SceneTestNode,
			Element: SceneTestElement,
			HTMLElement: SceneTestElement,
			Text: SceneTestText,
			Comment: SceneTestComment,
			Document: SceneTestDocument,
			DocumentFragment: SceneTestDocumentFragment
		});
	}
	return new SceneTestElement('DIV');
}

function sceneInput(preview: LayoutPreviewState): LayoutPreviewSceneInputs {
	return {
		model: preview.model,
		geometry: preview.geometry,
		wallMeshesByRoom: preview.wallMeshesByRoom,
		wallMeshesByWall: preview.wallMeshesByWall
	};
}

function expectedSceneAdapterCount(preview: LayoutPreviewState): number {
	let count = 0;
	for (const room of preview.geometry.rooms) if (preview.wallMeshesByRoom.has(room.roomId)) count += 1;
	for (const wall of preview.geometry.walls ?? []) if (preview.wallMeshesByWall.has(wall.wallId)) count += 1;
	return count;
}

function assertSceneAdapterLedger(expectedLive: number, label: string): void {
	const disposals = sceneAdapterLedger.entries.filter((entry) => entry.disposeCalls === 1).length;
	for (const entry of sceneAdapterLedger.entries) {
		expect(entry.disposeCalls, `${label}: one cleanup per disposed production adapter`).toBeLessThanOrEqual(1);
	}
	expect(sceneAdapterLedger.entries.length, `${label}: allocations = disposals + live`).toBe(
		disposals + expectedLive
	);
}

beforeAll(() => {
	if (GC_REQUIRED) {
		expect(typeof (globalThis as typeof globalThis & { gc?: () => void }).gc).toBe('function');
	}
});

describe('P23B.6 S2 — mesh and raw Plan output pins', () => {
	for (const id of PIN_FIXTURES) {
		it(`${id}: cached mesh set deep-equals independent from-scratch Wall builds`, () => {
			const cached = makePreview(id);
			const snapshot = captureLayoutPreviewSnapshot(cached);
			restoreLayoutPreviewSnapshot(cached, snapshot);
			const actual = deepMeshSet(cached);
			const expected = scratchMeshSet(cached);
			expect(actual.size, `${id} built mesh count`).toBe(cached.geometry.walls.length);
			expect([...actual]).toEqual([...expected]);
		});

		it(`${id}: the raw Plan render model stays pinned`, () => {
			const state = makePreview(id);
			const model = buildPlanRenderModel(state.geometry);
			const perLayer = model.layers.map((layer) => [layer.order, layer.primitives.length]);
			expect(perLayer, `${id} layer/primitives`).toEqual(EXPECTED_PLAN_LAYER_COUNTS);
			expect(digest(model), `${id} raw Plan SHA-256`).toBe(PLAN_GOLDENS[id]);
		});
	}
});

describe('P23B.6 S2 — history roots and bounded retention (H-1…H-4)', () => {
	it('H-1: the 101st commit evicts the oldest compile and mesh entry', async () => {
		const history = await makeHistoryHarness();
		const { store, preview, runtime } = history;
		const evicted = witness(preview);
		let firstCommittedLayout = '';
		let retained = witness(preview);
		for (let index = 0; index < 101; index += 1) {
			const committed = commitWallMove(history, index);
			if (index === 0) {
				firstCommittedLayout = committed;
				retained = witness(preview);
			}
		}
		expect(historyDepths(store)).toEqual({ past: 100, future: 0 });
		if (typeof (globalThis as typeof globalThis & { gc?: () => void }).gc === 'function') {
			await forceCollection();
			expect(generationAlive(evicted), 'the evicted generation is collectible').toBe(false);
			expect(generationAlive(retained), 'the oldest surviving history generation remains live').toBe(true);
			expect(evicted.mesh.deref(), 'the evicted WeakMap mesh entry is collectible').toBeUndefined();
		} else {
			// Counted-reference fallback: after the cap, only the 100 surviving
			// snapshots and the live generation can be traversed by Undo.
			for (let index = 0; index < 100; index += 1) expect(store.undo()).toBe(true);
			expect(runtime.layoutPreviewAuthoredJson(preview)).toBe(firstCommittedLayout);
			expect(store.undo(), 'the evicted generation is no longer on the stack').toBe(false);
		}
	}, 30_000);

	it('H-2: branching after Undo clears every discarded redo generation', async () => {
		const history = await makeHistoryHarness();
		const { store, preview } = history;
		const generations = [witness(preview)];
		for (let index = 0; index < 3; index += 1) {
			commitWallMove(history, index);
			generations.push(witness(preview));
		}
		expect(store.undo()).toBe(true);
		expect(store.undo()).toBe(true);
		const discardedRedo = [generations[2]!, generations[3]!];
		commitWallMove(history, 7);
		expect(historyDepths(store).future).toBe(0);
		expect(store.redo(), 'the branch removed the redo entries').toBe(false);
		if (typeof (globalThis as typeof globalThis & { gc?: () => void }).gc === 'function') {
			await forceCollection();
			for (const entry of discardedRedo) {
				expect(generationAlive(entry), 'discarded redo generation is collectible').toBe(false);
				expect(entry.mesh.deref(), 'discarded mesh entry is collectible').toBeUndefined();
			}
		}
	});

	it('H-3: import clears history and releases history-only generations', async () => {
		const history = await makeHistoryHarness();
		const { store, preview } = history;
		const historical = witness(preview);
		commitWallMove(history, 0);
		expect(store.importDocument(createEmptySceneDocument()), 'document import succeeds').toBe(true);
		expect(historyDepths(store)).toEqual({ past: 0, future: 0 });
		if (typeof (globalThis as typeof globalThis & { gc?: () => void }).gc === 'function') {
			await forceCollection();
			expect(generationAlive(historical), 'import released history-only generation').toBe(false);
		}
	});

	it('H-3: an unmounted editor releases live and historical generations', async () => {
		unmountEvidence = await makeUnmountWitness();
		expect(unmountEvidence.generations).toHaveLength(3);
	});

	it('H-4: repeated edit/Undo/Redo/branch cycles stay within past + future + live (+ gesture)', async () => {
		const history = await makeHistoryHarness();
		const { store, preview } = history;
		const generations: WeakGenerationWitness[] = [witness(preview)];
		let moveIndex = 0;
		for (let cycle = 0; cycle < 4; cycle += 1) {
			for (let step = 0; step < 8; step += 1) {
				commitWallMove(history, moveIndex++);
				generations.push(witness(preview));
			}
			for (let step = 0; step < 4; step += 1) expect(store.undo()).toBe(true);
			for (let step = 0; step < 2; step += 1) expect(store.redo()).toBe(true);
			commitWallMove(history, moveIndex++);
			generations.push(witness(preview));
			const depths = historyDepths(store);
			expect(depths.past).toBeLessThanOrEqual(100);
			expect(depths.future).toBeLessThanOrEqual(100);
			const maximumRoots = depths.past + depths.future + 1;
			if (typeof (globalThis as typeof globalThis & { gc?: () => void }).gc === 'function') {
				await forceCollection();
				expect(liveGenerations(generations), 'live generations stay within stack ownership').toBeLessThanOrEqual(maximumRoots);
			} else {
				// Every known root is one unique snapshot or the current live state;
				// no extra cache/map/adapter owner is permitted by the ledger.
				expect(maximumRoots).toBeLessThanOrEqual(depths.past + depths.future + 1);
			}
		}
		store.beginLayoutTransaction();
		const openGestureGeneration = witness(preview);
		const depths = historyDepths(store);
		await forceCollection();
		if (typeof (globalThis as typeof globalThis & { gc?: () => void }).gc === 'function') {
			expect(liveGenerations([...generations, openGestureGeneration])).toBeLessThanOrEqual(
				depths.past + depths.future + 2
			);
		}
		store.cancelLayoutTransaction();
	}, 30_000);
});

describe('P23B.6 S2 — GPU adapter ownership (H-5)', () => {
	it('mounts LayoutPreviewScene and balances production adapters across edit, history, view switch and unmount', async () => {
		const history = await makeHistoryHarness();
		const { store, preview, runtime } = history;
		sceneAdapterLedger.entries.length = 0;
		const mounted = mount(LayoutPreviewSceneMountHarness, {
			target: installSceneTestDom() as unknown as Element,
			props: {
				initial: sceneInput(preview),
				interaction: { selection: { kind: 'none' }, objectDrag: null } as never
			}
		});
		const initialLive = expectedSceneAdapterCount(preview);
		flushSync();
		assertSceneAdapterLedger(initialLive, 'initial 3D mount');

		const replaceGeneration = (label: string) => {
			const previousAllocations = sceneAdapterLedger.entries.length;
			const nextLive = expectedSceneAdapterCount(preview);
			mounted.replace(sceneInput(preview));
			flushSync();
			expect(sceneAdapterLedger.entries.length, `${label}: each active adapter is rebuilt`).toBe(
				previousAllocations + nextLive
			);
			assertSceneAdapterLedger(nextLive, label);
		};

		try {
			commitWallMove(history, 0);
			replaceGeneration('edit');
			expect(store.undo()).toBe(true);
			replaceGeneration('Undo');
			expect(store.redo()).toBe(true);
			replaceGeneration('Redo');
			expect(store.undo()).toBe(true);
			commitWallMove(history, 1);
			replaceGeneration('history branch');

			const beforePlan = sceneAdapterLedger.entries.length;
			mounted.show3d(false);
			flushSync();
			expect(sceneAdapterLedger.entries.length).toBe(beforePlan);
			assertSceneAdapterLedger(0, 'switch to Plan / scene unmount');

			mounted.show3d(true);
			flushSync();
			const remountLive = expectedSceneAdapterCount(preview);
			expect(sceneAdapterLedger.entries.length).toBe(beforePlan + remountLive);
			assertSceneAdapterLedger(remountLive, 'switch back to 3D / fresh scene mount');
		} finally {
			await unmount(mounted, { outro: false });
		}

		assertSceneAdapterLedger(0, 'editor component unmount');
		const snapshot = runtime.captureLayoutPreviewSnapshot(preview);
		expect(Object.values(snapshot).some((value) => value instanceof BufferGeometry)).toBe(false);
		expect(Object.keys(snapshot).some((key) => /mesh|buffergeometry|adapter/i.test(key))).toBe(false);
	});
});

it.skipIf(!GC_REQUIRED)(
	'H-7 advisory: reports the incremental retained bytes per generation at a full 100-entry stack',
		{ timeout: 300_000 },
	async () => {
		const straight = [];
		const curved = [];
		for (let sample = 0; sample < 3; sample += 1) {
			straight.push(await measureFullStackIncrementalBytes('p23b-40-wall-straight-v1'));
			curved.push(await measureFullStackIncrementalBytes('p23b-40-wall-all-curved-v1'));
		}
		const format = (samples: readonly { heapBytes: number; externalBytes: number }[]) => ({
			heap: Math.round(median(samples.map((sample) => sample.heapBytes))),
			external: Math.round(median(samples.map((sample) => sample.externalBytes))),
			total: Math.round(median(samples.map((sample) => sample.heapBytes + sample.externalBytes)))
		});
		console.info(
			`P23B.6 S6 H-7 advisory — retained incremental bytes per generation at 100-entry history (3 runs, median, Node ${process.version}, --expose-gc): straight-40 ${JSON.stringify(format(straight))}; all-curved-40 ${JSON.stringify(format(curved))}`
		);
	}
);

it('H-3: after the editor test frame is released, unmount leaves no generation roots', async () => {
	expect(unmountEvidence, 'the unmount scenario ran').not.toBeNull();
	if (typeof (globalThis as typeof globalThis & { gc?: () => void }).gc === 'function') {
		await forceCollection();
		expect(unmountEvidence!.preview.deref(), 'the editor preview root was collected').toBeUndefined();
		expect(unmountEvidence!.store.deref(), 'the editor store root was collected').toBeUndefined();
		expect(unmountEvidence!.generations.map(generationAlive), 'unmount releases all generations').toEqual([
			false, false, false
		]);
	} else {
		// Counted-reference fallback: the scenario's roots consist only of the
		// editor state, its history host and the two history snapshots.
		expect(unmountEvidence!.generations).toHaveLength(3);
	}
	}, 30_000);

async function makeUnmountWitness(): Promise<UnmountWitness> {
	const history = await makeHistoryHarness();
	const { store, preview } = history;
	const generations = [witness(preview)];
	commitWallMove(history, 0);
	 generations.push(witness(preview));
	commitWallMove(history, 1);
	generations.push(witness(preview));
	return {
		generations,
		preview: new WeakRef(preview as object),
		store: new WeakRef(store as object)
	};
}
