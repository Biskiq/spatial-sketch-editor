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

export type ReferenceKind = 'link' | 'definition' | 'path' | 'section' | 'heading';

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

/**
 * Link and image labels: the `[label]` half of `[label](./target.md)`. The label
 * is display text and often repeats a path the link already states correctly
 * (`[`../north-star.md`](../../reference/north-star.md)`), so reading it as a
 * second reference reports the same file twice — once as it is, once as it used
 * to be.
 */
const LINK_LABEL = /!?\[[^\]\n]*\]/g;

/**
 * A placeholder marks a fenced block as a template rather than a statement: the
 * `META:` line a skill shows the reader how to write is relative to the document
 * it will be pasted into, not to the skill. A template is not a claim about the
 * tree, so its paths are not resolved.
 */
const PLACEHOLDER_MARKER = /<[A-Za-z][^<>\n]*>|\{[A-Za-z][^{}\n]*\}/;

/**
 * Evidence regions, declared in the record itself:
 *
 * ```text
 * EVIDENCE-PATHS: start — as written at 7c3d392a (2026-09-12); historical
 * EVIDENCE-PATHS: end
 * ```
 *
 * A record states what was true at the revision it describes, and its written
 * source paths are evidence of that revision: a test file later deleted, a
 * contract later moved by the documentation restructure. Those paths are kept
 * as written rather than rewritten, and are not resolved. Only written paths
 * are exempt — a record's links, definitions and anchors are still checked,
 * because those are the reader's route today. An unclosed region runs to the end
 * of the document; a mixed document closes it with `end` where current routes
 * resume.
 */
const EVIDENCE_MARKER = /^[ \t>]*EVIDENCE-PATHS:[ \t]*(start|end)\b.*$/gim;

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
	// `apps/editor/.../layout/x.svelte` is an elision a reader expands by eye, not
	// a path anyone can open.
	if (token.split('/').includes('...')) return false;
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

/** Blanks link labels, preserving offsets so line numbers do not move. */
function blankLabels(source: string): string {
	return source.replace(LINK_LABEL, (span) => ' '.repeat(span.length));
}

/**
 * Half-open offsets of the declared evidence regions in one document, in order.
 */
export function evidenceRanges(source: string): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];
	let open: number | null = null;
	for (const match of source.matchAll(EVIDENCE_MARKER)) {
		if (match[1].toLowerCase() === 'start') {
			if (open === null) open = match.index;
			continue;
		}
		if (open === null) continue;
		ranges.push([open, match.index]);
		open = null;
	}
	if (open !== null) ranges.push([open, source.length]);
	return ranges;
}

