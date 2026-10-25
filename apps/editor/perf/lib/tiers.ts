/**
 * Bench tiers, smoke mode and per-window counters (T1.P02.S06 A, C).
 *
 * Every tier-aware flow seeds its project from the precomputed workload cache
 * (A.1, A.2): the canonical JSON under the flow's own project id, admitted in
 * one step through the real admission path. Generating topology inside a
 * measured run is refused by `loadWorkload`.
 *
 * - `PERF_TIERS` selects and orders tiers (default: the fixed peak-first bench
 *   order, A.3). A tier whose workload is blocked (realistic-L until its assets
 *   are approved) is reported as an unrun row with its reason, never skipped
 *   silently.
 * - `PERF_SMOKE=1` is the pre-handover smoke check: one run, no warm-up, one
 *   sample, every row labelled "smoke, not evidence". Counts it reads at a fixed
 *   view and edit are labelled "count, not timing".
 */

import type { Page } from '@playwright/test';

import { DEVICE_SCALE_FACTOR, VIEWPORT } from './config';
import type { FixtureProject } from './fixtures';
import type { ResultRow } from './report';
import { BENCH_TIERS, loadWorkload, workloadJsonFor, workloadStatus, WORKLOADS, type WorkloadId } from './workloads/registry';

export const SMOKE = process.env.PERF_SMOKE === '1';
export const SMOKE_LABEL = 'smoke, not evidence';
export const COUNT_LABEL = 'count, not timing';

/** The museum's fixed View and focus Wall, mirrored for the browser spec; `perf:workloads --verify` pins them. */
export const E5_FIXED_VIEW_LABEL = 'Focus wing — enfilade';
export const E5_FOCUS_WALL_NAME = 'Focus partition';

/** The hard-gated tiers; XL and realistic-L are report-only (A.3). */
export const REPORT_ONLY_TIERS: ReadonlySet<WorkloadId> = new Set(['grid-XL', 'realistic-L']);

/**
 * Workloads a flow may be asked for beyond the bench tiers: the museum and its
 * sweeps, for the optional sweep latency rows (C, E5). Never in the default.
 */
export const SWEEP_LATENCY_TIERS: readonly WorkloadId[] = ['museum', 'sweep-H3', 'sweep-H10', 'sweep-D3', 'sweep-D10'];

export function selectedTiers(allowed: readonly WorkloadId[] = [...BENCH_TIERS, ...SWEEP_LATENCY_TIERS]): WorkloadId[] {
	const requested = process.env.PERF_TIERS?.split(',').map((tier) => tier.trim()).filter(Boolean) as WorkloadId[] | undefined;
	for (const tier of requested ?? []) if (!(tier in WORKLOADS)) throw new Error(`PERF_TIERS names an unknown workload: ${tier}`);
	// Selection never reorders: the bench order is fixed and identical in every pass.
	const order = [...BENCH_TIERS, ...SWEEP_LATENCY_TIERS];
	return order.filter((tier) => allowed.includes(tier) && (requested === undefined ? (BENCH_TIERS as readonly WorkloadId[]).includes(tier) : requested.includes(tier)));
}

export type TierAvailability = { readonly tier: WorkloadId; readonly available: true } | { readonly tier: WorkloadId; readonly available: false; readonly reason: string };

export function tierAvailability(tier: WorkloadId): TierAvailability {
	const status = workloadStatus(tier);
	return status.kind === 'fresh' ? { tier, available: true } : { tier, available: false, reason: status.reason };
}

/** The tier's envelope under `projectId`, shaped like the old in-flow fixture. */
export function tierProject(tier: WorkloadId, projectId: string): FixtureProject & { readonly tier: WorkloadId; readonly contentDigest: string } {
	const workload = loadWorkload(tier);
	const canonicalJson = workloadJsonFor(workload, projectId);
	const envelope = JSON.parse(canonicalJson) as FixtureProject['envelope'];
	return {
		tier,
		size: tier,
		projectId,
		envelope,
		canonicalJson,
		contentDigest: workload.meta.contentDigest,
		facts: { walls: workload.meta.facts.walls, openings: workload.meta.facts.openings, rooms: workload.meta.facts.rooms }
	};
}

export function tierWorkloadLabel(tier: WorkloadId): string {
	const status = workloadStatus(tier);
	if (status.kind !== 'fresh') return `${tier} (${status.kind})`;
	const facts = status.meta.facts;
	return `${tier} (${facts.walls} walls, ${facts.openings} openings, ${facts.rooms} rooms; ${status.meta.contentDigest.slice(0, 19)}…)`;
}

export function tierLimitations(tier: WorkloadId): string[] {
	return [
		...(SMOKE ? [SMOKE_LABEL] : []),
		...(REPORT_ONLY_TIERS.has(tier) ? [`${tier} is report-only (A.3): never a hard row`] : [])
	];
}

