/**
 * One renderer generation for the product's Canvas hosts.
 *
 * Threlte 8.5.16's renderer context calls `setAnimationLoop` and `dispose`
 * without awaiting their promises and catches only synchronous disposal errors.
 * r187's `WebGPURenderer` is asynchronous in both directions. This owner supplies
 * exactly what Threlte does not:
 *
 * - one explicit `init` promise with a 10-second UI deadline per attempt;
 * - a facade that refuses `render` until init has resolved, so a scheduler
 *  frame cannot draw on a partially acquired canvas;
 * - one idempotent retirement promise shared by Threlte's synchronous `dispose`
 *  call, a failed init, a device loss and the host's unmount;
 * - a device-loss observer registered before init starts;
 * - cleanup of a successful init that arrives after the generation retired.
 *
 * It is the seam PR 2 ships, not a comparison harness: the product's Stage,
 * Visitor Preview and published visit all construct their renderer through it.
 *
 * No GPU, DOM, timer or Svelte dependency is created here: the host injects the
 * canvas, the attempt and the optional test clock.
 */
import type { WebGPURenderer } from 'three/webgpu';
import {
	createProductRenderer,
	disposeProductRenderer,
	initProductRenderer,
	observeRendererDeviceLoss,
	rendererBackendOf,
	type GenerationFailure,
	type RendererAttempt,
	type RendererBackend,
	type RendererSurface,
} from './renderer-backend';

export type GenerationSnapshot = {
	readonly state: 'starting' | 'ready' | 'failed' | 'disposed';
	readonly backend: RendererBackend | null;
	readonly failure: GenerationFailure | null;
};

export type GenerationTimer = {
	set(callback: () => void, ms: number): unknown;
	clear(handle: unknown): void;
};

export type RendererGeneration = {
	readonly generation: number;
	readonly renderer: WebGPURenderer;
	/** The object Threlte receives; it forwards to the real renderer once ready. */
	readonly facade: WebGPURenderer;
	readonly retirement: Promise<void>;
	/** Actual draws forwarded to the real renderer. */
	readonly forwardedDraws: number;
	/** Draw requests the facade refused before init or after retirement. */
	readonly blockedDraws: number;
	/**
	 * Draw requests refused because layout had collapsed the canvas to zero
	 * pixels. Drawing then would make WebGPU create a zero-sized depth texture and
	 * swapchain, which is a validation error rather than a frame.
	 */
	readonly emptyDraws: number;
	snapshot(): GenerationSnapshot;
	start(): void;
	retire(): Promise<void>;
};

const DEADLINE_MS = 10_000;

function defaultTimer(): GenerationTimer {
	return {
		set: (callback, ms) => globalThis.setTimeout(callback, ms),
		clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
	};
}

function createFacade(
	renderer: WebGPURenderer,
	isReady: () => boolean,
	retire: () => void,
	counts: { forwarded: number; blocked: number; empty: number },
): WebGPURenderer {
	const facade = new Proxy(renderer, {
		get(target, property, receiver) {
			if (property === 'render') {
				return (...args: unknown[]): unknown => {
					if (!isReady()) {
						counts.blocked += 1;
						return undefined;
					}
					// A hidden surface keeps its renderer and scene warm, but its DOM
					// canvas is resized to zero. r187 would create a zero-sized depth
					// texture and swapchain and log uncaptured validation errors; there
					// is no frame to present, so refuse the draw instead.
					const canvas = (target as { domElement?: { width?: number; height?: number } })
						.domElement;
					if ((canvas?.width ?? 0) === 0 || (canvas?.height ?? 0) === 0) {
						counts.empty += 1;
						return undefined;
					}
					counts.forwarded += 1;
					const render = (target as { render?: (...callArgs: unknown[]) => unknown }).render;
					return render?.apply(target, args);
				};
			}
			// Threlte calls dispose inside a synchronous try/catch and never awaits
			// its result. The owner's idempotent retirement is the one disposal path.
			if (property === 'dispose') return (): void => void retire();
			const value = Reflect.get(target, property, receiver);
			return typeof value === 'function' ? value.bind(target) : value;
		},
		set(target, property, value, receiver) {
			return Reflect.set(target, property, value, receiver);
		},
	});
	return facade;
}

