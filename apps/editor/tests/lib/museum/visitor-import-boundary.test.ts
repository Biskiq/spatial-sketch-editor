import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VISITOR_ROUTES_DIR } from '../../helpers/lib-source';

const appSrc = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../museum/src');
const editorSrc = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src');
const libRoot = resolve(appSrc, 'lib');
const entry = resolve(appSrc, 'routes/museum/+page.svelte');
const extensions = ['', '.ts', '.svelte', '.json'];

/**
 * Module specifiers of a source file: static `import`/`export … from` and
dynamic `import(…)`. **One owner** — the reachability walk and both
import-direction sweeps below ask the same question of the same list, because
two subtly different specifier patterns is exactly how a real violation hid
from one of them.
 */
const MODULE_SPECIFIER =
	/(?:import|export)\s+(?!type\b)[\s\S]*?\sfrom\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function importedSpecifiers(source: string): string[] {
	return [...source.matchAll(MODULE_SPECIFIER)].map((match) => match[1] ?? match[2] ?? '');
}

/** The editor's internal tree — `apps/editor/src/lib/editor` — from either app. */
const EDITOR_INTERNALS = resolve(editorSrc, 'lib/editor');

/**
 * Does a specifier reach the editor's internals?
 *
 * The alias form (`$lib/editor/…`) names editor internals outright, so it is
 * forbidden as written in both trees. A relative specifier is **resolved**
 * against its importer: `../editor/foo` from a file directly under
 * `src/lib/museum`, `./editor/foo`, and multi-level hops like
 * `../../lib/editor/foo` all land in the same forbidden directory.
 *
 * Resolution, not a regex over source text: `^` in such a pattern anchors to the
 * start of the *file*, not to the start of the quoted specifier, so the common
 * one-level form `import x from '../editor/foo'` slipped straight through.
 */
function reachesEditorInternals(importer: string, specifier: string): boolean {
	if (specifier === '$lib/editor' || specifier.startsWith('$lib/editor/')) return true;
	if (!specifier.startsWith('.')) return false;
	const resolved = resolve(dirname(importer), specifier);
	return resolved === EDITOR_INTERNALS || resolved.startsWith(`${EDITOR_INTERNALS}/`);
}

/** The editor-internals specifiers one file imports (empty means clean). */
function editorInternalImports(file: string): string[] {
	return importedSpecifiers(readFileSync(file, 'utf8')).filter((specifier) =>
		reachesEditorInternals(file, specifier)
	);
}

function resolveImport(importer: string, specifier: string): string | null {
	const base = specifier.startsWith('$lib/')
		? resolve(libRoot, specifier.slice('$lib/'.length))
		: specifier.startsWith('.')
			? resolve(dirname(importer), specifier)
			: null;
	if (!base) return null;
	for (const extension of extensions) {
		const candidate = `${base}${extension}`;
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	}
	return null;
}

function visitorImportGraph(): Set<string> {
	const visited = new Set<string>();
	const pending = [entry];
	while (pending.length > 0) {
		const file = pending.pop()!;
		if (visited.has(file)) continue;
		visited.add(file);
		if (extname(file) === '.json') continue;
		for (const specifier of importedSpecifiers(readFileSync(file, 'utf8'))) {
			const dependency = resolveImport(file, specifier);
			if (dependency && !visited.has(dependency)) pending.push(dependency);
		}
	}
	return visited;
}

function sourceFiles(root: string): string[] {
	const files: string[] = [];
	const pending = [root];
	while (pending.length > 0) {
		const file = pending.pop()!;
		const stat = statSync(file);
		if (stat.isDirectory()) {
			for (const child of readdirSync(file)) {
				if (!child.startsWith('.')) pending.push(resolve(file, child));
			}
		} else if (file.endsWith('.ts') || file.endsWith('.svelte')) {
			files.push(file);
		}
	}
	return files;
}

describe('visitor import boundary', () => {
	it('uses one serialized project/layout path with no editor or legacy architecture imports', () => {
		const graph = visitorImportGraph();
		const relative = [...graph].map((file) => file.slice(appSrc.length + 1));
		expect(relative).toContain('lib/content/chopin-project.json');
		expect(relative).toContain('lib/museum/layout/LayoutMuseumShell.svelte');
		expect(relative).toContain('lib/layout/layout-geometry.ts');
		expect(relative.some((file) => file.includes('/editor/'))).toBe(false);
		expect(relative).not.toContain('lib/content/rooms.ts');
		expect(relative).not.toContain('lib/content/rooms-to-layout.ts');
		expect(relative).not.toContain('lib/content/scene.json');
		expect(relative).not.toContain('lib/museum/layout/MuseumShell.svelte');
	});

	it('contains no architecture source toggle in visitor entry components', () => {
		for (const file of [
			entry,
			resolve(libRoot, 'museum/MuseumCanvas.svelte'),
			resolve(libRoot, 'museum/MuseumScene.svelte')
		]) {
			const source = readFileSync(file, 'utf8');
			expect(source).not.toContain('architectureSource');
			expect(source).not.toContain('architecture=layout');
		}
	});

	it('keeps all museum source imports free of editor code', () => {
		for (const file of sourceFiles(resolve(appSrc, 'lib/museum'))) {
			const offenders = editorInternalImports(file);
			expect(offenders, `${file} imports ${offenders.join(', ')}`).toEqual([]);
		}
	});
});

/**
 * T3b — the shared museum-rendering shell, swept in both directions.
 *
 * The suites above prove the visitor never reaches *editor* code. Two
 * directions were unpinned after the accumulator was dismantled:
 *
 * 1. the editor app never imports the museum **app** (`apps/museum`) — the
 *    editor's own `$lib/museum` rendering shell is legitimate and stays;
 * 2. that shared `$lib/museum` shell stays free of editor internals, because
 *    the visitor build consumes the same components — an editor import there
 *    would pull the whole editor into the public bundle.
 */
describe('shared museum shell — import direction', () => {
	it('keeps every editor source free of museum-app imports', () => {
		for (const file of sourceFiles(editorSrc)) {
			const source = readFileSync(file, 'utf8');
			expect(source, file).not.toMatch(
				/(?:from|import\()\s*['"][^'"]*(?:@portfolio\/museum|apps\/museum|museum\/src)/
			);
		}
	});

	it('keeps the shared museum shell free of editor internals', () => {
		// The editor's `$lib/museum` is the shared rendering shell the visitor
		// build consumes too, so an editor-internal import here would pull the
		// whole editor into the public bundle.
		const shared = sourceFiles(resolve(editorSrc, 'lib/museum'));
		expect(shared.length).toBeGreaterThan(0);
		for (const file of shared) {
			const offenders = editorInternalImports(file);
			expect(offenders, `${file} imports ${offenders.join(', ')}`).toEqual([]);
		}
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P1.5 Camera Plan source contracts', () => {
	it('keeps Camera Plan editor-only: /museum routes import no camera-plan code', () => {
		const visitor = fs.readFileSync(path.join(VISITOR_ROUTES_DIR, 'museum/+page.svelte'), 'utf8');
		expect(visitor).not.toContain('camera-plan');
		expect(visitor).not.toContain('CameraPlan');
		expect(visitor).not.toContain('plan-camera-projection');
	});
});
