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
	planExactJunctionMove,
	planWallChain,
	type LayoutDocumentWallFirst,
	type LayoutWall,
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
	createCardFieldsInstrument,
	layoutCardFieldsInput
} from '$lib/authoring/adapters/layout/adapter-support';
import {
	LAYOUT_WALL_ANGLE_KIND,
	LAYOUT_WALL_LENGTH_KIND,
	LAYOUT_WALL_MOVE_KIND,
	wallFrame,
	wallManipulationIntent
} from '$lib/authoring/adapters/layout/precision';
import { typedLengthTiming } from '../../../perf/lib/spot-measurement';
import type { PerfRecord } from '$lib/platform/perf-marks';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import { pointerWallRequest } from '$lib/authoring/adapters/layout/wall-gesture';
import { resolveJunctionPointSnap } from '$lib/authoring/adapters/layout/snap';
import { STAGE_MARK_GLYPH_CSS } from '$lib/authoring/stage/stage-handles';

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
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the S05 enclosure was refused');
	const wallId = chained.document.walls[0]!.id;
	const opening = planCreateWallFirstOpening(
		chained.document,
		{
			wallId,
			kind: 'window',
			offset: 1,
			width: 1.2,
			height: 1.2,
			sillHeight: 1
		},
		freshCapture(),
		chained.document.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(`opening fixture refused: ${opening.rejection.message}`);
	return { document: opening.document, wallId, openingId: opening.changedOpeningIds[0]! };
}

