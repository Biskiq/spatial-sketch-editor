#!/usr/bin/env node
/**
 * Production-build preview server for the measurement harness (T3.P03.S02).
 *
 * The measured build is the ordinary production build: `vite build`, then
 * `vite preview`. There is no harness-only bundle and no instrumentation flag
 * baked in — the mark helper is inert unless the harness enables it at runtime.
 *
 * Environment:
 *   PERF_PORT        preview port (default 4173)
 *   PERF_SKIP_BUILD  '1' reuses the existing .svelte-kit output
 *   PUBLIC_API_ORIGIN  forwarded to the preview for the Save flow's local stack
 */
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const editor = resolve(here, '..');
const port = process.env.PERF_PORT ?? '4173';

if (process.env.PERF_SKIP_BUILD !== '1') {
	const build = spawnSync('npm', ['run', 'build'], {
		cwd: editor,
		stdio: 'inherit',
		env: process.env
	});
	if (build.status !== 0) process.exit(build.status ?? 1);
}

const preview = spawn(
	'npx',
	['vite', 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'],
	{ cwd: editor, stdio: 'inherit', env: process.env }
);

const stop = (signal) => preview.kill(signal);
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
preview.on('exit', (code) => process.exit(code ?? 0));
