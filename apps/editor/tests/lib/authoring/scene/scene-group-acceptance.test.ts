/**
 * T2.G1a — group operations through the landed F.4 coordinator.
 *
 * One accepted group edit installs once, Undo restores the exact prior bytes,
 * Redo restores the captured ids without planning again, and an erase unlinks
 * the Experience presentation in the same candidate.
 */
import { describe, expect, it } from 'vitest';
import { createScenePlanners } from '@portfolio/project-model/scene-planning';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SemanticReference } from '@portfolio/project-model/references';
import {
	EXPERIENCE_UNIT_FORMAT_VERSION,
	prepareUnitRuntime,
	serializeProjectEnvelope,
	type ExperienceUnitPayload,
	type ProjectEnvelope,
} from '@portfolio/project-model/units';
import type { AcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import { admitUnitProject, createUnitCoordinator, createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { groupedSceneFixture } from '../../../../../../packages/project-model/tests/__fixtures__/grouped-scene';

const PROJECT_ID = 'project-group-acceptance';
const REVISION = { projectId: PROJECT_ID, revisionId: 'revision-1' };

function linkedExperience(envelope: ProjectEnvelope): ExperienceUnitPayload {
	const contentRevision = envelope.units.scene.header.contentRevision;
	return {
		formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
		experiences: [
			{
				id: 'experience-1',
				label: 'Tour',
				entryGuideId: null,
				welcome: null,
				presentations: [
					{
						id: 'presentation-1',
						label: null,
						views: [],
						subject: {
							version: 1,
							domain: 'scene',
							revision: { kind: 'exact', contentRevision },
							subject: { kind: 'entity', id: 'still-life-model' },
							instancePath: [],
							location: { kind: 'project-root' },
							componentId: null,
							capabilityId: null,
						},
						text: null,
						explorable: true,
					},
				],
				stops: [],
				guides: [],
				detours: [],
			},
		],
	};
}

async function boot() {
	const fixture = groupedSceneFixture();
	let envelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'Group acceptance',
		acceptedRevision: REVISION,
		layout: fixture.layout,
		scene: fixture.scene,
	});
	envelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'Group acceptance',
		acceptedRevision: REVISION,
		layout: fixture.layout,
		scene: fixture.scene,
		experience: linkedExperience(envelope),
	});
	const admitted = await admitUnitProject(envelope, REVISION);
	if (admitted.kind !== 'admitted') {
		throw new Error(`fixture not admitted: ${JSON.stringify(admitted.issues)}`);
	}
	const coordinator = await createUnitCoordinator({
		sessionEpoch: 'session-groups',
		baseline: {
			revision: REVISION,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId,
		},
		planners: createScenePlanners({ definitions: () => [] }),
		mintRevisionId: (ordinal: number) => `revision-${ordinal + 1}`,
	});
	return { coordinator, fixture, admitted };
}

function now(coordinator: AcceptanceCoordinator<ProjectEnvelope>) {
	const state = coordinator.current();
	return {
		intentRevision: state.revision,
		contentId: state.source.units.scene.header.contentRevision,
	};
}

function clusterTarget(contentId: string, clusterId: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: contentId },
		subject: { kind: 'cluster', id: clusterId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}

function groupIntent(input: {
	readonly kind: string;
	readonly operationId: string;
	readonly state: ReturnType<typeof now>;
	readonly payload: unknown;
	readonly clusterId?: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: input.kind,
		operationId: input.operationId,
		expectedRevision: input.state.intentRevision,
		targets:
			input.clusterId === undefined
				? []
				: [clusterTarget(input.state.contentId, input.clusterId)],
		payload: input.payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds: [],
	};
}

function contacts(fixture: ReturnType<typeof groupedSceneFixture>, ids: readonly string[]) {
	return ids.flatMap((entityId) =>
		fixture.contacts[entityId] === undefined
			? []
			: [{ entityId, contactMinY: fixture.contacts[entityId]! }],
	);
}

