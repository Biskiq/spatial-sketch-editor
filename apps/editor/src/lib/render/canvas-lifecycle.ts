/**
 * Host-level lifecycle for one product surface.
 *
 * One `CanvasLifecycle` belongs to a mounted Stage or Visitor surface, not to a
 * renderer: it decides when the ready subtree must be replaced by a **fresh**
 * canvas and when the surface has to show its in-place unavailable state. It
 * implements the approved recovery episode:
 *
 * - an init failure after acquiring the canvas retries forced WebGL2 once on a
 *  fresh canvas;
 * - the first device loss on a backend retries that backend once on a fresh
 *  canvas;
 * - a repeated loss on WebGPU (or a failed WebGPU retry) switches to forced
 *  WebGL2 once;
 * - a loss on WebGL2, or a second failed attempt there, presents Retry instead
 *  of looping;
 * - a recovery episode ends only after the new surface has run for 30 seconds
 *  without loss.
 *
 * Plain TypeScript with an injected clock, so the mounted tests and the lifecycle
 * contract drive the episode without real waits. No Svelte import: the host
 * subscribes and mirrors the snapshot into runes.
 */

import type { GenerationFailure, RendererAttempt, RendererBackend } from './renderer-backend';

export type LifecyclePhase = 'starting' | 'ready' | 'recovering' | 'unavailable' | 'disposed';

export type LifecycleSnapshot = {
	readonly phase: LifecyclePhase;
	readonly attempt: RendererAttempt;
	/** Increments for every fresh canvas the host must mount. */
	readonly generation: number;
	readonly backend: RendererBackend | null;
	readonly failure: GenerationFailure | null;
	/** Losses observed in the current recovery episode. */
	readonly episodeLosses: number;
};

export type LifecycleClock = {
	now(): number;
	set(callback: () => void, ms: number): unknown;
	clear(handle: unknown): void;
};

const EPISODE_MS = 30_000;

function defaultClock(): LifecycleClock {
	return {
		now: () => Date.now(),
		set: (callback, ms) => globalThis.setTimeout(callback, ms),
		clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
	};
}

export class CanvasLifecycle {
	private readonly clock: LifecycleClock;
	private readonly episodeMs: number;
	private readonly onChange: ((snapshot: LifecycleSnapshot) => void) | undefined;
	private phase: LifecyclePhase = 'starting';
	private attempt: RendererAttempt = 'auto';
	private generation = 0;
	private backend: RendererBackend | null = null;
	private failure: GenerationFailure | null = null;
	private episodeLosses = 0;
	private episodeTimer: unknown = null;
	private episodeOpen = false;

	constructor(
		options: {
			readonly clock?: LifecycleClock;
			readonly episodeMs?: number;
			readonly onChange?: (snapshot: LifecycleSnapshot) => void;
		} = {},
	) {
		this.clock = options.clock ?? defaultClock();
		this.episodeMs = options.episodeMs ?? EPISODE_MS;
		this.onChange = options.onChange;
	}

	snapshot(): LifecycleSnapshot {
		return {
			phase: this.phase,
			attempt: this.attempt,
			generation: this.generation,
			backend: this.backend,
			failure: this.failure,
			episodeLosses: this.episodeLosses,
		};
	}

	begin(): void {
		this.attempt = 'auto';
		this.phase = 'starting';
		this.backend = null;
		this.failure = null;
		this.episodeLosses = 0;
		this.generation = 0;
		this.emit();
	}

	/** An initialized generation is usable; the backend is the observed one. */
	ready(backend: RendererBackend): void {
		this.backend = backend;
		this.phase = 'ready';
		this.failure = null;
		this.openEpisode();
		this.emit();
	}

	/**
	 * Init failed or rejected. There is no backend to observe. Retry forced
	 * WebGL2 once on a fresh canvas; otherwise present Retry.
	 */
	failed(failure: GenerationFailure): void {
		this.failure = failure;
		if (this.attempt === 'auto') {
			this.attempt = 'webgl2';
			this.generation += 1;
			this.phase = 'recovering';
			this.emit();
			return;
		}
		this.phase = 'unavailable';
		this.emit();
	}

	/**
	 * The current generation's device was lost after it was usable. The episode
	 * rules decide whether a fresh canvas retries the backend or the surface
	 * becomes unavailable.
	 */
	lost(): void {
		this.failure = 'device-lost';
		this.episodeLosses += 1;
		if (this.backend === 'webgl2' || this.attempt === 'webgl2') {
			// A WebGL2 surface — forced or selected by Three's internal fallback — is
			// kept for the episode's lifetime. A loss there presents Retry instead of
			// another loop.
			this.phase = 'unavailable';
			this.emit();
			return;
		}
		if (this.episodeLosses >= 2) {
			this.attempt = 'webgl2';
			this.generation += 1;
			this.phase = 'recovering';
			this.emit();
			return;
		}
		this.generation += 1;
		this.phase = 'recovering';
		this.emit();
	}

	/** The owner reported a failed attempt after a remount. */
	attemptFailed(failure: GenerationFailure): void {
		if (failure === 'device-lost') {
			this.lost();
			return;
		}
		this.failed(failure);
	}

	/** Retry from the unavailable state: a fresh automatic attempt. */
	retry(): void {
		this.attempt = 'auto';
		this.generation += 1;
		this.phase = 'starting';
		this.backend = null;
		this.failure = null;
		this.episodeLosses = 0;
		this.emit();
	}

	dispose(): void {
		this.closeEpisode();
		this.phase = 'disposed';
		this.emit();
	}

	private openEpisode(): void {
		this.episodeOpen = true;
		this.closeEpisodeTimer();
		this.episodeTimer = this.clock.set(() => {
			this.episodeTimer = null;
			if (this.phase !== 'ready') return;
			// Thirty seconds without loss ends the episode: the surface is stable and
			// a later loss starts a new episode with its own single retry.
			this.episodeLosses = 0;
			this.episodeOpen = false;
		}, this.episodeMs);
	}

	private closeEpisode(): void {
		this.episodeOpen = false;
		this.closeEpisodeTimer();
	}

	private closeEpisodeTimer(): void {
		if (this.episodeTimer === null) return;
		this.clock.clear(this.episodeTimer);
		this.episodeTimer = null;
	}

	private emit(): void {
		this.onChange?.(this.snapshot());
	}
}
