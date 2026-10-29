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
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Color, type PerspectiveCamera } from 'three';
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import { MAT_BACKGROUND_INK, PAPER_GROUND_INK, stageCameraLayerMask } from '../paper-plan';

	let {
		evaluation,
		paperVisible
	}: {
		evaluation: ViewportEvaluation | null;
		/** Paper masks the world meshes without touching their `visible` flag. */
		paperVisible: boolean;
	} = $props();

	let cameraRef: PerspectiveCamera | undefined = $state(undefined);
	const { invalidate, scene, renderer } = useThrelte();

	// Runs before the render pass each frame, so the evaluated matrices are the
	// ones the meshes are actually drawn with even if Threlte touched the camera.
	//
	// T1.P02.S06 D.6 (H9) — `autoInvalidate: false`: by default a task asks for a
	// frame every time it runs, which made the Stage re-render continuously even
	// at rest (Bench 1: 120 of 120 idle frames). Writing the evaluated matrices
	// is not itself a reason to draw, so a new evaluation asks for exactly one
	// frame below instead.
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
	}, { autoInvalidate: false });

	$effect(() => {
		// One frame per evaluation. Everything else that can change the image (a
		// compile, a Scene resolution, a selection, a pointer overlay) invalidates
		// through Threlte's own reactivity.
		void evaluation;
		invalidate();
	});

	$effect(() => {
		// Appearance is a camera mask, never `Object3D.visible`: the pick source's
		// raycaster keeps its default layer-0 mask and can still hit the undrawn world.
		const camera = cameraRef;
		if (camera === undefined) return;
		camera.layers.disableAll();
		for (const layer of stageCameraLayerMask(paperVisible)) camera.layers.enable(layer);
		invalidate();
	});

	$effect(() => {
		// The surface is its own redraw trigger. Clearing the drawing buffer directly
		// makes the surface an opaque PLATE material rather than a scene object; a
		// settled Shaded Plan has no Paper build or Camera move to request the frame
		// that would otherwise show it.
		scene.background = null;
		renderer.setClearColor(new Color(paperVisible ? PAPER_GROUND_INK : MAT_BACKGROUND_INK), 1);
		invalidate();
	});

	$effect(() => {
		// The mask and surface change together and the mat ground is a conditional
		// child: request the frame after this update has been applied so a settled
		// Shaded Plan cannot keep the previous frame's ground or surface.
		void paperVisible;
		const frame = requestAnimationFrame(() => invalidate());
		return () => cancelAnimationFrame(frame);
	});
</script>

<T.PerspectiveCamera bind:ref={cameraRef} makeDefault fov={50} near={0.1} far={1000} />
