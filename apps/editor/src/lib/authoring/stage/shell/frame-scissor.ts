/**
 * Convert a Stage capture frame into the renderer's viewport/scissor rectangle.
 *
 * r187's common renderer uses a **top-left** rectangle on both backends: native
 * WebGPU is top-left by definition, and the WebGL2 backend converts Y internally.
 * The capture frame is already a CSS top-left box, so the conversion is a clamp,
 * never a mirror. `size` is the renderer's CSS size; the backend applies the
 * device-pixel ratio itself, so DPR never enters here.
 *
 * The frame is the already-evaluated capture box: this function only mirrors the
 * existing clamp, never a second authority for framing.
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
	size: { readonly x: number; readonly y: number },
): StageScissor | null {
	if (frame === null) return null;
	return {
		x: Math.max(0, frame.left),
		// Top-left origin on both backends: a frame above the surface clamps to 0,
		// and a frame that starts inside the surface keeps its own top.
		y: Math.max(0, Math.min(frame.top, Math.max(0, size.y - frame.height))),
		width: frame.width,
		height: frame.height,
	};
}
