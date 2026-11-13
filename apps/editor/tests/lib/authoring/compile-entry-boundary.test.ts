/**
 * E4 / I2 — one compiler read path for authoring (`compile-entry-boundary`).
 *
 * Under `apps/editor/src`, only the Stage acceptance host and the Layout
 * adapter's project-owned compile seam may reach a Layout compile function, and
 * only the host may touch the passive compile record. Every other module
 * receives compiled geometry. Indirect compiles stay allowed on purpose, because
 * they reach the canonical read: `prepareValidatedUnitRuntime`,
 * `resolveSceneSupport` and the layout-core planners. A module
 * "reaches" a compile function when it imports one by name (directly, under an
 * alias, or through a local re-export barrel), imports a module that provides
 * one as a namespace or dynamically, or re-exports one itself.
 *
 * Bindings are read with the TypeScript AST through the shared import-closure
 * reader; type-only imports are not executable edges and are ignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	EDITOR_LIB,
	PACKAGES_ROOT,
	listSourceFiles,
	moduleBindingEdges,
	relativeToRepo,
	resolveSpecifier,
	type ModuleBindingEdge
} from '../../helpers/import-closure';

const COMPILE_FUNCTIONS = [
	'compileWallFirstLayoutGeometry',
	'compileWallFirstLayoutGeometryFresh',
	'compileLayoutGeometrySource',
	'createLayoutCompileSession',
	'withLayoutCompileSession',
	'activeLayoutCompileSession'
] as const;
const RECORD_FUNCTIONS = ['recordPassiveCompiledGeometry', 'readPassiveCompiledGeometry'] as const;

const LAYOUT_CORE = path.join(PACKAGES_ROOT, 'layout-core/src/index.ts');
const AUTHORING = path.join(EDITOR_LIB, 'authoring');
const EDITOR_SRC_ROOT = path.dirname(EDITOR_LIB);

/** The exact permitted sites, each with its owning reason. */
const PERMITTED = new Map<string, string>([
	[path.join(AUTHORING, 'stage/host-acceptance.ts'), 'admission compiles each accepted source through its host-lifetime session'],
	[path.join(AUTHORING, 'adapters/layout/compile-context.ts'), "the Layout adapter's project-epoch compile seam (E4)"]
]);
const RECORD_PERMITTED = new Set([path.join(AUTHORING, 'stage/host-acceptance.ts')]);

type Graph = {
	readonly files: readonly string[];
	readonly edges: (file: string) => readonly ModuleBindingEdge[];
	readonly resolve: (importer: string, specifier: string) => string | null;
	/** Modules that provide every compile function by definition. */
	readonly origins: ReadonlySet<string>;
};

/** Which compile-function names each module exports (origin, re-export or barrel). */
function providedNames(graph: Graph, names: readonly string[]): Map<string, Set<string>> {
	const provided = new Map<string, Set<string>>();
	for (const origin of graph.origins) provided.set(origin, new Set(names));
	const namesOf = (file: string | null) => (file === null ? undefined : provided.get(file));
	let changed = true;
	while (changed) {
		changed = false;
		for (const file of graph.files) {
			const own = provided.get(file) ?? new Set<string>();
			const before = own.size;
			const localCompile = new Map<string, string>();
			for (const edge of graph.edges(file)) {
				if (edge.kind === 'import-named' && !edge.typeOnly && namesOf(graph.resolve(file, edge.specifier))?.has(edge.imported)) {
					localCompile.set(edge.local, edge.imported);
				}
			}
			for (const edge of graph.edges(file)) {
				if (edge.kind === 'export-named' && !edge.typeOnly && namesOf(graph.resolve(file, edge.specifier))?.has(edge.imported)) own.add(edge.exported);
				if (edge.kind === 'export-all') for (const name of namesOf(graph.resolve(file, edge.specifier)) ?? []) own.add(name);
				if (edge.kind === 'export-local' && localCompile.has(edge.local)) own.add(edge.exported);
			}
			if (own.size !== before) {
				provided.set(file, own);
				changed = true;
			}
		}
	}
	return provided;
}

/** The modules under `scope` that reach a compile function, with the first edge that does. */
function compileReaches(
	graph: Graph,
	scope: (file: string) => boolean,
	names: readonly string[] = COMPILE_FUNCTIONS
): Map<string, string> {
	const provided = providedNames(graph, names);
	const reaches = new Map<string, string>();
	for (const file of graph.files) {
		if (!scope(file)) continue;
		for (const edge of graph.edges(file)) {
			if (edge.kind === 'export-local') continue;
			const names = provided.get(graph.resolve(file, edge.specifier) ?? '');
			if (names === undefined || names.size === 0) continue;
			const executable = !('typeOnly' in edge) || !edge.typeOnly;
			const reached =
				(edge.kind === 'import-named' && executable && names.has(edge.imported)) ||
				(edge.kind === 'import-namespace' && executable) ||
				edge.kind === 'dynamic' ||
				edge.kind === 'export-all' ||
				(edge.kind === 'export-named' && executable && names.has(edge.imported));
			if (reached) {
				reaches.set(file, `${edge.kind} '${edge.specifier}'`);
				break;
			}
		}
	}
	return reaches;
}

