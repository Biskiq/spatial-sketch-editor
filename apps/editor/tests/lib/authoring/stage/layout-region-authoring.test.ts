/**
 * T1 V1c — Terrace and Flat Roof authoring through the production adapter.
 *
 * T-V11, T-V12 and T-V13 live here: the one Ink Pen's region readings, the
 * retained planners behind the region marks and Card, one gesture = one history
 * entry, Undo/Redo, Esc and a refused overlapping birth, the Space association
 * and the Lift list that now includes authored slabs.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometryFresh, pointInPolygon } from '@portfolio/layout-core/geometry';
import { createEmptyWallFirstLayoutDocument, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { planCreateRegion, planSetRegionForm, regionWallRelations } from '@portfolio/layout-core/room';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneEntity } from '@portfolio/project-model/scene';
import { creatorModelResourceEntry } from '@portfolio/project-model/scene-planning';
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
import { layoutRoomFacts } from '$lib/authoring/adapters/layout/precision-facts';
import { restingObjectsOnFloorRegion } from '$lib/authoring/adapters/layout/region-resting';
import {
	LAYOUT_REGION_FIT_ROOF_KIND,
	LAYOUT_REGION_FIT_WALLS_KIND,
	LAYOUT_REGION_FORM_KIND,
	LAYOUT_REGION_THICKNESS_KIND,
	regionEditIntent
} from '$lib/authoring/adapters/layout/region-planners';
import {
	regionSectionFrame,
	regionSectionKey,
	regionSectionOf
} from '$lib/authoring/adapters/layout/region-section';
import { syncRegionShape } from '$lib/authoring/adapters/layout/region-shape-lifecycle';
import { regionFitRefusalWords } from '$lib/authoring/adapters/layout/refusals';
import { regionShape } from '$lib/authoring/layout/region-shape-store';
import { wallFace } from '$lib/authoring/layout/wall-face-store';
import { interiorLift, liftedSourcesNow } from '$lib/authoring/layout/interior-lift-store.svelte';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { captureFor } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
import { startStageCounting, type StageCounting } from '../../../helpers/stage-counts';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const OFFSET_RECT = { left: 352, top: 119, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-t1-v1c-region-authoring';
const ELEVATION = 0.5;
/** The fixture Terrace's world top: the floor datum plus its own elevation. */
const TERRACE_TOP = ELEVATION + 0.4;
const MODEL_ASSET_ID = 't1-v1c-terrace-model';

/** One approved creator model, with its resource contact at the instance origin. */
function creatorModelEntry() {
	const entry = creatorModelResourceEntry(MODEL_ASSET_ID, {
		derivative: {
			hash: `sha256-${'a'.repeat(64)}`,
			mime: 'model/gltf-binary',
			size: 4096,
			locator: 'models/t1-v1c-terrace-model.glb'
		},
		source: { manifestHash: `sha256-${'b'.repeat(64)}`, size: 8192, fileCount: 1 },
		recipe: { id: 'creator-import@1', version: 1 },
		reportDigest: `sha256-${'c'.repeat(64)}`,
		placement: {
			metresPerSourceUnit: 1,
			pivot: [0, 0, 0],
			footprint: { width: 0.8, depth: 0.8 },
			contactMinY: 0
		}
	});
	if (entry === null) throw new Error('the creator-model fixture was refused');
	return entry;
}

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

async function mount(
	fixture = fixtureDocument(),
	options: {
		readonly withCreatorModel?: boolean;
		readonly rect?: typeof RECT;
	} = {}
) {
	const rect = options.rect ?? RECT;
	const { document, terraceId, canopyId } = fixture;
	const compiledTerrace = compileWallFirstLayoutGeometryFresh(document).geometry.regions.find(
		(region) => region.regionId === terraceId
	);
	if (compiledTerrace === undefined) throw new Error('the fixture Terrace did not compile');
	const creatorEntry = options.withCreatorModel ? creatorModelEntry() : null;
	const model: SceneEntity | null = options.withCreatorModel
		? {
				kind: 'model',
				id: 'entity-t1-v1c-terrace-model',
				name: 'Approved terrace model',
				assetId: MODEL_ASSET_ID,
				fallback: 'generic',
				position: [2, compiledTerrace.topY, 2],
				rotation: [0, 0, 0]
			}
		: null;
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'V1c region authoring',
		layout: document,
		// The legacy shape is split into the current Scene and Camera units by
		// the shared fixture, so this stays one admitted-shape envelope.
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: model === null ? [] : [model],
			navigationNodes: [],
			connections: []
		},
		...(creatorEntry === null
			? {}
			: {
					resources: { formatVersion: 3 as const, resources: [creatorEntry.resource] },
					dependencyLock: { formatVersion: 1, entries: [creatorEntry.lock] }
				})
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
	return {
		facade,
		session,
		host,
		services,
		document,
		roomId,
		terraceId,
		canopyId,
		modelId: model?.id ?? null,
		rect,
		intents
	};
}

type Mounted = Awaited<ReturnType<typeof mount>>;

const acceptedLayout = (mounted: Mounted): LayoutDocumentWallFirst =>
	stageEnvelope(mounted.facade.snapshot()).units.layout.data;

const regionOf = (mounted: Mounted, id: string) =>
	acceptedLayout(mounted).regions.find((region) => region.id === id);

