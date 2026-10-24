/**
 * T2.P01.S02 — Scene planners against the landed F.4 coordinator.
 *
 * This suite owns the **acceptance contract** the slice must not reimplement:
 * one accepted edit installs once with one undo result, Undo is chronological
 * across domains through one stack, Redo restores the captured identity without
 * planning again, and every refusal/no-op writes nothing. The pure candidate
 * behavior lives in `tests/lib/project-model/scene-operation-planners.test.ts`;
 * this file proves those candidates survive real admission and history.
 *
 * The Layout steps use T1.P01.S03's conformance Layout planner (test-only) so
 * the L1→S1→L2 order is real acceptance, not a simulated stack. The
 * mutation-control planner at the end proves the T2 record-scope guard refuses a
 * candidate the current-source adapter would otherwise admit.
 */
import { describe, expect, it } from 'vitest';
import {
	createScenePlanners,
	checkSceneRecordScope,
	finalizeSceneCandidate,
	type NormalizedPlacementDefinition
} from '@portfolio/project-model/scene-planning';
import {
	creatorModelDefinition,
	creatorModelResourceEntry,
	creatorModelResourcePayload
} from '@portfolio/project-model/scene-planning';
import {
	type AuthoringIntent,
	type DomainPlanner,
	type SceneDocument,
	type SceneEntity,
	type ScenePrimitiveEntity,
	type SemanticReference,
	type Vec3
} from '@portfolio/project-model';
import {
	replaceUnitData,
	validateProjectEnvelope,
	type CameraFreeSceneDocument,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import {
	createEmptyWallFirstLayoutDocument,
	nextLayoutPresetObjectId,
	planCommitLayoutObjectPreset,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { nativePlacementDefinition } from '$lib/authoring/scene/object-definition-policy';
import type { AcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	PROOF_LAYOUT_TRANSFORM_KIND,
	createProofLayoutPlanner,
	layoutObjectReference,
	proofIntent
} from './__fixtures__/f4-current-source-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import {
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	admitUnitContent,
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject
} from './__fixtures__/unit-envelope-fixtures';

const BOOT_REVISION = { projectId: 'project-scene-operations', revisionId: 'revision-1' };
const ELEVATION = 2.5;

function box(id: string, position: Vec3, scale = 1): ScenePrimitiveEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: id,
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0],
		scale
	};
}

function sceneWith(
	entities: readonly SceneEntity[],
	clusters: SceneDocument['clusters'] = undefined
): SceneDocument {
	return {
		formatVersion: 1,
		textures: [],
		materials: [],
		entities: [...entities],
		...(clusters === undefined ? {} : { clusters }),
		navigationNodes: [
			{
				id: 'tour-a',
				label: 'Tour A',
				position: [1, 1.65, 1],
				cameraTarget: [1, 1.25, -2],
				fov: 54,
				connectedNodeIds: ['tour-b'],
			},
			{
				id: 'tour-b',
				label: 'Tour B',
				position: [4, 1.65, 3],
				cameraTarget: [4, 1.25, 0],
				fov: 54,
				connectedNodeIds: ['tour-a'],
			}
		],
		connections: [
			{
				id: 'tour-a-b',
				fromNodeId: 'tour-a',
				toNodeId: 'tour-b',
				clearance: 0.35,
				positionPath: { kind: 'auto-bezier', anchors: [] }
			}
		]
	};
}

function enclosedLayout(elevation = 0): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline: { ...base, floor: { ...base.floor, elevation } },
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (planned.kind !== 'success') throw new Error('the conformance enclosure was refused');
	return planned.document;
}

type LegacyConformanceProject = {
	readonly id: string;
	readonly name: string;
	readonly layout: LayoutDocumentWallFirst;
	readonly scene: SceneDocument;
};

/** A supported project plus one real Layout object for the mixed-domain history. */
function conformanceProject(elevation = ELEVATION): {
	readonly project: LegacyConformanceProject;
	readonly layoutObjectId: string;
} {
	const objectDocument = enclosedLayout(elevation);
	const objectCapture = freshCapture();
	const objectPlan = planCommitLayoutObjectPreset(
		objectDocument,
		'plinth',
		[0, 0],
		0,
		nextLayoutPresetObjectId(objectDocument, objectCapture),
		objectDocument.floor.id
	);
	if (objectPlan.kind !== 'success' || objectPlan.createdObjectId === undefined) {
		throw new Error('the conformance Layout object was refused');
	}
	const entity = box('entity-a', [3, elevation + 0.5, 2]);
	return {
		project: {
			id: BOOT_REVISION.projectId,
			name: 'Scene operations conformance',
			layout: objectPlan.document,
			scene: sceneWith(
				[entity, box('entity-b', [1, elevation + 0.5, 1]), box('entity-c', [2, elevation + 0.5, 1])],
				[{ id: 'cluster-1', name: 'Group', memberIds: ['entity-b', 'entity-c'] }]
			)
		},
		layoutObjectId: objectPlan.createdObjectId
	};
}

