/**
 * The host's schedule, leases and cache, against a fake renderer. Pixels are
 * the browser gate's job (`/dev/materials?gate=e7`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, Material } from 'three';

const views = vi.hoisted(() => ({
	live: 0,
	failed: new Set<string>()
}));

vi.mock('$lib/render/resources/finish-views', async (original) => ({
	...(await original<object>()),
	acquireFinishViews: async (sources: readonly { view: string; role: string }[]) => {
		const usable = sources.filter((source) => !views.failed.has(source.role));
		const issues = usable.length === sources.length ? [] : [{ code: 'image-load-failed' }];
		views.live += 1;
		let released = false;
		return {
			issues,
			views: Object.fromEntries(usable.map((source) => [source.view, {}])),
			release() {
				if (released) return;
				released = true;
				views.live -= 1;
			}
		};
	}
}));
// A studio PMREM needs a real device.
vi.mock('$lib/render/materials/inspection-lighting', async (original) => ({
	...(await original<object>()),
	createInspectionLighting: () => ({ group: new Group(), environment: () => null, dispose: () => undefined })
}));
vi.mock('$lib/render/resources/finish-sampling', async (original) => ({
	...(await original<object>()),
	createFinishChannelMaterial: () => new Material()
}));

import {
	INSPECTION_MAX_SIZE,
	createInspectionHost,
	type InspectionRequest,
	type InspectionState
} from '$lib/render/materials/inspection-host';
import { draftLookSource, type InspectionSubject } from '$lib/render/materials/inspection-subject';
import type { StandardMaterialDescriptor } from '$lib/render/resources/material-descriptor';
import { inspectionDraft } from './__helpers__/inspection-draft';

const OAK: InspectionSubject = { kind: 'catalogue', id: 'wood-oak-veneer' };
const WALNUT: InspectionSubject = { kind: 'catalogue', id: 'wood-walnut-veneer' };

function request(overrides: Partial<InspectionRequest> = {}): InspectionRequest {
	return { subject: OAK, geometry: 'sphere', lighting: 'studio', display: 'lit', sizePx: [8, 8], ...overrides };
}

function finish(scopeId: string, finishId = 'inspection-draft'): InspectionSubject {
	return {
		kind: 'finish',
		document: draftLookSource(inspectionDraft()),
		finishId,
		revision: '1',
		scope: { scopeId } as never
	};
}

function harness(options: { cache?: number } = {}) {
	const state = {
		alpha: 255,
		/** Set to hold every readback until it is called. */
		held: null as (() => void)[] | null,
		renders: 0,
		materials: 0,
		acquired: [] as StandardMaterialDescriptor[]
	};
	let target: { width: number; height: number } | null = null;
	const renderer = {
		isWebGPURenderer: true,
		backend: { isWebGPUBackend: true },
		autoClear: true,
		toneMappingExposure: 1,
		getRenderTarget: () => null,
		getClearColor: (color: unknown) => color,
		getClearAlpha: () => 1,
		setRenderTarget: (next: typeof target) => {
			target = next;
		},
		setClearColor: () => undefined,
		clear: () => undefined,
		render: () => {
			state.renders += 1;
		},
		readRenderTargetPixelsAsync: async (_: unknown, __: number, ___: number, width: number, height: number) => {
			const pixels = new Uint8Array(width * height * 4).fill(state.alpha);
			if (state.held !== null) await new Promise<void>((resolve) => state.held!.push(resolve));
			return pixels;
		}
	};
	const host = createInspectionHost({
		materials: {
			acquire(descriptor: StandardMaterialDescriptor) {
				state.materials += 1;
				state.acquired.push(descriptor);
				return { material: new Material(), release: () => (state.materials -= 1) };
			}
		} as never,
		lights: {} as never,
		thumbnailCacheLimit: options.cache,
		encode: async (frame) => new Uint8Array([frame.width, frame.height])
	});
	const attach = (generation = 1): void =>
		host.attach({
			renderer: renderer as never,
			backend: 'webgpu',
			viewGeneration: { owner: {}, generation } as never
		});
	attach();
	const states: InspectionState[] = [];
	const observe = (value: InspectionRequest) => host.observe(value, (next) => states.push(next));
	const settled = () => vi.waitFor(() => expect(states.at(-1)?.status).not.toBe('pending'));
	const released = () =>
		vi.waitFor(() => {
			expect(host.stats().leases).toBe(0);
			expect(state.materials).toBe(0);
			expect(views.live).toBe(0);
		});
	return { host, state, states, observe, settled, released, attach };
}

beforeEach(() => {
	views.live = 0;
	views.failed.clear();
});

let rig: ReturnType<typeof harness> | undefined;
afterEach(() => {
	rig?.host.dispose();
	rig = undefined;
});