function settle(mounted: Mounted, clockSeconds = 6): void {
	const result = mounted.facade.camera.evaluate(mounted.rect, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	mounted.facade.overlays();
	mounted.facade.tasks();
}

function selectRegion(mounted: Mounted, regionId: string, componentId: string | null = null): void {
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
	// A Plan pick names the Region's `edge` stream; it is not an F.1 component.
	const representation = {
		sourceId: regionId,
		sourceKind: 'region' as const,
		generationId: snapshot.compileGeneration,
		stream: 'cut' as const,
		subRef: componentId === null ? null : { kind: 'component' as const, componentId }
	};
	mounted.facade.setSelection({ ordered: [{ reference, representation }], primary: reference });
	settle(mounted);
}

function worldCss(
	mounted: Mounted,
	point: readonly [number, number, number]
): readonly [number, number] {
	const evaluationId = mounted.facade.evaluationId();
	if (evaluationId === null) throw new Error('the mounted fixture has no evaluation');
	const projected = mounted.facade.projectWorld(point, evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - mounted.rect.left, projected.css[1] - mounted.rect.top];
}

function stageCss(mounted: Mounted, point: readonly [number, number], y = ELEVATION): readonly [number, number] {
	return worldCss(mounted, [point[0], y, point[1]]);
}

function press(
	mounted: Mounted,
	point: readonly [number, number],
	handleId?: string,
	y = ELEVATION
) {
	return mounted.facade.pointerIntent({
		phase: 'down',
		css: stageCss(mounted, point, y),
		evaluationId: mounted.facade.evaluationId()!,
		...(handleId === undefined ? {} : { handleId })
	});
}

function moveTo(
	mounted: Mounted,
	point: readonly [number, number],
	from?: readonly [number, number],
	y = ELEVATION
): void {
	mounted.facade.pointerIntent({
		phase: 'move',
		css: stageCss(mounted, from ?? point, y),
		evaluationId: mounted.facade.evaluationId()!
	});
	mounted.facade.pointerIntent({
		phase: 'move',
		css: stageCss(mounted, point, y),
		evaluationId: mounted.facade.evaluationId()!
	});
}

function releaseAt(mounted: Mounted, point: readonly [number, number], y = ELEVATION): void {
	mounted.facade.pointerIntent({
		phase: 'up',
		css: stageCss(mounted, point, y),
		evaluationId: mounted.facade.evaluationId()!
	});
}

function dragTo(mounted: Mounted, point: readonly [number, number], from?: readonly [number, number]): void {
	moveTo(mounted, point, from);
	releaseAt(mounted, point);
}

/** The live region proposal, before release. */
function regionPreview(mounted: Mounted): readonly (readonly [number, number])[] {
	const preview = mounted.facade
		.candidatePreviews()
		.find((candidate) => candidate.id === 'layout-region-candidate');
	return preview?.polygons[0] ?? [];
}

/** An accepted footprint projected through the same evaluation as the preview. */
function footprintCss(
	mounted: Mounted,
	points: readonly (readonly [number, number])[],
	elevation: number
): readonly (readonly [number, number])[] {
	return points.map(([x, z]) => stageCss(mounted, [x, z], ELEVATION + elevation));
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

let counting: StageCounting | null = null;

afterEach(() => {
	interiorLift.clear();
	regionShape.close();
	wallFace.clear();
	counting?.stop();
	counting = null;
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

	it('keeps a Region selected through its edge stream when a body move is accepted', async () => {
		const mounted = await mount();
		// The browser selects a Region from its `edge` Plan fragment. That stream
		// component is not an F.1 component, so the accepted edit must not retire the
		// selection and close the Card on release.
		selectRegion(mounted, mounted.terraceId, 'edge');
		expect(mounted.facade.selectionState().primary?.subject).toEqual({
			kind: 'region',
			id: mounted.terraceId
		});

		expect(press(mounted, [2, 2]).claimed).toBe(true);
		dragTo(mounted, [3, 2], [2, 2]);
		await eventually(() => regionOf(mounted, mounted.terraceId)?.footprint.points[0]![0] !== 1);
		settle(mounted);

		expect(regionOf(mounted, mounted.terraceId)?.footprint.points[0]![0]).toBeCloseTo(2, 2);
		expect(mounted.facade.selectionState().primary?.subject).toEqual({
			kind: 'region',
			id: mounted.terraceId
		});
		expect(mounted.facade.selectionState().ordered).toHaveLength(1);
	});

	it('removes a corner on its neighbours\' chord even when snap moves the corner off it', async () => {
		const mounted = await mount();
		selectRegion(mounted, mounted.terraceId);
		const before = acceptedLayout(mounted);
		const depth = mounted.host.history().depth;

		// Removal reads the raw pointer, as the bend rule does. The pointer is
		// 0.11 m from the chord, so the corner is removed; the corner itself sits
		// on the Terrace's own plane, not on the floor datum below it.
		expect(press(mounted, [1, 1], 'layout-region-corner:0', TERRACE_TOP).claimed).toBe(true);
		moveTo(mounted, [0.5, 0.5], [1, 1], TERRACE_TOP);
		moveTo(mounted, [2.1, 1.75], undefined, TERRACE_TOP);
		releaseAt(mounted, [2.1, 1.75], TERRACE_TOP);
		await eventually(() => regionOf(mounted, mounted.terraceId)?.footprint.points.length === 3);

		const removed = regionOf(mounted, mounted.terraceId)!;
		expect(removed.footprint.points).toHaveLength(3);
		expect(mounted.host.history().depth).toBe(depth + 1);

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)?.footprint.points).toEqual(
			before.regions[0]!.footprint.points
		);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)?.footprint.points).toHaveLength(3);
	});

	it('installs the exact corner preview in one entry, with no compile or history during the drag', async () => {
		const mounted = await mount();
		selectRegion(mounted, mounted.terraceId);
		const before = acceptedLayout(mounted);
		const depth = mounted.host.history().depth;
		counting = startStageCounting();

		expect(press(mounted, [1, 1], 'layout-region-corner:0').claimed).toBe(true);
		moveTo(mounted, [0.6, 0.6], [1, 1]);
		const preview = regionPreview(mounted);
		expect(preview).toHaveLength(4);
		// Pointer movement is proposal math only: no whole Layout compile, no F4
		// write and no history entry before the release.
		expect(counting.count('compile')).toBe(0);
		expect(mounted.intents).toHaveLength(0);
		expect(mounted.host.history().depth).toBe(depth);
		expect(acceptedLayout(mounted)).toEqual(before);

		releaseAt(mounted, [0.6, 0.6]);
		await eventually(() => regionOf(mounted, mounted.terraceId)?.footprint.points[0]![0] !== 1);
		settle(mounted);
		const accepted = regionOf(mounted, mounted.terraceId)!;
		expect(mounted.host.history().depth).toBe(depth + 1);
		const installed = footprintCss(mounted, accepted.footprint.points, accepted.elevation);
		expect(installed).toHaveLength(preview.length);
		installed.forEach(([x, y], index) => {
			expect(x).toBeCloseTo(preview[index]![0], 1);
			expect(y).toBeCloseTo(preview[index]![1], 1);
		});

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)?.footprint.points).toEqual(before.regions[0]!.footprint.points);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)?.footprint.points).toEqual(accepted.footprint.points);
	});

	it('installs the exact body preview in one entry, without compiling or writing before release', async () => {
		const mounted = await mount();
		selectRegion(mounted, mounted.terraceId);
		const before = acceptedLayout(mounted);
		const depth = mounted.host.history().depth;
		counting = startStageCounting();

		expect(press(mounted, [2, 2]).claimed).toBe(true);
		moveTo(mounted, [3, 2], [2, 2]);
		const preview = regionPreview(mounted);
		expect(preview).toHaveLength(4);
		expect(counting.count('compile')).toBe(0);
		expect(mounted.intents).toHaveLength(0);
		expect(mounted.host.history().depth).toBe(depth);
		expect(acceptedLayout(mounted)).toEqual(before);

		releaseAt(mounted, [3, 2]);
		await eventually(() => regionOf(mounted, mounted.terraceId)?.footprint.points[0]![0] !== 1);
		settle(mounted);
		const accepted = regionOf(mounted, mounted.terraceId)!;
		expect(mounted.host.history().depth).toBe(depth + 1);
		const installed = footprintCss(mounted, accepted.footprint.points, accepted.elevation);
		installed.forEach(([x, y], index) => {
			expect(x).toBeCloseTo(preview[index]![0], 1);
			expect(y).toBeCloseTo(preview[index]![1], 1);
		});
	});

	it('maps the height ray through an offset Stage rect', async () => {
		const gesture = async (rect: typeof RECT): Promise<number> => {
			const mounted = await mount(fixtureDocument(), { rect });
			selectRegion(mounted, mounted.terraceId);
			expect(press(mounted, [2, 2], 'layout-region-height').claimed).toBe(true);
			moveTo(mounted, [2, 1.2], [2, 2]);
			releaseAt(mounted, [2, 1.2]);
			await eventually(
				() => (regionOf(mounted, mounted.terraceId)?.elevation ?? 0) > 0.4
			);
			return regionOf(mounted, mounted.terraceId)!.elevation;
		};

		// The same world-space gesture must read the same height whether the Stage
		// starts at the viewport origin or is offset by the Index beside it.
		expect(await gesture(OFFSET_RECT)).toBeCloseTo(await gesture(RECT), 9);
	});

	it('projects raised body and turn drags on the slab face in 3D', async () => {
		const mounted = await mount();
		selectRegion(mounted, mounted.terraceId);
		mounted.facade.camera.applyIntent(
			{
				kind: 'set-view',
				eye: [8, 2.2, 8],
				target: [2, 0.9, 2],
				fovYDegrees: 50
			},
			2
		);
		settle(mounted, 2);
		const faceY = ELEVATION + 0.4;

		expect(press(mounted, [2, 2], undefined, faceY).claimed).toBe(true);
		moveTo(mounted, [3, 2], [2, 2], faceY);
		releaseAt(mounted, [3, 2], faceY);
		await eventually(() => regionOf(mounted, mounted.terraceId)?.footprint.points[0]![0] !== 1);
		settle(mounted);
		const moved = regionOf(mounted, mounted.terraceId)!;
		expect(moved.footprint.points[0]![0]).toBeCloseTo(2, 6);
		expect(moved.footprint.points[0]![1]).toBeCloseTo(1, 6);

		// The turn mark is drawn on the same face: its angular reference is the
		// slab point under the pointer, not the datum point behind it.
		const pivot: readonly [number, number] = [3, 2];
		const radius = Math.SQRT2 + 0.5;
		const startLocal: readonly [number, number] = [pivot[0] + radius, pivot[1]];
		const target: readonly [number, number] = [
			pivot[0] + radius * Math.cos(Math.PI / 4),
			pivot[1] + radius * Math.sin(Math.PI / 4)
		];
		const beforeAngle = Math.atan2(
			moved.footprint.points[0]![1] - pivot[1],
			moved.footprint.points[0]![0] - pivot[0]
		);
		expect(press(mounted, startLocal, 'layout-region-turn-mark', faceY).claimed).toBe(true);
		moveTo(mounted, target, startLocal, faceY);
		releaseAt(mounted, target, faceY);
		await eventually(() => {
			const current = regionOf(mounted, mounted.terraceId);
			return current !== undefined && current.footprint.points[0]![1] !== moved.footprint.points[0]![1];
		});
		settle(mounted);
		const turned = regionOf(mounted, mounted.terraceId)!;
		const afterAngle = Math.atan2(
			turned.footprint.points[0]![1] - pivot[1],
			turned.footprint.points[0]![0] - pivot[0]
		);
		const delta = Math.atan2(Math.sin(afterAngle - beforeAngle), Math.cos(afterAngle - beforeAngle));
		expect(Math.abs(delta)).toBeCloseTo(Math.PI / 4, 2);
	});

	it('raises a Region by its height ray in one exact previewed history entry', async () => {
		const mounted = await mount();
		selectRegion(mounted, mounted.terraceId);
		const before = regionOf(mounted, mounted.terraceId)!;
		const depth = mounted.host.history().depth;

		expect(press(mounted, [2, 2], 'layout-region-height').claimed).toBe(true);
		moveTo(mounted, [2, 1.2], [2, 2]);
		const preview = regionPreview(mounted);
		expect(preview).toHaveLength(4);
		expect(mounted.host.history().depth).toBe(depth);
		expect(regionOf(mounted, mounted.terraceId)?.elevation).toBe(before.elevation);

		releaseAt(mounted, [2, 1.2]);
		await eventually(() => (regionOf(mounted, mounted.terraceId)?.elevation ?? 0) !== before.elevation);
		settle(mounted);
		const accepted = regionOf(mounted, mounted.terraceId)!;
		expect(accepted.elevation).toBeGreaterThan(before.elevation);
		expect(mounted.host.history().depth).toBe(depth + 1);
		const installed = footprintCss(mounted, accepted.footprint.points, accepted.elevation);
		installed.forEach(([x, y], index) => {
			expect(x).toBeCloseTo(preview[index]![0], 1);
			expect(y).toBeCloseTo(preview[index]![1], 1);
		});

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)?.elevation).toBeCloseTo(before.elevation, 9);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)?.elevation).toBeCloseTo(accepted.elevation, 9);
	});

	it('keeps a corner click and a refused corner as no-ops, and refuses a stale edit', async () => {
		const mounted = await mount();
		selectRegion(mounted, mounted.terraceId);
		const before = acceptedLayout(mounted);
		const depth = mounted.host.history().depth;

		// A press without travel is a click, not an edit.
		expect(press(mounted, [1, 1], 'layout-region-corner:0', TERRACE_TOP).claimed).toBe(true);
		releaseAt(mounted, [1, 1], TERRACE_TOP);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(acceptedLayout(mounted)).toEqual(before);
		expect(mounted.host.history().depth).toBe(depth);

		// Dragging a corner onto another corner makes a degenerate footprint; the
		// release refuses in words and writes neither document nor history.
		expect(press(mounted, [1, 1], 'layout-region-corner:0', TERRACE_TOP).claimed).toBe(true);
		moveTo(mounted, [3, 3], [1, 1], TERRACE_TOP);
		releaseAt(mounted, [3, 3], TERRACE_TOP);
		await eventually(() =>
			mounted.facade
				.candidatePreviews()
				.some((candidate) => candidate.id === 'layout-candidate-refused-settled')
		);
		expect(acceptedLayout(mounted)).toEqual(before);
		expect(mounted.host.history().depth).toBe(depth);

		// An intent built against the pre-edit revision is refused after another
		// accepted region edit changed the revision.
		const snapshot = mounted.facade.snapshot();
		const stale = regionEditIntent({
			kind: LAYOUT_REGION_THICKNESS_KIND,
			regionId: mounted.terraceId,
			payload: { thickness: 0.25 },
			operationId: globalThis.crypto.randomUUID(),
			projectId: snapshot.acceptedRevision.projectId,
			revisionId: snapshot.acceptedRevision.revisionId,
			contentRevision: snapshot.domain.unitRevisions.layout,
			levelId: snapshot.domain.layoutLevelId
		});
		const fresh = regionEditIntent({
			kind: LAYOUT_REGION_THICKNESS_KIND,
			regionId: mounted.terraceId,
			payload: { thickness: 0.2 },
			operationId: globalThis.crypto.randomUUID(),
			projectId: snapshot.acceptedRevision.projectId,
			revisionId: snapshot.acceptedRevision.revisionId,
			contentRevision: snapshot.domain.unitRevisions.layout,
			levelId: snapshot.domain.layoutLevelId
		});
		expect((await mounted.host.accept(fresh)).kind).toBe('installed');
		expect((await mounted.host.accept(stale)).kind).toBe('refused');
		expect(mounted.host.history().depth).toBe(depth + 1);
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
		// The cue projects the relation's own measurement endpoints, not a
		// corner-to-centerline chord that would be longer than the label.
		const horizontal = gaps.find((gap) => gap.labels[0]!.text === 'Gap 0.90 m')!;
		const geometry = compileWallFirstLayoutGeometryFresh(acceptedLayout(mounted)).geometry;
		const relations = regionWallRelations(geometry, regionOf(mounted, mounted.terraceId)!);
		expect(relations.kind).toBe('relations');
		if (relations.kind !== 'relations') return;
		const relation = relations.relations.find(
			(candidate) => candidate.reading === 'gap' && candidate.measureAxis === 'horizontal'
		)!;
		const segment = relation.measureSegment!;
		const [from, to] = horizontal.segments[0]!;
		const expectedFrom = worldCss(mounted, segment.from);
		const expectedTo = worldCss(mounted, segment.to);
		expect(from[0]).toBeCloseTo(expectedFrom[0], 1);
		expect(from[1]).toBeCloseTo(expectedFrom[1], 1);
		expect(to[0]).toBeCloseTo(expectedTo[0], 1);
		expect(to[1]).toBeCloseTo(expectedTo[1], 1);
	});

	it('adds a corner through the picked edge’s scoped action, not a midpoint press', async () => {
		const mounted = await mount();
		selectRegion(mounted, mounted.terraceId);
		const before = acceptedLayout(mounted);
		const depth = mounted.host.history().depth;
		const evaluationId = mounted.facade.evaluationId()!;
		const midpoint = stageCss(mounted, [2, 1], ELEVATION + 0.4);
		const mark = mounted.facade.idleHoverIntent({
			phase: 'move',
			css: midpoint,
			evaluationId,
			coarse: false
		});
		expect(mark?.id).toBe('layout-region-edge:0');

		// Picking the edge is not an edit: no document and no history until the
		// Card's scoped action runs.
		expect(
			mounted.facade.pointerIntent({
				phase: 'down',
				css: midpoint,
				evaluationId,
				handleId: mark!.id,
				handleAdapterId: mark!.adapterId
			}).claimed
		).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: midpoint, evaluationId });
		settle(mounted);
		expect(acceptedLayout(mounted)).toEqual(before);
		expect(mounted.host.history().depth).toBe(depth);

		const subject = { sourceId: mounted.terraceId, sourceKind: 'region' } as never;
		const add = stageCardActions(mounted.facade, subject).find(
			(action) => action.id === 'layout-region-add-corner'
		);
		expect(add?.detail).toContain('edge 1');
		expect(await add!.run()).toEqual({ kind: 'accepted' });
		await eventually(
			() => (regionOf(mounted, mounted.terraceId)?.footprint.points.length ?? 0) === 5
		);
		settle(mounted);
		expect(mounted.host.history().depth).toBe(depth + 1);
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)?.footprint.points).toEqual(
			before.regions.find((region) => region.id === mounted.terraceId)!.footprint.points
		);
	});

	it('counts an approved creator model on a raised Terrace, and keeps Scene bytes through move and Erase', async () => {
		const mounted = await mount(fixtureDocument(), { withCreatorModel: true });
		const sceneBytes = () =>
			JSON.stringify(stageEnvelope(mounted.facade.snapshot()).units.scene.data);
		const before = sceneBytes();
		expect(mounted.modelId).not.toBeNull();
		expect(stageEnvelope(mounted.facade.snapshot()).units.scene.data.entities).toHaveLength(1);
		expect(restingObjectsOnFloorRegion(mounted.facade.snapshot(), mounted.terraceId)).toBe(1);

		selectRegion(mounted, mounted.terraceId);
		const subject = { sourceId: mounted.terraceId, sourceKind: 'region' } as never;
		const beforeMove = stageCardActions(mounted.facade, subject).find(
			(action) => action.id === 'layout-region-delete'
		);
		expect(beforeMove?.detail).toContain('1 object rests on this platform');
		expect(sceneBytes()).toBe(before);

		// A body drag moves the platform away from the model; Layout-only edits
		// never write the Scene source.
		expect(press(mounted, [2, 2]).claimed).toBe(true);
		dragTo(mounted, [3.5, 2], [2, 2]);
		await eventually(() => regionOf(mounted, mounted.terraceId)?.footprint.points[0]![0] !== 1);
		settle(mounted);
		expect(restingObjectsOnFloorRegion(mounted.facade.snapshot(), mounted.terraceId)).toBe(0);
		expect(sceneBytes()).toBe(before);

		const remove = stageCardActions(mounted.facade, subject).find(
			(action) => action.id === 'layout-region-delete'
		);
		expect(remove?.detail).toContain('0 objects rest on this platform');
		expect(await remove!.run()).toEqual({ kind: 'accepted' });
		expect(regionOf(mounted, mounted.terraceId)).toBeUndefined();
		expect(sceneBytes()).toBe(before);
		expect(stageEnvelope(mounted.facade.snapshot()).units.scene.data.entities[0]!.id).toBe(
			mounted.modelId
		);

		// Undo restores the platform under the untouched model, so the derived
		// count returns without a Scene write.
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)).toBeDefined();
		expect(restingObjectsOnFloorRegion(mounted.facade.snapshot(), mounted.terraceId)).toBe(0);
		expect(sceneBytes()).toBe(before);
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(regionOf(mounted, mounted.terraceId)?.footprint.points[0]![0]).toBeCloseTo(1, 2);
		expect(restingObjectsOnFloorRegion(mounted.facade.snapshot(), mounted.terraceId)).toBe(1);
		expect(sceneBytes()).toBe(before);
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

