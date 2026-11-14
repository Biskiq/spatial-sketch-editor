/**
 * X8 — Light authoring lifetimes, characterized through the production adapter.
 *
 * `light-adapter-lifecycle` proves the headline create/move/delete flows. This
 * suite records the lifetimes the X8 decomposition moves: one accepted
 * `update-light` per mark gesture family with its exact payload keys, a
 * session-only preview that never reaches the canonical source, and one released
 * lease after every termination (cancel, Escape, task close, reading change,
 * source replacement, selection change and disposal). It drives the mounted
 * Scene + Light adapters on the public Stage host and asserts accepted bytes,
 * history depth, the lease and the preview, never an extracted module's name,
 * so it passes unchanged before and after the split.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import type { SceneEntity, SceneLightEntity, Vec3 } from '@portfolio/project-model';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import { armedLightKind, armLight, clearArmedLight } from '$lib/authoring/look/light-tool.svelte';
import { rotationForLightDirection } from '$lib/authoring/look/light-aim';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createAdapter as createLightAdapter } from '$lib/authoring/adapters/light.adapter';
import type { SceneRenderedHit } from '$lib/authoring/scene/scene-pick-source';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import {
	createStageAcceptanceHost,
	type StageAcceptOutcome
} from '$lib/authoring/stage/host-acceptance';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageLightPreview } from '$lib/authoring/stage/stage-light-preview.svelte';
import { stageScene } from '$lib/authoring/stage/unit-stage-source';
import { admitUnitProject, createUnitProject } from './__fixtures__/unit-envelope-fixtures';

const PROJECT_ID = 'project-light-sessions';
const SESSION_EPOCH = 'session-light-sessions';
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
	if (result.kind !== 'success') throw new Error('light sessions fixture was refused');
	return result.document;
}

function spot(position: Vec3 = [3, 2.4, 3], extra: Partial<SceneLightEntity> = {}): SceneLightEntity {
	return {
		kind: 'light',
		light: 'spot',
		id: 'light-spot',
		name: 'Spot',
		color: '#ffffff',
		intensity: Math.PI,
		castShadow: false,
		position,
		rotation: rotationForLightDirection([0.3, -1, 0.2]),
		angle: Math.PI / 6,
		range: 4,
		penumbra: 0.2,
		...extra
	} as SceneLightEntity;
}

function point(position: Vec3 = [3, 2.4, 3], range?: number): SceneLightEntity {
	return {
		kind: 'light',
		light: 'point',
		id: 'light-point',
		name: 'Point',
		color: '#ffffff',
		intensity: Math.PI,
		castShadow: false,
		position,
		rotation: [0, 0, 0],
		...(range === undefined ? {} : { range })
	};
}

const floorPick = (): SceneRenderedHit => ({
	entityId: 'floor',
	kind: 'entity',
	distanceMeters: 2,
	worldPoint: [0, 0, 0],
	normal: [0, 1, 0]
});

async function mounted(
	options: {
		readonly entities?: readonly SceneEntity[];
		readonly scenePick?: (ray: unknown) => SceneRenderedHit | null;
	} = {}
) {
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'Light sessions',
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
	const lightPreview = createStageLightPreview();
	const facade = createStageFacade({
		snapshot: admitted.snapshot,
		session,
		lightPreview,
		...(options.scenePick === undefined ? {} : { scenePick: options.scenePick as never })
	});
	if (facade.camera.evaluate(RECT, 1).kind !== 'evaluated') throw new Error('no evaluation');
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
	const registrations = [createSceneAdapter, createLightAdapter].map((adapter) => {
		const registration = mountStageAdapter(facade, host, adapter);
		if (registration.kind !== 'registered') throw new Error('light fixture adapter did not mount');
		return registration;
	});
	facade.camera.evaluate(RECT, 2);
	return { facade, host, lightPreview, registrations, light: registrations[1]! };
}

type Mounted = Awaited<ReturnType<typeof mounted>>;

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 240; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('light fixture did not settle');
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

function lights(facade: StageFacade): SceneLightEntity[] {
	return stageScene(facade.snapshot()).entities.filter(
		(entity): entity is SceneLightEntity => entity.kind === 'light'
	);
}

function lightOf(facade: StageFacade, id: string): SceneLightEntity {
	const found = lights(facade).find((entity) => entity.id === id);
	if (found === undefined) throw new Error(`no light ${id}`);
	return found;
}

function select(facade: StageFacade, id: string): void {
	const reference = sceneEntityReference(id, facade.snapshot().domain.unitRevisions.scene);
	facade.setSelection({ ordered: [{ reference }], primary: reference });
}

function markOf(facade: StageFacade, id: string) {
	const mark = facade.marks().find((candidate) => candidate.id === id);
	if (mark === undefined) {
		throw new Error(`no mark ${id}: ${facade.marks().map((m) => m.id).join(', ') || 'none'}`);
	}
	return mark;
}

function press(facade: StageFacade, id: string): { evaluationId: string; css: [number, number] } {
	const evaluationId = facade.evaluationId()!;
	const mark = markOf(facade, id);
	const claim = facade.pointerIntent({
		phase: 'down',
		css: mark.anchor,
		evaluationId,
		handleId: mark.id,
		handleAdapterId: mark.adapterId
	});
	expect(claim.claimed, `press ${id}`).toBe(true);
	return { evaluationId, css: [mark.anchor[0], mark.anchor[1]] };
}

function leaseOwner(facade: StageFacade): string | null {
	return facade.session.gesture()?.owner ?? null;
}

function previewIsEmpty(fixture: Mounted): boolean {
	return fixture.lightPreview.overrides.size === 0;
}

/** The accepted-request kinds a fixture sent to the acceptance host. */
function spyAccept(host: Mounted['host']) {
	const accept = vi.spyOn(host, 'accept');
	return {
		kinds: () => accept.mock.calls.map(([intent]) => intent.kind),
		payload: (kind: string) =>
			accept.mock.calls.find(([intent]) => intent.kind === kind)?.[0].payload as
				| Record<string, unknown>
				| undefined
	};
}

