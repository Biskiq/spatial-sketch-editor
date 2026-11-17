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
	MeshStandardMaterial,
	OrthographicCamera,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	type Material,
	type WebGLRenderer
} from 'three';
import { createManagedWebGLRenderer } from '../../src/lib/render/managed-webgl-renderer';
import { createMaterialStore, type MaterialLease } from '../../src/lib/render/resources/material-store';
import { createStageClip } from '../../src/lib/authoring/stage/slice/stage-clip';
import type { ResolvedSlice } from '../../src/lib/authoring/stage/slice/slice-cut';

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
		const store = createMaterialStore(withClipOption ? { clippingPlanes: clip.planes as never } : {});
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
	const shadowStore = createMaterialStore({ clippingPlanes: clip.planes as never });
	stores.push(shadowStore);
	const shadow = new Scene();
	shadow.background = BACKGROUND;
	shadow.add(new AmbientLight(0xffffff, 0.4));
	const receiverGeometry = new PlaneGeometry(8, 8);
	geometries.push(receiverGeometry);
	const receiverLease = shadowStore.acquire({ kind: 'lambert', color: '#b8b0a4' });
	leases.push(receiverLease);
	const receiver = new Mesh(receiverGeometry, receiverLease.material);
	receiver.rotation.x = -Math.PI / 2;
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

	const pixels = new Uint8Array(WIDTH * HEIGHT * 4);

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
