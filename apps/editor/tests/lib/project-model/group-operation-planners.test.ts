/**
 * T2.G1a — the seven group planners as pure plans.
 *
 * The suite proves the candidate contract before F.4: one captured intent makes
 * one Scene candidate or one typed refusal, every member keeps its Y, rigid
 * relative poses survive Move and Turn, duplication copies members independently
 * and an erase removes exactly its cluster and members.
 */
import { describe, expect, it } from 'vitest';
import {
	checkSceneRecordScope,
	createScenePlanners,
	groupMemberEligible,
	rigidPivot,
	rigidTurnPosition,
	rigidYawAdd,
	type SceneGroupMemberContact,
} from '@portfolio/project-model/scene-planning';
import type { AcceptedSnapshot, AuthoringIntent, DomainPlanner } from '@portfolio/project-model/f4';
import type { SemanticReference } from '@portfolio/project-model/references';
import type { CameraFreeSceneDocument } from '@portfolio/project-model/units';
import { admitUnitProject, createUnitProject } from '../authoring/__fixtures__/unit-envelope-fixtures';
import { groupedSceneFixture, showcaseRigFixture } from '../../../../../packages/project-model/tests/__fixtures__/grouped-scene';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

const PROJECT_ID = 'project-groups';
const REVISION_ID = 'revision-1';

