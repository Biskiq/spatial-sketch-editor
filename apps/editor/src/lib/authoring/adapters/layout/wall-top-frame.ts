/**
 * V2c — where the height-family knobs sit on a Wall top.
 *
 * Both readings read the same canonical development map. Folded, a knob sits on
 * the visible Wall face (offset from the centerline by half the thickness toward
 * the eye) at amount 0 of the development. Unrolled, the same station is read
 * through the live sheet transform, so a knob stays on the drawn top edge as the
 * sheet peels, rotates and changes face. No second geometry path is introduced.
 */
import type { CompiledPhysicalWall, LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	createWallDevelopmentBuffers,
	developmentPointAtStationFromBuffers,
	evaluateWallDevelopment,
	isWallDevelopmentRefusal,
	prepareWallDevelopment,
	wallTopBreakpoints,
	type LayoutDocumentWallFirst,
	type LayoutWallTop,
} from '@portfolio/layout-core/wall';
import {
	isClosedCompiledWall,
	wallUnfoldSamples,
	wallUnfoldSourceSpans,
	type WallUnfoldState,
} from '$lib/layout/wall-unfold';
import { buildWallUnfoldDisplay, unfoldDisplayPointAtStation } from '$lib/layout/wall-unfold-pick';
import type { WallTopKnob } from './wall-top-edits';

export type WallTopKnobSpot = {
	readonly knob: WallTopKnob | 'height';
	readonly station: number;
	/** Local top above the Floor datum, the value the knob edits. */
	readonly topLocal: number;
	readonly anchor: readonly [number, number, number];
	readonly stem: readonly [number, number, number];
};

type StationContext = {
	readonly wall: CompiledPhysicalWall;
	readonly layout: LayoutDocumentWallFirst;
	readonly datumMeters: number;
	readonly eye: readonly [number, number, number];
	readonly unfold: { readonly state: WallUnfoldState; readonly sideAngle: number } | null;
};

function sideTowardEye(
	eye: readonly [number, number, number],
	point: LayoutVec2,
	normal: LayoutVec2,
): number {
	const facing = (eye[0] - point[0]) * normal[0] + (eye[2] - point[1]) * normal[1];
	return facing >= 0 ? 1 : -1;
}

/** The point and outward normal of one station in the current reading. */
function wallStationSpot(
	context: StationContext,
	station: number,
): { readonly point: LayoutVec2; readonly normal: LayoutVec2 } | null {
	const { wall, layout, datumMeters, unfold } = context;
	if (unfold !== null) {
		const display = buildWallUnfoldDisplay(wall, unfold.state, {
			floorY: datumMeters,
			spans: wallUnfoldSourceSpans(layout, wall.wallId, wall.length),
			sideAngle: unfold.sideAngle,
		});
		return display === null
			? null
			: unfoldDisplayPointAtStation(display, station, unfold.sideAngle);
	}
	const development = prepareWallDevelopment({
		wallId: wall.wallId,
		samples: wallUnfoldSamples(wall),
		closed: isClosedCompiledWall(wall),
		anchorStation: 0,
		cutStation: null,
	});
	if (isWallDevelopmentRefusal(development)) return null;
	const buffers = createWallDevelopmentBuffers(development);
	evaluateWallDevelopment(development, 0, buffers);
	return developmentPointAtStationFromBuffers(development, buffers, station);
}

function spotAt(
	context: StationContext,
	knob: WallTopKnobSpot['knob'],
	station: number,
	topLocal: number,
): WallTopKnobSpot | null {
	const mapped = wallStationSpot(context, station);
	if (mapped === null) return null;
	const side = sideTowardEye(context.eye, mapped.point, mapped.normal);
	const folded = context.unfold === null;
	const offset = folded ? context.wall.thickness / 2 + 0.02 : 0.03;
	const x = mapped.point[0] + mapped.normal[0] * side * offset;
	const z = mapped.point[1] + mapped.normal[1] * side * offset;
	return {
		knob,
		station,
		topLocal,
		anchor: [x, context.datumMeters + topLocal, z],
		stem: [x, context.datumMeters, z],
	};
}

/** Start, apex (gable only) and end knobs; a level top has no shape knobs. */
export function wallTopBreakpointSpots(
	context: StationContext & { readonly top: LayoutWallTop; readonly height: number },
): WallTopKnobSpot[] {
	const { top, height } = context;
	if (top.kind === 'level') return [];
	const points = wallTopBreakpoints(top, context.wall.length);
	const start = points[0]!;
	const end = points[points.length - 1]!;
	const spots: WallTopKnobSpot[] = [];
	const startSpot = spotAt(context, 'start', start.distance, height + start.rise);
	if (startSpot !== null) spots.push(startSpot);
	if (top.kind === 'gable') {
		const apex = points[1]!;
		const apexSpot = spotAt(context, 'apex', apex.distance, height + apex.rise);
		if (apexSpot !== null) spots.push(apexSpot);
	}
	const endSpot = spotAt(context, 'end', end.distance, height + end.rise);
	if (endSpot !== null) spots.push(endSpot);
	return spots;
}

/**
 * The Height (eave) knob: at the lower end of the top, so its drawn height is
 * the authored `height` it rigidly edits. It remains available in both readings.
 */
export function wallHeightKnobSpot(
	context: StationContext & { readonly top: LayoutWallTop; readonly height: number },
): WallTopKnobSpot | null {
	const { top, height } = context;
	const points = wallTopBreakpoints(top, context.wall.length);
	const start = points[0]!;
	const end = points[points.length - 1]!;
	const station = start.rise <= end.rise ? start.distance : end.distance;
	return spotAt(context, 'height', station, height);
}
