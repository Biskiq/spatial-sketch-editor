<script module lang="ts">
	/**
	 * The Stage snapshot's camera, draw and readback, as one exported seam.
	 *
	 * It lives in this component's `module` block rather than a second module so the
	 * host and the function it calls cannot drift: the instance below does nothing
	 * but hold the reused target, encode the bytes and register with the snapshot
	 * service. A unit test can drive the real function with a recording renderer,
	 * which is how "a snapshot is as-built during Lift" is proven without a WebGL
	 * context.
	 */
	import {
		Color,
		PerspectiveCamera,
		UnsignedByteType,
		Vector4,
		WebGLRenderTarget,
		type Scene,
		type WebGLRenderer
	} from 'three';
	import { createViewportCameraState, evaluateViewport, inspectionPoseFromView } from '@portfolio/camera-core';
	import { PAPER_GROUND_INK, STAGE_LIFTED_LAYER, STAGE_WORLD_LAYER } from '../paper-plan';
	import type { SnapshotRequest } from '../stage-snapshots';

	export const SNAPSHOT_WIDTH = 640;

	export type StageSnapshotBounds = {
		readonly min: readonly [number, number, number];
		readonly max: readonly [number, number, number];
	};

	/** One drawn frame: its camera (for a mask assertion), the target to reuse and its linear bytes. */
	export type StageSnapshotFrame = {
		readonly camera: PerspectiveCamera;
		readonly width: number;
		readonly height: number;
		/** The target's linear readback, bottom-up, exactly as the renderer read it. */
		readonly pixels: Uint8Array;
		readonly target: WebGLRenderTarget;
	};

	/** The farthest corner of the Stage's own content from the framed target. */
	function contentRadius(bounds: StageSnapshotBounds, target: readonly [number, number, number]): number {
		const x = Math.max(Math.abs(bounds.min[0] - target[0]), Math.abs(bounds.max[0] - target[0]));
		const y = Math.max(Math.abs(bounds.min[1] - target[1]), Math.abs(bounds.max[1] - target[1]));
		const z = Math.max(Math.abs(bounds.min[2] - target[2]), Math.abs(bounds.max[2] - target[2]));
		return Math.max(1, Math.hypot(x, y, z));
	}

	/**
	 * Draw one authored View pose into the reusable offscreen target.
	 *
	 * Every renderer mutation is restored in the `finally`, including when the
	 * readback throws, so a snapshot can never leave the Stage's renderer in a
	 * snapshot state.
	 *
	 * `reuse` is the host's target from the previous frame; it is used while its
	 * size still matches and returned in the frame, which is what keeps this an
	 * unchanged one-target render rather than an allocation per snapshot.
	 */
	export function renderStageSnapshot(
		renderer: WebGLRenderer,
		scene: Scene,
		request: SnapshotRequest,
		bounds: StageSnapshotBounds | null,
		reuse: WebGLRenderTarget | null = null,
		/**
		 * The Stage's clip seam, when the host has one. A snapshot is **as built**: the
		 * seam parks every plane for the duration of the draw and puts the live reading
		 * back afterwards, so a thumbnail taken during a Slice is the world, not the cut.
		 */
		asBuilt: (<T>(render: () => T) => T) | null = null
	): StageSnapshotFrame | null {
		const pose = inspectionPoseFromView({
			eye: [request.pose.eye[0], request.pose.eye[1], request.pose.eye[2]],
			target: [request.pose.target[0], request.pose.target[1], request.pose.target[2]],
			fovYDegrees: request.pose.fovDegrees
		});
		if (pose === null) return null;
		const aspect = Number.isFinite(request.aspect) && request.aspect > 0 ? request.aspect : 1.6;
		const height = Math.max(1, Math.round(SNAPSHOT_WIDTH / aspect));
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
			{ left: 0, top: 0, width: SNAPSHOT_WIDTH, height, devicePixelRatio: 1 },
			0,
			1
		);
		if (result.kind !== 'evaluated') return null;
		const evaluation = result.evaluation;

		const camera = new PerspectiveCamera();
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
		// **Snapshots are as-built**: a lifted overhead is world content, so the
		// snapshot camera includes the lifted layer the Stage camera never enables.
		camera.layers.set(STAGE_WORLD_LAYER);
		camera.layers.enable(STAGE_LIFTED_LAYER);

		let target = reuse;
		if (target === null || target.width !== SNAPSHOT_WIDTH || target.height !== height) {
			target?.dispose();
			target = new WebGLRenderTarget(SNAPSHOT_WIDTH, height, { type: UnsignedByteType });
		}
		const previousTarget = renderer.getRenderTarget();
		const previousColor = renderer.getClearColor(new Color());
		const previousAlpha = renderer.getClearAlpha();
		const previousAutoClear = renderer.autoClear;
		const previousScissorTest = renderer.getScissorTest();
		const previousViewport = renderer.getViewport(new Vector4());
		const previousScissor = renderer.getScissor(new Vector4());
		try {
			// This target's viewport is already in target pixels. r187 applies screen
			// DPR in setViewport/setScissor only on the default framebuffer;
			// setRenderTarget installs this viewport without scaling it.
			target.viewport.set(0, 0, SNAPSHOT_WIDTH, height);
			target.scissor.set(0, 0, SNAPSHOT_WIDTH, height);
			target.scissorTest = false;
			renderer.setRenderTarget(target);
			// Snapshots read as the Stage: Paper behind the World, never the mat.
			renderer.setClearColor(PAPER_GROUND_INK, 1);
			renderer.autoClear = true;
			renderer.clear();
			if (asBuilt === null) renderer.render(scene, camera);
			else asBuilt(() => renderer.render(scene, camera));
			const pixels = new Uint8Array(SNAPSHOT_WIDTH * height * 4);
			renderer.readRenderTargetPixels(target, 0, 0, SNAPSHOT_WIDTH, height, pixels);
			return { camera, width: SNAPSHOT_WIDTH, height, pixels, target };
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
</script>

<script lang="ts">
	/**
	 * The Stage's one snapshot render host.
	 *
	 * It renders an authored View's exact pose through `camera-core` into a
	 * reusable offscreen target on the **existing** renderer: never a second WebGL
	 * context, never the active inspection camera, and never a persisted image.
	 * Editor helpers are excluded by the snapshot camera's layer mask, and every
	 * renderer mutation is restored in a `finally`, including when the readback
	 * throws.
	 */
	import { onMount, untrack } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import { snapshotDataUrl } from '../snapshot-image';
	import { useStageClip } from '../slice/stage-clip';
	import { invalidateStageSnapshots, registerStageSnapshotRenderer } from '../stage-snapshots';
	// The module script above is this file's other half: `renderStageSnapshot`,
	// `StageSnapshotBounds`, `SnapshotRequest` and `WebGLRenderTarget` are in scope
	// here, and importing them again is a duplicate identifier. The instance renders
	// through the same function a test can drive.

	let {
		revision = 0,
		bounds = null,
		environment = 'paper'
	}: {
		revision?: number;
		/** The Sky the Stage shows, by content (an edited Sky differs from its preset); a change owes every snapshot a new image. */
		environment?: string;
		bounds?: StageSnapshotBounds | null;
	} = $props();

	const { scene, renderer } = useThrelte();
	/** The Canvas's clip, or null outside a Stage Canvas. */
	const stageClip = useStageClip();
	let target: WebGLRenderTarget | null = null;

	async function render(request: SnapshotRequest): Promise<string | null> {
		const frame = renderStageSnapshot(
			renderer,
			scene,
			request,
			bounds,
			target,
			stageClip === null ? null : (render) => stageClip.asBuilt(render)
		);
		if (frame === null) return null;
		target = frame.target;
		// The target renders linear bytes (r187 ignores a non-XR target's texture
		// colour space); the shared writer is the one sRGB encode.
		return snapshotDataUrl(frame.pixels, frame.width, frame.height);
	}

	onMount(() => {
		const unregister = registerStageSnapshotRenderer(render);
		return () => {
			unregister();
			target?.dispose();
			target = null;
		};
	});

	let lastRevision: string | null = null;
	let pendingFrame = 0;
	onMount(() => () => cancelAnimationFrame(pendingFrame));
	$effect(() => {
		const next = `${revision}:${environment}`;
		untrack(() => {
			if (lastRevision === null) {
				lastRevision = next;
				return;
			}
			if (next === lastRevision) return;
			lastRevision = next;
			// A newly renderable body, a resolved model or a helper-layer change owes new
			// images. Mounting a Stage bumps the revision once per body, so the
			// invalidation is coalesced to one per frame and never runs inside this
			// effect: slots that re-request cannot feed back into the same flush.
			if (pendingFrame !== 0) return;
			pendingFrame = requestAnimationFrame(() => {
				pendingFrame = 0;
				invalidateStageSnapshots();
			});
		});
	});
</script>
