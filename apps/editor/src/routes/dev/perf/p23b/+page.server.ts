import { execFileSync } from 'node:child_process';
import { cpus, machine, release, totalmem } from 'node:os';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';

export function load() {
	if (!dev) error(404, 'Not found');
	const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
	const systemVersion = process.platform === 'darwin'
		? `${execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim()} (build ${execFileSync('sw_vers', ['-buildVersion'], { encoding: 'utf8' }).trim()})`
		: `${process.platform} ${release()}`;
	return {
		commitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
		policyCommitSha: execFileSync('git', ['rev-parse', 'c11938fe'], { cwd: root, encoding: 'utf8' }).trim(),
		treeDirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0,
		machine: `${machine()} / ${cpus()[0]?.model ?? 'unknown CPU'} / ${cpus().length} logical CPUs / ${(totalmem() / 1024 ** 3).toFixed(0)} GB RAM`,
		operatingSystem: systemVersion,
		nodeVersion: process.version
	};
}
