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

/** The accepted Paper geometry for one candidate's changed sources, projected. */
function acceptedPaperCss(mounted: Mounted, sourceIds: ReadonlySet<string>): {
	readonly polygons: readonly (readonly (readonly [number, number])[])[];
	readonly segments: readonly (readonly [readonly [number, number], readonly [number, number]])[];
} {
	const planResult = mounted.facade.plan();
	if (planResult.kind !== 'evaluated') throw new Error('the accepted Plan is not evaluated');
	const document = acceptedLayout(mounted.facade);
	const compiled = compileWallFirstLayoutGeometry(document).geometry;
	const drawing = buildPaperPlan(planResult.plan, compiled, { footprints: [] });
	const polygons = drawing.fills
		.filter((fill) => sourceIds.has(fill.sourceId))
		.flatMap((fill) =>
			fill.polygons.map((polygon) =>
				polygon.map((point) => projectWorld(mounted, [point[0], fill.elevationMeters, point[1]]))
			)
		);
	const segments = drawing.lines
		.filter((line) => sourceIds.has(line.sourceId))
		.flatMap((line) =>
			line.segments.map(
				([start, end]) =>
					[
						projectWorld(mounted, [start[0], line.elevationMeters, start[1]]),
						projectWorld(mounted, [end[0], line.elevationMeters, end[1]])
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
	it('keeps the mark in the same Stage-local place when the Stage is offset', async () => {
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
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const next = acceptedLayout(mounted.facade);
			const wall = next.walls.find((entry) => entry.id === mounted.wallId);
			const start = next.junctions.find((entry) => entry.id === wall?.startJunctionId);
			return start !== undefined && Math.abs(start.point[0] - 0.5) < 1e-5;
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

	it('names the winning grid relation and shows nothing while Snap is held', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		armInk(mounted.facade);
		const evaluationId = mounted.facade.evaluationId()!;
		const css = stageCss(mounted, [1.05, 1.03]);
		expect(mounted.facade.hoverIntent({ phase: 'move', css, evaluationId })).toBe(true);
		expect(candidate(mounted, 'layout-candidate-cursor').snap?.name).toBe('Grid');

		mounted.facade.setDrafting({ snapSuspended: true });
		expect(mounted.facade.hoverIntent({ phase: 'move', css, evaluationId })).toBe(true);
		expect(
			mounted.facade.candidatePreviews().find((preview) => preview.id === 'layout-candidate-cursor')?.snap
		).toBeUndefined();
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

	it('publishes the Box candidate through the same Wall-chain planner', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
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
	});

	it('publishes the selected Opening slide candidate', async () => {
		const mounted = await mount();
		settle(mounted.facade, mounted.rect);
		const snapshot = mounted.facade.snapshot();
		const reference = {
			version: 1 as const,
			domain: 'layout' as const,
			revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
			subject: { kind: 'opening' as const, id: mounted.openingId },
			instancePath: [],
			location: {
				kind: 'layout-location' as const,
				levelId: snapshot.domain.layoutLevelId,
				structureInstancePath: []
			},
			componentId: null,
			capabilityId: null
		};
		mounted.facade.setSelection({ ordered: [{ reference }], primary: reference });
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
});
