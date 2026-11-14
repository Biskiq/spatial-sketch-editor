/**
 * Layout's pointer-to-plane reads, shared by every Layout controller that aims
 * at the Stage (Wall manipulation, Ink drawing, Opening placement).
 *
 * Both functions are pure over what the Stage already evaluated: the accepted
 * Layout document, the compiled geometry and the live projection. They own no
 * state, mint no identity and write nothing.
 */
import type { LayoutDocumentWallFirst, LayoutVec2 } from '@portfolio/layout-core';

import { datumWorkingPlane, type StageAdapterContext } from '$lib/authoring/stage/stage-adapter-host';

import type { ProjectedJunction, ProjectedWall } from './ink';

/**
 * The working-plane point a Stage-local pointer position names.
 *
 * The ray uses the viewport's CSS space (its origin includes the surface offset,
 * exactly as the Scene adapter's floor query does), while pointer intents use
 * Stage-local pixels; the one accepted evaluation rect is the only translation
 * between them. Overlay contributions are viewport CSS and are translated once
 * by `StageFacade.overlays()`, never here.
 */
export function pointerDatumPoint(
	context: StageAdapterContext,
	css: readonly [number, number]
): readonly [number, number] | null {
	const ray = context.ray([
		css[0] + context.evaluation.rect.left,
		css[1] + context.evaluation.rect.top
	]);
	if (ray === null) return null;
	const hit = context.intersect(ray, datumWorkingPlane(context.snapshot.domain.datumMeters));
	return hit.kind === 'intersected' ? [hit.worldPoint[0], hit.worldPoint[2]] : null;
}

/** Every Junction and Wall of the accepted source, projected once. */
export function projectedScene(
	document: LayoutDocumentWallFirst,
	adapterContext: StageAdapterContext
): {
	junctions: readonly ProjectedJunction[];
	walls: readonly ProjectedWall[];
} {
	const y = adapterContext.snapshot.domain.datumMeters;
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const junctions: ProjectedJunction[] = [];
	for (const junction of document.junctions) {
		const css = adapterContext.project([junction.point[0], y, junction.point[1]]);
		if (css === null) continue;
		junctions.push({
			id: junction.id,
			css: [css[0] - adapterContext.evaluation.rect.left, css[1] - adapterContext.evaluation.rect.top],
			point: [junction.point[0], junction.point[1]]
		});
	}
	const walls: ProjectedWall[] = [];
	// Curved and closed Walls are hit-tested against the compiled samples the
	// Stage actually drew. A chord between their endpoints would miss the
	// body entirely and turn an aimed Opening or T-junction into a free point.
	const compiledByWallId = new Map(
		adapterContext.snapshot.domain.geometry.walls.map((compiled) => [compiled.wallId, compiled])
	);
	const localCss = (css: readonly [number, number]): readonly [number, number] => [
		css[0] - adapterContext.evaluation.rect.left,
		css[1] - adapterContext.evaluation.rect.top
	];
	for (const wall of document.walls) {
		const start = junctionById.get(wall.startJunctionId)?.point;
		const end = junctionById.get(wall.endJunctionId)?.point;
		if (start === undefined || end === undefined) continue;
		const startCss = adapterContext.project([start[0], y, start[1]]);
		const endCss = adapterContext.project([end[0], y, end[1]]);
		if (startCss === null || endCss === null) continue;
		let path: readonly LayoutVec2[] | undefined;
		let pathCss: readonly (readonly [number, number])[] | undefined;
		if (wall.centerline.kind !== 'line') {
			const compiled = compiledByWallId.get(wall.id);
			if (compiled !== undefined && compiled.samples.length >= 2) {
				const worldPath = compiled.samples.map(
					(sample) => [sample.point[0], sample.point[1]] as LayoutVec2
				);
				// The compiled run is canonical, but a Wall's Junction is the authored
				// endpoint. Keep the host path joined to it even at sampling tolerance.
				const near = (a: LayoutVec2, b: readonly [number, number]): boolean =>
					Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-6;
				if (!near(worldPath[0]!, start)) worldPath.unshift([start[0], start[1]]);
				if (!near(worldPath.at(-1)!, end)) worldPath.push([end[0], end[1]]);
				const cssPath: (readonly [number, number])[] = [];
				for (const point of worldPath) {
					const projected = adapterContext.project([point[0], y, point[1]]);
					if (projected === null) {
						cssPath.length = 0;
						break;
					}
					cssPath.push(localCss(projected));
				}
				if (cssPath.length === worldPath.length) {
					path = worldPath;
					pathCss = cssPath;
				}
			}
		}
		walls.push({
			id: wall.id,
			startCss: localCss(startCss),
			endCss: localCss(endCss),
			start: [start[0], start[1]],
			end: [end[0], end[1]],
			...(path === undefined || pathCss === undefined ? {} : { path, pathCss })
		});
	}
	return { junctions, walls };
}
