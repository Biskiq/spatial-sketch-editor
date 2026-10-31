/**
 * R217.S14 — the live candidate preview and its snap marks.
 *
 * The suite drives the real facade, acceptance host and production Layout
 * adapter. It pins the slice's four promises:
 *
 * 1. candidate CSS is measured in Stage-local space, so an Index/Head offset
 *    moves the Stage without moving the mark within it;
 * 2. the preview's polygons/segments are the planner candidate's compiled Paper
 *    geometry, not a second interpolation;
 * 3. a refused candidate contributes no geometry, only its reason;
 * 4. the winning resolver names the mark, and Alt suppresses it.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade, type StageCandidatePreviewView } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { buildPaperPlan } from '$lib/authoring/stage/paper-plan';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { inkSurface, type InkController } from '$lib/authoring/adapters/layout/ink';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const PROJECT_ID = 'project-layout-s14-candidate';
const ELEVATION = 0.5;

type Mounted = {
	readonly facade: StageFacade;
	readonly services: StageAdapterServices;
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly openingId: string;
	readonly rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number; readonly devicePixelRatio: number };
};

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
	if (chained.kind !== 'success') throw new Error('the enclosure fixture was refused');
	const wallId = chained.document.walls[0]!.id;
	const opening = planCreateWallFirstOpening(
		chained.document,
		{ wallId, kind: 'window', offset: 1, width: 1.2, height: 1.2, sillHeight: 1 },
		freshCapture(),
		chained.document.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(`opening fixture refused: ${opening.rejection.message}`);
	return { document: opening.document, wallId, openingId: opening.changedOpeningIds[0]! };
}

async function mount(rect = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 }): Promise<Mounted> {
	const { document, wallId, openingId } = fixtureDocument();
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'S14 candidate preview',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-s14-candidate',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`S14 fixture not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	facade.camera.evaluate(rect, 1);
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
	return { facade, services, document, wallId, openingId, rect };
}

function armInk(facade: StageFacade): InkController {
	const opened = facade.openContributedTask('layout-ink');
	if (opened.kind !== 'opened') throw new Error(`Ink did not arm: ${opened.message}`);
	const surface = inkSurface();
	if (surface === null) throw new Error('Ink published no surface');
	return surface.controller;
}

function stageCss(mounted: Mounted, point: readonly [number, number]): readonly [number, number] {
	const evaluationId = mounted.facade.evaluationId();
	if (evaluationId === null) throw new Error('the fixture has no evaluation');
	const projected = mounted.facade.projectWorld([point[0], ELEVATION, point[1]], evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - mounted.rect.left, projected.css[1] - mounted.rect.top];
}

function settle(facade: StageFacade, rect: Mounted['rect'], clockSeconds = 2): void {
	const result = facade.camera.evaluate(rect, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	facade.overlays();
	facade.candidatePreviews();
}

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
	facade.setSelection({ ordered: [{ reference }], primary: reference });
}

function selectOpening(facade: StageFacade, sourceId: string): void {
	const snapshot = facade.snapshot();
	const reference = {
		version: 1 as const,
		domain: 'layout' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
		subject: { kind: 'opening' as const, id: sourceId },
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

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

async function eventually(check: () => boolean, attempts = 80): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('condition never became true');
}

/** Project one world point through the live evaluation, in Stage-local CSS. */
function projectWorld(mounted: Mounted, point: readonly [number, number, number]): readonly [number, number] {
	const evaluationId = mounted.facade.evaluationId();
	if (evaluationId === null) throw new Error('the fixture has no evaluation');
	const projected = mounted.facade.projectWorld(point, evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - mounted.rect.left, projected.css[1] - mounted.rect.top];
}

/**
 * The accepted Paper geometry for one candidate's changed sources, projected
 * on the **same datum** the candidate uses. Only x/z is being compared; the
 * candidate's own height is pinned by its bounds test.
 */
