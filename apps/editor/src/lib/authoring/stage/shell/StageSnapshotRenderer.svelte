<script lang="ts">
	/**
	 * R217.S28 — the Stage's one snapshot render host (E10).
	 *
	 * It renders an authored View's exact pose through `camera-core` into a
	 * reusable offscreen target on the **existing** renderer: never a second WebGL
	 * context, never the active inspection camera, and never a persisted image.
	 * Editor helpers are excluded by the snapshot camera's layer mask, and every
	 * renderer mutation is restored in a `finally`, including when the readback
	 * throws.
	 */
	import { onMount } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import { Color, PerspectiveCamera, UnsignedByteType, Vector4, WebGLRenderTarget } from 'three';
	import { createViewportCameraState, evaluateViewport, inspectionPoseFromView } from '@portfolio/camera-core';
	import { MAT_BACKGROUND_INK, STAGE_WORLD_LAYER } from '../paper-plan';
	import {
		invalidateStageSnapshots,
		registerStageSnapshotRenderer,
		type SnapshotRequest
	} from '../stage-snapshots';

	let {
		revision = 0,
		bounds = null
	}: {
		revision?: number;
		bounds?: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] } | null;
	} = $props();

	const WIDTH = 640;
	/** The farthest corner of the Stage's own content from the framed target. */
	function contentRadius(
		box: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] },
		target: readonly [number, number, number]
	): number {
		const x = Math.max(Math.abs(box.min[0] - target[0]), Math.abs(box.max[0] - target[0]));
		const y = Math.max(Math.abs(box.min[1] - target[1]), Math.abs(box.max[1] - target[1]));
		const z = Math.max(Math.abs(box.min[2] - target[2]), Math.abs(box.max[2] - target[2]));
		return Math.max(1, Math.hypot(x, y, z));
	}
	const { scene, renderer } = useThrelte();
	const camera = new PerspectiveCamera();
	let target: WebGLRenderTarget | null = null;

	function toDataUrl(pixels: Uint8Array, width: number, height: number): string | null {
		if (typeof document === 'undefined') return null;
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext('2d');
		if (context === null) return null;
		const image = context.createImageData(width, height);
		// WebGL reads bottom-up; the PNG is top-down.
		for (let y = 0; y < height; y += 1) {
			const from = (height - 1 - y) * width * 4;
			image.data.set(pixels.subarray(from, from + width * 4), y * width * 4);
		}
		for (let index = 3; index < image.data.length; index += 4) image.data[index] = 255;
		context.putImageData(image, 0, 0);
		return canvas.toDataURL('image/png');
	}

	async function render(request: SnapshotRequest): Promise<string | null> {
		const pose = inspectionPoseFromView({
			eye: [request.pose.eye[0], request.pose.eye[1], request.pose.eye[2]],
			target: [request.pose.target[0], request.pose.target[1], request.pose.target[2]],
			fovYDegrees: request.pose.fovDegrees
		});
		if (pose === null) return null;
		const aspect = Number.isFinite(request.aspect) && request.aspect > 0 ? request.aspect : 1.6;
		const height = Math.max(1, Math.round(WIDTH / aspect));
		const targetPoint: [number, number, number] = [
			request.pose.target[0],
			request.pose.target[1],
			request.pose.target[2]
		];
		const sceneRadiusMeters = bounds === null ? 12 : contentRadius(bounds, targetPoint);
		const state = createViewportCameraState({
			outputId: 'experience-snapshot',
			sessionEpoch: 'experience-snapshot',
			sourceRevision: request.sourceRevision,
			pose,
			sceneRadiusMeters,
			reading: '3d'
		});
		const result = evaluateViewport(
			state,
			{ left: 0, top: 0, width: WIDTH, height, devicePixelRatio: 1 },
			0,
			1
		);
		if (result.kind !== 'evaluated') return null;
		const evaluation = result.evaluation;

		camera.matrixAutoUpdate = false;
		camera.matrix.fromArray(evaluation.inverseViewMatrix as number[]);
		camera.matrixWorldNeedsUpdate = true;
		camera.near = evaluation.near;
		camera.far = evaluation.far;
		camera.projectionMatrix.fromArray(evaluation.projectionMatrix as number[]);
		camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
		camera.updateMatrixWorld(true);
		camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
		// World content only: the Stage's selection, Paper and mark layers are helpers.
		camera.layers.set(STAGE_WORLD_LAYER);

		const previousTarget = renderer.getRenderTarget();
		const previousColor = renderer.getClearColor(new Color());
		const previousAlpha = renderer.getClearAlpha();
		const previousAutoClear = renderer.autoClear;
		const previousScissorTest = renderer.getScissorTest();
		const previousViewport = renderer.getViewport(new Vector4());
		const previousScissor = renderer.getScissor(new Vector4());
		try {
			if (target === null || target.width !== WIDTH || target.height !== height) {
				target?.dispose();
				target = new WebGLRenderTarget(WIDTH, height, { type: UnsignedByteType });
			}
			// The renderer's setViewport/setScissor apply the screen DPR even with a
			// render target bound. This target's own viewport is already in target
			// pixels; setRenderTarget installs it without that scaling.
			target.viewport.set(0, 0, WIDTH, height);
			target.scissor.set(0, 0, WIDTH, height);
			target.scissorTest = false;
			renderer.setRenderTarget(target);
			renderer.setClearColor(MAT_BACKGROUND_INK, 1);
			renderer.autoClear = true;
			renderer.clear();
			renderer.render(scene, camera);
			const pixels = new Uint8Array(WIDTH * height * 4);
			renderer.readRenderTargetPixels(target, 0, 0, WIDTH, height, pixels);
			return toDataUrl(pixels, WIDTH, height);
		} catch {
			return null;
		} finally {
			renderer.setRenderTarget(previousTarget);
			renderer.setScissorTest(previousScissorTest);
			renderer.setViewport(previousViewport);
			renderer.setScissor(previousScissor);
			renderer.setClearColor(previousColor, previousAlpha);
			renderer.autoClear = previousAutoClear;
		}
	}

	onMount(() => {
		const unregister = registerStageSnapshotRenderer(render);
		return () => {
			unregister();
			target?.dispose();
			target = null;
		};
	});

	let firstRevision = true;
	$effect(() => {
		void revision;
		if (firstRevision) {
			firstRevision = false;
			return;
		}
		// A newly renderable body, a resolved model or a helper-layer change owes new
		// images; the exact-pose cache can no longer claim to describe the scene.
		invalidateStageSnapshots();
	});
</script>
