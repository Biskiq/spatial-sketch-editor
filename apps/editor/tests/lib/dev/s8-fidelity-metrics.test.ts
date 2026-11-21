import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	S8_CHART_FIXTURES,
	decodeNormalTexel,
	equalCheck,
	expectedNormalResponseSign,
	fidelityVerdict,
	patchMean,
	planarUvFrame,
	ratioCheck,
	responseSignCheck,
	sampledImageCorner,
	srgbByteToLinear,
	transformUv,
	unlitCheck,
	type LinearFrame
} from '$lib/dev/s8-fidelity-metrics';

const manifest = JSON.parse(
	readFileSync(
		fileURLToPath(new URL('../render/materials/__fixtures__/s8/fixtures.json', import.meta.url)),
		'utf8'
	)
) as { fixtures: { id: string; file: string; width?: number; sha256: string; semantics: Record<string, unknown> }[] };
const fixture = (id: string) => manifest.fixtures.find((entry) => entry.id === id)!;
const staticRoot = new URL('../../../static/', import.meta.url);

const IDENTITY = { repeat: [1, 1], rotation: 0, offset: [0, 0] } as const;
const QUAD: [number, number, number][] = [
	[0, 0, 0],
	[1, 0, 0],
	[1, 1, 0]
];

describe('s8 fidelity oracle math', () => {
	it('decodes sRGB colour bytes and keeps the plan reference values', () => {
		expect(srgbByteToLinear(0)).toBe(0);
		expect(srgbByteToLinear(255)).toBeCloseTo(1, 12);
		expect(srgbByteToLinear(128)).toBeCloseTo(0.2158605, 6);
		expect(128 / 255).toBeCloseTo(0.50196, 5);
	});

	it('averages a top-first patch interior', () => {
		const pixels = new Float32Array(4 * 4 * 4);
		for (let y = 0; y < 4; y += 1) {
			for (let x = 0; x < 4; x += 1) pixels.set([y < 2 ? 1 : 0, x / 3, 0, 1], (y * 4 + x) * 4);
		}
		const frame: LinearFrame = { pixels, width: 4, height: 4 };
		expect(patchMean(frame, [0, 0, 1, 0.5])[0]).toBe(1);
		expect(patchMean(frame, [0, 0.5, 1, 1])[0]).toBe(0);
		expect(() => patchMean(frame, [0.5, 0.5, 0.5, 0.5])).toThrow(/empty patch/);
	});

	it('applies the pivot-½ UV affine like Three', () => {
		expect(transformUv([0.25, 0.5], IDENTITY)).toEqual([0.25, 0.5]);
		const rotated = transformUv([1, 0.5], { repeat: [1, 1], rotation: Math.PI / 2, offset: [0, 0] });
		expect(rotated[0]).toBeCloseTo(0.5, 12);
		expect(rotated[1]).toBeCloseTo(0, 12);
		expect(transformUv([0.75, 0.5], { repeat: [2, 1], rotation: 0, offset: [0.1, 0] })[0]).toBeCloseTo(1.1, 12);
	});

	it('derives the authored UV frame, and a mirrored UV flips the tangent', () => {
		const direct = planarUvFrame(QUAD, [
			[0, 0],
			[1, 0],
			[1, 1]
		]);
		expect(direct.tangent).toEqual([1, 0, 0]);
		expect(direct.bitangent).toEqual([0, 1, 0]);
		const mirrored = planarUvFrame(QUAD, [
			[1, 0],
			[0, 0],
			[0, 1]
		]);
		expect(mirrored.tangent.map((v) => v + 0)).toEqual([-1, 0, 0]);
		expect(mirrored.bitangent.map((v) => v + 0)).toEqual([0, 1, 0]);
		expect(() => planarUvFrame(QUAD, [
			[0, 0],
			[0, 0],
			[0, 0]
		])).toThrow(/singular/);
	});

	it('predicts the normal response sign from texel, convention and frame', () => {
		const frame = { tangent: [1, 0, 0], bitangent: [0, 1, 0] };
		const plusY = decodeNormalTexel(S8_CHART_FIXTURES.normalPlusY.centre);
		expect(plusY[1]).toBeGreaterThan(0);
		expect(decodeNormalTexel(S8_CHART_FIXTURES.normalPlusY.centre, '-Y')[1]).toBeCloseTo(-plusY[1], 12);
		expect(expectedNormalResponseSign(plusY, frame, [0, 0, 1], [0, 1, 0.3])).toBe(1);
		expect(expectedNormalResponseSign(plusY, frame, [0, 0, 1], [0, -1, 0.3])).toBe(-1);
		// The mirrored frame inverts the X response only.
		const mirrored = { tangent: [-1, 0, 0], bitangent: [0, 1, 0] };
		expect(expectedNormalResponseSign(plusY, mirrored, [0, 0, 1], [1, 0, 0.3])).toBe(-1);
		expect(expectedNormalResponseSign(plusY, mirrored, [0, 0, 1], [0, 1, 0.3])).toBe(1);
		expect(expectedNormalResponseSign([0, 0, 1], frame, [0, 0, 1], [1, 0, 0.3])).toBe(0);
	});

	it('maps a mesh UV to the sampled image corner for each storage origin', () => {
		expect(sampledImageCorner([0.1, 0.9], IDENTITY, 'legacy')).toBe('topLeft');
		expect(sampledImageCorner([0.1, 0.9], IDENTITY, 'gltf')).toBe('bottomLeft');
		expect(sampledImageCorner([0.9, 0.1], IDENTITY, 'gltf')).toBe('topRight');
		expect(sampledImageCorner([1.1, 0.1], IDENTITY, 'gltf')).toBe('topLeft');
		expect(
			sampledImageCorner([0.1, 0.1], { repeat: [1, 1], rotation: Math.PI / 2, offset: [0, 0] }, 'gltf')
		).toBe('bottomLeft');
	});

	it('reports checks and verdicts without hiding a failure', () => {
		expect(unlitCheck('a', 'colour', [0.5], [0.5 + 0.5 / 255]).pass).toBe(true);
		expect(unlitCheck('b', 'colour', [0.5], [0.5 + 2 / 255]).pass).toBe(false);
		expect(ratioCheck('c', 'ao', 1.96, 1, 1.9615, 0.01).pass).toBe(true);
		expect(ratioCheck('d', 'ao', 1, 1, 1.9615, 0.01).pass).toBe(false);
		expect(responseSignCheck('e', 'normal', 0.5, 0.5, 0).pass).toBe(true);
		expect(responseSignCheck('f', 'normal', 0.5, 0.5, 1).pass).toBe(false);
		expect(equalCheck('g', 'count', 2, 1).pass).toBe(false);
		expect(fidelityVerdict([])).toEqual({ pass: false, failed: [] });
		expect(fidelityVerdict([equalCheck('h', 'count', 1, 1), equalCheck('i', 'count', 0, 1)])).toEqual({
			pass: false,
			failed: ['i']
		});
	});
});

