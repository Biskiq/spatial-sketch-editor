/**
 * The Stage's one clipping seam.
 *
 * A Slice is realized with Three's own clipping planes, not by toggling meshes or
 * swapping geometry: a mesh is *half drawn*, its shadow is unchanged, and moving the
 * cut is a uniform update rather than a rebuild.
 *
 * ## The sign, stated once
 *
 * Three r187's vertex chunk writes `vClipPosition = -mvPosition.xyz`, the fragment
 * chunk discards where `dot(vClipPosition, plane.xyz) > plane.w`, and
 * `WebGLClipping` uploads each plane in view space as `(normal, constant)`.
 * Substituting, a fragment is discarded where `normal · p + constant < 0` and kept
 * where it is **≥ 0** — exactly `Plane.distanceToPoint(p) ≥ 0`. Every helper here
 * therefore states the inequality it **keeps**, and the constructor asserts the sign
 * so a flip fails loudly in every lane. `slice-cut.test.ts` (test 1b) evaluates the
 * same expression on the CPU for a real camera, and the rendered fixture
 * (`perf/flows/stage-clip.spec.ts`, test 14) proves it on a real GPU.
 *
 * ## One instance per Stage Canvas
 *
 * `StageCanvas` creates the instance **before** it provides the render resources, so
 * the material store is born with the array and every colour material holds *that*
 * array by reference. The array length is constant (two planes) for the Canvas's
 * life, so entering, dragging and leaving a Slice never recompiles a program; `apply`
 * mutates the shared `Plane` instances in place and never replaces the array.
 *
 * ## Snapshots are as built
 *
 * `asBuilt(render)` restores every plane to a no-op for the duration of a snapshot and
 * puts the live values back in `finally` — re-entrant, exception safe, and never
 * invalidating (the restored values are the ones already on screen). Overlay ink is
 * outside the snapshot mask already, so the image is the world as built.
 *
 * ## Shadows
 *
 * `clipShadows` stays `false` (Three's default) and this module never touches it: a
 * shadow map is rendered from the unclipped world, so every caster above the cut
 * still casts exactly as built. Lighting is unchanged, and proven so by tests 6 and
 * 14 rather than assumed.
 */
import { Plane, Vector3, type Material } from 'three';
import { getContext, setContext } from 'svelte';
import type { ResolvedSlice } from './slice-cut';

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

export type StageClip = {
	/** The one array every colour material holds **by reference**. Never replaced. */
	readonly planes: readonly Plane[];
	/** Apply a resolved reading (or `null` for no Slice). Mutates in place. */
	apply(resolved: ResolvedSlice | null): void;
	/** Render as built: every plane a no-op for the duration of `render`. */
	asBuilt<T>(render: () => T): T;
	/** Materials with clipping disabled (`clip: false`), for tests and diagnostics. */
	isActive(): boolean;
};

export function createStageClip(): StageClip {
	assertSign();
	const planes: Plane[] = [keepAll(), keepAll()];
	let depth = 0;
	let saved: Plane[] | null = null;
	let active = false;

	function write(target: readonly Plane[], resolved: ResolvedSlice | null): void {
		if (resolved === null) {
			target[0]!.copy(keepAll());
			target[1]!.copy(keepAll());
			return;
		}
		target[0]!.copy(keepBelow(resolved.cutY));
		target[1]!.copy(resolved.lowerY === null ? keepAll() : keepAbove(resolved.lowerY));
	}

	return {
		planes,
		apply(resolved) {
			active = resolved !== null;
			// Inside a snapshot render the live planes are parked at no-op; the newest
			// reading must win when the snapshot exits, so it is written to `saved`.
			if (depth > 0 && saved !== null) write(saved, resolved);
			else write(planes, resolved);
		},
		asBuilt(render) {
			if (depth === 0) {
				saved = planes.map((plane) => plane.clone());
				planes.forEach((plane) => plane.copy(keepAll()));
			}
			depth += 1;
			try {
				return render();
			} finally {
				depth -= 1;
				if (depth === 0 && saved !== null) {
					const restore = saved;
					saved = null;
					planes.forEach((plane, index) => plane.copy(restore[index]!));
				}
			}
		},
		isActive: () => active
	};
}

/** Whether a material shares this clip's plane array (test 5's reference identity). */
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
