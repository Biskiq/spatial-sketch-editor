/**
 * Floor support, resolved against the geometry the Stage draws.
 *
 * The datum plane alone is not evidence of floor support: a pointer aimed at a
 * Wall, a plinth, a region slab or another object would still intersect the
 * floor plane behind it and report a pose the creator cannot see. This module
 * builds occluders from the **compiled** Layout (the same solid spans the shared
 * wall-mesh builder consumes, compiled Layout objects and horizontal regions)
 * plus the resolved Scene's primitive entities and evaluated forms, and
 * intersects the pointer ray with them before accepting a support face.
 *
 * Supported faces are the drawn upward surfaces: every compiled Room floor and
 * every floor-role region top. An overhead region's top is never a support; its
 * slab still occludes. The nearest visible authored face wins. When no authored
 * face covers the ray, the Layout datum is the support of last resort, exactly
 * as before.
 *
 * It is deliberately framework-free and renderer-free: the ray is the one the
 * viewport evaluation produced, the geometry is the one the renderer draws, and
 * the arithmetic is boxes/cylinders/spheres/polygon prisms plus exact form
 * triangles, so the behaviour is provable in the fast lane instead of only in a
 * WebGL session.
 *
 * Conservative by construction: a hit on any occluder nearer than the selected
 * support is `occluded`, even if an Opening would have let the ray through a
 * Wall's gap — the compiled solid spans already exclude openings, so this is the
 * drawn body, not its bounding box. Unverified shapes are not invented: a model
 * entity has no verified dimensions or contact metadata here and contributes no
 * occluder, which means a model never *fakes* floor support; it can only fail to
 * block one. Imported model meshes remain excluded from this occluder set: this
 * seam does not ray-test model geometry or add imported-mesh intersection.
 */

import type { CompiledLayoutGeometry, LayoutVec2 } from '@portfolio/layout-core';
import { polygonContainsWithTolerance } from '@portfolio/layout-core';
import type { PointerRay } from '@portfolio/camera-core';
import type { FormMesh } from '@portfolio/geometry-core';
import type { RuntimeScene, SceneEntity, Vec3 } from '@portfolio/project-model';
import { evaluateFormMesh } from '$lib/content/form-evaluation';

const EPSILON = 1e-6;

export type SupportOccluder =
	| {
			readonly id: string;
			readonly kind: 'box';
			readonly center: Vec3;
			/** Half extents on the box's own axes: X along its length, Y up, Z its thickness. */
			readonly halfExtents: Vec3;
			readonly yaw: number;
	  }
	| {
			readonly id: string;
			readonly kind: 'cylinder';
			readonly center: Vec3;
			readonly radius: number;
			readonly height: number;
	  }
	| { readonly id: string; readonly kind: 'sphere'; readonly center: Vec3; readonly radius: number }
	| {
			readonly id: string;
			readonly kind: 'form-mesh';
			readonly center: Vec3;
			readonly rotation: Vec3;
			readonly mesh: FormMesh;
	  }
	| {
			/**
			 * A compiled horizontal region's closed slab. Its top may also be a
			 * support face; the strict "nearer than" occlusion rule leaves the top
			 * hit itself unblocked while its sides and underside block what is
			 * behind them.
			 */
			readonly id: string;
			readonly kind: 'polygon-prism';
			readonly polygon: readonly LayoutVec2[];
			readonly bottomY: number;
			readonly topY: number;
	  };

/** Where a visible upward support came from. */
export type FloorSupportSurface =
	| { readonly kind: 'room-floor'; readonly roomId: string }
	| { readonly kind: 'region-top'; readonly regionId: string }
	| { readonly kind: 'datum' };

/** One compiled upward face a pointer ray may stand on. */
export type UpwardSupportFace = {
	readonly id: string;
	readonly kind: 'room-floor' | 'region-top';
	readonly polygon: readonly LayoutVec2[];
	readonly elevation: number;
	readonly roomId?: string;
	readonly regionId?: string;
};

export type FloorSupport =
	| {
			readonly kind: 'floor';
			readonly worldPoint: Vec3;
			readonly distanceMeters: number;
			readonly surface: FloorSupportSurface;
	  }
	| { readonly kind: 'occluded'; readonly occluderId: string; readonly distanceMeters: number }
	| { readonly kind: 'none'; readonly reason: 'parallel' | 'behind' | 'degenerate' };