let sharedGraph: Graph | null = null;

/** One parsed graph of the editor source, shared by every repository test. */
function repositoryGraph(): Graph {
	sharedGraph ??= buildRepositoryGraph();
	return sharedGraph;
}

function buildRepositoryGraph(): Graph {
	const files = listSourceFiles(EDITOR_SRC_ROOT).filter((file) => /\.(ts|svelte)$/.test(file));
	const cache = new Map<string, readonly ModuleBindingEdge[]>();
	return {
		files,
		origins: new Set([LAYOUT_CORE]),
		resolve: (() => {
			const resolved = new Map<string, string | null>();
			return (importer: string, specifier: string) => {
				const key = `${importer}\u0000${specifier}`;
				if (!resolved.has(key)) resolved.set(key, resolveSpecifier(importer, specifier));
				return resolved.get(key)!;
			};
		})(),
		edges(file) {
			let edges = cache.get(file);
			if (edges === undefined) {
				edges = moduleBindingEdges(file, fs.readFileSync(file, 'utf8'));
				cache.set(file, edges);
			}
			return edges;
		}
	};
}

/** A synthetic graph: virtual files, relative specifiers, one layout-core origin. */
function syntheticGraph(sources: Record<string, string>): Graph {
	const files = Object.keys(sources);
	return {
		files,
		origins: new Set(['@portfolio/layout-core']),
		resolve(importer, specifier) {
			if (specifier === '@portfolio/layout-core') return specifier;
			const target = path.posix.join(path.posix.dirname(importer), specifier) + '.ts';
			return target in sources ? target : null;
		},
		edges: (file) => moduleBindingEdges(file, sources[file]!)
	};
}

describe('compile-entry-boundary', { timeout: 60_000 }, () => {
	it('lets only the acceptance host and the Layout compile seam reach a compile function anywhere in the editor', () => {
		const reaches = compileReaches(repositoryGraph(), (file) => file.startsWith(`${EDITOR_SRC_ROOT}${path.sep}`));
		const offenders = [...reaches.entries()]
			.filter(([file]) => !PERMITTED.has(file))
			.map(([file, edge]) => `${relativeToRepo(file)} — ${edge}`);
		expect(offenders).toEqual([]);
	});

	it('lets only the acceptance host touch the passive compile record', () => {
		const reaches = compileReaches(
			repositoryGraph(),
			(file) => file.startsWith(`${EDITOR_SRC_ROOT}${path.sep}`),
			RECORD_FUNCTIONS
		);
		const offenders = [...reaches.entries()]
			.filter(([file, edge]) => !RECORD_PERMITTED.has(file) && !edge.startsWith('import-namespace') && !edge.startsWith('dynamic'))
			.map(([file, edge]) => `${relativeToRepo(file)} — ${edge}`);
		expect(offenders).toEqual([]);
	});

	it('names no stale permission: each permitted site really is the seam', () => {
		const reaches = compileReaches(repositoryGraph(), (file) => PERMITTED.has(file));
		expect([...PERMITTED.keys()].filter((file) => !reaches.has(file)).map(relativeToRepo)).toEqual([]);
	});

	it('fails an aliased import, a local barrel, export *, a namespace and a dynamic import', () => {
		const graph = syntheticGraph({
			'a/alias.ts': "import { compileWallFirstLayoutGeometry as compile } from '@portfolio/layout-core';\nexport const x = compile;",
			'a/barrel.ts': "export { createLayoutCompileSession as session } from '@portfolio/layout-core';",
			'a/via-barrel.ts': "import { session } from './barrel';\nsession();",
			'a/star.ts': "export * from './barrel';",
			'a/via-star.ts': "import { session as s } from './star';\ns();",
			'a/local-reexport.ts': "import { withLayoutCompileSession } from '@portfolio/layout-core';\nexport { withLayoutCompileSession as bound };",
			'a/via-local.ts': "import { bound } from './local-reexport';\nbound(undefined, () => 0);",
			'a/namespace.ts': "import * as core from '@portfolio/layout-core';\ncore.evaluateLayoutPlan;",
			'a/dynamic.ts': "export async function load() { return import('@portfolio/layout-core'); }",
			'a/type-only.ts': "import type { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';\nexport type T = typeof compileWallFirstLayoutGeometry;",
			'a/unrelated.ts': "import { evaluateLayoutPlan } from '@portfolio/layout-core';\nevaluateLayoutPlan;"
		});
		const reached = [...compileReaches(graph, () => true).keys()].sort();
		expect(reached).toEqual([
			'a/alias.ts',
			'a/barrel.ts',
			'a/dynamic.ts',
			'a/local-reexport.ts',
			'a/namespace.ts',
			'a/star.ts',
			'a/via-barrel.ts',
			'a/via-local.ts',
			'a/via-star.ts'
		]);
	});
});