/** The row a flow files for a tier it cannot run: reported, never skipped silently. */
export function unrunRow(id: string, flow: string, workload: string, browser: string, reason: string): ResultRow {
	console.log(`${id}: unrun — ${reason}`);
	return {
		id,
		flow,
		workload,
		browser,
		cpuRate: 1,
		viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
		metrics: { unrun: reason },
		limitations: ['unrun tier: reported, not skipped silently']
	};
}

/** In smoke mode one run, no warm-up and one sample; otherwise the contract's counts. */
export function smokeOr<T extends number>(value: T, smokeValue = 1): number {
	return SMOKE ? smokeValue : value;
}

// --- Render counters --------------------------------------------------------

export type RenderCounters = {
	readonly frames: number;
	/** Frames rendered while no input arrived in the window (idle rendering). */
	readonly framesAtRest: number;
	readonly drawCalls: number;
	readonly triangles: number;
	readonly shadowMapRenders: number;
	readonly shadowDrawCalls: number;
	readonly programs: number;
	readonly geometries: number;
	readonly textures: number;
	readonly maxDrawCallsPerFrame: number;
	readonly maxTrianglesPerFrame: number;
};

type CounterWindow = Window & {
	__BISKIQ_PERF_RENDER__?: Record<string, { counters: Record<string, number> }>;
	__BISKIQ_PERF_WORK__?: { spans: Record<string, { count: number; totalMs: number; maxMs: number }>; counts: Record<string, number> };
};

/** Snapshot every surface's cumulative render counters. */
export async function readRenderCounters(page: Page): Promise<Record<string, Record<string, number>>> {
	return page.evaluate(() => {
		const surfaces = (window as CounterWindow).__BISKIQ_PERF_RENDER__ ?? {};
		return Object.fromEntries(Object.entries(surfaces).map(([surface, state]) => [surface, { ...state.counters }]));
	});
}

/** Counters accumulated between two snapshots, per surface; `programs` etc. are levels, not sums. */
export function renderCounterDelta(before: Record<string, Record<string, number>>, after: Record<string, Record<string, number>>): Record<string, RenderCounters> {
	const levels = new Set(['programs', 'geometries', 'textures', 'maxDrawCallsPerFrame', 'maxTrianglesPerFrame']);
	const result: Record<string, RenderCounters> = {};
	for (const [surface, counters] of Object.entries(after)) {
		const base = before[surface] ?? {};
		const delta: Record<string, number> = {};
		for (const [name, value] of Object.entries(counters)) delta[name] = levels.has(name) ? value : value - (base[name] ?? 0);
		result[surface] = delta as RenderCounters;
	}
	return result;
}

/** Window maxima restart at each snapshot so a window reports its own peak. */
export async function resetRenderMaxima(page: Page): Promise<void> {
	await page.evaluate(() => {
		for (const state of Object.values((window as CounterWindow).__BISKIQ_PERF_RENDER__ ?? {})) {
			state.counters.maxDrawCallsPerFrame = 0;
			state.counters.maxTrianglesPerFrame = 0;
		}
	});
}

// --- Work ledger -----------------------------------------------------------

/**
 * Spans carry count and total only. The product ledger's running maximum is not
 * windowed: a window that did not raise it has no exact maximum of its own.
 */
export type WorkSnapshot = {
	readonly spans: Record<string, { count: number; totalMs: number }>;
	readonly counts: Record<string, number>;
};

export async function readWork(page: Page): Promise<WorkSnapshot> {
	return page.evaluate(() => {
		const ledger = (window as CounterWindow).__BISKIQ_PERF_WORK__;
		return ledger === undefined
			? { spans: {}, counts: {} }
			: { spans: Object.fromEntries(Object.entries(ledger.spans).map(([name, span]) => [name, { count: span.count, totalMs: span.totalMs }])), counts: { ...ledger.counts } };
	});
}

/** Per-stage time and work counts inside one measured window. */
export function workDelta(before: WorkSnapshot, after: WorkSnapshot): WorkSnapshot {
	const spans: WorkSnapshot['spans'] = {};
	for (const [name, span] of Object.entries(after.spans)) {
		const base = before.spans[name] ?? { count: 0, totalMs: 0 };
		if (span.count === base.count) continue;
		spans[name] = { count: span.count - base.count, totalMs: span.totalMs - base.totalMs };
	}
	const counts: Record<string, number> = {};
	for (const [name, value] of Object.entries(after.counts)) {
		const delta = value - (before.counts[name] ?? 0);
		if (delta !== 0) counts[name] = delta;
	}
	return { spans, counts };
}

/** Flatten a window's stage times into row metrics (`stage:<name>:ms`, `work:<name>`). */
export function workMetrics(window: WorkSnapshot, runs = 1): Record<string, number> {
	const metrics: Record<string, number> = {};
	for (const [name, span] of Object.entries(window.spans)) {
		metrics[`stage:${name}:ms`] = span.totalMs / runs;
		metrics[`stage:${name}:calls`] = span.count / runs;
	}
	for (const [name, value] of Object.entries(window.counts)) metrics[`work:${name}`] = value / runs;
	return metrics;
}

