/**
 * The Stage's one TSL clip predicate.
 *
 * SL1 realized a Level cut with two native clipping planes. A drawn cut needs a
 * **finite segment** as well: only the points inside the segment's planar extent
 * are cut. Under r187's node renderer the predicate is a TSL expression attached
 * to each colour material as `maskNode`, where `false` discards the fragment:
 *
 * ```
 * s = dot(p - origin, along)
 * b = dot(p - origin, hiddenNormal)
 * hidden = |s| <= halfLength && (b > 0 || b < -depth)
 * cutaway = p.y > cutawayTopY
 * ```
 *
 * `p` is the world position after deformation (`positionWorld`), which for a fat
 * line is its interpolated centreline — the same intent the native GLSL patch had.
 *
 * ## Why one node graph, not one per material
 *
 * The uniform objects are TSL `uniform` nodes created once by the Canvas's clip
 * owner. Every material holds the *same* node graph by reference, so entering,
 * dragging, flipping and leaving a Slice only writes uniform values. The material
 * pipeline never changes, and the program count stays flat.
 *
 * ## Shadows
 *
 * r187 reuses `maskNode` during a shadow pass when `maskShadowNode` is absent.
 * Shadows are rendered from the unclipped world (SL1's `clipShadows: false`), so
 * a clipped material carries a pass-through shadow mask (`true`); the Artwork
 * variant composes its own shadow mask independently.
 *
 * ## Snapshots are as built
 *
 * `StageClip.asBuilt` parks the shared values (mode `0`, cutaway top never-cut) for
 * the duration of a snapshot and restores them in `finally`. Because the mask
 * reads the same uniform nodes, parking them needs no second material.
 */
import { Vector3 } from 'three';
import { abs, bool, dot, float, positionWorld, uniform } from 'three/tsl';
import type { Plane } from 'three';

/** A TSL node; the graph is fluent and mixes node classes freely. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tsl = any;

/** A scalar uniform node; a `MaskScalarUniform` is structurally one. */
export type ScalarUniform = { value: number };
/** A vec3 uniform node. */
export type VectorUniform = { value: Vector3 };

/** The uniform object every patched material shares by reference. */
export type SliceClipUniforms = {
	readonly mode: ScalarUniform;
	readonly origin: VectorUniform;
	readonly normal: VectorUniform;
	readonly along: VectorUniform;
	readonly halfLength: ScalarUniform;
	readonly depth: ScalarUniform;
	/**
	 * The X2 cutaway top: a **live** uniform owned by `StageClip`. Every material
	 * outside the cutaway twin set is bound to the never-cut constant instead, so
	 * one predicate serves both and a cut costs no pipeline.
	 */
	readonly cutawayTopY: ScalarUniform;
};

/** A TSL node the renderer evaluates; the free-form type keeps Three's generics out of the store. */
export type MaskNode = object;

/** The two masks one material carries: colour pass and shadow pass. */
export type SliceClipMasks = {
	/** Evaluated in the colour pass: falsy discards the fragment. */
	readonly colour: MaskNode;
	/** Evaluated in the shadow pass: `true` keeps the unclipped caster. */
	readonly shadow: MaskNode;
};

/**
 * The height a never-cut material discards above: above every Stage point, so the
 * added fragment test is a no-op for anything outside the cutaway twin set.
 */
export const NEVER_CUT_TOP_Y = 1e6;

/** The one fixed prompt tag, for diagnostics. */
export const SLICE_CLIP_MASK_TAG = 'biskiq.slice-clip.tsl@3';

export function createSliceClipUniforms(): SliceClipUniforms {
	return {
		mode: uniform(0) as unknown as ScalarUniform,
		origin: uniform(new Vector3(0, 0, 0)) as unknown as VectorUniform,
		normal: uniform(new Vector3(0, 1, 0)) as unknown as VectorUniform,
		along: uniform(new Vector3(1, 0, 0)) as unknown as VectorUniform,
		halfLength: uniform(0) as unknown as ScalarUniform,
		depth: uniform(0.1) as unknown as ScalarUniform,
		cutawayTopY: uniform(NEVER_CUT_TOP_Y) as unknown as ScalarUniform,
	};
}

/**
 * Build the one predicate graph for these uniforms.
 *
 * `cutaway: true` binds the live cutaway top (the X2 twin set); every other
 * material binds the constant never-cut value.
 */
