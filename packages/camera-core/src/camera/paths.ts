import { CurvePath, LineCurve3, QuadraticBezierCurve3, Vector3 } from 'three';
import { CAMERA_FOV } from '../scene-types';
import { CAMERA_MOTION_PATH } from './motion';
import type {
	CameraPositionDistanceSpan,
	CameraPositionPathLocation,
	CameraPositionPathPart,
	CameraPositionPathSpan,
	CameraRouteEdge,
	CameraRouteView,
	CompiledCameraPositionPath,
	PreparedCameraRouteEdge,
	PreparedCameraRouteView,
	PreparedCameraRouteViewTrack,
	PreparedPositionPathPart,
	Vector3Like,
} from './types';
import { compileAutoBezierPositionPart } from './auto-bezier';

function isVectorTuple(value: Vector3Like): value is readonly [number, number, number] {
	return Array.isArray(value);
}

export function readVector3(value: Vector3Like, label: string) {
	const components = isVectorTuple(value) ? value : [value.x, value.y, value.z];

	if (components.length !== 3 || components.some((component) => !Number.isFinite(component))) {
		throw new Error(`${label} must contain exactly three finite numbers`);
	}

	return new Vector3(components[0], components[1], components[2]);
}

export function readFov(value: number, label: string) {
	if (!Number.isFinite(value) || value < CAMERA_FOV.min || value > CAMERA_FOV.max) {
		throw new Error(
			`${label} must be a finite number between ${CAMERA_FOV.min} and ${CAMERA_FOV.max}`,
		);
	}
	return value;
}

export function clonePoints(points: readonly Vector3Like[], label: string) {
	return points.map((point, index) => readVector3(point, `${label}[${index}]`));
}

function prepareRouteView(view: CameraRouteView, label: string): PreparedCameraRouteView {
	return {
		cameraTarget: readVector3(view.cameraTarget, `${label} cameraTarget`),
		fov: readFov(view.fov, `${label} fov`),
	};
}

export function prepareRouteEdge(
	edge: CameraRouteEdge,
	edgeIndex: number,
): PreparedCameraRouteEdge {
	const label = `Camera route edge[${edgeIndex}]`;
	if (edge.direction !== 'forward' && edge.direction !== 'reverse') {
		throw new Error(`${label} has an unknown direction`);
	}

	let viewTrack: PreparedCameraRouteViewTrack | undefined;
	if (edge.viewTrack) {
		let previousProgress = 0;
		const keyframeIds = new Set<string>();
		const keyframes = edge.viewTrack.keyframes.map((keyframe, keyframeIndex) => {
			const keyframeLabel = `${label} view keyframe[${keyframeIndex}]`;
			if (keyframe.id.trim().length === 0) {
				throw new Error(`${keyframeLabel} id must be non-empty`);
			}
			if (keyframeIds.has(keyframe.id)) {
				throw new Error(`${keyframeLabel} id must be unique within the edge track`);
			}
			keyframeIds.add(keyframe.id);
			if (
				!Number.isFinite(keyframe.progress) ||
				keyframe.progress <= previousProgress ||
				keyframe.progress >= 1
			) {
				throw new Error(
					`${keyframeLabel} progress must be finite, strictly increasing, and inside (0, 1)`,
				);
			}
			previousProgress = keyframe.progress;
			return {
				id: keyframe.id,
				progress: keyframe.progress,
				...prepareRouteView(keyframe, keyframeLabel),
			};
		});
		viewTrack = {
			start: prepareRouteView(edge.viewTrack.start, `${label} start view`),
			keyframes,
			end: prepareRouteView(edge.viewTrack.end, `${label} end view`),
			...(edge.viewTrack.framingEnvelope === undefined
				? {}
				: { framingEnvelope: { ...edge.viewTrack.framingEnvelope } }),
		};
	}

	const automaticTargetPoints = edge.automaticTargetPoints
		? clonePoints(edge.automaticTargetPoints, `${label} automatic target`)
		: undefined;
	if (automaticTargetPoints?.length === 0) {
		throw new Error(`${label} automatic targets must contain at least one point`);
	}

	return {
		connectionId: edge.connectionId,
		direction: edge.direction,
		fromNodeId: edge.fromNodeId,
		toNodeId: edge.toNodeId,
		positionSpan: {
			start: { ...edge.positionSpan.start },
			end: { ...edge.positionSpan.end },
		},
		...(viewTrack ? { viewTrack } : {}),
		...(automaticTargetPoints ? { automaticTargetPoints } : {}),
	};
}

