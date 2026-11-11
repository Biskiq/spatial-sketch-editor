import type { ArtworkImage } from '@portfolio/project-model';

export async function verifyArtworkDecode(bytes: Uint8Array, mime: string, image: Pick<ArtworkImage, 'pixelWidth' | 'pixelHeight'>) {
	const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: mime }), { imageOrientation: 'from-image' });
	try {
		if (bitmap.width !== image.pixelWidth || bitmap.height !== image.pixelHeight) {
			throw new Error('The decoded image dimensions do not match the file.');
		}
	} finally {
		bitmap.close();
	}
}
