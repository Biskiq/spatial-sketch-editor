import type { LayoutVec2 } from '../../geometry/coordinates';
import { countWork } from '../../kernel/work-observer';
import { createWallDevelopmentBuffers, evaluateWallDevelopment } from './core';
import {
	DEVELOPMENT_EPSILON,
	clamp,
	lerp,
	nearestAngle,
	normalizeVector,
	wrap,
	wrapSignedAngle,
} from './shared';
import type {
	WallDevelopment,
	WallDevelopmentBuffers,
	WallDevelopmentPoint,
	WallDevelopmentSheetBuffers,
} from './types';

export function createWallDevelopmentSheetBuffers(
	development: WallDevelopment,
): WallDevelopmentSheetBuffers {
	const length = development.length;
	const cut =
		development.closed && development.cutStation !== null
			? wrap(development.cutStation, length)
			: development.anchorStation;
	const at = (station: number): { point: LayoutVec2; theta: number } => {
		const target = clamp(station, 0, length);
		let low = 0;
		let high = development.sampleCount - 1;
		while (low < high - 1) {
			const middle = (low + high) >> 1;
			if (development.s[middle]! <= target) low = middle;
			else high = middle;
		}
		const start = development.s[low]!;
		const end = development.s[high]!;
		const span = end - start;
		const amount = span > DEVELOPMENT_EPSILON ? (target - start) / span : 0;
		return {
			point: [
				development.points[low * 2]! +
					(development.points[high * 2]! - development.points[low * 2]!) * amount,
				development.points[low * 2 + 1]! +
					(development.points[high * 2 + 1]! - development.points[low * 2 + 1]!) * amount,
			],
			theta:
				development.theta[low]! + (development.theta[high]! - development.theta[low]!) * amount,
		};
	};
	const cutSample = at(cut);
	const entries: Array<{ station: number; sheet: number; point: LayoutVec2; theta: number }> = [
		{ station: cut, sheet: 0, point: cutSample.point, theta: cutSample.theta },
	];
	for (let index = 0; index < development.sampleCount; index += 1) {
		const station = development.s[index]!;
		if (station <= cut + DEVELOPMENT_EPSILON) continue;
		entries.push({
			station,
			sheet: station - cut,
			point: [development.points[index * 2]!, development.points[index * 2 + 1]!],
			theta: development.theta[index]!,
		});
	}
	for (let index = 0; index < development.sampleCount; index += 1) {
		const station = development.s[index]!;
		if (station >= cut - DEVELOPMENT_EPSILON) continue;
		entries.push({
			station,
			sheet: length - cut + station,
			point: [development.points[index * 2]!, development.points[index * 2 + 1]!],
			theta: development.theta[index]!,
		});
	}
	entries.push({
		station: cut,
		sheet: length,
		point: cutSample.point,
		theta: cutSample.theta,
	});

	const count = entries.length;
	const sheet = new Float64Array(count);
	const stations = new Float64Array(count);
	const theta = new Float64Array(count);
	const phi = new Float64Array(count - 1);
	const deltaS = new Float64Array(count - 1);
	const correctedEll = new Float64Array(count - 1);
	let anchorIndex = 0;
	let anchorDistance = Infinity;
	for (let index = 0; index < count; index += 1) {
		const entry = entries[index]!;
		sheet[index] = entry.sheet;
		stations[index] = entry.station;
		const distance = Math.abs(entry.station - development.anchorStation);
		if (distance < anchorDistance) {
			anchorDistance = distance;
			anchorIndex = index;
		}
	}
	// Accumulate signed tangent deviations outward from the pin, in sheet order.
	// Each wing starts at zero, so the loop's two ends approach the cut from
	// opposite sides instead of one wing carrying the full turn. At u = 0 the
	// positions are unchanged (only cos/sin of the same physical angle are used);
	// at partial u the two wings extend away from the pin together.
	theta[anchorIndex] = 0;
	for (let index = anchorIndex + 1; index < count; index += 1) {
		theta[index] =
			theta[index - 1]! + wrapSignedAngle(entries[index]!.theta - entries[index - 1]!.theta);
	}
	for (let index = anchorIndex - 1; index >= 0; index -= 1) {
		theta[index] =
			theta[index + 1]! - wrapSignedAngle(entries[index + 1]!.theta - entries[index]!.theta);
	}
	for (let index = 0; index < count - 1; index += 1) {
		const start = entries[index]!;
		const end = entries[index + 1]!;
		const dx = end.point[0] - start.point[0];
		const dz = end.point[1] - start.point[1];
		const ell = Math.hypot(dx, dz);
		const halfTurn = (theta[index + 1]! - theta[index]!) / 2;
		// Chord angles are taken from the canonical chord and placed on the branch
		// nearest this span's developed tangent midpoint. At u = 0 that is the
		// exact source chord; at partial u it is the signed arc's chord direction.
		phi[index] = nearestAngle(
			Math.atan2(dz, dx) - development.anchorDirection,
			(theta[index]! + theta[index + 1]!) / 2,
		);
		deltaS[index] = end.sheet - start.sheet;
		correctedEll[index] = ell / (Math.abs(halfTurn) <= 1e-12 ? 1 : Math.sin(halfTurn) / halfTurn);
	}
	return {
		points: new Float64Array(count * 2),
		normals: new Float64Array(count * 2),
		sheet,
		stations,
		theta,
		phi,
		deltaS,
		correctedEll,
		anchorIndex,
	};
}

