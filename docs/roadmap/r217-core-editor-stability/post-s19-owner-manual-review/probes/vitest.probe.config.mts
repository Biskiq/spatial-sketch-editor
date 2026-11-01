// PR #247 evidence runner. Run from apps/editor of a checkout whose node_modules resolve:
//   npx vitest run --config <this file>
// It is outside every test lane on purpose; the probes report facts, they are not product tests.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const editor = process.env.PROBE_EDITOR ?? path.resolve(here, '../../../../../apps/editor');

export default defineConfig({
	root: here,
	resolve: { conditions: ['browser'], alias: { $lib: path.join(editor, 'src/lib') } },
	server: { fs: { strict: false } },
	test: { include: ['*.probe.ts'], environment: 'node', reporters: ['dot'] }
});