/**
 * The compiled upward faces of one Layout, in no priority order.
 *
 * Only a Room floor and a floor-role region top offer upward support. A face
 * with no usable boundary is skipped rather than guessed at.
 */
export function upwardSupportFaces(
	geometry: CompiledLayoutGeometry
): readonly UpwardSupportFace[] {
	const faces: UpwardSupportFace[] = [];
	for (const room of geometry.rooms) {
		if (room.floorPolygon.length < 3 || !Number.isFinite(room.floorElevation)) continue;
		faces.push({
			id: `room-floor:${room.roomId}`,
			kind: 'room-floor',
			polygon: room.floorPolygon,
			elevation: room.floorElevation,
			roomId: room.roomId
		});
	}
	for (const region of geometry.regions) {
		if (region.role !== 'floor') continue;
		if (region.footprint.length < 3 || !Number.isFinite(region.topY)) continue;
		faces.push({
			id: `region-top:${region.regionId}`,
			kind: 'region-top',
			polygon: region.footprint,
			elevation: region.topY,
			regionId: region.regionId
		});
	}
	return faces;
}

/** The yaw that turns a box's local +X onto a horizontal span. */
function spanYaw(start: readonly [number, number], end: readonly [number, number]): number {
	return Math.atan2(-(end[1] - start[1]), end[0] - start[0]);
}

function boxFromSpan(
	id: string,
	start: readonly [number, number],
	end: readonly [number, number],
	bottomY: number,
	topY: number,
	thickness: number
): SupportOccluder | null {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const length = Math.hypot(dx, dz);
	const height = topY - bottomY;
	if (!(length > EPSILON) || !(height > EPSILON)) return null;
	return {
		id,
		kind: 'box',
		center: [(start[0] + end[0]) / 2, (bottomY + topY) / 2, (start[1] + end[1]) / 2],
		halfExtents: [length / 2, height / 2, Math.max(thickness, EPSILON) / 2],
		yaw: spanYaw(start, end)
	};
}

function primitiveOccluder(entity: SceneEntity): SupportOccluder | null {
	if (entity.kind !== 'primitive') return null;
	const id = `scene:${entity.id}`;
	const center: Vec3 = [...entity.position] as Vec3;
	switch (entity.primitive) {
		case 'box': {
			const { width, height, depth } = entity.dimensions;
			if (!(width > EPSILON) || !(height > EPSILON) || !(depth > EPSILON)) return null;
			return {
				id,
				kind: 'box',
				center,
				halfExtents: [width / 2, height / 2, depth / 2],
				yaw: entity.rotation[1]
			};
		}
		case 'plane': {
			const { width, height } = entity.dimensions;
			if (!(width > EPSILON) || !(height > EPSILON)) return null;
			// A plane is drawn without thickness; a hair of depth keeps the slab test
			// well-conditioned without inventing a solid body.
			return {
				id,
				kind: 'box',
				center,
				halfExtents: [width / 2, height / 2, EPSILON],
				yaw: entity.rotation[1]
			};
		}
		case 'cylinder':
			if (!(entity.dimensions.radius > EPSILON) || !(entity.dimensions.height > EPSILON)) return null;
			return {
				id,
				kind: 'cylinder',
				center,
				radius: entity.dimensions.radius,
				height: entity.dimensions.height
			};
		case 'sphere':
			if (!(entity.dimensions.radius > EPSILON)) return null;
			return { id, kind: 'sphere', center, radius: entity.dimensions.radius };
	}
}

function formOccluder(entity: Extract<SceneEntity, { kind: 'form' }>): SupportOccluder | null {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null || mesh.indices.length === 0) return null;
	return {
		id: `scene:${entity.id}`,
		kind: 'form-mesh',
		center: [...entity.position] as Vec3,
		rotation: [...entity.rotation] as Vec3,
		mesh
	};
}

/**
 * Every occluder the Stage draws for one admitted snapshot.
 *
 * `exceptEntityId` is the subject of the live proposal: its own accepted body is
 * not support evidence, and letting it block the ray would make a low camera
 * unable to drag the object it is editing.
 */