describe('group acceptance', () => {
	it('installs create, transform, duplicate and erase once each, undoes exactly and redoes captured identities', async () => {
		const { coordinator, fixture, admitted } = await boot();
		const bootBytes = admitted.canonicalJson;
		const states: string[] = [];
		const created = await coordinator.accept(
			groupIntent({
				kind: 'scene-group-create',
				operationId: 'op-group-create',
				state: now(coordinator),
				payload: {
					clusterId: 'cluster-loose',
					memberIds: ['neighbour', 'loose-prop'],
					name: 'Loose pair',
				},
			}),
		);
		expect(created.kind).toBe('accepted');
		states.push(coordinator.current().canonicalJson);
		const installedAfterCreate = coordinator.installs();

		const moved = await coordinator.accept(
			groupIntent({
				kind: 'scene-group-transform',
				operationId: 'op-group-move',
				state: now(coordinator),
				clusterId: fixture.stillLifeClusterId,
				payload: {
					clusterId: fixture.stillLifeClusterId,
					motion: { kind: 'move', deltaXZ: [0.5, 0] },
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' },
					contacts: contacts(fixture, fixture.stillLifeMemberIds),
				},
			}),
		);
		expect(moved.kind).toBe('accepted');
		states.push(coordinator.current().canonicalJson);

		const copied = await coordinator.accept(
			groupIntent({
				kind: 'scene-group-duplicate',
				operationId: 'op-group-duplicate',
				state: now(coordinator),
				clusterId: fixture.stillLifeClusterId,
				payload: {
					clusterId: fixture.stillLifeClusterId,
					entityIds: fixture.stillLifeMemberIds.map((id) => `${id}-copy`),
					newClusterId: 'cluster-still-life-copy',
					contacts: contacts(fixture, fixture.stillLifeMemberIds),
				},
			}),
		);
		expect(copied.kind).toBe('accepted');
		states.push(coordinator.current().canonicalJson);

		const erased = await coordinator.accept(
			groupIntent({
				kind: 'scene-group-erase',
				operationId: 'op-group-erase',
				state: now(coordinator),
				clusterId: fixture.stillLifeClusterId,
				payload: { clusterId: fixture.stillLifeClusterId },
			}),
		);
		expect(erased.kind).toBe('accepted');
		const afterErase = coordinator.current();
		expect(afterErase.source.units.scene.data.entities.map((entity) => entity.id)).not.toContain(
			'still-life-model',
		);
		const presentation =
			afterErase.source.units.experience.data.experiences[0]!.presentations[0]!;
		expect(presentation.subject).toBeNull();
		expect(presentation.label).toBe('Still life model');
		expect(coordinator.installs()).toBe(installedAfterCreate + 3);
		states.push(afterErase.canonicalJson);

		// Undo walks back through erase, duplicate, move and create to the exact
		// admitted bytes; Redo restores the same captured identities.
		for (let index = states.length - 1; index >= 0; index -= 1) {
			const undo = await coordinator.undo();
			expect(undo.kind).toBe('restored');
			expect(coordinator.current().canonicalJson).toBe(index === 0 ? bootBytes : states[index - 1]);
		}
		expect(await coordinator.undo()).toMatchObject({ kind: 'unavailable', direction: 'undo' });
		for (const state of states) {
			const redo = await coordinator.redo();
			expect(redo.kind).toBe('restored');
			expect(coordinator.current().canonicalJson).toBe(state);
		}
		expect(coordinator.current().source.units.scene.data.entities.map((entity) => entity.id)).toContain(
			'still-life-model-copy',
		);
	});

	it('renames and ungroups without touching a member, and preserves visitor-visible entity identity', async () => {
		const { coordinator, fixture } = await boot();
		const before = coordinator.current();
		const renamed = await coordinator.accept(
			groupIntent({
				kind: 'scene-group-rename',
				operationId: 'op-group-rename',
				state: now(coordinator),
				clusterId: fixture.orderClusterId,
				payload: { clusterId: fixture.orderClusterId, name: 'Ordered pair' },
			}),
		);
		expect(renamed.kind).toBe('accepted');
		expect(
			coordinator.current().source.units.scene.data.clusters!.find(
				(cluster) => cluster.id === fixture.orderClusterId,
			)!.name,
		).toBe('Ordered pair');
		const ungrouped = await coordinator.accept(
			groupIntent({
				kind: 'scene-group-ungroup',
				operationId: 'op-group-ungroup',
				state: now(coordinator),
				clusterId: fixture.orderClusterId,
				payload: { clusterId: fixture.orderClusterId },
			}),
		);
		expect(ungrouped.kind).toBe('accepted');
		const after = coordinator.current();
		expect(after.source.units.scene.data.clusters!.map((cluster) => cluster.id)).not.toContain(
			fixture.orderClusterId,
		);
		expect(after.source.units.scene.data.entities).toEqual(before.source.units.scene.data.entities);
		const runtime = prepareUnitRuntime(after.source);
		if (runtime.kind !== 'ready') throw new Error(`runtime preparation refused: ${runtime.kind}`);
		expect(runtime.runtimeScene.entities.map((entity) => entity.id)).toEqual(
			before.source.units.scene.data.entities.map((entity) => entity.id),
		);
		expect(serializeProjectEnvelope(after.source)).toBe(after.canonicalJson);
		expect((await coordinator.undo()).kind).toBe('restored');
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(before.canonicalJson);
	});
});
