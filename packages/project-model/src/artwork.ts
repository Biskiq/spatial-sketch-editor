/** Artwork dimensions are oriented display pixels and world-space metres. */
export const ARTWORK_MAX_IMAGE_EDGE = 4096;
export const ARTWORK_MIN_METERS = 0.001;
export const ARTWORK_MAX_METERS = 1000;

export type ArtworkImage = {
	assetId: string;
	pixelWidth: number;
	pixelHeight: number;
};

export type ArtworkImageSource = ArtworkImage & { kind: 'image' };
export type ArtworkLibraryEntry = ArtworkImage & { name: string };

export function isArtworkAssetId(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

export function isArtworkImageEdge(value: number): boolean {
	return Number.isInteger(value) && value > 0 && value <= ARTWORK_MAX_IMAGE_EDGE;
}

export function artworkHeight(widthMeters: number, image: ArtworkImage): number {
	return widthMeters * (image.pixelHeight / image.pixelWidth);
}

export function isArtworkWidth(widthMeters: number, image: ArtworkImage): boolean {
	const heightMeters = artworkHeight(widthMeters, image);
	return widthMeters >= ARTWORK_MIN_METERS && widthMeters <= ARTWORK_MAX_METERS &&
		heightMeters >= ARTWORK_MIN_METERS && heightMeters <= ARTWORK_MAX_METERS;
}

export function artworkAssetUri(assetId: string): string {
	return `/project-assets/${assetId}`;
}

export function defaultArtworkWidth(image: ArtworkImage): number {
	const inverseAspect = image.pixelWidth / image.pixelHeight;
	return Math.max(ARTWORK_MIN_METERS * Math.max(1, inverseAspect),
		Math.min(1, ARTWORK_MAX_METERS * Math.min(1, inverseAspect)));
}
