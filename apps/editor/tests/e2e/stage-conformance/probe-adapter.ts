import { currentStageSource, currentStagePlanner } from '$lib/authoring/stage/current-stage-source';
/** TEST-ONLY sentinel: STAGE_BROWSER_CONFORMANCE_WRITER. No production import. */
import { planExactWallHeight } from '@portfolio/layout-core';
import { CURRENT_SOURCE_KIND, CURRENT_SOURCE_VERSION, resolveReference, type DomainPlanner,
	type ProjectDocument, type AuthoringIntent, type ScenePrimitiveEntity,
	type SemanticReference } from '@portfolio/project-model';
import type { StageAdapterFactory, StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import type { StageTask, TaskResumeOutcome } from '$lib/authoring/stage/stage-session';
import ProbeInstrument from './ProbeInstrument.svelte';
import { publishProbe, recordSelectionEcho } from './probe-state';

const KIND = 'conformance-wall-height';
const SCENE_CREATE_KIND = 'conformance-scene-entity-create';
const SCENE_SHADOW_KIND = 'conformance-scene-entity-shadow';
/** The one Scene entity this probe creates; never a production identity. */
const ENTITY_ID = 'entity-conformance';

function sceneReference(contentRevision: string, entityId: string): SemanticReference {
	return { version: 1, domain: 'scene', subject: { kind: 'entity', id: entityId },
		revision: { kind: 'exact', contentRevision }, instancePath: [], location: { kind: 'project-root' },
		componentId: null, capabilityId: null };
}

const planner: DomainPlanner<ProjectDocument> = {
	id: KIND, kind: KIND,
	admission: { domain: 'layout', compound: false, units: false, resources: false },
	sourceKinds: [CURRENT_SOURCE_KIND], sourceVersions: [CURRENT_SOURCE_VERSION],
	prepare({ snapshot, intent }) {
		const wall = snapshot.domain.source.layout.walls[0];
		if (!wall) return { kind: 'rejected', code: 'missing-wall', message: 'Starter wall required', diagnostics: [] };
		const plan = planExactWallHeight(snapshot.domain.source.layout, wall.id, wall.height + 1);
		if (plan.kind === 'rejected') return { kind: 'rejected', code: plan.rejection.code, message: plan.rejection.message, diagnostics: [] };
		const reference = { version: 1 as const, domain: 'layout' as const, subject: { kind: 'wall', id: wall.id },
			revision: { kind: 'exact' as const, contentRevision: snapshot.sourceContentId },
			instancePath: [], location: { kind: 'layout-location' as const, levelId: snapshot.domain.source.layout.floor.id, structureInstancePath: [] }, componentId: null, capabilityId: null };
		return { kind: 'prepared', candidate: { operationId: intent.operationId,
			sourceKind: CURRENT_SOURCE_KIND, sourceVersion: CURRENT_SOURCE_VERSION,
			source: { ...snapshot.domain.source, layout: plan.document },
			changes: [{ kind: KIND, subjectIds: [wall.id], fields: ['height'] }],
			correspondence: [{ relation: 'preserved', before: reference, after: reference }], diagnostics: [] } };
	}
};

/**
 * Create one primitive Scene entity through F4.
 *
 * A Scene selection cannot be proved on the canonical starter enclosure, which has
 * no Scene content: the browser run has to author one subject into existence
 * through the same accepted path every production edit will take. Entity-level
 * only — Layout bytes and Camera-bearing navigation data are carried over.
 */
const createEntityPlanner: DomainPlanner<ProjectDocument> = {
	id: SCENE_CREATE_KIND, kind: SCENE_CREATE_KIND,
	admission: { domain: 'scene', compound: false, units: false, resources: false },
	sourceKinds: [CURRENT_SOURCE_KIND], sourceVersions: [CURRENT_SOURCE_VERSION],
	prepare({ snapshot, intent }) {
		const project = snapshot.domain.source;
		if (project.scene.entities.some((entity) => entity.id === ENTITY_ID)) {
			return { kind: 'rejected', code: 'entity-exists', message: `Scene entity "${ENTITY_ID}" already exists`, diagnostics: [] };
		}
		const entity: ScenePrimitiveEntity = {
			kind: 'primitive', id: ENTITY_ID, name: 'Conformance plinth', primitive: 'box',
			dimensions: { width: 1, height: 1, depth: 1 }, materialId: 'plaster-warm',
			castShadow: false, receiveShadow: false, position: [3.5, 0.5, -1], rotation: [0, 0, 0]
		};
		return { kind: 'prepared', candidate: { operationId: intent.operationId,
			sourceKind: CURRENT_SOURCE_KIND, sourceVersion: CURRENT_SOURCE_VERSION,
			source: { ...project, scene: { ...project.scene, entities: [...project.scene.entities, entity] } },
			changes: [{ kind: 'scene-entity-create', subjectIds: [ENTITY_ID], fields: ['entities'] }],
			correspondence: [{ relation: 'created', before: null, after: sceneReference(snapshot.sourceContentId, ENTITY_ID) }], diagnostics: [] } };
	}
};

/** Toggle one boolean Scene scalar on the created entity, correspondence preserved. */
const shadowPlanner: DomainPlanner<ProjectDocument> = {
	id: SCENE_SHADOW_KIND, kind: SCENE_SHADOW_KIND,
	admission: { domain: 'scene', compound: false, units: false, resources: false },
	sourceKinds: [CURRENT_SOURCE_KIND], sourceVersions: [CURRENT_SOURCE_VERSION],
	prepare({ snapshot, intent }) {
		const project = snapshot.domain.source;
		const index = project.scene.entities.findIndex((entity) => entity.id === ENTITY_ID);
		const entity = index < 0 ? undefined : project.scene.entities[index];
		if (entity === undefined || entity.kind !== 'primitive') {
			return { kind: 'rejected', code: 'missing-entity', message: `Scene entity "${ENTITY_ID}" must exist and be a primitive`, diagnostics: [] };
		}
		const entities = [...project.scene.entities];
		entities[index] = { ...entity, receiveShadow: !entity.receiveShadow };
		const reference = sceneReference(snapshot.sourceContentId, ENTITY_ID);
		return { kind: 'prepared', candidate: { operationId: intent.operationId,
			sourceKind: CURRENT_SOURCE_KIND, sourceVersion: CURRENT_SOURCE_VERSION,
			source: { ...project, scene: { ...project.scene, entities } },
			changes: [{ kind: 'scene-entity-scalar', subjectIds: [ENTITY_ID], fields: ['receiveShadow'] }],
			correspondence: [{ relation: 'preserved', before: reference, after: reference }], diagnostics: [] } };
	}
};

function target(contentRevision: string): SemanticReference {
	return sceneReference(contentRevision, ENTITY_ID);
}

export function heightIntent({ stage, authoring }: StageAdapterServices): AuthoringIntent {
	const snapshot = stage.snapshot();
	const wall = currentStageSource(snapshot).source.layout.walls[0]!;
	return { version: 1, kind: KIND, operationId: crypto.randomUUID(), expectedRevision: authoring.acceptedRevision(),
		targets: [{ version: 1, domain: 'layout', subject: { kind: 'wall', id: wall.id },
			revision: { kind: 'exact', contentRevision: snapshot.sourceContentId },
			instancePath: [], location: { kind: 'layout-location', levelId: currentStageSource(snapshot).source.layout.floor.id, structureInstancePath: [] }, componentId: null, capabilityId: null }],
		payload: {}, capturedInputs: [], allocatedIds: [] };
}

export function sceneCreateIntent({ stage, authoring }: StageAdapterServices): AuthoringIntent {
	const snapshot = stage.snapshot();
	return { version: 1, kind: SCENE_CREATE_KIND, operationId: crypto.randomUUID(),
		expectedRevision: authoring.acceptedRevision(), targets: [target(snapshot.sourceContentId)],
		payload: {}, capturedInputs: [], allocatedIds: [] };
}

export function sceneShadowIntent({ stage, authoring }: StageAdapterServices): AuthoringIntent {
	const snapshot = stage.snapshot();
	return { version: 1, kind: SCENE_SHADOW_KIND, operationId: crypto.randomUUID(),
		expectedRevision: authoring.acceptedRevision(), targets: [target(snapshot.sourceContentId)],
		payload: {}, capturedInputs: [], allocatedIds: [] };
}

/** Select the created entity through the public ordered/primary selection port. */
export function selectSceneEntity({ stage }: StageAdapterServices): string {
	const snapshot = stage.snapshot();
	const reference = target(snapshot.sourceContentId);
	const result = stage.setSelection({ ordered: [{ reference }], primary: reference });
	return result.kind === 'selected' ? 'selected' : `${result.kind}:${result.code}`;
}

export const createAdapter: StageAdapterFactory = (services) => {
	for (const registered of [currentStagePlanner(planner), currentStagePlanner(createEntityPlanner), currentStagePlanner(shadowPlanner)]) {
		if (services.authoring.registerPlanner(registered).kind !== 'registered') throw new Error('conformance planner refused');
	}
	return {
		id: 'stage-browser-conformance', requiredCapabilities: ['stage-instrument-v1'],
		bind({ snapshot }) {
			const source = currentStageSource(snapshot).source;
			const wall = source.layout.walls[0];
			const entity = source.scene.entities.find((candidate) => candidate.id === ENTITY_ID);
			const reference = entity ? target(snapshot.sourceContentId) : null;
			publishProbe({ entityId: entity?.id ?? null, receiveShadow: entity?.kind === 'primitive' ? entity.receiveShadow : null });
			return {
				tasks: [
					...(wall ? [{ id: 'conformance-height', taskKind: 'conformance-height', label: 'Conformance height' }] : []),
					...(reference ? [{
						id: 'conformance-scene', taskKind: 'conformance-scene', label: 'Conformance Scene',
						target: reference, configuration: { receiveShadow: entity?.kind === 'primitive' ? entity.receiveShadow : false },
						// Explicit Resume only: the configuration stays valid for the current content.
						revalidate: (task: StageTask, current: StageReadSnapshot): TaskResumeOutcome => {
							// The session hands the requalified target; resolving the bind-time
							// reference instead would only prove that a re-bind happened.
							if (resolveReference(task.target ?? reference, current.domain.references).kind !== 'resolved') {
								return { kind: 'refused', code: 'missing', message: 'The conformance entity no longer exists. Choose another target.' };
							}
							const configuration = task.configuration as { readonly receiveShadow?: unknown } | undefined;
							if (typeof configuration?.receiveShadow !== 'boolean') {
								return { kind: 'refused', code: 'invalid-configuration', message: 'Reconfigure the Scene task before resuming.' };
							}
							return { kind: 'resumed' };
						}
					}] : [])
				],
				findEntries: [
					...(wall ? [{ id: 'conformance-height', taskKind: 'conformance-height', label: 'Conformance height', railFamily: 'measure', capability: 'conformance' }] : []),
					...(reference ? [{ id: 'conformance-scene', taskKind: 'conformance-scene', label: 'Conformance Scene', railFamily: 'scene', capability: 'conformance' }] : [])
				],
				cardFacts: (subject) => subject.reference?.domain === 'scene' && subject.reference.subject.id === ENTITY_ID
					? [{ label: 'Canonical Scene entity', value: subject.reference.subject.id },
						{ label: 'Entity kind', value: entity?.kind ?? 'missing' },
						{ label: 'receiveShadow', value: String(entity?.kind === 'primitive' ? entity.receiveShadow : 'n/a') }]
					: [],
				// The echo the Stage delivered for the one canonical selection value.
				selectionChanged: (selection) => recordSelectionEcho(
					selection.ordered.map((entry) => entry.reference.subject.id),
					selection.primary?.subject.id ?? null
				),
				instrument: () => ({ summary: `STAGE_BROWSER_CONFORMANCE_WRITER: wall height ${wall?.height ?? 'n/a'} m`,
					facts: [{ label: 'Content', value: snapshot.sourceContentId },
						...(entity ? [{ label: 'Scene entity', value: entity.id }] : [])],
					view: { component: ProbeInstrument, services } })
			};
		}
	};
};
