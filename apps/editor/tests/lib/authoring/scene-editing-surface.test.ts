/**
 * T2.P01.S03 — the first coherent Scene editing surface.
 *
 * Two halves, both through public seams only:
 *
 * 1. **Session** (`createSceneSession`): arming is session state, preview and
 *    commit run the same planner with the same captured inputs, snap is explicit,
 *    one cancel path restores the accepted baseline, and typed entry is never
 *    coerced (blank is not zero).
 * 2. **Adapter** (`createAdapter`): the seven Scene planners register with the one
 *    F.4 host, and the Place/Arrange Find entries, tasks, Card facts and instrument
 *    reach the Stage through AM-5 without any shell edit.
 *
 * No test here writes Layout: every accepted intent is a Scene operation.
 */
import { describe, expect, it } from 'vitest';
import {
	type AuthoringIntent,
	type SceneDocument,
	type SceneEntity,
	type Vec3
} from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import type { ViewportEvaluation } from '@portfolio/camera-core';

import {
	createSceneSession,
	localContactMinY,
	publishSceneSurface,
	retireSceneSurface,
	sceneEntityReference,
	sceneReadingKey,
	sceneSurfaceFor,
	type ScenePlacementSession,
	type SceneWritePort
} from '$lib/authoring/adapters/scene/placement';
import { stageEnvelope, stageLayout, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { buildCurrentSourceFixture, FIXTURE_ENTITY_ID, FIXTURE_PROJECT_ID } from './__fixtures__/f4-current-source-fixtures';
import { admitUnitProject, createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const ENTITY_ID = 'entity-scene-box';
const PROJECT_ID = 'project-scene-editing';
const BASELINE: Vec3 = [2, 0.5, 2];
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

async function supportedProject(entities: readonly SceneEntity[]): Promise<ProjectEnvelope> {
	const planned = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		capture: freshCapture(),
		levelId: createEmptyWallFirstLayoutDocument().floor.id
	});
	if (planned.kind !== 'success') throw new Error('the wall fixture was refused');
	return createUnitProject({
		id: PROJECT_ID,
		name: 'Scene editing',
		layout: planned.document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [...entities], navigationNodes: [], connections: [] }
	});
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

type TestPort = SceneWritePort & {
	readonly intents: AuthoringIntent[];
	readonly releases: () => number;
};

function writePort(
	options: {
		readonly gesture?: 'granted' | 'held';
		readonly accept?: SceneWritePort['accept'];
	} = {}
): TestPort {
	const intents: AuthoringIntent[] = [];
	let released = 0;
	const port: TestPort = {
		intents,
		async accept(intent) {
			intents.push(intent);
			return options.accept === undefined ? { kind: 'installed' } : options.accept(intent);
		},
		acceptedRevision: () => ({ revisionId: `revision-${intents.length}` }),
		acquireGesture(request) {
			if (options.gesture === 'held') {
				return { kind: 'refused', code: 'gesture-held', owner: 'layout-transform' };
			}
			return {
				kind: 'granted',
				lease: {
					owner: request.owner,
					evaluationId: request.evaluationId,
					acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-0' },
					policy: request.policy,
					token: { sessionEpoch: 'session-scene', epoch: 0 },
					active: true,
					release() {
						released += 1;
					}
				}
			};
		},
		releases: () => released
	};
	return port;
}

