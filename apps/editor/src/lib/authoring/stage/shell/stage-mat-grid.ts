/**
 * R217.S19 — the mat's grid, drawn per pixel on one finite quad.
 *
 * The mat is seen in perspective, so one zoom-wide fade cannot suit the ground
 * at the eye and the ground at the horizon at once. Each fragment computes the
 * projected spacing of every fixed level from its own screen derivatives and
 * applies the grammar's 16 → 8 CSS px fade there: 1 m near the eye, 5 m further
 * out, 25 m toward the horizon, and plain mat where even 25 m would be denser
 * than 8 px. The 25 m level cross-fades in as the 5 m level fades out, so a zoom
 * never passes through a band with no reference. `matGridLevelWeights` in
 * `stage-grid.ts` is the tested twin of these weights.
 *
 * The quad is one draw at constant cost: no line geometry, no line budget and no
 * rebuild on pan or zoom, only uniform updates. Lines stay anchored to world
 * zero through `uLatticeOffset`, so float32 never carries large world
 * coordinates. It owns no Camera and is never a pick root.
 */
import { Color, ShaderMaterial } from 'three';
import { GRID_MAJOR_METERS, GRID_MINOR_METERS } from '../stage-drafting';
import {
	GRID_COARSE_METERS,
	GRID_FULL_SPACING_CSS_PX,
	GRID_SUPPRESS_SPACING_CSS_PX,
	MAT_GRID_INK,
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

const FRAGMENT = /* glsl */ `
uniform vec3 uMinorInk;
uniform vec3 uMajorInk;
uniform float uMinorOpacity;
uniform float uMajorOpacity;
uniform float uPixelRatio;
varying vec2 vLattice;

// The grammar's fade: fully inked at 16 CSS px, absent below 8.
float levelFade(float spacingCssPx) {
	return clamp(
		(spacingCssPx - ${float(GRID_SUPPRESS_SPACING_CSS_PX)}) /
			(${float(GRID_FULL_SPACING_CSS_PX)} - ${float(GRID_SUPPRESS_SPACING_CSS_PX)}),
		0.0,
		1.0
	);
}

// Projected spacing, in CSS px, of lines one cell apart along this coordinate.
float spacingCssPx(float cells) {
	float perPixel = length(vec2(dFdx(cells), dFdy(cells)));
	return 1.0 / max(perPixel, 1e-9) / uPixelRatio;
}

// A one-device-pixel antialiased line at every whole cell.
float lineCoverage(float cells) {
	float distance = abs(fract(cells - 0.5) - 0.5) / max(fwidth(cells), 1e-9);
	return 1.0 - min(distance, 1.0);
}

void main() {
	float minorAlpha = 0.0;
	float majorAlpha = 0.0;
	for (int axis = 0; axis < 2; axis++) {
		float meters = axis == 0 ? vLattice.x : vLattice.y;
		float minorCells = meters / ${float(GRID_MINOR_METERS)};
		float majorCells = meters / ${float(GRID_MAJOR_METERS)};
		float coarseCells = meters / ${float(GRID_COARSE_METERS)};
		float minorWeight = levelFade(spacingCssPx(minorCells));
		float majorWeight = levelFade(spacingCssPx(majorCells));
		float coarseWeight = levelFade(spacingCssPx(coarseCells)) * (1.0 - majorWeight);
		minorAlpha = max(minorAlpha, lineCoverage(minorCells) * minorWeight * uMinorOpacity);
		majorAlpha = max(
			majorAlpha,
			max(lineCoverage(majorCells) * majorWeight, lineCoverage(coarseCells) * coarseWeight) *
				uMajorOpacity
		);
	}
	float alpha = max(minorAlpha, majorAlpha);
	if (alpha <= 0.0) discard;
	// A coarser role owns a coincident line, as on Paper.
	vec3 ink = majorAlpha >= minorAlpha ? uMajorInk : uMinorInk;
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
			// PLATE's semantic inks, unlit and untoned like the Paper lines.
			uMinorInk: { value: new Color(MAT_GRID_INK.minor) },
			uMajorInk: { value: new Color(MAT_GRID_INK.major) },
			uMinorOpacity: { value: MAT_GRID_INK.minorOpacity },
			uMajorOpacity: { value: MAT_GRID_INK.majorOpacity }
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

/** Point the material at the current mat; no rebuild, only uniforms. */
export function updateMatGridMaterial(
	material: ShaderMaterial,
	ground: MatGround,
	pixelRatio: number
): void {
	material.uniforms.uSize!.value = 2 * ground.halfExtentMeters;
	material.uniforms.uLatticeOffset!.value = [ground.latticeOffsetXZ[0], ground.latticeOffsetXZ[1]];
	material.uniforms.uPixelRatio!.value = pixelRatio > 0 ? pixelRatio : 1;
}