export function supportOccluders(
	geometry: CompiledLayoutGeometry,
	scene: RuntimeScene,
	exceptEntityId: string | null = null
): readonly SupportOccluder[] {
	const occluders: SupportOccluder[] = [];
	for (const wall of geometry.walls ?? []) {
		for (const span of wall.solidSpans) {
			const box = boxFromSpan(
				`wall:${wall.wallId}:${span.sectionIndex}:${span.startDistance}`,
				span.start,
				span.end,
				span.bottomY,
				span.topY,
				wall.thickness
			);
			if (box !== null) occluders.push(box);
		}
	}
	for (const object of geometry.objects) {
		if (!(object.dimensions[0] > EPSILON) || !(object.dimensions[1] > EPSILON) || !(object.dimensions[2] > EPSILON)) continue;
		occluders.push({
			id: `layout:${object.objectId}`,
			kind: 'box',
			center: [...object.position] as Vec3,
			halfExtents: [object.dimensions[0] / 2, object.dimensions[1] / 2, object.dimensions[2] / 2],
			yaw: object.rotation[1]
		});
	}
	for (const region of geometry.regions) {
		if (
			region.footprint.length < 3 ||
			!Number.isFinite(region.bottomY) ||
			!Number.isFinite(region.topY) ||
			!(region.topY - region.bottomY > EPSILON)
		) {
			continue;
		}
		occluders.push({
			id: `layout-region:${region.regionId}`,
			kind: 'polygon-prism',
			polygon: region.footprint,
			bottomY: region.bottomY,
			topY: region.topY
		});
	}
	for (const entity of scene.entities) {
		if (entity.id === exceptEntityId) continue;
		const occluder = entity.kind === 'form' ? formOccluder(entity) : primitiveOccluder(entity);
		if (occluder !== null) occluders.push(occluder);
	}
	return occluders;
}

/** Local-space ray for a yawed box: translate to its centre, then undo its yaw. */
function localRay(ray: PointerRay, center: Vec3, yaw: number) {
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	const toLocal = (x: number, y: number, z: number): Vec3 => [
		cos * (x - center[0]) - sin * (z - center[2]),
		y - center[1],
		sin * (x - center[0]) + cos * (z - center[2])
	];
	return {
		origin: toLocal(ray.origin[0], ray.origin[1], ray.origin[2]),
		direction: toLocal(ray.direction[0] + center[0], ray.direction[1] + center[1], ray.direction[2] + center[2])
	};
}

/** Undo a Three.js group's default XYZ Euler rotation (Rz * Ry * Rx). */
function inverseRotateXYZ(point: Vec3, rotation: Vec3): Vec3 {
	const [x, y, z] = rotation;
	const cosX = Math.cos(x);
	const sinX = Math.sin(x);
	const cosY = Math.cos(y);
	const sinY = Math.sin(y);
	const cosZ = Math.cos(z);
	const sinZ = Math.sin(z);

	// Apply the inverse in reverse order: Rz(-z), then Ry(-y), then Rx(-x).
	const afterZ: Vec3 = [
		cosZ * point[0] + sinZ * point[1],
		-sinZ * point[0] + cosZ * point[1],
		point[2]
	];
	const afterY: Vec3 = [
		cosY * afterZ[0] - sinY * afterZ[2],
		afterZ[1],
		sinY * afterZ[0] + cosY * afterZ[2]
	];
	return [
		afterY[0],
		cosX * afterY[1] + sinX * afterY[2],
		-sinX * afterY[1] + cosX * afterY[2]
	];
}

/** Local-space ray for a form mesh: translate to its origin, then undo all Euler axes. */
function localFormRay(ray: PointerRay, center: Vec3, rotation: Vec3) {
	const translatedOrigin: Vec3 = [
		ray.origin[0] - center[0],
		ray.origin[1] - center[1],
		ray.origin[2] - center[2]
	];
	return {
		origin: inverseRotateXYZ(translatedOrigin, rotation),
		direction: inverseRotateXYZ(ray.direction, rotation)
	};
}

function hitBox(ray: PointerRay, occluder: Extract<SupportOccluder, { kind: 'box' }>): number | null {
	const { origin, direction } = localRay(ray, occluder.center, occluder.yaw);
	let near = 0;
	let far = Number.POSITIVE_INFINITY;
	for (let axis = 0; axis < 3; axis += 1) {
		const o = origin[axis]!;
		const d = direction[axis]!;
		const half = occluder.halfExtents[axis]!;
		if (Math.abs(d) < EPSILON) {
			if (o < -half || o > half) return null;
			continue;
		}
		const t1 = (-half - o) / d;
		const t2 = (half - o) / d;
		near = Math.max(near, Math.min(t1, t2));
		far = Math.min(far, Math.max(t1, t2));
		if (near > far) return null;
	}
	return far < 0 ? null : near;
}

