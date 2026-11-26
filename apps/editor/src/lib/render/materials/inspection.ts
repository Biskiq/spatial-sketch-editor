/**
 * The reusable inspection core (E7's rendering half).
 *
 * It supplies three things the product and the bench share:
 *
 * - **Channel readings.** `inspectionChannels` states, per role, whether the plan
 *  samples a view, which component/invert/convention it uses, or which constant
 *  the resolved surface falls back to. Provisional/missing siblings are visible
 *  rather than silently drawn.
 * - **One offscreen draw/readback.** `renderInspectionFrame` owns a bounded RGBA8
 *  target, restores every renderer mutation, and normalizes row orientation by
 *  the observed backend. Display encoding happens once, outside measurement.
 * - **Coalescing and generations.** `createInspectionObserver` allows one draw in
 *  flight; a newer request replaces the pending one, cancellation has no result,
 *  and a generation change is reported as `generation-lost` rather than as stale
 *  pixels.
 *
 * The fixed thumbnail is the same draw at 192×192 on the reference sphere under
 * studio light. Its key hashes the effective untreated recipe identity and every
 * version that can change pixels; only a successful `ready` result is cacheable.
 */
import {
	Color,
	Mesh,
	PerspectiveCamera,
	RenderTarget,
	Scene,
	UnsignedByteType,
	Vector3,
	type Material,
	type Texture,
	type WebGLRenderer,
} from 'three';
import { SRGBColorSpace } from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import {
	createViewportCameraState,
	evaluateViewport,
	inspectionPoseFromView,
} from '@portfolio/camera-core/viewport';
import { realizeEvaluatedCamera } from '$lib/render/camera-realization';
import { rendererBackendOf } from '$lib/render/renderer-backend';
import type {
	StandardFinishPlan,
	StandardMaterialDescriptor,
} from '$lib/render/resources/material-descriptor';
import type { FinishMapRole } from '$lib/render/resources/material-descriptor';
import {
	INSPECTION_GEOMETRY_VERSION,
	createInspectionGeometry,
	inspectionGeometryFacts,
	inspectionTargetFacts,
	type InspectionGeometryKind,
} from './inspection-geometry';
import {
	INSPECTION_LIGHTING_VERSION,
	createInspectionLighting,
	type InspectionRig,
} from './inspection-lighting';

export const INSPECTION_VERSION = 2 as const;
export const INSPECTION_THUMBNAIL_SIZE = 192;
export const INSPECTION_THUMBNAIL_BACKGROUND = '#555555';
export const INSPECTION_THUMBNAIL_EXPOSURE = 1;
export const INSPECTION_THUMBNAIL_PROFILE = 'srgb-8bit' as const;

export type InspectionRenderBackend = 'webgl2' | 'webgpu';

export type InspectionChannelState = {
	readonly role: FinishMapRole;
	readonly state: 'bound' | 'missing-view' | 'constant';
	readonly view?: string;
	readonly component?: 'r' | 'g' | 'b' | 'a';
	readonly invert?: boolean;
	readonly convention?: '+Y' | '-Y';
};

/**
 * Per-role channel readings from the plan and the acquired views.
 *
 * A role with a plan entry but no supplied view is `missing-view`, never
 * `constant`: the surface cannot draw that role, and a consumer must show the
 * labelled partial state instead of pretending the constant is the map.
 */
export function inspectionChannels(
	descriptor: StandardMaterialDescriptor,
	views: Readonly<Record<string, Texture>> | undefined,
): readonly InspectionChannelState[] {
	const plan: StandardFinishPlan | undefined = descriptor.finish;
	const roles: readonly FinishMapRole[] = [
		'color',
		'normal',
		'roughness',
		'metalness',
		'occlusion',
	];
	return roles.map((role) => {
		const entry = plan?.entries.find((candidate) => candidate.role === role);
		if (entry === undefined) return { role, state: 'constant' as const };
		if (views?.[entry.view] === undefined) {
			return { role, state: 'missing-view' as const, view: entry.view };
		}
		return {
			role,
			state: 'bound' as const,
			view: entry.view,
			...(entry.component === undefined ? {} : { component: entry.component }),
			...(entry.invert === undefined ? {} : { invert: entry.invert }),
			...(entry.convention === undefined ? {} : { convention: entry.convention }),
		};
	});
}

export type InspectionPose = {
	readonly eye: readonly [number, number, number];
	readonly target: readonly [number, number, number];
	readonly fovYDegrees: 35;
	readonly fit: 0.8;
};

/** The reference subjects' radii; the pose fits the bounding sphere to 80%. */
function subjectRadius(kind: InspectionGeometryKind): number {
	switch (kind) {
		case 'sphere':
			return 0.5;
		case 'plane':
			return Math.SQRT1_2;
		case 'block':
			return Math.sqrt(3) * 0.5;
	}
}

