/**
 * SP1d — open-side handles through the production Layout adapter and the real
 * F4 acceptance host.
 *
 * One selected open Space publishes a mid-grip per virtual edge and a knob at
 * each end that touches a Wall. A mid-grip drag moves the side square to itself,
 * an end-knob drag splits its Wall only at release, and both are one history
 * entry. A refusal is red-dashed with **Stops at *Space*** and writes nothing;
 * Escape writes nothing. The source is exact under Undo/Redo and the handles are
 * editor state in both Plan and 3D.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	spaceOpenSideFrames,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageLayout } from '$lib/authoring/stage/stage-adapter-host';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-sp1d-open-side';
const ELEVATION = 0.5;

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
	readonly document: LayoutDocumentWallFirst;
};

function wall(id: string, start: string, end: string): LayoutDocumentWallFirst['walls'][number] {
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		thickness: 0.2,
		height: 3,
		centerline: { kind: 'line' }
	};
}

function junction(id: string, point: LayoutVec2): LayoutDocumentWallFirst['junctions'][number] {
	return { id, point };
}

/** A 4×3 open Space; `neighbour` adds the enclosed Booth used for refusals. */
function gallery(neighbour = false): LayoutDocumentWallFirst {
	const document: LayoutDocumentWallFirst = {
		...createEmptyWallFirstLayoutDocument(),
		junctions: [
			junction('j-a', [0, 0]),
			junction('j-b', [4, 0]),
			junction('j-c', [4, 3]),
			junction('j-d', [0, 3]),
			...(neighbour
				? [
						junction('j-e', [-2, 1]),
						junction('j-f', [-1, 1]),
						junction('j-g', [-1, 2]),
						junction('j-h', [-2, 2])
					]
				: [])
		],
		walls: [
			wall('wall-a', 'j-a', 'j-b'),
			wall('wall-b', 'j-b', 'j-c'),
			wall('wall-c', 'j-c', 'j-d'),
			...(neighbour
				? [
						wall('outside-s', 'j-e', 'j-f'),
						wall('outside-e', 'j-f', 'j-g'),
						wall('outside-n', 'j-g', 'j-h'),
						wall('outside-w', 'j-h', 'j-e')
					]
				: [])
		],
		rooms: [
			{
				id: 'room-gallery',
				name: 'Gallery',
				boundary: [
					{ wallId: 'wall-a', direction: 'forward' },
					{ wallId: 'wall-b', direction: 'forward' },
					{ wallId: 'wall-c', direction: 'forward' }
				],
				virtualEdges: [{ startJunctionId: 'j-d', endJunctionId: 'j-a' }],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			},
			...(neighbour
				? [
						{
							id: 'room-booth',
							name: 'Booth',
							boundary: [
								{ wallId: 'outside-s', direction: 'forward' as const },
								{ wallId: 'outside-e', direction: 'forward' as const },
								{ wallId: 'outside-n', direction: 'forward' as const },
								{ wallId: 'outside-w', direction: 'forward' as const }
							],
							virtualEdges: [],
							overhead: 'closed' as const,
							floorThickness: 0.1,
							ceilingThickness: 0.1
						}
					]
				: [])
		]
	};
	document.floor.elevation = ELEVATION;
	return document;
}

async function mount(document: LayoutDocumentWallFirst): Promise<Mounted> {
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'SP1d open-side handles',
		layout: document,
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
		sessionEpoch: 'session-sp1d-open-side',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`SP1d fixture not admitted: ${admitted.kind}`);
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
	return { facade, session, host, services, document };
}

function settle(facade: StageFacade, clockSeconds = 2): void {
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	facade.overlays();
	facade.tasks();
}

function armInk(facade: StageFacade): void {
	const opened = facade.openContributedTask('layout-ink');
	if (opened.kind !== 'opened') throw new Error(`Ink did not arm: ${opened.message}`);
	if (inkSurface() === null) throw new Error('Ink published no surface');
}

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageLayout(facade.snapshot());
}

