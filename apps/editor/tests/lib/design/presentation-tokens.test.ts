/**
 * Presentation-token ownership and drift guard.
 *
 * The failure this catches: a component restates a shared role's value (a
 * "matching" fallback or a literal hex), so a future skin or spatial style
 * changes the role but not that component. Rendered output stays green in every
 * behavioral suite because the value still happens to be the same; only this
 * check sees the second copy.
 *
 * It deliberately does **not** forbid component-specific literals. A value is
 * only rejected when it duplicates a canonical role; a genuinely local colour,
 * typeface or geometry stays legal, which is why the check is a value comparison
 * rather than a "no hex" rule.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SPATIAL_PAINT_CSS_VAR, SPATIAL_PAINT_ROLES } from '$lib/design/spatial-paint';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src');
const TOKEN_FILE = join(SRC, 'lib/design/presentation-tokens.css');
const CURSOR_FILE = join(SRC, 'lib/authoring/stage/shell/cursors.css');

/** The presentation surface: shell, Experience, instruments, platform pages and routes. */
const PRESENTATION_PREFIXES = [
	'lib/authoring/stage/shell/',
	'lib/authoring/experience/',
	'lib/authoring/adapters/',
	'lib/design/',
	'lib/platform/',
	'lib/visitor/',
	'routes/'
];
const SKIP_FILES = [tokenFileRel(), cursorFileRel()];
const SKIP_PREFIXES = ['routes/dev/'];
/**
 * The visitor presentation owns its own roles. Its values intentionally match
 * the approved PLATE defaults today, so the value-drift rule does not apply;
 * the independence test below forbids it from consuming editor roles.
 */
const INDEPENDENT_PREFIXES = ['lib/visitor/'];

function relPath(file: string): string {
	return relative(SRC, file).split('\\').join('/');
}

function tokenFileRel(): string {
	return relPath(TOKEN_FILE);
}
function cursorFileRel(): string {
	return relPath(CURSOR_FILE);
}

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		const stat = statSync(path);
		if (stat.isDirectory()) walk(path, out);
		else if (/\.(svelte|css)$/.test(entry)) out.push(path);
	}
	return out;
}

/** Declarations of one file, name → normalized value. */
function declarations(css: string): Map<string, string> {
	const found = new Map<string, string>();
	for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/gi)) {
		found.set(match[1], normalize(match[2]));
	}
	return found;
}

/**
 * Declarations inside the first `:root { … }` block, and nothing else.
 *
 * Canonical defaults are the base block. A future `[data-theme]` shell override
 * must not replace them in this map, or the parity check would compare a skin.
 */
function rootDeclarations(css: string): Map<string, string> {
	const start = css.search(/:root\s*\{/);
	if (start === -1) return declarations(css);
	const open = css.indexOf('{', start);
	let depth = 0;
	for (let index = open; index < css.length; index += 1) {
		if (css[index] === '{') depth += 1;
		else if (css[index] === '}') {
			depth -= 1;
			if (depth === 0) return declarations(css.slice(open + 1, index));
		}
	}
	return declarations(css.slice(open + 1));
}

function normalize(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, '#$1$1$2$2$3$3');
}

/** Only the CSS a component actually renders, never its script or SVG data URIs. */
function presentationCss(file: string, source: string): string {
	if (file.endsWith('.css')) return stripDataUris(source);
	const blocks = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
	return stripDataUris(blocks.join('\n'));
}

