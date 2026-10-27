/**
 * D.1 compiled-output differential and work census (T1.P02.S06 optimize step).
 *
 * Compiles every cached workload document through the canonical compiler and
 * records, per workload:
 *
 * - `facts`: a digest of the compiled output with every `cacheKey` removed —
 *   the meaningful equality differential. It must match the pre-change
 *   revision exactly;
 * - `keys`: a digest of the cache keys alone, plus their count;
 * - named work counts (`cache-key:chars`, pair visits, lookups) and the
 *   inclusive `compile` span.
 *
 * Disposable diagnostic, not a bench: it sizes one hand calculation and is
 * then discarded. Only Bench 2 confirms a win.
 *
 *   PERF_WORKLOAD_DIR=... npx vite-node perf/census/probe-d1-differential.ts out.json
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import {
	compileWallFirstLayoutGeometry,
	setWorkObserver,
	validateWallFirstOpeningSet,
	validateWallFirstTopology
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { loadWorkload, workloadStatus, type WorkloadId } from '../lib/workloads/registry';

const IDS: readonly WorkloadId[] = ['grid-S', 'grid-M', 'grid-L', 'museum', 'sweep-H3', 'sweep-D3', 'sweep-C3'];

function sha(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

/** Deep copy with every `cacheKey` removed, keys sorted so the encoding is stable. */
function withoutKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(withoutKeys);
	if (value === null || typeof value !== 'object') return value;
	const out: Record<string, unknown> = {};
	for (const key of Object.keys(value as Record<string, unknown>).sort()) {
		if (key === 'cacheKey') continue;
		out[key] = withoutKeys((value as Record<string, unknown>)[key]);
	}
	return out;
}

function collectKeys(value: unknown, out: string[]): void {
	if (Array.isArray(value)) {
		for (const entry of value) collectKeys(entry, out);
		return;
	}
	if (value === null || typeof value !== 'object') return;
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		if (key === 'cacheKey') out.push(String(entry));
		else collectKeys(entry, out);
	}
}

const result: Record<string, unknown> = {};
for (const id of IDS) {
	if (workloadStatus(id).kind !== 'fresh') continue;
	const workload = loadWorkload(id);
	const document = (JSON.parse(workload.canonicalJson) as ProjectEnvelope).units.layout.data;
	const counts: Record<string, number> = Object.create(null);
	let compileMs = 0;
	setWorkObserver({
		span(name, durationMs) {
			if (name === 'compile') compileMs += durationMs;
		},
		count(name, amount) {
			counts[name] = (counts[name] ?? 0) + amount;
		}
	});
	const started = performance.now();
	const compiled = compileWallFirstLayoutGeometry(document);
	const wall = performance.now() - started;
	setWorkObserver(null);

	const keys: string[] = [];
	collectKeys(compiled.geometry, keys);
	// The topology gate and the Opening set are the other two whole-document
	// passes a Wall edit runs; measure their counts and wall time too.
	const gateCounts: Record<string, number> = Object.create(null);
	setWorkObserver({
		span() {},
		count(name, amount) {
			gateCounts[name] = (gateCounts[name] ?? 0) + amount;
		}
	});
	const gateStarted = performance.now();
	validateWallFirstTopology(document);
	const gateMs = performance.now() - gateStarted;
	const openingStarted = performance.now();
	validateWallFirstOpeningSet(document);
	const openingMs = performance.now() - openingStarted;
	setWorkObserver(null);

	const derived = {
		compiles: counts.compile ?? 0,
		cacheKeyChars: counts['cache-key:chars'] ?? 0,
		cacheKeyJsonChars: counts['cache-key:json-chars'] ?? 0,
		cacheKeysBuilt: counts['cache-key:built'] ?? 0,
		pairsRoomOpening: counts['pairs:room-opening'] ?? 0,
		pairsWallOpening: counts['pairs:wall-opening'] ?? 0,
		pairsWallAabb: counts['pairs:wall-aabb'] ?? 0,
		pairsObjectRoom: counts['pairs:object-room'] ?? 0,
		lookupJunctions: counts['lookup:junctions'] ?? 0,
		compileSpanMs: Number(compileMs.toFixed(1)),
		totalMs: Number(wall.toFixed(1)),
		topologyPairsWall: gateCounts['pairs:wall-wall'] ?? 0,
		topologyPairsJunction: gateCounts['pairs:junction-junction'] ?? 0,
		topologyPairsCurve: gateCounts['pairs:wall-wall-curve'] ?? 0,
		topologyLookupJunctions: gateCounts['lookup:junctions'] ?? 0,
		topologyMs: Number(gateMs.toFixed(1)),
		openingSetMs: Number(openingMs.toFixed(1))
	};
	result[id] = {
		facts: sha(JSON.stringify(withoutKeys(compiled.geometry))),
		keys: sha(keys.join('|')),
		keyCount: keys.length,
		derived
	};
	console.log(
		`${id}: facts ${String(result[id] && (result[id] as { facts: string }).facts).slice(0, 12)} keys ${keys.length} keyChars ${derived.cacheKeyChars} joinPairs ${derived.pairsRoomOpening + derived.pairsWallOpening + derived.pairsWallAabb + derived.pairsObjectRoom} compile ${derived.totalMs} ms | topoPairs ${derived.topologyPairsWall}/${derived.topologyPairsJunction}/${derived.topologyPairsCurve} lookups ${derived.topologyLookupJunctions} topo ${derived.topologyMs} ms openings ${derived.openingSetMs} ms`
	);
}
writeFileSync(process.argv[2] ?? '/tmp/d1-differential.json', `${JSON.stringify(result, null, 2)}\n`);
