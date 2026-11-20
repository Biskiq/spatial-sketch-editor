/**
 * PR 1 A/B/C performance evidence on a matched S0-style gallery.
 *
 * A is the shipped native WebGL path (`WebGLRenderer`), B is the r187 common
 * renderer on observed native WebGPU and C is the same renderer forced to its
 * WebGL2 backend. All three build the same 12 × 7 m interior with six textured
 * wall quads, the same camera, 1280 × 720 at DPR 1, and the same light rig.
 *
 * Reported instant intervals are the time between animation-frame callbacks —
 * a presentation opportunity proxy, never physical scanout. Synchronized
 * numbers include a GPU wait or readback and are labelled diagnostics of cost,
 * not displayed frame times.
 */
import * as Legacy from 'three';
import {
	AmbientLight,
	BoxGeometry,
	Color,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
	NoToneMapping,
	PCFShadowMap,
	PerspectiveCamera,
	PlaneGeometry,
	RenderTarget,
	SRGBColorSpace,
	Scene,
	TextureLoader,
	WebGPURenderer,
	type Texture
} from 'three/webgpu';

export type PerfMode = 'A-native-webgl' | 'B-webgpu' | 'C-forced-webgl2';

export type WindowStats = {
	readonly frames: number;
	readonly intervalP50: number;
	readonly intervalP95: number;
	readonly intervalP99: number;
	readonly intervalMax: number;
	readonly missesOver2T: number;
	readonly synchronizedP50: number | null;
};

export type PerfRow = {
	readonly mode: PerfMode;
	readonly observed: 'webgl' | 'webgpu' | 'webgl2';
	readonly displayPeriodMs: number;
	readonly startup: {
		readonly initP50: number;
		readonly initP90: number;
		readonly initMax: number;
		/** Time until `renderer.render()` returned; no pixel or presentation proof. */
		readonly firstDrawSubmittedP50: number;
		readonly firstDrawSubmittedP90: number;
		readonly firstDrawSubmittedMax: number;
		/** Time until the canvas copy first showed a gallery, after any backend wait. */
		readonly firstVerifiedFrameP50: number;
		readonly firstVerifiedFrameP90: number;
		readonly firstVerifiedFrameMax: number;
		readonly samples: number;
	};
	readonly steady: WindowStats[];
	readonly shadow: {
		readonly callsWithShadow: number;
		readonly callsWithoutShadow: number;
		readonly trianglesWithShadow: number;
		readonly trianglesWithoutShadow: number;
		readonly firstShadowedFrameMs: number;
	};
	readonly lightVariant: {
		readonly firstFrameMs: number;
		readonly warmRepeatMs: number;
	};
	readonly notes: string[];
};

const WIDTH = 1280;
const HEIGHT = 720;
const DISPLAY_TARGET_MS = 1000 / 60;

function percentile(values: readonly number[], fraction: number): number {
	if (values.length === 0) return Number.NaN;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
	return sorted[Math.max(0, index)]!;
}

const GALLERY_TEXTURE_URL = '/textures/plaster-warm/map.png';

export type GalleryTextureEvidence = {
	readonly path: string;
	readonly url: string;
	readonly bytes: number;
	readonly digest: string;
};

/** The fixture's actual bytes, hashed in the browser against the pinned manifest. */
async function galleryTextureEvidence(): Promise<GalleryTextureEvidence> {
	const response = await fetch(GALLERY_TEXTURE_URL, { cache: 'no-store' });
	if (!response.ok) {
		throw new Error(`Gallery texture ${GALLERY_TEXTURE_URL} returned HTTP ${response.status}`);
	}
	const bytes = new Uint8Array(await response.arrayBuffer());
	const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
	const hex = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
	return {
		path: 'apps/editor/static/textures/plaster-warm/map.png',
		url: GALLERY_TEXTURE_URL,
		bytes: bytes.byteLength,
		digest: `sha256-${hex}`
	};
}

