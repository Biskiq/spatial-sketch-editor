import { describe, expect, it } from 'vitest';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { currentStagePlanner, currentStageSource } from '$lib/authoring/stage/current-stage-source';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageAdapterBindingContext } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { buildCurrentSourceFixture, FIXTURE_PROJECT_ID, FIXTURE_ENTITY_ID, createProofSceneScalarPlanner,
	sceneEntityReference, layoutObjectReference, proofIntent, PROOF_SCENE_SCALAR_KIND } from './__fixtures__/f4-current-source-fixtures';
import { encodingIndependentRead, readAccepted, selectAccepted } from './__fixtures__/stage-accepted-read-consumer';

async function mount() {
	const { project, objectId } = buildCurrentSourceFixture();
	const admission = await admitSource(project, { sessionEpoch: 'semantic-lifecycle', acceptedRevision: { projectId: FIXTURE_PROJECT_ID, revisionId: 'boot' } });
	if (admission.kind !== 'admitted') throw new Error(admission.kind);
	const snapshot = admission.snapshot;
	const session = createStageSession(); session.replace(snapshot);
	const stage = createStageFacade({ session, snapshot });
	stage.acquireInspection(); stage.camera.evaluate({ left: 0, top: 0, width: 800, height: 600, devicePixelRatio: 1 }, 0);
	const host = createStageAcceptanceHost({ facade: stage, sessionEpoch: snapshot.sessionEpoch,
		baseline: { revision: snapshot.acceptedRevision, source: project, canonicalJson: snapshot.canonicalJson, sourceContentId: snapshot.sourceContentId }, planners: [createProofSceneScalarPlanner()] });
	const scene = () => sceneEntityReference(stage.snapshot().sourceContentId, FIXTURE_ENTITY_ID);
	const edit = () => host.accept(proofIntent({ kind: PROOF_SCENE_SCALAR_KIND, operationId: crypto.randomUUID(), projectId: FIXTURE_PROJECT_ID,
		expectedRevision: host.acceptedRevision().revisionId, contentRevision: stage.snapshot().sourceContentId, targets: [scene()], payload: { entityId: FIXTURE_ENTITY_ID, receiveShadow: true } }));
	return { stage, session, snapshot, host, scene, edit, objectId };
}

