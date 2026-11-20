/**
 * PR 1 keeps every WebGPU experiment outside the shipped client/server graph.
 *
 * The PR 2 cutover made the node/TSL renderer the product renderer, so the
 * product now imports `three/webgpu` and `three/tsl` by design. What stays
 * isolated is the experiment tree: no product module may reach into it, and the
 * shipped renderer always comes from the one factory in `renderer-backend.ts`,
 * so no second Three core enters the bundle.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = process.cwd();

function walk(directory: string, output: string[] = []): string[] {
	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) walk(path, output);
		else output.push(path);
	}
	return output;
}

const PRODUCT_FILES = walk(resolve(APP, 'src')).filter((path) =>
	/\.(ts|js|svelte|svelte\.ts)$/.test(path)
);
const EXPERIMENT_FILES = walk(resolve(APP, 'experiments/webgpu-migration'));

describe('PR 1 WebGPU experiment isolation', () => {
	it('has no product import of the experiment tree', () => {
		const offenders = PRODUCT_FILES.filter((path) =>
			/exps?eriments\/webgpu-migration|webgpu-migration\/lifecycle|webgpu-migration\/api/.test(
				readFileSync(path, 'utf8')
			)
		);
		expect(offenders.map((path) => relative(APP, path))).toEqual([]);
	});

	it('constructs the node renderer in exactly one product factory', () => {
		const offenders = PRODUCT_FILES.filter((path) =>
			/new ThreeWebGPURenderer\(|new WebGPURenderer\(/.test(readFileSync(path, 'utf8'))
		);
		expect(offenders.map((path) => relative(APP, path))).toEqual([
			'src/lib/render/renderer-backend.ts'
		]);
	});

	it('keeps the experiments free of product imports', () => {
		const offenders: string[] = [];
		for (const path of EXPERIMENT_FILES) {
			if (!/\.(ts|js|mjs|svelte)$/.test(path)) continue;
			const source = readFileSync(path, 'utf8');
			if (/\$lib\/|@portfolio\//.test(source)) offenders.push(relative(APP, path));
		}
		expect(offenders).toEqual([]);
	});

	it('keeps the harness outside every SvelteKit entry directory', () => {
		const experimentRoot = resolve(APP, 'experiments/webgpu-migration');
		expect(relative(resolve(APP, 'src'), experimentRoot).startsWith('..')).toBe(true);
		expect(EXPERIMENT_FILES.some((path) => path.endsWith('run.mjs'))).toBe(true);
	});
});
