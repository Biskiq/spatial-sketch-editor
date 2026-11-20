<script module lang="ts">
	/**
	 * The Stage snapshot's camera, draw and readback, as one exported seam.
	 *
	 * It lives in this component's `module` block rather than a second module so the
	 * host and the function it calls cannot drift: the instance below does nothing
	 * but hold the reused target, encode the bytes and register with the snapshot
	 * service. A unit test can drive the real function with a recording renderer,
	 * which is how "a snapshot is as-built during Lift" is proven without a GPU.
	 *
	 * ## The common renderer's offscreen pass
	 *
	 * The target is one generic `RenderTarget` per ready Stage generation and size:
	 * 640 px wide, the authored aspect, 8-bit linear RGBA, no MSAA. Submission and
	 * the start of the packed async readback happen inside one synchronous state
	 * bracket; the renderer's target, clear, viewport/scissor and the clip state are
	 * restored **before** the copy is awaited, so an in-flight thumbnail never parks
	 * the Stage's live uniforms or blocks a normal onscreen frame.
	 *
	 * Row order comes from the observed backend: the WebGPU copy is top-down, the
	 * WebGL2 copy is bottom-up. The result is normalized to top-down here, so the one
	 * colour writer never has to know which backend produced the bytes.
	 */
	import {
		Color,
		PerspectiveCamera,
		RenderTarget,
		UnsignedByteType,
		Vector4,
		type Scene
	} from 'three';
	import type { WebGPURenderer } from 'three/webgpu';
	import { createViewportCameraState, evaluateViewport, inspectionPoseFromView } from '@portfolio/camera-core';
	import { PAPER_GROUND_INK, STAGE_LIFTED_LAYER, STAGE_WORLD_LAYER } from '../paper-plan';
	import type { SnapshotRequest } from '../stage-snapshots';
	import { realizeEvaluatedCamera } from '$lib/render/camera-realization';
	import type { RendererBackend } from '$lib/render/renderer-backend';

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
		/** The target's linear readback, **top-down**, normalized for this writer. */
		readonly pixels: Uint8Array;
		readonly target: RenderTarget;
	};

	/** The farthest corner of the Stage's own content from the framed target. */
	function contentRadius(bounds: StageSnapshotBounds, target: readonly [number, number, number]): number {
		const x = Math.max(Math.abs(bounds.min[0] - target[0]), Math.abs(bounds.max[0] - target[0]));
		const y = Math.max(Math.abs(bounds.min[1] - target[1]), Math.abs(bounds.max[1] - target[1]));
		const z = Math.max(Math.abs(bounds.min[2] - target[2]), Math.abs(bounds.max[2] - target[2]));
		return Math.max(1, Math.hypot(x, y, z));
	}

	/** Reverse the rows of a tightly packed RGBA buffer. */
	function flipRows(pixels: Uint8Array, width: number, height: number): Uint8Array {
		const rowBytes = width * 4;
		const flipped = new Uint8Array(pixels.length);
		for (let y = 0; y < height; y += 1) {
			flipped.set(pixels.subarray((height - 1 - y) * rowBytes, (height - y) * rowBytes), y * rowBytes);
		}
		return flipped;
	}

	/**
	 * Draw one authored View pose into the reusable offscreen target.
	 *
	 * Every renderer mutation is restored in the `finally`, including when the draw
	 * or the read submission throws, so a snapshot can never leave the Stage's
	 * renderer in a snapshot state.
	 *
	 * `reuse` is the host's target from the previous frame; it is used while its
	 * size still matches and returned in the frame, which is what keeps this an
	 * unchanged one-target render rather than an allocation per snapshot.
	 */
	export async function renderStageSnapshot(
		renderer: WebGPURenderer,
		scene: Scene,
		request: SnapshotRequest,
		bounds: StageSnapshotBounds | null,
		reuse: RenderTarget | null,
		backend: RendererBackend,
		/**
		 * The Stage's clip seam, when the host has one. A snapshot is **as built**: the
		 * seam parks every plane for the duration of the draw and puts the live reading
		 * back afterwards, so a thumbnail taken during a Slice is the world, not the cut.
		 */
		asBuilt: (<T>(render: () => T) => T) | null = null
	): Promise<StageSnapshotFrame | null> {
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
		// The shared realization owns the coordinate system, the clip-Z conversion and
		// the physical inverse for this exact evaluated pose.
		realizeEvaluatedCamera(camera, evaluation, backend);
		// World content only: the Stage's selection, Paper and mark layers are helpers.
		// **Snapshots are as-built**: a lifted overhead is world content, so the
		// snapshot camera includes the lifted layer the Stage camera never enables.
		camera.layers.set(STAGE_WORLD_LAYER);
		camera.layers.enable(STAGE_LIFTED_LAYER);

		let target = reuse;
		if (target === null || target.width !== SNAPSHOT_WIDTH || target.height !== height) {
			target?.dispose();
			target = new RenderTarget(SNAPSHOT_WIDTH, height, {
				type: UnsignedByteType,
				// Target-local pixels, independent of canvas DPR and with no MSAA.
				samples: 0
			});
		}
		const previousTarget = renderer.getRenderTarget();
		const previousColor = renderer.getClearColor(new Color());
		const previousAlpha = renderer.getClearAlpha();
		const previousAutoClear = renderer.autoClear;
		const previousScissorTest = renderer.getScissorTest();
		const previousViewport = renderer.getViewport(new Vector4());
		const previousScissor = renderer.getScissor(new Vector4());
		let copy: Promise<ArrayLike<number> | Uint8Array> | null = null;
		try {
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
			// Start the packed copy while the target is still current, then restore all
			// renderer state before yielding: a pending read must never hold the Stage's
			// live uniforms or its viewport hostage.
			copy = renderer.readRenderTargetPixelsAsync(target, 0, 0, SNAPSHOT_WIDTH, height);
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
		if (copy === null) return null;
		try {
			const raw = await copy;
			const read = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
			const rows = read.length === SNAPSHOT_WIDTH * height * 4
				? read
				: read.subarray(0, SNAPSHOT_WIDTH * height * 4);
			const pixels = backend === 'webgpu' ? rows.slice() : flipRows(rows, SNAPSHOT_WIDTH, height);
			return { camera, width: SNAPSHOT_WIDTH, height, pixels, target };
		} catch {
			return null;
		}
	}
</script>

<script lang="ts">
	/**
	 * The Stage's one snapshot render host.
	 *
	 * It renders an authored View's exact pose through `camera-core` into a
	 * reusable offscreen target on the **existing** renderer: never a second GPU
	 * context, never the active inspection camera, and never a persisted image.
	 * Editor helpers are excluded by the snapshot camera's layer mask, every
	 * renderer mutation is restored before the copy is awaited, and the serial
	 * queue is scoped to this generation so a failed or hung read cannot block a
	 * recovered host.
	 */
	import { onMount, untrack } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import { snapshotDataUrl } from '../snapshot-image';
	import { useStageClip } from '../slice/stage-clip';
	import { invalidateStageSnapshots, registerStageSnapshotRenderer } from '../stage-snapshots';
	import { useCanvasRendererState } from '$lib/render/renderer-context';
	// The module script above is this file's other half: `renderStageSnapshot`,
	// `StageSnapshotFrame` and `RenderTarget` are in scope here, and importing them
	// again is a duplicate identifier. The instance renders through the same
	// function a test can drive.

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
	const rendererState = useCanvasRendererState();
	/** The Canvas's clip, or null outside a Stage Canvas. */
	const stageClip = useStageClip();
	let target: RenderTarget | null = null;
	let inFlight = false;
	let disposed = false;

	async function render(request: SnapshotRequest): Promise<string | null> {
		// One in-flight snapshot per generation: the serial service already queues
		// requests, and a second concurrent target would compete for the same renderer.
		if (inFlight || disposed) return null;
		inFlight = true;
		try {
			const frame = await renderStageSnapshot(
				renderer as unknown as Parameters<typeof renderStageSnapshot>[0],
				scene,
				request,
				bounds,
				target,
				rendererState.backend ?? 'webgl2',
				stageClip === null ? null : (draw) => stageClip.asBuilt(draw)
			);
			if (frame === null || disposed) return null;
			target = frame.target;
			// The target renders linear bytes; the shared writer is the one sRGB encode.
			// Its input is already normalized to top-down by the backend-aware read.
			return snapshotDataUrl(frame.pixels, frame.width, frame.height);
		} finally {
			inFlight = false;
		}
	}

	onMount(() => {
		const unregister = registerStageSnapshotRenderer(render);
		return () => {
			disposed = true;
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
