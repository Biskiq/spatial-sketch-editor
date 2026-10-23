import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundleProvenancePlugin } from '../../vite/bundle-provenance-plugin';
import { readProvenance } from '../../perf/bundle-provenance.mjs';

describe('Rollup provenance build hook', () => {
	it('writes exact final bytes and real module identities only for opted-in client builds', () => {
		const root = mkdtempSync(join(tmpdir(), 'biskiq-plugin-'));
		try {
			mkdirSync(join(root, 'out'));
			const code = 'export {};\n//# sourceMappingURL=start.js.map\n';
			writeFileSync(join(root, 'out/start.js'), code);
			writeFileSync(join(root, 'out/decoder.js'), 'asset');
			const bundle = {
				'start.js': { type: 'chunk', fileName: 'start.js', modules: {}, facadeModuleId: '\0virtual:start' },
				'decoder.js': { type: 'asset', fileName: 'decoder.js' }
			};
			const make = (enabled: boolean, ssr: boolean) => {
				const plugin = bundleProvenancePlugin(enabled) as unknown as {
					configResolved: (config: unknown) => void;
					writeBundle: (this: unknown, options: unknown, bundle: unknown) => void;
				};
				plugin.configResolved({ root, build: { ssr } });
				return plugin;
			};
			make(false, false).writeBundle.call({ getModuleInfo: () => ({}) }, { dir: 'out' }, bundle);
			make(true, true).writeBundle.call({ getModuleInfo: () => ({}) }, { dir: 'out' }, bundle);
			expect(existsSync(join(root, 'out/bundle-provenance.json'))).toBe(false);
			make(true, false).writeBundle.call({ getModuleInfo: () => ({}) }, { dir: 'out' }, bundle);
			const proof = readProvenance(join(root, 'out/bundle-provenance.json'), join(root, 'out'));
			expect(proof.get('start.js')).toEqual(['\0virtual:start']);
			expect(() => make(true, false).writeBundle.call({ getModuleInfo: () => null }, { dir: 'out' }, bundle)).toThrow(/missing Rollup module identity/);
			expect(() => make(true, false).writeBundle.call({ getModuleInfo: () => ({}) }, { dir: 'out' }, { 'empty.js': { type: 'chunk', fileName: 'empty.js', modules: {} } })).toThrow();
			expect(proof.get('decoder.js')).toBeNull();
			expect(readFileSync(join(root, 'out/start.js'), 'utf8')).toBe(code);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});
});
