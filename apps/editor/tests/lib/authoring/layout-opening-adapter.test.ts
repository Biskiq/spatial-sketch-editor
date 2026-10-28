/**
 * T1.P02.S03 — the Opening reading through the live F.4 boundary.
 *
 * The suite drives the real acceptance host, coordinator and production Layout
 * adapter; nothing here injects a planner or a test-only install path. What it
 * pins:
 *
 * 1. one deliberate Wall-face press commits one Opening once, selects it and
 *    leaves Ink armed on the Opening reading;
 * 2. an out-of-fit candidate refuses in words with a repair, writes zero source
 *    and remains editable;
 * 3. a selected Wall is the preferred host for typed-offset placement, with the
 *    keyed window metrics carried exactly;
 * 4. the Opening Card action deletes one Opening in one undo step and Undo/Redo
 *    restores/removes the same identity;
 * 5. a reading switch cannot hide a live Wall chain.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
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
import {
	classifyOpeningHost,
	inkSurface,
	type InkController,
	type ProjectedWall
} from '$lib/authoring/adapters/layout/ink';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-s03-opening';
const ELEVATION = 0.5;

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
	readonly document: LayoutDocumentWallFirst;
	/** The enclosure's bottom `(0,0)→(6,0)` Wall. */
	readonly wallId: string;
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

function bottomWallId(document: LayoutDocumentWallFirst): string {
	const pointOf = (junctionId: string) =>
		document.junctions.find((junction) => junction.id === junctionId)!.point;
	const wall = document.walls.find((candidate) => {
		const start = pointOf(candidate.startJunctionId);
		const end = pointOf(candidate.endJunctionId);
		return start[0] === 0 && start[1] === 0 && end[0] === 6 && end[1] === 0;
	});
	if (wall === undefined) throw new Error('the enclosure has no (0,0)→(6,0) Wall');
	return wall.id;
}

async function mount(): Promise<Mounted> {
	const document = fixtureDocument();
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'S03 opening',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-s03-opening',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`S03 fixture not admitted: ${admitted.kind}`);
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
	let services: StageAdapterServices | undefined;
	const registration = mountStageAdapter(facade, host, (port) => {
		services = port;
		return createAdapter(port);
	});
	if (registration.kind !== 'registered' || services === undefined) {
		throw new Error('Layout adapter did not mount');
	}
	return { facade, session, host, services, document, wallId: bottomWallId(document) };
}

/** Arm Ink and return its live controller, exactly as the palette does. */
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

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

function selectSubject(facade: StageFacade, sourceKind: 'wall' | 'opening', sourceId: string): void {
	const snapshot = facade.snapshot();
	facade.select({
		sourceId,
		sourceKind,
		generationId: snapshot.compileGeneration,
		ref: {
			sourceId,
			sourceKind,
			generationId: snapshot.compileGeneration,
			stream: 'projected',
			subRef: null
		}
	});
}

