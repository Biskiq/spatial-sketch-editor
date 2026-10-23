/** Browser-only correctness fixture for overlapping real WebGL renderer lifetimes. */
import { AmbientLight, SphereGeometry, Color, DirectionalLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, WebGLRenderTarget, WebGLCubeRenderTarget, LinearMipmapLinearFilter, Vector4 } from 'three';
import { createManagedWebGLRenderer } from '../../src/lib/render/managed-webgl-renderer';

export type FixtureOptions = { target?: '2d' | 'cube'; override?: boolean; mip?: number };

function fixture() {
	let next = 0;
	const live = new Map<number, ReturnType<typeof make>>();
	const retired: WeakRef<object>[] = [];
	function make(options: FixtureOptions = {}) {
		const canvas = document.createElement('canvas');
		document.body.append(canvas);
		const renderer = createManagedWebGLRenderer(canvas);
		renderer.setPixelRatio(options.target ? 2 : 1);
		renderer.setSize(96, 96, false);
		const scene = new Scene();
		scene.background = new Color(0x112233);
		const camera = new PerspectiveCamera(45, 1, 0.1, 10);
		camera.position.z = 3;
		const mesh = new Mesh(new SphereGeometry(0.65, 32, 24), new MeshStandardMaterial({ color: 0xd8b689, roughness: 0.3, metalness: 0.25 }));
		mesh.rotation.set(0.3, 0.5, 0);
		const light = new DirectionalLight(0xffffff, 3);
		light.position.set(2, 3, 4);
		scene.add(mesh, light, new AmbientLight(0xffffff, 0.3));
		const target = !options.target ? null : options.target === 'cube'
			? new WebGLCubeRenderTarget(96, { generateMipmaps: true, minFilter: LinearMipmapLinearFilter })
			: new WebGLRenderTarget(96, 96);
		if (target) {
			target.viewport.set(4, 6, 36, 32);
			target.scissor.set(7, 9, 26, 24);
			target.scissorTest = true;
			renderer.setRenderTarget(target, options.target === 'cube' ? 2 : 0, 0);
			if (options.mip) {
				renderer.render(scene, camera);
				renderer.setRenderTarget(target, 2, options.mip);
			}
			if (options.override) {
				renderer.setViewport(3, 5, 38, 40);
				renderer.setScissor(4, 6, 32, 34);
				renderer.setScissorTest(false);
			}
		}
		return { canvas, renderer, scene, camera, mesh, target, lastDrawMs: 0 };
	}
	function draw(id: number) {
		const owner = live.get(id)!;
		const started = performance.now();
		owner.renderer.render(owner.scene, owner.camera);
		owner.lastDrawMs = performance.now() - started;
		// Read synchronously before compositing clears the default drawing buffer.
		const gl = owner.renderer.getContext();
		const size = owner.target ? 96 >> owner.renderer.getActiveMipmapLevel() : 96;
		const pixels = new Uint8Array(size * size * 4);
		gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		let hash = 2166136261;
		const colors = new Set<number>();
		for (let index = 0; index < pixels.length; index += 4) {
			const rgb = (pixels[index]! << 16) | (pixels[index + 1]! << 8) | pixels[index + 2]!;
			colors.add(rgb);
			hash = Math.imul(hash ^ rgb, 16777619) >>> 0;
		}
		return { hash, colors: colors.size, textures: owner.renderer.info.memory.textures, error: gl.getError(),
			targetMatches: owner.renderer.getRenderTarget() === owner.target,
			face: owner.renderer.getActiveCubeFace(), mip: owner.renderer.getActiveMipmapLevel(),
			viewport: owner.renderer.getViewport(new Vector4()).toArray(),
			scissor: owner.renderer.getScissor(new Vector4()).toArray(),
			scissorTest: owner.renderer.getScissorTest(),
			boundViewport: Array.from(gl.getParameter(gl.VIEWPORT) as Int32Array),
			boundScissor: Array.from(gl.getParameter(gl.SCISSOR_BOX) as Int32Array),
			boundScissorTest: gl.isEnabled(gl.SCISSOR_TEST)
		};
	}
	function close(id: number) {
		const owner = live.get(id)!;
		retired.push(new WeakRef(owner.canvas), new WeakRef(owner.renderer), new WeakRef(owner.scene));
		live.delete(id);
		owner.mesh.geometry.dispose();
		owner.mesh.material.dispose();
		owner.target?.dispose();
		owner.renderer.dispose();
		owner.canvas.remove();
	}
	return {
		open: (options?: FixtureOptions) => { const id = next++; live.set(id, make(options)); return id; },
		draw, close,
		stats: (id: number) => ({ textures: live.get(id)!.renderer.info.memory.textures, lastDrawMs: live.get(id)!.lastDrawMs }),
		collected: () => retired.every((reference) => reference.deref() === undefined),
		closeAll: () => { for (const id of [...live.keys()]) close(id); }
	};
}
export type RendererLifetimeFixture = ReturnType<typeof fixture>;
Object.assign(window, { __RENDERER_LIFETIME__: fixture() });
