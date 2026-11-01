/**
 * R217.S19 — the mat's grid, drawn per pixel on one finite quad.
 *
 * The mat is seen in perspective, so one zoom-wide fade cannot suit the ground
 * at the eye and the ground at the horizon at once. Each fragment computes the
 * projected spacing of every fixed level from its own screen derivatives and
 * applies the grammar's 16 → 8 CSS px fade there: 1 m near the eye, 5 m further
 * out, 25 m toward the horizon, and plain mat where even 25 m would be denser
 * than 8 px. Lines exist only on the cream plate around the work. Both directions of a level share one weight, taken from the denser
 * direction: foreshortening compresses the crosswise lines first, and a per-axis
 * weight left only the receding lines there. The 25 m level cross-fades in as the
 * 5 m level fades out, so a zoom never passes through a band with no reference.
 * `matGridLevelWeights` in `stage-grid.ts` is the tested twin of these weights.
 *
 * The quad is one draw at constant cost: no line geometry, no line budget and no
 * rebuild on pan or zoom, only uniform updates. Lines stay anchored to world
 * zero through `uLatticeOffset`, so float32 never carries large world
 * coordinates. It owns no Camera and is never a pick root.
 */
import { Color, ShaderMaterial } from 'three';
import { GROUND_PLATE_INK, MAT_BACKGROUND_INK } from '../paper-plan';
import { GRID_MAJOR_METERS, GRID_MINOR_METERS } from '../stage-drafting';
import {
	GRID_COARSE_METERS,
	GRID_FULL_SPACING_CSS_PX,
	GRID_SUPPRESS_SPACING_CSS_PX,
	PLATE_GRID_INK,
	type GridRect,
	type MatGround
} from '../stage-grid';

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

const float = (value: number): string => (Number.isInteger(value) ? `${value}.0` : `${value}`);