async function mount(
	fixture: { document: LayoutDocumentWallFirst; wallId: string; openingId: string } = fixtureDocument()
): Promise<Mounted> {
	const { document, wallId, openingId } = fixture;
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

/** A complete selection for one Opening of the mounted source. */
function selectOpening(facade: StageFacade, openingId: string): void {
	const snapshot = facade.snapshot();
	const reference = {
		version: 1 as const,
		domain: 'layout' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
		subject: { kind: 'opening' as const, id: openingId },
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

/**
 * R217.S15 — the length ray is the outward measure grip at the free end. Its
 * tip is Stage-local CSS, so pressing it exercises the real mark tier rather
 * than passing a handle id around it.
 */
function lengthRayPress(mounted: Mounted): [number, number] {
	const mark = mounted.facade.marks().find((candidate) => candidate.id === 'layout-wall-length');
	if (mark?.tip === null || mark?.tip === undefined) throw new Error('the Wall length ray is not projected');
	return [mark.tip[0], mark.tip[1]];
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
			capturedInputs: [{ name: 'layout-working-level', value: snapshot.domain.layoutLevelId }],
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
	it('pairs the real typed Length writer with its installed operation, never a prior pointer commit', async () => {
		const target = globalThis as typeof globalThis & { __BISKIQ_PERF__?: { enabled: boolean }; __BISKIQ_PERF_RECORDS__?: PerfRecord[] };
		const mounted = await mount();
		target.__BISKIQ_PERF__ = { enabled: true };
		target.__BISKIQ_PERF_RECORDS__ = [{ name: 'command:commit', kind: 'mark', sequence: 0, time: 0 }];
		try {
			const instrument = typedInstrument(mounted);
			instrument.edit('length', '5');
			const dispatched = performance.now();
			expect(await instrument.commit('length')).toEqual({ kind: 'accepted' });
			const records = target.__BISKIQ_PERF_RECORDS__;
			const start = records.find((record) => record.name === 'command:instrument')!;
			const result = records.find((record) => record.name === 'accepted-result')!;
			expect(start.detail).toMatchObject({ taskKind: 'layout-wall-length', wallId: mounted.wallId, operationId: expect.any(String) });
			expect(result.detail).toMatchObject({ operationId: start.detail!.operationId, sourceContentId: mounted.facade.snapshot().sourceContentId });
			const ledger = { records, ticks: [result.time + 20], renderFrames: [{ surface: 'stage', sourceContentId: mounted.facade.snapshot().sourceContentId, start: result.time + 1, end: result.time + 2, triangles: 10 }], longTasks: [], events: [], navigationStart: 0, paints: {}, lcp: null };
			expect(typedLengthTiming(ledger, dispatched, mounted.wallId)).toMatchObject({ start: start.time, accepted: result.time, editorMs: result.time - start.time, presented: result.time + 20 });
			expect(typedLengthTiming({ ...ledger, records: records.filter((record) => record !== start) }, dispatched, mounted.wallId).editorMs).toBeNull();
			expect(typedLengthTiming({ ...ledger, records: records.map((record) => record === result ? { ...record, detail: { ...record.detail, operationId: 'other' } } : record) }, dispatched, mounted.wallId).accepted).toBeNull();
			expect(typedLengthTiming({ ...ledger, renderFrames: [{ ...ledger.renderFrames[0]!, sourceContentId: 'old' }] }, dispatched, mounted.wallId).presentedMs).toBeNull();
		} finally { delete target.__BISKIQ_PERF__; delete target.__BISKIQ_PERF_RECORDS__; }
	});

	it('records the actual resolved wall identity and distinguishes a failed pick', async () => {
		const mounted = await mount();
		const target = globalThis as typeof globalThis & { __BISKIQ_PERF__?: { enabled: boolean }; __BISKIQ_PERF_RECORDS__?: PerfRecord[] };
		target.__BISKIQ_PERF__ = { enabled: true };
		target.__BISKIQ_PERF_RECORDS__ = [];
		try {
			settle(mounted.facade);
			const frame = wallFrame(mounted.document, mounted.wallId)!;
			const css = stageCss(mounted.facade, [frame.start[0] * 0.75 + frame.end[0] * 0.25, frame.start[1] * 0.75 + frame.end[1] * 0.25]);
			const hit = mounted.facade.resolveSourceHit({ evaluationId: mounted.facade.evaluationId()!, css });
			expect(hit).toMatchObject({ kind: 'resolved', hit: { sourceKind: 'wall', sourceId: mounted.wallId } });
			expect(target.__BISKIQ_PERF_RECORDS__.at(-1)?.detail).toMatchObject({ outcome: 'resolved', sourceKind: 'wall', sourceId: mounted.wallId });
			mounted.facade.resolveSourceHit({ evaluationId: 'stale', css });
			expect(target.__BISKIQ_PERF_RECORDS__.at(-1)?.detail).toMatchObject({ outcome: 'failed', sourceId: null });
		} finally { delete target.__BISKIQ_PERF__; delete target.__BISKIQ_PERF_RECORDS__; }
	});

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
		// Wall handles are **direct manipulation**: the owning adapter claims the press
		// with no contributed task open, so nothing has to be invoked first.
		expect(mounted.facade.session.task()).toBeNull();
		const evaluationId = mounted.facade.evaluationId()!;
		const rayCss = lengthRayPress(mounted);
		const lengthCss = stageCss(mounted.facade, [5, 0]);

		expect(mounted.facade.pointerIntent({ phase: 'down', css: rayCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: lengthCss, evaluationId });
		// The preview is the planner's candidate, not a second interpolation.
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Length 5.00 m'))).toBe(true);
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

	it('claims a handle from Stage-local CSS when the Stage is offset in the window', async () => {
		// The route sends Stage-local pointer CSS while the Camera projects into
		// viewport CSS. With the Index beside the Stage those spaces differ, and a
		// handle that cannot be claimed makes direct manipulation unreachable.
		const mounted = await mount();
		const OFFSET_RECT = { left: 352, top: 119, width: 928, height: 458, devicePixelRatio: 1 };
		expect(mounted.facade.camera.evaluate(OFFSET_RECT, 1).kind).toBe('evaluated');
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.session.task()).toBeNull();
		const evaluationId = mounted.facade.evaluationId()!;
		const projected = mounted.facade.projectWorld([6, ELEVATION, 0], evaluationId);
		expect(projected.kind).toBe('projected');
		if (projected.kind !== 'projected') return;
		const endCss: [number, number] = [
			projected.css[0] - OFFSET_RECT.left,
			projected.css[1] - OFFSET_RECT.top
		];
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		const projectedLength = mounted.facade.projectWorld([5, ELEVATION, 0], evaluationId);
		expect(projectedLength.kind).toBe('projected');
		if (projectedLength.kind !== 'projected') return;
		const lengthCss: [number, number] = [
			projectedLength.css[0] - OFFSET_RECT.left,
			projectedLength.css[1] - OFFSET_RECT.top
		];
		mounted.facade.pointerIntent({ phase: 'move', css: lengthCss, evaluationId });
		// The preview marker is already in Stage-local CSS: translating it a second
		// time would paint it at the Stage's rect offset instead of under the hand.
		const preview = mounted.facade.overlays().find((marker) => marker.id === 'layout-wall-preview');
		expect(preview).toBeDefined();
		expect(Math.hypot(preview!.css[0] - lengthCss[0], preview!.css[1] - lengthCss[1])).toBeLessThan(2);
		mounted.facade.pointerIntent({ phase: 'cancel', css: endCss, evaluationId });
	});

	it('refuses a length dragged across the fixed start endpoint and commits nothing', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.session.task()).toBeNull();
		const evaluationId = mounted.facade.evaluationId()!;
		const rayCss = lengthRayPress(mounted);
		// Beyond the fixed start: a magnitude would preview/commit a 1 m Wall on the
		// opposite side of the hand, which the pointer never named.
		const crossedCss = stageCss(mounted.facade, [-1, 0]);

		expect(mounted.facade.pointerIntent({ phase: 'down', css: rayCss, evaluationId }).claimed).toBe(true);
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

	it('refuses a Junction moved onto another Junction with human words and no merge', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.session.task()).toBeNull();
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		// The enclosure's north-west corner is another canonical Junction. Moving
		// this Wall's end onto it would merge topology, which no planner offers.
		const otherJunctionCss = stageCss(mounted.facade, [0, 0]);

		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: otherJunctionCss, evaluationId });
		const refusal = mounted.facade.candidatePreviews().find((candidate) => candidate.role === 'refused');
		expect(refusal).toBeDefined();
		expect(refusal!.segments.length).toBe(1);
		expect(refusal!.labels[0]?.text).toContain('cross or meet another Wall');
		expect(refusal!.labels[0]?.text).not.toContain('duplicate_junction_point');
		expect(refusal!.labels[0]?.text).not.toContain('junction');
		mounted.facade.pointerIntent({ phase: 'up', css: otherJunctionCss, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(wallPoints(acceptedLayout(mounted.facade), mounted.wallId)).toEqual(
			wallPoints(mounted.document, mounted.wallId)
		);
		// The release writes nothing, but the reason must outlive the pointer-up.
		const settled = mounted.facade.candidatePreviews().find((candidate) => candidate.role === 'refused');
		expect(settled).toBeDefined();
		expect(settled!.segments).toHaveLength(0);
		expect(settled!.labels[0]?.text).toContain('cross or meet another Wall');
		// The next press retires it.
		mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId });
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall-refused-settled')).toBe(false);
		mounted.facade.pointerIntent({ phase: 'cancel', css: endCss, evaluationId });
	});

	it('translates the body rigidly from the pointer delta', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.session.task()).toBeNull();
		const before = wallPoints(mounted.document, mounted.wallId);
		const idsBefore = acceptedLayout(mounted.facade).walls.map((wall) => wall.id).sort();
		const evaluationId = mounted.facade.evaluationId()!;
		const middle = stageCss(mounted.facade, [3, 0]);
		const shifted = stageCss(mounted.facade, [3.5, 0.5]);

		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Move 0.50 m'))).toBe(true);
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
			return Math.abs(points.start[1] - (before.start[1] + 0.5)) < 1e-5;
		});
		const after = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
		// R217.S15 O2 — the body slides along the Wall's normal only: the pointer's
		// sideways X travel is discarded, so both endpoints move in Z by 0.5 m.
		expect(after.start[0]).toBeCloseTo(before.start[0], 9);
		expect(after.start[1]).toBeCloseTo(before.start[1] + 0.5, 5);
		expect(after.end[0]).toBeCloseTo(before.end[0], 9);
		expect(after.end[1]).toBeCloseTo(before.end[1] + 0.5, 5);
		expect(after.length).toBeCloseTo(before.length, 9);
		// Four Walls keep their identities, and the release is one Undo step.
		expect(acceptedLayout(mounted.facade).walls.map((wall) => wall.id).sort()).toEqual(idsBefore);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('cancels with no document change and releases the gesture lease', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.session.task()).toBeNull();
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
		expect(mounted.facade.session.task()).toBeNull();
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

	it('resumes a paused length proposal at the exact captured value and adds one history entry', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.session.task()).toBeNull();
		const firstId = mounted.facade.evaluationId()!;
		// A value the tag's three-decimal display would lose; Resume must use the
		// captured request, not re-parse the label.
		const exactLength = 5.123456;
		const frame = wallFrame(mounted.document, mounted.wallId)!;
		const targetCss = stageCss(mounted.facade, [exactLength, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: lengthRayPress(mounted), evaluationId: firstId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: targetCss, evaluationId: firstId });

		// A reading flip ends the writer and preserves the exact parameter. The
		// stale release cannot commit it.
		settle(mounted.facade, 4);
		const secondId = mounted.facade.evaluationId()!;
		mounted.facade.pointerIntent({ phase: 'move', css: targetCss, evaluationId: secondId });
		mounted.facade.pointerIntent({ phase: 'up', css: targetCss, evaluationId: secondId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Paused after a reading change'))).toBe(true);

		const instrument = createCardFieldsInstrument(mounted.services)!;
		const paused = instrument.pausedProposal();
		if (paused === null) throw new Error('the reading flip preserved no proposal');
		// The captured request is what Resume submits: an exact float, not the
		// rounded label a re-parse would have to round-trip through.
		if (paused.request.kind !== 'length') throw new Error('the paused proposal is not a length');
		const accept = vi.spyOn(mounted.services.authoring, 'accept');
		expect(await instrument.resumePaused()).toEqual({ kind: 'accepted' });
		expect(accept).toHaveBeenCalledTimes(1);
		expect(accept.mock.calls[0]![0]).toMatchObject({
			kind: LAYOUT_WALL_LENGTH_KIND,
			payload: {
				wallId: mounted.wallId,
				length: paused.request.length,
				fixed: paused.fixed
			}
		});
		expect(
			(accept.mock.calls[0]![0] as unknown as { payload: { length: number } }).payload.length
		).toBe(paused.request.length);
		await eventually(() => mounted.host.history().position === 1);
		const resumed = wallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		expect(resumed.length).toBeCloseTo(paused.request.length, 9);
		// The length mark never touches the angle.
		expect(resumed.angleRadians).toBeCloseTo(frame.angleRadians, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(instrument.pausedProposal()).toBeNull();
	});

	it('picks from the selection alone, and never through another task', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);

		// A selected Wall's handles **are** the direct manipulation, so the Layout
		// adapter claims the press with no contributed task open (`pressWhenNoTask`).
		expect(mounted.facade.session.task()).toBeNull();
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.pointerIntent({ phase: 'cancel', css: endCss, evaluationId }).claimed).toBe(true);

		// With another contributed task open the same press belongs to that task: a
		// helper cannot pick through work it is not part of.
		expect(mounted.facade.openContributedTask('layout-place-plinth')).toMatchObject({ kind: 'opened' });
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(false);
	});
});

