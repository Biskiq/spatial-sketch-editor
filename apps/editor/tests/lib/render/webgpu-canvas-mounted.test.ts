// @vitest-environment jsdom
/**
 * PR 1 — both Canvas integration candidates under the same mounted contract.
 *
 * The two rejected-by-Threlte promises are what this suite exists for: a
 * delayed init must not mount the child or draw, a rejected init must retire
 * and retry forced WebGL2 on a **fresh** DOM canvas, an unmount during init
 * must clean up the late success, device loss must replace only the affected
 * Canvas, and a surviving sibling Canvas must keep drawing. Both candidates
 * run every case; the chosen path is the one that passes with public hooks and
 * Threlte still owning its scheduler.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import StockCanvasHost from '../../../experiments/webgpu-migration/lifecycle/stock-canvas-host.svelte';
import ReadyGatedCanvasHost from '../../../experiments/webgpu-migration/lifecycle/ready-gated-canvas-host.svelte';
import {
	CanvasLifecycle,
	type LifecycleSnapshot
} from '../../../experiments/webgpu-migration/lifecycle/canvas-lifecycle';
import { fakeHost, settle, type FakeHost } from './fixtures/webgpu-canvas-fakes';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

vi.hoisted(() => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
	});
	// The production Canvases clamp DPR to [1, 1.5]; a retina-sized window proves
	// the clamp reaches the renderer in both candidates.
	Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
});

const CANDIDATES = [
	{ name: 'stock Canvas + adapter', component: StockCanvasHost, selectedName: 'stock' },
	{ name: 'ready-gated Canvas', component: ReadyGatedCanvasHost, selectedName: 'ready-gated' }
] as const;

type ProbeState = {
	mounts: number;
	frames: number;
	session: unknown;
};

let targets: HTMLElement[] = [];
let unhandled: unknown[] = [];
let onUnhandled: ((reason: unknown) => void) | null = null;

function hostElement(): HTMLElement {
	const target = document.createElement('div');
	target.style.width = '1280px';
	target.style.height = '720px';
	document.body.append(target);
	targets.push(target);
	return target;
}

async function mountHost(
	candidate: (typeof CANDIDATES)[number],
	host: FakeHost,
	options: {
		renderMode?: 'always' | 'on-demand';
		onPointerCancel?: (reason: string) => void;
		onSnapshot?: (snapshot: LifecycleSnapshot) => void;
	} = {}
) {
	const probeState: ProbeState = { mounts: 0, frames: 0, session: { selection: 'wall-7', playhead: 4.25 } };
	const session = probeState.session;
	const component = mount(candidate.component, {
		target: hostElement(),
		props: {
			factory: host.factory,
			probe: {
				session,
				onMount() {
					probeState.mounts += 1;
					expect(probeState.session).toBe(session);
				},
				onFrame() {
					probeState.frames += 1;
				}
			},
			renderMode: options.renderMode ?? 'always',
			onPointerCancel: options.onPointerCancel,
			onSnapshot: options.onSnapshot
		}
	});
	flushSync();
	await tick();
	return { component, probeState, session };
}

/** Run scheduler frames until the condition holds (bounded). */
async function pumpUntil(host: FakeHost, condition: () => boolean, frames = 40): Promise<void> {
	for (let index = 0; index < frames; index += 1) {
		host.pump();
		flushSync();
		await tick();
		if (condition()) return;
	}
	throw new Error('condition did not hold within the bounded frame pump');
}

function phaseOf(target: HTMLElement): string {
	return target.querySelector<HTMLElement>('[data-canvas-host]')?.dataset.phase ?? '';
}

beforeEach(() => {
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe(): void {}
			unobserve(): void {}
			disconnect(): void {}
		}
	);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT as unknown as DOMRect);
	unhandled = [];
	onUnhandled = (reason) => unhandled.push(reason);
	process.on('unhandledRejection', onUnhandled);
});

