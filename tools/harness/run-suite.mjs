#!/usr/bin/env node
/**
 * Run one suite from the merge-gate contract and prove it collected tests.
 *
 * A Vitest suite writes its JSON report and must collect at least one test file
 * and one test; an empty lane is a failure, not a pass. Command suites prove
 * their result with the exit status.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { suiteFor } from './suites.mjs';

const index = process.argv.indexOf('--suite');
if (index < 0 || !process.argv[index + 1]) {
	console.error('run-suite: --suite <name> is required');
	process.exit(2);
}
const name = process.argv[index + 1];
let suite;
try {
	suite = suiteFor(name);
} catch (error) {
	console.error(`run-suite: ${error.message}`);
	process.exit(2);
}

const directory = mkdtempSync(join(tmpdir(), 'biskiq-suite-'));
const report = join(directory, 'report.json');
const shard = process.env.MATRIX_SHARD;
const command =
	suite.kind === 'vitest'
		? [
				...suite.args,
				...(shard ? [`--shard=${shard}`] : []),
				'--reporter=default',
				'--reporter=json',
				`--outputFile.json=${report}`,
			]
		: ['npm', 'run', suite.script];

console.log(`run-suite: ${command.join(' ')}`);
const result = spawnSync(command[0], command.slice(1), {
	cwd: suite.cwd ? join(process.cwd(), suite.cwd) : process.cwd(),
	stdio: 'inherit',
});
if (result.error) {
	rmSync(directory, { recursive: true, force: true });
	console.error(`run-suite: ${result.error.message}`);
	process.exit(1);
}
if (result.status !== 0) {
	rmSync(directory, { recursive: true, force: true });
	console.error(`run-suite: ${name} exited ${result.status}`);
	process.exit(result.status ?? 1);
}

if (suite.kind === 'vitest') {
	let data;
	try {
		data = JSON.parse(readFileSync(report, 'utf8'));
	} catch (error) {
		rmSync(directory, { recursive: true, force: true });
		console.error(`run-suite: ${name} wrote no readable JSON report (${error.message})`);
		process.exit(1);
	}
	const files = Array.isArray(data.testResults) ? data.testResults.length : 0;
	const tests = Number(data.numTotalTests ?? 0);
	if (files === 0 || tests === 0) {
		rmSync(directory, { recursive: true, force: true });
		console.error(`run-suite: ${name} collected ${files} test files and ${tests} tests`);
		process.exit(1);
	}
	console.log(`run-suite: ${name} collected ${files} files, ${tests} tests`);
}
rmSync(directory, { recursive: true, force: true });