async function sessionFor(
	entities: readonly SceneEntity[],
	port: TestPort = writePort()
): Promise<{ session: ScenePlacementSession; port: TestPort }> {
	const project = await supportedProject(entities);
	const admitted = await admitUnitProject(project, {
		projectId: PROJECT_ID,
		revisionId: 'revision-boot'
	});
	if (admitted.kind !== 'admitted') throw new Error(`the Scene fixture was not admitted: ${admitted.kind}`);
	let sequence = 0;
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

describe('Scene placement session', () => {
	it('arms and disarms without touching the document or history', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		expect(session.armed()).toBe('select');

		session.arm('move');
		expect(session.armed()).toBe('move');
		expect(port.intents).toEqual([]);
		expect(session.baseline()).toBeNull();

		session.arm('select');
		expect(port.intents).toEqual([]);
	});

	it('previews the exact pose the planner would commit and commits that same pose', async () => {
		const { session, port } = await sessionFor([boxEntity()]);

		expect(session.begin(ENTITY_ID)).toEqual({ kind: 'idle' });
		const preview = session.previewMove(3, 4);
		expect(preview.kind).toBe('candidate');
		if (preview.kind !== 'candidate') return;

		const committed = await session.commit();
		expect(committed).toEqual({ kind: 'committed' });
		expect(port.intents).toHaveLength(1);
		const [intent] = port.intents;
		expect(intent!.kind).toBe('move-horizontal');
		const payload = intent!.payload as { worldXZ: readonly [number, number]; contactMinY: number };
		expect(Math.abs(payload.worldXZ[0] - preview.candidate.worldXZ[0])).toBeLessThanOrEqual(1e-6);
		expect(Math.abs(payload.worldXZ[1] - preview.candidate.worldXZ[1])).toBeLessThanOrEqual(1e-6);
		expect(payload.contactMinY).toBe(-0.5);
		// The committed pose lifts the box to the floor: the preview's Y is final.
		expect(preview.candidate.position[1]).toBeCloseTo(0.5, 6);
	});

	it('applies snap only when the session option is set, and reports it', async () => {
		const { session } = await sessionFor([boxEntity()]);
		session.begin(ENTITY_ID);

		const unsnapped = session.previewMove(2.37, 2.62);
		expect(unsnapped.kind).toBe('candidate');
		if (unsnapped.kind !== 'candidate') return;
		expect(unsnapped.candidate.snappedStep).toBeNull();
		expect(unsnapped.candidate.worldXZ[0]).toBeCloseTo(2.37, 9);

		session.setSnapStep(0.5);
		const snapped = session.previewMove(2.37, 2.62);
		expect(snapped.kind).toBe('candidate');
		if (snapped.kind !== 'candidate') return;
		expect(snapped.candidate.snappedStep).toBe(0.5);
		expect(snapped.candidate.worldXZ).toEqual([2.5, 2.5]);
	});

	it('keeps exact typed values exact and never inherits the gesture snap step', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		session.begin(ENTITY_ID);
		session.setSnapStep(0.5);

		const outcome = session.setEntry('z', '2.123456789');
		expect(outcome.kind).toBe('candidate');
		if (outcome.kind !== 'candidate') return;
		expect(outcome.candidate.snappedStep).toBeNull();
		expect(outcome.candidate.worldXZ[1]).toBeCloseTo(2.123456789, 12);

		await session.commit();
		const payload = port.intents[0]!.payload as { worldXZ: readonly [number, number] };
		expect(payload.worldXZ[1]).toBeCloseTo(2.123456789, 12);
	});

	it('refuses blank and non-finite entry instead of coercing it to zero', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		session.begin(ENTITY_ID);

		const blank = session.setEntry('x', '   ');
		expect(blank).toMatchObject({ kind: 'invalid', code: 'blank' });
		const infinite = session.setEntry('z', 'Infinity');
		expect(infinite).toMatchObject({ kind: 'invalid', code: 'non-finite' });
		const malformed = session.previewMove(Number.NaN, 0);
		expect(malformed).toMatchObject({ kind: 'invalid', code: 'non-finite' });

		await expect(session.commit()).resolves.toMatchObject({ kind: 'refused', code: 'no-candidate' });
		expect(port.intents).toEqual([]);
	});

	it('withdraws a shown candidate when the next proposal is refused', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		session.begin(ENTITY_ID);

		// A valid pose is displayed, then the creator types a blank field. The old
		// pose must stop being committable: the instrument now shows no candidate.
		expect(session.previewMove(3, 4).kind).toBe('candidate');
		expect(session.setEntry('x', '   ')).toMatchObject({ kind: 'invalid', code: 'blank' });
		await expect(session.commit()).resolves.toMatchObject({ kind: 'refused', code: 'no-candidate' });
		expect(port.intents).toEqual([]);

		// An out-of-range proposal (non-finite) withdraws it the same way.
		expect(session.previewMove(3, 4).kind).toBe('candidate');
		expect(session.previewMove(Number.POSITIVE_INFINITY, 4)).toMatchObject({ kind: 'invalid' });
		await expect(session.commit()).resolves.toMatchObject({ kind: 'refused', code: 'no-candidate' });
		expect(port.intents).toEqual([]);
	});

	it('cancels once, restores the accepted baseline and disarms Place', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		session.arm('place');
		session.begin(ENTITY_ID);
		session.previewMove(5, 5);

		session.cancel();
		expect(port.releases()).toBe(1);
		expect(session.armed()).toBe('select');
		expect(session.baseline()).toEqual({ position: BASELINE, rotation: [0, 0, 0] });

		session.cancel();
		expect(port.releases()).toBe(1);
		expect(await session.commit()).toMatchObject({ kind: 'refused', code: 'no-candidate' });
		expect(port.intents).toEqual([]);
	});

	it('releases the lease when a commit is refused, invalid or throws', async () => {
		const refused = await sessionFor(
			[boxEntity()],
			writePort({
				accept: async () => ({ kind: 'refused', code: 'support-unresolved', message: 'No floor.' })
			})
		);
		refused.session.begin(ENTITY_ID);
		refused.session.previewMove(3, 4);
		await expect(refused.session.commit()).resolves.toMatchObject({
			kind: 'refused',
			code: 'support-unresolved'
		});
		// A refused commit is not a live proposal: the lease is gone and so is the
		// pose that could no longer be installed.
		expect(refused.port.releases()).toBe(1);
		expect(refused.session.candidate()).toBeNull();

		const thrown = await sessionFor(
			[boxEntity()],
			writePort({
				accept: async () => {
					throw new Error('the acceptance transport closed');
				}
			})
		);
		thrown.session.begin(ENTITY_ID);
		thrown.session.previewMove(3, 4);
		await expect(thrown.session.commit()).resolves.toEqual({
			kind: 'failed',
			code: 'accept-failed',
			message: 'the acceptance transport closed'
		});
		expect(thrown.port.releases()).toBe(1);
		expect(thrown.session.candidate()).toBeNull();

		const malformed = await sessionFor([boxEntity()]);
		malformed.session.begin(ENTITY_ID);
		malformed.session.previewMove(3, 4);
		malformed.session.setEntry('x', '  ');
		// The invalid entry withdrew the candidate, so the commit is refused before
		// any transport call; the lease must still not survive it.
		await expect(malformed.session.commit()).resolves.toMatchObject({ kind: 'refused', code: 'no-candidate' });
		expect(malformed.port.releases()).toBe(1);
	});

	it('refuses a second live gesture and a subject with no contact metadata', async () => {
		const held = await sessionFor([boxEntity()], writePort({ gesture: 'held' }));
		expect(held.session.begin(ENTITY_ID)).toMatchObject({ kind: 'refused', code: 'gesture-held' });

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
		const withModel = await sessionFor([model]);
		withModel.session.begin('entity-model');
		expect(withModel.session.previewMove(3, 3)).toMatchObject({
			kind: 'refused',
			code: 'missing-contact-metadata'
		});
	});

	it('builds the canonical Scene reference at the captured revision', () => {
		expect(sceneEntityReference('entity-1', 'content-7')).toEqual({
			version: 1,
			domain: 'scene',
			revision: { kind: 'exact', contentRevision: 'content-7' },
			subject: { kind: 'entity', id: 'entity-1' },
			instancePath: [],
			location: { kind: 'project-root' },
			componentId: null,
			capabilityId: null
		});
	});

	it('previews an armed placement, commits that exact candidate and stays armed', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		expect(session.beginPlace('box')).toEqual({ kind: 'idle' });
		expect(session.armed()).toBe('place');
		const preview = session.previewPlace('box', 3.25, 4.5, 0);
		expect(preview.kind).toBe('candidate');
		if (preview.kind !== 'candidate') return;
		expect(preview.candidate.kind).toBe('place');
		expect(preview.candidate.primitive).toBe('box');
		// The displayed Y is the contact-resolved pose, not the pointer elevation.
		expect(preview.candidate.position[1]).toBeCloseTo(0.5, 9);

		expect(await session.commitPlace()).toEqual({ kind: 'committed' });
		expect(port.intents).toHaveLength(1);
		const intent = port.intents[0]!;
		expect(intent.kind).toBe('place-object');
		const payload = intent.payload as { worldXZ: readonly [number, number] };
		expect(payload.worldXZ).toEqual([3.25, 4.5]);
		expect(session.placedEntityId()).not.toBeNull();
		// A success does not disarm Place; only Esc/Select does.
		expect(session.armed()).toBe('place');
		expect(session.candidate()).toBeNull();

		// A second placement in the same armed session works the same way.
		expect(session.beginPlace('cylinder')).toEqual({ kind: 'idle' });
		session.previewPlace('cylinder', 1, 1, 0);
		expect(await session.commitPlace()).toEqual({ kind: 'committed' });
		expect(port.intents).toHaveLength(2);
		expect(session.armed()).toBe('place');
	});

	it('withdraws an invalidated preview and keeps Place armed on interruption', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		session.beginPlace('box');
		expect(session.previewPlace('box', 3, 4, 0).kind).toBe('candidate');
		session.invalidatePreview();
		expect(session.candidate()).toBeNull();
		await expect(session.commitPlace()).resolves.toMatchObject({ kind: 'refused', code: 'no-candidate' });
		expect(port.intents).toEqual([]);

		// A pointer interruption ends the lease but does not disarm the tool.
		expect(session.beginPlace('box')).toEqual({ kind: 'idle' });
		session.previewPlace('box', 2, 2, 0);
		session.abortGesture();
		expect(session.candidate()).toBeNull();
		expect(session.armed()).toBe('place');
		expect(port.releases()).toBe(2);
		// Esc/Select is the disarm path.
		session.cancel();
		expect(session.armed()).toBe('select');
	});

	it('accepts and refuses a placement without writing Layout', async () => {
		const accepted = await sessionFor([boxEntity()]);
		expect(await accepted.session.place('box', 4, 3)).toEqual({ kind: 'committed' });
		expect(accepted.port.intents).toHaveLength(1);
		expect(accepted.port.intents[0]!.kind).toBe('place-object');
		expect(accepted.port.intents[0]!.targets).toEqual([]);

		const refused = await sessionFor(
			[boxEntity()],
			writePort({
				accept: async () => ({ kind: 'refused', code: 'support-unresolved', message: 'No floor.' })
			})
		);
		expect(await refused.session.place('box', 4, 3)).toMatchObject({
			kind: 'refused',
			code: 'support-unresolved'
		});
	});

	it('names the committing session to a completion listener carried across a replacement', async () => {
		// A reading change replaces the session without rebuilding the adapter
		// binding, so the instrument carries the adapter's one completion listener to
		// the replacement. The listener must be told which entity *that* session
		// installed; a listener that named a captured session reported `null` here.
		const first = await sessionFor([boxEntity()]);
		const second = await sessionFor([boxEntity()]);
		const reported: (string | null)[] = [];
		first.session.setPlacementCommittedListener((placedEntityId) => reported.push(placedEntityId));
		const carried = first.session.placementCommittedListener();
		expect(carried).not.toBeNull();
		// Carrying reads the listener without consuming it, then installs it on the
		// replacement exactly as `ensureSession` does.
		expect(first.session.placementCommittedListener()).not.toBeNull();
		second.session.setPlacementCommittedListener(carried);

		expect(await second.session.place('box', 3, 3)).toEqual({ kind: 'committed' });
		expect(reported).toEqual([second.session.placedEntityId()]);
		expect(reported[0]).not.toBeNull();
	});
});

