/**
 * D.4/H5 — unit-level structural sharing at the accepting boundary.
 *
 * One suite for one contract: capture and history **share** the parts of an
 * accepted source that content identity proves unchanged, and share nothing
 * else. The accepted facts must not move: the shared source still serializes to
 * exactly the recorded canonical bytes and still hashes to the recorded content
 * id, so sharing is an allocation change, never a content change.
 *
 * The falsifier is the second half of each test: the unit the operation changed
 * is a different object, and an adapter that claims an unchanged revision for
 * changed data could not produce an equal serialization.
 */
import { describe, expect, it } from 'vitest';

import {
	FIXTURE_ENTITY_ID,
	PROOF_SCENE_SCALAR_KIND,
	buildCurrentSourceFixture,
	createProofLayoutPlanner,
	createProofSceneScalarPlanner,
	proofIntent,
	sceneEntityReference
} from './__fixtures__/f4-current-source-fixtures';
import type { AcceptanceSourceAdapter, AcceptedRevision, DomainPlanner } from '@portfolio/project-model';
import {
	computeEnvelopeSourceContentId,
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	createUnitPlannerRegistry,
	serializeProjectEnvelope,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION
} from '@portfolio/project-model/units';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import { admitUnitProject } from './__fixtures__/unit-envelope-fixtures';

const BOOT_REVISION: AcceptedRevision = { projectId: 'project-conformance', revisionId: 'revision-1' };
const SHAREABLE = ['layout', 'camera', 'experience', 'resources'] as const;

async function boot(adapter: AcceptanceSourceAdapter<ProjectEnvelope> = createUnitAcceptanceAdapter({ compound: true })) {
	return bootFrom(await buildCurrentSourceFixture(), adapter);
}

async function bootFrom(
	fixture: Awaited<ReturnType<typeof buildCurrentSourceFixture>>,
	adapter: AcceptanceSourceAdapter<ProjectEnvelope> = createUnitAcceptanceAdapter({ compound: true })
) {
	const admitted = await admitUnitProject(fixture.project, BOOT_REVISION);
	if (admitted.kind !== 'admitted') throw new Error(`the fixture was not admitted: ${admitted.code}`);
	const registry = createUnitPlannerRegistry<ProjectEnvelope>();
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter,
		sessionEpoch: 'session-1',
		baseline: {
			revision: BOOT_REVISION,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId,
			blockingIssues: admitted.blockingIssues
		},
		preparation: createUnitAcceptancePreparation({ registry, sessionEpoch: 'session-1' }),
		planners: [createProofLayoutPlanner(fixture.objectId), createProofSceneScalarPlanner()],
		mintRevisionId: (ordinal: number) => `revision-${ordinal + 1}`
	});
	return { coordinator, fixture };
}

