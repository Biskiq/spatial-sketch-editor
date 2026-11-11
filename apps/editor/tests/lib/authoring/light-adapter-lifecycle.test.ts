/**
 * T2.S3a — the light adapter's real pointer lifecycle.
 *
 * These cases mount the Scene and Light adapters on the public Stage host. They
 * prove one accepted `create-light` per press/release, no write on cancel, one
 * accepted `update-light` per handle gesture, the surface-normal standoff, the
 * working-height fallback, and the spot's target-based cutoff.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import type { SceneLightEntity, Vec3 } from '@portfolio/project-model';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import { armLight } from '$lib/authoring/look/light-tool.svelte';
import { lightForward, rotationForLightDirection } from '$lib/authoring/look/light-aim';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createAdapter as createLightAdapter } from '$lib/authoring/adapters/light.adapter';
import type { SceneRenderedHit } from '$lib/authoring/scene/scene-pick-source';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { stageScene } from '$lib/authoring/stage/unit-stage-source';
import { admitUnitProject, createUnitProject } from './__fixtures__/unit-envelope-fixtures';

const PROJECT_ID = 'project-light-lifecycle';
const SESSION_EPOCH = 'session-light-lifecycle';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

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

async function mounted(options: {
	readonly entities?: readonly SceneLightEntity[];
	readonly scenePick?: (ray: unknown) => SceneRenderedHit | null;
} = {}) {
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'Light lifecycle',
		layout: fixtureLayout(),
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
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
	const facade = createStageFacade({
		snapshot: admitted.snapshot,
		session,
		...(options.scenePick === undefined ? {} : { scenePick: options.scenePick as never })
	});
	const evaluated = facade.camera.evaluate(RECT, 1);
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
	facade.camera.evaluate(RECT, 2);
	return { facade, host };
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
		// A plain click aims straight down and writes no range; its body is at the
		// working plane, not snapped to the floor grid.
		expect(light!.position[1]).toBeCloseTo(
			facade.snapshot().domain.datumMeters + 1.5,
			9
		);
		expect('range' in light!).toBe(false);
		const forward = lightForward(light!.rotation);
		expect(forward[0]).toBeCloseTo(0, 8);
		expect(forward[1]).toBeCloseTo(-1, 8);
		expect(forward[2]).toBeCloseTo(0, 8);
	});

	it('moves a selected light once on release and writes nothing on cancel', async () => {
		const { facade, host } = await mounted({ entities: [spotAt([0, 2, 0])] });
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
		const evaluationId = facade.evaluationId()!;
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
		facade.pointerIntent({
			phase: 'move',
			css: [start[0] + 80, start[1] + 10],
			evaluationId
		});
		expect(facade.session.gesture()?.owner).toBe('light-marks');
		facade.pointerIntent({
			phase: 'up',
			css: [start[0] + 80, start[1] + 10],
			evaluationId
		});
		await waitFor(() => host.history().depth === before.depth + 1);
		expect(facade.session.gesture()).toBeNull();
		// The real Stage evaluates its next frame after an accepted install; that is
		// when factory bindings rebuild against the new snapshot.
		expect(facade.camera.evaluate(RECT, 3).kind).toBe('evaluated');
		expect(facade.snapshot().canonicalJson).not.toBe(sourceBefore);
		const moved = lightsOf(facade)[0]!;
		expect(moved.position).not.toEqual([0, 2, 0]);

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

	it('stands off along the surface normal and extends a dragged spot cutoff past the target', async () => {
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
		expect(Math.abs(light.position[2])).toBeCloseTo(0.02, 8);
		if (!('range' in light)) throw new Error('the dragged spot did not write a range');
		expect(light.range).toBeGreaterThan(3.4);
		const forward = lightForward(light.rotation);
		const toTarget = [4 - light.position[0], 1 - light.position[1], 0 - light.position[2]];
		const length = Math.hypot(...toTarget);
		expect(
			forward[0] * (toTarget[0] / length) +
				forward[1] * (toTarget[1] / length) +
				forward[2] * (toTarget[2] / length)
		).toBeGreaterThan(0.999);
	});
});
