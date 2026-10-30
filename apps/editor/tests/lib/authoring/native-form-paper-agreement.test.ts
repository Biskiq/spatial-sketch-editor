/**
 * R217.S09 — a hit-resolved Width edit refreshes the accepted form, Plan
 * footprint and Paper drawing from the same evaluated source.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	evaluateLayoutPlan,
	planWallChain
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import type { SceneFormEntity } from '$lib/content/scene';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { planSceneFootprintsFor } from '$lib/authoring/scene/plan-scene-footprint';
import { buildPaperPlan } from '$lib/authoring/stage/paper-plan';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createAdapter as createLayoutAdapter } from '$lib/authoring/adapters/layout.adapter';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { hitStageMark } from '$lib/authoring/stage/stage-handles';
import { formSizeMeasurement, SCENE_FORM_MARK } from '$lib/authoring/adapters/scene/shape/form-size';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 80, top: 40, width: 1280, height: 720, devicePixelRatio: 1 };

function fixtureLayout() {
	const baseline = createEmptyWallFirstLayoutDocument();
	const result = planWallChain({
		baseline,
		points: [[0, 0], [7, 0], [7, 6], [0, 6]],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (result.kind !== 'success') throw new Error('Paper fixture enclosure was refused');
	return result.document;
}

function form(): SceneFormEntity {
	return {
		kind: 'form',
		id: 'form-paper-width',
		name: 'Rotated plinth',
		position: [3, 0, 3],
		rotation: [0, 0.37, 0],
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				extent: 0.8,
				outline: [
					{ key: 1, u: -1, v: -0.5, smooth: false },
					{ key: 2, u: 1, v: -0.5, smooth: false },
					{ key: 3, u: 1, v: 0.5, smooth: false },
					{ key: 4, u: -1, v: 0.5, smooth: false }
				]
			},
			scale: [1, 1, 1],
			nextKey: 5
		}
	};
}

async function mountedHost(sourceForm = form()) {
	const projectId = 'project-native-form-paper';
	const project: ProjectEnvelope = await createUnitProject({
		id: projectId,
		name: 'Native form Paper agreement',
		layout: fixtureLayout(),
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [sourceForm],
			navigationNodes: [],
			connections: []
		}
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-native-form-paper',
		acceptedRevision: { projectId, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`Paper fixture not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	facade.camera.evaluate(RECT, 1);
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: snapshot.sessionEpoch,
		baseline: {
			revision: snapshot.acceptedRevision,
			source: project,
			canonicalJson: snapshot.canonicalJson,
			sourceContentId: snapshot.sourceContentId
		}
	});
	for (const adapter of [createLayoutAdapter, createSceneAdapter]) {
		if (mountStageAdapter(facade, host, adapter).kind !== 'registered') throw new Error('Paper fixture adapter did not mount');
	}
	facade.camera.evaluate(RECT, 2);
	return { facade, host, services: createStageAdapterServices(facade, host), layout: project.units.layout.data };
}

function settlePlan(facade: Awaited<ReturnType<typeof mountedHost>>['facade']): void {
	facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 2);
	facade.camera.evaluate(RECT, 12);
	if (facade.camera.evaluation()?.settledReading !== 'plan') throw new Error('Camera did not settle in Plan');
}

function expectedFootprint(entity: SceneFormEntity) {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null) throw new Error('accepted form did not evaluate');
	const [x, , z] = entity.position;
	const yaw = entity.rotation[1];
	return mesh.footprint.map(([localX, localZ]) => [
		x + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
		z - localX * Math.sin(yaw) + localZ * Math.cos(yaw)
	] as const);
}

describe('R217.S09 — native form Paper agreement', () => {
	it('draws the hit-resolved Width edit from fresh accepted evaluation with one history entry', async () => {
		const { facade, host, layout } = await mountedHost();
		settlePlan(facade);
		const reference = sceneEntityReference('form-paper-width', facade.snapshot().domain.unitRevisions.scene);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		facade.activateDisclosure(SCENE_FORM_MARK.scalePoint);
		const beforeJson = facade.snapshot().canonicalJson;
		const beforeRuntimeScene = facade.snapshot().domain.scene;
		const beforeProjection = planSceneFootprintsFor(beforeRuntimeScene, beforeRuntimeScene.modelFootprints);
		const beforePoints = beforeProjection.footprints[0]!.points;
		const beforeDrawing = paper(layout, beforeProjection);
		const history = host.history();
		const width = facade.marks().find((mark) => mark.id === SCENE_FORM_MARK.width);
		if (width?.tip === null || width === undefined) throw new Error('selected form did not publish its Width ray');
		const hit = hitStageMark(facade.marks(), { css: width.tip, coarse: true });
		expect(hit?.id).toBe(SCENE_FORM_MARK.width);
		const evaluationId = facade.evaluationId()!;
		const from = width.tip;
		const to = [from[0] + (from[0] - width.anchor[0]), from[1] + (from[1] - width.anchor[1])] as const;
		expect(facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: hit!.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		for (let attempt = 0; attempt < 200 && facade.snapshot().canonicalJson === beforeJson; attempt += 1) {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}

		const acceptedSource = facade.snapshot();
		expect(acceptedSource.canonicalJson).not.toBe(beforeJson);
		const acceptedEnvelope = stageEnvelope(acceptedSource);
		const acceptedEntity = acceptedEnvelope.units.scene.data.entities.find((entity) => entity.id === 'form-paper-width');
		if (acceptedEntity?.kind !== 'form') throw new Error('width edit did not install an accepted form');
		expect(acceptedEntity.form.scale[0]).not.toBe(1);
		expect(acceptedEntity.form.scale[1]).toBe(1);
		expect(acceptedEntity.form.scale[2]).toBe(1);
		expect(host.history()).toMatchObject({ depth: history.depth + 1, position: history.position + 1 });

		const runtimeScene = acceptedSource.domain.scene;
		const freshProjection = planSceneFootprintsFor(runtimeScene, runtimeScene.modelFootprints);
		const footprint = freshProjection.footprints.find((entry) => entry.entityId === acceptedEntity.id)!;
		expect(footprint.points).toEqual(expectedFootprint(acceptedEntity));
		expect(footprint.points).not.toEqual(beforePoints);
		const drawing = paper(layout, freshProjection);
		const paperFootprint = drawing.footprints.find((entry) => entry.entityId === acceptedEntity.id)!;
		expect(paperFootprint.polygons).toEqual([footprint.points]);
		expect(drawing.footprints.map((entry) => entry.entityId)).toEqual(['form-paper-width']);
		expect(beforeDrawing.footprints[0]!.polygons).not.toEqual(paperFootprint.polygons);
	});

	it('keeps support contact through a centered factor-two Plan Height edit', async () => {
		const base = form();
		const sourceForm: SceneFormEntity = {
			...base,
			position: [3, 0.5, 3],
			form: {
				...base.form,
				generator: {
					...base.form.generator,
					plane: 'elevation',
					outline: [
						{ key: 1, u: 0, v: -0.5, smooth: false },
						{ key: 2, u: 2, v: -0.5, smooth: false },
						{ key: 3, u: 2, v: 0.5, smooth: false },
						{ key: 4, u: 0, v: 0.5, smooth: false }
					]
				}
			}
		};
		const { facade, host } = await mountedHost(sourceForm);
		settlePlan(facade);
		const reference = sceneEntityReference(sourceForm.id, facade.snapshot().domain.unitRevisions.scene);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		facade.activateDisclosure(SCENE_FORM_MARK.scalePoint);
		const acceptedBefore = stageEnvelope(facade.snapshot()).units.scene.data.entities.find(
			(entity) => entity.id === sourceForm.id
		);
		if (acceptedBefore?.kind !== 'form') throw new Error('centered elevation form was not admitted');
		const beforeMeasurement = formSizeMeasurement(acceptedBefore);
		const height = beforeMeasurement.handles.find((handle) => handle.axis === 1)!;
		expect(height.factor).toBe(2);
		const supportContact = acceptedBefore.position[1] + beforeMeasurement.contactMinY;
		expect(supportContact).toBeCloseTo(0, 9);
		const heightMark = facade.marks().find((mark) => mark.id === SCENE_FORM_MARK.height);
		if (heightMark === undefined) throw new Error('centered form did not publish Height');
		const history = host.history();
		const evaluation = facade.evaluation()!;
		const from = heightMark.anchor;
		const to = [from[0], from[1] - 20] as const;
		const evaluationId = facade.evaluationId()!;
		expect(facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: heightMark.id }).claimed).toBe(true);
		facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const preview = facade.ghosts().find((ghost) => ghost.id === 'scene-form-mark-preview');
		if (preview?.shape.kind !== 'form') throw new Error('Plan Height did not publish a form preview');
		const expectedScale = (height.dimension + 20 * evaluation.targetPlaneMetersPerCssPixel) / height.baseDimension;
		expect(preview.shape.form.scale[1]).toBeCloseTo(expectedScale, 6);
		facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		for (let attempt = 0; attempt < 200; attempt += 1) {
			const current = stageEnvelope(facade.snapshot()).units.scene.data.entities.find((entity) => entity.id === sourceForm.id);
			if (current?.kind === 'form' && current.form.scale[1] !== acceptedBefore.form.scale[1]) break;
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		const acceptedAfter = stageEnvelope(facade.snapshot()).units.scene.data.entities.find((entity) => entity.id === sourceForm.id);
		if (acceptedAfter?.kind !== 'form') throw new Error('centered Height edit did not install');
		const afterMeasurement = formSizeMeasurement(acceptedAfter);
		expect(acceptedAfter.form.scale[1]).toBeCloseTo(expectedScale, 6);
		expect(acceptedAfter.position[1] + afterMeasurement.contactMinY).toBeCloseTo(supportContact, 6);
		expect(host.history()).toMatchObject({ depth: history.depth + 1, position: history.position + 1 });
	});
});

function paper(layout: ProjectEnvelope['units']['layout']['data'], projection: ReturnType<typeof planSceneFootprintsFor>) {
	const compiled = compileWallFirstLayoutGeometry(layout).geometry;
	const evaluation = evaluateLayoutPlan(
		compiled,
		{ cutHeightMeters: 1.2, depthMeters: 100, lateralSpanHalfWidthMeters: null, sourceKindFilter: null, reveal: [] },
		{ generationId: 'native-form-paper', target: [3, 3], datumMeters: 0 }
	);
	if (evaluation.kind !== 'evaluated') throw new Error('Paper Plan fixture did not evaluate');
	return buildPaperPlan(evaluation.plan, compiled, projection);
}