afterEach(() => clearArmedLight());

describe('X8 mark-gesture families commit one update-light with their own payload', () => {
	type Family = {
		readonly name: string;
		readonly entity: () => SceneLightEntity;
		readonly mark: string;
		readonly delta: readonly [number, number];
		readonly keys: readonly string[];
		readonly changed: (before: SceneLightEntity, after: SceneLightEntity) => boolean;
	};
	const families: readonly Family[] = [
		{
			name: 'Move',
			entity: () => spot(),
			mark: 'light-body',
			delta: [70, 10],
			// A Spot over a surface keeps its target fixed, so Move writes rotation too.
			keys: ['entityId', 'position', 'rotation'],
			changed: (a, b) => a.position[0] !== b.position[0] || a.position[2] !== b.position[2]
		},
		{
			name: 'Height',
			entity: () => spot(),
			mark: 'light-height',
			delta: [0, -40],
			keys: ['entityId', 'position'],
			changed: (a, b) => a.position[1] !== b.position[1]
		},
		{
			name: 'Aim',
			entity: () => spot(),
			mark: 'light-aim',
			delta: [60, -20],
			keys: ['entityId', 'rotation'],
			changed: (a, b) => a.rotation.some((v, i) => v !== b.rotation[i])
		},
		{
			name: 'Spot Reach',
			entity: () => spot(),
			mark: 'light-range',
			delta: [0, -30],
			keys: ['entityId', 'range'],
			changed: (a, b) => (a as { range?: number }).range !== (b as { range?: number }).range
		},
		{
			name: 'Beam',
			entity: () => spot(),
			mark: 'light-angle',
			delta: [40, 0],
			keys: ['entityId', 'angle'],
			changed: (a, b) => (a as { angle: number }).angle !== (b as { angle: number }).angle
		},
		{
			name: 'Soft edge',
			entity: () => spot(),
			mark: 'light-penumbra',
			delta: [-25, 0],
			keys: ['entityId', 'penumbra'],
			changed: (a, b) =>
				(a as { penumbra?: number }).penumbra !== (b as { penumbra?: number }).penumbra
		},
		{
			name: 'Point Reach',
			entity: () => point([3, 1.2, 3], 2),
			mark: 'light-reach',
			delta: [50, 10],
			keys: ['entityId', 'range'],
			changed: (a, b) => (a as { range?: number }).range !== (b as { range?: number }).range
		}
	];

	for (const family of families) {
		it(`${family.name}: one accepted update on release, none on cancel, lease and preview clean`, async () => {
			const entity = family.entity();
			const fixture = await mounted({ entities: [entity], scenePick: floorPick });
			const { facade, host } = fixture;
			const accepts = spyAccept(host);
			select(facade, entity.id);
			const before = host.history();
			const sourceBefore = facade.snapshot().canonicalJson;
			const original = lightOf(facade, entity.id);

			const { evaluationId, css } = press(facade, family.mark);
			expect(leaseOwner(facade)).toBe('light-marks');
			const to: [number, number] = [css[0] + family.delta[0], css[1] + family.delta[1]];
			facade.pointerIntent({ phase: 'move', css: to, evaluationId });
			// The drag is session-only: a preview override, never the canonical source.
			expect(fixture.lightPreview.overrides.has(entity.id)).toBe(true);
			expect(facade.snapshot().canonicalJson).toBe(sourceBefore);
			facade.pointerIntent({ phase: 'cancel', css: to, evaluationId });
			expect(leaseOwner(facade)).toBeNull();
			expect(previewIsEmpty(fixture)).toBe(true);
			expect(host.history()).toEqual(before);
			expect(accepts.kinds()).toEqual([]);

			const again = press(facade, family.mark);
			const release: [number, number] = [again.css[0] + family.delta[0], again.css[1] + family.delta[1]];
			facade.pointerIntent({ phase: 'move', css: release, evaluationId: again.evaluationId });
			facade.pointerIntent({ phase: 'up', css: release, evaluationId: again.evaluationId });
			expect(leaseOwner(facade)).toBeNull();
			await waitFor(() => host.history().depth === before.depth + 1);
			await settle();

			expect(accepts.kinds()).toEqual(['update-light']);
			expect(Object.keys(accepts.payload('update-light')!).sort()).toEqual([...family.keys].sort());
			expect(host.history().depth).toBe(before.depth + 1);
			expect(previewIsEmpty(fixture)).toBe(true);
			expect(family.changed(original, lightOf(facade, entity.id)), 'the gesture changed its field').toBe(true);
			expect(facade.selectionState().primary?.subject.id).toBe(entity.id);
			expect(lights(facade)).toHaveLength(1);
		});
	}
});

