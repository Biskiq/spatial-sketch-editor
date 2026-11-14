/**
 * E8 — the approved model fallback bodies, as data.
 *
 * These are the shapes `AssetFallback.svelte` drew while a model's GLB was absent,
 * loading or failed, ported part for part: the same primitive, size, segment
 * count, offset, rotation, catalogue material and tint, in the same order. The
 * Scene render description turns each part into a keyed store geometry and a
 * canonical material descriptor; the model handler draws them. Nothing here
 * imports Three.
 *
 * Fallback surfaces are untextured (the component rendered `textures="off"`), so a
 * part's surface size, which only sized a texture repeat, is not part of the data.
 */
import type { MaterialId } from '$lib/types/materials';
import type { Vec3 } from '$lib/types/scene';
import type { AssetFallbackKind } from './fallbacks';

export type FallbackPrimitive =
	| { readonly shape: 'box'; readonly size: Vec3 }
	| { readonly shape: 'plane'; readonly width: number; readonly height: number }
	| {
			readonly shape: 'sphere';
			readonly radius: number;
			readonly widthSegments: number;
			readonly heightSegments: number;
	  }
	| {
			readonly shape: 'cylinder';
			readonly radiusTop: number;
			readonly radiusBottom: number;
			readonly height: number;
			readonly radialSegments: number;
			readonly openEnded: boolean;
	  };

export type FallbackPart = {
	readonly primitive: FallbackPrimitive;
	readonly position: Vec3;
	readonly rotation: Vec3;
	readonly materialId: MaterialId;
	/** Overrides the catalogue's fallback colour. */
	readonly tint?: string;
};

const ZERO: Vec3 = [0, 0, 0];

const box = (size: Vec3): FallbackPrimitive => ({ shape: 'box', size });
const cylinder = (
	radiusTop: number,
	radiusBottom: number,
	height: number,
	radialSegments: number,
	openEnded = false
): FallbackPrimitive => ({ shape: 'cylinder', radiusTop, radiusBottom, height, radialSegments, openEnded });
const sphere = (radius: number, widthSegments: number, heightSegments: number): FallbackPrimitive => ({
	shape: 'sphere',
	radius,
	widthSegments,
	heightSegments
});

function part(
	primitive: FallbackPrimitive,
	position: Vec3,
	materialId: MaterialId,
	tint?: string,
	rotation: Vec3 = ZERO
): FallbackPart {
	return tint === undefined
		? { primitive, position, rotation, materialId }
		: { primitive, position, rotation, materialId, tint };
}

const piano = (): FallbackPart[] => [
	// 1.5 m wide x 2.25 m long x 1 m high; keyboard faces +Z.
	part(box([1.5, 0.32, 1.78]), [0, 0.72, -0.16], 'wood-walnut', '#130f0d'),
	part(box([1.48, 0.065, 1.86]), [0, 0.9, -0.2], 'wood-walnut', '#090807', [-0.055, 0, 0]),
	part(box([1.5, 0.17, 0.38]), [0, 0.69, 0.91], 'wood-walnut', '#18120e'),
	part(box([1.28, 0.04, 0.28]), [0, 0.79, 1.03], 'paper-aged', '#ded4bb'),
	...[-0.58, 0.58].map((x) =>
		part(cylinder(0.055, 0.075, 0.68, 10), [x, 0.34, 0.78], 'wood-walnut', '#130f0d')
	),
	part(cylinder(0.06, 0.085, 0.68, 10), [0, 0.34, -0.72], 'wood-walnut', '#130f0d')
];

const chair = (): FallbackPart[] => [
	// 0.64 m wide x 0.54 m deep x 0.9 m high; sitter faces -Z.
	part(box([0.58, 0.12, 0.5]), [0, 0.46, 0], 'velvet-dark', '#642a35'),
	part(box([0.62, 0.4, 0.08]), [0, 0.7, 0.235], 'velvet-dark', '#642a35'),
	...[
		[-0.24, -0.2],
		[0.24, -0.2],
		[-0.24, 0.2],
		[0.24, 0.2]
	].map(([x, z]) => part(box([0.045, 0.42, 0.045]), [x!, 0.21, z!], 'wood-walnut'))
];

const sofa = (): FallbackPart[] => [
	// Victorian salon sofa: 2.46 m wide x 0.83 m deep x 1.01 m high; faces -Z.
	part(box([2.22, 0.28, 0.72]), [0, 0.48, 0], 'velvet-dark', '#5b2a2f'),
	part(box([2.46, 0.5, 0.16]), [0, 0.76, 0.32], 'velvet-dark', '#5b2a2f'),
	...[-1.16, 1.16].map((x) => part(box([0.14, 0.42, 0.78]), [x, 0.62, 0], 'wood-walnut')),
	...[
		[-1.06, -0.28],
		[1.06, -0.28],
		[-1.06, 0.28],
		[1.06, 0.28]
	].map(([x, z]) => part(box([0.07, 0.32, 0.07]), [x!, 0.16, z!], 'wood-walnut'))
];

const table = (): FallbackPart[] => [
	// Compact round salon table: 0.95 m diameter x 0.69 m high.
	part(cylinder(0.475, 0.475, 0.08, 32), [0, 0.65, 0], 'wood-walnut'),
	part(cylinder(0.08, 0.11, 0.58, 18), [0, 0.34, 0], 'wood-walnut', '#2e1b13'),
	part(cylinder(0.27, 0.31, 0.08, 24), [0, 0.04, 0], 'wood-walnut', '#2e1b13')
];

