import type { LayoutVec2 } from '../coordinates';
import type { CurveSample } from './contracts';
import { pointAlongSamples } from './samples';

/**
 * The Opening centre frame, shared by the compiler and the Plan
 * symbol of a refused attempt. A closed host is periodic: distances wrap
 * modulo its length. An open host normally clamps to its ends; the
 * `unclamped` mode (attempts only) extends the end tangents instead, so an
 * attempt overhanging its Wall is drawn at its raw position, never clamped.
 */
export const OPENING_CENTER_EPSILON = 0.01;


export type OpeningHostSamples = { readonly length: number; readonly samples: readonly CurveSample[] };

export type OpeningCenterMode = 'clamped' | 'unclamped';


export function sampledIsClosed(sampled: OpeningHostSamples): boolean {
	const first = sampled.samples[0]?.point;
	const last = sampled.samples.at(-1)?.point;
	return (
		first !== undefined &&
		last !== undefined &&
		Math.abs(first[0] - last[0]) <= OPENING_CENTER_EPSILON &&
		Math.abs(first[1] - last[1]) <= OPENING_CENTER_EPSILON
	);
}


function pointAlongOpeningHost(
	samples: readonly CurveSample[],
	distance: number,
	mode: OpeningCenterMode
): LayoutVec2 {
	if (mode === 'unclamped' && samples.length > 1) {
		const first = samples[0]!;
		const last = samples.at(-1)!;
		if (distance < 0) return [first.point[0] + first.tangent[0] * distance, first.point[1] + first.tangent[1] * distance];
		const beyond = distance - last.distance;
		if (beyond > 0) return [last.point[0] + last.tangent[0] * beyond, last.point[1] + last.tangent[1] * beyond];
	}
	return pointAlongSamples(samples, distance);
}


/** The centre point, wrapped centre distance and unit tangent of the span [offset, offset + width]. */
export function openingCenterFrame(
	sampled: OpeningHostSamples,
	offset: number,
	width: number,
	mode: OpeningCenterMode = 'clamped'
): { point: LayoutVec2; distance: number; tangent: LayoutVec2; yaw: number; closedHost: boolean } {
	const closedHost = sampledIsClosed(sampled);
	const rawCenterDistance = offset + width / 2;
	const distance = closedHost
		? ((rawCenterDistance % sampled.length) + sampled.length) % sampled.length
		: rawCenterDistance;
	const pointAtDistance = (at: number): LayoutVec2 => {
		if (!closedHost) return pointAlongOpeningHost(sampled.samples, at, mode);
		const wrapped = ((at % sampled.length) + sampled.length) % sampled.length;
		return pointAlongSamples(sampled.samples, wrapped);
	};
	const point = pointAtDistance(distance);
	const before = pointAtDistance(distance - OPENING_CENTER_EPSILON);
	const after = pointAtDistance(distance + OPENING_CENTER_EPSILON);
	const tangentX = after[0] - before[0];
	const tangentZ = after[1] - before[1];
	const magnitude = Math.hypot(tangentX, tangentZ) || 1;
	return {
		point,
		distance,
		tangent: [tangentX / magnitude, tangentZ / magnitude],
		yaw: -Math.atan2(tangentZ, tangentX),
		closedHost
	};
}


/**
 * The Opening's centre-line polyline over [start, end]. On a closed host a span
 * crossing the seam is the two physical pieces joined without a chord.
 */
export function openingCenterPolyline(
	sampled: OpeningHostSamples,
	start: number,
	end: number,
	closedHost = false,
	mode: OpeningCenterMode = 'clamped'
): LayoutVec2[] {
	if (closedHost && sampled.length > 0 && (start < 0 || start >= sampled.length)) {
		// A periodic host: an attempt typed before the seam (or a full turn on)
		// is the same span one period over, so the polyline agrees with the
		// wrapped centre. Compiled Openings already start in [0, length).
		const shift = Math.floor(start / sampled.length) * sampled.length;
		return openingCenterPolyline(sampled, start - shift, end - shift, closedHost, mode);
	}
	if (closedHost && end > sampled.length + OPENING_CENTER_EPSILON) {
		const first = openingCenterPolyline(sampled, start, sampled.length);
		const second = openingCenterPolyline(sampled, 0, end - sampled.length);
		const seam = first.at(-1);
		const continuing = second.length > 0 && seam !== undefined &&
			Math.abs(seam[0] - second[0]![0]) <= OPENING_CENTER_EPSILON &&
			Math.abs(seam[1] - second[0]![1]) <= OPENING_CENTER_EPSILON
			? second.slice(1)
			: second;
		return [...first, ...continuing];
	}
	const hostMode: OpeningCenterMode = closedHost ? 'clamped' : mode;
	const points: LayoutVec2[] = [pointAlongOpeningHost(sampled.samples, start, hostMode)];
	for (const sample of sampled.samples) {
		if (sample.distance > start + 1e-6 && sample.distance < end - 1e-6) points.push([...sample.point] as LayoutVec2);
	}
	points.push(pointAlongOpeningHost(sampled.samples, end, hostMode));
	return points;
}