describe('T1.P01.S05 — handle hit-testing and inverse mapping', () => {
	it('builds the exact parameter each mark names, with the other endpoint fixed', async () => {
		const mounted = await mount();
		const frame = wallFrame(mounted.document, mounted.wallId)!;

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

	it('offers the Card field writer with the Wall manipulation fields only for a straight Wall', async () => {
		const mounted = await mount();
		selectWall(mounted.facade, mounted.wallId);
		expect(layoutCardFieldsInput(mounted.services)).not.toBeNull();
		const instrument = createCardFieldsInstrument(mounted.services)!;
		expect(instrument.fields().map((field) => field.id)).toEqual([
			'name',
			'height',
			'thickness',
			'length',
			'angle',
			'deltaX',
			'deltaZ',
			'startX',
			'startZ',
			'endX',
			'endZ'
		]);
		expect(instrument.fields().find((field) => field.id === 'angle')?.unit).toBe('deg');
		expect(Number(instrument.fields().find((field) => field.id === 'length')?.value)).toBeCloseTo(6, 9);
	});
});

describe('R217.S07 — Layout marks, numeric entry and coarse pointers', () => {
	function currentOpening(mounted: Mounted) {
		return acceptedLayout(mounted.facade).openings.find((opening) => opening.id === mounted.openingId)!;
	}

	it('publishes the Wall mark vocabulary, not the old CSS-point handles', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const marks = mounted.facade.marks();
		expect(marks.map((mark) => mark.id)).toEqual(
			expect.arrayContaining([
				'layout-wall-start-mark',
				'layout-wall-end-mark',
				'layout-wall-length',
				'layout-wall-move-mark'
			])
		);
		// The owner's 2026-10-29 ruling removes the Wall angle ring: it is not part
		// of the ratified Wall vocabulary. Angle stays a Card field, not a grip.
		expect(marks.map((mark) => mark.id)).not.toContain('layout-wall-angle');
		expect(createCardFieldsInstrument(mounted.services)!.fields().some((field) => field.id === 'angle')).toBe(true);
		expect(marks.every((mark) => mark.planner !== null)).toBe(true);
		expect(mounted.facade.overlays().some((marker) => marker.id === 'layout-wall-start')).toBe(false);
	});

	it('draws the Wall vocabulary as quiet shared glyphs, not wall-length rays', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const marks = mounted.facade.marks();
		const distance = (a: readonly [number, number], b: readonly [number, number]) =>
			Math.hypot(b[0] - a[0], b[1] - a[1]);

		const length = marks.find((mark) => mark.id === 'layout-wall-length')!;
		const end = marks.find((mark) => mark.id === 'layout-wall-end-mark')!;
		// The measure ray is anchored at the free end its drag moves, and its
		// drawing is the shared 30 px glyph — a 6 m Wall must not draw a 6 m ray.
		expect(length.anchor).toEqual(end.anchor);
		expect(length.tip).not.toBeNull();
		expect(distance(length.anchor, length.tip!)).toBeCloseTo(STAGE_MARK_GLYPH_CSS.ray, 6);

		const move = marks.find((mark) => mark.id === 'layout-wall-move-mark')!;
		// The grammar's two-way base ray: one anchor, a reach on both sides.
		expect(move.tail).not.toBeNull();
		expect(distance(move.anchor, move.tip!)).toBeCloseTo(STAGE_MARK_GLYPH_CSS.twoWayHalf, 6);
		expect(distance(move.anchor, move.tail!)).toBeCloseTo(STAGE_MARK_GLYPH_CSS.twoWayHalf, 6);
	});

	it('publishes Opening position and its truthful width ray', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectOpening(mounted.facade, mounted.openingId);
		expect(mounted.facade.marks().map((mark) => mark.id)).toEqual([
			'layout-opening-width-end',
			'layout-opening-position'
		]);
		// The start edge is not published: the one-field width measure keeps the
		// start fixed, so a start-edge grip would lie about which edge it moves.
		// Adding one is a planner change, which this slice does not make.
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-opening-width-start')).toBe(false);
	});

	it('slides an Opening from its own track anchor without jumping', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectOpening(mounted.facade, mounted.openingId);
		// This contract is the track anchor itself: hold Snap so the committed
		// offset is the pointer's own, not a grid winner's.
		mounted.facade.setDrafting({ snapSuspended: true });
		const before = currentOpening(mounted);
		const evaluationId = mounted.facade.evaluationId()!;
		const slide = mounted.facade.marks().find((mark) => mark.id === 'layout-opening-position')!;
		const from: [number, number] = [slide.anchor[0] + RECT.left, slide.anchor[1] + RECT.top];
		const to = stageCss(mounted.facade, [before.offset + before.width / 2 + 1, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => Math.abs(currentOpening(mounted).offset - (before.offset + 1)) < 1e-6);
		expect(currentOpening(mounted).width).toBeCloseTo(before.width, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('resizes an Opening from its edge ray and commits one history entry', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectOpening(mounted.facade, mounted.openingId);
		const before = currentOpening(mounted);
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [before.offset + before.width, 0]);
		const to = stageCss(mounted.facade, [before.offset + before.width + 0.4, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => Math.abs(currentOpening(mounted).width - (before.width + 0.4)) < 1e-6);
		expect(currentOpening(mounted).offset).toBeCloseTo(before.offset, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('types a length at the gesture: Enter commits once, the next pointer-up does not', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const rayCss = lengthRayPress(mounted);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: rayCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '7' }).claimed).toBe(true);
		expect(
			mounted.facade.marks().some((mark) => mark.id === 'layout-wall-length' && mark.tag.includes('Length 7'))
		).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		await eventually(() => Math.abs(wallPoints(acceptedLayout(mounted.facade), mounted.wallId).length - 7) < 1e-6);
		// The release that follows is consumed; it cannot install a second entry.
		mounted.facade.pointerIntent({ phase: 'up', css: rayCss, evaluationId });
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('types a length then Esc twice: the first restores, the second cancels with no entry', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const rayCss = lengthRayPress(mounted);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: rayCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '4' }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'cancel' }).claimed).toBe(true);
		// The first Escape restores the transient pointer value and keeps the writer.
		expect(mounted.session.gesture()).not.toBeNull();
		expect(
			mounted.facade.marks().some(
				(mark) => mark.id === 'layout-wall-length' && mark.tag.includes('Length 6') && !mark.tag.includes('Length 4')
			)
		).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'cancel' }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: rayCss, evaluationId });
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(wallPoints(acceptedLayout(mounted.facade), mounted.wallId)).toEqual(
			wallPoints(mounted.document, mounted.wallId)
		);
	});

	it('never commits a typed value on the pointer-up that ends the drag', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const rayCss = lengthRayPress(mounted);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: rayCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '4' }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: rayCss, evaluationId });
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('keeps the numeric writer alive across the consumed pointer-up, then commits on Enter', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const rayCss = lengthRayPress(mounted);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: rayCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '4' }).claimed).toBe(true);
		// The browser's pointer-up is consumed: no commit, and the writer keeps its
		// lease so the keyboard still reaches it.
		expect(mounted.facade.pointerIntent({ phase: 'up', css: rayCss, evaluationId }).claimed).toBe(true);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(mounted.session.gesture()).not.toBeNull();
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		await eventually(() => Math.abs(wallPoints(acceptedLayout(mounted.facade), mounted.wallId).length - 4) < 1e-6);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('keeps coarse hit areas at 44 px while a press 20 px beyond the visual point stays navigation', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const marks = mounted.facade.marks();
		const end = marks.find((mark) => mark.id === 'layout-wall-end-mark')!;
		const move = marks.find((mark) => mark.id === 'layout-wall-move-mark')!;
		const length = marks.find((mark) => mark.id === 'layout-wall-length')!;
		const empty: [number, number] = [end.anchor[0], end.anchor[1] + 23];
		expect(mounted.facade.pointerIntent({ phase: 'down', css: empty, evaluationId, coarse: true }).claimed).toBe(false);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: end.anchor, evaluationId, coarse: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'cancel', css: end.anchor, evaluationId, coarse: true });
		// Both arms of the two-way base ray and the length ray's own tip are coarse
		// targets; the endpoint's 44 px disc must not be the only way to reach length.
		expect(move.tail).not.toBeNull();
		expect(mounted.facade.pointerIntent({ phase: 'down', css: move.tail!, evaluationId, coarse: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'cancel', css: move.tail!, evaluationId, coarse: true });
		expect(length.tip).not.toBeNull();
		expect(mounted.facade.pointerIntent({ phase: 'down', css: length.tip!, evaluationId, coarse: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'cancel', css: length.tip!, evaluationId, coarse: true });
	});
});

