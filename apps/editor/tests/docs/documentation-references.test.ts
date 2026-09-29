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
	ignoredPaths,
	markdownFiles,
	normalizeTarget,
	resolveReference,
	scanDocumentation,
	scanHeadings,
	scanSectionNumbering,
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

	it('covers dot-directory documentation instead of blanket-skipping it', () => {
		// `.agents/skills/*/SKILL.md` is tracked documentation; skipping every
		// dot-directory silently excluded all of it.
		const skills = markdownFiles().filter((file) => file.includes('/.agents/'));
		expect(skills.length).toBeGreaterThan(0);
		expect(skills.every((file) => file.endsWith('.md'))).toBe(true);
	});

	it('leaves deliberately local artifacts alone', () => {
		// `.env` is ignored and documented as a file the reader creates; that is
		// not a dead reference, and the unconditional lane must not depend on
		// local setup.
		const ignored = ignoredPaths(['.env', 'docs/README.md']);
		expect(ignored.has('.env')).toBe(true);
		expect(ignored.has('docs/README.md')).toBe(false);
		expect(
			resolveReference(resolve(REPO_ROOT, 'README.md'), { line: 1, raw: '.env', kind: 'link' }, ignored)
		).toBeNull();
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

	it('does not read a link label as a second reference', () => {
		// The label shows where the file used to be; the target is the reference.
		// Reading the label back as a second path reports the same file twice.
		const source = '- [`../north-star.md`](../../reference/north-star.md) — placement.';
		expect(extractReferences(source).map((reference) => reference.raw)).toEqual([
			'../../reference/north-star.md'
		]);
	});

	it('leaves a template fence alone, because a template is not a claim', () => {
		// The `META:` line a skill shows the reader is relative to the document it
		// gets pasted into, not to the skill file that documents it.
		const source = [
			'```text',
			'META: Architecture cycle — <action> → ../operations/architecture-cycle.md',
			'```'
		].join('\n');
		expect(extractReferences(source)).toEqual([]);
	});

	it('does not treat illustrative patterns or code as paths', () => {
		const source = [
			'write to `docs/roadmap/<phase>/README.md`',
			'run `apps/editor/tests/**/*.test.ts`',
			'`npm run test:arch`',		'`../reference/decisions/`',
		'an elided `apps/editor/.../layout/LayoutPlanViewport.svelte` is not openable',
		'a bare `reference/architecture.md` without a relative prefix is prose'
	].join('\n');
	expect(extractReferences(source)).toEqual([]);
	});

	it('leaves historical written paths alone inside a declared evidence region', () => {
		const source = [
			'EVIDENCE-PATHS: start — as written at 7c3d392a (2026-09-12)',
			'',
			'validation `apps/editor/tests/lib/layout/p23-6h-wall-height.test.ts`',
			'',
			'EVIDENCE-PATHS: end',
			'',
			'the router is `docs/README.md`'
		].join('\n');
		expect(extractReferences(source).map((reference) => reference.raw)).toEqual(['docs/README.md']);
	});

	it('runs an unclosed evidence region to the end of the document', () => {
		const source = [
			'# Record',
			'',
			'EVIDENCE-PATHS: start — paths as written at bcc2020 (external)',
			'',
			'`packages/viewer/src/systems/wall/wall-system.tsx`'
		].join('\n');
		expect(extractReferences(source)).toEqual([]);
	});

	it('keeps checking a record\u2019s links and anchors inside an evidence region', () => {
		// Only written paths are exempt: a record's links are the reader's route
		// today, so a broken one still fails while the evidence beside it passes.
		const source = [
			'EVIDENCE-PATHS: start — as written at 7c3d392a',
			'',
			'see [the router](./does-not-exist.md) and `apps/editor/tests/lib/layout/p23-2-snap.test.ts`'
		].join('\n');
		const references = extractReferences(source);
		expect(references.map((reference) => [reference.kind, reference.raw])).toEqual([
			['link', './does-not-exist.md']
		]);
		const referencing = resolve(REPO_ROOT, 'docs/operations/current.md');
		expect(resolveReference(referencing, references[0])).toBe('missing file');
	});

	it('strips link decoration: angle brackets and titles', () => {
		expect(normalizeTarget('<./reports/final handoff.txt>')).toBe('./reports/final handoff.txt');
		expect(normalizeTarget('./docs/README.md "the router"')).toBe('./docs/README.md');
		expect(normalizeTarget('  ./docs/README.md  ')).toBe('./docs/README.md');
		expect(normalizeTarget('<unterminated')).toBe('');
	});

	it('catches a numbered-section gap, which is how a heading gets swallowed', () => {
		const source = ['# Title', '', '# 1. One', '', '# 2. Two', '', '# 4. Four'].join('\n');
		expect(scanSectionNumbering(source).map((finding) => finding.reason)).toEqual([
			'numbering gap: no section 3 before 4'
		]);
	});

	it('does not call a restarted address a lost section', () => {
		// `1. 2. 3.` under each lettered parent is a plan's normal shape; only a
		// hole in the run means a heading went missing.
		const source = [
			'## C. One',
			'',
			'### 1. First',
			'',
			'### 2. Second',
			'',
			'## D. Two',
			'',
			'### 1. First again'
		].join('\n');
		expect(scanSectionNumbering(source)).toEqual([]);
	});

	it('reads a moved-section placeholder heading as covering its range', () => {
		// `# 6.–13. Workspace exposure — moved` records that those numbers are held
		// elsewhere, with their numbers preserved. It is a declaration, not a hole.
		const source = [
			'# 1. One',
			'',
			'# 2. Two',
			'',
			'# 3.–13. Workspace exposure — moved 2026-08-21',
			'',
			'# 14. Next'
		].join('\n');
		expect(scanSectionNumbering(source)).toEqual([]);
	});

	it('catches a heading glued to the rule above it, which never renders', () => {
		// The shape a swallowed heading leaves behind: the section vanishes from the
		// anchors and the numbering, while every `§3` citation to it stays.
		const source = ['# 1. One', '', '# 2. Two', '', '---# 3. Three', '', 'body'].join('\n');
		expect(scanHeadings(source).map((finding) => [finding.line, finding.reason])).toEqual([
			[5, 'no line break: the heading is attached to the line above and does not render']
		]);
	});

	it('leaves documents that declare no numbering contract alone', () => {
		// A document that never opens a numbered sequence claims nothing.
		expect(scanSectionNumbering('# Title\n\n## Notes\n\n## More notes')).toEqual([]);
		// A record that starts at 0 (the P23B closeout style) opens no 1-based
		// sequence, so its own order is not a contract this gate can hold.
		expect(scanSectionNumbering('# R\n\n## 0. Start\n\n## 1. Next\n\n## 3. Later')).toEqual([]);
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