function acceptedPaperCss(mounted: Mounted, sourceIds: ReadonlySet<string>): {
	readonly polygons: readonly (readonly (readonly [number, number])[])[];
	readonly segments: readonly (readonly [readonly [number, number], readonly [number, number]])[];
} {
	const planResult = mounted.facade.plan();
	if (planResult.kind !== 'evaluated') throw new Error('the accepted Plan is not evaluated');
	const datum = mounted.facade.snapshot().domain.datumMeters;
	const document = acceptedLayout(mounted.facade);
	const compiled = compileWallFirstLayoutGeometry(document).geometry;
	const drawing = buildPaperPlan(planResult.plan, compiled, { footprints: [] });
	const polygons = drawing.fills
		.filter((fill) => sourceIds.has(fill.sourceId))
		.flatMap((fill) =>
			fill.polygons.map((polygon) => polygon.map((point) => projectWorld(mounted, [point[0], datum, point[1]])))
		);
	const segments = drawing.lines
		.filter((line) => sourceIds.has(line.sourceId))
		.flatMap((line) =>
			line.segments.map(
				([start, end]) =>
					[
						projectWorld(mounted, [start[0], datum, start[1]]),
						projectWorld(mounted, [end[0], datum, end[1]])
					] as const
			)
		);
	return { polygons, segments };
}

function candidate(mounted: Mounted, id: string): StageCandidatePreviewView {
	const found = mounted.facade.candidatePreviews().find((preview) => preview.id === id);
	if (found === undefined) throw new Error(`candidate ${id} was not contributed`);
	return found;
}

function expectPointsClose(
	actual: readonly (readonly [number, number])[],
	expected: readonly (readonly [number, number])[]
): void {
	expect(actual).toHaveLength(expected.length);
	for (const [index, point] of actual.entries()) {
		expect(point[0]).toBeCloseTo(expected[index]![0], 5);
		expect(point[1]).toBeCloseTo(expected[index]![1], 5);
	}
}

describe('R217.S14 — candidate preview coordinates', () => {
	it('keeps the mark in the same Stage-local place when the Stage is offset or resized', async () => {
		const atOrigin = await mount();
		settle(atOrigin.facade, atOrigin.rect);
		armInk(atOrigin.facade);
		const point: [number, number] = [1.05, 1.03];
		const css = stageCss(atOrigin, point);
		expect(atOrigin.facade.hoverIntent({ phase: 'move', css, evaluationId: atOrigin.facade.evaluationId()! })).toBe(true);
		const originSnap = candidate(atOrigin, 'layout-candidate-cursor').snap?.css;

		const offset = await mount({ left: 180, top: 96, width: 1280, height: 720, devicePixelRatio: 1 });
		settle(offset.facade, offset.rect);
		armInk(offset.facade);
		const offsetCss = stageCss(offset, point);
		expect(offset.facade.hoverIntent({ phase: 'move', css: offsetCss, evaluationId: offset.facade.evaluationId()! })).toBe(true);
		const offsetSnap = candidate(offset, 'layout-candidate-cursor').snap?.css;

		expect(originSnap).toBeDefined();
		expect(offsetSnap).toBeDefined();
		expect(offsetSnap![0]).toBeCloseTo(originSnap![0], 6);
		expect(offsetSnap![1]).toBeCloseTo(originSnap![1], 6);

		// A different Stage **size** may change the projection, so the mark is
		// compared with its own world point rather than the origin Stage's CSS.
		// Stage-local means it is measured inside that Stage, not that every Stage
		// must produce the same pixel.
		const resized = await mount({ left: 60, top: 24, width: 960, height: 540, devicePixelRatio: 1 });
		settle(resized.facade, resized.rect);
		armInk(resized.facade);
		const resizedCss = stageCss(resized, point);
		expect(resized.facade.hoverIntent({ phase: 'move', css: resizedCss, evaluationId: resized.facade.evaluationId()! })).toBe(true);
		const resizedSnap = candidate(resized, 'layout-candidate-cursor').snap?.css;
		const datum = resized.facade.snapshot().domain.datumMeters;
		const expected = projectWorld(resized, [1, datum, 1]);
		expect(resizedSnap).toBeDefined();
		expect(resizedSnap![0]).toBeCloseTo(expected[0], 5);
		expect(resizedSnap![1]).toBeCloseTo(expected[1], 5);
	});
});

