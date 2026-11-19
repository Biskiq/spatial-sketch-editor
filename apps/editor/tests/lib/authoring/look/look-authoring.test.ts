import { describe, expect, it, vi } from 'vitest';
import {
	SCENE_ENVIRONMENT_SET_KIND,
	SCENE_LOOK_APPLY_KIND,
	SCENE_LOOK_RESTORE_KIND,
	SCENE_TREATMENT_SET_KIND,
	skyFromPreset,
	type SceneEnvironment,
	type SceneSky
} from '@portfolio/project-model/units';
import { SCENE_PALETTE_ADOPT } from '@portfolio/project-model/scene-planning';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import {
	createLookAuthoring,
	LOOK_MATERIAL_PICK_NOTICE,
	type LookScene
} from '$lib/authoring/look/look-authoring.svelte';

const RISO_SKY: SceneSky = {
	preset: 'daylight',
	time: 13,
	heading: 0,
	arcHeight: 55,
	haze: 5,
	exposure: 0.15,
	softness: 0.05,
	sunShadows: true,
	moon: { color: '#c9d6ff', strength: 0.25 },
	skyColor: '#f4d35e',
	groundColor: '#3d5a80'
};

function sceneOf(environment?: SceneEnvironment): LookScene {
	return {
		formatVersion: 10,
		textures: [],
		materials: [],
		entities: [],
		...(environment === undefined ? {} : { environment })
	} as unknown as LookScene;
}

type Accept = (intent: unknown) => Promise<unknown>;

function services(accept: Accept): StageAdapterServices {
	return {
		stage: { snapshot: () => ({ acceptedRevision: 7 }) },
		authoring: { accept, acceptedRevision: () => 7, registerPlanner: () => ({ kind: 'registered' }) }
	} as unknown as StageAdapterServices;
}

function harness(options: {
	readonly sky?: SceneSky | null;
	readonly scene?: LookScene | null;
	readonly sessionKey?: string;
	readonly admitted?: boolean;
	readonly accept?: Accept;
} = {}) {
	const sky = options.sky === undefined ? skyFromPreset('daylight', 0) : options.sky;
	let notice = '';
	let scene = options.scene ?? null;
	let sessionKey = options.sessionKey ?? 'session-1';
	const accept = vi.fn(options.accept ?? (async () => ({ kind: 'installed' })));
	const current = options.admitted === false ? null : services(accept);
	const look = createLookAuthoring({
		sky: () => sky,
		scene: () => scene,
		sessionKey: () => sessionKey,
		services: () => current,
		onNotice: (message) => {
			notice = message;
		}
	});
	return {
		look,
		accept,
		notice: () => notice,
		setScene: (next: LookScene | null) => { scene = next; },
		setSessionKey: (next: string) => { sessionKey = next; }
	};
}