const chandelier = (): FallbackPart[] => [
	// Ceiling-mounted fallback; placement origin is the top pivot.
	part(cylinder(0.025, 0.025, 0.5, 10), [0, -0.25, 0], 'brass-aged'),
	part(cylinder(0.045, 0.075, 0.46, 12), [0, -0.72, 0], 'brass-aged'),
	part(sphere(0.1, 16, 12), [0, -0.98, 0], 'brass-aged'),
	...(
		[
			[0.28, -1.08, 0],
			[-0.28, -1.08, 0],
			[0, -1.08, 0.28],
			[0, -1.08, -0.28]
		] as Vec3[]
	).flatMap((arm) => [
		part(sphere(0.055, 12, 8), arm, 'brass-aged'),
		part(cylinder(0.035, 0.05, 0.3, 12), [arm[0], -1.25, arm[2]], 'paper-aged', '#f1d7a5')
	])
];

const desk = (): FallbackPart[] => [
	// 1.4 m wide x 0.7 m deep x 0.75 m high.
	part(box([1.4, 0.08, 0.7]), [0, 0.71, 0], 'wood-walnut'),
	part(box([0.64, 0.18, 0.22]), [0, 0.57, 0.21], 'wood-walnut', '#332116'),
	...[
		[-0.59, -0.25],
		[0.59, -0.25],
		[-0.59, 0.25],
		[0.59, 0.25]
	].map(([x, z]) => part(box([0.07, 0.67, 0.07]), [x!, 0.335, z!], 'wood-walnut'))
];

const lamp = (): FallbackPart[] => [
	// Compact 0.55 m table lamp.
	part(cylinder(0.13, 0.16, 0.05, 20), [0, 0.025, 0], 'brass-aged'),
	part(cylinder(0.018, 0.024, 0.42, 12), [0, 0.25, 0], 'brass-aged'),
	part(cylinder(0.1, 0.16, 0.24, 20, true), [0, 0.43, 0], 'paper-aged', '#e8d1a4')
];

const frame = (): FallbackPart[] => [
	// Wall-mounted 0.85 m x 1.05 m frame, centered on its placement origin.
	...[
		[0, 0.49, 0.85, 0.07],
		[0, -0.49, 0.85, 0.07],
		[-0.39, 0, 0.07, 0.91],
		[0.39, 0, 0.07, 0.91]
	].map(([x, y, w, h]) => part(box([w!, h!, 0.07]), [x!, y!, 0], 'brass-aged')),
	part(box([0.71, 0.91, 0.015]), [0, 0, -0.025], 'paper-aged', '#7c6c5b')
];

const book = (): FallbackPart[] => [part(box([0.18, 0.04, 0.25]), [0, 0.02, 0], 'paper-aged', '#7b3032')];

const books = (): FallbackPart[] => [
	// Three-volume stack fits 0.48 m x 0.15 m x 0.3 m.
	part(box([0.42, 0.05, 0.3]), [0, 0.025, 0], 'paper-aged', '#5f3428', [0, 0.04, 0]),
	part(box([0.48, 0.05, 0.26]), [-0.01, 0.075, 0], 'paper-aged', '#31434a', [0, -0.035, 0]),
	part(box([0.36, 0.05, 0.24]), [0.015, 0.125, 0], 'paper-aged', '#7b3032', [0, 0.07, 0])
];

const clock = (): FallbackPart[] => [
	// Grandfather clock: 0.38 m wide x 2.11 m high x 0.5 m deep.
	part(box([0.34, 1.8, 0.42]), [0, 0.93, 0], 'wood-walnut'),
	part(cylinder(0.14, 0.14, 0.025, 28), [0, 1.76, 0.225], 'paper-aged', '#e3dcc8', [Math.PI / 2, 0, 0]),
	part(box([0.38, 0.09, 0.5]), [0, 0.045, 0], 'wood-walnut', '#2a1912')
];

const decor = (): FallbackPart[] => [
	// Small ceramic-vase stand-in.
	part(sphere(0.11, 20, 14), [0, 0.11, 0], 'marble-light', '#9fa6a2'),
	part(cylinder(0.045, 0.075, 0.16, 18), [0, 0.3, 0], 'marble-light', '#9fa6a2')
];

const rug = (): FallbackPart[] => [
	part({ shape: 'plane', width: 2.6, height: 1.8 }, [0, 0.0075, 0], 'velvet-dark', '#54232d', [
		-Math.PI / 2,
		0,
		0
	])
];

/** Creator model placeholder: its approved footprint in plan; height is neutral. */
const generic = (dimensions: Vec3): FallbackPart[] => [
	part(box(dimensions), [0, dimensions[1] / 2, 0], 'plaster-warm', '#c4b4a0')
];

const SHAPES: Record<Exclude<AssetFallbackKind, 'generic'>, () => FallbackPart[]> = {
	piano,
	chair,
	sofa,
	table,
	chandelier,
	desk,
	lamp,
	frame,
	book,
	books,
	clock,
	decor,
	rug
};

/**
 * The parts of one fallback body, in the order the component mounted them.
 * `dimensions` sizes the generic box (a creator model's approved footprint) and is
 * ignored by every catalogue kind.
 */
export function fallbackPartsFor(kind: AssetFallbackKind, dimensions: Vec3): readonly FallbackPart[] {
	return kind === 'generic' ? generic(dimensions) : SHAPES[kind]();
}
