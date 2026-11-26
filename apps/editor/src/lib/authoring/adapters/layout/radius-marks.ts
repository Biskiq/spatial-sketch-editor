/**
 * The two radius grips the Stage publishes.
 *
 * Both draw one ray from an authored centre to an authored seam and both submit
 * a Room-owned radius planner, but they address different subjects:
 *
 * | Subject | Mark | Planner |
 * | --- | --- | --- |
 * | One isolated closed Wall | `layout-circle-radius-mark` | `layout-circle-radius` |
 * | The Round Room, connected or isolated | `layout-round-room-radius-mark` | `layout-round-room-radius` |
 *
 * They share this module because the ray, the knob and the refusal wording are
 * one vocabulary; the subject and the planner stay explicit at each call site.
 */
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-adapter-host';

import { LAYOUT_CIRCLE_RADIUS_KIND } from './drawing-planners';
import { LAYOUT_ROUND_ROOM_RADIUS_KIND } from './round-room-planners';

/**
 * The whole is the Round Room: a ray from the authored centre to the authored
 * seam, dispatching the same Room-owned planner the Card field submits.
 */
export function roundRoomRadiusMark(
	room: { readonly center: LayoutVec2; readonly radius: number; readonly seam: LayoutVec2 },
	y: number,
	refusal: string | null,
): StageHandleDescriptor {
	return {
		id: 'layout-round-room-radius-mark',
		kind: 'ray',
		role: 'edit',
		anchor: [room.center[0], y, room.center[1]],
		axis: [room.seam[0] - room.center[0], 0, room.seam[1] - room.center[1]],
		extent: room.radius,
		label: 'Radius',
		fact: 'radius',
		verb: 'Resize',
		planner: LAYOUT_ROUND_ROOM_RADIUS_KIND,
		value: `${room.radius.toFixed(2)} m`,
		refusal,
	};
}

/**
 * A closed Wall's only shape grip: a radius ray from the centre to the authored
 * seam, never a pair of end points (a closed Wall has no ends to move). The size
 * chip sits away from the seam and discloses the retained height/thickness
 * writers; it never replaces the radius semantics.
 */
export function closedWallRadiusMarks(
	closed: { readonly center: LayoutVec2; readonly seam: LayoutVec2; readonly radius: number },
	y: number,
	planReading: boolean,
	refusal: string | null,
): StageHandleDescriptor[] {
	const seamX = closed.seam[0] - closed.center[0];
	const seamZ = closed.seam[1] - closed.center[1];
	const chipAngle = Math.atan2(seamZ, seamX) + Math.PI * 2 * 0.82;
	const chipPoint: LayoutVec2 = [
		closed.center[0] + Math.cos(chipAngle) * closed.radius,
		closed.center[1] + Math.sin(chipAngle) * closed.radius,
	];
	return [
		{
			id: 'layout-wall-size-chip',
			kind: 'point',
			role: 'disclose',
			anchor: [chipPoint[0], y, chipPoint[1]],
			screen: { offset: [0, -22] },
			label: 'Size',
			reveals: ['layout-wall-thickness', ...(planReading ? [] : ['layout-wall-height'])],
		},
		{
			id: 'layout-circle-radius-mark',
			kind: 'ray',
			role: 'edit',
			anchor: [closed.center[0], y, closed.center[1]],
			axis: [seamX, 0, seamZ],
			extent: closed.radius,
			label: 'Radius',
			fact: 'radius',
			verb: 'Resize',
			planner: LAYOUT_CIRCLE_RADIUS_KIND,
			value: `${closed.radius.toFixed(2)} m`,
			refusal,
		},
	];
}
