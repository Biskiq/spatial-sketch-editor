/**
 * T2.P01.S04 — the bounded composition loop.
 *
 * Two halves through public seams only:
 *
 * 1. **Session** (`createSceneSession`): uniform Resize previews and commits the
 *    retained planner's own contact-resolved Y; non-finite/zero/negative and
 *    no-op scales are refused; duplicate captures its new id and delete removes
 *    exactly one entity.
 * 2. **Journey**: the same commands are installed through the one F.4 host and
 *    one history stack, then round-trip through canonical source JSON.
 *
 * No test here writes Layout: every accepted intent is a Scene operation.
 */
import { describe, expect, it } from 'vitest';
import {
	admitCurrentSource,
	createEmptyWallFirstProject,
	parseProjectJson,
	serializeProject,
	type AuthoringIntent,
	type ProjectDocument,
	type SceneEntity,
	type Vec3
} from '@portfolio/project-model';
import { planWallChain } from '@portfolio/layout-core';
import { MUSEUM_SCENE_VALIDATION_OPTIONS } from '$lib/content/scene-validation';

import {
	createSceneSession,
	localContactMinY,
	sceneEntityReference,
	sceneReadingKey,
	sceneSurfaceFor,
	type ScenePlacementSession,
	type SceneWritePort
} from '$lib/authoring/adapters/scene/placement';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { currentStageSource } from '$lib/authoring/stage/current-stage-source';

const ENTITY_ID = 'entity-composition-box';
const PROJECT_ID = 'project-composition-loop';
const BASELINE: Vec3 = [2, 0.5, 2];
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

function supportedProject(entities: readonly SceneEntity[]): ProjectDocument {
	const base = createEmptyWallFirstProject({ id: PROJECT_ID, name: 'Composition loop' });
	const planned = planWallChain({
		baseline: base.layout,
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		role: 'boundary'
	});
	if (planned.kind !== 'success') throw new Error('the wall fixture was refused');
	return { ...base, layout: planned.document, scene: { ...base.scene, entities: [...entities] } };
}

function boxEntity(id = ENTITY_ID, position: Vec3 = BASELINE): SceneEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: 'Block',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0]
	};
}

type TestPort = SceneWritePort & { readonly intents: AuthoringIntent[]; readonly releases: () => number };

function writePort(): TestPort {
	const intents: AuthoringIntent[] = [];
	let released = 0;
	return {
		intents,
		async accept(intent) {
			intents.push(intent);
			return { kind: 'installed' };
		},
		acceptedRevision: () => ({ revisionId: `revision-${intents.length}` }),
		acquireGesture(request) {
			return {
				kind: 'granted',
				lease: {
					owner: request.owner,
					evaluationId: request.evaluationId,
					acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-0' },
					policy: request.policy,
					token: { sessionEpoch: 'session-compose', epoch: 0 },
					active: true,
					release() {
						released += 1;
					}
				}
			};
		},
		releases: () => released
	};
}

