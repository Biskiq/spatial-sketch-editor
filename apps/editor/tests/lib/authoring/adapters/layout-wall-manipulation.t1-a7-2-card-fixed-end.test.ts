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

describe('Card fixed-end choice on Wall length', () => {
	/** A Junction's accepted point, read from the canonical document. */
	function junctionPoint(document: LayoutDocumentWallFirst, junctionId: string): readonly [number, number] {
		const junction = document.junctions.find((candidate) => candidate.id === junctionId);
		if (junction === undefined) throw new Error(`the fixture has no Junction ${junctionId}`);
		return junction.point;
	}

	/** Every other Wall incident to one Junction, with the far endpoint it keeps. */
	function incidentWalls(
		document: LayoutDocumentWallFirst,
		wallId: string,
		junctionId: string
	): readonly { readonly id: string; readonly farJunctionId: string }[] {
		return document.walls
			.filter(
				(candidate) =>
					candidate.id !== wallId &&
					(candidate.startJunctionId === junctionId || candidate.endJunctionId === junctionId)
			)
			.map((candidate) => ({
				id: candidate.id,
				farJunctionId:
					candidate.startJunctionId === junctionId ? candidate.endJunctionId : candidate.startJunctionId
			}));
	}

	it('switches the anchor without writing the document, history or a proposal', async () => {
		const mounted = await mount();
		selectWall(mounted.facade, mounted.wallId);
		const accept = vi.fn(async () => ({ kind: 'no-op' } as const));
		const instrument = createLayoutInstrument({
			subject: { kind: 'wall', id: mounted.wallId },
			document: mounted.document,
			projectId: PROJECT_ID,
			contentRevision: mounted.facade.snapshot().domain.unitRevisions.layout,
			port: { accept, acceptedRevision: () => mounted.services.authoring.acceptedRevision() }
		});
		const before = mounted.facade.snapshot().canonicalJson;
		const history = mounted.host.history();

		instrument.setFixedEndpoint('end');
		expect(instrument.fixedEndpoint()).toBe('end');
		instrument.setFixedEndpoint('start');
		expect(instrument.fixedEndpoint()).toBe('start');

		expect(accept).not.toHaveBeenCalled();
		expect(instrument.proposalLive()).toBe(false);
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history()).toEqual(history);
	});

	it('keeps Start fixed, moves End through its shared Junction, and preserves every identity', async () => {
		const mounted = await mount();
		const instrument = typedInstrument(mounted);
		const before = acceptedLayout(mounted.facade);
		const beforePoints = wallPoints(before, mounted.wallId);
		const source = before.walls.find((wall) => wall.id === mounted.wallId)!;
		const neighbours = incidentWalls(before, mounted.wallId, source.endJunctionId);
		const openings = before.openings.map((opening) => ({
			id: opening.id,
			wallId: opening.wallId,
			offset: opening.offset,
			width: opening.width
		}));
		const rooms = before.rooms.map((room) => ({ id: room.id, boundary: room.boundary }));

		instrument.setFixedEndpoint('start');
		instrument.edit('length', '5');
		expect(await instrument.commit('length')).toEqual({ kind: 'accepted' });

		const after = acceptedLayout(mounted.facade);
		const afterPoints = wallPoints(after, mounted.wallId);
		// Start is untouched; End travelled the authored direction to 5 m.
		expect(afterPoints.start[0]).toBeCloseTo(beforePoints.start[0], 9);
		expect(afterPoints.start[1]).toBeCloseTo(beforePoints.start[1], 9);
		expect(afterPoints.end[0]).toBeCloseTo(beforePoints.start[0] + 5, 9);
		expect(afterPoints.end[1]).toBeCloseTo(beforePoints.start[1], 9);
		expect(afterPoints.length).toBeCloseTo(5, 9);
		// The moved Junction is shared: every incident Wall followed it, and each
		// neighbour's far Junction stayed where it was.
		expect(neighbours.length).toBeGreaterThan(0);
		for (const neighbour of neighbours) {
			const moved = junctionPoint(after, source.endJunctionId);
			expect(moved[0]).toBeCloseTo(afterPoints.end[0], 9);
			expect(moved[1]).toBeCloseTo(afterPoints.end[1], 9);
			expect(junctionPoint(after, neighbour.farJunctionId)).toEqual(
				junctionPoint(before, neighbour.farJunctionId)
			);
		}
		expect(
			after.openings.map((opening) => ({
				id: opening.id,
				wallId: opening.wallId,
				offset: opening.offset,
				width: opening.width
			}))
		).toEqual(openings);
		expect(after.rooms.map((room) => ({ id: room.id, boundary: room.boundary }))).toEqual(rooms);
		expect(after.walls.map((wall) => wall.id)).toEqual(before.walls.map((wall) => wall.id));
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('keeps End fixed, moves Start through its shared Junction, and preserves every identity', async () => {
		const mounted = await mount();
		const instrument = typedInstrument(mounted);
		const before = acceptedLayout(mounted.facade);
		const beforePoints = wallPoints(before, mounted.wallId);
		const source = before.walls.find((wall) => wall.id === mounted.wallId)!;
		const neighbours = incidentWalls(before, mounted.wallId, source.startJunctionId);
		const openings = before.openings.map((opening) => ({
			id: opening.id,
			wallId: opening.wallId,
			offset: opening.offset,
			width: opening.width
		}));
		const roomIds = before.rooms.map((room) => room.id);

		instrument.setFixedEndpoint('end');
		instrument.edit('length', '5');
		expect(await instrument.commit('length')).toEqual({ kind: 'accepted' });

		const after = acceptedLayout(mounted.facade);
		const afterPoints = wallPoints(after, mounted.wallId);
		// End is untouched; Start travelled back along the authored direction.
		expect(afterPoints.end[0]).toBeCloseTo(beforePoints.end[0], 9);
		expect(afterPoints.end[1]).toBeCloseTo(beforePoints.end[1], 9);
		expect(afterPoints.start[0]).toBeCloseTo(beforePoints.end[0] - 5, 9);
		expect(afterPoints.start[1]).toBeCloseTo(beforePoints.end[1], 9);
		expect(afterPoints.length).toBeCloseTo(5, 9);
		expect(neighbours.length).toBeGreaterThan(0);
		for (const neighbour of neighbours) {
			const moved = junctionPoint(after, source.startJunctionId);
			expect(moved[0]).toBeCloseTo(afterPoints.start[0], 9);
			expect(moved[1]).toBeCloseTo(afterPoints.start[1], 9);
			expect(junctionPoint(after, neighbour.farJunctionId)).toEqual(
				junctionPoint(before, neighbour.farJunctionId)
			);
		}
		expect(
			after.openings.map((opening) => ({
				id: opening.id,
				wallId: opening.wallId,
				offset: opening.offset,
				width: opening.width
			}))
		).toEqual(openings);
		expect(after.rooms.map((room) => room.id)).toEqual(roomIds);
		expect(after.walls.map((wall) => wall.id)).toEqual(before.walls.map((wall) => wall.id));
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('refuses an End-fixed length that leaves the hosted Opening unfit, writing nothing', async () => {
		const mounted = await mount();
		const instrument = typedInstrument(mounted);
		const before = acceptedLayout(mounted.facade);
		const beforeJson = mounted.facade.snapshot().canonicalJson;
		const history = mounted.host.history();

		instrument.setFixedEndpoint('end');
		instrument.edit('length', '2');
		const outcome = await instrument.commit('length');
		// The host reports the planner's rejection and keeps the planner's words.
		expect(outcome).toMatchObject({ kind: 'refused', code: 'planner-rejected' });
		if (outcome.kind !== 'refused') throw new Error('the unfit Opening was not refused');
		expect(outcome.message).toContain(`Opening '${mounted.openingId}' does not fit on Wall`);
		// Atomic: the source, history and the creator's explicit anchor are untouched.
		expect(acceptedLayout(mounted.facade)).toEqual(before);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeJson);
		expect(mounted.host.history()).toEqual(history);
		expect(instrument.fixedEndpoint()).toBe('end');
	});

	it('replays the End-fixed length through Undo and Redo with the same ids and bytes', async () => {
		const mounted = await mount();
		const instrument = typedInstrument(mounted);
		const baseline = mounted.facade.snapshot().canonicalJson;
		const baselineIds = acceptedLayout(mounted.facade).walls.map((wall) => wall.id);

		instrument.setFixedEndpoint('end');
		instrument.edit('length', '5');
		expect(await instrument.commit('length')).toEqual({ kind: 'accepted' });
		const committed = mounted.facade.snapshot().canonicalJson;
		const committedLayout = acceptedLayout(mounted.facade);
		expect(committedLayout.walls.map((wall) => wall.id)).toEqual(baselineIds);
		expect(committedLayout.openings.some((opening) => opening.id === mounted.openingId)).toBe(true);

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(committed);
		expect(acceptedLayout(mounted.facade)).toEqual(committedLayout);
	});
});
