/** Explicit local browser harness. Never selected by dev/build/production scripts. */
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import production from './vite.config';

const catalog = fileURLToPath(new URL('./src/lib/authoring/adapters/catalog.ts', import.meta.url));
const route = fileURLToPath(new URL('./src/routes/project/[projectId]/spatial/+page.svelte', import.meta.url));
const probe = fileURLToPath(new URL('./tests/e2e/stage-conformance/probe-adapter.ts', import.meta.url));
export default mergeConfig(defineConfig({ plugins: [{
	name: 'stage-browser-conformance-only', enforce: 'pre',
	transform(_code, id) {
		if (id.split('?')[0] === route) return _code.replace('<div class="editor-host">',
			`<div class="editor-host"><button type="button" onclick={() => requestReplacement('starter')}>Replace conformance starter</button>`);
		if (id.split('?')[0] !== catalog) return;
		return `import { createAdapter } from ${JSON.stringify(probe)}; export const stageAdapterFactories = [createAdapter];`;
	}
}] }), production);
