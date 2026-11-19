/**
 * T1 X1 — the Room Card's Lift action.
 *
 * Lift is a **reading, not an edit**. The Card action is the one authored-side
 * place it starts, so what it must never do is as important as what it does:
 * the accepted document, its revision and the history are untouched, and the
 * action is nothing but the shell store's scope plus a contributions refresh.
 *
 * The label follows the live scope, so the same button offers the way back, and
 * running it while Lift is on with Everything narrows to this Space.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	resolveLayoutSurface,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	SCENE_UNIT_FORMAT_VERSION,
	type CameraFreeSceneDocument,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { stageCardActions } from '$lib/authoring/stage/stage-contributions';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { interiorLift } from '$lib/authoring/layout/interior-lift-store.svelte';
import { sliceReading } from '$lib/authoring/stage/slice/slice-reading.svelte';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { captureFor } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-t1-x1-lift-action';
const ELEVATION = 0.5;

function isolatedRoom(): LayoutDocumentWallFirst {
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
		capture: captureFor('lift-action-room'),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error(`the Room was refused: ${chained.rejection.message}`);
	return chained.document;
}

async function mount() {
	const layout = isolatedRoom();
	const paintedSurface = { kind: 'wall-side', wallId: layout.walls[0]!.id, side: 'left' } as const;
	const scene: CameraFreeSceneDocument = {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [],
		surfaceFinishes: [{ surface: paintedSurface, finish: { materialId: 'marble-light' } }]
	};
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'X1 lift action',
		layout,
		scene
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-t1-x1-lift-action',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`the fixture was not admitted: ${admitted.kind}`);
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
	const registration = mountStageAdapter(facade, host, (port) => createAdapter(port));
	if (registration.kind !== 'registered') throw new Error('the Layout adapter did not mount');
	const roomId = stageEnvelope(facade.snapshot()).units.layout.data.rooms[0]!.id;
	const subject = { sourceId: roomId, sourceKind: 'room', ref: null } as const;
	return {
		facade,
		host,
		roomId,
		paintedSurface,
		roomName: stageEnvelope(facade.snapshot()).units.layout.data.rooms[0]!.name,
		liftAction: () =>
			stageCardActions(facade, subject as never).find((action) => action.id === 'layout-room-lift')
	};
}

afterEach(() => {
	interiorLift.clear();
	sliceReading.clear();
});

describe('T1 X1 — the Room Card offers Lift', () => {
	it('lifts this Space, then puts it back, and never touches the document', async () => {
		const mounted = await mount();
		const beforeHistory = mounted.host.history();
		const beforeRevision = mounted.facade.snapshot().acceptedRevision;
		const beforeDocument = stageEnvelope(mounted.facade.snapshot()).units.layout.data;
		const beforeScene = stageEnvelope(mounted.facade.snapshot()).units.scene.data;
		const beforeEnvelopeBytes = mounted.facade.snapshot().canonicalJson;
		expect(resolveLayoutSurface(beforeDocument, mounted.paintedSurface)).toBe('present');
		expect(beforeScene.surfaceFinishes).toEqual([
			{ surface: mounted.paintedSurface, finish: { materialId: 'marble-light' } }
		]);

		expect(mounted.liftAction()?.label).toBe('Lift');
		const outcome = await mounted.liftAction()!.run();
		expect(outcome).toEqual({ kind: 'accepted' });
		expect(interiorLift.reading?.scope).toEqual({ kind: 'space', roomId: mounted.roomId });
		expect(mounted.liftAction()?.label).toBe('Put back');

		// A reading writes no document, adds no history and moves no revision.
		expect(stageEnvelope(mounted.facade.snapshot()).units.layout.data).toEqual(beforeDocument);
		expect(stageEnvelope(mounted.facade.snapshot()).units.scene.data).toEqual(beforeScene);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeEnvelopeBytes);
		expect(resolveLayoutSurface(stageEnvelope(mounted.facade.snapshot()).units.layout.data, mounted.paintedSurface)).toBe('present');
		expect(mounted.host.history()).toEqual(beforeHistory);
		expect(mounted.facade.snapshot().acceptedRevision).toEqual(beforeRevision);

		const back = await mounted.liftAction()!.run();
		expect(back).toEqual({ kind: 'accepted' });
		expect(interiorLift.isActive()).toBe(false);
		expect(mounted.liftAction()?.label).toBe('Lift');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeEnvelopeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});

	it('keeps a painted Wall-side identity and accepted Scene unchanged during a Level cut', async () => {
		const mounted = await mount();
		const beforeEnvelopeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeScene = stageEnvelope(mounted.facade.snapshot()).units.scene.data;
		const beforeHistory = mounted.host.history();
		const beforeRevision = mounted.facade.snapshot().acceptedRevision;

		sliceReading.level();
		expect(sliceReading.reading).toEqual({ kind: 'level', depth: { kind: 'to-floor' } });
		expect(resolveLayoutSurface(stageEnvelope(mounted.facade.snapshot()).units.layout.data, mounted.paintedSurface)).toBe('present');
		expect(stageEnvelope(mounted.facade.snapshot()).units.scene.data).toEqual(beforeScene);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeEnvelopeBytes);
		expect(mounted.facade.snapshot().acceptedRevision).toEqual(beforeRevision);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});

	it('narrows an Everything reading to this Space', async () => {
		const mounted = await mount();
		interiorLift.lift({ kind: 'all' });
		expect(mounted.liftAction()?.label).toBe('Lift');

		const outcome = await mounted.liftAction()!.run();
		expect(outcome).toEqual({ kind: 'accepted' });
		expect(interiorLift.reading?.scope).toEqual({ kind: 'space', roomId: mounted.roomId });
		expect(mounted.liftAction()?.label).toBe('Put back');
	});
});
