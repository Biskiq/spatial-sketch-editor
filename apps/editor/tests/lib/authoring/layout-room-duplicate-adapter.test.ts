/**
 * T1 A4 — Duplicate isolated Room, through the production Layout adapter and
 * the real F4 host.
 *
 * The journey pinned here is the slice's acceptance:
 *
 * 1. an isolated Room's Card offers **Duplicate**, and invoking it opens one
 *    task with the complete cloned Room already proposed one metre clear;
 * 2. the proposal follows unpressed pointer motion, and a click accepts it;
 * 3. every copied Junction, Wall, Opening, Room and associated object gets a
 *    deterministic new id derived from its source, while architecture, geometry
 *    and Opening properties survive;
 * 4. a copy coincident with its source refuses in words, writes nothing and
 *    adds no history;
 * 5. a non-isolated Room refuses on the Card, naming the shared Wall, before a
 *    task opens;
 * 6. one duplicate is one history entry; Undo/Redo replay the captured ids, and
 *    the accepted copy round-trips through Save/Load unchanged.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	extractBoundaryCandidateFaces,
	planCreateCircularRoom,
	planCreateWallFirstOpening,
	planWallChain,
	setWorkObserver,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWallFirstRoom
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
import { roomDuplicateIntent } from '$lib/authoring/adapters/layout/room-duplicate-planners';
import {
	ROOM_DUPLICATE_COINCIDENT_MESSAGE,
	roomDuplicateRefusalWords
} from '$lib/authoring/adapters/layout/refusals';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-a4-room-duplicate';
const ELEVATION = 0.5;

type Fixture = {
	readonly document: LayoutDocumentWallFirst;
	readonly roomId: string;
	readonly wallId: string;
	readonly openingId: string;
	readonly objectId: string;
};

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
	readonly fixture: Fixture;
};

/** One 6×4 enclosure with a named Wall, a named Opening and an associated box. */
function isolatedFixture(): Fixture {
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
	if (chained.kind !== 'success') throw new Error(`A4 enclosure refused: ${chained.rejection.message}`);
	const wallId = chained.document.walls[0]!.id;
	const namedDocument: LayoutDocumentWallFirst = {
		...chained.document,
		walls: chained.document.walls.map((wall) =>
			wall.id === wallId ? { ...wall, name: 'Gallery wall' } : wall
		)
	};
	const openingPlan = planCreateWallFirstOpening(
		namedDocument,
		{
			wallId,
			kind: 'window',
			offset: 2,
			width: 1.2,
			height: 1.2,
			sillHeight: 1,
			profile: 'rectangular'
		},
		freshCapture(),
		namedDocument.floor.id
	);
	if (openingPlan.kind === 'rejected') throw new Error(`A4 Opening refused: ${openingPlan.rejection.message}`);
	const roomId = namedDocument.rooms[0]!.id;
	const openingId = openingPlan.changedOpeningIds[0]!;
	const document: LayoutDocumentWallFirst = {
		...openingPlan.document,
		openings: openingPlan.document.openings.map((opening) =>
			opening.id === openingId ? { ...opening, name: 'Bay window' } : opening
		),
		objects: [
			{
				id: 'obj-plant',
				kind: 'box',
				position: [1, 0.5, 1],
				rotation: [0, 0, 0],
				dimensions: [0.6, 1, 0.6],
				roomId
			}
		]
	};
	return { document, roomId, wallId, openingId, objectId: 'obj-plant' };
}

