/**
 * The S06 workload registry and its git-ignored, regenerated cache (T1.P02.S06 A.1, B).
 *
 * A workload is one canonical project envelope, built once by
 * `perf/generate-workloads.ts` through the public planners and T3's public
 * operations, admitted through the real Stage admission, and written here. Its
 * **input key** hashes the generator inputs, the current format numbers and the
 * generator's own source, so any change to what would be generated makes the
 * cached file stale. A measured run only reads the cache: a missing or stale
 * workload refuses the run with the regeneration command, and a measured run
 * never rebuilds topology through planners.
 *
 * Cache files are derived artifacts, never authored product truth, and never
 * hand-edited: `<id>.json` (canonical envelope text) and `<id>.meta.json`.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	LAYOUT_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_ENVELOPE_FORMAT_VERSION
} from '@portfolio/project-model/units';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PERF_ROOT = resolve(HERE, '../..');
export const WORKLOAD_CACHE_DIR = process.env.PERF_WORKLOAD_DIR ?? join(PERF_ROOT, '.workloads');

/** Bench tiers (A.3) plus the report-only census, sweep and realistic workloads (B). */
export type WorkloadId =
	| 'grid-S'
	| 'grid-M'
	| 'grid-L'
	| 'grid-XL'
	| 'museum'
	| 'sweep-H3'
	| 'sweep-H10'
	| 'sweep-D3'
	| 'sweep-D10'
	| 'realistic-L';

export type WorkloadSpec = {
	readonly id: WorkloadId;
	readonly projectId: string;
	readonly name: string;
	/** Generator inputs; part of the input key. */
	readonly params: Readonly<Record<string, string | number | boolean>>;
	/** Why it is not built, when it cannot be built on this tree. */
	readonly blocked?: string;
};

export const WORKLOADS: Readonly<Record<WorkloadId, WorkloadSpec>> = {
	'grid-S': { id: 'grid-S', projectId: 'perf-grid-s', name: 'Perf S pavilion (grid-3)', params: { kind: 'grid', k: 3 } },
	'grid-M': { id: 'grid-M', projectId: 'perf-grid-m', name: 'Perf M pavilion (grid-7)', params: { kind: 'grid', k: 7 } },
	'grid-L': { id: 'grid-L', projectId: 'perf-grid-l', name: 'Perf L museum wing (grid-14)', params: { kind: 'grid', k: 14 } },
	'grid-XL': { id: 'grid-XL', projectId: 'perf-grid-xl', name: 'Perf XL stress (grid-20)', params: { kind: 'grid', k: 20 } },
	museum: { id: 'museum', projectId: 'perf-museum', name: 'Perf museum-shaped census layout', params: { kind: 'museum' } },
	'sweep-H3': { id: 'sweep-H3', projectId: 'perf-sweep-h3', name: 'Perf sweep H ×3', params: { kind: 'sweep', variant: 'H', factor: 3 } },
	'sweep-H10': { id: 'sweep-H10', projectId: 'perf-sweep-h10', name: 'Perf sweep H ×10', params: { kind: 'sweep', variant: 'H', factor: 10 } },
	'sweep-D3': { id: 'sweep-D3', projectId: 'perf-sweep-d3', name: 'Perf sweep D ×3', params: { kind: 'sweep', variant: 'D', factor: 3 } },
	'sweep-D10': { id: 'sweep-D10', projectId: 'perf-sweep-d10', name: 'Perf sweep D ×10', params: { kind: 'sweep', variant: 'D', factor: 10 } },
	'realistic-L': {
		id: 'realistic-L',
		projectId: 'perf-realistic-l',
		name: 'Perf realistic L (grid-14 + approved derivatives)',
		params: { kind: 'realistic', k: 14 },
		blocked:
			'needs owner approval of each CC0/permissive GLB source (plan B) and the creator-import@1 seeding on an isolated per-lane API stack; see perf/README.md "Realistic-L"'
	}
};

/** The bench order, peak first (A.3): realistic-L, L, then the hard S/M tiers; XL is report-only. */
export const BENCH_TIERS: readonly WorkloadId[] = ['realistic-L', 'grid-L', 'grid-XL', 'grid-M', 'grid-S'];

/**
 * Generator sources whose text is part of a workload's input key, per kind.
 * The CLI driver only admits and writes, so it is not content-bearing.
 */
