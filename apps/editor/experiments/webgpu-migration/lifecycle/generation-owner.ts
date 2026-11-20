/**
 * One renderer generation for the T2 WebGPU migration's Canvas candidates.
 *
 * This is PR 1's comparison seam, not product code. It owns exactly what
 * Threlte 8.5.16's renderer context does not:
 *
 * - one explicit `init()` promise, with a 10-second UI deadline;
 * - a facade that refuses `render()` until init has resolved, so a scheduler
 *   frame cannot draw on a partially acquired canvas;
 * - one idempotent retirement promise shared by Threlte's synchronous
 *   `dispose()` call, a failed init, a device loss and the host's unmount;
 * - a device-loss listener registered before init starts;
 * - cleanup of a successful init that arrives after the generation retired.
 *
 * No GPU, DOM, timer or Svelte dependency appears here: the candidate hosts
 * inject the factory, clock and canvas, and tests drive pending init and loss
 * callbacks directly.
 */

export type RendererBackend = 'webgpu' | 'webgl2';
export type RendererAttempt = 'auto' | 'webgl2';
export type GenerationFailure = 'init-rejected' | 'init-timeout' | 'device-lost';

export type GenerationRenderer = {
	render(...args: unknown[]): unknown;
	dispose?(): unknown;
	readonly [property: string]: unknown;
};

export type GenerationFactory<Renderer extends object> = {
	/** Construct on the host's own canvas, synchronously, as Threlte expects. */
	create(canvas: HTMLCanvasElement, mode: RendererAttempt): Renderer;
	/** Resolve only after the backend and its coordinate system are usable. */
	init(renderer: Renderer): Promise<unknown>;
	/** The observed backend, read from the initialized renderer. */
	backend(renderer: Renderer): RendererBackend;
	dispose(renderer: Renderer): unknown;
	/** Register before init; return the removal callback. */
	onDeviceLost(renderer: Renderer, listener: () => void): () => void;
};

export type GenerationTimer = {
	set(callback: () => void, ms: number): unknown;
	clear(handle: unknown): void;
};

export type GenerationSnapshot = {
	readonly state: 'starting' | 'ready' | 'failed' | 'disposed';
	readonly backend: RendererBackend | null;
	readonly failure: GenerationFailure | null;
};

export type GenerationOwner<Renderer extends object> = {
	readonly generation: number;
	readonly renderer: Renderer;
	/** The object Threlte receives; it forwards to the real renderer once ready. */
	readonly facade: Renderer;
	readonly retirement: Promise<void>;
	/** Actual draws forwarded to the real renderer. */
	readonly forwardedDraws: number;
	/** Draw requests the facade refused before init resolved or after retirement. */
	readonly blockedDraws: number;
	snapshot(): GenerationSnapshot;
	start(): void;
	retire(): Promise<void>;
};

const DEADLINE_MS = 10_000;

function defaultTimer(): GenerationTimer {
	return {
		set: (callback, ms) => globalThis.setTimeout(callback, ms),
		clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>)
	};
}

function createFacade<Renderer extends object>(
	renderer: Renderer,
	isReady: () => boolean,
	retire: () => void,
	counts: { forwarded: number; blocked: number }
): Renderer {
	const facade = new Proxy(renderer, {
		get(target, property, receiver) {
			if (property === 'render') {
				return (...args: unknown[]): unknown => {
					if (!isReady()) {
						counts.blocked += 1;
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
		}
	});
	return facade;
}

export function createGenerationOwner<Renderer extends object>(
	factory: GenerationFactory<Renderer>,
	options: {
		readonly canvas: HTMLCanvasElement;
		readonly generation: number;
		readonly mode: RendererAttempt;
		readonly onChange?: (snapshot: GenerationSnapshot) => void;
		readonly deadlineMs?: number;
		readonly timer?: GenerationTimer;
	}
): GenerationOwner<Renderer> {
	const timer = options.timer ?? defaultTimer();
	const deadlineMs = options.deadlineMs ?? DEADLINE_MS;
	const counts = { forwarded: 0, blocked: 0 };

	const renderer = factory.create(options.canvas, options.mode);

	let state: GenerationSnapshot['state'] = 'starting';
	let backend: RendererBackend | null = null;
	let failure: GenerationFailure | null = null;
	let started = false;
	let retiring = false;
	let deadline: unknown = null;
	let removeLossListener: (() => void) | null = null;
	let disposeFinished = false;
	let initPromise: Promise<unknown> | null = null;
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
		counts
	);

	async function disposeOnce(): Promise<void> {
		if (disposeFinished) return;
		disposeFinished = true;
		try {
			await factory.dispose(renderer);
		} catch {
			// A rejected async dispose is reported through the generation snapshot,
			// never as an unhandled rejection owned by the host or by Threlte's
			// synchronous cleanup.
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
			// A pending init must settle before the renderer can be disposed: Three's
			// own dispose() waits for init. A late successful init is cleaned up here
			// and can never become this generation's live surface.
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
		snapshot,
		start(): void {
			if (started) return;
			started = true;
			initPromise = Promise.resolve().then(() => factory.init(renderer));
			// Register before init resolves: a device can be lost during startup.
			removeLossListener = factory.onDeviceLost(renderer, () => fail('device-lost'));
			deadline = timer.set(() => fail('init-timeout'), deadlineMs);
			void initPromise.then(
				() => {
					clearDeadline();
					if (state !== 'starting') {
						void retire();
						return;
					}
					backend = factory.backend(renderer);
					state = 'ready';
					emit();
				},
				() => {
					clearDeadline();
					fail('init-rejected');
				}
			);
		},
		retire
	};
}
