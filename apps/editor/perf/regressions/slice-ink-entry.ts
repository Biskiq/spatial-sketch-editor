/**
 * Browser-only rendered fixture for the Slice's **ink** (SL1 tests 11, 14 and the
 * cap surface): the ghost, the clipped contour and the cap fill, on real WebGL.
 *
 * A jsdom lane can prove the wiring (`slice-ink-wiring.test.ts`) and the classifier
 * (`slice-ghost.test.ts`), but not that any of it reaches pixels: a material that
 * forgets its planes, a cap drawn under the plane it caps, a ghost drawn clipped —
 * all of them pass a source assertion and fail the eye. This fixture draws the same
 * ink the Stage draws, from the same modules, and samples the result:
 *
 * - the **cap** is the real `sectionMeshes` → `capFillsOf` → `ShapeGeometry` path,
 *   at the plane the layer draws it on, in the shared `SLICE_INK` palette;
 * - the **ghost** is the wall-hidden subject's own geometry with the shipped ghost
 *   material (unclipped, `ghostOpacity`), and it is drawn only while a cut exists;
 * - the **contours** are two `Line2`s with the same gold tone — one holding the
 *   Canvas's plane array, one without (the ghost's exemption) — so the difference
 *   between "clipped with its subject" and "left uncut" is visible side by side.
 *
 * It also answers the cap **pick**: a downward ray at the wall column must hit the
 * cap at `cutY`, and only while a cut exists.
 */
import {
	AmbientLight,
	Color,
	DoubleSide,
	BoxGeometry,
	Mesh,
	MeshBasicMaterial,
	OrthographicCamera,
	Raycaster,
	Scene,
	Shape,
	ShapeGeometry,
	Vector2,
	Vector3
} from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { createManagedWebGLRenderer } from '../../src/lib/render/managed-webgl-renderer';
import { createMaterialStore, type MaterialLease } from '../../src/lib/render/resources/material-store';
import { createStageClip } from '../../src/lib/authoring/stage/slice/stage-clip';
import type { ResolvedSlice } from '../../src/lib/authoring/stage/slice/slice-cut';
import { sectionMeshes } from '../../src/lib/authoring/stage/slice/mesh-plane-section';
import { capFillsOf } from '../../src/lib/authoring/stage/slice/slice-cap-shapes';
import { SLICE_INK } from '../../src/lib/authoring/stage/slice/slice-ink';

const WIDTH = 800;
const HEIGHT = 600;
const BACKGROUND = new Color(0x101820);
const WALL = { x: -1.2, height: 3, thickness: 0.5 } as const;
/** A subject wholly above the cut: the thing a ghost exists for. */
const HIDDEN = { x: 0.1, y: 2.0, size: 0.6 } as const;
/** The unclipped twin's edge, so the two contours can be sampled apart. */
const UNCLIPPED_EDGE_X = 1.6;
const CUT_Y = 1.2;