describe('Stage accepted read and ordered semantic selection', () => {
	it('supports a source-independent consumer and explicitly refuses the wrong encoding adapter', async () => {
		const { snapshot, scene } = await mount();
		const alternate = encodingIndependentRead(snapshot.domain);
		// A planner written against the current encoding refuses a foreign snapshot
		// instead of decoding it, and the common port never hands it one unchecked.
		expect(currentStagePlanner(createProofSceneScalarPlanner()).prepare({ snapshot: { sourceKind: 'test-read-port', sourceVersion: 27 } } as never))
			.toMatchObject({ kind: 'rejected', code: 'incompatible-source' });
		expect(readAccepted(alternate, scene())).toMatchObject({ kind: 'test-read-port', version: 27, resolution: { kind: 'resolved', subject: { owner: 'scene' } } });
		expect(() => currentStageSource(alternate)).toThrow('test-read-port@27');
		expect(snapshot.domain).not.toHaveProperty('project');
		expect(snapshot.domain).not.toHaveProperty('current');
		expect(Object.isFrozen(snapshot.domain.scene.entities)).toBe(true);
		expect(Object.isFrozen(currentStageSource(snapshot).source.scene.entities)).toBe(true);
		const session = createStageSession(); session.replace(alternate);
		const stage = createStageFacade({ session, snapshot: alternate });
		expect(selectAccepted(stage, scene())).toEqual({ kind: 'selected' });
		expect(stage.selectionState().primary).toEqual(scene());
	});
	it('keeps deterministic caller order, one explicit primary, Card facts and live selection echo', async () => {
		const { stage, scene, objectId, snapshot } = await mount();
		const layout = layoutObjectReference(snapshot.sourceContentId, objectId);
		const echoes: string[][] = [];
		stage.registerStageAdapter({ id: 'scene-reader', selectionChanged: (value) => echoes.push(value.ordered.map((entry) => entry.reference.subject.id)),
			cardFacts: (subject) => subject.reference?.domain === 'scene' ? [{ label: 'Canonical entity', value: subject.reference.subject.id }] : [] });
		expect(stage.setSelection({ ordered: [{ reference: scene() }, { reference: layout }, { reference: scene() }], primary: layout })).toEqual({ kind: 'selected' });
		expect(stage.selectionState().ordered.map((entry) => entry.reference.subject.id)).toEqual([FIXTURE_ENTITY_ID, objectId]);
		expect(stage.selectionState().primary).toEqual(layout);
		expect(echoes.at(-1)).toEqual([FIXTURE_ENTITY_ID, objectId]);
		expect(stage.cardFacts({ sourceId: FIXTURE_ENTITY_ID, sourceKind: 'entity', reference: scene(), ref: null })).toEqual([{ label: 'Canonical entity', value: FIXTURE_ENTITY_ID, adapterId: 'scene-reader' }]);
		const before = stage.selectionState();
		expect(stage.setSelection({ ordered: [{ reference: scene() }], primary: layout })).toMatchObject({ kind: 'refused', code: 'invalid-primary' });
		expect(stage.setSelection({ ordered: [{ reference: { ...scene(), instancePath: ['not-root'] } }], primary: scene() })).toMatchObject({ kind: 'refused' });
		// A Layout fragment from another compile is not a valid qualification.
		expect(stage.setSelection({ ordered: [{ reference: layout, representation: { sourceId: objectId, sourceKind: 'object', generationId: 'compile:stale', stream: 'projected', subRef: null } }], primary: layout }))
			.toMatchObject({ kind: 'refused', code: 'invalid-representation' });
		expect(stage.selectionState()).toBe(before);
	});
	it('dedups one canonical subject addressed with two equivalent locations', async () => {
		const { stage, objectId, snapshot } = await mount();
		const canonical = layoutObjectReference(snapshot.sourceContentId, objectId);
		const alias = { ...canonical, location: { kind: 'project-root' as const } };
		expect(stage.setSelection({ ordered: [{ reference: alias }, { reference: canonical }], primary: alias })).toEqual({ kind: 'selected' });
		expect(stage.selectionState().ordered).toHaveLength(1);
		// The stored address is the owner's canonical one, not the alias it was asked with.
		expect(stage.selectionState().ordered[0]?.reference).toEqual(canonical);
		expect(stage.selectionState().primary).toEqual(canonical);
	});
	it('requalifies Scene through accepted edit and history, reports absent correspondence, and clears on replacement', async () => {
		const { stage, session, scene, edit, host, objectId, snapshot } = await mount();
		const layout = layoutObjectReference(snapshot.sourceContentId, objectId);
		stage.setSelection({ ordered: [{ reference: layout }, { reference: scene() }], primary: scene() });
		const edited = await edit();
		expect(edited).toMatchObject({ kind: 'installed', selectionClearedReason: null, install: { selectionRemovals: [{ reference: layout, reason: 'no-correspondence' }] } });
		expect(stage.selectionState()).toEqual({ ordered: [{ reference: scene() }], primary: scene() });
		expect((await host.undo()).kind).toBe('installed');
		expect(stage.selectionState()).toEqual({ ordered: [{ reference: scene() }], primary: scene() });
		expect((await host.redo()).kind).toBe('installed');
		expect(stage.selectionState()).toEqual({ ordered: [{ reference: scene() }], primary: scene() });
		const stale = stage.selectionState();
		session.replace(snapshot);
		expect(stage.setSelection(stale)).toMatchObject({ kind: 'refused', code: 'stale-session' });
		expect(session.selectionState().ordered).toEqual([]);
	});
});

