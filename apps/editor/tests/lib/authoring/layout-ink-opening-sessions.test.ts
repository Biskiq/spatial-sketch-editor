/**
 * X5 — Layout drawing (Ink) and Opening placement sessions, through production dispatch.
 *
 * The suite drives the real acceptance host, coordinator and production Layout
 * adapter (`createAdapter` mounted on a real Stage facade); nothing injects a
 * planner, an intent or a source. It owns the lifecycle contract the two
 * extracted controllers (`ink-session`, `opening-placement-session`) must keep,
 * so every case names the defect it catches:
 *
 * - **preview-to-accept parity** — the geometry, snap and words the Stage drew
 *   before acceptance are exactly the geometry the accepted source carries;
 * - **captured nonce** — one operation mints one identity capture, a refused
 *   acceptance keeps it for the retry, and a settled operation never reuses it;
 * - **in-flight guard** — two activations of one finish are one accepted entry;
 * - **typed input and refusal** — typed points/offsets refuse in words and write
 *   nothing;
 * - **cleanup** — Escape, task close, replacement, rebind and unmount leave no
 *   gesture lease, no proposal lease and no live transient;
 * - **defaults vs captured state** — adapter-lifetime Ink/Opening defaults
 *   survive a rebind; the captured chain, press and candidate do not.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { AuthoringIntent } from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageCardActions } from '$lib/authoring/stage/stage-contributions';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { inkSurface, type InkController } from '$lib/authoring/adapters/layout/ink';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 96, top: 48, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-x5-sessions';
const ELEVATION = 0.5;
const INK_OWNER = 'layout-ink';

type Outcome = Awaited<ReturnType<StageAdapterServices['authoring']['accept']>>;

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly document: LayoutDocumentWallFirst;
	/** Every intent the adapter submitted, in order, before the host answered. */
	readonly intents: AuthoringIntent[];
	/** Hold the next acceptances until `release()`. */
	hold(): () => void;
	/** Answer the next acceptance with a synthetic refusal (the host never sees it). */
	refuseNext(message: string): void;
	readonly bottomWallId: string;
	readonly northWallId: string;
};

/** A closed 6 × 4 enclosure: four Walls, one Room, no Opening. */
function fixtureDocument(): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	base.floor.elevation = ELEVATION;
	const chained = planWallChain({
		baseline: base,
		points: [
			[0, 0],
			[6, 0],
			[6, 4],
			[0, 4]
		],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the enclosure fixture was refused');
	return chained.document;
}

function wallBetween(document: LayoutDocumentWallFirst, a: readonly [number, number], b: readonly [number, number]): string {
	const pointOf = (junctionId: string) => document.junctions.find((junction) => junction.id === junctionId)!.point;
	const wall = document.walls.find((candidate) => {
		const start = pointOf(candidate.startJunctionId);
		const end = pointOf(candidate.endJunctionId);
		return start[0] === a[0] && start[1] === a[1] && end[0] === b[0] && end[1] === b[1];
	});
	if (wall === undefined) throw new Error(`no Wall ${a} → ${b}`);
	return wall.id;
}

async function mount(): Promise<Mounted> {
	const document = fixtureDocument();
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'X5 sessions',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-x5-sessions',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`X5 fixture not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	facade.camera.evaluate(RECT, 1);
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: snapshot.sessionEpoch,
		baseline: {
			revision: snapshot.acceptedRevision,
			source: project,
			canonicalJson: snapshot.canonicalJson,
			sourceContentId: snapshot.sourceContentId
		}
	});
	const intents: AuthoringIntent[] = [];
	let gate: Promise<void> | null = null;
	const refusals: string[] = [];
	let registered: StageAdapterServices | undefined;
	const registration = mountStageAdapter(facade, host, (port) => {
		registered = port;
		return createAdapter({
			...port,
			authoring: {
				...port.authoring,
				accept: async (intent): Promise<Outcome> => {
					intents.push(intent);
					if (gate !== null) await gate;
					const refusal = refusals.shift();
					if (refusal !== undefined) return { kind: 'refused', code: 'x5-synthetic', message: refusal } as Outcome;
					return port.authoring.accept(intent);
				}
			}
		});
	});
	if (registration.kind !== 'registered' || registered === undefined) throw new Error('Layout adapter did not mount');
	return {
		facade,
		session,
		host,
		document,
		intents,
		hold() {
			let release!: () => void;
			gate = new Promise<void>((resolve) => { release = () => { gate = null; resolve(); }; });
			return release;
		},
		refuseNext(message) { refusals.push(message); },
		bottomWallId: wallBetween(document, [0, 0], [6, 0]),
		northWallId: wallBetween(document, [6, 4], [0, 4])
	};
}