function sceneIntent(revision: AcceptedRevision, source: ProjectEnvelope, operationId: string, receiveShadow: boolean) {
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

describe('accepted capture shares unchanged units', () => {
	it('shares every unit a Scene edit did not change and replaces the one it did', async () => {
		const { coordinator } = await boot();
		const before = coordinator.current();

		const accepted = await coordinator.accept(sceneIntent(before.revision, before.source, 'op-scene-share', true));
		expect(accepted.kind).toBe('accepted');
		const after = coordinator.current();

		// Content identity is the proof, so the identity assertions and the content
		// assertions must hold together.
		expect(after.source.units.scene.header.contentRevision).not.toBe(before.source.units.scene.header.contentRevision);
		expect(after.source.units.scene).not.toBe(before.source.units.scene);
		for (const domain of SHAREABLE) {
			expect(after.source.units[domain].header.contentRevision).toBe(before.source.units[domain].header.contentRevision);
			expect(after.source.units[domain]).toBe(before.source.units[domain]);
		}
		// The lock still pins the same units, so it is shared too.
		expect(after.source.dependencyLock).toBe(before.source.dependencyLock);
	});

	it('does not move an accepted fact: the shared source serializes and hashes to the recorded ones', async () => {
		const { coordinator } = await boot();
		const before = coordinator.current();
		expect((await coordinator.accept(sceneIntent(before.revision, before.source, 'op-scene-equal', true))).kind).toBe('accepted');
		const after = coordinator.current();

		// The differential: canonical bytes and content id are exactly what a full
		// copy would produce, because sharing is value-preserving by construction.
		expect(serializeProjectEnvelope(after.source)).toBe(after.canonicalJson);
		expect(await computeEnvelopeSourceContentId(after.source)).toBe(after.sourceContentId);
		expect(after.sourceContentId).not.toBe(before.sourceContentId);
	});

	it('captures the changed unit as immutable data, not a live view of the planner', async () => {
		const { coordinator } = await boot();
		const before = coordinator.current();
		expect((await coordinator.accept(sceneIntent(before.revision, before.source, 'op-scene-freeze', true))).kind).toBe('accepted');
		const after = coordinator.current();

		expect(Object.isFrozen(after.source)).toBe(true);
		expect(Object.isFrozen(after.source.units.scene)).toBe(true);		expect(Object.isFrozen(after.source.units.scene.data)).toBe(true);
		// The shared units were frozen by the state they came from, so a frozen
		// baseline unit is not evidence on its own; the changed unit above is.
	});

	it('shares units across the history stack an Undo walks back through', async () => {
		const { coordinator } = await boot();
		const baseline = coordinator.current();
		expect((await coordinator.accept(sceneIntent(baseline.revision, baseline.source, 'op-scene-1', true))).kind).toBe('accepted');
		const first = coordinator.current();
		expect((await coordinator.accept(sceneIntent(first.revision, first.source, 'op-scene-2', false))).kind).toBe('accepted');
		const second = coordinator.current();

		// Two Scene edits: every state shares the four units neither edit touched, so
		// a three-entry history holds one copy of them rather than three.
		for (const state of [first, second]) {
			for (const domain of SHAREABLE) {
				expect(state.source.units[domain]).toBe(baseline.source.units[domain]);
			}
		}
		expect(second.source.units.scene).not.toBe(first.source.units.scene);

		expect((await coordinator.undo()).kind).toBe('restored');
		expect(coordinator.current().source.units.scene).toBe(first.source.units.scene);
		expect(coordinator.current().source.units.layout).toBe(baseline.source.units.layout);
		expect(coordinator.current().canonicalJson).toBe(first.canonicalJson);
		// Undo installs a state whose units are shared, so the same differential
		// applies there: the restored source still serializes to its own bytes.
		expect(serializeProjectEnvelope(coordinator.current().source)).toBe(coordinator.current().canonicalJson);
	});

	it('still accepts, and produces identical bytes, when the adapter declares no hook', async () => {
		// One fixture, two coordinators: the comparison is the same captured source
		// under the same edit, not two independently minted ids.
		const fixture = await buildCurrentSourceFixture();
		const adapter = createUnitAcceptanceAdapter({ compound: true });
		const copying: AcceptanceSourceAdapter<ProjectEnvelope> = {
			sourceKind: adapter.sourceKind,
			sourceVersion: adapter.sourceVersion,
			admit: (candidate, issues) => adapter.admit(candidate, issues)
		};
		const { coordinator } = await bootFrom(fixture, copying);
		const { coordinator: sharing } = await bootFrom(fixture, adapter);
		const before = coordinator.current();

		expect((await coordinator.accept(sceneIntent(before.revision, before.source, 'op-scene-copy', true))).kind).toBe('accepted');
		const after = coordinator.current();
		// No hook, no sharing: the capture copied the source, which is still correct
		// and still the same contents.
		expect(after.source.units.layout).not.toBe(before.source.units.layout);
		expect(serializeProjectEnvelope(after.source)).toBe(after.canonicalJson);
		expect(await computeEnvelopeSourceContentId(after.source)).toBe(after.sourceContentId);
		// The sharing adapter produced the same bytes for the same edit.
		expect((await sharing.accept(sceneIntent(sharing.current().revision, sharing.current().source, 'op-scene-copy', true))).kind).toBe('accepted');
		expect(sharing.current().canonicalJson).toBe(after.canonicalJson);
	});

	it('declares the hook only where the source format proves identity', () => {
		// The hook is a claim about one source format's identity rule. Only the unit
		// adapter — whose units carry content revisions — can make it.
		expect(typeof createUnitAcceptanceAdapter().shareUnchanged).toBe('function');
	});
});

describe('capture sharing compares the whole unit and the whole lock entry', () => {
	it('does not share a unit whose header changed while its data revision did not', async () => {
		const { coordinator } = await boot();
		const adapter = createUnitAcceptanceAdapter({ compound: true });
		const baseline = coordinator.current().source;
		const captured = structuredClone(baseline);
		captured.units.layout.header.unitId = 'unit-layout-renamed';

		// Data is unchanged, so the revision still matches; the header is authored
		// content the envelope digest covers, so the unit must NOT be shared.
		expect(captured.units.layout.header.contentRevision).toBe(baseline.units.layout.header.contentRevision);
		const shared = adapter.shareUnchanged!(captured, baseline);
		expect(shared.units.layout).not.toBe(baseline.units.layout);
		expect(shared.units.layout.header.unitId).toBe('unit-layout-renamed');
		expect(shared.units.camera).toBe(baseline.units.camera);
	});

	it('does not share a lock entry whose capability or pin changed while its revision did not', async () => {
		const { coordinator } = await boot();
		const adapter = createUnitAcceptanceAdapter({ compound: true });
		const baseline = structuredClone(coordinator.current().source) as ProjectEnvelope;
		const entry = {
			domain: 'layout' as const,
			subjectKind: 'wall',
			subjectId: 'wall-share',
			instancePath: [] as string[],
			contentRevision: `sha256-${'a'.repeat(64)}`,
			requiredCapabilities: [{ id: 't1.test:cap', version: '1' }],
			pin: null
		};
		baseline.dependencyLock = { ...baseline.dependencyLock, entries: [entry] };

		const capabilityAdded = structuredClone(baseline) as ProjectEnvelope;
		capabilityAdded.dependencyLock.entries[0]!.requiredCapabilities = [...entry.requiredCapabilities, { id: 't1.test:other', version: '1' }];
		expect(capabilityAdded.dependencyLock.entries[0]!.contentRevision).toBe(entry.contentRevision);
		expect(adapter.shareUnchanged!(capabilityAdded, baseline).dependencyLock).not.toBe(baseline.dependencyLock);

		const pinAdded = structuredClone(baseline) as ProjectEnvelope;
		pinAdded.dependencyLock.entries[0]!.pin = { hash: `sha256-${'b'.repeat(64)}`, mime: 'model/gltf-binary', size: 8, locator: '/projects/project-conformance/assets/share' };
		expect(adapter.shareUnchanged!(pinAdded, baseline).dependencyLock).not.toBe(baseline.dependencyLock);

		// The falsifiers do not make the hook useless: an identical lock is still shared.
		expect(adapter.shareUnchanged!(structuredClone(baseline) as ProjectEnvelope, baseline).dependencyLock).toBe(baseline.dependencyLock);
	});

	it('does not share across two different projects', async () => {
		const { coordinator } = await boot();
		const adapter = createUnitAcceptanceAdapter({ compound: true });
		const baseline = coordinator.current().source;
		const other = structuredClone(baseline);
		other.id = 'project-other';
		const shared = adapter.shareUnchanged!(other, baseline);
		expect(shared).toBe(other);
		expect(shared.units.layout).not.toBe(baseline.units.layout);
	});
});

describe('capture sharing cannot hide a change', () => {
	it('shares a unit only while its content revision is the baseline’s', async () => {
		const { fixture } = await boot();
		const adapter = createUnitAcceptanceAdapter({ compound: true });
		const planner: DomainPlanner<ProjectEnvelope> = {
			...createProofLayoutPlanner(fixture.objectId),
			prepare({ snapshot, intent }) {
				const source = structuredClone(snapshot.domain.source);
				// Rewrite the Scene unit's data without stamping its header: the
				// adapter's normalization re-derives the revision from the data, so the
				// captured unit can never be shared under a stale identity.
				source.units.scene.data.entities[0]!.position[0] += 0.25;
				return {
					kind: 'prepared',
					candidate: {
						operationId: intent.operationId,
						sourceKind: UNIT_SOURCE_KIND,
						sourceVersion: UNIT_SOURCE_VERSION,
						source,
						changes: [],
						correspondence: [],
						diagnostics: []
					}
				};
			}
		};
		const admitted = await adapter.admit(fixture.project, []);
		if (admitted.kind !== 'admitted') throw new Error(`the fixture was not admitted: ${admitted.code}`);
		if (admitted.kind !== 'admitted') return;
		const prepared = planner.prepare({
			snapshot: { acceptedRevision: BOOT_REVISION, sourceContentId: admitted.sourceContentId, sourceKind: UNIT_SOURCE_KIND, sourceVersion: 1, domain: { identity: { acceptedRevision: BOOT_REVISION, sourceContentId: admitted.sourceContentId }, source: admitted.source } },
			intent: sceneIntent(BOOT_REVISION, admitted.source, 'op-unstamped', true),
			capturedInputs: [],
			allocatedIds: []
		});
		expect(prepared.kind).toBe('prepared');
		if (prepared.kind !== 'prepared') return;
		const reAdmitted = await adapter.admit(prepared.candidate.source, []);
		if (reAdmitted.kind !== 'admitted') throw new Error(`the edited candidate was not admitted: ${reAdmitted.code}`);

		const shared = adapter.shareUnchanged?.(reAdmitted.source, admitted.source);
		expect(shared).toBeDefined();
		// The Scene unit's data really did change, so its revision changed and it is
		// not shared; the untouched units still are.
		expect(shared!.units.scene.header.contentRevision).not.toBe(admitted.source.units.scene.header.contentRevision);
		expect(shared!.units.scene).not.toBe(admitted.source.units.scene);
		expect(shared!.units.layout).toBe(admitted.source.units.layout);
		// And the shared value is byte-identical to the unshared one.
		expect(serializeProjectEnvelope(shared!)).toBe(serializeProjectEnvelope(reAdmitted.source));
	});
});