/**
 * The fixed evaluated pose. Sphere/block look from normalized (1,0.65,1.5);
 * the plane looks straight down +Z with +Y up. No camera state is persisted.
 *
 * `aspect` (width ÷ height) keeps the 80% fit on the **shorter** viewport
 * dimension for a non-square request; the square reference pose is unchanged.
 */
export function inspectionPose(kind: InspectionGeometryKind, aspect = 1): InspectionPose {
	const target: [number, number, number] = [0, 0, 0];
	const direction = kind === 'plane' ? new Vector3(0, 0, 1) : new Vector3(1, 0.65, 1.5).normalize();
	const fov = 35;
	const verticalHalf = (fov * Math.PI) / 360;
	const half =
		aspect >= 1 ? verticalHalf : Math.atan(Math.tan(verticalHalf) * Math.max(aspect, 1e-6));
	const distance = subjectRadius(kind) / (0.8 * Math.tan(half));
	const eye = direction.multiplyScalar(distance);
	return { eye: [eye.x, eye.y, eye.z], target, fovYDegrees: 35, fit: 0.8 };
}

/**
 * A camera at the fixed pose, evaluated by the Camera authority and realized for
 * the backend that will draw it. The depth range follows the subject, so a
 * narrow aspect's distant eye never clips it.
 */
export function createInspectionCamera(
	kind: InspectionGeometryKind,
	aspect: number,
	backend: InspectionRenderBackend,
): PerspectiveCamera {
	const { eye, target, fovYDegrees } = inspectionPose(kind, aspect);
	// Camera converts authored Views up to 1 km of extent, and a 1:2048 request needs
	// more: convert the square pose, then dolly it along the same direction.
	const square = inspectionPose(kind).eye;
	const view = inspectionPoseFromView({ eye: [...square], target: [...target], fovYDegrees })!;
	const state = createViewportCameraState({
		outputId: 'material-inspection',
		sessionEpoch: 'material-inspection',
		sourceRevision: `inspection@${INSPECTION_VERSION}`,
		reading: '3d',
		pose: {
			...view,
			targetPlaneHeightMeters:
				view.targetPlaneHeightMeters * (Math.hypot(...eye) / Math.hypot(...square)),
		},
		sceneRadiusMeters: 2 * subjectRadius(kind),
	});
	const result = evaluateViewport(
		state,
		{ left: 0, top: 0, width: aspect, height: 1, devicePixelRatio: 1 },
		0,
		1,
	);
	if (result.kind !== 'evaluated')
		throw new Error(`The inspection camera is unavailable: ${result.reason}`);
	const camera = new PerspectiveCamera(fovYDegrees, aspect);
	realizeEvaluatedCamera(camera, result.evaluation, backend);
	// The realized matrices draw; position and rotation only mirror them for readers.
	camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
	return camera;
}

export type InspectionFrame = {
	readonly pixels: Uint8Array;
	readonly width: number;
	readonly height: number;
	readonly backend: InspectionRenderBackend;
};

export type InspectionRenderer = WebGLRenderer | WebGPURenderer;

function backendOf(renderer: InspectionRenderer): InspectionRenderBackend {
	// `WebGPURenderer` is the product's constructor on both backends; its own
	// `isWebGPURenderer` flag stays true even when `forceWebGL` selected the
	// compatibility backend. Only the observed backend decides row order.
	return rendererBackendOf(renderer as WebGPURenderer);
}

/** Snapshot's row rule: WebGL reads bottom-up, WebGPU reads top-down. */
export function normalizeInspectionRows(
	pixels: ArrayLike<number>,
	width: number,
	height: number,
	backend: InspectionRenderBackend,
): Uint8Array {
	const source =
		pixels instanceof Uint8Array ? pixels : Uint8Array.from(pixels as ArrayLike<number>);
	if (backend === 'webgpu') return source;
	const rowBytes = width * 4;
	const flipped = new Uint8Array(source.length);
	for (let y = 0; y < height; y += 1) {
		flipped.set(
			source.subarray((height - 1 - y) * rowBytes, (height - y) * rowBytes),
			y * rowBytes,
		);
	}
	return flipped;
}

/** The promise's value, or null as soon as `signal` aborts. */
export function settledOrAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T | null> {
	if (signal === undefined) return promise;
	return new Promise<T | null>((resolve, reject) => {
		const abort = (): void => resolve(null);
		if (signal.aborted) abort();
		else signal.addEventListener('abort', abort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener('abort', abort);
				resolve(value);
			},
			(error: unknown) => {
				signal.removeEventListener('abort', abort);
				reject(error);
			},
		);
	});
}

/**
 * Draw one inspection frame into a bounded target and read it back.
 *
 * Every renderer mutation (target, clear colour, exposure, tone mapping) is
 * restored even when the draw or read throws. The target is always disposed; the
 * caller only owns the returned bytes.
 */
