/**
 * The Stage's one clipping seam.
 *
 * A Slice is realized on the GPU, not by toggling meshes or swapping geometry: a
 * mesh is *half drawn*, its shadow is unchanged, and moving the cut is a uniform
 * update rather than a rebuild.
 *
 * ## Two realizations, one predicate
 *
 * A **Level** cut uses the two native clipping planes exactly as SL1 shipped:
 * keep below the cut and, when the depth is finite, keep above the lower bound.
 * A **drawn** cut keeps both native planes at keep-all and uses the finite-segment
 * discard supplied by the one TSL predicate (`slice-clip-mask.ts`), whose CPU twin
 * is `sliceHides` in `slice-cut.ts`.
 *
 * The material store is born with the fixed two-plane array and the shared mask
 * before its first material is built. Neither array length nor the predicate
 * changes for the Canvas's life, so drawing, moving, Flip and depth only write
 * values: the pipeline count stays flat.
 *
 * ## The sign, stated once
 *
 * Three's clipping context discards where `normal · p + constant < 0` and keeps
 * where it is **≥ 0** — exactly `Plane.distanceToPoint(p) ≥ 0`. Every helper here
 * therefore states the inequality it **keeps**, and the constructor asserts the
 * sign so a flip fails loudly in every lane. The common renderer's clipping is
 * enabled by the presence of `material.clippingPlanes`; there is no
 * `localClippingEnabled` switch on r187's renderer.
 *
 * ## Snapshots are as built
 *
 * `asBuilt(render)` parks the native planes at no-op, the mask mode at `0` and
 * X2's cutaway top at never-cut for the duration of a snapshot, then restores them
 * in `finally` — re-entrant, exception safe, and never invalidating. Overlay ink is
 * outside the snapshot mask already, so the image is the world as built.
 *
 * ## Shadows
 *
 * A shadow pass renders the unclipped world: every clipped material carries a
 * pass-through `maskShadowNode`, so a caster above the cut still casts exactly as
 * built.
 */
import { Plane, Vector3, type Material } from 'three';
import { getContext, setContext } from 'svelte';
import type { ResolvedSlice } from './slice-cut';
import {
	createSliceClipMask,
	createSliceClipUniforms,
	NEVER_CUT_TOP_Y,
	restoreSliceClipUniforms,
	snapshotSliceClipUniforms,
	writeSliceClipUniforms,
	type SliceClipMasks,
	type SliceClipUniforms
} from '../../../render/clip/slice-clip-mask';

/**
 * Two planes for every reading, so the count never changes.
 *
 * X2's cutaway inherits this seam; if it ever needs more planes it raises this
 * constant once (one build at load, never at runtime) instead of adding a second
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

/** A mask-state snapshot for a reading, without touching the live uniforms. */
function maskStateOf(resolved: ResolvedSlice | null) {
	const scratch = createSliceClipUniforms();
	writeSliceClipUniforms(scratch, resolved?.kind === 'drawn' ? resolved : null);
	return snapshotSliceClipUniforms(scratch);
}

export type StageClip = {
	/** The one array every colour material holds **by reference**. Never replaced. */
	readonly planes: readonly Plane[];
	/** The one uniform object every colour material's mask reads. */
	readonly sliceUniforms: SliceClipUniforms;
	/**
	 * The material store's clip factory: one node graph per cutaway binding,
	 * attached at construction and never replaced.
	 */
	clipMasks(cutaway: boolean): SliceClipMasks;
	/** Apply a resolved reading (or `null` for no Slice). Mutates in place. */
	apply(resolved: ResolvedSlice | null): void;
	/** Render as built: planes and mask no-op for the duration of `render`. */
	asBuilt<T>(render: () => T): T;
	/** Whether a Slice is live. */
	isActive(): boolean;
	/**
	 * Cut an ink material with its subject: the native planes (Level) **and** the
	 * drawn predicate. Selection, hover and Lift ink hold the planes by reference;
	 * without the mask a drawn cut would leave their contours floating over what it
	 * removed (§2.4). Attached once, before the material's first draw, so drawing
	 * and editing a cut still only write uniforms.
	 */
	clipInk<M extends Material>(material: M): M;
	/**
	 * The X2 cutaway top applied to the one live uniform, or `null` for never cut.
	 *
	 * Whole, the hold key, Plan, Preview and snapshots all write `null` here: the
	 * twin materials stay leased and the cut simply stops discarding, so returning
	 * to Cut costs a uniform write rather than a material swap.
	 */
	setCutawayTop(y: number | null): void;
	/** The live cutaway top, for diagnostics and the fixture. */
	cutawayTop(): number;
	/**
	 * Cut an ink material with the live cutaway top as well as the Slice: a hover or
	 * rim contour of a cut Wall matches its stub instead of floating above it.
	 *
	 * A **selected** Wall is exempt from the cutaway (D9), so its gold contour uses
	 * `clipInk` and stays whole.
	 */
	cutawayInk<M extends Material>(material: M): M;
};