describe('X8 mark-gesture terminations', () => {
	async function mark(entities: readonly SceneEntity[] = [spot()]) {
		const fixture = await mounted({ entities, scenePick: floorPick });
		select(fixture.facade, entities[0]!.id);
		return fixture;
	}

	it('ends on a pointer cancel (the route\'s Escape path) with no write and a released lease', async () => {
		const fixture = await mark();
		const { facade, host } = fixture;
		const before = host.history();
		const { evaluationId, css } = press(facade, 'light-body');
		facade.pointerIntent({ phase: 'move', css: [css[0] + 60, css[1]], evaluationId });
		expect(fixture.lightPreview.overrides.size).toBe(1);
		// Light claims no keyboard cancel: Escape reaches it as a pointer cancel.
		expect(facade.gestureKeyIntent({ kind: 'cancel' }).claimed).toBe(false);
		facade.pointerIntent({ phase: 'cancel', css: [css[0] + 60, css[1]], evaluationId });
		await settle();
		expect(leaseOwner(facade)).toBeNull();
		expect(previewIsEmpty(fixture)).toBe(true);
		expect(host.history()).toEqual(before);
		expect(facade.selectionState().primary?.subject.id).toBe('light-spot');
	});

	it('keeps a captured gesture bound to its own light across a selection change: one entry on release', async () => {
		const fixture = await mark([spot(), point([1, 2, 1], 3)]);
		const { facade, host } = fixture;
		const before = host.history();
		const original = lightOf(facade, 'light-spot');
		const { evaluationId, css } = press(facade, 'light-body');
		facade.pointerIntent({ phase: 'move', css: [css[0] + 60, css[1]], evaluationId });
		select(facade, 'light-point');
		// The lease and the preview belong to the captured light, not to the selection.
		expect(leaseOwner(facade)).toBe('light-marks');
		expect(fixture.lightPreview.overrides.has('light-spot')).toBe(true);
		facade.pointerIntent({ phase: 'up', css: [css[0] + 60, css[1]], evaluationId });
		await waitFor(() => host.history().depth === before.depth + 1);
		await settle();
		expect(leaseOwner(facade)).toBeNull();
		expect(previewIsEmpty(fixture)).toBe(true);
		expect(lightOf(facade, 'light-spot').position).not.toEqual(original.position);
		expect(lightOf(facade, 'light-point').position).toEqual([1, 2, 1]);
	});

	it('releases the lease and the preview when the registration is disposed mid-drag', async () => {
		const fixture = await mark();
		const { facade, host } = fixture;
		const before = host.history();
		const { evaluationId, css } = press(facade, 'light-body');
		facade.pointerIntent({ phase: 'move', css: [css[0] + 60, css[1]], evaluationId });
		expect(leaseOwner(facade)).toBe('light-marks');
		fixture.light.dispose();
		expect(leaseOwner(facade)).toBeNull();
		expect(previewIsEmpty(fixture)).toBe(true);
		expect(host.history()).toEqual(before);
	});

	it('ends the lease on a reading change; the release still resolves to at most one entry and no lease', async () => {
		const fixture = await mark();
		const { facade, host } = fixture;
		const before = host.history();
		const { evaluationId, css } = press(facade, 'light-body');
		facade.pointerIntent({ phase: 'move', css: [css[0] + 60, css[1]], evaluationId });
		expect(facade.session.applyReadingChange()).toMatchObject({ cancelled: true });
		expect(leaseOwner(facade)).toBeNull();
		facade.pointerIntent({ phase: 'up', css: [css[0] + 60, css[1]], evaluationId });
		await settle();
		expect(leaseOwner(facade)).toBeNull();
		expect(previewIsEmpty(fixture)).toBe(true);
		expect(host.history().depth).toBe(before.depth + 1);
	});

	it('refuses a second gesture while another owner holds the gesture lease', async () => {
		const fixture = await mark();
		const { facade, host } = fixture;
		const evaluationId = facade.evaluationId()!;
		expect(
			facade.acquireGesture({ owner: 'someone-else', evaluationId, policy: 'cancel-on-reading-change' }).kind
		).toBe('granted');
		const body = markOf(facade, 'light-body');
		const before = host.history();
		expect(
			facade.pointerIntent({
				phase: 'down',
				css: body.anchor,
				evaluationId,
				handleId: body.id,
				handleAdapterId: body.adapterId
			}).claimed
		).toBe(false);
		expect(leaseOwner(facade)).toBe('someone-else');
		expect(host.history()).toEqual(before);
	});

	it('does not replay a captured gesture over another writer: one entry, no lease, newer value kept', async () => {
		const fixture = await mark();
		const { facade, host } = fixture;
		const { evaluationId, css } = press(facade, 'light-body');
		const to: [number, number] = [css[0] + 70, css[1]];
		facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		const before = host.history().depth;
		// Another writer replaces the accepted source mid-gesture (Card rename).
		const outcome = await host.accept({
			version: 1,
			kind: 'set-name',
			operationId: crypto.randomUUID(),
			expectedRevision: facade.snapshot().acceptedRevision,
			targets: [],
			payload: { entityId: 'light-spot', name: 'Renamed by other writer' } as never,
			capturedInputs: [],
			allocatedIds: []
		} as never);
		expect(['installed', 'refused', 'no-op']).toContain(outcome.kind);
		const afterOther = host.history().depth;
		facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await settle();
		expect(leaseOwner(facade)).toBeNull();
		expect(previewIsEmpty(fixture)).toBe(true);
		// The gesture's release is its own single write, or refused: never more.
		expect(host.history().depth - afterOther).toBeLessThanOrEqual(1);
		expect(afterOther - before).toBeLessThanOrEqual(1);
		expect(lightOf(facade, 'light-spot').name).toBe(outcome.kind === 'installed' ? 'Renamed by other writer' : 'Spot');
	});

	it('writes no entry for a press that moved nowhere over a refused update', async () => {
		const fixture = await mark();
		const { facade, host } = fixture;
		const accept = vi
			.spyOn(host, 'accept')
			.mockResolvedValueOnce({ kind: 'refused', code: 'fixture', message: 'Fixture refused.' } as StageAcceptOutcome as never);
		const before = host.history();
		const { evaluationId, css } = press(facade, 'light-body');
		const to: [number, number] = [css[0] + 60, css[1]];
		facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await waitFor(() => accept.mock.calls.length === 1);
		await settle();
		expect(host.history()).toEqual(before);
		expect(leaseOwner(facade)).toBeNull();
		// A refusal restores the accepted value (preview cleared) and is shown at the mark.
		expect(previewIsEmpty(fixture)).toBe(true);
		expect(markOf(facade, 'light-body').refusal ?? null).not.toBeNull();
	});
});

