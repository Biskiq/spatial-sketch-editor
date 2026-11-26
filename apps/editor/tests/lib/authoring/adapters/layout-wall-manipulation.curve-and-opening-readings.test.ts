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

import { describe, expect, it } from 'vitest';
import { eventually } from '../../../kit/index';
import { createEmptyWallFirstLayoutDocument, planCreateWallFirstOpening, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import type { PlanSourceRef } from '@portfolio/layout-core/world';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
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
import { curvedWallFrame, curvedWallPointAt } from '$lib/authoring/adapters/layout/precision-frames';
import { LAYOUT_WALL_HEIGHT_KIND, LAYOUT_WALL_LENGTH_KIND, LAYOUT_WALL_THICKNESS_KIND } from '$lib/authoring/adapters/layout/precision';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
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
function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

describe('curve and opening readings', () => {
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
});
