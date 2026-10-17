<script lang="ts">
	/**
	 * The one renderer Camera of the Stage — a **realizer**, never an authority.
	 *
	 * Every frame it copies the current `ViewportEvaluation`'s own matrices onto the
	 * Three camera and sets the evaluated near/far. It computes no pose, no FOV and
	 * no pixels-per-meter: `tween`, OrbitControls and a second camera state do not
	 * exist here, because the seam's whole guarantee is that the meshes, the
	 * overlays and the pointer rays all come from the same evaluated matrices.
	 */
	import { T, useTask } from '@threlte/core';
	import type { PerspectiveCamera } from 'three';
	import type { ViewportEvaluation } from '@portfolio/camera-core';

	let { evaluation }: { evaluation: ViewportEvaluation | null } = $props();

	let cameraRef: PerspectiveCamera | undefined = $state(undefined);

	// Runs before the render pass each frame, so the evaluated matrices are the
	// ones the meshes are actually drawn with even if Threlte touched the camera.
	useTask(() => {
		const camera = cameraRef;
		if (camera === undefined || evaluation === null) return;
		camera.matrixAutoUpdate = false;
		camera.matrix.fromArray(evaluation.inverseViewMatrix as number[]);
		camera.matrixWorldNeedsUpdate = true;
		camera.near = evaluation.near;
		camera.far = evaluation.far;
		camera.projectionMatrix.fromArray(evaluation.projectionMatrix as number[]);
		camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
		camera.updateMatrixWorld(true);
		camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
	});
</script>

<T.PerspectiveCamera bind:ref={cameraRef} makeDefault fov={50} near={0.1} far={1000} />
