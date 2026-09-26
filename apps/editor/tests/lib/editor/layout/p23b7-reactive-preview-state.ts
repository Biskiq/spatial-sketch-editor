/**
 * P23B.7 S6 / P23B.6 S-R client-runtime fixtures.
 *
 * Vitest loads `.svelte.ts` modules with Svelte's server transform. That
 * transform erases `$state.raw` signals, so adding `proxy(...)` around the
 * resulting object cannot reproduce the editor's client state. Tests that make
 * a reactivity claim use `loadClientCompiledPreviewModule`, which TypeScript-
 * strips and then compiles the actual production module with Svelte's client
 * compiler before loading it through Vite's module graph.
 *
 * This stays test-only: the generated module is temporary, the client runtime
 * import remains outside `src/`, and no app code uses Svelte's private API.
 */
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileModule } from 'svelte/compiler';
import { proxy } from 'svelte/internal/client';
import ts from 'typescript';

import {
	createEmptyWallFirstLayoutPreviewState,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';

type PreviewModule = typeof import('$lib/editor/layout/layout-preview-state.svelte');
export type ClientPreviewRuntime = Pick<
	PreviewModule,
	| 'createEmptyWallFirstLayoutPreviewState'
	| 'captureLayoutPreviewSnapshot'
	| 'importLayoutPreviewJson'
	| 'layoutPreviewAuthoredJson'
	| 'resetLayoutPreview'
	| 'restoreLayoutPreviewSnapshot'
	| 'updateWallFirstWallMove'
>;

let clientPreviewModule: Promise<ClientPreviewRuntime> | null = null;

/** Load the real preview-state implementation compiled with Svelte's client transform. */
export function loadClientCompiledPreviewModule(): Promise<ClientPreviewRuntime> {
	if (!clientPreviewModule) clientPreviewModule = compileAndLoadClientPreviewModule();
	return clientPreviewModule;
}

/** Create the client-compiled raw-signal state and the same root proxy as EditorApp. */
export async function createClientReactiveLayoutPreviewState(): Promise<LayoutPreviewState> {
	const runtime = await loadClientCompiledPreviewModule();
	return proxy(runtime.createEmptyWallFirstLayoutPreviewState()) as LayoutPreviewState;
}

/**
 * Historical SSR proxy fixture for retention tests. SSR erases the raw signals,
 * so this must never be used as evidence of client consumer reactivity.
 */
export function createSsrProxyLayoutPreviewState(): LayoutPreviewState {
	return proxy(createEmptyWallFirstLayoutPreviewState()) as LayoutPreviewState;
}

/**
 * Create the former deep-proxied compatibility shape: the SSR-compiled state
 * is copied to ordinary data properties before its root is proxied. This is
 * used only to prove that the S6 proxy-to-compile mapping prevents the original
 * install/capture/commit rebuild.
 */
export function createProxyBackedLayoutPreviewState(): LayoutPreviewState {
	return proxy({ ...createEmptyWallFirstLayoutPreviewState() }) as LayoutPreviewState;
}

/** Is this value a Svelte state proxy? */
export function isSvelteStateProxy(value: unknown): boolean {
	try {
		structuredClone(value);
		return false;
	} catch {
		return true;
	}
}

async function compileAndLoadClientPreviewModule(): Promise<ClientPreviewRuntime> {
	const sourcePath = fileURLToPath(
		new URL('../../../../src/lib/editor/layout/layout-preview-state.svelte.ts', import.meta.url)
	);
	// Keep the transient module beside the production source so its relative
	// imports resolve exactly as they do in the client build.
	const generatedPath = path.join(
		path.dirname(sourcePath),
		`.p23b7-client-preview-${randomUUID()}.ts`
	);
	try {
		const source = await readFile(sourcePath, 'utf8');
		const javascript = ts.transpileModule(source, {
			compilerOptions: {
				target: ts.ScriptTarget.ESNext,
				module: ts.ModuleKind.ESNext,
				verbatimModuleSyntax: false
			}
		}).outputText;
		const clientCode = compileModule(javascript, {
			filename: sourcePath,
			generate: 'client'
		}).js.code;
		await writeFile(generatedPath, clientCode, 'utf8');
		return (await import(generatedPath)) as ClientPreviewRuntime;
	} catch (error) {
		clientPreviewModule = null;
		throw error;
	} finally {
		await unlink(generatedPath).catch(() => undefined);
	}
}
