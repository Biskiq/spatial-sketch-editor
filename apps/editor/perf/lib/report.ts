/**
 * Result recording for the on-demand harness (T3.P03.S02).
 *
 * Raw results stay **outside Git**: the result directory defaults to the OS
 * temporary directory and only the acceptance record's summary is committed.
 * Every file names the machine, browser/build/commit, power and cache state, the
 * workload and the limitations, so a number is never separated from its
 * environment.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem, platform, release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Stats } from './stats';
import { formatStats } from './stats';

export type ResultRow = {
	readonly id: string;
	readonly flow: string;
	readonly workload?: string;
	readonly cacheState?: string;
	readonly network?: string;
	readonly browser: string;
	readonly cpuRate: number;
	readonly viewport: string;
	readonly metrics: Readonly<Record<string, number | string | null>>;
	readonly stats?: Readonly<Record<string, Stats>>;
	readonly limitations: readonly string[];
};

export type RunReport = {
	readonly name: string;
	readonly startedAt: string;
	readonly machine: Readonly<Record<string, unknown>>;
	readonly rows: ResultRow[];
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export function resultsDirectory(): string {
	return process.env.PERF_RESULTS_DIR ?? join(process.env.TMPDIR ?? '/tmp', 'biskiq-perf-results');
}

export function commitSha(): string {
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
	} catch {
		return 'unknown';
	}
}

export function machineFacts(): Record<string, unknown> {
	const first = cpus()[0];
	return {
		platform: platform(),
		release: release(),
		cpuModel: first?.model ?? 'unknown',
		cores: cpus().length,
		memoryGiB: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
		node: process.version,
		// Power/thermal state cannot be read from Node portably. The contract's
		// reference rows are owner-run on battery with Low Power Mode off; the
		// operator declares it here and the acceptance record repeats it.
		powerState: process.env.PERF_POWER_STATE ?? 'not recorded (PERF_POWER_STATE unset)'
	};
}

export function startReport(name: string): RunReport {
	return { name, startedAt: new Date().toISOString(), machine: machineFacts(), rows: [] };
}

export function fileReport(report: RunReport): string {
	const directory = resultsDirectory();
	mkdirSync(directory, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const path = join(directory, `${stamp}-${report.name}.json`);
	writeFileSync(
		path,
		JSON.stringify({ ...report, commit: commitSha(), writtenAt: new Date().toISOString() }, null, 2)
	);
	return path;
}

export function formatRow(row: ResultRow): string {
	const parts = [`${row.id} [${row.flow}${row.workload === undefined ? '' : ` · ${row.workload}`}]`];
	if (row.cacheState !== undefined) parts.push(`cache=${row.cacheState}`);
	if (row.network !== undefined) parts.push(`net=${row.network}`);
	parts.push(`browser=${row.browser}`, `cpu=${row.cpuRate}x`);
	for (const [name, stats] of Object.entries(row.stats ?? {})) parts.push(`${name}: ${formatStats(stats)}`);
	for (const [name, value] of Object.entries(row.metrics)) parts.push(`${name}=${String(value)}`);
	return parts.join(' | ');
}
