/**
 * The Stage's one clipping seam.
 *
 * A Slice is realized on the GPU, not by toggling meshes or swapping geometry: a
 * mesh is *half drawn*, its shadow is unchanged, and moving the cut is a uniform
 * update rather than a rebuild.
 *
 * ## Two realizations, one predicate
 *
 * A **Level** cut uses Two native planes exactly as SL1 shipped: keep below the cut
 * and, when the depth is finite, keep above the lower bound. A **drawn** cut keeps
 * both native planes at keep-all and uses the finite-segment discard supplied by
 * the material store's clip patch, whose CPU twin is `sliceHides` in `slice-cut.ts`.
 *
 * The material store is born with the fixed two-plane array and the shared shader
 * uniforms before its first material compiles. Neither array length nor the shader
 * patch changes for the Canvas's life, so drawing, moving, Flip and depth only
 * write values: the program count stays flat.
 *
 * ## The sign, stated once
 *
 * Three r187's vertex chunk writes `vClipPosition = -mvPosition.xyz`, the fragment
 * chunk discards where `dot(vClipPosition, plane.xyz) > plane.w`, and
 * `WebGLClipping` uploads each plane in view space as `(normal, constant)`.
 * Substituting, a fragment is discarded where `normal · p + constant < 0` and kept
 * where it is **≥ 0** — exactly `Plane.distanceToPoint(p) ≥ 0`. Every helper here
 * therefore states the inequality it **keeps**, and the constructor asserts the sign
 * so a flip fails loudly in every lane.
 *
 * ## Snapshots are as built
 *
 * `asBuilt(render)` parks the native planes at no-op and the shader mode at `0` for
 * the duration of a snapshot, then restores both in `finally` — re-entrant,
 * exception safe, and never invalidating. Overlay ink is outside the snapshot mask
 * already, so the image is the world as built.
 *
 * ## Shadows
 *
 * `clipShadows` stays `false` and this module never touches it: a shadow map is
 * rendered from the unclipped world, so every caster above the cut still casts
 * exactly as built.
 */
import { Plane, Vector3, type Material } from 'three';
import { getContext, setContext } from 'svelte';
import type { ResolvedSlice } from './slice-cut';
import {
	createSliceClipUniforms,
	restoreSliceClipUniforms,
	snapshotSliceClipUniforms,
	writeSliceClipUniforms,
	type SliceClipUniforms
} from '$lib/render/resources/material-store';

/**
 * Two planes for every reading, so the count never changes.
 *
 * X2's cutaway inherits this seam; if it ever needs more planes it raises this
 * constant once (one compile at load, never at runtime) instead of adding a second
 * clipping path.
 */
export const STAGE_CLIP_PLANE_COUNT = 2;

/** The far distance a no-op plane is parked at; nothing is ever past it. */
export const STAGE_CLIP_KEEP_ALL_CONSTANT = 1e6;

/**
 * A plane that keeps `y ≤ yMax` (discards above it).
 *
 * With `normal = (0, -1, 0)` and `constant = yMax`: kept iff `-y + yMax ≥ 0`.
 */
export function keepBelow(yMax: number): Plane {
	return new Plane(new Vector3(0, -1, 0), yMax);
}

/**
 * A plane that keeps `y ≥ yMin` (discards below it).
 *
 * With `normal = (0, +1, 0)` and `constant = -yMin`: kept iff `y - yMin ≥ 0`.
 */
export function keepAbove(yMin: number): Plane {
	return new Plane(new Vector3(0, 1, 0), -yMin);
}

/** A plane that keeps everything: `y ≥ -1e6`, which no Stage point violates. */
export function keepAll(): Plane {
	return new Plane(new Vector3(0, 1, 0), STAGE_CLIP_KEEP_ALL_CONSTANT);
}

function assertSign(): void {
	const below = keepBelow(0);
	// Kept side: a point one metre *below* the plane must be kept.
	if (!(below.distanceToPoint(new Vector3(0, -1, 0)) > 0)) {
		throw new Error('stage-clip: keepBelow keeps the wrong side of the plane');
	}
	if (!(below.distanceToPoint(new Vector3(0, 1, 0)) < 0)) {
		throw new Error('stage-clip: keepBelow discards the wrong side of the plane');
	}
	const above = keepAbove(0);
	if (!(above.distanceToPoint(new Vector3(0, 1, 0)) > 0)) {
		throw new Error('stage-clip: keepAbove keeps the wrong side of the plane');
	}
}

