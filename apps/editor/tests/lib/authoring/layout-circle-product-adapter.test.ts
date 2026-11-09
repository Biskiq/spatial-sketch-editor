/**
 * C2 product — the editor path for a closed Wall.
 *
 * These tests mount the real Layout adapter and drive the Card writer and the
 * Stage marks. Radius and diameter are exact captured intents; the radius grip
 * is the only shape mark a closed Wall publishes; no bend point is offered.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	isClosedWall,
	mintLayoutIdCapture,
	planCreateCircularRoom,
	planCreateWallFirstOpening,
	readClosedWallCircle,
	wallFirstWallLength,
	type LayoutDocumentWallFirst,
	type PlanSourceRef
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, datumWorkingPlane, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
import { createCardFieldsInstrument } from '$lib/authoring/adapters/layout/adapter-support';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-c2-circle';

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly openingId: string;
};

function circleFixture(): { document: LayoutDocumentWallFirst; wallId: string; openingId: string } {
	const created = planCreateCircularRoom({
		baseline: createEmptyWallFirstLayoutDocument(),
		center: [0, 0],
		rim: [5, 0],
		capture: mintLayoutIdCapture(() => 'c2-adapter'),
		levelId: 'floor',
		roomNamePrefix: 'Room'
	});
	if (created.kind !== 'success') throw new Error(JSON.stringify(created.rejection));
	const length = wallFirstWallLength(created.document, created.wallId)!;
	const opening = planCreateWallFirstOpening(
		created.document,
		{ wallId: created.wallId, kind: 'window', offset: length * 0.2, width: 1.2, height: 1.2, sillHeight: 1 },
		freshCapture(),
		created.document.floor.id
	);
	if (opening.kind !== 'success') throw new Error(JSON.stringify(opening.rejection));
	return { document: opening.document, wallId: created.wallId, openingId: opening.changedOpeningIds[0]! };
}

async function mount(): Promise<Mounted> {
	const { document, wallId, openingId } = circleFixture();
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'C2 circle',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-c2',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`C2 fixture not admitted: ${admitted.kind}`);
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
	return { facade, session, host, services, document, wallId, openingId };
}

function stageCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
	const snapshot = facade.snapshot();
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the fixture has no evaluation');
	const projected = facade.projectWorld(
		[point[0], snapshot.domain.datumMeters, point[1]],
		evaluationId
	);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

function armInk(facade: StageFacade) {
	const opened = facade.openContributedTask('layout-ink');
	if (opened.kind !== 'opened') throw new Error(`Ink did not arm: ${opened.message}`);
	const surface = inkSurface();
	if (surface === null) throw new Error('Ink published no surface while its task was open');
	return surface.controller;
}

async function eventually(check: () => boolean, attempts = 80): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('condition never became true');
}

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
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

describe('C2 product — closed Wall Card and Stage', () => {
	it('offers radius and diameter fields and publishes only the radius grip', async () => {
		const { facade, services, wallId } = await mount();
		selectWall(facade, wallId);
		const instrument = createCardFieldsInstrument(services)!;
		const fields = instrument.fields().map((field) => field.id);
		expect(fields).toContain('radius');
		expect(fields).toContain('diameter');
		const marks = facade.marks();
		expect(marks.some((mark) => mark.id === 'layout-circle-radius-mark')).toBe(true);
		expect(marks.some((mark) => mark.id.startsWith('layout-wall-knot:'))).toBe(false);
		expect(marks.some((mark) => mark.id.startsWith('layout-wall-span:'))).toBe(false);
	});

	it('creates a Circle from a centre → rim drag with the seam at the authored rim', async () => {
		const { facade, host, document } = await mount();
		const baseline = facade.snapshot().canonicalJson;
		const controller = armInk(facade);
		controller.setWallMode('circle');
		const evaluationId = facade.evaluationId()!;
		const center = stageCss(facade, [20, 0]);
		const rim = stageCss(facade, [23, 0]);
		expect(facade.pointerIntent({ phase: 'down', css: center, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: stageCss(facade, [21.5, 0]), evaluationId });
		facade.pointerIntent({ phase: 'move', css: rim, evaluationId });
		facade.pointerIntent({ phase: 'up', css: rim, evaluationId });
		await eventually(() => facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(facade);
		const created = layout.walls.find(
			(wall) => !document.walls.some((known) => known.id === wall.id)
		);
		expect(created).toBeDefined();
		expect(isClosedWall(created!)).toBe(true);
		const seam = layout.junctions.find((junction) => junction.id === created!.startJunctionId)!;
		expect(seam.point[0]).toBeCloseTo(23, 6);
		expect(seam.point[1]).toBeCloseTo(0, 6);
		expect(readClosedWallCircle(layout, created!.id)!.radius).toBeCloseTo(3, 6);
		expect(layout.rooms).toHaveLength(2);
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });

		// The whole gesture is one Undo, exactly like every other authored chain.
		expect((await host.undo()).kind).toBe('installed');
		expect(acceptedLayout(facade).walls).toHaveLength(document.walls.length);
	});

	it('resizes a Circle by dragging its radius grip to the new rim', async () => {
		const { facade, host, wallId } = await mount();
		selectWall(facade, wallId);
		const evaluationId = facade.evaluationId()!;
		const seam = stageCss(facade, [5, 0]);
		const nextRim = stageCss(facade, [7, 0]);
		expect(
			facade.pointerIntent({
				phase: 'down',
				css: seam,
				evaluationId,
				handleId: 'layout-circle-radius-mark'
			}).claimed
		).toBe(true);
		facade.pointerIntent({ phase: 'move', css: nextRim, evaluationId });
		facade.pointerIntent({ phase: 'up', css: nextRim, evaluationId });
		await eventually(() => Math.abs(readClosedWallCircle(acceptedLayout(facade), wallId)!.radius - 7) < 0.05);

		expect(readClosedWallCircle(acceptedLayout(facade), wallId)!.radius).toBeCloseTo(7, 6);
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('translates a Circle by body drag and never bends it', async () => {
		const { facade, host, wallId, openingId } = await mount();
		selectWall(facade, wallId);
		const evaluationId = facade.evaluationId()!;
		const before = acceptedLayout(facade);
		const beforeFacts = readClosedWallCircle(before, wallId)!;
		const beforeOpening = before.openings.find((opening) => opening.id === openingId)!;
		const from = stageCss(facade, [0, 5]);
		const to = stageCss(facade, [0, 7]);
		expect(facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => Math.abs(readClosedWallCircle(acceptedLayout(facade), wallId)!.center[1] - 2) < 0.05);

		const after = acceptedLayout(facade);
		const afterFacts = readClosedWallCircle(after, wallId)!;
		expect(afterFacts.center[0]).toBeCloseTo(beforeFacts.center[0], 6);
		expect(afterFacts.center[1]).toBeCloseTo(beforeFacts.center[1] + 2, 6);
		expect(afterFacts.radius).toBeCloseTo(beforeFacts.radius, 6);
		expect(after.openings.find((opening) => opening.id === openingId)!.offset).toBe(beforeOpening.offset);
		expect(after.rooms).toHaveLength(1);
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('commits an exact radius while preserving Opening station and width', async () => {
		const { facade, host, services, wallId, openingId } = await mount();
		selectWall(facade, wallId);
		const before = stageEnvelope(facade.snapshot()).units.layout.data;
		const beforeLength = wallFirstWallLength(before, wallId)!;
		const beforeOpening = before.openings.find((opening) => opening.id === openingId)!;
		const beforeRatio = beforeOpening.offset / beforeLength;
		const instrument = createCardFieldsInstrument(services)!;
		instrument.edit('radius', '7.5');
		expect(await instrument.commit('radius')).toEqual({ kind: 'accepted' });
		const after = stageEnvelope(facade.snapshot()).units.layout.data;
		const facts = readClosedWallCircle(after, wallId)!;
		expect(facts.radius).toBeCloseTo(7.5, 12);
		const afterLength = wallFirstWallLength(after, wallId)!;
		const afterOpening = after.openings.find((opening) => opening.id === openingId)!;
		expect(afterOpening.width).toBe(beforeOpening.width);
		expect(afterOpening.offset / afterLength).toBeCloseTo(beforeRatio, 12);
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await host.undo()).kind).toBe('installed');
		expect(readClosedWallCircle(stageEnvelope(facade.snapshot()).units.layout.data, wallId)!.radius).toBeCloseTo(5, 12);
	});

	it('commits a diameter as half its value and refuses an invalid radius explicitly', async () => {
		const { facade, services, wallId } = await mount();
		selectWall(facade, wallId);
		const instrument = createCardFieldsInstrument(services)!;
		instrument.edit('diameter', '14');
		expect(await instrument.commit('diameter')).toEqual({ kind: 'accepted' });
		expect(readClosedWallCircle(stageEnvelope(facade.snapshot()).units.layout.data, wallId)!.radius).toBeCloseTo(7, 12);
		const refused = createCardFieldsInstrument(services)!;
		refused.edit('radius', '0.05');
		const outcome = await refused.commit('radius');
		expect(outcome.kind).toBe('refused');
		// A diameter is converted to radius, so an invalid diameter refuses through
		// the same planner instead of writing a clamped value.
		const refusedDiameter = createCardFieldsInstrument(services)!;
		refusedDiameter.edit('diameter', '0.1');
		expect((await refusedDiameter.commit('diameter')).kind).toBe('refused');
		expect(readClosedWallCircle(stageEnvelope(facade.snapshot()).units.layout.data, wallId)!.radius).toBeCloseTo(7, 12);
	});
});