describe('T2 P0 — the Look authoring seam', () => {
	it('writes the chosen Sky preset through the one acceptance host', async () => {
		const host = harness({ sky: null });
		await host.look.setEnvironment('golden-hour');
		expect(host.accept).toHaveBeenCalledWith(
			expect.objectContaining({
				version: 1,
				kind: SCENE_ENVIRONMENT_SET_KIND,
				expectedRevision: 7,
				targets: [],
				payload: { preset: 'golden-hour' },
				allocatedIds: [],
				capturedInputs: []
			})
		);
	});

	it('keeps the no-services and one-write-at-a-time guards', async () => {
		const missing = harness({ sky: null, admitted: false });
		await missing.look.setEnvironment('dusk');
		expect(missing.accept).not.toHaveBeenCalled();

		let settle: (outcome: unknown) => void = () => {};
		const pending = new Promise<unknown>((resolve) => {
			settle = resolve;
		});
		const first = harness({ sky: null, accept: () => pending });
		const write = first.look.setEnvironment('dusk');
		expect(first.look.busy).toBe(true);
		const second = first.look.setEnvironment('daylight');
		expect(first.accept).toHaveBeenCalledTimes(1);
		settle({ kind: 'installed' });
		await Promise.all([write, second]);
		expect(first.look.busy).toBe(false);
	});

	it('writes the current preset as a Reset so an edited Sky returns to its start', async () => {
		const host = harness({ sky: skyFromPreset('dusk', 0) });
		await host.look.setEnvironment('dusk');
		expect(host.accept).toHaveBeenCalledTimes(1);
		expect(host.accept).toHaveBeenCalledWith(
			expect.objectContaining({ kind: SCENE_ENVIRONMENT_SET_KIND, payload: { preset: 'dusk' } })
		);
	});

	it('reports a refusal on the route notice and leaves an installed write silent', async () => {
		const refused = harness({
			sky: null,
			accept: async () => ({ kind: 'refused', message: 'That Sky is unavailable.' })
		});
		await refused.look.setEnvironment('dusk');
		expect(refused.notice()).toBe('That Sky is unavailable.');

		// Choosing the tile the World already shows answers no-change and stays silent.
		const unchanged = harness({
			sky: null,
			accept: async () => ({ kind: 'refused', code: 'no-change', message: 'The World already uses Paper' })
		});
		await unchanged.look.setEnvironment('studio');
		expect(unchanged.notice()).toBe('');

		const installed = harness({ sky: null });
		await installed.look.setEnvironment('dusk');
		expect(installed.notice()).toBe('');
	});

	it('keeps Plain Paper a session-only view and never rewrites the saved Sky', async () => {
		const host = harness({ sky: skyFromPreset('dusk', 0) });
		expect(host.look.sky).toEqual(skyFromPreset('dusk', 0));
		expect(host.look.stageSky).toEqual(skyFromPreset('dusk', 0));
		host.look.setStudioWhileEditing(true);
		expect(host.look.studioWhileEditing).toBe(true);
		expect(host.look.stageSky).toBeNull();
		expect(host.look.sky).toEqual(skyFromPreset('dusk', 0));
		expect(host.accept).not.toHaveBeenCalled();
	});

	it('keeps the material pick exactly as it was: a notice, never a World write', () => {
		const host = harness();
		host.look.pickMaterial('oak');
		expect(host.notice()).toBe(LOOK_MATERIAL_PICK_NOTICE);
		expect(host.accept).not.toHaveBeenCalled();
	});

	it('publishes the approved Lights shelf and keeps the P0 Card stratum empty', () => {
		const host = harness();
		expect(host.look.cardStratum(null)).toEqual({ facts: [], writer: null, actions: [] });
		expect(host.look.stageMarks).toEqual([]);
		expect(host.look.libraryShelf).toEqual({
			label: 'Lights',
			entries: [
				{ id: 'light:point', label: 'Point', summary: 'A light with no direction or beam.' },
				{ id: 'light:spot', label: 'Spot', summary: 'A cone aimed at a surface.' }
			]
		});
		host.look.pickLibraryEntry('missing');
		expect(host.notice()).toBe('');
	});

	it('applies a Look through the one host and captures Previous', async () => {
		const host = harness({ sky: skyFromPreset('studio', 0), scene: sceneOf() });
		await host.look.applyLook('riso');
		expect(host.accept).toHaveBeenCalledWith(
			expect.objectContaining({ kind: SCENE_LOOK_APPLY_KIND, payload: { look: 'riso' } })
		);
		expect(host.look.previousEnvironment).toMatchObject({ sky: null, treatment: undefined });
	});

	it('Previous restores the captured environment and captures the one it leaves', async () => {
		const host = harness({ sky: skyFromPreset('studio', 0), scene: sceneOf() });
		await host.look.applyLook('riso');
		host.setScene(sceneOf({ sky: RISO_SKY, treatment: 'flat-colour' }));
		await host.look.restorePrevious();
		expect(host.accept).toHaveBeenLastCalledWith(
			expect.objectContaining({ kind: SCENE_LOOK_RESTORE_KIND, payload: { sky: null } })
		);
		// True A/B: the capture now holds what the restore left.
		expect(host.look.previousEnvironment?.treatment).toBe('flat-colour');
		await host.look.restorePrevious();
		expect(host.accept).toHaveBeenLastCalledWith(
			expect.objectContaining({
				kind: SCENE_LOOK_RESTORE_KIND,
				payload: { sky: RISO_SKY, treatment: 'flat-colour' }
			})
		);
	});

	it('clears Previous on another environment write and on a project-epoch change', async () => {
		const seed = harness({ sky: skyFromPreset('studio', 0), scene: sceneOf() });
		await seed.look.applyLook('clay');
		expect(seed.look.previousEnvironment).not.toBeNull();
		seed.setScene(sceneOf({ sky: skyFromPreset('overcast', 0), treatment: 'clay' }));
		await seed.look.setEnvironment('dusk');
		expect(seed.look.previousEnvironment).toBeNull();

		const epoch = harness({ sky: skyFromPreset('studio', 0), scene: sceneOf() });
		await epoch.look.applyLook('clay');
		epoch.setSessionKey('session-2');
		expect(epoch.look.previousEnvironment).toBeNull();
	});

	it('writes a Treatment without touching the Sky', async () => {
		const host = harness({ scene: sceneOf({ sky: skyFromPreset('dusk', 12) }) });
		await host.look.setTreatment('clay');
		expect(host.accept).toHaveBeenCalledWith(
			expect.objectContaining({ kind: SCENE_TREATMENT_SET_KIND, payload: { treatment: 'clay' } })
		);
	});

	it('previews palette adoption without writing and adopts in one write', async () => {
		const scene = {
			...sceneOf({ sky: skyFromPreset('dusk', 0) }),
			palette: [{ id: 'coral', name: 'Coral', color: '#ee6c4d' }],
			materials: [{ id: 'finish', name: 'Finish', baseMaterialId: 'plaster-warm', color: '#ee6c4d' }]
		} as unknown as LookScene;
		const host = harness({ scene });
		expect(host.look.canAdopt).toBe(true);
		host.look.beginAdoption();
		expect(host.look.adoptionPreview?.rows).toHaveLength(1);
		expect(host.accept).not.toHaveBeenCalled();
		await host.look.adoptPalette();
		expect(host.accept).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: SCENE_PALETTE_ADOPT,
				payload: { mapping: [{ color: '#ee6c4d', slotId: 'coral', slotColor: '#ee6c4d' }] }
			})
		);
		expect(host.look.adoptionPreview).toBeNull();
	});

	it('has no Directional shelf entry: a stale pick writes nothing and arms nothing', () => {
		const host = harness();
		expect(host.look.libraryShelf.entries.map((entry) => entry.id)).not.toContain('light:directional');
		host.look.pickLibraryEntry('light:directional');
		expect(host.accept).not.toHaveBeenCalled();
		expect(host.notice()).toBe('');
	});
});