describe('Scene adapter registration', () => {

	async function mounted(
		project?: ProjectEnvelope,
		rect: typeof RECT = RECT
	) {
		const source = project ?? (await buildCurrentSourceFixture()).project;
		const admitted = await admitSource(source, {
			sessionEpoch: 'session-scene-adapter',
			acceptedRevision: { projectId: source.id, revisionId: 'revision-boot' }
		});
		if (admitted.kind !== 'admitted') throw new Error('the adapter fixture was not admitted');
		const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
		stageSession.replace(admitted.snapshot);
		const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession });
		// A factory-bound adapter only binds against a live evaluation.
		const evaluated = facade.camera.evaluate(rect, 1);
		if (evaluated.kind !== 'evaluated') throw new Error('the adapter fixture did not evaluate');
		facade.acquireInspection('exclusive');
		const host = createStageAcceptanceHost({
			facade,
			sessionEpoch: admitted.snapshot.sessionEpoch,
			baseline: {
				revision: admitted.snapshot.acceptedRevision,
				source,
				canonicalJson: admitted.snapshot.canonicalJson,
				sourceContentId: admitted.snapshot.sourceContentId
			},
			planners: []
		});
		return { facade, host };
	}

	it('selects a Scene entity canonically without fabricating a Plan fragment', async () => {
		const { facade } = await mounted();
		const reference = sceneEntityReference(
			FIXTURE_ENTITY_ID,
			facade.snapshot().domain.unitRevisions.scene
		);
		const selected = facade.setSelection({ ordered: [{ reference }], primary: reference });
		expect(selected).toEqual({ kind: 'selected' });
		expect(facade.selectionState()).toMatchObject({
			primary: { domain: 'scene', subject: { kind: 'entity', id: FIXTURE_ENTITY_ID } }
		});
		// No representation fragment was supplied: canonical selection is enough.
		expect(facade.selectionState().ordered[0]?.representation).toBeUndefined();
	});

	/** A mounted adapter with the instrument's one published session for this evaluation. */
	async function withSceneSurface(
		accept?: SceneWritePort['accept'],
		taskId: 'scene-arrange' | 'scene-place' = 'scene-arrange',
		project?: ProjectEnvelope,
		rect: typeof RECT = RECT
	) {
		const { facade, host } = await mounted(project, rect);
		mountStageAdapter(facade, host, createAdapter);
		const evaluationId = facade.evaluationId();
		if (evaluationId === null) throw new Error('the adapter fixture has no evaluation');
		const snapshot = facade.snapshot();
		const intents: AuthoringIntent[] = [];
		const session = createSceneSession({
			snapshot: {
				projectId: snapshot.acceptedRevision.projectId,
				contentRevision: snapshot.domain.unitRevisions.scene,
				source: { layout: stageLayout(snapshot), scene: stageScene(snapshot) },
				compileGeneration: snapshot.compileGeneration,
				evaluationId
			},
			port: {
				accept:
					accept ??
					(async (intent) => {
						intents.push(intent);
						return { kind: 'installed' };
					}),
				acceptedRevision: () => ({ revisionId: snapshot.acceptedRevision.revisionId }),
				acquireGesture: (request) => facade.acquireGesture(request)
			}
		});
		const evaluation = facade.evaluation();
		if (evaluation === null) throw new Error('the adapter fixture has no evaluation');
		publishSceneSurface(snapshot, { reading: sceneReadingKey(evaluation), session });
		const reference = sceneEntityReference(FIXTURE_ENTITY_ID, snapshot.domain.unitRevisions.scene);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		facade.openContributedTask(taskId, 'scene');
		return { facade, session, evaluationId, evaluation, intents, snapshot };
	}

	function cssOf(facade: ReturnType<typeof createStageFacade>, point: Vec3): [number, number] {
		const evaluationId = facade.evaluationId();
		if (evaluationId === null) throw new Error('the adapter fixture has no evaluation');
		const projected = facade.projectWorld(point, evaluationId);
		if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
		return [projected.css[0], projected.css[1]];
	}

	async function eventually(predicate: () => boolean): Promise<void> {
		for (let attempt = 0; attempt < 40; attempt += 1) {
			if (predicate()) return;
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		throw new Error('the fixture did not settle');
	}

	/** A mounted adapter over a real acceptance host, with the Place task open. */
	async function acceptedPlaceSurface(beforeAccept?: () => Promise<void>) {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const admitted = await admitSource(project, {
			sessionEpoch: 'session-scene-accepted',
			acceptedRevision: { projectId: project.id, revisionId: 'revision-boot' }
		});
		if (admitted.kind !== 'admitted') throw new Error('the accepted fixture was not admitted');
		const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
		stageSession.replace(admitted.snapshot);
		const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession });
		const evaluated = facade.camera.evaluate(RECT, 1);
		if (evaluated.kind !== 'evaluated') throw new Error('the accepted fixture did not evaluate');
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
		// `beforeAccept` lets a test hold the accepted install open, so a close can
		// arrive while the placement's acceptance is still in flight.
		mountStageAdapter(
			facade,
			beforeAccept === undefined
				? host
				: { ...host, accept: async (intent) => { await beforeAccept(); return host.accept(intent); } },
			createAdapter
		);
		// The placement planner is registered once its metadata identity exists.
		await new Promise((resolve) => setTimeout(resolve, 0));
		const opened = facade.openContributedTask('scene-place', 'scene');
		if (opened.kind !== 'opened') throw new Error(`Place was not opened: ${opened.message}`);
		return { facade };
	}


	it('publishes the candidate as a ghost mesh in the shared Canvas and withdraws it', async () => {
		const { facade, session, evaluationId } = await withSceneSurface();
		expect(facade.ghosts()).toEqual([]);
		facade.pointerIntent({ phase: 'down', css: [100, 100], evaluationId });
		facade.pointerIntent({ phase: 'move', css: [140, 100], evaluationId, shift: true });
		const candidate = session.candidate();
		expect(candidate?.kind).toBe('yaw');
		const ghosts = facade.ghosts();
		expect(ghosts).toHaveLength(1);
		expect(ghosts[0]).toMatchObject({
			id: 'scene-candidate',
			shape: { kind: 'box', size: [1, 1, 1] }
		});
		// The ghost is the object's own body at the captured pose, not a marker.
		expect(ghosts[0]!.center[0]).toBeCloseTo(candidate!.position[0], 9);
		expect(ghosts[0]!.center[1]).toBeCloseTo(candidate!.position[1], 9);
		expect(ghosts[0]!.yaw).toBeCloseTo(candidate!.yaw, 9);

		// Cancel withdraws the pose, so the Canvas draws no stale body.
		facade.pointerIntent({ phase: 'cancel', css: [140, 100], evaluationId });
		expect(session.candidate()).toBeNull();
		expect(facade.ghosts()).toEqual([]);
	});

	it('moves from Stage-local pointer CSS through an offset viewport and commits the ghost pose', async () => {
		const rect = { left: 352, top: 119, width: 928, height: 458, devicePixelRatio: 1 };
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, session, evaluationId, intents } = await withSceneSurface(
			undefined,
			'scene-arrange',
			project,
			rect
		);
		const projected = facade.projectWorld([2.5, 0, 2.5], evaluationId);
		expect(projected.kind).toBe('projected');
		if (projected.kind !== 'projected') return;
		// +page.svelte sends Stage-local CSS, while projectWorld returns viewport CSS.
		const local: [number, number] = [projected.css[0] - rect.left, projected.css[1] - rect.top];

		expect(facade.pointerIntent({ phase: 'down', css: local, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: local, evaluationId });
		const candidate = session.candidate();
		expect(candidate?.kind).toBe('move');
		expect(candidate?.worldXZ[0]).toBeCloseTo(2.5, 5);
		expect(candidate?.worldXZ[1]).toBeCloseTo(2.5, 5);
		expect(facade.ghosts()).toHaveLength(1);

		facade.pointerIntent({ phase: 'up', css: local, evaluationId });
		await eventually(() => intents.length === 1);
		expect(intents[0]).toMatchObject({ kind: 'move-horizontal' });
		const payload = intents[0]!.payload as { worldXZ: readonly [number, number] };
		expect(payload.worldXZ[0]).toBeCloseTo(candidate!.worldXZ[0], 6);
		expect(payload.worldXZ[1]).toBeCloseTo(candidate!.worldXZ[1], 6);
		expect(session.proposalLive()).toBe(false);
	});

	it('keeps a typed candidate, its surface and its drawn pose across an ordinary re-evaluation', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, session, evaluationId, intents } = await withSceneSurface(
			undefined,
			'scene-arrange',
			project
		);
		expect(session.begin(FIXTURE_ENTITY_ID).kind).toBe('idle');
		// Exact typed values, in the order a creator enters them.
		expect(session.setEntry('z', '3').kind).toBe('candidate');
		expect(session.setEntry('x', '3.25').kind).toBe('candidate');
		const candidate = session.candidate();
		if (candidate === null) throw new Error('typing an exact value produced no candidate');

		// The candidate asks the host to redraw it, and every frame raises the
		// evaluation generation. The reading has not changed, so nothing about the
		// proposal has.
		expect(facade.camera.evaluate(RECT, 2).kind).toBe('evaluated');
		expect(facade.evaluationId()).not.toBe(evaluationId);
		expect(session.proposalLive()).toBe(true);

		// Both readings still resolve the surface for the new frame, so what they
		// draw is the pose this session would commit.
		const surface = sceneSurfaceFor(facade.snapshot(), facade.evaluation()!);
		expect(surface?.session).toBe(session);
		const label = `${candidate.worldXZ[0].toFixed(3)}, ${candidate.worldXZ[1].toFixed(3)} m · ${candidate.yaw.toFixed(3)} rad`;
		expect(facade.overlays().map((marker) => marker.label)).toContain(label);
		const ghosts = facade.ghosts();
		expect(ghosts).toHaveLength(1);
		expect(ghosts[0]!.center[0]).toBeCloseTo(candidate.position[0], 9);
		expect(ghosts[0]!.center[1]).toBeCloseTo(candidate.position[1], 9);
		expect(ghosts[0]!.center[2]).toBeCloseTo(candidate.position[2], 9);
		expect(ghosts[0]!.yaw).toBeCloseTo(candidate.yaw, 9);

		// The displayed pose is committable, and it is the one that installs.
		await expect(session.commit()).resolves.toEqual({ kind: 'committed' });
		expect(intents).toHaveLength(1);
		const payload = intents[0]!.payload as { worldXZ: readonly [number, number] };
		expect(payload.worldXZ[0]).toBeCloseTo(candidate.worldXZ[0], 6);
		expect(payload.worldXZ[1]).toBeCloseTo(candidate.worldXZ[1], 6);
	});

	it('plans each exact entry from the pose the previous entry captured', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { session } = await withSceneSurface(undefined, 'scene-arrange', project);
		expect(session.begin(FIXTURE_ENTITY_ID).kind).toBe('idle');

		// Z is typed, then replaced by a yaw proposal, which is the accepted X/Z.
		expect(session.setEntry('z', '5').kind).toBe('candidate');
		expect(session.setEntry('yaw', '1.25').kind).toBe('candidate');
		expect(session.candidate()!.worldXZ[1]).toBeCloseTo(2, 9);

		// The next move entry plans from the displayed pose, not from the Z the yaw
		// proposal replaced: what commits stays what the ghost shows.
		const move = session.setEntry('x', '4');
		expect(move.kind).toBe('candidate');
		const candidate = session.candidate()!;
		expect(candidate.worldXZ[0]).toBeCloseTo(4, 9);
		expect(candidate.worldXZ[1]).toBeCloseTo(2, 9);
	});

	it('withdraws a candidate when the pointer moves to occluded support, so release installs nothing', async () => {
		// A closed, floor-bearing enclosure with the selected box, plus a large
		// occluder inside it. The pointer can reach the floor around the occluder
		// but not through it.
		const withScreen: SceneEntity = {
			kind: 'primitive',
			primitive: 'box',
			id: 'entity-occluder',
			name: 'Screen',
			dimensions: { width: 4, height: 3, depth: 4 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true,
			position: [5, 1.5, 3],
			rotation: [0, 0, 0]
		};
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2]), withScreen]);
		const { facade, session, evaluationId, intents } = await withSceneSurface(
			undefined,
			'scene-arrange',
			project
		);
		const clear = cssOf(facade, [2.5, 0, 2.5]);
		const blocked = cssOf(facade, [5, 1.5, 3]);

		expect(facade.pointerIntent({ phase: 'down', css: clear, evaluationId }).claimed).toBe(true);
		expect(facade.pointerIntent({ phase: 'move', css: clear, evaluationId }).claimed).toBe(true);
		const shown = session.candidate();
		expect(shown).not.toBeNull();
		if (shown === null) return;

		// The same drag now aims at the occluder. The previous pose is not what a
		// release here would install, so it must stop being committable.
		facade.pointerIntent({ phase: 'move', css: blocked, evaluationId });
		expect(session.candidate()).toBeNull();
		expect(facade.ghosts()).toEqual([]);

		facade.pointerIntent({ phase: 'up', css: blocked, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(intents).toEqual([]);
		// The refused press did not leave its lease behind.
		expect(
			facade.acquireGesture({ owner: 'probe', evaluationId, policy: 'cancel-on-reading-change' }).kind
		).toBe('granted');
	});

	it('places from an armed pointer, selects the new entity and stays armed until Esc', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, session, evaluationId, intents } = await withSceneSurface(
			undefined,
			'scene-place',
			project
		);
		const first = cssOf(facade, [3, 0, 3]);
		const moved = cssOf(facade, [3.5, 0, 3]);

		expect(facade.pointerIntent({ phase: 'down', css: first, evaluationId })).toEqual({
			claimed: true,
			adapterId: 'scene'
		});
		const preview = session.candidate();
		expect(preview?.kind).toBe('place');
		expect(preview?.primitive).toBe('box');
		// The preview is the object's own body, drawn by the one Canvas.
		expect(facade.ghosts()).toHaveLength(1);
		expect(facade.ghosts()[0]!.shape).toEqual({ kind: 'box', size: [1, 1, 1] });

		facade.pointerIntent({ phase: 'move', css: moved, evaluationId });
		const movedPreview = session.candidate();
		expect(movedPreview?.kind).toBe('place');
		if (movedPreview === null) return;
		expect(movedPreview.worldXZ[0]).toBeCloseTo(3.5, 6);
		expect(movedPreview.worldXZ[1]).toBeCloseTo(3, 6);

		facade.pointerIntent({ phase: 'up', css: moved, evaluationId });
		await eventually(() => intents.length === 1);
		expect(intents).toHaveLength(1);
		const payload = intents[0]!.payload as { worldXZ: readonly [number, number] };
		expect(payload.worldXZ[0]).toBeCloseTo(movedPreview.worldXZ[0], 6);
		expect(payload.worldXZ[1]).toBeCloseTo(movedPreview.worldXZ[1], 6);
		// A successful placement leaves Place armed and the task open.
		expect(session.armed()).toBe('place');
		expect(facade.session.task()?.kind).toBe('place-object');

		// A second pointer placement works without re-invoking the tool.
		const second = cssOf(facade, [4.5, 0, 1.5]);
		facade.pointerIntent({ phase: 'down', css: second, evaluationId });
		facade.pointerIntent({ phase: 'up', css: second, evaluationId });
		await eventually(() => intents.length === 2);
		expect(intents).toHaveLength(2);

		// Esc/Select is the one disarm path.
		expect(facade.closeTask()).toBe(true);
		expect(session.armed()).toBe('select');
		expect(facade.pointerIntent({ phase: 'down', css: second, evaluationId }).claimed).toBe(false);
	});

	it('releases the pose the press claimed even when the viewport is re-evaluated mid-press', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, session, evaluationId, intents } = await withSceneSurface(
			undefined,
			'scene-place',
			project
		);
		const first = cssOf(facade, [3, 0, 3]);
		expect(facade.pointerIntent({ phase: 'down', css: first, evaluationId }).claimed).toBe(true);
		const claimed = session.candidate();
		expect(claimed?.kind).toBe('place');

		// A second viewport evaluation arrives while the press is still held. A
		// release that resolved the surface again would read a fresh, empty session
		// and silently drop the pose the creator is dragging.
		expect(facade.camera.evaluate(RECT, 2).kind).toBe('evaluated');
		expect(facade.evaluationId()).not.toBe(evaluationId);
		facade.pointerIntent({ phase: 'up', css: first, evaluationId });
		await eventually(() => intents.length === 1);
		expect(intents).toHaveLength(1);
		const payload = intents[0]!.payload as { worldXZ: readonly [number, number] };
		expect(payload.worldXZ[0]).toBeCloseTo(claimed!.worldXZ[0], 6);
		expect(payload.worldXZ[1]).toBeCloseTo(claimed!.worldXZ[1], 6);
	});

	it('does not install a pointer pose whose lease a reading change ended', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, session, evaluationId, intents } = await withSceneSurface(
			undefined,
			'scene-place',
			project
		);
		const first = cssOf(facade, [3, 0, 3]);
		expect(facade.pointerIntent({ phase: 'down', css: first, evaluationId }).claimed).toBe(true);
		expect(session.candidate()?.kind).toBe('place');

		// The host's cancel-on-reading-change policy ends the lease under the
		// proposal; the obsolete pose must not be installed on release.
		expect(facade.session.applyReadingChange()).toMatchObject({ cancelled: true });
		facade.pointerIntent({ phase: 'up', css: first, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(intents).toEqual([]);
		expect(session.candidate()).toBeNull();
		// The interruption did not disarm Place.
		expect(session.armed()).toBe('place');
	});

	it('keeps Place armed across its own accepted install, then disarms on Esc', async () => {
		const { facade } = await acceptedPlaceSurface();
		const first = cssOf(facade, [3, 0, 3]);
		const evaluationId = facade.evaluationId()!;
		const firstSurface = sceneSurfaceFor(facade.snapshot(), facade.evaluation()!);
		expect(firstSurface?.session.armed()).toBe('place');

		expect(facade.pointerIntent({ phase: 'down', css: first, evaluationId }).claimed).toBe(true);
		expect(firstSurface?.session.candidate()?.kind).toBe('place');
		facade.pointerIntent({ phase: 'up', css: first, evaluationId });

		// The accepted install adds exactly one entity and selects it canonically at
		// the post-accept revision.
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);
		const installed = facade.snapshot();
		const primary = facade.selectionState().primary;
		expect(primary?.domain).toBe('scene');
		expect(primary?.subject.kind).toBe('entity');
		if (primary === null || primary.subject.kind !== 'entity') return;
		expect(installed.domain.scene.entities.some((entity) => entity.id === primary.subject.id)).toBe(true);

		// The host's install-close ends the task; Place is a persistent tool and its
		// own install reopens the same contributed task for the next placement.
		const nextEvaluation = facade.camera.evaluate(RECT, 2);
		expect(nextEvaluation.kind).toBe('evaluated');
		facade.overlays();
		await eventually(() => facade.session.task() !== null);
		expect(facade.session.task()?.kind).toBe('place-object');
		const reopened = sceneSurfaceFor(facade.snapshot(), facade.evaluation()!);
		expect(reopened?.session.armed()).toBe('place');

		// A second placement needs no re-invocation of the tool.
		const second = cssOf(facade, [4.5, 0, 1.5]);
		const secondEvaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', css: second, evaluationId: secondEvaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'up', css: second, evaluationId: secondEvaluationId });
		await eventually(() => facade.snapshot().domain.scene.entities.length === 3);
		// The second install closes and reopens the task just like the first.
		const thirdEvaluation = facade.camera.evaluate(RECT, 3);
		if (thirdEvaluation.kind === 'evaluated') facade.overlays();
		await eventually(() => facade.session.task() !== null);

		// Esc is the one path that ends the armed tool, and no deferred reopen may
		// resurrect it afterwards.
		expect(facade.closeTask()).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(facade.session.task()).toBeNull();
		const afterEsc = facade.camera.evaluate(RECT, 4);
		if (afterEsc.kind === 'evaluated') facade.overlays();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(facade.session.task()).toBeNull();
	});

	it('keeps typed Place armed across its own accepted install, then disarms on Esc', async () => {
		const { facade } = await acceptedPlaceSurface();
		const evaluationId = facade.evaluationId()!;
		const surface = sceneSurfaceFor(facade.snapshot(), facade.evaluation()!);
		expect(surface?.session.armed()).toBe('place');

		// The instrument's pointer-free Place commits through this same session; it
		// must leave the tool armed exactly like the pointer path does.
		await surface!.session.place('box', 3, 3);
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);

		const nextEvaluation = facade.camera.evaluate(RECT, 2);
		if (nextEvaluation.kind === 'evaluated') facade.overlays();
		await eventually(() => facade.session.task() !== null);
		expect(facade.session.task()?.kind).toBe('place-object');
		const reopened = sceneSurfaceFor(facade.snapshot(), facade.evaluation()!);
		expect(reopened?.session.armed()).toBe('place');

		// Esc still ends the armed tool, and no deferred reopen resurrects it.
		expect(facade.closeTask()).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 10));
		const afterEsc = facade.camera.evaluate(RECT, 3);
		if (afterEsc.kind === 'evaluated') facade.overlays();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(facade.session.task()).toBeNull();
	});

	it('selects the entity a typed Place installed, canonically at the post-accept revision', async () => {
		const { facade } = await acceptedPlaceSurface();
		const evaluationId = facade.evaluationId()!;
		const surface = sceneSurfaceFor(facade.snapshot(), facade.evaluation()!);
		expect(surface?.session.armed()).toBe('place');
		// Nothing is selected before the typed commit.
		expect(facade.selectionState().primary).toBeNull();

		// The instrument's pointer-free Place commits through this same session. Its
		// completion selects the new entity through the adapter's own services, not the
		// task-scoped instrument guard an accepted install retires.
		await expect(surface!.session.place('box', 3, 3)).resolves.toEqual({ kind: 'committed' });
		const installed = facade.snapshot();
		expect(installed.domain.scene.entities).toHaveLength(2);
		const primary = facade.selectionState().primary;
		expect(primary?.domain).toBe('scene');
		expect(primary?.subject.kind).toBe('entity');
		if (primary === null || primary.subject.kind !== 'entity') return;
		// The selected subject is the entity the acceptance installed, not the
		// pre-existing fixture entity, and its reference names the installed revision.
		expect(primary.subject.id).not.toBe(FIXTURE_ENTITY_ID);
		expect(installed.domain.scene.entities.some((entity) => entity.id === primary.subject.id)).toBe(true);
		expect(primary.revision).toMatchObject({
			kind: 'exact',
			contentRevision: installed.domain.unitRevisions.scene
		});
	});

	it('does not reopen Place when Esc closes the tool during an in-flight acceptance', async () => {
		// A gate the test holds open keeps the accepted install in flight, so an
		// explicit close can race the placement that would otherwise reopen it.
		let releaseAccept!: () => void;
		const acceptGate = new Promise<void>((resolve) => {
			releaseAccept = resolve;
		});
		let acceptReached = false;
		const { facade } = await acceptedPlaceSurface(async () => {
			acceptReached = true;
			await acceptGate;
		});
		const evaluationId = facade.evaluationId()!;
		const point = cssOf(facade, [3, 0, 3]);
		expect(facade.pointerIntent({ phase: 'down', css: point, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'up', css: point, evaluationId });
		await eventually(() => acceptReached);

		// Esc closes the armed tool while its acceptance is still installing.
		expect(facade.closeTask()).toBe(true);

		// The acceptance completes now. It installs the object, but the explicitly
		// closed tool must not be reopened by the deferred reopen.
		releaseAccept();
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);
		const nextEvaluation = facade.camera.evaluate(RECT, 2);
		if (nextEvaluation.kind === 'evaluated') facade.overlays();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(facade.session.task()).toBeNull();
	});

	it('refuses a pointer Place whose datum hit is outside every compiled Room floor', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, session, evaluationId, intents } = await withSceneSurface(
			undefined,
			'scene-place',
			project
		);
		// Both points lie on the floor plane the pointer ray reaches; only the first
		// is covered by the compiled Room floor, so only it may show a candidate.
		const inside = cssOf(facade, [3, 0, 3]);
		const outside = cssOf(facade, [3.5, 0, 7.5]);

		expect(facade.pointerIntent({ phase: 'down', css: outside, evaluationId })).toEqual({
			claimed: false,
			adapterId: null
		});
		expect(session.candidate()).toBeNull();
		expect(facade.ghosts()).toEqual([]);
		facade.pointerIntent({ phase: 'up', css: outside, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(intents).toEqual([]);

		// The point inside the Room floor is still claimable, so the refusal above was
		// membership, not a degenerate ray.
		expect(facade.pointerIntent({ phase: 'down', css: inside, evaluationId }).claimed).toBe(true);
		expect(session.candidate()?.kind).toBe('place');
		facade.pointerIntent({ phase: 'cancel', css: inside, evaluationId });
	});

	it('does not show a snapped pointer Place that lands off the compiled Room floor', async () => {
		// A Room whose far wall sits at a non-integer bound, so a snap step can move an
		// interior pointer point past the floor. Support must be resolved at the snapped
		// point commit will use, not the raw pointer point.
		const planned = planWallChain({
			baseline: createEmptyWallFirstLayoutDocument(),
			points: [
				[0, 0],
				[6.9, 0],
				[6.9, 5.9],
			[0, 5.9]
		],
		close: true,
		capture: freshCapture(),
		levelId: createEmptyWallFirstLayoutDocument().floor.id
	});
		if (planned.kind !== 'success') throw new Error('the snap fixture was refused');
		const scene: SceneDocument = {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])],
			navigationNodes: [],
			connections: []
		};
		const project = await createUnitProject({
			id: PROJECT_ID,
			name: 'Snap floor',
			layout: planned.document,
			scene
		});
		const { facade, session, evaluationId } = await withSceneSurface(
			undefined,
			'scene-place',
			project
		);
		session.setSnapStep(1);
		// Raw x = 6.6 is inside the Room floor (max 6.9); snapped x = 7 is outside.
		const raw = cssOf(facade, [6.6, 0, 3]);
		expect(facade.pointerIntent({ phase: 'down', css: raw, evaluationId })).toEqual({
			claimed: false,
			adapterId: null
		});
		expect(session.candidate()).toBeNull();
	});

	it('reads only the surface published for its own accepted snapshot', async () => {
		const { facade, session, evaluationId, evaluation, snapshot } = await withSceneSurface();
		// A second Stage session (another accepted snapshot) publishes its own
		// surface. The two surfaces are scoped by snapshot and cannot collide.
		const otherProject: ProjectEnvelope = {
			...stageEnvelope(snapshot),
			id: 'project-other-stage',
			acceptedRevision: { projectId: 'project-other-stage', revisionId: 'revision-other' }
		};
		const otherAdmitted = await admitSource(otherProject, {
			sessionEpoch: 'session-other-stage',
			acceptedRevision: { projectId: 'project-other-stage', revisionId: 'revision-other' }
		});
		if (otherAdmitted.kind !== 'admitted') throw new Error('the other Stage fixture was not admitted');
		const otherSession = createSceneSession({
			snapshot: {
				projectId: otherAdmitted.snapshot.acceptedRevision.projectId,
				contentRevision: otherAdmitted.snapshot.domain.unitRevisions.scene,
				source: {
					layout: stageLayout(otherAdmitted.snapshot),
					scene: stageScene(otherAdmitted.snapshot)
				},
				compileGeneration: otherAdmitted.snapshot.compileGeneration,
				evaluationId: 'evaluation-other-stage'
			},
			port: {
				accept: async () => ({ kind: 'installed' }),
				acceptedRevision: () => ({ revisionId: 'revision-other' }),
				acquireGesture: (request) => facade.acquireGesture(request)
			}
		});
		const otherEvaluation = {
			token: {
				outputId: 'output-other-stage',
				sessionEpoch: otherAdmitted.snapshot.sessionEpoch,
				sourceRevision: otherAdmitted.snapshot.sourceContentId,
				evaluationGeneration: 1
			},
			settledReading: '3d'
		} as unknown as ViewportEvaluation;
		publishSceneSurface(otherAdmitted.snapshot, {
			reading: sceneReadingKey(otherEvaluation),
			session: otherSession
		});

		expect(facade.pointerIntent({ phase: 'down', css: [100, 100], evaluationId })).toEqual({
			claimed: true,
			adapterId: 'scene'
		});
		// The claim used this Stage's session, not the concurrent one.
		expect(session.baseline()).not.toBeNull();
		expect(otherSession.baseline()).toBeNull();
		expect(otherSession.candidate()).toBeNull();
		expect(sceneSurfaceFor(snapshot, evaluation)?.session).toBe(session);
		expect(sceneSurfaceFor(otherAdmitted.snapshot, otherEvaluation)?.session).toBe(otherSession);
	});

	it('does not retire another publisher\'s surface on unmount and no late phase can act', async () => {
		const { facade, snapshot, evaluationId, evaluation } = await withSceneSurface();
		// The fixture's instrument published this surface; the binding found it and
		// does not own it, so teardown must neither cancel nor remove it.
		expect(sceneSurfaceFor(snapshot, evaluation)).not.toBeNull();
		facade.dispose();
		expect(sceneSurfaceFor(snapshot, evaluation)).not.toBeNull();
		expect(facade.pointerIntent({ phase: 'up', css: [100, 100], evaluationId })).toEqual({
			claimed: false,
			adapterId: null
		});
	});

	it('aborts the replaced session when a second publisher claims the same evaluation', async () => {
		const { facade, session, snapshot, evaluationId, evaluation } = await withSceneSurface();
		expect(facade.pointerIntent({ phase: 'down', css: [100, 100], evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: [140, 100], evaluationId, shift: true });
		expect(session.candidate()).not.toBeNull();
		const second = createSceneSession({
			snapshot: {
				projectId: snapshot.acceptedRevision.projectId,
				contentRevision: snapshot.domain.unitRevisions.scene,
				source: { layout: stageLayout(snapshot), scene: stageScene(snapshot) },
				compileGeneration: snapshot.compileGeneration,
				evaluationId
			},
			port: {
				accept: async () => ({ kind: 'installed' }),
				acceptedRevision: () => ({ revisionId: 'revision-second' }),
				acquireGesture: (request) => facade.acquireGesture(request)
			}
		});
		publishSceneSurface(snapshot, { reading: sceneReadingKey(evaluation), session: second });
		// The replaced session may not keep the candidate or its lease; the new one
		// must be able to claim the same press.
		expect(session.candidate()).toBeNull();
		expect(
			facade.acquireGesture({ owner: 'probe', evaluationId, policy: 'cancel-on-reading-change' }).kind
		).toBe('granted');
	});

	it('arms Place on the live reading, not the evaluation captured at bind time', async () => {
		const { facade, evaluationId } = await withSceneSurface();
		expect(facade.closeTask()).toBe(true);
		// A reading change does not rebuild the binding; the next instrument must
		// still arm the surface for the evaluation the instrument will read.
		expect(facade.camera.evaluate(RECT, 2).kind).toBe('evaluated');
		const current = facade.evaluationId();
		expect(current).not.toBe(evaluationId);
		if (current === null) return;
		expect(facade.openContributedTask('scene-place', 'scene').kind).toBe('opened');
		expect(sceneSurfaceFor(facade.snapshot(), facade.evaluation()!)?.session.armed()).toBe('place');
	});

	it('keeps a replacement surface when the previous publisher retires', async () => {
		const { facade, session, snapshot, evaluation } = await withSceneSurface();
		const replacement = createSceneSession({
			snapshot: {
				projectId: snapshot.acceptedRevision.projectId,
				contentRevision: snapshot.domain.unitRevisions.scene,
				source: { layout: stageLayout(snapshot), scene: stageScene(snapshot) },
				compileGeneration: snapshot.compileGeneration,
				evaluationId: 'evaluation-replacement'
			},
			port: {
				accept: async () => ({ kind: 'installed' }),
				acceptedRevision: () => ({ revisionId: 'revision-replacement' }),
				acquireGesture: (request) => facade.acquireGesture(request)
			}
		});
		const release = publishSceneSurface(snapshot, {
			reading: sceneReadingKey(evaluation),
			session: replacement
		});
		// Retiring the *previous* publisher's surface must not remove this one.
		retireSceneSurface(snapshot, { reading: sceneReadingKey(evaluation), session });
		expect(sceneSurfaceFor(snapshot, evaluation)?.session).toBe(replacement);
		release();
		expect(sceneSurfaceFor(snapshot, evaluation)).toBeNull();
	});

	it('releases the lease when the pointer commit is refused', async () => {
		const { facade, session, evaluationId } = await withSceneSurface(async () => ({
			kind: 'refused',
			code: 'support-unresolved',
			message: 'No floor.'
		}));
		facade.pointerIntent({ phase: 'down', css: [100, 100], evaluationId });
		facade.pointerIntent({ phase: 'move', css: [140, 100], evaluationId, shift: true });
		expect(session.candidate()).not.toBeNull();

		facade.pointerIntent({ phase: 'up', css: [140, 100], evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(session.candidate()).toBeNull();
		// The refused commit must not leave the surface holding the gesture: a
		// different owner is granted at once.
		expect(
			facade.acquireGesture({ owner: 'probe', evaluationId, policy: 'cancel-on-reading-change' }).kind
		).toBe('granted');
	});

	it('refuses a press before any task owns the surface', async () => {
		const { facade, host } = await mounted();
		mountStageAdapter(facade, host, createAdapter);
		const evaluationId = facade.evaluationId();
		expect(evaluationId).not.toBeNull();
		expect(facade.pointerIntent({ phase: 'down', css: [100, 100], evaluationId: evaluationId! })).toEqual({
			claimed: false,
			adapterId: null
		});
	});

	it('releases the lease on a click that produces no candidate', async () => {
		const { facade, session, evaluationId } = await withSceneSurface();
		const down = facade.pointerIntent({ phase: 'down', css: [100, 100], evaluationId });
		expect(down.claimed).toBe(true);
		facade.pointerIntent({ phase: 'up', css: [100, 100], evaluationId });
		expect(session.candidate()).toBeNull();
		// The previous click's lease is gone: a different owner can take it at once.
		// Re-pressing as the same adapter would be re-entrant and prove nothing.
		expect(
			facade.acquireGesture({ owner: 'probe', evaluationId, policy: 'cancel-on-reading-change' }).kind
		).toBe('granted');
	});

	it('claims a press only through the live Arrange task, and shift-drag yaws the same baseline', async () => {
		const { facade, session, evaluationId } = await withSceneSurface();

		const down = facade.pointerIntent({ phase: 'down', css: [100, 100], evaluationId });
		expect(down).toEqual({ claimed: true, adapterId: 'scene' });
		// The press begins the session, so the baseline exists once it is claimed.
		const start = session.baseline()!;
		expect(start).not.toBeNull();

		facade.pointerIntent({ phase: 'move', css: [140, 100], evaluationId, shift: true });
		const candidate = session.candidate();
		expect(candidate?.kind).toBe('yaw');
		expect(candidate!.yaw).toBeCloseTo(start.rotation[1] + 0.4, 9);
		// The same candidate is published through the overlay the route re-reads.
		const overlays = facade.overlays().filter((entry) => entry.id === 'scene-candidate');
		expect(overlays).toHaveLength(1);
		expect(overlays[0]!.label).toContain('rad');

		facade.pointerIntent({ phase: 'up', css: [140, 100], evaluationId });
		// Release commits the displayed candidate; the accepted install is async.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(session.candidate()).toBeNull();
	});

	it('does not claim a press without a live task, and the shell task close runs the one cancel path', async () => {
		const { facade, session, evaluationId } = await withSceneSurface();
		expect(facade.pointerIntent({ phase: 'down', css: [100, 100], evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: [140, 100], evaluationId, shift: true });
		expect(session.candidate()).not.toBeNull();

		// Esc at the shell: the adapter's taskClosed hook cancels, releases the lease
		// and no late pointer event can act for the closed task.
		expect(facade.closeTask()).toBe(true);
		expect(session.candidate()).toBeNull();
		expect(facade.pointerIntent({ phase: 'up', css: [140, 100], evaluationId }).claimed).toBe(false);
	});

	it('closes the previous contributed task when another one is opened', async () => {
		const { facade, session } = await withSceneSurface();
		const evaluationId = facade.evaluationId()!;
		facade.pointerIntent({ phase: 'down', css: [100, 100], evaluationId });
		facade.pointerIntent({ phase: 'move', css: [140, 100], evaluationId, shift: true });
		expect(session.candidate()).not.toBeNull();

		// Tasks are opened by contributed task id, not by operation kind.
		const opened = facade.openContributedTask('scene-place', 'scene');
		expect(opened.kind).toBe('opened');
		// Replacement is a close: the Arrange lease is gone and nothing is mid-drag.
		expect(session.candidate()).toBeNull();
		expect(facade.pointerIntent({ phase: 'up', css: [140, 100], evaluationId }).claimed).toBe(false);
	});

	it('contributes Place and Arrange through AM-5 and binds Card facts to the snapshot', async () => {
		const { facade, host } = await mounted();
		const registration = mountStageAdapter(facade, host, createAdapter);
		expect(registration.kind).toBe('registered');

		const tasks = facade.tasks().filter((task) => task.adapterId === 'scene');
		expect(tasks.map((task) => task.taskKind)).toEqual(['scene-compose', 'scene-arrange', 'place-object']);

		const findEntries = facade.findEntries().filter((entry) => entry.adapterId === 'scene');
		expect(findEntries.map((entry) => [entry.railFamily, entry.capability, entry.taskKind])).toEqual([
			['arrange', 'scene', 'scene-compose'],
			['arrange', 'scene', 'scene-compose'],
			['arrange', 'scene', 'scene-compose'],
			['arrange', 'scene', 'scene-arrange'],
			['place', 'scene', 'place-object']
		]);

		const facts = facade.cardFacts({ sourceId: FIXTURE_ENTITY_ID, sourceKind: 'entity', ref: null });
		// The host publishes Card facts sorted by adapter then label, so Scale sits
		// between Position and Yaw regardless of contribution order.
		expect(facts.map((fact) => fact.label)).toEqual(['Kind', 'Name', 'Position', 'Scale', 'Yaw']);

		const opened = facade.openContributedTask('scene-arrange', 'scene');
		expect(opened.kind).toBe('opened');
		if (opened.kind !== 'opened') return;
		expect(opened.instrument?.view).toBeDefined();
		expect(opened.instrument?.summary).toBe('Arrange');

		const compose = facade.openContributedTask('scene-compose', 'scene');
		expect(compose.kind).toBe('opened');
		if (compose.kind !== 'opened') return;
		expect(compose.instrument?.summary).toBe('Compose');
		expect(compose.instrument?.view).toBeDefined();
	});
});