/** A complete primary selection for one Room. */
function selectRoom(facade: StageFacade, roomId: string): void {
	const snapshot = facade.snapshot();
	const reference = {
		version: 1 as const,
		domain: 'layout' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
		subject: { kind: 'room' as const, id: roomId },
		instancePath: [],
		location: {
			kind: 'layout-location' as const,
			levelId: snapshot.domain.layoutLevelId,
			structureInstancePath: []
		},
		componentId: null,
		capabilityId: null
	};
	facade.setSelection({ ordered: [{ reference }], primary: reference });
}

function stageCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the fixture has no evaluation');
	const projected = facade.projectWorld([point[0], ELEVATION, point[1]], evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

const MID = 'layout-open-side-mid|j-d|j-a';
const END = 'layout-open-side-end|end|j-d|j-a';

async function committed(mounted: Mounted, before: string): Promise<void> {
	await expect.poll(() => mounted.host.history().position).toBe(1);
	await expect
		.poll(() => mounted.facade.snapshot().canonicalJson)
		.not.toBe(before);
}

describe('SP1d — open-side handle publication', () => {
	it('publishes one mid-grip and both end knobs for the selected open Space', async () => {
		const mounted = await mount(gallery());
		const room = acceptedLayout(mounted.facade).rooms[0]!;
		selectRoom(mounted.facade, room.id);
		settle(mounted.facade);
		const marks = mounted.facade.marks();
		expect(marks.find((mark) => mark.id === MID)).toMatchObject({
			kind: 'point',
			role: 'edit',
			label: 'Open side',
			planner: 'layout-open-side-offset'
		});
		expect(marks.find((mark) => mark.id === END)).toMatchObject({
			kind: 'point',
			role: 'edit',
			label: 'Open side end',
			planner: 'layout-open-side-slide'
		});
		expect(marks.find((mark) => mark.id === 'layout-open-side-end|start|j-d|j-a')).toBeDefined();
		expect(marks.filter((mark) => mark.id.startsWith('layout-open-side-'))).toHaveLength(3);
		mounted.facade.dispose();
	});

	it('keeps the handles in Plan and 3D and offers none for a non-selected or closed Space', async () => {
		const mounted = await mount(gallery());
		const room = acceptedLayout(mounted.facade).rooms[0]!;
		expect(mounted.facade.marks().some((mark) => mark.id === MID)).toBe(false);
		selectRoom(mounted.facade, room.id);
		settle(mounted.facade);
		expect(mounted.facade.marks().some((mark) => mark.id === MID)).toBe(true);
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: '3d' }, 20);
		settle(mounted.facade, 30);
		expect(mounted.facade.marks().some((mark) => mark.id === MID)).toBe(true);
		expect(mounted.facade.marks().some((mark) => mark.id === END)).toBe(true);

		// A closed Room has no virtual edge, so the handles disappear with Kind.
		const closed = await mount({
			...gallery(),
			walls: [...gallery().walls, wall('wall-d', 'j-d', 'j-a')],
			rooms: [
				{
					...gallery().rooms[0]!,
					boundary: [...gallery().rooms[0]!.boundary, { wallId: 'wall-d', direction: 'forward' }],
					virtualEdges: []
				}
			]
		});
		selectRoom(closed.facade, 'room-gallery');
		settle(closed.facade);
		expect(closed.facade.marks().some((mark) => mark.id === MID)).toBe(false);
		mounted.facade.dispose();
		closed.facade.dispose();
	});
});

