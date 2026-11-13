/**
 * Canvas lifetime for Three r186's shared physical-lighting lookup texture.
 * Keep this shim until an automated native two-renderer teardown check can
 * replace its simulated lifecycle coverage; manual browser evidence alone is
 * not enough to prove the survivor guarantee.
 *
 * r186 creates DFG_LUT at module scope and adds a texture-dispose listener for
 * every renderer that uploads it. WebGLRenderer.dispose() leaves those listeners
 * behind, rooting old contexts and canvases. Observe the actual shader uniform
 * through Material's public compilation hook and release its Texture through the
 * public dispose API when a managed Canvas closes. Surviving renderers
 * upload the tiny lookup again on their next ordinary render, as Three supports.
 * This bounds retired-renderer ownership even while another Canvas stays alive.
 *
 * No renderer internals or alternate Three source-module instance are used.
 */
import {
	WebGLRenderer,
	type Camera,
	type Material,
	type Mesh,
	type Object3D,
	type Texture
} from 'three';
import { countWork } from '@portfolio/layout-core';

type PhysicalMaterial = Material & { isMeshStandardMaterial?: boolean };

/** Which Canvas owns the renderer; the frame counter is named for its surface. */
export type ManagedRenderSurface = 'stage' | 'preview';

function physicalMaterials(root: Object3D): Set<Material> {
	const found = new Set<Material>();
	root.traverse((object) => {
		const materials = (object as Mesh).material;
		for (const material of Array.isArray(materials) ? materials : materials ? [materials] : []) {
			if ((material as PhysicalMaterial).isMeshStandardMaterial) found.add(material);
		}
	});
	return found;
}

/** Own an existing renderer; exported separately so lifecycle tests need no GPU. */
export function manageWebGLRenderer(
	renderer: WebGLRenderer,
	surface: ManagedRenderSurface = 'stage'
): WebGLRenderer {
	const sharedLookups = new Set<Texture>();
	const render = renderer.render;
	// The one frame counter. Inert without an observer: no allocation, no branch
	// beyond `countWork`'s own null check. It wraps the original render directly,
	// so it survives the discovery wrapper's self-removal below.
	const managedFrame = function (scene: Object3D, camera: Camera): void {
		countWork(`render:${surface}-frame`);
		render.call(renderer, scene, camera);
	};
	const dispose = renderer.dispose;
	let disposed = false;

	renderer.render = function (scene: Object3D, camera: Camera): void {
		const lookups: { value: Texture | null }[] = [];
		const restore: (() => void)[] = [];
		// Any one material may be invisible, culled or share a cached program.
		// Observe all candidates for this discovery render, then restore every hook.
		for (const material of physicalMaterials(scene)) {
			const compile = material.onBeforeCompile;
			const programKey = material.customProgramCacheKey;
			const key = programKey.call(material);
			material.customProgramCacheKey = () => key;
			material.onBeforeCompile = function (shader, context) {
				compile.call(this, shader, context);
				if (shader.uniforms.dfgLUT) lookups.push(shader.uniforms.dfgLUT);
			};
			restore.push(() => {
				material.onBeforeCompile = compile;
				material.customProgramCacheKey = programKey;
			});
		}
		try {
			managedFrame(scene, camera);
		} finally {
			for (const reset of restore) reset();
			// Three assigns the singleton after compilation, during this render.
			for (const lookup of lookups) {
				if (lookup.value?.isTexture) {
					sharedLookups.add(lookup.value);
					// Ordinary frames have no wrapper or tree walk after discovery.
					renderer.render = managedFrame;
				}
			}
		}
	};
	renderer.dispose = function (): void {
		if (disposed) return;
		disposed = true;
		renderer.render = render;
		try {
			// Texture.dispose releases every renderer's lookup listener. Three's
			// supported reuse path uploads it on the next ordinary render; r186
			// refreshes material uniforms at every render boundary. No survivor
			// state is reset (including live targets, viewport and scissor).
			// The 16x16 lookup reupload happens only at teardown, not per frame.
			for (const texture of sharedLookups) texture.dispose();
			sharedLookups.clear();
		} finally {
			dispose.call(renderer);
		}
	};
	return renderer;
}

/** Same renderer options as Threlte's default factory, with explicit ownership. */
export function createManagedWebGLRenderer(
	canvas: HTMLCanvasElement,
	options: { readonly stencil?: boolean; readonly surface?: ManagedRenderSurface } = {}
): WebGLRenderer {
	const { surface = 'stage', ...rendererOptions } = options;
	return manageWebGLRenderer(new WebGLRenderer({
		canvas, powerPreference: 'high-performance', antialias: true, alpha: true, ...rendererOptions
	}), surface);
}
