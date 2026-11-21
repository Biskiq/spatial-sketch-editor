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

function ascii(text: string): number[] {
	return [...text].map((char) => char.charCodeAt(0));
}

/** An ICC v2 `desc` (textDescriptionType) tag. */
function descTag(text: string): Uint8Array {
	const tag = new Uint8Array(12 + text.length + 1);
	tag.set(ascii('desc'), 0);
	new DataView(tag.buffer).setUint32(8, text.length + 1);
	tag.set(ascii(text), 12);
	return tag;
}

/**
 * An ICC v4 `mluc` tag with one enUS record. String offsets are measured from
 * the start of the tag (ICC.1 §10.15).
 */
function mlucTag(text: string): Uint8Array {
	const units = [...text].map((char) => char.charCodeAt(0));
	const tag = new Uint8Array(28 + units.length * 2);
	const view = new DataView(tag.buffer);
	tag.set(ascii('mluc'), 0);
	view.setUint32(8, 1);
	view.setUint32(12, 12);
	tag.set(ascii('enUS'), 16);
	view.setUint32(20, units.length * 2);
	view.setUint32(24, 28);
	units.forEach((unit, index) => view.setUint16(28 + index * 2, unit));
	return tag;
}

function xyzTag(x: number, y: number, z: number): Uint8Array {
	const tag = new Uint8Array(20);
	const view = new DataView(tag.buffer);
	tag.set(ascii('XYZ '), 0);
	view.setInt32(8, Math.round(x * 65536));
	view.setInt32(12, Math.round(y * 65536));
	view.setInt32(16, Math.round(z * 65536));
	return tag;
}

/** A minimal RGB ICC profile: 128-byte header, tag table, 4-byte aligned tag data. */
function iccProfile(tags: readonly (readonly [string, Uint8Array])[]): Uint8Array {
	const tableEnd = 132 + tags.length * 12;
	const offsets: number[] = [];
	let cursor = tableEnd;
	for (const [, data] of tags) {
		cursor = Math.ceil(cursor / 4) * 4;
		offsets.push(cursor);
		cursor += data.length;
	}
	const profile = new Uint8Array(cursor);
	const view = new DataView(profile.buffer);
	view.setUint32(0, profile.length);
	profile.set(ascii('RGB '), 16);
	view.setUint32(128, tags.length);
	tags.forEach(([signature, data], index) => {
		const entry = 132 + index * 12;
		profile.set(ascii(signature), entry);
		view.setUint32(entry + 4, offsets[index]!);
		view.setUint32(entry + 8, data.length);
		profile.set(data, offsets[index]!);
	});
	return profile;
}

const SRGB_COLORANTS: readonly (readonly [string, Uint8Array])[] = [
	['rXYZ', xyzTag(0.43607, 0.22249, 0.01392)],
	['gXYZ', xyzTag(0.38515, 0.71687, 0.09708)],
	['bXYZ', xyzTag(0.14307, 0.06061, 0.7141)]
];
const DISPLAY_P3_COLORANTS: readonly (readonly [string, Uint8Array])[] = [
	['rXYZ', xyzTag(0.51512, 0.2412, -0.00105)],
	['gXYZ', xyzTag(0.29198, 0.69225, 0.04189)],
	['bXYZ', xyzTag(0.1571, 0.06657, 0.78407)]
];

function jpeg(options: {
	precision?: number;
	components?: number;
	orientation?: number;
	icc?: string;
	iccProfile?: Uint8Array;
} = {}): Uint8Array {
	const components = options.components ?? 3;
	const parts: Uint8Array[] = [Uint8Array.from([0xff, 0xd8])];
	const profile =
		options.iccProfile ??
		(options.icc === undefined ? undefined : iccProfile([['desc', descTag(options.icc)]]));
	if (profile !== undefined) {
		const header = new Uint8Array(14);
		header.set([0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0], 0);
		header[12] = 1;
		header[13] = 1;
		const payload = concat([header, profile]);
		const app2 = new Uint8Array(4 + payload.length);
		app2[0] = 0xff;
		app2[1] = 0xe2;
		new DataView(app2.buffer).setUint16(2, 2 + payload.length);
		app2.set(payload, 4);
		parts.push(app2);
	}
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

	it('accepts a JPEG tagged as standard sRGB and refuses an unverified ICC profile', () => {
		expect(probeRawImage(jpeg({ icc: 'sRGB IEC61966-2.1' }))).toMatchObject({
			channels: 3,
			bitDepth: 8
		});
		expect(() => probeRawImage(jpeg({ icc: 'Display P3' }))).toThrow(
			/ICC profile that is not verified as standard sRGB/
		);
		expect(() => probeRawImage(jpeg({ icc: 'Adobe RGB (1998)' }))).toThrow(
			/ICC profile that is not verified as standard sRGB/
		);
	});

	it('reads an ICC v4 mluc description at its tag-relative offset', () => {
		// A real v4 sRGB profile stores its description as `mluc`, whose string
		// offset counts from the tag start. The old reader treated it as a
		// profile offset and refused every such profile.
		const v4 = iccProfile([['desc', mlucTag('sRGB IEC61966-2.1')], ...SRGB_COLORANTS]);
		expect(probeRawImage(jpeg({ iccProfile: v4 }))).toMatchObject({ channels: 3, bitDepth: 8 });
		expect(() =>
			probeRawImage(jpeg({ iccProfile: iccProfile([['desc', mlucTag('Display P3')]]) }))
		).toThrow(/ICC profile that is not verified as standard sRGB/);
	});

	it('refuses a mluc record whose offset points outside its own tag', () => {
		// The old reader followed a profile-absolute offset, so text elsewhere in
		// the profile (here a second desc tag spelling sRGB) could be borrowed.
		const borrowed = iccProfile([
			['desc', mlucTag('Display P3')],
			['dmdd', descTag('sRGB IEC61966-2.1')]
		]);
		const view = new DataView(borrowed.buffer);
		const descOffset = view.getUint32(132 + 4);
		const otherOffset = view.getUint32(144 + 4);
		view.setUint32(descOffset + 24, otherOffset + 12);
		expect(() => probeRawImage(jpeg({ iccProfile: borrowed }))).toThrow(
			/ICC profile that is not verified as standard sRGB/
		);
	});

	it('refuses a wide-gamut matrix profile that merely names itself sRGB', () => {
		const misnamed = iccProfile([['desc', descTag('sRGB-ish wide')], ...DISPLAY_P3_COLORANTS]);
		expect(() => probeRawImage(jpeg({ iccProfile: misnamed }))).toThrow(
			/ICC profile that is not verified as standard sRGB/
		);
		const honest = iccProfile([['desc', descTag('sRGB IEC61966-2.1')], ...SRGB_COLORANTS]);
		expect(probeRawImage(jpeg({ iccProfile: honest }))).toMatchObject({ channels: 3 });
	});

	it('accepts a static WebP and refuses an animated one', () => {
		expect(probeRawImage(webp({ alpha: true }))).toMatchObject({ channels: 4, bitDepth: 8 });
		expect(() => probeRawImage(webp({ animated: true }))).toThrow(/animated WebP/);
	});
});
