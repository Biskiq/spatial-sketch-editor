/**
 * R217.S28 — Experience View marks on the Stage.
 *
 * Pure projection of the authored Camera Views through the **one** current
 * `ViewportEvaluation`: every mark point is produced by the same matrix the
 * meshes were drawn with, never by a second camera or a Three object. Selecting
 * a marker never moves the Camera.
 *
 * Two readings, one model:
 * - 3D: each View is a Detailed camera built in world space at its eye and aimed
 *   along eye -> target, with a wire frustum from the lens tip, a height stem to
 *   the floor and a soft floor shadow. Faces are culled by projected winding and
 *   painted far to near; the silhouette is the convex hull of every vertex.
 * - Plan: a dot and a short wedge in screen space. Only the selected View carries
 *   the full cone, which is also its turn grip (review round 2).
 *
 * States follow the plan: selected (gold), strong (the selected Stop's guided
 * Views), normal, and dim. Labels are capped at 12 strong markers and frustums
 * at 24 Views, with the selected View first.
 */
import { projectWorld, type Vec3, type ViewportEvaluation } from '@portfolio/camera-core';
import type { CameraView, Experience, ExperienceGuide } from '@portfolio/project-model/units';

import { experiencePathOccurrences, occurrenceKey, resolvePathOccurrence, type ExperiencePathOccurrence } from './experience-paths';

export type ExperienceMarkState = 'selected' | 'strong' | 'normal' | 'dim';
export type ExperienceMarkKind = 'eye' | 'turn' | 'glyph';
/** Stage-local CSS pixels. */
export type StagePoint = readonly [number, number];
/** left, top, right, bottom in Stage-local CSS pixels. */
export type StageBox = readonly [number, number, number, number];
export type CameraFaceShade = 'light' | 'side' | 'barrel' | 'cap' | 'ink';

export type ExperienceCameraFace = {
	readonly points: readonly StagePoint[];
	readonly shade: CameraFaceShade;
};

export type ExperienceCameraFrustum = {
	/** The lens tip, where the wire starts. */
	readonly apex: StagePoint;
	/** The far rectangle, in order around its perimeter. */
	readonly corners: readonly [StagePoint, StagePoint, StagePoint, StagePoint];
};

/** A Detailed camera projected through the current evaluation (3D reading only). */
export type ExperienceCameraGlyph = {
	/** Visible body faces, painted far to near. */
	readonly faces: readonly ExperienceCameraFace[];
	/** The lens glass disc, or null when the lens end faces away. */
	readonly glass: readonly StagePoint[] | null;
	readonly glint: StagePoint | null;
	/** The convex hull of every projected vertex: the one ink outline. */
	readonly outline: readonly StagePoint[];
	readonly bounds: StageBox;
	readonly shadow: { readonly center: StagePoint; readonly rx: number; readonly ry: number } | null;
	/** The height stem from the eye to the floor, and the floor dot. */
	readonly stem: readonly [StagePoint, StagePoint] | null;
	readonly floor: StagePoint | null;
	readonly frustum: ExperienceCameraFrustum | null;
};

export type ExperienceMark = {
	readonly id: string;
	readonly viewId: string;
	readonly presentationId: string;
	readonly kind: ExperienceMarkKind;
	readonly css: readonly [number, number];
	readonly label: string;
	readonly number: number | null;
	readonly state: ExperienceMarkState;
	/** Where the View name tag hangs, when it is shown. */
	readonly tagAt: StagePoint;
	/** Where the Stop badge sits. */
	readonly numberAt: StagePoint;
	/** The selection brackets' box. */
	readonly box: StageBox;
	/** The 3D Detailed camera; null in Plan. */
	readonly camera: ExperienceCameraGlyph | null;
};

/** A Plan wedge: the View's aim in screen space, from its eye. */
export type ExperienceFrustum = {
	readonly viewId: string;
	readonly state: ExperienceMarkState;
	readonly eye: readonly [number, number];
	readonly left: readonly [number, number];
	readonly right: readonly [number, number];
	/** The wedge tip. */
	readonly tip: readonly [number, number];
	readonly length: number;
};