async function loadLegacyGalleryTexture(): Promise<Legacy.Texture> {
	const texture = await new Legacy.TextureLoader().loadAsync(GALLERY_TEXTURE_URL);
	texture.colorSpace = Legacy.SRGBColorSpace;
	texture.needsUpdate = true;
	return texture;
}

async function loadCommonGalleryTexture(): Promise<Texture> {
	const texture = await new TextureLoader().loadAsync(GALLERY_TEXTURE_URL);
	texture.colorSpace = SRGBColorSpace;
	texture.needsUpdate = true;
	return texture;
}

type SceneKit = {
	readonly scene: Scene | Legacy.Scene;
	readonly camera: PerspectiveCamera | Legacy.PerspectiveCamera;
	readonly lights: Array<unknown>;
};

function legacyGallery(texture: Legacy.Texture): SceneKit {
	const scene = new Legacy.Scene();
	scene.background = new Legacy.Color('#e9ebe6');
	const camera = new Legacy.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100);
	camera.position.set(0, 1.6, -1.2);
	camera.lookAt(0, 1.4, 3.5);
	const wall = new Legacy.MeshStandardMaterial({ color: '#d8d4c8', roughness: 0.85 });
	const wallGeometry = new Legacy.BoxGeometry(12, 3, 0.12);
	const far = new Legacy.Mesh(wallGeometry, wall);
	far.position.set(0, 1.5, 3.5);
	const near = new Legacy.Mesh(wallGeometry, wall);
	near.position.set(0, 1.5, -3.5);
	const sideGeometry = new Legacy.BoxGeometry(0.12, 3, 7);
	const left = new Legacy.Mesh(sideGeometry, wall);
	left.position.set(-6, 1.5, 0);
	const right = new Legacy.Mesh(sideGeometry, wall);
	right.position.set(6, 1.5, 0);
	const floor = new Legacy.Mesh(
		new Legacy.PlaneGeometry(12, 7),
		new Legacy.MeshStandardMaterial({ color: '#bdb7a9', roughness: 0.9 })
	);
	floor.rotation.x = -Math.PI / 2;
	floor.receiveShadow = true;
	far.receiveShadow = true;
	left.receiveShadow = true;
	right.receiveShadow = true;
	scene.add(far, near, left, right, floor);
	for (let index = 0; index < 6; index += 1) {
		const quad = new Legacy.Mesh(
			new Legacy.PlaneGeometry(1.2, 0.9),
			new Legacy.MeshStandardMaterial({ map: texture, roughness: 0.6 })
		);
		quad.position.set(-3.3 + index * 1.32, 1.7, 3.38);
		quad.castShadow = true;
		scene.add(quad);
	}
	const sun = new Legacy.DirectionalLight(0xffffff, 2.2);
	sun.position.set(4, 5, 2);
	sun.castShadow = true;
	sun.target.position.set(0, 0, 0);
	scene.add(sun, sun.target, new Legacy.AmbientLight(0xffffff, 0.35));
	return { scene, camera, lights: [sun] };
}