/** The native plane values a reading implies. */
function nativePlanesOf(resolved: ResolvedSlice | null): readonly Plane[] {
	if (resolved === null || resolved.kind === 'drawn') return [keepAll(), keepAll()];
	return [
		keepBelow(resolved.cutY),
		resolved.lowerY === null ? keepAll() : keepAbove(resolved.lowerY)
	];
}

/** A shader-uniform snapshot for a reading, without touching the live uniforms. */
function shaderStateOf(resolved: ResolvedSlice | null) {
	const scratch = createSliceClipUniforms();
	writeSliceClipUniforms(scratch, resolved?.kind === 'drawn' ? resolved : null);
	return snapshotSliceClipUniforms(scratch);
}

export type StageClip = {
	/** The one array every colour material holds **by reference**. Never replaced. */
	readonly planes: readonly Plane[];
	/** The one uniform object every colour material's compile hook shares. */
	readonly sliceUniforms: SliceClipUniforms;
	/** Apply a resolved reading (or `null` for no Slice). Mutates in place. */
	apply(resolved: ResolvedSlice | null): void;
	/** Render as built: planes and shader no-op for the duration of `render`. */
	asBuilt<T>(render: () => T): T;
	/** Whether a Slice is live. */
	isActive(): boolean;
};

export function createStageClip(): StageClip {
	assertSign();
	const planes: Plane[] = [keepAll(), keepAll()];
	const sliceUniforms = createSliceClipUniforms();
	let depth = 0;
	let savedPlanes: Plane[] | null = null;
	let savedShader: ReturnType<typeof snapshotSliceClipUniforms> | null = null;
	let active = false;

	function write(target: readonly Plane[], values: readonly Plane[]): void {
		target[0]!.copy(values[0]!);
		target[1]!.copy(values[1]!);
	}

	function writeShader(state: ReturnType<typeof snapshotSliceClipUniforms>): void {
		restoreSliceClipUniforms(sliceUniforms, state);
	}

	return {
		planes,
		sliceUniforms,
		apply(resolved) {
			active = resolved !== null;
			const native = nativePlanesOf(resolved);
			const shader = shaderStateOf(resolved);
			// Inside a snapshot render the live values are parked at no-op; the newest
			// reading must win when the snapshot exits, so it is written to the saved
			// state instead of the live one.
			if (depth > 0 && savedPlanes !== null && savedShader !== null) {
				write(savedPlanes, native);
				savedShader = shader;
				return;
			}
			write(planes, native);
			writeShader(shader);
		},
		asBuilt(render) {
			if (depth === 0) {
				savedPlanes = planes.map((plane) => plane.clone());
				savedShader = snapshotSliceClipUniforms(sliceUniforms);
				planes.forEach((plane) => plane.copy(keepAll()));
				sliceUniforms.mode.value = 0;
			}
			depth += 1;
			try {
				return render();
			} finally {
				depth -= 1;
				if (depth === 0 && savedPlanes !== null && savedShader !== null) {
					const restorePlanes = savedPlanes;
					const restoreShader = savedShader;
					savedPlanes = null;
					savedShader = null;
					write(planes, restorePlanes);
					writeShader(restoreShader);
				}
			}
		},
		isActive: () => active
	};
}

/** Whether a material shares this clip's plane array (SL1 test 5's reference identity). */
export function materialUsesClip(material: Material, clip: StageClip): boolean {
	return material.clippingPlanes === (clip.planes as Plane[]);
}

const KEY = Symbol('biskiq.stage-clip');

/** Publish the Canvas's clip to its subtree. Called once, by the Canvas host. */
export function setStageClip(clip: StageClip): StageClip {
	setContext(KEY, clip);
	return clip;
}

/** The nearest Canvas's clip, or `null` outside a Stage Canvas. */
export function useStageClip(): StageClip | null {
	return getContext<StageClip | undefined>(KEY) ?? null;
}
