import { CAMERA_FOV, type Vec3 } from '$lib/types/scene';
import { Matrix4, Vector3, type Object3D, type Vector3Like } from 'three';

export const EDITOR_CAMERA_FRUSTUM_MIN_DEPTH = 2;
export const EDITOR_CAMERA_FRUSTUM_MAX_DEPTH = 8;
export const EDITOR_CAMERA_FRAMING_MOVE_EPSILON = 1e-4;
export const EDITOR_CAMERA_FRAMING_FOV_EPSILON = 1e-3;

const WORLD_UP = new Vector3(0, 1, 0);
const FALLBACK_UP = new Vector3(0, 0, 1);

export type EditorCameraFramingGeometry = {
	depth: number;
	center: Vec3;
	topHandle: Vec3;
	bottomHandle: Vec3;
	corners: [Vec3, Vec3, Vec3, Vec3];
};

type CameraFramingPoint = Vector3Like | readonly [number, number, number];

function finiteVector(value: CameraFramingPoint, label: string) {
	const vector =
		'x' in value
			? new Vector3(value.x, value.y, value.z)
			: new Vector3(value[0], value[1], value[2]);
	if (![vector.x, vector.y, vector.z].every(Number.isFinite)) {
		throw new Error(`${label} must contain finite coordinates`);
	}
	return vector;
}

export function clampEditorCameraFrustumDepth(distance: number) {
	if (!Number.isFinite(distance)) {
		throw new Error('Camera target distance must be finite');
	}
	return Math.min(
		EDITOR_CAMERA_FRUSTUM_MAX_DEPTH,
		Math.max(EDITOR_CAMERA_FRUSTUM_MIN_DEPTH, distance)
	);
}

export function createEditorCameraFramingBasis(
	position: CameraFramingPoint,
	target: CameraFramingPoint
) {
	const eye = finiteVector(position, 'Camera position');
	const aim = finiteVector(target, 'Camera target');
	const forward = aim.clone().sub(eye);
	if (forward.lengthSq() <= 1e-12) {
		throw new Error('Camera position and target must differ');
	}
	forward.normalize();
	const referenceUp =
		Math.abs(forward.dot(WORLD_UP)) > 0.999 ? FALLBACK_UP : WORLD_UP;
	const right = forward.clone().cross(referenceUp).normalize();
	const up = right.clone().cross(forward).normalize();
	return { eye, forward, right, up };
}

/**
 * P21.6 review (A/B P2-7) — shared orientation basis. The nub (mesh, +Z
 * forward), the framing rectangle/handles (derived from the same basis
 * above), and the preview camera (camera, −Z forward) all orient from one
 * supported basis — never independent `lookAt()` calls, whose default-Y-up
 * colinear handling disagrees with the Z-up fallback near vertical by ~90°.
 * Coincident eye/target keeps the existing orientation (no throw on a live
 * per-frame pose path).
 */
export function setEditorCameraFramingOrientation(
	object: Object3D,
	eye: Vector3,
	target: Vector3
): void {
	if (eye.distanceToSquared(target) <= 1e-12) return;
	const { forward, right, up } = createEditorCameraFramingBasis(eye, target);
	const isCamera =
		(object as unknown as { isCamera?: unknown }).isCamera === true;
	// Both branches are right-handed rotations matching three's `lookAt`
	// convention (mesh +Z toward the target, camera −Z toward it):
	// `right × up = −forward`, so the camera takes (right, up, −forward)
	// and the mesh takes (−right, up, forward).
	const matrix = isCamera
		? new Matrix4().makeBasis(right.clone(), up.clone(), forward.clone().negate())
		: new Matrix4().makeBasis(right.clone().negate(), up.clone(), forward.clone());
	object.quaternion.setFromRotationMatrix(matrix);
}