describe('X8 placement lifetimes', () => {
	function open(facade: StageFacade, kind: 'point' | 'spot' = 'spot'): void {
		armLight(PROJECT_ID, kind);
		const opened = facade.openContributedTask('light-place', 'light');
		if (opened.kind !== 'opened') throw new Error(`task not opened: ${opened.message}`);
	}

	it('places a Point with the stand-off body, no Reach and a zeroed candidate afterwards', async () => {
		const fixture = await mounted({ scenePick: floorPick });
		const { facade, host, lightPreview } = fixture;
		const accepts = spyAccept(host);
		open(facade, 'point');
		expect(lightPreview.candidate?.intensity).toBe(0);
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		facade.pointerIntent({ phase: 'down', css: [640, 380], evaluationId });
		expect(leaseOwner(facade)).toBe('light-place');
		facade.pointerIntent({ phase: 'up', css: [640, 380], evaluationId });
		await waitFor(() => lights(facade).length === 1);
		await settle();
		const placed = lights(facade)[0]!;
		expect(placed.light).toBe('point');
		expect('range' in placed).toBe(false);
		expect(placed.name).toBe('Point light');
		expect(accepts.kinds()).toEqual(['create-light']);
		expect(host.history().depth).toBe(before.depth + 1);
		expect(facade.selectionState().primary?.subject.id).toBe(placed.id);
		expect(leaseOwner(facade)).toBeNull();
		// Still armed after its own install; the candidate is zeroed again.
		expect(armedLightKind(PROJECT_ID)).toBe('point');
		expect(lightPreview.candidate === null || lightPreview.candidate.intensity === 0).toBe(true);
	});

	it('names successive lights uniquely', async () => {
		const fixture = await mounted({ entities: [point([1, 2, 1])], scenePick: floorPick });
		const { facade } = fixture;
		open(facade, 'point');
		const evaluationId = facade.evaluationId()!;
		facade.pointerIntent({ phase: 'down', css: [640, 380], evaluationId });
		facade.pointerIntent({ phase: 'up', css: [640, 380], evaluationId });
		await waitFor(() => lights(facade).length === 2);
		expect(new Set(lights(facade).map((light) => light.name)).size).toBe(2);
	});

	it('writes nothing on Escape mid-press and keeps the tool armed', async () => {
		const fixture = await mounted({ scenePick: floorPick });
		const { facade, host } = fixture;
		open(facade);
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		facade.pointerIntent({ phase: 'down', css: [640, 380], evaluationId });
		facade.pointerIntent({ phase: 'move', css: [700, 380], evaluationId });
		expect(leaseOwner(facade)).toBe('light-place');
		expect(facade.gestureKeyIntent({ kind: 'cancel' }).claimed).toBe(false);
		facade.pointerIntent({ phase: 'cancel', css: [700, 380], evaluationId });
		expect(leaseOwner(facade)).toBeNull();
		expect(host.history()).toEqual(before);
		expect(lights(facade)).toHaveLength(0);
		expect(armedLightKind(PROJECT_ID)).toBe('spot');
		expect(fixture.lightPreview.candidate?.intensity).toBe(0);
	});

	it('closing the task mid-press releases the lease, writes nothing, disarms and clears the candidate', async () => {
		const fixture = await mounted({ scenePick: floorPick });
		const { facade, host, lightPreview } = fixture;
		open(facade);
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		facade.pointerIntent({ phase: 'down', css: [640, 380], evaluationId });
		expect(facade.closeTask()).toBe(true);
		expect(leaseOwner(facade)).toBeNull();
		facade.pointerIntent({ phase: 'up', css: [640, 380], evaluationId });
		await settle();
		expect(host.history()).toEqual(before);
		expect(lights(facade)).toHaveLength(0);
		expect(armedLightKind(PROJECT_ID)).toBeNull();
		expect(lightPreview.candidate).toBeNull();
	});

	it('disposal mid-press releases the lease, clears preview and disarms', async () => {
		const fixture = await mounted({ scenePick: floorPick });
		const { facade, host, lightPreview } = fixture;
		open(facade);
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		facade.pointerIntent({ phase: 'down', css: [640, 380], evaluationId });
		facade.pointerIntent({ phase: 'move', css: [700, 380], evaluationId });
		fixture.light.dispose();
		expect(leaseOwner(facade)).toBeNull();
		expect(host.history()).toEqual(before);
		expect(lightPreview.candidate).toBeNull();
		expect(armedLightKind(PROJECT_ID)).toBeNull();
	});

	it('a reading change mid-press ends the lease; the release still resolves its one create', async () => {
		const fixture = await mounted({ scenePick: floorPick });
		const { facade, host } = fixture;
		open(facade);
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		facade.pointerIntent({ phase: 'down', css: [640, 380], evaluationId });
		expect(facade.session.applyReadingChange()).toMatchObject({ cancelled: true });
		expect(leaseOwner(facade)).toBeNull();
		facade.pointerIntent({ phase: 'up', css: [640, 380], evaluationId });
		await settle();
		expect(leaseOwner(facade)).toBeNull();
		// The held press still resolves its own one create; the lease did not.
		expect(host.history().depth).toBe(before.depth + 1);
		expect(lights(facade)).toHaveLength(1);
	});

	it('closing the task while the create is in flight keeps the arm and still installs once', async () => {
		const fixture = await mounted({ scenePick: floorPick });
		const { facade, host } = fixture;
		open(facade);
		const evaluationId = facade.evaluationId()!;
		const deferred: { resolve: ((outcome: StageAcceptOutcome) => void) | null } = { resolve: null };
		const real = host.accept.bind(host);
		const accept = vi.spyOn(host, 'accept');
		accept.mockImplementationOnce(
			(intent) =>
				new Promise<StageAcceptOutcome>((resolve) => {
					deferred.resolve = (outcome) => resolve(outcome);
					void real(intent).then(resolve);
				}) as never
		);
		const before = host.history();
		facade.pointerIntent({ phase: 'down', css: [640, 380], evaluationId });
		facade.pointerIntent({ phase: 'up', css: [640, 380], evaluationId });
		expect(accept).toHaveBeenCalledTimes(1);
		// The close that follows is the install's own re-arm window: not a disarm.
		facade.closeTask();
		await waitFor(() => lights(facade).length === 1);
		await settle();
		expect(host.history().depth).toBe(before.depth + 1);
		expect(lights(facade)).toHaveLength(1);
		expect(leaseOwner(facade)).toBeNull();
		expect(fixture.lightPreview.candidate === null || fixture.lightPreview.candidate.intensity === 0).toBe(true);
	});

	it('refuses the release visibly, then clears the refusal and the arm survives a thrown create', async () => {
		const fixture = await mounted({ scenePick: floorPick });
		const { facade, host } = fixture;
		open(facade);
		const evaluationId = facade.evaluationId()!;
		vi.spyOn(host, 'accept').mockRejectedValueOnce(new Error('The create threw.'));
		const before = host.history();
		facade.pointerIntent({ phase: 'down', css: [640, 380], evaluationId });
		facade.pointerIntent({ phase: 'up', css: [640, 380], evaluationId });
		await waitFor(() =>
			facade.candidatePreviews().some((candidate) => candidate.role === 'refused')
		);
		const refused = facade.candidatePreviews().find((candidate) => candidate.id === 'light-placement')!;
		expect(refused.labels.map((label) => label.text)).toContain('The create threw.');
		expect(host.history()).toEqual(before);
		expect(leaseOwner(facade)).toBeNull();
		facade.hoverIntent({ phase: 'move', css: [600, 380], evaluationId });
		expect(
			facade.candidatePreviews().find((candidate) => candidate.id === 'light-placement')?.role
		).toBe('subject');
	});
});