describe('the interactive inspection', () => {
	it('draws once, unclipped, releases its leases, and then makes zero draws', async () => {
		rig = harness();
		rig.observe(request());
		await rig.settled();
		expect(rig.states.at(-1)).toMatchObject({ status: 'ready', frame: { width: 8, height: 8 } });
		expect(rig.state.acquired.map((descriptor) => descriptor.clip)).toEqual([false]);
		await rig.released();

		rig.observe(request());
		await Promise.resolve();
		expect(rig.states.at(-1)?.status).toBe('ready');
		expect(rig.host.stats().draws).toBe(1);
	});

	it('publishes only the last of a rapid switch', async () => {
		rig = harness();
		for (let size = 1; size <= 40; size += 1) {
			rig.observe(request({ subject: size % 2 === 0 ? OAK : WALNUT, sizePx: [size, size] }));
		}
		await rig.settled();
		const shown = rig.states.filter((state) => 'frame' in state);
		expect(shown).toHaveLength(1);
		expect(shown[0]).toMatchObject({ frame: { width: 40 } });
		await rig.released();
	});

	it('serves any size and any geometry', async () => {
		rig = harness();
		for (const geometry of ['sphere', 'plane', 'block'] as const) {
			rig.observe(request({ geometry, sizePx: [31, 17] }));
			await rig.settled();
			expect(rig.states.at(-1)).toMatchObject({ status: 'ready', frame: { width: 31, height: 17 } });
		}
		expect(rig.host.stats().draws).toBe(3);
	});

	it('refuses without a frame', async () => {
		rig = harness();
		const world = (anchorWorld: readonly [number, number, number] | null, acceptedRevision = '1') => ({
			world: { acceptedRevision, anchorWorld, sky: null, frame: {}, lights: [], treatment: undefined } as never
		});
		const cases: [Partial<InspectionRequest>, string][] = [
			[{ sizePx: [0, 8] }, 'invalid-size'],
			[{ sizePx: [INSPECTION_MAX_SIZE + 1, 8] }, 'invalid-size'],
			[{ subject: finish('a', 'deleted') }, 'subject-missing'],
			[{ lighting: world(null) }, 'world-anchor-required'],
			[{ subject: finish('a'), lighting: world([1, 2, 3], '2') }, 'world-sample-stale'],
			[
				{
					subject: { kind: 'draft', draft: { ...inspectionDraft(), expectedRevision: { revisionId: '1' } } },
					lighting: world([1, 2, 3], '2')
				},
				'world-sample-stale'
			]
		];
		for (const [overrides, code] of cases) {
			rig.observe(request(overrides));
			await rig.settled();
			const last = rig.states.at(-1)!;
			expect(last).toEqual(expect.objectContaining({ status: 'refused' }));
			expect(last).toMatchObject({ issues: [{ code }] });
			expect('frame' in last).toBe(false);
		}
		expect(rig.state.renders).toBe(0);
	});

	it('refuses the empty read of a lost device', async () => {
		rig = harness();
		rig.state.alpha = 0;
		rig.observe(request());
		await rig.settled();
		expect(rig.states.at(-1)).toMatchObject({ status: 'refused', issues: [{ code: 'readback-failed' }] });
		await rig.released();
	});

	it('labels a failed sibling partial, still draws a usable solo, and recovers on retry', async () => {
		rig = harness();
		views.failed.add('roughness');
		rig.observe(request({ display: 'unlit-color' }));
		await rig.settled();
		const partial = rig.states.at(-1)!;
		expect(partial).toMatchObject({
			status: 'partial',
			// One ORM image serves both roles.
			issues: [
				{ code: 'image-load-failed', role: 'roughness' },
				{ code: 'image-load-failed', role: 'occlusion' }
			]
		});
		expect('channels' in partial && partial.channels.find((channel) => channel.role === 'color')?.state).toBe('bound');
		expect('channels' in partial && partial.channels.find((channel) => channel.role === 'roughness')?.state).toBe(
			'missing-view'
		);

		views.failed.clear();
		rig.host.retry();
		await rig.settled();
		expect(rig.states.at(-1)?.status).toBe('ready');
		await rig.released();
	});

	it('keeps one draft scope and ends it with the observation', async () => {
		rig = harness();
		const stop = rig.observe(request({ subject: { kind: 'draft', draft: inspectionDraft() } }));
		await rig.settled();
		expect(rig.host.stats().draftScopes).toBe(1);
		stop();
		await Promise.resolve();
		expect(rig.host.stats().draftScopes).toBe(0);
	});
});

