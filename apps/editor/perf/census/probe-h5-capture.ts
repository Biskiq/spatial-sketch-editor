/**
 * D.4/H5 capture-work census (T1.P02.S06 optimize step).
 *
 * One accepted result is captured twice in the coordinator: once as the
 * candidate (the guard clone, unchanged here) and once as the installed state
 * plus its history entry. This probe measures the second one, the capture, both
 * ways on the same admitted source:
 *
 * - **copy** — today's capture: `freezeF4Data(structuredClone(state))`;
 * - **share** — the adapter's content-identity capture: reuse the baseline's own
 *   immutable units for every unit the edit did not change, then freeze.
 *
 * Counts are `f4:clone` / `f4:freeze-object` from the package's observer. Retained
 * heap is deliberately NOT reported: a single `gc()`-then-sample delta in Node
 * reads negative as often as positive here, which is noise, not a measurement.
 * This is a disposable diagnostic, never a benchmark.
 *
 *   PERF_WORKLOAD_DIR=... npx vite-node perf/census/probe-h5-capture.ts grid-L
 */
import { setWorkObserver } from '@portfolio/layout-core';
import { freezeF4Data, immutableF4Data } from '@portfolio/project-model';
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
		shareUnchanged?(captured: ProjectEnvelope, baseline: ProjectEnvelope): ProjectEnvelope;
	};
	serializeProjectEnvelope(envelope: ProjectEnvelope): string;
};
const { serializeProjectEnvelope } = units;

const counts: Record<string, number> = Object.create(null);
setWorkObserver({
	span() {},
	count(name, amount) {
		counts[name] = (counts[name] ?? 0) + amount;
	}
});

function reset(): void {
	for (const key of Object.keys(counts)) delete counts[key];
}

const adapter = units.createUnitAcceptanceAdapter();
const envelope = JSON.parse(loadWorkload(id).canonicalJson) as ProjectEnvelope;
const baseline = await adapter.admit(envelope);
if (baseline.kind !== 'admitted') process.exit(3);

// The edit: one authored Layout change — the common Wall edit, which leaves the
// Scene, Camera, Experience and Resources units untouched.
const editedEnvelope = JSON.parse(loadWorkload(id).canonicalJson) as ProjectEnvelope;
editedEnvelope.units.layout.data.floor.name = `${editedEnvelope.units.layout.data.floor.name} (edited)`;
const edited = await adapter.admit(editedEnvelope);
if (edited.kind !== 'admitted') process.exit(4);
const capturedSource = edited.source!;
const canonicalJson = edited.canonicalJson!;
const state = { source: capturedSource, canonicalJson, sourceContentId: edited.sourceContentId!, operationId: 'probe', blockingIssues: [], correspondence: [] };

reset();
const copyStarted = performance.now();
// The coordinator's capture before D.4/H5: one `immutableF4Data` of the state
// (`f4:clone` then a deep freeze).
immutableF4Data(state);
const copyMs = performance.now() - copyStarted;
const copyCounts = { ...counts };

reset();
const shareStarted = performance.now();
const shared = adapter.shareUnchanged ? adapter.shareUnchanged(capturedSource, baseline.source!) : capturedSource;
freezeF4Data({ ...state, source: shared });
const shareMs = performance.now() - shareStarted;
const shareCounts = { ...counts };

setWorkObserver(null);

const retained = (source: ProjectEnvelope): string =>
	['layout', 'scene', 'camera', 'experience', 'resources']
		.map((domain) => {
			const unit = (source.units as Record<string, unknown>)[domain];
			return unit === (baseline.source!.units as Record<string, unknown>)[domain] ? `${domain}:shared` : `${domain}:copied`;
		})
		.join(' ');

console.log(
	JSON.stringify(
		{
			workload: id,
			copy: { clones: copyCounts['f4:clone'] ?? 0, frozenObjects: copyCounts['f4:freeze-object'] ?? 0, ms: Number(copyMs.toFixed(1)) },
			share: {
				clones: shareCounts['f4:clone'] ?? 0,
				frozenObjects: shareCounts['f4:freeze-object'] ?? 0,
				ms: Number(shareMs.toFixed(1)),
				units: retained(shared)
			},
			// The differential: sharing may not change a byte of the captured state, and
			// the shared value must copy to the same bytes as the recorded ones.
			identical: serializeProjectEnvelope(shared) === canonicalJson,
			identicalCopied: serializeProjectEnvelope(structuredClone(shared) as ProjectEnvelope) === canonicalJson
		},
		null,
		2
	)
);
