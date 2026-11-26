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
import { tagRenderIdentity } from '$lib/render/render-identity';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { buildFormGeometry } from '$lib/render/entities/form-geometry';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneDocument, SceneEntity, ScenePrimitiveEntity, Vec3 } from '@portfolio/project-model/scene';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core/wall';
import { planCreateRegion } from '@portfolio/layout-core/room';
import type { ViewportEvaluation } from '@portfolio/camera-core/viewport';

import {
	createSceneSession,
	localContactMinY,
	publishSceneSurface,
	sceneEntityReference,
	sceneModelContactMinY,
	sceneReadingKey,
	sceneSurfaceFor,
	type ArmedFormCopy,
	type ArmedModelPlacement,
	type ScenePlacementSession,
	type SceneWritePort
} from '$lib/authoring/adapters/scene/placement';
import { stageEnvelope, stageLayout, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { sceneObjectCommands } from '../__fixtures__/scene-object-commands';
import { sceneObjectCardController } from '$lib/authoring/adapters/scene/object-card';
import { SCENE_OBJECT_MARK, sceneObjectMarkDescriptors } from '$lib/authoring/adapters/scene/object-marks';
import { buildPlanSceneFootprintProjection } from '$lib/authoring/scene/plan-scene-footprint';
import { catalogueModelDefinition } from '$lib/authoring/scene/object-definition-policy';
import { draftingSnapIncrementMeters, snapDraftingPlacement } from '$lib/authoring/stage/stage-drafting';
import { armTile } from '$lib/authoring/adapters/scene/shape/armed-tile';
import { captureUnitSave } from '@portfolio/project-model/units';
import { canonicalFormLibraryPayload } from '@portfolio/project-model/library';
import { creatorModelDefinition, creatorModelResourceEntry } from '@portfolio/project-model/scene-planning';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { hitStageMark } from '$lib/authoring/stage/stage-handles';
import { buildCurrentSourceFixture, FIXTURE_ENTITY_ID, FIXTURE_PROJECT_ID } from '../__fixtures__/f4-current-source-fixtures';
import { buildS17MixedProject } from '../__fixtures__/s17-mixed-project';
import { admitUnitProject, createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';

const ENTITY_ID = 'entity-scene-box';
const PROJECT_ID = 'project-scene-editing';
// These pin existing Place; a drawn tile is a separate route (shape-draw-session).
beforeEach(() => {
	armTile(PROJECT_ID, null);
	armTile(FIXTURE_PROJECT_ID, null);
});
const BASELINE: Vec3 = [2, 0.5, 2];
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

async function supportedProject(
	entities: readonly SceneEntity[],
	modelEntry?: NonNullable<ReturnType<typeof creatorModelResourceEntry>>,
	region?: { readonly footprint: [number, number][]; readonly elevation: number }
): Promise<ProjectEnvelope> {
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
	let layout = planned.document;
	if (region !== undefined) {
		const created = planCreateRegion({
			baseline: layout,
			capture: freshCapture(),
			intent: {
				role: 'floor',
				footprint: region.footprint,
				elevation: region.elevation,
				thickness: 0.2
			}
		});
		if (created.kind !== 'success') throw new Error('the region fixture was refused');
		layout = created.document;
	}
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'Scene editing',
		layout,
		...(modelEntry === undefined
			? {}
			: { resources: { formatVersion: 3 as const, resources: [modelEntry.resource] } }),
		scene: { formatVersion: 1, textures: [], materials: [], entities: [...entities], navigationNodes: [], connections: [] }
	});
	return modelEntry === undefined
		? project
		: { ...project, dependencyLock: { ...project.dependencyLock, entries: [modelEntry.lock] } };
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
	port: TestPort = writePort(),
	contactMinYFor?: (entity: SceneEntity) => number | null,
	modelEntry?: NonNullable<ReturnType<typeof creatorModelResourceEntry>>
): Promise<{ session: ScenePlacementSession; port: TestPort }> {
	const project = await supportedProject(entities, modelEntry);
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
			...(contactMinYFor === undefined ? {} : { contactMinYFor }),
			compileGeneration: 'generation-1',
			evaluationId: 'evaluation-1'
		},
		port,
		mintOperationId: () => `operation-${(sequence += 1)}`
	});
	return { session, port };
}

