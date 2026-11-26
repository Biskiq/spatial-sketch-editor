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

describe('Wall direct manipulation', () => {
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