const VERTEX = /* glsl */ `
uniform float uSize;
uniform vec2 uLatticeOffset;
varying vec2 vLattice;
void main() {
	// The unit plane is rotated −90° about X: local (x, y) is world (x, −z).
	vLattice = vec2(position.x, -position.y) * uSize + uLatticeOffset;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** 1 inside the plate's rounded rectangle and 0 outside, antialiased at its edge. */
const PLATE_COVERAGE = /* glsl */ `
uniform vec4 uPlate;
float plateCoverage(vec2 lattice) {
	vec2 q = abs(lattice - (uPlate.xy + uPlate.zw) * 0.5) - (uPlate.zw - uPlate.xy) * 0.5 + ${float(GROUND_PLATE_CORNER_METERS)};
	float distance = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${float(GROUND_PLATE_CORNER_METERS)};
	return clamp(0.5 - distance / max(fwidth(distance), 1e-9), 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uPlateMinorInk;
uniform vec3 uPlateMajorInk;
uniform float uPlateMinorOpacity;
uniform float uPlateMajorOpacity;
uniform float uPixelRatio;
varying vec2 vLattice;
${PLATE_COVERAGE}

// The grammar's fade: fully inked at 16 CSS px, absent below 8.
float levelFade(float spacingCssPx) {
	return clamp(
		(spacingCssPx - ${float(GRID_SUPPRESS_SPACING_CSS_PX)}) /
			(${float(GRID_FULL_SPACING_CSS_PX)} - ${float(GRID_SUPPRESS_SPACING_CSS_PX)}),
		0.0,
		1.0
	);
}

// Projected spacing, in CSS px, of lines one metre apart along this coordinate.
float metreSpacingCssPx(float meters) {
	float perPixel = length(vec2(dFdx(meters), dFdy(meters)));
	return 1.0 / max(perPixel, 1e-9) / uPixelRatio;
}

// A one-device-pixel antialiased line at every whole cell.
float lineCoverage(float cells) {
	float distance = abs(fract(cells - 0.5) - 0.5) / max(fwidth(cells), 1e-9);
	return 1.0 - min(distance, 1.0);
}

void main() {
	// One weight per level, from the denser direction, so a level's two directions
	// always leave together.
	float metre = min(metreSpacingCssPx(vLattice.x), metreSpacingCssPx(vLattice.y));
	float minorWeight = levelFade(metre * ${float(GRID_MINOR_METERS)});
	float majorWeight = levelFade(metre * ${float(GRID_MAJOR_METERS)});
	float coarseWeight = levelFade(metre * ${float(GRID_COARSE_METERS)}) * (1.0 - majorWeight);
	float minorLine = 0.0;
	float majorLine = 0.0;
	for (int axis = 0; axis < 2; axis++) {
		float meters = axis == 0 ? vLattice.x : vLattice.y;
		minorLine = max(minorLine, lineCoverage(meters / ${float(GRID_MINOR_METERS)}) * minorWeight);
		majorLine = max(
			majorLine,
			max(
				lineCoverage(meters / ${float(GRID_MAJOR_METERS)}) * majorWeight,
				lineCoverage(meters / ${float(GRID_COARSE_METERS)}) * coarseWeight
			)
		);
	}
	// Lines exist only on the plate; beyond it the Stage is plain forest.
	float plate = plateCoverage(vLattice);
	float minorAlpha = minorLine * uPlateMinorOpacity * plate;
	float majorAlpha = majorLine * uPlateMajorOpacity * plate;
	float alpha = max(minorAlpha, majorAlpha);
	if (alpha <= 0.0) discard;
	// A coarser role owns a coincident line, as on Paper.
	vec3 ink = majorAlpha >= minorAlpha ? uPlateMajorInk : uPlateMinorInk;
	gl_FragColor = vec4(ink, alpha);
	#include <colorspace_fragment>
}
`;

export function createMatGridMaterial(): ShaderMaterial {
	return new ShaderMaterial({
		uniforms: {
			uSize: { value: 1 },
			uLatticeOffset: { value: [0, 0] },
			uPixelRatio: { value: 1 },
			uPlate: { value: [0, 0, 0, 0] },
			// PLATE's semantic inks, unlit and untoned like the Paper lines.
			uPlateMinorInk: { value: new Color(PLATE_GRID_INK.minor) },
			uPlateMajorInk: { value: new Color(PLATE_GRID_INK.major) },
			uPlateMinorOpacity: { value: PLATE_GRID_INK.minorOpacity },
			uPlateMajorOpacity: { value: PLATE_GRID_INK.majorOpacity }
		},
		vertexShader: VERTEX,
		fragmentShader: FRAGMENT,
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
}

const GROUND_VERTEX = VERTEX;

const GROUND_FRAGMENT = /* glsl */ `
uniform vec3 uPlateInk;
uniform vec3 uMatInk;
varying vec2 vLattice;
${PLATE_COVERAGE}
void main() {
	gl_FragColor = vec4(mix(uMatInk, uPlateInk, plateCoverage(vLattice)), 1.0);
	#include <colorspace_fragment>
}
`;

/**
 * The ground: one opaque unlit draw, cream inside the plate and the Stage's own
 * background colour outside, so no horizon shows and the plate's edge can never
 * fight the mat. It stays opaque out there to keep what lies below the datum hidden.
 */
export function createMatGroundMaterial(): ShaderMaterial {
	return new ShaderMaterial({
		uniforms: {
			uSize: { value: 1 },
			uLatticeOffset: { value: [0, 0] },
			uPlate: { value: [0, 0, 0, 0] },
			uPlateInk: { value: new Color(GROUND_PLATE_INK) },
			uMatInk: { value: new Color(MAT_BACKGROUND_INK) }
		},
		vertexShader: GROUND_VERTEX,
		fragmentShader: GROUND_FRAGMENT,
		polygonOffset: true,
		polygonOffsetFactor: 0,
		polygonOffsetUnits: MAT_GROUND_POLYGON_OFFSET_UNITS,
		toneMapped: false
	});
}

/** Point a mat material at the current mat and plate; no rebuild, only uniforms. */
export function updateMatMaterial(material: ShaderMaterial, ground: MatGround, plate: GridRect): void {
	const [originX, originZ] = [
		ground.centerXZ[0] - ground.latticeOffsetXZ[0],
		ground.centerXZ[1] - ground.latticeOffsetXZ[1]
	];
	material.uniforms.uSize!.value = 2 * ground.halfExtentMeters;
	material.uniforms.uLatticeOffset!.value = [ground.latticeOffsetXZ[0], ground.latticeOffsetXZ[1]];
	// In lattice coordinates, like `vLattice`, so float32 never carries large world values.
	material.uniforms.uPlate!.value = [
		plate.minX - originX,
		plate.minZ - originZ,
		plate.maxX - originX,
		plate.maxZ - originZ
	];
}

/** The grid is the mat's own transform plus the pixel ratio its fade measures in. */
export function updateMatGridMaterial(
	material: ShaderMaterial,
	ground: MatGround,
	pixelRatio: number,
	plate: GridRect
): void {
	updateMatMaterial(material, ground, plate);
	material.uniforms.uPixelRatio!.value = pixelRatio > 0 ? pixelRatio : 1;
}