function pointsForPart(part: PreparedPositionPathPart) {
	return part.kind === 'rounded-polyline' ? part.points : part.anchors;
}

export function preparePositionParts(parts: readonly CameraPositionPathPart[]) {
	if (parts.length === 0) {
		throw new Error('Camera route must contain at least one position path part');
	}

	const prepared = parts.map((part, partIndex): PreparedPositionPathPart => {
		if (part.kind === 'rounded-polyline') {
			if (part.points.length === 0) {
				throw new Error(`Camera route position part[${partIndex}] must contain at least one point`);
			}
			if (
				part.clearance !== undefined &&
				(!Number.isFinite(part.clearance) || part.clearance < 0)
			) {
				throw new Error(
					`Camera route position part[${partIndex}] clearance must be a finite non-negative number`,
				);
			}
			return {
				kind: part.kind,
				points: clonePoints(part.points, `Camera route position part[${partIndex}] point`),
				clearance: part.clearance,
			};
		}

		if (part.kind === 'auto-bezier') {
			if (part.anchors.length === 0) {
				throw new Error(
					`Camera route position part[${partIndex}] must contain at least one anchor`,
				);
			}
			return {
				kind: part.kind,
				anchors: clonePoints(part.anchors, `Camera route position part[${partIndex}] anchor`),
			};
		}

		throw new Error(`Camera route position part[${partIndex}] has an unknown kind`);
	});

	for (let index = 1; index < prepared.length; index += 1) {
		const previousPoints = pointsForPart(prepared[index - 1]);
		const currentPoints = pointsForPart(prepared[index]);
		if (!previousPoints.at(-1)?.equals(currentPoints[0])) {
			throw new Error(
				`Camera route position parts ${index - 1} and ${index} must form a contiguous join`,
			);
		}
	}

	return prepared;
}

export function countOrderedPositionPoints(parts: readonly PreparedPositionPathPart[]) {
	return parts.reduce((count, part, index) => {
		const pointCount = pointsForPart(part).length;
		return count + pointCount - (index === 0 ? 0 : 1);
	}, 0);
}

export function replacePreparedStartPosition(
	parts: PreparedPositionPathPart[],
	startPosition: Vector3,
) {
	for (const part of parts) {
		const points = pointsForPart(part);
		points[0] = startPosition.clone();
		if (points.length > 1) return;
	}
}

export type CompiledPositionPart = {
	path: CurvePath<Vector3>;
	pointDistances: number[];
	totalDistance: number;
};

function splitQuadraticAtMidpoint(curve: QuadraticBezierCurve3) {
	const firstControl = curve.v0.clone().lerp(curve.v1, 0.5);
	const secondControl = curve.v1.clone().lerp(curve.v2, 0.5);
	const midpoint = firstControl.clone().lerp(secondControl, 0.5);
	const first = new QuadraticBezierCurve3(curve.v0.clone(), firstControl, midpoint);
	const second = new QuadraticBezierCurve3(midpoint.clone(), secondControl, curve.v2.clone());

	// Preserve the original curve's arc-length sampling grid exactly: each half
	// owns the same number of original parameter intervals that it replaced.
	const firstDivisions = Math.max(1, Math.floor(curve.arcLengthDivisions / 2));
	first.arcLengthDivisions = firstDivisions;
	second.arcLengthDivisions = Math.max(1, curve.arcLengthDivisions - firstDivisions);
	return [first, second] as const;
}

