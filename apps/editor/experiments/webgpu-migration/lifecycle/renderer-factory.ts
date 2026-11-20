/**
 * The real r187 renderer factory for the PR 1 Canvas comparison.
 *
 * Browser-harness only: no product module imports this file, and it is never in
 * a shipped route or the production bundle. It uses only public Three entry
 * points: `three/webgpu` for the renderer and its node library.
 *
 * Automatic mode asks Three for WebGPU first and lets its internal fallback
 * select the WebGL2 backend. Forced mode constructs the compatibility backend
 * directly. The observed backend is read from the *initialized* renderer, never
 * from the request, so a forced-WebGPU test can prove it did not silently run
 * WebGL2.
 */
import { WebGPURenderer } from 'three/webgpu';
import type { RendererAttempt, RendererBackend } from './generation-owner';
import type { CanvasHostFactory, HostRenderer } from './host-types';

type ThreeRenderer = WebGPURenderer & {
	readonly backend: { readonly isWebGPUBackend?: boolean; readonly isWebGLBackend?: boolean; readonly device?: { destroy(): void } };
};

function asThree(renderer: HostRenderer): ThreeRenderer {
	return renderer as unknown as ThreeRenderer;
}

export function createWebgpuHostFactory(): CanvasHostFactory {
	return {
		create(canvas, mode: RendererAttempt): HostRenderer {
			return new WebGPURenderer({
				canvas,
				antialias: true,
				alpha: true,
				stencil: true,
				powerPreference: 'high-performance',
				// `false` is the automatic WebGPU-first request; forced retries name the
				// compatibility backend explicitly.
				forceWebGL: mode === 'webgl2'
			}) as unknown as HostRenderer;
		},
		init: (renderer) => asThree(renderer).init(),
		backend(renderer): RendererBackend {
			return asThree(renderer).backend.isWebGPUBackend === true ? 'webgpu' : 'webgl2';
		},
		dispose(renderer) {
			return asThree(renderer).dispose();
		},
		onDeviceLost(renderer, listener) {
			const three = asThree(renderer);
			if (three.backend.isWebGLBackend === true) {
				// r187's common Renderer exposes a device-lost callback for WebGPU; the
				// WebGL2 backend relies on the canvas's own context-lost event.
				const canvas = three.domElement;
				const onLost = (event: Event): void => {
					event.preventDefault();
					listener();
				};
				canvas.addEventListener('webglcontextlost', onLost);
				return () => canvas.removeEventListener('webglcontextlost', onLost);
			}
			const previous = three.onDeviceLost;
			three.onDeviceLost = (info: unknown) => {
				previous.call(three, info);
				listener();
			};
			return () => {
				three.onDeviceLost = previous;
			};
		}
	};
}
