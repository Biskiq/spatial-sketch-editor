import type { Vec3 } from '../scene-types';
import {
	addVec3,
	crossVec3,
	dotVec3,
	isFiniteVec3,
	normalizeVec3,
	scaleVec3,
	subtractVec3,
	transformPoint,
} from '../viewport-math';
import { isFiniteNumber, sameEvaluationToken } from './state';
import type {
	PointerRay,
	PointerRayResult,
	ProjectWorldResult,
	ViewportEvaluation,
	ViewportEvaluationToken,
	WorkingPlane,
	WorkingPlaneHit,
} from './types';

/**
 * Project a project-world point through the evaluation's **own** matrices.
 *
 * Projection is not a membership or selection decision: the returned visibility is
 * a framing fact (`visible`, `outside-frame`, `clipped`, `behind`), and membership
 * comes from the domain. A stale token refuses instead of projecting through a
 * superseded matrix.
 */
export function projectWorld(
	point: unknown,
	evaluation: ViewportEvaluation,
	expected: ViewportEvaluationToken,
): ProjectWorldResult {
	if (!isFiniteVec3(point)) {
		return {
			kind: 'failed',
			code: 'invalid-point',
			message: 'the point must be a finite project-world triple in meters',
		};
	}
	if (!sameEvaluationToken(evaluation.token, expected)) {
		return {
			kind: 'failed',
			code: 'stale-evaluation',
			message:
				'the supplied evaluation is not the expected one; evaluate the viewport again before projecting',
		};
	}
	const clip = transformPoint(evaluation.viewProjectionMatrix, point);
	if (!clip.every((component) => Number.isFinite(component))) {
		return {
			kind: 'failed',
			code: 'non-finite-projection',
			message: 'the projection produced a non-finite component',
		};
	}
	const w = clip[3];
	const rect = evaluation.rect;
	if (w === 0) {
		return {
			kind: 'failed',
			code: 'non-finite-projection',
			message: 'the point projects with a zero clip-space w',
		};
	}
	const ndcX = clip[0] / w;
	const ndcY = clip[1] / w;
	const ndcZ = clip[2] / w;
	// A point behind a perspective camera has a negative `w`; the orthographic endpoint has no
	// behind, so every point projects (which is what an orthographic Plan means).
	const behind = evaluation.orthographicWeight < 1 && w < 0;
	const visibility: 'visible' | 'outside-frame' | 'clipped' | 'behind' = behind
		? 'behind'
		: Math.abs(ndcX) > 1 || Math.abs(ndcY) > 1
			? 'outside-frame'
			: ndcZ < -1 || ndcZ > 1
				? 'clipped'
				: 'visible';
	return {
		kind: 'projected',
		css: [(ndcX * 0.5 + 0.5) * rect.width + rect.left, (0.5 - ndcY * 0.5) * rect.height + rect.top],
		ndcDepth: ndcZ,
		visibility,
	};
}

/**
 * The project-world ray through one CSS point, from the **same** rendered
 * matrices the meshes were drawn with.
 *
 * The origin is the ray's point on the near plane, so an orthographic ray's origin
 * varies with the CSS point while its direction stays parallel; no separately
 * inferred FOV or pixels-per-meter transform exists to disagree with the render.
 */
export function pointerRay(
	cssPoint: unknown,
	evaluation: ViewportEvaluation,
	expected: ViewportEvaluationToken,
): PointerRayResult {
	if (
		!Array.isArray(cssPoint) ||
		cssPoint.length !== 2 ||
		!isFiniteNumber(cssPoint[0] as number) ||
		!isFiniteNumber(cssPoint[1] as number)
	) {
		return {
			kind: 'failed',
			code: 'invalid-css-point',
			message: 'the CSS point must be a finite [x, y] pair',
		};
	}
	const rect = evaluation.rect;
	if (rect.width <= 0 || rect.height <= 0) {
		return {
			kind: 'failed',
			code: 'invalid-viewport',
			message: 'a viewport with no drawable area has no ray',
		};
	}
	if (!sameEvaluationToken(evaluation.token, expected)) {
		return {
			kind: 'failed',
			code: 'stale-evaluation',
			message:
				'the supplied evaluation is not the expected one; evaluate the viewport again before casting a ray',
		};
	}
	const x = cssPoint[0] as number;
	const y = cssPoint[1] as number;
	const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
	const ndcY = 1 - ((y - rect.top) / rect.height) * 2;
	const nearPoint = unproject(evaluation.inverseViewProjectionMatrix, ndcX, ndcY, -1);
	const farPoint = unproject(evaluation.inverseViewProjectionMatrix, ndcX, ndcY, 1);
	if (nearPoint === null || farPoint === null) {
		return {
			kind: 'failed',
			code: 'degenerate-ray',
			message: 'the ray could not be unprojected from the evaluation matrices',
		};
	}
	const direction = normalizeVec3(subtractVec3(farPoint, nearPoint));
	if (direction === null) {
		return {
			kind: 'failed',
			code: 'degenerate-ray',
			message: 'the unprojected ray has no direction',
		};
	}
	return { kind: 'ray', ray: { origin: nearPoint, direction } };
}

