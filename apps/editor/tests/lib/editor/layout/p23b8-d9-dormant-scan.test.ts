/**
 * P23B.8 follow-up S3 — D9 pre-removal dormant scan.
 *
 * Proves dormant FIRST (same technique as the p23b7 guard): a source-shape
 * scan over production importers (genuine architecture invariant — the mapping
 * is module-private, so no production importer can read it) plus the
 * behavioral proof that S-R accessors preserve the raw geometry identity
 * (so the `live !== geometry` compatibility branch never fires). Runs GREEN
 * pre-removal; the removal commit deletes the WeakMap + branch.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	createClientReactiveLayoutPreviewState,
	isSvelteStateProxy,
	loadClientCompiledPreviewModule
} from './p23b7-reactive-preview-state';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** apps/editor/src — the production tree the scan walks. */
const SRC_ROOT = path.resolve(HERE, '../../../../src');

async function walkProductionFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const full = path.join(root, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkProductionFiles(full)));
		} else if (/\.(ts|svelte)$/.test(entry.name)) {
			files.push(full);
		}
	}
	return files;
}

describe('p23b.8 S3 — D9 dormant mapping has no production readers', () => {
	it('wallMeshIdentities / wallMeshCacheKey are module-private with zero production importers', async () => {
		const defining = await readFile(
			path.join(SRC_ROOT, 'lib/editor/layout/layout-preview-state.svelte.ts'),
			'utf8'
		);
		// Not exported: no production module can name them.
		expect(defining).not.toMatch(/export\s+(const|function)\s+wallMeshIdentities/);
		expect(defining).not.toMatch(/export\s+function\s+wallMeshCacheKey/);
		expect(defining).not.toMatch(/export\s+function\s+installWallGeometry/);

		const files = await walkProductionFiles(SRC_ROOT);
		const readers: string[] = [];
		for (const file of files) {
			if (file.endsWith('layout-preview-state.svelte.ts')) continue;
			const text = await readFile(file, 'utf8');
			if (/wallMeshIdentities|wallMeshCacheKey/.test(text)) readers.push(path.relative(SRC_ROOT, file));
		}
		expect(readers, 'no production file reads the dormant mapping').toEqual([]);
	});

	it('S-R accessors preserve raw geometry identity, so the compat branch never fires', async () => {
		const preview = await createClientReactiveLayoutPreviewState();
		const runtime = await loadClientCompiledPreviewModule();
		// Import a minimal document through the production seam, then check the
		// live read-back is the raw compile identity — the condition that keeps
		// `installWallGeometry` from ever populating the WeakMap.
		const { createEmptySceneDocument } = await import('$lib/content/scene');
		const { serializeWallFirstLayoutDocument } = await import(
			'$lib/layout/layout-wall-first-codec'
		);
		const { buildP23BMatrixFixture, P23B_MATRIX_SPECS } = await import('$lib/bench/p23b-fixtures');
		void createEmptySceneDocument;
		const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === 'p23b-12-wall-target-curved-v1');
		if (!spec) throw new Error('fixture spec missing');
		const json = serializeWallFirstLayoutDocument(buildP23BMatrixFixture(spec));
		expect(runtime.importLayoutPreviewJson(preview, json)).toBe(true);
		expect(isSvelteStateProxy(preview.geometry), 'compiled geometry stays raw').toBe(false);
		const snapshot = runtime.captureLayoutPreviewSnapshot(preview);
		expect(snapshot.geometry, 'capture hands restore the installed raw identity').toBe(
			preview.geometry
		);
	});
});
