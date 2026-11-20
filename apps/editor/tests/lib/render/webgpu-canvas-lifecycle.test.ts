/**
 * PR 1 — the Canvas lifecycle contract shared by both integration candidates.
 *
 * The product's renderer context calls `setAnimationLoop()` and `dispose()`
 * without awaiting them and catches only synchronous disposal errors. These
 * tests hold the proposed owner to what that context cannot provide: one
 * explicit init gate, one retirement per generation, late-init cleanup, device
 * loss handling and the plan's bounded recovery episode. They use no GPU, DOM
 * or real timer.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	createGenerationOwner,
	type GenerationFactory,
	type GenerationTimer
} from '../../../experiments/webgpu-migration/lifecycle/generation-owner';
import {
	CanvasLifecycle,
	type LifecycleSnapshot
} from '../../../experiments/webgpu-migration/lifecycle/canvas-lifecycle';

type Fake = {
	render(...args: unknown[]): void;
	readonly canvas: unknown;
	readonly mode: string;
	renderCalls: number;
	disposeCalls: number;
	loss: (() => void) | null;
	onDeviceLost: (info: unknown) => void;
	label: string;
	dispose?: () => void;
};

function fakeFactory() {
	const created: Fake[] = [];
	const pending: Array<{ resolve(): void; reject(error?: unknown): void }> = [];
	const modeLog: string[] = [];
	const disposals: string[] = [];
	let disposeRejects = false;
	const factory: GenerationFactory<Fake> = {
		create(_canvas, mode) {
			modeLog.push(mode);
			let resolve: () => void = () => {};
			let reject: (error?: unknown) => void = () => {};
			const promise = new Promise<void>((res, rej) => {
				resolve = res;
				reject = rej;
			});
			pending.push({ resolve, reject });
			const fake: Fake = {
				canvas: {},
				mode,
				renderCalls: 0,
				disposeCalls: 0,
				loss: null,
				onDeviceLost: () => {},
				label: `generation-${created.length}`,
				render() {
					fake.renderCalls += 1;
				}
			};
			// Keep the deferred promise reachable from the control surface.
			Object.assign(fake, { pending: promise });
			created.push(fake);
			return fake;
		},
		init(renderer) {
			const index = created.indexOf(renderer);
			return (created[index] as Fake & { pending: Promise<void> }).pending;
		},
		backend: () => 'webgpu',
		async dispose(renderer) {
			const fake = renderer as Fake;
			fake.disposeCalls += 1;
			disposals.push(fake.label);
			if (disposeRejects) throw new Error('dispose rejected');
		},
		onDeviceLost(renderer, listener) {
			(renderer as Fake).loss = listener;
			return () => {
				(renderer as Fake).loss = null;
			};
		}
	};
	return {
		factory,
		created,
		modeLog,
		disposals,
		resolve(index = 0) {
			pending[index]!.resolve();
		},
		reject(index = 0, error?: unknown) {
			pending[index]!.reject(error);
		},
		rejectDisposal() {
			disposeRejects = true;
		}
	};
}

function fakeTimer() {
	const scheduled: Array<{ id: number; at: number; callback: () => void }> = [];
	let nextId = 1;
	let now = 0;
	const timer: GenerationTimer = {
		set(callback, ms) {
			const id = nextId++;
			scheduled.push({ id, at: now + ms, callback });
			return id;
		},
		clear(handle) {
			const index = scheduled.findIndex((entry) => entry.id === handle);
			if (index >= 0) scheduled.splice(index, 1);
		}
	};
	return {
		timer,
		advance(ms: number) {
			now += ms;
			for (const entry of [...scheduled]) {
				if (entry.at > now) continue;
				const index = scheduled.indexOf(entry);
				if (index >= 0) scheduled.splice(index, 1);
				entry.callback();
			}
		},
		pending: () => scheduled.length
	};
}

function ownerFixture(index = 0) {
	const host = fakeFactory();
	const timer = fakeTimer();
	const owner = createGenerationOwner(host.factory, {
		canvas: {} as HTMLCanvasElement,
		generation: index,
		mode: 'auto',
		timer: timer.timer,
		deadlineMs: 10_000
	});
	return { host, timer, owner };
}

describe('generation owner', () => {
	it('withholds every draw until init resolves, then forwards real draws', async () => {
		const { host, owner } = ownerFixture();
		owner.start();
		expect(owner.snapshot()).toEqual({ state: 'starting', backend: null, failure: null });
		owner.facade.render();
		owner.facade.render();
		expect(host.created[0]!.renderCalls).toBe(0);
		expect(owner.blockedDraws).toBe(2);
		expect(owner.forwardedDraws).toBe(0);

		host.resolve();
		await vi.waitFor(() => expect(owner.snapshot().state).toBe('ready'));
		expect(owner.snapshot().backend).toBe('webgpu');
		owner.facade.render();
		expect(host.created[0]!.renderCalls).toBe(1);
		expect(owner.forwardedDraws).toBe(1);

		await owner.retire();
		expect(host.created[0]!.disposeCalls).toBe(1);
	});

	it('consumes a rejected init, disposes once, and never becomes ready', async () => {
		const { host, owner } = ownerFixture();
		owner.start();
		host.reject();
		await vi.waitFor(() => expect(owner.snapshot().state).toBe('disposed'));
		expect(owner.snapshot().failure).toBe('init-rejected');
		expect(host.created[0]!.disposeCalls).toBe(1);
		owner.facade.render();
		expect(host.created[0]!.renderCalls).toBe(0);
		await owner.retirement;
	});

	it('times out at the UI deadline and cleans up a late successful init', async () => {
		const { host, timer, owner } = ownerFixture();
		owner.start();
		timer.advance(10_000);
		await vi.waitFor(() => expect(owner.snapshot().state).toBe('failed'));
		expect(owner.snapshot().failure).toBe('init-timeout');
		expect(host.created[0]!.disposeCalls).toBe(0);

		// The late completion can only retire itself; it cannot resurrect the surface.
		host.resolve();
		await owner.retirement;
		expect(host.created[0]!.disposeCalls).toBe(1);
		expect(owner.snapshot().state).toBe('disposed');
		expect(owner.forwardedDraws).toBe(0);
	});

	it('cleans up an unmount during pending init and ignores a late success', async () => {
		const { host, owner } = ownerFixture();
		owner.start();
		const retirement = owner.retire();
		owner.facade.render();
		expect(host.created[0]!.renderCalls).toBe(0);

		host.resolve();
		await retirement;
		expect(host.created[0]!.disposeCalls).toBe(1);
		expect(owner.snapshot().state).toBe('disposed');
	});

	it('retires a ready generation once when the device is lost', async () => {
		const { host, owner } = ownerFixture();
		owner.start();
		host.resolve();
		await vi.waitFor(() => expect(owner.snapshot().state).toBe('ready'));

		host.created[0]!.loss?.();
		await vi.waitFor(() => expect(owner.snapshot().state).toBe('failed'));
		expect(owner.snapshot().failure).toBe('device-lost');
		owner.facade.render();
		expect(host.created[0]!.renderCalls).toBe(0);
		await owner.retirement;
		expect(host.created[0]!.disposeCalls).toBe(1);
		// Threlte's own synchronous dispose and the host's unmount are the same path.
		owner.facade.dispose?.();
		await owner.retirement;
		expect(host.created[0]!.disposeCalls).toBe(1);
	});

	it('consumes a rejected async disposal', async () => {
		const { host, owner } = ownerFixture();
		host.rejectDisposal();
		owner.start();
		host.resolve();
		await vi.waitFor(() => expect(owner.snapshot().state).toBe('ready'));
		await owner.retire();
		expect(host.created[0]!.disposeCalls).toBe(1);
		expect(owner.snapshot().state).toBe('disposed');
	});
});

function lifecycleFixture() {
	const snapshots: LifecycleSnapshot[] = [];
	const timer = fakeTimer();
	const lifecycle = new CanvasLifecycle({
		clock: {
			now: () => 0,
			set: timer.timer.set,
			clear: timer.timer.clear
		},
		episodeMs: 30_000,
		onChange: (snapshot) => snapshots.push(snapshot)
	});
	lifecycle.begin();
	return { lifecycle, snapshots, timer };
}

describe('canvas lifecycle', () => {
	it('retries forced WebGL2 once on a fresh canvas after a failed init', () => {
		const { lifecycle } = lifecycleFixture();
		lifecycle.failed('init-rejected');
		expect(lifecycle.snapshot()).toMatchObject({
			phase: 'recovering',
			attempt: 'webgl2',
			generation: 1
		});
		lifecycle.failed('init-rejected');
		expect(lifecycle.snapshot()).toMatchObject({ phase: 'unavailable', attempt: 'webgl2' });
		lifecycle.retry();
		expect(lifecycle.snapshot()).toMatchObject({
			phase: 'starting',
			attempt: 'auto',
			generation: 2,
			failure: null
		});
	});

	it('retries WebGPU once, then switches to WebGL2, then stops looping', () => {
		const { lifecycle } = lifecycleFixture();
		lifecycle.ready('webgpu');
		lifecycle.lost();
		expect(lifecycle.snapshot()).toMatchObject({
			phase: 'recovering',
			attempt: 'auto',
			generation: 1,
			episodeLosses: 1
		});
		lifecycle.ready('webgpu');
		lifecycle.lost();
		expect(lifecycle.snapshot()).toMatchObject({
			phase: 'recovering',
			attempt: 'webgl2',
			generation: 2,
			episodeLosses: 2
		});
		lifecycle.ready('webgl2');
		lifecycle.lost();
		expect(lifecycle.snapshot()).toMatchObject({ phase: 'unavailable', attempt: 'webgl2' });
	});

	it('treats any loss on a recovered WebGL2 surface as terminal', () => {
		const { lifecycle } = lifecycleFixture();
		lifecycle.ready('webgl2');
		lifecycle.lost();
		expect(lifecycle.snapshot().phase).toBe('unavailable');
	});

	it('ends a recovery episode after 30 seconds without loss', () => {
		const { lifecycle, timer } = lifecycleFixture();
		lifecycle.ready('webgpu');
		timer.advance(30_000);
		lifecycle.lost();
		expect(lifecycle.snapshot()).toMatchObject({
			phase: 'recovering',
			attempt: 'auto',
			generation: 1,
			episodeLosses: 1
		});
		lifecycle.ready('webgpu');
		// A second loss inside the episode would switch to WebGL2; let the recovered
		// surface prove 30 seconds of stability first.
		timer.advance(30_000);
		lifecycle.lost();
		expect(lifecycle.snapshot()).toMatchObject({
			phase: 'recovering',
			attempt: 'auto',
			generation: 2,
			episodeLosses: 1
		});
	});
});