function hitSphere(ray: PointerRay, occluder: Extract<SupportOccluder, { kind: 'sphere' }>): number | null {
	const ox = ray.origin[0] - occluder.center[0];
	const oy = ray.origin[1] - occluder.center[1];
	const oz = ray.origin[2] - occluder.center[2];
	const a = ray.direction[0] ** 2 + ray.direction[1] ** 2 + ray.direction[2] ** 2;
	if (!(a > EPSILON)) return null;
	const b = 2 * (ox * ray.direction[0] + oy * ray.direction[1] + oz * ray.direction[2]);
	const c = ox * ox + oy * oy + oz * oz - occluder.radius ** 2;
	const discriminant = b * b - 4 * a * c;
	if (discriminant < 0) return null;
	const root = Math.sqrt(discriminant);
	const near = (-b - root) / (2 * a);
	return near >= 0 ? near : null;
}

function hitCylinder(ray: PointerRay, occluder: Extract<SupportOccluder, { kind: 'cylinder' }>): number | null {
	const ox = ray.origin[0] - occluder.center[0];
	const oz = ray.origin[2] - occluder.center[2];
	const dx = ray.direction[0];
	const dz = ray.direction[2];
	const a = dx * dx + dz * dz;
	const bottom = occluder.center[1] - occluder.height / 2;
	const top = occluder.center[1] + occluder.height / 2;
	const within = (t: number): boolean => {
		const y = ray.origin[1] + ray.direction[1] * t;
		return y >= bottom - EPSILON && y <= top + EPSILON;
	};
	if (a > EPSILON) {
		const b = 2 * (ox * dx + oz * dz);
		const c = ox * ox + oz * oz - occluder.radius ** 2;
		const discriminant = b * b - 4 * a * c;
		if (discriminant >= 0) {
			const root = Math.sqrt(discriminant);
			for (const t of [(-b - root) / (2 * a), (-b + root) / (2 * a)]) {
				if (t >= 0 && within(t)) return t;
			}
		}
	}
	// Caps: a ray entering from above/below still meets the drawn body.
	if (Math.abs(ray.direction[1]) >= EPSILON) {
		for (const y of [bottom, top]) {
			const t = (y - ray.origin[1]) / ray.direction[1];
			if (t < 0) continue;
			const px = ox + dx * t;
			const pz = oz + dz * t;
			if (px * px + pz * pz <= occluder.radius ** 2) return t;
		}
	}
	return null;
}

/**
 * First entry into a closed vertical prism.
 *
 * The top and underside are tested as polygons; the sides as exact quads. A ray
 * that starts inside blocks immediately. This is the drawn region slab, so a
 * side or underside nearer than a floor behind it is real occlusion — while the
 * top hit at a support's own distance is not.
 */
function hitPolygonPrism(
	ray: PointerRay,
	occluder: Extract<SupportOccluder, { kind: 'polygon-prism' }>
): number | null {
	let nearest: number | null = null;
	const consider = (t: number) => {
		if (t >= 0 && (nearest === null || t < nearest)) nearest = t;
	};
	const { origin, direction } = ray;
	if (
		origin[1] >= occluder.bottomY - EPSILON &&
		origin[1] <= occluder.topY + EPSILON &&
		polygonContainsWithTolerance([origin[0], origin[2]], occluder.polygon)
	) {
		return 0;
	}
	if (Math.abs(direction[1]) >= EPSILON) {
		for (const y of [occluder.bottomY, occluder.topY]) {
			const t = (y - origin[1]) / direction[1];
			if (t < 0) continue;
			const x = origin[0] + direction[0] * t;
			const z = origin[2] + direction[2] * t;
			if (polygonContainsWithTolerance([x, z], occluder.polygon)) consider(t);
		}
	}
	const polygon = occluder.polygon;
	for (let index = 0; index < polygon.length; index += 1) {
		const a = polygon[index]!;
		const b = polygon[(index + 1) % polygon.length]!;
		const ex = b[0] - a[0];
		const ez = b[1] - a[1];
		const lengthSquared = ex * ex + ez * ez;
		if (!(lengthSquared > EPSILON * EPSILON)) continue;
		// A vertical plane through the edge; the polygon is the segment between a
		// and b, and the finite y band is the slab's height.
		const nx = ez;
		const nz = -ex;
		const denominator = direction[0] * nx + direction[2] * nz;
		if (Math.abs(denominator) < EPSILON) continue;
		const t = ((a[0] - origin[0]) * nx + (a[1] - origin[2]) * nz) / denominator;
		if (t < 0) continue;
		const y = origin[1] + direction[1] * t;
		if (y < occluder.bottomY - EPSILON || y > occluder.topY + EPSILON) continue;
		const x = origin[0] + direction[0] * t;
		const z = origin[2] + direction[2] * t;
		const along = ((x - a[0]) * ex + (z - a[1]) * ez) / lengthSquared;
		if (along >= -EPSILON && along <= 1 + EPSILON) consider(t);
	}
	return nearest;
}

