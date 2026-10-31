/**
 * T2.P01.S03 — the first coherent Scene editing surface.
 *
 * Two halves, both through public seams only:
 *
 * 1. **Session** (`createSceneSession`): arming is session state, preview and
 *    commit run the same planner with the same captured inputs, snap is explicit,
 *    one cancel path restores the accepted baseline, and typed entry is never
 *    coerced (blank is not zero).
 * 2. **Adapter** (`createAdapter`): the ten Scene planners register with the one
 *    F.4 host, and the Place/Compose/Import Find entries, tasks, Card facts and
 *    instrument reach the Stage through AM-5 without any shell edit. R217.S08
 *    adds object marks and retires the Arrange task.
 *
 * No test here writes Layout: every accepted intent is a Scene operation.
 */
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { buildFormGeometry } from '$lib/museum/entities/form-geometry';
import { describe, expect, it } from 'vitest';
import {
	type AuthoringIntent,
	type SceneDocument,
	type SceneEntity,
	type ScenePrimitiveEntity,
	type Vec3
} from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import type { ViewportEvaluation } from '@portfolio/camera-core';

import {
	createSceneSession,
	localContactMinY,
	publishSceneSurface,
	sceneEntityReference,
	sceneReadingKey,
	sceneSurfaceFor,
	type ArmedFormCopy,
	type ArmedModelPlacement,
	type ScenePlacementSession,
	type SceneWritePort
} from '$lib/authoring/adapters/scene/placement';
import { stageEnvelope, stageLayout, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { formCardController } from '$lib/authoring/adapters/scene/form-card';
import { sceneObjectCardController } from '$lib/authoring/adapters/scene/object-card';
import { sceneObjectMarkDescriptors } from '$lib/authoring/adapters/scene/object-marks';
import { buildPlanSceneFootprintProjection } from '$lib/authoring/scene/plan-scene-footprint';
import { draftingSnapIncrementMeters, snapDraftingPlacement } from '$lib/authoring/stage/stage-drafting';
import { captureUnitSave } from '@portfolio/project-model/units';
import { canonicalFormLibraryPayload } from '@portfolio/project-model/library';
import { creatorModelDefinition } from '@portfolio/project-model/scene-planning';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { hitStageMark } from '$lib/authoring/stage/stage-handles';
import { buildCurrentSourceFixture, FIXTURE_ENTITY_ID, FIXTURE_PROJECT_ID } from './__fixtures__/f4-current-source-fixtures';
import { buildS17MixedProject } from './__fixtures__/s17-mixed-project';
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


function boxEntity(id = ENTITY_ID, position: Vec3 = BASELINE): Extract<ScenePrimitiveEntity, { primitive: 'box' }> {
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

	it('never re-rounds a placement X/Z it was handed, and reports only the applied step', async () => {
		const { session } = await sessionFor([boxEntity()]);
		session.setSnapStep(2);
		session.beginPlace('box');
		// The adapter has already rounded to the shared 1 m increment and resolved
		// floor support at (1, 3). A second round through the session's own 2 m step
		// would move the pose off that floor, so the handed X/Z is authoritative.
		const handed = session.previewPlace('box', 1, 3, 0.5, 1);
		expect(handed.kind).toBe('candidate');
		if (handed.kind !== 'candidate') return;
		expect(handed.candidate.worldXZ).toEqual([1, 3]);
		expect(handed.candidate.snappedStep).toBe(1);
		// Support is 0.5 m and the box's local contact is -0.5 m: the installed Y is 1.
		expect(handed.candidate.position[1]).toBeCloseTo(1, 9);
		expect(handed.candidate.yaw).toBe(0);

		// No applied step means no report, even while the session happens to hold one.
		const raw = session.previewPlace('box', 1.37, 2.81, 0.5);
		expect(raw.kind).toBe('candidate');
		if (raw.kind !== 'candidate') return;
		expect(raw.candidate.worldXZ).toEqual([1.37, 2.81]);
		expect(raw.candidate.snappedStep).toBeNull();
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

	it('places the armed approved model at typed coordinates instead of a primitive', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		const model: ArmedModelPlacement = {
			definition: {
				definitionKey: 'model:typed-placement',
				metadataContentId: `sha256-${'c'.repeat(64)}`,
				footprintMeters: [
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1]
				],
				contactMinY: 0,
				creationDefaults: { kind: 'model' }
			},
			resource: null
		} as unknown as ArmedModelPlacement;
		session.setArmedModel(model);

		expect(await session.place('box', 2, 3)).toEqual({ kind: 'committed' });
		expect(port.intents).toHaveLength(1);
		expect(port.intents[0]!.payload).toMatchObject({
			definitionKey: 'model:typed-placement',
			worldXZ: [2, 3]
		});
		// The approval is consumed by its commit, never by an attempt.
		expect(session.armedModel()).toBeNull();
	});

	it('places an armed My Objects copy with its saved source verbatim and consumes the arm', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		const item = canonicalFormLibraryPayload({
			formatVersion: 1,
			kind: 'form',
			name: 'Saved plinth',
			form: {
				generator: {
					kind: 'extrude',
					plane: 'plan',
					outline: [
						{ key: 1, u: 0, v: 0, smooth: false },
						{ key: 2, u: 2, v: 0, smooth: true },
						{ key: 3, u: 2, v: 1, smooth: false },
						{ key: 4, u: 0, v: 1, smooth: false }
					],
					extent: 0.8
				},
				scale: [1, 1.5, 0.75],
				nextKey: 5
			},
			materialId: 'wood-walnut',
			castShadow: true,
			receiveShadow: true
		});
		const copy: ArmedFormCopy = { itemId: 'library-item-1', item, contactMinY: 0 };

		expect(session.beginPlace('box')).toEqual({ kind: 'idle' });
		session.setArmedFormCopy(copy);
		expect(session.armedFormCopy()).toBe(copy);
		const support = {
			kind: 'elevation' as const,
			elevation: 0,
			generationId: 'scene-support@source-1'
		};
		const preview = session.previewPlaceFormCopy(copy, 2.5, 3.5, 0, support);
		expect(preview.kind).toBe('candidate');
		if (preview.kind !== 'candidate') return;
		expect(preview.candidate.primitive).toBeNull();
		expect(preview.candidate.form).toEqual(item.form);
		expect(preview.candidate.position).toEqual([2.5, 0, 3.5]);

		expect(await session.commitPlace()).toEqual({ kind: 'committed' });
		expect(port.intents).toHaveLength(1);
		const intent = port.intents[0]!;
		expect(intent.kind).toBe('place-form-copy');
		expect(intent.targets).toEqual([]);
		expect(intent.allocatedIds).toHaveLength(1);
		expect(intent.payload).toMatchObject({
			item,
			worldXZ: [2.5, 3.5],
			yaw: 0,
			contactMinY: 0,
			// The floor the preview showed travels with the commit, so an ambiguous
			// point can never resolve somewhere else at acceptance.
			supportChoice: support
		});
		// The copy is consumed by its insertion; a second insertion needs a new click.
		expect(session.armedFormCopy()).toBeNull();
		expect(session.placedEntityId()).toBe(intent.allocatedIds[0]!.id);
	});

	it('places the armed copy through typed coordinates instead of the primitive', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		const item = canonicalFormLibraryPayload({
			formatVersion: 1,
			kind: 'form',
			name: 'Typed copy',
			form: {
				generator: {
					kind: 'extrude',
					plane: 'plan',
					outline: [
						{ key: 1, u: 0, v: 0, smooth: false },
						{ key: 2, u: 1, v: 0, smooth: false },
						{ key: 3, u: 1, v: 1, smooth: false }
					],
					extent: 0.5
				},
				scale: [1, 1, 1],
				nextKey: 4
			},
			materialId: 'wood-walnut',
			castShadow: true,
			receiveShadow: true
		});
		session.setArmedFormCopy({ itemId: 'library-item-2', item, contactMinY: 0 });
		expect(await session.place('box', 3, 4)).toEqual({ kind: 'committed' });
		expect(port.intents[0]!.kind).toBe('place-form-copy');
		expect(session.armedFormCopy()).toBeNull();
	});

	it('keeps the armed copy when an insertion is refused', async () => {
		const refused = await sessionFor(
			[boxEntity()],
			writePort({
				accept: async () => ({ kind: 'refused', code: 'support-unresolved', message: 'No floor.' })
			})
		);
		const item = canonicalFormLibraryPayload({
			formatVersion: 1,
			kind: 'form',
			name: 'Retry copy',
			form: {
				generator: {
					kind: 'extrude',
					plane: 'plan',
					outline: [
						{ key: 1, u: 0, v: 0, smooth: false },
						{ key: 2, u: 1, v: 0, smooth: false },
						{ key: 3, u: 1, v: 1, smooth: false }
					],
					extent: 0.5
				},
				scale: [1, 1, 1],
				nextKey: 4
			},
			materialId: 'wood-walnut',
			castShadow: true,
			receiveShadow: true
		});
		const copy: ArmedFormCopy = { itemId: 'library-item-3', item, contactMinY: 0 };
		refused.session.setArmedFormCopy(copy);
		expect(await refused.session.place('box', 1, 1)).toMatchObject({ kind: 'refused' });
		expect(refused.session.armedFormCopy()).toBe(copy);
	});

	it('keeps the armed model when a typed placement is refused', async () => {
		const refused = await sessionFor(
			[boxEntity()],
			writePort({ accept: async () => ({ kind: 'refused', code: 'support-unresolved', message: 'No floor.' }) })
		);
		const model = {
			definition: {
				definitionKey: 'model:retry',
				metadataContentId: `sha256-${'d'.repeat(64)}`,
				footprintMeters: [
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1]
				],
				contactMinY: 0,
				creationDefaults: { kind: 'model' }
			},
			resource: null
		} as unknown as ArmedModelPlacement;
		refused.session.setArmedModel(model);

		expect(await refused.session.place('box', 1, 1)).toMatchObject({ kind: 'refused' });
		expect(refused.session.armedModel()).toBe(model);
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
		const rendered = createScenePickSource();
		rendered.setSource(admitted.snapshot.domain.scene);
		const meshes: Mesh[] = [];
		for (const entity of admitted.snapshot.domain.scene.entities) {
			if (entity.kind !== 'form') continue;
			const mesh = new Mesh(buildFormGeometry(evaluateFormMesh(entity.form)!, entity.form.generator.plane), new MeshBasicMaterial());
			mesh.position.fromArray(entity.position);
			mesh.rotation.set(...entity.rotation);
			rendered.register(entity.id, mesh);
			meshes.push(mesh);
		}
		const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession, scenePick: rendered.pick, sceneBounds: rendered.bounds });
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
		return { facade, host, rendered };
	}


	function nativeForm(plane: 'plan' | 'elevation', x: number): SceneEntity {
		return { kind: 'form', id: `form-${plane}`, name: `${plane} form`, position: [x, 0, 3], rotation: [0, 0, 0],
			materialId: 'plaster-warm', castShadow: true, receiveShadow: true,
			form: { generator: { kind: 'extrude', plane, extent: 1, outline: [
				{ key: 1, u: -0.5, v: 0, smooth: false }, { key: 2, u: 0.5, v: 0, smooth: false },
				{ key: 3, u: 0.5, v: 1, smooth: false }, { key: 4, u: -0.5, v: 1, smooth: false }
			] }, scale: [1, 1, 1], nextKey: 5 } };
	}

	it('offers a Scene host measurement at a rendered bounds corner', async () => {
		const form = nativeForm('plan', 2);
		const { facade, host, rendered } = await mounted(await supportedProject([form]));
		mountStageAdapter(facade, host, createAdapter);
		const bounds = rendered.bounds(form.id, facade.snapshot().domain.scene)!;
		let snapped = false;
		for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
			const corner: [number, number, number] = [x, y, z];
			const css = facade.projectWorld(corner, facade.evaluationId()!);
			if (css.kind !== 'projected') continue;
			const pick = facade.resolvePick({ css: css.css, evaluationId: facade.evaluationId()!, purpose: 'tool', tool: { kind: 'measure', scope: 'host' } });
			if (pick.kind === 'resolved' && pick.hit.sourceId === form.id && pick.hit.worldPoint.every((n, i) => Math.abs(n - corner[i]!) < 1e-8)) snapped = true;
		}
		expect(snapped).toBe(true);
		facade.dispose();
	});

	it('picks both form planes through the mounted adapter in Plan and 3D at a surface offset', async () => {
		const rect = { ...RECT, left: 230, top: 91 };
		const { facade, host } = await mounted(await supportedProject([nativeForm('plan', 2), nativeForm('elevation', 4)]), rect);
		mountStageAdapter(facade, host, createAdapter);
		try {
			for (const reading of ['3d', 'plan'] as const) {
				facade.camera.applyIntent({ kind: 'set-reading', reading }, 2);
				facade.camera.evaluate(rect, 4);
				for (const [x, id] of [[2, 'form-plan'], [4, 'form-elevation']] as const) {
					const projected = facade.projectWorld([x, 0.5, 3.5], facade.evaluationId()!);
					if (projected.kind !== 'projected') throw new Error('fixture did not project');
					const css = projected.css;
					const hit = facade.resolveSourceHit({ evaluationId: facade.evaluationId()!, css: [css[0] - rect.left, css[1] - rect.top] });
					expect(hit.kind).toBe('resolved');
					if (hit.kind !== 'resolved') throw new Error('no form hit');
					expect(hit.hit.reference?.subject.id).toBe(id);
					const reference = hit.hit.reference!;
					expect(facade.setSelection({ ordered: [{ reference }], primary: reference }).kind).toBe('selected');
					expect(facade.selectionState().ordered[0]?.representation).toBeUndefined();
					expect(facade.subjects().find((row) => row.reference.subject.id === id)?.label).toContain('form');
					const subject = { sourceId: id, sourceKind: 'entity', reference, ref: null };
					expect(facade.cardWriter(subject)?.summary).toBe('Form fields');
					expect(facade.cardActions(subject).map((action) => action.label)).toContain('Delete form');
				}
			}
			expect(facade.resolveSourceHit({ evaluationId: 'stale', css: [500, 350] })).toEqual({ kind: 'failed', code: 'stale-evaluation' });
		} finally { facade.dispose(); }
	});


	it('cannot select forms through a rendered floor or Wall, and handles admitted roll in Plan', async () => {
		const below = nativeForm('plan', 2);
		below.position[1] = -2;
		const rolled = nativeForm('elevation', 4);
		rolled.rotation[2] = Math.PI / 2;
		rolled.position[1] = 1;
		const { facade, host, rendered } = await mounted(await supportedProject([below, rolled]));
		mountStageAdapter(facade, host, createAdapter);
		const floor = new Mesh(new PlaneGeometry(7, 6), new MeshBasicMaterial());
		floor.name = 'VisitorFloor:test'; floor.position.set(3.5, 0, 3); floor.rotation.x = -Math.PI / 2;
		const root = new Group(); root.add(floor);
		const wall = new Mesh(new BoxGeometry(1, 2, 1), new MeshBasicMaterial());
		wall.position.set(4, 2, 3.5); root.add(wall);
		rendered.registerLayout(root);
		function at(point: Vec3) {
			const css = facade.projectWorld(point, facade.evaluationId()!);
			if (css.kind !== 'projected') throw new Error('fixture projection failed');
			return facade.resolveSourceHit({ evaluationId: facade.evaluationId()!, css: css.css });
		}
		try {
			for (const reading of ['3d', 'plan'] as const) {
				facade.camera.applyIntent({ kind: 'set-reading', reading }, 2);
				facade.camera.evaluate(RECT, 4);
				const hidden = at([2, -1.5, 3.5]);
				expect(hidden.kind === 'resolved' ? hidden.hit.reference : null).toBeFalsy();
			}
			const blocked = at([3.5, 0, 3.5]);
			expect(blocked.kind === 'resolved' ? blocked.hit.reference : null).toBeFalsy();
			root.remove(wall);
			const visible = at([3.5, 0, 3.5]);
			expect(visible.kind === 'resolved' ? visible.hit.reference?.subject.id : null).toBe('form-elevation');
		} finally { facade.dispose(); floor.geometry.dispose(); wall.geometry.dispose(); }
	});

	it('uses rendered model occlusion and primitive scale instead of guessed picking bounds', async () => {
		const model: SceneEntity = { kind: 'model', id: 'model-front', name: 'Front model', assetId: 'paris-grand-piano', fallback: 'piano', position: [2, 1, 3.5], rotation: [0, 0, 0], scale: 2 };
		// Catalogue identity is immaterial to raycasting: the registered child is the
		// mounted model's drawn mesh, with its actual transform and geometry.
		const source = await supportedProject([nativeForm('plan', 2), model]);
		const { facade, host, rendered } = await mounted(source);
		mountStageAdapter(facade, host, createAdapter);
		const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
		mesh.position.fromArray(model.position); mesh.scale.setScalar(2);
		const off = rendered.register(model.id, mesh);
		try {
			const css = facade.projectWorld([2.75, 1, 3.5], facade.evaluationId()!);
			if (css.kind !== 'projected') throw new Error('fixture projection failed');
			const hit = facade.resolveSourceHit({ evaluationId: facade.evaluationId()!, css: css.css });
			expect(hit.kind === 'resolved' ? hit.hit.reference?.subject.id : null).toBe('model-front');
			// Live bounds follow a model/transform update, never a retained guessed box.
			mesh.scale.setScalar(3);
			expect(rendered.pick({ origin: [3.25, 5, 3.5], direction: [0, -1, 0] }, facade.snapshot().domain.scene)?.entityId).toBe('model-front');
			mesh.position.x = 20;
			expect(rendered.pick({ origin: [3.25, 5, 3.5], direction: [0, -1, 0] }, facade.snapshot().domain.scene)?.entityId).not.toBe('model-front');
			mesh.position.x = 2;
			// A versioned vertex update must invalidate Three's existing box/sphere,
			// not only the registry's world bounds.
			const positions = mesh.geometry.getAttribute('position');
			for (let i = 0; i < positions.count; i++) positions.setX(i, positions.getX(i) + 10);
			positions.needsUpdate = true;
			expect(rendered.pick({ origin: [32, 5, 3.5], direction: [0, -1, 0] }, facade.snapshot().domain.scene)?.entityId).toBe('model-front');
			mesh.visible = false;
			expect(rendered.pick({ origin: [32, 5, 3.5], direction: [0, -1, 0] }, facade.snapshot().domain.scene)?.entityId).not.toBe('model-front');
			off();
			expect(rendered.pick({ origin: [32, 5, 3.5], direction: [0, -1, 0] }, facade.snapshot().domain.scene)?.entityId).not.toBe('model-front');
		} finally { facade.dispose(); mesh.geometry.dispose(); }
	});

	it('operates a selected form through its Card, shared history and a saved cold reopen', async () => {
		const { facade, host } = await mounted(await supportedProject([nativeForm('plan', 2), nativeForm('elevation', 4)]));
		mountStageAdapter(facade, host, createAdapter);
		const services = createStageAdapterServices(facade, host);
		try {
			const row = facade.subjects().find((item) => item.reference.subject.id === 'form-plan')!;
			facade.setSelection({ ordered: [{ reference: row.reference }], primary: row.reference });
			const card = () => formCardController(services, 'form-plan')!;
			const before = JSON.stringify(stageScene(facade.snapshot()).entities);
			expect((await card().move(3, 3)).kind).toBe('installed');
			expect(facade.selectionState().primary?.subject.id).toBe('form-plan');
			expect((await card().turn(0.4)).kind).toBe('installed');
			expect((await card().place(3, 4)).kind).toBe('installed');
			expect((await card().size([2, 1.5, 1])).kind).toBe('installed');
			const sized = stageScene(facade.snapshot()).entities.find((entity) => entity.id === 'form-plan');
			expect(sized?.kind === 'form' && sized.form.scale).toEqual([2, 1.5, 1]);
			const depth = host.history().depth;
			// Save posts the accepted source this Card was built for, adds no history
			// entry and never touches the project.
			const beforeSave = JSON.stringify(stageScene(facade.snapshot()).entities);
			const sent: { form: unknown }[] = [];
			const saveOutcome = await card().save({
				save: async (payload: { form: unknown }) => {
					sent.push(payload);
					return {
						id: '11111111-1111-4111-8111-111111111111',
						name: 'plan form',
						kind: 'form' as const,
						formatVersion: 1,
						contentId: `sha256-${'a'.repeat(64)}`,
						createdAt: '2026-10-28T12:00:00.000Z'
					};
				}
			} as never);
			expect(saveOutcome.kind).toBe('accepted');
			expect(sent).toHaveLength(1);
			expect(sent[0]?.form).toEqual(sized?.kind === 'form' ? sized.form : null);
			expect(host.history().depth).toBe(depth);
			expect(JSON.stringify(stageScene(facade.snapshot()).entities)).toBe(beforeSave);
			expect((await card().size([0, 1, 1])).kind).toBe('refused');
			expect(host.history().depth).toBe(depth);
			expect((await card().duplicate()).kind).toBe('installed');
			const copyId = facade.selectionState().primary!.subject.id;
			expect(copyId).not.toBe('form-plan');
			expect((await formCardController(services, copyId)!.delete()).kind).toBe('installed');
			expect(facade.selectionState().primary).toBeNull();
			expect(host.history().depth).toBe(7);
			for (let index = 0; index < 6; index++) expect((await host.undo()).kind).toBe('installed');
			expect(JSON.stringify(stageScene(facade.snapshot()).entities)).toBe(before);
			for (let index = 0; index < 6; index++) expect((await host.redo()).kind).toBe('installed');
			const saved = await captureUnitSave({ snapshot: host.coordinator().acceptedSnapshot(), operationId: 'save-form', precondition: { kind: 'create-only' } });
			expect(saved.kind).toBe('captured');
			if (saved.kind !== 'captured') throw new Error('save capture failed');
			const reopened = await admitSource(JSON.parse(saved.capture.canonicalJson), { sessionEpoch: 'reopen', acceptedRevision: host.acceptedRevision() });
			expect(reopened.kind).toBe('admitted');
			if (reopened.kind === 'admitted') expect(stageScene(reopened.snapshot).entities).toEqual(stageScene(facade.snapshot()).entities);
		} finally { facade.dispose(); }
	});

	it('Save re-reads the live accepted source after an accepted edit', async () => {
		const { facade, host } = await mounted(await supportedProject([nativeForm('plan', 2)]));
		mountStageAdapter(facade, host, createAdapter);
		const services = createStageAdapterServices(facade, host);
		const stale = formCardController(services, 'form-plan')!;
		try {
			expect((await formCardController(services, 'form-plan')!.size([2, 1, 1])).kind).toBe('installed');
			const live = stageScene(facade.snapshot()).entities.find((entity) => entity.id === 'form-plan');
			expect(live?.kind).toBe('form');
			if (live?.kind !== 'form') return;
			const sent: { form: unknown }[] = [];
			const depth = host.history().depth;
			const outcome = await stale.save({
				save: async (payload: { form: unknown }) => {
					sent.push(payload);
					return {
						id: '11111111-1111-4111-8111-111111111111',
						name: 'plan form',
						kind: 'form' as const,
						formatVersion: 1,
						contentId: `sha256-${'b'.repeat(64)}`,
						createdAt: '2026-10-28T12:00:00.000Z'
					};
				}
			} as never);
			expect(outcome.kind).toBe('accepted');
			expect(sent[0]?.form).toEqual(live.form);
			expect(host.history().depth).toBe(depth);
		} finally {
			facade.dispose();
		}
	});

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
		taskId: 'scene-place' | null = null,
		project?: ProjectEnvelope,
		rect: typeof RECT = RECT,
		reading: '3d' | 'plan' = '3d',
		selectedEntityId = FIXTURE_ENTITY_ID
	) {
		const { facade, host, rendered } = await mounted(project, rect);
		if (reading === 'plan') {
			facade.camera.applyIntent({ kind: 'set-reading', reading }, 2);
			facade.camera.evaluate(rect, 3);
		}
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
		const reference = sceneEntityReference(selectedEntityId, snapshot.domain.unitRevisions.scene);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		if (taskId !== null) facade.openContributedTask(taskId, 'scene');
		return { facade, host, rendered, session, evaluationId, evaluation, intents, snapshot };
	}

	/** The admitted mark a test presses, by role and optional id. */
	function markOf(
		facade: ReturnType<typeof createStageFacade>,
		id: string
	): ReturnType<ReturnType<typeof createStageFacade>['marks']>[number] {
		const mark = facade.marks().find((candidate) => candidate.id === id);
		if (mark === undefined) throw new Error(`the fixture has no mark "${id}"`);
		return mark;
	}

	function stageCssOf(facade: ReturnType<typeof createStageFacade>, point: Vec3): [number, number] {
		const [x, y] = cssOf(facade, point);
		const rect = facade.evaluation()!.rect;
		return [x - rect.left, y - rect.top];
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

	it('claims a selected object body press in Plan and keeps the grab point under the pointer', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, rendered, evaluationId } = await withSceneSurface(undefined, null, project, RECT, 'plan');
		const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
		body.position.set(2, 0.5, 2);
		const unregister = rendered.register(FIXTURE_ENTITY_ID, body);
		facade.setDrafting({ snap: false });
		const press = stageCssOf(facade, [1.65, 0, 1.85]);
		const target = stageCssOf(facade, [2.65, 0, 2.35]);
		expect(facade.hitMark({ css: press, coarse: false })).toBeNull();
		const bodyPick = facade.resolvePick({ evaluationId, css: press, purpose: 'select', tool: null });
		expect(bodyPick.kind === 'resolved' ? bodyPick.hit.sourceId : null).toBe(FIXTURE_ENTITY_ID);

		expect(facade.pointerIntent({ phase: 'down', css: press, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		expect(facade.ghosts()[0]?.center[0]).toBeCloseTo(3, 6);
		expect(facade.ghosts()[0]?.center[2]).toBeCloseTo(2.5, 6);
		facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await eventually(() => {
			const entity = stageScene(facade.snapshot()).entities.find((entry) => entry.id === FIXTURE_ENTITY_ID);
			return entity !== undefined && Math.abs(entity.position[0] - 3) < 1e-9;
		});
		expect(stageScene(facade.snapshot()).entities.find((entry) => entry.id === FIXTURE_ENTITY_ID)?.position)
			.toEqual([3, 0.5, 2.5]);
		unregister();
		body.geometry.dispose();
	});

	it('keeps screen-sized marks and direct Move on a subject under 48 CSS px', async () => {
		const base = boxEntity(FIXTURE_ENTITY_ID, [2, 0.15, 2]);
		const small: SceneEntity = {
			...base,
			dimensions: { width: 0.3, height: 0.3, depth: 0.3 }
		};
		const project = await supportedProject([small]);
		const { facade, rendered, evaluationId } = await withSceneSurface(
			undefined,
			null,
			project,
			RECT,
			'plan'
		);
		const body = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), new MeshBasicMaterial());
		body.position.fromArray(small.position);
		const unregister = rendered.register(FIXTURE_ENTITY_ID, body);
		const corners = [
			cssOf(facade, [1.85, 0, 1.85]),
			cssOf(facade, [2.15, 0, 1.85]),
			cssOf(facade, [1.85, 0, 2.15]),
			cssOf(facade, [2.15, 0, 2.15])
		];
		const width = Math.max(...corners.map(([x]) => x)) - Math.min(...corners.map(([x]) => x));
		const height = Math.max(...corners.map(([, y]) => y)) - Math.min(...corners.map(([, y]) => y));
		expect(Math.max(width, height)).toBeLessThan(48);

		const move = markOf(facade, 'scene-object-move');
		expect(move.tip).not.toBeNull();
		expect(Math.hypot(move.tip![0] - move.anchor[0], move.tip![1] - move.anchor[1])).toBeCloseTo(30, 3);
		facade.setDrafting({ snap: false });
		// The Move track runs through the body center; this point stays inside the
		// small silhouette while sitting beyond its 11 px fine hit radius.
		const press: [number, number] = [move.anchor[0], move.anchor[1] - 13];
		const target = stageCssOf(facade, [2.5, 0, 2.4]);
		expect(facade.hitMark({ css: press, coarse: false })).toBeNull();
		expect(facade.resolvePick({ evaluationId, css: press, purpose: 'select', tool: null })).toMatchObject({
			kind: 'resolved',
			hit: { sourceId: FIXTURE_ENTITY_ID }
		});
		expect(facade.pointerIntent({ phase: 'down', css: press, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		expect(facade.ghosts()[0]?.center[0]).toBeCloseTo(2.5, 6);
		expect(facade.ghosts()[0]?.center[2]).toBeGreaterThan(2.4);
		facade.pointerIntent({ phase: 'cancel', css: target, evaluationId });
		unregister();
		body.geometry.dispose();
	});

	it('claims a selected native form body press in Plan without requiring a Move mark hit', async () => {
		const project = await supportedProject([nativeForm('plan', 2)]);
		const { facade, evaluationId } = await withSceneSurface(
			undefined,
			null,
			project,
			RECT,
			'plan',
			'form-plan'
		);
		facade.setDrafting({ snap: false });
		const press = stageCssOf(facade, [2.25, 0, 3.2]);
		const target = stageCssOf(facade, [2.75, 0, 3.7]);

		expect(facade.pointerIntent({ phase: 'down', css: press, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		expect(facade.ghosts()[0]?.center[0]).toBeCloseTo(2.5, 6);
		expect(facade.ghosts()[0]?.center[2]).toBeCloseTo(3.5, 6);
		facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await eventually(() => {
			const entity = stageScene(facade.snapshot()).entities.find((entry) => entry.id === 'form-plan');
			return entity !== undefined && Math.abs(entity.position[0] - 2.5) < 1e-9;
		});
		expect(stageScene(facade.snapshot()).entities.find((entry) => entry.id === 'form-plan')?.position)
			.toEqual([2.5, 0, 3.5]);
	});

	it('draws the Paper candidate polygon from the same pose and footprint as the planner candidate', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, session, evaluationId } = await withSceneSurface(
			undefined,
			null,
			project,
			RECT,
			'plan'
		);
		expect(session.begin(FIXTURE_ENTITY_ID).kind).toBe('idle');
		expect(session.setEntry('x', '4').kind).toBe('candidate');
		expect(session.setEntry('z', '4').kind).toBe('candidate');
		const candidate = session.candidate();
		if (candidate === null) throw new Error('the typed Move did not create a candidate');

		const accepted = stageScene(facade.snapshot()).entities.find((entity) => entity.id === FIXTURE_ENTITY_ID)!;
		const candidateEntity = {
			...accepted,
			position: [...candidate.position] as Vec3,
			rotation: [...candidate.rotation] as Vec3,
			scale: candidate.scale
		};
		const footprint = buildPlanSceneFootprintProjection({ entities: [candidateEntity] }).footprints[0]!;
		const expected = footprint.points.map(([x, z]) => {
			const projected = facade.projectWorld([x, facade.snapshot().domain.datumMeters, z], evaluationId);
			if (projected.kind !== 'projected') throw new Error('candidate footprint did not project');
			return [projected.css[0], projected.css[1]] as const;
		});
		const paper = facade.candidatePreviews().find((preview) => preview.id === 'scene-candidate-footprint');
		expect(paper?.role).toBe('subject');
		expect(paper?.polygons).toEqual([expected]);
	});

	it('keeps an approved-model candidate footprint equal to its confirmed placement footprint', async () => {
		const { project, ids } = await buildS17MixedProject(`${PROJECT_ID}-candidate-model`);
		const resource = project.units.resources.data.resources.find(
			(entry) => entry.kind === 'model' && entry.id === ids.approvedModelId
		);
		if (resource === undefined) throw new Error('the mixed fixture has no approved creator model');
		const definition = await creatorModelDefinition(resource, 'Approved creator model');
		if (definition === null) throw new Error('the approved fixture model has no placement definition');
		const model: ArmedModelPlacement = { definition, resource: null };
		const { facade, session, evaluationId } = await withSceneSurface(
			undefined,
			'scene-place',
			project,
			RECT,
			'plan',
			ids.approvedModelId
		);
		expect(session.beginPlaceModel(model).kind).toBe('idle');
		expect(session.previewPlaceModel(model, 1.5, 1, 0).kind).toBe('candidate');
		const candidate = session.candidate();
		if (candidate === null) throw new Error('the approved-model placement did not create a candidate');

		const candidateEntity: SceneEntity = {
			kind: 'model',
			id: 'scene-candidate-model',
			name: 'Candidate model',
			assetId: ids.approvedModelId,
			fallback: 'generic',
			position: [...candidate.position] as Vec3,
			rotation: [...candidate.rotation] as Vec3
		};
		const acceptedFootprint = buildPlanSceneFootprintProjection(
			{ entities: [candidateEntity] },
			{ modelFootprintById: () => candidate.footprint }
		).footprints[0];
		if (acceptedFootprint === undefined) throw new Error('the approved model has no accepted Paper footprint');
		const expected = acceptedFootprint.points.map(([x, z]) => {
			const projected = facade.projectWorld([x, facade.snapshot().domain.datumMeters, z], evaluationId);
			if (projected.kind !== 'projected') throw new Error('the approved candidate footprint did not project');
			return [projected.css[0], projected.css[1]] as const;
		});
		const paper = facade.candidatePreviews().find((preview) => preview.id === 'scene-candidate-footprint');
		expect(paper?.role).toBe('subject');
		expect(paper?.polygons).toEqual([expected]);
		expect(candidate.footprint).toEqual(resource.model?.placement.footprint);
	});

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
		return { facade, host };
	}

	/** A real acceptance host with no task open, so the object marks are live. */
	async function acceptedMarksSurface() {
		const { facade, host } = await acceptedPlaceSurface();
		facade.closeTask();
		const snapshot = facade.snapshot();
		const reference = sceneEntityReference(FIXTURE_ENTITY_ID, snapshot.domain.unitRevisions.scene);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		return { facade, host };
	}


	it('publishes the candidate as a ghost mesh in the shared Canvas and withdraws it', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, evaluationId } = await withSceneSurface(undefined, null, project);
		expect(facade.ghosts()).toEqual([]);
		const turn = markOf(facade, 'scene-object-turn');
		const css = turn.anchor;
		expect(facade.pointerIntent({ phase: 'down', css, evaluationId, handleId: turn.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: [css[0] + 40, css[1]], evaluationId });
		const ghosts = facade.ghosts();
		expect(ghosts).toHaveLength(1);
		expect(ghosts[0]).toMatchObject({
			id: 'scene-candidate',
			shape: { kind: 'box', size: [1, 1, 1] }
		});
		// The ghost is the object's own body at the captured pose, not a marker.
		expect(ghosts[0]!.center[0]).toBeCloseTo(2, 6);
		expect(ghosts[0]!.center[1]).toBeCloseTo(0.5, 6);
		expect(Number.isFinite(ghosts[0]!.yaw)).toBe(true);

		// Cancel withdraws the pose, so the Canvas draws no stale body.
		facade.pointerIntent({ phase: 'cancel', css: [css[0] + 40, css[1]], evaluationId });
		expect(facade.ghosts()).toEqual([]);
	});

	it('moves from Stage-local pointer CSS through an offset viewport and commits the ghost pose', async () => {
		const rect = { left: 352, top: 119, width: 928, height: 458, devicePixelRatio: 1 };
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, evaluationId } = await withSceneSurface(
			undefined,
			null,
			project,
			rect
		);
		facade.setDrafting({ snap: false });
		const move = markOf(facade, 'scene-object-move');
		// +page.svelte sends Stage-local CSS, while projectWorld returns viewport CSS.
		const local = stageCssOf(facade, [2.6, 0, 2.4]);

		expect(facade.pointerIntent({ phase: 'down', css: move.anchor, evaluationId, handleId: move.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: local, evaluationId });
		const ghost = facade.ghosts()[0];
		expect(ghost).toBeDefined();
		expect(ghost!.center[0]).toBeCloseTo(2.6, 5);
		expect(ghost!.center[2]).toBeCloseTo(2.4, 5);

		facade.pointerIntent({ phase: 'up', css: local, evaluationId });
		await eventually(() => Math.abs(facade.snapshot().domain.scene.entities[0]!.position[0] - 2.6) < 1e-9);
		expect(facade.snapshot().domain.scene.entities[0]!.position[0]).toBeCloseTo(2.6, 5);
		expect(facade.snapshot().domain.scene.entities[0]!.position[2]).toBeCloseTo(2.4, 5);
		expect(
			facade.acquireGesture({ owner: 'probe', evaluationId, policy: 'cancel-on-reading-change' }).kind
		).toBe('granted');
	});

	it('keeps a typed candidate, its surface and its drawn pose across an ordinary re-evaluation', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, session, evaluationId, intents } = await withSceneSurface(
			undefined,
			null,
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
		const { session } = await withSceneSurface(undefined, null, project);
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
		const { facade, evaluationId, intents } = await withSceneSurface(
			undefined,
			null,
			project
		);
		const move = markOf(facade, 'scene-object-move');
		const clear = stageCssOf(facade, [2.5, 0, 2.5]);
		const blocked = stageCssOf(facade, [5, 1.5, 3]);

		expect(facade.pointerIntent({ phase: 'down', css: move.anchor, evaluationId, handleId: move.id }).claimed).toBe(true);
		expect(facade.pointerIntent({ phase: 'move', css: clear, evaluationId }).claimed).toBe(true);
		expect(facade.ghosts()).toHaveLength(1);

		// The same drag now aims at the occluder. The previous pose is not what a
		// release here would install, so it must stop being committable.
		facade.pointerIntent({ phase: 'move', css: blocked, evaluationId });
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
		// The preview uses the live adaptive Grid/Snap minor; it is the exact pose
		// the planner will commit, with no commit-time correction.
		const drafting = facade.drafting();
		const expected = snapDraftingPlacement([3.5, 3], draftingSnapIncrementMeters(drafting));
		expect(movedPreview.worldXZ[0]).toBeCloseTo(expected.x, 6);
		expect(movedPreview.worldXZ[1]).toBeCloseTo(expected.z, 6);
		// Only the plan position rounds; the support-resolved Y and retained yaw do not.
		expect(movedPreview.position[1]).toBeCloseTo(preview!.position[1], 9);
		expect(movedPreview.yaw).toBe(0);
		expect(movedPreview.snappedStep).toBe(expected.snappedStep);

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

	it.each([
		{ name: 'Snap off', patch: { snap: false } },
		{ name: 'Snap held', patch: { snapSuspended: true } }
	])('commits the raw pointer Place when $name', async ({ patch }) => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, session, evaluationId } = await withSceneSurface(
			undefined,
			'scene-place',
			project
		);
		facade.setDrafting(patch);
		const css = cssOf(facade, [3.37, 0, 2.81]);
		expect(facade.pointerIntent({ phase: 'down', css, evaluationId }).claimed).toBe(true);
		const candidate = session.candidate();
		expect(candidate?.kind).toBe('place');
		if (candidate === null) return;
		expect(candidate.worldXZ[0]).toBeCloseTo(3.37, 6);
		expect(candidate.worldXZ[1]).toBeCloseTo(2.81, 6);
		expect(candidate.snappedStep).toBeNull();
		facade.pointerIntent({ phase: 'cancel', css, evaluationId });
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

	it('shows an off-floor Place refusal at the pointer and writes nothing on release', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const offsetRect = { left: 352, top: 119, width: 928, height: 458, devicePixelRatio: 1 };
		const { facade, session, evaluationId, intents } = await withSceneSurface(
			undefined,
			'scene-place',
			project,
			offsetRect
		);
		// Both points lie on the floor plane the pointer ray reaches; the outside
		// press remains claimable so the creator can drag onto a supported Room floor.
		const inside = stageCssOf(facade, [3, 0, 3]);
		const outside = stageCssOf(facade, [3.5, 0, 7.5]);

		expect(facade.pointerIntent({ phase: 'down', css: outside, evaluationId }).claimed).toBe(true);
		expect(session.candidate()).toBeNull();
		expect(facade.ghosts()).toHaveLength(1);
		expect(facade.ghosts()[0]?.treatment).toBe('refused');
		expect(facade.overlays().find((marker) => marker.id === 'scene-candidate-refusal')?.css).toEqual(outside);
		facade.pointerIntent({ phase: 'up', css: outside, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(intents).toEqual([]);

		// The point inside the Room floor replaces refusal with a committable pose.
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
		// Raw x = 6.8 is inside the Room floor (max 6.9); the shared 0.5 m
		// current minor snaps it to 7 m, outside support.
		const raw = cssOf(facade, [6.8, 0, 3]);
		expect(facade.pointerIntent({ phase: 'down', css: raw, evaluationId }).claimed).toBe(true);
		expect(session.candidate()).toBeNull();
		expect(facade.ghosts()[0]?.treatment).toBe('refused');
		facade.pointerIntent({ phase: 'up', css: raw, evaluationId });
	});

	it('publishes Move, Turn, the Scale disclosure and the Size ray it reveals', async () => {
		const { facade } = await withSceneSurface();
		const marks = facade.marks();
		expect(marks.map((mark) => mark.id)).toEqual([
			'scene-object-scale-point',
			'scene-object-move',
			'scene-object-turn'
		]);
		expect(marks.find((mark) => mark.id === 'scene-object-size')).toBeUndefined();
		expect(marks.every((mark) => mark.adapterId === 'scene')).toBe(true);
		expect(marks.find((mark) => mark.id === 'scene-object-move')?.descriptor).toMatchObject({
			role: 'edit',
			fact: 'position',
			planner: 'place-on-floor'
		});
		expect(marks.find((mark) => mark.id === 'scene-object-turn')?.descriptor).toMatchObject({
			role: 'edit',
			fact: 'yaw',
			planner: 'set-yaw'
		});
		// The fixture box's contact is -0.5 m at unit scale, so its ring is on the
		// floor beneath the centre. The press plane is that elevation, not the
		// centre the old hit test used.
		const entity = facade.snapshot().domain.scene.entities[0]!;
		expect(marks.find((mark) => mark.id === 'scene-object-turn')?.descriptor.anchor).toEqual(
			[entity.position[0], entity.position[1] - 0.5, entity.position[2]]
		);
		expect(marks.find((mark) => mark.id === 'scene-object-scale-point')?.descriptor).toMatchObject({
			role: 'disclose',
			reveals: ['scene-object-size']
		});
		expect(
			hitStageMark(marks, {
				css: marks.find((mark) => mark.id === 'scene-object-scale-point')!.anchor,
				coarse: false
			})?.id
		).toBe('scene-object-scale-point');

		// A disclosure is session view state: it writes no source and enters no
		// history, so Undo remains exactly what it was before activation.
		const canonical = facade.snapshot().canonicalJson;
		expect(facade.activateDisclosure('scene-object-scale-point')).toBe(true);
		const size = facade.marks().find((mark) => mark.id === 'scene-object-size');
		expect(size?.descriptor).toMatchObject({
			role: 'edit',
			fact: 'scale',
			planner: 'resize-on-floor',
			disclosedBy: 'scene-object-scale-point'
		});
		const sizeRayProbe: [number, number] = [
			size!.anchor[0] + (size!.tip![0] - size!.anchor[0]) * 0.75,
			size!.anchor[1] + (size!.tip![1] - size!.anchor[1]) * 0.75
		];
		expect(hitStageMark(facade.marks(), { css: sizeRayProbe, coarse: false })?.id).toBe(
			'scene-object-size'
		);
		expect(facade.snapshot().canonicalJson).toBe(canonical);
		expect(facade.closeDisclosure()).toBe(true);
		expect(facade.marks().some((mark) => mark.id === 'scene-object-size')).toBe(false);
	});

	it('commits one Move entry and honours the S05 snap step', async () => {
		const { facade, host } = await acceptedMarksSurface();
		const evaluationId = facade.evaluationId()!;
		// Leave a stale Place-session mirror behind, then close Place and change the
		// shared Stage setting after the Move capture. Move must read the live host
		// fact, never this local 0.5 m value.
		expect(facade.openContributedTask('scene-place', 'scene').kind).toBe('opened');
		const placeStart = stageCssOf(facade, [2.5, 0, 2.5]);
		facade.pointerIntent({ phase: 'down', css: placeStart, evaluationId });
		const placeSurface = sceneSurfaceFor(facade.snapshot(), facade.evaluation()!);
		expect(placeSurface?.session.snapStep()).toBe(0.5);
		expect(facade.closeTask()).toBe(true);
		// Model a still-live stale local mirror after task teardown; it is not the
		// source of truth for the no-task object mark surface.
		placeSurface!.session.setSnapStep(0.5);
		facade.setDrafting({ snap: true });

		const move = markOf(facade, 'scene-object-move');
		const target = stageCssOf(facade, [3.62, 0, 2.54]);
		const depth = host.history().depth;
		expect(facade.pointerIntent({ phase: 'down', css: move.anchor, evaluationId, handleId: move.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		expect(facade.ghosts()[0]!.center[0]).toBe(3.5);
		expect(facade.ghosts()[0]!.center[2]).toBe(2.5);
		facade.setDrafting({ snap: false });
		expect(placeSurface?.session.snapStep()).toBe(0.5);
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		const ghost = facade.ghosts()[0];
		expect(ghost).toBeDefined();
		// Numeric expectations are independent of the production rounding helpers: the
		// live Switch is off, so the Move poses the raw pointer point.
		expect(ghost!.center[0]).toBe(3.62);
		expect(ghost!.center[2]).toBe(2.54);
		facade.setDrafting({ snap: true });
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		expect(facade.ghosts()[0]!.center[0]).toBe(3.5);
		expect(facade.ghosts()[0]!.center[2]).toBe(2.5);
		facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await eventually(() => facade.snapshot().domain.scene.entities[0]?.position[0] === 3.5);
		const live = facade.snapshot().domain.scene.entities[0]!;
		expect(live.position[0]).toBe(3.5);
		expect(live.position[2]).toBe(2.5);
		expect(host.history().depth).toBe(depth + 1);
		const acceptedPosition = host.history().position;
		expect((await host.undo()).kind).toBe('installed');
		expect(facade.snapshot().domain.scene.entities[0]!.position).toEqual([2, 0.5, 2]);
		expect(host.history().depth).toBe(depth + 1);
		expect(host.history().position).toBe(acceptedPosition - 1);
	});

	it('keeps Move numeric for Snap off and Alt/Option hold, and refuses a snapped floor boundary', async () => {
		for (const state of [
			{ snap: false, snapSuspended: false },
			{ snap: true, snapSuspended: true }
		]) {
			const { facade } = await acceptedMarksSurface();
			facade.setDrafting({ ...state });
			const evaluationId = facade.evaluationId()!;
			const move = markOf(facade, 'scene-object-move');
			const target = stageCssOf(facade, [2.62, 0, 2.54]);
			expect(facade.pointerIntent({ phase: 'down', css: move.anchor, evaluationId, handleId: move.id }).claimed).toBe(true);
			facade.pointerIntent({ phase: 'move', css: target, evaluationId });
			expect(facade.ghosts()[0]!.center[0]).toBe(2.62);
			expect(facade.ghosts()[0]!.center[2]).toBe(2.54);
			facade.pointerIntent({ phase: 'cancel', css: target, evaluationId });
			facade.dispose();
		}

		const { facade, host } = await acceptedMarksSurface();
		facade.setDrafting({ snap: true });
		const evaluationId = facade.evaluationId()!;
		const move = markOf(facade, 'scene-object-move');
		// Raw aim is inside the 7 × 6 m Room floor; snapping Z to exactly 6 m
		// reaches its boundary, which the accepted planner must refuse.
		const boundary = stageCssOf(facade, [6.8, 0, 5.8]);
		const source = facade.snapshot().canonicalJson;
		const depth = host.history().depth;
		expect(facade.pointerIntent({ phase: 'down', css: move.anchor, evaluationId, handleId: move.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: boundary, evaluationId });
		expect(facade.ghosts()).toEqual([]);
		facade.pointerIntent({ phase: 'up', css: boundary, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(facade.snapshot().canonicalJson).toBe(source);
		expect(host.history().depth).toBe(depth);
	});

	it('commits one Turn entry through the yaw planner', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, evaluationId } = await withSceneSurface(undefined, null, project);
		const turn = markOf(facade, 'scene-object-turn');
		const target: [number, number] = [turn.anchor[0] + 50, turn.anchor[1]];
		expect(facade.pointerIntent({ phase: 'down', css: turn.anchor, evaluationId, handleId: turn.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		expect(facade.ghosts()).toHaveLength(1);
		facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await eventually(() => facade.snapshot().domain.scene.entities[0]!.rotation[1] !== 0);
		expect(Number.isFinite(facade.snapshot().domain.scene.entities[0]!.rotation[1])).toBe(true);
	});

	it('commits one Size entry only after the Scale point reveals the ray and keeps the base on its support', async () => {
		const { facade, host } = await acceptedMarksSurface();
		const before = host.history().depth;
		expect(facade.activateDisclosure('scene-object-scale-point')).toBe(true);
		const size = markOf(facade, 'scene-object-size');
		expect(size.tip).not.toBeNull();
		const evaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', css: size.anchor, evaluationId, handleId: size.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: size.tip!, evaluationId });
		facade.pointerIntent({ phase: 'up', css: size.tip!, evaluationId });
		await eventually(() => (facade.snapshot().domain.scene.entities[0] as { scale?: number }).scale !== undefined);
		const scaled = facade.snapshot().domain.scene.entities[0] as { scale?: number; position: Vec3 };
		expect(scaled.scale).toBeGreaterThan(1);
		// A box's authored contact is -0.5 m; at scale s the planner re-seats its
		// centre at 0.5 s so the base stays on the compiled support at Y = 0.
		expect(scaled.position[1] + scaled.scale! * -0.5).toBeCloseTo(0, 6);
		expect(host.history().depth).toBe(before + 1);
	});

	it('writes the same Position, Yaw and Size facts through the Card controller', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, host } = await withSceneSurface(undefined, null, project);
		const services = createStageAdapterServices(facade, host);
		const controller = sceneObjectCardController(services, FIXTURE_ENTITY_ID);
		expect(controller).not.toBeNull();
		expect(controller!.fields().map((field) => field.id)).toEqual([
			'position-x',
			'position-z',
			'yaw',
			'size'
		]);

		// The Card field set and the mark fact set are the same declaration. The
		// Size fact is published once its disclosure reveals the ray.
		expect(facade.activateDisclosure('scene-object-scale-point')).toBe(true);
		const fieldFacts = new Set(
			controller!.fields().map((field) =>
				field.id === 'position-x' || field.id === 'position-z'
					? 'position'
					: field.id === 'yaw'
						? 'yaw'
						: 'scale'
			)
		);
		const markFacts = new Set(
			facade
				.marks()
				.filter((mark) => mark.role === 'edit')
				.map((mark) => mark.fact)
		);
		expect(fieldFacts).toEqual(markFacts);

		controller!.edit('size', '0');
		expect(controller!.fields().find((field) => field.id === 'size')?.error).toBeTruthy();
		const beforeRefusal = host.history().depth;
		const beforeRefusalSource = facade.snapshot().canonicalJson;
		await expect(controller!.commit('size')).resolves.toMatchObject({ kind: 'refused' });
		expect(host.history().depth).toBe(beforeRefusal);
		expect(facade.snapshot().canonicalJson).toBe(beforeRefusalSource);

		// Blur never writes: the accepted value returns and the draft is gone.
		const acceptedX = controller!.fields().find((field) => field.id === 'position-x')!.text;
		controller!.edit('position-x', '9.5');
		controller!.blur('position-x');
		expect(controller!.fields().find((field) => field.id === 'position-x')?.text).toBe(acceptedX);
		controller!.edit('position-x', '9.5');
		expect(controller!.cancel('position-x')).toBe(true);
		expect(controller!.fields().find((field) => field.id === 'position-x')?.text).toBe(acceptedX);

		controller!.edit('yaw', '90');
		expect(controller!.fields().find((field) => field.id === 'yaw')?.error).toBeNull();
		await expect(controller!.commit('yaw')).resolves.toMatchObject({ kind: 'accepted' });
		await eventually(() => Math.abs(facade.snapshot().domain.scene.entities[0]!.rotation[1] - Math.PI / 2) < 1e-9);
		expect(facade.snapshot().domain.scene.entities[0]!.rotation[1]).toBeCloseTo(Math.PI / 2, 9);
	});

	it('publishes the same object mark vocabulary for a catalogue model', () => {
		const model = {
			kind: 'model' as const,
			id: 'model-mark-fixture',
			name: 'Piano',
			assetId: 'paris-grand-piano',
			fallback: 'piano' as const,
			position: [2, 0, 2] as Vec3,
			rotation: [0, 0, 0] as Vec3,
			scale: 1
		};
		const descriptors = sceneObjectMarkDescriptors({
			entity: model,
			contactMinY: 0,
			bounds: { min: [1, 0, 1], max: [3, 1.2, 3] },
			footprint: { width: 2, depth: 2 }
		});
		expect(descriptors.map((descriptor) => descriptor.id)).toEqual([
			'scene-object-scale-point',
			'scene-object-size',
			'scene-object-move',
			'scene-object-turn'
		]);
		expect(descriptors.find((descriptor) => descriptor.id === 'scene-object-size')).toMatchObject({
			planner: 'resize-on-floor',
			fact: 'scale'
		});
	});

	it.each(['3d', 'plan'] as const)('keeps the approved creator model Turn mark in %s', async (reading) => {
		const { project, ids } = await buildS17MixedProject();
		const { facade } = await withSceneSurface(undefined, null, project, RECT, reading, ids.approvedModelId);
		try {
			expect(facade.marks().map((mark) => mark.id)).toEqual(
				expect.arrayContaining(['scene-object-move', 'scene-object-turn'])
			);
		} finally {
			facade.dispose();
		}
	});

	it('removes the Arrange task, its Find entry and instrument posture', async () => {
		const { facade } = await withSceneSurface();
		const tasks = facade.tasks().filter((task) => task.adapterId === 'scene');
		expect(tasks.map((task) => task.taskKind)).toEqual([
			'scene-compose',
			'place-object',
			'import-model'
		]);
		const findEntries = facade.findEntries().filter((entry) => entry.adapterId === 'scene');
		expect(findEntries.some((entry) => entry.taskKind === 'scene-arrange' || entry.id === 'scene-arrange')).toBe(false);
		expect(facade.openContributedTask('scene-arrange', 'scene').kind).not.toBe('opened');
		// Place and Library keep their entries.
		expect(findEntries.some((entry) => entry.taskKind === 'place-object')).toBe(true);
		expect(findEntries.some((entry) => entry.taskKind === 'import-model')).toBe(true);

		const writer = facade.cardWriter({
			sourceId: FIXTURE_ENTITY_ID,
			sourceKind: 'entity',
			ref: null,
			reference: sceneEntityReference(FIXTURE_ENTITY_ID, facade.snapshot().domain.unitRevisions.scene)
		});
		expect(writer?.summary).toBe('Object fields');
	});

	it('keeps Duplicate and Delete as object Card actions on a real host', async () => {
		const { facade } = await acceptedMarksSurface();
		const subject = () => ({
			sourceId: FIXTURE_ENTITY_ID,
			sourceKind: 'entity' as const,
			ref: null,
			reference: sceneEntityReference(
				FIXTURE_ENTITY_ID,
				facade.snapshot().domain.unitRevisions.scene
			)
		});
		const actions = facade.cardActions(subject());
		expect(actions.map((action) => action.id)).toEqual(
			expect.arrayContaining(['scene-object-duplicate', 'scene-object-delete'])
		);
		const duplicate = actions.find((action) => action.id === 'scene-object-duplicate');
		expect(duplicate?.destructive).toBeUndefined();
		await expect(duplicate!.run()).resolves.toMatchObject({ kind: 'accepted' });
		await eventually(() => facade.snapshot().domain.scene.entities.length === 2);
		const copy = facade.snapshot().domain.scene.entities.find(
			(entity) => entity.id !== FIXTURE_ENTITY_ID
		);
		expect(copy).toBeDefined();
		expect(facade.selectionState().primary?.subject.id).toBe(copy!.id);
		// The installed source invalidates the live evaluation; the next frame
		// rebuilds the binding against the copy before its Card actions are read.
		facade.camera.evaluate(RECT, 2);

		const deleteSubject = () => ({
			...subject(),
			sourceId: copy!.id,
			reference: sceneEntityReference(
				copy!.id,
				facade.snapshot().domain.unitRevisions.scene
			)
		});
		await eventually(
			() => facade.cardActions(deleteSubject()).some((action) => action.id === 'scene-object-delete')
		);
		const deleteAction = facade
			.cardActions(deleteSubject())
			.find((action) => action.id === 'scene-object-delete');
		expect(deleteAction?.destructive).toBe(true);
		await expect(deleteAction!.run()).resolves.toMatchObject({ kind: 'accepted' });
		await eventually(() => facade.snapshot().domain.scene.entities.length === 1);
	});

	it('hides object marks while a contributed task owns the surface', async () => {
		const { facade } = await withSceneSurface();
		expect(facade.marks().length).toBeGreaterThan(0);
		expect(facade.openContributedTask('scene-compose', 'scene').kind).toBe('opened');
		expect(facade.marks()).toEqual([]);
		facade.closeTask();
		expect(facade.marks().map((mark) => mark.id)).toContain('scene-object-move');
	});

	it('installs the same Scene source from a dragged Move and typed Position fields', async () => {
		const dragged = await acceptedMarksSurface();
		dragged.facade.setDrafting({ snap: false });
		const draggedMove = markOf(dragged.facade, 'scene-object-move');
		const draggedTarget = stageCssOf(dragged.facade, [2.6, 0, 2.4]);
		const draggedEvaluation = dragged.facade.evaluationId()!;
		expect(
			dragged.facade.pointerIntent({
				phase: 'down',
				css: draggedMove.anchor,
				evaluationId: draggedEvaluation,
				handleId: draggedMove.id
			}).claimed
		).toBe(true);
		dragged.facade.pointerIntent({ phase: 'move', css: draggedTarget, evaluationId: draggedEvaluation });
		dragged.facade.pointerIntent({ phase: 'up', css: draggedTarget, evaluationId: draggedEvaluation });
		await eventually(
			() => Math.abs(stageScene(dragged.facade.snapshot()).entities[0]!.position[0] - 2.6) < 1e-9
		);

		const typed = await acceptedMarksSurface();
		const typedController = sceneObjectCardController(
			createStageAdapterServices(typed.facade, typed.host),
			FIXTURE_ENTITY_ID
		)!;
		typedController.edit('position-x', '2.6');
		await expect(typedController.commit('position-x')).resolves.toMatchObject({ kind: 'accepted' });
		typedController.edit('position-z', '2.4');
		await expect(typedController.commit('position-z')).resolves.toMatchObject({ kind: 'accepted' });
		await eventually(
			() => Math.abs(stageScene(typed.facade.snapshot()).entities[0]!.position[2] - 2.4) < 1e-9
		);

		expect(JSON.stringify(stageScene(typed.facade.snapshot()))).toBe(
			JSON.stringify(stageScene(dragged.facade.snapshot()))
		);
	});

	it('commits one F4 entry for a mark release on a real acceptance host', async () => {
		const { facade, host } = await acceptedMarksSurface();
		facade.setDrafting({ snap: false });
		const before = host.history().depth;
		const move = markOf(facade, 'scene-object-move');
		const target = stageCssOf(facade, [2.6, 0, 2.4]);
		const evaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', css: move.anchor, evaluationId, handleId: move.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await eventually(() => Math.abs(facade.snapshot().domain.scene.entities[0]!.position[0] - 2.6) < 1e-9);
		expect(host.history().depth).toBe(before + 1);
	});
});
