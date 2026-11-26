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

import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { buildFormGeometry } from '$lib/render/entities/form-geometry';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneEntity, ScenePrimitiveEntity, Vec3 } from '@portfolio/project-model/scene';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core/wall';
import { planCreateRegion } from '@portfolio/layout-core/room';
import { createSceneSession, publishSceneSurface, sceneEntityReference, sceneReadingKey, sceneSurfaceFor, type ArmedModelPlacement, type SceneWritePort } from '$lib/authoring/adapters/scene/placement';
import { stageLayout, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { buildPlanSceneFootprintProjection } from '$lib/authoring/scene/plan-scene-footprint';
import { catalogueModelDefinition } from '$lib/authoring/scene/object-definition-policy';
import { draftingSnapIncrementMeters, snapDraftingPlacement } from '$lib/authoring/stage/stage-drafting';
import { armTile } from '$lib/authoring/adapters/scene/shape/armed-tile';
import { creatorModelDefinition, creatorModelResourceEntry } from '@portfolio/project-model/scene-planning';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { buildCurrentSourceFixture, FIXTURE_ENTITY_ID, FIXTURE_PROJECT_ID } from '../__fixtures__/f4-current-source-fixtures';
import { buildS17MixedProject } from '../__fixtures__/s17-mixed-project';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
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

describe('placement candidates', () => {
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

	it('places a verified catalogue model through the persistent Place planner', async () => {
		const { project, ids } = await buildS17MixedProject();
		const { facade, host } = await mounted(project);
		mountStageAdapter(facade, host, createAdapter);
		try {
			await new Promise((resolve) => setTimeout(resolve, 0));
			const opened = facade.openContributedTask('scene-place', 'scene');
			expect(opened.kind).toBe('opened');
			const evaluation = facade.evaluation();
			if (evaluation === null) throw new Error('the catalogue placement fixture has no evaluation');
			const surface = sceneSurfaceFor(facade.snapshot(), evaluation);
			if (surface === null) throw new Error('Place did not publish its Scene surface');
			const definition = await catalogueModelDefinition('paris-salon-chair');
			if (definition === null) throw new Error('the verified catalogue definition was refused');
			const model: ArmedModelPlacement = { definition, resource: null };
			surface.session.setArmedModel(model);
			expect(surface.session.beginPlaceModel(model).kind).toBe('idle');
			const preview = surface.session.previewPlaceModel(model, 2.5, 1.25, 0);
			expect(preview.kind).toBe('candidate');
			if (preview.kind !== 'candidate') return;
			expect(preview.candidate.footprint).toEqual({ width: 0.643, depth: 0.537 });
			expect((await surface.session.commitPlace()).kind).toBe('committed');
			await eventually(() => facade.snapshot().domain.scene.entities.some((entity) =>
				entity.id !== ids.catalogueModelId && entity.kind === 'model' && entity.assetId === 'paris-salon-chair'
			));
			const placed = facade.snapshot().domain.scene.entities.find((entity) =>
				entity.id !== ids.catalogueModelId && entity.kind === 'model' && entity.assetId === 'paris-salon-chair'
			);
			expect(placed?.kind === 'model' && placed.position[0]).toBeCloseTo(2.5, 8);
		} finally {
			facade.dispose();
		}
	});

	it('publishes and accepts direct Move for a verified catalogue model', async () => {
		const { project, ids } = await buildS17MixedProject();
		const { facade, host, rendered } = await mounted(project);
		facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 2);
		if (facade.camera.evaluate(RECT, 3).kind !== 'evaluated') throw new Error('Plan did not evaluate');
		const model = stageScene(facade.snapshot()).entities.find((entity) => entity.id === ids.catalogueModelId)!;
		const body = new Mesh(new BoxGeometry(0.643, 0.89758, 0.537), new MeshBasicMaterial());
		body.position.set(model.position[0], 0.89758 / 2, model.position[2]);
		const unregister = rendered.register(ids.catalogueModelId, body);
		mountStageAdapter(facade, host, createAdapter);
		try {
			const snapshot = facade.snapshot();
			const reference = sceneEntityReference(ids.catalogueModelId, snapshot.domain.unitRevisions.scene);
			expect(facade.setSelection({ ordered: [{ reference }], primary: reference }).kind).toBe('selected');
			expect(facade.selectionState().primary?.subject.id).toBe(ids.catalogueModelId);
			const move = markOf(facade, 'scene-object-move');
			const evaluationId = facade.evaluationId()!;
			const target = cssOf(facade, [2.2, 0, 1.6]);
			expect(facade.pointerIntent({ phase: 'down', css: move.anchor, evaluationId, handleId: move.id }).claimed).toBe(true);
			const movedPreview = facade.pointerIntent({ phase: 'move', css: target, evaluationId });
			expect(movedPreview.claimed).toBe(true);
			const ghost = facade.ghosts()[0];
			expect(ghost).toBeDefined();
			expect(ghost!.center[0]).toBeCloseTo(2, 5);
			facade.pointerIntent({ phase: 'up', css: target, evaluationId });
			await eventually(() => {
				const current = facade.snapshot().domain.scene.entities.find((entity) => entity.id === ids.catalogueModelId);
				return current?.position[0] !== model.position[0];
			});
			const moved = facade.snapshot().domain.scene.entities.find((entity) => entity.id === ids.catalogueModelId)!;
			expect(moved.position[0]).toBeCloseTo(2, 5);
		} finally {
			unregister();
			body.geometry.dispose();
			body.material.dispose();
			facade.dispose();
		}
	});

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

	it('keeps a raised object under the pointer when a 3D body drag crosses its terrace', async () => {
		// A body press on an object resting at 0.6 m must be measured on the
		// object's own base plane. On the datum it would sit several metres away in
		// 3D, and the first move would throw the object toward the camera instead of
		// sliding it across the terrace it stands on.
		const project = await supportedProject(
			[boxEntity(FIXTURE_ENTITY_ID, [3, 1.1, 2])],
			undefined,
			{
				footprint: [
					[0.5, 0.5],
					[6.5, 0.5],
					[6.5, 5.5],
					[0.5, 5.5]
				],
				elevation: 0.6
			}
		);
		const { facade, rendered, evaluationId } = await withSceneSurface(undefined, null, project, RECT, '3d');
		const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
		body.position.set(3, 1.1, 2);
		const unregister = rendered.register(FIXTURE_ENTITY_ID, body);
		facade.setDrafting({ snap: false });
		const press = stageCssOf(facade, [3, 1.6, 2.05]);
		const target: [number, number] = [press[0] + 18, press[1] + 8];
		expect(facade.resolvePick({ evaluationId, css: press, purpose: 'select', tool: null })).toMatchObject({
			kind: 'resolved',
			hit: { sourceId: FIXTURE_ENTITY_ID }
		});
		expect(facade.pointerIntent({ phase: 'down', css: press, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		// An 18 px move stays a small move. The datum-plane grab would put the
		// object metres from the pointer on the first move, so no candidate would
		// survive over its own terrace.
		const ghost = facade.ghosts()[0];
		expect(ghost).toBeDefined();
		expect(Math.abs(ghost!.center[0] - 3)).toBeLessThan(1.5);
		expect(Math.abs(ghost!.center[2] - 2)).toBeLessThan(1.5);
		expect(ghost!.center[1]).toBeCloseTo(1.1, 6);
		facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await eventually(() => {
			const entity = stageScene(facade.snapshot()).entities.find((entry) => entry.id === FIXTURE_ENTITY_ID);
			return entity !== undefined && Math.abs(entity.position[0] - 3) > 1e-9;
		});
		const moved = stageScene(facade.snapshot()).entities.find((entry) => entry.id === FIXTURE_ENTITY_ID)!;
		expect(moved.position[1]).toBeCloseTo(1.1, 9);
		expect(Math.abs(moved.position[0] - 3)).toBeLessThan(1.5);
		expect(Math.abs(moved.position[2] - 2)).toBeLessThan(1.5);
		unregister();
		body.geometry.dispose();
		body.material.dispose();
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
		if (accepted.kind !== 'primitive') throw new Error('Expected a box entity');
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

		// E3: a settled frame retains its evaluation identity instead of minting a
		// new one. A real view update still raises it, and the typed proposal
		// survives that new evaluation.
		expect(facade.camera.evaluate(RECT, 2).kind).toBe('evaluated');
		expect(facade.evaluationId()).toBe(evaluationId);
		facade.camera.applyIntent({ kind: 'pan', deltaCss: [4, 0], rect: RECT }, 2);
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
		// A used arm returns to the Box tile; this pins the session's own second Place.
		armTile(PROJECT_ID, null);
		armTile(FIXTURE_PROJECT_ID, null);
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

	it('previews and commits a pointer Place on the datum beyond the Room floor', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const offsetRect = { left: 352, top: 119, width: 928, height: 458, devicePixelRatio: 1 };
		const { facade, session, evaluationId } = await withSceneSurface(undefined, 'scene-place', project, offsetRect);
		const outside = stageCssOf(facade, [3.5, 0, 7.5]);
		expect(facade.pointerIntent({ phase: 'down', css: outside, evaluationId }).claimed).toBe(true);
		const shown = session.candidate();
		expect(shown?.kind).toBe('place');
		expect(shown?.position[1]).toBe(0.5);
		expect(facade.ghosts()[0]?.treatment).not.toBe('refused');
		facade.pointerIntent({ phase: 'cancel', css: outside, evaluationId });
	});
});