describe('generations and teardown', () => {
	it('drops a lost generation’s read and resumes the live request on the next', async () => {
		rig = harness();
		rig.state.held = [];
		rig.observe(request());
		await vi.waitFor(() => expect(rig!.state.held).toHaveLength(1));
		rig.host.detach();
		expect(rig.states.at(-1)).toEqual({ status: 'pending' });
		rig.state.held.forEach((resolve) => resolve());
		await rig.released();
		expect(rig.states.some((state) => 'frame' in state)).toBe(false);

		rig.state.held = null;
		rig.attach(2);
		await rig.settled();
		expect(rig.states.at(-1)?.status).toBe('ready');
	});

	it('keeps a queued thumbnail across a lost generation', async () => {
		rig = harness();
		rig.host.detach();
		const waiting = rig.host.thumbnail({ subject: OAK });
		await vi.waitFor(() => expect(rig!.host.stats().queued).toBe(1));
		rig.attach(2);
		expect((await waiting).status).toBe('ready');
	});

	it('publishes nothing after teardown mid-readback', async () => {
		rig = harness();
		rig.state.held = [];
		rig.observe(request());
		await vi.waitFor(() => expect(rig!.state.held).toHaveLength(1));
		const before = rig.states.length;
		rig.host.dispose();
		rig.state.held.forEach((resolve) => resolve());
		await rig.released();
		expect(rig.states).toHaveLength(before);
		expect(rig.host.stats()).toMatchObject({ attached: false, queued: 0, cached: 0, draftScopes: 0 });
	});
});

