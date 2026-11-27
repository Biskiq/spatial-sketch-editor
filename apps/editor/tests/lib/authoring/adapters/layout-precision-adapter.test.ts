/**
 * T1.P01.S04 — Layout precision and Head Save integration.
 *
 * These tests drive a **real** F4 accept through the live coordinator and the
 * production adapter factory: no injected source and no test-only install path.
 * The properties pinned here are the slice's acceptance criteria:
 *
 * 1. the production planners register through the adapter and an exact Wall
 *    height/thickness or Opening measure edit installs once with one undo;
 * 2. an invalid measure and a Wall shortened below its Opening
 *    reject with the retained planner's own message, and the accepted source,
 *    revision and history are unchanged;
 * 3. blank input never becomes zero and blur/Esс never commit;
 * 4. Place → Layout plinth captures the object id before evaluation, creates one
 *    ordinary Layout box and Undo removes it;
 * 5. the contributions are the AM-5 surface only: a dock-armable Ink entry, the
 *    plinth In place entry, and Card facts and fields from accepted source — the
 *    retired Dimensions task contributes nothing and opens nothing.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planCreateWallFirstOpening, planWallChain, wallFirstWallLength, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { nextLayoutPresetObjectId, surfaceKey } from '@portfolio/layout-core/plan';
import { setWorkObserver } from '@portfolio/layout-core/kernel';
import type { PlanSourceRef } from '@portfolio/layout-core/world';
import type { PlannerRequest, PreparedCandidate } from '@portfolio/project-model/f4';
import {
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	canonicalUnitJson,
	replaceUnitData,
	type ProjectEnvelope
} from '@portfolio/project-model/units';


import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, datumWorkingPlane, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import {
	stageCardFacts,
	stageCardWriter,
	stageFindEntries,
	stageDockTools
} from '$lib/authoring/stage/stage-contributions';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { createLayoutInstrument } from '$lib/authoring/adapters/layout/instrument';
import { createLayoutPlanners } from '$lib/authoring/adapters/layout/precision-planners';
import { LAYOUT_WALL_TOP_KIND, layoutPlanner, layoutSubjectOf, registerLayoutSurfaceLineage } from '$lib/authoring/adapters/layout/precision';
import {
	createDrawingPlanners,
	LAYOUT_CIRCLE_RADIUS_KIND,
	LAYOUT_CIRCLE_ROOM_CREATE_KIND,
	LAYOUT_CIRCLE_TRANSLATE_KIND,
	LAYOUT_WALL_CHAIN_COMMIT_KIND,
	LAYOUT_WALL_DELETE_KIND
} from '$lib/authoring/adapters/layout/drawing-planners';
import {
	LAYOUT_ROUND_ROOM_RADIUS_KIND,
	LAYOUT_ROUND_ROOM_RELEASE_KIND,
} from '$lib/authoring/adapters/layout/round-room-planners';
import { createOpeningPlanners } from '$lib/authoring/adapters/layout/opening-planners';
import { createOpenSidePlanners } from '$lib/authoring/adapters/layout/open-side-planners';
import {
	createRoomDuplicatePlanners,
	LAYOUT_ROOM_DUPLICATE_KIND
} from '$lib/authoring/adapters/layout/room-duplicate-planners';
import { createSplitPlanners } from '$lib/authoring/adapters/layout/split-planners';
import { createJoinPlanners } from '$lib/authoring/adapters/layout/join-planners';
import { createOpeningRepeatPlanners } from '$lib/authoring/adapters/layout/opening-repeat';
import { createRegionPlanners } from '$lib/authoring/adapters/layout/region-planners';
import { createCardFieldsInstrument, createPlacementInstrument } from '$lib/authoring/adapters/layout/adapter-support';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-s04';
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
	if (chained.kind !== 'success') throw new Error('the S04 enclosure was refused');
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

/** The same enclosure with its south Wall already gabled; no Unroll is entered. */
function gableFixture(): { document: LayoutDocumentWallFirst; wallId: string; openingId: string } {
	const fixture = fixtureDocument();
	const length = wallFirstWallLength(fixture.document, fixture.wallId);
	if (length === undefined) throw new Error('the gable fixture Wall has no length');
	return {
		...fixture,
		document: {
			...fixture.document,
			walls: fixture.document.walls.map((wall) =>
				wall.id === fixture.wallId
					? {
							...wall,
							top: {
								kind: 'gable' as const,
								startRise: 0,
								endRise: 0,
								apexRise: 2,
								apexOffset: length / 2
							}
						}
					: wall
			)
		}
	};
}

