/**
 * Shared plumbing for the PR 1 r187 API qualification harness.
 *
 * Browser-only and isolated from product imports. It records actual backends
 * from the initialized renderer, reads offscreen targets with the common async
 * API, and captures the presented canvas through a 2D context so the sRGB
 * output path is measured rather than inferred.
 */
import {
	Color,
	NoToneMapping,
	PCFShadowMap,
	RenderTarget,
	SRGBColorSpace,
	UnsignedByteType,
	WebGLCoordinateSystem,
	WebGPUCoordinateSystem,
	type Camera,
	type Scene
} from 'three/webgpu';
import { WebGPURenderer } from 'three/webgpu';

export type Backend = 'webgpu' | 'webgl2';

export type Assertion = {
	readonly name: string;
	readonly ok: boolean;
	readonly detail?: string;
};

export type ScenarioResult = {
	readonly id: string;
	readonly title: string;
	readonly status: 'pass' | 'fail' | 'blocked';
	readonly backend?: string;
	readonly assertions: Assertion[];
	readonly measurements: Record<string, unknown>;
	readonly error?: string;
	readonly screenshot?: string;
};

export function assertion(name: string, ok: boolean, detail?: unknown): Assertion {
	return { name, ok, detail: detail === undefined ? undefined : String(detail) };
}

export type Outcome = {
	readonly backend?: string;
	readonly assertions: Assertion[];
	readonly measurements?: Record<string, unknown>;
};

export type ScenarioEntry = {
	readonly id: string;
	readonly title: string;
	readonly run: () => Promise<Outcome>;
};

export function scenario(id: string, title: string, run: () => Promise<Outcome>): ScenarioEntry {
	return { id, title, run };
}

export function blocked(entry: { id: string; title: string }, error: unknown): ScenarioResult {
	return {
		id: entry.id,
		title: entry.title,
		status: 'blocked',
		assertions: [],
		measurements: {},
		error: error instanceof Error ? `${error.name}: ${error.message}` : String(error)
	};
}

export function backendOf(renderer: WebGPURenderer): Backend {
	const backend = (renderer as unknown as { backend: { isWebGPUBackend?: boolean } }).backend;
	return backend.isWebGPUBackend === true ? 'webgpu' : 'webgl2';
}

export function coordinateSystemOf(renderer: WebGPURenderer): 'webgpu' | 'webgl' | 'unknown' {
	if (renderer.coordinateSystem === WebGPUCoordinateSystem) return 'webgpu';
	if (renderer.coordinateSystem === WebGLCoordinateSystem) return 'webgl';
	return 'unknown';
}

export type CreatedRenderer = {
	readonly renderer: WebGPURenderer;
	readonly canvas: HTMLCanvasElement;
	readonly backend: Backend;
	readonly coordinateSystem: string;
	readonly initMs: number;
};

export async function createWebgpuRenderer(options: {
	readonly width: number;
	readonly height: number;
	readonly dpr?: number;
	readonly forceWebGL?: boolean;
	readonly stencil?: boolean;
	readonly antialias?: boolean;
	readonly append?: boolean;
}): Promise<CreatedRenderer> {
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(options.width * (options.dpr ?? 1));
	canvas.height = Math.round(options.height * (options.dpr ?? 1));
	canvas.style.width = `${options.width}px`;
	canvas.style.height = `${options.height}px`;
	if (options.append !== false) document.body.append(canvas);
	const renderer = new WebGPURenderer({
		canvas,
		antialias: options.antialias ?? true,
		alpha: true,
		stencil: options.stencil ?? true,
		powerPreference: 'high-performance',
		forceWebGL: options.forceWebGL ?? false
	});
	renderer.setPixelRatio(options.dpr ?? 1);
	renderer.setSize(options.width, options.height, false);
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = NoToneMapping;
	renderer.toneMappingExposure = 1;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFShadowMap;
	const start = performance.now();
	await renderer.init();
	const initMs = performance.now() - start;
	return {
		renderer,
		canvas,
		backend: backendOf(renderer),
		coordinateSystem: coordinateSystemOf(renderer),
		initMs
	};
}

export function target(width: number, height: number, options: { stencil?: boolean } = {}): RenderTarget {
	const renderTarget = new RenderTarget(width, height, {
		type: UnsignedByteType,
		stencilBuffer: options.stencil ?? false,
		depthBuffer: true
	});
	// Offscreen targets default to no colour space, so their bytes are linear.
	// Name sRGB explicitly: these probes compare against CSS colours.
	renderTarget.texture.colorSpace = SRGBColorSpace;
	return renderTarget;
}

export type RowOrder = 'top-down' | 'bottom-up';

/**
 * r187's native row order, measured by the `row-order` qualification scenario.
 *
 * WebGPU's async texture copy starts at the texture origin (top-left). The
 * WebGL2 backend's full-buffer `readPixels` starts at the bottom-left. This is
 * backend behavior, not a per-scene guess: a scene whose only signature is a
 * centred or horizontally symmetric shape still normalizes correctly.
 */
export function rowOrderForBackend(backend: Backend): RowOrder {
	if (backend === 'webgl2') return 'bottom-up';
	if (backend === 'webgpu') return 'top-down';
	throw new Error(`Unknown renderer backend ${String(backend)}; cannot normalize target rows`);
}

export type Readback = {
	readonly pixels: Uint8Array;
	readonly width: number;
	readonly height: number;
	/** Rows normalized to top-down, whatever the backend's native order was. */
	readonly topDown: Uint8Array;
	readonly rowOrder: RowOrder;
	/** Whether the caller's signature independently confirmed the backend order. */
	readonly signature: 'confirmed' | 'ambiguous';
	readonly bytes: number;
	readonly ms: number;
};

