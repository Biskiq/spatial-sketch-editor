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
import { createScenePlanners, type NormalizedPlacementDefinition } from '@portfolio/project-model/scene-planning';
import type { AuthoringIntent, DomainPlanner } from '@portfolio/project-model/f4';
import type { SceneDocument, SceneEntity, ScenePrimitiveEntity, Vec3 } from '@portfolio/project-model/scene';
import type { SemanticReference } from '@portfolio/project-model/references';
import { serializeProjectEnvelope, validateProjectEnvelope, type ExperienceUnitPayload, type ProjectEnvelope } from '@portfolio/project-model/units';
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
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION, admitUnitProject, createUnitCoordinator, createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
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

describe('scene history', () => {
	it('registers the twenty-three Scene planners beside the conformance Layout planner', async () => {
		const { coordinator } = await boot();
		expect(coordinator.planners().map((planner) => planner.kind).sort()).toEqual(
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

	it('R34: delete-one unlinks with the last effective name, and one Undo restores object, link and label', async () => {
		const linked = (envelope: ProjectEnvelope): ExperienceUnitPayload => ({
			...EXPERIENCE,
			experiences: EXPERIENCE.experiences.map((experience) => ({
				...experience,
				presentations: experience.presentations.map((presentation, index) =>
					index === 0
						? {
								...presentation,
								label: null,
								subject: {
									version: 1 as const,
									domain: 'scene' as const,
									revision: { kind: 'exact' as const, contentRevision: envelope.units.scene.header.contentRevision },
									subject: { kind: 'entity' as const, id: 'entity-b' },
									instancePath: [],
									location: { kind: 'project-root' as const },
									componentId: null,
									capabilityId: null
								}
							}
						: presentation
				)
			}))
		});
		const { coordinator } = await boot({ experience: linked });
		const before = serializeProjectEnvelope(coordinator.current().source);
		const state = now(coordinator);
		const deleted = await coordinator.accept(
			sceneIntent({
				kind: 'delete-one',
				operationId: 'op-delete-linked',
				intentRevision: state.intentRevision,
				contentId: state.contentId,
				entityId: 'entity-b',
				payload: { entityId: 'entity-b' }
			})
		);
		expect(deleted.kind).toBe('accepted');
		const unlinked = coordinator.current().source.units.experience.data.experiences[0]!.presentations[0]!;
		expect(unlinked).toMatchObject({ subject: null, label: 'entity-b' });
		expect(coordinator.current().source.units.scene.data.entities.map((entity) => entity.id)).not.toContain('entity-b');

		const undone = await coordinator.undo();
		expect(undone.kind).toBe('restored');
		expect(serializeProjectEnvelope(coordinator.current().source)).toBe(before);
		expect(coordinator.current().source.units.experience.data.experiences[0]!.presentations[0]!.label).toBeNull();
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
