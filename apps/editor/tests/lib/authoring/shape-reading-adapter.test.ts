/**
 * T5.P01.S02 — Shape reading and sizing through the live host.
 *
 * The suite drives the production Scene and Layout adapters, the real F.4
 * acceptance host and the one Ink task. It pins the slice's contracts:
 *
 * 1. Ink stays one Pen: Layout's built-in readings and the contributed Shape
 *    reading share one palette; switching refuses while the reading holds live
 *    work and cancels the session without writing source once it is clear.
 * 2. A closed floor stroke reads as a Shape; Create issues exactly one
 *    `create-form` intent, selects the form, and Undo/Redo keeps its identity.
 * 3. An upright sheet creates an elevation form, and Flip side turns the
 *    extrusion without moving the drawn profile.
 * 4. An invalid outline refuses in the kernel's words, offers no Create and
 *    writes no history.
 * 5. A per-axis size ray commits one `set-form-size`; the Card writes the same
 *    operation for exact values, and each edit is one undo step.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import type { SceneFormEntity } from '@portfolio/project-model';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import {
	createStageAcceptanceHost,
	type StageAcceptanceHost
} from '$lib/authoring/stage/host-acceptance';
import {
	createStageAdapterServices,
	mountStageAdapter,
	type StageAdapterServices
} from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope, stageScene } from '$lib/authoring/stage/unit-stage-source';
import { hitStageMark } from '$lib/authoring/stage/stage-handles';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createAdapter as createLayoutAdapter } from '$lib/authoring/adapters/layout.adapter';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
import {
	shapeReadingSurface,
	type ShapeReadingSurface
} from '$lib/authoring/adapters/scene/shape/reading';
import {
	SCENE_FORM_MARK,
	axisTravelFromRay,
	formSizeMeasurement,
	formSizeScaleFromTravel,
	formWorldAxis,
	formWorldPoint,
	previewFormSize
} from '$lib/authoring/adapters/scene/shape/form-size';
import { formCardController } from '$lib/authoring/adapters/scene/form-card';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 96, top: 48, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-shape-reading';
const SETTLE_CLOCK = 2;

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
	readonly sceneRegistration: { dispose(): void };
};

/** A closed 7 × 6 enclosure on the datum, with no Scene entities. */
function fixtureDocument(): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	base.floor.elevation = 0;
	const chained = planWallChain({
		baseline: base,
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the enclosure fixture was refused');
	return chained.document;
}

async function mount(): Promise<Mounted> {
	const document = fixtureDocument();
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'Shape reading',
		layout: document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [],
			navigationNodes: [],
			connections: []
		}
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-shape-reading',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`Shape fixture not admitted: ${admitted.kind}`);
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
	// Production mounts every catalogue factory into the one facade. The Scene
	// adapter contributes Shape to the one Ink task; the Layout adapter owns that
	// task and delegates to the contributed reading.
	const layoutMount = mountStageAdapter(facade, host, createLayoutAdapter);
	const sceneMount = mountStageAdapter(facade, host, createSceneAdapter);
	if (layoutMount.kind !== 'registered' || sceneMount.kind !== 'registered') {
		throw new Error('Shape fixture adapters did not mount');
	}
	const services = createStageAdapterServices(facade, host);
	return { facade, session, host, services, sceneRegistration: sceneMount };
}

function armInk(facade: StageFacade): void {
	const opened = facade.openContributedTask('layout-ink');
	if (opened.kind !== 'opened') throw new Error(`Ink did not arm: ${opened.message}`);
}

function shapeSurface(controller: NonNullable<ReturnType<typeof inkSurface>>['controller']): ShapeReadingSurface {
	// Force the binding to open a fresh session: after an install both adapters
	// rebuild and the Layout binding may remember Shape as its reading without a
	// live session yet.
	controller.setReading('wall');
	controller.setReading('shape');
	const surface = shapeReadingSurface();
	if (surface === null) throw new Error('Shape reading published no surface');
	return surface;
}

function stageCss(facade: StageFacade, world: readonly [number, number, number]): readonly [number, number] {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the fixture has no evaluation');
	const projected = facade.projectWorld(world, evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

async function createFloorForm(mounted: Mounted): Promise<SceneFormEntity> {
	armInk(mounted.facade);
	const shape = shapeSurface(inkSurface()!.controller);
	for (const point of [
		[2, 0, 2],
		[4, 0, 2],
		[4, 0, 4],
		[2, 0, 4]
	] as const) {
		click(mounted.facade, point);
	}
	shape.controller.finish();
	const baseline = mounted.facade.snapshot().canonicalJson;
	shape.controller.create();
	await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
	const created = acceptedForms(mounted.facade)[0];
	if (created === undefined) throw new Error('the floor Shape did not create a form');
	// The install retires the evaluation the Shape press used; the next read of
	// marks projects through a fresh one, exactly as the route's frame does.
	mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK);
	return created;
}

function settleReading(facade: StageFacade, reading: 'plan' | '3d') {
	const start = SETTLE_CLOCK + 10;
	facade.camera.applyIntent({ kind: 'set-reading', reading }, start);
	facade.camera.evaluate(RECT, start + 10);
	const evaluation = facade.camera.evaluation();
	if (evaluation?.settledReading !== reading) throw new Error(`the Camera did not settle in ${reading}`);
	return evaluation;
}

function sizeMark(facade: StageFacade, axis: 0 | 1 | 2) {
	const id =
		axis === 0 ? SCENE_FORM_MARK.width : axis === 1 ? SCENE_FORM_MARK.height : SCENE_FORM_MARK.depth;
	if (!facade.marks().some((mark) => mark.id === id)) {
		facade.activateDisclosure(SCENE_FORM_MARK.scalePoint);
	}
	const mark = facade.marks().find((entry) => entry.id === id);
	if (mark === undefined) throw new Error(`the selected form published no size mark for axis ${axis}`);
	return mark;
}

/** A press point on a ray, away from the anchor every ray shares. */
function rayCss(mark: {
	readonly anchor: readonly [number, number];
	readonly tip: readonly [number, number] | null;
}): readonly [number, number] {
	if (mark.tip === null) throw new Error('the size mark published no ray tip');
	return [
		mark.anchor[0] + (mark.tip[0] - mark.anchor[0]) * 0.8,
		mark.anchor[1] + (mark.tip[1] - mark.anchor[1]) * 0.8
	];
}

function cursorAfterAxisDelta(
	facade: StageFacade,
	entity: SceneFormEntity,
	axis: 0 | 1 | 2,
	from: readonly [number, number],
	localDelta: number
): readonly [number, number] {
	const local: [number, number, number] = [0, 0, 0];
	local[axis] = localDelta;
	const start = stageCss(facade, formWorldPoint(entity, [0, 0, 0]));
	const end = stageCss(facade, formWorldPoint(entity, local));
	return [from[0] + end[0] - start[0], from[1] + end[1] - start[1]];
}

function axisTravelAtCursor(
	facade: StageFacade,
	entity: SceneFormEntity,
	axis: 0 | 1 | 2,
	css: readonly [number, number],
	evaluationId: string
): number {
	const result = facade.pointerRay([css[0] + RECT.left, css[1] + RECT.top], evaluationId);
	if (result.kind !== 'ray') throw new Error('the press point did not produce a pointer ray');
	const travel = axisTravelFromRay({
		origin: formWorldPoint(entity, [0, 0, 0]),
		direction: formWorldAxis(entity, axis),
		rayOrigin: result.ray.origin,
		rayDirection: result.ray.direction
	});
	if (travel === null) throw new Error('the press ray did not resolve against the size axis');
	return travel;
}

function cursorAtAxisTravel(
	facade: StageFacade,
	entity: SceneFormEntity,
	axis: 0 | 1 | 2,
	travelMeters: number
): readonly [number, number] {
	const origin = formWorldPoint(entity, [0, 0, 0]);
	const worldAxis = formWorldAxis(entity, axis);
	return stageCss(facade, [
		origin[0] + worldAxis[0] * travelMeters,
		origin[1] + worldAxis[1] * travelMeters,
		origin[2] + worldAxis[2] * travelMeters
	]);
}

function click(facade: StageFacade, world: readonly [number, number, number]): void {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the fixture has no evaluation');
	const css = stageCss(facade, world);
	facade.pointerIntent({ phase: 'down', css, evaluationId });
	facade.pointerIntent({ phase: 'up', css, evaluationId });
}

async function eventually(check: () => boolean, attempts = 200): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('condition never became true');
}

