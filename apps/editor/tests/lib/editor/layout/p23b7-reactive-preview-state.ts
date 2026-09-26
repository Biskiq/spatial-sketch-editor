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
 * This stays test-only: the generated module is temporary and lives under the
 * editor package's ignored `node_modules/.cache` directory, the client runtime
 * import remains outside `src/`, and no app code uses Svelte's private API.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
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
	const generatedDirectory = path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		'../../../../node_modules/.cache/p23b-client'
	);
	const generatedPath = path.join(
		generatedDirectory,
		`.p23b7-client-preview-${process.pid}-${randomUUID()}.ts`
	);
	try {
		await mkdir(generatedDirectory, { recursive: true });
		await removeStaleGeneratedModules(generatedDirectory);
		// Clean remnants from runs before the generator moved out of src/.
		await removeStaleGeneratedModules(path.dirname(sourcePath));
		const source = await readFile(sourcePath, 'utf8');
		const javascript = ts.transpileModule(source, {
			compilerOptions: {
				target: ts.ScriptTarget.ESNext,
				module: ts.ModuleKind.ESNext,
				verbatimModuleSyntax: false
			}
		}).outputText.replace(
			/from (['"])\.\/([^'"]+)\1/g,
			(_match, quote: string, specifier: string) => {
				const absoluteImport = path.resolve(path.dirname(sourcePath), specifier);
				return `from ${quote}${absoluteImport}${quote}`;
			}
		);
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

async function removeStaleGeneratedModules(directory: string): Promise<void> {
	const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
	await Promise.all(
		entries
			.filter(
				(entry) =>
					entry.isFile() &&
					entry.name.startsWith('.p23b7-client-preview-') &&
					entry.name.endsWith('.ts') &&
					!generatedModuleProcessIsAlive(entry.name)
			)
			.map((entry) => unlink(path.join(directory, entry.name)).catch(() => undefined))
	);
}

function generatedModuleProcessIsAlive(filename: string): boolean {
	const processId = /^\.p23b7-client-preview-(\d+)-/.exec(filename)?.[1];
	if (!processId) return false;
	try {
		process.kill(Number(processId), 0);
		return true;
	} catch (error) {
		return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EPERM';
	}
}
