/**
 * Live editor route + shell-entry boundary (architecture).
 *
 * The `/museum/editor` relic entry has its own frozen smoke
 * (`relic-smoke.test.ts`); this file owns the *live* side: which route mounts
 * what, that the root/compatibility entries stay lightweight, that exactly one
 * keyed session is mounted per project, and that the project row never grows a
 * second navigation system. Absorbed verbatim from the dismantled
 * `contracts.test.ts` accumulator (T3a).
 */
import { describe, expect, it } from 'vitest';

import { readLibSource, readRouteSource } from '../../../helpers/lib-source';

/**
 * Slice the `onMount` block that bootstraps the project session, i.e. the
 * mount whose returned function is the A→B teardown.
 *
 * T6 audit — `projectRequestController?.abort()`, `invalidateProjectAssets()`
 * and `clearRetainedSourceAliases()` each appear at several other call sites in
 * `EditorApp.svelte`, so asserting bare containment stayed green even when the
 * teardown call was deleted. The pin has to name the call site.
 */
function sliceSessionTeardown(app: string): string {
	const marker = 'void bootstrapProjectSession(controller.signal);';
	const anchor = app.indexOf(marker);
	expect(anchor, 'EditorApp must bootstrap the project session from onMount').toBeGreaterThan(-1);
	const start = app.lastIndexOf('onMount(', anchor);
	const end = app.indexOf('\n\t});', anchor);
	expect(start, 'the session bootstrap must live in an onMount callback').toBeGreaterThan(-1);
	expect(end, 'the session onMount callback must close at top level').toBeGreaterThan(anchor);
	return app.slice(start, end);
}

/** Body of a top-level `function <name>(...) { ... }` declaration. */
function sliceFunctionBody(source: string, name: string): string {
	const anchor = source.indexOf(`function ${name}(`);
	expect(anchor, `EditorApp must declare ${name}()`).toBeGreaterThan(-1);
	const end = source.indexOf('\n\t}', anchor);
	expect(end, `${name}() must close at top level`).toBeGreaterThan(anchor);
	return source.slice(anchor, end);
}

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('route wiring (relic smoke proxy, no DOM harness)', () => {
	it('keeps the root and compatibility entry lightweight', () => {
		for (const routePath of ['+page.svelte', 'editor/+page.svelte']) {
			const source = readRouteSource(routePath);
			expect(source).not.toContain('EditorApp');
			expect(source).not.toContain('virtual:museum-editor-entry');
		}
		const root = readRouteSource('+page.svelte');
		const compatibility = readRouteSource('editor/+page.svelte');
		expect(root).toContain('Start creating');
		expect(root).toContain("signIn('projects')");
		expect(compatibility).toContain("/project/${encodeURIComponent(createProjectId())}/spatial");
		expect(readLibSource('editor/project-persistence.ts')).toContain("/auth/login?intent=");
	});
	it('mounts one keyed session in the shared project layout', () => {
		const spatial = readRouteSource('project/[projectId]/spatial/+page.svelte');
		expect(spatial).not.toContain('<EditorApp');
		const preview = readRouteSource('project/[projectId]/preview/+page.svelte');
		expect(preview).not.toContain('<EditorApp');
		const host = readLibSource('editor/app/ProjectShellHost.svelte');
		expect(host).toContain('<EditorApp {projectId} {loadOwnedProject} {resumePendingSave} {surface} />');
		expect(host).toContain('untrack(() => page.url.searchParams');
		expect(host).toContain("endsWith('/preview')");
		const layout = readRouteSource('project/[projectId]/+layout.svelte');
		expect(layout).toContain('{#key page.params.projectId}');
		// Teardown wiring: the isolation *machinery* is behaviorally pinned in
		// `tests/lib/editor/app/project-session-isolation.test.ts`, which proves
		// `ProjectAssetRequestScope.invalidate()` behaves correctly when called —
		// it cannot fail if `EditorApp` simply stops calling it. So the call site
		// is pinned here: unmount aborts in-flight project/asset requests and
		// drops asset contexts, so A→B navigation cannot leak requests or
		// retained bytes. Asset request ownership is one scope per mount,
		// invalidated on teardown.
		const app = readLibSource('editor/app/EditorApp.svelte');
		expect(app).toContain("import { ProjectAssetRequestScope } from '$lib/editor/project-asset-request-scope';");
		expect(app).toContain('const assetScope = new ProjectAssetRequestScope();');
		// Asserted inside the teardown function itself, not merely somewhere in
		// the file: each of the three calls below has other call sites too.
		const teardown = sliceSessionTeardown(app);
		expect(teardown).toContain('controller.abort();');
		expect(teardown).toContain('projectRequestController?.abort();');
		expect(teardown).toContain('invalidateProjectAssets();');
		expect(teardown).toContain('clearRetainedSourceAliases();');
		// ...and `invalidateProjectAssets()` is what invalidates the asset scope.
		expect(sliceFunctionBody(app, 'invalidateProjectAssets')).toContain('assetScope.invalidate();');
	});
	it('keeps Project Row navigation Spatial-only', () => {
		const shell = readRouteSource('project/[projectId]/+layout.svelte');
		const row = readLibSource('editor/app/ProjectRow.svelte');
		expect(row).toContain('href="/projects"');
		expect(row).toContain('Spatial');
		expect(shell).toContain('{@render children()}');
		expect(shell).not.toContain('EditorApp');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('unified hierarchy contracts', () => {
	it('mounts the editor sidebar + unified tree in the editor shell, never in the relic', () => {
		// editor shell imports the new sidebar (and the unified tree through it).
		const editorApp = readLibSource('editor/app/EditorApp.svelte');
		expect(editorApp).toContain('EditorSidebar');
		expect(editorApp).not.toContain('EditorLeftSidebar');

		// Relic: the route source imports only virtual:museum-editor-entry, and
		// the entry plugin's load() output is just a re-export, so assert on the
		// resolved module's file source (MuseumEditorApp.svelte) + the legacy
		// components themselves.
		const relicApp = readLibSource('editor/MuseumEditorApp.svelte');
		expect(relicApp).toContain('EditorLeftSidebar');

		const relicSidebar = readLibSource('editor/EditorLeftSidebar.svelte');
		expect(relicSidebar).toContain('EditorSceneTree');
		expect(relicSidebar).toContain('EditorCameraTree');

		// The relic-side half of this unit (MuseumEditorApp / EditorLeftSidebar /
		// EditorSceneTree / EditorCameraTree must not reference the greenfield
		// sidebar or unified tree) left `contracts.test.ts` as an *empty* loop and
		// now lives where the relic's frozen import surface is owned:
		// `relic-smoke.test.ts` → 'frozen relic import surface' (all four files ×
		// {UnifiedProjectTree, EditorSidebar, createProjectApi}).
	});
});
