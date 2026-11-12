/**
 * T2 gallery UX recovery §7.1 — the Artwork selection polygon and size tags.
 *
 * Selection is a screen-space reading of the Artwork's projected outer corners,
 * 6 px outside the frame. It is deliberately not mesh ink: a frame must stay
 * visible while it is selected.
 */

export type ArtworkScreenPoint = { readonly x: number; readonly y: number };

export type ArtworkSizeTag = {
	readonly id: 'bottom' | 'right';
	readonly x: number;
	readonly y: number;
	readonly text: string;
};

export type ArtworkSelectionGeometry = {
	readonly corners: readonly ArtworkScreenPoint[];
	readonly polygon: string;
	readonly tags: readonly ArtworkSizeTag[];
};

export const ARTWORK_SELECTION_STANDOFF_PX = 6;
export const ARTWORK_SIZE_TAG_GAP_PX = 14;

function pushOutward(
	point: ArtworkScreenPoint,
	center: ArtworkScreenPoint,
	distance: number
): ArtworkScreenPoint {
	const dx = point.x - center.x;
	const dy = point.y - center.y;
	const length = Math.hypot(dx, dy);
	if (length < 1e-6) return point;
	return { x: point.x + (dx / length) * distance, y: point.y + (dy / length) * distance };
}

/**
 * One closed polygon through the four pushed corners, plus the two image-size
 * tags. During a corner drag the bottom tag carries the combined image and
 * framed reading; the right tag stays out of its way.
 */
export function artworkSelectionGeometry(
	points: readonly ArtworkScreenPoint[],
	sizes: {
		readonly imageWidthCm: number;
		readonly imageHeightCm: number;
		readonly framedWidthCm: number;
		readonly framedHeightCm: number;
	},
	resizing: boolean,
	standoff = ARTWORK_SELECTION_STANDOFF_PX
): ArtworkSelectionGeometry {
	const center = points.length === 0
		? { x: 0, y: 0 }
		: {
				x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
				y: points.reduce((sum, point) => sum + point.y, 0) / points.length
			};
	const corners = points.map((point) => pushOutward(point, center, standoff));
	const polygon = corners.map((point) => `${point.x} ${point.y}`).join(' ');
	if (corners.length !== 4) return { corners, polygon, tags: [] };
	const left = Math.min(...corners.map((point) => point.x));
	const right = Math.max(...corners.map((point) => point.x));
	const top = Math.min(...corners.map((point) => point.y));
	const bottom = Math.max(...corners.map((point) => point.y));
	const width = sizes.imageWidthCm.toFixed(1);
	const height = sizes.imageHeightCm.toFixed(1);
	const tags: ArtworkSizeTag[] = [
		{
			id: 'bottom',
			x: (left + right) / 2,
			y: bottom + ARTWORK_SIZE_TAG_GAP_PX,
			text: resizing
				? `${width} × ${height} cm · framed ${sizes.framedWidthCm.toFixed(1)} × ${sizes.framedHeightCm.toFixed(1)}`
				: `${width} cm`
		}
	];
	if (!resizing) {
		tags.push({
			id: 'right',
			x: right + ARTWORK_SIZE_TAG_GAP_PX,
			y: (top + bottom) / 2,
			text: `${height} cm`
		});
	}
	return { corners, polygon, tags };
}
