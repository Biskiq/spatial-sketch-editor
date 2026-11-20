/**
 * Convert a Stage capture frame from CSS top-left coordinates to the
 * renderer's bottom-origin viewport. `size` is the renderer's CSS size; the
 * backend applies the device-pixel ratio itself, so DPR never enters here.
 *
 * The frame is the already-evaluated capture box: this function only mirrors
 * the existing clamp, never a second authority for framing.
 */
export type StageFrameRect = {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
};

export type StageScissor = {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
};

export function stageFrameScissor(
	frame: StageFrameRect | null,
	size: { readonly x: number; readonly y: number }
): StageScissor | null {
	if (frame === null) return null;
	return {
		x: frame.left,
		y: Math.max(0, size.y - frame.top - frame.height),
		width: frame.width,
		height: frame.height
	};
}