describe('X8 Card and keyboard contributions', () => {
	it('duplicates a light as one history entry, selects the copy and keeps the original', async () => {
		const fixture = await mounted({ entities: [spot()], scenePick: floorPick });
		const { facade, host } = fixture;
		select(facade, 'light-spot');
		const accepts = spyAccept(host);
		const before = host.history();
		const actions = facade.cardActions({
			sourceKind: 'entity',
			sourceId: 'light-spot',
			reference: facade.selectionState().primary!
		} as never);
		const duplicate = actions.find((action) => action.id === 'light-duplicate');
		if (duplicate === undefined) throw new Error('no duplicate action');
		expect(await duplicate.run()).toEqual({ kind: 'accepted' });
		await settle();
		expect(accepts.kinds()).toEqual(['duplicate-light']);
		expect(host.history().depth).toBe(before.depth + 1);
		expect(lights(facade)).toHaveLength(2);
		expect(facade.selectionState().primary?.subject.id).not.toBe('light-spot');
		expect(lightOf(facade, 'light-spot').position).toEqual([3, 2.4, 3]);
	});

	it('Delete removes the selected light through the same Card action: one entry', async () => {
		const fixture = await mounted({ entities: [spot()], scenePick: floorPick });
		const { facade, host } = fixture;
		select(facade, 'light-spot');
		const before = host.history();
		expect(facade.selectionKeyIntent({ kind: 'delete' })).toMatchObject({ claimed: true, adapterId: 'light' });
		await waitFor(() => lights(facade).length === 0);
		expect(host.history().depth).toBe(before.depth + 1);
		expect(leaseOwner(facade)).toBeNull();
	});
});

