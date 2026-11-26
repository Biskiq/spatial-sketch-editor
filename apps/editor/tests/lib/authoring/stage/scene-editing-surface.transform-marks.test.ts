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
import { sceneObjectMarkDescriptors } from '$lib/authoring/adapters/scene/object-marks';
import { armTile } from '$lib/authoring/adapters/scene/shape/armed-tile';
import { creatorModelResourceEntry } from '@portfolio/project-model/scene-planning';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { hitStageMark } from '$lib/authoring/stage/stage-handles';
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

describe('transform marks', () => {
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

	// Review pass 2 §6: the W·D·H chip reveals the lift knob (a drag on the chip
	// itself scales uniformly); the old inward Size ray is retired.
	it('publishes Move, Turn, the Scale chip and the lift knob it reveals', async () => {
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
			drags: true,
			reveals: ['scene-object-lift']
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
		const lift = facade.marks().find((mark) => mark.id === 'scene-object-lift');
		expect(lift?.descriptor).toMatchObject({
			role: 'edit',
			fact: 'lift',
			planner: 'set-lift',
			disclosedBy: 'scene-object-scale-point'
		});
		expect(lift?.glyph).toBe('lift-knob');
		expect(lift?.stem).not.toBeNull();
		expect(hitStageMark(facade.marks(), { css: lift!.anchor, coarse: false })?.id).toBe(
			'scene-object-lift'
		);
		expect(facade.snapshot().canonicalJson).toBe(canonical);
		expect(facade.closeDisclosure()).toBe(false);
		expect(facade.session.resizeHandles()).toBe(true);
		expect(facade.activateDisclosure('scene-object-scale-point')).toBe(true);
		expect(facade.marks().some((mark) => mark.id === 'scene-object-lift')).toBe(false);
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

	it.each(['3d', 'plan'] as const)('previews and commits the same Turn pose in %s', async (reading) => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade, evaluationId } = await withSceneSurface(undefined, null, project, RECT, reading);
		const turn = markOf(facade, 'scene-object-turn');
		const target: [number, number] = [turn.anchor[0] + 50, turn.anchor[1]];
		expect(facade.pointerIntent({ phase: 'down', css: turn.anchor, evaluationId, handleId: turn.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		expect(facade.ghosts()).toHaveLength(1);
		const yaw = facade.ghosts()[0]!.yaw;
		expect(Math.abs(yaw)).toBeGreaterThan(0);
		// Plan hides the Canvas ghost, so the proposal is the dashed footprint
		// there; 3D draws the ghost body's dashed edges and no second outline.
		const outline = facade.candidatePreviews().filter((entry) => entry.id === 'scene-mark-outline');
		expect(outline).toHaveLength(reading === 'plan' ? 1 : 0);
		if (reading === 'plan') expect(outline[0]).toMatchObject({ role: 'subject' });
		facade.pointerIntent({ phase: 'up', css: target, evaluationId });
		await eventually(() => facade.snapshot().domain.scene.entities[0]!.rotation[1] !== 0);
		expect(Number.isFinite(facade.snapshot().domain.scene.entities[0]!.rotation[1])).toBe(true);
		expect(facade.snapshot().domain.scene.entities[0]!.rotation[1]).toBeCloseTo(yaw, 9);
	});

	// Review pass 3: the ring is not drawn, so only its bent arrow takes the press.
	it('hits the turn control at its arrow and not along the undrawn ring', async () => {
		const project = await supportedProject([boxEntity(FIXTURE_ENTITY_ID, [2, 0.5, 2])]);
		const { facade } = await withSceneSurface(undefined, null, project, RECT, 'plan');
		try {
			const turn = markOf(facade, 'scene-object-turn');
			expect(turn.ringGlyph).not.toBeNull();
			expect(facade.hitMark({ css: turn.ringGlyph!.at, coarse: false })?.id).toBe('scene-object-turn');
			const glyph = turn.ringGlyph!.at;
			const far = turn.ring!.reduce((best, point) =>
				Math.hypot(point[0] - glyph[0], point[1] - glyph[1]) > Math.hypot(best[0] - glyph[0], best[1] - glyph[1]) ? point : best
			);
			expect(facade.hitMark({ css: far, coarse: false })?.id).not.toBe('scene-object-turn');
		} finally { facade.dispose(); }
	});

	it.each(['move', 'turn'] as const)('keeps the sized body in the adapter %s ghost', async (action) => {
		const entity = { ...boxEntity(FIXTURE_ENTITY_ID, [2, 1.5, 2]), scale: 3 };
		const project = await supportedProject([entity]);
		const { facade, evaluationId } = await withSceneSurface(undefined, null, project);
		try {
			const mark = markOf(facade, `scene-object-${action}`);
			const target: [number, number] = [mark.anchor[0] + 50, mark.anchor[1]];
			facade.pointerIntent({ phase: 'down', css: mark.anchor, evaluationId, handleId: mark.id });
			facade.pointerIntent({ phase: 'move', css: target, evaluationId });
			expect(facade.ghosts()[0]?.shape).toEqual({ kind: 'box', size: [3, 3, 3] });
		} finally { facade.dispose(); }
	});

	// Review pass 2 §6: dragging the W·D·H chip scales uniformly; a click on it
	// only toggles the grips (the route decides that by click tolerance).
	it('commits one uniform scale entry from a chip drag and keeps the base on its support', async () => {
		const { facade, host } = await acceptedMarksSurface();
		const before = host.history().depth;
		const chip = markOf(facade, 'scene-object-scale-point');
		const evaluationId = facade.evaluationId()!;
		const entity = facade.snapshot().domain.scene.entities[0]!;
		const centre = facade.projectWorld([...entity.position] as Vec3, evaluationId);
		if (centre.kind !== 'projected') throw new Error('the object centre did not project');
		const rect = facade.evaluation()!.rect;
		const centreCss: [number, number] = [centre.css[0] - rect.left, centre.css[1] - rect.top];
		const outward: [number, number] = [
			chip.anchor[0] + (chip.anchor[0] - centreCss[0]) * 0.6,
			chip.anchor[1] + (chip.anchor[1] - centreCss[1]) * 0.6
		];
		expect(facade.pointerIntent({ phase: 'down', css: chip.anchor, evaluationId, handleId: chip.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: outward, evaluationId });
		facade.pointerIntent({ phase: 'up', css: outward, evaluationId });
		await eventually(() => ((facade.snapshot().domain.scene.entities[0] as { scale?: number }).scale ?? 1) !== 1);
		const scaled = facade.snapshot().domain.scene.entities[0] as { scale?: number; position: Vec3 };
		expect(scaled.scale).toBeGreaterThan(1);
		// A box's authored contact is -0.5 m; at scale s the planner re-seats its
		// centre at 0.5 s so the base stays on the compiled support at Y = 0.
		expect(scaled.position[1] + scaled.scale! * -0.5).toBeCloseTo(0, 6);
		expect(host.history().depth).toBe(before + 1);
	});

	it('writes nothing for a chip press released inside click tolerance', async () => {
		const { facade, host } = await acceptedMarksSurface();
		const before = host.history().depth;
		const canonical = facade.snapshot().canonicalJson;
		const chip = markOf(facade, 'scene-object-scale-point');
		const evaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', css: chip.anchor, evaluationId, handleId: chip.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: [chip.anchor[0] + 2, chip.anchor[1]], evaluationId });
		facade.pointerIntent({ phase: 'up', css: [chip.anchor[0] + 2, chip.anchor[1]], evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(facade.snapshot().canonicalJson).toBe(canonical);
		expect(host.history().depth).toBe(before);
	});

	it('lifts an object with the lift knob in one entry, keeping its size', async () => {
		const { facade, host } = await acceptedMarksSurface();
		const before = host.history().depth;
		expect(facade.activateDisclosure('scene-object-scale-point')).toBe(true);
		const lift = markOf(facade, 'scene-object-lift');
		const evaluationId = facade.evaluationId()!;
		const up: [number, number] = [lift.anchor[0], lift.anchor[1] - 60];
		expect(facade.pointerIntent({ phase: 'down', css: lift.anchor, evaluationId, handleId: lift.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: up, evaluationId });
		facade.pointerIntent({ phase: 'up', css: up, evaluationId });
		await eventually(() => facade.snapshot().domain.scene.entities[0]!.position[1] > 0.5);
		const lifted = facade.snapshot().domain.scene.entities[0] as { scale?: number; position: Vec3 };
		expect(lifted.position[1]).toBeGreaterThan(0.5);
		expect(lifted.scale ?? 1).toBe(1);
		expect(host.history().depth).toBe(before + 1);
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
			footprint: { width: 2, depth: 2 },
			lift: { lift: 0, supportY: 0 }
		});
		expect(descriptors.map((descriptor) => descriptor.id)).toEqual([
			'scene-object-scale-point',
			'scene-object-lift',
			'scene-object-move',
			'scene-object-turn'
		]);
		expect(descriptors.find((descriptor) => descriptor.id === 'scene-object-lift')).toMatchObject({
			planner: 'set-lift',
			fact: 'lift'
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

	it('hides object marks while a contributed task owns the surface', async () => {
		const { facade } = await withSceneSurface();
		expect(facade.marks().length).toBeGreaterThan(0);
		expect(facade.openContributedTask('scene-compose', 'scene').kind).toBe('opened');
		expect(facade.marks()).toEqual([]);
		facade.closeTask();
		expect(facade.marks().map((mark) => mark.id)).toContain('scene-object-move');
	});
});
