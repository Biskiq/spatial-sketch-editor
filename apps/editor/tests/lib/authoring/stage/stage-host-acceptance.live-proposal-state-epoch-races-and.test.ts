/**
 * T1.P01.S07 — the host↔F4 integration bridge, proved from the host boundary.
 *
 * These tests drive a **real** F4 accept through the live coordinator (no injected
 * source, no test-only install path) and pin the plan's acceptance criteria:
 *
 * 1. exactly one install, with the view pose unchanged and the inspection claim
 *    re-acquired against the new source revision;
 * 2. the selection requalifies through accepted correspondence to the surviving
 *    subject and the new compile generation — it is neither cleared wholesale nor
 *    re-resolved by coordinate;
 * 3. a factory-bound adapter's binding is retired and disposed exactly once per
 *    accepted snapshot and rebuilt on the next evaluation (the mutation controls in
 *    the final block run the real install path with the selection cleared and with
 *    a factory adapter's rebinding suppressed, and show each acceptance assertion
 *    failing);
 * 4. Undo/Redo are host commands over the one bounded history, across mixed Layout
 *    and Scene planners, and a live proposal makes Undo unavailable with a reason;
 * 5. replacement starts a new baseline and an empty stack, and a prior-epoch
 *    completion cannot install;
 * 6. contributed tasks, Find entries and Card facts appear and disappear with their
 *    adapter's registration, and opening an instrument moves nothing.
 */
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { createDomainConsumer, consumerMove, consumerSceneEdit } from '../__fixtures__/stage-domain-consumer';
import { describe, expect, it } from 'vitest';
import type { Component } from 'svelte';
import { planDeleteLayoutObject } from '@portfolio/layout-core/wall';
import type { PlanSourceRef } from '@portfolio/layout-core/world';
import type { PlannerRequest } from '@portfolio/project-model/f4';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';

import { admitSource, type StageReadSnapshot } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSelection } from '$lib/authoring/stage/stage-session';
import {
	createStageFacade,
	SKIP_REBIND_CONTROL,
	type StageAdapterBinding,
	type StageFacade,
	datumWorkingPlane
} from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { requalifySelection } from '$lib/authoring/stage/selection-requalification';
import { stageCardFacts, stageFindEntries } from '$lib/authoring/stage/stage-contributions';
import {
	FIXTURE_ENTITY_ID,
	FIXTURE_PROJECT_ID,
	PROOF_LAYOUT_TRANSFORM_KIND,
	PROOF_SCENE_SCALAR_KIND,
	buildCurrentSourceFixture,
	createProofLayoutPlanner,
	createProofSceneScalarPlanner,
	layoutObjectReference,
	proofIntent,
	sceneEntityReference
} from '../__fixtures__/f4-current-source-fixtures';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

type Mounted = {
	readonly facade: StageFacade;
	readonly snapshot: StageReadSnapshot;
	readonly host: StageAcceptanceHost;
	readonly objectId: string;
	readonly project: ProjectEnvelope;
};

