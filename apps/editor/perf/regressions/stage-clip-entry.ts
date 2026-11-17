/**
 * Browser-only rendered fixture for the Stage clip seam (SL1 test 14).
 *
 * It builds the real store (`createMaterialStore`) with the real clip
 * (`createStageClip`) on a real WebGL renderer with `localClippingEnabled`, and draws
 * a column of colour bands — one per 0.25 m — so every band can be asserted present
 * or absent by sampling its own row. Nothing here is a measurement: it answers
 * "did the GPU actually discard what the CPU said it would", which no jsdom lane can.
 *
 * Two scenes share the fixture:
 * - `bands`: 14 strips (−0.375 … 2.875 m) in four columns, one per colour kind
 *   (standard, lambert, basic, imported clone), plus a `clip: false` ground strip.
 * - `shadow`: a receiver plane under a caster box spanning 1.0–2.5 m and a shadow
 *   casting sun. The caster is colour-invisible to the camera but still casts, so the
 *   image is receiver + shadow only and an unchanged hash means an unchanged shadow.
 */
import {
	AmbientLight,
	BoxGeometry,
	Color,
	DirectionalLight,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	OrthographicCamera,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	type Material,
	type WebGLRenderer
} from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { createManagedWebGLRenderer } from '../../src/lib/render/managed-webgl-renderer';
import { createMaterialStore, type MaterialLease } from '../../src/lib/render/resources/material-store';
import { createStageClip } from '../../src/lib/authoring/stage/slice/stage-clip';
import type { DrawnResolvedSlice, ResolvedSlice } from '../../src/lib/authoring/stage/slice/slice-cut';

const WIDTH = 800;
const HEIGHT = 600;
const TOP = 3;
const BOTTOM = -0.9;
const COLUMNS = [-1.5, -0.5, 0.5, 1.5] as const;
const BAND_HEIGHT = 0.25;
const BAND_COUNT = 14;
const GROUND_Y = -0.72;
const BACKGROUND = new Color(0x101820);
/** One distinct colour per band, so a band can only be present or absent. */
const BAND_COLORS = [
	'#e8534a',
	'#e8a34a',
	'#dfe84a',
	'#8fe84a',
	'#4ae86b',
	'#4ae8c0',
	'#4ac3e8',
	'#4a7ce8',
	'#7a4ae8',
	'#c04ae8',
	'#e84aa5',
	'#e84a5e',
	'#f0d8b0',
	'#b0e8e0'
] as const;

type Report = {
	/** Colour under each column's centre, per band, as `#rrggbb`. */
	bands: Array<{ y: number; rows: string[] }>;
	/** The `clip: false` surface. */
	ground: string;
	background: string;
	/** FNV-1a over every pixel, for "the same image" assertions. */
	hash: string;
	programs: number;
	error: number;
};

