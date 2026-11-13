import { describe, expect, it, vi } from 'vitest';
import { SCENE_ENVIRONMENT_SET_KIND, type SceneEnvironmentPreset } from '@portfolio/project-model/units';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import {
	createLookAuthoring,
	LOOK_MATERIAL_PICK_NOTICE
} from '$lib/authoring/look/look-authoring.svelte';

type Accept = (intent: unknown) => Promise<unknown>;

function services(accept: Accept): StageAdapterServices {
	return {
		stage: { snapshot: () => ({ acceptedRevision: 7 }) },
		authoring: { accept, acceptedRevision: () => 7, registerPlanner: () => ({ kind: 'registered' }) }
	} as unknown as StageAdapterServices;
}

function harness(options: {
	readonly preset?: SceneEnvironmentPreset;
	readonly admitted?: boolean;
	readonly accept?: Accept;
} = {}) {
	const preset = options.preset ?? 'paper';
	let notice = '';
	const accept = vi.fn(options.accept ?? (async () => ({ kind: 'installed' })));
	const current = options.admitted === false ? null : services(accept);
	const look = createLookAuthoring({
		environment: () => preset,
		services: () => current,
		onNotice: (message) => {
			notice = message;
		}
	});
	return { look, accept, notice: () => notice };
}

describe('T2 P0 — the Look authoring seam', () => {
	it('writes the saved Sky preset through the one acceptance host', async () => {
		const host = harness({ preset: 'paper' });
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

	it('keeps the existing guards: no services, the same preset, and one write at a time', async () => {
		const missing = harness({ preset: 'paper', admitted: false });
		await missing.look.setEnvironment('dusk');
		expect(missing.accept).not.toHaveBeenCalled();

		const same = harness({ preset: 'dusk' });
		await same.look.setEnvironment('dusk');
		expect(same.accept).not.toHaveBeenCalled();

		let settle: (outcome: unknown) => void = () => {};
		const pending = new Promise<unknown>((resolve) => {
			settle = resolve;
		});
		const first = harness({ preset: 'paper', accept: () => pending });
		const write = first.look.setEnvironment('dusk');
		expect(first.look.busy).toBe(true);
		const second = first.look.setEnvironment('daylight');
		expect(first.accept).toHaveBeenCalledTimes(1);
		settle({ kind: 'installed' });
		await Promise.all([write, second]);
		expect(first.look.busy).toBe(false);
	});

	it('reports a refusal on the route notice and leaves an installed write silent', async () => {
		const refused = harness({
			preset: 'paper',
			accept: async () => ({ kind: 'refused', message: 'That Sky is unavailable.' })
		});
		await refused.look.setEnvironment('dusk');
		expect(refused.notice()).toBe('That Sky is unavailable.');

		const installed = harness({ preset: 'paper' });
		await installed.look.setEnvironment('dusk');
		expect(installed.notice()).toBe('');
	});

	it('keeps Plain Paper a session-only view and never rewrites the saved Sky', async () => {
		const host = harness({ preset: 'dusk' });
		expect(host.look.environment).toBe('dusk');
		expect(host.look.stageEnvironment).toBe('dusk');
		host.look.setEditOnPaper(true);
		expect(host.look.editOnPaper).toBe(true);
		expect(host.look.stageEnvironment).toBe('paper');
		expect(host.look.environment).toBe('dusk');
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
				{ id: 'light:spot', label: 'Spot', summary: 'A cone aimed at a surface.' },
				{ id: 'light:directional', label: 'Directional', summary: 'Parallel light, like the sun.' }
			]
		});
		host.look.pickLibraryEntry('missing');
		expect(host.notice()).toBe('');
	});
});
