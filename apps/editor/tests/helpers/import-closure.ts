/**
 * §2.2 import-closure resolver (PR #115, WP0).
 *
 * Computes the transitive import closure over *tracked source* files, without a
 * bundler. It resolves the four specifier families the plan names — static,
 * type-only, dynamic and CSS imports — plus the repo's own aliases:
 *
 *   `$lib/…`                     → `apps/editor/src/lib/…`
 *   `@portfolio/<pkg>`           → `packages/<pkg>/src/index.ts`
 *
 * Bare package specifiers (`three`, `svelte`, `@threlte/…`, `$app/…`, …) are
 * externals and never enter the closure, which is what makes the closure a
 * property of this repository rather than of `node_modules`.
 *
 * Owners: WP0 manifests (`docs/roadmap/parallel-track-cutover/acceptance.md`),
 * the product-side `legacy/` isolation test, and WP3R's post-prune
 * reassessment. One implementation, so a count recorded at the baseline and a
 * count taken after pruning are the same measurement.
 *
 * WP3T retired the two stale constants WP3R's t1 finding named: `MUSEUM_APP_SRC`
 * (its `apps/museum/src` root was deleted at WP2, §3.5) and the
 * `virtual:museum-editor-entry` alias with its `MuseumEditorApp.svelte` target
 * (the plugin and `lib/editor/**` went with the WP2 prune). A resolver branch
 * that can only ever return a missing path is not a guarantee, so it is gone
 * rather than repointed. No surviving consumer referenced either name (only
 * `legacy-isolation.test.ts` imports from this module, and only
 * `parseModuleSpecifiers`/`stripComments`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root, derived from this file's own location (never cwd). */
export const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
/** `apps/editor` */
export const EDITOR_ROOT = path.join(REPO_ROOT, 'apps/editor');
/** `apps/editor/src` */
export const EDITOR_SRC = path.join(EDITOR_ROOT, 'src');
/** `apps/editor/src/lib` — the editor's `$lib`. */
export const EDITOR_LIB = path.join(EDITOR_SRC, 'lib');
/** `packages` — the workspace kernel packages. */
export const PACKAGES_ROOT = path.join(REPO_ROOT, 'packages');
/** `apps/editor/tests` — the test population, measured by the test manifest. */
export const EDITOR_TESTS_ROOT = path.join(EDITOR_ROOT, 'tests');

/** Resolution order for extension-less relative and alias specifiers. */
const EXTENSIONS = ['.ts', '.svelte', '.js', '.mjs', '.css', '.json', '.tsx'];

/** Strip a Vite resource query (`?url`, `?raw`, `?worker`, …) before resolving. */
function stripQuery(specifier: string): string {
	const query = specifier.indexOf('?');
	return query === -1 ? specifier : specifier.slice(0, query);
}

function isFile(candidate: string): boolean {
	try {
		return fs.statSync(candidate).isFile();
	} catch {
		return false;
	}
}

/**
 * Resolve a base path to a concrete file, trying the path as written, then
 * extensions, then index files. TypeScript sources sometimes spell a relative
 * import with the emitted `.js` extension (`./foo.js` for `foo.ts`), so a
 * `.js`/`.mjs` base is also retried as a TypeScript/Svelte source stem.
 */
function resolveFile(base: string): string | null {
	if (isFile(base)) return base;
	const stems = [base];
	if (/\.(js|mjs)$/.test(base)) stems.push(base.replace(/\.(js|mjs)$/, ''));
	for (const stem of stems) {
		for (const extension of EXTENSIONS) {
			const candidate = `${stem}${extension}`;
			if (isFile(candidate)) return candidate;
		}
		for (const extension of EXTENSIONS) {
			const candidate = path.join(stem, `index${extension}`);
			if (isFile(candidate)) return candidate;
		}
	}
	return null;
}

/** Per-app resolution roots. `$lib` and `@portfolio/*` differ per SvelteKit app. */
export interface ClosureRoots {
	/** The `$lib` directory (default: `apps/editor/src/lib`). */
	libRoot?: string;
	/** The workspace `packages` directory (default: repo `packages`). */
	packagesRoot?: string;
}

/**
 * Resolve one module specifier to an absolute source path, or `null` for an
 * external (a bare package specifier, a SvelteKit runtime virtual, …).
 */
export function resolveSpecifier(
	importer: string,
	specifier: string,
	roots: ClosureRoots = {}
): string | null {
	const libRoot = roots.libRoot ?? EDITOR_LIB;
	const packagesRoot = roots.packagesRoot ?? PACKAGES_ROOT;
	const target = stripQuery(specifier);
	if (target === '$lib') return resolveFile(libRoot);
	if (target.startsWith('$lib/')) {
		return resolveFile(path.join(libRoot, target.slice('$lib/'.length)));
	}
	if (target.startsWith('.')) {
		return resolveFile(path.resolve(path.dirname(importer), target));
	}
	if (target.startsWith('@portfolio/')) {
		const packageName = target.slice('@portfolio/'.length).split('/')[0] ?? '';
		return resolveFile(path.join(packagesRoot, packageName, 'src/index.ts'));
	}
	return null;
}

/**
 * Blank comments while leaving string and template literals intact, so a
 * multi-line `import { … } from '…'` whose member list carries `//` notes still
 * parses, while a commented-out import does not create an edge. Newlines are
 * preserved so offsets stay usable in diagnostics.
 */
