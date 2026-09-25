import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serializeBaseline } from './bench-report';
import { BASELINE_PATH, recordBaseline } from './record-baseline';
import type { P23BBrowserRunReport } from './bench-types';

/**
 * CLI entry for `npm run bench:record`. Runs `recordBaseline()` and writes the
 * version-5 baseline to `g3-baseline.json`. Kept separate from the pure
 * `record-baseline.ts` module so importing the recorder (in tests or tooling)
 * never has a write side effect. `--full` includes the slow 1,000-room tier.
 */

const full = process.argv.includes('--full');
const reportFlag = process.argv.indexOf('--p23b-browser-report');
const reportPath = reportFlag >= 0 ? process.argv[reportFlag + 1] : undefined;
if (!reportPath) throw new Error('Pass --p23b-browser-report <path> from /dev/perf/p23b before writing the v5 baseline');
const p23bBrowserReport = JSON.parse(readFileSync(resolve(reportPath), 'utf8')) as P23BBrowserRunReport;
const baseline = recordBaseline({ full, p23bBrowserReport, requireCleanHead: true });
writeFileSync(BASELINE_PATH, serializeBaseline(baseline));

const first = baseline.tiers[0]?.provenance;
const tierSummary = baseline.tiers.map((tier) => `${tier.tier}:${tier.samples.length}`).join(' ');
console.log(`[record-baseline] wrote ${BASELINE_PATH}`);
console.log(`[record-baseline] method v${baseline.methodVersion} | tiers ${tierSummary}`);
console.log(
	`[record-baseline] P23B workloads ${baseline.workloads?.length ?? 0} | interaction fixtures ${(baseline.interactionFixtures ?? []).map((capture) => `${capture.fixtureId}:${Object.keys(capture.interactions).length}`).join(' ')}`
);
console.log(
	`[record-baseline] sha=${first?.commitSha} treeDirty=${first?.treeDirty} contentHash=${first?.contentHash}`
);