describe('thumbnails', () => {
	it('defaults to the 192 sphere and keys by size and geometry', async () => {
		rig = harness();
		const reference = await rig.host.thumbnail({ subject: OAK });
		expect(reference).toMatchObject({ status: 'ready', frame: { width: 192, height: 192 } });
		const keys = new Set<string>();
		for (const input of [
			{},
			{ width: 64 },
			{ width: 64, height: 32 },
			{ geometry: 'plane' as const },
			{ geometry: 'block' as const }
		]) {
			const result = await rig.host.thumbnail({ subject: OAK, ...input });
			if (result.status === 'ready') keys.add(result.key);
		}
		expect(keys.size).toBe(5);
		expect(rig.host.stats()).toMatchObject({ draws: 5, cached: 5 });
		await rig.released();
	});

	it('coalesces waiters and cancels only when the last one leaves', async () => {
		rig = harness();
		const leave = new AbortController();
		const left = rig.host.thumbnail({ subject: OAK }, leave.signal);
		const stays = rig.host.thumbnail({ subject: OAK });
		leave.abort();
		expect(await left).toMatchObject({ status: 'refused', issues: [{ code: 'cancelled' }] });
		expect((await stays).status).toBe('ready');
		expect(rig.host.stats().draws).toBe(1);

		const alone = new AbortController();
		const cancelled = rig.host.thumbnail({ subject: WALNUT }, alone.signal);
		alone.abort();
		expect((await cancelled).status).toBe('refused');
		expect(rig.host.stats().queued).toBe(0);
		await rig.released();
	});

	it('isolates project scopes', async () => {
		rig = harness();
		await rig.host.thumbnail({ subject: finish('project-a') });
		await rig.host.thumbnail({ subject: finish('project-a') });
		expect(rig.host.stats().draws).toBe(1);
		await rig.host.thumbnail({ subject: finish('project-b') });
		expect(rig.host.stats()).toMatchObject({ draws: 2, cached: 2 });
	});

	it('never joins a job to another scope object under the same id', async () => {
		rig = harness();
		const results = await Promise.all([
			rig.host.thumbnail({ subject: finish('project-a') }),
			rig.host.thumbnail({ subject: finish('project-a') })
		]);
		expect(results.map((result) => result.status)).toEqual(['ready', 'ready']);
		expect(rig.host.stats().draws).toBe(2);
	});

	describe('sample tile (U1)', () => {
		const tile = (input: Record<string, unknown> = {}) =>
			rig!.host.thumbnail({ subject: OAK, sampleTile: 'default', ...input } as never);

		it('draws the 256 master on the plane, keyed apart from the E7 sphere', async () => {
			rig = harness();
			const result = await tile();
			expect(result).toMatchObject({ status: 'ready', frame: { width: 256, height: 256 } });
			const sphere = await rig.host.thumbnail({ subject: OAK });
			expect(sphere.status === 'ready' && result.status === 'ready' && sphere.key !== result.key).toBe(true);
			expect(result.status === 'ready' && result.key).toMatch(/^tile-/);
			await rig.released();
		});

		it('reuses a drawn tile and draws a new one for a new window', async () => {
			rig = harness();
			await tile();
			await tile();
			expect(rig.host.stats().draws).toBe(1);
			// Oak's default window is 40% of its 0.5 m tile, so a stated 0.2 is the same picture.
			await tile({ sampleTile: { windowMeters: 0.2 } });
			expect(rig.host.stats().draws).toBe(1);
			await tile({ sampleTile: { windowMeters: 0.3 } });
			await tile({ sampleTile: { windowMeters: 0.3, centre: [0.4, 0.5] } });
			expect(rig.host.stats()).toMatchObject({ draws: 3, cached: 3 });
			await rig.released();
		});

		it('keys a tile by the Finish and window, not by how the hint is spelled', async () => {
			rig = harness();
			const a = await tile({ sampleTile: { windowMeters: 0.28 } });
			const b = await tile({ sampleTile: { windowMeters: 0.28, centre: [0.5, 0.5] } });
			expect(a.status === 'ready' && b.status === 'ready' && a.key === b.key).toBe(true);
			expect(rig.host.stats().draws).toBe(1);
			const walnut = await tile({ subject: WALNUT, sampleTile: { windowMeters: 0.28 } });
			expect(walnut.status === 'ready' && a.status === 'ready' && walnut.key !== a.key).toBe(true);
		});

		it('draws a project Finish under its own scope', async () => {
			rig = harness();
			await tile({ subject: finish('project-a') });
			await tile({ subject: finish('project-a') });
			expect(rig.host.stats().draws).toBe(1);
			await tile({ subject: finish('project-b') });
			expect(rig.host.stats()).toMatchObject({ draws: 2, cached: 2 });
		});

		it('refuses a non-square or oversized tile and a cancelled one', async () => {
			rig = harness();
			expect(await tile({ width: 256, height: 128 })).toMatchObject({ status: 'refused', issues: [{ code: 'invalid-size' }] });
			expect(await tile({ width: INSPECTION_MAX_SIZE + 1, height: INSPECTION_MAX_SIZE + 1 })).toMatchObject({ status: 'refused' });
			const controller = new AbortController();
			controller.abort();
			expect(await tile({ subject: WALNUT }).then(() => rig!.host.thumbnail({ subject: WALNUT, sampleTile: 'default' }, controller.signal))).toMatchObject({
				status: 'refused',
				issues: [{ code: 'cancelled' }]
			});
			await rig.released();
		});

		it('keeps the E7 sphere thumbnail untouched', async () => {
			rig = harness();
			const before = await rig.host.thumbnail({ subject: OAK });
			await tile();
			const after = await rig.host.thumbnail({ subject: OAK });
			expect(before).toMatchObject({ status: 'ready', frame: { width: 192, height: 192 } });
			expect(after).toBe(before);
		});
	});

	it('never caches a draft', async () => {
		rig = harness();
		const subject: InspectionSubject = { kind: 'draft', draft: inspectionDraft() };
		expect((await rig.host.thumbnail({ subject })).status).toBe('ready');
		expect((await rig.host.thumbnail({ subject })).status).toBe('ready');
		expect(rig.host.stats()).toMatchObject({ draws: 2, cached: 0, draftScopes: 0 });
	});

	it('is never made from a partial look', async () => {
		rig = harness();
		views.failed.add('normal');
		expect(await rig.host.thumbnail({ subject: OAK })).toMatchObject({
			status: 'refused',
			issues: [{ code: 'image-load-failed' }]
		});
		expect(rig.host.stats().cached).toBe(0);
		await rig.released();
	});

	it('evicts the least recently used entry at its bound', async () => {
		rig = harness({ cache: 2 });
		for (const width of [8, 16, 8, 32, 8]) await rig.host.thumbnail({ subject: OAK, width });
		expect(rig.host.stats()).toMatchObject({ draws: 3, cached: 2 });
		await rig.host.thumbnail({ subject: OAK, width: 16 });
		expect(rig.host.stats().draws).toBe(4);
	});

	it('treats lightTurnRadians: 0 as identical to omitted and redraws for non-zero turn', async () => {
		rig = harness();
		const baseReq = {
			subject: OAK,
			geometry: 'sphere' as const,
			lighting: 'library-studio' as const,
			display: 'lit' as const,
			sizePx: [32, 32] as const
		};
		const states: InspectionState[] = [];
		const stop1 = rig.host.observe(baseReq, (s) => states.push(s));
		await vi.waitFor(() => expect(states.at(-1)?.status).toBe('ready'));
		expect(rig.host.stats().draws).toBe(1);
		stop1();

		const statesZero: InspectionState[] = [];
		const stop2 = rig.host.observe({ ...baseReq, lightTurnRadians: 0 }, (s) => statesZero.push(s));
		await vi.waitFor(() => expect(statesZero.at(-1)?.status).toBe('ready'));
		// Zero turn matches the settled omitted-turn key: zero extra draws.
		expect(rig.host.stats().draws).toBe(1);
		stop2();

		const statesTurned: InspectionState[] = [];
		const stop3 = rig.host.observe({ ...baseReq, lightTurnRadians: 0.4 }, (s) => statesTurned.push(s));
		await vi.waitFor(() => expect(statesTurned.at(-1)?.status).toBe('ready'));
		expect(rig.host.stats().draws).toBe(2);
		stop3();
	});
});