export function stripComments(source: string): string {
	const out = source.split('');
	type Frame = 'code' | 'single' | 'double' | 'template' | 'line' | 'block';
	let frame: Frame = 'code';
	let i = 0;
	while (i < source.length) {
		const char = source[i]!;
		const next = source[i + 1] ?? '';
		if (frame === 'line') {
			if (char === '\n') frame = 'code';
			else out[i] = ' ';
			i += 1;
			continue;
		}
		if (frame === 'block') {
			out[i] = char === '\n' ? '\n' : ' ';
			if (char === '*' && next === '/') {
				out[i + 1] = ' ';
				frame = 'code';
				i += 2;
			} else {
				i += 1;
			}
			continue;
		}
		if (frame === 'single' || frame === 'double' || frame === 'template') {
			if (char === '\\') {
				i += 2;
				continue;
			}
			if ((frame === 'single' && char === "'") || (frame === 'double' && char === '"') || (frame === 'template' && char === '`')) {
				frame = 'code';
			}
			i += 1;
			continue;
		}
		if (char === '/' && next === '/') {
			out[i] = ' ';
			frame = 'line';
			i += 1;
			continue;
		}
		if (char === '/' && next === '*') {
			out[i] = ' ';
			out[i + 1] = ' ';
			frame = 'block';
			i += 2;
			continue;
		}
		if (char === "'") frame = 'single';
		else if (char === '"') frame = 'double';
		else if (char === '`') frame = 'template';
		i += 1;
	}
	return out.join('');
}

/**
 * Module specifiers of a source file: static `import`/`export … from`
 * (including `import type`/`export type`), bare side-effect `import '…'`,
 * literal dynamic `import('…')` and CSS `@import`. Comments are stripped
 * first, so a commented-out import is not an edge and a member list carrying
 * inline notes still parses.
 */
const STATIC_SPECIFIER =
	/(?:^|[\s;}])import\s+(?:type\s+)?(?:[\w*{},\s$]+\s+from\s+)?['"]([^'"]+)['"]/gm;
const EXPORT_SPECIFIER =
	/(?:^|[\s;}])export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s*['"]([^'"]+)['"]/gm;
const DYNAMIC_SPECIFIER = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const CSS_IMPORT_SPECIFIER = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g;

/** Every module specifier written in a source string, in file order. */
export function parseModuleSpecifiers(source: string): string[] {
	const code = stripComments(source);
	const specifiers: string[] = [];
	for (const pattern of [
		STATIC_SPECIFIER,
		EXPORT_SPECIFIER,
		DYNAMIC_SPECIFIER,
		CSS_IMPORT_SPECIFIER
	]) {
		pattern.lastIndex = 0;
		for (const match of code.matchAll(pattern)) {
			if (match[1]) specifiers.push(match[1]);
		}
	}
	return specifiers;
}

/**
 * The transitive import closure of `roots`, as absolute file paths.
 *
 * The roots themselves are always members, so a closure is never empty. Only
 * files that resolve to a real path on disk are followed; externals stop the
 * walk at the boundary.
 *
 * The walk does not descend into `apps/editor/tests/**`: the test population is
 * measured separately (the WP0 test manifest), and one `/dev` perf route
 * imports a test fixture builder that is not part of the product source graph.
 */
export function importClosure(
	roots: readonly string[],
	options: ClosureRoots = {}
): Set<string> {
	const seen = new Set<string>();
	const pending = [...roots];
	while (pending.length > 0) {
		const file = pending.pop()!;
		if (seen.has(file)) continue;
		seen.add(file);
		if (!isFile(file)) continue;
		let source: string;
		try {
			source = fs.readFileSync(file, 'utf8');
		} catch {
			continue;
		}
		for (const specifier of parseModuleSpecifiers(source)) {
			const resolved = resolveSpecifier(file, specifier, options);
			if (!resolved || seen.has(resolved)) continue;
			if (resolved === EDITOR_TESTS_ROOT || resolved.startsWith(`${EDITOR_TESTS_ROOT}${path.sep}`)) continue;
			pending.push(resolved);
		}
	}
	return seen;
}

/** Recursively collect files under `root` (skips dotfiles). */
export function listSourceFiles(root: string): string[] {
	const files: string[] = [];
	const pending = [root];
	while (pending.length > 0) {
		const entry = pending.pop()!;
		let stat: fs.Stats;
		try {
			stat = fs.statSync(entry);
		} catch {
			continue;
		}
		if (stat.isDirectory()) {
			for (const child of fs.readdirSync(entry)) {
				if (child.startsWith('.')) continue;
				pending.push(path.join(entry, child));
			}
		} else if (stat.isFile()) {
			files.push(entry);
		}
	}
	return files;
}

/** Repository-relative path, useful for manifest rows and diagnostics. */
export function relativeToRepo(absolutePath: string): string {
	return path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/');
}

/** Line count of a file, matching `wc -l` (a trailing newline is not a line). */
export function lineCount(file: string): number {
	const source = fs.readFileSync(file, 'utf8');
	if (source.length === 0) return 0;
	let lines = 0;
	for (let i = 0; i < source.length; i += 1) if (source[i] === '\n') lines += 1;
	// `wc -l` counts newlines; a non-empty file without a trailing newline has
	// one final partial line.
	return source.endsWith('\n') ? lines : lines + 1;
}
