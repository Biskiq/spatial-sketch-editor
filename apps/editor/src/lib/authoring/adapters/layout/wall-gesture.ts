/**
 * T1.P01.S05 — pointer parameters for an **existing straight Wall**.
 *
 * The module is deliberately framework-free and makes no document. Marks are
 * admitted, projected and hit-tested by the Stage's shared mark layer; what is
 * left here is the one question the adapter still needs answered: which explicit
 * parameter does this pointer position name, given the endpoint that stays fixed?
 * (`pointerWallRequest`).
 *
 * The parameter it returns is the same one a typed field produces; the canonical
 * planner is what turns it into a document, previews it and refuses what it
 * cannot preserve. No second solver and no coordinate-to-connectivity shortcut
 * lives here — a mark is a *way to name a length/angle/delta*, never a second
 * authority over the Wall.
 */

import type { FixedWallEndpoint, LayoutVec2 } from '@portfolio/layout-core';

import {
	wallAngleFromPointer,
	wallLengthFromPointer,
	type WallFrame,
	type WallManipulationRequest
} from './precision';

export type WallHandle = 'start' | 'end' | 'body';

/** The three projected handle points, in Stage-local CSS pixels. */
export type WallHandlePoints = {
	readonly start: readonly [number, number];
	readonly end: readonly [number, number];
	readonly middle: readonly [number, number];
};

export type WallPointerMode = 'length' | 'angle' | 'move' | 'junction';

/**
 * The parameter one pointer position names. `mode` is decided by the adapter from
 * the mark's descriptor: an endpoint or the free-end length ray names a length,
 * the two-way base ray names a move. The Wall angle has **no** Stage grip by the
 * owner's 2026-10-29 ruling; its pure inverse is retained here for the domain
 * planner and tests, not as a pointer affordance.
 */
export function pointerWallRequest(input: {
	readonly handle: WallHandle;
	readonly mode: WallPointerMode;
	readonly frame: WallFrame;
	readonly fixed: FixedWallEndpoint;
	readonly startPoint: readonly [number, number];
	readonly point: readonly [number, number];
}): WallManipulationRequest {
	if (input.mode === 'junction') {
		return {
			kind: 'junction',
			junctionId: input.handle === 'start' ? input.frame.startJunctionId : input.frame.endJunctionId,
			point: [input.point[0], input.point[1]]
		};
	}
	if (input.handle === 'body' || input.mode === 'move') {
		// O2 — a Wall body slides along its own normal. The pointer names a signed
		// distance on that normal; the off-normal part is deliberately discarded,
		// so no small sideways wobble skews both neighbours.
		const normal: LayoutVec2 = [-input.frame.direction[1], input.frame.direction[0]];
		const distance =
			(input.point[0] - input.startPoint[0]) * normal[0] +
			(input.point[1] - input.startPoint[1]) * normal[1];
		return { kind: 'move', delta: [normal[0] * distance, normal[1] * distance] };
	}
	const fixedPoint = input.fixed === 'start' ? input.frame.start : input.frame.end;
	if (input.mode === 'angle') {
		return { kind: 'angle', angleRadians: wallAngleFromPointer(fixedPoint, input.point, input.fixed) };
	}
	return { kind: 'length', length: wallLengthFromPointer(input.frame, input.fixed, input.point) };
}

/** The Wall's canonical 0–360° angle, with a whole degree written without `.0`. */
export function wallAngleWords(frame: WallFrame): string {
	const degrees = (((frame.angleRadians * 180) / Math.PI) % 360 + 360) % 360;
	return `${degrees.toFixed(1).replace(/\.0$/, '')}°`;
}

/**
 * The value tag at a Wall gesture.
 *
 * A point names the candidate's length and angle, plus how many Walls share the
 * Junction it moves; body and length read as the one fact they edit. This is the
 * target specification's tag row, not a debug dump: the planner's raw message
 * never appears here.
 */
export function wallRequestLabel(
	request: WallManipulationRequest,
	fixed: FixedWallEndpoint,
	context?: { readonly frame?: WallFrame; readonly incidentWalls?: number }
): string {
	if (request.kind === 'junction') {
		const frame = context?.frame;
		if (frame === undefined) return `X ${request.point[0].toFixed(2)} · Z ${request.point[1].toFixed(2)} m`;
		const shared = context?.incidentWalls ?? 1;
		return `Length ${frame.length.toFixed(2)} m · ${wallAngleWords(frame)}${shared > 1 ? ` · ${shared} Walls` : ''}`;
	}
	if (request.kind === 'length') return `Length ${request.length.toFixed(2)} m`;
	if (request.kind === 'angle') {
		return `Angle ${((request.angleRadians * 180) / Math.PI).toFixed(1)}° · fixed ${fixed}`;
	}
	return `Move ${Math.hypot(request.delta[0], request.delta[1]).toFixed(2)} m`;
}

/**
 * A paused proposal's label, at full precision.
 *
 * Resume uses the captured request, never this text, but the displayed value
 * still must not round away a number the creator is about to apply.
 */
export function wallRequestExactLabel(
	request: WallManipulationRequest,
	fixed: FixedWallEndpoint
): string {
	if (request.kind === 'length') {
		return `${request.length} m · fixed ${fixed}`;
	}
	if (request.kind === 'angle') {
		return `${(request.angleRadians * 180) / Math.PI}° · fixed ${fixed}`;
	}
	if (request.kind === 'junction') {
		return `X ${request.point[0]} · Z ${request.point[1]} m`;
	}
	return `ΔX ${request.delta[0]} · ΔZ ${request.delta[1]} m`;
}
