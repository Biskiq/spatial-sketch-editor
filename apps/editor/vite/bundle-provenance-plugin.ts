import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { sealProvenance, sha256 } from '../perf/bundle-provenance.mjs';

/** Opt-in measurement artifact only; ordinary builds emit nothing extra.
 * Rollup identities include virtual/generated modules even when maps are empty.
 * writeBundle binds identities to final on-disk bytes (including map comments).
 */
export function bundleProvenancePlugin(enabled = process.env.BUNDLE_PROVENANCE === '1'): Plugin {
	let clientBuild = false;
	let root = '';
	return {
		name: 'bundle-module-provenance',
		apply: 'build',
		enforce: 'post',
		configResolved(config) {
			clientBuild = enabled && !config.build.ssr;
			root = config.root;
		},
		writeBundle(options, bundle) {
			if (!clientBuild) return;
			if (!options.dir) throw new Error('bundle provenance requires an output directory');
			const directory = resolve(root, options.dir);
			const moduleIds = (entry: Extract<(typeof bundle)[string], { type: 'chunk' }>) => {
				// Rollup can emit a pure re-export facade with no rendered modules.
				// Its facadeModuleId is still build-owned identity, not a text heuristic.
				const ids = [...new Set([...Object.keys(entry.modules), ...(entry.facadeModuleId ? [entry.facadeModuleId] : [])])];
				if (!ids.length || ids.some((id) => !this.getModuleInfo(id))) throw new Error(`missing Rollup module identity for ${entry.fileName}`);
				return ids.map((id) => id.replace(/\\/g, '/')).sort();
			};
			const chunks = Object.values(bundle).filter((entry) => entry.fileName.endsWith('.js')).map((entry) => ({
				file: entry.fileName,
				sha256: sha256(readFileSync(join(directory, entry.fileName))),
				modules: entry.type === 'chunk' ? moduleIds(entry) : null
			})).sort((a, b) => a.file.localeCompare(b.file));
			writeFileSync(join(directory, 'bundle-provenance.json'), JSON.stringify(sealProvenance(chunks), null, 2));
		}
	};
}
