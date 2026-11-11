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
	LAYOUT_DIMENSION_LIMIT_MESSAGE,
	MAX_LAYOUT_DIMENSION_METERS,
	planCreateWallFirstOpening,
	planExactJunctionMove,
	planWallChain,
	wallFirstWallLength,
	setWorkObserver,
	type LayoutDocumentWallFirst,
	type LayoutWall,
	type PlanSourceRef
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { captureUnitSave, readUnitEnvelopeForSave } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
import { stageCardActions } from '$lib/authoring/stage/stage-contributions';
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
	LAYOUT_WALL_HEIGHT_KIND,
	LAYOUT_WALL_LENGTH_KIND,
	LAYOUT_WALL_MOVE_KIND,
	LAYOUT_WALL_THICKNESS_KIND,
	curvedWallFrame,
	curvedWallPointAt,
	wallFrame,
	wallManipulationIntent
} from '$lib/authoring/adapters/layout/precision';
import { typedLengthTiming } from '../../../perf/lib/spot-measurement';
import type { PerfRecord } from '$lib/platform/perf-marks';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import { pointerWallRequest } from '$lib/authoring/adapters/layout/wall-gesture';
import { resolveJunctionPointSnap, resolvePlanarDragSnap, snapWallDrag } from '$lib/authoring/adapters/layout/snap';
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

