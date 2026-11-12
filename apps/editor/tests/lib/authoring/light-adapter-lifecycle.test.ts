/**
 * T2.S3a — the light adapter's real pointer lifecycle.
 *
 * These cases mount the Scene and Light adapters on the public Stage host. They
 * prove one accepted `create-light` per press/release, no write on cancel, one
 * accepted `update-light` per handle gesture, the surface-normal standoff, the
 * working-height fallback, and the spot's target-based cutoff.
 */
import { describe, expect, it, vi } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import type { SceneEntity, SceneLightEntity, Vec3 } from '@portfolio/project-model';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import { armedLightKind, armLight } from '$lib/authoring/look/light-tool.svelte';
import { lightForward, rotationForLightDirection } from '$lib/authoring/look/light-aim';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createAdapter as createLightAdapter } from '$lib/authoring/adapters/light.adapter';
import type { SceneRenderedHit } from '$lib/authoring/scene/scene-pick-source';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageLightPreview } from '$lib/authoring/stage/stage-light-preview.svelte';
import { stageScene } from '$lib/authoring/stage/unit-stage-source';
import { admitUnitProject, createUnitProject } from './__fixtures__/unit-envelope-fixtures';

const PROJECT_ID = 'project-light-lifecycle';
const SESSION_EPOCH = 'session-light-lifecycle';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const OFFSET_RECT = { left: 240, top: 110, width: 1280, height: 720, devicePixelRatio: 1 };

function fixtureLayout() {
	const baseline = createEmptyWallFirstLayoutDocument();
	const result = planWallChain({
		baseline,
		points: [[0, 0], [7, 0], [7, 6], [0, 6]],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (result.kind !== 'success') throw new Error('light lifecycle fixture was refused');
	return result.document;
}

function spotAt(position: Vec3, id = 'light-existing'): SceneLightEntity {
	return {
		kind: 'light',
		light: 'spot',
		id,
		name: 'Existing spot',
		color: '#ffffff',
		intensity: Math.PI,
		castShadow: false,
		position,
		rotation: rotationForLightDirection([0, -1, 0]),
		angle: Math.PI / 6
	};
}

function pointAt(position: Vec3, range?: number): SceneLightEntity {
	return {
		kind: 'light',
		light: 'point',
		id: 'light-point',
		name: 'Point light',
		color: '#ffffff',
		intensity: Math.PI,
		castShadow: false,
		position,
		rotation: [0, 0, 0],
		...(range === undefined ? {} : { range })
	};
}

function directionalAt(position: Vec3): SceneLightEntity {
	return {
		kind: 'light',
		light: 'directional',
		id: 'light-sun',
		name: 'Sun',
		color: '#ffffff',
		intensity: Math.PI,
		castShadow: false,
		position,
		rotation: rotationForLightDirection([0, -1, 0])
	};
}

function targetBox(): SceneEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id: 'target-box',
		name: 'Target box',
		position: [3, 1, 0],
		rotation: [0, 0, 0],
		dimensions: { width: 1, height: 2, depth: 1 },
		materialId: 'plaster-warm' as never,
		castShadow: false,
		receiveShadow: true
	};
}

async function mounted(options: {
	readonly entities?: readonly SceneEntity[];
	readonly scenePick?: (ray: unknown) => SceneRenderedHit | null;
	readonly sceneBounds?: (id: string) => { readonly min: Vec3; readonly max: Vec3 } | null;
	readonly rect?: typeof RECT;
} = {}) {
	const rect = options.rect ?? RECT;
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'Light lifecycle',
		layout: fixtureLayout(),
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [
				{ id: 'material-target', name: 'Target', baseMaterialId: 'plaster-warm' as never }
			],
			entities: [...(options.entities ?? [])],
			navigationNodes: [],
			connections: []
		}
	});
	const admitted = await admitUnitProject(
		project,
		{ projectId: PROJECT_ID, revisionId: 'revision-boot' },
		SESSION_EPOCH
	);
	if (admitted.kind !== 'admitted') throw new Error(`light fixture not admitted: ${admitted.kind}`);
	const session = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
	session.replace(admitted.snapshot);
	const lightPreview = createStageLightPreview();
	const facade = createStageFacade({
		snapshot: admitted.snapshot,
		session,
		lightPreview,
		...(options.scenePick === undefined ? {} : { scenePick: options.scenePick as never }),
		...(options.sceneBounds === undefined ? {} : { sceneBounds: options.sceneBounds })
	});
	const evaluated = facade.camera.evaluate(rect, 1);
	if (evaluated.kind !== 'evaluated') throw new Error('light fixture did not evaluate');
	facade.acquireInspection('exclusive');
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: admitted.snapshot.sessionEpoch,
		baseline: {
			revision: admitted.snapshot.acceptedRevision,
			source: project,
			canonicalJson: admitted.snapshot.canonicalJson,
			sourceContentId: admitted.snapshot.sourceContentId
		}
	});
	for (const adapter of [createSceneAdapter, createLightAdapter]) {
		const registration = mountStageAdapter(facade, host, adapter);
		if (registration.kind !== 'registered') throw new Error('light fixture adapter did not mount');
	}
	facade.camera.evaluate(rect, 2);
	return { facade, host, lightPreview };
}

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 240; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('light fixture did not settle');
}

