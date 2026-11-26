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

import { Mesh, MeshBasicMaterial } from 'three';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { buildFormGeometry } from '$lib/render/entities/form-geometry';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneEntity, ScenePrimitiveEntity, Vec3 } from '@portfolio/project-model/scene';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core/wall';
import { planCreateRegion } from '@portfolio/layout-core/room';
import { createSceneSession, publishSceneSurface, sceneEntityReference, sceneReadingKey, sceneSurfaceFor, type SceneWritePort } from '$lib/authoring/adapters/scene/placement';
import { stageLayout, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { armTile } from '$lib/authoring/adapters/scene/shape/armed-tile';
import { creatorModelResourceEntry } from '@portfolio/project-model/scene-planning';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { buildCurrentSourceFixture, FIXTURE_ENTITY_ID, FIXTURE_PROJECT_ID } from '../__fixtures__/f4-current-source-fixtures';
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

describe('placement lifecycle', () => {
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

		// A real view update raises a new evaluation while the press is still held.
		// A release that resolved the surface again would read a fresh, empty
		// session and silently drop the pose the creator is dragging.
		facade.camera.applyIntent({ kind: 'pan', deltaCss: [4, 0], rect: RECT }, 2);
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

	it('holds Placing…, ignores input and keeps a refused Object release ghost', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const deferred: { resolve: ((outcome: Awaited<ReturnType<SceneWritePort['accept']>>) => void) | null } = { resolve: null };
		let accepts = 0;
		const accept: SceneWritePort['accept'] = () => {
			accepts += 1;
			return new Promise((resolve) => { deferred.resolve = resolve; });
		};
		const { facade, session, evaluationId } = await withSceneSurface(accept, 'scene-place', project);
		const target = stageCssOf(facade, [3.5, 0, 7.5]);

		expect(facade.pointerIntent({ phase: 'down', css: target, evaluationId }).claimed).toBe(true);
		expect(facade.pointerIntent({ phase: 'up', css: target, evaluationId }).claimed).toBe(true);
		await eventually(() => accepts === 1);
		expect(facade.overlays().map((marker) => marker.label)).toContain('Placing…');
		expect(session.candidate()?.kind).toBe('place');
		// A second press while the one create is pending is claimed but starts no
		// new preview and sends no second intent.
		expect(facade.pointerIntent({ phase: 'down', css: target, evaluationId }).claimed).toBe(true);
		expect(accepts).toBe(1);

		const settle = deferred.resolve;
		if (settle === null) throw new Error('the Object create was not deferred');
		settle({ kind: 'refused', code: 'fixture-refusal', message: 'The fixture refused this pose.' });
		await eventually(() => facade.ghosts().some((ghost) => ghost.treatment === 'refused'));
		expect(facade.overlays().map((marker) => marker.label)).toContain('The fixture refused this pose.');

		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		expect(facade.ghosts().every((ghost) => ghost.treatment !== 'refused')).toBe(true);
		facade.pointerIntent({ phase: 'cancel', css: target, evaluationId });
	});
});
