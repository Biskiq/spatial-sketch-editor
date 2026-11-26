/**
 * Pointer-to-support readings for the Scene authoring gestures.
 *
 * Pure functions of one Stage adapter context: the datum point a pointer ray
 * reaches, the visible floor support it may stand on past the drawn geometry,
 * the snapped Place support the planner will commit at, and the shared CSS-pixel
 * click/drag boundary. Placement and the object-mark gestures both read these;
 * neither owns them, and they keep no gesture state (the occluder and face lists
 * are memoized per immutable accepted snapshot in a WeakMap, exactly as before).
 *
 * Support resolution itself stays with `./support-occlusion` and the Scene
 * planners (`resolveSceneSupportOnGeometry`); nothing here is new planning math.
 * The pointer's only authority is which drawn upward face is visible. The Y a
 * candidate commits at is always the Layout support query at the snapped X/Z,
 * never the ray/face intersection's own height.
 */

import { datumWorkingPlane, isStageDrag } from '$lib/authoring/stage/stage-adapter-host';
import type { StageAdapterContext } from '$lib/authoring/stage/stage-adapter-host';
import { DATUM_SUPPORT_ORDER_KEY } from '@portfolio/layout-core/room';
import type { CompiledLayoutGeometry } from '@portfolio/layout-core/geometry';
import type { Vec3 } from '@portfolio/project-model/scene';
import {
	resolveSceneSupportOnGeometry,
	sceneSupportGenerationId,
	type SceneSupportChoice,
} from '@portfolio/project-model/scene-planning';
import { snapFreePlacement, type SceneSessionOutcome } from './placement';
import {
	floorSupport,
	supportOccluders,
	upwardSupportFaces,
	type FloorSupport,
	type FloorSupportSurface,
	type SupportOccluder,
	type UpwardSupportFace,
} from './support-occlusion';

/**
 * Derived lists already built for one accepted snapshot, keyed by excluded
 * subject.
 *
 * A snapshot is immutable: its compiled geometry and resolved Scene are the
 * accepted revision's, not a working copy. Building the lists evaluates every
 * form's canonical key and allocates one occluder per drawn body, which pointer
 * movement would otherwise repeat for an unchanged Stage. The WeakMaps retire
 * the lists with the snapshot, and the excluded id is part of the occluder key
 * because a live drag changes it while the snapshot stays current.
 */
const occludersBySnapshot = new WeakMap<
	StageAdapterContext['snapshot'],
	Map<string | null, readonly SupportOccluder[]>
>();
const facesBySnapshot = new WeakMap<
	StageAdapterContext['snapshot'],
	readonly UpwardSupportFace[]
>();

