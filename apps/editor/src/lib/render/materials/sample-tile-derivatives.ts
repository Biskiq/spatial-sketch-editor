/**
 * Responsive display sizes of a sample tile (U1).
 *
 * One 256 px master is the only stored picture. XS, S and M derive from it, so
 * a list never opens a full-resolution texture and a Retina display is covered
 * without a second render:
 *
 * - **XS 64**: a tighter window (the master's central 62.5%), so the material
 *   detail that would shrink to noise at 44 CSS px stays legible;
 * - **S 112**: the whole master, scaled;
 * - **M 256**: the master itself.
 *
 * A derivative is chosen by `cssPx × devicePixelRatio`: the smallest one whose
 * edge covers the display size in device pixels, M when none does (a larger
 * display is a render of its own, not an upscale).
 */
import { SAMPLE_TILE_MASTER_SIZE } from './sample-tile';

export type TileDerivative = {
	readonly id: 'xs' | 's' | 'm';
	readonly edge: number;
	/** The fraction of the master's edge the derivative shows, centred. */
	readonly crop: number;
};

export const TILE_DERIVATIVES: readonly TileDerivative[] = [
	{ id: 'xs', edge: 64, crop: 0.625 },
	{ id: 's', edge: 112, crop: 1 },
	{ id: 'm', edge: SAMPLE_TILE_MASTER_SIZE, crop: 1 }
];

const MAX_DEVICE_PIXEL_RATIO = 3;

/** The derivative that covers `cssPx` at `devicePixelRatio`. */
export function tileDerivativeFor(cssPx: number, devicePixelRatio: number): TileDerivative {
	const ratio = Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1));
	const need = Math.ceil((Number.isFinite(cssPx) && cssPx > 0 ? cssPx : 0) * ratio);
	return TILE_DERIVATIVES.find((derivative) => derivative.edge >= need) ?? TILE_DERIVATIVES[TILE_DERIVATIVES.length - 1]!;
}

/** The source rectangle `[x, y, width, height]` of a derivative within a master. */
export function tileCropRect(
	masterEdge: number,
	derivative: TileDerivative
): readonly [number, number, number, number] {
	const size = Math.round(masterEdge * derivative.crop);
	const offset = Math.floor((masterEdge - size) / 2);
	return [offset, offset, size, size];
}

/**
 * Draw one derivative of a decoded master onto a canvas and encode it as PNG.
 * `null` when the environment has no canvas or the encode fails; the caller
 * shows the colour swatch.
 */
export async function deriveTile(
	master: ImageBitmap,
	derivative: TileDerivative
): Promise<Blob | null> {
	if (typeof OffscreenCanvas === 'undefined') return null;
	const [sx, sy, sw, sh] = tileCropRect(master.width, derivative);
	const canvas = new OffscreenCanvas(derivative.edge, derivative.edge);
	const context = canvas.getContext('2d');
	if (context === null) return null;
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = 'high';
	context.drawImage(master, sx, sy, sw, sh, 0, 0, derivative.edge, derivative.edge);
	try {
		return await canvas.convertToBlob({ type: 'image/png' });
	} catch {
		return null;
	}
}
