/**
 * SP1c — the Open Space lifecycle through the production Layout adapter and the
 * real F4 host.
 *
 * The journeys pinned here are the acceptance ones: Wall deletion's named
 * consequence and open Space identity, the Card's Kind/Area/Bounds readings,
 * the Closed | Open to sky toggle, Remove space for an open Space only, and
 * exact Undo/Redo through the accepted source.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { stageCardActions, stageCardFacts } from '$lib/authoring/stage/stage-contributions';
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

async function mount(document: LayoutDocumentWallFirst): Promise<Mounted> {
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
