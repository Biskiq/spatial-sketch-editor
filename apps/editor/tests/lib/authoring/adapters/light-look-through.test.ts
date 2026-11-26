/**
 * T2.S3b — Spot Look through lifecycle.
 *
 * These cases use the real Stage facade and acceptance host, so the entry
 * standpoint comes from the one Camera authority and Done goes through the
 * registered `update-light` planner. They prove:
 *
 * - entry from Paper becomes Living and Exit restores the exact prior reading;
 * - aiming writes nothing until Done, which submits exactly one update-light;
 * - Undo restores the authored rotation;
 * - the projected cone is the authored Spot angle, not the Camera FOV;
 * - a deletion, an external aim change, a replacement/cancel and an in-flight
 *   completion cannot write through a stale session.
 */
import { describe, expect, it, vi } from 'vitest';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core/wall';
import type { SceneEntity, SceneLightEntity, Vec3 } from '@portfolio/project-model/scene';
import { rotationForLightDirection } from '$lib/authoring/look/light-aim';
import { LIGHT_GUIDE_MAX_ANGLE } from '$lib/authoring/look/light-presentation';
import { acceptFormCommand } from '$lib/authoring/adapters/scene/form-card-command';
import { lightCardActions, lightLookThroughAction } from '$lib/authoring/adapters/light/light-actions';
import { lightById } from '$lib/authoring/adapters/light/light-subjects';
import { createLightLookThrough, lookThroughCone } from '$lib/authoring/stage/route/light-look-through.svelte';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createAdapter as createLightAdapter } from '$lib/authoring/adapters/light.adapter';
import {
	createStageAdapterServices,
	mountStageAdapter,
	type StageAcceptOutcome,
	type StageAdapterServices
} from '$lib/authoring/stage/stage-adapter-host';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageLightPreview } from '$lib/authoring/stage/stage-light-preview.svelte';
import { admitUnitProject, createUnitProject } from '../__fixtures__/unit-envelope-fixtures';

const PROJECT_ID = 'project-light-look-through';
const SESSION_EPOCH = 'session-light-look-through';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

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
		angle: Math.PI / 6,
		penumbra: 0.25
	};
}

function pointAt(position: Vec3): SceneLightEntity {
	return {
		kind: 'light',
		light: 'point',
		id: 'light-point',
		name: 'Point light',
		color: '#ffffff',
		intensity: Math.PI,
		castShadow: false,
		position,
		rotation: [0, 0, 0]
	};
}

type Mounted = {
	readonly facade: Awaited<ReturnType<typeof openStage>>['facade'];
	readonly host: Awaited<ReturnType<typeof openStage>>['host'];
	readonly services: StageAdapterServices;
};

async function openStage(entities: readonly SceneEntity[]): Promise<{
	facade: ReturnType<typeof createStageFacade>;
	host: ReturnType<typeof createStageAcceptanceHost>;
}> {
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'Light look through',
		layout: createEmptyWallFirstLayoutDocument(),
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [...entities],
			navigationNodes: [],
			connections: []
		}
	});
	const admitted = await admitUnitProject(
		project,
		{ projectId: PROJECT_ID, revisionId: 'revision-boot' },
		SESSION_EPOCH
	);
	if (admitted.kind !== 'admitted') throw new Error(`look-through fixture not admitted: ${admitted.kind}`);
	const session = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
	session.replace(admitted.snapshot);
	const facade = createStageFacade({
		snapshot: admitted.snapshot,
		session,
		lightPreview: createStageLightPreview()
	});
	const evaluated = facade.camera.evaluate(RECT, 1);
	if (evaluated.kind !== 'evaluated') throw new Error('look-through fixture did not evaluate');
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
		if (registration.kind !== 'registered') throw new Error('look-through fixture adapter did not mount');
	}
	facade.camera.evaluate(RECT, 2);
	return { facade, host };
}

async function mounted(entities: readonly SceneEntity[]): Promise<Mounted> {
	const { facade, host } = await openStage(entities);
	return { facade, host, services: createStageAdapterServices(facade, host) };
}