function fixture() {
	const canvas = document.createElement('canvas');
	document.body.append(canvas);
	const renderer = createManagedWebGLRenderer(canvas);
	renderer.setPixelRatio(1);
	renderer.setSize(WIDTH, HEIGHT, false);
	renderer.localClippingEnabled = true;
	renderer.shadowMap.enabled = true;

	const clip = createStageClip();
	const stores: Array<ReturnType<typeof createMaterialStore>> = [];
	const leases: MaterialLease[] = [];
	const geometries: Array<{ dispose(): void }> = [];

	function makeScene(withClipOption: boolean) {
		const store = createMaterialStore(
			withClipOption ? { clippingPlanes: clip.planes as never, sliceClip: clip.sliceUniforms } : {}
		);
		stores.push(store);
		const scene = new Scene();
		scene.background = BACKGROUND;
		scene.add(new AmbientLight(0xffffff, 1));

		// Narrower than the column pitch, so a background sample at the far edge is clear
		// of every quad (and of the antialiased seam at its edge).
		const plane = new PlaneGeometry(0.8, BAND_HEIGHT);
		geometries.push(plane);

		for (let band = 0; band < BAND_COUNT; band += 1) {
			const y = -0.5 + BAND_HEIGHT / 2 + band * BAND_HEIGHT;
			const color = BAND_COLORS[band]!;
			const kinds: Array<{ descriptor: Parameters<typeof store.acquire>[0]; source?: Material }> = [
				{ descriptor: { kind: 'standard', color, roughness: 1, metalness: 0 } },
				{ descriptor: { kind: 'lambert', color } },
				{ descriptor: { kind: 'basic', color } },
				{
					descriptor: { kind: 'imported', asset: 'band.glb', mesh: band, slot: 0, wireframe: false },
					source: new MeshStandardMaterial({ color })
				}
			];
			kinds.forEach((kind, column) => {
				const lease = store.acquire(kind.descriptor, undefined, kind.source);
				leases.push(lease);
				const mesh = new Mesh(plane, lease.material);
				mesh.position.set(COLUMNS[column]!, y, 0);
				scene.add(mesh);
				kind.source?.dispose();
			});
		}

		// The environment ground is `clip: false`: a Slice must never remove it.
		const groundPlane = new PlaneGeometry(3.9, BAND_HEIGHT);
		geometries.push(groundPlane);
		const ground = store.acquire({ kind: 'lambert', color: '#3c4a52', clip: false });
		leases.push(ground);
		const groundMesh = new Mesh(groundPlane, ground.material);
		groundMesh.position.set(0, GROUND_Y, 0);
		scene.add(groundMesh);

		return scene;
	}

	const bands = makeScene(true);
	const plain = makeScene(false);
	const camera = new OrthographicCamera(-2, 2, TOP, BOTTOM, 0.1, 20);
	camera.position.set(0, 0, 6);
	camera.lookAt(0, 0, 0);

	// Shadow scene: the receiver is a clipped Lambert surface, the caster a Standard
	// box spanning 1.0–2.5 m, drawn colour-invisible but still casting.
	const shadowStore = createMaterialStore({ clippingPlanes: clip.planes as never, sliceClip: clip.sliceUniforms });
	stores.push(shadowStore);
	const shadow = new Scene();
	shadow.background = BACKGROUND;
	shadow.add(new AmbientLight(0xffffff, 0.4));
	// Kept wholly on the shown side of the drawn seam, under the caster's shadow,
	// so the colour image proves the shadow pass rather than the receiver's clip.
	const receiverGeometry = new PlaneGeometry(2, 2);
	geometries.push(receiverGeometry);
	const receiverLease = shadowStore.acquire({ kind: 'lambert', color: '#b8b0a4' });
	leases.push(receiverLease);
	const receiver = new Mesh(receiverGeometry, receiverLease.material);
	receiver.rotation.x = -Math.PI / 2;
	receiver.position.set(-0.5, 0, -1.5);
	receiver.receiveShadow = true;
	shadow.add(receiver);
	const casterGeometry = new BoxGeometry(0.8, 1.5, 0.8);
	geometries.push(casterGeometry);
	const casterLease = shadowStore.acquire({ kind: 'standard', color: '#ffffff', roughness: 1, metalness: 0 });
	leases.push(casterLease);
	const caster = new Mesh(casterGeometry, casterLease.material);
	caster.position.set(0.4, 1.75, 0.2);
	caster.castShadow = true;
	(casterLease.material as MeshStandardMaterial).colorWrite = false;
	(casterLease.material as MeshStandardMaterial).depthWrite = false;
	shadow.add(caster);
	const sun = new DirectionalLight(0xffffff, 2.4);
	sun.position.set(2.4, 5, 3.2);
	sun.castShadow = true;
	sun.shadow.mapSize.set(512, 512);
	sun.shadow.camera.left = -4;
	sun.shadow.camera.right = 4;
	sun.shadow.camera.top = 4;
	sun.shadow.camera.bottom = -4;
	sun.shadow.camera.near = 0.5;
	sun.shadow.camera.far = 20;
	sun.shadow.bias = -0.0005;
	shadow.add(sun, sun.target);
	const shadowCamera = new PerspectiveCamera(42, WIDTH / HEIGHT, 0.1, 40);
	shadowCamera.position.set(3.4, 3.2, 6.4);
	shadowCamera.lookAt(0, 0.4, 0);

	// The drawn seam: four material kinds on a grid of cells at three z layers.
	// A segment along x, hidden side +z, half-length 0.9 m and depth 0.15 m makes
	// every cell's expected state a pure predicate question, and the row at x=1.5
	// proves the segment's finite extent (the GPU never sees an infinite plane).
	const DRAWN_X = [-1.5, -0.7, 0.7, 1.5] as const;
	const DRAWN_Z = [-0.4, -0.1, 0.5] as const;
	const DRAWN_Y: Record<number, number> = { [-0.4]: 0.2, [-0.1]: 1, [0.5]: 1.8 };
	const DRAWN_COLORS = ['#e8534a', '#4ac3e8', '#dfe84a', '#c04ae8'] as const;
	const drawnStore = createMaterialStore({ clippingPlanes: clip.planes as never, sliceClip: clip.sliceUniforms });
	stores.push(drawnStore);
	const drawnScene = new Scene();
	drawnScene.background = BACKGROUND;
	drawnScene.add(new AmbientLight(0xffffff, 1));
	const drawnGeometry = new PlaneGeometry(0.32, 0.32);
	geometries.push(drawnGeometry);
	DRAWN_X.forEach((x, column) => {
		const descriptor: Parameters<typeof drawnStore.acquire>[0] =
			column === 0
				? { kind: 'standard', color: DRAWN_COLORS[column], roughness: 1, metalness: 0 }
				: column === 1
					? { kind: 'lambert', color: DRAWN_COLORS[column] }
					: column === 2
						? { kind: 'basic', color: DRAWN_COLORS[column] }
						: { kind: 'imported', asset: 'drawn.glb', mesh: 0, slot: 0, wireframe: false };
		const source = column === 3 ? new MeshStandardMaterial({ color: DRAWN_COLORS[column] }) : undefined;
		const lease = drawnStore.acquire(descriptor, undefined, source);
		leases.push(lease);
		source?.dispose();
		for (const z of DRAWN_Z) {
			const mesh = new Mesh(drawnGeometry, lease.material);
			mesh.position.set(x, DRAWN_Y[z]!, z);
			drawnScene.add(mesh);
		}
	});
	const drawnGroundGeometry = new PlaneGeometry(3.8, 0.16);
	geometries.push(drawnGroundGeometry);
	const drawnGround = drawnStore.acquire({ kind: 'lambert', color: '#3c4a52', clip: false });
	leases.push(drawnGround);
	const drawnGroundMesh = new Mesh(drawnGroundGeometry, drawnGround.material);
	drawnGroundMesh.position.set(0, -0.72, -0.4);
	drawnScene.add(drawnGroundMesh);
	const drawnCamera = new OrthographicCamera(-2, 2, TOP, BOTTOM, 0.1, 20);
	drawnCamera.position.set(0, 0, 6);
	drawnCamera.lookAt(0, 0, 0);
	// Editor ink (selection / Lift): a fat LineMaterial — whose shader has no
	// `project_vertex` chunk — and a basic ghost mesh, both cut through `clipInk`. Two
	// horizontal strokes across the whole extent: one on the hidden side (z = 0.5) and
	// one on the shown side (z = −0.1); the ghost quad sits on the hidden side.
	const inkScene = new Scene();
	inkScene.background = BACKGROUND;
	const inkLineMaterial = clip.clipInk(new LineMaterial({ color: 0xffffff, linewidth: 8 }));
	inkLineMaterial.resolution.set(WIDTH, HEIGHT);
	const inkGhostMaterial = clip.clipInk(new MeshBasicMaterial({ color: 0x40ff40 }));
	const INK_Y: Record<number, number> = { [0.5]: 2.4, [-0.1]: 1.4 };
	for (const z of [0.5, -0.1]) {
		const geometry = new LineGeometry();
		geometry.setPositions([-1.8, INK_Y[z]!, z, 1.8, INK_Y[z]!, z]);
		geometries.push(geometry);
		const line = new Line2(geometry, inkLineMaterial);
		line.computeLineDistances();
		inkScene.add(line);
	}
	const inkGhostGeometry = new PlaneGeometry(3.6, 0.3);
	geometries.push(inkGhostGeometry);
	const inkGhost = new Mesh(inkGhostGeometry, inkGhostMaterial);
	inkGhost.position.set(0, 0.2, 0.5);
	inkScene.add(inkGhost);
	geometries.push(inkLineMaterial, inkGhostMaterial);

		// X2: one cutaway twin wall, its paper cap and a shadow caster. The twin is the
	// same program as the standard surface; only its `uCutawayTopY` binding follows
	// the live cut, so whole → cut must not add a compile.
	const CUTAWAY_TOP = 1;
	const cutawayStore = createMaterialStore({ clippingPlanes: clip.planes as never, sliceClip: clip.sliceUniforms });
	stores.push(cutawayStore);
	const cutawayScene = new Scene();
	cutawayScene.background = BACKGROUND;
	cutawayScene.add(new AmbientLight(0xffffff, 1));
	const cutawayWallGeometry = new BoxGeometry(3, 3, 0.2);
	geometries.push(cutawayWallGeometry);
	const cutawayWallLease = cutawayStore.acquire({
		kind: 'standard',
		color: '#b8a88a',
		roughness: 1,
		metalness: 0,
		cutaway: true
	});
	leases.push(cutawayWallLease);
	const cutawayWall = new Mesh(cutawayWallGeometry, cutawayWallLease.material);
	cutawayWall.position.set(0, 1.5, 0);
	cutawayScene.add(cutawayWall);
	// Centred on y = 1.5 so the frustum covers world y 0…3; the sampler below
	// maps that range directly to framebuffer rows.
	const cutawayCamera = new OrthographicCamera(-2, 2, 1.5, -1.5, 0.1, 20);
	cutawayCamera.position.set(0, 1.5, 6);
	cutawayCamera.lookAt(0, 1.5, 0);

	// The cap is the StageCutawayLayer's horizontal paper, sampled from above so an
	// edge-on camera cannot hide it.
	const cutawayCapScene = new Scene();
	cutawayCapScene.background = BACKGROUND;
	const cutawayCapGeometry = new PlaneGeometry(3, 0.2);
	geometries.push(cutawayCapGeometry);
	const cutawayCapLease = cutawayStore.acquire({ kind: 'basic', color: '#f0d8b0' });
	leases.push(cutawayCapLease);
	const cutawayCap = new Mesh(cutawayCapGeometry, cutawayCapLease.material);
	cutawayCap.rotation.x = -Math.PI / 2;
	cutawayCap.position.set(0, CUTAWAY_TOP, 0);
	cutawayCapScene.add(cutawayCap);
	const cutawayTopCamera = new OrthographicCamera(-2, 2, 2, 0, 0.1, 20);
	cutawayTopCamera.position.set(0, 6, 0);
	cutawayTopCamera.up.set(0, 0, -1);
	cutawayTopCamera.lookAt(0, 0, 0);

	// A twin caster with colour writing off: only the receiver and its shadow are
	// sampled, so an unchanged hash proves the depth pass ignored the cut.
	const cutawayShadowStore = createMaterialStore({ clippingPlanes: clip.planes as never, sliceClip: clip.sliceUniforms });
	stores.push(cutawayShadowStore);
	const cutawayShadowScene = new Scene();
	cutawayShadowScene.background = BACKGROUND;
	cutawayShadowScene.add(new AmbientLight(0xffffff, 0.4));
	const cutawayReceiverGeometry = new PlaneGeometry(2, 2);
	geometries.push(cutawayReceiverGeometry);
	const cutawayReceiverLease = cutawayShadowStore.acquire({ kind: 'lambert', color: '#b8b0a4' });
	leases.push(cutawayReceiverLease);
	const cutawayReceiver = new Mesh(cutawayReceiverGeometry, cutawayReceiverLease.material);
	cutawayReceiver.rotation.x = -Math.PI / 2;
	cutawayReceiver.position.set(-0.5, 0, -1.5);
	cutawayReceiver.receiveShadow = true;
	cutawayShadowScene.add(cutawayReceiver);
	const cutawayCasterLease = cutawayShadowStore.acquire({
		kind: 'standard',
		color: '#ffffff',
		roughness: 1,
		metalness: 0,
		cutaway: true
	});
	leases.push(cutawayCasterLease);
	const cutawayCaster = new Mesh(cutawayWallGeometry, cutawayCasterLease.material);
	cutawayCaster.position.set(0.4, 1.75, 0.2);
	cutawayCaster.scale.set(0.27, 0.5, 4);
	cutawayCaster.castShadow = true;
	(cutawayCaster.material as MeshStandardMaterial).colorWrite = false;
	(cutawayCaster.material as MeshStandardMaterial).depthWrite = false;
	cutawayShadowScene.add(cutawayCaster);
	const cutawaySun = new DirectionalLight(0xffffff, 2.4);
	cutawaySun.position.set(2.4, 5, 3.2);
	cutawaySun.castShadow = true;
	cutawaySun.shadow.mapSize.set(512, 512);
	cutawaySun.shadow.camera.left = -4;
	cutawaySun.shadow.camera.right = 4;
	cutawaySun.shadow.camera.top = 4;
	cutawaySun.shadow.camera.bottom = -4;
	cutawaySun.shadow.camera.near = 0.5;
	cutawaySun.shadow.camera.far = 20;
	cutawaySun.shadow.bias = -0.0005;
	cutawayShadowScene.add(cutawaySun, cutawaySun.target);
	const cutawayShadowCamera = new PerspectiveCamera(42, WIDTH / HEIGHT, 0.1, 40);
	cutawayShadowCamera.position.set(3.4, 3.2, 6.4);
	cutawayShadowCamera.lookAt(0, 0.4, 0);

	const drawnReading = (depthMeters: number, hidden: 'left' | 'right' = 'right'): DrawnResolvedSlice => ({
		kind: 'drawn',
		origin: [0, 0, 0],
		along: [1, 0, 0],
		hiddenNormal: hidden === 'left' ? [0, 0, -1] : [0, 0, 1],
		halfLength: 0.9,
		depthMeters,
		hidden,
		start: [-0.9, 0, 0],
		end: [0.9, 0, 0]
	});

	const pixels = new Uint8Array(WIDTH * HEIGHT * 4);

	/** Render one scene and read the framebuffer with a world-space sampler. */
	function readScene(scene: Scene, view: OrthographicCamera | PerspectiveCamera) {
		renderer.render(scene, view);
		const gl = renderer.getContext();
		gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		const at = (px: number, py: number): string => {
			const x = Math.min(WIDTH - 1, Math.max(0, Math.round(px)));
			const y = Math.min(HEIGHT - 1, Math.max(0, Math.round(py)));
			const index = (y * WIDTH + x) * 4;
			return `#${[pixels[index]!, pixels[index + 1]!, pixels[index + 2]!]
				.map((value) => value.toString(16).padStart(2, '0'))
				.join('')}`;
		};
		let hash = 2166136261;
		let nonBackground: string | null = null;
		for (let index = 0; index < pixels.length; index += 4) {
			const red = pixels[index]!;
			const green = pixels[index + 1]!;
			const blue = pixels[index + 2]!;
			const rgb = (red << 16) | (green << 8) | blue;
			hash = Math.imul(hash ^ rgb, 16777619) >>> 0;
			if (nonBackground === null && (red !== 0x10 || green !== 0x18 || blue !== 0x20)) {
				nonBackground = `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
			}
		}
		return {
			at,
			nonBackground,
			hash: hash.toString(16),
			programs: renderer.info.programs?.length ?? 0,
			error: gl.getError()
		};
	}

	/** Render, and read the default framebuffer before it is composited away. */
	function draw(scene: Scene, view: OrthographicCamera | PerspectiveCamera): Report {
		renderer.render(scene, view);
		const gl = renderer.getContext();
		gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		const at = (x: number, y: number): string => {
			const px = Math.min(WIDTH - 1, Math.max(0, Math.round(x)));
			const py = Math.min(HEIGHT - 1, Math.max(0, Math.round(y)));
			const index = (py * WIDTH + px) * 4;
			return `#${[pixels[index]!, pixels[index + 1]!, pixels[index + 2]!]
				.map((value) => value.toString(16).padStart(2, '0'))
				.join('')}`;
		};
		const columnPixel = (x: number): number => ((x + 2) / 4) * WIDTH;
		const rowPixel = (y: number): number => ((y - BOTTOM) / (TOP - BOTTOM)) * HEIGHT;
		let hash = 2166136261;
		for (let index = 0; index < pixels.length; index += 4) {
			const rgb = (pixels[index]! << 16) | (pixels[index + 1]! << 8) | pixels[index + 2]!;
			hash = Math.imul(hash ^ rgb, 16777619) >>> 0;
		}
		return {
			bands: Array.from({ length: BAND_COUNT }, (_, band) => {
				const y = -0.5 + BAND_HEIGHT / 2 + band * BAND_HEIGHT;
				return { y, rows: COLUMNS.map((x) => at(columnPixel(x), rowPixel(y))) };
			}),
			ground: at(WIDTH / 2, rowPixel(GROUND_Y)),
			background: at(2, rowPixel(2.9)),
			hash: hash.toString(16),
			programs: renderer.info.programs?.length ?? 0,
			error: gl.getError()
		};
	}

	const RENDERER = renderer as WebGLRenderer;
	return {
		/** The band scene. `reading` is applied to the shared planes before drawing. */
		report(reading: ResolvedSlice | null, scene: 'bands' | 'plain' = 'bands'): Report {
			clip.apply(reading);
			return draw(scene === 'plain' ? plain : bands, camera);
		},
		/** The same render, with the planes parked as no-ops for its duration. */
		asBuilt(reading: ResolvedSlice | null): Report {
			clip.apply(reading);
			return clip.asBuilt(() => draw(bands, camera));
		},
		/** The shadow scene's image hash and program count. */
		shadow(reading: ResolvedSlice | null): { hash: string; programs: number; error: number } {
			clip.apply(reading);
			const report = draw(shadow, shadowCamera);
			return { hash: report.hash, programs: report.programs, error: report.error };
		},
		/** The drawn seam: per-cell colour and the whole-image hash/program count. */
		drawn(reading: ResolvedSlice | null): {
			cells: Array<{ x: number; z: number; color: string }>;
			background: string;
			hash: string;
			programs: number;
			error: number;
		} {
			clip.apply(reading);
			renderer.render(drawnScene, drawnCamera);
			const gl = renderer.getContext();
			gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			const at = (x: number, y: number): string => {
				const px = Math.min(WIDTH - 1, Math.max(0, Math.round(x)));
				const py = Math.min(HEIGHT - 1, Math.max(0, Math.round(y)));
				const index = (py * WIDTH + px) * 4;
				return `#${[pixels[index]!, pixels[index + 1]!, pixels[index + 2]!]
					.map((value) => value.toString(16).padStart(2, '0'))
					.join('')}`;
			};
			const columnPixel = (x: number): number => ((x + 2) / 4) * WIDTH;
			const rowPixel = (y: number): number => ((y - BOTTOM) / (TOP - BOTTOM)) * HEIGHT;
			let hash = 2166136261;
			for (let index = 0; index < pixels.length; index += 4) {
				const rgb = (pixels[index]! << 16) | (pixels[index + 1]! << 8) | pixels[index + 2]!;
				hash = Math.imul(hash ^ rgb, 16777619) >>> 0;
			}
			return {
				cells: DRAWN_X.flatMap((x) =>
					DRAWN_Z.map((z) => ({ x, z, color: at(columnPixel(x), rowPixel(DRAWN_Y[z]!)) }))
				),
				background: at(2, rowPixel(2.9)),
				hash: hash.toString(16),
				programs: renderer.info.programs?.length ?? 0,
				error: gl.getError()
			};
		},
		/** The drawn image with its clip parked as built for a snapshot. */
		drawnAsBuilt(reading: ResolvedSlice | null): { hash: string; programs: number; error: number } {
			clip.apply(reading);
			return clip.asBuilt(() => {
				const report = this.drawn(reading);
				return { hash: report.hash, programs: report.programs, error: report.error };
			});
		},
		/** Editor ink under a reading: colour at x = 0.5 (inside) and 1.5 (outside). */
		ink(reading: ResolvedSlice | null): {
			samples: Record<string, string>;
			background: string;
			programs: number;
			error: number;
		} {
			clip.apply(reading);
			renderer.render(inkScene, drawnCamera);
			const gl = renderer.getContext();
			gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			const at = (x: number, y: number): string => {
				const px = Math.round(((x + 2) / 4) * WIDTH);
				const py = Math.round(((y - BOTTOM) / (TOP - BOTTOM)) * HEIGHT);
				const index = (py * WIDTH + px) * 4;
				return `#${[pixels[index]!, pixels[index + 1]!, pixels[index + 2]!]
					.map((value) => value.toString(16).padStart(2, '0'))
					.join('')}`;
			};
			const samples: Record<string, string> = {};
			for (const x of [0.5, 1.5]) {
				samples[`hiddenLine@${x}`] = at(x, INK_Y[0.5]!);
				samples[`shownLine@${x}`] = at(x, INK_Y[-0.1]!);
				samples[`ghost@${x}`] = at(x, 0.2);
			}
			return {
				samples,
				background: at(-1.95, 2.9),
				programs: renderer.info.programs?.length ?? 0,
				error: gl.getError()
			};
		},
		/**
		 * X2's cutaway twin on a real GPU: the same mesh whole and cut above 1 m.
		 * `above`/`below` are front-view samples; `cap` is a paper cap seen from
		 * directly above; `programs` must not move across the cut.
		 */
		cutaway(top: number | null): {
			above: string;
			below: string;
			background: string;
			cap: string;
			hash: string;
			programs: number;
			error: number;
		} {
			clip.setCutawayTop(top);
			const front = readScene(cutawayScene, cutawayCamera);
			// Read every front sample before the cap render reuses the shared pixel
			// buffer; a later `at` would answer from the wrong image.
			const world = (x: number, y: number): string =>
				front.at(((x + 2) / 4) * WIDTH, (y / 3) * HEIGHT);
			const above = world(0, 2);
			const below = world(0, 0.5);
			const background = world(-1.9, 2.5);
			const capShot = readScene(cutawayCapScene, cutawayTopCamera);
			const cap = capShot.nonBackground ?? capShot.at(WIDTH / 2, HEIGHT / 2);
			clip.setCutawayTop(null);
			return {
				above,
				below,
				background,
				cap,
				hash: front.hash,
				programs: front.programs,
				error: front.error
			};
		},
		/** The twin caster's shadow image under a cut top; it must be unchanged. */
		cutawayShadow(top: number | null): { hash: string; programs: number; error: number } {
			clip.setCutawayTop(top);
			const shot = readScene(cutawayShadowScene, cutawayShadowCamera);
			clip.setCutawayTop(null);
			return { hash: shot.hash, programs: shot.programs, error: shot.error };
		},
		/**
		 * X2 + Slice coexistence: applying a Level or Drawn reading must not clear the
		 * cutaway top, so the stub stays cut until X2 itself is turned off.
		 */
		cutawaySlice(reading: ResolvedSlice | null): {
			above: string;
			below: string;
			background: string;
			cap: string;
			programs: number;
			error: number;
		} {
			clip.setCutawayTop(CUTAWAY_TOP);
			clip.apply(reading);
			const front = readScene(cutawayScene, cutawayCamera);
			const world = (x: number, y: number): string =>
				front.at(((x + 2) / 4) * WIDTH, (y / 3) * HEIGHT);
			const above = world(0, 2);
			const below = world(0, 0.5);
			const background = world(-1.9, 2.5);
			const cap = readScene(cutawayCapScene, cutawayTopCamera).nonBackground;
			clip.apply(null);
			clip.setCutawayTop(null);
			return { above, below, background, cap: cap ?? background, programs: front.programs, error: front.error };
		},
		/** 120 stationary frames: one image and one program count, no rebuild. */
		cutawayStationary(frames: number): {
			distinctHashes: number;
			distinctPrograms: number;
			first: string;
			last: string;
			error: number;
		} {
			clip.setCutawayTop(CUTAWAY_TOP);
			const hashes = new Set<string>();
			const programs = new Set<number>();
			let first = '';
			let last = '';
			let error = 0;
			for (let frame = 0; frame < frames; frame += 1) {
				const shot = readScene(cutawayScene, cutawayCamera);
				hashes.add(shot.hash);
				programs.add(shot.programs);
				if (frame === 0) first = shot.hash;
				last = shot.hash;
				error = shot.error;
			}
			clip.setCutawayTop(null);
			return { distinctHashes: hashes.size, distinctPrograms: programs.size, first, last, error };
		},
		/** Put the planes back and report what the renderer still holds. */
		rest(): { programs: number; planes: number; radius: number } {
			clip.apply(null);
			return {
				programs: RENDERER.info.programs?.length ?? 0,
				planes: clip.planes.length,
				radius: Math.round(renderer.getPixelRatio() * 100)
			};
		},
		close(): void {
			for (const lease of leases) lease.release();
			for (const store of stores) store.dispose();
			for (const geometry of geometries) geometry.dispose();
			renderer.dispose();
			canvas.remove();
		}
	};
}

export type StageClipFixture = ReturnType<typeof fixture>;
Object.assign(window, { __STAGE_CLIP__: fixture() });