describe('R217.S15 — Wall direct manipulation', () => {
	it('moves a degree-3 shared Junction and every incident Wall follows', () => {
		const document = createEmptyWallFirstLayoutDocument();
		document.floor.elevation = ELEVATION;
		document.junctions = [
			{ id: 'junction-centre', point: [0, 0] },
			{ id: 'junction-east', point: [3, 0] },
			{ id: 'junction-north', point: [-1.5, 2.5] },
			{ id: 'junction-south', point: [-1.5, -2.5] }
		];
		document.walls = [
			{ id: 'wall-east', startJunctionId: 'junction-centre', endJunctionId: 'junction-east', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'wall-north', startJunctionId: 'junction-centre', endJunctionId: 'junction-north', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'wall-south', startJunctionId: 'junction-centre', endJunctionId: 'junction-south', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
		];
		const plan = planExactJunctionMove(document, 'junction-centre', [0.5, 0.75]);
		if (plan.kind === 'rejected') throw new Error(plan.rejection.message);
		expect(plan.document.junctions.find((junction) => junction.id === 'junction-centre')?.point).toEqual([0.5, 0.75]);
		expect(plan.document.walls).toHaveLength(3);
		for (const wall of plan.document.walls) {
			expect(wall.startJunctionId).toBe('junction-centre');
			const start = plan.document.junctions.find((junction) => junction.id === wall.startJunctionId)!;
			expect(start.point).toEqual([0.5, 0.75]);
		}
	});

	it('keeps a hosted Opening’s identity, offset and width when its Wall reshapes', async () => {
		const mounted = await mount();
		const before = acceptedLayout(mounted.facade).openings.find((opening) => opening.id === mounted.openingId)!;
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [6, 0]);
		const to = stageCss(mounted.facade, [5.5, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => Math.abs(wallPoints(acceptedLayout(mounted.facade), mounted.wallId).length - 5.5) < 1e-6);
		const after = acceptedLayout(mounted.facade);
		const opening = after.openings.find((entry) => entry.id === mounted.openingId)!;
		expect(opening.wallId).toBe(before.wallId);
		expect(opening.offset).toBeCloseTo(before.offset, 9);
		expect(opening.width).toBeCloseTo(before.width, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('refuses atomically when a neighbour’s Opening no longer fits', async () => {
		const base = fixtureDocument();
		const neighbour = base.document.walls[1]!;
		const added = planCreateWallFirstOpening(
			base.document,
			{ wallId: neighbour.id, kind: 'window', offset: 2, width: 2, height: 1.2, sillHeight: 1 },
			freshCapture(),
			base.document.floor.id
		);
		if (added.kind === 'rejected') throw new Error(`neighbour opening fixture refused: ${added.rejection.message}`);
		const mounted = await mount({ ...base, document: added.document });
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const before = mounted.facade.snapshot().canonicalJson;
		const from = stageCss(mounted.facade, [6, 0]);
		// The neighbour Wall shrinks to 2 m; its 2 m Opening cannot fit at offset 2.
		const to = stageCss(mounted.facade, [6, 2]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const refused = mounted.facade.candidatePreviews().find((candidate) => candidate.role === 'refused');
		expect(refused).toBeDefined();
		expect(refused!.labels[0]?.text).toContain('Opening');
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('treats a press and release without travel as a click, not a commit', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		const baseline = mounted.facade.snapshot().canonicalJson;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.pointerIntent({ phase: 'up', css: endCss, evaluationId }).claimed).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
	});

	it('snaps a body drag to the 0.5 m normal grid and Alt frees it', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const middle = stageCss(mounted.facade, [3, 0]);
		const shifted = stageCss(mounted.facade, [3.37, 0.37]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Move 0.50 m'))).toBe(true);
		mounted.facade.pointerIntent({ phase: 'cancel', css: shifted, evaluationId });

		mounted.facade.setDrafting({ snapSuspended: true });
		settle(mounted.facade, 3);
		const secondId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId: secondId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId: secondId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Move 0.37 m'))).toBe(true);
		mounted.facade.pointerIntent({ phase: 'cancel', css: shifted, evaluationId: secondId });
	});

	it('snaps a length-ray drag to 0.5 m and commits the snapped value', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const rayCss = lengthRayPress(mounted);
		const to = stageCss(mounted.facade, [5.26, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: rayCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Length 5.50 m'))).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => Math.abs(wallPoints(acceptedLayout(mounted.facade), mounted.wallId).length - 5.5) < 1e-6);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('commits the Card’s Start X through the shared-Junction planner', async () => {
		const mounted = await mount();
		selectWall(mounted.facade, mounted.wallId);
		const instrument = createCardFieldsInstrument(mounted.services)!;
		instrument.edit('startX', '0.5');
		expect(await instrument.commit('startX')).toEqual({ kind: 'accepted' });
		await eventually(() => {
			const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			return frame !== null && Math.abs(frame.start[0] - 0.5) < 1e-9;
		});
		const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		expect(frame.start[1]).toBeCloseTo(0, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});
});

describe('R217.S15 — gesture numeric entry', () => {
	it('types a body distance and commits it along the normal once', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const middle = stageCss(mounted.facade, [3, 0]);
		const shifted = stageCss(mounted.facade, [3, 0.37]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId });
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '3' }).claimed).toBe(true);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-move-mark' && mark.tag.includes('Distance 3'))).toBe(true);
		expect(
			mounted.facade
				.candidatePreviews()
				.flatMap((candidate) => candidate.labels)
				.some((label) => label.text.includes('Distance 3'))
		).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		await eventually(() => {
			const points = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
			return Math.abs(points.start[1] - 3) < 1e-6;
		});
		const after = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
		expect(after.start[0]).toBeCloseTo(0, 9);
		expect(after.end[0]).toBeCloseTo(6, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('types a body distance from a press away from the move grip', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		// 4.5 m along a 6 m Wall: past the midpoint grip, inside the body band.
		const body = stageCss(mounted.facade, [4.5, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: body, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '2' }).claimed).toBe(true);
		// The fallback press carries the move mark's id, so both the mark tag and the
		// pointer tag name the value being typed even though the press was not on the grip.
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-move-mark' && mark.tag.includes('Distance 2'))).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		// The release after Enter must not write a second time.
		mounted.facade.pointerIntent({ phase: 'up', css: body, evaluationId });
		await eventually(() => {
			const points = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
			return Math.abs(points.start[1] - 2) < 1e-6;
		});
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('types a Junction X then Z with Tab and commits one shared-Junction edit', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '6' }).claimed).toBe(true);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-end-mark' && mark.tag.includes('X 6'))).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '\t' }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '1' }).claimed).toBe(true);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-end-mark' && mark.tag.includes('Z 1'))).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		// The release after Enter must not write a second time.
		mounted.facade.pointerIntent({ phase: 'up', css: endCss, evaluationId });
		await eventually(() => {
			const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			return frame !== null && Math.abs(frame.end[1] - 1) < 1e-6;
		});
		expect(wallPoints(acceptedLayout(mounted.facade), mounted.wallId).end[0]).toBeCloseTo(6, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('offers a curved Wall the Card only, with no body press or edit marks', async () => {
		const base = createEmptyWallFirstLayoutDocument();
		base.floor.elevation = ELEVATION;
		base.junctions = [
			{ id: 'c-a', point: [0, 0] },
			{ id: 'c-b', point: [6, 0] }
		];
		base.walls = [
			{
				id: 'curved',
				startJunctionId: 'c-a',
				endJunctionId: 'c-b',
				thickness: 0.2,
				height: 3,
				centerline: {
					kind: 'cubic-chain',
					knots: [],
					spans: [{ handleOut: [2, 3], handleIn: [4, 3] }]
				}
			} satisfies LayoutWall
		];
		const mounted = await mount({ document: base, wallId: 'curved', openingId: '' });
		settle(mounted.facade, 2);
		selectWall(mounted.facade, 'curved');
		const editMarks = mounted.facade
			.marks()
			.filter((mark) => mark.adapterId === 'layout' && mark.role === 'edit');
		expect(editMarks).toHaveLength(0);
		const body = stageCss(mounted.facade, [3, 0]);
		expect(
			mounted.facade.pointerIntent({
				phase: 'down',
				css: body,
				evaluationId: mounted.facade.evaluationId()!
			}).claimed
		).toBe(false);
		// The Card remains the non-pointer path for the Wall's ordinary fields.
		expect(createCardFieldsInstrument(mounted.services)!.fields().some((field) => field.id === 'height')).toBe(true);
	});

	it('commits a typed Junction X alone and keeps the current Z', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '5' }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		await eventually(() => {
			const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			return frame !== null && Math.abs(frame.end[0] - 5) < 1e-6;
		});
		const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		expect(frame.end[1]).toBeCloseTo(0, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('commits the winning Junction snap point exactly', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		const to = stageCss(mounted.facade, [5.52, 0.03]);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		// The guide from the other end fixes Z; the 0.5 m grid fixes X. The commit
		// must be that winning point, not the raw pointer sample beside it.
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.snap !== undefined)).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			return frame !== null && Math.abs(frame.end[0] - 5.5) < 1e-9;
		});
		const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		expect(frame.end[0]).toBeCloseTo(5.5, 9);
		expect(frame.end[1]).toBeCloseTo(0, 9);
	});

	it('tags the moving end point with the candidate length and angle', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted.facade, [5.5, 0.5]), evaluationId });
		const tag = mounted.facade.marks().find((mark) => mark.id === 'layout-wall-end-mark')?.tag ?? '';
		expect(tag).toContain('Length');
		expect(tag).toContain('°');
		expect(tag).not.toMatch(/^X /);
		mounted.facade.pointerIntent({ phase: 'cancel', css: endCss, evaluationId });
	});
});