/**
 * Conservative ray/bounds rejection in the form's own local space.
 *
 * Every triangle lies inside the canonical bounds, so a ray that misses the
 * box cannot hit the body: skipping the loop cannot change a hit. The box is
 * grown by the same epsilon the triangle test tolerates, so a ray grazing a
 * boundary still reaches the exact test rather than being rejected by rounding.
 */
function rayMeetsBounds(
	origin: Vec3,
	direction: Vec3,
	bounds: Extract<SupportOccluder, { kind: 'form-mesh' }>['mesh']['bounds']
): boolean {
	let near = 0;
	let far = Number.POSITIVE_INFINITY;
	for (let axis = 0; axis < 3; axis += 1) {
		const value = origin[axis]!;
		const slope = direction[axis]!;
		const low = bounds.min[axis]! - EPSILON;
		const high = bounds.max[axis]! + EPSILON;
		if (Math.abs(slope) < EPSILON) {
			if (value < low || value > high) return false;
			continue;
		}
		const first = (low - value) / slope;
		const second = (high - value) / slope;
		const enter = Math.min(first, second);
		const leave = Math.max(first, second);
		if (enter > near) near = enter;
		if (leave < far) far = leave;
		if (near > far) return false;
	}
	return far >= 0;
}

/** Nearest hit against the canonical triangles the Stage's form renderer draws. */
function hitFormMesh(
	ray: PointerRay,
	occluder: Extract<SupportOccluder, { kind: 'form-mesh' }>
): number | null {
	const local = localFormRay(ray, occluder.center, occluder.rotation);
	if (!rayMeetsBounds(local.origin, local.direction, occluder.mesh.bounds)) return null;
	const { positions, indices } = occluder.mesh;
	const [ox, oy, oz] = local.origin;
	const [dx, dy, dz] = local.direction;
	let nearest: number | null = null;
	// Scalars, not Vec3 tuples: this runs for every triangle of every form on
	// pointer movement, and one tuple per intermediate allocated more than the
	// arithmetic cost. The operations and their order are the Vec3 form's, so the
	// answer is unchanged.
	for (let index = 0; index < indices.length; index += 3) {
		const a = indices[index]! * 3;
		const b = indices[index + 1]! * 3;
		const c = indices[index + 2]! * 3;
		const ax = positions[a]!;
		const ay = positions[a + 1]!;
		const az = positions[a + 2]!;
		const e1x = positions[b]! - ax;
		const e1y = positions[b + 1]! - ay;
		const e1z = positions[b + 2]! - az;
		const e2x = positions[c]! - ax;
		const e2y = positions[c + 1]! - ay;
		const e2z = positions[c + 2]! - az;
		const px = dy * e2z - dz * e2y;
		const py = dz * e2x - dx * e2z;
		const pz = dx * e2y - dy * e2x;
		const determinant = e1x * px + e1y * py + e1z * pz;
		if (Math.abs(determinant) <= 1e-12) continue;
		const inverseDeterminant = 1 / determinant;
		const fx = ox - ax;
		const fy = oy - ay;
		const fz = oz - az;
		const u = (fx * px + fy * py + fz * pz) * inverseDeterminant;
		if (u < -EPSILON || u > 1 + EPSILON) continue;
		const qx = fy * e1z - fz * e1y;
		const qy = fz * e1x - fx * e1z;
		const qz = fx * e1y - fy * e1x;
		const v = (dx * qx + dy * qy + dz * qz) * inverseDeterminant;
		if (v < -EPSILON || u + v > 1 + EPSILON) continue;
		const distance = (e2x * qx + e2y * qy + e2z * qz) * inverseDeterminant;
		if (distance >= 0 && (nearest === null || distance < nearest)) nearest = distance;
	}
	return nearest;
}

