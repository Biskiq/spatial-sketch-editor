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

import type { FixedWallEndpoint } from '@portfolio/layout-core';

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

export type WallPointerMode = 'length' | 'angle' | 'move';

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