function controllerFor(facade: Mounted['facade'], services: StageAdapterServices, notices: string[]) {
	return createLightLookThrough({
		stage: () => facade,
		services: () => services,
		lens: () => 'world',
		notice: (message) => {
			if (message.length > 0) notices.push(message);
		},
		refresh: () => {},
		absoluteCss: () => [0, 0],
		capturePointer: () => true,
		stageElement: () => undefined
	});
}

function settlePaper(facade: Mounted['facade']): void {
	facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, Number.POSITIVE_INFINITY);
	facade.camera.evaluate(RECT, Number.POSITIVE_INFINITY);
}

function requiredLight(facade: Mounted['facade'], id: string): SceneLightEntity {
	const light = lightById(facade.snapshot(), id);
	if (light === null) throw new Error(`fixture lost ${id}`);
	return light;
}

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 240; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('look-through fixture did not settle');
}

describe('S3b Spot Look through', () => {
	it('enters from Paper as Living and Exit restores the exact prior viewpoint without writing', async () => {
		const { facade, host, services } = await mounted([spotAt([0, 2, 0])]);
		const light = requiredLight(facade, 'light-existing');
		const notices: string[] = [];
		const controller = controllerFor(facade, services, notices);
		settlePaper(facade);
		const entry = facade.camera.state();
		expect(entry.reading).toBe('plan');
		const before = host.history();
		const sourceBefore = facade.snapshot().canonicalJson;

		expect(controller.enter(light.id)).toEqual({ kind: 'entered' });
		expect(facade.camera.state().reading).toBe('3d');
		expect(controller.active()).toBe(true);
		const through = facade.camera.lookThrough();
		expect(through).not.toBeNull();
		expect(through!.view.eye).toEqual(light.position);

		expect(controller.exit()).toBe(true);
		expect(controller.active()).toBe(false);
		expect(facade.camera.lookThrough()).toBeNull();
		expect(facade.camera.state()).toEqual(entry);
		expect(facade.snapshot().canonicalJson).toBe(sourceBefore);
		expect(host.history()).toEqual(before);
		expect(notices).toEqual([]);
	});

	it('writes exactly one update-light on Done, selects the light, and Undo restores the rotation', async () => {
		const { facade, host, services } = await mounted([spotAt([0, 2, 0])]);
		const light = requiredLight(facade, 'light-existing');
		const notices: string[] = [];
		const controller = controllerFor(facade, services, notices);
		settlePaper(facade);
		const entryRotation = [...light.rotation] as Vec3;
		const before = host.history();
		const sourceBefore = facade.snapshot().canonicalJson;
		const accept = vi.spyOn(host, 'accept');

		expect(controller.enter(light.id)).toEqual({ kind: 'entered' });
		const aimed = controller.turn(0.22, 0.08);
		expect(aimed).toBe(true);
		expect(controller.moved()).toBe(true);
		// Aiming is a Camera posture: it writes neither the Scene nor history.
		expect(facade.snapshot().canonicalJson).toBe(sourceBefore);
		expect(host.history()).toEqual(before);

		const outcome = await controller.finish();
		expect(outcome).toEqual({ kind: 'written' });
		expect(controller.active()).toBe(false);
		expect(facade.camera.lookThrough()).toBeNull();
		expect(accept).toHaveBeenCalledTimes(1);
		expect(accept.mock.calls[0]![0]).toMatchObject({
			kind: 'update-light',
			targets: [{ domain: 'scene', subject: { kind: 'entity', id: light.id } }],
			payload: { entityId: light.id }
		});
		expect(host.history().depth).toBe(before.depth + 1);
		expect(host.history().position).toBe(before.position + 1);
		expect(facade.snapshot().canonicalJson).not.toBe(sourceBefore);
		const written = requiredLight(facade, light.id);
		expect(written.rotation).not.toEqual(entryRotation);
		expect(facade.selectionState().primary?.subject.id).toBe(light.id);
		expect(notices).toEqual([]);

		const undone = await host.undo();
		expect(undone.kind).toBe('installed');
		expect(host.history().position).toBe(before.position);
		expect(requiredLight(facade, light.id).rotation).toEqual(entryRotation);
		expect(requiredLight(facade, light.id).position).toEqual(light.position);
	});

	it('projects the authored Spot cone independently of the Camera lens', async () => {
		const { facade, host, services } = await mounted([spotAt([0, 2, 0])]);
		const light = requiredLight(facade, 'light-existing');
		const notices: string[] = [];
		const controller = controllerFor(facade, services, notices);
		const authored = lookThroughCone(light);
		expect(authored.halfAngleDegrees).toBeCloseTo(30, 8);
		expect(authored.capRing).toHaveLength(64);
		const centre: Vec3 = [
			light.position[0],
			light.position[1] - 3,
			light.position[2]
		];
		const capRadius = Math.hypot(
			authored.capRing[0]![0] - centre[0],
			authored.capRing[0]![1] - centre[1],
			authored.capRing[0]![2] - centre[2]
		);
		expect(capRadius).toBeCloseTo(3 * Math.tan(Math.PI / 6), 6);

		expect(controller.enter(light.id)).toEqual({ kind: 'entered' });
		expect(controller.stepLens(90)).toBe(true);
		expect(facade.camera.provisionalView()?.fovYDegrees).toBeCloseTo(90, 3);
		const cropped = lookThroughCone(requiredLight(facade, light.id));
		// The lens changed; the authored cone did not.
		expect(cropped.capRing).toEqual(authored.capRing);
		expect(cropped.halfAngleDegrees).toBeCloseTo(authored.halfAngleDegrees, 8);
		expect(controller.exit()).toBe(true);
		expect(host.history().depth).toBe(1);
	});

	it('clamps the projected cap to the S3a wide-beam guide limit', () => {
		const wide = { ...spotAt([0, 2, 0]), angle: (89 * Math.PI) / 180 };
		const cone = lookThroughCone(wide);
		const centre: Vec3 = [0, wide.position[1] - 3, 0];
		const capRadius = Math.hypot(
			cone.capRing[0]![0] - centre[0],
			cone.capRing[0]![1] - centre[1],
			cone.capRing[0]![2] - centre[2]
		);
		// The stored angle is still reported, but the projected cap is drawn at
		// the same 80° limit S3a uses for a wide Spot's guide.
		expect(cone.halfAngleDegrees).toBeCloseTo(89, 8);
		expect(capRadius).toBeCloseTo(
			3 * Math.tan((LIGHT_GUIDE_MAX_ANGLE * Math.PI) / 180),
			6
		);
		expect(capRadius).toBeLessThan(3 * Math.tan((85 * Math.PI) / 180));
	});

	it('ends immediately on an accepted deletion, without a pointer action', async () => {
		const { facade, host, services } = await mounted([spotAt([0, 2, 0])]);
		const light = requiredLight(facade, 'light-existing');
		const notices: string[] = [];
		const controller = controllerFor(facade, services, notices);
		expect(controller.enter(light.id)).toEqual({ kind: 'entered' });

		const deleted = await acceptFormCommand(services, facade.snapshot(), light.id, 'delete-one', {
			entityId: light.id
		});
		expect(deleted.kind).toBe('installed');
		expect(lightById(facade.snapshot(), light.id)).toBeNull();
		const depth = host.history().depth;

		controller.reconcile();
		expect(controller.active()).toBe(false);
		expect(facade.camera.lookThrough()).toBeNull();
		expect(host.history().depth).toBe(depth);
		expect(notices.at(-1)).toContain('no longer in this project');
	});

	it('ends immediately on an accepted external aim change, without a pointer action', async () => {
		const { facade, host, services } = await mounted([spotAt([0, 2, 0])]);
		const light = requiredLight(facade, 'light-existing');
		const notices: string[] = [];
		const controller = controllerFor(facade, services, notices);
		expect(controller.enter(light.id)).toEqual({ kind: 'entered' });

		const changed = await acceptFormCommand(services, facade.snapshot(), light.id, 'update-light', {
			entityId: light.id,
			rotation: rotationForLightDirection([1, -0.2, 0])
		});
		expect(changed.kind).toBe('installed');
		expect(requiredLight(facade, light.id).rotation).toEqual(
			rotationForLightDirection([1, -0.2, 0])
		);
		const depth = host.history().depth;

		controller.reconcile();
		expect(controller.active()).toBe(false);
		expect(host.history().depth).toBe(depth);
		expect(notices.at(-1)).toContain('changed while you were looking through');
	});

	it('drops an in-flight Done when Exit/Cancel wins, restoring the entry reading', async () => {
		const { facade, host, services } = await mounted([spotAt([0, 2, 0])]);
		const light = requiredLight(facade, 'light-existing');
		const notices: string[] = [];
		const controller = controllerFor(facade, services, notices);
		settlePaper(facade);
		const entry = facade.camera.state();
		const before = host.history();
		const deferred: { resolve: ((outcome: StageAcceptOutcome) => void) | null } = { resolve: null };
		vi.spyOn(host, 'accept').mockImplementationOnce(
			() => new Promise<StageAcceptOutcome>((resolve) => {
				deferred.resolve = resolve;
			})
		);

		expect(controller.enter(light.id)).toEqual({ kind: 'entered' });
		expect(controller.turn(0.2, 0)).toBe(true);
		const done = controller.finish();
		await waitFor(() => deferred.resolve !== null);
		expect(controller.busy()).toBe(true);
		expect(controller.exit()).toBe(false);

		controller.cancel();
		expect(controller.active()).toBe(false);
		expect(controller.busy()).toBe(false);
		expect(facade.camera.state()).toEqual(entry);
		expect(facade.camera.lookThrough()).toBeNull();

		const settle = deferred.resolve;
		if (settle === null) throw new Error('the Done write was not deferred');
		settle({ kind: 'no-op', revision: facade.snapshot().acceptedRevision });
		await expect(done).resolves.toEqual({ kind: 'ended' });
		expect(controller.active()).toBe(false);
		expect(facade.camera.state()).toEqual(entry);
		expect(host.history()).toEqual(before);
	});

	it('keeps an in-flight Done alive through Escape and deactivation, then installs it', async () => {
		const { facade, host, services } = await mounted([spotAt([0, 2, 0])]);
		const light = requiredLight(facade, 'light-existing');
		const notices: string[] = [];
		const controller = controllerFor(facade, services, notices);
		settlePaper(facade);
		const entryRotation = [...light.rotation] as Vec3;
		const before = host.history();
		const deferred: { start: (() => void) | null } = { start: null };
		const realAccept = host.accept.bind(host);
		vi.spyOn(host, 'accept').mockImplementationOnce(
			(intent) =>
				new Promise<StageAcceptOutcome>((resolve, reject) => {
					deferred.start = () => {
						void realAccept(intent).then(resolve, reject);
					};
				})
		);

		expect(controller.enter(light.id)).toEqual({ kind: 'entered' });
		expect(controller.turn(0.2, 0)).toBe(true);
		const done = controller.finish();
		await waitFor(() => deferred.start !== null);
		expect(controller.busy()).toBe(true);

		const escape = { key: 'Escape', preventDefault: vi.fn() } as unknown as KeyboardEvent;
		expect(controller.posture.key(escape)).toBe('claimed');
		expect(escape.preventDefault).toHaveBeenCalledOnce();
		expect(controller.active()).toBe(true);
		expect(facade.camera.lookThrough()).not.toBeNull();

		controller.posture.deactivate();
		expect(controller.active()).toBe(true);
		expect(controller.busy()).toBe(true);
		// The route's accepted-source reconciliation must not treat Done's own
		// pending write as an external change.
		controller.reconcile();
		expect(controller.active()).toBe(true);

		const start = deferred.start;
		if (start === null) throw new Error('the Done write was not deferred');
		start();
		await expect(done).resolves.toEqual({ kind: 'written' });
		expect(controller.active()).toBe(false);
		expect(facade.camera.lookThrough()).toBeNull();
		expect(requiredLight(facade, light.id).rotation).not.toEqual(entryRotation);
		expect(host.history().position).toBe(before.position + 1);
		expect(notices).toEqual([]);
	});

	it('cancels on replacement and disposes idempotently without touching a newer Camera', async () => {
		const { facade, host, services } = await mounted([spotAt([0, 2, 0])]);
		const light = requiredLight(facade, 'light-existing');
		const notices: string[] = [];
		const controller = controllerFor(facade, services, notices);
		settlePaper(facade);
		const entry = facade.camera.state();

		expect(controller.enter(light.id)).toEqual({ kind: 'entered' });
		controller.cancel();
		expect(controller.active()).toBe(false);
		expect(facade.camera.state()).toEqual(entry);
		expect(host.history().depth).toBe(1);

		expect(controller.enter(light.id)).toEqual({ kind: 'entered' });
		controller.dispose();
		expect(controller.active()).toBe(false);
		expect(facade.camera.lookThrough()).toBeNull();
		controller.dispose();
		expect(controller.enter(light.id)).toEqual({
			kind: 'refused',
			message: 'This Stage is no longer mounted.'
		});
	});

	it('offers the Look through Card action for a Spot only, through the inspection port', async () => {
		const { facade, services } = await mounted([
			spotAt([0, 2, 0]),
			pointAt([2, 2, 0])
		]);
		const spot = requiredLight(facade, 'light-existing');
		const point = requiredLight(facade, 'light-point');
		const reference = (id: string) =>
			sceneEntityReference(id, facade.snapshot().domain.unitRevisions.scene);
		const subject = (id: string) => ({
			sourceId: id,
			sourceKind: 'light',
			reference: reference(id),
			ref: null
		});

		// No port: no inspection action, and no Point action either.
		expect(lightLookThroughAction(services, spot)).toBeNull();
		expect(lightCardActions(services, subject(spot.id)).map((action) => action.id)).not.toContain(
			'light-look-through'
		);

		const enter = vi.fn(() => ({ kind: 'entered' as const }));
		const withPort: StageAdapterServices = { ...services, lightInspection: { enter } };
		const spotActions = lightCardActions(withPort, subject(spot.id));
		const lookThrough = spotActions.find((action) => action.id === 'light-look-through');
		expect(lookThrough?.label).toBe('Look through');
		expect(spotActions[0]?.id).toBe('light-look-through');
		expect(lightCardActions(withPort, subject(point.id)).map((action) => action.id)).not.toContain(
			'light-look-through'
		);
		expect(lightLookThroughAction(withPort, point)).toBeNull();

		await expect(lookThrough!.run()).resolves.toEqual({ kind: 'accepted' });
		expect(enter).toHaveBeenCalledWith(spot.id);
	});

	it('refuses entry outside the World lens and while another Look through is open', async () => {
		const { facade, host, services } = await mounted([spotAt([0, 2, 0])]);
		const light = requiredLight(facade, 'light-existing');
		const notices: string[] = [];
		const controller = controllerFor(facade, services, notices);
		expect(controller.enter(light.id)).toEqual({ kind: 'entered' });
		expect(controller.enter(light.id)).toEqual({
			kind: 'refused',
			message: 'Already looking through a light; finish or exit it first.'
		});
		expect(controller.exit()).toBe(true);
		expect(host.history().depth).toBe(1);

		const experience = createLightLookThrough({
			stage: () => facade,
			services: () => services,
			lens: () => 'experience',
			notice: () => {},
			refresh: () => {},
			absoluteCss: () => [0, 0],
			capturePointer: () => true,
			stageElement: () => undefined
		});
		expect(experience.enter(light.id)).toEqual({
			kind: 'refused',
			message: 'Look through is available in the World lens.'
		});
	});
});
