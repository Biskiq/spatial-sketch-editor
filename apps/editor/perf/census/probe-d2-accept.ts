/**
 * D.2 admission work census (T1.P02.S06 optimize step).
 *
 * Counts the whole-document work one accepted result costs **before it reaches
 * the renderer**: the adapter's `admit` and the host admission half. Both are
 * deterministic, so the counts are the evidence and durations are only a coarse
 * sanity read.
 *
 * Runs unchanged in the pre-change tree: it reaches the units entry through a
 * dynamic import so that a missing (`undefined`) new export falls back to the
 * old call, which is what makes the before/after pair comparable.
 *
 *   PERF_WORKLOAD_DIR=... npx vite-node perf/census/probe-d2-accept.ts grid-L
 */
import { setWorkObserver } from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { loadWorkload, workloadStatus, type WorkloadId } from '../lib/workloads/registry';

const id = (process.argv[2] ?? 'grid-L') as WorkloadId;

if (workloadStatus(id).kind !== 'fresh') {
	console.error(`${id}: workload is not present; run perf/generate-workloads first`);
	process.exit(2);
}

const units = (await import('@portfolio/project-model/units')) as unknown as {
	createUnitAcceptanceAdapter(options?: Record<string, boolean>): {
		admit(input: unknown): Promise<{ kind: string; source?: ProjectEnvelope; canonicalJson?: string; sourceContentId?: string }>;
	};
	validateProjectEnvelope(input: unknown): unknown;
	prepareUnitRuntime(envelope: unknown, options?: unknown): unknown;
	prepareValidatedUnitRuntime?(validated: unknown, options?: unknown): unknown;
	computeEnvelopeSourceContentId(envelope: ProjectEnvelope): Promise<string>;
};

const envelope = JSON.parse(loadWorkload(id).canonicalJson) as ProjectEnvelope;

const counts: Record<string, number> = Object.create(null);
let lockMs = 0;
const spanMs: Record<string, number> = Object.create(null);
setWorkObserver({
	span(name, durationMs) {
		spanMs[name] = (spanMs[name] ?? 0) + durationMs;
	},
	count(name, amount) {
		counts[name] = (counts[name] ?? 0) + amount;
	}
});

// The two admissions one accepted result runs, in the order the editor runs them.
const started = performance.now();
const adapter = units.createUnitAcceptanceAdapter();
const admitted = await adapter.admit(envelope);
if (admitted.kind !== 'admitted') {
	console.error(`admission refused: ${admitted.kind}`);
	process.exit(3);
}
const admitMs = performance.now() - started;

const hostStarted = performance.now();
const validated = units.validateProjectEnvelope(admitted.source) as { success: boolean };
const prepared =
	units.prepareValidatedUnitRuntime !== undefined
		? units.prepareValidatedUnitRuntime!(validated)
		: units.prepareUnitRuntime(admitted.source);
const hostMs = performance.now() - hostStarted;
const digestStarted = performance.now();
await units.computeEnvelopeSourceContentId(admitted.source!);
lockMs = performance.now() - digestStarted;

setWorkObserver(null);
void prepared;

const read = (name: string): number => counts[name] ?? 0;
const report = {
	workload: id,
	validations: read('envelope:validate'),
	serializations: read('envelope:serialize') + read('envelope:serialize-validated'),
	runtimePreparations: read('unit-runtime:prepare') + read('unit-runtime:prepare-validated'),
	admitMs: Number(admitMs.toFixed(1)),
	hostAdmissionMs: Number(hostMs.toFixed(1)),
	digestMs: Number(lockMs.toFixed(1)),
	totalMs: Number((admitMs + hostMs + lockMs).toFixed(1)),
	spans: Object.fromEntries(Object.entries(spanMs).map(([name, ms]) => [name, Number(ms.toFixed(1))])),
	counts
};
console.log(JSON.stringify(report, null, 2));