function commonGallery(texture: Texture): SceneKit {
	const scene = new Scene();
	scene.background = new Color('#e9ebe6');
	const camera = new PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100);
	camera.position.set(0, 1.6, -1.2);
	camera.lookAt(0, 1.4, 3.5);
	const wall = new MeshStandardMaterial({ color: '#d8d4c8', roughness: 0.85 });
	const wallGeometry = new BoxGeometry(12, 3, 0.12);
	const far = new Mesh(wallGeometry, wall);
	far.position.set(0, 1.5, 3.5);
	const near = new Mesh(wallGeometry, wall);
	near.position.set(0, 1.5, -3.5);
	const sideGeometry = new BoxGeometry(0.12, 3, 7);
	const left = new Mesh(sideGeometry, wall);
	left.position.set(-6, 1.5, 0);
	const right = new Mesh(sideGeometry, wall);
	right.position.set(6, 1.5, 0);
	const floor = new Mesh(
		new PlaneGeometry(12, 7),
		new MeshStandardMaterial({ color: '#bdb7a9', roughness: 0.9 })
	);
	floor.rotation.x = -Math.PI / 2;
	floor.receiveShadow = true;
	far.receiveShadow = true;
	left.receiveShadow = true;
	right.receiveShadow = true;
	scene.add(far, near, left, right, floor);
	for (let index = 0; index < 6; index += 1) {
		const quad = new Mesh(new PlaneGeometry(1.2, 0.9), new MeshStandardMaterial({ map: texture, roughness: 0.6 }));
		quad.position.set(-3.3 + index * 1.32, 1.7, 3.38);
		quad.castShadow = true;
		scene.add(quad);
	}
	const sun = new DirectionalLight(0xffffff, 2.2);
	sun.position.set(4, 5, 2);
	sun.castShadow = true;
	sun.target.position.set(0, 0, 0);
	scene.add(sun, sun.target, new AmbientLight(0xffffff, 0.35));
	return { scene, camera, lights: [sun] };
}

function disposeKit(kit: SceneKit): void {
	const source = kit.scene as unknown as { traverse(callback: (object: unknown) => void): void };
	source.traverse((object) => {
		const mesh = object as {
			geometry?: { dispose(): void };
			material?: { dispose(): void } | Array<{ dispose(): void }>;
		};
		mesh.geometry?.dispose();
		const material = mesh.material;
		if (Array.isArray(material)) for (const entry of material) entry.dispose();
		else material?.dispose();
	});
}

type RendererAdapter = {
	readonly mode: PerfMode;
	readonly observed: 'webgl' | 'webgpu' | 'webgl2';
	readonly canvas: HTMLCanvasElement;
	readonly initMs: number;
	render(scene: unknown, camera: unknown): void;
	readSynchronized(): Promise<number>;
	setShadows(enabled: boolean): void;
	resetFrameInfo(): void;
	drawInfo(): { calls: number; triangles: number };
	dispose(): Promise<void>;
};

async function createNativeWebGL(): Promise<RendererAdapter> {
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	document.body.append(canvas);
	const start = performance.now();
	const renderer = new Legacy.WebGLRenderer({
		canvas,
		antialias: true,
		alpha: true,
		stencil: true,
		preserveDrawingBuffer: true,
		powerPreference: 'high-performance'
	});
	renderer.setPixelRatio(1);
	renderer.setSize(WIDTH, HEIGHT, false);
	renderer.outputColorSpace = Legacy.SRGBColorSpace;
	renderer.toneMapping = NoToneMapping;
	renderer.toneMappingExposure = 1;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFShadowMap;
	renderer.info.autoReset = false;
	return {
		mode: 'A-native-webgl',
		observed: 'webgl',
		canvas,
		initMs: performance.now() - start,
		render(scene, camera) {
			renderer.render(scene as Legacy.Scene, camera as Legacy.Camera);
		},
		async readSynchronized() {
			const start = performance.now();
			// A 1-pixel read forces the GL command stream to complete; finish()
			// alone is effectively free in Chrome and would hide CPU submit cost.
			const gl = renderer.getContext();
			gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
			gl.finish();
			return performance.now() - start;
		},
		setShadows(enabled) {
			renderer.shadowMap.enabled = enabled;
		},
		resetFrameInfo() {
			renderer.info.reset();
		},
		drawInfo() {
			return {
				calls: renderer.info.render.calls,
				triangles: renderer.info.render.triangles
			};
		},
		async dispose() {
			renderer.dispose();
			canvas.remove();
		}
	};
}

