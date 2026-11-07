import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../helpers/docs-references';

const STATUS = join(REPO_ROOT, 'tools/harness/status.mjs');
const LEDGER = join(REPO_ROOT, 'capabilities.json');
const MAIN = 'a'.repeat(40);
const TEMP = mkdtempSync(join(tmpdir(), 'harness-focus-'));

afterAll(() => rmSync(TEMP, { recursive: true, force: true }));

function fixture(name: string, focus: string | null) {
	const directory = join(TEMP, name);
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, 'capabilities.json'), readFileSync(LEDGER, 'utf8'));
	if (focus !== null) writeFileSync(join(directory, 'focus.md'), focus);
	return directory;
}

function run(directory: string, extra: string[] = []) {
	return execFileSync(
		process.execPath,
		[STATUS, '--repo-root', directory, '--offline', '--main-head', MAIN, ...extra],
		{ encoding: 'utf8' }
	);
}

describe('status focus and hold reporting', () => {
	it('prints priority before an active hold, including its end condition', () => {
		const directory = fixture(
			'hold',
			[
				'# Focus',
				'',
				'**Current priority:** prototype cleanup.',
				'',
				'**Hold:** no new claims until the owner resolves storage scope; ends on a decision.',
				''
			].join('\n')
		);
		const output = run(directory);
		expect(output).toMatch(/^focus\s+prototype cleanup\.$/m);
		expect(output).toMatch(
			/^hold\s+no new claims until the owner resolves storage scope; ends on a decision\.$/m
		);
		expect(output.indexOf('focus')).toBeLessThan(output.indexOf('hold'));
	});

	it('exposes the same priority and hold object to JSON consumers', () => {
		const directory = fixture(
			'json',
			[
				'# Focus',
				'',
				'**Current priority:** prototype cleanup.',
				'',
				'**Hold:** no new claims until the owner resolves storage scope; ends on a decision.',
				''
			].join('\n')
		);
		const report = JSON.parse(run(directory, ['--json']));
		expect(report.focus).toEqual({
			priority: 'prototype cleanup.',
			hold: 'no new claims until the owner resolves storage scope; ends on a decision.'
		});
	});

	it('treats a missing focus file as absent, not a hold or failure', () => {
		const directory = fixture('none', null);
		const output = run(directory);
		expect(output).not.toMatch(/^hold\s/m);
		const report = JSON.parse(run(directory, ['--json']));
		expect(report.focus).toBeNull();
	});
});
