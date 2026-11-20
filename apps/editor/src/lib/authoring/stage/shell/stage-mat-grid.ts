/**
 * The mat's grid, drawn per pixel on one finite quad.
 *
 * The mat is seen in perspective, so one zoom-wide fade cannot suit the ground
 * at the eye and the ground at the horizon at once. Each fragment computes the
 * projected spacing of every fixed level from its own screen derivatives and
 * applies the grammar's 16 → 8 CSS px fade there: 1 m near the eye, 5 m further
 * out, 25 m toward the horizon, and plain mat where even 25 m would be denser
 * than 8 px. Lines exist only on the plate around the work. Both directions of a
 * level share one weight, taken from the denser direction: foreshortening
 * compresses the crosswise lines first, and a per-axis weight left only the
 * receding lines there. The 25 m level cross-fades in as the 5 m level fades out,
 * so a zoom never passes through a band with no reference. `matGridLevelWeights`
 * in `stage-grid.ts` is the tested twin of these weights.
 *
 * The quad is one draw at constant cost: no line geometry, no line budget and no
 * rebuild on pan or zoom, only uniform updates. Lines stay anchored to world
 * zero through `uLatticeOffset`, so float32 never carries large world
 * coordinates. It owns no Camera and is never a pick root.
 *
 * The materials are TSL node materials, so the same one-draw shader runs on the
 * native WebGPU and WebGL2 backends. Colour is written in the working space and
 * the renderer's output pass encodes it; the two semantic inks are the same
 * `Color` values the native GLSL used.
 */
import { Color, Vector2, Vector4 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
	abs,
	clamp,
	dFdx,
	dFdy,
	float,
	fract,
	length,
	max,
	min,
	mix,
	positionGeometry,
	uniform,
	vec2,
	vec3,
	vec4,
	varying
} from 'three/tsl';
import { MAT_BACKGROUND_INK, PAPER_GROUND_INK } from '../paper-plan';
import { GRID_MAJOR_METERS, GRID_MINOR_METERS } from '../stage-drafting';
import {
	GRID_COARSE_METERS,
	GRID_FULL_SPACING_CSS_PX,
	GRID_SUPPRESS_SPACING_CSS_PX,
	PAPER_GRID_INK,
	type GridRect,
	type MatGround
} from '../stage-grid';

/**
 * The TSL node surface is deliberately untyped here: a shader graph mixes float,
 * vec2, vec3 and vec4 nodes through one fluent API, and pinning every helper to
 * one node class would describe the operator chain rather than the shader.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tsl = any;

/** The grid quad sits this far above the datum, and the mat 4 mm below it. */
export const MAT_GRID_LIFT_METERS = 0.002;
/**
 * Before the other transparent Stage marks: the height plane's tint (order 1)
 * and the selection layer always draw over the grid.
 */
export const MAT_GRID_RENDER_ORDER = 0;
/**
 * The quad is subdivided so the lattice coordinate is interpolated over short
 * triangles: one triangle across a mat hundreds of eye heights wide loses
 * float32 precision at grazing angles and during a reading flip.
 */
export const MAT_GRID_SEGMENTS = 64;
/**
 * The mat's own depth pushback, in depth steps. Inside a large project the near
 * plane stays at its floor so close-up geometry never clips, and there one step
 * can be many times the 4 mm that separates the mat from a floor on the datum.
 * The mat shares the grid's segments, since depth interpolated across one huge
 * triangle is noisier than this pushback.
 */
export const MAT_GROUND_POLYGON_OFFSET_UNITS = 4;

/** The plate's corner radius. */
export const GROUND_PLATE_CORNER_METERS = 1;

/** The uniforms one mat material exposes; values are written in place. */
export type MatGridUniforms = {
	readonly uSize: { value: number };
	readonly uLatticeOffset: { value: Vector2 };
	readonly uPixelRatio: { value: number };
	readonly uPlate: { value: Vector4 };
	readonly uPlateMinorInk: { value: Color };
	readonly uPlateMajorInk: { value: Color };
	readonly uPlateMinorOpacity: { value: number };
	readonly uPlateMajorOpacity: { value: number };
	readonly uPlateInk: { value: Color };
	readonly uMatInk: { value: Color };
};

/** One mat material and the uniform handles its host writes. */
export type MatMaterial = {
	readonly material: MeshBasicNodeMaterial;
	readonly uniforms: MatGridUniforms;
};