describe('Stage lens exit and explicit task Resume', () => {
	it('cancels each writer once, parks instruments, rejects captured callbacks, and resumes without restoring view or selection', async () => {
		const { stage, session, scene, snapshot, objectId } = await mount();
		let captured: StageAdapterBindingContext | undefined;
		let cancelled = 0; let revalidations = 0;
		stage.registerStageAdapter({ id: 'scene-task', bind(context) { captured = context; return {
			tasks: [{ id: 'scene', taskKind: 'scene', label: 'Scene task', target: scene(), configuration: { amount: 2 },
				revalidate: (task, current) => { revalidations++; expect(task.target?.revision).toEqual({ kind: 'exact', contentRevision: current.sourceContentId }); return { kind: 'resumed' }; } }],
			instrument: () => ({ summary: 'active only' }) }; } });
		stage.setSelection({ ordered: [{ reference: scene() }], primary: scene() });
		stage.openContributedTask('scene', 'scene-task');
		const old = captured!;
		session.writers().register('task', session.token(), () => cancelled++);
		const lease = stage.acquireGesture({ owner: 'scene', evaluationId: stage.evaluationId()!, policy: 'suspend-proposal' });
		expect(stage.changeLens('experience')).toBe(true);
		expect(stage.changeLens('experience')).toBe(false);
		expect(cancelled).toBe(1);
		expect(lease.kind).toBe('granted');
		expect(lease.kind === 'granted' && lease.lease.active).toBe(false);
		expect(stage.instrumentForTask('scene', 'scene-task')).toBeNull();
		expect(session.task()).toBeNull();
		expect(session.taskLifecycle()?.status).toBe('inactive');
		expect(stage.resumeTask()).toMatchObject({ kind: 'refused', code: 'wrong-lens' });
		stage.changeLens('world');
		expect(session.task()).toBeNull();
		expect(revalidations).toBe(0);
		const layout = layoutObjectReference(snapshot.sourceContentId, objectId);
		stage.setSelection({ ordered: [{ reference: layout }], primary: layout });
		const pose = stage.camera.state().pose;
		expect(old.setSelection({ ordered: [], primary: null })).toMatchObject({ kind: 'refused', code: 'stale-binding' });
		expect(stage.resumeTask()).toEqual({ kind: 'resumed' });
		expect(revalidations).toBe(1);
		expect(stage.selectionState().primary).toEqual(layout);
		expect(stage.camera.state().pose).toEqual(pose);
		expect(stage.instrumentForTask('scene', 'scene-task')?.summary).toBe('active only');
		stage.closeTask(); session.dispose(); expect(cancelled).toBe(1);
	});
	it('refuses a lens-bound contribution outside its lens with an actionable reason', async () => {
		const { stage, session } = await mount();
		stage.registerStageAdapter({ id: 'experience-only', tasks: [{ id: 'experience', taskKind: 'experience', label: 'Experience task', lens: 'experience' }] });
		expect(stage.openContributedTask('experience', 'experience-only')).toMatchObject({ kind: 'refused', code: 'wrong-lens', message: 'Return to the experience lens before invoking Experience task.' });
		expect(session.task()).toBeNull();
		expect(stage.changeLens('experience')).toBe(true);
		expect(stage.openContributedTask('experience', 'experience-only').kind).toBe('opened');
		stage.closeTask();
	});
	it('cancels an in-flight F4 preparation at lens exit without adding content or history', async () => {
		const { stage, host, edit } = await mount();
		const before = stage.snapshot();
		const pending = edit();
		stage.changeLens('experience');
		expect(await pending).toMatchObject({ kind: 'refused', code: 'superseded-epoch' });
		expect(stage.snapshot()).toBe(before);
		expect(host.history()).toMatchObject({ depth: 1, position: 0, canUndo: false });
	});
	it('revalidates against changed accepted content and refuses invalid configuration, removed targets and replacement', async () => {
		const { stage, session, scene, edit } = await mount();
		stage.registerStageAdapter({ id: 'invalid-task', tasks: [{ id: 'invalid', taskKind: 'invalid', label: 'Invalid task', target: scene(), configuration: { amount: -1 },
			revalidate: () => ({ kind: 'refused', code: 'invalid-configuration', message: 'Choose a positive amount.' }) }] });
		stage.openContributedTask('invalid');		stage.changeLens('experience');
		expect((await edit()).kind).toBe('installed');
		stage.changeLens('world');
		expect(stage.resumeTask()).toMatchObject({ kind: 'refused', code: 'invalid-configuration', message: 'Choose a positive amount.' });
		expect(session.task()).toBeNull();
		stage.closeTask();
		session.openTask({ kind: 'gone', label: 'Removed target', targetRef: null, target: { ...scene(), subject: { kind: 'entity', id: 'removed-id' } } });
		stage.changeLens('experience'); stage.changeLens('world');
		expect(stage.resumeTask()).toMatchObject({ kind: 'refused', code: 'missing', message: expect.stringContaining('Choose another target') });
		session.replace(stage.snapshot());
		expect(session.taskLifecycle()).toBeNull();
		expect(stage.resumeTask()).toMatchObject({ kind: 'refused', code: 'stale-session' });
	});
});