export function createEditorCameraFramingGeometry(
	position: CameraFramingPoint,
	target: CameraFramingPoint,
	fov: number,
	aspect: number
): EditorCameraFramingGeometry {
	if (
		!Number.isFinite(fov) ||
		fov < CAMERA_FOV.min ||
		fov > CAMERA_FOV.max
	) {
		throw new Error('Camera FOV is outside the supported range');
	}
	if (!Number.isFinite(aspect) || aspect <= 0) {
		throw new Error('Camera aspect must be positive');
	}
	const basis = createEditorCameraFramingBasis(position, target);
	const distance = basis.eye.distanceTo(finiteVector(target, 'Camera target'));
	const depth = clampEditorCameraFrustumDepth(distance);
	const center = basis.eye.clone().addScaledVector(basis.forward, depth);
	const halfHeight = depth * Math.tan((fov * Math.PI) / 360);
	const halfWidth = halfHeight * aspect;
	const topHandle = center.clone().addScaledVector(basis.up, halfHeight);
	const bottomHandle = center.clone().addScaledVector(basis.up, -halfHeight);
	const corners = [
		center.clone().addScaledVector(basis.right, -halfWidth).addScaledVector(basis.up, halfHeight),
		center.clone().addScaledVector(basis.right, halfWidth).addScaledVector(basis.up, halfHeight),
		center.clone().addScaledVector(basis.right, halfWidth).addScaledVector(basis.up, -halfHeight),
		center.clone().addScaledVector(basis.right, -halfWidth).addScaledVector(basis.up, -halfHeight)
	] as const;
	return {
		depth,
		center: center.toArray(),
		topHandle: topHandle.toArray(),
		bottomHandle: bottomHandle.toArray(),
		corners: corners.map((corner) => corner.toArray()) as [
			Vec3,
			Vec3,
			Vec3,
			Vec3
		]
	};
}

/**
 * Line-segment vertex list for a finite frustum: four eye→corner rays plus the
 * four rectangle edges that close the FOV plane. Shared by the selected-object
 * framing helper and the preview virtual-camera frustum so both render exactly
 * the same projection.
 */
export function createEditorCameraFrustumLinePoints(
	eye: CameraFramingPoint,
	geometry: EditorCameraFramingGeometry
): Vector3[] {
	const origin = finiteVector(eye, 'Camera position');
	const corners = geometry.corners.map((corner) => new Vector3(...corner));
	const points: Vector3[] = [];
	for (const corner of corners) points.push(origin.clone(), corner);
	for (let index = 0; index < corners.length; index += 1) {
		points.push(corners[index]!, corners[(index + 1) % corners.length]!);
	}
	return points;
}

/**
 * P21.6 Slice B §3.1 — fixed frustum-volume layout: apex + 4 far-plane
 * corners (TL, TR, BR, BL), 6 triangles with plan-specified winding.
 * Allocate the position buffer once, write in place, never rebuild per tick.
 */
export const EDITOR_CAMERA_FRUSTUM_VOLUME_VERTEX_COUNT = 5;
export const EDITOR_CAMERA_FRUSTUM_VOLUME_FLOATS =
	EDITOR_CAMERA_FRUSTUM_VOLUME_VERTEX_COUNT * 3;
export const EDITOR_CAMERA_FRUSTUM_VOLUME_INDEX: readonly number[] = [
	// Left face: [Eye, TopLeft, BottomLeft]
	0, 1, 4,
	// Right face: [Eye, BottomRight, TopRight]
	0, 3, 2,
	// Top face: [Eye, TopRight, TopLeft]
	0, 2, 1,
	// Bottom face: [Eye, BottomLeft, BottomRight]
	0, 4, 3,
	// Far-plane cap (winding consistent with the side faces)
	1, 2, 3, 1, 3, 4
];

export function writeEditorCameraFrustumVolumePositions(
	out: Float32Array,
	eye: CameraFramingPoint,
	geometry: EditorCameraFramingGeometry
): void {
	if (out.length < EDITOR_CAMERA_FRUSTUM_VOLUME_FLOATS) {
		throw new Error('Frustum volume buffer is too small');
	}
	const origin = finiteVector(eye, 'Camera position');
	const corners = geometry.corners.map((corner) => finiteVector(corner, 'Frustum corner'));
	const vertices = [origin, ...corners];
	for (let index = 0; index < vertices.length; index += 1) {
		const vertex = vertices[index]!;
		out[index * 3] = vertex.x;
		out[index * 3 + 1] = vertex.y;
		out[index * 3 + 2] = vertex.z;
	}
}

