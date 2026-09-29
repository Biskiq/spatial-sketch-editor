/**
 * Documentation cross-reference grammar (one parser, shared by every check).
 *
 * The repository cross-references itself constantly: `docs/` links to `docs/`,
 * contracts cite `§N` sections, and routers name the file a reader must open
 * next. Two classes of error hide in that prose and are invisible to the
 * TypeScript build and to every product test, because nothing imports them:
 *
 *   1. a relative link or a written-out path that no longer resolves
 *      (a moved or renamed file), and
 *   2. a `#section` anchor on a heading that was renamed, split or deleted.
 *
 * Both were found by hand in review — a section heading swallowed by an
 * insertion, and a router path one directory level short — so they are checked
 * mechanically here rather than by discipline. See
 * `tests/docs/documentation-references.test.ts` for the gate and
 * `apps/editor/tests/README.md` for the lane that owns it.
 *
 * Scope: relative references only. Absolute web paths (`/docs/…`), external
 * URLs and absolute filesystem paths are outside the repository's authority and
 * are skipped, never guessed at.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root, derived the same way the other boundary helpers derive roots. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * Directories that never hold authored repository documentation: build output,
 * dependencies and editor/client state. Ignore rules are not read from
 * `.gitignore` on purpose — this walk must behave identically in a working tree
 * and in a fresh clone, and must not depend on git being installed.
 */
const SKIP_DIRECTORIES = new Set([
	'.git',
	'.svelte-kit',
	'.vercel',
	'.netlify',
	'.wrangler',
	'.output',
	'.cache',
	'.freebuff',
	'.cursor',
	'.opencode',
	'node_modules',
	'dist',
	'build',
	'coverage',
	'test-results',
	'playwright-report'
]);

/**
 * Markdown the repository carries but does not author as documentation, so a
 * reader never routes through it:
 *
 * - `docs/archive/` is history by contract (see `docs/README.md`): its relative
 *   paths were written against layouts that no longer exist, they are the record
 *   of what was true then, and rewriting them would falsify that record.
 * - `Repo-Audit/` is a captured agent-harness audit log whose paths were
 *   relative to the audited checkout, not to this one.
 *
 * Excluded by prefix, explicitly, so the coverage of the gate is readable here
 * rather than implied by where it happens to pass.
 */
export const NON_DOCUMENTATION_PREFIXES = ['docs/archive/', 'Repo-Audit/'] as const;

export type ReferenceKind = 'link' | 'definition' | 'path';

export type Reference = {
	/** 1-based line in the referencing document. */
	line: number;
	/** The target exactly as written. */
	raw: string;
	kind: ReferenceKind;
};

export type Finding = {
	/** Path relative to the repository root. */
	file: string;
	line: number;
	raw: string;
	kind: ReferenceKind;
	/** Human-readable reason, e.g. `missing file` or `no heading matches #grid`. */
	reason: string;
};

/** File extensions that may legitimately appear as a written-out repository path. */
const PATH_EXTENSIONS =
	/\.(md|markdown|ts|tsx|js|mjs|cjs|json|css|html|svelte|sh|yml|yaml|toml|txt|png|jpe?g|svg|webp)$/i;

/**
 * A written path either states its relation (`./`, `../`) or opens with a
 * repository top-level directory. Anything else is prose that happens to
 * contain a slash.
 */
const PATH_PREFIX = /^(\.{1,2}\/|(docs|apps|packages|diagrams|Repo-Audit|\.agents)\/)/;

/** Characters that mark a token as a pattern, a regex or a placeholder rather than a path. */
const PLACEHOLDER = /[*{}<>…§\s?[\]^$|\\"'()]/;

/** ```` ``` ````-fenced blocks, replaced by blank lines so line numbers survive. */
const FENCED_BLOCK = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[^\n]*$/gm;

/** Inline links and images: `[text](target)` / `![alt](target)`. */
const INLINE_LINK = /!?\[[^\]]*\]\(([^)\n]*)\)/g;

