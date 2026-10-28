/**
 * T5.P01.S02 — Shape reading and sizing through the live host.
 *
 * The suite drives the production Scene and Layout adapters, the real F.4
 * acceptance host and the one Ink task. It pins the slice's contracts:
 *
 * 1. Ink stays one Pen: Layout's built-in readings and the contributed Shape
 *    reading share one palette, and switching cancels the contributed session
 *    without writing source.
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
import { stageScene } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createAdapter as createLayoutAdapter } from '$lib/authoring/adapters/layout.adapter';
import { inkSurface } from '$lib/authoring/adapters/layout/ink';
import {
	shapeReadingSurface,
	type ShapeReadingSurface
} from '$lib/authoring/adapters/scene/shape/reading';
import {
	formSizeMeasurement,
	formWorldAxis,
	formWorldPoint
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
	return { facade, session, host, services };
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
		const origin = formWorldPoint(created, [0, 0, 0]);
		const axis = formWorldAxis(created, 0);
		const travel = (1.5 * width.baseDimension) / width.factor;
		const from = stageCss(mounted.facade, width.world);
		const to = stageCss(mounted.facade, [
			origin[0] + axis[0] * travel,
			origin[1] + axis[1] * travel,
			origin[2] + axis[2] * travel
		]);
		const evaluationId = mounted.facade.evaluationId()!;
		const down = mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
		expect(down.claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => acceptedForms(mounted.facade)[0]!.form.scale[0] !== 1);

		let current = acceptedForms(mounted.facade)[0]!;
		expect(current.form.scale[0]).toBeCloseTo(1.5, 6);
		expect(current.form.scale[1]).toBe(1);
		expect(current.form.scale[2]).toBe(1);
		expect(mounted.host.history()).toMatchObject({ depth: 3, position: 2 });

		// The Card is the one writer for exact values: dimensions, not scales.
		mounted.facade.camera.evaluate(RECT, SETTLE_CLOCK + 1);
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
		expect(mounted.host.history()).toMatchObject({ depth: 4, position: 3 });
	});
});