async function sessionFor(
	entities: readonly SceneEntity[]
): Promise<{ session: ScenePlacementSession; port: TestPort }> {
	const project = supportedProject(entities);
	const admitted = await admitCurrentSource(project, {
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`the fixture was not admitted: ${admitted.kind}`);
	let sequence = 0;
	const port = writePort();
	const session = createSceneSession({
		snapshot: {
			projectId: PROJECT_ID,
			contentRevision: admitted.snapshot.sourceContentId,
			source: admitted.snapshot.domain.source,
			compileGeneration: 'generation-1',
			evaluationId: 'evaluation-1'
		},
		port,
		mintOperationId: () => `operation-${(sequence += 1)}`
	});
	return { session, port };
}

describe('Scene Resize — one planner, one contact result', () => {
	it('previews the planner re-seat and commits that exact scale and Y', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		expect(session.beginResize(ENTITY_ID)).toEqual({ kind: 'idle' });
		expect(session.armed()).toBe('resize');

		const preview = session.previewResize(2);
		expect(preview.kind).toBe('candidate');
		if (preview.kind !== 'candidate') return;
		expect(preview.candidate.kind).toBe('resize');
		expect(preview.candidate.scale).toBe(2);
		// support 0 m, contact -0.5 m, scale 2 → Y 1 m; X/Z and yaw preserved.
		expect(preview.candidate.position[0]).toBe(BASELINE[0]);
		expect(preview.candidate.position[1]).toBeCloseTo(1, 9);
		expect(preview.candidate.position[2]).toBe(BASELINE[2]);
		expect(preview.candidate.yaw).toBe(0);

		await expect(session.commitResize()).resolves.toEqual({ kind: 'committed' });
		expect(port.intents).toHaveLength(1);
		const intent = port.intents[0]!;
		expect(intent.kind).toBe('resize-on-floor');
		expect(intent.targets).toHaveLength(1);
		expect(intent.targets[0]).toMatchObject({ domain: 'scene', subject: { kind: 'entity', id: ENTITY_ID } });
		expect(intent.payload).toEqual({ entityId: ENTITY_ID, scale: 2, contactMinY: -0.5 });
		expect(intent.allocatedIds).toEqual([]);
	});

	it('refuses non-finite, zero, negative and no-op scales without a candidate', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		session.beginResize(ENTITY_ID);
		expect(session.previewResize(Number.POSITIVE_INFINITY)).toMatchObject({ kind: 'invalid', code: 'non-finite' });
		expect(session.previewResize(0)).toMatchObject({ kind: 'invalid', code: 'malformed' });
		expect(session.previewResize(-2)).toMatchObject({ kind: 'invalid', code: 'malformed' });
		expect(session.setResizeEntry('   ')).toMatchObject({ kind: 'invalid', code: 'blank' });
		// The planner owns the no-op rule; the session reports its own refusal.
		expect(session.previewResize(1)).toMatchObject({ kind: 'refused', code: 'no_op' });
		expect(session.candidate()).toBeNull();
		await expect(session.commitResize()).resolves.toMatchObject({ kind: 'refused', code: 'no-candidate' });
		expect(port.intents).toEqual([]);
		// Every refused attempt released its lease through the one commit path.
		expect(port.releases()).toBe(1);
	});

	it('refuses a curved/unsupported scale on a model with no contact metadata', async () => {
		const model: SceneEntity = {
			kind: 'model',
			id: 'entity-model',
			name: 'Piano',
			assetId: 'paris-grand-piano',
			fallback: 'piano',
			position: [2, 0, 2],
			rotation: [0, 0, 0]
		};
		expect(localContactMinY(model)).toBeNull();
		const { session, port } = await sessionFor([model]);
		session.beginResize('entity-model');
		expect(session.previewResize(2)).toMatchObject({ kind: 'refused', code: 'missing-contact-metadata' });
		await expect(session.commitResize()).resolves.toMatchObject({ kind: 'refused', code: 'no-candidate' });
		expect(port.intents).toEqual([]);
	});
});

describe('Scene duplicate and delete — captured identity, exact subject', () => {
	it('captures one new id and targets the source entity for duplicate', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		await expect(session.duplicate(ENTITY_ID)).resolves.toEqual({ kind: 'committed' });
		expect(port.intents).toHaveLength(1);
		const intent = port.intents[0]!;
		expect(intent.kind).toBe('duplicate-one');
		expect(intent.targets).toHaveLength(1);
		expect(intent.targets[0]).toMatchObject({ domain: 'scene', subject: { kind: 'entity', id: ENTITY_ID } });
		expect(intent.allocatedIds).toHaveLength(1);
		const allocated = intent.allocatedIds[0]!;
		expect(allocated.kind).toBe('scene-entity');
		expect(allocated.id).not.toBe(ENTITY_ID);
		expect(intent.payload).toEqual({ entityId: ENTITY_ID, contactMinY: -0.5 });
	});

	it('deletes exactly the named entity with no allocation and no extra target', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		await expect(session.remove(ENTITY_ID)).resolves.toEqual({ kind: 'committed' });
		expect(port.intents).toHaveLength(1);
		const intent = port.intents[0]!;
		expect(intent.kind).toBe('delete-one');
		expect(intent.targets).toHaveLength(1);
		expect(intent.targets[0]).toMatchObject({ domain: 'scene', subject: { kind: 'entity', id: ENTITY_ID } });
		expect(intent.payload).toEqual({ entityId: ENTITY_ID });
		expect(intent.allocatedIds).toEqual([]);
	});

	it('refuses an unknown duplicate/delete target without an intent', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		await expect(session.duplicate('entity-missing')).resolves.toMatchObject({
			kind: 'refused',
			code: 'missing-target'
		});
		await expect(session.remove('entity-missing')).resolves.toMatchObject({
			kind: 'refused',
			code: 'missing-target'
		});
		expect(port.intents).toEqual([]);
	});
});

