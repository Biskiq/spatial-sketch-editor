import path from 'node:path';
import type { Plugin } from 'vite';
import {
	formatPreviewSurfaceValidation,
	validatePreviewSurfaceGraph,
	type PreviewSurfaceModuleEdge
} from '../src/lib/visitor/preview-surface-boundary';
import { collectUnresolvedDynamics } from './preview-surface-dynamic-scan';

/**
 * P22.3 — public-route bundle gate.
 *
 * Walks Vite/Rollup's resolved, transformed module graph from the public
 * `/p/:publicationId` page root through `importedIds` +
 * `dynamicallyImportedIds`. Missing root, unresolved internal edges and
 * forbidden runtime modules fail the build. Reuses the preview-surface
 * forbidden set (the editor `src/lib/authoring/` tree, Chopin runtime, editor
 * codecs/stores) so the public cold bootstrap stays independently
 * visitor-safe. Computed `import(variable)` dynamics leave no
 * graph edge, so the `transform` hook records transformed sources and the
 * closure walk additionally rejects expression-form dynamics.
 *
 * The existing preview-surface gate stays untouched; this gate covers the
 * complete public route closure (page chrome + public loader + shared
 * surface), including ancestor layouts, dynamic imports and shared chunks
 * via the transitive closure walk. A source-only check of the inner
 * surface is insufficient.
 */
export function publicSurfaceBoundaryPlugin(): Plugin {
	const transformedSources = new Map<string, string>();

	return {
		name: 'public-surface-boundary',
		apply: 'build',
		transform(code, id) {
			if (!id.includes('node_modules')) transformedSources.set(id, code);
			return undefined;
		},
		generateBundle(_options, _bundle) {
			const getModuleInfo = this.getModuleInfo.bind(this);
			const getModuleIds = this.getModuleIds.bind(this);

			let rootId: string | null = null;
			for (const id of getModuleIds()) {
				if (id.endsWith('routes/p/[publicationId]/+page.svelte')) {
					rootId = id;
					break;
				}
			}
			if (!rootId) {
				throw new Error(
					'[public-surface-boundary] missing root: routes/p/[publicationId]/+page.svelte not in module graph'
				);
			}

			const modules = new Map<string, PreviewSurfaceModuleEdge>();
			const pending: string[] = [rootId];
			const seen = new Set<string>();
			while (pending.length > 0) {
				const id = pending.pop()!;
				if (seen.has(id)) continue;
				seen.add(id);
				const info = getModuleInfo(id);
				if (!info) {
					modules.set(id, { imports: [], dynamicImports: [] });
					continue;
				}
				const imports = [...(info.importedIds ?? [])];
				const dynamicImports = [...(info.dynamicallyImportedIds ?? [])];
				modules.set(id, { imports, dynamicImports });
				for (const next of [...imports, ...dynamicImports]) {
					if (!seen.has(next)) pending.push(next);
				}
			}

			const result = validatePreviewSurfaceGraph({
				rootId,
				modules,
				unresolvedDynamics: collectUnresolvedDynamics(transformedSources, seen)
			});
			const trulyMissing: string[] = [];
			for (const [id] of modules) {
				if (!getModuleInfo(id)) trulyMissing.push(id);
			}
			if (trulyMissing.length > 0 || !result.ok) {
				const details = [
					...trulyMissing.map((id) => `missing module ${id}`),
					formatPreviewSurfaceValidation(result)
				]
					.filter(Boolean)
					.join('\n');
				throw new Error(
					`[public-surface-boundary] public route import closure violates isolation:\n${details}\n(root: ${path.relative(process.cwd(), rootId)})`
				);
			}
		}
	};
}