/** 1 inside the plate's rounded rectangle and 0 outside, antialiased at its edge. */
function plateCoverage(lattice: Tsl, uPlate: Tsl): Tsl {
	const half: Tsl = uPlate.zw.sub(uPlate.xy).mul(0.5);
	const centre: Tsl = uPlate.xy.add(uPlate.zw).mul(0.5);
	const q: Tsl = abs(lattice.sub(centre)).sub(half).add(GROUND_PLATE_CORNER_METERS);
	const distance: Tsl = length(max(q, vec2(0)))
		.add(min(max(q.x, q.y), 0))
		.sub(GROUND_PLATE_CORNER_METERS);
	return clamp(0.5 - distance.div(max(dFdx(distance), dFdy(distance)).max(1e-9)), 0, 1);
}

/** The grammar's fade: fully inked at 16 CSS px, absent below 8. */
function levelFade(spacingCssPx: Tsl): Tsl {
	return clamp(
		spacingCssPx
			.sub(GRID_SUPPRESS_SPACING_CSS_PX)
			.div(GRID_FULL_SPACING_CSS_PX - GRID_SUPPRESS_SPACING_CSS_PX),
		0,
		1
	);
}

/** Projected spacing, in CSS px, of lines one metre apart along this coordinate. */
function metreSpacingCssPx(meters: Tsl, uPixelRatio: Tsl): Tsl {
	const perPixel: Tsl = length(vec2(dFdx(meters), dFdy(meters)));
	return float(1).div(max(perPixel, 1e-9)).div(uPixelRatio);
}

/** A one-device-pixel antialiased line at every whole cell. */
function lineCoverage(cells: Tsl): Tsl {
	const distance: Tsl = abs(fract(cells.sub(0.5)).sub(0.5)).div(
		max(dFdx(cells), dFdy(cells)).max(1e-9)
	);
	return clamp(float(1).sub(min(distance, 1)), 0, 1);
}

export function createMatGridMaterial(): MatMaterial {
	const uSize: Tsl = uniform(1);
	const uLatticeOffset: Tsl = uniform(new Vector2(0, 0));
	const uPixelRatio: Tsl = uniform(1);
	const uPlate: Tsl = uniform(new Vector4(0, 0, 0, 0));
	// PLATE's semantic inks, unlit and untoned like the Paper lines.
	const uPlateMinorInk: Tsl = uniform(new Color(PAPER_GRID_INK.minor));
	const uPlateMajorInk: Tsl = uniform(new Color(PAPER_GRID_INK.major));
	const uPlateMinorOpacity: Tsl = uniform(PAPER_GRID_INK.minorOpacity);
	const uPlateMajorOpacity: Tsl = uniform(PAPER_GRID_INK.majorOpacity);

	// The unit plane is rotated −90° about X: local (x, y) is world (x, −z).
	const vLattice = varying(
		vec2(positionGeometry.x, positionGeometry.y.negate()).mul(uSize).add(uLatticeOffset)
	);

	const colorNode = (() => {
		// One weight per level, from the denser direction, so a level's two
		// directions always leave together.
		const metre: Tsl = min(
			metreSpacingCssPx(vLattice.x, uPixelRatio),
			metreSpacingCssPx(vLattice.y, uPixelRatio)
		);
		const minorWeight: Tsl = levelFade(metre.mul(GRID_MINOR_METERS));
		const majorWeight: Tsl = levelFade(metre.mul(GRID_MAJOR_METERS));
		const coarseWeight: Tsl = levelFade(metre.mul(GRID_COARSE_METERS)).mul(1 - majorWeight);
		const minorLine: Tsl = max(
			lineCoverage(vLattice.x.div(GRID_MINOR_METERS)).mul(minorWeight),
			lineCoverage(vLattice.y.div(GRID_MINOR_METERS)).mul(minorWeight)
		);
		const majorLine: Tsl = max(
			max(
				lineCoverage(vLattice.x.div(GRID_MAJOR_METERS)).mul(majorWeight),
				lineCoverage(vLattice.x.div(GRID_COARSE_METERS)).mul(coarseWeight)
			),
			max(
				lineCoverage(vLattice.y.div(GRID_MAJOR_METERS)).mul(majorWeight),
				lineCoverage(vLattice.y.div(GRID_COARSE_METERS)).mul(coarseWeight)
			)
		);
		// Lines exist only on the plate; beyond it the Stage is plain forest.
		const plate: Tsl = plateCoverage(vLattice, uPlate);
		const minorAlpha: Tsl = minorLine.mul(uPlateMinorOpacity).mul(plate);
		const majorAlpha: Tsl = majorLine.mul(uPlateMajorOpacity).mul(plate);
		const alpha: Tsl = max(minorAlpha, majorAlpha);
		// An empty fragment is discarded before it can write a transparent quad.
		alpha.lessThanEqual(0).discard();
		// A coarser role owns a coincident line, as on Paper.
		const ink: Tsl = majorAlpha.greaterThanEqual(minorAlpha).select(uPlateMajorInk, uPlateMinorInk);
		return vec4(vec3(ink), alpha);
	})();

	const material = new MeshBasicNodeMaterial({
		transparent: true,
		depthTest: true,
		depthWrite: false,
		// The mat writes depth 6 mm below the grid. Far out, with a small near
		// plane, 6 mm is under one depth step; this offset is in depth steps, so
		// the grid stays ahead of its own mat at every distance. No slope factor:
		// at grazing angles it would carry the grid over thin geometry on the floor.
		polygonOffset: true,
		polygonOffsetFactor: 0,
		polygonOffsetUnits: -4,
		toneMapped: false
	});
	material.colorNode = colorNode;
	return {
		material,
		uniforms: {
			uSize,
			uLatticeOffset,
			uPixelRatio,
			uPlate,
			uPlateMinorInk,
			uPlateMajorInk,
			uPlateMinorOpacity,
			uPlateMajorOpacity,
			uPlateInk: uniform(new Color(PAPER_GROUND_INK)) as { value: Color },
			uMatInk: uniform(new Color(MAT_BACKGROUND_INK)) as { value: Color }
		}
	};
}

