/**
 * R217.S10 — **Measure**, a host tool.
 *
 * Measure names two points and reads the distance between them. Each endpoint is
 * the winner of host tool `measure` across every domain that declares it — a Wall
 * end or Junction from Layout, a bounds corner from Scene — arbitrated spatially by
 * the one Stage resolver, so a single measurement may run from a Wall to an object.
 * With no domain winner the endpoint is the datum point under the pointer, rounded
 * by the shared Snap fact (S05).
 *
 * Measure writes nothing. It registers no proposal and its press is declared a
 * non-authoring lease, so Undo stays available throughout; the measurement is
 * session view state that lives until the next measurement, Escape or disarm, and
 * never reaches source, history, dirty state or Save.
 */
import type { Vec3 } from '@portfolio/camera-core';
import { formatMeters, snapDraftingPoint } from './stage-drafting';
import type { StageFacade } from './stage-facade';
import type { GestureAcquisition } from './stage-session';
import { isStageDrag } from './stage-input';

/** The host task kind an armed Measure opens; it owns no adapter instrument. */
export const STAGE_MEASURE_TASK = 'host-measure';

/** One resolved endpoint, with the domain subject it came from (or none: the datum). */
export type StageMeasureEndpoint = {
	readonly point: Vec3;
	readonly source: { readonly adapterId: string; readonly sourceId: string; readonly sourceKind: string } | null;
};

export type StageMeasurement = {
	readonly from: StageMeasureEndpoint;
	readonly to: StageMeasureEndpoint;
	readonly meters: number;
	/** The mono tag the dimension line carries, e.g. `3.42 m`. */
	readonly label: string;
};

/** What the Stage draws: a settled measurement, or the live one from the first point. */
export type StageMeasureView = StageMeasurement & { readonly live: boolean };

export function measureBetween(from: StageMeasureEndpoint, to: StageMeasureEndpoint): StageMeasurement {
	const meters = Math.hypot(to.point[0] - from.point[0], to.point[1] - from.point[1], to.point[2] - from.point[2]);
	return { from, to, meters, label: meters > 0 ? formatMeters(meters) : '0 m' };
}

/**
 * The endpoint at one Stage-local point: the host-tool winner's measurable point,
 * else the snapped datum point. `null` when the pointer names no place at all.
 */
export function resolveMeasureEndpoint(
	facade: StageFacade,
	query: { readonly css: readonly [number, number]; readonly evaluationId: string; readonly coarse?: boolean }
): StageMeasureEndpoint | null {
	const target = facade.hostToolTarget({ ...query, tool: 'measure' });
	if (target.kind === 'failed') return null;
	if (target.kind === 'hit' && target.refusal === null) {
		return {
			point: [target.hit.worldPoint[0], target.hit.worldPoint[1], target.hit.worldPoint[2]],
			source: { adapterId: target.adapterId, sourceId: target.hit.sourceId, sourceKind: target.hit.sourceKind }
		};
	}
	const datum = target.datumPoint;
	if (datum === null) return null;
	const drafting = facade.drafting();
	const snapped = snapDraftingPoint([datum[0], datum[2]], drafting);
	return { point: [snapped[0], datum[1], snapped[1]], source: null };
}

export type StageMeasureController = {
	/** Begin a press. `false` when the press names no place or another gesture owns the pointer. */
	down(input: { readonly css: readonly [number, number]; readonly evaluationId: string; readonly coarse?: boolean }): boolean;
	move(input: { readonly css: readonly [number, number]; readonly evaluationId: string; readonly coarse?: boolean }): void;
	up(input: { readonly css: readonly [number, number]; readonly evaluationId: string; readonly coarse?: boolean }): void;
	/** An interrupted press leaves no half measurement it started. */
	cancel(): void;
	/** An unpressed move after the first click previews the second point. */
	hover(input: { readonly css: readonly [number, number]; readonly evaluationId: string; readonly coarse?: boolean } | null): void;
	/** Escape and disarm: `true` when there was something to clear. */
	clear(): boolean;
	view(): StageMeasureView | null;
	/** Whether a press is live (the route routes later phases here). */
	pressing(): boolean;
};

export function createStageMeasure(facade: StageFacade): StageMeasureController {
	let anchor: StageMeasureEndpoint | null = null;
	let hovered: StageMeasureEndpoint | null = null;
	let result: StageMeasurement | null = null;
	let press: {
		readonly origin: readonly [number, number];
		readonly lease: GestureAcquisition;
		/** This press set the anchor (a fresh measurement), rather than closing one. */
		readonly opened: boolean;
	} | null = null;

	function endPress(): void {
		const ending = press;
		press = null;
		if (ending?.lease.kind === 'granted' && ending.lease.lease.active) ending.lease.lease.release();
	}

	return {
		down(input) {
			const endpoint = resolveMeasureEndpoint(facade, input);
			if (endpoint === null) return false;
			// Measuring is not authored work: the lease only keeps one pointer owner and
			// is declared non-authoring, so it never blocks Undo.
			const lease = facade.acquireGesture({
				owner: STAGE_MEASURE_TASK,
				evaluationId: input.evaluationId,
				policy: 'cancel-on-reading-change',
				navigation: true
			});
			if (lease.kind !== 'granted') return false;
			const opened = anchor === null;
			if (opened) {
				// The next measurement replaces the last one.
				result = null;
				anchor = endpoint;
			}
			hovered = endpoint;
			press = { origin: input.css, lease, opened };
			return true;
		},
		move(input) {
			if (press === null) return;
			const endpoint = resolveMeasureEndpoint(facade, input);
			if (endpoint !== null) hovered = endpoint;
		},
		up(input) {
			const current = press;
			if (current === null) return;
			const release = resolveMeasureEndpoint(facade, input) ?? hovered;
			const dragged = isStageDrag(
				{ x: current.origin[0], y: current.origin[1] },
				{ x: input.css[0], y: input.css[1] }
			);
			endPress();
			if (anchor === null || release === null) return;
			// A tap that opened the measurement waits for the second point; a drag, or the
			// second tap, settles it.
			if (current.opened && !dragged) {
				hovered = null;
				return;
			}
			result = measureBetween(anchor, release);
			anchor = null;
			hovered = null;
		},
		cancel() {
			const current = press;
			endPress();
			if (current?.opened === true) anchor = null;
			hovered = null;
		},
		hover(input) {
			if (press !== null) return;
			hovered = input === null || anchor === null ? null : resolveMeasureEndpoint(facade, input);
		},
		clear() {
			const had = anchor !== null || result !== null || press !== null;
			endPress();
			anchor = null;
			hovered = null;
			result = null;
			return had;
		},
		view() {
			if (anchor !== null && hovered !== null) return { ...measureBetween(anchor, hovered), live: true };
			return result === null ? null : { ...result, live: false };
		},
		pressing() {
			return press !== null;
		}
	};
}