function armInk(facade: StageFacade): InkController {
	const opened = facade.openContributedTask('layout-ink');
	if (opened.kind !== 'opened') throw new Error(`Ink did not arm: ${opened.message}`);
	const surface = inkSurface();
	if (surface === null) throw new Error('Ink published no surface while its task was open');
	return surface.controller;
}

async function eventually(check: () => boolean, attempts = 200): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('condition never became true');
}

const acceptedLayout = (facade: StageFacade): LayoutDocumentWallFirst => stageEnvelope(facade.snapshot()).units.layout.data;

function stageCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the mounted fixture has no evaluation');
	const projected = facade.projectWorld([point[0], ELEVATION, point[1]], evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

const evaluation = (facade: StageFacade): string => facade.evaluationId()!;

function down(facade: StageFacade, point: readonly [number, number]) {
	return facade.pointerIntent({ phase: 'down', css: stageCss(facade, point), evaluationId: evaluation(facade) });
}
function move(facade: StageFacade, point: readonly [number, number]) {
	return facade.pointerIntent({ phase: 'move', css: stageCss(facade, point), evaluationId: evaluation(facade) });
}
function up(facade: StageFacade, point: readonly [number, number]) {
	return facade.pointerIntent({ phase: 'up', css: stageCss(facade, point), evaluationId: evaluation(facade) });
}
function tap(facade: StageFacade, point: readonly [number, number]): void {
	down(facade, point);
	up(facade, point);
}
function drag(facade: StageFacade, from: readonly [number, number], to: readonly [number, number]): void {
	down(facade, from);
	move(facade, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
	move(facade, to);
	up(facade, to);
}
function hover(facade: StageFacade, point: readonly [number, number]): void {
	facade.hoverIntent({ phase: 'move', css: stageCss(facade, point), evaluationId: evaluation(facade) });
}

function selectSubject(facade: StageFacade, sourceKind: 'wall' | 'opening', sourceId: string): void {
	const snapshot = facade.snapshot();
	facade.select({
		sourceId,
		sourceKind,
		generationId: snapshot.compileGeneration,
		ref: { sourceId, sourceKind, generationId: snapshot.compileGeneration, stream: 'projected', subRef: null }
	});
}

const previews = (facade: StageFacade) => facade.candidatePreviews();
const previewById = (facade: StageFacade, id: string) => previews(facade).find((entry) => entry.id === id);
const near = (actual: readonly [number, number], expected: readonly [number, number], digits = 3) => {
	expect(actual[0]).toBeCloseTo(expected[0], digits);
	expect(actual[1]).toBeCloseTo(expected[1], digits);
};
function createdWalls(mounted: Mounted) {
	const layout = acceptedLayout(mounted.facade);
	return layout.walls.filter((wall) => !mounted.document.walls.some((known) => known.id === wall.id));
}
function endpointsOf(mounted: Mounted, walls: readonly { startJunctionId: string; endJunctionId: string }[]) {
	const layout = acceptedLayout(mounted.facade);
	const ids = new Set(walls.flatMap((wall) => [wall.startJunctionId, wall.endJunctionId]));
	return [...ids]
		.map((id) => layout.junctions.find((junction) => junction.id === id)!.point)
		.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
/** No gesture lease, no proposal lease: nothing a creator could be stranded behind. */
function expectNoLeases(mounted: Mounted): void {
	expect(mounted.session.gesture()).toBeNull();
	expect(mounted.session.liveProposal()).toBeNull();
}
/** The identity capture an accepted Layout intent carried, as one comparable string. */
function captureOf(intent: AuthoringIntent): string {
	return JSON.stringify(intent.capturedInputs);
}

describe('X5 — Ink preview-to-accept parity', () => {
	it('draws the live chain, cursor leg and snap, then accepts exactly those points as one entry', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		armInk(mounted.facade);
		tap(mounted.facade, [1, 1]);
		hover(mounted.facade, [4, 1]);

		const cursor = previewById(mounted.facade, 'layout-candidate-chain');
		expect(cursor).toMatchObject({ role: 'subject', drawing: true });
		expect(cursor!.segments).toHaveLength(1);
		near(cursor!.segments[0]![0], stageCss(mounted.facade, [1, 1]), 2);
		near(cursor!.segments[0]![1], stageCss(mounted.facade, [4, 1]), 2);
		expect(cursor!.labels.map((label) => label.text)).toEqual(['3.00 m']);

		tap(mounted.facade, [4, 1]);
		hover(mounted.facade, [4, 3]);
		const chain = previewById(mounted.facade, 'layout-candidate-chain')!;
		expect(chain).toMatchObject({ role: 'subject', drawing: true });
		expect(chain.segments).toHaveLength(2);
		near(chain.segments[0]![0], stageCss(mounted.facade, [1, 1]), 2);
		near(chain.segments[0]![1], stageCss(mounted.facade, [4, 1]), 2);
		near(chain.segments[1]![1], stageCss(mounted.facade, [4, 3]), 2);
		// Aiming writes nothing: no entry exists before acceptance.
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(mounted.intents).toHaveLength(0);

		tap(mounted.facade, [4, 3]);
		inkSurface()!.controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const walls = createdWalls(mounted);
		expect(walls).toHaveLength(2);
		const ends = endpointsOf(mounted, walls);
		near(ends[0]!, [1, 1]);
		near(ends[1]!, [4, 1]);
		near(ends[2]!, [4, 3]);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(mounted.intents).toHaveLength(1);
		expect(mounted.intents[0]!.payload).toMatchObject({ points: [[1, 1], [4, 1], [4, 3]], close: false });
		expectNoLeases(mounted);
	});

	it('names the Junction, Wall-span and free snap the pointer resolved, at that geometry', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		tap(mounted.facade, [2, 2]);

		hover(mounted.facade, [0, 4]);
		const junction = previewById(mounted.facade, 'layout-candidate-chain')!.snap!;
		expect(junction.name).toBe('Junction');
		near(junction.css, stageCss(mounted.facade, [0, 4]), 1);

		hover(mounted.facade, [3, 0]);
		const wall = previewById(mounted.facade, 'layout-candidate-chain')!.snap!;
		expect(wall.name).toBe('Wall');
		near(wall.css, stageCss(mounted.facade, [3, 0]), 1);
		// Splitting a Wall is shown before it happens, as the affected overlay.
		expect(previewById(mounted.facade, 'layout-candidate-chain-affected')?.role).toBe('affected');
	});

	it('closes a ring on its start point: the preview names Close Room and acceptance builds that Room', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		armInk(mounted.facade);
		tap(mounted.facade, [8, 0]);
		tap(mounted.facade, [10, 0]);
		tap(mounted.facade, [10, 2]);
		hover(mounted.facade, [8, 0]);
		const closing = previewById(mounted.facade, 'layout-candidate-chain')!;
		expect(closing.snap?.name).toBe('Close Room');
		expect(closing.labels.map((label) => label.text)).toEqual(['Creates 1 Room']);

		tap(mounted.facade, [8, 0]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		expect(acceptedLayout(mounted.facade).rooms.length).toBe(mounted.document.rooms.length + 1);
		expect(mounted.intents[0]!.payload).toMatchObject({ close: true });
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('Box: the drag preview is the ring and its size label; the accepted Walls are those corners', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		controller.setWallMode('box');
		down(mounted.facade, [7, 1]);
		move(mounted.facade, [9.5, 3]);
		const chain = previewById(mounted.facade, 'layout-candidate-chain')!;
		expect(chain.segments).toHaveLength(4);
		expect(chain.labels.map((label) => label.text)).toContain('2.50 × 2.00 m');
		up(mounted.facade, [9.5, 3]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const walls = createdWalls(mounted);
		expect(walls).toHaveLength(4);
		const ends = endpointsOf(mounted, walls);
		expect(ends).toHaveLength(4);
		near(ends[0]!, [7, 1]);
		near(ends[3]!, [9.5, 3]);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expectNoLeases(mounted);
	});

	it('Circle: the drag preview carries r/⌀ words and the accepted seam is the released rim', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		armInk(mounted.facade).setWallMode('circle');
		down(mounted.facade, [3, 2]);
		move(mounted.facade, [4, 2]);
		const circle = previewById(mounted.facade, 'layout-candidate-circle')!;
		expect(circle.role).toBe('subject');
		expect(circle.labels[0]!.text).toContain('r 1.00 m · ⌀ 2.00 m');
		expect(circle.segments).toHaveLength(64);
		up(mounted.facade, [4, 2]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		expect(createdWalls(mounted)).toHaveLength(1);
		expect(mounted.intents[0]!.payload).toMatchObject({ center: [3, 2], rim: [4, 2] });
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('Arc: start → end → bulge previews the cubic and commits the same apex once', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		armInk(mounted.facade).setWallMode('arc');
		tap(mounted.facade, [1, 1]);
		tap(mounted.facade, [5, 1]);
		hover(mounted.facade, [3, 2.5]);
		const arc = previewById(mounted.facade, 'layout-candidate-arc')!;
		expect(arc.labels.some((label) => label.text.startsWith('Rise 1.50 m'))).toBe(true);
		tap(mounted.facade, [3, 2.5]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		expect(mounted.intents).toHaveLength(1);
		expect(mounted.intents[0]!.payload).toMatchObject({ arc: { pointIndex: 0 } });
		const apex = (mounted.intents[0]!.payload as { arc: { apex: [number, number] } }).arc.apex;
		near(apex, [3, 2.5], 2);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});
});

describe('X5 — Ink captured nonce, in-flight guard and refusal', () => {
	it('keeps one capture across a refused acceptance and mints a fresh one for the next operation', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		controller.typePoint('3', '1');
		mounted.refuseNext('The host refused this write.');
		controller.finish();
		await eventually(() => inkSurface()!.snapshot().refusal === 'The host refused this write.');
		// The refusal left the chain editable, with its proposal lease and no source.
		expect(inkSurface()!.snapshot().points).toHaveLength(2);
		expect(mounted.session.liveProposal()?.owner).toBe(INK_OWNER);
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);

		controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		expect(mounted.intents).toHaveLength(2);
		// The same operation: same captured identities, a distinct operation id.
		expect(captureOf(mounted.intents[1]!)).toBe(captureOf(mounted.intents[0]!));
		expect(mounted.intents[1]!.operationId).not.toBe(mounted.intents[0]!.operationId);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });

		// A settled operation never donates its capture to the next one. The install
		// retired the binding; a fresh evaluation lets the new one contribute again.
		mounted.facade.camera.evaluate(RECT, 2);
		const next = armInk(mounted.facade);
		next.typePoint('1', '3');
		next.typePoint('2', '3');
		next.finish();
		await eventually(() => mounted.intents.length === 3);
		expect(captureOf(mounted.intents[2]!)).not.toBe(captureOf(mounted.intents[0]!));
	});

	it('mints a fresh capture when backtracking empties the chain, and keeps it while one point remains', async () => {
		const mounted = await mount();
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		controller.typePoint('3', '1');
		controller.backtrack();
		expect(inkSurface()!.snapshot().points).toHaveLength(1);
		expect(mounted.session.liveProposal()?.owner).toBe(INK_OWNER);
		controller.backtrack();
		expect(inkSurface()!.snapshot().points).toHaveLength(0);
		expect(mounted.session.liveProposal()).toBeNull();
		expect(mounted.host.history().undoUnavailableReason ?? '').not.toContain('chain is live');
	});

	it('accepts two activations of one Finish once (in-flight guard)', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const release = mounted.hold();
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		controller.typePoint('3', '1');
		controller.finish();
		controller.finish();
		expect(mounted.facade.keyboardIntent({ kind: 'finish' }).claimed).toBe(true);
		release();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.intents).toHaveLength(1);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(createdWalls(mounted)).toHaveLength(1);
	});

	it('guards Circle and Box the same way: one gesture, one operation, even while acceptance is pending', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const release = mounted.hold();
		armInk(mounted.facade).setWallMode('circle');
		tap(mounted.facade, [3, 2]);
		tap(mounted.facade, [4, 2]);
		tap(mounted.facade, [3, 2]);
		tap(mounted.facade, [4.5, 2]);
		release();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.intents).toHaveLength(1);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('refuses typed input in words and writes nothing', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		controller.typePoint('abc', '1');
		expect(inkSurface()!.snapshot().refusal).toBeTruthy();
		expect(inkSurface()!.snapshot().points).toHaveLength(0);
		controller.typePoint('1', '1');
		controller.finish();
		expect(inkSurface()!.snapshot().refusal).toBe('A chain needs at least two points.');
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(mounted.intents).toHaveLength(0);

		// An Arc takes its bulge from the Stage, never from a typed third point.
		controller.cancel();
		controller.setWallMode('arc');
		controller.typePoint('1', '1');
		controller.typePoint('5', '1');
		controller.typePoint('3', '2');
		expect(inkSurface()!.snapshot().refusal).toBe('An Arc takes its bulge from the Stage: move the pointer and click to finish.');
		expect(inkSurface()!.snapshot().points).toHaveLength(2);
	});

	it('keeps the chain editable and holds Undo when the planner refuses, then repairs by backtrack', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		controller.typePoint('3', '-2');
		controller.typePoint('3', '2');
		controller.finish();
		await eventually(() => inkSurface()!.snapshot().refusal !== null);
		expect(mounted.intents).toHaveLength(0);
		expect(mounted.session.liveProposal()?.owner).toBe(INK_OWNER);
		controller.backtrack();
		controller.typePoint('3', '-1');
		controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('refuses a mode or reading switch while a chain or a press is live', async () => {
		const mounted = await mount();
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		controller.setWallMode('box');
		expect(inkSurface()!.snapshot().wallMode).toBe('line');
		controller.setReading('opening');
		expect(inkSurface()!.snapshot().reading).toBe('wall');
		expect(inkSurface()!.snapshot().refusal).toContain('Finish or cancel the Wall chain');
	});
});

