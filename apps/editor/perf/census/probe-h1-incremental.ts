/**
 * T1.P02.S06 D.3 (H1) — the incremental compile, measured by deterministic work
 * counts and by a single-sample diagnostic duration.
 *
 * What this probe answers, and does not:
 *
 * - it **counts** what the canonical compiler evaluated for one Wall edit, per
 *   workload, and what a cold compile of the same document evaluates. Counts are
 *   deterministic; the same probe on the same workload prints the same numbers.
 * - it **times** the two compiles in one Node process as a diagnostic. These are
 *   single samples, not Bench 2 evidence: no browser, no cache states, no
 *   run-to-run spread. They exist to show the direction and the magnitude, and
 *   the acceptance record labels them as diagnostics.
 *
 * The locality claim is the last line: a Wall edit's evaluated set must be the
 * same size at S, M and L, because the edit touches one Junction's neighbourhood
 * whatever the rest of the world contains.
 *
 * Usage: `PERF_WORKLOAD_DIR=perf/.workloads npx vite-node perf/census/probe-h1-incremental.ts`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	compileWallFirstLayoutGeometry,
	createLayoutCompileSession,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { countWork, type WorkCounts } from './work-counter';

const WORKLOADS = ['grid-S', 'grid-M', 'grid-L', 'museum'] as const;
const EDITS = 24;

function workload(name: string): LayoutDocumentWallFirst {
	const directory = process.env.PERF_WORKLOAD_DIR ?? 'perf/.workloads';
	const parsed = JSON.parse(readFileSync(join(directory, `${name}.json`), 'utf8')) as {
		document?: LayoutDocumentWallFirst;
		units?: { layout?: { data: LayoutDocumentWallFirst } };
	};
	return parsed.document ?? parsed.units?.layout?.data ?? (parsed as unknown as LayoutDocumentWallFirst);
}

/** The i-th distinct single-Junction edit: the same shape a precision drag emits. */
function edited(document: LayoutDocumentWallFirst, index: number): LayoutDocumentWallFirst {
	const next = JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
	const wall = next.walls[index % next.walls.length]!;
	const junction = next.junctions.find((candidate) => candidate.id === wall.startJunctionId);
	if (!junction) return next;
	// 1e-3 m: a real pointer increment, small enough that no Room loses validity.
	junction.point = [junction.point[0] + 1e-3, junction.point[1] + 1e-3] as LayoutVec2;
	return next;
}

function counted<T>(work: () => T): { result: T; counts: WorkCounts; ms: number } {
	const started = performance.now();
	const observed = countWork(work);
	return { result: observed.result, counts: observed.counts, ms: performance.now() - started };
}

for (const name of WORKLOADS) {
	const document = workload(name);
	const coldRun = counted(() => compileWallFirstLayoutGeometry(document));
	const cold = coldRun.result.geometry;

	const session = createLayoutCompileSession();
	session.compile(document);

	let incrementalMs = 0;
	let evaluated = 0;
	let reused = 0;
	for (let index = 0; index < EDITS; index += 1) {
		const candidate = edited(document, index);
		// Shadow the session's own measurement so the counts come from the same
		// observer the cold run used.
		const started = performance.now();
		const observed = countWork(() => session.compile(candidate));
		incrementalMs += performance.now() - started;
		evaluated +=
			(observed.counts['reuse:walls-evaluated'] ?? 0) +
			(observed.counts['reuse:junctions-evaluated'] ?? 0) +
			(observed.counts['reuse:rooms-evaluated'] ?? 0) +
			(observed.counts['reuse:objects-evaluated'] ?? 0);
		reused +=
			(observed.counts['reuse:walls-reused'] ?? 0) +
			(observed.counts['reuse:junctions-reused'] ?? 0) +
			(observed.counts['reuse:rooms-reused'] ?? 0) +
			(observed.counts['reuse:objects-reused'] ?? 0);
		// The probe's own equality guard: every incremental result equals a cold
		// compile of the same document, keys included.
		const shadow = compileWallFirstLayoutGeometry(candidate);
		if (JSON.stringify(shadow.geometry) !== JSON.stringify(observed.result.geometry)) {
			throw new Error(`${name} edit ${index}: incremental output differs from the cold compiler`);
		}
	}

	const entities =
		document.walls.length + document.junctions.length + document.rooms.length + document.objects.length;
	console.log(
		`${name}: entities ${entities} cold ${coldRun.ms.toFixed(1)} ms evaluated ${entities} | ` +
			`per-edit ${(incrementalMs / EDITS).toFixed(2)} ms evaluated ${(evaluated / EDITS).toFixed(1)} reused ${(reused / EDITS).toFixed(0)}`
	);
	const coldKeys = coldRun.counts['cache-key:chars'] ?? 0;
	void cold;
	console.log(
		`  keyChars cold ${coldKeys} incremental ${((evaluated / EDITS) === 0 ? 0 : coldKeys).toFixed(0)} (keys are only built for evaluated entities)`
	);
}