describe('R217.S14 — overlay marker space', () => {
	it('keeps the raw pointer target in Stage-local overlay space with a nonzero rect', async () => {
		const mounted = await mount({ left: 96, top: 48, width: 1280, height: 720, devicePixelRatio: 1 });
		settle(mounted.facade, mounted.rect);
		armInk(mounted.facade);
		const evaluationId = mounted.facade.evaluationId()!;
		const at = stageCss(mounted, [1, 1]);
		expect(mounted.facade.hoverIntent({ phase: 'move', css: at, evaluationId })).toBe(true);
		const marker = mounted.facade.overlays().find((entry) => entry.id === 'layout-ink-target');
		expect(marker).toBeDefined();
		const expected = stageCss(mounted, [1, 1]);
		expect(marker!.css[0]).toBeCloseTo(expected[0], 5);
		expect(marker!.css[1]).toBeCloseTo(expected[1], 5);
	});

	it('keeps the Opening refusal marker in the same Stage-local space', async () => {
		const mounted = await mount({ left: 96, top: 48, width: 1280, height: 720, devicePixelRatio: 1 });
		settle(mounted.facade, mounted.rect);
		armInk(mounted.facade).setReading('opening');
		const evaluationId = mounted.facade.evaluationId()!;
		const at = stageCss(mounted, [5.95, 0]);
		expect(mounted.facade.hoverIntent({ phase: 'move', css: at, evaluationId })).toBe(true);
		const marker = mounted.facade.overlays().find((entry) => entry.id === 'layout-opening-refusal');
		expect(marker).toBeDefined();
		const expected = stageCss(mounted, [5.95, 0]);
		expect(marker!.css[0]).toBeCloseTo(expected[0], 5);
		expect(marker!.css[1]).toBeCloseTo(expected[1], 5);
	});

	it('keeps the last Wall candidate when a move leaves the datum plane', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, mounted.rect);
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted, [3, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		// Prove a candidate existed before the pointer leaves the plane; otherwise
		// the withdrawal assertion would pass for a gesture that never proposed.
		expect(
			mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted, [3.5, 0.5]), evaluationId }).claimed
		).toBe(true);
		expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-wall')).toBe(true);
		expect(
			mounted.facade.pointerIntent({ phase: 'move', css: [640, -400], evaluationId }).claimed
		).toBe(true);
		// R217.S15 — the press is still live and the last valid sample is the one
		// release would commit; a bad ray does not withdraw it.
		expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-wall')).toBe(true);
		mounted.facade.pointerIntent({ phase: 'cancel', css: [640, -400], evaluationId });
	});
});