/**
 * P21.6 Slice B §3.2 — fixed frustum-perimeter layout: 16 segment endpoints
 * (4 eye→corner rays + 4 far-rectangle edges). In-place twin of
 * `createEditorCameraFrustumLinePoints` (same vertex order) for the
 * selected-object helper; the preview rig keeps the allocating variant.
 */
export const EDITOR_CAMERA_FRUSTUM_LINE_POINTS = 16;
export const EDITOR_CAMERA_FRUSTUM_LINE_FLOATS = EDITOR_CAMERA_FRUSTUM_LINE_POINTS * 3;

export function writeEditorCameraFrustumLinePositions(
	out: Float32Array,
	eye: CameraFramingPoint,
	geometry: EditorCameraFramingGeometry
): void {
	if (out.length < EDITOR_CAMERA_FRUSTUM_LINE_FLOATS) {
		throw new Error('Frustum line buffer is too small');
	}
	const origin = finiteVector(eye, 'Camera position');
	const corners = geometry.corners.map((corner) => finiteVector(corner, 'Frustum corner'));
	const points: Vector3[] = [];
	for (const corner of corners) points.push(origin, corner);
	for (let index = 0; index < corners.length; index += 1) {
		points.push(corners[index]!, corners[(index + 1) % corners.length]!);
	}
	for (let index = 0; index < points.length; index += 1) {
		const point = points[index]!;
		out[index * 3] = point.x;
		out[index * 3 + 1] = point.y;
		out[index * 3 + 2] = point.z;
	}
}

export function verticalFovFromEditorCameraFrustumPoint(
	position: CameraFramingPoint,
	target: CameraFramingPoint,
	point: CameraFramingPoint
) {
	const basis = createEditorCameraFramingBasis(position, target);
	const distance = basis.eye.distanceTo(finiteVector(target, 'Camera target'));
	const depth = clampEditorCameraFrustumDepth(distance);
	const center = basis.eye.clone().addScaledVector(basis.forward, depth);
	const offset = Math.abs(finiteVector(point, 'FOV handle point').sub(center).dot(basis.up));
	const fov = (Math.atan2(offset, depth) * 360) / Math.PI;
	return Math.min(CAMERA_FOV.max, Math.max(CAMERA_FOV.min, fov));
}

/**
 * P21.6 Slice B §3.4 — frozen FOV-drag basis. The full drag frame (eye,
 * forward, up, depth) is captured at pointer-down from the authored pose and
 * never recomputed mid-gesture (the world-up fallback flips abruptly near
 * vertical). The solver branch locks for the whole gesture.
 */
export const EDITOR_CAMERA_FOV_DRAG_ALIGNMENT_THRESHOLD = 0.15;
export const EDITOR_CAMERA_FOV_DRAG_SLIDER_DEGREES_PER_PX = 0.2;

export type EditorCameraFovDragBasis = {
	eye: Vec3;
	forward: Vec3;
	up: Vec3;
	depth: number;
	fov0: number;
	sign: 1 | -1;
	p0: Vec3 | null;
	startClientY: number;
	useSlider: boolean;
	lastValidFov: number;
};

function dot3(a: Vec3, b: Vec3): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function isFiniteVec3(value: Vec3 | null | undefined): value is Vec3 {
	return (
		!!value &&
		Number.isFinite(value[0]) &&
		Number.isFinite(value[1]) &&
		Number.isFinite(value[2])
	);
}

export function createEditorCameraFovDragBasis(args: {
	eye: Vec3;
	forward: Vec3;
	up: Vec3;
	depth: number;
	fov0: number;
	side: 'top' | 'bottom';
	rayDirection: Vec3;
	p0: Vec3 | null;
	startClientY: number;
}): EditorCameraFovDragBasis {
	const { eye, forward, up, depth, fov0, side, rayDirection, p0, startClientY } = args;
	const rayLength = Math.hypot(rayDirection[0], rayDirection[1], rayDirection[2]);
	const normalLength = Math.hypot(forward[0], forward[1], forward[2]);
	const alignment =
		rayLength > 0 && normalLength > 0
			? Math.abs(dot3(rayDirection, forward) / (rayLength * normalLength))
			: 0;
	// Ill-conditioned (grazing) or missing grab point → virtual-slider
	// fallback for the whole gesture; never switch mid-gesture.
	const useSlider =
		!(alignment >= EDITOR_CAMERA_FOV_DRAG_ALIGNMENT_THRESHOLD) || !isFiniteVec3(p0);
	return {
		eye: [...eye],
		forward: [...forward],
		up: [...up],
		depth,
		fov0,
		sign: side === 'top' ? 1 : -1,
		p0: isFiniteVec3(p0) ? [...p0] : null,
		startClientY,
		useSlider,
		lastValidFov: fov0
	};
}

