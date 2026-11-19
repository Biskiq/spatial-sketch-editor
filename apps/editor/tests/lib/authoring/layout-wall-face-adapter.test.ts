/**
 * T1 A6 — Face this Wall, through the production Layout adapter and the real F4
 * host.
 *
 * The journey pinned here is the slice's acceptance:
 *
 * 1. **Face this wall** is one scoped Card action over the landed Camera `face`
 *    intent; the Layout adapter supplies bounds and a look direction only.
 * 2. The settled view ends in 3D, framed on the Wall, from the side the creator
 *    was already looking at.
 * 3. **Put back** restores the exact entry standpoint — pose *and* reading —
 *    including a Plan entry, and writes no document and no history.
 * 4. A curved Wall and its unrolled sheet are both faced; entering Unroll moves
 *    no Camera, before or after a Face.
 * 5. Reduced motion settles the Face on the first evaluation.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	wallCubicChain,
	type CompiledPhysicalWall,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type PlanSourceRef
} from '@portfolio/layout-core';
import { SCENE_UNIT_FORMAT_VERSION, type CameraFreeSceneDocument, type ProjectEnvelope } from '@portfolio/project-model/units';
import {
	evaluateViewport,
	facePoseFromBounds,
	projectWorld,
	VIEWPORT_READING_TRANSITION_SECONDS,
	type ViewingIntent,
	type ViewportCameraState,
	type ViewportRect
} from '@portfolio/camera-core';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageCardActions } from '$lib/authoring/stage/stage-contributions';
import type { StageCardActionRecord } from '$lib/authoring/stage/stage-facade';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import { wallFace } from '$lib/authoring/layout/wall-face-store';
import { readingIntentClockSeconds } from '$lib/authoring/stage/stage-input';
import { sameInspectionPose } from '$lib/layout/wall-unfold';
import { wallFaceFrame, wallSheetFaceFrame, type WallFaceFrame } from '$lib/layout/wall-face';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';

const RECT: ViewportRect = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-a6-face';
const FLOOR_Y = 0.5;

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
	readonly wallId: string;
};

function knotsOf(...points: LayoutVec2[]): { id: string; point: LayoutVec2 }[] {
	return points.map((point, index) => ({ id: `wall-a:knot:${index + 1}`, point: [point[0], point[1]] }));
}

function straightDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.floor.elevation = FLOOR_Y;
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [6, 0] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' }
		} as LayoutWall
	];
	return document;
}

function curvedDocument(): LayoutDocumentWallFirst {
	const points: LayoutVec2[] = [[0, 0], [2, 2], [4, 2], [6, 0]];
	const document = straightDocument();
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			thickness: 0.2,
			height: 3,
			centerline: wallCubicChain(knotsOf(...points.slice(1, -1)), deriveChainSpans(points))
		} as LayoutWall
	];
	return document;
}

function scene(): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [],
		surfaceFinishes: [
			{ surface: { kind: 'wall-side', wallId: 'wall-a', side: 'left' }, finish: { materialId: 'marble-light' } },
			{ surface: { kind: 'wall-side', wallId: 'wall-a', side: 'right' }, finish: { materialId: 'velvet-dark' } }
		]
	};
}

async function mount(layout: LayoutDocumentWallFirst): Promise<Mounted> {
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'A6 face this wall',
		layout,
		scene: scene()
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-a6-face',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`A6 fixture not admitted: ${admitted.kind}`);
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
	return { facade, session, host, services, wallId: 'wall-a' };
}

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

function settle(facade: StageFacade, clockSeconds: number): void {
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
}

function submit(facade: StageFacade, intent: ViewingIntent, clockSeconds: number) {
	const first = facade.requestViewingIntent(intent, facade.inspectionTicket(), clockSeconds);
	if (first.kind !== 'superseded') return first;
	facade.acquireInspection('exclusive');
	return facade.requestViewingIntent(intent, facade.inspectionTicket(), clockSeconds);
}

/**
 * The route's Face port, without the route: the same clock and the same Camera
 * session restore Put back uses. A test that bypassed this would not prove the
 * one wiring the editor ships.
 */
