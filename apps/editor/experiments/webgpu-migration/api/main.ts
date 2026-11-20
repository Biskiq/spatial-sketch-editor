/**
 * Browser entry for the isolated PR 1 WebGPU qualification harness.
 *
 * The runner bundles this file with esbuild and injects it into a plain local
 * page. Nothing here is imported by a product route; the experiment tree is
 * outside `src` and outside every SvelteKit entry.
 */
import { runQualification, type QualificationReport } from './qualification';
import { runPerformance, type PerformanceReport } from './performance';

const moduleStart = performance.now();

export type MigrationHarness = {
	readonly moduleStart: number;
	runQualification(): Promise<QualificationReport & { harnessModuleMs: number }>;
	runPerformance(): Promise<PerformanceReport & { harnessModuleMs: number }>;
};

declare global {
	interface Window {
		__BISKIQ_WEBGPU__: MigrationHarness;
	}
}

window.__BISKIQ_WEBGPU__ = {
	moduleStart,
	async runQualification() {
		const report = await runQualification();
		return { ...report, harnessModuleMs: performance.now() };
	},
	async runPerformance() {
		const report = await runPerformance();
		return { ...report, harnessModuleMs: performance.now() };
	}
};