describe('S8_CHART_FIXTURES stays pinned to the A manifest and served bytes', () => {
	it('matches the manifest semantics', () => {
		const swatch = fixture('swatch-rgba').semantics.quadrants as { rgba: number[] }[];
		expect(swatch.map((entry) => entry.rgba)).toEqual([
			[...S8_CHART_FIXTURES.swatch.quadrants.topLeft],
			[...S8_CHART_FIXTURES.swatch.quadrants.topRight],
			[...S8_CHART_FIXTURES.swatch.quadrants.bottomLeft],
			[...S8_CHART_FIXTURES.swatch.quadrants.bottomRight]
		]);
		const checker = fixture('checker-asymmetric').semantics as { cellPx: number; corners: Record<string, number[]> };
		expect(checker.cellPx).toBe(S8_CHART_FIXTURES.checker.cellPx);
		expect(checker.corners).toEqual(
			Object.fromEntries(Object.entries(S8_CHART_FIXTURES.checker.corners).map(([key, value]) => [key, [...value]]))
		);
		expect(fixture('normal-plus-y').semantics.encodedNormal).toEqual([...S8_CHART_FIXTURES.normalPlusY.centre]);
		expect(fixture('normal-minus-y').semantics.encodedNormal).toEqual([...S8_CHART_FIXTURES.normalMinusY.centre]);
		const orm = fixture('orm-distinct').semantics as { centerRgba: number[]; border: number[] };
		expect(orm.centerRgba).toEqual([...S8_CHART_FIXTURES.orm.centre]);
		expect(orm.border).toEqual([...S8_CHART_FIXTURES.orm.border]);
	});

	it('serves the exact manifest bytes at each chart URI', () => {
		const pairs: [string, string][] = [
			['swatch-rgba', S8_CHART_FIXTURES.swatch.uri],
			['checker-asymmetric', S8_CHART_FIXTURES.checker.uri],
			['normal-plus-y', S8_CHART_FIXTURES.normalPlusY.uri],
			['normal-minus-y', S8_CHART_FIXTURES.normalMinusY.uri],
			['orm-distinct', S8_CHART_FIXTURES.orm.uri]
		];
		for (const [id, uri] of pairs) {
			const bytes = readFileSync(fileURLToPath(new URL(uri.slice(1), staticRoot)));
			expect(`sha256-${createHash('sha256').update(new Uint8Array(bytes)).digest('hex')}`, id).toBe(fixture(id).sha256);
		}
	});
});