/** The V1c fixture plus a shed over the whole enclosure (T1 V3b). */
function slopedRoofFixture(thickness: number) {
	const fixture = fixtureDocument();
	const created = planCreateRegion({
		baseline: fixture.document,
		capture: captureFor(`v3b-shed-${thickness}`),
		intent: { role: 'overhead', footprint: [[-1, -1], [7, -1], [7, 5], [-1, 5]], elevation: 3.2, thickness, name: 'Shed' }
	});
	if (created.kind !== 'success') throw new Error(`the shed fixture was refused: ${created.rejection.message}`);
	const formed = planSetRegionForm(created.document, created.regionId, { kind: 'shed', rise: 1.6, azimuth: 0 });
	if (formed.kind !== 'success') throw new Error(`the shed form was refused: ${formed.rejection.message}`);
	return { fixture: { ...fixture, document: formed.document }, shedId: created.regionId };
}

describe('T1 V3b — sloped fits through the production Layout adapter', () => {
	function fitIntent(mounted: Mounted, kind: string, regionId: string) {
		const snapshot = mounted.facade.snapshot();
		return regionEditIntent({
			kind,
			regionId,
			payload: { wallIds: acceptedLayout(mounted).walls.map((wall) => wall.id) },
			operationId: globalThis.crypto.randomUUID(),
			projectId: snapshot.acceptedRevision.projectId,
			revisionId: snapshot.acceptedRevision.revisionId,
			contentRevision: snapshot.domain.unitRevisions.layout,
			levelId: snapshot.domain.layoutLevelId
		});
	}
	const readings = (mounted: Mounted, regionId: string) => {
		const layout = acceptedLayout(mounted);
		const result = regionWallRelations(
			compileWallFirstLayoutGeometryFresh(layout).geometry,
			layout.regions.find((region) => region.id === regionId)!
		);
		if (result.kind !== 'relations') throw new Error(JSON.stringify(result));
		return result.relations.map((relation) => relation.reading);
	};

	it('fits roof then walls in one history entry each, with exact Undo and Redo', async () => {
		const { fixture, shedId } = slopedRoofFixture(0.3);
		const mounted = await mount(fixture);
		const depth = mounted.host.history().depth;
		const original = JSON.stringify(acceptedLayout(mounted));

		expect((await mounted.host.accept(fitIntent(mounted, LAYOUT_REGION_FIT_ROOF_KIND, shedId))).kind).toBe('installed');
		expect(mounted.host.history().depth).toBe(depth + 1);
		const roofFitted = JSON.stringify(acceptedLayout(mounted));
		expect(readings(mounted, shedId)).not.toContain('crosses');

		expect((await mounted.host.accept(fitIntent(mounted, LAYOUT_REGION_FIT_WALLS_KIND, shedId))).kind).toBe('installed');
		expect(mounted.host.history().depth).toBe(depth + 2);
		const wallsFitted = JSON.stringify(acceptedLayout(mounted));
		expect(new Set(readings(mounted, shedId))).toEqual(new Set(['meets']));

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(JSON.stringify(acceptedLayout(mounted))).toBe(roofFitted);
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(JSON.stringify(acceptedLayout(mounted))).toBe(original);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(JSON.stringify(acceptedLayout(mounted))).toBe(wallsFitted);
	});

	it('refuses a fit that would project through a thin roof and writes no history', async () => {
		// 0.2 m Walls under a 0.2 slope spread 0.04 m; a 0.02 m roof cannot seal it.
		const { fixture, shedId } = slopedRoofFixture(0.02);
		const mounted = await mount(fixture);
		const depth = mounted.host.history().depth;
		const before = JSON.stringify(acceptedLayout(mounted));
		const refused = await mounted.host.accept(fitIntent(mounted, LAYOUT_REGION_FIT_WALLS_KIND, shedId));
		expect(refused).toMatchObject({ kind: 'refused', reason: 'region_fit_wall_overrun' });
		expect(mounted.host.history().depth).toBe(depth);
		expect(JSON.stringify(acceptedLayout(mounted))).toBe(before);
	});
});