function hitOccluder(ray: PointerRay, occluder: SupportOccluder): number | null {
	switch (occluder.kind) {
		case 'box':
			return hitBox(ray, occluder);
		case 'sphere':
			return hitSphere(ray, occluder);
		case 'cylinder':
			return hitCylinder(ray, occluder);
		case 'form-mesh':
			return hitFormMesh(ray, occluder);
		case 'polygon-prism':
			return hitPolygonPrism(ray, occluder);
	}
}

type SupportCandidate = {
	readonly distance: number;
	readonly worldPoint: Vec3;
	readonly surface: FloorSupportSurface;
};

/**
 * The floor point the pointer supports, or the drawn body that hides it.
 *
 * Authored Room-floor and floor-region-top faces are tested first: the ray must
 * approach the upward face from above and cross its compiled footprint. The
 * nearest such face wins unless a solid body is strictly nearer. Only when no
 * authored face is visible does the Layout datum act as the support of last
 * resort, preserving the pre-region behavior outside enclosure.
 *
 * A hit strictly nearer than the selected support is occlusion; a tie (a Wall
 * standing exactly on the datum, or the slab top that *is* the support) is not,
 * so a pointer on the floor beside a Wall still lands on the floor.
 */
export function floorSupport(
	ray: PointerRay,
	datumMeters: number,
	occluders: readonly SupportOccluder[],
	supportFaces: readonly UpwardSupportFace[] = []
): FloorSupport {
	if (Math.abs(ray.direction[1]) < EPSILON) return { kind: 'none', reason: 'parallel' };
	let nearestOccluder: { id: string; distance: number } | null = null;
	for (const occluder of occluders) {
		const hit = hitOccluder(ray, occluder);
		if (hit === null || !(hit >= 0)) continue;
		if (nearestOccluder === null || hit < nearestOccluder.distance) {
			nearestOccluder = { id: occluder.id, distance: hit };
		}
	}

	const candidates: SupportCandidate[] = [];
	// An upward face is visible only from above: a ray climbing from below meets
	// the slab's underside, not the top a creator can stand on.
	if (ray.direction[1] < -EPSILON) {
		for (const face of supportFaces) {
			const distance = (face.elevation - ray.origin[1]) / ray.direction[1];
			if (!(distance > 0)) continue;
			const x = ray.origin[0] + ray.direction[0] * distance;
			const z = ray.origin[2] + ray.direction[2] * distance;
			if (!polygonContainsWithTolerance([x, z], face.polygon)) continue;
			candidates.push({
				distance,
				worldPoint: [x, face.elevation, z],
				surface:
					face.kind === 'room-floor'
						? { kind: 'room-floor', roomId: face.roomId! }
						: { kind: 'region-top', regionId: face.regionId! }
			});
		}
		candidates.sort((left, right) => left.distance - right.distance);
	}
	for (const candidate of candidates) {
		if (
			nearestOccluder !== null &&
			nearestOccluder.distance < candidate.distance - EPSILON
		) {
			// Candidates are ordered, so every remaining face is farther still.
			break;
		}
		return {
			kind: 'floor',
			worldPoint: candidate.worldPoint,
			distanceMeters: candidate.distance,
			surface: candidate.surface
		};
	}

	const distance = (datumMeters - ray.origin[1]) / ray.direction[1];
	if (!(distance > 0)) {
		return nearestOccluder !== null
			? { kind: 'occluded', occluderId: nearestOccluder.id, distanceMeters: nearestOccluder.distance }
			: { kind: 'none', reason: 'behind' };
	}
	if (nearestOccluder !== null && nearestOccluder.distance < distance - EPSILON) {
		return { kind: 'occluded', occluderId: nearestOccluder.id, distanceMeters: nearestOccluder.distance };
	}
	return {
		kind: 'floor',
		worldPoint: [
			ray.origin[0] + ray.direction[0] * distance,
			datumMeters,
			ray.origin[2] + ray.direction[2] * distance
		],
		distanceMeters: distance,
		surface: { kind: 'datum' }
	};
}
