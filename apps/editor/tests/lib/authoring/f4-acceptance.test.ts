/**
 * The editor-only F.4 acceptance coordinator and its bounded history
 * (T1.P01.S03 plan §Acceptance criteria and §Concurrency and lifetime
 * invariants).
 *
 * One suite per behavioural contract, as `tests/README.md` rule 18 asks: this
 * file owns *the accepting boundary* — one install per request with one undo
 * result, deterministic replay, stale/ABA and epoch refusal, exact state
 * restoration, the 100-entry bound, and the scope refusals
 * `local-single-domain-v1` owns. The admission and content-identity contracts
 * live in `f4-current-source-admission.test.ts` and
 * `tests/lib/project-model/content-identity.test.ts`; the public-isolation
 * boundary lives in `f4-public-isolation.test.ts` (arch lane).
 */
import { describe, expect, it } from 'vitest';

import {
	FIXTURE_ENTITY_ID,
	PROOF_INVALID_CANDIDATE_KIND,
	PROOF_LAYOUT_TRANSFORM_KIND,
	PROOF_SCENE_SCALAR_KIND,
	buildCurrentSourceFixture,
	createInvalidCandidatePlanner,
	createOverreachingPlanner,
	createProofLayoutPlanner,
	createProofSceneScalarPlanner,
	layoutObjectReference,
	proofIntent,
	sceneEntityReference
} from './__fixtures__/f4-current-source-fixtures';
import {
	CURRENT_SOURCE_KIND,
	admitCurrentSource,
	createCurrentSourceAdapter,
	validateProject,
	type AcceptanceSourceAdapter,
	type AcceptedRevision,
	type ProjectDocument
} from '@portfolio/project-model';
import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';

const BOOT_REVISION: AcceptedRevision = { projectId: 'project-conformance', revisionId: 'revision-1' };
const HISTORY_LIMIT = 100;

async function boot(
	overrides: {
		readonly adapter?: AcceptanceSourceAdapter<ProjectDocument>;
		readonly historyLimit?: number;
	} = {}
) {
	const fixture = buildCurrentSourceFixture();
	const admitted = await admitCurrentSource(fixture.project, { acceptedRevision: BOOT_REVISION });
	if (admitted.kind !== 'admitted') throw new Error(`the conformance fixture was not admitted: ${admitted.code}`);
	const coordinator = createAcceptanceCoordinator<ProjectDocument>({
		adapter: overrides.adapter ?? createCurrentSourceAdapter(),
		sessionEpoch: 'session-1',
		baseline: {
			revision: BOOT_REVISION,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId,
			blockingIssues: admitted.blockingIssues
		},
		planners: [
			createProofLayoutPlanner(fixture.objectId),
			createProofSceneScalarPlanner(),
			createInvalidCandidatePlanner()
		],
		mintRevisionId: (ordinal: number) => `revision-${ordinal + 1}`,
		historyLimit: overrides.historyLimit
	});
	return { coordinator, fixture, admitted };
}

function layoutIntent(
	fixture: ReturnType<typeof buildCurrentSourceFixture>,
	revision: AcceptedRevision,
	contentRevision: string,
	operationId: string,
	position: readonly [number, number, number]
) {
	return proofIntent({
		kind: PROOF_LAYOUT_TRANSFORM_KIND,
		operationId,
		expectedRevision: revision.revisionId,
		projectId: revision.projectId,
		contentRevision,
		targets: [layoutObjectReference(contentRevision, fixture.objectId)],
		payload: { objectId: fixture.objectId, position: [position[0], position[1], position[2]] }
	});
}

function sceneIntent(
	revision: AcceptedRevision,
	contentRevision: string,
	operationId: string,
	receiveShadow: boolean
) {
	return proofIntent({
		kind: PROOF_SCENE_SCALAR_KIND,
		operationId,
		expectedRevision: revision.revisionId,
		projectId: revision.projectId,
		contentRevision,
		targets: [sceneEntityReference(contentRevision, FIXTURE_ENTITY_ID)],
		payload: { entityId: FIXTURE_ENTITY_ID, receiveShadow }
	});
}