afterEach(() => {
	if (onUnhandled !== null) process.off('unhandledRejection', onUnhandled);
	for (const target of targets) target.remove();
	targets = [];
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe.each(CANDIDATES)('$name', (candidate) => {
	it('mounts nothing and draws nothing until init resolves', async () => {
		const host = fakeHost();
		const { component, probeState } = await mountHost(candidate, host);
		try {
			await settle();
			expect(probeState.mounts).toBe(0);
			host.pump();
			await tick();
			expect(host.created[0]!.renderCalls).toBe(0);
			expect(phaseOf(targets[0]!)).toBe('starting');

			host.resolveInit(0);
			await pumpUntil(host, () => host.created[0]!.renderCalls > 0);
			expect(probeState.mounts).toBe(1);
			expect(phaseOf(targets[0]!)).toBe('ready');
			expect(host.created[0]!.pixelRatio).toBe(1.5);
			expect(host.created[0]!.lastSize).toEqual({ width: 1280, height: 720 });
		} finally {
			await unmount(component);
		}
	});

	it('retries forced WebGL2 once on a fresh canvas after a rejected init', async () => {
		const host = fakeHost({ backendFor: (mode) => (mode === 'webgl2' ? 'webgl2' : 'webgpu') });
		const phases: string[] = [];
		const { component, probeState } = await mountHost(candidate, host, {
			onSnapshot: (snapshot) => phases.push(`${snapshot.phase}:${snapshot.attempt}`)
		});
		try {
			host.rejectInit(0);
			await pumpUntil(host, () => host.created.length === 2);
			expect(host.created[1]!.mode).toBe('webgl2');
			expect(host.canvasIdentities()[0]).not.toBe(host.canvasIdentities()[1]);
			await vi.waitFor(() => expect(host.created[0]!.disposeCalls).toBe(1));
			expect(probeState.mounts).toBe(0);
			expect(host.created[0]!.renderCalls).toBe(0);

			host.resolveInit(1);
			await pumpUntil(host, () => host.created[1]!.renderCalls > 0);
			expect(phaseOf(targets[0]!)).toBe('ready');
			expect(targets[0]!.querySelector('[data-canvas-host]')?.getAttribute('data-backend')).toBe('webgl2');
			expect(probeState.mounts).toBe(1);
			// The automatic attempt failed before the forced compatibility attempt;
			// both are recorded, and the recovered surface is the second generation.
			expect(phases).toContain('starting:auto');
			expect(phases).toContain('recovering:webgl2');
			expect(phases).toContain('ready:webgl2');
		} finally {
			await unmount(component);
		}
	});

	it('cleans up an unmount during init without drawing or mounting the child', async () => {
		const host = fakeHost();
		const { component, probeState } = await mountHost(candidate, host);
		host.pump();
		await unmount(component);
		host.resolveInit(0);
		await settle();
		expect(host.created[0]!.renderCalls).toBe(0);
		expect(probeState.mounts).toBe(0);
		expect(host.created[0]!.disposeCalls).toBe(1);
		expect(unhandled).toEqual([]);
	});

	it('replaces only the lost canvas, keeps its session, and the sibling keeps drawing', async () => {
		const first = fakeHost();
		const second = fakeHost();
		const firstMounted = await mountHost(candidate, first);
		const secondMounted = await mountHost(candidate, second, {
			onPointerCancel: () => cancelled.push('second')
		});
		const cancelled: string[] = [];
		try {
			first.resolveInit(0);
			second.resolveInit(0);
			await pumpUntil(first, () => first.created[0]!.renderCalls > 0);
			await pumpUntil(second, () => second.created[0]!.renderCalls > 0);
			const firstCanvas = first.created[0]!.canvas;
			const session = secondMounted.session;

			second.lose(0);
			await pumpUntil(second, () => second.created.length === 2);
			expect(second.created[1]!.canvas).not.toBe(second.created[0]!.canvas);
			await vi.waitFor(() => expect(second.created[0]!.disposeCalls).toBe(1));
			expect(first.created[0]!.canvas).toBe(firstCanvas);
			expect(cancelled).toEqual(['second']);
			expect(secondMounted.probeState.session).toBe(session);

			second.resolveInit(1);
			await pumpUntil(second, () => second.created[1]!.renderCalls > 0);
			const firstDraws = first.created[0]!.renderCalls;
			first.pump();
			flushSync();
			await tick();
			expect(first.created[0]!.renderCalls).toBeGreaterThan(firstDraws);
			expect(secondMounted.probeState.mounts).toBe(2);
		} finally {
			await unmount(firstMounted.component);
			await unmount(secondMounted.component);
		}
	});

	it('switches a repeated WebGPU loss to forced WebGL2 and stops at unavailable', async () => {
		const host = fakeHost();
		const { component } = await mountHost(candidate, host);
		try {
			host.resolveInit(0);
			await pumpUntil(host, () => host.created[0]!.renderCalls > 0);

			host.lose(0);
			await pumpUntil(host, () => host.created.length === 2);
			expect(host.created[1]!.mode).toBe('auto');
			host.resolveInit(1);
			await pumpUntil(host, () => host.created[1]!.renderCalls > 0);

			host.lose(1);
			await pumpUntil(host, () => host.created.length === 3);
			expect(host.created[2]!.mode).toBe('webgl2');
			host.resolveInit(2);
			await pumpUntil(host, () => host.created[2]!.renderCalls > 0);

			host.lose(2);
			await pumpUntil(host, () => targets[0]!.querySelector('[data-renderer-unavailable]') !== null);
			expect(host.created[3]).toBeUndefined();
			expect(targets[0]!.querySelector('button')?.textContent).toBe('Retry');

			// Retry is a fresh automatic attempt, not another forced WebGL2 loop.
			targets[0]!.querySelector<HTMLButtonElement>('button')!.click();
			flushSync();
			await pumpUntil(host, () => host.created.length === 4);
			expect(host.created[3]!.mode).toBe('auto');
		} finally {
			await unmount(component);
		}
	});

	it('disposes the lifecycle episode timer on unmount', async () => {
		const dispose = vi.spyOn(CanvasLifecycle.prototype, 'dispose');
		const host = fakeHost();
		const { component } = await mountHost(candidate, host);
		host.resolveInit(0);
		await pumpUntil(host, () => host.created[0]!.renderCalls > 0);
		expect(dispose).not.toHaveBeenCalled();
		await unmount(component);
		expect(dispose).toHaveBeenCalledTimes(1);
	});

	it('consumes a rejected async disposal and reports no unhandled rejection', async () => {
		const host = fakeHost();
		host.disposeMode.value = 'reject';
		const { component } = await mountHost(candidate, host);
		host.resolveInit(0);
		await pumpUntil(host, () => host.created[0]!.renderCalls > 0);
		await unmount(component);
		await vi.waitFor(() => expect(host.created[0]!.disposeCalls).toBe(1));
		await settle();
		expect(unhandled).toEqual([]);
	});
});