/**
 * Evaluate the cut-to-cut sheet. Both wings relax from the anchor (the pin);
 * at `u = 1` each segment advances along the anchor tangent by its canonical
 * arc length, so the flat strip is exact and the two cut copies are its ends.
 */
export function evaluateWallDevelopmentSheet(
	development: WallDevelopment,
	u: number,
	out: WallDevelopmentSheetBuffers,
): void {
	const count = out.sheet.length;
	if (out.points.length !== count * 2 || out.normals.length !== count * 2) {
		throw new Error('evaluateWallDevelopmentSheet buffers must match the sheet sample count.');
	}
	countWork('unfold:development-sample', count);
	const amount = clamp(u, 0, 1);
	const anchor = out.anchorIndex;
	const thetaA = development.anchorDirection;
	const points = out.points;
	const normals = out.normals;
	points[anchor * 2] = development.anchorPoint[0];
	points[anchor * 2 + 1] = development.anchorPoint[1];

	const segmentLength = (index: number): number => {
		const halfTurn = (out.theta[index + 1]! - out.theta[index]!) / 2;
		const relaxedHalfTurn = (1 - amount) * halfTurn;
		const sinc =
			Math.abs(relaxedHalfTurn) <= 1e-12 ? 1 : Math.sin(relaxedHalfTurn) / relaxedHalfTurn;
		const correction =
			out.correctedEll[index]! > 0
				? 1 + amount * (out.deltaS[index]! / out.correctedEll[index]! - 1)
				: 0;
		return out.correctedEll[index]! * sinc * correction;
	};

	for (let index = anchor; index < count - 1; index += 1) {
		const direction = thetaA + (1 - amount) * out.phi[index]!;
		const length = segmentLength(index);
		points[(index + 1) * 2] = points[index * 2]! + length * Math.cos(direction);
		points[(index + 1) * 2 + 1] = points[index * 2 + 1]! + length * Math.sin(direction);
	}
	for (let index = anchor - 1; index >= 0; index -= 1) {
		const direction = thetaA + (1 - amount) * out.phi[index]!;
		const length = segmentLength(index);
		points[index * 2] = points[(index + 1) * 2]! - length * Math.cos(direction);
		points[index * 2 + 1] = points[(index + 1) * 2 + 1]! - length * Math.sin(direction);
	}
	for (let index = 0; index < count; index += 1) {
		const angle = thetaA + (1 - amount) * out.theta[index]! + Math.PI / 2;
		normals[index * 2] = Math.cos(angle);
		normals[index * 2 + 1] = Math.sin(angle);
	}
}

/** Interpolate one point on the evaluated cut-to-cut sheet. */ export function developmentPointAtSheetFromBuffers(
	buffers: WallDevelopmentSheetBuffers,
	sheet: number,
): { point: LayoutVec2; normal: LayoutVec2; sheet: number } {
	return developmentPointAtSheetFromBuffersUnchecked(buffers, sheet);
}

function developmentPointAtSheetFromBuffersUnchecked(
	buffers: WallDevelopmentSheetBuffers,
	sheet: number,
): { point: LayoutVec2; normal: LayoutVec2; sheet: number } {
	const length = buffers.sheet.at(-1) ?? 0;
	const target = clamp(sheet, 0, length);
	let low = 0;
	let high = buffers.sheet.length - 1;
	while (low < high - 1) {
		const middle = (low + high) >> 1;
		if (buffers.sheet[middle]! <= target) low = middle;
		else high = middle;
	}
	const startSheet = buffers.sheet[low]!;
	const endSheet = buffers.sheet[high]!;
	const span = endSheet - startSheet;
	const amount = span > DEVELOPMENT_EPSILON ? (target - startSheet) / span : 0;
	const startPoint: LayoutVec2 = [buffers.points[low * 2]!, buffers.points[low * 2 + 1]!];
	const endPoint: LayoutVec2 = [buffers.points[high * 2]!, buffers.points[high * 2 + 1]!];
	const startNormal: LayoutVec2 = [buffers.normals[low * 2]!, buffers.normals[low * 2 + 1]!];
	const endNormal: LayoutVec2 = [buffers.normals[high * 2]!, buffers.normals[high * 2 + 1]!];
	return {
		point: lerp(startPoint, endPoint, amount),
		normal: normalizeVector(lerp(startNormal, endNormal, amount), startNormal),
		sheet: target,
	};
}