/** Reference-style definitions: `[label]: target`. */
const LINK_DEFINITION = /^[ \t]{0,3}\[[^\]]+\]:[ \t]*(\S+)/gm;

/** Backticked spans, the repository's usual way of naming a file in prose. */
const BACKTICKED = /`([^`\n]+)`/g;

/** The arrow form routers use for a routed path: `(→ ../../operations/current.md)`. */
const ARROW_PATH = /\(→[ \t]*([^)\n]+)\)/g;

/** A written-out relative path outside any inline-code span. */
const BARE_RELATIVE_PATH = /(?:^|[\s(["'])((?:\.\.?\/)+[A-Za-z0-9._/-]+)/gm;

/** Replaces fenced blocks with blank lines, preserving offsets and line numbering. */
function blankFences(source: string): string {
	return source.replace(FENCED_BLOCK, (block) => block.replace(/[^\n]/g, ''));
}

/** 1-based line number for a character offset. */
function lineAt(source: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset; index += 1) if (source[index] === '\n') line += 1;
	return line;
}

/**
 * Strips the Markdown decoration from a raw link target: an angle-bracket
 * wrapper, a `"title"`, and surrounding whitespace. Returns '' for a target
 * this grammar does not understand (nothing is guessed at).
 */
export function normalizeTarget(raw: string): string {
	let target = raw.trim();
	if (target.startsWith('<')) {
		const end = target.indexOf('>');
		if (end === -1) return '';
		target = target.slice(1, end).trim();
	} else {
		const quoted = target.search(/\s+["'(]/);
		if (quoted !== -1) target = target.slice(0, quoted);
	}
	return target;
}

/** True when a token could name a repository path rather than prose or code. */
function looksLikePath(token: string): boolean {
	if (PLACEHOLDER.test(token)) return false;
	if (!token.includes('/')) return false;
	if (!PATH_EXTENSIONS.test(token)) return false;
	return true;
}

/**
 * Blanks both fenced blocks and inline code spans. A code span legitimately
 * contains bracket-and-parenthesis shapes (`\bimport\s+['"]([^'"]+)['"]`), and
 * reading those as links is how a grammar starts reporting its own examples.
 */
function blankCode(source: string): string {
	return blankFences(source).replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length));
}

/**
 * Every reference in one Markdown document. Links are read from the prose
 * (code blanked, because code contains bracket and parenthesis shapes too);
 * written paths are read from the whole file, because this repository
 * deliberately states a routed path inside a ```text block and inside code
 * spans (`docs/README.md`).
 */
export function extractReferences(source: string): Reference[] {
	const references: Reference[] = [];
	const prose = blankCode(source);

	for (const match of prose.matchAll(INLINE_LINK)) {
		const target = normalizeTarget(match[1]);
		if (target !== '') {
			references.push({ line: lineAt(prose, match.index), raw: target, kind: 'link' });
		}
	}
	for (const match of prose.matchAll(LINK_DEFINITION)) {
		const target = normalizeTarget(match[1]);
		if (target !== '') {
			references.push({ line: lineAt(prose, match.index), raw: target, kind: 'definition' });
		}
	}

	const pathTokens: string[] = [];
	for (const match of source.matchAll(BACKTICKED)) pathTokens.push(match[1]);
	for (const match of source.matchAll(ARROW_PATH)) pathTokens.push(match[1]);
	for (const match of source.matchAll(BARE_RELATIVE_PATH)) pathTokens.push(match[1]);

	// One path can match several of the grammars above (an arrowed path is also
	// a bare relative path); the line + target pair dedupes them.
	const claimed = new Set(references.map((reference) => `${reference.line}:${reference.raw}`));
	for (const token of pathTokens) {
		const target = token.trim();
		if (!looksLikePath(target)) continue;
		if (!PATH_PREFIX.test(target)) continue;
		const line = lineAt(source, source.indexOf(target));
		if (claimed.has(`${line}:${target}`)) continue;
		claimed.add(`${line}:${target}`);
		references.push({ line, raw: target, kind: 'path' });
	}

	return references.sort((a, b) => a.line - b.line || a.raw.localeCompare(b.raw));
}