describe('R217.S15 — Junction snap policy', () => {
	it('prefers the orthogonal guide from the Wall’s other end, then the 0.5 grid, and Alt frees it', async () => {
		const mounted = await mount();
		const geometry = mounted.facade.snapshot().domain.geometry;
		const snap = resolveJunctionPointSnap({
			geometry,
			point: [5.52, 0.03],
			anchor: [0, 0],
			pixelsPerMeter: 100,
			drafting: mounted.facade.drafting()
		});
		expect(snap).not.toBeNull();
		expect(snap!.point[1]).toBeCloseTo(0, 9);
		expect(['Aligned', 'Grid']).toContain(snap!.name);

		mounted.facade.setDrafting({ snapSuspended: true });
		expect(
			resolveJunctionPointSnap({
				geometry,
				point: [5.52, 0.03],
				anchor: [0, 0],
				pixelsPerMeter: 100,
				drafting: mounted.facade.drafting()
			})
		).toBeNull();
	});
});

describe('R217.S15 — body and length reach', () => {
	it('changes only length when the length ray is dragged off-axis', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const rayCss = lengthRayPress(mounted);
		const to = stageCss(mounted.facade, [5, 2]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: rayCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Length 5.00 m'))).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			return frame !== null && Math.abs(frame.length - 5) < 1e-6;
		});
		const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		expect(frame.angleRadians).toBeCloseTo(0, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('frees the length ray from the 0.5 m grid while Snap is suspended', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		mounted.facade.setDrafting({ snapSuspended: true });
		settle(mounted.facade, 3);
		const evaluationId = mounted.facade.evaluationId()!;
		const rayCss = lengthRayPress(mounted);
		const to = stageCss(mounted.facade, [5.37, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: rayCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Length 5.37 m'))).toBe(true);
		mounted.facade.pointerIntent({ phase: 'cancel', css: to, evaluationId });
	});

	it('moves a free-standing Wall with nothing else affected', async () => {
		const document = createEmptyWallFirstLayoutDocument();
		document.floor.elevation = ELEVATION;
		document.junctions = [
			{ id: 'free-start', point: [0, 0] },
			{ id: 'free-end', point: [4, 0] }
		];
		document.walls = [
			{ id: 'free-wall', startJunctionId: 'free-start', endJunctionId: 'free-end', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
		];
		const mounted = await mount({ document, wallId: 'free-wall', openingId: '' });
		settle(mounted.facade, 2);
		selectWall(mounted.facade, 'free-wall');
		const evaluationId = mounted.facade.evaluationId()!;
		const middle = stageCss(mounted.facade, [2, 0]);
		const shifted = stageCss(mounted.facade, [2.37, 0.5]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId });
		expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-neighbours')).toBe(false);
		mounted.facade.pointerIntent({ phase: 'up', css: shifted, evaluationId });
		await eventually(() => {
			const points = wallPoints(acceptedLayout(mounted.facade), 'free-wall');
			return Math.abs(points.start[1] - 0.5) < 1e-6;
		});
		const accepted = acceptedLayout(mounted.facade);
		expect(accepted.walls).toHaveLength(1);
		expect(accepted.openings).toHaveLength(0);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});
});