/** The Camera-bearing Scene fields, as canonical bytes. */
function cameraBytes(project: ProjectDocument): string {
	return JSON.stringify({ navigationNodes: project.scene.navigationNodes, connections: project.scene.connections });
}

describe('F.4 acceptance coordinator — one install per request', () => {
	it('answers with one accepted revision, one undo result and no half-installed state', async () => {
		const { coordinator, fixture } = await boot();
		const result = await coordinator.accept(
			layoutIntent(fixture, BOOT_REVISION, coordinator.current().sourceContentId, 'op-1', [2, 0.5, 0])
		);
		expect(result.kind).toBe('accepted');
		if (result.kind !== 'accepted') return;

		expect(result.beforeRevision).toEqual(BOOT_REVISION);
		expect(result.afterRevision).not.toEqual(result.beforeRevision);
		expect(result.snapshot.acceptedRevision).toEqual(result.afterRevision);
		expect(result.snapshot.sourceContentId).toBe(coordinator.current().sourceContentId);
		expect(result.undoResult).toEqual({
			kind: 'undoable',
			beforeRevision: BOOT_REVISION,
			inverseOperationId: 'op-1'
		});
		expect(result.changes).toEqual([
			{ kind: 'layout-object-transform', subjectIds: [fixture.objectId], fields: ['position'] }
		]);
		// Correspondence is returned as data, never applied as an identity guess.
		expect(result.correspondence).toHaveLength(1);
		expect(result.correspondence[0]!.relation).toBe('preserved');
		expect(result.correspondence[0]!.after?.subject.id).toBe(fixture.objectId);

		expect(coordinator.installs()).toBe(2);
		expect(coordinator.history()).toEqual({ depth: 2, position: 1, limit: HISTORY_LIMIT });
		expect(coordinator.acceptedRevision()).toEqual(result.afterRevision);
	});

	it('replays the same captured intent to identical contents under a fresh revision', async () => {
		const first = await boot();
		const second = await boot();
		const contentRevision = first.coordinator.current().sourceContentId;

		// Same captured inputs; a replayed set of top-level objects, not a shared
		// reference, so nothing can pass by aliasing.
		const a = await first.coordinator.accept(
			layoutIntent(first.fixture, BOOT_REVISION, contentRevision, 'op-replay', [3, 0.5, 1])
		);
		const b = await second.coordinator.accept(
			layoutIntent(second.fixture, BOOT_REVISION, contentRevision, 'op-replay', [3, 0.5, 1])
		);
		expect(a.kind).toBe('accepted');
		expect(b.kind).toBe('accepted');

		expect(first.coordinator.current().canonicalJson).toBe(second.coordinator.current().canonicalJson);
		expect(first.coordinator.current().sourceContentId).toBe(second.coordinator.current().sourceContentId);
		// The change's identity is the *content*: a fresh accepted revision on both
		// sides, equal contents on both sides.
		expect(first.coordinator.acceptedRevision().revisionId).not.toBe(BOOT_REVISION.revisionId);
		expect(second.coordinator.acceptedRevision().revisionId).not.toBe(BOOT_REVISION.revisionId);
	});

	it('treats an unchanged outcome as a no-op with no history entry and no new revision', async () => {
		const { coordinator, fixture } = await boot();
		const bootContentId = coordinator.current().sourceContentId;

		const first = await coordinator.accept(
			sceneIntent(BOOT_REVISION, bootContentId, 'op-scene-1', true)
		);
		expect(first.kind).toBe('accepted');
		if (first.kind !== 'accepted') return;
		const afterFirst = coordinator.current();
		const installsAfterFirst = coordinator.installs();

		// The planner itself refuses the no-op in the same position.
		const samePosition = await coordinator.accept(
			layoutIntent(fixture, afterFirst.revision, afterFirst.sourceContentId, 'op-noop', [0, 0.5, 0])
		);
		expect(samePosition.kind).toBe('no-op');
		if (samePosition.kind === 'no-op') expect(samePosition.revision).toEqual(afterFirst.revision);

		// And identical authored contents are a no-op even when the intent is new.
		const identical = await coordinator.accept(
			sceneIntent(afterFirst.revision, afterFirst.sourceContentId, 'op-scene-2', true)
		);
		expect(identical.kind).toBe('no-op');

		expect(coordinator.current().canonicalJson).toBe(afterFirst.canonicalJson);
		expect(coordinator.installs()).toBe(installsAfterFirst);
		expect(coordinator.history()).toEqual({ depth: 2, position: 1, limit: HISTORY_LIMIT });
	});

	it('refuses a revision the accepted state has moved past (stale/ABA)', async () => {
		const { coordinator, fixture } = await boot();
		const bootContentId = coordinator.current().sourceContentId;
		const stale = layoutIntent(fixture, BOOT_REVISION, bootContentId, 'op-stale-a', [2, 0.5, 0]);
		const applied = await coordinator.accept(stale);
		expect(applied.kind).toBe('accepted');
		if (applied.kind !== 'accepted') return;
		const afterApply = coordinator.current();

		const aba = await coordinator.accept(stale);
		expect(aba.kind).toBe('rejected');
		if (aba.kind !== 'rejected') return;
		expect(aba.code).toBe('stale-revision');
		expect(aba.expectedRevision).toEqual(BOOT_REVISION);
		expect(aba.actualRevision).toEqual(applied.afterRevision);
		expect(coordinator.current().canonicalJson).toBe(afterApply.canonicalJson);
		expect(coordinator.installs()).toBe(2);
	});

	it('rolls back completely when the shared validator refuses the candidate', async () => {
		const { coordinator } = await boot();
		const before = coordinator.current();
		const result = await coordinator.accept(
			proofIntent({
				kind: PROOF_INVALID_CANDIDATE_KIND,
				operationId: 'op-invalid',
				expectedRevision: before.revision.revisionId,
				projectId: before.revision.projectId,
				contentRevision: before.sourceContentId,
				targets: [sceneEntityReference(before.sourceContentId, FIXTURE_ENTITY_ID)],
				payload: { entityId: FIXTURE_ENTITY_ID }
			})
		);
		expect(result.kind).toBe('rejected');
		if (result.kind !== 'rejected') return;
		expect(result.code).toBe('admission-refused');
		expect(result.reason).not.toBeNull();
		expect(coordinator.current().canonicalJson).toBe(before.canonicalJson);
		expect(coordinator.acceptedRevision()).toEqual(before.revision);
		expect(coordinator.installs()).toBe(1);
		expect(coordinator.history()).toEqual({ depth: 1, position: 0, limit: HISTORY_LIMIT });
	});

	it('delivers exactly one install when two preparations race on one expected revision, in either completion order', async () => {
		const inner = createCurrentSourceAdapter();
		const gates: Array<() => void> = [];
		const controlled: AcceptanceSourceAdapter<ProjectDocument> = {
			sourceKind: inner.sourceKind,
			sourceVersion: inner.sourceVersion,
			admit(candidate, baseline) {
				const index = gates.length;
				return new Promise((resolve, reject) => {
					gates.push(() => {
						inner.admit(candidate, baseline).then(resolve, reject);
					});
				});
			}
		};
		const { coordinator, fixture } = await boot({ adapter: controlled });
		const contentId = coordinator.current().sourceContentId;

		const firstPrepared = coordinator.accept(layoutIntent(fixture, BOOT_REVISION, contentId, 'op-race-a', [2, 0.5, 0]));
		const secondPrepared = coordinator.accept(sceneIntent(BOOT_REVISION, contentId, 'op-race-b', true));
		expect(gates).toHaveLength(2);

		// The *second* preparation's digest completes first: the out-of-order case.
		gates[1]!();
		const secondResult = await secondPrepared;
		expect(secondResult.kind).toBe('accepted');
		gates[0]!();
		const firstResult = await firstPrepared;
		expect(firstResult.kind).toBe('rejected');
		if (firstResult.kind === 'rejected') expect(firstResult.code).toBe('stale-revision');

		// Exactly one install, one history entry, one published revision.
		expect(coordinator.installs()).toBe(2);
		expect(coordinator.history()).toEqual({ depth: 2, position: 1, limit: HISTORY_LIMIT });
	});

	it('cancels a completion from a superseded epoch and never installs it', async () => {
		const inner = createCurrentSourceAdapter();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const gated: AcceptanceSourceAdapter<ProjectDocument> = {
			sourceKind: inner.sourceKind,
			sourceVersion: inner.sourceVersion,
			async admit(candidate, baseline) {
				await gate;
				return inner.admit(candidate, baseline);
			}
		};
		const { coordinator, fixture } = await boot({ adapter: gated });
		const contentId = coordinator.current().sourceContentId;

		const pending = coordinator.accept(layoutIntent(fixture, BOOT_REVISION, contentId, 'op-epoch', [2, 0.5, 0]));
		const replacementProject: ProjectDocument = {
			...fixture.project,
			id: 'project-replacement',
			name: 'Replacement project'
		};
		const replacing = coordinator.replace({
			revision: { projectId: 'project-replacement', revisionId: 'revision-replacement' },
			source: replacementProject
		});
		release();

		const cancelled = await pending;
		expect(cancelled.kind).toBe('rejected');
		if (cancelled.kind !== 'rejected') return;
		expect(cancelled.code).toBe('superseded-epoch');
		expect(cancelled.actualRevision).toBeNull();

		const outcome = await replacing;
		expect(outcome.kind).toBe('replaced');
		if (outcome.kind === 'replaced') expect(outcome.revision.revisionId).toBe('revision-replacement');
		// Replacement starts one new baseline: the previous project's history is gone.
		expect(coordinator.history()).toEqual({ depth: 1, position: 0, limit: HISTORY_LIMIT });
		expect(coordinator.sessionEpoch()).not.toBe('session-1');
	});

	it('never installs an unvalidated source through replacement', async () => {
		const { coordinator } = await boot();
		const before = coordinator.current();
		const outcome = await coordinator.replace({
			revision: { projectId: 'project-broken', revisionId: 'revision-broken' },
			source: { id: 'project-broken', name: 'Broken' }
		});
		expect(outcome.kind).toBe('refused');
		if (outcome.kind !== 'refused') return;
		expect(outcome.code).toBe('invalid-project');
		expect(outcome.issues.length).toBeGreaterThan(0);
		expect(coordinator.current().canonicalJson).toBe(before.canonicalJson);
		expect(coordinator.acceptedRevision()).toEqual(BOOT_REVISION);
		expect(coordinator.history()).toEqual({ depth: 1, position: 0, limit: HISTORY_LIMIT });
		expect(coordinator.installs()).toBe(1);
	});
});