export function createRendererGeneration(options: {
	readonly canvas: HTMLCanvasElement;
	readonly generation: number;
	readonly attempt: RendererAttempt;
	readonly surface: RendererSurface;
	readonly onChange?: (snapshot: GenerationSnapshot) => void;
	readonly deadlineMs?: number;
	readonly timer?: GenerationTimer;
}): RendererGeneration {
	const timer = options.timer ?? defaultTimer();
	const deadlineMs = options.deadlineMs ?? DEADLINE_MS;
	const counts = { forwarded: 0, blocked: 0, empty: 0 };

	const renderer = createProductRenderer(options.canvas, options.attempt, options.surface);

	let state: GenerationSnapshot['state'] = 'starting';
	let backend: RendererBackend | null = null;
	let failure: GenerationFailure | null = null;
	let started = false;
	let retiring = false;
	let deadline: unknown = null;
	let removeLossListener: (() => void) | null = null;
	let disposeFinished = false;
	let initPromise: Promise<void> | null = null;
	let resolveRetirement: () => void = () => {};
	const retirement = new Promise<void>((resolve) => {
		resolveRetirement = resolve;
	});

	function snapshot(): GenerationSnapshot {
		return { state, backend, failure };
	}

	function emit(): void {
		options.onChange?.(snapshot());
	}

	const facade = createFacade(
		renderer,
		() => state === 'ready' && !retiring,
		() => void retire(),
		counts,
	);

	async function disposeOnce(): Promise<void> {
		if (disposeFinished) return;
		disposeFinished = true;
		try {
			await disposeProductRenderer(renderer);
		} catch {
			// A rejected async dispose is reported through the generation snapshot,
			// never as an unhandled rejection owned by the host or Threlte's cleanup.
		}
	}

	function retire(): Promise<void> {
		if (retiring) return retirement;
		retiring = true;
		removeLossListener?.();
		removeLossListener = null;
		if (deadline !== null) {
			timer.clear(deadline);
			deadline = null;
		}
		void (async () => {
			// A pending init must settle before the renderer can be disposed: r187's
			// dispose waits for init. A late successful init is cleaned up here and
			// can never become this generation's live surface.
			try {
				await initPromise;
			} catch {
				// Consumed here and in the init chain below.
			}
			await disposeOnce();
			state = 'disposed';
			emit();
			resolveRetirement();
		})();
		return retirement;
	}

	function fail(next: GenerationFailure): void {
		if (state !== 'starting' && state !== 'ready') return;
		state = 'failed';
		failure = next;
		emit();
		void retire();
	}

	function clearDeadline(): void {
		if (deadline === null) return;
		timer.clear(deadline);
		deadline = null;
	}

	return {
		generation: options.generation,
		renderer,
		facade,
		retirement,
		get forwardedDraws() {
			return counts.forwarded;
		},
		get blockedDraws() {
			return counts.blocked;
		},
		get emptyDraws() {
			return counts.empty;
		},
		snapshot,
		start(): void {
			if (started) return;
			started = true;
			initPromise = Promise.resolve().then(() => initProductRenderer(renderer));
			// Register before init resolves: a device can be lost during startup.
			removeLossListener = observeRendererDeviceLoss(renderer, () => fail('device-lost'));
			deadline = timer.set(() => fail('init-timeout'), deadlineMs);
			void initPromise.then(
				() => {
					clearDeadline();
					if (state !== 'starting') {
						void retire();
						return;
					}
					backend = rendererBackendOf(renderer);
					state = 'ready';
					emit();
				},
				() => {
					clearDeadline();
					fail('init-rejected');
				},
			);
		},
		retire,
	};
}
