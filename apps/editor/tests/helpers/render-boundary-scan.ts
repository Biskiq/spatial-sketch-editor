/**
 * Shared scanner for the renderer boundaries (`renderer-portability-boundary`,
 * `render-identity-boundary`).
 *
 * It reads product source — `apps/editor/src` and every `packages/<pkg>/src` —
 * with comments removed, so prose that names a forbidden construct is not a site.
 * Comment removal is regex-based on purpose: `stripComments` tracks string
 * frames, and an apostrophe in Svelte markup text would otherwise swallow the
 * tokens that follow it and hide a real site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EDITOR_SRC, PACKAGES_ROOT, listSourceFiles, relativeToRepo } from './import-closure';

/** Product source files, absolute, `.ts` and `.svelte` only. */
export function productSourceFiles(): string[] {
	return [
		...listSourceFiles(EDITOR_SRC),
		...fs.readdirSync(PACKAGES_ROOT).flatMap((name) => listSourceFiles(path.join(PACKAGES_ROOT, name, 'src')))
	].filter((file) => /\.(ts|svelte)$/.test(file));
}

/** Source with HTML, block and line comments blanked (a `//` after `:` is a URL, not a comment). */
export function withoutComments(source: string): string {
	return source
		.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\n]/g, ' '))
		.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
		.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (match, lead: string) => lead + ' '.repeat(match.length - lead.length));
}

export type TokenRule = { readonly name: string; readonly pattern: RegExp };

/** The tokens each product file contains, by rule name, as `{ 'repo/relative/path': ['rule', …] }`. */
export function scanTokens(
	files: readonly { readonly file: string; readonly code: string }[],
	rules: readonly TokenRule[]
): Record<string, string[]> {
	const found: Record<string, string[]> = {};
	for (const { file, code } of files) {
		const clean = withoutComments(code);
		const names = rules.filter((rule) => rule.pattern.test(clean)).map((rule) => rule.name).sort();
		if (names.length > 0) found[file] = names;
	}
	return found;
}

/** Read every product source file once, keyed by repo-relative path. */
export function readProductSources(): { file: string; code: string }[] {
	return productSourceFiles()
		.map((absolute) => ({ file: relativeToRepo(absolute), code: fs.readFileSync(absolute, 'utf8') }))
		.sort((a, b) => a.file.localeCompare(b.file));
}
