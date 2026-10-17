import { currentStagePlanner, currentStageSource } from '$lib/authoring/stage/current-stage-source';
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
import { createDomainConsumer, consumerMove, consumerSceneEdit } from './__fixtures__/stage-domain-consumer';
import { describe, expect, it } from 'vitest';
import { planDeleteLayoutObject } from '@portfolio/layout-core';
import type { PlanSourceRef } from '@portfolio/layout-core';
import type { ProjectDocument } from '@portfolio/project-model';

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
import { stageCardFacts, stageContributionGroups } from '$lib/authoring/stage/stage-contributions';
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
} from './__fixtures__/f4-current-source-fixtures';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

type Mounted = {
	readonly facade: StageFacade;
	readonly snapshot: StageReadSnapshot;
	readonly host: StageAcceptanceHost;
	readonly objectId: string;
	readonly project: ProjectDocument;
};

async function mount(sessionEpoch = 'session-s07'): Promise<Mounted> {
	const { project, objectId } = buildCurrentSourceFixture();
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

describe('T1.P01.S07 — host↔F4 acceptance wiring', () => {
	it('mounts an external domain factory with planner registration, submission and live UI contributions', async () => {
		const { facade, snapshot, objectId } = await mount();
		const host = createStageAcceptanceHost({ facade, sessionEpoch: snapshot.sessionEpoch,
			baseline: { revision: snapshot.acceptedRevision, source: currentStageSource(snapshot).source,
				canonicalJson: snapshot.canonicalJson, sourceContentId: snapshot.sourceContentId } });
		settle(facade);
		const disposed: string[] = [];
		let services: StageAdapterServices | undefined;
		const registration = mountStageAdapter(facade, host, (port) => {
			services = port;
			return createDomainConsumer(objectId, disposed)(port);
		});
		if (registration.kind !== 'registered' || !services) throw new Error('consumer did not mount');
		expect(host.coordinator().planners()).toHaveLength(2);
		expect(stageContributionGroups(facade)[0]?.entries[0]?.label).toBe('Move probe');
		expect(facade.openContributedTask('consumer-move')).toMatchObject({ kind: 'opened', instrument: { summary: snapshot.sourceContentId } });
		const pose = facade.camera.state().pose;
		expect((await consumerMove(services, objectId)).kind).toBe('installed');
		settle(facade);
		expect(facade.camera.state().pose).toEqual(pose);
		expect(disposed).toEqual([snapshot.sourceContentId]);
		facade.openContributedTask('consumer-move');
		expect(facade.instrumentForTask('consumer-move')?.summary).toBe(facade.snapshot().sourceContentId);
		expect((await consumerSceneEdit(services)).kind).toBe('installed');
		expect(currentStageSource(facade.snapshot()).source.scene.entities[0]).toMatchObject({ receiveShadow: true });
		expect(host.history()).toMatchObject({ depth: 3, position: 2 });
		expect((await host.undo()).kind).toBe('installed');
		expect(currentStageSource(facade.snapshot()).source.scene.entities[0]).toMatchObject({ receiveShadow: false });
		expect((await host.redo()).kind).toBe('installed');
		settle(facade);
		facade.openContributedTask('consumer-move');
		expect(facade.session.task()).not.toBeNull();
		registration.dispose();
		expect(stageContributionGroups(facade)).toEqual([]);
		expect(facade.instrumentForTask('consumer-move')).toBeNull();
		expect(facade.session.task()).toBeNull();
		facade.dispose();
	});

	it('dispatches duplicate Find and task ids through the owning adapter', async () => {
		const { facade } = await mount();
		settle(facade);
		for (const id of ['a', 'b']) facade.registerStageAdapter({ id,
			tasks: [{ id: 'task', taskKind: 'work', label: id }],
			findEntries: [{ id: 'find', taskKind: 'work', label: id, railFamily: 'place', capability: 'probe' }],
			instrument: () => ({ summary: id }) });
		expect(facade.openFindEntry('b', 'find')).toMatchObject({ kind: 'opened', adapterId: 'b', taskId: 'task', instrument: { summary: 'b' } });
		expect(facade.instrumentForTask('task', 'b')).toEqual({ summary: 'b' });
		expect(facade.openFindEntry('missing', 'find')).toMatchObject({ kind: 'refused' });
		facade.dispose();
	});

	it('refuses retained adapter mutations after the shared session mounts a new epoch', async () => {
		const { facade, snapshot, project, objectId } = await mount();
		settle(facade);
		let retained: import('$lib/authoring/stage/stage-facade').StageAdapterBindingContext | null = null;
		facade.registerStageAdapter({ id: 'retained', bind(context) { retained = context; return {}; } });
		if (!retained) throw new Error('no bound context');
		const context = retained as import('$lib/authoring/stage/stage-facade').StageAdapterBindingContext;
		const next = await admitSource(project, { sessionEpoch: 'next-shared-epoch',
			acceptedRevision: { projectId: FIXTURE_PROJECT_ID, revisionId: 'next-shared-revision' } });
		if (next.kind !== 'admitted') throw new Error('replacement refused');
		const session = facade.session;
		facade.dispose();
		session.replace(next.snapshot);
		const current = createStageFacade({ snapshot: next.snapshot, session });
		current.acquireInspection();
		settle(current);
		const selection = objectSelection(current, objectId);
		current.select(selection);
		current.openTask({ kind: 'current-task', label: 'Current', targetRef: null });
		const lease = current.acquireGesture({ owner: 'current-owner', evaluationId: current.evaluationId()!, policy: 'cancel-on-reading-change' });
		if (lease.kind !== 'granted') throw new Error('gesture refused');
		context.select(null);
		expect(context.requestIntent({ kind: 'set-reading', reading: 'plan' }, 5).kind).toBe('superseded');
		expect(facade.openTask({ kind: 'stale', label: 'Stale', targetRef: null })).toBe(false);
		expect(facade.closeTask()).toBe(false);
		expect(facade.acquireGesture({ owner: 'stale', evaluationId: 'stale', policy: 'cancel-on-reading-change' })).toMatchObject({ kind: 'refused', code: 'stale-epoch' });
		expect(current.selection()).toEqual(selection);
		expect(session.task()?.kind).toBe('current-task');
		expect(lease.lease.active).toBe(true);
		current.closeTask();
		expect(lease.lease.active).toBe(false);
		current.dispose();
	});

	it('refuses captured factory projection after navigation changes the rendered evaluation', async () => {
		const { facade } = await mount();
		settle(facade);
		let retained: import('$lib/authoring/stage/stage-facade').StageAdapterBindingContext | null = null;
		facade.registerStageAdapter({ id: 'retained-math', bind(context) { retained = context; return {}; } });
		if (!retained) throw new Error('binding missing');
		const context = retained as import('$lib/authoring/stage/stage-facade').StageAdapterBindingContext;
		const oldRay = context.ray([640, 360]);
		if (oldRay === null) throw new Error('ray missing');
		expect(context.requestIntent({ kind: 'zoom', scale: 1.2 }, 4).kind).toBe('accepted');
		settle(facade, 5);
		expect(context.project([0, 0, 0])).toBeNull();
		expect(context.ray([640, 360])).toBeNull();
		expect(context.intersect(oldRay, datumWorkingPlane(0))).toMatchObject({ kind: 'failed', code: 'stale-evaluation' });
		expect(facade.pointerRay([640, 360], facade.evaluationId()!).kind).toBe('ray');
		facade.dispose();
	});

	it('finishes accepted rebind and teardown when one binding disposer throws', async () => {
		const { facade, host, snapshot, objectId } = await mount();
		settle(facade);
		const disposed: string[] = [];
		for (const id of ['throws', 'continues']) facade.registerStageAdapter({ id,
			bind(context) { return { tasks: [{ id, taskKind: id, label: context.snapshot.sourceContentId }],
				dispose() { disposed.push(id); if (id === 'throws') throw new Error('cleanup failed'); } }; } });
		expect((await host.accept(moveIntent(objectId, snapshot.acceptedRevision.revisionId,
			snapshot.sourceContentId, 'throwing-cleanup', [2, 0, 1]))).kind).toBe('installed');
		expect(disposed).toEqual(['throws', 'continues']);
		expect(facade.inspectionTicket()).not.toBeNull();
		settle(facade);
		expect(facade.tasks().map((task) => task.label)).toEqual([facade.snapshot().sourceContentId, facade.snapshot().sourceContentId]);
		facade.dispose();
		facade.dispose();
		expect(disposed).toEqual(['throws', 'continues', 'throws', 'continues']);
	});

	it('installs one real accepted change, keeps the pose, rebinds adapters once and requalifies the selection', async () => {
		const { facade, snapshot, host, objectId } = await mount();
		settle(facade);
		const poseBefore = facade.camera.state().pose;
		const ticketBefore = facade.inspectionTicket();
		expect(ticketBefore).not.toBeNull();
		const generationBefore = facade.snapshot().compileGeneration;

		facade.select(objectSelection(facade, objectId));

		// A T2-style adapter registers a factory: it is rebuilt for each accepted
		// snapshot and disposes its previous binding exactly once.
		let builds = 0;
		let disposals = 0;
		const registered = facade.registerStageAdapter({
			id: 's07-probe',
			bind: (context): StageAdapterBinding => {
				builds += 1;
				return {
					overlay: () => [
						{
							id: 'probe-marker',
							css: [1, 2],
							label: `probe:${context.snapshot.sourceContentId}`
						}
					],
					tasks: [
						{ id: 'subject-membership', taskKind: 'subject-membership', label: 'Probe membership' }
					],
					findEntries: [
						{
							id: 'find-probe',
							railFamily: 'place',
							capability: 'layout-object',
							label: 'Probe place',
							taskKind: 'subject-membership'
						}
					],
					cardFacts: () => [{ label: 'Owner', value: 's07-probe' }],
					dispose: () => {
						disposals += 1;
					}
				};
			}
		});
		expect(registered.kind).toBe('registered');
		expect(builds).toBe(1);

		const outcome = await host.accept(
			proofIntent({
				kind: PROOF_LAYOUT_TRANSFORM_KIND,
				operationId: 'op-object-move',
				expectedRevision: snapshot.acceptedRevision.revisionId,
				projectId: FIXTURE_PROJECT_ID,
				contentRevision: snapshot.sourceContentId,
				targets: [layoutObjectReference(snapshot.sourceContentId, objectId)],
				payload: { objectId, position: [1, 0, 1] }
			})
		);

		expect(outcome.kind).toBe('installed');
		if (outcome.kind !== 'installed') return;
		const install = outcome.install;

		// One install, same pose, one rebind, one disposal.
		expect(install.pose).toEqual(poseBefore);
		expect(facade.camera.state().pose).toEqual(poseBefore);
		expect(install.reboundAdapters).toEqual(['s07-probe']);
		// The source rebase ends the old evaluation, so the rebuild is deferred to the
		// first contribution read against the next live output — exactly once.
		settle(facade, 3);
		expect(facade.overlays()).toEqual([
			{ id: 'probe-marker', css: [1, 2], label: `probe:${facade.snapshot().sourceContentId}` }
		]);
		expect(builds).toBe(2);
		expect(disposals).toBe(1);
		expect(facade.adapters().map((adapter) => adapter.id)).toEqual(['s07-probe']);
		expect(outcome.selectionClearedReason).toBeNull();

		// The claim was re-acquired for the new source revision at the same pose.
		expect(install.claim?.ticket.runEpoch).toBeGreaterThan(ticketBefore!.runEpoch);
		expect(install.claim?.ticket.sourceRevision).toBe(facade.snapshot().sourceContentId);

		// The selection survived through correspondence and names the new generation.
		expect(install.requalification.kind).toBe('requalified');
		expect(facade.selection()?.sourceId).toBe(objectId);
		expect(facade.selection()?.generationId).toBe(facade.snapshot().compileGeneration);
		expect(facade.snapshot().compileGeneration).not.toBe(generationBefore);

		// One bounded history, owned by the coordinator.
		const history = host.history();
		expect(history.depth).toBe(2);
		expect(history.canUndo).toBe(true);
		expect(history.undoUnavailableReason).toBeNull();
	});

	it('undoes and redoes across Layout and Scene accepts through host commands', async () => {
		const { facade, snapshot, host, objectId } = await mount();
		settle(facade);
		const bootContent = snapshot.sourceContentId;

		const layout = await host.accept(
			proofIntent({
				kind: PROOF_LAYOUT_TRANSFORM_KIND,
				operationId: 'op-layout',
				expectedRevision: snapshot.acceptedRevision.revisionId,
				projectId: FIXTURE_PROJECT_ID,
				contentRevision: snapshot.sourceContentId,
				targets: [layoutObjectReference(snapshot.sourceContentId, objectId)],
				payload: { objectId, position: [2, 0, 1] }
			})
		);
		expect(layout.kind).toBe('installed');
		const afterLayout = facade.snapshot().sourceContentId;
		expect(afterLayout).not.toBe(bootContent);

		const scene = await host.accept(
			proofIntent({
				kind: PROOF_SCENE_SCALAR_KIND,
				operationId: 'op-scene',
				expectedRevision: host.coordinator().acceptedRevision().revisionId,
				projectId: FIXTURE_PROJECT_ID,
				contentRevision: afterLayout,
				targets: [sceneEntityReference(afterLayout, FIXTURE_ENTITY_ID)],
				payload: { entityId: FIXTURE_ENTITY_ID, receiveShadow: true }
			})
		);
		// The fixture's entity is a real Scene subject, so a second domain install is
		// expected; a refusal is a fixture problem, not a fallback path.
		expect(scene.kind).toBe('installed');
		const afterScene = facade.snapshot().sourceContentId;
		expect(afterScene).not.toBe(afterLayout);
		expect(host.history().depth).toBe(3);

		const undoScene = await host.undo();
		expect(undoScene.kind).toBe('installed');
		if (undoScene.kind !== 'installed') return;
		expect(facade.snapshot().sourceContentId).toBe(afterLayout);
		expect(undoScene.install.pose).toEqual(facade.camera.state().pose);

		const undoLayout = await host.undo();
		expect(undoLayout.kind).toBe('installed');
		expect(facade.snapshot().sourceContentId).toBe(bootContent);
		expect(host.history().canRedo).toBe(true);

		const redoLayout = await host.redo();
		expect(redoLayout.kind).toBe('installed');
		expect(facade.snapshot().sourceContentId).toBe(afterLayout);
		expect(host.history().canRedo).toBe(true);

		const redoScene = await host.redo();
		expect(redoScene.kind).toBe('installed');
		expect(facade.snapshot().sourceContentId).toBe(afterScene);
		expect(host.history().canRedo).toBe(false);
	});

	it('reports Undo as unavailable with its reason before anything is accepted', async () => {
		const { host } = await mount();
		const state = host.history();
		expect(state.canUndo).toBe(false);
		expect(state.undoUnavailableReason).toContain('Nothing to undo');
		const outcome = await host.undo();
		expect(outcome).toEqual({ kind: 'unavailable', direction: 'undo', reason: 'empty-stack' });
	});

	it('returns the actual fresh replacement epoch when the requested epoch was already used', async () => {
		const { facade, host, project } = await mount();
		const replaced = await host.replace({ source: project,
			revision: { projectId: FIXTURE_PROJECT_ID, revisionId: 'replacement-reused-epoch' }, sessionEpoch: host.sessionEpoch });
		if (replaced.kind !== 'replaced') throw new Error('replacement refused');
		expect(replaced.snapshot.sessionEpoch).not.toBe(host.sessionEpoch);
		expect(replaced.snapshot.sessionEpoch).toBe(host.coordinator().sessionEpoch());
		facade.dispose();
	});

	it('preserves the subject-retired reason through a real accepted deletion', async () => {
		const { facade, host, objectId, snapshot } = await mount();
		settle(facade);
		facade.select(objectSelection(facade, objectId));
		const proof = createProofLayoutPlanner(objectId);
		host.registerPlanner(currentStagePlanner({ ...proof, id: 'delete-probe', kind: 'delete-probe', prepare(input) {
			const prepared = proof.prepare(input);
			if (prepared.kind !== 'prepared') return prepared;
			const deletion = planDeleteLayoutObject(input.snapshot.domain.source.layout, objectId);
			if (deletion.kind !== 'success') throw new Error('deletion refused');
			return { ...prepared, candidate: { ...prepared.candidate,
				source: { ...input.snapshot.domain.source, layout: deletion.document },
				correspondence: [{ relation: 'retired', before: layoutObjectReference(input.snapshot.sourceContentId, objectId), after: null }] } };
		} }));
		const intent = moveIntent(objectId, snapshot.acceptedRevision.revisionId, snapshot.sourceContentId, 'delete-operation', [2, 0, 1]);
		expect(await host.accept({ ...intent, kind: 'delete-probe' })).toMatchObject({ kind: 'installed', selectionClearedReason: 'subject-retired' });
		expect(facade.selection()).toBeNull();
		expect(currentStageSource(facade.snapshot()).source.layout.objects).toEqual([]);
		facade.dispose();
	});

	it('starts a new baseline on replacement and refuses a prior-epoch completion', async () => {
		const { facade, host, objectId, project } = await mount();
		settle(facade);
		const first = await host.accept(
			proofIntent({
				kind: PROOF_LAYOUT_TRANSFORM_KIND,
				operationId: 'op-before-replacement',
				expectedRevision: host.coordinator().acceptedRevision().revisionId,
				projectId: FIXTURE_PROJECT_ID,
				contentRevision: facade.snapshot().sourceContentId,
				targets: [layoutObjectReference(facade.snapshot().sourceContentId, objectId)],
				payload: { objectId, position: [3, 0, 1] }
			})
		);
		expect(first.kind).toBe('installed');
		expect(host.history().canUndo).toBe(true);

		const replaced = await host.replace({
			source: project,
			revision: { projectId: FIXTURE_PROJECT_ID, revisionId: 'revision-replacement' },
			sessionEpoch: 'session-s07-replacement'
		});
		expect(replaced.kind).toBe('replaced');
		if (replaced.kind !== 'replaced') return;
		expect(replaced.snapshot.sessionEpoch).toBe('session-s07-replacement');

		// The replaced host installs nothing: a completion from the ended epoch — even
		// with a well-formed intent — is refused rather than installed.
		const afterReplacement = await host.accept(
			proofIntent({
				kind: PROOF_LAYOUT_TRANSFORM_KIND,
				operationId: 'op-prior-epoch',
				expectedRevision: 'revision-boot',
				projectId: FIXTURE_PROJECT_ID,
				contentRevision: facade.snapshot().sourceContentId,
				targets: [],
				payload: { objectId, position: [4, 0, 1] }
			})
		);
		expect(afterReplacement).toEqual({
			kind: 'refused',
			code: 'superseded-epoch',
			message: expect.stringContaining('ended')
		});
	});

	it('publishes contributed tasks, Find entries and Card facts with their registration', async () => {
		const { facade, objectId } = await mount();
		settle(facade);
		const before = facade.camera.state().pose;

		const first = facade.registerStageAdapter({
			id: 'z-adapter',
			tasks: [{ id: 'task-b', taskKind: 'task-b', label: 'B', order: 1 }],
			findEntries: [
				{
					id: 'find-b',
					railFamily: 'measure',
					capability: 'measure',
					label: 'B',
					taskKind: 'task-b',
					order: 1
				}
			],
			cardFacts: () => [{ label: 'Kind', value: 'B' }]
		});
		const second = facade.registerStageAdapter({
			id: 'a-adapter',
			tasks: [{ id: 'task-a', taskKind: 'task-a', label: 'A', order: 1 }],
			cardFacts: () => [{ label: 'Kind', value: 'A' }]
		});
		expect(first.kind).toBe('registered');
		expect(second.kind).toBe('registered');

		// Deterministic order: same order value, so adapter ID decides.
		expect(facade.tasks().map((task) => [task.adapterId, task.id])).toEqual([
			['a-adapter', 'task-a'],
			['z-adapter', 'task-b']
		]);
		expect(facade.findEntries().map((entry) => entry.adapterId)).toEqual(['z-adapter']);
		expect(
			facade.cardFacts({ sourceId: objectId, sourceKind: 'object', ref: null }).map((fact) => fact.value)
		).toEqual(['A', 'B']);

		const opened = facade.openFindEntry('z-adapter', 'find-b');
		expect(opened.kind).toBe('opened');
		if (opened.kind === 'opened') expect(opened.adapterId).toBe('z-adapter');
		expect(facade.camera.state().pose).toEqual(before);
		expect(facade.closeTask()).toBe(true);
		expect(facade.camera.state().pose).toEqual(before);

		// The shell's own generic view (what the Index and Card render) sees the same
		// contributions without knowing which adapter registered them.
		const subject = { sourceId: objectId, sourceKind: 'object' as const, ref: null };
		expect(stageContributionGroups(facade).map((group) => group.label)).toEqual(['Measure · Measure']);
		expect(stageContributionGroups(facade)[0]?.entries.map((entry) => entry.id)).toEqual(['find-b']);
		expect(
			stageCardFacts(facade, subject, [{ label: 'Stream', value: 'projected' }]).map((fact) => fact.label)
		).toEqual(['Stream', 'Kind', 'Kind (z-adapter)']);

		if (first.kind === 'registered') first.dispose();
		expect(facade.tasks().map((task) => task.id)).toEqual(['task-a']);
		expect(facade.findEntries()).toEqual([]);
		expect(stageContributionGroups(facade)).toEqual([]);
		expect(
			facade.cardFacts({ sourceId: objectId, sourceKind: 'object', ref: null }).map((fact) => fact.value)
		).toEqual(['A']);
		if (second.kind === 'registered') second.dispose();
		expect(facade.tasks()).toEqual([]);
		expect(stageContributionGroups(facade)).toEqual([]);
		expect(stageCardFacts(facade, subject, [])).toEqual([]);
	});

	it('mounts a contributed instrument in the one host and echoes the requalified selection once', async () => {
		const { facade, snapshot, host, objectId } = await mount();
		settle(facade);
		facade.select(objectSelection(facade, objectId));

		// Every echo this adapter observes, in order. A rebuild must receive the live
		// (requalified) selection exactly once, and never a cleared value first.
		const echoes: (string | null)[] = [];
		let disposals = 0;
		facade.registerStageAdapter({
			id: 't3-style-probe',
			bind: (): StageAdapterBinding => ({
				tasks: [{ id: 'experience-probe', taskKind: 'experience-probe', label: 'Probe instrument' }],
				selectionEcho: (current) => echoes.push(current?.sourceId ?? null),
				instrument: () => ({
					summary: 'Contributed instrument body',
					facts: [{ label: 'Owner', value: 't3-style-probe' }]
				}),
				dispose: () => {
					disposals += 1;
				}
			}),
			findEntries: [
				{
					id: 'experience-handoff',
					railFamily: 'experience',
					capability: 'handoff',
					label: 'Probe handoff',
					taskKind: 'experience-probe'
				}
			]
		});
		// The binding is built with the live selection already in place.
		expect(echoes).toEqual([objectId]);
		const poseBefore = facade.camera.state().pose;
		const opened = facade.openContributedTask('experience-probe');
		expect(opened.kind).toBe('opened');
		if (opened.kind !== 'opened') return;
		expect(opened.adapterId).toBe('t3-style-probe');
		expect(opened.instrument).toEqual({
			summary: 'Contributed instrument body',
			facts: [{ label: 'Owner', value: 't3-style-probe' }]
		});
		// Opening a contributed instrument is not Camera work.
		expect(facade.camera.state().pose).toEqual(poseBefore);

		const outcome = await host.accept(
			proofIntent({
				kind: PROOF_LAYOUT_TRANSFORM_KIND,
				operationId: 'op-echo',
				expectedRevision: snapshot.acceptedRevision.revisionId,
				projectId: FIXTURE_PROJECT_ID,
				contentRevision: snapshot.sourceContentId,
				targets: [layoutObjectReference(snapshot.sourceContentId, objectId)],
				payload: { objectId, position: [1.5, 0, 1] }
			})
		);
		expect(outcome.kind).toBe('installed');
		if (outcome.kind !== 'installed') return;
		expect(outcome.install.requalification.kind).toBe('requalified');
		settle(facade, 4);

		// One rebuild, one disposal, and exactly one echo of the surviving selection:
		// the rebound binding never sees a null that would mean "cleared".
		expect(disposals).toBe(1);
		expect(echoes).toEqual([objectId, objectId]);
		expect(echoes.filter((value) => value === null)).toEqual([]);
	});

	it('refuses an adapter that requires a capability this host does not provide', async () => {
		const { facade } = await mount();
		const refused = facade.registerStageAdapter({
			id: 'unsupported',
			requiredCapabilities: ['unit-acceptance-v1'],
			tasks: [{ id: 'x', taskKind: 'x', label: 'X' }]
		});
		expect(refused.kind).toBe('refused');
		if (refused.kind !== 'refused') return;
		expect(refused.code).toBe('unknown-required-capability');
		expect(facade.tasks()).toEqual([]);
	});
});

describe('T1.P01.S07 — selection requalification through accepted correspondence', () => {
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

describe('T1.P01.S07 — live-proposal state, epoch races and install refusal', () => {
	it('reports Undo as unavailable while a proposal is live, and the command agrees', async () => {
		const { facade, host, objectId } = await mount();
		settle(facade);
		const first = await host.accept(
			moveIntent(
				objectId,
				host.coordinator().acceptedRevision().revisionId,
				facade.snapshot().sourceContentId,
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
				facade.snapshot().sourceContentId,
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
		const pending = host.accept(moveIntent(objectId, revisionBefore, before, 'op-race', [5, 0, 1]));
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
			moveIntent(objectId, host.coordinator().acceptedRevision().revisionId, boot, 'op-refused', [6, 0, 1])
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
				facade.snapshot().sourceContentId, `lifecycle-${step}`, [step, 0, 1]))).kind).toBe('installed');
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
		settle(facade);
		expect((await host.accept(moveIntent(objectId, host.acceptedRevision().revisionId,
			facade.snapshot().sourceContentId, 'before-failed-replace', [1, 0, 2]))).kind).toBe('installed');
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
		expect(await host.replace({ source: currentStageSource(snapshot).source,
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

describe('T1.P01.S07 — contribution surface signal', () => {
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
		const same = await admitSource(currentStageSource(facade.snapshot()).source, {
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
				facade.snapshot().sourceContentId,
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
				facade.snapshot().sourceContentId,
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

describe('T1.P01.S07 — mutation controls', () => {
	it('fails the acceptance assertions when the selection is cleared instead of requalified', async () => {
		const producer = await mount('session-s07-control-source');
		settle(producer.facade);
		const accepted = await producer.host.accept(
			moveIntent(
				producer.objectId,
				producer.host.coordinator().acceptedRevision().revisionId,
				producer.facade.snapshot().sourceContentId,
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