export function renderMetrics(counters: Record<string, RenderCounters>, runs = 1): Record<string, number> {
	const metrics: Record<string, number> = {};
	for (const [surface, values] of Object.entries(counters)) {
		for (const [name, value] of Object.entries(values)) metrics[`render:${surface}:${name}`] = /^max|programs|geometries|textures/.test(name) ? value : value / runs;
	}
	return metrics;
}

// --- Resident bytes ---------------------------------------------------------

export type ResidentBytes = {
	readonly textures: number;
	/** Bytes as stored (the image's encoded size where known, else its decoded RGBA8 size). */
	readonly textureStoredBytes: number;
	/** Today's GPU format: RGBA8 with a full mip chain (× 4/3). */
	readonly textureGpuBytes: number;
	readonly geometries: number;
	readonly geometryBufferBytes: number;
	readonly shadowMapBytes: number;
	readonly renderTargetBytes: number;
	readonly materials: number;
	readonly meshes: number;
};

/**
 * One traversal of a surface's last rendered scene: the unique textures,
 * geometries and materials it references, the shadow maps of its shadow-casting
 * lights (RGBA8 depth-packed, 4 B/texel) and the renderer's drawing buffer.
 * A census of what the scene holds, read once at a fixed point; never per frame.
 */
export async function readResidentBytes(page: Page, surface: 'stage' | 'preview' = 'stage'): Promise<ResidentBytes | null> {
	return page.evaluate((name) => {
		type Image = { width?: number; height?: number; byteLength?: number; data?: { byteLength?: number } };
		type Texture = { isTexture?: boolean; image?: Image; generateMipmaps?: boolean };
		type Attribute = { array?: { byteLength: number } };
		type Geometry = { attributes?: Record<string, Attribute>; index?: Attribute | null };
		type Node = {
			isMesh?: boolean;
			isLight?: boolean;
			castShadow?: boolean;
			geometry?: Geometry;
			material?: Record<string, unknown> | Record<string, unknown>[];
			shadow?: { mapSize?: { x: number; y: number } };
			traverse(visit: (node: Node) => void): void;
		};
		const refs = (window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { scene: Node; renderer: { getContext(): WebGL2RenderingContext } }> }).__BISKIQ_PERF_RENDER_REFS__;
		const ref = refs?.[name];
		if (ref === undefined) return null;
		const textures = new Set<Texture>();
		const geometries = new Set<Geometry>();
		const materials = new Set<unknown>();
		let meshes = 0;
		let shadowMapBytes = 0;
		ref.scene.traverse((node) => {
			if (node.isLight && node.castShadow && node.shadow?.mapSize) shadowMapBytes += node.shadow.mapSize.x * node.shadow.mapSize.y * 4;
			if (!node.isMesh) return;
			meshes += 1;
			if (node.geometry) geometries.add(node.geometry);
			for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
				materials.add(material);
				for (const value of Object.values(material)) if ((value as Texture | null)?.isTexture) textures.add(value as Texture);
			}
		});
		let textureStoredBytes = 0;
		let textureGpuBytes = 0;
		for (const texture of textures) {
			const image = texture.image ?? {};
			const pixels = (image.width ?? 0) * (image.height ?? 0);
			textureStoredBytes += image.data?.byteLength ?? image.byteLength ?? pixels * 4;
			textureGpuBytes += pixels * 4 * (texture.generateMipmaps === false ? 1 : 4 / 3);
		}
		let geometryBufferBytes = 0;
		for (const geometry of geometries) {
			for (const attribute of Object.values(geometry.attributes ?? {})) geometryBufferBytes += attribute.array?.byteLength ?? 0;
			geometryBufferBytes += geometry.index?.array?.byteLength ?? 0;
		}
		const gl = ref.renderer.getContext();
		// Color + depth/stencil of the drawing buffer; antialiasing adds a multisampled copy.
		const samples = (gl.getContextAttributes()?.antialias ?? false) ? Math.max(1, gl.getParameter(gl.SAMPLES) as number) : 1;
		const renderTargetBytes = gl.drawingBufferWidth * gl.drawingBufferHeight * 8 * (samples > 1 ? samples + 1 : 1);
		return { textures: textures.size, textureStoredBytes, textureGpuBytes, geometries: geometries.size, geometryBufferBytes, shadowMapBytes, renderTargetBytes, materials: materials.size, meshes };
	}, surface);
}

export function residentMetrics(bytes: ResidentBytes | null, prefix: string): Record<string, number> {
	if (bytes === null) return {};
	return Object.fromEntries(Object.entries(bytes).map(([name, value]) => [`${prefix}:resident:${name}`, value]));
}