export function createStageClip(): StageClip {
	assertSign();
	const planes: Plane[] = [keepAll(), keepAll()];
	const sliceUniforms = createSliceClipUniforms();
	const masks = new Map<boolean, SliceClipMasks>();
	let depth = 0;
	let savedPlanes: Plane[] | null = null;
	let savedMask: ReturnType<typeof snapshotSliceClipUniforms> | null = null;
	let active = false;

	function packed(cutaway: boolean): SliceClipMasks {
		let mask = masks.get(cutaway);
		if (mask === undefined) {
			mask = createSliceClipMask(sliceUniforms, { cutaway });
			masks.set(cutaway, mask);
		}
		return mask;
	}

	function write(target: readonly Plane[], values: readonly Plane[]): void {
		target[0]!.copy(values[0]!);
		target[1]!.copy(values[1]!);
	}

	function writeMask(state: ReturnType<typeof snapshotSliceClipUniforms>): void {
		restoreSliceClipUniforms(sliceUniforms, state);
	}

	return {
		planes,
		sliceUniforms,
		clipMasks: packed,
		apply(resolved) {
			active = resolved !== null;
			const native = nativePlanesOf(resolved);
			const shader = maskStateOf(resolved);
			// Inside a snapshot render the live values are parked at no-op; the newest
			// reading must win when the snapshot exits, so it is written to the saved
			// state instead of the live one.
			if (depth > 0 && savedPlanes !== null && savedMask !== null) {
				write(savedPlanes, native);
				// A reading change never moves the cutaway top; keep the parked value.
				savedMask = { ...shader, cutawayTopY: savedMask.cutawayTopY };
				return;
			}
			write(planes, native);
			// X2 owns the cutaway top independently of the Slice reading. `shader` is a
			// fresh state for the reading (never-cut by default), so restore it around
			// the write rather than letting a Level/Drawn edit silently show every Wall.
			const cutawayTopY = sliceUniforms.cutawayTopY.value;
			writeMask(shader);
			sliceUniforms.cutawayTopY.value = cutawayTopY;
		},
		asBuilt(render) {
			if (depth === 0) {
				savedPlanes = planes.map((plane) => plane.clone());
				savedMask = snapshotSliceClipUniforms(sliceUniforms);
				planes.forEach((plane) => plane.copy(keepAll()));
				sliceUniforms.mode.value = 0;
				// X2's cutaway is a viewing state too: a snapshot is the world as built.
				sliceUniforms.cutawayTopY.value = NEVER_CUT_TOP_Y;
			}
			depth += 1;
			try {
				return render();
			} finally {
				depth -= 1;
				if (depth === 0 && savedPlanes !== null && savedMask !== null) {
					const restorePlanes = savedPlanes;
					const restoreMask = savedMask;
					savedPlanes = null;
					savedMask = null;
					write(planes, restorePlanes);
					writeMask(restoreMask);
				}
			}
		},
		isActive: () => active,
		clipInk(material) {
			material.clippingPlanes = planes;
			(material as Material & { maskNode?: unknown }).maskNode = packed(false).colour;
			return material;
		},
		setCutawayTop(y) {
			const value = y === null ? NEVER_CUT_TOP_Y : y;
			if (depth > 0 && savedMask !== null) {
				// The newest value must win when the snapshot exits.
				savedMask = { ...savedMask, cutawayTopY: value };
				return;
			}
			sliceUniforms.cutawayTopY.value = value;
		},
		cutawayTop: () => sliceUniforms.cutawayTopY.value,
		cutawayInk(material) {
			material.clippingPlanes = planes;
			(material as Material & { maskNode?: unknown }).maskNode = packed(true).colour;
			return material;
		}
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