/** True for a reference this check deliberately does not resolve itself. */
function isOutsideRepository(target: string): boolean {
	if (target.startsWith('#')) return false;
	if (target.startsWith('/') || target.startsWith('//')) return true;
	return /^[a-z][a-z0-9+.-]*:/i.test(target);
}

/**
 * GitHub's heading slug: lowercased, punctuation and symbols dropped, spaces
 * turned into hyphens. An em dash therefore disappears and the space on either
 * side leaves a double hyphen — which is why this is a function and not a
 * casual `.replace(/ /g, '-')` at the call site.
 */
export function slugify(heading: string): string {
	return heading
		.replace(/^#{1,6}[ \t]+/, '')
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N} _-]/gu, '')
		.replace(/ /g, '-');
}

/** Every anchor a Markdown document offers, including duplicate-heading suffixes. */
export function anchorsOf(source: string): Set<string> {
	const anchors = new Set<string>();
	const seen = new Map<string, number>();
	// Headings only when they are outside a fence.
	const prose = blankFences(source);
	for (const match of prose.matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*#*$/gm)) {
		const base = slugify(match[1]);
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		anchors.add(count === 0 ? base : `${base}-${count}`);
	}
	for (const match of source.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/gi)) anchors.add(match[1]);
	return anchors;
}

/** True for a fragment that addresses a line range rather than a heading. */
function isLineAnchor(fragment: string): boolean {
	return /^L\d+(-L?\d+)?$/i.test(fragment);
}

/** Splits a link target into its path and fragment halves, URL-decoding the path. */
function splitTarget(target: string): { path: string; fragment: string } {
	const hash = target.indexOf('#');
	const rawPath = hash === -1 ? target : target.slice(0, hash);
	const fragment = hash === -1 ? '' : target.slice(hash + 1);
	const withoutQuery = rawPath.split('?')[0];
	let decoded = withoutQuery;
	try {
		decoded = decodeURIComponent(withoutQuery);
	} catch {
		// A malformed escape is reported as a missing file below, not thrown.
	}
	return { path: decoded, fragment };
}

/**
 * The repository's own files, from git's point of view. Used to leave
 * deliberately local artifacts alone: `.gitignore` retains some generated
 * measurement captures in a working tree on purpose, and a document may name
 * them without claiming they are committed. Returns null when git is
 * unavailable (a source export), in which case written paths are not checked.
 */	export function trackedPaths(): Set<string> | null {
	try {
		const output = execFileSync('git', ['ls-files', '-z'], {
			cwd: REPO_ROOT,
			maxBuffer: 64 * 1024 * 1024,
			encoding: 'utf8'
		});
		return new Set(output.split('\0').filter((entry) => entry !== ''));
	} catch {
		return null;
	}
}

/**
 * Walks the path from the repository root, one segment at a time, to separate
 * the three ways a reference can fail: it leaves the repository, a directory
 * entry is missing, or a directory entry differs only by case (macOS and
 * Windows resolve case-insensitively, so such a link passes locally and breaks
 * on GitHub).
 */
function checkOnDisk(target: string): string | null {
	if (target !== REPO_ROOT && !target.startsWith(REPO_ROOT + sep)) {
		return 'escapes the repository';
	}
	let current = REPO_ROOT;
	for (const segment of target.slice(REPO_ROOT.length + 1).split(sep)) {
		if (segment === '' || segment === '.') continue;
		let entries: string[];
		try {
			entries = readdirSync(current);
		} catch {
			return 'missing file';
		}
		if (entries.includes(segment)) {
			current = resolve(current, segment);
			continue;
		}
		const match = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
		return match === undefined ? 'missing file' : `wrong case: ${segment} (on disk: ${match})`;
	}
	return null;
}

