import { CubicBezierCurve3, CurvePath, Vector3 } from 'three';
import { CAMERA_MOTION_PATH } from './motion';
import type { CompiledPositionPart } from './paths';

function nearestDistinctPoint(points: readonly Vector3[], index: number, direction: -1 | 1) {
	const point = points[index];
	for (
		let candidateIndex = index + direction;
		candidateIndex >= 0 && candidateIndex < points.length;
		candidateIndex += direction
	) {
		const candidate = points[candidateIndex];
		if (!candidate.equals(point)) return candidate;
	}
	return null;
}

function centripetalInterval(from: Vector3, to: Vector3) {
	return Math.pow(from.distanceTo(to), CAMERA_MOTION_PATH.autoBezierAlpha);
}

function createAutomaticTangent(points: readonly Vector3[], index: number) {
	const point = points[index];
	const previous = nearestDistinctPoint(points, index, -1);
	const next = nearestDistinctPoint(points, index, 1);

	if (!previous && !next) return new Vector3();

	if (!previous) {
		const interval = centripetalInterval(point, next!);
		return next!.clone().sub(point).divideScalar(interval);
	}

	if (!next) {
		const interval = centripetalInterval(previous, point);
		return point.clone().sub(previous).divideScalar(interval);
	}

	const previousInterval = centripetalInterval(previous, point);
	const nextInterval = centripetalInterval(point, next);
	const incoming = point
		.clone()
		.sub(previous)
		.multiplyScalar(nextInterval / previousInterval);
	const outgoing = next
		.clone()
		.sub(point)
		.multiplyScalar(previousInterval / nextInterval);

	return incoming.add(outgoing).divideScalar(previousInterval + nextInterval);
}

function createAutoBezierPath(anchors: readonly Vector3[]) {
	const path = new CurvePath<Vector3>();

	if (anchors.length === 1) {
		path.add(
			new CubicBezierCurve3(
				anchors[0].clone(),
				anchors[0].clone(),
				anchors[0].clone(),
				anchors[0].clone(),
			),
		);
		return path;
	}

	if (anchors.length === 2 && !anchors[0].equals(anchors[1])) {
		path.add(
			new CubicBezierCurve3(
				anchors[0].clone(),
				anchors[0].clone().lerp(anchors[1], 1 / 3),
				anchors[0].clone().lerp(anchors[1], 2 / 3),
				anchors[1].clone(),
			),
		);
		return path;
	}

	const tangents = anchors.map((_anchor, index) => createAutomaticTangent(anchors, index));

	for (let index = 0; index < anchors.length - 1; index += 1) {
		const start = anchors[index];
		const end = anchors[index + 1];
		const interval = centripetalInterval(start, end);

		if (interval === 0) {
			path.add(new CubicBezierCurve3(start.clone(), start.clone(), end.clone(), end.clone()));
			continue;
		}

		path.add(
			new CubicBezierCurve3(
				start.clone(),
				start.clone().addScaledVector(tangents[index], interval / 3),
				end.clone().addScaledVector(tangents[index + 1], -interval / 3),
				end.clone(),
			),
		);
	}

	return path;
}

export function compileAutoBezierPositionPart(anchors: readonly Vector3[]): CompiledPositionPart {
	const path = createAutoBezierPath(anchors);
	const pointDistances = new Array<number>(anchors.length);
	pointDistances[0] = 0;
	let totalDistance = 0;

	for (let index = 0; index < anchors.length - 1; index += 1) {
		totalDistance += path.curves[index].getLength();
		pointDistances[index + 1] = totalDistance;
	}

	return { path, pointDistances, totalDistance };
}
