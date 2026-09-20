import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VISITOR_ROUTES_DIR } from '../../helpers/lib-source';

const appSrc = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../museum/src');
const libRoot = resolve(appSrc, 'lib');
const entry = resolve(appSrc, 'routes/museum/+page.svelte');
const extensions = ['', '.ts', '.svelte', '.json'];

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
	const pattern = /(?:import|export)\s+(?!type\b)[\s\S]*?\sfrom\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
	while (pending.length > 0) {
		const file = pending.pop()!;
		if (visited.has(file)) continue;
		visited.add(file);
		if (extname(file) === '.json') continue;
		const source = readFileSync(file, 'utf8');
		for (const match of source.matchAll(pattern)) {
			const dependency = resolveImport(file, match[1] ?? match[2] ?? '');
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
			const source = readFileSync(file, 'utf8');
			expect(source, file).not.toMatch(
				/(?:from|import\()\s*['"][^'"]*(?:\$lib\/editor|(?:\.\.?\/)\.?editor\/)/
			);
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
	const editorSrc = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src');

	it('keeps every editor source free of museum-app imports', () => {
		for (const file of sourceFiles(editorSrc)) {
			const source = readFileSync(file, 'utf8');
			expect(source, file).not.toMatch(
				/(?:from|import\()\s*['"][^'"]*(?:@portfolio\/museum|apps\/museum|museum\/src)/
			);
		}
	});

	it('keeps the shared museum shell free of editor internals', () => {
		const shared = sourceFiles(resolve(editorSrc, 'lib/museum'));
		expect(shared.length).toBeGreaterThan(0);
		for (const file of shared) {
			const source = readFileSync(file, 'utf8');
			expect(source, file).not.toMatch(
				/(?:from|import\()\s*['"][^'"]*(?:\$lib\/editor|(?:^|\/)\.\.\/editor\/)/
			);
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