type Report = {
	/** Sampled colours, keyed by what they are. */
	pixels: Record<string, string>;
	background: string;
	/** The cap surface exists and was hit by a downward ray, at this height. */
	capPickY: number | null;
	/** FNV-1a over the frame, so "the same image" is assertable. */
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

	const clip = createStageClip();
	const store = createMaterialStore({ clippingPlanes: clip.planes as never });
	const leases: MaterialLease[] = [];
	const disposables: Array<{ dispose(): void }> = [];

	const scene = new Scene();
	scene.background = BACKGROUND;
	scene.add(new AmbientLight(0xffffff, 1.6));

	// --- the Wall body, drawn through the store so the planes clip it ------------
	const wallGeometry = new BoxGeometry(WALL.thickness, WALL.height, WALL.thickness);
	disposables.push(wallGeometry);
	const wallLease = store.acquire({ kind: 'lambert', color: '#cfc8bb' });
	leases.push(wallLease);
	const wall = new Mesh(wallGeometry, wallLease.material);
	wall.position.set(WALL.x, WALL.height / 2 - 0.5, 0);
	wall.updateMatrixWorld(true);
	scene.add(wall);

	// --- the hidden subject: clipped in the world, ghosted outside it ------------
	const hiddenGeometry = new BoxGeometry(HIDDEN.size, HIDDEN.size, HIDDEN.size);
	disposables.push(hiddenGeometry);
	const hiddenLease = store.acquire({ kind: 'standard', color: '#ffffff', roughness: 1, metalness: 0 });
	leases.push(hiddenLease);
	const hiddenWorld = new Mesh(hiddenGeometry, hiddenLease.material);
	hiddenWorld.position.set(HIDDEN.x, HIDDEN.y, 0);
	scene.add(hiddenWorld);

	const ghostMaterial = new MeshBasicMaterial({
		color: SLICE_INK.ghost,
		transparent: true,
		opacity: SLICE_INK.ghostOpacity,
		depthWrite: false,
		toneMapped: false
	});
	disposables.push(ghostMaterial);
	const ghost = new Mesh(hiddenGeometry, ghostMaterial);
	ghost.position.copy(hiddenWorld.position);
	scene.add(ghost);
	/** An opaque copy, only ever used to prove the shipped ghost is translucent. */
	const opaqueGhostMaterial = new MeshBasicMaterial({ color: SLICE_INK.ghost, toneMapped: false });
	disposables.push(opaqueGhostMaterial);
	const opaqueGhost = new Mesh(hiddenGeometry, opaqueGhostMaterial);
	opaqueGhost.position.copy(hiddenWorld.position);
	scene.add(opaqueGhost);

	// --- two contours: clipped with the subject, and the ghost's exemption --------
	function contour(edgeX: number, clipped: boolean): Line2 {
		// One face of the Wall, as a closed rectangle: the contour the selection ink
		// would trace, drawn fat enough to sample a pixel row through it.
		const bottom = -0.5;
		const top = WALL.height - 0.5;
		const half = WALL.thickness / 2;
		const positions: number[] = [];
		const quad: Array<[number, number, number]> = [
			[edgeX - half, bottom, half],
			[edgeX + half, bottom, half],
			[edgeX + half, top, half],
			[edgeX - half, top, half]
		];
		for (let index = 0; index < quad.length; index += 1) {
			positions.push(...quad[index]!, ...quad[(index + 1) % quad.length]!);
		}
		const geometry = new LineGeometry();
		geometry.setPositions(positions);
		const material = new LineMaterial({
			color: SLICE_INK.plane,
			linewidth: 6,
			toneMapped: false,
			depthWrite: false,
			resolution: new Vector2(WIDTH, HEIGHT),
			...(clipped ? { clippingPlanes: clip.planes as never } : {})
		});
		disposables.push(geometry, material);
		const line = new Line2(geometry, material);
		line.computeLineDistances();
		line.frustumCulled = false;
		return line;
	}
	const clippedContour = contour(WALL.x, true);
	const unclippedContour = contour(UNCLIPPED_EDGE_X, false);
	scene.add(clippedContour, unclippedContour);

	// --- the cap, rebuilt for each reading from the Wall's own mesh --------------
	const capMaterial = new MeshBasicMaterial({
		color: SLICE_INK.cap,
		side: DoubleSide,
		depthWrite: false,
		toneMapped: false,
		polygonOffset: true,
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -1
	});
	disposables.push(capMaterial);
	let caps: Mesh[] = [];

	function releaseCaps(): void {
		for (const mesh of caps) {
			scene.remove(mesh);
			disposables.push(mesh.geometry);
			mesh.geometry.dispose();
		}
		caps = [];
	}

	/** The layer's own construction: section → fills → ShapeGeometry in the plane's basis. */
	function buildCaps(cutY: number): number {
		releaseCaps();
		const result = sectionMeshes(
			[
				{
					identity: `wall:fixture`,
					group: 'layout-structure',
					positions: wallGeometry.getAttribute('position').array,
					index: wallGeometry.getIndex()!.array,
					matrix: wall.matrixWorld.elements
				}
			],
			{ normal: [0, -1, 0], constant: cutY }
		);
		const group = result.groups[0];
		if (group === undefined) return 0;
		const originXZ: [number, number] = [result.basis.origin[0], result.basis.origin[2]];
		let built = 0;
		for (const fill of capFillsOf(group.loops)) {
			const shape = new Shape();
			fill.outer.forEach(([u, v], index) => (index === 0 ? shape.moveTo(u, v) : shape.lineTo(u, v)));
			shape.closePath();
			for (const hole of fill.holes) {
				const path = new Shape();
				hole.forEach(([u, v], index) => (index === 0 ? path.moveTo(u, v) : path.lineTo(u, v)));
				path.closePath();
				shape.holes.push(path);
			}
			const geometry = new ShapeGeometry(shape);
			const mesh = new Mesh(geometry, capMaterial);
			mesh.matrixAutoUpdate = false;
			mesh.matrix
				.makeBasis(
					new Vector3(...result.basis.u),
					new Vector3(...result.basis.v),
					new Vector3(...result.basis.normal)
				)
				.setPosition(originXZ[0], cutY, originXZ[1]);
			mesh.updateMatrixWorld(true);
			scene.add(mesh);
			caps.push(mesh);
			built += 1;
		}
		return built;
	}

	// --- the yellow plane, drawn so the fixture shows the same reading the Stage does
	const planeMaterial = new MeshBasicMaterial({
		color: SLICE_INK.plane,
		transparent: true,
		opacity: SLICE_INK.planeOpacity,
		depthWrite: false,
		toneMapped: false
	});
	disposables.push(planeMaterial);
	const planeGeometry = new BoxGeometry(4.2, 0.001, 3);
	disposables.push(planeGeometry);
	const plane = new Mesh(planeGeometry, planeMaterial);
	plane.visible = false;
	scene.add(plane);

	const camera = new OrthographicCamera(-2.4, 2.4, 2.9, -1.1, 0.1, 40);
	camera.position.set(0.2, 3.4, 6.4);
	camera.lookAt(0.2, 0.6, 0);
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
	const projected = new Vector3();

	/** The pixel under a world point, as `[x, y]` in device pixels (origin bottom-left). */
	function pixelOf(point: readonly [number, number, number]): [number, number] {
		projected.set(point[0], point[1], point[2]).project(camera);
		return [((projected.x + 1) / 2) * WIDTH, ((projected.y + 1) / 2) * HEIGHT];
	}

	function at(x: number, y: number): string {
		const px = Math.min(WIDTH - 1, Math.max(0, Math.round(x)));
		const py = Math.min(HEIGHT - 1, Math.max(0, Math.round(y)));
		const index = (py * WIDTH + px) * 4;
		return `#${[pixels[index]!, pixels[index + 1]!, pixels[index + 2]!]
			.map((value) => value.toString(16).padStart(2, '0'))
			.join('')}`;
	}

	function draw(): { hash: string; programs: number; error: number } {
		renderer.render(scene, camera);
		const gl = renderer.getContext();
		gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		let hash = 2166136261;
		for (let index = 0; index < pixels.length; index += 4) {
			const rgb = (pixels[index]! << 16) | (pixels[index + 1]! << 8) | pixels[index + 2]!;
			hash = Math.imul(hash ^ rgb, 16777619) >>> 0;
		}
		return { hash: hash.toString(16), programs: renderer.info.programs?.length ?? 0, error: gl.getError() };
	}

	function apply(reading: ResolvedSlice | null): void {
		clip.apply(reading);
		const cut = reading !== null;
		// The ghost exists only where the cut hides the subject: that is the rule.
		ghost.visible = cut;
		opaqueGhost.visible = false;
		plane.visible = cut;
		if (reading !== null) plane.position.set(0.2, reading.cutY, 0);
		if (cut) buildCaps(reading.cutY);
		else releaseCaps();
	}

	/** A downward ray at the Wall's own column: it must land on the cap, if any. */
	function capPick(): number | null {
		const raycaster = new Raycaster(new Vector3(WALL.x, 5, 0), new Vector3(0, -1, 0), 0, 50);
		const hits = raycaster.intersectObjects(caps, false);
		return hits.length === 0 ? null : hits[0]!.point.y;
	}

	return {
		/** Draw with `reading` applied; `samples` are the world points to read back. */
		report(reading: ResolvedSlice | null): Report {
			apply(reading);
			const image = draw();
			const samples: Record<string, [number, number, number]> = {
				// Inside the Wall's volume, above the cut: the body must be gone.
				wallAbove: [WALL.x, 2.0, 0],
				// Below the cut: still drawn.
				wallBelow: [WALL.x, 0.2, 0],
				// On the exposed section: the paper cap.
				cap: [WALL.x, CUT_Y, 0],
				// The hidden subject's centre: the ghost, and nothing in the world.
				ghost: [HIDDEN.x, HIDDEN.y, 0],
				// The clipped contour above the cut, and the unclipped twin.
				clippedContourAbove: [WALL.x - WALL.thickness / 2, 2.0, WALL.thickness / 2],
				unclippedContourAbove: [UNCLIPPED_EDGE_X - WALL.thickness / 2, 2.0, WALL.thickness / 2],
				background: [2.2, 2.7, 0]
			};
			const read: Record<string, string> = {};
			for (const [name, point] of Object.entries(samples)) {
				const [x, y] = pixelOf(point);
				read[name] = at(x, y);
			}
			return {
				pixels: read,
				background: read.background!,
				capPickY: capPick(),
				...image
			};
		},
		/** The same frame with the ghost drawn opaque: proves the shipped ghost is not. */
		opaqueGhost(reading: ResolvedSlice | null): string {
			apply(reading);
			opaqueGhost.visible = true;
			draw();
			const [x, y] = pixelOf([HIDDEN.x, HIDDEN.y, 0]);
			return at(x, y);
		},
		/** The cap pick with no reading at all. */
		restPick(): number | null {
			apply(null);
			draw();
			return capPick();
		},
		/** How many cap polygons the assembly produced, for the record. */
		counts(): { caps: number; programs: number; error: number } {
			const image = draw();
			return { caps: caps.length, programs: image.programs, error: image.error };
		},
		close(): void {
			for (const lease of leases) lease.release();
			store.dispose();
			for (const disposable of disposables) disposable.dispose();
			renderer.dispose();
			canvas.remove();
		}
	};
}

export type SliceInkFixture = ReturnType<typeof fixture>;
Object.assign(window, { __SLICE_INK__: fixture() });