async function snapshotOf(fixture = groupedSceneFixture()) {
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'Group conformance',
		layout: fixture.layout,
		scene: fixture.scene,
	});
	const admitted = await admitUnitProject(project, {
		projectId: PROJECT_ID,
		revisionId: REVISION_ID,
	});
	if (admitted.kind !== 'admitted') {
		throw new Error(`the grouped fixture was not admitted: ${JSON.stringify(admitted.issues)}`);
	}
	return {
		fixture,
		project,
		admitted,
		snapshot: {
			acceptedRevision: admitted.snapshot.acceptedRevision,
			sourceContentId: admitted.snapshot.sourceContentId,
			sourceKind: admitted.snapshot.sourceKind,
			sourceVersion: admitted.snapshot.sourceVersion,
			domain: {
				identity: {
					acceptedRevision: admitted.snapshot.acceptedRevision,
					sourceContentId: admitted.snapshot.sourceContentId,
				},
				source: project,
			},
		} as AcceptedSnapshot<ProjectEnvelope>,
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

function intent(input: {
	readonly kind: string;
	readonly snapshot: AcceptedSnapshot<ProjectEnvelope>;
	readonly payload: unknown;
	readonly clusterId?: string;
	readonly operationId?: string;
}): AuthoringIntent {
	const contentId = input.snapshot.domain.source.units.scene.header.contentRevision;
	return {
		version: 1,
		kind: input.kind,
		operationId: input.operationId ?? `op-${input.kind}`,
		expectedRevision: input.snapshot.acceptedRevision,
		targets: input.clusterId === undefined ? [] : [clusterTarget(contentId, input.clusterId)],
		payload: input.payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds: [],
	};
}

function plannerFor(kind: string): DomainPlanner<ProjectEnvelope> {
	const planner = createScenePlanners({ definitions: () => [] }).find(
		(candidate) => candidate.kind === kind,
	);
	if (planner === undefined) throw new Error(`no planner for ${kind}`);
	return planner;
}

function prepare(input: {
	readonly kind: string;
	readonly snapshot: AcceptedSnapshot<ProjectEnvelope>;
	readonly payload: unknown;
	readonly clusterId?: string;
}) {
	const captured = intent(input);
	return plannerFor(input.kind).prepare({
		snapshot: input.snapshot,
		intent: captured,
		capturedInputs: [],
		allocatedIds: [],
	});
}

function contactsFor(
	fixture: ReturnType<typeof groupedSceneFixture>,
	ids: readonly string[],
): SceneGroupMemberContact[] {
	return ids.flatMap((entityId) =>
		fixture.contacts[entityId] === undefined
			? []
			: [{ entityId, contactMinY: fixture.contacts[entityId]! }],
	);
}

function entity(snapshot: AcceptedSnapshot<ProjectEnvelope>, id: string) {
	const found = snapshot.domain.source.units.scene.data.entities.find(
		(candidate) => candidate.id === id,
	);
	if (found === undefined) throw new Error(`missing entity ${id}`);
	return found;
}

function transformPayload(
	fixture: ReturnType<typeof groupedSceneFixture>,
	clusterId: string,
	motion: { readonly kind: 'move'; readonly deltaXZ: readonly [number, number] } | { readonly kind: 'turn'; readonly yaw: number },
	ids: readonly string[] = fixture.stillLifeMemberIds,
) {
	return {
		clusterId,
		motion,
		frame: { origin: [0, 0, 0], yaw: 0 },
		frameReference: { version: 1, kind: 'project-world' },
		contacts: contactsFor(fixture, ids),
	};
}

describe('group planners', () => {
	it('registers all seven group operations beside the existing Scene set', () => {
		expect(
			createScenePlanners({ definitions: () => [] })
				.map((planner) => planner.kind)
				.sort(),
		).toEqual(
			[
				'place-object',
				'place-form-copy',
				'create-form',
				'set-form-size',
				'set-form-profile',
				'move-horizontal',
				'set-yaw',
				'place-on-floor',
				'resize-on-floor',
				'duplicate-one',
				'delete-one',
				'set-lift',
				'set-name',
				'create-light',
				'update-light',
				'duplicate-light',
				'scene-group-create',
				'scene-group-ungroup',
				'scene-group-rename',
				'scene-group-transform',
				'scene-group-duplicate',
				'scene-group-erase',
				'create-light-rig',
			].sort(),
		);
	});

	it('creates one flat cluster with captured members and refuses a member already grouped', async () => {
		const { snapshot, fixture } = await snapshotOf();
		const before = structuredClone(snapshot.domain.source.units.scene.data);
		const created = prepare({
			kind: 'scene-group-create',
			snapshot,
			payload: {
				clusterId: 'cluster-loose',
				memberIds: ['neighbour', 'loose-prop'],
				name: '  Loose pair  ',
			},
		});
		expect(created.kind).toBe('prepared');
		if (created.kind !== 'prepared') return;
		expect(created.candidate.changes).toEqual([
			{ kind: 'scene-group-create', subjectIds: ['cluster-loose', 'neighbour', 'loose-prop'], fields: ['clusters'] },
		]);
		expect(created.candidate.correspondence).toEqual([
			{ relation: 'created', before: null, after: expect.objectContaining({ subject: { kind: 'cluster', id: 'cluster-loose' } }) },
			{ relation: 'preserved', before: expect.objectContaining({ subject: { kind: 'entity', id: 'neighbour' } }), after: expect.objectContaining({ subject: { kind: 'entity', id: 'neighbour' } }) },
			{ relation: 'preserved', before: expect.objectContaining({ subject: { kind: 'entity', id: 'loose-prop' } }), after: expect.objectContaining({ subject: { kind: 'entity', id: 'loose-prop' } }) },
		]);
		const after = created.candidate.source.units.scene.data;
		expect(after.clusters).toEqual([
			...before.clusters!,
			{ id: 'cluster-loose', name: 'Loose pair', memberIds: ['neighbour', 'loose-prop'] },
		]);
		expect(after.entities).toEqual(before.entities);

		for (const [payload, code] of [
			[{ clusterId: 'cluster-loose-2', memberIds: ['neighbour', 'still-life-model'], name: 'Nested' }, 'already-grouped'],
			[{ clusterId: 'cluster-loose-3', memberIds: ['neighbour'], name: 'One' }, 'invalid-value'],
			[{ clusterId: 'cluster-still-life', memberIds: ['loose-prop', 'neighbour'], name: 'Taken' }, 'invalid-value'],
			[{ clusterId: 'cluster-loose-4', memberIds: ['neighbour', 'missing'], name: 'Missing' }, 'missing-target']
		] as const) {
			const result = prepare({ kind: 'scene-group-create', snapshot, payload });
			expect(result.kind, JSON.stringify(payload)).toBe('rejected');
			if (result.kind === 'rejected') expect(result.code).toBe(code);
		}
		expect(fixture.stillLifeClusterId).toBe('cluster-still-life');
	});

	it('declares the exact created cluster membership and refuses an undeclared change', () => {
		const member = (id: string): CameraFreeSceneDocument['entities'][number] => ({
			kind: 'primitive',
			primitive: 'box',
			id,
			name: id,
			dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true,
			position: [1, 0.5, 0],
			rotation: [0, 0, 0],
			scale: 1,
		});
		const base: CameraFreeSceneDocument = {
			formatVersion: 13,
			textures: [],
			materials: [],
			entities: [member('a'), member('b')],
		};
		const added: CameraFreeSceneDocument = {
			...base,
			clusters: [{ id: 'cluster-a', name: 'A', memberIds: ['a', 'b'] }],
		};
		const scope = {
			operationKind: 'scene-group-create' as const,
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [],
			removedEntityIds: [],
			clusters: {
				created: [{ id: 'cluster-a', memberIds: ['a', 'b'] }],
				removed: [],
				renamed: [],
				pruned: [],
			},
		};
		expect(checkSceneRecordScope(base, added, scope)).toEqual([]);

		const extraMember: CameraFreeSceneDocument = {
			...base,
			clusters: [{ id: 'cluster-a', name: 'A', memberIds: ['a', 'b', 'c'] }],
		};
		expect(checkSceneRecordScope(base, extraMember, scope).length).toBeGreaterThan(0);

		const entityChanged: CameraFreeSceneDocument = {
			...base,
			entities: [member('a'), { ...member('b'), position: [2, 0.5, 0] }],
		};
		expect(checkSceneRecordScope(base, entityChanged, scope).length).toBeGreaterThan(0);
	});

	it('moves every member rigidly, preserves Y and relative poses, and keeps the cluster byte-identical', async () => {
		const { snapshot, fixture } = await snapshotOf();
		const before = snapshot.domain.source.units.scene.data;
		const result = prepare({
			kind: 'scene-group-transform',
			snapshot,
			clusterId: fixture.stillLifeClusterId,
			payload: transformPayload(fixture, fixture.stillLifeClusterId, {
				kind: 'move',
				deltaXZ: [0.5, 0],
			}),
		});
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const after = result.candidate.source.units.scene.data;
		for (const id of fixture.stillLifeMemberIds) {
			const previous = entity(snapshot, id);
			const next = after.entities.find((candidate) => candidate.id === id)!;
			expect(next.position[0], id).toBeCloseTo(previous.position[0] + 0.5, 12);
			expect(next.position[1], id).toBe(previous.position[1]);
			expect(next.position[2], id).toBeCloseTo(previous.position[2], 12);
			expect(next.rotation, id).toEqual(previous.rotation);
		}
		expect(after.clusters).toEqual(before.clusters);
		expect(after.entities.filter((candidate) => candidate.id === 'neighbour')).toEqual(
			before.entities.filter((candidate) => candidate.id === 'neighbour'),
		);
		expect(result.candidate.changes[0]).toMatchObject({
			kind: 'scene-group-transform',
			fields: ['entities'],
		});
	});

	it('turns a group about its captured pivot, yawing upright floor members additively', async () => {
		const { snapshot, fixture } = await snapshotOf();
		const ids = fixture.orderMemberIds;
		const before = ids.map((id) => entity(snapshot, id));
		const pivot = rigidPivot(before.map((candidate) => candidate.position))!;
		const result = prepare({
			kind: 'scene-group-transform',
			snapshot,
			clusterId: fixture.orderClusterId,
			payload: transformPayload(fixture, fixture.orderClusterId, { kind: 'turn', yaw: 0.1 }, ids),
		});
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const after = result.candidate.source.units.scene.data;
		for (const previous of before) {
			const next = after.entities.find((candidate) => candidate.id === previous.id)!;
			const expected = rigidTurnPosition(previous.position, pivot, 0.1);
			expect(next.position[0]).toBeCloseTo(expected[0], 12);
			expect(next.position[1]).toBe(previous.position[1]);
			expect(next.position[2]).toBeCloseTo(expected[2], 12);
			const expectedRotation = rigidYawAdd(previous.rotation, 0.1);
			for (const axis of [0, 1, 2] as const) {
				expect(next.rotation[axis], `${previous.id}.rotation[${axis}]`).toBeCloseTo(
					expectedRotation[axis],
					12,
				);
			}
		}
	});

	it('refuses the whole turn when one resting member would leave the platform, naming it and the destination', async () => {
		const { snapshot, fixture } = await snapshotOf();
		const result = prepare({
			kind: 'scene-group-transform',
			snapshot,
			clusterId: fixture.stillLifeClusterId,
			payload: transformPayload(fixture, fixture.stillLifeClusterId, { kind: 'turn', yaw: Math.PI / 2 }),
		});
		expect(result.kind).toBe('rejected');
		if (result.kind !== 'rejected') return;
		expect(result.code).toBe('no-support');
		expect(result.message).toContain('still-life-plinth');
		expect(result.diagnostics.map((diagnostic) => diagnostic.message).join('\n')).toContain(
			'destination:',
		);
	});

	it('duplicates members independently, preserving material and relative pose, and appends one cluster', async () => {
		const { snapshot, fixture } = await snapshotOf();
		const before = snapshot.domain.source.units.scene.data;
		const sourceCluster = before.clusters!.find(
			(cluster) => cluster.id === fixture.stillLifeClusterId,
		)!;
		const copiedIds = sourceCluster.memberIds.map((id) => `${id}-copy`);
		const result = prepare({
			kind: 'scene-group-duplicate',
			snapshot,
			clusterId: fixture.stillLifeClusterId,
			payload: {
				clusterId: fixture.stillLifeClusterId,
				entityIds: copiedIds,
				newClusterId: 'cluster-still-life-copy',
				contacts: contactsFor(fixture, sourceCluster.memberIds),
			},
		});
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const after = result.candidate.source.units.scene.data;
		expect(after.clusters).toEqual([
			...before.clusters!,
			{
				id: 'cluster-still-life-copy',
				name: 'Still life',
				memberIds: copiedIds,
			},
		]);
		for (const [index, id] of sourceCluster.memberIds.entries()) {
			const source = before.entities.find((candidate) => candidate.id === id)!;
			const copy = after.entities.find((candidate) => candidate.id === copiedIds[index])!;
			expect(copy.kind).toBe(source.kind);
			expect(copy.position[0]).toBeCloseTo(source.position[0] + 0.5, 12);
			expect(copy.position[1]).toBe(source.position[1]);
			expect(copy.position[2]).toBeCloseTo(source.position[2] + 0.5, 12);
			expect(copy.rotation).toEqual(source.rotation);
			if ('materialId' in source && 'materialId' in copy) {
				expect(copy.materialId).toBe(source.materialId);
			}
		}
		// The source records are untouched: duplication never re-groups them.
		for (const id of sourceCluster.memberIds) {
			expect(after.entities.find((candidate) => candidate.id === id)).toEqual(
				before.entities.find((candidate) => candidate.id === id),
			);
		}
		expect(result.candidate.correspondence.filter((entry) => entry.relation === 'created')).toHaveLength(
			sourceCluster.memberIds.length + 1,
		);
	});

	it('refuses a duplicate whose copy would leave its support', async () => {
		const { snapshot, fixture } = await snapshotOf();
		const result = prepare({
			kind: 'scene-group-duplicate',
			snapshot,
			clusterId: fixture.orderClusterId,
			payload: {
				clusterId: fixture.orderClusterId,
				entityIds: ['order-a-copy', 'order-b-copy'],
				newClusterId: 'cluster-order-copy',
				contacts: contactsFor(fixture, fixture.orderMemberIds),
			},
		});
		expect(result.kind).toBe('rejected');
		if (result.kind === 'rejected') {
			expect(result.code).toBe('no-support');
			expect(result.message).toMatch(/order-a|order-b/);
		}
	});

	it('erases exactly the cluster and its members', async () => {
		const { snapshot, fixture } = await snapshotOf();
		const result = prepare({
			kind: 'scene-group-erase',
			snapshot,
			clusterId: fixture.orderClusterId,
			payload: { clusterId: fixture.orderClusterId },
		});
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const after = result.candidate.source.units.scene.data;
		expect(after.entities.map((candidate) => candidate.id)).not.toContain('order-a');
		expect(after.entities.map((candidate) => candidate.id)).not.toContain('order-b');
		expect(after.clusters!.map((cluster) => cluster.id)).not.toContain(fixture.orderClusterId);
		expect(after.entities.length).toBe(
			snapshot.domain.source.units.scene.data.entities.length - fixture.orderMemberIds.length,
		);
		expect(result.candidate.correspondence).toEqual([
			{ relation: 'retired', before: expect.objectContaining({ subject: { kind: 'cluster', id: fixture.orderClusterId } }), after: null },
			{ relation: 'retired', before: expect.objectContaining({ subject: { kind: 'entity', id: 'order-a' } }), after: null },
			{ relation: 'retired', before: expect.objectContaining({ subject: { kind: 'entity', id: 'order-b' } }), after: null },
		]);
	});

	it('creates a three-light rig atomically and refuses one invalid light without writing', async () => {
		const rig = showcaseRigFixture();
		const { snapshot } = await snapshotOf({
			...groupedSceneFixture(),
			layout: rig.layout,
			scene: rig.scene,
		});
		const lights = rig.scene.entities
			.filter((candidate) => candidate.kind === 'light')
			.map((light) => ({
				entityId: `${light.id}-new`,
				light: light.light,
				name: light.name,
				color: light.color,
				intensity: light.intensity,
				castShadow: light.castShadow,
				position: light.position,
				rotation: light.rotation,
				...(light.range === undefined ? {} : { range: light.range }),
				...(light.light === 'spot' ? { angle: light.angle, penumbra: light.penumbra } : {}),
			}));
		const result = prepare({
			kind: 'create-light-rig',
			snapshot,
			payload: { clusterId: 'cluster-showcase-new', name: 'Showcase copy', lights },
		});
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const after = result.candidate.source.units.scene.data;
		expect(after.clusters).toContainEqual({
			id: 'cluster-showcase-new',
			name: 'Showcase copy',
			memberIds: lights.map((light) => light.entityId),
		});
		expect(after.entities.filter((candidate) => candidate.id.endsWith('-new'))).toHaveLength(3);

		const refused = prepare({
			kind: 'create-light-rig',
			snapshot,
			payload: {
				clusterId: 'cluster-showcase-bad',
				name: 'Bad rig',
				lights: lights.map((light, index) =>
					index === 1 ? { ...light, color: 'not-a-colour' } : light,
				),
			},
		});
		expect(refused.kind).toBe('rejected');
	});

	it('exposes the same eligibility predicate the group planners enforce', async () => {
		const { snapshot } = await snapshotOf();
		for (const id of ['still-life-plinth', 'still-life-model', 'still-life-lifted']) {
			expect(groupMemberEligible(entity(snapshot, id)), id).toBe(true);
		}
		expect(groupMemberEligible(entity(snapshot, 'still-life-artwork'))).toBe(true);
		expect(groupMemberEligible(entity(snapshot, 'still-life-picture'))).toBe(true);
	});
});
