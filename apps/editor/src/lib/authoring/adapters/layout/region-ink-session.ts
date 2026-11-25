/**
 * V1c — Terrace and Roof › Flat drawing, in the one Pen.
 *
 * A region uses the grammar that already exists: **Line** taps points and closes
 * the ring, **Box** names two opposite corners. Elevation is the Height Sheet's
 * height and a born region is 0.10 m thick. The draft is proposal math only: no
 * document is planned per pointer move, and the release/Enter installs one
 * captured candidate through one F4 entry.
 */
import { mintLayoutIdCapture, type LayoutIdCapture, type LayoutVec2 } from '@portfolio/layout-core';
import type {
	StageAdapterContext,
	StageCandidatePreview,
	StageKeyboardIntent,
	StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import { isStageDrag, stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';

import type { LayoutSessionPorts } from './session-ports';
import { candidatePreviewOf } from './candidate-preview';
import { pointerDatumPoint } from './stage-pointer';
import { previewCoordinates } from './manipulation-support';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';
import {
	LAYOUT_REGION_CREATE_KIND,
	regionCreateIntent,
	regionIdFromCapture,
	type RegionRole
} from './region-planners';

/** A born region's physical thickness; the Card edits it afterwards. */
export const REGION_BIRTH_THICKNESS_METERS = 0.1;
/** The Wall creation default an overhead takes when the Height Sheet is at the datum. */
export const REGION_OVERHEAD_DATUM_DEFAULT_METERS = 3;
/** How near the first point a Line press must land to close the ring, in CSS px. */
export const REGION_CLOSE_HIT_CSS_PX = 10;

export type RegionInkMode = 'box' | 'line';

export type RegionInkSnapshot = {
	readonly role: RegionRole;
	readonly mode: RegionInkMode;
	readonly points: readonly LayoutVec2[];
	readonly elevation: number;
	readonly thickness: number;
	readonly hint: string;
	readonly refusal: string | null;
};

type Press = {
	readonly evaluationId: string;
	readonly css: readonly [number, number];
	readonly point: LayoutVec2;
	dragging: boolean;
};

export function createRegionInkSession(
	ports: Pick<LayoutSessionPorts, 'services' | 'document' | 'levelId' | 'inkTaskOpen'> & {
		readonly role: () => RegionRole;
		readonly publish: () => void;
		readonly select: (sourceKind: 'region', sourceId: string) => void;
		readonly mode: () => RegionInkMode;
	}
) {
	const { services, document, levelId } = ports;
	let points: LayoutVec2[] = [];
	let hoverPoint: LayoutVec2 | null = null;
	let press: Press | null = null;
	let refusal: string | null = null;
	let capture: LayoutIdCapture | null = null;
	let lease: GestureAcquisition | null = null;
	let committing = false;

	function publish(): void {
		services.stage.notifySurfaceChange();
		ports.publish();
	}

	/** End the press's one gesture lease, idempotently. */
	function endLease(): void {
		if (lease?.kind === 'granted' && lease.lease.active) lease.lease.release();
		lease = null;
	}

	function clear(): void {
		points = [];
		hoverPoint = null;
		press = null;
		refusal = null;
		capture = null;
		endLease();
	}

	function elevationNow(): number {
		const sheet = services.stage.heightSheet?.().height() ?? 0;
		if (ports.role() === 'floor') return Math.max(0, Number(sheet.toFixed(9)));
		// An overhead at the datum takes the Wall creation default: a slab at the
		// floor would be a floor region, not a roof.
		return sheet > 0 ? Number(sheet.toFixed(9)) : REGION_OVERHEAD_DATUM_DEFAULT_METERS;
	}

	function signedArea(ring: readonly LayoutVec2[]): number {
		let twice = 0;
		for (let index = 0; index < ring.length; index++) {
			const [x, z] = ring[index]!;
			const [nx, nz] = ring[(index + 1) % ring.length]!;
			twice += x * nz - nx * z;
		}
		return twice / 2;
	}

	/** The codec requires a positive X/Z ring, so a drawn ring is normalised once. */
	function positiveRing(ring: readonly LayoutVec2[]): LayoutVec2[] {
		const copied = ring.map(([x, z]): LayoutVec2 => [x, z]);
		return signedArea(copied) < 0 ? copied.reverse() : copied;
	}

	function boxRing(anchor: LayoutVec2, opposite: LayoutVec2): LayoutVec2[] {
		const [x0, z0] = anchor;
		const [x1, z1] = opposite;
		return positiveRing([
			[x0, z0],
			[x1, z0],
			[x1, z1],
			[x0, z1]
		]);
	}

	function nearFirstPoint(ctx: StageAdapterContext, css: readonly [number, number]): boolean {
		const first = points[0];
		if (first === undefined) return false;
		const projected = ctx.project([first[0], ctx.snapshot.domain.datumMeters, first[1]]);
		if (projected === null) return false;
		const { left, top } = ctx.evaluation.rect;
		return Math.hypot(css[0] + left - projected[0], css[1] + top - projected[1]) <= REGION_CLOSE_HIT_CSS_PX;
	}

	function workRing(): LayoutVec2[] {
		const mode = ports.mode();
		if (mode === 'box') {
			if (press !== null && press.dragging && hoverPoint !== null) {
				return boxRing(press.point, hoverPoint);
			}
			const anchor = points[0];
			return anchor !== undefined && hoverPoint !== null ? boxRing(anchor, hoverPoint) : [];
		}
		const live = [...points];
		if (hoverPoint !== null) live.push(hoverPoint);
		return positiveRing(live);
	}

	async function commit(ring: readonly LayoutVec2[]): Promise<void> {
		if (committing) return;
		if (ring.length < 3) {
			refusal = ports.role() === 'floor'
				? 'A Terrace needs at least three corners.'
				: 'A Flat Roof needs at least three corners.';
			publish();
			return;
		}
		committing = true;
		try {
			const snapshot = services.stage.snapshot();
			const contentRevision = stageUnitRevision(snapshot, 'layout');
			const regionCapture = capture ?? mintLayoutIdCapture();
			const regionId = regionIdFromCapture(document, regionCapture);
			const elevation = elevationNow();
			const outcome = await services.authoring.accept(
				regionCreateIntent({
					regionId,
					role: ports.role(),
					footprint: ring,
					elevation,
					thickness: REGION_BIRTH_THICKNESS_METERS,
					capture: regionCapture,
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision,
					levelId
				})
			);
			if (outcome.kind === 'refused') {
				refusal = outcome.message;
				publish();
				return;
			}
			clear();
			ports.select('region', regionId);
			services.stage.notifySurfaceChange();
		} finally {
			committing = false;
		}
	}

	function finish(): void {
		const ring = positiveRing(points);
		if (ring.length < 3) {
			refusal = 'Name at least three corners to close the region.';
			publish();
			return;
		}
		void commit(ring);
	}

	function pointer(intent: StagePointerIntent, ctx: StageAdapterContext): boolean {
		if (!ports.inkTaskOpen()) return false;
		if (intent.phase === 'cancel') {
			clear();
			publish();
			return true;
		}
		if (intent.phase === 'down') {
			const point = pointerDatumPoint(ctx, intent.css);
			if (point === null) return true;
			// A region press is authored work and must own the pointer for the whole
			// drag: the Stage cancels an adapter gesture that has no live lease before
			// its first move.
			const acquisition = services.stage.acquireGesture({
				owner: 'layout-region-draw',
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (acquisition.kind !== 'granted') {
				refusal = `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`;
				publish();
				return false;
			}
			lease = acquisition;
			refusal = null;
			if (capture === null) capture = mintLayoutIdCapture();
			if (ports.mode() === 'box') {
				if (points.length === 0) {
					points = [[point[0], point[1]]];
					press = { evaluationId: intent.evaluationId, css: intent.css, point: [point[0], point[1]], dragging: false };
					hoverPoint = [point[0], point[1]];
				} else {
					void commit(boxRing(points[0]!, [point[0], point[1]]));
				}
				publish();
				return true;
			}
			if (nearFirstPoint(ctx, intent.css) && points.length >= 3) {
				void commit(positiveRing(points));
				return true;
			}
			points = [...points, [point[0], point[1]]];
			press = { evaluationId: intent.evaluationId, css: intent.css, point: [point[0], point[1]], dragging: false };
			publish();
			return true;
		}
		if (intent.phase === 'move') {
			const point = pointerDatumPoint(ctx, intent.css);
			if (point !== null) hoverPoint = [point[0], point[1]];
			if (press !== null && intent.evaluationId === press.evaluationId) {
				press.dragging =
					press.dragging ||
					isStageDrag(
						{ x: press.css[0], y: press.css[1] },
						{ x: intent.css[0], y: intent.css[1] }
					);
			}
			publish();
			return true;
		}
		// Release: a Box drag names its opposite corner; a tap has already placed.
		const current = press;
		press = null;
		if (
			current !== null &&
			intent.phase === 'up' &&
			ports.mode() === 'box' &&
			current.dragging &&
			hoverPoint !== null
		) {
			void commit(boxRing(current.point, hoverPoint));
		}
		endLease();
		publish();
		return true;
	}

	function hover(intent: StagePointerIntent, ctx: StageAdapterContext): boolean {
		if (intent.phase !== 'move') return false;
		const point = pointerDatumPoint(ctx, intent.css);
		if (point === null) return false;
		hoverPoint = [point[0], point[1]];
		publish();
		return true;
	}

	function key(intent: StageKeyboardIntent): boolean {
		if (intent.kind === 'cancel') {
			if (points.length === 0 && hoverPoint === null) return false;
			clear();
			publish();
			return true;
		}
		if (intent.kind === 'backtrack') {
			if (points.length === 0) return false;
			points = points.slice(0, -1);
			publish();
			return true;
		}
		if (intent.kind === 'finish') {
			if (points.length < 3) return false;
			finish();
			return true;
		}
		return false;
	}

	function snapshot(): RegionInkSnapshot {
		return {
			role: ports.role(),
			mode: ports.mode(),
			points: positiveRing(points),
			elevation: elevationNow(),
			thickness: REGION_BIRTH_THICKNESS_METERS,
			hint:
				ports.mode() === 'box'
					? 'Press one corner and drag to the opposite corner, or click two opposite corners.'
					: 'Click the corners; click the first corner again or press Enter to close the ring.',
			refusal
		};
	}

	function previews(_ctx: StageAdapterContext, y: number): readonly StageCandidatePreview[] {
		const ring = workRing();
		if (ring.length < 2) return [];
		const { world } = previewCoordinates(y);
		const elevation = y + elevationNow();
		const label =
			ports.role() === 'floor'
				? `Terrace · ${elevationNow().toFixed(2)} m`
				: `Flat Roof · ${elevationNow().toFixed(2)} m underside`;
		const first = ring[0]!;
		const last = ring.at(-1)!;
		return [
			candidatePreviewOf({
				id: 'layout-region-ink-candidate',
				role: 'subject',
				geometry: {
					polygons: ring.length >= 3 ? [ring.map((point) => world(point, elevation))] : [],
					segments: [[world(last, elevation), world(first, elevation)]]
				},
				labels: [{ world: world(first, elevation), text: label }]
			})
		];
	}

	return { pointer, hover, key, clear, snapshot, previews, finish };
}

export type RegionInkSession = ReturnType<typeof createRegionInkSession>;

/** The task kind a region birth uses on the one acceptance path. */
export const REGION_CREATE_OPERATION = LAYOUT_REGION_CREATE_KIND;