describe('R217.S14 — the preview is the candidate geometry', () => {
	it('matches the compiled Paper drawing of the Wall move release commits', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted, [3, 0]);
		const to = stageCss(mounted, [3.5, 0.5]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const preview = candidate(mounted, 'layout-candidate-wall');
		expect(preview.polygons.length + preview.segments.length).toBeGreaterThan(0);
		const neighbours = mounted.facade
			.candidatePreviews()
			.find((entry) => entry.id === 'layout-candidate-neighbours');
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const next = acceptedLayout(mounted.facade);
			const wall = next.walls.find((entry) => entry.id === mounted.wallId);
			const start = next.junctions.find((entry) => entry.id === wall?.startJunctionId);
			return start !== undefined && Math.abs(start.point[1] - 0.5) < 1e-5;
		});
		settle(mounted.facade, mounted.rect, 3);

		const document = acceptedLayout(mounted.facade);
		const wall = document.walls.find((entry) => entry.id === mounted.wallId)!;
		const sourceIds = new Set([mounted.wallId, ...document.openings.filter((entry) => entry.wallId === wall.id).map((entry) => entry.id)]);
		const accepted = acceptedPaperCss(mounted, sourceIds);
		expect(preview.polygons.length).toBe(accepted.polygons.length);
		for (const [index, polygon] of preview.polygons.entries()) {
			expectPointsClose(polygon, accepted.polygons[index]!);
		}
		expect(preview.segments.length).toBe(accepted.segments.length);
		for (const [index, segment] of preview.segments.entries()) {
			expectPointsClose(segment, accepted.segments[index]!);
		}

		// The affected contribution is the same promise for reshaped neighbours,
		// derived here from the accepted topology rather than the preview's list.
		const affectedWalls = new Set(
			document.walls
				.filter(
					(entry) =>
						entry.id !== wall.id &&
						[entry.startJunctionId, entry.endJunctionId].some(
							(id) => id === wall.startJunctionId || id === wall.endJunctionId
						)
				)
				.map((entry) => entry.id)
		);
		const affectedSourceIds = new Set([
			...affectedWalls,
			...document.openings.filter((entry) => affectedWalls.has(entry.wallId)).map((entry) => entry.id)
		]);
		const acceptedAffected = acceptedPaperCss(mounted, affectedSourceIds);
		expect(neighbours).toBeDefined();
		expect(neighbours!.polygons.length).toBe(acceptedAffected.polygons.length);
		for (const [index, polygon] of neighbours!.polygons.entries()) {
			expectPointsClose(polygon, acceptedAffected.polygons[index]!);
		}
		expect(neighbours!.segments.length).toBe(acceptedAffected.segments.length);
		for (const [index, segment] of neighbours!.segments.entries()) {
			expectPointsClose(segment, acceptedAffected.segments[index]!);
		}
	});

	it('draws every candidate point on the level datum, never the Paper cut elevation', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const datum = mounted.facade.snapshot().domain.datumMeters;
		const plan = mounted.facade.plan();
		if (plan.kind !== 'evaluated') throw new Error('the fixture Plan is not evaluated');
		expect(plan.plan.cutElevationMeters).not.toBeCloseTo(datum, 5);
		const from = stageCss(mounted, [3, 0]);
		const to = stageCss(mounted, [3.5, 0.5]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const preview = candidate(mounted, 'layout-candidate-wall');
		expect(preview.bounds).not.toBeNull();
		// A 3D evaluation must sit the footprint on the mat, not float it at the
		// Paper cut. Plan alone cannot see the difference, so bounds pin the height.
		expect(preview.bounds!.min[1]).toBeCloseTo(datum, 9);
		expect(preview.bounds!.max[1]).toBeCloseTo(datum, 9);
	});

	it('matches the compiled Paper drawing of the Opening placement release commits', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		const baseline = mounted.facade.snapshot().canonicalJson;
		armInk(mounted.facade).setReading('opening');
		const evaluationId = mounted.facade.evaluationId()!;
		const at = stageCss(mounted, [3, 0]);
		expect(mounted.facade.hoverIntent({ phase: 'move', css: at, evaluationId })).toBe(true);
		const preview = candidate(mounted, 'layout-candidate-opening');
		expect(preview.polygons.length + preview.segments.length).toBeGreaterThan(0);
		mounted.facade.pointerIntent({ phase: 'down', css: at, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: at, evaluationId });
		await eventually(
			() =>
				mounted.facade.snapshot().canonicalJson !== baseline &&
				acceptedLayout(mounted.facade).openings.length === 2
		);
		settle(mounted.facade, mounted.rect, 3);

		const document = acceptedLayout(mounted.facade);
		const opening = document.openings.find((entry) => entry.id !== mounted.openingId)!;
		// The created Opening and the host Wall it changed, exactly the preview's
		// changed-id filter.
		const sourceIds = new Set([opening.id, opening.wallId]);
		const accepted = acceptedPaperCss(mounted, sourceIds);
		expect(preview.polygons.length).toBe(accepted.polygons.length);
		for (const [index, polygon] of preview.polygons.entries()) {
			expectPointsClose(polygon, accepted.polygons[index]!);
		}
		expect(preview.segments.length).toBe(accepted.segments.length);
		for (const [index, segment] of preview.segments.entries()) {
			expectPointsClose(segment, accepted.segments[index]!);
		}
	});
});