describe('F.4 acceptance coordinator — one chronological history', () => {
	it('restores exact contents, preserves Camera bytes, and rounds trips through the writer', async () => {
		const { coordinator, fixture } = await boot();
		const bootState = coordinator.current();
		const bootCameraBytes = cameraBytes(bootState.source);

		const layoutResult = await coordinator.accept(
			layoutIntent(fixture, bootState.revision, bootState.sourceContentId, 'op-layout', [2, 0.5, 0])
		);
		expect(layoutResult.kind).toBe('accepted');
		if (layoutResult.kind !== 'accepted') return;
		const layoutState = coordinator.current();
		const layoutCameraBytes = cameraBytes(layoutState.source);

		const sceneResult = await coordinator.accept(
			sceneIntent(layoutState.revision, layoutState.sourceContentId, 'op-scene', true)
		);
		expect(sceneResult.kind).toBe('accepted');
		if (sceneResult.kind !== 'accepted') return;
		const sceneState = coordinator.current();

		// One mixed Layout/Scene stack: Undo walks it in exact reverse.
		const undoOne = coordinator.undo();
		expect(undoOne.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(layoutState.canonicalJson);
		const undoTwo = coordinator.undo();
		expect(undoTwo.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(bootState.canonicalJson);
		expect(coordinator.undo()).toEqual({
			kind: 'unavailable',
			direction: 'undo',
			revision: coordinator.current().revision
		});

		// Camera-bearing Scene fields are byte-identical at every step.
		expect(cameraBytes(coordinator.current().source)).toBe(bootCameraBytes);
		expect(layoutCameraBytes).toBe(bootCameraBytes);
		expect(cameraBytes(sceneState.source)).toBe(bootCameraBytes);

		// Undo restored *contents*, under a fresh revision: the exact input a
		// Camera-output rebase needs in order to answer `unchanged`.
		expect(coordinator.current().sourceContentId).toBe(bootState.sourceContentId);
		expect(coordinator.acceptedSnapshot().sourceContentId).toBe(bootState.sourceContentId);
		expect(coordinator.acceptedRevision()).not.toEqual(bootState.revision);
		expect(coordinator.acceptedSnapshot().acceptedRevision).toEqual(coordinator.acceptedRevision());

		// Round trip: the restored state is exactly what the writer accepts.
		const validated = validateProject(coordinator.current().source);
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		expect(validated.canonicalJson).toBe(coordinator.current().canonicalJson);

		// Redo walks forward again without re-planning.
		expect(coordinator.redo().kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(layoutState.canonicalJson);
		expect(coordinator.redo().kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(sceneState.canonicalJson);
		expect(coordinator.redo()).toEqual({
			kind: 'unavailable',
			direction: 'redo',
			revision: coordinator.current().revision
		});
	});

	it('truncates the redo branch on a new edit and bounds the stack at 100 entries', async () => {
		const { coordinator, fixture } = await boot();
		let revision = BOOT_REVISION;
		for (let index = 1; index <= 105; index += 1) {
			const accepted = await coordinator.accept(
				layoutIntent(fixture, revision, coordinator.current().sourceContentId, `op-${index}`, [
					index * 0.1,
					0.5,
					0
				])
			);
			expect(accepted.kind, `accept ${index}`).toBe('accepted');
			if (accepted.kind !== 'accepted') return;
			revision = accepted.afterRevision;
		}

		// 105 edits, one bounded chronological stack of 100, positioned at the newest.
		expect(coordinator.history()).toEqual({ depth: 100, position: 99, limit: HISTORY_LIMIT });
		expect(coordinator.canUndo()).toBe(true);
		expect(coordinator.canRedo()).toBe(false);

		expect(coordinator.undo().kind).toBe('restored');
		expect(coordinator.undo().kind).toBe('restored');
		expect(coordinator.canRedo()).toBe(true);

		const afterUndos = coordinator.current().canonicalJson;
		const accepted = await coordinator.accept(
			layoutIntent(fixture, coordinator.acceptedRevision(), coordinator.current().sourceContentId, 'op-branch', [
				99,
				0.5,
				0
			])
		);
		expect(accepted.kind).toBe('accepted');
		// The new edit replaced the future: the two-entry redo branch is gone and the
		// stack stayed bounded. The 98 entries up to and including the state the edit
		// started from remain undoable — an edit appends to the timeline, it does not
		// overwrite the state it was made from — so the stack holds 99 states with the
		// cursor at the newest.
		expect(coordinator.canRedo()).toBe(false);
		expect(coordinator.history()).toEqual({ depth: 99, position: 98, limit: HISTORY_LIMIT });
		expect(coordinator.current().canonicalJson).not.toBe(afterUndos);

		// The state the branch edit started from is still one Undo away, not skipped:
		// a branch edit appends to the timeline instead of overwriting its origin.
		expect(coordinator.undo().kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterUndos);
		expect(coordinator.redo().kind).toBe('restored');
		expect(coordinator.current().canonicalJson).not.toBe(afterUndos);
		expect(coordinator.history()).toEqual({ depth: 99, position: 98, limit: HISTORY_LIMIT });
	}, 30000);
});

describe('F.4 acceptance coordinator — single-domain scope', () => {
	it('refuses compound and resource operations before any planner runs', async () => {
		const { coordinator, fixture } = await boot();
		const contentId = coordinator.current().sourceContentId;

		const compound = await coordinator.accept(
			proofIntent({
				kind: PROOF_LAYOUT_TRANSFORM_KIND,
				operationId: 'op-compound',
				expectedRevision: BOOT_REVISION.revisionId,
				projectId: BOOT_REVISION.projectId,
				contentRevision: contentId,
				targets: [
					layoutObjectReference(contentId, fixture.objectId),
					sceneEntityReference(contentId, FIXTURE_ENTITY_ID)
				],
				payload: { objectId: fixture.objectId, position: [1, 0.5, 0] }
			})
		);
		expect(compound.kind).toBe('rejected');
		if (compound.kind === 'rejected') expect(compound.code).toBe('unsupported-compound');

		const resource = await coordinator.accept(
			proofIntent({
				kind: PROOF_SCENE_SCALAR_KIND,
				operationId: 'op-resource',
				expectedRevision: BOOT_REVISION.revisionId,
				projectId: BOOT_REVISION.projectId,
				contentRevision: contentId,
				targets: [
					{
						version: 1,
						domain: 'resource:texture',
						revision: { kind: 'exact', contentRevision: contentId },
						subject: { kind: 'texture', id: 'texture-1' },
						instancePath: [],
						location: { kind: 'project-root' },
						componentId: null,
						capabilityId: null
					}
				],
				payload: { entityId: FIXTURE_ENTITY_ID, receiveShadow: true }
			})
		);
		expect(resource.kind).toBe('rejected');
		if (resource.kind === 'rejected') expect(resource.code).toBe('unsupported-resource');

		// Both refusals leave the accepted state and the history untouched.
		expect(coordinator.current().sourceContentId).toBe(contentId);
		expect(coordinator.installs()).toBe(1);
		expect(coordinator.history().depth).toBe(1);
	});

	it('refuses registration of a planner that needs compound, unit or resource acceptance', async () => {
		const { coordinator } = await boot();
		const compound = coordinator.register(createOverreachingPlanner({ compound: true }));
		const units = coordinator.register(createOverreachingPlanner({ units: true }));
		const resources = coordinator.register(createOverreachingPlanner({ resources: true }));
		expect(compound).toMatchObject({ kind: 'refused', reason: 'compound-acceptance' });
		expect(units).toMatchObject({ kind: 'refused', reason: 'unit-acceptance' });
		expect(resources).toMatchObject({ kind: 'refused', reason: 'resource-admission' });
		expect(coordinator.registrationRefusals().map((refusal) => refusal.reason)).toEqual([
			'compound-acceptance',
			'unit-acceptance',
			'resource-admission'
		]);
		// The three conformance planners stay registered.
		expect(coordinator.planners().map((planner) => planner.kind).sort()).toEqual([
			PROOF_INVALID_CANDIDATE_KIND,
			PROOF_LAYOUT_TRANSFORM_KIND,
			PROOF_SCENE_SCALAR_KIND
		].sort());
	});

	it('names the source kind and version the adapter admits', async () => {
		const { coordinator } = await boot();
		expect(coordinator.sourceKind).toBe(CURRENT_SOURCE_KIND);
		expect(coordinator.acceptedSnapshot().sourceKind).toBe(CURRENT_SOURCE_KIND);
		expect(coordinator.acceptedSnapshot().domain.source.id).toBe('project-conformance');
	});
});
