/**
 * SP1c — the Open Space lifecycle through the production Layout adapter and the
 * real F4 host.
 *
 * The journeys pinned here are the acceptance ones: Wall deletion's named
 * consequence and open Space identity, the Card's Kind/Area/Bounds readings,
 * the Closed | Open to sky toggle, Remove space for an open Space only, and
 * exact Undo/Redo through the accepted source.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	findSpaceCreationOutline,
	mintLayoutIdCapture,
	layoutWorkingLevelInput,
	parseWallFirstLayoutDocumentJson,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageAdapterServices, mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope, stageUnitRevision } from '$lib/authoring/stage/unit-stage-source';
import { stageCardActions, stageCardFacts } from '$lib/authoring/stage/stage-contributions';
import { layoutSubjectReference, wallChainCommitIntent } from '$lib/authoring/adapters/layout/drawing-planners';
import { inkSurface, LAYOUT_INK_TASK } from '$lib/authoring/adapters/layout/ink';
import { spaceCreateIntent } from '$lib/authoring/adapters/layout/space-create-planners';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-sp1c-open-space';
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

/** 4×3 Space named Gallery; `open` leaves its D→A side virtual. */
function gallery(open: boolean): LayoutDocumentWallFirst {
	const document: LayoutDocumentWallFirst = {
		...createEmptyWallFirstLayoutDocument(),
		junctions: [
			junction('j-a', [0, 0]),
			junction('j-b', [4, 0]),
			junction('j-c', [4, 3]),
			junction('j-d', [0, 3])
		],
		walls: [wall('wall-a', 'j-a', 'j-b'), wall('wall-b', 'j-b', 'j-c'), wall('wall-c', 'j-c', 'j-d')],
		rooms: [
			{
				id: 'room-gallery',
				name: 'Gallery',
				boundary: [
					{ wallId: 'wall-a', direction: 'forward' },
					{ wallId: 'wall-b', direction: 'forward' },
					{ wallId: 'wall-c', direction: 'forward' }
				],
				virtualEdges: open ? [{ startJunctionId: 'j-d', endJunctionId: 'j-a' }] : [],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	};
	document.floor.elevation = ELEVATION;
	if (!open) {
		document.walls.push(wall('wall-d', 'j-d', 'j-a'));
		document.rooms[0]!.boundary.push({ wallId: 'wall-d', direction: 'forward' });
	}
	return document;
}

async function mount(
	document: LayoutDocumentWallFirst,
	openSpaceCreated?: StageAdapterServices['openSpaceCreated']
): Promise<Mounted> {
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'SP1c open space',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-sp1c-open-space',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`SP1c fixture not admitted: ${admitted.kind}`);
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
	}, undefined, { ...createStageAdapterServices(facade, host), openSpaceCreated });
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

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

function roomActions(facade: StageFacade) {
	return stageCardActions(facade, { sourceId: 'room-gallery', sourceKind: 'room', ref: null });
}

describe('SP1c — Open Space Card and lifecycle', () => {
	it('reads Kind, Area, Overhead and Wall/open-side counts on the Room Card', async () => {
		const { facade } = await mount(gallery(true));
		const facts = stageCardFacts(facade, { sourceId: 'room-gallery', sourceKind: 'room', ref: null });
		expect(facts).toContainEqual({ label: 'Kind', value: 'Open space', fieldId: 'kind' });
		expect(facts).toContainEqual({ label: 'Area', value: '12.00 m²', fieldId: 'area' });
		expect(facts).toContainEqual({ label: 'Overhead', value: 'Closed', fieldId: 'overhead' });
		expect(facts).toContainEqual({
			label: 'Bounds',
			value: '3 Walls · 1 open side',
			fieldId: 'bounds'
		});
		const ids = roomActions(facade).map((action) => action.id);
		expect(ids).toContain('layout-room-overhead');
		expect(ids).toContain('layout-space-remove');
	});

	it('does not offer Remove space for a Room', async () => {
		const { facade } = await mount(gallery(false));
		const facts = stageCardFacts(facade, { sourceId: 'room-gallery', sourceKind: 'room', ref: null });
		expect(facts).toContainEqual({ label: 'Kind', value: 'Room', fieldId: 'kind' });
		expect(facts).toContainEqual({
			label: 'Bounds',
			value: '4 Walls · 0 open sides',
			fieldId: 'bounds'
		});
		const ids = roomActions(facade).map((action) => action.id);
		expect(ids).toContain('layout-room-overhead');
		expect(ids).not.toContain('layout-space-remove');
	});

	it('opens the enclosure through Wall deletion, then toggles overhead with exact Undo/Redo', async () => {
		const mounted = await mount(gallery(false));
		const wallActions = stageCardActions(mounted.facade, {
			sourceId: 'wall-b',
			sourceKind: 'wall',
			ref: null
		});
		const erase = wallActions.find((action) => action.id === 'layout-wall-delete')!;
		expect(erase.detail).toContain('It opens Gallery; one side is now open.');
		expect((await erase.run()).kind).toBe('accepted');
		settle(mounted.facade);

		const opened = acceptedLayout(mounted.facade).rooms[0]!;
		expect(opened.id).toBe('room-gallery');
		expect(opened.virtualEdges).toHaveLength(1);
		expect(stageCardFacts(mounted.facade, { sourceId: 'room-gallery', sourceKind: 'room', ref: null }))
			.toContainEqual({ label: 'Kind', value: 'Open space', fieldId: 'kind' });

		const overhead = roomActions(mounted.facade).find((action) => action.id === 'layout-room-overhead')!;
		expect(overhead.label).toBe('Open to sky');
		expect((await overhead.run()).kind).toBe('accepted');
		settle(mounted.facade);
		expect(acceptedLayout(mounted.facade).rooms[0]!.overhead).toBe('open-to-sky');
		expect(stageCardFacts(mounted.facade, { sourceId: 'room-gallery', sourceKind: 'room', ref: null }))
			.toContainEqual({ label: 'Overhead', value: 'Open to sky', fieldId: 'overhead' });

		await mounted.host.undo();
		settle(mounted.facade);
		expect(acceptedLayout(mounted.facade).rooms[0]!.overhead).toBe('closed');
		await mounted.host.redo();
		settle(mounted.facade);
		expect(acceptedLayout(mounted.facade).rooms[0]!.overhead).toBe('open-to-sky');

		const close = roomActions(mounted.facade).find((action) => action.id === 'layout-room-overhead')!;
		expect(close.label).toBe('Close overhead');
		expect((await close.run()).kind).toBe('accepted');
		settle(mounted.facade);
		expect(acceptedLayout(mounted.facade).rooms[0]!.overhead).toBe('closed');
	});

	it('removes only the open Space record, keeps its Walls, and Undo restores identity', async () => {
		const mounted = await mount(gallery(true));
		const remove = roomActions(mounted.facade).find((action) => action.id === 'layout-space-remove')!;
		expect(remove.destructive).toBe(true);
		expect((await remove.run()).kind).toBe('accepted');
		settle(mounted.facade);
		const removed = acceptedLayout(mounted.facade);
		expect(removed.rooms).toEqual([]);
		expect(removed.walls.map((entry) => entry.id)).toEqual(['wall-a', 'wall-b', 'wall-c']);

		await mounted.host.undo();
		settle(mounted.facade);
		const restored = acceptedLayout(mounted.facade).rooms[0]!;
		expect(restored.id).toBe('room-gallery');
		expect(restored.name).toBe('Gallery');
		expect(restored.virtualEdges).toEqual([{ startJunctionId: 'j-d', endJunctionId: 'j-a' }]);
	});
});

function armRoom(facade: StageFacade) {
	expect(facade.openContributedTask(LAYOUT_INK_TASK, 'layout').kind).toBe('opened');
	const surface = inkSurface()!;
	surface.controller.setReading('room');
	expect(inkSurface()!.snapshot().reading).toBe('room');
}

function stagePoint(facade: StageFacade, [x, z]: LayoutVec2) {
	const evaluationId = facade.evaluationId()!;
	const projected = facade.projectWorld([x, ELEVATION, z], evaluationId);
	if (projected.kind !== 'projected') throw new Error('Fixture is past the working plane');
	return { css: projected.css, evaluationId };
}

function tap(facade: StageFacade, point: LayoutVec2, coarse = false) {
	const target = stagePoint(facade, point);
	expect(facade.pointerIntent({ phase: 'down', ...target, coarse }).claimed).toBe(true);
	expect(facade.pointerIntent({ phase: 'up', ...target, coarse }).claimed).toBe(true);
}

describe('Room Ink and accepted Open Space creation', () => {
	it('previews a one-gap outline, selects the new Space, and keeps rename as its own history entry', async () => {
		const baseline = { ...gallery(true), rooms: [] };
		const renamed = vi.fn();
		const { facade, host } = await mount(baseline, renamed);
		armRoom(facade);
		const point = stagePoint(facade, [2, 1.5]);
		expect(facade.hoverIntent({ phase: 'move', ...point })).toBe(true);
		expect(facade.candidatePreviews().flatMap(({ labels }) => labels.map(({ text }) => text)))
			.toContain('Open space · 12.0 m² · Click to name');
		tap(facade, [2, 1.5]);
		await vi.waitFor(() => expect(renamed).toHaveBeenCalledTimes(1));
		const created = acceptedLayout(facade);
		const room = created.rooms[0]!;
		expect(room).toMatchObject({ name: 'Open Space 1', overhead: 'open-to-sky' });
		expect(facade.selectionState().primary).toEqual(renamed.mock.calls[0]![0]);
		expect(facade.selectionState().primary?.subject).toEqual({ kind: 'room', id: room.id });
		expect(facade.session.task()).toBeNull();
		settle(facade);
		const writer = facade.cardNameWriter({ sourceId: room.id, sourceKind: 'room', ref: null })!;
		expect((await writer.commit('  Booth  ')).kind).toBe('accepted');
		const named = acceptedLayout(facade);
		expect(named.rooms[0]!.name).toBe('Booth');
		expect(parseWallFirstLayoutDocumentJson(serializeWallFirstLayoutDocument(named)))
			.toMatchObject({ success: true, document: named });
		expect((await host.undo()).kind).toBe('installed');
		expect(acceptedLayout(facade)).toEqual(created);
		expect((await host.undo()).kind).toBe('installed');
		expect(acceptedLayout(facade)).toEqual(baseline);
		for (const expected of [created, named]) {
			expect((await host.redo()).kind).toBe('installed');
			expect(acceptedLayout(facade)).toEqual(expected);
		}
		expect(renamed).toHaveBeenCalledTimes(1);
		expect(facade.session.task()).toBeNull();
	});

	it('requires a displayed outline on touch and drops a press after a change to projection', async () => {
		const { facade } = await mount({ ...gallery(true), rooms: [] });
		armRoom(facade);
		tap(facade, [2, 1.5], true);
		expect(acceptedLayout(facade).rooms).toEqual([]);
		const press = stagePoint(facade, [2, 1.5]);
		expect(facade.pointerIntent({ phase: 'down', ...press, coarse: true }).claimed).toBe(true);
		const evaluated = facade.camera.evaluate({ ...RECT, width: RECT.width + 20 }, 2);
		expect(evaluated.kind).toBe('evaluated');
		facade.pointerIntent({ phase: 'up', ...press, coarse: true });
		expect(acceptedLayout(facade).rooms).toEqual([]);
		tap(facade, [2, 1.5], true);
		expect(acceptedLayout(facade).rooms).toEqual([]);
		tap(facade, [2, 1.5], true);
		await vi.waitFor(() => expect(acceptedLayout(facade).rooms).toHaveLength(1));
	});

	it('drops a pressed outline on drag or lost capture, even when the pointer returns to the same point', async () => {
		const { facade } = await mount({ ...gallery(true), rooms: [] });
		armRoom(facade);
		const target = stagePoint(facade, [2, 1.5]);
		for (const phase of ['move', 'cancel'] as const) {
			facade.hoverIntent({ phase: 'move', ...target });
			expect(facade.pointerIntent({ phase: 'down', ...target }).claimed).toBe(true);
			const interrupted = phase === 'move' ? stagePoint(facade, [1, 1.5]) : target;
			facade.pointerIntent({ phase, ...interrupted });
			facade.pointerIntent({ phase: 'up', ...target });
			expect(facade.session.gesture()).toBeNull();
			expect(acceptedLayout(facade).rooms).toEqual([]);
		}
	});

	it('keeps a drawn gap editable, cancels before shell Escape, and requires confirmation', async () => {
		const baseline = gallery(true);
		baseline.rooms = [];
		baseline.walls = baseline.walls.slice(0, 1);
		baseline.junctions = baseline.junctions.slice(0, 2);
		const { facade } = await mount(baseline);
		armRoom(facade);
		inkSurface()!.controller.drawOpenSide?.();
		expect(inkSurface()!.snapshot().room?.mode).toBe('draw');
		tap(facade, [4, 0]);
		tap(facade, [4, 3]);
		expect(facade.keyboardIntent({ kind: 'cancel' }).claimed).toBe(true);
		expect(inkSurface()!.snapshot().room?.mode).toBe('hover');
		expect(facade.keyboardIntent({ kind: 'cancel' }).claimed).toBe(false);
		inkSurface()!.controller.drawOpenSide?.();
		for (const point of [[4, 0], [4, 3], [0, 3], [0, 0]] as LayoutVec2[]) tap(facade, point);
		expect(acceptedLayout(facade).rooms).toEqual([]);
		expect(inkSurface()!.snapshot().room?.canCreate).toBe(true);
		expect(facade.keyboardIntent({ kind: 'finish' }).claimed).toBe(true);
		await vi.waitFor(() => expect(acceptedLayout(facade).rooms).toHaveLength(1));
		expect(acceptedLayout(facade).rooms[0]!.virtualEdges).toHaveLength(3);
	});

	it('preserves the Room and Opening references when accepting a shared Wall split', async () => {
		const baseline = gallery(false);
		const opening = {
			id: 'door-gallery', wallId: 'wall-a', kind: 'door' as const, profile: 'rectangular' as const,
			offset: 3.25, width: 0.5, height: 2, sillHeight: 0
		};
		baseline.openings.push(opening);
		const onCreated = vi.fn();
		const { facade, host } = await mount(baseline, onCreated);
		const coordinator = host.coordinator();
		const accept = vi.spyOn(coordinator, 'accept');
		const beforeContentId = facade.snapshot().sourceContentId;
		armRoom(facade);
		inkSurface()!.controller.drawOpenSide?.();
		for (const point of [[1, 0], [1, -2], [2.5, -2], [2.5, 0]] as LayoutVec2[]) tap(facade, point);
		expect(inkSurface()!.snapshot().room?.canCreate).toBe(true);
		expect(facade.keyboardIntent({ kind: 'finish' }).claimed).toBe(true);
		await vi.waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
		expect(accept).toHaveBeenCalledTimes(1);
		const result = await accept.mock.results[0]!.value;
		if (result.kind !== 'accepted') throw new Error(`Expected an accepted split, got ${result.kind}`);

		const created = acceptedLayout(facade);
		const booth = created.rooms.find(({ id }) => id !== 'room-gallery')!;
		const sharedWallId = booth.boundary[0]!.wallId;
		const openingWallId = created.openings[0]!.wallId;
		const findJunction = (x: number, z: number) => created.junctions.find(({ point }) =>
			Math.abs(point[0] - x) < 1e-6 && Math.abs(point[1] - z) < 1e-6
		)!.id;
		const splitStart = findJunction(1, 0);
		const splitEnd = findJunction(2.5, 0);
		const firstCorner = findJunction(1, -2);
		const secondCorner = findJunction(2.5, -2);
		expect(created.rooms[0]).toEqual({
			...baseline.rooms[0],
			boundary: [
				{ wallId: 'wall-a', direction: 'forward' },
				{ wallId: sharedWallId, direction: 'forward' },
				{ wallId: openingWallId, direction: 'forward' },
				...baseline.rooms[0]!.boundary.slice(1)
			]
		});
		expect(booth.boundary).toEqual([{ wallId: sharedWallId, direction: 'reverse' }]);
		expect(created.walls.find(({ id }) => id === 'wall-a')).toMatchObject({ endJunctionId: splitStart });
		expect(created.walls.find(({ id }) => id === sharedWallId)).toMatchObject({
			startJunctionId: splitStart, endJunctionId: splitEnd
		});
		expect(created.walls.find(({ id }) => id === openingWallId)).toMatchObject({
			startJunctionId: splitEnd, endJunctionId: 'j-b'
		});
		expect(created.openings).toEqual([{ ...opening, wallId: openingWallId, offset: expect.closeTo(0.75) }]);

		const reference = (kind: string, id: string, contentRevision: string) =>
			layoutSubjectReference({ kind, id, contentRevision, levelId: baseline.floor.id });
		const afterContentId = facade.snapshot().sourceContentId;
		const births = [
			['room', booth.id], ['junction', splitStart], ['junction', splitEnd],
			['junction', firstCorner], ['junction', secondCorner], ['wall', sharedWallId], ['wall', openingWallId]
		] as const;
		const survivors = [['wall', 'wall-a'], ['room', 'room-gallery'], ['opening', opening.id]] as const;
		const expectedCorrespondence = [
			...births.map(([kind, id]) => ({ relation: 'created', before: null, after: reference(kind, id, afterContentId) })),
			...survivors.map(([kind, id]) => ({
				relation: 'preserved', before: reference(kind, id, beforeContentId), after: reference(kind, id, afterContentId)
			}))
		];
		expect(result.correspondence).toHaveLength(expectedCorrespondence.length);
		expect(result.correspondence).toEqual(expect.arrayContaining(expectedCorrespondence));
		expect(result.changes.map(({ kind, fields, subjectIds }) => ({ kind, fields, subjectIds: [...subjectIds].sort() }))).toEqual([{
			kind: 'layout-open-space-create', fields: ['rooms', 'junctions', 'walls', 'openings'],
			subjectIds: [...births, ...survivors].map(([, id]) => id).sort()
		}]);
		expect(coordinator.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await host.undo()).kind).toBe('installed');
		expect(acceptedLayout(facade)).toEqual(baseline);
		expect(facade.snapshot().sourceContentId).toBe(beforeContentId);
		expect((await host.redo()).kind).toBe('installed');
		expect(acceptedLayout(facade)).toEqual(created);
		expect(facade.snapshot().sourceContentId).toBe(afterContentId);
		expect(accept).toHaveBeenCalledTimes(1);
	});

	it('undoes and restores a divided remainder separately from the closed named Room', async () => {
		const baseline = gallery(true);
		const { facade, host } = await mount(baseline);
		const snapshot = facade.snapshot();
		const divided = await host.accept(wallChainCommitIntent({
			...snapshot.acceptedRevision, contentRevision: stageUnitRevision(snapshot, 'layout'),
			levelId: baseline.floor.id, capture: mintLayoutIdCapture(), operationId: 'divide-open-gallery',
			payload: {
				points: [[2, 0], [2, 3]], close: false, junctionSnaps: [],
				hostSnaps: [{ pointIndex: 0, wallId: 'wall-a' }, { pointIndex: 1, wallId: 'wall-c' }],
				thickness: null, height: null
			}
		}));
		expect(divided.kind).toBe('installed');
		const closed = acceptedLayout(facade);
		expect(closed.rooms[0]).toMatchObject({ id: 'room-gallery', name: 'Gallery', virtualEdges: [] });
		settle(facade);
		armRoom(facade);
		expect(facade.hoverIntent({ phase: 'move', ...stagePoint(facade, [1, 1.5]) })).toBe(true);
		tap(facade, [1, 1.5]);
		await vi.waitFor(() => expect(acceptedLayout(facade).rooms).toHaveLength(2));
		const remainder = acceptedLayout(facade);
		expect(remainder.rooms[0]).toEqual(closed.rooms[0]);
		expect(remainder.rooms[1]).toMatchObject({ name: 'Open Space 1', overhead: 'open-to-sky', virtualEdges: [{ startJunctionId: 'j-d', endJunctionId: 'j-a' }] });
		for (const expected of [closed, baseline]) {
			expect((await host.undo()).kind).toBe('installed');
			expect(acceptedLayout(facade)).toEqual(expected);
		}
		for (const expected of [closed, remainder]) {
			expect((await host.redo()).kind).toBe('installed');
			expect(acceptedLayout(facade)).toEqual(expected);
		}
	});

	it('rejects a forged target set and a stale revision through acceptance', async () => {
		const baseline = { ...gallery(true), rooms: [] };
		const { facade, host } = await mount(baseline);
		const outline = findSpaceCreationOutline(baseline, baseline.floor.id, [2, 1.5]);
		if (outline.kind !== 'outline') throw new Error('Expected an outline');
		const snapshot = facade.snapshot();
		const intent = spaceCreateIntent({
			cycle: outline.cycle, capture: mintLayoutIdCapture(), operationId: 'room-test-intent',
			...snapshot.acceptedRevision, levelId: baseline.floor.id, contentRevision: stageUnitRevision(snapshot, 'layout')
		});
		expect((await host.accept({ ...intent, targets: intent.targets.slice(1) })).kind).toBe('refused');
		expect((await host.accept({ ...intent, expectedRevision: { ...intent.expectedRevision, revisionId: 'stale' } })).kind).toBe('refused');
		expect(acceptedLayout(facade)).toEqual(baseline);
		expect((await host.accept({
			...intent, capturedInputs: [intent.capturedInputs[0]!, layoutWorkingLevelInput('different-floor')]
		})).kind).toBe('refused');
		expect((await host.accept(intent)).kind).toBe('installed');
	});
});
