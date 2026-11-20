/**
 * Container-header validation for raw material maps.
 *
 * A raw role must decode stored channel values with no profile transform,
 * premultiplication or EXIF rotation. The browser decoders can do that when
 * asked, but only after they have allocated a bitmap; a 16-bit, CMYK,
 * animated or wide-gamut file would otherwise reach the GPU as something the
 * authored recipe never described. This module checks the bytes first, before
 * `createImageBitmap`, and refuses with an action the creator can take.
 *
 * It is deliberately dependency-free: the render resource layer may not import
 * the authored project model (`render-layer-boundary`).
 */

export type RawImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export type RawImageEncoding = {
	readonly mime: RawImageMime;
	readonly width: number;
	readonly height: number;
	/** Stored channels before decode: grey, grey+alpha, RGB or RGBA. */
	readonly channels: 1 | 2 | 3 | 4;
	readonly bitDepth: 8;
};

/** P20's admitted edge, enforced before a decoder allocates the bitmap. */
const MAX_EDGE = 4096;
const MAX_BYTES = 25 * 1024 * 1024;

function unsupported(detail: string, action: string): never {
	throw new Error(`unsupported-image-encoding: ${detail}. ${action}`);
}

function invalid(): never {
	throw new Error('Material maps require a valid static PNG, JPEG or WebP image.');
}

function matches(bytes: Uint8Array, offset: number, ascii: string): boolean {
	return (
		offset + ascii.length <= bytes.length &&
		[...ascii].every((char, index) => bytes[offset + index] === char.charCodeAt(0))
	);
}

