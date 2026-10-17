/**
 * T1.P01.S04 — Layout precision and Head Save integration.
 *
 * These tests drive a **real** F4 accept through the live coordinator and the
 * production adapter factory: no injected source and no test-only install path.
 * The properties pinned here are the slice's acceptance criteria:
 *
 * 1. the five production planners register through the adapter and an exact
 *    Wall height/thickness or Opening measure edit installs once with one undo;
 * 2. an invalid measure and a Wall shortened below its Opening
 *    reject with the retained planner's own message, and the accepted source,
 *    revision and history are unchanged;
 * 3. blank input never becomes zero and blur/Esс never commit;
 * 4. Place → Layout plinth captures the object id before evaluation, creates one
 *    ordinary Layout box and Undo removes it;
 * 5. the contributions are the AM-5 surface only: a Find entry, a Dimensions
 *    task while a Wall/Opening is selected, and Card facts from accepted source.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	type LayoutDocumentWallFirst,
	type PlanSourceRef
} from '@portfolio/layout-core';
import type { ProjectDocument } from '@portfolio/project-model';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, datumWorkingPlane, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageCardFacts, stageContributionGroups } from '$lib/authoring/stage/stage-contributions';
import { currentStageSource } from '$lib/authoring/stage/current-stage-source';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { createLayoutInstrument } from '$lib/authoring/adapters/layout/instrument';
import { createLayoutPlanners, layoutSubjectOf } from '$lib/authoring/adapters/layout/precision';
import { createDimensionsInstrument } from '$lib/authoring/adapters/layout/adapter-support';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-s04';
const ELEVATION = 0.5;

type Mounted = {
	readonly facade: StageFacade;
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
		role: 'boundary'
	});
	if (chained.kind !== 'success') throw new Error('the S04 enclosure was refused');
	const wallId = chained.document.walls[0]!.id;
	const opening = planCreateWallFirstOpening(chained.document, {
		wallId,
		kind: 'window',
		offset: 1,
		width: 1.2,
		height: 1.2,
		sillHeight: 1
	});
	if (opening.kind === 'rejected') throw new Error(`opening fixture refused: ${opening.rejection.message}`);
	return { document: opening.document, wallId, openingId: opening.changedOpeningIds[0]! };
}

async function mount(): Promise<Mounted> {
	const { document, wallId, openingId } = fixtureDocument();
	const project: ProjectDocument = {
		id: PROJECT_ID,
		name: 'S04 precision',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	};
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
	return { facade, host, services, document, wallId, openingId };
}

describe('T1.P01.S04 — Layout precision', () => {
	it('registers one planner per writable fact and contributes only through the AM-5 surface', async () => {
		const { facade, host, services, wallId } = await mount();
		expect(host.coordinator().planners()).toHaveLength(createLayoutPlanners().length);
		expect(createLayoutPlanners().map((planner) => planner.kind).sort()).toEqual([
			'layout-entity-name',
			'layout-opening-measure',
			'layout-plinth-place',
			'layout-wall-height',
			'layout-wall-thickness'
		]);
		const groups = stageContributionGroups(facade);
		expect(groups.some((group) => group.entries.some((entry) => entry.taskKind === 'layout-plinth-place'))).toBe(true);
		expect(facade.openContributedTask('layout-place-plinth')).toMatchObject({ kind: 'opened', instrument: { summary: 'Place plinth' } });

		// Capability Find lists operations, not subjects: Dimensions is always offered,
		// and without an inspectable subject it contributes no instrument.
		expect(facade.openContributedTask('layout-dimensions')).toMatchObject({ kind: 'opened', instrument: null });
		selectWall(facade, wallId);
		expect(facade.openContributedTask('layout-dimensions')).toMatchObject({ kind: 'opened', instrument: { summary: 'Dimensions' } });

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
			contentRevision: facade.snapshot().sourceContentId,
			port: services.authoring
		});
		const precisionValue = 2.734567890123;
		instrument.edit('height', String(precisionValue));
		const outcome = await instrument.commit('height');
		expect(outcome.kind).toBe('accepted');
		const accepted = currentStageSource(facade.snapshot()).source.layout.walls.find((wall) => wall.id === wallId)!;
		expect(accepted.height).toBe(precisionValue);
		// The baseline state is history entry one, so one accepted edit is depth two.
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await host.undo()).kind).toBe('installed');
		expect(
			currentStageSource(facade.snapshot()).source.layout.walls.find((wall) => wall.id === wallId)!.height
		).toBe(document.walls.find((wall) => wall.id === wallId)!.height);
	});

	it('rejects a Wall shortened below its Opening with the retained reason and writes nothing', async () => {
		const { facade, host, services, document, wallId, openingId } = await mount();
		const instrument = createLayoutInstrument({
			subject: { kind: 'wall', id: wallId },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().sourceContentId,
			port: services.authoring
		});
		instrument.edit('height', '1.2');
		const outcome = await instrument.commit('height');
		// The coordinator names the refusal class; the retained planner's own reason is
		// carried through unchanged, which is what the Instrument shows.
		expect(outcome).toMatchObject({ kind: 'refused', code: 'planner-rejected' });
		expect((outcome as { message: string }).message).toContain('does not fit Wall');
		// The baseline is entry one; a refused proposal adds none and moves nothing.
		expect(host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(
			currentStageSource(facade.snapshot()).source.layout.walls.find((wall) => wall.id === wallId)!.height
		).toBe(document.walls.find((wall) => wall.id === wallId)!.height);
		expect(
			currentStageSource(facade.snapshot()).source.layout.openings.find((opening) => opening.id === openingId)!.height
		).toBe(document.openings.find((opening) => opening.id === openingId)!.height);
	});

	it('never turns blank input into zero and never commits on blur or Esc', async () => {
		const { facade, services, document, wallId } = await mount();
		const port = { ...services.authoring, accept: async () => { throw new Error('no write expected'); } };
		const instrument = createLayoutInstrument({
			subject: { kind: 'wall', id: wallId },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().sourceContentId,
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
		const before = currentStageSource(facade.snapshot()).source.layout.objects.length;
		const instrument = createLayoutInstrument({
			subject: { kind: 'object', id: '(placement)' },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().sourceContentId,
			port: services.authoring
		});
		instrument.setPlacement('2.25', '-1.5');
		const outcome = await instrument.place();
		expect(outcome.kind).toBe('accepted');
		const objects = currentStageSource(facade.snapshot()).source.layout.objects;
		expect(objects).toHaveLength(before + 1);
		const created = objects.at(-1)!;
		expect(created.kind).toBe('box');
		expect(created.position[0]).toBe(2.25);
		expect(created.position[2]).toBe(-1.5);
		expect(created.position[1]).toBe(ELEVATION + created.dimensions[1] / 2);
		// The baseline state is history entry one, so one accepted edit is depth two.
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await host.undo()).kind).toBe('installed');
		expect(currentStageSource(facade.snapshot()).source.layout.objects).toHaveLength(before);
	});

	it('refuses a stale floor datum and a mismatched captured object id', async () => {
		const { facade, services, document } = await mount();
		const stale = createLayoutInstrument({
			subject: { kind: 'object', id: '(placement)' },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().sourceContentId,
			port: services.authoring
		});
		stale.setPlacement('1', '1');
		// The mounted datum is `document.floor.elevation`; a different accepted datum
		// is refused by the planner. Drive that path through the planner itself.
		const planner = createLayoutPlanners().find((entry) => entry.kind === 'layout-plinth-place')!;
		const snapshot = {
			acceptedRevision: facade.snapshot().acceptedRevision,
			sourceContentId: facade.snapshot().sourceContentId,
			sourceKind: facade.snapshot().sourceKind,
			sourceVersion: facade.snapshot().sourceVersion,
			domain: { identity: { projectId: PROJECT_ID }, source: currentStageSource(facade.snapshot()).source }
		} as unknown as Parameters<typeof planner.prepare>[0]['snapshot'];
		const baseIntent = {
			version: 1 as const,
			kind: 'layout-plinth-place',
			operationId: 'op',
			expectedRevision: facade.snapshot().acceptedRevision,
			targets: [],
			capturedInputs: [],
			allocatedIds: []
		};
		expect(
			planner.prepare({
				snapshot,
				intent: {
					...baseIntent,
					kind: 'layout-plinth-place',
					payload: { point: [1, 1], floorElevation: ELEVATION + 1, objectId: 'layout-object-1' },
					allocatedIds: [{ kind: 'layout-object', id: 'layout-object-1' }]
				},
				capturedInputs: [],
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
				capturedInputs: [],
				allocatedIds: []
			})
		).toMatchObject({ kind: 'rejected', code: 'invalid_value' });
		expect(layoutSubjectOf({ sourceKind: 'room-floor', sourceId: 'room' })).toBeNull();
		expect(datumWorkingPlane(ELEVATION).datumMeters).toBe(ELEVATION);
	});

	it('accepts one Opening measure edit with one undo and full typed precision', async () => {
		const { facade, host, services, document, openingId } = await mount();
		const instrument = createLayoutInstrument({
			subject: { kind: 'opening', id: openingId },
			document,
			projectId: PROJECT_ID,
			contentRevision: facade.snapshot().sourceContentId,
			port: services.authoring
		});
		const precisionSill = 0.9123456789012345;
		instrument.edit('sillHeight', String(precisionSill));
		expect(await instrument.commit('sillHeight')).toEqual({ kind: 'accepted' });
		const accepted = currentStageSource(facade.snapshot()).source.layout.openings.find(
			(opening) => opening.id === openingId
		)!;
		expect(accepted.sillHeight).toBe(precisionSill);
		// The baseline state is history entry one, so one accepted edit is depth two.
		expect(host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await host.undo()).kind).toBe('installed');
		expect(
			currentStageSource(facade.snapshot()).source.layout.openings.find((opening) => opening.id === openingId)!.sillHeight
		).toBe(document.openings.find((opening) => opening.id === openingId)!.sillHeight);
	});


	it('releases the proposal lease when a commit is refused or invalid', async () => {
		const { facade, host, services, wallId } = await mount();
		selectWall(facade, wallId);
		const instrument = createDimensionsInstrument(services)!;

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
			contentRevision: facade.snapshot().sourceContentId,
			port: services.authoring
		});
		instrument.edit('name', '  S04 boundary wall  ');
		expect(await instrument.commit('name')).toEqual({ kind: 'accepted' });
		// The canonical metadata planner owns trimming, so the accepted name is its
		// value, not the raw edit buffer.
		const renamed = currentStageSource(facade.snapshot()).source.layout.walls.find(
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
			contentRevision: facade.snapshot().sourceContentId,
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
			currentStageSource(facade.snapshot()).source.layout.walls.find((wall) => wall.id === wallId)!.name
		).toBe('Card boundary wall');

		// A Layout object's name is its identity, so no adapter claims a writer.
		expect(facade.cardNameWriter({ sourceId: '(placement)', sourceKind: 'object', ref: null })).toBeNull();
	});

	it('holds the host gesture lease for a live proposal and refuses Undo with live-proposal', async () => {
		const { facade, host, services, wallId } = await mount();
		selectWall(facade, wallId);
		const instrument = createDimensionsInstrument(services)!;
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
		revision: { kind: 'exact' as const, contentRevision: snapshot.sourceContentId },
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
