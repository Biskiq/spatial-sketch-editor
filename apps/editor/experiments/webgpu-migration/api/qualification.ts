/**
 * The PR 1 API qualification scenarios.
 *
 * Every scenario runs on a real initialized Three r187 renderer — automatic
 * (native WebGPU) and forced WebGL2 — and records the observed backend from
 * `coordinateSystem`/the backend instance. Assertions are behavioural: a
 * rendered pixel, a readback row order, a draw-call delta, a shared texture
 * identity. They are not source-shape checks.
 */
import * as Legacy from 'three';
import {
	AmbientLight,
	AlwaysStencilFunc,
	BoxGeometry,
	Color,
	ColorManagement as GpuColourManagement,
	DataTexture,
	DirectionalLight,
	DoubleSide,
	EqualStencilFunc,
	KeepStencilOp,
	Mesh,
	MeshBasicNodeMaterial,
	MeshLambertNodeMaterial,
	MeshStandardNodeMaterial,
	OrthographicCamera,
	PerspectiveCamera,
	PlaneGeometry,
	PointLight,
	REVISION,
	RGBAFormat,
	ReplaceStencilOp,
	SRGBColorSpace,
	Scene,
	SpotLight,
	Texture,
	Vector3,
	Vector4,
	WebGPURenderer,
	type Light,
	type Material
} from 'three/webgpu';
import { float, texture as textureNode, uv, positionWorld } from 'three/tsl';
import { Line2 } from 'three/addons/lines/webgpu/Line2.js';
import { Line2NodeMaterial } from 'three/webgpu';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import {
	assertion,
	backendOf,
	blocked,
	canvasPixels,
	colourDistance,
	coordinateSystemOf,
	createWebgpuRenderer,
	disposeScene,
	drain,
	pixelAt,
	readTarget,
	scenario,
	target,
	type Assertion,
	type Backend,
	type Outcome,
	type ScenarioEntry,
	type ScenarioResult
} from './shared';

const BACKGROUND = '#101820';

function textureData(): DataTexture {
	// Left half opaque red, right half fully transparent. The colour is irrelevant;
	// the alpha edge is the Artwork shadow mask's subject.
	const data = new Uint8Array([
		255, 0, 0, 255, 255, 0, 0, 255,
		255, 0, 0, 0, 255, 0, 0, 0
	]);
	const texture = new DataTexture(data, 2, 1, RGBAFormat);
	texture.colorSpace = SRGBColorSpace;
	texture.needsUpdate = true;
	return texture;
}

function quadScene(colour: string): { scene: Scene; camera: OrthographicCamera } {
	const scene = new Scene();
	scene.background = new Color(BACKGROUND);
	const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
	camera.position.z = 2;
	const mesh = new Mesh(new PlaneGeometry(2, 2), new MeshBasicNodeMaterial({ color: colour }));
	scene.add(mesh);
	return { scene, camera };
}

async function initProbe(forceWebGL: boolean): Promise<{
	backend: Backend;
	coordinateSystem: string;
	initMs: number;
	centre: [number, number, number, number];
	disposed: boolean;
}> {
	const created = await createWebgpuRenderer({ width: 64, height: 64, forceWebGL });
	const { scene, camera } = quadScene('#ff0000');
	const renderTarget = target(16, 16);
	const readback = await (async () => {
		const previous = created.renderer.getRenderTarget();
		created.renderer.setRenderTarget(renderTarget);
		created.renderer.render(scene, camera);
		created.renderer.setRenderTarget(previous);
		return readTarget(created.renderer, renderTarget, 16, 16, { x: 8, y: 8, expected: [255, 0, 0] });
	})();
	const centre = pixelAt(readback, 8, 8);
	disposeScene(scene);
	renderTarget.dispose();
	await created.renderer.dispose();
	created.canvas.remove();
	return {
		backend: created.backend,
		coordinateSystem: created.coordinateSystem,
		initMs: created.initMs,
		centre,
		disposed: true
	};
}

