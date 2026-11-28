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
	planDuplicateOne,
	planMoveHorizontal,
	planPlaceOnFloor,
	planSetLift,
	rigidPivot,
	rigidTurnPosition,
	rigidYawAdd,
	rotationForwardVector,
	sceneSupportGenerationId,
	type SceneGroupMemberContact,
} from '@portfolio/project-model/scene-planning';
import type { SceneLightEntity } from '@portfolio/project-model/scene';
import type { LayoutRegion } from '@portfolio/layout-core/wall';
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
				'place-group-copy',
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
		// Captured in reverse: each copy names its source member, so the mapping is
		// by captured id and never by array position.
		const copies = sourceCluster.memberIds
			.map((sourceEntityId) => ({ sourceEntityId, entityId: `${sourceEntityId}-copy` }))
			.reverse();
		const result = prepare({
			kind: 'scene-group-duplicate',
			snapshot,
			clusterId: fixture.stillLifeClusterId,
			payload: {
				clusterId: fixture.stillLifeClusterId,
				copies,
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

		// A copy list that names an entity outside the group refuses rather than
		// silently copying a different member.
		const unknownSource = prepare({
			kind: 'scene-group-duplicate',
			snapshot,
			clusterId: fixture.stillLifeClusterId,
			payload: {
				clusterId: fixture.stillLifeClusterId,
				copies: [
					...copies.slice(1),
					{ sourceEntityId: 'neighbour', entityId: 'neighbour-copy' },
				],
				newClusterId: 'cluster-still-life-copy-2',
				contacts: contactsFor(fixture, sourceCluster.memberIds),
			},
		});
		expect(unknownSource.kind).toBe('rejected');
		if (unknownSource.kind === 'rejected') expect(unknownSource.code).toBe('invalid-value');
	});

	it('refuses a duplicate whose copy would leave its support', async () => {
		const { snapshot, fixture } = await snapshotOf();
		const result = prepare({
			kind: 'scene-group-duplicate',
			snapshot,
			clusterId: fixture.orderClusterId,
			payload: {
				clusterId: fixture.orderClusterId,
				copies: fixture.orderMemberIds.map((sourceEntityId) => ({
					sourceEntityId,
					entityId: `${sourceEntityId}-copy`,
				})),
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

	it('admits a vertical-plane group, refuses its transform by name, and still renames, ungroups and erases it', async () => {
		const base = groupedSceneFixture();
		const plane: CameraFreeSceneDocument['entities'][number] = {
			kind: 'primitive',
			primitive: 'plane',
			id: 'plane-member',
			name: 'Vertical plane',
			dimensions: { width: 1, height: 1 },
			materialId: 'plaster-warm',
			castShadow: false,
			receiveShadow: true,
			position: [3, 1.5, 2],
			rotation: [Math.PI / 2, 0, 0],
			scale: 1,
		};
		const fixture = {
			...base,
			scene: {
				...base.scene,
				entities: [...base.scene.entities, plane],
				clusters: [
					...(base.scene.clusters ?? []),
					{ id: 'cluster-plane', name: 'Plane group', memberIds: ['plane-member', 'neighbour'] },
				],
			},
		};
		const { snapshot } = await snapshotOf(fixture);
		const transformed = prepare({
			kind: 'scene-group-transform',
			snapshot,
			clusterId: 'cluster-plane',
			payload: transformPayload(fixture, 'cluster-plane', { kind: 'move', deltaXZ: [0.1, 0] }, [
				'neighbour',
			]),
		});
		expect(transformed.kind).toBe('rejected');
		if (transformed.kind === 'rejected') {
			expect(transformed.code).toBe('unsupported-transform');
			expect(transformed.message).toContain('plane-member');
		}
		const duplicated = prepare({
			kind: 'scene-group-duplicate',
			snapshot,
			clusterId: 'cluster-plane',
			payload: {
				clusterId: 'cluster-plane',
				copies: [
					{ sourceEntityId: 'plane-member', entityId: 'plane-member-copy' },
					{ sourceEntityId: 'neighbour', entityId: 'neighbour-copy' },
				],
				newClusterId: 'cluster-plane-copy',
				contacts: contactsFor(fixture, ['neighbour']),
			},
		});
		expect(duplicated.kind).toBe('rejected');
		if (duplicated.kind === 'rejected') expect(duplicated.code).toBe('unsupported-transform');

		const renamed = prepare({
			kind: 'scene-group-rename',
			snapshot,
			clusterId: 'cluster-plane',
			payload: { clusterId: 'cluster-plane', name: 'Renamed' },
		});
		expect(renamed.kind).toBe('prepared');
		const ungrouped = prepare({
			kind: 'scene-group-ungroup',
			snapshot,
			clusterId: 'cluster-plane',
			payload: { clusterId: 'cluster-plane' },
		});
		expect(ungrouped.kind).toBe('prepared');
		const erased = prepare({
			kind: 'scene-group-erase',
			snapshot,
			clusterId: 'cluster-plane',
			payload: { clusterId: 'cluster-plane' },
		});
		expect(erased.kind).toBe('prepared');
	});

	it('keeps a pose under a mezzanine operable by the next Move and Duplicate', async () => {
		const base = groupedSceneFixture();
		const carried: CameraFreeSceneDocument['entities'][number] = {
			kind: 'primitive',
			primitive: 'box',
			id: 'under-mezzanine',
			name: 'Under mezzanine',
			dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true,
			position: [5.8, 1.2, 0.2],
			rotation: [0, 0, 0],
			scale: 1,
		};
		const companion: CameraFreeSceneDocument['entities'][number] = {
			...carried,
			id: 'under-mezzanine-companion',
			name: 'Companion',
			position: [5.4, 0.5, -0.4],
		};
		// A real floor under the mezzanine: the datum is only a fallback where no
		// region covers the point, so the reported overlap needs both.
		const groundUnderMezzanine: LayoutRegion = {
			id: 'region-ground-under-mezzanine',
			role: 'floor',
			footprint: {
				kind: 'polygon',
				points: [
					[5.2, 0],
					[7.2, 0],
					[7.2, 2],
					[5.2, 2],
				],
			},
			elevation: 0,
			thickness: 0.1,
			form: { kind: 'flat' },
			intendedGaps: [],
			name: 'Ground under mezzanine',
		};
		const fixture = {
			...base,
			layout: { ...base.layout, regions: [...base.layout.regions, groundUnderMezzanine] },
			scene: {
				...base.scene,
				entities: [...base.scene.entities, carried, companion],
				clusters: [
					...(base.scene.clusters ?? []),
					{ id: 'cluster-under', name: 'Under', memberIds: [carried.id, companion.id] },
				],
			},
			contacts: {
				...base.contacts,
				'under-mezzanine': -0.5,
				'under-mezzanine-companion': -0.5,
			},
		};
		const { snapshot } = await snapshotOf(fixture);
		const context = {
			layout: fixture.layout,
			sourceContentId: snapshot.sourceContentId,
			scene: snapshot.domain.source.units.scene.data,
		};

		// Base 0.7 m on the datum, with only the datum beneath it at the origin.
		const firstMove = planMoveHorizontal({
			context,
			entityId: 'under-mezzanine',
			worldXZ: [6.3, 0.7],
			frame: { origin: [0, 0, 0], yaw: 0 },
			contactMinY: -0.5,
		});
		expect(firstMove.kind).toBe('candidate');
		if (firstMove.kind !== 'candidate') return;
		const installed = firstMove.scene.entities.find((entity) => entity.id === 'under-mezzanine')!;
		expect(installed.position[1]).toBe(1.2);

		// The accepted pose is under the 0.9 m mezzanine over the datum floor. Its
		// base must classify as lifted above the datum, or a pose this ordinary Move
		// just installed could not be moved or copied again.
		const accepted = { ...context, scene: firstMove.scene };
		const secondMove = planMoveHorizontal({
			context: accepted,
			entityId: 'under-mezzanine',
			worldXZ: [4, 0],
			frame: { origin: [0, 0, 0], yaw: 0 },
			contactMinY: -0.5,
		});
		expect(secondMove.kind).toBe('candidate');
		const duplicate = planDuplicateOne({
			context: accepted,
			entityId: 'under-mezzanine',
			newEntityId: 'under-mezzanine-copy',
			contactMinY: -0.5,
		});
		expect(duplicate.kind).toBe('candidate');

		// The group planners share the same rule at the same accepted pose.
		const groupedSnapshot = await snapshotOf({ ...fixture, scene: accepted.scene });
		const groupMove = prepare({
			kind: 'scene-group-transform',
			snapshot: groupedSnapshot.snapshot,
			clusterId: 'cluster-under',
			payload: transformPayload(fixture, 'cluster-under', { kind: 'move', deltaXZ: [-1.5, -0.5] }, [
				'under-mezzanine',
				'under-mezzanine-companion',
			]),
		});
		expect(groupMove.kind).toBe('prepared');
		const groupDuplicate = prepare({
			kind: 'scene-group-duplicate',
			snapshot: groupedSnapshot.snapshot,
			clusterId: 'cluster-under',
			payload: {
				clusterId: 'cluster-under',
				copies: [
					{
						sourceEntityId: 'under-mezzanine-companion',
						entityId: 'under-mezzanine-companion-copy',
					},
					{ sourceEntityId: 'under-mezzanine', entityId: 'under-mezzanine-copy-2' },
				],
				newClusterId: 'cluster-under-copy',
				contacts: [
					{ entityId: 'under-mezzanine', contactMinY: -0.5 },
					{ entityId: 'under-mezzanine-companion', contactMinY: -0.5 },
				],
			},
		});
		expect(groupDuplicate.kind).toBe('prepared');
	});

	it('keeps a pose on a platform seam operable by the next Move and Duplicate', async () => {
		const base = groupedSceneFixture();
		const ground: LayoutRegion = {
			id: 'region-seam-ground',
			role: 'floor',
			footprint: {
				kind: 'polygon',
				points: [
					[4, 0],
					[8, 0],
					[8, 2],
					[4, 2],
				],
			},
			elevation: 0,
			thickness: 0.1,
			form: { kind: 'flat' },
			intendedGaps: [],
			name: 'Seam ground',
		};
		// Two platform tops 1.6e-6 apart meet at x = 6.3. Both are within the 1e-6
		// coplanar tolerance of the 0.7 m base, but only the upper one is the
		// highest support at or below it — the destination rule admits this pose.
		const leftTop: LayoutRegion = {
			...ground,
			id: 'region-seam-left',
			name: 'Seam left top',
			elevation: 0.6999992,
			footprint: {
				kind: 'polygon',
				points: [
					[5.8, 0],
					[6.3, 0],
					[6.3, 1.4],
					[5.8, 1.4],
				],
			},
		};
		const rightTop: LayoutRegion = {
			...ground,
			id: 'region-seam-right',
			name: 'Seam right top',
			elevation: 0.7000008,
			footprint: {
				kind: 'polygon',
				points: [
					[6.3, 0],
					[7.4, 0],
					[7.4, 1.4],
					[6.3, 1.4],
				],
			},
		};
		const carried: CameraFreeSceneDocument['entities'][number] = {
			kind: 'primitive',
			primitive: 'box',
			id: 'seam-box',
			name: 'Seam box',
			dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true,
			position: [5, 1.2, 0.5],
			rotation: [0, 0, 0],
			scale: 1,
		};
		const companion: CameraFreeSceneDocument['entities'][number] = {
			...carried,
			id: 'seam-companion',
			name: 'Seam companion',
			position: [4.6, 0.5, 0.4],
		};
		const fixture = {
			...base,
			layout: { ...base.layout, regions: [ground, leftTop, rightTop] },
			scene: {
				...base.scene,
				entities: [...base.scene.entities, carried, companion],
			},
			contacts: {
				...base.contacts,
				'seam-box': -0.5,
				'seam-companion': -0.5,
			},
		};
		const { snapshot } = await snapshotOf(fixture);
		const context = {
			layout: fixture.layout,
			sourceContentId: snapshot.sourceContentId,
			scene: snapshot.domain.source.units.scene.data,
		};

		// The origin sees only the 0 m ground, so this Move is lifted by 0.7 m. The
		// destination is the seam: the upper top is the one support at the highest
		// elevation within tolerance, so the destination rule accepts it.
		const firstMove = planMoveHorizontal({
			context,
			entityId: 'seam-box',
			worldXZ: [6.3, 0.5],
			frame: { origin: [0, 0, 0], yaw: 0 },
			contactMinY: -0.5,
		});
		expect(firstMove.kind).toBe('candidate');
		if (firstMove.kind !== 'candidate') return;
		expect(
			firstMove.scene.entities.find((entity) => entity.id === 'seam-box')!.position[1],
		).toBe(1.2);

		// From the accepted seam both platform tops are within tolerance of the
		// base, so the exact query alone is ambiguous. The upper top the destination
		// admitted is the support, so the pose must stay operable.
		const accepted = { ...context, scene: firstMove.scene };
		const secondMove = planMoveHorizontal({
			context: accepted,
			entityId: 'seam-box',
			worldXZ: [5.9, 0.5],
			frame: { origin: [0, 0, 0], yaw: 0 },
			contactMinY: -0.5,
		});
		expect(secondMove.kind).toBe('candidate');
		const duplicate = planDuplicateOne({
			context: accepted,
			entityId: 'seam-box',
			newEntityId: 'seam-box-copy',
			contactMinY: -0.5,
		});
		expect(duplicate.kind).toBe('candidate');

		const groupedScene = {
			...accepted.scene,
			clusters: [
				...(accepted.scene.clusters ?? []),
				{ id: 'cluster-seam', name: 'Seam', memberIds: [carried.id, companion.id] },
			],
		};
		const groupedSnapshot = await snapshotOf({ ...fixture, scene: groupedScene });
		const groupMove = prepare({
			kind: 'scene-group-transform',
			snapshot: groupedSnapshot.snapshot,
			clusterId: 'cluster-seam',
			payload: transformPayload(fixture, 'cluster-seam', { kind: 'move', deltaXZ: [-0.4, 0] }, [
				'seam-box',
				'seam-companion',
			]),
		});
		expect(groupMove.kind).toBe('prepared');
		const groupDuplicate = prepare({
			kind: 'scene-group-duplicate',
			snapshot: groupedSnapshot.snapshot,
			clusterId: 'cluster-seam',
			payload: {
				clusterId: 'cluster-seam',
				copies: [
					{ sourceEntityId: 'seam-box', entityId: 'seam-box-copy-2' },
					{ sourceEntityId: 'seam-companion', entityId: 'seam-companion-copy' },
				],
				newClusterId: 'cluster-seam-copy',
				contacts: [
					{ entityId: 'seam-box', contactMinY: -0.5 },
					{ entityId: 'seam-companion', contactMinY: -0.5 },
				],
			},
		});
		expect(groupDuplicate.kind).toBe('prepared');
	});

	it('keeps explicit reseating and a captured destination choice unchanged', async () => {
		const base = groupedSceneFixture();
		const ground: LayoutRegion = {
			id: 'region-reseat-ground',
			role: 'floor',
			footprint: {
				kind: 'polygon',
				points: [
					[5.2, 0],
					[7.2, 0],
					[7.2, 2],
					[5.2, 2],
				],
			},
			elevation: 0,
			thickness: 0.1,
			form: { kind: 'flat' },
			intendedGaps: [],
			name: 'Reseat ground',
		};
		const mezzanine: LayoutRegion = {
			...ground,
			id: 'region-reseat-mezzanine',
			name: 'Reseat mezzanine',
			elevation: 0.9,
			footprint: {
				kind: 'polygon',
				points: [
					[6, 0],
					[7, 0],
					[7, 1],
					[6, 1],
				],
			},
		};
		const platform: LayoutRegion = {
			...ground,
			id: 'region-reseat-platform',
			name: 'Reseat platform',
			elevation: 0.4,
			footprint: {
				kind: 'polygon',
				points: [
					[5.5, 0],
					[6.5, 0],
					[6.5, 1],
					[5.5, 1],
				],
			},
		};
		const box: CameraFreeSceneDocument['entities'][number] = {
			kind: 'primitive',
			primitive: 'box',
			id: 'reseat-box',
			name: 'Reseat box',
			dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true,
			position: [6.3, 1.2, 0.7],
			rotation: [0, 0, 0],
			scale: 1,
		};
		const fixture = {
			...base,
			layout: { ...base.layout, regions: [ground, mezzanine, platform] },
			scene: { ...base.scene, entities: [...base.scene.entities, box] },
			contacts: { ...base.contacts, 'reseat-box': -0.5 },
		};
		const { snapshot } = await snapshotOf(fixture);
		const context = {
			layout: fixture.layout,
			sourceContentId: snapshot.sourceContentId,
			scene: snapshot.domain.source.units.scene.data,
		};

		// Under the 0.9 m mezzanine the unconstrained origin query is ambiguous, so
		// Place on floor reseats on the destination instead of carrying a lift.
		const placed = planPlaceOnFloor({
			context,
			entityId: 'reseat-box',
			worldXZ: [4, 0],
			frame: { origin: [0, 0, 0], yaw: 0 },
			contactMinY: -0.5,
		});
		expect(placed.kind).toBe('candidate');
		if (placed.kind !== 'candidate') return;
		expect(
			placed.scene.entities.find((entity) => entity.id === 'reseat-box')!.position[1],
		).toBe(0.5);
		// `set-lift` keeps the same reading: an ambiguous origin is not a lift.
		const reseated = planSetLift({
			context,
			entityId: 'reseat-box',
			lift: 0,
			contactMinY: -0.5,
		});
		expect(reseated.kind).toBe('rejected');
		if (reseated.kind === 'rejected') expect(reseated.code).toBe('no-support');

		// A 0 m captured choice is valid at both endpoints even though the origin
		// also has the 0.4 m platform beneath it. The destination resolves the
		// choice; the origin must not veto it.
		const choice = {
			kind: 'elevation' as const,
			elevation: 0,
			generationId: sceneSupportGenerationId(snapshot.sourceContentId),
		};
		const moved = planMoveHorizontal({
			context,
			entityId: 'reseat-box',
			worldXZ: [4, 0.5],
			frame: { origin: [0, 0, 0], yaw: 0 },
			contactMinY: -0.5,
			choice,
		});
		expect(moved.kind).toBe('candidate');
		if (moved.kind !== 'candidate') return;
		expect(
			moved.scene.entities.find((entity) => entity.id === 'reseat-box')!.position[1],
		).toBe(1.2);
	});

	it('keeps a near-gimbal spot aimed within 1e-6 through a group Turn', async () => {
		const base = groupedSceneFixture();
		const yaw = 0.1;
		const spot: SceneLightEntity = {
			kind: 'light',
			light: 'spot',
			id: 'order-b',
			name: 'Near-gimbal spot',
			color: '#fff4e0',
			intensity: 3,
			range: 8,
			angle: 0.5,
			penumbra: 0.2,
			castShadow: false,
			position: [4.6, 2.5, 3.2],
			rotation: [0, Math.PI / 2 - 0.0002 - yaw, 0.9],
		};
		const fixture = {
			...base,
			scene: {
				...base.scene,
				entities: base.scene.entities.map((entity) =>
					entity.id === 'order-b' ? spot : entity,
				),
			},
		};
		const { snapshot } = await snapshotOf(fixture);
		const result = prepare({
			kind: 'scene-group-transform',
			snapshot,
			clusterId: fixture.orderClusterId,
			payload: transformPayload(fixture, fixture.orderClusterId, { kind: 'turn', yaw }, fixture.orderMemberIds),
		});
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const turned = result.candidate.source.units.scene.data.entities.find(
			(entity) => entity.id === 'order-b',
		)!;
		const before = rotationForwardVector(spot.rotation);
		const expected = [
			Math.cos(yaw) * before[0] + Math.sin(yaw) * before[2],
			before[1],
			-Math.sin(yaw) * before[0] + Math.cos(yaw) * before[2],
		] as const;
		const actual = rotationForwardVector(turned.rotation);
		const error = Math.hypot(
			actual[0] - expected[0],
			actual[1] - expected[1],
			actual[2] - expected[2],
		);
		expect(error).toBeLessThan(1e-9);
		// The plan's tolerance: forward vector and target point at 8 m.
		expect(error * 8).toBeLessThan(1e-6);
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