/**
 * Read a whole target through the r187 async copy API and normalize its rows.
 *
 * Normalization comes from the verified backend behavior, not a top-down
 * default. The caller's corner signature is a cross-check: if it matches one
 * orientation and that differs from the backend, this throws rather than
 * guessing. A signature that matches neither orientation is also an error. A
 * signature that matches both (a centred or symmetric probe) is recorded as
 * ambiguous but does not override the backend contract.
 */
export async function readTarget(
	renderer: WebGPURenderer,
	renderTarget: RenderTarget,
	width: number,
	height: number,
	corner: { readonly x: number; readonly y: number; readonly expected: readonly [number, number, number] }
): Promise<Readback> {
	const start = performance.now();
	const pixels = await renderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, width, height);
	const ms = performance.now() - start;
	const bytes = pixels.byteLength;
	const native = pixels instanceof Uint8Array ? pixels : new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
	const at = (x: number, y: number): number[] => {
		const index = (y * width + x) * 4;
		return Array.from(native.slice(index, index + 3));
	};
	const looksLikeCorner = (rgb: number[]): boolean =>
		Math.abs(rgb[0]! - corner.expected[0]) <= 4 &&
		Math.abs(rgb[1]! - corner.expected[1]) <= 4 &&
		Math.abs(rgb[2]! - corner.expected[2]) <= 4;
	const nativeTop = at(corner.x, corner.y);
	const nativeBottom = at(corner.x, height - 1 - corner.y);
	const topMatches = looksLikeCorner(nativeTop);
	const bottomMatches = looksLikeCorner(nativeBottom);
	const backend = backendOf(renderer);
	const rowOrder = rowOrderForBackend(backend);
	let signature: Readback['signature'];
	if (topMatches && bottomMatches) {
		signature = 'ambiguous';
	} else if (!topMatches && !bottomMatches) {
		throw new Error(
			`${backend}: row-order signature ${JSON.stringify(corner.expected)} matched neither y=${corner.y} nor y=${height - 1 - corner.y}; refusing to normalize an indeterminate target`
		);
	} else {
		const observed = topMatches ? 'top-down' : 'bottom-up';
		if (observed !== rowOrder) {
			throw new Error(
				`${backend}: signature indicates ${observed} rows but the backend contract is ${rowOrder}; refusing to guess`
			);
		}
		signature = 'confirmed';
	}
	const topDown = new Uint8Array(native.length);
	if (rowOrder === 'top-down') topDown.set(native);
	else {
		const rowBytes = width * 4;
		for (let row = 0; row < height; row += 1) {
			topDown.set(native.subarray((height - 1 - row) * rowBytes, (height - row) * rowBytes), row * rowBytes);
		}
	}
	return { pixels: native, width, height, topDown, rowOrder, signature, bytes, ms };
}

export function pixelAt(readback: Readback, x: number, y: number): [number, number, number, number] {
	const index = (y * readback.width + x) * 4;
	const source = readback.topDown;
	return [source[index]!, source[index + 1]!, source[index + 2]!, source[index + 3]!];
}

export function colourDistance(a: readonly number[], b: readonly number[]): number {
	return Math.max(Math.abs(a[0]! - b[0]!), Math.abs(a[1]! - b[1]!), Math.abs(a[2]! - b[2]!));
}

/** The presented canvas pixels, through a 2D context: the sRGB output path. */
export function canvasPixels(canvas: HTMLCanvasElement): ImageData {
	const copy = document.createElement('canvas');
	copy.width = canvas.width;
	copy.height = canvas.height;
	const context = copy.getContext('2d', { willReadFrequently: true });
	if (context === null) throw new Error('2D context unavailable for canvas readback');
	context.drawImage(canvas, 0, 0);
	return context.getImageData(0, 0, copy.width, copy.height);
}

export function presentedPixel(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
	const data = canvasPixels(canvas);
	const index = (Math.round(y) * data.width + Math.round(x)) * 4;
	return [data.data[index]!, data.data[index + 1]!, data.data[index + 2]!, data.data[index + 3]!];
}

export async function drain(renderer: WebGPURenderer): Promise<void> {
	const device = (renderer as unknown as { backend?: { device?: { queue?: { onSubmittedWorkDone(): Promise<void> } } } })
		.backend?.device;
	await device?.queue?.onSubmittedWorkDone();
}

export function clearTarget(renderer: WebGPURenderer, renderTarget: RenderTarget, colour = '#101820'): void {
	const previous = renderer.getRenderTarget();
	renderer.setRenderTarget(renderTarget);
	renderer.setClearColor(new Color(colour), 1);
	renderer.clear();
	renderer.setRenderTarget(previous);
}

export function disposeScene(scene: Scene): void {
	scene.traverse((object) => {
		const mesh = object as unknown as {
			geometry?: { dispose(): void };
			material?: { dispose(): void } | Array<{ dispose(): void }>;
		};
		mesh.geometry?.dispose();
		const material = mesh.material;
		if (Array.isArray(material)) for (const entry of material) entry.dispose();
		else material?.dispose();
	});
}

export function frame(): Promise<number> {
	return new Promise((resolve) => requestAnimationFrame(resolve));
}

export function renderOnce(renderer: WebGPURenderer, scene: Scene, camera: Camera, renderTarget: RenderTarget): void {
	const previous = renderer.getRenderTarget();
	renderer.setRenderTarget(renderTarget);
	renderer.render(scene, camera);
	renderer.setRenderTarget(previous);
}
