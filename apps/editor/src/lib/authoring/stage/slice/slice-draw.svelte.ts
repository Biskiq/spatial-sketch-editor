/**
 * The drawn Slice gesture.
 *
 * A finite segment on the ground plane, resolved through the same host-tool datum
 * and `snapDraftingPoint` the Wall gesture uses, with a soft 45° snap. The press
 * either draws a new cut or grabs one of the existing handles:
 *
 * - an endpoint grip resizes that end,
 * - the centre grip moves the whole line,
 * - the depth grip moves the finite depth along the visible normal.
 *
 * The controller owns only the interaction. The reading itself lives in
 * `slice-reading.svelte.ts`, so Put back, Escape, project replacement and lens
 * changes stay the store's single writers. A press acquires a non-authoring lease,
 * exactly as Measure does: editing the cut is never history and never blocks Undo.
 */
import type { Vec3 } from '@portfolio/camera-core/camera';
import { formatMeters } from '../stage-drafting';
import type { StageFacade } from '../stage-facade';
import { resolveMeasureEndpoint } from '../stage-measure';
import type { GestureAcquisition } from '../stage-session';
import {
	clampDrawnDepth,
	drawnFarSideDistance,
	drawnHiddenSide,
	resolveSlice,
	snapDrawnAngle,
	SLICE_MIN_DRAWN_LENGTH_METERS,
	type DrawnResolvedSlice,
	type SliceReading,
	type SliceVec2,
	type SliceVec3
} from './slice-cut';
import { sliceReading } from './slice-reading.svelte';

export type SliceDrawInput = {
	readonly css: readonly [number, number];
	readonly evaluationId: string;
	readonly coarse?: boolean;
};

type Handle = 'start' | 'end' | 'line' | 'depth';
type Mode = 'idle' | 'drawing' | Handle;

type Draft = { readonly start: SliceVec3; readonly end: SliceVec3; readonly label: string };

export type SliceDrawView = {
	readonly armed: boolean;
	readonly mode: Mode;
	readonly draft: Draft | null;
	/** The reading's endpoints in Stage-local CSS, for the overlay's length tag. */
	readonly handles: {
		readonly start: readonly [number, number];
		readonly end: readonly [number, number];
		readonly depth: readonly [number, number];
	} | null;
};

export type SliceDrawController = {
	arm(): void;
	disarm(): void;
	down(input: SliceDrawInput): boolean;
	move(input: SliceDrawInput): void;
	up(input: SliceDrawInput): void;
	cancel(): void;
	/** Escape's first rung: a live draft or edit, without ending the reading. */
	cancelDraft(): boolean;
	hasDraft(): boolean;
	flip(): void;
	setDepth(meters: number): void;
	view(): SliceDrawView;
	readonly armed: boolean;
};

const HANDLE_HIT_CSS = 14;
const HANDLE_HIT_COARSE_CSS = 22;
const DEPTH_AXIS_METERS = 1;

function distanceCss(a: readonly [number, number], b: readonly [number, number]): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function distanceToSegmentCss(
	point: readonly [number, number],
	a: readonly [number, number],
	b: readonly [number, number]
): number {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared <= 1e-9) return distanceCss(point, a);
	const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
	return distanceCss(point, [a[0] + dx * t, a[1] + dy * t]);
}

function planar(point: readonly [number, number, number]): SliceVec2 {
	return [point[0], point[2]];
}

