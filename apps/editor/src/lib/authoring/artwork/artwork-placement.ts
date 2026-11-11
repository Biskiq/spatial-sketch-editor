import type { PointerRay } from '@portfolio/camera-core';
import type { CompiledLayoutGeometry, Vec3 } from '@portfolio/project-model';
import type { SceneRenderedHit } from '../scene/scene-pick-source';

export type ArtworkPose = { position: Vec3; rotation: Vec3 };

export function artworkPlacement(
	ray: PointerRay, hit: SceneRenderedHit | null, datum: number,
	cameraEye: readonly number[], cameraForward: readonly number[], geometry?: CompiledLayoutGeometry
): ArtworkPose | null {
	const normal = hit?.wallNormal;
	if (normal && Math.abs(normal[1]) < 1e-4 && !isWallCap(hit, geometry)) {
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

/** Terminal caps use the wall-side pick owner. Resolve their existing Layout attribution. */
function isWallCap(hit: SceneRenderedHit, geometry: CompiledLayoutGeometry | undefined): boolean {
	const wall = geometry?.walls.find((entry) => entry.wallId === hit.wallId);
	if (!wall || !hit.wallNormal) return false;
	const [x, y, z] = hit.worldPoint;
	const [nx, , nz] = hit.wallNormal;
	const ends = [wall.startJunctionId, wall.endJunctionId];
	return (geometry?.junctions ?? []).some((junction) => ends.includes(junction.junctionId) &&
		junction.resolution.joins.some((join) => join.wallId === wall.wallId &&
			join.surfaces?.some((surface) => surface.kind === 'terminal-cap' &&
				surface.normal[0] * nx + surface.normal[1] * nz > 0.999 &&
				Math.abs((x - surface.from[0]) * nx + (z - surface.from[1]) * nz) < 1e-5 &&
				surface.bands.some((band) => y >= band.bottomY && y <= band.topY))));
}
