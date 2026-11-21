/**
 * T2.S8 D follow-up — the headless approved-derivative analyzer.
 *
 * The production route feeds the bytes it observed from the approved model
 * lease into this module. Parsing the committed two-UV GLB here proves the
 * analyzer reads both native UV sets and reports one draw, rather than the
 * production tests only exercising a hand-built analysis object.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { analyzeModelDerivativeBytes } from '$lib/render/materials/model-derivative-analysis';

describe('approved model derivative analysis', () => {
	it('parses the exact GLB bytes and reports its native UV0 and UV1 sets', async () => {
		const bytes = new Uint8Array(
			readFileSync(
				fileURLToPath(new URL('./__fixtures__/s8/two-uv-glb.glb', import.meta.url))
			)
		);
		const digest = `sha256-${'a'.repeat(64)}`;
		const analysis = await analyzeModelDerivativeBytes(bytes, digest);
		expect(analysis.digest).toBe(digest);
		expect(analysis.draws).toHaveLength(1);
		expect(analysis.draws[0]!.geometry.positions.length).toBeGreaterThan(0);
		expect(analysis.draws[0]!.geometry.uvs[0]).not.toBeNull();
		expect(analysis.draws[0]!.geometry.uvs[1]).not.toBeNull();
	});
});