/** T1 V3c — creator-facing Shed/Gable birth, Card fields, Edit shape and Section. */
const U_FOOTPRINT: [number, number][] = [
	[-1, -1],
	[7, -1],
	[7, 5],
	[5, 5],
	[5, 1],
	[1, 1],
	[1, 5],
	[-1, 5]
];

function uRoofFixture(azimuth: number) {
	const fixture = fixtureDocument();
	const created = planCreateRegion({
		baseline: fixture.document,
		capture: captureFor('v3c-u-roof'),
		intent: {
			role: 'overhead',
			footprint: U_FOOTPRINT,
			elevation: 3.2,
			thickness: 0.3,
			name: 'U Gable',
			form: { kind: 'gable', rise: 1.6, azimuth }
		}
	});
	if (created.kind !== 'success') throw new Error(`the U gable fixture was refused: ${created.rejection.message}`);
	return { fixture: { ...fixture, document: created.document }, roofId: created.regionId };
}

/** The section must stay inside one covered interval of the footprint. */
function expectSectionInsideOneInterval(
	section: NonNullable<ReturnType<typeof regionSectionOf>>,
	footprint: readonly (readonly [number, number])[]
): void {
	expect(section.ridge).not.toBeNull();
	expect(pointInPolygon(section.ridge!.point, footprint)).toBe(true);
	for (let index = 1; index < 20; index += 1) {
		const t = index / 20;
		const point: readonly [number, number] = [
			section.low.point[0] + (section.high.point[0] - section.low.point[0]) * t,
			section.low.point[1] + (section.high.point[1] - section.low.point[1]) * t
		];
		expect(pointInPolygon(point, footprint), `section crossed a void at t=${t}`).toBe(true);
	}
}