export type ExperienceMarkModel = {
	readonly marks: readonly ExperienceMark[];
	readonly frustums: readonly ExperienceFrustum[];
};

export const EXPERIENCE_MARK_CAPS = {
	labels: 12,
	frustums: 24
} as const;

/** Plan wedge lengths in CSS pixels: quiet, on the tour, and the selected View's full cone. */
const PLAN_WEDGE_QUIET_PX = 18;
const PLAN_WEDGE_TOUR_PX = 24;
const PLAN_WEDGE_SELECTED_PX = 90;
/** Plan selection brackets: half the eye dot's box. */
const PLAN_BOX_HALF_PX = 13;
/** Vertical offset of the Plan tag below the eye. */
const PLAN_TAG_DROP_PX = 26;
/** The 3D wire frustum's far distance, in metres from the lens tip. */
const CAMERA_FRUSTUM_FAR_METRES = 1.2;
/** Unselected Views carry a short wire so many Views stay readable (owner review). */
const CAMERA_FRUSTUM_QUIET_METRES = 0.42;
/** The wire frustum's aspect ratio. */
const CAMERA_FRUSTUM_ASPECT = 1.6;
/** Pixels of breathing room between the camera hull and the selection brackets. */
const CAMERA_BRACKET_PAD_PX = 6;
/** The floor shadow's radius in metres. */
const CAMERA_SHADOW_RADIUS_METRES = 0.2;
/** The eye must be this many metres above the floor before the stem is drawn. */
const CAMERA_STEM_MIN_METRES = 0.02;

type V3 = readonly [number, number, number];
/** A mesh-local point: (forward, right, up) in metres, already scaled. */
type LocalPoint = readonly [number, number, number];

type MeshFace = {
	readonly ids: readonly number[];
	readonly shade: CameraFaceShade;
};

type CameraMesh = {
	readonly points: readonly LocalPoint[];
	/** Body faces, each wound counter-clockwise seen from outside. */
	readonly faces: readonly MeshFace[];
	/** The lens glass disc, wound outward like the body faces. */
	readonly glass: MeshFace;
	readonly glint: LocalPoint;
	readonly lensTip: LocalPoint;
};

/**
 * The Detailed camera, built once. Dimensions follow the design sheet's `full`
 * style (body, viewfinder hump, shutter button, eight-to-ten-sided lens barrel with
 * glass), scaled so the whole camera is about 0.37 m from the back of the body to
 * the lens tip.
 */
const CAMERA_LENGTH_SCALE = 1.15;
const BARREL_SIDES = 10;
const BARREL_START = 0.07;
const BARREL_END = 0.22;
const BARREL_RADIUS = 0.09;
const GLASS_FRACTION = 0.62;