function stripDataUris(css: string): string {
	return css.replace(/url\(\s*(['"]?)data:[^)]*?\1\s*\)/gi, 'url(data:removed)');
}

const CANONICAL_FILES = [TOKEN_FILE, CURSOR_FILE];
const canonical = new Map<string, string>();
for (const file of CANONICAL_FILES) {
	for (const [name, value] of rootDeclarations(readFileSync(file, 'utf8'))) canonical.set(name, value);
}

const presentationFiles = walk(SRC).filter((file) => {
	const rel = relative(SRC, file).split('\\').join('/');
	if (SKIP_FILES.includes(rel)) return false;
	if (SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix))) return false;
	return PRESENTATION_PREFIXES.some((prefix) => rel.startsWith(prefix));
});

describe('presentation token ownership', () => {
	it('declares every spatial role the TypeScript table paints with', () => {
		const tokens = declarations(readFileSync(TOKEN_FILE, 'utf8'));
		for (const [role, token] of Object.entries(SPATIAL_PAINT_CSS_VAR)) {
			expect(tokens.has(token), `${token} is missing from presentation-tokens.css`).toBe(true);
			expect(tokens.get(token), `${token} drifted from spatial-paint.ts (${role})`).toBe(
				normalize(SPATIAL_PAINT_ROLES[role as keyof typeof SPATIAL_PAINT_ROLES])
			);
		}
	});

	it('resolves every canonical var() in a presentation component', () => {
		const unresolved: string[] = [];
		for (const file of presentationFiles) {
			const css = presentationCss(file, readFileSync(file, 'utf8'));
			for (const match of css.matchAll(/var\(\s*(--(?:shell|stage|cursor)-[a-z0-9-]+)/gi)) {
				if (!canonical.has(match[1])) unresolved.push(`${relative(SRC, file)}: ${match[1]}`);
			}
		}
		expect(unresolved).toEqual([]);
	});

	it('adds no fallback to a canonical role', () => {
		const fallbacks: string[] = [];
		for (const file of presentationFiles) {
			const css = presentationCss(file, readFileSync(file, 'utf8'));
			for (const match of css.matchAll(/var\(\s*(--(?:shell|stage|cursor)-[a-z0-9-]+)\s*([\s\S]*?)\)/gi)) {
				if (!canonical.has(match[1])) continue;
				const rest = match[2].trimStart();
				// A functional fallback such as `drop-shadow(...)` closes before the
				// outer `)`, so the first non-space character is the reliable signal.
				if (rest.startsWith(',')) fallbacks.push(`${relative(SRC, file)}: ${match[1]}`);
			}
		}
		expect(fallbacks).toEqual([]);
	});

	it('does not repeat a canonical role value as a literal', () => {
		const roleValues = new Map<string, string>();
		for (const [name, value] of canonical) {
			if (!/^#[0-9a-f]{6}$/.test(value)) continue;
			if (!roleValues.has(value)) roleValues.set(value, name);
		}
		const copies: string[] = [];
		for (const file of presentationFiles) {
			const rel = relPath(file);
			if (INDEPENDENT_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;
			const css = presentationCss(file, readFileSync(file, 'utf8'));
			const lines = css.split('\n');
			lines.forEach((line, index) => {
				for (const match of line.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
					const role = roleValues.get(normalize(match[0]));
					if (role !== undefined) copies.push(`${relative(SRC, file)}:${index + 1} ${match[0]} duplicates ${role}`);
				}
			});
		}
		expect(copies).toEqual([]);
	});

	it('declares a shared colour role only in the token source', () => {
		const colourRoles = new Set(
			[...canonical].filter(([, value]) => /^(#|rgba?\()/.test(value)).map(([name]) => name)
		);
		const redeclared: string[] = [];
		for (const file of presentationFiles) {
			const css = presentationCss(file, readFileSync(file, 'utf8'));
			for (const name of declarations(css).keys()) {
				if (colourRoles.has(name)) redeclared.push(`${relative(SRC, file)}: ${name}`);
			}
		}
		expect(redeclared).toEqual([]);
	});

	it('keeps the visitor presentation independent of editor skin and spatial roles', () => {
		const coupled: string[] = [];
		for (const file of presentationFiles) {
			const rel = relPath(file);
			if (!INDEPENDENT_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;
			const css = presentationCss(file, readFileSync(file, 'utf8'));
			for (const match of css.matchAll(/var\(\s*(--(?:shell|stage|cursor)-[a-z0-9-]+)/gi)) {
				coupled.push(`${rel}: ${match[1]}`);
			}
		}
		expect(coupled).toEqual([]);
	});

	it('allows theme overrides for shell roles only, never spatial paint', () => {
		// Comments mention [data-theme]; only a real selector block is an override.
		const css = readFileSync(TOKEN_FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
		const stageRoles = new Set(Object.values(SPATIAL_PAINT_CSS_VAR));
		const overrides: string[] = [];
		for (const match of css.matchAll(/\[data-theme[^{]*\{([^}]*)\}/gi)) {
			for (const declaration of match[1].matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
				const name = declaration[1];
				if (!name.startsWith('--shell-')) overrides.push(`${name} (theme override)`);
				if (stageRoles.has(name)) overrides.push(`${name} (spatial role)`);
			}
		}
		// A stage role is declared only in the base :root block.
		const withoutBase = css.replace(/:root\s*\{[\s\S]*?\n\}/, '');
		for (const name of stageRoles) {
			if (new RegExp(`${name}\\s*:`).test(withoutBase)) overrides.push(`${name} (outside :root)`);
		}
		expect(overrides).toEqual([]);
		expect(rootDeclarations(css).size).toBeGreaterThan(0);
	});

	it('keeps the retired duplicate names out of the tree', () => {
		const retired = [
			'--shell-forest-2',
			'--shell-proposal',
			'--shell-draft-ink',
			'--shell-draft-halo',
			'--shell-ghost',
			'--shell-ghost-halo',
			'--head-ink-quiet',
			'--chassis-hairline'
		];
		const found: string[] = [];
		for (const file of presentationFiles) {
			const source = readFileSync(file, 'utf8');
			for (const name of retired) {
				if (source.includes(`var(${name}`)) found.push(`${relative(SRC, file)}: ${name}`);
			}
		}
		expect(found).toEqual([]);
	});
});
