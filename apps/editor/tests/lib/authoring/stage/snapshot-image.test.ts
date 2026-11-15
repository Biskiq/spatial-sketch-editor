/**
 * The Stage snapshot's colour path — the defect Gate A recorded as F5.
 *
 * Three r187 renders a non-XR target in the linear working space, so the
 * target's bytes are linear while the PNG is displayed as sRGB. The old writer
 * copied those bytes straight into `putImageData`: a 50% grey surface read 128
 * on the Stage and 55 in a snapshot. These tests pin the encode that fixes it,
 * and the call site that must keep using it, so a future writer cannot quietly
 * reintroduce linear-as-sRGB bytes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	LINEAR_TO_SRGB,
	encodeSnapshotPixels,
	linearByteToSrgbByte
} from '$lib/authoring/stage/snapshot-image';

/** The vitest root is `apps/editor`; the same read the render guards use. */
function source(path: string): string {
	return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('linear readback to sRGB', () => {
	it('encodes the values the snapshot path depends on', () => {
		// Linear 0.2159 is the mid-grey a linear target stores for #808080: the
		// old path showed 55. Linear 0.502 is what 128 linear encodes to 188.
		expect(linearByteToSrgbByte(0)).toBe(0);
		expect(linearByteToSrgbByte(55)).toBe(128);
		expect(linearByteToSrgbByte(128)).toBe(188);
		expect(linearByteToSrgbByte(255)).toBe(255);
	});

	it('is monotone across every byte, so no gradient inverts', () => {
		expect(LINEAR_TO_SRGB).toHaveLength(256);
		for (let value = 1; value < 256; value += 1) {
			expect(LINEAR_TO_SRGB[value]!).toBeGreaterThanOrEqual(LINEAR_TO_SRGB[value - 1]!);
		}
	});

	it('rounds and clamps a readback byte instead of reading past the table', () => {
		expect(linearByteToSrgbByte(54.6)).toBe(linearByteToSrgbByte(55));
		expect(linearByteToSrgbByte(-12)).toBe(0);
		expect(linearByteToSrgbByte(999)).toBe(255);
		expect(() => linearByteToSrgbByte(Number.NaN)).toThrow(/not finite/);
	});
});

describe('encodeSnapshotPixels', () => {
	/**
	 * A 2 × 2 readback, bottom row first as WebGL returns it. Each pixel carries
	 * a distinct red so the row flip is visible, and alpha 0 so the forced opaque
	 * alpha is visible too.
	 */
	const readback = new Uint8Array([
		// Bottom source row (becomes the PNG's last row).
		55, 10, 20, 0, 128, 30, 40, 0,
		// Top source row (becomes the PNG's first row).
		200, 50, 60, 0, 255, 70, 80, 0
	]);

	it('flips rows top-down and forces opaque alpha', () => {
		const encoded = encodeSnapshotPixels(readback, 2, 2);
		expect(Array.from(encoded)).toEqual([
			// PNG row 0 is the source's last row.
			linearByteToSrgbByte(200), linearByteToSrgbByte(50), linearByteToSrgbByte(60), 255,
			linearByteToSrgbByte(255), linearByteToSrgbByte(70), linearByteToSrgbByte(80), 255,
			// PNG row 1 is the source's first row.
			linearByteToSrgbByte(55), linearByteToSrgbByte(10), linearByteToSrgbByte(20), 255,
			linearByteToSrgbByte(128), linearByteToSrgbByte(30), linearByteToSrgbByte(40), 255
		]);
	});

	it('never mutates the readback buffer', () => {
		const copy = readback.slice();
		encodeSnapshotPixels(readback, 2, 2);
		expect(Array.from(readback)).toEqual(Array.from(copy));
	});

	it('refuses a buffer that does not describe the stated grid', () => {
		expect(() => encodeSnapshotPixels(readback, 3, 2)).toThrow(/expected 24 for 3×2/);
		expect(() => encodeSnapshotPixels(readback, 0, 2)).toThrow(/positive integer grid/);
		expect(() => encodeSnapshotPixels(readback, 2.5, 2)).toThrow(/positive integer grid/);
	});
});

/**
 * The encoder is only the fix if the Stage's one snapshot host uses it. This is
 * the call-site proof: the component holds no `putImageData` of its own.
 */
describe('the snapshot host uses the shared writer', () => {
	const host = source('src/lib/authoring/stage/shell/StageSnapshotRenderer.svelte');

	it('imports and calls snapshotDataUrl', () => {
		expect(host).toMatch(
			/import \{ snapshotDataUrl \} from '\.\.\/snapshot-image'/
		);
		expect(host).toContain('return snapshotDataUrl(pixels, WIDTH, height);');
	});

	it('writes no pixels itself', () => {
		expect(host).not.toContain('putImageData');
		expect(host).not.toContain('createImageData');
		expect(host).not.toContain('toDataURL');
	});
});
