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
import { createScenePlanners, checkSceneRecordScope, finalizeSceneCandidate, type NormalizedPlacementDefinition } from '@portfolio/project-model/scene-planning';
import type { AuthoringIntent, DomainPlanner } from '@portfolio/project-model/f4';
import type { SceneDocument, SceneEntity, ScenePrimitiveEntity, Vec3 } from '@portfolio/project-model/scene';
import type { SemanticReference } from '@portfolio/project-model/references';
import { replaceUnitData, type CameraFreeSceneDocument, type ExperienceUnitPayload, type ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planCommitLayoutObjectPreset, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { nextLayoutPresetObjectId } from '@portfolio/layout-core/plan';
import { nativePlacementDefinition } from '$lib/authoring/scene/object-definition-policy';
import type { AcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import { createProofLayoutPlanner } from '../__fixtures__/f4-current-source-fixtures';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
import {
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	admitUnitContent,
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject
} from '../__fixtures__/unit-envelope-fixtures';
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
function conformanceProject(
	elevation = ELEVATION,
	projectId = BOOT_REVISION.projectId
): {
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
			id: projectId,
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
async function boot(
	options: {
		readonly elevation?: number;
		/** A distinct project identity for cross-project library journeys. */
		readonly projectId?: string;
		/** Extra admitted definitions, e.g. an approved creator model's. */
		readonly definitions?: readonly NormalizedPlacementDefinition[];
		/** Replace the default empty Experience exactly, e.g. with a linked Presentation. */
		readonly experience?: (envelope: ProjectEnvelope) => ExperienceUnitPayload;
	} = {}
) {
	const revision = {
		projectId: options.projectId ?? BOOT_REVISION.projectId,
		revisionId: BOOT_REVISION.revisionId
	};
	const { project, layoutObjectId } = conformanceProject(options.elevation ?? ELEVATION, revision.projectId);
	const projectInput = {
		id: project.id,
		name: project.name,
		acceptedRevision: revision,
		layout: project.layout,
		scene: project.scene
	};
	let envelope = await createUnitProject(projectInput);
	if (options.experience !== undefined) {
		envelope = await createUnitProject({ ...projectInput, experience: options.experience(envelope) });
	}
	const admitted = await admitUnitProject(envelope, revision);
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
			revision,
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

describe('scene refusals', () => {
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
				entityId: 'entity-missing',
				payload: {
					entityId: 'entity-missing',
					worldXZ: [20, 20],
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' },
					contactMinY: -0.5
				}
			})
		);
		expect(outside.kind).toBe('rejected');
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
							removedEntityIds: []
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
				removedEntityIds: []
			}).some((issue) => issue.path.includes('entity-b'))
		).toBe(true);
		expect(
			checkSceneRecordScope(before.source.units.scene.data, clusterMutatedScene, {
				operationKind: 'move-horizontal',
				changedEntityIds: [],
				changedEntityFields: [],
				createdEntityIds: [],
				removedEntityIds: []
			}).some((issue) => issue.path === '$.scene.clusters')
		).toBe(true);
	});
});
