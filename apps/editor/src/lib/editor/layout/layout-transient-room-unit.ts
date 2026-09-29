/**
 * Pre-P23B.8 follow-up (whole-Room drag slice) — the transient lifecycle of a
 * whole-Room unit drag, split out of the viewport for the same reason
 * `layout-transient-edit.ts` exists: so no Svelte surface can quietly re-enter
 * canonical acceptance per pointermove.
 *
 * The contract is the one that module states for a direct architecture gesture,
 * applied to a Room unit:
 *
 * ```
 * pointerdown   → capture the immutable baseline + one transaction, and resolve
 *                 the moving set ONCE through the planner's own isolation policy
 *                                                                    [viewport]
 * pointermove   → derive a PROPOSAL from baseline + current delta, render it
 *                 transiently: install nothing, compile nothing, write no
 *                 history                                              [here]
 * pointerup     → ONE canonical planner call at the release coordinate against
 *                 the frozen baseline, then either one history entry or an exact
 *                 baseline                                               [viewport]
 * Escape/cancel → discard the proposal; the canonical baseline stays exact
 * ```
 *
 * Why this replaced a per-pointermove planner call: the shipped room drag ran
 * `previewWallFirstRoomMove` on every move — a whole-document re-derive, compile
 * and mesh preparation — for a delta that changes a handful of the document's
 * Walls, six times per accepted action. The release has always re-derived from
 * the release point against the frozen baseline, so every one of those installs
 * was preview-only and discarded. Removing them cannot change what commits.
 *
 * Nothing here is an acceptance authority: this module never validates, accepts,
 * compiles, installs, prepares meshes or writes history. It returns overlay
 * geometry only, and the release planner still decides everything.
 */
import {
	proposeWallFirstRoomUnitGeometry,
	proposeWallFirstRoomUnitRotation,
	rotatePointAbout,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type RoomUnitMoveProposalWall,
	type RoomUnitMoveSubgraph
} from '@portfolio/layout-core';

import { p2311Measure } from '$lib/layout/layout-wall-first-precision';

/** The render-only attempt one pointermove of a Room-unit drag is asking for. */
export type LayoutTransientRoomUnitMove = {
	/** The moving set's Wall centerlines, sampled through the one canonical adapter. */
	walls: readonly RoomUnitMoveProposalWall[];
	/** The moving unit's Room floor outlines, rigidly translated by the same delta. */
	rooms: readonly { roomId: string; points: LayoutVec2[] }[];
};

/**
 * Derive the transient attempt for the gesture's **current** delta.
 *
 * Returns `null` when there is nothing to draw:
 *
 * - no canonical wall-first baseline (a direct Room-unit preview can only be
 *   derived from one — a type narrowing, not a policy);
 * - no resolved moving set (the legacy Room-unit path has none; that path keeps
 *   its own per-move installer because its release commits the last preview
 *   rather than re-deriving, so a ghost there would change what commits);
 * - a zero delta, i.e. a press that has not moved yet (the drag threshold's
 *   equivalent: a press over a Room must not flash a candidate).
 *
 * `undefined` sampling results are skipped exactly as the architecture proposal
 * skips them, so an underivable Wall simply does not appear; an empty attempt is
 * a truthful "nothing to draw", never a rejection.
 */
export function transientRoomUnitMove(input: {
	/** The frozen pointer-down baseline document — never the live preview. */
	baseline: LayoutDocumentWallFirst | null;
	/** The moving set frozen at pointer-down (the planner's own resolution). */
	unit: RoomUnitMoveSubgraph | null;
	/** The gesture's total delta against the baseline, never an accumulated step. */
	delta: LayoutVec2;
	/** The frozen compiled geometry of that baseline, for the Room outlines. */
	geometry: CompiledLayoutGeometry | null;
	/** The moving unit's Rooms, in canonical order. */
	roomIds: readonly string[];
}): LayoutTransientRoomUnitMove | null {
	const { baseline, unit, delta, geometry, roomIds } = input;
	if (!baseline || !unit) return null;
	const [dx, dz] = delta;
	if (!Number.isFinite(dx) || !Number.isFinite(dz)) return null;
	if (dx === 0 && dz === 0) return null;

	const walls = p2311Measure('room-unit-proposal', () =>
		proposeWallFirstRoomUnitGeometry(baseline, unit, delta)
	);
	const rooms = roomIds.flatMap((roomId) => {
		const room = geometry?.rooms.find((entry) => entry.roomId === roomId);
		if (!room || room.floorPolygon.length === 0) return [];
		return [
			{
				roomId,
				points: room.floorPolygon.map(
					(point) => [point[0] + dx, point[1] + dz] as LayoutVec2
				)
			}
		];
	});
	if (walls.length === 0 && rooms.length === 0) return null;
	return { walls, rooms };
}

/**
 * The **rotation** partner of `transientRoomUnitMove`: the same attempt shape for
 * a gesture that rigidly rotates the frozen unit about `pivot`.
 *
 * The unit is drawn through `proposeWallFirstRoomUnitRotation` — the release
 * planner's own rotation candidate, sampled by the one canonical sampler — and
 * each member Room's outline is rotated about the SAME pivot, so the outline and
 * the Wall ink describe one rigid motion. The same `null` cases apply (no
 * baseline, no frozen unit, a non-finite or zero angle, nothing drawable), and
 * `undefined` sampling results are skipped exactly as everywhere else.
 *
 * NOTE ON FIDELITY, stated rather than hidden: a rotated Wall's canonical sample
 * COUNT is not invariant under rotation, so this attempt is the release
 * planner's own geometry but is NOT guaranteed to be sample-count parity-
 * equivalent to a resample of the rotated curve. The release re-derives, so what
 * commits is the planner's candidate either way; only the drawn attempt's
 * density can differ by a sample on a curved Wall.
 */
export function transientRoomUnitRotation(input: {
	baseline: LayoutDocumentWallFirst | null;
	unit: RoomUnitMoveSubgraph | null;
	/** The gesture's pivot, frozen at pointer-down. */
	pivot: LayoutVec2;
	/** The gesture's total angle against the baseline, never an accumulated step. */
	yaw: number;
	geometry: CompiledLayoutGeometry | null;
	roomIds: readonly string[];
}): LayoutTransientRoomUnitMove | null {
	const { baseline, unit, pivot, yaw, geometry, roomIds } = input;
	if (!baseline || !unit) return null;
	if (!Number.isFinite(pivot[0]) || !Number.isFinite(pivot[1]) || !Number.isFinite(yaw)) return null;
	if (yaw === 0) return null;

	const walls = p2311Measure('room-unit-rotation', () =>
		proposeWallFirstRoomUnitRotation(baseline, unit, pivot, yaw)
	);
	const rooms = roomIds.flatMap((roomId) => {
		const room = geometry?.rooms.find((entry) => entry.roomId === roomId);
		if (!room || room.floorPolygon.length === 0) return [];
		return [
			{
				roomId,
				// Drawn through core's `rotatePointAbout`: one gesture turns an
				// outline and its Wall ink the same way, by one definition.
				points: room.floorPolygon.map((point) => rotatePointAbout(point, pivot, yaw))
			}
		];
	});
	if (walls.length === 0 && rooms.length === 0) return null;
	return { walls, rooms };
}