/** The projection of a world point on the level datum, in Stage-local CSS. */
function stageCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the mounted fixture has no evaluation');
	const projected = facade.projectWorld([point[0], ELEVATION, point[1]], evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

describe('T1.P02.S03 — Opening placement', () => {
	it('places one door from one Wall-face press, selects it, and Undo/Redo keeps its id', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		expect(inkSurface()!.snapshot().reading).toBe('wall');
		controller.setReading('opening');
		expect(inkSurface()!.snapshot().reading).toBe('opening');

		const evaluationId = mounted.facade.evaluationId()!;
		const at = stageCss(mounted.facade, [3, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: at, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: at, evaluationId });
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(mounted.facade);
		expect(layout.openings).toHaveLength(1);
		const created = layout.openings[0]!;
		expect(created.wallId).toBe(mounted.wallId);
		expect(created.kind).toBe('door');
		expect(created.offset).toBeCloseTo(3, 2);
		expect(created.width).toBeCloseTo(0.9, 6);
		expect(created.sillHeight).toBe(0);
		// One placement, one history entry, and the created Opening is selected.
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(mounted.facade.selection()).toMatchObject({
			sourceId: created.id,
			sourceKind: 'opening'
		});
		// The install closes the active task; the mounted shell re-arms the tool, and
		// the adapter remembers its reading for that next arming.
		expect(inkSurface()).toBeNull();

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(acceptedLayout(mounted.facade).openings).toHaveLength(0);
		expect((await mounted.host.redo()).kind).toBe('installed');
		const restored = acceptedLayout(mounted.facade).openings;
		expect(restored.map((opening) => opening.id)).toEqual([created.id]);
	});

	it('refuses an out-of-fit candidate in words, writes nothing, and stays editable', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		controller.setReading('opening');

		const evaluationId = mounted.facade.evaluationId()!;
		const pastEnd = stageCss(mounted.facade, [5.8, 0]);
		mounted.facade.pointerIntent({ phase: 'down', css: pastEnd, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: pastEnd, evaluationId });

		const refused = inkSurface()!.snapshot().opening;
		expect(refused?.canPlace).toBe(false);
		expect(refused?.refusal).toContain('past the end of the 6.00 m Wall');
		expect(refused?.refusal).toContain('Move it');
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(acceptedLayout(mounted.facade).openings).toHaveLength(0);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });

		// The same live reading accepts a deliberate fit: refusal wrote no partial source.
		const valid = stageCss(mounted.facade, [2, 0]);
		mounted.facade.pointerIntent({ phase: 'down', css: valid, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: valid, evaluationId });
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		expect(acceptedLayout(mounted.facade).openings).toHaveLength(1);
	});

	it('places by exact offset on the selected host with the keyed window metrics', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		selectSubject(mounted.facade, 'wall', mounted.wallId);
		const controller = armInk(mounted.facade);
		controller.setReading('opening');
		controller.setOpeningOptions({ kind: 'window', width: 1.2, height: 1.2, sillHeight: 1 });
		expect(inkSurface()!.snapshot().opening).toMatchObject({
			hostId: mounted.wallId,
			canPlace: false
		});
		controller.placeOpening('1.5');
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const created = acceptedLayout(mounted.facade).openings[0]!;
		expect(created).toMatchObject({
			wallId: mounted.wallId,
			kind: 'window',
			width: 1.2,
			height: 1.2,
			sillHeight: 1
		});
		expect(created.offset).toBeCloseTo(1.5, 6);
	});

	it('deletes one Opening from its Card action, then Undo/Redo keeps the identity', async () => {
		const mounted = await mount();
		selectSubject(mounted.facade, 'wall', mounted.wallId);
		const controller = armInk(mounted.facade);
		controller.setReading('opening');
		controller.placeOpening('1.5');
		await eventually(() => acceptedLayout(mounted.facade).openings.length === 1);
		const created = acceptedLayout(mounted.facade).openings[0]!;
		const beforeDelete = mounted.facade.snapshot().canonicalJson;

		expect(mounted.facade.selection()).toMatchObject({
			sourceId: created.id,
			sourceKind: 'opening'
		});
		// A content install disposes the binding; the next live evaluation rebuilds it
		// against the installed source before the Card can read contributions.
		mounted.facade.camera.evaluate(RECT, 2);
		const subject = { sourceId: created.id, sourceKind: 'opening' as const, ref: null };
		const actions = stageCardActions(mounted.facade, subject);
		expect(actions).toHaveLength(1);
		const action = actions[0]!;
		expect(action).toMatchObject({
			id: 'layout-opening-delete',
			label: 'Delete Opening',
			destructive: true,
			adapterId: 'layout'
		});
		expect(action.detail).toContain('one undo step');
		expect((await action.run()).kind).toBe('accepted');
		await eventually(() => mounted.facade.snapshot().canonicalJson !== beforeDelete);

		expect(acceptedLayout(mounted.facade).openings).toHaveLength(0);
		expect(mounted.facade.selection()).toMatchObject({
			sourceId: mounted.wallId,
			sourceKind: 'wall'
		});
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(acceptedLayout(mounted.facade).openings.map((opening) => opening.id)).toEqual([created.id]);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(acceptedLayout(mounted.facade).openings).toHaveLength(0);
	});

	it('deleting the host Wall retires the Ink-created Opening in the same undo step', async () => {
		const mounted = await mount();
		selectSubject(mounted.facade, 'wall', mounted.wallId);
		const controller = armInk(mounted.facade);
		controller.setReading('opening');
		controller.placeOpening('1.5');
		await eventually(() => acceptedLayout(mounted.facade).openings.length === 1);
		const created = acceptedLayout(mounted.facade).openings[0]!;
		mounted.facade.camera.evaluate(RECT, 2);

		const actions = stageCardActions(mounted.facade, {
			sourceId: mounted.wallId,
			sourceKind: 'wall',
			ref: null
		});
		expect(actions).toHaveLength(1);
		expect(actions[0]!.detail).toContain('1 hosted Opening in the same undo step');
		expect((await actions[0]!.run()).kind).toBe('accepted');
		let layout = acceptedLayout(mounted.facade);
		expect(layout.walls.some((wall) => wall.id === mounted.wallId)).toBe(false);
		expect(layout.openings.some((opening) => opening.id === created.id)).toBe(false);

		expect((await mounted.host.undo()).kind).toBe('installed');
		layout = acceptedLayout(mounted.facade);
		expect(layout.walls.some((wall) => wall.id === mounted.wallId)).toBe(true);
		expect(layout.openings.map((opening) => opening.id)).toEqual([created.id]);
	});

	it('refuses a reading switch that would hide a live Wall chain', async () => {
		const mounted = await mount();
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		expect(inkSurface()!.snapshot().points).toHaveLength(1);
		controller.setReading('opening');
		const snapshot = inkSurface()!.snapshot();
		expect(snapshot.reading).toBe('wall');
		expect(snapshot.refusal).toContain('Finish or cancel the Wall chain');
		// Cancel clears the proposal; the next switch is deliberate and allowed.
		controller.cancel();
		controller.setReading('opening');
		expect(inkSurface()!.snapshot().reading).toBe('opening');
	});
});

describe('T1.P02.S03 — host preference', () => {
	const walls: readonly ProjectedWall[] = [
		{
			id: 'wall-near',
			startCss: [0, 0],
			endCss: [20, 0],
			start: [0, 0],
			end: [20, 0]
		},
		{
			id: 'wall-far-equally-aimed',
			startCss: [0, 1],
			endCss: [20, 1],
			start: [0, 1],
			end: [20, 1]
		}
	];

	it('prefers the selected host when candidates tie', () => {
		expect(classifyOpeningHost({ css: [10, 0.4], walls, preferredWallId: null })?.wallId).toBe(
			'wall-near'
		);
		expect(
			classifyOpeningHost({ css: [10, 0.4], walls, preferredWallId: 'wall-far-equally-aimed' })
				?.wallId
		).toBe('wall-far-equally-aimed');
	});

	it('returns no host when the pointer is off every Wall face', () => {
		expect(classifyOpeningHost({ css: [10, 40], walls, preferredWallId: 'wall-near' })).toBeNull();
	});
});