function unproject(
	inverseViewProjection: readonly number[],
	ndcX: number,
	ndcY: number,
	ndcZ: number,
): Vec3 | null {
	const clip: Vec3 = [ndcX, ndcY, ndcZ];
	const transformed = transformPoint(inverseViewProjection, clip);
	const w = transformed[3];
	if (w === 0 || !Number.isFinite(w)) return null;
	const point: Vec3 = [transformed[0] / w, transformed[1] / w, transformed[2] / w];
	return isFiniteVec3(point) ? point : null;
}

function planeAxes(plane: WorkingPlane): { right: Vec3; up: Vec3; normal: Vec3 } | null {
	const normal = normalizeVec3(plane.normal);
	if (normal === null) return null;
	const up = normalizeVec3([Math.sin(plane.yawRadians), 0, Math.cos(plane.yawRadians)]);
	if (up === null) return null;
	const right = normalizeVec3(crossVec3(up, normal));
	if (right === null) return null;
	return { right, up, normal };
}

/**
 * Intersect a ray with an explicit working plane.
 *
 * The plane is the caller's resolved frame — never the nearest Room, never inferred
 * from geometry. `parallel`, `behind` and `outside-supported-domain` are separate
 * answers, and the supported extent is supplied by the owning domain rather than
 * derived here.
 */
export function intersectWorkingPlane(
	ray: PointerRay,
	plane: WorkingPlane,
	evaluation: ViewportEvaluation,
	expected: ViewportEvaluationToken,
): WorkingPlaneHit {
	if (!sameEvaluationToken(evaluation.token, expected)) {
		return {
			kind: 'failed',
			code: 'stale-evaluation',
			message:
				'the supplied evaluation is not the expected one; evaluate the viewport again before intersecting a plane',
		};
	}
	if (!isFiniteVec3(ray.origin) || !isFiniteVec3(ray.direction)) {
		return {
			kind: 'failed',
			code: 'invalid-frame',
			message: 'the ray must have a finite origin and direction',
		};
	}
	const axes = planeAxes(plane);
	if (axes === null) {
		return {
			kind: 'failed',
			code: 'invalid-frame',
			message: 'the working plane has no usable basis: its normal or yaw is degenerate',
		};
	}
	const denominator = dotVec3(axes.normal, ray.direction);
	if (Math.abs(denominator) < 1e-9) {
		return {
			kind: 'failed',
			code: 'parallel',
			message: 'the ray is parallel to the working plane and never meets it',
		};
	}
	const distance = dotVec3(axes.normal, subtractVec3(plane.originMeters, ray.origin)) / denominator;
	if (distance < 0) {
		return {
			kind: 'failed',
			code: 'behind',
			message: 'the plane is behind the ray: the intersection lies at a negative distance',
		};
	}
	const worldPoint = addVec3(ray.origin, scaleVec3(ray.direction, distance));
	const offset = subtractVec3(worldPoint, plane.originMeters);
	const localX = dotVec3(offset, axes.right);
	const localY = dotVec3(offset, axes.up);
	const extent = plane.supportedLocalExtent;
	if (
		extent !== null &&
		(localX < Math.min(extent.min[0], extent.max[0]) ||
			localX > Math.max(extent.min[0], extent.max[0]) ||
			localY < Math.min(extent.min[1], extent.max[1]) ||
			localY > Math.max(extent.min[1], extent.max[1]))
	) {
		return {
			kind: 'failed',
			code: 'outside-supported-domain',
			message: 'the intersection lies outside the extent the plane owner supports',
		};
	}
	return {
		kind: 'intersected',
		worldPoint,
		local: { x: localX, y: localY },
		distanceMeters: distance,
	};
}
