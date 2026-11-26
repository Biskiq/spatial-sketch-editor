/**
 * One renderer-neutral Camera realization for the Stage, Visitor and snapshots.
 *
 * The Camera authority evaluates matrices; this module copies an evaluated
 * `ViewportEvaluation` onto a Three camera **at the renderer boundary**. It owns
 * the three conventions the common renderer changed:
 *
 * - the camera's declared coordinate system is set **before** the matrices are
 *  copied. r187 compares `camera.coordinateSystem` with the renderer's on every
 *  draw and recomputes the projection when they differ, which would replace the
 *  evaluated projection with the camera's own fov/aspect construction;
 * - on native WebGPU the clip-space Z is converted from `[-w, w]` to `[0, w]`
 *  (see `convertProjectionForBackend`);
 * - the inverse projection is recomputed from the converted matrix, so the
 *  physical camera inverse always agrees with what is drawn.
 *
 * Authored evaluation, X/Y and near/far are never modified.
 */
import type { ViewportEvaluation } from '@portfolio/camera-core/viewport';
import type { Camera } from 'three/webgpu';

type RealizedCamera = Camera & { near: number; far: number };
import {
	convertProjectionForBackend,
	rendererCoordinateSystem,
	type RealizableCamera,
	type RendererBackend,
} from './renderer-backend';

type CoordinateSystem = NonNullable<RealizableCamera['coordinateSystem']>;

/**
 * Copy one evaluation onto a camera for the observed backend.
 *
 * `matrixAutoUpdate` is disabled so nothing on the next draw recomputes the pose
 * from position/quaternion; `updateMatrixWorld(true)` composes the copied local
 * matrix into the world matrix and view matrix.
 */
export function realizeEvaluatedCamera(
	camera: RealizedCamera,
	evaluation: ViewportEvaluation,
	backend: RendererBackend,
): void {
	const realizable = camera as RealizableCamera;
	// Before the copy: the renderer must see its own convention here, or its
	// first-use projection update replaces the evaluated matrix.
	realizable.coordinateSystem = rendererCoordinateSystem(backend) as CoordinateSystem;
	camera.matrixAutoUpdate = false;
	camera.matrix.fromArray(evaluation.inverseViewMatrix as number[]);
	camera.matrixWorldNeedsUpdate = true;
	camera.near = evaluation.near;
	camera.far = evaluation.far;
	camera.projectionMatrix.fromArray(evaluation.projectionMatrix as number[]);
	convertProjectionForBackend(camera.projectionMatrix, backend);
	camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
	camera.updateMatrixWorld(true);
	camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
}
