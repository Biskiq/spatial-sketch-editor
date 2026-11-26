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
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
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

describe('Layout marks, numeric entry and coarse pointers', () => {
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
		let notifications = 0;
		const unsubscribe = mounted.facade.onAdaptersChanged(() => notifications++);
		try {
			mounted.facade.pointerIntent({ phase: 'move', css: rayCss, evaluationId });
			expect(notifications).toBe(0);
			mounted.facade.pointerIntent({ phase: 'up', css: rayCss, evaluationId });
			expect(notifications).toBe(1);
			expect(mounted.session.liveProposal()).not.toBeNull();
		} finally {
			unsubscribe();
		}
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
