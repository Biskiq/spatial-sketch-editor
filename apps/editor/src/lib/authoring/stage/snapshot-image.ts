/**
 * The Stage snapshot's one colour path.
 *
 * Three r187 renders a non-XR render target in its working colour space
 * (`srgb-linear`). The Stage's snapshot target is an 8-bit `RenderTarget` with
 * `NoColorSpace`, so the bytes it reads back are **linear**, while an `<img>`
 * shows sRGB. A PNG has no colour-space chunk the browser honours here, so the
 * conversion has to happen on the way out. This module is the only place that
 * writes snapshot pixels.
 *
 * Orientation is not this module's job: the snapshot host normalizes the
 * backend's packed rows to **top-down** (WebGPU is top-down, the WebGL2 backend
 * reads bottom-up) before anything reaches the writer.
 *
 * Gate A recorded the mismatch as F5 and refused to use snapshots as evidence
 * (see `docs/roadmap/t2-look-atmosphere/s0-rendering-gate/pipeline.md`); Gate B
 * E6 fixed it here. Before: a 50% grey surface rendered 128 on the Stage and
 * 55 in a snapshot. After: both 128.
 *
 * The transfer function is the exact sRGB encode of a **quantized** linear byte,
 * tabulated once over the 256 values; it is not a lossless transfer. Eight-bit
 * linear storage has almost no resolution in the shadows, so linear byte 1
 * encodes to sRGB 13 while mid-tones land within a level or two. That coarseness
 * belongs to the shipped 8-bit target, not to the encode. The encode removes the
 * measured 55-vs-128 error; E6 measured what remains (mean ΔE00 0.61) rather
 * than assuming it away.
 */

/** The exact sRGB encode of one linear-light value in 0…1, as an 8-bit code. */
function encodeLinear(linear: number): number {
	const clamped = Math.min(1, Math.max(0, linear));
	const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
	return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
}

/**
 * `LINEAR_TO_SRGB[linearByte]` is the sRGB code for that linear byte.
 *
 * Linear 0 → 0, linear 55 (0.2157) → 128, linear 128 (0.502) → 188, linear 255
 * → 255. The table is monotone, so no gradient is inverted.
 */
export const LINEAR_TO_SRGB: Uint8Array = (() => {
	const table = new Uint8Array(256);
	for (let value = 0; value < 256; value += 1) table[value] = encodeLinear(value / 255);
	return table;
})();

/** The sRGB code for one linear readback byte; values are rounded and clamped. */
export function linearByteToSrgbByte(value: number): number {
	if (!Number.isFinite(value)) throw new Error(`snapshot linear byte ${value} is not finite`);
	return LINEAR_TO_SRGB[Math.max(0, Math.min(255, Math.round(value)))]!;
}

/**
 * The PNG-ready RGBA pixels for a top-down snapshot readback.
 *
 * The Stage's target writes alpha 0 where nothing draws, so alpha is forced
 * opaque as it was before the E6 fix. The input buffer is never mutated.
 */
export function encodeSnapshotPixels(
	pixels: Uint8Array,
	width: number,
	height: number
): Uint8Array {
	if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
		throw new Error(`snapshot size ${width}×${height} is not a positive integer grid`);
	}
	const rowBytes = width * 4;
	if (pixels.length !== rowBytes * height) {
		throw new Error(
			`snapshot readback is ${pixels.length} bytes, expected ${rowBytes * height} for ${width}×${height}`
		);
	}
	const encoded = new Uint8Array(pixels.length);
	for (let y = 0; y < height; y += 1) {
		const from = y * rowBytes;
		const to = y * rowBytes;
		for (let index = 0; index < rowBytes; index += 4) {
			encoded[to + index] = LINEAR_TO_SRGB[pixels[from + index]!]!;
			encoded[to + index + 1] = LINEAR_TO_SRGB[pixels[from + index + 1]!]!;
			encoded[to + index + 2] = LINEAR_TO_SRGB[pixels[from + index + 2]!]!;
			encoded[to + index + 3] = 255;
		}
	}
	return encoded;
}

/**
 * One snapshot as a PNG data URL, or `null` outside a browser (or when the
 * page has no 2D canvas). Encoding happens before `putImageData`, so the
 * canvas never sees a linear byte.
 */
export function snapshotDataUrl(
	pixels: Uint8Array,
	width: number,
	height: number
): string | null {
	const encoded = encodeSnapshotPixels(pixels, width, height);
	if (typeof document === 'undefined') return null;
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (context === null) return null;
	const image = context.createImageData(width, height);
	image.data.set(encoded);
	context.putImageData(image, 0, 0);
	return canvas.toDataURL('image/png');
}
