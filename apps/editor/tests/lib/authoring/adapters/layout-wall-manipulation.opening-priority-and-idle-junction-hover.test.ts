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
import { eventually } from '../../../kit/index';
import { createEmptyWallFirstLayoutDocument, planCreateWallFirstOpening, planExactJunctionMove, planWallChain, wallFirstWallLength, type LayoutDocumentWallFirst, type LayoutWall } from '@portfolio/layout-core/wall';
import { LAYOUT_DIMENSION_LIMIT_MESSAGE, MAX_LAYOUT_DIMENSION_METERS } from '@portfolio/layout-core/geometry';
import { planCreateCircularRoom } from '@portfolio/layout-core/room';
import { setWorkObserver } from '@portfolio/layout-core/kernel';
import type { PlanSourceRef } from '@portfolio/layout-core/world';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { captureUnitSave, readUnitEnvelopeForSave } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
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
import { curvedWallFrame, curvedWallPointAt, wallFrame } from '$lib/authoring/adapters/layout/precision-frames';
import { LAYOUT_WALL_ANGLE_KIND, LAYOUT_WALL_HEIGHT_KIND, LAYOUT_WALL_LENGTH_KIND, LAYOUT_WALL_MOVE_KIND, LAYOUT_WALL_THICKNESS_KIND } from '$lib/authoring/adapters/layout/precision';
import { wallManipulationIntent } from '$lib/authoring/adapters/layout/precision-intents';
import { typedLengthTiming } from '../../../../perf/lib/spot-measurement';
import type { PerfRecord } from '$lib/platform/perf-marks';
import { freshCapture } from '../../layout/__fixtures__/layout-id-capture';
import { pointerWallRequest } from '$lib/authoring/adapters/layout/wall-gesture';
import { resolveJunctionPointSnap, resolvePlanarDragSnap, snapWallDrag } from '$lib/authoring/adapters/layout/snap';
import { STAGE_MARK_GLYPH_CSS } from '$lib/authoring/stage/stage-handles';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';

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
/** The Wall's size chip reading as the Stage publishes it (A7.3). */
function sizeChipReading(mounted: Mounted): string | undefined {
	const chip = mounted.facade.marks().find((mark) => mark.id === 'layout-wall-size-chip');
	return chip?.descriptor.role === 'disclose' ? chip.descriptor.value : undefined;
}

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

describe('Opening priority and idle Junction hover', () => {
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
		expect(mounted.session.liveProposal()).not.toBeNull();
		expect(mounted.facade.gestureKeyIntent({ kind: 'cancel' }).claimed).toBe(true);
		expect(mounted.session.gesture()).toBeNull();
		expect(mounted.session.liveProposal()).toBeNull();
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
		expect(mounted.session.liveProposal()).not.toBeNull();
		expect(mounted.facade.gestureKeyIntent({ kind: 'cancel' }).claimed).toBe(true);
		expect(mounted.session.gesture()).toBeNull();
		expect(mounted.session.liveProposal()).toBeNull();
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
