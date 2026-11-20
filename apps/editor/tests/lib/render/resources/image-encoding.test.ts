import { describe, expect, it } from 'vitest';
import { probeRawImage } from '$lib/render/resources/image-encoding';

function concat(parts: readonly Uint8Array[]): Uint8Array {
	const length = parts.reduce((total, part) => total + part.length, 0);
	const out = new Uint8Array(length);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	for (let index = 0; index < 4; index += 1) out[4 + index] = type.charCodeAt(index);
	out.set(data, 8);
	return out;
}

function png(options: {
	bitDepth?: number;
	colourType?: number;
	extra?: readonly Uint8Array[];
} = {}): Uint8Array {
	const ihdr = new Uint8Array(13);
	const header = new DataView(ihdr.buffer);
	header.setUint32(0, 2);
	header.setUint32(4, 2);
	ihdr[8] = options.bitDepth ?? 8;
	ihdr[9] = options.colourType ?? 6;
	return concat([
		Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk('IHDR', ihdr),
		...(options.extra ?? []),
		pngChunk('IDAT', Uint8Array.from([0])),
		pngChunk('IEND', new Uint8Array())
	]);
}

function exifOrientation(orientation: number): Uint8Array {
	const tiff = new Uint8Array(26);
	const view = new DataView(tiff.buffer);
	tiff[0] = 0x49;
	tiff[1] = 0x49;
	view.setUint16(2, 42, true);
	view.setUint32(4, 8, true);
	view.setUint16(8, 1, true);
	view.setUint16(10, 0x0112, true);
	view.setUint16(12, 3, true);
	view.setUint32(14, 1, true);
	view.setUint16(18, orientation, true);
	return concat([Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0, 0]), tiff]);
}

function jpeg(options: {
	precision?: number;
	components?: number;
	orientation?: number;
} = {}): Uint8Array {
	const components = options.components ?? 3;
	const parts: Uint8Array[] = [Uint8Array.from([0xff, 0xd8])];
	if (options.orientation !== undefined && options.orientation !== 1) {
		const payload = exifOrientation(options.orientation);
		const app1 = new Uint8Array(4 + payload.length);
		app1[0] = 0xff;
		app1[1] = 0xe1;
		new DataView(app1.buffer).setUint16(2, 2 + payload.length);
		app1.set(payload, 4);
		parts.push(app1);
	}
	const frame = new Uint8Array(10 + components * 3);
	const frameView = new DataView(frame.buffer);
	frame[0] = 0xff;
	frame[1] = 0xc0;
	frameView.setUint16(2, 8 + components * 3);
	frame[4] = options.precision ?? 8;
	frameView.setUint16(5, 2);
	frameView.setUint16(7, 2);
	frame[9] = components;
	parts.push(frame);
	parts.push(Uint8Array.from([0xff, 0xda, 0x00, 0x02]));
	parts.push(Uint8Array.from([0xff, 0xd9]));
	return concat(parts);
}

function webp(options: { animated?: boolean; alpha?: boolean } = {}): Uint8Array {
	const flags = (options.animated === true ? 2 : 0) | (options.alpha === true ? 0x10 : 0);
	const vp8x = new Uint8Array(8 + 10);
	vp8x.set([0x56, 0x50, 0x38, 0x58], 0);
	new DataView(vp8x.buffer).setUint32(4, 10, true);
	vp8x[8] = flags;
	// 2×2 canvas, little-endian 24-bit width-1 and height-1.
	vp8x[12] = 1;
	vp8x[15] = 1;
	const body = concat([Uint8Array.from([0x57, 0x45, 0x42, 0x50]), vp8x]);
	const out = new Uint8Array(8 + body.length);
	out.set([0x52, 0x49, 0x46, 0x46], 0);
	new DataView(out.buffer).setUint32(4, body.length, true);
	out.set(body, 8);
	return out;
}

describe('raw material map headers', () => {
	it('accepts an 8-bit RGBA PNG and reports its stored channels', () => {
		expect(probeRawImage(png())).toMatchObject({
			mime: 'image/png',
			width: 2,
			height: 2,
			channels: 4,
			bitDepth: 8
		});
	});

	it('accepts an expanded indexed PNG at 8 bits', () => {
		expect(probeRawImage(png({ colourType: 3 }))).toMatchObject({ channels: 3 });
	});

	it('refuses 16-bit PNG before the decoder allocates', () => {
		expect(() => probeRawImage(png({ bitDepth: 16 }))).toThrow(/unsupported-image-encoding/);
	});

	it('refuses a wide-gamut PNG signal', () => {
		expect(() =>
			probeRawImage(png({ extra: [pngChunk('cICP', Uint8Array.from([1, 13, 0, 1]))] }))
		).toThrow(/unsupported-image-encoding/);
	});

	it('refuses an ICC profile that does not also declare sRGB', () => {
		expect(() =>
			probeRawImage(png({ extra: [pngChunk('iCCP', Uint8Array.from([1, 2, 3]))] }))
		).toThrow(/non-sRGB/);
	});

	it('accepts an ICC profile alongside an explicit sRGB chunk', () => {
		expect(() =>
			probeRawImage(
				png({
					extra: [
						pngChunk('iCCP', Uint8Array.from([1, 2, 3])),
						pngChunk('sRGB', Uint8Array.from([0]))
					]
				})
			)
		).not.toThrow();
	});

	it('refuses an EXIF-oriented PNG raw map', () => {
		expect(() =>
			probeRawImage(png({ extra: [pngChunk('eXIf', exifOrientation(6).subarray(6))] }))
		).toThrow(/EXIF orientation/);
	});

	it('accepts 8-bit grayscale and RGB JPEGs', () => {
		expect(probeRawImage(jpeg({ components: 1 }))).toMatchObject({ channels: 1, bitDepth: 8 });
		expect(probeRawImage(jpeg())).toMatchObject({ channels: 3, bitDepth: 8 });
	});

	it('refuses 12-bit and CMYK JPEGs', () => {
		expect(() => probeRawImage(jpeg({ precision: 12 }))).toThrow(/unsupported-image-encoding/);
		expect(() => probeRawImage(jpeg({ components: 4 }))).toThrow(/CMYK/);
	});

	it('refuses an EXIF-oriented JPEG raw map', () => {
		expect(() => probeRawImage(jpeg({ orientation: 8 }))).toThrow(/EXIF orientation/);
	});

	it('accepts a static WebP and refuses an animated one', () => {
		expect(probeRawImage(webp({ alpha: true }))).toMatchObject({ channels: 4, bitDepth: 8 });
		expect(() => probeRawImage(webp({ animated: true }))).toThrow(/animated WebP/);
	});
});
