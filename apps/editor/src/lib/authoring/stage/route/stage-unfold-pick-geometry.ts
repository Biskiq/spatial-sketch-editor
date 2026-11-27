import type { CompiledPhysicalWall } from '@portfolio/layout-core/geometry';
import {
	wallUnfoldFreeEdgeStation,
	wallUnfoldTopPoint,
	type WallUnfoldEdgeCandidate,
	type WallUnfoldState,
} from '$lib/layout/wall-unfold';
import {
	buildWallUnfoldDisplay,
	evaluateWallUnfoldDisplay,
	unfoldDisplayPointAtStation,
} from '$lib/layout/wall-unfold-pick';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import type { StageFacade } from '../stage-facade';

export function wallStationAtPointer(
	wall: CompiledPhysicalWall,
	datum: number,
	stage: StageFacade,
	event: PointerEvent,
): number | null {
	const projectionId = stage.evaluationId();
	if (projectionId === null || wall.samples.length < 2) return null;
	let nearest: number | null = null;
	let nearestDistance = Number.POSITIVE_INFINITY;
	for (let index = 0; index < wall.samples.length - 1; index += 1) {
		const from = wall.samples[index]!;
		const to = wall.samples[index + 1]!;
		const a = stage.projectWorld(wallUnfoldTopPoint(wall, from.distance, datum)!, projectionId);
		const b = stage.projectWorld(wallUnfoldTopPoint(wall, to.distance, datum)!, projectionId);
		if (a.kind !== 'projected' || b.kind !== 'projected') continue;
		const dx = b.css[0] - a.css[0];
		const dy = b.css[1] - a.css[1];
		const lengthSq = dx * dx + dy * dy;
		const t =
			lengthSq <= 1e-9
				? 0
				: Math.min(
						1,
						Math.max(
							0,
							((event.clientX - a.css[0]) * dx + (event.clientY - a.css[1]) * dy) / lengthSq,
						),
					);
		const distance = Math.hypot(
			event.clientX - (a.css[0] + dx * t),
			event.clientY - (a.css[1] + dy * t),
		);
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearest = from.distance + (to.distance - from.distance) * t;
		}
	}
	return nearest;
}

export /** Sample the free edge across the peel range, then restore the live display. */
function edgeCandidates(
	display: ReturnType<typeof buildWallUnfoldDisplay>,
	state: WallUnfoldState,
	wall: CompiledPhysicalWall,
	stage: StageFacade,
): WallUnfoldEdgeCandidate[] {
	if (display === null) return [];
	const projectionId = stage.evaluationId();
	if (projectionId === null) return [];
	const station = wallUnfoldFreeEdgeStation(state, wall.length);
	const candidates: WallUnfoldEdgeCandidate[] = [];
	for (let step = 0; step <= 40; step += 1) {
		const u = step / 40;
		evaluateWallUnfoldDisplay(display, { ...state, u }, wallUnfold.presentationAngle);
		const at = unfoldDisplayPointAtStation(display, station, wallUnfold.presentationAngle);
		const projected = stage.projectWorld(
			[at.point[0], display.floorY + display.height / 2, at.point[1]],
			projectionId,
		);
		if (projected.kind === 'projected') {
			candidates.push({ u, css: [projected.css[0], projected.css[1]] });
		}
	}
	evaluateWallUnfoldDisplay(display, state, wallUnfold.presentationAngle);
	return candidates;
}
