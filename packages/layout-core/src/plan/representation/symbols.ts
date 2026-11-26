import type { OpeningHostSamples } from '../../geometry/curve';
import { openingCenterFrame, openingCenterPolyline } from '../../geometry/curve';
import type { CompiledOpening } from '../../geometry/types';
import type { LayoutVec2 } from '../../geometry/coordinates';

/**
 * The one restrained Plan symbol for an Opening: jambs plus a sill
 * pair for a window; jambs, leaf and a dashed swing arc for a door. Accepted
 * Openings (Paper) and refused attempts (candidate preview) both draw it, so
 * the two can never disagree.
 */
export type OpeningPlanSymbolSource = {
	readonly kind: CompiledOpening['kind'];
	readonly width: number;
	readonly center: { readonly point: LayoutVec2; readonly tangent: LayoutVec2 };
	readonly centerPolyline: readonly LayoutVec2[];
};

export type OpeningPlanSymbolSegment = readonly [LayoutVec2, LayoutVec2];

export type OpeningPlanSymbol = {
	readonly segments: OpeningPlanSymbolSegment[];
	readonly dashedSegments: OpeningPlanSymbolSegment[];
};

function symbolPolylineSegments(points: readonly LayoutVec2[]): OpeningPlanSymbolSegment[] {
	return points.slice(1).map((point, index) => [points[index]!, point] as const);
}

function offsetOpeningPolyline(points: readonly LayoutVec2[], offsetMeters: number): LayoutVec2[] {
	return points.map((point, index) => {
		const before = points[Math.max(0, index - 1)]!;
		const after = points[Math.min(points.length - 1, index + 1)]!;
		const dx = after[0] - before[0];
		const dz = after[1] - before[1];
		const length = Math.hypot(dx, dz);
		if (!(length > 0)) return [point[0], point[1]];
		const nx = -dz / length;
		const nz = dx / length;
		return [point[0] + nx * offsetMeters, point[1] + nz * offsetMeters];
	});
}

export function openingPlanSymbol(
	opening: OpeningPlanSymbolSource,
	thickness: number,
): OpeningPlanSymbol {
	const nearFace = offsetOpeningPolyline(opening.centerPolyline, -thickness / 2);
	const farFace = offsetOpeningPolyline(opening.centerPolyline, thickness / 2);
	const jambs: OpeningPlanSymbolSegment[] =
		nearFace.length === 0 || farFace.length === 0
			? []
			: [
					[nearFace[0]!, farFace[0]!],
					[nearFace.at(-1)!, farFace.at(-1)!],
				];
	if (opening.kind === 'window') {
		const inset = thickness * 0.2;
		return {
			segments: [
				...jambs,
				...symbolPolylineSegments(offsetOpeningPolyline(opening.centerPolyline, -inset)),
				...symbolPolylineSegments(offsetOpeningPolyline(opening.centerPolyline, inset)),
			],
			dashedSegments: [],
		};
	}
	const tangentRaw: LayoutVec2 =
		opening.centerPolyline.length > 1
			? [
					opening.centerPolyline[1]![0] - opening.centerPolyline[0]![0],
					opening.centerPolyline[1]![1] - opening.centerPolyline[0]![1],
				]
			: opening.center.tangent;
	const tangentLength = Math.hypot(tangentRaw[0], tangentRaw[1]) || 1;
	const tangent: LayoutVec2 = [tangentRaw[0] / tangentLength, tangentRaw[1] / tangentLength];
	const normal: LayoutVec2 = [-tangent[1], tangent[0]];
	const hinge = nearFace[0] ?? opening.center.point;
	const arc: LayoutVec2[] = [];
	for (let index = 0; index <= 18; index += 1) {
		const angle = ((index / 18) * Math.PI) / 2;
		arc.push([
			hinge[0] +
				normal[0] * opening.width * Math.cos(angle) +
				tangent[0] * opening.width * Math.sin(angle),
			hinge[1] +
				normal[1] * opening.width * Math.cos(angle) +
				tangent[1] * opening.width * Math.sin(angle),
		]);
	}
	const leafEnd: LayoutVec2 = [
		hinge[0] + normal[0] * opening.width,
		hinge[1] + normal[1] * opening.width,
	];
	return { segments: [...jambs, [hinge, leafEnd]], dashedSegments: symbolPolylineSegments(arc) };
}

/**
 * The symbol source of an Opening attempt at raw `offset`/`width` on a compiled
 * Wall: the compiler's own centre frame and polyline, unclamped, so an attempt
 * overhanging its Wall is drawn where it was typed or pointed.
 */
export function openingAttemptSymbolSource(
	wall: OpeningHostSamples,
	values: {
		readonly kind: CompiledOpening['kind'];
		readonly offset: number;
		readonly width: number;
	},
): OpeningPlanSymbolSource {
	const frame = openingCenterFrame(wall, values.offset, values.width, 'unclamped');
	return {
		kind: values.kind,
		width: values.width,
		center: { point: frame.point, tangent: frame.tangent },
		centerPolyline: openingCenterPolyline(
			wall,
			values.offset,
			values.offset + values.width,
			frame.closedHost,
			'unclamped',
		),
	};
}
