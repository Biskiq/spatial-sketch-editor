/**
 * Dev-only linear readback for the PR B gates.
 *
 * Draws a scene into a half-float linear target with a transparent clear and no
 * scene background (alpha marks covered pixels, radiance above 1 survives) and
 * returns top-first float RGBA. WebGL2 reads bottom-up and WebGPU top-down, the
 * same row rule as the production inspection readback. Every renderer and scene
 * mutation is restored.
 */
import {
	Color,
	HalfFloatType,
	LinearSRGBColorSpace,
	RenderTarget,
	type Camera,
	type Scene
} from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import type { LinearFrame } from '$lib/dev/s8-fidelity-metrics';

export function halfToFloat(bits: number): number {
	const sign = bits & 0x8000 ? -1 : 1;
	const exponent = (bits >> 10) & 0x1f;
	const fraction = bits & 0x3ff;
	if (exponent === 0) return sign * fraction * 2 ** -24;
	if (exponent === 31) return fraction === 0 ? sign * Infinity : Number.NaN;
	return sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
}

export async function renderLinearFrame(
	renderer: WebGPURenderer,
	scene: Scene,
	camera: Camera,
	size: number,
	backend: 'webgl2' | 'webgpu' | string
): Promise<LinearFrame> {
	const target = new RenderTarget(size, size, {
		type: HalfFloatType,
		colorSpace: LinearSRGBColorSpace,
		samples: 0,
		depthBuffer: true
	});
	const r = renderer as unknown as {
		getRenderTarget(): unknown;
		setRenderTarget(value: unknown): void;
		getClearColor(value: Color): Color;
		getClearAlpha(): number;
		setClearColor(value: Color | string, alpha: number): void;
		clear(): void;
		render(scene: Scene, camera: Camera): void;
		readRenderTargetPixelsAsync(
			target: RenderTarget,
			x: number,
			y: number,
			w: number,
			h: number
		): Promise<ArrayLike<number>>;
	};
	const previousTarget = r.getRenderTarget();
	const previousColor = r.getClearColor(new Color());
	const previousAlpha = r.getClearAlpha();
	const previousBackground = scene.background;
	try {
		scene.background = null;
		r.setRenderTarget(target);
		r.setClearColor('#000000', 0);
		r.clear();
		r.render(scene, camera);
		const raw = await r.readRenderTargetPixelsAsync(target, 0, 0, size, size);
		const pixels = new Float32Array(size * size * 4);
		const isHalf = raw instanceof Uint16Array;
		const rowFloats = size * 4;
		for (let y = 0; y < size; y += 1) {
			const sourceRow = backend === 'webgpu' ? y : size - 1 - y;
			for (let x = 0; x < rowFloats; x += 1) {
				const value = raw[sourceRow * rowFloats + x]!;
				pixels[y * rowFloats + x] = isHalf ? halfToFloat(value) : Number(value);
			}
		}
		return { pixels, width: size, height: size };
	} finally {
		scene.background = previousBackground;
		r.setRenderTarget(previousTarget);
		r.setClearColor(previousColor, previousAlpha);
		target.dispose();
	}
}
