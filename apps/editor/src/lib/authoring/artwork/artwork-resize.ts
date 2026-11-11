import { Euler, Vector3 } from 'three';
import type { PointerRay } from '@portfolio/camera-core';
import {
	ARTWORK_MIN_METERS, ARTWORK_MAX_METERS, artworkHeight, type SceneArtworkEntity
} from '@portfolio/project-model';

export type ArtworkCorner = readonly [x: -1 | 1, y: -1 | 1];
export const ARTWORK_CORNERS: readonly ArtworkCorner[] = [[-1, -1], [-1, 1], [1, 1], [1, -1]];

function orientation(entity: SceneArtworkEntity): Euler {
	return new Euler(...entity.rotation);
}

export function artworkCornerPoint(entity: SceneArtworkEntity, [x, y]: ArtworkCorner) {
	return new Vector3(x * entity.widthMeters / 2, y * artworkHeight(entity.widthMeters, entity.source) / 2, 0)
		.applyEuler(orientation(entity)).add(new Vector3(...entity.position));
}

export function resizeArtworkAtRay(entity: SceneArtworkEntity, [x, y]: ArtworkCorner, ray: PointerRay) {
	const rotation = orientation(entity);
	const normal = new Vector3(0, 0, 1).applyEuler(rotation);
	const direction = new Vector3(...ray.direction);
	const origin = new Vector3(...ray.origin);
	const opposite = artworkCornerPoint(entity, [-x as -1 | 1, -y as -1 | 1]);
	const divisor = normal.dot(direction);
	if (Math.abs(divisor) < 1e-8) return null;
	const distance = normal.dot(opposite.clone().sub(origin)) / divisor;
	if (!(distance > 0)) return null;
	const aspect = entity.source.pixelHeight / entity.source.pixelWidth;
	const diagonal = new Vector3(x, y * aspect, 0).applyEuler(rotation);
	const width = origin.addScaledVector(direction, distance).sub(opposite).dot(diagonal) / diagonal.lengthSq();
	const widthMeters = Math.max(ARTWORK_MIN_METERS / Math.min(1, aspect),
		Math.min(width, ARTWORK_MAX_METERS / Math.max(1, aspect)));
	const position = opposite.addScaledVector(diagonal, widthMeters / 2).toArray();
	return { ...entity, widthMeters, position };
}

export function artworkPlanePoint(entity: SceneArtworkEntity, ray: PointerRay): Vector3 | null {
	const origin = new Vector3(...ray.origin);
	const direction = new Vector3(...ray.direction);
	const normal = new Vector3(0, 0, 1).applyEuler(orientation(entity));
	const divisor = normal.dot(direction);
	if (Math.abs(divisor) < 1e-8) return null;
	const distance = normal.dot(new Vector3(...entity.position).sub(origin)) / divisor;
	return distance > 0 ? origin.addScaledVector(direction, distance) : null;
}
