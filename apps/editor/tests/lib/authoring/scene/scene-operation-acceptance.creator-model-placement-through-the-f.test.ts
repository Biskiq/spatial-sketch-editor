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
	evaluateSceneForm,
	finalizeSceneCandidate,
	type NormalizedPlacementDefinition
} from '@portfolio/project-model/scene-planning';
import { formMeshDigest } from '@portfolio/geometry-core';
import {
	creatorModelDefinition,
	creatorModelResourceEntry,
	creatorModelResourcePayload
} from '@portfolio/project-model/scene-planning';
import type { AuthoringIntent, DomainPlanner } from '@portfolio/project-model/f4';
import type { SceneDocument, SceneEntity, ScenePrimitiveEntity, Vec3 } from '@portfolio/project-model/scene';
import type { SemanticReference } from '@portfolio/project-model/references';
import {
	replaceUnitData,
	serializeProjectEnvelope,
	validateProjectEnvelope,
	type CameraFreeSceneDocument,
	type ExperienceUnitPayload,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import {
	canonicalFormLibraryBytes,
	formLibraryContentId,
	formLibraryPayloadFromEntity,
	readFormLibraryBytes
} from '@portfolio/project-model/library';
import { createEmptyWallFirstLayoutDocument, planCommitLayoutObjectPreset, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { nextLayoutPresetObjectId } from '@portfolio/layout-core/plan';
import { nativePlacementDefinition } from '$lib/authoring/scene/object-definition-policy';
import type { AcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	PROOF_LAYOUT_TRANSFORM_KIND,
	createProofLayoutPlanner,
	layoutObjectReference,
	proofIntent
} from '../__fixtures__/f4-current-source-fixtures';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
import { EXPERIENCE } from '../../experience/fixtures';
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

function createFormIntent(input: {
	readonly intentRevision: { projectId: string; revisionId: string };
	readonly operationId: string;
	readonly entityId: string;
	readonly payload: Record<string, unknown>;
}): AuthoringIntent {
	return {
		version: 1,
		kind: 'create-form',
		operationId: input.operationId,
		expectedRevision: input.intentRevision,
		targets: [],
		payload: input.payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-entity', id: input.entityId }]
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

/** One My Objects insertion: no existing target, exactly one allocated entity. */
function placeFormCopyIntent(input: {
	readonly intentRevision: { projectId: string; revisionId: string };
	readonly operationId: string;
	readonly entityId: string;
	readonly payload: Record<string, unknown>;
	readonly targets?: AuthoringIntent['targets'];
}): AuthoringIntent {
	return {
		version: 1,
		kind: 'place-form-copy',
		operationId: input.operationId,
		expectedRevision: input.intentRevision,
		targets: input.targets ?? [],
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

/** The one accepted form with this id, narrowed for the library payload. */
function acceptedForm(coordinator: AcceptanceCoordinator<ProjectEnvelope>, entityId: string) {
	const entity = coordinator.current().source.units.scene.data.entities.find(
		(candidate) => candidate.id === entityId
	);
	if (entity?.kind !== 'form') throw new Error(`expected the accepted form ${entityId}`);
	return entity;
}

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