/** Map one canonical station through the developed sample polyline at `u`. */
export function developmentPointAtStation(
	development: WallDevelopment,
	u: number,
	station: number,
): WallDevelopmentPoint {
	const buffers = createWallDevelopmentBuffers(development);
	evaluateWallDevelopment(development, u, buffers);
	return developmentPointAtStationFromBuffers(development, buffers, station);
}

export function developmentPointAtStationFromBuffers(
	development: WallDevelopment,
	buffers: WallDevelopmentBuffers,
	station: number,
): WallDevelopmentPoint {
	const target = clamp(station, 0, development.length);
	let low = 0;
	let high = development.sampleCount - 1;
	while (low < high - 1) {
		const middle = (low + high) >> 1;
		if (development.s[middle]! <= target) low = middle;
		else high = middle;
	}
	const startStation = development.s[low]!;
	const endStation = development.s[high]!;
	const span = endStation - startStation;
	const amount = span > DEVELOPMENT_EPSILON ? (target - startStation) / span : 0;
	const startPoint: LayoutVec2 = [buffers.points[low * 2]!, buffers.points[low * 2 + 1]!];
	const endPoint: LayoutVec2 = [buffers.points[high * 2]!, buffers.points[high * 2 + 1]!];
	const startNormal: LayoutVec2 = [buffers.normals[low * 2]!, buffers.normals[low * 2 + 1]!];
	const endNormal: LayoutVec2 = [buffers.normals[high * 2]!, buffers.normals[high * 2 + 1]!];
	const normal = normalizeVector(lerp(startNormal, endNormal, amount), startNormal);
	return {
		point: lerp(startPoint, endPoint, amount),
		normal,
		station: target,
	};
}

/**
 * At `u = 1`, the distance from the anchor to a station along the developed
 * straight line. For an open Wall anchored at 0 this is the requested `s`.
 */
export function developmentStationDistanceFromAnchor(
	development: WallDevelopment,
	station: number,
): number {
	return station - development.anchorStation;
}

/**
 * Displayed sheet coordinate. Open Walls keep the anchor-relative station;
 * closed Walls rotate the sheet so the display cut is at 0/L.
 */
export function developmentSheetCoordinate(development: WallDevelopment, station: number): number {
	if (!development.closed || development.cutStation === null) {
		return station - development.anchorStation;
	}
	return wrap(station - development.cutStation, development.length);
}

export function developmentSheetToStation(development: WallDevelopment, sheet: number): number {
	if (!development.closed || development.cutStation === null) {
		return sheet + development.anchorStation;
	}
	return wrap(sheet + development.cutStation, development.length);
}

/**
 * Map a compiled mesh's `(station, offset, height)` attribution through the
 * development at any `u`. The buffers are caller-owned; this is O(vertices)
 * and allocates nothing. `outNormals` receives the developed surface normal.
 */
export function mapAttributedVertices(
	development: WallDevelopment,
	buffers: WallDevelopmentBuffers,
	attribution: Float32Array | Float64Array,
	floorY: number,
	outPositions: Float32Array | Float64Array,
	outNormals: Float32Array | Float64Array,
): void {
	if (attribution.length % 3 !== 0) {
		throw new Error('Attribution must hold three values per vertex.');
	}
	const vertexCount = attribution.length / 3;
	if (outPositions.length !== vertexCount * 3 || outNormals.length !== vertexCount * 3) {
		throw new Error('Mapped position and normal buffers must hold one XYZ per vertex.');
	}
	countWork('unfold:vertex-map', vertexCount);
	for (let index = 0; index < vertexCount; index += 1) {
		const station = attribution[index * 3]!;
		const lateral = attribution[index * 3 + 1]!;
		const height = attribution[index * 3 + 2]!;
		const mapped = developmentPointAtStationFromBuffers(development, buffers, station);
		outPositions[index * 3] = mapped.point[0] + mapped.normal[0] * lateral;
		outPositions[index * 3 + 1] = floorY + height;
		outPositions[index * 3 + 2] = mapped.point[1] + mapped.normal[1] * lateral;
		outNormals[index * 3] = mapped.normal[0];
		outNormals[index * 3 + 1] = 0;
		outNormals[index * 3 + 2] = mapped.normal[1];
	}
}
