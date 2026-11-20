import type { GenerationFactory, RendererAttempt } from './generation-owner';

/** The renderer shape the candidates need; the real Three renderer is wider. */
export type HostRenderer = {
	render(...args: unknown[]): unknown;
	dispose?(): unknown;
	readonly [property: string]: unknown;
};

export type CanvasHostFactory = GenerationFactory<HostRenderer>;

/**
 * The one small child both candidates mount after readiness. Its callbacks are
 * observations, never state: the fixture proves that a pre-ready mount cannot
 * happen and that a remount keeps the caller's external session untouched.
 */
export type HostProbe = {
	readonly session?: unknown;
	onMount?(): void;
	onFrame?(): void;
};

export type HostAttempt = RendererAttempt;