function addRoundedLine(
	path: CurvePath<Vector3>,
	start: Vector3,
	end: Vector3,
	skippedPointIndices: readonly number[],
	points: readonly Vector3[],
	boundaryPointIndices: ReadonlySet<number>,
	pointDistances: number[],
	startDistance: number,
) {
	const rawChain = [start, ...skippedPointIndices.map((index) => points[index]), end];
	const rawCumulativeDistances = [0];
	for (let index = 1; index < rawChain.length; index += 1) {
		rawCumulativeDistances.push(
			rawCumulativeDistances[index - 1] + rawChain[index - 1].distanceTo(rawChain[index]),
		);
	}

	const rawTotalDistance = rawCumulativeDistances.at(-1) ?? 0;
	const lineLength = start.distanceTo(end);
	const boundaryFractions: number[] = [];

	for (const [offset, pointIndex] of skippedPointIndices.entries()) {
		const fraction =
			rawTotalDistance === 0
				? (offset + 1) / (skippedPointIndices.length + 1)
				: rawCumulativeDistances[offset + 1] / rawTotalDistance;
		pointDistances[pointIndex] = startDistance + lineLength * fraction;
		if (boundaryPointIndices.has(pointIndex)) boundaryFractions.push(fraction);
	}

	let cursor = start.clone();
	let previousFraction = 0;
	for (const fraction of boundaryFractions) {
		if (fraction <= previousFraction || fraction >= 1) continue;
		const boundary = start.clone().lerp(end, fraction);
		path.add(new LineCurve3(cursor, boundary));
		cursor = boundary;
		previousFraction = fraction;
	}
	path.add(new LineCurve3(cursor, end.clone()));
	return startDistance + lineLength;
}

function compileRoundedPositionPart(
	points: readonly Vector3[],
	maximumRadius: number,
	boundaryPointIndices: ReadonlySet<number>,
): CompiledPositionPart {
	const path = new CurvePath<Vector3>();
	const pointDistances = new Array<number>(points.length);
	pointDistances[0] = 0;

	if (points.length === 1) {
		path.add(new LineCurve3(points[0].clone(), points[0].clone()));
		return { path, pointDistances, totalDistance: 0 };
	}

	let cursor = points[0].clone();
	let totalDistance = 0;
	let skippedPointIndices: number[] = [];

	for (let index = 1; index < points.length - 1; index += 1) {
		const previous = points[index - 1];
		const corner = points[index];
		const next = points[index + 1];
		const incoming = corner.clone().sub(previous);
		const outgoing = next.clone().sub(corner);
		const trim = Math.min(
			maximumRadius,
			incoming.length() * CAMERA_MOTION_PATH.cornerTrimRatio,
			outgoing.length() * CAMERA_MOTION_PATH.cornerTrimRatio,
		);

		if (trim < 0.01) {
			skippedPointIndices.push(index);
			continue;
		}

		const beforeCorner = corner.clone().addScaledVector(incoming.normalize(), -trim);
		const afterCorner = corner.clone().addScaledVector(outgoing.normalize(), trim);
		totalDistance = addRoundedLine(
			path,
			cursor,
			beforeCorner,
			skippedPointIndices,
			points,
			boundaryPointIndices,
			pointDistances,
			totalDistance,
		);
		skippedPointIndices = [];

		const cornerCurve = new QuadraticBezierCurve3(beforeCorner, corner.clone(), afterCorner);
		if (boundaryPointIndices.has(index)) {
			const [firstHalf, secondHalf] = splitQuadraticAtMidpoint(cornerCurve);
			path.add(firstHalf);
			totalDistance += firstHalf.getLength();
			pointDistances[index] = totalDistance;
			path.add(secondHalf);
			totalDistance += secondHalf.getLength();
		} else {
			path.add(cornerCurve);
			const cornerLength = cornerCurve.getLength();
			pointDistances[index] = totalDistance + cornerLength / 2;
			totalDistance += cornerLength;
		}
		cursor = afterCorner;
	}

	totalDistance = addRoundedLine(
		path,
		cursor,
		points.at(-1)?.clone() ?? cursor.clone(),
		skippedPointIndices,
		points,
		boundaryPointIndices,
		pointDistances,
		totalDistance,
	);
	pointDistances[points.length - 1] = totalDistance;
	return { path, pointDistances, totalDistance };
}

