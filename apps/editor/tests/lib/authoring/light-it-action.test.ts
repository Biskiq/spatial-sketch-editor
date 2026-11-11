/**
 * T2.S7 — the Card's Light it action through the real Stage host.
 *
 * These cases prove the accepted behavior rather than the recipe alone: a
 * selected Artwork creates one ordinary spot through `create-light`, an object
 * creates one Wash, a multi-selection creates exactly one shared Wash, the
 * created light is selected, one Undo removes it and one Redo restores it, and a
 * selection containing a light is refused without a history entry. No case
 * creates a cluster.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import type { SceneArtworkEntity, SceneEntity, SceneLightEntity, Vec3 } from '@portfolio/project-model';
import { SCENE_UNIT_FORMAT_VERSION } from '@portfolio/project-model/units';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createAdapter as createLightAdapter } from '$lib/authoring/adapters/light.adapter';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { lightForward } from '$lib/authoring/look/light-aim';
import { boundsCorners } from '$lib/authoring/look/light-recipes';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { stageScene } from '$lib/authoring/stage/unit-stage-source';
import { admitUnitProject, createUnitProject } from './__fixtures__/unit-envelope-fixtures';

const PROJECT_ID = 'project-light-it';
const SESSION_EPOCH = 'session-light-it';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const ASSET_ID = '11111111-1111-4111-8111-111111111111';

function fixtureLayout() {
	const baseline = createEmptyWallFirstLayoutDocument();
	const result = planWallChain({
		baseline,
		points: [[0, 0], [8, 0], [8, 6], [0, 6]],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (result.kind !== 'success') throw new Error('light-it fixture was refused');
	return result.document;
}

function artworkEntity(overrides: Partial<SceneArtworkEntity> = {}): SceneArtworkEntity {
	return {
		kind: 'artwork',
		id: 'artwork-a',
		name: 'Still life',
		position: [3, 1.6, 0],
		rotation: [0, 0, 0],
		widthMeters: 1.2,
		source: { kind: 'image', assetId: ASSET_ID, pixelWidth: 1200, pixelHeight: 800 },
		...overrides
	};
}

function boxEntity(id: string, position: Vec3): SceneEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: `Box ${id}`,
		position,
		rotation: [0, 0, 0],
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true
	};
}

function lightEntity(id: string, position: Vec3): SceneLightEntity {
	return {
		kind: 'light',
		light: 'spot',
		id,
		name: 'Existing light',
		color: '#ffffff',
		intensity: Math.PI,
		angle: Math.PI / 6,
		castShadow: false,
		position,
		rotation: [0, 0, 0]
	};
}

async function mounted(options: {
	readonly entities: readonly SceneEntity[];
	readonly bounds?: Readonly<Record<string, { readonly min: Vec3; readonly max: Vec3 }>>;
}) {
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'Light it',
		layout: fixtureLayout(),
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [],
			materials: [],
			entities: [...options.entities],
			...(options.entities.some((entity) => entity.kind === 'artwork')
				? {
						artworkLibrary: [
							{ assetId: ASSET_ID, name: 'Still life', pixelWidth: 1200, pixelHeight: 800 }
						]
					}
				: {})
		}
	});
	const admitted = await admitUnitProject(
		project,
		{ projectId: PROJECT_ID, revisionId: 'revision-boot' },
		SESSION_EPOCH
	);
	if (admitted.kind !== 'admitted') {
		throw new Error(`light-it fixture not admitted: ${JSON.stringify(admitted.issues)}`);
	}
	const session = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
	session.replace(admitted.snapshot);
	const facade = createStageFacade({
		snapshot: admitted.snapshot,
		session,
		sceneBounds: (id) => options.bounds?.[id] ?? null
	});
	const evaluated = facade.camera.evaluate(RECT, 1);
	if (evaluated.kind !== 'evaluated') throw new Error('light-it fixture did not evaluate');
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
		if (registration.kind !== 'registered') throw new Error('light-it fixture adapter did not mount');
	}
	facade.camera.evaluate(RECT, 2);
	return { facade, host };
}

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 240; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('light-it fixture did not settle');
}

function lightsOf(facade: Awaited<ReturnType<typeof mounted>>['facade']): SceneLightEntity[] {
	return stageScene(facade.snapshot()).entities.filter(
		(entity): entity is SceneLightEntity => entity.kind === 'light'
	);
}

function subjectOf(facade: Awaited<ReturnType<typeof mounted>>['facade'], id: string) {
	const reference = sceneEntityReference(id, facade.snapshot().domain.unitRevisions.scene);
	return {
		sourceId: id,
		sourceKind: 'entity',
		reference,
		ref: null
	};
}

function select(facade: Awaited<ReturnType<typeof mounted>>['facade'], ids: readonly string[]): void {
	const ordered = ids.map((id) => ({
		reference: sceneEntityReference(id, facade.snapshot().domain.unitRevisions.scene)
	}));
	const primary = ordered[0]!.reference;
	const result = facade.setSelection({ ordered, primary });
	if (result.kind === 'refused') throw new Error(result.message);
}

function lightItAction(
	facade: Awaited<ReturnType<typeof mounted>>['facade'],
	subjectId: string
) {
	const action = facade
		.cardActions(subjectOf(facade, subjectId))
		.find((candidate) => candidate.id === 'light-it');
	if (action === undefined) throw new Error('the selected subject has no Light it action');
	return action;
}

function angleFromAim(origin: Vec3, direction: Vec3, point: Vec3): number {
	const offset: Vec3 = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
	const length = Math.hypot(...offset);
	const cosine = Math.max(
		-1,
		Math.min(
			1,
			(direction[0] * offset[0] + direction[1] * offset[1] + direction[2] * offset[2]) / length
		)
	);
	return Math.acos(cosine);
}

describe('S7 Light it Card action', () => {
	it('creates one selected Picture spot for Artwork and undoes/redoes it as one entry', async () => {
		const artwork = artworkEntity();
		const { facade, host } = await mounted({ entities: [artwork] });
		select(facade, [artwork.id]);
		const action = lightItAction(facade, artwork.id);
		expect(action.label).toBe('Light it');
		const before = host.history();

		expect(await action.run()).toMatchObject({ kind: 'accepted' });
		await waitFor(() => lightsOf(facade).length === 1);
		expect(host.history().depth).toBe(before.depth + 1);
		expect(host.history().position).toBe(before.position + 1);
		const light = lightsOf(facade)[0]!;
		expect(light.light).toBe('spot');
		if (light.light !== 'spot') throw new Error('Light it did not create a spot');
		expect(light.name).toBe('Picture spot');
		expect(light.castShadow).toBe(false);
		expect(facade.selectionState().primary?.subject.id).toBe(light.id);
		// In front of the artwork (+Z) and above its centre.
		expect(light.position[2]).toBeGreaterThan(artwork.position[2]);
		expect(light.position[1]).toBeGreaterThan(artwork.position[1]);
		// The created values are ordinary editable S3 fields.
		expect(light.angle).toBeGreaterThan(0);
		expect('range' in light && light.range).toBeGreaterThan(0);
		expect(stageScene(facade.snapshot()).clusters).toBeUndefined();

		await host.undo();
		await waitFor(() => lightsOf(facade).length === 0);
		expect(stageScene(facade.snapshot()).entities.map((entity) => entity.id)).not.toContain(light.id);
		await host.redo();
		await waitFor(() => lightsOf(facade).length === 1);
		expect(lightsOf(facade)[0]!.id).toBe(light.id);
		expect(host.history().depth).toBe(before.depth + 1);
	});

	it('creates one Wash for an ordinary object', async () => {
		const box = boxEntity('box-a', [2, 0.5, 1]);
		const bounds = { min: [1.5, 0, 0.5] as Vec3, max: [2.5, 1, 1.5] as Vec3 };
		const { facade, host } = await mounted({ entities: [box], bounds: { 'box-a': bounds } });
		select(facade, [box.id]);
		const before = host.history().depth;
		expect(await lightItAction(facade, box.id).run()).toMatchObject({ kind: 'accepted' });
		await waitFor(() => lightsOf(facade).length === 1);
		const light = lightsOf(facade)[0]!;
		expect(light.name).toBe('Wash');
		expect(host.history().depth).toBe(before + 1);
		if (light.light !== 'spot') throw new Error('Light it did not create a spot');
		const forward = lightForward(light.rotation);
		for (const corner of boundsCorners(bounds)) {
			expect(angleFromAim(light.position, forward, corner)).toBeLessThanOrEqual(light.angle);
		}
	});

	it('creates one shared Wash for a multi-selection instead of one light per object', async () => {
		const left = boxEntity('box-left', [-2, 0.5, 0]);
		const right = boxEntity('box-right', [2, 0.5, 0]);
		const bounds = {
			'box-left': { min: [-2.5, 0, -0.5] as Vec3, max: [-1.5, 1, 0.5] as Vec3 },
			'box-right': { min: [1.5, 0, -0.5] as Vec3, max: [2.5, 1, 0.5] as Vec3 }
		};
		const { facade, host } = await mounted({ entities: [left, right], bounds });
		select(facade, ['box-left', 'box-right']);
		const before = host.history().depth;
		const action = lightItAction(facade, 'box-left');
		expect(action.detail).toContain('one Wash');
		expect(await action.run()).toMatchObject({ kind: 'accepted' });
		await waitFor(() => lightsOf(facade).length === 1);
		expect(lightsOf(facade)).toHaveLength(1);
		expect(lightsOf(facade)[0]!.name).toBe('Wash');
		expect(host.history().depth).toBe(before + 1);
		const wash = lightsOf(facade)[0]!;
		if (wash.light !== 'spot') throw new Error('Light it did not create a spot');
		const forward = lightForward(wash.rotation);
		for (const boundsEntry of Object.values(bounds)) {
			for (const corner of boundsCorners(boundsEntry)) {
				expect(angleFromAim(wash.position, forward, corner)).toBeLessThanOrEqual(wash.angle);
			}
		}
	});

	it('refuses an object without evaluated bounds without a history entry', async () => {
		const box = boxEntity('box-a', [2, 0.5, 1]);
		const { facade, host } = await mounted({ entities: [box] });
		select(facade, [box.id]);
		const before = host.history();
		const outcome = await lightItAction(facade, box.id).run();
		expect(outcome).toMatchObject({ kind: 'refused' });
		if (outcome.kind === 'refused') expect(outcome.message).toContain('no evaluated bounds');
		expect(host.history()).toEqual(before);
		expect(lightsOf(facade)).toHaveLength(0);
	});

	it('refuses a selection containing a light without a history entry', async () => {
		const box = boxEntity('box-a', [2, 0.5, 1]);
		const light = lightEntity('light-a', [0, 2, 0]);
		const bounds = { 'box-a': { min: [1.5, 0, 0.5] as Vec3, max: [2.5, 1, 1.5] as Vec3 } };
		const { facade, host } = await mounted({ entities: [box, light], bounds });
		select(facade, ['box-a', 'light-a']);
		const before = host.history();
		const outcome = await lightItAction(facade, 'box-a').run();
		expect(outcome).toMatchObject({ kind: 'refused' });
		if (outcome.kind === 'refused') expect(outcome.message).toContain('light cannot be lit');
		expect(host.history()).toEqual(before);
		expect(lightsOf(facade)).toHaveLength(1);
	});
});
