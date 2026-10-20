/**
 * T1.P01.S05 — existing straight-Wall manipulation.
 *
 * The suite drives the **real** F4 acceptance host and the production Layout
 * adapter; nothing here injects a source or a test-only install path. It pins
 * the slice's criteria:
 *
 * 1. exact length/angle (explicit fixed endpoint) and rigid translation are the
 *    retained planners' work, with the planner's own refusals and no partial write;
 * 2. the pointer path and the typed path produce the **same** canonical document
 *    for the same explicit parameter, and one gesture is one history entry;
 * 3. Esc, pointer cancel, a reading flip and an ended task change no document and
 *    add no history entry; a reading flip preserves the proposal instead of
 *    silently committing it;
 * 4. shared-Junction invalidity rejects atomically, and identities survive the
 *    supported operations;
 * 5. inactive helpers cannot pick.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	type LayoutDocumentWallFirst,
	type PlanSourceRef
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import {
	createLayoutInstrument,
	type LayoutInstrument
} from '$lib/authoring/adapters/layout/instrument';
import {
	createDimensionsInstrument,
	layoutDimensionsInput
} from '$lib/authoring/adapters/layout/adapter-support';
import {
	LAYOUT_WALL_ANGLE_KIND,
	LAYOUT_WALL_LENGTH_KIND,
	LAYOUT_WALL_MOVE_KIND,
	wallFrame,
	wallManipulationIntent
} from '$lib/authoring/adapters/layout/precision';
import {
	pickWallHandle,
	pointerWallRequest,
	wallHandleFixedEndpoint
} from '$lib/authoring/adapters/layout/wall-gesture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-s05';
const ELEVATION = 0.5;

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly openingId: string;
};

/**
 * The S04 enclosure, reused on purpose: every Wall shares its endpoints with a
 * neighbour and the first Wall hosts an Opening, so identity, Opening and Room
 * preservation are exercised by the same fixture the precision slice used.
 */
function fixtureDocument(): { document: LayoutDocumentWallFirst; wallId: string; openingId: string } {
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
		role: 'boundary'
	});
	if (chained.kind !== 'success') throw new Error('the S05 enclosure was refused');
	const wallId = chained.document.walls[0]!.id;
	const opening = planCreateWallFirstOpening(chained.document, {
		wallId,
		kind: 'window',
		offset: 1,
		width: 1.2,
		height: 1.2,
		sillHeight: 1
	});
	if (opening.kind === 'rejected') throw new Error(`opening fixture refused: ${opening.rejection.message}`);
	return { document: opening.document, wallId, openingId: opening.changedOpeningIds[0]! };
}