function entityTarget(contentId: string, entityId: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: contentId },
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function sceneIntent(input: {
	readonly kind: string;
	readonly operationId: string;
	readonly intentRevision: { projectId: string; revisionId: string };
	readonly contentId: string;
	readonly entityId: string;
	readonly payload: unknown;
	readonly allocatedId?: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: input.kind,
		operationId: input.operationId,
		expectedRevision: input.intentRevision,
		targets: [entityTarget(input.contentId, input.entityId)],
		payload: input.payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds:
			input.allocatedId === undefined ? [] : [{ kind: 'scene-entity', id: input.allocatedId }]
	};
}

function placeIntent(input: {
	readonly intentRevision: { projectId: string; revisionId: string };
	readonly operationId: string;
	readonly entityId: string;
	readonly payload: Record<string, unknown>;
}): AuthoringIntent {
	return {
		version: 1,
		kind: 'place-object',
		operationId: input.operationId,
		expectedRevision: input.intentRevision,
		targets: [],
		payload: input.payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-entity', id: input.entityId }]
	};
}

function cameraBytes(camera: ProjectEnvelope['units']['camera']['data']): string {
	return JSON.stringify({ views: camera.views, connections: camera.connections });
}

async function boot(
	options: {
		readonly elevation?: number;
		/** Extra admitted definitions, e.g. an approved creator model's. */
		readonly definitions?: readonly NormalizedPlacementDefinition[];
	} = {}
) {
	const { project, layoutObjectId } = conformanceProject(options.elevation ?? ELEVATION);
	const envelope = await createUnitProject({
		id: project.id,
		name: project.name,
		acceptedRevision: BOOT_REVISION,
		layout: project.layout,
		scene: project.scene
	});
	const admitted = await admitUnitProject(envelope, BOOT_REVISION);
	if (admitted.kind !== 'admitted') {
		throw new Error(`the conformance project was not admitted: ${JSON.stringify(admitted.issues)}`);
	}
	const definition = await nativePlacementDefinition('box');
	const definitions = [definition, ...(options.definitions ?? [])];
	// A provider, as the adapter registers it: a definition captured after mount
	// (an approved creator model) is reachable without re-registering a planner.
	const scenePlanners = createScenePlanners({ definitions: () => definitions });
	const coordinator = await createUnitCoordinator({
		sessionEpoch: 'session-1',
		baseline: {
			revision: BOOT_REVISION,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId
		},
		planners: [...scenePlanners, createProofLayoutPlanner(layoutObjectId)],
		mintRevisionId: (ordinal: number) => `revision-${ordinal + 1}`
	});
	return { coordinator, fixture: { project: envelope, layoutObjectId }, definition, admitted, scenePlanners };
}

/** The current accepted revision/content, as a caller captures an intent. */
function now(coordinator: AcceptanceCoordinator<ProjectEnvelope>) {
	const state = coordinator.current();
	return {
		intentRevision: state.revision,
		contentId: state.source.units.scene.header.contentRevision,
		layoutContentId: state.source.units.layout.header.contentRevision
	};
}

