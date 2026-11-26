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

describe('gesture numeric entry', () => {
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

	it('publishes the curved Wall arc length as a read-only size-chip reading in Plan and 3D', async () => {
		const mounted = await mount();
		await bendWallAt(mounted, 4.5);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 3);

		const frame = curvedWallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		const chord = Math.hypot(frame.end[0] - frame.start[0], frame.end[1] - frame.start[1]);
		// A bent 6 m Wall is longer on its arc than its start-to-end chord, so the
		// reading can never be the chord by accident.
		expect(frame.length).toBeGreaterThan(chord + 0.01);
		const expected = `Length (arc) ${frame.length.toFixed(3)} m`;
		expect(sizeChipReading(mounted)).toBe(expected);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-length')).toBe(false);

		const bytes = mounted.facade.snapshot().canonicalJson;
		const history = mounted.host.history();

		// The chip keeps its one disclosure job: thickness/height, never a length
		// writer. Opening it changes no source and adds no history.
		revealWallSize(mounted);
		expect(sizeChipReading(mounted)).toBe(expected);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-thickness')).toBe(true);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-height')).toBe(true);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-length')).toBe(false);
		expect(mounted.facade.snapshot().canonicalJson).toBe(bytes);
		expect(mounted.host.history()).toEqual(history);

		// Plan reads the same canonical value; it is not a second evaluation.
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
		settle(mounted.facade, 4);
		expect(mounted.facade.evaluation()?.settledReading).toBe('plan');
		expect(sizeChipReading(mounted)).toBe(expected);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-length')).toBe(false);
		expect(mounted.facade.snapshot().canonicalJson).toBe(bytes);
		expect(mounted.host.history()).toEqual(history);
	});

	it('keeps the straight Wall length ray and publishes no size-chip reading', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 3);

		expect(sizeChipReading(mounted)).toBeUndefined();
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-length')).toBe(false);
		revealWallSize(mounted);
		const length = mounted.facade.marks().find((mark) => mark.id === 'layout-wall-length')!;
		expect(length.planner).toBe(LAYOUT_WALL_LENGTH_KIND);
		expect(length.tag).toMatch(/^Length [0-9.]+ m$/);
	});

	it('re-reads the curved arc length after a Split, and the fragments sum to the source', async () => {
		const mounted = await mount();
		await bendWallAt(mounted, 4.5);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 3);
		const before = acceptedLayout(mounted.facade);
		const beforeLength = curvedWallFrame(before, mounted.wallId)!.length;
		expect(sizeChipReading(mounted)).toBe(`Length (arc) ${beforeLength.toFixed(3)} m`);

		const beforeIds = new Set(before.walls.map((wall) => wall.id));
		const split = stageCardActions(mounted.facade, {
			sourceId: mounted.wallId,
			sourceKind: 'wall',
			ref: null
		}).find((action) => action.id === 'layout-wall-split')!;
		expect((await split.run()).kind).toBe('accepted');

		const after = acceptedLayout(mounted.facade);
		const created = after.walls.find((wall) => !beforeIds.has(wall.id));
		expect(created).toBeDefined();
		const startSide = curvedWallFrame(after, mounted.wallId)!.length;
		const endSide = curvedWallFrame(after, created!.id)!.length;
		// Exact cubic subdivision: the two arc readings add back to the source.
		expect(startSide + endSide).toBeCloseTo(beforeLength, 3);

		// Each fragment's own chip reads its own canonical arc, not the source's.
		for (const wallId of [mounted.wallId, created!.id]) {
			selectWall(mounted.facade, wallId);
			settle(mounted.facade, 4);
			const frame = curvedWallFrame(acceptedLayout(mounted.facade), wallId)!;
			expect(sizeChipReading(mounted)).toBe(`Length (arc) ${frame.length.toFixed(3)} m`);
		}
	});

	it('withdraws the arc reading while its Unroll sheet is open and restores it on Put back', async () => {
		const mounted = await mount();
		await bendWallAt(mounted, 4.5);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 3);
		const expected = sizeChipReading(mounted);
		expect(expected).toBeDefined();
		const compiled = mounted.facade
			.snapshot()
			.domain.geometry.walls.find((wall) => wall.wallId === mounted.wallId)!;
		try {
			wallUnfold.enter(compiled, 0);
			// The Card's entry/exit path notifies the Stage so retained
			// contributions are re-read against the open sheet.
			mounted.facade.notifySurfaceChange();
			settle(mounted.facade, 4);
			// The sheet is the editing surface: the Wall's canonical marks,
			// including the size chip and its reading, are withheld.
			expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-size-chip')).toBe(false);
		} finally {
			wallUnfold.exit();
		}
		mounted.facade.notifySurfaceChange();
		settle(mounted.facade, 5);
		expect(sizeChipReading(mounted)).toBe(expected);
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
				'layout-wall-face',
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
		const work: string[] = [];
		const previous = setWorkObserver({ count: (name) => work.push(name), span: (name) => work.push(name) });
		try {
			mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted.facade, [3, 3.1]), evaluationId });
			mounted.facade.candidatePreviews();
			mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
			expect(
				mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall-bend')
			).toBe(true);
		} finally {
			setWorkObserver(previous);
		}
		expect(work.filter((name) => name === 'compile' || name === 'validation:layout-document' || name === 'room-reconciliation')).toEqual([]);
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
		expect(mounted.session.gesture()).toBeNull();
		expect(mounted.session.liveProposal()).toBeNull();
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

	it('retries a refused Bend release without validating pointer moves', async () => {
		const base = createEmptyWallFirstLayoutDocument();
		base.floor.elevation = ELEVATION;
		base.junctions = [{ id: 'bend-start', point: [0, 0] }, { id: 'bend-end', point: [6, 0] }];
		base.walls = [{
			id: 'bend-wall', startJunctionId: 'bend-start', endJunctionId: 'bend-end',
			thickness: 0.2, height: 3, centerline: { kind: 'line' }
		}];
		const circle = planCreateCircularRoom({
			baseline: base, center: [3, 4.5], rim: [3.6, 4.5],
			capture: freshCapture(), levelId: base.floor.id
		});
		if (circle.kind !== 'success') throw new Error(circle.rejection.message);
		const mounted = await mount({ document: circle.document, wallId: 'bend-wall', openingId: '' });
		settle(mounted.facade, 2);
		selectWall(mounted.facade, 'bend-wall');
		const evaluationId = mounted.facade.evaluationId()!;
		const before = mounted.facade.snapshot().canonicalJson;
		const from = stageCss(mounted.facade, [3, 0]);
		const refused = stageCss(mounted.facade, [3, 4.5]);
		const clear = stageCss(mounted.facade, [3, 1]);

		const propose = (to: readonly [number, number]) => {
			expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
			const work: string[] = [];
			const previous = setWorkObserver({ count: (name) => work.push(name), span: (name) => work.push(name) });
			try {
				mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
				expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-wall-bend')).toBe(true);
			} finally {
				setWorkObserver(previous);
			}
			expect(work.filter((name) => name === 'compile' || name === 'validation:layout-document' || name === 'room-reconciliation')).toEqual([]);
			mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		};

		propose(refused);
		await eventually(() => mounted.facade.candidatePreviews().some((preview) =>
			preview.id === 'layout-candidate-refused-settled' && preview.labels.some((label) => label.text.includes('circular Wall'))
		));
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history().position).toBe(0);

		propose(clear);
		await eventually(() => acceptedLayout(mounted.facade).walls.find((wall) => wall.id === 'bend-wall')?.centerline.kind === 'cubic-chain');
		expect(mounted.host.history().position).toBe(1);
		mounted.facade.dispose();
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
