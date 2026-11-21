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

type IccSegment = { sequence: number; total: number; data: Uint8Array };

/** Read an ICC `desc` or `mluc` tag. The profile is untrusted input. */
function iccDescription(profile: Uint8Array, offset: number, size: number): string | undefined {
	const view = viewOf(profile);
	const end = offset + size;
	if (offset < 0 || size < 12 || end > profile.length) return undefined;
	const type = String.fromCharCode(
		profile[offset]!,
		profile[offset + 1]!,
		profile[offset + 2]!,
		profile[offset + 3]!
	);
	if (type === 'desc') {
		const length = view.getUint32(offset + 8);
		if (length === 0 || length > 512 || 12 + length > size) return undefined;
		return String.fromCharCode(...profile.subarray(offset + 12, offset + 12 + length)).replace(/\0+$/, '');
	}
	if (type === 'mluc') {
		const records = view.getUint32(offset + 8);
		const recordSize = view.getUint32(offset + 12);
		if (records < 1 || records > 64 || recordSize < 12) return undefined;
		const table = 16 + records * recordSize;
		if (table > size) return undefined;
		// ICC.1 §10.15: each record's string offset is measured from the start of
		// the tag, not the profile. The first record is the profile's own
		// description; a later localisation cannot override it.
		const length = view.getUint32(offset + 20);
		const relative = view.getUint32(offset + 24);
		if (
			length < 2 ||
			length > 1024 ||
			length % 2 !== 0 ||
			relative < table ||
			relative + length > size
		) {
			return undefined;
		}
		const textOffset = offset + relative;
		if (textOffset + length > end) return undefined;
		const units: number[] = [];
		for (let index = 0; index < length; index += 2) {
			units.push(view.getUint16(textOffset + index));
		}
		return String.fromCharCode(...units).replace(/\0+$/, '');
	}
	return undefined;
}

/** sRGB primaries, Bradford-adapted to the ICC D50 PCS (IEC 61966-2.1 profiles). */
const SRGB_D50_COLORANTS: Readonly<Record<'rXYZ' | 'gXYZ' | 'bXYZ', readonly [number, number, number]>> = {
	rXYZ: [0.4361, 0.2225, 0.0139],
	gXYZ: [0.3851, 0.7169, 0.0971],
	bXYZ: [0.1431, 0.0606, 0.7141]
};
/** Published sRGB profiles round their colorants differently; P3 differs by >0.07. */
const SRGB_COLORANT_TOLERANCE = 0.005;

/** One `XYZ ` tag's first s15Fixed16 triple, or undefined when malformed. */
function iccXyz(profile: Uint8Array, offset: number, size: number): [number, number, number] | undefined {
	if (size < 20 || offset + 20 > profile.length || !matches(profile, offset, 'XYZ ')) return undefined;
	const view = viewOf(profile);
	return [
		view.getInt32(offset + 8) / 65536,
		view.getInt32(offset + 12) / 65536,
		view.getInt32(offset + 16) / 65536
	];
}

/**
 * Admit only an ICC profile that identifies itself as the standard sRGB space.
 * JPEG has no portable sRGB chunk, so an absent profile is the untagged case;
 * any other profile is potentially wide-gamut and must not be accepted
 * silently. A matrix profile must also carry sRGB colorants: a name alone does
 * not make a wide-gamut matrix standard sRGB.
 */
function jpegIccIsStandardSrgb(segments: readonly IccSegment[]): boolean {
	const description = jpegIccDescription(segments);
	if (description === undefined || !/\bsrgb\b/i.test(description)) return false;
	const profile = assembleIcc(segments);
	if (profile === undefined) return false;
	const view = viewOf(profile);
	const tags = view.getUint32(128);
	for (let index = 0; index < tags; index += 1) {
		const entry = 132 + index * 12;
		const signature = String.fromCharCode(...profile.subarray(entry, entry + 4));
		if (signature !== 'rXYZ' && signature !== 'gXYZ' && signature !== 'bXYZ') continue;
		const xyz = iccXyz(profile, view.getUint32(entry + 4), view.getUint32(entry + 8));
		if (xyz === undefined) return false;
		const expected = SRGB_D50_COLORANTS[signature];
		if (xyz.some((value, axis) => Math.abs(value - expected[axis]!) > SRGB_COLORANT_TOLERANCE)) {
			return false;
		}
	}
	return true;
}

/** Reassemble a complete, ordered APP2 ICC profile with a valid header and tag table. */
function assembleIcc(segments: readonly IccSegment[]): Uint8Array | undefined {
	if (segments.length === 0) return undefined;
	const total = segments[0]!.total;
	if (total < 1 || segments.length !== total) return undefined;
	const ordered = [...segments].sort((left, right) => left.sequence - right.sequence);
	if (ordered.some((segment, index) => segment.total !== total || segment.sequence !== index + 1)) {
		return undefined;
	}
	const length = ordered.reduce((sum, segment) => sum + segment.data.length, 0);
	if (length < 132) return undefined;
	const profile = new Uint8Array(length);
	let cursor = 0;
	for (const segment of ordered) {
		profile.set(segment.data, cursor);
		cursor += segment.data.length;
	}
	const view = viewOf(profile);
	if (view.getUint32(0) > profile.length) return undefined;
	const tags = view.getUint32(128);
	if (tags > 256 || 132 + tags * 12 > profile.length) return undefined;
	return profile;
}

/** The profile's own `desc` text, from an RGB or GRAY profile only. */
function jpegIccDescription(segments: readonly IccSegment[]): string | undefined {
	const profile = assembleIcc(segments);
	if (profile === undefined) return undefined;
	const view = viewOf(profile);
	const colourSpace = String.fromCharCode(...profile.subarray(16, 20));
	if (colourSpace !== 'RGB ' && colourSpace !== 'GRAY') return undefined;
	const tags = view.getUint32(128);
	for (let index = 0; index < tags; index += 1) {
		const entry = 132 + index * 12;
		if (!matches(profile, entry, 'desc')) continue;
		const offset = view.getUint32(entry + 4);
		const size = view.getUint32(entry + 8);
		if (size < 12 || offset + size > profile.length) continue;
		return iccDescription(profile, offset, size);
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
	const iccSegments: IccSegment[] = [];
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
		if (marker === 0xe2 && size >= 16 && matches(bytes, payload, 'ICC_PROFILE\0')) {
			const sequence = bytes[payload + 12]!;
			const total = bytes[payload + 13]!;
			if (sequence < 1 || total < 1 || sequence > total) return invalid();
			iccSegments.push({
				sequence,
				total,
				data: bytes.subarray(payload + 14, offset + size)
			});
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
	if (iccSegments.length > 0) {
		if (!jpegIccIsStandardSrgb(iccSegments)) {
			return unsupported(
				'the JPEG carries an ICC profile that is not verified as standard sRGB',
				'Re-export the map as untagged sRGB or with the standard sRGB IEC61966-2.1 profile.'
			);
		}
	}
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
