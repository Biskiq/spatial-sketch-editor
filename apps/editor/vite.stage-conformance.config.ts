/** Explicit local browser harness. Never selected by dev/build/production scripts. */
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import production from './vite.config';

const catalog = fileURLToPath(new URL('./src/lib/authoring/adapters/catalog.ts', import.meta.url));
const route = fileURLToPath(new URL('./src/routes/project/[projectId]/spatial/+page.svelte', import.meta.url));
const probe = fileURLToPath(new URL('./tests/e2e/stage-conformance/probe-adapter.ts', import.meta.url));

/**
 * The route's root element is the injection point. It is matched exactly so a
 * class or attribute change is a loud harness failure, not a silently unpatched
 * route whose screenshot still claims the replacement guard was exercised.
 */
const ROOT_MARKER = '<div class="editor-host">';

/**
 * The replacement control is `position: fixed`: it is out of flow, so the Stage,
 * Head and Card geometry the transcript measures stay production-identical. It is
 * a test-only overlay, never a shell element.
 */
const REPLACEMENT_CONTROL =
	`${ROOT_MARKER}<button type="button" data-stage-conformance-replacement` +
	` style="position:fixed;top:0.35rem;left:50%;transform:translateX(-50%);z-index:40;padding:0.3rem 0.6rem"` +
	` onclick={() => requestReplacement('starter')}>Replace conformance starter</button>`;

export default mergeConfig(defineConfig({ plugins: [{
	name: 'stage-browser-conformance-only', enforce: 'pre',
	transform(code, id) {
		const [file, query] = id.split('?');
		if (file === route) {
			// The Svelte plugin also transforms the component's style block through
			// this id with a query. Only that sub-request is skipped: an HMR update
			// arrives with a `?t=` stamp and still carries markup, so skipping every
			// query would silently drop the control mid-session.
			if (query !== undefined && query.includes('type=style')) return;
			const patched = code.replace(ROOT_MARKER, REPLACEMENT_CONTROL);
			if (patched === code) {
				throw new Error(
					`stage-conformance: the route root marker ${ROOT_MARKER} is gone, so the replacement control was not injected.`
				);
			}
			return patched;
		}
		if (file !== catalog) return;
		return `import { createAdapter } from ${JSON.stringify(probe)}; export const stageAdapterFactories = [createAdapter];`;
	}
}] }), production);