describe('SP1d — mid-grip moves the open side square to itself', () => {
	it('previews, commits one history entry and replays exactly under Undo/Redo', async () => {
		const mounted = await mount(gallery());
		const room = acceptedLayout(mounted.facade).rooms[0]!;
		selectRoom(mounted.facade, room.id);
		settle(mounted.facade);
		const before = mounted.facade.snapshot().canonicalJson;
		const from = stageCss(mounted.facade, [0, 1.5]);
		const to = stageCss(mounted.facade, [0.5, 1.5]);
		const evaluationId = mounted.facade.evaluationId()!;

		expect(
			mounted.facade.pointerIntent({ phase: 'down', handleId: MID, css: from, evaluationId }).claimed
		).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const preview = mounted.facade
			.candidatePreviews()
			.find((entry) => entry.id === 'layout-open-side-candidate');
		expect(preview?.role).toBe('subject');
		expect(preview?.polygons).toHaveLength(1);
		expect(preview?.labels[0]?.text).toContain('Δn');
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);

		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await committed(mounted, before);
		settle(mounted.facade);
		const accepted = mounted.facade.snapshot().canonicalJson;
		const moved = acceptedLayout(mounted.facade);
		expect(moved.junctions.find((entry) => entry.id === 'j-a')!.point).toEqual([0.5, 0]);
		expect(moved.junctions.find((entry) => entry.id === 'j-d')!.point).toEqual([0.5, 3]);
		expect(moved.rooms.find((entry) => entry.id === 'room-gallery')).toMatchObject({
			name: 'Gallery',
			virtualEdges: [{ startJunctionId: 'j-d', endJunctionId: 'j-a' }]
		});
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(mounted.facade.session.gesture()).toBeNull();

		await mounted.host.undo();
		settle(mounted.facade);
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		await mounted.host.redo();
		settle(mounted.facade);
		expect(mounted.facade.snapshot().canonicalJson).toBe(accepted);
		mounted.facade.dispose();
	});

	it('shows Stops at Booth, refuses red-dashed and writes nothing', async () => {
		const mounted = await mount(gallery(true));
		const room = acceptedLayout(mounted.facade).rooms[0]!;
		selectRoom(mounted.facade, room.id);
		settle(mounted.facade);
		const before = mounted.facade.snapshot().canonicalJson;
		const from = stageCss(mounted.facade, [0, 1.5]);
		const to = stageCss(mounted.facade, [-1.5, 1.5]);
		const evaluationId = mounted.facade.evaluationId()!;
		mounted.facade.pointerIntent({ phase: 'down', handleId: MID, css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const preview = mounted.facade
			.candidatePreviews()
			.find((entry) => entry.id === 'layout-open-side-candidate');
		expect(preview?.role).toBe('refused');
		expect(preview?.labels[0]?.text).toBe('Stops at Booth');
		expect(
			mounted.facade.marks().find((mark) => mark.id === MID)?.refusal
		).toBe('Stops at Booth');
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(mounted.facade.session.gesture()).toBeNull();
		mounted.facade.dispose();
	});

	it('uses the mid-grip release position without a preceding move', async () => {
		const mounted = await mount(gallery());
		const room = acceptedLayout(mounted.facade).rooms[0]!;
		selectRoom(mounted.facade, room.id);
		settle(mounted.facade);
		const before = mounted.facade.snapshot().canonicalJson;
		const from = stageCss(mounted.facade, [0, 1.5]);
		const to = stageCss(mounted.facade, [0.5, 1.5]);
		const evaluationId = mounted.facade.evaluationId()!;
		mounted.facade.pointerIntent({ phase: 'down', handleId: MID, css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await committed(mounted, before);
		settle(mounted.facade);
		const moved = acceptedLayout(mounted.facade);
		expect(moved.junctions.find((entry) => entry.id === 'j-a')!.point).toEqual([0.5, 0]);
		expect(moved.junctions.find((entry) => entry.id === 'j-d')!.point).toEqual([0.5, 3]);
		mounted.facade.dispose();
	});

	it('writes nothing on Escape', async () => {
		const mounted = await mount(gallery());
		const room = acceptedLayout(mounted.facade).rooms[0]!;
		selectRoom(mounted.facade, room.id);
		settle(mounted.facade);
		const before = mounted.facade.snapshot().canonicalJson;
		const from = stageCss(mounted.facade, [0, 1.5]);
		const to = stageCss(mounted.facade, [0.5, 1.5]);
		const evaluationId = mounted.facade.evaluationId()!;
		mounted.facade.pointerIntent({ phase: 'down', handleId: MID, css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.gestureKeyIntent({ kind: 'cancel' }).claimed).toBe(true);
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(mounted.facade.candidatePreviews().some((entry) => entry.id === 'layout-open-side-candidate')).toBe(false);
		mounted.facade.dispose();
	});
});

describe('SP1d — end knob slides and splits at release', () => {
	it('splits only on release, keeps the Space and replays exactly under Undo/Redo', async () => {
		const mounted = await mount(gallery());
		const room = acceptedLayout(mounted.facade).rooms[0]!;
		selectRoom(mounted.facade, room.id);
		settle(mounted.facade);
		const before = mounted.facade.snapshot().canonicalJson;
		const from = stageCss(mounted.facade, [0, 0]);
		const to = stageCss(mounted.facade, [1.5, 0]);
		const evaluationId = mounted.facade.evaluationId()!;
		expect(
			mounted.facade.pointerIntent({ phase: 'down', handleId: END, css: from, evaluationId }).claimed
		).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const preview = mounted.facade
			.candidatePreviews()
			.find((entry) => entry.id === 'layout-open-side-candidate');
		expect(preview?.role).toBe('subject');
		expect(preview?.polygons[0]).toHaveLength(4);
		// The preview is evidence; the editor still has one Wall-A.
		expect(acceptedLayout(mounted.facade).walls.filter((entry) => entry.id.startsWith('wall-a'))).toHaveLength(1);
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);

		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await committed(mounted, before);
		settle(mounted.facade);
		const accepted = mounted.facade.snapshot().canonicalJson;
		const split = acceptedLayout(mounted.facade);
		const splitRoom = split.rooms.find((entry) => entry.id === 'room-gallery')!;
		expect(splitRoom.name).toBe('Gallery');
		expect(splitRoom.virtualEdges).toHaveLength(1);
		const splitId = splitRoom.virtualEdges[0]!.endJunctionId;
		expect(splitId).not.toBe('j-a');
		expect(split.junctions.find((entry) => entry.id === splitId)!.point).toEqual([1.5, 0]);
		expect(split.junctions.some((entry) => entry.id === 'j-a')).toBe(true);
		expect(split.walls.length).toBe(4);
		expect(split.rooms.map((entry) => entry.id)).toEqual(['room-gallery']);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });

		await mounted.host.undo();
		settle(mounted.facade);
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		await mounted.host.redo();
		settle(mounted.facade);
		expect(mounted.facade.snapshot().canonicalJson).toBe(accepted);
		mounted.facade.dispose();
	});

	it('writes nothing when the knob is released without a move', async () => {
		const mounted = await mount(gallery());
		const room = acceptedLayout(mounted.facade).rooms[0]!;
		selectRoom(mounted.facade, room.id);
		settle(mounted.facade);
		const before = mounted.facade.snapshot().canonicalJson;
		const from = stageCss(mounted.facade, [0, 0]);
		const evaluationId = mounted.facade.evaluationId()!;
		mounted.facade.pointerIntent({ phase: 'down', handleId: END, css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: from, evaluationId });
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		mounted.facade.dispose();
	});

	it('uses the release position even when no move event preceded it', async () => {
		const mounted = await mount(gallery());
		const room = acceptedLayout(mounted.facade).rooms[0]!;
		selectRoom(mounted.facade, room.id);
		settle(mounted.facade);
		const before = mounted.facade.snapshot().canonicalJson;
		const from = stageCss(mounted.facade, [0, 0]);
		const to = stageCss(mounted.facade, [1.5, 0]);
		const evaluationId = mounted.facade.evaluationId()!;
		mounted.facade.pointerIntent({ phase: 'down', handleId: END, css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await committed(mounted, before);
		settle(mounted.facade);
		const accepted = acceptedLayout(mounted.facade);
		expect(accepted.walls.length).toBe(4);
		expect(
			accepted.junctions.find(
				(entry) =>
					entry.point[0] === 1.5 &&
					entry.point[1] === 0 &&
					entry.id !== 'j-a'
			)
		).toBeDefined();
		mounted.facade.dispose();
	});
});

describe('SP1d — the handles are editor-only', () => {
	it('does not write handle state into the accepted Layout or the compiled reading', async () => {
		const mounted = await mount(gallery());
		const room = acceptedLayout(mounted.facade).rooms[0]!;
		selectRoom(mounted.facade, room.id);
		settle(mounted.facade);
		const serialized = mounted.facade.snapshot().canonicalJson;
		expect(serialized).not.toContain('layout-open-side');
		expect(serialized).not.toContain('mid|');
		const frames = spaceOpenSideFrames(acceptedLayout(mounted.facade), room.id);
		expect(frames).toHaveLength(1);
		// A handle is a reading of the virtual edge, never a subject or a Card.
		expect(mounted.facade.selectionState().primary?.subject).toEqual({
			kind: 'room',
			id: room.id
		});
		mounted.facade.dispose();
	});
});

describe('SP1d — partial-Wall absorption through Ink', () => {
	it('absorbs a Wall drawn from the end knob and replays one history entry', async () => {
		const mounted = await mount(gallery());
		const before = mounted.facade.snapshot().canonicalJson;
		armInk(mounted.facade);
		const from = stageCss(mounted.facade, [0, 0]);
		const to = stageCss(mounted.facade, [0, 1.5]);
		const evaluationId = mounted.facade.evaluationId()!;
		mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(inkSurface()!.snapshot().consequence).toContain('Extends Gallery');
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await committed(mounted, before);
		settle(mounted.facade);
		const accepted = acceptedLayout(mounted.facade);
		const room = accepted.rooms.find((entry) => entry.id === 'room-gallery')!;
		expect(room.boundary).toHaveLength(4);
		expect(room.virtualEdges).toHaveLength(1);
		const remaining = room.virtualEdges[0]!;
		expect(remaining.startJunctionId).toBe('j-d');
		expect(accepted.junctions.find((entry) => entry.id === remaining.endJunctionId)!.point).toEqual([0, 1.5]);
		expect(accepted.walls).toHaveLength(4);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		const acceptedJson = mounted.facade.snapshot().canonicalJson;
		await mounted.host.undo();
		settle(mounted.facade);
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		await mounted.host.redo();
		settle(mounted.facade);
		expect(mounted.facade.snapshot().canonicalJson).toBe(acceptedJson);
		mounted.facade.dispose();
	});

	it('absorbs from the start knob and leaves a non-collinear stroke free-standing', async () => {
		const start = await mount(gallery());
		armInk(start.facade);
		const startFrom = stageCss(start.facade, [0, 3]);
		const startTo = stageCss(start.facade, [0, 1.5]);
		const startEval = start.facade.evaluationId()!;
		start.facade.pointerIntent({ phase: 'down', css: startFrom, evaluationId: startEval });
		start.facade.pointerIntent({ phase: 'move', css: startTo, evaluationId: startEval });
		start.facade.pointerIntent({ phase: 'up', css: startTo, evaluationId: startEval });
		await expect.poll(() => start.host.history().position).toBe(1);
		settle(start.facade);
		const startRoom = acceptedLayout(start.facade).rooms.find((entry) => entry.id === 'room-gallery')!;
		expect(startRoom.virtualEdges).toHaveLength(1);
		expect(startRoom.virtualEdges[0]!.endJunctionId).toBe('j-a');
		expect(
			acceptedLayout(start.facade).junctions.find(
				(entry) => entry.id === startRoom.virtualEdges[0]!.startJunctionId
			)!.point
		).toEqual([0, 1.5]);
		start.facade.dispose();

		const free = await mount(gallery());
		armInk(free.facade);
		const freeFrom = stageCss(free.facade, [0, 0]);
		const freeTo = stageCss(free.facade, [1, 1]);
		const freeEval = free.facade.evaluationId()!;
		free.facade.pointerIntent({ phase: 'down', css: freeFrom, evaluationId: freeEval });
		free.facade.pointerIntent({ phase: 'move', css: freeTo, evaluationId: freeEval });
		free.facade.pointerIntent({ phase: 'up', css: freeTo, evaluationId: freeEval });
		await expect.poll(() => free.host.history().position).toBe(1);
		settle(free.facade);
		const freeRoom = acceptedLayout(free.facade).rooms.find((entry) => entry.id === 'room-gallery')!;
		expect(freeRoom.virtualEdges).toEqual([{ startJunctionId: 'j-d', endJunctionId: 'j-a' }]);
		expect(freeRoom.boundary).toHaveLength(3);
		free.facade.dispose();
	});
});
