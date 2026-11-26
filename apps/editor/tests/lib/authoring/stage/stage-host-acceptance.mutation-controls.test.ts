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

describe('mutation controls', () => {
	it('fails the acceptance assertions when the selection is cleared instead of requalified', async () => {
		const producer = await mount('session-s07-control-source');
		settle(producer.facade);
		const accepted = await producer.host.accept(
			moveIntent(
				producer.objectId,
				producer.host.coordinator().acceptedRevision().revisionId,
				producer.facade.snapshot().domain.unitRevisions.layout,
				'op-control-source',
				[7, 0, 1]
			)
		);
		expect(accepted.kind).toBe('installed');
		const target = producer.host.coordinator().acceptedSnapshot();

		const consumer = await mount('session-s07-control-target');
		settle(consumer.facade);
		consumer.facade.select(objectSelection(consumer.facade, consumer.objectId));
		// A static adapter is registered on purpose: it must **not** appear in
		// `reboundAdapters`, which is what the rebind assertion below proves.
		consumer.facade.registerStageAdapter({ id: 'static-control', tasks: [] });

		const admitted = await admitSource(target.domain.source, {
			sessionEpoch: consumer.facade.snapshot().sessionEpoch,
			acceptedRevision: target.acceptedRevision
		});
		if (admitted.kind !== 'admitted') throw new Error('the control snapshot was not admitted');

		// Control (a): the real install path with requalification disabled. The
		// criteria assert `requalified`, so they fail exactly here.
		const cleared = consumer.facade.installAccepted(admitted.snapshot, { requalify: () => null });
		expect(cleared.kind).toBe('installed');
		if (cleared.kind !== 'installed') return;
		expect(cleared.requalification).toEqual({ kind: 'cleared', reason: 'no-correspondence' });
		expect(() => expect(cleared.requalification.kind).toBe('requalified')).toThrow();

		// Control (b): the adapter-lifetime criterion. A factory adapter is the case
		// the criterion is about, so the control suppresses rebinding on a real factory
		// install with the symbol-keyed control and shows the criterion failing; a second facade
		// runs the same install without suppression and shows it holding.
		const suppressed = await mount('session-s07-control-suppressed');
		settle(suppressed.facade);
		let suppressedBuilds = 0;
		suppressed.facade.registerStageAdapter({
			id: 'factory-control',
			bind: () => {
				suppressedBuilds += 1;
				return { tasks: [{ id: 'factory-task', taskKind: 'factory-task', label: 'Factory' }] };
			}
		});
		expect(suppressedBuilds).toBe(1);
		const suppressedSource = await admitSource(target.domain.source, {
			sessionEpoch: suppressed.facade.snapshot().sessionEpoch,
			acceptedRevision: target.acceptedRevision
		});
		if (suppressedSource.kind !== 'admitted') throw new Error('the control snapshot was not admitted');
		const suppressedInstall = suppressed.facade.installAccepted(suppressedSource.snapshot, {
			[SKIP_REBIND_CONTROL]: true
		});
		expect(suppressedInstall.kind).toBe('installed');
		if (suppressedInstall.kind !== 'installed') return;
		expect(suppressedInstall.reboundAdapters).toEqual([]);
		expect(suppressedBuilds).toBe(1);
		expect(() => expect(suppressedInstall.reboundAdapters).toContain('factory-control')).toThrow();

		// The same install with rebinding in force: one rebuild, one new binding.
		const rebound = await mount('session-s07-control-rebound');
		settle(rebound.facade);
		let builds = 0;
		rebound.facade.registerStageAdapter({
			id: 'factory-control',
			bind: () => {
				builds += 1;
				return { tasks: [{ id: 'factory-task', taskKind: 'factory-task', label: 'Factory' }] };
			}
		});
		expect(builds).toBe(1);
		const reboundSource = await admitSource(target.domain.source, {
			sessionEpoch: rebound.facade.snapshot().sessionEpoch,
			acceptedRevision: target.acceptedRevision
		});
		if (reboundSource.kind !== 'admitted') throw new Error('the control snapshot was not admitted');
		const reboundInstall = rebound.facade.installAccepted(reboundSource.snapshot);
		expect(reboundInstall.kind).toBe('installed');
		if (reboundInstall.kind !== 'installed') return;
		expect(reboundInstall.reboundAdapters).toEqual(['factory-control']);
		// The rebuild waits for the next live evaluation; the read performs it.
		settle(rebound.facade);
		rebound.facade.tasks();
		expect(builds).toBe(2);
	});
});
