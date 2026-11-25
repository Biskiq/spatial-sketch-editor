/**
 * E1/R1 — the renderer portability boundary.
 *
 * World code uses built-in Three material classes and standard properties, which
 * both WebGL and WebGPU renderers honour. The few renderer-specific sites are
 * frozen here as an exact allowlist (audit §5.1): adding a site fails this test,
 * and removing a site fails it too until its entry is removed, so the list can
 * only shrink.
 *
 * Forbidden everywhere (the allowlist is empty after the cutover): `onBeforeCompile`,
 * `ShaderMaterial` (which includes `RawShaderMaterial`), `WebGLRenderTarget`,
 * `getContext(` on anything but a 2D canvas, an alpha-test depth override
 * (`customDepthMaterial` / `customDistanceMaterial`), and an import from a
 * WebGL-only Three path. The common geometry paths
 * (`LineGeometry`, `LineSegmentsGeometry`) and the webgpu line objects are the
 * backend-neutral survivors and are not flagged.
 */
import { describe, expect, it } from 'vitest';
import { readProductSources, scanTokens, type TokenRule } from '../../helpers/render-boundary-scan';

const RULES: readonly TokenRule[] = [
	{ name: 'onBeforeCompile', pattern: /\bonBeforeCompile\b/ },
	{ name: 'ShaderMaterial', pattern: /ShaderMaterial\b/ },
	{ name: 'WebGLRenderTarget', pattern: /\bWebGLRenderTarget\b/ },
	{ name: 'getContext-non-2d', pattern: /\.getContext\(\s*(?!['"]2d['"])/ },
	{ name: 'customDepthMaterial', pattern: /\bcustomDepthMaterial\b/ },
	{ name: 'customDistanceMaterial', pattern: /\bcustomDistanceMaterial\b/ },
	{
		name: 'webgl-only-three-path',
		pattern:
			/from\s*['"](?:three\/(?:examples\/jsm\/lines|src)\/|three\/addons\/lines\/(?!webgpu\/|LineGeometry\.js|LineSegmentsGeometry\.js))/
	}
];

/** Every permitted site, and exactly what each may contain. */
export const PORTABILITY_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {};

describe('renderer portability boundary', () => {
	it('keeps the renderer-specific sites to exactly the frozen allowlist', () => {
		const found = scanTokens(readProductSources(), RULES);
		expect(found).toEqual(
			Object.fromEntries(Object.entries(PORTABILITY_ALLOWLIST).map(([file, names]) => [file, [...names].sort()]))
		);
	});

	describe('the scanner sees what it must', () => {
		const scan = (code: string) => scanTokens([{ file: 'synthetic.ts', code }], RULES)['synthetic.ts'] ?? [];

		it('flags each forbidden construct in product code', () => {
			expect(scan('material.onBeforeCompile = (shader) => {};')).toEqual(['onBeforeCompile']);
			expect(scan("new RawShaderMaterial({})")).toEqual(['ShaderMaterial']);
			expect(scan('const t = new WebGLRenderTarget(1, 1);')).toEqual(['WebGLRenderTarget']);
			expect(scan('renderer.getContext()')).toEqual(['getContext-non-2d']);
			expect(scan("canvas.getContext('webgl2')")).toEqual(['getContext-non-2d']);
			expect(scan("import { Line2 } from 'three/examples/jsm/lines/Line2.js';")).toEqual(['webgl-only-three-path']);
			expect(scan("import { LineMaterial } from 'three/addons/lines/LineMaterial.js';")).toEqual(['webgl-only-three-path']);
			expect(scan("import { Line2 } from 'three/addons/lines/webgpu/Line2.js';")).toEqual([]);
			expect(scan("import { LineGeometry } from 'three/addons/lines/LineGeometry.js';")).toEqual([]);
			expect(scan('<T.MeshDepthMaterial attach="customDepthMaterial" />')).toEqual(['customDepthMaterial']);
		});

		it('ignores a 2D canvas context and prose in comments', () => {
			expect(scan("const c = canvas.getContext('2d');")).toEqual([]);
			expect(scan('// uses onBeforeCompile\n/* ShaderMaterial */\n<!-- WebGLRenderTarget -->')).toEqual([]);
		});

		it('is not hidden by an apostrophe in markup text', () => {
			expect(scan("<p>it's fine</p>\nmaterial.onBeforeCompile = f;")).toEqual(['onBeforeCompile']);
		});
	});
});