function roomFromFace(
	id: string,
	name: string,
	face: ReturnType<typeof extractBoundaryCandidateFaces>['faces'][number]
): LayoutWallFirstRoom {
	return {
		id,
		name,
		boundary: face.boundary.map((ref) => ({ ...ref })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	};
}

/** Two 3×4 Rooms sharing the named boundary Wall `wall-e`. */
function sharedWallFixture(): Fixture {
	const base = createEmptyWallFirstLayoutDocument();
	base.floor.elevation = ELEVATION;
	base.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-m', point: [3, 0] },
		{ id: 'j-b', point: [6, 0] },
		{ id: 'j-c', point: [6, 4] },
		{ id: 'j-n', point: [3, 4] },
		{ id: 'j-d', point: [0, 4] }
	];
	base.walls = [
		{ id: 'wall-a1', startJunctionId: 'j-a', endJunctionId: 'j-m', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
		{ id: 'wall-a2', startJunctionId: 'j-m', endJunctionId: 'j-b', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
		{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
		{ id: 'wall-c1', startJunctionId: 'j-c', endJunctionId: 'j-n', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
		{ id: 'wall-c2', startJunctionId: 'j-n', endJunctionId: 'j-d', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
		{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
		{ id: 'wall-e', startJunctionId: 'j-m', endJunctionId: 'j-n', thickness: 0.2, height: 3, centerline: { kind: 'line' }, name: 'Party wall' }
	];
	const extraction = extractBoundaryCandidateFaces(base);
	const left = extraction.faces.find((candidate) => candidate.boundary.some((ref) => ref.wallId === 'wall-a1'));
	const right = extraction.faces.find((candidate) => candidate.boundary.some((ref) => ref.wallId === 'wall-a2'));
	if (left === undefined || right === undefined) throw new Error('A4 shared-wall faces did not resolve');
	base.rooms = [
		roomFromFace('room-left', 'Left', left),
		roomFromFace('room-right', 'Right', right)
	];
	return { document: base, roomId: 'room-left', wallId: 'wall-e', openingId: '', objectId: '' };
}

async function mount(fixture: Fixture): Promise<Mounted> {
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'A4 duplicate isolated room',
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
		sessionEpoch: 'session-a4-room-duplicate',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`A4 fixture not admitted: ${admitted.kind}`);
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

async function eventually(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('the fixture did not settle');
}

function duplicateAction(mounted: Mounted, roomId = mounted.fixture.roomId) {
	const actions = stageCardActions(mounted.facade, { sourceId: roomId, sourceKind: 'room', ref: null });
	return actions.find((action) => action.id === 'layout-room-duplicate');
}

/** Open Duplicate through the Room Card and assert its one complete proposal. */
async function openDuplicate(mounted: Mounted): Promise<void> {
	const action = duplicateAction(mounted);
	if (action === undefined) throw new Error('the Room Card did not offer Duplicate');
	const outcome = await action.run();
	expect(outcome.kind).toBe('accepted');
	settle(mounted.facade, 2);
	expect(mounted.facade.session.task()?.kind).toBe('layout-room-duplicate');
	const previews = mounted.facade.candidatePreviews();
	expect(previews).toHaveLength(1);
	expect(previews[0]!.id).toBe('layout-room-duplicate-candidate');
	expect(previews[0]!.role).toBe('subject');
	expect(previews[0]!.labels[0]!.text).toContain('Copy · Δx');
	// The one proposal carries the Room floor and its complete Wall ring, not a
	// partial mark or a second copy path.
	expect(previews[0]!.polygons.length).toBeGreaterThan(0);
	expect(previews[0]!.segments.length).toBeGreaterThanOrEqual(4);
}

function previewDelta(facade: StageFacade): readonly [number, number] {
	const label = facade.candidatePreviews()[0]?.labels[0]?.text ?? '';
	const match = /Δx ([+−]?\d+\.\d+) · Δz ([+−]?\d+\.\d+)/.exec(label);
	if (match === null) throw new Error(`the proposal label has no delta: ${label}`);
	const parse = (text: string): number => Number(text.replace('−', '-'));
	return [parse(match[1]!), parse(match[2]!)];
}

function hover(mounted: Mounted, point: readonly [number, number]): void {
	const evaluationId = mounted.facade.evaluationId()!;
	mounted.facade.hoverIntent({
		phase: 'move',
		css: stageCss(mounted.facade, point),
		evaluationId
	});
	settle(mounted.facade, 2);
}

function click(mounted: Mounted, point: readonly [number, number]): void {
	const evaluationId = mounted.facade.evaluationId()!;
	const css = stageCss(mounted.facade, point);
	mounted.facade.pointerIntent({ phase: 'down', css, evaluationId });
	mounted.facade.pointerIntent({ phase: 'up', css, evaluationId });
}

function boundaryJunctions(document: LayoutDocumentWallFirst, roomId: string) {
	const room = document.rooms.find((entry) => entry.id === roomId);
	if (room === undefined) throw new Error('the fixture Room is gone');
	const ids = new Set<string>();
	for (const ref of room.boundary) {
		const wall = document.walls.find((entry) => entry.id === ref.wallId);
		if (wall === undefined) continue;
		ids.add(wall.startJunctionId);
		ids.add(wall.endJunctionId);
	}
	return [...ids].map((id) => document.junctions.find((junction) => junction.id === id)!);
}

describe('T1 A4 — Duplicate isolated Room', () => {
	it('[cap:layout.room-duplicate core] clones the complete Room with deterministic new lineage through Undo, Redo and Save/Load', async () => {
		const fixture = isolatedFixture();
		const mounted = await mount(fixture);
		settle(mounted.facade, 2);

		const before = acceptedLayout(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		const sourceJunctions = boundaryJunctions(before, fixture.roomId);
		const sourceOpening = before.openings.find((opening) => opening.id === fixture.openingId)!;
		const sourceWall = before.walls.find((wall) => wall.id === fixture.wallId)!;
		const sourceObject = before.objects.find((object) => object.id === fixture.objectId)!;

		const action = duplicateAction(mounted)!;
		expect(action.label).toBe('Duplicate');
		expect(action.group).toBe('secondary');
		expect(action.detail).toContain('4 Walls');
		expect(action.detail).toContain('4 Junctions');
		expect(action.detail).toContain('1 Opening');
		expect(action.detail).toContain('1 object');
		expect(action.detail).toContain('starts clear of its source');

		await openDuplicate(mounted);
		expect(mounted.session.liveProposal()?.owner).toBe('layout-room-duplicate');
		const initialDelta = previewDelta(mounted.facade);
		expect(initialDelta[0]).toBeGreaterThan(0);
		expect(initialDelta[1]).toBe(0);

		click(mounted, [3, 2]);
		await eventually(() => mounted.host.history().depth === beforeHistory.depth + 1);
		await new Promise((resolve) => setTimeout(resolve, 0));
		settle(mounted.facade, 3);

		const after = acceptedLayout(mounted.facade);
		const afterBytes = mounted.facade.snapshot().canonicalJson;
		expect(afterBytes).not.toBe(beforeBytes);
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});
		expect(mounted.facade.session.task()).toBeNull();
		expect(mounted.session.liveProposal()).toBeNull();

		// Every source boundary Junction has exactly one translated copy whose id
		// is derived from that source id, and the whole copy sits clear of its
		// source by the proposed one-metre gap.
		const copiedJunctions = after.junctions.filter((junction) => junction.id.includes('-copy'));
		expect(copiedJunctions).toHaveLength(sourceJunctions.length);
		const translations = new Set<string>();
		for (const source of sourceJunctions) {
			const copy = copiedJunctions.find((junction) => junction.id.includes(`${source.id}-copy`));
			expect(copy).toBeDefined();
			const dx = Number((copy!.point[0] - source.point[0]).toFixed(9));
			const dz = Number((copy!.point[1] - source.point[1]).toFixed(9));
			expect(dz).toBe(0);
			translations.add(`${dx},${dz}`);
		}
		expect(translations.size).toBe(1);
		const translation = [...translations][0]!.split(',').map(Number);
		expect(translation[0]).toBeGreaterThanOrEqual(initialDelta[0] - 1e-6);
		const sourceMaxX = Math.max(...sourceJunctions.map((junction) => junction.point[0]));
		const copyMinX = Math.min(...copiedJunctions.map((junction) => junction.point[0]));
		expect(copyMinX - sourceMaxX).toBeGreaterThanOrEqual(1 - 1e-6);

		// Wall architecture survives the clone; only identity and placement change.
		const copiedWall = after.walls.find((wall) => wall.id.includes(`${fixture.wallId}-copy`))!;
		expect(copiedWall).toBeDefined();
		expect(copiedWall.thickness).toBe(sourceWall.thickness);
		expect(copiedWall.height).toBe(sourceWall.height);
		expect(copiedWall.name).toBe('Gallery wall');
		expect(copiedWall.startJunctionId).toContain('-copy');
		expect(copiedWall.endJunctionId).toContain('-copy');

		// Opening properties are copied verbatim; its host Wall is remapped.
		const copiedOpening = after.openings.find((opening) => opening.id.includes(`${fixture.openingId}-copy`))!;
		expect(copiedOpening).toBeDefined();
		expect(copiedOpening.wallId).toBe(copiedWall.id);
		expect(copiedOpening.kind).toBe(sourceOpening.kind);
		expect(copiedOpening.offset).toBe(sourceOpening.offset);
		expect(copiedOpening.width).toBe(sourceOpening.width);
		expect(copiedOpening.height).toBe(sourceOpening.height);
		expect(copiedOpening.sillHeight).toBe(sourceOpening.sillHeight);
		expect(copiedOpening.profile).toBe(sourceOpening.profile);
		expect(copiedOpening.name).toBe('Bay window');

		// The Room copy is new, named from its source, keeps its thicknesses, and
		// references only the newly created Walls.
		const copiedRoom = after.rooms.find((room) => room.id.includes(`${fixture.roomId}-copy`))!;
		expect(copiedRoom).toBeDefined();
		expect(copiedRoom.name).toBe(`${before.rooms[0]!.name} copy`);
		expect(copiedRoom.floorThickness).toBe(before.rooms[0]!.floorThickness);
		expect(copiedRoom.ceilingThickness).toBe(before.rooms[0]!.ceilingThickness);
		const copiedWallIds = new Set(after.walls.filter((wall) => wall.id.includes('-copy')).map((wall) => wall.id));
		expect(copiedRoom.boundary.every((ref) => copiedWallIds.has(ref.wallId))).toBe(true);

		// Associated Layout objects copy and remap their room; free objects do not.
		const copiedObject = after.objects.find((object) => object.id.includes(`${fixture.objectId}-copy`))!;
		expect(copiedObject).toBeDefined();
		expect(copiedObject.roomId).toBe(copiedRoom.id);
		expect(copiedObject.position[0]).toBeCloseTo(sourceObject.position[0] + translation[0]!, 9);
		expect(copiedObject.position[2]).toBeCloseTo(sourceObject.position[2], 9);

		// Undo restores the exact pre-duplicate bytes; Redo replays the same ids.
		const createdIds = [...copiedJunctions, copiedWall, copiedOpening, copiedRoom, copiedObject].map((entry) => entry.id);
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect((await mounted.host.redo()).kind).toBe('installed');
		await new Promise((resolve) => setTimeout(resolve, 0));
		settle(mounted.facade, 3);
		expect(mounted.facade.snapshot().canonicalJson).toBe(afterBytes);
		const replayed = acceptedLayout(mounted.facade);
		for (const id of createdIds) {
			expect(
				[
					...replayed.junctions,
					...replayed.walls,
					...replayed.openings,
					...replayed.rooms,
					...replayed.objects
				].some((entry) => entry.id === id)
			).toBe(true);
		}

		// The accepted copy is an ordinary canonical document: Save/Load admits it unchanged.
		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'a4-room-duplicate-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-a4-room-duplicate-roundtrip',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		expect(stageEnvelope(readmitted.snapshot).units).toEqual(stageEnvelope(mounted.facade.snapshot()).units);
	});

	it('follows unpressed pointer motion and commits the complete copy at the shown translation', async () => {
		const fixture = isolatedFixture();
		const mounted = await mount(fixture);
		settle(mounted.facade, 2);
		const before = acceptedLayout(mounted.facade);
		const sourceJunctions = boundaryJunctions(before, fixture.roomId);

		await openDuplicate(mounted);
		const initial = previewDelta(mounted.facade);

		// The first move names the origin; the second moves the default proposal
		// by exactly the pointer's own displacement (snapped through the shared
		// drag resolver).
		const work: string[] = [];
		const previous = setWorkObserver({ count: (name) => work.push(name), span: (name) => work.push(name) });
		try {
			hover(mounted, [3, 2]);
			expect(previewDelta(mounted.facade)).toEqual(initial);
			hover(mounted, [4, 4]);
			const shown = previewDelta(mounted.facade);
			expect(shown[0]).toBeCloseTo(initial[0] + 1, 2);
			expect(shown[1]).toBeCloseTo(initial[1] + 2, 2);
			// The copy is still one complete proposal while it moves.
			expect(mounted.facade.candidatePreviews()).toHaveLength(1);
			expect(mounted.facade.candidatePreviews()[0]!.role).toBe('subject');
		} finally {
			setWorkObserver(previous);
		}
		expect(work.filter((name) => name === 'compile' || name === 'validation:layout-document')).toEqual([]);
		const shown = previewDelta(mounted.facade);

		click(mounted, [4, 4]);
		await eventually(() => mounted.facade.session.task() === null);
		await new Promise((resolve) => setTimeout(resolve, 0));
		settle(mounted.facade, 3);

		const after = acceptedLayout(mounted.facade);
		const copiedJunctions = after.junctions.filter((junction) => junction.id.includes('-copy'));
		const source = sourceJunctions[0]!;
		const copy = copiedJunctions.find((junction) => junction.id.includes(`${source.id}-copy`))!;
		expect(copy).toBeDefined();
		expect(copy.point[0] - source.point[0]).toBeCloseTo(shown[0], 2);
		expect(copy.point[1] - source.point[1]).toBeCloseTo(shown[1], 2);
		expect(after.rooms.filter((room) => room.id.includes('-copy'))).toHaveLength(1);
	});

	it('[cap:layout.room-duplicate edge] prevents committing a copy coincident with its source', async () => {
		const fixture = isolatedFixture();
		const mounted = await mount(fixture);
		settle(mounted.facade, 2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		const snapshot = mounted.facade.snapshot();
		const coincidentWords = roomDuplicateRefusalWords(fixture.document, {
			code: 'coincident_with_source'
		});
		expect(coincidentWords).toBe(ROOM_DUPLICATE_COINCIDENT_MESSAGE);

		// The planner refuses zero translation even if a caller bypasses the
		// pointer proposal: no intent may record a coincident copy.
		const direct = await mounted.services.authoring.accept(
			roomDuplicateIntent({
				roomId: fixture.roomId,
				delta: [0, 0],
				capture: freshCapture(),
				operationId: 'a4-coincident-direct',
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: snapshot.acceptedRevision.revisionId,
				contentRevision: snapshot.domain.unitRevisions.layout,
				levelId: snapshot.domain.layoutLevelId
			})
		);
		expect(direct.kind).toBe('refused');
		if (direct.kind !== 'refused') throw new Error(`coincident duplicate was not refused: ${direct.kind}`);
		expect(direct.message).toBe(coincidentWords);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);

		// The pointer proposal turns red at zero translation, and a click writes
		// nothing while the task stays open for a valid placement.
		mounted.session.setDrafting({ snap: false });
		await openDuplicate(mounted);
		const initial = previewDelta(mounted.facade);
		hover(mounted, [3, 2]);
		hover(mounted, [3 - initial[0], 2 - initial[1]]);
		const preview = mounted.facade.candidatePreviews()[0]!;
		expect(preview.role).toBe('refused');
		expect(preview.labels[0]!.text).toBe(coincidentWords);

		click(mounted, [3 - initial[0], 2 - initial[1]]);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.facade.session.task()?.kind).toBe('layout-room-duplicate');
		// The pointer refusal and the live proposal read the same words as the
		// planner's acceptance refusal; a click never invents a second sentence.
		expect(mounted.facade.candidatePreviews()[0]!.labels[0]!.text).toBe(coincidentWords);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		// The live proposal holds Undo with its own reason; it records no entry.
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth,
			position: beforeHistory.position,
			canUndo: beforeHistory.canUndo,
			canRedo: beforeHistory.canRedo
		});
	});

	it('retries a refused placement without validating the moving ghost', async () => {
		const fixture = isolatedFixture();
		const circle = planCreateCircularRoom({
			baseline: fixture.document, center: [14, 2], rim: [16, 2],
			capture: freshCapture(), levelId: fixture.document.floor.id
		});
		if (circle.kind !== 'success') throw new Error(circle.rejection.message);
		const mounted = await mount({ ...fixture, document: circle.document });
		mounted.session.setDrafting({ snap: false });
		settle(mounted.facade, 2);
		const before = mounted.facade.snapshot().canonicalJson;
		await openDuplicate(mounted);

		click(mounted, [3, 2]);
		await eventually(() => mounted.facade.candidatePreviews()[0]?.role === 'refused');
		expect(mounted.facade.candidatePreviews()[0]?.labels[0]?.text).toContain('circular Wall');
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history().position).toBe(0);

		const work: string[] = [];
		const previous = setWorkObserver({ count: (name) => work.push(name), span: (name) => work.push(name) });
		try {
			hover(mounted, [12, 2]);
			expect(mounted.facade.candidatePreviews()[0]?.role).toBe('subject');
			hover(mounted, [15, 2]);
			expect(mounted.facade.candidatePreviews()[0]?.polygons.length).toBeGreaterThan(0);
		} finally {
			setWorkObserver(previous);
		}
		expect(work.filter((name) => name === 'compile' || name === 'validation:layout-document')).toEqual([]);
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);

		click(mounted, [15, 2]);
		await eventually(() => acceptedLayout(mounted.facade).rooms.length === circle.document.rooms.length + 1);
		expect(mounted.host.history().position).toBe(1);
		mounted.facade.dispose();
	});

	it('[cap:layout.room-duplicate edge] refuses a non-isolated Room on the Card, naming the shared Wall', async () => {
		const fixture = sharedWallFixture();
		const mounted = await mount(fixture);
		settle(mounted.facade, 2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		const action = duplicateAction(mounted)!;
		expect(action.label).toBe('Duplicate');
		expect(action.detail).toContain('not isolated');
		expect(action.detail).toContain('"Party wall"');
		const outcome = await action.run();
		expect(outcome.kind).toBe('refused');
		expect(outcome.message).toContain('"Party wall"');
		expect(mounted.facade.session.task()).toBeNull();
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});
});
