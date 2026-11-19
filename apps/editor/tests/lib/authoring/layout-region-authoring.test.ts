/**
 * T1 V1c — Terrace and Flat Roof authoring through the production adapter.
 *
 * T-V11, T-V12 and T-V13 live here: the one Ink Pen's region readings, the
 * retained planners behind the region marks and Card, one gesture = one history
 * entry, Undo/Redo, Esc and a refused overlapping birth, the Space association
 * and the Lift list that now includes authored slabs.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometryFresh,
	createEmptyWallFirstLayoutDocument,
	planCreateRegion,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { AuthoringIntent } from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import {
	stageCardActions,
	stageCardFacts,
	stageCardWriter
} from '$lib/authoring/stage/stage-contributions';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
import { layoutRoomFacts } from '$lib/authoring/adapters/layout/precision';
import { interiorLift, liftedSourcesNow } from '$lib/authoring/layout/interior-lift-store.svelte';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { captureFor } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-t1-v1c-region-authoring';
const ELEVATION = 0.5;

function fixtureDocument(): { document: LayoutDocumentWallFirst; terraceId: string; canopyId: string } {
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
		capture: captureFor('v1c-room'),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the V1c enclosure was refused');
	const terrace = planCreateRegion({
		baseline: chained.document,
		capture: captureFor('v1c-terrace'),
		intent: { role: 'floor', footprint: [[1, 1], [3, 1], [3, 3], [1, 3]], elevation: 0.4, thickness: 0.1, name: 'Terrace' }
	});
	if (terrace.kind !== 'success') throw new Error(`the terrace fixture was refused: ${terrace.rejection.message}`);
	const canopy = planCreateRegion({
		baseline: terrace.document,
		capture: captureFor('v1c-canopy'),
		intent: { role: 'overhead', footprint: [[1, 1], [3, 1], [3, 3], [1, 3]], elevation: 2.6, thickness: 0.15, name: 'Canopy' }
	});
	if (canopy.kind !== 'success') throw new Error(`the canopy fixture was refused: ${canopy.rejection.message}`);
	return { document: canopy.document, terraceId: terrace.regionId, canopyId: canopy.regionId };
}

async function mount(fixture = fixtureDocument()) {
	const { document, terraceId, canopyId } = fixture;
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'V1c region authoring',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-t1-v1c-region-authoring',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`the fixture was not admitted: ${admitted.kind}`);
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
	let services: Parameters<typeof createAdapter>[0] | undefined;
	const intents: AuthoringIntent[] = [];
	const registration = mountStageAdapter(facade, host, (port) => {
		services = port;
		return createAdapter({
			...port,
			authoring: {
				...port.authoring,
				accept: async (intent) => {
					intents.push(intent);
					return port.authoring.accept(intent);
				}
			}
		});
	});
	if (registration.kind !== 'registered' || services === undefined) throw new Error('the Layout adapter did not mount');
	const roomId = stageEnvelope(facade.snapshot()).units.layout.data.rooms[0]!.id;
	return { facade, session, host, services, document, roomId, terraceId, canopyId, intents };
}

type Mounted = Awaited<ReturnType<typeof mount>>;

const acceptedLayout = (mounted: Mounted): LayoutDocumentWallFirst =>
	stageEnvelope(mounted.facade.snapshot()).units.layout.data;

const regionOf = (mounted: Mounted, id: string) =>
	acceptedLayout(mounted).regions.find((region) => region.id === id);

function settle(mounted: Mounted, clockSeconds = 6): void {
	const result = mounted.facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	mounted.facade.overlays();
	mounted.facade.tasks();
}

function selectRegion(mounted: Mounted, regionId: string): void {
	const snapshot = mounted.facade.snapshot();
	const reference = {
		version: 1 as const,
		domain: 'layout' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
		subject: { kind: 'region' as const, id: regionId },
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
	settle(mounted);
}

function stageCss(mounted: Mounted, point: readonly [number, number], y = ELEVATION): readonly [number, number] {
	const evaluationId = mounted.facade.evaluationId();
	if (evaluationId === null) throw new Error('the mounted fixture has no evaluation');
	const projected = mounted.facade.projectWorld([point[0], y, point[1]], evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

function press(mounted: Mounted, point: readonly [number, number], handleId?: string) {
	return mounted.facade.pointerIntent({
		phase: 'down',
		css: stageCss(mounted, point),
		evaluationId: mounted.facade.evaluationId()!,
		...(handleId === undefined ? {} : { handleId })
	});
}

function dragTo(mounted: Mounted, point: readonly [number, number], from?: readonly [number, number]): void {
	mounted.facade.pointerIntent({
		phase: 'move',
		css: stageCss(mounted, from ?? point),
		evaluationId: mounted.facade.evaluationId()!
	});
	mounted.facade.pointerIntent({
		phase: 'move',
		css: stageCss(mounted, point),
		evaluationId: mounted.facade.evaluationId()!
	});
	mounted.facade.pointerIntent({
		phase: 'up',
		css: stageCss(mounted, point),
		evaluationId: mounted.facade.evaluationId()!
	});
}

async function eventually(check: () => boolean, attempts = 400): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('condition never became true');
}

function armInk(mounted: Mounted) {
	const opened = mounted.facade.openContributedTask('layout-ink');
	if (opened.kind !== 'opened') throw new Error(`Ink did not arm: ${opened.message}`);
	const surface = inkSurface();
	if (surface === null) throw new Error('Ink published no surface');
	return surface.controller;
}

afterEach(() => {
	interiorLift.clear();
});

describe('T1 V1c — regions through the production Layout adapter', () => {
	it('publishes every retained region planner and the region Card surface', async () => {
		const mounted = await mount();
		const subject = { sourceId: mounted.terraceId, sourceKind: 'region' } as never;
		selectRegion(mounted, mounted.terraceId);

		const facts = stageCardFacts(mounted.facade, subject);
		expect(facts.map((fact) => fact.label)).toEqual(
			expect.arrayContaining(['Kind', 'Area', 'Top (world)'])
		);
		const writer = stageCardWriter(mounted.facade, subject);
		expect(writer?.fieldIds).toEqual(['elevation', 'thickness', 'width', 'depth']);
		expect(stageCardActions(mounted.facade, subject).map((action) => action.id)).toEqual([
			'layout-region-delete'
		]);
	});

	it('moves a selected region by its body in one history entry, and Undo restores it', async () => {
		const mounted = await mount();
		selectRegion(mounted, mounted.terraceId);
		const before = acceptedLayout(mounted);
		const depth = mounted.host.history().depth;

		// A region has no move glyph: pressing its selected body is the move writer.
		expect(press(mounted, [2, 2]).claimed).toBe(true);
		dragTo(mounted, [3, 2], [2, 2]);
		await eventually(() => regionOf(mounted, mounted.terraceId)?.footprint.points[0]![0] !== 1);
		expect(regionOf(mounted, mounted.terraceId)?.footprint.points[0]![0]).toBeCloseTo(2, 2);
		expect(mounted.host.history().depth).toBe(depth + 1);

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)?.footprint.points).toEqual(before.regions[0]!.footprint.points);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)?.footprint.points[0]![0]).toBeCloseTo(2, 2);
	});

	it('Esc during a corner drag writes no document and no history', async () => {
		const mounted = await mount();
		selectRegion(mounted, mounted.terraceId);
		const before = acceptedLayout(mounted);
		const depth = mounted.host.history().depth;

		expect(press(mounted, [1, 1], 'layout-region-corner:0').claimed).toBe(true);
		mounted.facade.pointerIntent({
			phase: 'move',
			css: stageCss(mounted, [0.5, 0.5]),
			evaluationId: mounted.facade.evaluationId()!
		});
		expect(mounted.facade.gestureKeyIntent({ kind: 'cancel' }).claimed).toBe(true);

		expect(acceptedLayout(mounted)).toEqual(before);
		expect(mounted.host.history().depth).toBe(depth);
	});

	it('draws a Terrace with a Box at the Height Sheet and 0.10 m thick, then Undo removes it', async () => {
		const mounted = await mount();
		const controller = armInk(mounted);
		controller.setReading('terrace');
		const surface = inkSurface()!;
		mounted.facade.session.heightSheet().set(0.45, 'key');
		settle(mounted);
		const depth = mounted.host.history().depth;

		expect(press(mounted, [8, 6]).claimed).toBe(true);
		expect(surface.snapshot().points).toHaveLength(1);
		mounted.facade.pointerIntent({
			phase: 'move',
			css: stageCss(mounted, [10, 8]),
			evaluationId: mounted.facade.evaluationId()!
		});
		mounted.facade.pointerIntent({
			phase: 'up',
			css: stageCss(mounted, [10, 8]),
			evaluationId: mounted.facade.evaluationId()!
		});
		await eventually(
			() => acceptedLayout(mounted).regions.length === 3 || surface.snapshot().refusal !== null
		);
		expect(surface.snapshot().refusal).toBeNull();
		const created = acceptedLayout(mounted).regions.at(-1)!;
		expect(created.role).toBe('floor');
		expect(created.elevation).toBeCloseTo(0.45, 6);
		expect(created.thickness).toBeCloseTo(0.1, 6);
		expect(mounted.host.history().depth).toBe(depth + 1);

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(acceptedLayout(mounted).regions).toHaveLength(2);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(acceptedLayout(mounted).regions).toHaveLength(3);
	});

	it('draws a Flat Roof from Line taps, and takes the Wall default at the datum', async () => {
		const mounted = await mount();
		const controller = armInk(mounted);
		controller.setReading('roof');
		const surface = inkSurface()!;
		controller.setRegionMode('line');
		mounted.facade.session.heightSheet().set(0, 'key');
		settle(mounted);

		for (const point of [
			[8, 6],
			[10, 6],
			[10, 8]
		] as const) {
			press(mounted, point);
			mounted.facade.pointerIntent({
				phase: 'up',
				css: stageCss(mounted, point),
				evaluationId: mounted.facade.evaluationId()!
			});
		}
				expect(surface.snapshot().points.length).toBe(3);
		expect(surface.snapshot().canFinish).toBe(true);
		surface.controller.finish();
		await eventually(
			() => acceptedLayout(mounted).regions.length === 3 || surface.snapshot().refusal !== null
		);
		expect(surface.snapshot().refusal).toBeNull();
		const created = acceptedLayout(mounted).regions.at(-1)!;
		expect(created.role).toBe('overhead');
		expect(created.elevation).toBeCloseTo(3, 6);
	});

	it('refuses an overlapping birth in words, keeps the draft, and adds no history', async () => {
		const mounted = await mount();
		const controller = armInk(mounted);
		controller.setReading('terrace');
		const surface = inkSurface()!;
		// The fixture Terrace is at 0.40 m: the same band, drawn over the same plan
		// area, is the interpenetration G5 refuses.
		mounted.facade.session.heightSheet().set(0.4, 'key');
		settle(mounted);
		const depth = mounted.host.history().depth;

		press(mounted, [1.5, 1.5]);
		mounted.facade.pointerIntent({
			phase: 'move',
			css: stageCss(mounted, [3.5, 3.5]),
			evaluationId: mounted.facade.evaluationId()!
		});
		mounted.facade.pointerIntent({
			phase: 'up',
			css: stageCss(mounted, [3.5, 3.5]),
			evaluationId: mounted.facade.evaluationId()!
		});
		await eventually(() => surface.snapshot().refusal !== null);
		expect(surface.snapshot().refusal).toBeTruthy();
		expect(acceptedLayout(mounted).regions).toHaveLength(2);
		expect(mounted.host.history().depth).toBe(depth);
		surface.controller.cancel();
		expect(surface.snapshot().points).toHaveLength(0);
	});

	it('draws the selected Region’s measured gaps and no cue for an unselected one', async () => {
		const mounted = await mount();
		expect(
			mounted.facade
				.candidatePreviews()
				.filter((preview) => preview.id.startsWith('layout-region-gap:'))
		).toHaveLength(0);

		selectRegion(mounted, mounted.terraceId);
		const gaps = mounted.facade
			.candidatePreviews()
			.filter((preview) => preview.id.startsWith('layout-region-gap:'));
		expect(gaps.length).toBeGreaterThan(0);
		expect(gaps.every((gap) => gap.segments.length === 1)).toBe(true);
		expect(gaps.map((gap) => gap.labels[0]!.text)).toEqual(
			expect.arrayContaining([expect.stringMatching(/^Gap 0\.90 m$/)])
		);
	});

	it('groups the regions in the Space Card, and deletes one through the Card with Undo', async () => {
		const mounted = await mount();
		const layout = acceptedLayout(mounted);
		const geometry = compileWallFirstLayoutGeometryFresh(layout).geometry;
		const facts = layoutRoomFacts(layout, geometry, mounted.roomId);
		expect(facts.find((fact) => fact.label === 'Regions')?.value).toContain('Terrace');

		selectRegion(mounted, mounted.terraceId);
		const actions = stageCardActions(mounted.facade, {
			sourceId: mounted.terraceId,
			sourceKind: 'region'
		} as never);
		const remove = actions.find((action) => action.id === 'layout-region-delete');
		expect(remove?.destructive).toBe(true);
		expect(remove?.detail).toContain('objects rest on this platform');
		expect(await remove!.run()).toEqual({ kind: 'accepted' });
		expect(regionOf(mounted, mounted.terraceId)).toBeUndefined();
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)).toBeDefined();
	});

	it('Lift names authored slabs beside generated lids, and Put back ends the reading', async () => {
		const mounted = await mount();
		const geometry = compileWallFirstLayoutGeometryFresh(acceptedLayout(mounted)).geometry;
		interiorLift.lift({ kind: 'all' });
		const sources = liftedSourcesNow(geometry);
		expect(sources.map((source) => source.key.kind)).toEqual(
			expect.arrayContaining(['room-lid', 'region'])
		);
		// Only an overhead is an overhead: the floor Terrace stays in the world.
		expect(sources.map((source) => source.subject.id)).toEqual(
			expect.arrayContaining([mounted.canopyId])
		);
		expect(sources.map((source) => source.subject.id)).not.toContain(mounted.terraceId);
		interiorLift.putBack();
		expect(liftedSourcesNow(geometry)).toEqual([]);
	});
});