export function createSliceClipMask(
	uniforms: SliceClipUniforms,
	options: { readonly cutaway?: boolean } = {},
): SliceClipMasks {
	const origin = uniforms.origin as unknown as Tsl;
	const normal = uniforms.normal as unknown as Tsl;
	const along = uniforms.along as unknown as Tsl;
	const mode = uniforms.mode as unknown as Tsl;
	const halfLength = uniforms.halfLength as unknown as Tsl;
	const depth = uniforms.depth as unknown as Tsl;
	const cutawayTop =
		options.cutaway === true ? (uniforms.cutawayTopY as unknown as Tsl) : float(NEVER_CUT_TOP_Y);

	const relative = positionWorld.sub(origin);
	const alongDistance = abs(dot(relative, along));
	const insideSegment = alongDistance.lessThanEqual(halfLength);
	const across = dot(relative, normal);
	const outsideBand = across.greaterThan(0).or(across.lessThan(depth.negate()));
	const hiddenBySegment = mode.greaterThan(0.5).and(insideSegment).and(outsideBand);
	const hiddenByCutaway = positionWorld.y.greaterThan(cutawayTop);
	return {
		colour: hiddenBySegment.or(hiddenByCutaway).not() as unknown as MaskNode,
		// Shadows are the unclipped world: a constant true keeps every caster.
		shadow: bool(true) as unknown as MaskNode,
	};
}

/** Write a resolved reading into the shared uniforms. `null`/Level turns it off. */
export type SliceClipSource = {
	readonly origin: readonly [number, number, number];
	readonly hiddenNormal: readonly [number, number, number];
	readonly along: readonly [number, number, number];
	readonly halfLength: number;
	readonly depthMeters: number;
} | null;

/** Write a drawn cut into the shared uniforms. `null` turns the predicate off. */
export function writeSliceClipUniforms(uniforms: SliceClipUniforms, source: SliceClipSource): void {
	if (source === null) {
		uniforms.mode.value = 0;
		uniforms.halfLength.value = 0;
		return;
	}
	uniforms.mode.value = 1;
	uniforms.origin.value.set(source.origin[0], source.origin[1], source.origin[2]);
	uniforms.normal.value.set(source.hiddenNormal[0], source.hiddenNormal[1], source.hiddenNormal[2]);
	uniforms.along.value.set(source.along[0], source.along[1], source.along[2]);
	uniforms.halfLength.value = source.halfLength;
	uniforms.depth.value = source.depthMeters;
}

/** A plain snapshot of the values, for the as-built render's `finally`. */
export function snapshotSliceClipUniforms(uniforms: SliceClipUniforms): {
	readonly mode: number;
	readonly origin: [number, number, number];
	readonly normal: [number, number, number];
	readonly along: [number, number, number];
	readonly halfLength: number;
	readonly depth: number;
	readonly cutawayTopY: number;
} {
	return {
		mode: uniforms.mode.value,
		origin: uniforms.origin.value.toArray() as [number, number, number],
		normal: uniforms.normal.value.toArray() as [number, number, number],
		along: uniforms.along.value.toArray() as [number, number, number],
		halfLength: uniforms.halfLength.value,
		depth: uniforms.depth.value,
		cutawayTopY: uniforms.cutawayTopY.value,
	};
}

export function restoreSliceClipUniforms(
	uniforms: SliceClipUniforms,
	state: ReturnType<typeof snapshotSliceClipUniforms>,
): void {
	uniforms.mode.value = state.mode;
	uniforms.origin.value.fromArray(state.origin);
	uniforms.normal.value.fromArray(state.normal);
	uniforms.along.value.fromArray(state.along);
	uniforms.halfLength.value = state.halfLength;
	uniforms.depth.value = state.depth;
	uniforms.cutawayTopY.value = state.cutawayTopY;
}

/** Whether a material carries the Stage's clip predicate (diagnostics/tests). */
export function hasSliceClipMask(material: object): boolean {
	return (material as { maskNode?: unknown }).maskNode != null;
}

/** The plane array a clipped material holds by reference (SL1 test 5's identity). */
export function materialUsesPlanes(
	material: { clippingPlanes?: Plane[] | null },
	planes: readonly Plane[],
): boolean {
	return material.clippingPlanes === (planes as Plane[]);
}
