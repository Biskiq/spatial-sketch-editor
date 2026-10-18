/**
 * T2.P01.S03 — floor support, resolved against the geometry the Stage draws.
 *
 * The datum plane alone is not evidence of floor support: a pointer aimed at a
 * Wall, a plinth or another object would still intersect the floor plane behind
 * it and report a pose the creator cannot see. This module builds occluders from
 * the **compiled** Layout (the same solid spans the shared wall-mesh builder
 * consumes, and the compiled Layout objects) plus the resolved Scene's primitive
 * entities, and intersects the pointer ray with them before accepting the datum
 * hit.
 *
 * It is deliberately framework-free and renderer-free: the ray is the one the
 * viewport evaluation produced, the geometry is the one the renderer draws, and
 * the arithmetic is plain boxes/cylinders/spheres, so the behaviour is provable
 * in the fast lane instead of only in a WebGL session.
 *
 * Conservative by construction: a hit on any occluder nearer than the floor is
 * `occluded`, even if an Opening would have let the ray through a Wall's gap —
 * the compiled solid spans already exclude openings, so this is the drawn body,
 * not its bounding box. Unverified shapes are not invented: a model entity has
 * no verified dimensions or contact metadata in this slice and contributes no
 * occluder, which means a model never *fakes* floor support; it can only fail to
 * block one, and that limit is stated in the slice's evidence.
 */

import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
import type { PointerRay } from '@portfolio/camera-core';
import type { RuntimeScene, SceneEntity, Vec3 } from '@portfolio/project-model';

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
	| { readonly id: string; readonly kind: 'sphere'; readonly center: Vec3; readonly radius: number };

export type FloorSupport =
	| { readonly kind: 'floor'; readonly worldPoint: Vec3; readonly distanceMeters: number }
	| { readonly kind: 'occluded'; readonly occluderId: string; readonly distanceMeters: number }
	| { readonly kind: 'none'; readonly reason: 'parallel' | 'behind' | 'degenerate' };

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
	for (const entity of scene.entities) {
		if (entity.id === exceptEntityId) continue;
		const occluder = primitiveOccluder(entity);
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

function hitOccluder(ray: PointerRay, occluder: SupportOccluder): number | null {
	switch (occluder.kind) {
		case 'box':
			return hitBox(ray, occluder);
		case 'sphere':
			return hitSphere(ray, occluder);
		case 'cylinder':
			return hitCylinder(ray, occluder);
	}
}

/**
 * The floor point the pointer supports, or the drawn body that hides it.
 *
 * A hit strictly nearer than the datum intersection is occlusion; a tie (a Wall
 * standing exactly on the datum) is not, so a pointer on the floor beside a Wall
 * still lands on the floor.
 */
export function floorSupport(
	ray: PointerRay,
	datumMeters: number,
	occluders: readonly SupportOccluder[]
): FloorSupport {
	if (Math.abs(ray.direction[1]) < EPSILON) return { kind: 'none', reason: 'parallel' };
	const distance = (datumMeters - ray.origin[1]) / ray.direction[1];
	if (!(distance > 0)) return { kind: 'none', reason: 'behind' };
	let nearest: { id: string; distance: number } | null = null;
	for (const occluder of occluders) {
		const hit = hitOccluder(ray, occluder);
		if (hit === null || !(hit >= 0 && hit < distance - EPSILON)) continue;
		if (nearest === null || hit < nearest.distance) nearest = { id: occluder.id, distance: hit };
	}
	if (nearest !== null) {
		return { kind: 'occluded', occluderId: nearest.id, distanceMeters: nearest.distance };
	}
	return {
		kind: 'floor',
		worldPoint: [
			ray.origin[0] + ray.direction[0] * distance,
			datumMeters,
			ray.origin[2] + ray.direction[2] * distance
		],
		distanceMeters: distance
	};
}