async function mount(fixture = fixtureDocument()): Promise<Mounted> {
	const { document, wallId, openingId } = fixture;
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'S04 precision',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-s04',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`S04 fixture not admitted: ${admitted.kind}`);
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

describe('Layout precision', () => {
	it('registers one planner per writable fact and contributes only through the AM-5 surface', async () => {
		const { facade, host, services, wallId } = await mount();
		// The precision set S05 shipped plus S02's two drawing operations, S03's
		// two Opening operations, A4's Room duplicate and SP2's Room tool, on the one registry,
		// admission and coordinator: no family owns a second acceptance path.
		const registeredPlanners = host.coordinator().planners();
		expect(registeredPlanners).toHaveLength(
			createLayoutPlanners().length +
				createDrawingPlanners().length +
				createSplitPlanners().length +
				createJoinPlanners().length +
				createRoomDuplicatePlanners().length +
				createOpenSidePlanners().length +
				createOpeningPlanners().length +
				createOpeningRepeatPlanners().length +
				createRegionPlanners().length +
				1
		);
		expect(registeredPlanners.every((planner) =>
			planner.admission.domain === 'layout' &&
			planner.admission.compound === true &&
			planner.admission.writes?.includes('scene') === true
		)).toBe(true);
		expect(registeredPlanners.map(({ kind }) => kind)).toContain('layout-open-space-create');
		expect(createLayoutPlanners().map((planner) => planner.kind).sort()).toEqual([
			'layout-entity-name',
			'layout-junction-move',
			'layout-opening-measure',
			'layout-plinth-place',
			'layout-room-move',
			'layout-room-overhead',
			'layout-space-remove',
			'layout-wall-angle',
			// C1 — one grab on an open Wall body is its own retained operation.
			'layout-wall-bend',
			'layout-wall-height',
			// C1/D2 — the Card's two knot shape actions are retained planners of their
			// own, so the Card's one action channel never mutates a document directly.
			'layout-wall-knot-delete',
			'layout-wall-length',
			'layout-wall-move',
			'layout-wall-straighten',
			'layout-wall-thickness',
			'layout-wall-top'
		]);
		// C2 — Circle creation, exact radius and rigid body move are retained
		// planners beside the two S02 drawing operations, not a second write path.
		expect(createDrawingPlanners().map((planner) => planner.kind).sort()).toEqual([
			LAYOUT_CIRCLE_RADIUS_KIND,
			LAYOUT_CIRCLE_ROOM_CREATE_KIND,
			LAYOUT_CIRCLE_TRANSLATE_KIND,
			LAYOUT_ROUND_ROOM_RADIUS_KIND,
			LAYOUT_ROUND_ROOM_RELEASE_KIND,
			LAYOUT_WALL_CHAIN_COMMIT_KIND,
			LAYOUT_WALL_DELETE_KIND
		]);
		expect(createRoomDuplicatePlanners().map((planner) => planner.kind)).toEqual([
			LAYOUT_ROOM_DUPLICATE_KIND
		]);
		expect(stageFindEntries(facade).some((entry) => entry.taskKind === 'layout-plinth-place')).toBe(true);
		expect(facade.openContributedTask('layout-place-plinth')).toMatchObject({ kind: 'opened', instrument: { summary: 'Place plinth' } });

		// Ink is a **dock** tool, so it arms from the dock rather than listing itself a
		// second time among the Index entries.
		expect(stageDockTools(facade).map((tool) => tool.taskKind)).toEqual(['layout-ink']);
		expect(stageFindEntries(facade).some((entry) => entry.taskKind === 'layout-ink')).toBe(false);

		// The Dimensions task is retired with the writer it hosted: the Card owns those
		// fields now, so the old kind opens nothing at all.
		expect(facade.openContributedTask('layout-dimensions')).toMatchObject({ kind: 'refused' });
		selectWall(facade, wallId);
		const writer = stageCardWriter(facade, { sourceId: wallId, sourceKind: 'wall', ref: null });
		expect(writer).toMatchObject({ summary: 'Wall fields', adapterId: 'layout' });
		expect(writer?.view).toBeDefined();

		const facts = stageCardFacts(facade, { sourceId: wallId, sourceKind: 'wall', ref: null });
		expect(facts.some((fact) => fact.label === 'Height')).toBe(true);
		expect(services.authoring.acceptedRevision().revisionId).toBe('revision-boot');
	});

	it('accepts one exact Wall height edit with one undo and full typed precision', async () => {
		const { facade, host, services, document, wallId } = await mount();
		const instrument = createLayoutInstrument({
			subject: { kind: 'wall', id: wallId },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().domain.unitRevisions.layout,
			port: services.authoring
		});
		const precisionValue = 2.734567890123;
		instrument.edit('height', String(precisionValue));
		const outcome = await instrument.commit('height');
		expect(outcome.kind).toBe('accepted');
		const accepted = stageEnvelope(facade.snapshot()).units.layout.data.walls.find((wall) => wall.id === wallId)!;
		expect(accepted.height).toBe(precisionValue);
		// The baseline state is history entry one, so one accepted edit is depth two.
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await host.undo()).kind).toBe('installed');
		expect(
			stageEnvelope(facade.snapshot()).units.layout.data.walls.find((wall) => wall.id === wallId)!.height
		).toBe(document.walls.find((wall) => wall.id === wallId)!.height);
	});

	it('rejects a Wall shortened below its Opening with the Opening named and writes nothing', async () => {
		const { facade, host, services, document, wallId, openingId } = await mount();
		const instrument = createLayoutInstrument({
			subject: { kind: 'wall', id: wallId },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().domain.unitRevisions.layout,
			port: services.authoring
		});
		instrument.edit('height', '1.2');
		const outcome = await instrument.commit('height');
		// The coordinator names the refusal class; the Height path formats it through
		// the same V2b words as the top grip, so the Opening is named, not its id.
		expect(outcome).toMatchObject({ kind: 'refused', code: 'planner-rejected' });
		expect((outcome as { message: string }).message).toBe(
			'This top would cut into "Window". Raise the top there or lower the Opening.'
		);
		// The baseline is entry one; a refused proposal adds none and moves nothing.
		expect(host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(
			stageEnvelope(facade.snapshot()).units.layout.data.walls.find((wall) => wall.id === wallId)!.height
		).toBe(document.walls.find((wall) => wall.id === wallId)!.height);
		expect(
			stageEnvelope(facade.snapshot()).units.layout.data.openings.find((opening) => opening.id === openingId)!.height
		).toBe(document.openings.find((opening) => opening.id === openingId)!.height);
	});

	it('never turns blank input into zero and never commits on blur or Esc', async () => {
		const { facade, services, document, wallId } = await mount();
		const port = { ...services.authoring, accept: async () => { throw new Error('no write expected'); } };
		const instrument = createLayoutInstrument({
			subject: { kind: 'wall', id: wallId },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().domain.unitRevisions.layout,
			port
		});
		instrument.edit('height', '   ');
		expect(await instrument.commit('height')).toMatchObject({ kind: 'invalid', code: 'blank' });
		instrument.edit('height', 'Infinity');
		expect(await instrument.commit('height')).toMatchObject({ kind: 'invalid', code: 'non-finite' });
		instrument.edit('height', '3.5');
		expect(instrument.blur('height')?.text).toBe(String(document.walls.find((wall) => wall.id === wallId)!.height));
		instrument.edit('height', '3.5');
		expect(instrument.cancel('height')?.text).toBe(String(document.walls.find((wall) => wall.id === wallId)!.height));
	});

	it('places one plinth at the captured id and on the current floor datum, and Undo removes it', async () => {
		const { facade, host, services, document } = await mount();
		const before = stageEnvelope(facade.snapshot()).units.layout.data.objects.length;
		const instrument = createLayoutInstrument({
			subject: { kind: 'object', id: '(placement)' },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().domain.unitRevisions.layout,
			port: services.authoring
		});
		instrument.setPlacement('2.25', '-1.5');
		const outcome = await instrument.place();
		expect(outcome.kind).toBe('accepted');
		const objects = stageEnvelope(facade.snapshot()).units.layout.data.objects;
		expect(objects).toHaveLength(before + 1);
		const created = objects.at(-1)!;
		expect(created.kind).toBe('box');
		expect(created.position[0]).toBe(2.25);
		expect(created.position[2]).toBe(-1.5);
		expect(created.position[1]).toBe(ELEVATION + created.dimensions[1] / 2);
		// The baseline state is history entry one, so one accepted edit is depth two.
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await host.undo()).kind).toBe('installed');
		expect(stageEnvelope(facade.snapshot()).units.layout.data.objects).toHaveLength(before);
	});

	it('Redo reproduces the captured plinth id, while a new placement after Undo gets a fresh one', async () => {
		const { facade, host, services } = await mount();
		const place = async () => {
			const instrument = createLayoutInstrument({
				subject: { kind: 'object', id: '(placement)' },
				document: stageEnvelope(facade.snapshot()).units.layout.data,
				projectId: PROJECT_ID,
				contentRevision: facade.snapshot().domain.unitRevisions.layout,
				port: services.authoring
			});
			instrument.setPlacement('1.5', '2.5');
			expect((await instrument.place()).kind).toBe('accepted');
			return stageEnvelope(facade.snapshot()).units.layout.data.objects.at(-1)!.id;
		};

		const first = await place();
		expect((await host.undo()).kind).toBe('installed');
		expect(stageEnvelope(facade.snapshot()).units.layout.data.objects).toHaveLength(0);

		// Redo restores the accepted state: the captured id is exactly the one the
		// operation recorded, never a re-allocation.
		expect((await host.redo()).kind).toBe('installed');
		expect(stageEnvelope(facade.snapshot()).units.layout.data.objects.at(-1)!.id).toBe(first);

		// Undo again, then a genuinely different operation: a fresh capture must
		// not recycle the identity from the undone branch.
		expect((await host.undo()).kind).toBe('installed');
		const second = await place();
		expect(second).not.toBe(first);
		expect(stageEnvelope(facade.snapshot()).units.layout.data.objects).toHaveLength(1);
	});

	it('holds the host gesture lease for typed X/Z and releases it when the placement settles', async () => {
		const { facade, host, services } = await mount();
		const instrument = createPlacementInstrument(services);
		expect(instrument.proposalLive()).toBe(false);

		// Esc from the placement panel releases a lease that never placed anything.
		instrument.setPlacement('3', '3');
		expect(instrument.proposalLive()).toBe(true);
		instrument.cancelPlacement();
		expect(instrument.proposalLive()).toBe(false);

		// Typed working-plane X/Z is a settled-fact proposal exactly as a measure is:
		// Undo must not move the document out from under a value about to be placed.
		instrument.setPlacement('0.75', '-0.75');
		expect(instrument.proposalLive()).toBe(true);
		expect(host.history().undoUnavailableReason).toContain('proposal is live');
		expect(await host.undo()).toMatchObject({ kind: 'unavailable', reason: 'live-proposal' });

		// The attempt settles the proposal whether it places or not; here it places.
		expect((await instrument.place()).kind).toBe('accepted');
		expect(instrument.proposalLive()).toBe(false);
		expect(host.history().canUndo).toBe(true);
		expect(
			stageEnvelope(facade.snapshot()).units.layout.data.objects.some(
				(object) => object.position[0] === 0.75 && object.position[2] === -0.75
			)
		).toBe(true);
	});

	it('re-takes the host lease after a reading change ends it mid-proposal', async () => {
		const { session, host, services } = await mount();
		const instrument = createPlacementInstrument(services);
		instrument.setPlacement('1', '1');
		expect(instrument.proposalLive()).toBe(true);

		// The Plan/3D toggle is a reading change: the host runs the live lease's
		// `cancel-on-reading-change` policy, so the grant is gone while the typed
		// value stays in the panel.
		expect(session.applyReadingChange()).toMatchObject({ cancelled: true });
		expect(host.history().undoUnavailableReason ?? '').not.toContain('proposal is live');

		// The next keystroke must ask the host again rather than trust its own flag;
		// otherwise the draft sits unguarded and Undo reports it available.
		instrument.setPlacement('1.25', '1');
		expect(instrument.proposalLive()).toBe(true);
		expect(host.history().undoUnavailableReason).toContain('proposal is live');
		expect(await host.undo()).toMatchObject({ kind: 'unavailable', reason: 'live-proposal' });
	});

	it('requires lineage on every prepared Layout operation and keeps an all-painted Scene byte-identical for explicit empty lineage', async () => {
		const { host, wallId, document } = await mount();
		const accepted = host.coordinator().acceptedSnapshot();
		const acceptedSource = accepted.domain.source;
		const unsortedSurfaceFinishes: NonNullable<typeof acceptedSource.units.scene.data.surfaceFinishes> = [
			{ surface: { kind: 'wall-side', wallId, side: 'left' }, finish: { materialId: 'marble-light' } },
			{ surface: { kind: 'wall-side', wallId, side: 'right' }, finish: { materialId: 'velvet-dark' } },
			{ surface: { kind: 'room-floor', roomId: document.rooms[0]!.id }, finish: { materialId: 'brass-aged' } },
			{ surface: { kind: 'room-lid', roomId: document.rooms[0]!.id }, finish: { materialId: 'paper-aged' } }
		];
		const surfaceFinishes = unsortedSurfaceFinishes.sort((left, right) =>
			surfaceKey(left.surface) < surfaceKey(right.surface)
				? -1
				: surfaceKey(left.surface) > surfaceKey(right.surface) ? 1 : 0
		);
		const paintedScene = { ...acceptedSource.units.scene.data, surfaceFinishes };
		const paintedSource = replaceUnitData(acceptedSource, 'scene', paintedScene);
		const snapshot = { ...accepted, domain: { ...accepted.domain, source: paintedSource } };
		const candidate: PreparedCandidate<ProjectEnvelope> = {
			operationId: 't12-missing-lineage',
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			source: paintedSource,
			changes: [],
			correspondence: [],
			diagnostics: []
		};
		const request: PlannerRequest<ProjectEnvelope> = {
			snapshot,
			intent: {
				version: 1,
				kind: 't12-missing-lineage',
				operationId: candidate.operationId,
				expectedRevision: accepted.acceptedRevision,
				targets: [], payload: {}, capturedInputs: [], allocatedIds: []
			},
			capturedInputs: [],
			allocatedIds: []
		};
		const missingLineage = layoutPlanner('t12-missing-lineage', () => ({ kind: 'prepared', candidate })).prepare(request);
		expect(missingLineage).toMatchObject({ kind: 'rejected', code: 'surface_lineage_invalid' });

		const explicitEmptyCandidate = { ...candidate, operationId: 't12-explicit-empty-lineage' };
		registerLayoutSurfaceLineage(explicitEmptyCandidate, []);
		const explicitEmpty = layoutPlanner('t12-explicit-empty-lineage', () => ({
			kind: 'prepared', candidate: explicitEmptyCandidate
		})).prepare({
			...request,
			intent: { ...request.intent, kind: 't12-explicit-empty-lineage', operationId: explicitEmptyCandidate.operationId }
		});
		expect(explicitEmpty.kind).toBe('prepared');
		if (explicitEmpty.kind !== 'prepared') return;
		expect(explicitEmpty.candidate.source.units.scene.data.surfaceFinishes).toEqual(surfaceFinishes);
		expect(canonicalUnitJson(explicitEmpty.candidate.source.units.scene.data)).toBe(canonicalUnitJson(paintedScene));
	});

	it('refuses a stale floor datum and a mismatched captured object id', async () => {
		const { facade, host, services, document } = await mount();
		const stale = createLayoutInstrument({
			subject: { kind: 'object', id: '(placement)' },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().domain.unitRevisions.layout,
			port: services.authoring
		});
		stale.setPlacement('1', '1');
		// The mounted datum is `document.floor.elevation`; a different accepted datum
		// is refused by the planner. Drive that path through the planner itself.
		const planner = createLayoutPlanners().find((entry) => entry.kind === 'layout-plinth-place')!;
		const snapshot = host.coordinator().acceptedSnapshot();
		const capture = freshCapture();
		const capturedInputs = [
			{ name: 'layout-working-level', value: document.floor.id },
			{ name: 'layout-id-nonce', value: capture.nonce }
		];
		const baseIntent = {
			version: 1 as const,
			kind: 'layout-plinth-place',
			operationId: 'op',
			expectedRevision: facade.snapshot().acceptedRevision,
			targets: [],
			capturedInputs,
			allocatedIds: []
		};
		expect(
			planner.prepare({
				snapshot,
				intent: {
					...baseIntent,
					kind: 'layout-plinth-place',
					payload: {
						point: [1, 1],
						floorElevation: ELEVATION + 1,
						objectId: nextLayoutPresetObjectId(document, capture)
					},
					allocatedIds: [{ kind: 'layout-object', id: nextLayoutPresetObjectId(document, capture) }]
				},
				capturedInputs,
				allocatedIds: []
			})
		).toMatchObject({ kind: 'rejected', code: 'stale-datum' });
		// A captured id the retained planner would not allocate is refused, never
		// silently replaced by a hidden allocation.
		expect(
			planner.prepare({
				snapshot,
				intent: {
					...baseIntent,
					payload: {
						point: [1, 1],
						floorElevation: ELEVATION,
						objectId: 'captured-not-allocated'
					},
					allocatedIds: [{ kind: 'layout-object', id: 'captured-not-allocated' }]
				},
				capturedInputs,
				allocatedIds: []
			})
		).toMatchObject({ kind: 'rejected', code: 'invalid-value' });
		expect(layoutSubjectOf({ sourceKind: 'room-floor', sourceId: 'room' })).toBeNull();
		expect(datumWorkingPlane(ELEVATION).datumMeters).toBe(ELEVATION);
	});

	it('refuses a plinth whose captured working level, nonce or derived identity disagrees', async () => {
		const { facade, host, document } = await mount();
		const planner = createLayoutPlanners().find((entry) => entry.kind === 'layout-plinth-place')!;
		const snapshot = host.coordinator().acceptedSnapshot();
		const capture = freshCapture();
		const objectId = nextLayoutPresetObjectId(document, capture);
		const plinth = (capturedInputs: PlannerRequest<ProjectEnvelope>['capturedInputs'], id = objectId) => ({
			snapshot,
			intent: {
				version: 1 as const,
				kind: 'layout-plinth-place',
				operationId: 'op',
				expectedRevision: facade.snapshot().acceptedRevision,
				targets: [],
				capturedInputs,
				allocatedIds: [{ kind: 'layout-object', id }],
				payload: { point: [1, 1], floorElevation: ELEVATION, objectId: id }
			},
			capturedInputs,
			allocatedIds: []
		});
		const workingLevel = { name: 'layout-working-level', value: document.floor.id };
		const nonce = { name: 'layout-id-nonce', value: capture.nonce };

		// (a) no captured working level at all: the level is an explicit input, never read back.
		expect(planner.prepare(plinth([nonce]))).toMatchObject({
			kind: 'rejected',
			code: 'invalid-value',
			message: expect.stringContaining('working Layout level')
		});
		// (b) a captured level that is not the accepted floor fails closed as stale.
		expect(
			planner.prepare(plinth([{ name: 'layout-working-level', value: 'other-floor' }, nonce]))
		).toMatchObject({ kind: 'rejected', code: 'stale-level' });
		// (c) a plinth without its identity nonce cannot derive its object id.
		expect(planner.prepare(plinth([workingLevel]))).toMatchObject({
			kind: 'rejected',
			code: 'invalid-value',
			message: expect.stringContaining('identity nonce')
		});
		// (d) a valid nonce, but the payload names the id a different fresh capture derives.
		const otherObjectId = nextLayoutPresetObjectId(document, freshCapture());
		expect(otherObjectId).not.toBe(objectId);
		expect(planner.prepare(plinth([workingLevel, nonce], otherObjectId))).toMatchObject({
			kind: 'rejected',
			code: 'invalid-value'
		});
	});

	it('accepts one Opening measure edit with one undo and full typed precision', async () => {
		const { facade, host, services, document, openingId } = await mount();
		const instrument = createLayoutInstrument({
			subject: { kind: 'opening', id: openingId },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().domain.unitRevisions.layout,
			port: services.authoring
		});
		const precisionSill = 0.9123456789012345;
		instrument.edit('sillHeight', String(precisionSill));
		expect(await instrument.commit('sillHeight')).toEqual({ kind: 'accepted' });
		const accepted = stageEnvelope(facade.snapshot()).units.layout.data.openings.find(
			(opening) => opening.id === openingId
		)!;
		expect(accepted.sillHeight).toBe(precisionSill);
		// The baseline state is history entry one, so one accepted edit is depth two.
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await host.undo()).kind).toBe('installed');
		expect(
			stageEnvelope(facade.snapshot()).units.layout.data.openings.find((opening) => opening.id === openingId)!.sillHeight
		).toBe(document.openings.find((opening) => opening.id === openingId)!.sillHeight);
	});


	it('releases the proposal lease when a commit is refused or invalid', async () => {
		const { facade, host, services, wallId } = await mount();
		selectWall(facade, wallId);
		const instrument = createCardFieldsInstrument(services)!;

		instrument.edit('height', '0');
		expect(instrument.proposalLive()).toBe(true);
		// A zero height is invalid before any intent is built: no proposal exists
		// afterwards, so Undo must be available again.
		expect(await instrument.commit('height')).toMatchObject({ kind: 'invalid' });
		expect(instrument.proposalLive()).toBe(false);
		// Undo may still be empty here; what must not survive is the proposal reason.
		expect(host.history().undoUnavailableReason ?? '').not.toContain('proposal is live');
	});

	it('renames a Wall through canonical metadata planning and offers no object rename', async () => {
		const { facade, host, services, document, wallId } = await mount();
		const instrument = createLayoutInstrument({
			subject: { kind: 'wall', id: wallId },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().domain.unitRevisions.layout,
			port: services.authoring
		});
		instrument.edit('name', '  S04 boundary wall  ');
		expect(await instrument.commit('name')).toEqual({ kind: 'accepted' });
		// The canonical metadata planner owns trimming, so the accepted name is its
		// value, not the raw edit buffer.
		const renamed = stageEnvelope(facade.snapshot()).units.layout.data.walls.find(
			(wall) => wall.id === wallId
		)!;
		expect(renamed.name).toBe('S04 boundary wall');
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });

		// A Layout object's name is its identity: there is no writable name field, so
		// no intent can be built for one.
		const objectInstrument = createLayoutInstrument({
			subject: { kind: 'object', id: '(placement)' },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().domain.unitRevisions.layout,
			port: services.authoring
		});
		expect(objectInstrument.fields()).toEqual([]);
		expect(await objectInstrument.commit('name')).toEqual({ kind: 'unknown-field' });
	});

	it('contributes one Card name writer for Walls and Openings, delegated to canonical planning', async () => {
		const { facade, wallId } = await mount();
		const writer = facade.cardNameWriter({ sourceId: wallId, sourceKind: 'wall', ref: null });
		expect(writer).not.toBeNull();
		expect(writer!.value).toBe('');
		expect(await writer!.commit('  Card boundary wall  ')).toEqual({ kind: 'accepted' });
		// The canonical metadata planner trims; the Card sent raw text.
		expect(
			stageEnvelope(facade.snapshot()).units.layout.data.walls.find((wall) => wall.id === wallId)!.name
		).toBe('Card boundary wall');

		// A Layout object's name is its identity, so no adapter claims a writer.
		expect(facade.cardNameWriter({ sourceId: '(placement)', sourceKind: 'object', ref: null })).toBeNull();
	});

	// Review pass 2 §5: Rooms rename through the same canonical name planner.
	it('contributes a Room name writer: trims, refuses a blank name and keeps the prior one', async () => {
		const { facade } = await mount();
		const room = stageEnvelope(facade.snapshot()).units.layout.data.rooms[0];
		expect(room).toBeDefined();
		for (const sourceKind of ['room', 'room-floor']) {
			expect(facade.cardNameWriter({ sourceId: room!.id, sourceKind, ref: null })).not.toBeNull();
		}
		const writer = facade.cardNameWriter({ sourceId: room!.id, sourceKind: 'room-floor', ref: null })!;
		expect(await writer.commit('  Gallery  ')).toEqual({ kind: 'accepted' });
		const named = () => stageEnvelope(facade.snapshot()).units.layout.data.rooms.find((entry) => entry.id === room!.id)!.name;
		expect(named()).toBe('Gallery');
		// The accepted install rebuilds the bindings on the next evaluated frame.
		facade.camera.evaluate(RECT, 2);
		const blank = facade.cardNameWriter({ sourceId: room!.id, sourceKind: 'room', ref: null })!;
		expect(await blank.commit('   ')).toMatchObject({ kind: 'refused' });
		expect(named()).toBe('Gallery');
	});

	it('holds the host gesture lease for a live proposal and refuses Undo with live-proposal', async () => {
		const { facade, host, services, wallId } = await mount();
		selectWall(facade, wallId);
		const instrument = createCardFieldsInstrument(services)!;
		expect(instrument.proposalLive()).toBe(false);

		instrument.edit('height', '2.4');
		expect(instrument.proposalLive()).toBe(true);
		// The Head shows the human reason; the command reports the stable code.
		expect(host.history().undoUnavailableReason).toContain('proposal is live');
		expect(await host.undo()).toMatchObject({ kind: 'unavailable', reason: 'live-proposal' });

		// Commit ends the proposal; the accepted edit is now undoable.
		expect(await instrument.commit('height')).toEqual({ kind: 'accepted' });
		expect(instrument.proposalLive()).toBe(false);
		expect(host.history().canUndo).toBe(true);
		expect((await host.undo()).kind).toBe('installed');

	});
});

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

