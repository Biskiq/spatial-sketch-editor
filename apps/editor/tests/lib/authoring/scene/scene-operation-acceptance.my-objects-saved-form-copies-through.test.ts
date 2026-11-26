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
import { freshCapture } from '../../layout/__fixtures__/layout-id-capture';
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

describe('My Objects saved form copies through the F.4 coordinator', () => {
	/**
	 * Project A's accepted form, saved as one format-1 library item. The form is
	 * drawn with a smooth anchor and sized to a non-default scale, so the saved
	 * source carries more than the create defaults.
	 */
	async function savedFormA() {
		const a = await boot();
		const created = await a.coordinator.accept(
			createFormIntent({
				intentRevision: now(a.coordinator).intentRevision,
				operationId: 'op-saved-create',
				entityId: 'entity-saved',
				payload: {
					plane: 'plan',
					outline: [
						{ u: 0, v: 0, smooth: false },
						{ u: 2, v: 0, smooth: true },
						{ u: 2, v: 1, smooth: false },
						{ u: 0, v: 1, smooth: false }
					],
					extent: 0.8,
					position: [3, 0, 2],
					yaw: 0.2,
					materialId: 'plaster-warm',
					name: 'Saved plinth'
				}
			})
		);
		expect(created.kind).toBe('accepted');
		const sized = await a.coordinator.accept(
			sceneIntent({
				kind: 'set-form-size',
				operationId: 'op-saved-size',
				intentRevision: now(a.coordinator).intentRevision,
				contentId: now(a.coordinator).contentId,
				entityId: 'entity-saved',
				payload: { entityId: 'entity-saved', scale: [1.25, 1.5, 0.75] }
			})
		);
		expect(sized.kind).toBe('accepted');
		const entity = acceptedForm(a.coordinator, 'entity-saved');
		expect(entity.form.scale).toEqual([1.25, 1.5, 0.75]);
		expect(entity.form.generator.outline.some((anchor) => anchor.smooth)).toBe(true);

		const historyBeforeSave = a.coordinator.history();
		const canonicalBeforeSave = a.coordinator.current().canonicalJson;
		const item = formLibraryPayloadFromEntity(entity);
		const bytes = canonicalFormLibraryBytes(item);
		const contentId = await formLibraryContentId(item);
		// Save is not an edit: deriving and writing the payload adds no history entry
		// and does not touch the project.
		expect(a.coordinator.history()).toEqual(historyBeforeSave);
		expect(a.coordinator.current().canonicalJson).toBe(canonicalBeforeSave);
		// The stored item is the accepted source exactly, and the bytes the client
		// would send are the canonical bytes the content id covers.
		expect(item.form).toEqual(entity.form);
		expect(new TextDecoder().decode(bytes)).toBe(
			JSON.stringify(item)
		);
		const verified = await readFormLibraryBytes(bytes, { contentId });
		expect(verified.success).toBe(true);
		if (!verified.success) throw new Error('the saved bytes refused');
		expect(verified.payload.form).toEqual(entity.form);
		return { a, entity, item, bytes, contentId };
	}

	function insert(
		coordinator: AcceptanceCoordinator<ProjectEnvelope>,
		input: {
			readonly entityId: string;
			readonly item: unknown;
			readonly worldXZ: [number, number];
			readonly yaw: number;
			readonly contactMinY: number;
			readonly operationId: string;
			readonly targets?: AuthoringIntent['targets'];
		}
	) {
		return coordinator.accept(
			placeFormCopyIntent({
				intentRevision: now(coordinator).intentRevision,
				operationId: input.operationId,
				entityId: input.entityId,
				payload: {
					item: input.item,
					worldXZ: input.worldXZ,
					yaw: input.yaw,
					contactMinY: input.contactMinY
				},
				...(input.targets === undefined ? {} : { targets: input.targets })
			})
		);
	}

	it('saves A\'s accepted source and inserts an exact, independent copy in B', async () => {
		const { a, entity, item, contentId } = await savedFormA();
		const b = await boot({ projectId: 'project-my-objects-b' });
		const aCanonical = a.coordinator.current().canonicalJson;
		const bBefore = b.coordinator.current();
		const bHistoryBefore = b.coordinator.history();
		const contactMinY = evaluateSceneForm(item.form).contactMinY;

		const inserted = await insert(b.coordinator, {
			entityId: 'entity-copy',
			item,
			worldXZ: [1.5, 2.5],
			yaw: 0.3,
			contactMinY,
			operationId: 'op-insert-copy'
		});
		expect(inserted.kind).toBe('accepted');
		if (inserted.kind !== 'accepted') return;
		expect(b.coordinator.history()).toEqual({
			depth: bHistoryBefore.depth + 1,
			position: bHistoryBefore.position + 1,
			limit: bHistoryBefore.limit
		});
		const copy = acceptedForm(b.coordinator, 'entity-copy');
		expect(copy.form).toEqual(item.form);
		expect(copy.form.generator.outline.map((anchor) => anchor.key)).toEqual(
			entity.form.generator.outline.map((anchor) => anchor.key)
		);
		expect(copy.form.scale).toEqual([1.25, 1.5, 0.75]);
		expect(copy.form.nextKey).toBe(entity.form.nextKey);
		expect(copy.name).toBe('Saved plinth');
		expect(copy.materialId).toBe('plaster-warm');
		expect(copy.rotation).toEqual([0, 0.3, 0]);
		expect(copy.position).toEqual([1.5, ELEVATION - contactMinY, 2.5]);
		// The golden digest is A's original body, not a re-drawn equivalent.
		expect(formMeshDigest(evaluateSceneForm(copy.form))).toBe(
			formMeshDigest(evaluateSceneForm(entity.form))
		);
		const afterInsert = b.coordinator.current();

		const undone = await b.coordinator.undo();
		expect(undone.kind).toBe('restored');
		expect(b.coordinator.current().canonicalJson).toBe(bBefore.canonicalJson);
		const redone = await b.coordinator.redo();
		expect(redone.kind).toBe('restored');
		expect(b.coordinator.current().canonicalJson).toBe(afterInsert.canonicalJson);

		// Refining B's copy reaches neither A nor the item.
		const bSized = await b.coordinator.accept(
			sceneIntent({
				kind: 'set-form-size',
				operationId: 'op-copy-size',
				intentRevision: now(b.coordinator).intentRevision,
				contentId: now(b.coordinator).contentId,
				entityId: 'entity-copy',
				payload: { entityId: 'entity-copy', scale: [2, 1, 1] }
			})
		);
		expect(bSized.kind).toBe('accepted');
		expect(acceptedForm(b.coordinator, 'entity-copy').form.scale).toEqual([2, 1, 1]);
		expect(await formLibraryContentId(item)).toBe(contentId);
		expect(a.coordinator.current().canonicalJson).toBe(aCanonical);
		const bAfterCopyEdit = b.coordinator.current().canonicalJson;

		// Refining A's original reaches neither B's copy nor the item.
		const aSized = await a.coordinator.accept(
			sceneIntent({
				kind: 'set-form-size',
				operationId: 'op-original-size',
				intentRevision: now(a.coordinator).intentRevision,
				contentId: now(a.coordinator).contentId,
				entityId: 'entity-saved',
				payload: { entityId: 'entity-saved', scale: [0.5, 0.5, 0.5] }
			})
		);
		expect(aSized.kind).toBe('accepted');
		expect(acceptedForm(a.coordinator, 'entity-saved').form.scale).toEqual([0.5, 0.5, 0.5]);
		expect(await formLibraryContentId(item)).toBe(contentId);
		expect(b.coordinator.current().canonicalJson).toBe(bAfterCopyEdit);

		// A second insertion is a second independent entity, not a shared instance.
		const secondInserted = await insert(b.coordinator, {
			entityId: 'entity-copy-two',
			item,
			worldXZ: [5, 4],
			yaw: -0.4,
			contactMinY,
			operationId: 'op-insert-copy-two'
		});
		expect(secondInserted.kind).toBe('accepted');
		const firstCopyBeforeSecondEdit = acceptedForm(b.coordinator, 'entity-copy').form;
		const secondCopy = acceptedForm(b.coordinator, 'entity-copy-two');
		expect(secondCopy.form).toEqual(item.form);
		expect(secondCopy.id).not.toBe('entity-copy');
		const secondSized = await b.coordinator.accept(
			sceneIntent({
				kind: 'set-form-size',
				operationId: 'op-second-size',
				intentRevision: now(b.coordinator).intentRevision,
				contentId: now(b.coordinator).contentId,
				entityId: 'entity-copy-two',
				payload: { entityId: 'entity-copy-two', scale: [1, 2.25, 1] }
			})
		);
		expect(secondSized.kind).toBe('accepted');
		expect(acceptedForm(b.coordinator, 'entity-copy').form).toEqual(firstCopyBeforeSecondEdit);
		expect(acceptedForm(b.coordinator, 'entity-copy-two').form.scale).toEqual([1, 2.25, 1]);
		expect(acceptedForm(a.coordinator, 'entity-saved').form.scale).toEqual([0.5, 0.5, 0.5]);
	});

	it('saves and cold-reopens B exactly, keeps A unchanged and never stores the item as project data', async () => {
		const { a, item, contentId } = await savedFormA();
		const b = await boot({ projectId: 'project-my-objects-c' });
		const contactMinY = evaluateSceneForm(item.form).contactMinY;
		const inserted = await insert(b.coordinator, {
			entityId: 'entity-copy',
			item,
			worldXZ: [2, 2],
			yaw: 0.6,
			contactMinY,
			operationId: 'op-reopen-insert'
		});
		expect(inserted.kind).toBe('accepted');
		const yawed = await b.coordinator.accept(
			sceneIntent({
				kind: 'set-yaw',
				operationId: 'op-reopen-yaw',
				intentRevision: now(b.coordinator).intentRevision,
				contentId: now(b.coordinator).contentId,
				entityId: 'entity-copy',
				payload: {
					entityId: 'entity-copy',
					yaw: 1.1,
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' }
				}
			})
		);
		expect(yawed.kind).toBe('accepted');
		const savedB = b.coordinator.current();
		const liveCopy = acceptedForm(b.coordinator, 'entity-copy');
		expect(savedB.canonicalJson).not.toContain(contentId);

		const reopenedB = await admitUnitProject(JSON.parse(savedB.canonicalJson) as ProjectEnvelope, {
			projectId: savedB.revision.projectId,
			revisionId: 'revision-reopen-b'
		});
		expect(reopenedB.kind).toBe('admitted');
		if (reopenedB.kind !== 'admitted') return;
		expect(reopenedB.canonicalJson).toBe(savedB.canonicalJson);
		const reopenedCopy = reopenedB.project.units.scene.data.entities.find(
			(entity) => entity.id === 'entity-copy'
		);
		expect(reopenedCopy?.kind).toBe('form');
		if (reopenedCopy?.kind !== 'form') return;
		expect(reopenedCopy.form).toEqual(liveCopy.form);
		expect(formMeshDigest(evaluateSceneForm(reopenedCopy.form))).toBe(
			formMeshDigest(evaluateSceneForm(liveCopy.form))
		);
		// The copy is plain Scene source: no item id, content id, resource, lock
		// entry or reference travels with it, so removing the item cannot reach it.
		expect(Object.keys(reopenedCopy).sort()).toEqual(
			[
				'castShadow',
				'form',
				'id',
				'kind',
				'materialId',
				'name',
				'position',
				'receiveShadow',
				'rotation'
			].sort()
		);
		expect(JSON.stringify(reopenedB.project)).not.toContain(contentId);
		expect(JSON.stringify(reopenedB.project)).not.toContain('library');

		// A still reopens byte-identically.
		const savedA = a.coordinator.current();
		const reopenedA = await admitUnitProject(JSON.parse(savedA.canonicalJson) as ProjectEnvelope, {
			projectId: savedA.revision.projectId,
			revisionId: 'revision-reopen-a'
		});
		expect(reopenedA.kind).toBe('admitted');
		if (reopenedA.kind !== 'admitted') return;
		expect(reopenedA.canonicalJson).toBe(savedA.canonicalJson);
		expect(reopenedA.project.units.scene.data.entities.find((entity) => entity.id === 'entity-saved')).toEqual(
			savedA.source.units.scene.data.entities.find((entity) => entity.id === 'entity-saved')
		);

		// Removal needs no project-side step: the copy holds its own source and no
		// item identity or reference, so deleting the item cannot reach it. The
		// DB-backed API test owns the storage side of that journey.
		expect(Object.keys(reopenedCopy)).not.toContain('libraryItemId');
		expect(JSON.stringify(reopenedCopy)).not.toContain('sha256-');
	});

	it('refuses a mismatched contact, a wrong format, bad source, a target, a duplicate id and a stale request without writing', async () => {
		const { item } = await savedFormA();
		const b = await boot({ projectId: 'project-my-objects-d' });
		const state = now(b.coordinator);
		const before = b.coordinator.current();
		const historyBefore = b.coordinator.history();
		const installsBefore = b.coordinator.installs();
		const contactMinY = evaluateSceneForm(item.form).contactMinY;
		let attemptIndex = 0;

		const attempt = async (input: {
			readonly item: unknown;
			readonly contactMinY?: number;
			readonly entityId?: string;
			readonly targets?: AuthoringIntent['targets'];
			readonly revision?: { projectId: string; revisionId: string };
		}) =>
			b.coordinator.accept(
				placeFormCopyIntent({
					intentRevision: input.revision ?? state.intentRevision,
					operationId: `op-refuse-${++attemptIndex}`,
					entityId: input.entityId ?? 'entity-refused',
					targets: input.targets,
					payload: {
						item: input.item,
						worldXZ: [3, 2],
						yaw: 0,
						contactMinY: input.contactMinY ?? contactMinY
					}
				})
			);

		expect((await attempt({ item, contactMinY: contactMinY + 0.25 })).kind).toBe('rejected');
		expect((await attempt({ item: { ...item, formatVersion: 2 } })).kind).toBe('rejected');
		expect(
			(
				await attempt({
					item: { ...item, form: { ...item.form, generator: { ...item.form.generator, extent: 0 } } }
				})
			).kind
		).toBe('rejected');
		expect(
			(await attempt({ item, targets: [entityTarget(state.contentId, 'entity-a')] })).kind
		).toBe('rejected');
		expect((await attempt({ item, entityId: 'entity-a' })).kind).toBe('rejected');
		expect(
			(
				await attempt({
					item,
					revision: { projectId: state.intentRevision.projectId, revisionId: 'revision-stale' }
				})
			).kind
		).toBe('rejected');

		expect(b.coordinator.current()).toEqual(before);
		expect(b.coordinator.history()).toEqual(historyBefore);
		expect(b.coordinator.installs()).toBe(installsBefore);
	});
});
