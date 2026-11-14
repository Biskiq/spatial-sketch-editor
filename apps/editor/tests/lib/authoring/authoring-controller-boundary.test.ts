/**
 * X1 / schedule guarantee — cohesive controllers, no new God module.
 *
 * The route's extracted controllers may compose only the owners their contract
 * names. They must not import the route, a renderer, an adapter implementation,
 * an F4 planner or another sibling's mutable internals; a controller that could
 * read those directly would be a parallel owner wearing a new filename.
 *
 * Direct imports are read with the shared import-closure reader so aliases,
 * namespaces, re-exports and dynamic imports all count. A synthetic closure
 * proves a local re-export barrel cannot hide a forbidden edge.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	EDITOR_LIB,
	EDITOR_SRC,
	moduleBindingEdges,
	relativeToRepo,
	resolveSpecifier
} from '../../helpers/import-closure';

const ROUTE = path.join(EDITOR_SRC, 'routes/project/[projectId]/spatial/+page.svelte');
const EPOCH = path.join(EDITOR_LIB, 'authoring/stage/route/stage-project-epoch.svelte.ts');
const ASSETS = path.join(EDITOR_LIB, 'authoring/stage/route/stage-asset-leases.svelte.ts');

type ResolvedEdge = {
	readonly kind: string;
	readonly specifier: string;
	readonly target: string;
	readonly typeOnly: boolean;
};

function edgesOf(file: string): ResolvedEdge[] {
	const source = fs.readFileSync(file, 'utf8');
	const resolved: ResolvedEdge[] = [];
	for (const edge of moduleBindingEdges(file, source)) {
		// `export-local` is a local alias, not a module dependency.
		if (!('specifier' in edge)) continue;
		const target = resolveSpecifier(file, edge.specifier);
		if (target === null) continue;
		resolved.push({
			kind: edge.kind,
			specifier: edge.specifier,
			target,
			typeOnly: 'typeOnly' in edge && edge.typeOnly
		});
	}
	return resolved;
}

function executable(edges: readonly ResolvedEdge[]): ResolvedEdge[] {
	return edges.filter((edge) => !edge.typeOnly);
}

/** Repository-relative prefix test (paths use `/` on every platform here). */
function under(file: string, directory: string): boolean {
	return file === directory || file.startsWith(`${directory}/`);
}

/**
 * A synthetic transitive import walk over virtual sources. It follows the same
 * edge shapes as `moduleBindingEdges`: named, aliased, namespace, export *,
 * re-export and dynamic imports.
 */
function reaches(sources: Record<string, string>, root: string, forbidden: string): boolean {
	const seen = new Set<string>();
	const pending = [root];
	while (pending.length > 0) {
		const file = pending.pop()!;
		if (seen.has(file)) continue;
		seen.add(file);
		if (file === forbidden) return true;
		for (const edge of moduleBindingEdges(file, sources[file] ?? '')) {
			if (!('specifier' in edge)) continue;
			if ('typeOnly' in edge && edge.typeOnly === true) continue;
			const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), edge.specifier));
			const resolved = target in sources ? target : `${target}.ts`;
			if (!(resolved in sources)) continue;
			pending.push(resolved);
		}
	}
	return false;
}

describe('authoring controller boundary (X1)', () => {
	it('never lets an extracted controller import the route', () => {
		for (const file of [EPOCH, ASSETS]) {
			expect(edgesOf(file).filter((edge) => edge.target === ROUTE), relativeToRepo(file)).toEqual([]);
		}
	});

	it('keeps the project epoch on the existing session/acceptance/adapter owners', () => {
		const editable = executable(edgesOf(EPOCH)).map((edge) => relativeToRepo(edge.target));
		const forbidden = [
			'packages/layout-core/src/index.ts',
			'packages/project-model/src/index.ts',
			'apps/editor/src/lib/authoring/adapters/layout.adapter.ts'
		];
		expect(editable.filter((file) => forbidden.includes(file))).toEqual([]);
		expect(editable.filter((file) => under(file, 'apps/editor/src/lib/render'))).toEqual([]);
		expect(editable.filter((file) => under(file, 'apps/editor/src/lib/authoring/adapters'))).toEqual([]);

		// The facade is a type contract here; only the existing owners are executed.
		const facadeEdges = edgesOf(EPOCH).filter((edge) => edge.target.endsWith('stage-facade.ts'));
		expect(facadeEdges.length).toBeGreaterThan(0);
		expect(facadeEdges.every((edge) => edge.typeOnly)).toBe(true);

		// The asset leases are composed by identity, never by reaching into state.
		const assetEdges = edgesOf(EPOCH).filter((edge) => edge.target === ASSETS);
		expect(assetEdges.length).toBeGreaterThan(0);
		expect(assetEdges.every((edge) => edge.typeOnly)).toBe(true);
	});

	it('keeps the asset leases on the existing model/artwork acquisition owners', () => {
		const edges = edgesOf(ASSETS);
		const editable = executable(edges);
		const targets = editable.map((edge) => relativeToRepo(edge.target));
		expect(targets).not.toContain('apps/editor/src/lib/authoring/stage/host-acceptance.ts');
		expect(targets).not.toContain('apps/editor/src/lib/authoring/stage/stage-adapter-host.ts');
		expect(targets).not.toContain('apps/editor/src/lib/authoring/stage/stage-facade.ts');
		expect(targets.filter((file) => under(file, 'apps/editor/src/lib/authoring/adapters'))).toEqual([]);
		expect(targets).not.toContain('packages/layout-core/src/index.ts');

		const renderTargets = editable
			.map((edge) => relativeToRepo(edge.target))
			.filter((file) => under(file, 'apps/editor/src/lib/render'));
		expect(renderTargets).toEqual(['apps/editor/src/lib/render/artwork/artwork-scope.ts']);
	});

	it('fails a forbidden dependency hidden behind an alias, barrel, namespace or dynamic import', () => {
		const sources: Record<string, string> = {
			'owner/route.ts': '',
			'owner/barrel.ts': "export { createStageAcceptanceHost as mount } from './route';",
			'owner/alias.ts': "import { createStageAcceptanceHost as mount } from './route';",
			'owner/namespace.ts': "import * as route from './route';",
			'owner/star.ts': "export * from './barrel';",
			'owner/via-star.ts': "import { mount as m } from './star';",
			'owner/dynamic.ts': "export async function load() { return import('./route'); }",
			'owner/control.ts': "import { unrelated } from './other';"
		};
		for (const file of ['owner/barrel.ts', 'owner/alias.ts', 'owner/namespace.ts', 'owner/via-star.ts', 'owner/dynamic.ts']) {
			expect(reaches(sources, file, 'owner/route.ts'), file).toBe(true);
		}
		expect(reaches(sources, 'owner/control.ts', 'owner/route.ts')).toBe(false);
	});
});

