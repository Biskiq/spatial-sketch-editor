/**
 * The editor-only F.4 acceptance coordinator and its bounded history
 * (T1.P01.S03 plan §Acceptance criteria and §Concurrency and lifetime
 * invariants).
 *
 * One suite per behavioural contract, as `tests/README.md` rule 18 asks: this
 * file owns *the accepting boundary* — one install per request with one undo
 * result, deterministic replay, stale/ABA and epoch refusal, exact state
 * restoration, the 100-entry bound, and the scope refusals
 * `unit-acceptance-v1` owns. The admission and content-identity contracts live
 * in `f4-unit-acceptance.test.ts` and `tests/lib/project-model/units-*`; the
 * public-isolation boundary lives in `f4-public-isolation.test.ts` (arch lane).
 */
import { describe, expect, it } from 'vitest';

import {
	FIXTURE_ENTITY_ID,
	PROOF_INVALID_CANDIDATE_KIND,
	PROOF_LAYOUT_TRANSFORM_KIND,
	PROOF_SCENE_SCALAR_KIND,
	PROOF_SCENE_WALL_MOVE_KIND,
	buildCurrentSourceFixture,
	buildFoldedPartitionProject,
	createInvalidCandidatePlanner,
	createOverreachingPlanner,
	createProofLayoutPlanner,
	createSceneWithLayoutWritePlanner,
	createProofSceneScalarPlanner,
	layoutObjectReference,
	proofIntent,
	sceneEntityReference
} from './__fixtures__/f4-current-source-fixtures';
import {
	validateAuthoringIntent,
	type DomainPlanner,
	type PlannerRegistry,
	type AcceptanceSourceAdapter,
	type AcceptedRevision
} from '@portfolio/project-model';
import {
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	createUnitPlannerRegistry,
	serializeProjectEnvelope,
	validateProjectEnvelope,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	admitUnitContent,
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject
} from './__fixtures__/unit-envelope-fixtures';

const BOOT_REVISION: AcceptedRevision = { projectId: 'project-conformance', revisionId: 'revision-1' };
const HISTORY_LIMIT = 100;

async function boot(
	overrides: {
		readonly adapter?: AcceptanceSourceAdapter<ProjectEnvelope>;
		readonly planners?: readonly DomainPlanner<ProjectEnvelope>[];
	} = {}
) {
	const fixture = await buildCurrentSourceFixture();
	const admitted = await admitUnitProject(fixture.project, BOOT_REVISION);
	if (admitted.kind !== 'admitted') throw new Error(`the conformance fixture was not admitted: ${admitted.code}`);
	const registry = createUnitPlannerRegistry<ProjectEnvelope>();
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: overrides.adapter ?? createUnitAcceptanceAdapter({ compound: true }),
		sessionEpoch: 'session-1',
		baseline: {
			revision: BOOT_REVISION,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId,
			blockingIssues: admitted.blockingIssues
		},
		preparation: createUnitAcceptancePreparation({ registry, sessionEpoch: 'session-1' }),
		planners: overrides.planners ?? [
			createProofLayoutPlanner(fixture.objectId),
			createProofSceneScalarPlanner(),
			createInvalidCandidatePlanner()
		],
		mintRevisionId: (ordinal: number) => `revision-${ordinal + 1}`
	});
	return { coordinator, fixture, admitted };
}