/**
 * Evaluate one FOV-drag move against a frozen basis. Ray-plane branch keeps
 * the TRUE grab offset (`h₀ + sign·dot(p−p₀)`, signed handle identity — no
 * `abs()`, so crossing the center clamps at min instead of inverting);
 * invalid intersections hold the last valid FOV without switching solvers.
 *
 * P21.6 review (A/B P1-4) — per-move grazing recheck. `movementRayDirection`
 * is the live observer ray for this move (the caller already holds it for
 * the plane intersect): below the pointer-down threshold the plane hit is a
 * 1/sin(θ) blowup, so hold the last valid FOV instead of clamping the
 * artifact to a rail. The direct-`pCurrent` blowup guard below keeps replayed
 * intersections (no live ray) sane: eye→p beyond 1000× depth is
 * non-physical — on-screen drags at the 0.15 threshold stay under ~7×.
 */
export function evaluateEditorCameraFovDrag(
	basis: EditorCameraFovDragBasis,
	pCurrent: Vec3 | null,
	clientY: number,
	movementRayDirection?: Vec3 | null
): number {
	if (basis.useSlider) {
		const dragged = basis.fov0 - (clientY - basis.startClientY) * EDITOR_CAMERA_FOV_DRAG_SLIDER_DEGREES_PER_PX;
		const fov = Math.min(CAMERA_FOV.max, Math.max(CAMERA_FOV.min, dragged));
		basis.lastValidFov = fov;
		return fov;
	}
	if (movementRayDirection) {
		const rayLength = Math.hypot(
			movementRayDirection[0],
			movementRayDirection[1],
			movementRayDirection[2]
		);
		const normalLength = Math.hypot(basis.forward[0], basis.forward[1], basis.forward[2]);
		const alignment =
			rayLength > 0 && normalLength > 0
				? Math.abs(dot3(movementRayDirection, basis.forward) / (rayLength * normalLength))
				: 0;
		if (!(alignment >= EDITOR_CAMERA_FOV_DRAG_ALIGNMENT_THRESHOLD)) {
			return basis.lastValidFov;
		}
	}
	if (!isFiniteVec3(pCurrent) || !isFiniteVec3(basis.p0)) return basis.lastValidFov;
	if (!Number.isFinite(basis.depth) || basis.depth <= 0) return basis.lastValidFov;
	const eyeToCurrent = Math.hypot(
		pCurrent[0] - basis.eye[0],
		pCurrent[1] - basis.eye[1],
		pCurrent[2] - basis.eye[2]
	);
	if (!(eyeToCurrent <= basis.depth * 1000)) return basis.lastValidFov;
	const half0 = (basis.fov0 * Math.PI) / 360;
	const h0 = basis.depth * Math.tan(half0);
	const delta = sub3(pCurrent, basis.p0);
	const h = h0 + basis.sign * dot3(delta, basis.up);
	if (!Number.isFinite(h)) return basis.lastValidFov;
	const hMin = basis.depth * Math.tan((CAMERA_FOV.min * Math.PI) / 360);
	const hMax = basis.depth * Math.tan((CAMERA_FOV.max * Math.PI) / 360);
	const clampedH = Math.min(hMax, Math.max(hMin, h));
	// Snap at the rails so bound writes are exact (no 119.99° residue).
	if (clampedH <= hMin) {
		basis.lastValidFov = CAMERA_FOV.min;
		return CAMERA_FOV.min;
	}
	if (clampedH >= hMax) {
		basis.lastValidFov = CAMERA_FOV.max;
		return CAMERA_FOV.max;
	}
	const fov = (2 * Math.atan2(clampedH, basis.depth) * 180) / Math.PI;
	if (!Number.isFinite(fov)) return basis.lastValidFov;
	const clampedFov = Math.min(CAMERA_FOV.max, Math.max(CAMERA_FOV.min, fov));
	basis.lastValidFov = clampedFov;
	return clampedFov;
}