function buildCameraMesh(): CameraMesh {
	const s = CAMERA_LENGTH_SCALE;
	const points: LocalPoint[] = [];
	const faces: MeshFace[] = [];
	const at = (a: number, b: number, c: number): number => {
		points.push([a * s, b * s, c * s]);
		return points.length - 1;
	};
	const orient = (ids: readonly number[], outward: V3): readonly number[] => {
		const normal = newell(ids.map((index) => points[index]!));
		return dot3(normal, outward) < 0 ? [...ids].reverse() : ids;
	};
	const shadeOf = (normal: V3): CameraFaceShade => (normal[0] > 0 || normal[2] > 0 ? 'light' : 'side');
	const box = (
		a0: number, a1: number, b0: number, b1: number, c0: number, c1: number,
		shade: (normal: V3) => CameraFaceShade
	): void => {
		const v = [
			at(a0, b0, c0), at(a1, b0, c0), at(a1, b1, c0), at(a0, b1, c0),
			at(a0, b0, c1), at(a1, b0, c1), at(a1, b1, c1), at(a0, b1, c1)
		];
		const quads: readonly [readonly number[], V3][] = [
			[[0, 1, 2, 3], [0, 0, -1]],
			[[4, 5, 6, 7], [0, 0, 1]],
			[[0, 1, 5, 4], [0, -1, 0]],
			[[3, 2, 6, 7], [0, 1, 0]],
			[[0, 3, 7, 4], [-1, 0, 0]],
			[[1, 2, 6, 5], [1, 0, 0]]
		];
		for (const [quad, normal] of quads) {
			faces.push({ ids: orient(quad.map((index) => v[index]!), normal), shade: shade(normal) });
		}
	};

	box(-0.1, 0.07, -0.18, 0.18, -0.12, 0.12, shadeOf);
	box(-0.07, 0.05, -0.06, 0.06, 0.12, 0.19, shadeOf);
	box(-0.03, 0.04, 0.1, 0.15, 0.12, 0.15, () => 'ink');

	const ring = (a: number, radius: number, scale = 1): number[] =>
		Array.from({ length: BARREL_SIDES }, (_, index) => {
			const t = (index / BARREL_SIDES) * Math.PI * 2;
			return at(a, Math.cos(t) * radius * scale, Math.sin(t) * radius * scale);
		});
	const near = ring(BARREL_START, BARREL_RADIUS);
	const far = ring(BARREL_END, BARREL_RADIUS);
	for (let index = 0; index < BARREL_SIDES; index += 1) {
		const next = (index + 1) % BARREL_SIDES;
		const t = ((index + 0.5) / BARREL_SIDES) * Math.PI * 2;
		const normal: V3 = [0, Math.cos(t), Math.sin(t)];
		faces.push({
			ids: orient([near[index]!, near[next]!, far[next]!, far[index]!], normal),
			shade: 'barrel'
		});
	}
	faces.push({ ids: orient(far, [1, 0, 0]), shade: 'cap' });

	const glassRing = ring(BARREL_END + 0.001, BARREL_RADIUS, GLASS_FRACTION);
	const glass: MeshFace = { ids: orient(glassRing, [1, 0, 0]), shade: 'cap' };

	return {
		points,
		faces,
		glass,
		glint: [(BARREL_END + 0.002) * s, -BARREL_RADIUS * 0.25 * s, BARREL_RADIUS * 0.3 * s],
		lensTip: [BARREL_END * s, 0, 0]
	};
}

/** Built once at module scope; only the per-View transform changes. */
const CAMERA_MESH = buildCameraMesh();