/** Project a 3D wall-face point through the same settled Stage evaluation. */
function stageCssWorld(facade: StageFacade, point: readonly [number, number, number]): readonly [number, number] {
	const id = facade.evaluationId();
	if (id === null) throw new Error('the mounted fixture has no evaluation');
	const projected = facade.projectWorld(point, id);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

/** D2 — bend the mounted Wall at one centerline station through the real press path. */
async function bendWallAt(mounted: Mounted, distance: number): Promise<void> {
	selectWall(mounted.facade, mounted.wallId);
	settle(mounted.facade, 3);
	const frame = curvedWallFrame(acceptedLayout(mounted.facade), mounted.wallId);
	const station = frame === null ? null : curvedWallPointAt(frame, distance);
	const point: [number, number] = station === null ? [distance, 0] : [station.point[0], station.point[1]];
	const evaluationId = mounted.facade.evaluationId()!;
	const from = stageCss(mounted.facade, point);
	const to = stageCss(mounted.facade, [point[0], point[1] + 0.6]);
	expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
	// The modifier is captured at pointer-down; releasing it mid-drag does not
	// turn the bend into a move.
	mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
	mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
	const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
	const expected = wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots.length + 1 : 1;
	await eventually(() => {
		const next = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
		return next.centerline.kind === 'cubic-chain' && next.centerline.knots.length === expected;
	});
}

/** Click the first bend mark so the session names it active, as the creator would. */
async function activateFirstBendPoint(mounted: Mounted): Promise<void> {
	selectWall(mounted.facade, mounted.wallId);
	settle(mounted.facade, 4);
	const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
	const knot = wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots[0] : undefined;
	if (knot === undefined) throw new Error('the fixture has no bend point');
	const css = stageCss(mounted.facade, knot.point);
	const evaluationId = mounted.facade.evaluationId()!;
	expect(mounted.facade.pointerIntent({ phase: 'down', css, evaluationId }).claimed).toBe(true);
	mounted.facade.pointerIntent({ phase: 'up', css, evaluationId });
	await eventually(() =>
		mounted.facade.marks().some((candidate) => candidate.id === `layout-wall-knot:${knot.id}` && candidate.label === 'Active bend point')
	);
}

/**
 * R217.S15 — the length ray is the outward measure grip at the free end. Its
 * tip is Stage-local CSS, so pressing it exercises the real mark tier rather
 * than passing a handle id around it.
 */
/** The Wall's size disclosure is the one route to its length ray. */
function revealWallSize(mounted: Mounted): void {
	const chip = mounted.facade.marks().find(
		(candidate) => candidate.id === 'layout-wall-size-chip' && candidate.role === 'disclose'
	);
	if (chip === undefined) throw new Error('the Wall size chip is not admitted');
	if (!mounted.facade.activateDisclosure(chip.id)) throw new Error('the Wall size chip did not open');
}

function lengthRayPress(mounted: Mounted): [number, number] {
	revealWallSize(mounted);
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

	it('accepts the exact typed bound and refuses larger geometry without source or history', async () => {
		const mounted = await mount();
		const instrument = typedInstrument(mounted);
		const before = acceptedLayout(mounted.facade);

		instrument.setFixedEndpoint('start');
		instrument.edit('length', String(MAX_LAYOUT_DIMENSION_METERS));
		expect(await instrument.commit('length')).toEqual({ kind: 'accepted' });
		const atLimit = acceptedLayout(mounted.facade);
		const pointsAtLimit = wallPoints(atLimit, mounted.wallId);
		expect(
			Math.hypot(
				pointsAtLimit.end[0] - pointsAtLimit.start[0],
				pointsAtLimit.end[1] - pointsAtLimit.start[1]
			)
		).toBeCloseTo(MAX_LAYOUT_DIMENSION_METERS, 6);
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(acceptedLayout(mounted.facade)).toEqual(before);
		const historyAfterUndo = mounted.host.history();
		expect(historyAfterUndo.position).toBe(0);

		instrument.edit('length', String(MAX_LAYOUT_DIMENSION_METERS + 1));
		expect(await instrument.commit('length')).toMatchObject({
			kind: 'refused',
			code: 'dimension_out_of_range',
			message: LAYOUT_DIMENSION_LIMIT_MESSAGE
		});

		// The Card's disclosed Junction coordinates are the same envelope: a typed
		// X that would stretch the Wall past the limit is refused by the same
		// shared-Junction planner.
		instrument.edit('endX', String(MAX_LAYOUT_DIMENSION_METERS + 100));
		expect(await instrument.commit('endX')).toMatchObject({
			kind: 'refused',
			code: 'dimension_out_of_range',
			message: LAYOUT_DIMENSION_LIMIT_MESSAGE
		});

		expect(acceptedLayout(mounted.facade)).toEqual(before);
		expect(mounted.host.history()).toEqual(historyAfterUndo);
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
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('→ 5.00 m'))).toBe(true);
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
		// One coral candidate carries the whole refused attempt; no second cobalt
		// subject is emitted beside it.
		expect(refusal!.segments.length).toBeGreaterThan(0);
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall-attempt')).toBe(false);
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
		expect(settled!.segments.length).toBeGreaterThan(0);
		expect(settled!.labels[0]?.text).toContain('cross or meet another Wall');
		// The next press retires it; the cancelled gesture leaves nothing behind.
		mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId });
		mounted.facade.pointerIntent({ phase: 'cancel', css: endCss, evaluationId });
		expect(
			mounted.facade
				.candidatePreviews()
				.some((candidate) => candidate.id === 'layout-candidate-refused-settled')
		).toBe(false);
	});

	it('translates the body rigidly from the pointer delta', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		expect(mounted.facade.session.task()).toBeNull();
		const before = wallPoints(mounted.document, mounted.wallId);
		const idsBefore = acceptedLayout(mounted.facade).walls.map((wall) => wall.id).sort();
		const evaluationId = mounted.facade.evaluationId()!;
		// Press away from the selected Wall's contextual span ring: the ring is
		// the Bend writer, the rest of the body remains the rigid move surface.
		const middle = stageCss(mounted.facade, [2.2, 0]);
		const shifted = stageCss(mounted.facade, [2.7, 0.5]);

		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId }).claimed).toBe(true);
		const spans: string[] = [];
		const observer = setWorkObserver({ span: (name) => spans.push(name), count: () => {} });
		try {
			mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId });
			expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall')).toBe(true);
		} finally {
			setWorkObserver(observer);
		}
		expect(spans.filter((name) => name.includes('compile'))).toEqual([]);
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Δx 0.00 · Δz +0.50 m'))).toBe(true);
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
				'layout-wall-size-chip',
				'layout-wall-start-mark',
				'layout-wall-end-mark'
			])
		);
		// The size chip is the one route to the Wall's measured marks; before it
		// opens neither the length ray nor the thickness arrow is admitted.
		expect(marks.map((mark) => mark.id)).not.toContain('layout-wall-length');
		expect(marks.map((mark) => mark.id)).not.toContain('layout-wall-thickness');
		revealWallSize(mounted);
		const revealed = mounted.facade.marks().map((mark) => mark.id);
		expect(revealed).toContain('layout-wall-length');
		expect(revealed).toContain('layout-wall-thickness');
		// The rigid move glyph is retired; the hidden writer record is not drawn.
		expect(marks.map((mark) => mark.id)).not.toContain('layout-wall-move-mark');
		// The owner's 2026-10-29 ruling removes the Wall angle ring: it is not part
		// of the ratified Wall vocabulary. Angle stays a Card field, not a grip.
		expect(marks.map((mark) => mark.id)).not.toContain('layout-wall-angle');
		expect(createCardFieldsInstrument(mounted.services)!.fields().some((field) => field.id === 'angle')).toBe(true);
		// The size chip is a disclosure, not a writer: only editing grips name a
		// planner. The chip's role is to reveal the length ray.
		expect(marks.filter((mark) => mark.role === 'edit').every((mark) => mark.planner !== null)).toBe(true);
		expect(mounted.facade.overlays().some((marker) => marker.id === 'layout-wall-start')).toBe(false);
	});

	it('draws the Wall vocabulary as quiet shared glyphs, not wall-length rays', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		revealWallSize(mounted);
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

		// The rigid move has no visible glyph; its hidden record survives only as
		// the body gesture's numeric writer identity, never as a Stage mark.
		expect(marks.some((mark) => mark.id === 'layout-wall-move-mark')).toBe(false);
	});

	it('publishes cursor-only resize targets and the smaller center move glyph', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectOpening(mounted.facade, mounted.openingId);
		const perspective = mounted.facade.marks();
		expect(perspective.map((mark) => mark.id)).toEqual([
			'layout-opening-corner-top-left',
			'layout-opening-corner-top-right',
			'layout-opening-corner-bottom-left',
			'layout-opening-corner-bottom-right',
			'layout-opening-width-start',
			'layout-opening-width-end',
			'layout-opening-height-top',
			'layout-opening-sill-bottom',
			'layout-opening-position'
		]);
		for (const mark of perspective.slice(0, -1)) {
			expect(mark.hidden).toBe(true);
			expect(mark.resizeCursor).toBe(mark.id.includes('corner') ? 'opening-corner' : 'opening-edge');
			expect(mark.hitRadiusCss).toBe(22);
		}
		const position = perspective.at(-1)!;
		expect(position.cross).toBe(true);
		expect(position.glyphScale).toBeCloseTo(0.62, 6);
		// Corners precede edges, so a shared 22 px hover zone resolves consistently.
		const topRight = perspective[1]!;
		expect(mounted.facade.hitMark({ css: topRight.anchor, coarse: false })?.id).toBe(topRight.id);

		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
		settle(mounted.facade, 10);
		expect(mounted.facade.marks().map((mark) => mark.id)).toEqual([
			'layout-opening-width-start',
			'layout-opening-width-end',
			'layout-opening-position'
		]);
	});

	it('slides an Opening from its center move mark in 3D without jumping', async () => {
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
		const datum = mounted.facade.snapshot().domain.datumMeters;
		const eye = mounted.facade.camera.evaluation()!.eye;
		const wall = mounted.document.walls.find((entry) => entry.id === mounted.wallId)!;
		const faceZ = (Math.sign(eye[2]) || 1) * wall.thickness / 2;
		const to = stageCssWorld(mounted.facade, [before.offset + before.width / 2 + 1, datum + before.sillHeight + before.height / 2, faceZ]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => Math.abs(currentOpening(mounted).offset - (before.offset + 1)) < 1e-6);
		expect(currentOpening(mounted).width).toBeCloseTo(before.width, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('slides a selected Opening from its center move mark in Plan', async () => {
		const mounted = await mount();
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
		settle(mounted.facade, 10);
		selectOpening(mounted.facade, mounted.openingId);
		const before = currentOpening(mounted);
		mounted.facade.setDrafting({ snapSuspended: true });
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [before.offset + before.width / 2, 0]);
		const to = stageCss(mounted.facade, [before.offset + before.width / 2 + 0.5, 0]);
		expect(mounted.facade.hitMark({ css: from, coarse: false })?.id).toBe('layout-opening-position');
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => Math.abs(currentOpening(mounted).offset - (before.offset + 0.5)) < 1e-6);
		expect(currentOpening(mounted).width).toBeCloseTo(before.width, 9);
		expect(mounted.facade.selectionState().primary?.subject).toEqual({ kind: 'opening', id: mounted.openingId });
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('leaves an aperture press on a selected Wall to navigation when the Opening wins', async () => {
		const mounted = await mount();
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
		settle(mounted.facade, 10);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const aperture = stageCss(mounted.facade, [1.6, 0]);
		expect(mounted.facade.resolvePick({ css: aperture, evaluationId, purpose: 'select', tool: null })).toMatchObject({
			kind: 'resolved', hit: { sourceKind: 'opening', sourceId: mounted.openingId }
		});
		expect(mounted.facade.pointerIntent({ phase: 'down', css: aperture, evaluationId }).claimed).toBe(false);
		expect(mounted.session.gesture()).toBeNull();
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('resizes an Opening from its right edge in Plan and commits one history entry', async () => {
		const mounted = await mount();
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
		settle(mounted.facade, 2);
		selectOpening(mounted.facade, mounted.openingId);
		const before = currentOpening(mounted);
		const evaluationId = mounted.facade.evaluationId()!;
		const edge = mounted.facade.marks().find((mark) => mark.id === 'layout-opening-width-end')!;
		const from: [number, number] = [edge.anchor[0] + RECT.left, edge.anchor[1] + RECT.top];
		const to = stageCss(mounted.facade, [before.offset + before.width + 0.4, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => Math.abs(currentOpening(mounted).width - (before.width + 0.4)) < 1e-6);
		expect(currentOpening(mounted).offset).toBeCloseTo(before.offset, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('resizes from the left edge, holds the right edge fixed, and undoes atomically', async () => {
		const mounted = await mount();
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
		settle(mounted.facade, 10);
		selectOpening(mounted.facade, mounted.openingId);
		mounted.facade.setDrafting({ snapSuspended: true });
		const before = currentOpening(mounted);
		const oldRight = before.offset + before.width;
		const evaluationId = mounted.facade.evaluationId()!;
		const left = mounted.facade.marks().find((mark) => mark.id === 'layout-opening-width-start')!;
		const from: [number, number] = [left.anchor[0] + RECT.left, left.anchor[1] + RECT.top];
		const to = stageCss(mounted.facade, [before.offset - 0.3, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.candidatePreviews().some((entry) => entry.id === 'layout-candidate-opening-mark')).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => Math.abs(currentOpening(mounted).offset - (before.offset - 0.3)) < 1e-6);
		const resized = currentOpening(mounted);
		expect(resized.offset + resized.width).toBeCloseTo(oldRight, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(currentOpening(mounted)).toEqual(before);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 0 });
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(currentOpening(mounted).offset + currentOpening(mounted).width).toBeCloseTo(oldRight, 9);
	});

	it('refuses a left edge beyond the Wall start without clamping or history', async () => {
		const mounted = await mount();
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
		settle(mounted.facade, 10);
		selectOpening(mounted.facade, mounted.openingId);
		mounted.facade.setDrafting({ snapSuspended: true });
		const before = currentOpening(mounted);
		const baseline = mounted.facade.snapshot().canonicalJson;
		const evaluationId = mounted.facade.evaluationId()!;
		const left = mounted.facade.marks().find((mark) => mark.id === 'layout-opening-width-start')!;
		const from: [number, number] = [left.anchor[0] + RECT.left, left.anchor[1] + RECT.top];
		const across = stageCss(mounted.facade, [-0.5, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: across, evaluationId });
		const refused = mounted.facade.candidatePreviews().find((entry) => entry.id === 'layout-candidate-opening-mark-refused');
		expect(refused?.labels[0]?.text).toContain('start');
		mounted.facade.pointerIntent({ phase: 'up', css: across, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(currentOpening(mounted)).toEqual(before);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('uniformly scales a 3D corner while its opposite corner stays fixed', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectOpening(mounted.facade, mounted.openingId);
		const before = currentOpening(mounted);
		const wall = mounted.document.walls.find((entry) => entry.id === mounted.wallId)!;
		const eye = mounted.facade.camera.evaluation()!.eye;
		const faceZ = (Math.sign(eye[2]) || 1) * wall.thickness / 2;
		const evaluationId = mounted.facade.evaluationId()!;
		const bottomRight = mounted.facade.marks().find((mark) => mark.id === 'layout-opening-corner-bottom-right')!;
		const from: [number, number] = [bottomRight.anchor[0] + RECT.left, bottomRight.anchor[1] + RECT.top];
		const datum = mounted.facade.snapshot().domain.datumMeters;
		const target = stageCssWorld(mounted.facade,
			[before.offset + before.width + 0.3, datum + before.sillHeight - 0.3, faceZ]
		);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		expect(mounted.facade.candidatePreviews().some((entry) => entry.id === 'layout-candidate-opening-mark')).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await eventually(() => Math.abs(currentOpening(mounted).width - 1.5) < 1e-5);
		const resized = currentOpening(mounted);
		expect(resized.height).toBeCloseTo(1.5, 5);
		expect(resized.offset).toBeCloseTo(before.offset, 6);
		expect(resized.sillHeight + resized.height).toBeCloseTo(before.sillHeight + before.height, 6);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('resizes an Opening from its 3D top edge while its sill stays fixed', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectOpening(mounted.facade, mounted.openingId);
		mounted.facade.setDrafting({ snapSuspended: true });
		const before = currentOpening(mounted);
		const wall = mounted.document.walls.find((entry) => entry.id === mounted.wallId)!;
		const eye = mounted.facade.camera.evaluation()!.eye;
		const faceZ = (Math.sign(eye[2]) || 1) * wall.thickness / 2;
		const evaluationId = mounted.facade.evaluationId()!;
		const top = mounted.facade.marks().find((mark) => mark.id === 'layout-opening-height-top')!;
		const from: [number, number] = [top.anchor[0] + RECT.left, top.anchor[1] + RECT.top];
		const datum = mounted.facade.snapshot().domain.datumMeters;
		const target = stageCssWorld(mounted.facade,
			[before.offset + before.width / 2, datum + before.sillHeight + before.height + 0.3, faceZ]
		);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		expect(mounted.facade.candidatePreviews().some((entry) => entry.id === 'layout-candidate-opening-mark')).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await eventually(() => Math.abs(currentOpening(mounted).height - (before.height + 0.3)) < 1e-5);
		const resized = currentOpening(mounted);
		expect(resized.sillHeight).toBeCloseTo(before.sillHeight, 9);
		expect(resized.offset).toBeCloseTo(before.offset, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(currentOpening(mounted)).toEqual(before);
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
		revealWallSize(mounted);
		const evaluationId = mounted.facade.evaluationId()!;
		const marks = mounted.facade.marks();
		const end = marks.find((mark) => mark.id === 'layout-wall-end-mark')!;
		const length = marks.find((mark) => mark.id === 'layout-wall-length')!;
		const empty: [number, number] = [end.anchor[0], end.anchor[1] + 23];
		expect(mounted.facade.pointerIntent({ phase: 'down', css: empty, evaluationId, coarse: true }).claimed).toBe(false);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: end.anchor, evaluationId, coarse: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'cancel', css: end.anchor, evaluationId, coarse: true });
		// The length ray's own tip is a coarse target; the endpoint's 44 px disc
		// must not be the only way to reach length.
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

	it('reveals the span Bend target on hover without arming a candidate', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 3);
		const span = () => mounted.facade.marks().find((mark) => mark.id === 'layout-wall-span:0');
		expect(span()?.tag).toBe('Pull to bend');

		const points = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
		const mid = [(points.start[0] + points.end[0]) / 2, (points.start[1] + points.end[1]) / 2] as const;
		const evaluationId = mounted.facade.evaluationId()!;
		// Hover the body, not the ring itself: proximity must reveal the writer
		// before the creator has to find the exact midpoint.
		mounted.facade.idleHoverIntent({
			phase: 'move',
			css: stageCss(mounted.facade, [mid[0] + 0.8, mid[1] + 0.1]),
			evaluationId,
			coarse: false
		});
		expect(span()?.tag).toBe('Bend · pull here');
		// Discovery is a cue, not a second gesture target or a live proposal.
		expect(mounted.facade.candidatePreviews()).toEqual([]);

		mounted.facade.idleHoverIntent({ phase: 'move', css: [640, -400], evaluationId, coarse: false });
		expect(span()?.tag).toBe('Pull to bend');
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
		// A refusal decided only at release must keep the attempted network; the
		// commit may not overwrite it with a geometry-less tag.
		const settled = mounted.facade.candidatePreviews().find((candidate) => candidate.id === 'layout-candidate-refused-settled');
		expect(settled?.role).toBe('refused');
		expect(settled!.segments.length).toBeGreaterThan(0);
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
		const middle = stageCss(mounted.facade, [2.2, 0]);
		const between = stageCss(mounted.facade, [2.57, 0.37]);
		const shifted = stageCss(mounted.facade, [2.57, 0.48]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: between, evaluationId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Δx 0.00 · Δz +0.37 m'))).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Δx 0.00 · Δz +0.50 m'))).toBe(true);
		mounted.facade.pointerIntent({ phase: 'cancel', css: shifted, evaluationId });

		mounted.facade.setDrafting({ snapSuspended: true });
		settle(mounted.facade, 3);
		const secondId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId: secondId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId: secondId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('Δx 0.00 · Δz +0.48 m'))).toBe(true);
		mounted.facade.pointerIntent({ phase: 'cancel', css: shifted, evaluationId: secondId });
	});

	it('snaps a length-ray drag to 0.5 m and commits the snapped value', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const rayCss = lengthRayPress(mounted);
		const to = stageCss(mounted.facade, [5.48, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: rayCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('→ 5.50 m'))).toBe(true);
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
		const middle = stageCss(mounted.facade, [2.2, 0]);
		const shifted = stageCss(mounted.facade, [2.2, 0.37]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId });
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '3' }).claimed).toBe(true);
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

	it('types a body distance from the move grip and commits it along the normal', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		// The body press is the rigid-move surface now that the move glyph is
		// retired; no modifier means move, so its numeric distance writer is live.
		const gripCss = stageCss(mounted.facade, [4.5, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: gripCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '2' }).claimed).toBe(true);
		expect(
			mounted.facade.candidatePreviews()
				.flatMap((candidate) => candidate.labels)
				.some((label) => label.text.includes('Distance 2'))
		).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		// The release after Enter must not write a second time.
		mounted.facade.pointerIntent({ phase: 'up', css: gripCss, evaluationId });
		await eventually(() => {
			const points = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
			return Math.abs(points.start[1] - 2) < 1e-6;
		});
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('bends a straight Wall body and preserves the hosted Opening arc-length station', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const before = mounted.document.openings.find((opening) => opening.id === mounted.openingId)!;
		const evaluationId = mounted.facade.evaluationId()!;
		// 4.5 m along the 6 m Wall is body: past the 3 m move grip and off both ends.
		const from = stageCss(mounted.facade, [4.5, 0]);
		const to = stageCss(mounted.facade, [4.5, 0.7]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(
			mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall-bend')
		).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain' && wall.centerline.knots.length === 1;
		});
		const accepted = acceptedLayout(mounted.facade);
		const after = accepted.openings.find((opening) => opening.id === mounted.openingId)!;
		// D3 — the Opening keeps its authored offset and width (its arc-length
		// station); bending the host moves the station through space, never along it.
		expect(after.offset).toBeCloseTo(before.offset, 9);
		expect(after.width).toBeCloseTo(before.width, 9);
		const frame = curvedWallFrame(accepted, mounted.wallId)!;
		const station = curvedWallPointAt(frame, after.offset + after.width / 2)!;
		expect(Math.abs(station.point[1])).toBeGreaterThan(0.05);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		const restored = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
		expect(restored.centerline.kind).toBe('line');
	});

	it('reveals thickness and height on a curved Wall through the size chip', async () => {
		const mounted = await mount();
		await bendWallAt(mounted, 4.5);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 3);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-thickness')).toBe(false);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-height')).toBe(false);
		revealWallSize(mounted);
		const marks = mounted.facade.marks();
		expect(marks.some((mark) => mark.id === 'layout-wall-height' && mark.planner === LAYOUT_WALL_HEIGHT_KIND)).toBe(true);
		expect(marks.some((mark) => mark.id === 'layout-wall-thickness' && mark.planner === LAYOUT_WALL_THICKNESS_KIND)).toBe(true);
		// Arc length is not an exact-length writer; the chip must not advertise one.
		expect(marks.some((mark) => mark.id === 'layout-wall-length')).toBe(false);
	});

	it('reads and edits a curved-host Opening station on the arc, not its chord', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const bendEvaluation = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [4.5, 0]);
		const to = stageCss(mounted.facade, [4.5, 0.7]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId: bendEvaluation, metaKey: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId: bendEvaluation });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId: bendEvaluation });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain' && wall.centerline.knots.length === 1;
		});

		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
		settle(mounted.facade, 10);
		selectOpening(mounted.facade, mounted.openingId);
		settle(mounted.facade, 4);

		const opening = () =>
			acceptedLayout(mounted.facade).openings.find((candidate) => candidate.id === mounted.openingId)!;
		const before = opening();
		const frame = curvedWallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		const midpoint = curvedWallPointAt(frame, before.offset + before.width / 2)!.point;
		// The bend moved the Opening's station off the chord; otherwise the
		// mark assertion below would not distinguish the two frames.
		expect(Math.abs(midpoint[1])).toBeGreaterThan(0.05);
		const markCss = (id: string): [number, number] => {
			const mark = mounted.facade.marks().find((candidate) => candidate.id === id)!;
			return [mark.anchor[0] + RECT.left, mark.anchor[1] + RECT.top];
		};
		const position = markCss('layout-opening-position');
		const stationCss = stageCss(mounted.facade, midpoint);
		// Surface 3 — the mark reads the sampled arc-length station.
		expect(Math.hypot(position[0] - stationCss[0], position[1] - stationCss[1])).toBeLessThan(1);
		const chordCss = stageCss(mounted.facade, [before.offset + before.width / 2, 0]);
		expect(Math.hypot(position[0] - chordCss[0], position[1] - chordCss[1])).toBeGreaterThan(5);

		// Slide half a metre of arc length through the real pointer machine; the
		// committed offset is a station, so following the curve adds exactly that.
		mounted.facade.setDrafting({ snapSuspended: true });
		const target = curvedWallPointAt(frame, before.offset + before.width / 2 + 0.5)!.point;
		const targetCss = stageCss(mounted.facade, target);
		const dragEvaluation = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: position, evaluationId: dragEvaluation }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: targetCss, evaluationId: dragEvaluation });
		mounted.facade.pointerIntent({ phase: 'up', css: targetCss, evaluationId: dragEvaluation });
		await eventually(() => Math.abs(opening().offset - (before.offset + 0.5)) < 0.05);
		expect(opening().width).toBeCloseTo(before.width, 6);
		expect(mounted.host.history()).toMatchObject({ depth: 3, position: 2 });

		// Width is the other station edit: the right edge follows the same arc
		// frame, so half a metre of curve adds half a metre of Opening width and
		// leaves the offset where the slide put it.
		settle(mounted.facade, 4);
		const slid = opening();
		const rightEdge = markCss('layout-opening-width-end');
		const widened = curvedWallPointAt(frame, slid.offset + slid.width + 0.5)!.point;
		const widenedCss = stageCss(mounted.facade, widened);
		const widthEvaluation = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: rightEdge, evaluationId: widthEvaluation }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: widenedCss, evaluationId: widthEvaluation });
		mounted.facade.pointerIntent({ phase: 'up', css: widenedCss, evaluationId: widthEvaluation });
		await eventually(() => Math.abs(opening().width - (slid.width + 0.5)) < 0.05);
		expect(opening().offset).toBeCloseTo(slid.offset, 6);
		expect(mounted.host.history()).toMatchObject({ depth: 4, position: 3 });
	});

	it('places a new Opening on a curved host from the Ink pointer reading', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const bendEvaluation = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [4.5, 0]);
		const to = stageCss(mounted.facade, [4.5, 0.7]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId: bendEvaluation, metaKey: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId: bendEvaluation });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId: bendEvaluation });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain' && wall.centerline.knots.length === 1;
		});
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
		settle(mounted.facade, 10);

		const opened = mounted.facade.openContributedTask('layout-ink');
		expect(opened.kind).toBe('opened');
		inkSurface()!.controller.setReading('opening');
		const frame = curvedWallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		const station = curvedWallPointAt(frame, 4.5)!;
		const css = stageCss(mounted.facade, station.point);
		const evaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css, evaluationId });
		await eventually(() => acceptedLayout(mounted.facade).openings.length === 2);
		const created = acceptedLayout(mounted.facade).openings.find(
			(opening) => opening.id !== mounted.openingId
		)!;
		expect(created.wallId).toBe(mounted.wallId);
		// The hover named the sampled station, not the chord projection of it.
		expect(created.offset).toBeGreaterThan(4);
		expect(created.offset).toBeLessThan(5);
	});

	it('selects an active bend point on canvas and removes it from the Card in one undo step', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		const knots = () => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots : [];
		};
		const bendAt = async (distance: number): Promise<void> => {
			selectWall(mounted.facade, mounted.wallId);
			settle(mounted.facade, 3);
			const frame = curvedWallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			const point: [number, number] = frame === null
				? [distance, 0]
				: [
					curvedWallPointAt(frame, distance)!.point[0],
					curvedWallPointAt(frame, distance)!.point[1]
				];
			const evaluationId = mounted.facade.evaluationId()!;
			const from = stageCss(mounted.facade, point);
			const to = stageCss(mounted.facade, [point[0], point[1] + 0.6]);
			expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
			mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
			mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
			const expected = knots().length + 1;
			await eventually(() => knots().length === expected);
		};
		await bendAt(4.5);
		await bendAt(1.5);
		expect(knots()).toHaveLength(2);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 4);

		const firstKnot = knots()[0]!;
		const knotCss = stageCss(mounted.facade, firstKnot.point);
		const clickEvaluation = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: knotCss, evaluationId: clickEvaluation }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: knotCss, evaluationId: clickEvaluation });
		await eventually(() =>
			mounted.facade.marks().some((mark) => mark.id === `layout-wall-knot:${firstKnot.id}` && mark.label === 'Active bend point')
		);

		const subject = { sourceId: mounted.wallId, sourceKind: 'wall' as const, ref: null };
		const facts = mounted.facade.cardFacts(subject);
		expect(facts.map((fact) => fact.label)).toEqual(
			expect.arrayContaining(['Length (arc)', 'Bend points', 'Active bend point'])
		);
		expect(facts.find((fact) => fact.label === 'Bend points')?.value).toBe('2');
		const actions = stageCardActions(mounted.facade, subject);
		expect(actions.map((action) => action.id)).toEqual(
			expect.arrayContaining(['layout-wall-knot-remove', 'layout-wall-straighten', 'layout-wall-delete'])
		);
		const remove = actions.find((action) => action.id === 'layout-wall-knot-remove')!;
		expect(remove.detail).toContain('one undo step');
		expect((await remove.run()).kind).toBe('accepted');
		await eventually(() => knots().length === 1);
		expect(mounted.host.history()).toMatchObject({ depth: 4, position: 3 });

		// The accepted curved Wall round-trips through the Save envelope unchanged.
		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'c1-knot-remove-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-c1-knot-remove',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		expect(stageEnvelope(readmitted.snapshot).units).toEqual(stageEnvelope(mounted.facade.snapshot()).units);

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(knots()).toHaveLength(2);
	});

	it('removes the active bend point with Delete through the shared Card channel', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		await bendWallAt(mounted, 4.5);
		await bendWallAt(mounted, 1.5);
		await activateFirstBendPoint(mounted);
		const knots = () => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots : [];
		};
		expect(knots()).toHaveLength(2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		// D2 — Delete is the Card's own removal helper: the retained delete planner
		// previews, one captured intent is accepted once, and the active knot clears.
		expect(mounted.facade.selectionKeyIntent({ kind: 'delete' })).toEqual({
			claimed: true,
			adapterId: 'layout'
		});
		await eventually(() => knots().length === 1);
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});
		expect(mounted.facade.marks().some((mark) => mark.label === 'Active bend point')).toBe(false);

		// The keyboard result is a canonical document: Save/Load admits it unchanged.
		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'd2-delete-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-d2-delete-roundtrip',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		expect(stageEnvelope(readmitted.snapshot).units).toEqual(stageEnvelope(mounted.facade.snapshot()).units);

		// One keypress is one undo step, and Undo restores the exact prior curve.
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(knots()).toHaveLength(2);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
	});

	it('removes the active bend point with Backspace and Undo restores the curve', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		await bendWallAt(mounted, 4.5);
		await activateFirstBendPoint(mounted);
		const knots = () => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots : [];
		};
		expect(knots()).toHaveLength(1);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		expect(mounted.facade.selectionKeyIntent({ kind: 'backtrack' })).toEqual({
			claimed: true,
			adapterId: 'layout'
		});
		await eventually(() => knots().length === 0);
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(knots()).toHaveLength(1);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
	});

	it('refuses Delete on a curved Wall with no active bend point instead of deleting it', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		await bendWallAt(mounted, 4.5);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 4);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		// A curved Wall claims the key and refuses without an active knot, so Delete
		// can never fall through to the Wall's destructive Card action.
		expect(mounted.facade.selectionKeyIntent({ kind: 'delete' })).toEqual({
			claimed: true,
			adapterId: 'layout'
		});
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
		expect(acceptedLayout(mounted.facade).walls.some((wall) => wall.id === mounted.wallId)).toBe(true);
	});

	it('refuses Delete when the named bend point is already gone', async () => {
		// A pre-curved Wall stays curved after the inserted knot is undone, so the
		// selected Wall is still a valid Delete target while its named knot is not.
		const base = createEmptyWallFirstLayoutDocument();
		base.floor.elevation = ELEVATION;
		base.junctions = [
			{ id: 'stale-a', point: [0, 0] },
			{ id: 'stale-b', point: [6, 0] }
		];
		base.walls = [
			{
				id: 'stale-curve',
				startJunctionId: 'stale-a',
				endJunctionId: 'stale-b',
				thickness: 0.2,
				height: 3,
				centerline: {
					kind: 'cubic-chain',
					knots: [],
					spans: [{ handleOut: [2, 3], handleIn: [4, 3] }]
				}
			} satisfies LayoutWall
		];
		const mounted = await mount({ document: base, wallId: 'stale-curve', openingId: '' });
		settle(mounted.facade, 2);
		await bendWallAt(mounted, 3);
		await activateFirstBendPoint(mounted);
		expect((await mounted.host.undo()).kind).toBe('installed');
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'stale-curve')!;
			return wall.centerline.kind === 'cubic-chain' && wall.centerline.knots.length === 0;
		});
		// Undo rebases the source: the adapter binding is rebuilt on the host's
		// next live frame, exactly as every other post-write assertion does.
		settle(mounted.facade, 5);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		// Stale state refuses; it never straightens and never deletes the Wall.
		expect(mounted.facade.selectionKeyIntent({ kind: 'delete' })).toEqual({
			claimed: true,
			adapterId: 'layout'
		});
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
		expect(acceptedLayout(mounted.facade).walls.some((wall) => wall.id === 'stale-curve')).toBe(true);
	});

	it('leaves straight-Wall Delete to the host command map', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 4);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		// A straight Wall claims neither key, so the route keeps its existing Delete
		// action and Backspace command instead of growing a curve-only branch.
		expect(mounted.facade.selectionKeyIntent({ kind: 'delete' })).toEqual({ claimed: false, adapterId: null });
		expect(mounted.facade.selectionKeyIntent({ kind: 'backtrack' })).toEqual({ claimed: false, adapterId: null });
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});

	it('straightens a curved Wall from the Card and leaves straight Walls action-free', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const subject = { sourceId: mounted.wallId, sourceKind: 'wall' as const, ref: null };
		// Straight Walls expose the scoped Split and delete: no hidden Bend-armed
		// mode and no curve vocabulary leaks in; unfold entry lives in the Card foot.
		expect(stageCardActions(mounted.facade, subject).map((action) => action.id)).toEqual([
				'layout-wall-delete',
				'layout-wall-split'
			]);

		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [4.5, 0]);
		const to = stageCss(mounted.facade, [4.5, 0.7]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain';
		});
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 4);
		const curvedBytes = mounted.facade.snapshot().canonicalJson;
		const beforeOpening = acceptedLayout(mounted.facade).openings.find((opening) => opening.id === mounted.openingId)!;
		const actions = stageCardActions(mounted.facade, subject);
		expect(actions.map((action) => action.id)).toEqual(
			expect.arrayContaining(['layout-wall-straighten', 'layout-wall-delete'])
		);
		expect(actions.some((action) => action.id === 'layout-wall-knot-remove')).toBe(false);
		const straighten = actions.find((action) => action.id === 'layout-wall-straighten')!;
		expect((await straighten.run()).kind).toBe('accepted');
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'line';
		});
		const afterOpening = acceptedLayout(mounted.facade).openings.find((opening) => opening.id === mounted.openingId)!;
		expect(afterOpening.offset).toBeCloseTo(beforeOpening.offset, 9);
		expect(afterOpening.width).toBeCloseTo(beforeOpening.width, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 3, position: 2 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(curvedBytes);
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

	it('publishes bend marks and bends a curved Wall from a meta body press in one Undo step', async () => {
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
		// C1/P1 — the selected Wall carries contextual shape points: both junction
		// ends and one hollow span ring, with no hidden Bend-armed mode.
		const bendMarks = mounted.facade
			.marks()
			.filter((mark) => mark.adapterId === 'layout' && mark.role === 'edit');
		expect(bendMarks.map((mark) => mark.id)).toEqual([
			'layout-wall-start-mark',
			'layout-wall-end-mark',
			'layout-wall-span:0'
		]);
		const curved = curvedWallFrame(acceptedLayout(mounted.facade), 'curved')!;
		const from = stageCss(mounted.facade, curvedWallPointAt(curved, curved.length / 2)!.point);
		const evaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
		const to = stageCss(mounted.facade, [3, 3.4]);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(
			mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall-bend')
		).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
			return wall.centerline.kind === 'cubic-chain' && wall.centerline.knots.length === 1;
		});
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		// A second press cancelled before release leaves no preview and no write.
		selectWall(mounted.facade, 'curved');
		settle(mounted.facade, 3);
		const secondCurve = curvedWallFrame(acceptedLayout(mounted.facade), 'curved')!;
		const secondFrom = stageCss(mounted.facade, curvedWallPointAt(secondCurve, secondCurve.length / 2)!.point);
		const secondId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: secondFrom, evaluationId: secondId, metaKey: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId: secondId });
		mounted.facade.pointerIntent({ phase: 'cancel', css: to, evaluationId: secondId });
		expect(
			mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall-bend')
		).toBe(false);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		const restored = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
		expect(restored.centerline.kind).toBe('cubic-chain');
		if (restored.centerline.kind !== 'cubic-chain') return;
		expect(restored.centerline.knots).toHaveLength(0);
		// The Card remains the non-pointer path for the Wall's ordinary fields.
		expect(createCardFieldsInstrument(mounted.services)!.fields().some((field) => field.id === 'height')).toBe(true);
	});

	it('removes an existing knot by flattening it onto the neighbour chord, and Undo restores it', async () => {
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
		const curved = curvedWallFrame(acceptedLayout(mounted.facade), 'curved')!;
		const from = stageCss(mounted.facade, curvedWallPointAt(curved, curved.length / 2)!.point);
		const evaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
		const bendTo = stageCss(mounted.facade, [3, 3.4]);
		mounted.facade.pointerIntent({ phase: 'move', css: bendTo, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: bendTo, evaluationId });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
			return wall.centerline.kind === 'cubic-chain' && wall.centerline.knots.length === 1;
		});
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });

		selectWall(mounted.facade, 'curved');
		settle(mounted.facade, 3);
		const bent = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
		if (bent.centerline.kind !== 'cubic-chain') throw new Error('expected a bent chain');
		const knot = bent.centerline.knots[0]!;
		const knotCss = stageCss(mounted.facade, [knot.point[0], knot.point[1]]);
		const removalEvaluation = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: knotCss, evaluationId: removalEvaluation, metaKey: true }).claimed).toBe(true);
		// Leave the chord first, then return to it: the must-leave hysteresis.
		mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted.facade, [3, 4]), evaluationId: removalEvaluation });
		const chord = stageCss(mounted.facade, [3, 0.02]);
		mounted.facade.pointerIntent({ phase: 'move', css: chord, evaluationId: removalEvaluation });
		const removal = mounted.facade.candidatePreviews().find((candidate) => candidate.id === 'layout-candidate-wall-bend-remove');
		expect(removal).toBeDefined();
		expect(removal!.labels[0]?.text).toBe('Remove bend point');
		mounted.facade.pointerIntent({ phase: 'up', css: chord, evaluationId: removalEvaluation });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
			return wall.centerline.kind !== 'cubic-chain' || wall.centerline.knots.length === 0;
		});
		expect(mounted.host.history()).toMatchObject({ depth: 3, position: 2 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		const restored = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
		expect(restored.centerline.kind).toBe('cubic-chain');
		if (restored.centerline.kind !== 'cubic-chain') return;
		expect(restored.centerline.knots).toHaveLength(1);
	});

	it('plain-drags a connected curved Wall without changing its knots or Opening station', async () => {
		const base = createEmptyWallFirstLayoutDocument();
		base.floor.elevation = ELEVATION;
		base.junctions = [
			{ id: 'c-a', point: [0, 0] },
			{ id: 'c-b', point: [6, 0] },
			{ id: 'c-c', point: [6, 3] }
		];
		base.walls = [
			{
				id: 'curved',
				startJunctionId: 'c-a',
				endJunctionId: 'c-b',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'cubic-chain', knots: [], spans: [{ handleOut: [2, 3], handleIn: [4, 3] }] }
			} satisfies LayoutWall,
			{
				id: 'neighbour',
				startJunctionId: 'c-b',
				endJunctionId: 'c-c',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' }
			} satisfies LayoutWall
		];
		const opened = planCreateWallFirstOpening(
			base,
			{ wallId: 'curved', kind: 'window', offset: 1, width: 1, height: 1.2, sillHeight: 1 },
			freshCapture(),
			base.floor.id
		);
		if (opened.kind === 'rejected') throw new Error(`opening fixture refused: ${opened.rejection.message}`);
		const mounted = await mount({
			document: opened.document,
			wallId: 'curved',
			openingId: opened.changedOpeningIds[0]!
		});
		settle(mounted.facade, 2);
		await bendWallAt(mounted, 2);
		await bendWallAt(mounted, 4);
		selectWall(mounted.facade, 'curved');
		settle(mounted.facade, 6);
		const before = acceptedLayout(mounted.facade);
		const beforeWall = before.walls.find((wall) => wall.id === 'curved')!;
		const beforeKnots = beforeWall.centerline.kind === 'cubic-chain' ? beforeWall.centerline.knots.length : 0;
		const beforeOpening = before.openings.find((opening) => opening.id === mounted.openingId)!;
		const beforeFrame = curvedWallFrame(before, 'curved')!;
		const beforeNeighbour = before.walls.find((wall) => wall.id === 'neighbour')!;
		const beforeShared = before.junctions.find((junction) => junction.id === beforeNeighbour.startJunctionId)!;
		const historyBefore = mounted.host.history().depth;
		const from = stageCss(mounted.facade, curvedWallPointAt(beforeFrame, 3)!.point);
		const to = stageCss(mounted.facade, [3, 1]);
		const evaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall')).toBe(true);
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall-bend')).toBe(false);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => mounted.host.history().depth === historyBefore + 1);
		const after = acceptedLayout(mounted.facade);
		const afterWall = after.walls.find((wall) => wall.id === 'curved')!;
		const afterKnots = afterWall.centerline.kind === 'cubic-chain' ? afterWall.centerline.knots.length : 0;
		expect(afterKnots).toBe(beforeKnots);
		expect(afterKnots).toBe(2);
		expect(wallFirstWallLength(after, 'curved')!).toBeCloseTo(wallFirstWallLength(before, 'curved')!, 6);
		const afterOpening = after.openings.find((opening) => opening.id === mounted.openingId)!;
		expect(afterOpening.offset).toBeCloseTo(beforeOpening.offset, 9);
		expect(afterOpening.width).toBeCloseTo(beforeOpening.width, 9);
		const afterNeighbour = after.walls.find((wall) => wall.id === 'neighbour')!;
		const afterShared = after.junctions.find((junction) => junction.id === afterNeighbour.startJunctionId)!;
		expect(afterShared.point[0]).toBeCloseTo(beforeShared.point[0], 6);
		expect(afterShared.point[1]).not.toBeCloseTo(beforeShared.point[1], 6);
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
		expect(tag).toBe('Δx −0.50 · Δz +0.50 m');
		expect(tag).not.toContain('°');
		expect(tag).not.toMatch(/^X /);
		mounted.facade.pointerIntent({ phase: 'cancel', css: endCss, evaluationId });
	});
});

