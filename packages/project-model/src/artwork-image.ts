import { ARTWORK_MAX_IMAGE_EDGE, isArtworkImageEdge } from './artwork';

export type ArtworkMime = 'image/png' | 'image/jpeg' | 'image/webp';
type Dimensions = { pixelWidth: number; pixelHeight: number };
export const ARTWORK_MAX_BYTES = 25 * 1024 * 1024;

function matches(bytes: Uint8Array, offset: number, ascii: string): boolean {
	return offset + ascii.length <= bytes.length &&
		[...ascii].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
}

function invalid(): never {
	throw new Error('Artwork requires a valid static PNG, JPEG or WebP image.');
}

function png(bytes: Uint8Array, view: DataView): Dimensions {
	if (bytes.length < 33 || view.getUint32(8) !== 13 || !matches(bytes, 12, 'IHDR')) return invalid();
	let hasData = false;
	for (let offset = 8; offset + 12 <= bytes.length;) {
		const size = view.getUint32(offset);
		const next = offset + 12 + size;
		if (next > bytes.length) return invalid();
		if (matches(bytes, offset + 4, 'acTL')) throw new Error('Animated images cannot be imported as Artwork.');
		if (matches(bytes, offset + 4, 'eXIf')) {
			const orientation = exif(bytes.subarray(offset + 8, offset + 8 + size));
			if (orientation !== 1) throw new Error('Artwork supports embedded orientation in JPEG only.');
		}
		if (matches(bytes, offset + 4, 'IDAT')) hasData = true;
		if (matches(bytes, offset + 4, 'IEND') && size === 0 && hasData && next === bytes.length) {
			return { pixelWidth: view.getUint32(16), pixelHeight: view.getUint32(20) };
		}
		offset = next;
	}
	return invalid();
}

function exif(bytes: Uint8Array): number {
	if (bytes.length < 8) return invalid();
	const little = matches(bytes, 0, 'II');
	if (!little && !matches(bytes, 0, 'MM')) return invalid();
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (view.getUint16(2, little) !== 42) return invalid();
	const directory = view.getUint32(4, little);
	if (directory < 8 || directory + 2 > bytes.length) return invalid();
	const entries = view.getUint16(directory, little);
	if (directory + 2 + entries * 12 > bytes.length) return invalid();
	for (let index = 0; index < entries; index++) {
		const offset = directory + 2 + index * 12;
		if (view.getUint16(offset, little) !== 0x0112) continue;
		if (view.getUint16(offset + 2, little) !== 3 || view.getUint32(offset + 4, little) !== 1) return invalid();
		const orientation = view.getUint16(offset + 8, little);
		return orientation >= 1 && orientation <= 8 ? orientation : invalid();
	}
	return 1;
}

function jpeg(bytes: Uint8Array, view: DataView): Dimensions {
	let orientation = 1;
	let frame: Dimensions | undefined;
	if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return invalid();
	for (let offset = 2; offset + 4 <= bytes.length;) {
		if (bytes[offset++] !== 0xff) return invalid();
		while (bytes[offset] === 0xff) offset++;
		const marker = bytes[offset++];
		if (marker === undefined || offset + 2 > bytes.length) return invalid();
		const size = view.getUint16(offset);
		if (size < 2 || offset + size > bytes.length) return invalid();
		const payload = offset + 2;
		if (marker === 0xda && frame !== undefined) {
			return orientation >= 5
				? { pixelWidth: frame.pixelHeight, pixelHeight: frame.pixelWidth }
				: frame;
		}
		if (marker === 0xe1 && size >= 8 && matches(bytes, payload, 'Exif\0\0')) {
			orientation = exif(bytes.subarray(payload + 6, offset + size));
		}
		if ([0xc0, 0xc1, 0xc2].includes(marker) && size >= 8) {
			frame = { pixelWidth: view.getUint16(payload + 3), pixelHeight: view.getUint16(payload + 1) };
		}
		offset += size;
	}
	return invalid();
}

function webp(bytes: Uint8Array, view: DataView): Dimensions {
	if (view.getUint32(4, true) + 8 !== bytes.length) return invalid();
	let canvas: Dimensions | undefined;
	let image: Dimensions | undefined;
	for (let offset = 12; offset + 8 <= bytes.length;) {
		const size = view.getUint32(offset + 4, true);
		const start = offset + 8;
		const next = start + size + (size % 2);
		if (next > bytes.length) return invalid();
		if (matches(bytes, offset, 'ANIM') || matches(bytes, offset, 'ANMF')) {
			throw new Error('Animated images cannot be imported as Artwork.');
		}
		if (matches(bytes, offset, 'EXIF')) {
			const headerSize = size >= 6 && matches(bytes, start, 'Exif\0\0') ? 6 : 0;
			if (exif(bytes.subarray(start + headerSize, start + size)) !== 1) {
				throw new Error('Artwork supports embedded orientation in JPEG only.');
			}
		}
		if (matches(bytes, offset, 'VP8X') && size === 10) {
			if ((view.getUint8(start) & 2) !== 0) throw new Error('Animated images cannot be imported as Artwork.');
			canvas = {
				pixelWidth: (view.getUint32(start + 3, true) & 0xffffff) + 1,
				pixelHeight: view.getUint16(start + 6, true) + view.getUint8(start + 8) * 65536 + 1
			};
		}
		if (matches(bytes, offset, 'VP8 ') && size >= 10 &&
			view.getUint8(start + 3) === 0x9d && view.getUint16(start + 4) === 0x012a) {
			image = {
				pixelWidth: view.getUint16(start + 6, true) & 0x3fff,
				pixelHeight: view.getUint16(start + 8, true) & 0x3fff
			};
		}
		if (matches(bytes, offset, 'VP8L') && size >= 5 && view.getUint8(start) === 0x2f) {
			const sizeBits = view.getUint32(start + 1, true);
			image = { pixelWidth: (sizeBits & 0x3fff) + 1, pixelHeight: ((sizeBits >>> 14) & 0x3fff) + 1 };
		}
		offset = next;
	}
	if (image === undefined || (canvas !== undefined &&
		(canvas.pixelWidth !== image.pixelWidth || canvas.pixelHeight !== image.pixelHeight))) return invalid();
	return image;
}

/** Bounded container metadata probe. The editor additionally confirms pixel decode at import. */
export function probeArtworkImage(bytes: Uint8Array): Dimensions & { mime: ArtworkMime } {
	if (bytes.length > ARTWORK_MAX_BYTES) throw new Error('Artwork images must be 25 MiB or smaller.');
	if (bytes.length < 12) return invalid();
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let result: Dimensions & { mime: ArtworkMime };
	if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
		result = { mime: 'image/png', ...png(bytes, view) };
	} else if (view.getUint16(0) === 0xffd8) {
		result = { mime: 'image/jpeg', ...jpeg(bytes, view) };
	} else if (matches(bytes, 0, 'RIFF') && matches(bytes, 8, 'WEBP')) {
		result = { mime: 'image/webp', ...webp(bytes, view) };
	} else {
		return invalid();
	}
	if (!isArtworkImageEdge(result.pixelWidth) || !isArtworkImageEdge(result.pixelHeight)) {
		throw new Error(`Artwork currently supports images up to ${ARTWORK_MAX_IMAGE_EDGE} px per edge. Resize the image and try again.`);
	}
	return result;
}