describe('Scene operations through the F.4 coordinator', () => {
	it('registers the seven Scene planners beside the conformance Layout planner', async () => {
		const { coordinator } = await boot();
		expect(coordinator.planners().map((planner) => planner.kind).sort()).toEqual(
			[
				'place-object',
				'move-horizontal',
				'set-yaw',
				'place-on-floor',
				'resize-on-floor',
				'duplicate-one',
				'delete-one',
				PROOF_LAYOUT_TRANSFORM_KIND
			].sort()
		);
		expect(coordinator.sourceKind).toBe(UNIT_SOURCE_KIND);
		expect(coordinator.acceptedSnapshot().sourceVersion).toBe(UNIT_SOURCE_VERSION);
	});

	it('installs one placement once, undoes it exactly and redoes the captured identity without planning', async () => {
		const { admitted, scenePlanners, fixture } = await boot();
		const scenePlanner = scenePlanners.find((planner) => planner.kind === 'place-object')!;
		let preparationCount = 0;
		const counted: DomainPlanner<ProjectEnvelope> = {
			...scenePlanner,
			prepare(request) {
				preparationCount += 1;
				return scenePlanner.prepare(request);
			}
		};
		const wrappedCoordinator = await createUnitCoordinator({
			sessionEpoch: 'session-1',
			baseline: {
				revision: BOOT_REVISION,
				source: admitted.project,
				canonicalJson: admitted.canonicalJson,
				sourceContentId: admitted.sourceContentId
			},
			planners: [
				counted,
				...scenePlanners.filter((planner) => planner.kind !== 'place-object'),
				createProofLayoutPlanner(fixture.layoutObjectId)
			],
			mintRevisionId: (ordinal: number) => `revision-${ordinal + 1}`
		});
		const state = now(wrappedCoordinator);
		const placement = placeIntent({
			intentRevision: state.intentRevision,
			operationId: 'op-place',
			entityId: 'entity-new',
			payload: {
				definitionKey: 'native:box',
				metadataContentId: (await nativePlacementDefinition('box')).metadataContentId,
				worldXZ: [3, 2],
				yaw: 0.5,
				frame: { origin: [0, 0, 0], yaw: 0 },
				frameReference: { version: 1, kind: 'project-world' }
			}
		});
		const accepted = await wrappedCoordinator.accept(placement);
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		expect(accepted.correspondence).toEqual([
			{
				relation: 'created',
				before: null,
				after: expect.objectContaining({ subject: { kind: 'entity', id: 'entity-new' } })
			}
		]);
		expect(wrappedCoordinator.installs()).toBe(2);
		expect(wrappedCoordinator.history()).toEqual({ depth: 2, position: 1, limit: 100 });
		expect(preparationCount).toBe(1);

		const placed = wrappedCoordinator.current();
		expect(placed.source.units.scene.data.entities.at(-1)!.position).toEqual([3, ELEVATION + 0.5, 2]);
		expect(cameraBytes(placed.source.units.camera.data)).toBe(
			cameraBytes(admitted.envelope.units.camera.data)
		);

		const undo = await wrappedCoordinator.undo();
		expect(undo.kind).toBe('restored');
		expect(wrappedCoordinator.current().canonicalJson).toBe(admitted.canonicalJson);
		expect(wrappedCoordinator.current().sourceContentId).toBe(admitted.sourceContentId);
		expect(wrappedCoordinator.acceptedRevision()).not.toEqual(BOOT_REVISION);
		expect(preparationCount).toBe(1);

		const redo = await wrappedCoordinator.redo();
		expect(redo.kind).toBe('restored');
		const redone = wrappedCoordinator.current();
		expect(redone.canonicalJson).toBe(placed.canonicalJson);
		expect(redone.sourceContentId).toBe(placed.sourceContentId);
		// Redo restored the captured id and pose; no planner ran again.
		expect(redone.source.units.scene.data.entities.at(-1)!.id).toBe('entity-new');
		expect(redone.source.units.scene.data.entities.at(-1)!.position).toEqual([3, ELEVATION + 0.5, 2]);
		expect(preparationCount).toBe(1);
	});

	it('undoes chronologically across Layout and Scene through one stack (L1→S1→L2)', async () => {
		const { coordinator, fixture, admitted } = await boot();
		const bootState = coordinator.current();
		expect(bootState.canonicalJson).toBe(admitted.canonicalJson);

		const layoutIntent = (
			state: ReturnType<typeof now>,
			operationId: string,
			position: [number, number, number]
		) =>
			proofIntent({
				kind: PROOF_LAYOUT_TRANSFORM_KIND,
				operationId,
				expectedRevision: state.intentRevision.revisionId,
				projectId: state.intentRevision.projectId,
				contentRevision: state.layoutContentId,
				targets: [layoutObjectReference(state.layoutContentId, fixture.layoutObjectId)],
				payload: { objectId: fixture.layoutObjectId, position }
			});
		const moveIntent = (state: ReturnType<typeof now>, operationId: string, x: number, z: number) =>
			sceneIntent({
				kind: 'move-horizontal',
				operationId,
				intentRevision: state.intentRevision,
				contentId: state.contentId,
				entityId: 'entity-a',
				payload: {
					entityId: 'entity-a',
					worldXZ: [x, z],
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' },
					contactMinY: -0.5
				}
			});

		const l1 = await coordinator.accept(layoutIntent(now(coordinator), 'op-l1', [2, 0, 0]));
		expect(l1.kind).toBe('accepted');
		const afterL1 = coordinator.current();
		const s1 = await coordinator.accept(moveIntent(now(coordinator), 'op-s1', 4, 3));
		expect(s1.kind).toBe('accepted');
		const afterS1 = coordinator.current();
		const l2 = await coordinator.accept(layoutIntent(now(coordinator), 'op-l2', [5, 0, 0]));
		expect(l2.kind).toBe('accepted');
		const afterL2 = coordinator.current();
		expect(coordinator.history()).toEqual({ depth: 4, position: 3, limit: 100 });

		const undo1 = await coordinator.undo();
		expect(undo1.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterS1.canonicalJson);
		const undo2 = await coordinator.undo();
		expect(undo2.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterL1.canonicalJson);
		const undo3 = await coordinator.undo();
		expect(undo3.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(bootState.canonicalJson);
		if (undo3.kind !== 'restored') return;
		expect(undo3.restoredContentId).toBe(bootState.sourceContentId);
		expect(coordinator.acceptedRevision()).not.toEqual(bootState.revision);
		expect(await coordinator.undo()).toEqual({
			kind: 'unavailable',
			direction: 'undo',
			revision: coordinator.current().revision
		});

		// Redo walks forward through the same order, restoring each exact state.
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterL1.canonicalJson);
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterS1.canonicalJson);
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterL2.canonicalJson);
	});

	it('writes nothing for a no-op, a refused operation or a stale request', async () => {
		const { coordinator } = await boot();
		const before = coordinator.current();
		const historyBefore = coordinator.history();
		const installsBefore = coordinator.installs();

		const state = now(coordinator);
		const noOp = await coordinator.accept(
			sceneIntent({
				kind: 'set-yaw',
				operationId: 'op-noop',
				intentRevision: state.intentRevision,
				contentId: state.contentId,
				entityId: 'entity-a',
				payload: {
					entityId: 'entity-a',
					yaw: 0,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' }
				}
			})
		);
		expect(noOp.kind).toBe('no-op');
		expect(coordinator.current()).toEqual(before);
		expect(coordinator.history()).toEqual(historyBefore);
		expect(coordinator.installs()).toBe(installsBefore);

		const outside = await coordinator.accept(
			sceneIntent({
				kind: 'move-horizontal',
				operationId: 'op-outside',
				intentRevision: state.intentRevision,
				contentId: state.contentId,
				entityId: 'entity-a',
				payload: {
					entityId: 'entity-a',
					worldXZ: [20, 20],
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' },
					contactMinY: -0.5
				}
			})
		);
		expect(outside.kind).toBe('rejected');
		if (outside.kind === 'rejected') {
			expect(outside.code).toBe('planner-rejected');
			expect(outside.reason).toBe('no-support');
		}
		expect(coordinator.current()).toEqual(before);
		expect(coordinator.history()).toEqual(historyBefore);
		expect(coordinator.installs()).toBe(installsBefore);

		// A valid edit, then an intent captured before it is stale.
		const moved = await coordinator.accept(
			sceneIntent({
				kind: 'set-yaw',
				operationId: 'op-yaw',
				intentRevision: state.intentRevision,
				contentId: state.contentId,
				entityId: 'entity-a',
				payload: {
					entityId: 'entity-a',
					yaw: 0.8,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' }
				}
			})
		);
		expect(moved.kind).toBe('accepted');
		const afterMove = coordinator.current();
		const installsAfterMove = coordinator.installs();
		const stale = await coordinator.accept(
			sceneIntent({
				kind: 'set-yaw',
				operationId: 'op-yaw-stale',
				intentRevision: state.intentRevision,
				contentId: state.contentId,
				entityId: 'entity-a',
				payload: {
					entityId: 'entity-a',
					yaw: 1.1,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' }
				}
			})
		);
		expect(stale).toMatchObject({ kind: 'rejected', code: 'stale-revision' });
		expect(coordinator.current()).toEqual(afterMove);
		expect(coordinator.installs()).toBe(installsAfterMove);
	});

	it('truncates redo when a new Scene edit follows an undo', async () => {
		const { coordinator } = await boot();
		const bootState = coordinator.current();
		const yawIntent = (state: ReturnType<typeof now>, operationId: string, yaw: number) =>
			sceneIntent({
				kind: 'set-yaw',
				operationId,
				intentRevision: state.intentRevision,
				contentId: state.contentId,
				entityId: 'entity-a',
				payload: {
					entityId: 'entity-a',
					yaw,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' }
				}
			});

		const first = await coordinator.accept(yawIntent(now(coordinator), 'op-first', 0.6));
		expect(first.kind).toBe('accepted');
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(bootState.canonicalJson);

		// The new edit is planned from the restored state and replaces the redo
		// branch instead of extending it.
		const second = await coordinator.accept(yawIntent(now(coordinator), 'op-second', -0.4));
		expect(second.kind).toBe('accepted');
		const afterSecond = coordinator.current();
		const rotation = afterSecond.source.units.scene.data.entities[0]!.rotation;
		expect(rotation[0]).toBe(0);
		expect(rotation[1]).toBeCloseTo(-0.4, 12);
		expect(rotation[2]).toBe(0);
		expect(coordinator.history()).toEqual({ depth: 2, position: 1, limit: 100 });
		expect(await coordinator.redo()).toEqual({
			kind: 'unavailable',
			direction: 'redo',
			revision: afterSecond.revision
		});
		expect(coordinator.current().canonicalJson).toBe(afterSecond.canonicalJson);
	});

	it('installs nothing when a caller writes and admits a Scene document directly', async () => {
		// A caller that prepares and admits a changed document itself must still not
		// reach the accepted source, revision or history: there is no shared store a
		// direct admission could write through, and the coordinator exposes no
		// install API other than `accept`/`undo`/`redo`/`replace`.
		const { coordinator } = await boot();
		const before = coordinator.current();
		const historyBefore = coordinator.history();
		const installsBefore = coordinator.installs();
		const bypassed: CameraFreeSceneDocument = {
			...before.source.units.scene.data,
			entities: [
				...before.source.units.scene.data.entities,
				box('entity-bypass', [5, ELEVATION + 0.5, 4])
			]
		};
		const admitted = await admitUnitContent(replaceUnitData(before.source, 'scene', bypassed));
		expect(admitted.kind).toBe('admitted');

		expect(coordinator.current()).toEqual(before);
		expect(
			coordinator.current().source.units.scene.data.entities.map((entity) => entity.id)
		).not.toContain('entity-bypass');
		expect(coordinator.acceptedRevision()).toEqual(before.revision);
		expect(coordinator.history()).toEqual(historyBefore);
		expect(coordinator.installs()).toBe(installsBefore);
	});

	it('undoes a delete to the exact prior snapshot, restoring its cluster cleanup', async () => {
		const { coordinator } = await boot();
		const before = coordinator.current();
		const state = now(coordinator);
		const deleted = await coordinator.accept(
			sceneIntent({
				kind: 'delete-one',
				operationId: 'op-delete-undo',
				intentRevision: state.intentRevision,
				contentId: state.contentId,
				entityId: 'entity-b',
				payload: { entityId: 'entity-b' }
			})
		);
		expect(deleted.kind).toBe('accepted');
		if (deleted.kind !== 'accepted') return;
		expect(deleted.correspondence).toEqual([
			{
				relation: 'retired',
				before: expect.objectContaining({ subject: { kind: 'entity', id: 'entity-b' } }),
				after: null
			}
		]);
		const afterDelete = coordinator.current();
		expect(afterDelete.source.units.scene.data.entities.map((entity) => entity.id)).not.toContain(
			'entity-b'
		);
		// The two-member cluster falls below the format minimum, so the accepted
		// candidate drops it in the same operation.
		expect(afterDelete.source.units.scene.data.clusters ?? []).toEqual([]);

		const undo = await coordinator.undo();
		expect(undo.kind).toBe('restored');
		// Exact prior snapshot, not a re-derived equivalent: same bytes, same content.
		expect(coordinator.current().canonicalJson).toBe(before.canonicalJson);
		expect(coordinator.current().sourceContentId).toBe(before.sourceContentId);
		expect(coordinator.current().source.units.scene.data.clusters).toEqual([
			{ id: 'cluster-1', name: 'Group', memberIds: ['entity-b', 'entity-c'] }
		]);

		const redo = await coordinator.redo();
		expect(redo.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterDelete.canonicalJson);
	});

	it('refuses a mutation-control candidate the adapter admits, through the T2 record-scope guard', async () => {
		const { coordinator } = await boot();
		const before = coordinator.current();
		const mutatedScene: CameraFreeSceneDocument = {
			...before.source.units.scene.data,
			entities: before.source.units.scene.data.entities.map((entity) =>
				entity.id === 'entity-b' ? box('entity-b', [6, ELEVATION + 0.5, 5]) : entity
			)
		};
		const clusterMutatedScene: CameraFreeSceneDocument = {
			...before.source.units.scene.data,
			clusters: [{ id: 'cluster-1', name: 'Group', memberIds: ['entity-b', 'entity-a'] }]
		};

		// The landed adapter itself admits these documents: record-level scope is not
		// its concern, which is exactly why T2 must own it.
		expect(
			(await admitUnitContent(replaceUnitData(before.source, 'scene', mutatedScene))).kind
		).toBe('admitted');
		expect(
			(await admitUnitContent(replaceUnitData(before.source, 'scene', clusterMutatedScene))).kind
		).toBe('admitted');

		function mutationControl(input: {
			readonly kind: string;
			readonly scene: CameraFreeSceneDocument;
			readonly changedEntityIds: readonly string[];
			readonly changedEntityFields: readonly string[];
		}): DomainPlanner<ProjectEnvelope> {
			return {
				id: `conformance.${input.kind}`,
				kind: input.kind,
				admission: { domain: 'scene', compound: false, units: false, resources: false },
				sourceKinds: [UNIT_SOURCE_KIND],
				sourceVersions: [UNIT_SOURCE_VERSION],
				prepare({ snapshot, intent }) {
					const finalized = finalizeSceneCandidate({
						before: snapshot.domain.source.units.scene.data,
						after: input.scene,
						scope: {
							operationKind: 'move-horizontal',
							changedEntityIds: input.changedEntityIds,
							changedEntityFields: input.changedEntityFields,
							createdEntityIds: [],
							removedEntityIds: [],
							allowClusterCleanup: false
						}
					});
					if (finalized.kind === 'rejected') {
						return {
							kind: 'rejected',
							code: finalized.code,
							message: finalized.message,
							diagnostics: finalized.diagnostics
						};
					}
					return {
						kind: 'prepared',
						candidate: {
							operationId: intent.operationId,
							sourceKind: snapshot.sourceKind,
							sourceVersion: snapshot.sourceVersion,
							source: replaceUnitData(snapshot.domain.source, 'scene', finalized.scene),
							changes: [],
							correspondence: [],
							diagnostics: []
						}
					};
				}
			};
		}

		for (const [kind, plan] of [
			[
				'conformance-record-scope-entity',
				mutationControl({
					kind: 'conformance-record-scope-entity',
					scene: mutatedScene,
					changedEntityIds: ['entity-a'],
					changedEntityFields: ['position']
				})
			],
			[
				'conformance-record-scope-cluster',
				mutationControl({
					kind: 'conformance-record-scope-cluster',
					scene: clusterMutatedScene,
					changedEntityIds: [],
					changedEntityFields: []
				})
			]
		] as const) {
			expect(coordinator.register(plan).kind).toBe('registered');
			const state = now(coordinator);
			const result = await coordinator.accept(
				sceneIntent({
					kind,
					operationId: `op-${kind}`,
					intentRevision: state.intentRevision,
					contentId: state.contentId,
					entityId: 'entity-a',
					payload: { entityId: 'entity-a' }
				})
			);
			expect(result.kind, kind).toBe('rejected');
			if (result.kind !== 'rejected') return;
			expect(result.code, kind).toBe('planner-rejected');
			expect(result.reason, kind).toBe('record-scope-violation');
			expect(coordinator.current(), kind).toEqual(before);
		}
		expect(coordinator.installs()).toBe(1);
		expect(coordinator.history()).toEqual({ depth: 1, position: 0, limit: 100 });
		// The guard reports the untargeted records, not just a generic refusal.
		expect(
			checkSceneRecordScope(before.source.units.scene.data, mutatedScene, {
				operationKind: 'move-horizontal',
				changedEntityIds: ['entity-a'],
				changedEntityFields: ['position'],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			}).some((issue) => issue.path.includes('entity-b'))
		).toBe(true);
		expect(
			checkSceneRecordScope(before.source.units.scene.data, clusterMutatedScene, {
				operationKind: 'move-horizontal',
				changedEntityIds: [],
				changedEntityFields: [],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			}).some((issue) => issue.path.includes('cluster-1'))
		).toBe(true);
	});

	it('keeps Camera-bearing bytes identical through every accepted operation', async () => {
		const { coordinator, admitted } = await boot();
		const bootCamera = cameraBytes(admitted.envelope.units.camera.data);

		const placeState = now(coordinator);
		const placed = await coordinator.accept(
			placeIntent({
				intentRevision: placeState.intentRevision,
				operationId: 'journey-place',
				entityId: 'entity-new',
				payload: {
					definitionKey: 'native:box',
					metadataContentId: (await nativePlacementDefinition('box')).metadataContentId,
					worldXZ: [3, 2],
					yaw: 0,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' }
				}
			})
		);
		expect(placed.kind).toBe('accepted');
		expect(cameraBytes(coordinator.current().source.units.camera.data)).toBe(bootCamera);

		const operations: Array<{
			readonly kind: string;
			readonly operationId: string;
			readonly entityId: string;
			readonly payload: Record<string, unknown>;
			readonly allocatedId?: string;
		}> = [
			{
				kind: 'move-horizontal',
				operationId: 'journey-move',
				entityId: 'entity-a',
				payload: {
					entityId: 'entity-a',
					worldXZ: [4, 3],
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' },
					contactMinY: -0.5
				}
			},
			{
				kind: 'set-yaw',
				operationId: 'journey-yaw',
				entityId: 'entity-a',
				payload: {
					entityId: 'entity-a',
					yaw: 0.7,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' }
				}
			},
			{
				kind: 'place-on-floor',
				operationId: 'journey-reseat',
				entityId: 'entity-a',
				payload: {
					entityId: 'entity-a',
					worldXZ: [1, 1],
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' },
					contactMinY: -0.5
				}
			},
			{
				kind: 'resize-on-floor',
				operationId: 'journey-resize',
				entityId: 'entity-a',
				payload: { entityId: 'entity-a', scale: 2, contactMinY: -0.5 }
			},
			{
				kind: 'duplicate-one',
				operationId: 'journey-duplicate',
				entityId: 'entity-a',
				payload: { entityId: 'entity-a', contactMinY: -0.5 },
				allocatedId: 'entity-copy'
			},
			{
				kind: 'delete-one',
				operationId: 'journey-delete',
				entityId: 'entity-new',
				payload: { entityId: 'entity-new' }
			}
		];
		for (const operation of operations) {
			const state = now(coordinator);
			const result = await coordinator.accept(
				sceneIntent({
					kind: operation.kind,
					operationId: operation.operationId,
					intentRevision: state.intentRevision,
					contentId: state.contentId,
					entityId: operation.entityId,
					payload: operation.payload,
					...(operation.allocatedId === undefined ? {} : { allocatedId: operation.allocatedId })
				})
			);
			expect(result.kind, operation.operationId).toBe('accepted');
			expect(
				cameraBytes(coordinator.current().source.units.camera.data),
				operation.operationId
			).toBe(bootCamera);
		}
		expect(validateProjectEnvelope(coordinator.current().source).success).toBe(true);
	});
});