async function createCommonRenderer(forceWebGL: boolean): Promise<RendererAdapter> {
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	document.body.append(canvas);
	const start = performance.now();
	const renderer = new WebGPURenderer({
		canvas,
		antialias: true,
		alpha: true,
		stencil: true,
		powerPreference: 'high-performance',
		forceWebGL
	});
	renderer.setPixelRatio(1);
	renderer.setSize(WIDTH, HEIGHT, false);
	await renderer.init();
	const initMs = performance.now() - start;
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = NoToneMapping;
	renderer.toneMappingExposure = 1;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFShadowMap;
	renderer.info.autoReset = false;
	const backend = (renderer as unknown as {
		isWebGPUBackend?: boolean;
		device?: { queue?: { onSubmittedWorkDone(): Promise<void> } };
		getContext?(): WebGL2RenderingContext | null;
	}).backend;
	const observed = backend.isWebGPUBackend === true ? 'webgpu' : 'webgl2';
	const gl = observed === 'webgl2' ? (backend.getContext?.() ?? null) : null;
	return {
		mode: forceWebGL ? 'C-forced-webgl2' : 'B-webgpu',
		observed,
		canvas,
		initMs,
		render(scene, camera) {
			renderer.render(scene as Scene, camera as PerspectiveCamera);
		},
		async readSynchronized() {
			const start = performance.now();
			if (gl !== null) {
				gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
			} else {
				await backend.device?.queue?.onSubmittedWorkDone();
			}
			return performance.now() - start;
		},
		setShadows(enabled) {
			renderer.shadowMap.enabled = enabled;
		},
		resetFrameInfo() {
			renderer.info.reset();
		},
		drawInfo() {
			return {
				calls: renderer.info.render.drawCalls,
				triangles: renderer.info.render.triangles
			};
		},
		async dispose() {
			await renderer.dispose();
			canvas.remove();
		}
	};
}

