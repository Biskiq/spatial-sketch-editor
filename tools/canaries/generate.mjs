#!/usr/bin/env node
/**
 * Regenerate `tools/canaries/patches/` from `catalog.json`.
 *
 * Each patch is one JSON record: the file, the exact literal to replace, the
 * replacement and the tests that must fail. The generator refuses a mutation
 * whose target text does not occur exactly once, so a patch cannot silently
 * decay when its production file moves.
 *
 * Usage: node tools/canaries/generate.mjs [--check]
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PATCH_DIR = resolve(REPO_ROOT, 'tools/canaries/patches');
const catalog = JSON.parse(readFileSync(resolve(REPO_ROOT, 'tools/canaries/catalog.json'), 'utf8'));
const check = process.argv.includes('--check');

const ids = new Set();
const problems = [];
for (const canary of catalog) {
	if (!/^[a-z0-9-]+$/.test(canary.id)) problems.push(`${canary.id}: id must be kebab-case`);
	if (ids.has(canary.id)) problems.push(`${canary.id}: duplicate id`);
	ids.add(canary.id);
	if (!canary.tests?.length) problems.push(`${canary.id}: at least one test is required`);
	const source = readFileSync(resolve(REPO_ROOT, canary.file), 'utf8');
	const occurrences = source.split(canary.find).length - 1;
	if (occurrences !== 1) {
		problems.push(`${canary.id}: ${canary.file} has ${occurrences} matches for the find text`);
	}
	if (canary.find === canary.replace) problems.push(`${canary.id}: replacement is a no-op`);
}
if (catalog.length < 40)
	problems.push(`catalog has ${catalog.length} canaries; the canary contract requires at least 40`);
if (problems.length > 0) {
	console.error(`canary catalog is invalid:\n- ${problems.join('\n- ')}`);
	process.exit(1);
}

if (!check) {
	mkdirSync(PATCH_DIR, { recursive: true });
	for (const name of readdirSync(PATCH_DIR)) {
		if (name.endsWith('.json')) rmSync(resolve(PATCH_DIR, name));
	}
	for (const canary of catalog) {
		writeFileSync(resolve(PATCH_DIR, `${canary.id}.json`), `${JSON.stringify(canary, null, 2)}\n`);
	}
}
console.log(
	`canaries: ${catalog.length} patches ${check ? 'validated' : 'written'} (${catalog.filter((entry) => entry.kind === 'api').length} API)`,
);