describe('X8 screen guides and marks keep their exact geometry', () => {
	const round = (value: number) => Math.round(value * 100) / 100;
	/** Every mark field, numbers rounded to 0.01: ids, anchors, verbs, values, draw hints. */
	const roundDeep = (value: unknown): unknown =>
		typeof value === 'number'
			? round(value)
			: Array.isArray(value)
				? value.map(roundDeep)
				: value !== null && typeof value === 'object'
					? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, roundDeep(v)]))
					: value;
	const summary = (facade: StageFacade) => ({
		marks: facade.marks().map((mark) => roundDeep(mark)),
		guides: facade.guides().map((guide) => ({
			id: guide.id,
			segments: guide.segments.length,
			derived: guide.derivedSegments.length,
			first: guide.segments[0]?.flat().map(round) ?? null,
			firstDerived: guide.derivedSegments[0]?.flat().map(round) ?? null,
			labels: guide.labels.map((label) => label.text)
		}))
	});

	for (const [name, entity] of [
		['Spot', spot()],
		['Spot with no Reach', (() => { const { range: _range, ...open } = spot() as SceneLightEntity & { range?: number }; return open as SceneLightEntity; })()],
		['Point with Reach on the floor', point([3, 1.2, 3], 2)],
		['Point with Reach in the air', point([3, 2.4, 3], 1)]
	] as const) {
		it(`pins the ${name} marks and guide`, async () => {
			const fixture = await mounted({ entities: [entity], scenePick: floorPick });
			select(fixture.facade, entity.id);
			expect(summary(fixture.facade)).toMatchSnapshot();
		});
	}

	it('pins the placement ghost for a Spot hover and a Point hover', async () => {
		for (const kind of ['spot', 'point'] as const) {
			clearArmedLight();
			const fixture = await mounted({ scenePick: floorPick });
			armLight(PROJECT_ID, kind);
			expect(fixture.facade.openContributedTask('light-place', 'light').kind).toBe('opened');
			fixture.facade.hoverIntent({ phase: 'move', css: [560, 340], evaluationId: fixture.facade.evaluationId()! });
			const ghost = fixture.facade.candidatePreviews().find((c) => c.id === 'light-placement')!;
			expect({
				role: ghost.role,
				segments: ghost.segments.length,
				labels: ghost.labels.map((label) => label.text),
				first: ghost.segments[0]?.flat().map(round) ?? null,
				candidate: fixture.lightPreview.candidate
					? [fixture.lightPreview.candidate.light, fixture.lightPreview.candidate.position.map(round)]
					: null
			}).toMatchSnapshot();
		}
	});
});
