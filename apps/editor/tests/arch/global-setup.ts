/**
 * Build the arch lane's one source index per run.
 *
 * Every boundary suite reads production source text. Building the index once
 * here keeps each suite reading it instead of walking the tree again, and a
 * worker loads the file once on its first read.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const SOURCE_INDEX_PATH = 'node_modules/.cache/biskiq/arch-source-index.json';

const SOURCE_ROOTS = ['apps/editor/src', 'packages', 'apps/api/src'];
const SOURCE_FILE = /\.(?:ts|tsx|svelte|js|mjs)$/;

export default function setup(): void {
	const tracked = execFileSync('git', ['ls-files', '-z', ...SOURCE_ROOTS], {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024
	})
		.split('\0')
		.filter((file) => file.length > 0 && SOURCE_FILE.test(file));
	const sources: Record<string, string> = {};
	for (const file of tracked) sources[file] = readFileSync(file, 'utf8');
	mkdirSync(path.dirname(SOURCE_INDEX_PATH), { recursive: true });
	writeFileSync(SOURCE_INDEX_PATH, JSON.stringify(sources));
}