export async function renderInspectionFrame(input: {
	readonly renderer: InspectionRenderer;
	readonly scene: Scene;
	readonly camera: PerspectiveCamera;
	/** Square size; `width`/`height` override it for a non-square request. */
	readonly size: number;
	readonly width?: number;
	readonly height?: number;
	readonly background?: string;
	readonly exposure?: number;
	readonly signal?: AbortSignal;
}): Promise<InspectionFrame | null> {
	if (input.signal?.aborted) return null;
	const width = Math.max(1, Math.round(input.width ?? input.size));
	const height = Math.max(1, Math.round(input.height ?? input.size));
	const target = new RenderTarget(width, height, {
		type: UnsignedByteType,
		samples: 0,
		depthBuffer: true,
	});
	target.texture.colorSpace = SRGBColorSpace;
	// The two backends share this surface but disagree in their TypeScript
	// signatures (WebGL targets vs the common RenderTarget). A narrow local
	// `any` keeps one implementation without changing either renderer's types.
	const renderer = input.renderer as any;
	const previousTarget = renderer.getRenderTarget();
	const previousColor = renderer.getClearColor(new Color());
	const previousAlpha = renderer.getClearAlpha();
	const previousAutoClear = renderer.autoClear;
	const previousExposure = renderer.toneMappingExposure;
	let copy: Promise<ArrayLike<number>> | null = null;
	try {
		target.viewport.set(0, 0, width, height);
		target.scissor.set(0, 0, width, height);
		target.scissorTest = false;
		renderer.setRenderTarget(target);
		if (input.exposure !== undefined) renderer.toneMappingExposure = input.exposure;
		renderer.setClearColor(input.background ?? INSPECTION_THUMBNAIL_BACKGROUND, 1);
		renderer.autoClear = true;
		renderer.clear();
		renderer.render(input.scene, input.camera);
		copy = renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height) as Promise<
			ArrayLike<number>
		>;
	} catch {
		target.dispose();
		return null;
	} finally {
		renderer.setRenderTarget(previousTarget);
		renderer.setClearColor(previousColor, previousAlpha);
		renderer.autoClear = previousAutoClear;
		renderer.toneMappingExposure = previousExposure;
	}
	if (copy === null) {
		target.dispose();
		return null;
	}
	try {
		// The copy is submitted, so the target may go as soon as interest does: a
		// read that a lost device never settles cannot hold the render lane.
		const pixels = await settledOrAborted(copy, input.signal);
		if (pixels === null || input.signal?.aborted) return null;
		const backend = backendOf(renderer);
		return {
			pixels: normalizeInspectionRows(pixels, width, height, backend),
			width,
			height,
			backend,
		};
	} catch {
		return null;
	} finally {
		target.dispose();
	}
}

/** Build the sphere/studio/lit thumbnail scene for one descriptor and its views. */
export function createInspectionScene(input: {
	readonly renderer: InspectionRenderer;
	readonly material: Material;
	readonly kind?: InspectionGeometryKind;
	readonly rig?: InspectionRig;
	readonly radianceScale?: number;
}): {
	scene: Scene;
	camera: PerspectiveCamera;
	geometry: ReturnType<typeof createInspectionGeometry>['geometry'];
	lighting: ReturnType<typeof createInspectionLighting>;
	dispose(): void;
} {
	const kind = input.kind ?? 'sphere';
	const rig = input.rig ?? 'studio';
	const { geometry } = createInspectionGeometry(kind);
	const lighting = createInspectionLighting(rig, { radianceScale: input.radianceScale });
	const camera = createInspectionCamera(kind, 1, backendOf(input.renderer));
	const scene = new Scene();
	scene.background = new Color(INSPECTION_THUMBNAIL_BACKGROUND);
	scene.add(lighting.group);
	scene.add(new Mesh(geometry, input.material));
	const environment = lighting.environment(input.renderer);
	if (environment !== null) scene.environment = environment;
	return {
		scene,
		camera,
		geometry,
		lighting,
		dispose: () => {
			geometry.dispose();
			lighting.dispose();
		},
	};
}