export function createSliceDraw(input: {
	readonly facade: () => StageFacade | null;
	readonly evaluationId: () => string | null;
	readonly renderedReading: () => 'plan' | '3d' | null;
	readonly eye: () => Vec3 | null;
	readonly bounds: () => { readonly min: SliceVec3; readonly max: SliceVec3 } | null;
	readonly datumMeters: () => number;
	readonly notice: (message: string) => void;
}): SliceDrawController {
	let armed = $state(false);
	let mode = $state<Mode>('idle');
	let draft = $state<Draft | null>(null);
	let handleCss = $state<SliceDrawView['handles']>(null);

	let press: GestureAcquisition | null = null;
	let before: SliceReading | null = null;
	let pressOriginCss: readonly [number, number] = [0, 0];
	let lineOrigin: { readonly start: SliceVec2; readonly end: SliceVec2 } | null = null;
	let depthStartMeters = 0;
	let depthPressPixels = 0;
	let depthAxis: { readonly origin: readonly [number, number]; readonly unit: readonly [number, number]; readonly pixelsPerMeter: number } | null = null;

	function release(): void {
		const lease = press;
		press = null;
		if (lease?.kind === 'granted' && lease.lease.active) lease.lease.release();
	}

	function acquire(evaluationId: string): boolean {
		const facade = input.facade();
		if (facade === null) return false;
		const lease = facade.acquireGesture({
			owner: 'host-slice-drawn',
			evaluationId,
			policy: 'cancel-on-reading-change',
			navigation: true
		});
		if (lease.kind !== 'granted') return false;
		press = lease;
		return true;
	}

	function currentReading(): SliceReading | null {
		return sliceReading.reading;
	}

	function resolvedDrawn(reading: SliceReading | null): DrawnResolvedSlice | null {
		if (reading === null || reading.kind !== 'drawn') return null;
		const resolved = resolveSlice(reading, {
			sheetHeight: 0,
			datumMeters: input.datumMeters()
		});
		return resolved.kind === 'drawn' ? resolved : null;
	}

	function farSideOf(resolved: DrawnResolvedSlice | null): number {
		return resolved === null ? 0.1 : drawnFarSideDistance(resolved, input.bounds());
	}

	function pointOf(inputValue: SliceDrawInput): SliceVec3 | null {
		const facade = input.facade();
		if (facade === null) return null;
		const endpoint = resolveMeasureEndpoint(facade, inputValue);
		return endpoint === null ? null : endpoint.point;
	}

	function cssOf(point: SliceVec3): readonly [number, number] | null {
		const facade = input.facade();
		const id = input.evaluationId();
		if (facade === null || id === null) return null;
		const projected = facade.projectWorld(point, id);
		if (projected.kind !== 'projected') return null;
		const rect = facade.evaluation()?.rect;
		return rect === undefined
			? projected.css
			: [projected.css[0] - rect.left, projected.css[1] - rect.top];
	}

	function depthHandlePoint(resolved: DrawnResolvedSlice): SliceVec3 {
		return [
			resolved.origin[0] - resolved.hiddenNormal[0] * resolved.depthMeters,
			resolved.origin[1],
			resolved.origin[2] - resolved.hiddenNormal[2] * resolved.depthMeters
		];
	}

	function refreshHandles(): void {
		const resolved = resolvedDrawn(currentReading());
		if (resolved === null) {
			handleCss = null;
			return;
		}
		const start = cssOf(resolved.start);
		const end = cssOf(resolved.end);
		const depth = cssOf(depthHandlePoint(resolved));
		handleCss = start === null || end === null || depth === null ? null : { start, end, depth };
	}

	function handleAt(css: readonly [number, number], coarse: boolean | undefined): Handle | null {
		const resolved = resolvedDrawn(currentReading());
		if (resolved === null) return null;
		const tolerance = coarse === true ? HANDLE_HIT_COARSE_CSS : HANDLE_HIT_CSS;
		const start = cssOf(resolved.start);
		const end = cssOf(resolved.end);
		const depth = cssOf(depthHandlePoint(resolved));
		if (start !== null && distanceCss(css, start) <= tolerance) return 'start';
		if (end !== null && distanceCss(css, end) <= tolerance) return 'end';
		// The line outranks the depth grip: at the minimum depth the grip sits almost
		// on the centre, and a creator pressing there means the line. The depth ray
		// becomes grabbable as soon as it is far enough from the line to be its own mark.
		if (start !== null && end !== null && distanceToSegmentCss(css, start, end) <= tolerance) return 'line';
		if (depth !== null && distanceCss(css, depth) <= tolerance) return 'depth';
		return null;
	}

	function commit(_inputValue: SliceDrawInput): void {
		const start = draft === null ? null : planar(draft.start);
		const end = draft === null ? null : planar(draft.end);
		if (start === null || end === null) return;
		const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
		if (length < SLICE_MIN_DRAWN_LENGTH_METERS) {
			input.notice('Draw a longer line for the cut.');
			return;
		}
		const hidden = drawnHiddenSide({
			start,
			end,
			eye: input.eye(),
			datumMeters: input.datumMeters(),
			reading: input.renderedReading()
		});
		const provisional = resolveSlice(
			{ kind: 'drawn', start, end, hidden, depthMeters: 0.1 },
			{ sheetHeight: 0, datumMeters: input.datumMeters() }
		);
		const depthMeters = provisional.kind === 'drawn' ? farSideOf(provisional) : 0.1;
		sliceReading.drawn({ start, end, hidden, depthMeters });
		input.notice('');
	}

	return {
		get armed() {
			return armed;
		},
		arm() {
			armed = true;
			mode = 'idle';
			draft = null;
			refreshHandles();
		},
		disarm() {
			this.cancel();
			armed = false;
			mode = 'idle';
			draft = null;
			refreshHandles();
		},
		down(inputValue) {
			if (!armed) return false;
			const id = input.evaluationId();
			const point = pointOf(inputValue);
			if (id === null || point === null) return false;
			if (!acquire(id)) return false;
			before = currentReading();
			pressOriginCss = inputValue.css;
			const hit = handleAt(inputValue.css, inputValue.coarse);
			if (hit !== null) {
				const reading = currentReading();
				if (reading?.kind !== 'drawn') {
					release();
					return false;
				}
				if (hit === 'line') {
					lineOrigin = { start: reading.start, end: reading.end };
					mode = 'line';
					return true;
				}
				if (hit === 'depth') {
					const resolved = resolvedDrawn(reading);
					if (resolved === null) {
						release();
						return false;
					}
					const origin = cssOf(resolved.origin);
					const tip = cssOf([
						resolved.origin[0] - resolved.hiddenNormal[0] * DEPTH_AXIS_METERS,
						resolved.origin[1],
						resolved.origin[2] - resolved.hiddenNormal[2] * DEPTH_AXIS_METERS
					]);
					if (origin === null || tip === null) {
						release();
						return false;
					}
					const dx = tip[0] - origin[0];
					const dy = tip[1] - origin[1];
					const pixels = Math.hypot(dx, dy);
					if (pixels <= 1) {
						release();
						return false;
					}
					const unit: [number, number] = [dx / pixels, dy / pixels];
					depthAxis = { origin, unit, pixelsPerMeter: pixels };
					depthStartMeters = reading.depthMeters;
					depthPressPixels =
						(inputValue.css[0] - origin[0]) * unit[0] +
						(inputValue.css[1] - origin[1]) * unit[1];
					mode = 'depth';
					return true;
				}
				mode = hit;
				return true;
			}
			draft = { start: point, end: point, label: '0 m' };
			mode = 'drawing';
			return true;
		},
		move(inputValue) {
			if (mode === 'idle') return;
			if (mode === 'depth') {
				const reading = currentReading();
				const resolved = resolvedDrawn(reading);
				if (reading?.kind !== 'drawn' || resolved === null || depthAxis === null) return;
				const dx = inputValue.css[0] - depthAxis.origin[0];
				const dy = inputValue.css[1] - depthAxis.origin[1];
				const pixels = dx * depthAxis.unit[0] + dy * depthAxis.unit[1];
				const meters = clampDrawnDepth(
					// The axis points from the cut toward the shown side, so moving the
					// pointer out along it deepens the slab. Only the delta from the press
					// counts: the grip can be grabbed anywhere inside its hit radius.
					depthStartMeters + (pixels - depthPressPixels) / depthAxis.pixelsPerMeter,
					farSideOf(resolved)
				);
				sliceReading.setDrawnDepth(meters);
				refreshHandles();
				return;
			}
			const point = pointOf(inputValue);
			if (point === null) return;
			if (mode === 'drawing') {
				if (draft === null) return;
				const snapped = snapDrawnAngle(planar(draft.start), planar(point));
				const end: SliceVec3 = [snapped[0], point[1], snapped[1]];
				draft = {
					start: draft.start,
					end,
					label: formatMeters(Math.hypot(end[0] - draft.start[0], end[2] - draft.start[2]))
				};
				return;
			}
			const reading = currentReading();
			if (reading?.kind !== 'drawn') return;
			if (mode === 'line') {
				if (lineOrigin === null) return;
				// The press point is resolved again through the same snapped datum, so a
				// line drag translates by the pointer's ground delta rather than by an
				// unsnapped screen delta.
				const anchor = pointOf({ ...inputValue, css: pressOriginCss });
				if (anchor === null) return;
				const dx = point[0] - anchor[0];
				const dz = point[2] - anchor[2];
				sliceReading.setDrawnSegment({
					start: [lineOrigin.start[0] + dx, lineOrigin.start[1] + dz],
					end: [lineOrigin.end[0] + dx, lineOrigin.end[1] + dz]
				});
			} else if (mode === 'start') {
				sliceReading.setDrawnSegment({
					start: planar(point),
					end: [reading.end[0], reading.end[1]]
				});
			} else if (mode === 'end') {
				sliceReading.setDrawnSegment({
					start: [reading.start[0], reading.start[1]],
					end: planar(point)
				});
			}
			refreshHandles();
		},
		up(inputValue) {
			if (mode === 'idle') return;
			if (mode === 'drawing') {
				commit(inputValue);
				draft = null;
			} else {
				const reading = currentReading();
				if (reading?.kind === 'drawn') {
					const length = Math.hypot(
						reading.end[0] - reading.start[0],
						reading.end[1] - reading.start[1]
					);
					if (length < SLICE_MIN_DRAWN_LENGTH_METERS && before !== null) {
						sliceReading.set(before);
						input.notice('Draw a longer line for the cut.');
					} else {
						const resolved = resolvedDrawn(reading);
						if (resolved !== null) {
							sliceReading.setDrawnDepth(
								clampDrawnDepth(reading.depthMeters, farSideOf(resolved))
							);
						}
					}
				}
			}
			mode = 'idle';
			before = null;
			lineOrigin = null;
			depthAxis = null;
			refreshHandles();
			release();
		},
		cancel() {
			if (mode !== 'idle') {
				if (mode === 'drawing') draft = null;
				else if (before !== null) sliceReading.set(before);
			}
			mode = 'idle';
			draft = null;
			before = null;
			lineOrigin = null;
			depthAxis = null;
			refreshHandles();
			release();
		},
		cancelDraft() {
			if (mode === 'idle' && draft === null) return false;
			this.cancel();
			return true;
		},
		hasDraft() {
			return mode !== 'idle' || draft !== null;
		},
		flip() {
			sliceReading.flipDrawn();
			const resolved = resolvedDrawn(currentReading());
			if (resolved !== null) {
				const reading = currentReading();
				if (reading?.kind === 'drawn') {
					sliceReading.setDrawnDepth(clampDrawnDepth(reading.depthMeters, farSideOf(resolved)));
				}
			}
			refreshHandles();
		},
		setDepth(meters) {
			const resolved = resolvedDrawn(currentReading());
			sliceReading.setDrawnDepth(clampDrawnDepth(meters, farSideOf(resolved)));
			refreshHandles();
		},
		view() {
			return { armed, mode, draft, handles: handleCss };
		}
	};
}