const GENERATOR_SOURCES: Readonly<Record<string, readonly string[]>> = {
	grid: ['lib/workloads/grid.ts', 'lib/workloads/build.ts'],
	museum: [
		'lib/workloads/grid.ts',
		'lib/workloads/build.ts',
		'lib/workloads/plan-lines.ts',
		'lib/workloads/museum-layout.ts',
		'lib/workloads/museum-content.ts'
	],
	realistic: ['lib/workloads/grid.ts', 'lib/workloads/build.ts']
};
export const FORMAT_NUMBERS = {
	envelope: UNIT_ENVELOPE_FORMAT_VERSION,
	layout: LAYOUT_UNIT_FORMAT_VERSION,
	scene: SCENE_UNIT_FORMAT_VERSION,
	camera: CAMERA_UNIT_FORMAT_VERSION,
	experience: EXPERIENCE_UNIT_FORMAT_VERSION,
	resources: RESOURCE_UNIT_FORMAT_VERSION
} as const;

function sha256(text: string | Uint8Array): string {
	return `sha256-${createHash('sha256').update(text).digest('hex')}`;
}

export function workloadInputKey(spec: WorkloadSpec): string {
	const kind = String(spec.params.kind);
	const paths = GENERATOR_SOURCES[kind === 'sweep' ? 'museum' : kind] ?? [];
	const sources = paths.map((path) => [path, sha256(readFileSync(join(PERF_ROOT, path)))]);
	return sha256(JSON.stringify({ id: spec.id, projectId: spec.projectId, name: spec.name, params: spec.params, formats: FORMAT_NUMBERS, sources }));
}

export type WorkloadFacts = {
	readonly walls: number;
	readonly junctions: number;
	readonly openings: number;
	readonly rooms: number;
	readonly entities: number;
	readonly views: number;
	readonly stops: number;
	readonly bytes: number;
};

export type WorkloadMeta = {
	readonly id: WorkloadId;
	readonly projectId: string;
	readonly inputKey: string;
	/** SHA-256 of the cached canonical JSON bytes: the fixture digest a report cites. */
	readonly contentDigest: string;
	readonly facts: WorkloadFacts;
	readonly focusWallId?: string;
	readonly generatedAt: string;
	readonly generationMs: number;
};

export type LoadedWorkload = {
	readonly spec: WorkloadSpec;
	readonly meta: WorkloadMeta;
	readonly canonicalJson: string;
};

export function workloadPaths(id: WorkloadId): { json: string; meta: string } {
	return { json: join(WORKLOAD_CACHE_DIR, `${id}.json`), meta: join(WORKLOAD_CACHE_DIR, `${id}.meta.json`) };
}

export type WorkloadStatus =
	| { readonly kind: 'fresh'; readonly meta: WorkloadMeta }
	| { readonly kind: 'missing' | 'stale' | 'corrupt' | 'blocked'; readonly reason: string };

export function workloadStatus(id: WorkloadId): WorkloadStatus {
	const spec = WORKLOADS[id];
	if (spec.blocked !== undefined) return { kind: 'blocked', reason: spec.blocked };
	const paths = workloadPaths(id);
	if (!existsSync(paths.json) || !existsSync(paths.meta)) return { kind: 'missing', reason: `${id} is not generated` };
	const meta = JSON.parse(readFileSync(paths.meta, 'utf8')) as WorkloadMeta;
	if (meta.inputKey !== workloadInputKey(spec)) {
		return { kind: 'stale', reason: `${id} was generated from different inputs, formats or generator source` };
	}
	if (sha256(readFileSync(paths.json)) !== meta.contentDigest) {
		return { kind: 'corrupt', reason: `${id}.json does not match its recorded content digest` };
	}
	return { kind: 'fresh', meta };
}

export const REGENERATE_COMMAND = 'npm run perf:workloads --workspace @portfolio/editor';

/** Read a fresh workload or refuse: a measured run never generates. */
export function loadWorkload(id: WorkloadId): LoadedWorkload {
	const status = workloadStatus(id);
	if (status.kind !== 'fresh') throw new Error(`workload ${id}: ${status.reason}. Run \`${REGENERATE_COMMAND}\` first.`);
	return { spec: WORKLOADS[id], meta: status.meta, canonicalJson: readFileSync(workloadPaths(id).json, 'utf8') };
}

/**
 * The same envelope under another project id, for flows whose entry mints the
 * id (F13's New Project). Only the id token changes; it is setup, outside every
 * measured window, and the result is admitted like any other source.
 */
export function workloadJsonFor(workload: LoadedWorkload, projectId: string): string {
	return workload.canonicalJson.split(JSON.stringify(workload.spec.projectId).slice(1, -1)).join(projectId);
}

export function contentDigestOf(text: string): string {
	return sha256(text);
}
