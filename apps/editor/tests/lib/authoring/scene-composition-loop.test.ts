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
	type AuthoringIntent,
	type SceneEntity,
	type Vec3
} from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';

import {
	createSceneSession,
	localContactMinY,
	sceneComposeSupport,
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
import { bootFromSourceJson } from '$lib/authoring/stage/boot-state';
import { stageEnvelope, stageLayout, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { admitUnitProject, createUnitProject } from './__fixtures__/unit-envelope-fixtures';

const ENTITY_ID = 'entity-composition-box';
const PROJECT_ID = 'project-composition-loop';
const BASELINE: Vec3 = [2, 0.5, 2];
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

function supportedProject(entities: readonly SceneEntity[]): Promise<ProjectEnvelope> {
	const planned = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
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
	return createUnitProject({
		id: PROJECT_ID,
		name: 'Composition loop',
		layout: planned.document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [...entities],
			navigationNodes: [],
			connections: []
		}
	});
}

const LIGHT_ID = 'entity-composition-light';

function lightEntity(id = LIGHT_ID, position: Vec3 = [3, 2.4, 3]): SceneEntity {
	return {
		kind: 'light',
		light: 'point',
		id,
		name: 'Fill light',
		color: '#ffffff',
		intensity: 1,
		castShadow: false,
		position,
		rotation: [0, 0, 0]
	};
}

const PLANE_ID = 'entity-composition-plane';
const TILTED_ID = 'entity-composition-tilted';

function planeEntity(): SceneEntity {
	return {
		kind: 'primitive',
		primitive: 'plane',
		id: PLANE_ID,
		name: 'Screen',
		dimensions: { width: 2, height: 2 },
		materialId: 'plaster-warm',
		castShadow: false,
		receiveShadow: true,
		position: [2, 1, 2],
		rotation: [0, 0, 0]
	};
}

function tiltedBox(): SceneEntity {
	return { ...boxEntity(TILTED_ID), rotation: [0.3, 0, 0] };
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
	const project = await supportedProject(entities);
	const admitted = await admitUnitProject(project, {
		projectId: PROJECT_ID,
		revisionId: 'revision-boot'
	});
	if (admitted.kind !== 'admitted') throw new Error(`the fixture was not admitted: ${admitted.kind}`);
	let sequence = 0;
	const port = writePort();
	const session = createSceneSession({
		snapshot: {
			projectId: PROJECT_ID,
			contentRevision: admitted.snapshot.domain.unitRevisions.scene,
			source: { layout: stageLayout(admitted.snapshot), scene: stageScene(admitted.snapshot) },
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

	it('refuses a light with no verified contact before taking a gesture lease', async () => {
		const light = lightEntity();
		expect(sceneComposeSupport(light)).toEqual({
			resize: false,
			duplicate: false,
			code: 'unsupported-transform',
			reason: expect.stringContaining('light')
		});
		const { session, port } = await sessionFor([light]);
		// No contact means no candidate: the refusal happens before the lease, so
		// Undo is never blocked for a proposal that cannot exist.
		expect(session.beginResize(light.id)).toMatchObject({
			kind: 'refused',
			code: 'unsupported-transform'
		});
		expect(port.releases()).toBe(0);
		await expect(session.duplicate(light.id)).resolves.toMatchObject({
			kind: 'refused',
			code: 'unsupported-transform'
		});
		expect(port.intents).toEqual([]);
	});

	it('refuses a vertical plane and a tilted primitive exactly as the planner does', async () => {
		// The planner's own gate rejects a vertical plane (no honest footprint) and a
		// tilted primitive (not upright). Compose must not enable either command.
		const plane = planeEntity();
		expect(sceneComposeSupport(plane)).toMatchObject({
			resize: false,
			duplicate: false,
			code: 'unsupported-transform'
		});
		expect(sceneComposeSupport(tiltedBox())).toMatchObject({
			resize: false,
			duplicate: false,
			code: 'unsupported-transform'
		});
		const { session, port } = await sessionFor([plane, tiltedBox()]);
		expect(session.beginResize(PLANE_ID)).toMatchObject({
			kind: 'refused',
			code: 'unsupported-transform'
		});
		expect(session.beginResize(TILTED_ID)).toMatchObject({
			kind: 'refused',
			code: 'unsupported-transform'
		});
		await expect(session.duplicate(PLANE_ID)).resolves.toMatchObject({
			kind: 'refused',
			code: 'unsupported-transform'
		});
		await expect(session.duplicate(TILTED_ID)).resolves.toMatchObject({
			kind: 'refused',
			code: 'unsupported-transform'
		});
		expect(port.releases()).toBe(0);
		expect(port.intents).toEqual([]);
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
		// The refusal is the begin: a model has no contact to re-seat, so no
		// proposal (and no gesture lease) is ever opened for it.
		expect(session.beginResize('entity-model')).toMatchObject({
			kind: 'refused',
			code: 'missing-contact-metadata'
		});
		expect(session.armed()).toBe('select');
		expect(port.releases()).toBe(0);
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
	async function mounted(entities: readonly SceneEntity[] = [boxEntity()]) {
		const project = await supportedProject(entities);
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
		const reference = sceneEntityReference(ENTITY_ID, facade.snapshot().domain.unitRevisions.scene);
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

	it('advertises Scale and Compose only for a subject the planner can resize', async () => {
		const { facade } = await mounted([boxEntity(), lightEntity(), planeEntity(), tiltedBox()]);
		const boxFacts = facade.cardFacts({ sourceId: ENTITY_ID, sourceKind: 'entity', ref: null });
		expect(boxFacts.map((fact) => fact.label)).toContain('Scale');
		// A light, a vertical plane and a tilted primitive advertise no Scale row and
		// no Resize/Duplicate: the panel's disabled controls read the same predicate.
		for (const id of [LIGHT_ID, PLANE_ID, TILTED_ID]) {
			const facts = facade.cardFacts({ sourceId: id, sourceKind: 'entity', ref: null });
			expect(facts.map((fact) => fact.label)).not.toContain('Scale');
		}
		expect(sceneComposeSupport(lightEntity()).resize).toBe(false);
		expect(sceneComposeSupport(planeEntity()).resize).toBe(false);
	});

	it('resizes, undoes, redoes, duplicates and deletes through the accepted host', async () => {
		const { facade, host } = await mounted();
		expect(host.history().depth).toBe(1);
		const beforeResizeJson = facade.snapshot().canonicalJson;

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
		const resizedJson = facade.snapshot().canonicalJson;

		await host.undo();
		expect(entityOf(facade, ENTITY_ID)?.scale ?? 1).toBe(1);
		// The whole canonical source returns, not just the field the test read.
		await eventually(() => facade.snapshot().canonicalJson === beforeResizeJson);
		expect(facade.snapshot().canonicalJson).toBe(beforeResizeJson);
		await host.redo();
		expect(entityOf(facade, ENTITY_ID)?.scale).toBe(2);
		await eventually(() => facade.snapshot().canonicalJson === resizedJson);
		expect(facade.snapshot().canonicalJson).toBe(resizedJson);

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

	it('reloads the downloaded canonical JSON through the route open path and refuses an invalid source', async () => {
		const { facade } = await mounted();
		const compose = openCompose(facade);
		compose.session.beginResize(ENTITY_ID);
		compose.session.previewResize(2);
		await compose.session.commitResize();
		await eventually(() => entityOf(facade, ENTITY_ID)?.scale === 2);

		// Download writes `snapshot.canonicalJson`; Open/Reload parse exactly those
		// bytes through `bootFromSourceJson` (the route's one open path), not a
		// second serialization the test happened to produce.
		const json = facade.snapshot().canonicalJson;
		const reloaded = await bootFromSourceJson(json, PROJECT_ID, {
			sessionEpoch: 'session-reloaded',
			acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-reloaded' }
		});
		expect(reloaded.status).toBe('ready');
		if (reloaded.status !== 'ready') return;
		const reloadedEntity = reloaded.snapshot.domain.scene.entities.find((entity) => entity.id === ENTITY_ID);
		expect(reloadedEntity).toMatchObject({ position: [2, 1, 2], scale: 2 });
		expect(reloaded.snapshot.canonicalJson).toBe(json);

		// Reload is a new session and history baseline, not a synthetic source edit.
		const stageSession = createStageSession({ sessionEpoch: reloaded.snapshot.sessionEpoch });
		stageSession.replace(reloaded.snapshot);
		const reloadedFacade = createStageFacade({ snapshot: reloaded.snapshot, session: stageSession });
		const host = createStageAcceptanceHost({
			facade: reloadedFacade,
			sessionEpoch: reloaded.snapshot.sessionEpoch,
			baseline: {
				revision: reloaded.snapshot.acceptedRevision,
				source: stageEnvelope(reloaded.snapshot),
				canonicalJson: reloaded.snapshot.canonicalJson,
				sourceContentId: reloaded.snapshot.sourceContentId
			},
			planners: []
		});
		expect(host.history()).toMatchObject({ depth: 1, canUndo: false, canRedo: false });
		expect(reloadedFacade.snapshot().domain.scene.entities[0]).toMatchObject({
			position: [2, 1, 2],
			scale: 2
		});

		// A source that does not admit is a refused state, never a silent empty
		// Stage and never a replaced baseline.
		const refused = await bootFromSourceJson('{"formatVersion": 1}', PROJECT_ID, {
			sessionEpoch: 'session-invalid',
			acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-invalid' }
		});
		expect(refused.status).toBe('refused');
	});
});