function dot3(a: V3, b: V3): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: V3, b: V3): V3 {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function unit3(a: V3): V3 | null {
	const length = Math.hypot(a[0], a[1], a[2]);
	return length < 1e-9 ? null : [a[0] / length, a[1] / length, a[2] / length];
}

/** Newell's method: the polygon normal, right-handed for counter-clockwise winding. */
function newell(points: readonly LocalPoint[]): V3 {
	let x = 0;
	let y = 0;
	let z = 0;
	for (let index = 0; index < points.length; index += 1) {
		const p = points[index]!;
		const q = points[(index + 1) % points.length]!;
		x += (p[1] - q[1]) * (p[2] + q[2]);
		y += (p[2] - q[2]) * (p[0] + q[0]);
		z += (p[0] - q[0]) * (p[1] + q[1]);
	}
	return [x, y, z];
}

/** Twice the signed area of a screen polygon, in pixel space (y down). */
function signedArea(points: readonly StagePoint[]): number {
	let sum = 0;
	for (let index = 0; index < points.length; index += 1) {
		const p = points[index]!;
		const q = points[(index + 1) % points.length]!;
		sum += p[0] * q[1] - q[0] * p[1];
	}
	return sum;
}

/** Monotone-chain convex hull, counter-clockwise in screen space. */
function convexHull(points: readonly StagePoint[]): StagePoint[] {
	const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	if (sorted.length < 3) return sorted;
	const cross = (o: StagePoint, a: StagePoint, b: StagePoint): number =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const lower: StagePoint[] = [];
	for (const point of sorted) {
		while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop();
		lower.push(point);
	}
	const upper: StagePoint[] = [];
	for (let index = sorted.length - 1; index >= 0; index -= 1) {
		const point = sorted[index]!;
		while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop();
		upper.push(point);
	}
	return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

/**
 * Projects a project-world point to Stage-local CSS. Points behind a perspective
 * camera never project; `requireVisible` keeps only points inside the frame.
 */
function projectStage(evaluation: ViewportEvaluation, point: V3, requireVisible: boolean): StagePoint | null {
	const projected = projectWorld(point, evaluation, evaluation.token);
	if (projected.kind !== 'projected') return null;
	if (projected.visibility === 'behind') return null;
	if (requireVisible && projected.visibility !== 'visible') return null;
	// projectWorld is absolute viewport CSS; Stage SVG ink is Stage-local.
	return [round1(projected.css[0] - evaluation.rect.left), round1(projected.css[1] - evaluation.rect.top)];
}

function stateRank(state: ExperienceMarkState): number {
	return state === 'selected' ? 0 : state === 'strong' ? 1 : state === 'normal' ? 2 : 3;
}

function clampFov(degrees: number): number {
	return Math.min(150, Math.max(5, Number.isFinite(degrees) ? degrees : 54));
}

function boundsOf(points: readonly StagePoint[]): StageBox {
	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	for (const [x, y] of points) {
		left = Math.min(left, x);
		top = Math.min(top, y);
		right = Math.max(right, x);
		bottom = Math.max(bottom, y);
	}
	return [left, top, right, bottom];
}

/**
 * The Detailed camera for one View, projected through the evaluation. Every mesh
 * vertex is transformed into world space once and projected once; the local
 * mesh is never rebuilt. Returns null when any vertex is behind the viewer.
 */
function cameraGlyph(
	evaluation: ViewportEvaluation,
	eye: V3,
	aim: V3,
	fovDegrees: number,
	wire: boolean,
	wireMetres: number = CAMERA_FRUSTUM_FAR_METRES
): ExperienceCameraGlyph | null {
	const forward = unit3(sub3(aim, eye)) ?? [0, 0, -1];
	const reference: V3 = Math.abs(forward[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0];
	const right = unit3(cross3(forward, reference));
	if (right === null) return null;
	const up = cross3(right, forward);
	// The local frame is (forward, right, up): its handedness decides which winding is front-facing.
	const handedness = dot3(forward, cross3(right, up)) < 0 ? -1 : 1;
	const toWorld = (p: LocalPoint): V3 => [
		eye[0] + p[0] * forward[0] + p[1] * right[0] + p[2] * up[0],
		eye[1] + p[0] * forward[1] + p[1] * right[1] + p[2] * up[1],
		eye[2] + p[0] * forward[2] + p[1] * right[2] + p[2] * up[2]
	];

	const world = CAMERA_MESH.points.map(toWorld);
	const screen: StagePoint[] = [];
	for (const point of world) {
		const css = projectStage(evaluation, point, false);
		if (css === null) return null;
		screen.push(css);
	}
	const front = (ids: readonly number[]): boolean =>
		signedArea(ids.map((index) => screen[index]!)) * handedness < 0;

	const visible: { readonly face: ExperienceCameraFace; readonly depth: number }[] = [];
	for (const face of CAMERA_MESH.faces) {
		if (!front(face.ids)) continue;
		let cx = 0;
		let cy = 0;
		let cz = 0;
		for (const index of face.ids) {
			const p = world[index]!;
			cx += p[0];
			cy += p[1];
			cz += p[2];
		}
		const n = face.ids.length;
		const dx = cx / n - evaluation.eye[0];
		const dy = cy / n - evaluation.eye[1];
		const dz = cz / n - evaluation.eye[2];
		visible.push({
			face: { points: face.ids.map((index) => screen[index]!), shade: face.shade },
			depth: dx * dx + dy * dy + dz * dz
		});
	}
	visible.sort((a, b) => b.depth - a.depth);

	const glassVisible = front(CAMERA_MESH.glass.ids);
	const glint = glassVisible ? projectStage(evaluation, toWorld(CAMERA_MESH.glint), false) : null;
	const glass = glassVisible ? CAMERA_MESH.glass.ids.map((index) => screen[index]!) : null;

	const eyeCss = projectStage(evaluation, eye, false);
	const floorWorld: V3 = [eye[0], 0, eye[2]];
	const floorCss = projectStage(evaluation, floorWorld, false);
	let shadow: ExperienceCameraGlyph['shadow'] = null;
	if (floorCss !== null) {
		const offsetX = projectStage(evaluation, [floorWorld[0] + right[0] * CAMERA_SHADOW_RADIUS_METRES, 0, floorWorld[2] + right[2] * CAMERA_SHADOW_RADIUS_METRES], false);
		if (offsetX !== null) {
			const radius = Math.hypot(offsetX[0] - floorCss[0], offsetX[1] - floorCss[1]);
			shadow = { center: floorCss, rx: radius, ry: radius * 0.55 };
		}
	}
	const showStem = eye[1] > CAMERA_STEM_MIN_METRES && eyeCss !== null && floorCss !== null;

	let frustum: ExperienceCameraFrustum | null = null;
	if (wire) {
		const apex = toWorld(CAMERA_MESH.lensTip);
		const apexCss = projectStage(evaluation, apex, false);
		const halfHeight = Math.tan((clampFov(fovDegrees) * Math.PI) / 360) * wireMetres;
		const halfWidth = halfHeight * CAMERA_FRUSTUM_ASPECT;
		const tip = CAMERA_MESH.lensTip;
		const corners: StagePoint[] = [];
		for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const) {
			const local: LocalPoint = [tip[0] + wireMetres, sx * halfWidth, sy * halfHeight];
			const css = projectStage(evaluation, toWorld(local), false);
			if (css === null) break;
			corners.push(css);
		}
		if (apexCss !== null && corners.length === 4) {
			frustum = {
				apex: apexCss,
				corners: [corners[0]!, corners[1]!, corners[2]!, corners[3]!]
			};
		}
	}

	const hull = convexHull(screen);
	return {
		faces: visible.map((entry) => entry.face),
		glass,
		glint,
		outline: hull,
		bounds: boundsOf(hull),
		shadow,
		stem: showStem ? [eyeCss!, floorCss!] : null,
		floor: floorCss,
		frustum
	};
}

function sub3(a: V3, b: V3): V3 {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function rotate2(direction: readonly [number, number], angle: number): [number, number] {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return [direction[0] * c - direction[1] * s, direction[0] * s + direction[1] * c];
}

export type PlacementGhostPose = {
	readonly eye: Vec3;
	readonly target: Vec3;
	readonly fovYDegrees: number;
};

function planFrustum(
	viewId: string,
	state: ExperienceMarkState,
	eye: StagePoint,
	target: StagePoint,
	fov: number,
	length: number
): ExperienceFrustum | null {
	const dx = target[0] - eye[0];
	const dy = target[1] - eye[1];
	const span = Math.hypot(dx, dy);
	if (span < 1e-3) return null;
	const direction = [dx / span, dy / span] as const;
	const half = (clampFov(fov) * Math.PI) / 360;
	const left = rotate2(direction, -half);
	const right = rotate2(direction, half);
	const point = (along: StagePoint): StagePoint =>
		[round1(eye[0] + along[0] * length), round1(eye[1] + along[1] * length)];
	return { viewId, state, eye, left: point(left), right: point(right), tip: point(direction), length };
}

/** The same View glyph and frustum at the provisional pose, without an authored View or hit target. */
export function projectPlacementGhost(evaluation: ViewportEvaluation, pose: PlacementGhostPose) {
	const eye = projectStage(evaluation, pose.eye, true);
	if (eye === null) return null;
	if (evaluation.projectionKind !== 'plan-orthographic') {
		return {
			eye,
			camera: cameraGlyph(evaluation, pose.eye, pose.target, pose.fovYDegrees, true, CAMERA_FRUSTUM_FAR_METRES),
			wedge: null
		};
	}
	const target = projectStage(evaluation, pose.target, false);
	return {
		eye,
		camera: null,
		wedge: target === null ? null : planFrustum('placement', 'selected', eye, target, pose.fovYDegrees, PLAN_WEDGE_SELECTED_PX)
	};
}

/** One related set drives the marks, travel routes and cut links. */
export function relatedToSelection(
	selection: MarkSelection,
	experience: Experience,
	guide: ExperienceGuide | null
): { readonly views: ReadonlySet<string>; readonly paths: ReadonlySet<string> } {
	const views = new Set<string>();
	const paths = new Set<string>();
	if (selection.path !== undefined && selection.path !== null) {
		const path = resolvePathOccurrence(experience, guide, selection.path);
		if (path !== null) {
			views.add(path.fromViewId);
			views.add(path.toViewId);
			paths.add(occurrenceKey(path.occurrence));
		}
	} else if (selection.viewId != null) {
		views.add(selection.viewId);
	} else if (selection.stopId != null) {
		for (const view of experience.stops.find((stop) => stop.id === selection.stopId)?.views ?? []) {
			views.add(view.viewId);
		}
	} else if (selection.presentationId != null) {
		for (const viewId of experience.presentations.find((entry) => entry.id === selection.presentationId)?.viewIds ?? []) {
			views.add(viewId);
		}
	}

	if (selection.path == null && (selection.viewId != null || selection.stopId != null)) {
		for (const path of experiencePathOccurrences(experience, guide)) {
			if (path.stopId === selection.stopId || path.toStopId === selection.stopId ||
				path.fromViewId === selection.viewId || path.toViewId === selection.viewId) {
				paths.add(occurrenceKey(path.occurrence));
			}
		}
	}
	return { views, paths };
}

/** Only Views presented by the Experience have Stage marks. */
export function experienceMarkModel(input: MarkInput): ExperienceMarkModel {
	const { experience, views, evaluation, selection, guide } = input;
	if (experience === null) return { marks: [], frustums: [] };

	const presentationOf = new Map<string, string[]>();
	for (const presentation of experience.presentations) {
		for (const viewId of presentation.viewIds) {
			presentationOf.set(viewId, [...(presentationOf.get(viewId) ?? []), presentation.id]);
		}
	}
	const related = relatedToSelection(selection, experience, guide);
	const guidedStop = selection.path != null || selection.stopId === null || selection.stopId === undefined
		? null
		: experience.stops.find((stop) => stop.id === selection.stopId) ?? null;
	const numbered = new Map<string, number>();
	guidedStop?.views.forEach((view, index) => numbered.set(view.viewId, index + 1));
	const guided = new Set(numbered.keys());
	const nothingSelected =
		(selection.presentationId ?? null) === null && (selection.viewId ?? null) === null && selection.stopId == null && selection.path == null;

	const ordered: {
		readonly view: CameraView;
		readonly presentationId: string;
		readonly state: ExperienceMarkState;
	}[] = [];
	for (const [viewId, presentationIds] of presentationOf) {
		const view = views.find((candidate) => candidate.id === viewId);
		if (view === undefined) continue;
		const presentationId = presentationIds[0]!;
		const selected = selection.viewId === view.id;
		const state: ExperienceMarkState = selected
			? 'selected'
			: related.views.has(view.id)
				? 'strong'
				: nothingSelected
					? 'normal'
					: 'dim';
		ordered.push({ view, presentationId, state });
	}
	ordered.sort((left, right) => stateRank(left.state) - stateRank(right.state));

	const labelsAvailable = new Set<string>();
	const labelCandidates = ordered
		.filter((entry) => entry.state === 'selected' || entry.state === 'strong')
		.sort((left, right) => stateRank(left.state) - stateRank(right.state));
	for (const entry of labelCandidates.slice(0, EXPERIENCE_MARK_CAPS.labels)) labelsAvailable.add(entry.view.id);

	const marks: ExperienceMark[] = [];
	const frustums: ExperienceFrustum[] = [];
	const plan = evaluation.projectionKind === 'plan-orthographic';
	let wires = 0;

	for (const entry of ordered) {
		const { view, presentationId, state } = entry;
		const eye = projectStage(evaluation, view.eye as Vec3, true);
		if (eye === null) continue;
		const label = labelsAvailable.has(view.id) ? view.label : '';
		const number = numbered.get(view.id) ?? null;
		const onTour = guided.has(view.id);

		if (!plan) {
			const wire = wires < EXPERIENCE_MARK_CAPS.frustums;
			const camera = cameraGlyph(evaluation, view.eye as Vec3, view.target as Vec3, view.fov, wire, state === 'selected' ? CAMERA_FRUSTUM_FAR_METRES : CAMERA_FRUSTUM_QUIET_METRES);
			if (camera?.frustum) wires += 1;
			const box: StageBox = camera
				? [camera.bounds[0] - CAMERA_BRACKET_PAD_PX, camera.bounds[1] - CAMERA_BRACKET_PAD_PX, camera.bounds[2] + CAMERA_BRACKET_PAD_PX, camera.bounds[3] + CAMERA_BRACKET_PAD_PX]
				: [eye[0] - PLAN_BOX_HALF_PX, eye[1] - PLAN_BOX_HALF_PX, eye[0] + PLAN_BOX_HALF_PX, eye[1] + PLAN_BOX_HALF_PX];
			marks.push({
				id: `view:${view.id}:glyph`,
				viewId: view.id,
				presentationId,
				kind: 'glyph',
				css: eye,
				label,
				number,
				state,
				tagAt: [eye[0], box[1] - 14],
				numberAt: camera ? [box[0] - 6, box[1] - 4] : [eye[0] - 11, eye[1] - 11],
				box,
				camera
			});
			continue;
		}

		const target = projectStage(evaluation, view.target as Vec3, true);
		if (target === null) continue;
		const box: StageBox = [eye[0] - PLAN_BOX_HALF_PX, eye[1] - PLAN_BOX_HALF_PX, eye[0] + PLAN_BOX_HALF_PX, eye[1] + PLAN_BOX_HALF_PX];
		marks.push({
			id: `view:${view.id}:eye`,
			viewId: view.id,
			presentationId,
			kind: 'eye',
			css: eye,
			label,
			number,
			state,
			tagAt: [eye[0], eye[1] + PLAN_TAG_DROP_PX],
			numberAt: [eye[0] - 11, eye[1] - 11],
			box,
			camera: null
		});

		const length = state === 'selected' ? PLAN_WEDGE_SELECTED_PX : (onTour || state === 'strong') ? PLAN_WEDGE_TOUR_PX : PLAN_WEDGE_QUIET_PX;
		const wedge = planFrustum(view.id, state, eye, target, view.fov, length);
		if (wedge === null) continue;
		if (frustums.length < EXPERIENCE_MARK_CAPS.frustums) frustums.push(wedge);
		const { tip } = wedge;
		if (state === 'selected') {
			marks.push({
				id: `view:${view.id}:turn`,
				viewId: view.id,
				presentationId,
				kind: 'turn',
				css: tip,
				label: '',
				number,
				state,
				tagAt: tip,
				numberAt: tip,
				box,
				camera: null
			});
		}
	}

	return { marks, frustums };
}

type MarkInput = {
	readonly experience: Experience | null;
	readonly guide: ExperienceGuide | null;
	readonly views: readonly CameraView[];
	readonly evaluation: ViewportEvaluation;
	readonly selection: MarkSelection;
};

type MarkSelection = {
	readonly path?: ExperiencePathOccurrence | null;
	readonly presentationId?: string | null;
	readonly viewId?: string | null;
	readonly stopId?: string | null;
};