function snapshotOccluders(
	context: StageAdapterContext,
	exceptEntityId: string | null,
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

function snapshotSupportFaces(context: StageAdapterContext): readonly UpwardSupportFace[] {
	const cached = facesBySnapshot.get(context.snapshot);
	if (cached !== undefined) return cached;
	const built = upwardSupportFaces(context.snapshot.domain.geometry);
	facesBySnapshot.set(context.snapshot, built);
	return built;
}

/** The datum point one pointer position reaches past the drawn geometry. */
export function pointerFloorSupport(
	context: StageAdapterContext,
	css: readonly [number, number],
	exceptEntityId: string | null,
): FloorSupport {
	// Stage pointer intents are local to the Stage surface; Camera rays use the
	// viewport's CSS coordinate space, whose origin includes the surface offset.
	const ray = context.ray([
		css[0] + context.evaluation.rect.left,
		css[1] + context.evaluation.rect.top,
	]);
	if (ray === null) return { kind: 'none', reason: 'degenerate' };
	return floorSupport(
		ray,
		context.snapshot.domain.datumMeters,
		snapshotOccluders(context, exceptEntityId),
		snapshotSupportFaces(context),
	);
}

/**
 * The pointer ray's point on one horizontal plane, even when support refuses it.
 *
 * A body gesture on a raised object belongs to that object's own base plane: a
 * datum-plane grab would sit several metres away in 3D and throw the object
 * toward the camera on the first move. The plane's own height is the returned Y,
 * so the caller reads the same point the creator sees under the cursor.
 */
export function pointerPlanePoint(
	context: StageAdapterContext,
	css: readonly [number, number],
	elevationMeters: number,
): Vec3 | null {
	if (!Number.isFinite(elevationMeters)) return null;
	const ray = context.ray([
		css[0] + context.evaluation.rect.left,
		css[1] + context.evaluation.rect.top,
	]);
	if (ray === null || Math.abs(ray.direction[1]) < 1e-8) return null;
	const hit = context.intersect(ray, datumWorkingPlane(elevationMeters));
	if (hit.kind !== 'intersected' || !Number.isFinite(hit.distanceMeters)) return null;
	const point: Vec3 = [hit.worldPoint[0], elevationMeters, hit.worldPoint[2]];
	return point.every(Number.isFinite) ? point : null;
}

/** The pointer ray's datum-plane point, even when support refuses it. */
export function pointerDatumPoint(
	context: StageAdapterContext,
	css: readonly [number, number],
): Vec3 | null {
	return pointerPlanePoint(context, css, context.snapshot.domain.datumMeters);
}

/** Apply the Stage's shared CSS-pixel click/drag boundary to a captured body press. */
export function isStagePointerDrag(
	origin: readonly [number, number],
	point: readonly [number, number],
): boolean {
	return isStageDrag({ x: origin[0], y: origin[1] }, { x: point[0], y: point[1] });
}

export function moveSupportRefusal(
	support: Exclude<ReturnType<typeof floorSupport>, { readonly kind: 'floor' }>,
): SceneSessionOutcome {
	if (support.kind === 'occluded') {
		return {
			kind: 'refused',
			code: 'occluded',
			message: `Floor support is obscured by ${support.occluderId}.`,
		};
	}
	return {
		kind: 'refused',
		code: 'no-floor-support',
		message:
			support.reason === 'degenerate'
				? 'The pointer ray is unavailable for this reading.'
				: `The pointer does not reach the Stage datum (${support.reason}).`,
	};
}

/**
 * The Place support at the pointer's snapped X/Z, or `null` when snapping moved
 * the pose off the elevation the creator actually saw.
 *
 * `hitElevation` comes from the visible ray/face intersection, but it is used
 * only as the **required elevation** of the canonical Layout query at the
 * snapped point. That query is the sole source of the returned Y and of the
 * pinned choice; the ray hit's own height never enters the candidate. If the
 * snapped point resolves no support at that elevation, the caller refuses
 * rather than silently dropping to a different surface.
 *
 * Elevation alone is not enough: two disjoint regions can share one elevation,
 * or a region can be coplanar with the Room floor. The hit's own witness
 * identity therefore has to survive the snap. The resolved candidate must still
 * name the same Room or region; a hit on the datum stays on the datum. Coplanar
 * merging still passes because the visible witness remains one of the merged
 * witnesses.
 */
export function snappedPlaceSupport(input: {
	readonly geometry: CompiledLayoutGeometry;
	readonly generationId: string;
	readonly hitElevation: number;
	readonly hitX: number;
	readonly hitZ: number;
	readonly hitSurface: FloorSupportSurface;
	readonly snapStep: number | null;
}): {
	readonly x: number;
	readonly z: number;
	readonly elevation: number;
	/** The exact support the preview stood on, qualified and pinned for commit. */
	readonly choice: SceneSupportChoice;
} | null {
	if (
		!Number.isFinite(input.hitElevation) ||
		!Number.isFinite(input.hitX) ||
		!Number.isFinite(input.hitZ)
	) {
		return null;
	}
	const snapped = snapFreePlacement([input.hitX, input.hitZ], input.snapStep);
	const resolved = resolveSceneSupportOnGeometry({
		geometry: input.geometry,
		generationId: input.generationId,
		point: [snapped.x, snapped.z],
		requiredElevation: input.hitElevation,
	});
	if (resolved.kind !== 'resolved') return null;
	if (
		!hitSurfaceSurvives(input.hitSurface, resolved.support.witnesses, resolved.support.orderKey)
	) {
		return null;
	}
	return {
		x: snapped.x,
		z: snapped.z,
		elevation: resolved.support.elevation,
		choice: {
			kind: 'elevation',
			elevation: resolved.support.elevation,
			generationId: input.generationId,
		},
	};
}

/** Whether the support the creator actually saw is still one of the witnesses. */
function hitSurfaceSurvives(
	hitSurface: FloorSupportSurface,
	witnesses: readonly {
		readonly source:
			| { readonly kind: 'room'; readonly roomId: string }
			| { readonly kind: 'region'; readonly regionId: string };
	}[],
	orderKey: string,
): boolean {
	switch (hitSurface.kind) {
		case 'room-floor':
			return witnesses.some(
				(witness) => witness.source.kind === 'room' && witness.source.roomId === hitSurface.roomId,
			);
		case 'region-top':
			return witnesses.some(
				(witness) =>
					witness.source.kind === 'region' && witness.source.regionId === hitSurface.regionId,
			);
		case 'datum':
			return witnesses.length === 0 && orderKey === DATUM_SUPPORT_ORDER_KEY;
	}
}

/**
 * The support a pointer Place may show, or `null`.
 *
 * The ray resolves the nearest **visible** upward face (Room floor or floor
 * region top) through the same occluder test the Stage draws. Its world X/Z is
 * snapped, the Layout query is repeated there, and the accepted elevation and
 * generation are pinned for commit. A Wall, scene body, slab side or underside
 * nearer than that face still refuses; a snap off a raised top refuses rather
 * than installing the floor below it.
 */
export function pointerPlaceSupport(
	context: StageAdapterContext,
	css: readonly [number, number],
	snapStep: number | null,
): {
	readonly x: number;
	readonly z: number;
	readonly elevation: number;
	readonly choice: SceneSupportChoice;
} | null {
	const visible = pointerFloorSupport(context, css, null);
	if (visible.kind !== 'floor') return null;
	return snappedPlaceSupport({
		geometry: context.snapshot.domain.geometry,
		generationId: sceneSupportGenerationId(context.snapshot.sourceContentId),
		hitElevation: visible.worldPoint[1],
		hitX: visible.worldPoint[0],
		hitZ: visible.worldPoint[2],
		hitSurface: visible.surface,
		snapStep,
	});
}
