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

describe('pointer Wall manipulation', () => {
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

		// A reading flip is a new evaluation: the CSS the gesture measured is not
		// the CSS that is drawn any more.
		const reading = mounted.facade.evaluation()!.settledReading;
		mounted.facade.camera.applyIntent(
			{ kind: 'set-reading', reading: reading === 'plan' ? '3d' : 'plan' },
			2
		);
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
		const reading = mounted.facade.evaluation()!.settledReading;
		mounted.facade.camera.applyIntent(
			{ kind: 'set-reading', reading: reading === 'plan' ? '3d' : 'plan' },
			2
		);
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
