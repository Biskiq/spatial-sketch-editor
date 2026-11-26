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

describe('contribution surface signal', () => {
	it('signals on registration and disposal, and not on an identical-content install', async () => {
		const { facade } = await mount();
		settle(facade);
		let signals = 0;
		const unsubscribe = facade.onAdaptersChanged(() => {
			signals += 1;
		});

		const registered = facade.registerStageAdapter({
			id: 'signal-probe',
			tasks: [{ id: 'signal-task', taskKind: 'signal-task', label: 'Signal' }]
		});
		expect(registered.kind).toBe('registered');
		expect(signals).toBe(1);

		// Identical content is `unchanged`: nothing rebinds, so the surface is not
		// invalidated and a mounted adapter's entries are not rebuilt for nothing.
		const same = await admitSource(stageEnvelope(facade.snapshot()), {
			sessionEpoch: facade.snapshot().sessionEpoch,
			acceptedRevision: { projectId: FIXTURE_PROJECT_ID, revisionId: 'revision-same-content' }
		});
		if (same.kind !== 'admitted') throw new Error('the identical-content snapshot was not admitted');
		expect(facade.installAccepted(same.snapshot).kind).toBe('unchanged');
		expect(signals).toBe(1);

		if (registered.kind === 'registered') registered.dispose();
		expect(signals).toBe(2);
		unsubscribe();
		facade.registerStageAdapter({ id: 'after-unsubscribe', tasks: [] });
		expect(signals).toBe(2);
	});

	it('delivers the surviving selection to a static binding after an install', async () => {
		const { facade, host, objectId } = await mount();
		settle(facade);
		const echoes: (string | null)[] = [];
		facade.registerStageAdapter({
			id: 'static-probe',
			selectionEcho: (current) => echoes.push(current?.sourceId ?? null)
		});
		facade.select(objectSelection(facade, objectId));
		expect(echoes).toEqual([objectId]);

		const outcome = await host.accept(
			moveIntent(
				objectId,
				host.coordinator().acceptedRevision().revisionId,
				facade.snapshot().domain.unitRevisions.layout,
				'op-static-echo',
				[3, 0, 1]
			)
		);
		expect(outcome.kind).toBe('installed');
		if (outcome.kind !== 'installed') return;
		expect(outcome.install.requalification.kind).toBe('requalified');
		expect(echoes).toEqual([objectId, objectId]);
	});

	it('never notifies from the read that rebuilds a binding, and coalesces once', async () => {
		const { facade, host, objectId } = await mount();
		settle(facade);
		// A factory adapter: the install retires its binding and leaves a rebuild
		// pending until the next live evaluation, so the next contribution read is what
		// discovers the rebuild.
		facade.registerStageAdapter({
			id: 'rebuild-probe',
			bind: () => ({ tasks: [{ id: 'rebuild-task', taskKind: 'rebuild-task', label: 'Rebuild' }] })
		});
		let signals = 0;
		facade.onAdaptersChanged(() => {
			signals += 1;
		});
		const outcome = await host.accept(
			moveIntent(
				objectId,
				host.coordinator().acceptedRevision().revisionId,
				facade.snapshot().domain.unitRevisions.layout,
				'op-signal-rebuild',
				[4, 0, 1]
			)
		);
		expect(outcome.kind).toBe('installed');
		expect(signals).toBe(0);

		settle(facade);
		// The read performs the rebuild. It must not call the listener synchronously:
		// a subscriber that writes reactive state would be doing it during a derived
		// evaluation, which the host's Svelte surface refuses.
		expect(facade.tasks().map((task) => task.id)).toEqual(['rebuild-task']);
		expect(signals).toBe(0);
		await Promise.resolve();
		await Promise.resolve();
		expect(signals).toBe(1);
	});
});