describe('X5 — Opening placement', () => {
	it('previews, then accepts, the same edge-positioned span; one entry, selected, Ink re-armed on Opening', async () => {
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal('window', { requestAnimationFrame: (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; } });
		try {
			const mounted = await mount();
			const baseline = mounted.facade.snapshot().canonicalJson;
			armInk(mounted.facade).setReading('opening');
			hover(mounted.facade, [2, 0]);
			const ghost = previewById(mounted.facade, 'layout-candidate-opening')!;
			expect(ghost.role).toBe('subject');
			expect(ghost.labels.map((label) => label.text)).toEqual(['Width 0.900 m']);
			expect(inkSurface()!.snapshot().opening).toMatchObject({ hostId: mounted.bottomWallId, canPlace: true });
			const offset = inkSurface()!.snapshot().opening!.offset!;
			expect(offset).toBeCloseTo(2, 2);

			tap(mounted.facade, [2, 0]);
			await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
			const [created] = acceptedLayout(mounted.facade).openings;
			expect(created!.offset).toBeCloseTo(offset, 6);
			expect(created!.wallId).toBe(mounted.bottomWallId);
			expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
			expect(mounted.facade.selection()).toMatchObject({ sourceId: created!.id, sourceKind: 'opening' });
			expect(mounted.intents).toHaveLength(1);
			expectNoLeases(mounted);

			await eventually(() => frames.length > 0);
			mounted.facade.camera.evaluate(RECT, 2);
			for (const frame of frames.splice(0)) frame(0);
			expect(inkSurface()?.snapshot().reading).toBe('opening');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('draws the refused attempt in red at the raw offset with the planner words, and places nothing', async () => {
		const mounted = await mount();
		armInk(mounted.facade).setReading('opening');
		down(mounted.facade, [5.8, 0]);
		const refused = previewById(mounted.facade, 'layout-candidate-opening-refused')!;
		expect(refused.role).toBe('refused');
		expect(refused.labels[0]!.text).toContain('past the end of the 6.00 m Wall');
		// The press holds the pointer lease until it is released or cancelled.
		expect(mounted.session.gesture()?.owner).toBe(INK_OWNER);
		up(mounted.facade, [5.8, 0]);
		expect(mounted.session.gesture()).toBeNull();
		expect(mounted.intents).toHaveLength(0);
		expect(inkSurface()!.snapshot().opening).toMatchObject({ canPlace: false });
	});

	it('keeps one capture across a refused acceptance, and mints a fresh one after a placement settles', async () => {
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal('window', { requestAnimationFrame: (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; } });
		try {
			const mounted = await mount();
			selectSubject(mounted.facade, 'wall', mounted.bottomWallId);
			const controller = armInk(mounted.facade);
			controller.setReading('opening');
			mounted.refuseNext('The host refused this Opening.');
			controller.placeOpening('1.5');
			await eventually(() => inkSurface()!.snapshot().opening?.refusal === 'The host refused this Opening.');
			expect(mounted.session.liveProposal()).toBeNull();
			controller.placeOpening('1.5');
			await eventually(() => acceptedLayout(mounted.facade).openings.length === 1);
			expect(mounted.intents).toHaveLength(2);
			expect(captureOf(mounted.intents[1]!)).toBe(captureOf(mounted.intents[0]!));
			expect(mounted.intents[1]!.operationId).not.toBe(mounted.intents[0]!.operationId);

			// Settled: the next placement is a new operation.
			mounted.facade.camera.evaluate(RECT, 2);
			for (const frame of frames.splice(0)) frame(0);
			selectSubject(mounted.facade, 'wall', mounted.bottomWallId);
			const rearmed = inkSurface()?.controller ?? armInk(mounted.facade);
			rearmed.placeOpening('4');
			await eventually(() => acceptedLayout(mounted.facade).openings.length === 2);
			expect(captureOf(mounted.intents[2]!)).not.toBe(captureOf(mounted.intents[0]!));
			expect(mounted.host.history()).toMatchObject({ depth: 3, position: 2 });
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('accepts two activations of one placement once while acceptance is pending', async () => {
		const mounted = await mount();
		selectSubject(mounted.facade, 'wall', mounted.bottomWallId);
		const controller = armInk(mounted.facade);
		controller.setReading('opening');
		const release = mounted.hold();
		controller.placeOpening('1.5');
		controller.placeOpening('1.5');
		release();
		await eventually(() => acceptedLayout(mounted.facade).openings.length === 1);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.intents).toHaveLength(1);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('typed placement: empty offset centres exactly; every refusal speaks and writes nothing', async () => {
		const mounted = await mount();
		selectSubject(mounted.facade, 'wall', mounted.bottomWallId);
		const controller = armInk(mounted.facade);
		controller.setReading('opening');
		const refusal = () => inkSurface()!.snapshot().opening?.refusal ?? null;

		controller.placeOpening('abc');
		expect(refusal()).toMatch(/^Offset: /);
		controller.placeOpening('-1');
		expect(refusal()).toBe('Offset must be zero or greater.');
		controller.placeOpening('5.8');
		await eventually(() => (refusal() ?? '').includes('past the end of the 6.00 m Wall'));
		expect(mounted.intents).toHaveLength(0);
		expect(acceptedLayout(mounted.facade).openings).toHaveLength(0);

		controller.placeOpening('');
		await eventually(() => acceptedLayout(mounted.facade).openings.length === 1);
		// Centred: (6 − 0.9) / 2 on the 6 m Wall, used verbatim.
		expect(acceptedLayout(mounted.facade).openings[0]!.offset).toBeCloseTo(2.55, 6);
	});

	it('refuses typed placement with no host, and invalid fields refuse pointer and typed placement alike', async () => {
		const mounted = await mount();
		const controller = armInk(mounted.facade);
		controller.setReading('opening');
		controller.placeOpening('1');
		expect(inkSurface()!.snapshot().opening?.refusal).toBe('Select a Wall — or one of its Openings — before placing by offset.');

		selectSubject(mounted.facade, 'wall', mounted.bottomWallId);
		controller.setOpeningOptions(null);
		down(mounted.facade, [2, 0]);
		expect(inkSurface()!.snapshot().opening?.refusal).toBe('Check the Opening Width, Height and Sill before placing.');
		expect(mounted.session.gesture()).toBeNull();
		expect(mounted.intents).toHaveLength(0);
	});

	it('a press off every Wall face is refused with no lease; Escape on a held press releases it', async () => {
		const mounted = await mount();
		armInk(mounted.facade).setReading('opening');
		// A pixel in the sky corner of the viewport resolves no Wall face.
		mounted.facade.pointerIntent({ phase: 'down', css: [2, 2], evaluationId: evaluation(mounted.facade) });
		expect(inkSurface()!.snapshot().opening?.refusal).toBe('Aim at a Wall face to place an Opening; the Stage is not a free host.');
		expect(mounted.session.gesture()).toBeNull();

		down(mounted.facade, [3, 0]);
		expect(mounted.session.gesture()?.owner).toBe(INK_OWNER);
		// With no chain the command is not Ink's: the host unwinds and closes the task.
		expect(mounted.facade.keyboardIntent({ kind: 'cancel' }).claimed).toBe(false);
		mounted.facade.closeTask();
		expect(mounted.session.gesture()).toBeNull();
		expect(inkSurface()).toBeNull();
		expect(previews(mounted.facade)).toEqual([]);
	});

	it('a reading flip ends the press with no placement', async () => {
		const mounted = await mount();
		armInk(mounted.facade).setReading('opening');
		down(mounted.facade, [3, 0]);
		expect(mounted.session.gesture()?.owner).toBe(INK_OWNER);
		mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted.facade, [3, 0]), evaluationId: 'a-different-evaluation' });
		expect(inkSurface()!.snapshot().opening?.refusal).toBe('The reading changed; aim again on the Wall.');
		expect(mounted.session.gesture()).toBeNull();
		expect(mounted.intents).toHaveLength(0);
	});
});

describe('X5 — cleanup, defaults and captured state', () => {
	it('Escape cancels a live chain first (claimed), then the host unwinds the task: no lease remains', async () => {
		const mounted = await mount();
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		controller.typePoint('3', '1');
		expect(mounted.session.liveProposal()?.owner).toBe(INK_OWNER);
		expect(mounted.facade.keyboardIntent({ kind: 'cancel' }).claimed).toBe(true);
		expectNoLeases(mounted);
		expect(inkSurface()!.snapshot().points).toHaveLength(0);
		expect(previews(mounted.facade)).toEqual([]);
		expect(mounted.facade.keyboardIntent({ kind: 'cancel' }).claimed).toBe(false);
	});

	it('closing the task releases the press, the chain, the proposal and the palette surface', async () => {
		const mounted = await mount();
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		down(mounted.facade, [3, 1]);
		expect(mounted.session.gesture()?.owner).toBe(INK_OWNER);
		expect(mounted.session.liveProposal()).not.toBeNull();
		mounted.facade.closeTask();
		expectNoLeases(mounted);
		expect(inkSurface()).toBeNull();
		expect(previews(mounted.facade)).toEqual([]);
		expect(mounted.host.history().undoUnavailableReason ?? '').not.toContain('chain is live');
	});

	it('replacing the task (a different contributed tool) ends Ink exactly like close', async () => {
		const mounted = await mount();
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		controller.typePoint('3', '1');
		expect(mounted.facade.openContributedTask('layout-place-plinth').kind).toBe('opened');
		expectNoLeases(mounted);
		expect(inkSurface()).toBeNull();
		expect(previews(mounted.facade)).toEqual([]);
	});

	it('a rebind keeps adapter-lifetime defaults and drops the captured chain, press and candidate', async () => {
		const mounted = await mount();
		const controller = armInk(mounted.facade);
		controller.setOptions({ thickness: 0.3, height: 2.7 });
		controller.setWallMode('box');
		controller.setReading('opening');
		controller.setOpeningOptions({ kind: 'window', profile: 'rounded', width: 1.2, height: 1.1, sillHeight: 0.9 });
		controller.setReading('wall');
		controller.typePoint('1', '1');
		controller.typePoint('2', '1');
		expect(mounted.session.liveProposal()?.owner).toBe(INK_OWNER);

		// An unrelated accepted write installs a new source: every binding is rebuilt.
		const subject = { sourceId: mounted.northWallId, sourceKind: 'wall' as const, ref: null };
		const remove = stageCardActions(mounted.facade, subject).find((action) => action.id === 'layout-wall-delete')!;
		expect((await remove.run()).kind).toBe('accepted');
		expectNoLeases(mounted);
		mounted.facade.camera.evaluate(RECT, 2);

		const rearmed = armInk(mounted.facade);
		const snapshot = inkSurface()!.snapshot();
		// Defaults are the adapter's memory…
		expect(snapshot.options).toEqual({ thickness: 0.3, height: 2.7 });
		expect(snapshot.wallMode).toBe('box');
		// …the captured chain is not.
		expect(snapshot.points).toHaveLength(0);
		expect(previews(mounted.facade)).toEqual([]);
		rearmed.setReading('opening');
		expect(inkSurface()!.snapshot().opening).toMatchObject({
			kind: 'window', profile: 'rounded', width: 1.2, height: 1.1, sillHeight: 0.9, offset: null
		});
	});

	it('a retained default thickness and height reach the accepted Wall and its intent', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		controller.setOptions({ thickness: 0.3, height: 2.7 });
		controller.typePoint('1', '1');
		controller.typePoint('3', '1');
		controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		expect(mounted.intents[0]!.payload).toMatchObject({ thickness: 0.3, height: 2.7 });
		const [wall] = createdWalls(mounted);
		expect(wall!.thickness).toBeCloseTo(0.3, 6);
		expect(wall!.height).toBeCloseTo(2.7, 6);
	});

	it('a rebind during a pending acceptance ends the old binding cleanly and does not re-arm over a newer task', async () => {
		const mounted = await mount();
		selectSubject(mounted.facade, 'wall', mounted.bottomWallId);
		const controller = armInk(mounted.facade);
		controller.setReading('opening');
		const release = mounted.hold();
		controller.placeOpening('1.5');
		release();
		await eventually(() => acceptedLayout(mounted.facade).openings.length === 1);
		expectNoLeases(mounted);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('unmounting the facade releases every lease the live Ink task held', async () => {
		const mounted = await mount();
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		down(mounted.facade, [3, 1]);
		expect(mounted.session.gesture()?.owner).toBe(INK_OWNER);
		mounted.facade.dispose();
		expectNoLeases(mounted);
		expect(inkSurface()).toBeNull();
	});
});
