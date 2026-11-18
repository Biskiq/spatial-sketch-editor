/**
 * `studio.profile-revision` — the outline task through the real Scene adapter.
 *
 * The task is opened as Object Studio opens it (the contributed task, selected
 * form as its target), then driven through the session the Card uses: typed
 * anchors, the smooth flag, the physical extent, Apply, Discard. Every assertion
 * is a Stage-visible fact — accepted source, history, ghost, Camera reading and
 * the object Card's fields — never the session's private state.
 */
import { describe, expect, it, vi } from 'vitest';
import { Euler, Vector3 } from 'three';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	evaluateLayoutPlan,
	planWallChain
} from '@portfolio/layout-core';
import type { SceneEntity, Vec3 } from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import {
	createProfileRevisionSession,
	profileRevisionSession
} from '$lib/authoring/adapters/scene/profile-revision';
import { SCENE_PROFILE_REVISION_TASK } from '$lib/authoring/adapters/scene/scene-task-ids';
import { sceneObjectCardController } from '$lib/authoring/adapters/scene/object-card';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { planSceneFootprintsFor } from '$lib/authoring/scene/plan-scene-footprint';
import { buildPaperPlan } from '$lib/authoring/stage/paper-plan';
import {
	createStageAdapterServices,
	mountStageAdapter,
	type StageAdapterServices,
	type StageReadSnapshot
} from '$lib/authoring/stage/stage-adapter-host';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const PROJECT_ID = 'project-profile-revision';
const FORM_ID = 'entity-profile-form';
// Non-zero insets keep page-space projections distinct from Stage-local intents.
const RECT = { left: 80, top: 40, width: 1280, height: 720, devicePixelRatio: 1 };

function elevationForm(): Extract<SceneEntity, { kind: 'form' }> {
	return {
		kind: 'form',
		id: FORM_ID,
		name: 'Elevation form',
		position: [4, 0, 3],
		rotation: [0, 0.4, 0],
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		form: {
			generator: {
				kind: 'extrude',
				plane: 'elevation',
				extent: 1,
				outline: [
					{ key: 1, u: -0.5, v: 0, smooth: false },
					{ key: 2, u: 0.5, v: 0, smooth: false },
					{ key: 3, u: 0.5, v: 1, smooth: false },
					{ key: 4, u: -0.5, v: 1, smooth: false }
				]
			},
			scale: [1.25, 1.6, 0.8],
			nextKey: 5
		}
	};
}

function nativeForm(): Extract<SceneEntity, { kind: 'form' }> {
	return {
		kind: 'form',
		id: FORM_ID,
		name: 'Plan form',
		position: [4, 0, 3],
		rotation: [0, 0, 0],
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				extent: 1,
				outline: [
					{ key: 1, u: -0.5, v: 0, smooth: false },
					{ key: 2, u: 0.5, v: 0, smooth: false },
					{ key: 3, u: 0.5, v: 1, smooth: false },
					{ key: 4, u: -0.5, v: 1, smooth: false }
				]
			},
			scale: [1.3, 1, 1],
			nextKey: 5
		}
	};
}

async function project(sceneForm: SceneEntity = nativeForm()): Promise<ProjectEnvelope> {
	const baseline = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline,
		points: [[0, 0], [7, 0], [7, 6], [0, 6]],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (planned.kind !== 'success') throw new Error('the room fixture was refused');
	return createUnitProject({
		id: PROJECT_ID,
		name: 'Profile revision',
		layout: planned.document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [sceneForm],
			navigationNodes: [],
			connections: []
		}
	});
}

async function mounted(sceneForm: SceneEntity = nativeForm()) {
	const source = await project(sceneForm);
	const admitted = await admitSource(source, {
		sessionEpoch: 'session-profile-revision',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error('the outline fixture was not admitted');
	const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
	stageSession.replace(admitted.snapshot);
	const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession });
	if (facade.camera.evaluate(RECT, 1).kind !== 'evaluated') throw new Error('no evaluation');
	facade.acquireInspection('exclusive');
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: admitted.snapshot.sessionEpoch,
		baseline: {
			revision: admitted.snapshot.acceptedRevision,
			source,
			canonicalJson: admitted.snapshot.canonicalJson,
			sourceContentId: admitted.snapshot.sourceContentId
		}
	});
	if (mountStageAdapter(facade, host, createAdapter).kind !== 'registered') {
		throw new Error('the Scene adapter did not mount');
	}
	await new Promise((resolve) => setTimeout(resolve, 0));
	return { facade, host, services: createStageAdapterServices(facade, host) };
}

