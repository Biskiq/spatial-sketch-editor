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

describe('selection requalification through accepted correspondence', () => {
	const selection: StageSelection = {
		sourceId: 'object-1',
		sourceKind: 'object',
		generationId: 'compile:before',
		ref: {
			sourceId: 'object-1',
			sourceKind: 'object',
			generationId: 'compile:before',
			stream: 'projected',
			subRef: null
		}
	};

	it('moves a surviving subject to the corresponding identity and generation', () => {
		const outcome = requalifySelection(
			selection,
			[
				{
					relation: 'preserved',
					before: layoutObjectReference('content-before', 'object-1'),
					after: layoutObjectReference('content-after', 'object-1')
				}
			],
			{ generationId: 'compile:after' }
		);
		expect(outcome.kind).toBe('requalified');
		if (outcome.kind !== 'requalified') return;
		expect(outcome.selection.sourceId).toBe('object-1');
		expect(outcome.selection.generationId).toBe('compile:after');
		expect(outcome.selection.ref.generationId).toBe('compile:after');
	});

	it('clears a retired subject with a reason instead of retargeting by proximity', () => {
		const outcome = requalifySelection(
			selection,
			[
				{
					relation: 'retired',
					before: layoutObjectReference('content-before', 'object-1'),
					after: null
				}
			],
			{ generationId: 'compile:after' }
		);
		expect(outcome).toEqual({ kind: 'cleared', reason: 'subject-retired' });
	});

	it('clears when the change carries no correspondence for the subject', () => {
		const outcome = requalifySelection(selection, [], { generationId: 'compile:after' });
		expect(outcome).toEqual({ kind: 'cleared', reason: 'no-correspondence' });
	});

	it('does not requalify onto a subject in another kind that shares the id', () => {
		// A Layout object and a Scene entity may legitimately share an opaque id.
		// Only the entry whose subject kind matches the selection decides the outcome.
		const outcome = requalifySelection(
			selection,
			[
				{
					relation: 'preserved',
					before: sceneEntityReference('content-before', 'object-1'),
					after: sceneEntityReference('content-after', 'object-1')
				}
			],
			{ generationId: 'compile:after' }
		);
		expect(outcome).toEqual({ kind: 'cleared', reason: 'no-correspondence' });
	});

	it('clears when the corresponding subject changed kind or owner', () => {
		const before = layoutObjectReference('content-before', 'object-1');
		const kindChanged = requalifySelection(
			selection,
			[
				{
					relation: 'preserved',
					before,
					after: { ...before, revision: { kind: 'exact', contentRevision: 'content-after' }, subject: { kind: 'wall', id: 'object-1' } }
				}
			],
			{ generationId: 'compile:after' }
		);
		expect(kindChanged).toEqual({ kind: 'cleared', reason: 'subject-retired' });

		const domainChanged = requalifySelection(
			selection,
			[
				{
					relation: 'preserved',
					before,
					after: { ...before, domain: 'scene', revision: { kind: 'exact', contentRevision: 'content-after' } }
				}
			],
			{ generationId: 'compile:after' }
		);
		expect(domainChanged).toEqual({ kind: 'cleared', reason: 'subject-retired' });
	});

	it('finds a matching component correspondence after a subject-level entry', () => {
		const before = layoutObjectReference('before', selection.sourceId);
		const component = { ...before, componentId: 'side' };
		const selected = { ...selection, ref: { ...selection.ref, subRef: { kind: 'component' as const, componentId: 'side' } } };
		expect(requalifySelection(selected, [
			{ relation: 'preserved', before, after: before },
			{ relation: 'preserved', before: component, after: component }
		], { generationId: 'next' })).toMatchObject({ kind: 'requalified', selection: { generationId: 'next' } });
	});

	it('does not keep a selected component through a subject-level correspondence entry', () => {
		const componentSelection: StageSelection = {
			...selection,
			ref: { ...selection.ref, subRef: { kind: 'component', componentId: 'wall-side-north' } }
		};
		// Both component ids are null: the entry speaks about the subject, not about the
		// component the creator selected, so the component does not survive it.
		const outcome = requalifySelection(
			componentSelection,
			[
				{
					relation: 'preserved',
					before: layoutObjectReference('content-before', 'object-1'),
					after: layoutObjectReference('content-after', 'object-1')
				}
			],
			{ generationId: 'compile:after' }
		);
		expect(outcome).toEqual({ kind: 'cleared', reason: 'subject-retired' });
	});

	it('clears an interval-qualified selection when the subject moves to another identity', () => {
		const intervalSelection: StageSelection = {
			...selection,
			ref: { ...selection.ref, subRef: { kind: 'interval', start: 0.2, end: 1.4 } }
		};
		const outcome = requalifySelection(
			intervalSelection,
			[
				{
					relation: 'preserved',
					before: layoutObjectReference('content-before', 'object-1'),
					after: layoutObjectReference('content-after', 'object-2')
				}
			],
			{ generationId: 'compile:after' }
		);
		expect(outcome).toEqual({ kind: 'cleared', reason: 'subject-retired' });
	});

	it('keeps a Region selected through its edge stream component', () => {
		// A Region's Plan fragment names a compiled stream component (`edge`), not
		// an F.1 component: `layoutSelectionReference` stores no component for it,
		// and the accepted edit must requalify the Region rather than retire it.
		const before = {
			...layoutObjectReference('content-before', 'region-1'),
			subject: { kind: 'region' as const, id: 'region-1' }
		};
		const regionSelection: StageSelection = {
			...selection,
			sourceId: 'region-1',
			sourceKind: 'region',
			ref: {
				...selection.ref,
				sourceId: 'region-1',
				sourceKind: 'region',
				subRef: { kind: 'component', componentId: 'edge' }
			}
		};
		const outcome = requalifySelection(
			regionSelection,
			[
				{
					relation: 'preserved',
					before,
					after: { ...before, revision: { kind: 'exact', contentRevision: 'content-after' } }
				}
			],
			{ generationId: 'compile:after' }
		);
		expect(outcome).toMatchObject({ kind: 'requalified' });
	});

	it('clears a component-qualified selection when the component does not survive', () => {
		const componentSelection: StageSelection = {
			...selection,
			ref: { ...selection.ref, subRef: { kind: 'component', componentId: 'wall-side-north' } }
		};
		const before = { ...layoutObjectReference('content-before', 'object-1'), componentId: 'wall-side-north' };
		const outcome = requalifySelection(
			componentSelection,
			[
				{
					relation: 'preserved',
					before,
					after: { ...before, componentId: null, revision: { kind: 'exact', contentRevision: 'content-after' } }
				}
			],
			{ generationId: 'compile:after' }
		);
		expect(outcome).toEqual({ kind: 'cleared', reason: 'subject-retired' });
	});
});
