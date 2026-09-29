/**
 * Documentation cross-reference gate (arch lane).
 *
 * Durable repository invariant: every Markdown document resolves its own
 * cross-references. Two failures motivated it, both found by hand in review of
 * the P26 visual-language reconciliation — a section heading swallowed by an
 * insertion (so every `§5` pointer died) and a router path one directory level
 * short. Nothing compiles a `docs/` reference, so nothing else can catch them.
 *
 * Run whole (part of `npm run test:arch`, never path-gated), or alone:
 *
 *   cd apps/editor && npx vitest run --config vitest.arch.config.ts tests/docs
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	REPO_ROOT,
	anchorsOf,
	extractReferences,
	formatFindings,
	markdownFiles,
	normalizeTarget,
	resolveReference,
	scanDocumentation,
	slugify
} from '../helpers/docs-references';

describe('documentation references', () => {
	it('resolves every relative link, written path and section anchor in the tree', () => {
		const findings = scanDocumentation();
		if (findings.length > 0) console.log(`\n${formatFindings(findings)}\n`);
		expect(findings).toEqual([]);
	});

	it('walks a tree large enough for the gate to mean something', () => {
		// A silent zero-file walk would make the assertion above vacuous.
		expect(markdownFiles().length).toBeGreaterThan(100);
	});

	it('cannot silently lose the documents it exists to protect', () => {
		for (const path of [
			'docs/README.md',
			'AGENTS.md',
			'docs/reference/design-system/editor-shell-and-visual-system.md'
		]) {
			expect(existsSync(resolve(REPO_ROOT, path))).toBe(true);
		}
	});
});

describe('the reference grammar', () => {
	it('finds links and definitions in prose but ignores them inside code fences', () => {
		const source = [
			'[real](./reference/architecture.md)',
			'',
			'```ts',
			'const value = map[key](token);',
			'```',
			'',
			'[label]: ./reference/north-star.md'
		].join('\n');
		const references = extractReferences(source);
		expect(references.map((reference) => reference.raw)).toEqual([
			'./reference/architecture.md',
			'./reference/north-star.md'
		]);
		expect(references.map((reference) => reference.line)).toEqual([1, 7]);
	});

	it('reads a written path inside a text block, which is how routers route', () => {
		const source = [
			'```text',
			'EXECUTION: the baton is F',
			'           (→ ../operations/current.md). T1 planning follows.',
			'```',
			'',
			'and `docs/README.md` is the entry point'
		].join('\n');
		expect(extractReferences(source).map((reference) => [reference.line, reference.raw])).toEqual([
			[3, '../operations/current.md'],
			[6, 'docs/README.md']
		]);
	});

	it('does not treat illustrative patterns or code as paths', () => {
		const source = [
			'write to `docs/roadmap/<phase>/README.md`',
			'run `apps/editor/tests/**/*.test.ts`',
			'`npm run test:arch`',
			'`../reference/decisions/`',
			'a bare `reference/architecture.md` without a relative prefix is prose'
		].join('\n');
		expect(extractReferences(source)).toEqual([]);
	});

	it('strips link decoration: angle brackets and titles', () => {
		expect(normalizeTarget('<./reports/final handoff.txt>')).toBe('./reports/final handoff.txt');
		expect(normalizeTarget('./docs/README.md "the router"')).toBe('./docs/README.md');
		expect(normalizeTarget('  ./docs/README.md  ')).toBe('./docs/README.md');
		expect(normalizeTarget('<unterminated')).toBe('');
	});

	it('slugs headings the way GitHub does, including em dashes and duplicates', () => {
		expect(slugify('## 0.7 Desired visual language — folded from the accepted P26 demo (2026-09-29)')).toBe(
			'07-desired-visual-language--folded-from-the-accepted-p26-demo-2026-09-29'
		);
		expect(slugify('5. Reference desktop shell geometry')).toBe('5-reference-desktop-shell-geometry');
		expect(slugify('Scene / Plan / Layout')).toBe('scene--plan--layout');
		expect(slugify('What changed after implementation — ratification record (2026-09-19)')).toBe(
			'what-changed-after-implementation--ratification-record-2026-09-19'
		);
		expect(anchorsOf('# Same\n\n# Same\n\ntext').has('same-1')).toBe(true);
	});

	it('resolves against the real tree and reports the failure class', () => {
		const referencing = resolve(REPO_ROOT, 'docs/README.md');
		const failure = (raw: string) =>
			resolveReference(referencing, { line: 1, raw, kind: 'link' });

		const architecture = readFileSync(
			resolve(REPO_ROOT, 'docs/reference/architecture.md'),
			'utf8'
		);
		const [anchor] = [...anchorsOf(architecture)];
		expect(failure('./reference/architecture.md')).toBeNull();
		// Anchors are read from the target document, so this cannot rot when a
		// heading is renamed — only the absence of the heading can fail it.
		expect(failure(`./reference/architecture.md#${anchor}`)).toBeNull();
		expect(failure('./reference/does-not-exist.md')).toBe('missing file');
		expect(failure('./Reference/architecture.md')).toContain('wrong case');
		expect(failure('./reference/architecture.md#no-such-heading')).toBe(
			'no heading matches #no-such-heading'
		);
		// Outside the repository's authority: never guessed at, always skipped.
		expect(failure('https://example.com/missing')).toBeNull();
		expect(failure('/docs/absolute/web/path.md')).toBeNull();
		expect(failure('../../outside-the-repository.md')).toBe('escapes the repository');
	});
});