function select(facade: StageFacade, entityId: string): void {
	const reference = sceneEntityReference(entityId, facade.snapshot().domain.unitRevisions.scene);
	facade.setSelection({ ordered: [{ reference }], primary: reference });
}

function worldOf(entity: Extract<SceneEntity, { kind: 'form' }>, local: Vec3): Vec3 {
	return new Vector3(local[0], local[1], local[2])
		.applyEuler(new Euler(entity.rotation[0], entity.rotation[1], entity.rotation[2]))
		.add(new Vector3(entity.position[0], entity.position[1], entity.position[2]))
		.toArray() as Vec3;
}

function cssOf(facade: StageFacade, world: Vec3): [number, number] {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the fixture has no evaluation');
	const projected = facade.projectWorld(world, evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	const rect = facade.evaluation()!.rect;
	return [projected.css[0] - rect.left, projected.css[1] - rect.top];
}

function paper(layout: ProjectEnvelope['units']['layout']['data'], projection: ReturnType<typeof planSceneFootprintsFor>) {
	const compiled = compileWallFirstLayoutGeometry(layout).geometry;
	const evaluation = evaluateLayoutPlan(
		compiled,
		{ cutHeightMeters: 1.2, depthMeters: 100, lateralSpanHalfWidthMeters: null, sourceKindFilter: null, reveal: [] },
		{ generationId: 'profile-revision-paper', target: [4, 3], datumMeters: 0 }
	);
	if (evaluation.kind !== 'evaluated') throw new Error('the Paper fixture did not evaluate');
	return buildPaperPlan(evaluation.plan, compiled, projection);
}

function formEntity(facade: StageFacade): Extract<SceneEntity, { kind: 'form' }> {
	const entity = stageEnvelope(facade.snapshot()).units.scene.data.entities.find(
		(entry) => entry.id === FORM_ID
	);
	if (entity?.kind !== 'form') throw new Error('the accepted form disappeared');
	return entity;
}

async function openOutline(facade: StageFacade) {
	select(facade, FORM_ID);
	expect(facade.selectionState().primary?.subject.id).toBe(FORM_ID);
	// A source install leaves factory bindings pending until the next live view.
	facade.camera.evaluate(RECT, 10);
	await new Promise((resolve) => setTimeout(resolve, 5));
	const opened = facade.openContributedTask(SCENE_PROFILE_REVISION_TASK, 'scene');
	if (opened.kind !== 'opened') throw new Error(`Edit outline was not opened: ${opened.message}`);
	expect(opened.task.kind).toBe('revise-form-profile');
	expect(opened.instrument?.summary).toBe('Edit outline');
	const session = profileRevisionSession();
	if (session === null) throw new Error('the outline session was not published');
	// The live selection is the target, not a stale contribution targetRef.
	expect(session.state()?.entityId).toBe(FORM_ID);
	return session;
}

function fieldsOf(services: Awaited<ReturnType<typeof mounted>>['services']) {
	return sceneObjectCardController(services, FORM_ID)?.fields().map((field) => field.id) ?? [];
}

describe('studio.profile-revision — outline task', () => {
	it('previews a typed revision, applies one F4 entry and keeps every identity', async () => {
		const { facade, host, services } = await mounted();
		const session = await openOutline(facade);
		const state = session.state();
		if (state === null) throw new Error('the task captured no form');
		expect(state).toMatchObject({ plane: 'plan', extentLabel: 'Height', extent: 1 });
		expect(state.anchors.map((anchor) => anchor.key)).toEqual([1, 2, 3, 4]);
		// The Card keeps exactly one writer for the extent while the task is open.
		expect(fieldsOf(services)).not.toContain('height');
		expect(fieldsOf(services)).toEqual(expect.arrayContaining(['width', 'depth']));

		// A plan profile enters Camera's Plan reading; nothing else moved.
		facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 2);
		facade.camera.evaluate(RECT, 20);
		expect(facade.camera.evaluation()?.settledReading).toBe('plan');

		const beforeJson = facade.snapshot().canonicalJson;
		const beforeHistory = host.history();
		session.setAnchor(0, { u: -0.7 });
		session.setAnchor(2, { smooth: true });
		session.setExtentPhysical(1.4);
		expect(facade.snapshot().canonicalJson).toBe(beforeJson);
		expect(host.history()).toEqual(beforeHistory);
		expect(profileRevisionSession()?.state()?.refusal).toBeNull();
		expect(facade.ghosts().some((ghost) => ghost.id === 'scene-profile-revision-body')).toBe(true);
		expect(session.candidatePreview()?.segments).toHaveLength(4);

		const outcome = await session.apply();
		expect(outcome).toEqual({ kind: 'installed' });
		facade.closeTask();
		const revised = formEntity(facade);
		expect(revised.form.generator.outline.map((anchor) => anchor.key)).toEqual([1, 2, 3, 4]);
		expect(revised.form.generator.outline[0]).toMatchObject({ key: 1, u: -0.7, v: 0, smooth: false });
		expect(revised.form.generator.outline[2]).toMatchObject({ key: 3, smooth: true });
		expect(revised.form.generator.extent).toBe(1.4);
		expect(revised.form.generator.plane).toBe('plan');
		expect(revised.form.nextKey).toBe(5);
		expect(revised.form.scale).toEqual([1.3, 1, 1]);
		expect(revised.position).toEqual([4, 0, 3]);
		expect(revised.rotation).toEqual([0, 0, 0]);
		expect(host.history()).toMatchObject({ depth: beforeHistory.depth + 1, position: beforeHistory.position + 1 });
		// Closing the task restores the Card's own extent writer and its measured
		// values follow the accepted outline, not the pre-task size.
		expect(fieldsOf(services)).toContain('height');
		const widthField = sceneObjectCardController(services, FORM_ID)
			?.fields()
			.find((field) => field.id === 'width');
		expect(Number(widthField?.text)).toBeCloseTo(1.2 * 1.3, 6);

		const revisedJson = facade.snapshot().canonicalJson;
		await host.undo();
		expect(facade.snapshot().canonicalJson).toBe(beforeJson);
		await host.redo();
		expect(facade.snapshot().canonicalJson).toBe(revisedJson);
	});

	it('applies a repeated revision and discards a draft without writing', async () => {
		const { facade, host } = await mounted();
		const first = await openOutline(facade);
		first.setAnchor(1, { v: 0.2 });
		expect(await first.apply()).toEqual({ kind: 'installed' });
		facade.closeTask();
		const acceptedJson = facade.snapshot().canonicalJson;
		const acceptedHistory = host.history();

		const second = await openOutline(facade);
		second.setAnchor(1, { v: 0.4 });
		second.setExtentPhysical(0.8);
		second.discard();
		facade.closeTask();
		expect(facade.snapshot().canonicalJson).toBe(acceptedJson);
		expect(formEntity(facade).form.generator.outline[1]?.v).toBe(0.2);
		expect(formEntity(facade).form.generator.extent).toBe(1);
		expect(host.history()).toEqual(acceptedHistory);
	});

	it('re-reads the Card without recapturing a live draft', async () => {
		const { facade } = await mounted();
		const session = await openOutline(facade);
		session.setAnchor(0, { u: -0.8 });
		const draft = session.state()?.anchors[0];
		// The host calls `instrumentForTask` again on every surface change; each call
		// must return the same captured session rather than reopen it.
		for (let read = 0; read < 3; read += 1) {
			const content = facade.instrumentForTask(SCENE_PROFILE_REVISION_TASK, 'scene');
			expect(content?.summary).toBe('Edit outline');
			expect(profileRevisionSession()).toBe(session);
			expect(session.state()?.anchors[0]).toEqual(draft);
		}
		session.discard();
		facade.closeTask();
	});

	it('does not recapture after an install closes the session', async () => {
		const { facade } = await mounted();
		const session = await openOutline(facade);
		session.setAnchor(0, { u: -0.8 });
		expect(await session.apply()).toEqual({ kind: 'installed' });
		// The install closed the session while the task is still closing. A read in
		// that window must keep the task's own Card and must not start a second
		// capture (and a second proposal) from inside the read, which would make
		// Apply never settle in the host.
		const content = facade.instrumentForTask(SCENE_PROFILE_REVISION_TASK, 'scene');
		// The install may already have closed the task; either way the read must not
		// capture a second session, and any content it does answer with is this Card.
		expect(content === null || content.summary === 'Edit outline').toBe(true);
		expect(profileRevisionSession()).toBeNull();
		facade.closeTask();
	});

	it('refuses a crossed outline in the task and writes nothing', async () => {
		const { facade, host } = await mounted();
		const session = await openOutline(facade);
		const before = facade.snapshot().canonicalJson;
		const beforeHistory = host.history();
		// Swap the two top anchors' U values so opposite edges cross.
		session.setAnchor(2, { u: -0.9 });
		session.setAnchor(3, { u: 0.9 });
		const state = session.state();
		expect(state?.refusal).not.toBeNull();
		const outcome = await session.apply();
		expect(outcome.kind).toBe('refused');
		expect(facade.snapshot().canonicalJson).toBe(before);
		expect(host.history()).toEqual(beforeHistory);
		facade.closeTask();
	});

	it('rejects a no-op Apply without adding an entry', async () => {
		const { facade, host } = await mounted();
		const session = await openOutline(facade);
		const before = host.history();
		expect(await session.apply()).toEqual({ kind: 'no-op' });
		expect(host.history()).toEqual(before);
		facade.closeTask();
	});

	it('drags a plan anchor through non-unit, nonuniform scale after rotation', async () => {
		const base = nativeForm();
		const source: SceneEntity = {
			...base,
			rotation: [0, 0.4, 0],
			form: { ...base.form, scale: [1.6, 1, 0.7] }
		};
		const { facade } = await mounted(source);
		const session = await openOutline(facade);
		facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 2);
		facade.camera.evaluate(RECT, 20);
		const before = facade.snapshot().canonicalJson;
		const entity = formEntity(facade);
		const anchor = session.state()!.anchors[2]!;
		// The body's own corner is source × stored scale, then rotation and position.
		const press = worldOf(entity, [anchor.u * 1.6, 0, anchor.v * 0.7]);
		const evaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', css: cssOf(facade, press), evaluationId }).claimed).toBe(true);
		const targetU = 0.75;
		const target = worldOf(entity, [targetU * 1.6, 0, anchor.v * 0.7]);
		facade.pointerIntent({ phase: 'move', css: cssOf(facade, target), evaluationId });
		const dragged = session.state()!.anchors[2]!;
		// A world-metre delta divided by the scale, not written as source metres.
		expect(dragged.u).toBeCloseTo(targetU, 9);
		expect(dragged.v).toBeCloseTo(anchor.v, 9);
		expect(facade.snapshot().canonicalJson).toBe(before);
		const start = session.candidatePreview()!.segments[2]![0];
		expect(start[0]).toBeCloseTo(target[0], 6);
		expect(start[1]).toBeCloseTo(target[1], 6);
		expect(start[2]).toBeCloseTo(target[2], 6);
		facade.pointerIntent({ phase: 'up', css: cssOf(facade, target), evaluationId });
		expect(await session.apply()).toEqual({ kind: 'installed' });
		facade.closeTask();
		const accepted = formEntity(facade);
		expect(accepted.form.generator.outline[2]!.u).toBeCloseTo(targetU, 9);
		const mesh = evaluateFormMesh(accepted.form)!;
		expect(mesh.bounds.max[0]).toBeCloseTo(targetU * 1.6, 6);
		expect(mesh.bounds.max[2]).toBeCloseTo(0.7, 6);
	});

	it('drags an elevation anchor through non-unit, nonuniform scale after rotation', async () => {
		const { facade } = await mounted(elevationForm());
		const session = await openOutline(facade);
		const entity = formEntity(facade);
		const mesh = evaluateFormMesh(entity.form)!;
		const min: Vec3 = [Infinity, Infinity, Infinity];
		const max: Vec3 = [-Infinity, -Infinity, -Infinity];
		for (const x of [mesh.bounds.min[0], mesh.bounds.max[0]]) {
			for (const y of [mesh.bounds.min[1], mesh.bounds.max[1]]) {
				for (const z of [mesh.bounds.min[2], mesh.bounds.max[2]]) {
					const point = worldOf(entity, [x, y, z]);
					for (let axis = 0; axis < 3; axis += 1) {
						min[axis] = Math.min(min[axis]!, point[axis]);
						max[axis] = Math.max(max[axis]!, point[axis]);
					}
				}
			}
		}
		const forward = new Vector3(0, 0, -1)
			.applyEuler(new Euler(entity.rotation[0], entity.rotation[1], entity.rotation[2]))
			.normalize();
		facade.camera.applyIntent(
			{ kind: 'face', bounds: { min, max }, look: [forward.x, forward.y, forward.z] as Vec3, rect: RECT },
			2
		);
		facade.camera.evaluate(RECT, 20);
		const before = facade.snapshot().canonicalJson;
		const anchor = session.state()!.anchors[2]!;
		const press = worldOf(entity, [anchor.u * 1.25, anchor.v * 1.6, 0]);
		const evaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', css: cssOf(facade, press), evaluationId }).claimed).toBe(true);
		const targetV = 1.5;
		const target = worldOf(entity, [anchor.u * 1.25, targetV * 1.6, 0]);
		facade.pointerIntent({ phase: 'move', css: cssOf(facade, target), evaluationId });
		const dragged = session.state()!.anchors[2]!;
		expect(dragged.v).toBeCloseTo(targetV, 9);
		expect(dragged.u).toBeCloseTo(anchor.u, 9);
		expect(facade.snapshot().canonicalJson).toBe(before);
		const start = session.candidatePreview()!.segments[2]![0];
		expect(start[0]).toBeCloseTo(target[0], 6);
		expect(start[1]).toBeCloseTo(target[1], 6);
		expect(start[2]).toBeCloseTo(target[2], 6);
		facade.pointerIntent({ phase: 'up', css: cssOf(facade, target), evaluationId });
		expect(await session.apply()).toEqual({ kind: 'installed' });
		facade.closeTask();
		const accepted = formEntity(facade);
		expect(accepted.form.generator.outline[2]!.v).toBeCloseTo(targetV, 9);
		const revised = evaluateFormMesh(accepted.form)!;
		expect(revised.bounds.max[1]).toBeCloseTo(1.5 * 1.6, 6);
		expect(revised.bounds.max[2]).toBeCloseTo(1 * 0.8, 6);
	});

	it('refuses a draft whose accepted source changed under the task', async () => {
		const { facade } = await mounted();
		const opening = facade.snapshot();
		const changedForm = nativeForm();
		const changed: SceneEntity = {
			...changedForm,
			form: { ...changedForm.form, scale: [2, 1, 1] }
		};
		const admitted = await admitSource(await project(changed), {
			sessionEpoch: opening.sessionEpoch,
			acceptedRevision: { ...opening.acceptedRevision, revisionId: 'revision-under-task' }
		});
		if (admitted.kind !== 'admitted') throw new Error('the changed source was not admitted');
		let current: StageReadSnapshot = opening;
		const accept = vi.fn(async () => ({ kind: 'installed' as const }));
		const services = {
			stage: {
				snapshot: () => current,
				notifySurfaceChange: () => {},
				session: { registerProposal: () => ({ active: true, release: () => {} }) }
			},
			authoring: { accept, acceptedRevision: () => current.acceptedRevision }
		} as unknown as StageAdapterServices;
		const session = createProfileRevisionSession(services);
		expect(session.open(FORM_ID)).toBe(true);
		session.setAnchor(0, { u: -0.7 });
		expect(session.state()?.refusal).toBeNull();
		current = admitted.snapshot;
		session.setAnchor(0, { u: -0.6 });
		const stale = 'The accepted source changed while the outline task was open. Discard and reopen it.';
		expect(session.state()?.refusal).toBe(stale);
		expect(session.ghost()).toBeNull();
		expect(await session.apply()).toEqual({ kind: 'refused', message: stale });
		expect(accept).not.toHaveBeenCalled();
	});

	it('draws the revised source in Paper from one fresh evaluation', async () => {
		const { facade } = await mounted();
		const session = await openOutline(facade);
		session.setAnchor(0, { u: -0.8 });
		session.setExtentPhysical(1.2);
		expect(await session.apply()).toEqual({ kind: 'installed' });
		facade.closeTask();
		const accepted = formEntity(facade);
		const mesh = evaluateFormMesh(accepted.form)!;
		const yaw = accepted.rotation[1];
		const expected = mesh.footprint.map(
			([localX, localZ]) =>
				[
					accepted.position[0] + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
					accepted.position[2] - localX * Math.sin(yaw) + localZ * Math.cos(yaw)
				] as const
		);
		const runtime = facade.snapshot().domain.scene;
		const projection = planSceneFootprintsFor(runtime, runtime.modelFootprints);
		const footprint = projection.footprints.find((entry) => entry.entityId === FORM_ID)!;
		expect(footprint.points).toEqual(expected);
		const layout = stageEnvelope(facade.snapshot()).units.layout.data;
		const drawing = paper(layout, projection);
		const paperFootprint = drawing.footprints.find((entry) => entry.entityId === FORM_ID)!;
		expect(paperFootprint.polygons).toEqual([footprint.points]);
	});
});