describe('Layout scalar Stage grips',()=>{
 it.each(['height','thickness'] as const)('types a Wall %s through one lease, one F4 install and Undo',async(field)=>{
	  const {facade,host,wallId}=await mount();selectWall(facade,wallId);
	  const before=facade.snapshot().canonicalJson;
	  expect(facade.activateDisclosure('layout-wall-size-chip')).toBe(true);
	  const mark=facade.marks().find(m=>m.id===`layout-wall-${field}`)!;expect(mark?.tip).toBeDefined();
  const evaluationId=facade.evaluationId()!;
  expect(facade.pointerIntent({phase:'down',handleId:mark.id,css:mark.tip!,evaluationId}).claimed).toBe(true);
  expect(host.history().undoUnavailableReason).toContain('proposal is live');
  for(const key of field==='height'?'4.25':'0.31')expect(facade.gestureKeyIntent({kind:'type',key}).claimed).toBe(true);
  facade.pointerIntent({phase:'up',css:mark.tip!,evaluationId});expect(facade.snapshot().canonicalJson).toBe(before);
  facade.gestureKeyIntent({kind:'finish'});
  await expect.poll(()=>host.history().position).toBe(1);
  expect(stageEnvelope(facade.snapshot()).units.layout.data.walls.find(w=>w.id===wallId)?.[field]).toBe(field==='height'?4.25:.31);
  expect(host.history()).toMatchObject({depth:2,position:1});expect(facade.session.gesture()).toBeNull();
  expect((await host.undo()).kind).toBe('installed');expect(facade.snapshot().canonicalJson).toBe(before);
  facade.dispose();
 });
 it.each(['cancel','refused','reading'] as const)('leaves source and history unchanged after %s',async(end)=>{
	  const {facade,host,wallId}=await mount();selectWall(facade,wallId);const before=facade.snapshot().canonicalJson;
	  expect(facade.activateDisclosure('layout-wall-size-chip')).toBe(true);
	  const mark=facade.marks().find(m=>m.id==='layout-wall-height')!;const evaluationId=facade.evaluationId()!;
  facade.pointerIntent({phase:'down',handleId:mark.id,css:mark.tip!,evaluationId});
  if(end==='cancel')facade.pointerIntent({phase:'cancel',css:mark.tip!,evaluationId});
  else if(end==='reading')facade.pointerIntent({phase:'move',css:mark.tip!,evaluationId:'stale-evaluation'});
  else {for(const key of '0')facade.gestureKeyIntent({kind:'type',key});facade.gestureKeyIntent({kind:'finish'});facade.pointerIntent({phase:'cancel',css:mark.tip!,evaluationId});}
  expect(facade.snapshot().canonicalJson).toBe(before);expect(host.history()).toMatchObject({depth:1,position:0});expect(facade.session.gesture()).toBeNull();facade.dispose();
 });
	it('admits the three gable top knobs on a straight Wall without Unroll and drags the apex', async () => {
		const { facade, host, wallId } = await mount(gableFixture());
		selectWall(facade, wallId);
		expect(facade.activateDisclosure('layout-wall-size-chip')).toBe(true);
		const marks = facade.marks();
		for (const knob of ['start', 'apex', 'end'])
			expect(marks.find((mark) => mark.id === `layout-wall-top-${knob}`)).toMatchObject({
				planner: LAYOUT_WALL_TOP_KIND,
				hidden: false
			});
		// The Height grip shares the eave with Top at start: it keeps the canonical
		// world anchor but is shifted in screen space so neither glyph hides the other.
		const heightMark = marks.find((mark) => mark.id === 'layout-wall-height')!;
		const startMark = marks.find((mark) => mark.id === 'layout-wall-top-start')!;
		expect(heightMark.hidden).toBe(false);
		expect(Math.abs(heightMark.anchor[0] - startMark.anchor[0])).toBeGreaterThanOrEqual(30);
		expect(facade.hitMark({ css: heightMark.anchor, coarse: false })?.id).toBe('layout-wall-height');
		expect(facade.hitMark({ css: startMark.anchor, coarse: false })?.id).toBe('layout-wall-top-start');
		const apex = marks.find((mark) => mark.id === 'layout-wall-top-apex')!;
		const before = stageEnvelope(facade.snapshot()).units.layout.data.walls.find((wall) => wall.id === wallId)!;
		if (before.top.kind !== 'gable') throw new Error('the gable was not installed');
		const evaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', handleId: apex.id, css: apex.tip!, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: [apex.tip![0], apex.tip![1] - 30], evaluationId });
		facade.pointerIntent({ phase: 'up', css: [apex.tip![0], apex.tip![1] - 30], evaluationId });
		await expect.poll(() => host.history().position).toBe(1);
		const after = stageEnvelope(facade.snapshot()).units.layout.data.walls.find((wall) => wall.id === wallId)!;
		if (after.top.kind !== 'gable') throw new Error('the gable was lost');
		expect(after.top.apexRise).toBeGreaterThan(before.top.apexRise);
		expect(after.top.apexOffset).toBeCloseTo(before.top.apexOffset, 9);
		expect((await host.undo()).kind).toBe('installed');
		expect(stageEnvelope(facade.snapshot()).units.layout.data.walls.find((wall) => wall.id === wallId)!.top).toEqual(before.top);
		facade.dispose();
	});

	it('lowers the eave end without moving the other gable breakpoints', async () => {
		const { facade, host, wallId } = await mount(gableFixture());
		selectWall(facade, wallId);
		expect(facade.activateDisclosure('layout-wall-size-chip')).toBe(true);
		const before = stageEnvelope(facade.snapshot()).units.layout.data.walls.find((wall) => wall.id === wallId)!;
		if (before.top.kind !== 'gable') throw new Error('the gable was not installed');
		const start = facade.marks().find((mark) => mark.id === 'layout-wall-top-start')!;
		const evaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', handleId: start.id, css: start.tip!, evaluationId }).claimed).toBe(true);
		for (const key of '2.5') expect(facade.gestureKeyIntent({ kind: 'type', key }).claimed).toBe(true);
		facade.gestureKeyIntent({ kind: 'finish' });
		await expect.poll(() => host.history().position).toBe(1);
		const after = stageEnvelope(facade.snapshot()).units.layout.data.walls.find((wall) => wall.id === wallId)!;
		if (after.top.kind !== 'gable') throw new Error('the gable was lost');
		// The eave moved; the end and apex keep their absolute tops.
		expect(after.height).toBeCloseTo(2.5, 9);
		expect(after.height + after.top.startRise).toBeCloseTo(2.5, 9);
		expect(after.height + after.top.startRise).toBeLessThan(before.height + before.top.startRise);
		expect(after.height + after.top.endRise).toBeCloseTo(before.height + before.top.endRise, 9);
		expect(after.height + after.top.apexRise).toBeCloseTo(before.height + before.top.apexRise, 9);
		expect(after.top.apexOffset).toBeCloseTo(before.top.apexOffset, 9);
		facade.dispose();
	});

	it('refuses an eave below the hosted window, names the Opening and leaves source and history unchanged', async () => {
		const { facade, host, wallId, openingId } = await mount(gableFixture());
		selectWall(facade, wallId);
		expect(facade.activateDisclosure('layout-wall-size-chip')).toBe(true);
		const start = facade.marks().find((mark) => mark.id === 'layout-wall-top-start')!;
		const before = facade.snapshot().canonicalJson;
		const history = host.history();
		const evaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', handleId: start.id, css: start.tip!, evaluationId }).claimed).toBe(true);
		for (const key of '0.25') expect(facade.gestureKeyIntent({ kind: 'type', key }).claimed).toBe(true);
		facade.gestureKeyIntent({ kind: 'finish' });
		const refused = facade.marks().find((mark) => mark.id === 'layout-wall-top-start')!;
		const opening = stageEnvelope(facade.snapshot()).units.layout.data.openings.find((entry) => entry.id === openingId)!;
		const openingName = opening.name ?? (opening.kind === 'window' ? 'Window' : 'Door');
		expect(refused.refusal).toContain(openingName);
		expect(facade.snapshot().canonicalJson).toBe(before);
		expect(host.history()).toMatchObject({ depth: history.depth, position: history.position });
		facade.gestureKeyIntent({ kind: 'cancel' });
		facade.pointerIntent({ phase: 'cancel', css: start.tip!, evaluationId });
		facade.dispose();
	});

	it('keeps Opening height in the Card and exposes the 3D top-edge cursor only',async()=>{
	  const {facade,services,openingId}=await mount();const snapshot=facade.snapshot();
  const reference={version:1 as const,domain:'layout' as const,subject:{kind:'opening' as const,id:openingId},revision:{kind:'exact' as const,contentRevision:snapshot.domain.unitRevisions.layout},instancePath:[],location:{kind:'layout-location' as const,levelId:snapshot.domain.layoutLevelId,structureInstancePath:[]},componentId:null,capabilityId:null};
	  const representation: PlanSourceRef={sourceId:openingId,sourceKind:'opening',generationId:snapshot.compileGeneration,stream:'projected',subRef:null};
	  facade.setSelection({ordered:[{reference,representation}],primary:reference});
	  const marks=facade.marks();
	  expect(marks.find(m=>m.id==='layout-opening-height')).toBeUndefined();
	  expect(marks.find(m=>m.id==='layout-opening-height-top')).toMatchObject({hidden:true,resizeCursor:'opening-edge',planner:'layout-opening-resize'});
	  expect(createCardFieldsInstrument(services)!.fields().some(field=>field.id==='height')).toBe(true);
	  facade.dispose();
 });
});