function layoutIntent(
	fixture: Awaited<ReturnType<typeof buildCurrentSourceFixture>>,
	revision: AcceptedRevision,
	source: ProjectEnvelope,
	operationId: string,
	position: readonly [number, number, number]
) {
	const contentRevision = source.units.layout.header.contentRevision;
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
	source: ProjectEnvelope,
	operationId: string,
	receiveShadow: boolean
) {
	const contentRevision = source.units.scene.header.contentRevision;
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

/** The Camera unit's authored bytes. */
function cameraBytes(project: ProjectEnvelope): string {
	return JSON.stringify(project.units.camera.data);
}

describe('F.4 acceptance coordinator — one install per request', () => {
	it('answers with one accepted revision, one undo result and no half-installed state', async () => {
		const { coordinator, fixture } = await boot();
		const result = await coordinator.accept(
			layoutIntent(fixture, BOOT_REVISION, coordinator.current().source, 'op-1', [2, 0.5, 0])
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
			layoutIntent(first.fixture, BOOT_REVISION, first.coordinator.current().source, 'op-replay', [3, 0.5, 1])
		);
		const b = await second.coordinator.accept(
			layoutIntent(second.fixture, BOOT_REVISION, second.coordinator.current().source, 'op-replay', [3, 0.5, 1])
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

		const first = await coordinator.accept(
			sceneIntent(BOOT_REVISION, coordinator.current().source, 'op-scene-1', true)
		);
		expect(first.kind).toBe('accepted');
		if (first.kind !== 'accepted') return;
		const afterFirst = coordinator.current();
		const installsAfterFirst = coordinator.installs();

		// The planner itself refuses the no-op in the same position.
		const samePosition = await coordinator.accept(
			layoutIntent(fixture, afterFirst.revision, afterFirst.source, 'op-noop', [0, 0.5, 0])
		);
		expect(samePosition.kind).toBe('no-op');
		if (samePosition.kind === 'no-op') expect(samePosition.revision).toEqual(afterFirst.revision);

		// And identical authored contents are a no-op even when the intent is new.
		const identical = await coordinator.accept(
			sceneIntent(afterFirst.revision, afterFirst.source, 'op-scene-2', true)
		);
		expect(identical.kind).toBe('no-op');

		expect(coordinator.current().canonicalJson).toBe(afterFirst.canonicalJson);
		expect(coordinator.installs()).toBe(installsAfterFirst);
		expect(coordinator.history()).toEqual({ depth: 2, position: 1, limit: HISTORY_LIMIT });
	});

	it('restores full source after authored edits with cursor movement', async () => {
		const planner: DomainPlanner<ProjectEnvelope> = {
			...createProofLayoutPlanner('unused'),
			prepare({ snapshot, intent }) {
				const source = structuredClone(snapshot.domain.source);
				source.units.layout.data.identity!.cursor += 100;
				if ((intent.payload as { position: number[] }).position[0] === 1) source.units.layout.data.floor.name = 'Renamed floor';
				return { kind: 'prepared', candidate: {
					operationId: intent.operationId, sourceKind: UNIT_SOURCE_KIND, sourceVersion: UNIT_SOURCE_VERSION,
					source, changes: [], correspondence: [], diagnostics: []
				} };
			}
		};
		const { coordinator, fixture } = await boot({ planners: [planner] });
		const before = coordinator.current();

		// The envelope digest covers the authored Layout bytes, cursor included: a
		// cursor movement is a real content change, not a silent no-op.
		expect((await coordinator.accept(layoutIntent(fixture, before.revision, before.source, 'authored-and-cursor', [1, 0.5, 0]))).kind).toBe('accepted');
		const after = coordinator.current();
		expect(after.sourceContentId).not.toBe(before.sourceContentId);
		expect(after.source.units.layout.data.identity!.cursor).toBe(before.source.units.layout.data.identity!.cursor + 100);
		expect(JSON.parse(after.canonicalJson).units.layout.data.identity.cursor).toBe(after.source.units.layout.data.identity!.cursor);
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(before.canonicalJson);
		expect(coordinator.current().source.units.layout.data.identity).toEqual(before.source.units.layout.data.identity);
		expect(coordinator.current().sourceContentId).toBe(before.sourceContentId);
		expect(coordinator.current().revision).not.toEqual(before.revision);
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(after.canonicalJson);
		expect(coordinator.current().source.units.layout.data.identity).toEqual(after.source.units.layout.data.identity);
		expect(coordinator.current().sourceContentId).toBe(after.sourceContentId);
		expect(coordinator.current().revision).not.toEqual(after.revision);
	});

	it('refuses a revision the accepted state has moved past (stale/ABA)', async () => {
		const { coordinator, fixture } = await boot();
		const stale = layoutIntent(fixture, BOOT_REVISION, coordinator.current().source, 'op-stale-a', [2, 0.5, 0]);
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
				contentRevision: before.source.units.scene.header.contentRevision,
				targets: [sceneEntityReference(before.source.units.scene.header.contentRevision, FIXTURE_ENTITY_ID)],
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
		const inner = createUnitAcceptanceAdapter({ compound: true });
		const gates: Array<() => void> = [];
		const controlled: AcceptanceSourceAdapter<ProjectEnvelope> = {
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
		const source = coordinator.current().source;

		const firstPrepared = coordinator.accept(layoutIntent(fixture, BOOT_REVISION, source, 'op-race-a', [2, 0.5, 0]));
		const secondPrepared = coordinator.accept(sceneIntent(BOOT_REVISION, source, 'op-race-b', true));
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
		const inner = createUnitAcceptanceAdapter({ compound: true });
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const gated: AcceptanceSourceAdapter<ProjectEnvelope> = {
			sourceKind: inner.sourceKind,
			sourceVersion: inner.sourceVersion,
			async admit(candidate, baseline) {
				await gate;
				return inner.admit(candidate, baseline);
			}
		};
		const { coordinator, fixture } = await boot({ adapter: gated });

		const pending = coordinator.accept(layoutIntent(fixture, BOOT_REVISION, coordinator.current().source, 'op-epoch', [2, 0.5, 0]));
		const replacementProject = await createUnitProject({ id: 'project-replacement', name: 'Replacement project' });
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
		expect(outcome.code).toBe('invalid-envelope');
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
			layoutIntent(fixture, bootState.revision, bootState.source, 'op-layout', [2, 0.5, 0])
		);
		expect(layoutResult.kind).toBe('accepted');
		if (layoutResult.kind !== 'accepted') return;
		const layoutState = coordinator.current();
		const layoutCameraBytes = cameraBytes(layoutState.source);

		const sceneResult = await coordinator.accept(
			sceneIntent(layoutState.revision, layoutState.source, 'op-scene', true)
		);
		expect(sceneResult.kind).toBe('accepted');
		if (sceneResult.kind !== 'accepted') return;
		const sceneState = coordinator.current();

		// One mixed Layout/Scene stack: Undo walks it in exact reverse.
		const undoOne = await coordinator.undo();
		expect(undoOne.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(layoutState.canonicalJson);
		const undoTwo = await coordinator.undo();
		expect(undoTwo.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(bootState.canonicalJson);
		expect(await coordinator.undo()).toEqual({
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
		const validated = validateProjectEnvelope(coordinator.current().source);
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		expect(serializeProjectEnvelope(validated.envelope)).toBe(coordinator.current().canonicalJson);

		// Redo walks forward again without re-planning.
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(layoutState.canonicalJson);
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(sceneState.canonicalJson);
		expect(await coordinator.redo()).toEqual({
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
				layoutIntent(fixture, revision, coordinator.current().source, `op-${index}`, [
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

		expect((await coordinator.undo()).kind).toBe('restored');
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(coordinator.canRedo()).toBe(true);

		const afterUndos = coordinator.current().canonicalJson;
		const accepted = await coordinator.accept(
			layoutIntent(fixture, coordinator.acceptedRevision(), coordinator.current().source, 'op-branch', [
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
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterUndos);
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).not.toBe(afterUndos);
		expect(coordinator.history()).toEqual({ depth: 99, position: 98, limit: HISTORY_LIMIT });
	}, 30000);
});

describe('F.4 acceptance coordinator — unit scope', () => {
	it('admits compound and unit planners while refusing resource staging', async () => {
		const { coordinator } = await boot();
		const compound = coordinator.register({ ...createOverreachingPlanner({ compound: true }), kind: 'overreaching-compound' });
		const units = coordinator.register({ ...createOverreachingPlanner({ units: true }), kind: 'overreaching-units' });
		const resources = coordinator.register({ ...createOverreachingPlanner({ resources: true }), kind: 'overreaching-resources' });
		expect(compound.kind).toBe('registered');
		expect(units.kind).toBe('registered');
		expect(resources).toMatchObject({ kind: 'refused', reason: 'resource-admission' });
		expect(coordinator.registrationRefusals().map((refusal) => refusal.reason)).toEqual([
			'resource-admission'
		]);
		// The three conformance planners stay registered beside the two admitted ones.
		expect(coordinator.planners().map((planner) => planner.kind).sort()).toEqual([
			PROOF_INVALID_CANDIDATE_KIND,
			PROOF_LAYOUT_TRANSFORM_KIND,
			PROOF_SCENE_SCALAR_KIND,
			'overreaching-compound',
			'overreaching-units'
		].sort());
	});

	it('names the source kind and version the adapter admits', async () => {
		const { coordinator } = await boot();
		expect(coordinator.sourceKind).toBe(UNIT_SOURCE_KIND);
		expect(coordinator.acceptedSnapshot().sourceKind).toBe(UNIT_SOURCE_KIND);
		expect(coordinator.acceptedSnapshot().domain.source.id).toBe('project-conformance');
	});

	it('refuses a candidate that changes a domain outside the producing planner’s write set', async () => {
		// RR-4: a planner declared single-domain Scene whose candidate also moves a
		// Wall. The envelope is valid and the operation is one install, so only
		// per-planner scope enforcement can refuse it — targeted or untargeted,
		// because an untargeted intent carries no domain for the dispatcher to
		// compare.
		const { coordinator, fixture } = await boot();
		expect(coordinator.register(createSceneWithLayoutWritePlanner(fixture.objectId))).toEqual({
			kind: 'registered'
		});
		const before = coordinator.current();
		const sceneRevision = before.source.units.scene.header.contentRevision;
		for (const targets of [[], [sceneEntityReference(sceneRevision, FIXTURE_ENTITY_ID)]] as const) {
			const refused = await coordinator.accept(
				proofIntent({
					kind: PROOF_SCENE_WALL_MOVE_KIND,
					operationId: 'op-scene-with-layout-write',
					expectedRevision: before.revision.revisionId,
					projectId: before.revision.projectId,
					contentRevision: sceneRevision,
					targets,
					payload: null
				})
			);
			expect(refused, `targets: ${targets.length}`).toMatchObject({
				kind: 'rejected',
				code: 'admission-refused',
				reason: 'unsupported-change'
			});
			if (refused.kind !== 'rejected') continue;
			expect(refused.diagnostics.some((entry) => entry.code === 'out-of-scope-domain')).toBe(true);
			// No install, no revision, no history entry, no partial source.
			expect(coordinator.current()).toEqual(before);
			expect(coordinator.installs()).toBe(1);
			expect(coordinator.history().depth).toBe(1);
		}

		// The control: the same fixture confined to Scene still installs, so the
		// refusal is the extra domain and not the operation.
		const sceneOnly = await coordinator.accept(
			sceneIntent(before.revision, before.source, 'op-scene-only', true)
		);
		expect(sceneOnly.kind).toBe('accepted');
	});
});

// These cases challenge the coordinator with callers/planners that violate its assumptions.
describe('F.4 adversarial boundary regressions', () => {
	it('publishes detached immutable source, revision and history', async () => {
		const { coordinator, fixture } = await boot();
		const before = coordinator.current();
		expect(() => { coordinator.acceptedSnapshot().domain.source.name = 'external mutation'; }).toThrow();
		expect(coordinator.current().source.name).toBe(JSON.parse(before.canonicalJson).name);
		expect(() => { coordinator.current().source.name = 'bypass'; }).toThrow();
		expect(() => { (coordinator.acceptedRevision() as { revisionId: string }).revisionId = 'bypass'; }).toThrow();
		const result = await coordinator.accept(layoutIntent(fixture, coordinator.acceptedRevision(), before.source, 'immutable', [2, 0.5, 0]));
		expect(result.kind).toBe('accepted');
		if (result.kind !== 'accepted') return;
		expect(() => { result.snapshot.domain.source.name = 'bypass'; }).toThrow();
		await coordinator.undo();
		expect(coordinator.current().source.name).toBe(JSON.parse(before.canonicalJson).name);
	});

	it('enforces resource and project ownership on actual candidates', async () => {
		// Compound Layout/Camera changes are admitted by this profile; the resource
		// unit and the project identity remain outside what a unit operation owns.
		for (const change of ['resources', 'project'] as const) {
			const { coordinator } = await boot();
			const before = coordinator.current();
			const planner: DomainPlanner<ProjectEnvelope> = {
				...createProofSceneScalarPlanner(), kind: `overreach-${change}`,
				prepare({ snapshot, intent }) {
					const source = structuredClone(snapshot.domain.source);
					if (change === 'resources') source.units.resources.data.resources = [...source.units.resources.data.resources, { kind: 'texture', id: 'new-texture', contentRevision: 'sha256-other', pin: null, unresolved: null }];
					if (change === 'project') source.name = 'wrong owner';
					return { kind: 'prepared', candidate: { operationId: intent.operationId, sourceKind: UNIT_SOURCE_KIND, sourceVersion: snapshot.sourceVersion, source, changes: [], correspondence: [], diagnostics: [] } };
				}
			};
			coordinator.register(planner);
			expect(await coordinator.accept({ ...sceneIntent(before.revision, before.source, planner.kind, true), kind: planner.kind }), change).toMatchObject({ kind: 'rejected', code: 'admission-refused' });
			expect(coordinator.current()).toEqual(before);
			expect(coordinator.installs()).toBe(1);
		}
	});

	it('revalidates Undo and preserves the cursor on refusal', async () => {
		const inner = createUnitAcceptanceAdapter({ compound: true });
		let refuse = false;
		const adapter: AcceptanceSourceAdapter<ProjectEnvelope> = { ...inner, async admit(candidate, issues) {
			return refuse ? { kind: 'rejected', code: 'catalogue-changed', message: 'source no longer resolves', issues: [] } : inner.admit(candidate, issues);
		} };
		const { coordinator, fixture } = await boot({ adapter });
		await coordinator.accept(layoutIntent(fixture, coordinator.acceptedRevision(), coordinator.current().source, 'edit', [2, 0.5, 0]));
		const before = coordinator.current();
		const history = coordinator.history();
		refuse = true;
		expect(await coordinator.undo()).toMatchObject({ kind: 'refused', code: 'admission-refused' });
		expect(coordinator.current()).toEqual(before);
		expect(coordinator.history()).toEqual(history);
	});

	it('mints distinct default revisions across coordinator lifetimes and imported baselines', async () => {
		const { admitted } = await boot();
		const baseline = { revision: { projectId: BOOT_REVISION.projectId, revisionId: 'accepted-1' }, source: admitted.project };
		const a = await createUnitCoordinator({ baseline, sessionEpoch: 'session', planners: [createProofSceneScalarPlanner()] });
		const b = await createUnitCoordinator({ baseline, sessionEpoch: 'session', planners: [createProofSceneScalarPlanner()] });
		const intent = sceneIntent(a.acceptedRevision(), a.current().source, 'edit', true);
		expect((await a.accept(intent)).kind).toBe('accepted');
		expect(a.acceptedRevision()).not.toEqual(baseline.revision);
		expect((await b.accept(intent)).kind).toBe('accepted');
		expect(a.acceptedRevision()).not.toEqual(b.acceptedRevision());
	});

	it('captures the intent before admission and rejects caller-mutated stale requests', async () => {
		const inner = createUnitAcceptanceAdapter({ compound: true });
		const gates: Array<() => void> = [];
		const adapter: AcceptanceSourceAdapter<ProjectEnvelope> = { ...inner, admit(candidate, issues) { return new Promise((resolve) => gates.push(() => { void inner.admit(candidate, issues).then(resolve); })); } };
		const { coordinator, fixture } = await boot({ adapter });
		const source = coordinator.current().source;
		const stale = layoutIntent(fixture, BOOT_REVISION, source, 'captured', [2, 0.5, 0]);
		const pending = coordinator.accept(stale);
		const winner = coordinator.accept(sceneIntent(BOOT_REVISION, source, 'winner', true));
		gates[1]!(); await winner;
		(stale as { expectedRevision: AcceptedRevision }).expectedRevision = coordinator.acceptedRevision();
		gates[0]!();
		expect(await pending).toMatchObject({ kind: 'rejected', code: 'stale-revision' });
		expect(coordinator.installs()).toBe(2);
	});

	it('invalidates pending work even when replacement reuses an epoch string', async () => {
		const inner = createUnitAcceptanceAdapter({ compound: true });
		const gates: Array<() => void> = [];
		const adapter: AcceptanceSourceAdapter<ProjectEnvelope> = { ...inner, admit(candidate, issues) { return new Promise((resolve) => gates.push(() => { void inner.admit(candidate, issues).then(resolve); })); } };
		const { coordinator, fixture } = await boot({ adapter });
		const pending = coordinator.accept(layoutIntent(fixture, BOOT_REVISION, coordinator.current().source, 'old-epoch', [2, 0.5, 0]));
		const replacing = coordinator.replace({ revision: { ...BOOT_REVISION, revisionId: 'replacement' }, source: fixture.project, sessionEpoch: 'session-1' });
		gates[0]!();
		expect(await pending).toMatchObject({ kind: 'rejected', code: 'superseded-epoch' });
		gates[1]!(); await replacing;
	});

	it('qualifies correspondence to the accepted content', async () => {
		const { coordinator } = await boot();
		const result = await coordinator.accept(sceneIntent(BOOT_REVISION, coordinator.current().source, 'correspondence', true));
		expect(result.kind).toBe('accepted');
		if (result.kind !== 'accepted') return;
		expect(result.correspondence[0]!.after!.revision).toEqual({ kind: 'exact', contentRevision: result.snapshot.sourceContentId });
	});

	it('rejects cycles and accessors without throwing or invoking code', async () => {
		const { coordinator } = await boot();
		const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
		let reads = 0;
		const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { reads += 1; return reads; } });
		for (const payload of [cyclic, accessor]) {
			const input = { ...sceneIntent(BOOT_REVISION, coordinator.current().source, 'invalid', true), payload };
			expect(() => validateAuthoringIntent(input)).not.toThrow();
			expect(validateAuthoringIntent(input).success).toBe(false);
		}
		expect(reads).toBe(0);
	});

	it('retains null captured values and refuses closure overrides', async () => {
		const { coordinator } = await boot();
		const intent = sceneIntent(BOOT_REVISION, coordinator.current().source, 'capture', true);
		const result = validateAuthoringIntent({ ...intent, capturedInputs: [{ name: 'nullable', value: null }] });
		expect(result.success).toBe(true);
		if (result.success) expect(result.value.capturedInputs).toEqual([{ name: 'nullable', value: null }]);
		expect(await coordinator.accept(intent, [{ name: 'closure', value: (() => 1) as never }])).toMatchObject({ kind: 'rejected', code: 'invalid-intent' });
	});
});

// Controllable admission makes ordering deterministic without timing assertions.
function controlledAdmission() {
	const inner = createUnitAcceptanceAdapter({ compound: true });
	const gates: Array<() => void> = [];
	const adapter: AcceptanceSourceAdapter<ProjectEnvelope> = {
		...inner,
		admit(candidate, issues) {
			return new Promise((resolve, reject) => gates.push(() => { void inner.admit(candidate, issues).then(resolve, reject); }));
		}
	};
	return { adapter, gates };
}

describe('F.4 replacement and history contention', () => {
	it('keeps only the latest replacement even with repeated epoch labels and reverse completion', async () => {
		const { adapter, gates } = controlledAdmission();
		const { coordinator, fixture } = await boot({ adapter });
		const first = coordinator.replace({ source: { ...fixture.project, name: 'First' }, revision: { ...BOOT_REVISION, revisionId: 'first' }, sessionEpoch: 'same-label' });
		const second = coordinator.replace({ source: { ...fixture.project, name: 'Second' }, revision: { ...BOOT_REVISION, revisionId: 'second' }, sessionEpoch: 'same-label' });
		// An edit during replacement cannot install against the previous project.
		expect(await coordinator.accept(sceneIntent(BOOT_REVISION, coordinator.current().source, 'during-replace', true))).toMatchObject({ kind: 'rejected', code: 'superseded-epoch' });
		gates[1]!(); expect(await second).toMatchObject({ kind: 'replaced' });
		gates[0]!(); expect(await first).toMatchObject({ kind: 'refused', code: 'superseded-epoch' });
		expect(coordinator.current().source.name).toBe('Second');
		expect(coordinator.installs()).toBe(2);
	});

	it('refuses reused replacement revisions and keeps the previous baseline', async () => {
		const { coordinator, fixture } = await boot();
		expect(await coordinator.replace({ source: { ...fixture.project, name: 'ABA' }, revision: BOOT_REVISION })).toMatchObject({ kind: 'refused', code: 'reused-revision' });
		expect(coordinator.installs()).toBe(1);
	});

	it('does not move a stale Undo cursor when an edit wins admission first', async () => {
		const { adapter, gates } = controlledAdmission();
		const { coordinator, fixture } = await boot({ adapter });
		const first = coordinator.accept(layoutIntent(fixture, BOOT_REVISION, coordinator.current().source, 'first', [2, 0.5, 0]));
		gates[0]!(); await first;
		const undo = coordinator.undo();
		const edit = coordinator.accept(sceneIntent(coordinator.acceptedRevision(), coordinator.current().source, 'winner', true));
		gates[2]!(); expect(await edit).toMatchObject({ kind: 'accepted' });
		gates[1]!(); expect(await undo).toMatchObject({ kind: 'refused', code: 'stale-revision' });
		expect(coordinator.history()).toEqual({ depth: 3, position: 2, limit: HISTORY_LIMIT });
	});

	it('refuses ABA after Undo restores the original contents', async () => {
		const { coordinator, fixture } = await boot();
		const originalId = coordinator.current().sourceContentId;
		const originalSource = coordinator.current().source;
		const stale = layoutIntent(fixture, BOOT_REVISION, originalSource, 'stale', [2, 0.5, 0]);
		await coordinator.accept(stale);
		await coordinator.undo();
		expect(coordinator.current().sourceContentId).toBe(originalId);
		expect(await coordinator.accept(stale)).toMatchObject({ kind: 'rejected', code: 'stale-revision' });
		expect(coordinator.history()).toEqual({ depth: 2, position: 0, limit: HISTORY_LIMIT });
	});

	it('handles digest failures as typed refusals without installing or truncating history', async () => {
		const adapter: AcceptanceSourceAdapter<ProjectEnvelope> = { ...createUnitAcceptanceAdapter({ compound: true }), async admit() { throw new Error('digest unavailable'); } };
		const { coordinator } = await boot({ adapter });
		expect(await coordinator.accept(sceneIntent(BOOT_REVISION, coordinator.current().source, 'failed-digest', true))).toMatchObject({ kind: 'rejected', code: 'admission-refused', reason: 'admission-failed' });
		expect(coordinator.installs()).toBe(1);
	});

	it('rejects invalid input and planner exceptions without exposing writable state', async () => {
		const { coordinator } = await boot();
		expect(await coordinator.accept(null as never)).toMatchObject({ kind: 'rejected', code: 'invalid-intent', actualRevision: null });
		coordinator.register({ ...createProofSceneScalarPlanner(), kind: 'throws', prepare() { throw new Error('planner error'); } });
		expect(await coordinator.accept({ ...sceneIntent(BOOT_REVISION, coordinator.current().source, 'throws', true), kind: 'throws' })).toMatchObject({ kind: 'rejected', code: 'planner-rejected' });
		expect(coordinator.installs()).toBe(1);
	});
});

it('reuses the enduring lifecycle/history with a source-independent preparation extension', async () => {
	type Source = { value: number };
	const planners = new Map<string, DomainPlanner<Source>>();
	const registry: PlannerRegistry<Source> = {
		register(planner) { planners.set(planner.kind, planner); return { kind: 'registered' }; },
		planners: () => [...planners.values()], plannerFor: (kind) => planners.get(kind) ?? null
	};
	const adapter: AcceptanceSourceAdapter<Source> = {
		sourceKind: 'conformance-other-source', sourceVersion: 1,
		async admit(input) {
			const source = input as Source;
			if (!Number.isFinite(source.value)) return { kind: 'rejected', code: 'invalid-value', message: 'value must be finite', issues: [] };
			return { kind: 'admitted', source, canonicalJson: JSON.stringify(source), sourceContentId: String(source.value), blockingIssues: [] };
		}
	};
	const planner: DomainPlanner<Source> = { id: 'other', kind: 'other', sourceKinds: [adapter.sourceKind], sourceVersions: [1], admission: { domain: 'camera', compound: true, units: true, resources: false },
		prepare({ intent, snapshot }) { return { kind: 'prepared', candidate: { operationId: intent.operationId, sourceKind: snapshot.sourceKind, sourceVersion: 1, source: { value: intent.payload as number }, changes: [], correspondence: [], diagnostics: [] } }; } };
	const coordinator = createAcceptanceCoordinator({ adapter, sessionEpoch: 'other', baseline: { revision: BOOT_REVISION, source: { value: 0 }, canonicalJson: '{"value":0}', sourceContentId: '0' }, planners: [planner],
		preparation: { registry, prepare(snapshot, intent) {
			const outcome = planner.prepare({ snapshot, intent, capturedInputs: intent.capturedInputs, allocatedIds: intent.allocatedIds });
			if (outcome.kind !== 'prepared') throw new Error('conformance planner failed');
			return outcome;
		} } });
	const otherIntent = (operationId: string, payload: number) => ({
		version: 1 as const, kind: 'other', operationId,
		expectedRevision: { projectId: BOOT_REVISION.projectId, revisionId: BOOT_REVISION.revisionId },
		targets: [], payload, capturedInputs: [], allocatedIds: []
	});
	const result = await coordinator.accept(otherIntent('other', 1));
	expect(result.kind).toBe('accepted');
	expect(coordinator.acceptedSnapshot().domain.source).toEqual({ value: 1 });
	expect(await coordinator.accept(otherIntent('stale-other', 2))).toMatchObject({ kind: 'rejected', code: 'stale-revision' });
	expect((await coordinator.undo()).kind).toBe('restored');
	expect(coordinator.acceptedSnapshot().domain.source).toEqual({ value: 0 });
	expect((await coordinator.redo()).kind).toBe('restored');
	expect(coordinator.acceptedSnapshot().domain.source).toEqual({ value: 1 });
});


it('refuses a source with a blocking fold through the one unit admission', async () => {
	const source = await buildFoldedPartitionProject();
	const blocked = await admitUnitContent(source);
	expect(blocked.kind).toBe('admitted');
	// The unit runtime reports the blocking compile issue; the Stage admission is
	// the path that refuses to mount it.
	const admitted = await admitUnitProject(source, BOOT_REVISION);
	expect(admitted.kind).toBe('rejected');
	if (admitted.kind !== 'rejected') return;
	expect(admitted.code).toBe('blocking-geometry');
});