async function mount(): Promise<Mounted> {
	const { document, wallId, openingId } = fixtureDocument();
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'S05 wall manipulation',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-s05',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`S05 fixture not admitted: ${admitted.kind}`);
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
	facade.setSelection({
		ordered: [{ reference, representation }],
		primary: reference
	});
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

async function eventually(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('the fixture did not settle');
}

function typedInstrument(mounted: Mounted): LayoutInstrument {
	selectWall(mounted.facade, mounted.wallId);
	const instrument = createLayoutInstrument({
		subject: { kind: 'wall', id: mounted.wallId },
		document: mounted.document,
		projectId: PROJECT_ID,
		contentRevision: mounted.facade.snapshot().domain.unitRevisions.layout,
		port: mounted.services.authoring
	});
	return instrument;
}

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

function wallPoints(document: LayoutDocumentWallFirst, wallId: string): {
	readonly start: readonly [number, number];
	readonly end: readonly [number, number];
	readonly length: number;
} {
	const frame = wallFrame(document, wallId);
	if (frame === null) throw new Error('the fixture wall has no straight frame');
	return { start: frame.start, end: frame.end, length: frame.length };
}

describe('T1.P01.S05 — existing straight-Wall manipulation planners', () => {
	it('registers one planner per Wall operation and refuses bad payloads and wrong addressees', async () => {
		const { host, facade, wallId } = await mount();
		const kinds = host.coordinator().planners().map((planner) => planner.kind);
		expect(kinds).toEqual(
			expect.arrayContaining([LAYOUT_WALL_LENGTH_KIND, LAYOUT_WALL_ANGLE_KIND, LAYOUT_WALL_MOVE_KIND])
		);
		const snapshot = facade.snapshot();
		const reference = {
			version: 1 as const,
			domain: 'layout' as const,
			revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
			subject: { kind: 'wall' as const, id: wallId },
			instancePath: [],
			location: {
				kind: 'layout-location' as const,
				levelId: snapshot.domain.layoutLevelId,
				structureInstancePath: []
			},
			componentId: null,
			capabilityId: null
		};
		const base = {
			version: 1 as const,
			expectedRevision: snapshot.acceptedRevision,
			targets: [reference],
			capturedInputs: [],
			allocatedIds: []
		};

		// Non-finite length, an unknown payload key, and an angle that is not a
		// number all refuse before a candidate exists.
		expect(
			await host.accept({ ...base, kind: LAYOUT_WALL_LENGTH_KIND, operationId: 'bad-length', payload: { wallId, length: Number.POSITIVE_INFINITY, fixed: 'start' } })
		).toMatchObject({ kind: 'refused' });
		expect(
			await host.accept({ ...base, kind: LAYOUT_WALL_LENGTH_KIND, operationId: 'bad-key', payload: { wallId, length: 5, fixed: 'start', keepBottom: true } })
		).toMatchObject({ kind: 'refused' });
		expect(
			await host.accept({ ...base, kind: LAYOUT_WALL_ANGLE_KIND, operationId: 'bad-angle', payload: { wallId, angleRadians: 'ninety', fixed: 'start' } })
		).toMatchObject({ kind: 'refused' });
		expect(
			await host.accept({ ...base, kind: LAYOUT_WALL_MOVE_KIND, operationId: 'bad-move', payload: { wallId, deltaX: Number.NaN, deltaZ: 0 } })
		).toMatchObject({ kind: 'refused' });
		// A zero translation is not an error, it is a no-op: the planner accepts it
		// and F.4 records no history entry, rather than inventing a refusal.
		expect(
			await host.accept({ ...base, kind: LAYOUT_WALL_MOVE_KIND, operationId: 'zero-move', payload: { wallId, deltaX: 0, deltaZ: 0 } })
		).toMatchObject({ kind: 'no-op' });

		// The intent must address the Wall it edits: a target naming another Wall
		// is refused even though the payload names this one.
		const otherWall = stageEnvelope(facade.snapshot()).units.layout.data.walls[1]!;
		const otherReference = { ...reference, subject: { kind: 'wall' as const, id: otherWall.id } };
		expect(
			await host.accept({
				...base,
				kind: LAYOUT_WALL_LENGTH_KIND,
				operationId: 'wrong-addressee',
				targets: [otherReference],
				payload: { wallId, length: 5, fixed: 'start' }
			})
		).toMatchObject({ kind: 'refused' });
		// Nothing was written by any refusal.
		expect(host.history()).toMatchObject({ depth: 1, position: 0 });
	});
});

describe('T1.P01.S05 — typed Wall manipulation', () => {
	it('honours the explicit fixed endpoint and writes exactly one history entry', async () => {
		const mounted = await mount();
		const instrument = typedInstrument(mounted);
		const before = wallPoints(mounted.document, mounted.wallId);
		instrument.setFixedEndpoint('end');
		instrument.edit('length', '5');
		expect(await instrument.commit('length')).toEqual({ kind: 'accepted' });
		const after = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
		// `end` stays exactly where it was; `start` moves to keep the Wall 5 m long.
		expect(after.end[0]).toBeCloseTo(before.end[0], 9);
		expect(after.end[1]).toBeCloseTo(before.end[1], 9);
		expect(after.length).toBeCloseTo(5, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('sets an exact angle in degrees and preserves the Wall length and identity', async () => {
		const mounted = await mount();
		const instrument = typedInstrument(mounted);
		const before = wallPoints(mounted.document, mounted.wallId);
		instrument.setFixedEndpoint('start');
		instrument.edit('angle', '5');
		expect(await instrument.commit('angle')).toEqual({ kind: 'accepted' });
		const layout = acceptedLayout(mounted.facade);
		const frame = wallFrame(layout, mounted.wallId);
		if (frame === null) throw new Error('the accepted Wall lost its frame');
		expect(frame.length).toBeCloseTo(before.length, 9);
		expect((frame.angleRadians * 180) / Math.PI).toBeCloseTo(5, 6);
		// The Wall and its hosted Opening keep their identities.
		expect(layout.walls.some((wall) => wall.id === mounted.wallId)).toBe(true);
		expect(layout.openings.some((opening) => opening.id === mounted.openingId)).toBe(true);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('translates rigidly from both deltas as one intent, then clears the deltas', async () => {
		const mounted = await mount();
		const instrument = typedInstrument(mounted);
		const before = wallPoints(mounted.document, mounted.wallId);
		instrument.edit('deltaX', '0.25');
		instrument.edit('deltaZ', '0.5');
		expect(await instrument.commit('deltaX')).toEqual({ kind: 'accepted' });
		const after = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
		expect(after.start[0]).toBeCloseTo(before.start[0] + 0.25, 9);
		expect(after.start[1]).toBeCloseTo(before.start[1] + 0.5, 9);
		expect(after.end[0]).toBeCloseTo(before.end[0] + 0.25, 9);
		expect(after.end[1]).toBeCloseTo(before.end[1] + 0.5, 9);
		expect(after.length).toBeCloseTo(before.length, 9);
		// One gesture, one entry — not one entry per delta field.
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		// The consumed deltas return to zero, so the next Enter cannot move again.
		expect(instrument.fields().find((field) => field.id === 'deltaX')?.text).toBe('0');
		expect(instrument.fields().find((field) => field.id === 'deltaZ')?.text).toBe('0');
	});

	it('never commits blank input on blur or Esc, and starts from an explicit start endpoint', async () => {
		const mounted = await mount();
		const instrument = typedInstrument(mounted);
		expect(instrument.fixedEndpoint()).toBe('start');
		const port = { ...mounted.services.authoring, accept: async () => { throw new Error('no write expected'); } };
		const noWrite = createLayoutInstrument({
			subject: { kind: 'wall', id: mounted.wallId },
			document: mounted.document,
			projectId: PROJECT_ID,
			contentRevision: mounted.facade.snapshot().domain.unitRevisions.layout,
			port
		});
		noWrite.edit('length', '   ');
		expect(await noWrite.commit('length')).toMatchObject({ kind: 'invalid', code: 'blank' });
		noWrite.edit('angle', '');
		expect(await noWrite.commit('angle')).toMatchObject({ kind: 'invalid', code: 'blank' });
		noWrite.edit('length', '4');
		expect(noWrite.blur('length')?.text).toBe('6');
		noWrite.edit('angle', '30');
		expect(noWrite.cancel('angle')?.text).toBe('0');
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('rejects a shared-Junction-invalid angle atomically and keeps every identity', async () => {
		const mounted = await mount();
		const instrument = typedInstrument(mounted);
		const layout = acceptedLayout(mounted.facade);
		const wallsBefore = layout.walls.map((wall) => wall.id);
		const junctionsBefore = layout.junctions.map((junction) => `${junction.id}:${junction.point.join(',')}`);
		const before = wallPoints(mounted.document, mounted.wallId);
		instrument.setFixedEndpoint('start');
		// 90° folds this Wall onto its shared west boundary: the candidate is not a
		// valid enclosure, and the retained planner must refuse rather than clip.
		instrument.edit('angle', '90');
		const outcome = await instrument.commit('angle');
		expect(outcome.kind).toBe('refused');
		const after = acceptedLayout(mounted.facade);
		expect(after.walls.map((wall) => wall.id)).toEqual(wallsBefore);
		expect(after.junctions.map((junction) => `${junction.id}:${junction.point.join(',')}`)).toEqual(junctionsBefore);
		expect(wallPoints(after, mounted.wallId).end[1]).toBeCloseTo(before.end[1], 12);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});
});

describe('T1.P01.S05 — pointer Wall manipulation', () => {
	it('commits the same document as the typed length, with one history entry', async () => {
		const mounted = await mount();
		// Typed reference first, then Undo back to the exact accepted baseline.
		const typed = typedInstrument(mounted);
		typed.setFixedEndpoint('start');
		typed.edit('length', '5');
		expect(await typed.commit('length')).toEqual({ kind: 'accepted' });
		const typedLayout = acceptedLayout(mounted.facade);
		expect((await mounted.host.undo()).kind).toBe('installed');

		settle(mounted.facade, 3);
		selectWall(mounted.facade, mounted.wallId);
		const opened = mounted.facade.openContributedTask('layout-dimensions');
		expect(opened).toMatchObject({ kind: 'opened' });
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		const lengthCss = stageCss(mounted.facade, [5, 0]);

		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: lengthCss, evaluationId });
		// The preview is the planner's candidate, not a second interpolation.
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Length 5.000 m'))).toBe(true);
		// The edited junction also reshapes the neighbour that shares it; the overlay
		// names that reach instead of leaving canonical validation as the only evidence.
		const neighbour = mounted.document.walls.find((wall) => wall.id !== mounted.wallId)!;
		expect(
			mounted.facade.overlays().some((marker) => marker.label.includes(`Neighbour ${neighbour.id}`))
		).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: lengthCss, evaluationId });
		// Undo left the same depth at position 0; the pointer commit must move the
		// position, not merely preserve a depth that was already there. The
		// coordinator bumps history *before* the Stage install, so wait for the
		// installed geometry, not the cursor: a heavy parallel run otherwise reads
		// the previous snapshot.
		await eventually(() => {
			const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			return frame !== null && Math.abs(frame.length - 5) < 1e-6;
		});

		const pointerLayout = acceptedLayout(mounted.facade);
		// Same document within the contract's numeric tolerance. The pointer inverse
		// normalizes a direction, so the last bit of a float is not an identity claim.
		const pointerPoints = wallPoints(pointerLayout, mounted.wallId);
		const typedPoints = wallPoints(typedLayout, mounted.wallId);
		expect(pointerPoints.length).toBeCloseTo(typedPoints.length, 9);
		expect(pointerPoints.start[0]).toBeCloseTo(typedPoints.start[0], 9);
		expect(pointerPoints.start[1]).toBeCloseTo(typedPoints.start[1], 9);
		expect(pointerPoints.end[0]).toBeCloseTo(typedPoints.end[0], 9);
		expect(pointerPoints.end[1]).toBeCloseTo(typedPoints.end[1], 9);
		expect(pointerLayout.walls.map((wall) => wall.id)).toEqual(typedLayout.walls.map((wall) => wall.id));
		expect(pointerLayout.openings.map((opening) => opening.id)).toEqual(
			typedLayout.openings.map((opening) => opening.id)
		);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(mounted.session.gesture()).toBeNull();
	});

	it('shift-drags an endpoint to an exact angle and commits it once', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.openContributedTask('layout-dimensions').kind).toBe('opened');
		const before = wallPoints(mounted.document, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		// A shift-drag on the end handle keeps the start fixed and names the angle
		// of the line from that fixed endpoint, at the Wall's existing length.
		const radians = (5 * Math.PI) / 180;
		const target: readonly [number, number] = [
			before.length * Math.cos(radians),
			before.length * Math.sin(radians)
		];
		const endCss = stageCss(mounted.facade, before.end);
		const angleCss = stageCss(mounted.facade, target);

		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: angleCss, evaluationId, shift: true });
		// The preview names the exact angle the planner solved, not a raw drag.
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Angle 5.0°'))).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: angleCss, evaluationId, shift: true });
		await eventually(() => {
			const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			return frame !== null && Math.abs((frame.angleRadians * 180) / Math.PI - 5) < 1e-6;
		});

		const layout = acceptedLayout(mounted.facade);
		const frame = wallFrame(layout, mounted.wallId);
		if (frame === null) throw new Error('the accepted Wall lost its frame');
		expect((frame.angleRadians * 180) / Math.PI).toBeCloseTo(5, 6);
		expect(frame.length).toBeCloseTo(before.length, 9);
		// The fixed endpoint did not move.
		expect(frame.start[0]).toBeCloseTo(before.start[0], 9);
		expect(frame.start[1]).toBeCloseTo(before.start[1], 9);
		expect(layout.openings.some((opening) => opening.id === mounted.openingId)).toBe(true);
		// One gesture, one history result.
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(mounted.session.gesture()).toBeNull();
	});

	it('refuses a length dragged across the fixed start endpoint and commits nothing', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.openContributedTask('layout-dimensions').kind).toBe('opened');
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		// Beyond the fixed start: a magnitude would preview/commit a 1 m Wall on the
		// opposite side of the hand, which the pointer never named.
		const crossedCss = stageCss(mounted.facade, [-1, 0]);

		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: crossedCss, evaluationId });
		expect(
			mounted.facade.overlays().some((marker) => marker.label.includes('Drag the endpoint back'))
		).toBe(true);
		expect(mounted.facade.overlays().some((marker) => marker.label.startsWith('Length'))).toBe(false);
		mounted.facade.pointerIntent({ phase: 'up', css: crossedCss, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(wallPoints(acceptedLayout(mounted.facade), mounted.wallId)).toEqual(
			wallPoints(mounted.document, mounted.wallId)
		);
	});

	it('refuses a length dragged across the fixed end endpoint and commits nothing', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.openContributedTask('layout-dimensions').kind).toBe('opened');
		const evaluationId = mounted.facade.evaluationId()!;
		// Dragging the start fixes the **end**; the pointer beyond the end is the
		// same crossing in the opposite fixed-endpoint case.
		const startCss = stageCss(mounted.facade, [0, 0]);
		const crossedCss = stageCss(mounted.facade, [7, 0]);

		expect(mounted.facade.pointerIntent({ phase: 'down', css: startCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: crossedCss, evaluationId });
		expect(
			mounted.facade.overlays().some((marker) => marker.label.includes('Drag the endpoint back'))
		).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: crossedCss, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(wallPoints(acceptedLayout(mounted.facade), mounted.wallId)).toEqual(
			wallPoints(mounted.document, mounted.wallId)
		);
	});

	it('translates the body rigidly from the pointer delta', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.openContributedTask('layout-dimensions').kind).toBe('opened');
		const before = wallPoints(mounted.document, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const middle = stageCss(mounted.facade, [3, 0]);
		const shifted = stageCss(mounted.facade, [3.5, 0.5]);

		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Move ΔX'))).toBe(true);
		// A body drag moves **both** junctions, so every Wall sharing either endpoint
		// is reshaped. The overlay must name the full reach, not only the neighbour
		// of the endpoint the length path would have moved.
		const edited = mounted.document.walls.find((wall) => wall.id === mounted.wallId)!;
		const shared = mounted.document.walls.filter(
			(wall) =>
				wall.id !== mounted.wallId &&
				[wall.startJunctionId, wall.endJunctionId].some((junctionId) =>
					[edited.startJunctionId, edited.endJunctionId].includes(junctionId)
				)
		);
		expect(shared.length).toBe(2);
		for (const neighbour of shared) {
			expect(mounted.facade.overlays().some((marker) => marker.label.includes(`Neighbour ${neighbour.id}`))).toBe(
				true
			);
		}
		mounted.facade.pointerIntent({ phase: 'up', css: shifted, evaluationId });
		await eventually(() => {
			const points = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
			return Math.abs(points.start[0] - (before.start[0] + 0.5)) < 1e-5;
		});
		const after = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
		expect(after.start[0]).toBeCloseTo(before.start[0] + 0.5, 5);
		expect(after.start[1]).toBeCloseTo(before.start[1] + 0.5, 5);
		expect(after.end[0]).toBeCloseTo(before.end[0] + 0.5, 5);
		expect(after.end[1]).toBeCloseTo(before.end[1] + 0.5, 5);
		expect(after.length).toBeCloseTo(before.length, 9);
	});

	it('cancels with no document change and releases the gesture lease', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.openContributedTask('layout-dimensions').kind).toBe('opened');
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted.facade, [3, 0]), evaluationId });
		expect(mounted.facade.pointerIntent({ phase: 'cancel', css: endCss, evaluationId }).claimed).toBe(true);
		expect(mounted.session.gesture()).toBeNull();
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(wallPoints(acceptedLayout(mounted.facade), mounted.wallId)).toEqual(
			wallPoints(mounted.document, mounted.wallId)
		);
	});

	it('pauses on a reading flip, keeps the proposal, and never commits on the stale up', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.openContributedTask('layout-dimensions').kind).toBe('opened');
		const firstId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId: firstId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted.facade, [5, 0]), evaluationId: firstId });

		// A new evaluation is the reading flip: the CSS the gesture measured is not
		// the CSS that is drawn any more.
		settle(mounted.facade, 4);
		const secondId = mounted.facade.evaluationId()!;
		expect(secondId).not.toBe(firstId);
		expect(mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted.facade, [4, 0]), evaluationId: secondId }).claimed).toBe(true);
		expect(mounted.facade.pointerIntent({ phase: 'up', css: stageCss(mounted.facade, [4, 0]), evaluationId: secondId }).claimed).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(wallPoints(acceptedLayout(mounted.facade), mounted.wallId)).toEqual(
			wallPoints(mounted.document, mounted.wallId)
		);
		// The proposal is preserved and named, not silently discarded.
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Paused after a reading change'))).toBe(true);
	});

	it('resumes a paused angle proposal at the exact captured value and adds one history entry', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.openContributedTask('layout-dimensions').kind).toBe('opened');
		const firstId = mounted.facade.evaluationId()!;
		// A value the overlay's display rounding would lose; Resume must use the
		// captured request, not re-parse the label.
		const degrees = 5.123456;
		const radians = (degrees * Math.PI) / 180;
		const frame = wallFrame(mounted.document, mounted.wallId)!;
		const target: readonly [number, number] = [
			frame.length * Math.cos(radians),
			frame.length * Math.sin(radians)
		];
		const endCss = stageCss(mounted.facade, frame.end);
		const targetCss = stageCss(mounted.facade, target);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId: firstId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: targetCss, evaluationId: firstId, shift: true });

		// A reading flip ends the writer and preserves the exact parameter. The
		// stale release cannot commit it.
		settle(mounted.facade, 4);
		const secondId = mounted.facade.evaluationId()!;
		mounted.facade.pointerIntent({ phase: 'move', css: targetCss, evaluationId: secondId, shift: true });
		mounted.facade.pointerIntent({ phase: 'up', css: targetCss, evaluationId: secondId, shift: true });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Paused after a reading change'))).toBe(true);

		const instrument = createDimensionsInstrument(mounted.services)!;
		const paused = instrument.pausedProposal();
		if (paused === null) throw new Error('the reading flip preserved no proposal');
		// The captured request is what Resume submits: an exact float, not the
		// degrees label a re-parse would have to round-trip through.
		if (paused.request.kind !== 'angle') throw new Error('the paused proposal is not an angle');
		const accept = vi.spyOn(mounted.services.authoring, 'accept');
		expect(await instrument.resumePaused()).toEqual({ kind: 'accepted' });
		expect(accept).toHaveBeenCalledTimes(1);
		expect(accept.mock.calls[0]![0]).toMatchObject({
			kind: LAYOUT_WALL_ANGLE_KIND,
			payload: {
				wallId: mounted.wallId,
				angleRadians: paused.request.angleRadians,
				fixed: paused.fixed
			}
		});
		expect(
			(accept.mock.calls[0]![0] as unknown as { payload: { angleRadians: number } }).payload.angleRadians
		).toBe(paused.request.angleRadians);
		await eventually(() => mounted.host.history().position === 1);
		const resumed = wallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		expect((resumed.angleRadians * 180) / Math.PI).toBeCloseTo(degrees, 5);
		expect(resumed.length).toBeCloseTo(frame.length, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(instrument.pausedProposal()).toBeNull();
	});

	it('cannot pick through an inactive helper', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		// No contributed task is open: the Layout adapter's handles must not claim.
		expect(mounted.facade.session.task()).toBeNull();
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(false);
	});
});