function installFacePort(facade: StageFacade, options: { readonly reducedMotion?: boolean; readonly clock?: number } = {}): void {
	const clock = options.clock ?? 1;
	wallFace.setCameraPort({
		standpoint: () => facade.camera.state(),
		face: (frame: WallFaceFrame) =>
			submit(
				facade,
				{ kind: 'face', bounds: frame.bounds, look: frame.look, rect: RECT },
				readingIntentClockSeconds(options.reducedMotion === true, clock)
			).kind === 'accepted',
		putBack: (entry) => facade.camera.restoreStandpoint(entry)
	});
}

function actionsOf(facade: StageFacade, wallId: string): readonly StageCardActionRecord[] {
	return stageCardActions(facade, { sourceId: wallId, sourceKind: 'wall', ref: null });
}

function faceAction(facade: StageFacade, wallId: string): StageCardActionRecord {
	const action = actionsOf(facade, wallId).find((candidate) => candidate.id === 'layout-wall-face');
	if (action === undefined) throw new Error('Face this wall was not contributed for the selected Wall');
	return action;
}

function compiledWall(facade: StageFacade, wallId: string): CompiledPhysicalWall {
	const wall = facade.snapshot().domain.geometry.walls.find((candidate) => candidate.wallId === wallId);
	if (wall === undefined) throw new Error('the selected Wall has no compiled geometry');
	return wall;
}

function layoutBytes(facade: StageFacade): string {
	return facade.snapshot().canonicalJson;
}

/**
 * The Wall body is inside the frame: both thickness offsets at every canonical
 * sample, bottom and top. A curved Wall's axis-aligned bounds include empty
 * corners outside the curve, so the body — not the box — is the subject.
 */
function expectWallFramed(facade: StageFacade, wall: CompiledPhysicalWall, clockSeconds: number): void {
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(result.reason);
	const half = wall.thickness / 2;
	for (const sample of wall.samples) {
		for (const lateral of [-half, half]) {
			for (const y of [wall.bounds3.min[1], wall.bounds3.max[1]]) {
				const projected = projectWorld(
					[
						sample.point[0] + sample.normal[0] * lateral,
						y,
						sample.point[1] + sample.normal[1] * lateral
					],
					result.evaluation,
					result.evaluation.token
				);
				expect(projected.kind).toBe('projected');
				if (projected.kind !== 'projected') continue;
				expect(projected.visibility).toBe('visible');
				expect(projected.css[0]).toBeGreaterThanOrEqual(RECT.left);
				expect(projected.css[0]).toBeLessThanOrEqual(RECT.left + RECT.width);
				expect(projected.css[1]).toBeGreaterThanOrEqual(RECT.top);
				expect(projected.css[1]).toBeLessThanOrEqual(RECT.top + RECT.height);
			}
		}
	}
}

afterEach(() => {
	wallFace.setCameraPort(null);
	wallFace.clear();
	wallUnfold.exit();
});

