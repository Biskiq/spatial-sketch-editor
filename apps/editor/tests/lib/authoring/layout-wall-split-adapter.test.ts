/**
 * T1 A1 — Split Wall, through the production Layout adapter and the real F4 host.
 *
 * The journey pinned here is the slice's acceptance:
 *
 * 1. **Split wall here** is one scoped action over `planWallSplitAtPoint`;
 * 2. the start-side Wall keeps its id, the new fragment is created, every
 *    Opening keeps its id and world position, and the Room keeps its id;
 * 3. the station is the pointer's when the creator pressed the Wall, and the
 *    midpoint when the Card is reached without a pointer station;
 * 4. straight and curved open Walls both split exactly;
 * 5. a split through an Opening and a split of a closed circular Wall refuse in
 *    words, write nothing and add no history;
 * 6. one split is one history entry; Undo/Redo replay the captured ids; the
 *    accepted split round-trips through Save/Load unchanged.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planCreateCircularRoom,
	planCreateWallFirstOpening,
	planWallChain,
	wallFirstWallLength,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type PlanSourceRef
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { captureUnitSave, readUnitEnvelopeForSave } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { stageCardActions } from '$lib/authoring/stage/stage-contributions';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { curvedWallFrame, wallStationFrame } from '$lib/authoring/adapters/layout/precision';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-a1-split';
const ELEVATION = 0.5;

type Fixture = {
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly openingId: string;
	readonly roomId: string;
};

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
	readonly fixture: Fixture;
};

/** The S04/S05 enclosure with one Opening at an explicit station. */
function enclosureFixture(openingOffset: number): Fixture {
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
	if (chained.kind !== 'success') throw new Error('the A1 enclosure was refused');
	const wallId = chained.document.walls[0]!.id;
	const opening = planCreateWallFirstOpening(
		chained.document,
		{
			wallId,
			kind: 'window',
			offset: openingOffset,
			width: 1,
			height: 1.2,
			sillHeight: 1
		},
		freshCapture(),
		chained.document.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(`A1 opening fixture refused: ${opening.rejection.message}`);
	return {
		document: opening.document,
		wallId,
		openingId: opening.changedOpeningIds[0]!,
		roomId: opening.document.rooms[0]!.id
	};
}

/** The same enclosure with a second Opening on the start side of the midpoint. */
function twoSidedOpeningFixture(): Fixture & { readonly startOpeningId: string } {
	const fixture = enclosureFixture(4);
	const second = planCreateWallFirstOpening(
		fixture.document,
		{
			wallId: fixture.wallId,
			kind: 'window',
			offset: 1,
			width: 1,
			height: 1.2,
			sillHeight: 1
		},
		freshCapture(),
		fixture.document.floor.id
	);
	if (second.kind === 'rejected') throw new Error(`A1 start-side Opening refused: ${second.rejection.message}`);
	return { ...fixture, document: second.document, startOpeningId: second.changedOpeningIds[0]! };
}

/** One open curved Wall between the same two junctions, with one Opening. */
function curvedFixture(): Fixture {
	const base = createEmptyWallFirstLayoutDocument();
	base.floor.elevation = ELEVATION;
	base.junctions = [
		{ id: 'curve-start', point: [0, 0] },
		{ id: 'curve-end', point: [6, 0] }
	];
	base.walls = [
		{
			id: 'curve-wall',
			startJunctionId: 'curve-start',
			endJunctionId: 'curve-end',
			thickness: 0.2,
			height: 3,
			centerline: {
				kind: 'cubic-chain',
				knots: [],
				spans: [{ handleOut: [2, 3], handleIn: [4, 3] }]
			}
		}
	];
	const frame = curvedWallFrame(base, 'curve-wall');
	if (frame === null) throw new Error('the A1 curved fixture did not resolve');
	const opening = planCreateWallFirstOpening(
		base,
		{
			wallId: 'curve-wall',
			kind: 'window',
			offset: frame.length * 0.72,
			width: 0.5,
			height: 1.2,
			sillHeight: 1
		},
		freshCapture(),
		base.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(`A1 curved Opening refused: ${opening.rejection.message}`);
	return {
		document: opening.document,
		wallId: 'curve-wall',
		openingId: opening.changedOpeningIds[0]!,
		roomId: ''
	};
}

/** One closed circular Wall and its Room. */
function circularFixture(): Fixture {
	const base = createEmptyWallFirstLayoutDocument();
	base.floor.elevation = ELEVATION;
	const plan = planCreateCircularRoom({
		baseline: base,
		center: [0, 0],
		rim: [3, 0],
		capture: freshCapture(),
		levelId: base.floor.id,
		roomNamePrefix: 'Room'
	});
	if (plan.kind !== 'success') throw new Error('the A1 circle fixture was refused');
	return {
		document: plan.document,
		wallId: plan.wallId,
		openingId: '',
		roomId: plan.createdRoomIds[0] ?? ''
	};
}

async function mount(fixture: Fixture): Promise<Mounted> {
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'A1 split wall',
		layout: fixture.document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [],
			navigationNodes: [],
			connections: []
		}
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-a1-split',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`A1 fixture not admitted: ${admitted.kind}`);
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
	if (registration.kind !== 'registered' || services === undefined) throw new Error('Layout adapter did not mount');
	return { facade, session, host, services, fixture };
}

/** A complete selection for one Wall fragment of the mounted source. */
function selectWall(facade: StageFacade, sourceId: string): void {
	const snapshot = facade.snapshot();
	const reference = {
		version: 1 as const,
		domain: 'layout' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
		subject: { kind: 'wall' as const, id: sourceId },
		instancePath: [],
		location: {
			kind: 'layout-location' as const,
			levelId: snapshot.domain.layoutLevelId,
			structureInstancePath: []
		},
		componentId: null,
		capabilityId: null
	};
	const representation: PlanSourceRef = {
		sourceId,
		sourceKind: 'wall',
		generationId: snapshot.compileGeneration,
		stream: 'projected',
		subRef: null
	};
	facade.setSelection({ ordered: [{ reference, representation }], primary: reference });
}

function settle(facade: StageFacade, clockSeconds = 2): void {
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	facade.overlays();
	facade.tasks();
}

/** The projection of a world point on the level datum, in Stage-local CSS. */
function stageCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
	const id = facade.evaluationId();
	if (id === null) throw new Error('the mounted fixture has no evaluation');
	const projected = facade.projectWorld([point[0], ELEVATION, point[1]], id);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

/** An Opening's start point on its host Wall's canonical centerline. */
function openingStart(document: LayoutDocumentWallFirst, openingId: string): LayoutVec2 {
	const opening = document.openings.find((candidate) => candidate.id === openingId);
	if (opening === undefined) throw new Error('the fixture Opening is gone');
	const at = wallStationFrame(document, opening.wallId)?.pointAt(opening.offset);
	if (at === null || at === undefined) throw new Error('the fixture Opening has no resolvable point');
	return at.point;
}

async function eventually(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('the fixture did not settle');
}

describe('T1 A1 — Split wall', () => {
	it('splits a straight open Wall at the Card midpoint, preserving Opening and Room identity through Undo, Redo and Save/Load', async () => {
		const fixture = enclosureFixture(4);
		const mounted = await mount(fixture);
		selectWall(mounted.facade, fixture.wallId);
		settle(mounted.facade, 2);

		const before = acceptedLayout(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		const beforeWallIds = new Set(before.walls.map((wall) => wall.id));
		const beforeOpeningPoint = openingStart(before, fixture.openingId);

		const actions = stageCardActions(mounted.facade, {
			sourceId: fixture.wallId,
			sourceKind: 'wall',
			ref: null
		});
		expect(actions.map((action) => action.id)).toEqual([
			'layout-wall-delete',
			'layout-wall-split'
		]);
		const split = actions.find((action) => action.id === 'layout-wall-split')!;
		expect(split.label).toBe('Split wall here');
		expect(split.destructive).toBeUndefined();
		// No pointer station: the Card falls back to the 6 m Wall's midpoint.
		expect(split.detail).toContain('3.00 m');
		expect(split.detail).toContain("keeps this Wall's identity");

		expect((await split.run()).kind).toBe('accepted');
		const after = acceptedLayout(mounted.facade);
		const newWall = after.walls.find((wall) => !beforeWallIds.has(wall.id))!;
		expect(newWall).toBeDefined();
		// The start-side Wall keeps its id; both fragments are half the source.
		expect(after.walls.some((wall) => wall.id === fixture.wallId)).toBe(true);
		expect(wallFirstWallLength(after, fixture.wallId)).toBeCloseTo(3, 9);
		expect(wallFirstWallLength(after, newWall.id)).toBeCloseTo(3, 9);
		// The Opening keeps its id and world position; only its station rebases.
		const opening = after.openings.find((candidate) => candidate.id === fixture.openingId)!;
		expect(opening.wallId).toBe(newWall.id);
		expect(opening.offset).toBeCloseTo(1, 9);
		expect(openingStart(after, fixture.openingId)[0]).toBeCloseTo(beforeOpeningPoint[0], 9);
		expect(openingStart(after, fixture.openingId)[1]).toBeCloseTo(beforeOpeningPoint[1], 9);
		// The Room keeps its id and now names both fragments.
		expect(after.rooms.map((room) => room.id)).toEqual([fixture.roomId]);
		expect(
			after.rooms[0]!.boundary.filter(
				(ref) => ref.wallId === fixture.wallId || ref.wallId === newWall.id
			)
		).toHaveLength(2);
		// One gesture is one history entry.
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});

		// Undo restores the exact pre-split bytes; Redo replays the captured ids.
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect((await mounted.host.redo()).kind).toBe('installed');
		const splitBytes = mounted.facade.snapshot().canonicalJson;
		expect(splitBytes).not.toBe(beforeBytes);
		expect(acceptedLayout(mounted.facade).walls.find((wall) => wall.id === newWall.id)).toBeDefined();

		// The accepted split is an ordinary canonical document: Save/Load admits it unchanged.
		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'a1-split-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-a1-split-roundtrip',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		expect(stageEnvelope(readmitted.snapshot).units).toEqual(stageEnvelope(mounted.facade.snapshot()).units);
	});

	it('keeps Openings on both sides of the split with their ids and world positions', async () => {
		const fixture = twoSidedOpeningFixture();
		const mounted = await mount(fixture);
		selectWall(mounted.facade, fixture.wallId);
		settle(mounted.facade, 2);

		const before = acceptedLayout(mounted.facade);
		const beforeStart = openingStart(before, fixture.startOpeningId);
		const beforeEnd = openingStart(before, fixture.openingId);

		const split = stageCardActions(mounted.facade, {
			sourceId: fixture.wallId,
			sourceKind: 'wall',
			ref: null
		}).find((action) => action.id === 'layout-wall-split')!;
		expect((await split.run()).kind).toBe('accepted');

		const after = acceptedLayout(mounted.facade);
		const startOpening = after.openings.find((candidate) => candidate.id === fixture.startOpeningId)!;
		const endOpening = after.openings.find((candidate) => candidate.id === fixture.openingId)!;
		// The start-side Opening stays on the source Wall at its original station.
		expect(startOpening.wallId).toBe(fixture.wallId);
		expect(startOpening.offset).toBeCloseTo(1, 9);
		// The end-side Opening moves to the new fragment and its station rebases.
		expect(endOpening.wallId).not.toBe(fixture.wallId);
		expect(endOpening.offset).toBeCloseTo(1, 9);
		// Both keep the world point they had before the split.
		const afterStart = openingStart(after, fixture.startOpeningId);
		const afterEnd = openingStart(after, fixture.openingId);
		expect(afterStart[0]).toBeCloseTo(beforeStart[0], 9);
		expect(afterStart[1]).toBeCloseTo(beforeStart[1], 9);
		expect(afterEnd[0]).toBeCloseTo(beforeEnd[0], 9);
		expect(afterEnd[1]).toBeCloseTo(beforeEnd[1], 9);
	});

	it('uses the station the pointer named on the Wall instead of the midpoint', async () => {
		const fixture = enclosureFixture(4);
		const mounted = await mount(fixture);
		selectWall(mounted.facade, fixture.wallId);
		settle(mounted.facade, 2);

		const evaluationId = mounted.facade.evaluationId()!;
		const css = stageCss(mounted.facade, [1.5, 0]);
		mounted.facade.pointerIntent({ phase: 'down', css, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css, evaluationId });

		const split = stageCardActions(mounted.facade, {
			sourceId: fixture.wallId,
			sourceKind: 'wall',
			ref: null
		}).find((action) => action.id === 'layout-wall-split')!;
		expect(split.detail).toContain('1.50 m');

		expect((await split.run()).kind).toBe('accepted');
		const after = acceptedLayout(mounted.facade);
		expect(wallFirstWallLength(after, fixture.wallId)).toBeCloseTo(1.5, 9);
		const opening = after.openings.find((candidate) => candidate.id === fixture.openingId)!;
		expect(opening.offset).toBeCloseTo(2.5, 9);
	});

	it('splits a curved open Wall exactly and keeps its Opening at the same world point', async () => {
		const fixture = curvedFixture();
		const mounted = await mount(fixture);
		selectWall(mounted.facade, fixture.wallId);
		settle(mounted.facade, 2);

		const before = acceptedLayout(mounted.facade);
		const beforeFrame = curvedWallFrame(before, fixture.wallId)!;
		const beforeWallIds = new Set(before.walls.map((wall) => wall.id));
		const beforeOpening = before.openings.find((candidate) => candidate.id === fixture.openingId)!;
		const beforeOpeningPoint = openingStart(before, fixture.openingId);

		const split = stageCardActions(mounted.facade, {
			sourceId: fixture.wallId,
			sourceKind: 'wall',
			ref: null
		}).find((action) => action.id === 'layout-wall-split')!;
		expect(split.detail).toContain(`${(beforeFrame.length / 2).toFixed(2)} m`);

		expect((await split.run()).kind).toBe('accepted');
		const after = acceptedLayout(mounted.facade);
		const newWall = after.walls.find((wall) => !beforeWallIds.has(wall.id))!;
		const startFragment = curvedWallFrame(after, fixture.wallId)!;
		const endFragment = curvedWallFrame(after, newWall.id)!;
		expect(startFragment.length).toBeCloseTo(beforeFrame.length / 2, 6);
		expect(endFragment.length).toBeCloseTo(beforeFrame.length / 2, 6);
		expect(startFragment.length + endFragment.length).toBeCloseTo(beforeFrame.length, 6);
		// The Opening moved with the end fragment, keeping its id and its world start.
		const opening = after.openings.find((candidate) => candidate.id === fixture.openingId)!;
		expect(opening.wallId).toBe(newWall.id);
		expect(opening.offset).toBeCloseTo(beforeOpening.offset - beforeFrame.length / 2, 6);
		const afterOpeningPoint = openingStart(after, fixture.openingId);
		expect(afterOpeningPoint[0]).toBeCloseTo(beforeOpeningPoint[0], 6);
		expect(afterOpeningPoint[1]).toBeCloseTo(beforeOpeningPoint[1], 6);
	});

	it('refuses a split through an Opening in words, writing nothing and adding no history', async () => {
		const fixture = enclosureFixture(2.5);
		const mounted = await mount(fixture);
		selectWall(mounted.facade, fixture.wallId);
		settle(mounted.facade, 2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		const split = stageCardActions(mounted.facade, {
			sourceId: fixture.wallId,
			sourceKind: 'wall',
			ref: null
		}).find((action) => action.id === 'layout-wall-split')!;
		expect(split.detail).toContain('A split cannot pass through an Opening');
		const outcome = await split.run();
		expect(outcome.kind).toBe('refused');
		expect(outcome.message).toContain('A split cannot pass through an Opening');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});

	it('refuses a split of a closed circular Wall in words, writing nothing and adding no history', async () => {
		const fixture = circularFixture();
		const mounted = await mount(fixture);
		selectWall(mounted.facade, fixture.wallId);
		settle(mounted.facade, 2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		const split = stageCardActions(mounted.facade, {
			sourceId: fixture.wallId,
			sourceKind: 'wall',
			ref: null
		}).find((action) => action.id === 'layout-wall-split')!;
		expect(split.detail).toContain('A circular Wall is one closed loop');
		expect(split.detail).toContain('Change its Radius');
		const outcome = await split.run();
		expect(outcome.kind).toBe('refused');
		expect(outcome.message).toContain('A circular Wall is one closed loop');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});
});