/**
 * The repository's authored documentation: Markdown the repository carries
 * (tracked, so a scratch copy of a document is never held to the gate), minus
 * the non-documentation prefixes above. Falls back to the walk alone when git
 * is unavailable, such as in a source export.
 */
export function markdownFiles(root: string = REPO_ROOT): string[] {
	const files: string[] = [];
	const tracked = trackedPaths();
	const pending = [root];
	while (pending.length > 0) {
		const current = pending.pop()!;
		let entries: string[];
		try {
			entries = readdirSync(current);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.startsWith('.') && entry !== '.') continue;
			const path = resolve(current, entry);
			let isDirectory: boolean;
			try {
				isDirectory = statSync(path).isDirectory();
			} catch {
				continue;
			}
			if (isDirectory) {
				if (SKIP_DIRECTORIES.has(entry)) continue;
				pending.push(path);
			} else if (entry.toLowerCase().endsWith('.md')) {
				files.push(path);
			}
		}
	}
	return files.sort().filter((file) => isDocumentation(root, file, tracked));
}

/** True when a Markdown file is authored documentation rather than a record. */
function isDocumentation(root: string, file: string, tracked: Set<string> | null): boolean {
	const relative = file.slice(root.length + 1);
	if (relative.startsWith('..')) return true;
	if (NON_DOCUMENTATION_PREFIXES.some((prefix) => relative.startsWith(prefix))) return false;
	return tracked === null || root !== REPO_ROOT || tracked.has(relative);
}

/**
 * Resolves one reference against the tree. Returns null when the reference is
 * outside the repository or resolves cleanly.
 */
export function resolveReference(
	referencingFile: string,
	reference: Reference
): string | null {
	const { path, fragment } = splitTarget(reference.raw);
	if (isOutsideRepository(reference.raw) && fragment === '') return null;
	if (path !== '' && isOutsideRepository(path)) return null;

	const target = path === '' ? referencingFile : resolve(dirname(referencingFile), path);
	const disk = checkOnDisk(target);
	if (disk !== null) return disk;

	if (fragment === '' || !isMarkdown(target) || isLineAnchor(fragment)) return null;
	const anchors = anchorsOf(readFileSync(target, 'utf8'));
	return anchors.has(fragment) ? null : `no heading matches #${fragment}`;
}

/** True when the resolved path is a Markdown document with headings to anchor to. */
function isMarkdown(path: string): boolean {
	return path.toLowerCase().endsWith('.md');
}

/** Scans every Markdown document in the repository. */
export function scanDocumentation(root: string = REPO_ROOT): Finding[] {
	const findings: Finding[] = [];
	const tracked = trackedPaths();
	for (const file of markdownFiles(root)) {
		const source = readFileSync(file, 'utf8');
		for (const reference of extractReferences(source)) {
			// A written path may legitimately name a deliberately local artifact
			// (an ignored capture the document explains how to regenerate), so the
			// written-path grammar is held to the repository's own file list.
			if (reference.kind === 'path' && !namesRepositoryFile(file, reference.raw, tracked)) {
				continue;
			}
			const reason = resolveReference(file, reference);
			if (reason === null) continue;
			findings.push({
				file: file.slice(root.length + 1),
				line: reference.line,
				raw: reference.raw,
				kind: reference.kind,
				reason
			});
		}
	}
	return findings;
}

/** Does a written path name a file the repository actually carries? */
function namesRepositoryFile(
	referencingFile: string,
	raw: string,
	tracked: Set<string> | null
): boolean {
	if (tracked === null) return false;
	const { path } = splitTarget(raw);
	if (path === '') return false;
	const target = resolve(dirname(referencingFile), path);
	if (target !== REPO_ROOT && !target.startsWith(REPO_ROOT + sep)) return true;
	return tracked.has(target.slice(REPO_ROOT.length + 1));
}

/** One finding per line, in a shape a reviewer can paste into an issue. */
export function formatFindings(findings: Finding[]): string {
	return findings
		.map((finding) => `${finding.file}:${finding.line}  ${finding.raw}  — ${finding.reason}`)
		.join('\n');
}