/**
 * The ground: one opaque unlit draw, Paper's colour inside the plate and the Stage's own
 * background colour outside, so no horizon shows and the plate's edge can never
 * fight the mat. It stays opaque out there to keep what lies below the datum hidden.
 */
export function createMatGroundMaterial(): MatMaterial {
	const uSize: Tsl = uniform(1);
	const uLatticeOffset: Tsl = uniform(new Vector2(0, 0));
	const uPlate: Tsl = uniform(new Vector4(0, 0, 0, 0));
	const uPlateInk: Tsl = uniform(new Color(PAPER_GROUND_INK));
	const uMatInk: Tsl = uniform(new Color(MAT_BACKGROUND_INK));
	const vLattice = varying(
		vec2(positionGeometry.x, positionGeometry.y.negate()).mul(uSize).add(uLatticeOffset)
	);
	const plate: Tsl = plateCoverage(vLattice, uPlate);
	const colorNode: Tsl = vec4(
		(mix as (a: Tsl, b: Tsl, t: Tsl) => Tsl)(uMatInk, uPlateInk, plate),
		1
	);

	const material = new MeshBasicNodeMaterial({
		polygonOffset: true,
		polygonOffsetFactor: 0,
		polygonOffsetUnits: MAT_GROUND_POLYGON_OFFSET_UNITS,
		toneMapped: false
	});
	material.colorNode = colorNode;
	return {
		material,
		uniforms: {
			uSize,
			uLatticeOffset,
			uPixelRatio: uniform(1),
			uPlate,
			uPlateMinorInk: uniform(new Color(PAPER_GRID_INK.minor)),
			uPlateMajorInk: uniform(new Color(PAPER_GRID_INK.major)),
			uPlateMinorOpacity: uniform(PAPER_GRID_INK.minorOpacity),
			uPlateMajorOpacity: uniform(PAPER_GRID_INK.majorOpacity),
			uPlateInk,
			uMatInk
		}
	};
}

/** Point a mat material at the current mat and plate; no rebuild, only uniforms. */
export function updateMatMaterial(material: MatMaterial, ground: MatGround, plate: GridRect): void {
	const [originX, originZ] = [
		ground.centerXZ[0] - ground.latticeOffsetXZ[0],
		ground.centerXZ[1] - ground.latticeOffsetXZ[1]
	];
	material.uniforms.uSize.value = 2 * ground.halfExtentMeters;
	material.uniforms.uLatticeOffset.value.set(ground.latticeOffsetXZ[0], ground.latticeOffsetXZ[1]);
	// In lattice coordinates, like `vLattice`, so float32 never carries large world values.
	material.uniforms.uPlate.value.set(
		plate.minX - originX,
		plate.minZ - originZ,
		plate.maxX - originX,
		plate.maxZ - originZ
	);
}

/** The grid is the mat's own transform plus the pixel ratio its fade measures in. */
export function updateMatGridMaterial(
	material: MatMaterial,
	ground: MatGround,
	pixelRatio: number,
	plate: GridRect
): void {
	updateMatMaterial(material, ground, plate);
	material.uniforms.uPixelRatio.value = pixelRatio > 0 ? pixelRatio : 1;
}

// The grammar's constants, exported for the tested twin in `stage-grid.ts`.
export const MAT_GRID_FADE = {
	suppress: GRID_SUPPRESS_SPACING_CSS_PX,
	full: GRID_FULL_SPACING_CSS_PX,
	minor: GRID_MINOR_METERS,
	major: GRID_MAJOR_METERS,
	coarse: GRID_COARSE_METERS,
	corner: GROUND_PLATE_CORNER_METERS
} as const;
