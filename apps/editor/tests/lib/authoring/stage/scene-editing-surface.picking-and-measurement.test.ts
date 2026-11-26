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
import type { SceneEntity, ScenePrimitiveEntity, Vec3 } from '@portfolio/project-model/scene';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core/wall';
import { planCreateRegion } from '@portfolio/layout-core/room';
import { createSceneSession, publishSceneSurface, sceneEntityReference, sceneReadingKey, type SceneWritePort } from '$lib/authoring/adapters/scene/placement';
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

describe('picking and measurement', () => {
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
					expect(facade.cardWriter(subject)?.summary).toBe('Object fields');
					expect(facade.cardActions(subject).map((action) => action.label)).toContain('Delete object');
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
		floor.name = 'VisitorFloor:test'; tagRenderIdentity(floor, 'floor', 'test'); floor.position.set(3.5, 0, 3); floor.rotation.x = -Math.PI / 2;
		const root = new Group(); root.add(floor);
		const wall = new Mesh(new BoxGeometry(1.5, 2, 1), new MeshBasicMaterial());
		wall.position.set(3.8, 2, 3.5); root.add(wall);
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

	it('keeps selected object body jitter and a drag returned to click range from committing', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, host, rendered, evaluationId } = await withSceneSurface(undefined, null, project, RECT, 'plan');
		const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
		body.position.set(2, 0.5, 2);
		const unregister = rendered.register(FIXTURE_ENTITY_ID, body);
		const accept = vi.spyOn(host, 'accept');
		const depth = host.history().depth;
		facade.setDrafting({ snap: false });
		const press = stageCssOf(facade, [1.65, 0, 1.85]);
		const click = [press[0] + 1, press[1]] as const;
		const drag = stageCssOf(facade, [2.65, 0, 2.35]);

		expect(facade.pointerIntent({ phase: 'down', css: press, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: click, evaluationId });
		expect(facade.ghosts()).toEqual([]);
		facade.pointerIntent({ phase: 'up', css: click, evaluationId });
		expect(accept).not.toHaveBeenCalled();

		expect(facade.pointerIntent({ phase: 'down', css: press, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: drag, evaluationId });
		expect(facade.ghosts()).toHaveLength(1);
		facade.pointerIntent({ phase: 'move', css: click, evaluationId });
		expect(facade.ghosts()).toEqual([]);
		facade.pointerIntent({ phase: 'up', css: click, evaluationId });

		expect(accept).not.toHaveBeenCalled();
		expect(host.history().depth).toBe(depth);
		expect(stageScene(facade.snapshot()).entities.find((entry) => entry.id === FIXTURE_ENTITY_ID)?.position)
			.toEqual([2, 0.5, 2]);
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
		expect(move.cross).toBe(true);
		expect(move.kind).toBe('point');
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

	it('keeps selected form body jitter and a drag returned to click range from committing', async () => {
		const project = await supportedProject([nativeForm('plan', 2)]);
		const { facade, host, evaluationId } = await withSceneSurface(
			undefined,
			null,
			project,
			RECT,
			'plan',
			'form-plan'
		);
		const accept = vi.spyOn(host, 'accept');
		const depth = host.history().depth;
		facade.setDrafting({ snap: false });
		const press = stageCssOf(facade, [2.25, 0, 3.2]);
		const click = [press[0] + 1, press[1]] as const;
		const drag = stageCssOf(facade, [2.75, 0, 3.7]);

		expect(facade.pointerIntent({ phase: 'down', css: press, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: click, evaluationId });
		expect(facade.ghosts()).toEqual([]);
		facade.pointerIntent({ phase: 'up', css: click, evaluationId });
		expect(accept).not.toHaveBeenCalled();

		expect(facade.pointerIntent({ phase: 'down', css: press, evaluationId }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: drag, evaluationId });
		expect(facade.ghosts()).toHaveLength(1);
		facade.pointerIntent({ phase: 'move', css: click, evaluationId });
		expect(facade.ghosts()).toEqual([]);
		facade.pointerIntent({ phase: 'up', css: click, evaluationId });

		expect(accept).not.toHaveBeenCalled();
		expect(host.history().depth).toBe(depth);
		expect(stageScene(facade.snapshot()).entities.find((entry) => entry.id === 'form-plan')?.position)
			.toEqual([2, 0, 3]);
	});
});