export function stableHash(text: string): string {
	let a = 0x811c9dc5;
	for (let index = 0; index < text.length; index += 1) {
		a ^= text.charCodeAt(index);
		a = Math.imul(a, 0x01000193);
	}
	let b = 0x9e3779b1;
	for (let index = text.length - 1; index >= 0; index -= 1) {
		b ^= text.charCodeAt(index);
		b = Math.imul(b, 0x85ebca6b);
	}
	return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * The thumbnail key. It hashes the effective untreated recipe identity and
 * every pixel-affecting version — pose/presentation, lighting rig, geometry —
 * plus the **actual output dimensions** and geometry, never a display name or a
 * scope-private path. 192×192 sphere is the versioned reference derivative, not
 * a display requirement: any requested size and geometry has its own key.
 */
export function inspectionThumbnailKey(input: {
	readonly recipeKey: string;
	readonly geometry?: InspectionGeometryKind;
	readonly rig?: InspectionRig;
	readonly channel?: 'lit' | 'unlit-color' | FinishMapRole;
	readonly width?: number;
	readonly height?: number;
}): string {
	const width = Math.round(input.width ?? INSPECTION_THUMBNAIL_SIZE);
	const height = Math.round(input.height ?? input.width ?? INSPECTION_THUMBNAIL_SIZE);
	const text = [
		`inspection@${INSPECTION_VERSION}`,
		`lighting@${INSPECTION_LIGHTING_VERSION}`,
		`geometry@${INSPECTION_GEOMETRY_VERSION}`,
		input.recipeKey,
		input.geometry ?? 'sphere',
		input.rig ?? 'studio',
		input.channel ?? 'lit',
		`${width}x${height}`,
		INSPECTION_THUMBNAIL_BACKGROUND,
		`exposure=${INSPECTION_THUMBNAIL_EXPOSURE}`,
		INSPECTION_THUMBNAIL_PROFILE,
	].join('|');
	return `thumb-${stableHash(text)}`;
}

/** The target facts of one reference geometry, exported for binding a preview. */
export { inspectionGeometryFacts, inspectionTargetFacts };

/**
 * Encode RGBA8 pixels as PNG in the browser. Returns null where no canvas encoder
 * exists (the terminal tests exercise the pure key/readback half).
 */
export async function encodeInspectionPng(frame: InspectionFrame): Promise<Uint8Array | null> {
	if (typeof OffscreenCanvas === 'undefined') return null;
	const canvas = new OffscreenCanvas(frame.width, frame.height);
	const context = canvas.getContext('2d');
	if (context === null) return null;
	const image = new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height);
	context.putImageData(image, 0, 0);
	const blob = await canvas.convertToBlob({ type: 'image/png' });
	return new Uint8Array(await blob.arrayBuffer());
}

export type InspectionObservation =
	| { readonly status: 'ready'; readonly serial: number; readonly frame: InspectionFrame }
	| { readonly status: 'refused'; readonly serial: number }
	| { readonly status: 'cancelled'; readonly serial: number }
	| { readonly status: 'generation-lost'; readonly serial: number };

/**
 * One interactive inspection per editor.
 *
 * `request` coalesces: a second call during a draw marks the pending slot, and the
 * loop runs once more after the current result. `cancel` aborts the current draw
 * and drops the pending slot. A generation change is reported, not drawn over.
 */
export function createInspectionObserver(options: {
	readonly generation: () => number;
	readonly draw: (signal: AbortSignal, generation: number) => Promise<InspectionFrame | null>;
	readonly onResult: (result: InspectionObservation) => void;
}): { request(): void; cancel(): void; dispose(): void; readonly active: boolean } {
	let serial = 0;
	let running = false;
	let wanted = false;
	let disposed = false;
	let controller: AbortController | null = null;

	async function loop(): Promise<void> {
		if (running) return;
		running = true;
		try {
			while (wanted && !disposed) {
				wanted = false;
				// The serial was advanced when the request was submitted. A draw
				// that was already running is therefore superseded immediately:
				// its completion can never publish over the newer request.
				const current = serial;
				const startedGeneration = options.generation();
				const active = new AbortController();
				controller = active;
				let frame: InspectionFrame | null = null;
				try {
					frame = await options.draw(active.signal, startedGeneration);
				} catch {
					if (disposed) return;
					if (active.signal.aborted) {
						if (current === serial) options.onResult({ status: 'cancelled', serial: current });
						continue;
					}
					if (current === serial) options.onResult({ status: 'refused', serial: current });
					continue;
				}
				if (disposed) return;
				if (current !== serial) continue;
				if (active.signal.aborted) {
					options.onResult({ status: 'cancelled', serial: current });
					continue;
				}
				if (options.generation() !== startedGeneration) {
					options.onResult({ status: 'generation-lost', serial: current });
					continue;
				}
				if (frame === null) options.onResult({ status: 'refused', serial: current });
				else options.onResult({ status: 'ready', serial: current, frame });
			}
		} finally {
			controller = null;
			running = false;
		}
	}

	return {
		request() {
			if (disposed) return;
			// Submission is the replacement point: the new serial wins before the
			// current draw has a chance to publish. The active draw is aborted so
			// its work stops as soon as the consumer honours the signal.
			serial += 1;
			wanted = true;
			controller?.abort();
			void loop();
		},
		cancel() {
			wanted = false;
			controller?.abort();
		},
		dispose() {
			disposed = true;
			wanted = false;
			controller?.abort();
		},
		get active() {
			return running || wanted;
		},
	};
}