/**
 * T2.P02.S02 — a creator model's first placement is one accepted result.
 *
 * The resource, its exact lock and the entity install together, Undo removes all
 * three and Redo restores the captured identities; a later instance reuses the
 * accepted pins and adds only a distinct entity. The resource is read from the
 * accepted envelope, never from a second catalogue.
 */
describe('creator model placement through the F.4 coordinator', () => {
	const HASH_A = `sha256-${'a'.repeat(64)}`;
	const HASH_B = `sha256-${'b'.repeat(64)}`;
	const REPORT = `sha256-${'c'.repeat(64)}`;

	function approval() {
		return {
			derivative: { hash: HASH_A, mime: 'model/gltf-binary', size: 4096, locator: `models/${HASH_A}.glb` },
			source: { manifestHash: HASH_B, size: 8192, fileCount: 2 },
			recipe: { id: 'creator-import@1', version: 1 },
			reportDigest: REPORT,
			placement: {
				metresPerSourceUnit: 1,
				pivot: [0, 0, 0] as [number, number, number],
				footprint: { width: 0.8, depth: 0.6 },
				contactMinY: -0.25
			}
		};
	}

	function modelResource(id = 'model-chair') {
		const entry = creatorModelResourceEntry(id, approval());
		if (entry === null) throw new Error('the fixture approval is not a well-formed resource');
		return entry;
	}

	it('installs resource, exact lock and entity once, then Undo removes all three and Redo restores them', async () => {
		const entry = modelResource();
		const definition = await creatorModelDefinition(entry.resource, 'Chair');
		expect(definition).not.toBeNull();
		const { coordinator, admitted } = await boot({ definitions: [definition!] });
		const placed = await coordinator.accept(
			placeIntent({
				intentRevision: now(coordinator).intentRevision,
				operationId: 'op-model-place',
				entityId: 'entity-chair',
				payload: {
					definitionKey: definition!.definitionKey,
					metadataContentId: definition!.metadataContentId,
					worldXZ: [3, 2],
					yaw: 0,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' },
					modelResource: creatorModelResourcePayload(entry)
				}
			})
		);
		expect(placed.kind).toBe('accepted');
		if (placed.kind !== 'accepted') return;

		const accepted = coordinator.current();
		const resources = accepted.source.units.resources.data.resources;
		expect(resources.map((resource) => resource.id)).toEqual(['model-chair']);
		expect(resources[0]!.pin).toEqual({ hash: HASH_A, mime: 'model/gltf-binary', size: 4096, locator: `models/${HASH_A}.glb` });
		expect(resources[0]!.model?.placement.contactMinY).toBe(-0.25);
		const locks = accepted.source.dependencyLock.entries.filter((lock) => lock.subjectId === 'model-chair');
		expect(locks).toHaveLength(1);
		expect(locks[0]).toMatchObject({ domain: 'resource:model', contentRevision: HASH_A });
		const entity = accepted.source.units.scene.data.entities.at(-1)!;
		expect(entity).toMatchObject({ id: 'entity-chair', kind: 'model', assetId: 'model-chair' });
		// One accepted result installs the entity, and the resource and lock arrive in
		// the same candidate envelope they are pinned from.
		expect(placed.correspondence).toEqual([
			{ relation: 'created', before: null, after: expect.objectContaining({ subject: { kind: 'entity', id: 'entity-chair' } }) }
		]);
		expect(validateProjectEnvelope(accepted.source).success).toBe(true);

		const undo = await coordinator.undo();
		expect(undo.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(admitted.canonicalJson);
		expect(coordinator.current().source.units.resources.data.resources).toHaveLength(0);
		expect(coordinator.current().source.dependencyLock.entries.some((lock) => lock.subjectId === 'model-chair')).toBe(false);
		expect(coordinator.current().source.units.scene.data.entities.some((candidate) => candidate.id === 'entity-chair')).toBe(false);

		const redo = await coordinator.redo();
		expect(redo.kind).toBe('restored');
		const restored = coordinator.current();
		expect(restored.canonicalJson).toBe(accepted.canonicalJson);
		expect(restored.source.units.resources.data.resources[0]?.pin?.hash).toBe(HASH_A);
		expect(restored.source.units.scene.data.entities.at(-1)!.id).toBe('entity-chair');
	});

	it('places another instance from the accepted pins without introducing a second resource', async () => {
		const entry = modelResource();
		const definition = await creatorModelDefinition(entry.resource, 'Chair');
		const { coordinator } = await boot({ definitions: [definition!] });
		const payload = (worldXZ: [number, number], metadataContentId: string) => ({
			definitionKey: definition!.definitionKey,
			metadataContentId,
			worldXZ,
			yaw: 0,
			frame: { origin: [0, 0, 0], yaw: 0 },
			frameReference: { version: 1, kind: 'project-world' }
		});
		const first = await coordinator.accept(
			placeIntent({
				intentRevision: now(coordinator).intentRevision,
				operationId: 'op-model-1',
				entityId: 'entity-chair-1',
				payload: { ...payload([3, 2], definition!.metadataContentId), modelResource: creatorModelResourcePayload(entry) }
			})
		);
		expect(first.kind).toBe('accepted');

		// The second placement resolves the definition from the accepted envelope:
		// same pins, a different entity identity, no new resource.
		const acceptedResource = coordinator
			.current()
			.source.units.resources.data.resources.find((resource) => resource.id === 'model-chair')!;
		const secondDefinition = await creatorModelDefinition(acceptedResource, 'Chair');
		expect(secondDefinition!.definitionKey).toBe(definition!.definitionKey);
		const second = await coordinator.accept(
			placeIntent({
				intentRevision: now(coordinator).intentRevision,
				operationId: 'op-model-2',
				entityId: 'entity-chair-2',
				payload: payload([5, 2], secondDefinition!.metadataContentId)
			})
		);
		expect(second.kind).toBe('accepted');
		if (second.kind !== 'accepted') return;
		expect(second.correspondence).toEqual([
			{ relation: 'created', before: null, after: expect.objectContaining({ subject: { kind: 'entity', id: 'entity-chair-2' } }) }
		]);

		const source = coordinator.current().source;
		expect(source.units.resources.data.resources).toHaveLength(1);
		expect(source.dependencyLock.entries.filter((lock) => lock.subjectId === 'model-chair')).toHaveLength(1);
		const models = source.units.scene.data.entities.filter((entity) => entity.kind === 'model');
		expect(models.map((entity) => entity.id)).toEqual(['entity-chair-1', 'entity-chair-2']);
		expect(new Set(models.map((entity) => entity.assetId))).toEqual(new Set(['model-chair']));
		// The approved contact resolves the floor pose: contact -0.25 m under the
		// 2.5 m elevation seat.
		expect(models[0]!.position[1]).toBeCloseTo(ELEVATION + 0.25, 6);
	});

	it('refuses a mismatched, duplicated or stale resource introduction without writing anything', async () => {
		const entry = modelResource();
		const other = modelResource('model-other');
		const definition = await creatorModelDefinition(entry.resource, 'Chair');
		const { coordinator, admitted } = await boot({ definitions: [definition!] });

		const mismatched = await coordinator.accept(
			placeIntent({
				intentRevision: now(coordinator).intentRevision,
				operationId: 'op-model-mismatch',
				entityId: 'entity-chair',
				payload: {
					definitionKey: definition!.definitionKey,
					metadataContentId: definition!.metadataContentId,
					worldXZ: [3, 2],
					yaw: 0,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' },
					modelResource: creatorModelResourcePayload(other)
				}
			})
		);
		expect(mismatched.kind).toBe('rejected');
		expect(coordinator.current().canonicalJson).toBe(admitted.canonicalJson);

		const accepted = await coordinator.accept(
			placeIntent({
				intentRevision: now(coordinator).intentRevision,
				operationId: 'op-model-ok',
				entityId: 'entity-chair',
				payload: {
					definitionKey: definition!.definitionKey,
					metadataContentId: definition!.metadataContentId,
					worldXZ: [3, 2],
					yaw: 0,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' },
					modelResource: creatorModelResourcePayload(entry)
				}
			})
		);
		expect(accepted.kind).toBe('accepted');
		const afterAccept = coordinator.current();

		const duplicate = await coordinator.accept(
			placeIntent({
				intentRevision: now(coordinator).intentRevision,
				operationId: 'op-model-duplicate',
				entityId: 'entity-chair-dup',
				payload: {
					definitionKey: definition!.definitionKey,
					metadataContentId: definition!.metadataContentId,
					worldXZ: [5, 2],
					yaw: 0,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' },
					modelResource: creatorModelResourcePayload(entry)
				}
			})
		);
		expect(duplicate.kind).toBe('rejected');
		expect(coordinator.current().canonicalJson).toBe(afterAccept.canonicalJson);

		const stale = await coordinator.accept(
			placeIntent({
				intentRevision: now(coordinator).intentRevision,
				operationId: 'op-model-stale',
				entityId: 'entity-chair-stale',
				payload: {
					definitionKey: definition!.definitionKey,
					metadataContentId: `sha256-${'d'.repeat(64)}`,
					worldXZ: [6, 2],
					yaw: 0,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' }
				}
			})
		);
		expect(stale.kind).toBe('rejected');
		expect(coordinator.current().canonicalJson).toBe(afterAccept.canonicalJson);
	});
});