function acceptedForms(facade: StageFacade): readonly SceneFormEntity[] {
	return stageScene(facade.snapshot()).entities.filter(
		(entity): entity is SceneFormEntity => entity.kind === 'form'
	);
}

describe('T5.P01.S02 — Shape reading', () => {
	it('offers Shape beside the built-in readings and cancels its session on a switch', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		const controller = inkSurface()!.controller;
		expect(inkSurface()!.snapshot().readings.map((reading) => reading.id)).toEqual([
			'wall',
			'opening',
			'shape'
		]);
		const shape = shapeSurface(controller);
		expect(inkSurface()!.snapshot().reading).toBe('shape');
		expect(shape.snapshot().facts).toContainEqual({ label: 'Reading', value: 'Shape' });
		controller.setReading('wall');
		expect(shapeReadingSurface()).toBeNull();
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('creates one floor form from a closed stroke and keeps it through Undo/Redo', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		const baseline = mounted.facade.snapshot().canonicalJson;

		for (const point of [
			[2, 0, 2],
			[4, 0, 2],
			[4, 0, 4],
			[2, 0, 4]
		] as const) {
			click(mounted.facade, point);
		}
		expect(shape.snapshot()).toMatchObject({ phase: 'outline', points: 4, canFinish: true });
		shape.controller.finish();
		expect(shape.snapshot().phase).toBe('depth');
		expect(shape.snapshot().canCreate).toBe(true);
		// The preview and the commit are one form: same generator, same pose.
		const preview = mounted.facade.ghosts();
		expect(preview).toHaveLength(1);
		const previewForm = preview[0]!.shape;
		if (previewForm.kind !== 'form') throw new Error('the Shape preview is not a form ghost');
		const previewGhost = preview[0]!;

		shape.controller.create();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const forms = acceptedForms(mounted.facade);
		expect(forms).toHaveLength(1);
		const created = forms[0]!;
		expect(created).toMatchObject({
			name: 'Shape',
			materialId: 'plaster-warm',
			position: [3, 0, 3]
		});
		expect(created.form.generator).toMatchObject({ kind: 'extrude', plane: 'plan', extent: 1 });
		expect(created.form.scale).toEqual([1, 1, 1]);
		expect(previewForm.form).toEqual(created.form);
		expect(previewGhost.center).toEqual(created.position);
		expect(previewGhost.yaw).toBeCloseTo(created.rotation[1], 9);
		expect(mounted.facade.ghosts()).toHaveLength(0);
		expect(mounted.facade.selectionState().primary).toMatchObject({
			subject: { kind: 'entity', id: created.id }
		});
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(acceptedForms(mounted.facade)).toHaveLength(0);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(acceptedForms(mounted.facade).map((form) => form.id)).toEqual([created.id]);
	});

	it('refuses a self-intersecting outline in words, with no Create and no history', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		const baseline = mounted.facade.snapshot().canonicalJson;

		for (const point of [
			[2, 0, 2],
			[4, 0, 4],
			[4, 0, 2],
			[2, 0, 4]
		] as const) {
			click(mounted.facade, point);
		}
		expect(shape.snapshot().canFinish).toBe(false);
		// The reason is live feedback, not something Finish must be pressed to reveal.
		expect(shape.snapshot().refusal).toContain('crosses itself');
		shape.controller.finish();
		expect(shape.snapshot().refusal).toContain('crosses itself');
		expect(shape.snapshot().canCreate).toBe(false);
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});

	it('creates on an upright sheet and Flip side reverses the extrusion only', async () => {
		const mounted = await mount();
		// An elevated reading is not needed: a tilted 3D view makes vertical points distinct.
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: '3d' }, SETTLE_CLOCK);
		mounted.facade.camera.applyIntent(
			{
				kind: 'fit',
				bounds: { min: [2.5, 0, 2.5], max: [4.5, 1.5, 3.5] },
				rect: RECT
			},
			SETTLE_CLOCK + 1
		);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 2);
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		shape.controller.setPlane('elevation');
		shape.controller.setSheet({ x: 3, z: 3, yaw: 0 });
		const baseline = mounted.facade.snapshot().canonicalJson;

		for (const [u, v] of [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		] as const) {
			click(mounted.facade, [3 + u, v, 3]);
		}
		shape.controller.setDepth('0.25');
		expect(shape.snapshot().canFinish).toBe(true);
		shape.controller.finish();
		expect(shape.snapshot().canCreate).toBe(true);
		shape.controller.create();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		let form = acceptedForms(mounted.facade)[0]!;
		expect(form.form.generator).toMatchObject({ kind: 'extrude', plane: 'elevation', extent: 0.25 });
		expect(form.position[0]).toBeCloseTo(3.5, 9);
		expect(form.position[1]).toBeCloseTo(0, 9);
		expect(form.position[2]).toBeCloseTo(3, 9);
		expect(form.rotation[1]).toBeCloseTo(0, 9);

		// Flip side is offered in the depth phase and mirrors the profile so the
		// extrusion leaves from the other face while the drawn world profile stays.
		const before = form.form.generator.outline.map((anchor) => [anchor.u, anchor.v]);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 3);
		armInk(mounted.facade);
		const second = shapeSurface(inkSurface()!.controller);
		second.controller.setPlane('elevation');
		second.controller.setSheet({ x: 3, z: 3, yaw: 0 });
		for (const [u, v] of [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		] as const) {
			click(mounted.facade, [3 + u, v, 3]);
		}
		second.controller.finish();
		second.controller.flip();
		expect(second.snapshot().flip).toBe(true);
		second.controller.create();
		await eventually(() => acceptedForms(mounted.facade).length === 2);
		const flipped = acceptedForms(mounted.facade).find((candidate) => candidate.id !== form.id)!;
		expect(flipped.rotation[1]).toBeCloseTo(Math.PI, 9);
		const axes = (outline: readonly { readonly u: number; readonly v: number }[]) =>
			outline.map((anchor) => `${anchor.u.toFixed(6)}:${anchor.v.toFixed(6)}`).sort();
		expect(axes(flipped.form.generator.outline)).toEqual(
			axes(before.map(([u, v]) => ({ u: -u!, v: v! })))
		);
	});

	it('sizes one axis by ray, then writes an exact size through the Card, one history entry each', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		for (const point of [
			[2, 0, 2],
			[4, 0, 2],
			[4, 0, 4],
			[2, 0, 4]
		] as const) {
			click(mounted.facade, point);
		}
		shape.controller.finish();
		const baseline = mounted.facade.snapshot().canonicalJson;
		shape.controller.create();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK);
		const created = acceptedForms(mounted.facade)[0]!;
		const measurement = formSizeMeasurement(created);
		expect(measurement.handles).toHaveLength(3);
		const width = measurement.handles.find((handle) => handle.axis === 0)!;
		expect(width.baseDimension).toBeCloseTo(2, 6);
		expect(width.factor).toBe(2);
		const travel = (1.5 * width.baseDimension) / width.factor;
		const widthMark = sizeMark(mounted.facade, 0);
		const from = rayCss(widthMark);
		const to = cursorAfterAxisDelta(mounted.facade, created, 0, from, travel - width.dimension / width.factor);
		const evaluationId = mounted.facade.evaluationId()!;
		const down = mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: widthMark.id });
		expect(down.claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => acceptedForms(mounted.facade)[0]!.form.scale[0] !== 1);

		let current = acceptedForms(mounted.facade)[0]!;
		expect(current.form.scale[0]).toBeCloseTo(1.5, 6);
		expect(current.form.scale[1]).toBe(1);
		expect(current.form.scale[2]).toBe(1);
		expect(mounted.host.history()).toMatchObject({ depth: 3, position: 2 });
		// The baseline stays the unscaled outline extent, so a second resize on an
		// already-scaled axis is not off by the first scale factor.
		const resized = formSizeMeasurement(current).handles.find((handle) => handle.axis === 0)!;
		expect(resized.baseDimension).toBeCloseTo(2, 6);
		expect(resized.dimension).toBeCloseTo(3, 6);

		// A second drag on the already-scaled axis must use the same baseline: the
		// desired 4.5 m width is scale 2.25, not 2.25 divided by the first factor.
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 1);
		const secondEvaluation = mounted.facade.evaluationId()!;
		const secondMark = sizeMark(mounted.facade, 0);
		const secondFrom = rayCss(secondMark);
		const secondTravel = (2.25 * resized.baseDimension) / resized.factor;
		const secondTo = cursorAfterAxisDelta(
			mounted.facade,
			current,
			0,
			secondFrom,
			secondTravel - resized.dimension / resized.factor
		);
		mounted.facade.pointerIntent({ phase: 'down', css: secondFrom, evaluationId: secondEvaluation, handleId: secondMark.id });
		mounted.facade.pointerIntent({ phase: 'move', css: secondTo, evaluationId: secondEvaluation });
		mounted.facade.pointerIntent({ phase: 'up', css: secondTo, evaluationId: secondEvaluation });
		await eventually(() => Math.abs(acceptedForms(mounted.facade)[0]!.form.scale[0]! - 2.25) < 1e-6);
		current = acceptedForms(mounted.facade)[0]!;
		expect(current.form.scale[0]).toBeCloseTo(2.25, 6);
		expect(mounted.host.history()).toMatchObject({ depth: 4, position: 3 });

		// The Card is the one writer for exact values: dimensions, not scales.
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 2);
		const card = formCardController(mounted.services, current.id);
		if (card === null) throw new Error('the created form published no Card controller');
		const outcome = await card.size([4, 1, 2]);
		expect(outcome.kind).toBe('installed');
		await eventually(() => {
			const form = acceptedForms(mounted.facade)[0];
			return form !== undefined && Math.abs(form.form.scale[0]! - 2) < 1e-6;
		});
		current = acceptedForms(mounted.facade)[0]!;
		expect(current.form.scale[0]).toBeCloseTo(2, 6);
		expect(current.form.scale[1]).toBeCloseTo(1, 6);
		expect(current.form.scale[2]).toBeCloseTo(1, 6);
		expect(mounted.host.history()).toMatchObject({ depth: 5, position: 4 });
	});

	it('reveals the three size rays only from the Scale point and writes no history', async () => {
		const mounted = await mount();
		await createFloorForm(mounted);
		mounted.facade.closeDisclosure();
		const history = mounted.host.history();
		const ids = () => mounted.facade.marks().map((mark) => mark.id);
		expect(ids()).toEqual(
			expect.arrayContaining([
				SCENE_FORM_MARK.move,
				SCENE_FORM_MARK.turn,
				SCENE_FORM_MARK.scalePoint
			])
		);
		for (const id of [SCENE_FORM_MARK.width, SCENE_FORM_MARK.height, SCENE_FORM_MARK.depth]) {
			expect(ids()).not.toContain(id);
		}
		expect(mounted.facade.activateDisclosure(SCENE_FORM_MARK.scalePoint)).toBe(true);
		expect(ids()).toEqual(
			expect.arrayContaining([SCENE_FORM_MARK.width, SCENE_FORM_MARK.height, SCENE_FORM_MARK.depth])
		);
		expect(mounted.host.history()).toEqual(history);
	});

	it('separates the Plan Move grip from the Width ray through the real host', async () => {
		const mounted = await mount();
		await createFloorForm(mounted);
		settleReading(mounted.facade, 'plan');
		if (!mounted.facade.marks().some((mark) => mark.id === SCENE_FORM_MARK.width)) {
			mounted.facade.activateDisclosure(SCENE_FORM_MARK.scalePoint);
		}
		const move = mounted.facade.marks().find((mark) => mark.id === SCENE_FORM_MARK.move)!;
		const width = mounted.facade.marks().find((mark) => mark.id === SCENE_FORM_MARK.width)!;
		expect(move.descriptor.screen?.offset).not.toEqual([0, 0]);
		expect(width.descriptor.screen).toBeUndefined();
		expect(hitStageMark(mounted.facade.marks(), { css: width.tip!, coarse: true })?.id).toBe(
			SCENE_FORM_MARK.width
		);
		expect(hitStageMark(mounted.facade.marks(), { css: move.tip!, coarse: true })?.id).toBe(
			SCENE_FORM_MARK.move
		);
	});

	it('preserves the Move press offset for stationary and small drags at several yaws', async () => {
		for (const yaw of [0, 0.6, -1.2]) {
			const mounted = await mount();
			const created = await createFloorForm(mounted);
			const card = formCardController(mounted.services, created.id)!;
			await card.turn(yaw);
			settleReading(mounted.facade, 'plan');
			mounted.facade.setDrafting({ snap: false, snapSuspended: false });
			mounted.facade.closeDisclosure();

			const evaluationId = mounted.facade.evaluationId()!;
			const move = mounted.facade.marks().find((mark) => mark.id === SCENE_FORM_MARK.move)!;
			const hit = hitStageMark(mounted.facade.marks(), { css: move.tip!, coarse: true });
			expect(hit?.id).toBe(SCENE_FORM_MARK.move);
			const start = move.tip!;
			const before = acceptedForms(mounted.facade)[0]!;
			const history = mounted.host.history();
			expect(
				mounted.facade.pointerIntent({ phase: 'down', css: start, evaluationId, handleId: hit!.id }).claimed
			).toBe(true);
			mounted.facade.pointerIntent({ phase: 'move', css: start, evaluationId });
			mounted.facade.pointerIntent({ phase: 'up', css: start, evaluationId });
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(acceptedForms(mounted.facade)[0]!.position).toEqual(before.position);
			expect(mounted.host.history()).toMatchObject(history);

			const currentEvaluation = mounted.facade.evaluationId()!;
			const currentMove = mounted.facade.marks().find((mark) => mark.id === SCENE_FORM_MARK.move)!;
			const currentHit = hitStageMark(mounted.facade.marks(), { css: currentMove.tip!, coarse: true });
			const from = currentMove.tip!;
			const expected: readonly [number, number, number] = [
				before.position[0] + 0.12,
				before.position[1],
				before.position[2] - 0.08
			];
			const projectedOrigin = stageCss(mounted.facade, before.position);
			const projectedTarget = stageCss(mounted.facade, expected);
			const to = [from[0] + projectedTarget[0] - projectedOrigin[0], from[1] + projectedTarget[1] - projectedOrigin[1]] as const;
			const beforeMoveHistory = mounted.host.history();
			expect(
				mounted.facade.pointerIntent({
					phase: 'down', css: from, evaluationId: currentEvaluation, handleId: currentHit!.id
				}).claimed
			).toBe(true);
			mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId: currentEvaluation });
			mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId: currentEvaluation });
			await eventually(() => acceptedForms(mounted.facade)[0]!.position[0] !== before.position[0]);
			expect(acceptedForms(mounted.facade)[0]!.position[0]).toBeCloseTo(expected[0], 6);
			expect(acceptedForms(mounted.facade)[0]!.position[2]).toBeCloseTo(expected[2], 6);
			expect(mounted.host.history()).toMatchObject({
				depth: beforeMoveHistory.depth + 1,
				position: beforeMoveHistory.position + 1
			});
			mounted.facade.dispose();
		}
	});

	it('applies Move offset before Snap in Plan and 3D and refuses unsupported commits', async () => {
		for (const state of [
			{ reading: 'plan' as const, snap: true, snapSuspended: false, expected: [3.5, 0, 2.5] as const },
			{ reading: '3d' as const, snap: true, snapSuspended: true, expected: [3.62, 0, 2.54] as const }
		]) {
			const mounted = await mount();
			const created = await createFloorForm(mounted);
			settleReading(mounted.facade, state.reading);
			mounted.facade.setDrafting({ snap: state.snap, snapSuspended: state.snapSuspended });
			const evaluationId = mounted.facade.evaluationId()!;
			const move = mounted.facade.marks().find((mark) => mark.id === SCENE_FORM_MARK.move)!;
			const hit = hitStageMark(mounted.facade.marks(), { css: move.tip!, coarse: true });
			const from = move.tip!;
			const originOnDatum: readonly [number, number, number] = [created.position[0], 0, created.position[2]];
			const targetOnDatum: readonly [number, number, number] = [state.expected[0], 0, state.expected[2]];
			const projectedOrigin = stageCss(mounted.facade, originOnDatum);
			const projectedTarget = stageCss(mounted.facade, targetOnDatum);
			const to = [from[0] + projectedTarget[0] - projectedOrigin[0], from[1] + projectedTarget[1] - projectedOrigin[1]] as const;
			const history = mounted.host.history();
			expect(
				mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: hit!.id }).claimed
			).toBe(true);
			mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
			mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
			await eventually(() => acceptedForms(mounted.facade)[0]!.position[0] !== created.position[0]);
			expect(acceptedForms(mounted.facade)[0]!.position[0]).toBeCloseTo(state.expected[0], 1);
			expect(acceptedForms(mounted.facade)[0]!.position[2]).toBeCloseTo(state.expected[2], 1);
			expect(mounted.host.history()).toMatchObject({
				depth: history.depth + 1,
				position: history.position + 1
			});
			mounted.facade.dispose();
		}

		const mounted = await mount();
		const created = await createFloorForm(mounted);
		settleReading(mounted.facade, 'plan');
		mounted.facade.setDrafting({ snap: false, snapSuspended: false });
		const evaluationId = mounted.facade.evaluationId()!;
		const move = mounted.facade.marks().find((mark) => mark.id === SCENE_FORM_MARK.move)!;
		const from = move.tip!;
		const projectedOrigin = stageCss(mounted.facade, created.position);
		const projectedOutside = stageCss(mounted.facade, [7.5, 0, created.position[2]]);
		const to = [from[0] + projectedOutside[0] - projectedOrigin[0], from[1] + projectedOutside[1] - projectedOrigin[1]] as const;
		const history = mounted.host.history();
		const source = mounted.facade.snapshot().canonicalJson;
		const hit = hitStageMark(mounted.facade.marks(), { css: from, coarse: true });
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: hit!.id }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.ghosts()).toEqual([]);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(mounted.facade.snapshot().canonicalJson).toBe(source);
		expect(mounted.host.history()).toMatchObject(history);
		mounted.facade.dispose();
	});

	it('turns a form from the hit-resolved Turn ring with one history entry', async () => {
		const mounted = await mount();
		const created = await createFloorForm(mounted);
		settleReading(mounted.facade, 'plan');
		mounted.facade.closeDisclosure();
		const history = mounted.host.history();
		const marks = mounted.facade.marks();
		const turn = marks.find((mark) => mark.id === SCENE_FORM_MARK.turn)!;
		const ring = turn.ring!;
		const index = ring.findIndex((point) =>
			hitStageMark(marks, { css: point, coarse: true })?.id === SCENE_FORM_MARK.turn
		);
		if (index < 0) throw new Error('the Turn ring published no unclaimed point');
		const from = ring[index]!;
		const to = ring[(index + 4) % ring.length]!;
		const hit = hitStageMark(marks, { css: from, coarse: true });
		const evaluationId = mounted.facade.evaluationId()!;
		expect(
			mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: hit!.id }).claimed
		).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const current = acceptedForms(mounted.facade)[0];
			return current !== undefined && Math.abs(current.rotation[1] - created.rotation[1]) > 1e-6;
		});
		expect(mounted.host.history()).toMatchObject({ depth: history.depth + 1, position: history.position + 1 });
	});

	it('sizes Depth from the hit-resolved ray with one history entry', async () => {
		const mounted = await mount();
		let created = await createFloorForm(mounted);
		const card = formCardController(mounted.services, created.id)!;
		const turned = await card.turn(Math.PI / 4);
		expect(turned.kind).toBe('installed');
		created = acceptedForms(mounted.facade)[0]!;
		settleReading(mounted.facade, 'plan');
		const history = mounted.host.history();
		const depth = sizeMark(mounted.facade, 2);
		const hit = hitStageMark(mounted.facade.marks(), { css: depth.tip!, coarse: true });
		expect(hit?.id).toBe(SCENE_FORM_MARK.depth);
		const evaluationId = mounted.facade.evaluationId()!;
		const from = depth.tip!;
		expect(
			mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: hit!.id }).claimed
		).toBe(true);
		const handle = formSizeMeasurement(created).handles.find((entry) => entry.axis === 2)!;
		const to = cursorAfterAxisDelta(mounted.facade, created, 2, from, 0.5);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => acceptedForms(mounted.facade)[0]!.form.scale[2] !== created.form.scale[2]);
		const current = acceptedForms(mounted.facade)[0]!;
		expect(current.form.scale[2]).toBeCloseTo((handle.dimension + 0.5 * handle.factor) / handle.baseDimension, 4);
		expect(current.form.scale[0]).toBe(created.form.scale[0]);
		expect(current.form.scale[1]).toBe(created.form.scale[1]);
		expect(mounted.host.history()).toMatchObject({ depth: history.depth + 1, position: history.position + 1 });
	});

	it('keeps the accepted extent at the hit-resolved Width glyph until the pointer travels', async () => {
		const mounted = await mount();
		const created = await createFloorForm(mounted);
		settleReading(mounted.facade, 'plan');
		const history = mounted.host.history();
		const width = sizeMark(mounted.facade, 0);
		const hit = hitStageMark(mounted.facade.marks(), { css: width.tip!, coarse: true });
		expect(hit?.id).toBe(SCENE_FORM_MARK.width);
		const evaluationId = mounted.facade.evaluationId()!;
		const from = width.tip!;
		expect(
			mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: hit!.id }).claimed
		).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: from, evaluationId });
		expect(mounted.facade.ghosts().some((ghost) => ghost.id === 'scene-form-mark-preview')).toBe(false);
		const tinyMove = [from[0] + 0.5, from[1]] as const;
		mounted.facade.pointerIntent({ phase: 'move', css: tinyMove, evaluationId });
		const preview = mounted.facade.ghosts().find((ghost) => ghost.id === 'scene-form-mark-preview');
		expect(preview?.shape.kind).toBe('form');
		if (preview?.shape.kind !== 'form') throw new Error('the small Width drag produced no preview');
		expect(Math.abs(preview.shape.form.scale[0] - created.form.scale[0]!)).toBeLessThan(0.02);
		expect(preview.shape.form.scale[1]).toBe(created.form.scale[1]);
		expect(preview.shape.form.scale[2]).toBe(created.form.scale[2]);
		mounted.facade.pointerIntent({ phase: 'cancel', css: tinyMove, evaluationId });
		expect(acceptedForms(mounted.facade)[0]!.form.scale).toEqual(created.form.scale);
		expect(mounted.host.history()).toEqual(history);
	});

	it('refuses an out-of-range ray without history or source change', async () => {
		const mounted = await mount();
		await createFloorForm(mounted);
		settleReading(mounted.facade, 'plan');
		const before = mounted.facade.snapshot().canonicalJson;
		const history = mounted.host.history();
		const width = sizeMark(mounted.facade, 0);
		const hit = hitStageMark(mounted.facade.marks(), { css: width.tip!, coarse: true });
		expect(hit?.id).toBe(SCENE_FORM_MARK.width);
		const evaluationId = mounted.facade.evaluationId()!;
		const from = width.tip!;
		expect(
			mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: hit!.id }).claimed
		).toBe(true);
		const to = [
			from[0] + (from[0] - width.anchor[0]) * 100,
			from[1] + (from[1] - width.anchor[1]) * 100
		] as const;
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		expect(sizeMark(mounted.facade, 0).refusal).toContain('within [0.001, 100] m');
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history()).toEqual(history);
	});

	it('keeps mark and Card scale and refusal identical at the policy bounds', async () => {
		const mounted = await mount();
		const created = await createFloorForm(mounted);
		const before = mounted.facade.snapshot().canonicalJson;
		const history = mounted.host.history();
		const card = formCardController(mounted.services, created.id);
		if (card === null) throw new Error('the created form published no Card controller');
		const width = formSizeMeasurement(created).handles.find((handle) => handle.axis === 0)!;
		const envelope = stageEnvelope(mounted.facade.snapshot());
		const context = {
			layout: envelope.units.layout.data,
			scene: envelope.units.scene.data,
			sourceContentId: mounted.facade.snapshot().sourceContentId
		};
		const preview = (scale: readonly [number, number, number]) =>
			previewFormSize({ context, entityId: created.id, scale });
		const validScale = formSizeScaleFromTravel({
			entity: created,
			handle: width,
			travelMeters: (1.5 * width.baseDimension) / width.factor
		})!;
		const validCardScale = 3 / card.dimensions[0]! * created.form.scale[0]!;
		expect(validScale[0]).toBeCloseTo(validCardScale, 9);
		for (const [desired, value] of [
			[0.0005, 0.001],
			[500, 1000]
		] as const) {
			const markScale = formSizeScaleFromTravel({
				entity: created,
				handle: width,
				travelMeters: (desired * width.baseDimension) / width.factor
			})!;
			const cardScale = [
				value / card.dimensions[0]! * created.form.scale[0]!,
				created.form.scale[1]!,
				created.form.scale[2]!
			] as const;
			for (let axis = 0; axis < 3; axis += 1) {
				expect(markScale[axis]!).toBeCloseTo(cardScale[axis]!, 9);
			}
			const markPreview = preview(markScale);
			const cardPreview = preview(cardScale);
			if (!('refusal' in markPreview) || !('refusal' in cardPreview)) {
				throw new Error('the out-of-range scale was not refused');
			}
			expect(markPreview.refusal).toBe(cardPreview.refusal);
			const outcome = await card.size([value, card.dimensions[1]!, card.dimensions[2]!]);
			expect(outcome.kind).toBe('refused');
			if (outcome.kind === 'refused') expect(outcome.message).toBe(markPreview.refusal);
		}
		// Neither the mark planner nor the Card wrote an F4 entry or source.
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history()).toEqual(history);
	});

	it('sizes Height in settled Plan through its screen handle and commits one undoable result', async () => {
		const mounted = await mount();
		const created = await createFloorForm(mounted);
		const evaluation = settleReading(mounted.facade, 'plan');
		const height = formSizeMeasurement(created).handles.find((handle) => handle.axis === 1)!;
		const heightMark = sizeMark(mounted.facade, 1);
		const from = heightMark.anchor;
		const projectedWorldHandle = stageCss(mounted.facade, height.world);
		// Plan hides world Y. The Height mark therefore needs its own visible
		// screen travel, and the same point must be the hit-test target.
		expect(sizeMark(mounted.facade, 1).tag).toContain('Height');
		expect(Math.abs(from[1] - projectedWorldHandle[1])).toBeGreaterThan(20);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });

		const evaluationId = mounted.facade.evaluationId()!;
		const down = mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: heightMark.id });
		expect(down.claimed).toBe(true);
		const to = [from[0], from[1] - 80] as const;
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const preview = mounted.facade.ghosts().find((ghost) => ghost.id === 'scene-form-mark-preview');
		expect(preview?.shape.kind).toBe('form');
		if (preview?.shape.kind !== 'form') throw new Error('Plan Height produced no form preview');
		const expectedScale =
			(height.dimension + 80 * evaluation.targetPlaneMetersPerCssPixel) / height.baseDimension;
		expect(preview.shape.form.scale[1]).toBeCloseTo(expectedScale, 5);
		expect(sizeMark(mounted.facade, 1).anchor[1]).toBeCloseTo(from[1] - 80, 1);

		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => acceptedForms(mounted.facade)[0]!.form.scale[1] > created.form.scale[1]);
		const committed = acceptedForms(mounted.facade)[0]!;
		expect(committed.form.scale[0]).toBe(created.form.scale[0]);
		expect(committed.form.scale[1]).toBeGreaterThan(created.form.scale[1]);
		expect(committed.form.scale[2]).toBe(created.form.scale[2]);
		expect(mounted.host.history()).toMatchObject({ depth: 3, position: 2 });

		expect((await mounted.host.undo()).kind).toBe('installed');
		await eventually(() => acceptedForms(mounted.facade)[0]!.form.scale[1] === created.form.scale[1]);
		expect(mounted.host.history()).toMatchObject({ depth: 3, position: 1 });
	});

	it('cancels Plan Height preview without changing source or history', async () => {
		const mounted = await mount();
		const created = await createFloorForm(mounted);
		settleReading(mounted.facade, 'plan');
		const before = mounted.facade.snapshot().canonicalJson;
		const history = mounted.host.history();
		const heightMark = sizeMark(mounted.facade, 1);
		const from = heightMark.anchor;
		const evaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: heightMark.id }).claimed).toBe(true);
		const to = [from[0], from[1] - 64] as const;
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.ghosts().some((ghost) => ghost.id === 'scene-form-mark-preview')).toBe(true);

		expect(mounted.facade.pointerIntent({ phase: 'cancel', css: to, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(acceptedForms(mounted.facade)[0]!.form.scale).toEqual(created.form.scale);
		expect(mounted.host.history()).toEqual(history);
		expect(mounted.facade.ghosts().some((ghost) => ghost.id === 'scene-form-mark-preview')).toBe(false);
	});

	it('refuses Plan Height while another gesture owns the Stage', async () => {
		const mounted = await mount();
		const created = await createFloorForm(mounted);
		settleReading(mounted.facade, 'plan');
		const before = mounted.facade.snapshot().canonicalJson;
		const history = mounted.host.history();
		const evaluationId = mounted.facade.evaluationId()!;
		const occupied = mounted.facade.acquireGesture({
			owner: 'shape-size-test-owner',
			evaluationId,
			policy: 'cancel-on-reading-change'
		});
		expect(occupied.kind).toBe('granted');
		const heightMark = sizeMark(mounted.facade, 1);
		const down = mounted.facade.pointerIntent({
			phase: 'down',
			css: heightMark.anchor,
			evaluationId,
			handleId: heightMark.id
		});
		expect(down.claimed).toBe(false);
		expect(sizeMark(mounted.facade, 1).refusal).toContain('shape-size-test-owner');
		expect(mounted.facade.ghosts().some((ghost) => ghost.id === 'scene-form-mark-preview')).toBe(false);
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(acceptedForms(mounted.facade)[0]!.form.scale).toEqual(created.form.scale);
		if (occupied.kind === 'granted') occupied.lease.release();
		expect(mounted.host.history()).toEqual(history);
	});

	it('drops a live Plan Height preview when accepted content replaces its source', async () => {
		const mounted = await mount();
		await createFloorForm(mounted);
		settleReading(mounted.facade, 'plan');
		const heightMark = sizeMark(mounted.facade, 1);
		const from = heightMark.anchor;
		const evaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: heightMark.id }).claimed).toBe(true);
		const to = [from[0], from[1] - 64] as const;
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.ghosts().some((ghost) => ghost.id === 'scene-form-mark-preview')).toBe(true);

		const emptyProject = await createUnitProject({
			id: PROJECT_ID,
			name: 'Shape reading',
			layout: fixtureDocument(),
			scene: {
				formatVersion: 1,
				textures: [],
				materials: [],
				entities: [],
				navigationNodes: [],
				connections: []
			}
		});
		const admitted = await admitSource(emptyProject, {
			sessionEpoch: mounted.facade.snapshot().sessionEpoch,
			acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-size-replacement' }
		});
		if (admitted.kind !== 'admitted') throw new Error('the replacement source was not admitted');
		const installed = mounted.facade.installAccepted(admitted.snapshot);
		expect(installed.kind).toBe('installed');
		const installedSource = mounted.facade.snapshot().canonicalJson;
		await eventually(() => acceptedForms(mounted.facade).length === 0);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 30);
		expect(mounted.facade.ghosts().some((ghost) => ghost.id === 'scene-form-mark-preview')).toBe(false);

		// A release from the retired evaluation cannot write its captured form back.
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		expect(acceptedForms(mounted.facade)).toHaveLength(0);
		expect(mounted.facade.snapshot().canonicalJson).toBe(installedSource);
	});

	it('keeps upright-form Height on the world axis in 3D', async () => {
		const mounted = await mount();
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: '3d' }, SETTLE_CLOCK);
		mounted.facade.camera.applyIntent(
			{
				kind: 'fit',
				bounds: { min: [2.5, 0, 2.5], max: [4.5, 3, 3.5] },
				rect: RECT
			},
			SETTLE_CLOCK + 1
		);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 20);
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		shape.controller.setPlane('elevation');
		shape.controller.setSheet({ x: 3, z: 3, yaw: 0 });
		for (const point of [
			[3, 0, 3],
			[4, 0, 3],
			[4, 1, 3],
			[3, 1, 3]
		] as const) {
			click(mounted.facade, point);
		}
		shape.controller.finish();
		const baseline = mounted.facade.snapshot().canonicalJson;
		shape.controller.create();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		let created = acceptedForms(mounted.facade)[0]!;
		expect(created.form.generator.plane).toBe('elevation');
		const card = formCardController(mounted.services, created.id)!;
		expect((await card.turn(Math.PI / 6)).kind).toBe('installed');
		created = acceptedForms(mounted.facade)[0]!;
		const evaluation = settleReading(mounted.facade, '3d');
		const height = formSizeMeasurement(created).handles.find((handle) => handle.axis === 1)!;
		const travel = (1.5 * height.baseDimension) / height.factor;
		const heightMark = sizeMark(mounted.facade, 1);
		const from = rayCss(heightMark);
		const evaluationId = mounted.facade.evaluationId()!;
		const startTravel = axisTravelAtCursor(mounted.facade, created, 1, from, evaluationId);
		const to = cursorAtAxisTravel(
			mounted.facade,
			created,
			1,
			startTravel + travel - height.dimension / height.factor
		);
		expect(evaluation.settledReading).toBe('3d');
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: heightMark.id }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => acceptedForms(mounted.facade)[0]!.form.scale[1] > created.form.scale[1]);
		expect(height.factor).toBe(1);
		expect(acceptedForms(mounted.facade)[0]!.form.scale[1]).toBeCloseTo(1.5, 5);
	});

	it('keeps live Shape work when another reading would discard it', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		click(mounted.facade, [2, 0, 2]);
		click(mounted.facade, [4, 0, 2]);
		expect(shape.snapshot().points).toBe(2);

		inkSurface()!.controller.setReading('wall');

		expect(inkSurface()!.snapshot().reading).toBe('shape');
		expect(inkSurface()!.snapshot().refusal).toContain('before switching readings');
		expect(shapeReadingSurface()).toBe(shape);
		expect(shape.snapshot()).toMatchObject({ phase: 'outline', points: 2 });
		// Abandoning it is explicit, and writes nothing.
		// A plane or sheet move would also discard the points; both refuse instead.
		shape.controller.setPlane('elevation');
		expect(shape.snapshot().plane).toBe('plan');
		expect(shape.snapshot().refusal).toContain('before changing its sheet');
		shape.controller.setSheet({ x: 2 });
		expect(shape.snapshot().sheet.x).toBe(0);
		expect(shape.snapshot().refusal).toContain('before changing its sheet');

		// Abandoning it is explicit, and writes nothing.
		shape.controller.clear();
		expect(shape.snapshot().points).toBe(0);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		shape.controller.setPlane('elevation');
		expect(shape.snapshot().plane).toBe('elevation');

		// With no live work the switch goes through and the session is gone.
		inkSurface()!.controller.setReading('wall');
		expect(inkSurface()!.snapshot().reading).toBe('wall');
		expect(shapeReadingSurface()).toBeNull();
	});

	it('refuses an invalid typed depth, then creates with the corrected value', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		const baseline = mounted.facade.snapshot().canonicalJson;
		for (const point of [
			[2, 0, 2],
			[4, 0, 2],
			[4, 0, 4],
			[2, 0, 4]
		] as const) {
			click(mounted.facade, point);
		}
		shape.controller.finish();

		shape.controller.setDepth('');
		expect(shape.snapshot().refusal).toContain('empty field is not zero');
		expect(shape.snapshot().canCreate).toBe(false);
		shape.controller.setDepth('0');
		expect(shape.snapshot().refusal).toContain('between');
		expect(shape.snapshot().canCreate).toBe(false);
		shape.controller.create();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);

		shape.controller.setDepth('2');
		expect(shape.snapshot().canCreate).toBe(true);
		shape.controller.create();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		expect(acceptedForms(mounted.facade)[0]!.form.generator).toMatchObject({ extent: 2 });
	});

	it('pulls depth along the axis from the handle instead of collapsing it', async () => {
		const mounted = await mount();
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: '3d' }, SETTLE_CLOCK);
		mounted.facade.camera.applyIntent(
			{
				kind: 'fit',
				bounds: { min: [1.5, -0.5, 1.5], max: [4.5, 2.5, 4.5] },
				rect: RECT
			},
			SETTLE_CLOCK + 1
		);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 2);
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		for (const point of [
			[2, 0, 2],
			[4, 0, 2],
			[4, 0, 4],
			[2, 0, 4]
		] as const) {
			click(mounted.facade, point);
		}
		shape.controller.finish();
		expect(shape.snapshot().depth).toBe(1);
		// Invalid typed text must not survive a later, valid handle drag.
		shape.controller.setDepth('0');
		expect(shape.snapshot().canCreate).toBe(false);

		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [3, 1, 3]);
		const to = stageCss(mounted.facade, [3, 2.5, 3]);
		mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });

		expect(shape.snapshot().depth).toBeCloseTo(2.5, 1);
		expect(shape.snapshot().canCreate).toBe(true);
		const baseline = mounted.facade.snapshot().canonicalJson;
		shape.controller.create();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		const generator = acceptedForms(mounted.facade)[0]!.form.generator;
		expect(generator.kind).toBe('extrude');
		if (generator.kind !== 'extrude') return;
		expect(generator.extent).toBeCloseTo(2.5, 3);
	});

	it('pulls floor depth upward in Plan, where the floor normal has no screen travel', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		for (const point of [
			[2, 0, 2],
			[4, 0, 2],
			[4, 0, 4],
			[2, 0, 4]
		] as const) {
			click(mounted.facade, point);
		}
		shape.controller.finish();
		// An invalid typed depth must not survive a valid handle drag.
		shape.controller.setDepth('0');
		expect(shape.snapshot().canCreate).toBe(false);

		const centre = stageCss(mounted.facade, [3, 0, 3]);
		const marker = () => mounted.facade.overlays().find((entry) => entry.id === 'scene-shape-depth')!;
		expect(marker().css[1]).toBeLessThan(centre[1] - 1);

		const evaluationId = mounted.facade.evaluationId()!;
		const from = marker().css;
		const to = [from[0], from[1] - 80] as const;
		mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });

		expect(shape.snapshot().depth).toBeGreaterThan(1);
		expect(shape.snapshot().canCreate).toBe(true);
		expect(marker().css[1]).toBeLessThan(from[1]);
	});

	it('discards an interrupted depth press and keeps a completed one', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		for (const point of [
			[2, 0, 2],
			[4, 0, 2],
			[4, 0, 4],
			[2, 0, 4]
		] as const) {
			click(mounted.facade, point);
		}
		shape.controller.finish();
		const marker = () => mounted.facade.overlays().find((entry) => entry.id === 'scene-shape-depth')!;
		// The ghost is the candidate Create would install, so its extent is the
		// press's own report of what the next Create commits.
		const previewExtent = () => {
			const ghost = mounted.facade.ghosts()[0];
			if (ghost?.shape.kind !== 'form') throw new Error('the Shape published no preview');
			const generator = ghost.shape.form.generator;
			if (generator.kind !== 'extrude') throw new Error('the Shape preview is not an extrusion');
			return generator.extent;
		};
		const evaluationId = mounted.facade.evaluationId()!;
		const before = shape.snapshot().depth;
		expect(previewExtent()).toBeCloseTo(before, 6);

		// The environment takes the pointer mid-pull: the depth it never chose, and
		// the candidate built from it, both go back to the pre-press state.
		const from = marker().css;
		const to = [from[0], from[1] - 80] as const;
		mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(shape.snapshot().depth).toBeGreaterThan(before);
		expect(previewExtent()).toBeCloseTo(shape.snapshot().depth, 6);
		mounted.facade.pointerIntent({ phase: 'cancel', css: to, evaluationId });
		expect(shape.snapshot()).toMatchObject({ phase: 'depth', depth: before, canCreate: true });
		expect(previewExtent()).toBeCloseTo(before, 6);

		// A press that ends normally keeps what it pulled, and Create commits it.
		const again = marker().css;
		const pulled = [again[0], again[1] - 80] as const;
		mounted.facade.pointerIntent({ phase: 'down', css: again, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: pulled, evaluationId });
		const completed = shape.snapshot().depth;
		expect(completed).toBeGreaterThan(before);
		mounted.facade.pointerIntent({ phase: 'up', css: pulled, evaluationId });
		expect(shape.snapshot().depth).toBe(completed);
		expect(previewExtent()).toBeCloseTo(completed, 6);

		// A reading flip ends the press through its evaluation mismatch; the partial
		// depth it measured is discarded the same way a cancel discards it.
		const flipFrom = marker().css;
		const flipTo = [flipFrom[0], flipFrom[1] - 80] as const;
		mounted.facade.pointerIntent({ phase: 'down', css: flipFrom, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: flipTo, evaluationId });
		expect(shape.snapshot().depth).toBeGreaterThan(completed);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 30);
		const flippedEvaluationId = mounted.facade.evaluationId()!;
		expect(flippedEvaluationId).not.toBe(evaluationId);
		mounted.facade.pointerIntent({ phase: 'move', css: flipTo, evaluationId: flippedEvaluationId });
		expect(shape.snapshot()).toMatchObject({ phase: 'depth', depth: completed });
		expect(shape.snapshot().refusal).toContain('reading changed');
		expect(previewExtent()).toBeCloseTo(completed, 6);

		const baseline = mounted.facade.snapshot().canonicalJson;
		shape.controller.create();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		const created = acceptedForms(mounted.facade)[0]!;
		if (created.form.generator.kind !== 'extrude') throw new Error('the created form is not an extrusion');
		expect(created.form.generator.extent).toBeCloseTo(completed, 6);
	});

	it('places the upright depth handle on the standing body and follows Flip side', async () => {
		const mounted = await mount();
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: '3d' }, SETTLE_CLOCK);
		mounted.facade.camera.applyIntent(
			{
				kind: 'fit',
				bounds: { min: [2.5, 0.5, 2.5], max: [4.5, 3.5, 3.5] },
				rect: RECT
			},
			SETTLE_CLOCK + 1
		);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 2);
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		shape.controller.setPlane('elevation');
		shape.controller.setSheet({ x: 3, z: 3, yaw: 0 });

		// Drawn at 2–3 m high: the planner rests the body on the floor, so the
		// handle belongs at its 0.5 m midpoint, not at the drawn 2.5 m centre.
		for (const [u, v] of [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		] as const) {
			click(mounted.facade, [3 + u, 2 + v, 3]);
		}
		shape.controller.finish();
		expect(shape.snapshot().depth).toBe(1);

		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [3.5, 0.5, 4]);
		const to = stageCss(mounted.facade, [3.5, 0.5, 5]);
		mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		expect(shape.snapshot().depth).toBeCloseTo(2, 1);

		// Flipping turns the extrusion to −Z: the handle moves with the body, and a
		// drag on that side must still increase depth instead of clamping.
		shape.controller.flip();
		expect(shape.snapshot().flip).toBe(true);
		const flippedFrom = stageCss(mounted.facade, [3.5, 0.5, 1]);
		const flippedTo = stageCss(mounted.facade, [3.5, 0.5, 1.5]);
		mounted.facade.pointerIntent({ phase: 'down', css: flippedFrom, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: flippedTo, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: flippedTo, evaluationId });
		expect(shape.snapshot().depth).toBeCloseTo(1.5, 1);

		const baseline = mounted.facade.snapshot().canonicalJson;
		shape.controller.create();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		const created = acceptedForms(mounted.facade)[0]!;
		expect(created.rotation[1]).toBeCloseTo(Math.PI, 6);
		const generator = created.form.generator;
		expect(generator.kind).toBe('extrude');
		if (generator.kind !== 'extrude') return;
		expect(generator.extent).toBeCloseTo(1.5, 3);
	});

	it('keeps upright depth on its projected axis when the camera switches to Plan', async () => {
		const mounted = await mount();
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: '3d' }, SETTLE_CLOCK);
		mounted.facade.camera.applyIntent(
			{
				kind: 'fit',
				bounds: { min: [2.5, 0.5, 2], max: [3.5, 3.5, 4] },
				rect: RECT
			},
			SETTLE_CLOCK + 1
		);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 2);
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		shape.controller.setPlane('elevation');
		// A 45° sheet keeps its extrusion oblique in Plan, so the vertical floor
		// fallback and the true projected world axis are visibly different.
		const diagonal = Math.SQRT1_2;
		shape.controller.setSheet({ x: 3, z: 3, yaw: Math.PI / 4 });

		for (const [u, v] of [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		] as const) {
			click(mounted.facade, [3 + u * diagonal, v, 3 - u * diagonal]);
		}
		shape.controller.finish();
		expect(shape.snapshot().phase).toBe('depth');

		// The camera changes, not the Shape's sheet. Its world handle must keep the
		// horizontal offset of the +X extrusion instead of receiving the floor's
		// vertical screen-space fallback.
		mounted.facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, SETTLE_CLOCK + 3);
		mounted.facade.camera.applyIntent(
			{
				kind: 'fit',
				bounds: { min: [2, 0, 1], max: [5, 2, 4] },
				rect: RECT
			},
			SETTLE_CLOCK + 4
		);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 5);

		const marker = () => mounted.facade.overlays().find((entry) => entry.id === 'scene-shape-depth')!;
		const baseWorld = [3 + diagonal * 0.5, 0.5, 3 - diagonal * 0.5] as const;
		const base = stageCss(mounted.facade, baseWorld);
		const expected = stageCss(mounted.facade, [
			baseWorld[0] + diagonal,
			baseWorld[1],
			baseWorld[2] + diagonal
		]);
		expect(marker().css[0]).toBeCloseTo(expected[0], 1);
		expect(marker().css[1]).toBeCloseTo(expected[1], 1);
		expect(Math.abs(marker().css[0] - base[0])).toBeGreaterThan(10);
		expect(Math.abs(marker().css[1] - base[1])).toBeGreaterThan(10);

		const evaluationId = mounted.facade.evaluationId()!;
		const target = stageCss(mounted.facade, [
			baseWorld[0] + diagonal * 2,
			baseWorld[1],
			baseWorld[2] + diagonal * 2
		]);
		const from = marker().css;
		mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: target, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: target, evaluationId });

		expect(shape.snapshot().depth).toBeCloseTo(2, 1);
		expect(shape.snapshot().canCreate).toBe(true);
	});

	it('cancels a live size ray when another task opens', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		for (const point of [
			[2, 0, 2],
			[4, 0, 2],
			[4, 0, 4],
			[2, 0, 4]
		] as const) {
			click(mounted.facade, point);
		}
		shape.controller.finish();
		const baseline = mounted.facade.snapshot().canonicalJson;
		shape.controller.create();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK);
		const created = acceptedForms(mounted.facade)[0]!;
		const width = formSizeMeasurement(created).handles.find((handle) => handle.axis === 0)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const widthMark = sizeMark(mounted.facade, 0);
		const from = rayCss(widthMark);
		const to = stageCss(mounted.facade, [width.world[0] + 1, width.world[1], width.world[2]]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, handleId: widthMark.id }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });

		// A task now owns the pointer. The open size lease must be gone, or every
		// later gesture is refused and its preview can linger.
		const opened = mounted.facade.openContributedTask('layout-ink');
		expect(opened.kind).toBe('opened');
		const probe = mounted.facade.acquireGesture({
			owner: 'size-test-probe',
			evaluationId,
			policy: 'cancel-on-reading-change'
		});
		expect(probe.kind).toBe('granted');
		if (probe.kind === 'granted') probe.lease.release();

		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		expect(acceptedForms(mounted.facade)[0]!.form.scale).toEqual([1, 1, 1]);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('answers Finish, Backtrack and Cancel from the Stage keyboard', async () => {
		const mounted = await mount();
		armInk(mounted.facade);
		const shape = shapeSurface(inkSurface()!.controller);
		for (const point of [
			[2, 0, 2],
			[4, 0, 2],
			[4, 0, 4]
		] as const) {
			click(mounted.facade, point);
		}
		expect(shape.snapshot().points).toBe(3);

		expect(mounted.facade.keyboardIntent({ kind: 'backtrack' }).claimed).toBe(true);
		expect(shape.snapshot().points).toBe(2);
		click(mounted.facade, [4, 0, 4]);
		expect(mounted.facade.keyboardIntent({ kind: 'finish' }).claimed).toBe(true);
		expect(shape.snapshot().phase).toBe('depth');

		expect(mounted.facade.keyboardIntent({ kind: 'cancel' }).claimed).toBe(true);
		expect(shape.snapshot()).toMatchObject({ phase: 'outline', points: 0 });
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
	});
});

describe('R217.S06 — Scene owner height ticks', () => {
	it('publishes a floor-standing form top and drops it with the Scene binding', async () => {
		const mounted = await mount();
		const form = await createFloorForm(mounted);
		const bounds = formSizeMeasurement(form).bounds;
		if (bounds === null) throw new Error('the created form has no evaluated bounds');
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 5);

		const ticks = mounted.facade.heightTicks();
		expect(ticks[0]).toMatchObject({ kind: 'datum', heightMeters: 0, label: 'Floor' });
		const top = bounds.max[1];
		const found = ticks.find(
			(tick) => tick.kind === 'found' && Math.abs(tick.heightMeters - top) < 1e-6
		);
		expect(found).toBeDefined();

		// The Scene binding is the owner. Without it the host does not compute a
		// surface of its own, so the form's tick disappears.
		mounted.sceneRegistration.dispose();
		const after = mounted.facade.heightTicks();
		expect(
			after.some((tick) => tick.kind === 'found' && Math.abs(tick.heightMeters - top) < 1e-6)
		).toBe(false);
	});
});
