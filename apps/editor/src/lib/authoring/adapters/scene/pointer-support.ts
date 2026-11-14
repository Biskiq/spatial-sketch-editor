/**
 * X7 — pointer-to-support readings for the Scene authoring gestures.
 *
 * Pure functions of one Stage adapter context: the datum point a pointer ray
 * reaches, the floor support it may stand on past the drawn geometry, the
 * snapped Place support the planner will commit at, and the shared CSS-pixel
 * click/drag boundary. Placement and the object-mark gestures both read these;
 * neither owns them, and they keep no gesture state (the occluder lists are
 * memoized per immutable accepted snapshot in a WeakMap, exactly as before).
 *
 * Support resolution itself stays with `./support-occlusion` and the Scene
 * planners (`resolveSceneSupportOnGeometry`); nothing here is new planning math.
 */

import { datumWorkingPlane, isStageDrag } from '$lib/authoring/stage/stage-adapter-host';
import type { StageAdapterContext } from '$lib/authoring/stage/stage-adapter-host';
import type { Vec3 } from '@portfolio/project-model';
import {
	resolveSceneSupportOnGeometry,
	sceneSupportGenerationId,
	type SceneSupportChoice
} from '@portfolio/project-model/scene-planning';
import { snapFreePlacement, type SceneSessionOutcome } from './placement';
import { floorSupport, supportOccluders, type SupportOccluder } from './support-occlusion';

/**
 * Occluders already built for one accepted snapshot, keyed by excluded subject.
 *
 * A snapshot is immutable: its compiled geometry and resolved Scene are the
 * accepted revision's, not a working copy. Building the list evaluates every
 * form's canonical key and allocates one occluder per drawn body, which pointer
 * movement would otherwise repeat for an unchanged Stage. The WeakMap retires
 * the lists with the snapshot, and the excluded id is part of the key because a
 * live drag changes it while the snapshot stays current.
 */
const occludersBySnapshot = new WeakMap<
	StageAdapterContext['snapshot'],
	Map<string | null, readonly SupportOccluder[]>
>();

function snapshotOccluders(
	context: StageAdapterContext,
	exceptEntityId: string | null
): readonly SupportOccluder[] {
	let bySubject = occludersBySnapshot.get(context.snapshot);
	if (bySubject === undefined) {
		bySubject = new Map();
		occludersBySnapshot.set(context.snapshot, bySubject);
	}
	const cached = bySubject.get(exceptEntityId);
	if (cached !== undefined) return cached;
	const domain = context.snapshot.domain;
	const built = supportOccluders(domain.geometry, domain.scene, exceptEntityId);
	bySubject.set(exceptEntityId, built);
	return built;
}

/** The datum point one pointer position reaches past the drawn geometry. */
export function pointerFloorSupport(
	context: StageAdapterContext,
	css: readonly [number, number],
	exceptEntityId: string | null
) {
	// Stage pointer intents are local to the Stage surface; Camera rays use the
	// viewport's CSS coordinate space, whose origin includes the surface offset.
	const ray = context.ray([css[0] + context.evaluation.rect.left, css[1] + context.evaluation.rect.top]);
	if (ray === null) return { kind: 'none' as const, reason: 'degenerate' as const };
	return floorSupport(
		ray,
		context.snapshot.domain.datumMeters,
		snapshotOccluders(context, exceptEntityId)
	);
}

/** The pointer ray's datum-plane point, even when support refuses it. */
export function pointerDatumPoint(
	context: StageAdapterContext,
	css: readonly [number, number]
): Vec3 | null {
	const ray = context.ray([css[0] + context.evaluation.rect.left, css[1] + context.evaluation.rect.top]);
	if (ray === null || Math.abs(ray.direction[1]) < 1e-8) return null;
	const datum = context.snapshot.domain.datumMeters;
	const hit = context.intersect(ray, datumWorkingPlane(datum));
	if (hit.kind !== 'intersected' || !Number.isFinite(hit.distanceMeters)) return null;
	const point: Vec3 = [hit.worldPoint[0], datum, hit.worldPoint[2]];
	return point.every(Number.isFinite) ? point : null;
}

/** Apply the Stage's shared CSS-pixel click/drag boundary to a captured body press. */
export function isStagePointerDrag(
	origin: readonly [number, number],
	point: readonly [number, number]
): boolean {
	return isStageDrag({ x: origin[0], y: origin[1] }, { x: point[0], y: point[1] });
}

export function moveSupportRefusal(
	support: Exclude<ReturnType<typeof floorSupport>, { readonly kind: 'floor' }>
): SceneSessionOutcome {
	if (support.kind === 'occluded') {
		return { kind: 'refused', code: 'occluded', message: `Floor support is obscured by ${support.occluderId}.` };
	}
	return {
		kind: 'refused',
		code: 'no-floor-support',
		message: support.reason === 'degenerate'
			? 'The pointer ray is unavailable for this reading.'
			: `The pointer does not reach the Stage datum (${support.reason}).`
	};
}

/**
 * The support a pointer Place may show, or `null`.
 *
 * Resolved by the planner's own rule at the **snapped** X/Z the candidate will
 * commit at: the Room floor that covers the point, otherwise the Layout's explicit
 * datum. Preview and commit therefore cannot disagree, and `choice-required` is
 * refused here exactly as it is at commit. The drawn-geometry occluder test still
 * runs first so a Wall or plinth can never be mistaken for a place to stand.
 */
export function pointerPlaceSupport(
	context: StageAdapterContext,
	css: readonly [number, number],
	snapStep: number | null
): {
	readonly x: number;
	readonly z: number;
	readonly elevation: number;
	/** The exact support the preview stood on, qualified and pinned for commit. */
	readonly choice: SceneSupportChoice;
} | null {
	const visible = pointerFloorSupport(context, css, null);
	if (visible.kind !== 'floor') return null;
	const snapped = snapFreePlacement([visible.worldPoint[0], visible.worldPoint[2]], snapStep);
	const x = snapped.x;
	const z = snapped.z;
	const domain = context.snapshot.domain;
	const generationId = sceneSupportGenerationId(context.snapshot.sourceContentId);
	const resolved = resolveSceneSupportOnGeometry({
		geometry: domain.geometry,
		generationId,
		point: [x, z],
		requiredElevation: null
	});
	if (resolved.kind !== 'resolved') return null;
	return {
		x,
		z,
		elevation: resolved.support.elevation,
		choice: { kind: 'elevation', elevation: resolved.support.elevation, generationId }
	};
}
