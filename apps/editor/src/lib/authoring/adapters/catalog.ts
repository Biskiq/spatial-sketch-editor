/**
 * Domain-owned composition entry point: add a *.adapter.ts alongside this file,
 * exporting createAdapter. Future T1/T2 consumers edit no host, route or shell.
 * Production currently discovers no writers. Browser probes require a separately
 * approved test-only build injection; they never live in this catalogue.
 */
import type { StageAdapterFactory } from '../stage/stage-adapter-host';

const modules = import.meta.glob<{ createAdapter: StageAdapterFactory }>('./*.adapter.ts', { eager: true });
export const stageAdapterFactories: readonly StageAdapterFactory[] = Object.keys(modules)
	.sort()
	.map((path) => modules[path]!.createAdapter);