export const qualification: readonly ScenarioEntry[] = [
	scenario('init', 'Initialization, observed backend and coordinate system', async () => {
		const adapter = navigator.gpu ? await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }) : null;
		const info = adapter?.info;
		const auto = await initProbe(false);
		const forced = await initProbe(true);

		const assertions: Assertion[] = [
			assertion('automatic selection obtained native WebGPU', auto.backend === 'webgpu', auto.backend),
			assertion('automatic coordinate system is WebGPU', auto.coordinateSystem === 'webgpu', auto.coordinateSystem),
			assertion('forced selection obtained WebGL2', forced.backend === 'webgl2', forced.backend),
			assertion('forced coordinate system is WebGL', forced.coordinateSystem === 'webgl', forced.coordinateSystem),
			assertion('automatic first draw is the expected red', colourDistance(auto.centre, [255, 0, 0]) <= 1, auto.centre),
			assertion('forced first draw is the expected red', colourDistance(forced.centre, [255, 0, 0]) <= 1, forced.centre),
			assertion('both generations disposed', auto.disposed && forced.disposed)
		];
		return {
			backend: 'webgpu+webgl2',
			assertions,
			measurements: {
				navigatorGpu: navigator.gpu !== undefined,
				adapter: info
					? {
							vendor: info.vendor,
							architecture: info.architecture,
							device: info.device,
							description: info.description
						}
					: null,
				auto,
				forced
			}
		};
	}),

	scenario('row-order', 'Native readback row order, independent of scene signatures', async () => {
		const assertions: Assertion[] = [];
		const measurements: Record<string, unknown> = {};
		for (const forceWebGL of [false, true]) {
			const created = await createWebgpuRenderer({ width: 32, height: 32, forceWebGL });
			const label = created.backend;
			const scene = new Scene();
			scene.background = new Color('#000000');
			const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
			camera.position.z = 2;
			// Only the scene's top-left corner is red. Raw rows are inspected before
			// any normalization, so this probe cannot inherit readTarget's contract.
			const marker = new Mesh(new PlaneGeometry(0.25, 0.25), new MeshBasicNodeMaterial({ color: '#ff0000' }));
			marker.position.set(-0.8, 0.8, 0);
			scene.add(marker);
			const renderTarget = target(32, 32);
			created.renderer.setRenderTarget(renderTarget);
			created.renderer.render(scene, camera);
			created.renderer.setRenderTarget(null);
			const raw = await created.renderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, 32, 32);
			const native = raw instanceof Uint8Array ? raw : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
			const at = (x: number, y: number): number[] => {
				const index = (y * 32 + x) * 4;
				return Array.from(native.slice(index, index + 3));
			};
			const top = at(4, 4);
			const bottom = at(4, 27);
			const red = (rgb: number[]): boolean => colourDistance(rgb, [255, 0, 0]) <= 4;
			const black = (rgb: number[]): boolean => colourDistance(rgb, [0, 0, 0]) <= 4;
			const observed =
				red(top) && black(bottom)
					? 'top-down'
					: black(top) && red(bottom)
						? 'bottom-up'
						: 'indeterminate';
			const expected = label === 'webgl2' ? 'bottom-up' : 'top-down';
			let unmatchedRefused = false;
			try {
				await readTarget(created.renderer, renderTarget, 32, 32, {
					x: 4,
					y: 4,
					expected: [0, 255, 255]
				});
			} catch {
				unmatchedRefused = true;
			}
			let contradictoryRefused = false;
			try {
				await readTarget(created.renderer, renderTarget, 32, 32, {
					x: 4,
					y: 27,
					expected: [255, 0, 0]
				});
			} catch {
				contradictoryRefused = true;
			}
			measurements[label] = { expected, observed, top, bottom, unmatchedRefused, contradictoryRefused };
			assertions.push(assertion(`${label}: raw rows are ${expected}`, observed === expected, observed));
			assertions.push(
				assertion(`${label}: an unmatched signature is refused, not defaulted`, unmatchedRefused)
			);
			assertions.push(
				assertion(`${label}: a signature that contradicts the backend is refused`, contradictoryRefused)
			);
			disposeScene(scene);
			renderTarget.dispose();
			await created.renderer.dispose();
			created.canvas.remove();
		}
		return { backend: 'webgpu+webgl2', assertions, measurements };
	}),

	scenario('build-identity', 'One Three instance across the two entry points', async () => {
		// The product imports plain data classes from `three` and the renderer from
		// `three/webgpu`. A raw bundle of both entry points can contain two cores;
		// this records whether that happened here and whether a legacy scene still
		// draws through the node renderer.
		const sameVector = Legacy.Vector3 === Vector3;
		const sameColourManagement = Legacy.ColorManagement === GpuColourManagement;
		const sameTexture = Legacy.Texture === Texture;
		const texture = new Texture();
		const node = textureNode(texture);
		const tslReadsSameTexture = (node as unknown as { value: Texture }).value === texture;

		const created = await createWebgpuRenderer({ width: 32, height: 32 });
		const scene = new Legacy.Scene();
		scene.background = new Legacy.Color(BACKGROUND);
		const camera = new Legacy.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
		camera.position.z = 2;
		const mesh = new Legacy.Mesh(
			new Legacy.PlaneGeometry(2, 2),
			new Legacy.MeshBasicMaterial({ color: '#ff0000' })
		);
		scene.add(mesh);
		const renderTarget = target(16, 16);
		created.renderer.setRenderTarget(renderTarget);
		created.renderer.render(scene as unknown as Scene, camera as never);
		created.renderer.setRenderTarget(null);
		const readback = await readTarget(created.renderer, renderTarget, 16, 16, {
			x: 8,
			y: 8,
			expected: [255, 0, 0]
		});
		const centre = pixelAt(readback, 8, 8);
		created.renderer.setRenderTarget(null);
		await created.renderer.dispose();
		created.canvas.remove();

		return {
			backend: created.backend,
			assertions: [
				assertion('the TSL node reads the same Texture instance', tslReadsSameTexture),
				assertion('a legacy scene draws through WebGPURenderer', colourDistance(centre, [255, 0, 0]) <= 1, centre)
			],
			measurements: {
				sameVectorConstructor: sameVector,
				sameTextureConstructor: sameTexture,
				sameColourManagement,
				legacyThroughNodeRendererCentre: centre,
				note:
					'This esbuild bundle resolved both entry points to one core. PR 2 must still confirm one core in the Vite production graph.'
			}
		};
	}),

	scenario('simultaneous-devices', 'Two devices sharing one texture, with one retirement', async () => {
		const native = await createWebgpuRenderer({ width: 32, height: 32 });
		const forced = await createWebgpuRenderer({ width: 32, height: 32, forceWebGL: true });
		const texture = textureData();
		texture.colorSpace = SRGBColorSpace;
		const scene = new Scene();
		scene.background = new Color(BACKGROUND);
		const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
		camera.position.z = 2;
		scene.add(new Mesh(new PlaneGeometry(1.6, 1.6), new MeshBasicNodeMaterial({ map: texture, color: '#ffffff' })));
		const nativeTarget = target(16, 16);
		const forcedTarget = target(16, 16);
		const draw = async (renderer: WebGPURenderer, renderTarget: ReturnType<typeof target>) => {
			renderer.setRenderTarget(renderTarget);
			renderer.render(scene, camera);
			renderer.setRenderTarget(null);
			return readTarget(renderer, renderTarget, 16, 16, { x: 8, y: 8, expected: [255, 0, 0] });
		};
		const first = await draw(native.renderer, nativeTarget);
		const second = await draw(forced.renderer, forcedTarget);
		const firstCentre = pixelAt(first, 8, 8);
		const secondCentre = pixelAt(second, 8, 8);
		await native.renderer.dispose();
		const survivor = await draw(forced.renderer, forcedTarget);
		const survivorCentre = pixelAt(survivor, 8, 8);
		const survivorTextures = forced.renderer.info.memory.textures;
		await forced.renderer.dispose();
		native.canvas.remove();
		forced.canvas.remove();
		scene.traverse((object) => {
			const mesh = object as Mesh;
			mesh.geometry?.dispose();
			(mesh.material as Material | undefined)?.dispose();
		});
		texture.dispose();
		nativeTarget.dispose();
		forcedTarget.dispose();

		return {
			backend: 'webgpu+webgl2',
			assertions: [
				assertion('native backend draws the shared texture', colourDistance(firstCentre, [255, 0, 0]) <= 2, firstCentre),
				assertion('forced WebGL2 backend draws the shared texture', colourDistance(secondCentre, [255, 0, 0]) <= 2, secondCentre),
				assertion('the survivor still draws after the other device retires', colourDistance(survivorCentre, [255, 0, 0]) <= 2, survivorCentre)
			],
			measurements: {
				textureUuid: texture.uuid,
				nativeBackend: native.backend,
				forcedBackend: forced.backend,
				firstCentre,
				secondCentre,
				survivorCentre,
				survivorTextureCount: survivorTextures
			}
		};
	}),

	scenario('projection-scissor', 'Camera projection and top-left viewport/scissor', async () => {
		const assertions: Assertion[] = [];
		const measurements: Record<string, unknown> = {};

		for (const forceWebGL of [false, true]) {
			const created = await createWebgpuRenderer({ width: 160, height: 100, forceWebGL });
			const scene = new Scene();
			scene.background = new Color(BACKGROUND);
			const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
			camera.position.z = 2;
			scene.add(new Mesh(new PlaneGeometry(2, 2), new MeshBasicNodeMaterial({ color: '#00ff00' })));
			const renderTarget = target(160, 100);
			// A custom RenderTarget owns its own scissor state; the renderer-level
			// setScissor only mutates the canvas target.
			renderTarget.scissor.set(24, 16, 60, 40);
			renderTarget.scissorTest = true;
			created.renderer.setRenderTarget(renderTarget);
			created.renderer.setClearColor(new Color(BACKGROUND), 1);
			created.renderer.clear();
			created.renderer.render(scene, camera);
			created.renderer.setRenderTarget(null);
			const raw = await created.renderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, 160, 100);
			const native = raw instanceof Uint8Array ? raw : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
			const at = (x: number, y: number): number[] => {
				const index = (y * 160 + x) * 4;
				return Array.from(native.slice(index, index + 3));
			};
			const topInside = at(40, 30);
			const topOutside = at(100, 70);
			const mirroredInside = at(40, 100 - 1 - 30);
			const isGreen = (rgb: number[]): boolean => rgb[1]! > 200 && rgb[0]! < 40;
			const normalizedTopDown = isGreen(topInside) || !isGreen(mirroredInside);
			const inside = normalizedTopDown ? topInside : mirroredInside;
			const outside = normalizedTopDown ? topOutside : at(100, 100 - 1 - 70);
			const label = created.backend;
			assertions.push(assertion(`${label}: scissor region is drawn`, isGreen(inside), inside));
			assertions.push(assertion(`${label}: outside the scissor is clear`, !isGreen(outside), outside));
			measurements[label] = {
				rowOrder: normalizedTopDown ? 'top-down' : 'bottom-up',
				inside,
				outside,
				scissor: created.renderer.getScissor(new Vector4()).toArray(),
				viewport: created.renderer.getViewport(new Vector4()).toArray()
			};

			// Depth: a near red quad must occlude a far blue one under both camera kinds.
			for (const kind of ['perspective', 'orthographic'] as const) {
				const depthScene = new Scene();
				depthScene.background = new Color(BACKGROUND);
				const near = new Mesh(new PlaneGeometry(1.4, 1.4), new MeshBasicNodeMaterial({ color: '#ff0000' }));
				near.position.z = 0.4;
				const far = new Mesh(new PlaneGeometry(1.4, 1.4), new MeshBasicNodeMaterial({ color: '#0000ff' }));
				far.position.z = -0.4;
				depthScene.add(near, far);
				const depthCamera =
					kind === 'perspective'
						? new PerspectiveCamera(50, 160 / 100, 0.1, 10)
						: new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
				depthCamera.position.z = 2;
				renderTarget.scissorTest = false;
				created.renderer.setRenderTarget(renderTarget);
				created.renderer.render(depthScene, depthCamera);
				created.renderer.setRenderTarget(null);
				const depthRaw = await created.renderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, 160, 100);
				const depthPixels =
					depthRaw instanceof Uint8Array ? depthRaw : new Uint8Array(depthRaw.buffer, depthRaw.byteOffset, depthRaw.byteLength);
				const index = (50 * 160 + 80) * 4;
				const centre = Array.from(depthPixels.slice(index, index + 3));
				assertions.push(assertion(`${label}: ${kind} depth keeps the near red`, centre[0]! > 180 && centre[2]! < 60, centre));
				depthScene.traverse((object) => {
					const mesh = object as Mesh;
					mesh.geometry?.dispose();
					(mesh.material as Material | undefined)?.dispose();
				});
			}

			disposeScene(scene);
			renderTarget.dispose();
			await created.renderer.dispose();
			created.canvas.remove();
		}

		// DPR 1.5 on the default framebuffer: record the actual scissor unit.
		const dpr = await createWebgpuRenderer({ width: 200, height: 120, dpr: 1.5 });
		const dprScene = quadScene('#00ff00');
		dpr.renderer.setViewport(0, 0, 200, 120);
		dpr.renderer.setScissorTest(true);
		dpr.renderer.setScissor(20, 10, 80, 40);
		dpr.renderer.setClearColor(new Color(BACKGROUND), 1);
		dpr.renderer.clear();
		dpr.renderer.render(dprScene.scene, dprScene.camera);
		await drain(dpr.renderer);
		const presented = canvasPixels(dpr.canvas);
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		const greenAt = (x: number, y: number): boolean => {
			const index = (y * presented.width + x) * 4;
			return presented.data[index + 1]! > 200 && presented.data[index]! < 40;
		};
		for (let y = 0; y < presented.height; y += 1) {
			for (let x = 0; x < presented.width; x += 1) {
				if (!greenAt(x, y)) continue;
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
				minY = Math.min(minY, y);
				maxY = Math.max(maxY, y);
			}
		}
		measurements.dpr = {
			drawingBuffer: [dpr.canvas.width, dpr.canvas.height],
			greenBox: Number.isFinite(minX) ? [minX, minY, maxX - minX + 1, maxY - minY + 1] : null,
			cssExpectedBox: [30, 15, 120, 60],
			unscaledExpectedBox: [20, 10, 80, 40],
			scissor: dpr.renderer.getScissor(new Vector4()).toArray(),
			pixelRatio: dpr.renderer.getPixelRatio()
		};
		const box = measurements.dpr.greenBox as number[] | null;
		const near = (expected: number[]): boolean =>
			box !== null && expected.every((value, index) => Math.abs(value - box[index]!) <= 2);
		assertions.push(
			assertion(
				'DPR 1.5: setScissor takes CSS pixels and the backend scales them',
				near([30, 15, 120, 60]),
				JSON.stringify(measurements.dpr)
			)
		);
		assertions.push(
			assertion(
				'DPR 1.5: the drawn box is not the unscaled device box',
				!near([20, 10, 80, 40]),
				JSON.stringify(box)
			)
		);
		disposeScene(dprScene.scene);
		await dpr.renderer.dispose();
		dpr.canvas.remove();

		return { backend: 'webgpu+webgl2', assertions, measurements };
	}),

	scenario('shadow-basics', 'A plain Sun shadow changes the floor', async () => {
		const assertions: Assertion[] = [];
		const measurements: Record<string, unknown> = {};
		for (const forceWebGL of [false, true]) {
			const created = await createWebgpuRenderer({ width: 160, height: 160, forceWebGL });
			const scene = new Scene();
			scene.background = new Color(BACKGROUND);
			const camera = new OrthographicCamera(-3, 3, 3, -3, 0.1, 20);
			camera.up.set(0, 0, -1);
			camera.position.set(0, 8, 0);
			camera.lookAt(0, 0, 0);
			const ground = new Mesh(new PlaneGeometry(6, 6), new MeshLambertNodeMaterial({ color: '#bbbbbb' }));
			ground.rotation.x = -Math.PI / 2;
			ground.receiveShadow = true;
			const caster = new Mesh(new BoxGeometry(0.8, 1, 0.8), new MeshLambertNodeMaterial({ color: '#ff0000' }));
			caster.position.set(0, 0.5, 0);
			caster.castShadow = true;
			const sun = new DirectionalLight(0xffffff, 2);
			sun.position.set(2, 5, 2);
			sun.castShadow = true;
			sun.target.position.set(0, 0, 0);
			scene.add(ground, caster, sun, sun.target, new AmbientLight(0xffffff, 0.4));
			const capture = async (): Promise<Uint8Array> => {
				const renderTarget = target(160, 160);
				created.renderer.setRenderTarget(renderTarget);
				created.renderer.render(scene, camera);
				created.renderer.setRenderTarget(null);
				const pixels = await created.renderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, 160, 160);
				renderTarget.dispose();
				return pixels instanceof Uint8Array
					? pixels
					: new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
			};
			const withShadow = await capture();
			sun.castShadow = false;
			const withoutShadow = await capture();
			let changed = 0;
			let minX = 160;
			let minY = 160;
			let maxX = 0;
			let maxY = 0;
			for (let y = 0; y < 160; y += 1) {
				for (let x = 0; x < 160; x += 1) {
					const index = (y * 160 + x) * 4;
					const delta = Math.max(
						Math.abs(withShadow[index]! - withoutShadow[index]!),
						Math.abs(withShadow[index + 1]! - withoutShadow[index + 1]!),
						Math.abs(withShadow[index + 2]! - withoutShadow[index + 2]!)
					);
					if (delta <= 8) continue;
					changed += 1;
					minX = Math.min(minX, x);
					minY = Math.min(minY, y);
					maxX = Math.max(maxX, x);
					maxY = Math.max(maxY, y);
				}
			}
			const label = created.backend;
			measurements[label] = {
				changedPixels: changed,
				changedBox: changed > 0 ? [minX, minY, maxX - minX + 1, maxY - minY + 1] : null,
				shadowMapAllocated: sun.shadow.map !== null,
				shadowMapEnabled: created.renderer.shadowMap.enabled
			};
			assertions.push(
				assertion(`${label}: enabling the Sun shadow changes the floor`, changed > 100, String(changed))
			);
			disposeScene(scene);
			await created.renderer.dispose();
			created.canvas.remove();
		}
		return { backend: 'webgpu+webgl2', assertions, measurements };
	}),

	scenario('shadow-mask', 'Artwork alpha shadow mask on Sun, Spot and Point', async () => {
		const assertions: Assertion[] = [];
		const measurements: Record<string, unknown> = {};

		const diff = (a: Uint8Array, b: Uint8Array): number => {
			let changed = 0;
			for (let index = 0; index < a.length; index += 4) {
				const delta = Math.max(
					Math.abs(a[index]! - b[index]!),
					Math.abs(a[index + 1]! - b[index + 1]!),
					Math.abs(a[index + 2]! - b[index + 2]!)
				);
				if (delta > 8) changed += 1;
			}
			return changed;
		};

		for (const forceWebGL of [false, true]) {
			const label = forceWebGL ? 'webgl2' : 'webgpu';
			const results: Record<string, unknown> = {};
			for (const lightKind of ['sun', 'spot', 'point'] as const) {
				const renderVariant = async (
					variant: 'mask-uv' | 'mask-position' | 'mask-texture' | 'pass-through' | 'no-shadow'
				): Promise<{ pixels: Uint8Array; calls: number; shadowMapAllocated: boolean }> => {
					// Fresh generation per variant: r187 caches shadow nodes per
					// material version, and a light's shadow state survives a toggle.
					const created = await createWebgpuRenderer({ width: 200, height: 160, forceWebGL });
					const scene = new Scene();
					scene.background = new Color(BACKGROUND);
					const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 20);
					camera.up.set(0, 0, -1);
					camera.position.set(0, 10, 0);
					camera.lookAt(0, 0, 0);
					const ground = new Mesh(
						new PlaneGeometry(12, 12),
						new MeshLambertNodeMaterial({ color: '#bbbbbb' })
					);
					ground.rotation.x = -Math.PI / 2;
					ground.receiveShadow = true;
					const map = textureData();
					const artworkMaterial = new MeshLambertNodeMaterial({ map, transparent: false });
					artworkMaterial.maskShadowNode =
						variant === 'mask-uv'
							? uv().x.lessThan(0.5)
							: variant === 'mask-position'
								? positionWorld.x.lessThan(0)
								: variant === 'mask-texture'
									? textureNode(map, uv()).a.greaterThan(0.5)
									: float(1);
					// A thin box rather than a plane: a zero-thickness caster is
					// outside this probe's subject and varies by shadow pass.
					const artwork = new Mesh(new BoxGeometry(1.2, 0.02, 1.2), artworkMaterial);
					artwork.position.y = 1;
					artwork.castShadow = true;
					scene.add(ground, artwork, new AmbientLight(0xffffff, 0.5));
					const light: Light =
						lightKind === 'sun'
							? new DirectionalLight(0xffffff, 2)
							: lightKind === 'spot'
								? new SpotLight(0xffffff, 80)
								: new PointLight(0xffffff, 70);
					light.position.set(6, 4, 6);
					light.castShadow = variant !== 'no-shadow';
					(light as DirectionalLight).shadow.mapSize.set(256, 256);
					if (lightKind === 'spot') (light as SpotLight).target.position.set(0, 0, 0);
					scene.add(light);
					if (lightKind === 'spot') scene.add((light as SpotLight).target);
					const renderTarget = target(200, 160);
					created.renderer.setRenderTarget(renderTarget);
					created.renderer.render(scene, camera);
					created.renderer.setRenderTarget(null);
					const pixels = await created.renderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, 200, 160);
					const bytes =
						pixels instanceof Uint8Array
							? pixels
							: new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
					const calls = created.renderer.info.render.calls;
					const shadowMapAllocated = (light as DirectionalLight).shadow.map !== null;
					disposeScene(scene);
					map.dispose();
					renderTarget.dispose();
					await created.renderer.dispose();
					created.canvas.remove();
					return { pixels: bytes, calls, shadowMapAllocated };
				};
				const maskUv = await renderVariant('mask-uv');
				const maskPosition = await renderVariant('mask-position');
				const maskTexture = await renderVariant('mask-texture');
				const passThrough = await renderVariant('pass-through');
				const noShadow = await renderVariant('no-shadow');
				const uvVsPass = diff(maskUv.pixels, passThrough.pixels);
				const positionVsPass = diff(maskPosition.pixels, passThrough.pixels);
				const textureVsPass = diff(maskTexture.pixels, passThrough.pixels);
				const maskVsNoShadow = diff(maskUv.pixels, noShadow.pixels);
				results[lightKind] = {
					uvMaskVsPassThrough: uvVsPass,
					positionMaskVsPassThrough: positionVsPass,
					textureMaskVsPassThrough: textureVsPass,
					maskVsNoShadow,
					uvCalls: maskUv.calls,
					passCalls: passThrough.calls,
					noShadowCalls: noShadow.calls,
					uvShadowMap: maskUv.shadowMapAllocated,
					passShadowMap: passThrough.shadowMapAllocated
				};
				assertions.push(
					assertion(
						`${label} ${lightKind}: a UV mask removes a shadow the pass-through casts`,
						uvVsPass > 100,
						String(uvVsPass)
					)
				);
				assertions.push(
					assertion(
						`${label} ${lightKind}: a position mask removes a shadow the pass-through casts`,
						positionVsPass > 100,
						String(positionVsPass)
					)
				);
				assertions.push(
					assertion(
						`${label} ${lightKind}: the masked shadow differs from no shadow`,
						maskVsNoShadow > 100,
						String(maskVsNoShadow)
					)
				);
			}
			measurements[label] = results;
		}
		return { backend: 'webgpu+webgl2', assertions, measurements };
	}),

	scenario('clip-mask', 'TSL colour clip and its shadow-pass counterpart', async () => {
		const assertions: Assertion[] = [];
		const measurements: Record<string, unknown> = {};
		for (const forceWebGL of [false, true]) {
			const created = await createWebgpuRenderer({ width: 120, height: 120, forceWebGL });
			const scene = new Scene();
			scene.background = new Color(BACKGROUND);
			const camera = new OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 10);
			camera.position.z = 4;
			// A tall caster: colour keeps only its lower half.
			const material = new MeshLambertNodeMaterial({ color: '#ff0000', side: DoubleSide });
			material.maskNode = (positionWorld as unknown as { y: { lessThan(value: number): unknown } }).y.lessThan(0);
			const caster = new Mesh(new PlaneGeometry(1, 2), material);
			scene.add(caster, new AmbientLight(0xffffff, 0.8));
			const renderTarget = target(120, 120);
			created.renderer.setRenderTarget(renderTarget);
			created.renderer.render(scene, camera);
			created.renderer.setRenderTarget(null);
			// The red lower half is the signature. The background is #101820, not
			// black, so a black signature can never confirm either orientation.
			const readback = await readTarget(created.renderer, renderTarget, 120, 120, {
				x: 60,
				y: 90,
				expected: [138, 0, 0]
			});
			const upper = pixelAt(readback, 60, 30);
			const lower = pixelAt(readback, 60, 90);
			const label = created.backend;
			assertions.push(assertion(`${label}: maskNode discards the upper colour half`, colourDistance(upper, [16, 24, 32]) <= 8, upper));
			assertions.push(assertion(`${label}: maskNode keeps the lower colour half`, lower[0]! - upper[0]! > 40, lower));
			measurements[`${label}-colour`] = {
				upper,
				lower,
				rowOrder: readback.rowOrder,
				rowOrderSignature: readback.signature
			};
			disposeScene(scene);
			renderTarget.dispose();
			await created.renderer.dispose();
			created.canvas.remove();
		}
		return { backend: 'webgpu+webgl2', assertions, measurements };
	}),

	scenario('wide-lines', 'Line2NodeMaterial width and dashes at DPR 1 and 1.5', async () => {
		const assertions: Assertion[] = [];
		const measurements: Record<string, unknown> = {};
		for (const forceWebGL of [false, true]) {
			for (const dpr of [1, 1.5] as const) {
				const width = 200;
				const height = 120;
				const pixelWidth = Math.round(width * dpr);
				const pixelHeight = Math.round(height * dpr);
				const created = await createWebgpuRenderer({ width, height, dpr, forceWebGL });
				const label = created.backend;
				const scene = new Scene();
				scene.background = new Color(BACKGROUND);
				const camera = new OrthographicCamera(-1, 1, 0.6, -0.6, 0.1, 10);
				camera.position.z = 2;
				// A magenta marker in the top-left corner makes the row-order
				// signature unambiguous at both DPRs; the line scans never touch it.
				const marker = new Mesh(new PlaneGeometry(0.08, 0.08), new MeshBasicNodeMaterial({ color: '#ff00ff' }));
				marker.position.set(-0.94, 0.54, 0.1);
				scene.add(marker);
				// Line2's default material picks a random hue. A pixel probe cannot
				// use it: a blue/green run would read as "no line". Pin both colours.
				const line = new Line2(
					new LineGeometry().setPositions([-0.8, 0.2, 0, 0.8, 0.2, 0]),
					new Line2NodeMaterial({ color: '#ffffff' })
				);
				line.material.linewidth = 8;
				line.material.worldUnits = false;
				line.computeLineDistances();
				const dashed = new Line2(
					new LineGeometry().setPositions([-0.8, -0.2, 0, 0.8, -0.2, 0]),
					new Line2NodeMaterial({ color: '#ffffff' })
				);
				dashed.material.linewidth = 6;
				dashed.material.worldUnits = false;
				dashed.material.dashed = true;
				dashed.material.dashSize = 0.15;
				dashed.material.gapSize = 0.1;
				dashed.computeLineDistances();
				scene.add(line, dashed);
				const renderTarget = target(pixelWidth, pixelHeight);
				created.renderer.setRenderTarget(renderTarget);
				created.renderer.render(scene, camera);
				created.renderer.setRenderTarget(null);
				const readback = await readTarget(created.renderer, renderTarget, pixelWidth, pixelHeight, {
					x: Math.round(6 * dpr),
					y: Math.round(4 * dpr),
					expected: [255, 0, 255]
				});
				let thickness = 0;
				const thicknessX = Math.round(100 * dpr);
				for (let x = thicknessX - 2; x <= thicknessX + 2; x += 1) {
					let run = 0;
					for (let y = 0; y < pixelHeight; y += 1) {
						if (pixelAt(readback, x, y)[0]! > 100) {
							run += 1;
							thickness = Math.max(thickness, run);
						} else {
							run = 0;
						}
					}
				}
				// A dash count must not depend on one exact scan row: DPR rounding and
				// antialiasing move its visible band by a pixel. Take the best row in
				// a small band around the expected dashed-line position.
				let dashes = 0;
				let dashRow: number | null = null;
				const dashY = Math.round(78 * dpr);
				for (let y = Math.max(0, dashY - 4); y <= Math.min(pixelHeight - 1, dashY + 4); y += 1) {
					let count = 0;
					let inDash = false;
					for (let x = Math.round(20 * dpr); x < Math.round(180 * dpr); x += 1) {
						const red = pixelAt(readback, x, y)[0]! > 100;
						if (red && !inDash) count += 1;
						inDash = red;
					}
					if (count > dashes) {
						dashes = count;
						dashRow = y;
					}
				}
				const centreColumn: Array<[number, [number, number, number, number]]> = [];
				for (let y = 0; y < pixelHeight; y += 1) {
					const pixel = pixelAt(readback, thicknessX, y);
					if (pixel[0]! > 100 || pixel[2]! > 100) centreColumn.push([y, pixel]);
				}
				measurements[`${label}-dpr${dpr}`] = {
					thickness,
					dashes,
					dpr,
					drawingBuffer: [created.canvas.width, created.canvas.height],
					rowOrder: readback.rowOrder,
					rowOrderSignature: readback.signature,
					centreColumnCount: centreColumn.length,
					centreColumn: centreColumn.slice(0, 12),
					dashRow,
					viewport: created.renderer.getViewport(new Vector4()).toArray(),
					worldUnits: false
				};
				assertions.push(
					assertion(
						`${label} DPR ${dpr}: 8 px line stays visible (6..${Math.round(11 * dpr)} px)`,
						thickness >= 6 && thickness <= Math.round(11 * dpr),
						thickness
					)
				);
				assertions.push(
					assertion(`${label} DPR ${dpr}: dashed line has at least three dashes`, dashes >= 3, dashes)
				);
				disposeScene(scene);
				renderTarget.dispose();
				await created.renderer.dispose();
				created.canvas.remove();
			}
		}
		return { backend: 'webgpu+webgl2', assertions, measurements };
	}),

	scenario('stencil', 'Stencil write/equal outline probe', async () => {
		const assertions: Assertion[] = [];
		const measurements: Record<string, unknown> = {};
		for (const forceWebGL of [false, true]) {
			const created = await createWebgpuRenderer({ width: 120, height: 80, forceWebGL, stencil: true });
			const label = created.backend;
			const scene = new Scene();
			scene.background = new Color(BACKGROUND);
			const camera = new OrthographicCamera(-1.5, 1.5, 1, -1, 0.1, 10);
			camera.position.z = 2;
			const maskMaterial = new MeshBasicNodeMaterial({
				colorWrite: false,
				depthWrite: false,
				depthTest: false,
				stencilWrite: true,
				stencilFunc: AlwaysStencilFunc,
				stencilZPass: ReplaceStencilOp,
				stencilRef: 1
			});
			const mask = new Mesh(new PlaneGeometry(0.8, 0.6), maskMaterial);
			const fillMaterial = new MeshBasicNodeMaterial({ color: '#ff0000', depthTest: false, depthWrite: false });
			fillMaterial.stencilWrite = true;
			fillMaterial.stencilFunc = EqualStencilFunc;
			fillMaterial.stencilRef = 1;
			fillMaterial.stencilFail = KeepStencilOp;
			fillMaterial.stencilZFail = KeepStencilOp;
			fillMaterial.stencilZPass = KeepStencilOp;
			const fill = new Mesh(new PlaneGeometry(2, 2), fillMaterial);
			fill.position.z = -0.5;
			scene.add(mask, fill);
			const renderTarget = target(120, 80, { stencil: true });
			created.renderer.setRenderTarget(renderTarget);
			created.renderer.autoClear = false;
			created.renderer.clear(true, true, true);
			created.renderer.render(scene, camera);
			created.renderer.setRenderTarget(null);
			const readback = await readTarget(created.renderer, renderTarget, 120, 80, {
				x: 60,
				y: 40,
				expected: [255, 0, 0]
			});
			const inside = pixelAt(readback, 60, 40);
			const outside = pixelAt(readback, 10, 10);
			measurements[label] = { inside, outside, stencilBuffer: true };
			assertions.push(assertion(`${label}: stencil equal fills the mask region`, inside[0]! > 180 && inside[1]! < 60, inside));
			assertions.push(assertion(`${label}: stencil rejects outside the mask`, colourDistance(outside, [16, 24, 32]) <= 8, outside));
			disposeScene(scene);
			renderTarget.dispose();
			await created.renderer.dispose();
			created.canvas.remove();
		}
		return { backend: 'webgpu+webgl2', assertions, measurements };
	}),

	scenario('colour-readback', 'sRGB output, grey ramp and async target readback', async () => {
		const assertions: Assertion[] = [];
		const measurements: Record<string, unknown> = {};
		for (const forceWebGL of [false, true]) {
			const created = await createWebgpuRenderer({ width: 160, height: 80, forceWebGL });
			const label = created.backend;
			// Presented `#808080` must read 128 through the sRGB output path.
			const grey = quadScene('#808080');
			created.renderer.setRenderTarget(null);
			created.renderer.setViewport(0, 0, 160, 80);
			created.renderer.render(grey.scene, grey.camera);
			await drain(created.renderer);
			const greyPixel = (() => {
				const data = canvasPixels(created.canvas);
				const index = (40 * data.width + 80) * 4;
				return [data.data[index]!, data.data[index + 1]!, data.data[index + 2]!];
			})();
			measurements[`${label}-grey`] = greyPixel;
			assertions.push(assertion(`${label}: #808080 reads 128`, colourDistance(greyPixel, [128, 128, 128]) <= 1, greyPixel));
			disposeScene(grey.scene);

			// A monotonic grey ramp.
			const rampScene = new Scene();
			rampScene.background = new Color('#000000');
			const rampCamera = new OrthographicCamera(-1, 1, 0.5, -0.5, 0.1, 10);
			rampCamera.position.z = 2;
			const ramp: number[] = [];
			for (let step = 0; step < 16; step += 1) {
				const value = Math.round((step / 15) * 255);
				const material = new MeshBasicNodeMaterial({
					color: new Color().setRGB(value / 255, value / 255, value / 255, SRGBColorSpace)
				});
				const quad = new Mesh(new PlaneGeometry(2 / 16, 1), material);
				quad.position.x = -1 + (step + 0.5) * (2 / 16);
				rampScene.add(quad);
			}
			created.renderer.render(rampScene, rampCamera);
			await drain(created.renderer);
			const rampPixels = canvasPixels(created.canvas);
			for (let step = 0; step < 16; step += 1) {
				const x = Math.round(((step + 0.5) / 16) * rampPixels.width);
				const index = (Math.round(rampPixels.height / 2) * rampPixels.width + x) * 4;
				ramp.push(rampPixels.data[index]!);
			}
			const monotonic = ramp.every((value, index) => index === 0 || value >= ramp[index - 1]!);
			measurements[`${label}-ramp`] = ramp;
			assertions.push(assertion(`${label}: grey ramp is monotonic`, monotonic, ramp.join(',')));
			disposeScene(rampScene);

			// Odd-width target, asymmetric corners, packed rows.
			const oddWidth = 641;
			const oddHeight = 97;
			const corners = new Scene();
			corners.background = new Color('#000000');
			const cornerCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
			cornerCamera.position.z = 2;
			const cornerSpec: Array<{ colour: string; position: [number, number, number]; expected: [number, number, number] }> = [
				{ colour: '#ff0000', position: [-0.5, 0.5, 0], expected: [255, 0, 0] },
				{ colour: '#00ff00', position: [0.5, 0.5, 0], expected: [0, 255, 0] },
				{ colour: '#0000ff', position: [-0.5, -0.5, 0], expected: [0, 0, 255] },
				{ colour: '#ffff00', position: [0.5, -0.5, 0], expected: [255, 255, 0] }
			];
			for (const spec of cornerSpec) {
				const quad = new Mesh(new PlaneGeometry(2, 2), new MeshBasicNodeMaterial({ color: spec.colour }));
				quad.position.set(spec.position[0] * 2, spec.position[1] * 2, spec.position[2]);
				corners.add(quad);
			}
			const oddTarget = target(oddWidth, oddHeight);
			created.renderer.setRenderTarget(oddTarget);
			created.renderer.render(corners, cornerCamera);
			created.renderer.setRenderTarget(null);
			const odd = await readTarget(created.renderer, oddTarget, oddWidth, oddHeight, {
				x: 5,
				y: 5,
				expected: [255, 0, 0]
			});
			const topLeft = pixelAt(odd, 5, 5);
			const topRight = pixelAt(odd, oddWidth - 5, 5);
			const bottomLeft = pixelAt(odd, 5, oddHeight - 5);
			const bottomRight = pixelAt(odd, oddWidth - 5, oddHeight - 5);
			measurements[`${label}-odd`] = {
				rowOrder: odd.rowOrder,
				bytes: odd.bytes,
				expectedBytes: oddWidth * oddHeight * 4,
				ms: odd.ms,
				topLeft,
				topRight,
				bottomLeft,
				bottomRight
			};
			assertions.push(
				assertion(`${label}: odd-width readback is tightly packed`, odd.bytes === oddWidth * oddHeight * 4, odd.bytes)
			);
			assertions.push(
				assertion(
					`${label}: row order is normalizable`,
					colourDistance(topLeft, [255, 0, 0]) <= 2 &&
						colourDistance(topRight, [0, 255, 0]) <= 2 &&
						colourDistance(bottomLeft, [0, 0, 255]) <= 2 &&
						colourDistance(bottomRight, [255, 255, 0]) <= 2,
					JSON.stringify({ topLeft, topRight, bottomLeft, bottomRight })
				)
			);
			disposeScene(corners);
			oddTarget.dispose();
			await created.renderer.dispose();
			created.canvas.remove();
		}
		return { backend: 'webgpu+webgl2', assertions, measurements };
	}),

	scenario('pipeline-compilation', 'First-use pipeline work and compileAsync', async () => {
		const assertions: Assertion[] = [];
		const measurements: Record<string, unknown> = {};
		for (const forceWebGL of [false, true]) {
			const created = await createWebgpuRenderer({ width: 320, height: 200, forceWebGL });
			const label = created.backend;
			const scene = new Scene();
			scene.background = new Color(BACKGROUND);
			const camera = new PerspectiveCamera(45, 320 / 200, 0.1, 100);
			camera.position.set(0, 1.5, 5);
			camera.lookAt(0, 0, 0);
			const material = new MeshStandardNodeMaterial({ color: '#cccccc', roughness: 0.7 });
			const geometry = new BoxGeometry(0.3, 0.3, 0.3);
			for (let index = 0; index < 40; index += 1) {
				const mesh = new Mesh(geometry, material);
				mesh.position.set((index % 8) - 4, Math.floor(index / 8) - 2, 0);
				scene.add(mesh);
			}
			for (let index = 0; index < 4; index += 1) {
				const light = new DirectionalLight(0xffffff, 1);
				light.position.set(index - 2, 3, 2);
				scene.add(light);
			}
			scene.add(new AmbientLight(0xffffff, 0.35));
			const renderTarget = target(320, 200);
			const timedRender = async (): Promise<{ ms: number; calls: number; programs: number }> => {
				const start = performance.now();
				created.renderer.setRenderTarget(renderTarget);
				created.renderer.render(scene, camera);
				await drain(created.renderer);
				created.renderer.setRenderTarget(null);
				return {
					ms: performance.now() - start,
					calls: created.renderer.info.render.calls,
					programs: created.renderer.info.memory.programs
				};
			};
			const cold = await timedRender();
			const warm = await timedRender();
			const compileAsyncSupported = typeof created.renderer.compileAsync === 'function';
			let compileAsyncMs: number | null = null;
			if (compileAsyncSupported) {
				const nextMaterial = new MeshStandardNodeMaterial({ color: '#dddddd', roughness: 0.5 });
				const previous = material;
				scene.traverse((object) => {
					const mesh = object as Mesh;
					if (mesh.isMesh === true) mesh.material = nextMaterial;
				});
				const start = performance.now();
				await created.renderer.compileAsync(scene, camera);
				compileAsyncMs = performance.now() - start;
				scene.traverse((object) => {
					const mesh = object as Mesh;
					if (mesh.isMesh === true) mesh.material = previous;
				});
				nextMaterial.dispose();
			}
			const lightVariant = await timedRender();
			measurements[label] = { cold, warm, lightVariant, compileAsyncMs, compileAsyncSupported };
			assertions.push(assertion(`${label}: a warm repeat is not slower than the cold frame`, warm.ms <= cold.ms + 5, `${cold.ms} -> ${warm.ms}`));
			assertions.push(assertion(`${label}: the scene compiled at least one program`, cold.programs > 0, cold.programs));
			disposeScene(scene);
			renderTarget.dispose();
			await created.renderer.dispose();
			created.canvas.remove();
		}
		return { backend: 'webgpu+webgl2', assertions, measurements };
	}),

	scenario('device-loss', 'Device loss signals on both backends', async () => {
		const assertions: Assertion[] = [];
		const measurements: Record<string, unknown> = {};
		const native = await createWebgpuRenderer({ width: 32, height: 32 });
		const events: unknown[] = [];
		native.renderer.onDeviceLost = (info: unknown) => {
			events.push(info);
		};
		const device = (native.renderer as unknown as { backend: { device?: { destroy(): void } } }).backend.device;
		device?.destroy();
		await new Promise((resolve) => setTimeout(resolve, 100));
		const destroyedFiltered = events.length === 0;
		// The plan permits invoking the documented loss hook for deterministic owner
		// tests; r187 filters a `destroyed` reason, so do both and record which ran.
		native.renderer.onDeviceLost({ api: 'WebGPU', message: 'qualification: invoked loss hook', reason: 'test' });
		const hookFired = events.length === 1;
		let disposeRejected = false;
		try {
			await native.renderer.dispose();
		} catch {
			disposeRejected = true;
		}
		native.canvas.remove();
		measurements.native = { destroyedFiltered, hookFired, disposeRejected };
		assertions.push(assertion('destroyed device is filtered by r187', destroyedFiltered, events.length));
		assertions.push(assertion('the documented loss hook runs for owner tests', hookFired));

		const forced = await createWebgpuRenderer({ width: 32, height: 32, forceWebGL: true });
		const gl = (forced.renderer as unknown as { getContext?(): WebGL2RenderingContext | null }).getContext?.() ?? null;
		const extension = gl?.getExtension('WEBGL_lose_context') ?? null;
		let lostEvent = false;
		forced.canvas.addEventListener('webglcontextlost', (event) => {
			event.preventDefault();
			lostEvent = true;
		});
		extension?.loseContext();
		await new Promise((resolve) => setTimeout(resolve, 100));
		measurements.forced = { glContext: gl !== null, extension: extension !== null, lostEvent };
		assertions.push(assertion('forced WebGL2 exposes a context for loss testing', gl !== null && extension !== null));
		assertions.push(assertion('WEBGL_lose_context fires webglcontextlost', lostEvent));
		await forced.renderer.dispose().catch(() => {});
		forced.canvas.remove();

		return { backend: 'webgpu+webgl2', assertions, measurements };
	})
];

export type QualificationReport = {
	readonly environment: Record<string, unknown>;
	readonly scenarios: ScenarioResult[];
};

export async function runQualification(): Promise<QualificationReport> {
	const results: ScenarioResult[] = [];
	for (const entry of qualification) {
		try {
			const outcome: Outcome = await entry.run();
			results.push({
				id: entry.id,
				title: entry.title,
				status: outcome.assertions.every((item) => item.ok) ? 'pass' : 'fail',
				backend: outcome.backend,
				assertions: outcome.assertions,
				measurements: outcome.measurements ?? {}
			});
		} catch (error) {
			results.push(blocked(entry, error));
		}
	}
	const adapter = navigator.gpu ? await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }) : null;
	const info = adapter?.info;
	return {
		environment: {
			userAgent: navigator.userAgent,
			isSecureContext,
			hardwareConcurrency: navigator.hardwareConcurrency,
			devicePixelRatio: window.devicePixelRatio,
			navigatorGpu: navigator.gpu !== undefined,
			adapter: info
				? {
						vendor: info.vendor,
						architecture: info.architecture,
						device: info.device,
						description: info.description
					}
				: null,
			threeRevision: REVISION
		},
		scenarios: results
	};
}
