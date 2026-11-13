/**
 * E0/C0 — the mounted Stage-shell counting helper.
 *
 * One seam installs the **production** work observer (`setWorkObserver` from
 * `@portfolio/layout-core`), enables the existing inert perf flag and receives
 * each renderer the product hands to `perfRenderer`. A test then drives a real
 * production caller — a mounted Stage component, a camera session, the Layout
 * candidate paper builder — and reads the named counts and, where the renderer
 * exposes it, `renderer.info`.
 *
 * Nothing here fabricates a count: every number comes from `countWork` at its
 * production call site. `renderer.info` is three's own per-frame figure for the
 * renderer the product registered; a headless surface without `info` reports
 * `null` rather than an inferred number.
 */
import { setWorkObserver } from '@portfolio/layout-core';
import { perfRenderer } from '$lib/platform/perf-marks';

export type RendererInfo = {
	readonly calls: number | null;
	readonly triangles: number | null;
	readonly geometries: number | null;
	readonly textures: number | null;
};

type RendererLike = {
	render?: unknown;
	info?: {
		render?: { calls?: number; triangles?: number };
		memory?: { geometries?: number; textures?: number };
	};
};

type PerfGlobal = typeof globalThis & {
	__BISKIQ_PERF__?: { enabled?: unknown };
	__BISKIQ_PERF_ON_RENDERER__?: (renderer: object, surface: string) => void;
};

export type StageCounting = {
	/** A snapshot copy of every named count observed so far. */
	counts(): Record<string, number>;
	count(name: string): number;
	/** One renderer's `renderer.info`, or null when the surface has no info. */
	rendererInfo(surface?: string): RendererInfo | null;
	/** The surfaces whose renderer reached the production `perfRenderer` hook. */
	surfaces(): readonly string[];
	reset(): void;
	/** Remove the observer, the perf flag and the renderer hook. Idempotent. */
	stop(): void;
};

let active: StageCounting | null = null;

/**
 * Install one counting seam. Only one may be active: the product owns exactly
 * one work observer, and a second would either double-count or silently replace
 * the first.
 */
export function startStageCounting(): StageCounting {
	if (active !== null) throw new Error('a Stage counting seam is already installed; stop it first');
	const counts: Record<string, number> = Object.create(null);
	const renderers = new Map<string, RendererLike>();
	const target = globalThis as PerfGlobal;
	const previousObserver = setWorkObserver({
		span() {},
		count(name, amount) {
			counts[name] = (counts[name] ?? 0) + amount;
		}
	});
	const previousFlag = target.__BISKIQ_PERF__;
	const previousHook = target.__BISKIQ_PERF_ON_RENDERER__;
	target.__BISKIQ_PERF__ = { enabled: true };
	target.__BISKIQ_PERF_ON_RENDERER__ = (renderer, surface) => {
		renderers.set(surface, renderer as RendererLike);
	};
	let stopped = false;
	const seam: StageCounting = {
		counts: () => ({ ...counts }),
		count: (name) => counts[name] ?? 0,
		rendererInfo(surface = 'stage') {
			const info = renderers.get(surface)?.info;
			if (info === undefined) return null;
			return {
				calls: info.render?.calls ?? null,
				triangles: info.render?.triangles ?? null,
				geometries: info.memory?.geometries ?? null,
				textures: info.memory?.textures ?? null
			};
		},
		surfaces: () => [...renderers.keys()],
		reset() {
			for (const name of Object.keys(counts)) delete counts[name];
			renderers.clear();
		},
		stop() {
			if (stopped) return;
			stopped = true;
			setWorkObserver(previousObserver);
			if (previousFlag === undefined) delete target.__BISKIQ_PERF__;
			else target.__BISKIQ_PERF__ = previousFlag;
			if (previousHook === undefined) delete target.__BISKIQ_PERF_ON_RENDERER__;
			else target.__BISKIQ_PERF_ON_RENDERER__ = previousHook;
			active = null;
		}
	};
	active = seam;
	return seam;
}

/**
 * Hand one renderer to the product's own `perfRenderer` hook.
 *
 * This is the same call the Stage and Preview Canvas factories make; a test uses
 * it for a renderer that is not constructed by a WebGL context. Without the
 * counting seam's flag it returns the renderer and calls no hook.
 */
export function registerCountingRenderer<T extends object>(
	renderer: T,
	surface: 'stage' | 'preview' = 'stage'
): T {
	return perfRenderer(renderer, surface);
}