export function createRoundedPath(points: readonly Vector3[], maximumRadius: number) {
	return compileRoundedPositionPart(points, maximumRadius, new Set()).path;
}

function validatePositionPathLocation(
	location: CameraPositionPathLocation,
	parts: readonly PreparedPositionPathPart[],
	label: string,
) {
	if (!Number.isInteger(location.partIndex)) {
		throw new Error(`${label} partIndex must be an integer`);
	}
	const part = parts[location.partIndex];
	if (!part) throw new Error(`${label} references an unknown position part`);
	if (!Number.isInteger(location.pointIndex)) {
		throw new Error(`${label} pointIndex must be an integer`);
	}
	if (!pointsForPart(part)[location.pointIndex]) {
		throw new Error(`${label} references an unknown position point`);
	}
}

export function compilePreparedPositionPath(
	parts: readonly PreparedPositionPathPart[],
	spans: readonly CameraPositionPathSpan[],
): CompiledCameraPositionPath {
	const boundaryPointIndices = parts.map(() => new Set<number>());
	for (const [spanIndex, span] of spans.entries()) {
		validatePositionPathLocation(span.start, parts, `Camera position span[${spanIndex}] start`);
		validatePositionPathLocation(span.end, parts, `Camera position span[${spanIndex}] end`);
		boundaryPointIndices[span.start.partIndex].add(span.start.pointIndex);
		boundaryPointIndices[span.end.partIndex].add(span.end.pointIndex);
	}

	const positionPath = new CurvePath<Vector3>();
	const globalPointDistances: number[][] = [];
	let totalDistance = 0;

	for (const [partIndex, part] of parts.entries()) {
		const compiledPart =
			part.kind === 'rounded-polyline'
				? compileRoundedPositionPart(
						part.points,
						Math.min(
							CAMERA_MOTION_PATH.positionCornerRadius,
							part.clearance ?? CAMERA_MOTION_PATH.positionCornerRadius,
						),
						boundaryPointIndices[partIndex],
					)
				: compileAutoBezierPositionPart(part.anchors);

		globalPointDistances.push(
			compiledPart.pointDistances.map((distance) => totalDistance + distance),
		);
		totalDistance += compiledPart.totalDistance;
		for (const curve of compiledPart.path.curves) positionPath.add(curve);
	}

	// Match CurvePath's own sequential accumulation exactly at the route end.
	totalDistance = positionPath.getLength();
	const finalPointDistances = globalPointDistances.at(-1);
	if (finalPointDistances) {
		finalPointDistances[finalPointDistances.length - 1] = totalDistance;
	}

	const compiledSpans = spans.map((span, spanIndex): CameraPositionDistanceSpan => {
		const startDistance = globalPointDistances[span.start.partIndex][span.start.pointIndex];
		const endDistance = globalPointDistances[span.end.partIndex][span.end.pointIndex];
		if (endDistance < startDistance) {
			throw new Error(`Camera position span[${spanIndex}] ends before it starts`);
		}
		return {
			startDistance,
			endDistance,
			length: endDistance - startDistance,
		};
	});

	return { positionPath, spans: compiledSpans, totalDistance };
}

/**
 * Shared position compiler. Requested spans split cross-edge rounded primitives
 * without changing their geometry and return cumulative path distances.
 */
export function compileCameraPositionPath(
	parts: readonly CameraPositionPathPart[],
	spans: readonly CameraPositionPathSpan[] = [],
	optionalStartPosition?: Vector3Like,
): CompiledCameraPositionPath {
	const prepared = preparePositionParts(parts);
	if (optionalStartPosition && countOrderedPositionPoints(prepared) > 1) {
		replacePreparedStartPosition(
			prepared,
			readVector3(optionalStartPosition, 'Camera start position'),
		);
	}
	return compilePreparedPositionPath(prepared, spans);
}

/** Shared position geometry used by visitor motion, editor helpers, and picking. */
export function createCameraPositionPath(
	parts: readonly CameraPositionPathPart[],
	optionalStartPosition?: Vector3Like,
) {
	return compileCameraPositionPath(parts, [], optionalStartPosition).positionPath;
}
