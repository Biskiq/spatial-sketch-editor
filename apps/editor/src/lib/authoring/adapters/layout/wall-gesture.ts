/**
 * T1.P01.S05 — pointer handles for an **existing straight Wall**.
 *
 * The module is deliberately framework-free and makes no document: it answers
 * three questions the adapter needs and nothing more.
 *
 * 1. Where are the two endpoint handles and the body handle, in the CSS pixels
 *    the Stage's one live evaluation projects them to? (`projectWallHandles`)
 * 2. Which handle did the press actually land on, with an endpoint winning a tie
 *    against the body? (`pickWallHandle`)
 * 3. Which explicit parameter does this pointer position name, given the
 *    endpoint that stays fixed? (`pointerWallRequest`)
 *
 * The parameter it returns is the same one a typed field produces; the canonical
 * planner is what turns it into a document, previews it and refuses what it
 * cannot preserve. No second solver and no coordinate-to-connectivity shortcut
 * lives here — a handle is a *way to name a length/angle/delta*, never a second
 * authority over the Wall.
 */

import type { FixedWallEndpoint } from '@portfolio/layout-core';

import {
	wallAngleFromPointer,
	wallLengthFromPointer,
	type WallFrame,
	type WallManipulationRequest
} from './precision';

/** How near a press must be to an endpoint, in CSS pixels. */
export const WALL_ENDPOINT_HANDLE_CSS_PX = 12;
/** How near a press must be to the Wall body, in CSS pixels. */
export const WALL_BODY_HANDLE_CSS_PX = 8;

export type WallHandle = 'start' | 'end' | 'body';

/** The three projected handle points, in Stage-local CSS pixels. */
export type WallHandlePoints = {
	readonly start: readonly [number, number];
	readonly end: readonly [number, number];
	readonly middle: readonly [number, number];
};

/** The squared distance from a CSS point to a CSS segment. */
function squaredDistanceToSegment(
	point: readonly [number, number],
	start: readonly [number, number],
	end: readonly [number, number]
): number {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const squared = dx * dx + dy * dy;
	if (squared === 0) return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
	const raw = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / squared;
	const amount = Math.min(1, Math.max(0, raw));
	const nearestX = start[0] + dx * amount;
	const nearestY = start[1] + dy * amount;
	return (point[0] - nearestX) ** 2 + (point[1] - nearestY) ** 2;
}

export function distanceToWallSegmentCss(
	point: readonly [number, number],
	start: readonly [number, number],
	end: readonly [number, number]
): number {
	return Math.sqrt(squaredDistanceToSegment(point, start, end));
}

/**
 * The handle under a press, or `null` when the press is not on this Wall's
 * helpers. Endpoints are tested first and their tolerance is larger: a press
 * that could mean both must mean the precise handle, never the body drag that
 * would translate the whole Wall.
 */
export function pickWallHandle(
	css: readonly [number, number],
	points: WallHandlePoints
): WallHandle | null {
	const startDistance = Math.hypot(css[0] - points.start[0], css[1] - points.start[1]);
	const endDistance = Math.hypot(css[0] - points.end[0], css[1] - points.end[1]);
	const nearestEndpoint = startDistance <= endDistance ? ('start' as const) : ('end' as const);
	const endpointDistance = Math.min(startDistance, endDistance);
	if (endpointDistance <= WALL_ENDPOINT_HANDLE_CSS_PX) return nearestEndpoint;
	if (distanceToWallSegmentCss(css, points.start, points.end) <= WALL_BODY_HANDLE_CSS_PX) return 'body';
	return null;
}

/**
 * Dragging an endpoint keeps the **other** endpoint fixed. A body drag names no
 * endpoint at all (both move), so `start` is only the neutral vocabulary value.
 */
export function wallHandleFixedEndpoint(handle: WallHandle): FixedWallEndpoint {
	return handle === 'start' ? 'end' : 'start';
}

export type WallPointerMode = 'length' | 'angle' | 'move';

/**
 * The parameter one pointer position names. `mode` is decided by the adapter from
 * the handle and the modifier state (a shift-drag on an endpoint is the angle) so
 * the same handle cannot quietly mean two operations.
 */
export function pointerWallRequest(input: {
	readonly handle: WallHandle;
	readonly mode: WallPointerMode;
	readonly frame: WallFrame;
	readonly fixed: FixedWallEndpoint;
	readonly startPoint: readonly [number, number];
	readonly point: readonly [number, number];
}): WallManipulationRequest {
	if (input.handle === 'body' || input.mode === 'move') {
		return {
			kind: 'move',
			delta: [input.point[0] - input.startPoint[0], input.point[1] - input.startPoint[1]]
		};
	}
	const fixedPoint = input.fixed === 'start' ? input.frame.start : input.frame.end;
	if (input.mode === 'angle') {
		return { kind: 'angle', angleRadians: wallAngleFromPointer(fixedPoint, input.point, input.fixed) };
	}
	return { kind: 'length', length: wallLengthFromPointer(input.frame, input.fixed, input.point) };
}

/** A short deterministic description of a request, used only by the overlay label. */
export function wallRequestLabel(
	request: WallManipulationRequest,
	fixed: FixedWallEndpoint
): string {
	if (request.kind === 'length') {
		return `Length ${request.length.toFixed(3)} m · fixed ${fixed}`;
	}
	if (request.kind === 'angle') {
		return `Angle ${((request.angleRadians * 180) / Math.PI).toFixed(1)}° · fixed ${fixed}`;
	}
	return `Move ΔX ${request.delta[0].toFixed(3)} · ΔZ ${request.delta[1].toFixed(3)} m`;
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
	return `ΔX ${request.delta[0]} · ΔZ ${request.delta[1]} m`;
}
