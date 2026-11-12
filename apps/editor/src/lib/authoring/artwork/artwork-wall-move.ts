import type { PointerRay } from '@portfolio/camera-core';
import {
	artworkFrameLayout,
	artworkHeight,
	type SceneArtworkEntity,
	type Vec3
} from '@portfolio/project-model';
import type { SceneRenderedHit } from '../scene/scene-pick-source';

export type ArtworkWallRayPicker = (ray: PointerRay) => SceneRenderedHit | null;

/** The artwork's outer frame size in metres, including any frame border. */
export function artworkOuterSize(
	entity: Pick<SceneArtworkEntity, 'widthMeters' | 'source' | 'frame'>
): { width: number; height: number } {
	const imageHeight = artworkHeight(entity.widthMeters, entity.source);
	const layout = artworkFrameLayout(entity.widthMeters, imageHeight, entity.frame);
	return { width: layout.outerWidth, height: layout.outerHeight };
}

/** The outward face normal for an Artwork yaw. */
export function artworkFaceNormal(yaw: number): Vec3 {
	return [Math.sin(yaw), 0, Math.cos(yaw)];
}

/**
 * The nine points whose wall contact decides whether a wall-hung Artwork still
 * fits: four outer corners, four edge midpoints and the centre. A single
 * centre ray would pass while a corner hung over a window or past the wall end.
 */
export function artworkFrameSamples(
	position: readonly number[],
	yaw: number,
	outer: { width: number; height: number }
): Vec3[] {
	const right: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
	const up: Vec3 = [0, 1, 0];
	const samples: Vec3[] = [];
	for (const u of [-0.5, 0, 0.5]) {
		for (const v of [-0.5, 0, 0.5]) {
			const du = u * outer.width;
			const dv = v * outer.height;
			samples.push([
				position[0]! + right[0] * du + up[0] * dv,
				position[1]! + right[1] * du + up[1] * dv,
				position[2]! + right[2] * du + up[2] * dv
			]);
		}
	}
	return samples;
}

/**
 * True when every outer-frame sample still meets the same wall face within
 * 0.07 m. The cast starts 0.05 m in front of the face and runs back along its
 * normal, so a passing sample lands 0.05 m away; the tolerance also covers a
 * frame that stands slightly off a curved wall.
 */
export function artworkFitsWall(
	position: readonly number[],
	yaw: number,
	outer: { width: number; height: number },
	wallId: string,
	pick: ArtworkWallRayPicker,
	options: { readonly curved?: boolean } = {}
): boolean {
	const normal = artworkFaceNormal(yaw);
	for (const point of artworkFrameSamples(position, yaw, outer)) {
		const origin: Vec3 = [
			point[0] + normal[0] * 0.05,
			point[1] + normal[1] * 0.05,
			point[2] + normal[2] * 0.05
		];
		const hit = pick({
			origin,
			direction: [-normal[0], -normal[1], -normal[2]]
		});
		if (hit === null || hit.wallId !== wallId) return false;
		// A flat, centre-tangent Artwork on a curved Wall may stand off the curve
		// at its corners. Keep the same-wall/end/opening check, but do not apply
		// the straight-face corner proximity threshold (fix.md §7.3.4).
		if (options.curved !== true && Math.abs(hit.distanceMeters - 0.05) > 0.07) return false;
	}
	return true;
}

/** The wall face immediately behind an Artwork, if its back normal reaches one. */
export function artworkBackWallHit(
	position: readonly number[],
	yaw: number,
	pick: ArtworkWallRayPicker
): SceneRenderedHit | null {
	const normal = artworkFaceNormal(yaw);
	return pick({
		origin: [position[0], position[1], position[2]],
		direction: [-normal[0], -normal[1], -normal[2]]
	});
}

/**
 * True when the accepted Artwork is hanging on a wall: a ray from its face back
 * along the face normal reaches a wall within 0.01 m. Free-standing Artwork
 * keeps its plane move until a passing wall pose attaches it.
 */
export function artworkIsHung(
	position: readonly number[],
	yaw: number,
	pick: ArtworkWallRayPicker
): boolean {
	const hit = artworkBackWallHit(position, yaw, pick);
	return hit !== null && hit.distanceMeters <= 0.01;
}

/** True when the face is a curved (multi-tangent) sampled Wall. */
export function artworkWallIsCurved(
	hit: SceneRenderedHit | null,
	geometry: { readonly walls: readonly { readonly wallId: string; readonly samples: readonly { readonly tangent: readonly [number, number] }[] }[] } | undefined
): boolean {
	if (hit?.wallId === undefined || geometry === undefined) return false;
	const wall = geometry.walls.find((entry) => entry.wallId === hit.wallId);
	if (wall === undefined || wall.samples.length < 3) return false;
	const first = wall.samples[0]!.tangent;
	return wall.samples.some((sample) => {
		const cross = first[0] * sample.tangent[1] - first[1] * sample.tangent[0];
		const dot = first[0] * sample.tangent[0] + first[1] * sample.tangent[1];
		return Math.abs(Math.atan2(cross, dot)) > Math.PI / 60;
	});
}