function lightsOf(facade: Awaited<ReturnType<typeof mounted>>['facade']): SceneLightEntity[] {
	return stageScene(facade.snapshot()).entities.filter(
		(entity): entity is SceneLightEntity => entity.kind === 'light'
	);
}

function openSpotTask(facade: Awaited<ReturnType<typeof mounted>>['facade']): void {
	armLight(PROJECT_ID, 'spot');
	const opened = facade.openContributedTask('light-place', 'light');
	if (opened.kind !== 'opened') throw new Error(`light task not opened: ${opened.message}`);
}

describe('S3a light adapter pointer lifecycle', () => {
	it('creates exactly one spot on release and writes nothing on cancel', async () => {
		const { facade, host } = await mounted();
		openSpotTask(facade);
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		const centre: [number, number] = [640, 380];

		expect(facade.pointerIntent({ phase: 'down', css: centre, evaluationId }).claimed).toBe(true);
		expect(facade.session.gesture()?.owner).toBe('light-place');
		facade.pointerIntent({ phase: 'move', css: [700, 380], evaluationId });
		expect(facade.session.gesture()?.owner).toBe('light-place');
		expect(facade.candidatePreviews().map((candidate) => candidate.id)).toContain('light-placement');
		facade.pointerIntent({ phase: 'cancel', css: [700, 380], evaluationId });
		expect(facade.session.gesture()).toBeNull();
		expect(lightsOf(facade)).toHaveLength(0);
		expect(host.history()).toEqual(before);

		expect(facade.pointerIntent({ phase: 'down', css: centre, evaluationId }).claimed).toBe(true);
		expect(facade.session.gesture()?.owner).toBe('light-place');
		facade.pointerIntent({ phase: 'up', css: centre, evaluationId });
		await waitFor(() => lightsOf(facade).length === 1);
		expect(facade.session.gesture()).toBeNull();

		expect(host.history().depth).toBe(before.depth + 1);
		expect(host.history().position).toBe(before.position + 1);
		const [light] = lightsOf(facade);
		expect(light).toBeDefined();
		expect(light!.castShadow).toBe(false);
		expect(light!.light).toBe('spot');
		expect(facade.session.task()).toBeNull();
		expect(armedLightKind(PROJECT_ID)).toBe('spot');
		// The next Stage frame rebuilds the factory binding; the route's dock-rearm
		// seam can then reopen the same task without a second Library trip.
		expect(facade.camera.evaluate(RECT, 3).kind).toBe('evaluated');
		const reopened = facade.openContributedTask('light-place', 'light');
		expect(reopened.kind).toBe('opened');
		expect(facade.session.task()?.kind).toBe('light-place');
		// A plain click aims straight down and writes no range; its body is at the
		// approved floor-like working height, not snapped to the floor grid.
		expect(light!.position[1]).toBeCloseTo(
			facade.snapshot().domain.datumMeters + 2.2,
			9
		);
		expect('range' in light!).toBe(false);
		const forward = lightForward(light!.rotation);
		expect(forward[0]).toBeCloseTo(0, 8);
		expect(forward[1]).toBeCloseTo(-1, 8);
		expect(forward[2]).toBeCloseTo(0, 8);
	});

	it('edits a freshly placed light through an admitted mark while placement stays rearmed', async () => {
		let picks = 0;
		const scenePick = (): SceneRenderedHit | null => {
			picks += 1;
			if (picks === 1) {
				return {
					entityId: 'wall',
					kind: 'entity',
					distanceMeters: 3,
					worldPoint: [1, 1, 0],
					normal: [0, 0, 1]
				};
			}
			if (picks === 2) {
				return {
					entityId: 'target',
					kind: 'entity',
					distanceMeters: 5,
					worldPoint: [4, 1, 0],
					normal: [0, 1, 0]
				};
			}
			return null;
		};
		const { facade, host } = await mounted({ scenePick });
		const accept = vi.spyOn(host, 'accept');
		const before = host.history();
		openSpotTask(facade);
		const evaluationId = facade.evaluationId()!;

		facade.pointerIntent({ phase: 'down', css: [560, 340], evaluationId });
		facade.pointerIntent({ phase: 'move', css: [760, 340], evaluationId });
		facade.pointerIntent({ phase: 'up', css: [760, 340], evaluationId });
		await waitFor(() => lightsOf(facade).length === 1);
		expect(facade.session.task()).toBeNull();
		expect(armedLightKind(PROJECT_ID)).toBe('spot');

		// The route reopens the task after the next live evaluation rebuilt the
		// factory binding; the newly placed light remains the selection.
		expect(facade.camera.evaluate(RECT, 3).kind).toBe('evaluated');
		expect(facade.openContributedTask('light-place', 'light').kind).toBe('opened');
		expect(facade.session.task()?.kind).toBe('light-place');
		expect(facade.selectionState().primary?.subject.id).toBe(lightsOf(facade)[0]!.id);

		const aim = facade.marks().find((mark) => mark.id === 'light-aim');
		if (aim === undefined) throw new Error('the rearmed light published no Aim mark');
		// The route obtains handleId from this same host hit-test before offering the
		// press to the armed task.
		const aimHit = facade.hitMark({ css: aim.anchor, coarse: false });
		expect(aimHit?.id).toBe(aim.id);
		expect(aimHit?.adapterId).toBe('light');
		const dragEvaluationId = facade.evaluationId()!;
		const dragCss: [number, number] = [aim.anchor[0] + 90, aim.anchor[1] - 30];
		const beforeDrag = facade.snapshot().canonicalJson;

		expect(
			facade.pointerIntent({
				phase: 'down',
				css: aim.anchor,
				evaluationId: dragEvaluationId,
				handleId: aim.id,
				handleAdapterId: aim.adapterId
			}).claimed
		).toBe(true);
		expect(facade.session.task()?.kind).toBe('light-place');
		expect(facade.session.gesture()?.owner).toBe('light-marks');
		facade.pointerIntent({ phase: 'move', css: dragCss, evaluationId: dragEvaluationId });
		expect(facade.session.task()?.kind).toBe('light-place');
		expect(facade.session.gesture()?.owner).toBe('light-marks');
		facade.pointerIntent({ phase: 'up', css: dragCss, evaluationId: dragEvaluationId });

		await waitFor(() => host.history().depth === before.depth + 2);
		const acceptedKinds = accept.mock.calls.map(([intent]) => intent.kind);
		expect(acceptedKinds.filter((kind) => kind === 'create-light')).toHaveLength(1);
		expect(acceptedKinds.filter((kind) => kind === 'update-light')).toHaveLength(1);
		expect(lightsOf(facade)).toHaveLength(1);
		expect(facade.snapshot().canonicalJson).not.toBe(beforeDrag);
		// The mark edit also installs and closes the task; Lights stays armed and
		// the next live evaluation lets the route reopen it again.
		expect(facade.session.task()).toBeNull();
		expect(armedLightKind(PROJECT_ID)).toBe('spot');
		expect(facade.camera.evaluate(RECT, 4).kind).toBe('evaluated');
		expect(facade.openContributedTask('light-place', 'light').kind).toBe('opened');
	});

	it('places with viewport-correct rays when the Stage is offset', async () => {
		const { facade } = await mounted({ rect: OFFSET_RECT });
		openSpotTask(facade);
		const evaluationId = facade.evaluationId()!;
		const local: [number, number] = [560, 340];
		const result = facade.pointerRay(
			[local[0] + OFFSET_RECT.left, local[1] + OFFSET_RECT.top],
			evaluationId
		);
		if (result.kind !== 'ray') throw new Error('the offset placement produced no pointer ray');
		const datum = facade.snapshot().domain.datumMeters;
		// Approved placement: a miss meets the datum plane, then rises 2.20 m.
		const t = (datum - result.ray.origin[1]) / result.ray.direction[1];
		const expected: Vec3 = [
			result.ray.origin[0] + result.ray.direction[0] * t,
			datum + 2.2,
			result.ray.origin[2] + result.ray.direction[2] * t
		];
		facade.pointerIntent({ phase: 'down', css: local, evaluationId });
		facade.pointerIntent({ phase: 'up', css: local, evaluationId });
		await waitFor(() => lightsOf(facade).length === 1);
		const light = lightsOf(facade)[0]!;
		expect(light.position[0]).toBeCloseTo(expected[0], 8);
		expect(light.position[1]).toBeCloseTo(expected[1], 8);
		expect(light.position[2]).toBeCloseTo(expected[2], 8);
	});

	it('selects an existing light and disarms armed placement on its glyph', async () => {
		const { facade, host } = await mounted({ entities: [spotAt([0, 2, 0])] });
		const reference = sceneEntityReference(
			'light-existing',
			facade.snapshot().domain.unitRevisions.scene
		);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		const body = facade.marks().find((mark) => mark.id.includes('light-body'));
		if (body === undefined) throw new Error('the existing light has no body glyph');
		facade.select(null);
		openSpotTask(facade);
		const evaluationId = facade.evaluationId()!;
		const before = host.history().depth;

		expect(
			facade.pointerIntent({ phase: 'down', css: body.anchor, evaluationId }).claimed
		).toBe(true);
		expect(facade.session.task()).toBeNull();
		expect(armedLightKind(PROJECT_ID)).toBeNull();
		expect(facade.selectionState().primary?.subject.id).toBe('light-existing');
		facade.pointerIntent({ phase: 'up', css: body.anchor, evaluationId });
		expect(host.history().depth).toBe(before);
		expect(lightsOf(facade)).toHaveLength(1);
	});

	it('moves a selected light once on release and writes nothing on cancel', async () => {
		const { facade, host } = await mounted({ entities: [spotAt([0, 2, 0])], rect: OFFSET_RECT });
		const reference = sceneEntityReference(
			'light-existing',
			facade.snapshot().domain.unitRevisions.scene
		);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		const allMarks = facade.marks();
		const mark = allMarks.find((candidate) => candidate.id.includes('light-body'));
		if (mark === undefined) {
			throw new Error(
				`the selected light did not publish a body mark: ${allMarks.map((candidate) => candidate.id).join(', ') || 'no marks'}`
			);
		}
		const start = mark.anchor;
		const dragCss: [number, number] = [start[0] + 80, start[1] + 10];
		const evaluationId = facade.evaluationId()!;
		const dragRay = facade.pointerRay(
			[dragCss[0] + OFFSET_RECT.left, dragCss[1] + OFFSET_RECT.top],
			evaluationId
		);
		if (dragRay.kind !== 'ray') throw new Error('the offset manipulation produced no pointer ray');
		const dragT = (2 - dragRay.ray.origin[1]) / dragRay.ray.direction[1];
		const expectedMove: Vec3 = [
			dragRay.ray.origin[0] + dragRay.ray.direction[0] * dragT,
			2,
			dragRay.ray.origin[2] + dragRay.ray.direction[2] * dragT
		];
		const before = host.history();
		const sourceBefore = facade.snapshot().canonicalJson;

		expect(
			facade.pointerIntent({
				phase: 'down',
				css: start,
				evaluationId,
				handleId: mark.id
			}).claimed
		).toBe(true);
		expect(facade.session.gesture()?.owner).toBe('light-marks');
		facade.pointerIntent({ phase: 'move', css: dragCss, evaluationId });
		expect(facade.session.gesture()?.owner).toBe('light-marks');
		facade.pointerIntent({ phase: 'up', css: dragCss, evaluationId });
		await waitFor(() => host.history().depth === before.depth + 1);
		expect(facade.session.gesture()).toBeNull();
		// The real Stage evaluates its next frame after an accepted install; that is
		// when factory bindings rebuild against the new snapshot.
		expect(facade.camera.evaluate(OFFSET_RECT, 3).kind).toBe('evaluated');
		expect(facade.snapshot().canonicalJson).not.toBe(sourceBefore);
		const moved = lightsOf(facade)[0]!;
		expect(moved.position).not.toEqual([0, 2, 0]);
		expect(moved.position[0]).toBeCloseTo(expectedMove[0], 8);
		expect(moved.position[1]).toBeCloseTo(expectedMove[1], 8);
		expect(moved.position[2]).toBeCloseTo(expectedMove[2], 8);

		const afterMove = facade.snapshot().canonicalJson;
		const currentMark = facade.marks().find((candidate) => candidate.id.includes('light-body'));
		if (currentMark === undefined) {
			throw new Error(
				`the moved light lost its body mark: ${facade.marks().map((candidate) => candidate.id).join(', ') || 'no marks'}`
			);
		}
		expect(
			facade.pointerIntent({
				phase: 'down',
				css: currentMark.anchor,
				evaluationId,
				handleId: currentMark.id
			}).claimed
		).toBe(true);
		facade.pointerIntent({
			phase: 'move',
			css: [currentMark.anchor[0] + 60, currentMark.anchor[1]],
			evaluationId
		});
		facade.pointerIntent({
			phase: 'cancel',
			css: [currentMark.anchor[0] + 60, currentMark.anchor[1]],
			evaluationId
		});
		expect(facade.snapshot().canonicalJson).toBe(afterMove);
		expect(host.history().depth).toBe(before.depth + 1);
	});

	it('keeps a surface-bound target fixed while a Spot body moves', async () => {
		// The floor under the light is the only surface the forward ray meets.
		const scenePick = (): SceneRenderedHit => ({
			entityId: 'floor',
			kind: 'entity',
			distanceMeters: 2,
			worldPoint: [0, 0, 0],
			normal: [0, 1, 0]
		});
		const { facade, host } = await mounted({ entities: [spotAt([0, 2, 0])], scenePick });
		const reference = sceneEntityReference(
			'light-existing',
			facade.snapshot().domain.unitRevisions.scene
		);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		const mark = facade.marks().find((candidate) => candidate.id === 'light-body');
		if (mark === undefined) throw new Error('the selected spot has no body glyph');
		const start = mark.anchor;
		const dragCss: [number, number] = [start[0] + 90, start[1] + 5];
		const evaluationId = facade.evaluationId()!;
		const dragRay = facade.pointerRay(
			[dragCss[0] + RECT.left, dragCss[1] + RECT.top],
			evaluationId
		);
		if (dragRay.kind !== 'ray') throw new Error('the body manipulation produced no pointer ray');
		const t = (2 - dragRay.ray.origin[1]) / dragRay.ray.direction[1];
		const expected: Vec3 = [
			dragRay.ray.origin[0] + dragRay.ray.direction[0] * t,
			2,
			dragRay.ray.origin[2] + dragRay.ray.direction[2] * t
		];
		const before = host.history().depth;

		facade.pointerIntent({ phase: 'down', css: start, evaluationId, handleId: 'light-body' });
		facade.pointerIntent({ phase: 'move', css: dragCss, evaluationId });
		facade.pointerIntent({ phase: 'up', css: dragCss, evaluationId });
		await waitFor(() => host.history().depth === before + 1);
		expect(facade.camera.evaluate(RECT, 3).kind).toBe('evaluated');
		const moved = lightsOf(facade)[0]!;
		expect(moved.position[0]).toBeCloseTo(expected[0], 6);
		expect(moved.position[2]).toBeCloseTo(expected[2], 6);
		const targetVector: Vec3 = [-moved.position[0], -moved.position[1], -moved.position[2]];
		const targetLength = Math.hypot(...targetVector);
		const toTarget = targetVector.map((component) => component / targetLength);
		const forward = lightForward(moved.rotation);
		expect(forward[0] * toTarget[0] + forward[1] * toTarget[1] + forward[2] * toTarget[2]).toBeCloseTo(1, 6);
	});

	it('stands off along the surface normal and leaves a pressed Spot Unlimited', async () => {
		let pick = 0;
		const scenePick = (): SceneRenderedHit | null => {
			pick += 1;
			if (pick === 1) {
				return {
					entityId: 'wall',
					kind: 'entity',
					distanceMeters: 3,
					worldPoint: [1, 1, 0],
					normal: [0, 0, 1]
				};
			}
			return {
				entityId: 'target',
				kind: 'entity',
				distanceMeters: 5,
				worldPoint: [4, 1, 0],
				normal: [0, 1, 0]
			};
		};
		const { facade } = await mounted({ scenePick });
		openSpotTask(facade);
		const evaluationId = facade.evaluationId()!;
		const start: [number, number] = [560, 340];

		facade.pointerIntent({ phase: 'down', css: start, evaluationId });
		expect(facade.candidatePreviews().map((candidate) => candidate.id)).toContain('light-placement');
		facade.pointerIntent({ phase: 'move', css: [760, 340], evaluationId });
		facade.pointerIntent({ phase: 'up', css: [760, 340], evaluationId });
		await waitFor(() => lightsOf(facade).length === 1);

		const light = lightsOf(facade)[0]!;
		expect(light.position[0]).toBeCloseTo(1, 8);
		expect(light.position[1]).toBeCloseTo(1, 8);
		expect(Math.abs(light.position[2])).toBeCloseTo(0.1, 8);
		// A press-drag aims the new Spot; it never invents a cutoff.
		expect('range' in light).toBe(false);
		const forward = lightForward(light.rotation);
		const toTarget = [4 - light.position[0], 1 - light.position[1], 0 - light.position[2]];
		const length = Math.hypot(...toTarget);
		expect(
			forward[0] * (toTarget[0] / length) +
				forward[1] * (toTarget[1] / length) +
				forward[2] * (toTarget[2] / length)
		).toBeGreaterThan(0.999);
	});

	it('changes Spot Reach through the forward-axis handle instead of clamping to 0.1 m', async () => {
		const { facade, host } = await mounted({
			entities: [{ ...spotAt([0, 2, 0]), range: 3 } as SceneLightEntity]
		});
		const reference = sceneEntityReference(
			'light-existing',
			facade.snapshot().domain.unitRevisions.scene
		);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		const mark = facade.marks().find((candidate) => candidate.id.includes('light-range'));
		if (mark === undefined) throw new Error('the selected spot has no Reach mark');
		const evaluationId = facade.evaluationId()!;
		const before = host.history().depth;
		facade.pointerIntent({ phase: 'down', css: mark.anchor, evaluationId, handleId: mark.id });
		facade.pointerIntent({
			phase: 'move',
			css: [mark.anchor[0] + 90, mark.anchor[1] + 25],
			evaluationId
		});
		facade.pointerIntent({
			phase: 'up',
			css: [mark.anchor[0] + 90, mark.anchor[1] + 25],
			evaluationId
		});
		await waitFor(() => host.history().depth === before + 1);
		const light = lightsOf(facade)[0]!;
		if (!('range' in light)) throw new Error('the Reach drag did not write a range');
		expect(light.range).toBeGreaterThan(0.2);
		expect(light.range).not.toBeCloseTo(3, 5);
	});

	it('publishes Point Reach only when a range is authored, and Spot soft-edge controls', async () => {
		const unlimited = await mounted({ entities: [pointAt([0, 2, 0])] });
		const unlimitedReference = sceneEntityReference(
			'light-point',
			unlimited.facade.snapshot().domain.unitRevisions.scene
		);
		unlimited.facade.setSelection({
			ordered: [{ reference: unlimitedReference }],
			primary: unlimitedReference
		});
		expect(unlimited.facade.marks().map((mark) => mark.id)).not.toContain('light-reach');

		const point = await mounted({ entities: [pointAt([0, 2, 0], 3)] });
		const pointReference = sceneEntityReference(
			'light-point',
			point.facade.snapshot().domain.unitRevisions.scene
		);
		point.facade.setSelection({ ordered: [{ reference: pointReference }], primary: pointReference });
		expect(point.facade.marks().map((mark) => mark.id)).toContain('light-reach');

		const spot = await mounted({
			entities: [{ ...spotAt([0, 2, 0]), range: 3, penumbra: 0.35 } as SceneLightEntity]
		});
		const spotReference = sceneEntityReference(
			'light-existing',
			spot.facade.snapshot().domain.unitRevisions.scene
		);
		spot.facade.setSelection({ ordered: [{ reference: spotReference }], primary: spotReference });
		expect(spot.facade.marks().map((mark) => mark.id)).toContain('light-penumbra');
	});

	it('applies the approved Spot Beam and soft-edge mark limits', async () => {
		const degrees = (value: number) => (value * Math.PI) / 180;
		const { facade } = await mounted({
			entities: [
				{ ...spotAt([0, 2, 0], 'light-beam-wide'), angle: degrees(81), penumbra: 0.35 } as SceneLightEntity,
				{ ...spotAt([2, 2, 0], 'light-hard'), angle: degrees(30), penumbra: 0.01 } as SceneLightEntity,
				// A 60° beam keeps the 2% inner ring above the host's minimum projected
				// ring size, so the test reaches the mark-visibility rule itself.
				{ ...spotAt([4, 2, 0], 'light-soft-low'), angle: degrees(60), penumbra: 0.02 } as SceneLightEntity
			]
		});
		const markIds = (id: string): string[] => {
			const reference = sceneEntityReference(id, facade.snapshot().domain.unitRevisions.scene);
			facade.setSelection({ ordered: [{ reference }], primary: reference });
			const selected = facade.selectionState().primary?.subject.id;
			if (selected !== id) throw new Error(`selection stayed on ${selected ?? 'none'} instead of ${id}`);
			return facade.marks().map((mark) => mark.id);
		};

		expect(markIds('light-beam-wide')).not.toContain('light-angle');
		const hard = markIds('light-hard');
		expect(hard).toContain('light-angle');
		// The inner ring is the renderer's full-brightness edge; a hard beam puts
		// it on the footprint ring, not at the cap radius's midpoint.
		expect(hard).toContain('light-penumbra');
		expect(markIds('light-soft-low')).toContain('light-penumbra');
		const wide = markIds('light-beam-wide');
		expect(wide).not.toContain('light-angle');
		expect(wide).not.toContain('light-penumbra');
		expect(facade.marks().find((mark) => mark.id === 'light-aim')?.tag).toContain(
			'wider than the guide'
		);
		// The footprint is still drawn, at the 80° guide limit and in derived ink.
		const wideGuide = facade.guides().find((guide) => guide.id === 'light-guide')!;
		expect(wideGuide.derivedSegments.length).toBeGreaterThan(40);

		// Rim and Inner-ring controls share one ring plane; their turn controls
		// sit on opposite screen sides so a zero soft edge cannot stack them.
		markIds('light-soft-low');
		const angle = facade.marks().find((mark) => mark.id === 'light-angle')!;
		const penumbra = facade.marks().find((mark) => mark.id === 'light-penumbra')!;
		const phase = (mark: typeof angle): number[] | undefined => mark.descriptor.phase as number[] | undefined;
		const a = phase(angle);
		const p = phase(penumbra);
		expect(a).toBeDefined();
		expect(p).toBeDefined();
		expect(a![0] * p![0] + a![1] * p![1] + a![2] * p![2]).toBeLessThan(0);
	});

	it('exposes persistent selection guides separately from candidate previews', async () => {
		const { facade } = await mounted({ entities: [spotAt([0, 2, 0])] });
		const reference = sceneEntityReference(
			'light-existing',
			facade.snapshot().domain.unitRevisions.scene
		);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		expect(facade.guides().map((guide) => guide.id)).toContain('light-guide');
		expect(facade.candidatePreviews().map((candidate) => candidate.id)).not.toContain('light-guide');
	});

	it('exposes directional azimuth and elevation controls', async () => {
		const { facade, host } = await mounted({ entities: [directionalAt([0, 2, 0])] });
		const reference = sceneEntityReference(
			'light-sun',
			facade.snapshot().domain.unitRevisions.scene
		);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		const ids = facade.marks().map((mark) => mark.id);
		expect(ids).toContain('light-azimuth');
		expect(ids).toContain('light-elevation');
		const mark = facade.marks().find((candidate) => candidate.id.includes('light-azimuth'));
		if (mark === undefined) throw new Error('the selected directional has no azimuth mark');
		const beforeRotation = [...lightsOf(facade)[0]!.rotation];
		const before = host.history().depth;
		const evaluationId = facade.evaluationId()!;
		facade.pointerIntent({
			phase: 'down',
			css: mark.anchor,
			evaluationId,
			handleId: mark.id
		});
		facade.pointerIntent({
			phase: 'move',
			css: [mark.anchor[0] + 80, mark.anchor[1] + 20],
			evaluationId
		});
		facade.pointerIntent({
			phase: 'up',
			css: [mark.anchor[0] + 80, mark.anchor[1] + 20],
			evaluationId
		});
		await waitFor(() => host.history().depth === before + 1);
		expect(lightsOf(facade)[0]!.rotation).not.toEqual(beforeRotation);
	});

	it('uses viewport-correct rays for light picking with a nonzero Stage offset', async () => {
		const rect = { left: 240, top: 110, width: 1280, height: 720, devicePixelRatio: 1 };
		const rays: { origin: Vec3; direction: Vec3 }[] = [];
		const { facade } = await mounted({
			entities: [spotAt([0, 2, 0])],
			rect,
			scenePick: (ray) => {
				rays.push(ray as { origin: Vec3; direction: Vec3 });
				return null;
			}
		});
		const reference = sceneEntityReference(
			'light-existing',
			facade.snapshot().domain.unitRevisions.scene
		);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		const body = facade.marks().find((mark) => mark.id.includes('light-body'));
		if (body === undefined) throw new Error('the selected light has no body mark');
		const evaluationId = facade.evaluationId()!;
		const expected = facade.pointerRay(
			[body.anchor[0] + rect.left, body.anchor[1] + rect.top],
			evaluationId
		);
		const target = facade.hostToolTarget({ evaluationId, css: body.anchor, tool: 'erase' });
		expect(target.kind).toBe('hit');
		expect(expected.kind).toBe('ray');
		if (expected.kind !== 'ray') return;
		expect(rays.length).toBeGreaterThan(0);
		// Other picks derive a Spot target from the light itself; the pointer's own
		// hit path must still use the viewport-correct ray.
		const pointerRays = rays.filter(
			(ray) =>
				ray.origin.every((value, index) => value === expected.ray.origin[index]) &&
				ray.direction.every((value, index) => value === expected.ray.direction[index])
		);
		expect(pointerRays.length).toBeGreaterThan(0);
	});

	it('deletes a selected light through the keyboard and eraser through the same Card action', async () => {
		const keyboard = await mounted({ entities: [spotAt([0, 2, 0])] });
		const reference = sceneEntityReference(
			'light-existing',
			keyboard.facade.snapshot().domain.unitRevisions.scene
		);
		keyboard.facade.setSelection({ ordered: [{ reference }], primary: reference });
		const before = keyboard.host.history().depth;
		expect(keyboard.facade.selectionKeyIntent({ kind: 'delete' })).toMatchObject({
			claimed: true,
			adapterId: 'light'
		});
		await waitFor(() => lightsOf(keyboard.facade).length === 0);
		expect(keyboard.host.history().depth).toBe(before + 1);

		const eraser = await mounted({ entities: [spotAt([0, 2, 0])] });
		const eraserReference = sceneEntityReference(
			'light-existing',
			eraser.facade.snapshot().domain.unitRevisions.scene
		);
		eraser.facade.setSelection({ ordered: [{ reference: eraserReference }], primary: eraserReference });
		const body = eraser.facade.marks().find((mark) => mark.id.includes('light-body'));
		if (body === undefined) throw new Error('the eraser target has no body mark');
		const target = eraser.facade.hostToolTarget({
			evaluationId: eraser.facade.evaluationId()!,
			css: body.anchor,
			tool: 'erase'
		});
		expect(target.kind).toBe('hit');
		if (target.kind !== 'hit') return;
		const answer = eraser.facade.eraseAnswer(target.adapterId, target.hit);
		expect(answer?.kind).toBe('action');
		if (answer?.kind !== 'action') return;
		await answer.action.run();
		await waitFor(() => lightsOf(eraser.facade).length === 0);
	});

	it('publishes a session-only preview during a drag and commits its last value once', async () => {
		const { facade, host, lightPreview } = await mounted({ entities: [spotAt([0, 2, 0])] });
		const reference = sceneEntityReference(
			'light-existing',
			facade.snapshot().domain.unitRevisions.scene
		);
		facade.setSelection({ ordered: [{ reference }], primary: reference });
		const body = facade.marks().find((mark) => mark.id === 'light-body');
		if (body === undefined) throw new Error('the light has no body mark');
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		const dragCss: [number, number] = [body.anchor[0] + 90, body.anchor[1] + 15];

		facade.pointerIntent({ phase: 'down', css: body.anchor, evaluationId, handleId: body.id });
		facade.pointerIntent({ phase: 'move', css: dragCss, evaluationId });
		const previewed = lightPreview.overrides.get('light-existing');
		expect(previewed).toBeDefined();
		expect(previewed!.position).not.toEqual([0, 2, 0]);
		// A preview is not authored work: no history entry, no canonical change.
		expect(host.history().depth).toBe(before.depth);
		expect(host.history().position).toBe(before.position);

		facade.pointerIntent({ phase: 'up', css: dragCss, evaluationId });
		await waitFor(() => host.history().depth === before.depth + 1);
		await waitFor(() => !lightPreview.overrides.has('light-existing'));
		const committed = lightsOf(facade)[0]!;
		expect(committed.position).toEqual(previewed!.position);

		// Esc/cancel restores the accepted light and writes nothing.
		const afterMove = host.history();
		expect(facade.camera.evaluate(RECT, 3).kind).toBe('evaluated');
		const current = facade.marks().find((mark) => mark.id === 'light-body');
		if (current === undefined) throw new Error('the moved light has no body mark');
		facade.pointerIntent({ phase: 'down', css: current.anchor, evaluationId, handleId: current.id });
		facade.pointerIntent({
			phase: 'move',
			css: [current.anchor[0] + 50, current.anchor[1]],
			evaluationId
		});
		expect(lightPreview.overrides.has('light-existing')).toBe(true);
		facade.pointerIntent({ phase: 'cancel', css: current.anchor, evaluationId });
		expect(lightPreview.overrides.has('light-existing')).toBe(false);
		expect(host.history().depth).toBe(afterMove.depth);
		expect(host.history().position).toBe(afterMove.position);
		expect(lightsOf(facade)[0]!.position).toEqual(committed.position);
	});

	it('reads Lit by from object bounds rather than an object centre', async () => {
		const { facade } = await mounted({
			entities: [pointAt([0, 2, 0], 2.5), targetBox()],
			sceneBounds: (id) =>
				id === 'target-box'
					? { min: [2, 0, -0.75], max: [4, 2, 0.75] }
					: null
		});
		const reference = sceneEntityReference(
			'target-box',
			facade.snapshot().domain.unitRevisions.scene
		);
		const facts = facade.cardFacts({
			sourceId: 'target-box',
			sourceKind: 'entity',
			reference,
			ref: null
		});
		expect(facade.sceneBounds('target-box')).toEqual({ min: [2, 0, -0.75], max: [4, 2, 0.75] });
		expect(facts.map((fact) => fact.label)).toContain('Lit by');
	});
});