describe('Scene placement session', () => {
	it('carries an approved model contact on existing Move and Resize candidates', async () => {
		const model: SceneEntity = {
			kind: 'model',
			id: 'entity-contact-model',
			name: 'Bounds-centred model',
			assetId: 's17-approved-model',
			fallback: 'generic',
			position: [2, 0.5, 2],
			rotation: [0, 0, 0],
			scale: 1
		};
		const modelEntry = creatorModelResourceEntry(model.assetId, {
			derivative: { hash: `sha256-${'a'.repeat(64)}`, mime: 'model/gltf-binary', size: 4096, locator: 'models/s17-contact-model.glb' },
			source: { manifestHash: `sha256-${'b'.repeat(64)}`, size: 8192, fileCount: 1 },
			recipe: { id: 'creator-import@1', version: 1 },
			reportDigest: `sha256-${'c'.repeat(64)}`,
			placement: { metresPerSourceUnit: 1, pivot: [0, 0, 0], footprint: { width: 1, depth: 1 }, contactMinY: -0.5 }
		});
		if (modelEntry === null) throw new Error('the approved contact model was refused');
		const contactMinYFor = (entity: SceneEntity) => entity.id === model.id ? -0.5 : null;
		const moving = await sessionFor([model], writePort(), contactMinYFor, modelEntry);
		moving.session.begin(model.id);
		const move = moving.session.previewMove(3, 3);
		expect(move.kind).toBe('candidate');
		if (move.kind !== 'candidate') return;
		expect(move.candidate.modelContactMinY).toBe(-0.5);

		const resizing = await sessionFor([model], writePort(), contactMinYFor, modelEntry);
		resizing.session.beginResize(model.id);
		const resize = resizing.session.previewResize(2);
		expect(resize.kind).toBe('candidate');
		if (resize.kind !== 'candidate') return;
		expect(resize.candidate.modelContactMinY).toBe(-0.5);
		expect(resize.candidate.position[1]).toBeCloseTo(1, 9);
	});

	it('uses only an admitted catalogue model contact for its floor-aware commands', async () => {
		const { project, ids } = await buildS17MixedProject();
		const admitted = await admitSource(project, {
			sessionEpoch: 's17-catalogue-contact',
			acceptedRevision: project.acceptedRevision
		});
		if (admitted.kind !== 'admitted') throw new Error('the S17 fixture was refused');
		const scene = stageScene(admitted.snapshot);
		const catalogue = scene.entities.find((entity) => entity.id === ids.catalogueModelId)!;
		const excluded = scene.entities.find((entity) => entity.id === ids.unapprovedModelId)!;
		expect(sceneModelContactMinY(project, catalogue)).toBeCloseTo(0, 10);
		expect(localContactMinY(catalogue, sceneModelContactMinY(project, catalogue))).not.toBeNull();
		expect(sceneModelContactMinY(project, excluded)).toBeNull();
		expect(localContactMinY(excluded, sceneModelContactMinY(project, excluded))).toBeNull();
	});

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

	it('keeps the pinned raised support when the armed tile is re-applied before release', async () => {
		// The Place binding re-applies the project's armed Sphere on every surface
		// refresh. That arm is already in force, so it must not clear the support
		// the displayed candidate was resolved against: the release then commits a
		// pose the planner re-resolves at (0, 2) with no choice, and a terrace over
		// the Room floor refuses as ambiguous.
		const { session, port } = await sessionFor([boxEntity()]);
		session.beginPlace('sphere');
		const choice = {
			kind: 'elevation' as const,
			elevation: 1.2,
			generationId: 'scene-support@source-1'
		};
		const preview = session.previewPlace('sphere', 0, 2, 1.2, null, choice);
		expect(preview.kind).toBe('candidate');
		if (preview.kind !== 'candidate') return;
		expect(preview.candidate.position[1]).toBeGreaterThan(1.2);

		session.setPlacePrimitive('sphere');
		expect(session.candidate()).not.toBeNull();

		expect(await session.commitPlace()).toEqual({ kind: 'committed' });
		expect(port.intents).toHaveLength(1);
		const intent = port.intents[0]!;
		expect(intent.kind).toBe('place-object');
		expect(intent.payload).toMatchObject({ supportChoice: choice });
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

	it('allocates a cross-project transfer copy under the exact id the transfer minted', async () => {
		const { session, port } = await sessionFor([boxEntity()]);
		const item = canonicalFormLibraryPayload({
			formatVersion: 1,
			kind: 'form',
			name: 'Shape',
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
		const entityId = 'entity-transfer-copy';
		session.setArmedFormCopy({ itemId: 'library-item-transfer', item, contactMinY: 0, entityId });
		expect(await session.place('box', 1, 2)).toEqual({ kind: 'committed' });
		// The transfer's minted id is the allocated entity, so settlement can tie
		// completion to this one insertion and not any other new entity.
		expect(port.intents[0]!.allocatedIds).toEqual([{ kind: 'scene-entity', id: entityId }]);
		expect(session.placedEntityId()).toBe(entityId);
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