/** A complete selection for one Room of the mounted source. */
function selectRoom(facade: StageFacade, roomId: string): void {
	const snapshot = facade.snapshot();
	const reference = {
		version: 1 as const,
		domain: 'layout' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
		subject: { kind: 'room' as const, id: roomId },
		instancePath: [],
		location: { kind: 'layout-location' as const, levelId: snapshot.domain.layoutLevelId, structureInstancePath: [] },
		componentId: null,
		capabilityId: null
	};
	facade.setSelection({ ordered: [{ reference }], primary: reference });
}

// Review pass 3: a selected Room moves by the cross under its label, carrying
// its connected Walls; the objects it holds stay put.
describe('Layout Room move', () => {
	const points = (facade: StageFacade) =>
		stageEnvelope(facade.snapshot()).units.layout.data.junctions.map((junction) => [...junction.point]);

	it('publishes the cross only for a selected Room', async () => {
		const { facade, wallId } = await mount();
		const room = stageEnvelope(facade.snapshot()).units.layout.data.rooms[0]!;
		expect(facade.marks().some((mark) => mark.id === 'layout-room-move-mark')).toBe(false);
		selectWall(facade, wallId);
		expect(facade.marks().some((mark) => mark.id === 'layout-room-move-mark')).toBe(false);
		selectRoom(facade, room.id);
		expect(facade.marks().find((mark) => mark.id === 'layout-room-move-mark')).toMatchObject({
			kind: 'point',
			planner: 'layout-room-move'
		});
		facade.dispose();
	});

	it('drags the Room as a dashed ghost and commits one translated history entry', async () => {
		const { facade, host } = await mount();
		const room = stageEnvelope(facade.snapshot()).units.layout.data.rooms[0]!;
		selectRoom(facade, room.id);
		const before = facade.snapshot().canonicalJson;
		const original = points(facade);
		const mark = facade.marks().find((entry) => entry.id === 'layout-room-move-mark')!;
		const evaluationId = facade.evaluationId()!;
		const to: [number, number] = [mark.anchor[0] + 80, mark.anchor[1] + 40];
		expect(facade.pointerIntent({ phase: 'down', handleId: mark.id, css: mark.anchor, evaluationId }).claimed).toBe(true);
		const spans: string[] = [];
		const observer = setWorkObserver({ span: (name) => spans.push(name), count: () => {} });
		try {
			const previewId = 'layout-room-move-candidate';
			facade.pointerIntent({ phase: 'move', css: [mark.anchor[0] + 35, mark.anchor[1] + 15], evaluationId });
			const first = facade.candidatePreviews().find((entry) => entry.id === previewId);
			expect(first?.role).toBe('subject');

			facade.pointerIntent({ phase: 'move', css: to, evaluationId });
			const next = facade.candidatePreviews().find((entry) => entry.id === previewId);
			expect(next?.role).toBe('subject');
			expect(next?.segments).toHaveLength(4);
			expect(next?.segments).not.toEqual(first?.segments);
		} finally {
			setWorkObserver(observer);
		}
		expect(spans.filter((name) => name.includes('compile') || name.includes('sampling'))).toEqual([]);
		expect(facade.snapshot().canonicalJson).toBe(before);

		const release: string[] = [];
		const releaseObserver = setWorkObserver({ span: () => {}, count: (name) => release.push(name) });
		try {
			facade.pointerIntent({ phase: 'up', css: to, evaluationId });
			await expect.poll(() => host.history().position).toBe(1);
			await expect.poll(() => facade.snapshot().canonicalJson).not.toBe(before);
		} finally {
			setWorkObserver(releaseObserver);
		}
		expect(release.filter((name) => name === 'compile')).toHaveLength(1);
		const moved = points(facade);
		const delta = [moved[0]![0]! - original[0]![0]!, moved[0]![1]! - original[0]![1]!];
		expect(Math.hypot(delta[0]!, delta[1]!)).toBeGreaterThan(0);
		moved.forEach((point, index) => {
			expect(point[0]! - original[index]![0]!).toBeCloseTo(delta[0]!, 9);
			expect(point[1]! - original[index]![1]!).toBeCloseTo(delta[1]!, 9);
		});
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(facade.session.gesture()).toBeNull();
		expect((await host.undo()).kind).toBe('installed');
		expect(facade.snapshot().canonicalJson).toBe(before);
		facade.dispose();
	});

	it.each(['cancel', 'click'] as const)('leaves source and history unchanged after %s', async (end) => {
		const { facade, host } = await mount();
		selectRoom(facade, stageEnvelope(facade.snapshot()).units.layout.data.rooms[0]!.id);
		const before = facade.snapshot().canonicalJson;
		const mark = facade.marks().find((entry) => entry.id === 'layout-room-move-mark')!;
		const evaluationId = facade.evaluationId()!;
		facade.pointerIntent({ phase: 'down', handleId: mark.id, css: mark.anchor, evaluationId });
		if (end === 'cancel') {
			facade.pointerIntent({ phase: 'move', css: [mark.anchor[0] + 80, mark.anchor[1]], evaluationId });
			facade.gestureKeyIntent({ kind: 'cancel' });
		} else {
			facade.pointerIntent({ phase: 'up', css: mark.anchor, evaluationId });
		}
		expect(facade.candidatePreviews().some((entry) => entry.id === 'layout-room-move-candidate')).toBe(false);
		expect(facade.snapshot().canonicalJson).toBe(before);
		expect(host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(facade.session.gesture()).toBeNull();
		facade.dispose();
	});
});