describe('T1 A6 — Face this Wall', () => {
	it('[cap:layout.wall-face core] offers the real action, frames the straight Wall and puts the exact standpoint back', async () => {
		const mounted = await mount(straightDocument());
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 2);
		installFacePort(mounted.facade, { clock: 2 });
		const entry = mounted.facade.camera.state();
		const beforeBytes = layoutBytes(mounted.facade);
		const beforeHistory = mounted.host.history();

		const action = faceAction(mounted.facade, mounted.wallId);
		expect(action.label).toBe('Face this wall');
		expect(action.destructive).toBeUndefined();
		expect(action.detail).toContain('Squares the Camera');

		expect((await action.run()).kind).toBe('accepted');
		expect(mounted.facade.camera.state().reading).toBe('3d');
		expect(wallFace.isActive(mounted.wallId)).toBe(true);
		// The Camera moves; the document and history do not.
		expect(layoutBytes(mounted.facade)).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);

		settle(mounted.facade, 2 + VIEWPORT_READING_TRANSITION_SECONDS + 1);
		const wall = compiledWall(mounted.facade, mounted.wallId);
		const settled = mounted.facade.camera.state();
		expect(settled.reading).toBe('3d');
		// The target is the Wall's face the creator is on, not the box's middle.
		expect(settled.pose.target[2]).toBeCloseTo(wall.bounds3.max[2], 6);
		// Faced from the +Z side the creator was on: the eye stays outside that face.
		const evaluation = mounted.facade.evaluation()!;
		expect(evaluation.eye[2]).toBeGreaterThan(evaluation.target[2] + 0.5);
		expectWallFramed(mounted.facade, wall, 2 + VIEWPORT_READING_TRANSITION_SECONDS + 1);

		// The same action is now Put back.
		const putBack = faceAction(mounted.facade, mounted.wallId);
		expect(putBack.label).toBe('Put back');
		expect((await putBack.run()).kind).toBe('accepted');
		expect(wallFace.isActive(mounted.wallId)).toBe(false);
		const restored = mounted.facade.camera.state();
		expect(restored.reading).toBe(entry.reading);
		expect(sameInspectionPose(restored.pose, entry.pose)).toBe(true);
		expect(layoutBytes(mounted.facade)).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});

	it('restores a Plan entry standpoint after a Face that ends in 3D', async () => {
		const mounted = await mount(straightDocument());
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 2);
		expect(
			submit(mounted.facade, { kind: 'set-reading', reading: 'plan' }, 2).kind
		).toBe('accepted');
		settle(mounted.facade, 2 + VIEWPORT_READING_TRANSITION_SECONDS + 1);
		installFacePort(mounted.facade, { clock: 4 });
		const entry = mounted.facade.camera.state();
		expect(entry.reading).toBe('plan');

		expect((await faceAction(mounted.facade, mounted.wallId).run()).kind).toBe('accepted');
		settle(mounted.facade, 4 + VIEWPORT_READING_TRANSITION_SECONDS + 1);
		expect(mounted.facade.camera.state().reading).toBe('3d');

		expect((await faceAction(mounted.facade, mounted.wallId).run()).kind).toBe('accepted');
		const restored = mounted.facade.camera.state();
		expect(restored.reading).toBe('plan');
		expect(sameInspectionPose(restored.pose, entry.pose)).toBe(true);
	});

	it('faces a curved Wall at its view-centre face', async () => {
		const mounted = await mount(curvedDocument());
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 2);
		installFacePort(mounted.facade, { clock: 2 });
		const wall = compiledWall(mounted.facade, mounted.wallId);
		const expected = wallFaceFrame(wall, mounted.facade.camera.state());
		expect(expected).not.toBeNull();

		expect((await faceAction(mounted.facade, mounted.wallId).run()).kind).toBe('accepted');
		settle(mounted.facade, 2 + VIEWPORT_READING_TRANSITION_SECONDS + 1);
		expect(mounted.facade.camera.state().reading).toBe('3d');
		expectWallFramed(mounted.facade, wall, 2 + VIEWPORT_READING_TRANSITION_SECONDS + 1);

		// The settled aim is the frame's own look direction, so the Wall is faced
		// at the view-centre station rather than along the chord.
		const evaluation = mounted.facade.evaluation()!;
		const aim: [number, number, number] = [
			evaluation.target[0] - evaluation.eye[0],
			0,
			evaluation.target[2] - evaluation.eye[2]
		];
		const length = Math.hypot(aim[0], aim[2]);
		expect(aim[0] / length).toBeCloseTo(expected!.look[0], 5);
		expect(aim[2] / length).toBeCloseTo(expected!.look[2], 5);
	});

	it('enters Unroll without moving the Camera, then faces the sheet and puts the view back', async () => {
		const mounted = await mount(curvedDocument());
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 2);
		installFacePort(mounted.facade, { clock: 2 });
		const wall = compiledWall(mounted.facade, mounted.wallId);
		const beforeEntry = mounted.facade.camera.state();
		const beforeBytes = layoutBytes(mounted.facade);

		wallUnfold.enter(wall, 3, {
			pose: beforeEntry.pose,
			reading: beforeEntry.reading
		});
		wallUnfold.setU(wall, 1);
		// Entry preserves the creator's view: no fit, no orientation change.
		expect(sameInspectionPose(mounted.facade.camera.state().pose, beforeEntry.pose)).toBe(true);
		expect(mounted.facade.camera.state().reading).toBe(beforeEntry.reading);
		expect(wallUnfold.isActive(mounted.wallId)).toBe(true);

		const entry = mounted.facade.camera.state();
		const frame = wallSheetFaceFrame({
			wall,
			state: wallUnfold.state!,
			sideAngle: wallUnfold.presentationAngle,
			floorY: FLOOR_Y
		});
		expect(frame).not.toBeNull();
		expect((await faceAction(mounted.facade, mounted.wallId).run()).kind).toBe('accepted');
		settle(mounted.facade, 2 + VIEWPORT_READING_TRANSITION_SECONDS + 1);
		expect(mounted.facade.camera.state().reading).toBe('3d');
		// The sheet still sits where it did; entry and Face moved only the Camera.
		expect(wallUnfold.isActive(mounted.wallId)).toBe(true);
		expect(layoutBytes(mounted.facade)).toBe(beforeBytes);
		const evaluation = mounted.facade.evaluation()!;
		const aim: [number, number, number] = [
			evaluation.target[0] - evaluation.eye[0],
			0,
			evaluation.target[2] - evaluation.eye[2]
		];
		const length = Math.hypot(aim[0], aim[2]);
		expect(aim[0] / length).toBeCloseTo(frame!.look[0], 4);
		expect(aim[2] / length).toBeCloseTo(frame!.look[2], 4);

		expect((await faceAction(mounted.facade, mounted.wallId).run()).kind).toBe('accepted');
		expect(sameInspectionPose(mounted.facade.camera.state().pose, entry.pose)).toBe(true);
		expect(wallUnfold.isActive(mounted.wallId)).toBe(true);
	});

	it('settles a Face on the first evaluation under reduced motion', async () => {
		const mounted = await mount(straightDocument());
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 2);
		installFacePort(mounted.facade, { reducedMotion: true, clock: 2 });
		const wall = compiledWall(mounted.facade, mounted.wallId);
		const entry = mounted.facade.camera.state();
		const expected = facePoseFromBounds({
			bounds: wallFaceFrame(wall, entry)!.bounds,
			look: wallFaceFrame(wall, entry)!.look,
			rect: RECT
		})!;

		expect((await faceAction(mounted.facade, mounted.wallId).run()).kind).toBe('accepted');
		// The route's reduced-motion rule dates the intent past its endpoint, so
		// the very frame at the same clock is already the settled face.
		const result = evaluateViewport(mounted.facade.camera.state(), RECT, 2, 99);
		if (result.kind !== 'evaluated') throw new Error(result.reason);
		expect(result.evaluation.renderedReading).toBe('3d');
		expect(result.evaluation.progress).toBe(1);
		expect(result.evaluation.orthographicWeight).toBe(0);
		expect(sameInspectionPose(result.evaluation.pose, expected)).toBe(true);
	});

	it('refuses in words, and moves nothing, when the Camera port is gone', async () => {
		const mounted = await mount(straightDocument());
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 2);
		installFacePort(mounted.facade, { clock: 2 });
		const entry: ViewportCameraState = mounted.facade.camera.state();
		wallFace.setCameraPort(null);
		const outcome = await faceAction(mounted.facade, mounted.wallId).run();
		expect(outcome.kind).toBe('refused');
		expect(outcome.message).toContain('no Camera');
		expect(wallFace.isActive(mounted.wallId)).toBe(false);
		expect(sameInspectionPose(mounted.facade.camera.state().pose, entry.pose)).toBe(true);
	});
});