describe('R217.S14 — refusals and snap words', () => {
	it('proposes no geometry for a refused chain and shows its reason', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		controller.typePoint('1', '5');
		const refused = candidate(mounted, 'layout-candidate-chain-refused');
		expect(refused.role).toBe('refused');
		expect(refused.polygons).toEqual([]);
		expect(refused.segments).toEqual([]);
		expect(refused.labels[0]?.text.length).toBeGreaterThan(20);
	});

	it('names the winning grid relation and drops only the snap while Snap is held', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		const controller = armInk(mounted.facade);
		// One typed point keeps a pending leg, so the candidate exists on its own
		// merit. Without it, a no-snap assertion could pass because the whole
		// preview vanished with the pointer having nothing left to draw.
		controller.typePoint('1', '1');
		const evaluationId = mounted.facade.evaluationId()!;
		const css = stageCss(mounted, [2.05, 2.03]);
		expect(mounted.facade.hoverIntent({ phase: 'move', css, evaluationId })).toBe(true);
		expect(candidate(mounted, 'layout-candidate-chain').snap?.name).toBe('Grid');

		mounted.facade.setDrafting({ snapSuspended: true });
		settle(mounted.facade, mounted.rect);
		expect(mounted.facade.hoverIntent({ phase: 'move', css, evaluationId })).toBe(true);
		expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-chain')).toBe(true);
		expect(candidate(mounted, 'layout-candidate-chain').segments.length).toBeGreaterThan(0);
		expect(
			mounted.facade.candidatePreviews().find((preview) => preview.id === 'layout-candidate-chain')?.snap
		).toBeUndefined();
	});

	it('withdraws a refused Wall candidate, names the refusal and installs nothing', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, mounted.rect);
		const end = mounted.facade.marks().find((mark) => mark.id === 'layout-wall-end-mark');
		if (end === undefined) throw new Error('the Wall end mark is not projected');
		const evaluationId = mounted.facade.evaluationId()!;
		const from: [number, number] = [end.anchor[0] + mounted.rect.left, end.anchor[1] + mounted.rect.top];
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		const across = stageCss(mounted, [-0.5, 0]);
		mounted.facade.pointerIntent({ phase: 'move', css: across, evaluationId });
		expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-wall')).toBe(false);
		const refused = mounted.facade.marks().find((mark) => mark.id === 'layout-wall-end-mark');
		expect(refused?.refusal).toContain('cross');
		expect(refused?.refusal).not.toContain('topology_invalid');

		const baseline = mounted.facade.snapshot().canonicalJson;
		mounted.facade.pointerIntent({ phase: 'up', css: across, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
	});

	it('publishes only the refusal for an Opening that does not fit its Wall', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		armInk(mounted.facade).setReading('opening');
		const evaluationId = mounted.facade.evaluationId()!;
		const nearEnd = stageCss(mounted, [5.95, 0]);
		expect(mounted.facade.hoverIntent({ phase: 'move', css: nearEnd, evaluationId })).toBe(true);
		const refused = mounted.facade
			.candidatePreviews()
			.find((preview) => preview.id === 'layout-candidate-opening-refused');
		expect(refused).toBeDefined();
		expect(refused!.role).toBe('refused');
		expect(refused!.polygons).toEqual([]);
		expect(refused!.segments).toEqual([]);
		expect(refused!.labels[0]?.text.length).toBeGreaterThan(10);
		expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-opening')).toBe(false);
	});

	it('names the orthogonal guide Aligned from the previous chain point', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		const controller = armInk(mounted.facade);
		controller.typePoint('1', '1');
		const evaluationId = mounted.facade.evaluationId()!;
		const css = stageCss(mounted, [1.02, 2]);
		expect(mounted.facade.hoverIntent({ phase: 'move', css, evaluationId })).toBe(true);
		const aligned = mounted.facade
			.candidatePreviews()
			.find((preview) => preview.id === 'layout-candidate-chain' || preview.id === 'layout-candidate-cursor');
		expect(aligned?.snap?.name).toBe('Aligned');
	});

	it('publishes the Box candidate through the same Wall-chain planner and its release matches', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		const baseline = acceptedLayout(mounted.facade);
		const baselineWallIds = new Set(baseline.walls.map((entry) => entry.id));
		const baselineRoomIds = new Set(baseline.rooms.map((entry) => entry.id));
		armInk(mounted.facade).setWallMode('box');
		const evaluationId = mounted.facade.evaluationId()!;
		const first = stageCss(mounted, [8, 0]);
		mounted.facade.pointerIntent({ phase: 'down', css: first, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: first, evaluationId });
		const opposite = stageCss(mounted, [11, 3]);
		expect(mounted.facade.hoverIntent({ phase: 'move', css: opposite, evaluationId })).toBe(true);
		const preview = candidate(mounted, 'layout-candidate-chain');
		expect(preview.role).toBe('subject');
		expect(preview.polygons.length + preview.segments.length).toBeGreaterThan(0);

		mounted.facade.pointerIntent({ phase: 'down', css: opposite, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: opposite, evaluationId });
		await eventually(() => acceptedLayout(mounted.facade).walls.length > baseline.walls.length);
		settle(mounted.facade, mounted.rect, 3);

		const document = acceptedLayout(mounted.facade);
		const createdWalls = document.walls.filter((entry) => !baselineWallIds.has(entry.id));
		const createdRooms = document.rooms.filter((entry) => !baselineRoomIds.has(entry.id));
		const sourceIds = new Set([...createdWalls.map((entry) => entry.id), ...createdRooms.map((entry) => entry.id)]);
		const accepted = acceptedPaperCss(mounted, sourceIds);
		expect(preview.polygons.length).toBe(accepted.polygons.length);
		for (const [index, polygon] of preview.polygons.entries()) {
			expectPointsClose(polygon, accepted.polygons[index]!);
		}
		expect(preview.segments.length).toBe(accepted.segments.length);
		for (const [index, segment] of preview.segments.entries()) {
			expectPointsClose(segment, accepted.segments[index]!);
		}
	});

	it('publishes the selected Opening slide candidate', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		selectOpening(mounted.facade, mounted.openingId);
		settle(mounted.facade, mounted.rect);
		const slide = mounted.facade.marks().find((mark) => mark.id === 'layout-opening-position')!;
		const evaluationId = mounted.facade.evaluationId()!;
		const from: [number, number] = [slide.anchor[0] + mounted.rect.left, slide.anchor[1] + mounted.rect.top];
		const to = stageCss(mounted, [2.5, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const preview = candidate(mounted, 'layout-candidate-opening-mark');
		expect(preview.role).toBe('subject');
		expect(preview.polygons.length + preview.segments.length).toBeGreaterThan(0);
	});

	it('snaps the selected Opening slide through the resolver and names Grid', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		selectOpening(mounted.facade, mounted.openingId);
		settle(mounted.facade, mounted.rect);
		const before = acceptedLayout(mounted.facade).openings.find((entry) => entry.id === mounted.openingId)!;
		const slide = mounted.facade.marks().find((mark) => mark.id === 'layout-opening-position')!;
		const evaluationId = mounted.facade.evaluationId()!;
		const from: [number, number] = [slide.anchor[0] + mounted.rect.left, slide.anchor[1] + mounted.rect.top];
		// The body anchor is the Opening centre; 2.52 is within the 8 CSS px
		// acquisition radius of the 2.5 m grid centre, so the winner is Grid and
		// the committed start edge is the centre minus half the width.
		const to = stageCss(mounted, [2.52, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const preview = candidate(mounted, 'layout-candidate-opening-mark');
		expect(preview.snap?.name).toBe('Grid');
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const next = acceptedLayout(mounted.facade).openings.find((entry) => entry.id === mounted.openingId);
			return next !== undefined && Math.abs(next.offset - 1.9) < 1e-6;
		});
		expect(before.offset).toBeCloseTo(1, 6);
	});
});