describe('T1.P01.S05 — handle hit-testing and inverse mapping', () => {
	it('prefers a nearby endpoint over the body and keeps the other endpoint fixed', async () => {
		const mounted = await mount();
		const frame = wallFrame(mounted.document, mounted.wallId)!;
		const points = { start: [100, 100] as const, end: [400, 100] as const, middle: [250, 100] as const };
		expect(pickWallHandle([103, 102], points)).toBe('start');
		expect(pickWallHandle([398, 100], points)).toBe('end');
		expect(pickWallHandle([250, 103], points)).toBe('body');
		expect(pickWallHandle([250, 200], points)).toBeNull();
		expect(wallHandleFixedEndpoint('start')).toBe('end');
		expect(wallHandleFixedEndpoint('end')).toBe('start');
		expect(wallHandleFixedEndpoint('body')).toBe('start');

		// Dragging the end to (5, 0) names a 5 m length; the start is the fixed one.
		const request = pointerWallRequest({
			handle: 'end',
			mode: 'length',
			frame,
			fixed: 'start',
			startPoint: frame.end,
			point: [5, 0]
		});
		expect(request).toEqual({ kind: 'length', length: 5 });
		// A 0 m or negative drag is the planner's refusal, not a silently clamped one.
		expect(
			pointerWallRequest({
				handle: 'end',
				mode: 'length',
				frame,
				fixed: 'start',
				startPoint: frame.end,
				point: [0, 0]
			})
		).toEqual({ kind: 'length', length: 0 });
		// Crossing the fixed endpoint keeps its sign, so the preview cannot mirror.
		expect(
			pointerWallRequest({
				handle: 'end',
				mode: 'length',
				frame,
				fixed: 'start',
				startPoint: frame.end,
				point: [-1, 0]
			})
		).toEqual({ kind: 'length', length: -1 });
		// With the end fixed, the moving start must stay on the end's negative side;
		// a pointer beyond the end is the same negative length.
		expect(
			pointerWallRequest({
				handle: 'start',
				mode: 'length',
				frame,
				fixed: 'end',
				startPoint: frame.start,
				point: [7, 0]
			})
		).toEqual({ kind: 'length', length: -1 });
	});

	it('builds the canonical payload for each operation, with the captured fixed endpoint', async () => {
		const mounted = await mount();
		const snapshot = mounted.facade.snapshot();
		const base = {
			wallId: mounted.wallId,
			operationId: 'intent',
			projectId: PROJECT_ID,
			revisionId: snapshot.acceptedRevision.revisionId,
			contentRevision: snapshot.domain.unitRevisions.layout,
			levelId: snapshot.domain.layoutLevelId
		};
		expect(
			wallManipulationIntent({ ...base, request: { kind: 'length', length: 5 }, fixed: 'end' })
		).toMatchObject({
			kind: LAYOUT_WALL_LENGTH_KIND,
			payload: { wallId: mounted.wallId, length: 5, fixed: 'end' }
		});
		expect(
			wallManipulationIntent({ ...base, request: { kind: 'angle', angleRadians: Math.PI / 2 }, fixed: 'start' })
		).toMatchObject({
			kind: LAYOUT_WALL_ANGLE_KIND,
			payload: { wallId: mounted.wallId, angleRadians: Math.PI / 2, fixed: 'start' }
		});
		expect(
			wallManipulationIntent({ ...base, request: { kind: 'move', delta: [0.25, -0.5] }, fixed: 'start' })
		).toMatchObject({
			kind: LAYOUT_WALL_MOVE_KIND,
			payload: { wallId: mounted.wallId, deltaX: 0.25, deltaZ: -0.5 }
		});
	});

	it('offers the Dimensions instrument with the Wall manipulation fields only for a straight Wall', async () => {
		const mounted = await mount();
		selectWall(mounted.facade, mounted.wallId);
		expect(layoutDimensionsInput(mounted.services)).not.toBeNull();
		const instrument = createDimensionsInstrument(mounted.services)!;
		expect(instrument.fields().map((field) => field.id)).toEqual([
			'name',
			'height',
			'thickness',
			'length',
			'angle',
			'deltaX',
			'deltaZ'
		]);
		expect(instrument.fields().find((field) => field.id === 'angle')?.unit).toBe('deg');
		expect(Number(instrument.fields().find((field) => field.id === 'length')?.value)).toBeCloseTo(6, 9);
	});
});