describe('Scene composition journey — one host, one history stack', () => {
	async function mounted() {
		const project = supportedProject([boxEntity()]);
		const admitted = await admitSource(project, {
			sessionEpoch: 'session-compose-host',
			acceptedRevision: { projectId: project.id, revisionId: 'revision-boot' }
		});
		if (admitted.kind !== 'admitted') throw new Error('the composition fixture was not admitted');
		const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
		stageSession.replace(admitted.snapshot);
		const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession });
		const evaluated = facade.camera.evaluate(RECT, 1);
		if (evaluated.kind !== 'evaluated') throw new Error('the composition fixture did not evaluate');
		facade.acquireInspection('exclusive');
		const host = createStageAcceptanceHost({
			facade,
			sessionEpoch: admitted.snapshot.sessionEpoch,
			baseline: {
				revision: admitted.snapshot.acceptedRevision,
				source: project,
				canonicalJson: admitted.snapshot.canonicalJson,
				sourceContentId: admitted.snapshot.sourceContentId
			},
			planners: []
		});
		mountStageAdapter(facade, host, createAdapter);
		const reference = sceneEntityReference(ENTITY_ID, facade.snapshot().sourceContentId);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		return { facade, host };
	}

	function openCompose(facade: ReturnType<typeof createStageFacade>) {
		const opened = facade.openContributedTask('scene-compose', 'scene');
		if (opened.kind !== 'opened') throw new Error(`Compose was not opened: ${opened.message}`);
		const evaluation = facade.evaluation();
		if (evaluation === null) throw new Error('the composition fixture has no evaluation');
		const surface = sceneSurfaceFor(facade.snapshot(), evaluation);
		if (surface === null) throw new Error('Compose published no surface');
		return { ...surface, session: surface.session, reading: sceneReadingKey(evaluation) };
	}

	async function eventually(predicate: () => boolean): Promise<void> {
		for (let attempt = 0; attempt < 60; attempt += 1) {
			if (predicate()) return;
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		throw new Error('the composition fixture did not settle');
	}

	function entityOf(facade: ReturnType<typeof createStageFacade>, id: string) {
		return facade.snapshot().domain.scene.entities.find((entity) => entity.id === id) ?? null;
	}

	it('resizes, undoes, redoes, duplicates and deletes through the accepted host', async () => {
		const { facade, host } = await mounted();
		expect(host.history().depth).toBe(1);

		const resized = openCompose(facade);
		// Compose is a typed command surface: a Stage press is navigation, never an
		// accidental transform of the selected entity.
		expect(
			facade.pointerIntent({ phase: 'down', css: [100, 100], evaluationId: facade.evaluationId()! }).claimed
		).toBe(false);
		resized.session.beginResize(ENTITY_ID);
		expect(resized.session.previewResize(2).kind).toBe('candidate');
		await expect(resized.session.commitResize()).resolves.toEqual({ kind: 'committed' });
		await eventually(() => entityOf(facade, ENTITY_ID)?.scale === 2);
		expect(entityOf(facade, ENTITY_ID)).toMatchObject({ position: [2, 1, 2], scale: 2 });
		expect(host.history().depth).toBe(2);

		await host.undo();
		expect(entityOf(facade, ENTITY_ID)?.scale ?? 1).toBe(1);
		await host.redo();
		expect(entityOf(facade, ENTITY_ID)?.scale).toBe(2);

		// An accepted install ends the live evaluation; the route's next frame
		// rebuilds the pending adapter binding. The test supplies that frame
		// explicitly instead of assuming a mounted renderer.
		const reframe = facade.camera.evaluate(RECT, 2);
		expect(reframe.kind).toBe('evaluated');
		const duplicated = openCompose(facade);
		await expect(duplicated.session.duplicate(ENTITY_ID)).resolves.toEqual({ kind: 'committed' });
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);
		const primary = facade.selectionState().primary;
		expect(primary?.domain).toBe('scene');
		expect(primary?.subject.kind).toBe('entity');
		if (primary === null || primary.subject.kind !== 'entity') return;
		const copyId = primary.subject.id;
		expect(copyId).not.toBe(ENTITY_ID);
		// The copy is the source's exact pose plus +0.5 m world X/Z, same scale.
		const copy = entityOf(facade, copyId)!;
		expect(copy.position[0]).toBeCloseTo(2.5, 9);
		expect(copy.position[1]).toBeCloseTo(1, 9);
		expect(copy.position[2]).toBeCloseTo(2.5, 9);
		expect(copy.scale).toBe(2);

		const depthAfterDuplicate = host.history().depth;
		// Duplicate is another accepted install; supply the next frame before the
		// pending binding can expose Compose again.
		expect(facade.camera.evaluate(RECT, 3).kind).toBe('evaluated');
		const deleted = openCompose(facade);
		await expect(deleted.session.remove(copyId)).resolves.toEqual({ kind: 'committed' });
		await eventually(() => facade.snapshot().domain.scene.entities.length === 1);
		expect(host.history().depth).toBe(depthAfterDuplicate + 1);
		// The retired subject cannot stay selected.
		expect(facade.selectionState().primary).toBeNull();
	});

	it('round-trips canonical source JSON and starts a fresh history baseline', async () => {
		const { facade } = await mounted();
		const compose = openCompose(facade);
		compose.session.beginResize(ENTITY_ID);
		compose.session.previewResize(2);
		await compose.session.commitResize();
		await eventually(() => entityOf(facade, ENTITY_ID)?.scale === 2);

		const options = { scene: MUSEUM_SCENE_VALIDATION_OPTIONS };
		const json = serializeProject(currentStageSource(facade.snapshot()).source, options);
		const parsed = parseProjectJson(json, options);
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.canonicalJson).toBe(json);
		const reloadedEntity = parsed.project.scene.entities.find((entity) => entity.id === ENTITY_ID);
		expect(reloadedEntity).toMatchObject({ position: [2, 1, 2], scale: 2 });

		// Reload is a new session and history baseline, not a synthetic source edit.
		const admitted = await admitSource(parsed.project, {
			sessionEpoch: 'session-reloaded',
			acceptedRevision: { projectId: parsed.project.id, revisionId: 'revision-reloaded' }
		});
		expect(admitted.kind).toBe('admitted');
		if (admitted.kind !== 'admitted') return;
		const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
		stageSession.replace(admitted.snapshot);
		const reloadedFacade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession });
		const host = createStageAcceptanceHost({
			facade: reloadedFacade,
			sessionEpoch: admitted.snapshot.sessionEpoch,
			baseline: {
				revision: admitted.snapshot.acceptedRevision,
				source: parsed.project,
				canonicalJson: admitted.snapshot.canonicalJson,
				sourceContentId: admitted.snapshot.sourceContentId
			},
			planners: []
		});
		expect(host.history()).toMatchObject({ depth: 1, canUndo: false, canRedo: false });
		expect(reloadedFacade.snapshot().domain.scene.entities[0]).toMatchObject({
			position: [2, 1, 2],
			scale: 2
		});
	});
});