function gableRoofFixture() {
	const fixture = fixtureDocument();
	const created = planCreateRegion({
		baseline: fixture.document,
		capture: captureFor('v3c-gable-authoring'),
		intent: {
			role: 'overhead',
			footprint: [[-1, -1], [7, -1], [7, 5], [-1, 5]],
			elevation: 3.2,
			thickness: 0.3,
			name: 'Gable',
			form: { kind: 'gable', rise: 1.6, azimuth: 0 }
		}
	});
	if (created.kind !== 'success') throw new Error(`the gable fixture was refused: ${created.rejection.message}`);
	return { fixture: { ...fixture, document: created.document }, gableId: created.regionId };
}

describe('T1 V3c — roof form authoring through the production Layout adapter', () => {
	it('births a Shed through the Roof tool in one history entry', async () => {
		const mounted = await mount();
		const controller = armInk(mounted);
		controller.setReading('roof');
		controller.setRoofForm('shed');
		const surface = inkSurface()!;
		mounted.facade.session.heightSheet().set(0, 'key');
		settle(mounted);
		const depth = mounted.host.history().depth;

		expect(press(mounted, [8, 6]).claimed).toBe(true);
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
		expect(created.role).toBe('overhead');
		expect(created.form.kind).toBe('shed');
		expect(mounted.host.history().depth).toBe(depth + 1);
	});

	it('switches form through the canonical planner and publishes the exact Card facts', async () => {
		const { fixture, shedId } = slopedRoofFixture(0.3);
		const mounted = await mount(fixture);
		selectRegion(mounted, shedId);
		const depth = mounted.host.history().depth;
		const subject = { sourceId: shedId, sourceKind: 'region' } as never;
		expect(stageCardFacts(mounted.facade, subject).find((fact) => fact.label === 'Kind')?.value).toBe(
			'Shed Roof'
		);
		expect(stageCardWriter(mounted.facade, subject)?.fieldIds).toEqual([
			'elevation',
			'thickness',
			'rise',
			'azimuth',
			'width',
			'depth'
		]);

		const snapshot = mounted.facade.snapshot();
		const outcome = await mounted.host.accept(
			regionEditIntent({
				kind: LAYOUT_REGION_FORM_KIND,
				regionId: shedId,
				payload: { form: { kind: 'gable' } },
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: snapshot.acceptedRevision.revisionId,
				contentRevision: snapshot.domain.unitRevisions.layout,
				levelId: snapshot.domain.layoutLevelId
			})
		);
		expect(outcome.kind).toBe('installed');
		expect(regionOf(mounted, shedId)?.form).toMatchObject({ kind: 'gable', ridgeOffset: 0 });
		expect(mounted.host.history().depth).toBe(depth + 1);
		settle(mounted);
		expect(stageCardWriter(mounted.facade, subject)?.fieldIds).toEqual([
			'elevation',
			'thickness',
			'rise',
			'azimuth',
			'ridgeOffset',
			'width',
			'depth'
		]);
	});

	it('opens Edit shape with only the roof-local section joints', async () => {
		const { fixture, shedId } = slopedRoofFixture(0.3);
		const mounted = await mount(fixture);
		selectRegion(mounted, shedId);
		regionShape.open(shedId);
		mounted.services.stage.notifySurfaceChange();
		settle(mounted);
		const section = regionSectionOf(regionOf(mounted, shedId)!, ELEVATION)!;
		expect(section).not.toBeNull();
		const marks = mounted.facade.marks();
		expect(marks.find((mark) => mark.id === 'layout-region-section:low')).toBeDefined();
		expect(marks.find((mark) => mark.id === 'layout-region-section:high')).toBeDefined();
		expect(marks.find((mark) => mark.id === 'layout-region-section:add')).toBeDefined();
		// Edit shape suppresses the ordinary corner/body/turn writers while open.
		expect(marks.some((mark) => mark.id.startsWith('layout-region-corner:'))).toBe(false);
		expect(marks.some((mark) => mark.id === 'layout-region-move-mark')).toBe(false);
		expect(marks.some((mark) => mark.id === 'layout-region-turn-mark')).toBe(false);
	});

	it('sections a U-shaped footprint inside one covered interval, axis and oblique', () => {
		for (const azimuth of [Math.PI / 2, Math.PI / 6]) {
			const { fixture, roofId } = uRoofFixture(azimuth);
			const region = fixture.document.regions.find((candidate) => candidate.id === roofId)!;
			const section = regionSectionOf(region, ELEVATION);
			expect(section, `azimuth ${azimuth}`).not.toBeNull();
			if (section === null) continue;
			expect(section.form).toBe('gable');
			expectSectionInsideOneInterval(section, region.footprint.points);
		}
	});

	it('drags a ridge vertically and horizontally in one previewed form entry', async () => {
		const { fixture, shedId } = slopedRoofFixture(0.3);
		const mounted = await mount(fixture);
		selectRegion(mounted, shedId);
		const depth = mounted.host.history().depth;
		const before = regionOf(mounted, shedId)!;
		expect(before.form.kind).toBe('shed');
		if (before.form.kind !== 'shed') return;

		const snapshot = mounted.facade.snapshot();
		await mounted.host.accept(
			regionEditIntent({
				kind: LAYOUT_REGION_FORM_KIND,
				regionId: shedId,
				payload: { form: { kind: 'gable', rise: 1.6, azimuth: 0, ridgeOffset: 0 } },
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: snapshot.acceptedRevision.revisionId,
				contentRevision: snapshot.domain.unitRevisions.layout,
				levelId: snapshot.domain.layoutLevelId
			})
		);
		await eventually(() => regionOf(mounted, shedId)?.form.kind === 'gable');
		selectRegion(mounted, shedId);
		const gable = regionOf(mounted, shedId)!;
		if (gable.form.kind !== 'gable') return;
		const entryDepth = mounted.host.history().depth;
		const section = regionSectionOf(gable, ELEVATION)!;
		mounted.facade.camera.applyIntent(
			{
				kind: 'set-view',
				eye: [12, 8, 12],
				target: [3, 3.5, 2],
				fovYDegrees: 50
			},
			2
		);
		settle(mounted, 2);
		regionShape.open(shedId);
		mounted.services.stage.notifySurfaceChange();
		settle(mounted, 2);
		const ridge = section.ridge!;
		expect(
			press(mounted, ridge.point, 'layout-region-section:ridge', ridge.height).claimed
		).toBe(true);
		moveTo(mounted, ridge.point, ridge.point, ridge.height + 0.4);
		const preview = mounted.facade
			.candidatePreviews()
			.find((candidate) => candidate.id === 'layout-region-section-candidate');
		expect(preview).toBeDefined();
		expect(mounted.host.history().depth).toBe(entryDepth);
		releaseAt(mounted, ridge.point, ridge.height + 0.4);
		await eventually(() => {
			const current = regionOf(mounted, shedId);
			return current?.form.kind === 'gable' && current.form.rise > 1.6;
		});
		settle(mounted, 2);
		const raised = regionOf(mounted, shedId)!;
		expect(raised.form.kind).toBe('gable');
		if (raised.form.kind !== 'gable') return;
		expect(raised.form.rise).toBeGreaterThan(1.6);
		expect(mounted.host.history().depth).toBe(entryDepth + 1);

		// A second gesture moves the ridge uphill: the plan ray is measured on the
		// ridge's own plane, so a pure horizontal drag changes only ridgeOffset.
		const raisedSection = regionSectionOf(raised, ELEVATION)!;
		const raisedRidge = raisedSection.ridge!;
		const shifted: readonly [number, number] = [
			raisedRidge.point[0] + 0.8,
			raisedRidge.point[1]
		];
		regionShape.open(shedId);
		mounted.services.stage.notifySurfaceChange();
		settle(mounted, 2);
		expect(
			press(mounted, raisedRidge.point, 'layout-region-section:ridge', raisedRidge.height)
				.claimed
		).toBe(true);
		moveTo(mounted, shifted, raisedRidge.point, raisedRidge.height);
		expect(mounted.host.history().depth).toBe(entryDepth + 1);
		releaseAt(mounted, shifted, raisedRidge.height);
		await eventually(() => {
			const current = regionOf(mounted, shedId);
			return current?.form.kind === 'gable' && current.form.ridgeOffset > 0.2;
		});
		settle(mounted, 2);
		const after = regionOf(mounted, shedId)!;
		expect(after.form.kind).toBe('gable');
		if (after.form.kind !== 'gable') return;
		expect(after.form.ridgeOffset).toBeGreaterThan(0.2);
		expect(mounted.host.history().depth).toBe(entryDepth + 2);
	});

	it('raises both gable eaves from one eave joint drag', async () => {
		const { fixture, gableId } = gableRoofFixture();
		const mounted = await mount(fixture);
		selectRegion(mounted, gableId);
		const before = regionOf(mounted, gableId)!;
		if (before.form.kind !== 'gable') return;
		const section = regionSectionOf(before, ELEVATION)!;
		const low = section.low;
		const depth = mounted.host.history().depth;
		mounted.facade.camera.applyIntent(
			{
				kind: 'set-view',
				eye: [12, 8, 12],
				target: [3, 3.5, 2],
				fovYDegrees: 50
			},
			2
		);
		settle(mounted, 2);
		regionShape.open(gableId);
		mounted.services.stage.notifySurfaceChange();
		settle(mounted, 2);

		expect(press(mounted, low.point, 'layout-region-section:low', low.height).claimed).toBe(
			true
		);
		moveTo(mounted, low.point, low.point, low.height + 0.5);
		expect(mounted.host.history().depth).toBe(depth);
		releaseAt(mounted, low.point, low.height + 0.5);
		await eventually(() => (regionOf(mounted, gableId)?.elevation ?? 0) > before.elevation + 1e-6);
		const after = regionOf(mounted, gableId)!;
		expect(after.form).toMatchObject({
			kind: 'gable',
			rise: before.form.rise,
			ridgeOffset: before.form.ridgeOffset
		});
		const raised = regionSectionOf(after, ELEVATION)!;
		expect(raised.low.height).toBeCloseTo(low.height + 0.5, 9);
		expect(raised.high.height).toBeCloseTo(section.high.height + 0.5, 9);
		expect(mounted.host.history().depth).toBe(depth + 1);
	});

	it('inserts a Gable ridge from the shed midpoint ＋ with a click', async () => {
		const { fixture, shedId } = slopedRoofFixture(0.3);
		const mounted = await mount(fixture);
		selectRegion(mounted, shedId);
		const before = regionOf(mounted, shedId)!;
		if (before.form.kind !== 'shed') return;
		const section = regionSectionOf(before, ELEVATION)!;
		const depth = mounted.host.history().depth;
		regionShape.open(shedId);
		mounted.services.stage.notifySurfaceChange();
		settle(mounted);

		expect(
			press(mounted, section.midpoint!.point, 'layout-region-section:add', section.midpoint!.height)
				.claimed
		).toBe(true);
		releaseAt(mounted, section.midpoint!.point, section.midpoint!.height);
		await eventually(() => regionOf(mounted, shedId)?.form.kind === 'gable');
		const after = regionOf(mounted, shedId)!;
		expect(after.form).toMatchObject({ kind: 'gable', ridgeOffset: 0 });
		if (after.form.kind === 'gable' && before.form.kind === 'shed') {
			expect(after.form.rise).toBeCloseTo(before.form.rise, 9);
		}
		expect(mounted.host.history().depth).toBe(depth + 1);
	});

	it('collapses a Gable ridge dragged onto an eave into a Shed', async () => {
		const { fixture, gableId } = gableRoofFixture();
		const mounted = await mount(fixture);
		selectRegion(mounted, gableId);
		const gable = regionOf(mounted, gableId)!;
		if (gable.form.kind !== 'gable') return;
		const section = regionSectionOf(gable, ELEVATION)!;
		const ridge = section.ridge!;
		const run = gable.form.azimuth;
		const target: readonly [number, number] = [
			ridge.point[0] + Math.cos(run) * 5,
			ridge.point[1] + Math.sin(run) * 5
		];
		const depth = mounted.host.history().depth;
		mounted.facade.camera.applyIntent(
			{
				kind: 'set-view',
				eye: [12, 8, 12],
				target: [3, 3.5, 2],
				fovYDegrees: 50
			},
			2
		);
		settle(mounted, 2);
		regionShape.open(gableId);
		mounted.services.stage.notifySurfaceChange();
		settle(mounted, 2);
		expect(press(mounted, ridge.point, 'layout-region-section:ridge', ridge.height).claimed).toBe(
			true
		);
		moveTo(mounted, target, ridge.point, ridge.height);
		releaseAt(mounted, target, ridge.height);
		await eventually(() => regionOf(mounted, gableId)?.form.kind === 'shed');
		expect(regionOf(mounted, gableId)?.form.kind).toBe('shed');
		expect(mounted.host.history().depth).toBe(depth + 1);
	});

	it('ends Edit shape and restores ordinary manipulation after a ridge collapses to Flat', async () => {
		const { fixture, gableId } = gableRoofFixture();
		const mounted = await mount(fixture);
		selectRegion(mounted, gableId);
		const gable = regionOf(mounted, gableId)!;
		if (gable.form.kind !== 'gable') return;
		const section = regionSectionOf(gable, ELEVATION)!;
		const ridge = section.ridge!;
		mounted.facade.camera.applyIntent(
			{
				kind: 'set-view',
				eye: [12, 8, 12],
				target: [3, 3.5, 2],
				fovYDegrees: 50
			},
			2
		);
		settle(mounted, 2);
		regionShape.open(gableId);
		mounted.services.stage.notifySurfaceChange();
		settle(mounted, 2);
		let restored = 0;
		wallFace.setCameraPort({
			standpoint: () => ({ reading: '3d' }) as never,
			face: () => true,
			putBack: () => {
				restored += 1;
				return true;
			}
		});
		try {
			expect(
				wallFace.face({ wallId: regionSectionKey(gableId), frame: regionSectionFrame(section)! }).kind
			).toBe('applied');
			expect(press(mounted, ridge.point, 'layout-region-section:ridge', ridge.height).claimed).toBe(
				true
			);
			const flatY = ridge.height - gable.form.rise - 0.2;
			moveTo(mounted, ridge.point, ridge.point, flatY);
			releaseAt(mounted, ridge.point, flatY);
			await eventually(() => regionOf(mounted, gableId)?.form.kind === 'flat');
			expect(regionShape.current()).toBeNull();
			expect(restored).toBe(1);
			settle(mounted, 2);
			const marks = mounted.facade.marks();
			expect(marks.some((mark) => mark.id === 'layout-region-corner:0')).toBe(true);
			expect(marks.some((mark) => mark.id === 'layout-region-turn-mark')).toBe(true);
			expect(marks.some((mark) => mark.id.startsWith('layout-region-section:'))).toBe(false);

			const flat = regionOf(mounted, gableId)!;
			const before = flat.footprint.points[0]!;
			const y = ELEVATION + flat.elevation;
			expect(press(mounted, before, 'layout-region-corner:0', y).claimed).toBe(true);
			const moved: readonly [number, number] = [before[0] + 0.3, before[1]];
			moveTo(mounted, moved, before, y);
			releaseAt(mounted, moved, y);
			await eventually(() => (regionOf(mounted, gableId)?.footprint.points[0]?.[0] ?? 0) > before[0] + 0.1);
		} finally {
			wallFace.setCameraPort(null);
		}
	});

	it('ends Edit shape and restores the Section camera when a roof is written Flat', async () => {
		const { fixture, gableId } = gableRoofFixture();
		const mounted = await mount(fixture);
		selectRegion(mounted, gableId);
		const gable = regionOf(mounted, gableId)!;
		const section = regionSectionOf(gable, ELEVATION)!;
		regionShape.open(gableId);
		mounted.services.stage.notifySurfaceChange();
		settle(mounted);
		let restored = 0;
		wallFace.setCameraPort({
			standpoint: () => ({ reading: '3d' }) as never,
			face: () => true,
			putBack: () => {
				restored += 1;
				return true;
			}
		});
		try {
			expect(
				wallFace.face({ wallId: regionSectionKey(gableId), frame: regionSectionFrame(section)! }).kind
			).toBe('applied');
			const snapshot = mounted.facade.snapshot();
			expect(
				(
					await mounted.host.accept(
						regionEditIntent({
							kind: LAYOUT_REGION_FORM_KIND,
							regionId: gableId,
							payload: { form: { kind: 'flat' } },
							operationId: globalThis.crypto.randomUUID(),
							projectId: snapshot.acceptedRevision.projectId,
							revisionId: snapshot.acceptedRevision.revisionId,
							contentRevision: snapshot.domain.unitRevisions.layout,
							levelId: snapshot.domain.layoutLevelId
						})
					)
				).kind
			).toBe('installed');
			await eventually(() => regionOf(mounted, gableId)?.form.kind === 'flat');
			expect(syncRegionShape(regionOf(mounted, gableId) ?? null)).toBe(true);
			expect(regionShape.current()).toBeNull();
			expect(restored).toBe(1);
			settle(mounted);
			expect(mounted.facade.marks().some((mark) => mark.id.startsWith('layout-region-section:'))).toBe(
				false
			);
		} finally {
			wallFace.setCameraPort(null);
		}
	});

	it('builds an A6 Face frame for the Section and Put back restores the camera', () => {
		const { fixture, shedId } = slopedRoofFixture(0.3);
		const region = fixture.document.regions.find((entry) => entry.id === shedId)!;
		const section = regionSectionOf(region, ELEVATION)!;
		const frame = regionSectionFrame(section)!;
		expect(frame.bounds.max[1]).toBeGreaterThan(frame.bounds.min[1]);
		expect(Math.hypot(frame.look[0], frame.look[2])).toBeCloseTo(1, 9);
		let faced = 0;
		let restored = 0;
		wallFace.setCameraPort({
			standpoint: () => ({}) as never,
			face: () => {
				faced += 1;
				return true;
			},
			putBack: () => {
				restored += 1;
				return true;
			}
		});
		expect(wallFace.face({ wallId: regionSectionKey(shedId), frame }).kind).toBe('applied');
		expect(faced).toBe(1);
		expect(wallFace.putBack(regionSectionKey(shedId)).kind).toBe('restored');
		expect(restored).toBe(1);
	});

	it('names the blocking Wall and overrun in the fit refusal', () => {
		const words = regionFitRefusalWords(
			"Wall 'wall-1' would rise 0.095 m above region 'region-1' once sealed to its underside. Thicken the roof or change its shape, or edit the Wall top directly.",
			{ wallLabel: 'Wall 1' }
		);
		expect(words).toContain('Wall 1 would rise 0.095 m above this Roof once sealed');
		expect(words).not.toContain('wall-1');
		expect(words).not.toContain('region-1');
	});
});
