/**
 * T1 A3 — Direct Arc Wall drawing through the production Layout adapter.
 *
 * This is the mounted acceptance journey: the real F4 host, coordinator and
 * Layout adapter, with Ink armed through its published controller. It pins:
 *
 * 1. Arc is a Wall reading mode and publishes live rise/radius measurements;
 * 2. a zero bulge refuses in words without writing or adding history;
 * 3. the third activation accepts one open canonical `cubic-chain` Wall once;
 * 4. the accepted Wall selects, Undoes, Redoes and round-trips through Save/Load;
 * 5. a below-minimum rise commits the straight Line fallback;
 * 6. an Arc that closes an open shell reconciles an ordinary Room.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { captureUnitSave, readUnitEnvelopeForSave } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import {
	createStageAcceptanceHost,
	type StageAcceptanceHost
} from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { inkSurface, type InkController } from '$lib/authoring/adapters/layout/ink';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-a3-arc';
const ELEVATION = 0.5;

type Mounted = {
	readonly facade: StageFacade;
	readonly host: StageAcceptanceHost;
	readonly document: LayoutDocumentWallFirst;
};

function emptyDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.floor.elevation = ELEVATION;
	return document;
}

/** The open shell the closing Arc completes: three Walls, gap from (0,4) to (0,0). */
function openShellDocument(): LayoutDocumentWallFirst {
	const document = emptyDocument();
	const shell = planWallChain({
		baseline: document,
		points: [
			[0, 0],
			[4, 0],
			[4, 4],
			[0, 4]
		],
		close: false,
		capture: freshCapture(),
		levelId: document.floor.id
	});
	if (shell.kind !== 'success') throw new Error(`the A3 shell was refused: ${shell.rejection.message}`);
	return shell.document;
}

async function mount(document: LayoutDocumentWallFirst): Promise<Mounted> {
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'A3 Arc',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-a3-arc',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`A3 fixture not admitted: ${admitted.kind}`);
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
	return { facade, host, document };
}

function armInk(facade: StageFacade): InkController {
	const opened = facade.openContributedTask('layout-ink');
	if (opened.kind !== 'opened') throw new Error(`Ink did not arm: ${opened.message}`);
	const surface = inkSurface();
	if (surface === null) throw new Error('Ink published no surface while its task was open');
	return surface.controller;
}

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

function stageCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the A3 fixture has no evaluation');
	const projected = facade.projectWorld([point[0], ELEVATION, point[1]], evaluationId);
	if (projected.kind !== 'projected') throw new Error('the A3 point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

function click(facade: StageFacade, point: readonly [number, number]): void {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the A3 fixture has no evaluation');
	const css = stageCss(facade, point);
	const down = facade.pointerIntent({ phase: 'down', css, evaluationId });
	expect(down.claimed).toBe(true);
	facade.pointerIntent({ phase: 'up', css, evaluationId });
}

function hover(facade: StageFacade, point: readonly [number, number]): void {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the A3 fixture has no evaluation');
	facade.hoverIntent({ phase: 'move', css: stageCss(facade, point), evaluationId });
}

async function eventually(check: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('the A3 condition never became true');
}

function createdWall(mounted: Mounted): LayoutDocumentWallFirst['walls'][number] {
	const layout = acceptedLayout(mounted.facade);
	const created = layout.walls.find(
		(wall) => !mounted.document.walls.some((known) => known.id === wall.id)
	);
	if (created === undefined) throw new Error('the Arc accepted no new Wall');
	return created;
}

describe('T1 A3 — Arc drawing', () => {
	it('[cap:layout.wall-arc core] measures a live Arc, refuses a zero bulge, and commits one cubic-chain Wall through Undo, Redo and Save/Load', async () => {
		const mounted = await mount(emptyDocument());
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		const controller = armInk(mounted.facade);
		controller.setWallMode('arc');
		expect(inkSurface()!.snapshot().wallMode).toBe('arc');

		controller.typePoint('0', '0');
		controller.typePoint('4', '0');

		// A third activation on the chord names no bulge: words, no write.
		click(mounted.facade, [2, 0]);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		// The live chain still holds its proposal lease, so the unavailable-reason
		// words differ; the depth and position prove no entry was added.
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth,
			position: beforeHistory.position
		});
		expect(inkSurface()!.snapshot().refusal).toContain('bulge');

		// The live bulge publishes the exact rise and radius before acceptance.
		hover(mounted.facade, [2, 1]);
		const live = inkSurface()!.snapshot();
		expect(live.arc).not.toBeNull();
		expect(live.arc!.chord).toBeCloseTo(4, 1);
		expect(live.arc!.rise).toBeCloseTo(1, 1);
		expect(live.arc!.radius).toBeCloseTo(2.5, 1);
		expect(live.arc!.belowMinimum).toBe(false);

		// The third activation accepts one open canonical Wall.
		click(mounted.facade, [2, 1]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== beforeBytes);
		const wall = createdWall(mounted);
		expect(wall.centerline.kind).toBe('cubic-chain');
		if (wall.centerline.kind !== 'cubic-chain') throw new Error('the Arc fell back to a line');
		expect(wall.centerline.knots).toHaveLength(0);
		expect(wall.centerline.spans).toHaveLength(1);
		expect(acceptedLayout(mounted.facade).rooms).toHaveLength(0);
		expect(mounted.facade.selection()?.sourceId).toBe(wall.id);
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});

		// One gesture, one history entry: Undo restores the exact bytes; Redo
		// replays the captured identity and the same Wall id.
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(acceptedLayout(mounted.facade).walls.some((candidate) => candidate.id === wall.id)).toBe(true);

		// The accepted Arc is an ordinary canonical document: Save/Load admits it unchanged.
		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'a3-arc-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-a3-arc-roundtrip',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		expect(stageEnvelope(readmitted.snapshot).units).toEqual(stageEnvelope(mounted.facade.snapshot()).units);
	});

	it('[cap:layout.wall-arc core] commits the straight Line fallback below the minimum rise', async () => {
		const mounted = await mount(emptyDocument());
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		controller.setWallMode('arc');
		controller.typePoint('8', '0');
		controller.typePoint('12', '0');

		hover(mounted.facade, [10, 0.01]);
		const live = inkSurface()!.snapshot();
		expect(live.arc).not.toBeNull();
		expect(live.arc!.rise).toBeCloseTo(0.01, 3);
		expect(live.arc!.belowMinimum).toBe(true);

		click(mounted.facade, [10, 0.01]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== beforeBytes);
		const wall = createdWall(mounted);
		expect(wall.centerline.kind).toBe('line');
		expect(acceptedLayout(mounted.facade).rooms).toHaveLength(0);
	});

	it('[cap:layout.wall-arc core] closes an open shell with an Arc and reconciles an ordinary Room', async () => {
		const mounted = await mount(openShellDocument());
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		controller.setWallMode('arc');
		// The shell's own Junctions are the declared endpoints of the closing Arc.
		controller.typePoint('0', '4');
		controller.typePoint('0', '0');

		hover(mounted.facade, [-1, 2]);
		const live = inkSurface()!.snapshot();
		expect(live.consequence).toContain('Room');

		click(mounted.facade, [-1, 2]);
		await eventually(() => acceptedLayout(mounted.facade).rooms.length === 1);
		const layout = acceptedLayout(mounted.facade);
		const wall = createdWall(mounted);
		expect(wall.centerline.kind).toBe('cubic-chain');
		expect(layout.rooms).toHaveLength(1);
		expect(layout.rooms[0]!.boundary).toHaveLength(4);
		expect(layout.rooms[0]!.boundary.some((ref) => ref.wallId === wall.id)).toBe(true);
		expect(mounted.facade.snapshot().canonicalJson).not.toBe(beforeBytes);
	});
});