describe('R217.S15 — Junction snap policy', () => {
	it('moves freely between targets and cannot snap a short Wall slide back to zero', async () => {
		const { facade } = await mount();
		const drafting = facade.drafting();
		const projected = (a: number, b: number) => Math.abs(a - b) * 60;
		expect(snapWallDrag(.05, drafting, projected)).toEqual({ value: .05, snapped: false });
		expect(snapWallDrag(.54, drafting, projected)).toEqual({ value: .5, snapped: true });
		expect(snapWallDrag(.58, drafting, projected)).toEqual({ value: .58, snapped: false });
		// Even when zoomed far out, the 4 px radius cannot consume the whole cell.
		expect(snapWallDrag(.73, drafting, (a, b) => Math.abs(a - b) * 5))
			.toEqual({ value: .73, snapped: false });
	});

	it('acquires a diagonal and a distance together, with no quantization between targets', async () => {
		const { facade } = await mount();
		const drafting = facade.drafting();
		const projected = (a: readonly [number, number], b: readonly [number, number]) =>
			Math.hypot(a[0] - b[0], a[1] - b[1]) * 60;
		const both = resolvePlanarDragSnap([0, 0], [.72, .70], drafting, projected);
		expect(both.winner?.name).toBe('Aligned · Grid');
		expect(both.point[0]).toBeCloseTo(both.point[1], 9);
		expect(Math.hypot(...both.point)).toBeCloseTo(1, 9);
		for (const point of [[.13, .08], [.21, .15]] as const) {
			expect(resolvePlanarDragSnap([0, 0], point, drafting, projected)).toMatchObject({ point, winner: null });
		}
	});

	it('combines the alignment guide with a 0.5 m distance, and Alt frees it', async () => {
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
		expect(snap).toMatchObject({ point: [5.5, 0], name: 'Aligned · Grid' });

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
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('→ 5.00 m'))).toBe(true);
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
		expect(mounted.facade.overlays().some((marker) => marker.label.includes('→ 5.37 m'))).toBe(true);
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
		const middle = stageCss(mounted.facade, [1.2, 0]);
		const shifted = stageCss(mounted.facade, [1.57, 0.5]);
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

describe('R217.S16 — Opening priority and idle Junction hover', () => {
	function planReading(facade: StageFacade): void {
		facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
		settle(facade, 10);
	}

	function currentOpening(mounted: Mounted) {
		return acceptedLayout(mounted.facade).openings.find((opening) => opening.id === mounted.openingId)!;
	}

	it('moves an unselected hovered Junction on the 0.5 m grid in one Undo step', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		mounted.facade.setDrafting({ snapSuspended: false });
		const junctionId = mounted.document.walls[0]!.startJunctionId;
		const junction = mounted.document.junctions.find((candidate) => candidate.id === junctionId)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, junction.point);
		const mark = mounted.facade.idleHoverIntent({ phase: 'move', css: from, evaluationId, coarse: false });
		expect(mark).toMatchObject({ id: 'layout-junction-hover', adapterId: 'layout', role: 'edit' });
		expect(mounted.facade.marks().some((candidate) => candidate.id === 'layout-junction-hover')).toBe(true);
		const selectionBefore = mounted.facade.selectionState();
		const to = stageCss(mounted.facade, [junction.point[0] + 0.52, junction.point[1] + 0.98]);
		expect(mounted.facade.pointerIntent({
			phase: 'down', css: from, evaluationId, handleId: mark!.id, handleAdapterId: mark!.adapterId
		}).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.marks().find((candidate) => candidate.id === 'layout-junction-hover')?.tag).toContain('Δx +0.50 · Δz +1.00 m');
		expect(mounted.facade.candidatePreviews().find((candidate) => candidate.id === 'layout-candidate-junction-hover')?.snap).toMatchObject({ name: 'Grid' });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const current = acceptedLayout(mounted.facade).junctions.find((candidate) => candidate.id === junctionId);
			return current?.point[0] === 0.5 && current.point[1] === 1;
		});
		expect(mounted.facade.selectionState()).toEqual(selectionBefore);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(acceptedLayout(mounted.facade).junctions.find((candidate) => candidate.id === junctionId)?.point).toEqual(junction.point);
	});

	it('gives the selected Opening left edge priority over an overlapping idle Junction', async () => {
		const base = fixtureDocument();
		base.document.openings[0]!.offset = 0;
		const mounted = await mount(base);
		planReading(mounted.facade);
		mounted.facade.setDrafting({ snapSuspended: true });
		settle(mounted.facade, 11);
		selectOpening(mounted.facade, mounted.openingId);
		const wall = mounted.document.walls.find((candidate) => candidate.id === mounted.wallId)!;
		const start = mounted.document.junctions.find((candidate) => candidate.id === wall.startJunctionId)!;
		const pressPoint: [number, number] = [start.point[0] + 0.04, start.point[1]];
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, pressPoint);
		const hit = mounted.facade.hitMark({ css: from, coarse: false });
		expect(hit?.id).toBe('layout-opening-width-start');
		const junctionMark = mounted.facade.idleHoverIntent({ phase: 'move', css: from, evaluationId, coarse: false });
		expect(junctionMark).toBeNull();

		const before = currentOpening(mounted);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		const to = stageCss(mounted.facade, [pressPoint[0] + 0.5, pressPoint[1]]);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => Math.abs(currentOpening(mounted).offset - 0.5) < 1e-6);
		expect(currentOpening(mounted).id).toBe(before.id);
		expect(currentOpening(mounted).offset + currentOpening(mounted).width).toBeCloseTo(before.width, 9);
		expect(acceptedLayout(mounted.facade).junctions.find((candidate) => candidate.id === wall.startJunctionId)?.point).toEqual(start.point);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(currentOpening(mounted)).toEqual(before);
		expect(acceptedLayout(mounted.facade).junctions.find((candidate) => candidate.id === wall.startJunctionId)?.point).toEqual(start.point);
	});

	const RAW_REFUSAL = /wall-chain|junction-chain|opening:|proper-crossing|_/;

	it('refuses a hovered Junction drag in human words, keeps the reason, and writes nothing', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		const first = mounted.document.walls[0]!;
		const junction = mounted.document.junctions.find((candidate) => candidate.id === first.startJunctionId)!;
		const other = mounted.document.junctions.find((candidate) => candidate.id !== junction.id && candidate.id !== first.endJunctionId)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, junction.point);
		const mark = mounted.facade.idleHoverIntent({ phase: 'move', css: from, evaluationId, coarse: false })!;
		expect(mounted.facade.marks().find((entry) => entry.id === mark.id)?.tag).toBe('Δx 0.00 · Δz 0.00 m');
		const baseline = mounted.facade.snapshot().canonicalJson;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: mark.id, handleAdapterId: mark.adapterId }).claimed).toBe(true);
		const to = stageCss(mounted.facade, other.point);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const live = mounted.facade.candidatePreviews().find((candidate) => candidate.role === 'refused');
		expect(live?.labels[0]?.text).toBeTruthy();
		expect(live!.labels[0]!.text).not.toMatch(RAW_REFUSAL);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		const settled = mounted.facade.candidatePreviews().find((candidate) => candidate.id === 'layout-candidate-refused-settled');
		expect(settled?.labels[0]?.text).toBe(live!.labels[0]!.text);
		expect(settled!.segments.length).toBeGreaterThan(0);
	});

	it('refuses an Opening drag in human words at the pointer, and keeps the reason', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectOpening(mounted.facade, mounted.openingId);
		mounted.facade.setDrafting({ snapSuspended: true });
		const evaluationId = mounted.facade.evaluationId()!;
		const widthMark = mounted.facade.marks().find((mark) => mark.id === 'layout-opening-width-end')!;
		const from: [number, number] = [widthMark.anchor[0] + RECT.left, widthMark.anchor[1] + RECT.top];
		const to = stageCss(mounted.facade, [40, 0]);
		const before = currentOpening(mounted);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const live = mounted.facade.candidatePreviews().find((candidate) => candidate.id === 'layout-candidate-opening-mark-refused');
		expect(live?.labels[0]?.text).toBeTruthy();
		expect(live!.labels[0]!.text).not.toMatch(RAW_REFUSAL);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(currentOpening(mounted)).toEqual(before);
		const settled = mounted.facade.candidatePreviews().find((candidate) => candidate.id === 'layout-candidate-refused-settled');
		expect(settled?.labels[0]?.text).toBe(live!.labels[0]!.text);
		// The next press retires it.
		mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'cancel', css: from, evaluationId });
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-refused-settled')).toBe(false);
	});

	it('keeps a one-CSS-pixel hovered Junction press below the drag threshold', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		const junction = mounted.document.junctions.find((candidate) => candidate.id === mounted.document.walls[0]!.startJunctionId)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, junction.point);
		const mark = mounted.facade.idleHoverIntent({ phase: 'move', css: from, evaluationId, coarse: false })!;
		const baseline = mounted.facade.snapshot().canonicalJson;
		const to: [number, number] = [from[0] + 1, from[1]];
		expect(mounted.facade.pointerIntent({
			phase: 'down', css: from, evaluationId, handleId: mark.id, handleAdapterId: mark.adapterId
		}).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-junction-hover')).toBe(false);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('keeps a one-CSS-pixel center move press below the drag threshold', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		selectOpening(mounted.facade, mounted.openingId);
		mounted.facade.setDrafting({ snapSuspended: true });
		settle(mounted.facade, 11);
		const before = currentOpening(mounted);
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [before.offset + before.width / 2, 0]);
		const to: [number, number] = [from[0] + 1, from[1]];
		const baseline = mounted.facade.snapshot().canonicalJson;
		expect(mounted.facade.hitMark({ css: from, coarse: false })?.id).toBe('layout-opening-position');
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(currentOpening(mounted)).toEqual(before);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('types X then Z during an idle Junction drag and commits once on Enter', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		const junction = mounted.document.junctions.find((candidate) => candidate.id === mounted.document.walls[0]!.startJunctionId)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, junction.point);
		const mark = mounted.facade.idleHoverIntent({ phase: 'move', css: from, evaluationId, coarse: false })!;
		expect(mounted.facade.pointerIntent({
			phase: 'down', css: from, evaluationId, handleId: mark.id, handleAdapterId: mark.adapterId
		}).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '1' }).claimed).toBe(true);
		expect(mounted.facade.marks().find((candidate) => candidate.id === mark.id)?.tag).toContain('X 1');
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '\t' }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '2' }).claimed).toBe(true);
		expect(mounted.facade.marks().find((candidate) => candidate.id === mark.id)?.tag).toContain('Z 2');
		expect(mounted.facade.pointerIntent({ phase: 'up', css: from, evaluationId }).claimed).toBe(true);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		await eventually(() => {
			const current = acceptedLayout(mounted.facade).junctions.find((candidate) => candidate.id === junction.id);
			return current?.point[0] === 1 && current.point[1] === 2;
		});
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(acceptedLayout(mounted.facade).junctions.find((candidate) => candidate.id === junction.id)?.point).toEqual(junction.point);
	});

	it('cancels Junction and selected Opening drags on Escape with no trace', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		const junction = mounted.document.junctions.find((candidate) => candidate.id === mounted.document.walls[0]!.startJunctionId)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, junction.point);
		const mark = mounted.facade.idleHoverIntent({ phase: 'move', css: from, evaluationId, coarse: false })!;
		const baseline = mounted.facade.snapshot().canonicalJson;
		expect(mounted.facade.pointerIntent({
			phase: 'down', css: from, evaluationId, handleId: mark.id, handleAdapterId: mark.adapterId
		}).claimed).toBe(true);
		const to = stageCss(mounted.facade, [junction.point[0] + 0.62, junction.point[1] + 0.77]);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-junction-hover')).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'cancel' }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });

		planReading(mounted.facade);
		selectOpening(mounted.facade, mounted.openingId);
		mounted.facade.setDrafting({ snapSuspended: true });
		settle(mounted.facade, 11);
		const openingBefore = currentOpening(mounted);
		const openingBaseline = mounted.facade.snapshot().canonicalJson;
		const openingEvaluationId = mounted.facade.evaluationId()!;
		const openingFrom = stageCss(mounted.facade, [openingBefore.offset + 0.05, 0]);
		const openingTo = stageCss(mounted.facade, [openingBefore.offset + 0.55, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: openingFrom, evaluationId: openingEvaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: openingTo, evaluationId: openingEvaluationId });
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-opening-mark')).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'cancel' }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: openingTo, evaluationId: openingEvaluationId });
		expect(mounted.facade.snapshot().canonicalJson).toBe(openingBaseline);
		expect(currentOpening(mounted)).toEqual(openingBefore);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('refuses invalid Junction and Opening releases without writing source or history', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		const junction = mounted.document.junctions.find((candidate) => candidate.id === mounted.document.walls[0]!.startJunctionId)!;
		const other = mounted.document.junctions.find((candidate) => candidate.id !== junction.id)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, junction.point);
		const mark = mounted.facade.idleHoverIntent({ phase: 'move', css: from, evaluationId, coarse: false })!;
		const baseline = mounted.facade.snapshot().canonicalJson;
		expect(mounted.facade.pointerIntent({
			phase: 'down', css: from, evaluationId, handleId: mark.id, handleAdapterId: mark.adapterId
		}).claimed).toBe(true);
		const otherCss = stageCss(mounted.facade, other.point);
		mounted.facade.pointerIntent({ phase: 'move', css: otherCss, evaluationId });
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-junction-hover')).toBe(false);
		mounted.facade.pointerIntent({ phase: 'up', css: otherCss, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });

		planReading(mounted.facade);
		selectOpening(mounted.facade, mounted.openingId);
		mounted.facade.setDrafting({ snapSuspended: true });
		settle(mounted.facade, 11);
		const openingBefore = currentOpening(mounted);
		const openingBaseline = mounted.facade.snapshot().canonicalJson;
		const openingEvaluationId = mounted.facade.evaluationId()!;
		const openingFrom = stageCss(mounted.facade, [openingBefore.offset + openingBefore.width / 2, 0]);
		const openingMark = mounted.facade.hitMark({ css: openingFrom, coarse: false });
		expect(openingMark?.id).toBe('layout-opening-position');
		expect(mounted.facade.pointerIntent({
			phase: 'down', css: openingFrom, evaluationId: openingEvaluationId,
			handleId: openingMark!.id, handleAdapterId: openingMark!.adapterId
		}).claimed).toBe(true);
		const invalid = stageCss(mounted.facade, [5.8, 0]);
		mounted.facade.pointerIntent({ phase: 'move', css: invalid, evaluationId: openingEvaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: invalid, evaluationId: openingEvaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.facade.snapshot().canonicalJson).toBe(openingBaseline);
		expect(currentOpening(mounted)).toEqual(openingBefore);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('ends Junction and Opening gestures without a stale commit on a reading flip', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		const junction = mounted.document.junctions.find((candidate) => candidate.id === mounted.document.walls[0]!.startJunctionId)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, junction.point);
		const mark = mounted.facade.idleHoverIntent({ phase: 'move', css: from, evaluationId, coarse: false })!;
		const baseline = mounted.facade.snapshot().canonicalJson;
		expect(mounted.facade.pointerIntent({
			phase: 'down', css: from, evaluationId, handleId: mark.id, handleAdapterId: mark.adapterId
		}).claimed).toBe(true);
		const to = stageCss(mounted.facade, [junction.point[0] + 0.62, junction.point[1] + 0.77]);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: '3d' }, 11);
		settle(mounted.facade, 20);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });

		planReading(mounted.facade);
		selectOpening(mounted.facade, mounted.openingId);
		mounted.facade.setDrafting({ snapSuspended: true });
		settle(mounted.facade, 11);
		const openingBefore = currentOpening(mounted);
		const openingBaseline = mounted.facade.snapshot().canonicalJson;
		const openingEvaluationId = mounted.facade.evaluationId()!;
		const openingFrom = stageCss(mounted.facade, [openingBefore.offset + 0.05, 0]);
		const openingTo = stageCss(mounted.facade, [openingBefore.offset + 0.55, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: openingFrom, evaluationId: openingEvaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: openingTo, evaluationId: openingEvaluationId });
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: '3d' }, 21);
		settle(mounted.facade, 30);
		mounted.facade.pointerIntent({ phase: 'up', css: openingTo, evaluationId: openingEvaluationId });
		expect(mounted.facade.snapshot().canonicalJson).toBe(openingBaseline);
		expect(currentOpening(mounted)).toEqual(openingBefore);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('round-trips accepted Opening and Junction edits through the Save envelope', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		selectOpening(mounted.facade, mounted.openingId);
		mounted.facade.setDrafting({ snapSuspended: true });
		settle(mounted.facade, 11);
		const opening = currentOpening(mounted);
		const openingFrom = stageCss(mounted.facade, [opening.offset + 0.05, 0]);
		const openingTo = stageCss(mounted.facade, [opening.offset + 0.55, 0]);
		const openingEvaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: openingFrom, evaluationId: openingEvaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: openingTo, evaluationId: openingEvaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: openingTo, evaluationId: openingEvaluationId });
		await eventually(() => Math.abs(currentOpening(mounted).offset - (opening.offset + 0.5)) < 1e-6);
		settle(mounted.facade, 12);

		const junction = mounted.document.junctions.find((candidate) => candidate.id === mounted.document.walls[0]!.startJunctionId)!;
		const junctionEvaluationId = mounted.facade.evaluationId()!;
		const junctionFrom = stageCss(mounted.facade, junction.point);
		const junctionMark = mounted.facade.idleHoverIntent({ phase: 'move', css: junctionFrom, evaluationId: junctionEvaluationId, coarse: false })!;
		expect(mounted.facade.pointerIntent({
			phase: 'down', css: junctionFrom, evaluationId: junctionEvaluationId,
			handleId: junctionMark.id, handleAdapterId: junctionMark.adapterId
		}).claimed).toBe(true);
		const junctionTo = stageCss(mounted.facade, [junction.point[0] + 0.62, junction.point[1] + 0.77]);
		mounted.facade.pointerIntent({ phase: 'move', css: junctionTo, evaluationId: junctionEvaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: junctionTo, evaluationId: junctionEvaluationId });
		await eventually(() => {
			const current = acceptedLayout(mounted.facade).junctions.find((candidate) => candidate.id === junction.id);
			return current?.point[0] === 0.62 && current.point[1] === 0.77;
		});
		settle(mounted.facade, 12);

		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 's16-opening-junction-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-s16-save-reload',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		expect(readmitted.snapshot.canonicalJson).toBe(captured.capture.canonicalJson);
		expect(stageEnvelope(readmitted.snapshot).units).toEqual(stageEnvelope(mounted.facade.snapshot()).units);
	});

	it('limits Junction hover to an idle fine pointer in Plan and omits selected Wall ends', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		const junctionId = mounted.document.walls[0]!.startJunctionId;
		const junction = mounted.document.junctions.find((candidate) => candidate.id === junctionId)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const css = stageCss(mounted.facade, junction.point);
		expect(mounted.facade.idleHoverIntent({ phase: 'move', css, evaluationId, coarse: true })).toBeNull();
		expect(mounted.facade.marks().some((candidate) => candidate.id === 'layout-junction-hover')).toBe(false);
		expect(mounted.facade.idleHoverIntent({ phase: 'move', css, evaluationId, coarse: false })).not.toBeNull();
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: '3d' }, 11);
		settle(mounted.facade, 20);
		const threeDEvaluationId = mounted.facade.evaluationId()!;
		const threeDCss = stageCss(mounted.facade, junction.point);
		expect(mounted.facade.idleHoverIntent({ phase: 'move', css: threeDCss, evaluationId: threeDEvaluationId, coarse: false })).toBeNull();
		expect(mounted.facade.marks().some((candidate) => candidate.id === 'layout-junction-hover')).toBe(false);

		planReading(mounted.facade);
		selectWall(mounted.facade, mounted.wallId);
		const wall = mounted.document.walls[0]!;
		const selectedEnd = mounted.document.junctions.find((candidate) => candidate.id === wall.startJunctionId)!;
		const selectedEvaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.idleHoverIntent({
			phase: 'move', css: stageCss(mounted.facade, selectedEnd.point), evaluationId: selectedEvaluationId, coarse: false
		})).toBeNull();
		expect(mounted.facade.marks().some((candidate) => candidate.id === 'layout-junction-hover')).toBe(false);
	});

	it('does not offer an idle Junction while a task or gesture owns the Stage', async () => {
		const mounted = await mount();
		planReading(mounted.facade);
		const junction = mounted.document.junctions[0]!;
		const css = stageCss(mounted.facade, junction.point);
		const evaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.idleHoverIntent({ phase: 'move', css, evaluationId, coarse: false })).not.toBeNull();
		expect(mounted.facade.openContributedTask('layout-place-plinth')).toMatchObject({ kind: 'opened' });
		expect(mounted.facade.idleHoverIntent({ phase: 'move', css, evaluationId, coarse: false })).toBeNull();
		mounted.facade.closeTask();

		const freshMark = mounted.facade.idleHoverIntent({ phase: 'move', css, evaluationId, coarse: false });
		expect(freshMark).not.toBeNull();
		expect(mounted.facade.pointerIntent({
			phase: 'down', css, evaluationId, handleId: freshMark!.id, handleAdapterId: freshMark!.adapterId
		}).claimed).toBe(true);
		const other = mounted.document.junctions[1]!;
		expect(mounted.facade.idleHoverIntent({ phase: 'move', css: stageCss(mounted.facade, other.point), evaluationId, coarse: false })).toBeNull();
		mounted.facade.pointerIntent({ phase: 'cancel', css, evaluationId });
	});
});