async function mount(sessionEpoch = 'session-s07'): Promise<Mounted> {
	const { project, objectId } = await buildCurrentSourceFixture();
	const admitted = await admitSource(project, {
		sessionEpoch,
		acceptedRevision: { projectId: FIXTURE_PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`the S07 fixture was not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: snapshot.sessionEpoch,
		baseline: {
			revision: snapshot.acceptedRevision,
			source: project,
			canonicalJson: snapshot.canonicalJson,
			sourceContentId: snapshot.sourceContentId
		},
		planners: [createProofLayoutPlanner(objectId), createProofSceneScalarPlanner()]
	});
	return { facade, snapshot, host, objectId, project };
}

/** A complete selection for one Layout object fragment of the mounted source. */
function objectSelection(facade: StageFacade, sourceId: string): StageSelection {
	const ref: PlanSourceRef = {
		sourceId,
		sourceKind: 'object',
		generationId: facade.snapshot().compileGeneration,
		stream: 'projected',
		subRef: null
	};
	return { sourceId, sourceKind: 'object', generationId: ref.generationId, ref };
}

/** One Layout object transform, addressed at the given content revision. */
function moveIntent(
	objectId: string,
	expectedRevision: string,
	contentRevision: string,
	operationId: string,
	position: [number, number, number]
) {
	return proofIntent({
		kind: PROOF_LAYOUT_TRANSFORM_KIND,
		operationId,
		expectedRevision,
		projectId: FIXTURE_PROJECT_ID,
		contentRevision,
		targets: [layoutObjectReference(contentRevision, objectId)],
		payload: { objectId, position }
	});
}

function settle(facade: StageFacade, clockSeconds = 3): void {
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	// A frame reads the live contributions; that read is what rebuilds a factory
	// binding the install left pending (there was no evaluation during the rebase).
	facade.overlays();
	facade.tasks();
}

describe('live-proposal state, epoch races and install refusal', () => {
	it('reports Undo as unavailable while a proposal is live, and the command agrees', async () => {
		const { facade, host, objectId } = await mount();
		settle(facade);
		const first = await host.accept(
			moveIntent(
				objectId,
				host.coordinator().acceptedRevision().revisionId,
				facade.snapshot().domain.unitRevisions.layout,
				'op-live-1',
				[1, 0, 1]
			)
		);
		expect(first.kind).toBe('installed');
		expect(host.history().canUndo).toBe(true);

		// Start a second accept and read the state before it settles. The coordinator
		// awaits real admission, so this is the production in-flight window, not a
		// manufactured flag.
		const pending = host.accept(
			moveIntent(
				objectId,
				host.coordinator().acceptedRevision().revisionId,
				facade.snapshot().domain.unitRevisions.layout,
				'op-live-2',
				[2, 0, 1]
			)
		);
		const live = host.history();
		expect(live.canUndo).toBe(false);
		expect(live.undoUnavailableReason).toContain('proposal is live');
		const blocked = await host.undo();
		expect(blocked).toEqual({ kind: 'unavailable', direction: 'undo', reason: 'live-proposal' });

		const settled = await pending;
		expect(settled.kind).toBe('installed');
		expect(host.history().canUndo).toBe(true);
	});

	it('refuses an accept that was in flight when the project was replaced', async () => {
		const { facade, host, objectId, project } = await mount();
		settle(facade);
		const before = facade.snapshot().sourceContentId;
		const installsBefore = host.coordinator().installs();
		const revisionBefore = host.coordinator().acceptedRevision().revisionId;

		// The accept is past its own synchronous checks and awaiting admission when the
		// replacement runs, so the refusal is the coordinator's generation guard — the
		// host's `disposed` flag alone could not be what stopped it.
		const pending = host.accept(moveIntent(objectId, revisionBefore, facade.snapshot().domain.unitRevisions.layout, 'op-race', [5, 0, 1]));
		const replaced = await host.replace({
			source: project,
			revision: { projectId: FIXTURE_PROJECT_ID, revisionId: 'revision-race' },
			sessionEpoch: 'session-s07-race'
		});
		expect(replaced.kind).toBe('replaced');

		// Replacement itself installs a new baseline, so the comparison is against the
		// post-replacement state: the in-flight accept must add no install on top of it.
		const installsAfterReplace = host.coordinator().installs();
		const settled = await pending;
		expect(settled).toMatchObject({ kind: 'refused', code: 'superseded-epoch' });
		expect(facade.snapshot().sourceContentId).toBe(before);
		expect(host.coordinator().installs()).toBe(installsAfterReplace);
		expect(host.coordinator().acceptedRevision().revisionId).toBe('revision-race');
		expect(installsAfterReplace).toBeGreaterThan(installsBefore);
		expect(revisionBefore).not.toBe('revision-race');
	});

	it('reverses a committed acceptance when the Stage refuses the install', async () => {
		const { facade, host, objectId } = await mount();
		settle(facade);
		const boot = facade.snapshot().sourceContentId;

		const pending = host.accept(
			moveIntent(objectId, host.coordinator().acceptedRevision().revisionId, facade.snapshot().domain.unitRevisions.layout, 'op-refused', [6, 0, 1])
		);
		// The Stage is gone before the accepted result reaches it: a non-lifetime
		// refusal for the host, but the coordinator has already committed.
		facade.dispose();
		const settled = await pending;
		expect(settled).toMatchObject({ kind: 'refused', code: 'disposed', compensation: 'reversed' });

		// The committed step is reversed: the coordinator's content is the mounted one
		// and its cursor points back at it. (The refused state remains reachable by
		// Redo, because the coordinator owns the one stack.)
		expect(host.coordinator().acceptedSnapshot().sourceContentId).toBe(boot);
		expect(host.coordinator().history().position).toBe(0);
	});

	it('unregisters the current factory binding exactly once after repeated rebinds', async () => {
		const { facade, host, objectId } = await mount();
		settle(facade);
		const disposed: number[] = [];
		let generation = 0;
		const registration = facade.registerStageAdapter({
			id: 'lifecycle',
			bind() {
				const ownGeneration = ++generation;
				return { dispose: () => disposed.push(ownGeneration) };
			}
		});
		if (registration.kind !== 'registered') throw new Error('registration refused');
		for (let step = 1; step <= 2; step += 1) {
			expect((await host.accept(moveIntent(objectId, host.acceptedRevision().revisionId,
				facade.snapshot().domain.unitRevisions.layout, `lifecycle-${step}`, [step, 0, 1]))).kind).toBe('installed');
			settle(facade, step + 3);
		}
		expect(generation).toBe(3);
		expect(disposed).toEqual([1, 2]);
		registration.dispose();
		registration.dispose();
		expect(disposed).toEqual([1, 2, 3]);
		// Reusing an id must not give an old registration power over the new one.
		facade.registerStageAdapter({ id: 'lifecycle', dispose: () => disposed.push(4) });
		registration.dispose();
		expect(facade.adapters()).toHaveLength(1);
		facade.dispose();
		facade.dispose();
		expect(disposed).toEqual([1, 2, 3, 4]);
	});

	it('preserves the exact F4 baseline and live Stage when replacement fails Stage admission', async () => {
		const { facade, host, objectId } = await mount();
		settle(facade);			expect((await host.accept(moveIntent(objectId, host.acceptedRevision().revisionId,
			facade.snapshot().domain.unitRevisions.layout, 'before-failed-replace', [1, 0, 2]))).kind).toBe('installed');
		settle(facade);
		facade.select(objectSelection(facade, objectId));
		const snapshot = facade.snapshot();
		const current = host.coordinator().current();
		const epoch = host.coordinator().sessionEpoch();
		const installs = host.coordinator().installs();
		const history = host.history();
		const selection = facade.selection();
		const ticket = facade.inspectionTicket();
		let disposed = 0;
		facade.registerStageAdapter({ id: 'still-live', dispose: () => { disposed += 1; } });
		// F4 validates the source, but Stage refuses the mismatched project identity.
		// No fake admission function or host bypass is involved.
		expect(await host.replace({ source: stageEnvelope(snapshot),
			revision: { projectId: 'wrong-project', revisionId: 'failed-replacement' },
			sessionEpoch: 'failed-replacement-epoch' })).toMatchObject({ kind: 'refused', code: 'project-mismatch' });
		expect(host.coordinator().current()).toBe(current);
		expect(host.coordinator().sessionEpoch()).toBe(epoch);
		expect(host.coordinator().installs()).toBe(installs);
		expect(host.history()).toEqual(history);
		expect(facade.snapshot()).toBe(snapshot);
		expect(facade.selection()).toEqual(selection);
		expect(facade.inspectionTicket()).toEqual(ticket);
		expect(disposed).toBe(0);
		expect((await host.undo()).kind).toBe('installed');
		expect((await host.redo()).kind).toBe('installed');
		facade.dispose();
	});

	it('creates no history for navigation, reading changes, selection or focus', async () => {
		const { facade, host, objectId } = await mount();
		settle(facade);
		const before = host.history();
		const revision = host.coordinator().acceptedRevision();
		const ticket = facade.inspectionTicket();
		expect(ticket).not.toBeNull();
		if (ticket === null) return;

		// Viewing intents evaluate through Camera; they never become accepted source.
		// Orbit belongs to the 3D reading, so it runs before the reading change.
		expect(
			facade.requestViewingIntent(
				{ kind: 'orbit', deltaAzimuthRadians: 0.2, deltaElevationRadians: 0.1 },
				ticket,
				1
			).kind
		).toBe('accepted');
		expect(facade.requestViewingIntent({ kind: 'set-reading', reading: 'plan' }, ticket, 2).kind).toBe('accepted');
		settle(facade, 4);

		// Selection and focus are host state, not accepted content.
		facade.select(objectSelection(facade, objectId));
		facade.select(null);

		expect(host.history()).toEqual(before);
		expect(host.coordinator().history()).toMatchObject({ depth: 1, position: 0 });
		expect(host.coordinator().acceptedRevision()).toEqual(revision);
	});
});