/** Half-open offsets of the fenced blocks written as templates. */
function templateRanges(source: string): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];
	for (const match of source.matchAll(FENCED_BLOCK)) {
		if (!PLACEHOLDER_MARKER.test(match[0])) continue;
		ranges.push([match.index, match.index + match[0].length]);
	}
	return ranges;
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

	// Written paths are read from the whole file, fences included (this repository
	// states a routed path inside a ```text block), but with link labels blanked so
	// a link's own display text is not read back as a second reference.
	const pathSource = blankLabels(source);
	const skipped = [...templateRanges(source), ...evidenceRanges(source)];
	const inSkipped = (offset: number) =>
		skipped.some(([start, end]) => offset >= start && offset < end);

	const pathTokens: Array<{ offset: number; token: string }> = [];
	// A backticked span starts one character in; the other two grammars carry
	// leading context inside the match.
	for (const match of pathSource.matchAll(BACKTICKED)) {
		pathTokens.push({ offset: match.index + 1, token: match[1] });
	}
	for (const match of pathSource.matchAll(ARROW_PATH)) {
		pathTokens.push({ offset: match.index, token: match[1] });
	}
	for (const match of pathSource.matchAll(BARE_RELATIVE_PATH)) {
		pathTokens.push({ offset: match.index + (match[0].length - match[1].length), token: match[1] });
	}

	// One path can match several of the grammars above (an arrowed path is also
	// a bare relative path); the line + target pair dedupes them.
	const claimed = new Set(references.map((reference) => `${reference.line}:${reference.raw}`));
	for (const token of pathTokens) {
		const target = token.token.trim();
		if (!looksLikePath(target)) continue;
		if (!PATH_PREFIX.test(target)) continue;
		if (inSkipped(token.offset)) continue;
		const line = lineAt(pathSource, token.offset);
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
 */
export function trackedPaths(): Set<string> | null {
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
			// Dot-directories are NOT skipped wholesale: `.agents/skills/*/SKILL.md`
			// is tracked documentation, and blanket-skipping it is how a gate gets
			// a blind spot. Only the named build/state directories are skipped.
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
 * The absolute path a reference names, or null when it names nothing inside the
 * repository (an external URL, an absolute web or filesystem path, a bare
 * fragment).
 */
export function targetPathOf(
	referencingFile: string,
	reference: Reference
): string | null {
	const { path } = splitTarget(reference.raw);
	if (path === '') return null;
	if (isOutsideRepository(reference.raw) || isOutsideRepository(path)) return null;
	// Two conventions, and they are not interchangeable:
	//
	// - A Markdown link resolves the way every renderer resolves it, from the
	//   referencing file.
	// - A written path that opens with a repository top-level directory is a
	//   route (`docs/README.md`, `apps/editor/tests/README.md`), which this
	//   repository writes from the root wherever the sentence lives; only `./`
	//   and `../` are file-relative.
	if (reference.kind === 'path' && !/^\.\.?\//.test(path)) {
		return resolve(REPO_ROOT, path);
	}
	return resolve(dirname(referencingFile), path);
}

/** Repository-relative form of an absolute path, or null when it is outside. */
export function repoRelative(target: string): string | null {
	if (target === REPO_ROOT) return '';
	return target.startsWith(REPO_ROOT + sep) ? target.slice(REPO_ROOT.length + 1) : null;
}

/**
 * Paths the repository deliberately does not carry — `.env`, generated captures
 * `.gitignore` retains locally. A document may name such an artifact (often to
 * say how to create or regenerate it) without making it a dead reference. One
 * batched `git check-ignore`; an empty set when git is unavailable.
 */
export function ignoredPaths(relativePaths: string[]): Set<string> {
	if (relativePaths.length === 0) return new Set();
	try {
		const output = execFileSync('git', ['check-ignore', '-z', '--stdin'], {
			cwd: REPO_ROOT,
			input: `${relativePaths.join('\0')}\0`,
			maxBuffer: 64 * 1024 * 1024,
			encoding: 'utf8'
		});
		return new Set(output.split('\0').filter((entry) => entry !== ''));
	} catch {
		// Exit 1 means "nothing matched", which is the common case.
		return new Set();
	}
}

/**
 * Resolves one reference against the tree. Returns null when the reference is
 * outside the repository, names a deliberately local artifact, or resolves
 * cleanly.
 */
export function resolveReference(
	referencingFile: string,
	reference: Reference,
	ignored: Set<string> = new Set()
): string | null {
	const { path, fragment } = splitTarget(reference.raw);
	if (isOutsideRepository(reference.raw) && fragment === '') return null;
	if (path !== '' && isOutsideRepository(path)) return null;

	const target =
		targetPathOf(referencingFile, reference) ?? (path === '' ? referencingFile : null);
	if (target === null) return null;
	const relative = repoRelative(target);
	if (relative !== null && ignored.has(relative)) return null;

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
	const documents = markdownFiles(root).map((file) => ({
		file,
		source: readFileSync(file, 'utf8')
	}));

	// One batched ignore lookup for every path any document names. Local
	// artifacts are exempt; everything else is resolved and reported.
	const candidates = new Set<string>();
	for (const document of documents) {
		for (const reference of extractReferences(document.source)) {
			const target = targetPathOf(document.file, reference);
			const relative = target === null ? null : repoRelative(target);
			if (relative !== null && relative !== '') candidates.add(relative);
		}
	}
	const ignored = ignoredPaths([...candidates]);

	const findings: Finding[] = [];
	for (const document of documents) {
		const relative = document.file.slice(root.length + 1);
		for (const reference of extractReferences(document.source)) {
			const reason = resolveReference(document.file, reference, ignored);
			if (reason === null) continue;
			findings.push({
				file: relative,
				line: reference.line,
				raw: reference.raw,
				kind: reference.kind,
				reason
			});
		}
		for (const finding of scanSectionNumbering(document.source)) {
			findings.push({ ...finding, file: relative });
		}
		for (const finding of scanHeadings(document.source)) {
			findings.push({ ...finding, file: relative });
		}
	}
	return findings;
}

/**
 * A numbered section heading: the document's own section address.
 */
export type SectionHeading = {
	line: number;
	depth: number;
	/** As written, without the heading marker: `5`, `0.7`, `4b`, `7.5`. */
	number: string;
	/** Last number a placeholder heading accounts for, or null. */
	rangeEnd: number | null;
	text: string;
};

const NUMBERED_HEADING = /^(#{1,6})[ \t]+(\d+(?:\.\d+)*)([a-z])?[. \t]/;

/**
 * A placeholder heading, which this repository writes for a section that moved
 * out with its number preserved: `# 6.–13. Workspace exposure — moved
 * 2026-08-21`. Such a heading is not a hole in the sequence — it is the record
 * that the numbers are held elsewhere — so its range is read and skipped.
 */
const NUMBERED_RANGE = /^(\d+(?:\.\d+)*)[ \t]*\.?[ \t]*[–—-][ \t]*(\d+)/;

/** The numbered headings of a document, in order, ignoring fenced blocks. */
export function numberedSections(source: string): SectionHeading[] {
	const sections: SectionHeading[] = [];
	const prose = blankFences(source);
	for (const match of prose.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*#*$/gm)) {
		const numbered = NUMBERED_HEADING.exec(`${match[1]} ${match[2]}`);
		if (numbered === null) continue;
		const range = NUMBERED_RANGE.exec(match[2]);
		sections.push({
			line: lineAt(prose, match.index),
			depth: match[1].length,
			number: `${numbered[2]}${numbered[3] ?? ''}`,
			rangeEnd: range === null ? null : Number(range[2]),
			text: match[2]
		});
	}
	return sections;
}

/**
 * A document that numbers its own sections takes on a numbering contract: its
 * own sequence has no holes. This is the check that catches the failure two
 * reviews found by hand — a section heading lost to an edit, leaving its `§N`
 * citations pointing at nothing while the text still reads as if they resolve.
 *
 * Only holes are checked, not repeated addresses: a plan legitimately restarts
 * `1. 2. 3.` under each lettered parent (`### 1. Row 1` under `## C.`, `### 1.`
 * again under `## D.`), so a repeat is not by itself a lost section.
 *
 * A document that does not number its sections (most of the tree) declares no
 * contract and is left alone.
 */
export function scanSectionNumbering(source: string): Omit<Finding, 'file'>[] {
	const sections = numberedSections(source);
	const findings: Omit<Finding, 'file'>[] = [];
	if (sections.length < 3) return findings;

	const byDepth = new Map<number, SectionHeading[]>();
	for (const section of sections) {
		const list = byDepth.get(section.depth) ?? [];
		list.push(section);
		byDepth.set(section.depth, list);
	}

	// The document's own sequence is the shallowest level that opens at 1.
	let sequenceDepth: number | null = null;
	for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
		const list = byDepth.get(depth)!;
		if (list.length >= 3 && integerOf(list[0].number) === 1 && !list[0].number.includes('.')) {
			sequenceDepth = depth;
			break;
		}
	}
	if (sequenceDepth === null) return findings;

	let expected = 1;
	for (const section of byDepth.get(sequenceDepth)!) {
		// A plain section 1 opens a new run, including numbered children under
		// successive lettered parents. Earlier runs must not hide its gaps.
		if (section.number === '1') expected = 1;
		const value = integerOf(section.number);
		if (value > expected) {
			const missing = Array.from({ length: value - expected }, (_, index) => expected + index).join(', ');
			findings.push({
				line: section.line,
				raw: section.number,
				kind: 'section',
				reason: `numbering gap: no section ${missing} before ${section.number}`
			});
		}
		expected = Math.max(expected, (section.rangeEnd ?? value) + 1);
	}
	return findings;
}

/**
 * A heading marker attached to the end of the line above (`---# 7. Core color
 * system`) is not a heading: Markdown renders the whole line as prose, so the
 * section disappears from the document's anchors and from its numbering while
 * every `§7` citation to it stays. This is the shape a swallowed heading
 * leaves when an edit joins two lines, so it is checked directly rather than
 * inferred from the numbering gap it also leaves behind.
 */
const GLUED_HEADING = /^[-*_]{3,}[ \t]*#{1,6}[ \t]/gm;

/** Findings for headings that will not render as headings. */
export function scanHeadings(source: string): Omit<Finding, 'file'>[] {
	const findings: Omit<Finding, 'file'>[] = [];
	const prose = blankFences(source);
	for (const match of prose.matchAll(GLUED_HEADING)) {
		findings.push({
			line: lineAt(prose, match.index),
			raw: match[0].trim(),
			kind: 'heading',
			reason: 'no line break: the heading is attached to the line above and does not render'
		});
	}
	return findings;
}

/** Leading integer of a section number: `4b` → 4, `0.7` → 0. */
function integerOf(number: string): number {
	const match = /^(\d+)/.exec(number);
	return match === null ? Number.NaN : Number(match[1]);
}

/** One finding per line, in a shape a reviewer can paste into an issue. */
export function formatFindings(findings: Finding[]): string {
	return findings
		.map((finding) => `${finding.file}:${finding.line}  ${finding.raw}  — ${finding.reason}`)
		.join('\n');
}