function viewOf(bytes: Uint8Array): DataView {
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function exifOrientation(bytes: Uint8Array): number | undefined {
	if (bytes.length < 8) return undefined;
	const little = matches(bytes, 0, 'II');
	if (!little && !matches(bytes, 0, 'MM')) return undefined;
	const view = viewOf(bytes);
	if (view.getUint16(2, little) !== 42) return undefined;
	const directory = view.getUint32(4, little);
	if (directory < 8 || directory + 2 > bytes.length) return undefined;
	const entries = view.getUint16(directory, little);
	if (directory + 2 + entries * 12 > bytes.length) return undefined;
	for (let index = 0; index < entries; index += 1) {
		const offset = directory + 2 + index * 12;
		if (view.getUint16(offset, little) !== 0x0112) continue;
		if (view.getUint16(offset + 2, little) !== 3 || view.getUint32(offset + 4, little) !== 1) {
			return undefined;
		}
		const orientation = view.getUint16(offset + 8, little);
		return orientation >= 1 && orientation <= 8 ? orientation : undefined;
	}
	return undefined;
}

function png(bytes: Uint8Array, view: DataView): RawImageEncoding {
	if (bytes.length < 33 || view.getUint32(8) !== 13 || !matches(bytes, 12, 'IHDR')) return invalid();
	const width = view.getUint32(16);
	const height = view.getUint32(20);
	const bitDepth = view.getUint8(24);
	const colourType = view.getUint8(25);
	let hasData = false;
	let hasSrgb = false;
	let hasIcc = false;
	let hasCicp = false;
	for (let offset = 8; offset + 12 <= bytes.length; ) {
		const size = view.getUint32(offset);
		const next = offset + 12 + size;
		if (next > bytes.length) return invalid();
		const kind = String.fromCharCode(
			bytes[offset + 4]!,
			bytes[offset + 5]!,
			bytes[offset + 6]!,
			bytes[offset + 7]!
		);
		if (kind === 'acTL') return unsupported('animated PNG', 'Export a single frame.');
		if (kind === 'eXIf') {
			const orientation = exifOrientation(bytes.subarray(offset + 8, offset + 8 + size)) ?? 1;
			if (orientation !== 1) {
				return unsupported(
					'the raw map carries an EXIF orientation',
					'Re-export the map without rotation.'
				);
			}
		}
		if (kind === 'IDAT') hasData = true;
		if (kind === 'sRGB') hasSrgb = true;
		if (kind === 'iCCP') hasIcc = true;
		if (kind === 'cICP') hasCicp = true;
		if (kind === 'IEND' && size === 0 && hasData && next === bytes.length) break;
		offset = next;
	}
	if (!hasData) return invalid();
	if (bitDepth !== 8) {
		return unsupported(
			`${bitDepth}-bit PNG`,
			'Re-export the map as 8-bit PNG, JPEG or WebP.'
		);
	}
	const channels = new Map<number, 1 | 2 | 3 | 4>([
		[0, 1],
		[4, 2],
		[2, 3],
		[6, 4],
		[3, 3]
	]).get(colourType);
	if (channels === undefined) return unsupported('unsupported PNG colour type', 'Re-export as RGB or RGBA.');
	if (hasCicp || (hasIcc && !hasSrgb)) {
		return unsupported(
			'the PNG carries a non-sRGB colour profile',
			'Re-export the map as untagged sRGB.'
		);
	}
	return { mime: 'image/png', width, height, channels, bitDepth: 8 };
}

function jpeg(bytes: Uint8Array, view: DataView): RawImageEncoding {
	if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return invalid();
	let orientation: number | undefined;
	let precision: number | undefined;
	let width = 0;
	let height = 0;
	let channels: 1 | 2 | 3 | 4 | undefined;
	let hasIcc = false;
	for (let offset = 2; offset + 4 <= bytes.length; ) {
		if (bytes[offset++] !== 0xff) return invalid();
		while (bytes[offset] === 0xff) offset += 1;
		const marker = bytes[offset++];
		if (marker === undefined || offset + 2 > bytes.length) return invalid();
		const size = view.getUint16(offset);
		if (size < 2 || offset + size > bytes.length) return invalid();
		const payload = offset + 2;
		if (marker === 0xda) break;
		if (marker === 0xe1 && size >= 8 && matches(bytes, payload, 'Exif\0\0')) {
			orientation ??= exifOrientation(bytes.subarray(payload + 6, offset + size));
		}
		if (marker === 0xe2 && size >= 14 && matches(bytes, payload, 'ICC_PROFILE\0')) {
			hasIcc = true;
		}
		if ([0xc0, 0xc1, 0xc2].includes(marker) && size >= 8) {
			precision = view.getUint8(payload);
			height = view.getUint16(payload + 1);
			width = view.getUint16(payload + 3);
			const components = view.getUint8(payload + 5);
			channels =
				components === 1 ? 1 : components === 2 ? 2 : components === 3 ? 3 : components === 4 ? 4 : undefined;
			if (channels === undefined) {
				return unsupported(`${components}-component JPEG`, 'Re-export as grayscale, RGB or RGBA.');
			}
		}
		offset += size;
	}
	if (precision === undefined || width < 1 || height < 1) return invalid();
	if (precision !== 8) {
		return unsupported(`${precision}-bit JPEG`, 'Re-export the map as 8-bit.');
	}
	if (channels === 4) {
		// CMYK/YCbCrK is not the authored RGB channel meaning.
		return unsupported('CMYK JPEG', 'Re-export as RGB.');
	}
	if ((orientation ?? 1) !== 1) {
		return unsupported(
			'the raw map carries an EXIF orientation',
			'Re-export the map without rotation.'
		);
	}
	// JPEG has no standard sRGB marker when untagged; an ICC profile may still
	// describe a non-sRGB space, but browsers expose no portable profile id here.
	void hasIcc;
	return { mime: 'image/jpeg', width, height, channels: channels ?? 3, bitDepth: 8 };
}

function webp(bytes: Uint8Array, view: DataView): RawImageEncoding {
	if (view.getUint32(4, true) + 8 !== bytes.length) return invalid();
	let width = 0;
	let height = 0;
	let channels: 3 | 4 = 3;
	let hasAlpha = false;
	for (let offset = 12; offset + 8 <= bytes.length; ) {
		const size = view.getUint32(offset + 4, true);
		const start = offset + 8;
		const next = start + size + (size % 2);
		if (next > bytes.length) return invalid();
		if (matches(bytes, offset, 'ANIM') || matches(bytes, offset, 'ANMF')) {
			return unsupported('animated WebP', 'Export a single frame.');
		}
		if (matches(bytes, offset, 'VP8X') && size === 10) {
			const flags = view.getUint8(start);
			if ((flags & 2) !== 0) return unsupported('animated WebP', 'Export a single frame.');
			hasAlpha = (flags & 0x10) !== 0;
			width = (view.getUint32(start + 4, true) & 0xffffff) + 1;
			height = view.getUint16(start + 7, true) + view.getUint8(start + 9) * 65536 + 1;
		}
		if (matches(bytes, offset, 'VP8 ') && size >= 10) {
			width = view.getUint16(start + 6, true) & 0x3fff;
			height = view.getUint16(start + 8, true) & 0x3fff;
			hasAlpha = false;
		}
		if (matches(bytes, offset, 'VP8L') && size >= 5) {
			const bits = view.getUint32(start + 1, true);
			width = (bits & 0x3fff) + 1;
			height = ((bits >>> 14) & 0x3fff) + 1;
			hasAlpha = ((bits >>> 28) & 1) === 1;
		}
		offset = next;
	}
	if (width < 1 || height < 1) return invalid();
	channels = hasAlpha ? 4 : 3;
	return { mime: 'image/webp', width, height, channels, bitDepth: 8 };
}

/**
 * Probe one raw map before decode.
 *
 * Refuses non-8-bit, CMYK, animated and EXIF-oriented files. A wide-gamut PNG
 * signal (`cICP`, or an ICC profile without an sRGB chunk) is refused too; the
 * raw path must preserve authored channel values, not reinterpret them.
 */
export function probeRawImage(bytes: Uint8Array): RawImageEncoding {
	if (bytes.length > MAX_BYTES) return invalid();
	if (bytes.length < 12) return invalid();
	const view = viewOf(bytes);
	let encoding: RawImageEncoding;
	if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
		encoding = png(bytes, view);
	} else if (view.getUint16(0) === 0xffd8) {
		encoding = jpeg(bytes, view);
	} else if (matches(bytes, 0, 'RIFF') && matches(bytes, 8, 'WEBP')) {
		encoding = webp(bytes, view);
	} else {
		return invalid();
	}
	if (
		encoding.width < 1 ||
		encoding.height < 1 ||
		encoding.width > MAX_EDGE ||
		encoding.height > MAX_EDGE
	) {
		return unsupported(
			`${encoding.width}×${encoding.height} image`,
			`Resize the map to ${MAX_EDGE} px per edge or less.`
		);
	}
	return encoding;
}
