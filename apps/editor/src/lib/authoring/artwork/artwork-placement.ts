import type { PointerRay } from '@portfolio/camera-core';
import type { CompiledLayoutGeometry, Vec3 } from '@portfolio/project-model';
import type { SceneRenderedHit } from '../scene/scene-pick-source';

export type ArtworkPose = { position: Vec3; rotation: Vec3 };

/**
 * A wall-hung image needs a *side* face. The wall mesh tags a free end's
 * terminal cap with the same `side` pick owner as the wall body, so the pick
 * normal alone cannot tell them apart; the compiled Wall's local centreline
 * tangent can. A side face's normal is perpendicular to that tangent, a cap's
 * is parallel to it. T1's compiled samples are the only wall geometry read
 * here; A1 adds no second wall representation.
 */
export function isArtworkWallFace(
	hit: SceneRenderedHit,
	geometry: CompiledLayoutGeometry | undefined
): boolean {
	const normal = hit.wallNormal;
	if (!normal || Math.abs(normal[1]) >= 1e-4) return false;
	const wall = geometry?.walls.find((entry) => entry.wallId === hit.wallId);
	// Without compiled Wall geometry there is no cap attribution to read; the
	// pick's own `side` tag is the only fact, so keep the historical snap.
	if (!wall || wall.samples.length === 0) return true;
	const [x, , z] = hit.worldPoint;
	let nearest = wall.samples[0]!;
	let best = Infinity;
	for (const sample of wall.samples) {
		const dx = sample.point[0] - x;
		const dz = sample.point[1] - z;
		const squared = dx * dx + dz * dz;
		if (squared >= best) continue;
		best = squared;
		nearest = sample;
	}
	return Math.abs(normal[0] * nearest.tangent[0] + normal[2] * nearest.tangent[1]) < 0.9;
}

export function artworkPlacement(
	ray: PointerRay, hit: SceneRenderedHit | null, datum: number,
	cameraEye: readonly number[], cameraForward: readonly number[], geometry?: CompiledLayoutGeometry
): ArtworkPose | null {
	const normal = hit?.wallNormal;
	if (hit && normal && isArtworkWallFace(hit, geometry)) {
		const yaw = Math.atan2(normal[0], normal[2]);
		const [x, y, z] = hit.worldPoint;
		return { position: [x + 0.002 * Math.sin(yaw), y, z + 0.002 * Math.cos(yaw)], rotation: [0, yaw, 0] };
	}
	const height = datum + 1.5;
	const elevation = (height - ray.origin[1]) / ray.direction[1];
	let distance = elevation;
	if (!Number.isFinite(elevation) || elevation <= 0) {
		const dot = ray.direction.reduce((sum, component, index) => sum + component * cameraForward[index]!, 0);
		const projectedOrigin = ray.origin.reduce((sum, component, index) =>
			sum + (component - cameraEye[index]!) * cameraForward[index]!, 0);
		distance = (3 - projectedOrigin) / dot;
	}
	if (!Number.isFinite(distance) || distance <= 0) return null;
	const position: Vec3 = [
		ray.origin[0] + distance * ray.direction[0],
		ray.origin[1] + distance * ray.direction[1],
		ray.origin[2] + distance * ray.direction[2]
	];
	const dx = cameraEye[0]! - position[0];
	const dz = cameraEye[2]! - position[2];
	const yaw = Math.hypot(dx, dz) < 1e-8 ? Math.atan2(-cameraForward[0]!, -cameraForward[2]!) : Math.atan2(dx, dz);
	return { position, rotation: [0, yaw, 0] };
}
