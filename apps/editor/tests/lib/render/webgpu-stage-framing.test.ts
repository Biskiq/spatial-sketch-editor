/**
 * The Stage capture frame is an asymmetric CSS box measured from the top-left.
 * The shipped Stage applies it as a bottom-origin viewport/scissor; r187's
 * WebGL2 backend converts Y internally, while native WebGPU uses the top-left
 * render-pass rectangle. PR 1 freezes this conversion before the renderer swap.
 *
 * The real renderer's DPR 1/1.5 projection/scissor behaviour is measured in
 * `experiments/webgpu-migration` (see the PR 1 evidence), because jsdom cannot
 * present a GPU frame. This test holds the Stage-side contract that feeds it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { stageFrameScissor } from '$lib/authoring/stage/shell/frame-scissor';

const SIZE = { x: 1280, y: 720 };

describe('Stage asymmetric frame scissor', () => {
	it('converts the 16:10 capture frame from top-left CSS to bottom origin', () => {
		expect(stageFrameScissor({ left: 120, top: 90, width: 640, height: 400 }, SIZE)).toEqual({
			x: 120,
			y: 230,
			width: 640,
			height: 400
		});
	});

	it('preserves an asymmetric offset at a different surface size', () => {
		expect(stageFrameScissor({ left: 37, top: 13, width: 809, height: 501 }, { x: 1700, y: 950 })).toEqual({
			x: 37,
			y: 436,
			width: 809,
			height: 501
		});
	});

	it('clamps a frame that starts above the surface instead of going negative', () => {
		expect(stageFrameScissor({ left: 0, top: 700, width: 640, height: 400 }, SIZE)).toEqual({
			x: 0,
			y: 0,
			width: 640,
			height: 400
		});
	});

	it('does not apply a scissor when no capture frame is active', () => {
		expect(stageFrameScissor(null, SIZE)).toBeNull();
	});

	it('is DPR-independent: the backend scales the CSS values', () => {
		// The same CSS frame must produce the same scissor. Three multiplies by
		// the canvas pixel ratio after this boundary; the r187 harness verified
		// the resulting 300 × 180 buffer at DPR 1.5.
		const frame = { left: 20, top: 10, width: 80, height: 40 };
		expect(stageFrameScissor(frame, { x: 200, y: 120 })).toEqual({
			x: 20,
			y: 70,
			width: 80,
			height: 40
		});
	});

	it('keeps StageCamera on the extracted conversion', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'src/lib/authoring/stage/shell/StageCamera.svelte'),
			'utf8'
		);
		expect(source).toContain("import { stageFrameScissor } from './frame-scissor'");
		expect(source).toContain('stageFrameScissor(frameViewport, size)');
		expect(source).toContain('renderer.setScissorTest(true)');
		expect(source).toContain('renderer.setScissor(scissor.x, scissor.y, scissor.width, scissor.height)');
	});
});