async function idlePeriod(): Promise<number> {
	const samples: number[] = [];
	let last = performance.now();
	await new Promise<void>((resolve) => {
		let count = 0;
		const tick = (now: number): void => {
			samples.push(now - last);
			last = now;
			count += 1;
			if (count >= 30) resolve();
			else requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	return percentile(samples.slice(5), 0.5);
}

function frameStats(canvas: HTMLCanvasElement): { distinct: number; centre: number[] } {
	const copy = document.createElement('canvas');
	copy.width = canvas.width;
	copy.height = canvas.height;
	const context = copy.getContext('2d', { willReadFrequently: true });
	if (context === null) return { distinct: 0, centre: [0, 0, 0] };
	context.drawImage(canvas, 0, 0);
	const data = context.getImageData(0, 0, copy.width, copy.height).data;
	let distinct = 0;
	let previous = -1;
	for (let index = 0; index < data.length; index += 4 * 4096) {
		const value = (data[index]! << 16) | (data[index + 1]! << 8) | data[index + 2]!;
		if (value !== previous) distinct += 1;
		previous = value;
	}
	const centreIndex = (Math.floor(copy.height / 2) * copy.width + Math.floor(copy.width / 2)) * 4;
	return {
		distinct,
		centre: [data[centreIndex]!, data[centreIndex + 1]!, data[centreIndex + 2]!]
	};
}

async function steadyWindows(adapter: RendererAdapter, kit: SceneKit, windows = 3): Promise<WindowStats[]> {
	const results: WindowStats[] = [];
	const durations = 10_000;
	for (let windowIndex = 0; windowIndex < windows; windowIndex += 1) {
		const intervals: number[] = [];
		const synchronized: number[] = [];
		let frames = 0;
		let last = performance.now();
		const start = last;
		let stop = false;
		await new Promise<void>((resolve) => {
			const tick = (now: number): void => {
				intervals.push(now - last);
				last = now;
				const elapsed = now - start;
				const angle = elapsed / 4200;
				const camera = kit.camera as unknown as { position: { x: number; y: number }; lookAt(x: number, y: number, z: number): void };
				camera.position.x = Math.sin(angle) * 2.4;
				camera.position.y = 1.6 + Math.sin(angle * 0.7) * 0.25;
				camera.lookAt(0, 1.4, 3.5);
				adapter.render(kit.scene, kit.camera);
				frames += 1;
				if (frames % 30 === 0) {
					void adapter.readSynchronized().then((ms) => synchronized.push(ms));
				}
				if (stop || elapsed >= durations) resolve();
				else requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
			setTimeout(() => {
				stop = true;
			}, durations + 2000);
		});
		const trimmed = intervals.slice(3);
		const period = percentile(trimmed, 0.5);
		results.push({
			frames,
			intervalP50: period,
			intervalP95: percentile(trimmed, 0.95),
			intervalP99: percentile(trimmed, 0.99),
			intervalMax: Math.max(...trimmed),
			missesOver2T: trimmed.filter((value) => value > 2 * DISPLAY_TARGET_MS).length,
			synchronizedP50: synchronized.length === 0 ? null : percentile(synchronized, 0.5)
		});
	}
	return results;
}

async function startupSamples(adapterFactory: () => Promise<RendererAdapter>, kit: () => SceneKit): Promise<{
	init: number[];
	submitted: number[];
	verified: number[];
}> {
	const init: number[] = [];
	const submitted: number[] = [];
	const verified: number[] = [];
	for (let run = 0; run < 10; run += 1) {
		const start = performance.now();
		const adapter = await adapterFactory();
		init.push(adapter.initMs);
		const sceneKit = kit();
		adapter.render(sceneKit.scene, sceneKit.camera);
		// A submitted draw is not a presented frame: this only proves the render
		// call returned. The verified boundary below separately proves the canvas
		// copy contained a gallery, including any backend wait it needed.
		const submittedAt = performance.now();
		// The canvas is read before a cross-task presentation can replace it:
		// r187's WebGPU canvas has no preserveDrawingBuffer, and headless Chrome
		// may present between awaits.
		const immediate = frameStats(adapter.canvas);
		const immediateAt = performance.now();
		await adapter.readSynchronized();
		const afterWait = frameStats(adapter.canvas);
		const afterWaitAt = performance.now();
		const verifiedAt = immediate.distinct > 2 ? immediateAt : afterWait.distinct > 2 ? afterWaitAt : null;
		if (verifiedAt === null) {
			throw new Error(
				`${adapter.mode}: first frame did not show a gallery (immediate ${JSON.stringify(immediate)}, after ${JSON.stringify(afterWait)})`
			);
		}
		submitted.push(submittedAt - start);
		verified.push(verifiedAt - start);
		disposeKit(sceneKit);
		await adapter.dispose();
	}
	return { init, submitted, verified };
}

export type PerformanceReport = {
	readonly displayPeriodMs: number;
	readonly fixture: {
		readonly galleryTexture: GalleryTextureEvidence;
		readonly geometry: string;
	};
	readonly rows: PerfRow[];
	readonly limitations: string[];
};

export async function runPerformance(): Promise<PerformanceReport> {
	const period = await idlePeriod();
	const galleryTexture = await galleryTextureEvidence();
	const limitations: string[] = [];

	const create = (mode: PerfMode): (() => Promise<RendererAdapter>) => {
		if (mode === 'A-native-webgl') return createNativeWebGL;
		return () => createCommonRenderer(mode === 'C-forced-webgl2');
	};
	const rows: PerfRow[] = [];

	for (const mode of ['A-native-webgl', 'B-webgpu', 'C-forced-webgl2'] as const) {
		const adapter = await create(mode)();
		const observed = adapter.observed;
		let kitFor: () => SceneKit;
		let disposeTexture: () => void;
		if (mode === 'A-native-webgl') {
			const texture = await loadLegacyGalleryTexture();
			kitFor = () => legacyGallery(texture);
			disposeTexture = () => texture.dispose();
		} else {
			const texture = await loadCommonGalleryTexture();
			kitFor = () => commonGallery(texture);
			disposeTexture = () => texture.dispose();
		}
		const startup = await startupSamples(create(mode), kitFor);
		const kit = kitFor();

		// Warm the pipeline before steady measurement.
		for (let warm = 0; warm < 10; warm += 1) adapter.render(kit.scene, kit.camera);
		await adapter.readSynchronized();
		const steady = await steadyWindows(adapter, kit);

		// Shadow cost on the same gallery: one Sun above the six quads.
		adapter.setShadows(true);
		adapter.resetFrameInfo();
		const shadowStart = performance.now();
		adapter.render(kit.scene, kit.camera);
		await adapter.readSynchronized();
		const firstShadowedFrameMs = performance.now() - shadowStart;
		const withShadow = adapter.drawInfo();
		adapter.setShadows(false);
		adapter.resetFrameInfo();
		adapter.render(kit.scene, kit.camera);
		const withoutShadow = adapter.drawInfo();
		adapter.setShadows(true);

		// A fifth light: the plan's light-variant stall probe.
		const extra =
			mode === 'A-native-webgl'
				? new Legacy.DirectionalLight(0xffffff, 0.6)
				: new DirectionalLight(0xffffff, 0.6);
		extra.position.set(-3, 3, -2);
		(kit.scene as unknown as { add(object: unknown): void }).add(extra);
		const lightStart = performance.now();
		adapter.render(kit.scene, kit.camera);
		await adapter.readSynchronized();
		const firstFrameMs = performance.now() - lightStart;
		const warmStart = performance.now();
		adapter.render(kit.scene, kit.camera);
		await adapter.readSynchronized();
		const warmRepeatMs = performance.now() - warmStart;
		(kit.scene as unknown as { remove(object: unknown): void }).remove(extra);

		rows.push({
			mode,
			observed,
			displayPeriodMs: period,
			startup: {
				initP50: percentile(startup.init, 0.5),
				initP90: percentile(startup.init, 0.9),
				initMax: Math.max(...startup.init),
				firstDrawSubmittedP50: percentile(startup.submitted, 0.5),
				firstDrawSubmittedP90: percentile(startup.submitted, 0.9),
				firstDrawSubmittedMax: Math.max(...startup.submitted),
				firstVerifiedFrameP50: percentile(startup.verified, 0.5),
				firstVerifiedFrameP90: percentile(startup.verified, 0.9),
				firstVerifiedFrameMax: Math.max(...startup.verified),
				samples: startup.verified.length
			},
			steady,
			shadow: {
				callsWithShadow: withShadow.calls,
				callsWithoutShadow: withoutShadow.calls,
				trianglesWithShadow: withShadow.triangles,
				trianglesWithoutShadow: withoutShadow.triangles,
				firstShadowedFrameMs
			},
			lightVariant: { firstFrameMs, warmRepeatMs },
			notes:
				observed === 'webgpu'
					? ['Native WebGPU observed from the initialized renderer.']
					: observed === 'webgl2'
						? ['Forced WebGL2 backend observed from the initialized renderer.']
						: ['Native WebGL baseline (shipped path).']
		});

		disposeKit(kit);
		disposeTexture();
		await adapter.dispose();
	}

	limitations.push(
		'First draw submitted is time until renderer.render() returned; it proves no pixels and no presentation.',
		'First verified frame is time until the canvas copy first contained a gallery, including any GPU wait/readback; it is an upper bound, not physical presentation.',
		'Animation-frame intervals are a presentation-opportunity proxy, not physical scanout; headless Chromium keeps its own cadence.',
		'Synchronized columns include a GPU wait/readback and are cost diagnostics, not displayed frame times.',
		'This run measured one host only. The Intel Iris Xe-class laptop, Safari and Firefox rows remain unverified.'
	);
	return {
		displayPeriodMs: period,
		fixture: {
			galleryTexture,
			geometry: '12 × 7 m interior, six 1.2 × 0.9 m textured quads, one shadowed Sun, camera (0,1.6,−1.2) → (0,1.4,3.5), 50° FOV'
		},
		rows,
		limitations
	};
}
