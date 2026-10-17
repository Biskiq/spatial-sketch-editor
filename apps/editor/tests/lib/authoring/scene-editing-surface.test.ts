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
	admitCurrentSource,
	createEmptyWallFirstProject,
	type AuthoringIntent,
	type ProjectDocument,
	type SceneEntity,
	type Vec3
} from '@portfolio/project-model';
import { planWallChain } from '@portfolio/layout-core';

import {
	createSceneSession,
	localContactMinY,
	publishSceneSurface,
	sceneEntityReference,
	type ScenePlacementSession,
	type SceneWritePort
} from '$lib/authoring/adapters/scene/placement';
import { currentStageSource } from '$lib/authoring/stage/current-stage-source';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { buildCurrentSourceFixture, FIXTURE_ENTITY_ID, FIXTURE_PROJECT_ID } from './__fixtures__/f4-current-source-fixtures';

const ENTITY_ID = 'entity-scene-box';
const PROJECT_ID = 'project-scene-editing';
const BASELINE: Vec3 = [2, 0.5, 2];

function supportedProject(entities: readonly SceneEntity[]): ProjectDocument {
	const base = createEmptyWallFirstProject({ id: PROJECT_ID, name: 'Scene editing' });
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
	return {
		...base,
		layout: planned.document,
		scene: {
			...base.scene,
			entities: [...entities]
		}
	};
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
	const project = supportedProject(entities);
	const admitted = await admitCurrentSource(project, {
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`the Scene fixture was not admitted: ${admitted.kind}`);
	let sequence = 0;
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
});

describe('Scene adapter registration', () => {
	async function mounted() {
		const { project } = buildCurrentSourceFixture();
		const admitted = await admitSource(project, {
			sessionEpoch: 'session-scene-adapter',
			acceptedRevision: { projectId: FIXTURE_PROJECT_ID, revisionId: 'revision-boot' }
		});
		if (admitted.kind !== 'admitted') throw new Error('the adapter fixture was not admitted');
		const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
		stageSession.replace(admitted.snapshot);
		const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession });
		// A factory-bound adapter only binds against a live evaluation.
		const evaluated = facade.camera.evaluate(
			{ left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 },
			1
		);
		if (evaluated.kind !== 'evaluated') throw new Error('the adapter fixture did not evaluate');
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
		return { facade, host };
	}

	it('selects a Scene entity canonically without fabricating a Plan fragment', async () => {
		const { facade } = await mounted();
		const reference = sceneEntityReference(FIXTURE_ENTITY_ID, facade.snapshot().sourceContentId);
		const selected = facade.setSelection({ ordered: [{ reference }], primary: reference });
		expect(selected).toEqual({ kind: 'selected' });
		expect(facade.selectionState()).toMatchObject({
			primary: { domain: 'scene', subject: { kind: 'entity', id: FIXTURE_ENTITY_ID } }
		});
		// No representation fragment was supplied: canonical selection is enough.
		expect(facade.selectionState().ordered[0]?.representation).toBeUndefined();
	});

	/** A mounted adapter with the instrument's one published session for this evaluation. */
	async function withSceneSurface() {
		const { facade, host } = await mounted();
		mountStageAdapter(facade, host, createAdapter);
		const evaluationId = facade.evaluationId();
		if (evaluationId === null) throw new Error('the adapter fixture has no evaluation');
		const snapshot = facade.snapshot();
		const intents: AuthoringIntent[] = [];
		const session = createSceneSession({
			snapshot: {
				projectId: snapshot.acceptedRevision.projectId,
				contentRevision: snapshot.sourceContentId,
				source: currentStageSource(snapshot).source,
				compileGeneration: snapshot.compileGeneration,
				evaluationId
			},
			port: {
				accept: async (intent) => {
					intents.push(intent);
					return { kind: 'installed' };
				},
				acceptedRevision: () => ({ revisionId: snapshot.acceptedRevision.revisionId }),
				acquireGesture: (request) => facade.acquireGesture(request)
			}
		});
		publishSceneSurface({ evaluationId, session });
		const reference = sceneEntityReference(FIXTURE_ENTITY_ID, snapshot.sourceContentId);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		facade.openContributedTask('scene-arrange', 'scene');
		return { facade, session, evaluationId, intents };
	}


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
		expect(tasks.map((task) => task.taskKind)).toEqual(['scene-arrange', 'place-object']);

		const findEntries = facade.findEntries().filter((entry) => entry.adapterId === 'scene');
		expect(findEntries.map((entry) => [entry.railFamily, entry.capability, entry.taskKind])).toEqual([
			['arrange', 'scene', 'scene-arrange'],
			['place', 'scene', 'place-object']
		]);

		const facts = facade.cardFacts({ sourceId: FIXTURE_ENTITY_ID, sourceKind: 'entity', ref: null });
		expect(facts.map((fact) => fact.label)).toEqual(['Kind', 'Name', 'Position', 'Yaw']);

		const opened = facade.openContributedTask('scene-arrange', 'scene');
		expect(opened.kind).toBe('opened');
		if (opened.kind !== 'opened') return;
		expect(opened.instrument?.view).toBeDefined();
		expect(opened.instrument?.summary).toBe('Arrange');
	});
});
