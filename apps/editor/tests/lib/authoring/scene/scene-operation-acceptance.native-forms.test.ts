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
import { createScenePlanners, evaluateSceneForm, type NormalizedPlacementDefinition } from '@portfolio/project-model/scene-planning';
import { formMeshDigest } from '@portfolio/geometry-core';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneDocument, SceneEntity, ScenePrimitiveEntity, Vec3 } from '@portfolio/project-model/scene';
import type { SemanticReference } from '@portfolio/project-model/references';
import { type ExperienceUnitPayload, type ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planCommitLayoutObjectPreset, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { nextLayoutPresetObjectId } from '@portfolio/layout-core/plan';
import { nativePlacementDefinition } from '$lib/authoring/scene/object-definition-policy';
import type { AcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import { createProofLayoutPlanner } from '../__fixtures__/f4-current-source-fixtures';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
import { admitUnitProject, createUnitCoordinator, createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
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

describe('native forms', () => {
	it('creates and sizes a native form with one history entry each, exact Undo/Redo and an identical cold reopen', async () => {
		const { coordinator } = await boot();
		expect(coordinator.history().depth).toBe(1);
		const state = now(coordinator);
		const created = await coordinator.accept(
			createFormIntent({
				intentRevision: state.intentRevision,
				operationId: 'op-create-form',
				entityId: 'entity-form',
				payload: {
					plane: 'plan',
					outline: [
						{ u: 0, v: 0, smooth: false },
						{ u: 2, v: 0, smooth: false },
						{ u: 2, v: 1, smooth: false },
						{ u: 0, v: 1, smooth: false }
					],
					extent: 0.8,
					position: [3, 0, 2],
					yaw: 0,
					materialId: 'plaster-warm',
					name: 'Drawn plinth'
				}
			})
		);
		expect(created.kind).toBe('accepted');
		if (created.kind !== 'accepted') return;
		expect(coordinator.history()).toEqual({ depth: 2, position: 1, limit: 100 });
		const afterCreate = coordinator.current();
		const createdForm = afterCreate.source.units.scene.data.entities.find(
			(entity) => entity.id === 'entity-form'
		);
		expect(createdForm?.kind).toBe('form');
		if (createdForm?.kind !== 'form') return;
		expect(createdForm.position).toEqual([4, ELEVATION, 2.5]);
		expect(createdForm.form.scale).toEqual([1, 1, 1]);

		const resizeState = now(coordinator);
		const resized = await coordinator.accept(
			sceneIntent({
				kind: 'set-form-size',
				operationId: 'op-form-size',
				intentRevision: resizeState.intentRevision,
				contentId: resizeState.contentId,
				entityId: 'entity-form',
				payload: { entityId: 'entity-form', scale: [2, 1.5, 1] }
			})
		);
		expect(resized.kind).toBe('accepted');
		if (resized.kind !== 'accepted') return;
		expect(coordinator.history().depth).toBe(3);
		const afterResize = coordinator.current();
		const resizedForm = afterResize.source.units.scene.data.entities.find(
			(entity) => entity.id === 'entity-form'
		);
		expect(resizedForm?.kind).toBe('form');
		if (resizedForm?.kind !== 'form') return;
		expect(resizedForm.form.scale).toEqual([2, 1.5, 1]);
		// A plan form's contact is its base, so the per-axis scale moves no Y.
		expect(resizedForm.position).toEqual([4, ELEVATION, 2.5]);

		const undo = await coordinator.undo();
		expect(undo.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterCreate.canonicalJson);
		const undoState = coordinator.current();
		const undoneForm = undoState.source.units.scene.data.entities.find(
			(entity) => entity.id === 'entity-form'
		);
		expect(undoneForm?.kind === 'form' ? undoneForm.form.scale : null).toEqual([1, 1, 1]);

		const redo = await coordinator.redo();
		expect(redo.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterResize.canonicalJson);

		// A refused no-op size neither adds history nor rewrites the source.
		const noopState = now(coordinator);
		const noop = await coordinator.accept(
			sceneIntent({
				kind: 'set-form-size',
				operationId: 'op-form-size-noop',
				intentRevision: noopState.intentRevision,
				contentId: noopState.contentId,
				entityId: 'entity-form',
				payload: { entityId: 'entity-form', scale: [2, 1.5, 1] }
			})
		);
		expect(noop.kind).toBe('no-op');
		expect(coordinator.current().canonicalJson).toBe(afterResize.canonicalJson);
		expect(coordinator.history().depth).toBe(3);

		// Save is the captured canonical bytes; a cold reopen admits them again and
		// the form evaluates to the identical mesh.
		const saved = coordinator.current();
		const reopened = await admitUnitProject(
			JSON.parse(saved.canonicalJson) as ProjectEnvelope,
			{ projectId: saved.revision.projectId, revisionId: 'revision-reopen' }
		);
		expect(reopened.kind).toBe('admitted');
		if (reopened.kind !== 'admitted') return;
		expect(reopened.canonicalJson).toBe(saved.canonicalJson);
		const liveForm = saved.source.units.scene.data.entities.find(
			(entity) => entity.id === 'entity-form'
		);
		const reopenedForm = reopened.project.units.scene.data.entities.find(
			(entity) => entity.id === 'entity-form'
		);
		if (liveForm?.kind !== 'form' || reopenedForm?.kind !== 'form') {
			throw new Error('the form did not survive the cold reopen');
		}
		expect(formMeshDigest(evaluateSceneForm(reopenedForm.form))).toBe(
			formMeshDigest(evaluateSceneForm(liveForm.form))
		);
	});

	it('revises an existing form outline as one entry, with exact Undo/Redo and a refused no-op', async () => {
		const { coordinator } = await boot();
		const bootState = now(coordinator);
		const created = await coordinator.accept(
			createFormIntent({
				intentRevision: bootState.intentRevision,
				operationId: 'op-create-profile-form',
				entityId: 'entity-form',
				payload: {
					plane: 'plan',
					outline: [
						{ u: 0, v: 0, smooth: false },
						{ u: 2, v: 0, smooth: false },
						{ u: 2, v: 1, smooth: false },
						{ u: 0, v: 1, smooth: false }
					],
					extent: 0.8,
					position: [3, 0, 2],
					yaw: 0,
					materialId: 'plaster-warm',
					name: 'Drawn plinth'
				}
			})
		);
		expect(created.kind).toBe('accepted');
		if (created.kind !== 'accepted') return;
		const original = acceptedForm(coordinator, 'entity-form');
		const outline = original.form.generator.outline.map((anchor, index) =>
			index === 0 ? { ...anchor, u: anchor.u + 0.5 } : { ...anchor }
		);

		const state = now(coordinator);
		const revised = await coordinator.accept(
			sceneIntent({
				kind: 'set-form-profile',
				operationId: 'op-profile-form',
				intentRevision: state.intentRevision,
				contentId: state.contentId,
				entityId: 'entity-form',
				payload: { entityId: 'entity-form', outline, extent: 1.1 }
			})
		);
		expect(revised.kind).toBe('accepted');
		if (revised.kind !== 'accepted') return;
		expect(coordinator.history().depth).toBe(3);
		const revisedForm = acceptedForm(coordinator, 'entity-form');
		expect(revisedForm.form.generator.outline).toEqual(outline);
		expect(revisedForm.form.generator.extent).toBe(1.1);
		// Keys, the next key and the placement are the form's own preserved facts.
		expect(revisedForm.form.nextKey).toBe(original.form.nextKey);
		expect(revisedForm.position).toEqual(original.position);
		const afterRevision = coordinator.current();

		const undo = await coordinator.undo();
		expect(undo.kind).toBe('restored');
		expect(acceptedForm(coordinator, 'entity-form').form.generator.outline).toEqual(
			original.form.generator.outline
		);
		const redo = await coordinator.redo();
		expect(redo.kind).toBe('restored');
		expect(coordinator.current().canonicalJson).toBe(afterRevision.canonicalJson);

		const noopState = now(coordinator);
		const noop = await coordinator.accept(
			sceneIntent({
				kind: 'set-form-profile',
				operationId: 'op-profile-form-noop',
				intentRevision: noopState.intentRevision,
				contentId: noopState.contentId,
				entityId: 'entity-form',
				payload: { entityId: 'entity-form', outline, extent: 1.1 }
			})
		);
		expect(noop.kind).toBe('no-op');
		expect(coordinator.history().depth).toBe(3);
		expect(coordinator.current().canonicalJson).toBe(afterRevision.canonicalJson);
	});
});