/**
 * P21.6 Slice B §3.4 — screen-space pick clamp. Invisible shells keep a
 * minimum 24px projected diameter (mouse baseline): perspective sizing from
 * observer-camera-space depth, CSS pixels, and the effective vertical FOV
 * (includes zoom). Returns a scale factor for a shell of `shellBaseRadius`
 * (≥ 1 — never shrinks the authored grab area).
 */
export const EDITOR_CAMERA_PICK_MIN_DIAMETER_PX = 24;

export function pickShellScale(
	depthZ: number,
	effectiveFovDegrees: number,
	viewportHeightCSS: number,
	shellBaseRadius: number
): number {
	if (
		!Number.isFinite(depthZ) ||
		!Number.isFinite(effectiveFovDegrees) ||
		!Number.isFinite(viewportHeightCSS) ||
		!Number.isFinite(shellBaseRadius)
	) {
		return 1;
	}
	if (depthZ <= 0 || viewportHeightCSS <= 0 || shellBaseRadius <= 0) return 1;
	const halfFov = (effectiveFovDegrees * Math.PI) / 360;
	const required =
		(depthZ * Math.tan(halfFov) * EDITOR_CAMERA_PICK_MIN_DIAMETER_PX) /
		viewportHeightCSS;
	if (!Number.isFinite(required) || required <= 0) return 1;
	return Math.max(1, required / shellBaseRadius);
}

export type CameraPreviewFramingOwner = 'playhead' | 'selection' | 'none';

/**
 * P21.6 review (A/B P1) — paused-preview visual ownership, second pass.
 * Three outcomes: playing Director → `playhead`; paused with an editable
 * node/view-keyframe selection → `selection` (owns the filled helper +
 * handles, the competing preview helper hides); paused with no editable
 * selection → `none` (deselection leaves a clean viewport instead of
 * resurrecting the wireframe). Timeline state is untouched in all cases.
 * Shared by the selected-object helper, the preview rig, and framing
 * picking so the two frustums (and their hit areas) never compete.
 *
 * Frame visibility gates everything (finding P1-2): Frame off suppresses
 * both implementations. `selectionEligible` (Camera workspace, no pending
 * placement — the same gate as the selection helper's own pose) keeps one
 * helper from suppressing the other while itself unavailable: an
 * ineligible selection helper falls back to the playhead owner.
 */
export function resolveCameraPreviewFramingOwner(args: {
	hasDirectorPreview: boolean;
	previewPlaying: boolean;
	hasEditableSelection: boolean;
	framingVisible?: boolean;
	selectionEligible?: boolean;
}): CameraPreviewFramingOwner {
	const framingVisible = args.framingVisible ?? true;
	const selectionEligible = args.selectionEligible ?? true;
	if (!args.hasDirectorPreview) return 'playhead';
	if (!framingVisible) return 'none';
	if (args.previewPlaying) return 'playhead';
	if (!selectionEligible) return 'playhead';
	if (args.hasEditableSelection) return 'selection';
	return 'none';
}

/**
 * P21.6 review (A/B P1-2) — selection-helper eligibility shared by both
 * frustum owners and framing picking: the Camera workspace with no pending
 * placement/light/primitive (mirrors the selection helper's own pose
 * gate in `EditorCameraFramingHelpers.framingPose`).
 */
export function isFramingSelectionEligible(args: {
	workspace: string | null | undefined;
	hasPendingPlacement: boolean;
}): boolean {
	return args.workspace === 'camera' && !args.hasPendingPlacement;
}

export type FramingOwnerIdentity =
	| { owner: 'node'; nodeId: string }
	| {
			owner: 'view-keyframe';
			connectionId: string;
			direction: string;
			keyframeId: string;
	  };

/**
 * P21.6 review (A/B P2) — selection identity for the framing pose cache key.
 * Geometry-equal poses from different owners must still refresh handle
 * `userData`; cover node IDs and full view-keyframe identity.
 */
export function framingOwnerKey(identity: FramingOwnerIdentity): string {
	return identity.owner === 'node'
		? `node:${identity.nodeId}`
		: `view-keyframe:${identity.connectionId}:${identity.direction}:${identity.keyframeId}`;
}
